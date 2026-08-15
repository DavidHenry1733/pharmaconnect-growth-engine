/**
 * Shared sanitisation for customer-facing business facts at render time.
 * Rejects imported presentation code (CSS, selectors, builder metadata).
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { resolveOpeningHoursRows } from "./pharmacyOpeningHoursTable.ts";
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { isDisplayAddressConfirmed } from "./pharmacyBusinessDisplayResolver.ts";

export const OPENING_HOURS_CUSTOMER_FALLBACK =
  "Contact the pharmacy to confirm current opening hours.";

const CONTAMINATION_PATTERNS: RegExp[] = [
  /monospace,monospace/i,
  /font-size\s*:\s*\d/i,
  /\.x-el-[a-z0-9_-]+/i,
  /\{[^}]{0,200}\}/,
  /@media\s*\(/i,
  /!important\b/i,
  /\b(url|linear-gradient|rgba?|hsla?)\s*\(/i,
  /--[a-z0-9-]+\s*:/i,
  /display\s*:\s*(flex|grid|block)/i,
  /padding\s*:\s*\d/i,
  /\[wix-/i,
  /\[elementor-/i,
  /\[vc_/i,
  /\[et_pb_/i,
  /\[fusion_/i,
  /\[ninja_form/i,
  /\[contact-form/i,
  /wp:paragraph|wp-block/i,
];

const HTML_FRAGMENT_RE = /<[^>]+>/;
const SELECTOR_LIKE_RE = /^[\s.#\[]|[\s.#\[]\w|-{2,}/;

export function isContaminatedPresentationText(value: unknown): boolean {
  const text = String(value ?? "").trim();
  if (!text) return false;
  if (HTML_FRAGMENT_RE.test(text)) return true;
  if (text.length > 280 && /[{};]/.test(text)) return true;
  if (SELECTOR_LIKE_RE.test(text) && /[{};:]/.test(text)) return true;
  return CONTAMINATION_PATTERNS.some((re) => re.test(text));
}

export function sanitizePlainBusinessText(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || isContaminatedPresentationText(text)) return "";
  return text.replace(/\s+/g, " ").trim();
}

function formatOpeningHoursRows(profile: PharmacyServicePageProfile): string {
  const rows = resolveOpeningHoursRows(profile);
  const lines = rows
    .map((r) => `${r.day}: ${r.hours}`.trim())
    .filter((line) => line.length > 3 && !isContaminatedPresentationText(line));
  return lines.join("\n");
}

function confirmedDisplayOpeningHours(data?: Partial<PharmacyProfileData>): string {
  const display = sanitizePlainBusinessText(data?.displayOpeningHours);
  if (display && data?.profileFieldConfirmations?.displayOpeningHours) return display;
  return "";
}

/** Resolve opening hours for render — never emit contaminated import fragments. */
export function resolveSanitizedOpeningHours(
  profile: PharmacyServicePageProfile,
  data?: Partial<PharmacyProfileData>,
  masterHoursFallback = "",
): string {
  const confirmed = confirmedDisplayOpeningHours(data);
  if (confirmed) return confirmed;

  const structured = formatOpeningHoursRows(profile);
  if (structured) return structured;

  for (const candidate of [
    sanitizePlainBusinessText(profile.displayOpeningHours),
    sanitizePlainBusinessText(profile.openingHours),
    sanitizePlainBusinessText(masterHoursFallback),
  ]) {
    if (candidate) return candidate;
  }

  return OPENING_HOURS_CUSTOMER_FALLBACK;
}

const STOCK_LOGO_RE = /\/isteam\/stock\//i;
const GENERIC_STOCK_ASSET_RE = /\/stock\/[A-Za-z0-9]+/i;
const SVG_AS_LOGO_RE = /\.svg(\?|$)/i;

/** UI / contact icons must never fill photograph content slots (hero, support, trust, conversion). */
const UI_ICON_FILENAME_RE =
  /(?:^|[/_.-])(?:phone|telephone|tel|call|email|e-?mail|envelope|mail|map-?pin|location-?pin|pin-?icon|clock|calendar|booking|facebook|instagram|twitter|linkedin|whatsapp|youtube|play-?button|favicon|sprite|glyph|hamburger|chevron|caret|menu-?icon|ui-?icon|icon-?set)(?:[/_.-]|$)/i;

const CONTENT_IMAGE_SLOTS = new Set(["hero", "support", "trust", "conversion", "local"]);

export function isUiIconAssetPath(assetPath: string, originalUrl = ""): boolean {
  const probe = `${assetPath} ${originalUrl}`.trim();
  if (!probe) return false;
  if (isUnsuitableLogoAssetUrl(probe)) return true;
  const lower = probe.toLowerCase();
  const base = lower.split(/[/\\]/).pop() || lower;
  if (/website-import\/(?:icon|favicon|social|decorative)-/i.test(lower)) return true;
  if (UI_ICON_FILENAME_RE.test(base) || UI_ICON_FILENAME_RE.test(lower)) return true;
  if (/classification[=:]["']?icon/i.test(lower)) return true;
  // Platform photos and service library masters (Travel etc.) are content assets, not UI icons.
  if (
    /\.svg(\?|$)/i.test(lower) &&
    !lower.includes("pharmacy-image-platform") &&
    !lower.includes("pharmacy-image-library/")
  ) {
    return true;
  }
  return false;
}

export function isPhotographicContentImageAsset(assetPath: string, originalUrl = ""): boolean {
  return !isUiIconAssetPath(assetPath, originalUrl);
}

export function isUnsuitableLogoAssetUrl(url: unknown): boolean {
  const text = String(url ?? "").trim();
  if (!text) return true;
  if (STOCK_LOGO_RE.test(text) || GENERIC_STOCK_ASSET_RE.test(text)) return true;
  if (SVG_AS_LOGO_RE.test(text) && /phone|call|tel|icon|stock/i.test(text)) return true;
  return isContaminatedPresentationText(text);
}

function decodeHtmlEntitiesInUrl(url: string): string {
  return url.replace(/&amp;/gi, "&").replace(/&#38;/g, "&");
}

/** Logo URLs suitable for header/footer — omit stock icons and contaminated URLs. */
export function resolveCommercialLogoUrl(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    let url = decodeHtmlEntitiesInUrl(String(candidate ?? "").trim());
    if (!url) continue;
    if (isUnsuitableLogoAssetUrl(url)) continue;
    if (!/^https?:\/\//i.test(url) && !url.startsWith("/") && !url.startsWith("assets/")) continue;
    return url;
  }
  return "";
}

export function sanitizeCustomerFacingAddress(
  profile: PharmacyServicePageProfile,
  data?: Partial<PharmacyProfileData>,
): string {
  const display = String(data?.displayAddress ?? profile.displayAddress ?? "").trim();
  if (display && isDisplayAddressConfirmed(data || {}) && !isContaminatedPresentationText(display)) {
    return display;
  }
  const canonical = sanitizePlainBusinessText(profile.customerFacingAddress || profile.fullAddress);
  return canonical || sanitizePlainBusinessText(profile.addressLine1);
}

export function sanitizePhoneForDisplay(phone: unknown): string {
  return sanitizePlainBusinessText(phone);
}

export function sanitizeEmailForDisplay(email: unknown): string {
  const text = sanitizePlainBusinessText(email);
  if (!text || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return "";
  return text;
}

export type VisualAssetRole =
  | "logo"
  | "hero"
  | "service_support"
  | "process"
  | "trust"
  | "cta"
  | "icon"
  | "map";

const SLOT_TO_ROLE: Record<string, VisualAssetRole> = {
  hero: "hero",
  support: "service_support",
  trust: "trust",
  conversion: "cta",
};

export function visualAssetRoleForSlot(slot: string): VisualAssetRole {
  return SLOT_TO_ROLE[slot] || "service_support";
}

/** Reject assets that must not fill photograph slots (stock icons, UI icons, remote hotlink icons). */
export function isAssetBlockedForVisualSlot(
  slot: string,
  assetPath: string,
  publicUrl?: string,
): boolean {
  const role = visualAssetRoleForSlot(slot);
  const probe = `${assetPath} ${publicUrl || ""}`;
  if (!CONTENT_IMAGE_SLOTS.has(slot) && role !== "hero" && role !== "service_support" && role !== "trust" && role !== "cta") {
    return false;
  }
  if (isUiIconAssetPath(assetPath, publicUrl)) return true;
  if (role === "hero" || role === "service_support" || role === "trust" || role === "cta") {
    if (STOCK_LOGO_RE.test(probe) || GENERIC_STOCK_ASSET_RE.test(probe)) return true;
    if (/wsimg\.com/i.test(probe) && /stock/i.test(probe)) return true;
  }
  return false;
}

export function validateRenderedHtmlPresentation(html: string): {
  passed: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (/monospace,monospace;font-size:1em/.test(html)) errors.push("contaminated-opening-hours");
  if (/<img[^>]+src="[^"]*\/isteam\/stock\//i.test(html)) errors.push("stock-icon-in-img");
  if (!/data-pharmaconnect-component="platform-header-v1"/.test(html)) {
    errors.push("missing-platform-header-v1");
  }
  if (!/data-pharmaconnect-component="platform-footer-v1"/.test(html)) {
    errors.push("missing-platform-footer-v1");
  }
  const styleBlock = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1] || "";
  if (/class="grid-3"/.test(html) && styleBlock && !/\.grid-3|grid-template-columns/.test(styleBlock)) {
    errors.push("missing-commercial-layout-css");
  }
  return { passed: errors.length === 0, errors };
}
