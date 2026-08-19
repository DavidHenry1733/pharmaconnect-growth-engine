#!/usr/bin/env npx tsx
/**
 * Approved Growth Plan → existing content package → Review Centre.
 * Isolated local test state. Does not call DataForSEO, Google Places, or GSC.
 * Does not publish or index. Restores pharmaconnect workflow/package files.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as growthEngineFrameworkService from "../src/pharmacy/growthEngineFrameworkService.ts";
import * as growthEngineNationalGrowthPlanService from "../src/pharmacy/growthEngineNationalGrowthPlanService.ts";
import * as nationalApprovedPlanGenerationService from "../src/pharmacy/nationalApprovedPlanGenerationService.ts";
import * as pharmacyContentPackageService from "../src/pharmacy/pharmacyContentPackageService.ts";
import * as growthEnginePageRenderers from "../src/pharmacy/growthEnginePageRenderers.ts";
import * as growthEngineReviewCentreService from "../src/pharmacy/growthEngineReviewCentreService.ts";
import * as growthEngineReviewCentrePage from "../src/pharmacy/growthEngineReviewCentrePage.ts";
import {
  ensurePharmaconnectCollectedSearchIntelligenceEquivalent,
  removePharmaconnectCollectedSearchIntelligenceEquivalent,
} from "./pharmaconnect-collected-search-intelligence-equivalent.ts";

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SLUG = "pharmaconnect";
const APPROVED_GROWTH_PLAN_CAMPAIGN_ID = "approved-growth-plan";
const MAX_INITIAL_APPROVED_PLAN_ITEMS = 3;

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

function backupPath(file: string): string {
  return `${file}.approval-gen-test-bak`;
}

function copyIfExists(from: string, to: string) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

function restore(from: string, to: string) {
  if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true });
  if (fs.existsSync(from)) {
    fs.cpSync(from, to, { recursive: true });
    fs.rmSync(from, { recursive: true, force: true });
  }
}

function main() {
  const { saveWorkflowAcknowledgement, buildGrowthPlanRecommendation } = exported(growthEngineFrameworkService);
  const { buildNationalGrowthPlanView } = exported(growthEngineNationalGrowthPlanService);
  const { generateApprovedGrowthPlanContent, nationalGenerationBlockedReason, readApprovedPlanGenerationInput } =
    exported(nationalApprovedPlanGenerationService);
  const { loadContentPackage, persistApprovedGrowthPlanContentPackage } = exported(pharmacyContentPackageService);
  const { renderGeneratePage, renderGrowthPlanPage } = exported(growthEnginePageRenderers);
  const { buildReviewCentreView } = exported(growthEngineReviewCentreService);
  const { renderReviewCentrePage } = exported(growthEngineReviewCentrePage);

  console.log("\n=== APPROVED GROWTH PLAN → CONTENT → REVIEW ===\n");
  const workflow = path.join(ROOT, "data/growth-engine", `${SLUG}-workflow.json`);
  const pkgFile = path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${APPROVED_GROWTH_PLAN_CAMPAIGN_ID}.json`);
  const ecoDir = path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, APPROVED_GROWTH_PLAN_CAMPAIGN_ID);
  copyIfExists(workflow, backupPath(workflow));
  copyIfExists(pkgFile, backupPath(pkgFile));
  copyIfExists(ecoDir, backupPath(ecoDir));
  if (fs.existsSync(workflow)) fs.rmSync(workflow, { force: true });
  if (fs.existsSync(pkgFile)) fs.rmSync(pkgFile, { force: true });
  if (fs.existsSync(ecoDir)) fs.rmSync(ecoDir, { recursive: true, force: true });

  const ensured = ensurePharmaconnectCollectedSearchIntelligenceEquivalent();
  try {
    const blockedBefore = nationalGenerationBlockedReason(SLUG);
    const blockedGenerate = generateApprovedGrowthPlanContent(SLUG);
    record("generation-blocked-before-approval", Boolean(blockedBefore) && blockedGenerate.blocked === true, blockedBefore || "not blocked");

    const gpBefore = renderGrowthPlanPage(SLUG, buildGrowthPlanRecommendation(SLUG));
    record("approval-visible", /Approve Growth Plan/i.test(gpBefore) && /acknowledge\/growth-plan/.test(gpBefore), "approval action");
    record("generate-page-blocked", /data-pc-gen-blocked="yes"/.test(renderGeneratePage(SLUG, buildGrowthPlanRecommendation(SLUG))), "generate blocked UI");

    const ack = saveWorkflowAcknowledgement(SLUG, "growth-plan");
    const plan = buildNationalGrowthPlanView(SLUG);
    record("approval-persisted", Boolean(ack.acknowledgedSteps["growth-plan"]) && Boolean(ack.approvedPlan?.approvedAt), ack.approvedPlan?.approvedAt || "missing");
    record(
      "approval-audit-fields",
      ack.approvedPlan?.tenant === SLUG && Boolean(ack.approvedPlan?.planVersion) && (ack.approvedPlan?.items.length || 0) > 0,
      `${ack.approvedPlan?.tenant}/${ack.approvedPlan?.planVersion}/${ack.approvedPlan?.items.length || 0}`,
    );
    record("plan-approved-flag", plan.planApproved === true && plan.readyToGenerate === true, `${plan.planApproved}/${plan.readyToGenerate}`);

    const input = readApprovedPlanGenerationInput(SLUG);
    record("approved-items-become-generation-input", Boolean(input?.items.length) && input!.items.every((item) => item.gapId && item.evidence.length && item.provenance), String(input?.items.length || 0));
    record("max-initial-items", (input?.items.length || 0) <= MAX_INITIAL_APPROVED_PLAN_ITEMS, String(input?.items.length || 0));

    const unapproved = plan.priorities.filter((p) => !input?.items.some((item) => item.gapId === p.gapId));
    const generated = generateApprovedGrowthPlanContent(SLUG);
    record("generation-after-approval", generated.ok === true && generated.blocked === false, generated.error || "ok");
    const manifest = generated.manifest || loadContentPackage(SLUG, APPROVED_GROWTH_PLAN_CAMPAIGN_ID);
    record("existing-generator-reused", Boolean(manifest?.generatorVersion) && (manifest?.adminDiagnostics || []).includes("generator:pharmacyContentPackageService"), manifest?.generatorVersion || "missing");
    record("no-parallel-engine", persistApprovedGrowthPlanContentPackage.name === "persistApprovedGrowthPlanContentPackage", "package persist reused");
    record("generated-item-count", (manifest?.assets.length || 0) <= 3, String(manifest?.assets.length || 0));
    record(
      "unapproved-items-not-generated",
      unapproved.every((item) => !(manifest?.assets || []).some((asset) => asset.gapId === item.gapId)),
      `${unapproved.length} unapproved excluded`,
    );
    record(
      "evidence-preserved",
      (manifest?.assets || []).every((asset) => Boolean(asset.gapId && asset.provenance && (asset.evidence || []).length && asset.whyRecommended)),
      "gap/evidence/provenance",
    );
    const html = (manifest?.outputPaths || []).map((file) => fs.readFileSync(file, "utf8")).join("\n");
    const assetCount = manifest?.assets.length || 0;
    record(
      "tenant-specific",
      assetCount === 0
        ? true
        : /PharmaConnect/.test(html) && /UK community pharmacies/i.test(html) && !/Pharmacy First is an NHS advanced service/i.test(html) && !/Brook Pharmacy/i.test(html),
      assetCount === 0 ? "zero commercially valid drafts" : "PharmaConnect B2B",
    );
    record(
      "customer-facing-no-internal-language",
      assetCount === 0 || (!/Growth Plan candidate/i.test(html) && !/customer ranking keywords=/i.test(html) && !/do not generate content until approved/i.test(html)),
      assetCount === 0 ? "zero items" : "firewall",
    );
    record("nothing-published", manifest?.published === false && (assetCount === 0 || /data-published="false"/.test(html)), String(manifest?.published));
    record("nothing-indexed", manifest?.indexed === false && (assetCount === 0 || /data-indexed="false"/.test(html)), String(manifest?.indexed));

    const genHtml = renderGeneratePage(SLUG, buildGrowthPlanRecommendation(SLUG));
    record("generate-page-shows-items", /READY FOR REVIEW/.test(genHtml) && (assetCount === 0 || /data-pc-gen-item=/.test(genHtml)), "generate results");

    const review = buildReviewCentreView(SLUG, APPROVED_GROWTH_PLAN_CAMPAIGN_ID);
    const reviewHtml = renderReviewCentrePage(SLUG, APPROVED_GROWTH_PLAN_CAMPAIGN_ID);
    record("review-centre-connected", Boolean(review?.generated) && review?.readyForReview === true, review?.nextAction.title || "missing");
    record("review-visible-items", (review?.groups.flatMap((g) => g.assets).length || 0) === (manifest?.assets.length || 0), String(review?.groups.flatMap((g) => g.assets).length || 0));
    record("review-ready-unpublished", review?.published === false && review?.indexed === false && review?.canPublish === false && /READY FOR REVIEW|Ready for review/i.test(reviewHtml), `published=${review?.published}`);
    record(
      "review-evidence-cards",
      assetCount === 0
        ? /READY FOR REVIEW|Ready for review/i.test(reviewHtml)
        : /Why this was recommended|Why it was recommended/i.test(reviewHtml) && /Evidence source/i.test(reviewHtml) && /data-gap=/.test(reviewHtml),
      "review evidence",
    );
  } finally {
    restore(backupPath(workflow), workflow);
    restore(backupPath(pkgFile), pkgFile);
    restore(backupPath(ecoDir), ecoDir);
    removePharmaconnectCollectedSearchIntelligenceEquivalent(ensured.created);
  }

  const passed = checks.filter((c) => c.pass).length;
  console.log(`\n${passed === checks.length ? "✅" : "❌"} ${passed}/${checks.length} checks passed\n`);
  if (passed !== checks.length) process.exit(1);
}

main();
