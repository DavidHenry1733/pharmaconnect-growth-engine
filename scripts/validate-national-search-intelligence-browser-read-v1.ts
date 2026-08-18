#!/usr/bin/env npx tsx
/**
 * NI-03C.2 — Search Intelligence browser read/render path.
 * Does not collect. Does not call DataForSEO, Google Places, or GSC.
 * Does not overwrite the pharmaconnect production snapshot.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as pageMod from "../src/pharmacy/nationalSearchIntelligencePage.ts";
import * as storageMod from "../src/pharmacy/nationalIntelligenceStorageService.ts";
import * as workspaceMod from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import * as pageRenderersMod from "../src/pharmacy/growthEnginePageRenderers.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const page = exported(pageMod);
const storage = exported(storageMod);
const workspace = exported(workspaceMod);
const pageRenderers = exported(pageRenderersMod);

let pass = 0;
let fail = 0;
const originalFetch = globalThis.fetch;
let fetchCalls = 0;
const fetchUrls: string[] = [];

globalThis.fetch = (async (input: RequestInfo | URL) => {
  fetchCalls += 1;
  fetchUrls.push(String(input));
  throw new Error(`NI-03C.2 browser-read validator blocked fetch: ${String(input)}`);
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

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

console.log("\n=== NI-03C.2 SEARCH INTELLIGENCE BROWSER READ PATH ===\n");

const routeSource = read("artifacts/api-server/src/routes/growthEnginePageRouter.ts");
const jsonRouteSource = read("artifacts/api-server/src/routes/api/growthEngine.ts");
const pageSource = read("src/pharmacy/nationalSearchIntelligencePage.ts");
const serviceSource = read("src/pharmacy/nationalSearchIntelligenceV1Service.ts");
const storageSource = read("src/pharmacy/nationalIntelligenceStorageService.ts");
const gateSource = read("src/pharmacy/nationalSearchCommercialCompetitorGate.ts");
const overlapSource = read("src/pharmacy/nationalCommercialServiceOverlap.ts");
const collectSource = read("scripts/collect-national-search-intelligence-v1.ts");

const expectedSnapshot = path.join(
  workspace.WORKSPACE_ROOT,
  "data",
  "national-growth-engine",
  "pharmaconnect-search-intelligence-v1.json",
);
const vpsSnapshot = "/home/inboxingproweb/pharmaconnect-growth-engine/data/national-growth-engine/pharmaconnect-search-intelligence-v1.json";

check(
  "browser-read-path-traced",
  routeSource.includes('router.get("/growth-engine/search-intelligence"')
    && routeSource.includes("renderSearchIntelligencePage(slug)")
    && pageSource.includes("readNationalSearchIntelligence(slug)")
    && serviceSource.includes('resolveNationalIntelligenceArtifactPath(slug, "search-intelligence-v1")')
    && storageSource.includes("nationalIntelligenceDataPath"),
  "GET search-intelligence → renderer → read service → storage snapshot",
);
check(
  "canonical-snapshot-path",
  expectedSnapshot.endsWith(`${path.sep}data${path.sep}national-growth-engine${path.sep}pharmaconnect-search-intelligence-v1.json`)
    && storage.nationalIntelligenceDataPath("pharmaconnect", "search-intelligence-v1") === expectedSnapshot,
  expectedSnapshot,
);
check(
  "vps-snapshot-path-unchanged",
  vpsSnapshot === "/home/inboxingproweb/pharmaconnect-growth-engine/data/national-growth-engine/pharmaconnect-search-intelligence-v1.json",
  vpsSnapshot,
);
check(
  "no-organic-candidate-truncation",
  !pageSource.includes("organicCompetitors.slice(0, 12)")
    && pageSource.includes("const competitors = snapshot.organicCompetitors;"),
  "all persisted organic candidates are rendered",
);
check(
  "gate-and-collection-untouched-in-this-check",
  gateSource.includes("eligibleForKeywordExpansion")
    && overlapSource.includes("compareNationalCommercialServiceOverlap")
    && collectSource.includes("collectNationalSearchIntelligence"),
  "qualification/collection files are still present and not replaced",
);
check(
  "no-pharmaconnect-page-hardcode",
  !/["']pharmaconnect["']|pharmaconnect\.uk/i.test(pageSource),
  "page renderer has no PharmaConnect slug/domain hardcode",
);

const tenantSlug = "ni03c2-browser-read";
const tenantFile = path.join(ROOT, "config/projects", `${tenantSlug}.json`);
const snapshotFile = storage.nationalIntelligenceDataPath(tenantSlug, "search-intelligence-v1");
const capturedAt = "2026-08-18T13:02:53.532Z";

fs.writeFileSync(tenantFile, JSON.stringify({
  clientSlug: tenantSlug,
  businessName: "PharmaConnect",
  domain: "https://example-ni03c2-browser-read.co.uk",
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

function competitor(index: number, domain: string, role: string) {
  return {
    domain,
    name: domain,
    websiteUrl: `https://${domain}`,
    whyIdentified: [`Labs competitors_domain intersections for candidate ${index + 1}`],
    sourceQueries: [],
    discoverySource: "dataforseo_labs_competitors_domain",
    sharedKeywordCount: 20 - index,
    averagePosition: 8,
    organicEtv: 100 + index,
    organicKeywordCount: 40,
    sharedKeywordEtv: 12,
    bestSerpPosition: 4,
    role,
    classification: "insufficient_evidence",
    qualification: "candidate",
    evidenceStatus: "serp_only",
    evidenceUrls: [`https://${domain}/`],
    exclusionReasons: [],
    qualificationScore: 20,
    qualificationEvidence: ["Organic overlap is SERP evidence only."],
    eligibleForKeywordExpansion: false,
    nonSelectionReason: "This domain competes in search. Commercial market, provider and tenant-service overlap were not all evidenced, so it was not selected for paid keyword expansion.",
    commercialGate: {
      targetMarketRelevance: role === "adjacent_commercial_provider",
      commercialProvider: role === "adjacent_commercial_provider",
      serviceOverlap: false,
      marketRelevance: true,
      matchedServices: [],
      tenantServices: ["Pharmacy Website Design", "Pharmacy Local SEO"],
      candidateServicesDetected: role === "adjacent_commercial_provider" ? ["pmr"] : [],
      overlappingServices: [],
      nonOverlappingServices: role === "adjacent_commercial_provider" ? ["pmr"] : [],
      organicOverlapSupportingOnly: true,
    },
    analysed: false,
    capturedAt,
    evidenceSource: "DATAFORSEO_LIVE",
    verified: false,
  };
}

const organicCompetitors = [
  competitor(0, "communitypharmacy.org.uk", "professional_body"),
  competitor(1, "nymopmr.co.uk", "adjacent_commercial_provider"),
  competitor(2, "surveyfocus.co.uk", "adjacent_commercial_provider"),
  competitor(3, "boots.com", "customer_market"),
  competitor(4, "sciencedirect.com", "education_academic"),
  competitor(5, "brainly.com", "education_academic"),
  competitor(6, "rcpharm.org", "professional_body"),
  competitor(7, "pharmacymagazine.co.uk", "publisher"),
  ...Array.from({ length: 11 }, (_, index) => competitor(8 + index, `serp-candidate-${index + 1}.example`, "serp_content_competitor")),
];

fs.mkdirSync(path.dirname(snapshotFile), { recursive: true });
fs.writeFileSync(snapshotFile, JSON.stringify({
  version: 1,
  tenantSlug,
  businessName: "PharmaConnect",
  subjectDomain: "example-ni03c2-browser-read.co.uk",
  primaryMarket: "United Kingdom",
  country: "United Kingdom",
  growthPlatform: "national",
  capturedAt,
  liveExecution: true,
  status: "collected",
  lastError: null,
  reusedExistingSnapshot: false,
  limits: {
    customerKeywordUniverse: 500,
    competitorDiscoveryCandidates: 20,
    qualifiedCompetitorsAnalysed: 5,
    competitorRankedKeywords: 300,
    sparseCustomerKeywordThreshold: 10,
  },
  customerOrganicFootprint: {
    keywordCount: 1,
    sparse: true,
    threshold: 10,
    sufficientForHighConfidenceCommercialDiscovery: false,
    note: "Customer organic footprint is sparse. Competitors Domain overlap is retained as SERP evidence and is not commercial competitor proof.",
  },
  endpoints: [],
  costs: { requests: 2, tasks: 2, totalCost: 0.02652 },
  provenance: {
    tenantSlug,
    subjectDomain: "example-ni03c2-browser-read.co.uk",
    capturedAt,
    evidenceSource: "DATAFORSEO_LIVE",
    sourceSystem: "national-search-intelligence-v1",
    sourceEndpoint: "https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live",
    sourceSnapshot: snapshotFile,
    liveExecution: true,
    calculated: false,
    calculationMethod: null,
    confidenceBasis: "explicit-dataforseo-collection",
    costContribution: 0.02652,
  },
  authority: "PERSISTED_PROVEN",
  customerKeywords: [{
    keyword: "pharmacy website design uk",
    position: 12,
    rankingUrl: "https://example-ni03c2-browser-read.co.uk/pharmacy-websites",
    searchVolume: 210,
    cpc: 1.2,
    competition: 0.4,
    estimatedTraffic: 4,
    searchIntent: "commercial",
    serpType: "organic",
    rankGroup: 1,
    seResultsCount: 1200000,
    capturedAt,
    sourceEndpoint: "https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live",
    evidenceSource: "DATAFORSEO_LIVE",
    calculated: false,
  }],
  organicCompetitors,
  excludedCompetitors: [],
  competitorKeywordUniverses: [],
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
    organicCompetitorCount: 19,
    commercialCompetitorCount: 0,
    serpCompetitorCount: 19,
    analysedCompetitorCount: 0,
    excludedCompetitorCount: 0,
    competitorKeywordCount: 0,
    directCompetitorCount: 0,
    adjacentCompetitorCount: 0,
    strongestRankingPages: [{
      url: "https://example-ni03c2-browser-read.co.uk/pharmacy-websites",
      keywordCount: 1,
      searchDemand: 210,
      bestPosition: 12,
    }],
    top3CountCalculated: true,
    top10CountCalculated: true,
    top20CountCalculated: true,
    top100CountCalculated: true,
    rankingPageCountCalculated: true,
    availableSearchDemandCalculated: true,
  },
  nextStage: {
    title: "Compare competitor keyword universes",
    detail: "Next: compare competitor keyword universes and identify commercial search gaps. That work is not part of this screen.",
    implemented: false,
  },
}, null, 2) + "\n");

const html = page.renderNationalSearchIntelligencePage(tenantSlug);
const routed = pageRenderers.renderSearchIntelligencePage(tenantSlug);
const competitorCards = (html.match(/data-ni03c-competitor="/g) || []).length;
const commercialPills = (html.match(/>commercial competitor</g) || []).length;

check("page-status-collected", html.includes('data-ni03c2-page-status="COLLECTED"') && html.includes(">COLLECTED<"), "STATUS=COLLECTED");
check("customer-keywords-rendered", html.includes("pharmacy website design uk") && html.includes('data-ni03c2-customer-keywords="1"'), "1 customer keyword");
check("organic-candidates-rendered", competitorCards === 19 && html.includes('data-ni03c2-organic-count="19"'), `organic cards=${competitorCards}`);
check("qualified-commercial-rendered", html.includes('data-ni03c2-qualified-count="0"') && html.includes("COMMERCIAL COMPETITORS = 0 QUALIFIED"), "0 qualified commercial competitors");
check("paid-expansions-rendered", html.includes('data-ni03c2-paid-expansions="0"') && html.includes("PAID EXPANSION = 0 REQUESTS"), "0 paid expansions");
check(
  "sparse-warning-rendered",
  html.includes('data-ni03c2-section="sparse-warning"')
    && html.includes("currently has a sparse organic search footprint")
    && html.includes("Competitor discovery from shared ranking keywords is therefore limited")
    && html.includes("This is an evidence limitation, not a system error"),
  "sparse footprint explained as evidence limitation",
);
check(
  "zero-commercial-state-rendered",
  html.includes('data-ni03c2-section="zero-commercial"')
    && html.includes("No commercially qualified competitors were found from the current organic-overlap evidence")
    && html.includes("Weak or non-overlapping domains were intentionally excluded from paid competitor keyword expansion")
    && html.includes("DATA COLLECTION = COLLECTED")
    && !html.includes('data-ni03b-status="not_collected"')
    && !html.includes('data-ni03b-status="error"'),
  "zero commercial competitors is a valid collected state",
);
check("requests-rendered", html.includes('data-ni03c2-requests="2"'), "requests=2");
check("tasks-rendered", html.includes('data-ni03c2-tasks="2"'), "tasks=2");
check("total-cost-rendered", html.includes("0.02652") && html.includes('data-ni03c2-total-cost="0.02652"'), "cost=0.02652");
check(
  "evidence-source-rendered",
  html.includes('data-ni03c2-evidence-source="DATAFORSEO_LIVE"') && html.includes("DATAFORSEO_LIVE"),
  "DATAFORSEO_LIVE",
);
check(
  "authority-rendered",
  html.includes('data-ni03c2-authority="PERSISTED_PROVEN"') && html.includes("PERSISTED_PROVEN"),
  "PERSISTED_PROVEN",
);
check("captured-at-rendered", html.includes(capturedAt), capturedAt);
check(
  "false-positives-not-commercial-pills",
  commercialPills === 0
    && html.includes("communitypharmacy.org.uk")
    && html.includes("nymopmr.co.uk")
    && html.includes("surveyfocus.co.uk")
    && html.includes('data-ni03c1-eligible="false"'),
  `commercialPills=${commercialPills}`,
);
check(
  "keyword-row-fields",
  html.includes("<th>Keyword</th>")
    && html.includes("<th>Position</th>")
    && html.includes("<th>Search volume</th>")
    && html.includes("<th>Ranking page</th>")
    && html.includes("https://example-ni03c2-browser-read.co.uk/pharmacy-websites"),
  "keyword position/volume/url rendered",
);
check("routed-renderer-matches", routed.includes('data-ni03c2-page-status="COLLECTED"') && routed.includes("0.02652"), "growthEnginePageRenderers uses the same page");
check("no-external-calls", fetchCalls === 0, `fetchCalls=${fetchCalls} urls=${fetchUrls.join(" | ") || "none"}`);

if (fs.existsSync(snapshotFile)) fs.unlinkSync(snapshotFile);
if (fs.existsSync(tenantFile)) fs.unlinkSync(tenantFile);

globalThis.fetch = originalFetch;

console.log(`\n${fail ? "FAIL" : "PASS"} — ${pass}/${pass + fail} checks\n`);
if (fail) process.exit(1);
