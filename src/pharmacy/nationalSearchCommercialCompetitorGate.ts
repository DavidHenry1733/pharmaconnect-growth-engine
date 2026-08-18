/**
 * NI-03C.1 — Commercial competitor gate for National Search Intelligence.
 *
 * Organic overlap is SERP competition, not commercial competition.
 * Paid competitor ranked-keyword expansion requires this gate.
 *
 * Tenant market/services are derived from subject intelligence, not a tenant slug.
 */
import { qualifyNationalCompetitor } from "./nationalCompetitorQualificationService.ts";
import { qualifyNationalCompetitorV2 } from "./nationalCompetitorQualificationV2Service.ts";
import { compareNationalCommercialServiceOverlap } from "./nationalCommercialServiceOverlap.ts";
import type { NationalIntelligenceSubject } from "./nationalIntelligenceSubjectResolver.ts";

export type NationalSearchCompetitorRole =
  | "commercial_competitor"
  | "adjacent_commercial_provider"
  | "serp_content_competitor"
  | "customer_market"
  | "publisher"
  | "education_academic"
  | "professional_body"
  | "directory_platform"
  | "generic_informational"
  | "insufficient_evidence"
  | "irrelevant";

export type CompetitorWebsiteEvidence = {
  domain: string;
  title?: string | null;
  websiteText?: string | null;
  reachable?: boolean;
};

export type NationalSearchCommercialGateInput = {
  domain: string;
  title?: string | null;
  websiteText?: string | null;
  url?: string | null;
  sharedKeywordCount?: number | null;
  organicEtv?: number | null;
  subject: Pick<NationalIntelligenceSubject, "subjectDomain" | "primaryMarket" | "country" | "commercialServices">;
  ownDomains?: string[];
  sparseCustomerFootprint?: boolean;
};

export type NationalSearchCommercialGateResult = {
  role: NationalSearchCompetitorRole;
  classification: "direct_competitor" | "adjacent_competitor" | "insufficient_evidence" | "excluded";
  qualification: "qualified" | "candidate" | "rejected";
  eligibleForKeywordExpansion: boolean;
  score: number;
  targetMarketRelevance: boolean;
  commercialProvider: boolean;
  serviceOverlap: boolean;
  marketRelevance: boolean;
  matchedServices: string[];
  tenantServices: string[];
  candidateServicesDetected: string[];
  overlappingServices: string[];
  nonOverlappingServices: string[];
  reasons: string[];
  exclusionReasons: string[];
  nonSelectionReason: string | null;
};

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "your", "our",
  "united", "kingdom", "great", "britain", "nationwide", "national",
]);

const ROLE_SIGNALS: Array<{ role: NationalSearchCompetitorRole; signals: string[] }> = [
  {
    role: "education_academic",
    signals: [
      "homework help",
      "peer-reviewed",
      "scientific journal",
      "university press",
      "textbook",
      "academic research",
      "doi:",
      "quiz",
      "study help",
      "elsevier",
      "open access articles",
    ],
  },
  {
    role: "publisher",
    signals: [
      "magazine",
      "journal",
      "editorial",
      "latest issue",
      "subscribe to our",
      "newsroom",
      "publication",
      "editor-in-chief",
      "trade press",
      "professional journal",
    ],
  },
  {
    role: "professional_body",
    signals: [
      "royal college",
      "professional body",
      "chartered",
      "membership benefits",
      "faculty of",
      "fellows",
      "professional standards",
      "register of members",
      "become a member",
      "representative organisation",
      "representative body",
      "represents independent",
      "industry body",
      "trade body",
      "statutory",
      "sector representation",
      "sector representative",
    ],
  },
  {
    role: "directory_platform",
    signals: [
      "business directory",
      "find a provider",
      "listings",
      "top agencies",
      "best agencies",
    ],
  },
  {
    role: "customer_market",
    signals: [
      "opening hours",
      "repeat prescription",
      "we dispense",
      "click and collect prescriptions",
      "add to basket",
      "add to cart",
      "store locator",
      "our stores",
      "shop now",
      "buy online",
      "health and beauty",
    ],
  },
  {
    role: "generic_informational",
    signals: [
      "encyclopedia",
      "wiki article",
      "what is a",
      "how-to guide",
      "patient information",
      "information for patients",
      "information for the public",
      "nhs community-pharmacy information",
      "community pharmacy england",
    ],
  },
];

const INFRASTRUCTURE_DOMAIN_PATTERNS = [
  /(^|\.)google\.(com|co\.\w{2}|com?\.\w{2})$/i,
  /(^|\.)bing\.com$/i,
  /(^|\.)yahoo\.com$/i,
  /(^|\.)duckduckgo\.com$/i,
  /(^|\.)yandex\.(com|ru)$/i,
  /(^|\.)baidu\.com$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)linkedin\.com$/i,
  /(^|\.)youtube\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)wikipedia\.org$/i,
  /(^|\.)gov\.uk$/i,
  /(^|\.)nhs\.uk$/i,
];

function normalise(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => normalise(value)).filter((value) => value.length > 2))];
}

export function tenantMarketTerms(subject: NationalSearchCommercialGateInput["subject"]): string[] {
  const serviceNames = (subject.commercialServices || []).map((row) => row.serviceName);
  const raw = [subject.primaryMarket, ...serviceNames].join(" ");
  const tokens = raw
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3 && !STOP_WORDS.has(token));
  return unique([subject.primaryMarket, ...serviceNames, ...tokens]);
}

export function tenantServiceNames(subject: NationalSearchCommercialGateInput["subject"]): string[] {
  return (subject.commercialServices || []).map((row) => row.serviceName).filter(Boolean);
}

function detectRole(text: string): NationalSearchCompetitorRole | null {
  for (const row of ROLE_SIGNALS) {
    if (row.signals.some((signal) => text.includes(signal))) return row.role;
  }
  return null;
}

function isInfrastructureDomain(domain: string, ownDomains: string[]): boolean {
  if (ownDomains.some((own) => domain === own || domain.endsWith(`.${own}`))) return true;
  return INFRASTRUCTURE_DOMAIN_PATTERNS.some((pattern) => pattern.test(domain));
}

function geographicRelevance(text: string, country: string, domain: string): boolean {
  const countryToken = normalise(country);
  if (countryToken && text.includes(countryToken)) return true;
  if (countryToken.includes("united kingdom") || countryToken === "uk") {
    if (domain.endsWith(".co.uk") || /\buk\b|united kingdom|uk-based|england|scotland|wales/.test(text)) {
      return true;
    }
  }
  if (countryToken && domain.endsWith(`.${countryToken.split(" ").pop()}`)) return true;
  return false;
}

export function assessNationalSearchCommercialCompetitor(
  input: NationalSearchCommercialGateInput,
): NationalSearchCommercialGateResult {
  const domain = normalise(input.domain).replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const websiteText = String(input.websiteText || "");
  const title = String(input.title || "");
  const text = normalise([domain, title, websiteText, input.url].join(" "));
  const ownDomains = input.ownDomains || [input.subject.subjectDomain];
  const marketTerms = tenantMarketTerms(input.subject);
  const services = tenantServiceNames(input.subject);
  const roleFromEvidence = detectRole(text);

  const v2 = qualifyNationalCompetitorV2({
    domain,
    title,
    snippet: null,
    url: input.url || `https://${domain}`,
    websiteText,
    ownDomains,
  });

  const v1 = qualifyNationalCompetitor({
    candidateName: title || domain,
    domain,
    websiteText: websiteText || title,
    targetCustomerMarket: [input.subject.primaryMarket, ...services].filter(Boolean).join(" "),
    targetServices: services,
    ownDomains,
  });

  const overlap = compareNationalCommercialServiceOverlap({
    tenantServices: services,
    websiteText: text,
  });
  const targetMarketRelevance = marketTerms.some((term) => text.includes(normalise(term)));
  const serviceOverlap = overlap.serviceOverlap;
  const organisationExcluded = v2.exclusionReasons.some((reason) =>
    /publisher|regulator|professional body|non-competing organisation|non-commercial evidence/i.test(reason),
  );
  const nonCommercialRole = roleFromEvidence != null
    && roleFromEvidence !== "commercial_competitor"
    && roleFromEvidence !== "adjacent_commercial_provider"
    && roleFromEvidence !== "serp_content_competitor"
    && roleFromEvidence !== "insufficient_evidence";
  const strongCommercialProvider = /\b(agency|we provide|we offer|our clients|our customers|book a call|request a quote|get started|free consultation|software provider)\b/.test(text)
    || v1.qualificationReasons.some((reason) => /commercial digital-service/i.test(reason));
  const commercialProvider =
    strongCommercialProvider
    && !nonCommercialRole
    && !organisationExcluded
    && roleFromEvidence !== "publisher"
    && roleFromEvidence !== "education_academic"
    && roleFromEvidence !== "professional_body"
    && roleFromEvidence !== "customer_market"
    && roleFromEvidence !== "directory_platform"
    && roleFromEvidence !== "generic_informational";
  const marketRelevance = v2.evidence.ukMarket || geographicRelevance(text, input.subject.country, domain);
  const infrastructure = isInfrastructureDomain(domain, ownDomains) || v1.rejectionReasons.some((reason) => /own domain/i.test(reason));

  const commercialGate =
    !infrastructure
    && !nonCommercialRole
    && !organisationExcluded
    && targetMarketRelevance
    && commercialProvider
    && serviceOverlap
    && marketRelevance;

  const reasons = unique([
    ...v2.reasons,
    ...v1.qualificationReasons,
    targetMarketRelevance ? "Tenant target-market terms appear in website evidence." : "",
    serviceOverlap ? `Material tenant service overlap: ${overlap.overlappingServices.join(", ")}.` : "No material tenant-service overlap evidenced.",
    overlap.overlappingPhrases.length ? `Overlapping service phrases: ${overlap.overlappingPhrases.join(", ")}.` : "",
    overlap.nonOverlappingServices.length ? `Non-overlapping services detected: ${overlap.nonOverlappingServices.join(", ")}.` : "",
    commercialProvider ? "Commercial provider evidence present." : "",
    marketRelevance ? "Geographic/commercial market evidence present." : "",
    input.sharedKeywordCount != null
      ? `DataForSEO intersections=${input.sharedKeywordCount} is organic keyword overlap (SERP evidence only), not commercial equivalence.`
      : "Organic overlap is SERP evidence only. Official Competitors Domain intersections do not establish commercial competition.",
  ]);

  const exclusionReasons = unique([
    ...v2.exclusionReasons,
    ...v1.rejectionReasons.filter((reason) => /own domain/i.test(reason)),
    nonCommercialRole && roleFromEvidence ? `Classified as ${roleFromEvidence.replace(/_/g, " ")} from website evidence.` : "",
  ]);

  const gateFields = {
    targetMarketRelevance,
    commercialProvider: Boolean(commercialProvider),
    serviceOverlap,
    marketRelevance,
    matchedServices: overlap.overlappingServices,
    tenantServices: overlap.tenantServices,
    candidateServicesDetected: overlap.candidateServicesDetected,
    overlappingServices: overlap.overlappingServices,
    nonOverlappingServices: overlap.nonOverlappingServices,
  };

  if (infrastructure) {
    return {
      role: "irrelevant",
      classification: "excluded",
      qualification: "rejected",
      eligibleForKeywordExpansion: false,
      score: v2.score,
      ...gateFields,
      reasons,
      exclusionReasons,
      nonSelectionReason: exclusionReasons[0] || "Domain is excluded from commercial competitor qualification.",
    };
  }

  if (nonCommercialRole && roleFromEvidence) {
    return {
      role: roleFromEvidence,
      classification: "insufficient_evidence",
      qualification: "candidate",
      eligibleForKeywordExpansion: false,
      score: v2.score,
      ...gateFields,
      commercialProvider: false,
      reasons,
      exclusionReasons,
      nonSelectionReason: `This domain competes in search. It is not a commercial competitor (${roleFromEvidence.replace(/_/g, " ")}).`,
    };
  }

  if (commercialGate) {
    const direct = v2.classification === "direct_competitor" || (v1.qualification === "qualified" && v2.evidence.multiServiceOverlap);
    return {
      role: "commercial_competitor",
      classification: direct ? "direct_competitor" : "adjacent_competitor",
      qualification: "qualified",
      eligibleForKeywordExpansion: true,
      score: Math.max(v2.score, v1.score),
      ...gateFields,
      reasons,
      exclusionReasons: [],
      nonSelectionReason: null,
    };
  }

  if (targetMarketRelevance && commercialProvider && !serviceOverlap && !infrastructure && !nonCommercialRole) {
    return {
      role: "adjacent_commercial_provider",
      classification: "insufficient_evidence",
      qualification: "candidate",
      eligibleForKeywordExpansion: false,
      score: Math.max(v2.score, v1.score),
      ...gateFields,
      reasons,
      exclusionReasons,
      nonSelectionReason: "Targets the same customer market as a commercial supplier, but website evidence does not show material overlap with the tenant's configured commercial services.",
    };
  }

  const hasOverlap = (input.sharedKeywordCount || 0) > 0;
  return {
    role: hasOverlap ? "serp_content_competitor" : "insufficient_evidence",
    classification: "insufficient_evidence",
    qualification: "candidate",
    eligibleForKeywordExpansion: false,
    score: Math.max(v2.score, v1.score),
    ...gateFields,
    reasons,
    exclusionReasons,
    nonSelectionReason: input.sparseCustomerFootprint
      ? "Customer organic footprint is sparse. Organic overlap alone is not commercial competitor proof, so this domain was not selected for paid keyword expansion."
      : "This domain competes in search. Commercial market, provider and tenant-service overlap were not all evidenced, so it was not selected for paid keyword expansion.",
  };
}

export function selectCompetitorsForKeywordExpansion<T extends {
  eligibleForKeywordExpansion: boolean;
  qualificationScore?: number;
  score?: number;
  sharedKeywordCount?: number | null;
  organicEtv?: number | null;
}>(
  competitors: T[],
  maximum: number,
): T[] {
  return competitors
    .filter((row) => row.eligibleForKeywordExpansion)
    .sort((a, b) => {
      const scoreDelta = (b.score || b.qualificationScore || 0) - (a.score || a.qualificationScore || 0);
      if (scoreDelta) return scoreDelta;
      const overlapDelta = (b.sharedKeywordCount || 0) - (a.sharedKeywordCount || 0);
      if (overlapDelta) return overlapDelta;
      return (b.organicEtv || 0) - (a.organicEtv || 0);
    })
    .slice(0, Math.max(0, maximum));
}
