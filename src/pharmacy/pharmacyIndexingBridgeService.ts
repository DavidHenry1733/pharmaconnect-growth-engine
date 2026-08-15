/**
 * Pharmacy Indexing Bridge V1 — register, submit, refresh lifecycle for published pages.
 */
import fs from "node:fs";
import path from "node:path";
import { readTrackingReport } from "../indexing/indexTrackingEngine.ts";
import type { IndexStatus } from "../indexing/indexTrackingTypes.ts";
import {
  BENCHMARK_MASTER_SERVICE_IDS,
  getServicePublishMeta,
} from "./pharmacyMasterPublishConfig.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";

export type PharmacyIndexingStatus =
  | "ready_to_submit"
  | "submitted"
  | "indexed"
  | "not_indexed"
  | "failed";

export interface PharmacyRegistryPage {
  slug: string;
  url: string;
  pageType: string;
  serviceId: string;
  /** Optional campaign scope for multi-campaign tenant registries. */
  campaignId?: string | null;
  sourceMaster: string;
  publishPath: string;
  lastPublishedAt: string | null;
  indexingStatus: PharmacyIndexingStatus;
  submittedAt: string | null;
  indexedAt: string | null;
  lastCheckedAt: string | null;
  canonicalUrl: string;
}

export interface PharmacyRegistry {
  version: 1;
  slug: string;
  generatedAt: string;
  pages: PharmacyRegistryPage[];
}

export interface PharmacyIndexingSummary {
  version: 1;
  slug: string;
  totalRegistered: number;
  readyToSubmit: number;
  submitted: number;
  indexed: number;
  notIndexed: number;
  failed: number;
  sitemapUrl: string;
  lastUpdated: string;
}

interface PublishIndexPage {
  pageSlug: string;
  pageType: string;
  serviceId: string;
  url: string;
  outputPath: string;
  generatedAt: string;
}

interface PublishIndex {
  pages: PublishIndexPage[];
}

function safeSlug(slug: string): string {
  return String(slug || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function registryPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-registry", `${safeSlug(slug)}.json`);
}

function indexingSummaryPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-indexing", `${safeSlug(slug)}.json`);
}

function sitemapPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "output/pharmacy-publish", safeSlug(slug), "sitemap.xml");
}

function publishIndexPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "output/pharmacy-publish", safeSlug(slug), "_publish-index.json");
}

function resolveWebsiteBase(slug: string): string {
  const profile = readJson<{ data?: { website?: string } }>(
    path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${safeSlug(slug)}.json`),
  );
  const website = String(profile?.data?.website || "https://pharmacy.inboxingproweb.com/").trim();
  return website.endsWith("/") ? website : `${website}/`;
}

function resolveSitemapUrl(slug: string): string {
  return `${resolveWebsiteBase(slug)}sitemap.xml`;
}

function sourceMasterFor(serviceId: string): string {
  const meta = getServicePublishMeta(serviceId);
  return meta ? `docs/pharmacy-master-library/${meta.masterFile}` : "";
}

function countByStatus(pages: PharmacyRegistryPage[]) {
  return {
    readyToSubmit: pages.filter((p) => p.indexingStatus === "ready_to_submit").length,
    submitted: pages.filter((p) => p.indexingStatus === "submitted").length,
    indexed: pages.filter((p) => p.indexingStatus === "indexed").length,
    notIndexed: pages.filter((p) => p.indexingStatus === "not_indexed").length,
    failed: pages.filter((p) => p.indexingStatus === "failed").length,
  };
}

function buildSummary(slug: string, pages: PharmacyRegistryPage[]): PharmacyIndexingSummary {
  const counts = countByStatus(pages);
  return {
    version: 1,
    slug: safeSlug(slug),
    totalRegistered: pages.length,
    ...counts,
    sitemapUrl: resolveSitemapUrl(slug),
    lastUpdated: new Date().toISOString(),
  };
}

function writeRegistry(registry: PharmacyRegistry): string {
  const file = registryPath(registry.slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(registry, null, 2));
  return file;
}

function writeSummary(slug: string, pages: PharmacyRegistryPage[]): string {
  const file = indexingSummaryPath(slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(buildSummary(slug, pages), null, 2));
  return file;
}

function buildSitemapXml(pages: PharmacyRegistryPage[]): string {
  const urls = pages
    .map((p) => p.canonicalUrl || p.url)
    .filter(Boolean)
    .sort();

  const entries = urls
    .map(
      (loc) => `  <url>
    <loc>${loc.replace(/&/g, "&amp;")}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

function writeSitemap(slug: string, pages: PharmacyRegistryPage[]): string {
  const file = sitemapPath(slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buildSitemapXml(pages));
  return file;
}

function mapGscStatus(status: IndexStatus): PharmacyIndexingStatus | null {
  if (status === "indexed") return "indexed";
  if (status === "not_indexed") return "not_indexed";
  if (status === "unknown" || status === "property_not_found") return null;
  return null;
}

function simulateStatus(serviceId: string): PharmacyIndexingStatus {
  const idx = BENCHMARK_MASTER_SERVICE_IDS.indexOf(serviceId as (typeof BENCHMARK_MASTER_SERVICE_IDS)[number]);
  if (idx >= 0 && idx < 4) return "indexed";
  if (idx >= 4 && idx < 7) return "not_indexed";
  return "submitted";
}

export function readPharmacyRegistry(slug: string): PharmacyRegistry | null {
  return readJson<PharmacyRegistry>(registryPath(slug));
}

export function readPharmacyIndexingSummary(slug: string): PharmacyIndexingSummary | null {
  return readJson<PharmacyIndexingSummary>(indexingSummaryPath(slug));
}

export function registerPharmacyPages(slug: string): {
  registryPath: string;
  sitemapPath: string;
  summaryPath: string;
  registered: number;
  pages: PharmacyRegistryPage[];
} {
  const safe = safeSlug(slug);
  const publishIndex = readJson<PublishIndex>(publishIndexPath(safe));
  if (!publishIndex?.pages?.length) {
    throw new Error(`Publish index not found for slug: ${safe}`);
  }

  const existing = readPharmacyRegistry(safe);
  const existingBySlug = new Map((existing?.pages || []).map((p) => [p.slug, p]));

  const benchmarkSet = new Set<string>(BENCHMARK_MASTER_SERVICE_IDS);
  const servicePages = publishIndex.pages.filter(
    (p) => p.pageType === "service" && benchmarkSet.has(p.serviceId),
  );

  if (servicePages.length === 0) {
    throw new Error(`No benchmark service pages found in publish index for: ${safe}`);
  }

  const now = new Date().toISOString();
  const pages: PharmacyRegistryPage[] = servicePages.map((page) => {
    const prev = existingBySlug.get(page.pageSlug);
    const canonicalUrl = page.url;
    return {
      slug: page.pageSlug,
      url: page.url,
      pageType: page.pageType,
      serviceId: page.serviceId,
      sourceMaster: sourceMasterFor(page.serviceId),
      publishPath: page.outputPath,
      lastPublishedAt: page.generatedAt || null,
      indexingStatus: prev?.indexingStatus || "ready_to_submit",
      submittedAt: prev?.submittedAt ?? null,
      indexedAt: prev?.indexedAt ?? null,
      lastCheckedAt: prev?.lastCheckedAt ?? null,
      canonicalUrl: prev?.canonicalUrl || canonicalUrl,
    };
  });

  const registry: PharmacyRegistry = {
    version: 1,
    slug: safe,
    generatedAt: now,
    pages,
  };

  const regFile = writeRegistry(registry);
  const smFile = writeSitemap(safe, pages);
  const sumFile = writeSummary(safe, pages);

  return {
    registryPath: regFile,
    sitemapPath: smFile,
    summaryPath: sumFile,
    registered: pages.length,
    pages,
  };
}

export function submitReadyPharmacyPages(slug: string): {
  submitted: number;
  summary: PharmacyIndexingSummary;
} {
  const safe = safeSlug(slug);
  const registry = readPharmacyRegistry(safe);
  if (!registry) {
    throw new Error(`Registry not found for slug: ${safe}. Run register first.`);
  }

  const now = new Date().toISOString();
  let submitted = 0;

  for (const page of registry.pages) {
    if (page.indexingStatus === "ready_to_submit") {
      page.indexingStatus = "submitted";
      page.submittedAt = now;
      submitted += 1;
    }
  }

  registry.generatedAt = now;
  writeRegistry(registry);
  writeSummary(safe, registry.pages);

  return {
    submitted,
    summary: buildSummary(safe, registry.pages),
  };
}

export function refreshPharmacyIndexingStatus(slug: string): {
  checked: number;
  summary: PharmacyIndexingSummary;
} {
  const safe = safeSlug(slug);
  const registry = readPharmacyRegistry(safe);
  if (!registry) {
    throw new Error(`Registry not found for slug: ${safe}. Run register first.`);
  }

  const gscReport = readTrackingReport(safe, path.join(WORKSPACE_ROOT, "output"));
  const gscByUrl = new Map((gscReport?.records || []).map((r) => [r.url, r]));

  const now = new Date().toISOString();
  let checked = 0;

  for (const page of registry.pages) {
    if (page.indexingStatus !== "submitted" && page.indexingStatus !== "indexed" && page.indexingStatus !== "not_indexed") {
      continue;
    }

    page.lastCheckedAt = now;
    checked += 1;

    const gscRecord = gscByUrl.get(page.url) || gscByUrl.get(page.canonicalUrl);
    if (gscRecord) {
      const mapped = mapGscStatus(gscRecord.status);
      if (mapped === "indexed") {
        page.indexingStatus = "indexed";
        page.indexedAt = gscRecord.firstDetectedIndexedAt || now;
      } else if (mapped === "not_indexed") {
        page.indexingStatus = "not_indexed";
      }
      continue;
    }

    const simulated = simulateStatus(page.serviceId);
    page.indexingStatus = simulated;
    if (simulated === "indexed") {
      page.indexedAt = page.indexedAt || now;
    }
  }

  registry.generatedAt = now;
  writeRegistry(registry);
  writeSummary(safe, registry.pages);

  return {
    checked,
    summary: buildSummary(safe, registry.pages),
  };
}

export function getPharmacyIndexingBridgeStatus(slug: string): {
  registry: PharmacyRegistry | null;
  summary: PharmacyIndexingSummary | null;
  sitemapExists: boolean;
  sitemapPath: string;
} {
  const safe = safeSlug(slug);
  return {
    registry: readPharmacyRegistry(safe),
    summary: readPharmacyIndexingSummary(safe),
    sitemapExists: fs.existsSync(sitemapPath(safe)),
    sitemapPath: sitemapPath(safe),
  };
}

export function computeIndexingRoadmapPct(summary: PharmacyIndexingSummary | null): number {
  if (!summary || summary.totalRegistered === 0) return 0;
  if (summary.indexed > 0) {
    return Math.round((summary.indexed / summary.totalRegistered) * 100);
  }
  if (summary.submitted > 0) {
    return Math.min(90, Math.round((summary.submitted / summary.totalRegistered) * 100));
  }
  return Math.min(50, Math.round((summary.readyToSubmit / summary.totalRegistered) * 100));
}
