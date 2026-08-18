/**
 * Approved Growth Plan → commercial brief → existing content-package generator.
 * Does not create a parallel national content engine.
 * Does not publish, sitemap, or request indexing.
 * Does not call DataForSEO, Google Places, or GSC.
 */
import {
  polishCommercialServicePublicHtml,
  scrubPlannerFieldLabels,
} from "./contentEngine/pharmacyCommercialNarrativePolishV1.ts";
import {
  buildCommercialContentBriefs,
  customerFacingHasInternalLanguage,
  loadTenantCommercialContext,
  type CommercialContentBrief,
} from "./nationalCommercialContentBrief.ts";
import {
  nationalGenerationBlockedReason,
  readApprovedPlanGenerationInput,
  type ApprovedPlanGenerationInput,
} from "./nationalApprovedPlanContract.ts";
import {
  persistApprovedGrowthPlanContentPackage,
  type ApprovedPlanDraftAssetInput,
  type ContentPackageManifest,
} from "./pharmacyContentPackageService.ts";

export { nationalGenerationBlockedReason, readApprovedPlanGenerationInput } from "./nationalApprovedPlanContract.ts";
export { buildCommercialContentBriefs } from "./nationalCommercialContentBrief.ts";

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function slugify(value: string): string {
  return (
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "approved-item"
  );
}

function buildCustomerFacingHtml(
  brief: CommercialContentBrief,
  ctx: ReturnType<typeof loadTenantCommercialContext>,
): { title: string; html: string } {
  const title = brief.workingTitle || `${brief.commercialService} for UK community pharmacies`;
  const serviceName = brief.commercialService || "this service";
  const audience = brief.targetAudience || "UK community pharmacy owners and managers";
  const intent = brief.customerIntent || "";
  const proposition = brief.serviceProposition || ctx.description;
  const objective = brief.contentObjective || "";
  const facts = brief.businessFacts.filter((row) => row && !customerFacingHasInternalLanguage(row));
  const body = `
<article class="eco-article" data-customer-facing="yes" data-commercial-service="${esc(serviceName)}" data-content-action="${esc(brief.contentAction)}" data-customer-intent="${esc(intent)}" data-published="false" data-indexed="false">
<h1>${esc(title)}</h1>
<p class="eco-lead">${esc(ctx.businessName)} helps ${esc(audience.toLowerCase())} with ${esc(serviceName)}. ${esc(ctx.strapline)}</p>
<h2>Who this is for</h2>
<p>${esc(intent)}</p>
<h2>What ${esc(serviceName)} offers</h2>
<p>${esc(proposition)}</p>
<p>${esc(objective)}</p>
${facts.length ? `<h2>How ${esc(ctx.businessName)} works with pharmacies</h2><p>${esc(facts[0])}</p>` : ""}
<h2>Next step</h2>
<p>If you run a community pharmacy in ${esc(ctx.market)} and want help with ${esc(serviceName)}, ${esc(ctx.ctaText)}${ctx.ctaUrl ? ` at ${esc(ctx.ctaUrl)}` : ""}.</p>
<div class="eco-cta">
<p><strong>${esc(ctx.ctaText)}</strong>${ctx.ctaUrl ? ` — ${esc(ctx.ctaUrl)}` : ""}</p>
${ctx.phone ? `<p>Phone: ${esc(ctx.phone)}</p>` : ""}
${ctx.email ? `<p>Email: ${esc(ctx.email)}</p>` : ""}
</div>
</article>`;

  let html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="description" content="${esc(`${serviceName} for UK community pharmacies from ${ctx.businessName}.`)}"/>
<title>${esc(title)} · ${esc(ctx.businessName)}</title>
</head>
<body data-tenant="${esc(ctx.businessName)}" data-growth-platform="national" data-content-package="approved-growth-plan" data-customer-facing="yes">
${body}
</body>
</html>`;
  html = scrubPlannerFieldLabels(html);
  html = polishCommercialServicePublicHtml(html, {
    pharmacyName: ctx.businessName,
    town: ctx.market,
    serviceName,
    phone: ctx.phone,
    nearbyAreaNames: [],
  });
  return { title, html };
}

function toDraft(brief: CommercialContentBrief, html: string, title: string): ApprovedPlanDraftAssetInput {
  return {
    key: brief.recommendationId,
    type: brief.contentType || "service-page",
    title,
    html,
    pageSlug: slugify(`${brief.commercialServiceId || brief.recommendationId}-${brief.contentAction}`),
    notes: brief.contentObjective || `Commercial brief for ${brief.commercialService}.`,
    recommendationId: brief.recommendationId,
    gapId: brief.gapOpportunityId,
    commercialService: brief.commercialService,
    whyRecommended: brief.reasonForCreation,
    evidence: brief.supportingEvidence,
    evidenceSource: brief.provenance,
    priority: brief.priority,
    confidence: brief.confidence,
    provenance: brief.provenance,
    targetPageType: brief.contentAction,
    customerIntent: brief.customerIntent,
    targetAudience: brief.targetAudience,
    contentAction: brief.contentAction,
    existingPageUrl: brief.existingPageUrl,
    reasonForCreation: brief.reasonForCreation,
    internalNotes: brief.internalNotes,
  };
}

export function generateApprovedGrowthPlanContent(slug: string): {
  ok: boolean;
  blocked: boolean;
  manifest?: ContentPackageManifest;
  error?: string;
  input?: ApprovedPlanGenerationInput;
  briefs?: CommercialContentBrief[];
  eligibleCount?: number;
  skippedCount?: number;
} {
  const blocked = nationalGenerationBlockedReason(slug);
  if (blocked) {
    return { ok: false, blocked: true, error: blocked };
  }
  const input = readApprovedPlanGenerationInput(slug);
  if (!input) {
    return { ok: false, blocked: true, error: "Generation is blocked until the Growth Plan is approved." };
  }
  const ctx = loadTenantCommercialContext(slug);
  const batch = buildCommercialContentBriefs(slug, input.items, ctx);
  const drafts: ApprovedPlanDraftAssetInput[] = [];
  for (const brief of batch.eligible) {
    const { title, html } = buildCustomerFacingHtml(brief, ctx);
    if (customerFacingHasInternalLanguage(html) || customerFacingHasInternalLanguage(title)) {
      brief.eligible = false;
      brief.contentAction = "NOT_GENERATED";
      brief.skipReason = "diagnostic_signal_only";
      brief.skipDetail = "Customer-facing output still contained internal diagnostic language.";
      continue;
    }
    drafts.push(toDraft(brief, html, title));
  }
  const skipped = [
    ...batch.skipped.map((row) => ({
      recommendationId: row.recommendationId,
      gapId: row.gapOpportunityId,
      reason: row.skipReason || "insufficient_commercial_service_mapping",
      detail: row.skipDetail || "NOT_GENERATED",
    })),
    ...batch.eligible
      .filter((row) => !row.eligible)
      .map((row) => ({
        recommendationId: row.recommendationId,
        gapId: row.gapOpportunityId,
        reason: row.skipReason || "diagnostic_signal_only",
        detail: row.skipDetail || "NOT_GENERATED",
      })),
  ];
  const manifest = persistApprovedGrowthPlanContentPackage(slug, drafts, {
    skippedItems: skipped,
    adminDiagnostics: [
      "brief:nationalCommercialContentBrief",
      "polish:pharmacyCommercialNarrativePolishV1",
      `eligible:${drafts.length}`,
      `skipped:${skipped.length}`,
      "quality:bpi-polish-active",
    ],
  });
  if (manifest.status === "error") {
    return {
      ok: false,
      blocked: false,
      manifest,
      error: manifest.generationError || "Generation failed",
      input,
      briefs: batch.briefs,
      eligibleCount: drafts.length,
      skippedCount: skipped.length,
    };
  }
  return {
    ok: true,
    blocked: false,
    manifest,
    input,
    briefs: batch.briefs,
    eligibleCount: drafts.length,
    skippedCount: skipped.length,
  };
}
