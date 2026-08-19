/**
 * Approved Growth Plan item → Commercial Content Brief adapter.
 *
 * Evidence explains WHY we act. Configured commercial services and
 * customer intent decide WHAT we generate. This is not a second content engine.
 * Does not call DataForSEO, Google Places, or GSC.
 * Does not change gap detection or Growth Plan evidence logic.
 */
import fs from "node:fs";

import { resolveWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceService.ts";
import {
  resolveTenantServiceCatalogue,
  type TenantServiceCatalogueEntry,
} from "./growthEngineTenantServiceCatalogue.ts";
import {
  MAX_INITIAL_APPROVED_PLAN_ITEMS,
  type ApprovedGrowthPlanItem,
} from "./nationalApprovedPlanContract.ts";
import { getPharmacyProjectConfigPath, safePharmacySlug } from "./pharmacyWorkspacePaths.ts";

export const COMMERCIAL_CONTENT_BRIEF_VERSION = "commercial-content-brief-v1";

export type CommercialContentAction =
  | "EXISTING_PAGE_IMPROVEMENT"
  | "NEW_SERVICE_PAGE"
  | "NEW_CLUSTER_PAGE"
  | "NEW_GUIDE"
  | "NEW_BLOG"
  | "NOT_GENERATED";

export type CommercialSkipReason =
  | "insufficient_commercial_service_mapping"
  | "insufficient_customer_intent"
  | "diagnostic_signal_only"
  | "duplicate_existing_service_page";

export type CommercialContentType = "service-page" | "blog" | "guides" | "faq";

export interface CommercialContentBrief {
  recommendationId: string;
  gapOpportunityId: string;
  priority: string;
  confidence: string;
  evidence: string[];
  provenance: string;
  reasonForCreation: string;
  commercialService: string | null;
  commercialServiceId: string | null;
  customerIntent: string | null;
  contentObjective: string | null;
  contentType: CommercialContentType | null;
  contentAction: CommercialContentAction;
  primaryTopic: string | null;
  workingTitle: string | null;
  targetAudience: string | null;
  serviceProposition: string | null;
  businessFacts: string[];
  supportingEvidence: string[];
  claimsAllowed: string[];
  claimsProhibited: string[];
  internalNotes: string[];
  existingPageUrl: string | null;
  existingPageDedicated: boolean;
  skipReason: CommercialSkipReason | null;
  skipDetail: string | null;
  eligible: boolean;
}

export interface CommercialBriefBatch {
  slug: string;
  briefs: CommercialContentBrief[];
  eligible: CommercialContentBrief[];
  skipped: CommercialContentBrief[];
}

interface TenantCommercialContext {
  slug: string;
  businessName: string;
  market: string;
  description: string;
  strapline: string;
  ctaText: string;
  ctaUrl: string;
  phone: string;
  email: string;
  services: TenantServiceCatalogueEntry[];
  serviceUrls: Record<string, string>;
  websiteCoverage: Array<{ serviceName: string; mainPageUrl: string | null; coverageStatus?: string }>;
}

const INTERNAL_DIAGNOSTIC_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  { id: "growth-plan-candidate", pattern: /growth\s+plan\s+candidate/i },
  { id: "do-not-generate-until-approved", pattern: /do\s+not\s+generate(?:\s+\w+){0,8}\s+until\s+approved/i },
  { id: "proven-untapped", pattern: /\bPROVEN_UNTAPPED\b/ },
  { id: "insufficient-evidence", pattern: /\bINSUFFICIENT_(?:COMPETITOR_)?EVIDENCE\b/ },
  { id: "customer-ranking-keywords", pattern: /customer\s+ranking\s+keywords\s*=/i },
  { id: "competitor-signals", pattern: /competitor\s+signal\(s\)/i },
  { id: "dataforseo", pattern: /\bDataForSEO\b/i },
  { id: "commercial-gate", pattern: /commercial\s+gate/i },
  { id: "sparse-footprint-token", pattern: /sparseCustomerFootprint/i },
  { id: "machine-gap-type", pattern: /\b(?:KEYWORD_VISIBILITY_GAP|WEAK_SERVICE_COVERAGE|MISSING_SERVICE_PAGE|SUPPORTED_OPPORTUNITY|PROVEN_GAP)\b/ },
  { id: "workflow-instruction", pattern: /do\s+not\s+invent\s+competitor\s+gaps/i },
];

function tokens(value: string): string[] {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\//g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t && !["pharmacy", "pharmacies", "for", "the", "and", "www", "uk", "co", "a"].includes(t));
}

function overlaps(a: string, b: string): boolean {
  const left = tokens(a);
  const right = new Set(tokens(b));
  if (!left.length || !right.size) return false;
  const hits = left.filter((t) => right.has(t)).length;
  return hits >= Math.min(2, left.length);
}

function readProjectConfig(slug: string): Record<string, unknown> {
  const file = getPharmacyProjectConfigPath(safePharmacySlug(slug));
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isContactLike(url: string): boolean {
  return /contact/i.test(url);
}

function diagnosticBlob(item: ApprovedGrowthPlanItem): string {
  return [item.whyRecommended, item.recommendedAction, item.targetPageType, item.type, item.evidenceClass, ...item.evidence].join(
    "\n",
  );
}

export function findInternalDiagnosticLanguage(text: string): string[] {
  const raw = String(text || "");
  return INTERNAL_DIAGNOSTIC_PATTERNS.filter((row) => row.pattern.test(raw)).map((row) => row.id);
}

export function customerFacingHasInternalLanguage(text: string): boolean {
  return findInternalDiagnosticLanguage(text).length > 0;
}

export function mapApprovedItemToConfiguredService(
  item: ApprovedGrowthPlanItem,
  services: TenantServiceCatalogueEntry[],
): TenantServiceCatalogueEntry | null {
  if (!services.length) return null;
  const labelled = String(item.commercialService || "").trim();
  if (labelled) {
    const exact = services.find(
      (service) =>
        service.serviceName.toLowerCase() === labelled.toLowerCase() ||
        service.serviceId === labelled ||
        overlaps(labelled, service.serviceName) ||
        overlaps(labelled, service.serviceId),
    );
    if (exact) return exact;
  }
  const hay = `${item.recommendedAction} ${item.whyRecommended} ${item.targetPageType}`;
  return services.find((service) => overlaps(hay, service.serviceName) || overlaps(hay, service.serviceId)) || null;
}

function isSparseFootprintOnly(item: ApprovedGrowthPlanItem): boolean {
  const id = `${item.recommendationId} ${item.gapId}`.toLowerCase();
  if (id.includes("sparse-organic-footprint") || id.includes("sparsecustomerfootprint")) return true;
  const blob = diagnosticBlob(item).toLowerCase();
  const sparse = /sparse/.test(blob) && /footprint|ranking keyword/.test(blob);
  const noService = !item.commercialService;
  return sparse && noService;
}

function isPositionVolumeOnly(item: ApprovedGrowthPlanItem, mapped: TenantServiceCatalogueEntry | null): boolean {
  const blob = diagnosticBlob(item);
  const metric = /position\s*=\s*\d+/i.test(blob) || /search volume\s*=/i.test(blob);
  const rankingUrl = /ranking url=/i.test(blob);
  if (!metric && !rankingUrl) return false;
  if (mapped) return false;
  return true;
}

function isDiagnosticSignalOnly(item: ApprovedGrowthPlanItem, mapped: TenantServiceCatalogueEntry | null): boolean {
  if (String(item.targetPageType || "").toUpperCase().includes("NO ACTION")) return true;
  if (item.type === "INSUFFICIENT_COMPETITOR_EVIDENCE" || item.evidenceClass === "INSUFFICIENT_EVIDENCE") return true;
  if (/do not create content from competitor/i.test(item.recommendedAction)) return true;
  if (isSparseFootprintOnly(item)) return true;
  if (isPositionVolumeOnly(item, mapped)) return true;
  return false;
}

function hasCustomerIntent(item: ApprovedGrowthPlanItem, mapped: TenantServiceCatalogueEntry | null): boolean {
  if (!mapped) return false;
  if (isDiagnosticSignalOnly(item, null) && isSparseFootprintOnly(item)) return false;
  if (isPositionVolumeOnly(item, mapped)) return false;
  if (String(item.targetPageType || "").toUpperCase().includes("NO ACTION")) return false;
  return true;
}

function resolveExistingPage(
  service: TenantServiceCatalogueEntry,
  ctx: TenantCommercialContext,
): { url: string | null; dedicated: boolean } {
  const configured = String(ctx.serviceUrls[service.serviceId] || service.href || "").trim() || null;
  const coverage = ctx.websiteCoverage.find(
    (row) =>
      row.serviceName.toLowerCase() === service.serviceName.toLowerCase() ||
      overlaps(row.serviceName, service.serviceName),
  );
  const url = configured || coverage?.mainPageUrl || null;
  if (!url) return { url: null, dedicated: false };
  if (isContactLike(url) && !/contact/i.test(service.serviceName)) {
    return { url, dedicated: false };
  }
  const dedicated =
    coverage?.coverageStatus === "dedicated-page" ||
    Boolean(configured && !isContactLike(configured));
  return { url, dedicated };
}

function deriveContentAction(
  item: ApprovedGrowthPlanItem,
  existing: { url: string | null; dedicated: boolean },
): Exclude<CommercialContentAction, "NOT_GENERATED"> {
  const pageType = String(item.targetPageType || "").toUpperCase();
  if (pageType.includes("GUIDE")) return "NEW_GUIDE";
  if (pageType.includes("FAQ")) return "NEW_GUIDE";
  if (pageType.includes("BLOG")) return "NEW_BLOG";
  if (pageType.includes("CLUSTER")) return existing.dedicated ? "EXISTING_PAGE_IMPROVEMENT" : "NEW_CLUSTER_PAGE";
  if (existing.dedicated) return "EXISTING_PAGE_IMPROVEMENT";
  if (pageType.includes("EXISTING PAGE")) {
    return existing.url ? "EXISTING_PAGE_IMPROVEMENT" : "NEW_SERVICE_PAGE";
  }
  if (pageType.includes("SERVICE") || pageType.includes("LANDING") || pageType.includes("HUB")) {
    return existing.dedicated ? "EXISTING_PAGE_IMPROVEMENT" : "NEW_SERVICE_PAGE";
  }
  return existing.dedicated ? "EXISTING_PAGE_IMPROVEMENT" : "NEW_SERVICE_PAGE";
}

function contentTypeForAction(action: CommercialContentAction): CommercialContentType {
  if (action === "NEW_BLOG") return "blog";
  if (action === "NEW_GUIDE") return "guides";
  if (action === "NEW_CLUSTER_PAGE") return "service-page";
  return "service-page";
}

function customerIntentCopy(serviceName: string, action: CommercialContentAction): string {
  if (action === "NEW_GUIDE") {
    return `UK community pharmacy owners who want a clear explanation of how ${serviceName} helps their pharmacy grow online.`;
  }
  if (action === "NEW_BLOG") {
    return `UK community pharmacy owners comparing providers of ${serviceName}.`;
  }
  return `UK community pharmacy owners and managers evaluating ${serviceName} for their pharmacy.`;
}

function workingTitleFor(serviceName: string, action: CommercialContentAction): string {
  if (action === "NEW_GUIDE") return `How UK community pharmacies use ${serviceName}`;
  if (action === "NEW_BLOG") return `What pharmacy owners should look for in ${serviceName}`;
  if (action === "NEW_CLUSTER_PAGE") return `${serviceName} support for UK community pharmacies`;
  return `${serviceName} for UK community pharmacies`;
}

function skippedBrief(
  item: ApprovedGrowthPlanItem,
  reason: CommercialSkipReason,
  detail: string,
  extras: Partial<CommercialContentBrief> = {},
): CommercialContentBrief {
  return {
    recommendationId: item.recommendationId,
    gapOpportunityId: item.gapId,
    priority: item.priority,
    confidence: item.confidence,
    evidence: [...item.evidence],
    provenance: item.provenance,
    reasonForCreation: item.whyRecommended,
    commercialService: extras.commercialService ?? item.commercialService,
    commercialServiceId: extras.commercialServiceId ?? null,
    customerIntent: null,
    contentObjective: null,
    contentType: null,
    contentAction: "NOT_GENERATED",
    primaryTopic: null,
    workingTitle: null,
    targetAudience: null,
    serviceProposition: null,
    businessFacts: [],
    supportingEvidence: [...item.evidence],
    claimsAllowed: [],
    claimsProhibited: [
      "Do not treat diagnostic Growth Plan wording as a customer-facing topic.",
      "Do not invent rankings, competitor gaps, or search-volume claims.",
    ],
    internalNotes: [
      `NOT_GENERATED — ${reason}`,
      detail,
      `Internal recommendation ${item.recommendationId} / gap ${item.gapId} retained as evidence only.`,
    ],
    existingPageUrl: extras.existingPageUrl ?? null,
    existingPageDedicated: extras.existingPageDedicated ?? false,
    skipReason: reason,
    skipDetail: detail,
    eligible: false,
  };
}

export function loadTenantCommercialContext(slug: string): TenantCommercialContext {
  const safe = safePharmacySlug(slug);
  const project = readProjectConfig(safe);
  const catalogue = resolveTenantServiceCatalogue(safe);
  const money =
    project.serviceMoneyPages && typeof project.serviceMoneyPages === "object"
      ? (project.serviceMoneyPages as Record<string, unknown>)
      : {};
  const serviceUrls: Record<string, string> = {};
  for (const service of catalogue.services) {
    const href = String(service.href || money[service.serviceId] || "").trim();
    if (href) serviceUrls[service.serviceId] = href;
  }
  const snapshot = resolveWebsiteIntelligenceSnapshot(safe);
  return {
    slug: safe,
    businessName: String(project.businessName || safe),
    market: String(project.primaryLocation || "United Kingdom"),
    description: String(project.description || ""),
    strapline: String(project.strapline || ""),
    ctaText: String(project.primaryCtaText || "Get in touch"),
    ctaUrl: String(project.primaryCtaUrl || project.domain || ""),
    phone: String(project.phone || ""),
    email: String(project.email || ""),
    services: catalogue.services,
    serviceUrls,
    websiteCoverage: snapshot?.analysis?.coverage || [],
  };
}

export function buildCommercialContentBrief(
  item: ApprovedGrowthPlanItem,
  ctx: TenantCommercialContext,
  usedKeys: Set<string>,
): CommercialContentBrief {
  const mapped = mapApprovedItemToConfiguredService(item, ctx.services);
  if (!mapped) {
    const diagnostic = isDiagnosticSignalOnly(item, null);
    return skippedBrief(
      item,
      diagnostic ? "diagnostic_signal_only" : "insufficient_commercial_service_mapping",
      diagnostic
        ? "Diagnostic Growth Plan signal does not define a customer-facing content topic."
        : "NOT_GENERATED — insufficient commercial service mapping",
    );
  }
  if (isSparseFootprintOnly(item) || isDiagnosticSignalOnly(item, mapped)) {
    return skippedBrief(
      item,
      "diagnostic_signal_only",
      "Sparse footprint, ranking metrics, or insufficient competitor evidence cannot define a content topic.",
      { commercialService: mapped.serviceName, commercialServiceId: mapped.serviceId },
    );
  }
  if (!hasCustomerIntent(item, mapped)) {
    return skippedBrief(
      item,
      "insufficient_customer_intent",
      "No meaningful customer intent for a UK community pharmacy owner evaluating this service.",
      { commercialService: mapped.serviceName, commercialServiceId: mapped.serviceId },
    );
  }

  const existing = resolveExistingPage(mapped, ctx);
  const action = deriveContentAction(item, existing);
  if (action === "NEW_SERVICE_PAGE" && existing.dedicated) {
    return skippedBrief(
      item,
      "duplicate_existing_service_page",
      `A canonical ${mapped.serviceName} page already exists at ${existing.url}.`,
      {
        commercialService: mapped.serviceName,
        commercialServiceId: mapped.serviceId,
        existingPageUrl: existing.url,
        existingPageDedicated: existing.dedicated,
      },
    );
  }
  const dedupeKey = `${mapped.serviceId}:${action}:${existing.dedicated ? existing.url || "dedicated" : "new"}`;
  if (usedKeys.has(dedupeKey)) {
    return skippedBrief(
      item,
      "duplicate_existing_service_page",
      `Another approved item already covers ${mapped.serviceName} as ${action}.`,
      {
        commercialService: mapped.serviceName,
        commercialServiceId: mapped.serviceId,
        existingPageUrl: existing.url,
        existingPageDedicated: existing.dedicated,
      },
    );
  }
  usedKeys.add(dedupeKey);

  const contentType = contentTypeForAction(action);
  const workingTitle = workingTitleFor(mapped.serviceName, action);
  const customerIntent = customerIntentCopy(mapped.serviceName, action);
  const contentObjective =
    action === "EXISTING_PAGE_IMPROVEMENT"
      ? `Improve the existing ${mapped.serviceName} page so pharmacy owners can understand and enquire about the service.`
      : `Create ${contentType.replace("-", " ")} copy that helps pharmacy owners evaluate ${mapped.serviceName}.`;
  const internalNotes = [
    `Approved recommendation ${item.recommendationId} for gap ${item.gapId}.`,
    `Growth Plan action: ${item.recommendedAction}`,
    `Evidence class ${item.evidenceClass}; type ${item.type}; source ${item.source}.`,
    existing.url
      ? existing.dedicated
        ? `Canonical commercial page already exists: ${existing.url}. Content action is EXISTING_PAGE_IMPROVEMENT.`
        : `Configured URL ${existing.url} is not a dedicated service page.`
      : "No dedicated commercial page URL is configured.",
  ];

  const brief: CommercialContentBrief = {
    recommendationId: item.recommendationId,
    gapOpportunityId: item.gapId,
    priority: item.priority,
    confidence: item.confidence,
    evidence: [...item.evidence],
    provenance: item.provenance,
    reasonForCreation: item.whyRecommended,
    commercialService: mapped.serviceName,
    commercialServiceId: mapped.serviceId,
    customerIntent,
    contentObjective,
    contentType,
    contentAction: action,
    primaryTopic: mapped.serviceName,
    workingTitle,
    targetAudience: "UK community pharmacy owners and managers",
    serviceProposition:
      ctx.description ||
      `${ctx.businessName} provides ${mapped.serviceName} for community pharmacies in ${ctx.market}.`,
    businessFacts: [
      ctx.strapline,
      ctx.description,
      `${ctx.businessName} commercial services: ${ctx.services.map((s) => s.serviceName).join(", ")}.`,
    ].filter(Boolean),
    supportingEvidence: [...item.evidence],
    claimsAllowed: [
      `${ctx.businessName} sells ${mapped.serviceName} to UK community pharmacies.`,
      ctx.description,
    ].filter(Boolean),
    claimsProhibited: [
      "Do not claim search rankings, search volume, or competitor keyword gaps.",
      "Do not present Growth Plan diagnostics as customer-facing copy.",
      "Do not invent NHS patient-service claims for a national digital-growth provider.",
    ],
    internalNotes,
    existingPageUrl: existing.url,
    existingPageDedicated: existing.dedicated,
    skipReason: null,
    skipDetail: null,
    eligible: true,
  };

  const facing = [brief.workingTitle, brief.customerIntent, brief.contentObjective, brief.serviceProposition, brief.targetAudience].join(
    "\n",
  );
  if (customerFacingHasInternalLanguage(facing)) {
    return skippedBrief(
      item,
      "diagnostic_signal_only",
      "Customer-facing brief fields still contained internal diagnostic language.",
      {
        commercialService: mapped.serviceName,
        commercialServiceId: mapped.serviceId,
        existingPageUrl: existing.url,
        existingPageDedicated: existing.dedicated,
      },
    );
  }
  return brief;
}

export function buildCommercialContentBriefs(
  slug: string,
  items: ApprovedGrowthPlanItem[],
  ctx = loadTenantCommercialContext(slug),
): CommercialBriefBatch {
  const used = new Set<string>();
  const briefs: CommercialContentBrief[] = [];
  for (const item of items.slice(0, MAX_INITIAL_APPROVED_PLAN_ITEMS)) {
    const eligibleSoFar = briefs.filter((row) => row.eligible).length;
    if (eligibleSoFar >= MAX_INITIAL_APPROVED_PLAN_ITEMS) {
      briefs.push(
        skippedBrief(item, "diagnostic_signal_only", "Maximum initial generated items is 3."),
      );
      continue;
    }
    briefs.push(buildCommercialContentBrief(item, ctx, used));
  }
  const eligible = briefs.filter((row) => row.eligible).slice(0, MAX_INITIAL_APPROVED_PLAN_ITEMS);
  const skipped = briefs.filter((row) => !row.eligible);
  return { slug: safePharmacySlug(slug), briefs, eligible, skipped };
}

export function fixtureTenantContext(
  overrides: Partial<TenantCommercialContext> & { services: TenantServiceCatalogueEntry[] },
): TenantCommercialContext {
  return {
    slug: overrides.slug || "fixture-tenant",
    businessName: overrides.businessName || "Fixture Agency",
    market: overrides.market || "United Kingdom",
    description:
      overrides.description ||
      "Fixture Agency supports community pharmacies across the UK with digital-growth services.",
    strapline: overrides.strapline || "Digital services built specifically for community pharmacies.",
    ctaText: overrides.ctaText || "Request a Free Pharmacy Audit",
    ctaUrl: overrides.ctaUrl || "https://example.com/contact",
    phone: overrides.phone || "",
    email: overrides.email || "",
    services: overrides.services,
    serviceUrls: overrides.serviceUrls || {},
    websiteCoverage: overrides.websiteCoverage || [],
  };
}
