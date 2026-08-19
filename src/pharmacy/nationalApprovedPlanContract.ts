/**
 * Approved Growth Plan → generation input contract.
 * Does not select gaps or rank recommendations. Consumes the current national plan view.
 * Does not call DataForSEO, Google Places, or GSC.
 */
import fs from "node:fs";
import path from "node:path";

import { safePharmacySlug, WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export const APPROVED_GROWTH_PLAN_CAMPAIGN_ID = "approved-growth-plan";
export const MAX_INITIAL_APPROVED_PLAN_ITEMS = 3;
export const APPROVED_GROWTH_PLAN_VERSION = "approved-growth-plan-v1";

export interface ApprovedGrowthPlanItem {
  recommendationId: string;
  gapId: string;
  commercialService: string | null;
  recommendedAction: string;
  targetPageType: string;
  contentType: "service-page" | "blog" | "guides" | "faq";
  evidence: string[];
  priority: string;
  confidence: string;
  provenance: string;
  whyRecommended: string;
  evidenceClass: string;
  source: string;
  type: string;
}

export interface ApprovedGrowthPlanSnapshot {
  tenant: string;
  planVersion: string;
  approvedAt: string;
  campaignId: typeof APPROVED_GROWTH_PLAN_CAMPAIGN_ID;
  items: ApprovedGrowthPlanItem[];
}

export interface ApprovedPlanGenerationInput {
  slug: string;
  campaignId: typeof APPROVED_GROWTH_PLAN_CAMPAIGN_ID;
  approvedAt: string;
  planVersion: string;
  items: ApprovedGrowthPlanItem[];
}

interface PlanPrimaryLike {
  actionId: string;
  gapId: string;
  commercialService: string | null;
  recommendedNextStep: string;
  title: string;
  recommendedPageType: string;
  evidenceReasons: string[];
  priority: string;
  confidence: string;
  provenance: string;
  rationale: string;
  evidenceClass: string;
  source: string;
  type: string;
}

interface PlanPriorityLike {
  gapId: string;
  commercialService: string | null;
  action: string;
  recommendedPageType?: string;
  evidence: string[];
  priority: string;
  confidence: string;
  provenance: string;
  recommendation: string;
  evidenceClass: string;
  source: string;
  type: string;
}

interface PlanViewLike {
  primary: PlanPrimaryLike | null;
  priorities: PlanPriorityLike[];
}

function uniqueContentType(pageType: string, index: number, used: Set<string>): ApprovedGrowthPlanItem["contentType"] {
  const normalized = pageType.toUpperCase();
  let preferred: ApprovedGrowthPlanItem["contentType"] = "blog";
  if (normalized.includes("SERVICE PAGE") || normalized.includes("COMMERCIAL LANDING") || normalized.includes("SERVICE HUB")) {
    preferred = "service-page";
  } else if (normalized.includes("FAQ")) {
    preferred = "faq";
  } else if (normalized.includes("GUIDE")) {
    preferred = "guides";
  } else if (normalized.includes("EXISTING PAGE") || normalized.includes("BLOG")) {
    preferred = index === 0 ? "blog" : index === 1 ? "guides" : "service-page";
  }
  if (!used.has(preferred)) {
    used.add(preferred);
    return preferred;
  }
  const fallback: ApprovedGrowthPlanItem["contentType"][] = ["service-page", "blog", "guides", "faq"];
  const next = fallback.find((type) => !used.has(type)) || preferred;
  used.add(next);
  return next;
}

function fromPrimary(primary: PlanPrimaryLike, index: number, used: Set<string>): ApprovedGrowthPlanItem {
  return {
    recommendationId: primary.actionId,
    gapId: primary.gapId,
    commercialService: primary.commercialService,
    recommendedAction: primary.recommendedNextStep || primary.title,
    targetPageType: primary.recommendedPageType,
    contentType: uniqueContentType(primary.recommendedPageType, index, used),
    evidence: [...primary.evidenceReasons],
    priority: primary.priority,
    confidence: primary.confidence,
    provenance: primary.provenance,
    whyRecommended: primary.rationale,
    evidenceClass: primary.evidenceClass,
    source: primary.source,
    type: primary.type,
  };
}

function fromPriority(item: PlanPriorityLike, index: number, used: Set<string>): ApprovedGrowthPlanItem {
  return {
    recommendationId: item.gapId,
    gapId: item.gapId,
    commercialService: item.commercialService,
    recommendedAction: item.action,
    targetPageType: item.recommendedPageType || "EXISTING PAGE IMPROVEMENT",
    contentType: uniqueContentType(item.recommendedPageType || "EXISTING PAGE IMPROVEMENT", index, used),
    evidence: [...item.evidence],
    priority: item.priority,
    confidence: item.confidence,
    provenance: item.provenance,
    whyRecommended: item.recommendation,
    evidenceClass: item.evidenceClass,
    source: item.source,
    type: item.type,
  };
}

export function selectApprovedPlanItems(plan: PlanViewLike): ApprovedGrowthPlanItem[] {
  const used = new Set<string>();
  const selected: ApprovedGrowthPlanItem[] = [];
  const seen = new Set<string>();
  if (plan.primary) {
    const item = fromPrimary(plan.primary, selected.length, used);
    selected.push(item);
    seen.add(item.gapId);
  }
  for (const priority of plan.priorities) {
    if (selected.length >= MAX_INITIAL_APPROVED_PLAN_ITEMS) break;
    if (seen.has(priority.gapId)) continue;
    selected.push(fromPriority(priority, selected.length, used));
    seen.add(priority.gapId);
  }
  return selected.slice(0, MAX_INITIAL_APPROVED_PLAN_ITEMS);
}

export function buildApprovedGrowthPlanSnapshotFromPlan(
  slug: string,
  plan: PlanViewLike,
  approvedAt = new Date().toISOString(),
): ApprovedGrowthPlanSnapshot {
  return {
    tenant: safePharmacySlug(slug),
    planVersion: APPROVED_GROWTH_PLAN_VERSION,
    approvedAt,
    campaignId: APPROVED_GROWTH_PLAN_CAMPAIGN_ID,
    items: selectApprovedPlanItems(plan),
  };
}

export function readApprovedPlanGenerationInput(slug: string): ApprovedPlanGenerationInput | null {
  const file = path.join(WORKSPACE_ROOT, "data/growth-engine", `${safePharmacySlug(slug)}-workflow.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      acknowledgedSteps?: Record<string, string>;
      approvedPlan?: ApprovedGrowthPlanSnapshot;
    };
    const approvedAt = raw.acknowledgedSteps?.["growth-plan"];
    const snapshot = raw.approvedPlan;
    if (!approvedAt || !snapshot?.items?.length) return null;
    return {
      slug: safePharmacySlug(slug),
      campaignId: APPROVED_GROWTH_PLAN_CAMPAIGN_ID,
      approvedAt: snapshot.approvedAt || approvedAt,
      planVersion: snapshot.planVersion,
      items: snapshot.items.slice(0, MAX_INITIAL_APPROVED_PLAN_ITEMS),
    };
  } catch {
    return null;
  }
}

export function nationalGenerationBlockedReason(slug: string): string | null {
  const file = path.join(WORKSPACE_ROOT, "data/growth-engine", `${safePharmacySlug(slug)}-workflow.json`);
  if (!fs.existsSync(file)) return "Generation is blocked until the Growth Plan is approved.";
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      acknowledgedSteps?: Record<string, string>;
      approvedPlan?: ApprovedGrowthPlanSnapshot;
    };
    if (!raw.acknowledgedSteps?.["growth-plan"]) {
      return "Generation is blocked until the Growth Plan is approved.";
    }
    if (!raw.approvedPlan?.items?.length) {
      return "Generation is blocked until approved Growth Plan items are recorded.";
    }
    return null;
  } catch {
    return "Generation is blocked until the Growth Plan is approved.";
  }
}
