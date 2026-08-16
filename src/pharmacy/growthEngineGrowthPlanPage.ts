/**
 * Growth Engine — Growth Plan Intelligence V1 page renderer (Step 5).
 */
import {
  buildGrowthEngineFramework,
} from "./growthEngineFrameworkService.ts";
import {
  buildGrowthPlanIntelligence,
  type GrowthPlanIntelligence,
} from "./growthEngineCampaignRecommendationEngine.ts";
import type {
  CampaignAlternative,
  CampaignEvidence,
  CampaignReadinessItem,
  GrowthEngineCampaignRecommendation,
} from "./growthEngineCampaignModel.ts";
import { growthEngineWorkflowCss, renderGrowthEngineNavBar } from "./growthEngineWorkflowNav.ts";
import { platformPlatformNavCss, renderPharmacyPlatformNavBar } from "./pharmacyPlatformNav.ts";
import { customerReadinessLabel } from "./growthEngineOperationalActions.ts";
import { readGrowthPlanIntelligenceV1 } from "./growthPlanIntelligenceV1Service.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function customerEvidenceSource(source: string): string {
  const map: Record<string, string> = {
    "Business Profile": "Your Pharmacy",
    "Website Intelligence": "Your Website Report",
    "Local Healthcare Intelligence": "Your Local Market",
    "Growth Intelligence": "Evidence synthesis",
    "Google Business Profile": "Google Business Profile",
    "Service intelligence": "Service intelligence",
  };
  return map[source] || source.replace(/Business Intelligence/g, "Your Pharmacy");
}

function customerCopy(text: string): string {
  return text
    .replace(/Business Intelligence/g, "Your Pharmacy")
    .replace(/Local Healthcare Intelligence/g, "Your Local Market")
    .replace(/Website Intelligence/g, "Your Website Report")
    .replace(/Growth Intelligence/g, "evidence synthesis");
}

export function growthPlanPageCss(): string {
  return `${growthEngineWorkflowCss()}
.gp-hero{background:linear-gradient(135deg,#0f172a,#005eb8);border-radius:16px;padding:24px;color:#fff;margin-bottom:18px}
.gp-hero h2{margin:0 0 10px;font-size:22px;color:#fff}
.gp-hero p{margin:0 0 8px;font-size:14px;color:#dbeafe;line-height:1.55}
.gp-hero strong{color:#fff}
.gp-campaign{border:2px solid #005eb8;border-radius:16px;padding:22px;background:linear-gradient(180deg,#eff6ff,#fff);margin-bottom:16px}
.gp-campaign-name{font-size:26px;font-weight:900;margin:0 0 12px;color:#0f172a}
.gp-badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.gp-pill{font-size:10px;font-weight:800;padding:5px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:.04em}
.gp-pill.priority-high{background:#fef3c7;color:#92400e}
.gp-pill.priority-medium{background:#dbeafe;color:#1e40af}
.gp-pill.priority-low{background:#f1f5f9;color:#475569}
.gp-pill.confidence-high{background:#dcfce7;color:#166534}
.gp-pill.confidence-medium{background:#e0e7ff;color:#3730a3}
.gp-pill.confidence-low{background:#fce7f3;color:#9d174d}
.gp-pill.source{background:#eff6ff;color:#1e40af;text-transform:none;font-size:11px}
.gp-evidence-list{margin:0;padding:0;list-style:none}
.gp-evidence-item{border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:10px;background:#fafbfc}
.gp-evidence-item label{display:block;font-size:10px;font-weight:800;text-transform:uppercase;color:#64748b;margin-bottom:4px}
.gp-evidence-item strong{display:block;font-size:14px;color:#0f172a;margin-bottom:4px}
.gp-evidence-item p{margin:0;font-size:13px;color:#475569;line-height:1.5}
.gp-output-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:12px}
.gp-output-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center}
.gp-output-card strong{display:block;font-size:22px;font-weight:900;color:#0f172a}
.gp-output-card span{font-size:11px;color:#64748b;font-weight:700}
.gp-benefits{margin:0;padding-left:18px;font-size:14px;color:#334155;line-height:1.7}
.gp-alt{border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:10px;background:#fff}
.gp-alt h4{margin:0 0 6px;font-size:15px}
.gp-readiness{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.gp-ready-item{border:1px solid #e2e8f0;border-radius:10px;padding:12px;font-size:13px}
.gp-ready-item.complete{border-color:#bbf7d0;background:#f0fdf4}
.gp-ready-item.incomplete{border-color:#fed7aa;background:#fff7ed}
.gp-ready-item strong{display:block;font-size:13px;margin-bottom:4px}
.gp-ready-item span{font-size:12px;color:#64748b}
.gp-cta-band{margin-top:20px;padding:22px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.gp-empty{background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:18px;font-size:13px;color:#64748b}
.gp-section-note{font-size:13px;color:#64748b;margin:0 0 14px}`;
}

function priorityPill(priority: string): string {
  return `<span class="gp-pill priority-${esc(priority)}">${esc(priority)} priority</span>`;
}

function confidencePill(confidence: string): string {
  return `<span class="gp-pill confidence-${esc(confidence)}">${esc(confidence)} confidence</span>`;
}

function renderExecutiveSummary(summary: GrowthPlanIntelligence["executiveSummary"]): string {
  return `<div class="gp-hero">
<h2>Where you stand</h2>
<p><strong>Current position:</strong> ${esc(customerCopy(summary.currentPosition))}</p>
<p><strong>Primary opportunity:</strong> ${esc(customerCopy(summary.primaryOpportunity))}</p>
<p><strong>Why this campaign:</strong> ${esc(customerCopy(summary.whyRecommended))}</p>
<p><strong>What you gain:</strong> ${esc(customerCopy(summary.estimatedBusinessBenefit))}</p>
</div>`;
}

function renderRecommendedCampaign(campaign: GrowthEngineCampaignRecommendation | null): string {
  if (!campaign) {
    return `<div class="ge-panel">
<h2>Recommended Campaign</h2>
<p class="gp-section-note">We recommend one campaign at a time — only when evidence supports it.</p>
<div class="gp-empty">No evidence-backed campaign is available yet. Complete Your Pharmacy, Your Local Market, and Your Website Report to unlock a recommendation.</div>
</div>`;
  }

  const sources = campaign.evidenceSources
    .map((s) => `<span class="gp-pill source">${esc(customerEvidenceSource(s))}</span>`)
    .join("");

  return `<div class="ge-panel">
<h2>Your recommended campaign</h2>
<p class="gp-section-note">One priority campaign — chosen from your enabled services and supported by real evidence. No fixed service ordering.</p>
<div class="gp-campaign">
<h3 class="gp-campaign-name">${esc(campaign.campaignName)}</h3>
<div class="gp-badges">${priorityPill(campaign.priority)}${confidencePill(campaign.confidence)}</div>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.55"><strong>Reason:</strong> ${esc(campaign.reason)}</p>
<p style="margin:0;font-size:12px;color:#64748b"><strong>Evidence sources:</strong></p>
<div class="gp-badges" style="margin-top:8px">${sources}</div>
</div>
</div>`;
}

function renderWhyCampaign(evidence: CampaignEvidence[]): string {
  const actionable = evidence.filter((e) => e.source !== "Business Profile" || evidence.length === 1);
  const items = actionable.length ? actionable : evidence;

  if (!items.length) {
    return `<div class="ge-panel">
<h2>Why This Campaign?</h2>
<div class="gp-empty">Evidence will appear here once earlier workflow steps are complete.</div>
</div>`;
  }

  return `<div class="ge-panel">
<h2>Why This Campaign?</h2>
<p class="gp-section-note">Every point below comes from your pharmacy profile, website report, local market comparison, and Google Business Profile — nothing is invented.</p>
<ul class="gp-evidence-list">${items
    .map(
      (e) => `<li class="gp-evidence-item">
<label>${esc(customerEvidenceSource(e.source))}</label>
<strong>${esc(customerCopy(e.headline))}</strong>
<p>${esc(customerCopy(e.detail))}</p>
</li>`,
    )
    .join("")}</ul>
</div>`;
}

function renderWhatWillBeBuilt(outputs: GrowthEngineCampaignRecommendation["estimatedOutputs"] | null): string {
  if (!outputs) {
    return `<div class="ge-panel">
<h2>What Will Be Built?</h2>
<div class="gp-empty">Output estimates appear when a campaign is recommended. Counts match the benchmark content generator configuration.</div>
</div>`;
  }

  const cards = [
    { label: "Service Page", count: outputs.servicePage },
    { label: "Cluster Pages", count: outputs.clusterPages },
    { label: "Patient Guides", count: outputs.patientGuides },
    { label: "Blogs", count: outputs.blogs },
    { label: "FAQs", count: outputs.faqs },
    { label: "GBP Posts", count: outputs.gbpPosts },
    { label: "Social Posts", count: outputs.socialPosts },
    { label: "Emails", count: outputs.emails },
    { label: "Videos", count: outputs.videos },
    { label: "Landing Pages", count: outputs.landingPages },
  ];

  return `<div class="ge-panel">
<h2>What Will Be Built?</h2>
<p class="gp-section-note">Estimated content from your Growth Cycle plan — based on your selected services and target areas.</p>
<div class="gp-output-grid">${cards
    .map((c) => `<div class="gp-output-card"><strong>${c.count}</strong><span>${esc(c.label)}</span></div>`)
    .join("")}</div>
</div>`;
}

function renderEstimatedOutcome(benefits: string[]): string {
  return `<div class="ge-panel">
<h2>Estimated Outcome</h2>
<p class="gp-section-note">Business outcomes only — we do not predict search rankings.</p>
<ul class="gp-benefits">${benefits.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
</div>`;
}

function renderAlternatives(alternatives: CampaignAlternative[]): string {
  if (!alternatives.length) {
    return `<div class="ge-panel">
<h2>Alternative Campaigns</h2>
<div class="gp-empty">No alternative campaigns with sufficient evidence right now.</div>
</div>`;
  }

  return `<div class="ge-panel">
<h2>Alternative Campaigns</h2>
<p class="gp-section-note">Up to three alternatives — each with evidence, but not selected as the first priority.</p>
${alternatives
    .map(
      (a) => `<div class="gp-alt">
<h4>${esc(a.campaignName)}</h4>
<div class="gp-badges" style="margin-bottom:8px">${priorityPill(a.priority)}${confidencePill(a.confidence)}</div>
<p style="margin:0 0 6px;font-size:13px"><strong>Reason:</strong> ${esc(a.reason)}</p>
<p style="margin:0;font-size:13px;color:#64748b"><strong>Why not first:</strong> ${esc(a.whyNotFirst)}</p>
</div>`,
    )
    .join("")}
</div>`;
}

function renderReadiness(items: CampaignReadinessItem[], ready: boolean): string {
  return `<div class="ge-panel" id="campaign-readiness">
<h2>Campaign Readiness</h2>
<p class="gp-section-note">${ready ? "All prerequisites are complete — you can generate this campaign." : "Complete any missing steps before generating."}</p>
<div class="gp-readiness">${items
    .map(
      (r) => `<div class="gp-ready-item ${r.complete ? "complete" : "incomplete"}">
<strong>${r.complete ? "✓" : "○"} ${esc(customerReadinessLabel(r.label))}</strong>
<span>${esc(customerCopy(r.detail))}</span>
</div>`,
    )
    .join("")}
<p style="margin-top:14px;font-size:14px;font-weight:800;color:${ready ? "#166534" : "#9a3412"}">${ready ? "Ready to Generate" : "Not ready to generate yet"}</p>
</div>`;
}

function renderGenerateCta(
  slug: string,
  campaign: GrowthEngineCampaignRecommendation | null,
  ready: boolean,
): string {
  const builderUrl = `/api/growth-engine/campaign-builder?slug=${encodeURIComponent(slug)}`;
  const primaryDisabled = !campaign || !ready;
  const primaryAttrs = primaryDisabled ? ' aria-disabled="true" style="opacity:.55;pointer-events:none"' : "";

  return `<div class="ge-panel">
<h2>Build Your Campaign</h2>
<p class="gp-section-note">Use Campaign Builder to see exactly what will be created before generation starts.</p>
${!campaign ? `<div class="gp-empty" style="margin-bottom:14px">Select and complete earlier workflow steps to unlock an evidence-backed campaign recommendation.</div>` : ""}
<div class="gp-cta-band">
<a class="ge-btn ge-btn-primary" href="${esc(builderUrl)}"${primaryAttrs}>Open Campaign Builder →</a>
<a class="ge-btn ge-btn-ghost" href="#campaign-readiness">Review Campaign Details</a>
</div>
${campaign ? `<form method="post" action="/api/growth-engine/${esc(slug)}/acknowledge/growth-plan" style="margin-top:16px">
<button type="submit" class="ge-btn ge-btn-ghost">Approve plan &amp; continue →</button>
</form>` : ""}
</div>`;
}

function renderStrategicGrowthPlan(): string {
  const strategy = readGrowthPlanIntelligenceV1();
  if (!strategy) return "";
  const actions = strategy.actions.slice(0, 5);
  if (!actions.length) return "";
  return `<div class="ge-panel">
<h2>Market Opportunity Plan</h2>
<p class="gp-section-note">These actions come from verified competitor and keyword evidence. They are strategy recommendations only — no pages or content are generated here.</p>
<div class="gp-readiness">${actions.map((action) => `<div class="gp-ready-item complete">
<strong>${esc(action.priority)} · ${esc(action.actionType.replace(/_/g, " "))}</strong>
<span><strong>${esc(action.primaryKeyword)}</strong> — ${esc(action.rationale)} ${action.bestRankingUrl ? `Winning URL: ${esc(action.bestRankingUrl)}` : ""}</span>
</div>`).join("")}</div>
</div>`;
}

export function renderGrowthPlanV1Page(
  slug: string,
  options?: { prevUrl?: string; nextUrl?: string },
): string {
  const framework = buildGrowthEngineFramework(slug);
  const plan = buildGrowthPlanIntelligence(slug);
  const campaign = plan.primaryCampaign;

  const body = `${renderExecutiveSummary(plan.executiveSummary)}
${renderRecommendedCampaign(campaign)}
${renderWhyCampaign(campaign?.evidence || [])}
${renderWhatWillBeBuilt(campaign?.estimatedOutputs || null)}
${renderEstimatedOutcome(campaign?.expectedBenefits || [])}
${renderStrategicGrowthPlan()}
${renderAlternatives(plan.alternatives)}
${renderReadiness(plan.readiness, plan.readyToGenerate)}
${renderGenerateCta(slug, campaign, plan.readyToGenerate)}`;

  const prevUrl = options?.prevUrl || framework.steps.find((s) => s.id === "website-intelligence")?.url;
  const nextUrl = options?.nextUrl || framework.steps.find((s) => s.id === "generate")?.url;

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Your Growth Plan · Growth Engine</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
${platformPlatformNavCss()}
${growthPlanPageCss()}
</style>
</head>
<body data-slug="${esc(slug)}">
<header style="background:linear-gradient(135deg,#005eb8,#003087);color:#fff;padding:16px 24px">
<h1 style="margin:0;font-size:20px">PharmaConnect Growth Engine</h1>
${renderPharmacyPlatformNavBar({ slug, activeId: "growth-engine" })}
</header>
<div class="ge-shell">
<div class="ge-header-band">
<h1>Your Growth Plan</h1>
<p>What you should do next — one evidence-backed campaign with clear rationale.</p>
</div>
${renderGrowthEngineNavBar(slug, framework, "growth-plan", {
  prevUrl: options?.prevUrl || framework.steps.find((s) => s.id === "website-intelligence")?.url,
  nextUrl: options?.nextUrl || framework.steps.find((s) => s.id === "generate")?.url,
  nextLabel: "Continue to Create Content →",
})}
${body}
</div>
</body></html>`;
}
