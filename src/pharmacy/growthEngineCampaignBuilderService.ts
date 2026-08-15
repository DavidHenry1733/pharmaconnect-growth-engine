/**
 * Campaign Builder V1 — session state, campaign spec, review centre.
 */
import fs from "node:fs";
import path from "node:path";
import {
  CAMPAIGN_BUILDER_VERSION,
  DEFAULT_CAMPAIGN_BUILDER_ASSET_SELECTION,
  type CampaignBuilderApprovalSummary,
  type CampaignBuilderAreaOption,
  type CampaignBuilderAssetSelection,
  type CampaignBuilderImageStrategy,
  type CampaignImageLocalMode,
  type CampaignBuilderListItem,
  type CampaignBuilderMode,
  type CampaignBuilderOverview,
  type CampaignBuilderOverviewAsset,
  type CampaignBuilderPriority,
  type CampaignBuilderReviewItem,
  type CampaignBuilderSession,
  type CampaignBuilderStep,
  type CampaignBuilderTargetAreaMode,
  type CampaignBuilderTotals,
} from "./growthEngineCampaignBuilderModel.ts";
import {
  buildFallbackCampaignBuilderList,
  findFallbackCampaignRecommendation,
} from "./growthEngineCampaignBuilderFallbackService.ts";
import { buildCampaignBuilderImagePlan, saveCampaignImagePlanSnapshot, ensureCampaignWizardDefaultImageAssignments } from "./growthEngineCampaignBuilderImagePlanService.ts";
import { CAMPAIGN_EXPLORER_ALL_SUPPORTED } from "./growthEngineCampaignExplorerModel.ts";
import {
  buildGrowthPlanIntelligence,
  estimateCampaignOutputs,
} from "./growthEngineCampaignRecommendationEngine.ts";
import {
  buildCampaignRecommendationIntelligence,
  campaignIntelligenceExpectedOutcomeText,
} from "./growthEngineCampaignRecommendationIntelligenceService.ts";
import type { CampaignAlternative, GrowthEngineCampaignRecommendation } from "./growthEngineCampaignModel.ts";
import {
  contentPackageApproved,
  contentPackageGenerated,
  getContentPackageReviewSections,
} from "./pharmacyContentPackageService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { getLocalIntelligence } from "./pharmacyAreaSelectionService.ts";
import {
  discoverCampaignBuilderAreaCandidates,
  resolveCampaignBuilderSelectedAreaNames,
  saveCampaignAreaDiscoverySnapshot,
} from "./growthEngineCampaignBuilderAreaDiscoveryService.ts";

function sessionPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-campaign-builder.json`);
}

function loadProfile(slug: string) {
  const file = path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileData(doc.data || {});
}

function emptySession(slug: string): CampaignBuilderSession {
  return {
    version: CAMPAIGN_BUILDER_VERSION,
    slug,
    updatedAt: new Date().toISOString(),
    step: "choose",
    selectedServiceId: null,
    mode: "all",
    assetSelection: { ...DEFAULT_CAMPAIGN_BUILDER_ASSET_SELECTION },
    targetAreaMode: "wholeTown",
    targetAreaNames: [],
    discoveredAreaCandidates: [],
    areaDiscoveryStatus: "idle",
    areaDiscoveredAt: null,
    areaDiscoverySource: null,
    areaDiscoveryError: null,
    imageStrategy: "mixed",
    localImageMode: "shared",
    imageDeferredSlots: {},
    imagePlanConfirmedAt: null,
    contextFrozenAt: null,
    generationStartedAt: null,
    generationCompletedAt: null,
    approvedAssets: {},
  };
}

export function loadCampaignBuilderSession(slug: string): CampaignBuilderSession {
  const file = sessionPath(slug);
  if (!fs.existsSync(file)) return emptySession(slug);
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as CampaignBuilderSession;
    return {
      ...emptySession(slug),
      ...raw,
      assetSelection: { ...DEFAULT_CAMPAIGN_BUILDER_ASSET_SELECTION, ...raw.assetSelection },
      targetAreaMode:
        raw.targetAreaMode === "selected"
          ? "selected"
          : raw.targetAreaMode === "recommended"
            ? "recommended"
            : "wholeTown",
      targetAreaNames: Array.isArray(raw.targetAreaNames) ? raw.targetAreaNames.map(String) : [],
      discoveredAreaCandidates: Array.isArray(raw.discoveredAreaCandidates) ? raw.discoveredAreaCandidates : [],
      areaDiscoveryStatus:
        raw.areaDiscoveryStatus === "ready" || raw.areaDiscoveryStatus === "failed"
          ? raw.areaDiscoveryStatus
          : "idle",
      areaDiscoveredAt: raw.areaDiscoveredAt || null,
      areaDiscoverySource: raw.areaDiscoverySource || null,
      areaDiscoveryError: raw.areaDiscoveryError || null,
      imageStrategy: raw.imageStrategy || "mixed",
      localImageMode: raw.localImageMode === "area-specific" ? "area-specific" : "shared",
      imageDeferredSlots:
        raw.imageDeferredSlots && typeof raw.imageDeferredSlots === "object" ? raw.imageDeferredSlots : {},
      imagePlanConfirmedAt: raw.imagePlanConfirmedAt || null,
      contextFrozenAt: raw.contextFrozenAt || null,
      approvedAssets: raw.approvedAssets || {},
    };
  } catch {
    return emptySession(slug);
  }
}

export function saveCampaignBuilderSession(session: CampaignBuilderSession): CampaignBuilderSession {
  const next = { ...session, updatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(sessionPath(session.slug)), { recursive: true });
  fs.writeFileSync(sessionPath(session.slug), JSON.stringify(next, null, 2));
  return next;
}

export function campaignBuilderStepUrl(slug: string, step: CampaignBuilderStep): string {
  return `/api/growth-engine/campaign-builder?slug=${encodeURIComponent(slug)}&step=${step}`;
}

export function campaignBuilderPublishUrl(slug: string, serviceId: string): string {
  return `/api/pharmacy-campaign-launch-queue?slug=${encodeURIComponent(slug)}&service=${encodeURIComponent(serviceId)}`;
}

function mapPriority(campaign: { priority: string; score: number }): CampaignBuilderPriority {
  if (campaign.score >= 250 || campaign.priority === "high" && campaign.score >= 220) return "Critical";
  if (campaign.priority === "high" || campaign.score >= 180) return "High";
  if (campaign.priority === "medium" || campaign.score >= 90) return "Medium";
  return "Low";
}

function priorityClass(priority: CampaignBuilderPriority): string {
  return priority.toLowerCase();
}

export { priorityClass as campaignBuilderPriorityClass };

function countAssets(outputs: ReturnType<typeof estimateCampaignOutputs>): number {
  return (
    outputs.servicePage +
    outputs.clusterPages +
    outputs.patientGuides +
    outputs.blogs +
    outputs.faqs +
    outputs.gbpPosts +
    outputs.socialPosts +
    outputs.emails +
    outputs.landingPages +
    5
  );
}

function estimateCompletionTime(assetCount: number): string {
  if (assetCount >= 45) return "45–90 minutes";
  if (assetCount >= 30) return "30–60 minutes";
  return "20–45 minutes";
}

function estimateOpportunity(campaign: GrowthEngineCampaignRecommendation | CampaignAlternative): string {
  if (campaign.priority === "high") return "Strong local demand — high patient interest";
  if (campaign.priority === "medium") return "Good growth potential in your area";
  return "Steady opportunity to strengthen visibility";
}

function listItemFromPrimary(campaign: GrowthEngineCampaignRecommendation): CampaignBuilderListItem {
  const assetCount = countAssets(campaign.estimatedOutputs);
  return {
    serviceId: campaign.serviceId,
    serviceName: campaign.campaignName,
    priority: mapPriority(campaign),
    reason: campaign.reason,
    estimatedOpportunity: estimateOpportunity(campaign),
    estimatedCompletionTime: estimateCompletionTime(assetCount),
    expectedAssetCount: assetCount,
    recommended: true,
    score: campaign.score,
  };
}

function listItemFromAlternative(slug: string, alt: CampaignAlternative): CampaignBuilderListItem {
  const outputs = estimateCampaignOutputs(loadProfile(slug));
  const assetCount = countAssets(outputs);
  return {
    serviceId: alt.serviceId,
    serviceName: alt.campaignName,
    priority: mapPriority(alt),
    reason: alt.reason,
    estimatedOpportunity: estimateOpportunity(alt),
    estimatedCompletionTime: estimateCompletionTime(assetCount),
    expectedAssetCount: assetCount,
    recommended: false,
    score: alt.evidenceCount * 40,
  };
}

export function buildCampaignBuilderList(slug: string): CampaignBuilderListItem[] {
  const plan = buildGrowthPlanIntelligence(slug);
  const items: CampaignBuilderListItem[] = [];
  if (plan.primaryCampaign) items.push(listItemFromPrimary(plan.primaryCampaign));
  for (const alt of plan.alternatives) items.push(listItemFromAlternative(slug, alt));
  if (items.length) return items;
  return buildFallbackCampaignBuilderList(slug);
}

function resolveSelection(session: CampaignBuilderSession): CampaignBuilderAssetSelection {
  if (session.mode === "all") return { ...DEFAULT_CAMPAIGN_BUILDER_ASSET_SELECTION };
  return session.assetSelection;
}

function buildOverviewAssets(
  outputs: ReturnType<typeof estimateCampaignOutputs>,
  selection: CampaignBuilderAssetSelection,
): CampaignBuilderOverviewAsset[] {
  const socialBreakdown = Math.ceil(outputs.socialPosts / 3);
  return [
    { key: "servicePage", label: "Main service page", included: selection.servicePage, count: selection.servicePage ? outputs.servicePage : 0 },
    { key: "landingPages", label: "Local landing pages", included: selection.landingPages, count: selection.landingPages ? outputs.clusterPages : 0 },
    { key: "guides", label: "Patient guide", included: selection.guides, count: selection.guides ? outputs.patientGuides : 0 },
    { key: "faqs", label: "FAQ page", included: selection.faqs, count: selection.faqs ? outputs.faqs : 0 },
    { key: "blogs", label: "Blog articles", included: selection.blogs, count: selection.blogs ? outputs.blogs : 0 },
    { key: "gbp", label: "Google Business Profile posts", included: selection.gbp, count: selection.gbp ? outputs.gbpPosts : 0 },
    { key: "social", label: "Facebook posts", included: selection.social, count: selection.social ? socialBreakdown : 0 },
    { key: "socialInstagram", label: "Instagram posts", included: selection.social, count: selection.social ? socialBreakdown : 0 },
    { key: "socialX", label: "X posts", included: selection.social, count: selection.social ? outputs.socialPosts - socialBreakdown * 2 : 0 },
    { key: "emails", label: "Email campaign", included: selection.emails, count: selection.emails ? outputs.emails : 0 },
    { key: "images", label: "AI images", included: selection.images, count: selection.images ? 8 : 0 },
    { key: "internalLinks", label: "Internal links", included: true, count: selection.servicePage ? 1 : 0 },
    { key: "structuredData", label: "Structured data", included: true, count: selection.servicePage ? 1 : 0 },
    { key: "publishingPackage", label: "Publishing package", included: true, count: 1 },
  ];
}

function buildTotals(assets: CampaignBuilderOverviewAsset[]): CampaignBuilderTotals {
  const pages =
    (assets.find((a) => a.key === "servicePage")?.count || 0) +
    (assets.find((a) => a.key === "landingPages")?.count || 0) +
    (assets.find((a) => a.key === "guides")?.count || 0) +
    (assets.find((a) => a.key === "faqs")?.count || 0) +
    (assets.find((a) => a.key === "blogs")?.count || 0);
  const posts =
    (assets.find((a) => a.key === "gbp")?.count || 0) +
    (assets.find((a) => a.key === "social")?.count || 0) +
    (assets.find((a) => a.key === "socialInstagram")?.count || 0) +
    (assets.find((a) => a.key === "socialX")?.count || 0);
  const images = assets.find((a) => a.key === "images")?.count || 0;
  const emails = assets.find((a) => a.key === "emails")?.count || 0;
  return { pages, posts, images, emails };
}

function findCampaign(slug: string, serviceId: string): GrowthEngineCampaignRecommendation | null {
  const plan = buildGrowthPlanIntelligence(slug);
  if (plan.primaryCampaign?.serviceId === serviceId) return plan.primaryCampaign;
  const alt = plan.alternatives.find((a) => a.serviceId === serviceId);
  if (alt) {
    return {
      serviceId: alt.serviceId,
      campaignName: alt.campaignName,
      priority: alt.priority,
      confidence: alt.confidence,
      reason: alt.reason,
      evidence: [],
      evidenceSources: [],
      estimatedOutputs: estimateCampaignOutputs(loadProfile(slug)),
      expectedBenefits: [],
      score: alt.evidenceCount * 40,
    };
  }
  return findFallbackCampaignRecommendation(slug, serviceId) || findExplorerCampaign(slug, serviceId);
}

function findExplorerCampaign(slug: string, serviceId: string): GrowthEngineCampaignRecommendation | null {
  const def = CAMPAIGN_EXPLORER_ALL_SUPPORTED.find((s) => s.serviceId === serviceId);
  if (!def) return null;
  const profile = loadProfile(slug);
  return {
    serviceId: def.serviceId,
    campaignName: def.serviceName,
    priority: "medium",
    confidence: "medium",
    reason: def.description,
    evidence: [],
    evidenceSources: [],
    estimatedOutputs: estimateCampaignOutputs(profile),
    expectedBenefits: [],
    score: 30,
  };
}

export function buildCampaignBuilderOverview(slug: string, session?: CampaignBuilderSession): CampaignBuilderOverview | null {
  const state = session || loadCampaignBuilderSession(slug);
  if (!state.selectedServiceId) return null;
  const campaign = findCampaign(slug, state.selectedServiceId);
  if (!campaign) return null;
  const selection = resolveSelection(state);
  const assets = buildOverviewAssets(campaign.estimatedOutputs, selection);
  const totals = buildTotals(assets);
  const assetCount = assets.filter((a) => a.included && a.count > 0).reduce((n, a) => n + a.count, 0);
  const intel = buildCampaignRecommendationIntelligence(slug, campaign.serviceId);
  return {
    serviceId: campaign.serviceId,
    campaignName: campaign.campaignName,
    assets,
    totals,
    estimatedCompletionTime: estimateCompletionTime(assetCount),
    estimatedSeoStrength: campaign.priority === "high" ? "Strong" : campaign.priority === "medium" ? "Good" : "Building",
    estimatedCustomerValue: campaign.priority === "high" ? "High patient reach" : "Growing awareness",
    campaignObjective: intel?.summary.tagline || `Promote ${campaign.campaignName} to patients in your local area`,
    expectedOutcome: intel ? campaignIntelligenceExpectedOutcomeText(intel) : campaign.reason,
  };
}

export function buildCampaignBuilderApprovalSummary(slug: string): CampaignBuilderApprovalSummary | null {
  const session = loadCampaignBuilderSession(slug);
  const overview = buildCampaignBuilderOverview(slug, session);
  if (!overview) return null;
  const assetCount = overview.assets.filter((a) => a.included && a.count > 0).reduce((n, a) => n + a.count, 0);
  const selection = resolveSelection(session);
  let targetAreas: string[] = [];
  try {
    targetAreas = resolveCampaignBuilderSelectedAreaNames(session);
    if (session.targetAreaMode === "wholeTown") {
      targetAreas = [buildCampaignBuilderAreaOptions(slug).primaryTown].filter(Boolean);
    }
  } catch {
    targetAreas = session.targetAreaNames;
  }
  const encodedSlug = encodeURIComponent(slug);
  return {
    campaignName: overview.campaignName,
    serviceId: overview.serviceId,
    estimatedAssets: assetCount,
    estimatedTime: overview.estimatedCompletionTime,
    campaignObjective: overview.campaignObjective,
    expectedOutcome: overview.expectedOutcome,
    targetAreaMode: session.targetAreaMode,
    targetAreas,
    imageStrategy: session.imageStrategy,
    assetSelection: selection,
    sourceRefs: {
      businessProfileUrl: `/api/pharmacy-profile-wizard?slug=${encodedSlug}`,
      websiteIntelligenceUrl: `/api/growth-engine/website-intelligence?slug=${encodedSlug}`,
      localMarketUrl: `/api/growth-engine/local-market?slug=${encodedSlug}`,
    },
    imagePlan: buildCampaignBuilderImagePlan(slug, session),
  };
}

export function buildCampaignBuilderAreaOptions(slug: string, session?: CampaignBuilderSession): {
  primaryTown: string;
  candidates: CampaignBuilderAreaOption[];
  discoveryStatus: CampaignBuilderSession["areaDiscoveryStatus"];
  discoveredAt: string | null;
} {
  const state = session || loadCampaignBuilderSession(slug);
  const profile = loadProfile(slug);
  const primaryTown = String(profile.primaryTown || profile.townCity || "").trim();

  if (state.discoveredAreaCandidates?.length) {
    return {
      primaryTown,
      discoveryStatus: state.areaDiscoveryStatus,
      discoveredAt: state.areaDiscoveredAt,
      candidates: state.discoveredAreaCandidates.map((row) => ({
        area: row.areaName,
        source: row.source,
        score: row.score,
        grade: row.priorityLabel,
        reason: row.reason,
        distanceLabel: row.distanceLabel,
        selected: row.selected,
        recommended: row.recommended,
        evidence: row.evidence,
      })),
    };
  }

  const seen = new Map<string, CampaignBuilderAreaOption>();

  const add = (area: string, source: string, extra?: Partial<CampaignBuilderAreaOption>) => {
    const trimmed = String(area || "").trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.set(key, { area: trimmed, source, ...extra });
  };

  for (const entry of profile.selectedAreas || []) {
    if (entry.areaName) add(entry.areaName, "Business Profile");
  }
  for (const name of [...(profile.rankingAreas || []), ...(profile.coverageAreas || []), ...(profile.nearbyAreas || [])]) {
    add(name, "Business Profile");
  }
  for (const name of profile.localAreas || []) {
    add(name, "Business Profile");
  }

  try {
    const intel = getLocalIntelligence(slug);
    for (const candidate of intel.areaCandidates || []) {
      add(candidate.area, "Local Market Intelligence", {
        score: candidate.score,
        grade: candidate.grade,
      });
    }
    for (const name of intel.localAreas || []) {
      add(name, "Local Market Intelligence");
    }
    for (const name of intel.localResidentialAreas || []) {
      add(name, "Local Market Intelligence");
    }
  } catch {
    // Local intelligence file may not exist yet — profile-only candidates remain valid.
  }

  const candidates = [...seen.values()].sort((a, b) => {
    const scoreDiff = (b.score || 0) - (a.score || 0);
    if (scoreDiff) return scoreDiff;
    return a.area.localeCompare(b.area);
  });

  return {
    primaryTown,
    discoveryStatus: state.areaDiscoveryStatus,
    discoveredAt: state.areaDiscoveredAt,
    candidates,
  };
}

export function runCampaignBuilderAreaDiscovery(
  slug: string,
  limit = 10,
): CampaignBuilderSession {
  const session = loadCampaignBuilderSession(slug);
  try {
    const { primaryTown, candidates, discovery } = discoverCampaignBuilderAreaCandidates(slug, session, limit);
    saveCampaignAreaDiscoverySnapshot(slug, {
      discoveredAt: discovery.generatedAt,
      primaryTown,
      source: discovery.source,
      candidates,
    });
    return saveCampaignBuilderSession({
      ...session,
      discoveredAreaCandidates: candidates,
      areaDiscoveryStatus: "ready",
      areaDiscoveredAt: discovery.generatedAt,
      areaDiscoverySource: discovery.source,
      areaDiscoveryError: null,
      step: "areas",
    });
  } catch (err) {
    return saveCampaignBuilderSession({
      ...session,
      areaDiscoveryStatus: "failed",
      areaDiscoveryError: err instanceof Error ? err.message : String(err),
      step: "areas",
    });
  }
}

export function updateCampaignBuilderAreas(
  slug: string,
  mode: CampaignBuilderTargetAreaMode,
  areaNames: string[],
  candidateSelection?: Array<{ areaName: string; selected: boolean }>,
): CampaignBuilderSession {
  const session = loadCampaignBuilderSession(slug);
  const cleaned = areaNames.map((a) => String(a).trim()).filter(Boolean);
  let discoveredAreaCandidates = session.discoveredAreaCandidates || [];

  if (candidateSelection?.length) {
    const selectedMap = new Map(candidateSelection.map((row) => [row.areaName.toLowerCase(), row.selected]));
    discoveredAreaCandidates = discoveredAreaCandidates.map((row) => ({
      ...row,
      selected: selectedMap.has(row.areaName.toLowerCase())
        ? Boolean(selectedMap.get(row.areaName.toLowerCase()))
        : row.selected,
    }));
  } else if (mode === "recommended") {
    discoveredAreaCandidates = discoveredAreaCandidates.map((row) => ({
      ...row,
      selected: row.recommended ? true : row.selected,
    }));
  }

  const profile = loadProfile(slug);
  const primaryTown = String(profile.primaryTown || profile.townCity || "").trim();
  let targetAreaNames: string[] = [];
  if (mode === "wholeTown") {
    targetAreaNames = [primaryTown].filter(Boolean);
  } else if (mode === "recommended") {
    targetAreaNames = discoveredAreaCandidates.filter((c) => c.recommended && c.selected).map((c) => c.areaName);
  } else {
    targetAreaNames = cleaned.length
      ? cleaned
      : discoveredAreaCandidates.filter((c) => c.selected).map((c) => c.areaName);
  }

  return saveCampaignBuilderSession({
    ...session,
    targetAreaMode: mode,
    targetAreaNames,
    discoveredAreaCandidates,
    step: "settings",
  });
}

export function updateCampaignBuilderImageStrategy(
  slug: string,
  strategy: CampaignBuilderImageStrategy,
  localImageMode?: CampaignImageLocalMode,
  deferredSlots?: Record<string, boolean>,
): CampaignBuilderSession {
  const session = loadCampaignBuilderSession(slug);
  return saveCampaignBuilderSession({
    ...session,
    imageStrategy: strategy,
    localImageMode: localImageMode || session.localImageMode || "shared",
    imageDeferredSlots: deferredSlots || session.imageDeferredSlots || {},
    imagePlanConfirmedAt: null,
    step: "images",
  });
}

export function confirmCampaignBuilderImagePlan(slug: string): CampaignBuilderSession {
  const session = loadCampaignBuilderSession(slug);
  const plan = buildCampaignBuilderImagePlan(slug, session);
  if (!plan) throw new Error("Select a campaign before confirming the image plan.");

  const unresolved = plan.slots.filter(
    (slot) => slot.approvalState === "missing" && !session.imageDeferredSlots?.[slot.slot],
  );
  if (unresolved.length) {
    throw new Error(
      `Assign or defer remaining image slots before continuing: ${unresolved.map((s) => s.label).join(", ")}`,
    );
  }

  saveCampaignImagePlanSnapshot(slug, { ...plan, confirmedAt: new Date().toISOString() });
  return saveCampaignBuilderSession({
    ...session,
    imagePlanConfirmedAt: new Date().toISOString(),
    step: "overview",
  });
}

export function ensureCampaignBuilderImageDefaults(
  slug: string,
  session?: CampaignBuilderSession,
): CampaignBuilderSession {
  const state = session || loadCampaignBuilderSession(slug);
  if (!state.selectedServiceId) return state;

  const result = ensureCampaignWizardDefaultImageAssignments(slug, state.selectedServiceId, state.selectedServiceId);
  if (!result.deferred.length) return state;

  const deferredSlots = { ...(state.imageDeferredSlots || {}) };
  for (const slot of result.deferred) deferredSlots[slot] = true;
  return saveCampaignBuilderSession({ ...state, imageDeferredSlots: deferredSlots });
}

export function selectCampaignBuilderService(slug: string, serviceId: string): CampaignBuilderSession {
  const session = loadCampaignBuilderSession(slug);
  const selected = saveCampaignBuilderSession({
    ...session,
    selectedServiceId: serviceId,
    step: "areas",
    approvedAssets: {},
    generationStartedAt: null,
    generationCompletedAt: null,
    contextFrozenAt: null,
    imageDeferredSlots: {},
  });
  return ensureCampaignBuilderImageDefaults(slug, selected);
}

export function updateCampaignBuilderSettings(
  slug: string,
  mode: CampaignBuilderMode,
  selection: Partial<CampaignBuilderAssetSelection>,
): CampaignBuilderSession {
  const session = loadCampaignBuilderSession(slug);
  return saveCampaignBuilderSession({
    ...session,
    mode,
    assetSelection: { ...session.assetSelection, ...selection },
    step: "images",
  });
}

export function advanceCampaignBuilderStep(slug: string, step: CampaignBuilderStep): CampaignBuilderSession {
  const session = loadCampaignBuilderSession(slug);
  return saveCampaignBuilderSession({ ...session, step });
}

export function markCampaignBuilderContextFrozen(slug: string, frozenAt: string): CampaignBuilderSession {
  const session = loadCampaignBuilderSession(slug);
  return saveCampaignBuilderSession({ ...session, contextFrozenAt: frozenAt });
}

export function markCampaignBuilderGenerationStarted(slug: string): CampaignBuilderSession {
  const session = loadCampaignBuilderSession(slug);
  return saveCampaignBuilderSession({
    ...session,
    generationStartedAt: new Date().toISOString(),
    step: "review",
  });
}

export function markCampaignBuilderGenerationCompleted(slug: string): CampaignBuilderSession {
  const session = loadCampaignBuilderSession(slug);
  return saveCampaignBuilderSession({
    ...session,
    generationCompletedAt: new Date().toISOString(),
    step: "review",
    approvedAssets: {},
  });
}

function qualityFromAsset(status: string, included: boolean): { score: number; label: string } {
  if (included && status === "included") return { score: 92, label: "Excellent" };
  if (included && status === "planned") return { score: 78, label: "Good" };
  if (status === "error") return { score: 45, label: "Needs attention" };
  if (status === "missing") return { score: 55, label: "Pending" };
  return { score: 70, label: "Review" };
}

function flattenReviewSections(
  slug: string,
  serviceId: string,
  session: CampaignBuilderSession,
): CampaignBuilderReviewItem[] {
  const sections = getContentPackageReviewSections(slug, serviceId);
  const items: CampaignBuilderReviewItem[] = [];

  for (const sec of sections.filter((s) => s.included || s.required)) {
    const quality = qualityFromAsset(sec.status, sec.included);
    const key = sec.type;
    items.push({
      key,
      title: sec.title,
      type: sec.type,
      qualityScore: quality.score,
      qualityLabel: quality.label,
      previewUrl: sec.previewUrl,
      approved: Boolean(session.approvedAssets[key]),
      approvedAt: session.approvedAssets[key] || null,
      count: sec.count,
    });
  }

  if (items.length === 0) {
    const overview = buildCampaignBuilderOverview(slug, session);
    if (overview) {
      for (const asset of overview.assets.filter((a) => a.included && a.count > 0 && !a.key.startsWith("social"))) {
        items.push({
          key: asset.key,
          title: asset.label,
          type: asset.key,
          qualityScore: 75,
          qualityLabel: "Ready to review",
          previewUrl: null,
          approved: Boolean(session.approvedAssets[asset.key]),
          approvedAt: session.approvedAssets[asset.key] || null,
          count: asset.count,
        });
      }
    }
  }

  return items;
}

export function buildCampaignBuilderReviewItems(slug: string): CampaignBuilderReviewItem[] {
  const session = loadCampaignBuilderSession(slug);
  if (!session.selectedServiceId) return [];
  return flattenReviewSections(slug, session.selectedServiceId, session);
}

export function approveCampaignBuilderAsset(slug: string, assetKey: string): CampaignBuilderSession {
  const session = loadCampaignBuilderSession(slug);
  return saveCampaignBuilderSession({
    ...session,
    approvedAssets: { ...session.approvedAssets, [assetKey]: new Date().toISOString() },
  });
}

export function allCampaignBuilderAssetsApproved(slug: string): boolean {
  const session = loadCampaignBuilderSession(slug);
  if (!session.selectedServiceId) return false;
  const items = buildCampaignBuilderReviewItems(slug);
  if (!items.length) return false;
  return items.every((item) => Boolean(session.approvedAssets[item.key]));
}

export function campaignBuilderReadyToPublish(slug: string): boolean {
  const session = loadCampaignBuilderSession(slug);
  if (!session.selectedServiceId) return false;
  if (!contentPackageGenerated(slug, session.selectedServiceId)) return false;
  return allCampaignBuilderAssetsApproved(slug) || contentPackageApproved(slug, session.selectedServiceId);
}

export function resolveCampaignBuilderServiceName(serviceId: string): string {
  return getServicePublishMeta(serviceId)?.serviceName || serviceId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseCampaignBuilderAssetSelection(body: Record<string, unknown>): Partial<CampaignBuilderAssetSelection> {
  const keys = Object.keys(DEFAULT_CAMPAIGN_BUILDER_ASSET_SELECTION) as (keyof CampaignBuilderAssetSelection)[];
  const out: Partial<CampaignBuilderAssetSelection> = {};
  for (const key of keys) {
    if (body[key] !== undefined) out[key] = body[key] === true || body[key] === "true" || body[key] === "on";
  }
  return out;
}
