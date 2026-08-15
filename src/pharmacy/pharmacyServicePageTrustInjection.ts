/**
 * Profile-driven local trust injection for visual service pages.
 * Business Profile Intelligence V2 Phase 3B: optional contentContext for profile-first copy.
 */
import * as cheerio from "cheerio";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import type { ParsedMasterSection } from "./pharmacyVisualExperienceLayoutV2.ts";
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { resolveOpeningHours } from "./pharmacyServicePageProfileContext.ts";
import { renderPharmacyLocalAccessMap } from "./pharmacyLocalAccessMap.ts";
import {
  enrichTrustCards,
  isPharmacyFirstService,
  isTravelVaccinationsService,
  preferredServicePageCta,
  servicePageFinalCtaBody,
  servicePageHeroEyebrow,
  servicePageHeroIntro,
  servicePageLocalExtras,
  appendExtrasToParagraph,
} from "./pharmacyServicePageIntelligence.ts";
import { renderHeroContactTreatment } from "./pharmacyComponentDnaContactRenderer.ts";
import { resolveComponentDnaForRender } from "./pharmacyComponentDnaResolver.ts";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import {
  buildHealthcareContextItems,
  buildSafetyStatement,
  stripUnsupportedLocalCopy,
} from "./pharmacyLocalAccessComponentRenderer.ts";
import { stripUnconfirmedConsultationRoomClaims } from "./pharmacyTrustCopyGuards.ts";

export interface LocalAreaLink {
  areaName: string;
  href: string;
}

/** Same component ID as approved homepage / service local coverage cards. */
export const HOMEPAGE_AREAS_WE_SUPPORT_COMPONENT_ID = "homepage-areas-we-support";

/** Approved homepage location / map / access block (split-map-details). */
export const HOMEPAGE_LOCATION_COMPONENT_ID = "homepage-location-map-access";

export function renderHomepageCoverageTagsHtml(
  town: string,
  localAreaLinks: LocalAreaLink[],
): string {
  const coverageLabel = town ? `Areas served around ${town}` : "Areas served";
  if (!localAreaLinks.length) return "";
  return `<div><strong>${esc(coverageLabel)}</strong><div class="coverage-tags">${localAreaLinks
    .map((item) =>
      item.href
        ? `<a class="coverage-tag" href="${esc(item.href)}">${esc(item.areaName)}</a>`
        : `<span class="coverage-tag">${esc(item.areaName)}</span>`,
    )
    .join("")}</div></div>`;
}

export function renderHomepageAreasWeSupportSection(
  serviceName: string,
  localAreaLinks: LocalAreaLink[],
  options: { heading?: string; intro?: string; town?: string } = {},
): string {
  const heading = options.heading || "Areas We Support";
  const intro =
    options.intro ||
    `Local ${serviceName.toLowerCase()} pages for neighbourhoods served by the same pharmacy team.`;
  const town = options.town || "";
  return `<section class="nearby-areas-section soft" id="areas-we-support" data-template-block="areas-we-support" data-component-id="${HOMEPAGE_AREAS_WE_SUPPORT_COMPONENT_ID}">
<div class="wrap">
${renderSectionHead(heading, intro, true)}
${renderHomepageCoverageTagsHtml(town, localAreaLinks)}
</div>
</section>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSectionHead(title: string, intro = "", center = true): string {
  const cls = center ? "section-head center" : "section-head";
  return `<div class="${cls}">${title ? `<h2>${esc(title)}</h2>` : ""}${intro ? `<p>${esc(intro)}</p>` : ""}</div>`;
}

function resolvePrimaryCtaHref(
  profile: PharmacyServicePageProfile,
  contentContext?: ContentGenerationContext,
  label?: string,
): string {
  const tel = profile.phone.replace(/\s/g, "");
  const ctaLabel = label || preferredServicePageCta(contentContext, profile);
  if (/call/i.test(ctaLabel) && profile.showProminentTelephoneCta && tel) return `tel:${tel}`;
  if (profile.headerCtaUrl && !/call/i.test(profile.headerCtaText || "")) return profile.headerCtaUrl;
  if (profile.bookingUrl) return profile.bookingUrl;
  if (tel && profile.showProminentTelephoneCta) return `tel:${tel}`;
  return "#contact";
}

export function buildProfileHeroHtml(
  serviceName: string,
  profile: PharmacyServicePageProfile,
  heroImageHtml: string,
  contentContext?: ContentGenerationContext,
): string {
  const name = profile.pharmacyName;
  const ctaLabel =
    profile.headerCtaText && !/call pharmacy/i.test(profile.headerCtaText)
      ? profile.headerCtaText
      : preferredServicePageCta(contentContext, profile);
  const ctaHref = resolvePrimaryCtaHref(profile, contentContext, ctaLabel);
  const intro = servicePageHeroIntro(contentContext, profile, serviceName);
  const eyebrow = servicePageHeroEyebrow(contentContext, profile, serviceName);
  const brand = resolveBrandDnaForRender(profile.slug);
  const componentDna = resolveComponentDnaForRender(profile.slug, brand);
  const contactHtml = renderHeroContactTreatment(profile, componentDna.contact);

  return `<section class="hero" id="hero-section" data-template-block="hero">
<div class="wrap hero-grid">
<div>
<div class="eyebrow">${esc(eyebrow)}</div>
<h1>${esc(serviceName)} at ${esc(name)}</h1>
<p>${esc(intro)}</p>
<div class="btns">
<a class="btn" href="${esc(ctaHref.startsWith("tel:") || ctaHref.startsWith("http") ? ctaHref : "#contact")}">${esc(ctaLabel)}</a>
<a class="btn secondary" href="#local-access">Find ${esc(name)}</a>
</div>
${contactHtml}
</div>
${heroImageHtml}
</div>
</section>`;
}

export interface ProfileTrustCard {
  title: string;
  body: string;
}

export function buildProfileTrustCards(
  profile: PharmacyServicePageProfile,
  options?: { skipGenericFillers?: boolean; serviceId?: string; serviceName?: string },
): ProfileTrustCard[] {
  const name = profile.pharmacyName;
  const town = profile.town;
  const serviceId = options?.serviceId;
  const serviceName = options?.serviceName || "";
  const cards: ProfileTrustCard[] = [];

  if (profile.gphcNumber?.trim()) {
    cards.push({
      title: "GPhC Registered Pharmacy",
      body: `${name} is a GPhC registered pharmacy premises (${profile.gphcNumber}).`,
    });
  }

  if (profile.nhsServicesAvailable && !isTravelVaccinationsService(serviceId, serviceName)) {
    cards.push({
      title: "NHS Pharmacy Services",
      body: `${name} provides NHS pharmacy services for eligible patients in ${town || "the local area"}.`,
    });
  }

  if (profile.consultationRoomAvailable) {
    cards.push({
      title: "Private Consultation Room",
      body: `Speak privately with the ${name} pharmacist team in a dedicated consultation room.`,
    });
  }

  cards.push({
    title: town ? `Local ${town} Pharmacy` : "Local Community Pharmacy",
    body: town
      ? `${name} supports patients in ${town}${profile.coverageRadius ? ` and surrounding areas (${profile.coverageRadius})` : " and nearby communities"}.`
      : `${name} is your local community pharmacy team.`,
  });

  if (options?.skipGenericFillers) {
    return cards.slice(0, 4);
  }

  const fillerCards: ProfileTrustCard[] = isPharmacyFirstService(serviceId, serviceName)
    ? [
        {
          title: "Pharmacy First pathways",
          body: `${name} uses NHS clinical pathways for sore throat, earache, impetigo, infected insect bites, shingles, sinusitis, and uncomplicated UTI where eligible.`,
        },
        {
          title: "Pharmacist-led assessment",
          body: `Trained pharmacists at ${name} assess symptoms, apply PGDs where appropriate, and signpost to GP or urgent care when needed.`,
        },
        {
          title: "NHS-funded service",
          body: `${name} provides NHS Pharmacy First at no charge for eligible patients where commissioning criteria are met.`,
        },
      ]
    : isTravelVaccinationsService(serviceId, serviceName)
      ? [
          {
            title: "Destination-based advice",
            body: `${name} discusses travel vaccinations based on destination, trip length, season and planned activities.`,
          },
          {
            title: "Pharmacist-led travel consultation",
            body: `Trained pharmacists at ${name} review medical and vaccination history before recommending travel-health options.`,
          },
          {
            title: "Vaccination planning support",
            body: `${name} explains what can be offered locally, including documentation and follow-up dose advice where needed.`,
          },
        ]
      : [
          {
            title: "Pharmacist-led assessment",
            body: `Trained pharmacists at ${name} provide assessment, advice and clear next steps for ${serviceName || "this service"}.`,
          },
        ];

  for (const filler of fillerCards) {
    if (cards.length >= 4) break;
    if (!cards.some((c) => c.title === filler.title)) cards.push(filler);
  }

  return cards.slice(0, 4);
}

export function renderProfileTrustCardsHtml(
  profile: PharmacyServicePageProfile,
  renderGrid: (cards: ProfileTrustCard[]) => string,
  contentContext?: ContentGenerationContext,
  options?: { skipGenericFillers?: boolean },
): string {
  const cards = enrichTrustCards(
    contentContext,
    profile,
    buildProfileTrustCards(profile, {
      skipGenericFillers: options?.skipGenericFillers,
      serviceId: contentContext?.serviceId,
      serviceName: contentContext?.serviceName,
    }),
  );
  return `<section id="pharmacy-trust-cards" data-template-block="trust-cards">
<div class="wrap">
${renderGrid(cards)}
</div>
</section>`;
}

function extractOpeningHoursFromSection(section: ParsedMasterSection | undefined): string {
  if (!section) return "";
  const match = section.proseHtml.match(/Monday[^<]+/i);
  return match?.[0]?.trim() || "";
}

function rebindLocalIntroText(text: string, profile: PharmacyServicePageProfile): string {
  let out = text;
  const displayPhone = profile.displayPhone || profile.phone;
  if (profile.phone) {
    out = out.replace(/\+44\d+/g, displayPhone).replace(profile.phone, displayPhone);
  }
  if (profile.fullAddress) {
    out = out.replace(
      new RegExp(`${profile.fullAddress.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},\\s*${profile.postcode.replace(/\s+/g, "")}`, "i"),
      profile.fullAddress,
    );
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

export function renderProfileLocalAccessSectionHtml(
  serviceName: string,
  profile: PharmacyServicePageProfile,
  contentContext?: ContentGenerationContext,
  options: {
    title?: string;
    town?: string;
    includeCoverageTags?: boolean;
    localAreaLinks?: LocalAreaLink[];
    section13?: ParsedMasterSection;
  } = {},
): string {
  const town = options.town || profile.town;
  const name = profile.pharmacyName;
  const title =
    options.title ||
    (town ? `${serviceName} For Patients In ${town}` : `${serviceName} — local access`);
  const displayPhone = profile.displayPhone || profile.phone;
  const tel = profile.phone.replace(/\s/g, "");
  const hours = resolveOpeningHours(profile, extractOpeningHoursFromSection(options.section13));
  const ctaLabel = preferredServicePageCta(contentContext, profile);
  const ctaHref = resolvePrimaryCtaHref(profile, contentContext, ctaLabel);
  const includeCoverage = options.includeCoverageTags !== false;
  const coverageLabel = town ? `Areas served around ${town}` : "Areas served";
  const coverageItems =
    options.localAreaLinks && options.localAreaLinks.length > 0
      ? options.localAreaLinks
      : profile.coverageAreas.slice(0, 10).map((areaName) => ({ areaName, href: "" }));
  const coverageHtml =
    includeCoverage && coverageItems.length > 0
      ? renderHomepageCoverageTagsHtml(town || profile.town || "", coverageItems)
      : "";

  const nhsPrefix = isPharmacyFirstService(contentContext?.serviceId, serviceName) ? "NHS " : "";
  const introShort = stripUnsupportedLocalCopy(
    stripUnconfirmedConsultationRoomClaims(
      `${name} is located at ${profile.customerFacingAddress || profile.fullAddress || [profile.addressLine1, profile.postcode].filter(Boolean).join(", ")}. Patients in ${town || "the local area"} can access ${nhsPrefix}${serviceName} at the pharmacy${profile.phone ? ` by calling ${displayPhone}` : ""}.`,
      profile,
    ),
    profile,
  );

  const bookingLine = profile.consultationRoomAvailable
    ? "Private consultation room appointments may be available — call to confirm."
    : "Call the pharmacy to ask about walk-in availability or booking.";
  const healthcareItems = buildHealthcareContextItems(profile, contentContext, town);
  const healthcareBlock = healthcareItems.length
    ? `<div class="local-healthcare-context card">
<h3>Local healthcare context</h3>
<ul class="clean local-healthcare-list">${healthcareItems.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
</div>`
    : "";
  const safetyBlock = `<div class="local-safety-note"><p>${esc(buildSafetyStatement(profile, serviceName, contentContext?.serviceId))}</p></div>`;
  const mapHtml = renderPharmacyLocalAccessMap(profile, profile.slug);
  const directionsQuery = encodeURIComponent(profile.fullAddress || `${name}, ${town}, ${profile.postcode}, UK`);
  const directionsUrl = profile.fullAddress
    ? `https://www.google.com/maps/dir/?api=1&destination=${directionsQuery}`
    : "";

  return `<section class="local" id="local-access" data-template-block="local" data-component-variant="split-map-details" data-component-id="${HOMEPAGE_LOCATION_COMPONENT_ID}">
<div class="wrap">
<div class="section-head center"><h2>${esc(title)}</h2><p class="local-intro-lead">${esc(introShort)}</p></div>
<div class="local-structured-blocks">
${healthcareBlock}
${safetyBlock}
</div>
<div class="pharmacy-local-grid">
<div class="pharmacy-local-details local-access-details">
<h3>${esc(name)}</h3>
<ul class="clean local-access-details-list">
<li><strong>Address:</strong> ${esc(profile.customerFacingAddress || profile.fullAddress || [profile.addressLine1, profile.addressLine2, profile.postcode].filter(Boolean).join(", "))}</li>
${profile.phone ? `<li><strong>Phone:</strong> ${esc(displayPhone)}</li>` : ""}
<li><strong>Opening hours:</strong> ${esc(hours)}</li>
<li>${esc(stripUnsupportedLocalCopy(bookingLine, profile))}</li>
</ul>
${coverageHtml}
<div class="local-access-cta">${directionsUrl ? `<a class="btn secondary" href="${esc(directionsUrl)}" target="_blank" rel="noopener noreferrer">Get directions</a> ` : ""}<a class="btn" href="${esc(ctaHref)}">${esc(ctaLabel)}</a></div>
</div>
${mapHtml || `<div class="map-placeholder map-unavailable" role="img" aria-label="Map unavailable for ${esc(name)}"><div><strong>Map unavailable</strong><span>${esc(profile.customerFacingAddress || profile.fullAddress || town)}</span></div></div>`}
</div>
</div>
</section>`;
}

export function buildProfileLocalSectionHtml(
  serviceName: string,
  $: cheerio.CheerioAPI,
  section13: ParsedMasterSection | undefined,
  profile: PharmacyServicePageProfile,
  localAreaLinks: LocalAreaLink[] = [],
  contentContext?: ContentGenerationContext,
): string {
  const local = $('section[data-component="master-local-relevance"], section[data-section-type="localRelevance"]').first();
  const town = profile.town;
  const title =
    local.find(".section-title").first().text().trim() ||
    (town ? `${serviceName} For Patients In ${town}` : `${serviceName} — local access`);
  return renderProfileLocalAccessSectionHtml(serviceName, profile, contentContext, {
    title,
    town,
    includeCoverageTags: true,
    localAreaLinks,
    section13,
  });
}

export function buildProfileFinalCtaHtml(
  serviceName: string,
  profile: PharmacyServicePageProfile,
  conversionImageHtml: string,
  _masterHeading = "",
  _masterBody = "",
  contentContext?: ContentGenerationContext,
): string {
  const name = profile.pharmacyName;
  const tel = profile.phone.replace(/\s/g, "");
  const serviceLower = serviceName.toLowerCase();
  const heading = serviceLower.includes("pharmacy first")
    ? `Book Pharmacy First at ${name}`
    : `Book ${serviceName} at ${name}`;
  const displayPhone = profile.displayPhone || profile.phone;
  const body = servicePageFinalCtaBody(contentContext, profile, serviceName);
  const ctaLabel = preferredServicePageCta(contentContext, profile);
  const phoneCtaHtml =
    profile.showProminentTelephoneCta && profile.phone
      ? `<a class="btn-white" href="tel:${esc(tel)}">Call ${esc(name)} — ${esc(displayPhone)}</a>`
      : "";
  const secondaryActionHtml =
    profile.bookingUrl && !/call/i.test(ctaLabel)
      ? `<a class="btn-white-outline" href="${esc(profile.bookingUrl)}">${esc(ctaLabel)}</a>`
      : `<a class="btn-white-outline" href="#faq-section">View FAQs</a>`;

  return `<section class="section-band conversion-image-section" data-template-block="conversion-image">
<div class="wrap">${conversionImageHtml}</div>
</section>
<section id="contact" class="cta-band" data-template-block="final-cta">
<div class="wrap">
<h2>${esc(heading)}</h2>
<p class="cta-close">${esc(body)}</p>
<div class="cta-actions">
${phoneCtaHtml}
${secondaryActionHtml}
</div>
</div>
</section>`;
}
