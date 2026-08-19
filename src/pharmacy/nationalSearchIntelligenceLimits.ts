/**
 * NI-03C — Configurable National Search Intelligence collection bounds.
 * Defaults are commercial, not tenant-specific.
 * Override with env or collect options. Never hard-code a tenant slug or domain.
 */
export const SPARSE_SEARCH_INTELLIGENCE_MAX_DIRECT_EXPANSION = 3;
export const SPARSE_SEARCH_INTELLIGENCE_MAX_TASKS = 8;

export const NI03C_DEFAULT_LIMITS = {
  customerKeywordUniverse: 500,
  competitorDiscoveryCandidates: 20,
  qualifiedCompetitorsAnalysed: 5,
  competitorRankedKeywords: 300,
  sparseCustomerKeywordThreshold: 10,
} as const;

export type NationalSearchIntelligenceLimits = {
  customerKeywordUniverse: number;
  competitorDiscoveryCandidates: number;
  qualifiedCompetitorsAnalysed: number;
  competitorRankedKeywords: number;
  sparseCustomerKeywordThreshold: number;
};

const ENV_KEYS = {
  customerKeywordUniverse: "NATIONAL_SEARCH_CUSTOMER_KEYWORD_LIMIT",
  competitorDiscoveryCandidates: "NATIONAL_SEARCH_COMPETITOR_DISCOVERY_LIMIT",
  qualifiedCompetitorsAnalysed: "NATIONAL_SEARCH_COMPETITOR_ANALYSIS_LIMIT",
  competitorRankedKeywords: "NATIONAL_SEARCH_COMPETITOR_KEYWORD_LIMIT",
  sparseCustomerKeywordThreshold: "NATIONAL_SEARCH_SPARSE_FOOTPRINT_THRESHOLD",
} as const;

const BOUNDS: Record<keyof NationalSearchIntelligenceLimits, { min: number; max: number }> = {
  customerKeywordUniverse: { min: 1, max: 1000 },
  competitorDiscoveryCandidates: { min: 1, max: 100 },
  qualifiedCompetitorsAnalysed: { min: 1, max: 20 },
  competitorRankedKeywords: { min: 1, max: 1000 },
  sparseCustomerKeywordThreshold: { min: 1, max: 100 },
};

function envInt(name: string): number | undefined {
  const raw = String(process.env[name] || "").trim();
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) ? n : undefined;
}

function clampLimit(key: keyof NationalSearchIntelligenceLimits, value: number): number {
  const bound = BOUNDS[key];
  return Math.min(bound.max, Math.max(bound.min, Math.trunc(value)));
}

export function resolveNationalSearchIntelligenceLimits(
  overrides: Partial<NationalSearchIntelligenceLimits> = {},
): NationalSearchIntelligenceLimits {
  const fromEnv: Partial<NationalSearchIntelligenceLimits> = {};
  (Object.keys(ENV_KEYS) as Array<keyof typeof ENV_KEYS>).forEach((key) => {
    const value = envInt(ENV_KEYS[key]);
    if (value != null) fromEnv[key] = value;
  });
  return {
    customerKeywordUniverse: clampLimit(
      "customerKeywordUniverse",
      overrides.customerKeywordUniverse ?? fromEnv.customerKeywordUniverse ?? NI03C_DEFAULT_LIMITS.customerKeywordUniverse,
    ),
    competitorDiscoveryCandidates: clampLimit(
      "competitorDiscoveryCandidates",
      overrides.competitorDiscoveryCandidates
        ?? fromEnv.competitorDiscoveryCandidates
        ?? NI03C_DEFAULT_LIMITS.competitorDiscoveryCandidates,
    ),
    qualifiedCompetitorsAnalysed: clampLimit(
      "qualifiedCompetitorsAnalysed",
      overrides.qualifiedCompetitorsAnalysed
        ?? fromEnv.qualifiedCompetitorsAnalysed
        ?? NI03C_DEFAULT_LIMITS.qualifiedCompetitorsAnalysed,
    ),
    competitorRankedKeywords: clampLimit(
      "competitorRankedKeywords",
      overrides.competitorRankedKeywords
        ?? fromEnv.competitorRankedKeywords
        ?? NI03C_DEFAULT_LIMITS.competitorRankedKeywords,
    ),
    sparseCustomerKeywordThreshold: clampLimit(
      "sparseCustomerKeywordThreshold",
      overrides.sparseCustomerKeywordThreshold
        ?? fromEnv.sparseCustomerKeywordThreshold
        ?? NI03C_DEFAULT_LIMITS.sparseCustomerKeywordThreshold,
    ),
  };
}

export function isSparseCustomerKeywordUniverse(
  keywordCount: number,
  threshold: number = resolveNationalSearchIntelligenceLimits().sparseCustomerKeywordThreshold,
): boolean {
  return Number(keywordCount || 0) < threshold;
}

export function describeCustomerOrganicFootprint(
  keywordCount: number,
  limits: NationalSearchIntelligenceLimits = resolveNationalSearchIntelligenceLimits(),
): {
  keywordCount: number;
  sparse: boolean;
  threshold: number;
  sufficientForHighConfidenceCommercialDiscovery: boolean;
  note: string;
} {
  const sparse = isSparseCustomerKeywordUniverse(keywordCount, limits.sparseCustomerKeywordThreshold);
  return {
    keywordCount: Number(keywordCount || 0),
    sparse,
    threshold: limits.sparseCustomerKeywordThreshold,
    sufficientForHighConfidenceCommercialDiscovery: !sparse,
    note: sparse
      ? "Customer organic footprint is sparse. Commercial discovery uses Business Intelligence seed keywords with serp_competitors. Competitors Domain is not used as commercial discovery."
      : "Customer organic footprint is sufficient for high-confidence commercial competitor discovery.",
  };
}

export function planNationalSearchIntelligenceTasks(
  limits: NationalSearchIntelligenceLimits = resolveNationalSearchIntelligenceLimits(),
  options: { sparse?: boolean } = {},
): {
  customerKeywordTasks: number;
  competitorDiscoveryTasks: number;
  competitorKeywordTasks: number;
  domainIntersectionTasks: number;
  maximumPaidRequests: number;
} {
  if (options.sparse) {
    const expansion = Math.min(SPARSE_SEARCH_INTELLIGENCE_MAX_DIRECT_EXPANSION, limits.qualifiedCompetitorsAnalysed);
    return {
      customerKeywordTasks: 1,
      competitorDiscoveryTasks: 1,
      competitorKeywordTasks: expansion,
      domainIntersectionTasks: expansion,
      maximumPaidRequests: Math.min(
        SPARSE_SEARCH_INTELLIGENCE_MAX_TASKS,
        1 + 1 + expansion + expansion,
      ),
    };
  }
  return {
    customerKeywordTasks: 1,
    competitorDiscoveryTasks: 1,
    competitorKeywordTasks: limits.qualifiedCompetitorsAnalysed,
    domainIntersectionTasks: 0,
    maximumPaidRequests: 1 + 1 + limits.qualifiedCompetitorsAnalysed,
  };
}
