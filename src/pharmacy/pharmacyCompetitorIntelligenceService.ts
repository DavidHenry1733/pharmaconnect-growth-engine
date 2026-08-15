/**
 * Pharmacy Competitor Intelligence — full build pipeline (shared by CLI + API).
 */
import {
  discoverCompetitors,
  loadPharmacyDiscoveryInput,
  writeCompetitorDiscoveryResult,
} from "./pharmacyCompetitorDiscovery.ts";
import {
  buildCompetitorIntelligence,
  writeCompetitorIntelligence,
} from "./pharmacyCompetitorIntelligence.ts";
import {
  runCompetitorGapAnalysis,
  writeGapAnalysis,
} from "./pharmacyCompetitorGapAnalysis.ts";
import {
  generateOpportunities,
  writeOpportunityEngineResult,
} from "./pharmacyOpportunityEngine.ts";

export interface CompetitorIntelligenceBuildResult {
  slug: string;
  generatedAt: string;
  discovery: {
    source: string;
    competitorCount: number;
  };
  intelligence: {
    avgRating: number;
    avgReviewCount: number;
  };
  gapAnalysis: {
    serviceComparisons: number;
    reviewGapLevel: string;
    serviceGapLevel: string;
  };
  opportunities: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  paths: {
    discovery: string;
    intelligence: string;
    gapAnalysis: string;
    opportunity: string;
    dashboard: string;
  };
}

export async function runCompetitorIntelligencePipeline(
  slug: string,
): Promise<CompetitorIntelligenceBuildResult> {
  const input = loadPharmacyDiscoveryInput(slug);

  const discovery = await discoverCompetitors(slug, input);
  const discoveryPath = writeCompetitorDiscoveryResult(discovery);

  const intelligence = await buildCompetitorIntelligence(discovery);
  const intelligencePath = writeCompetitorIntelligence(intelligence);

  const gapAnalysis = runCompetitorGapAnalysis(intelligence);
  const gapPath = writeGapAnalysis(gapAnalysis);

  const opportunities = generateOpportunities(intelligence, gapAnalysis);
  const { opportunityPath, dashboardPath } = writeOpportunityEngineResult(opportunities);

  return {
    slug,
    generatedAt: new Date().toISOString(),
    discovery: {
      source: discovery.source,
      competitorCount: discovery.competitorCount,
    },
    intelligence: {
      avgRating: intelligence.competitorSummary.avgRating,
      avgReviewCount: intelligence.competitorSummary.avgReviewCount,
    },
    gapAnalysis: {
      serviceComparisons: gapAnalysis.serviceCoverage.length,
      reviewGapLevel: gapAnalysis.reviewGap.level,
      serviceGapLevel: gapAnalysis.serviceGap.level,
    },
    opportunities: opportunities.summary,
    paths: {
      discovery: discoveryPath,
      intelligence: intelligencePath,
      gapAnalysis: gapPath,
      opportunity: opportunityPath,
      dashboard: dashboardPath,
    },
  };
}
