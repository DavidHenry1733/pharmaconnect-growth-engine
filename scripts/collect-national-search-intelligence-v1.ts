#!/usr/bin/env npx tsx
/**
 * NI-03C — Explicit National Search Intelligence collection.
 * Does not run on page render. Bounded DataForSEO Labs only.
 */
import * as serviceMod from "../src/pharmacy/nationalSearchIntelligenceV1Service.ts";
import type { NationalSearchIntelligenceProgressEvent } from "../src/pharmacy/nationalSearchIntelligenceV1Service.ts";

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const {
  collectNationalSearchIntelligence,
  nationalSearchIntelligencePath,
  planNationalSearchIntelligenceCollection,
} = exported(serviceMod);

const slug = String(process.argv[2] || "").trim();
const force = process.argv.includes("--force");

if (!slug) {
  console.error("Usage: pnpm exec tsx scripts/collect-national-search-intelligence-v1.ts <tenantSlug> [--force]");
  process.exit(1);
}

function money(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `$${value}` : "$0";
}

const planned = planNationalSearchIntelligenceCollection(slug);
console.log(
  `PLAN customerKeywordTasks=${planned.customerKeywordTasks} competitorDiscoveryTasks=${planned.competitorDiscoveryTasks} competitorKeywordTasks=${planned.competitorKeywordTasks} maximumPaidRequests=${planned.maximumPaidRequests}`,
);

function printProgress(event: NationalSearchIntelligenceProgressEvent): void {
  switch (event.type) {
    case "plan":
      return;
    case "ranked_start":
      console.log("COLLECTING ranked_keywords...");
      return;
    case "ranked_complete":
      console.log(`RANKED_KEYWORDS COMPLETE — rows=${event.rows} cost=${money(event.cost)}`);
      return;
    case "ranked_failed":
      console.log(`RANKED_KEYWORDS FAILED — ${event.timedOut ? "TIMEOUT" : event.message}`);
      return;
    case "ranked_retry":
      console.log(`RANKED_KEYWORDS FAILED — ${event.statusCode ?? "unknown"} — retrying once`);
      return;
    case "competitors_domain_start":
      console.log("COLLECTING competitors_domain...");
      return;
    case "competitors_domain_complete":
      console.log(`COMPETITORS_DOMAIN COMPLETE — rows=${event.rows} cost=${money(event.cost)}`);
      return;
    case "competitors_domain_failed":
      console.log(`COMPETITORS_DOMAIN FAILED — ${event.timedOut ? "TIMEOUT" : event.message}`);
      return;
    case "competitors_domain_retry":
      console.log(`COMPETITORS_DOMAIN FAILED — ${event.statusCode ?? "unknown"} — retrying once`);
      return;
    case "competitor_keywords_start":
      console.log(`COLLECTING competitor ranked_keywords ${event.index}/${event.total} — ${event.domain}`);
      return;
    case "competitor_keywords_complete":
      console.log(`COMPETITOR KEYWORDS COMPLETE — ${event.domain} rows=${event.rows} cost=${money(event.cost)}`);
      return;
    case "competitor_keywords_failed":
      console.log(`COMPETITOR KEYWORDS FAILED — ${event.domain} ${event.timedOut ? "TIMEOUT" : event.message}`);
      return;
    case "competitor_keywords_retry":
      console.log(`COMPETITOR KEYWORDS FAILED — ${event.domain} ${event.statusCode ?? "unknown"} — retrying once`);
      return;
  }
}

const snapshot = await collectNationalSearchIntelligence(slug, { force, onProgress: printProgress });
console.log(`PERSISTED snapshot=${nationalSearchIntelligencePath(snapshot.tenantSlug)}`);
console.log(`STATUS=${String(snapshot.status).toUpperCase()}`);
console.log(`TOTAL_COST=${money(snapshot.costs.totalCost)}`);
console.log(JSON.stringify({
  ok: snapshot.status === "collected" || snapshot.status === "empty" || snapshot.status === "partial",
  tenantSlug: snapshot.tenantSlug,
  subjectDomain: snapshot.subjectDomain,
  status: snapshot.status,
  lastError: snapshot.lastError,
  reusedExistingSnapshot: snapshot.reusedExistingSnapshot,
  liveExecution: snapshot.liveExecution,
  authority: snapshot.authority,
  evidenceSource: snapshot.provenance.evidenceSource,
  keywordCount: snapshot.customerKeywords.length,
  competitorCount: snapshot.organicCompetitors.length,
  competitorKeywordCount: snapshot.summary.competitorKeywordCount,
  collectionPlan: snapshot.collectionPlan,
  requests: snapshot.costs.requests,
  tasks: snapshot.costs.tasks,
  totalCost: snapshot.costs.totalCost,
  capturedAt: snapshot.capturedAt,
}, null, 2));
