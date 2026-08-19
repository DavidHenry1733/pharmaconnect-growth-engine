/**
 * National Growth Intelligence — evidence summary + gap/opportunity list.
 * Consumes Search Intelligence, website/config, and persisted market evidence.
 * Does not call DataForSEO, Google Places, or GSC.
 * Does not invent competitor keyword gaps.
 */
import { buildGrowthEngineFramework } from "./growthEngineFrameworkService.ts";
import { growthIntelligencePageCss } from "./growthEngineGrowthIntelligencePage.ts";
import { renderGrowthEngineNavBar } from "./growthEngineWorkflowNav.ts";
import { isNationalGrowthPlatform } from "./growthPlatformResolverService.ts";
import { buildNationalGrowthIntelligence } from "./nationalGrowthIntelligenceService.ts";
import type { NationalGrowthGap } from "./nationalGrowthIntelligenceModel.ts";
import { platformPlatformNavCss, renderPharmacyPlatformNavBar } from "./pharmacyPlatformNav.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function pill(kind: string, value: string): string {
  return `<span class="gi-pill ${esc(kind)}">${esc(value)}</span>`;
}

function renderGap(item: NationalGrowthGap): string {
  return `<article class="gi-opp" data-pc-gi-opportunity="${esc(item.id)}" data-pc-gi-type="${esc(item.type)}" data-pc-gi-class="${esc(item.evidenceClass)}" data-pc-gi-competitor-gap="${item.competitorGap ? "true" : "false"}">
<div class="gi-opp-head">
<div>
<h3 class="gi-opp-title">${esc(item.recommendedAction)}</h3>
<p style="margin:6px 0 0;font-size:13px;color:#64748b">${esc(item.currentState)}</p>
</div>
<div class="gi-badges">
${pill(`priority-${item.priority.toLowerCase()}`, `${item.priority} priority`)}
${pill(`confidence-${item.confidence.toLowerCase()}`, `${item.confidence} confidence`)}
${pill("source", item.type.replace(/_/g, " "))}
${pill("source", item.evidenceClass.replace(/_/g, " "))}
</div>
</div>
<div class="gi-opp-body">
<p style="margin:0 0 10px"><strong>What we found:</strong> ${esc(item.currentState)}</p>
<p style="margin:0 0 10px"><strong>Why it matters:</strong> ${esc(item.whyItMatters)}</p>
<p style="margin:0 0 10px"><strong>Recommended action:</strong> ${esc(item.recommendedAction)}</p>
<p style="margin:0 0 10px"><strong>Commercial service:</strong> ${esc(item.commercialService || "Not service-specific")}</p>
<p style="margin:0 0 10px"><strong>Evidence source:</strong> ${esc(item.source)} · ${esc(item.provenance.evidenceSource)} · ${esc(item.provenance.authority)}</p>
<ul style="margin:0;padding-left:18px;font-size:13px;color:#475569">${item.evidence.map((row) => `<li>${esc(row)}</li>`).join("")}</ul>
</div>
</article>`;
}

export function renderNationalGrowthIntelligencePage(
  slug: string,
  options?: { prevUrl?: string; nextUrl?: string },
): string {
  if (!isNationalGrowthPlatform(slug)) {
    throw new Error(`National Growth Intelligence is not applicable to ${slug}`);
  }

  const framework = buildGrowthEngineFramework(slug);
  const report = buildNationalGrowthIntelligence(slug);
  const opportunities = report.gaps;
  const competitorGaps = opportunities.filter((item) => item.competitorGap || item.type === "COMPETITOR_GAP").length;

  const body = `<div class="ge-panel" data-pc-mvp-section="evidence-summary" data-pc-gi-section="evidence-summary">
<h2>Evidence summary</h2>
<p class="gi-section-note">Content is not created from keywords alone. This page compares business/service context, website evidence, and Search Intelligence, then lists only evidence-backed gaps.</p>
<div class="ge-panel" style="margin:0;box-shadow:none;border-color:#dbeafe;background:#f8fbff">
<h3 style="margin:0 0 8px;font-size:15px">Business / service evidence</h3>
<p class="gi-section-note">${esc(report.businessName)} · ${esc(report.subjectDomain)} · ${esc(report.primaryMarket)}</p>
<p class="gi-section-note">Commercial services: ${esc(report.commercialServices.map((s) => s.serviceName).join(", ") || "None configured")}</p>
</div>
<div class="ge-panel" style="margin:16px 0 0;box-shadow:none">
<h3 style="margin:0 0 8px;font-size:15px">Website evidence</h3>
<p class="gi-section-note">${report.website.complete ? `${report.website.totalPages} pages inventoried.` : "Website crawl inventory is not complete."} Configured commercial pages: ${report.website.configuredCommercialPages}. Source: ${esc(report.website.source)}. Local Google Places comparison is not used here.</p>
</div>
</div>

<div class="ge-panel" data-pc-mvp-section="search-intelligence" data-pc-gi-section="search-intelligence">
<h2>Search Intelligence evidence</h2>
<p class="gi-section-note">Zero qualified commercial competitors is a valid collected state. Organic / SERP candidates are not commercial competitors.</p>
<div class="gi-overview">
<div class="gi-stat"><strong data-pc-mvp-si-status="${esc(report.search.status)}" data-pc-gi-search-status="${esc(report.search.status)}">${esc(report.search.status)}</strong><span>Search status</span></div>
<div class="gi-stat"><strong data-pc-mvp-customer-keywords="${report.search.customerKeywords}" data-pc-gi-customer-keywords="${report.search.customerKeywords}">${report.search.customerKeywords}</strong><span>Customer ranking keywords</span></div>
<div class="gi-stat"><strong data-pc-mvp-organic-candidates="${report.search.organicCandidates}" data-pc-gi-organic-candidates="${report.search.organicCandidates}">${report.search.organicCandidates}</strong><span>Organic / SERP candidates</span></div>
<div class="gi-stat"><strong data-pc-mvp-qualified-commercial="${report.search.qualifiedCommercialCompetitors}" data-pc-gi-qualified-commercial="${report.search.qualifiedCommercialCompetitors}">${report.search.qualifiedCommercialCompetitors}</strong><span>Qualified commercial competitors</span></div>
<div class="gi-stat"><strong data-pc-mvp-paid-expansions="${report.search.paidCompetitorExpansions}">${report.search.paidCompetitorExpansions}</strong><span>Paid competitor expansions</span></div>
<div class="gi-stat"><strong data-pc-mvp-sparse="${report.search.sparse ? "yes" : "no"}" data-pc-gi-sparse="${report.search.sparse ? "yes" : "no"}">${report.search.sparse ? "Yes" : "No"}</strong><span>Sparse search footprint</span></div>
</div>
${report.search.sparse ? `<p class="gi-section-note" data-pc-gi-sparse-copy="yes">Sparse search footprint: YES. Fewer than ${report.search.sparseThreshold} customer keywords currently rank.</p>` : ""}
${report.search.qualifiedCommercialCompetitors === 0 ? `<p class="gi-section-note" data-pc-gi-zero-commercial="yes">Qualified commercial competitors: 0. Competitor keyword gaps are not proven.</p>` : ""}
<p style="margin-top:14px"><a class="ge-btn ge-btn-primary" href="/api/growth-engine/search-intelligence?slug=${esc(slug)}">Open Search Intelligence →</a></p>
</div>

<div class="ge-panel" data-pc-gi-section="opportunities" data-pc-gi-competitor-gaps="${competitorGaps}">
<h2>Growth opportunities / gaps</h2>
<p class="gi-section-note">Each item keeps TYPE, SOURCE, CURRENT STATE, EVIDENCE, WHY IT MATTERS, RECOMMENDED ACTION, COMMERCIAL SERVICE, PRIORITY, CONFIDENCE, and PROVENANCE. Insufficient competitor evidence is not converted into certainty.</p>
<div data-pc-gi-opportunity-list>
${opportunities.length ? opportunities.map(renderGap).join("") : `<div class="gi-empty">No evidence-backed opportunities yet.</div>`}
</div>
</div>

<div class="ge-panel" data-pc-gi-section="limitations">
<h2>Evidence limitations</h2>
${report.limitations.length
    ? `<ul style="margin:0;padding-left:18px;font-size:13px;color:#475569">${report.limitations.map((row) => `<li>${esc(row)}</li>`).join("")}</ul>`
    : `<p class="gi-section-note">No additional limitations recorded.</p>`}
</div>

<div class="gi-ready">
<h3>Ready for Growth Plan review</h3>
<p>The Growth Plan consumes these same gaps. Do not generate content from this screen.</p>
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
<body data-slug="${esc(slug)}" data-growth-platform="national" data-pc-mvp-page="growth-intelligence" data-pc-gi-page="growth-intelligence">
<header style="background:linear-gradient(135deg,#005eb8,#003087);color:#fff;padding:16px 24px">
<h1 style="margin:0;font-size:20px">PharmaConnect Growth Engine</h1>
${renderPharmacyPlatformNavBar({ slug, activeId: "growth-engine" })}
</header>
<div class="ge-shell">
<div class="ge-header-band">
<h1>Growth Intelligence</h1>
<p>National evidence synthesis — Search Intelligence, website/service context, and evidence-backed gaps</p>
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
