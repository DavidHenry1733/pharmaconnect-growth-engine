#!/usr/bin/env npx tsx
/**
 * One controlled Checkpoint 02 live discovery run.
 * Prints the collection plan first. Ranked-keyword expansion is never called.
 */
import {
  buildCommercialCompetitorDiscoveryPlan,
  runCommercialCompetitorDiscovery,
} from "../src/pharmacy/nationalCommercialCompetitorDiscoveryService.ts";

const slug = process.argv[2] || "pharmaconnect";
const live = process.argv.includes("--live");
const plan = buildCommercialCompetitorDiscoveryPlan(slug);
console.log("COMMERCIAL_COMPETITOR_DISCOVERY_PLAN");
console.log(JSON.stringify(plan, null, 2));
console.log("COMPETITOR_RANKED_KEYWORD_REQUESTS=0");
if (!live) {
  console.log("LIVE=NO — plan only. Pass --live for one bounded SERP discovery run.");
  process.exit(0);
}
const result = await runCommercialCompetitorDiscovery({ slug, live: true, persist: true });
console.log(`DISCOVERY_STATUS=${result.status}`);
console.log(`CANDIDATES_DISCOVERED=${result.candidates.length}`);
console.log(`DIRECT_COMMERCIAL_COMPETITORS=${result.directCommercialCompetitors}`);
console.log(`ADJACENT_COMMERCIAL_PROVIDERS=${result.adjacentCommercialProviders}`);
console.log(`COMPETITOR_RANKED_KEYWORD_REQUESTS=${result.rankedKeywordRequests ?? 0}`);
for (const row of result.candidates) {
  console.log(`DOMAIN=${row.domain}`);
  console.log(`CLASSIFICATION=${row.role || ""}`);
  console.log(`DISCOVERY_SOURCE=${row.source}`);
  console.log(`TARGET_MARKET_RELEVANCE=${row.targetMarketRelevance ? "YES" : "NO"}`);
  console.log(`COMMERCIAL_PROVIDER=${row.commercialProvider ? "YES" : "NO"}`);
  console.log(`DETECTED_SERVICES=${(row.detectedServices || []).join(", ")}`);
  console.log(`OVERLAPPING_SERVICES=${(row.overlappingServices || []).join(", ")}`);
  console.log(`MARKET_RELEVANCE=${row.marketRelevance ? "YES" : "NO"}`);
  console.log(`QUALIFIED=${row.qualification === "qualified" ? "YES" : "NO"}`);
  console.log(`REASON=${row.qualificationReason || row.qualificationReasons[0] || ""}`);
}
