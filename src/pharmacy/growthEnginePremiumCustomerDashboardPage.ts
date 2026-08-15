/**
 * Premium Customer Dashboard UX V1 — customer-facing presentation (no engine changes).
 */
import {
  buildPremiumCustomerDashboardView,
  type PremiumCustomerDashboardView,
  type PremiumJourneyStep,
  type PremiumReportPreview,
} from "./growthEnginePremiumCustomerDashboard.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export function premiumCustomerDashboardCss(): string {
  return `
.pcd-shell{max-width:1120px;margin:0 auto;padding:28px 24px 64px}
.pcd-header{background:linear-gradient(135deg,#005eb8 0%,#0f766e 100%);border-radius:20px;padding:28px 32px;color:#fff;margin-bottom:28px;box-shadow:0 12px 40px rgba(0,94,184,.18)}
.pcd-header-inner{display:flex;flex-wrap:wrap;gap:24px;justify-content:space-between;align-items:flex-start}
.pcd-welcome h1{margin:0 0 8px;font-size:28px;font-weight:900;letter-spacing:-.02em}
.pcd-welcome p{margin:0;font-size:15px;color:#dbeafe;line-height:1.5;max-width:420px}
.pcd-status{background:rgba(255,255,255,.14);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.22);border-radius:16px;padding:20px 22px;min-width:280px;flex:1;max-width:360px}
.pcd-status-row{display:flex;justify-content:space-between;gap:12px;margin-bottom:10px;font-size:13px}
.pcd-status-row span{color:#bfdbfe}
.pcd-status-row strong{color:#fff;font-weight:800;text-align:right}
.pcd-progress{height:8px;background:rgba(255,255,255,.2);border-radius:999px;overflow:hidden;margin:14px 0 16px}
.pcd-progress-fill{height:100%;background:linear-gradient(90deg,#34d399,#a7f3d0);border-radius:999px;transition:width .4s}
.pcd-cta-main{display:inline-flex;align-items:center;justify-content:center;padding:14px 28px;border-radius:12px;background:#fff;color:#005eb8;font-weight:900;font-size:15px;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.12);transition:transform .15s,box-shadow .15s}
.pcd-cta-main:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,0,0,.16)}
.pcd-section{margin-bottom:32px}
.pcd-section-head{margin-bottom:18px}
.pcd-section-head h2{margin:0 0 4px;font-size:20px;font-weight:900;color:#0f172a}
.pcd-section-head p{margin:0;font-size:14px;color:#64748b}
.pcd-task{background:linear-gradient(135deg,#eff6ff,#ecfdf5);border:1px solid #bfdbfe;border-radius:16px;padding:22px 24px;margin-bottom:28px;display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between}
.pcd-task-text strong{display:block;font-size:17px;font-weight:900;color:#0f172a;margin-bottom:4px}
.pcd-task-text span{font-size:14px;color:#475569}
.pcd-task-badge{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#0369a1;background:#dbeafe;padding:4px 10px;border-radius:999px;margin-bottom:8px;display:inline-block}
.pcd-journey{display:flex;flex-direction:column;gap:12px}
.pcd-step{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 20px;box-shadow:0 4px 16px rgba(15,23,42,.04);transition:border-color .2s,box-shadow .2s}
.pcd-step.complete{border-color:#bbf7d0;background:linear-gradient(90deg,#f0fdf4,#fff)}
.pcd-step.ready{border-color:#93c5fd;box-shadow:0 6px 20px rgba(0,94,184,.08)}
.pcd-step.needs_review{border-color:#fde68a;background:linear-gradient(90deg,#fffbeb,#fff)}
.pcd-step.locked{opacity:.72;background:#f8fafc}
.pcd-step-icon{width:44px;height:44px;border-radius:12px;background:#eff6ff;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
.pcd-step.complete .pcd-step-icon{background:#dcfce7}
.pcd-step-body h3{margin:0 0 4px;font-size:16px;font-weight:800;color:#0f172a}
.pcd-step-body p{margin:0 0 8px;font-size:13px;color:#64748b;line-height:1.45}
.pcd-step-tags{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.pcd-step-num{font-size:11px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em}
.pcd-badge{font-size:10px;font-weight:800;padding:4px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:.04em}
.pcd-badge.complete{background:#dcfce7;color:#166534}
.pcd-badge.ready{background:#dbeafe;color:#1e40af}
.pcd-badge.needs_review{background:#fef3c7;color:#92400e}
.pcd-badge.locked{background:#f1f5f9;color:#64748b}
.pcd-step-action .pcd-btn-step{display:inline-flex;padding:10px 16px;border-radius:10px;font-weight:800;font-size:13px;text-decoration:none;border:1px solid #cbd5e1;color:#334155;background:#fff;white-space:nowrap}
.pcd-step.ready .pcd-step-action .pcd-btn-step,.pcd-step.needs_review .pcd-step-action .pcd-btn-step{background:#005eb8;border-color:#005eb8;color:#fff}
.pcd-step.locked .pcd-step-action .pcd-btn-step{pointer-events:none;opacity:.45}
.pcd-reports{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}
.pcd-report{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:22px 24px;box-shadow:0 6px 24px rgba(15,23,42,.05);display:flex;flex-direction:column;gap:14px}
.pcd-report h3{margin:0;font-size:17px;font-weight:900;color:#0f172a}
.pcd-report-stats{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pcd-report-stat{background:#f8fafc;border-radius:12px;padding:12px 14px}
.pcd-report-stat span{display:block;font-size:10px;font-weight:800;text-transform:uppercase;color:#64748b;letter-spacing:.04em;margin-bottom:4px}
.pcd-report-stat strong{display:block;font-size:15px;font-weight:800;color:#0f172a;line-height:1.3}
.pcd-report-insight{border-top:1px solid #f1f5f9;padding-top:12px}
.pcd-report-insight span{display:block;font-size:10px;font-weight:800;text-transform:uppercase;color:#64748b;margin-bottom:6px}
.pcd-report-insight p{margin:0;font-size:13px;color:#475569;line-height:1.55}
.pcd-report-link{font-size:13px;font-weight:800;color:#005eb8;text-decoration:none;margin-top:auto}
.pcd-report-link:hover{text-decoration:underline}
.pcd-footer{margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8}
.pcd-minimal-nav{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.2)}
.pcd-minimal-nav a{color:#dbeafe;font-size:13px;font-weight:700;text-decoration:none;padding:6px 12px;border-radius:8px;background:rgba(255,255,255,.1)}
.pcd-minimal-nav a:hover{background:rgba(255,255,255,.2);color:#fff}
@media(max-width:720px){.pcd-step{grid-template-columns:1fr;gap:10px}.pcd-step-action{justify-self:start}}
`;
}

function renderJourneyStep(step: PremiumJourneyStep): string {
  const actionHref = step.status === "locked" ? "#" : step.href;
  return `<article class="pcd-step ${esc(step.status)}" aria-label="Step ${step.number}: ${esc(step.title)}">
<div class="pcd-step-icon" aria-hidden="true">${step.icon}</div>
<div class="pcd-step-body">
<span class="pcd-step-num">Step ${step.number}</span>
<h3>${esc(step.title)}</h3>
<p>${esc(step.benefit)}</p>
<div class="pcd-step-tags"><span class="pcd-badge ${esc(step.status)}">${esc(step.statusLabel)}</span></div>
</div>
<div class="pcd-step-action"><a class="pcd-btn-step" href="${esc(actionHref)}">${esc(step.buttonLabel)}</a></div>
</article>`;
}

function renderReportCard(report: PremiumReportPreview): string {
  return `<article class="pcd-report">
<h3>${esc(report.title)}</h3>
<div class="pcd-report-stats">
<div class="pcd-report-stat"><span>${esc(report.stat1Label)}</span><strong>${esc(report.stat1Value)}</strong></div>
<div class="pcd-report-stat"><span>${esc(report.stat2Label)}</span><strong>${esc(report.stat2Value)}</strong></div>
</div>
<div class="pcd-report-insight">
<span>${esc(report.insightLabel)}</span>
<p>${esc(report.insight)}</p>
</div>
<a class="pcd-report-link" href="${esc(report.href)}">Open report →</a>
</article>`;
}

function renderBody(view: PremiumCustomerDashboardView): string {
  return `<div class="pcd-shell">
<section class="pcd-header" aria-label="Welcome">
<div class="pcd-header-inner">
<div class="pcd-welcome">
<h1>Welcome back, ${esc(view.pharmacyName)}</h1>
<p>Your pharmacy growth journey is ready.</p>
</div>
<div class="pcd-status">
<div class="pcd-status-row"><span>Setup progress</span><strong>${view.setupProgressPct}%</strong></div>
<div class="pcd-progress" role="progressbar" aria-valuenow="${view.setupProgressPct}" aria-valuemin="0" aria-valuemax="100"><div class="pcd-progress-fill" style="width:${view.setupProgressPct}%"></div></div>
<div class="pcd-status-row"><span>Current step</span><strong>${esc(view.currentStepLabel)}</strong></div>
<div class="pcd-status-row"><span>Next action</span><strong>${esc(view.nextActionLabel)}</strong></div>
<div class="pcd-status-row"><span>Estimated time</span><strong>~${view.estimatedMinutes} min</strong></div>
<a class="pcd-cta-main" href="${esc(view.primaryCtaHref)}">${esc(view.primaryCtaLabel)} →</a>
</div>
</div>
<nav class="pcd-minimal-nav" aria-label="Quick links">
<a href="/api/growth-engine/business-intelligence?slug=${esc(view.slug)}">Your Pharmacy</a>
<a href="/api/growth-engine/local-market?slug=${esc(view.slug)}">Your Local Market</a>
<a href="/api/growth-engine/website-intelligence?slug=${esc(view.slug)}">Your Website Report</a>
<a href="/api/growth-engine/growth-plan?slug=${esc(view.slug)}">Your Growth Plan</a>
</nav>
</section>

<section class="pcd-task" aria-label="Today's task">
<div class="pcd-task-text">
<span class="pcd-task-badge">Today's task</span>
<strong>${esc(view.todaysTask)}</strong>
<span>${esc(view.todaysTaskDetail)}</span>
</div>
</section>

<section class="pcd-section" aria-label="Growth journey">
<div class="pcd-section-head">
<h2>Your growth journey</h2>
<p>Seven simple steps from setup to publish — one action at a time.</p>
</div>
<div class="pcd-journey">${view.journeySteps.map(renderJourneyStep).join("")}</div>
</section>

<section class="pcd-section" aria-label="Report previews">
<div class="pcd-section-head">
<h2>Your reports at a glance</h2>
<p>Key insights from your local market, website, and growth plan.</p>
</div>
<div class="pcd-reports">${view.reportPreviews.map(renderReportCard).join("")}</div>
</section>

<footer class="pcd-footer">PharmaConnect · Guided pharmacy growth</footer>
</div>`;
}

export function renderPremiumCustomerDashboardPage(slug: string): string {
  const view = buildPremiumCustomerDashboardView(slug);

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Your Dashboard · ${esc(view.pharmacyName)}</title>
<style>
*{box-sizing:border-box}
body{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;background:linear-gradient(180deg,#f0f7ff 0%,#f0f4f8 40%);color:#0f172a;line-height:1.5;min-height:100vh}
${premiumCustomerDashboardCss()}
</style>
</head>
<body data-slug="${esc(slug)}" data-dashboard="premium-customer-v1">
<header style="background:linear-gradient(135deg,#005eb8,#003087);color:#fff;padding:18px 28px">
<p style="margin:0;font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;opacity:.85">PharmaConnect</p>
<h1 style="margin:4px 0 0;font-size:18px;font-weight:800">Your Pharmacy Growth Programme</h1>
</header>
${renderBody(view)}
</body></html>`;
}
