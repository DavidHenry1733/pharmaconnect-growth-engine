/**
 * Growth Engine — Website Intelligence V1 service (crawl, analyse, persist).
 */
import fs from "node:fs";
import path from "node:path";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import { GROWTH_ENGINE_DIR } from "./growthEngineLocalMarketService.ts";
import { crawlWebsite, extractTechnicalSignals } from "./growthEngineWebsiteCrawler.ts";
import { buildWebsiteIntelligenceAnalysis } from "./growthEngineWebsiteIntelligenceAnalysis.ts";
import {
  emptyWebsiteSnapshot,
  normalizeWebsiteSnapshot,
  WEBSITE_INTELLIGENCE_SNAPSHOT_VERSION,
  type GrowthEngineWebsiteIntelligenceSnapshot,
} from "./growthEngineWebsiteIntelligenceModel.ts";
import { websiteImportSnapshotToGrowthEngineSnapshot } from "./growthEngineWebsiteIntelligenceImportV2Service.ts";
import { getPharmacyProjectConfigPath, safePharmacySlug } from "./pharmacyWorkspacePaths.ts";

function profilePath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${safePharmacySlug(slug)}.json`);
}

function profileFileExists(slug: string): boolean {
  return fs.existsSync(profilePath(slug));
}

function readProjectConfig(slug: string): Record<string, unknown> | null {
  const file = getPharmacyProjectConfigPath(safePharmacySlug(slug));
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hrefFromUnknown(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const row = value as Record<string, unknown>;
  return String(row.href || row.url || "").trim();
}

function collectProjectWebsiteSeeds(slug: string): string[] {
  const project = readProjectConfig(slug);
  if (!project) return [];
  const seeds: string[] = [];
  const push = (raw: string) => {
    const value = raw.trim();
    if (!value || value.startsWith("#")) return;
    if (/^https?:\/\//i.test(value) || value.startsWith("/")) seeds.push(value);
  };
  for (const key of ["navItems", "footerLinks", "footerServiceLinks"] as const) {
    const list = project[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) push(hrefFromUnknown(item));
  }
  const money = project.serviceMoneyPages;
  if (money && typeof money === "object") {
    for (const value of Object.values(money as Record<string, unknown>)) push(String(value || "").trim());
  }
  for (const key of ["privacyUrl", "termsUrl", "primaryCtaUrl"] as const) {
    push(String(project[key] || "").trim());
  }
  return [...new Set(seeds)];
}

export function resolveWebsiteUrlForIntelligence(slug: string): string {
  const safe = safePharmacySlug(slug);
  if (profileFileExists(safe)) {
    const profile = loadProfile(safe);
    const fromProfile = normalizeWebsiteUrl(profile.website || "");
    if (fromProfile) return fromProfile;
  }
  const project = readProjectConfig(safe);
  if (!project) return "";
  return normalizeWebsiteUrl(
    String(project.domain || project.website || project.canonicalWebsite || project.subjectDomain || ""),
  );
}

function loadProfile(slug: string) {
  if (!fs.existsSync(profilePath(slug))) return normalizeProfileData({});
  const doc = JSON.parse(fs.readFileSync(profilePath(slug), "utf8"));
  return normalizeProfileData(doc.data || {});
}

export function websiteIntelligenceSnapshotPath(slug: string): string {
  return path.join(GROWTH_ENGINE_DIR, `${slug}-website-intelligence.json`);
}

export function writeWebsiteIntelligenceSnapshot(snapshot: GrowthEngineWebsiteIntelligenceSnapshot): string {
  fs.mkdirSync(GROWTH_ENGINE_DIR, { recursive: true });
  const file = websiteIntelligenceSnapshotPath(snapshot.slug);
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
  return file;
}

export function loadWebsiteIntelligenceSnapshot(slug: string): GrowthEngineWebsiteIntelligenceSnapshot | null {
  const file = websiteIntelligenceSnapshotPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return normalizeWebsiteSnapshot(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    return null;
  }
}

/** Prefer persisted snapshot; fall back to imported website intelligence on the canonical profile. */
export function resolveWebsiteIntelligenceSnapshot(slug: string): GrowthEngineWebsiteIntelligenceSnapshot | null {
  const persisted = loadWebsiteIntelligenceSnapshot(slug);
  if (persisted?.analysis?.pages?.length) return persisted;

  const profile = loadProfile(slug);
  const importSnap = profile.websiteImportSnapshot;
  if (!importSnap?.importedAt || importSnap.status === "not_found") return persisted;

  const bridged = websiteImportSnapshotToGrowthEngineSnapshot(slug, importSnap, profile);
  return bridged || persisted;
}

function normalizeWebsiteUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return "";
  return url.startsWith("http") ? url : `https://${url}`;
}

export async function analyseWebsiteIntelligence(slug: string): Promise<GrowthEngineWebsiteIntelligenceSnapshot> {
  const safe = safePharmacySlug(slug);
  const profile = loadProfile(safe);
  const websiteUrl = resolveWebsiteUrlForIntelligence(safe);

  if (!websiteUrl) {
    const empty = { ...emptyWebsiteSnapshot(safe), source: "no-website" as const };
    writeWebsiteIntelligenceSnapshot(empty);
    return empty;
  }

  const navSeeds = profileFileExists(safe)
    ? (profile.headerNavLinks || []).map((l) => l.url).filter((url) => url && !url.startsWith("#"))
    : [];
  const extraSeeds = [...navSeeds, ...collectProjectWebsiteSeeds(safe)];

  const crawl = await crawlWebsite(websiteUrl, extraSeeds);
  if (!crawl.pages.length) {
    const failed = {
      version: WEBSITE_INTELLIGENCE_SNAPSHOT_VERSION,
      slug: safe,
      generatedAt: new Date().toISOString(),
      source: "fetch-failed" as const,
      websiteUrl,
      analysis: null,
    };
    writeWebsiteIntelligenceSnapshot(failed);
    return failed;
  }

  const technical = extractTechnicalSignals(
    crawl.homepageHtml,
    websiteUrl,
    crawl.sitemapUrls.length > 0,
    crawl.robotsDetected,
  );

  const analysis = buildWebsiteIntelligenceAnalysis({
    websiteUrl,
    pages: crawl.pages,
    technical,
    profile,
  });

  const snapshot: GrowthEngineWebsiteIntelligenceSnapshot = {
    version: WEBSITE_INTELLIGENCE_SNAPSHOT_VERSION,
    slug: safe,
    generatedAt: new Date().toISOString(),
    source: "website-live",
    websiteUrl,
    analysis,
  };

  writeWebsiteIntelligenceSnapshot(snapshot);
  return snapshot;
}

/**
 * Reuse a persisted bounded inventory when present. Otherwise run the existing
 * website-intelligence importer once for the configured tenant website.
 */
export async function ensureWebsiteIntelligenceInventory(
  slug: string,
): Promise<GrowthEngineWebsiteIntelligenceSnapshot | null> {
  const safe = safePharmacySlug(slug);
  const existing = resolveWebsiteIntelligenceSnapshot(safe);
  if (existing?.analysis?.pages?.length) return existing;

  const persisted = loadWebsiteIntelligenceSnapshot(safe);
  if (persisted?.source === "fetch-failed" || persisted?.source === "no-website" || persisted?.source === "website-live") {
    return persisted;
  }

  const websiteUrl = resolveWebsiteUrlForIntelligence(safe);
  if (!websiteUrl) {
    const empty = { ...emptyWebsiteSnapshot(safe), source: "no-website" as const };
    writeWebsiteIntelligenceSnapshot(empty);
    return empty;
  }

  return analyseWebsiteIntelligence(safe);
}

export function refreshWebsiteIntelligenceAnalysis(
  snapshot: GrowthEngineWebsiteIntelligenceSnapshot,
): GrowthEngineWebsiteIntelligenceSnapshot {
  if (!snapshot.analysis?.pages?.length) return snapshot;
  const profile = loadProfile(snapshot.slug);
  const analysis = buildWebsiteIntelligenceAnalysis({
    websiteUrl: snapshot.websiteUrl,
    pages: snapshot.analysis.pages,
    technical: snapshot.analysis.technical,
    profile,
  });
  return { ...snapshot, analysis };
}
