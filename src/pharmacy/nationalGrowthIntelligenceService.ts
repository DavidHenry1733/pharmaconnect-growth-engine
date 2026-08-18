/**
 * National Growth Intelligence connector.
 * Reads persisted Search Intelligence, website/config, catalogue, and GP-01.
 * Does not call DataForSEO, Google Places, or GSC.
 * Does not fabricate competitor gaps when competitor keyword universes are empty.
 */
import fs from "node:fs";

import { resolveWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceService.ts";
import { resolveTenantServiceCatalogue, type TenantServiceCatalogueEntry } from "./growthEngineTenantServiceCatalogue.ts";
import { readGrowthPlanIntelligenceV1 } from "./growthPlanIntelligenceV1Service.ts";
import type { GrowthPlanAction } from "./growthPlanIntelligenceV1Model.ts";
import { isNationalGrowthPlatform } from "./growthPlatformResolverService.ts";
import {
  isNationalIntelligenceFixturePath,
  resolveNationalIntelligenceArtifactPath,
} from "./nationalIntelligenceStorageService.ts";
import { resolveNationalIntelligenceSubject } from "./nationalIntelligenceSubjectResolver.ts";
import {
  NATIONAL_GROWTH_INTELLIGENCE_VERSION,
  type NationalEvidenceClass,
  type NationalGrowthGap,
  type NationalGrowthIntelligenceReport,
  type NationalGapType,
} from "./nationalGrowthIntelligenceModel.ts";
import { readNationalSearchIntelligence } from "./nationalSearchIntelligenceV1Service.ts";
import type { NationalSearchIntelligenceSnapshot } from "./nationalSearchIntelligenceV1Model.ts";
import { getPharmacyProjectConfigPath, safePharmacySlug } from "./pharmacyWorkspacePaths.ts";

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t && !["pharmacy", "pharmacies", "for", "the", "and", "www", "uk", "co"].includes(t));
}

function overlaps(a: string, b: string): boolean {
  const left = tokens(a);
  const right = new Set(tokens(b));
  if (!left.length || !right.size) return false;
  const hits = left.filter((t) => right.has(t)).length;
  return hits >= Math.min(2, left.length);
}

function readProjectConfig(slug: string): Record<string, unknown> {
  const file = getPharmacyProjectConfigPath(safePharmacySlug(slug));
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function configuredServiceUrl(service: TenantServiceCatalogueEntry, project: Record<string, unknown>): string {
  if (service.href) return String(service.href);
  const money =
    project.serviceMoneyPages && typeof project.serviceMoneyPages === "object"
      ? (project.serviceMoneyPages as Record<string, unknown>)
      : {};
  return String(money[service.serviceId] || "").trim();
}

function isContactLike(url: string): boolean {
  return /contact/i.test(url);
}

function searchDisplaySource(snapshot: NationalSearchIntelligenceSnapshot): string {
  const source = snapshot.provenance?.evidenceSource || "";
  if (source === "DATAFORSEO_LIVE" || snapshot.liveExecution) return "DATAFORSEO_LIVE";
  if (source === "DATAFORSEO_PERSISTED") return "DATAFORSEO_LIVE";
  return source || "SEARCH_INTELLIGENCE";
}

function gap(
  partial: Omit<NationalGrowthGap, "competitorGap"> & { competitorGap?: boolean },
): NationalGrowthGap {
  return {
    ...partial,
    competitorGap: Boolean(partial.competitorGap),
  };
}

function sortGaps(a: NationalGrowthGap, b: NationalGrowthGap): number {
  const classRank: Record<NationalEvidenceClass, number> = {
    PROVEN_GAP: 0,
    SUPPORTED_OPPORTUNITY: 1,
    INSUFFICIENT_COMPETITOR_EVIDENCE: 2,
  };
  const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const classDelta = classRank[a.evidenceClass] - classRank[b.evidenceClass];
  if (classDelta) return classDelta;
  const priorityDelta = priorityRank[a.priority] - priorityRank[b.priority];
  if (priorityDelta) return priorityDelta;
  if (a.actionable !== b.actionable) return a.actionable ? -1 : 1;
  return a.id.localeCompare(b.id);
}

function mapGp01Type(action: GrowthPlanAction): NationalGapType {
  if (action.actionType === "EXISTING_PAGE_IMPROVEMENT") return "WEAK_SERVICE_COVERAGE";
  if (action.gapEvidenceStatus === "INSUFFICIENT_EVIDENCE") return "INSUFFICIENT_COMPETITOR_EVIDENCE";
  if (action.gapEvidenceStatus === "PROVEN_UNTAPPED" || action.gapEvidenceStatus === "PROVEN_WEAK_COVERAGE") {
    return action.competitorCount > 0 ? "COMPETITOR_GAP" : "KEYWORD_VISIBILITY_GAP";
  }
  return "SERP_OPPORTUNITY";
}

function matchService(keyword: string, services: TenantServiceCatalogueEntry[]): TenantServiceCatalogueEntry | null {
  return services.find((s) => overlaps(keyword, s.serviceName) || overlaps(keyword, s.serviceId)) || null;
}

export function buildNationalGrowthIntelligence(slug: string): NationalGrowthIntelligenceReport {
  const safe = safePharmacySlug(slug);
  if (!isNationalGrowthPlatform(safe)) {
    throw new Error(`National Growth Intelligence is not applicable to ${slug}`);
  }

  const subject = resolveNationalIntelligenceSubject(safe);
  const catalogue = resolveTenantServiceCatalogue(safe);
  const project = readProjectConfig(safe);
  const search = readNationalSearchIntelligence(safe);
  const website = resolveWebsiteIntelligenceSnapshot(safe);
  const gp01 = readGrowthPlanIntelligenceV1(safe);
  const gp01File = resolveNationalIntelligenceArtifactPath(safe, "growth-plan-intelligence-v1");
  const gp01Fixture = isNationalIntelligenceFixturePath(gp01File);

  const competitors = Array.isArray(search.organicCompetitors) ? search.organicCompetitors : [];
  const qualifiedCommercial = competitors.filter((row) => row.eligibleForKeywordExpansion).length;
  const paidExpansions = Array.isArray(search.competitorKeywordUniverses)
    ? search.competitorKeywordUniverses.length
    : 0;
  const customerKeywords = search.customerOrganicFootprint?.keywordCount ?? search.customerKeywords.length;
  const sparse = Boolean(search.customerOrganicFootprint?.sparse);
  const sparseThreshold = search.customerOrganicFootprint?.threshold || 10;
  const collected =
    search.status === "collected" || search.status === "empty" || search.status === "partial";
  const websitePages = website?.analysis?.inventory.totalPages || 0;
  const websiteComplete = website?.analysis?.understandingComplete === true;
  const configuredPages = catalogue.services.filter((s) => configuredServiceUrl(s, project)).length;

  const gaps: NationalGrowthGap[] = [];
  const limitations: string[] = [];
  const siSource = searchDisplaySource(search);
  const siAuthority = search.authority === "LIVE_PROVEN" ? "PERSISTED_PROVEN" : search.authority || "PERSISTED_PROVEN";
  const siProvenance = {
    evidenceSource: siSource,
    authority: String(siAuthority),
    sourceSystem: "national-search-intelligence-v1",
    capturedAt: search.capturedAt || null,
  };

  if (collected && sparse) {
    gaps.push(
      gap({
        id: "si-sparse-organic-footprint",
        type: "KEYWORD_VISIBILITY_GAP",
        evidenceClass: "PROVEN_GAP",
        source: "Search Intelligence",
        currentState: `${customerKeywords} collected customer ranking keyword${customerKeywords === 1 ? "" : "s"} (sparse threshold ${sparseThreshold}).`,
        evidence: [
          `Search Intelligence status=${search.status}.`,
          `Customer ranking keywords=${customerKeywords}.`,
          search.customerOrganicFootprint?.note || "Customer organic footprint is sparse.",
        ],
        whyItMatters:
          "A sparse ranking footprint limits how confidently we can discover commercial competitors from shared keywords. It is also a visibility problem for the commercial services this business sells.",
        recommendedAction:
          "Strengthen organic visibility of existing commercial service pages before treating competitor keyword gaps as proven.",
        commercialService: null,
        commercialServiceId: null,
        priority: "HIGH",
        confidence: "HIGH",
        provenance: siProvenance,
        recommendedPageType: "EXISTING PAGE IMPROVEMENT",
        actionable: true,
      }),
    );
  }

  for (const keyword of search.customerKeywords) {
    const position = keyword.position;
    if (position == null || position <= 20) continue;
    const matched = matchService(keyword.keyword, catalogue.services);
    gaps.push(
      gap({
        id: `si-weak-ranking-${safePharmacySlug(keyword.keyword)}`,
        type: "KEYWORD_VISIBILITY_GAP",
        evidenceClass: "PROVEN_GAP",
        source: "Search Intelligence",
        currentState: `"${keyword.keyword}" ranks at position ${position}${keyword.rankingUrl ? ` on ${keyword.rankingUrl}` : ""}.`,
        evidence: [
          `Position=${position}.`,
          `Search volume=${keyword.searchVolume ?? "unknown"}.`,
          keyword.rankingUrl ? `Ranking URL=${keyword.rankingUrl}.` : "Ranking URL unknown.",
        ],
        whyItMatters:
          "The only collected ranking is outside the top 20, so current organic coverage is weak even where a page already exists.",
        recommendedAction: matched
          ? `Improve the existing ${matched.serviceName} page so it can rank for commercial queries, rather than relying on this weak informational ranking.`
          : "Improve commercial service pages. This ranking is informational and is not proof of commercial service coverage.",
        commercialService: matched?.serviceName || null,
        commercialServiceId: matched?.serviceId || null,
        priority: "HIGH",
        confidence: "HIGH",
        provenance: siProvenance,
        recommendedPageType: "EXISTING PAGE IMPROVEMENT",
        actionable: true,
      }),
    );
  }

  const rankingText = search.customerKeywords.map((k) => `${k.keyword} ${k.rankingUrl || ""}`).join(" ");
  const unrankedServices = catalogue.services.filter((service) => !overlaps(service.serviceName, rankingText) && !overlaps(service.serviceId, rankingText));
  if (collected && unrankedServices.length) {
    gaps.push(
      gap({
        id: "si-commercial-services-unranked",
        type: "KEYWORD_VISIBILITY_GAP",
        evidenceClass: "SUPPORTED_OPPORTUNITY",
        source: "Search Intelligence + commercial services",
        currentState: `Collected ranking keywords do not include ${unrankedServices.map((s) => s.serviceName).join(", ")}.`,
        evidence: [
          `Customer ranking keywords=${customerKeywords}.`,
          `Commercial services without a collected ranking match: ${unrankedServices.map((s) => s.serviceName).join(", ")}.`,
          sparse ? "Sparse footprint means this is an absence in the collected universe, not a competitor-keyword gap." : "Collected universe does not currently rank these commercial services.",
        ],
        whyItMatters:
          "The business sells digital-growth services, but Search Intelligence does not currently show those services ranking.",
        recommendedAction:
          "Improve or expand commercial service pages for the services that already exist in the catalogue, then re-measure rankings. Do not invent competitor gaps to justify this.",
        commercialService: unrankedServices[0]?.serviceName || null,
        commercialServiceId: unrankedServices[0]?.serviceId || null,
        priority: "MEDIUM",
        confidence: sparse ? "MEDIUM" : "HIGH",
        provenance: siProvenance,
        recommendedPageType: "EXISTING PAGE IMPROVEMENT",
        actionable: true,
      }),
    );
  }

  for (const service of catalogue.services) {
    const url = configuredServiceUrl(service, project);
    if (!url) {
      gaps.push(
        gap({
          id: `config-missing-page-${service.serviceId}`,
          type: "MISSING_SERVICE_PAGE",
          evidenceClass: "SUPPORTED_OPPORTUNITY",
          source: "Business / service configuration",
          currentState: `${service.serviceName} has no configured commercial page URL.`,
          evidence: [`Project commercial service ${service.serviceName} (${service.serviceId}) has no money-page or nav URL.`],
          whyItMatters: "A sold commercial service without a dedicated page is harder to rank for and harder for pharmacies to buy.",
          recommendedAction: `Create a dedicated ${service.serviceName} page after the Growth Plan is approved.`,
          commercialService: service.serviceName,
          commercialServiceId: service.serviceId,
          priority: "MEDIUM",
          confidence: "MEDIUM",
          provenance: {
            evidenceSource: "PROJECT_CONFIG",
            authority: "PERSISTED_PROVEN",
            sourceSystem: "growthEngineTenantServiceCatalogue",
            capturedAt: null,
          },
          recommendedPageType: "SERVICE PAGE",
          actionable: true,
        }),
      );
      continue;
    }
    if (isContactLike(url) && !overlaps(service.serviceName, "contact")) {
      gaps.push(
        gap({
          id: `config-weak-page-${service.serviceId}`,
          type: "WEAK_SERVICE_COVERAGE",
          evidenceClass: "SUPPORTED_OPPORTUNITY",
          source: "Business / service configuration",
          currentState: `${service.serviceName} is configured to ${url}, which is a contact page rather than a dedicated service page.`,
          evidence: [`serviceMoneyPages.${service.serviceId}=${url}`],
          whyItMatters: "Routing a commercial service to a contact page under-represents the offer in search and on the website.",
          recommendedAction: `Create or upgrade a dedicated ${service.serviceName} page. Do not generate it until the Growth Plan is approved.`,
          commercialService: service.serviceName,
          commercialServiceId: service.serviceId,
          priority: "MEDIUM",
          confidence: "MEDIUM",
          provenance: {
            evidenceSource: "PROJECT_CONFIG",
            authority: "PERSISTED_PROVEN",
            sourceSystem: "project-config-service-money-pages",
            capturedAt: null,
          },
          recommendedPageType: "SERVICE PAGE",
          actionable: true,
        }),
      );
    }
  }

  if (websiteComplete && websitePages > 0 && (website.analysis?.inventory.servicePages || 0) === 0) {
    gaps.push(
      gap({
        id: "website-structure-no-service-pages",
        type: "WEBSITE_STRUCTURE_GAP",
        evidenceClass: "SUPPORTED_OPPORTUNITY",
        source: "Website Intelligence",
        currentState: `${websitePages} pages inventoried and 0 dedicated service pages detected.`,
        evidence: [`Website inventory totalPages=${websitePages}, servicePages=0.`],
        whyItMatters: "Website inventory does not show dedicated service pages even though commercial services are configured.",
        recommendedAction: "Review website inventory against configured commercial URLs and strengthen service-page structure after plan approval.",
        commercialService: null,
        commercialServiceId: null,
        priority: "MEDIUM",
        confidence: "MEDIUM",
          provenance: {
            evidenceSource: "WEBSITE_INTELLIGENCE",
            authority: "PERSISTED_PROVEN",
            sourceSystem: "growthEngineWebsiteIntelligence",
            capturedAt: website?.generatedAt || null,
          },
        recommendedPageType: "SERVICE HUB",
        actionable: true,
      }),
    );
  }

  const competitorKeywordCount = search.summary?.competitorKeywordCount || 0;
  if (qualifiedCommercial === 0 || paidExpansions === 0 || competitorKeywordCount === 0) {
    limitations.push(
      "Qualified commercial competitors=0 and competitor keyword universes=0. Competitor keyword gaps are not proven.",
    );
    gaps.push(
      gap({
        id: "si-insufficient-competitor-evidence",
        type: "INSUFFICIENT_COMPETITOR_EVIDENCE",
        evidenceClass: "INSUFFICIENT_COMPETITOR_EVIDENCE",
        source: "Search Intelligence",
        currentState: `Organic/SERP candidates=${competitors.length}. Qualified commercial competitors=${qualifiedCommercial}. Paid competitor expansions=${paidExpansions}.`,
        evidence: [
          "Zero commercially qualified competitors were selected for paid keyword expansion.",
          "Organic/SERP candidates are search-overlap domains, not commercial competitors.",
          "Competitor keyword universes were not collected.",
        ],
        whyItMatters:
          "Without qualified commercial competitors and competitor keyword universes, we cannot prove a competitor keyword gap.",
        recommendedAction:
          "Do not create content from competitor gaps. Use customer ranking, website, and service-coverage evidence instead.",
        commercialService: null,
        commercialServiceId: null,
        priority: "LOW",
        confidence: "HIGH",
        provenance: siProvenance,
        competitorGap: false,
        recommendedPageType: "NO ACTION",
        actionable: false,
      }),
    );
  } else {
    for (const universe of search.competitorKeywordUniverses) {
      const unique = new Set(universe.keywords.map((row) => row.keyword.toLowerCase()));
      const customerSet = new Set(search.customerKeywords.map((row) => row.keyword.toLowerCase()));
      const missing = [...unique].filter((keyword) => !customerSet.has(keyword)).slice(0, 5);
      if (!missing.length) continue;
      gaps.push(
        gap({
          id: `si-competitor-gap-${safePharmacySlug(universe.domain)}`,
          type: "COMPETITOR_GAP",
          evidenceClass: "PROVEN_GAP",
          source: "Search Intelligence competitor keyword universe",
          currentState: `${universe.domain} ranks for ${unique.size} collected keywords; ${missing.length} are not in the customer universe.`,
          evidence: missing.map((keyword) => `${universe.domain} ranks for "${keyword}" and the customer universe does not.`),
          whyItMatters: "A qualified commercial competitor ranks for keywords this customer does not currently rank for.",
          recommendedAction: "Review these competitor keywords in the Growth Plan after approval. Do not generate content yet.",
          commercialService: null,
          commercialServiceId: null,
          priority: "HIGH",
          confidence: "MEDIUM",
          provenance: siProvenance,
          competitorGap: true,
          recommendedPageType: "COMMERCIAL LANDING PAGE",
          actionable: true,
        }),
      );
    }
  }

  if (sparse) {
    limitations.push(
      `Sparse customer organic footprint: ${customerKeywords} ranking keyword${customerKeywords === 1 ? "" : "s"} (threshold ${sparseThreshold}).`,
    );
  }

  const allowCompetitorGapFromGp01 = qualifiedCommercial > 0 && paidExpansions > 0;
  for (const action of gp01?.actions || []) {
    const type = mapGp01Type(action);
    if (type === "COMPETITOR_GAP" && !allowCompetitorGapFromGp01) {
      limitations.push(
        `Persisted GP-01 action "${action.primaryKeyword}" has ${action.competitorCount} historic competitor signals, but current Search Intelligence has 0 qualified commercial competitors. That is not treated as a current competitor gap.`,
      );
    }
    const matched = matchService(action.primaryKeyword, catalogue.services);
    const evidenceClass: NationalEvidenceClass =
      type === "COMPETITOR_GAP" && !allowCompetitorGapFromGp01
        ? "SUPPORTED_OPPORTUNITY"
        : action.gapEvidenceStatus === "PROVEN_UNTAPPED" || action.gapEvidenceStatus === "PROVEN_WEAK_COVERAGE"
          ? "PROVEN_GAP"
          : action.gapEvidenceStatus === "INSUFFICIENT_EVIDENCE"
            ? "INSUFFICIENT_COMPETITOR_EVIDENCE"
            : "SUPPORTED_OPPORTUNITY";
    gaps.push(
      gap({
        id: `gp01-${action.id}`,
        type: type === "COMPETITOR_GAP" && !allowCompetitorGapFromGp01 ? "SERP_OPPORTUNITY" : type,
        evidenceClass,
        source: gp01Fixture ? "Persisted GP-01 fixture" : "Persisted GP-01",
        currentState: `${action.title}. Gap ${action.gapEvidenceStatus}/${action.gapConfidence} retained from persisted intelligence.`,
        evidence: [
          ...action.evidenceReasons,
          `Gap evidence status ${action.gapEvidenceStatus} remains ${action.gapConfidence} confidence and is not upgraded.`,
          allowCompetitorGapFromGp01
            ? `Competitor signals=${action.competitorCount}.`
            : "Current Search Intelligence does not prove a commercial competitor keyword gap; GP-01 competitor signals are historic market evidence only.",
        ],
        whyItMatters: action.rationale,
        recommendedAction: action.recommendedNextStep,
        commercialService: matched?.serviceName || null,
        commercialServiceId: matched?.serviceId || null,
        priority: action.priority,
        confidence: action.gapConfidence === "HIGH" || action.gapConfidence === "MEDIUM" || action.gapConfidence === "LOW" ? action.gapConfidence : "LOW",
        provenance: {
          evidenceSource: gp01Fixture ? "FIXTURE" : "PROJECT_CONFIG",
          authority: gp01Fixture ? "FIXTURE_ONLY" : "PERSISTED_PROVEN",
          sourceSystem: gp01?.intelligenceSourceVersion || "growth-plan-intelligence-v1",
          capturedAt: gp01?.generatedAt || null,
        },
        competitorGap: type === "COMPETITOR_GAP" && allowCompetitorGapFromGp01,
        recommendedPageType: action.recommendedPageType,
        actionable: evidenceClass !== "INSUFFICIENT_COMPETITOR_EVIDENCE",
      }),
    );
  }

  const sorted = [...gaps].sort(sortGaps);
  if (sorted.some((item) => item.competitorGap) && (qualifiedCommercial === 0 || paidExpansions === 0)) {
    throw new Error("Competitor gaps must not be emitted without current competitor keyword evidence.");
  }

  return {
    version: NATIONAL_GROWTH_INTELLIGENCE_VERSION,
    slug: safe,
    growthPlatform: "national",
    generatedAt: new Date().toISOString(),
    status: collected ? "analysis_complete" : "draft",
    businessName: subject.businessName,
    subjectDomain: subject.subjectDomain,
    primaryMarket: subject.primaryMarket,
    commercialServices: catalogue.services,
    search: {
      status: search.status,
      customerKeywords,
      organicCandidates: competitors.length,
      qualifiedCommercialCompetitors: qualifiedCommercial,
      paidCompetitorExpansions: paidExpansions,
      sparse,
      sparseThreshold,
      evidenceSource: siSource,
      authority: String(siAuthority),
      capturedAt: search.capturedAt || null,
    },
    website: {
      complete: websiteComplete,
      totalPages: websitePages,
      servicePages: website?.analysis?.inventory.servicePages || 0,
      source: websiteComplete ? "WEBSITE_INTELLIGENCE" : configuredPages ? "PROJECT_CONFIG" : "NONE",
      configuredCommercialPages: configuredPages,
    },
    gaps: sorted,
    limitations,
    competitorGapsFabricated: false,
  };
}

export function actionableNationalGaps(report: NationalGrowthIntelligenceReport): NationalGrowthGap[] {
  return report.gaps.filter((item) => item.actionable && item.evidenceClass !== "INSUFFICIENT_COMPETITOR_EVIDENCE" && item.type !== "INSUFFICIENT_COMPETITOR_EVIDENCE");
}
