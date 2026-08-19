#!/usr/bin/env npx tsx
/**
 * Checkpoint 02 browser smoke. Renders persisted commercial discovery on the
 * existing national market / Search Intelligence page. No paid APIs.
 */
import { chromium } from "playwright";
import fs from "node:fs";

import * as pageMod from "../src/pharmacy/nationalSearchIntelligencePage.ts";
import * as discovery from "../src/pharmacy/nationalCommercialCompetitorDiscoveryService.ts";
import * as storage from "../src/pharmacy/nationalCompetitorDiscoveryStorageService.ts";

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const { renderNationalSearchIntelligencePage } = exported(pageMod);
const { qualifyInjectedCommercialCandidates } = exported(discovery);
const { writeNationalCompetitorDiscovery, nationalCompetitorDiscoveryPath } = exported(storage);

const items: Array<{ id: string; pass: boolean; detail: string }> = [];
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

const agencyText = "We are a UK digital agency for community pharmacies. We provide pharmacy website design, local SEO, email marketing, website hosting and growth audits. We work with pharmacy businesses across the United Kingdom. Our services help pharmacy owners. Contact us to get started.";
const retailerText = "Boots is a health and beauty retailer. Add to basket. Store locator. Our stores. Shop now. Buy online. Repeat prescription. We dispense medicines. Opening hours.";
const publisherText = "Pharmacy Magazine is the leading trade press publication. Read the latest issue. Editorial team. Subscribe to our magazine. Newsroom.";

const result = qualifyInjectedCommercialCandidates("pharmaconnect", [
  { domain: "pharmacy-digital-agency.co.uk", name: "Pharmacy Digital Agency", websiteText: agencyText, discoverySource: "search-engine", discoveryEvidence: "SERP from Business Intelligence services/market." },
  { domain: "retail-pharmacy-chain.co.uk", name: "Retail Pharmacy", websiteText: retailerText, discoverySource: "search-engine", discoveryEvidence: "SERP discovery." },
  { domain: "pharmacy-trade-press.co.uk", name: "Trade Press", websiteText: publisherText, discoverySource: "search-engine", discoveryEvidence: "SERP discovery." },
  { domain: "high-authority-overlap.example", name: "Overlap Only", websiteText: "", discoverySource: "organic-overlap", discoveryEvidence: "Organic overlap only.", sharedKeywordCount: 90 },
]);
const discoveryFile = nationalCompetitorDiscoveryPath("pharmaconnect");
const previousDiscovery = fs.existsSync(discoveryFile) ? fs.readFileSync(discoveryFile, "utf8") : null;
writeNationalCompetitorDiscovery(result);

const page = await visiblePage(renderNationalSearchIntelligencePage("pharmaconnect"));
check("http-200", /data-cp02-page="commercial-competitor-discovery"/.test(page.html), "commercial discovery panel");
check("bi-consumed", /PharmaConnect/i.test(page.text) && /Pharmacy Website Design/i.test(page.text), "business and services");
check("candidate-count", /Candidates discovered/i.test(page.text), "candidate count");
check("every-candidate-classified", page.html.includes("data-cp02-role=") && /Classification:/i.test(page.text), "classification");
check("direct-count-visible", /Direct commercial competitors/i.test(page.text), "direct count");
check("adjacent-or-rejected-visible", /Rejected \/ non-competitors/i.test(page.text) && /customer market|publisher/i.test(page.text), "non-commercial distinction");
check("qualification-reasoning", /Qualification: PASS/i.test(page.text) && /Qualification: FAIL/i.test(page.text) && /Why:/i.test(page.text), "pass/fail reasoning");
check("overlap-not-sole-qualification", page.text.includes("high-authority-overlap.example") && page.html.includes('data-cp02-qualified="no"'), "organic overlap not qualified");
check("ranked-keywords-zero", /COMPETITOR_RANKED_KEYWORD_REQUESTS=0/.test(page.text), "no ranked keyword expansion");
check("search-intelligence-page-still-present", /Search Intelligence/i.test(page.text), "existing page retained");

if (previousDiscovery == null) {
  try { fs.unlinkSync(discoveryFile); } catch { /* ignore */ }
} else {
  fs.writeFileSync(discoveryFile, previousDiscovery, "utf8");
}

const passed = items.filter((row) => row.pass).length;
console.log(`\n${passed === items.length ? "PASS" : "FAIL"} — ${passed}/${items.length} checks\n`);
if (passed !== items.length) process.exit(1);
