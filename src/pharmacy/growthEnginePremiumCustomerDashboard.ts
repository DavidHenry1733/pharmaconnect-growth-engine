/**
 * Premium Customer Dashboard UX V1 — read-only view model (presentation only).
 */
import fs from "node:fs";
import path from "node:path";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { isRequiredProfileComplete } from "./pharmacyProfileFieldClassification.ts";
import {
  buildGrowthEngineFramework,
  type GrowthEngineFramework,
} from "./growthEngineFrameworkService.ts";
import { loadCompetitorSnapshot } from "./growthEngineLocalMarketService.ts";
import { buildLocalMarketReportView } from "./growthEngineLocalMarketReportView.ts";
import { loadWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceService.ts";
import { buildGrowthPlanIntelligence } from "./growthEngineCampaignRecommendationEngine.ts";
import {
  contentPackageApproved,
  contentPackageGenerated,
  contentPackageReviewed,
} from "./pharmacyContentPackageService.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import { getPharmacyLivePublishStatus } from "./pharmacyLivePublishService.ts";

export type PremiumJourneyStatus = "complete" | "ready" | "needs_review" | "locked";

export interface PremiumJourneyStep {
  id: string;
  number: number;
  title: string;
  benefit: string;
  status: PremiumJourneyStatus;
  statusLabel: string;
  buttonLabel: string;
  href: string;
  icon: string;
}

export interface PremiumReportPreview {
  id: string;
  title: string;
  stat1Label: string;
  stat1Value: string;
  stat2Label: string;
  stat2Value: string;
  insightLabel: string;
  insight: string;
  href: string;
}

export interface PremiumCustomerDashboardView {
  slug: string;
  pharmacyName: string;
  setupProgressPct: number;
  currentStepLabel: string;
  nextActionLabel: string;
  estimatedMinutes: number;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  todaysTask: string;
  todaysTaskDetail: string;
  journeySteps: PremiumJourneyStep[];
  reportPreviews: PremiumReportPreview[];
}

function profilePath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
}

function loadProfile(slug: string) {
  const file = profilePath(slug);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileData(doc.data || {});
}

function stepHref(slug: string, stepId: string, serviceId: string): string {
  const map: Record<string, string> = {
    pharmacy: `/api/growth-engine/business-intelligence?slug=${encodeURIComponent(slug)}`,
    "local-market": `/api/growth-engine/local-market?slug=${encodeURIComponent(slug)}`,
    website: `/api/growth-engine/website-intelligence?slug=${encodeURIComponent(slug)}`,
    "growth-plan": `/api/growth-engine/growth-plan?slug=${encodeURIComponent(slug)}`,
    create: `/api/growth-engine/generate?slug=${encodeURIComponent(slug)}`,
    review: `/api/pharmacy-asset-review?slug=${encodeURIComponent(slug)}&service=${encodeURIComponent(serviceId)}`,
    publish: `/api/pharmacy-publishing-settings?slug=${encodeURIComponent(slug)}&service=${encodeURIComponent(serviceId)}`,
  };
  return map[stepId] || `/api/growth-engine/dashboard?slug=${encodeURIComponent(slug)}`;
}

function statusLabel(status: PremiumJourneyStatus): string {
  if (status === "complete") return "Complete";
  if (status === "ready") return "Ready";
  if (status === "needs_review") return "Needs Review";
  return "Locked";
}

function journeyProgress(steps: PremiumJourneyStep[]): number {
  const done = steps.filter((s) => s.status === "complete").length;
  return Math.round((done / steps.length) * 100);
}

function resolvePrimaryCta(
  steps: PremiumJourneyStep[],
  slug: string,
): { label: string; href: string; task: string; detail: string; minutes: number } {
  const next =
    steps.find((s) => s.status === "ready") ||
    steps.find((s) => s.status === "needs_review") ||
    steps.find((s) => s.status !== "complete" && s.status !== "locked");

  if (!next) {
    return {
      label: "View Your Progress",
      href: stepHref(slug, "publish", ""),
      task: "Track your campaign results",
      detail: "Your growth journey is underway — monitor visibility and patient enquiries.",
      minutes: 2,
    };
  }

  const labelMap: Record<string, string> = {
    pharmacy: "Continue Setup",
    "local-market": "Continue Setup",
    website: "Continue Setup",
    "growth-plan": "Continue Growth Plan",
    create: "Create My Campaign",
    review: "Review Your Content",
    publish: "Publish Your Campaign",
  };

  const taskMap: Record<string, string> = {
    pharmacy: "Confirm your pharmacy details",
    "local-market": "Discover your local market",
    website: "Review your website report",
    "growth-plan": "View your growth plan",
    create: "Create your first campaign",
    review: "Review your new content",
    publish: "Publish your campaign",
  };

  const minutesMap: Record<string, number> = {
    pharmacy: 5,
    "local-market": 3,
    website: 3,
    "growth-plan": 4,
    create: 8,
    review: 10,
    publish: 5,
  };

  return {
    label: labelMap[next.id] || "Continue",
    href: next.href,
    task: taskMap[next.id] || next.title,
    detail: next.benefit,
    minutes: minutesMap[next.id] || 5,
  };
}

export function buildPremiumCustomerDashboardView(slug: string): PremiumCustomerDashboardView {
  const profile = loadProfile(slug);
  const framework = buildGrowthEngineFramework(slug);
  const pharmacyName = profile.pharmacyName || profile.tradingName || slug;
  const serviceId = framework.plan.primaryServiceId;
  const competitors = loadCompetitorSnapshot(slug);
  const localReport = buildLocalMarketReportView(competitors);
  const website = loadWebsiteIntelligenceSnapshot(slug);
  const plan = buildGrowthPlanIntelligence(slug, competitors);

  const pharmacyComplete = isRequiredProfileComplete(profile);
  const localComplete = framework.steps.find((s) => s.id === "local-market")?.status === "complete";
  const websiteComplete = framework.steps.find((s) => s.id === "website-intelligence")?.status === "complete";
  const planComplete = framework.steps.find((s) => s.id === "growth-plan")?.status === "complete";
  const generated = contentPackageGenerated(slug, serviceId);
  const reviewed = contentPackageReviewed(slug, serviceId);
  const approved = contentPackageApproved(slug, serviceId);
  const publishStatus = getPharmacyLivePublishStatus(slug);
  const published = Boolean(publishStatus.lastPublishedAt || publishStatus.pagesPublished > 0);

  const stepComplete = (id: string): boolean => {
    if (id === "pharmacy") return pharmacyComplete;
    if (id === "local-market") return localComplete;
    if (id === "website") return websiteComplete;
    if (id === "growth-plan") return planComplete;
    if (id === "create") return generated;
    if (id === "review") return reviewed || approved;
    if (id === "publish") return published;
    return false;
  };

  const priorComplete = (index: number, ids: string[]): boolean => {
    if (index === 0) return true;
    return ids.slice(0, index).every((id) => stepComplete(id));
  };

  const stepIds = ["pharmacy", "local-market", "website", "growth-plan", "create", "review", "publish"];
  const stepMeta: Array<{ id: string; title: string; benefit: string; icon: string; button: string }> = [
    {
      id: "pharmacy",
      title: "Confirm pharmacy details",
      benefit: "Make sure patients see the right name, contact details, and services.",
      icon: "🏥",
      button: "Confirm details",
    },
    {
      id: "local-market",
      title: "Compare local market",
      benefit: "See how you compare to nearby pharmacies on reviews and visibility.",
      icon: "📍",
      button: "Compare locally",
    },
    {
      id: "website",
      title: "Review website",
      benefit: "Understand what your website contains and where improvements help patients find you.",
      icon: "🌐",
      button: "Review website",
    },
    {
      id: "growth-plan",
      title: "View growth plan",
      benefit: "One clear campaign recommendation based on your pharmacy and local market.",
      icon: "📈",
      button: "View plan",
    },
    {
      id: "create",
      title: "Create content",
      benefit: "Build patient-facing pages that improve trust and local visibility.",
      icon: "✍️",
      button: "Create content",
    },
    {
      id: "review",
      title: "Review content",
      benefit: "Check your new pages before they go live on your website.",
      icon: "✓",
      button: "Review content",
    },
    {
      id: "publish",
      title: "Publish and track",
      benefit: "Go live and monitor visibility, enquiries, and growth over time.",
      icon: "🚀",
      button: "Publish & track",
    },
  ];

  const journeySteps: PremiumJourneyStep[] = stepMeta.map((meta, index) => {
    const done = stepComplete(meta.id);
    const unlocked = priorComplete(index, stepIds);
    let status: PremiumJourneyStatus;
    if (done) status = "complete";
    else if (!unlocked) status = "locked";
    else if (meta.id === "pharmacy" && !pharmacyComplete && profile.websiteAnalysisAt) status = "needs_review";
    else if (meta.id === "local-market" && competitors?.competitors.length && !localComplete) status = "needs_review";
    else status = "ready";

    return {
      id: meta.id,
      number: index + 1,
      title: meta.title,
      benefit: meta.benefit,
      status,
      statusLabel: statusLabel(status),
      buttonLabel: done ? "View" : meta.button,
      href: stepHref(slug, meta.id, serviceId),
      icon: meta.icon,
    };
  });

  const primary = resolvePrimaryCta(journeySteps, slug);
  const currentStep =
    journeySteps.find((s) => s.status === "ready" || s.status === "needs_review") ||
    journeySteps.find((s) => s.status === "complete") ||
    journeySteps[0];

  const competitorCount = localReport.live
    ? String(localReport.overview.pharmacies)
    : "Ready to run";
  const localInsight =
    localReport.insights[0] || localReport.opportunitySummary || "See how you compare to nearby pharmacies.";

  const pageCount = website?.analysis?.inventory.totalPages
    ? String(website.analysis.inventory.totalPages)
    : "Ready to run";
  const missingServices = website?.analysis?.missingContent?.length
    ? String(website.analysis.missingContent.length)
    : "Ready to run";
  const websiteInsight =
    website?.analysis?.opportunities?.[0]?.headline ||
    website?.analysis?.summaryParagraphs?.[0]?.slice(0, 120) ||
    "Discover website improvements that help patients find your services.";

  const campaignName = plan.primaryCampaign?.campaignName || "Ready to run";
  const campaignReason = plan.primaryCampaign?.reason || plan.executiveSummary.primaryOpportunity || "Ready to run";
  const campaignReady = plan.readyToGenerate ? "Ready to create" : "Ready to run";

  const reportPreviews: PremiumReportPreview[] = [
    {
      id: "local-market",
      title: "Your Local Market",
      stat1Label: "Review comparison",
      stat1Value: localReport.live ? "Live comparison" : "Ready to run",
      stat2Label: "Nearby pharmacies",
      stat2Value: competitorCount,
      insightLabel: "Strongest insight",
      insight: localInsight,
      href: stepHref(slug, "local-market", serviceId),
    },
    {
      id: "website",
      title: "Your Website Report",
      stat1Label: "Pages found",
      stat1Value: pageCount,
      stat2Label: "Website improvements",
      stat2Value: missingServices,
      insightLabel: "Strongest opportunity",
      insight: websiteInsight.length > 140 ? `${websiteInsight.slice(0, 137)}…` : websiteInsight,
      href: stepHref(slug, "website", serviceId),
    },
    {
      id: "growth-plan",
      title: "Your Growth Plan",
      stat1Label: "Recommended campaign",
      stat1Value: campaignName,
      stat2Label: "Readiness",
      stat2Value: campaignReady,
      insightLabel: "Why this campaign",
      insight: campaignReason.length > 140 ? `${campaignReason.slice(0, 137)}…` : campaignReason,
      href: stepHref(slug, "growth-plan", serviceId),
    },
  ];

  return {
    slug,
    pharmacyName,
    setupProgressPct: journeyProgress(journeySteps),
    currentStepLabel: currentStep.title,
    nextActionLabel: primary.task,
    estimatedMinutes: primary.minutes,
    primaryCtaLabel: primary.label,
    primaryCtaHref: primary.href,
    todaysTask: primary.task,
    todaysTaskDetail: primary.detail,
    journeySteps,
    reportPreviews,
  };
}

/** @internal Used by validation — framework must remain reachable. */
export function premiumDashboardUsesFramework(slug: string): GrowthEngineFramework {
  return buildGrowthEngineFramework(slug);
}
