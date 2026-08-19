/**
 * Checkpoint 02 — Generic commercial competitor discovery.
 *
 * Reuses:
 * - Checkpoint 01 Business Intelligence as the discovery input
 * - NC-02 query builder (service/market/country derived)
 * - DataForSEO Google Organic SERP as DISCOVERY EVIDENCE only
 * - nationalSearchCommercialCompetitorGate as COMMERCIAL QUALIFICATION
 *
 * Organic overlap may nominate a candidate. It cannot pass the gate.
 * Does not call ranked-keyword expansion, Places, GSC, or indexing.
 */
import { buildNationalBusinessIntelligenceView } from "./growthEngineNationalBusinessIntelligenceService.ts";
import {
  assessNationalSearchCommercialCompetitor,
  type NationalSearchCommercialGateResult,
} from "./nationalSearchCommercialCompetitorGate.ts";
import {
  buildNationalCompetitorDiscoveryQueries,
} from "./nationalCompetitorDiscoveryQueryService.ts";
import {
  COMMERCIAL_DISCOVERY_CANDIDATE_LIMIT,
  COMMERCIAL_DISCOVERY_SERP_DEPTH,
  emptyNationalCompetitorDiscoveryResult,
  type NationalCompetitorDiscoveryCandidate,
  type NationalCompetitorDiscoveryResult,
  type NationalCompetitorDiscoverySource,
} from "./nationalCompetitorDiscoveryModel.ts";
import {
  readNationalCompetitorDiscovery,
  writeNationalCompetitorDiscovery,
} from "./nationalCompetitorDiscoveryStorageService.ts";
import { searchNationalGoogleOrganic } from "./dataForSeoNationalSearchAdapter.ts";
import { fetchWebsiteHtml } from "./growthEngineWebsiteCrawler.ts";
import { readNationalSearchIntelligence } from "./nationalSearchIntelligenceV1Service.ts";
import { isNationalGrowthPlatform } from "./growthPlatformResolverService.ts";
import { safePharmacySlug } from "./pharmacyWorkspacePaths.ts";
import type { NationalSearchRequest, NationalSearchResponse } from "./nationalSearchProviderModel.ts";
import type { NationalIntelligenceSubject } from "./nationalIntelligenceSubjectResolver.ts";

export const COMMERCIAL_DISCOVERY_RANKED_KEYWORD_REQUESTS = 0;

export type CommercialDiscoverySearchFn = (request: NationalSearchRequest) => Promise<NationalSearchResponse>;
export type CommercialDiscoveryWebsiteFn = (url: string) => Promise<string>;

export type InjectedCommercialCandidate = {
  domain: string;
  name?: string;
  title?: string;
  websiteText?: string;
  url?: string;
  discoverySource?: NationalCompetitorDiscoverySource | string;
  discoveryEvidence?: string;
  sharedKeywordCount?: number | null;
};

export type CommercialCompetitorDiscoveryPlan = {
  slug: string;
  businessName: string;
  domain: string;
  businessType: string;
  targetCustomerMarket: string;
  country: string;
  marketScope: string;
  commercialServices: string[];
  queries: string[];
  maxCandidates: number;
  maxQueries: number;
  serpDepth: number;
  rankedKeywordRequests: number;
  discoverySources: string[];
  qualificationGate: "nationalSearchCommercialCompetitorGate";
  serviceOverlap: "nationalCommercialServiceOverlap";
  organicOverlapIsCommercialProof: false;
  sparseOrganicFootprintDoesNotBlockDiscovery: true;
};

export type CommercialDiscoveryRunOptions = {
  slug: string;
  live?: boolean;
  persist?: boolean;
  injectedCandidates?: InjectedCommercialCandidate[];
  search?: CommercialDiscoverySearchFn;
  fetchWebsiteText?: CommercialDiscoveryWebsiteFn;
};

const INFRA_DOMAIN_RE = [
  /(^|\.)google\.(com|co\.\w{2}|com?\.\w{2})$/i,
  /(^|\.)bing\.com$/i,
  /(^|\.)yahoo\.com$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)linkedin\.com$/i,
  /(^|\.)youtube\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)wikipedia\.org$/i,
  /(^|\.)gov\.uk$/i,
  /(^|\.)nhs\.uk$/i,
];

function cleanDomain(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function htmlToText(html: string): string {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

function businessNameFromTitle(title: string, domain: string): string {
  const cleaned = String(title || "").split(/\s+[|\-–—]\s+/)[0].trim();
  if (cleaned && cleaned.length >= 2 && cleaned.length <= 100) return cleaned;
  return cleanDomain(domain)
    .split(".")[0]
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function mapQualification(gate: NationalSearchCommercialGateResult): NationalCompetitorDiscoveryCandidate["qualification"] {
  if (gate.qualification === "qualified" && gate.role === "commercial_competitor") return "qualified";
  if (gate.qualification === "rejected") return "rejected";
  return "candidate";
}

export function buildCommercialCompetitorDiscoveryContext(slug: string) {
  const safe = safePharmacySlug(slug);
  const bi = buildNationalBusinessIntelligenceView(safe);
  let search: ReturnType<typeof readNationalSearchIntelligence> | null = null;
  try {
    search = readNationalSearchIntelligence(safe);
  } catch {
    search = null;
  }
  const keywordCount = search?.customerOrganicFootprint?.keywordCount ?? search?.summary?.rankingKeywordCount ?? 0;
  const sparse = Boolean(search?.customerOrganicFootprint?.sparse) || keywordCount < (search?.customerOrganicFootprint?.threshold || 10);
  return {
    slug: safe,
    bi,
    businessName: bi.identity.businessName.value || safe,
    domain: bi.identity.domain.value || "",
    websiteUrl: bi.identity.websiteUrl.value || "",
    businessType: bi.identity.businessType.value || "",
    targetCustomerMarket: bi.targetCustomer.value || "",
    country: bi.marketCountry.value || "United Kingdom",
    marketScope: bi.marketScope.value || "",
    proposition: bi.identity.proposition.value || bi.targetCustomer.value || "",
    services: bi.services.map((row) => row.serviceName),
    commercialPages: bi.inventory.pages.filter((page) => page.type === "commercial/service"),
    ready: bi.readyForCompetitorDiscovery,
    missingRequired: bi.missingRequired,
    sparseOrganicFootprint: sparse,
    organicOverlapCandidates: (search?.organicCompetitors || []).map((row) => ({
      domain: row.domain,
      name: row.name,
      title: row.name,
      websiteText: "",
      url: row.url || `https://${row.domain}`,
      discoverySource: "organic-overlap" as const,
      discoveryEvidence: `Organic/SERP overlap evidence only (sharedKeywordCount=${row.sharedKeywordCount ?? "n/a"}). Not commercial proof.`,
      sharedKeywordCount: row.sharedKeywordCount ?? 0,
    })),
  };
}

export function buildCommercialCompetitorDiscoveryPlan(slug: string): CommercialCompetitorDiscoveryPlan {
  const ctx = buildCommercialCompetitorDiscoveryContext(slug);
  const queries = buildNationalCompetitorDiscoveryQueries({
    businessName: ctx.businessName,
    marketCountry: ctx.country,
    targetCustomerMarket: ctx.targetCustomerMarket,
    services: ctx.services,
    businessType: ctx.businessType,
    proposition: ctx.proposition,
  });
  return {
    slug: ctx.slug,
    businessName: ctx.businessName,
    domain: ctx.domain,
    businessType: ctx.businessType,
    targetCustomerMarket: ctx.targetCustomerMarket,
    country: ctx.country,
    marketScope: ctx.marketScope,
    commercialServices: ctx.services,
    queries: queries.map((row) => row.query),
    maxCandidates: COMMERCIAL_DISCOVERY_CANDIDATE_LIMIT,
    maxQueries: queries.length,
    serpDepth: COMMERCIAL_DISCOVERY_SERP_DEPTH,
    rankedKeywordRequests: COMMERCIAL_DISCOVERY_RANKED_KEYWORD_REQUESTS,
    discoverySources: ["business-intelligence", "configured-service-serp", "organic-overlap-optional"],
    qualificationGate: "nationalSearchCommercialCompetitorGate",
    serviceOverlap: "nationalCommercialServiceOverlap",
    organicOverlapIsCommercialProof: false,
    sparseOrganicFootprintDoesNotBlockDiscovery: true,
  };
}

function toSubject(ctx: ReturnType<typeof buildCommercialCompetitorDiscoveryContext>): NationalSearchCommercialGateInputSubject {
  return {
    subjectDomain: ctx.domain,
    primaryMarket: ctx.targetCustomerMarket || ctx.country,
    country: ctx.country,
    commercialServices: ctx.services.map((serviceName) => ({
      serviceId: serviceName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      serviceName,
    })),
  };
}

type NationalSearchCommercialGateInputSubject = Pick<
  NationalIntelligenceSubject,
  "subjectDomain" | "primaryMarket" | "country" | "commercialServices"
>;

export function qualifyInjectedCommercialCandidates(
  slug: string,
  injected: InjectedCommercialCandidate[],
): NationalCompetitorDiscoveryResult {
  const ctx = buildCommercialCompetitorDiscoveryContext(slug);
  return assembleCommercialCompetitorDiscovery(ctx, injected.slice(0, COMMERCIAL_DISCOVERY_CANDIDATE_LIMIT));
}

export function assembleCommercialCompetitorDiscovery(
  ctx: ReturnType<typeof buildCommercialCompetitorDiscoveryContext>,
  rawCandidates: InjectedCommercialCandidate[],
): NationalCompetitorDiscoveryResult {
  const plan = buildCommercialCompetitorDiscoveryPlan(ctx.slug);
  const result = emptyNationalCompetitorDiscoveryResult(ctx.slug, ctx.country, ctx.targetCustomerMarket);
  result.businessName = ctx.businessName;
  result.domain = ctx.domain;
  result.businessType = ctx.businessType;
  result.marketScope = ctx.marketScope;
  result.commercialServices = ctx.services;
  result.collectionPlan = plan;
  result.rankedKeywordRequests = 0;
  result.sparseOrganicFootprint = ctx.sparseOrganicFootprint;
  result.queries = buildNationalCompetitorDiscoveryQueries({
    businessName: ctx.businessName,
    marketCountry: ctx.country,
    targetCustomerMarket: ctx.targetCustomerMarket,
    services: ctx.services,
    businessType: ctx.businessType,
    proposition: ctx.proposition,
  });

  const ownDomains = [ctx.domain].filter(Boolean);
  const subject = toSubject(ctx);
  const seen = new Set<string>();
  const mapped: NationalCompetitorDiscoveryCandidate[] = [];

  for (const raw of rawCandidates.slice(0, COMMERCIAL_DISCOVERY_CANDIDATE_LIMIT)) {
    const domain = cleanDomain(raw.domain);
    if (!domain || seen.has(domain)) continue;
    if (ownDomains.includes(domain)) continue;
    if (INFRA_DOMAIN_RE.some((pattern) => pattern.test(domain))) continue;
    seen.add(domain);

    const title = raw.title || raw.name || domain;
    const websiteText = String(raw.websiteText || title);
    const gate = assessNationalSearchCommercialCompetitor({
      domain,
      title,
      websiteText,
      url: raw.url || `https://${domain}`,
      sharedKeywordCount: raw.sharedKeywordCount ?? null,
      subject,
      ownDomains,
      sparseCustomerFootprint: ctx.sparseOrganicFootprint,
    });
    const source = (raw.discoverySource || "search-engine") as NationalCompetitorDiscoverySource;
    const candidate: NationalCompetitorDiscoveryCandidate = {
      id: `national-${domain.replace(/[^a-z0-9]+/g, "-")}`,
      name: raw.name || businessNameFromTitle(title, domain),
      domain,
      websiteUrl: raw.url || `https://${domain}`,
      marketCountry: ctx.country,
      targetCustomerMarket: ctx.targetCustomerMarket,
      source,
      sourceQuery: raw.discoveryEvidence || null,
      qualification: mapQualification(gate),
      qualificationReasons: gate.reasons,
      rejectionReasons: gate.exclusionReasons,
      serviceEvidence: gate.overlappingServices.map((service) => ({
        service,
        evidenceUrl: raw.url || `https://${domain}`,
        evidenceText: `Material overlap with configured tenant service ${service}.`,
        confidence: gate.serviceOverlap ? 80 : 20,
      })),
      title,
      description: raw.discoveryEvidence || null,
      evidenceUrls: [raw.url || `https://${domain}`],
      capturedAt: new Date().toISOString(),
      role: gate.role,
      commercialProvider: gate.commercialProvider,
      targetMarketRelevance: gate.targetMarketRelevance,
      marketRelevance: gate.marketRelevance,
      serviceOverlap: gate.serviceOverlap,
      detectedServices: gate.candidateServicesDetected,
      overlappingServices: gate.overlappingServices,
      nonOverlappingServices: gate.nonOverlappingServices,
      discoveryEvidence: raw.discoveryEvidence || `Discovered via ${source}.`,
      qualificationReason: gate.qualification === "qualified" && gate.role === "commercial_competitor"
        ? unique([
          "Direct commercial competitor: same target customer market, commercial provider, material configured-service overlap, and market relevance.",
          ...gate.reasons.filter((reason) => /overlap|commercial provider|target-market|market evidence/i.test(reason)),
        ]).join(" ")
        : (gate.nonSelectionReason || gate.reasons[0] || "Commercial gate assessed from website and discovery evidence."),
    };
    mapped.push(candidate);
  }

  result.candidates = mapped;
  result.qualifiedCompetitors = mapped.filter((row) => row.qualification === "qualified");
  result.rejectedCandidates = mapped.filter((row) => row.qualification !== "qualified");
  result.directCommercialCompetitors = mapped.filter((row) => row.role === "commercial_competitor" && row.qualification === "qualified").length;
  result.adjacentCommercialProviders = mapped.filter((row) => row.role === "adjacent_commercial_provider").length;
  result.generatedAt = new Date().toISOString();
  result.status = "complete";
  const limitations: string[] = [];
  if (ctx.sparseOrganicFootprint) {
    limitations.push("Customer organic footprint is sparse. Discovery used Business Intelligence services/market, not ranking overlap as the only source.");
  }
  if (!result.directCommercialCompetitors) {
    limitations.push("0 direct commercial competitors qualified from current evidence. Organic overlap alone is not commercial proof.");
  }
  if (!mapped.length) {
    limitations.push("No candidate domains were discovered from the bounded service/market queries.");
  }
  result.evidenceLimitations = limitations;
  return result;
}

export async function runCommercialCompetitorDiscovery(
  options: CommercialDiscoveryRunOptions,
): Promise<NationalCompetitorDiscoveryResult> {
  const ctx = buildCommercialCompetitorDiscoveryContext(options.slug);
  const plan = buildCommercialCompetitorDiscoveryPlan(ctx.slug);
  console.log("COMMERCIAL_COMPETITOR_DISCOVERY_PLAN " + JSON.stringify(plan, null, 2));
  console.log(`COMPETITOR_RANKED_KEYWORD_REQUESTS=${COMMERCIAL_DISCOVERY_RANKED_KEYWORD_REQUESTS}`);

  if (!isNationalGrowthPlatform(ctx.slug)) {
    const blocked = emptyNationalCompetitorDiscoveryResult(ctx.slug, ctx.country, ctx.targetCustomerMarket);
    blocked.status = "failed";
    blocked.errors.push("Commercial competitor discovery is for the National Growth Platform only.");
    blocked.collectionPlan = plan;
    return blocked;
  }

  if (!ctx.ready) {
    const blocked = emptyNationalCompetitorDiscoveryResult(ctx.slug, ctx.country, ctx.targetCustomerMarket);
    blocked.status = "insufficient-evidence";
    blocked.errors.push(`Checkpoint 01 Business Intelligence is not ready: ${ctx.missingRequired.join(", ") || "missing required evidence"}.`);
    blocked.collectionPlan = plan;
    blocked.evidenceLimitations = blocked.errors;
    blocked.businessName = ctx.businessName;
    blocked.commercialServices = ctx.services;
    if (options.persist !== false) writeNationalCompetitorDiscovery(blocked);
    return blocked;
  }

  let injected = [...(options.injectedCandidates || [])];

  if (options.live) {
    const search = options.search || searchNationalGoogleOrganic;
    const queries = buildNationalCompetitorDiscoveryQueries({
      businessName: ctx.businessName,
      marketCountry: ctx.country,
      targetCustomerMarket: ctx.targetCustomerMarket,
      services: ctx.services,
      businessType: ctx.businessType,
      proposition: ctx.proposition,
    });
    const byDomain = new Map<string, InjectedCommercialCandidate>();
    for (const query of queries) {
      const serp = await search({
        query: query.query,
        marketCountry: query.marketCountry,
        languageCode: "en",
        depth: COMMERCIAL_DISCOVERY_SERP_DEPTH,
      });
      for (const row of serp.results || []) {
        const domain = cleanDomain(row.domain);
        if (!domain || byDomain.has(domain)) continue;
        byDomain.set(domain, {
          domain,
          name: businessNameFromTitle(row.title, domain),
          title: row.title,
          websiteText: [row.title, row.description].filter(Boolean).join(" "),
          url: row.url || `https://${domain}`,
          discoverySource: "search-engine",
          discoveryEvidence: `Google UK organic SERP for query "${query.query}" (discovery evidence, not commercial qualification).`,
        });
      }
    }
    injected = [...byDomain.values(), ...injected];
  }

  for (const organic of ctx.organicOverlapCandidates) {
    if (injected.length >= COMMERCIAL_DISCOVERY_CANDIDATE_LIMIT) break;
    if (injected.some((row) => cleanDomain(row.domain) === cleanDomain(organic.domain))) continue;
    injected.push(organic);
  }

  injected = injected.slice(0, COMMERCIAL_DISCOVERY_CANDIDATE_LIMIT);

  const fetchText = options.fetchWebsiteText || (async (url: string) => htmlToText(await fetchWebsiteHtml(url)));
  if (options.live || options.fetchWebsiteText) {
    for (const candidate of injected) {
      if (candidate.websiteText && candidate.websiteText.length > 120) continue;
      const url = candidate.url || `https://${cleanDomain(candidate.domain)}`;
      try {
        const text = await fetchText(url);
        if (text) candidate.websiteText = [candidate.websiteText, text].filter(Boolean).join(" ").slice(0, 8000);
      } catch {
        /* homepage evidence is optional; qualification stays unknown rather than fabricated */
      }
    }
  }

  const result = assembleCommercialCompetitorDiscovery(ctx, injected);
  result.collectionPlan = plan;
  if (options.persist !== false) writeNationalCompetitorDiscovery(result);
  return result;
}

export function readCommercialCompetitorDiscovery(slug: string): NationalCompetitorDiscoveryResult | null {
  return readNationalCompetitorDiscovery(safePharmacySlug(slug));
}
