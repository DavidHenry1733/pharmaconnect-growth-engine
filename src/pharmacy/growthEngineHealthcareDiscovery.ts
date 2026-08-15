/**
 * Growth Engine — Local Healthcare Intelligence V1 discovery (Google Places only).
 */
import type { HealthcareProviderEntity, HealthcareProviderGroupKey } from "./growthEngineHealthcareModel.ts";

const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.types",
  "places.primaryType",
  "places.businessStatus",
  "places.currentOpeningHours",
  "places.googleMapsUri",
].join(",");

interface DiscoveryContext {
  pharmacyLat: number;
  pharmacyLng: number;
  postcode: string;
  town: string;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function formatDistance(km: number | null): string {
  if (km == null || !Number.isFinite(km)) return "";
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

function openingStatus(p: Record<string, unknown>): string {
  const current = p.currentOpeningHours as Record<string, unknown> | undefined;
  if (current?.openNow === true) return "Open now";
  if (current?.openNow === false) return "Closed now";
  const status = String(p.businessStatus || "");
  if (status === "OPERATIONAL") return "Operational";
  if (status) return status.replace(/_/g, " ");
  return "";
}

function isPharmacyName(name: string): boolean {
  return /pharmacy|chemist|boots|rowlands|lloyds|superdrug|well pharmacy/i.test(name);
}

export function classifyHealthcareProvider(
  name: string,
  types: string[],
  primaryType: string,
): { groupKey: HealthcareProviderGroupKey; category: string } | null {
  const lower = name.toLowerCase();
  const typeSet = types.map((t) => t.toLowerCase());

  if (isPharmacyName(name)) return null;

  if (typeSet.includes("hospital") || /hospital|a\s*&\s*e|nhs trust/i.test(lower)) {
    return { groupKey: "hospitals", category: "Hospital" };
  }
  if (/urgent treatment|urgent care|minor injuries/i.test(lower)) {
    return { groupKey: "urgentTreatmentCentres", category: "Urgent Treatment Centre" };
  }
  if (
    typeSet.includes("doctor") ||
    /gp surgery|gp practice|doctors surgery|medical practice|family practice/i.test(lower)
  ) {
    return { groupKey: "gpSurgeries", category: "GP Surgery" };
  }
  if (/walk-in|walk in|walk in centre|walk-in centre/i.test(lower)) {
    return { groupKey: "walkInCentres", category: "Walk-in Centre" };
  }
  if (/health centre|health center|medical centre|medical center/i.test(lower) || typeSet.includes("medical_center")) {
    return { groupKey: "healthCentres", category: "Health Centre" };
  }
  if (/care home|nursing home|residential care/i.test(lower)) {
    return { groupKey: "careHomes", category: "Care Home" };
  }
  if (typeSet.includes("dentist") || /dentist|dental practice|dental clinic/i.test(lower)) {
    return { groupKey: "dentists", category: "Dentist" };
  }
  if (typeSet.includes("optician") || /optician|optometrist|eye care/i.test(lower)) {
    return { groupKey: "opticians", category: "Optician" };
  }
  if (/physiotherapist|physiotherapy|physio clinic/i.test(lower)) {
    return { groupKey: "physiotherapists", category: "Physiotherapist" };
  }
  if (/podiatrist|chiropodist|foot clinic/i.test(lower)) {
    return { groupKey: "podiatrists", category: "Podiatrist" };
  }
  if (/mental health|counselling|psycholog|psychiatr|talking therapies|iapt/i.test(lower)) {
    return { groupKey: "mentalHealthServices", category: "Mental Health Service" };
  }
  if (/community clinic|community health|primary care network|pcn/i.test(lower)) {
    return { groupKey: "communityClinics", category: "Community Clinic" };
  }

  if (
    typeSet.some((t) =>
      ["doctor", "hospital", "health", "medical", "dentist", "physiotherapist"].some((k) => t.includes(k)),
    )
  ) {
    const cat = primaryType.replace(/_/g, " ") || "Healthcare";
    return { groupKey: "communityClinics", category: cat };
  }

  return null;
}

function mapPlaceToProvider(
  p: Record<string, unknown>,
  ctx: DiscoveryContext,
  groupKey: HealthcareProviderGroupKey,
  category: string,
): HealthcareProviderEntity | null {
  const pid = String(p.id || "").replace(/^places\//, "");
  if (!pid) return null;

  const lat = (p.location as Record<string, unknown>)?.latitude;
  const lng = (p.location as Record<string, unknown>)?.longitude;
  const latitude = lat != null ? Number(lat) : null;
  const longitude = lng != null ? Number(lng) : null;

  let distanceKm: number | null = null;
  if (latitude != null && longitude != null) {
    distanceKm = haversineKm(ctx.pharmacyLat, ctx.pharmacyLng, latitude, longitude);
  }

  const businessName = String((p.displayName as Record<string, unknown>)?.text || "");
  if (!businessName) return null;

  const ratingRaw = p.rating;
  const rating =
    ratingRaw === null || ratingRaw === undefined ? null : Math.min(5, Math.max(0, Number(ratingRaw) || 0));

  return {
    placeId: pid,
    businessName,
    category,
    groupKey,
    distanceKm,
    distanceLabel: formatDistance(distanceKm),
    address: String(p.formattedAddress || ""),
    rating,
    reviewCount: p.userRatingCount != null ? Number(p.userRatingCount) : 0,
    phone: String(p.nationalPhoneNumber || p.internationalPhoneNumber || ""),
    website: String(p.websiteUri || ""),
    openingStatus: openingStatus(p),
    googleMapsUrl: String(
      p.googleMapsUri || `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(pid)}`,
    ),
    latitude,
    longitude,
    source: "google-places",
  };
}

async function searchHealthcarePlaces(query: string, maxResultCount = 8): Promise<Record<string, unknown>[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return [];

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: query, maxResultCount }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { places?: Record<string, unknown>[] };
    return data.places || [];
  } catch {
    return [];
  }
}

const HEALTHCARE_QUERIES: Array<{ query: string; fallbackGroup?: HealthcareProviderGroupKey; category?: string }> = [
  { query: "GP surgery doctor medical practice" },
  { query: "health centre walk-in centre" },
  { query: "hospital" },
  { query: "urgent treatment centre urgent care" },
  { query: "care home nursing home" },
  { query: "dentist dental practice" },
  { query: "optician optometrist" },
  { query: "physiotherapist physiotherapy" },
  { query: "podiatrist chiropodist" },
  { query: "mental health clinic counselling" },
  { query: "community clinic medical centre" },
];

export async function discoverHealthcareProviders(ctx: DiscoveryContext): Promise<HealthcareProviderEntity[]> {
  if (!process.env.GOOGLE_PLACES_API_KEY) return [];

  const location = [ctx.town, ctx.postcode].filter(Boolean).join(" ");
  const seen = new Set<string>();
  const providers: HealthcareProviderEntity[] = [];

  for (const { query } of HEALTHCARE_QUERIES) {
    const places = await searchHealthcarePlaces(`${query} near ${location}`, 8);
    for (const place of places) {
      const name = String((place.displayName as Record<string, unknown>)?.text || "");
      const types = Array.isArray(place.types) ? place.types.map(String) : [];
      const primaryType = String(place.primaryType || types[0] || "");
      const classified = classifyHealthcareProvider(name, types, primaryType);
      if (!classified) continue;

      const pid = String(place.id || "").replace(/^places\//, "");
      if (!pid || seen.has(pid)) continue;
      seen.add(pid);

      const provider = mapPlaceToProvider(place, ctx, classified.groupKey, classified.category);
      if (provider) providers.push(provider);
    }
  }

  return providers.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
}

export function realHealthcareProviders(providers: HealthcareProviderEntity[]): HealthcareProviderEntity[] {
  return providers.filter(
    (p): p is HealthcareProviderEntity =>
      Boolean(p) && p.source === "google-places" && Boolean(p.placeId) && !p.placeId.startsWith("demo-"),
  );
}
