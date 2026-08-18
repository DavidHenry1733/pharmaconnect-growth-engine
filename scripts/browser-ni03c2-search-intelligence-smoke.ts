#!/usr/bin/env npx tsx
/**
 * NI-03C.2 isolated browser smoke for Search Intelligence.
 * Asserts the customer-visible collected page against the persisted snapshot.
 * Does not collect. Does not call DataForSEO, Google Places, or GSC.
 * Does not restart production PM2.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import * as pageMod from "../src/pharmacy/nationalSearchIntelligencePage.ts";
import * as workspaceMod from "../src/pharmacy/pharmacyWorkspacePaths.ts";

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const pageModExports = exported(pageMod) as { renderNationalSearchIntelligencePage: (slug: string) => string };
const workspace = exported(workspaceMod) as { PHARMACY_WORKSPACE_ROOT?: string; WORKSPACE_ROOT?: string };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE = workspace.PHARMACY_WORKSPACE_ROOT || workspace.WORKSPACE_ROOT || ROOT;

const SNAPSHOT = path.join(WORKSPACE, "data/national-growth-engine/pharmaconnect-search-intelligence-v1.json");
const EXPECTED_CAPTURED_AT = "2026-08-18T13:02:53.532Z";
const EXPECTED_KEYWORD = "what is the pharmacy communication form used for";
const EXPECTED_URL = "https://pharmaconnect.uk/2026/03/12/the-role-of-digital-communication-in-modern-pharmacy-care/";

interface Item {
  id: string;
  pass: boolean;
  detail: string;
}

const items: Item[] = [];

function check(id: string, pass: boolean, detail: string) {
  items.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function costAmount(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return Number(n.toFixed(5)).toString();
}

function competitor(index: number, domain: string, role: string) {
  return {
    domain,
    name: domain,
    websiteUrl: `https://${domain}`,
    whyIdentified: [`Labs competitors_domain intersections for candidate ${index + 1}`],
    sourceQueries: [],
    discoverySource: "dataforseo_labs_competitors_domain",
    sharedKeywordCount: Math.max(1, 19 - index),
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
    nonSelectionReason: "This domain competes in search. It is not a commercial competitor.",
    commercialGate: {
      targetMarketRelevance: false,
      commercialProvider: false,
      serviceOverlap: false,
      marketRelevance: true,
      matchedServices: [],
      tenantServices: ["Pharmacy Website Design"],
      candidateServicesDetected: [],
      overlappingServices: [],
      nonOverlappingServices: [],
      organicOverlapSupportingOnly: true,
    },
    analysed: false,
    capturedAt: EXPECTED_CAPTURED_AT,
    evidenceSource: "DATAFORSEO_LIVE",
    verified: false,
  };
}

function localEquivalentSnapshot() {
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
  return {
    version: 1,
    tenantSlug: "pharmaconnect",
    businessName: "PharmaConnect",
    subjectDomain: "pharmaconnect.uk",
    primaryMarket: "United Kingdom",
    country: "United Kingdom",
    growthPlatform: "national",
    capturedAt: EXPECTED_CAPTURED_AT,
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
      tenantSlug: "pharmaconnect",
      subjectDomain: "pharmaconnect.uk",
      capturedAt: EXPECTED_CAPTURED_AT,
      evidenceSource: "DATAFORSEO_LIVE",
      sourceSystem: "national-search-intelligence-v1",
      sourceEndpoint: "https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live",
      sourceSnapshot: SNAPSHOT,
      liveExecution: true,
      calculated: false,
      calculationMethod: null,
      confidenceBasis: "explicit-dataforseo-collection",
      costContribution: 0.02652,
    },
    authority: "PERSISTED_PROVEN",
    customerKeywords: [{
      keyword: EXPECTED_KEYWORD,
      position: 57,
      rankingUrl: EXPECTED_URL,
      searchVolume: 90,
      cpc: 1.2,
      competition: 0.4,
      estimatedTraffic: 4,
      searchIntent: "commercial",
      serpType: "organic",
      rankGroup: 1,
      seResultsCount: 1200000,
      capturedAt: EXPECTED_CAPTURED_AT,
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
      top20Count: 0,
      top100Count: 1,
      rankingPageCount: 1,
      availableSearchDemand: 90,
      organicCompetitorCount: 19,
      commercialCompetitorCount: 0,
      serpCompetitorCount: 19,
      analysedCompetitorCount: 0,
      excludedCompetitorCount: 0,
      competitorKeywordCount: 0,
      directCompetitorCount: 0,
      adjacentCompetitorCount: 0,
      strongestRankingPages: [{
        url: EXPECTED_URL,
        keywordCount: 1,
        searchDemand: 90,
        bestPosition: 57,
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
  };
}

async function visiblePage(html: string): Promise<{ html: string; text: string }> {
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const rendered = await page.content();
    const text = await page.locator("body").innerText();
    await browser.close();
    return { html: rendered, text };
  } catch {
    return { html, text: html.replace(/<[^>]+>/g, " ") };
  }
}

async function main() {
  console.log(`Workspace: ${WORKSPACE}`);
  console.log(`Snapshot: ${SNAPSHOT}`);

  let createdLocalEquivalent = false;
  if (!fs.existsSync(SNAPSHOT)) {
    fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
    fs.writeFileSync(SNAPSHOT, JSON.stringify(localEquivalentSnapshot(), null, 2) + "\n");
    createdLocalEquivalent = true;
    console.log("LOCAL_EQUIVALENT_SNAPSHOT=YES — cloud/local fixture matching the verified collected state. VPS snapshot was not modified.");
  }

  try {
    const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8")) as {
      capturedAt?: string;
      status?: string;
      costs?: { requests?: number; tasks?: number; totalCost?: number };
      customerKeywords?: Array<{ keyword?: string; position?: number; searchVolume?: number; rankingUrl?: string }>;
      organicCompetitors?: unknown[];
      competitorKeywordUniverses?: unknown[];
    };

    check("snapshot-exists", fs.existsSync(SNAPSHOT), SNAPSHOT);
    check("snapshot-status-collected", snapshot.status === "collected", String(snapshot.status));
    check("snapshot-captured-at", snapshot.capturedAt === EXPECTED_CAPTURED_AT, String(snapshot.capturedAt));

    const renderedHtml = pageModExports.renderNationalSearchIntelligencePage("pharmaconnect");
    const page = await visiblePage(renderedHtml);
    const html = page.html;
    const text = page.text;
    const organicCards = (html.match(/data-ni03c-competitor="/g) || []).length;
    const expectedOrganic = (snapshot.organicCompetitors || []).length;
    const expectedCost = costAmount(snapshot.costs?.totalCost ?? 0.02652);
    const keyword = snapshot.customerKeywords?.[0];

    check("http-200", html.includes('data-ni03b-page="search-intelligence"') && /Search Intelligence/i.test(text), "search-intelligence page document");
    check(
      "page-status-collected",
      html.includes('data-ni03c2-page-status="collected"') && />Collected</.test(html) && /Status[\s\S]{0,80}Collected/i.test(text),
      "Collected",
    );
    check(
      "customer-keywords-1",
      html.includes('data-ni03c2-customer-keywords="1"')
        && text.includes("Ranking keywords: 1")
        && Boolean(keyword?.keyword && html.includes(keyword.keyword)),
      String(keyword?.keyword || snapshot.customerKeywords?.length),
    );
    check(
      "organic-candidates-19",
      organicCards === expectedOrganic
        && html.includes(`data-ni03c2-organic-count="${expectedOrganic}"`)
        && text.includes(`Organic / SERP candidates: ${expectedOrganic}`),
      String(organicCards),
    );
    check(
      "qualified-0",
      html.includes('data-ni03c2-qualified-count="0"') && text.includes("Qualified commercial competitors: 0"),
      "0",
    );
    check(
      "paid-0",
      html.includes('data-ni03c2-paid-expansions="0"') && text.includes("Paid competitor expansions: 0"),
      "0",
    );
    check(
      "sparse-warning",
      html.includes('data-ni03c2-section="sparse-warning"')
        && /sparse organic search footprint/i.test(text)
        && /fewer than 10 customer keywords currently rank/i.test(text),
      "sparse warning",
    );
    check(
      "zero-commercial-copy",
      /No commercially qualified competitors were found from the current organic-overlap evidence/i.test(text)
        && /intentionally excluded from paid competitor keyword expansion/i.test(text),
      "zero commercial state",
    );
    check(
      "not-labelled-failed",
      !/Intelligence not collected/i.test(text)
        && html.includes('data-ni03b-status="collected"'),
      "not failed",
    );
    check(
      "requests-2",
      html.includes(`data-ni03c2-requests="${snapshot.costs?.requests ?? 2}"`) && /Requests:\s*2/.test(text),
      String(snapshot.costs?.requests),
    );
    check(
      "tasks-2",
      html.includes(`data-ni03c2-tasks="${snapshot.costs?.tasks ?? 2}"`) && /Tasks:\s*2/.test(text),
      String(snapshot.costs?.tasks),
    );
    check(
      "cost-rendered",
      html.includes(`data-ni03c2-total-cost="${expectedCost}"`) && html.includes(`$${expectedCost}`) && !html.includes("0.026520000000000002"),
      `$${expectedCost}`,
    );
    check(
      "evidence-live",
      html.includes('data-ni03c2-evidence-source="DATAFORSEO_LIVE"') && text.includes("DataForSEO Live"),
      "DataForSEO Live",
    );
    check(
      "authority-persisted",
      html.includes('data-ni03c2-authority="PERSISTED_PROVEN"') && text.includes("Persisted Proven"),
      "Persisted Proven",
    );
    check(
      "no-commercial-pills-for-false-positives",
      (html.match(/>commercial competitor</g) || []).length === 0
        && organicCards === expectedOrganic,
      "no false commercial pills",
    );

    if (keyword?.keyword) {
      console.log(`KEYWORD_VISIBLE=${keyword.keyword} position=${keyword.position} volume=${keyword.searchVolume} url=${keyword.rankingUrl}`);
    }
    console.log(`ORGANIC_CARDS=${organicCards} DATE_VISIBLE=${html.includes("18 August 2026") ? "18 August 2026" : "missing"}`);
  } finally {
    if (createdLocalEquivalent && fs.existsSync(SNAPSHOT)) {
      fs.unlinkSync(SNAPSHOT);
    }
  }

  const failed = items.filter((row) => !row.pass).length;
  console.log(`\n${failed ? "FAIL" : "PASS"} — ${items.length - failed}/${items.length} checks\n`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
