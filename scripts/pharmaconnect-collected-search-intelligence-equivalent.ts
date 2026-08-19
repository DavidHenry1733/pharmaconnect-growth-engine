/**
 * Local/cloud equivalent of the verified PharmaConnect Search Intelligence snapshot.
 * Used only for deterministic validation. Does not call DataForSEO.
 */
import fs from "node:fs";
import path from "node:path";
import * as workspaceMod from "../src/pharmacy/pharmacyWorkspacePaths.ts";

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const workspace = exported(workspaceMod) as { PHARMACY_WORKSPACE_ROOT?: string; WORKSPACE_ROOT?: string };
const WORKSPACE_ROOT = workspace.PHARMACY_WORKSPACE_ROOT || workspace.WORKSPACE_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

export const PHARMACONNECT_SI_EQUIVALENT_PATH = path.join(
  WORKSPACE_ROOT,
  "data/national-growth-engine/pharmaconnect-search-intelligence-v1.json",
);

export const PHARMACONNECT_SI_CAPTURED_AT = "2026-08-18T13:02:53.532Z";
export const PHARMACONNECT_SI_KEYWORD = "what is the pharmacy communication form used for";
export const PHARMACONNECT_SI_RANKING_URL =
  "https://pharmaconnect.uk/2026/03/12/the-role-of-digital-communication-in-modern-pharmacy-care/";

function competitor(index: number, domain: string, role: string) {
  return {
    domain,
    name: domain,
    websiteUrl: `https://${domain}`,
    whyIdentified: [`Labs competitors_domain intersections for candidate ${index + 1}`],
    sourceQueries: [],
    discoverySource: "dataforseo_labs_competitors_domain",
    sharedKeywordCount: Math.max(1, 19 - index),
    averagePosition: 8,
    organicEtv: 100 + index,
    organicKeywordCount: 40,
    sharedKeywordEtv: 12,
    bestSerpPosition: 4,
    role,
    classification: "insufficient_evidence",
    qualification: "candidate",
    evidenceStatus: "serp_only",
    evidenceUrls: [`https://${domain}/`],
    exclusionReasons: [],
    qualificationScore: 20,
    qualificationEvidence: ["Organic overlap is SERP evidence only."],
    eligibleForKeywordExpansion: false,
    nonSelectionReason: "This domain competes in search. It is not a commercial competitor.",
    commercialGate: {
      targetMarketRelevance: false,
      commercialProvider: false,
      serviceOverlap: false,
      marketRelevance: true,
      matchedServices: [],
      tenantServices: ["Pharmacy Website Design"],
      candidateServicesDetected: [],
      overlappingServices: [],
      nonOverlappingServices: [],
      organicOverlapSupportingOnly: true,
    },
    analysed: false,
    capturedAt: PHARMACONNECT_SI_CAPTURED_AT,
    evidenceSource: "DATAFORSEO_LIVE",
    verified: false,
  };
}

export function pharmaconnectCollectedSearchIntelligenceEquivalent() {
  const organicCompetitors = [
    competitor(0, "communitypharmacy.org.uk", "professional_body"),
    competitor(1, "nymopmr.co.uk", "adjacent_commercial_provider"),
    competitor(2, "surveyfocus.co.uk", "adjacent_commercial_provider"),
    competitor(3, "boots.com", "customer_market"),
    competitor(4, "sciencedirect.com", "education_academic"),
    competitor(5, "brainly.com", "education_academic"),
    competitor(6, "rcpharm.org", "professional_body"),
    competitor(7, "pharmacymagazine.co.uk", "publisher"),
    ...Array.from({ length: 11 }, (_, index) => competitor(8 + index, `serp-candidate-${index + 1}.example`, "serp_content_competitor")),
  ];
  return {
    version: 1,
    tenantSlug: "pharmaconnect",
    businessName: "PharmaConnect",
    subjectDomain: "pharmaconnect.uk",
    primaryMarket: "United Kingdom",
    country: "United Kingdom",
    growthPlatform: "national",
    capturedAt: PHARMACONNECT_SI_CAPTURED_AT,
    liveExecution: true,
    status: "collected",
    lastError: null,
    reusedExistingSnapshot: false,
    limits: {
      customerKeywordUniverse: 500,
      competitorDiscoveryCandidates: 20,
      qualifiedCompetitorsAnalysed: 5,
      competitorRankedKeywords: 300,
      sparseCustomerKeywordThreshold: 10,
    },
    customerOrganicFootprint: {
      keywordCount: 1,
      sparse: true,
      threshold: 10,
      sufficientForHighConfidenceCommercialDiscovery: false,
      note: "Customer organic footprint is sparse. Competitors Domain overlap is retained as SERP evidence and is not commercial competitor proof.",
    },
    endpoints: [],
    costs: { requests: 2, tasks: 2, totalCost: 0.02652 },
    provenance: {
      tenantSlug: "pharmaconnect",
      subjectDomain: "pharmaconnect.uk",
      capturedAt: PHARMACONNECT_SI_CAPTURED_AT,
      evidenceSource: "DATAFORSEO_LIVE",
      sourceSystem: "national-search-intelligence-v1",
      sourceEndpoint: "https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live",
      sourceSnapshot: PHARMACONNECT_SI_EQUIVALENT_PATH,
      liveExecution: true,
      calculated: false,
      calculationMethod: null,
      confidenceBasis: "explicit-dataforseo-collection",
      costContribution: 0.02652,
    },
    authority: "PERSISTED_PROVEN",
    customerKeywords: [{
      keyword: PHARMACONNECT_SI_KEYWORD,
      position: 57,
      rankingUrl: PHARMACONNECT_SI_RANKING_URL,
      searchVolume: 90,
      cpc: 1.2,
      competition: 0.4,
      estimatedTraffic: 4,
      searchIntent: "commercial",
      serpType: "organic",
      rankGroup: 1,
      seResultsCount: 1200000,
      capturedAt: PHARMACONNECT_SI_CAPTURED_AT,
      sourceEndpoint: "https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live",
      evidenceSource: "DATAFORSEO_LIVE",
      calculated: false,
    }],
    organicCompetitors,
    excludedCompetitors: [],
    competitorKeywordUniverses: [],
    labsAttempts: [],
    serpAttempts: [],
    summary: {
      rankingKeywordCount: 1,
      top3Count: 0,
      top10Count: 0,
      top20Count: 0,
      top100Count: 1,
      rankingPageCount: 1,
      availableSearchDemand: 90,
      organicCompetitorCount: 19,
      commercialCompetitorCount: 0,
      serpCompetitorCount: 19,
      analysedCompetitorCount: 0,
      excludedCompetitorCount: 0,
      competitorKeywordCount: 0,
      directCompetitorCount: 0,
      adjacentCompetitorCount: 0,
      strongestRankingPages: [{
        url: PHARMACONNECT_SI_RANKING_URL,
        keywordCount: 1,
        searchDemand: 90,
        bestPosition: 57,
      }],
      top3CountCalculated: true,
      top10CountCalculated: true,
      top20CountCalculated: true,
      top100CountCalculated: true,
      rankingPageCountCalculated: true,
      availableSearchDemandCalculated: true,
    },
  };
}

export function ensurePharmaconnectCollectedSearchIntelligenceEquivalent(): { created: boolean; path: string } {
  const file = PHARMACONNECT_SI_EQUIVALENT_PATH;
  if (fs.existsSync(file)) return { created: false, path: file };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(pharmaconnectCollectedSearchIntelligenceEquivalent(), null, 2) + "\n");
  return { created: true, path: file };
}

export function removePharmaconnectCollectedSearchIntelligenceEquivalent(created: boolean): void {
  if (!created) return;
  if (fs.existsSync(PHARMACONNECT_SI_EQUIVALENT_PATH)) fs.unlinkSync(PHARMACONNECT_SI_EQUIVALENT_PATH);
}
