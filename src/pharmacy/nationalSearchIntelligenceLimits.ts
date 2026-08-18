/**
 * NI-03C — Configurable National Search Intelligence collection bounds.
 * Defaults are commercial, not tenant-specific.
 * Override with env or collect options. Never hard-code a tenant slug or domain.
 */
export const NI03C_DEFAULT_LIMITS = {
  customerKeywordUniverse: 500,
  competitorDiscoveryCandidates: 20,
  qualifiedCompetitorsAnalysed: 5,
  competitorRankedKeywords: 300,
} as const;

export type NationalSearchIntelligenceLimits = {
  customerKeywordUniverse: number;
  competitorDiscoveryCandidates: number;
  qualifiedCompetitorsAnalysed: number;
  competitorRankedKeywords: number;
};

const ENV_KEYS = {
  customerKeywordUniverse: "NATIONAL_SEARCH_CUSTOMER_KEYWORD_LIMIT",
  competitorDiscoveryCandidates: "NATIONAL_SEARCH_COMPETITOR_DISCOVERY_LIMIT",
  qualifiedCompetitorsAnalysed: "NATIONAL_SEARCH_COMPETITOR_ANALYSIS_LIMIT",
  competitorRankedKeywords: "NATIONAL_SEARCH_COMPETITOR_KEYWORD_LIMIT",
} as const;

const BOUNDS: Record<keyof NationalSearchIntelligenceLimits, { min: number; max: number }> = {
  customerKeywordUniverse: { min: 1, max: 1000 },
  competitorDiscoveryCandidates: { min: 1, max: 100 },
  qualifiedCompetitorsAnalysed: { min: 1, max: 20 },
  competitorRankedKeywords: { min: 1, max: 1000 },
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
  };
}

export function planNationalSearchIntelligenceTasks(
  limits: NationalSearchIntelligenceLimits = resolveNationalSearchIntelligenceLimits(),
): {
  customerKeywordTasks: number;
  competitorDiscoveryTasks: number;
  competitorKeywordTasks: number;
  maximumPaidRequests: number;
} {
  return {
    customerKeywordTasks: 1,
    competitorDiscoveryTasks: 1,
    competitorKeywordTasks: limits.qualifiedCompetitorsAnalysed,
    maximumPaidRequests: 1 + 1 + limits.qualifiedCompetitorsAnalysed,
  };
}
