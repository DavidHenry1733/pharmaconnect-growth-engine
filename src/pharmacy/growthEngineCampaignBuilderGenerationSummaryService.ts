/**
 * Campaign Builder — Generation Summary (Sprint 2C commercial approval screen).
 */
import fs from "node:fs";
import path from "node:path";

import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import { resolveWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceService.ts";
import { loadCompetitorSnapshot } from "./growthEngineLocalMarketService.ts";
import { CAMPAIGN_EXPLORER_ALL_SUPPORTED } from "./growthEngineCampaignExplorerModel.ts";
import {
  buildCampaignBuilderApprovalSummary,
  buildCampaignBuilderOverview,
  loadCampaignBuilderSession,
  type CampaignBuilderSession,
} from "./growthEngineCampaignBuilderService.ts";
import type { CampaignBuilderAssetSelection } from "./growthEngineCampaignBuilderModel.ts";

export interface CampaignGenerationSummaryAssetRow {
  key: keyof CampaignBuilderAssetSelection;
  label: string;
  selected: boolean;
  count: number;
}

export interface CampaignGenerationSummaryEstimatedOutput {
  servicePages: number;
  localPages: number;
  guides: number;
  faqs: number;
  blogs: number;
  gbpPosts: number;
  socialPosts: number;
  emails: number;
  totalAssets: number;
  buildTime: string;
}

export interface CampaignGenerationSummary {
  pharmacyName: string;
  website: string;
  campaignName: string;
  campaignDescription: string;
  targetAreaCount: number;
  targetAreas: string[];
  targetAreaMode: string;
  assets: CampaignGenerationSummaryAssetRow[];
  imageStrategy: string;
  assignedImageSlots: string[];
  deferredImageSlots: string[];
  uploadedImageCount: number;
  aiImageCount: number;
  imagePlan: NonNullable<ReturnType<typeof buildCampaignBuilderApprovalSummary>>["imagePlan"];
  websitePagesFound: number | null;
  websiteServicesDetected: number | null;
  websiteMissingOpportunities: string[];
  competitorsAnalysed: number | null;
  healthcareNetworkSummary: string | null;
  localOpportunitySummary: string[];
  estimated: CampaignGenerationSummaryEstimatedOutput;
  sourceRefs: NonNullable<ReturnType<typeof buildCampaignBuilderApprovalSummary>>["sourceRefs"];
}

const ASSET_ROWS: Array<{ key: keyof CampaignBuilderAssetSelection; label: string }> = [
  { key: "servicePage", label: "Service Page" },
  { key: "landingPages", label: "Local Pages" },
  { key: "guides", label: "Patient Guide" },
  { key: "faqs", label: "FAQ" },
  { key: "blogs", label: "Blogs" },
  { key: "gbp", label: "GBP Posts" },
  { key: "social", label: "Social Posts" },
  { key: "emails", label: "Email Sequence" },
];

function loadProfile(slug: string) {
  const file = path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileData(doc.data || {});
}

function assetCount(overview: NonNullable<ReturnType<typeof buildCampaignBuilderOverview>>, key: string): number {
  return overview.assets.find((a) => a.key === key)?.count || 0;
}

function estimateBuildTime(total: number): string {
  if (total >= 35) return "3–4 minutes";
  if (total >= 20) return "2–3 minutes";
  return "About 2 minutes";
}

export function buildCampaignGenerationSummary(
  slug: string,
  session?: CampaignBuilderSession,
): CampaignGenerationSummary | null {
  const state = session || loadCampaignBuilderSession(slug);
  const approval = buildCampaignBuilderApprovalSummary(slug);
  const overview = buildCampaignBuilderOverview(slug, state);
  if (!approval || !overview) return null;

  const profile = loadProfile(slug);
  const explorer = CAMPAIGN_EXPLORER_ALL_SUPPORTED.find((s) => s.serviceId === overview.serviceId);
  const websiteSnap = resolveWebsiteIntelligenceSnapshot(slug);
  const localSnap = loadCompetitorSnapshot(slug);

  const analysis = websiteSnap?.analysis;
  const pagesFound =
    analysis?.inventory?.totalPages ??
    analysis?.pages?.length ??
    profile.websiteImportSnapshot?.intelligence?.structure?.pages?.length ??
    null;

  const servicesDetected =
    analysis?.services?.filter((s) => s.detected).length ??
    profile.websiteImportSnapshot?.servicesDetected?.length ??
    null;

  const missingOpportunities =
    analysis?.missingContent?.map((m) => m.gap || m.serviceName).filter(Boolean).slice(0, 5) ||
    analysis?.opportunities?.map((o) => o.headline).filter(Boolean).slice(0, 5) ||
    [];

  const competitorsAnalysed = localSnap?.analysis?.competitorCount ?? localSnap?.competitors?.length ?? null;
  const healthcareNetworkSummary =
    localSnap?.healthcare?.analysis?.summaryParagraphs?.[0] ||
    (localSnap?.healthcare?.analysis?.providerCount
      ? `${localSnap.healthcare.analysis.providerCount} healthcare providers mapped near your pharmacy`
      : null);

  const localOpportunitySummary = [
    ...(localSnap?.analysis?.opportunities || []).slice(0, 3),
    ...(localSnap?.healthcare?.analysis?.opportunities || []).slice(0, 2),
  ].filter(Boolean);

  const socialPosts =
    assetCount(overview, "social") +
    assetCount(overview, "socialInstagram") +
    assetCount(overview, "socialX");

  const totalAssets = overview.assets.filter((a) => a.included && a.count > 0).reduce((n, a) => n + a.count, 0);

  const imagePlan = approval.imagePlan;
  const assignedImageSlots =
    imagePlan?.slots.filter((s) => s.approvalState === "approved" || s.approvalState === "pending").map((s) => s.label) ||
    [];
  const deferredImageSlots = imagePlan?.slots.filter((s) => s.approvalState === "deferred").map((s) => s.label) || [];
  const uploadedImageCount = imagePlan?.slots.filter((s) => s.sourceType === "upload").length || 0;
  const aiImageCount = imagePlan?.slots.filter((s) => s.sourceType === "ai").length || 0;

  const assets: CampaignGenerationSummaryAssetRow[] = ASSET_ROWS.map((row) => ({
    key: row.key,
    label: row.label,
    selected: Boolean(approval.assetSelection[row.key]),
    count:
      row.key === "social"
        ? socialPosts
        : assetCount(overview, row.key),
  }));

  return {
    pharmacyName: profile.pharmacyName || profile.tradingName || slug,
    website: profile.website || websiteSnap?.websiteUrl || "Not set",
    campaignName: overview.campaignName,
    campaignDescription: explorer?.description || overview.campaignObjective,
    targetAreaCount: approval.targetAreas.length,
    targetAreas: approval.targetAreas,
    targetAreaMode: approval.targetAreaMode,
    assets,
    imageStrategy: approval.imageStrategy,
    assignedImageSlots,
    deferredImageSlots,
    uploadedImageCount,
    aiImageCount,
    imagePlan: approval.imagePlan,
    websitePagesFound: typeof pagesFound === "number" ? pagesFound : null,
    websiteServicesDetected: typeof servicesDetected === "number" ? servicesDetected : null,
    websiteMissingOpportunities: missingOpportunities,
    competitorsAnalysed,
    healthcareNetworkSummary,
    localOpportunitySummary,
    estimated: {
      servicePages: assetCount(overview, "servicePage"),
      localPages: assetCount(overview, "landingPages"),
      guides: assetCount(overview, "guides"),
      faqs: assetCount(overview, "faqs"),
      blogs: assetCount(overview, "blogs"),
      gbpPosts: assetCount(overview, "gbp"),
      socialPosts,
      emails: assetCount(overview, "emails"),
      totalAssets,
      buildTime: estimateBuildTime(totalAssets),
    },
    sourceRefs: approval.sourceRefs,
  };
}
