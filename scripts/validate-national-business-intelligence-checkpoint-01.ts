#!/usr/bin/env npx tsx
/**
 * Checkpoint 01 — generic national Business Intelligence foundation.
 * Does not call DataForSEO, Google Places, or GSC.
 * Does not start competitor discovery, research, Growth Plan, or content generation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as nationalBi from "../src/pharmacy/growthEngineNationalBusinessIntelligenceService.ts";
import * as nationalBiPage from "../src/pharmacy/growthEngineNationalBusinessIntelligencePage.ts";
import * as pageRenderers from "../src/pharmacy/growthEnginePageRenderers.ts";
import * as catalogueMod from "../src/pharmacy/growthEngineTenantServiceCatalogue.ts";
import * as websiteIntel from "../src/pharmacy/growthEngineWebsiteIntelligenceService.ts";

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SLUG = "pharmaconnect";

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

async function main() {
  const {
    assembleNationalBusinessIntelligence,
    buildNationalBusinessIntelligenceView,
  } = exported(nationalBi);
  const { renderNationalBusinessIntelligencePage } = exported(nationalBiPage);
  const { renderBusinessIntelligencePage, renderWebsiteIntelligencePage } = exported(pageRenderers);
  const { resolveTenantServiceCatalogue } = exported(catalogueMod);
  const { ensureWebsiteIntelligenceInventory, resolveWebsiteUrlForIntelligence } = exported(websiteIntel);

  console.log("\n=== CHECKPOINT 01 NATIONAL BUSINESS INTELLIGENCE ===\n");

  const serviceSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineNationalBusinessIntelligenceService.ts"), "utf8");
  const pageSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineNationalBusinessIntelligencePage.ts"), "utf8");
  const wiSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineWebsiteIntelligenceService.ts"), "utf8");
  record(
    "no-pharmaconnect-slug-hardcode",
    !serviceSrc.includes('slug === "pharmaconnect"') &&
      !pageSrc.includes('slug === "pharmaconnect"') &&
      !wiSrc.includes('slug === "pharmaconnect"') &&
      !serviceSrc.includes("pharmaconnect.uk") &&
      !pageSrc.includes("pharmaconnect.uk") &&
      !wiSrc.includes("pharmaconnect.uk"),
    "generic sources",
  );
  record(
    "generic-import-uses-project-or-profile-website",
    wiSrc.includes("resolveWebsiteUrlForIntelligence") &&
      wiSrc.includes("collectProjectWebsiteSeeds") &&
      wiSrc.includes("ensureWebsiteIntelligenceInventory"),
    "existing bounded importer connected",
  );

  const sparse = assembleNationalBusinessIntelligence({
    slug: "sparse-national-tenant",
    project: null,
    profile: null,
    website: null,
    importSnap: null,
    platform: "national",
  });
  record("sparse-identity-unknown", sparse.identity.businessName.origin === "NOT_FOUND", sparse.identity.businessName.display);
  record("sparse-services-empty", sparse.services.length === 0, String(sparse.services.length));
  record("sparse-inventory-not-connected", sparse.inventory.origin === "NOT_YET_CONNECTED", sparse.inventory.origin);
  record("sparse-not-ready", sparse.readyForCompetitorDiscovery === false && sparse.missingRequired.length > 0, sparse.missingRequired.join("|"));
  record("sparse-no-fabricated-rankings", !JSON.stringify(sparse).includes("reviewCount") && !JSON.stringify(sparse).toLowerCase().includes("search volume"), "no rankings fabricated");

  const identityOnly = assembleNationalBusinessIntelligence({
    slug: "identity-only-tenant",
    project: {
      businessName: "Acme Digital",
      domain: "https://example.test",
      businessType: "agency",
      strapline: "Software for grocers",
      country: "United Kingdom",
      services: ["Website Design"],
    },
    profile: null,
    website: null,
    importSnap: null,
    platform: "national",
  });
  record(
    "inventory-missing-blocks-readiness",
    identityOnly.readyForCompetitorDiscovery === false &&
      identityOnly.completeness.websiteInventory === "MISSING" &&
      identityOnly.missingRequired.some((row) => /website inventory/i.test(row)),
    identityOnly.missingRequired.join("|"),
  );

  const configuredWebsite = resolveWebsiteUrlForIntelligence(SLUG);
  record("configured-website-resolved-generically", Boolean(configuredWebsite), configuredWebsite || "missing");

  const snapshot = await ensureWebsiteIntelligenceInventory(SLUG);
  const view = buildNationalBusinessIntelligenceView(SLUG);
  const catalogue = resolveTenantServiceCatalogue(SLUG);
  record("identity-from-canonical-sources", Boolean(view.identity.businessName.value) && view.identity.businessName.origin !== "NOT_FOUND", `${view.identity.businessName.display}/${view.identity.businessName.source}`);
  record("domain-from-canonical-sources", Boolean(view.identity.domain.value), `${view.identity.domain.display}/${view.identity.domain.source}`);
  record(
    "services-from-catalogue",
    view.services.length === catalogue.services.length && view.services.every((row) => catalogue.services.some((s) => s.serviceId === row.serviceId)),
    `${view.services.length} vs catalogue ${catalogue.services.length}`,
  );
  record("target-customer-from-evidence", Boolean(view.targetCustomer.value) && view.targetCustomer.origin !== "NOT_FOUND", `${view.targetCustomer.origin}/${view.targetCustomer.source}`);
  record("market-from-canonical-sources", Boolean(view.marketCountry.value) && Boolean(view.marketScope.value), `${view.marketCountry.display}/${view.marketScope.display}`);
  record(
    "real-website-inventory-imported",
    view.inventory.origin === "IMPORTED" && (view.inventory.totalPages || 0) > 0,
    `${view.inventory.origin}/${view.inventory.totalPages ?? "none"} source=${snapshot?.source || "none"}`,
  );
  record(
    "page-counts-are-numbers",
    [view.inventory.totalPages, view.inventory.commercialServicePages, view.inventory.blogResourcePages, view.inventory.aboutContactUtilityPages, view.inventory.unknownOtherPages].every(
      (value) => typeof value === "number",
    ),
    `total=${view.inventory.totalPages} commercial=${view.inventory.commercialServicePages} blog=${view.inventory.blogResourcePages} utility=${view.inventory.aboutContactUtilityPages} other=${view.inventory.unknownOtherPages}`,
  );
  const commercialPages = view.inventory.pages.filter((page) => page.type === "commercial/service");
  const classifiedTypes = new Set(view.inventory.pages.map((page) => page.type));
  record("commercial-pages-classified", commercialPages.length > 0 && commercialPages.every((page) => page.url && page.title), `${commercialPages.length} commercial pages`);
  record(
    "page-types-use-inventory-buckets",
    view.inventory.pages.every((page) => ["commercial/service", "blog/resource", "about/contact/utility", "unknown/other"].includes(page.type)),
    [...classifiedTypes].join("|"),
  );
  record(
    "unknown-inventory-stays-unknown",
    view.inventory.origin === "IMPORTED" || view.inventory.origin === "NOT_YET_CONNECTED" || view.inventory.origin === "INSUFFICIENT_EVIDENCE" || view.inventory.origin === "NOT_CONFIGURED",
    view.inventory.origin,
  );
  record("provenance-on-identity", Boolean(view.identity.businessName.source && view.identity.businessName.origin), view.identity.businessName.origin);
  record("provenance-on-inventory-pages", view.inventory.pages.every((page) => Boolean(page.source && page.url)), `${view.inventory.pages.length} pages with source`);
  record(
    "readiness-truthful",
    view.readyForCompetitorDiscovery === (view.missingRequired.length === 0),
    `${view.readyForCompetitorDiscovery}/${view.missingRequired.join(",") || "none"}`,
  );
  record(
    "readiness-requires-inventory",
    view.completeness.websiteInventory === "COMPLETE" ? view.readyForCompetitorDiscovery === true : view.readyForCompetitorDiscovery === false,
    `${view.completeness.websiteInventory}/${view.readyForCompetitorDiscovery ? "YES" : "NO"}`,
  );
  record("gbp-absence-does-not-block", !view.missingRequired.some((row) => /google business|ranking|gsc|competitor/i.test(row)), view.missingRequired.join(",") || "none");

  const html = renderNationalBusinessIntelligencePage(SLUG);
  const routed = renderBusinessIntelligencePage(SLUG, {} as never);
  record("bi-page-questions-visible", /Who is this business/i.test(html) && /What does it sell/i.test(html) && /Who does it sell to/i.test(html) && /What market does it serve/i.test(html), "question headings");
  record("bi-provenance-visible", /SOURCE=/.test(html) && /CONFIDENCE=/.test(html), "provenance labels");
  record("bi-ready-flag-visible", /READY FOR COMPETITOR DISCOVERY/.test(html) && /data-ready-for-competitor-discovery=/.test(html), "ready flag");
  record("bi-route-uses-national-page", /data-pc-bi-page="business-intelligence"/.test(routed) && /data-growth-platform="national"/.test(routed), "national BI route");
  record("services-rendered-from-view", view.services.every((row) => html.includes(row.serviceName)), view.services.map((s) => s.serviceName).join(","));
  record(
    "bi-inventory-numbers-visible",
    !/data-bi-inv="total">NOT YET CONNECTED/.test(html) && /data-bi-inv="total">\d+/.test(html),
    `total=${view.inventory.totalPages}`,
  );
  record(
    "bi-commercial-pages-visible",
    /Commercial \/ service pages/i.test(html) && commercialPages.slice(0, 3).every((page) => html.includes(page.url)),
    `${commercialPages.length} commercial rows`,
  );

  const wi = renderWebsiteIntelligencePage(SLUG);
  record("wi-page-renders", /Website inventory|What is on your website/i.test(wi) && /data-pc-wi-page="website-intelligence"|Scan my website/i.test(wi), "website intelligence");
  record("wi-inventory-status-visible", /Total pages discovered/i.test(wi) && /data-wi-total-pages="\d+"/.test(wi), `total=${view.inventory.totalPages}`);

  const passed = checks.filter((c) => c.pass).length;
  console.log(`\n${passed === checks.length ? "✅" : "❌"} ${passed}/${checks.length} checks passed\n`);
  console.log(`BUSINESS_NAME=${view.identity.businessName.display}`);
  console.log(`DOMAIN=${view.identity.domain.display}`);
  console.log(`BUSINESS_TYPE=${view.identity.businessType.display}`);
  console.log(`TARGET_CUSTOMER_MARKET=${view.targetCustomer.display}`);
  console.log(`MARKET_COUNTRY=${view.marketCountry.display}`);
  console.log(`MARKET_SCOPE=${view.marketScope.display}`);
  console.log(`COMMERCIAL_SERVICES_COUNT=${view.services.length}`);
  console.log(`COMMERCIAL_SERVICES=${view.services.map((s) => s.serviceName).join(" | ")}`);
  console.log(`TOTAL_PAGES_DISCOVERED=${view.inventory.totalPages ?? "NOT_YET_CONNECTED"}`);
  console.log(`COMMERCIAL_SERVICE_PAGES=${view.inventory.commercialServicePages ?? "NOT_YET_CONNECTED"}`);
  console.log(`BLOG_RESOURCE_PAGES=${view.inventory.blogResourcePages ?? "NOT_YET_CONNECTED"}`);
  console.log(`ABOUT_CONTACT_UTILITY_PAGES=${view.inventory.aboutContactUtilityPages ?? "NOT_YET_CONNECTED"}`);
  console.log(`UNKNOWN_OTHER_PAGES=${view.inventory.unknownOtherPages ?? "NOT_YET_CONNECTED"}`);
  console.log(`WEBSITE_INVENTORY_STATUS=${view.completeness.websiteInventory}`);
  console.log(`READY_FOR_COMPETITOR_DISCOVERY=${view.readyForCompetitorDiscovery ? "YES" : "NO"}`);
  if (passed !== checks.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
