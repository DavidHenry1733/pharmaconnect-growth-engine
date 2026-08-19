#!/usr/bin/env npx tsx
/**
 * Checkpoint 02 — generic commercial competitor discovery.
 * No live DataForSEO, Places, GSC, ranked-keyword expansion, or publish.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as discoveryService from "../src/pharmacy/nationalCommercialCompetitorDiscoveryService.ts";
import * as queryService from "../src/pharmacy/nationalCompetitorDiscoveryQueryService.ts";
import * as pageMod from "../src/pharmacy/nationalSearchIntelligencePage.ts";
import * as biMod from "../src/pharmacy/growthEngineNationalBusinessIntelligenceService.ts";
import * as storageMod from "../src/pharmacy/nationalCompetitorDiscoveryStorageService.ts";
import * as catalogueMod from "../src/pharmacy/growthEngineTenantServiceCatalogue.ts";

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const originalFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  fetchCalls += 1;
  throw new Error(`Checkpoint 02 validator blocked fetch: ${String(input)}`);
}) as typeof fetch;

const checks: Array<{ id: string; pass: boolean; detail: string }> = [];
function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const {
  buildCommercialCompetitorDiscoveryPlan,
  qualifyInjectedCommercialCandidates,
  runCommercialCompetitorDiscovery,
} = exported(discoveryService);
const { buildNationalCompetitorDiscoveryQueries } = exported(queryService);
const { renderNationalSearchIntelligencePage } = exported(pageMod);
const { buildNationalBusinessIntelligenceView } = exported(biMod);
const { writeNationalCompetitorDiscovery, nationalCompetitorDiscoveryPath } = exported(storageMod);
const { resolveTenantServiceCatalogue } = exported(catalogueMod);

console.log("\n=== CHECKPOINT 02 COMMERCIAL COMPETITOR DISCOVERY ===\n");

const discoverySrc = read("src/pharmacy/nationalCommercialCompetitorDiscoveryService.ts");
const querySrc = read("src/pharmacy/nationalCompetitorDiscoveryQueryService.ts");
record(
  "no-pharmaconnect-hardcode",
  !discoverySrc.includes('slug === "pharmaconnect"') &&
    !discoverySrc.includes("pharmaconnect.uk") &&
    !querySrc.includes("pharmaconnect.uk") &&
    !querySrc.includes("pharmacy marketing agency") &&
    !querySrc.includes("digital marketing services for pharmacies"),
  "generic discovery/query sources",
);
record(
  "no-competitor-domain-whitelist",
  !/boots\.com|nymopmr|surveyfocus|pharmacymentor|rxweb|chemist2u/.test(discoverySrc + querySrc),
  "no competitor domain whitelist",
);
record(
  "reuses-commercial-gate",
  discoverySrc.includes("assessNationalSearchCommercialCompetitor") &&
    discoverySrc.includes("buildNationalBusinessIntelligenceView") &&
    discoverySrc.includes("rankedKeywordRequests: COMMERCIAL_DISCOVERY_RANKED_KEYWORD_REQUESTS"),
  "BI + commercial gate reused",
);

const genericTenant = "cp02-generic-national";
const tenantFile = path.join(ROOT, "config/projects", `${genericTenant}.json`);
fs.writeFileSync(tenantFile, JSON.stringify({
  clientSlug: genericTenant,
  businessName: "Northwind Digital",
  domain: "https://northwind-digital.example",
  growthPlatform: "national",
  primaryLocation: "United Kingdom",
  country: "United Kingdom",
  strapline: "Software for independent grocers",
  businessType: "agency",
  services: ["Website Design", "Local SEO", "Email Marketing"],
}, null, 2) + "\n");

const plan = buildCommercialCompetitorDiscoveryPlan(genericTenant);
record("bi-feeds-discovery-plan", plan.businessName === "Northwind Digital" && plan.domain.includes("northwind-digital.example"), `${plan.businessName}/${plan.domain}`);
record("target-customer-used", /grocers/i.test(plan.targetCustomerMarket) && plan.queries.some((q) => /grocers/i.test(q)), plan.targetCustomerMarket);
record("commercial-services-used", plan.commercialServices.includes("Website Design") && plan.queries.some((q) => /website design/i.test(q)), plan.commercialServices.join("|"));
record("market-used", plan.country === "United Kingdom" && plan.queries.every((q) => /united kingdom/i.test(q)), plan.country);
record("candidate-limit-20", plan.maxCandidates === 20, String(plan.maxCandidates));
record("ranked-keyword-requests-plan-0", plan.rankedKeywordRequests === 0, String(plan.rankedKeywordRequests));
record("organic-overlap-not-proof", plan.organicOverlapIsCommercialProof === false, "false");
record("sparse-does-not-block-plan", plan.sparseOrganicFootprintDoesNotBlockDiscovery === true, "true");

const genericQueries = buildNationalCompetitorDiscoveryQueries({
  businessName: "Northwind Digital",
  marketCountry: "United Kingdom",
  targetCustomerMarket: "Software for independent grocers",
  services: ["Website Design", "Local SEO"],
});
record(
  "queries-not-pharmacy-hardcoded",
  genericQueries.every((q) => !/for pharmacies/i.test(q.query)) && genericQueries.some((q) => /grocers/i.test(q.query)),
  genericQueries.map((q) => q.query).join(" | "),
);

const agencyText = "We are a UK digital agency for community pharmacies. We provide pharmacy website design, local SEO, email marketing, website hosting and growth audits. We work with pharmacy businesses across the United Kingdom. Our services help pharmacy owners. Contact us to get started.";
const retailerText = "Boots is a health and beauty retailer. Add to basket. Store locator. Our stores. Shop now. Buy online. Repeat prescription. We dispense medicines and health products. Opening hours.";
const publisherText = "Pharmacy Magazine is the leading trade press publication. Read the latest issue. Editorial team. Subscribe to our magazine. Newsroom.";
const professionalText = "The Royal College is a professional body. Membership benefits. Become a member. Professional standards. Register of members. Faculty of pharmacy.";
const educationText = "Elsevier ScienceDirect hosts peer-reviewed scientific journal articles and academic research. DOI: 10.0000/example. Open access articles and textbook chapters.";
const pmrText = "We provide PMR and dispensing software for community pharmacies. Prescription management, stock management and pharmacy operations. Our platform helps pharmacy owners across the United Kingdom. Contact us to get started.";
const overlapOnlyText = "";
const broadText = "We are a digital marketing growth service online for pharmacy business websites.";

const pcPlan = buildCommercialCompetitorDiscoveryPlan("pharmaconnect");
record("pharmaconnect-bi-consumed", pcPlan.businessName === "PharmaConnect" && pcPlan.commercialServices.length === 5, `${pcPlan.businessName} services=${pcPlan.commercialServices.length}`);

const result = qualifyInjectedCommercialCandidates("pharmaconnect", [
  { domain: "pharmacy-digital-agency.co.uk", name: "Pharmacy Digital Agency", websiteText: agencyText, discoverySource: "search-engine", discoveryEvidence: "SERP discovery from tenant services/market queries." },
  { domain: "retail-pharmacy-chain.co.uk", name: "Retail Chain", websiteText: retailerText, discoverySource: "search-engine", discoveryEvidence: "SERP discovery." },
  { domain: "pharmacy-trade-press.co.uk", name: "Trade Press", websiteText: publisherText, discoverySource: "search-engine", discoveryEvidence: "SERP discovery." },
  { domain: "royal-college.example", name: "Royal College", websiteText: professionalText, discoverySource: "search-engine", discoveryEvidence: "SERP discovery." },
  { domain: "scientific-articles.example", name: "Science Journal", websiteText: educationText, discoverySource: "search-engine", discoveryEvidence: "SERP discovery." },
  { domain: "pharmacy-pmr-software.co.uk", name: "PMR Vendor", websiteText: pmrText, discoverySource: "search-engine", discoveryEvidence: "SERP discovery." },
  { domain: "high-authority-overlap.example", name: "Overlap Only", websiteText: overlapOnlyText, discoverySource: "organic-overlap", discoveryEvidence: "Organic overlap only.", sharedKeywordCount: 90 },
  { domain: "broad-vocab.example", name: "Broad Vocab", websiteText: broadText, discoverySource: "search-engine", discoveryEvidence: "Broad vocabulary only." },
]);

const discoveryFile = nationalCompetitorDiscoveryPath("pharmaconnect");
const previousDiscovery = fs.existsSync(discoveryFile) ? fs.readFileSync(discoveryFile, "utf8") : null;
writeNationalCompetitorDiscovery(result);

const byDomain = Object.fromEntries(result.candidates.map((row) => [row.domain, row]));
record("sparse-new-business-discovers-candidates", result.candidates.length >= 7 && result.status === "complete", `status=${result.status} n=${result.candidates.length} sparse=${result.sparseOrganicFootprint}`);
record("max-candidates-enforced", result.candidates.length <= 20, String(result.candidates.length));
record("ranked-keyword-requests-0", (result.rankedKeywordRequests ?? 0) === 0, String(result.rankedKeywordRequests));
record(
  "agency-qualifies",
  byDomain["pharmacy-digital-agency.co.uk"]?.qualification === "qualified" &&
    byDomain["pharmacy-digital-agency.co.uk"]?.role === "commercial_competitor",
  `${byDomain["pharmacy-digital-agency.co.uk"]?.role}/${byDomain["pharmacy-digital-agency.co.uk"]?.qualification}`,
);
record(
  "customer-market-rejected",
  byDomain["retail-pharmacy-chain.co.uk"]?.role === "customer_market" &&
    byDomain["retail-pharmacy-chain.co.uk"]?.qualification !== "qualified",
  byDomain["retail-pharmacy-chain.co.uk"]?.role || "missing",
);
record(
  "publisher-rejected",
  byDomain["pharmacy-trade-press.co.uk"]?.role === "publisher" &&
    byDomain["pharmacy-trade-press.co.uk"]?.qualification !== "qualified",
  byDomain["pharmacy-trade-press.co.uk"]?.role || "missing",
);
record(
  "professional-body-rejected",
  byDomain["royal-college.example"]?.role === "professional_body" &&
    byDomain["royal-college.example"]?.qualification !== "qualified",
  byDomain["royal-college.example"]?.role || "missing",
);
record(
  "education-rejected",
  byDomain["scientific-articles.example"]?.role === "education_academic" &&
    byDomain["scientific-articles.example"]?.qualification !== "qualified",
  byDomain["scientific-articles.example"]?.role || "missing",
);
record(
  "adjacent-pmr-not-direct",
  byDomain["pharmacy-pmr-software.co.uk"]?.role === "adjacent_commercial_provider" &&
    byDomain["pharmacy-pmr-software.co.uk"]?.qualification !== "qualified",
  byDomain["pharmacy-pmr-software.co.uk"]?.role || "missing",
);
record(
  "organic-overlap-cannot-qualify",
  byDomain["high-authority-overlap.example"]?.qualification !== "qualified" &&
    (byDomain["high-authority-overlap.example"]?.role === "serp_content_competitor" ||
      byDomain["high-authority-overlap.example"]?.role === "insufficient_evidence"),
  byDomain["high-authority-overlap.example"]?.role || "missing",
);
record(
  "broad-vocab-cannot-overlap",
  byDomain["broad-vocab.example"]?.qualification !== "qualified" &&
    byDomain["broad-vocab.example"]?.serviceOverlap !== true,
  `overlap=${byDomain["broad-vocab.example"]?.serviceOverlap} role=${byDomain["broad-vocab.example"]?.role}`,
);
record(
  "rejected-cannot-become-direct",
  result.candidates.filter((row) => row.qualification !== "qualified").every((row) => row.role !== "commercial_competitor"),
  "rejected stay non-direct",
);
record("provenance-survives", result.candidates.every((row) => Boolean(row.source && (row.discoveryEvidence || row.sourceQuery))), "source+evidence");
record("direct-count", (result.directCommercialCompetitors || 0) >= 1, String(result.directCommercialCompetitors));
record("adjacent-count", (result.adjacentCommercialProviders || 0) >= 1, String(result.adjacentCommercialProviders));

const html = renderNationalSearchIntelligencePage("pharmaconnect");
record(
  "browser-classification-visible",
  /data-cp02-page="commercial-competitor-discovery"/.test(html) &&
    html.includes("pharmacy-digital-agency.co.uk") &&
    html.includes("Classification:") &&
    html.includes("Qualification:") &&
    html.includes("Commercial provider:") &&
    html.includes("Material overlapping services"),
  "commercial discovery panel",
);
record("browser-ranked-keywords-zero", html.includes("COMPETITOR_RANKED_KEYWORD_REQUESTS=0"), "ranked keywords 0");

const overlapOnlyRun = await runCommercialCompetitorDiscovery({
  slug: "pharmaconnect",
  live: false,
  persist: false,
  injectedCandidates: [
    { domain: "high-authority-overlap.example", websiteText: "", discoverySource: "organic-overlap", sharedKeywordCount: 80 },
  ],
});
record(
  "organic-overlap-injected-does-not-qualify",
  overlapOnlyRun.qualifiedCompetitors.length === 0 && overlapOnlyRun.status === "complete",
  `qualified=${overlapOnlyRun.qualifiedCompetitors.length} status=${overlapOnlyRun.status}`,
);

const serpInjected = await runCommercialCompetitorDiscovery({
  slug: "pharmaconnect",
  live: true,
  persist: false,
  search: async (request) => ({
    provider: "fixture",
    query: request.query,
    marketCountry: request.marketCountry,
    locationCode: 2826,
    capturedAt: new Date().toISOString(),
    cost: 0,
    organicResultCount: 1,
    results: [{
      position: 1,
      domain: "pharmacy-digital-agency.co.uk",
      url: "https://pharmacy-digital-agency.co.uk/",
      title: "Pharmacy Digital Agency",
      description: "UK agency",
      source: "fixture",
    }],
  }),
  fetchWebsiteText: async () => agencyText,
});
record(
  "serp-discovery-from-bi-queries-not-rankings",
  serpInjected.candidates.some((row) => row.domain === "pharmacy-digital-agency.co.uk" && row.source === "search-engine") &&
    serpInjected.queries.length > 0 &&
    (serpInjected.rankedKeywordRequests ?? 0) === 0,
  `queries=${serpInjected.queries.length} source=${serpInjected.candidates[0]?.source}`,
);
record("no-external-fetch-during-validation", fetchCalls === 0, String(fetchCalls));

const catalogue = resolveTenantServiceCatalogue("pharmaconnect");
const bi = buildNationalBusinessIntelligenceView("pharmaconnect");
record("checkpoint-01-services-unchanged", bi.services.length === catalogue.services.length, `${bi.services.length}`);

try {
  fs.unlinkSync(tenantFile);
} catch {
  /* ignore */
}
if (previousDiscovery == null) {
  try { fs.unlinkSync(discoveryFile); } catch { /* ignore */ }
} else {
  fs.writeFileSync(discoveryFile, previousDiscovery, "utf8");
}

const passed = checks.filter((row) => row.pass).length;
console.log(`\n${passed === checks.length ? "✅" : "❌"} ${passed}/${checks.length} checks passed\n`);
console.log(`DISCOVERY_STATUS=${result.status}`);
console.log(`CANDIDATES_DISCOVERED=${result.candidates.length}`);
console.log(`DIRECT_COMMERCIAL_COMPETITORS=${result.directCommercialCompetitors}`);
console.log(`ADJACENT_COMMERCIAL_PROVIDERS=${result.adjacentCommercialProviders}`);
console.log(`NON_COMMERCIAL_OR_REJECTED=${result.candidates.filter((row) => row.role !== "commercial_competitor" || row.qualification !== "qualified").length}`);
console.log(`FETCH_CALLS=${fetchCalls}`);
for (const row of result.candidates) {
  console.log(`DOMAIN=${row.domain}`);
  console.log(`CLASSIFICATION=${row.role || ""}`);
  console.log(`DISCOVERY_SOURCE=${row.source}`);
  console.log(`TARGET_MARKET_RELEVANCE=${row.targetMarketRelevance ? "YES" : "NO"}`);
  console.log(`COMMERCIAL_PROVIDER=${row.commercialProvider ? "YES" : "NO"}`);
  console.log(`DETECTED_SERVICES=${(row.detectedServices || []).join(", ")}`);
  console.log(`OVERLAPPING_SERVICES=${(row.overlappingServices || []).join(", ")}`);
  console.log(`MARKET_RELEVANCE=${row.marketRelevance ? "YES" : "NO"}`);
  console.log(`QUALIFIED=${row.qualification === "qualified" && row.role === "commercial_competitor" ? "YES" : "NO"}`);
  console.log(`REASON=${row.qualificationReason || row.qualificationReasons[0] || ""}`);
}
globalThis.fetch = originalFetch;
if (passed !== checks.length) process.exit(1);
