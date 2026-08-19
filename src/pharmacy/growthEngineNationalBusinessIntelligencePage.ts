/**
 * National Business Intelligence foundation page.
 * Generic — no tenant slug/domain/service hardcoding.
 */
import { growthEnginePlatformCopy } from "./growthEnginePlatformCopy.ts";
import { buildGrowthEngineFramework } from "./growthEngineFrameworkService.ts";
import { growthEngineWorkflowCss, renderGrowthEngineNavBar } from "./growthEngineWorkflowNav.ts";
import { platformPlatformNavCss, renderPharmacyPlatformNavBar } from "./pharmacyPlatformNav.ts";
import {
  buildNationalBusinessIntelligenceView,
  type CompletenessStatus,
  type NationalBusinessIntelligenceView,
  type ProvenancedFact,
} from "./growthEngineNationalBusinessIntelligenceService.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function completenessClass(status: CompletenessStatus): string {
  if (status === "COMPLETE") return "complete";
  if (status === "PARTIAL") return "partial";
  return "missing";
}

function renderFact(label: string, fact: ProvenancedFact, attr?: string): string {
  return `<div class="bi-fact"${attr ? ` ${attr}` : ""}>
<span class="bi-fact-label">${esc(label)}</span>
<strong class="bi-fact-value" data-origin="${esc(fact.origin)}">${esc(fact.display)}</strong>
<span class="bi-prov">SOURCE=${esc(fact.source)} · SOURCE_URL=${esc(fact.sourceUrl || "—")} · ${esc(fact.origin)} · CONFIDENCE=${esc(fact.confidence)}</span>
</div>`;
}

function nationalBiCss(): string {
  return `
.bi-hero{border:2px solid #005eb8;border-radius:20px;padding:22px 24px;background:linear-gradient(135deg,#eff6ff,#f8fafc);margin-bottom:18px}
.bi-hero h2{margin:0 0 8px;font-size:22px}
.bi-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:16px 0}
.bi-stat{border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#fff;text-align:center}
.bi-stat strong{display:block;font-size:18px;font-weight:900;color:#005eb8}
.bi-stat span{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase}
.bi-stat.complete strong{color:#047857}
.bi-stat.partial strong{color:#b45309}
.bi-stat.missing strong{color:#b91c1c}
.bi-fact{border-bottom:1px solid #e2e8f0;padding:10px 0}
.bi-fact-label{display:block;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#64748b}
.bi-fact-value{display:block;font-size:15px;margin:4px 0}
.bi-prov{display:block;font-size:11px;color:#64748b}
.bi-ready{padding:16px 18px;border-radius:14px;margin:16px 0;font-weight:800}
.bi-ready.yes{background:#ecfdf5;border:1px solid #bbf7d0;color:#065f46}
.bi-ready.no{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412}
.bi-table{width:100%;border-collapse:collapse;font-size:13px}
.bi-table th,.bi-table td{padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:left}
.bi-table th{font-size:11px;text-transform:uppercase;color:#64748b}
.bi-missing{margin:8px 0 0;padding:10px 12px;background:#fef2f2;border-radius:10px;color:#991b1b;font-size:13px}
`;
}

export function renderNationalBusinessIntelligenceBody(view: NationalBusinessIntelligenceView): string {
  const c = view.completeness;
  const inventory = view.inventory;
  const serviceRows = view.services
    .map(
      (row) => `<tr data-bi-service="${esc(row.serviceId)}">
<td>${esc(row.serviceName)}</td>
<td>${esc(row.canonicalService)}</td>
<td>${esc(row.source)}</td>
<td>${row.sourceUrl ? `<a href="${esc(row.sourceUrl)}" target="_blank" rel="noopener">${esc(row.sourceUrl)}</a>` : "—"}</td>
<td>${esc(row.confidence)}</td>
<td>${esc(row.status)}</td>
</tr>`,
    )
    .join("");
  const commercialPages = inventory.pages.filter((page) => page.type === "commercial/service");
  const pageRows = commercialPages
    .slice(0, 20)
    .map(
      (page) => `<tr data-bi-page-type="${esc(page.type)}" data-bi-page-category="${esc(page.category)}">
<td>${esc(page.title)}</td>
<td>${esc(page.type)}</td>
<td>${page.url ? `<a href="${esc(page.url)}" target="_blank" rel="noopener">${esc(page.url)}</a>` : "—"}</td>
<td>${esc(page.associatedService || "—")}</td>
<td>${esc(page.source)}</td>
</tr>`,
    )
    .join("");
  const otherPageRows = inventory.pages
    .filter((page) => page.type !== "commercial/service")
    .slice(0, 20)
    .map(
      (page) => `<tr data-bi-page-type="${esc(page.type)}" data-bi-page-category="${esc(page.category)}">
<td>${esc(page.title)}</td>
<td>${esc(page.type)}</td>
<td>${page.url ? `<a href="${esc(page.url)}" target="_blank" rel="noopener">${esc(page.url)}</a>` : "—"}</td>
<td>${esc(page.associatedService || "—")}</td>
<td>${esc(page.source)}</td>
</tr>`,
    )
    .join("");

  return `<div class="ge-panel" data-pc-bi-page="business-intelligence" data-growth-platform="national" data-ready-for-competitor-discovery="${view.readyForCompetitorDiscovery ? "yes" : "no"}" data-bi-identity="${esc(c.identity)}" data-bi-services="${esc(c.services)}" data-bi-target="${esc(c.targetCustomer)}" data-bi-market="${esc(c.market)}" data-bi-inventory="${esc(c.websiteInventory)}" data-bi-service-count="${view.services.length}" data-bi-total-pages="${inventory.totalPages ?? "NOT_YET_CONNECTED"}">
<div class="bi-hero">
<p class="ge-lead" style="margin:0 0 6px;font-weight:800;color:#005eb8">Business Intelligence foundation</p>
<h2 data-bi-business-name>${esc(view.identity.businessName.display)}</h2>
<p class="ge-lead" style="margin:0">Who this business is, what it sells, who it sells to, which market it serves, and what already exists on the website — with provenance. Missing facts stay unknown.</p>
</div>

<div class="bi-ready ${view.readyForCompetitorDiscovery ? "yes" : "no"}" data-bi-ready="${view.readyForCompetitorDiscovery ? "yes" : "no"}">
READY FOR COMPETITOR DISCOVERY = ${view.readyForCompetitorDiscovery ? "YES" : "NO"}
${view.missingRequired.length ? `<div class="bi-missing">Missing: ${esc(view.missingRequired.join(", "))}</div>` : "<p style=\"margin:8px 0 0;font-weight:600\">Identity, services, target customer, market and website inventory are evidenced. Rankings, competitors, GSC and Google Business Profile are not required for this checkpoint.</p>"}
</div>

<div class="bi-stat-grid">
<div class="bi-stat ${completenessClass(c.identity)}"><strong>${esc(c.identity)}</strong><span>Business identity</span></div>
<div class="bi-stat ${completenessClass(c.services)}"><strong>${esc(c.services)}</strong><span>Services</span></div>
<div class="bi-stat ${completenessClass(c.targetCustomer)}"><strong>${esc(c.targetCustomer)}</strong><span>Target customer</span></div>
<div class="bi-stat ${completenessClass(c.market)}"><strong>${esc(c.market)}</strong><span>Market</span></div>
<div class="bi-stat ${completenessClass(c.websiteInventory)}"><strong>${esc(c.websiteInventory)}</strong><span>Website inventory</span></div>
</div>
</div>

<div class="ge-panel" data-bi-section="who">
<h2>Who is this business?</h2>
${renderFact("Business name", view.identity.businessName, 'data-bi-field="business-name"')}
${renderFact("Domain", view.identity.domain, 'data-bi-field="domain"')}
${renderFact("Website URL", view.identity.websiteUrl, 'data-bi-field="website-url"')}
${renderFact("Business type / category", view.identity.businessType, 'data-bi-field="business-type"')}
${renderFact("Legal name", view.identity.legalName)}
${renderFact("Description", view.identity.description)}
${renderFact("Business proposition", view.identity.proposition)}
${renderFact("Contact phone", view.identity.phone)}
${renderFact("Contact email", view.identity.email)}
${renderFact("CTA", view.identity.cta)}
</div>

<div class="ge-panel" data-bi-section="what">
<h2>What does it sell?</h2>
<p class="ge-lead">Canonical commercial services from tenant configuration, profile and website evidence. Duplicates are merged by generic name overlap only.</p>
<p><strong>COMMERCIAL SERVICES COUNT = ${view.services.length}</strong></p>
${serviceRows ? `<table class="bi-table"><thead><tr><th>Service name</th><th>Canonical service</th><th>Source</th><th>Source URL</th><th>Confidence</th><th>Status</th></tr></thead><tbody>${serviceRows}</tbody></table>` : `<p class="ge-lead">NOT CONFIGURED — no commercial services evidenced yet.</p>`}
</div>

<div class="ge-panel" data-bi-section="who-to">
<h2>Who does it sell to?</h2>
${renderFact("TARGET CUSTOMER MARKET", view.targetCustomer, 'data-bi-field="target-customer"')}
<p class="ge-lead">This value is copied from imported audience evidence or configured proposition. Unsupported customer segments are not inferred.</p>
</div>

<div class="ge-panel" data-bi-section="where">
<h2>What market does it serve?</h2>
${renderFact("COUNTRY / MARKET", view.marketCountry, 'data-bi-field="market-country"')}
${renderFact("LOCAL / NATIONAL / MIXED", view.marketScope, 'data-bi-field="market-scope"')}
${renderFact("Geography", view.geography)}
</div>

<div class="ge-panel" data-bi-section="website">
<h2>What website content already exists?</h2>
<div class="bi-stat-grid">
<div class="bi-stat"><strong data-bi-inv="total">${esc(inventory.totalPages ?? "NOT YET CONNECTED")}</strong><span>Total pages discovered</span></div>
<div class="bi-stat"><strong data-bi-inv="service">${esc(inventory.commercialServicePages ?? "NOT YET CONNECTED")}</strong><span>Commercial / service pages</span></div>
<div class="bi-stat"><strong data-bi-inv="blog">${esc(inventory.blogResourcePages ?? "NOT YET CONNECTED")}</strong><span>Blog / resource pages</span></div>
<div class="bi-stat"><strong data-bi-inv="utility">${esc(inventory.aboutContactUtilityPages ?? "NOT YET CONNECTED")}</strong><span>About / contact / utility</span></div>
<div class="bi-stat"><strong data-bi-inv="other">${esc(inventory.unknownOtherPages ?? "NOT YET CONNECTED")}</strong><span>Unknown / other</span></div>
</div>
<p class="bi-prov">SOURCE=${esc(inventory.source)} · SOURCE_URL=${esc(view.identity.websiteUrl.value || "—")} · ${esc(inventory.origin)} · CONFIDENCE=${esc(inventory.origin === "IMPORTED" ? "high" : "none")}</p>
${pageRows ? `<h3 style="font-size:15px;margin:18px 0 8px">Commercial / service pages</h3><table class="bi-table"><thead><tr><th>Title</th><th>Type</th><th>URL</th><th>Associated service</th><th>Source</th></tr></thead><tbody>${pageRows}</tbody></table>` : `<p class="ge-lead">Website inventory is ${esc(inventory.origin === "NOT_YET_CONNECTED" ? "NOT YET CONNECTED" : inventory.origin.replace(/_/g, " "))}. The existing bounded website importer must discover pages before competitor discovery.</p>`}
${otherPageRows ? `<h3 style="font-size:15px;margin:18px 0 8px">Other discovered pages</h3><table class="bi-table"><thead><tr><th>Title</th><th>Type</th><th>URL</th><th>Associated service</th><th>Source</th></tr></thead><tbody>${otherPageRows}</tbody></table>` : ""}
</div>

<div class="ge-panel" data-bi-section="missing">
<h2>What is still missing?</h2>
<p class="ge-lead">Unknown facts stay unknown. Google Business Profile, reviews, rankings, competitors, traffic and GSC are later stages and do not block this checkpoint.</p>
${view.missingRequired.length ? `<div class="bi-missing">${esc(view.missingRequired.join(", "))}</div>` : `<p>No required Business Intelligence fields are missing for competitor discovery.</p>`}
${view.completeness.websiteInventory !== "COMPLETE" ? `<p>Website inventory: ${esc(view.completeness.websiteInventory)} (${esc(inventory.origin)}).</p>` : ""}
${view.identity.phone.origin === "NOT_FOUND" ? `<p>Public phone: NOT FOUND.</p>` : ""}
</div>`;
}

export function renderNationalBusinessIntelligencePage(slug: string, nav?: { prevUrl?: string; nextUrl?: string }): string {
  const copy = growthEnginePlatformCopy(slug);
  const framework = buildGrowthEngineFramework(slug);
  const view = buildNationalBusinessIntelligenceView(slug);
  const body = renderNationalBusinessIntelligenceBody(view);
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(copy.businessStepTitle)} · Growth Engine</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
${platformPlatformNavCss()}
${growthEngineWorkflowCss()}
${nationalBiCss()}
</style>
</head>
<body data-slug="${esc(slug)}">
<header style="background:linear-gradient(135deg,#005eb8,#003087);color:#fff;padding:16px 24px">
<h1 style="margin:0;font-size:20px">Growth Engine</h1>
${renderPharmacyPlatformNavBar({ slug, activeId: "growth-engine" })}
</header>
${renderGrowthEngineNavBar(slug, framework, "business-intelligence", { nextUrl: nav?.nextUrl, nextLabel: `Continue to ${copy.marketStepTitle} →` })}
<main class="ge-shell">
${body}
<p style="margin-top:20px">
${nav?.nextUrl ? `<a class="ge-btn ge-btn-primary" href="${esc(nav.nextUrl)}">Continue to ${esc(copy.marketStepTitle)} →</a>` : ""}
</p>
</main>
</body>
</html>`;
}
