/**
 * Growth Engine Framework V1 — JSON API routes.
 */
import { Router } from "express";
import {
  buildGrowthEngineFramework,
  saveWorkflowAcknowledgement,
  type GrowthEngineStepId,
} from "../../../../../src/pharmacy/growthEngineFrameworkService.ts";
import { discoverLocalMarketCompetitors, loadCompetitorSnapshot } from "../../../../../src/pharmacy/growthEngineLocalMarketService.ts";
import {
  analyseWebsiteIntelligence,
  loadWebsiteIntelligenceSnapshot,
} from "../../../../../src/pharmacy/growthEngineWebsiteIntelligenceService.ts";
import {
  buildGrowthOpportunityReport,
  saveGrowthOpportunityReport,
} from "../../../../../src/pharmacy/growthEngineOpportunityEngine.ts";
import { buildGrowthPlanIntelligence } from "../../../../../src/pharmacy/growthEngineCampaignRecommendationEngine.ts";
import {
  buildGrowthJourneyView,
  syncGrowthCycles,
} from "../../../../../src/pharmacy/growthEngineCycleManagerService.ts";
import { loadGrowthMemory, recordRecommendationDecision } from "../../../../../src/pharmacy/growthEngineCycleMemoryService.ts";
import { checkLaunchPlanEligibility, buildAdaptiveLaunchRecommendation } from "../../../../../src/pharmacy/growthEngineLaunchManagerService.ts";
import { buildCycleAwareRecommendation } from "../../../../../src/pharmacy/growthEngineCycleLearningEngine.ts";
import { resolveTenantProfileSlug } from "../../../../../src/pharmacy/pharmacyTenantSlug.ts";
import {
  loadLiveIntegrationProof,
  runLiveIntegrationProof,
  type LiveProofOptions,
} from "../../../../../src/pharmacy/growthEngineLiveIntegrationProofService.ts";
import type { LiveIntegrationId } from "../../../../../src/pharmacy/growthEngineLiveIntegrationModel.ts";
import { runCustomerSetupStart } from "../../../../../src/pharmacy/growthEngineCustomerSetupStartService.ts";
import { runCustomerSetupConfirm } from "../../../../../src/pharmacy/growthEngineCustomerSetupConfirmService.ts";
import {
  runSetupGoogleImport,
  runSetupWebsiteImport,
  resetSetupImports,
  selectGoogleImportCandidate,
} from "../../../../../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { buildSetupDebugReport } from "../../../../../src/pharmacy/growthEngineCustomerSetupDebugService.ts";
import {
  confirmCustomerSetupGoogleListing,
  rejectCustomerSetupGoogleListing,
  searchAgainCustomerSetupGoogleListings,
} from "../../../../../src/pharmacy/growthEngineCustomerSetupGoogleMatchService.ts";

const router = Router();

function safeSlug(v: string): string {
  return String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function resolveSlug(raw: string): string | null {
  return resolveTenantProfileSlug(raw) || safeSlug(raw) || null;
}

router.get("/growth-engine/:slug/status", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  res.json({ ok: true, framework: buildGrowthEngineFramework(slug) });
});

router.get("/growth-engine/:slug/competitors", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  const snapshot = loadCompetitorSnapshot(slug);
  res.json({ ok: true, snapshot });
});

router.get("/growth-engine/:slug/opportunities", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const report = buildGrowthOpportunityReport(slug);
  if (req.query.persist === "1") saveGrowthOpportunityReport(report);
  res.json({ ok: true, report });
});

router.get("/growth-engine/:slug/growth-plan", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  res.json({ ok: true, plan: buildGrowthPlanIntelligence(slug) });
});

router.get("/growth-engine/:slug/cycles", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const store = syncGrowthCycles(slug);
  res.json({ ok: true, store, journey: buildGrowthJourneyView(slug) });
});

router.get("/growth-engine/:slug/cycle-memory", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  res.json({ ok: true, memory: loadGrowthMemory(slug) });
});

router.get("/growth-engine/:slug/cycle-recommendation", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  res.json({ ok: true, recommendation: buildCycleAwareRecommendation(slug) });
});

router.post("/growth-engine/:slug/cycle-recommendation/decision", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const serviceId = String(req.body?.serviceId || "");
  const decision = String(req.body?.decision || "") as "accepted" | "rejected" | "postponed";
  if (!serviceId || !["accepted", "rejected", "postponed"].includes(decision)) {
    return res.status(400).json({ ok: false, error: "serviceId and decision (accepted|rejected|postponed) required" });
  }
  const event = recordRecommendationDecision(slug, serviceId, decision, String(req.body?.detail || `Recommendation ${decision}`));
  res.json({ ok: true, event });
});

router.get("/growth-engine/:slug/launch-plan/:serviceId", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  const serviceId = String(req.params.serviceId || "");
  if (!slug || !serviceId) return res.status(400).json({ ok: false, error: "Invalid slug or serviceId" });
  const eligibility = checkLaunchPlanEligibility(slug, serviceId);
  const adaptive = buildAdaptiveLaunchRecommendation(slug, serviceId);
  res.json({ ok: true, eligibility, adaptive });
});

router.post("/growth-engine/:slug/local-market/discover", async (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  try {
    const snapshot = await discoverLocalMarketCompetitors(slug);
    const live = snapshot.source === "google-places-live" && snapshot.competitors.length >= 5;
    res.json({
      ok: live,
      live,
      snapshot,
      competitorCount: snapshot.competitors.length,
      healthcareCount: snapshot.healthcare?.providers?.length ?? 0,
      placesError: snapshot.placesError ?? null,
    });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/growth-engine/:slug/website-intelligence", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  res.json({ ok: true, snapshot: loadWebsiteIntelligenceSnapshot(slug) });
});

router.post("/growth-engine/:slug/website-intelligence/analyse", async (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  try {
    const snapshot = await analyseWebsiteIntelligence(slug);
    res.json({ ok: true, snapshot, pageCount: snapshot.analysis?.inventory.totalPages || 0 });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/growth-engine/:slug/live-integration-proof", async (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const cached = loadLiveIntegrationProof(slug);
  if (cached && req.query.refresh !== "1") {
    return res.json({ ok: true, report: cached });
  }
  try {
    const report = await runLiveIntegrationProof(slug);
    res.json({ ok: true, report });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/growth-engine/:slug/live-integration-proof/run", async (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const liveAll = String(req.query.live || "") === "all";
  const options: LiveProofOptions = {
    ftpSafeWrite: req.query.ftpSafeWrite === "1" || liveAll,
  };
  if (liveAll) {
    const ids: LiveIntegrationId[] = [
      "google-places",
      "website-import",
      "image-generation",
      "ftp-publishing",
    ];
    options.runLive = Object.fromEntries(ids.map((id) => [id, true])) as LiveProofOptions["runLive"];
  } else {
    options.runLive = {
      "google-places": req.query.places === "1",
      "website-import": req.query.website === "1",
      "ftp-publishing": req.query.ftp === "1",
    };
  }
  try {
    const report = await runLiveIntegrationProof(slug, options);
    res.json({ ok: true, report });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

const ACK_STEPS: GrowthEngineStepId[] = ["growth-intelligence", "growth-plan", "dashboard"];

for (const stepId of ACK_STEPS) {
  router.post(`/growth-engine/:slug/acknowledge/${stepId}`, (req, res) => {
    const slug = resolveSlug(req.params.slug);
    if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
    saveWorkflowAcknowledgement(slug, stepId);
    const next: Record<GrowthEngineStepId, string> = {
      "growth-intelligence": `/api/growth-engine/growth-plan?slug=${encodeURIComponent(slug)}`,
      "growth-plan": `/api/growth-engine/campaign-builder?slug=${encodeURIComponent(slug)}`,
      dashboard: `/api/growth-engine?slug=${encodeURIComponent(slug)}`,
      "business-intelligence": `/api/growth-engine/business-intelligence?slug=${encodeURIComponent(slug)}`,
      "local-market": `/api/growth-engine/local-market?slug=${encodeURIComponent(slug)}`,
      "website-intelligence": `/api/growth-engine/growth-intelligence?slug=${encodeURIComponent(slug)}`,
      generate: `/api/growth-engine/generate?slug=${encodeURIComponent(slug)}`,
    };
    res.redirect(next[stepId]);
  });
}

router.post("/growth-engine/:slug/setup-start", async (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  try {
    const result = await runCustomerSetupStart(slug, {
      pharmacyName: String(req.body?.pharmacyName || ""),
      website: String(req.body?.website || ""),
      town: String(req.body?.town || ""),
      postcode: String(req.body?.postcode || ""),
      googleBusinessUrl: String(req.body?.googleBusinessUrl || ""),
      phone: String(req.body?.phone || ""),
    });
    res.json(result);
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/growth-engine/:slug/setup-google-import", async (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  try {
    const result = await runSetupGoogleImport(slug, {
      googleBusinessUrl: String(req.body?.googleBusinessUrl || ""),
      pharmacyName: String(req.body?.pharmacyName || ""),
      town: String(req.body?.town || ""),
      postcode: String(req.body?.postcode || ""),
    });
    res.json(result);
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/growth-engine/:slug/setup-website-import", async (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  try {
    const result = await runSetupWebsiteImport(slug, {
      websiteUrl: String(req.body?.websiteUrl || req.body?.website || ""),
    });
    res.json(result);
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/growth-engine/:slug/setup-reset-imports", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  try {
    const result = resetSetupImports(slug);
    res.json(result);
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/growth-engine/:slug/setup-debug", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  try {
    const report = buildSetupDebugReport(slug);
    res.json({ ok: true, ...report });
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/growth-engine/:slug/setup-confirm", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  try {
    const result = runCustomerSetupConfirm(slug, {
      pharmacyName: String(req.body?.pharmacyName || ""),
      website: String(req.body?.website || ""),
      phone: String(req.body?.phone || ""),
      email: String(req.body?.email || ""),
      address: String(req.body?.address || ""),
      town: String(req.body?.town || ""),
      postcode: String(req.body?.postcode || ""),
      gphcNumber: String(req.body?.gphcNumber || ""),
      gphcConfirmation: String(req.body?.gphcConfirmation || "") as "" | "confirm" | "reject",
      displayAddress: String(req.body?.displayAddress || ""),
      displayAddressResolution: String(req.body?.displayAddressResolution || "") as
        | ""
        | "keep-canonical"
        | "use-imported"
        | "edit-manually",
      fieldResolutions: req.body?.fieldResolutions,
      fieldSources: req.body?.fieldSources,
    });
    res.json(result);
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/growth-engine/:slug/setup-google-select", async (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  try {
    const action = String(req.body?.action || "");
    if (action === "confirm") {
      const placeId = String(req.body?.placeId || "");
      if (!placeId) return res.status(400).json({ ok: false, error: "Place ID is required" });
      const result = selectGoogleImportCandidate(slug, placeId);
      return res.json({ ok: true, ...result });
    }
    if (action === "reject") {
      const result = rejectCustomerSetupGoogleListing(slug, String(req.body?.placeId || "") || undefined);
      return res.json(result);
    }
    return res.status(400).json({ ok: false, error: "Invalid action" });
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/growth-engine/:slug/setup-google-search", async (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  try {
    const result = await searchAgainCustomerSetupGoogleListings(slug, {
      googleBusinessUrl: String(req.body?.googleBusinessUrl || ""),
    });
    res.json({ ok: true, ...result });
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
