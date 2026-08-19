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
import {
  compareNationalCommercialServiceOverlap,
  extractMatchedSourceExcerpt,
} from "./nationalCommercialServiceOverlap.ts";
import type { NationalIntelligenceSubject } from "./nationalIntelligenceSubjectResolver.ts";

export type NationalSearchCompetitorRole =
  | "commercial_competitor"
  | "adjacent_commercial_provider"
  | "international_comparator"
  | "serp_content_competitor"
  | "customer_market"
  | "publisher"
  | "education_academic"
  | "professional_body"
  | "directory_platform"
  | "generic_informational"
  | "insufficient_evidence"
  | "irrelevant";

export type NationalSearchQualificationOutcome =
  | "direct_competitor"
  | "adjacent_provider"
  | "international_comparator"
  | "customer_market"
  | "rejected"
  | "insufficient_evidence";

export type CompetitorWebsiteEvidence = {
  domain: string;
  title?: string | null;
  websiteText?: string | null;
  reachable?: boolean;
};

export type NationalSearchCandidateQualificationEvidence = {
  candidateDomain: string;
  candidateSourceUrl: string;
  exactMatchedSourceText: string;
  matchedConfiguredService: string | null;
  targetCustomerEvidence: string | null;
  ukMarketEvidence: string | null;
  fetchedAt: string;
  evidenceProvenance: "candidate_website";
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
  fetchedAt?: string;
};

export type NationalSearchCommercialGateResult = {
  role: NationalSearchCompetitorRole;
  outcome: NationalSearchQualificationOutcome;
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
  qualificationEvidence: NationalSearchCandidateQualificationEvidence;
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasBoundedTerm(text: string, term: string): boolean {
  const needle = normalise(term);
  if (!needle || needle.length < 3) return false;
  return new RegExp(`\\b${escapeRegExp(needle)}\\b`, "i").test(text);
}

function firstExcerpt(text: string, phrases: string[]): string | null {
  for (const phrase of phrases) {
    const excerpt = extractMatchedSourceExcerpt(text, phrase);
    if (excerpt) return excerpt;
  }
  return null;
}

function ukMarketExcerpt(websiteText: string, country: string): string | null {
  const countryToken = normalise(country);
  const phrases = [
    "united kingdom",
    "uk-based",
    "uk based",
    "uk pharmacies",
    "uk pharmacy",
    "england",
    "scotland",
    "wales",
    "northern ireland",
  ];
  if (countryToken && countryToken !== "uk" && countryToken !== "united kingdom") {
    phrases.unshift(countryToken);
  }
  const excerpt = firstExcerpt(websiteText, phrases);
  if (excerpt) return excerpt;
  if (/\buk\b/.test(websiteText)) {
    return extractMatchedSourceExcerpt(websiteText, " uk ")
      || extractMatchedSourceExcerpt(websiteText, "uk-")
      || extractMatchedSourceExcerpt(websiteText, "uk ")
      || extractMatchedSourceExcerpt(websiteText, " uk");
  }
  return null;
}

function explicitForeignMarket(websiteText: string): boolean {
  return /\bunited states\b|\busa\b|\bu\.s\.a\.?\b|\bcanada\b|\baustralia\b|\bnew zealand\b|\bus pharmacies\b|\bamerican pharmacies\b/.test(websiteText);
}

function targetCustomerExcerpt(websiteText: string, terms: string[]): string | null {
  const preferred = terms.filter((term) => /pharmac|owner|business|community/.test(normalise(term)));
  return firstExcerpt(websiteText, preferred.length ? preferred : terms);
}

function isPmrOrDispensingProvider(text: string): boolean {
  return /\bpmr\b|patient medication record|dispensing software|dispensing system|pharmacy management system/.test(text);
}

function isQuestionnaireProvider(text: string): boolean {
  return /\bcppq\b|patient questionnaire|survey platform|community pharmacy patient questionnaire/.test(text);
}

function isGeneralHealthcareSupplier(text: string): boolean {
  return /\bhealthcare supplier\b|\bmedical supplies\b|\bpharmaceutical wholesaler\b|\bwholesale pharmacy\b/.test(text);
}

function strongCommercialProviderEvidence(text: string): boolean {
  return /\b(agency|we provide|we offer|our clients|our customers|book a call|request a quote|get started|free consultation|software provider)\b/.test(text);
}

function buildQualificationEvidence(input: {
  domain: string;
  sourceUrl: string;
  websiteText: string;
  overlappingServices: string[];
  overlappingPhrases: string[];
  targetExcerpt: string | null;
  ukExcerpt: string | null;
  fetchedAt: string;
}): NationalSearchCandidateQualificationEvidence {
  const matchedService = input.overlappingServices[0] || null;
  const phrase = input.overlappingPhrases[0] || "";
  const serviceExcerpt = phrase ? extractMatchedSourceExcerpt(input.websiteText, phrase) : "";
  return {
    candidateDomain: input.domain,
    candidateSourceUrl: input.sourceUrl,
    exactMatchedSourceText: serviceExcerpt || input.targetExcerpt || input.ukExcerpt || "",
    matchedConfiguredService: matchedService,
    targetCustomerEvidence: input.targetExcerpt,
    ukMarketEvidence: input.ukExcerpt,
    fetchedAt: input.fetchedAt,
    evidenceProvenance: "candidate_website",
  };
}

export function assessNationalSearchCommercialCompetitor(
  input: NationalSearchCommercialGateInput,
): NationalSearchCommercialGateResult {
  const domain = normalise(input.domain).replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const websiteText = String(input.websiteText || "");
  const title = String(input.title || "");
  const sourceUrl = String(input.url || `https://${domain}`).trim() || `https://${domain}`;
  const titleForEvidence = normalise(title) === domain ? "" : title;
  const websiteCorpus = normalise([titleForEvidence, websiteText].join(" "));
  const ownDomains = input.ownDomains || [input.subject.subjectDomain];
  const marketTerms = tenantMarketTerms(input.subject).filter((term) => !STOP_WORDS.has(normalise(term)) && normalise(term) !== "seo");
  const services = tenantServiceNames(input.subject);
  const roleFromEvidence = detectRole(websiteCorpus);
  const fetchedAt = input.fetchedAt || new Date().toISOString();

  const v2 = qualifyNationalCompetitorV2({
    domain,
    title,
    snippet: null,
    url: sourceUrl,
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
    websiteText: websiteCorpus,
  });
  const targetExcerpt = targetCustomerExcerpt(websiteCorpus, [
    input.subject.primaryMarket,
    "community pharmacies",
    "community pharmacy",
    "pharmacy businesses",
    "pharmacy business",
    "pharmacy owners",
    ...marketTerms,
  ]);
  const ukExcerpt = ukMarketExcerpt(websiteCorpus, input.subject.country);
  const targetMarketRelevance = Boolean(targetExcerpt) || marketTerms.some((term) => hasBoundedTerm(websiteCorpus, term));
  const serviceOverlap = overlap.serviceOverlap;
  const organisationExcluded = v2.exclusionReasons.some((reason) =>
    /publisher|regulator|professional body|non-competing organisation|non-commercial evidence/i.test(reason),
  );
  const pmrProvider = isPmrOrDispensingProvider(websiteCorpus);
  const questionnaireProvider = isQuestionnaireProvider(websiteCorpus);
  const healthcareSupplier = isGeneralHealthcareSupplier(websiteCorpus);
  const blockedDirectRole = pmrProvider || questionnaireProvider || healthcareSupplier;
  const nonCommercialRole = roleFromEvidence != null
    && roleFromEvidence !== "commercial_competitor"
    && roleFromEvidence !== "adjacent_commercial_provider"
    && roleFromEvidence !== "international_comparator"
    && roleFromEvidence !== "serp_content_competitor"
    && roleFromEvidence !== "insufficient_evidence";
  const commercialProvider =
    strongCommercialProviderEvidence(websiteCorpus)
    && !nonCommercialRole
    && !organisationExcluded;
  const marketRelevance = Boolean(ukExcerpt);
  const infrastructure = isInfrastructureDomain(domain, ownDomains) || v1.rejectionReasons.some((reason) => /own domain/i.test(reason));
  const foreignMarket = explicitForeignMarket(websiteCorpus);

  const commercialGate =
    !infrastructure
    && !nonCommercialRole
    && !organisationExcluded
    && !blockedDirectRole
    && targetMarketRelevance
    && commercialProvider
    && serviceOverlap
    && marketRelevance;

  const qualificationEvidence = buildQualificationEvidence({
    domain,
    sourceUrl,
    websiteText,
    overlappingServices: overlap.overlappingServices,
    overlappingPhrases: overlap.overlappingPhrases,
    targetExcerpt,
    ukExcerpt,
    fetchedAt,
  });

  const overlapReason = serviceOverlap && qualificationEvidence.candidateSourceUrl && qualificationEvidence.exactMatchedSourceText
    ? `Material overlap with configured tenant service ${overlap.overlappingServices.join(", ")} at ${qualificationEvidence.candidateSourceUrl}: "${qualificationEvidence.exactMatchedSourceText}".`
    : (serviceOverlap ? "Material tenant-service overlap requires a candidate source URL and matching source text." : "No material tenant-service overlap evidenced.");

  const reasons = unique([
    ...v2.reasons.filter((reason) => !/digital-service evidence/i.test(reason)),
    targetMarketRelevance ? "Tenant target-market terms appear in website evidence." : "",
    overlapReason,
    overlap.overlappingPhrases.length ? `Overlapping service phrases: ${overlap.overlappingPhrases.join(", ")}.` : "",
    overlap.nonOverlappingServices.length ? `Non-overlapping services detected: ${overlap.nonOverlappingServices.join(", ")}.` : "",
    commercialProvider ? "Commercial provider evidence present." : "",
    marketRelevance ? "UK-market evidence present on the candidate website." : "A .co.uk domain or SERP snippet is not UK pharmacy-market proof.",
    domain.endsWith(".co.uk") ? ".co.uk is supporting geography only and does not independently prove the UK pharmacy market." : "",
    input.sharedKeywordCount != null
      ? `DataForSEO intersections=${input.sharedKeywordCount} is organic keyword overlap (SERP evidence only), not commercial equivalence.`
      : "Organic overlap is SERP evidence only. Official Competitors Domain intersections do not establish commercial competition.",
  ]);

  const exclusionReasons = unique([
    ...v2.exclusionReasons,
    ...v1.rejectionReasons.filter((reason) => /own domain/i.test(reason)),
    nonCommercialRole && roleFromEvidence ? `Classified as ${roleFromEvidence.replace(/_/g, " ")} from website evidence.` : "",
    pmrProvider ? "Candidate is a PMR or dispensing-system provider, not a matching commercial-service competitor." : "",
    questionnaireProvider ? "Candidate is a questionnaire provider, not a matching commercial-service competitor." : "",
    healthcareSupplier ? "Candidate is a general healthcare supplier, not a matching commercial-service competitor." : "",
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
    qualificationEvidence,
  };

  if (infrastructure) {
    return {
      role: "irrelevant",
      outcome: "rejected",
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
    const outcome: NationalSearchQualificationOutcome = roleFromEvidence === "customer_market"
      ? "customer_market"
      : "rejected";
    return {
      role: roleFromEvidence,
      outcome,
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

  if (blockedDirectRole) {
    return {
      role: "adjacent_commercial_provider",
      outcome: "adjacent_provider",
      classification: "insufficient_evidence",
      qualification: "candidate",
      eligibleForKeywordExpansion: false,
      score: Math.max(v2.score, v1.score),
      ...gateFields,
      reasons,
      exclusionReasons,
      nonSelectionReason: pmrProvider
        ? "PMR or dispensing-system providers are adjacent suppliers, not direct commercial competitors."
        : questionnaireProvider
          ? "Questionnaire providers are adjacent suppliers, not direct commercial competitors."
          : "General healthcare suppliers are not direct commercial competitors.",
    };
  }

  if (commercialProvider && serviceOverlap && !marketRelevance && !infrastructure && !nonCommercialRole) {
    if (foreignMarket) {
      return {
        role: "international_comparator",
        outcome: "international_comparator",
        classification: "insufficient_evidence",
        qualification: "candidate",
        eligibleForKeywordExpansion: false,
        score: Math.max(v2.score, v1.score),
        ...gateFields,
        reasons,
        exclusionReasons,
        nonSelectionReason: "Overlapping commercial services were evidenced outside the UK pharmacy market. International comparators are not selected for paid keyword expansion.",
      };
    }
  }

  if (commercialGate) {
    return {
      role: "commercial_competitor",
      outcome: "direct_competitor",
      classification: "direct_competitor",
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
      outcome: "adjacent_provider",
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
    outcome: "insufficient_evidence",
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
