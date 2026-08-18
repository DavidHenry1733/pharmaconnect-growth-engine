#!/usr/bin/env npx tsx
/**
 * Isolated browser smoke for national Growth Intelligence and Growth Plan.
 * Uses persisted/equivalent Search Intelligence. Does not call paid APIs.
 * Does not generate content or restart PM2.
 */
import { chromium } from "playwright";
import * as growthEnginePageRenderers from "../src/pharmacy/growthEnginePageRenderers.ts";
import * as growthEngineFrameworkService from "../src/pharmacy/growthEngineFrameworkService.ts";
import {
  ensurePharmaconnectCollectedSearchIntelligenceEquivalent,
  removePharmaconnectCollectedSearchIntelligenceEquivalent,
} from "./pharmaconnect-collected-search-intelligence-equivalent.ts";

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

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
  const { renderGrowthIntelligencePage, renderGrowthPlanPage } = exported(growthEnginePageRenderers);
  const { buildGrowthPlanRecommendation } = exported(growthEngineFrameworkService);
  const ensured = ensurePharmaconnectCollectedSearchIntelligenceEquivalent();
  try {
    const giRendered = renderGrowthIntelligencePage("pharmaconnect", null);
    const gpRendered = renderGrowthPlanPage("pharmaconnect", buildGrowthPlanRecommendation("pharmaconnect"));
    const gi = await visiblePage(giRendered);
    const gp = await visiblePage(gpRendered);

    check("gi-http-200", /data-pc-gi-page="growth-intelligence"/.test(gi.html) && /Growth Intelligence/i.test(gi.text), "growth-intelligence document");
    check("gi-search-status-collected", /data-pc-gi-search-status="collected"/.test(gi.html) && /collected/i.test(gi.text), "Collected");
    check("gi-customer-keywords-1", /data-pc-gi-customer-keywords="1"/.test(gi.html) && /Customer ranking keywords/i.test(gi.text), "1");
    check("gi-organic-candidates-19", /data-pc-gi-organic-candidates="19"/.test(gi.html) && /Organic \/ SERP candidates/i.test(gi.text), "19");
    check("gi-commercial-competitors-0", /data-pc-gi-qualified-commercial="0"/.test(gi.html) && /Qualified commercial competitors/i.test(gi.text), "0");
    check("gi-sparse-visible", /data-pc-gi-sparse="yes"/.test(gi.html) && /Sparse search footprint: YES/i.test(gi.text), "sparse");
    check("gi-opportunity-list", /data-pc-gi-opportunity-list/.test(gi.html) && /data-pc-gi-opportunity=/.test(gi.html) && /Growth opportunities \/ gaps/i.test(gi.text), "opportunities");
    check(
      "gi-no-fabricated-competitor-gap",
      /data-pc-gi-competitor-gaps="0"/.test(gi.html) && !/data-pc-gi-type="COMPETITOR_GAP"/.test(gi.html) && /Competitor keyword gaps are not proven/i.test(gi.text),
      "no competitor gap",
    );

    check("gp-http-200", /data-pc-gp-page="growth-plan"/.test(gp.html) && /Your Growth Plan/i.test(gp.text), "growth-plan document");
    check("gp-priorities-visible", /data-pc-gp-section="priorities"/.test(gp.html) && /data-pc-gp-priority=/.test(gp.html) && /Top priorities/i.test(gp.text), "priorities");
    check("gp-priority-linked-to-evidence", /<strong>Evidence:<\/strong>/.test(gp.html) && /Provenance:/i.test(gp.text), "evidence linked");
    check("gp-limitations-visible", /data-pc-gp-section="limitations"/.test(gp.html) && /Evidence limitations/i.test(gp.text) && /Sparse current organic footprint: YES/i.test(gp.text), "limitations");
    check("gp-approval-visible", /Approve Growth Plan/i.test(gp.text) && /acknowledge\/growth-plan/.test(gp.html), "approval");
    check(
      "gp-generation-not-started",
      /data-pc-gp-generation="not_started"/.test(gp.html) && /blocked before approval/i.test(gp.text),
      "generation blocked",
    );

    const passed = items.filter((item) => item.pass).length;
    console.log(`\n${passed === items.length ? "PASS" : "FAIL"} — ${passed}/${items.length} checks\n`);
    if (passed !== items.length) process.exit(1);
  } finally {
    removePharmaconnectCollectedSearchIntelligenceEquivalent(ensured.created);
  }
}

main();
