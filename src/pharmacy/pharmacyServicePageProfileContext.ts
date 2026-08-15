/**
 * Profile-driven presentation context for PharmaConnect service page template.
 * No hardcoded pharmacy values — all chrome reads from pharmacy profile.
 */
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import { normalizeProfileData, type PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { mapResolveInputFromProfile, resolvePharmacyMapEmbed } from "./pharmacyMapResolver.ts";
import { buildPharmacyServicePageProfileFromData } from "./pharmacyServicePageProfileBuilder.ts";
import {
  resolveCommercialLogoUrl,
  resolveSanitizedOpeningHours,
  sanitizeCustomerFacingAddress,
  sanitizeEmailForDisplay,
  sanitizePlainBusinessText,
} from "./pharmacyBusinessFieldSanitizer.ts";

export function formatUkDisplayPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("44") && digits.length >= 11) {
    const local = `0${digits.slice(2)}`;
    if (local.length === 11) return `${local.slice(0, 5)} ${local.slice(5)}`;
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone.trim();
}

/** Canonical tel: href for UK pharmacy numbers. */
export function normalizeTelHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("44") && digits.length >= 11) return `tel:+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `tel:+44${digits.slice(1)}`;
  const compact = phone.replace(/\s/g, "");
  return compact.startsWith("tel:") ? compact : `tel:${compact}`;
}

export interface PharmacyServicePageProfile {
  slug: string;
  pharmacyName: string;
  tradingName: string;
  logoUrl: string;
  phone: string;
  displayPhone: string;
  email: string;
  website: string;
  bookingUrl: string;
  primaryCta: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  county: string;
  postcode: string;
  fullAddress: string;
  customerFacingAddress: string;
  displayAddress: string;
  displayOpeningHours: string;
  openingHours: string;
  googleMapsEmbedUrl: string;
  gphcNumber: string;
  gphcPremisesUrl: string;
  nhsProfileUrl: string;
  superintendentPharmacistName: string;
  companyName: string;
  coverageAreas: string[];
  coverageRadius: string;
  consultationRoomAvailable: boolean;
  nhsServicesAvailable: boolean;
  privateServicesAvailable: boolean;
  independentPharmacy: boolean;
  yearsServingCommunity: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  brandCtaColor: string;
  brandAccentColor: string;
  brandBackgroundColor: string;
  brandTextColor: string;
  brandMutedTextColor: string;
  brandHeaderBackgroundColor: string;
  brandHeaderTextColor: string;
  brandFooterBackgroundColor: string;
  brandFooterTextColor: string;
  brandFooterLinkColor: string;
  brandFooterAccentColor: string;
  fontHeading: string;
  fontBody: string;
  buttonRadius: string;
  cardRadius: string;
  headerLogoUrl: string;
  headerCtaText: string;
  headerCtaUrl: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  showProminentTelephoneCta?: boolean;
  headerNavLinks: Array<{ label: string; url: string; order: number; visible: boolean }>;
  footerLogoUrl: string;
  footerText: string;
  footerCopyright: string;
  footerCompanyNumber: string;
  footerPrivacyPolicyUrl: string;
  footerCookiePolicyUrl: string;
  footerTermsUrl: string;
  footerLinks: Array<{ label: string; url: string; order: number }>;
  socialFacebook: string;
  socialInstagram: string;
  socialLinkedIn: string;
  socialX: string;
  socialYouTube: string;
  reviewerName: string;
  reviewerRole: string;
  reviewerQualifications: string;
  reviewerProfessionalRegistrations: string;
  reviewerGphcNumber: string;
  reviewerExperienceYears: string;
  reviewerBio: string;
  reviewerSpecialisms: string[];
  reviewerSpecialInterests: string[];
  reviewerClinicalInterests: string[];
  reviewerPhotoUrl: string;
  clinicalReviewDate: string;
  nextReviewDate: string;
  superintendentGphcNumber: string;
  demoMode: boolean;
  trustDataStatus: string;
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

const INVALID_IDENTITY_VALUES = new Set(["home", "about", "services", "contact", "welcome", "pharmacy"]);

export function isInvalidPharmacyIdentity(value: unknown): boolean {
  const text = String(value ?? "").trim();
  if (!text) return true;
  const normalized = text.toLowerCase();
  if (INVALID_IDENTITY_VALUES.has(normalized)) return true;
  if (/^https?:\/\//i.test(text) || /^www\./i.test(text)) return true;
  return false;
}

export function resolveCanonicalPharmacyName(data: PharmacyProfileData): { value: string; source: string } {
  const candidates = [
    { value: data.pharmacyName, source: "data.pharmacyName" },
    { value: data.tradingName, source: "data.tradingName" },
  ];
  const selected = candidates.find((candidate) => !isInvalidPharmacyIdentity(candidate.value));
  return selected || { value: "", source: "none" };
}

export function assertValidGenerationPharmacyIdentity(value: unknown): string {
  const text = String(value ?? "").trim();
  if (isInvalidPharmacyIdentity(text)) {
    throw new Error(`Invalid pharmacy identity resolved: ${text}`);
  }
  return text;
}

export function buildPharmacyServicePageProfile(slug: string): PharmacyServicePageProfile {
  const loaded = loadPharmacyProfile(slug);
  const data = loaded?.data
    ? normalizeProfileData(loaded.data as Partial<PharmacyProfileData>)
    : normalizeProfileData({});
  return buildPharmacyServicePageProfileFromData(slug, data, loaded);
}

/** Resolve embeddable Google Maps URL from profile — never hardcode pharmacy values. */
export function resolveGoogleMapsEmbedUrl(profile: PharmacyServicePageProfile, slug?: string): string {
  const resolved = resolvePharmacyMapEmbed(mapResolveInputFromProfile(profile, slug));
  return resolved.embedUrl || "";
}

export function resolveOpeningHours(
  profile: PharmacyServicePageProfile,
  masterHoursFallback = "",
): string {
  return resolveSanitizedOpeningHours(profile, undefined, masterHoursFallback);
}

export function resolveGoogleMapsEmbedUrlFromData(data: Partial<PharmacyProfileData>): string {
  const resolved = resolvePharmacyMapEmbed({
    googleMapsEmbedUrl: String(data.googleMapsEmbedUrl ?? ""),
    mapEmbedUrl: String((data as Record<string, unknown>).mapEmbedUrl ?? ""),
    googlePlaceId: String(data.googlePlaceId ?? ""),
    pharmacyName: String(data.pharmacyName ?? data.tradingName ?? ""),
    addressLine1: String(data.addressLine1 ?? ""),
    addressLine2: String(data.addressLine2 ?? ""),
    townCity: String(data.townCity ?? ""),
    primaryTown: String(data.primaryTown ?? ""),
    postcode: String(data.postcode ?? ""),
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
  });
  return resolved.embedUrl || "";
}
