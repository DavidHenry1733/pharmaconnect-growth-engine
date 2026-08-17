#!/usr/bin/env npx tsx
/**
 * NI-03B — Explicit National Search Intelligence collection.
 * Does not run on page render. Bounded DataForSEO Labs + SERP only.
 */
import * as serviceMod from "../src/pharmacy/nationalSearchIntelligenceV1Service.ts";

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const { collectNationalSearchIntelligence } = exported(serviceMod);

const slug = String(process.argv[2] || "").trim();
const force = process.argv.includes("--force");

if (!slug) {
  console.error("Usage: pnpm exec tsx scripts/collect-national-search-intelligence-v1.ts <tenantSlug> [--force]");
  process.exit(1);
}

const snapshot = await collectNationalSearchIntelligence(slug, { force });
console.log(JSON.stringify({
  ok: snapshot.status === "collected" || snapshot.status === "empty",
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
  requests: snapshot.costs.requests,
  tasks: snapshot.costs.tasks,
  totalCost: snapshot.costs.totalCost,
  capturedAt: snapshot.capturedAt,
}, null, 2));
