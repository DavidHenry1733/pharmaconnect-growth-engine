/**
 * Campaign Builder UX V2 — premium commercial presentation.
 */
import {
  allCampaignBuilderAssetsApproved,
  buildCampaignBuilderAreaOptions,
  buildCampaignBuilderList,
  buildCampaignBuilderReviewItems,
  campaignBuilderPublishUrl,
  campaignBuilderReadyToPublish,
  campaignBuilderStepUrl,
  loadCampaignBuilderSession,
  ensureCampaignBuilderImageDefaults,
  type CampaignBuilderStep,
} from "./growthEngineCampaignBuilderService.ts";
import { buildCampaignBuilderImagePlan } from "./growthEngineCampaignBuilderImagePlanService.ts";
import { buildCampaignGenerationSummary } from "./growthEngineCampaignBuilderGenerationSummaryService.ts";
import type { CampaignBuilderAssetSelection, CampaignBuilderImageSlotPlan, CampaignBuilderImageStrategy } from "./growthEngineCampaignBuilderModel.ts";
import { DEFAULT_CAMPAIGN_BUILDER_ASSET_SELECTION } from "./growthEngineCampaignBuilderModel.ts";
import {
  CB_UX_BUILD_CAMPAIGN,
  CB_UX_GENERATE_MY_CAMPAIGN,
  CB_UX_CAMPAIGN_INCLUDES,
  CB_UX_CHOOSE_SUBTITLE,
  CB_UX_CHOOSE_TITLE,
  CB_UX_RECOMMENDED_BANNER,
  CB_UX_STEP_LABELS,
  cbUxBuildTimeDisplay,
  cbUxDisplayBadge,
  cbUxExistingCardCopy,
  cbUxMarketingAssetCount,
  cbUxMissingCardCopy,
  cbUxRecommendedWhy,
} from "./growthEngineCampaignBuilderUxV2.ts";
import { contentPackageGenerated } from "./pharmacyContentPackageService.ts";
import { platformPlatformNavCss, renderPharmacyPlatformNavBar } from "./pharmacyPlatformNav.ts";
import {
  campaignRecommendationIntelligenceStyles,
} from "./growthEngineCampaignRecommendationIntelligenceRender.ts";
import {
  campaignExplorerStyles,
  renderCampaignExplorerPanel,
  renderReturnToRecommendedLink,
} from "./growthEngineCampaignExplorerRender.ts";
import { buildCampaignExplorerCatalog } from "./growthEngineCampaignExplorerService.ts";
import { campaignBuilderWizardUrl } from "./growthEngineCampaignBuilderRoutingService.ts";
import { isNationalGrowthPlatform } from "./growthPlatformResolverService.ts";
import { growthEnginePlatformCopy } from "./growthEnginePlatformCopy.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

const STEPS: { id: CampaignBuilderStep; label: string; num: number }[] = [
  { id: "choose", label: CB_UX_STEP_LABELS.choose, num: 1 },
  { id: "areas", label: CB_UX_STEP_LABELS.areas, num: 2 },
  { id: "settings", label: CB_UX_STEP_LABELS.settings, num: 3 },
  { id: "images", label: CB_UX_STEP_LABELS.images, num: 4 },
  { id: "overview", label: CB_UX_STEP_LABELS.overview, num: 5 },
  { id: "approval", label: CB_UX_STEP_LABELS.approval, num: 6 },
  { id: "review", label: CB_UX_STEP_LABELS.review, num: 7 },
];

export function campaignBuilderPageCss(): string {
  return `
.cb-shell{max-width:920px;margin:0 auto;padding:32px 20px 80px}
.cb-hero{background:linear-gradient(135deg,#0f172a 0%,#005eb8 100%);border-radius:24px;padding:32px 28px;color:#fff;margin-bottom:28px;box-shadow:0 20px 50px rgba(15,23,42,.12)}
.cb-hero h1{margin:0 0 10px;font-size:28px;font-weight:900;letter-spacing:-.02em}
.cb-hero p{margin:0;font-size:15px;color:#dbeafe;line-height:1.65;max-width:640px}
.cb-steps{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 28px}
.cb-step{font-size:11px;font-weight:800;padding:8px 14px;border-radius:999px;background:#fff;color:#64748b;border:1px solid #e2e8f0;text-decoration:none}
.cb-step.active{background:#005eb8;color:#fff;border-color:#005eb8}
.cb-step.done{background:#ecfdf5;color:#166534;border-color:#bbf7d0}
.cb-panel{background:#fff;border:1px solid #e8edf3;border-radius:24px;padding:28px;margin-bottom:24px;box-shadow:0 12px 40px rgba(15,23,42,.05)}
.cb-panel h2{margin:0 0 8px;font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-.02em}
.cb-lead{margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.65}
.cb-section{margin-top:28px}
.cb-section h3{margin:0 0 14px;font-size:17px;font-weight:800;color:#0f172a}
.cb-premium{border:1px solid #e2e8f0;border-radius:22px;padding:26px;margin-bottom:20px;background:#fff;box-shadow:0 8px 30px rgba(15,23,42,.04)}
.cb-premium.recommended{border-color:#005eb8;background:linear-gradient(180deg,#f8fbff 0%,#fff 100%)}
.cb-premium-banner{font-size:12px;font-weight:800;color:#005eb8;margin-bottom:10px;letter-spacing:.02em}
.cb-premium-stars{color:#f59e0b;font-size:14px;letter-spacing:2px;margin-bottom:8px}
.cb-premium-kicker{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:6px}
.cb-premium-name{margin:0 0 12px;font-size:26px;font-weight:900;color:#0f172a;letter-spacing:-.02em}
.cb-badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;padding:7px 12px;border-radius:999px;margin-bottom:14px}
.cb-badge.grow{background:#ecfdf5;color:#166534;border:1px solid #bbf7d0}
.cb-badge.new{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}
.cb-copy{margin:0 0 18px;font-size:15px;color:#334155;line-height:1.7}
.cb-includes{margin:0 0 18px;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px 16px}
.cb-includes li{font-size:14px;color:#334155}
.cb-includes li:before{content:"✓ ";color:#059669;font-weight:800}
.cb-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:18px 0 22px}
.cb-stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:16px}
.cb-stat strong{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:6px}
.cb-stat span{font-size:18px;font-weight:900;color:#0f172a}
.cb-primary-cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#005eb8;color:#fff;border:0;border-radius:14px;padding:14px 22px;font-size:15px;font-weight:800;cursor:pointer;text-decoration:none;box-shadow:0 10px 24px rgba(0,94,184,.22)}
.cb-primary-cta:hover{background:#00478a}
.cb-primary-cta:disabled{opacity:.55;cursor:not-allowed}
.cb-primary-cta.ghost{background:#fff;color:#334155;border:1px solid #e2e8f0;box-shadow:none}
.cb-totals{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px;margin:22px 0}
.cb-total-card{background:linear-gradient(180deg,#f8fafc,#fff);border:1px solid #e2e8f0;border-radius:16px;padding:18px 14px;text-align:center}
.cb-total-card strong{display:block;font-size:28px;font-weight:900;color:#0f172a;line-height:1}
.cb-total-card span{display:block;font-size:12px;color:#64748b;font-weight:700;margin-top:6px}
.cb-total-card .cb-icon{font-size:22px;margin-bottom:8px}
.cb-settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:18px}
.cb-setting{border:1px solid #e2e8f0;border-radius:16px;padding:16px;background:#fafbfc;display:flex;gap:12px;align-items:flex-start}
.cb-setting input{margin-top:4px;scale:1.1}
.cb-setting label{font-size:15px;font-weight:700;color:#0f172a;cursor:pointer}
.cb-setting span{display:block;font-size:13px;color:#64748b;font-weight:400;margin-top:4px;line-height:1.5}
.cb-ready{border:2px solid #005eb8;border-radius:24px;padding:32px 28px;background:linear-gradient(180deg,#eff6ff,#fff);text-align:center;margin-top:8px}
.cb-ready h3{margin:0 0 18px;font-size:30px;font-weight:900;color:#0f172a}
.cb-ready-meta{font-size:15px;color:#475569;line-height:1.8;margin:0 0 24px}
.cb-review-item{border:1px solid #e2e8f0;border-radius:18px;padding:20px;margin-bottom:14px;background:#fff}
.cb-review-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px}
.cb-review-head h4{margin:0;font-size:17px;font-weight:800}
.cb-quality{font-size:12px;font-weight:800;padding:6px 12px;border-radius:999px;background:#dcfce7;color:#166534}
.cb-quality.mid{background:#fef3c7;color:#92400e}
.cb-quality.low{background:#fee2e2;color:#991b1b}
.cb-review-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
.cb-banner{background:#ecfdf5;border:1px solid #bbf7d0;border-radius:16px;padding:16px 18px;margin-bottom:18px;font-size:15px;color:#065f46;font-weight:700}
.cb-back{display:inline-block;margin-bottom:18px;font-size:13px;font-weight:700;color:#64748b;text-decoration:none}
.cb-back:hover{color:#005eb8}
.cb-empty{background:#f8fafc;border:1px dashed #cbd5e1;border-radius:16px;padding:22px;font-size:14px;color:#64748b;line-height:1.6}
@media(max-width:720px){.cb-hero h1{font-size:24px}.cb-premium-name{font-size:22px}}
${campaignRecommendationIntelligenceStyles()}
${campaignExplorerStyles()}
`;
}

function wizardUrl(slug: string, step: CampaignBuilderStep, campaignId?: string | null): string {
  const campaign = campaignId ?? loadCampaignBuilderSession(slug).selectedServiceId;
  return campaignBuilderWizardUrl(slug, step, step === "choose" ? null : campaign);
}

function renderStepper(active: CampaignBuilderStep, slug: string, generated: boolean): string {
  const session = loadCampaignBuilderSession(slug);
  const order = STEPS.map((s) => s.id);
  const activeIndex = order.indexOf(active);
  return `<div class="cb-steps">${STEPS.map((s) => {
    const isActive = s.id === active;
    const stepIndex = order.indexOf(s.id);
    const isDone = stepIndex >= 0 && activeIndex > stepIndex;
    const cls = ["cb-step", isActive ? "active" : "", isDone && !isActive ? "done" : ""].filter(Boolean).join(" ");
    const href = s.id === "review" && !generated ? "#" : wizardUrl(slug, s.id);
    return `<a class="${cls}" href="${esc(href)}">${s.num}. ${s.label}</a>`;
  }).join("")}</div>`;
}

function renderIncludesList(): string {
  return `<ul class="cb-includes">${CB_UX_CAMPAIGN_INCLUDES.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

function renderPremiumCard(slug: string, c: ReturnType<typeof buildCampaignBuilderList>[number]): string {
  const isExisting = c.serviceContext === "existing";
  const badgeClass = isExisting ? "grow" : c.serviceContext === "missing" ? "new" : "grow";
  const badge = cbUxDisplayBadge(c);
  const copy = isExisting
    ? cbUxExistingCardCopy(c.serviceName)
    : c.serviceContext === "missing"
      ? cbUxMissingCardCopy()
      : c.reason;
  const assetCount = cbUxMarketingAssetCount(c);
  const buildTime = cbUxBuildTimeDisplay(assetCount);
  const recommendedBlock = c.recommended
    ? `<div class="cb-premium-stars">★★★★★</div>
<div class="cb-premium-banner">${esc(CB_UX_RECOMMENDED_BANNER)}</div>
<p class="cb-copy" style="font-size:14px;margin-top:-6px;margin-bottom:16px">${esc(cbUxRecommendedWhy(c))}</p>`
    : `<div class="cb-premium-kicker">Growth Campaign</div>`;

  return `<div class="cb-premium${c.recommended ? " recommended" : ""}"${c.recommended ? ' id="recommended"' : ""}>
${recommendedBlock}
<h3 class="cb-premium-name">${esc(c.serviceName)}</h3>
<span class="cb-badge ${badgeClass}">🟢 ${esc(badge)}</span>
<p class="cb-copy">${esc(copy)}</p>
<p style="margin:0 0 8px;font-size:13px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Campaign includes</p>
${renderIncludesList()}
<div class="cb-stats">
<div class="cb-stat"><strong>Estimated output</strong><span>${assetCount} marketing assets</span></div>
<div class="cb-stat"><strong>Estimated build time</strong><span>${esc(buildTime)}</span></div>
</div>
<a class="cb-primary-cta" href="${esc(campaignBuilderWizardUrl(slug, "areas", c.serviceId))}">${esc(CB_UX_BUILD_CAMPAIGN)}</a>
</div>`;
}

function renderChooseStep(slug: string): string {
  const campaigns = buildCampaignBuilderList(slug);
  if (!campaigns.length) {
    return `<div class="cb-panel">
<h2>${esc(CB_UX_CHOOSE_TITLE)}</h2>
<p class="cb-lead">We need a little more information from your Growth Plan before we can recommend your first campaign.</p>
<div class="cb-empty">Complete your earlier pharmacy reports, then return here to choose your first growth campaign.</div>
<p style="margin-top:20px"><a class="cb-primary-cta" href="/api/growth-engine/growth-plan?slug=${esc(slug)}">Open Your Growth Plan</a></p>
</div>`;
  }

  const recommended = campaigns.find((c) => c.recommended) || campaigns[0];
  const recommendedCard = renderPremiumCard(slug, recommended);
  const catalog = buildCampaignExplorerCatalog(slug);
  const explorerPanel = catalog ? renderCampaignExplorerPanel(slug, catalog) : "";

  return `<div class="cb-panel">
<h2>${esc(CB_UX_CHOOSE_TITLE)}</h2>
<p class="cb-lead">${esc(CB_UX_CHOOSE_SUBTITLE)}</p>
${recommendedCard}
${explorerPanel}
</div>`;
}

function renderAreasStep(slug: string): string {
  const session = loadCampaignBuilderSession(slug);
  const areaState = buildCampaignBuilderAreaOptions(slug, session);
  const { primaryTown, candidates, discoveryStatus, discoveredAt } = areaState;
  const campaign = session.selectedServiceId || "";
  const wholeTownChecked = session.targetAreaMode === "wholeTown";
  const recommendedChecked = session.targetAreaMode === "recommended";
  const customChecked = session.targetAreaMode === "selected";

  const discoveryStatusText =
    discoveryStatus === "ready"
      ? `Areas ready to select${discoveredAt ? ` · ${new Date(discoveredAt).toLocaleString("en-GB")}` : ""}`
      : discoveryStatus === "failed"
        ? `Unable to discover areas — ${esc(session.areaDiscoveryError || "Retry")}`
        : candidates.length
          ? "Areas ready to select"
          : "Discover nearby areas from your pharmacy location";

  const areaRows = candidates.length
    ? candidates
        .map(
          (c) => `<label class="cb-setting cb-area-row" style="display:block;border:1px solid #e2e8f0;border-radius:16px;padding:16px;margin-bottom:10px">
<div style="display:flex;gap:10px;align-items:flex-start">
<input type="checkbox" class="area-candidate-check" name="targetAreas" value="${esc(c.area)}" data-area="${esc(c.area)}" ${c.selected ? "checked" : ""} ${wholeTownChecked || recommendedChecked ? "disabled" : ""}/>
<div style="flex:1">
<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:6px">
<strong>${esc(c.area)}</strong>
<span class="cb-badge grow">${esc(c.grade || "Medium")}</span>
${c.recommended ? `<span class="cb-badge new">Recommended</span>` : ""}
</div>
<p style="margin:0 0 6px;font-size:14px;color:#334155">${esc(c.reason || c.source)}</p>
${c.distanceLabel ? `<p style="margin:0 0 6px;font-size:13px;color:#64748b">${esc(c.distanceLabel)}</p>` : ""}
${c.evidence?.length ? `<p style="margin:0;font-size:12px;color:#64748b">${esc(c.evidence.slice(0, 3).join(" · "))}</p>` : ""}
</div>
</div>
</label>`,
        )
        .join("")
    : `<p class="cb-empty">Click <strong>Discover Target Areas</strong> to load nearby neighbourhoods and suburbs for ${esc(primaryTown || "your pharmacy town")}.</p>`;

  return `<div class="cb-panel">
<h2>Target Areas</h2>
<p class="cb-lead">Discover nearby areas from your canonical pharmacy location, review priority grades, then choose whole-town, recommended, or custom coverage.</p>
<div class="cb-banner" id="areaDiscoveryStatus">${esc(discoveryStatusText)}</div>
<div style="display:flex;flex-wrap:wrap;gap:10px;margin:0 0 18px">
<button type="button" class="cb-primary-cta" id="btnDiscoverAreas">Discover Target Areas</button>
${candidates.length ? `<button type="button" class="cb-primary-cta ghost" id="btnSelectRecommended">Select all recommended</button>` : ""}
</div>
<form method="post" action="/api/growth-engine/${esc(slug)}/campaign-builder/areas" id="areaSelectionForm">
<input type="hidden" name="campaign" value="${esc(campaign)}"/>
<fieldset style="border:0;padding:0;margin:0 0 18px">
<label class="cb-setting" style="display:flex;gap:10px;align-items:flex-start">
<input type="radio" name="targetAreaMode" value="wholeTown" ${wholeTownChecked ? "checked" : ""}/>
<span><strong>Whole town${primaryTown ? `: ${esc(primaryTown)}` : ""}</strong><span>Use your primary town as the hub area.</span></span>
</label>
<label class="cb-setting" style="display:flex;gap:10px;align-items:flex-start;margin-top:10px">
<input type="radio" name="targetAreaMode" value="recommended" ${recommendedChecked ? "checked" : ""} ${candidates.length ? "" : "disabled"}/>
<span><strong>Recommended areas</strong><span>Use the highest-priority discovered neighbourhoods.</span></span>
</label>
<label class="cb-setting" style="display:flex;gap:10px;align-items:flex-start;margin-top:10px">
<input type="radio" name="targetAreaMode" value="selected" ${customChecked ? "checked" : ""} ${candidates.length ? "" : "disabled"}/>
<span><strong>Custom selection</strong><span>Choose your own mix of discovered areas below.</span></span>
</label>
</fieldset>
<div class="cb-settings-grid" id="areaCandidateList">${areaRows}</div>
<p style="margin-top:24px"><button type="submit" class="cb-primary-cta">Save &amp; Continue →</button></p>
</form>
</div>
<script>
(function(){
  var btn = document.getElementById('btnDiscoverAreas');
  var status = document.getElementById('areaDiscoveryStatus');
  var form = document.getElementById('areaSelectionForm');
  function setStatus(text, ok){ if(status){ status.textContent = text; status.style.background = ok ? '#ecfdf5' : '#fff7ed'; status.style.color = ok ? '#065f46' : '#9a3412'; } }
  btn && (btn.onclick = async function(){
    btn.disabled = true;
    setStatus('Discovering relevant areas…', true);
    try {
      var res = await fetch('/api/growth-engine/${esc(slug)}/campaign-builder/discover-areas', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type':'application/json', 'Accept':'application/json'},
        body: JSON.stringify({ limit: 10 })
      });
      var json = await res.json();
      if (json.ok) { location.reload(); return; }
      setStatus(json.error || 'Unable to discover areas — Retry', false);
      btn.disabled = false;
    } catch (err) {
      setStatus('Unable to discover areas — Retry', false);
      btn.disabled = false;
    }
  });
  document.getElementById('btnSelectRecommended')?.addEventListener('click', function(){
    document.querySelectorAll('input[name="targetAreaMode"]').forEach(function(el){ el.checked = el.value === 'selected'; });
    document.querySelectorAll('.area-candidate-check').forEach(function(el){
      el.disabled = false;
      var row = el.closest('.cb-area-row');
      var recommended = row && row.querySelector('.cb-badge.new');
      el.checked = Boolean(recommended);
    });
  });
  form?.querySelectorAll('input[name="targetAreaMode"]').forEach(function(radio){
    radio.addEventListener('change', function(){
      var mode = radio.value;
      document.querySelectorAll('.area-candidate-check').forEach(function(el){
        el.disabled = mode !== 'selected';
      });
    });
  });
})();
</script>`;
}

function renderSummaryList(items: string[], emptyLabel = "None"): string {
  if (!items.length) return `<p class="cb-lead">${esc(emptyLabel)}</p>`;
  return `<ul style="margin:0;padding-left:20px;line-height:1.7">${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

function renderOverviewStep(slug: string): string {
  const session = ensureCampaignBuilderImageDefaults(slug);
  const summary = buildCampaignGenerationSummary(slug, session);
  const campaign = session.selectedServiceId || "";
  if (!summary) {
    return `<div class="cb-panel"><p class="cb-lead">Select a campaign to see what we will prepare for you.</p><a class="cb-back" href="${esc(wizardUrl(slug, "choose"))}">← Back</a></div>`;
  }

  const assetChecklist = summary.assets
    .map(
      (asset) =>
        `<li style="margin-bottom:6px">${asset.selected ? "✓" : "○"} <strong>${esc(asset.label)}</strong>${asset.selected && asset.count ? ` <span style="color:#64748b">(${asset.count})</span>` : ""}</li>`,
    )
    .join("");

  const targetAreaList =
    summary.targetAreaMode === "wholeTown"
      ? [`Whole town: ${summary.targetAreas[0] || "Primary town"}`]
      : summary.targetAreas;

  const imageAssigned =
    summary.assignedImageSlots.length > 0 ? summary.assignedImageSlots : ["No slots assigned yet"];
  const imageDeferred =
    summary.deferredImageSlots.length > 0
      ? summary.deferredImageSlots
      : ["None — all slots require images or assignment"];

  const websiteMissing =
    summary.websiteMissingOpportunities.length > 0
      ? summary.websiteMissingOpportunities
      : ["No missing content opportunities identified"];

  const localOpportunities =
    summary.localOpportunitySummary.length > 0
      ? summary.localOpportunitySummary
      : ["Local market analysis not yet available"];

  const imagePlanTable = summary.imagePlan ? renderImagePlanTable(slug, summary.imagePlan) : "";

  return `<div class="cb-panel">
<h2>Generation Summary</h2>
<p class="cb-lead">Review exactly what will be generated for your pharmacy before you continue. Nothing has been built yet.</p>

<div class="cb-section">
<h3>Business</h3>
<div class="cb-stats">
<div class="cb-stat"><strong>Pharmacy name</strong><span>${esc(summary.pharmacyName)}</span></div>
<div class="cb-stat"><strong>Website</strong><span>${summary.website !== "Not set" ? `<a href="${esc(summary.website)}" target="_blank" rel="noopener">${esc(summary.website)}</a>` : esc(summary.website)}</span></div>
<div class="cb-stat"><strong>Campaign</strong><span>${esc(summary.campaignName)}</span></div>
</div>
</div>

<div class="cb-section">
<h3>Campaign</h3>
<p style="margin:0 0 6px;font-size:18px;font-weight:900;color:#0f172a">${esc(summary.campaignName)}</p>
<p class="cb-lead">${esc(summary.campaignDescription)}</p>
</div>

<div class="cb-section">
<h3>Target Areas</h3>
<div class="cb-stats">
<div class="cb-stat"><strong>Areas selected</strong><span>${summary.targetAreaCount}</span></div>
</div>
${renderSummaryList(targetAreaList, "No target areas selected")}
</div>

<div class="cb-section">
<h3>Assets</h3>
<p class="cb-lead">Marketing content included in this campaign:</p>
<ul style="margin:0;padding-left:20px;line-height:1.7">${assetChecklist}</ul>
</div>

<div class="cb-section">
<h3>Images</h3>
<div class="cb-stats">
<div class="cb-stat"><strong>Image strategy</strong><span>${esc(imageStrategyLabel(summary.imageStrategy as CampaignBuilderImageStrategy))}</span></div>
<div class="cb-stat"><strong>Uploaded images</strong><span>${summary.uploadedImageCount}</span></div>
<div class="cb-stat"><strong>AI images</strong><span>${summary.aiImageCount}</span></div>
</div>
<p style="margin:12px 0 4px;font-weight:700">Assigned slots</p>
${renderSummaryList(imageAssigned)}
<p style="margin:12px 0 4px;font-weight:700">Deferred slots</p>
${renderSummaryList(imageDeferred, "None deferred")}
${imagePlanTable}
</div>

<div class="cb-section">
<h3>Website Intelligence Summary</h3>
<div class="cb-stats">
<div class="cb-stat"><strong>Pages found</strong><span>${summary.websitePagesFound ?? "Not analysed"}</span></div>
<div class="cb-stat"><strong>Services detected</strong><span>${summary.websiteServicesDetected ?? "Not analysed"}</span></div>
</div>
<p style="margin:12px 0 4px;font-weight:700">Missing opportunities</p>
${renderSummaryList(websiteMissing, "None identified")}
</div>

<div class="cb-section">
<h3>Local Market Summary</h3>
<div class="cb-stats">
<div class="cb-stat"><strong>Competitors analysed</strong><span>${summary.competitorsAnalysed ?? "Not analysed"}</span></div>
<div class="cb-stat"><strong>Healthcare network</strong><span>${esc(summary.healthcareNetworkSummary || "Not analysed")}</span></div>
</div>
<p style="margin:12px 0 4px;font-weight:700">Local opportunity summary</p>
${renderSummaryList(localOpportunities)}
</div>

<div class="cb-section">
<h3>Estimated Output</h3>
<div class="cb-totals">
<div class="cb-total-card"><div class="cb-icon">📄</div><strong>${summary.estimated.servicePages}</strong><span>Service pages</span></div>
<div class="cb-total-card"><div class="cb-icon">📍</div><strong>${summary.estimated.localPages}</strong><span>Local pages</span></div>
<div class="cb-total-card"><div class="cb-icon">📘</div><strong>${summary.estimated.guides}</strong><span>Guides</span></div>
<div class="cb-total-card"><div class="cb-icon">❓</div><strong>${summary.estimated.faqs}</strong><span>FAQs</span></div>
<div class="cb-total-card"><div class="cb-icon">✍️</div><strong>${summary.estimated.blogs}</strong><span>Blogs</span></div>
<div class="cb-total-card"><div class="cb-icon">📣</div><strong>${summary.estimated.gbpPosts}</strong><span>GBP posts</span></div>
<div class="cb-total-card"><div class="cb-icon">📱</div><strong>${summary.estimated.socialPosts}</strong><span>Social posts</span></div>
<div class="cb-total-card"><div class="cb-icon">✉️</div><strong>${summary.estimated.emails}</strong><span>Emails</span></div>
</div>
<div class="cb-stats" style="margin-top:16px">
<div class="cb-stat"><strong>Total assets</strong><span>${summary.estimated.totalAssets}</span></div>
<div class="cb-stat"><strong>Estimated build time</strong><span>${esc(summary.estimated.buildTime)}</span></div>
</div>
</div>

<div class="cb-banner" style="margin-top:24px;background:#eff6ff;border-color:#bfdbfe;color:#1e3a8a">
<p style="margin:0 0 8px;font-weight:700">Before you generate</p>
<p style="margin:0">Nothing will be published automatically.</p>
<p style="margin:8px 0 0">Everything will open in the Review Centre for approval before publishing.</p>
</div>

<p style="margin-top:24px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">
<a class="cb-primary-cta ghost" href="${esc(wizardUrl(slug, "images"))}">← Back</a>
<button type="button" class="cb-primary-cta" id="btnGenerate">${esc(CB_UX_GENERATE_MY_CAMPAIGN)}</button>
</p>
<div id="genStatus" style="margin-top:14px;font-size:14px;display:none"></div>
</div>
<script>
document.getElementById('btnGenerate') && (document.getElementById('btnGenerate').onclick = async function(){
  var btn = document.getElementById('btnGenerate');
  var status = document.getElementById('genStatus');
  btn.disabled = true;
  status.style.display = 'block';
  status.textContent = 'Generating your campaign…';
  status.style.color = '#005eb8';
  var res = await fetch('/api/growth-engine/${esc(slug)}/campaign-builder/generate', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ campaign: ${JSON.stringify(campaign)} })
  });
  var json = await res.json();
  if (json.ok) {
    status.textContent = 'Your campaign is ready. Opening review…';
    status.style.color = '#059669';
    setTimeout(function(){ location.href = json.reviewUrl || '${esc(wizardUrl(slug, "review"))}'; }, 800);
  } else {
    status.textContent = json.error || 'We could not generate your campaign. Please try again.';
    status.style.color = '#991b1b';
    btn.disabled = false;
  }
});
</script>`;
}

function renderSettingOption(
  key: keyof CampaignBuilderAssetSelection,
  label: string,
  hint: string,
  checked: boolean,
  disabled: boolean,
): string {
  return `<div class="cb-setting">
<input type="checkbox" id="${esc(key)}" name="${esc(key)}" value="true" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}/>
<label for="${esc(key)}">${esc(label)}<span>${esc(hint)}</span></label>
</div>`;
}

function renderSettingsStep(slug: string): string {
  const session = loadCampaignBuilderSession(slug);
  const sel = session.mode === "all" ? DEFAULT_CAMPAIGN_BUILDER_ASSET_SELECTION : session.assetSelection;
  const campaign = session.selectedServiceId || "";

  return `<div class="cb-panel">
<h2>Choose What To Include</h2>
<p class="cb-lead">Everything is selected by default. Deselect anything you do not want in this campaign.</p>
<form method="get" action="/api/growth-engine/campaign-builder">
<input type="hidden" name="slug" value="${esc(slug)}"/>
<input type="hidden" name="step" value="images"/>
<input type="hidden" name="campaign" value="${esc(campaign)}"/>
<input type="hidden" name="mode" value="manual"/>
<div class="cb-settings-grid" id="assetGrid">
${renderSettingOption("servicePage", "Service page", "Main patient-facing page", sel.servicePage, false)}
${renderSettingOption("landingPages", "Local area pages", "Local landing pages for nearby areas", sel.landingPages, false)}
${renderSettingOption("guides", "Patient guide", "Patient information content", sel.guides, false)}
${renderSettingOption("faqs", "FAQs", "Answers to common patient questions", sel.faqs, false)}
${renderSettingOption("blogs", "Blog articles", "Supporting articles for your campaign", sel.blogs, false)}
${renderSettingOption("gbp", "Google Business Profile posts", "Posts ready for your profile", sel.gbp, false)}
${renderSettingOption("social", "Social posts", "Facebook, Instagram and X content", sel.social, false)}
${renderSettingOption("emails", "Email campaign", "Patient email content", sel.emails, false)}
${renderSettingOption("images", "AI images", "Visual content for your campaign", sel.images, false)}
</div>
<p style="margin-top:24px"><button type="submit" class="cb-primary-cta">Continue →</button></p>
</form>
</div>`;
}

function imageStrategyLabel(strategy: CampaignBuilderImageStrategy): string {
  switch (strategy) {
    case "existing":
      return "Use Existing Images";
    case "upload":
      return "Upload Pharmacy Images";
    case "ai":
      return "Generate Campaign Images with AI";
    default:
      return "Mixed strategy (existing, uploads and AI)";
  }
}

function renderImagePlanTable(slug: string, plan: NonNullable<ReturnType<typeof buildCampaignBuilderImagePlan>>): string {
  const rows = plan.slots
    .map((slot) => {
      const thumb = slot.previewUrl
        ? `<img src="${esc(slot.previewUrl)}" alt="" style="width:56px;height:40px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0"/>`
        : `<span style="font-size:12px;color:#94a3b8">—</span>`;
      const status =
        slot.approvalState === "deferred"
          ? "Deferred until publishing"
          : slot.approvalState === "approved"
            ? "Approved"
            : slot.approvalState === "pending"
              ? "Pending approval"
              : "Missing";
      return `<tr>
<td>${thumb}</td>
<td><strong>${esc(slot.label)}</strong></td>
<td>${esc(slot.sourceType)}</td>
<td>${esc(slot.tenantStatus)}</td>
<td>${esc(status)}</td>
</tr>`;
    })
    .join("");
  const missing = plan.slots.filter((s) => s.approvalState === "missing").length;
  return `<div class="cb-section" style="margin-top:24px">
<h3>Campaign image plan</h3>
<p class="cb-lead">Strategy: ${esc(imageStrategyLabel(plan.strategy))} · Local pages: ${plan.localImageMode === "shared" ? "One shared image" : "Area-specific"}${missing ? ` · ${missing} slot(s) still missing` : ""}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">
<thead><tr style="text-align:left;border-bottom:1px solid #e2e8f0">
<th style="padding:8px 6px">Preview</th><th style="padding:8px 6px">Slot</th><th style="padding:8px 6px">Source</th><th style="padding:8px 6px">Tenant</th><th style="padding:8px 6px">Status</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
<p style="margin-top:12px"><a class="cb-back" href="${esc(wizardUrl(slug, "images"))}">← Edit image plan</a></p>
</div>`;
}

function renderImageSlotCard(slot: CampaignBuilderImageSlotPlan): string {
  const thumb = slot.previewUrl
    ? `<img src="${esc(slot.previewUrl)}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:12px;border:1px solid #e2e8f0"/>`
    : `<div style="height:120px;border-radius:12px;border:1px dashed #cbd5e1;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:13px">${slot.approvalState === "deferred" ? "Deferred until publishing" : "No image assigned"}</div>`;
  const statusCls =
    slot.approvalState === "approved"
      ? "grow"
      : slot.approvalState === "pending"
        ? "new"
        : slot.approvalState === "deferred"
          ? "new"
          : "new";
  return `<article class="cb-premium" data-slot="${esc(slot.slot)}" style="padding:18px">
<header style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:12px">
<div><strong>${esc(slot.label)}</strong><p style="margin:6px 0 0;font-size:13px;color:#64748b">${esc(slot.hint)}</p></div>
<span class="cb-badge ${statusCls}">${esc(slot.approvalState)}</span>
</header>
${thumb}
<div style="margin-top:12px;font-size:13px;color:#475569;line-height:1.6">
<div><strong>Source:</strong> ${esc(slot.sourceType)} · <strong>Tenant:</strong> ${esc(slot.tenantStatus)}</div>
${slot.mimeType ? `<div><strong>File type:</strong> ${esc(slot.mimeType)}</div>` : ""}
${slot.dimensions ? `<div><strong>Dimensions:</strong> ${esc(slot.dimensions)}</div>` : ""}
</div>
<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px">
<button type="button" class="cb-primary-cta ghost btn-slot-library" data-slot="${esc(slot.slot)}">Browse Library</button>
<button type="button" class="cb-primary-cta ghost btn-slot-upload" data-slot="${esc(slot.slot)}">Upload Own Image</button>
<button type="button" class="cb-primary-cta ghost btn-slot-ai" data-slot="${esc(slot.slot)}">Generate AI Image</button>
<button type="button" class="cb-primary-cta ghost btn-slot-remove" data-slot="${esc(slot.slot)}" ${slot.approvalState === "missing" ? "disabled" : ""}>Remove Assignment</button>
<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#64748b;width:100%"><input type="checkbox" class="defer-slot-check" data-slot="${esc(slot.slot)}" ${slot.deferPublishingNote ? "checked" : ""}/> Campaign image will be added before publishing</label>
</div>
<input type="file" class="slot-upload-input" data-slot="${esc(slot.slot)}" accept=".jpg,.jpeg,.png,.webp,.svg,image/*" style="display:none"/>
</article>`;
}

function renderImagesStep(slug: string): string {
  const session = ensureCampaignBuilderImageDefaults(slug);
  const campaign = session.selectedServiceId || "pharmacy-first";
  const strategy = session.imageStrategy || "mixed";
  const localMode = session.localImageMode || "shared";
  const plan = buildCampaignBuilderImagePlan(slug, session);
  const options: CampaignBuilderImageStrategy[] = ["existing", "upload", "ai", "mixed"];
  const slotCards = plan?.slots.map((slot) => renderImageSlotCard(slot)).join("") || "";

  return `<div class="cb-panel">
<h2>Image Strategy</h2>
<p class="cb-lead">Choose your image strategy, review tenant-safe images, upload or generate missing slots, then confirm your campaign image plan before generation.</p>
<form id="imageStrategyForm">
<fieldset style="border:0;padding:0;margin:0 0 18px">
${options
  .map(
    (value) => `<label class="cb-setting" style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px">
<input type="radio" name="imageStrategy" value="${esc(value)}" ${strategy === value ? "checked" : ""}/>
<span><strong>${esc(imageStrategyLabel(value))}</strong></span>
</label>`,
  )
  .join("")}
</fieldset>
<div class="cb-stats" style="margin-bottom:18px">
<div class="cb-stat"><strong>Local pages</strong><span>
<label style="font-weight:600"><input type="radio" name="localImageMode" value="shared" ${localMode === "shared" ? "checked" : ""}/> One shared local image</label><br/>
<label style="font-weight:600"><input type="radio" name="localImageMode" value="area-specific" ${localMode === "area-specific" ? "checked" : ""}/> Area-specific images (future)</label>
</span></div>
</div>
</form>
<div class="cb-section">
<h3>Required campaign images</h3>
<p class="cb-lead">Accepted formats: JPG, PNG, WebP, SVG. Recommended landscape for hero/support. Do not upload patient-identifiable photographs without consent.</p>
<div id="imageSlotGrid">${slotCards}</div>
</div>
<div id="libraryPicker" class="cb-panel" style="display:none;margin-top:18px">
<h3>Browse image library</h3>
<p class="cb-lead">Tenant Images · Shared Pharmacy Library · AI Images (approved only)</p>
<div id="libraryPickerGrid" class="cb-settings-grid"></div>
</div>
<div id="imageStepStatus" class="cb-banner" style="margin-top:18px"></div>
<p style="margin-top:24px;display:flex;flex-wrap:wrap;gap:10px">
<button type="button" class="cb-primary-cta" id="btnConfirmImagePlan">Confirm image plan &amp; continue →</button>
<a class="cb-primary-cta ghost" href="/api/pharmacy-image-library?slug=${esc(slug)}&service=${esc(campaign)}&campaignId=${esc(campaign)}" target="_blank" rel="noopener">Open full Image Library</a>
</p>
</div>
<script>
(function(){
  var SLUG = ${JSON.stringify(slug)};
  var SERVICE = ${JSON.stringify(campaign)};
  var CAMPAIGN = ${JSON.stringify(campaign)};
  var activeSlot = null;
  var statusEl = document.getElementById('imageStepStatus');
  function setStatus(msg, ok){ if(!statusEl) return; statusEl.textContent = msg; statusEl.style.background = ok ? '#ecfdf5' : '#fff7ed'; statusEl.style.color = ok ? '#065f46' : '#92400e'; }
  function selectedStrategy(){ return document.querySelector('input[name="imageStrategy"]:checked')?.value || 'mixed'; }
  function selectedLocalMode(){ return document.querySelector('input[name="localImageMode"]:checked')?.value || 'shared'; }
  function deferredSlots(){
    var out = {};
    document.querySelectorAll('.defer-slot-check').forEach(function(el){ out[el.getAttribute('data-slot')] = el.checked; });
    return out;
  }
  async function saveStrategyState(){
    await fetch('/api/growth-engine/' + SLUG + '/campaign-builder/images', {
      method:'POST', credentials:'same-origin',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify({ imageStrategy: selectedStrategy(), localImageMode: selectedLocalMode(), deferSlots: deferredSlots() })
    });
  }
  async function loadLibrary(slot){
    activeSlot = slot;
    var picker = document.getElementById('libraryPicker');
    var grid = document.getElementById('libraryPickerGrid');
    picker.style.display = 'block';
    grid.innerHTML = '<p class="cb-lead">Loading image library…</p>';
    var res = await fetch('/api/pharmacy/image-library/' + SLUG + '/data?service=' + encodeURIComponent(SERVICE) + '&campaignId=' + encodeURIComponent(CAMPAIGN), { credentials:'same-origin' });
    var json = await res.json();
    if(!json.ok || !json.dashboard){ grid.innerHTML = '<p class="cb-empty">No library images available.</p>'; return; }
    var dash = json.dashboard;
    var html = '';
    function card(title, preview, meta, assignBody){
      return '<div class="cb-setting"><img src="' + preview + '" alt="" style="width:100%;height:90px;object-fit:cover;border-radius:10px"/><strong style="display:block;margin-top:8px">' + title + '</strong><span style="font-size:12px;color:#64748b">' + meta + '</span><button type="button" class="cb-primary-cta ghost btn-assign-image" data-body="' + encodeURIComponent(JSON.stringify(assignBody)) + '" style="margin-top:8px">Replace Image</button></div>';
    }
    html += '<h4 style="margin:16px 0 8px">Tenant Images</h4>';
    if(!dash.uploads || !dash.uploads.length){ html += '<p class="cb-lead">No tenant uploads yet.</p>'; }
    else {
      html += dash.uploads.map(function(upload){
        var preview = upload.path ? (upload.path.startsWith('/') ? upload.path : '/' + upload.path) : '';
        return card(upload.label || upload.filename, preview, 'Tenant · ' + (upload.category || 'upload') + ' · ' + (upload.mimeType || 'image'), { source:'upload', uploadId: upload.id });
      }).join('');
    }
    html += '<h4 style="margin:16px 0 8px">Shared Pharmacy Library</h4>';
    var shared = (dash.libraryImages || []).filter(function(img){ return img.assetExists; });
    if(!shared.length){ html += '<p class="cb-lead">No shared images for this slot.</p>'; }
    else {
      html += shared.map(function(img){
        var preview = img.assetPath ? (img.assetPath.startsWith('/') ? img.assetPath : '/' + img.assetPath) : '';
        return card(img.libraryRef, preview, 'Shared · ' + img.imagePack, { source:'library', libraryRef: img.libraryRef });
      }).join('');
    }
    html += '<h4 style="margin:16px 0 8px">AI Images</h4>';
    var aiComplete = (dash.aiRequests || []).filter(function(req){ return req.status === 'complete' && req.resultPath; });
    if(!aiComplete.length){ html += '<p class="cb-lead">No approved AI images yet.</p>'; }
    else {
      html += aiComplete.map(function(req){
        var preview = req.resultPath.startsWith('/') ? req.resultPath : '/' + req.resultPath;
        return card('AI · ' + req.slot, preview, 'AI · ' + req.status, { source:'ai', aiRequestId: req.id });
      }).join('');
    }
    grid.innerHTML = html;
    grid.querySelectorAll('.btn-assign-image').forEach(function(btn){
      btn.onclick = async function(){
        var body = JSON.parse(decodeURIComponent(btn.getAttribute('data-body')));
        body.serviceId = SERVICE; body.slot = activeSlot; body.campaignId = CAMPAIGN;
        var res = await fetch('/api/pharmacy/image-library/' + SLUG + '/assign', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
        var json = await res.json();
        if(json.ok){ location.reload(); return; }
        setStatus(json.error || 'Could not assign image', false);
      };
    });
  }
  document.querySelectorAll('.btn-slot-library').forEach(function(btn){ btn.onclick = function(){ loadLibrary(btn.getAttribute('data-slot')); }; });
  document.querySelectorAll('.btn-slot-upload').forEach(function(btn){
    btn.onclick = function(){
      var slot = btn.getAttribute('data-slot');
      var input = document.querySelector('.slot-upload-input[data-slot="' + slot + '"]');
      if(input) input.click();
    };
  });
  document.querySelectorAll('.slot-upload-input').forEach(function(input){
    input.onchange = async function(){
      if(!input.files || !input.files[0]) return;
      var slot = input.getAttribute('data-slot');
      var fd = new FormData();
      fd.append('file', input.files[0]);
      fd.append('serviceId', SERVICE);
      fd.append('slot', slot);
      fd.append('campaignId', CAMPAIGN);
      setStatus('Uploading image…', true);
      var res = await fetch('/api/pharmacy/image-library/' + SLUG + '/upload', { method:'POST', credentials:'same-origin', body: fd });
      var json = await res.json();
      if(json.ok){ location.reload(); return; }
      setStatus(json.error || 'Upload failed', false);
    };
  });
  document.querySelectorAll('.btn-slot-ai').forEach(function(btn){
    btn.onclick = async function(){
      var slot = btn.getAttribute('data-slot');
      setStatus('Creating AI image request for ' + slot + '…', true);
      var res = await fetch('/api/pharmacy/image-library/' + SLUG + '/ai-request', {
        method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ serviceId: SERVICE, slot: slot, category: slot, campaignId: CAMPAIGN, assignToSlot: true })
      });
      var json = await res.json();
      if(json.ok){ setStatus('AI image request created. Approve it in the Image Library when ready, then return here.', true); return; }
      setStatus(json.error || 'AI request failed', false);
    };
  });
  document.querySelectorAll('.btn-slot-remove').forEach(function(btn){
    btn.onclick = async function(){
      var slot = btn.getAttribute('data-slot');
      var res = await fetch('/api/pharmacy/image-library/' + SLUG + '/unassign', {
        method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ serviceId: SERVICE, slot: slot, campaignId: CAMPAIGN })
      });
      var json = await res.json();
      if(json.ok){ location.reload(); return; }
      setStatus(json.error || 'Could not remove assignment', false);
    };
  });
  document.getElementById('btnConfirmImagePlan')?.addEventListener('click', async function(){
    await saveStrategyState();
    var res = await fetch('/api/growth-engine/' + SLUG + '/campaign-builder/images/confirm', {
      method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json','Accept':'application/json'}, body:'{}'
    });
    var json = await res.json();
    if(json.ok){ location.href = json.overviewUrl; return; }
    setStatus(json.error || 'Confirm the image plan before continuing', false);
  });
})();
</script>`;
}

function renderApprovalStep(slug: string): string {
  const session = loadCampaignBuilderSession(slug);
  const serviceId = session.selectedServiceId;
  if (serviceId && contentPackageGenerated(slug, serviceId)) {
    return renderReviewStep(slug);
  }
  return renderOverviewStep(slug);
}

function renderReviewStep(slug: string): string {
  const session = loadCampaignBuilderSession(slug);
  const serviceId = session.selectedServiceId;
  const generated = serviceId ? contentPackageGenerated(slug, serviceId) : false;
  const items = buildCampaignBuilderReviewItems(slug);
  const allApproved = allCampaignBuilderAssetsApproved(slug);
  const canPublish = campaignBuilderReadyToPublish(slug);

  if (!generated) {
    return `<div class="cb-panel">
<h2>Review Your Campaign</h2>
<p class="cb-lead">Your campaign content will appear here once your campaign has been built.</p>
<a class="cb-back" href="${esc(wizardUrl(slug, "approval"))}">← Back to Ready To Build</a>
</div>`;
  }

  const grouped = items
    .map(
      (item) => `<div class="cb-review-item${item.approved ? " approved" : ""}">
<div class="cb-review-head">
<h4>${esc(item.title)}${item.count > 1 ? ` (${item.count})` : ""}</h4>
<span class="cb-quality ${item.qualityScore >= 85 ? "" : item.qualityScore >= 70 ? "mid" : "low"}">Quality Score · ${item.qualityScore}%</span>
</div>
<div class="cb-review-actions">
${item.previewUrl ? `<a class="cb-primary-cta ghost" href="${esc(item.previewUrl)}" target="_blank" rel="noopener">Preview</a>` : ""}
${item.approved
  ? `<span class="cb-primary-cta ghost" style="opacity:.7;cursor:default">✓ Approved</span>`
  : `<form method="post" action="/api/growth-engine/${esc(slug)}/campaign-builder/approve-asset" style="display:inline">
<input type="hidden" name="assetKey" value="${esc(item.key)}"/>
<button type="submit" class="cb-primary-cta">Approve</button>
</form>`}
<form method="post" action="/api/growth-engine/${esc(slug)}/campaign-builder/regenerate" style="display:inline">
<input type="hidden" name="assetKey" value="${esc(item.key)}"/>
<button type="submit" class="cb-primary-cta ghost">Regenerate</button>
</form>
</div>
</div>`,
    )
    .join("");

  const publishBlock =
    allApproved && canPublish && serviceId
      ? `<p style="margin-top:24px"><a class="cb-primary-cta" href="${esc(campaignBuilderPublishUrl(slug, serviceId))}">Publish Campaign →</a></p>`
      : "";

  return `<div class="cb-panel">
<h2>Review Your Campaign</h2>
<p class="cb-lead">Everything has been generated. Review each asset before publishing.</p>
${allApproved ? `<div class="cb-banner">✓ All content approved — your campaign is ready to publish.</div>` : `<div class="cb-banner" style="background:#fff7ed;border-color:#fed7aa;color:#9a3412">Approve each item to unlock publishing.</div>`}
${grouped || "<p class=\"cb-empty\">No content to review yet.</p>"}
${publishBlock}
</div>`;
}

function stepHero(active: CampaignBuilderStep): { title: string; subtitle: string } {
  switch (active) {
    case "areas":
      return {
        title: "Target Areas",
        subtitle: "Choose whole-town coverage or confirmed local areas from your profile and local market.",
      };
    case "settings":
      return {
        title: "Select Assets",
        subtitle: "Choose the marketing content to include in this campaign.",
      };
    case "images":
      return {
        title: "Image Strategy",
        subtitle: "Choose how campaign images should be resolved from your existing image workflow.",
      };
    case "overview":
      return {
        title: "Generation Summary",
        subtitle: "Review your full campaign plan, then generate when you are ready. Nothing is published automatically.",
      };
    case "approval":
      return {
        title: "Generation Summary",
        subtitle: "Review your full campaign plan, then generate when you are ready.",
      };
    case "review":
      return {
        title: "Review Centre",
        subtitle: "Everything has been generated. Review each asset before publishing.",
      };
    default:
      return {
        title: CB_UX_CHOOSE_TITLE,
        subtitle: CB_UX_CHOOSE_SUBTITLE,
      };
  }
}

export function renderCampaignBuilderPage(slug: string, step: CampaignBuilderStep): string {
  if (isNationalGrowthPlatform(slug)) {
    const copy = growthEnginePlatformCopy("national");
    return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>National campaign strategy · Growth Engine</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
.cb-shell{max-width:920px;margin:0 auto;padding:32px 20px 80px}
.cb-panel{background:#fff;border:1px solid #e8edf3;border-radius:24px;padding:28px;box-shadow:0 12px 40px rgba(15,23,42,.05)}
.cb-panel h1{margin:0 0 10px;font-size:24px}
.ge-btn{display:inline-flex;align-items:center;padding:10px 16px;border-radius:9px;font-weight:800;font-size:13px;text-decoration:none;border:1px solid #cbd5e1;color:#1e293b;background:#fff}
.ge-btn-primary{background:#005eb8;border-color:#005eb8;color:#fff}
</style>
</head>
<body data-slug="${esc(slug)}" data-growth-platform="national">
<div class="cb-shell">
<div class="cb-panel">
<h1>National campaign strategy</h1>
<p>${esc(copy.generateStepSubtitle)}</p>
<p>A national recommendation such as pharmacy SEO must not open the NHS / Pharmacy First campaign explorer. Use approved Growth Plan generation instead.</p>
<p style="margin-top:18px"><a class="ge-btn ge-btn-primary" href="/api/growth-engine/generate?slug=${encodeURIComponent(slug)}">Create approved content →</a></p>
<p style="margin-top:10px"><a class="ge-btn" href="/api/growth-engine/growth-plan?slug=${encodeURIComponent(slug)}">Return to national Growth Plan →</a></p>
</div>
</div>
</body></html>`;
  }
  const session = loadCampaignBuilderSession(slug);
  const activeStep = step || session.step || "choose";
  const serviceId = session.selectedServiceId;
  const generated = serviceId ? contentPackageGenerated(slug, serviceId) : false;
  const hero = stepHero(activeStep);

  let body = "";
  switch (activeStep) {
    case "areas":
      body = renderAreasStep(slug);
      break;
    case "settings":
      body = renderSettingsStep(slug);
      break;
    case "images":
      body = renderImagesStep(slug);
      break;
    case "overview":
      body = renderOverviewStep(slug);
      break;
    case "approval":
      body = renderApprovalStep(slug);
      break;
    case "review":
      body = renderReviewStep(slug);
      break;
    default:
      body = renderChooseStep(slug);
  }

  const prevMap: Partial<Record<CampaignBuilderStep, CampaignBuilderStep>> = {
    areas: "choose",
    settings: "areas",
    images: "settings",
    overview: "images",
    approval: "overview",
    review: "overview",
  };
  const prev = prevMap[activeStep];
  const backLink = prev
    ? `<a class="cb-back" href="${esc(wizardUrl(slug, prev))}">← Back</a>`
    : `<a class="cb-back" href="/api/growth-engine/growth-plan?slug=${esc(slug)}">← Your Growth Plan</a>`;

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Campaign Builder · PharmaConnect</title>
<style>
body{font-family:Inter,system-ui,Arial,sans-serif;margin:0;background:#f4f7fb;color:#0f172a;line-height:1.5}
${platformPlatformNavCss()}
${campaignBuilderPageCss()}
</style>
</head>
<body data-slug="${esc(slug)}">
<header style="background:linear-gradient(135deg,#005eb8,#003087);color:#fff;padding:16px 24px">
<h1 style="margin:0;font-size:20px">PharmaConnect</h1>
${renderPharmacyPlatformNavBar({ slug, activeId: "growth-engine" })}
</header>
<div class="cb-shell">
<div class="cb-hero">
<h1>${esc(hero.title)}</h1>
<p>${esc(hero.subtitle)}</p>
</div>
${renderStepper(activeStep, slug, generated)}
${backLink}
${body}
</div>
</body></html>`;
}
