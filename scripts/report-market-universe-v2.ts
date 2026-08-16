#!/usr/bin/env npx tsx
import fs from "node:fs";

const runtimePath = "data/national-growth-engine/pharmaconnect-market-opportunity-intelligence-v2.json";
const reclassifiedPath = "data/national-growth-engine/pharmaconnect-market-opportunity-intelligence-v2-reclassified.json";
const fixturePath = "fixtures/national-growth-engine/pharmaconnect-market-opportunity-intelligence-v2.json";
const file = process.argv.includes("--reclassified") && fs.existsSync(reclassifiedPath)
  ? reclassifiedPath
  : process.argv.includes("--fixture") || !fs.existsSync(runtimePath)
    ? fixturePath
    : runtimePath;

const snapshot = JSON.parse(fs.readFileSync(file, "utf8"));
const s = snapshot.summary || {};
const costs = snapshot.costs || {};
const universe = snapshot.universe || [];

function countBy(field: string, value: string) {
  return universe.filter((item: any) => item[field] === value).length;
}

function demand(predicate: (item: any) => boolean) {
  return universe.filter(predicate).reduce((sum: number, item: any) => sum + (item.searchVolume || 0), 0);
}

function printKeyword(label: string, predicate: (item: any) => boolean) {
  console.log(`\n${label}`);
  const rows = universe
    .filter(predicate)
    .sort((a: any, b: any) => (b.searchVolume || 0) - (a.searchVolume || 0) || (b.cpc || 0) - (a.cpc || 0))
    .slice(0, 30);
  if (!rows.length) {
    console.log("None");
    return;
  }
  rows.forEach((item: any, index: number) => {
    console.log(`${index + 1}. ${item.keyword} | ${item.type} | ${item.qualification} | volume=${item.searchVolume ?? "n/a"} | cpc=${item.cpc ?? "n/a"} | competitors=${item.directCompetitorsRanking ?? "n/a"} | best=${item.bestCompetitorDomain ?? "n/a"} | position=${item.bestCompetitorPosition ?? "n/a"} | gap=${item.gapType ?? "n/a"} | score=${item.score ?? "n/a"} | reason=${(item.reasons || []).slice(0, 2).join("; ")}`);
  });
}

console.log("\n=== MARKET UNIVERSE V2 REPORT ===\n");
console.log(`Source: ${file}`);
console.log(`Live execution: ${snapshot.liveExecution}`);
console.log(`Raw: ${s.raw ?? "Not available"}`);
console.log(`Unique: ${universe.length || s.unique || 0}`);
console.log(`MONEY_KEYWORD: ${countBy("type", "MONEY_KEYWORD")}`);
console.log(`COMMERCIAL_SUPPORT: ${countBy("type", "COMMERCIAL_SUPPORT")}`);
console.log(`AUTHORITY_SUPPORT: ${countBy("type", "AUTHORITY_SUPPORT")}`);
console.log(`PATIENT_SERVICE: ${countBy("type", "PATIENT_SERVICE")}`);
console.log(`NAVIGATIONAL: ${countBy("type", "NAVIGATIONAL")}`);
console.log(`LOCAL_PHARMACY: ${countBy("type", "LOCAL_PHARMACY")}`);
console.log(`INDUSTRY_IRRELEVANT: ${countBy("type", "INDUSTRY_IRRELEVANT")}`);
console.log(`AMBIGUOUS_REVIEW: ${countBy("type", "AMBIGUOUS_REVIEW")}`);
console.log(`Rejected: ${countBy("qualification", "REJECTED")}`);
console.log(`Review: ${countBy("qualification", "REVIEW")}`);
console.log(`Untapped: ${countBy("gapType", "UNTAPPED")}`);
console.log(`Weak coverage: ${countBy("gapType", "WEAK_COVERAGE")}`);
console.log(`Defend/improve: ${countBy("gapType", "DEFEND_IMPROVE")}`);
console.log(`New market: ${countBy("gapType", "NEW_MARKET")}`);
console.log(`Unknown/review gap: ${countBy("gapType", "REVIEW")}`);
console.log(`Commercial demand: ${demand((item) => item.type === "MONEY_KEYWORD")}`);
console.log(`Supporting demand: ${demand((item) => item.type === "COMMERCIAL_SUPPORT" || item.type === "AUTHORITY_SUPPORT")}`);
console.log(`Requests: ${costs.requests ?? "Not available"}`);
console.log(`Tasks: ${costs.tasks ?? "Not available"}`);
console.log(`Cost: ${costs.totalCost ?? "Not available"}`);

console.log("\nEndpoint costs:");
for (const endpoint of snapshot.endpoints || []) {
  console.log(`${endpoint.endpoint} | used=${endpoint.used} | requests=${endpoint.requests} | tasks=${endpoint.tasks} | cost=${endpoint.cost}`);
}

printKeyword("TOP 30 MONEY KEYWORDS", (item) => item.type === "MONEY_KEYWORD");
printKeyword("TOP 30 COMMERCIAL SUPPORT", (item) => item.type === "COMMERCIAL_SUPPORT");
printKeyword("TOP 30 AUTHORITY SUPPORT", (item) => item.type === "AUTHORITY_SUPPORT");
printKeyword("TOP 30 AMBIGUOUS REVIEW", (item) => item.type === "AMBIGUOUS_REVIEW");
printKeyword("TOP 30 EXCLUDED BY SEARCH VOLUME", (item) => item.qualification === "REJECTED");
