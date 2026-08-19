#!/usr/bin/env npx tsx
/**
 * Search Intelligence V2 renderer precedence.
 * When a V2 artefact exists, the preserved V1 commercial-discovery block must not render.
 * Does not call DataForSEO, mutate production evidence, or change classification logic.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createIsolatedNationalValidationWorkspace,
} from "./isolatedNationalValidationWorkspace.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const isolated = createIsolatedNationalValidationWorkspace({
  prefix: "si-v2-renderer-",
});

const pageMod = await import("../src/pharmacy/nationalSearchIntelligencePage.ts");
const storageMod = await import("../src/pharmacy/nationalIntelligenceStorageService.ts");

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const page = exported(pageMod);
const storage = exported(storageMod);

let pass = 0;
let fail = 0;
let liveDataForSeoCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (/dataforseo\.com/i.test(url)) liveDataForSeoCalls += 1;
  throw new Error(`v2-renderer validator blocked fetch: ${url}`);
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

function evidenceClassHtml(html: string, attr: string): string {
  const needle = `data-si-evidence-class="${attr}"`;
  const start = html.indexOf(needle);
  if (start < 0) return "";
  const from = html.lastIndexOf("<div", start);
  const next = html.indexOf("data-si-evidence-class=\"", start + needle.length);
  return html.slice(from < 0 ? start : from, next < 0 ? html.length : next);
}

function failedV1Discovery(slug: string) {
  const capturedAt = "2026-08-18T09:00:00.000Z";
  const candidate = (
    domain: string,
    role: string,
    qualification: "qualified" | "rejected" | "candidate",
  ) => ({
    id: `${slug}-${domain}`,
    name: domain,
    domain,
    websiteUrl: `https://${domain}`,
    marketCountry: "United Kingdom",
    targetCustomerMarket: "community pharmacies",
    source: "search-engine",
    sourceQuery: "pharmacy website design United Kingdom",
    qualification,
    qualificationReasons: qualification === "qualified" ? ["V1 incorrectly treated SERP overlap as commercial proof."] : ["Rejected by later V2 qualification."],
    rejectionReasons: qualification === "qualified" ? [] : ["Not a UK direct competitor."],
    serviceEvidence: [],
    title: domain,
    description: "",
    evidenceUrls: [`https://${domain}/`],
    capturedAt,
    role,
    commercialProvider: role === "commercial_competitor",
    targetMarketRelevance: true,
    marketRelevance: true,
    serviceOverlap: role === "commercial_competitor",
    detectedServices: [],
    overlappingServices: [],
    nonOverlappingServices: [],
    qualificationReason: qualification === "qualified" ? "V1 false direct competitor" : "Not direct",
  });
  const directs = [
    candidate("nymopmr.co.uk", "commercial_competitor", "qualified"),
    candidate("surveyfocus.co.uk", "commercial_competitor", "qualified"),
    candidate("puripharmacy.co.uk", "commercial_competitor", "qualified"),
  ];
  const adjacent = [
    candidate("adjacent-one.co.uk", "adjacent_commercial_provider", "rejected"),
    candidate("adjacent-two.co.uk", "adjacent_commercial_provider", "rejected"),
    candidate("adjacent-three.co.uk", "adjacent_commercial_provider", "rejected"),
    candidate("adjacent-four.co.uk", "adjacent_commercial_provider", "rejected"),
    candidate("adjacent-five.co.uk", "adjacent_commercial_provider", "rejected"),
  ];
  const rejected = Array.from({ length: 11 }, (_, index) =>
    candidate(`rejected-${index + 1}.co.uk`, "publisher", "rejected"),
  );
  const candidates = [...directs, ...adjacent, ...rejected];
  return {
    slug,
    businessName: "National Renderer Tenant",
    domain: `${slug}.example-agency.co.uk`,
    status: "complete",
    evidenceKind: "REAL_DISCOVERY",
    generatedAt: capturedAt,
    source: "national-competitor-discovery-v1",
    candidates,
    directCommercialCompetitors: 3,
    adjacentCommercialProviders: 5,
    rejectedCandidates: 11,
    unclassifiedCandidates: 0,
    rankedKeywordRequests: 0,
    evidenceLimitations: ["Preserved failed V1 commercial discovery."],
  };
}

function siCompetitor(domain: string, outcome: string, role: string) {
  return {
    domain,
    name: domain,
    websiteUrl: `https://${domain}`,
    whyIdentified: ["Independent website evidence."],
    sourceQueries: [],
    discoverySource: "dataforseo_labs_serp_competitors",
    evidenceType: "serp_competitor_candidates",
    outcome,
    sharedKeywordCount: 4,
    averagePosition: 8,
    organicEtv: 40,
    organicKeywordCount: 10,
    sharedKeywordEtv: 8,
    bestSerpPosition: 5,
    role,
    classification: outcome,
    qualification: outcome === "direct_competitor" ? "qualified" : "candidate",
    evidenceStatus: "website_evidence",
    evidenceUrls: [`https://${domain}/`],
    exclusionReasons: [],
    qualificationScore: outcome === "direct_competitor" ? 80 : 40,
    qualificationEvidence: ["Independent candidate website evidence."],
    eligibleForKeywordExpansion: outcome === "direct_competitor",
    nonSelectionReason: outcome === "direct_competitor" ? null : "Not a UK direct competitor.",
    candidateQualificationEvidence: {
      candidateSourceUrl: `https://${domain}/`,
      exactMatchedSourceText: "Independent website excerpt.",
    },
    commercialGate: {
      targetMarketRelevance: true,
      commercialProvider: role !== "customer_market",
      serviceOverlap: outcome === "direct_competitor",
      marketRelevance: outcome !== "international_comparator",
      matchedServices: outcome === "direct_competitor" ? ["Pharmacy Website Design"] : [],
      tenantServices: ["Pharmacy Website Design"],
      candidateServicesDetected: [],
      overlappingServices: [],
      nonOverlappingServices: [],
      organicOverlapSupportingOnly: true,
    },
    analysed: false,
    capturedAt: "2026-08-19T14:52:00.000Z",
    evidenceSource: "DATAFORSEO_LIVE",
    verified: false,
  };
}

function searchIntelligenceSnapshot(slug: string, version: 1 | 2, capturedAt: string) {
  const organicCompetitors = version === 2
    ? [
      siCompetitor("nymopmr.co.uk", "adjacent_provider", "adjacent_commercial_provider"),
      siCompetitor("surveyfocus.co.uk", "adjacent_provider", "adjacent_commercial_provider"),
      siCompetitor("puripharmacy.co.uk", "customer_market", "customer_market"),
    ]
    : [
      siCompetitor("nymopmr.co.uk", "direct_competitor", "commercial_competitor"),
    ];
  return {
    version,
    tenantSlug: slug,
    businessName: "National Renderer Tenant",
    subjectDomain: `${slug}.example-agency.co.uk`,
    primaryMarket: "United Kingdom",
    country: "United Kingdom",
    growthPlatform: "national",
    capturedAt,
    liveExecution: true,
    status: "collected",
    lastError: null,
    reusedExistingSnapshot: false,
    costs: { requests: 2, tasks: 2, totalCost: 0.02 },
    provenance: {
      tenantSlug: slug,
      subjectDomain: `${slug}.example-agency.co.uk`,
      capturedAt,
      evidenceSource: "DATAFORSEO_LIVE",
      sourceSystem: version === 2 ? "national-search-intelligence-v2" : "national-search-intelligence-v1",
      sourceEndpoint: "https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live",
      sourceSnapshot: storage.nationalIntelligenceDataPath(slug, version === 2 ? "search-intelligence-v2" : "search-intelligence-v1"),
      liveExecution: true,
      calculated: false,
      calculationMethod: null,
      confidenceBasis: "explicit-dataforseo-collection",
      costContribution: 0.02,
    },
    authority: "PERSISTED_PROVEN",
    customerKeywords: [{
      keyword: "pharmacy website design uk",
      position: 12,
      rankingUrl: `https://${slug}.example-agency.co.uk/`,
      searchVolume: 210,
      cpc: 1.2,
      competition: 0.4,
      estimatedTraffic: 4,
      searchIntent: "commercial",
      serpType: "organic",
      rankGroup: 1,
      seResultsCount: 1000,
      capturedAt,
      sourceEndpoint: "https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live",
      evidenceSource: "DATAFORSEO_LIVE",
      calculated: false,
    }],
    commercialSeedKeywords: ["pharmacy website design"],
    organicCompetitors,
    excludedCompetitors: [],
    competitorKeywordUniverses: [],
    competitorKeywordGaps: [],
    labsAttempts: [],
    serpAttempts: [],
    summary: {
      rankingKeywordCount: 1,
      top3Count: 0,
      top10Count: 0,
      top20Count: 1,
      top100Count: 1,
      rankingPageCount: 1,
      availableSearchDemand: 210,
      organicCompetitorCount: organicCompetitors.length,
      commercialCompetitorCount: version === 2 ? 0 : 1,
      serpCompetitorCount: 0,
      analysedCompetitorCount: 0,
      excludedCompetitorCount: 0,
      competitorKeywordCount: 0,
      directCompetitorCount: version === 2 ? 0 : 1,
      adjacentCompetitorCount: version === 2 ? 2 : 0,
      internationalComparatorCount: 0,
      customerMarketCount: version === 2 ? 1 : 0,
      rejectedCandidateCount: 0,
      competitorKeywordGapCount: 0,
      strongestRankingPages: [],
      top3CountCalculated: true,
      top10CountCalculated: true,
      top20CountCalculated: true,
      top100CountCalculated: true,
      rankingPageCountCalculated: true,
      availableSearchDemandCalculated: true,
    },
    nextStage: {
      title: "Compare competitor keyword universes",
      detail: "Next stage is not implemented in this renderer check.",
      implemented: false,
    },
  };
}

function writeTenant(slug: string) {
  isolated.writeProjectConfig(slug, {
    clientSlug: slug,
    businessName: "National Renderer Tenant",
    domain: `https://${slug}.example-agency.co.uk`,
    growthPlatform: "national",
    primaryLocation: "United Kingdom",
    country: "United Kingdom",
    languageCode: "en",
    services: ["Pharmacy Website Design"],
  });
}

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

console.log("\n=== SEARCH INTELLIGENCE V2 RENDERER PRECEDENCE ===\n");

const pageSource = fs.readFileSync(path.join(ROOT, "src/pharmacy/nationalSearchIntelligencePage.ts"), "utf8");
check(
  "renderer-gates-v1-discovery-on-v2-artefact",
  pageSource.includes("hasAuthoritativeSearchIntelligenceV2")
    && pageSource.includes('resolveNationalIntelligenceArtifactPath(slug, "search-intelligence-v2")')
    && pageSource.includes("if (hasAuthoritativeSearchIntelligenceV2(slug)) return \"\""),
  "V1 commercial-discovery panel is suppressed only when V2 exists",
);

const withV2 = "si-v2-renderer-with-v2";
const v1Only = "si-v2-renderer-v1-only";
writeTenant(withV2);
writeTenant(v1Only);

writeJson(storage.nationalIntelligenceDataPath(withV2, "competitor-discovery"), failedV1Discovery(withV2));
writeJson(storage.nationalIntelligenceDataPath(v1Only, "competitor-discovery"), failedV1Discovery(v1Only));
writeJson(storage.nationalIntelligenceDataPath(withV2, "search-intelligence-v2"), searchIntelligenceSnapshot(withV2, 2, "2026-08-19T14:52:00.000Z"));
writeJson(storage.nationalIntelligenceDataPath(v1Only, "search-intelligence-v1"), searchIntelligenceSnapshot(v1Only, 1, "2026-08-18T13:02:53.532Z"));

const v2Html = page.renderNationalSearchIntelligencePage(withV2);
const v1Html = page.renderNationalSearchIntelligencePage(v1Only);
const v2Direct = evidenceClassHtml(v2Html, "qualified-uk-direct-competitors");
const v2Adjacent = evidenceClassHtml(v2Html, "adjacent-providers");

check(
  "v2-present-suppresses-v1-discovery-block",
  !v2Html.includes('data-cp02-page="commercial-competitor-discovery"')
    && !v2Html.includes("Commercial competitor discovery")
    && !v2Html.includes("COMPETITOR_RANKED_KEYWORD_REQUESTS=")
    && !v2Html.includes('data-cp02-candidate-count="19"')
    && !v2Html.includes('data-cp02-direct-count="3"')
    && v2Html.includes('data-si-authoritative-artefact="search-intelligence-v2"'),
  "V2 page has no preserved V1 discovery summary",
);
check(
  "v2-present-renders-v2-counts",
  v2Html.includes('data-ni03c2-qualified-count="0"')
    && v2Html.includes("Qualified commercial competitors: 0")
    && v2Html.includes('data-ni03c2-paid-expansions="0"')
    && v2Html.includes("Paid competitor expansions: 0")
    && v2Html.includes("19 August 2026")
    && /No UK direct competitor is proven/.test(v2Direct),
  "V2 counts are 0 direct / 0 expansions and latest collection is 19 August 2026",
);
check(
  "v2-present-nymo-is-adjacent-not-v1-direct",
  v2Adjacent.includes("nymopmr.co.uk")
    && v2Adjacent.includes('data-si-outcome="adjacent_provider"')
    && !v2Direct.includes("nymopmr.co.uk")
    && !v2Html.includes('data-cp02-candidate="nymopmr.co.uk"')
    && !v2Html.includes('data-cp02-group="direct"'),
  "NYMO is adjacent in V2 and cannot appear in a V1 direct section",
);
check(
  "v2-absent-keeps-v1-discovery-fallback",
  v1Html.includes('data-cp02-page="commercial-competitor-discovery"')
    && v1Html.includes('data-cp02-candidate-count="19"')
    && v1Html.includes('data-cp02-direct-count="3"')
    && v1Html.includes("COMPETITOR_RANKED_KEYWORD_REQUESTS=0")
    && v1Html.includes('data-cp02-candidate="nymopmr.co.uk"')
    && v1Html.includes('data-cp02-qualified="yes"')
    && v1Html.includes('data-si-authoritative-artefact="search-intelligence-v1"'),
  "Without V2, the existing V1 discovery block still renders",
);
check(
  "v1-and-v2-files-both-present-are-not-merged",
  fs.existsSync(storage.nationalIntelligenceDataPath(withV2, "competitor-discovery"))
    && fs.existsSync(storage.nationalIntelligenceDataPath(withV2, "search-intelligence-v2"))
    && !v2Html.includes('data-cp02-direct-count="3"')
    && v2Html.includes('data-ni03c2-qualified-count="0"'),
  "Preserved V1 discovery file remains on disk but is not merged into the V2 page",
);

globalThis.fetch = originalFetch;
isolated.cleanup();
check(
  "dataforseo-calls-zero",
  liveDataForSeoCalls === 0,
  `DATAFORSEO_CALLS=${liveDataForSeoCalls}`,
);

console.log(`DATAFORSEO_CALLS=${liveDataForSeoCalls}`);
console.log(`\n${fail ? "FAIL" : "PASS"} — ${pass}/${pass + fail} checks\n`);
if (fail) process.exit(1);
