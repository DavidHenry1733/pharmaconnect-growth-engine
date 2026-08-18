#!/usr/bin/env npx tsx
/**
 * Search Intelligence → Growth Intelligence → Gap → Growth Plan flow.
 * Does not call DataForSEO, Google Places, or GSC.
 * Does not generate content or request indexing.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as growthEnginePageRenderers from "../src/pharmacy/growthEnginePageRenderers.ts";
import * as growthEngineFrameworkService from "../src/pharmacy/growthEngineFrameworkService.ts";
import * as growthEngineGrowthPlanResolver from "../src/pharmacy/growthEngineGrowthPlanResolver.ts";
import * as nationalGrowthIntelligenceService from "../src/pharmacy/nationalGrowthIntelligenceService.ts";
import * as nationalSearchIntelligenceV1Service from "../src/pharmacy/nationalSearchIntelligenceV1Service.ts";
import {
  ensurePharmaconnectCollectedSearchIntelligenceEquivalent,
  removePharmaconnectCollectedSearchIntelligenceEquivalent,
} from "./pharmaconnect-collected-search-intelligence-equivalent.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function main() {
  console.log("\n=== SEARCH INTELLIGENCE → GROWTH INTELLIGENCE → GAP → GROWTH PLAN ===\n");
  const { renderGrowthIntelligencePage, renderGrowthPlanPage } = exported(growthEnginePageRenderers);
  const { buildGrowthPlanRecommendation } = exported(growthEngineFrameworkService);
  const { resolveGrowthPlan } = exported(growthEngineGrowthPlanResolver);
  const { actionableNationalGaps, buildNationalGrowthIntelligence } = exported(nationalGrowthIntelligenceService);
  const { readNationalSearchIntelligence } = exported(nationalSearchIntelligenceV1Service);
  const ensured = ensurePharmaconnectCollectedSearchIntelligenceEquivalent();
  try {
    const search = readNationalSearchIntelligence("pharmaconnect");
    const intelligence = buildNationalGrowthIntelligence("pharmaconnect");
    const plan = resolveGrowthPlan("pharmaconnect");
    if (plan.platform !== "national") {
      record("national-plan", false, plan.platform);
      process.exit(1);
    }

    const competitors = search.organicCompetitors || [];
    const qualified = competitors.filter((row) => row.eligibleForKeywordExpansion).length;
    const competitorGaps = intelligence.gaps.filter((item) => item.competitorGap || item.type === "COMPETITOR_GAP");
    const actionable = actionableNationalGaps(intelligence);
    const giHtml = renderGrowthIntelligencePage("pharmaconnect", null);
    const gpHtml = renderGrowthPlanPage("pharmaconnect", buildGrowthPlanRecommendation("pharmaconnect"));

    record("si-unchanged-collected", search.status === "collected", search.status);
    record("si-customer-keywords-1", (search.customerOrganicFootprint?.keywordCount ?? search.customerKeywords.length) === 1, String(search.customerKeywords.length));
    record("si-organic-19", competitors.length === 19, String(competitors.length));
    record("si-qualified-0", qualified === 0, String(qualified));
    record("si-universes-0", search.competitorKeywordUniverses.length === 0, String(search.competitorKeywordUniverses.length));
    record("gi-consumes-si", intelligence.search.status === "collected" && intelligence.search.customerKeywords === 1 && intelligence.search.organicCandidates === 19, `${intelligence.search.status}/${intelligence.search.customerKeywords}/${intelligence.search.organicCandidates}`);
    record("gi-sparse-honest", intelligence.search.sparse === true && intelligence.limitations.some((row) => /sparse/i.test(row)), intelligence.limitations.join(" | "));
    record("competitor-gaps-fabricated-no", competitorGaps.length === 0 && intelligence.competitorGapsFabricated === false, String(competitorGaps.length));
    record("insufficient-competitor-evidence-visible", intelligence.gaps.some((item) => item.type === "INSUFFICIENT_COMPETITOR_EVIDENCE"), intelligence.gaps.map((g) => g.type).join(","));
    record("non-competitor-opportunities", actionable.some((item) => item.type !== "COMPETITOR_GAP" && item.actionable), String(actionable.length));
    record(
      "every-gap-has-contract-fields",
      intelligence.gaps.every((item) => item.type && item.source && item.currentState && item.evidence.length && item.whyItMatters && item.recommendedAction && item.priority && item.confidence && item.provenance.evidenceSource),
      String(intelligence.gaps.length),
    );
    record("plan-consumes-gaps", plan.plan.gapsConsumed === true && Boolean(plan.plan.primary?.gapId) && plan.plan.priorities.some((p) => p.gapId === plan.plan.primary?.gapId), plan.plan.primary?.gapId || "none");
    record(
      "plan-items-evidence-backed",
      plan.plan.priorities.length > 0 && plan.plan.priorities.every((item) => item.evidence.length > 0 && item.provenance && item.gapId),
      String(plan.plan.priorities.length),
    );
    record("generation-gated", plan.plan.readyToGenerate === false && plan.plan.contentGenerationState === "blocked" && plan.plan.generationState === "not_started", `${plan.plan.readyToGenerate}/${plan.plan.contentGenerationState}`);
    record("approval-gate-present", /Approve Growth Plan/i.test(gpHtml) && /acknowledge\/growth-plan/.test(gpHtml), "approval form");
    record("content-generation-not-executed", !/Campaign Builder to generate/i.test(gpHtml) && /generation stays blocked|blocked before approval/i.test(gpHtml), "generation blocked");
    record("indexing-not-executed", !/Request Indexing|submit published pages for search indexing/i.test(giHtml + gpHtml), "no indexing");
    record("gi-html-si-counts", /data-pc-gi-search-status="collected"/.test(giHtml) && /data-pc-gi-customer-keywords="1"/.test(giHtml) && /data-pc-gi-organic-candidates="19"/.test(giHtml) && /data-pc-gi-qualified-commercial="0"/.test(giHtml) && /data-pc-gi-sparse="yes"/.test(giHtml), "GI visible SI contract");
    record("gp-html-priorities", /data-pc-gp-section="priorities"/.test(gpHtml) && /data-pc-gp-priority=/.test(gpHtml) && /data-pc-gp-section="limitations"/.test(gpHtml), "plan priorities + limitations");
    record("local-pharmacy-engine-untouched", fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineCampaignRecommendationEngine.ts"), "utf8").includes("eligibleCampaignServices"), "local engine file intact");

    const passed = checks.filter((c) => c.pass).length;
    const total = checks.length;
    console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
    if (passed !== total) process.exit(1);
  } finally {
    removePharmaconnectCollectedSearchIntelligenceEquivalent(ensured.created);
  }
}

main();
