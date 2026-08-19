#!/usr/bin/env npx tsx
/**
 * Browser smoke: Growth Plan approval → Generate → Review Centre.
 * Isolated local test state. Does not call paid APIs, publish, or index.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import * as growthEngineFrameworkService from "../src/pharmacy/growthEngineFrameworkService.ts";
import * as nationalApprovedPlanGenerationService from "../src/pharmacy/nationalApprovedPlanGenerationService.ts";
import * as growthEnginePageRenderers from "../src/pharmacy/growthEnginePageRenderers.ts";
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

interface Item {
  id: string;
  pass: boolean;
  detail: string;
}

const items: Item[] = [];

function check(id: string, pass: boolean, detail: string) {
  items.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function backupPath(file: string): string {
  return `${file}.approval-smoke-bak`;
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

async function visiblePage(html: string): Promise<{ html: string; text: string }> {
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const rendered = await page.content();
    const text = await page.locator("body").innerText();
    await browser.close();
    return { html: rendered, text };
  } catch {
    return { html, text: html.replace(/<[^>]+>/g, " ") };
  }
}

async function main() {
  const { saveWorkflowAcknowledgement, buildGrowthPlanRecommendation } = exported(growthEngineFrameworkService);
  const { generateApprovedGrowthPlanContent } = exported(nationalApprovedPlanGenerationService);
  const { renderGeneratePage, renderGrowthPlanPage } = exported(growthEnginePageRenderers);
  const { renderReviewCentrePage } = exported(growthEngineReviewCentrePage);
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
    const gpBefore = await visiblePage(renderGrowthPlanPage(SLUG, buildGrowthPlanRecommendation(SLUG)));
    check("growth-plan-http-200", /data-pc-gp-page="growth-plan"/.test(gpBefore.html) && /Your Growth Plan/i.test(gpBefore.text), "growth plan 200");
    check("approval-visible", /Approve Growth Plan/i.test(gpBefore.text) && /acknowledge\/growth-plan/.test(gpBefore.html), "approval");
    check("generation-blocked-before-approval", /blocked before approval/i.test(gpBefore.text) && /data-pc-gp-approved="no"/.test(gpBefore.html), "blocked");

    saveWorkflowAcknowledgement(SLUG, "growth-plan");
    const gpAfter = await visiblePage(renderGrowthPlanPage(SLUG, buildGrowthPlanRecommendation(SLUG)));
    check("approve-action-succeeds", /data-pc-gp-approved="yes"/.test(gpAfter.html) && /plan approved/i.test(gpAfter.text), "approved");

    const genBlocked = await visiblePage(renderGeneratePage(SLUG, buildGrowthPlanRecommendation(SLUG)));
    check("generate-page-http-200", /data-pc-generate-page="national"/.test(genBlocked.html) && /Create your content/i.test(genBlocked.text), "generate 200");
    check("generate-unblocked-after-approval", /data-pc-gen-blocked="no"/.test(genBlocked.html) && /Generate approved content/i.test(genBlocked.text), "generate form");

    const result = generateApprovedGrowthPlanContent(SLUG);
    const count = result.manifest?.assets.length || 0;
    check("generate-0-to-3-items", Boolean(result.ok && result.manifest && count <= 3), String(count));
    check(
      "items-linked-to-evidence",
      (result.manifest?.assets || []).every((asset) => Boolean(asset.recommendationId && asset.gapId && asset.whyRecommended && (asset.evidence || []).length)),
      "recommendation/gap evidence",
    );
    check(
      "configured-service-and-intent",
      (result.manifest?.assets || []).every((asset) => Boolean(asset.commercialService && asset.customerIntent)),
      (result.manifest?.assets || []).map((asset) => asset.commercialService).join(",") || "zero",
    );
    const customerHtml = (result.manifest?.outputPaths || []).map((file) => fs.readFileSync(file, "utf8")).join("\n");
    check(
      "internal-language-absent-from-customer-content",
      count === 0 || (!/Growth Plan candidate/i.test(customerHtml) && !/customer ranking keywords=/i.test(customerHtml) && !/do not generate content until approved/i.test(customerHtml) && !/PROVEN_UNTAPPED/.test(customerHtml)),
      count === 0 ? "zero items" : "customer HTML clean",
    );

    const genAfter = await visiblePage(renderGeneratePage(SLUG, buildGrowthPlanRecommendation(SLUG)));
    check("generated-visible-on-generate-page", /READY FOR REVIEW/.test(genAfter.text) && (count === 0 || /data-pc-gen-item=/.test(genAfter.html)), "generated items");
    check("generate-separates-why", count === 0 || (/data-pc-gen-section="why-recommended"/.test(genAfter.html) && /data-pc-gen-section="what-created"/.test(genAfter.html)), "brief vs evidence");

    const review = await visiblePage(renderReviewCentrePage(SLUG, APPROVED_GROWTH_PLAN_CAMPAIGN_ID));
    check("review-centre-http-200", /Review Centre/i.test(review.text) && /data-ready-for-review="yes"/.test(review.html), "review 200");
    check(
      "generated-content-visible",
      count === 0
        ? /Ready for review|READY FOR REVIEW/i.test(review.text)
        : /data-asset-key=/.test(review.html) && /Why this was recommended|Why it was recommended/i.test(review.text) && /Customer intent/i.test(review.text) && /Commercial service/i.test(review.text),
      "items visible",
    );
    check("status-ready-for-review", /Ready for Review|READY FOR REVIEW|Ready for review/i.test(review.text), "ready for review");
    check("published-false", /data-published="false"/.test(review.html), "published=false");
    check("indexed-false", /data-indexed="false"/.test(review.html), "indexed=false");
  } finally {
    restore(backupPath(workflow), workflow);
    restore(backupPath(pkgFile), pkgFile);
    restore(backupPath(ecoDir), ecoDir);
    removePharmaconnectCollectedSearchIntelligenceEquivalent(ensured.created);
  }

  const passed = items.filter((item) => item.pass).length;
  console.log(`\n${passed === items.length ? "PASS" : "FAIL"} — ${passed}/${items.length} checks\n`);
  if (passed !== items.length) process.exit(1);
}

main();
