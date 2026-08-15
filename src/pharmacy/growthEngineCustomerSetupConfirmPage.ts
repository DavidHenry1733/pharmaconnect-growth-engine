/**
 * Customer Setup Import Split V1 — Step 2 review imported details page.
 */
import { buildCustomerSetupConfirmView, formatCustomerSetupSourceLabel, type ConfirmImportSection } from "./growthEngineCustomerSetupConfirmService.ts";
import { customerSetupStartCss } from "./growthEngineCustomerSetupStartPage.ts";
import { renderRetiredSetupTestBanner } from "./growthEngineCustomerSetupTestTenants.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export function customerSetupConfirmCss(): string {
  return `${customerSetupStartCss()}
:root{--confirm-sticky-offset:112px}
html{scroll-padding-bottom:var(--confirm-sticky-offset)}
.css-wrap-wide{max-width:760px;margin:0 auto;padding:40px 24px 24px}
.css-sticky-spacer{height:var(--confirm-sticky-offset);flex-shrink:0}
.css-intro{margin-bottom:28px;text-align:center}
.css-intro h1{margin:0 0 8px;font-size:26px;font-weight:900;color:#0f172a}
.css-intro p{margin:0;font-size:15px;color:#64748b;line-height:1.55}
.css-section{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:22px 24px;margin-bottom:18px;box-shadow:0 8px 28px rgba(15,23,42,.05)}
.css-section-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:16px}
.css-section-head h2{margin:0;font-size:17px;font-weight:900;color:#0f172a}
.css-section-notice{margin:-4px 0 14px;padding:12px 14px;border-radius:12px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:13px;font-weight:600;line-height:1.5}
.css-section-notice.warn{background:#eff6ff;border-color:#bfdbfe;color:#1e40af}
.css-badge{font-size:10px;font-weight:800;text-transform:uppercase;padding:4px 10px;border-radius:999px;letter-spacing:.04em}
.css-badge.imported{background:#dcfce7;color:#166534}
.css-badge.needs_review{background:#fef3c7;color:#92400e}
.css-badge.not_found{background:#f1f5f9;color:#64748b}
.css-rows{display:flex;flex-direction:column;gap:10px}
.css-row{display:grid;grid-template-columns:140px 1fr;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
.css-row:last-child{border-bottom:none}
.css-row-label{font-weight:700;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.03em}
.css-row-value{color:#0f172a;line-height:1.45;word-break:break-word}
.css-use-btn{margin-top:14px;padding:11px 16px;border:1.5px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f172a;font-size:13px;font-weight:800;cursor:pointer}
.css-use-btn:hover{border-color:#005eb8;color:#005eb8}
.css-candidate{border:1.5px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:10px;background:#fafbfc;font-size:13px}
.css-candidate strong{display:block;font-size:14px;margin-bottom:6px}
.css-essentials h2{margin:0 0 6px;font-size:17px;font-weight:900}
.css-essentials p{margin:0 0 16px;font-size:13px;color:#64748b}
.css-field-source{font-size:10px;font-weight:800;text-transform:uppercase;color:#64748b;margin-left:8px;padding:2px 8px;border-radius:999px;background:#f1f5f9}
.css-field-source.google{background:#ede9fe;color:#5b21b6}
.css-field-source.website{background:#dbeafe;color:#1d4ed8}
.css-field-source.manual{background:#ecfdf5;color:#166534}
.css-field-source.action_required{background:#fee2e2;color:#991b1b}
.css-field-evidence{margin:5px 0 0;font-size:11px;color:#475569;line-height:1.4}
.css-field-evidence strong{color:#166534}
.css-field-evidence span{display:block;word-break:break-word;color:#64748b}
.css-brand-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}
.css-brand-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px}
.css-brand-label{font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
.css-logo-preview{min-height:80px;display:flex;align-items:center;justify-content:center;background:#fff;border:1px dashed #cbd5e1;border-radius:10px;padding:10px;margin-bottom:10px}
.css-logo-preview img{max-width:180px;max-height:72px;object-fit:contain}
.css-logo-status{display:inline-flex;align-items:center;border-radius:999px;padding:4px 10px;font-size:10px;font-weight:900;text-transform:uppercase;background:#fee2e2;color:#991b1b}
.css-logo-status.found{background:#dcfce7;color:#166534}
.css-add-action{display:inline-block;margin-top:8px;color:#005eb8;font-size:12px;font-weight:800;text-decoration:none}
.css-colour-list{display:grid;gap:8px}
.css-colour-row{display:flex;align-items:center;gap:10px;font-size:13px;color:#0f172a}
.css-colour-swatch{width:30px;height:30px;border-radius:8px;border:1px solid #cbd5e1;box-shadow:inset 0 0 0 1px rgba(255,255,255,.35)}
.css-colour-meta{display:block;font-size:11px;color:#64748b;margin-top:2px}
.css-summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.css-summary-item{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px;font-size:13px}
.css-summary-item span{display:block;font-size:10px;font-weight:800;text-transform:uppercase;color:#64748b;margin-bottom:4px}
.css-address-evidence{background:#f0fdf4;border-color:#bbf7d0}
.css-address-evidence .css-summary-item{border-color:#bbf7d0}
.css-address-evidence-note{margin:10px 0 0;font-size:12px;color:#166534;line-height:1.45;word-break:break-word}
.css-conflict{border:1px solid #fecaca;background:#fff1f2;border-radius:14px;padding:16px;margin-bottom:14px}
.css-conflict h3{margin:0 0 10px;font-size:15px;color:#991b1b}
.css-conflict-grid{display:grid;gap:8px;font-size:13px;color:#334155}
.css-conflict-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px;font-size:13px}
.css-readiness{margin-bottom:18px;padding:14px 16px;border-radius:14px;border:1px solid #e2e8f0;background:#f8fafc;font-size:13px;color:#334155}
.css-readiness.not-ready{border-color:#fecaca;background:#fff1f2;color:#991b1b}
.css-field-missing label{color:#991b1b}
.css-field-missing input{border-color:#dc2626!important;background:#fef2f2!important}
.css-sticky-bar{position:fixed;bottom:0;left:0;right:0;z-index:200;background:rgba(255,255,255,.97);border-top:1px solid #e2e8f0;box-shadow:0 -10px 40px rgba(15,23,42,.1);padding:14px 20px}
.css-sticky-inner{max-width:760px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.css-sticky-msg{flex:1 1 100%;display:none;margin:0 0 4px;padding:10px 12px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:13px;font-weight:600}
.css-sticky-msg.show{display:block}
.css-back{font-size:13px;font-weight:600;color:#64748b;text-decoration:none;padding:12px 8px}
.css-submit-primary{flex:1;min-width:220px;padding:15px 22px;border:none;border-radius:12px;background:linear-gradient(135deg,#005eb8,#0f766e);color:#fff;font-size:16px;font-weight:900;cursor:pointer}
.css-reset-btn{padding:12px 16px;border:1.5px solid #fecaca;border-radius:12px;background:#fff;color:#991b1b;font-size:13px;font-weight:800;cursor:pointer;text-decoration:none}
.css-reset-btn:hover{background:#fef2f2;border-color:#f87171}
@media(max-width:640px){:root{--confirm-sticky-offset:220px}.css-row{grid-template-columns:1fr;gap:4px}.css-brand-grid,.css-summary-grid{grid-template-columns:1fr}.css-sticky-inner{flex-direction:column;align-items:stretch}.css-submit-primary{width:100%}}
`;
}

function renderSection(section: ConfirmImportSection, useButtonLabel?: string, useButtonId?: string): string {
  const rows = section.rows
    .map(
      (r) => `<div class="css-row"><span class="css-row-label">${esc(r.label)}</span><span class="css-row-value">${esc(r.value)}</span></div>`,
    )
    .join("");
  const notice = section.notice ? `<div class="css-section-notice">${esc(section.notice)}</div>` : "";
  const useBtn =
    useButtonLabel && useButtonId && section.status === "imported"
      ? `<button type="button" class="css-use-btn" id="${esc(useButtonId)}">${esc(useButtonLabel)}</button>`
      : "";

  return `<section class="css-section" aria-labelledby="section-${esc(section.id)}">
<div class="css-section-head">
<h2 id="section-${esc(section.id)}">${esc(section.title)}</h2>
<span class="css-badge ${esc(section.status)}">${esc(section.statusLabel)}</span>
</div>
${notice}
<div class="css-rows">${rows}</div>
${useBtn}
</section>`;
}

function renderCandidateSelector(candidates: import("./pharmacyProfileSchema.ts").CustomerSetupGoogleCandidate[]): string {
  if (!candidates.length) return "";
  return `<div style="margin-top:12px">${candidates
    .map(
      (c) => `<div class="css-candidate">
<strong>${esc(c.businessName)}</strong>
${esc(c.address)} · ${esc(c.postcode || "—")} · ${c.rating != null ? esc(String(c.rating)) + " / 5" : "No rating"}
<button type="button" class="css-use-btn" data-select-google="${esc(c.placeId)}" style="margin-top:8px">This is my pharmacy</button>
</div>`,
    )
    .join("")}</div>`;
}

function renderField(
  id: string,
  label: string,
  field: ReturnType<typeof buildCustomerSetupConfirmView>["fields"][keyof ReturnType<typeof buildCustomerSetupConfirmView>["fields"]],
): string {
  const value = field.value;
  const source = field.source;
  const resolvedSource = source || (value ? "manual" : "action_required");
  const sourceClass = `css-field-source ${esc(resolvedSource)}`;
  const sourceLabel =
    resolvedSource === "action_required"
      ? "Action Required"
      : formatCustomerSetupSourceLabel(resolvedSource as import("./pharmacyProfileSchema.ts").CustomerSetupFieldSource | "");
  const evidence = field.evidenceLabel || field.sourceUrl || field.matchedSnippet
    ? `<div class="css-field-evidence"><strong>${esc(field.evidenceLabel || "Verified from website")}</strong>${field.sourceUrl ? `<span>Source: ${esc(field.sourceUrl)}</span>` : ""}${field.matchedSnippet ? `<span>Snippet: ${esc(field.matchedSnippet)}</span>` : ""}</div>`
    : "";
  return `<div class="css-field" data-field="${esc(id)}">
<label for="${esc(id)}">${esc(label)}<span class="${sourceClass}" id="${esc(id)}Source">${esc(sourceLabel)}</span></label>
<input type="text" id="${esc(id)}" name="${esc(id)}" value="${esc(value)}" autocomplete="off"/>
${evidence}
</div>`;
}

function renderWebsiteBrandPanel(view: ReturnType<typeof buildCustomerSetupConfirmView>): string {
  const brand = view.websiteBrandSummary;
  if (!brand.visible) return "";
  const colours = [
    ["Primary colour", brand.primaryColor],
    ["Secondary colour", brand.secondaryColor],
    ["Accent colour", brand.accentColor],
  ].filter(([, value]) => value);
  const logoStatusClass = brand.logoStatus === "FOUND" ? "found" : "missing";
  const logoPreview = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="Imported website logo"/>`
    : `<span style="color:#64748b;font-weight:800">No logo imported</span>`;
  const colourRows = colours.length
    ? colours
        .map(
          ([label, value]) => `<div class="css-colour-row"><span class="css-colour-swatch" style="background:${esc(value)}"></span><div><strong>${esc(value)}</strong><span class="css-colour-meta">${esc(label)} · ${esc(brand.colourSource || "website import")}</span></div></div>`,
        )
        .join("")
    : `<div class="css-colour-row"><span class="css-colour-meta">No brand colours imported.</span></div>`;
  return `<section class="css-section" aria-labelledby="website-brand-heading">
<div class="css-section-head">
<h2 id="website-brand-heading">Imported Brand Assets</h2>
<span class="css-badge imported">Website Import</span>
</div>
<div class="css-brand-grid">
<div class="css-brand-card">
<div class="css-brand-label">Logo Preview</div>
<div class="css-logo-preview">${logoPreview}</div>
<span class="css-logo-status ${logoStatusClass}">${esc(brand.logoStatus)}</span>
<div class="css-colour-meta">Source: ${esc(brand.logoUrl || "No logo URL found")}</div>
${brand.logoUrl ? "" : `<a class="css-add-action" href="#logoUrl">Upload or add logo</a>`}
</div>
<div class="css-brand-card">
<div class="css-brand-label">Brand Colour Preview</div>
<div class="css-colour-list">${colourRows}</div>
</div>
</div>
<div class="css-brand-card">
<div class="css-brand-label">Brand Summary</div>
<div class="css-summary-grid">
<div class="css-summary-item"><span>Website title</span>${esc(brand.websiteTitle || "—")}</div>
<div class="css-summary-item"><span>Business name</span>${esc(brand.businessName || "—")}</div>
<div class="css-summary-item"><span>Logo status</span>${esc(brand.logoStatus)}</div>
<div class="css-summary-item"><span>Primary colour</span>${esc(brand.primaryColor || "—")}</div>
<div class="css-summary-item"><span>Secondary colour</span>${esc(brand.secondaryColor || "—")}</div>
<div class="css-summary-item"><span>CMS</span>${esc(brand.cms || "—")}</div>
<div class="css-summary-item"><span>Analytics</span>${esc(brand.analytics || "—")}</div>
<div class="css-summary-item"><span>Header detected</span>${brand.headerDetected ? "YES" : "NO"}</div>
<div class="css-summary-item"><span>Footer detected</span>${brand.footerDetected ? "YES" : "NO"}</div>
</div>
</div>
</section>`;
}

function renderBusinessDetailConflictsPanel(view: ReturnType<typeof buildCustomerSetupConfirmView>): string {
  if (!view.businessDetailConflicts.length) return "";
  const rows = view.businessDetailConflicts
    .map((conflict) => {
      const fieldId = conflict.field.replace(/[^a-z0-9]+/gi, "-");
      return `<div class="css-conflict" data-conflict-field="${esc(conflict.field)}">
<h3>${esc(conflict.label)} conflict</h3>
<div class="css-conflict-grid">
<div><strong>Canonical:</strong> ${esc(conflict.canonicalValue)}</div>
<div><strong>Imported:</strong> ${esc(conflict.importedValue)}</div>
<div><strong>Source:</strong> ${esc(conflict.source || "—")}</div>
<div><strong>Confidence:</strong> ${esc(String(conflict.confidence))}%</div>
<div><strong>Difference:</strong> ${esc(conflict.difference)}</div>
<div><strong>Recommended:</strong> ${esc(conflict.recommendedAction.replace(/-/g, " "))}</div>
</div>
<div class="css-conflict-actions">
<label><input type="radio" name="resolution-${esc(fieldId)}" value="keep-canonical" form="confirmForm"/> Keep canonical</label>
<label><input type="radio" name="resolution-${esc(fieldId)}" value="use-imported" form="confirmForm" checked/> Use imported</label>
<label><input type="radio" name="resolution-${esc(fieldId)}" value="edit-manually" form="confirmForm"/> Edit manually</label>
</div>
${conflict.field === "displayAddress" ? `<div class="css-field" style="margin-top:12px"><label for="displayAddress">Manual display address</label><input id="displayAddress" name="displayAddress" type="text" form="confirmForm" value="${esc(conflict.importedValue)}"/></div>` : ""}
</div>`;
    })
    .join("");
  return `<section class="css-section" aria-labelledby="conflicts-heading">
<h2 id="conflicts-heading">Business Detail Conflicts</h2>
<p>Review imported evidence against canonical profile values before continuing.</p>
${rows}
</section>`;
}

function renderImportReadinessBanner(view: ReturnType<typeof buildCustomerSetupConfirmView>): string {
  const cls = view.commercialReady ? "css-readiness" : "css-readiness not-ready";
  const gaps =
    view.unresolvedImportantFields.length > 0
      ? `<ul>${view.unresolvedImportantFields.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
      : "<p>All important imported fields are confirmed.</p>";
  return `<div class="${cls}">
<strong>Import completeness: ${esc(String(view.importCompletenessScore))}% · Commercial-ready: ${view.commercialReady ? "YES" : "NO"}</strong>
${gaps}
</div>`;
}
function renderRegulatoryFormFields(view: ReturnType<typeof buildCustomerSetupConfirmView>): string {
  const candidate = view.gphcCandidate;
  if (!candidate) return "";
  const f = view.fields.gphcNumber;
  return `<div class="css-candidate" style="margin-top:18px">
<strong>Confirm GPhC regulatory candidate</strong>
<div class="css-row"><span class="css-row-label">Detected value</span><span class="css-row-value">${esc(candidate.detectedValue)}</span></div>
<div class="css-row"><span class="css-row-label">Source page</span><span class="css-row-value">${esc(candidate.sourceUrl)}</span></div>
<div class="css-row"><span class="css-row-label">Source context</span><span class="css-row-value">${esc(candidate.sourceSelector || candidate.sourceContext || "—")}</span></div>
<div class="css-row"><span class="css-row-label">Status</span><span class="css-row-value">${esc(candidate.verificationStatus)}</span></div>
</div>
${renderField("gphcNumber", "GPhC registration number", f)}
<div class="css-field">
<label>GPhC confirmation action</label>
<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
<label><input type="radio" name="gphcConfirmation" value="confirm" checked form="confirmForm"/> Confirm detected value</label>
<label><input type="radio" name="gphcConfirmation" value="reject" form="confirmForm"/> Reject candidate</label>
<label><input type="radio" name="gphcConfirmation" value="" form="confirmForm"/> Correct manually in field above</label>
</div>
</div>`;
}

function renderWebsiteAddressEvidencePanel(view: ReturnType<typeof buildCustomerSetupConfirmView>): string {
  const evidence = view.websiteAddressEvidence;
  if (!evidence.visible) return "";
  return `<section class="css-section css-address-evidence" aria-labelledby="website-address-heading">
<div class="css-section-head">
<h2 id="website-address-heading">Website Address Evidence</h2>
<span class="css-badge imported">Verified from website</span>
</div>
<div class="css-summary-grid">
<div class="css-summary-item"><span>Imported display address</span>${esc(evidence.importedDisplayAddress || evidence.addressLine1)}</div>
<div class="css-summary-item"><span>Structured line 1</span>${esc(evidence.addressLine1)}</div>
<div class="css-summary-item"><span>Town</span>${esc(evidence.town)}</div>
<div class="css-summary-item"><span>Postcode</span>${esc(evidence.postcode)}</div>
<div class="css-summary-item"><span>Confidence</span>${esc(String(evidence.confidence))}% · ${esc(evidence.sourceType)}</div>
</div>
<div class="css-address-evidence-note"><strong>Source:</strong> ${esc(evidence.sourceUrl)}</div>
<div class="css-address-evidence-note"><strong>Snippet:</strong> ${esc(evidence.matchedSnippet)}</div>
</section>`;
}

export function renderCustomerSetupConfirmPage(slug: string): string {
  const view = buildCustomerSetupConfirmView(slug);
  const f = view.fields;
  const setupConfirmUrl = `/api/growth-engine/${encodeURIComponent(slug)}/setup-confirm`;
  const googleSelectUrl = `/api/growth-engine/${encodeURIComponent(slug)}/setup-google-select`;

  const nationalBanner = view.nationalWebsiteWarning
    ? `<div class="css-section-notice warn">This appears to be a national or multi-location website. Please confirm the local branch Google listing.</div>`
    : "";

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Review Imported Details · PharmaConnect</title>
<style>${customerSetupConfirmCss()}</style>
</head>
<body data-page="customer-setup-confirm" data-slug="${esc(slug)}">
<div class="css-wrap-wide">
${renderRetiredSetupTestBanner(slug)}
<div class="css-intro">
<h1>Review Imported Details</h1>
<p>Google Profile and website imports are separate. Nothing is applied until you confirm.</p>
</div>
${nationalBanner}
${renderSection(view.googleSection, "Use Google Profile Details", "useGoogleBtn")}
${view.googleSelectorVisible ? renderCandidateSelector(view.googleCandidates) : ""}
${renderSection(view.websiteSection, "Use Website Details", "useWebsiteBtn")}
${renderWebsiteBrandPanel(view)}
${renderImportReadinessBanner(view)}
${renderWebsiteAddressEvidencePanel(view)}
${renderBusinessDetailConflictsPanel(view)}
<section class="css-section css-essentials" aria-labelledby="essentials-heading">
<h2 id="essentials-heading">Confirm Pharmacy Details</h2>
<p>Edit if needed. Each field shows where the value came from.</p>
<form id="confirmForm" data-setup-confirm-url="${esc(setupConfirmUrl)}" novalidate>
${renderField("pharmacyName", "Pharmacy name", f.pharmacyName)}
${renderField("website", "Website", f.website)}
${renderField("phone", "Phone", f.phone)}
${renderField("email", "Email", f.email)}
${renderField("address", "Address", f.address)}
${renderField("town", "Town", f.town)}
${renderField("postcode", "Postcode", f.postcode)}
${view.gphcCandidate && view.gphcCandidate.verificationStatus !== "confirmed" ? renderRegulatoryFormFields(view) : ""}
</form>
</section>
</div>
<div class="css-sticky-spacer" id="stickySpacer" aria-hidden="true"></div>
<div class="css-sticky-bar" role="region" aria-label="Confirm actions">
<div class="css-sticky-inner">
<div id="formError" class="css-sticky-msg" role="alert">Please complete the highlighted details before continuing.</div>
<a class="css-back" href="${esc(view.setupStartUrl)}">← Back to setup</a>
<button type="button" class="css-reset-btn" id="resetImportsBtn">Reset imported data</button>
<button type="submit" form="confirmForm" class="css-submit-primary" id="confirmBtn">Confirm and Continue</button>
</div>
</div>
<script>
(function(){
  var SLUG = ${JSON.stringify(slug)};
  var SETUP_CONFIRM_URL = ${JSON.stringify(setupConfirmUrl)};
  var RESET_IMPORTS_URL = '/api/growth-engine/'+encodeURIComponent(SLUG)+'/setup-reset-imports';
  var GOOGLE_SELECT_URL = ${JSON.stringify(googleSelectUrl)};
  var GOOGLE_DRAFT = ${JSON.stringify(view.googleDraft)};
  var WEBSITE_DRAFT = ${JSON.stringify(view.websiteDraft)};
  var SOURCE_LABELS = { google: 'Google Import', website: 'Website Import', manual: 'Manual', action_required: 'Action Required' };
  var fieldSources = ${JSON.stringify({
    pharmacyName: f.pharmacyName.source,
    website: f.website.source,
    phone: f.phone.source,
    email: f.email.source,
    address: f.address.source,
    town: f.town.source,
    postcode: f.postcode.source,
  })};

  var form = document.getElementById('confirmForm');
  var errEl = document.getElementById('formError');
  var btn = document.getElementById('confirmBtn');
  var stickyBar = document.querySelector('.css-sticky-bar');
  var stickySpacer = document.getElementById('stickySpacer');
  var REQUIRED = ['pharmacyName', 'website', 'town', 'postcode'];

  function syncConfirmStickyOffset(){
    if (!stickyBar || !stickySpacer) return;
    var offset = Math.ceil(stickyBar.getBoundingClientRect().height) + 16;
    document.documentElement.style.setProperty('--confirm-sticky-offset', offset + 'px');
    stickySpacer.style.height = offset + 'px';
  }
  syncConfirmStickyOffset();
  window.addEventListener('resize', syncConfirmStickyOffset);
  if (window.ResizeObserver && stickyBar) {
    new ResizeObserver(syncConfirmStickyOffset).observe(stickyBar);
  }

  function setSource(id, source){
    fieldSources[id] = source;
    var el = document.getElementById(id + 'Source');
    if (!el) return;
    var resolved = source || 'action_required';
    el.textContent = SOURCE_LABELS[resolved] || 'Manual';
    el.className = 'css-field-source ' + resolved;
  }

  function applyDraft(draft){
    Object.keys(draft.sources || {}).forEach(function(key){
      if (draft[key] && document.getElementById(key)) {
        document.getElementById(key).value = draft[key];
        setSource(key, draft.sources[key]);
      }
    });
    ['pharmacyName','website','phone','email','address','town','postcode'].forEach(function(key){
      if (draft[key] && document.getElementById(key) && !draft.sources[key]) {
        document.getElementById(key).value = draft[key];
      }
    });
  }

  var useGoogleBtn = document.getElementById('useGoogleBtn');
  if (useGoogleBtn) useGoogleBtn.addEventListener('click', function(){ applyDraft(GOOGLE_DRAFT); });
  var useWebsiteBtn = document.getElementById('useWebsiteBtn');
  if (useWebsiteBtn) useWebsiteBtn.addEventListener('click', function(){ applyDraft(WEBSITE_DRAFT); });

  document.getElementById('resetImportsBtn').addEventListener('click', async function(){
    if (!window.confirm('Clear all imported Google and website data? Admin-entered details will be kept.')) return;
    var resetBtn = this;
    resetBtn.disabled = true;
    try {
      var res = await fetch(RESET_IMPORTS_URL, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({})
      });
      var json = await res.json();
      if (!json.ok) throw new Error(json.error || json.message || 'Reset failed.');
      window.location.reload();
    } catch(e) {
      alert(e.message || String(e));
      resetBtn.disabled = false;
    }
  });

  document.querySelectorAll('[data-select-google]').forEach(function(el){
    el.addEventListener('click', async function(){
      try {
        var res = await fetch(GOOGLE_SELECT_URL, {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ action: 'confirm', placeId: el.getAttribute('data-select-google') })
        });
        var json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Could not select listing.');
        window.location.reload();
      } catch(e) { alert(e.message || String(e)); }
    });
  });

  form.querySelectorAll('input').forEach(function(input){
    input.addEventListener('input', function(){
      setSource(input.id, 'manual');
    });
  });

  form.addEventListener('submit', async function(ev){
    ev.preventDefault();
    errEl.classList.remove('show');
    btn.disabled = true;
    var payload = {
      pharmacyName: document.getElementById('pharmacyName').value.trim(),
      website: document.getElementById('website').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      email: document.getElementById('email').value.trim(),
      address: document.getElementById('address').value.trim(),
      town: document.getElementById('town').value.trim(),
      postcode: document.getElementById('postcode').value.trim(),
      gphcNumber: document.getElementById('gphcNumber') ? document.getElementById('gphcNumber').value.trim() : '',
      gphcConfirmation: (document.querySelector('input[name="gphcConfirmation"]:checked') || {}).value || '',
      displayAddress: document.getElementById('displayAddress') ? document.getElementById('displayAddress').value.trim() : '',
      displayAddressResolution: (document.querySelector('input[name="resolution-displayAddress"]:checked') || {}).value || '',
      fieldResolutions: {},
      fieldSources: fieldSources
    };
    document.querySelectorAll('[data-conflict-field]').forEach(function(el){
      var field = el.getAttribute('data-conflict-field');
      var selected = el.querySelector('input[type="radio"]:checked');
      if (field && selected) payload.fieldResolutions[field] = selected.value;
    });
    if (!payload.displayAddressResolution && payload.fieldResolutions.displayAddress) {
      payload.displayAddressResolution = payload.fieldResolutions.displayAddress;
    }
    var missing = REQUIRED.filter(function(id){ return !payload[id]; });
    if (missing.length) {
      missing.forEach(function(id){
        var input = document.getElementById(id);
        if (input && input.closest('.css-field')) input.closest('.css-field').classList.add('css-field-missing');
      });
      errEl.classList.add('show');
      btn.disabled = false;
      return;
    }
    try {
      var res = await fetch(SETUP_CONFIRM_URL, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      var json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Could not save.');
      window.location.href = json.redirectUrl;
    } catch(e) {
      errEl.textContent = e.message || String(e);
      errEl.classList.add('show');
      btn.disabled = false;
    }
  });
})();
</script>
</body></html>`;
}

export function renderCustomerSetupConfirmPlaceholderPage(slug: string): string {
  return renderCustomerSetupConfirmPage(slug);
}
