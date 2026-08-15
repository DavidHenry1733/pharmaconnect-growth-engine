/**
 * Campaign Builder V1 — JSON + form API routes.
 */
import { Router } from "express";
import {
  advanceCampaignBuilderStep,
  approveCampaignBuilderAsset,
  buildCampaignBuilderApprovalSummary,
  buildCampaignBuilderList,
  buildCampaignBuilderOverview,
  buildCampaignBuilderReviewItems,
  campaignBuilderReadyToPublish,
  campaignBuilderStepUrl,
  loadCampaignBuilderSession,
  markCampaignBuilderGenerationCompleted,
  markCampaignBuilderGenerationStarted,
  markCampaignBuilderContextFrozen,
  parseCampaignBuilderAssetSelection,
  selectCampaignBuilderService,
  updateCampaignBuilderAreas,
  updateCampaignBuilderImageStrategy,
  updateCampaignBuilderSettings,
  runCampaignBuilderAreaDiscovery,
  confirmCampaignBuilderImagePlan,
} from "../../../../../src/pharmacy/growthEngineCampaignBuilderService.ts";
import { campaignAreaDiscoverySnapshotPath } from "../../../../../src/pharmacy/growthEngineCampaignBuilderAreaDiscoveryService.ts";
import type {
  CampaignBuilderImageStrategy,
  CampaignBuilderMode,
  CampaignBuilderTargetAreaMode,
  CampaignImageLocalMode,
} from "../../../../../src/pharmacy/growthEngineCampaignBuilderModel.ts";
import {
  generateContentPackage,
  verifyContentPackageHandoff,
} from "../../../../../src/pharmacy/pharmacyContentPackageService.ts";
import {
  buildCustomerCampaignGenerationContext,
  freezeCustomerCampaignGenerationContext,
} from "../../../../../src/pharmacy/contentEngine/customerCampaignGenerationContext.ts";
import { resolveTenantProfileSlug } from "../../../../../src/pharmacy/pharmacyTenantSlug.ts";
import {
  CAMPAIGN_BUILDER_ACTION_PATHS,
  campaignBuilderActionGetRedirect,
  campaignBuilderWizardUrl,
} from "../../../../../src/pharmacy/growthEngineCampaignBuilderRoutingService.ts";
import { reviewCentreUrl } from "../../../../../src/pharmacy/growthEngineReviewCentreService.ts";

import { buildPharmacyRegistry } from "../../../../../src/pharmacy/pharmacyPublishingFoundationService.ts";
import { generatePharmacyPublishOutput } from "../../../../../src/pharmacy/pharmacyPublishOutputService.ts";
import { preparePharmacyPublishOutput } from "../../../../../src/pharmacy/pharmacyLivePublishService.ts";
import { registerPharmacyPages } from "../../../../../src/pharmacy/pharmacyIndexingBridgeService.ts";

/**
 * Complete local post-generation preparation.
 *
 * This creates registry, static publish output and indexing registration.
 * It deliberately does not deploy anything to FTP/SFTP or a live website.
 */
async function completeGeneratedCampaignPipeline(
  slug: string,
  serviceId: string,
): Promise<void> {
  buildPharmacyRegistry(slug);
  generatePharmacyPublishOutput(slug);
  await preparePharmacyPublishOutput(slug, serviceId);

  // Rebuild after canonical output preparation so registry state is current.
  buildPharmacyRegistry(slug);
  registerPharmacyPages(slug);
}

const router = Router();

function resolveSlug(raw: string): string | null {
  return resolveTenantProfileSlug(raw) || String(raw || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || null;
}

for (const action of CAMPAIGN_BUILDER_ACTION_PATHS) {
  router.get(`/growth-engine/:slug/campaign-builder/${action}`, (req, res) => {
    const redirectUrl = campaignBuilderActionGetRedirect(req.path, req.query as Record<string, unknown>);
    if (!redirectUrl) return res.status(404).type("text/plain").send("Not found");
    res.redirect(302, redirectUrl);
  });
}

router.get("/growth-engine/:slug/campaign-builder", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const session = loadCampaignBuilderSession(slug);
  res.json({
    ok: true,
    session,
    campaigns: buildCampaignBuilderList(slug),
    overview: buildCampaignBuilderOverview(slug, session),
    approval: buildCampaignBuilderApprovalSummary(slug),
    review: buildCampaignBuilderReviewItems(slug),
    readyToPublish: campaignBuilderReadyToPublish(slug),
  });
});

router.post("/growth-engine/:slug/campaign-builder/select", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const serviceId = String(req.body?.serviceId || "");
  if (!serviceId) return res.status(400).json({ ok: false, error: "serviceId required" });
  selectCampaignBuilderService(slug, serviceId);
  const wantsJson = req.headers.accept?.includes("application/json");
  const overviewUrl = campaignBuilderWizardUrl(slug, "areas", serviceId);
  if (wantsJson) return res.json({ ok: true, overviewUrl });
  res.redirect(302, overviewUrl);
});

router.post("/growth-engine/:slug/campaign-builder/discover-areas", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const limit = Number(req.body?.limit || 10);
  const session = runCampaignBuilderAreaDiscovery(slug, limit);
  const wantsJson = req.headers.accept?.includes("application/json") || req.headers["content-type"]?.includes("json");
  const areasUrl = campaignBuilderWizardUrl(slug, "areas", session.selectedServiceId);
  if (session.areaDiscoveryStatus === "failed") {
    if (wantsJson) {
      return res.status(400).json({
        ok: false,
        error: session.areaDiscoveryError || "Unable to discover areas",
        session,
      });
    }
    return res.redirect(302, areasUrl);
  }
  if (wantsJson) {
    return res.json({
      ok: true,
      session,
      candidateCount: session.discoveredAreaCandidates.length,
      snapshotPath: campaignAreaDiscoverySnapshotPath(slug),
      areasUrl,
    });
  }
  res.redirect(302, areasUrl);
});

router.post("/growth-engine/:slug/campaign-builder/areas", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const modeRaw = String(req.body?.targetAreaMode || "wholeTown");
  const mode = (
    modeRaw === "selected" ? "selected" : modeRaw === "recommended" ? "recommended" : "wholeTown"
  ) as CampaignBuilderTargetAreaMode;
  const areaNames = Array.isArray(req.body?.targetAreas)
    ? req.body.targetAreas.map(String)
    : req.body?.targetAreas
      ? [String(req.body.targetAreas)]
      : [];
  const candidateSelection = Array.isArray(req.body?.candidateSelection)
    ? req.body.candidateSelection.map((row: { areaName?: string; selected?: boolean }) => ({
        areaName: String(row.areaName || ""),
        selected: row.selected === true || row.selected === "true" || row.selected === "on",
      }))
    : undefined;
  try {
    const session = updateCampaignBuilderAreas(slug, mode, areaNames, candidateSelection);
    const wantsJson = req.headers.accept?.includes("application/json");
    const settingsUrl = campaignBuilderWizardUrl(slug, "settings", session.selectedServiceId);
    if (wantsJson) return res.json({ ok: true, settingsUrl });
    res.redirect(302, settingsUrl);
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/growth-engine/:slug/campaign-builder/images", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const raw = String(req.body?.imageStrategy || "mixed");
  const strategy = (["existing", "ai", "upload", "mixed"].includes(raw) ? raw : "mixed") as CampaignBuilderImageStrategy;
  const localImageMode = (
    String(req.body?.localImageMode || "shared") === "area-specific" ? "area-specific" : "shared"
  ) as CampaignImageLocalMode;
  const deferredSlots: Record<string, boolean> = {};
  if (Array.isArray(req.body?.deferSlots)) {
    for (const slot of req.body.deferSlots) deferredSlots[String(slot)] = true;
  } else if (req.body?.deferSlots && typeof req.body.deferSlots === "object") {
    for (const [slot, value] of Object.entries(req.body.deferSlots)) {
      deferredSlots[slot] = value === true || value === "true" || value === "on";
    }
  }
  const session = updateCampaignBuilderImageStrategy(slug, strategy, localImageMode, deferredSlots);
  const wantsJson = req.headers.accept?.includes("application/json");
  const imagesUrl = campaignBuilderWizardUrl(slug, "images", session.selectedServiceId);
  if (wantsJson) return res.json({ ok: true, imagesUrl, session });
  res.redirect(302, imagesUrl);
});

router.post("/growth-engine/:slug/campaign-builder/images/confirm", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  try {
    const session = confirmCampaignBuilderImagePlan(slug);
    const wantsJson = req.headers.accept?.includes("application/json");
    const overviewUrl = campaignBuilderWizardUrl(slug, "overview", session.selectedServiceId);
    if (wantsJson) return res.json({ ok: true, overviewUrl, session });
    res.redirect(302, overviewUrl);
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/growth-engine/:slug/campaign-builder/settings", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const mode = (String(req.body?.mode || "all") === "manual" ? "manual" : "all") as CampaignBuilderMode;
  const selection = parseCampaignBuilderAssetSelection(req.body || {});
  const session = updateCampaignBuilderSettings(slug, mode, selection);
  const wantsJson = req.headers.accept?.includes("application/json");
  const imagesUrl = campaignBuilderWizardUrl(slug, "images", session.selectedServiceId);
  if (wantsJson) return res.json({ ok: true, imagesUrl });
  res.redirect(302, imagesUrl);
});

router.post("/growth-engine/:slug/campaign-builder/advance", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const step = String(req.body?.step || "choose");
  const session = advanceCampaignBuilderStep(slug, step as never);
  res.json({ ok: true, session });
});

router.post("/growth-engine/:slug/campaign-builder/generate", async (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  let session = loadCampaignBuilderSession(slug);
  const campaignId = String(req.body?.campaign || req.body?.campaignId || session.selectedServiceId || "");
  if (!campaignId) return res.status(400).json({ ok: false, error: "Select a campaign first" });
  if (session.selectedServiceId !== campaignId) {
    session = selectCampaignBuilderService(slug, campaignId);
  }
  markCampaignBuilderGenerationStarted(slug);
  try {
    const customerContext = buildCustomerCampaignGenerationContext(slug, campaignId, session);
    freezeCustomerCampaignGenerationContext(customerContext);
    markCampaignBuilderContextFrozen(slug, customerContext.frozenAt);
    const result = await generateContentPackage(slug, session.selectedServiceId, { customerContext });
    if (!result.ok) {
      return res.status(result.manifest ? 200 : 500).json({
        ok: false,
        error: result.error || "We could not create your campaign. Please try again.",
        manifest: result.manifest,
      });
    }
    markCampaignBuilderGenerationCompleted(slug);
    const serviceId = session.selectedServiceId;
    const handoff = verifyContentPackageHandoff(slug, serviceId);
    if (!handoff.ok) {
      return res.status(500).json({
        ok: false,
        error: `Campaign output handoff failed: ${handoff.reason}`,
        handoff,
      });
    }
    await completeGeneratedCampaignPipeline(slug, serviceId);
    const reviewUrl = serviceId ? reviewCentreUrl(slug, serviceId) : campaignBuilderStepUrl(slug, "review");
    return res.json({ ok: true, reviewUrl, manifest: result.manifest });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/growth-engine/:slug/campaign-builder/approve-asset", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const assetKey = String(req.body?.assetKey || "");
  if (!assetKey) return res.status(400).json({ ok: false, error: "assetKey required" });
  approveCampaignBuilderAsset(slug, assetKey);
  const wantsJson = req.headers.accept?.includes("application/json");
  if (wantsJson) return res.json({ ok: true, review: buildCampaignBuilderReviewItems(slug) });
  res.redirect(campaignBuilderStepUrl(slug, "review"));
});

router.post("/growth-engine/:slug/campaign-builder/regenerate", async (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const session = loadCampaignBuilderSession(slug);
  if (!session.selectedServiceId) return res.status(400).json({ ok: false, error: "No campaign selected" });
  try {
    const customerContext = buildCustomerCampaignGenerationContext(slug, session.selectedServiceId, session);
    freezeCustomerCampaignGenerationContext(customerContext);
    markCampaignBuilderContextFrozen(slug, customerContext.frozenAt);
    const result = await generateContentPackage(slug, session.selectedServiceId, { customerContext });
    if (!result.ok) {
      return res.status(500).json({ ok: false, error: result.error || "Regeneration failed" });
    }
    markCampaignBuilderGenerationCompleted(slug);
    const wantsJson = req.headers.accept?.includes("application/json");
    const serviceId = session.selectedServiceId;
    const handoff = verifyContentPackageHandoff(slug, serviceId);
    if (!handoff.ok) {
      return res.status(500).json({
        ok: false,
        error: `Campaign output handoff failed: ${handoff.reason}`,
        handoff,
      });
    }
    await completeGeneratedCampaignPipeline(slug, serviceId);
    const reviewUrl = serviceId ? reviewCentreUrl(slug, serviceId) : campaignBuilderStepUrl(slug, "review");
    if (wantsJson) return res.json({ ok: true, reviewUrl });
    res.redirect(reviewUrl);
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
