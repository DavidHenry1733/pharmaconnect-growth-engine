/**
 * National Growth Intelligence — connect existing Search Intelligence,
 * website inventory, and persisted GP-01 Growth Plan evidence.
 * Does not call DataForSEO, Google Places, or GSC.
 * Does not invent competitor keyword gaps or generate content.
 */
import { buildGrowthEngineFramework } from "./growthEngineFrameworkService.ts";
import { resolveGrowthPlan } from "./growthEngineGrowthPlanResolver.ts";
import { growthIntelligencePageCss } from "./growthEngineGrowthIntelligencePage.ts";
import { renderGrowthEngineNavBar } from "./growthEngineWorkflowNav.ts";
import { resolveWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceService.ts";
import { isNationalGrowthPlatform } from "./growthPlatformResolverService.ts";
import { readNationalSearchIntelligence } from "./nationalSearchIntelligenceV1Service.ts";
import { platformPlatformNavCss, renderPharmacyPlatformNavBar } from "./pharmacyPlatformNav.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export function renderNationalGrowthIntelligencePage(
  slug: string,
  options?: { prevUrl?: string; nextUrl?: string },
): string {
  if (!isNationalGrowthPlatform(slug)) {
    throw new Error(`National Growth Intelligence is not applicable to ${slug}`);
  }

  const framework = buildGrowthEngineFramework(slug);
  const search = readNationalSearchIntelligence(slug);
  const plan = resolveGrowthPlan(slug);
  const website = resolveWebsiteIntelligenceSnapshot(slug);
  const competitors = Array.isArray(search.organicCompetitors) ? search.organicCompetitors : [];
  const qualifiedCommercial = competitors.filter((row) => row.eligibleForKeywordExpansion).length;
  const paidExpansions = search.competitorKeywordUniverses.length;
  const rankingKeywords = search.customerOrganicFootprint?.keywordCount ?? search.customerKeywords.length;
  const sparse = Boolean(search.customerOrganicFootprint?.sparse);
  const collected =
    search.status === "collected" || search.status === "empty" || search.status === "partial";
  const websitePages = website?.analysis?.inventory.totalPages || 0;
  const websiteComplete = website?.analysis?.understandingComplete === true;
  const nationalPlan = plan.platform === "national" ? plan.plan : null;
  const primary = nationalPlan?.primary || null;

  const body = `<div class="ge-panel" data-pc-mvp-section="evidence-order">
<h2>Evidence before content</h2>
<p class="gi-section-note">Content is not created from keywords alone. Search Intelligence, the website inventory, and the Growth Plan must be visible first. National commercial content generation is not implemented.</p>
<p class="gi-section-note">The Growth Plan currently uses persisted commercial intelligence. It does not yet consume the collected Search Intelligence competitor list. That merge is not invented here.</p>
</div>

<div class="ge-panel" data-pc-mvp-section="search-intelligence">
<h2>Search Intelligence</h2>
<p class="gi-section-note">Organic rankings and search competitors for this national digital-growth business. Zero qualified commercial competitors is a valid collected state.</p>
<div class="gi-overview">
<div class="gi-stat"><strong data-pc-mvp-si-status="${esc(search.status)}">${esc(search.status)}</strong><span>Status</span></div>
<div class="gi-stat"><strong data-pc-mvp-customer-keywords="${rankingKeywords}">${rankingKeywords}</strong><span>Customer keywords</span></div>
<div class="gi-stat"><strong data-pc-mvp-organic-candidates="${competitors.length}">${competitors.length}</strong><span>Organic / SERP candidates</span></div>
<div class="gi-stat"><strong data-pc-mvp-qualified-commercial="${qualifiedCommercial}">${qualifiedCommercial}</strong><span>Qualified commercial competitors</span></div>
<div class="gi-stat"><strong data-pc-mvp-paid-expansions="${paidExpansions}">${paidExpansions}</strong><span>Paid competitor expansions</span></div>
<div class="gi-stat"><strong data-pc-mvp-sparse="${sparse ? "yes" : "no"}">${sparse ? "Yes" : "No"}</strong><span>Sparse customer footprint</span></div>
</div>
${collected && qualifiedCommercial === 0 ? `<p class="gi-section-note">No commercially qualified competitors were selected for paid keyword expansion. Organic / SERP candidates are search-overlap domains, not commercial competitors.</p>` : ""}
<p style="margin-top:14px"><a class="ge-btn ge-btn-primary" href="/api/growth-engine/search-intelligence?slug=${esc(slug)}">Open Search Intelligence →</a></p>
</div>

<div class="ge-panel" data-pc-mvp-section="website-intelligence">
<h2>Website inventory</h2>
<p class="gi-section-note">${websiteComplete ? `${websitePages} pages inventoried.` : "Website inventory is not complete yet."} Local Google Places comparison is not used here.</p>
<p style="margin-top:14px"><a class="ge-btn ge-btn-ghost" href="/api/growth-engine/website-intelligence?slug=${esc(slug)}">Open Website Report →</a></p>
</div>

<div class="ge-panel" data-pc-mvp-section="growth-plan">
<h2>Persisted Growth Plan</h2>
${primary
    ? `<p class="gi-section-note">Recommended action from persisted commercial intelligence: <strong>${esc(primary.title)}</strong> (${esc(primary.primaryKeyword)}). Gap evidence ${esc(primary.gapEvidenceStatus)} at ${esc(primary.gapConfidence)} confidence is shown as stored — it is not upgraded from Search Intelligence in this view.</p>`
    : `<p class="gi-section-note">No eligible persisted national commercial action is loaded.</p>`}
<p style="margin-top:14px"><a class="ge-btn ge-btn-primary" href="/api/growth-engine/growth-plan?slug=${esc(slug)}">Open Growth Plan →</a></p>
</div>

<div class="gi-ready">
<h3>Ready for strategy review</h3>
<p>Review the Growth Plan next. Do not generate pharmacy campaign pages for this national tenant.</p>
<p>National content generation remains not implemented until Search Intelligence, website evidence, and gap intelligence are consumed by an approved plan.</p>
<a class="ge-btn ge-btn-primary" href="/api/growth-engine/growth-plan?slug=${esc(slug)}">Continue to Growth Plan →</a>
</div>`;

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Growth Intelligence · Growth Engine</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
${platformPlatformNavCss()}
${growthIntelligencePageCss()}
</style>
</head>
<body data-slug="${esc(slug)}" data-growth-platform="national" data-pc-mvp-page="growth-intelligence">
<header style="background:linear-gradient(135deg,#005eb8,#003087);color:#fff;padding:16px 24px">
<h1 style="margin:0;font-size:20px">PharmaConnect Growth Engine</h1>
${renderPharmacyPlatformNavBar({ slug, activeId: "growth-engine" })}
</header>
<div class="ge-shell">
<div class="ge-header-band">
<h1>Growth Intelligence</h1>
<p>National evidence synthesis — Search Intelligence, website inventory, and the persisted Growth Plan</p>
</div>
${renderGrowthEngineNavBar(slug, framework, "growth-intelligence", {
  prevUrl: options?.prevUrl,
  nextUrl: options?.nextUrl,
  nextLabel: "Continue to Growth Plan →",
})}
${body}
</div>
</body></html>`;
}
