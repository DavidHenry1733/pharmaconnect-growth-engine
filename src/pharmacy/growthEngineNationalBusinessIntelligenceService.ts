/**
 * Generic national Business Intelligence foundation.
 * Assembles identity, services, market, and website inventory from canonical
 * tenant/profile/import/website evidence. Does not call DataForSEO, Places, or GSC.
 * Does not hard-code tenant slugs, domains, or services.
 */
import fs from "node:fs";
import path from "node:path";

import { resolveGrowthPlatform, isNationalGrowthPlatform, type GrowthPlatform } from "./growthPlatformResolverService.ts";
import { resolveTenantServiceCatalogue, type TenantServiceCatalogueEntry } from "./growthEngineTenantServiceCatalogue.ts";
import { serviceDisplayName } from "./growthEngineWebsiteServiceDetection.ts";
import { resolveWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceService.ts";
import { hostFromConfiguredDomain } from "./nationalIntelligenceSubjectResolver.ts";
import { marketScopeLabel, resolveMarketScope, resolvePrimaryMarket } from "./masterAdminMarketScopeService.ts";
import { getPharmacyProjectConfigPath, safePharmacySlug, WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { normalizeProfileData, type PharmacyProfileData, type WebsiteImportSnapshot } from "./pharmacyProfileSchema.ts";
import type {
  GrowthEngineWebsiteIntelligenceSnapshot,
  WebsitePageCategory,
  WebsitePageInventoryItem,
} from "./growthEngineWebsiteIntelligenceModel.ts";

export type EvidenceOrigin =
  | "IMPORTED"
  | "CONFIGURED"
  | "PROFILE"
  | "NOT_FOUND"
  | "NOT_CONFIGURED"
  | "INSUFFICIENT_EVIDENCE"
  | "NOT_YET_CONNECTED";

export type CompletenessStatus = "COMPLETE" | "PARTIAL" | "MISSING";

export interface ProvenancedFact {
  value: string | null;
  display: string;
  source: string;
  sourceUrl: string | null;
  origin: EvidenceOrigin;
  confidence: "high" | "medium" | "low" | "none";
}

export interface NationalBiServiceRow {
  serviceName: string;
  canonicalService: string;
  serviceId: string;
  source: string;
  sourceUrl: string | null;
  confidence: "high" | "medium" | "low";
  origin: EvidenceOrigin;
  status: "ACTIVE" | "AVAILABLE" | "DETECTED";
}

export interface NationalBiPageRow {
  url: string;
  title: string;
  type: string;
  category: string;
  associatedService: string | null;
  source: string;
  sourceUrl: string | null;
  confidence: "high" | "medium" | "low" | "none";
}

export interface NationalWebsiteInventorySummary {
  totalPages: number | null;
  commercialServicePages: number | null;
  blogResourcePages: number | null;
  aboutContactUtilityPages: number | null;
  unknownOtherPages: number | null;
  pages: NationalBiPageRow[];
  origin: EvidenceOrigin;
  source: string;
}

export interface NationalBusinessIntelligenceView {
  slug: string;
  platform: GrowthPlatform;
  identity: {
    businessName: ProvenancedFact;
    domain: ProvenancedFact;
    websiteUrl: ProvenancedFact;
    description: ProvenancedFact;
    businessType: ProvenancedFact;
    legalName: ProvenancedFact;
    phone: ProvenancedFact;
    email: ProvenancedFact;
    proposition: ProvenancedFact;
    cta: ProvenancedFact;
    logoUrl: ProvenancedFact;
  };
  services: NationalBiServiceRow[];
  targetCustomer: ProvenancedFact;
  marketCountry: ProvenancedFact;
  marketScope: ProvenancedFact;
  geography: ProvenancedFact;
  inventory: NationalWebsiteInventorySummary;
  completeness: {
    identity: CompletenessStatus;
    services: CompletenessStatus;
    targetCustomer: CompletenessStatus;
    market: CompletenessStatus;
    websiteInventory: CompletenessStatus;
  };
  readyForCompetitorDiscovery: boolean;
  missingRequired: string[];
  sparseBusiness: boolean;
}

export interface NationalBiSources {
  slug: string;
  project: Record<string, unknown> | null;
  profile: PharmacyProfileData | null;
  website: GrowthEngineWebsiteIntelligenceSnapshot | null;
  importSnap: WebsiteImportSnapshot | null;
  platform: GrowthPlatform;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function unknownDisplay(origin: EvidenceOrigin): string {
  if (origin === "NOT_YET_CONNECTED") return "NOT YET CONNECTED";
  if (origin === "INSUFFICIENT_EVIDENCE") return "INSUFFICIENT EVIDENCE";
  if (origin === "NOT_CONFIGURED") return "NOT CONFIGURED";
  return "NOT FOUND";
}

function fact(
  value: string,
  source: string,
  origin: EvidenceOrigin,
  opts?: { sourceUrl?: string | null; confidence?: ProvenancedFact["confidence"] },
): ProvenancedFact {
  const cleaned = text(value);
  if (!cleaned) {
    const missingOrigin = origin === "IMPORTED" || origin === "CONFIGURED" || origin === "PROFILE" ? "NOT_FOUND" : origin;
    return {
      value: null,
      display: unknownDisplay(missingOrigin),
      source: source || "none",
      sourceUrl: opts?.sourceUrl || null,
      origin: missingOrigin,
      confidence: "none",
    };
  }
  return {
    value: cleaned,
    display: cleaned,
    source,
    sourceUrl: opts?.sourceUrl ?? null,
    origin,
    confidence: opts?.confidence || (origin === "CONFIGURED" || origin === "IMPORTED" ? "high" : "medium"),
  };
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

function loadProfileIfPresent(slug: string): PharmacyProfileData | null {
  const file = path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${safePharmacySlug(slug)}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const doc = JSON.parse(fs.readFileSync(file, "utf8")) as { data?: unknown };
    return normalizeProfileData(doc.data || doc);
  } catch {
    return null;
  }
}

function firstPresent(
  candidates: Array<{ value: string; source: string; origin: EvidenceOrigin; sourceUrl?: string | null; confidence?: ProvenancedFact["confidence"] }>,
  fallbackOrigin: EvidenceOrigin = "NOT_FOUND",
): ProvenancedFact {
  for (const row of candidates) {
    if (text(row.value)) return fact(row.value, row.source, row.origin, { sourceUrl: row.sourceUrl, confidence: row.confidence });
  }
  return fact("", "none", fallbackOrigin);
}

const SERVICE_PAGE_TYPES = new Set<WebsitePageCategory>(["service-page", "services", "pricing", "landing", "offer"]);
const BLOG_RESOURCE_TYPES = new Set<WebsitePageCategory>(["blog", "guide", "faq", "news", "resources"]);
const UTILITY_TYPES = new Set<WebsitePageCategory>(["about", "contact", "policy", "utility", "booking", "homepage"]);

function groupedPageType(category: string): NationalBiPageRow["type"] {
  if (SERVICE_PAGE_TYPES.has(category as WebsitePageCategory)) return "commercial/service";
  if (BLOG_RESOURCE_TYPES.has(category as WebsitePageCategory)) return "blog/resource";
  if (UTILITY_TYPES.has(category as WebsitePageCategory)) return "about/contact/utility";
  return "unknown/other";
}

function normalizeComparablePath(url: string): string {
  try {
    const parsed = new URL(url, "https://placeholder.local");
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return path.toLowerCase();
  } catch {
    return url.replace(/\/+$/, "").toLowerCase();
  }
}

function associatedServiceForPage(
  page: WebsitePageInventoryItem,
  catalogue: TenantServiceCatalogueEntry[],
): { name: string | null; confidence: NationalBiPageRow["confidence"] } {
  const pagePath = normalizeComparablePath(page.url || page.path || "");
  for (const service of catalogue) {
    if (!service.href) continue;
    const hrefPath = normalizeComparablePath(service.href);
    if (hrefPath && hrefPath !== "/" && (pagePath === hrefPath || pagePath.startsWith(`${hrefPath}/`))) {
      return { name: service.serviceName, confidence: "high" };
    }
  }
  for (const service of catalogue) {
    if (overlapService(`${page.title} ${page.path} ${page.url}`, service.serviceName)) {
      return { name: service.serviceName, confidence: "medium" };
    }
  }
  const detectedId = page.detectedServiceIds?.[0];
  if (detectedId) {
    const matched = catalogue.find((service) => service.serviceId === detectedId);
    return { name: matched?.serviceName || serviceDisplayName(detectedId), confidence: "medium" };
  }
  return { name: null, confidence: "none" };
}

function emptyInventory(
  origin: EvidenceOrigin,
  source: string,
): NationalWebsiteInventorySummary {
  const counted = origin === "INSUFFICIENT_EVIDENCE";
  return {
    totalPages: counted ? 0 : null,
    commercialServicePages: counted ? 0 : null,
    blogResourcePages: counted ? 0 : null,
    aboutContactUtilityPages: counted ? 0 : null,
    unknownOtherPages: counted ? 0 : null,
    pages: [],
    origin,
    source,
  };
}

function countBy(pages: WebsitePageInventoryItem[], set: Set<WebsitePageCategory>): number {
  return pages.filter((page) => set.has(page.category)).length;
}

export function summariseWebsiteInventory(
  website: GrowthEngineWebsiteIntelligenceSnapshot | null,
  importSnap: WebsiteImportSnapshot | null,
  catalogue?: TenantServiceCatalogueEntry[],
): NationalWebsiteInventorySummary {
  const analysis = website?.analysis;
  const pages = analysis?.pages || importSnap?.intelligence?.structure?.pages || [];
  const source = website?.analysis ? "website-intelligence" : importSnap?.intelligence?.structure?.pages?.length ? "website-import-snapshot" : "website-intelligence";
  if (!pages.length) {
    if (website?.source === "fetch-failed" || website?.source === "website-live") {
      return emptyInventory("INSUFFICIENT_EVIDENCE", source);
    }
    if (website?.source === "no-website") {
      return emptyInventory("NOT_CONFIGURED", source);
    }
    return emptyInventory("NOT_YET_CONNECTED", source);
  }
  const services = catalogue || (website?.slug ? resolveTenantServiceCatalogue(website.slug).services : []);
  const byCategory = analysis?.inventory?.byCategory;
  const total = analysis?.inventory?.totalPages ?? pages.length;
  const commercial = byCategory
    ? [...SERVICE_PAGE_TYPES].reduce((n, key) => n + (byCategory[key] || 0), 0)
    : countBy(pages, SERVICE_PAGE_TYPES);
  const blogs = byCategory
    ? [...BLOG_RESOURCE_TYPES].reduce((n, key) => n + (byCategory[key] || 0), 0)
    : countBy(pages, BLOG_RESOURCE_TYPES);
  const utility = byCategory
    ? [...UTILITY_TYPES].reduce((n, key) => n + (byCategory[key] || 0), 0)
    : countBy(pages, UTILITY_TYPES);
  const unknown = Math.max(0, total - commercial - blogs - utility);
  return {
    totalPages: total,
    commercialServicePages: commercial,
    blogResourcePages: blogs,
    aboutContactUtilityPages: utility,
    unknownOtherPages: unknown,
    pages: pages.slice(0, 40).map((page) => {
      const associated = associatedServiceForPage(page, services);
      return {
        url: page.url,
        title: page.title || page.h1 || page.path,
        type: groupedPageType(page.category),
        category: page.category,
        associatedService: associated.name,
        source: page.discoverySource || (website?.analysis ? "website-intelligence" : "website-import-snapshot"),
        sourceUrl: page.url || null,
        confidence: associated.name ? associated.confidence : page.discoverySource ? "medium" : "low",
      };
    }),
    origin: "IMPORTED",
    source,
  };
}

function overlapService(a: string, b: string): boolean {
  const tokens = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((t) => t && !["pharmacy", "pharmacies", "for", "the", "and", "uk"].includes(t));
  const left = tokens(a);
  const right = new Set(tokens(b));
  if (!left.length || !right.size) return false;
  return left.filter((t) => right.has(t)).length >= Math.min(2, left.length);
}

function projectCommercialServices(project: Record<string, unknown> | null): TenantServiceCatalogueEntry[] {
  if (!project) return [];
  const names = Array.isArray(project.services) ? project.services.map((v) => String(v || "").trim()).filter(Boolean) : [];
  const money =
    project.serviceMoneyPages && typeof project.serviceMoneyPages === "object"
      ? (project.serviceMoneyPages as Record<string, unknown>)
      : {};
  const moneyIds = Object.keys(money).filter(Boolean);
  const slugify = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (moneyIds.length) {
    return moneyIds.map((serviceId) => {
      const matchedName = names.find((name) => slugify(name) === serviceId || name.toLowerCase().includes(serviceId.replace(/-/g, " ").replace("pharmacy ", "")));
      const href = String(money[serviceId] || "").trim();
      return {
        serviceId,
        serviceName: matchedName || serviceId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        href: href || undefined,
      };
    });
  }
  return names.map((name) => ({ serviceId: slugify(name), serviceName: name }));
}

export function mergeCommercialServices(
  catalogue: TenantServiceCatalogueEntry[],
  website: GrowthEngineWebsiteIntelligenceSnapshot | null,
  profile: PharmacyProfileData | null,
): NationalBiServiceRow[] {
  const rows: NationalBiServiceRow[] = [];
  const seen = new Set<string>();
  const selected = new Set((profile?.selectedServices || []).map((v) => String(v).toLowerCase()));
  const coverage = website?.analysis?.coverage || [];
  const canonical = website?.analysis?.canonicalServices || [];

  for (const service of catalogue) {
    const cover = coverage.find(
      (row) => row.serviceId === service.serviceId || overlapService(row.serviceName, service.serviceName),
    );
    const detected = canonical.find(
      (row) => row.serviceId === service.serviceId || overlapService(row.serviceName, service.serviceName),
    );
    const sourceUrl = detected?.sourceUrl || cover?.mainPageUrl || service.href || null;
    const origin: EvidenceOrigin = detected?.sourceUrl || cover?.mainPageUrl ? "IMPORTED" : "CONFIGURED";
    const source = origin === "IMPORTED" ? "website-intelligence" : "project-commercial-catalogue";
    const active = selected.has(service.serviceId) || selected.has(service.serviceName.toLowerCase()) || Boolean(service.serviceId);
    rows.push({
      serviceName: service.serviceName,
      canonicalService: service.serviceName,
      serviceId: service.serviceId,
      source,
      sourceUrl,
      confidence: sourceUrl ? "high" : "medium",
      origin,
      status: active ? "ACTIVE" : "AVAILABLE",
    });
    seen.add(service.serviceId);
    seen.add(service.serviceName.toLowerCase());
  }

  for (const detected of canonical.filter((row) => row.customerVisible)) {
    if (seen.has(detected.serviceId) || [...seen].some((id) => overlapService(id, detected.serviceName))) continue;
    rows.push({
      serviceName: detected.serviceName,
      canonicalService: detected.serviceName,
      serviceId: detected.serviceId,
      source: "website-intelligence",
      sourceUrl: detected.sourceUrl || null,
      confidence: detected.confidence >= 70 ? "high" : "medium",
      origin: "IMPORTED",
      status: "DETECTED",
    });
    seen.add(detected.serviceId);
  }
  return rows;
}

export function assembleNationalBusinessIntelligence(sources: NationalBiSources): NationalBusinessIntelligenceView {
  const slug = safePharmacySlug(sources.slug);
  const project = sources.project;
  const profile = sources.profile;
  const website = sources.website;
  const importSnap = sources.importSnap;
  const intel = importSnap?.intelligence;
  const catalogue = isNationalGrowthPlatform(slug)
    ? resolveTenantServiceCatalogue(slug).services
    : projectCommercialServices(project);
  const services = mergeCommercialServices(
    sources.platform === "national" ? catalogue : [],
    website,
    profile,
  );

  const websiteUrl = firstPresent([
    { value: text(intel?.identity.resolvedUrl || intel?.identity.websiteUrl), source: "website-import", origin: "IMPORTED" },
    { value: text(website?.websiteUrl), source: "website-intelligence", origin: "IMPORTED" },
    { value: text(profile?.website), source: "business-profile", origin: "PROFILE" },
    { value: text(project?.domain), source: "project-config", origin: "CONFIGURED" },
  ]);
  const domainValue =
    hostFromConfiguredDomain(websiteUrl.value) ||
    hostFromConfiguredDomain(project?.domain) ||
    "";
  const domain = fact(
    domainValue,
    websiteUrl.origin === "IMPORTED" ? websiteUrl.source : "project-config",
    domainValue ? (websiteUrl.origin === "IMPORTED" ? "IMPORTED" : "CONFIGURED") : "NOT_FOUND",
    { sourceUrl: websiteUrl.value, confidence: domainValue ? "high" : "none" },
  );

  const identity = {
    businessName: firstPresent([
      { value: text(intel?.business.businessName.selected), source: "website-import", origin: "IMPORTED", sourceUrl: intel?.identity.resolvedUrl },
      { value: text(profile?.pharmacyName), source: "business-profile", origin: "PROFILE" },
      { value: text(project?.businessName), source: "project-config", origin: "CONFIGURED" },
    ]),
    domain,
    websiteUrl,
    description: firstPresent([
      { value: text(intel?.identity.metaDescription), source: "website-import", origin: "IMPORTED", sourceUrl: intel?.identity.resolvedUrl },
      { value: text(importSnap?.description), source: "website-import", origin: "IMPORTED" },
      { value: text(project?.description), source: "project-config", origin: "CONFIGURED" },
    ], "INSUFFICIENT_EVIDENCE"),
    businessType: firstPresent([
      { value: text(project?.businessType), source: "project-config", origin: "CONFIGURED" },
    ], "NOT_CONFIGURED"),
    legalName: firstPresent([
      { value: text(project?.legalName), source: "project-config", origin: "CONFIGURED" },
      { value: text(profile?.companyName), source: "business-profile", origin: "PROFILE" },
    ], "NOT_CONFIGURED"),
    phone: firstPresent([
      { value: text(intel?.business.phone.selected || importSnap?.phone), source: "website-import", origin: "IMPORTED" },
      { value: text(profile?.phone), source: "business-profile", origin: "PROFILE" },
      { value: text(project?.phone), source: "project-config", origin: "CONFIGURED" },
    ]),
    email: firstPresent([
      { value: text(intel?.business.email.selected || importSnap?.email), source: "website-import", origin: "IMPORTED" },
      { value: text(profile?.email), source: "business-profile", origin: "PROFILE" },
      { value: text(project?.email), source: "project-config", origin: "CONFIGURED" },
    ]),
    proposition: firstPresent([
      { value: text(project?.strapline), source: "project-config", origin: "CONFIGURED" },
      { value: text(project?.description), source: "project-config", origin: "CONFIGURED" },
      { value: text(intel?.identity.metaDescription), source: "website-import", origin: "IMPORTED" },
    ], "INSUFFICIENT_EVIDENCE"),
    cta: firstPresent([
      {
        value: [text(project?.primaryCtaText), text(project?.primaryCtaUrl)].filter(Boolean).join(" — "),
        source: "project-config",
        origin: "CONFIGURED",
        sourceUrl: text(project?.primaryCtaUrl) || null,
      },
    ], "NOT_CONFIGURED"),
    logoUrl: firstPresent([
      { value: text(intel?.identity.logoUrl || importSnap?.logoUrl), source: "website-import", origin: "IMPORTED" },
      { value: text(profile?.logoUrl), source: "business-profile", origin: "PROFILE" },
      { value: text(project?.logoUrl), source: "project-config", origin: "CONFIGURED", sourceUrl: text(project?.logoUrl) || null },
    ]),
  };

  const audienceFromImport = intel?.audienceEvidence?.[0];
  const targetCustomer = firstPresent([
    {
      value: text(audienceFromImport?.value),
      source: "website-import-audience",
      origin: "IMPORTED",
      sourceUrl: audienceFromImport?.sourceUrl || audienceFromImport?.evidence?.sourceUrl || null,
    },
    { value: text(project?.strapline), source: "project-config", origin: "CONFIGURED" },
    { value: text(project?.description), source: "project-config", origin: "CONFIGURED" },
    { value: text(importSnap?.description), source: "website-import", origin: "IMPORTED" },
  ], "INSUFFICIENT_EVIDENCE");

  const marketScopeValue = sources.platform === "national" ? "national" : resolveMarketScope(slug, profile);
  const marketScope = fact(
    marketScopeLabel(marketScopeValue === "national" ? "national" : resolveMarketScope(slug, profile)),
    sources.platform === "national" ? "growth-platform-resolver" : "market-scope-resolver",
    "CONFIGURED",
    { confidence: "high" },
  );
  const marketCountry = firstPresent([
    { value: text(project?.country), source: "project-config", origin: "CONFIGURED" },
    { value: resolvePrimaryMarket(slug, profile), source: "primary-market-resolver", origin: "CONFIGURED" },
    { value: text(project?.primaryLocation), source: "project-config", origin: "CONFIGURED" },
    { value: text(profile?.country), source: "business-profile", origin: "PROFILE" },
  ], "NOT_CONFIGURED");
  const geoBits = [
    text(project?.primaryLocation),
    Array.isArray(project?.serviceAreas) ? (project?.serviceAreas as unknown[]).map(text).filter(Boolean).join(", ") : "",
  ].filter(Boolean);
  const geography = fact(
    geoBits.join(" · "),
    "project-config",
    geoBits.length ? "CONFIGURED" : "NOT_CONFIGURED",
  );

  const inventory = summariseWebsiteInventory(website, importSnap, catalogue);

  const identityComplete =
    Boolean(identity.businessName.value) && Boolean(identity.domain.value || identity.websiteUrl.value);
  const servicesComplete = services.length > 0;
  const targetComplete = Boolean(targetCustomer.value);
  const marketComplete = Boolean(marketCountry.value) && Boolean(marketScope.value);
  const inventoryComplete = inventory.origin === "IMPORTED" && (inventory.totalPages || 0) > 0;

  const missingRequired: string[] = [];
  if (!identity.businessName.value) missingRequired.push("Business name");
  if (!identity.domain.value && !identity.websiteUrl.value) missingRequired.push("Domain / website URL");
  if (!servicesComplete) missingRequired.push("At least one commercial service");
  if (!targetCustomer.value) missingRequired.push("Target customer / business proposition");
  if (!marketCountry.value) missingRequired.push("Country / market");
  if (!inventoryComplete) {
    missingRequired.push(
      inventory.origin === "INSUFFICIENT_EVIDENCE"
        ? "Website inventory (import attempted, no pages discovered)"
        : inventory.origin === "NOT_CONFIGURED"
          ? "Website inventory (no website URL configured)"
          : "Website inventory",
    );
  }

  const completeness = {
    identity: identityComplete ? "COMPLETE" : identity.businessName.value || identity.domain.value ? "PARTIAL" : "MISSING",
    services: servicesComplete ? "COMPLETE" : "MISSING",
    targetCustomer: targetComplete ? "COMPLETE" : "MISSING",
    market: marketComplete ? "COMPLETE" : marketCountry.value || marketScope.value ? "PARTIAL" : "MISSING",
    websiteInventory: inventoryComplete ? "COMPLETE" : "MISSING",
  } as const;

  return {
    slug,
    platform: sources.platform,
    identity,
    services,
    targetCustomer,
    marketCountry,
    marketScope,
    geography,
    inventory,
    completeness,
    readyForCompetitorDiscovery: missingRequired.length === 0,
    missingRequired,
    sparseBusiness: !inventoryComplete || !identity.phone.value || services.length <= 2,
  };
}

export interface CommercialDiscoveryBusinessIntelligenceSubject {
  tenantSlug: string;
  businessName: string;
  domain: string;
  websiteUrl: string;
  businessType: string;
  targetCustomerMarket: string;
  country: string;
  marketScope: string;
  commercialServices: string[];
  websiteInventoryStatus: CompletenessStatus;
  readyForCompetitorDiscovery: boolean;
  proposition: string;
  missingRequired: string[];
  provenance: {
    businessName: ProvenancedFact;
    domain: ProvenancedFact;
    targetCustomer: ProvenancedFact;
    country: ProvenancedFact;
    marketScope: ProvenancedFact;
    servicesSource: string;
  };
}

export function commercialDiscoverySubjectFromBusinessIntelligence(
  view: NationalBusinessIntelligenceView,
): CommercialDiscoveryBusinessIntelligenceSubject {
  const servicesSource = view.services[0]?.source || "none";
  return {
    tenantSlug: view.slug,
    businessName: view.identity.businessName.value || "",
    domain: view.identity.domain.value || "",
    websiteUrl: view.identity.websiteUrl.value || "",
    businessType: view.identity.businessType.value || "",
    targetCustomerMarket: view.targetCustomer.value || "",
    country: view.marketCountry.value || "",
    marketScope: view.marketScope.value || "",
    commercialServices: view.services.map((row) => row.serviceName),
    websiteInventoryStatus: view.completeness.websiteInventory,
    readyForCompetitorDiscovery: view.readyForCompetitorDiscovery,
    proposition: view.identity.proposition.value || view.targetCustomer.value || "",
    missingRequired: [...view.missingRequired],
    provenance: {
      businessName: view.identity.businessName,
      domain: view.identity.domain,
      targetCustomer: view.targetCustomer,
      country: view.marketCountry,
      marketScope: view.marketScope,
      servicesSource,
    },
  };
}

export function buildCommercialDiscoveryBusinessIntelligenceSubject(
  slug: string,
): CommercialDiscoveryBusinessIntelligenceSubject {
  return commercialDiscoverySubjectFromBusinessIntelligence(buildNationalBusinessIntelligenceView(slug));
}

export function collectNationalBiSources(slug: string): NationalBiSources {
  const safe = safePharmacySlug(slug);
  const platform = resolveGrowthPlatform(safe).platform;
  const profile = loadProfileIfPresent(safe);
  return {
    slug: safe,
    project: readProjectConfig(safe),
    profile,
    website: resolveWebsiteIntelligenceSnapshot(safe),
    importSnap: profile?.websiteImportSnapshot || null,
    platform,
  };
}

export function buildNationalBusinessIntelligenceView(slug: string): NationalBusinessIntelligenceView {
  return assembleNationalBusinessIntelligence(collectNationalBiSources(slug));
}
