/**
 * National Growth Plan — consumes canonical Growth Intelligence / gap evidence.
 * Does not call DataForSEO, Google Places, or GSC.
 * Does not use the local pharmacy campaign recommendation engine.
 * Does not generate content.
 */
import fs from "node:fs";
import path from "node:path";

import type { CampaignReadinessItem } from "./growthEngineCampaignModel.ts";
import { resolveTenantServiceCatalogue, type TenantServiceCatalogueEntry } from "./growthEngineTenantServiceCatalogue.ts";
import { resolveGrowthPlatform } from "./growthPlatformResolverService.ts";
import { resolvePrimaryMarket } from "./masterAdminMarketScopeService.ts";
import {
  actionableNationalGaps,
  buildNationalGrowthIntelligence,
} from "./nationalGrowthIntelligenceService.ts";
import type { NationalGrowthGap, NationalSearchEvidenceSummary } from "./nationalGrowthIntelligenceModel.ts";
import { getPharmacyProjectConfigPath, safePharmacySlug, WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import type { ApprovedGrowthPlanSnapshot } from "./nationalApprovedPlanContract.ts";
import { contentPackageGenerated } from "./pharmacyContentPackageService.ts";

export interface NationalPrimaryRecommendation {
  actionId: string;
  gapId: string;
  actionType: string;
  title: string;
  primaryKeyword: string;
  supportingKeywords: string[];
  combinedSearchDemand: number;
  searchVolume: number | null;
  priority: string;
  actionScore: number;
  marketScope: string;
  growthPlanRole: string;
  gapEvidenceStatus: string;
  gapConfidence: string;
  confidence: string;
  competitorCount: number;
  bestCompetitorDomain: string | null;
  bestCompetitorPosition: number | null;
  bestRankingUrl: string | null;
  rationale: string;
  evidenceReasons: string[];
  recommendedPageType: string;
  recommendedIntent: string;
  recommendedNextStep: string;
  commercialService: string | null;
  evidenceClass: string;
  type: string;
  source: string;
  provenance: string;
}

export interface NationalPlanPriority {
  gapId: string;
  recommendation: string;
  evidence: string[];
  commercialObjective: string;
  action: string;
  priority: string;
  confidence: string;
  evidenceClass: string;
  type: string;
  source: string;
  provenance: string;
  commercialService: string | null;
  recommendedPageType?: string;
}

export interface NationalGrowthPlanView {
  platform: "national";
  slug: string;
  generatedAt: string;
  subjectDomain: string;
  market: string;
  primaryMarket: string;
  businessName: string;
  commercialServices: TenantServiceCatalogueEntry[];
  executiveSummary: {
    currentPosition: string;
    primaryOpportunity: string;
    whyRecommended: string;
    estimatedBusinessBenefit: string;
  };
  primary: NationalPrimaryRecommendation | null;
  alternatives: NationalPrimaryRecommendation[];
  priorities: NationalPlanPriority[];
  limitations: string[];
  search: NationalSearchEvidenceSummary;
  gapsConsumed: true;
  planApproved: boolean;
  approvedPlan: ApprovedGrowthPlanSnapshot | null;
  readiness: CampaignReadinessItem[];
  strategyReady: boolean;
  readyToGenerate: boolean;
  contentGenerationState: "blocked" | "ready" | "generated";
  generationState: "not_started" | "approved" | "ready_for_review";
  intelligenceLoaded: boolean;
}

function readProjectIdentity(slug: string): { businessName: string; primaryLocation: string } {
  const file = getPharmacyProjectConfigPath(safePharmacySlug(slug));
  if (!fs.existsSync(file)) {
    return { businessName: slug, primaryLocation: "United Kingdom" };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    return {
      businessName: String(raw.businessName || raw.legalName || slug),
      primaryLocation: String(raw.primaryLocation || "United Kingdom"),
    };
  } catch {
    return { businessName: slug, primaryLocation: "United Kingdom" };
  }
}

function readWorkflowApproval(slug: string): { planApproved: boolean; approvedPlan: ApprovedGrowthPlanSnapshot | null } {
  const file = path.join(WORKSPACE_ROOT, "data/growth-engine", `${safePharmacySlug(slug)}-workflow.json`);
  if (!fs.existsSync(file)) return { planApproved: false, approvedPlan: null };
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      acknowledgedSteps?: Record<string, string>;
      approvedPlan?: ApprovedGrowthPlanSnapshot;
    };
    const planApproved = Boolean(raw.acknowledgedSteps?.["growth-plan"]);
    const approvedPlan =
      planApproved && raw.approvedPlan && Array.isArray(raw.approvedPlan.items) ? raw.approvedPlan : null;
    return { planApproved, approvedPlan };
  } catch {
    return { planApproved: false, approvedPlan: null };
  }
}

function gapEvidenceStatus(item: NationalGrowthGap): string {
  if (item.evidenceClass === "PROVEN_GAP") {
    return item.type === "KEYWORD_VISIBILITY_GAP" ? "PROVEN_WEAK_COVERAGE" : "PROVEN_UNTAPPED";
  }
  if (item.evidenceClass === "INSUFFICIENT_COMPETITOR_EVIDENCE" || item.type === "INSUFFICIENT_COMPETITOR_EVIDENCE") {
    return "INSUFFICIENT_EVIDENCE";
  }
  return "NEW_MARKET_EVIDENCE";
}

function toRecommendation(item: NationalGrowthGap): NationalPrimaryRecommendation {
  return {
    actionId: item.id,
    gapId: item.id,
    actionType: item.recommendedPageType.replace(/\s+/g, "_"),
    title: item.recommendedAction,
    primaryKeyword: item.commercialService || item.type.replace(/_/g, " ").toLowerCase(),
    supportingKeywords: [],
    combinedSearchDemand: 0,
    searchVolume: null,
    priority: item.priority,
    actionScore: item.priority === "HIGH" ? 80 : item.priority === "MEDIUM" ? 55 : 30,
    marketScope: "CORE",
    growthPlanRole: "PRIMARY_COMMERCIAL",
    gapEvidenceStatus: gapEvidenceStatus(item),
    gapConfidence: item.confidence,
    confidence: item.confidence,
    competitorCount: item.competitorGap ? 1 : 0,
    bestCompetitorDomain: null,
    bestCompetitorPosition: null,
    bestRankingUrl: null,
    rationale: item.whyItMatters,
    evidenceReasons: item.evidence,
    recommendedPageType: item.recommendedPageType,
    recommendedIntent: item.commercialService ? `Strengthen ${item.commercialService}` : "Strengthen commercial visibility",
    recommendedNextStep: item.recommendedAction,
    commercialService: item.commercialService,
    evidenceClass: item.evidenceClass,
    type: item.type,
    source: item.source,
    provenance: `${item.provenance.evidenceSource} · ${item.provenance.authority} · ${item.provenance.sourceSystem}`,
  };
}

function toPriority(item: NationalGrowthGap): NationalPlanPriority {
  return {
    gapId: item.id,
    recommendation: item.recommendedAction,
    evidence: item.evidence,
    commercialObjective: item.commercialService
      ? `Support ${item.commercialService}`
      : "Strengthen national digital-growth visibility",
    action: item.recommendedAction,
    priority: item.priority,
    confidence: item.confidence,
    evidenceClass: item.evidenceClass,
    type: item.type,
    source: item.source,
    provenance: `${item.provenance.evidenceSource} · ${item.provenance.authority}`,
    commercialService: item.commercialService,
    recommendedPageType: item.recommendedPageType,
  };
}

function buildNationalReadiness(
  searchCollected: boolean,
  gapsLoaded: boolean,
  services: TenantServiceCatalogueEntry[],
  primary: NationalPrimaryRecommendation | null,
  approved: boolean,
  generated: boolean,
): CampaignReadinessItem[] {
  return [
    {
      id: "search-intelligence",
      label: "Search Intelligence collected",
      complete: searchCollected,
      detail: searchCollected
        ? "Current Search Intelligence snapshot is collected and feeds Growth Intelligence."
        : "Collect Search Intelligence before treating the Growth Plan as evidence-led.",
    },
    {
      id: "growth-intelligence-gaps",
      label: "Growth Intelligence gaps connected",
      complete: gapsLoaded,
      detail: gapsLoaded
        ? "Growth Plan recommendations are selected from Growth Intelligence gaps."
        : "No actionable Growth Intelligence gaps are available.",
    },
    {
      id: "national-market",
      label: "National market intelligence",
      complete: true,
      detail: "Local Google Places / Your Local Market is not a prerequisite for the national Growth Plan.",
    },
    {
      id: "commercial-services",
      label: "Commercial services configured",
      complete: services.length > 0,
      detail: services.length
        ? services.map((s) => s.serviceName).join(", ")
        : "No project commercial services configured",
    },
    {
      id: "eligible-action",
      label: "Eligible national recommendation",
      complete: Boolean(primary),
      detail: primary
        ? `${primary.title} · ${primary.evidenceClass} · gap ${primary.gapEvidenceStatus}/${primary.gapConfidence}`
        : "No evidence-backed national gap is ready for a recommendation",
    },
    {
      id: "plan-approval",
      label: "Growth Plan approved",
      complete: approved,
      detail: approved
        ? "Plan acknowledged. Approved items are the only generation inputs."
        : "Approve this Growth Plan before any content generation.",
    },
    {
      id: "national-generation",
      label: "National content generation",
      complete: generated,
      detail: generated
        ? "Approved Growth Plan drafts are ready for review and are not published."
        : approved
          ? "Create up to 3 drafts from approved Growth Plan items. Patient-service Campaign Builder is not used."
          : "Generation stays blocked until this Growth Plan is approved.",
    },
  ];
}

export function buildNationalGrowthPlanView(slug: string): NationalGrowthPlanView {
  const platform = resolveGrowthPlatform(slug);
  if (platform.platform !== "national") {
    throw new Error(`National Growth Plan is not applicable to ${slug}; platform=${platform.platform}`);
  }

  const identity = readProjectIdentity(slug);
  const catalogue = resolveTenantServiceCatalogue(slug);
  const intelligence = buildNationalGrowthIntelligence(slug);
  const actionable = actionableNationalGaps(intelligence);
  const primaryGap = actionable[0] || null;
  const primary = primaryGap ? toRecommendation(primaryGap) : null;
  const alternatives = actionable.slice(1, 4).map(toRecommendation);
  const priorities = actionable.map(toPriority);
  const { planApproved: approved, approvedPlan } = readWorkflowApproval(slug);
  const generated = contentPackageGenerated(slug, "approved-growth-plan");
  const readyToGenerate = approved && Boolean(approvedPlan?.items.length);
  const contentGenerationState: NationalGrowthPlanView["contentGenerationState"] = generated
    ? "generated"
    : readyToGenerate
      ? "ready"
      : "blocked";
  const generationState: NationalGrowthPlanView["generationState"] = generated
    ? "ready_for_review"
    : approved
      ? "approved"
      : "not_started";
  const primaryMarket = resolvePrimaryMarket(slug) || identity.primaryLocation || "United Kingdom";
  const market = "UK Community Pharmacy Digital Growth";
  const searchCollected =
    intelligence.search.status === "collected"
    || intelligence.search.status === "empty"
    || intelligence.search.status === "partial";
  const readiness = buildNationalReadiness(
    searchCollected,
    actionable.length > 0,
    catalogue.services,
    primary,
    approved,
    generated,
  );
  const strategyReady = Boolean(primary);

  const currentPosition = `${identity.businessName} is a national digital-growth provider serving UK community pharmacies. Commercial market: ${primaryMarket} (${market}). Search Intelligence: ${intelligence.search.customerKeywords} ranking keywords, ${intelligence.search.organicCandidates} organic/SERP candidates, ${intelligence.search.qualifiedCommercialCompetitors} qualified commercial competitors.`;

  const executiveSummary = primary
    ? {
        currentPosition,
        primaryOpportunity: primary.title,
        whyRecommended: primary.rationale,
        estimatedBusinessBenefit: `${primary.recommendedIntent}. Evidence class ${primary.evidenceClass}. Generation stays blocked until this plan is approved.`,
      }
    : {
        currentPosition,
        primaryOpportunity: "No evidence-backed national action yet",
        whyRecommended:
          "The national plan only recommends actions taken from Growth Intelligence gaps. It does not jump from keywords to content.",
        estimatedBusinessBenefit: "Complete Search Intelligence and gap review before treating a recommendation as ready.",
      };

  return {
    platform: "national",
    slug: safePharmacySlug(slug),
    generatedAt: intelligence.generatedAt,
    subjectDomain: intelligence.subjectDomain,
    market,
    primaryMarket,
    businessName: identity.businessName,
    commercialServices: catalogue.services,
    executiveSummary,
    primary,
    alternatives,
    priorities,
    limitations: intelligence.limitations,
    search: intelligence.search,
    gapsConsumed: true,
    planApproved: approved,
    approvedPlan,
    readiness,
    strategyReady,
    readyToGenerate,
    contentGenerationState,
    generationState,
    intelligenceLoaded: intelligence.gaps.length > 0,
  };
}
