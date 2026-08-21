/**
 * Display-only classifier for stored DataForSEO organic-search evidence.
 *
 * Google Places remains the only canonical source of nearby physical competitors.
 * Matching uses the same stored Google-local artifacts as the competitor table:
 * pharmacy-competitor-intelligence first, else a live Google Places snapshot.
 * DataForSEO rows are supporting organic-search evidence and are never promoted
 * into the Google-local competitor set.
 *
 * Does not call Google or DataForSEO. Does not write artifacts.
 */
import { extractRegistrableDomain } from "./customerRootDomainResolver.ts";
import { loadCompetitorIntelligence } from "./pharmacyCompetitorIntelligence.ts";
import { loadCompetitorSnapshot } from "./growthEngineLocalMarketService.ts";
import { readNationalCompetitorDiscovery } from "./nationalCompetitorDiscoveryStorageService.ts";
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";

export const ORGANIC_SEARCH_EVIDENCE_TITLE = "Organic Search Evidence — DataForSEO";
export const ORGANIC_SEARCH_EVIDENCE_EXPLANATION =
  "Organic search results show who appears for relevant searches. Only businesses independently verified through Google Places are treated as nearby local competitors.";

export const YOUR_PHARMACY_VISIBILITY_LABEL = "Your pharmacy’s organic visibility";
export const VERIFIED_LOCAL_MATCH_LABEL = "Verified local competitor organic visibility";
export const WIDER_LANDSCAPE_LABEL =
  "Wider organic search landscape — not verified as nearby physical competitors";

export type OrganicSearchBucket = "your_pharmacy" | "verified_local_match" | "wider_landscape";

export type WiderLandscapeKind =
  | "directory"
  | "regulator"
  | "social"
  | "nhs_community"
  | "publisher"
  | "unmatched_pharmacy_website"
  | "other_ranking_domain";

export interface OrganicSearchEvidenceRow {
  domain: string;
  host: string;
  url: string;
  position: number | null;
  matchedQuery: string;
  title: string;
  description: string;
  evidence: string;
  source: string;
  capturedAt: string | null;
  taskId: string | null;
  classification: OrganicSearchBucket;
  classificationReason: string;
  matchedGoogleCompetitorName: string | null;
  landscapeKind: WiderLandscapeKind | null;
}

export interface OrganicSearchEvidenceSection {
  title: string;
  explanation: string;
  generated: boolean;
  provider: string;
  capturedAt: string | null;
  locationName: string | null;
  languageCode: string | null;
  yourPharmacy: {
    label: string;
    emptyState: string;
    rows: OrganicSearchEvidenceRow[];
  };
  verifiedLocalMatches: {
    label: string;
    emptyState: string;
    rows: OrganicSearchEvidenceRow[];
  };
  widerLandscape: {
    label: string;
    emptyState: string;
    rows: OrganicSearchEvidenceRow[];
  };
}

export interface StoredOrganicRow {
  domain?: unknown;
  host?: unknown;
  url?: unknown;
  websiteUrl?: unknown;
  position?: unknown;
  matchedQuery?: unknown;
  sourceQuery?: unknown;
  title?: unknown;
  name?: unknown;
  description?: unknown;
  overlapEvidence?: unknown;
  capturedAt?: unknown;
  provider?: unknown;
  provenance?: unknown;
  taskId?: unknown;
}

interface GoogleLocalWebsite {
  name: string;
  website: string;
  host: string;
  registrable: string | null;
  placeId: string;
}

const SOCIAL_HOSTS = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "youtube.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "threads.net",
];

const DIRECTORY_HOSTS = [
  "yell.com",
  "thomsonlocal.com",
  "cylex-uk.co.uk",
  "touchlocal.com",
  "192.com",
  "scoot.co.uk",
  "hotfrog.co.uk",
  "freeindex.co.uk",
  "yelp.co.uk",
  "yelp.com",
  "bing.com",
  "maps.google.com",
];

const REGULATOR_HOSTS = [
  "pharmacyregulation.org",
  "gov.uk",
  "cqc.org.uk",
  "gmc-uk.org",
  "professionalstandards.org.uk",
];

const NHS_COMMUNITY_HOSTS = [
  "nhs.uk",
  "nhs.net",
  "communitypharmacy.org.uk",
  "cpe.org.uk",
  "cpsc.org.uk",
];

const PUBLISHER_HOSTS = [
  "wikipedia.org",
  "bmj.com",
  "pharmaceutical-journal.com",
  "chemistanddruggist.co.uk",
];

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

/** Strip protocol, www, path, query, fragment and port. */
export function canonicalHostname(raw: unknown): string {
  const input = clean(raw);
  if (!input) return "";
  try {
    const url = new URL(input.includes("://") ? input : `https://${input}`);
    return url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  } catch {
    return input
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .split("?")[0]
      .split("#")[0]
      .split(":")[0]
      .replace(/\.$/, "");
  }
}

export function domainsEquivalent(left: unknown, right: unknown): boolean {
  const a = canonicalHostname(left);
  const b = canonicalHostname(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const ra = extractRegistrableDomain(a);
  const rb = extractRegistrableDomain(b);
  return Boolean(ra && rb && ra === rb);
}

function hostMatchesList(host: string, list: string[]): boolean {
  const registrable = extractRegistrableDomain(host) || host;
  return list.some((item) => host === item || registrable === item || host.endsWith(`.${item}`));
}

export function classifyWiderLandscapeKind(host: string, title: string, description: string): WiderLandscapeKind {
  if (hostMatchesList(host, SOCIAL_HOSTS)) return "social";
  if (hostMatchesList(host, DIRECTORY_HOSTS)) return "directory";
  if (hostMatchesList(host, REGULATOR_HOSTS)) return "regulator";
  if (hostMatchesList(host, NHS_COMMUNITY_HOSTS)) return "nhs_community";
  if (hostMatchesList(host, PUBLISHER_HOSTS)) return "publisher";
  const blob = `${title} ${description} ${host}`.toLowerCase();
  if (/\b(pharmacy|chemist|dispensary)\b/.test(blob)) return "unmatched_pharmacy_website";
  return "other_ranking_domain";
}

function landscapeKindLabel(kind: WiderLandscapeKind): string {
  switch (kind) {
    case "directory":
      return "directory";
    case "regulator":
      return "regulator";
    case "social":
      return "social network";
    case "nhs_community":
      return "NHS/community organisation";
    case "publisher":
      return "publisher";
    case "unmatched_pharmacy_website":
      return "pharmacy-related domain not verified through Google Places as a nearby physical competitor";
    default:
      return "other ranking domain";
  }
}

function tenantWebsiteCandidates(profile: PharmacyProfileData | null | undefined): string[] {
  if (!profile) return [];
  const snap = profile.googleImportSnapshot;
  return [profile.website, snap?.website, profile.googleBusinessProfileUrl].filter(Boolean).map(String);
}

function googleLocalWebsites(slug: string): GoogleLocalWebsite[] {
  const intel = loadCompetitorIntelligence(slug);
  const snap = loadCompetitorSnapshot(slug);
  const rows =
    intel?.competitors.length
      ? intel.competitors.map((c) => ({
          name: c.name,
          website: c.website || "",
          placeId: c.placeId || "",
          source: c.source,
        }))
      : snap?.competitors.length && snap.source === "google-places-live"
        ? snap.competitors.map((c) => ({
            name: c.businessName,
            website: c.website || "",
            placeId: c.placeId || "",
            source: c.source,
          }))
        : [];
  return rows
    .filter((c) => c.source === "google-places" && c.placeId && !c.placeId.startsWith("demo-") && c.website)
    .map((c) => {
      const host = canonicalHostname(c.website);
      return {
        name: c.name,
        website: c.website,
        host,
        registrable: extractRegistrableDomain(host),
        placeId: c.placeId,
      };
    })
    .filter((c) => c.host);
}

function storedOrganicRows(slug: string): {
  rows: StoredOrganicRow[];
  capturedAt: string | null;
  provider: string;
  locationName: string | null;
  languageCode: string | null;
} {
  const discovery = readNationalCompetitorDiscovery(slug);
  if (!discovery) {
    return {
      rows: [],
      capturedAt: null,
      provider: "dataforseo-google-organic-live",
      locationName: null,
      languageCode: null,
    };
  }
  const organic = (
    discovery as {
      organicSearch?: {
        competitors?: StoredOrganicRow[];
        capturedAt?: string;
        provider?: string;
        locationName?: string;
        languageCode?: string;
      };
    }
  ).organicSearch;
  if (organic) {
    return {
      rows: organic.competitors || [],
      capturedAt: organic.capturedAt || discovery.generatedAt || null,
      provider: organic.provider || "dataforseo-google-organic-live",
      locationName: organic.locationName || discovery.marketCountry || null,
      languageCode: organic.languageCode || null,
    };
  }
  const qualified = discovery.qualifiedCompetitors || [];
  return {
    rows: qualified.map((c) => ({
      domain: c.domain,
      host: c.domain,
      url: c.websiteUrl,
      websiteUrl: c.websiteUrl,
      position: null,
      matchedQuery: c.sourceQuery,
      title: c.title || c.name,
      description: c.description,
      overlapEvidence: (c.qualificationReasons || []).join("; "),
      capturedAt: c.capturedAt,
      provider: "dataforseo-google-organic-live",
    })),
    capturedAt: discovery.generatedAt || null,
    provider: "dataforseo-google-organic-live",
    locationName: discovery.marketCountry || null,
    languageCode: null,
  };
}

function matchGoogleCompetitor(host: string, competitors: GoogleLocalWebsite[]): GoogleLocalWebsite | null {
  return competitors.find((c) => domainsEquivalent(host, c.host) || domainsEquivalent(host, c.website)) || null;
}

export function classifyOrganicSearchRow(
  raw: StoredOrganicRow,
  tenantHosts: string[],
  googleCompetitors: GoogleLocalWebsite[],
  fallbackCapturedAt: string | null,
  fallbackProvider: string,
): OrganicSearchEvidenceRow {
  const url = clean(raw.url || raw.websiteUrl);
  const host = canonicalHostname(raw.host || raw.domain || url);
  const title = clean(raw.title || raw.name);
  const description = clean(raw.description);
  const capturedAt = clean(raw.capturedAt) || fallbackCapturedAt;
  const source = clean(raw.provider || raw.provenance) || fallbackProvider;
  const evidence = clean(raw.overlapEvidence) || "DataForSEO Google organic SERP";
  const positionRaw = raw.position;
  const position = typeof positionRaw === "number" && Number.isFinite(positionRaw) ? positionRaw : null;
  const taskId = clean(raw.taskId) || null;
  const matchedQuery = clean(raw.matchedQuery || raw.sourceQuery);
  const domain = host || clean(raw.domain);

  const base = {
    domain,
    host,
    url,
    position,
    matchedQuery,
    title,
    description,
    evidence,
    source,
    capturedAt,
    taskId,
  };

  const tenantMatch = tenantHosts.some((candidate) => domainsEquivalent(host, candidate));
  if (tenantMatch) {
    return {
      ...base,
      classification: "your_pharmacy" as const,
      classificationReason: `Canonical domain ${host} matches the tenant website. This is the pharmacy’s own organic visibility, not a competitor.`,
      matchedGoogleCompetitorName: null,
      landscapeKind: null,
    };
  }

  const googleMatch = matchGoogleCompetitor(host, googleCompetitors);
  if (googleMatch) {
    return {
      ...base,
      classification: "verified_local_match" as const,
      classificationReason: `Canonical domain ${host} matches the verified Google Places competitor ${googleMatch.name} (${googleMatch.host}).`,
      matchedGoogleCompetitorName: googleMatch.name,
      landscapeKind: null,
    };
  }

  const landscapeKind = classifyWiderLandscapeKind(host, title, description);
  return {
    ...base,
    classification: "wider_landscape" as const,
    classificationReason: `No verified Google Places website match. Classified as ${landscapeKindLabel(landscapeKind)}. Not a nearby physical competitor.`,
    matchedGoogleCompetitorName: null,
    landscapeKind,
  };
}

export function buildOrganicSearchEvidenceSection(
  slug: string,
  profile: PharmacyProfileData | null | undefined,
): OrganicSearchEvidenceSection {
  const stored = storedOrganicRows(slug);
  const tenantHosts = tenantWebsiteCandidates(profile).map(canonicalHostname).filter(Boolean);
  const googleCompetitors = googleLocalWebsites(slug);
  const classified = stored.rows.map((row) =>
    classifyOrganicSearchRow(row, tenantHosts, googleCompetitors, stored.capturedAt, stored.provider),
  );

  return {
    title: ORGANIC_SEARCH_EVIDENCE_TITLE,
    explanation: ORGANIC_SEARCH_EVIDENCE_EXPLANATION,
    generated: classified.length > 0,
    provider: stored.provider,
    capturedAt: stored.capturedAt,
    locationName: stored.locationName,
    languageCode: stored.languageCode,
    yourPharmacy: {
      label: YOUR_PHARMACY_VISIBILITY_LABEL,
      emptyState: "No organic results matched the tenant’s canonical website domain.",
      rows: classified.filter((row) => row.classification === "your_pharmacy"),
    },
    verifiedLocalMatches: {
      label: VERIFIED_LOCAL_MATCH_LABEL,
      emptyState: "No DataForSEO domains matched a verified Google Places competitor website.",
      rows: classified.filter((row) => row.classification === "verified_local_match"),
    },
    widerLandscape: {
      label: WIDER_LANDSCAPE_LABEL,
      emptyState: "No additional organic-search results were stored.",
      rows: classified.filter((row) => row.classification === "wider_landscape"),
    },
  };
}
