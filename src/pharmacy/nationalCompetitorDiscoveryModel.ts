/**
 * NC-02 — National Competitor Discovery Model V1
 *
 * NATIONAL Growth Platform only.
 *
 * This model intentionally contains no:
 * - Google Places IDs
 * - latitude / longitude
 * - distance
 * - radius
 * - healthcare-provider proximity
 * - local map ranking
 */

export const COMMERCIAL_DISCOVERY_CANDIDATE_LIMIT = 20;
export const COMMERCIAL_DISCOVERY_SERP_DEPTH = 10;

export type NationalCompetitorDiscoverySource =
  | "search-engine"
  | "organic-overlap"
  | "website-evidence"
  | "business-intelligence"
  | "known-market-competitor"
  | "operator-confirmed";

export type NationalCompetitorQualification =
  | "qualified"
  | "candidate"
  | "rejected";

export interface NationalCompetitorDiscoveryQuery {
  id: string;
  query: string;
  marketCountry: string;
  targetCustomerMarket: string;
  serviceIntent: string;
  evidenceReason: string;
}

export interface NationalCompetitorServiceEvidence {
  service: string;
  evidenceUrl: string;
  evidenceText: string;
  confidence: number;
}

export interface NationalCompetitorDiscoveryCandidate {
  id: string;
  name: string;
  domain: string;
  websiteUrl: string;

  marketCountry: string;
  targetCustomerMarket: string;

  source: NationalCompetitorDiscoverySource;
  sourceQuery: string | null;

  qualification: NationalCompetitorQualification;
  qualificationReasons: string[];
  rejectionReasons: string[];

  serviceEvidence: NationalCompetitorServiceEvidence[];

  title: string | null;
  description: string | null;

  evidenceUrls: string[];
  capturedAt: string;

  role?: string;
  commercialProvider?: boolean;
  targetMarketRelevance?: boolean;
  marketRelevance?: boolean;
  serviceOverlap?: boolean;
  detectedServices?: string[];
  overlappingServices?: string[];
  nonOverlappingServices?: string[];
  discoveryEvidence?: string;
  qualificationReason?: string;
}

export interface NationalCompetitorDiscoveryResult {
  version: 1;
  platform: "national";
  slug: string;
  generatedAt: string;

  marketCountry: string;
  targetCustomerMarket: string;

  queries: NationalCompetitorDiscoveryQuery[];

  candidates: NationalCompetitorDiscoveryCandidate[];
  qualifiedCompetitors: NationalCompetitorDiscoveryCandidate[];
  rejectedCandidates: NationalCompetitorDiscoveryCandidate[];

  source: "national-competitor-discovery-v1";
  status:
    | "draft"
    | "running"
    | "complete"
    | "insufficient-evidence"
    | "failed";

  errors: string[];

  businessName?: string;
  domain?: string;
  businessType?: string;
  marketScope?: string;
  commercialServices?: string[];
  collectionPlan?: Record<string, unknown>;
  rankedKeywordRequests?: number;
  directCommercialCompetitors?: number;
  adjacentCommercialProviders?: number;
  evidenceLimitations?: string[];
  sparseOrganicFootprint?: boolean;
}

export function emptyNationalCompetitorDiscoveryResult(
  slug: string,
  marketCountry = "United Kingdom",
  targetCustomerMarket = "",
): NationalCompetitorDiscoveryResult {
  return {
    version: 1,
    platform: "national",
    slug,
    generatedAt: new Date().toISOString(),

    marketCountry,
    targetCustomerMarket,

    queries: [],

    candidates: [],
    qualifiedCompetitors: [],
    rejectedCandidates: [],

    source: "national-competitor-discovery-v1",
    status: "draft",

    errors: [],
    rankedKeywordRequests: 0,
    directCommercialCompetitors: 0,
    adjacentCommercialProviders: 0,
    evidenceLimitations: [],
    sparseOrganicFootprint: false,
    commercialServices: [],
  };
}
