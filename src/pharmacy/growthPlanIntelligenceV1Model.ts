export const GROWTH_PLAN_STRATEGY_VERSION = 1 as const;

export type GrowthPlanActionType =
  | "SERVICE_PAGE"
  | "SERVICE_HUB"
  | "COMMERCIAL_LANDING_PAGE"
  | "SUPPORTING_GUIDE"
  | "BLOG_ARTICLE"
  | "CONTENT_CLUSTER"
  | "EXISTING_PAGE_IMPROVEMENT"
  | "MARKET_EXPANSION_REVIEW"
  | "NO_ACTION";

export type GrowthPlanActionPriority = "HIGH" | "MEDIUM" | "LOW";

export interface GrowthPlanAction {
  id: string;
  actionType: GrowthPlanActionType;
  title: string;
  primaryKeyword: string;
  supportingKeywords: string[];
  marketScope: string;
  growthPlanRole: string;
  gapEvidenceStatus: string;
  gapConfidence: string;
  priority: GrowthPlanActionPriority;
  actionScore: number;
  searchVolume: number | null;
  combinedSearchDemand: number;
  cpc: number | null;
  competitorCount: number;
  bestCompetitorDomain: string | null;
  bestCompetitorPosition: number | null;
  bestRankingUrl: string | null;
  subjectPosition: number | null;
  subjectRankingUrl: string | null;
  rationale: string;
  evidenceReasons: string[];
  recommendedPageType: string;
  recommendedIntent: string;
  recommendedNextStep: string;
  dependencies: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface GrowthPlanIntelligenceSnapshot {
  version: typeof GROWTH_PLAN_STRATEGY_VERSION;
  generatedAt: string;
  subjectDomain: string;
  market: string;
  intelligenceSourceVersion: string;
  inheritedDataForSeoCost: number;
  summary: {
    totalActions: number;
    highPriorityActions: number;
    mediumPriorityActions: number;
    lowPriorityActions: number;
    primaryCommercialDemand: number;
    supportingDemand: number;
    provenUntappedCount: number;
    insufficientEvidenceCount: number;
  };
  actions: GrowthPlanAction[];
  roadmap: {
    immediate: GrowthPlanAction[];
    next: GrowthPlanAction[];
    later: GrowthPlanAction[];
  };
}
