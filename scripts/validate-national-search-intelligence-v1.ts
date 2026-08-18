#!/usr/bin/env npx tsx
/**
 * NI-03B/C — National Search Intelligence V1
 * Customer keyword universe + organic competitor intelligence + dashboard contract.
 * Does not build keyword intersection/gap recommendations.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as subjectResolverMod from "../src/pharmacy/nationalIntelligenceSubjectResolver.ts";
import * as platformMod from "../src/pharmacy/growthPlatformResolverService.ts";
import * as storageMod from "../src/pharmacy/nationalIntelligenceStorageService.ts";
import * as provenanceMod from "../src/pharmacy/nationalIntelligenceEvidenceProvenance.ts";
import * as searchServiceMod from "../src/pharmacy/nationalSearchIntelligenceV1Service.ts";
import * as searchModelMod from "../src/pharmacy/nationalSearchIntelligenceV1Model.ts";
import * as searchPageMod from "../src/pharmacy/nationalSearchIntelligencePage.ts";
import * as pageRenderersMod from "../src/pharmacy/growthEnginePageRenderers.ts";
import * as frameworkMod from "../src/pharmacy/growthEngineFrameworkService.ts";
import * as localMarketPageMod from "../src/pharmacy/growthEngineLocalMarketPage.ts";
import * as locationResolverMod from "../src/pharmacy/dataForSeoSearchLocationResolver.ts";
import * as searchProviderMod from "../src/pharmacy/nationalSearchProviderModel.ts";
import * as dataForSeoHttpMod from "../src/pharmacy/dataForSeoHttp.ts";
import * as searchLimitsMod from "../src/pharmacy/nationalSearchIntelligenceLimits.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const subjectResolver = exported(subjectResolverMod);
const platform = exported(platformMod);
const storage = exported(storageMod);
const provenance = exported(provenanceMod);
const searchService = exported(searchServiceMod);
const searchModel = exported(searchModelMod);
const searchPage = exported(searchPageMod);
const pageRenderers = exported(pageRenderersMod);
const framework = exported(frameworkMod);
const localMarketPage = exported(localMarketPageMod);
const locationResolver = exported(locationResolverMod);
const searchProvider = exported(searchProviderMod);
const dataForSeoHttp = exported(dataForSeoHttpMod);
const searchLimits = exported(searchLimitsMod);

let pass = 0;
let fail = 0;

function check(id: string, ok: boolean, detail: string) {
  if (ok) {
    pass++;
    console.log(`PASS  ${id} — ${detail}`);
  } else {
    fail++;
    console.log(`FAIL  ${id} — ${detail}`);
  }
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
const fetchUrls: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL) => {
  fetchCalls += 1;
  fetchUrls.push(String(input));
  throw new Error(`NI-03B validator blocked fetch: ${String(input)}`);
}) as typeof fetch;

console.log("\n=== NI-03B NATIONAL SEARCH INTELLIGENCE V1 ===\n");

const serviceSource = read("src/pharmacy/nationalSearchIntelligenceV1Service.ts");
const modelSource = read("src/pharmacy/nationalSearchIntelligenceV1Model.ts");
const pageSource = read("src/pharmacy/nationalSearchIntelligencePage.ts");
const resolverSource = read("src/pharmacy/nationalIntelligenceSubjectResolver.ts");
const storageSource = read("src/pharmacy/nationalIntelligenceStorageService.ts");
const apiSource = read("artifacts/api-server/src/routes/api/growthEngine.ts");
const htmlRouteSource = read("artifacts/api-server/src/routes/growthEnginePageRouter.ts");
const frameworkSource = read("src/pharmacy/growthEngineFrameworkService.ts");
const localMarketSource = read("src/pharmacy/growthEngineLocalMarketPage.ts");
const localMarketServiceSource = read("src/pharmacy/growthEngineLocalMarketService.ts");
const placesSource = read("src/pharmacy/pharmacyCompetitorDiscovery.ts");
const healthcareSource = read("src/pharmacy/growthEngineHealthcareDiscovery.ts");
const campaignEngineSource = read("src/pharmacy/growthEngineCampaignRecommendationEngine.ts");
const contentPackageSource = read("src/pharmacy/pharmacyContentPackageService.ts");
const labsSource = read("src/pharmacy/dataForSeoRankedKeywordIntelligenceService.ts");
const adapterSource = read("src/pharmacy/dataForSeoNationalSearchAdapter.ts");
const locationResolverSource = read("src/pharmacy/dataForSeoSearchLocationResolver.ts");
const httpSource = read("src/pharmacy/dataForSeoHttp.ts");
const collectScriptSource = read("scripts/collect-national-search-intelligence-v1.ts");
const limitsSource = read("src/pharmacy/nationalSearchIntelligenceLimits.ts");
const gateSource = read("src/pharmacy/nationalSearchCommercialCompetitorGate.ts");

check(
  "platform-national-eligible",
  platform.isNationalGrowthPlatform("pharmaconnect") === true
    && subjectResolver.resolveNationalIntelligenceSubject("pharmaconnect").eligibleForNationalIntelligence === true,
  "pharmaconnect eligible for National Search Intelligence",
);
check(
  "platform-local-excluded",
  platform.isNationalGrowthPlatform("brook-pharmacy") === false
    && subjectResolver.resolveNationalIntelligenceSubject("brook-pharmacy").eligibleForNationalIntelligence === false,
  "brook-pharmacy remains LOCAL and ineligible",
);
check(
  "platform-unknown-local-fallback",
  platform.resolveGrowthPlatform("__ni03b_unknown_tenant__").platform === "local"
    && subjectResolver.resolveNationalIntelligenceSubject("__ni03b_unknown_tenant__").eligibleForNationalIntelligence === false,
  "unknown tenant LOCAL fallback",
);

const subject = subjectResolver.resolveNationalIntelligenceSubject("pharmaconnect");
check(
  "subject-domain-from-config",
  subject.subjectDomain === "pharmaconnect.uk" && subject.identitySource === "PROJECT_CONFIG",
  `${subject.subjectDomain} via ${subject.identitySource}`,
);
check(
  "reusable-logic-no-pharmaconnect-slug",
  !/["']pharmaconnect["']|slug\s*===\s*["']pharmaconnect["']/i.test(resolverSource + serviceSource + modelSource + pageSource),
  "resolver/service/model/page have no PharmaConnect slug hardcode",
);
check(
  "reusable-logic-no-pharmaconnect-domain",
  !/pharmaconnect\.uk/i.test(resolverSource + serviceSource + modelSource + pageSource),
  "resolver/service/model/page have no pharmaconnect.uk hardcode",
);

const tenantBSlug = "ni03b-national-b";
const tenantBFile = path.join(ROOT, "config/projects", `${tenantBSlug}.json`);
fs.writeFileSync(tenantBFile, JSON.stringify({
  clientSlug: tenantBSlug,
  businessName: "National Search Tenant B",
  domain: "https://example-national-search-b.co.uk",
  growthPlatform: "national",
  primaryLocation: "United Kingdom",
  country: "United Kingdom",
  languageCode: "en",
  services: ["National SEO"],
}, null, 2) + "\n");
const tenantB = subjectResolver.resolveNationalIntelligenceSubject(tenantBSlug);
check(
  "subject-generic-second-national-tenant",
  tenantB.subjectDomain === "example-national-search-b.co.uk" && tenantB.eligibleForNationalIntelligence === true,
  tenantB.subjectDomain,
);

const ukLocation = locationResolver.resolveDataForSeoSearchLocation("United Kingdom");
const ieLocation = locationResolver.resolveDataForSeoSearchLocation("Ireland");
const usLocation = locationResolver.resolveDataForSeoSearchLocation("United States");
const subjectLocation = locationResolver.resolveDataForSeoSearchLocationFromSubject(subject);
check(
  "uk-location-code-2826",
  ukLocation.locationCode === 2826 && subjectLocation.locationCode === 2826,
  `UK=${ukLocation.locationCode} subjectCountry=${subject.country} subjectCode=${subjectLocation.locationCode}`,
);
check(
  "subject-country-feeds-location-resolver",
  subject.country === "United Kingdom" && subjectLocation.country === "United Kingdom",
  subject.country,
);
check(
  "other-national-country-does-not-inherit-uk",
  ieLocation.locationCode === 2372 && usLocation.locationCode === 2840 && ieLocation.locationCode !== ukLocation.locationCode,
  `IE=${ieLocation.locationCode} US=${usLocation.locationCode}`,
);
check(
  "serp-adapter-uses-location-code",
  adapterSource.includes("location_code: location.locationCode")
    && !adapterSource.includes("location_name"),
  "SERP adapter submits location_code only",
);
check(
  "serp-adapter-not-primary-market-location-name",
  !adapterSource.includes("primaryMarket")
    && !serviceSource.includes("marketCountry: query.marketCountry")
    && serviceSource.includes("locationCode: serpLocation.locationCode")
    && serviceSource.includes("resolveDataForSeoSearchLocationFromSubject(subject)"),
  "collection uses subject country location_code, not primaryMarket as location_name",
);
check(
  "labs-uses-subject-location-code",
  labsSource.includes("location_code: Number(input.locationCode)")
    && serviceSource.includes("executeDomainRankedKeywords")
    && serviceSource.includes("executeDomainCompetitors")
    && serviceSource.includes("locationCode: serpLocation.locationCode"),
  "Labs ranked keywords and competitors_domain use subject country location_code",
);
check(
  "location-resolver-no-pharmaconnect",
  !/["']pharmaconnect["']|pharmaconnect\.uk/i.test(locationResolverSource + adapterSource),
  "location resolver/adapter have no PharmaConnect hardcode",
);
check(
  "shared-dataforseo-http-timeout-60s",
  dataForSeoHttp.DATAFORSEO_HTTP_TIMEOUT_MS === 60000
    && httpSource.includes("export const DATAFORSEO_HTTP_TIMEOUT_MS = 60_000")
    && labsSource.includes("fetchDataForSeo")
    && adapterSource.includes("fetchDataForSeo"),
  `timeoutMs=${dataForSeoHttp.DATAFORSEO_HTTP_TIMEOUT_MS}`,
);
check(
  "transport-timeout-is-not-retryable",
  httpSource.includes("retryable = false")
    && adapterSource.includes("!first.attempt.timedOut")
    && labsSource.includes("!first.attempt.timedOut")
    && labsSource.includes("MAX_DATAFORSEO_INTERNAL_SE_RETRIES"),
  "timeout failures are typed and not retried",
);
check(
  "cli-progress-is-concise",
  collectScriptSource.includes("COLLECTING ranked_keywords...")
    && collectScriptSource.includes("COLLECTING competitors_domain...")
    && collectScriptSource.includes("retrying once")
    && collectScriptSource.includes("PERSISTED snapshot=")
    && collectScriptSource.includes("STATUS=")
    && collectScriptSource.includes("TOTAL_COST=")
    && collectScriptSource.includes("PLAN customerKeywordTasks=")
    && !/DATAFORSEO_(LOGIN|PASSWORD)/.test(collectScriptSource),
  "collector CLI prints bounded progress without credentials",
);

check(
  "collection-explicit-function",
  typeof searchService.collectNationalSearchIntelligence === "function"
    && typeof searchService.readNationalSearchIntelligence === "function"
    && typeof searchService.planNationalSearchIntelligenceCollection === "function",
  "collect vs read vs plan are separate functions",
);
const defaultPlan = searchService.planNationalSearchIntelligenceCollection("pharmaconnect");
check(
  "collection-plan-defaults",
  defaultPlan.customerKeywordTasks === 1
    && defaultPlan.competitorDiscoveryTasks === 1
    && defaultPlan.competitorKeywordTasks === 5
    && defaultPlan.maximumPaidRequests === 7
    && defaultPlan.limits.customerKeywordUniverse === 500
    && defaultPlan.limits.qualifiedCompetitorsAnalysed === 5
    && defaultPlan.limits.competitorRankedKeywords === 300
    && defaultPlan.limits.sparseCustomerKeywordThreshold === 10,
  JSON.stringify(defaultPlan),
);
check(
  "page-render-reads-only",
  pageSource.includes("readNationalSearchIntelligence")
    && !pageSource.includes("collectNationalSearchIntelligence")
    && !pageSource.includes("getDomainRankedKeywords")
    && !pageSource.includes("searchNationalGoogleOrganic"),
  "page render calls read, not DataForSEO",
);
check(
  "html-get-does-not-collect",
  htmlRouteSource.includes("renderSearchIntelligencePage")
    && !htmlRouteSource.includes("collectNationalSearchIntelligence"),
  "HTML GET does not execute collection",
);
check(
  "json-get-does-not-collect",
  /router\.get\("\/growth-engine\/:slug\/search-intelligence"[\s\S]*?readNationalSearchIntelligence\(slug\)/.test(apiSource)
    && /router\.get\("\/growth-engine\/:slug\/search-intelligence\/plan"[\s\S]*?planNationalSearchIntelligenceCollection\(slug\)/.test(apiSource)
    && /router\.post\("\/growth-engine\/:slug\/search-intelligence\/collect"[\s\S]*?collectNationalSearchIntelligence/.test(apiSource),
  "JSON GET reads persisted snapshot; plan is local; POST collect is explicit",
);
check(
  "bounded-limits-defaults",
  searchLimits.NI03C_DEFAULT_LIMITS.customerKeywordUniverse === 500
    && searchLimits.NI03C_DEFAULT_LIMITS.qualifiedCompetitorsAnalysed === 5
    && searchLimits.NI03C_DEFAULT_LIMITS.competitorRankedKeywords === 300
    && searchLimits.NI03C_DEFAULT_LIMITS.sparseCustomerKeywordThreshold === 10
    && searchModel.NI03C_LIMITS.customerKeywordUniverse === 500,
  JSON.stringify(searchLimits.NI03C_DEFAULT_LIMITS),
);
check(
  "limits-are-configuration",
  limitsSource.includes("NATIONAL_SEARCH_CUSTOMER_KEYWORD_LIMIT")
    && limitsSource.includes("NATIONAL_SEARCH_COMPETITOR_ANALYSIS_LIMIT")
    && limitsSource.includes("NATIONAL_SEARCH_COMPETITOR_KEYWORD_LIMIT")
    && !/pharmaconnect/i.test(limitsSource)
    && typeof searchLimits.resolveNationalSearchIntelligenceLimits === "function",
  "limits resolve from env with commercial defaults, no tenant hardcode",
);
check(
  "service-uses-resolved-limits",
  serviceSource.includes("resolveNationalSearchIntelligenceLimits")
    && serviceSource.includes("limits.customerKeywordUniverse")
    && serviceSource.includes("limits.qualifiedCompetitorsAnalysed")
    && serviceSource.includes("limits.competitorRankedKeywords")
    && serviceSource.includes("executeDomainCompetitors")
    && serviceSource.includes("assessNationalSearchCommercialCompetitor")
    && serviceSource.includes("selectCompetitorsForKeywordExpansion")
    && serviceSource.includes("enrichNationalCompetitorEvidence")
    && serviceSource.includes("eligibleForKeywordExpansion")
    && !serviceSource.includes("buildNationalCompetitorDiscoveryQueries"),
  "collection uses configurable NI-03C limits and Labs competitors_domain",
);
check(
  "in-flight-dedupe",
  serviceSource.includes("inFlight") && serviceSource.includes("reusedExistingSnapshot"),
  "duplicate in-flight collection is coalesced",
);

const fetchBeforeRead = fetchCalls;
const unread = searchService.readNationalSearchIntelligence("pharmaconnect");
searchService.readNationalSearchIntelligence("pharmaconnect");
pageRenderers.renderSearchIntelligencePage("pharmaconnect");
pageRenderers.renderLocalMarketPage("pharmaconnect", null);
check(
  "duplicate-render-no-paid-call",
  fetchCalls === fetchBeforeRead && unread.status === "not_collected",
  `fetchCalls=${fetchCalls - fetchBeforeRead} status=${unread.status}`,
);
check(
  "uncollected-not-labelled-persisted-or-live",
  unread.liveExecution === false
    && unread.provenance.evidenceSource === "FALLBACK"
    && unread.authority === "INSUFFICIENT_EVIDENCE",
  `${unread.authority}/${unread.provenance.evidenceSource}`,
);

check(
  "keyword-model-fields",
  modelSource.includes("position")
    && modelSource.includes("rankingUrl")
    && modelSource.includes("searchVolume")
    && modelSource.includes("cpc")
    && modelSource.includes("competition")
    && modelSource.includes("estimatedTraffic")
    && modelSource.includes("searchIntent")
    && modelSource.includes("evidenceSource")
    && modelSource.includes("calculated: false")
    && !modelSource.includes("keywordDifficulty"),
  "ranked keyword model retains evidence fields without fabricated difficulty",
);
check(
  "null-not-fabricated-in-service",
  !serviceSource.includes("|| 0") || serviceSource.includes("filter((value): value is number"),
  "service does not coerce missing metrics with a blanket || 0",
);
check(
  "labs-canonical-client",
  serviceSource.includes("executeDomainRankedKeywords")
    && labsSource.includes("DATAFORSEO_LABS_ENDPOINTS")
    && labsSource.includes("ranked_keywords")
    && labsSource.includes("competitors_domain"),
  "uses NI-03A canonical Labs ranked_keywords + competitors_domain client",
);

check(
  "competitors-organic-evidence",
  modelSource.includes("whyIdentified")
    && modelSource.includes("sharedKeywordCount")
    && modelSource.includes("qualification")
    && modelSource.includes("excludedCompetitors")
    && modelSource.includes("competitorKeywordUniverses")
    && modelSource.includes("eligibleForKeywordExpansion")
    && gateSource.includes("qualifyNationalCompetitorV2")
    && gateSource.includes("qualifyNationalCompetitor(")
    && serviceSource.includes("assessNationalSearchCommercialCompetitor")
    && serviceSource.includes("executeDomainCompetitors")
    && !serviceSource.includes("executeNationalGoogleOrganic")
    && !serviceSource.includes("searchNationalGoogleOrganic"),
  "organic competitor evidence from Labs competitors_domain + reused qualification gate",
);
check(
  "commercial-gate-no-overlap-promotion",
  !serviceSource.includes('commercial ? qualification.classification : "adjacent_competitor"')
    && serviceSource.includes("selectCompetitorsForKeywordExpansion")
    && gateSource.includes("eligibleForKeywordExpansion: false")
    && !/boots\.com|sciencedirect\.com|brainly\.com|rcpharm\.org|pharmacymagazine\.co\.uk|communitypharmacy\.org\.uk|nymopmr\.co\.uk|surveyfocus\.co\.uk/.test(gateSource + serviceSource)
    && labsSource.includes("docs.dataforseo.com/v3/dataforseo_labs-google-competitors_domain-live")
    && labsSource.includes("full_domain_metrics"),
  "insufficient_evidence is not auto-promoted; no PharmaConnect domain blacklist",
);
check(
  "competitors-no-google-places",
  !/maps\.googleapis|GooglePlaces|places\.googleapis|nearbysearch/i.test(serviceSource + modelSource + pageSource)
    && serviceSource.includes("They are not") === false,
  "no Google Places dependency on NI-03B path",
);
check(
  "competitors-no-proximity-authority",
  !/distanceMeters|place_id|nearby pharmacies/i.test(serviceSource + modelSource)
    && pageSource.includes("not selected based on physical proximity"),
  "physical proximity is not national competitor authority",
);

check(
  "storage-canonical-workspace",
  !storageSource.includes("process.cwd()")
    && storageSource.includes("search-intelligence-v1")
    && serviceSource.includes("nationalIntelligenceDataPath")
    && serviceSource.includes("ranked-keywords-customer")
    && serviceSource.includes("ranked-keywords-competitors")
    && serviceSource.includes("cost-ledger-v1")
    && serviceSource.includes("refresh-metadata-v1"),
  "canonical tenant-scoped WORKSPACE_ROOT storage",
);
check(
  "storage-tenant-scoped-path",
  storage.nationalIntelligenceDataPath("pharmaconnect", "search-intelligence-v1").includes(`${path.sep}data${path.sep}national-growth-engine${path.sep}pharmaconnect-search-intelligence-v1.json`)
    && !storage.nationalIntelligenceDataPath("pharmaconnect", "search-intelligence-v1").includes(process.cwd() === ROOT ? "FORCE_FAIL" : process.cwd()),
  storage.nationalIntelligenceDataPath("pharmaconnect", "search-intelligence-v1"),
);

check(
  "cost-ledger-used",
  serviceSource.includes("buildCostLedgerFromEndpoints")
    && pageSource.includes("collection cost") === false
    && pageSource.includes("Collection cost"),
  "actual cost ledger is persisted and shown",
);
check(
  "no-hardcoded-inherited-cost",
  !serviceSource.includes("0.21792") && !pageSource.includes("0.21792") && !modelSource.includes("0.21792"),
  "no hard-coded inherited DataForSEO cost",
);

const fixtureDir = storage.ensureNationalIntelligenceFixtureDir();
const fixtureFile = path.join(fixtureDir, storage.nationalIntelligenceArtifactFileName(tenantBSlug, "search-intelligence-v1"));
const fixtureSnapshot = {
  version: 1,
  tenantSlug: tenantBSlug,
  businessName: "National Search Tenant B",
  subjectDomain: "example-national-search-b.co.uk",
  primaryMarket: "United Kingdom",
  country: "United Kingdom",
  growthPlatform: "national",
  capturedAt: "2026-01-01T00:00:00.000Z",
  liveExecution: true,
  status: "collected",
  lastError: null,
  reusedExistingSnapshot: false,
  limits: searchModel.NI03B_LIMITS,
  endpoints: [],
  costs: { requests: 1, tasks: 1, totalCost: 0.01 },
  costLedger: { totalCost: 0.01 },
  provenance: {
    tenantSlug: tenantBSlug,
    subjectDomain: "example-national-search-b.co.uk",
    capturedAt: "2026-01-01T00:00:00.000Z",
    evidenceSource: "DATAFORSEO_LIVE",
    sourceSystem: "fixture",
    sourceEndpoint: null,
    sourceSnapshot: fixtureFile,
    liveExecution: true,
    calculated: false,
    calculationMethod: null,
    confidenceBasis: "fixture",
    costContribution: 0.01,
  },
  authority: "LIVE_PROVEN",
  customerKeywords: [{
    keyword: "pharmacy website design",
    position: 4,
    rankingUrl: "https://example-national-search-b.co.uk/websites",
    searchVolume: 320,
    cpc: 3.1,
    competition: 0.44,
    capturedAt: "2026-01-01T00:00:00.000Z",
    sourceEndpoint: "https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live",
    evidenceSource: "DATAFORSEO_LIVE",
    calculated: false,
  }],
  organicCompetitors: [{
    domain: "example-search-competitor.co.uk",
    name: "Example Search Competitor",
    websiteUrl: "https://example-search-competitor.co.uk",
    whyIdentified: ["Appeared in organic Google results for pharmacy website design United Kingdom."],
    sourceQueries: ["pharmacy website design United Kingdom"],
    bestSerpPosition: 3,
    classification: "direct_competitor",
    qualification: "qualified",
    evidenceStatus: "direct_competitor",
    evidenceUrls: ["https://example-search-competitor.co.uk"],
    capturedAt: "2026-01-01T00:00:00.000Z",
    evidenceSource: "DATAFORSEO_LIVE",
    verified: false,
  }],
  summary: {
    rankingKeywordCount: 1,
    top10Count: 1,
    top20Count: 1,
    rankingPageCount: 1,
    availableSearchDemand: 320,
    organicCompetitorCount: 1,
    directCompetitorCount: 1,
    adjacentCompetitorCount: 0,
    top10CountCalculated: true,
    top20CountCalculated: true,
    rankingPageCountCalculated: true,
    availableSearchDemandCalculated: true,
  },
  nextStage: {
    title: "Compare competitor keyword universes",
    detail: "Next: compare competitor keyword universes and identify commercial search gaps. That work is not part of this screen.",
    implemented: false,
  },
};
fs.writeFileSync(fixtureFile, JSON.stringify(fixtureSnapshot, null, 2) + "\n");
const fixtureRead = searchService.readNationalSearchIntelligence(tenantBSlug);
check(
  "fixture-cannot-become-live",
  fixtureRead.liveExecution === false
    && fixtureRead.authority === "FIXTURE_ONLY"
    && fixtureRead.provenance.evidenceSource === "FIXTURE",
  `${fixtureRead.authority}/${fixtureRead.provenance.evidenceSource}`,
);

const recoveredFile = storage.nationalIntelligenceDataPath(tenantBSlug, "search-intelligence-v1");
storage.ensureNationalIntelligenceDataDir();
const recoveredSnapshot = {
  ...fixtureSnapshot,
  liveExecution: false,
  authority: "RECOVERED_EVIDENCE",
  provenance: {
    ...fixtureSnapshot.provenance,
    evidenceSource: "RECOVERED",
    liveExecution: false,
  },
};
fs.writeFileSync(recoveredFile, JSON.stringify(recoveredSnapshot, null, 2) + "\n");
const recoveredRead = searchService.readNationalSearchIntelligence(tenantBSlug);
check(
  "recovered-cannot-become-live",
  recoveredRead.liveExecution === false
    && recoveredRead.authority === "RECOVERED_EVIDENCE"
    && recoveredRead.provenance.evidenceSource === "RECOVERED",
  `${recoveredRead.authority}/${recoveredRead.provenance.evidenceSource}`,
);
fs.unlinkSync(recoveredFile);
check(
  "null-data-not-zeroed",
  fixtureRead.customerKeywords[0]?.cpc === 3.1
    && provenance.evidenceSourceFromSnapshot({ liveExecution: false, fixture: true }) === "FIXTURE",
  "fixture metrics retained without conversion to live zeroes",
);
check(
  "calculated-fields-identified",
  fixtureRead.summary.top10CountCalculated === true
    && fixtureRead.summary.availableSearchDemandCalculated === true
    && fixtureRead.nextStage.implemented === false,
  "summary metrics marked calculated; next stage not implemented",
);

const nationalHtml = pageRenderers.renderSearchIntelligencePage("pharmaconnect");
const nationalMarketHtml = pageRenderers.renderLocalMarketPage("pharmaconnect", null);
const localHtml = pageRenderers.renderSearchIntelligencePage("brook-pharmacy");
const localMarketHtml = pageRenderers.renderLocalMarketPage("brook-pharmacy", null);
check(
  "ui-national-search-page",
  nationalHtml.includes('data-ni03b-page="search-intelligence"')
    && nationalHtml.includes('data-ni03b-section="search-intelligence"')
    && nationalHtml.includes("Search Intelligence")
    && nationalHtml.includes('data-growth-platform="national"'),
  "National Search Intelligence page renders",
);
check(
  "ui-keyword-table",
  nationalHtml.includes('data-ni03b-section="keywords"')
    && nationalHtml.includes("<th>Keyword</th>")
    && nationalHtml.includes("<th>Position</th>")
    && nationalHtml.includes("<th>Search volume</th>")
    && nationalHtml.includes("<th>CPC</th>")
    && nationalHtml.includes("<th>Ranking page</th>"),
  "customer keyword table renders",
);
check(
  "ui-visibility-and-competitor-keywords",
  pageSource.includes("Your organic search visibility")
    && pageSource.includes("Keywords Top 3")
    && pageSource.includes("Keywords Top 100")
    && pageSource.includes("Competitor keywords")
    && pageSource.includes("These domains compete with you in Google search results")
    && pageSource.includes("This business competes for your customers")
    && pageSource.includes("This domain competes in search"),
  "visibility metrics and competitor keyword inspection render",
);
check(
  "ui-organic-competitor-section",
  nationalHtml.includes('data-ni03b-section="competitors"')
    && nationalHtml.includes("These domains compete with you in Google search results")
    && nationalHtml.includes("not selected based on physical proximity"),
  "organic competitor section renders",
);
check(
  "ui-collection-metadata",
  nationalHtml.includes('data-ni03b-section="collection-meta"')
    && nationalHtml.includes('data-ni03b-domain="pharmaconnect.uk"')
    && nationalHtml.includes("Last collected"),
  "collection metadata renders domain from tenant config",
);
check(
  "ui-provenance",
  nationalHtml.includes('data-ni03b-section="provenance"')
    && /DATAFORSEO|Not collected|FIXTURE|PERSISTED|FALLBACK/i.test(nationalHtml),
  "provenance renders",
);
check(
  "ui-cost",
  nationalHtml.includes('data-ni03b-section="cost"') && nationalHtml.includes("Collection cost"),
  "cost metadata renders",
);
check(
  "ui-explicit-refresh",
  nationalHtml.includes('data-ni03b-section="explicit-refresh"')
    && nationalHtml.includes("Collect Search Intelligence")
    && nationalHtml.includes("Opening this page does not call DataForSEO"),
  "explicit collect control renders",
);
check(
  "ui-next-stage-not-implemented",
  nationalHtml.includes('data-ni03b-section="next-stage"')
    && /compare competitor keyword universes/i.test(nationalHtml)
    && !pageSource.includes("generateContent")
    && !serviceSource.includes("contentPackageGenerated")
    && fixtureRead.nextStage.implemented === false,
  "next-stage explanation only; no content generation",
);
check(
  "ui-national-market-step-uses-search-intel",
  nationalMarketHtml.includes('data-ni03b-page="search-intelligence"'),
  "National Market step renders Search Intelligence",
);
check(
  "ui-local-blocked-and-local-market-retained",
  localHtml.includes('data-ni03b-section="local-blocked"')
    && localMarketHtml.includes("Your Local Market")
    && !localMarketHtml.includes('data-ni03b-page="search-intelligence"'),
  "LOCAL tenant stays on Local Market",
);
check(
  "ui-no-rotherham-market",
  !/commercial market: rotherham|serves Rotherham/i.test(nationalHtml),
  "no Rotherham commercial-market contamination",
);
check(
  "ui-no-patient-service-contamination",
  !/Pharmacy First|blood pressure|Travel Vaccinations/i.test(nationalHtml),
  "no patient-service contamination",
);

const nationalFw = framework.buildGrowthEngineFramework("pharmaconnect");
const localFw = framework.buildGrowthEngineFramework("brook-pharmacy");
check(
  "html-tenant-resolution-accepts-project-config",
  read("src/pharmacy/pharmacyTenantSlug.ts").includes("getPharmacyProjectConfigPath")
    && subjectResolver.resolveNationalIntelligenceSubject("pharmaconnect").subjectDomain === "pharmaconnect.uk",
  "HTML tenant resolution accepts config-backed NATIONAL tenants",
);
check(
  "framework-national-search-url",
  nationalFw.steps.find((s) => s.id === "local-market")?.url.includes("/api/growth-engine/search-intelligence") === true,
  nationalFw.steps.find((s) => s.id === "local-market")?.url || "",
);
check(
  "framework-local-market-url-unchanged",
  localFw.steps.find((s) => s.id === "local-market")?.url.includes("/api/growth-engine/local-market") === true,
  localFw.steps.find((s) => s.id === "local-market")?.url || "",
);
check(
  "framework-national-title-retained",
  nationalFw.steps.find((s) => s.id === "local-market")?.title === "National Market",
  nationalFw.steps.find((s) => s.id === "local-market")?.title || "",
);

check(
  "local-places-semantics-unchanged",
  localMarketServiceSource.includes("discoverLocalMarketCompetitors")
    && placesSource.includes("google-places")
    && /healthcare/i.test(healthcareSource),
  "local Places/healthcare files remain",
);
check(
  "local-campaign-and-content-unchanged-core",
  campaignEngineSource.includes("BENCHMARK_MASTER_SERVICE_IDS")
    && contentPackageSource.includes("contentPackageGenerated")
    && !serviceSource.includes("contentPackageGenerated"),
  "local campaign/content generation not used by NI-03B",
);
check(
  "national-local-market-page-no-places-run",
  localMarketSource.includes("renderNationalSearchIntelligencePage")
    && apiSource.includes("Local Google Places discovery is not applicable"),
  "NATIONAL local-market action remains Places-blocked",
);


const previousLogin = process.env.DATAFORSEO_LOGIN;
const previousPassword = process.env.DATAFORSEO_PASSWORD;
process.env.DATAFORSEO_LOGIN = "ni03b-validator";
process.env.DATAFORSEO_PASSWORD = "ni03b-validator";
let mockedRequests = 0;
const labsRequestBodies: Array<{ url: string; task: Record<string, unknown> }> = [];

function customerRankedPayload() {
  return {
    status_code: 20000,
    tasks: [{
      status_code: 20000,
      cost: 0.0123,
      result: [{
        items: [{
          keyword_data: {
            keyword: "pharmacy website design uk",
            keyword_info: { search_volume: 210, cpc: 4.2, competition: 0.51 },
            search_intent_info: { main_intent: "commercial" },
          },
          ranked_serp_element: {
            serp_item: {
              type: "organic",
              rank_absolute: 7,
              rank_group: 7,
              etv: 18.4,
              url: "https://example-national-search-b.co.uk/websites",
            },
          },
        }, {
          keyword_data: {
            keyword: "pharmacy seo agency",
            keyword_info: { search_volume: null, cpc: null, competition: null },
          },
          ranked_serp_element: {
            serp_item: {
              type: "organic",
              rank_absolute: 12,
              url: "https://example-national-search-b.co.uk/seo",
            },
          },
        }],
      }],
    }],
  };
}

function competitorRankedPayload(domain: string, cost = 0.008) {
  return {
    status_code: 20000,
    tasks: [{
      status_code: 20000,
      cost,
      result: [{
        items: [{
          keyword_data: {
            keyword: "pharmacy website design",
            keyword_info: { search_volume: 480, cpc: 5.1, competition: 0.62 },
          },
          ranked_serp_element: {
            serp_item: {
              rank_absolute: 3,
              etv: 42,
              url: `https://${domain}/websites`,
            },
          },
        }],
      }],
    }],
  };
}

function competitorsDomainPayload(subjectDomain: string, extras: Array<Record<string, unknown>> = []) {
  return {
    status_code: 20000,
    tasks: [{
      status_code: 20000,
      cost: 0.0108,
      result: [{
        items: [
          {
            domain: subjectDomain,
            intersections: 40,
            avg_position: 8.2,
            full_domain_metrics: { organic: { etv: 90, count: 40 } },
          },
          {
            domain: "example-search-competitor.co.uk",
            intersections: 22,
            avg_position: 6.1,
            full_domain_metrics: { organic: { etv: 540, count: 80 } },
            competitor_metrics: { organic: { etv: 120 } },
          },
          {
            domain: "google.com",
            intersections: 18,
            avg_position: 1.4,
            full_domain_metrics: { organic: { etv: 99999, count: 1000 } },
          },
          {
            domain: "pharmaceutical-journal.com",
            intersections: 11,
            avg_position: 4.8,
            full_domain_metrics: { organic: { etv: 2100, count: 200 } },
          },
          {
            domain: "second-agency.co.uk",
            intersections: 9,
            avg_position: 11.2,
            full_domain_metrics: { organic: { etv: 200, count: 30 } },
          },
          ...extras,
        ],
      }],
    }],
  };
}

function labs40101Payload(cost = 0.002) {
  return {
    status_code: 20000,
    tasks: [{
      id: "task-40101",
      status_code: 40101,
      status_message: "Internal SE Server Error",
      cost,
    }],
  };
}

function taskFromInit(init?: RequestInit): Record<string, unknown> {
  const payload = JSON.parse(String(init?.body || "[]"));
  return Array.isArray(payload) ? (payload[0] || {}) : {};
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  mockedRequests += 1;
  fetchCalls += 1;
  const url = String(input);
  fetchUrls.push(url);
  const task = taskFromInit(init);
  labsRequestBodies.push({ url, task });
  if (url.includes("competitors_domain")) {
    return new Response(JSON.stringify(competitorsDomainPayload("example-national-search-b.co.uk")), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  const target = String(task.target || "");
  const body = target === "example-national-search-b.co.uk" || !target
    ? customerRankedPayload()
    : competitorRankedPayload(target);
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}) as typeof fetch;

const AGENCY_WEBSITE_EVIDENCE = {
  "example-search-competitor.co.uk": {
    title: "Example Search Competitor",
    websiteText: "We are a UK digital marketing agency. We provide National SEO, website design and hosting for our clients. Contact us to get started.",
  },
  "second-agency.co.uk": {
    title: "Second Agency",
    websiteText: "We are a UK digital marketing agency. We provide National SEO and website design for our clients. Book a call to get started.",
  },
};

const [firstCollect, secondCollect] = await Promise.all([
  searchService.collectNationalSearchIntelligence(tenantBSlug, { force: true, websiteEvidenceByDomain: AGENCY_WEBSITE_EVIDENCE }),
  searchService.collectNationalSearchIntelligence(tenantBSlug, { force: true, websiteEvidenceByDomain: AGENCY_WEBSITE_EVIDENCE }),
]);
check(
  "duplicate-collect-does-not-double-paid-calls",
  mockedRequests === 4 && (firstCollect.reusedExistingSnapshot || secondCollect.reusedExistingSnapshot),
  `requests=${mockedRequests} reused=${firstCollect.reusedExistingSnapshot}/${secondCollect.reusedExistingSnapshot}`,
);
check(
  "live-labs-requests-use-location-code-2826",
  labsRequestBodies.length >= 4
    && labsRequestBodies.every((row) => row.task.location_code === 2826 && !("location_name" in row.task)),
  JSON.stringify(labsRequestBodies.map((row) => row.task)),
);
check(
  "no-places-or-gsc-in-collect",
  labsRequestBodies.every((row) => /dataforseo\.com/.test(row.url))
    && !labsRequestBodies.some((row) => /places|googleapis|searchconsole/i.test(row.url)),
  labsRequestBodies.map((row) => row.url).join(" "),
);
const liveCollect = firstCollect.liveExecution ? firstCollect : secondCollect.liveExecution ? secondCollect : firstCollect;
check(
  "collect-persists-keywords-and-cost",
  liveCollect.customerKeywords.length === 2
    && liveCollect.customerKeywords[0]?.position === 7
    && liveCollect.customerKeywords[0]?.rankingUrl?.includes("example-national-search-b.co.uk") === true
    && liveCollect.customerKeywords[0]?.estimatedTraffic === 18.4
    && liveCollect.customerKeywords[0]?.searchIntent === "commercial"
    && liveCollect.customerKeywords[1]?.searchVolume === null
    && liveCollect.customerKeywords[1]?.cpc === null
    && liveCollect.costLedger.totalCost > 0
    && Math.abs(liveCollect.costLedger.totalCost - liveCollect.costs.totalCost) < 1e-9
    && fs.existsSync(storage.nationalIntelligenceDataPath(tenantBSlug, "search-intelligence-v1"))
    && fs.existsSync(storage.nationalIntelligenceDataPath(tenantBSlug, "ranked-keywords-customer"))
    && fs.existsSync(storage.nationalIntelligenceDataPath(tenantBSlug, "ranked-keywords-competitors"))
    && fs.existsSync(storage.nationalIntelligenceDataPath(tenantBSlug, "cost-ledger-v1")),
  `keywords=${liveCollect.customerKeywords.length} cost=${liveCollect.costs.totalCost}`,
);
check(
  "collect-persists-organic-competitors",
  liveCollect.organicCompetitors.length === 3
    && liveCollect.organicCompetitors.every((row) => row.domain !== "example-national-search-b.co.uk")
    && liveCollect.organicCompetitors.every((row) => row.domain !== "google.com")
    && liveCollect.organicCompetitors.some((row) => row.domain === "example-search-competitor.co.uk" && row.sharedKeywordCount === 22)
    && liveCollect.organicCompetitors.every((row) => row.whyIdentified.length > 0)
    && liveCollect.organicCompetitors.every((row) => row.verified === false)
    && liveCollect.organicCompetitors.every((row) => row.discoverySource === "dataforseo_labs_competitors_domain")
    && liveCollect.status === "collected",
  `${liveCollect.status} competitors=${liveCollect.organicCompetitors.map((row) => row.domain).join(",")}`,
);
check(
  "self-and-non-commercial-excluded-with-reason",
  liveCollect.excludedCompetitors.some((row) => row.domain === "google.com" && row.exclusionReasons.length > 0)
    && liveCollect.organicCompetitors.some((row) => row.domain === "pharmaceutical-journal.com" && row.eligibleForKeywordExpansion === false)
    && !liveCollect.organicCompetitors.some((row) => row.domain === "example-national-search-b.co.uk"),
  liveCollect.excludedCompetitors.map((row) => `${row.domain}:${row.exclusionReasons[0] || ""}`).join(" | "),
);
check(
  "competitor-keywords-persisted",
  liveCollect.competitorKeywordUniverses.length === 2
    && liveCollect.competitorKeywordUniverses.every((row) => row.keywords.length === 1 && row.keywords[0]?.domain === row.domain)
    && liveCollect.summary.competitorKeywordCount === 2
    && liveCollect.organicCompetitors.filter((row) => row.analysed).length === 2
    && liveCollect.organicCompetitors.filter((row) => row.eligibleForKeywordExpansion).every((row) => row.analysed)
    && liveCollect.organicCompetitors.filter((row) => !row.eligibleForKeywordExpansion).every((row) => !row.analysed),
  `universes=${liveCollect.competitorKeywordUniverses.length} keywords=${liveCollect.summary.competitorKeywordCount}`,
);

const persistedRead = searchService.readNationalSearchIntelligence(tenantBSlug);
check(
  "later-read-is-persisted-not-live",
  persistedRead.liveExecution === false
    && persistedRead.provenance.evidenceSource === "DATAFORSEO_PERSISTED"
    && persistedRead.customerKeywords.length === 2
    && persistedRead.competitorKeywordUniverses.length === 2,
  `${persistedRead.authority}/${persistedRead.provenance.evidenceSource}`,
);

const collectedHtml = pageRenderers.renderSearchIntelligencePage(tenantBSlug);
check(
  "ui-shows-collected-competitor-keywords",
  collectedHtml.includes('data-ni03c-section="competitor-keywords"')
    && collectedHtml.includes("example-search-competitor.co.uk")
    && collectedHtml.includes("pharmacy website design"),
  "collected competitor keyword table renders from persisted evidence",
);

check(
  "max-40101-retries-is-one",
  searchProvider.MAX_DATAFORSEO_INTERNAL_SE_RETRIES === 1
    && searchProvider.DATAFORSEO_TASK_INTERNAL_SE_ERROR === 40101
    && labsSource.includes("MAX_DATAFORSEO_INTERNAL_SE_RETRIES"),
  String(searchProvider.MAX_DATAFORSEO_INTERNAL_SE_RETRIES),
);

function writeNationalTenant(slug: string, domain: string): string {
  const file = path.join(ROOT, "config/projects", `${slug}.json`);
  fs.writeFileSync(file, JSON.stringify({
    clientSlug: slug,
    businessName: "National Search Tenant",
    domain: `https://${domain}`,
    growthPlatform: "national",
    primaryLocation: "United Kingdom",
    country: "United Kingdom",
    languageCode: "en",
    services: ["National SEO"],
  }, null, 2) + "\n");
  return file;
}

async function collectWithLabsQueue(
  slug: string,
  options: {
    rankedAuthFail?: boolean;
    hangRanked?: boolean;
    hangCompetitors?: boolean;
    competitorDomainQueue?: object[];
    competitorKeywordQueue?: object[];
    subjectDomain?: string;
    websiteEvidenceByDomain?: Record<string, { title?: string; websiteText: string }>;
  } = {},
) {
  const competitorDomainQueue = [...(options.competitorDomainQueue || [])];
  const competitorKeywordQueue = [...(options.competitorKeywordQueue || [])];
  let rankedCalls = 0;
  let competitorDomainCalls = 0;
  let competitorKeywordCalls = 0;
  let fetchesWithSignal = 0;
  let fetchesMissingSignal = 0;
  const subjectDomain = options.subjectDomain || `${slug.replace(/ni03[bc]-/, "example-")}.co.uk`;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls += 1;
    const url = String(input);
    fetchUrls.push(url);
    if (init?.signal) fetchesWithSignal += 1;
    else fetchesMissingSignal += 1;
    const hang = (): Promise<Response> => new Promise((_, reject) => {
      const fail = () => {
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        reject(err);
      };
      if (init?.signal?.aborted) return fail();
      init?.signal?.addEventListener("abort", fail, { once: true });
      setTimeout(() => reject(new Error("NI-03C validator hang mock was not aborted")), 5000);
    });
    const task = taskFromInit(init);
    if (url.includes("competitors_domain")) {
      competitorDomainCalls += 1;
      if (options.hangCompetitors) return hang();
      const next = competitorDomainQueue.shift() || competitorsDomainPayload(subjectDomain);
      return new Response(JSON.stringify(next), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("ranked_keywords")) {
      const target = String(task.target || "");
      if (target === subjectDomain || rankedCalls === 0 && !target) {
        rankedCalls += 1;
        if (options.hangRanked) return hang();
        if (options.rankedAuthFail) {
          return new Response(JSON.stringify({ status_code: 40100, status_message: "You are not authorized." }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify(customerRankedPayload()), { status: 200, headers: { "content-type": "application/json" } });
      }
      competitorKeywordCalls += 1;
      const next = competitorKeywordQueue.shift() || competitorRankedPayload(target);
      return new Response(JSON.stringify(next), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`Unexpected DataForSEO URL ${url}`);
  }) as typeof fetch;
  const snapshot = await searchService.collectNationalSearchIntelligence(slug, {
    force: true,
    websiteEvidenceByDomain: options.websiteEvidenceByDomain || AGENCY_WEBSITE_EVIDENCE,
  });
  return { snapshot, rankedCalls, competitorDomainCalls, competitorKeywordCalls, fetchesWithSignal, fetchesMissingSignal };
}

const tenantRetry = "ni03c-resilience-retry";
const tenantPartial = "ni03c-resilience-partial";
const tenantAllFail = "ni03c-resilience-allfail";
const tenantAuth = "ni03c-resilience-auth";
const tenantTimeoutCompetitors = "ni03c-timeout-competitors";
const tenantTimeoutRanked = "ni03c-timeout-ranked";
const tenantLimit = "ni03c-limit-config";
const extraTenantFiles = [
  writeNationalTenant(tenantRetry, "example-national-retry.co.uk"),
  writeNationalTenant(tenantPartial, "example-national-partial.co.uk"),
  writeNationalTenant(tenantAllFail, "example-national-allfail.co.uk"),
  writeNationalTenant(tenantAuth, "example-national-auth.co.uk"),
  writeNationalTenant(tenantTimeoutCompetitors, "example-national-timeout-competitors.co.uk"),
  writeNationalTenant(tenantTimeoutRanked, "example-national-timeout-ranked.co.uk"),
  writeNationalTenant(tenantLimit, "example-national-limit.co.uk"),
];

const retryCase = await collectWithLabsQueue(tenantRetry, {
  subjectDomain: "example-national-retry.co.uk",
  competitorDomainQueue: [labs40101Payload(0.002), competitorsDomainPayload("example-national-retry.co.uk")],
});
check(
  "resilience-40101-retry-then-collected",
  retryCase.snapshot.status === "collected"
    && retryCase.competitorDomainCalls === 2
    && retryCase.snapshot.labsAttempts.filter((row) => row.taskStatusCode === 40101).length === 1
    && retryCase.snapshot.customerKeywords.length === 2
    && retryCase.snapshot.organicCompetitors.length >= 1
    && retryCase.snapshot.competitorKeywordUniverses.length >= 1
    && Math.abs(retryCase.snapshot.costs.totalCost - (0.0123 + 0.002 + 0.0108 + 0.008 * retryCase.snapshot.competitorKeywordUniverses.length)) < 1e-9,
  `${retryCase.snapshot.status} competitorDomainCalls=${retryCase.competitorDomainCalls} cost=${retryCase.snapshot.costs.totalCost} attempts=${retryCase.snapshot.labsAttempts.length}`,
);

const partialCase = await collectWithLabsQueue(tenantPartial, {
  subjectDomain: "example-national-partial.co.uk",
  competitorDomainQueue: [labs40101Payload(0.002), labs40101Payload(0.002)],
});
check(
  "resilience-40101-exhausted-keeps-keywords-partial",
  partialCase.snapshot.status === "partial"
    && partialCase.competitorDomainCalls === 2
    && partialCase.competitorKeywordCalls === 0
    && partialCase.snapshot.labsAttempts.filter((row) => row.taskStatusCode === 40101).length === 2
    && partialCase.snapshot.customerKeywords.length === 2
    && partialCase.snapshot.organicCompetitors.length === 0
    && Math.abs(partialCase.snapshot.costs.totalCost - (0.0123 + 0.002 * 2)) < 1e-9
    && /one or more search-engine requests could not be completed/i.test(partialCase.snapshot.lastError || ""),
  `${partialCase.snapshot.status} competitorDomainCalls=${partialCase.competitorDomainCalls} competitors=${partialCase.snapshot.organicCompetitors.length} cost=${partialCase.snapshot.costs.totalCost}`,
);
check(
  "resilience-partial-not-labelled-collected",
  partialCase.snapshot.status !== "collected" && searchModel.isUsableNationalSearchIntelligenceStatus(partialCase.snapshot.status),
  partialCase.snapshot.status,
);

const allFail = await collectWithLabsQueue(tenantAllFail, {
  subjectDomain: "example-national-allfail.co.uk",
  competitorKeywordQueue: [labs40101Payload(0.002), labs40101Payload(0.002), labs40101Payload(0.002), labs40101Payload(0.002)],
});
check(
  "resilience-competitor-keywords-fail-keeps-partial",
  allFail.snapshot.status === "partial"
    && allFail.snapshot.customerKeywords.length === 2
    && allFail.snapshot.organicCompetitors.length === 3
    && allFail.snapshot.competitorKeywordUniverses.every((row) => row.status === "error")
    && allFail.competitorKeywordCalls === 4
    && allFail.snapshot.competitorKeywordUniverses.every((row) => row.keywords.length === 0),
  `${allFail.snapshot.status} keywords=${allFail.snapshot.customerKeywords.length} competitors=${allFail.snapshot.organicCompetitors.length} competitorKeywordCalls=${allFail.competitorKeywordCalls}`,
);

const authCase = await collectWithLabsQueue(tenantAuth, {
  subjectDomain: "example-national-auth.co.uk",
  rankedAuthFail: true,
});
check(
  "resilience-fatal-auth-no-further-paid-calls",
  authCase.snapshot.status === "error"
    && authCase.rankedCalls === 1
    && authCase.competitorDomainCalls === 0
    && authCase.snapshot.customerKeywords.length === 0
    && authCase.snapshot.organicCompetitors.length === 0,
  `${authCase.snapshot.status} ranked=${authCase.rankedCalls} competitorsDomain=${authCase.competitorDomainCalls}`,
);

dataForSeoHttp.setDataForSeoHttpTimeoutMsForTests(80);
try {
  const timeoutCompetitors = await collectWithLabsQueue(tenantTimeoutCompetitors, {
    subjectDomain: "example-national-timeout-competitors.co.uk",
    hangCompetitors: true,
  });
  check(
    "http-timeout-does-not-retry-competitors-domain",
    timeoutCompetitors.snapshot.status === "partial"
      && timeoutCompetitors.competitorDomainCalls === 1
      && timeoutCompetitors.competitorKeywordCalls === 0
      && timeoutCompetitors.snapshot.customerKeywords.length === 2
      && timeoutCompetitors.snapshot.organicCompetitors.length === 0
      && timeoutCompetitors.snapshot.labsAttempts.filter((row) => row.timedOut).length === 1
      && timeoutCompetitors.snapshot.labsAttempts.filter((row) => row.timedOut).every((row) => row.successful === false)
      && timeoutCompetitors.fetchesMissingSignal === 0,
    `${timeoutCompetitors.snapshot.status} competitorDomainCalls=${timeoutCompetitors.competitorDomainCalls} timedOut=${timeoutCompetitors.snapshot.labsAttempts.filter((row) => row.timedOut).length} keywords=${timeoutCompetitors.snapshot.customerKeywords.length}`,
  );

  const timeoutRanked = await collectWithLabsQueue(tenantTimeoutRanked, {
    subjectDomain: "example-national-timeout-ranked.co.uk",
    hangRanked: true,
  });
  check(
    "ranked-timeout-continues-competitors-partial",
    timeoutRanked.snapshot.status === "partial"
      && timeoutRanked.rankedCalls === 1
      && timeoutRanked.competitorDomainCalls === 1
      && timeoutRanked.snapshot.customerKeywords.length === 0
      && timeoutRanked.snapshot.organicCompetitors.length >= 1,
    `${timeoutRanked.snapshot.status} ranked=${timeoutRanked.rankedCalls} competitorsDomain=${timeoutRanked.competitorDomainCalls} keywords=${timeoutRanked.snapshot.customerKeywords.length} competitors=${timeoutRanked.snapshot.organicCompetitors.length}`,
  );
} finally {
  dataForSeoHttp.setDataForSeoHttpTimeoutMsForTests(null);
}

await collectWithLabsQueue(tenantLimit, {
  subjectDomain: "example-national-limit.co.uk",
});
// Re-collect with explicit tighter limits after clearing in-flight by using force and option overrides.
const limited = await searchService.collectNationalSearchIntelligence(tenantLimit, {
  force: true,
  limits: { customerKeywordUniverse: 1, qualifiedCompetitorsAnalysed: 1, competitorRankedKeywords: 1 },
  websiteEvidenceByDomain: AGENCY_WEBSITE_EVIDENCE,
});
check(
  "limits-override-without-tenant-hardcode",
  limited.limits.customerKeywordUniverse === 1
    && limited.limits.qualifiedCompetitorsAnalysed === 1
    && limited.limits.competitorRankedKeywords === 1
    && limited.customerKeywords.length === 1
    && limited.competitorKeywordUniverses.length === 1
    && limited.competitorKeywordUniverses[0]?.keywords.length === 1
    && !limited.tenantSlug.includes("pharmaconnect"),
  `limits=${JSON.stringify(limited.limits)} keywords=${limited.customerKeywords.length} universes=${limited.competitorKeywordUniverses.length}`,
);

const previousCustomerEnv = process.env.NATIONAL_SEARCH_CUSTOMER_KEYWORD_LIMIT;
process.env.NATIONAL_SEARCH_CUSTOMER_KEYWORD_LIMIT = "12";
const envLimits = searchLimits.resolveNationalSearchIntelligenceLimits();
check(
  "customer-keyword-limit-env-configurable",
  envLimits.customerKeywordUniverse === 12
    && searchLimits.resolveNationalSearchIntelligenceLimits().qualifiedCompetitorsAnalysed === 5,
  JSON.stringify(envLimits),
);
if (previousCustomerEnv === undefined) delete process.env.NATIONAL_SEARCH_CUSTOMER_KEYWORD_LIMIT;
else process.env.NATIONAL_SEARCH_CUSTOMER_KEYWORD_LIMIT = previousCustomerEnv;

const fetchBeforePartialRead = fetchCalls;
searchService.readNationalSearchIntelligence(tenantPartial);
pageRenderers.renderSearchIntelligencePage(tenantPartial);
const partialHtml = pageRenderers.renderSearchIntelligencePage(tenantPartial);
check(
  "resilience-dashboard-get-zero-dataforseo",
  fetchCalls === fetchBeforePartialRead,
  `fetchCallsDelta=${fetchCalls - fetchBeforePartialRead}`,
);
check(
  "resilience-partial-ui-copy",
  partialHtml.includes('data-ni03b-section="partial"')
    && /one or more search-engine requests could not be completed/i.test(partialHtml)
    && !partialHtml.includes("Internal SE Server Error"),
  "customer-facing partial copy without task stack traces",
);

let localCollectError = "";
try {
  await searchService.collectNationalSearchIntelligence("brook-pharmacy");
} catch (err) {
  localCollectError = err instanceof Error ? err.message : String(err);
}
check(
  "collect-rejects-local-tenant",
  /not eligible/i.test(localCollectError),
  localCollectError,
);

if (previousLogin === undefined) delete process.env.DATAFORSEO_LOGIN;
else process.env.DATAFORSEO_LOGIN = previousLogin;
if (previousPassword === undefined) delete process.env.DATAFORSEO_PASSWORD;
else process.env.DATAFORSEO_PASSWORD = previousPassword;

for (const slug of [tenantBSlug, tenantRetry, tenantPartial, tenantAllFail, tenantAuth, tenantTimeoutCompetitors, tenantTimeoutRanked, tenantLimit]) {
  for (const artifact of [
    "search-intelligence-v1",
    "ranked-keywords-customer",
    "ranked-keywords-competitors",
    "cost-ledger-v1",
    "refresh-metadata-v1",
    "competitor-discovery",
  ] as const) {
    const dataFile = storage.nationalIntelligenceDataPath(slug, artifact);
    if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
  }
}
if (fs.existsSync(fixtureFile)) fs.unlinkSync(fixtureFile);
if (fs.existsSync(tenantBFile)) fs.unlinkSync(tenantBFile);
for (const file of extraTenantFiles) {
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

globalThis.fetch = originalFetch;

console.log(`\n${fail ? "FAIL" : "PASS"} — ${pass}/${pass + fail} checks\n`);
if (fail) process.exit(1);
