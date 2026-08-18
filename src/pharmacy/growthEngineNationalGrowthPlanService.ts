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
  readiness: CampaignReadinessItem[];
  strategyReady: boolean;
  readyToGenerate: false;
  contentGenerationState: "not_implemented";
  generationState: "not_started";
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

function readPlanApproved(slug: string): boolean {
  const file = path.join(WORKSPACE_ROOT, "data/growth-engine", `${safePharmacySlug(slug)}-workflow.json`);
  if (!fs.existsSync(file)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { acknowledgedSteps?: Record<string, string> };
    return Boolean(raw.acknowledgedSteps?.["growth-plan"]);
  } catch {
    return false;
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
  };
}

function buildNationalReadiness(
  searchCollected: boolean,
  gapsLoaded: boolean,
  services: TenantServiceCatalogueEntry[],
  primary: NationalPrimaryRecommendation | null,
  approved: boolean,
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
        ? "Plan acknowledged. National content generation remains blocked."
        : "Approve this Growth Plan before any content generation.",
    },
    {
      id: "national-generation",
      label: "National content generation",
      complete: false,
      detail: "National commercial content generation is not implemented. Strategy recommendation only — patient-service Campaign Builder is not used.",
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
  const approved = readPlanApproved(slug);
  const primaryMarket = resolvePrimaryMarket(slug) || identity.primaryLocation || "United Kingdom";
  const market = "UK Community Pharmacy Digital Growth";
  const searchCollected =
    intelligence.search.status === "collected"
    || intelligence.search.status === "empty"
    || intelligence.search.status === "partial";
  const readiness = buildNationalReadiness(searchCollected, actionable.length > 0, catalogue.services, primary, approved);
  const strategyReady = Boolean(primary);

  const currentPosition = `${identity.businessName} is a national digital-growth provider serving UK community pharmacies. Commercial market: ${primaryMarket} (${market}). Search Intelligence: ${intelligence.search.customerKeywords} ranking keywords, ${intelligence.search.organicCandidates} organic/SERP candidates, ${intelligence.search.qualifiedCommercialCompetitors} qualified commercial competitors.`;

  const executiveSummary = primary
    ? {
        currentPosition,
        primaryOpportunity: primary.title,
        whyRecommended: primary.rationale,
        estimatedBusinessBenefit: `${primary.recommendedIntent}. Evidence class ${primary.evidenceClass}. Generation stays blocked until this plan is approved, and national generation is not implemented.`,
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
    readiness,
    strategyReady,
    readyToGenerate: false,
    contentGenerationState: "not_implemented",
    generationState: "not_started",
    intelligenceLoaded: intelligence.gaps.length > 0,
  };
}
