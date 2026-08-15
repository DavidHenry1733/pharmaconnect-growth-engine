/**
 * Read-only browser preview index for Pharmacy First content ecosystem assets.
 * Uses existing generated files only — no copy changes, no generation side effects.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import {
  resolveClusterPageSlug,
  resolveClusterPageFilesystemRelativePath,
} from "./pharmacyClusterPageUrlResolver.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type EcosystemAsset = {
  id: string;
  type: string;
  urlPath: string;
  outputPath: string;
  sourceSections: string[];
  wordCount: number;
};

type EcosystemIndex = {
  version: number;
  serviceId: string;
  masterFile: string;
  slug: string;
  localArea: string;
  generatedAt: string;
  assets: EcosystemAsset[];
};

type AssetGroup = {
  title: string;
  assetIds: readonly string[];
};

const SERVICE_ID = "pharmacy-first";
const API_BASE = `/api/pharmacy-content-ecosystem-preview/${SERVICE_ID}`;

const ASSET_TITLES: Record<string, string> = {
  "root-service-page": "Pharmacy First — Root Service Page",
  "local-service-page": "Pharmacy First — Rotherham Local Service Page",
  "patient-guide": "Pharmacy First Patient Guide",
  "faq-page": "Pharmacy First FAQs",
  "what-is-pharmacy-first": "What Is Pharmacy First?",
  "can-a-pharmacist-help-with-minor-illnesses": "Can A Pharmacist Help With Minor Illnesses?",
  "pharmacy-first-vs-gp-appointment": "Pharmacy First vs GP Appointment",
  "social-pack": "Social Post Pack",
  "gbp-pack": "Google Business Profile Post Pack",
  "email-sequence": "Email Sequence",
  "video-script": "Video Script",
  "ecosystem-summary": "Full Content Ecosystem Page",
};

const ASSET_GROUPS: readonly AssetGroup[] = [
  {
    title: "Service Pages",
    assetIds: ["root-service-page", "local-service-page"],
  },
  {
    title: "Patient Education",
    assetIds: ["patient-guide", "faq-page"],
  },
  {
    title: "Blog Articles",
    assetIds: [
      "what-is-pharmacy-first",
      "can-a-pharmacist-help-with-minor-illnesses",
      "pharmacy-first-vs-gp-appointment",
    ],
  },
  {
    title: "Content Packs",
    assetIds: ["social-pack", "gbp-pack", "email-sequence", "video-script"],
  },
  {
    title: "Ecosystem Summary",
    assetIds: ["ecosystem-summary"],
  },
];

const SCREENSHOT_PRIORITY: Record<string, { rank: number; label: string }> = {
  "root-service-page": { rank: 1, label: "High — primary sales screenshot" },
  "ecosystem-summary": { rank: 2, label: "High — platform breadth" },
  "local-service-page": { rank: 3, label: "High — local service page" },
  "faq-page": { rank: 4, label: "Medium — FAQ accordion" },
  "what-is-pharmacy-first": { rank: 5, label: "Medium — blog quality" },
  "social-pack": { rank: 6, label: "Medium — social pack UI" },
};

const PACK_IDS = new Set(["social-pack", "gbp-pack", "email-sequence", "video-script"]);
const PAGE_SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const PACK_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

function resolveWorkspaceRoot(): string {
  const candidates = [
    process.env.WORKSPACE_ROOT,
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../.."),
    process.cwd(),
  ].filter(Boolean) as string[];
  for (const root of candidates) {
    const indexPath = path.join(
      root,
      "output/pharmacy-content-ecosystem/pharmaconnect/pharmacy-first/_ecosystem-index.json",
    );
    if (fs.existsSync(indexPath)) return root;
  }
  return path.resolve(__dirname, "../..");
}

const WORKSPACE_ROOT = resolveWorkspaceRoot();
const ECOSYSTEM_ROOT = path.join(
  WORKSPACE_ROOT,
  "output/pharmacy-content-ecosystem/pharmaconnect/pharmacy-first",
);
const INDEX_PATH = path.join(ECOSYSTEM_ROOT, "_ecosystem-index.json");

function escHtml(text: unknown): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(text: unknown): string {
  return escHtml(text);
}

export function loadPharmacyFirstEcosystemIndex(): EcosystemIndex | null {
  if (!fs.existsSync(INDEX_PATH)) return null;
  return JSON.parse(fs.readFileSync(INDEX_PATH, "utf8")) as EcosystemIndex;
}

function assetById(index: EcosystemIndex): Map<string, EcosystemAsset> {
  return new Map(index.assets.map((asset) => [asset.id, asset]));
}

export function pageSlugFromOutputPath(outputPath: string): string | null {
  const normalized = outputPath.replace(/\\/g, "/");
  const match = normalized.match(/\/pages\/([^/]+)\/index\.html$/);
  return match?.[1] ?? null;
}

export function sanitisePreviewPageSlug(raw: string): string | null {
  const clean = path.basename(raw);
  return PAGE_SLUG_RE.test(clean) ? clean : null;
}

export function sanitisePreviewPackId(raw: string): string | null {
  const clean = path.basename(raw);
  if (!PACK_ID_RE.test(clean) || !PACK_IDS.has(clean)) return null;
  return clean;
}

export function assetPreviewUrl(asset: EcosystemAsset): string {
  if (PACK_IDS.has(asset.id)) {
    return `${API_BASE}/packs/${asset.id}/`;
  }
  const slug = pageSlugFromOutputPath(asset.outputPath);
  if (!slug) return "#";
  return `${API_BASE}/pages/${slug}/`;
}

export function resolvePageHtmlPath(pageSlug: string): string | null {
  const file = path.join(ECOSYSTEM_ROOT, "pages", pageSlug, "index.html");
  if (!fs.existsSync(file)) return null;
  const resolved = path.resolve(file);
  const pagesRoot = path.resolve(ECOSYSTEM_ROOT, "pages");
  if (!resolved.startsWith(pagesRoot + path.sep)) return null;
  return resolved;
}

export function resolvePackAsset(packId: string): EcosystemAsset | null {
  const index = loadPharmacyFirstEcosystemIndex();
  if (!index) return null;
  const asset = index.assets.find((a) => a.id === packId);
  if (!asset || !PACK_IDS.has(asset.id)) return null;
  if (!fs.existsSync(asset.outputPath)) return null;
  return asset;
}

function priorityCell(assetId: string): string {
  const p = SCREENSHOT_PRIORITY[assetId];
  if (!p) return "—";
  return `#${p.rank} · ${p.label}`;
}

function renderAssetRow(asset: EcosystemAsset): string {
  const title = ASSET_TITLES[asset.id] ?? asset.id;
  const sections = asset.sourceSections.map((s) => escHtml(s)).join(", ");
  const previewUrl = assetPreviewUrl(asset);
  return `<tr>
  <td><strong>${escHtml(title)}</strong></td>
  <td>${escHtml(asset.type)}</td>
  <td>${sections}</td>
  <td>${asset.wordCount.toLocaleString("en-GB")}</td>
  <td><a href="${escAttr(previewUrl)}">Open preview</a></td>
  <td>${escHtml(priorityCell(asset.id))}</td>
</tr>`;
}

export function renderPharmacyFirstEcosystemPreviewIndex(): string | null {
  const index = loadPharmacyFirstEcosystemIndex();
  if (!index) return null;

  const assets = assetById(index);
  const sections = ASSET_GROUPS.map((group) => {
    const rows = group.assetIds
      .map((id) => assets.get(id))
      .filter((asset): asset is EcosystemAsset => !!asset)
      .map(renderAssetRow)
      .join("\n");

    return `<section class="group">
  <h2>${escHtml(group.title)}</h2>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Asset title</th>
          <th>Type</th>
          <th>Source master sections</th>
          <th>Word count</th>
          <th>Preview</th>
          <th>Screenshot priority</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</section>`;
  }).join("\n");

  const directLinks = index.assets
    .map((asset) => {
      const title = ASSET_TITLES[asset.id] ?? asset.id;
      return `<li><a href="${escAttr(assetPreviewUrl(asset))}">${escHtml(title)}</a></li>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>Pharmacy First Content Ecosystem — Preview V1</title>
<style>
  :root {
    --nhs-blue: #005eb8;
    --ink: #1a3347;
    --muted: #64748b;
    --border: #e2e8f0;
    --banner: #fff8e1;
    --banner-border: #f59e0b;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Inter, system-ui, sans-serif;
    color: var(--ink);
    background: #f8fafc;
    line-height: 1.5;
  }
  .banner {
    background: var(--banner);
    border-bottom: 2px solid var(--banner-border);
    padding: 0.75rem 1.5rem;
    font-weight: 600;
    text-align: center;
  }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 1.5rem; }
  h1 { margin: 0 0 0.25rem; font-size: 1.75rem; }
  .subtitle { color: var(--muted); margin: 0 0 1.5rem; }
  .meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  .meta dt { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .meta dd { margin: 0.15rem 0 0; font-weight: 500; }
  .group { margin-bottom: 2rem; }
  .group h2 {
    margin: 0 0 0.75rem;
    font-size: 1.125rem;
    color: var(--nhs-blue);
    border-bottom: 2px solid var(--border);
    padding-bottom: 0.35rem;
  }
  .table-wrap { overflow-x: auto; background: #fff; border: 1px solid var(--border); border-radius: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9375rem; }
  th, td { padding: 0.65rem 0.85rem; text-align: left; vertical-align: top; border-bottom: 1px solid var(--border); }
  th { background: #f1f5f9; font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); }
  tr:last-child td { border-bottom: none; }
  a { color: var(--nhs-blue); }
  .quick-links {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem 1.25rem;
    margin-bottom: 2rem;
  }
  .quick-links h2 { margin-top: 0; border: none; padding: 0; }
  .quick-links ul { margin: 0.5rem 0 0; padding-left: 1.25rem; columns: 2; column-gap: 2rem; }
  @media (max-width: 720px) { .quick-links ul { columns: 1; } }
</style>
</head>
<body>
<div class="banner">READ ONLY — Pharmacy First content ecosystem preview. Not published. No header/footer/images yet.</div>
<div class="wrap">
  <h1>Pharmacy First Content Ecosystem</h1>
  <p class="subtitle">Brook Pharmacy (pharmaconnect) · ${escHtml(index.localArea)} · human review before design</p>
  <dl class="meta">
    <div><dt>Master source</dt><dd>${escHtml(index.masterFile)}</dd></div>
    <div><dt>Assets</dt><dd>${index.assets.length}</dd></div>
    <div><dt>Generated</dt><dd>${escHtml(new Date(index.generatedAt).toLocaleString("en-GB"))}</dd></div>
    <div><dt>Output root</dt><dd><code>output/pharmacy-content-ecosystem/pharmaconnect/pharmacy-first/</code></dd></div>
  </dl>
  <div class="quick-links">
    <h2>All preview links</h2>
    <ul>${directLinks}</ul>
  </div>
  ${sections}
</div>
</body>
</html>`;
}

type SocialPost = { id?: number; text?: string; source?: string };
type GbpPost = { id?: number; title?: string; body?: string; source?: string };
type EmailItem = { id?: number; subject?: string; body?: string; source?: string };

function serviceLabel(serviceId: string): string {
  return serviceId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "#contact";
}

function imageUrl(assetPath: string): string {
  if (assetPath.startsWith("assets/pharmacy-uploads/")) {
    const publicBase = (process.env.PUBLIC_APP_URL || process.env.PUBLIC_ASSET_BASE_URL || "https://app.pharmaconnect.uk").replace(/\/+$/, "");
    return `${publicBase}/${assetPath}`;
  }
  return assetPath.startsWith("/") ? assetPath : `/${assetPath}`;
}

type ReviewPreviewImageSlot = "hero" | "support" | "trust" | "conversion";

const REVIEW_PREVIEW_IMAGE_SLOT_INDEX: Record<ReviewPreviewImageSlot, number> = {
  hero: 0,
  support: 1,
  trust: 2,
  conversion: 3,
};

function collectRealPharmacyUploadImages(dir: string, baseDir = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectRealPharmacyUploadImages(fullPath, baseDir));
      continue;
    }
    const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
    const normalized = relativePath.toLowerCase();
    if (!/\.(png|jpe?g|webp)$/.test(normalized)) continue;
    if (/(validate|test|placeholder|mock|svg)/i.test(normalized)) continue;
    results.push(`assets/pharmacy-uploads/${relativePath}`);
  }
  return results.sort((a, b) => {
    const aPriority = a.includes("/pharmaconnect/") ? 0 : a.includes("/dhmdigital/") ? 1 : 2;
    const bPriority = b.includes("/pharmaconnect/") ? 0 : b.includes("/dhmdigital/") ? 1 : 2;
    return aPriority - bPriority || a.localeCompare(b);
  });
}

function resolveReviewPreviewUploadImage(slot: ReviewPreviewImageSlot): string | null {
  const uploadRoot = path.join(WORKSPACE_ROOT, "assets/pharmacy-uploads");
  const realImages = collectRealPharmacyUploadImages(uploadRoot);
  if (!realImages.length) return null;
  const index = REVIEW_PREVIEW_IMAGE_SLOT_INDEX[slot] % realImages.length;
  return realImages[index];
}

function reviewPreviewImageSlot(pageSlug: string): ReviewPreviewImageSlot {
  const slug = String(pageSlug || "").toLowerCase();
  if (slug.includes("blog") || slug.includes("what-is") || slug.includes("pharmacist-help") || slug.includes("gp-appointment")) return "conversion";
  if (slug.includes("guide") || slug.includes("faq")) return "trust";
  if (slug.includes("local") || slug.includes("rotherham")) return "support";
  return "hero";
}

function renderReviewPreviewImage(slug: string, serviceId: string, slot: "hero" | "support" | "trust" | "conversion"): string {
  const fallbackImage = resolveReviewPreviewUploadImage(slot);
  if (fallbackImage) {
    return `<figure class="review-preview-image" data-image-slot="${escAttr(slot)}"><img src="${escAttr(imageUrl(fallbackImage))}" alt="${escAttr(`${serviceLabel(serviceId)} campaign image`)}"/><figcaption>${escHtml("Campaign image")}</figcaption></figure>`;
  }
  return `<div class="review-preview-image review-preview-image--placeholder" data-image-slot="${escAttr(slot)}" data-image-missing="true" aria-hidden="true"></div>`;
}

function fillMissingImagePlaceholders(html: string): string {
  // Preserve Layout V3 reserved visual placeholders — do not inject publishing copy.
  return html;
}

function extractTitleFromHtml(html: string, fallback: string): string {
  return html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+\|.*$/, "").trim() ||
    fallback;
}

function extractReviewBody(html: string): string {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  if (article) return article;
  return html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
}

export function findPreviewSourceMarker(html: string): string | null {
  return html.match(/PREVIEW_SOURCE:\s*([a-z0-9-]+)/i)?.[1] || null;
}

export function sanitizeReviewPreviewHtml(html: string): string {
  return html
    .replace(/<section\b[^>]*>[\s\S]*?<h2>\s*SOCIAL CONTENT LIBRARY\s*<\/h2>[\s\S]*?<\/section>/gi, "")
    .replace(/<section\b[^>]*professional-review-panel[^>]*>[\s\S]*?Professional review details available from the pharmacy\.[\s\S]*?<\/section>/gi, "")
    .replace(/Professional review details available from the pharmacy\.?/gi, "Reviewed by the pharmacy team. Pharmacist and registration details can be added before publishing.")
    .replace(/Reviewed by the pharmacy team\. Full professional details can be added before publishing\.?/gi, "Reviewed by the pharmacy team. Pharmacist and registration details can be added before publishing.")
    .replace(/\b[^.<>\n]*\bholds\s*\[\]\.?/gi, "Reviewed by the pharmacy team. Pharmacist and registration details can be added before publishing.")
    .replace(/Image will be added before publishing\.?/gi, "Campaign image will be added before publishing.")
    .replace(/\bConversion content\b/gi, "What to do next")
    .replace(/\bCONVERSION CONTENT\b/g, "WHAT TO DO NEXT");
}

function splitLongParagraphText(text: string): string[] {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.split(/\s+/).length <= 65) return [clean];
  const sentences = clean.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) || [clean];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const candidate = [current, sentence].filter(Boolean).join(" ");
    if (candidate.split(/\s+/).length > 55 && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function formatReviewBodyHtml(html: string): string {
  return sanitizeReviewPreviewHtml(html).replace(/<p>([^<]{320,})<\/p>/gi, (_match, text: string) =>
    splitLongParagraphText(text).map((part) => `<p>${escHtml(part)}</p>`).join("\n"),
  );
}

function renderReviewPreviewChrome(input: {
  slug: string;
  serviceId: string;
  title: string;
  body: string;
  sourcePath?: string | null;
  contentType: string;
  imageSlot?: ReviewPreviewImageSlot;
}): string {
  const profile = buildPharmacyServicePageProfile(input.slug);
  const serviceName = serviceLabel(input.serviceId);
  const primary = profile.brandPrimaryColor || "#005eb8";
  const secondary = profile.brandSecondaryColor || "#003087";
  const cta = profile.brandCtaColor || primary;
  const heading = profile.brandTextColor || "#0f172a";
  const muted = profile.brandMutedTextColor || "#475569";
  const phone = profile.phone;
  const ctaText = profile.headerCtaText || profile.primaryCta || (phone ? `Call ${phone}` : "Contact the pharmacy");
  const ctaUrl = profile.headerCtaUrl || (phone ? telHref(phone) : profile.bookingUrl || "#contact");
  const logo = profile.headerLogoUrl || profile.logoUrl;
  const professionalReviewCopy =
    profile.reviewerName || profile.reviewerGphcNumber || profile.reviewerProfessionalRegistrations
      ? `Reviewed by ${[profile.reviewerName, profile.reviewerRole, profile.reviewerProfessionalRegistrations || profile.reviewerGphcNumber].filter(Boolean).join(", ")}.`
      : "Reviewed by the pharmacy team. Pharmacist and registration details can be added before publishing.";
  const professionalRegistration =
    profile.gphcNumber || profile.superintendentGphcNumber || profile.reviewerGphcNumber
      ? `Professional registration: ${profile.gphcNumber || profile.superintendentGphcNumber || profile.reviewerGphcNumber}`
      : "Professional registration details can be added before publishing.";
  const isPackPreview = input.contentType === "ecosystem-pack";
  const reviewBlock = isPackPreview
    ? `<section class="professional-review professional-review--note" data-component="pharmacy-review-note"><h2>Pharmacy review note</h2><p>Content prepared for review by the pharmacy team before publishing.</p></section>`
    : `<section class="professional-review" data-component="professional-review"><h2>Professional review</h2><p>${escHtml(professionalReviewCopy)}</p>${professionalReviewCopy === "Reviewed by the pharmacy team. Pharmacist and registration details can be added before publishing." ? "" : `<p>${escHtml(professionalRegistration)}</p>`}</section>`;
  const trustItems = [
    profile.gphcNumber ? `GPhC ${profile.gphcNumber}` : "GPhC registration details available before publishing",
    profile.nhsServicesAvailable ? "NHS pharmacy services" : "Pharmacy services",
    profile.town ? `Serving ${profile.town}` : "Local pharmacy team",
  ];
  const navItems = [
    { label: "Overview", url: "#content" },
    { label: "Trust", url: "#trust" },
    { label: "Contact", url: "#contact" },
  ];

  return `<!DOCTYPE html>
<!-- PREVIEW_SOURCE: review-wrapper -->
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<meta name="tenantSlug" content="${escAttr(input.slug)}"/>
<meta name="campaignId" content="${escAttr(input.serviceId)}"/>
<meta name="review-preview-layout" content="customer-wrapper-v1"/>
<title>${escHtml(input.title)} | ${escHtml(profile.pharmacyName)}</title>
<style>
:root{--brand-primary:${escHtml(primary)};--brand-secondary:${escHtml(secondary)};--brand-cta:${escHtml(cta)};--brand-heading:${escHtml(heading)};--brand-muted:${escHtml(muted)};--line:#e2e8f0;--soft:#f8fafc}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;color:var(--brand-heading);background:#fff;line-height:1.65}a{color:inherit}.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
.review-preview-bar{background:#eff6ff;border-bottom:1px solid #bfdbfe;color:#1e40af;font-size:13px;font-weight:800;text-align:center;padding:10px 16px}
.site-header{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20}.site-header .wrap{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:12px;text-decoration:none;font-weight:900}.brand img{max-height:46px;width:auto}.brand span{display:block}.brand small{display:block;color:var(--brand-muted);font-size:12px;font-weight:700}.nav{display:flex;gap:18px;align-items:center;font-size:14px;font-weight:800}.btn{display:inline-flex;align-items:center;justify-content:center;padding:12px 18px;border-radius:999px;background:var(--brand-cta);color:#fff;text-decoration:none;font-weight:900}
.hero{background:linear-gradient(135deg,#f8fafc 0%,#eef6ff 100%);border-bottom:1px solid var(--line);padding:58px 0}.hero-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(280px,.95fr);gap:36px;align-items:center}.eyebrow{font-size:12px;font-weight:900;letter-spacing:.11em;text-transform:uppercase;color:var(--brand-primary);margin-bottom:12px}.hero h1{font-size:clamp(2rem,4vw,3.35rem);line-height:1.06;margin:0 0 16px}.hero p{font-size:19px;color:var(--brand-muted);margin:0 0 20px}
.review-preview-image{border-radius:26px;min-height:300px;overflow:hidden;background:#fff;border:1px solid var(--line);box-shadow:0 16px 40px rgba(15,23,42,.1);display:flex;align-items:center;justify-content:center;text-align:center;margin:0}.review-preview-image img{width:100%;height:100%;min-height:300px;object-fit:cover;display:block}.review-preview-image figcaption{display:none}.review-preview-image--placeholder{border:2px dashed #cbd5e1;color:var(--brand-muted);padding:34px}.review-preview-image--placeholder strong,.review-image-placeholder-text strong{display:block;color:var(--brand-heading);font-size:19px;margin-bottom:6px}.review-image-placeholder-text{width:100%;height:100%;display:flex;min-height:180px;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:24px;color:var(--brand-muted)}
.trust-strip{background:#fff;border-bottom:1px solid var(--line)}.trust-strip .wrap{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;padding-top:18px;padding-bottom:18px}.trust-item{background:var(--soft);border:1px solid var(--line);border-radius:14px;padding:13px 15px;font-weight:850;color:var(--brand-heading)}
.review-content{padding:56px 0}.review-content article,.review-content .content-card{background:#fff;border:1px solid var(--line);border-radius:24px;padding:clamp(22px,4vw,42px);box-shadow:0 12px 32px rgba(15,23,42,.06)}.review-content h1:first-child{display:none}.review-content h2{font-size:1.5rem;margin:2rem 0 .75rem;color:var(--brand-heading)}.review-content p,.review-content li{font-size:17px;color:var(--brand-muted)}.review-content ul{padding-left:1.25rem;margin:0 0 1.25rem}.review-content li{margin:.35rem 0}.professional-review{margin-top:28px;background:#f8fafc;border:1px solid var(--line);border-radius:18px;padding:20px}.professional-review h2{margin:0 0 8px!important;font-size:1.25rem}.item{background:#fff;border:1px solid var(--line);border-radius:18px;padding:18px;margin:0 0 14px}.item header{font-weight:900;margin-bottom:8px;color:var(--brand-heading)}.source,.meta,.count{color:var(--brand-muted);font-size:14px}
.cta-band{background:linear-gradient(135deg,var(--brand-primary),var(--brand-secondary));color:#fff;padding:42px 0}.cta-band h2{margin:0 0 10px;color:#fff}.cta-band p{margin:0 0 16px;color:#e0f2fe}.cta-band .btn{background:#fff;color:var(--brand-primary)}
.site-footer{background:#0f172a;color:#e2e8f0;padding:38px 0}.site-footer .wrap{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px}.site-footer h3{margin:0 0 8px;color:#fff}.site-footer p{margin:0 0 8px;color:#cbd5e1}.source-note{font-size:12px;color:#94a3b8;word-break:break-all}
@media(max-width:820px){.hero-grid{grid-template-columns:1fr}.nav{display:none}}
</style>
</head>
<body data-review-preview-wrapper="customer-wrapper-v1" data-preview-type="${escAttr(input.contentType)}">
<div class="review-preview-bar">Review preview — customer-facing layout, not published</div>
<header class="site-header" data-component="review-preview-header"><div class="wrap">
<a class="brand" href="${escAttr(profile.website || "#")}">${logo ? `<img src="${escAttr(logo)}" alt="${escAttr(profile.pharmacyName)} logo"/>` : ""}<span>${escHtml(profile.pharmacyName)}<small>${escHtml([profile.town, serviceName].filter(Boolean).join(" · "))}</small></span></a>
<nav class="nav" aria-label="Preview navigation">${navItems.map((item) => `<a href="${escAttr(item.url)}">${escHtml(item.label)}</a>`).join("")}${phone ? `<a href="${escAttr(telHref(phone))}">${escHtml(phone)}</a>` : ""}<a class="btn" href="${escAttr(ctaUrl)}">${escHtml(ctaText)}</a></nav>
</div></header>
<section class="hero"><div class="wrap hero-grid"><div><div class="eyebrow">${escHtml(profile.pharmacyName)} · ${escHtml(serviceName)}</div><h1>${escHtml(input.title)}</h1><p>${escHtml(profile.town ? `Information and next steps for patients in ${profile.town}.` : "Information and next steps for local patients.")}</p><a class="btn" href="${escAttr(ctaUrl)}">${escHtml(ctaText)}</a></div>${renderReviewPreviewImage(input.slug, input.serviceId, input.imageSlot || "hero")}</div></section>
<section class="trust-strip" id="trust"><div class="wrap">${trustItems.map((item) => `<div class="trust-item">${escHtml(item)}</div>`).join("")}</div></section>
<main class="review-content" id="content"><div class="wrap"><article class="content-card">${input.body}${reviewBlock}</article></div></main>
<section class="cta-band" id="contact"><div class="wrap"><h2>Book ${escHtml(serviceName)} at ${escHtml(profile.pharmacyName)}</h2><p>${escHtml(phone ? `Call ${phone} to ask about availability, appointments or walk-in support.` : "Contact the pharmacy team to ask about availability, appointments or walk-in support.")}</p><a class="btn" href="${escAttr(ctaUrl)}">${escHtml(ctaText)}</a></div></section>
<footer class="site-footer" data-component="review-preview-footer"><div class="wrap"><div><h3>${escHtml(profile.pharmacyName)}</h3><p>${escHtml(profile.fullAddress || [profile.town, profile.postcode].filter(Boolean).join(", "))}</p><p>${escHtml(phone)}</p><p>${escHtml(profile.openingHours ? `Opening hours: ${profile.openingHours}` : "Opening hours can be added before publishing.")}</p></div><div><h3>Clinical trust</h3><p>${escHtml(trustItems.join(" · "))}</p><p>${escHtml(professionalReviewCopy)}</p><p class="source-note">Source: ${escHtml(input.sourcePath || "generated preview")}</p></div></div></footer>
</body>
</html>`;
}

export function isLocalClusterGeneratedPage(html: string): boolean {
  return /data-publish-source=["'](?:local-cluster-design-system|local-area-v1|local-cluster-v1|local-hub-v1)["']/i.test(html);
}

function renderGeneratedLocalClusterPreviewHtml(sourceHtml: string): string {
  const toolbar =
    '<div class="pharmacy-review-preview-toolbar" data-component="review-preview-toolbar">Review preview — not published. Generated local page shown exactly as produced.</div>';
  const toolbarStyle =
    '<style data-preview-toolbar="local-cluster-parity">.pharmacy-review-preview-toolbar{position:sticky;top:0;z-index:10000;background:#eff6ff;border-bottom:1px solid #bfdbfe;color:#1e40af;font:800 13px/1.4 Inter,system-ui,sans-serif;text-align:center;padding:10px 16px}</style>';

  let html = sourceHtml;
  if (!/PREVIEW_SOURCE:\s*local-cluster-parity/i.test(html)) {
    html = html.replace(/<!DOCTYPE html>/i, "<!DOCTYPE html>\n<!-- PREVIEW_SOURCE: local-cluster-parity -->");
  }
  if (!html.includes('data-preview-toolbar="local-cluster-parity"')) {
    html = html.includes("</head>")
      ? html.replace(/<\/head>/i, `${toolbarStyle}\n</head>`)
      : `${toolbarStyle}${html}`;
  }
  if (!html.includes('data-component="review-preview-toolbar"')) {
    html = html.replace(/<body\b[^>]*>/i, (match) => `${match}\n${toolbar}`);
  }
  return html;
}

export function renderBenchmarkPagePreviewHtml(filePath: string, serviceId: string, slug: string, pageSlug: string): string {
  const sourceHtml = fs.readFileSync(filePath, "utf8");
  if (isLocalClusterGeneratedPage(sourceHtml)) {
    return renderGeneratedLocalClusterPreviewHtml(sourceHtml);
  }
  const withPlaceholders = sanitizeReviewPreviewHtml(fillMissingImagePlaceholders(sourceHtml));
  return renderReviewPreviewChrome({
    slug,
    serviceId,
    title: extractTitleFromHtml(withPlaceholders, pageSlug.replace(/-/g, " ")),
    body: formatReviewBodyHtml(extractReviewBody(withPlaceholders)),
    sourcePath: filePath,
    contentType: "ecosystem-page",
    imageSlot: reviewPreviewImageSlot(pageSlug),
  });
}

export function renderMissingReviewPreview(slug: string, serviceId: string, assetTitle = "Campaign content"): string {
  return renderReviewPreviewChrome({
    slug,
    serviceId,
    title: assetTitle,
    body: `<p><strong>This content needs to be regenerated before review.</strong></p>`,
    sourcePath: null,
    contentType: "missing-content",
  });
}

function renderSocialPackPreview(data: { count: number; posts: SocialPost[] }): string {
  const posts = Array.isArray(data.posts) ? data.posts : [];
  const items = posts
    .map(
      (post) => `<article class="item">
  <header>Social post ${escHtml(post.id || "")}</header>
  <p>${escHtml(post.text)}</p>
</article>`,
    )
    .join("\n");
  return `<p class="count">${data.count ?? posts.length} posts</p>${items || "<p><strong>This content needs to be regenerated before review.</strong></p>"}`;
}

function renderGbpPackPreview(data: { count: number; posts: GbpPost[] }): string {
  const posts = Array.isArray(data.posts) ? data.posts : [];
  const items = posts
    .map(
      (post) => `<article class="item">
  <header>${escHtml(post.title || "Google Business Profile post")}</header>
  <p>${escHtml(post.body)}</p>
</article>`,
    )
    .join("\n");
  return `<p class="count">${data.count ?? posts.length} posts</p>${items || "<p><strong>This content needs to be regenerated before review.</strong></p>"}`;
}

function renderEmailPackPreview(data: { count: number; emails: EmailItem[] }): string {
  const emails = Array.isArray(data.emails) ? data.emails : [];
  const items = emails
    .map(
      (email) => `<article class="item">
  <header>Email ${escHtml(email.id || "")}: ${escHtml(email.subject || "Campaign email")}</header>
  <div class="body">${escHtml(email.body).replace(/\n/g, "<br/>")}</div>
</article>`,
    )
    .join("\n");
  return `<p class="count">${data.count ?? emails.length} emails</p>${items || "<p><strong>This content needs to be regenerated before review.</strong></p>"}`;
}

function renderVideoScriptPreview(markdown: string): string {
  return `<pre class="script">${escHtml(markdown)}</pre>`;
}

export function renderPackPreviewPage(asset: EcosystemAsset, serviceId = "pharmacy-first", slug = "pharmaconnect"): string | null {
  const title = ASSET_TITLES[asset.id] ?? asset.type;
  let body = "";
  const apiBase = `/api/pharmacy-content-ecosystem-preview/${serviceId}`;

  if (asset.id === "video-script") {
    const markdown = fs.readFileSync(asset.outputPath, "utf8");
    body = renderVideoScriptPreview(markdown);
  } else {
    const raw = JSON.parse(fs.readFileSync(asset.outputPath, "utf8")) as Record<string, unknown>;
    if (asset.id === "social-pack") {
      body = renderSocialPackPreview(raw as { count: number; posts: SocialPost[] });
    } else if (asset.id === "gbp-pack") {
      body = renderGbpPackPreview(raw as { count: number; posts: GbpPost[] });
    } else if (asset.id === "email-sequence") {
      body = renderEmailPackPreview(raw as { count: number; emails: EmailItem[] });
    }
  }

  if (!body) return null;

  const indexUrl = `${apiBase}/?slug=${encodeURIComponent(slug)}`;
  return renderReviewPreviewChrome({
    slug,
    serviceId,
    title,
    body: `<p class="back"><a href="${escAttr(indexUrl)}">Back to ecosystem index</a></p><p class="meta">${escHtml(asset.type)} · ${asset.wordCount.toLocaleString("en-GB")} words</p>${formatReviewBodyHtml(body)}`,
    sourcePath: asset.outputPath,
    contentType: "ecosystem-pack",
  });
}

const SERVICE_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

export function resolvePreviewTenantSlug(raw?: string | null): string {
  const cleaned = String(raw || "pharmaconnect").trim();
  return resolveTenantProfileSlug(cleaned) || cleaned;
}

export function sanitisePreviewServiceId(raw: string): string | null {
  const clean = String(raw || "").trim().toLowerCase();
  return SERVICE_ID_RE.test(clean) ? clean : null;
}

function benchmarkEcosystemRoot(serviceId: string, slug = "pharmaconnect"): string {
  return path.join(WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", slug, serviceId);
}

export function loadBenchmarkEcosystemIndex(serviceId: string, slug = "pharmaconnect"): EcosystemIndex | null {
  const indexPath = path.join(benchmarkEcosystemRoot(serviceId, slug), "_ecosystem-index.json");
  if (!fs.existsSync(indexPath)) return null;
  return JSON.parse(fs.readFileSync(indexPath, "utf8")) as EcosystemIndex;
}

export function resolveBenchmarkPageHtmlPath(serviceId: string, pageSlug: string, slug = "pharmaconnect"): string | null {
  const root = benchmarkEcosystemRoot(serviceId, slug);
  const candidates = [
    path.join(root, "pages", pageSlug, "index.html"),
    path.join(root, "local", pageSlug, "index.html"),
    path.join(root, "local", "hub", "index.html"),
  ];
  if (pageSlug === "hub") {
    const hub = path.join(root, "local", "hub", "index.html");
    if (fs.existsSync(hub)) return path.resolve(hub);
  }
  if (pageSlug.startsWith("cluster-") || pageSlug.startsWith("local-cluster-")) {
    const canonical = resolveClusterPageSlug(pageSlug.replace(/^local-/, ""));
    const cluster = path.join(root, resolveClusterPageFilesystemRelativePath(canonical));
    if (fs.existsSync(cluster)) return path.resolve(cluster);
  }
  if (pageSlug.startsWith("cluster-")) {
    const cluster = path.join(root, "local", pageSlug, "index.html");
    if (fs.existsSync(cluster)) return path.resolve(cluster);
  }
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const resolved = path.resolve(file);
    const allowedRoot = path.resolve(root);
    if (resolved.startsWith(allowedRoot + path.sep)) return resolved;
  }
  const index = loadBenchmarkEcosystemIndex(serviceId, slug);
  const asset = index?.assets.find((a) => {
    const base = path.basename(path.dirname(a.outputPath));
    return base === pageSlug || a.id === pageSlug || a.id === `local-cluster-${pageSlug}`;
  });
  if (asset && fs.existsSync(asset.outputPath)) return path.resolve(asset.outputPath);
  return null;
}

export function resolveBenchmarkPackAsset(serviceId: string, packId: string, slug = "pharmaconnect"): EcosystemAsset | null {
  const index = loadBenchmarkEcosystemIndex(serviceId, slug);
  if (!index) return null;
  const asset = index.assets.find((a) => a.id === packId);
  if (!asset || !PACK_IDS.has(asset.id)) return null;
  if (!fs.existsSync(asset.outputPath)) return null;
  return asset;
}

function benchmarkAssetPreviewUrl(serviceId: string, asset: EcosystemAsset, slug: string): string {
  const slugQ = `?slug=${encodeURIComponent(slug)}`;
  if (PACK_IDS.has(asset.id)) {
    return `/api/pharmacy-content-ecosystem-preview/${serviceId}/packs/${asset.id}/${slugQ}`;
  }
  if (asset.outputPath.includes(`${path.sep}local${path.sep}`)) {
    const areaSlug = path.basename(path.dirname(asset.outputPath));
    return `/api/pharmacy-content-ecosystem-preview/${serviceId}/local/${areaSlug}/${slugQ}`;
  }
  const pageSlug = pageSlugFromOutputPath(asset.outputPath);
  return pageSlug ? `/api/pharmacy-content-ecosystem-preview/${serviceId}/pages/${pageSlug}/${slugQ}` : "#";
}

export function renderBenchmarkEcosystemPreviewIndex(serviceId: string, slug = "pharmaconnect"): string | null {
  const index = loadBenchmarkEcosystemIndex(serviceId, slug);
  if (!index) return null;

  const rows = index.assets
    .map((asset) => {
      const previewUrl = benchmarkAssetPreviewUrl(serviceId, asset, slug);
      return `<tr>
  <td><strong>${escHtml(asset.type)}</strong></td>
  <td>${escHtml(asset.sourceSections.join(", "))}</td>
  <td>${asset.wordCount.toLocaleString("en-GB")}</td>
  <td><a href="${escAttr(previewUrl)}">Open preview</a></td>
</tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<!-- PREVIEW_SOURCE: raw-content-preview-route -->
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>${escHtml(serviceId)} Content Ecosystem — Preview</title>
<style>
  body { margin: 0; font-family: Inter, system-ui, sans-serif; color: #1a3347; background: #f8fafc; line-height: 1.5; }
  .banner { background: #fff8e1; border-bottom: 2px solid #f59e0b; padding: 0.75rem 1.5rem; font-weight: 600; text-align: center; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 1.5rem; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; }
  th, td { padding: 0.65rem 0.85rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
  th { background: #f1f5f9; font-size: 0.8125rem; text-transform: uppercase; color: #64748b; }
  a { color: #005eb8; }
</style>
</head>
<body>
<div class="banner">READ ONLY — ${escHtml(serviceId)} content ecosystem preview (${escHtml(slug)}). Master-derived assets only.</div>
<div class="wrap">
  <h1>${escHtml(serviceId.replace(/-/g, " "))} Content Ecosystem</h1>
  <p>Tenant: <strong>${escHtml(slug)}</strong> · Master: ${escHtml(index.masterFile)} · ${index.assets.length} assets · ${escHtml(index.localArea)}</p>
  <p><code>output/pharmacy-content-ecosystem/${escHtml(slug)}/${escHtml(serviceId)}/</code></p>
  <table>
    <thead><tr><th>Asset</th><th>Source sections</th><th>Words</th><th>Preview</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
</body>
</html>`;
}
