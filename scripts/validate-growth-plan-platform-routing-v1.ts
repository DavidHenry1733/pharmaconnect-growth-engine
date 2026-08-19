#!/usr/bin/env npx tsx
/**
 * GP-01C — national/local Growth Plan routing validation.
 * Does not call DataForSEO, Google Places, or GSC.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as growthPlatformResolverService from "../src/pharmacy/growthPlatformResolverService.ts";
import * as growthEngineGrowthPlanResolver from "../src/pharmacy/growthEngineGrowthPlanResolver.ts";
import * as growthPlanIntelligenceV1Service from "../src/pharmacy/growthPlanIntelligenceV1Service.ts";
import * as growthEngineTenantServiceCatalogue from "../src/pharmacy/growthEngineTenantServiceCatalogue.ts";
import * as growthEnginePageRenderers from "../src/pharmacy/growthEnginePageRenderers.ts";
import * as growthEngineCampaignBuilderPage from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import * as growthEngineFrameworkService from "../src/pharmacy/growthEngineFrameworkService.ts";
import * as masterAdminLockedCommercialServiceCatalog from "../src/pharmacy/masterAdminLockedCommercialServiceCatalog.ts";
import * as masterAdminPlatformOperationsDashboardService from "../src/pharmacy/masterAdminPlatformOperationsDashboardService.ts";
import * as nationalGrowthIntelligenceService from "../src/pharmacy/nationalGrowthIntelligenceService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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

function containsAny(hay: string, needles: string[]): string[] {
  return needles.filter((n) => hay.includes(n));
}

function main() {
  const { resolveGrowthPlatform } = exported(growthPlatformResolverService);
  const { resolveGrowthPlan } = exported(growthEngineGrowthPlanResolver);
  const { readGrowthPlanIntelligenceV1 } = exported(growthPlanIntelligenceV1Service);
  const { resolveTenantServiceCatalogue } = exported(growthEngineTenantServiceCatalogue);
  const { renderGrowthPlanPage, renderGrowthIntelligencePage } = exported(growthEnginePageRenderers);
  const { renderCampaignBuilderPage } = exported(growthEngineCampaignBuilderPage);
  const { buildGrowthEngineFramework, buildGrowthPlanRecommendation } = exported(growthEngineFrameworkService);
  const { listLockedCommercialSupportedServices } = exported(masterAdminLockedCommercialServiceCatalog);
  const { buildPlatformOperationsDashboard } = exported(masterAdminPlatformOperationsDashboardService);
  const { buildNationalGrowthIntelligence } = exported(nationalGrowthIntelligenceService);

  console.log("\n=== GP-01C Growth Plan platform routing ===\n");

  const unknown = resolveGrowthPlatform("__gp01c_unknown_tenant__");
  record("DEFAULT_UNKNOWN_TENANT_MODE=LOCAL", unknown.platform === "local", unknown.platform);

  const pcPlatform = resolveGrowthPlatform("pharmaconnect");
  record("pharmaconnect-platform-national", pcPlatform.platform === "national", pcPlatform.platform);
  record("no-slug-hardcode-in-resolver", !fs.readFileSync(path.join(ROOT, "src/pharmacy/growthPlatformResolverService.ts"), "utf8").includes('slug === "pharmaconnect"'), "resolver uses growthPlatform config");

  const localPlatform = resolveGrowthPlatform("leeds-pharmacy");
  record("leeds-pharmacy-platform-local", localPlatform.platform === "local", localPlatform.platform);

  const nationalPlan = resolveGrowthPlan("pharmaconnect");
  record("national-resolver-mode", nationalPlan.platform === "national", nationalPlan.platform);
  if (nationalPlan.platform !== "national") {
    console.log("\nSTOP — national resolver did not return national mode\n");
    process.exit(1);
  }

  const snapshot = readGrowthPlanIntelligenceV1("pharmaconnect");
  record("national-snapshot-loaded", Boolean(snapshot), snapshot ? `${snapshot.actions.length} actions` : "missing");
  record("local-never-reads-national-snapshot", readGrowthPlanIntelligenceV1("leeds-pharmacy") === null, "local slug gated");
  record("unknown-never-reads-national-snapshot", readGrowthPlanIntelligenceV1("__gp01c_unknown_tenant__") === null, "unknown slug gated");

  const primary = nationalPlan.plan.primary;
  const intelligence = buildNationalGrowthIntelligence("pharmaconnect");
  const gp01StatusesRetained = intelligence.gaps
    .filter((item) => item.id.startsWith("gp01-"))
    .every((item) => /NEW_MARKET_EVIDENCE\/LOW retained/i.test(item.currentState) || item.evidence.some((row) => /NEW_MARKET_EVIDENCE remains LOW|not upgraded/i.test(row)));
  const competitorGaps = intelligence.gaps.filter((item) => item.competitorGap || item.type === "COMPETITOR_GAP");

  record("national-primary-present", Boolean(primary), primary?.title || primary?.primaryKeyword || "none");
  record(
    "national-primary-from-gaps",
    Boolean(nationalPlan.plan.gapsConsumed && primary?.gapId && nationalPlan.plan.priorities.some((p) => p.gapId === primary.gapId)),
    primary ? `${primary.gapId} · ${primary.evidenceClass}` : "none",
  );
  record(
    "gap-evidence-truthful",
    Boolean(primary && primary.evidenceReasons.length > 0 && primary.provenance && intelligence.gaps.some((g) => g.id === primary.gapId)),
    primary ? `${primary.gapEvidenceStatus}/${primary.gapConfidence} from ${primary.gapId}` : "none",
  );
  record(
    "gap-not-upgraded",
    competitorGaps.length === 0
      && intelligence.competitorGapsFabricated === false
      && intelligence.gaps.every((item) => item.competitorGap !== true && item.type !== "COMPETITOR_GAP")
      && (intelligence.gaps.filter((item) => item.id.startsWith("gp01-")).length === 0 || gp01StatusesRetained),
    `gp01 retained=${gp01StatusesRetained} competitorGaps=${competitorGaps.length} fabricated=${intelligence.competitorGapsFabricated}`,
  );
  record("national-market-identity", /United Kingdom|UK Community Pharmacy Digital Growth|national/i.test(`${nationalPlan.plan.primaryMarket} ${nationalPlan.plan.market}`), `${nationalPlan.plan.primaryMarket} / ${nationalPlan.plan.market}`);
  record("national-market-not-rotherham", !/rotherham/i.test(`${nationalPlan.plan.primaryMarket} ${nationalPlan.plan.market} ${nationalPlan.plan.executiveSummary.currentPosition}`), nationalPlan.plan.primaryMarket);

  const nationalServices = resolveTenantServiceCatalogue("pharmaconnect");
  const localServices = resolveTenantServiceCatalogue("leeds-pharmacy");
  const locked = listLockedCommercialSupportedServices();
  const patientNames = ["Pharmacy First", "Blood Pressure Checks", "Travel Vaccinations", "Flu Vaccinations", "Prescription Dispensing"];
  record("national-catalogue-source", nationalServices.source === "project-commercial", nationalServices.source);
  record("local-catalogue-source", localServices.source === "pharmacy-patient-catalogue", localServices.source);
  record(
    "national-has-digital-services",
    nationalServices.services.some((s) => /website design|seo|email|hosting|audit/i.test(s.serviceName)),
    nationalServices.services.map((s) => s.serviceName).join(", "),
  );
  record(
    "national-not-patient-catalogue",
    !nationalServices.services.some((s) => patientNames.includes(s.serviceName)),
    nationalServices.services.map((s) => s.serviceName).join(", "),
  );
  record(
    "patient-catalogue-preserved",
    patientNames.every((name) => locked.some((s) => s.serviceName === name) || localServices.services.some((s) => s.serviceName === name)),
    `${locked.length} locked services`,
  );

  const nationalHtml = renderGrowthPlanPage("pharmaconnect", buildGrowthPlanRecommendation("pharmaconnect"));
  const localHtml = renderGrowthPlanPage("leeds-pharmacy", buildGrowthPlanRecommendation("leeds-pharmacy"));

  record("national-html-digital-provider", /digital-growth provider serving UK community pharmacies/i.test(nationalHtml), "identity copy");
  record("national-html-not-a-pharmacy", !/is a pharmacy\b|your pharmacy programme|serves Rotherham/i.test(nationalHtml), "not described as a pharmacy");
  record("national-html-not-rotherham-market", !/commercial market: rotherham/i.test(nationalHtml) && !/serves Rotherham/i.test(nationalHtml), "Rotherham not commercial market");
  record(
    "national-html-primary-keyword",
    Boolean(primary?.title) && nationalHtml.includes(primary!.title),
    "primary recommendation visible",
  );
  record("national-html-no-priority-empty", !nationalHtml.includes("No priority campaign yet"), "empty campaign copy absent");
  record("national-html-no-patient-service-cards", containsAny(nationalHtml, patientNames).length === 0, containsAny(nationalHtml, patientNames).join(", ") || "none");
  record("national-html-digital-service-shown", /Pharmacy Website Design|Pharmacy Local SEO|Pharmacy Email Marketing/i.test(nationalHtml), "configured digital services");
  record("national-html-no-places-prereq", /Google Places \/ Your Local Market is not a prerequisite/i.test(nationalHtml), "national readiness");
  record("national-html-no-side-panel", !nationalHtml.includes("Market Opportunity Plan"), "GP-01 side panel removed");
  record("national-html-workflow", nationalHtml.includes("Your Business") && nationalHtml.includes("National Market") && !nationalHtml.includes('<div class="ge-step-title">Your Pharmacy</div>'), "national stepper");
  const generateSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEnginePageRenderers.ts"), "utf8");
  const approvedPlanContractSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/nationalApprovedPlanContract.ts"), "utf8");
  const approvedState = /data-pc-gp-approved="yes"/.test(nationalHtml);
  record(
    "national-html-bounded-cta",
    /data-pc-gp-section="approval"/.test(nationalHtml)
      && /Approve Growth Plan/i.test(nationalHtml)
      && /data-pc-gp-generation=/.test(nationalHtml)
      && (approvedState
        ? /plan approved/i.test(nationalHtml) && /unlocked for approved items/i.test(nationalHtml)
        : /approval required/i.test(nationalHtml) && /blocked before approval/i.test(nationalHtml))
      && /MAX_INITIAL_APPROVED_PLAN_ITEMS = 3/.test(approvedPlanContractSrc)
      && approvedPlanContractSrc.includes("Generation is blocked until the Growth Plan is approved.")
      && generateSrc.includes("Maximum initial items: 3")
      && generateSrc.includes('data-published="false"')
      && generateSrc.includes('data-indexed="false"')
      && generateSrc.includes("<strong>Published:</strong> false")
      && generateSrc.includes("<strong>Indexed:</strong> false"),
    approvedState ? "approved bounded generation contract" : "approval-gated bounded generation contract",
  );
  record("national-html-platform-attr", nationalHtml.includes('data-growth-platform="national"'), "platform attribute");

  record("local-html-renders", localHtml.includes("Where you stand") && localHtml.includes("Campaign Readiness"), "local plan renders");
  record("local-html-your-pharmacy", localHtml.includes("Your Pharmacy"), "Your Pharmacy retained");
  record("local-html-local-market", localHtml.includes("Your Local Market"), "Your Local Market retained");
  record(
    "local-html-no-national-keywords",
    Boolean(primary?.primaryKeyword) &&
      !localHtml.includes(primary!.primaryKeyword) &&
      !localHtml.includes("UK Community Pharmacy Digital Growth"),
    "no national primary keyword leak",
  );
  record("local-html-campaign-engine", localHtml.includes("Open Campaign Builder") || localHtml.includes("No evidence-backed campaign"), "local engine path");
  record("local-html-platform-attr", localHtml.includes('data-growth-platform="local"'), "platform attribute");

  const nationalGi = renderGrowthIntelligencePage("pharmaconnect", null);
  const localGi = renderGrowthIntelligencePage("leeds-pharmacy", null);
  record("national-gi-platform", /data-growth-platform="national"/.test(nationalGi), "national GI shell");
  record(
    "national-gi-no-places-warning",
    !/Live Google Places data is not available/i.test(nationalGi) && !/nearby pharmacies/i.test(nationalGi),
    "national GI does not use local Places copy",
  );
  record("national-gi-surfaces-search-intelligence", /Search Intelligence/i.test(nationalGi) && /Organic \/ SERP candidates/i.test(nationalGi), "SI evidence connected");
  record(
    "national-gi-consumes-gaps",
    /Growth opportunities \/ gaps/i.test(nationalGi) && /data-pc-gi-opportunity=/i.test(nationalGi),
    "opportunity list from connected evidence",
  );
  record(
    "national-gi-no-fabricated-competitor-gap",
    /data-pc-gi-competitor-gaps="0"/.test(nationalGi) && !/data-pc-gi-type="COMPETITOR_GAP"/.test(nationalGi),
    "no fabricated competitor gaps",
  );
  record("local-gi-places-section", /Local Visibility/i.test(localGi) && /Google Places/i.test(localGi), "local GI unchanged");

  const nationalBuilder = renderCampaignBuilderPage("pharmaconnect", "choose");
  const localBuilder = renderCampaignBuilderPage("leeds-pharmacy", "choose");
  record("national-builder-bounded", /National campaign strategy/i.test(nationalBuilder) && /must not open the NHS/i.test(nationalBuilder) && /generate\?slug=pharmaconnect/.test(nationalBuilder), "no NHS explorer");
  record("national-builder-explicit-non-routing", /must not open the NHS \/ Pharmacy First/i.test(nationalBuilder), "explicit non-routing copy");
  record("local-builder-explorer", /campaign-builder|Choose|Pharmacy First|Select a service/i.test(localBuilder) || localBuilder.includes("data-growth-platform") === false, "local builder retained");

  const nationalFw = buildGrowthEngineFramework("pharmaconnect");
  const localFw = buildGrowthEngineFramework("leeds-pharmacy");
  record("national-framework-business-title", nationalFw.steps.find((s) => s.id === "business-intelligence")?.title === "Your Business", nationalFw.steps.find((s) => s.id === "business-intelligence")?.title || "");
  record("national-framework-market-title", nationalFw.steps.find((s) => s.id === "local-market")?.title === "National Market", nationalFw.steps.find((s) => s.id === "local-market")?.title || "");
  record("local-framework-business-title", localFw.steps.find((s) => s.id === "business-intelligence")?.title === "Your Pharmacy", localFw.steps.find((s) => s.id === "business-intelligence")?.title || "");
  record("local-framework-market-title", localFw.steps.find((s) => s.id === "local-market")?.title === "Your Local Market", localFw.steps.find((s) => s.id === "local-market")?.title || "");

  const opsNational = buildPlatformOperationsDashboard("pharmaconnect");
  record("ops-national-viewing-platform", opsNational.viewingPlatform === "national", opsNational.viewingPlatform);
  record(
    "ops-national-tenant-digital-services",
    opsNational.tenantCommercialServices.some((s) => /website design|seo|email|hosting|audit/i.test(s.serviceName)),
    opsNational.tenantCommercialServices.map((s) => s.serviceName).join(", "),
  );
  record(
    "ops-generation-capability-preserved",
    Boolean(opsNational.pharmacyCustomerGenerationCapability?.label?.includes("PHARMACY CUSTOMER GENERATION CAPABILITY")) &&
      opsNational.services.some((s: { serviceName?: string }) => s.serviceName === "Pharmacy First"),
    opsNational.pharmacyCustomerGenerationCapability?.label || "missing",
  );

  const catalogueFile = fs.readFileSync(path.join(ROOT, "config/pharmacy/locked-commercial-service-catalogue.json"), "utf8");
  record("PATIENT_SERVICE_CATALOGUE_CHANGED=NO", catalogueFile.includes("pharmacy-first") && catalogueFile.includes("blood-pressure-checks"), "locked catalogue intact");

  const engineSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineCampaignRecommendationEngine.ts"), "utf8");
  record(
    "LOCAL_CAMPAIGN_ENGINE_UNCHANGED_CORE",
    engineSrc.includes("BENCHMARK_MASTER_SERVICE_IDS") && engineSrc.includes("eligibleCampaignServices"),
    "local eligibility still patient catalogue",
  );

  const jsonRouteFile = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/growthEngine.ts"), "utf8");
  const jsonRouteHandler = jsonRouteFile.match(/router\.get\("\/growth-engine\/:slug\/growth-plan",[\s\S]*?\n\}\);/)?.[0] || "";
  record(
    "json-route-uses-platform-resolver",
    jsonRouteHandler.includes("resolveGrowthPlan(") && jsonRouteFile.includes('from "../../../../../src/pharmacy/growthEngineGrowthPlanResolver.ts"'),
    "slug JSON route uses resolveGrowthPlan",
  );
  record(
    "json-route-does-not-bypass",
    Boolean(jsonRouteHandler) &&
      !jsonRouteHandler.includes("buildGrowthPlanIntelligence") &&
      !jsonRouteFile.includes("buildGrowthPlanIntelligence"),
    "JSON route does not call local engine directly",
  );

  const jsonNational = resolveGrowthPlan("pharmaconnect");
  const jsonLocal = resolveGrowthPlan("leeds-pharmacy");
  const jsonUnknown = resolveGrowthPlan("__gp01c_unknown_tenant__");
  record("json-route-national", jsonNational.platform === "national", jsonNational.platform);
  record("json-route-local", jsonLocal.platform === "local", jsonLocal.platform);
  record("json-route-unknown-local", jsonUnknown.platform === "local", jsonUnknown.platform);
  record(
    "html-json-platform-agreement",
    nationalHtml.includes(`data-growth-platform="${jsonNational.platform}"`) &&
      localHtml.includes(`data-growth-platform="${jsonLocal.platform}"`) &&
      jsonNational.platform === "national" &&
      jsonLocal.platform === "local",
    `html/json national=${jsonNational.platform} local=${jsonLocal.platform}`,
  );

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main();
