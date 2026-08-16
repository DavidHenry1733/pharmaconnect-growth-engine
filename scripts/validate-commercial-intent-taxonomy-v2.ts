#!/usr/bin/env npx tsx
import taxonomy from "../src/pharmacy/commercialIntentTaxonomyV2.ts";

const { classifyCommercialIntentV2, scoreCommercialOpportunityV2 } = taxonomy;

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

function type(keyword: string) {
  return classifyCommercialIntentV2(keyword).type;
}

function scope(keyword: string) {
  return classifyCommercialIntentV2(keyword).marketScope;
}

const money = [
  "pharmacy seo",
  "pharmacy web design",
  "pharmacy digital marketing",
  "pharmacy advertising",
  "pharmacy ads",
  "digital marketing for pharma",
  "digital marketing for pharmacies",
  "seo for pharmacies",
  "web design for pharmacies",
  "advertising for pharmacies",
  "pharmacy website design",
  "pharmacy marketing agency",
];

for (const keyword of money) {
  check(`money-${keyword}`, type(keyword) === "MONEY_KEYWORD", type(keyword));
}

const patient = [
  "cost of flu jab",
  "flu vaccination how much",
  "ear wax removal pharmacy",
  "flu jabs at pharmacies",
  "pharmacy flu vaccination",
  "cheapest flu jab",
];
for (const keyword of patient) {
  check(`patient-${keyword}`, type(keyword) === "PATIENT_SERVICE", type(keyword));
}

const navigation = ["numark login", "pharmacy portal sign in"];
for (const keyword of navigation) {
  check(`nav-${keyword}`, type(keyword) === "NAVIGATIONAL", type(keyword));
}

const local = ["chatham pharmacy", "pharmacy near me"];
for (const keyword of local) {
  check(`local-${keyword}`, type(keyword) === "LOCAL_PHARMACY", type(keyword));
}

const support = [
  "pharmacy marketing ideas",
  "how to market a pharmacy",
  "pharmacy marketing strategy",
  "pharmacy website requirements",
  "how pharmacies attract patients",
  "pharmacy social media marketing",
];
for (const keyword of support) {
  check(`support-${keyword}`, ["COMMERCIAL_SUPPORT", "MONEY_KEYWORD"].includes(type(keyword)), type(keyword));
}

check("industry-irrelevant", type("pharmacists online") !== "MONEY_KEYWORD", type("pharmacists online"));
check(
  "no-cpc-override",
  scoreCommercialOpportunityV2({
    keyword: "cost of flu jab",
    cpc: 50,
    searchVolume: 500,
    directCompetitorsRanking: 6,
    bestCompetitorPosition: 1,
    hasDomainGapEvidence: true,
  }).score < 60,
  "patient service remains below high priority despite high CPC",
);
check(
  "domain-gap-preserved",
  scoreCommercialOpportunityV2({
    keyword: "pharmacy advertising",
    cpc: 18.86,
    searchVolume: 170,
    directCompetitorsRanking: 1,
    bestCompetitorPosition: 5,
    hasDomainGapEvidence: true,
  }).reasons.length > 0,
  "reasons retained",
);
check("review-pharma-creative-agencies", type("pharma creative agencies") === "MONEY_KEYWORD" && scope("pharma creative agencies") === "BROAD", `${type("pharma creative agencies")} ${scope("pharma creative agencies")}`);
check("review-pharma-creative-agency", type("pharma creative agency") === "MONEY_KEYWORD" && scope("pharma creative agency") === "BROAD", `${type("pharma creative agency")} ${scope("pharma creative agency")}`);
check("review-pharmacy-leaflet", type("pharmacy leaflet") === "COMMERCIAL_SUPPORT", type("pharmacy leaflet"));
check("review-pharmacy-leaflets", type("pharmacy leaflets") === "COMMERCIAL_SUPPORT", type("pharmacy leaflets"));
check("review-pharmacy-letter", type("pharmacy letter") === "COMMERCIAL_SUPPORT", type("pharmacy letter"));
check("review-inventory", type("pharmacy inventory management") === "INDUSTRY_IRRELEVANT", type("pharmacy inventory management"));
check("review-pharmacovigilance", type("pharmacovigilance service provider") === "INDUSTRY_IRRELEVANT", type("pharmacovigilance service provider"));
check("review-chain-pharmacy", type("chain pharmacy") === "INDUSTRY_IRRELEVANT", type("chain pharmacy"));
check("review-top-online-pharmacies", type("top online pharmacies") === "PATIENT_SERVICE", type("top online pharmacies"));
check("review-pharmacists-online", type("pharmacists online") !== "MONEY_KEYWORD", type("pharmacists online"));
check("review-pharmacy-seekers", type("pharmacy seekers") === "INDUSTRY_IRRELEVANT", type("pharmacy seekers"));
check("review-pharma-focus", type("pharma focus") === "NAVIGATIONAL", type("pharma focus"));
check("review-pharmafocus", type("pharmafocus") === "NAVIGATIONAL", type("pharmafocus"));
check("review-media-pharmacy", type("media pharmacy") === "INDUSTRY_IRRELEVANT", type("media pharmacy"));
check("review-pharmaplace", type("pharmaplace") === "NAVIGATIONAL", type("pharmaplace"));
check("scope-core", scope("pharmacy seo") === "CORE", scope("pharmacy seo"));
check("scope-broad", scope("pharmaceutical marketing agency") === "BROAD", scope("pharmaceutical marketing agency"));
check(
  "broad-does-not-outrank-core-on-cpc-alone",
  scoreCommercialOpportunityV2({ keyword: "pharmaceutical marketing agency", cpc: 80, searchVolume: 100, directCompetitorsRanking: 1 }).score <
    scoreCommercialOpportunityV2({ keyword: "pharmacy seo", cpc: 1, searchVolume: 50, directCompetitorsRanking: 3, bestCompetitorPosition: 5 }).score,
  "core priority protected",
);

console.log(`\n${fail ? "FAIL" : "PASS"} — ${pass}/${pass + fail} checks\n`);
if (fail) process.exit(1);
