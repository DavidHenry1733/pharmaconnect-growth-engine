import fs from "node:fs";
import path from "node:path";
import { buildPharmaConnectCommercialKeywordTaxonomy } from "./pharmaConnectCommercialKeywordTaxonomy.ts";
import { scoreRankedKeyword } from "./commercialKeywordScoringService.ts";
import { readMarketOpportunityIntelligenceSnapshot } from "./marketOpportunityIntelligenceService.ts";
import type { DataForSeoRankedKeyword } from "./dataForSeoRankedKeywordIntelligenceService.ts";

const DATA_DIR = path.join(process.cwd(), "data/national-growth-engine");
const FIXTURE_DIR = path.join(process.cwd(), "fixtures/national-growth-engine");
const VERIFIED_FILE = "pharmaconnect-verified-national-competitors.json";
const V2_FILE = "pharmaconnect-market-opportunity-intelligence-v2.json";

export const NI02C_ENDPOINTS = {
  rankedKeywords: "https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live",
  keywordsForSite: "https://api.dataforseo.com/v3/dataforseo_labs/google/keywords_for_site/live",
  domainIntersection: "https://api.dataforseo.com/v3/dataforseo_labs/google/domain_intersection/live",
} as const;

export const NI02C_LIMITS = {
  directCompetitors: 6,
  rankedKeywordLimit: 250,
  keywordsForSiteCompetitors: 3,
  keywordsForSiteLimit: 100,
  domainGapCompetitors: 3,
  domainGapLimit: 100,
  subjectKeywordLimit: 250,
} as const;

type SourceType =
  | "ranked_keyword"
  | "keywords_for_site"
  | "domain_intersection_gap"
  | "persisted_v1";

type OpportunityType =
  | "MONEY_KEYWORD"
  | "COMMERCIAL_SUPPORT"
  | "AUTHORITY_SUPPORT"
  | "NEGATIVE_IRRELEVANT"
  | "REVIEW";

interface EvidenceRow extends DataForSeoRankedKeyword {
  sourceType: SourceType;
  sourceDomain: string;
  sourceClassification: "direct_competitor" | "adjacent_competitor" | "subject";
}

export interface MarketUniverseV2Snapshot {
  version: 2;
  generatedAt: string;
  subjectDomain: "pharmaconnect.uk";
  market: string;
  country: "United Kingdom";
  liveExecution: boolean;
  endpoints: Array<{ endpoint: string; used: boolean; requests: number; tasks: number; cost: number }>;
  costs: { requests: number; tasks: number; totalCost: number };
  limits: typeof NI02C_LIMITS;
  universe: Array<{
    keyword: string;
    type: OpportunityType;
    qualification: "QUALIFIED" | "REJECTED" | "REVIEW";
    gapType: "UNTAPPED" | "WEAK_COVERAGE" | "DEFEND_IMPROVE" | "NEW_MARKET" | "AUTHORITY_SUPPORT" | "REVIEW";
    searchVolume: number | null;
    cpc: number | null;
    paidCompetition: number | null;
    keywordDifficulty: number | null;
    intent: string | null;
    directCompetitorsRanking: number;
    bestCompetitorDomain: string | null;
    bestCompetitorPosition: number | null;
    bestRankingUrl: string | null;
    subjectPosition: number | null;
    subjectRankingUrl: string | null;
    score: number;
    priority: "HIGH" | "MEDIUM" | "LOW";
    sources: SourceType[];
    reasons: string[];
  }>;
  topCompetitorPages: Array<{
    domain: string;
    url: string;
    qualifiedKeywordCount: number;
    searchDemand: number;
    bestPosition: number | null;
    strongestKeywords: string[];
  }>;
  summary: {
    raw: number;
    unique: number;
    moneyKeywords: number;
    commercialSupport: number;
    authoritySupport: number;
    rejected: number;
    review: number;
    untapped: number;
    weakCoverage: number;
    defendImprove: number;
    newMarket: number;
    qualifiedCommercialSearchDemand: number;
    supportingSearchDemand: number;
    unknownGapRate: number;
    intentCoverage: number;
    difficultyCoverage: number;
    rankingUrlCoverage: number;
  };
  diagnostics: {
    original81RowsAvailable: boolean;
    primaryLimitation: "DISCOVERY" | "TAXONOMY" | "BOTH";
    notes: string[];
  };
}

function json<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function firstExisting(files: string[]): string | null {
  return files.find((file) => fs.existsSync(file)) || null;
}

function verifiedPath(): string {
  const file = firstExisting([
    path.join(DATA_DIR, VERIFIED_FILE),
    path.join(FIXTURE_DIR, VERIFIED_FILE),
  ]);
  if (!file) throw new Error("Verified national competitor fixture not found");
  return file;
}

function v2DataPath(): string {
  return path.join(DATA_DIR, V2_FILE);
}

function v2FixturePath(): string {
  return path.join(FIXTURE_DIR, V2_FILE);
}

function key(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function n(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function credentials() {
  const login = process.env.DATAFORSEO_LOGIN || process.env.DATAFORSEO_API_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD || process.env.DATAFORSEO_API_PASSWORD;
  if (!login || !password) throw new Error("DataForSEO credentials unavailable");
  return { login, password };
}

async function postDataForSeo(endpoint: string, body: unknown): Promise<any> {
  const { login, password } = credentials();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: "Basic " + Buffer.from(`${login}:${password}`).toString("base64"),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || payload?.status_code !== 20000) {
    throw new Error(`DataForSEO request failed: ${endpoint} ${response.status} ${payload?.status_code || "unknown"}`);
  }
  return payload;
}

function parseRankedItems(payload: any, sourceType: SourceType, sourceDomain: string, sourceClassification: EvidenceRow["sourceClassification"]): { rows: EvidenceRow[]; cost: number; tasks: number } {
  const task = payload?.tasks?.[0] || {};
  const items = task?.result?.[0]?.items || [];
  return {
    rows: items.map((item: any) => {
      const keywordData = item?.keyword_data || {};
      const keywordInfo = keywordData?.keyword_info || {};
      const ranked = item?.ranked_serp_element?.serp_item || item?.ranked_serp_element || {};
      return {
        keyword: String(keywordData?.keyword || item?.keyword || "").trim(),
        position: n(ranked?.rank_absolute ?? ranked?.rank_group ?? item?.rank_absolute),
        searchVolume: n(keywordInfo?.search_volume ?? item?.search_volume),
        cpc: n(keywordInfo?.cpc ?? item?.cpc),
        competition: n(keywordInfo?.competition ?? item?.competition),
        url: ranked?.url || item?.url || null,
        sourceType,
        sourceDomain,
        sourceClassification,
      } satisfies EvidenceRow;
    }).filter((row: EvidenceRow) => row.keyword),
    cost: typeof task.cost === "number" ? task.cost : 0,
    tasks: task ? 1 : 0,
  };
}

function prioritise(score: number): "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 80) return "HIGH";
  if (score >= 60) return "MEDIUM";
  return "LOW";
}

function buildFromRows(rows: EvidenceRow[], liveExecution: boolean, endpointUsage: MarketUniverseV2Snapshot["endpoints"]): MarketUniverseV2Snapshot {
  const taxonomy = buildPharmaConnectCommercialKeywordTaxonomy();
  const grouped = new Map<string, EvidenceRow[]>();
  for (const row of rows) {
    const k = key(row.keyword);
    if (!k) continue;
    grouped.set(k, [...(grouped.get(k) || []), row]);
  }

  const universe = [...grouped.entries()].map(([_, evidence]) => {
    const best = [...evidence].sort((a, b) => (a.position || 999) - (b.position || 999))[0];
    const scored = scoreRankedKeyword(best, taxonomy);
    const directRankers = evidence.filter((row) => row.sourceClassification === "direct_competitor");
    const subject = evidence.find((row) => row.sourceClassification === "subject") || null;
    const hasGap = evidence.some((row) => row.sourceType === "domain_intersection_gap");
    const qualification =
      scored.classification === "high_commercial_relevance" || scored.classification === "commercial_relevance"
        ? "QUALIFIED"
        : scored.classification === "negative_intent" || scored.classification === "irrelevant"
          ? "REJECTED"
          : "REVIEW";
    const supportType: OpportunityType =
      qualification !== "QUALIFIED"
        ? qualification === "REJECTED" ? "NEGATIVE_IRRELEVANT" : "REVIEW"
        : scored.highIntentMatches.length ? "MONEY_KEYWORD" : "COMMERCIAL_SUPPORT";
    const volume = Math.max(...evidence.map((row) => row.searchVolume || 0), 0) || null;
    const bestCompetitor = evidence.find((row) => row.sourceClassification === "direct_competitor") || best;
    const gapType =
      qualification !== "QUALIFIED" ? "REVIEW" :
      hasGap ? "UNTAPPED" :
      !subject && liveExecution ? "UNTAPPED" :
      subject && best.position && subject.position && subject.position > best.position + 10 ? "WEAK_COVERAGE" :
      subject ? "DEFEND_IMPROVE" :
      "NEW_MARKET";
    let score = Math.min(100, Math.max(0,
      Math.round(
        Math.max(0, scored.positiveScore - scored.negativeScore) / 4 +
        (volume ? Math.min(20, volume / 10) : 0) +
        Math.min(25, directRankers.length * 8) +
        ((best.position || 999) <= 10 ? 12 : 4) +
        (gapType === "UNTAPPED" ? 15 : gapType === "WEAK_COVERAGE" ? 10 : 0),
      ),
    ));
    if (qualification !== "QUALIFIED") score = Math.min(score, 40);
    const reasons = [
      ...scored.highIntentMatches.map((term) => `High-intent term: ${term}`),
      ...scored.serviceMatches.map((term) => `Service term: ${term}`),
      ...scored.negativeMatches.map((term) => `Negative term: ${term}`),
      `${directRankers.length} verified direct competitor(s) rank.`,
      volume ? `Search volume ${volume}.` : "Search volume not available.",
      best.position ? `Best competitor position ${best.position}.` : "Best competitor position not available.",
      subject ? `PharmaConnect position ${subject.position ?? "not available"}.` : "PharmaConnect subject coverage not observed in this evidence set.",
    ];
    return {
      keyword: best.keyword,
      type: supportType,
      qualification,
      gapType,
      searchVolume: volume,
      cpc: evidence.find((row) => row.cpc !== null)?.cpc ?? null,
      paidCompetition: evidence.find((row) => row.competition !== null)?.competition ?? null,
      keywordDifficulty: null,
      intent: null,
      directCompetitorsRanking: directRankers.length,
      bestCompetitorDomain: bestCompetitor.sourceDomain,
      bestCompetitorPosition: best.position,
      bestRankingUrl: best.url,
      subjectPosition: subject?.position ?? null,
      subjectRankingUrl: subject?.url ?? null,
      score,
      priority: prioritise(score),
      sources: [...new Set(evidence.map((row) => row.sourceType))],
      reasons,
    };
  }).sort((a, b) => b.score - a.score || (b.searchVolume || 0) - (a.searchVolume || 0));

  const pageMap = new Map<string, MarketUniverseV2Snapshot["topCompetitorPages"][number]>();
  for (const item of universe.filter((row) => row.qualification === "QUALIFIED")) {
    for (const row of grouped.get(key(item.keyword)) || []) {
      if (!row.url || row.sourceClassification === "subject") continue;
      const pageKey = `${row.sourceDomain} ${row.url}`;
      const current = pageMap.get(pageKey) || {
        domain: row.sourceDomain,
        url: row.url,
        qualifiedKeywordCount: 0,
        searchDemand: 0,
        bestPosition: row.position,
        strongestKeywords: [],
      };
      current.qualifiedKeywordCount += 1;
      current.searchDemand += item.searchVolume || 0;
      current.bestPosition = Math.min(current.bestPosition || 999, row.position || 999);
      current.strongestKeywords.push(item.keyword);
      pageMap.set(pageKey, current);
    }
  }

  const money = universe.filter((row) => row.type === "MONEY_KEYWORD");
  const commercialSupport = universe.filter((row) => row.type === "COMMERCIAL_SUPPORT");
  const authority = universe.filter((row) => row.type === "AUTHORITY_SUPPORT");
  const qualifiedDemand = money.reduce((sum, row) => sum + (row.searchVolume || 0), 0);
  const supportingDemand = commercialSupport.reduce((sum, row) => sum + (row.searchVolume || 0), 0);
  const cost = endpointUsage.reduce((sum, row) => sum + row.cost, 0);
  const requests = endpointUsage.reduce((sum, row) => sum + row.requests, 0);
  const tasks = endpointUsage.reduce((sum, row) => sum + row.tasks, 0);

  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    subjectDomain: "pharmaconnect.uk",
    market: "UK Community Pharmacy Digital Growth",
    country: "United Kingdom",
    liveExecution,
    endpoints: endpointUsage,
    costs: { requests, tasks, totalCost: cost },
    limits: NI02C_LIMITS,
    universe,
    topCompetitorPages: [...pageMap.values()].sort((a, b) => b.searchDemand - a.searchDemand).slice(0, 25),
    summary: {
      raw: rows.length,
      unique: universe.length,
      moneyKeywords: money.length,
      commercialSupport: commercialSupport.length,
      authoritySupport: authority.length,
      rejected: universe.filter((row) => row.qualification === "REJECTED").length,
      review: universe.filter((row) => row.qualification === "REVIEW").length,
      untapped: universe.filter((row) => row.gapType === "UNTAPPED").length,
      weakCoverage: universe.filter((row) => row.gapType === "WEAK_COVERAGE").length,
      defendImprove: universe.filter((row) => row.gapType === "DEFEND_IMPROVE").length,
      newMarket: universe.filter((row) => row.gapType === "NEW_MARKET").length,
      qualifiedCommercialSearchDemand: qualifiedDemand,
      supportingSearchDemand: supportingDemand,
      unknownGapRate: universe.length ? universe.filter((row) => row.gapType === "REVIEW").length / universe.length : 0,
      intentCoverage: universe.filter((row) => row.intent).length,
      difficultyCoverage: universe.filter((row) => row.keywordDifficulty !== null).length,
      rankingUrlCoverage: universe.filter((row) => row.bestRankingUrl).length,
    },
    diagnostics: {
      original81RowsAvailable: false,
      primaryLimitation: "DISCOVERY",
      notes: liveExecution
        ? ["Live DataForSEO evidence captured with bounded NI-02C controls."]
        : ["No DataForSEO credentials in this environment; V2 architecture is ready but fixture is derived from persisted NI-02 evidence."],
    },
  };
}

export function buildMarketUniverseV2FromFixture(): MarketUniverseV2Snapshot {
  const v1 = readMarketOpportunityIntelligenceSnapshot();
  const rows: EvidenceRow[] = [];
  for (const item of v1.keywordOpportunities) {
    for (const competitor of item.competitorsRanking) {
      rows.push({
        keyword: item.keyword,
        position: competitor.position,
        searchVolume: item.searchVolume,
        cpc: item.cpc,
        competition: item.competition,
        url: competitor.rankingUrl,
        sourceType: "persisted_v1",
        sourceDomain: competitor.domain,
        sourceClassification: competitor.classification,
      });
    }
  }
  return buildFromRows(rows, false, [
    { endpoint: NI02C_ENDPOINTS.rankedKeywords, used: false, requests: 0, tasks: 0, cost: 0 },
    { endpoint: NI02C_ENDPOINTS.keywordsForSite, used: false, requests: 0, tasks: 0, cost: 0 },
    { endpoint: NI02C_ENDPOINTS.domainIntersection, used: false, requests: 0, tasks: 0, cost: 0 },
  ]);
}

export async function buildMarketUniverseV2Live(): Promise<MarketUniverseV2Snapshot> {
  const verified = json<any>(verifiedPath());
  const direct = (verified.directCompetitors || []).slice(0, NI02C_LIMITS.directCompetitors);
  const strongest = [...direct].sort((a: any, b: any) => (b.confidenceScore || 0) - (a.confidenceScore || 0)).slice(0, NI02C_LIMITS.keywordsForSiteCompetitors);
  const gapCompetitors = strongest.slice(0, NI02C_LIMITS.domainGapCompetitors);
  const rows: EvidenceRow[] = [];
  const usage = [
    { endpoint: NI02C_ENDPOINTS.rankedKeywords, used: true, requests: 0, tasks: 0, cost: 0 },
    { endpoint: NI02C_ENDPOINTS.keywordsForSite, used: true, requests: 0, tasks: 0, cost: 0 },
    { endpoint: NI02C_ENDPOINTS.domainIntersection, used: true, requests: 0, tasks: 0, cost: 0 },
  ];

  async function ranked(domain: string, limit: number, sourceClassification: EvidenceRow["sourceClassification"]) {
    const body = [{ target: domain, location_name: "United Kingdom", language_code: "en", limit, order_by: ["keyword_data.keyword_info.cpc,desc", "keyword_data.keyword_info.search_volume,desc"] }];
    const payload = await postDataForSeo(NI02C_ENDPOINTS.rankedKeywords, body);
    const parsed = parseRankedItems(payload, "ranked_keyword", domain, sourceClassification);
    usage[0].requests += 1; usage[0].tasks += parsed.tasks; usage[0].cost += parsed.cost;
    rows.push(...parsed.rows);
  }

  async function keywordsForSite(domain: string, sourceClassification: EvidenceRow["sourceClassification"]) {
    const body = [{ target: domain, location_name: "United Kingdom", language_code: "en", limit: NI02C_LIMITS.keywordsForSiteLimit, order_by: ["keyword_info.cpc,desc", "keyword_info.search_volume,desc"] }];
    const payload = await postDataForSeo(NI02C_ENDPOINTS.keywordsForSite, body);
    const parsed = parseRankedItems(payload, "keywords_for_site", domain, sourceClassification);
    usage[1].requests += 1; usage[1].tasks += parsed.tasks; usage[1].cost += parsed.cost;
    rows.push(...parsed.rows);
  }

  async function domainGap(domain: string) {
    const body = [{ target1: domain, target2: "pharmaconnect.uk", intersections: false, location_name: "United Kingdom", language_code: "en", limit: NI02C_LIMITS.domainGapLimit, order_by: ["keyword_data.keyword_info.search_volume,desc"] }];
    const payload = await postDataForSeo(NI02C_ENDPOINTS.domainIntersection, body);
    const parsed = parseRankedItems(payload, "domain_intersection_gap", domain, "direct_competitor");
    usage[2].requests += 1; usage[2].tasks += parsed.tasks; usage[2].cost += parsed.cost;
    rows.push(...parsed.rows);
  }

  for (const competitor of direct) await ranked(competitor.domain, NI02C_LIMITS.rankedKeywordLimit, "direct_competitor");
  await ranked("pharmaconnect.uk", NI02C_LIMITS.subjectKeywordLimit, "subject");
  for (const competitor of strongest) await keywordsForSite(competitor.domain, "direct_competitor");
  await keywordsForSite("pharmaconnect.uk", "subject");
  for (const competitor of gapCompetitors) await domainGap(competitor.domain);

  return buildFromRows(rows, true, usage);
}

export function writeMarketUniverseV2Fixture(): MarketUniverseV2Snapshot {
  const snapshot = buildMarketUniverseV2FromFixture();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  fs.writeFileSync(v2DataPath(), JSON.stringify(snapshot, null, 2) + "\n");
  fs.writeFileSync(v2FixturePath(), JSON.stringify(snapshot, null, 2) + "\n");
  return snapshot;
}

export async function writeMarketUniverseV2Live(): Promise<MarketUniverseV2Snapshot> {
  const snapshot = await buildMarketUniverseV2Live();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(v2DataPath(), JSON.stringify(snapshot, null, 2) + "\n");
  return snapshot;
}

export function readMarketUniverseV2Snapshot(): MarketUniverseV2Snapshot {
  const file = firstExisting([v2DataPath(), v2FixturePath()]);
  if (!file) return writeMarketUniverseV2Fixture();
  return json<MarketUniverseV2Snapshot>(file);
}
