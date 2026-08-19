#!/usr/bin/env npx tsx
/**
 * Checkpoint 02 — persist already-discovered candidates through the existing
 * commercial qualification architecture. No live DataForSEO, Places, GSC,
 * ranked-keyword expansion, or VPS snapshot writes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as discoveryService from "../src/pharmacy/nationalCommercialCompetitorDiscoveryService.ts";
import * as storageMod from "../src/pharmacy/nationalCompetitorDiscoveryStorageService.ts";
import * as pageMod from "../src/pharmacy/nationalSearchIntelligencePage.ts";
import type { NationalCompetitorDiscoveryResult } from "../src/pharmacy/nationalCompetitorDiscoveryModel.ts";

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const originalFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  fetchCalls += 1;
  throw new Error(`Persisted qualification validator blocked fetch: ${String(input)}`);
}) as typeof fetch;

const checks: Array<{ id: string; pass: boolean; detail: string }> = [];
function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

const {
  requalifyPersistedCommercialCompetitorDiscovery,
  websiteTextFromPersistedCandidate,
  commercialDiscoverySummary,
} = exported(discoveryService);
const { nationalCompetitorDiscoveryPath, nationalCompetitorDiscoveryFixturePath } = exported(storageMod);
const { renderNationalSearchIntelligencePage } = exported(pageMod);

console.log("\n=== CHECKPOINT 02 PERSISTED REAL QUALIFICATION ===\n");

const discoverySrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/nationalCommercialCompetitorDiscoveryService.ts"), "utf8");
const gateSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/nationalSearchCommercialCompetitorGate.ts"), "utf8");
const overlapSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/nationalCommercialServiceOverlap.ts"), "utf8");
const runnerSrc = fs.readFileSync(path.join(ROOT, "scripts/run-checkpoint-02-commercial-discovery.ts"), "utf8");
const vpsQualifySrc = fs.readFileSync(path.join(ROOT, "scripts/pharmaconnect-checkpoint-02-qualify-persisted.sh"), "utf8");

record(
  "reuses-existing-gate",
  discoverySrc.includes("assessNationalSearchCommercialCompetitor") &&
    discoverySrc.includes("requalifyPersistedCommercialCompetitorDiscovery"),
  "requalify calls assemble → existing commercial gate",
);
record(
  "reuses-existing-overlap",
  gateSrc.includes("compareNationalCommercialServiceOverlap") &&
    discoverySrc.includes("nationalSearchCommercialCompetitorGate"),
  "service overlap remains the locked gate path",
);
record(
  "no-new-classifier",
  !discoverySrc.includes("pharmaconnectClassifier") &&
    !discoverySrc.includes("PharmaConnectClassifier") &&
    !/classifyPharmaConnect|pharmaconnectOnly/i.test(discoverySrc),
  "no PharmaConnect classifier",
);
record(
  "no-pharmaconnect-special-case",
  !discoverySrc.includes('slug === "pharmaconnect"') &&
    !discoverySrc.includes("pharmaconnect.uk") &&
    !runnerSrc.includes("pharmaconnect.uk"),
  "generic slug path",
);
record(
  "no-domain-whitelist",
  !/boots\.com|nymopmr|surveyfocus|digitalpharmacist|brainly\.com|sciencedirect/.test(discoverySrc + gateSrc + overlapSrc),
  "engine sources have no real-domain whitelist",
);
record(
  "requalify-does-not-call-serp",
  !/searchNationalGoogleOrganic|runCommercialCompetitorDiscovery\(/.test(
    discoverySrc.slice(discoverySrc.indexOf("export function requalifyPersistedCommercialCompetitorDiscovery")),
  ) &&
    vpsQualifySrc.includes("--requalify-persisted") &&
    !vpsQualifySrc.includes("--live") &&
    !vpsQualifySrc.includes("CHECKPOINT_02_LIVE"),
  "persisted qualification has no live SERP path",
);

const fixturePath = path.join(
  ROOT,
  "fixtures/national-growth-engine/pharmaconnect-competitor-discovery.unqualified-real-shape.json",
);
const snapshot = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as NationalCompetitorDiscoveryResult;
record("fixture-has-19-real-shaped-candidates", snapshot.candidates.length === 19, String(snapshot.candidates.length));
record(
  "fixture-is-unenriched-contract",
  snapshot.candidates.every((row) => !row.role && !(row.detectedServices || []).length && !row.qualificationReason),
  "no role/services/reason before requalify",
);

const queryPoison = snapshot.candidates[0]?.description || "";
record(
  "query-evidence-sentence-not-used-as-website-text",
  /google organic serp for query/i.test(queryPoison) &&
    !/google organic serp for query/i.test(websiteTextFromPersistedCandidate(snapshot.candidates[0])),
  "tenant query provenance is not competitor website evidence",
);

const discoveryFile = nationalCompetitorDiscoveryPath("pharmaconnect");
const fixtureFile = nationalCompetitorDiscoveryFixturePath("pharmaconnect");
const previousDiscovery = fs.existsSync(discoveryFile) ? fs.readFileSync(discoveryFile, "utf8") : null;
const previousFixture = fs.existsSync(fixtureFile) ? fs.readFileSync(fixtureFile, "utf8") : null;

const realShaped = requalifyPersistedCommercialCompetitorDiscovery("pharmaconnect", {
  persist: false,
  snapshot,
});
const summary = commercialDiscoverySummary(realShaped);
const byDomain = Object.fromEntries(realShaped.candidates.map((row) => [row.domain, row]));

record("real-shaped-count-preserved", realShaped.candidates.length === 19, String(realShaped.candidates.length));
record("classification-preserved", realShaped.candidates.every((row) => Boolean(row.role)), realShaped.candidates.map((row) => row.role).join("|"));
record(
  "commercial-provider-preserved",
  realShaped.candidates.every((row) => typeof row.commercialProvider === "boolean"),
  "boolean on every candidate",
);
record(
  "detected-services-preserved",
  realShaped.candidates.every((row) => Array.isArray(row.detectedServices)),
  "array on every candidate",
);
record(
  "service-overlap-preserved",
  realShaped.candidates.every((row) => Array.isArray(row.overlappingServices) && typeof row.serviceOverlap === "boolean"),
  "overlap fields persisted",
);
record(
  "qualification-preserved",
  realShaped.candidates.every((row) => Boolean(row.qualification) && Boolean(row.qualificationReason)),
  "qualification + reason",
);
record(
  "rejection-reason-preserved",
  realShaped.candidates.every((row) => row.qualification === "qualified" || Boolean(row.qualificationReason || row.rejectionReasons[0])),
  "non-qualified candidates keep a reason",
);
record("unclassified-zero-after-gate", summary.unclassified === 0, String(summary.unclassified));
record("ranked-keyword-requests-remain-0", (realShaped.rankedKeywordRequests ?? 0) === 0, String(realShaped.rankedKeywordRequests));
record("evidence-kind-real", realShaped.evidenceKind === "REAL_DISCOVERY", String(realShaped.evidenceKind));
record("provenance-source-preserved", realShaped.candidates.every((row) => row.source === "search-engine"), "search-engine");
record(
  "raw-serp-not-automatic-competitor",
  realShaped.candidates.every((row) => row.role !== "commercial_competitor" || row.qualification !== "qualified"),
  `direct=${summary.direct}`,
);
record(
  "publisher-not-automatic-competitor",
  byDomain["pharmaceutical-journal.com"]?.role === "publisher" &&
    byDomain["pharmaceutical-journal.com"]?.qualification !== "qualified" &&
    byDomain["pharmacymagazine.co.uk"]?.role === "publisher" &&
    byDomain["pharmacymagazine.co.uk"]?.qualification !== "qualified",
  `${byDomain["pharmaceutical-journal.com"]?.role}/${byDomain["pharmacymagazine.co.uk"]?.role}`,
);
record(
  "professional-body-not-automatic-competitor",
  byDomain["rcpharm.org"]?.qualification !== "qualified" &&
    byDomain["rcpharm.org"]?.role !== "commercial_competitor",
  byDomain["rcpharm.org"]?.role || "missing",
);
record(
  "retail-pharmacy-not-automatic-competitor",
  byDomain["boots.com"]?.qualification !== "qualified" &&
    byDomain["boots.com"]?.role !== "commercial_competitor",
  byDomain["boots.com"]?.role || "missing",
);

const agencyText = "We are a UK digital agency for community pharmacies. We provide pharmacy website design, local SEO, email marketing, website hosting and growth audits. We work with pharmacy businesses across the United Kingdom. Our services help pharmacy owners. Contact us to get started.";
const publisherText = "Pharmacy Magazine is the leading trade press publication. Read the latest issue. Editorial team. Subscribe to our magazine. Newsroom.";
const professionalText = "The Royal College is a professional body. Membership benefits. Become a member. Professional standards. Register of members. Faculty of pharmacy.";
const retailerText = "Boots is a health and beauty retailer. Add to basket. Store locator. Our stores. Shop now. Buy online. Repeat prescription. We dispense medicines and health products. Opening hours.";

const gateProof = requalifyPersistedCommercialCompetitorDiscovery("pharmaconnect", {
  persist: false,
  snapshot: {
    ...snapshot,
    evidenceKind: "FIXTURE_VALIDATION",
    discoveryProvider: "fixture",
    candidates: [
      {
        ...snapshot.candidates[0],
        id: "national-pharmacy-digital-agency-co-uk",
        name: "Pharmacy Digital Agency",
        domain: "pharmacy-digital-agency.co.uk",
        websiteUrl: "https://pharmacy-digital-agency.co.uk",
        title: "Pharmacy Digital Agency",
        description: null,
        websiteText: agencyText,
        source: "search-engine",
        discoveryEvidence: "SERP discovery from tenant services/market queries.",
      },
      {
        ...snapshot.candidates[0],
        id: "national-pharmacy-trade-press-co-uk",
        name: "Trade Press",
        domain: "pharmacy-trade-press.co.uk",
        websiteUrl: "https://pharmacy-trade-press.co.uk",
        title: "Trade Press",
        description: null,
        websiteText: publisherText,
        source: "search-engine",
        discoveryEvidence: "SERP discovery.",
      },
      {
        ...snapshot.candidates[0],
        id: "national-royal-college-example",
        name: "Royal College",
        domain: "royal-college.example",
        websiteUrl: "https://royal-college.example",
        title: "Royal College",
        description: null,
        websiteText: professionalText,
        source: "search-engine",
        discoveryEvidence: "SERP discovery.",
      },
      {
        ...snapshot.candidates[0],
        id: "national-retail-pharmacy-chain-co-uk",
        name: "Retail Chain",
        domain: "retail-pharmacy-chain.co.uk",
        websiteUrl: "https://retail-pharmacy-chain.co.uk",
        title: "Retail Chain",
        description: null,
        websiteText: retailerText,
        source: "search-engine",
        discoveryEvidence: "SERP discovery.",
      },
    ],
  },
});
const proofByDomain = Object.fromEntries(gateProof.candidates.map((row) => [row.domain, row]));
record(
  "commercial-overlapping-provider-can-qualify",
  proofByDomain["pharmacy-digital-agency.co.uk"]?.role === "commercial_competitor" &&
    proofByDomain["pharmacy-digital-agency.co.uk"]?.qualification === "qualified" &&
    (proofByDomain["pharmacy-digital-agency.co.uk"]?.overlappingServices || []).length > 0,
  `${proofByDomain["pharmacy-digital-agency.co.uk"]?.role}/${proofByDomain["pharmacy-digital-agency.co.uk"]?.qualification}`,
);
record(
  "publisher-with-website-text-not-competitor",
  proofByDomain["pharmacy-trade-press.co.uk"]?.role === "publisher" &&
    proofByDomain["pharmacy-trade-press.co.uk"]?.qualification !== "qualified",
  proofByDomain["pharmacy-trade-press.co.uk"]?.role || "missing",
);
record(
  "professional-body-with-website-text-not-competitor",
  proofByDomain["royal-college.example"]?.role === "professional_body" &&
    proofByDomain["royal-college.example"]?.qualification !== "qualified",
  proofByDomain["royal-college.example"]?.role || "missing",
);
record(
  "retailer-with-website-text-not-competitor",
  proofByDomain["retail-pharmacy-chain.co.uk"]?.role === "customer_market" &&
    proofByDomain["retail-pharmacy-chain.co.uk"]?.qualification !== "qualified",
  proofByDomain["retail-pharmacy-chain.co.uk"]?.role || "missing",
);
record("fixture-requalify-is-not-real-discovery", gateProof.evidenceKind === "FIXTURE_VALIDATION", String(gateProof.evidenceKind));

const html = renderNationalSearchIntelligencePage("pharmaconnect");
record(
  "browser-can-derive-inspection-fields",
  /Classification:/i.test(html) &&
    /Commercial provider:/i.test(html) &&
    /Detected commercial services:/i.test(html) &&
    /Material overlapping services:/i.test(html) &&
    /Qualification:/i.test(html) &&
    /Why:/i.test(html) &&
    /data-cp02-unclassified/.test(html),
  "browser maps role/qualification/services from canonical snapshot",
);

const realUnchanged = previousDiscovery == null
  ? !fs.existsSync(discoveryFile)
  : fs.readFileSync(discoveryFile, "utf8") === previousDiscovery;
const fixtureUnchanged = previousFixture == null
  ? !fs.existsSync(fixtureFile)
  : fs.readFileSync(fixtureFile, "utf8") === previousFixture;
record("did-not-write-real-snapshot", realUnchanged, realUnchanged ? "unchanged" : "modified");
record("did-not-write-fixture-snapshot", fixtureUnchanged, fixtureUnchanged ? "unchanged" : "modified");
record("no-external-fetch", fetchCalls === 0, String(fetchCalls));

if (previousDiscovery == null) {
  try { fs.unlinkSync(discoveryFile); } catch { /* ignore */ }
} else {
  fs.writeFileSync(discoveryFile, previousDiscovery, "utf8");
}
if (previousFixture == null) {
  try { fs.unlinkSync(fixtureFile); } catch { /* ignore */ }
} else {
  fs.writeFileSync(fixtureFile, previousFixture, "utf8");
}

const passed = checks.filter((row) => row.pass).length;
console.log(`\n${passed === checks.length ? "✅" : "❌"} ${passed}/${checks.length} checks passed\n`);
console.log(`TOTAL_REAL_CANDIDATES=${summary.total}`);
console.log(`DIRECT_COMMERCIAL_COMPETITORS=${summary.direct}`);
console.log(`ADJACENT_COMMERCIAL_PROVIDERS=${summary.adjacent}`);
console.log(`REJECTED_CANDIDATES=${summary.rejected}`);
console.log(`UNCLASSIFIED_CANDIDATES=${summary.unclassified}`);
console.log("COMPETITOR_RANKED_KEYWORD_REQUESTS=0");
console.log("DATAFORSEO_CALLS=0");
console.log(`FETCH_CALLS=${fetchCalls}`);
globalThis.fetch = originalFetch;
if (passed !== checks.length) process.exit(1);
