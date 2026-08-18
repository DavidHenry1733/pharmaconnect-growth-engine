/**
 * Canonical DataForSEO Labs client for ranked_keywords, keywords_for_site,
 * domain_intersection, and competitors_domain.
 * Live HTTP runs only when an explicit execution function is called.
 * Read/render paths must not import-call these live functions.
 */
import { fetchDataForSeo, isDataForSeoTransportTimeout, resolveDataForSeoHttpTimeoutMs } from "./dataForSeoHttp.ts";
import {
  DATAFORSEO_TASK_INTERNAL_SE_ERROR,
  DATAFORSEO_TASK_OK,
  MAX_DATAFORSEO_INTERNAL_SE_RETRIES,
} from "./nationalSearchProviderModel.ts";

export const DATAFORSEO_LABS_ENDPOINTS = {
  rankedKeywords: "https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live",
  keywordsForSite: "https://api.dataforseo.com/v3/dataforseo_labs/google/keywords_for_site/live",
  domainIntersection: "https://api.dataforseo.com/v3/dataforseo_labs/google/domain_intersection/live",
  competitorsDomain: "https://api.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live",
} as const;

export type DataForSeoRankedKeyword = {
  keyword: string;
  position: number | null;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  url: string | null;
  etv?: number | null;
  searchIntent?: string | null;
  serpType?: string | null;
  rankGroup?: number | null;
  seResultsCount?: number | null;
};

export type DataForSeoLabsKeywordRow = DataForSeoRankedKeyword & {
  sourceDomain: string;
};

export type DataForSeoLabsResult = {
  rows: DataForSeoLabsKeywordRow[];
  cost: number;
  tasks: number;
  endpoint: string;
};

export type DataForSeoDomainCompetitor = {
  domain: string;
  avgPosition: number | null;
  sharedKeywordCount: number | null;
  organicEtv: number | null;
  organicKeywordCount: number | null;
  sharedKeywordEtv: number | null;
};

export type DataForSeoLabsCompetitorResult = {
  rows: DataForSeoDomainCompetitor[];
  cost: number;
  tasks: number;
  endpoint: string;
};

export type DataForSeoLabsTaskAttempt = {
  endpoint: string;
  taskId: string | null;
  taskStatusCode: number | null;
  taskStatusMessage: string | null;
  cost: number | null;
  successful: boolean;
  retryable: boolean;
  timedOut: boolean;
  attemptNumber: number;
  capturedAt: string;
};

export type DataForSeoLabsExecutionResult<T> = {
  successful: boolean;
  fatal: boolean;
  fatalMessage: string | null;
  timedOut: boolean;
  cost: number;
  tasks: number;
  endpoint: string;
  result: T | null;
  attempts: DataForSeoLabsTaskAttempt[];
};

function credentials() {
  const login = process.env.DATAFORSEO_LOGIN || process.env.DATAFORSEO_API_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD || process.env.DATAFORSEO_API_PASSWORD;
  if (!login || !password) {
    throw new Error("DataForSEO credentials unavailable");
  }
  return { login, password };
}

export function normaliseLabsDomain(domain: string): string {
  return String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function labsLocationFields(input: { locationName?: string; locationCode?: number }): Record<string, unknown> {
  if (Number.isInteger(input.locationCode) && Number(input.locationCode) > 0) {
    return { location_code: Number(input.locationCode) };
  }
  return { location_name: input.locationName || "United Kingdom" };
}

function isFatalApiStatus(statusCode: number | null): boolean {
  if (statusCode == null) return true;
  if (statusCode === DATAFORSEO_TASK_OK) return false;
  return statusCode === 40100 || statusCode === 40200 || statusCode === 40201 || statusCode === 40400;
}

export function parseLabsKeywordItems(payload: unknown, sourceDomain: string): { rows: DataForSeoLabsKeywordRow[]; cost: number; tasks: number } {
  const json = payload as { tasks?: Array<{ cost?: number; result?: Array<{ items?: unknown[] }> }> };
  const task = json?.tasks?.[0] || {};
  const items = task?.result?.[0]?.items || [];
  return {
    rows: items.map((item: any) => {
      const keywordData = item?.keyword_data || {};
      const keywordInfo = keywordData?.keyword_info || item?.keyword_info || {};
      const intentInfo = keywordData?.search_intent_info || item?.search_intent_info || {};
      const serpInfo = keywordData?.serp_info || item?.serp_info || {};
      const ranked = item?.ranked_serp_element?.serp_item || item?.ranked_serp_element || {};
      const intent = String(intentInfo?.main_intent || "").trim();
      const serpType = String(ranked?.type || "").trim();
      return {
        keyword: String(keywordData?.keyword || item?.keyword || "").trim(),
        position: num(ranked?.rank_absolute ?? ranked?.rank_group ?? item?.rank_absolute),
        searchVolume: num(keywordInfo?.search_volume ?? item?.search_volume),
        cpc: num(keywordInfo?.cpc ?? item?.cpc),
        competition: num(keywordInfo?.competition ?? item?.competition),
        url: ranked?.url || item?.url || null,
        etv: num(ranked?.etv ?? item?.etv),
        searchIntent: intent || null,
        serpType: serpType || null,
        rankGroup: num(ranked?.rank_group),
        seResultsCount: num(serpInfo?.se_results_count ?? keywordData?.se_results_count),
        sourceDomain,
      };
    }).filter((row: DataForSeoLabsKeywordRow) => row.keyword),
    cost: typeof task.cost === "number" ? task.cost : 0,
    tasks: task ? 1 : 0,
  };
}

export function parseLabsCompetitorItems(payload: unknown): { rows: DataForSeoDomainCompetitor[]; cost: number; tasks: number } {
  const json = payload as { tasks?: Array<{ cost?: number; result?: Array<{ items?: unknown[] }> }> };
  const task = json?.tasks?.[0] || {};
  const items = task?.result?.[0]?.items || [];
  return {
    rows: items.map((item: any) => {
      const organic = item?.full_domain_metrics?.organic || {};
      const shared = item?.competitor_metrics?.organic || {};
      return {
        domain: normaliseLabsDomain(String(item?.domain || "")),
        avgPosition: num(item?.avg_position),
        sharedKeywordCount: num(item?.intersections),
        organicEtv: num(organic?.etv),
        organicKeywordCount: num(organic?.count),
        sharedKeywordEtv: num(shared?.etv),
      };
    }).filter((row: DataForSeoDomainCompetitor) => row.domain),
    cost: typeof task.cost === "number" ? task.cost : 0,
    tasks: task ? 1 : 0,
  };
}

async function executeLabsOnce(
  endpoint: string,
  body: unknown,
  attemptNumber: number,
): Promise<{
  attempt: DataForSeoLabsTaskAttempt;
  payload: unknown | null;
  fatal: boolean;
  fatalMessage: string | null;
}> {
  const { login, password } = credentials();
  const capturedAt = new Date().toISOString();
  const baseAttempt = {
    endpoint,
    attemptNumber,
    capturedAt,
    timedOut: false,
  };

  let response: Response;
  try {
    response = await fetchDataForSeo(endpoint, {
      method: "POST",
      headers: {
        authorization: "Basic " + Buffer.from(`${login}:${password}`).toString("base64"),
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const timedOut = isDataForSeoTransportTimeout(err);
    return {
      attempt: {
        ...baseAttempt,
        taskId: null,
        taskStatusCode: null,
        taskStatusMessage: timedOut
          ? `HTTP timeout after ${resolveDataForSeoHttpTimeoutMs()}ms`
          : err instanceof Error ? err.message : String(err),
        cost: null,
        successful: false,
        retryable: false,
        timedOut,
      },
      payload: null,
      fatal: false,
      fatalMessage: null,
    };
  }

  const rawText = await response.text();
  let payload: any;
  try {
    payload = JSON.parse(rawText);
  } catch {
    return {
      attempt: {
        ...baseAttempt,
        taskId: null,
        taskStatusCode: response.status,
        taskStatusMessage: `DataForSEO returned invalid JSON (HTTP ${response.status})`,
        cost: null,
        successful: false,
        retryable: false,
        timedOut: false,
      },
      payload: null,
      fatal: false,
      fatalMessage: null,
    };
  }

  const topStatus = typeof payload?.status_code === "number" ? payload.status_code : null;
  const task = payload?.tasks?.[0];
  const taskStatus = typeof task?.status_code === "number" ? task.status_code : null;
  const taskMessage = String(task?.status_message || payload?.status_message || "request failed");
  const taskId = task?.id != null ? String(task.id) : null;
  const cost = typeof task?.cost === "number" ? task.cost : null;

  if (!response.ok || (topStatus != null && topStatus !== DATAFORSEO_TASK_OK)) {
    const fatal = response.status === 401 || response.status === 403 || isFatalApiStatus(topStatus);
    return {
      attempt: {
        ...baseAttempt,
        taskId,
        taskStatusCode: topStatus ?? response.status,
        taskStatusMessage: taskMessage,
        cost,
        successful: false,
        retryable: false,
        timedOut: false,
      },
      payload,
      fatal,
      fatalMessage: fatal ? `DataForSEO API ${topStatus ?? response.status}: ${taskMessage}` : null,
    };
  }

  if (taskStatus === DATAFORSEO_TASK_OK) {
    return {
      attempt: {
        ...baseAttempt,
        taskId,
        taskStatusCode: taskStatus,
        taskStatusMessage: taskMessage,
        cost,
        successful: true,
        retryable: false,
        timedOut: false,
      },
      payload,
      fatal: false,
      fatalMessage: null,
    };
  }

  const fatalTask =
    taskStatus === 40100 || taskStatus === 40200 || taskStatus === 40201 || taskStatus === 40400;
  return {
    attempt: {
      ...baseAttempt,
      taskId,
      taskStatusCode: taskStatus,
      taskStatusMessage: taskMessage,
      cost,
      successful: false,
      retryable: taskStatus === DATAFORSEO_TASK_INTERNAL_SE_ERROR,
      timedOut: false,
    },
    payload,
    fatal: fatalTask,
    fatalMessage: fatalTask ? `DataForSEO task ${taskStatus}: ${taskMessage}` : null,
  };
}

export async function executeDataForSeoLabs(endpoint: string, body: unknown): Promise<{
  successful: boolean;
  fatal: boolean;
  fatalMessage: string | null;
  timedOut: boolean;
  cost: number;
  payload: unknown | null;
  attempts: DataForSeoLabsTaskAttempt[];
}> {
  const attempts: DataForSeoLabsTaskAttempt[] = [];
  const first = await executeLabsOnce(endpoint, body, 1);
  attempts.push(first.attempt);

  let current = first;
  if (!first.attempt.successful && first.attempt.retryable && !first.fatal && !first.attempt.timedOut) {
    const retry = await executeLabsOnce(endpoint, body, 1 + MAX_DATAFORSEO_INTERNAL_SE_RETRIES);
    attempts.push(retry.attempt);
    current = retry;
  }

  return {
    successful: current.attempt.successful,
    fatal: first.fatal || current.fatal,
    fatalMessage: first.fatalMessage || current.fatalMessage,
    timedOut: attempts.some((row) => row.timedOut),
    cost: attempts.reduce((sum, row) => sum + (typeof row.cost === "number" ? row.cost : 0), 0),
    payload: current.attempt.successful ? current.payload : current.payload,
    attempts,
  };
}

export async function postDataForSeoLabs(endpoint: string, body: unknown): Promise<unknown> {
  const executed = await executeDataForSeoLabs(endpoint, body);
  if (executed.successful && executed.payload) return executed.payload;
  const last = executed.attempts[executed.attempts.length - 1];
  throw new Error(
    executed.fatalMessage
      || `DataForSEO task failed: ${last?.taskStatusCode || "unknown"} ${last?.taskStatusMessage || ""}`.trim(),
  );
}

export async function executeDomainRankedKeywords(input: {
  domain: string;
  locationName?: string;
  locationCode?: number;
  languageCode?: string;
  limit?: number;
  orderBy?: string[];
}): Promise<DataForSeoLabsExecutionResult<DataForSeoLabsResult>> {
  const domain = normaliseLabsDomain(input.domain);
  const executed = await executeDataForSeoLabs(DATAFORSEO_LABS_ENDPOINTS.rankedKeywords, [{
    target: domain,
    ...labsLocationFields(input),
    language_code: input.languageCode || "en",
    limit: Math.min(Math.max(input.limit || 1000, 1), 1000),
    order_by: input.orderBy || ["keyword_data.keyword_info.search_volume,desc"],
  }]);
  const parsed = executed.payload ? parseLabsKeywordItems(executed.payload, domain) : { rows: [], cost: 0, tasks: 0 };
  return {
    successful: executed.successful,
    fatal: executed.fatal,
    fatalMessage: executed.fatalMessage,
    timedOut: executed.timedOut,
    cost: executed.cost,
    tasks: executed.attempts.length,
    endpoint: DATAFORSEO_LABS_ENDPOINTS.rankedKeywords,
    result: executed.successful
      ? { rows: parsed.rows, cost: executed.cost, tasks: executed.attempts.length, endpoint: DATAFORSEO_LABS_ENDPOINTS.rankedKeywords }
      : null,
    attempts: executed.attempts,
  };
}

export async function executeDomainCompetitors(input: {
  domain: string;
  locationName?: string;
  locationCode?: number;
  languageCode?: string;
  limit?: number;
  excludeTopDomains?: boolean;
  excludeDomains?: string[];
}): Promise<DataForSeoLabsExecutionResult<DataForSeoLabsCompetitorResult>> {
  const domain = normaliseLabsDomain(input.domain);
  const executed = await executeDataForSeoLabs(DATAFORSEO_LABS_ENDPOINTS.competitorsDomain, [{
    target: domain,
    ...labsLocationFields(input),
    language_code: input.languageCode || "en",
    limit: Math.min(Math.max(input.limit || 20, 1), 1000),
    item_types: ["organic"],
    exclude_top_domains: input.excludeTopDomains !== false,
    exclude_domains: (input.excludeDomains || []).map(normaliseLabsDomain).filter(Boolean),
    order_by: ["intersections,desc"],
  }]);
  const parsed = executed.payload ? parseLabsCompetitorItems(executed.payload) : { rows: [], cost: 0, tasks: 0 };
  return {
    successful: executed.successful,
    fatal: executed.fatal,
    fatalMessage: executed.fatalMessage,
    timedOut: executed.timedOut,
    cost: executed.cost,
    tasks: executed.attempts.length,
    endpoint: DATAFORSEO_LABS_ENDPOINTS.competitorsDomain,
    result: executed.successful
      ? { rows: parsed.rows, cost: executed.cost, tasks: executed.attempts.length, endpoint: DATAFORSEO_LABS_ENDPOINTS.competitorsDomain }
      : null,
    attempts: executed.attempts,
  };
}

export async function getDomainRankedKeywordsWithCost(input: {
  domain: string;
  locationName?: string;
  locationCode?: number;
  languageCode?: string;
  limit?: number;
  orderBy?: string[];
}): Promise<DataForSeoLabsResult> {
  const executed = await executeDomainRankedKeywords(input);
  if (!executed.successful || !executed.result) {
    throw new Error(executed.fatalMessage || "DataForSEO ranked keyword collection failed.");
  }
  return executed.result;
}

export async function getDomainRankedKeywords(input: {
  domain: string;
  locationName?: string;
  languageCode?: string;
  limit?: number;
}): Promise<DataForSeoRankedKeyword[]> {
  const result = await getDomainRankedKeywordsWithCost(input);
  return result.rows.map(({ sourceDomain: _sourceDomain, ...row }) => row);
}

export async function getKeywordsForSiteWithCost(input: {
  domain: string;
  locationName?: string;
  languageCode?: string;
  limit?: number;
  orderBy?: string[];
}): Promise<DataForSeoLabsResult> {
  const domain = normaliseLabsDomain(input.domain);
  const payload = await postDataForSeoLabs(DATAFORSEO_LABS_ENDPOINTS.keywordsForSite, [{
    target: domain,
    location_name: input.locationName || "United Kingdom",
    language_code: input.languageCode || "en",
    limit: Math.min(Math.max(input.limit || 100, 1), 1000),
    order_by: input.orderBy || ["keyword_info.search_volume,desc"],
  }]);
  const parsed = parseLabsKeywordItems(payload, domain);
  return { ...parsed, endpoint: DATAFORSEO_LABS_ENDPOINTS.keywordsForSite };
}

export async function getDomainIntersectionWithCost(input: {
  competitorDomain: string;
  subjectDomain: string;
  locationName?: string;
  languageCode?: string;
  limit?: number;
  intersections?: boolean;
  orderBy?: string[];
}): Promise<DataForSeoLabsResult> {
  const competitorDomain = normaliseLabsDomain(input.competitorDomain);
  const subjectDomain = normaliseLabsDomain(input.subjectDomain);
  const payload = await postDataForSeoLabs(DATAFORSEO_LABS_ENDPOINTS.domainIntersection, [{
    target1: competitorDomain,
    target2: subjectDomain,
    intersections: input.intersections === true,
    location_name: input.locationName || "United Kingdom",
    language_code: input.languageCode || "en",
    limit: Math.min(Math.max(input.limit || 100, 1), 1000),
    order_by: input.orderBy || ["keyword_data.keyword_info.search_volume,desc"],
  }]);
  const parsed = parseLabsKeywordItems(payload, competitorDomain);
  return { ...parsed, endpoint: DATAFORSEO_LABS_ENDPOINTS.domainIntersection };
}

export async function getDomainCompetitorsWithCost(input: {
  domain: string;
  locationName?: string;
  locationCode?: number;
  languageCode?: string;
  limit?: number;
  excludeTopDomains?: boolean;
  excludeDomains?: string[];
}): Promise<DataForSeoLabsCompetitorResult> {
  const executed = await executeDomainCompetitors(input);
  if (!executed.successful || !executed.result) {
    throw new Error(executed.fatalMessage || "DataForSEO competitors domain collection failed.");
  }
  return executed.result;
}
