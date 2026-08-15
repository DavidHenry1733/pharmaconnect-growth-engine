/**
 * Location area page renderer — locked local-area-v1 contract (same architecture as cluster v1).
 */
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import type { LocalAreaEvidenceRecord, LocalLocationHierarchy } from "./pharmacyLocalAreaResolver.ts";
import {
  buildPharmacyServicePageStyleBlock,
  PHARMACY_SERVICE_PAGE_TEMPLATE_ID,
  renderPharmacyServicePageFooter,
  renderPharmacyServicePageHeader,
} from "./pharmacyServicePageDesignSystem.ts";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { applyBrandDnaToServicePageProfile, buildPharmacyThemeWithBrandDna, buildGoogleFontsLink } from "./pharmacyBrandDnaResolver.ts";
import {
  ensureBusinessNameInHeading,
  renderBrandHeroComponent,
  resolvePageComponents,
  resolvePageComponentDna,
} from "./pharmacyBrandDnaComponentRenderers.ts";
import { componentDnaBodyAttributes } from "./pharmacyComponentDnaResolver.ts";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import { BRAND_DNA_VERSION } from "./pharmacyBrandDnaTypes.ts";
import { PHARMACY_VISUAL_PIPELINE_VERSION } from "./pharmacyThemeEngine.ts";
import { visualServicePageBodyAttributes } from "./pharmacyVisualServicePageRenderer.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { buildImageRenderContext } from "./pharmacyVisualExperience.ts";
import { renderServicePageImagePanel } from "./pharmacyServicePageImageComponent.ts";
import { renderMediaTextSection } from "./pharmacyMediaFloatFlowComponent.ts";
import { splitSentences } from "./pharmacyServicePageBalance.ts";
import type { VisualExperienceServiceId } from "./pharmacyVisualExperienceConfig.ts";
import { pharmacyLocalPageResponsiveStyleBlock } from "./pharmacyLocalPageResponsiveStyles.ts";
import { LOCAL_AREA_CONTRACT_ID, LOCAL_AREA_V1_CONTRACT } from "./pharmacyLocalPageTypeContracts.ts";
import { buildLocalAreaPageContent } from "./pharmacyLocalHubClusterContentEngine.ts";
import {
  buildProfileFinalCtaHtml,
  HOMEPAGE_LOCATION_COMPONENT_ID,
  renderProfileLocalAccessSectionHtml,
} from "./pharmacyServicePageTrustInjection.ts";
import { resolveLocalFaqSectionHeading } from "./pharmacyLocalFaqHeadingResolver.ts";
import {
  resolveLocalClusterTarget,
  resolveLocalHubTarget,
  resolveLocalPagePublicPath,
  resolveTenantSupportedAreaLinks,
} from "./pharmacyLocalPageUrlResolver.ts";
import {
  preferredServicePageCta,
  servicePageHeroEyebrow,
} from "./pharmacyServicePageIntelligence.ts";
import { localPageTypeTypographyStyleBlock } from "./pharmacyLocalPageTypeTypography.ts";
import { assertLocalPageContractOrThrow } from "./pharmacyLocalPageContractValidation.ts";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function publicHref(ctx: ContentGenerationContext, target: Parameters<typeof resolveLocalPagePublicPath>[0]): string {
  return resolveLocalPagePublicPath(target, ctx.serviceId);
}

function renderSectionHead(title: string, intro = ""): string {
  return `<div class="section-head center">${title ? `<h2>${esc(title)}</h2>` : ""}${intro ? `<p>${esc(intro)}</p>` : ""}</div>`;
}

function bodyToParagraphs(body: string): string[] {
  const trimmed = String(body || "").trim();
  if (!trimmed) return [];
  const blocks = trimmed.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length > 1) return blocks;
  const sentences = splitSentences(trimmed);
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    chunks.push(sentences.slice(i, i + 2).join(" "));
  }
  return chunks;
}

function areaBreadcrumb(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  area: LocalAreaEvidenceRecord,
  parentCluster: LocalAreaEvidenceRecord,
): string {
  const serviceHref = publicHref(ctx, { pageType: "service", localSegment: ctx.serviceId });
  const hubHref = publicHref(ctx, resolveLocalHubTarget(hierarchy));
  const clusterHref = publicHref(ctx, resolveLocalClusterTarget(parentCluster.slug, parentCluster.name));
  return `<nav class="local-breadcrumb wrap" aria-label="Breadcrumb" data-template-block="breadcrumbs"><a href="${esc(serviceHref)}">${esc(ctx.serviceName)}</a> <span aria-hidden="true">›</span> <a href="${esc(hubHref)}">Locations</a> <span aria-hidden="true">›</span> <a href="${esc(clusterHref)}">${esc(parentCluster.name)}</a> <span aria-hidden="true">›</span> <span>${esc(area.name)}</span></nav>`;
}

function renderAreaTrustSection(
  profile: ReturnType<typeof buildPharmacyServicePageProfile>,
  content: ReturnType<typeof buildLocalAreaPageContent>,
  trustImageHtml: string,
): string {
  const title = ensureBusinessNameInHeading(content.base.trustHeading, profile.pharmacyName);
  const intro = content.base.trustIntro?.trim() || "";
  return `<section class="about" id="cluster-trust" data-template-block="trust-split">
<div class="wrap">
<div class="grid-2 trust-split-row">
<div class="trust-prose">
<span class="tag">Service experience</span>
<h2>${esc(title)}</h2>
${intro ? `<p>${esc(intro)}</p>` : `<p>${esc(content.base.trustBody.split(/\n\n+/)[0] || "")}</p>`}
</div>
<div class="trust-media">${trustImageHtml}</div>
</div>
</div>
</section>`;
}

function renderAreaFaqSection(
  content: ReturnType<typeof buildLocalAreaPageContent>,
  ctx: ContentGenerationContext,
  areaName: string,
): string {
  const faqHeading = resolveLocalFaqSectionHeading({
    pageType: "location-area",
    serviceName: ctx.serviceName,
    localityLabel: areaName,
  });
  const items = content.base.faqs
    .slice(0, 6)
    .map(
      (f) =>
        `<div class="cluster-faq-item faq-card"><h3 class="faq-q">${esc(f.question)}</h3><p class="faq-a">${esc(f.answer)}</p></div>`,
    )
    .join("\n");
  return `<section class="faq" id="faq-section" data-template-block="faq">
<div class="wrap">${renderSectionHead(faqHeading, "")}${items}</div>
</section>`;
}

export function renderLocalAreaPageHtml(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  area: LocalAreaEvidenceRecord,
): string {
  const parentCluster = hierarchy.clusters.find((c) => c.areaId === area.parentAreaId);
  if (!parentCluster) {
    throw new Error(`Local area "${area.name}" has no parent cluster in hierarchy`);
  }

  const key = resolveTenantProfileSlug(ctx.resolvedSlug) || ctx.resolvedSlug;
  const baseProfile = ctx.profile ?? buildPharmacyServicePageProfile(key);
  const brandDna = resolveBrandDnaForRender(key);
  const profile = applyBrandDnaToServicePageProfile(baseProfile, brandDna);
  const theme = buildPharmacyThemeWithBrandDna(baseProfile, brandDna);
  const components = resolvePageComponents(theme, brandDna);
  const componentDna = resolvePageComponentDna(theme, brandDna);
  const content = buildLocalAreaPageContent(ctx, hierarchy, area);
  const supportedLinks = resolveTenantSupportedAreaLinks(ctx, hierarchy, "public");
  const mainServiceHref = publicHref(ctx, { pageType: "service", localSegment: ctx.serviceId });

  const imageCtx = buildImageRenderContext(key, ctx.serviceId as VisualExperienceServiceId);
  imageCtx.location = area.name;
  const heroImageHtml = renderServicePageImagePanel(imageCtx, "hero", "hero-image-wrap hero-media");
  const supportingImageHtml = renderServicePageImagePanel(imageCtx, "support", "image-panel support-block-media");
  const trustImageHtml = renderServicePageImagePanel(imageCtx, "trust", "image-panel trust-block-media");
  const conversionImageHtml = renderServicePageImagePanel(
    imageCtx,
    "conversion",
    "image-panel conversion-feature-image",
  );

  const ctaLabel =
    profile.headerCtaText && !/call pharmacy/i.test(profile.headerCtaText)
      ? profile.headerCtaText
      : preferredServicePageCta(ctx, profile);

  const hero = renderBrandHeroComponent(components, {
    serviceName: ctx.serviceName,
    profile,
    heroImageHtml,
    eyebrow: servicePageHeroEyebrow(ctx, profile, ctx.serviceName),
    headline: `${ctx.serviceName} in ${area.name}`,
    intro: content.base.heroIntro.split(/\n\n+/)[0] || content.base.heroIntro,
    primaryCtaLabel: ctaLabel,
    primaryCtaHref: profile.bookingUrl || mainServiceHref,
    secondaryCtaLabel: `${parentCluster.name} cluster`,
    secondaryCtaHref: publicHref(ctx, resolveLocalClusterTarget(parentCluster.slug, parentCluster.name)),
    componentDna,
  });

  const areaContext = `<section id="cluster-context" data-template-block="service-definition">
<div class="wrap">
${renderSectionHead(content.clusterContextHeading, "")}
${bodyToParagraphs(content.clusterContextBody)
  .map((p) => `<p>${esc(p)}</p>`)
  .join("\n")}
</div>
</section>`;

  const relevance = renderMediaTextSection({
    sectionId: "cluster-relevance",
    sectionClass: "blue-band",
    templateBlock: "local-relevance",
    headHtml: renderSectionHead(content.relevanceHeading, content.base.localRelevanceIntro),
    paragraphs: bodyToParagraphs(content.base.localRelevanceBody),
    lists: content.base.localRelevanceBullets.length ? [content.base.localRelevanceBullets] : undefined,
    mediaHtml: supportingImageHtml,
    hasImage: true,
    thresholds: componentDna.splitSection.layoutThresholds,
  });
  const trust = renderAreaTrustSection(profile, content, trustImageHtml);
  const access = renderProfileLocalAccessSectionHtml(ctx.serviceName, profile, ctx, {
    title: `${ctx.serviceName} For Patients In ${profile.town || hierarchy.primaryLocality}`,
    town: profile.town || hierarchy.primaryLocality,
    includeCoverageTags: true,
    localAreaLinks: supportedLinks,
  });
  const faq = renderAreaFaqSection(content, ctx, area.name);
  const conversionAndCta = buildProfileFinalCtaHtml(ctx.serviceName, profile, conversionImageHtml, "", "", ctx);

  const main = [hero, areaContext, relevance, trust, access, faq, conversionAndCta].join("\n");

  const title = `${ctx.serviceName} in ${area.name} | ${profile.pharmacyName}`;
  const metaDesc = `${profile.pharmacyName} — ${ctx.serviceName} for patients in ${area.name}.`;

  let html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(metaDesc)}"/>
<meta name="pharmacy-pipeline-version" content="${esc(PHARMACY_VISUAL_PIPELINE_VERSION)}"/>
<meta name="brand-dna-version" content="${esc(BRAND_DNA_VERSION)}"/>
<meta name="local-page-contract" content="${LOCAL_AREA_CONTRACT_ID}"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
${buildGoogleFontsLink(theme)}
${buildPharmacyServicePageStyleBlock(theme)}
${localPageTypeTypographyStyleBlock()}
${pharmacyLocalPageResponsiveStyleBlock()}
</head>
<body ${visualServicePageBodyAttributes(ctx.serviceId)} ${componentDnaBodyAttributes(componentDna)} data-pharmacy-template="${PHARMACY_SERVICE_PAGE_TEMPLATE_ID}" data-local-page-kind="location-area" data-local-page-contract="${LOCAL_AREA_CONTRACT_ID}" data-publish-source="local-area-v1" data-local-area="${esc(area.slug)}" data-location-component="${HOMEPAGE_LOCATION_COMPONENT_ID}">
${renderPharmacyServicePageHeader(profile, theme)}
<main id="main-content">
${areaBreadcrumb(ctx, hierarchy, area, parentCluster)}
${main}
</main>
${renderPharmacyServicePageFooter(profile, ctx.serviceName, theme)}
</body>
</html>`;

  assertLocalPageContractOrThrow(html, LOCAL_AREA_V1_CONTRACT);
  return html;
}
