#!/usr/bin/env npx tsx
import fs from "node:fs";
import path from "node:path";
import taxonomy from "../src/pharmacy/commercialIntentTaxonomyV2.ts";

const { scoreCommercialOpportunityV2 } = taxonomy;
const inputPath = "data/national-growth-engine/pharmaconnect-market-opportunity-intelligence-v2.json";
const outputPath = process.argv.includes("--b")
  ? "data/national-growth-engine/pharmaconnect-market-opportunity-intelligence-v2-reclassified-b.json"
  : "data/national-growth-engine/pharmaconnect-market-opportunity-intelligence-v2-reclassified.json";

if (!fs.existsSync(inputPath)) {
  console.error(`Live/runtime V2 snapshot not found: ${inputPath}`);
  process.exit(1);
}

const snapshot = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const reclassified = {
  ...snapshot,
  reclassifiedAt: new Date().toISOString(),
  universe: (snapshot.universe || []).map((item: any) => {
    const scored = scoreCommercialOpportunityV2({
      keyword: item.keyword,
      searchVolume: item.searchVolume,
      cpc: item.cpc,
      paidCompetition: item.paidCompetition,
      directCompetitorsRanking: item.directCompetitorsRanking,
      bestCompetitorPosition: item.bestCompetitorPosition,
      hasDomainGapEvidence: Array.isArray(item.sources) && item.sources.includes("domain_intersection_gap"),
    });
    const type = scored.type;
    const qualification =
      type === "MONEY_KEYWORD" || type === "COMMERCIAL_SUPPORT" || type === "AUTHORITY_SUPPORT"
        ? "QUALIFIED"
        : type === "AMBIGUOUS_REVIEW"
          ? "REVIEW"
          : "REJECTED";
    return {
      ...item,
      type,
      marketScope: scored.marketScope,
      qualification,
      score: scored.score,
      priority: scored.score >= 80 ? "HIGH" : scored.score >= 60 ? "MEDIUM" : "LOW",
      reasons: scored.reasons,
    };
  }),
};

const counts = new Map<string, number>();
for (const item of reclassified.universe) counts.set(item.type, (counts.get(item.type) || 0) + 1);
const commercialDemand = reclassified.universe
  .filter((item: any) => item.type === "MONEY_KEYWORD")
  .reduce((sum: number, item: any) => sum + (item.searchVolume || 0), 0);
const supportDemand = reclassified.universe
  .filter((item: any) => item.type === "COMMERCIAL_SUPPORT" || item.type === "AUTHORITY_SUPPORT")
  .reduce((sum: number, item: any) => sum + (item.searchVolume || 0), 0);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(reclassified, null, 2) + "\n");

console.log("\n=== MARKET UNIVERSE V2 RECLASSIFICATION ===\n");
console.log(`Total unique: ${reclassified.universe.length}`);
for (const key of ["MONEY_KEYWORD", "COMMERCIAL_SUPPORT", "AUTHORITY_SUPPORT", "PATIENT_SERVICE", "NAVIGATIONAL", "LOCAL_PHARMACY", "INDUSTRY_IRRELEVANT", "AMBIGUOUS_REVIEW"]) {
  console.log(`${key}: ${counts.get(key) || 0}`);
}
console.log(`Total commercial demand: ${commercialDemand}`);
console.log(`Total supporting demand: ${supportDemand}`);

function printTop(label: string, predicate: (item: any) => boolean) {
  console.log(`\n${label}`);
  for (const item of reclassified.universe.filter(predicate).sort((a: any, b: any) => (b.searchVolume || 0) - (a.searchVolume || 0)).slice(0, 30)) {
    console.log(`${item.keyword} | volume=${item.searchVolume ?? "n/a"} | cpc=${item.cpc ?? "n/a"} | score=${item.score} | ${item.reasons.slice(0, 2).join("; ")}`);
  }
}

printTop("TOP 30 MONEY KEYWORDS", (item) => item.type === "MONEY_KEYWORD");
printTop("TOP 30 COMMERCIAL SUPPORT", (item) => item.type === "COMMERCIAL_SUPPORT");
printTop("TOP 30 AMBIGUOUS REVIEW", (item) => item.type === "AMBIGUOUS_REVIEW");
