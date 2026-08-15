/**
 * Growth Engine — Growth Plan Intelligence V1 campaign model.
 */

export const GROWTH_PLAN_INTELLIGENCE_VERSION = 1;

export type CampaignEvidenceSource =
  | "Business Profile"
  | "Website Intelligence"
  | "Local Healthcare Intelligence"
  | "Growth Intelligence"
  | "Generated Content"
  | "Search Console";

export type CampaignPriority = "high" | "medium" | "low";
export type CampaignConfidence = "high" | "medium" | "low";

export interface CampaignEvidence {
  source: CampaignEvidenceSource;
  headline: string;
  detail: string;
}

export interface CampaignEstimatedOutputs {
  servicePage: number;
  clusterPages: number;
  patientGuides: number;
  blogs: number;
  faqs: number;
  gbpPosts: number;
  socialPosts: number;
  emails: number;
  videos: number;
  landingPages: number;
}

export interface CampaignAlternative {
  serviceId: string;
  campaignName: string;
  priority: CampaignPriority;
  confidence: CampaignConfidence;
  reason: string;
  whyNotFirst: string;
  evidenceCount: number;
}

export interface CampaignReadinessItem {
  id: string;
  label: string;
  complete: boolean;
  detail: string;
}

export interface GrowthEngineCampaignRecommendation {
  serviceId: string;
  campaignName: string;
  priority: CampaignPriority;
  confidence: CampaignConfidence;
  reason: string;
  evidence: CampaignEvidence[];
  evidenceSources: CampaignEvidenceSource[];
  estimatedOutputs: CampaignEstimatedOutputs;
  expectedBenefits: string[];
  score: number;
}

export interface GrowthPlanExecutiveSummary {
  currentPosition: string;
  primaryOpportunity: string;
  whyRecommended: string;
  estimatedBusinessBenefit: string;
}

export interface GrowthPlanIntelligence {
  version: number;
  slug: string;
  generatedAt: string;
  executiveSummary: GrowthPlanExecutiveSummary;
  primaryCampaign: GrowthEngineCampaignRecommendation | null;
  alternatives: CampaignAlternative[];
  readiness: CampaignReadinessItem[];
  readyToGenerate: boolean;
}

/** Fixed generator output counts from benchmarkServiceEcosystemBuilder configuration. */
export const BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS = {
  servicePage: 1,
  patientGuides: 1,
  blogs: 3,
  faqs: 1,
  socialPosts: 20,
  gbpPosts: 10,
  emails: 5,
  videos: 1,
  landingPages: 1,
  maxClusterPages: 12,
} as const;

export const CAMPAIGN_EXPECTED_BENEFITS = [
  "Improves local content coverage",
  "Supports Google Business Profile",
  "Creates patient education",
  "Supports local visibility",
  "Strengthens service promotion",
] as const;
