#!/usr/bin/env npx tsx
import fs from "node:fs";

const runtimePath = "data/national-growth-engine/pharmaconnect-market-opportunity-intelligence-v2.json";
const reclassifiedPath = "data/national-growth-engine/pharmaconnect-market-opportunity-intelligence-v2-reclassified.json";
const reclassifiedBPath = "data/national-growth-engine/pharmaconnect-market-opportunity-intelligence-v2-reclassified-b.json";
const fixturePath = "fixtures/national-growth-engine/pharmaconnect-market-opportunity-intelligence-v2.json";
const file = process.argv.includes("--reclassified-b") && fs.existsSync(reclassifiedBPath)
  ? reclassifiedBPath
  : process.argv.includes("--reclassified") && fs.existsSync(reclassifiedPath)
  ? reclassifiedPath
  : process.argv.includes("--fixture") || !fs.existsSync(runtimePath)
    ? fixturePath
    : runtimePath;

const snapshot = JSON.parse(fs.readFileSync(file, "utf8"));
const originalSnapshot = file === reclassifiedBPath && fs.existsSync(runtimePath)
  ? JSON.parse(fs.readFileSync(runtimePath, "utf8"))
  : null;
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
console.log(`CORE money keywords: ${universe.filter((item: any) => item.type === "MONEY_KEYWORD" && item.marketScope === "CORE").length}`);
console.log(`ADJACENT money keywords: ${universe.filter((item: any) => item.type === "MONEY_KEYWORD" && item.marketScope === "ADJACENT").length}`);
console.log(`BROAD money keywords: ${universe.filter((item: any) => item.type === "MONEY_KEYWORD" && item.marketScope === "BROAD").length}`);
console.log(`CORE demand: ${demand((item) => item.type === "MONEY_KEYWORD" && item.marketScope === "CORE")}`);
console.log(`ADJACENT demand: ${demand((item) => item.type === "MONEY_KEYWORD" && item.marketScope === "ADJACENT")}`);
console.log(`BROAD demand: ${demand((item) => item.type === "MONEY_KEYWORD" && item.marketScope === "BROAD")}`);
console.log(`Requests: ${costs.requests ?? "Not available"}`);
console.log(`Tasks: ${costs.tasks ?? "Not available"}`);
console.log(`Cost: ${costs.totalCost ?? "Not available"}`);

console.log("\nEndpoint costs:");
for (const endpoint of snapshot.endpoints || []) {
  console.log(`${endpoint.endpoint} | used=${endpoint.used} | requests=${endpoint.requests} | tasks=${endpoint.tasks} | cost=${endpoint.cost}`);
}

printKeyword("TOP 30 MONEY KEYWORDS", (item) => item.type === "MONEY_KEYWORD");
printKeyword("TOP 30 CORE MONEY", (item) => item.type === "MONEY_KEYWORD" && item.marketScope === "CORE");
printKeyword("TOP 30 ADJACENT/BROAD MONEY", (item) => item.type === "MONEY_KEYWORD" && (item.marketScope === "ADJACENT" || item.marketScope === "BROAD"));
printKeyword("TOP 30 COMMERCIAL SUPPORT", (item) => item.type === "COMMERCIAL_SUPPORT");
printKeyword("TOP 30 AUTHORITY SUPPORT", (item) => item.type === "AUTHORITY_SUPPORT");
printKeyword("TOP 30 AMBIGUOUS REVIEW", (item) => item.type === "AMBIGUOUS_REVIEW");
printKeyword("TOP 30 EXCLUDED BY SEARCH VOLUME", (item) => item.qualification === "REJECTED");

if (originalSnapshot) {
  const originalUniverse = originalSnapshot.universe || [];
  const originalReview = originalUniverse.filter((item: any) => item.type === "AMBIGUOUS_REVIEW" || item.qualification === "REVIEW");
  const originalReviewKeys = new Set(originalReview.map((item: any) => String(item.keyword || "").toLowerCase()));
  const moved = universe.filter((item: any) => originalReviewKeys.has(String(item.keyword || "").toLowerCase()) && item.type !== "AMBIGUOUS_REVIEW");
  console.log("\nREVIEW MOVEMENT");
  console.log(`Before: ${originalReview.length}`);
  console.log(`After: ${countBy("type", "AMBIGUOUS_REVIEW")}`);
  for (const target of ["MONEY_KEYWORD", "COMMERCIAL_SUPPORT", "AUTHORITY_SUPPORT", "PATIENT_SERVICE", "NAVIGATIONAL", "LOCAL_PHARMACY", "INDUSTRY_IRRELEVANT"]) {
    console.log(`Moved to ${target}: ${moved.filter((item: any) => item.type === target).length}`);
  }
}

console.log("\nTARGET TERM CLASSIFICATIONS");
for (const keyword of [
  "pharma creative agencies",
  "pharma creative agency",
  "pharmacy leaflet",
  "pharmacy leaflets",
  "pharmacy letter",
  "pharmacy inventory management",
  "pharmacovigilance service provider",
  "chain pharmacy",
  "top online pharmacies",
  "pharma focus",
  "pharmafocus",
  "media pharmacy",
  "pharmaplace",
  "pharmacy advertising",
  "pharmacy ads",
  "digital marketing for pharma",
  "pharmacy web design",
  "pharmacy seo",
  "pharmacy digital marketing",
]) {
  const item = universe.find((row: any) => String(row.keyword || "").toLowerCase() === keyword);
  console.log(`${keyword}: ${item ? `${item.type} / ${item.qualification} / ${item.marketScope || "NO_SCOPE"} / score=${item.score}` : "NOT FOUND"}`);
}
