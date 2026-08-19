#!/usr/bin/env npx tsx
/**
 * One controlled Checkpoint 02 live discovery run.
 * Prints the collection plan first. Ranked-keyword expansion is never called.
 */
import * as discoveryMod from "../src/pharmacy/nationalCommercialCompetitorDiscoveryService.ts";
import * as storageMod from "../src/pharmacy/nationalCompetitorDiscoveryStorageService.ts";

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const { buildCommercialCompetitorDiscoveryPlan, runCommercialCompetitorDiscovery } = exported(discoveryMod);
const {
  COMMERCIAL_DISCOVERY_FIXTURE_VALIDATION_DOMAINS,
  isExampleTldDomain,
} = exported(storageMod);

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
const namedFixtureInReal = (result.candidates || []).filter((row) => {
  const domain = String(row.domain || "").toLowerCase();
  return (COMMERCIAL_DISCOVERY_FIXTURE_VALIDATION_DOMAINS as readonly string[]).includes(domain)
    && !isExampleTldDomain(domain);
});
console.log(`REAL_DISCOVERY_STATUS=${result.status}`);
console.log(`REAL_DISCOVERY_PROVIDER=${result.discoveryProvider || ""}`);
console.log(`REAL_DISCOVERY_QUERIES=${result.queries.map((row) => row.query).join(" | ")}`);
console.log(`REAL_CANDIDATES_DISCOVERED=${result.candidates.length}`);
console.log(`REAL_DIRECT_COMMERCIAL_COMPETITORS=${result.directCommercialCompetitors ?? 0}`);
console.log(`REAL_ADJACENT_COMMERCIAL_PROVIDERS=${result.adjacentCommercialProviders ?? 0}`);
console.log(`REAL_REJECTED_CANDIDATES=${result.rejectedCandidates.length}`);
console.log(`EVIDENCE_KIND=${result.evidenceKind || ""}`);
console.log(`SERP_REQUEST_COUNT=${result.serpRequestCount ?? 0}`);
console.log(`SERP_COST=${result.serpCost ?? 0}`);
console.log(`FIXTURE_DOMAINS_PRESENT_IN_REAL_DISCOVERY=${namedFixtureInReal.length ? "YES" : "NO"}`);
console.log("COMPETITOR_RANKED_KEYWORD_REQUESTS=0");
for (const row of result.candidates) {
  console.log(`DOMAIN=${row.domain}`);
  console.log(`DISCOVERY_SOURCE=${row.source}`);
  console.log(`CLASSIFICATION=${row.role || ""}`);
  console.log(`TARGET_MARKET_RELEVANCE=${row.targetMarketRelevance ? "YES" : "NO"}`);
  console.log(`COMMERCIAL_PROVIDER=${row.commercialProvider ? "YES" : "NO"}`);
  console.log(`DETECTED_SERVICES=${(row.detectedServices || []).join(", ")}`);
  console.log(`OVERLAPPING_SERVICES=${(row.overlappingServices || []).join(", ")}`);
  console.log(`MARKET_RELEVANCE=${row.marketRelevance ? "YES" : "NO"}`);
  console.log(`QUALIFIED=${row.qualification === "qualified" && row.role === "commercial_competitor" ? "YES" : "NO"}`);
  console.log(`REASON=${row.qualificationReason || row.qualificationReasons[0] || ""}`);
}
