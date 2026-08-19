/**
 * Growth Plan product resolver — honours existing growthPlatform discriminator.
 * LOCAL keeps the pharmacy campaign engine. NATIONAL uses persisted GP-01 snapshot.
 */
import { isNationalGrowthPlatform, resolveGrowthPlatform } from "./growthPlatformResolverService.ts";
import {
  buildGrowthPlanIntelligence,
  type GrowthPlanIntelligence,
} from "./growthEngineCampaignRecommendationEngine.ts";
import {
  buildNationalGrowthPlanView,
  type NationalGrowthPlanView,
} from "./growthEngineNationalGrowthPlanService.ts";

export type ResolvedGrowthPlan =
  | { platform: "local"; plan: GrowthPlanIntelligence }
  | { platform: "national"; plan: NationalGrowthPlanView };

export function resolveGrowthPlan(slug: string): ResolvedGrowthPlan {
  const resolved = resolveGrowthPlatform(slug);
  if (resolved.platform === "national" || isNationalGrowthPlatform(slug)) {
    return { platform: "national", plan: buildNationalGrowthPlanView(slug) };
  }
  return { platform: "local", plan: buildGrowthPlanIntelligence(slug) };
}
