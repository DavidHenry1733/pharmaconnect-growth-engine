/**
 * Review Centre V2 — customer-facing HTML page.
 */
import { growthEngineWorkflowCss } from "./growthEngineWorkflowNav.ts";
import type { ReviewCentreAsset, ReviewCentreView } from "./growthEngineReviewCentreModel.ts";
import { buildReviewCentreView } from "./growthEngineReviewCentreService.ts";
import { buildReviewCentreSourceDebug } from "./pharmacyContentPackageService.ts";
import { isNationalGrowthPlatform } from "./growthPlatformResolverService.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export function reviewCentrePageCss(): string {
  return `${growthEngineWorkflowCss()}
.rc-hero{border:2px solid #005eb8;border-radius:20px;padding:24px 26px;background:linear-gradient(135deg,#eff6ff 0%,#f0fdf4 100%);margin-bottom:22px;box-shadow:0 10px 30px rgba(15,23,42,.06)}
.rc-hero-label{font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#005eb8;margin-bottom:10px}
.rc-hero-name{font-size:26px;font-weight:900;margin:0 0 10px;color:#0f172a;line-height:1.2}
.rc-hero-meta{font-size:14px;color:#475569;margin:0;line-height:1.6}
.rc-stat-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin:18px 0 0}
.rc-stat{background:#fff;border:1px solid #dbeafe;border-radius:14px;padding:14px;text-align:center}
.rc-stat strong{display:block;font-size:28px;font-weight:900;color:#005eb8;line-height:1}
.rc-stat span{display:block;font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;margin-top:6px;letter-spacing:.04em}
.rc-next-action{border-left:4px solid #005eb8;background:#eff6ff;padding:16px 18px;border-radius:0 14px 14px 0;margin-bottom:22px}
.rc-next-action h2{margin:0 0 6px;font-size:17px;font-weight:900;color:#0f172a}
.rc-next-action p{margin:0;font-size:14px;color:#475569;line-height:1.6}
.rc-group{margin-bottom:24px}
.rc-group-head{margin:0 0 12px;font-size:16px;font-weight:900;color:#0f172a;padding-bottom:8px;border-bottom:2px solid #e2e8f0}
.rc-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.rc-card{border:1px solid #e2e8f0;border-radius:16px;padding:18px;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.04)}
.rc-card.approved{border-color:#bbf7d0;background:#f0fdf4}
.rc-card.needs-improvement{border-color:#fed7aa;background:#fffbeb}
.rc-card-title{font-size:16px;font-weight:900;margin:0 0 6px;color:#0f172a}
.rc-card-summary{font-size:13px;color:#475569;line-height:1.5;margin:0 0 12px}
.rc-card-meta{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;font-size:12px}
.rc-type{color:#64748b;font-weight:700}
.rc-status{font-size:10px;font-weight:800;text-transform:uppercase;padding:4px 10px;border-radius:999px}
.rc-status.ready{background:#dbeafe;color:#1e40af}
.rc-status.approved{background:#bbf7d0;color:#065f46}
.rc-status.needs-improvement{background:#fef3c7;color:#92400e}
.rc-improve-msg{font-size:13px;color:#92400e;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 12px;margin-bottom:12px;line-height:1.5}
.rc-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
.rc-btn{display:inline-flex;align-items:center;padding:9px 14px;border-radius:9px;font-weight:800;font-size:13px;text-decoration:none;border:1px solid #cbd5e1;color:#1e293b;background:#fff;cursor:pointer}
.rc-btn-primary{background:#005eb8;border-color:#005eb8;color:#fff}
.rc-btn-ghost{background:#f1f5f9}
.rc-btn:disabled,.rc-btn.disabled{opacity:.55;cursor:not-allowed;pointer-events:none}
.rc-publish-bar{margin-top:28px;padding:22px 24px;background:linear-gradient(135deg,#0f172a,#005eb8);border-radius:16px;color:#fff;text-align:center}
.rc-publish-bar h3{margin:0 0 8px;font-size:18px}
.rc-publish-bar p{margin:0 0 16px;color:#dbeafe;font-size:14px;line-height:1.55}
.rc-publish-bar .rc-btn-primary{background:#fff;color:#005eb8;border-color:#fff}
.rc-empty{font-size:14px;color:#64748b;padding:20px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;line-height:1.6}`;
}

function statusClass(status: ReviewCentreAsset["status"]): string {
  return status.replace(/_/g, "-");
}

function renderAssetCard(slug: string, campaignId: string, asset: ReviewCentreAsset): string {
  const countSuffix = asset.count > 1 ? ` (${asset.count})` : "";
  const extra = [
    asset.commercialService ? `<div><strong>Commercial service:</strong> ${esc(asset.commercialService)}</div>` : "",
    asset.whyRecommended ? `<div><strong>Why it was recommended:</strong> ${esc(asset.whyRecommended)}</div>` : "",
    asset.evidenceSource ? `<div><strong>Evidence source:</strong> ${esc(asset.evidenceSource)}</div>` : "",
    asset.priority ? `<div><strong>Priority:</strong> ${esc(asset.priority)}</div>` : "",
    asset.generationStatus ? `<div><strong>Generation status:</strong> ${esc(asset.generationStatus)}</div>` : "",
    `<div><strong>Review status:</strong> ${esc(asset.reviewStatus || asset.statusLabel)}</div>`,
    `<div><strong>Published:</strong> ${asset.published ? "true" : "false"}</div>`,
    `<div><strong>Indexed:</strong> ${asset.indexed ? "true" : "false"}</div>`,
    asset.gapId ? `<div><strong>Gap:</strong> ${esc(asset.gapId)}</div>` : "",
    asset.recommendationId ? `<div><strong>Recommendation:</strong> ${esc(asset.recommendationId)}</div>` : "",
  ].filter(Boolean).join("");
  return `<article class="rc-card ${statusClass(asset.status)}" data-asset-key="${esc(asset.key)}" data-recommendation="${esc(asset.recommendationId || "")}" data-gap="${esc(asset.gapId || "")}" data-published="${asset.published ? "true" : "false"}" data-indexed="${asset.indexed ? "true" : "false"}" data-ready-for-review="true">
<h3 class="rc-card-title">${esc(asset.title)}${countSuffix}</h3>
<p class="rc-card-summary">${esc(asset.summary)}</p>
<div class="rc-card-meta">
<span class="rc-type">${esc(asset.typeLabel)}</span>
<span class="rc-status ${statusClass(asset.status)}">${esc(asset.statusLabel)}</span>
</div>
${extra ? `<div class="rc-card-summary">${extra}</div>` : ""}
${asset.improveMessage ? `<p class="rc-improve-msg">${esc(asset.improveMessage)}</p>` : ""}
<div class="rc-actions">
${asset.previewUrl ? `<a class="rc-btn rc-btn-ghost" href="${esc(asset.previewUrl)}" target="_blank" rel="noopener">Preview</a>` : ""}
${asset.status === "approved"
  ? `<span class="rc-btn rc-btn-ghost disabled">Approved</span>`
  : `<button type="button" class="rc-btn rc-btn-primary rc-btn-approve" data-asset-key="${esc(asset.key)}">Approve</button>`}
<button type="button" class="rc-btn rc-btn-ghost rc-btn-improve" data-asset-key="${esc(asset.key)}">Improve</button>
</div>
</article>`;
}

function renderGroups(view: ReviewCentreView): string {
  if (!view.groups.length) {
    return `<div class="rc-empty">Your campaign content will appear here once your campaign has been built.</div>`;
  }
  return view.groups
    .map(
      (group) => `<section class="rc-group" data-group="${esc(group.id)}">
<h2 class="rc-group-head">${esc(group.label)}</h2>
<div class="rc-cards">${group.assets.map((a) => renderAssetCard(view.slug, view.campaignId, a)).join("")}</div>
</section>`,
    )
    .join("");
}

function renderPublishBar(view: ReviewCentreView): string {
  const nationalLocked = view.published === false && view.canPublish === false && view.campaignId === "approved-growth-plan";
  const lockedDetail = nationalLocked
    ? "This task stops at Ready for Review. Publish and indexing stay locked."
    : view.canPublish
      ? "All sections are approved. You can publish when you're ready."
      : "Publish stays locked until every section is approved.";
  return `<div class="rc-publish-bar" data-published="${view.published ? "true" : "false"}" data-indexed="${view.indexed ? "true" : "false"}" data-ready-for-review="${view.readyForReview ? "yes" : "no"}">
<h3>${view.canPublish ? "Ready to go live" : "Publish is locked"}</h3>
<p>${esc(lockedDetail)}</p>
${view.canPublish
  ? `<a class="rc-btn rc-btn-primary" href="${esc(view.publishUrl)}">Publish campaign</a>`
  : `<span class="rc-btn rc-btn-primary disabled">Publish campaign</span>`}
</div>`;
}

export function renderReviewCentrePage(slug: string, campaignParam: string | null | undefined): string {
  const view = buildReviewCentreView(slug, campaignParam);
  if (!view) {
    return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"/><title>Review Centre</title></head>
<body><main class="ge-shell"><div class="ge-panel"><h2>Review Centre</h2><p class="ge-lead">Choose a campaign to review your content.</p></div></main></body></html>`;
  }

  const approveUrl = `/api/growth-engine/${esc(slug)}/review-centre/approve`;
  const improveUrl = `/api/growth-engine/${esc(slug)}/review-centre/improve`;
  const pageUrl = `/api/growth-engine/review-centre?slug=${encodeURIComponent(slug)}&campaign=${encodeURIComponent(view.campaignId)}`;
  const sourceDebug = buildReviewCentreSourceDebug(slug, view.campaignId);

  return `<!DOCTYPE html>
<!-- review-source tenant=${esc(sourceDebug.slug)} campaign=${esc(sourceDebug.campaignId)} packagePath=${esc(sourceDebug.packagePath)} ecosystemPath=${esc(sourceDebug.ecosystemPath)} -->
<html lang="en-GB"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Review Centre — ${esc(view.campaignName)}</title>
<style>${reviewCentrePageCss()}</style></head>
<body>
<main class="ge-shell">
<div class="ge-header-band">
<h1>Review Centre</h1>
<p>Review your campaign content before anything goes live.</p>
</div>

<div class="rc-hero" data-ready-for-review="${view.readyForReview ? "yes" : "no"}" data-published="${view.published ? "true" : "false"}" data-indexed="${view.indexed ? "true" : "false"}">
<div class="rc-hero-label">Your campaign</div>
<h2 class="rc-hero-name">${esc(view.campaignName)}</h2>
<p class="rc-hero-meta">${view.totalAssets} pieces of content ready for your review.</p>
<div class="rc-stat-row">
<div class="rc-stat"><strong>${view.readyCount}</strong><span>To review</span></div>
<div class="rc-stat"><strong>${view.approvedCount}</strong><span>Approved</span></div>
<div class="rc-stat"><strong>${view.needsImprovementCount}</strong><span>Needs improvement</span></div>
</div>
</div>

<div class="rc-next-action">
<h2>${esc(view.nextAction.title)}</h2>
<p>${esc(view.nextAction.detail)}</p>
</div>

${view.generated ? renderGroups(view) : `<div class="rc-empty">Your campaign content will appear here once your campaign has been built. <a href="${isNationalGrowthPlatform(slug) ? `/api/growth-engine/generate?slug=${encodeURIComponent(slug)}` : `/api/growth-engine/campaign-builder?slug=${encodeURIComponent(slug)}&step=approval`}">${isNationalGrowthPlatform(slug) ? "Create content" : "Build your campaign"}</a></div>`}

${view.generated ? renderPublishBar(view) : ""}

<div id="rcStatus" style="display:none;margin-top:16px;padding:12px 16px;border-radius:10px;font-size:14px;font-weight:700"></div>
</main>
<script>
var SLUG = ${JSON.stringify(slug)};
var CAMPAIGN = ${JSON.stringify(view.campaignId)};
var PAGE_URL = ${JSON.stringify(pageUrl)};
function showStatus(msg, ok) {
  var el = document.getElementById('rcStatus');
  if (!el) return;
  el.style.display = 'block';
  el.textContent = msg;
  el.style.background = ok ? '#ecfdf5' : '#fef2f2';
  el.style.color = ok ? '#065f46' : '#991b1b';
}
async function postAction(url, assetKey) {
  var res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ campaignId: CAMPAIGN, assetKey: assetKey })
  });
  return res.json();
}
document.querySelectorAll('.rc-btn-approve').forEach(function(btn) {
  btn.onclick = async function() {
    btn.disabled = true;
    var json = await postAction(${JSON.stringify(approveUrl)}, btn.getAttribute('data-asset-key'));
    if (json.ok) {
      showStatus('Section approved.', true);
      setTimeout(function(){ location.href = PAGE_URL; }, 500);
    } else {
      showStatus(json.error || 'Could not approve this section.', false);
      btn.disabled = false;
    }
  };
});
document.querySelectorAll('.rc-btn-improve').forEach(function(btn) {
  btn.onclick = async function() {
    btn.disabled = true;
    var json = await postAction(${JSON.stringify(improveUrl)}, btn.getAttribute('data-asset-key'));
    if (json.ok) {
      showStatus(json.message || "We'll improve this before publishing.", true);
      setTimeout(function(){ location.href = PAGE_URL; }, 700);
    } else {
      showStatus(json.error || 'Could not save your feedback.', false);
      btn.disabled = false;
    }
  };
});
</script>
</body></html>`;
}
