/**
 * NI-03B/C — Customer keyword universe + organic search competitor intelligence.
 * Does not include keyword intersection/gap recommendations or Growth Plan.
 */
import type {
  NationalEvidenceAuthority,
  NationalEvidenceSourceType,
  NationalIntelligenceEvidenceProvenance,
} from "./nationalIntelligenceEvidenceProvenance.ts";
import type { NationalIntelligenceCostLedger } from "./nationalIntelligenceCostLedger.ts";
import type { NationalSearchIntelligenceLimits } from "./nationalSearchIntelligenceLimits.ts";
import { NI03C_DEFAULT_LIMITS } from "./nationalSearchIntelligenceLimits.ts";

export const NATIONAL_SEARCH_INTELLIGENCE_VERSION = 1 as const;

/** NI-03C commercial defaults. Collection uses resolveNationalSearchIntelligenceLimits(). */
export const NI03C_LIMITS = NI03C_DEFAULT_LIMITS;

/** @deprecated NI-03B proof-of-concept bounds. Prefer NI03C_LIMITS / resolveNationalSearchIntelligenceLimits(). */
export const NI03B_LIMITS = {
  customerRankedKeywords: NI03C_DEFAULT_LIMITS.customerKeywordUniverse,
  serpQueries: 0,
  serpDepth: 10,
  competitorCandidates: NI03C_DEFAULT_LIMITS.competitorDiscoveryCandidates,
} as const;

export type NationalSearchIntelligenceStatus =
  | "not_collected"
  | "collecting"
  | "collected"
  | "partial"
  | "empty"
  | "error";

export const PARTIAL_COLLECTION_CUSTOMER_MESSAGE =
  "Search intelligence was collected, but one or more search-engine requests could not be completed. Available evidence is shown below.";

export function isUsableNationalSearchIntelligenceStatus(
  status: NationalSearchIntelligenceStatus,
): boolean {
  return status === "collected" || status === "partial" || status === "empty";
}

export interface NationalCustomerRankingKeyword {
  keyword: string;
  position: number | null;
  rankingUrl: string | null;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  estimatedTraffic: number | null;
  searchIntent: string | null;
  serpType: string | null;
  rankGroup: number | null;
  seResultsCount: number | null;
  capturedAt: string;
  sourceEndpoint: string;
  evidenceSource: NationalEvidenceSourceType;
  calculated: false;
}

export interface NationalOrganicSearchCompetitor {
  domain: string;
  name: string;
  websiteUrl: string;
  whyIdentified: string[];
  sourceQueries: string[];
  discoverySource: "dataforseo_labs_competitors_domain";
  sharedKeywordCount: number | null;
  averagePosition: number | null;
  organicEtv: number | null;
  organicKeywordCount: number | null;
  sharedKeywordEtv: number | null;
  bestSerpPosition: number | null;
  classification: "direct_competitor" | "adjacent_competitor" | "insufficient_evidence" | "excluded";
  qualification: "qualified" | "candidate" | "rejected";
  evidenceStatus: string;
  evidenceUrls: string[];
  exclusionReasons: string[];
  analysed: boolean;
  capturedAt: string;
  evidenceSource: NationalEvidenceSourceType;
  verified: false;
}

export interface NationalCompetitorRankingKeyword {
  domain: string;
  keyword: string;
  position: number | null;
  rankingUrl: string | null;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  estimatedTraffic: number | null;
  searchIntent: string | null;
  capturedAt: string;
  sourceEndpoint: string;
  evidenceSource: NationalEvidenceSourceType;
  calculated: false;
}

export interface NationalCompetitorKeywordUniverse {
  domain: string;
  status: "collected" | "empty" | "error";
  lastError: string | null;
  capturedAt: string;
  sourceEndpoint: string;
  cost: number;
  keywords: NationalCompetitorRankingKeyword[];
}

export interface NationalSearchCollectionPlan {
  customerKeywordTasks: number;
  competitorDiscoveryTasks: number;
  competitorKeywordTasks: number;
  maximumPaidRequests: number;
  limits: NationalSearchIntelligenceLimits;
  endpoints: string[];
}

export interface NationalSearchLabsAttempt {
  role: "customer_ranked_keywords" | "competitors_domain" | "competitor_ranked_keywords";
  domain: string | null;
  endpoint: string;
  taskId: string | null;
  taskStatusCode: number | null;
  taskStatusMessage: string | null;
  cost: number | null;
  successful: boolean;
  timedOut?: boolean;
  attemptNumber: number;
  capturedAt: string;
}

export interface NationalSearchIntelligenceSnapshot {
  version: typeof NATIONAL_SEARCH_INTELLIGENCE_VERSION;
  tenantSlug: string;
  businessName: string;
  subjectDomain: string;
  primaryMarket: string;
  country: string;
  growthPlatform: "national";
  capturedAt: string;
  liveExecution: boolean;
  status: NationalSearchIntelligenceStatus;
  lastError: string | null;
  reusedExistingSnapshot: boolean;
  serpLocation: {
    country: string;
    locationCode: number;
  } | null;
  limits: NationalSearchIntelligenceLimits;
  collectionPlan: NationalSearchCollectionPlan;
  endpoints: Array<{ endpoint: string; requests: number; tasks: number; cost: number }>;
  costs: { requests: number; tasks: number; totalCost: number };
  costLedger: NationalIntelligenceCostLedger;
  provenance: NationalIntelligenceEvidenceProvenance;
  authority: NationalEvidenceAuthority;
  customerKeywords: NationalCustomerRankingKeyword[];
  organicCompetitors: NationalOrganicSearchCompetitor[];
  excludedCompetitors: NationalOrganicSearchCompetitor[];
  competitorKeywordUniverses: NationalCompetitorKeywordUniverse[];
  labsAttempts: NationalSearchLabsAttempt[];
  serpAttempts: Array<{
    query: string;
    endpoint: string;
    taskId: string | null;
    taskStatusCode: number | null;
    taskStatusMessage: string | null;
    cost: number | null;
    successful: boolean;
    timedOut?: boolean;
    attemptNumber: number;
    capturedAt: string;
  }>;
  summary: {
    rankingKeywordCount: number;
    top3Count: number;
    top10Count: number;
    top20Count: number;
    top100Count: number;
    rankingPageCount: number;
    availableSearchDemand: number | null;
    organicCompetitorCount: number;
    analysedCompetitorCount: number;
    excludedCompetitorCount: number;
    competitorKeywordCount: number;
    directCompetitorCount: number;
    adjacentCompetitorCount: number;
    strongestRankingPages: Array<{
      url: string;
      keywordCount: number;
      searchDemand: number | null;
      bestPosition: number | null;
    }>;
    top3CountCalculated: true;
    top10CountCalculated: true;
    top20CountCalculated: true;
    top100CountCalculated: true;
    rankingPageCountCalculated: true;
    availableSearchDemandCalculated: true;
  };
  nextStage: {
    title: string;
    detail: string;
    implemented: false;
  };
}
