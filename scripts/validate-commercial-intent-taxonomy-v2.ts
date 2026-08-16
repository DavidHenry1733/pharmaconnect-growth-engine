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

console.log(`\n${fail ? "FAIL" : "PASS"} — ${pass}/${pass + fail} checks\n`);
if (fail) process.exit(1);
