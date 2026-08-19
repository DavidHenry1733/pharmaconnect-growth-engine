/**
 * Search Intelligence commercial seed keywords from persisted Business Intelligence.
 * Generic: no tenant-specific service strings are hardcoded here.
 */

export const SEARCH_INTELLIGENCE_MAX_COMMERCIAL_SEEDS = 6;

export type SearchIntelligenceSeedSource = {
  services?: string[];
  targetCustomerMarket?: string;
  country?: string;
};

function clean(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normaliseSeed(value: unknown): string {
  return clean(value).toLowerCase();
}

export function normaliseSearchIntelligenceCommercialSeeds(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalised = normaliseSeed(value);
    if (!normalised || normalised.length < 3 || seen.has(normalised)) continue;
    seen.add(normalised);
    out.push(normalised);
  }
  return out;
}

export function buildSearchIntelligenceCommercialSeeds(
  source: SearchIntelligenceSeedSource,
): string[] {
  const services = Array.isArray(source.services) ? source.services : [];
  const target = clean(source.targetCustomerMarket);
  const seeds = normaliseSearchIntelligenceCommercialSeeds([
    ...services,
    target,
  ]);
  return seeds.slice(0, SEARCH_INTELLIGENCE_MAX_COMMERCIAL_SEEDS);
}

export function buildSerpCompetitorsLivePayload(input: {
  keywords: string[];
  locationCode: number;
  languageCode?: string;
  limit?: number;
}): Array<{
  keywords: string[];
  location_code: number;
  language_code: string;
  item_types: ["organic"];
  include_clickstream_data: false;
  limit: number;
}> {
  const keywords = normaliseSearchIntelligenceCommercialSeeds(input.keywords)
    .slice(0, SEARCH_INTELLIGENCE_MAX_COMMERCIAL_SEEDS);
  return [{
    keywords,
    location_code: Number(input.locationCode),
    language_code: input.languageCode || "en",
    item_types: ["organic"],
    include_clickstream_data: false,
    limit: Math.min(Math.max(input.limit || 20, 1), 20),
  }];
}
