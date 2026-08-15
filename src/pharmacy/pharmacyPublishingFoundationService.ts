/**
 * Pharmacy Publishing Foundation V1 — registry, sitemap, manifest, status.
 */
import fs from "node:fs";
import path from "node:path";
import { loadAllGeneratedServiceAreaPages } from "./pharmacyServiceAreaPageGenerator.ts";
import { loadAllGeneratedServicePages } from "./pharmacyServicePageGenerator.ts";
import { loadAllGeneratedServiceHubs } from "./pharmacyServiceHubGenerator.ts";
import {
  summariseValidation,
  validatePharmacyPage,
  type PharmacyPageType,
  type PharmacyValidationResult,
} from "./pharmacyPublishingValidation.ts";

const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";

export const REGISTRY_PATH = path.join(ROOT, "data/pharmacy-page-registry.json");
export const SITEMAP_PATH = path.join(ROOT, "output/pharmacy-sitemap.xml");
export const MANIFEST_PATH = path.join(ROOT, "output/pharmacy-publish-manifest.json");

export type PharmacyPageStatus = "generated" | "validated" | "failed" | "publish-ready" | "published";

export interface PharmacyRegistryEntry {
  slug: string;
  pageType: PharmacyPageType;
  serviceId: string;
  areaSlug: string | null;
  title: string;
  url: string;
  generatedAt: string;
  publishedAt: string | null;
  status: PharmacyPageStatus;
  wordCount: number;
  pageSlug: string;
}

export interface PharmacyPageRegistry {
  version: 1;
  updatedAt: string;
  slug: string;
  baseUrl: string;
  pageCount: number;
  pages: PharmacyRegistryEntry[];
}

export interface PharmacyPublishManifest {
  version: 1;
  generatedAt: string;
  slug: string;
  summary: {
    totalPages: number;
    publishableCount: number;
    failedCount: number;
    servicePageCount: number;
    areaPageCount: number;
    hubPageCount: number;
    validationPassCount: number;
    validationFailCount: number;
    passRate: number;
  };
  publishablePages: Array<PharmacyRegistryEntry & { validation: PharmacyValidationResult }>;
  failedPages: Array<PharmacyRegistryEntry & { validation: PharmacyValidationResult }>;
  validation: ReturnType<typeof summariseValidation>;
}

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function writeText(file: string, data: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data, "utf8");
}

function resolveBaseUrl(slug: string): string {
  const profile = readJson<any>(path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`), {});
  const website = String(profile?.data?.website || profile?.website || "").trim();
  if (website) return website.replace(/\/$/, "");

  const project = readJson<any>(path.join(ROOT, "config/projects", `${slug}.json`), {});
  const domain = String(project?.domain || "").trim();
  if (domain) return domain.replace(/\/$/, "");

  return `https://${slug}.example.com`;
}

function buildPageUrl(baseUrl: string, pageSlug: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${pageSlug}/`;
}

function serialisePage(page: Record<string, unknown>): string {
  return JSON.stringify(page);
}

function registryStatus(
  validation: PharmacyValidationResult,
  publishedAt: string | null,
): PharmacyPageStatus {
  if (publishedAt) return "published";
  if (validation.passed) return "publish-ready";
  if (validation.errors.length) return "failed";
  return "generated";
}

function toValidationInput(
  page: Record<string, any>,
  pageType: PharmacyPageType,
): Parameters<typeof validatePharmacyPage>[0] {
  return {
    pageType,
    pageSlug: page.pageSlug,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    schema: page.schema,
    cta: page.cta,
    sections: page.sections,
    qualitySignals: page.qualitySignals,
    bodyText: serialisePage(page),
    page,
  };
}

export function buildPharmacyRegistry(slug: string): PharmacyPageRegistry {
  const baseUrl = resolveBaseUrl(slug);
  const { pages: servicePages } = loadAllGeneratedServicePages(slug);
  const { pages: areaPages } = loadAllGeneratedServiceAreaPages(slug);
  const now = new Date().toISOString();

  const entries: PharmacyRegistryEntry[] = [];

  for (const page of servicePages) {
    const validation = validatePharmacyPage(toValidationInput(page, "service"));
    entries.push({
      slug,
      pageType: "service",
      serviceId: page.serviceId,
      areaSlug: null,
      title: page.metaTitle || page.h1 || page.serviceName,
      url: buildPageUrl(baseUrl, page.pageSlug),
      generatedAt: page.generatedAt || now,
      publishedAt: null,
      status: registryStatus(validation, null),
      wordCount: page.qualitySignals?.wordCount ?? 0,
      pageSlug: page.pageSlug,
    });
  }

  for (const page of areaPages) {
    const validation = validatePharmacyPage(toValidationInput(page, "service-area"));
    entries.push({
      slug,
      pageType: "service-area",
      serviceId: page.serviceId,
      areaSlug: page.areaSlug,
      title: page.metaTitle || page.h1 || `${page.serviceName} ${page.area}`,
      url: buildPageUrl(baseUrl, page.pageSlug),
      generatedAt: page.generatedAt || now,
      publishedAt: null,
      status: registryStatus(validation, null),
      wordCount: page.qualitySignals?.wordCount ?? 0,
      pageSlug: page.pageSlug,
    });
  }

  const { pages: hubPages } = loadAllGeneratedServiceHubs(slug);
  for (const page of hubPages) {
    const validation = validatePharmacyPage(toValidationInput(page, "service-hub"));
    entries.push({
      slug,
      pageType: "service-hub",
      serviceId: page.serviceId,
      areaSlug: null,
      title: page.metaTitle || page.h1 || `${page.serviceName} Hub`,
      url: buildPageUrl(baseUrl, page.pageSlug),
      generatedAt: page.generatedAt || now,
      publishedAt: null,
      status: registryStatus(validation, null),
      wordCount: page.qualitySignals?.wordCount ?? 0,
      pageSlug: page.pageSlug,
    });
  }

  entries.sort((a, b) => a.pageSlug.localeCompare(b.pageSlug));

  return {
    version: 1,
    updatedAt: now,
    slug,
    baseUrl,
    pageCount: entries.length,
    pages: entries,
  };
}

export function validateRegistryPages(slug: string): PharmacyValidationResult[] {
  const { pages: servicePages } = loadAllGeneratedServicePages(slug);
  const { pages: areaPages } = loadAllGeneratedServiceAreaPages(slug);

  const { pages: hubPages } = loadAllGeneratedServiceHubs(slug);

  const results: PharmacyValidationResult[] = [
    ...servicePages.map((p) => validatePharmacyPage(toValidationInput(p, "service"))),
    ...areaPages.map((p) => validatePharmacyPage(toValidationInput(p, "service-area"))),
    ...hubPages.map((p) => validatePharmacyPage(toValidationInput(p, "service-hub"))),
  ];

  return results.sort((a, b) => a.pageSlug.localeCompare(b.pageSlug));
}

export function buildPharmacySitemap(registry: PharmacyPageRegistry): string {
  const urls = registry.pages
    .filter((p) => p.status === "publish-ready" || p.status === "published")
    .map((p) => {
      const lastmod = (p.publishedAt || p.generatedAt || registry.updatedAt).slice(0, 10);
      return `  <url>
    <loc>${escapeXml(p.url)}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`;
    });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
}

function escapeXml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildPharmacyPublishManifest(
  slug: string,
  registry: PharmacyPageRegistry,
  validationResults: PharmacyValidationResult[],
): PharmacyPublishManifest {
  const summary = summariseValidation(validationResults);
  const validationBySlug = new Map(validationResults.map((v) => [v.pageSlug, v]));

  const publishablePages = registry.pages
    .filter((p) => validationBySlug.get(p.pageSlug)?.passed)
    .map((p) => ({ ...p, validation: validationBySlug.get(p.pageSlug)! }));

  const failedPages = registry.pages
    .filter((p) => !validationBySlug.get(p.pageSlug)?.passed)
    .map((p) => ({ ...p, validation: validationBySlug.get(p.pageSlug)! }));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    slug,
    summary: {
      totalPages: registry.pageCount,
      publishableCount: publishablePages.length,
      failedCount: failedPages.length,
      servicePageCount: registry.pages.filter((p) => p.pageType === "service").length,
      areaPageCount: registry.pages.filter((p) => p.pageType === "service-area").length,
      hubPageCount: registry.pages.filter((p) => p.pageType === "service-hub").length,
      validationPassCount: summary.passCount,
      validationFailCount: summary.failCount,
      passRate: summary.passRate,
    },
    publishablePages,
    failedPages,
    validation: summary,
  };
}

export interface PharmacyPublishingBuildResult {
  registry: PharmacyPageRegistry;
  manifest: PharmacyPublishManifest;
  sitemapPath: string;
  registryPath: string;
  manifestPath: string;
  sitemapUrlCount: number;
}

export function buildPharmacyPublishingFoundation(slug: string): PharmacyPublishingBuildResult {
  const validationResults = validateRegistryPages(slug);
  const registry = buildPharmacyRegistry(slug);

  // Reconcile registry status from validation
  const validationBySlug = new Map(validationResults.map((v) => [v.pageSlug, v]));
  registry.pages = registry.pages.map((entry) => {
    const validation = validationBySlug.get(entry.pageSlug);
    if (!validation) return entry;
    return {
      ...entry,
      status: registryStatus(validation, entry.publishedAt),
    };
  });

  const manifest = buildPharmacyPublishManifest(slug, registry, validationResults);
  const sitemap = buildPharmacySitemap(registry);

  writeJson(REGISTRY_PATH, registry);
  writeJson(MANIFEST_PATH, manifest);
  writeText(SITEMAP_PATH, sitemap);

  const sitemapUrlCount = (sitemap.match(/<loc>/g) || []).length;

  return {
    registry,
    manifest,
    sitemapPath: SITEMAP_PATH,
    registryPath: REGISTRY_PATH,
    manifestPath: MANIFEST_PATH,
    sitemapUrlCount,
  };
}

export function getPharmacyPublishingStatus(slug: string) {
  const registry = readJson<PharmacyPageRegistry | null>(REGISTRY_PATH, null);
  const manifest = readJson<PharmacyPublishManifest | null>(MANIFEST_PATH, null);

  const { pages: servicePages } = loadAllGeneratedServicePages(slug);
  const { pages: areaPages } = loadAllGeneratedServiceAreaPages(slug);

  const { pages: hubPages } = loadAllGeneratedServiceHubs(slug);

  let sitemapCount = 0;
  if (fs.existsSync(SITEMAP_PATH)) {
    const xml = fs.readFileSync(SITEMAP_PATH, "utf8");
    sitemapCount = (xml.match(/<loc>/g) || []).length;
  }

  const registryPages = registry?.slug === slug ? registry.pages : [];
  const registryCount = registryPages.length || servicePages.length + areaPages.length;

  return {
    ok: true,
    slug,
    servicePageCount: servicePages.length,
    areaPageCount: areaPages.length,
    hubPageCount: hubPages.length,
    totalPageCount: servicePages.length + areaPages.length + hubPages.length,
    registryCount,
    registryUpdatedAt: registry?.updatedAt || null,
    sitemapCount,
    sitemapPath: SITEMAP_PATH,
    registryPath: REGISTRY_PATH,
    manifestPath: MANIFEST_PATH,
    validationPassCount: manifest?.summary.validationPassCount ?? 0,
    validationFailCount: manifest?.summary.validationFailCount ?? 0,
    publishReadyCount: manifest?.summary.publishableCount ?? registryPages.filter((p) => p.status === "publish-ready").length,
    passRate: manifest?.summary.passRate ?? 0,
    manifestGeneratedAt: manifest?.generatedAt || null,
    expectedPages: {
      services: 5,
      hubs: 5,
      areas: 3,
      areaPages: 15,
      total: 25,
    },
  };
}
