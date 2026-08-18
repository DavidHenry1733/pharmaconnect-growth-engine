/**
 * Growth Engine Framework V1 — step page HTML renderers.
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import type { GrowthEngineCompetitorSnapshot } from "./growthEngineCompetitorModel.ts";
import {
  buildGrowthEngineFramework,
  growthEngineContentPackageUrl,
  growthEngineWizardUrl,
  isCustomerVisibleInStepper,
  type GrowthEngineFramework,
  type GrowthEnginePlanRecommendation,
} from "./growthEngineFrameworkService.ts";
import {
  growthEngineWorkflowCss,
  renderGrowthEngineNavBar,
} from "./growthEngineWorkflowNav.ts";
import {
  buildWizardImportFields,
  buildImportBrandSummary,
  buildLocalIntelPreview,
  countImportSummary,
} from "./pharmacyProfileWizardEnrichment.ts";
import { computeWizardQualityScore } from "./pharmacyProfileWizardScoring.ts";
import { isRequiredProfileComplete } from "./pharmacyProfileFieldClassification.ts";
import { contentPackageGenerated, loadContentPackage, contentPackageReviewed, contentPackageApproved } from "./pharmacyContentPackageService.ts";
import {
  platformPlatformNavCss,
  renderPharmacyPlatformNavBar,
} from "./pharmacyPlatformNav.ts";
import { renderGrowthPlanV1Page } from "./growthEngineGrowthPlanPage.ts";
import { renderPremiumCustomerDashboardPage } from "./growthEnginePremiumCustomerDashboardPage.ts";
import { renderLiveIntegrationProofPage } from "./growthEngineLiveIntegrationProofPage.ts";
import { growthEnginePlatformCopy } from "./growthEnginePlatformCopy.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function pageShell(
  slug: string,
  title: string,
  subtitle: string,
  activeStep: GrowthEngineFramework["currentStep"],
  body: string,
  navOptions?: { prevUrl?: string; nextUrl?: string; nextLabel?: string },
): string {
  const framework = buildGrowthEngineFramework(slug);
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)} · Growth Engine</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
${platformPlatformNavCss()}
${growthEngineWorkflowCss()}
</style>
</head>
<body data-slug="${esc(slug)}">
<header style="background:linear-gradient(135deg,#005eb8,#003087);color:#fff;padding:16px 24px">
<h1 style="margin:0;font-size:20px">PharmaConnect Growth Engine</h1>
${renderPharmacyPlatformNavBar({ slug, activeId: "growth-engine" })}
</header>
<div class="ge-shell">
<div class="ge-header-band">
<h1>${esc(title)}</h1>
<p>${esc(subtitle)}</p>
</div>
${renderGrowthEngineNavBar(slug, framework, activeStep, navOptions)}
${body}
</div>
</body></html>`;
}

function importBadgeClass(status: string): string {
  if (status === "imported") return "imported";
  if (status === "missing") return "missing";
  return "confirmed";
}

import { isNationalGrowthPlatform } from "./growthPlatformResolverService.ts";
import { renderLocalMarketIntelligencePage } from "./growthEngineLocalMarketPage.ts";
import { renderNationalSearchIntelligencePage } from "./nationalSearchIntelligencePage.ts";
import { renderGrowthIntelligenceV1Page } from "./growthEngineGrowthIntelligencePage.ts";
import { renderNationalGrowthIntelligencePage } from "./nationalGrowthIntelligencePage.ts";
import { renderWebsiteIntelligencePage as renderWebsiteIntelligenceHtml } from "./growthEngineWebsiteIntelligencePage.ts";
import { resolveWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceService.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";

function stepNavUrls(slug: string, framework: GrowthEngineFramework, step: number) {
  const prev = framework.steps.find((s) => s.step === step - 1)?.url;
  const next = framework.steps.find((s) => s.step === step + 1)?.url;
  return { prev, next };
}

export function renderGrowthEngineHubPage(slug: string): string {
  const copy = growthEnginePlatformCopy(slug);
  const framework = buildGrowthEngineFramework(slug);
  const steps = framework.steps
    .filter((s) => isCustomerVisibleInStepper(s.id))
    .map(
      (s) =>
        `<a class="ge-card" href="${esc(s.url)}" style="text-decoration:none;color:inherit">
<h3>${esc(s.title)}</h3>
<p style="font-size:13px;color:#64748b;margin:0">${esc(s.summary)}</p>
<p style="font-size:12px;font-weight:800;color:#005eb8;margin:8px 0 0">${s.completionPct}% · ${esc(s.status.replace("_", " "))}</p>
</a>`,
    )
    .join("");
  const nextUrl = framework.nextStep?.url || framework.steps[0].url;
  const body = `<div class="ge-panel">
<h2>${esc(copy.hubTitle)}</h2>
<p class="ge-lead">${esc(copy.hubLead)}</p>
<div class="ge-grid-3">${steps}</div>
<p style="margin-top:20px"><a class="ge-btn ge-btn-primary" href="${esc(nextUrl)}">Continue where you left off →</a></p>
</div>`;
  return pageShell(slug, copy.hubTitle, copy.hubLead, framework.currentStep, body);
}

export function renderBusinessIntelligencePage(slug: string, data: PharmacyProfileData): string {
  const copy = growthEnginePlatformCopy(slug);
  const framework = buildGrowthEngineFramework(slug);
  const quality = computeWizardQualityScore(data);
  const ready = isRequiredProfileComplete(data);
  const fields = buildWizardImportFields(data);
  const summary = countImportSummary(fields);
  const brand = buildImportBrandSummary(data);
  const local = buildLocalIntelPreview(data);
  const rows = fields
    .map(
      (f) => {
        const statusLabel =
          f.status === "review"
            ? "Needs Review"
            : f.status === "imported"
              ? "Imported"
              : f.status === "confirmed"
                ? "Confirmed"
                : f.status === "missing"
                  ? "Not found"
                  : "Manual";
        const badgeClass =
          f.status === "review"
            ? "review"
            : f.status === "imported"
              ? "imported"
              : f.status === "confirmed"
                ? "confirmed"
                : f.status === "missing"
                  ? "missing"
                  : "confirmed";
        return `<div class="ge-import-row"><span>${esc(f.label)}</span><span class="ge-import-badge ${badgeClass}">${esc(statusLabel)}</span></div>`;
      },
    )
    .join("");
  const hero = brand.logoUrl
    ? `<div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;padding:16px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:12px">
${brand.logoUrl ? `<img src="${esc(brand.logoUrl)}" alt="" style="max-height:52px;max-width:140px;border-radius:6px;background:#fff;padding:4px"/>` : ""}
<div><strong style="font-size:18px">${esc(data.pharmacyName || slug)}</strong>
<p style="margin:4px 0 0;font-size:13px;color:#64748b">${brand.servicesDetected ? `${brand.servicesDetected} services detected · ` : ""}${brand.navLinks ? `${brand.navLinks} nav links · ` : ""}${brand.socialCount ? `${brand.socialCount} social profiles` : "Run website import to auto-fill your profile"}</p></div></div>`
    : `<div style="margin-bottom:16px;padding:14px;border:1px dashed #cbd5e1;border-radius:12px;font-size:13px;color:#64748b">Import your website to auto-fill business name, contact, brand and services — minimal typing required.</div>`;
  const localRows = copy.platform === "national"
    ? ""
    : [
    ["Google listing", local.googlePlaceFound ? local.googlePlaceLabel : "Not linked"],
    ["Competitors", local.competitorCount ? String(local.competitorCount) : "Load in wizard"],
    ["GP surgeries", local.gpCount ? String(local.gpCount) : "—"],
    ["Health centres", local.healthCentreCount ? String(local.healthCentreCount) : "—"],
    ["Hospitals", local.hospitalCount ? String(local.hospitalCount) : "—"],
    ["Landmarks", local.landmarkCount ? String(local.landmarkCount) : "—"],
  ]
    .map(([label, val]) => `<div class="ge-import-row"><span>${esc(label)}</span><span style="font-size:13px;font-weight:700;color:#334155">${esc(val)}</span></div>`)
    .join("");
  const { prev, next } = stepNavUrls(slug, framework, 1);
  const body = `<div class="ge-panel">
<h2>Import-first — confirm what we found</h2>
<p class="ge-lead">We populate your profile from your website, Google Places, and existing data. Badges: <strong>Imported</strong> · <strong>Confirmed</strong> · <strong>Needs Review</strong>.</p>
<p class="ge-lead">${summary.imported + summary.review} imported · ${summary.confirmed} confirmed · ${summary.missing} not found · ${quality.overallScore}% complete · ~${quality.estimatedMinutesRemaining} min to finish</p>
${hero}
${ready ? `<p style="color:#059669;font-weight:700">✓ Required profile fields complete</p>` : `<p style="color:#b45309;font-weight:700">${quality.missingRequired.length} required item(s) still needed — mostly confirm imported values</p>`}
<h3 style="font-size:15px;margin:20px 0 10px">Imported business information</h3>
<div style="margin:8px 0">${rows}</div>
${copy.platform === "national" ? `<h3 style="font-size:15px;margin:20px 0 10px">National market</h3><p class="ge-lead">Commercial market is national / UK. Local Google Places comparison is not a prerequisite.</p>` : `<h3 style="font-size:15px;margin:20px 0 10px">Local market preview</h3>
<div style="margin:8px 0">${localRows}</div>`}
<p style="margin-top:20px"><a class="ge-btn ge-btn-primary" href="${esc(growthEngineWizardUrl(slug))}">Review &amp; confirm in wizard →</a>
<a class="ge-btn ge-btn-ghost" href="${esc(growthEngineWizardUrl(slug))}" style="margin-left:8px">Import website</a></p>
</div>`;
  return pageShell(slug, copy.businessStepTitle, copy.businessStepSubtitle, "business-intelligence", body, {
    nextUrl: next,
    nextLabel: `Continue to ${copy.marketStepTitle} →`,
  });
}

export function renderWebsiteIntelligencePage(slug: string): string {
  const framework = buildGrowthEngineFramework(slug);
  const { prev } = stepNavUrls(slug, framework, 3);
  const next = framework.steps.find((s) => s.id === "growth-plan")?.url;
  const snapshot = resolveWebsiteIntelligenceSnapshot(slug);
  const importSnap = readSetupProfile(slug).websiteImportSnapshot;
  return renderWebsiteIntelligenceHtml(slug, snapshot, { prevUrl: prev, nextUrl: next }, importSnap);
}

export function renderLocalMarketPage(slug: string, snapshot: GrowthEngineCompetitorSnapshot | null): string {
  const framework = buildGrowthEngineFramework(slug);
  const { prev, next } = stepNavUrls(slug, framework, 2);
  if (isNationalGrowthPlatform(slug)) {
    return renderNationalSearchIntelligencePage(slug, { prevUrl: prev, nextUrl: next });
  }
  return renderLocalMarketIntelligencePage(slug, snapshot, { prevUrl: prev, nextUrl: next });
}

export function renderSearchIntelligencePage(slug: string): string {
  const framework = buildGrowthEngineFramework(slug);
  const { prev, next } = stepNavUrls(slug, framework, 2);
  return renderNationalSearchIntelligencePage(slug, { prevUrl: prev, nextUrl: next });
}

export function renderGrowthIntelligencePage(slug: string, snapshot: GrowthEngineCompetitorSnapshot | null): string {
  const framework = buildGrowthEngineFramework(slug);
  const { prev, next } = stepNavUrls(slug, framework, 4);
  if (isNationalGrowthPlatform(slug)) {
    return renderNationalGrowthIntelligencePage(slug, { prevUrl: prev, nextUrl: next });
  }
  return renderGrowthIntelligenceV1Page(slug, snapshot, { prevUrl: prev, nextUrl: next });
}

export function renderGrowthPlanPage(slug: string, _plan: GrowthEnginePlanRecommendation): string {
  const framework = buildGrowthEngineFramework(slug);
  const { next } = stepNavUrls(slug, framework, 5);
  const prev = framework.steps.find((s) => s.id === "website-intelligence")?.url;
  return renderGrowthPlanV1Page(slug, { prevUrl: prev, nextUrl: next });
}

export function renderGeneratePage(slug: string, plan: GrowthEnginePlanRecommendation): string {
  const copy = growthEnginePlatformCopy(slug);
  const framework = buildGrowthEngineFramework(slug);
  const { prev, next } = stepNavUrls(slug, framework, 6);
  if (copy.platform === "national") {
    const body = `<div class="ge-panel">
<h2>Campaign strategy</h2>
<p class="ge-lead">This national tenant uses persisted commercial intelligence. Patient-service Campaign Builder is not the next step. National commercial content generation is not yet implemented.</p>
<p style="margin-top:16px"><a class="ge-btn ge-btn-primary" href="/api/growth-engine/growth-plan?slug=${encodeURIComponent(slug)}">Return to Growth Plan →</a></p>
</div>`;
    return pageShell(slug, copy.generateStepTitle, copy.generateStepSubtitle, "generate", body, {
      prevUrl: prev,
      nextUrl: next,
      nextLabel: "Continue to Dashboard →",
    });
  }
  const generated = contentPackageGenerated(slug, plan.primaryServiceId);
  const reviewed = contentPackageReviewed(slug, plan.primaryServiceId);
  const approved = contentPackageApproved(slug, plan.primaryServiceId);
  const pkg = loadContentPackage(slug, plan.primaryServiceId);
  const genUrl = `/api/growth-engine/campaign-builder?slug=${encodeURIComponent(slug)}&step=choose&campaign=${encodeURIComponent(plan.primaryServiceId)}`;
  const reviewUrl = `/api/growth-engine/review-centre?slug=${encodeURIComponent(slug)}&campaign=${encodeURIComponent(plan.primaryServiceId)}`;
  const statusLine = approved
    ? "✓ Approved for launch"
    : reviewed
      ? "✓ Reviewed — awaiting approval"
      : generated
        ? "✓ Content created — ready for review"
        : "Not yet created";
  const body = `<div class="ge-panel">
<h2>Create your content</h2>
<p class="ge-lead">Build patient-facing pages and supporting content for your current Growth Cycle.</p>
<ul style="font-size:14px;color:#475569">
<li><strong>Service:</strong> ${esc(plan.primaryServiceName)}</li>
<li><strong>Estimated pages:</strong> ~${plan.estimatedPages}</li>
<li><strong>Status:</strong> ${statusLine}</li>
${pkg?.generatedAt ? `<li><strong>Last created:</strong> ${esc(new Date(pkg.generatedAt).toLocaleString("en-GB"))}</li>` : ""}
</ul>
<p style="margin-top:16px">
<a class="ge-btn ge-btn-primary" href="${esc(genUrl)}">${generated ? "View / recreate content" : "Create content"} →</a>
${generated ? `<a class="ge-btn ge-btn-ghost" href="${esc(reviewUrl)}" style="margin-left:8px">Review content →</a>` : ""}
</p>
<p style="font-size:13px;color:#64748b;margin-top:12px">After creating content, review and approve it before publishing to your website.</p>
</div>`;
  return pageShell(slug, "Create Content", "Build content for your Growth Cycle", "generate", body, {
    prevUrl: prev,
    nextUrl: next,
    nextLabel: "Continue to Dashboard →",
  });
}

export function renderGrowthEngineDashboardPage(slug: string, _section = "overview"): string {
  return renderPremiumCustomerDashboardPage(slug);
}

export { renderLiveIntegrationProofPage };
