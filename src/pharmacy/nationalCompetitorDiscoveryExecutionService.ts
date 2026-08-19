/**
 * NC-03C — National Competitor Discovery Execution.
 *
 * Delegates to generic commercial competitor discovery so there is one
 * qualification path: Business Intelligence → bounded SERP discovery
 * evidence → nationalSearchCommercialCompetitorGate.
 */
import { runCommercialCompetitorDiscovery } from "./nationalCommercialCompetitorDiscoveryService.ts";
import type { NationalCompetitorDiscoveryResult } from "./nationalCompetitorDiscoveryModel.ts";

export interface RunNationalCompetitorDiscoveryInput {
  slug: string;
  businessName: string;
  marketCountry: string;
  targetCustomerMarket: string;
  services: string[];
  ownDomains: string[];
}

export async function runNationalCompetitorDiscovery(
  input: RunNationalCompetitorDiscoveryInput,
): Promise<NationalCompetitorDiscoveryResult> {
  return runCommercialCompetitorDiscovery({
    slug: input.slug,
    live: true,
    persist: true,
  });
}
