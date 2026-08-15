/**
 * DataForSEO National Search Adapter V1
 *
 * Connects the NATIONAL Growth Platform search-provider contract
 * to DataForSEO Google Organic SERP Live Advanced.
 *
 * No Local Growth Engine dependencies.
 * No Google Places dependencies.
 */

import type {
  NationalSearchProvider,
  NationalSearchRequest,
  NationalSearchResponse,
  NationalSearchEvidence,
} from "./nationalSearchProviderModel.ts";

const ENDPOINT =
  "https://api.dataforseo.com/v3/serp/google/organic/live/advanced";

function requireCredential(name: string): string {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function canonicalDomain(raw: unknown, url: unknown): string {
  const supplied = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");

  if (supplied) return supplied;

  try {
    return new URL(String(url || "")).hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return "";
  }
}

export class DataForSeoNationalSearchProvider
  implements NationalSearchProvider
{
  readonly id = "dataforseo-google-organic-live";

  async search(
    request: NationalSearchRequest,
  ): Promise<NationalSearchResponse> {
    const login = requireCredential("DATAFORSEO_LOGIN");
    const password = requireCredential("DATAFORSEO_PASSWORD");

    const query = String(request.query || "").trim();

    if (!query) {
      throw new Error("National search query is required");
    }

    const marketCountry =
      String(request.marketCountry || "").trim() || "United Kingdom";

    const languageCode =
      String(request.languageCode || "").trim() || "en";

    const depth = Math.max(
      10,
      Math.min(Number(request.depth || 10), 100),
    );

    const auth = Buffer.from(
      `${login}:${password}`,
      "utf8",
    ).toString("base64");

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          keyword: query,
          location_name: marketCountry,
          language_code: languageCode,
          depth,
        },
      ]),
    });

    const rawText = await response.text();

    let payload: any;

    try {
      payload = JSON.parse(rawText);
    } catch {
      throw new Error(
        `DataForSEO returned invalid JSON (HTTP ${response.status})`,
      );
    }

    if (!response.ok) {
      throw new Error(
        `DataForSEO HTTP ${response.status}: ${
          payload?.status_message || "request failed"
        }`,
      );
    }

    if (payload?.status_code !== 20000) {
      throw new Error(
        `DataForSEO API ${payload?.status_code || "unknown"}: ${
          payload?.status_message || "request failed"
        }`,
      );
    }

    const task = payload?.tasks?.[0];

    if (!task || task.status_code !== 20000) {
      throw new Error(
        `DataForSEO task ${task?.status_code || "unknown"}: ${
          task?.status_message || "request failed"
        }`,
      );
    }

    const result = task?.result?.[0];
    const items = Array.isArray(result?.items)
      ? result.items
      : [];

    const organic: NationalSearchEvidence[] = items
      .filter((item: any) => item?.type === "organic")
      .map((item: any) => ({
        position: Number(
          item.rank_absolute || item.rank_group || 0,
        ),
        domain: canonicalDomain(item.domain, item.url),
        url: String(item.url || ""),
        title: String(item.title || ""),
        description: String(
          item.description || item.snippet || "",
        ),
        source: this.id,
      }))
      .filter(
        (item: NationalSearchEvidence) =>
          Boolean(item.domain && item.url),
      );

    return {
      provider: this.id,
      query,
      marketCountry,
      capturedAt: new Date().toISOString(),
      cost:
        typeof task.cost === "number"
          ? task.cost
          : null,
      organicResultCount: organic.length,
      results: organic,
    };
  }
}

export async function searchNationalGoogleOrganic(
  request: NationalSearchRequest,
): Promise<NationalSearchResponse> {
  const provider = new DataForSeoNationalSearchProvider();
  return provider.search(request);
}
