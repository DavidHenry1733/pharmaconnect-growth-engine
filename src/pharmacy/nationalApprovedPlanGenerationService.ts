/**
 * Approved Growth Plan → existing content-package generator adapter.
 * Does not create a parallel national content engine.
 * Does not publish, sitemap, or request indexing.
 * Does not call DataForSEO, Google Places, or GSC.
 */
import fs from "node:fs";

import { scrubPlannerFieldLabels } from "./contentEngine/pharmacyCommercialNarrativePolishV1.ts";
import { resolveWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceService.ts";
import {
  nationalGenerationBlockedReason,
  readApprovedPlanGenerationInput,
  type ApprovedGrowthPlanItem,
} from "./nationalApprovedPlanContract.ts";
import {
  persistApprovedGrowthPlanContentPackage,
  type ApprovedPlanDraftAssetInput,
  type ContentPackageManifest,
} from "./pharmacyContentPackageService.ts";
import { getPharmacyProjectConfigPath, safePharmacySlug } from "./pharmacyWorkspacePaths.ts";

export { nationalGenerationBlockedReason, readApprovedPlanGenerationInput } from "./nationalApprovedPlanContract.ts";

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

function readProjectConfig(slug: string): Record<string, unknown> {
  const file = getPharmacyProjectConfigPath(safePharmacySlug(slug));
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function serviceCopy(name: string | null, project: Record<string, unknown>): {
  serviceName: string;
  existingUrl: string | null;
  description: string;
} {
  const services = Array.isArray(project.services) ? project.services.map((v) => String(v)) : [];
  const money =
    project.serviceMoneyPages && typeof project.serviceMoneyPages === "object"
      ? (project.serviceMoneyPages as Record<string, unknown>)
      : {};
  const serviceName = name || String(project.mainService || "Pharmacy Digital Growth");
  const matchedId = Object.keys(money).find((id) => {
    const label = String(money[id] || "");
    return (
      serviceName.toLowerCase().includes(id.replace(/-/g, " ")) ||
      label.toLowerCase().includes(serviceName.toLowerCase().slice(0, 12)) ||
      id.split("-").every((token) => token === "pharmacy" || serviceName.toLowerCase().includes(token))
    );
  });
  return {
    serviceName,
    existingUrl: matchedId ? String(money[matchedId] || "") || null : null,
    description:
      String(project.description || "") ||
      `${String(project.businessName || "This business")} supports community pharmacies across the UK with ${services.join(", ") || "digital-growth services"}.`,
  };
}

function websiteFacts(slug: string, serviceName: string): string[] {
  const snapshot = resolveWebsiteIntelligenceSnapshot(slug);
  const analysis = snapshot?.analysis;
  if (!analysis) {
    return [
      "Website Intelligence is used where a snapshot exists. This draft does not invent crawl counts or missing-page claims beyond the approved Growth Plan evidence.",
    ];
  }
  const facts: string[] = [];
  if (analysis.websiteUrl) facts.push(`Current website: ${analysis.websiteUrl}.`);
  if (analysis.inventory?.totalPages != null) {
    facts.push(`Website Intelligence currently inventories ${analysis.inventory.totalPages} pages, including ${analysis.inventory.servicePages || 0} service pages.`);
  }
  const coverage = (analysis.coverage || []).find((row) => row.serviceName.toLowerCase() === serviceName.toLowerCase());
  if (coverage?.mainPageUrl) {
    facts.push(`Website Intelligence already records a ${coverage.serviceName} page at ${coverage.mainPageUrl} (${coverage.coverageStatus || "detected"}).`);
  } else if (coverage) {
    facts.push(`Website Intelligence coverage for ${coverage.serviceName} is ${coverage.coverageStatus || "not-found"}.`);
  }
  const missing = (analysis.missingContent || []).find((row) => row.serviceName.toLowerCase() === serviceName.toLowerCase());
  if (missing?.evidence) facts.push(missing.evidence);
  return facts.slice(0, 4);
}

function pageHeading(item: ApprovedGrowthPlanItem, businessName: string, serviceName: string): string {
  if (item.contentType === "service-page") {
    return `${serviceName} for UK community pharmacies`;
  }
  if (item.contentType === "guides") {
    return `${businessName} guide: ${serviceName} visibility`;
  }
  if (item.contentType === "faq") {
    return `${serviceName} questions for pharmacy owners`;
  }
  return `Improve ${businessName} ${serviceName.toLowerCase()} coverage`;
}

function buildDraftHtml(
  slug: string,
  project: Record<string, unknown>,
  item: ApprovedGrowthPlanItem,
): { title: string; html: string } {
  const businessName = String(project.businessName || "PharmaConnect");
  const strapline = String(project.strapline || "Digital services built specifically for community pharmacies.");
  const phone = String(project.phone || "");
  const email = String(project.email || "");
  const ctaText = String(project.primaryCtaText || "Request a Free Pharmacy Audit");
  const ctaUrl = String(project.primaryCtaUrl || project.domain || "");
  const market = String(project.primaryLocation || "United Kingdom");
  const service = serviceCopy(item.commercialService, project);
  const title = pageHeading(item, businessName, service.serviceName);
  const webFacts = websiteFacts(slug, service.serviceName);
  const evidenceItems = item.evidence.map((row) => `<li>${esc(row)}</li>`).join("");
  const existingPage = service.existingUrl
    ? `<p>${esc(businessName)} already publishes a commercial page for this service at ${esc(service.existingUrl)}. This draft is an approved Growth Plan improvement for that commercial service, not a new patient-facing NHS page.</p>`
    : `<p>This draft supports ${esc(service.serviceName)} using ${esc(businessName)} project configuration and approved Growth Plan evidence. It does not invent a ranking or a competitor claim that is not in that evidence.</p>`;

  const body = `
<article class="eco-article" data-approved-plan-item="${esc(item.recommendationId)}" data-gap-id="${esc(item.gapId)}" data-published="false" data-indexed="false">
<h1>${esc(title)}</h1>
<p class="eco-lead">${esc(businessName)} is a national digital-growth provider serving UK community pharmacies. ${esc(strapline)} This page was created because the approved Growth Plan recommended it — not from a raw keyword list.</p>
<h2>Why we are creating this</h2>
<p>${esc(item.whyRecommended)}</p>
<p>Recommended action: ${esc(item.recommendedAction)}. Target content type: ${esc(item.targetPageType)}. Priority ${esc(item.priority)} with ${esc(item.confidence)} confidence.</p>
<h2>What gap this addresses</h2>
<p>Gap ${esc(item.gapId)} (${esc(item.type.replace(/_/g, " "))}) is classified ${esc(item.evidenceClass)} from ${esc(item.source)}. ${esc(businessName)} is not treating this as a competitor-keyword gap unless that evidence class already says so.</p>
<h2>What service this supports</h2>
<p>${esc(businessName)} sells ${esc(service.serviceName)} to community pharmacies in ${esc(market)}. ${esc(service.description)}</p>
${existingPage}
<h2>Evidence that justifies it</h2>
<p>Provenance: ${esc(item.provenance)}. The following statements are copied from the approved Growth Plan item. Search demand and competitor rankings are not fabricated here.</p>
<ul>${evidenceItems || "<li>Approved plan evidence is recorded on this recommendation.</li>"}</ul>
<h2>${esc(businessName)} commercial context</h2>
<p>${esc(businessName)} helps pharmacy owners improve their digital presence: website design, local search, email marketing, hosting, and growth audits. The audience for this draft is UK community pharmacy owners and managers, not patients looking for NHS treatment.</p>
<p>${webFacts.map((fact) => esc(fact)).join(" ")}</p>
<h2>What this draft should do next</h2>
<p>Keep the page specific to ${esc(service.serviceName)} and to ${esc(businessName)}. Do not publish until Review Centre has inspected the draft. Do not add this URL to a sitemap or request indexing in this step.</p>
<div class="eco-cta">
<p><strong>Next step for pharmacy owners:</strong> ${esc(ctaText)}${ctaUrl ? ` — ${esc(ctaUrl)}` : ""}.</p>
${phone ? `<p>Phone: ${esc(phone)}</p>` : ""}
${email ? `<p>Email: ${esc(email)}</p>` : ""}
</div>
</article>`;

  const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)} · ${esc(businessName)}</title>
</head>
<body data-tenant="${esc(businessName)}" data-growth-platform="national" data-content-package="approved-growth-plan">
${scrubPlannerFieldLabels(body)}
</body>
</html>`;
  return { title, html };
}

export function generateApprovedGrowthPlanContent(
  slug: string,
): { ok: boolean; blocked: boolean; manifest?: ContentPackageManifest; error?: string; input?: ApprovedPlanGenerationInput } {
  const blocked = nationalGenerationBlockedReason(slug);
  if (blocked) {
    return { ok: false, blocked: true, error: blocked };
  }
  const input = readApprovedPlanGenerationInput(slug);
  if (!input) {
    return { ok: false, blocked: true, error: "Generation is blocked until the Growth Plan is approved." };
  }
  const project = readProjectConfig(slug);
  const drafts: ApprovedPlanDraftAssetInput[] = input.items.map((item) => {
    const { title, html } = buildDraftHtml(slug, project, item);
    return {
      key: item.recommendationId,
      type: item.contentType,
      title,
      html,
      pageSlug: slugify(item.recommendationId),
      notes: `Approved Growth Plan item ${item.recommendationId} for gap ${item.gapId}.`,
      recommendationId: item.recommendationId,
      gapId: item.gapId,
      commercialService: item.commercialService,
      whyRecommended: item.whyRecommended,
      evidence: item.evidence,
      evidenceSource: item.source,
      priority: item.priority,
      confidence: item.confidence,
      provenance: item.provenance,
      targetPageType: item.targetPageType,
    };
  });
  const manifest = persistApprovedGrowthPlanContentPackage(slug, drafts);
  if (manifest.status === "error") {
    return { ok: false, blocked: false, manifest, error: manifest.generationError || "Generation failed", input };
  }
  return { ok: true, blocked: false, manifest, input };
}
