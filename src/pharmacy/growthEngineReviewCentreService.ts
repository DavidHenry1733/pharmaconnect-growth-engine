/**
 * Review Centre V2 — builds customer review view and handles approve / improve actions.
 */
import fs from "node:fs";
import path from "node:path";
import {
  REVIEW_CENTRE_ASSET_TYPE_TO_GROUP,
  REVIEW_CENTRE_CUSTOMER_TYPE_LABELS,
  REVIEW_CENTRE_GROUPS,
  REVIEW_CENTRE_IMPROVE_MESSAGE,
  REVIEW_CENTRE_VERSION,
  reviewCentreStatusLabel,
  type ReviewCentreAsset,
  type ReviewCentreAssetStatus,
  type ReviewCentreGroup,
  type ReviewCentreNextAction,
  type ReviewCentreSession,
  type ReviewCentreView,
} from "./growthEngineReviewCentreModel.ts";
import {
  approveCampaignBuilderAsset,
  buildCampaignBuilderList,
  campaignBuilderPublishUrl,
  loadCampaignBuilderSession,
  resolveCampaignBuilderServiceName,
  saveCampaignBuilderSession,
} from "./growthEngineCampaignBuilderService.ts";
import {
  contentPackageGenerated,
  getContentPackageReviewSections,
  loadContentPackage,
  verifyContentPackageReviewSources,
  type ContentPackageAsset,
} from "./pharmacyContentPackageService.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import { isNationalGrowthPlatform } from "./growthPlatformResolverService.ts";

const CUSTOMER_VISIBLE_TYPES = new Set(Object.keys(REVIEW_CENTRE_ASSET_TYPE_TO_GROUP));

function sessionPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-review-centre.json`);
}

function emptySession(slug: string): ReviewCentreSession {
  return {
    version: REVIEW_CENTRE_VERSION,
    slug,
    updatedAt: new Date().toISOString(),
    campaigns: {},
  };
}

export function loadReviewCentreSession(slug: string): ReviewCentreSession {
  const file = sessionPath(slug);
  if (!fs.existsSync(file)) return emptySession(slug);
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as ReviewCentreSession;
    return {
      ...emptySession(slug),
      ...raw,
      campaigns: raw.campaigns || {},
    };
  } catch {
    return emptySession(slug);
  }
}

function saveReviewCentreSession(session: ReviewCentreSession): ReviewCentreSession {
  const next = { ...session, updatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(sessionPath(session.slug)), { recursive: true });
  fs.writeFileSync(sessionPath(session.slug), JSON.stringify(next, null, 2));
  return next;
}

function campaignState(session: ReviewCentreSession, campaignId: string) {
  return session.campaigns[campaignId] || { improvements: {} };
}

export function reviewCentreUrl(slug: string, campaignId: string): string {
  return `/api/growth-engine/review-centre?slug=${encodeURIComponent(slug)}&campaign=${encodeURIComponent(campaignId)}`;
}

export function resolveReviewCentreCampaign(
  slug: string,
  campaignParam: string | null | undefined,
): { serviceId: string; campaignName: string } | null {
  if (isNationalGrowthPlatform(slug)) {
    const serviceId = String(campaignParam || "approved-growth-plan").trim() || "approved-growth-plan";
    if (serviceId === "approved-growth-plan") {
      return { serviceId, campaignName: "Approved Growth Plan" };
    }
    const fromList = buildCampaignBuilderList(slug).find((c) => c.serviceId === serviceId);
    return { serviceId, campaignName: fromList?.serviceName || resolveCampaignBuilderServiceName(serviceId) };
  }
  const session = loadCampaignBuilderSession(slug);
  const serviceId = String(campaignParam || session.selectedServiceId || "").trim();
  if (!serviceId) return null;

  const fromList = buildCampaignBuilderList(slug).find((c) => c.serviceId === serviceId);
  const campaignName = fromList?.serviceName || resolveCampaignBuilderServiceName(serviceId);
  return { serviceId, campaignName };
}

function isNeedsImprovement(session: ReviewCentreSession, campaignId: string, assetKey: string): boolean {
  return Boolean(campaignState(session, campaignId).improvements[assetKey]);
}

function assetStatus(
  builderApproved: boolean,
  needsImprovement: boolean,
): ReviewCentreAssetStatus {
  if (needsImprovement) return "needs-improvement";
  if (builderApproved) return "approved";
  return "ready";
}

function customerTitle(sec: ContentPackageAsset, campaignName: string): string {
  const titles: Record<string, string> = {
    "service-page": `${campaignName} service page`,
    "local-area-pages": `${campaignName} local page`,
    faq: `${campaignName} FAQs`,
    guides: `${campaignName} patient guide`,
    blog: `${campaignName} blog articles`,
    gbp: `${campaignName} Google posts`,
    social: `${campaignName} social posts`,
    email: `${campaignName} email sequence`,
    images: `${campaignName} images`,
  };
  return titles[sec.type] || sec.title || REVIEW_CENTRE_CUSTOMER_TYPE_LABELS[sec.type] || sec.type;
}

function customerTypeLabel(sec: ContentPackageAsset): string {
  return REVIEW_CENTRE_CUSTOMER_TYPE_LABELS[sec.type] || sec.title || sec.type;
}

function customerSummary(sec: ContentPackageAsset, campaignName: string): string {
  const count = sec.count > 1 ? `${sec.count} items` : "1 item";
  const summaries: Record<string, string> = {
    "service-page": `Main ${campaignName} landing page for customer review.`,
    "local-area-pages": `Local ${campaignName} page for the selected service area.`,
    faq: `Customer questions and answers for ${campaignName}.`,
    guides: `Patient guide explaining ${campaignName} before booking.`,
    blog: `${count} supporting article previews for ${campaignName}.`,
    gbp: `${count} concise Google Business Profile post drafts.`,
    social: `${count} short social post drafts ready for review.`,
    email: `${count} email drafts for the ${campaignName} campaign.`,
    images: `Image slots for the ${campaignName} campaign.`,
  };
  return summaries[sec.type] || sec.notes || `${count} ready for review.`;
}

function buildAssets(slug: string, campaignId: string, campaignName: string): ReviewCentreAsset[] {
  const sections = getContentPackageReviewSections(slug, campaignId);
  const builderSession = loadCampaignBuilderSession(slug);
  const rcSession = loadReviewCentreSession(slug);

  const assets: ReviewCentreAsset[] = [];
  for (const sec of sections) {
    if (!CUSTOMER_VISIBLE_TYPES.has(sec.type)) continue;
    if (!sec.included && !sec.required) continue;
    if (sec.count <= 0 && sec.status !== "included") continue;

    const assetKey = sec.key || sec.type;
    const groupId = REVIEW_CENTRE_ASSET_TYPE_TO_GROUP[sec.type] || "blogs";
    const groupLabel = REVIEW_CENTRE_GROUPS.find((g) => g.id === groupId)?.label || groupId;
    const needsImprovement = isNeedsImprovement(rcSession, campaignId, assetKey);
    const status = assetStatus(Boolean(builderSession.approvedAssets[assetKey]), needsImprovement);

    const reviewPreviewTypes = new Set(["service-page", "local-area-pages", "faq", "guides", "blog", "gbp", "social", "email"]);
    const previewUrl = reviewPreviewTypes.has(sec.type) || Boolean(sec.key)
      ? `/api/growth-engine/${encodeURIComponent(slug)}/review-preview?campaign=${encodeURIComponent(campaignId)}&asset=${encodeURIComponent(assetKey)}`
      : sec.previewUrl;

    const national = isNationalGrowthPlatform(slug);
    const why = sec.whyRecommended ? ` Why: ${sec.whyRecommended}` : "";
    const evidence = sec.evidence?.length ? ` Evidence: ${sec.evidence.join(" ")}` : "";
    assets.push({
      key: assetKey,
      title: national ? sec.title || customerTitle(sec, campaignName) : customerTitle(sec, campaignName),
      summary: national
        ? `${sec.commercialService || campaignName} · ${sec.targetPageType || sec.type}.${why}${evidence}`
        : customerSummary(sec, campaignName),
      typeLabel: customerTypeLabel(sec),
      groupId,
      groupLabel,
      status,
      statusLabel: reviewCentreStatusLabel(status),
      previewUrl,
      count: sec.count,
      improveMessage: needsImprovement ? REVIEW_CENTRE_IMPROVE_MESSAGE : null,
      commercialService: sec.commercialService || null,
      whyRecommended: sec.whyRecommended || null,
      evidenceSource: sec.evidenceSource || sec.provenance || null,
      priority: sec.priority || null,
      generationStatus: sec.generationStatus || (sec.included ? "generated" : "missing"),
      reviewStatus: reviewCentreStatusLabel(status),
      published: false,
      indexed: false,
      gapId: sec.gapId || null,
      recommendationId: sec.recommendationId || null,
      provenance: sec.provenance || null,
    });
  }

  return assets;
}

function buildGroups(assets: ReviewCentreAsset[]): ReviewCentreGroup[] {
  const groups: ReviewCentreGroup[] = [];
  for (const def of REVIEW_CENTRE_GROUPS) {
    const groupAssets = assets.filter((a) => a.groupId === def.id);
    if (!groupAssets.length) continue;
    groups.push({ id: def.id, label: def.label, assets: groupAssets });
  }
  return groups;
}

function buildNextAction(
  generated: boolean,
  assets: ReviewCentreAsset[],
  allApproved: boolean,
): ReviewCentreNextAction {
  if (!generated) {
    return {
      title: "Build your campaign first",
      detail: "Your content will appear here once your campaign has been built.",
    };
  }
  const national = assets.some((a) => a.recommendationId);
  if (national) {
    return {
      title: "Ready for review",
      detail: "This is what the approved Growth Plan recommended and what was created. Nothing is published or indexed yet.",
    };
  }

  const needsImprovement = assets.some((a) => a.status === "needs-improvement");
  const pendingReview = assets.some((a) => a.status === "ready");

  if (allApproved) {
    return {
      title: "You're ready to publish",
      detail: "Every section is approved. You can publish when you're happy to go live.",
    };
  }

  if (needsImprovement && pendingReview) {
    return {
      title: "Review your content and approve each section",
      detail: "Some sections need improvement — we'll update those before publishing. Please review and approve the rest.",
    };
  }

  if (needsImprovement) {
    return {
      title: "We're preparing your improvements",
      detail: "We'll improve the sections you flagged before publishing.",
    };
  }

  return {
    title: "Review and approve each section below",
    detail: "Open a preview, then approve each section when you're happy with it.",
  };
}

export function buildReviewCentreView(slug: string, campaignParam: string | null | undefined): ReviewCentreView | null {
  const resolved = resolveReviewCentreCampaign(slug, campaignParam);
  if (!resolved) return null;

  const { serviceId: campaignId, campaignName } = resolved;
  const generated = contentPackageGenerated(slug, campaignId);
  if (generated) {
    const sourceCheck = verifyContentPackageReviewSources(slug, campaignId);
    if (!sourceCheck.ok) {
      throw new Error(`Review Centre source mismatch: ${sourceCheck.errors.join("; ")}`);
    }
  }
  const assets = buildAssets(slug, campaignId, campaignName);
  const groups = buildGroups(assets);
  const totalAssets = assets.reduce((n, a) => n + Math.max(a.count, 1), 0);
  const approvedCount = assets.filter((a) => a.status === "approved").length;
  const needsImprovementCount = assets.filter((a) => a.status === "needs-improvement").length;
  const readyCount = assets.filter((a) => a.status === "ready").length;
  const allApproved = assets.length > 0 && assets.every((a) => a.status === "approved");
  const national = isNationalGrowthPlatform(slug);
  const pkg = loadContentPackage(slug, campaignId);
  const canPublish = national ? false : generated && allApproved;

  return {
    slug,
    campaignId,
    campaignName,
    totalAssets,
    approvedCount,
    needsImprovementCount,
    readyCount,
    generated,
    allApproved,
    canPublish,
    nextAction: buildNextAction(generated, assets, allApproved),
    groups,
    publishUrl: campaignBuilderPublishUrl(slug, campaignId),
    published: pkg?.published === true ? true : false,
    indexed: pkg?.indexed === true ? true : false,
    readyForReview: generated && pkg?.status !== "error",
  };
}

export function approveReviewCentreAsset(slug: string, campaignId: string, assetKey: string): void {
  const rcSession = loadReviewCentreSession(slug);
  const state = campaignState(rcSession, campaignId);
  const improvements = { ...state.improvements };
  delete improvements[assetKey];
  saveReviewCentreSession({
    ...rcSession,
    campaigns: {
      ...rcSession.campaigns,
      [campaignId]: { improvements },
    },
  });
  approveCampaignBuilderAsset(slug, assetKey);
}

export function improveReviewCentreAsset(slug: string, campaignId: string, assetKey: string): {
  improved: boolean;
  message: string;
} {
  const rcSession = loadReviewCentreSession(slug);
  const state = campaignState(rcSession, campaignId);
  saveReviewCentreSession({
    ...rcSession,
    campaigns: {
      ...rcSession.campaigns,
      [campaignId]: {
        improvements: { ...state.improvements, [assetKey]: new Date().toISOString() },
      },
    },
  });

  const builderSession = loadCampaignBuilderSession(slug);
  if (builderSession.approvedAssets[assetKey]) {
    const approvedAssets = { ...builderSession.approvedAssets };
    delete approvedAssets[assetKey];
    saveCampaignBuilderSession({ ...builderSession, approvedAssets });
  }

  return { improved: true, message: REVIEW_CENTRE_IMPROVE_MESSAGE };
}

export function reviewCentreAllAssetsApproved(slug: string, campaignId: string): boolean {
  const view = buildReviewCentreView(slug, campaignId);
  return Boolean(view?.allApproved);
}

export function reviewCentreCanPublish(slug: string, campaignId: string): boolean {
  const view = buildReviewCentreView(slug, campaignId);
  return Boolean(view?.canPublish);
}
