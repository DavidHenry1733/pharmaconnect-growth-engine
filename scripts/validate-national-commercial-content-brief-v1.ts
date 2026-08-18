#!/usr/bin/env npx tsx
/**
 * Commercial content brief adapter for approved Growth Plan items.
 * Isolated fixtures. Does not call DataForSEO, Google Places, or GSC.
 * Does not publish, index, or overwrite live VPS drafts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as nationalCommercialContentBrief from "../src/pharmacy/nationalCommercialContentBrief.ts";
import * as nationalApprovedPlanGenerationService from "../src/pharmacy/nationalApprovedPlanGenerationService.ts";
import * as growthEngineFrameworkService from "../src/pharmacy/growthEngineFrameworkService.ts";
import * as pharmacyContentPackageService from "../src/pharmacy/pharmacyContentPackageService.ts";
import * as growthEnginePageRenderers from "../src/pharmacy/growthEnginePageRenderers.ts";
import * as growthEngineReviewCentrePage from "../src/pharmacy/growthEngineReviewCentrePage.ts";
import {
  ensurePharmaconnectCollectedSearchIntelligenceEquivalent,
  removePharmaconnectCollectedSearchIntelligenceEquivalent,
} from "./pharmaconnect-collected-search-intelligence-equivalent.ts";
import type { ApprovedGrowthPlanItem } from "../src/pharmacy/nationalApprovedPlanContract.ts";

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SLUG = "pharmaconnect";
const CAMPAIGN = "approved-growth-plan";

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

function item(partial: Partial<ApprovedGrowthPlanItem> & Pick<ApprovedGrowthPlanItem, "recommendationId" | "gapId">): ApprovedGrowthPlanItem {
  return {
    commercialService: null,
    recommendedAction: "Improve commercial visibility.",
    targetPageType: "EXISTING PAGE IMPROVEMENT",
    contentType: "blog",
    evidence: ["Diagnostic evidence placeholder."],
    priority: "HIGH",
    confidence: "HIGH",
    provenance: "SEARCH_INTELLIGENCE · PERSISTED_PROVEN · test",
    whyRecommended: "Visibility is weak.",
    evidenceClass: "PROVEN_GAP",
    source: "Search Intelligence",
    type: "KEYWORD_VISIBILITY_GAP",
    ...partial,
  };
}

function backupPath(file: string): string {
  return `${file}.brief-test-bak`;
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
  const {
    buildCommercialContentBriefs,
    fixtureTenantContext,
    customerFacingHasInternalLanguage,
    findInternalDiagnosticLanguage,
  } = exported(nationalCommercialContentBrief);
  const { generateApprovedGrowthPlanContent } = exported(nationalApprovedPlanGenerationService);
  const { saveWorkflowAcknowledgement, buildGrowthPlanRecommendation } = exported(growthEngineFrameworkService);
  const { persistApprovedGrowthPlanContentPackage } = exported(pharmacyContentPackageService);
  const { renderGeneratePage } = exported(growthEnginePageRenderers);
  const { renderReviewCentrePage } = exported(growthEngineReviewCentrePage);

  console.log("\n=== COMMERCIAL CONTENT BRIEF ===\n");

  const ctx = fixtureTenantContext({
    slug: "fixture-agency",
    businessName: "Fixture Agency",
    services: [
      { serviceId: "pharmacy-website-design", serviceName: "Pharmacy Website Design", href: "https://fixture.example/pharmacy-website-design/" },
      { serviceId: "pharmacy-local-seo", serviceName: "Pharmacy Local SEO", href: "https://fixture.example/local-seo-for-pharmacies/" },
      { serviceId: "pharmacy-growth-audit", serviceName: "Pharmacy Growth Audits" },
    ],
    serviceUrls: {
      "pharmacy-website-design": "https://fixture.example/pharmacy-website-design/",
      "pharmacy-local-seo": "https://fixture.example/local-seo-for-pharmacies/",
      "pharmacy-growth-audit": "https://fixture.example/contact-us/",
    },
    websiteCoverage: [
      { serviceName: "Pharmacy Website Design", mainPageUrl: "https://fixture.example/pharmacy-website-design/", coverageStatus: "dedicated-page" },
    ],
  });

  const validService = item({
    recommendationId: "config-weak-page-pharmacy-website-design",
    gapId: "config-weak-page-pharmacy-website-design",
    commercialService: "Pharmacy Website Design",
    recommendedAction: "Use this action as a structured Growth Plan candidate; do not generate content until approved.",
    targetPageType: "EXISTING PAGE IMPROVEMENT",
    whyRecommended: "Use this action as a structured Growth Plan candidate; do not generate content until approved.",
    evidence: ["Configured commercial service Pharmacy Website Design already exists in the tenant catalogue."],
    type: "WEAK_SERVICE_COVERAGE",
    evidenceClass: "SUPPORTED_OPPORTUNITY",
  });
  const sparseOnly = item({
    recommendationId: "si-sparse-organic-footprint",
    gapId: "si-sparse-organic-footprint",
    commercialService: null,
    recommendedAction: "Strengthen organic visibility of existing commercial service pages.",
    whyRecommended: "A sparse ranking footprint limits competitor discovery.",
    evidence: ["Customer ranking keywords=1.", "Customer organic footprint is sparse."],
  });
  const position57 = item({
    recommendationId: "si-weak-ranking-pharmacy-communication-form",
    gapId: "si-weak-ranking-pharmacy-communication-form",
    commercialService: null,
    recommendedAction: "Improve commercial service pages. This ranking is informational.",
    whyRecommended: "The only collected ranking is outside the top 20.",
    evidence: [
      "Position=57.",
      "Search volume=90.",
      "Ranking URL=https://pharmaconnect.uk/2026/03/12/the-role-of-digital-communication-in-modern-pharmacy-care/.",
    ],
  });
  const existingImprovement = item({
    recommendationId: "si-commercial-services-unranked",
    gapId: "si-commercial-services-unranked",
    commercialService: "Pharmacy Local SEO",
    recommendedAction: "Improve or expand commercial service pages for Pharmacy Local SEO.",
    targetPageType: "EXISTING PAGE IMPROVEMENT",
    whyRecommended: "Collected ranking keywords do not currently include Pharmacy Local SEO.",
    evidence: ["Commercial services without a collected ranking match: Pharmacy Local SEO."],
    type: "KEYWORD_VISIBILITY_GAP",
    evidenceClass: "SUPPORTED_OPPORTUNITY",
  });
  const unmapped = item({
    recommendationId: "unmapped-generic-visibility",
    gapId: "unmapped-generic-visibility",
    commercialService: null,
    recommendedAction: "Create content from an unknown adjacent market theme.",
    whyRecommended: "No configured service is named.",
    evidence: ["No tenant commercial service overlap."],
    type: "SERP_OPPORTUNITY",
    evidenceClass: "SUPPORTED_OPPORTUNITY",
  });
  const missingDedicated = item({
    recommendationId: "config-weak-page-pharmacy-growth-audit",
    gapId: "config-weak-page-pharmacy-growth-audit",
    commercialService: "Pharmacy Growth Audits",
    recommendedAction: "Create or upgrade a dedicated Pharmacy Growth Audits page. Do not generate it until the Growth Plan is approved.",
    targetPageType: "SERVICE PAGE",
    whyRecommended: "Routing a commercial service to a contact page under-represents the offer.",
    evidence: ["serviceMoneyPages.pharmacy-growth-audit=https://fixture.example/contact-us/"],
    type: "WEAK_SERVICE_COVERAGE",
    evidenceClass: "SUPPORTED_OPPORTUNITY",
  });

  const validBatch = buildCommercialContentBriefs("fixture-agency", [validService], ctx);
  record(
    "valid-service-opportunity-eligible",
    validBatch.eligible.length === 1 && validBatch.eligible[0].commercialService === "Pharmacy Website Design",
    `${validBatch.eligible[0]?.commercialService || "none"}/${validBatch.eligible[0]?.contentAction}`,
  );
  record(
    "internal-language-in-evidence-not-title",
    /Growth Plan candidate/i.test(validBatch.eligible[0]?.reasonForCreation || "") &&
      (validBatch.eligible[0]?.internalNotes || []).some((row) => /Growth Plan candidate/i.test(row)) &&
      !customerFacingHasInternalLanguage(validBatch.eligible[0]?.workingTitle || "") &&
      !customerFacingHasInternalLanguage(validBatch.eligible[0]?.customerIntent || ""),
    validBatch.eligible[0]?.workingTitle || "missing",
  );
  record(
    "existing-page-not-duplicated",
    validBatch.eligible[0]?.contentAction === "EXISTING_PAGE_IMPROVEMENT" &&
      validBatch.eligible[0]?.existingPageUrl === "https://fixture.example/pharmacy-website-design/",
    String(validBatch.eligible[0]?.contentAction),
  );

  const sparseBatch = buildCommercialContentBriefs("fixture-agency", [sparseOnly], ctx);
  record(
    "sparse-footprint-alone-skipped",
    sparseBatch.eligible.length === 0 && sparseBatch.skipped[0]?.skipReason === "diagnostic_signal_only",
    sparseBatch.skipped[0]?.skipReason || "generated",
  );

  const positionBatch = buildCommercialContentBriefs("fixture-agency", [position57], ctx);
  record(
    "position-volume-alone-skipped",
    positionBatch.eligible.length === 0 && Boolean(positionBatch.skipped[0]?.skipReason),
    `${positionBatch.skipped[0]?.skipReason || "generated"} evidence retained=${positionBatch.skipped[0]?.evidence.length || 0}`,
  );
  record(
    "position-evidence-retained",
    (positionBatch.skipped[0]?.evidence || []).some((row) => /Position=57/.test(row)),
    "evidence kept on skipped brief",
  );

  const improveBatch = buildCommercialContentBriefs("fixture-agency", [existingImprovement], ctx);
  record(
    "existing-page-improvement-targets-canonical",
    improveBatch.eligible[0]?.contentAction === "EXISTING_PAGE_IMPROVEMENT" &&
      improveBatch.eligible[0]?.existingPageUrl === "https://fixture.example/local-seo-for-pharmacies/",
    String(improveBatch.eligible[0]?.existingPageUrl),
  );

  const unmappedBatch = buildCommercialContentBriefs("fixture-agency", [unmapped], ctx);
  record(
    "unmapped-recommendation-skipped",
    unmappedBatch.eligible.length === 0 && unmappedBatch.skipped[0]?.skipReason === "insufficient_commercial_service_mapping",
    unmappedBatch.skipped[0]?.skipReason || "generated",
  );

  const missingBatch = buildCommercialContentBriefs("fixture-agency", [missingDedicated], ctx);
  record(
    "missing-dedicated-page-is-new-service-page",
    missingBatch.eligible[0]?.contentAction === "NEW_SERVICE_PAGE" && missingBatch.eligible[0]?.commercialService === "Pharmacy Growth Audits",
    String(missingBatch.eligible[0]?.contentAction),
  );

  const duplicateBatch = buildCommercialContentBriefs("fixture-agency", [validService, validService], ctx);
  record(
    "duplicate-service-page-prevented",
    duplicateBatch.eligible.length === 1 && duplicateBatch.skipped.some((row) => row.skipReason === "duplicate_existing_service_page"),
    `eligible=${duplicateBatch.eligible.length} skipped=${duplicateBatch.skipped.map((s) => s.skipReason).join(",")}`,
  );

  const mixed = buildCommercialContentBriefs("fixture-agency", [sparseOnly, position57, validService, existingImprovement, unmapped], ctx);
  record("maximum-remains-3", mixed.eligible.length <= 3 && mixed.briefs.length <= 5, `eligible=${mixed.eligible.length} considered=${mixed.briefs.length}`);
  const fewer = buildCommercialContentBriefs("fixture-agency", [sparseOnly, validService, unmapped], ctx);
  record("fewer-than-three-allowed", fewer.eligible.length === 1 && fewer.skipped.length === 2, String(fewer.eligible.length));

  const zeroBatch = buildCommercialContentBriefs("fixture-agency", [sparseOnly, position57, unmapped], ctx);
  record("zero-allowed", zeroBatch.eligible.length === 0 && zeroBatch.skipped.length === 3, String(zeroBatch.eligible.length));

  const facingLeak = findInternalDiagnosticLanguage("Use this action as a structured Growth Plan candidate; do not generate content until approved. PROVEN_UNTAPPED customer ranking keywords=1 DataForSEO");
  record("firewall-detects-internal-language", facingLeak.length >= 4, facingLeak.join(","));
  record(
    "firewall-allows-customer-copy",
    !customerFacingHasInternalLanguage("Pharmacy Website Design for UK community pharmacies"),
    "clean title",
  );

  record(
    "existing-generator-symbol-reused",
    persistApprovedGrowthPlanContentPackage.name === "persistApprovedGrowthPlanContentPackage",
    persistApprovedGrowthPlanContentPackage.name,
  );

  const workflow = path.join(ROOT, "data/growth-engine", `${SLUG}-workflow.json`);
  const pkgFile = path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${CAMPAIGN}.json`);
  const ecoDir = path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, CAMPAIGN);
  copyIfExists(workflow, backupPath(workflow));
  copyIfExists(pkgFile, backupPath(pkgFile));
  copyIfExists(ecoDir, backupPath(ecoDir));
  if (fs.existsSync(workflow)) fs.rmSync(workflow, { force: true });
  if (fs.existsSync(pkgFile)) fs.rmSync(pkgFile, { force: true });
  if (fs.existsSync(ecoDir)) fs.rmSync(ecoDir, { recursive: true, force: true });
  const ensured = ensurePharmaconnectCollectedSearchIntelligenceEquivalent();
  try {
    saveWorkflowAcknowledgement(SLUG, "growth-plan");
    const generated = generateApprovedGrowthPlanContent(SLUG);
    const count = generated.manifest?.assets.length || 0;
    record("pharmaconnect-generation-not-blocked", generated.ok === true && generated.blocked === false, generated.error || "ok");
    record("pharmaconnect-count-max-3", count <= 3, String(count));
    record(
      "pharmaconnect-items-map-to-configured-services",
      (generated.manifest?.assets || []).every((asset) => Boolean(asset.commercialService && asset.customerIntent)),
      (generated.manifest?.assets || []).map((asset) => asset.commercialService).join(",") || "zero",
    );
    const html = (generated.manifest?.outputPaths || []).map((file) => fs.readFileSync(file, "utf8")).join("\n");
    record(
      "pharmaconnect-internal-language-absent-from-body",
      count === 0 || (!customerFacingHasInternalLanguage(html) && !/Growth Plan candidate/i.test(html) && !/customer ranking keywords=/i.test(html) && !/data-gap-id=/i.test(html)),
      count === 0 ? "zero items" : "customer HTML clean",
    );
    record(
      "pharmaconnect-evidence-attached",
      (generated.manifest?.assets || []).every((asset) => Boolean(asset.gapId && asset.provenance && (asset.evidence || []).length)),
      "gap/evidence/provenance",
    );
    record(
      "pharmaconnect-polish-active",
      (generated.manifest?.adminDiagnostics || []).includes("polish:pharmacyCommercialNarrativePolishV1") &&
        (generated.manifest?.adminDiagnostics || []).includes("brief:nationalCommercialContentBrief") &&
        (generated.manifest?.adminDiagnostics || []).includes("generator:pharmacyContentPackageService"),
      (generated.manifest?.adminDiagnostics || []).join("|"),
    );
    record("pharmaconnect-unpublished", generated.manifest?.published === false && generated.manifest?.indexed === false, `published=${generated.manifest?.published}`);
    record("pharmaconnect-zero-or-fewer-valid", count <= 3, `PHARMACONNECT_VALID_GENERATION_CANDIDATES=${count}`);

    const genHtml = renderGeneratePage(SLUG, buildGrowthPlanRecommendation(SLUG));
    const reviewHtml = renderReviewCentrePage(SLUG, CAMPAIGN);
    record("generate-page-separates-why", /data-pc-gen-section="why-recommended"/.test(genHtml) && /data-pc-gen-section="what-created"/.test(genHtml), "generate sections");
    record(
      "review-separates-why-and-what",
      /data-rc-section="why-recommended"/.test(reviewHtml) && /data-rc-section="what-created"/.test(reviewHtml) && /READY FOR REVIEW|Ready for review/i.test(reviewHtml),
      "review sections",
    );
    if (count > 0) {
      record("review-customer-intent-visible", /Customer intent:/i.test(reviewHtml) && /Commercial service:/i.test(reviewHtml), "intent+service");
    } else {
      record("review-customer-intent-visible", /READY FOR REVIEW|Ready for review/i.test(reviewHtml), "zero items still reviewed");
    }
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
