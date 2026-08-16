import fs from "node:fs";
import path from "node:path";
import { buildPharmaConnectCommercialKeywordTaxonomy } from "./pharmaConnectCommercialKeywordTaxonomy.ts";
import { scoreRankedKeyword } from "./commercialKeywordScoringService.ts";
import type { DataForSeoRankedKeyword } from "./dataForSeoRankedKeywordIntelligenceService.ts";
import {
  MARKET_OPPORTUNITY_INTELLIGENCE_VERSION,
  type MarketKeywordOpportunity,
  type MarketOpportunityGapType,
  type MarketOpportunityIntelligenceSnapshot,
  type MarketOpportunityPriority,
  type MarketOpportunityRankingCompetitor,
  type MarketOpportunityRankingPage,
} from "./marketOpportunityIntelligenceModel.ts";

const DATA_DIR = path.join(process.cwd(), "data/national-growth-engine");
const FIXTURE_DIR = path.join(process.cwd(), "fixtures/national-growth-engine");
const VERIFIED_FILE = "pharmaconnect-verified-national-competitors.json";
const SNAPSHOT_FILE = "pharmaconnect-market-opportunity-intelligence-v1.json";
export const DATAFORSEO_RANKED_KEYWORDS_ENDPOINT =
  "https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live";
export const MARKET_OPPORTUNITY_LIVE_LIMITS = {
  directCompetitors: 6,
  directKeywordLimit: 100,
  adjacentCompetitors: 0,
  adjacentKeywordLimit: 50,
  subjectKeywordLimit: 250,
} as const;

type CompetitorClass = "direct_competitor" | "adjacent_competitor";

interface KeywordAccumulator {
  displayKeyword: string;
  key: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  competitors: MarketOpportunityRankingCompetitor[];
  sourceClasses: Set<CompetitorClass>;
  raw: DataForSeoRankedKeyword[];
}

export interface MarketOpportunityBuildInput {
  verified?: any;
  subjectKeywords?: DataForSeoRankedKeyword[];
  sourceProvider?: string;
  dataForSeoUsage?: MarketOpportunityIntelligenceSnapshot["dataForSeoUsage"];
}

export interface MarketOpportunityLiveRunOptions {
  directCompetitors: number;
  directKeywordLimit: number;
  adjacentCompetitors: number;
  adjacentKeywordLimit: number;
  subjectKeywordLimit: number;
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function firstExisting(paths: string[]): string | null {
  return paths.find((file) => fs.existsSync(file)) || null;
}

function verifiedPath(): string {
  const file = firstExisting([
    path.join(DATA_DIR, VERIFIED_FILE),
    path.join(FIXTURE_DIR, VERIFIED_FILE),
  ]);
  if (!file) throw new Error(`Verified national competitor snapshot not found: ${VERIFIED_FILE}`);
  return file;
}

function snapshotDataPath(): string {
  return path.join(DATA_DIR, SNAPSHOT_FILE);
}

function snapshotFixturePath(): string {
  return path.join(FIXTURE_DIR, SNAPSHOT_FILE);
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function keywordKey(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function priority(score: number): MarketOpportunityPriority {
  if (score >= 80) return "HIGH";
  if (score >= 60) return "MEDIUM";
  return "LOW";
}

function classifyGap(subjectPosition: number | null): MarketOpportunityGapType {
  if (subjectPosition === null) return "unknown";
  if (subjectPosition > 20) return "weak_coverage";
  if (subjectPosition > 10) return "defend_improve";
  return "defend_improve";
}

function scoreOpportunity(input: {
  scored: ReturnType<typeof scoreRankedKeyword>;
  searchVolume: number | null;
  directCompetitorCount: number;
  adjacentCompetitorCount: number;
  bestPosition: number | null;
  subjectPosition: number | null;
}) {
  const reasons: string[] = [];
  let score = 0;

  const commercialIntent = Math.max(0, input.scored.positiveScore - input.scored.negativeScore);
  score += Math.min(30, commercialIntent / 4);
  if (commercialIntent > 0) reasons.push(`Commercial intent score ${commercialIntent}.`);
  if (input.scored.highIntentMatches.length) {
    reasons.push(`High-intent match: ${input.scored.highIntentMatches.join(", ")}.`);
  }
  if (input.scored.negativeMatches.length) {
    score -= Math.min(30, input.scored.negativeMatches.length * 12);
    reasons.push(`Negative-intent penalty: ${input.scored.negativeMatches.join(", ")}.`);
  }

  const volume = input.searchVolume || 0;
  if (volume >= 150) score += 20;
  else if (volume >= 80) score += 15;
  else if (volume >= 30) score += 10;
  else if (volume > 0) score += 5;
  if (volume > 0) reasons.push(`Monthly search volume ${volume}.`);

  if (input.directCompetitorCount) {
    score += Math.min(22, input.directCompetitorCount * 8);
    reasons.push(`${input.directCompetitorCount} direct competitor(s) rank.`);
  }
  if (input.adjacentCompetitorCount) {
    score += Math.min(8, input.adjacentCompetitorCount * 3);
    reasons.push(`${input.adjacentCompetitorCount} adjacent competitor(s) also rank.`);
  }

  const best = input.bestPosition || 999;
  if (best <= 3) score += 15;
  else if (best <= 10) score += 12;
  else if (best <= 20) score += 8;
  else if (best < 999) score += 4;
  if (best < 999) reasons.push(`Best observed competitor position ${best}.`);

  if (input.subjectPosition === null) {
    reasons.push("PharmaConnect subject position not available in recovered evidence.");
  } else if (input.subjectPosition > best) {
    score += 10;
    reasons.push(`PharmaConnect position ${input.subjectPosition} trails competitor position ${best}.`);
  } else {
    reasons.push(`PharmaConnect position ${input.subjectPosition} observed.`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, reasons };
}

function rankingPageKey(domain: string, url: string): string {
  return `${domain} ${url}`.toLowerCase();
}

function topRejectionReasons(items: MarketKeywordOpportunity[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items.filter((x) => x.qualification === "REJECTED")) {
    for (const reason of item.qualificationReasons) {
      counts.set(reason, (counts.get(reason) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([reason, count]) => `${reason} (${count})`);
}

export function buildMarketOpportunityIntelligenceSnapshot(input: MarketOpportunityBuildInput = {}): MarketOpportunityIntelligenceSnapshot {
  const verified = input.verified || readJson<any>(verifiedPath());
  const subjectMap = new Map(
    (input.subjectKeywords || []).map((item) => [keywordKey(item.keyword), item]),
  );
  const taxonomy = buildPharmaConnectCommercialKeywordTaxonomy();
  const direct = (verified.directCompetitors || []).map((c: any) => ({
    ...c,
    classification: "direct_competitor" as CompetitorClass,
  }));
  const adjacent = (verified.adjacentCompetitors || []).map((c: any) => ({
    ...c,
    classification: "adjacent_competitor" as CompetitorClass,
  }));
  const competitors = [...direct, ...adjacent];

  const keywordMap = new Map<string, KeywordAccumulator>();

  for (const competitor of competitors) {
    const strongest = Array.isArray(competitor.strongestKeywords) ? competitor.strongestKeywords : [];
    for (const keyword of strongest) {
      const key = keywordKey(keyword.keyword);
      if (!key) continue;
      const ranked: DataForSeoRankedKeyword = {
        keyword: String(keyword.keyword || "").trim(),
        position: num(keyword.position),
        searchVolume: num(keyword.searchVolume),
        cpc: num(keyword.cpc),
        competition: num(keyword.competition),
        url: keyword.url || null,
      };
      const existing = keywordMap.get(key) || {
        displayKeyword: ranked.keyword,
        key,
        searchVolume: ranked.searchVolume,
        cpc: ranked.cpc,
        competition: ranked.competition,
        competitors: [],
        sourceClasses: new Set<CompetitorClass>(),
        raw: [],
      };

      if ((ranked.searchVolume || 0) > (existing.searchVolume || 0)) existing.searchVolume = ranked.searchVolume;
      if (existing.cpc === null && ranked.cpc !== null) existing.cpc = ranked.cpc;
      if (existing.competition === null && ranked.competition !== null) existing.competition = ranked.competition;
      existing.sourceClasses.add(competitor.classification);
      existing.raw.push(ranked);
      existing.competitors.push({
        domain: competitor.domain || "unknown",
        classification: competitor.classification,
        position: ranked.position,
        rankingUrl: ranked.url,
      });
      keywordMap.set(key, existing);
    }
  }

  const opportunities: MarketKeywordOpportunity[] = [...keywordMap.values()].map((entry) => {
    const best = [...entry.raw].sort((a, b) => (a.position || 999) - (b.position || 999))[0];
    const scored = scoreRankedKeyword(
      {
        keyword: entry.displayKeyword,
        position: best?.position ?? null,
        searchVolume: entry.searchVolume,
        cpc: entry.cpc,
        competition: entry.competition,
        url: best?.url ?? null,
      },
      taxonomy,
    );
    const directCount = entry.competitors.filter((c) => c.classification === "direct_competitor").length;
    const adjacentCount = entry.competitors.filter((c) => c.classification === "adjacent_competitor").length;
    const bestPosition = best?.position ?? null;
    const bestCompetitor = entry.competitors
      .filter((c) => c.position === bestPosition)
      .sort((a, b) => (a.classification === "direct_competitor" ? -1 : 1) - (b.classification === "direct_competitor" ? -1 : 1))[0] ||
      entry.competitors[0];
    const subjectEvidence = subjectMap.get(entry.key) || null;
    const subjectPosition = subjectEvidence?.position ?? null;
    const score = scoreOpportunity({
      scored,
      searchVolume: entry.searchVolume,
      directCompetitorCount: directCount,
      adjacentCompetitorCount: adjacentCount,
      bestPosition,
      subjectPosition,
    });
    const qualification =
      scored.classification === "high_commercial_relevance" ||
      scored.classification === "commercial_relevance"
        ? "QUALIFIED"
        : scored.classification === "negative_intent" || scored.classification === "irrelevant"
          ? "REJECTED"
          : "REVIEW";
    const qualificationReasons = [
      ...scored.marketMatches.map((term) => `Market term: ${term}`),
      ...scored.serviceMatches.map((term) => `Service term: ${term}`),
      ...scored.highIntentMatches.map((term) => `High-intent term: ${term}`),
      ...scored.negativeMatches.map((term) => `Negative term: ${term}`),
    ];

    return {
      keyword: entry.displayKeyword,
      searchVolume: entry.searchVolume,
      cpc: entry.cpc,
      competition: entry.competition,
      commercialIntentScore: Math.max(0, scored.positiveScore - scored.negativeScore),
      qualification,
      qualificationReasons,
      competitorCount: entry.competitors.length,
      directCompetitorCount: directCount,
      adjacentCompetitorCount: adjacentCount,
      competitorsRanking: entry.competitors.sort((a, b) => (a.position || 999) - (b.position || 999)),
      bestCompetitorPosition: bestPosition,
      bestCompetitorDomain: bestCompetitor?.domain || null,
      bestRankingUrl: best?.url || null,
      subjectPosition,
      subjectRankingUrl: subjectEvidence?.url ?? null,
      gapType: subjectMap.size && !subjectEvidence ? "untapped" : classifyGap(subjectPosition),
      opportunityScore: qualification === "QUALIFIED" ? score.score : Math.min(40, score.score),
      priority: priority(qualification === "QUALIFIED" ? score.score : Math.min(40, score.score)),
      reasons: score.reasons,
    };
  });

  const pageMap = new Map<string, MarketOpportunityRankingPage>();
  for (const opportunity of opportunities.filter((x) => x.qualification === "QUALIFIED")) {
    for (const competitor of opportunity.competitorsRanking) {
      if (!competitor.rankingUrl) continue;
      const key = rankingPageKey(competitor.domain, competitor.rankingUrl);
      const page = pageMap.get(key) || {
        competitorDomain: competitor.domain,
        url: competitor.rankingUrl,
        keywordCount: 0,
        relevantKeywordCount: 0,
        searchDemand: 0,
        bestPosition: null,
        strongestKeywords: [],
      };
      page.keywordCount += 1;
      page.relevantKeywordCount += 1;
      page.searchDemand += opportunity.searchVolume || 0;
      page.bestPosition =
        page.bestPosition === null
          ? competitor.position
          : Math.min(page.bestPosition || 999, competitor.position || 999);
      page.strongestKeywords.push({
        keyword: opportunity.keyword,
        position: competitor.position,
        searchVolume: opportunity.searchVolume,
      });
      pageMap.set(key, page);
    }
  }

  const qualified = opportunities.filter((x) => x.qualification === "QUALIFIED");
  const high = qualified.filter((x) => x.priority === "HIGH");
  const medium = qualified.filter((x) => x.priority === "MEDIUM");
  const low = qualified.filter((x) => x.priority === "LOW");
  const totalSearchDemand = qualified.reduce((sum, x) => sum + (x.searchVolume || 0), 0);
  const usage = input.dataForSeoUsage || {
    requests: 0,
    tasks: 0,
    totalCost: 0,
    endpoints: [
      {
        endpoint: DATAFORSEO_RANKED_KEYWORDS_ENDPOINT,
        requests: 0,
        tasks: 0,
        cost: 0,
        purpose: "Not called in this run; recovered persisted ranked-keyword evidence was used because credentials were unavailable.",
      },
    ],
  };

  return {
    version: MARKET_OPPORTUNITY_INTELLIGENCE_VERSION,
    generatedAt: new Date().toISOString(),
    market: verified.market || "UK Community Pharmacy Digital Growth",
    country: "United Kingdom",
    subjectDomain: "pharmaconnect.uk",
    sourceProvider: input.sourceProvider || "persisted-dataforseo-ranked-keywords",
    sourceCompetitorCount: competitors.length,
    totalApiCost: usage.totalCost,
    dataForSeoUsage: usage,
    competitors: competitors.map((c: any) => ({
      domain: c.domain || "unknown",
      classification: c.classification,
      confidence: num(c.confidenceScore),
      keywordsAnalysed: Number(c.rankedKeywordsAnalysed || 0),
    })),
    keywordOpportunities: opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore || (b.searchVolume || 0) - (a.searchVolume || 0)),
    rankingPages: [...pageMap.values()].sort((a, b) => b.searchDemand - a.searchDemand || (a.bestPosition || 999) - (b.bestPosition || 999)),
    summary: {
      keywordUniverse: opportunities.length,
      qualifiedCommercialKeywords: qualified.length,
      rejectedKeywords: opportunities.filter((x) => x.qualification === "REJECTED").length,
      reviewKeywords: opportunities.filter((x) => x.qualification === "REVIEW").length,
      uniqueQualifiedKeywords: qualified.length,
      untappedKeywords: qualified.filter((x) => x.gapType === "untapped").length,
      weakCoverageKeywords: qualified.filter((x) => x.gapType === "weak_coverage").length,
      defendImproveKeywords: qualified.filter((x) => x.gapType === "defend_improve").length,
      unknownGapKeywords: qualified.filter((x) => x.gapType === "unknown").length,
      highPriorityOpportunities: high.length,
      mediumPriorityOpportunities: medium.length,
      lowPriorityOpportunities: low.length,
      totalSearchDemand,
    },
    dataQuality: {
      rawKeywords: opportunities.reduce((sum, x) => sum + x.competitorsRanking.length, 0),
      qualified: qualified.length,
      rejected: opportunities.filter((x) => x.qualification === "REJECTED").length,
      review: opportunities.filter((x) => x.qualification === "REVIEW").length,
      topRejectionReasons: topRejectionReasons(opportunities),
      subjectCoverageStatus: subjectMap.size ? "available" : "not_available",
    },
  };
}

export function writeMarketOpportunityIntelligenceSnapshot(): MarketOpportunityIntelligenceSnapshot {
  const snapshot = buildMarketOpportunityIntelligenceSnapshot();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  fs.writeFileSync(snapshotDataPath(), JSON.stringify(snapshot, null, 2) + "\n");
  fs.writeFileSync(snapshotFixturePath(), JSON.stringify(snapshot, null, 2) + "\n");
  return snapshot;
}

function dataForSeoCredentials(): { login: string; password: string } {
  const login = process.env.DATAFORSEO_LOGIN || process.env.DATAFORSEO_API_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD || process.env.DATAFORSEO_API_PASSWORD;
  if (!login || !password) throw new Error("DataForSEO credentials unavailable");
  return { login, password };
}

async function fetchRankedKeywordsWithCost(domain: string, limit: number): Promise<{
  keywords: DataForSeoRankedKeyword[];
  cost: number;
  tasks: number;
}> {
  const { login, password } = dataForSeoCredentials();
  const body = [{
    target: domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0],
    location_name: "United Kingdom",
    language_code: "en",
    limit: Math.max(1, Math.min(limit, 1000)),
    order_by: ["keyword_data.keyword_info.search_volume,desc"],
  }];

  const response = await fetch(DATAFORSEO_RANKED_KEYWORDS_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: "Basic " + Buffer.from(`${login}:${password}`).toString("base64"),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload: any = await response.json();
  if (!response.ok || payload?.status_code !== 20000) {
    throw new Error(`DataForSEO ranked keywords failed: HTTP ${response.status} / ${payload?.status_code || "unknown"}`);
  }

  const task = payload?.tasks?.[0];
  if (!task || task.status_code !== 20000) {
    throw new Error(`DataForSEO ranked keyword task failed: ${task?.status_code || "unknown"}`);
  }

  const items = task?.result?.[0]?.items || [];
  const keywords = items.map((item: any) => {
    const keywordData = item?.keyword_data || {};
    const keywordInfo = keywordData?.keyword_info || {};
    const ranked = item?.ranked_serp_element?.serp_item || {};
    return {
      keyword: String(keywordData?.keyword || item?.keyword || "").trim(),
      position: num(ranked?.rank_absolute ?? ranked?.rank_group ?? item?.rank_absolute),
      searchVolume: num(keywordInfo?.search_volume),
      cpc: num(keywordInfo?.cpc),
      competition: num(keywordInfo?.competition),
      url: ranked?.url || item?.url || null,
    } satisfies DataForSeoRankedKeyword;
  }).filter((item: DataForSeoRankedKeyword) => item.keyword);

  return {
    keywords,
    cost: typeof task.cost === "number" ? task.cost : 0,
    tasks: 1,
  };
}

export async function writeLiveMarketOpportunityIntelligenceSnapshot(options: Partial<MarketOpportunityLiveRunOptions> = {}): Promise<MarketOpportunityIntelligenceSnapshot> {
  const limits = { ...MARKET_OPPORTUNITY_LIVE_LIMITS, ...options };
  const verified = readJson<any>(verifiedPath());
  const direct = (verified.directCompetitors || []).slice(0, limits.directCompetitors);
  const adjacent = (verified.adjacentCompetitors || []).slice(0, limits.adjacentCompetitors);
  const usage = {
    requests: 0,
    tasks: 0,
    totalCost: 0,
    endpoints: [
      {
        endpoint: DATAFORSEO_RANKED_KEYWORDS_ENDPOINT,
        requests: 0,
        tasks: 0,
        cost: 0,
        purpose: "Bounded live ranked-keyword expansion for verified direct competitors and pharmaconnect.uk subject coverage.",
      },
    ],
  };

  async function enrichCompetitor(competitor: any, keywordLimit: number) {
    const result = await fetchRankedKeywordsWithCost(competitor.domain, keywordLimit);
    usage.requests += 1;
    usage.tasks += result.tasks;
    usage.totalCost += result.cost;
    usage.endpoints[0].requests += 1;
    usage.endpoints[0].tasks += result.tasks;
    usage.endpoints[0].cost += result.cost;
    return {
      ...competitor,
      rankedKeywordsAnalysed: result.keywords.length,
      strongestKeywords: result.keywords,
    };
  }

  const liveDirect = [];
  for (const competitor of direct) {
    liveDirect.push(await enrichCompetitor(competitor, limits.directKeywordLimit));
  }

  const liveAdjacent = [];
  for (const competitor of adjacent) {
    liveAdjacent.push(await enrichCompetitor(competitor, limits.adjacentKeywordLimit));
  }

  const subject = await fetchRankedKeywordsWithCost("pharmaconnect.uk", limits.subjectKeywordLimit);
  usage.requests += 1;
  usage.tasks += subject.tasks;
  usage.totalCost += subject.cost;
  usage.endpoints[0].requests += 1;
  usage.endpoints[0].tasks += subject.tasks;
  usage.endpoints[0].cost += subject.cost;

  const snapshot = buildMarketOpportunityIntelligenceSnapshot({
    verified: {
      ...verified,
      directCompetitors: liveDirect,
      adjacentCompetitors: liveAdjacent,
    },
    subjectKeywords: subject.keywords,
    sourceProvider: "dataforseo-ranked-keywords-live",
    dataForSeoUsage: usage,
  });

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(snapshotDataPath(), JSON.stringify(snapshot, null, 2) + "\n");
  return snapshot;
}

export function readMarketOpportunityIntelligenceSnapshot(): MarketOpportunityIntelligenceSnapshot {
  const file = firstExisting([snapshotDataPath(), snapshotFixturePath()]);
  if (!file) return writeMarketOpportunityIntelligenceSnapshot();
  return readJson<MarketOpportunityIntelligenceSnapshot>(file);
}
