/**
 * Pharmacy Competitor Intelligence V1 —
 * enriches discovered competitors with Google Business Profile intelligence.
 */
import fs from "node:fs";
import path from "node:path";
import {
  COMPETITOR_INTEL_DIR,
  type CompetitorDiscoveryResult,
  type DiscoveredCompetitor,
  loadCompetitorDiscoveryResult,
} from "./pharmacyCompetitorDiscovery.ts";

export interface CompetitorReview {
  rating: number;
  text: string;
  relativeTime: string;
  author: string;
}

export interface CompetitorOpeningHours {
  weekdayDescriptions: string[];
  openNow: boolean | null;
}

export interface EnrichedCompetitor extends DiscoveredCompetitor {
  categories: string[];
  gbpRating: number | null;
  gbpReviewCount: number;
  reviews: CompetitorReview[];
  services: string[];
  openingHours: CompetitorOpeningHours;
  chainBrand: string | null;
  independent: boolean;
  hasWebsite: boolean;
  hasPhone: boolean;
}

export interface CompetitorIntelligenceResult {
  slug: string;
  generatedAt: string;
  source: string;
  pharmacy: CompetitorDiscoveryResult["pharmacy"];
  competitors: EnrichedCompetitor[];
  competitorSummary: {
    count: number;
    avgRating: number;
    avgReviewCount: number;
    nearestDistanceKm: number;
    chainCount: number;
    independentCount: number;
    withWebsite: number;
    withPhone: number;
  };
}

const CHAIN_PATTERNS: Array<[RegExp, string]> = [
  [/boots/i, "Boots"],
  [/lloyds/i, "Lloyds"],
  [/well pharmacy/i, "Well"],
  [/superdrug/i, "Superdrug"],
  [/asda/i, "ASDA"],
  [/tesco/i, "Tesco"],
  [/morrisons/i, "Morrisons"],
  [/rowlands/i, "Rowlands"],
  [/day lewis/i, "Day Lewis"],
  [/cohens/i, "Cohens"],
];

const SERVICE_KEYWORDS: Record<string, string[]> = {
  "prescription-dispensing": ["prescription", "dispensing", "nhs prescription"],
  "repeat-prescriptions": ["repeat prescription", "repeat medicines"],
  "pharmacy-first": ["pharmacy first", "minor illness", "nhs consultation"],
  "blood-pressure-checks": ["blood pressure", "hypertension screening"],
  "flu-vaccinations": ["flu jab", "flu vaccination", "influenza"],
  "covid-vaccinations": ["covid", "coronavirus vaccination"],
  "travel-vaccinations": ["travel vaccination", "travel clinic", "travel jab"],
  "travel-health-consultations": ["travel health", "malaria", "travel advice"],
  "smoking-cessation": ["stop smoking", "smoking cessation", "quit smoking"],
  "weight-management": ["weight management", "weight loss"],
  "ear-wax-removal": ["ear wax", "microsuction"],
  "new-medicine-service": ["new medicine service", "nms"],
  "emergency-contraception": ["emergency contraception", "morning after"],
  "pharmacy-contraception-service": ["contraception", "pill consultation"],
  "minor-ailments": ["minor ailments", "common conditions"],
  "malaria-prevention": ["malaria", "antimalarial"],
  "vitamin-b12-injections": ["b12", "vitamin b12"],
  "health-checks": ["health check", "health screening"],
  "medication-reviews": ["medication review", "medicines use review"],
  "nhs-services": ["nhs services", "nhs pharmacy"],
};

function detectChain(name: string): { chainBrand: string | null; independent: boolean } {
  for (const [pattern, brand] of CHAIN_PATTERNS) {
    if (pattern.test(name)) return { chainBrand: brand, independent: false };
  }
  return { chainBrand: null, independent: true };
}

function inferCategories(name: string): string[] {
  const cats = ["Pharmacy", "Health"];
  const lower = name.toLowerCase();
  if (/chemist|dispensing/.test(lower)) cats.push("Chemist");
  if (/travel|clinic/.test(lower)) cats.push("Travel Clinic");
  if (/nhs/.test(lower)) cats.push("NHS Services");
  return [...new Set(cats)];
}

function demoServicesForCompetitor(name: string, index: number): string[] {
  const all = Object.keys(SERVICE_KEYWORDS);
  const { chainBrand } = detectChain(name);
  const baseCount = chainBrand ? 12 : 10;
  const start = index % 5;
  const picked = new Set<string>();
  for (let i = 0; i < baseCount; i++) {
    picked.add(all[(start + i * 3) % all.length]);
  }
  if (/travel|superdrug|boots/i.test(name)) {
    picked.add("travel-vaccinations");
    picked.add("travel-health-consultations");
  }
  if (/lloyds|well|rowlands/i.test(name)) {
    picked.add("pharmacy-first");
    picked.add("blood-pressure-checks");
  }
  picked.add("prescription-dispensing");
  picked.add("repeat-prescriptions");
  return [...picked];
}

function demoReviews(name: string, rating: number | null): CompetitorReview[] {
  const r = rating ?? 4.0;
  return [
    {
      rating: r,
      text: `Helpful team at ${name} — quick prescription collection and friendly advice.`,
      relativeTime: "2 weeks ago",
      author: "Local patient",
    },
    {
      rating: Math.max(1, r - 0.3),
      text: "Convenient location and reasonable wait times for a booked service.",
      relativeTime: "1 month ago",
      author: "Verified visitor",
    },
    {
      rating: Math.min(5, r + 0.2),
      text: "Professional pharmacy service — would recommend for routine healthcare needs.",
      relativeTime: "2 months ago",
      author: "Community member",
    },
  ];
}

function demoOpeningHours(): CompetitorOpeningHours {
  return {
    weekdayDescriptions: [
      "Monday: 9:00 AM – 6:00 PM",
      "Tuesday: 9:00 AM – 6:00 PM",
      "Wednesday: 9:00 AM – 6:00 PM",
      "Thursday: 9:00 AM – 7:00 PM",
      "Friday: 9:00 AM – 6:00 PM",
      "Saturday: 9:00 AM – 5:00 PM",
      "Sunday: Closed",
    ],
    openNow: null,
  };
}

async function fetchPlaceDetails(placeId: string): Promise<Partial<EnrichedCompetitor> | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || !placeId || placeId.startsWith("demo-")) return null;

  const res = await fetch(`https://places.googleapis.com/v1/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "displayName,formattedAddress,rating,userRatingCount,websiteUri,nationalPhoneNumber,types,regularOpeningHours,reviews",
    },
  });
  if (!res.ok) return null;

  const p: any = await res.json();
  const reviews: CompetitorReview[] = (p.reviews || []).slice(0, 5).map((r: any) => ({
    rating: r.rating ?? 0,
    text: r.text?.text || r.originalText?.text || "",
    relativeTime: r.relativePublishTimeDescription || r.publishTime || "",
    author: r.authorAttribution?.displayName || "Anonymous",
  }));

  return {
    gbpRating: p.rating ?? null,
    gbpReviewCount: p.userRatingCount ?? 0,
    website: p.websiteUri || "",
    phone: p.nationalPhoneNumber || "",
    categories: (p.types || []).map((t: string) => t.replace(/_/g, " ")),
    reviews,
    openingHours: {
      weekdayDescriptions: p.regularOpeningHours?.weekdayDescriptions || [],
      openNow: p.regularOpeningHours?.openNow ?? null,
    },
  };
}

function enrichCompetitor(competitor: DiscoveredCompetitor, index: number): EnrichedCompetitor {
  const { chainBrand, independent } = detectChain(competitor.name);
  const services = demoServicesForCompetitor(competitor.name, index);
  const rating = competitor.rating;
  return {
    ...competitor,
    categories: inferCategories(competitor.name),
    gbpRating: rating,
    gbpReviewCount: competitor.reviewCount,
    reviews: demoReviews(competitor.name, rating),
    services,
    openingHours: demoOpeningHours(),
    chainBrand,
    independent,
    hasWebsite: Boolean(competitor.website),
    hasPhone: Boolean(competitor.phone),
  };
}

export async function buildCompetitorIntelligence(
  discovery: CompetitorDiscoveryResult,
): Promise<CompetitorIntelligenceResult> {
  const competitors: EnrichedCompetitor[] = [];

  for (let i = 0; i < discovery.competitors.length; i++) {
    const base = discovery.competitors[i];
    let enriched = enrichCompetitor(base, i);

    if (process.env.GOOGLE_PLACES_API_KEY && base.placeId && !base.placeId.startsWith("demo-")) {
      const details = await fetchPlaceDetails(base.placeId);
      if (details) {
        enriched = {
          ...enriched,
          ...details,
          gbpRating: details.gbpRating ?? enriched.gbpRating,
          gbpReviewCount: details.gbpReviewCount ?? enriched.gbpReviewCount,
          hasWebsite: Boolean(details.website || enriched.website),
          hasPhone: Boolean(details.phone || enriched.phone),
        };
        if (details.services?.length) enriched.services = details.services;
      }
    }

    competitors.push(enriched);
  }

  const ratings = competitors.map((c) => c.gbpRating).filter((r): r is number => r != null);
  const reviews = competitors.map((c) => c.gbpReviewCount);
  const distances = competitors.map((c) => c.distanceKm);

  return {
    slug: discovery.slug,
    generatedAt: new Date().toISOString(),
    source: discovery.source,
    pharmacy: discovery.pharmacy,
    competitors,
    competitorSummary: {
      count: competitors.length,
      avgRating: ratings.length
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : 0,
      avgReviewCount: reviews.length ? Math.round(reviews.reduce((a, b) => a + b, 0) / reviews.length) : 0,
      nearestDistanceKm: distances.length ? Math.min(...distances) : 0,
      chainCount: competitors.filter((c) => !c.independent).length,
      independentCount: competitors.filter((c) => c.independent).length,
      withWebsite: competitors.filter((c) => c.hasWebsite).length,
      withPhone: competitors.filter((c) => c.hasPhone).length,
    },
  };
}

export function inferCompetitorHasService(competitor: EnrichedCompetitor, serviceId: string): boolean {
  return competitor.services.includes(serviceId);
}

export { SERVICE_KEYWORDS };

export function writeCompetitorIntelligence(result: CompetitorIntelligenceResult): string {
  fs.mkdirSync(COMPETITOR_INTEL_DIR, { recursive: true });
  const file = path.join(COMPETITOR_INTEL_DIR, `${result.slug}-intelligence.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  return file;
}

export function loadCompetitorIntelligence(slug: string): CompetitorIntelligenceResult | null {
  const file = path.join(COMPETITOR_INTEL_DIR, `${slug}-intelligence.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export async function runCompetitorIntelligencePipeline(
  slug: string,
): Promise<CompetitorIntelligenceResult> {
  const discovery = loadCompetitorDiscoveryResult(slug);
  if (!discovery) throw new Error(`Competitor discovery not found for ${slug}`);
  return buildCompetitorIntelligence(discovery);
}
