#!/usr/bin/env npx tsx
/**
 * Checkpoint 01 browser smoke: Business Intelligence + Website Intelligence.
 * Deterministic local render after the existing bounded website import.
 * Does not call paid APIs.
 */
import { chromium } from "playwright";

import * as pageRenderers from "../src/pharmacy/growthEnginePageRenderers.ts";
import * as nationalBi from "../src/pharmacy/growthEngineNationalBusinessIntelligenceService.ts";
import * as websiteIntel from "../src/pharmacy/growthEngineWebsiteIntelligenceService.ts";

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const SLUG = "pharmaconnect";

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

async function visiblePage(html: string) {
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
  const { renderBusinessIntelligencePage, renderWebsiteIntelligencePage } = exported(pageRenderers);
  const { buildNationalBusinessIntelligenceView } = exported(nationalBi);
  const { ensureWebsiteIntelligenceInventory } = exported(websiteIntel);
  await ensureWebsiteIntelligenceInventory(SLUG);
  const view = buildNationalBusinessIntelligenceView(SLUG);
  const bi = await visiblePage(renderBusinessIntelligencePage(SLUG, {} as never));
  const wi = await visiblePage(renderWebsiteIntelligencePage(SLUG));
  const commercial = view.inventory.pages.filter((page) => page.type === "commercial/service");

  check("bi-http-200", /data-pc-bi-page="business-intelligence"/.test(bi.html) && /Business Intelligence foundation/i.test(bi.text), "business intelligence document");
  check("who-is-this-business", /Who is this business/i.test(bi.text) && bi.text.includes(view.identity.businessName.display), view.identity.businessName.display);
  check("what-does-it-sell", /What does it sell/i.test(bi.text) && view.services.every((row) => bi.text.includes(row.serviceName)), `${view.services.length} services`);
  check("who-does-it-sell-to", /Who does it sell to/i.test(bi.text) && /TARGET CUSTOMER MARKET/i.test(bi.text), view.targetCustomer.display.slice(0, 80));
  check("what-market", /What market does it serve/i.test(bi.text) && /COUNTRY \/ MARKET/i.test(bi.text) && /LOCAL \/ NATIONAL/i.test(bi.text), view.marketScope.display);
  check(
    "website-content",
    /What website content already exists/i.test(bi.text) &&
      /Total pages discovered/i.test(bi.text) &&
      !/data-bi-inv="total">NOT YET CONNECTED/.test(bi.html) &&
      typeof view.inventory.totalPages === "number",
    String(view.inventory.totalPages),
  );
  check(
    "commercial-pages-visible",
    /Commercial \/ service pages/i.test(bi.text) && commercial.length > 0 && commercial.slice(0, 3).every((page) => bi.text.includes(page.url)),
    `${commercial.length} commercial pages`,
  );
  check("provenance-visible", /SOURCE=/.test(bi.text) && /CONFIDENCE=/.test(bi.text), "provenance");
  check("missing-visible", /What is still missing/i.test(bi.text), "missing section");
  check(
    "ready-for-competitor-discovery",
    /READY FOR COMPETITOR DISCOVERY/.test(bi.text) &&
      new RegExp(`data-ready-for-competitor-discovery="${view.readyForCompetitorDiscovery ? "yes" : "no"}"`).test(bi.html) &&
      (view.completeness.websiteInventory === "COMPLETE" || view.readyForCompetitorDiscovery === false),
    view.readyForCompetitorDiscovery ? "YES" : "NO",
  );
  check("no-rankings-invented", !/DataForSEO/i.test(bi.text) && !/qualified commercial competitor/i.test(bi.text), "no research stage");
  check("wi-http-200", /Website inventory|What is on your website/i.test(wi.text), "website intelligence document");
  check("wi-inventory-contract", /Total pages discovered/i.test(wi.text) && /data-wi-total-pages="\d+"/.test(wi.html), String(view.inventory.totalPages));

  const passed = items.filter((row) => row.pass).length;
  console.log(`\n${passed === items.length ? "PASS" : "FAIL"} — ${passed}/${items.length} checks\n`);
  if (passed !== items.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
