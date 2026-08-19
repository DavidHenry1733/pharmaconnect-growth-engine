#!/usr/bin/env npx tsx
/**
 * CP02-DATAFORSEO-SEARCH-INTELLIGENCE-CORRECTION-01
 * Deterministic fixture tests for sparse-tenant Search Intelligence.
 * Does not call live DataForSEO, deploy, or mutate production data.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as subjectResolverMod from "../src/pharmacy/nationalIntelligenceSubjectResolver.ts";
import * as searchServiceMod from "../src/pharmacy/nationalSearchIntelligenceV1Service.ts";
import * as searchPageMod from "../src/pharmacy/nationalSearchIntelligencePage.ts";
import * as storageMod from "../src/pharmacy/nationalIntelligenceStorageService.ts";
import * as gateMod from "../src/pharmacy/nationalSearchCommercialCompetitorGate.ts";
import * as searchLimitsMod from "../src/pharmacy/nationalSearchIntelligenceLimits.ts";
import * as labsMod from "../src/pharmacy/dataForSeoRankedKeywordIntelligenceService.ts";
import * as seedsMod from "../src/pharmacy/nationalSearchIntelligenceCommercialSeeds.ts";
import * as overlapMod from "../src/pharmacy/nationalCommercialServiceOverlap.ts";
import * as workspacePathsMod from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import * as discoveryStorageMod from "../src/pharmacy/nationalCompetitorDiscoveryStorageService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const subjectResolver = exported(subjectResolverMod);
const searchService = exported(searchServiceMod);
const searchPage = exported(searchPageMod);
const storage = exported(storageMod);
const gate = exported(gateMod);
const searchLimits = exported(searchLimitsMod);
const labs = exported(labsMod);
const seeds = exported(seedsMod);
const overlap = exported(overlapMod);
const { getPharmacyProjectConfigPath } = exported(workspacePathsMod);
const discoveryStorage = exported(discoveryStorageMod);

let pass = 0;
let fail = 0;
let liveDataForSeoCalls = 0;
const originalFetch = globalThis.fetch;
const fetchUrls: string[] = [];
const fetchBodies: Array<{ url: string; task: Record<string, unknown> }> = [];

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (/dataforseo\.com/i.test(url)) liveDataForSeoCalls += 1;
  throw new Error(`sparse-correction validator blocked fetch: ${url}`);
}) as typeof fetch;

function check(id: string, ok: boolean, detail: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS  ${id} — ${detail}`);
  } else {
    fail += 1;
    console.log(`FAIL  ${id} — ${detail}`);
  }
}

const tenantSlug = "si-sparse-correction";
const tenantFile = getPharmacyProjectConfigPath(tenantSlug);
fs.mkdirSync(path.dirname(tenantFile), { recursive: true });
fs.writeFileSync(tenantFile, JSON.stringify({
  clientSlug: tenantSlug,
  businessName: "National Digital Growth Tenant",
  domain: "https://example-sparse-si.co.uk",
  growthPlatform: "national",
  primaryLocation: "United Kingdom",
  country: "United Kingdom",
  languageCode: "en",
  services: [
    "Pharmacy Website Design",
    "Pharmacy Local SEO",
    "Pharmacy Email Marketing",
    "Pharmacy Website Hosting",
    "Pharmacy Growth Audits",
  ],
}, null, 2) + "\n");

const subject = subjectResolver.resolveNationalIntelligenceSubject(tenantSlug);

const nymoText = "Nymo is a UK PMR and dispensing software provider for community pharmacies. Prescription management and stock management. Contact us to get started.";
const surveyText = "We provide a CPPQ community pharmacy patient questionnaire survey platform for UK pharmacy businesses. Contact us to get started.";
const operatingText = "Puri Pharmacy is a community pharmacy. Opening hours. Repeat prescription. We dispense medicines. Store locator. Shop now.";
const internationalText = "We provide pharmacy website design and local SEO for pharmacy businesses across the United States. Our digital agency helps US pharmacies. Get started today.";
const agencyText = "We are a UK digital agency for community pharmacies. We provide pharmacy website design, local SEO, email marketing, website hosting and growth audits. We work with pharmacy businesses across the United Kingdom. Get started.";
const coUkOnlyText = "We provide pharmacy website design for community pharmacies. Our clients are pharmacy owners. Get started.";
const broadText = "We are a digital website marketing seo hosting growth service online.";
const queryLeak = "Pharmacy Website Design community pharmacies United Kingdom";

function assess(domain: string, websiteText: string, url?: string) {
  return gate.assessNationalSearchCommercialCompetitor({
    domain,
    title: domain,
    websiteText,
    url: url || `https://${domain}/services`,
    sharedKeywordCount: 12,
    organicEtv: 80,
    subject,
    ownDomains: [subject.subjectDomain],
    sparseCustomerFootprint: true,
    fetchedAt: "2026-08-19T12:00:00.000Z",
  });
}

check(
  "1-sparse-tenant-routes-to-serp-competitors",
  searchLimits.isSparseCustomerKeywordUniverse(1, 10) === true
    && searchService.planNationalSearchIntelligenceCollection(tenantSlug, {}, { sparse: true }).discoveryEndpoint.includes("serp_competitors")
    && !searchService.planNationalSearchIntelligenceCollection(tenantSlug, {}, { sparse: true }).endpoints.includes(labs.DATAFORSEO_LABS_ENDPOINTS.competitorsDomain),
  "sparse plan uses serp_competitors, not competitors_domain",
);

const sparsePlan = searchService.planNationalSearchIntelligenceCollection(tenantSlug, {}, { sparse: true });
check(
  "2-maximum-one-serp-competitors-task",
  sparsePlan.competitorDiscoveryTasks === 1
    && sparsePlan.endpoints.filter((endpoint) => endpoint.includes("serp_competitors")).length === 1,
  JSON.stringify({ discovery: sparsePlan.competitorDiscoveryTasks, endpoints: sparsePlan.endpoints }),
);

const builtSeeds = seeds.buildSearchIntelligenceCommercialSeeds({
  services: subject.commercialServices.map((row) => row.serviceName),
  targetCustomerMarket: "Digital services built specifically for community pharmacies.",
  country: "United Kingdom",
});
check(
  "3-seeds-come-from-business-intelligence",
  builtSeeds.some((seed) => /website design/i.test(seed))
    && builtSeeds.every((seed) => !/pharmaconnect/i.test(seed))
    && sparsePlan.commercialSeedKeywords.length > 0
    && sparsePlan.commercialSeedKeywords.every((seed) => !/pharmaconnect/i.test(seed)),
  builtSeeds.join(" | "),
);

check(
  "4-seeds-normalised-and-deduplicated",
  JSON.stringify(seeds.normaliseSearchIntelligenceCommercialSeeds([
    "Pharmacy Website Design",
    "pharmacy  website  design",
    "PHARMACY WEBSITE DESIGN",
    "Local SEO",
  ])) === JSON.stringify(["pharmacy website design", "local seo"])
    && builtSeeds.length <= seeds.SEARCH_INTELLIGENCE_MAX_COMMERCIAL_SEEDS,
  builtSeeds.join(" | "),
);

const nymo = assess("nymopmr.co.uk", nymoText);
const survey = assess("surveyfocus.co.uk", surveyText);
const operating = assess("puripharmacy.co.uk", operatingText);
const international = assess("digitalpharmacist.com", internationalText);
const agency = assess("pharmacy-digital-agency.co.uk", agencyText);
const coUkOnly = assess("agency-without-uk-copy.co.uk", coUkOnlyText);
const broad = assess("generic-tokens.example", broadText);

check(
  "5-query-strings-never-enter-candidate-website-text",
  !nymo.qualificationEvidence.exactMatchedSourceText.includes(queryLeak)
    && nymo.qualificationEvidence.evidenceProvenance === "candidate_website",
  nymo.qualificationEvidence.exactMatchedSourceText.slice(0, 80),
);

check(
  "6-candidate-evidence-requires-url-plus-excerpt",
  Boolean(agency.qualificationEvidence.candidateSourceUrl)
    && /https?:\/\//.test(agency.qualificationEvidence.candidateSourceUrl)
    && agency.qualificationEvidence.exactMatchedSourceText.length > 0
    && Boolean(agency.qualificationEvidence.matchedConfiguredService)
    && Boolean(agency.qualificationEvidence.targetCustomerEvidence)
    && Boolean(agency.qualificationEvidence.ukMarketEvidence)
    && Boolean(agency.qualificationEvidence.fetchedAt)
    && agency.reasons.some((reason) => /https?:\/\//.test(reason) && /"/.test(reason)),
  `${agency.qualificationEvidence.candidateSourceUrl} :: ${agency.qualificationEvidence.exactMatchedSourceText}`,
);

check(
  "7-pmr-provider-cannot-become-direct",
  nymo.outcome === "adjacent_provider"
    && nymo.role === "adjacent_commercial_provider"
    && nymo.eligibleForKeywordExpansion === false,
  `${nymo.outcome}/${nymo.role}`,
);

check(
  "8-questionnaire-provider-cannot-become-direct",
  survey.outcome === "adjacent_provider"
    && survey.role === "adjacent_commercial_provider"
    && survey.eligibleForKeywordExpansion === false,
  `${survey.outcome}/${survey.role}`,
);

check(
  "9-operating-pharmacy-cannot-become-direct",
  operating.outcome === "customer_market"
    && operating.role === "customer_market"
    && operating.eligibleForKeywordExpansion === false,
  `${operating.outcome}/${operating.role}`,
);

check(
  "10-international-overlapping-agency-becomes-international-comparator",
  international.outcome === "international_comparator"
    && international.role === "international_comparator"
    && international.eligibleForKeywordExpansion === false,
  `${international.outcome} eligible=${international.eligibleForKeywordExpansion}`,
);

check(
  "11-co-uk-alone-cannot-prove-market-relevance",
  coUkOnly.marketRelevance === false
    && coUkOnly.outcome !== "direct_competitor"
    && coUkOnly.eligibleForKeywordExpansion === false,
  `${coUkOnly.outcome} marketRelevance=${coUkOnly.marketRelevance}`,
);

check(
  "12-broad-generic-tokens-cannot-prove-service-overlap",
  overlap.compareNationalCommercialServiceOverlap({
    tenantServices: subject.commercialServices.map((row) => row.serviceName),
    websiteText: broadText,
  }).serviceOverlap === false
    && broad.outcome !== "direct_competitor",
  `overlap=${broad.serviceOverlap} outcome=${broad.outcome}`,
);

check(
  "13-only-direct-competitor-is-expansion-eligible",
  agency.outcome === "direct_competitor"
    && agency.eligibleForKeywordExpansion === true
    && [nymo, survey, operating, international, coUkOnly, broad].every((row) => row.eligibleForKeywordExpansion === false),
  `agency=${agency.outcome} others=${[nymo, survey, operating, international].map((row) => row.outcome).join(",")}`,
);

const serpPayload = seeds.buildSerpCompetitorsLivePayload({
  keywords: ["Pharmacy Website Design", "pharmacy website design", "Local SEO"],
  locationCode: 2826,
  languageCode: "en",
  limit: 20,
});
check(
  "serp-competitors-redacted-request-shape",
  serpPayload.length === 1
    && JSON.stringify(serpPayload[0].item_types) === JSON.stringify(["organic"])
    && serpPayload[0].location_code === 2826
    && serpPayload[0].language_code === "en"
    && serpPayload[0].include_clickstream_data === false
    && serpPayload[0].limit === 20
    && serpPayload[0].keywords.length === 2,
  JSON.stringify(serpPayload),
);

function rankedPayloadBody() {
  return {
    status_code: 20000,
    tasks: [{
      status_code: 20000,
      cost: 0.008,
      result: [{
        items: [{
          keyword_data: {
            keyword: "pharmacy website design uk",
            keyword_info: { search_volume: 210, cpc: 1.2, competition: 0.4 },
          },
          ranked_serp_element: { serp_item: { rank_absolute: 8, etv: 4, url: "https://example-sparse-si.co.uk/" } },
        }],
      }],
    }],
  };
}

function competitorsPayload(items: Array<{ domain: string }>) {
  return {
    status_code: 20000,
    tasks: [{
      status_code: 20000,
      cost: 0.01,
      result: [{
        items: items.map((row) => ({
          domain: row.domain,
          avg_position: 6,
          keywords_count: 4,
          etv: 40,
        })),
      }],
    }],
  };
}

const previousLogin = process.env.DATAFORSEO_LOGIN;
const previousPassword = process.env.DATAFORSEO_PASSWORD;
process.env.DATAFORSEO_LOGIN = "si-sparse-login";
process.env.DATAFORSEO_PASSWORD = "si-sparse-password";

const preservedDiscovery = {
  tenantSlug,
  evidenceKind: "REAL_DISCOVERY",
  status: "complete",
  generatedAt: "2026-08-01T00:00:00.000Z",
  candidates: [{ domain: "preserved-cp02.example", name: "Preserved CP02" }],
  directCommercialCompetitors: 3,
};

function cleanup() {
  for (const artifact of [
    "search-intelligence-v1",
    "search-intelligence-v2",
    "ranked-keywords-customer",
    "ranked-keywords-customer-v2",
    "ranked-keywords-competitors",
    "ranked-keywords-competitors-v2",
    "competitor-keyword-gaps-v2",
    "cost-ledger-v1",
    "refresh-metadata-v1",
    "competitor-discovery",
  ] as const) {
    const file = storage.nationalIntelligenceDataPath(tenantSlug, artifact);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  if (fs.existsSync(tenantFile)) fs.unlinkSync(tenantFile);
  if (previousLogin === undefined) delete process.env.DATAFORSEO_LOGIN;
  else process.env.DATAFORSEO_LOGIN = previousLogin;
  if (previousPassword === undefined) delete process.env.DATAFORSEO_PASSWORD;
  else process.env.DATAFORSEO_PASSWORD = previousPassword;
  globalThis.fetch = originalFetch;
}

const websiteEvidenceByDomain = {
  "nymopmr.co.uk": { title: "Nymo PMR", websiteText: nymoText, sourceUrl: "https://nymopmr.co.uk/pmr", query: queryLeak, snippet: queryLeak },
  "surveyfocus.co.uk": { title: "Survey Focus", websiteText: surveyText, sourceUrl: "https://surveyfocus.co.uk/cppq" },
  "puripharmacy.co.uk": { title: "Puri Pharmacy", websiteText: operatingText, sourceUrl: "https://puripharmacy.co.uk/" },
  "digitalpharmacist.com": { title: "Digital Pharmacist", websiteText: internationalText, sourceUrl: "https://digitalpharmacist.com/services" },
  "pharmacy-digital-agency.co.uk": { title: "Agency", websiteText: agencyText, sourceUrl: "https://pharmacy-digital-agency.co.uk/services" },
  "agency-without-uk-copy.co.uk": { title: "Agency without geography copy", websiteText: coUkOnlyText, sourceUrl: "https://agency-without-uk-copy.co.uk/" },
  "generic-tokens.example": { title: "Generic", websiteText: broadText, sourceUrl: "https://generic-tokens.example/" },
  "second-agency.co.uk": { title: "Second", websiteText: agencyText, sourceUrl: "https://second-agency.co.uk/services" },
  "third-agency.co.uk": { title: "Third", websiteText: agencyText, sourceUrl: "https://third-agency.co.uk/services" },
  "fourth-agency.co.uk": { title: "Fourth", websiteText: agencyText, sourceUrl: "https://fourth-agency.co.uk/services" },
};

try {
  storage.ensureNationalIntelligenceDataDir();
  fs.writeFileSync(
    discoveryStorage.nationalCompetitorDiscoveryPath(tenantSlug),
    JSON.stringify(preservedDiscovery, null, 2) + "\n",
  );
  const beforeDiscovery = fs.readFileSync(discoveryStorage.nationalCompetitorDiscoveryPath(tenantSlug), "utf8");

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    fetchUrls.push(url);
    if (!/dataforseo\.com/i.test(url)) {
      liveDataForSeoCalls += 1;
      throw new Error(`unexpected non-DataForSEO fetch ${url}`);
    }
    const payload = JSON.parse(String(init?.body || "[]"));
    const task = Array.isArray(payload) ? (payload[0] || {}) : {};
    fetchBodies.push({ url, task });
    if (url.includes("serp_competitors")) {
      return new Response(JSON.stringify(competitorsPayload([
        { domain: "nymopmr.co.uk" },
        { domain: "surveyfocus.co.uk" },
        { domain: "puripharmacy.co.uk" },
        { domain: "digitalpharmacist.com" },
        { domain: "pharmacy-digital-agency.co.uk" },
        { domain: "agency-without-uk-copy.co.uk" },
        { domain: "generic-tokens.example" },
        { domain: "second-agency.co.uk" },
        { domain: "third-agency.co.uk" },
        { domain: "fourth-agency.co.uk" },
      ])), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("competitors_domain")) {
      throw new Error("competitors_domain must not be used for sparse commercial discovery");
    }
    if (url.includes("domain_intersection")) {
      return new Response(JSON.stringify(rankedPayloadBody()), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("ranked_keywords")) {
      const target = String(task.target || "");
      return new Response(JSON.stringify({
        status_code: 20000,
        tasks: [{
          status_code: 20000,
          cost: 0.008,
          result: [{
            items: [{
              keyword_data: {
                keyword: target.includes("agency") ? "pharmacy website design" : "pharmacy website design uk",
                keyword_info: { search_volume: 210, cpc: 1.2, competition: 0.4 },
              },
              ranked_serp_element: { serp_item: { rank_absolute: 8, etv: 4, url: `https://${target || "example-sparse-si.co.uk"}/` } },
            }],
          }],
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`Unexpected DataForSEO URL ${url}`);
  }) as typeof fetch;

  const snapshot = await searchService.collectNationalSearchIntelligence(tenantSlug, {
    force: true,
    limits: { customerKeywordUniverse: 1, qualifiedCompetitorsAnalysed: 5, competitorRankedKeywords: 1 },
    websiteEvidenceByDomain,
  });

  const byDomain = Object.fromEntries(snapshot.organicCompetitors.concat(snapshot.excludedCompetitors).map((row) => [row.domain, row]));
  check(
    "1b-sparse-collect-uses-serp-competitors",
    snapshot.customerOrganicFootprint.sparse === true
      && snapshot.labsAttempts.some((row) => row.role === "serp_competitors")
      && snapshot.labsAttempts.filter((row) => row.role === "serp_competitors").length === 1
      && !snapshot.labsAttempts.some((row) => row.role === "competitors_domain")
      && fetchUrls.filter((url) => url.includes("serp_competitors")).length === 1
      && fetchUrls.every((url) => !url.includes("competitors_domain")),
    `attempts=${snapshot.labsAttempts.map((row) => row.role).join(",")} urls=${fetchUrls.join(" | ")}`,
  );

  check(
    "5b-injected-query-stripped-from-website-text",
    !JSON.stringify(byDomain["nymopmr.co.uk"] || {}).includes(queryLeak),
    "query leak absent from persisted nymo candidate",
  );

  check(
    "13b-collected-outcomes",
    byDomain["nymopmr.co.uk"]?.outcome === "adjacent_provider"
      && byDomain["surveyfocus.co.uk"]?.outcome === "adjacent_provider"
      && byDomain["puripharmacy.co.uk"]?.outcome === "customer_market"
      && byDomain["digitalpharmacist.com"]?.outcome === "international_comparator"
      && byDomain["digitalpharmacist.com"]?.eligibleForKeywordExpansion === false
      && byDomain["pharmacy-digital-agency.co.uk"]?.outcome === "direct_competitor",
    Object.entries(byDomain).map(([domain, row]) => `${domain}:${row.outcome}`).join(" | "),
  );

  const expanded = snapshot.labsAttempts.filter((row) => row.role === "competitor_ranked_keywords");
  const intersections = snapshot.labsAttempts.filter((row) => row.role === "domain_intersection");
  check(
    "16-expansion-capped-at-three-direct-competitors",
    snapshot.organicCompetitors.filter((row) => row.outcome === "direct_competitor").length >= 3
      && snapshot.competitorKeywordUniverses.length === 3
      && expanded.length === 3
      && intersections.length === 3
      && snapshot.organicCompetitors.filter((row) => row.analysed).length === 3
      && !expanded.some((row) => row.domain === "digitalpharmacist.com"),
    `eligible=${snapshot.organicCompetitors.filter((row) => row.eligibleForKeywordExpansion).map((row) => row.domain).join(",")} ranked=${expanded.length} gaps=${intersections.length}`,
  );

  const firstCollectUrls = [...fetchUrls];
  const rankedBodies = fetchBodies.filter((row) => row.url.includes("ranked_keywords"));
  const intersectionBodies = fetchBodies.filter((row) => row.url.includes("domain_intersection"));
  check(
    "14-ranked-keywords-use-organic-item-types",
    rankedBodies.length > 0
      && rankedBodies.every((row) => JSON.stringify(row.task.item_types) === JSON.stringify(["organic"]) && row.task.include_clickstream_data === false),
    JSON.stringify(rankedBodies.map((row) => ({ item_types: row.task.item_types, clickstream: row.task.include_clickstream_data }))),
  );
  check(
    "15-domain-intersection-uses-intersections-false",
    intersectionBodies.length === 3
      && intersectionBodies.every((row) => row.task.intersections === false
        && JSON.stringify(row.task.item_types) === JSON.stringify(["organic"])
        && row.task.include_clickstream_data === false),
    JSON.stringify(intersectionBodies.map((row) => row.task)),
  );
  check(
    "17-maximum-request-budget-is-eight-tasks",
    firstCollectUrls.length <= searchLimits.SPARSE_SEARCH_INTELLIGENCE_MAX_TASKS
      && firstCollectUrls.length === 8
      && snapshot.collectionPlan.maximumPaidRequests === 8,
    `fetchUrls=${firstCollectUrls.length} planMax=${snapshot.collectionPlan.maximumPaidRequests}`,
  );

  fetchUrls.length = 0;
  fetchBodies.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    fetchUrls.push(url);
    const payload = JSON.parse(String(init?.body || "[]"));
    const task = Array.isArray(payload) ? (payload[0] || {}) : {};
    fetchBodies.push({ url, task });
    if (url.includes("serp_competitors")) {
      return new Response(JSON.stringify(competitorsPayload([
        { domain: "nymopmr.co.uk" },
        { domain: "surveyfocus.co.uk" },
        { domain: "puripharmacy.co.uk" },
        { domain: "digitalpharmacist.com" },
      ])), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("ranked_keywords")) {
      return new Response(JSON.stringify(rankedPayloadBody()), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("domain_intersection") || url.includes("competitors_domain")) {
      throw new Error(`zero-direct run must not call ${url}`);
    }
    throw new Error(`Unexpected DataForSEO URL ${url}`);
  }) as typeof fetch;
  const zeroSnapshot = await searchService.collectNationalSearchIntelligence(tenantSlug, {
    force: true,
    limits: { customerKeywordUniverse: 1, qualifiedCompetitorsAnalysed: 5, competitorRankedKeywords: 1 },
    websiteEvidenceByDomain: {
      "nymopmr.co.uk": websiteEvidenceByDomain["nymopmr.co.uk"],
      "surveyfocus.co.uk": websiteEvidenceByDomain["surveyfocus.co.uk"],
      "puripharmacy.co.uk": websiteEvidenceByDomain["puripharmacy.co.uk"],
      "digitalpharmacist.com": websiteEvidenceByDomain["digitalpharmacist.com"],
    },
  });
  check(
    "18-zero-genuine-direct-competitors-is-valid",
    (zeroSnapshot.status === "collected" || zeroSnapshot.status === "partial")
      && zeroSnapshot.organicCompetitors.filter((row) => row.outcome === "direct_competitor").length === 0,
    `${zeroSnapshot.status} directs=${zeroSnapshot.organicCompetitors.filter((row) => row.outcome === "direct_competitor").length}`,
  );
  check(
    "18b-zero-direct-skips-expansion",
    zeroSnapshot.organicCompetitors.every((row) => row.eligibleForKeywordExpansion === false)
      && zeroSnapshot.competitorKeywordUniverses.length === 0
      && (zeroSnapshot.competitorKeywordGaps || []).length === 0
      && fetchUrls.every((url) => !url.includes("domain_intersection")),
    `universes=${zeroSnapshot.competitorKeywordUniverses.length} urls=${fetchUrls.join(" | ")}`,
  );

  const afterDiscovery = fs.readFileSync(discoveryStorage.nationalCompetitorDiscoveryPath(tenantSlug), "utf8");
  check(
    "19-existing-failed-cp02-evidence-is-not-overwritten",
    afterDiscovery === beforeDiscovery
      && JSON.parse(afterDiscovery).evidenceKind === "REAL_DISCOVERY"
      && JSON.parse(afterDiscovery).directCommercialCompetitors === 3
      && fs.existsSync(storage.nationalIntelligenceDataPath(tenantSlug, "search-intelligence-v2")),
    "REAL_DISCOVERY preserved; corrected SI written to v2",
  );

  const html = searchPage.renderNationalSearchIntelligencePage(tenantSlug);
  check(
    "20-search-intelligence-renders-each-evidence-class-separately",
    html.includes('data-si-evidence-class="customer-ranked-keywords"')
      && html.includes('data-si-evidence-class="commercial-seed-keywords"')
      && html.includes('data-si-evidence-class="serp-discovery-candidates"')
      && html.includes('data-si-evidence-class="qualified-uk-direct-competitors"')
      && html.includes('data-si-evidence-class="adjacent-providers"')
      && html.includes('data-si-evidence-class="international-comparators"')
      && html.includes('data-si-evidence-class="customer-non-competitors"')
      && html.includes('data-si-evidence-class="competitor-ranked-keywords"')
      && html.includes('data-si-evidence-class="competitor-keyword-gaps"')
      && html.includes("data-si-evidence-url=")
      && html.includes("data-si-evidence-excerpt=")
      && html.includes("No UK direct competitor is proven"),
    "UI separates evidence classes and shows evidence URL/excerpt plus honest empty state",
  );
} finally {
  const dataForSeoCalls = liveDataForSeoCalls;
  cleanup();
  check(
    "K-dataforseo-calls-zero-during-implementation",
    dataForSeoCalls === 0,
    `DATAFORSEO_CALLS=${dataForSeoCalls}`,
  );
}

console.log(`\n${fail ? "FAIL" : "PASS"} — ${pass}/${pass + fail} checks\n`);
if (fail) process.exit(1);
