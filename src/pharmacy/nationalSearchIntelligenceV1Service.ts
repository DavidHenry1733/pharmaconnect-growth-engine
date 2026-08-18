/**
 * NI-03C — Explicit National Search Intelligence collection and persisted reads.
 * GET/render paths must call readNationalSearchIntelligence only.
 * Live DataForSEO runs only from collectNationalSearchIntelligence.
 */
import fs from "node:fs";

import {
  DATAFORSEO_LABS_ENDPOINTS,
  executeDomainCompetitors,
  executeDomainRankedKeywords,
  normaliseLabsDomain,
  type DataForSeoDomainCompetitor,
  type DataForSeoLabsKeywordRow,
  type DataForSeoLabsTaskAttempt,
} from "./dataForSeoRankedKeywordIntelligenceService.ts";
import { enrichNationalCompetitorEvidence } from "./nationalCompetitorEvidenceEnrichmentService.ts";
import {
  assessNationalSearchCommercialCompetitor,
  selectCompetitorsForKeywordExpansion,
} from "./nationalSearchCommercialCompetitorGate.ts";
import { resolveNationalIntelligenceSubject, type NationalIntelligenceSubject } from "./nationalIntelligenceSubjectResolver.ts";
import {
  authorityFromProvenance,
  buildProvenance,
  evidenceSourceFromSnapshot,
  type NationalEvidenceSourceType,
} from "./nationalIntelligenceEvidenceProvenance.ts";
import { buildCostLedgerFromEndpoints } from "./nationalIntelligenceCostLedger.ts";
import {
  ensureNationalIntelligenceDataDir,
  isNationalIntelligenceFixturePath,
  nationalIntelligenceDataPath,
  resolveNationalIntelligenceArtifactPath,
} from "./nationalIntelligenceStorageService.ts";
import {
  NATIONAL_SEARCH_INTELLIGENCE_VERSION,
  PARTIAL_COLLECTION_CUSTOMER_MESSAGE,
  isUsableNationalSearchIntelligenceStatus,
  type NationalCompetitorKeywordUniverse,
  type NationalCompetitorRankingKeyword,
  type NationalCustomerRankingKeyword,
  type NationalOrganicSearchCompetitor,
  type NationalSearchCollectionPlan,
  type NationalSearchIntelligenceSnapshot,
  type NationalSearchLabsAttempt,
} from "./nationalSearchIntelligenceV1Model.ts";
import {
  describeCustomerOrganicFootprint,
  planNationalSearchIntelligenceTasks,
  resolveNationalSearchIntelligenceLimits,
  type NationalSearchIntelligenceLimits,
} from "./nationalSearchIntelligenceLimits.ts";
import { writeNationalCompetitorDiscovery } from "./nationalCompetitorDiscoveryStorageService.ts";
import { emptyNationalCompetitorDiscoveryResult } from "./nationalCompetitorDiscoveryModel.ts";
import { resolveDataForSeoSearchLocationFromSubject } from "./dataForSeoSearchLocationResolver.ts";

const inFlight = new Map<string, Promise<NationalSearchIntelligenceSnapshot>>();

export type NationalSearchIntelligenceProgressEvent =
  | { type: "plan"; plan: NationalSearchCollectionPlan }
  | { type: "ranked_start" }
  | { type: "ranked_complete"; rows: number; cost: number }
  | { type: "ranked_failed"; timedOut: boolean; message: string }
  | { type: "ranked_retry"; statusCode: number | null }
  | { type: "competitors_domain_start" }
  | { type: "competitors_domain_complete"; rows: number; cost: number }
  | { type: "competitors_domain_failed"; timedOut: boolean; message: string }
  | { type: "competitors_domain_retry"; statusCode: number | null }
  | { type: "competitor_keywords_start"; index: number; total: number; domain: string }
  | { type: "competitor_keywords_complete"; index: number; total: number; domain: string; rows: number; cost: number }
  | { type: "competitor_keywords_failed"; index: number; total: number; domain: string; timedOut: boolean; message: string }
  | { type: "competitor_keywords_retry"; index: number; total: number; domain: string; statusCode: number | null };

export type NationalSearchIntelligenceProgress = (event: NationalSearchIntelligenceProgressEvent) => void;

function json<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function writeJson(file: string, value: unknown): void {
  ensureNationalIntelligenceDataDir();
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

export function hasDataForSeoCredentials(): boolean {
  const login = process.env.DATAFORSEO_LOGIN || process.env.DATAFORSEO_API_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD || process.env.DATAFORSEO_API_PASSWORD;
  return Boolean(login && password);
}

export function nationalSearchIntelligencePath(slug: string): string {
  return nationalIntelligenceDataPath(slug, "search-intelligence-v1");
}

function isOwnDomain(domain: string, ownDomains: string[]): boolean {
  return ownDomains.some((own) => domain === own || domain.endsWith(`.${own}`));
}

function sortKeywordsCommercially<T extends { position: number | null; searchVolume: number | null; cpc: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const posA = a.position == null ? 9999 : a.position;
    const posB = b.position == null ? 9999 : b.position;
    if (posA !== posB) return posA - posB;
    const volA = a.searchVolume == null ? -1 : a.searchVolume;
    const volB = b.searchVolume == null ? -1 : b.searchVolume;
    if (volA !== volB) return volB - volA;
    const cpcA = a.cpc == null ? -1 : a.cpc;
    const cpcB = b.cpc == null ? -1 : b.cpc;
    return cpcB - cpcA;
  });
}

function strongestRankingPages(keywords: NationalCustomerRankingKeyword[]): NationalSearchIntelligenceSnapshot["summary"]["strongestRankingPages"] {
  const byUrl = new Map<string, { url: string; keywordCount: number; demandValues: number[]; bestPosition: number | null }>();
  for (const row of keywords) {
    const url = String(row.rankingUrl || "").trim();
    if (!url) continue;
    const current = byUrl.get(url) || { url, keywordCount: 0, demandValues: [], bestPosition: null };
    current.keywordCount += 1;
    if (typeof row.searchVolume === "number") current.demandValues.push(row.searchVolume);
    if (row.position != null && (current.bestPosition == null || row.position < current.bestPosition)) {
      current.bestPosition = row.position;
    }
    byUrl.set(url, current);
  }
  return [...byUrl.values()]
    .sort((a, b) => b.keywordCount - a.keywordCount || (b.demandValues.reduce((s, n) => s + n, 0) - a.demandValues.reduce((s, n) => s + n, 0)))
    .slice(0, 8)
    .map((row) => ({
      url: row.url,
      keywordCount: row.keywordCount,
      searchDemand: row.demandValues.length ? row.demandValues.reduce((sum, value) => sum + value, 0) : null,
      bestPosition: row.bestPosition,
    }));
}

function summarise(
  keywords: NationalCustomerRankingKeyword[],
  competitors: NationalOrganicSearchCompetitor[],
  excluded: NationalOrganicSearchCompetitor[],
  universes: NationalCompetitorKeywordUniverse[],
): NationalSearchIntelligenceSnapshot["summary"] {
  const pages = new Set(keywords.map((row) => row.rankingUrl).filter(Boolean));
  const demandValues = keywords.map((row) => row.searchVolume).filter((value): value is number => typeof value === "number");
  return {
    rankingKeywordCount: keywords.length,
    top3Count: keywords.filter((row) => row.position != null && row.position <= 3).length,
    top10Count: keywords.filter((row) => row.position != null && row.position <= 10).length,
    top20Count: keywords.filter((row) => row.position != null && row.position <= 20).length,
    top100Count: keywords.filter((row) => row.position != null && row.position <= 100).length,
    rankingPageCount: pages.size,
    availableSearchDemand: demandValues.length ? demandValues.reduce((sum, value) => sum + value, 0) : null,
    organicCompetitorCount: competitors.length,
    commercialCompetitorCount: competitors.filter((row) => row.role === "commercial_competitor").length,
    serpCompetitorCount: competitors.filter((row) => row.role !== "commercial_competitor").length,
    analysedCompetitorCount: universes.filter((row) => row.status === "collected").length,
    excludedCompetitorCount: excluded.length,
    competitorKeywordCount: universes.reduce((sum, row) => sum + row.keywords.length, 0),
    directCompetitorCount: competitors.filter((row) => row.classification === "direct_competitor").length,
    adjacentCompetitorCount: competitors.filter((row) => row.classification === "adjacent_competitor").length,
    strongestRankingPages: strongestRankingPages(keywords),
    top3CountCalculated: true,
    top10CountCalculated: true,
    top20CountCalculated: true,
    top100CountCalculated: true,
    rankingPageCountCalculated: true,
    availableSearchDemandCalculated: true,
  };
}

function nextStage(): NationalSearchIntelligenceSnapshot["nextStage"] {
  return {
    title: "Compare competitor keyword universes",
    detail: "Next: compare competitor keyword universes and identify commercial search gaps. That work is not part of this screen.",
    implemented: false,
  };
}

function emptyEndpoints(): NationalSearchIntelligenceSnapshot["endpoints"] {
  return [
    { endpoint: DATAFORSEO_LABS_ENDPOINTS.rankedKeywords, requests: 0, tasks: 0, cost: 0 },
    { endpoint: DATAFORSEO_LABS_ENDPOINTS.competitorsDomain, requests: 0, tasks: 0, cost: 0 },
  ];
}

export function planNationalSearchIntelligenceCollection(
  slug: string,
  overrides: Partial<NationalSearchIntelligenceLimits> = {},
): NationalSearchCollectionPlan {
  const limits = resolveNationalSearchIntelligenceLimits(overrides);
  const tasks = planNationalSearchIntelligenceTasks(limits);
  return {
    ...tasks,
    limits,
    endpoints: [
      DATAFORSEO_LABS_ENDPOINTS.rankedKeywords,
      DATAFORSEO_LABS_ENDPOINTS.competitorsDomain,
    ],
  };
}

function snapshotShell(input: {
  slug: string;
  liveExecution: boolean;
  fixture: boolean;
  recovered: boolean;
  status: NationalSearchIntelligenceSnapshot["status"];
  lastError: string | null;
  reusedExistingSnapshot: boolean;
  capturedAt?: string;
  keywords: NationalCustomerRankingKeyword[];
  competitors: NationalOrganicSearchCompetitor[];
  excludedCompetitors?: NationalOrganicSearchCompetitor[];
  competitorKeywordUniverses?: NationalCompetitorKeywordUniverse[];
  endpoints: NationalSearchIntelligenceSnapshot["endpoints"];
  labsAttempts?: NationalSearchLabsAttempt[];
  serpAttempts?: NationalSearchIntelligenceSnapshot["serpAttempts"];
  limits?: NationalSearchIntelligenceLimits;
  collectionPlan?: NationalSearchCollectionPlan;
  customerOrganicFootprint?: NationalSearchIntelligenceSnapshot["customerOrganicFootprint"];
}): NationalSearchIntelligenceSnapshot {
  const subject = resolveNationalIntelligenceSubject(input.slug);
  const capturedAt = input.capturedAt || new Date().toISOString();
  const limits = input.limits || resolveNationalSearchIntelligenceLimits();
  const collectionPlan = input.collectionPlan || planNationalSearchIntelligenceCollection(subject.slug, limits);
  const uncollected =
    input.status === "not_collected"
    || (input.status === "error" && !input.liveExecution && !input.fixture && !input.recovered);
  const evidenceSource = uncollected
    ? "FALLBACK"
    : evidenceSourceFromSnapshot({
      liveExecution: input.liveExecution,
      fixture: input.fixture,
      recovered: input.recovered,
    });
  const sourceSnapshot = uncollected ? null : nationalSearchIntelligencePath(subject.slug);
  const costLedger = buildCostLedgerFromEndpoints({
    tenantSlug: subject.slug,
    snapshotId: `search-intelligence-v1:${subject.slug}`,
    capturedAt,
    liveExecution: input.liveExecution,
    fixture: input.fixture,
    recovered: input.recovered,
    endpoints: input.endpoints,
    sourceSnapshot,
  });
  if (uncollected) {
    costLedger.evidenceSource = "FALLBACK";
    costLedger.entries = costLedger.entries.map((entry) => ({ ...entry, evidenceSource: "FALLBACK" }));
  }
  const provenance = buildProvenance({
    tenantSlug: subject.slug,
    subjectDomain: subject.subjectDomain,
    capturedAt,
    evidenceSource,
    sourceSystem: "national-search-intelligence-v1",
    sourceEndpoint: input.liveExecution ? DATAFORSEO_LABS_ENDPOINTS.rankedKeywords : null,
    sourceSnapshot,
    liveExecution: input.liveExecution,
    confidenceBasis: input.liveExecution
      ? "explicit-dataforseo-collection"
      : input.fixture
        ? "fixture-snapshot"
        : uncollected
          ? "not-collected"
          : "persisted-snapshot",
    costContribution: costLedger.totalCost,
  });
  const excluded = input.excludedCompetitors || [];
  const universes = input.competitorKeywordUniverses || [];
  return {
    version: NATIONAL_SEARCH_INTELLIGENCE_VERSION,
    tenantSlug: subject.slug,
    businessName: subject.businessName,
    subjectDomain: subject.subjectDomain,
    primaryMarket: subject.primaryMarket,
    country: subject.country,
    growthPlatform: "national",
    capturedAt,
    liveExecution: input.liveExecution,
    status: input.status,
    lastError: input.lastError,
    reusedExistingSnapshot: input.reusedExistingSnapshot,
    serpLocation: (() => {
      try {
        const location = resolveDataForSeoSearchLocationFromSubject(subject);
        return { country: subject.country, locationCode: location.locationCode };
      } catch {
        return null;
      }
    })(),
    limits,
    collectionPlan,
    customerOrganicFootprint: input.customerOrganicFootprint
      || describeCustomerOrganicFootprint(input.keywords.length, limits),
    endpoints: input.endpoints,
    costs: {
      requests: costLedger.requestCount,
      tasks: costLedger.taskCount,
      totalCost: costLedger.totalCost,
    },
    costLedger,
    provenance,
    authority: uncollected
      ? "INSUFFICIENT_EVIDENCE"
      : authorityFromProvenance({
        liveExecution: input.liveExecution,
        fixture: input.fixture,
        recovered: input.recovered,
        hasAuthoritativeGapEvidence: false,
      }),
    customerKeywords: input.keywords,
    organicCompetitors: input.competitors,
    excludedCompetitors: excluded,
    competitorKeywordUniverses: universes,
    labsAttempts: input.labsAttempts || [],
    serpAttempts: input.serpAttempts || [],
    summary: summarise(input.keywords, input.competitors, excluded, universes),
    nextStage: nextStage(),
  };
}

function emptySnapshot(
  slug: string,
  status: NationalSearchIntelligenceSnapshot["status"] = "not_collected",
  lastError: string | null = null,
  limits?: NationalSearchIntelligenceLimits,
): NationalSearchIntelligenceSnapshot {
  return snapshotShell({
    slug,
    liveExecution: false,
    fixture: false,
    recovered: false,
    status,
    lastError,
    reusedExistingSnapshot: false,
    keywords: [],
    competitors: [],
    endpoints: emptyEndpoints(),
    limits,
    collectionPlan: planNationalSearchIntelligenceCollection(slug, limits || {}),
  });
}

function persistSnapshot(snapshot: NationalSearchIntelligenceSnapshot): void {
  writeJson(nationalSearchIntelligencePath(snapshot.tenantSlug), snapshot);
  writeJson(nationalIntelligenceDataPath(snapshot.tenantSlug, "ranked-keywords-customer"), {
    tenantSlug: snapshot.tenantSlug,
    subjectDomain: snapshot.subjectDomain,
    capturedAt: snapshot.capturedAt,
    liveExecution: snapshot.liveExecution,
    evidenceSource: snapshot.provenance.evidenceSource,
    sourceEndpoint: DATAFORSEO_LABS_ENDPOINTS.rankedKeywords,
    cost: snapshot.endpoints.find((row) => row.endpoint === DATAFORSEO_LABS_ENDPOINTS.rankedKeywords)?.cost ?? 0,
    keywords: snapshot.customerKeywords,
  });
  writeJson(nationalIntelligenceDataPath(snapshot.tenantSlug, "ranked-keywords-competitors"), {
    tenantSlug: snapshot.tenantSlug,
    subjectDomain: snapshot.subjectDomain,
    capturedAt: snapshot.capturedAt,
    liveExecution: snapshot.liveExecution,
    evidenceSource: snapshot.provenance.evidenceSource,
    sourceEndpoint: DATAFORSEO_LABS_ENDPOINTS.rankedKeywords,
    universes: snapshot.competitorKeywordUniverses,
  });
  writeJson(nationalIntelligenceDataPath(snapshot.tenantSlug, "cost-ledger-v1"), snapshot.costLedger);
  writeJson(nationalIntelligenceDataPath(snapshot.tenantSlug, "refresh-metadata-v1"), {
    tenantSlug: snapshot.tenantSlug,
    subjectDomain: snapshot.subjectDomain,
    capturedAt: snapshot.capturedAt,
    status: snapshot.status,
    liveExecution: snapshot.liveExecution,
    authority: snapshot.authority,
    evidenceSource: snapshot.provenance.evidenceSource,
    lastError: snapshot.lastError,
    reusedExistingSnapshot: snapshot.reusedExistingSnapshot,
    requests: snapshot.costs.requests,
    tasks: snapshot.costs.tasks,
    totalCost: snapshot.costs.totalCost,
    serpLocation: snapshot.serpLocation,
    collectionPlan: snapshot.collectionPlan,
    labsAttempts: snapshot.labsAttempts,
    serpAttempts: snapshot.serpAttempts,
  });
}

function persistCompetitorDiscovery(snapshot: NationalSearchIntelligenceSnapshot): void {
  const result = emptyNationalCompetitorDiscoveryResult(
    snapshot.tenantSlug,
    snapshot.country || "United Kingdom",
    snapshot.primaryMarket,
  );
  result.generatedAt = snapshot.capturedAt;
  result.status = snapshot.organicCompetitors.length ? "complete" : snapshot.status === "error" ? "failed" : "draft";
  result.qualifiedCompetitors = snapshot.organicCompetitors
    .filter((row) => row.eligibleForKeywordExpansion)
    .map((row) => ({
      id: `national-${row.domain.replace(/[^a-z0-9]+/g, "-")}`,
      name: row.name,
      domain: row.domain,
      websiteUrl: row.websiteUrl,
      marketCountry: snapshot.country,
      targetCustomerMarket: snapshot.primaryMarket,
      source: "search-engine" as const,
      sourceQuery: row.sourceQueries[0] || "dataforseo_labs_competitors_domain",
      qualification: row.qualification,
      qualificationReasons: row.whyIdentified,
      rejectionReasons: row.exclusionReasons,
      serviceEvidence: [],
      title: row.name,
      description: row.whyIdentified.join(" "),
      evidenceUrls: row.evidenceUrls,
      capturedAt: row.capturedAt,
    }));
  result.candidates = snapshot.organicCompetitors
    .filter((row) => !row.eligibleForKeywordExpansion)
    .map((row) => ({
      id: `national-serp-${row.domain.replace(/[^a-z0-9]+/g, "-")}`,
      name: row.name,
      domain: row.domain,
      websiteUrl: row.websiteUrl,
      marketCountry: snapshot.country,
      targetCustomerMarket: snapshot.primaryMarket,
      source: "search-engine" as const,
      sourceQuery: row.sourceQueries[0] || "dataforseo_labs_competitors_domain",
      qualification: row.qualification,
      qualificationReasons: row.whyIdentified,
      rejectionReasons: row.exclusionReasons,
      serviceEvidence: [],
      title: row.name,
      description: row.whyIdentified.join(" "),
      evidenceUrls: row.evidenceUrls,
      capturedAt: row.capturedAt,
    }));
  writeNationalCompetitorDiscovery(result);
}

function hydrateSnapshot(snapshot: NationalSearchIntelligenceSnapshot, subjectDomain: string, businessName: string): NationalSearchIntelligenceSnapshot {
  if (!snapshot.subjectDomain) snapshot.subjectDomain = subjectDomain;
  if (!snapshot.businessName) snapshot.businessName = businessName;
  if (!Array.isArray(snapshot.serpAttempts)) snapshot.serpAttempts = [];
  if (!Array.isArray(snapshot.labsAttempts)) snapshot.labsAttempts = [];
  if (!Array.isArray(snapshot.excludedCompetitors)) snapshot.excludedCompetitors = [];
  if (!Array.isArray(snapshot.competitorKeywordUniverses)) snapshot.competitorKeywordUniverses = [];
  if (!Array.isArray(snapshot.customerKeywords)) snapshot.customerKeywords = [];
  if (!Array.isArray(snapshot.organicCompetitors)) snapshot.organicCompetitors = [];
  if (!snapshot.limits) snapshot.limits = resolveNationalSearchIntelligenceLimits();
  if (!snapshot.collectionPlan) snapshot.collectionPlan = planNationalSearchIntelligenceCollection(snapshot.tenantSlug, snapshot.limits);
  snapshot.organicCompetitors = snapshot.organicCompetitors.map((row) => ({
    ...row,
    discoverySource: row.discoverySource || "dataforseo_labs_competitors_domain",
    sharedKeywordCount: row.sharedKeywordCount ?? null,
    averagePosition: row.averagePosition ?? null,
    organicEtv: row.organicEtv ?? null,
    organicKeywordCount: row.organicKeywordCount ?? null,
    sharedKeywordEtv: row.sharedKeywordEtv ?? null,
    exclusionReasons: Array.isArray(row.exclusionReasons) ? row.exclusionReasons : [],
    analysed: Boolean(row.analysed),
    role: row.role || (row.eligibleForKeywordExpansion ? "commercial_competitor" : "serp_content_competitor"),
    qualificationScore: row.qualificationScore ?? 0,
    qualificationEvidence: Array.isArray(row.qualificationEvidence) ? row.qualificationEvidence : [],
    eligibleForKeywordExpansion: Boolean(row.eligibleForKeywordExpansion),
    nonSelectionReason: row.nonSelectionReason || null,
    commercialGate: row.commercialGate || {
      targetMarketRelevance: false,
      commercialProvider: false,
      serviceOverlap: false,
      marketRelevance: false,
      matchedServices: [],
      tenantServices: [],
      candidateServicesDetected: [],
      overlappingServices: [],
      nonOverlappingServices: [],
      organicOverlapSupportingOnly: true,
    },
  }));
  if (!snapshot.customerOrganicFootprint) {
    snapshot.customerOrganicFootprint = describeCustomerOrganicFootprint(
      snapshot.customerKeywords.length,
      snapshot.limits,
    );
  }
  if (!snapshot.summary) {
    snapshot.summary = summarise(
      snapshot.customerKeywords,
      snapshot.organicCompetitors,
      snapshot.excludedCompetitors,
      snapshot.competitorKeywordUniverses,
    );
  } else {
    snapshot.summary.top3Count = snapshot.summary.top3Count ?? snapshot.customerKeywords.filter((row) => row.position != null && row.position <= 3).length;
    snapshot.summary.top100Count = snapshot.summary.top100Count ?? snapshot.customerKeywords.filter((row) => row.position != null && row.position <= 100).length;
    snapshot.summary.analysedCompetitorCount = snapshot.summary.analysedCompetitorCount ?? snapshot.competitorKeywordUniverses.filter((row) => row.status === "collected").length;
    snapshot.summary.excludedCompetitorCount = snapshot.summary.excludedCompetitorCount ?? snapshot.excludedCompetitors.length;
    snapshot.summary.competitorKeywordCount = snapshot.summary.competitorKeywordCount
      ?? snapshot.competitorKeywordUniverses.reduce((sum, row) => sum + row.keywords.length, 0);
    snapshot.summary.commercialCompetitorCount = snapshot.summary.commercialCompetitorCount
      ?? snapshot.organicCompetitors.filter((row) => row.role === "commercial_competitor").length;
    snapshot.summary.serpCompetitorCount = snapshot.summary.serpCompetitorCount
      ?? snapshot.organicCompetitors.filter((row) => row.role === "serp_content_competitor").length;
    snapshot.summary.strongestRankingPages = snapshot.summary.strongestRankingPages || strongestRankingPages(snapshot.customerKeywords);
    snapshot.summary.top3CountCalculated = true;
    snapshot.summary.top100CountCalculated = true;
  }
  return snapshot;
}

export function readNationalSearchIntelligence(slug: string): NationalSearchIntelligenceSnapshot {
  const subject = resolveNationalIntelligenceSubject(slug);
  if (!subject.eligibleForNationalIntelligence) {
    return emptySnapshot(slug, "not_collected", "National Search Intelligence is available for NATIONAL Growth Platform tenants only.");
  }
  const file = resolveNationalIntelligenceArtifactPath(slug, "search-intelligence-v1");
  if (!file) return emptySnapshot(slug);
  const snapshot = hydrateSnapshot(json<NationalSearchIntelligenceSnapshot>(file), subject.subjectDomain, subject.businessName);
  const fixture = isNationalIntelligenceFixturePath(file);
  snapshot.reusedExistingSnapshot = false;
  if (fixture) {
    snapshot.liveExecution = false;
    snapshot.authority = "FIXTURE_ONLY";
    snapshot.provenance = {
      ...snapshot.provenance,
      liveExecution: false,
      evidenceSource: "FIXTURE",
    };
  } else if (snapshot.provenance?.evidenceSource === "RECOVERED" || snapshot.authority === "RECOVERED_EVIDENCE") {
    snapshot.liveExecution = false;
    snapshot.authority = "RECOVERED_EVIDENCE";
    if (snapshot.provenance) {
      snapshot.provenance.evidenceSource = "RECOVERED";
      snapshot.provenance.liveExecution = false;
    }
  } else if (snapshot.provenance?.evidenceSource === "DATAFORSEO_LIVE" || snapshot.liveExecution) {
    snapshot.liveExecution = false;
    if (snapshot.authority === "LIVE_PROVEN") snapshot.authority = "PERSISTED_PROVEN";
    if (snapshot.provenance) {
      snapshot.provenance.evidenceSource = "DATAFORSEO_PERSISTED";
      snapshot.provenance.liveExecution = false;
    }
  }
  return snapshot;
}

function mapCustomerKeyword(row: DataForSeoLabsKeywordRow, capturedAt: string, sourceEndpoint: string): NationalCustomerRankingKeyword {
  return {
    keyword: row.keyword,
    position: row.position,
    rankingUrl: row.url,
    searchVolume: row.searchVolume,
    cpc: row.cpc,
    competition: row.competition,
    estimatedTraffic: row.etv ?? null,
    searchIntent: row.searchIntent ?? null,
    serpType: row.serpType ?? null,
    rankGroup: row.rankGroup ?? null,
    seResultsCount: row.seResultsCount ?? null,
    capturedAt,
    sourceEndpoint,
    evidenceSource: "DATAFORSEO_LIVE",
    calculated: false,
  };
}

function mapCompetitorKeyword(domain: string, row: DataForSeoLabsKeywordRow, capturedAt: string, sourceEndpoint: string): NationalCompetitorRankingKeyword {
  return {
    domain,
    keyword: row.keyword,
    position: row.position,
    rankingUrl: row.url,
    searchVolume: row.searchVolume,
    cpc: row.cpc,
    competition: row.competition,
    estimatedTraffic: row.etv ?? null,
    searchIntent: row.searchIntent ?? null,
    capturedAt,
    sourceEndpoint,
    evidenceSource: "DATAFORSEO_LIVE",
    calculated: false,
  };
}

async function websiteEvidenceForDomain(
  domain: string,
  injected?: Record<string, { title?: string; websiteText: string }>,
): Promise<{ title: string; websiteText: string; evidenceUrls: string[] }> {
  const key = normaliseLabsDomain(domain);
  const override = injected?.[key] || injected?.[domain];
  if (override) {
    return {
      title: override.title || key,
      websiteText: override.websiteText,
      evidenceUrls: [`https://${key}`],
    };
  }
  if (injected) {
    return { title: key, websiteText: "", evidenceUrls: [`https://${key}`] };
  }
  const enriched = await enrichNationalCompetitorEvidence({ domain: key });
  const websiteText = [
    ...enriched.pagesChecked.map((page) => `${page.title || ""} ${page.textSample || ""}`),
    ...enriched.pharmacyMarketEvidence,
    ...enriched.commercialProviderEvidence,
    ...enriched.serviceEvidence,
    ...enriched.ukMarketEvidence,
  ].join(" ");
  const title = enriched.pagesChecked.find((page) => page.title)?.title || key;
  return {
    title,
    websiteText,
    evidenceUrls: enriched.evidenceUrls.length ? enriched.evidenceUrls : [`https://${key}`],
  };
}

function mapLabsCompetitor(input: {
  row: DataForSeoDomainCompetitor;
  capturedAt: string;
  ownDomains: string[];
  analysed: boolean;
  subject: NationalIntelligenceSubject;
  websiteTitle?: string | null;
  websiteText?: string | null;
  evidenceUrls?: string[];
  sparseCustomerFootprint: boolean;
}): NationalOrganicSearchCompetitor {
  const domain = normaliseLabsDomain(input.row.domain);
  const gate = assessNationalSearchCommercialCompetitor({
    domain,
    title: input.websiteTitle || domain,
    websiteText: input.websiteText || "",
    url: `https://${domain}`,
    sharedKeywordCount: input.row.sharedKeywordCount,
    organicEtv: input.row.organicEtv,
    subject: input.subject,
    ownDomains: input.ownDomains,
    sparseCustomerFootprint: input.sparseCustomerFootprint,
  });
  const why: string[] = [];
  if (input.row.sharedKeywordCount != null) {
    why.push(`Shares ${input.row.sharedKeywordCount} ranking keywords in organic search (DataForSEO intersections; SERP overlap only).`);
  }
  if (input.row.organicEtv != null) {
    why.push(`Estimated organic traffic ${input.row.organicEtv} is full-domain metrics, not proof of commercial competition.`);
  }
  if (input.row.avgPosition != null) {
    why.push(`Average overlapping position ${input.row.avgPosition}.`);
  }
  why.push(
    gate.role === "commercial_competitor"
      ? "This business competes for the same customers and services."
      : gate.role === "adjacent_commercial_provider"
        ? "This business targets the same customers but does not overlap the tenant's commercial services."
        : "This domain competes in search. Organic overlap is not commercial competitor proof.",
  );
  why.push(...gate.reasons);
  const excluded = gate.classification === "excluded";
  return {
    domain,
    name: domain,
    websiteUrl: `https://${domain}`,
    whyIdentified: why,
    sourceQueries: ["dataforseo_labs_competitors_domain"],
    discoverySource: "dataforseo_labs_competitors_domain",
    sharedKeywordCount: input.row.sharedKeywordCount,
    averagePosition: input.row.avgPosition,
    organicEtv: input.row.organicEtv,
    organicKeywordCount: input.row.organicKeywordCount,
    sharedKeywordEtv: input.row.sharedKeywordEtv,
    bestSerpPosition: input.row.avgPosition != null ? Math.round(input.row.avgPosition) : null,
    role: gate.role,
    classification: gate.classification,
    qualification: gate.qualification,
    evidenceStatus: excluded ? "excluded" : gate.role,
    evidenceUrls: input.evidenceUrls?.length ? input.evidenceUrls : [`https://${domain}`],
    exclusionReasons: gate.exclusionReasons,
    qualificationScore: gate.score,
    qualificationEvidence: gate.reasons,
    eligibleForKeywordExpansion: gate.eligibleForKeywordExpansion,
    nonSelectionReason: gate.nonSelectionReason,
    commercialGate: {
      targetMarketRelevance: gate.targetMarketRelevance,
      commercialProvider: gate.commercialProvider,
      serviceOverlap: gate.serviceOverlap,
      marketRelevance: gate.marketRelevance,
      matchedServices: gate.matchedServices,
      tenantServices: gate.tenantServices,
      candidateServicesDetected: gate.candidateServicesDetected,
      overlappingServices: gate.overlappingServices,
      nonOverlappingServices: gate.nonOverlappingServices,
      organicOverlapSupportingOnly: true,
    },
    analysed: input.analysed,
    capturedAt: input.capturedAt,
    evidenceSource: "DATAFORSEO_LIVE",
    verified: false,
  };
}

function toLabsAttempts(
  role: NationalSearchLabsAttempt["role"],
  domain: string | null,
  attempts: DataForSeoLabsTaskAttempt[],
): NationalSearchLabsAttempt[] {
  return attempts.map((attempt) => ({
    role,
    domain,
    endpoint: attempt.endpoint,
    taskId: attempt.taskId,
    taskStatusCode: attempt.taskStatusCode,
    taskStatusMessage: attempt.taskStatusMessage,
    cost: attempt.cost,
    successful: attempt.successful,
    timedOut: attempt.timedOut,
    attemptNumber: attempt.attemptNumber,
    capturedAt: attempt.capturedAt,
  }));
}

function addEndpointUsage(
  endpoints: NationalSearchIntelligenceSnapshot["endpoints"],
  endpoint: string,
  attempts: DataForSeoLabsTaskAttempt[],
  cost: number,
): void {
  const row = endpoints.find((item) => item.endpoint === endpoint);
  if (!row) return;
  row.requests += attempts.length;
  row.tasks += attempts.length;
  row.cost += cost;
}

async function collectInner(
  slug: string,
  force: boolean,
  onProgress?: NationalSearchIntelligenceProgress,
  limitOverrides: Partial<NationalSearchIntelligenceLimits> = {},
  websiteEvidenceByDomain?: Record<string, { title?: string; websiteText: string }>,
): Promise<NationalSearchIntelligenceSnapshot> {
  const subject = resolveNationalIntelligenceSubject(slug);
  if (!subject.eligibleForNationalIntelligence) {
    throw new Error(`National Search Intelligence is not eligible for ${slug}`);
  }
  const limits = resolveNationalSearchIntelligenceLimits(limitOverrides);
  const collectionPlan = planNationalSearchIntelligenceCollection(slug, limits);
  const dataFile = nationalSearchIntelligencePath(slug);
  if (!force && fs.existsSync(dataFile)) {
    const existing = json<NationalSearchIntelligenceSnapshot>(dataFile);
    const source = existing.provenance?.evidenceSource;
    if (isUsableNationalSearchIntelligenceStatus(existing.status)) {
      if (source === "DATAFORSEO_LIVE" || source === "DATAFORSEO_PERSISTED" || existing.liveExecution) {
        return { ...hydrateSnapshot(existing, subject.subjectDomain, subject.businessName), reusedExistingSnapshot: true, liveExecution: false };
      }
    }
  }
  if (!hasDataForSeoCredentials()) {
    const missing = emptySnapshot(slug, "error", "DataForSEO credentials are not configured. Collection was not executed.", limits);
    persistSnapshot(missing);
    return missing;
  }

  const capturedAt = new Date().toISOString();
  const serpLocation = resolveDataForSeoSearchLocationFromSubject(subject);
  const endpoints = emptyEndpoints();
  const ownDomains = [normaliseLabsDomain(subject.subjectDomain)].filter(Boolean);
  const labsAttempts: NationalSearchLabsAttempt[] = [];
  onProgress?.({ type: "plan", plan: collectionPlan });

  let keywords: NationalCustomerRankingKeyword[] = [];
  let rankedIncomplete = false;
  onProgress?.({ type: "ranked_start" });
  const ranked = await executeDomainRankedKeywords({
    domain: subject.subjectDomain,
    locationCode: serpLocation.locationCode,
    languageCode: subject.languageCode || "en",
    limit: limits.customerKeywordUniverse,
    orderBy: ["keyword_data.keyword_info.search_volume,desc"],
  });
  const rankedRetry = ranked.attempts.find((attempt) => attempt.attemptNumber > 1);
  if (rankedRetry) {
    onProgress?.({ type: "ranked_retry", statusCode: ranked.attempts[0]?.taskStatusCode ?? null });
  }
  addEndpointUsage(endpoints, DATAFORSEO_LABS_ENDPOINTS.rankedKeywords, ranked.attempts, ranked.cost);
  labsAttempts.push(...toLabsAttempts("customer_ranked_keywords", subject.subjectDomain, ranked.attempts));
  if (ranked.successful && ranked.result) {
    keywords = sortKeywordsCommercially(
      ranked.result.rows.slice(0, limits.customerKeywordUniverse).map((row) => mapCustomerKeyword(row, capturedAt, ranked.endpoint)),
    );
    onProgress?.({ type: "ranked_complete", rows: keywords.length, cost: ranked.cost });
  } else {
    rankedIncomplete = true;
    const last = ranked.attempts[ranked.attempts.length - 1];
    onProgress?.({
      type: "ranked_failed",
      timedOut: ranked.timedOut,
      message: ranked.fatalMessage || last?.taskStatusMessage || "DataForSEO ranked keyword collection failed.",
    });
    if (ranked.fatal) {
      const failed = snapshotShell({
        slug,
        liveExecution: true,
        fixture: false,
        recovered: false,
        status: "error",
        lastError: ranked.fatalMessage || last?.taskStatusMessage || "DataForSEO ranked keyword collection failed.",
        reusedExistingSnapshot: false,
        capturedAt,
        keywords: [],
        competitors: [],
        endpoints,
        labsAttempts,
        limits,
        collectionPlan,
      });
      persistSnapshot(failed);
      return failed;
    }
  }

  let organicCompetitors: NationalOrganicSearchCompetitor[] = [];
  let excludedCompetitors: NationalOrganicSearchCompetitor[] = [];
  let competitorDiscoveryIncomplete = false;
  onProgress?.({ type: "competitors_domain_start" });
  const discovered = await executeDomainCompetitors({
    domain: subject.subjectDomain,
    locationCode: serpLocation.locationCode,
    languageCode: subject.languageCode || "en",
    limit: limits.competitorDiscoveryCandidates,
    excludeTopDomains: true,
    excludeDomains: ownDomains,
  });
  if (discovered.attempts.some((attempt) => attempt.attemptNumber > 1)) {
    onProgress?.({ type: "competitors_domain_retry", statusCode: discovered.attempts[0]?.taskStatusCode ?? null });
  }
  addEndpointUsage(endpoints, DATAFORSEO_LABS_ENDPOINTS.competitorsDomain, discovered.attempts, discovered.cost);
  labsAttempts.push(...toLabsAttempts("competitors_domain", subject.subjectDomain, discovered.attempts));
  if (discovered.successful && discovered.result) {
    const sparseCustomerFootprint = describeCustomerOrganicFootprint(keywords.length, limits).sparse;
    const mapped: NationalOrganicSearchCompetitor[] = [];
    for (const row of discovered.result.rows
      .filter((item) => item.domain && !isOwnDomain(item.domain, ownDomains))
      .slice(0, limits.competitorDiscoveryCandidates)) {
      const website = await websiteEvidenceForDomain(row.domain, websiteEvidenceByDomain);
      mapped.push(mapLabsCompetitor({
        row,
        capturedAt,
        ownDomains,
        analysed: false,
        subject,
        websiteTitle: website.title,
        websiteText: website.websiteText,
        evidenceUrls: website.evidenceUrls,
        sparseCustomerFootprint,
      }));
    }
    excludedCompetitors = mapped.filter((row) => row.qualification === "rejected" || row.classification === "excluded");
    organicCompetitors = mapped
      .filter((row) => row.qualification !== "rejected" && row.classification !== "excluded")
      .sort((a, b) => (
        Number(b.eligibleForKeywordExpansion) - Number(a.eligibleForKeywordExpansion)
        || (b.qualificationScore || 0) - (a.qualificationScore || 0)
        || (b.sharedKeywordCount || 0) - (a.sharedKeywordCount || 0)
        || (b.organicEtv || 0) - (a.organicEtv || 0)
      ));
    onProgress?.({ type: "competitors_domain_complete", rows: organicCompetitors.length, cost: discovered.cost });
  } else {
    competitorDiscoveryIncomplete = true;
    const last = discovered.attempts[discovered.attempts.length - 1];
    onProgress?.({
      type: "competitors_domain_failed",
      timedOut: discovered.timedOut,
      message: discovered.fatalMessage || last?.taskStatusMessage || "DataForSEO competitors domain collection failed.",
    });
  }

  const toAnalyse = selectCompetitorsForKeywordExpansion(
    organicCompetitors,
    limits.qualifiedCompetitorsAnalysed,
  );

  const competitorKeywordUniverses: NationalCompetitorKeywordUniverse[] = [];
  let competitorKeywordsIncomplete = false;
  for (let index = 0; index < toAnalyse.length; index += 1) {
    const competitor = toAnalyse[index];
    onProgress?.({ type: "competitor_keywords_start", index: index + 1, total: toAnalyse.length, domain: competitor.domain });
    const competitorRanked = await executeDomainRankedKeywords({
      domain: competitor.domain,
      locationCode: serpLocation.locationCode,
      languageCode: subject.languageCode || "en",
      limit: limits.competitorRankedKeywords,
      orderBy: ["keyword_data.keyword_info.search_volume,desc"],
    });
    if (competitorRanked.attempts.some((attempt) => attempt.attemptNumber > 1)) {
      onProgress?.({
        type: "competitor_keywords_retry",
        index: index + 1,
        total: toAnalyse.length,
        domain: competitor.domain,
        statusCode: competitorRanked.attempts[0]?.taskStatusCode ?? null,
      });
    }
    addEndpointUsage(endpoints, DATAFORSEO_LABS_ENDPOINTS.rankedKeywords, competitorRanked.attempts, competitorRanked.cost);
    labsAttempts.push(...toLabsAttempts("competitor_ranked_keywords", competitor.domain, competitorRanked.attempts));
    if (competitorRanked.successful && competitorRanked.result) {
      const competitorKeywords = sortKeywordsCommercially(
        competitorRanked.result.rows
          .slice(0, limits.competitorRankedKeywords)
          .map((row) => mapCompetitorKeyword(competitor.domain, row, capturedAt, competitorRanked.endpoint)),
      );
      competitorKeywordUniverses.push({
        domain: competitor.domain,
        status: competitorKeywords.length ? "collected" : "empty",
        lastError: null,
        capturedAt,
        sourceEndpoint: competitorRanked.endpoint,
        cost: competitorRanked.cost,
        keywords: competitorKeywords,
      });
      competitor.analysed = true;
      onProgress?.({
        type: "competitor_keywords_complete",
        index: index + 1,
        total: toAnalyse.length,
        domain: competitor.domain,
        rows: competitorKeywords.length,
        cost: competitorRanked.cost,
      });
    } else {
      competitorKeywordsIncomplete = true;
      const last = competitorRanked.attempts[competitorRanked.attempts.length - 1];
      competitorKeywordUniverses.push({
        domain: competitor.domain,
        status: "error",
        lastError: competitorRanked.fatalMessage || last?.taskStatusMessage || "Competitor ranked keyword collection failed.",
        capturedAt,
        sourceEndpoint: competitorRanked.endpoint,
        cost: competitorRanked.cost,
        keywords: [],
      });
      onProgress?.({
        type: "competitor_keywords_failed",
        index: index + 1,
        total: toAnalyse.length,
        domain: competitor.domain,
        timedOut: competitorRanked.timedOut,
        message: competitorRanked.fatalMessage || last?.taskStatusMessage || "Competitor ranked keyword collection failed.",
      });
    }
  }

  const usable = keywords.length > 0 || organicCompetitors.length > 0 || competitorKeywordUniverses.some((row) => row.keywords.length > 0);
  const collectionIncomplete = rankedIncomplete || competitorDiscoveryIncomplete || competitorKeywordsIncomplete;
  let status: NationalSearchIntelligenceSnapshot["status"];
  let lastError: string | null = null;
  if (!usable && collectionIncomplete) {
    status = "error";
    lastError = "Search intelligence collection could not complete. No usable live evidence was returned.";
  } else if (!usable) {
    status = "empty";
  } else if (collectionIncomplete) {
    status = "partial";
    lastError = PARTIAL_COLLECTION_CUSTOMER_MESSAGE;
  } else {
    status = "collected";
  }
  const snapshot = snapshotShell({
    slug,
    liveExecution: true,
    fixture: false,
    recovered: false,
    status,
    lastError,
    reusedExistingSnapshot: false,
    capturedAt,
    keywords,
    competitors: organicCompetitors,
    excludedCompetitors,
    competitorKeywordUniverses,
    endpoints,
    labsAttempts,
    limits,
    collectionPlan,
    customerOrganicFootprint: describeCustomerOrganicFootprint(keywords.length, limits),
  });
  persistSnapshot(snapshot);
  if (status !== "error") persistCompetitorDiscovery(snapshot);
  return snapshot;
}

export async function collectNationalSearchIntelligence(
  slug: string,
  options: {
    force?: boolean;
    onProgress?: NationalSearchIntelligenceProgress;
    limits?: Partial<NationalSearchIntelligenceLimits>;
    websiteEvidenceByDomain?: Record<string, { title?: string; websiteText: string }>;
  } = {},
): Promise<NationalSearchIntelligenceSnapshot> {
  const subject = resolveNationalIntelligenceSubject(slug);
  if (!subject.eligibleForNationalIntelligence) {
    throw new Error(`National Search Intelligence is not eligible for ${slug}`);
  }
  const existing = inFlight.get(subject.slug);
  if (existing) {
    const snapshot = await existing;
    return { ...snapshot, reusedExistingSnapshot: true };
  }
  const pending = collectInner(
    subject.slug,
    Boolean(options.force),
    options.onProgress,
    options.limits || {},
    options.websiteEvidenceByDomain,
  );
  inFlight.set(subject.slug, pending);
  try {
    return await pending;
  } finally {
    inFlight.delete(subject.slug);
  }
}
