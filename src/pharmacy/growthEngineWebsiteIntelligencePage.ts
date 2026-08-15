/**
 * Growth Engine — Website Intelligence V1 page renderer.
 */
import type { GrowthEngineWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceModel.ts";
import type { WebsiteContentMapNode } from "./growthEngineWebsiteIntelligenceModel.ts";
import type { WebsiteImportSnapshot } from "./pharmacyProfileSchema.ts";
import { WEBSITE_PAGE_CATEGORY_LABELS } from "./growthEngineWebsiteIntelligenceModel.ts";
import { formatCategoryBreakdown } from "./growthEngineWebsiteIntelligenceAnalysis.ts";
import { coverageStatusLabel } from "./growthEngineWebsiteReportCanonicalEvidence.ts";
import { buildGrowthEngineFramework } from "./growthEngineFrameworkService.ts";
import { growthEngineWorkflowCss, renderGrowthEngineNavBar } from "./growthEngineWorkflowNav.ts";
import { platformPlatformNavCss, renderPharmacyPlatformNavBar } from "./pharmacyPlatformNav.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export function websiteIntelligencePageCss(): string {
  return `${growthEngineWorkflowCss()}
.wi-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:16px 0}
.wi-stat{border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#fafbfc;text-align:center}
.wi-stat strong{display:block;font-size:24px;font-weight:900;color:#005eb8}
.wi-stat span{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase}
.wi-compare{display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:center;margin:20px 0}
.wi-compare-col{border:1px solid #e2e8f0;border-radius:14px;padding:18px;background:#fff}
.wi-compare-col.recommended{border-color:#0f766e;background:#ecfdf5}
.wi-diff{text-align:center;font-size:22px;font-weight:900;color:#0f766e}
.wi-map{display:flex;flex-direction:column;align-items:center;gap:4px;margin:20px 0;padding:20px;background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0}
.wi-map-node{font-size:14px;font-weight:800;padding:10px 20px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;min-width:160px;text-align:center}
.wi-map-arrow{color:#94a3b8;font-size:18px}
.wi-table{width:100%;border-collapse:collapse;font-size:13px;margin:12px 0}
.wi-table th,.wi-table td{padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:left}
.wi-table th{font-size:11px;text-transform:uppercase;color:#64748b;background:#f8fafc}
.wi-opp{border-left:4px solid #6366f1;background:#eef2ff;padding:12px 14px;margin-bottom:8px;border-radius:0 8px 8px 0;font-size:13px}
.wi-opp strong{display:block;color:#312e81;margin-bottom:4px}
.wi-missing{border-left:4px solid #f59e0b;background:#fffbeb;padding:10px 12px;margin-bottom:6px;border-radius:0 8px 8px 0;font-size:13px;color:#78350f}
.wi-tech-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:12px 0}
.wi-tech-item{font-size:12px;padding:10px;border:1px solid #e2e8f0;border-radius:8px;background:#fff}
.wi-tech-item.yes{border-color:#bbf7d0;background:#f0fdf4;color:#065f46;font-weight:700}
.wi-tech-item.no{color:#64748b}
.wi-summary{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;margin:16px 0}
.wi-summary p{margin:0 0 8px;font-size:14px;color:#334155;line-height:1.6}
.wi-ready{margin-top:28px;padding:24px;background:linear-gradient(135deg,#4338ca,#005eb8);border-radius:16px;color:#fff;text-align:center}
.wi-ready h3{margin:0 0 8px;font-size:18px}
.wi-ready p{margin:0 0 16px;color:#dbeafe;font-size:14px}
.wi-ready .ge-btn-primary{background:#fff;color:#4338ca}
.wi-warn{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:12px 14px;border-radius:10px;font-size:13px;margin-bottom:16px}
.wi-svc-card{border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:10px;background:#fff}
.wi-svc-meta{font-size:12px;color:#64748b;margin-top:6px}`;
}

function renderImportEvidencePanel(importSnap: WebsiteImportSnapshot | null | undefined): string {
  if (!importSnap?.importedAt || importSnap.status === "not_found") return "";
  const intel = importSnap.intelligence;
  const logoUrl = intel?.identity.logoUrl || importSnap.logoUrl || "";
  const logoStatus = logoUrl ? "Found" : "Not found";
  const phone = intel?.business.phone.selected || importSnap.phone || "";
  const email = intel?.business.email.selected || importSnap.email || "";
  const address = [intel?.business.address.selected || importSnap.address, intel?.business.town.selected || importSnap.town, intel?.business.postcode.selected || importSnap.postcode]
    .filter(Boolean)
    .join(", ");
  const footerLinks = (importSnap.footerLinks || []).filter(Boolean);
  const headerDetected = Boolean(intel?.structure.pages.some((p) => p.category === "homepage") || logoUrl);
  const footerDetected = footerLinks.length > 0 || Boolean(intel?.structure.policyPages || intel?.structure.contactPages);

  return `<div class="ge-panel">
<h2>Imported website evidence</h2>
<p class="ge-lead">Brand, contact and navigation findings from your website import — service counts below use one canonical inventory.</p>
<div class="wi-stat-grid">
<div class="wi-stat"><strong>${logoStatus}</strong><span>Logo / brand</span></div>
<div class="wi-stat"><strong>${phone ? "Found" : "Not found"}</strong><span>Phone</span></div>
<div class="wi-stat"><strong>${email ? "Found" : "Not found"}</strong><span>Email</span></div>
<div class="wi-stat"><strong>${headerDetected ? "Detected" : "Not detected"}</strong><span>Header</span></div>
<div class="wi-stat"><strong>${footerDetected ? "Detected" : "Not detected"}</strong><span>Footer</span></div>
</div>
${logoUrl ? `<p style="font-size:13px;color:#475569;margin:12px 0 0">Logo source: <a href="${esc(logoUrl)}" target="_blank" rel="noopener">${esc(logoUrl)}</a></p>` : ""}
${address ? `<p style="font-size:13px;color:#475569;margin:8px 0 0">Contact address: ${esc(address)}</p>` : ""}
${phone ? `<p style="font-size:13px;color:#475569;margin:8px 0 0">Phone: ${esc(phone)}</p>` : ""}
${email ? `<p style="font-size:13px;color:#475569;margin:8px 0 0">Email: ${esc(email)}</p>` : ""}
${footerLinks.length ? `<p style="font-size:13px;color:#475569;margin:8px 0 0">Footer links found: ${esc(footerLinks.join(" · "))}</p>` : ""}
</div>`;
}

function renderContentMapNodes(nodes: WebsiteContentMapNode[]): string {
  const parts: string[] = [];
  for (const node of nodes) {
    parts.push(`<div class="wi-map-node">${esc(node.label)}${node.count ? ` (${node.count})` : ""}</div>`);
    if (node.children?.length) {
      for (const child of node.children) {
        parts.push(`<div class="wi-map-arrow">↓</div>`);
        parts.push(renderContentMapNodes([child]));
      }
    }
  }
  return parts.join("");
}

function renderFlatContentMap(): string {
  const layers = ["Home", "Services", "Supporting Pages", "Blogs", "Guides", "FAQs", "Locations"];
  return `<div class="wi-map">${layers.map((l, i) => `${i ? '<div class="wi-map-arrow">↓</div>' : ""}<div class="wi-map-node">${esc(l)}</div>`).join("")}</div>`;
}

function renderPharmacyWebsiteSignals(tech: NonNullable<NonNullable<GrowthEngineWebsiteIntelligenceSnapshot["analysis"]>["technical"]>): string {
  const signals: Array<{ ok: boolean; label: string; meaning: string }> = [
    { ok: tech.https, label: "Secure website", meaning: "Patients see a padlock — your site uses a secure connection." },
    { ok: tech.sitemapDetected, label: "Page directory", meaning: "A directory helps search engines find all your pages." },
    { ok: tech.robotsDetected, label: "Search instructions", meaning: "Tells search engines which pages to include." },
    { ok: tech.schemaDetected, label: "Business details for Google", meaning: "Structured information helps Google show your pharmacy correctly." },
    { ok: tech.metaTitlesPresent, label: "Page titles", meaning: "Each page has a clear title — what patients see in search results." },
    { ok: tech.metaDescriptionsPresent, label: "Page summaries", meaning: "Short descriptions under each title in search results." },
    { ok: tech.openGraphPresent, label: "Social previews", meaning: "Your pages look good when shared on social media." },
    { ok: tech.canonicalPresent, label: "Preferred page address", meaning: "Avoids duplicate pages confusing search engines." },
  ];
  return `<div class="wi-tech-grid">${signals
    .map(
      (s) => `<div class="wi-tech-item ${s.ok ? "yes" : "no"}">
<strong>${esc(s.label)}</strong>
<p style="margin:6px 0 0;font-size:12px;line-height:1.45">${esc(s.meaning)}</p>
<p style="margin:4px 0 0;font-size:11px;font-weight:800">${s.ok ? "✓ Present" : "Not detected"}</p>
</div>`,
    )
    .join("")}</div>${tech.xmlSitemapUrl ? `<p style="font-size:12px;color:#64748b;margin-top:12px">Page directory link: <a href="${esc(tech.xmlSitemapUrl)}" target="_blank" rel="noopener">${esc(tech.xmlSitemapUrl)}</a></p>` : ""}`;
}

export function renderWebsiteIntelligencePage(
  slug: string,
  snapshot: GrowthEngineWebsiteIntelligenceSnapshot | null,
  nav: { prevUrl?: string; nextUrl?: string },
  importSnap?: WebsiteImportSnapshot | null,
): string {
  const framework = buildGrowthEngineFramework(slug);
  const analysis = snapshot?.analysis;
  const live = analysis?.dataSource === "website-live";
  const counts = analysis?.canonicalCounts;
  const canonicalServices = analysis?.canonicalServices || [];
  const stats = counts;

  const warn = !snapshot
    ? `<div class="wi-warn">Add your website URL in Your Pharmacy report, then run <strong>Scan my website</strong>.</div>`
    : snapshot.source === "no-website"
      ? `<div class="wi-warn">No website URL in your pharmacy profile. Complete Your Pharmacy first.</div>`
      : snapshot.source === "fetch-failed"
        ? `<div class="wi-warn">We could not reach your website. Check the URL and try again.</div>`
        : "";

  const visualBlock = stats && live
    ? `<div class="wi-compare">
<div class="wi-compare-col"><h3 style="margin:0 0 12px;font-size:15px">Current website</h3>
<div class="wi-stat-grid">
<div class="wi-stat"><strong>${stats.contentPages}</strong><span>Content pages found</span></div>
<div class="wi-stat"><strong>${stats.dedicatedServicePages}</strong><span>Dedicated service pages</span></div>
<div class="wi-stat"><strong>${stats.blogArticles}</strong><span>Blogs</span></div>
<div class="wi-stat"><strong>${stats.faqPages}</strong><span>FAQs</span></div>
<div class="wi-stat"><strong>${stats.patientGuides}</strong><span>Guides</span></div>
</div></div>
<div class="wi-diff">+${stats.ecosystemGapPages}<br/><span style="font-size:12px;font-weight:600">pages</span></div>
<div class="wi-compare-col recommended"><h3 style="margin:0 0 12px;font-size:15px">Recommended ecosystem</h3>
<div class="wi-stat-grid">
<div class="wi-stat"><strong>${stats.recommendedEcosystemPages}</strong><span>Recommended ecosystem pages</span></div>
<div class="wi-stat"><strong>${stats.enabledBusinessProfileServices}</strong><span>Enabled Business Profile services</span></div>
<div class="wi-stat"><strong>${stats.recommendedLocalPagesPerService}</strong><span>Local / service</span></div>
</div>
<p style="font-size:12px;color:#64748b;margin:12px 0 0">Based on ${stats.enabledBusinessProfileServices} enabled Business Profile service(s).</p>
</div></div>
<div class="wi-stat-grid">
<div class="wi-stat"><strong>${stats.customerVisibleServices}</strong><span>Customer-visible services</span></div>
<div class="wi-stat"><strong>${stats.diagnosticServiceMatches}</strong><span>Broader diagnostic matches</span></div>
<div class="wi-stat"><strong>${stats.enabledBusinessProfileServices}</strong><span>Enabled Business Profile services</span></div>
</div>`
    : `<p class="ge-lead">Run website analysis to see current vs recommended page counts.</p>`;

  const inventoryRows = analysis
    ? formatCategoryBreakdown(analysis.inventory)
        .map((line) => `<li>${esc(line)}</li>`)
        .join("")
    : "";

  const visibleServiceCards = canonicalServices
    .filter((s) => s.customerVisible)
    .map(
      (s) => `<div class="wi-svc-card">
<strong>${esc(s.serviceName)}</strong> <span style="font-size:11px;color:#059669;font-weight:800">Customer-visible</span>
<div class="wi-svc-meta">Dedicated page: ${s.dedicatedPage ? "Yes" : "No"} · ${esc(coverageStatusLabel(s.coverageStatus))}</div>
<div class="wi-svc-meta">Source: ${s.sourceUrl ? `<a href="${esc(s.sourceUrl)}" target="_blank" rel="noopener">${esc(s.sourceUrl)}</a>` : "—"}</div>
<div class="wi-svc-meta">${esc(s.detectionMethod)} · ${s.confidence}% confidence</div>
</div>`,
    )
    .join("");

  const diagnosticServiceCards = canonicalServices
    .filter((s) => s.diagnosticMatch && !s.customerVisible)
    .slice(0, 12)
    .map(
      (s) => `<div class="wi-svc-card">
<strong>${esc(s.serviceName)}</strong> <span style="font-size:11px;color:#6366f1;font-weight:800">Diagnostic match</span>
<div class="wi-svc-meta">${s.relatedPageCount} related page(s) · ${esc(coverageStatusLabel(s.coverageStatus))}</div>
<div class="wi-svc-meta">Main: ${s.sourceUrl ? `<a href="${esc(s.sourceUrl)}" target="_blank" rel="noopener">View</a>` : "—"}</div>
</div>`,
    )
    .join("");

  const coverageRows = (analysis?.coverage || [])
    .map(
      (c) => `<tr>
<td>${esc(c.serviceName)}</td>
<td>${c.profileEnabled ? "Enabled" : "—"}</td>
<td>${esc(coverageStatusLabel(c.coverageStatus || (c.websiteDetected ? "mentioned-only" : "not-found")))}</td>
<td>${c.supportingContent.blogs} blogs · ${c.supportingContent.faqs} FAQ · ${c.supportingContent.guides} guides · ${c.supportingContent.localPages} local</td>
</tr>`,
    )
    .join("");

  const missing = (analysis?.missingContent || []).map((m) => `<div class="wi-missing"><strong>${esc(m.serviceName)}:</strong> ${esc(m.gap)} — ${esc(m.evidence)}</div>`).join("");
  const opps = (analysis?.opportunities || []).map((o) => `<div class="wi-opp"><strong>${esc(o.serviceName)} — ${esc(o.headline)}</strong>${esc(o.detail)}<br/><span style="font-size:11px;color:#6366f1">${esc(o.evidence)}</span></div>`).join("");

  const tech = analysis?.technical;
  const techBlock = tech
    ? renderPharmacyWebsiteSignals(tech)
    : `<p class="ge-lead">Website signals appear after you scan your website.</p>`;

  const pageTable = (analysis?.pages || [])
    .slice(0, 25)
    .map(
      (p) => `<tr><td>${esc(WEBSITE_PAGE_CATEGORY_LABELS[p.category] || p.category)}</td><td>${esc(p.title || p.path)}</td><td><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.path)}</a></td></tr>`,
    )
    .join("");

  const summaryBlock = analysis?.summaryParagraphs?.length
    ? `<div class="wi-summary">${analysis.summaryParagraphs.map((p) => `<p>${esc(p)}</p>`).join("")}</div>`
    : `<p class="ge-lead">Summary will appear after analysis.</p>`;

  const body = `${warn}
${renderImportEvidencePanel(importSnap)}
<div class="ge-panel">
<h2>What is on your website?</h2>
<p class="ge-lead">A plain-English inventory of ${snapshot?.websiteUrl ? esc(snapshot.websiteUrl) : "your website"} — what exists, what is missing, and what patients might not find.</p>
<button type="button" class="ge-btn ge-btn-primary" id="btnAnalyseWebsite">Scan my website</button>
<span id="analyseStatus" style="margin-left:12px;font-size:13px;color:#64748b"></span>
${snapshot?.generatedAt ? `<span style="margin-left:8px;font-size:12px;color:#64748b">Last analysed: ${esc(new Date(snapshot.generatedAt).toLocaleString("en-GB"))}</span>` : ""}
</div>

<div class="ge-panel">
<h2>Website summary</h2>
${visualBlock}
${summaryBlock}
</div>

<div class="ge-panel">
<h2>Content map</h2>
<p class="ge-lead">How your site is structured today.</p>
${live ? renderFlatContentMap() : renderFlatContentMap()}
</div>

<div class="ge-panel">
<h2>Page inventory</h2>
<p class="ge-lead">Customer-facing content pages only — static assets such as CSS, fonts and favicon files are excluded.</p>
${inventoryRows ? `<ul style="font-size:13px;color:#475569">${inventoryRows}</ul>` : ""}
${pageTable ? `<table class="wi-table"><thead><tr><th>Type</th><th>Title</th><th>Path</th></tr></thead><tbody>${pageTable}</tbody></table>${(analysis?.pages.length || 0) > 25 ? `<p style="font-size:12px;color:#64748b">Showing 25 of ${stats?.contentPages ?? analysis?.pages.length} content pages</p>` : ""}` : `<p class="ge-lead">No pages inventoried yet.</p>`}
</div>

<div class="ge-panel">
<h2>Customer-visible services detected</h2>
${visibleServiceCards || `<p class="ge-lead">No customer-visible service pages were confirmed during import.</p>`}
</div>

<div class="ge-panel">
<h2>Broader diagnostic service matches</h2>
${diagnosticServiceCards || `<p class="ge-lead">No broader diagnostic service matches beyond customer-visible services.</p>`}
</div>

<div class="ge-panel">
<h2>Content inventory</h2>
<div class="wi-stat-grid">
<div class="wi-stat"><strong>${stats?.dedicatedServicePages ?? "—"}</strong><span>Dedicated service pages</span></div>
<div class="wi-stat"><strong>${stats?.blogArticles ?? "—"}</strong><span>Blog articles</span></div>
<div class="wi-stat"><strong>${stats?.patientGuides ?? "—"}</strong><span>Patient guides</span></div>
<div class="wi-stat"><strong>${stats?.faqPages ?? "—"}</strong><span>FAQ pages</span></div>
<div class="wi-stat"><strong>${stats?.locationPages ?? "—"}</strong><span>Location pages</span></div>
<div class="wi-stat"><strong>${stats?.newsArticles ?? "—"}</strong><span>News</span></div>
</div>
</div>

<div class="ge-panel">
<h2>Content coverage</h2>
<p class="ge-lead">Enabled Business Profile services compared against the same canonical website service inventory.</p>
${coverageRows ? `<table class="wi-table"><thead><tr><th>Service</th><th>Profile</th><th>Website status</th><th>Supporting content</th></tr></thead><tbody>${coverageRows}</tbody></table>` : `<p class="ge-lead">Enable services in Your Pharmacy to compare coverage.</p>`}
</div>

<div class="ge-panel">
<h2>Missing content</h2>
${missing || `<p class="ge-lead">No gaps identified yet — or run analysis with enabled services in your profile.</p>`}
</div>

<div class="ge-panel">
<h2>Content opportunities</h2>
${opps || `<p class="ge-lead">Opportunities appear when profile and website data are compared.</p>`}
</div>

<div class="ge-panel">
<h2>What this means for your pharmacy</h2>
<p class="ge-lead">We translate website findings into practical language — no technical jargon.</p>
${techBlock}
</div>

${live && analysis?.understandingComplete ? `<div class="wi-ready">
<h3>Website report complete</h3>
<p>You know what exists, what is missing, and what we can build for patients.</p>
<a class="ge-btn ge-btn-primary" href="/api/growth-engine/growth-plan?slug=${esc(slug)}">Continue to Your Growth Plan →</a>
</div>` : ""}

<script>
const SLUG = ${JSON.stringify(slug)};
document.getElementById('btnAnalyseWebsite')?.addEventListener('click', async ()=>{
  const status = document.getElementById('analyseStatus');
  status.textContent = 'Analysing website…';
  try {
    const res = await fetch('/api/growth-engine/'+SLUG+'/website-intelligence/analyse', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:'{}' });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Failed');
    location.reload();
  } catch(e) { status.textContent = e.message; }
});
</script>`;

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Your Website Report · Growth Engine</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
header{background:linear-gradient(135deg,#005eb8,#003087);color:#fff;padding:16px 24px}
${platformPlatformNavCss()}
${websiteIntelligencePageCss()}
.ge-panel{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:22px 24px;margin-bottom:18px}
.ge-panel h2{margin:0 0 8px;font-size:18px}
.ge-lead{color:#64748b;font-size:14px;margin:0 0 16px;line-height:1.6}
.ge-btn{display:inline-flex;align-items:center;padding:10px 16px;border-radius:9px;font-weight:800;font-size:13px;text-decoration:none;border:1px solid #cbd5e1;color:#1e293b;background:#fff;cursor:pointer}
.ge-btn-primary{background:#4338ca;border-color:#4338ca;color:#fff}
.ge-shell{max-width:1040px;margin:0 auto;padding:24px 20px 80px}
</style>
</head>
<body>
<header>
<h1 style="margin:0;font-size:20px">PharmaConnect Growth Engine</h1>
${renderPharmacyPlatformNavBar({ slug, activeId: "growth-engine" })}
</header>
<div class="ge-shell">
<div class="ge-header-band" style="background:linear-gradient(135deg,#312e81,#4338ca);color:#fff;padding:20px 24px;border-radius:16px;margin-bottom:20px">
<h1 style="margin:0 0 6px;font-size:24px">Your Website Report</h1>
<p style="margin:0;color:#dbeafe;font-size:14px">What your website contains, what is missing, and what it means for patients</p>
</div>
${renderGrowthEngineNavBar(slug, framework, "website-intelligence", { prevUrl: nav.prevUrl, nextUrl: nav.nextUrl, nextLabel: "Continue to Your Growth Plan →" })}
${body}
</div>
</body></html>`;
}
