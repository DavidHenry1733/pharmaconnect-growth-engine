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
import {
  buildNationalBusinessIntelligenceView,
  commercialDiscoverySubjectFromBusinessIntelligence,
  type CommercialDiscoveryBusinessIntelligenceSubject,
} from "./growthEngineNationalBusinessIntelligenceService.ts";
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
  type CommercialDiscoveryEvidenceKind,
  type NationalCompetitorDiscoveryCandidate,
  type NationalCompetitorDiscoveryResult,
  type NationalCompetitorDiscoverySource,
} from "./nationalCompetitorDiscoveryModel.ts";
import {
  isExampleTldDomain,
  readFixtureCommercialCompetitorDiscovery,
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
  snippet?: string;
  websiteText?: string;
  url?: string;
  discoverySource?: NationalCompetitorDiscoverySource | string;
  discoveryEvidence?: string;
  sharedKeywordCount?: number | null;
};

export type CommercialCompetitorDiscoveryPlan = {
  slug: string;
  tenantSlug: string;
  businessName: string;
  domain: string;
  businessType: string;
  targetCustomerMarket: string;
  country: string;
  marketScope: string;
  commercialServices: string[];
  websiteInventoryStatus: string;
  readyForCompetitorDiscovery: boolean;
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
  provenance: CommercialDiscoveryBusinessIntelligenceSubject["provenance"];
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

function isTenantQueryEvidenceSentence(text: string): boolean {
  return /discovery evidence, not commercial/i.test(text)
    || /google organic serp for query/i.test(text)
    || /organic\/serp overlap evidence only/i.test(text);
}

export function websiteTextFromPersistedCandidate(
  candidate: Pick<NationalCompetitorDiscoveryCandidate, "title" | "name" | "description" | "websiteText">,
): string {
  const stored = String(candidate.websiteText || "").trim();
  if (stored && !isTenantQueryEvidenceSentence(stored)) return stored.slice(0, 8000);
  const description = String(candidate.description || "").trim();
  const parts = [candidate.title, candidate.name];
  if (description && !isTenantQueryEvidenceSentence(description)) parts.push(description);
  return unique(parts).join(" ").slice(0, 8000);
}

export function commercialDiscoverySummary(result: NationalCompetitorDiscoveryResult) {
  const unclassified = result.candidates.filter((row) => !row.role).length;
  const direct = result.candidates.filter((row) => row.role === "commercial_competitor" && row.qualification === "qualified").length;
  const adjacent = result.candidates.filter((row) => row.role === "adjacent_commercial_provider").length;
  const rejected = Math.max(0, result.candidates.length - direct - adjacent - unclassified);
  return {
    status: result.status,
    total: result.candidates.length,
    direct,
    adjacent,
    rejected,
    unclassified,
    rankedKeywordRequests: result.rankedKeywordRequests ?? 0,
  };
}

function applyCommercialDiscoveryCounts(result: NationalCompetitorDiscoveryResult): NationalCompetitorDiscoveryResult {
  const summary = commercialDiscoverySummary(result);
  result.directCommercialCompetitors = summary.direct;
  result.adjacentCommercialProviders = summary.adjacent;
  result.unclassifiedCandidates = summary.unclassified;
  result.qualifiedCompetitors = result.candidates.filter((row) => row.qualification === "qualified");
  result.rejectedCandidates = result.candidates.filter((row) => row.qualification !== "qualified");
  return result;
}

function mapQualification(gate: NationalSearchCommercialGateResult): NationalCompetitorDiscoveryCandidate["qualification"] {
  if (gate.qualification === "qualified" && gate.role === "commercial_competitor") return "qualified";
  if (gate.qualification === "rejected") return "rejected";
  return "candidate";
}

export function buildCommercialCompetitorDiscoveryContext(slug: string) {
  const safe = safePharmacySlug(slug);
  const subject = commercialDiscoverySubjectFromBusinessIntelligence(buildNationalBusinessIntelligenceView(safe));
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
    subject,
    businessName: subject.businessName,
    domain: subject.domain,
    websiteUrl: subject.websiteUrl,
    businessType: subject.businessType,
    targetCustomerMarket: subject.targetCustomerMarket,
    country: subject.country,
    marketScope: subject.marketScope,
    proposition: subject.proposition,
    services: subject.commercialServices,
    websiteInventoryStatus: subject.websiteInventoryStatus,
    ready: subject.readyForCompetitorDiscovery,
    missingRequired: subject.missingRequired,
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

function discoveryQueriesFromSubject(subject: CommercialDiscoveryBusinessIntelligenceSubject) {
  return buildNationalCompetitorDiscoveryQueries({
    businessName: subject.businessName,
    marketCountry: subject.country,
    targetCustomerMarket: subject.targetCustomerMarket,
    services: subject.commercialServices,
    businessType: subject.businessType,
    proposition: subject.proposition,
  });
}

export function buildCommercialCompetitorDiscoveryPlan(slug: string): CommercialCompetitorDiscoveryPlan {
  const ctx = buildCommercialCompetitorDiscoveryContext(slug);
  const queries = discoveryQueriesFromSubject(ctx.subject);
  return {
    slug: ctx.slug,
    tenantSlug: ctx.subject.tenantSlug,
    businessName: ctx.subject.businessName,
    domain: ctx.subject.domain,
    businessType: ctx.subject.businessType,
    targetCustomerMarket: ctx.subject.targetCustomerMarket,
    country: ctx.subject.country,
    marketScope: ctx.subject.marketScope,
    commercialServices: ctx.subject.commercialServices,
    websiteInventoryStatus: ctx.subject.websiteInventoryStatus,
    readyForCompetitorDiscovery: ctx.subject.readyForCompetitorDiscovery,
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
    provenance: ctx.subject.provenance,
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
  const result = assembleCommercialCompetitorDiscovery(ctx, injected.slice(0, COMMERCIAL_DISCOVERY_CANDIDATE_LIMIT));
  result.evidenceKind = "FIXTURE_VALIDATION";
  result.discoveryProvider = "fixture";
  result.serpRequestCount = 0;
  result.serpCost = 0;
  return result;
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
  result.websiteInventoryStatus = ctx.websiteInventoryStatus;
  result.readyForCompetitorDiscovery = ctx.ready;
  result.queries = discoveryQueriesFromSubject(ctx.subject);

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
    const websiteText = String(raw.websiteText || raw.snippet || title);
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
      description: raw.snippet || null,
      websiteText,
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
  applyCommercialDiscoveryCounts(result);
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
  const isRealDiscovery = Boolean(options.live) && !options.search && !(options.injectedCandidates || []).length;
  const evidenceKind: CommercialDiscoveryEvidenceKind = isRealDiscovery ? "REAL_DISCOVERY" : "FIXTURE_VALIDATION";
  console.log("COMMERCIAL_COMPETITOR_DISCOVERY_PLAN " + JSON.stringify(plan, null, 2));
  console.log(`EVIDENCE_KIND=${evidenceKind}`);
  console.log(`COMPETITOR_RANKED_KEYWORD_REQUESTS=${COMMERCIAL_DISCOVERY_RANKED_KEYWORD_REQUESTS}`);

  const stamp = (result: NationalCompetitorDiscoveryResult): NationalCompetitorDiscoveryResult => {
    result.evidenceKind = evidenceKind;
    result.discoveryProvider = isRealDiscovery ? "dataforseo-google-organic-serp" : (options.search ? "fixture" : "injected");
    result.rankedKeywordRequests = 0;
    result.websiteInventoryStatus = ctx.websiteInventoryStatus;
    result.readyForCompetitorDiscovery = ctx.ready;
    result.collectionPlan = plan;
    return result;
  };

  if (!isNationalGrowthPlatform(ctx.slug)) {
    const blocked = stamp(emptyNationalCompetitorDiscoveryResult(ctx.slug, ctx.country, ctx.targetCustomerMarket));
    blocked.status = "failed";
    blocked.errors.push("Commercial competitor discovery is for the National Growth Platform only.");
    return blocked;
  }

  if (!ctx.ready) {
    const blocked = stamp(emptyNationalCompetitorDiscoveryResult(ctx.slug, ctx.country, ctx.targetCustomerMarket));
    blocked.status = "insufficient-evidence";
    blocked.errors.push(`Checkpoint 01 Business Intelligence is not ready: ${ctx.missingRequired.join(", ") || "missing required evidence"}.`);
    blocked.evidenceLimitations = blocked.errors;
    blocked.businessName = ctx.businessName;
    blocked.commercialServices = ctx.services;
    if (options.persist !== false) writeNationalCompetitorDiscovery(blocked);
    return blocked;
  }

  let injected = [...(options.injectedCandidates || [])];
  let serpRequestCount = 0;
  let serpCost = 0;

  if (options.live) {
    const search = options.search || searchNationalGoogleOrganic;
    const queries = discoveryQueriesFromSubject(ctx.subject);
    const byDomain = new Map<string, InjectedCommercialCandidate>();
    for (const query of queries) {
      const serp = await search({
        query: query.query,
        marketCountry: query.marketCountry,
        languageCode: "en",
        depth: COMMERCIAL_DISCOVERY_SERP_DEPTH,
      });
      serpRequestCount += 1;
      serpCost += Number(serp.cost || 0);
      for (const row of serp.results || []) {
        const domain = cleanDomain(row.domain);
        if (!domain || byDomain.has(domain)) continue;
        if (isRealDiscovery && isExampleTldDomain(domain)) continue;
        byDomain.set(domain, {
          domain,
          name: businessNameFromTitle(row.title, domain),
          title: row.title,
          snippet: row.description,
          websiteText: [row.title, row.description].filter(Boolean).join(" "),
          url: row.url || `https://${domain}`,
          discoverySource: "search-engine",
          discoveryEvidence: `Google organic SERP for query "${query.query}" (discovery evidence, not commercial qualification).`,
        });
      }
    }
    injected = [...byDomain.values(), ...injected];
  }

  if (isRealDiscovery) {
    for (const organic of ctx.organicOverlapCandidates) {
      if (injected.length >= COMMERCIAL_DISCOVERY_CANDIDATE_LIMIT) break;
      if (isExampleTldDomain(organic.domain)) continue;
      if (injected.some((row) => cleanDomain(row.domain) === cleanDomain(organic.domain))) continue;
      injected.push(organic);
    }
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

  const result = stamp(assembleCommercialCompetitorDiscovery(ctx, injected));
  result.serpRequestCount = serpRequestCount;
  result.serpCost = serpCost;
  if (isRealDiscovery) {
    result.candidates = result.candidates.filter((row) => !isExampleTldDomain(row.domain));
    applyCommercialDiscoveryCounts(result);
  }
  if (options.persist !== false) writeNationalCompetitorDiscovery(result);
  return result;
}

export function persistedCandidateToInjected(
  candidate: NationalCompetitorDiscoveryCandidate,
): InjectedCommercialCandidate {
  return {
    domain: candidate.domain,
    name: candidate.name,
    title: candidate.title || candidate.name,
    snippet: candidate.description && !isTenantQueryEvidenceSentence(candidate.description)
      ? candidate.description
      : undefined,
    websiteText: websiteTextFromPersistedCandidate(candidate),
    url: candidate.websiteUrl,
    discoverySource: candidate.source,
    discoveryEvidence: candidate.discoveryEvidence || candidate.sourceQuery || undefined,
    sharedKeywordCount: null,
  };
}

export function requalifyPersistedCommercialCompetitorDiscovery(
  slug: string,
  options: {
    persist?: boolean;
    snapshot?: NationalCompetitorDiscoveryResult;
  } = {},
): NationalCompetitorDiscoveryResult {
  const safe = safePharmacySlug(slug);
  const existing = options.snapshot || readNationalCompetitorDiscovery(safe);
  if (!existing) {
    throw new Error(`No persisted competitor discovery snapshot for ${safe}`);
  }
  if (!existing.candidates?.length) {
    throw new Error(`Persisted competitor discovery snapshot for ${safe} has no candidates to qualify`);
  }
  const ctx = buildCommercialCompetitorDiscoveryContext(safe);
  const injected = existing.candidates.map(persistedCandidateToInjected);
  const assembled = assembleCommercialCompetitorDiscovery(ctx, injected);
  const byDomain = new Map(existing.candidates.map((row) => [cleanDomain(row.domain), row]));
  const fixtureKind = existing.evidenceKind === "FIXTURE_VALIDATION"
    || (existing.discoveryProvider || "").toLowerCase() === "fixture";
  assembled.evidenceKind = fixtureKind ? "FIXTURE_VALIDATION" : "REAL_DISCOVERY";
  assembled.discoveryProvider = existing.discoveryProvider || assembled.discoveryProvider;
  assembled.serpRequestCount = existing.serpRequestCount ?? 0;
  assembled.serpCost = existing.serpCost ?? 0;
  assembled.rankedKeywordRequests = 0;
  assembled.queries = existing.queries?.length ? existing.queries : assembled.queries;
  assembled.candidates = assembled.candidates.map((row) => {
    const prev = byDomain.get(cleanDomain(row.domain));
    return {
      ...row,
      source: prev?.source || row.source,
      capturedAt: prev?.capturedAt || row.capturedAt,
      discoveryEvidence: prev?.discoveryEvidence || row.discoveryEvidence,
      sourceQuery: prev?.sourceQuery ?? row.sourceQuery,
      websiteUrl: prev?.websiteUrl || row.websiteUrl,
      evidenceUrls: prev?.evidenceUrls?.length ? prev.evidenceUrls : row.evidenceUrls,
    };
  });
  applyCommercialDiscoveryCounts(assembled);
  if (options.persist !== false) writeNationalCompetitorDiscovery(assembled);
  return assembled;
}

export function readCommercialCompetitorDiscovery(slug: string): NationalCompetitorDiscoveryResult | null {
  return readNationalCompetitorDiscovery(safePharmacySlug(slug));
}

export function readFixtureCommercialDiscovery(slug: string): NationalCompetitorDiscoveryResult | null {
  return readFixtureCommercialCompetitorDiscovery(safePharmacySlug(slug));
}
