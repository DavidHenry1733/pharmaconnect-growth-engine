/**
 * NC-02 — National Competitor Discovery Query Service V1
 *
 * Builds NATIONAL commercial competitor discovery queries from Business
 * Intelligence: commercial services, target customer market, and country.
 * Physical office locality is excluded. No tenant-specific query templates.
 */

import type {
  NationalCompetitorDiscoveryQuery,
} from "./nationalCompetitorDiscoveryModel.ts";

export const COMMERCIAL_DISCOVERY_MAX_QUERIES = 8;

export interface NationalDiscoveryBusinessContext {
  businessName: string;
  marketCountry: string;
  targetCustomerMarket: string;
  services: string[];
  businessType?: string;
  proposition?: string;
}

const FILLER_WORDS = new Set([
  "digital",
  "services",
  "service",
  "built",
  "specifically",
  "for",
  "the",
  "and",
  "a",
  "an",
  "our",
  "with",
  "that",
  "this",
  "from",
  "across",
  "using",
]);

function clean(value: unknown): string {
  return String(value || "").trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function queryId(index: number): string {
  return `national-query-${String(index + 1).padStart(2, "0")}`;
}

export function compactCustomerMarketPhrase(raw: string): string {
  const cleaned = clean(raw).replace(/[.|]+/g, " ").replace(/\s+/g, " ");
  if (!cleaned) return "";
  if (cleaned.length <= 56) return cleaned;
  const tokens = cleaned
    .split(/\s+/)
    .filter((token) => token.length > 2 && !FILLER_WORDS.has(token.toLowerCase()));
  return tokens.slice(-5).join(" ") || cleaned.slice(0, 56);
}

export function buildNationalCompetitorDiscoveryQueries(
  context: NationalDiscoveryBusinessContext,
): NationalCompetitorDiscoveryQuery[] {
  const country = clean(context.marketCountry) || "United Kingdom";
  const customerMarket = compactCustomerMarketPhrase(context.targetCustomerMarket);
  const services = unique(context.services).slice(0, COMMERCIAL_DISCOVERY_MAX_QUERIES);
  const proposition = compactCustomerMarketPhrase(context.proposition || "");

  const raw: Array<{
    query: string;
    serviceIntent: string;
    reason: string;
  }> = [];

  for (const service of services) {
    raw.push({
      query: [service, customerMarket, country].filter(Boolean).join(" "),
      serviceIntent: service,
      reason: `Discover businesses selling ${service} to the configured target customer market in ${country}.`,
    });
  }

  if (customerMarket) {
    const typeBit = clean(context.businessType);
    raw.push({
      query: [typeBit && typeBit !== "healthcare" ? typeBit : "", customerMarket, country].filter(Boolean).join(" "),
      serviceIntent: customerMarket,
      reason: `Discover commercial providers serving the same target customer market in ${country}.`,
    });
  }

  if (proposition && proposition.toLowerCase() !== customerMarket.toLowerCase()) {
    raw.push({
      query: [proposition, country].filter(Boolean).join(" "),
      serviceIntent: proposition,
      reason: "Discover commercial providers matching the evidenced business proposition.",
    });
  }

  const seen = new Set<string>();

  return raw
    .filter((row) => {
      const key = row.query.toLowerCase();
      if (seen.has(key) || key.length < 8) return false;
      seen.add(key);
      return true;
    })
    .slice(0, COMMERCIAL_DISCOVERY_MAX_QUERIES)
    .map((row, index) => ({
      id: queryId(index),
      query: row.query,
      marketCountry: country,
      targetCustomerMarket: customerMarket || clean(context.targetCustomerMarket),
      serviceIntent: row.serviceIntent,
      evidenceReason: row.reason,
    }));
}
