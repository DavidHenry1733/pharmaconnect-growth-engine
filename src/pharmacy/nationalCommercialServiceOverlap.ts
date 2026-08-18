/**
 * NI-03C.2 — Material commercial service-overlap comparison.
 *
 * Tenant commercial services are the authority. Overlap requires a
 * material service phrase, not a broad word such as digital/software/
 * technology/growth/service/pharmacy.
 *
 * Phrase families reuse the existing V2/enrichment digital-service groups.
 */
export type MaterialServiceOverlap = {
  tenantServices: string[];
  candidateServicesDetected: string[];
  overlappingServices: string[];
  overlappingPhrases: string[];
  nonOverlappingServices: string[];
  serviceOverlap: boolean;
};

const BROAD_ALONE = new Set([
  "digital",
  "software",
  "technology",
  "growth",
  "service",
  "services",
  "pharmacy",
  "pharmacies",
  "pharmacist",
  "website",
  "websites",
  "email",
  "audit",
  "audits",
  "marketing",
  "platform",
  "system",
  "solution",
  "solutions",
  "provider",
  "national",
  "local",
  "online",
  "uk",
]);

/**
 * Canonical offer concepts. Tenant matchers bind configured service names
 * to phrase families already used by V2 qualification / evidence enrichment.
 */
const TENANT_SERVICE_CONCEPTS: Array<{
  id: string;
  tenantMatcher: RegExp;
  phrases: string[];
}> = [
  {
    id: "website_design",
    tenantMatcher: /web(?:site)?\s*(?:design|development)|website development/i,
    phrases: [
      "website design",
      "web design",
      "website development",
      "web development",
      "pharmacy website design",
    ],
  },
  {
    id: "seo",
    tenantMatcher: /\bseo\b|search engine opt/i,
    phrases: [
      "seo",
      "local seo",
      "search engine optimisation",
      "search engine optimization",
      "local search",
    ],
  },
  {
    id: "email_marketing",
    tenantMatcher: /email/i,
    phrases: [
      "email marketing",
      "email campaigns",
      "email automation",
    ],
  },
  {
    id: "hosting",
    tenantMatcher: /hosting/i,
    phrases: [
      "website hosting",
      "web hosting",
      "hosting",
    ],
  },
  {
    id: "digital_marketing",
    tenantMatcher: /digital marketing|ppc|paid media|online marketing/i,
    phrases: [
      "digital marketing",
      "online marketing",
      "pharmacy marketing",
      "marketing agency",
    ],
  },
  {
    id: "growth_audit",
    tenantMatcher: /growth audit|digital growth|growth audits/i,
    phrases: [
      "growth audit",
      "growth audits",
      "digital audit",
      "marketing audit",
      "digital growth",
    ],
  },
];

/** Labelling only — never used as a negative eligibility list. */
const OTHER_OFFER_PHRASES = [
  "pmr",
  "patient medication record",
  "dispensing software",
  "pharmacy software",
  "prescription management",
  "stock management",
  "survey platform",
  "cppq",
  "community pharmacy patient questionnaire",
  "training",
  "recruitment",
  "wholesale",
  "publication",
  "news",
  "professional body",
];

function normalise(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => normalise(value)).filter(Boolean))];
}

function hasPhrase(text: string, phrase: string): boolean {
  const needle = normalise(phrase);
  if (!needle) return false;
  if (/^[a-z0-9]+$/.test(needle)) {
    return new RegExp(`\\b${needle}\\b`, "i").test(text);
  }
  return text.includes(needle);
}

function conceptsForTenantService(serviceName: string): typeof TENANT_SERVICE_CONCEPTS {
  return TENANT_SERVICE_CONCEPTS.filter((concept) => concept.tenantMatcher.test(serviceName));
}

function fallbackPhrases(serviceName: string): string[] {
  const stripped = normalise(serviceName)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3 && !BROAD_ALONE.has(token))
    .join(" ");
  const phrases = [normalise(serviceName)];
  if (stripped && stripped !== normalise(serviceName)) phrases.push(stripped);
  return unique(phrases).filter((phrase) => !BROAD_ALONE.has(phrase));
}

export function compareNationalCommercialServiceOverlap(input: {
  tenantServices: string[];
  websiteText: string;
}): MaterialServiceOverlap {
  const text = normalise(input.websiteText);
  const tenantServices = unique(input.tenantServices);
  const overlappingServices: string[] = [];
  const overlappingPhrases: string[] = [];
  const candidateFromTenantConcepts: string[] = [];

  for (const service of tenantServices) {
    const concepts = conceptsForTenantService(service);
    const phrases = unique([
      ...concepts.flatMap((concept) => concept.phrases),
      ...(concepts.length ? [] : fallbackPhrases(service)),
    ]);
    const matched = phrases.filter((phrase) => hasPhrase(text, phrase) && !BROAD_ALONE.has(phrase));
    if (matched.length) {
      overlappingServices.push(service);
      overlappingPhrases.push(...matched);
    }
  }

  for (const concept of TENANT_SERVICE_CONCEPTS) {
    for (const phrase of concept.phrases) {
      if (hasPhrase(text, phrase) && !BROAD_ALONE.has(phrase)) {
        candidateFromTenantConcepts.push(phrase);
      }
    }
  }

  const otherDetected = OTHER_OFFER_PHRASES.filter((phrase) => hasPhrase(text, phrase));
  const candidateServicesDetected = unique([...candidateFromTenantConcepts, ...otherDetected]);
  const overlappingPhraseSet = new Set(unique(overlappingPhrases));
  const nonOverlappingServices = candidateServicesDetected.filter((phrase) => !overlappingPhraseSet.has(phrase));

  return {
    tenantServices,
    candidateServicesDetected,
    overlappingServices: unique(overlappingServices),
    overlappingPhrases: unique(overlappingPhrases),
    nonOverlappingServices,
    serviceOverlap: overlappingServices.length > 0,
  };
}
