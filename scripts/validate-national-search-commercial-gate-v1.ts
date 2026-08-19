#!/usr/bin/env npx tsx
/**
 * NI-03C.1 — Commercial competitor gate for National Search Intelligence.
 * Organic overlap is SERP evidence, not commercial proof.
 * Does not call live DataForSEO, Google Places, or GSC.
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
import * as workspacePathsMod from "../src/pharmacy/pharmacyWorkspacePaths.ts";

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
const { getPharmacyProjectConfigPath } = exported(workspacePathsMod);

let pass = 0;
let fail = 0;
const originalFetch = globalThis.fetch;
let fetchCalls = 0;
const fetchUrls: string[] = [];

globalThis.fetch = (async (input: RequestInfo | URL) => {
  fetchCalls += 1;
  fetchUrls.push(String(input));
  throw new Error(`NI-03C.1 validator blocked fetch: ${String(input)}`);
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

console.log("\n=== NI-03C.1 COMMERCIAL COMPETITOR QUALIFICATION ===\n");

const serviceSource = read("src/pharmacy/nationalSearchIntelligenceV1Service.ts");
const gateSource = read("src/pharmacy/nationalSearchCommercialCompetitorGate.ts");
const pageSource = read("src/pharmacy/nationalSearchIntelligencePage.ts");
const modelSource = read("src/pharmacy/nationalSearchIntelligenceV1Model.ts");
const labsSource = read("src/pharmacy/dataForSeoRankedKeywordIntelligenceService.ts");

check(
  "official-dataforseo-docs-cited",
  labsSource.includes("docs.dataforseo.com/v3/dataforseo_labs-google-competitors_domain-live")
    && gateSource.includes("Organic overlap is SERP competition, not commercial competition"),
  "Competitors Domain field semantics taken from official docs",
);
const overlapSource = read("src/pharmacy/nationalCommercialServiceOverlap.ts");
check(
  "no-pharmaconnect-domain-blacklist",
  !/boots\.com|sciencedirect\.com|brainly\.com|rcpharm\.org|pharmacymagazine\.co\.uk|communitypharmacy\.org\.uk|nymopmr\.co\.uk|surveyfocus\.co\.uk/.test(gateSource + serviceSource + modelSource + overlapSource),
  "no PharmaConnect-specific competitor domain blacklist",
);
check(
  "hard-service-overlap-module",
  overlapSource.includes("BROAD_ALONE")
    && overlapSource.includes("website design")
    && gateSource.includes("compareNationalCommercialServiceOverlap")
    && gateSource.includes("adjacent_commercial_provider")
    && pageSource.includes("TENANT SERVICES")
    && pageSource.includes("SERVICE_OVERLAP="),
  "material overlap ignores broad words; adjacent commercial providers preserved",
);
check(
  "no-insufficient-evidence-auto-promotion",
  !serviceSource.includes('commercial ? qualification.classification : "adjacent_competitor"')
    && serviceSource.includes("selectCompetitorsForKeywordExpansion")
    && !serviceSource.includes('qualification === "candidate"'),
  "overlap-only candidates are not auto-promoted into paid expansion",
);
check(
  "existing-qualification-and-enrichment-reused",
  gateSource.includes("qualifyNationalCompetitorV2")
    && gateSource.includes("qualifyNationalCompetitor(")
    && gateSource.includes("commercialServices")
    && gateSource.includes("primaryMarket")
    && serviceSource.includes("enrichNationalCompetitorEvidence"),
  "V1/V2 qualification, tenant services/market, and bounded enrichment reused",
);
check(
  "ui-distinguishes-search-vs-customers",
  pageSource.includes("This domain competes in search")
    && pageSource.includes("This business competes for your customers")
    && pageSource.includes("eligibleForKeywordExpansion")
    && pageSource.includes("Organic overlap is SERP evidence only"),
  "Search Intelligence UI distinguishes SERP overlap from commercial competition",
);

const tenantSlug = "ni03c1-commercial-gate";
const tenantFile = getPharmacyProjectConfigPath(tenantSlug);
fs.mkdirSync(path.dirname(tenantFile), { recursive: true });
fs.writeFileSync(tenantFile, JSON.stringify({
  clientSlug: tenantSlug,
  businessName: "National Digital Growth Tenant",
  domain: "https://example-ni03c1-agency.co.uk",
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
check(
  "tenant-services-from-config",
  subject.eligibleForNationalIntelligence
    && subject.commercialServices.some((row) => /website/i.test(row.serviceName))
    && subject.commercialServices.some((row) => /seo/i.test(row.serviceName))
    && subject.primaryMarket.length > 0,
  `services=${subject.commercialServices.map((row) => row.serviceName).join(" | ")} market=${subject.primaryMarket}`,
);

const agencyText = "We are a UK digital agency for community pharmacies. We provide pharmacy website design, local SEO, email marketing, website hosting and growth audits. We work with pharmacy businesses across the United Kingdom. Our services help pharmacy owners. Contact us to get started.";
const retailerText = "Boots is a health and beauty retailer. Add to basket. Store locator. Our stores. Shop now. Buy online. Repeat prescription. We dispense medicines and health products. Opening hours.";
const publisherText = "Pharmacy Magazine is the leading trade press publication. Read the latest issue. Editorial team. Subscribe to our magazine. Newsroom.";
const educationText = "Elsevier ScienceDirect hosts peer-reviewed scientific journal articles and academic research. DOI: 10.0000/example. Open access articles and textbook chapters.";
const homeworkText = "Homework help and study help quizzes for students.";
const professionalText = "The Royal College is a professional body. Membership benefits. Become a member. Professional standards. Register of members. Faculty of pharmacy.";
const overlapOnlyText = "";
const pmrText = "We provide PMR and dispensing software for community pharmacies. Prescription management, stock management and pharmacy operations. Our platform helps pharmacy owners across the United Kingdom. Contact us to get started.";
const surveyText = "We provide a CPPQ community pharmacy patient questionnaire survey platform and compliance software for UK pharmacy businesses. Contact us to get started.";
const representativeText = "Community Pharmacy England is the representative organisation for community pharmacies. Patient information service and information for the public. NHS community-pharmacy information. Statutory sector representation. Guidance for pharmacies.";

function assess(domain: string, websiteText: string, sharedKeywordCount = 20, organicEtv = 100) {
  return gate.assessNationalSearchCommercialCompetitor({
    domain,
    title: domain,
    websiteText,
    url: `https://${domain}`,
    sharedKeywordCount,
    organicEtv,
    subject,
    ownDomains: [subject.subjectDomain],
    sparseCustomerFootprint: false,
  });
}

const agency = assess("pharmacy-digital-agency.co.uk", agencyText, 4, 80);
check(
  "A-real-pharmacy-digital-agency",
  agency.role === "commercial_competitor"
    && agency.eligibleForKeywordExpansion === true
    && agency.qualification === "qualified"
    && agency.targetMarketRelevance
    && agency.commercialProvider
    && agency.serviceOverlap,
  `${agency.role} eligible=${agency.eligibleForKeywordExpansion} services=${agency.matchedServices.join(",")}`,
);

const pmr = assess("pharmacy-pmr-software.co.uk", pmrText, 22, 1200);
check(
  "B-pmr-provider",
  pmr.role === "adjacent_commercial_provider"
    && pmr.targetMarketRelevance === true
    && pmr.commercialProvider === true
    && pmr.serviceOverlap === false
    && pmr.eligibleForKeywordExpansion === false,
  `${pmr.role} overlap=${pmr.serviceOverlap} eligible=${pmr.eligibleForKeywordExpansion} detected=${pmr.candidateServicesDetected.join(",")}`,
);

const survey = assess("pharmacy-survey-platform.co.uk", surveyText, 19, 800);
check(
  "C-survey-platform",
  survey.role === "adjacent_commercial_provider"
    && survey.commercialProvider === true
    && survey.serviceOverlap === false
    && survey.eligibleForKeywordExpansion === false,
  `${survey.role} overlap=${survey.serviceOverlap} eligible=${survey.eligibleForKeywordExpansion}`,
);

const representative = assess("community-pharmacy-body.example", representativeText, 15, 4000);
check(
  "D-representative-body",
  (representative.role === "professional_body" || representative.role === "generic_informational")
    && representative.commercialProvider === false
    && representative.eligibleForKeywordExpansion === false,
  `${representative.role} commercialProvider=${representative.commercialProvider} eligible=${representative.eligibleForKeywordExpansion}`,
);
const retailer = assess("retail-pharmacy-chain.co.uk", retailerText, 40, 90000);
check(
  "F-retail-pharmacy",
  retailer.role === "customer_market"
    && retailer.eligibleForKeywordExpansion === false
    && retailer.classification !== "direct_competitor"
    && retailer.classification !== "adjacent_competitor",
  `${retailer.role} eligible=${retailer.eligibleForKeywordExpansion}`,
);

const publisher = assess("pharmacy-trade-press.co.uk", publisherText, 30, 2100);
check(
  "E-publisher",
  publisher.role === "publisher"
    && publisher.eligibleForKeywordExpansion === false,
  `${publisher.role} eligible=${publisher.eligibleForKeywordExpansion}`,
);

const education = assess("scientific-articles.example", educationText, 25, 99999);
const homework = assess("study-help.example", homeworkText, 18, 80000);
check(
  "D-educational-academic",
  education.role === "education_academic"
    && education.eligibleForKeywordExpansion === false
    && homework.role === "education_academic"
    && homework.eligibleForKeywordExpansion === false,
  `${education.role}/${homework.role}`,
);

const professional = assess("royal-college.example", professionalText, 11, 4000);
check(
  "E-professional-body",
  professional.role === "professional_body"
    && professional.eligibleForKeywordExpansion === false,
  `${professional.role} eligible=${professional.eligibleForKeywordExpansion}`,
);

const overlapOnly = assess("high-authority-overlap.example", overlapOnlyText, 80, 500000);
check(
  "G-organic-overlap-only",
  overlapOnly.eligibleForKeywordExpansion === false
    && (overlapOnly.role === "serp_content_competitor" || overlapOnly.role === "insufficient_evidence")
    && overlapOnly.classification === "insufficient_evidence",
  `${overlapOnly.role} ${overlapOnly.classification} eligible=${overlapOnly.eligibleForKeywordExpansion}`,
);

const selected = gate.selectCompetitorsForKeywordExpansion([
  { domain: "high-authority-overlap.example", eligibleForKeywordExpansion: overlapOnly.eligibleForKeywordExpansion, score: overlapOnly.score, sharedKeywordCount: 80, organicEtv: 500000 },
  { domain: "pharmacy-digital-agency.co.uk", eligibleForKeywordExpansion: agency.eligibleForKeywordExpansion, score: agency.score, sharedKeywordCount: 4, organicEtv: 80 },
], 5);
check(
  "H-agency-outranks-overlap-metrics",
  selected.length === 1
    && selected[0]?.domain === "pharmacy-digital-agency.co.uk"
    && agency.eligibleForKeywordExpansion === true,
  selected.map((row) => row.domain).join(","),
);

function rankedPayload(domain: string, keywords: Array<{ keyword: string; volume: number | null }>, cost: number) {
  return {
    status_code: 20000,
    tasks: [{
      status_code: 20000,
      cost,
      result: [{
        items: keywords.map((row) => ({
          keyword_data: {
            keyword: row.keyword,
            keyword_info: { search_volume: row.volume, cpc: 1.2, competition: 0.4 },
          },
          ranked_serp_element: {
            serp_item: { rank_absolute: 8, etv: 4, url: `https://${domain}/page` },
          },
        })),
      }],
    }],
  };
}

function competitorsPayload(items: Array<{ domain: string; intersections: number; etv: number }>) {
  return {
    status_code: 20000,
    tasks: [{
      status_code: 20000,
      cost: 0.0108,
      result: [{
        items: items.map((row) => ({
          domain: row.domain,
          intersections: row.intersections,
          avg_position: 7,
          full_domain_metrics: { organic: { etv: row.etv, count: row.intersections } },
        })),
      }],
    }],
  };
}

const previousLogin = process.env.DATAFORSEO_LOGIN;
const previousPassword = process.env.DATAFORSEO_PASSWORD;

function restoreNi03c1SideEffects() {
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
process.env.DATAFORSEO_LOGIN = "ni03c1-login";
process.env.DATAFORSEO_PASSWORD = "ni03c1-password";

const websiteEvidenceByDomain = {
  "pharmacy-digital-agency.co.uk": { title: "Pharmacy Digital Agency", websiteText: agencyText },
  "second-pharmacy-agency.co.uk": { title: "Second Pharmacy Agency", websiteText: agencyText },
  "retail-pharmacy-chain.co.uk": { title: "Retail Pharmacy", websiteText: retailerText },
  "pharmacy-trade-press.co.uk": { title: "Pharmacy Magazine", websiteText: publisherText },
  "scientific-articles.example": { title: "Science Library", websiteText: educationText },
  "study-help.example": { title: "Study Help", websiteText: homeworkText },
  "royal-college.example": { title: "Royal College", websiteText: professionalText },
  "high-authority-overlap.example": { title: "high-authority-overlap.example", websiteText: overlapOnlyText },
  "pharmacy-pmr-software.co.uk": { title: "Pharmacy PMR", websiteText: pmrText },
  "pharmacy-survey-platform.co.uk": { title: "Pharmacy Surveys", websiteText: surveyText },
  "community-pharmacy-body.example": { title: "Community Pharmacy Body", websiteText: representativeText },
};

async function collectScenario(
  items: Array<{ domain: string; intersections: number; etv: number }>,
  limits?: { customerKeywordUniverse?: number; qualifiedCompetitorsAnalysed?: number },
) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls += 1;
    const url = String(input);
    fetchUrls.push(url);
    if (!url.includes("dataforseo.com")) {
      throw new Error(`NI-03C.1 unexpected non-DataForSEO fetch ${url}`);
    }
    const payload = JSON.parse(String(init?.body || "[]"));
    const task = Array.isArray(payload) ? (payload[0] || {}) : {};
    if (url.includes("competitors_domain") || url.includes("serp_competitors")) {
      return new Response(JSON.stringify(competitorsPayload(items)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("domain_intersection")) {
      const target = String(task.target1 || "competitor.example");
      return new Response(JSON.stringify(rankedPayload(target, [{ keyword: "competitor only keyword", volume: 40 }], 0.006)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    const target = String(task.target || subject.subjectDomain);
    const rows = target === subject.subjectDomain
      ? [{ keyword: "pharmacy website design uk", volume: 210 }]
      : [{ keyword: "pharmacy website design", volume: 480 }];
    return new Response(JSON.stringify(rankedPayload(target, rows, 0.008)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return searchService.collectNationalSearchIntelligence(tenantSlug, {
    force: true,
    limits: {
      customerKeywordUniverse: limits?.customerKeywordUniverse ?? 1,
      qualifiedCompetitorsAnalysed: limits?.qualifiedCompetitorsAnalysed ?? 5,
      competitorRankedKeywords: 1,
    },
    websiteEvidenceByDomain,
  });
}

try {
const sparse = await collectScenario([
  { domain: "high-authority-overlap.example", intersections: 90, etv: 800000 },
  { domain: "retail-pharmacy-chain.co.uk", intersections: 40, etv: 90000 },
  { domain: "pharmacy-trade-press.co.uk", intersections: 30, etv: 2100 },
  { domain: "scientific-articles.example", intersections: 25, etv: 99999 },
  { domain: "royal-college.example", intersections: 11, etv: 4000 },
], { customerKeywordUniverse: 1, qualifiedCompetitorsAnalysed: 5 });

check(
  "H-sparse-customer-footprint",
  sparse.customerKeywords.length === 1
    && sparse.customerOrganicFootprint.sparse === true
    && sparse.customerOrganicFootprint.sufficientForHighConfidenceCommercialDiscovery === false
    && sparse.organicCompetitors.every((row) => row.eligibleForKeywordExpansion === false)
    && sparse.competitorKeywordUniverses.length === 0
    && sparse.organicCompetitors.length >= 4,
  `keywords=${sparse.customerKeywords.length} sparse=${sparse.customerOrganicFootprint.sparse} universes=${sparse.competitorKeywordUniverses.length} competitors=${sparse.organicCompetitors.map((row) => row.domain).join(",")}`,
);

const zero = await collectScenario([
  { domain: "pharmacy-pmr-software.co.uk", intersections: 40, etv: 1200 },
  { domain: "pharmacy-survey-platform.co.uk", intersections: 30, etv: 800 },
  { domain: "community-pharmacy-body.example", intersections: 25, etv: 4000 },
  { domain: "retail-pharmacy-chain.co.uk", intersections: 22, etv: 90000 },
  { domain: "pharmacy-trade-press.co.uk", intersections: 18, etv: 2100 },
], { customerKeywordUniverse: 20, qualifiedCompetitorsAnalysed: 5 });

check(
  "I-zero-qualified-requests",
  zero.competitorKeywordUniverses.length === 0
    && zero.organicCompetitors.every((row) => row.eligibleForKeywordExpansion === false)
    && zero.labsAttempts.filter((row) => row.role === "competitor_ranked_keywords").length === 0,
  `universes=${zero.competitorKeywordUniverses.length} competitorKeywordAttempts=${zero.labsAttempts.filter((row) => row.role === "competitor_ranked_keywords").length}`,
);

const two = await collectScenario([
  { domain: "high-authority-overlap.example", intersections: 90, etv: 800000 },
  { domain: "retail-pharmacy-chain.co.uk", intersections: 40, etv: 90000 },
  { domain: "pharmacy-digital-agency.co.uk", intersections: 4, etv: 80 },
  { domain: "second-pharmacy-agency.co.uk", intersections: 3, etv: 40 },
  { domain: "pharmacy-trade-press.co.uk", intersections: 30, etv: 2100 },
], { customerKeywordUniverse: 20, qualifiedCompetitorsAnalysed: 5 });

check(
  "J-two-qualified-requests-not-five",
  two.competitorKeywordUniverses.length === 2
    && two.organicCompetitors.filter((row) => row.eligibleForKeywordExpansion).length === 2
    && two.organicCompetitors.filter((row) => row.eligibleForKeywordExpansion).every((row) => /agency/.test(row.domain))
    && two.organicCompetitors.some((row) => row.domain === "high-authority-overlap.example" && row.eligibleForKeywordExpansion === false)
    && two.labsAttempts.filter((row) => row.role === "competitor_ranked_keywords").length === 2
    && two.collectionPlan.competitorKeywordTasks === 3
    && two.collectionPlan.maximumPaidRequests === 8,
  `universes=${two.competitorKeywordUniverses.length} eligible=${two.organicCompetitors.filter((row) => row.eligibleForKeywordExpansion).map((row) => row.domain).join(",")} planMax=${two.collectionPlan.competitorKeywordTasks}`,
);

const html = searchPage.renderNationalSearchIntelligencePage(tenantSlug);
check(
  "ui-explains-collected-distinction",
  html.includes("This business competes for your customers")
    && html.includes("This domain competes in search")
    && html.includes("pharmacy-digital-agency.co.uk")
    && html.includes("high-authority-overlap.example")
    && html.includes('data-ni03c1-eligible="false"')
    && html.includes("TENANT SERVICES")
    && html.includes("SERVICE_OVERLAP="),
  "collected page keeps SERP competitors visible and marks expansion eligibility",
);

check(
  "plan-maxima-unchanged",
  searchLimits.planNationalSearchIntelligenceTasks().customerKeywordTasks === 1
    && searchLimits.planNationalSearchIntelligenceTasks().competitorDiscoveryTasks === 1
    && searchLimits.planNationalSearchIntelligenceTasks().competitorKeywordTasks === 5
    && searchLimits.planNationalSearchIntelligenceTasks().maximumPaidRequests === 7,
  JSON.stringify(searchLimits.planNationalSearchIntelligenceTasks()),
);

check(
  "no-live-external-calls-outside-mocked-dataforseo",
  fetchUrls.every((url) => url.includes("dataforseo.com") || url.startsWith("NI-03C.1")),
  fetchUrls.filter((url) => !url.includes("dataforseo.com")).join(" | ") || "ok",
);
} finally {
  restoreNi03c1SideEffects();
}

console.log(`\n${fail ? "FAIL" : "PASS"} — ${pass}/${pass + fail} checks\n`);
if (fail) process.exit(1);
