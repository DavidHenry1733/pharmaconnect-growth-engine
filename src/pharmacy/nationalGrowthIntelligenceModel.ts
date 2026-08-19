/**
 * National Growth Intelligence Model V1
 *
 * NATIONAL counterpart to the Local Growth Engine opportunity layer.
 *
 * Opportunities must be evidence-backed.
 * Unknown metrics remain unknown.
 * No fabricated search volume, traffic, enquiries or rankings.
 */

export const NATIONAL_GROWTH_INTELLIGENCE_VERSION = 1 as const;

export type NationalGrowthPriority = "high" | "medium" | "later";

export type NationalGrowthOpportunityCategory =
  | "service"
  | "content"
  | "search"
  | "positioning"
  | "authority"
  | "conversion"
  | "offer"
  | "trust"
  | "technical";

export interface NationalGrowthOpportunity {
  opportunityId: string;

  category: NationalGrowthOpportunityCategory;

  priority: NationalGrowthPriority;

  title: string;
  description: string;

  currentState: string;
  competitorState: string;

  evidence: string[];

  recommendedAction: string;

  expectedOutcome: string;

  confidence: "high" | "medium" | "low" | "unknown";
}

export interface NationalGrowthRoadmap {
  high: NationalGrowthOpportunity[];
  medium: NationalGrowthOpportunity[];
  later: NationalGrowthOpportunity[];
}

export interface NationalGrowthIntelligenceSnapshot {
  version: typeof NATIONAL_GROWTH_INTELLIGENCE_VERSION;

  slug: string;

  growthPlatform: "national";

  generatedAt: string;

  opportunities: NationalGrowthOpportunity[];

  roadmap: NationalGrowthRoadmap;

  evidence: string[];

  status:
    | "draft"
    | "analysis_complete"
    | "ready_for_review";
}

export function emptyNationalGrowthIntelligenceSnapshot(
  slug: string,
): NationalGrowthIntelligenceSnapshot {
  return {
    version: NATIONAL_GROWTH_INTELLIGENCE_VERSION,

    slug,

    growthPlatform: "national",

    generatedAt: new Date().toISOString(),

    opportunities: [],

    roadmap: {
      high: [],
      medium: [],
      later: [],
    },

    evidence: [],

    status: "draft",
  };
}

/** Canonical national gap types. COMPETITOR_GAP is only emitted when competitor keyword evidence exists. */
export type NationalGapType =
  | "MISSING_SERVICE_PAGE"
  | "WEAK_SERVICE_COVERAGE"
  | "KEYWORD_VISIBILITY_GAP"
  | "CONTENT_DEPTH_GAP"
  | "WEBSITE_STRUCTURE_GAP"
  | "LOCAL_VISIBILITY_GAP"
  | "SERP_OPPORTUNITY"
  | "COMPETITOR_GAP"
  | "INSUFFICIENT_COMPETITOR_EVIDENCE";

export type NationalEvidenceClass =
  | "PROVEN_GAP"
  | "SUPPORTED_OPPORTUNITY"
  | "INSUFFICIENT_COMPETITOR_EVIDENCE";

export interface NationalGapProvenance {
  evidenceSource: string;
  authority: string;
  sourceSystem: string;
  capturedAt: string | null;
}

export interface NationalGrowthGap {
  id: string;
  type: NationalGapType;
  evidenceClass: NationalEvidenceClass;
  source: string;
  currentState: string;
  evidence: string[];
  whyItMatters: string;
  recommendedAction: string;
  commercialService: string | null;
  commercialServiceId: string | null;
  priority: "HIGH" | "MEDIUM" | "LOW";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  provenance: NationalGapProvenance;
  competitorGap: boolean;
  recommendedPageType: string;
  actionable: boolean;
}

export interface NationalSearchEvidenceSummary {
  status: string;
  customerKeywords: number;
  organicCandidates: number;
  qualifiedCommercialCompetitors: number;
  paidCompetitorExpansions: number;
  sparse: boolean;
  sparseThreshold: number;
  evidenceSource: string;
  authority: string;
  capturedAt: string | null;
}

export interface NationalWebsiteEvidenceSummary {
  complete: boolean;
  totalPages: number;
  servicePages: number;
  source: string;
  configuredCommercialPages: number;
}

export interface NationalGrowthIntelligenceReport {
  version: typeof NATIONAL_GROWTH_INTELLIGENCE_VERSION;
  slug: string;
  growthPlatform: "national";
  generatedAt: string;
  status: "analysis_complete" | "draft";
  businessName: string;
  subjectDomain: string;
  primaryMarket: string;
  commercialServices: Array<{ serviceId: string; serviceName: string; href?: string }>;
  search: NationalSearchEvidenceSummary;
  website: NationalWebsiteEvidenceSummary;
  gaps: NationalGrowthGap[];
  limitations: string[];
  competitorGapsFabricated: false;
}
