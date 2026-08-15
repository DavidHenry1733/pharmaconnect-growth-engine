/**
 * Local Market Report V2 — presentation view model (read-only, no engine changes).
 * Derives commercial intelligence from live Google Places snapshot data only.
 */
import type { GrowthEngineCompetitorSnapshot } from "./growthEngineCompetitorModel.ts";
import type { HealthcareProviderEntity } from "./growthEngineHealthcareModel.ts";
import {
  buildOpportunityHighlights,
  realGoogleCompetitors,
} from "./growthEngineLocalMarketAnalysis.ts";
import { realHealthcareProviders } from "./growthEngineHealthcareDiscovery.ts";

export interface LocalMarketOverviewCounts {
  pharmacies: number;
  gpSurgeries: number;
  hospitals: number;
  healthCentres: number;
  walkInCentres: number;
  careHomes: number;
  otherHealthcare: number;
}

export interface LocalMarketReportView {
  live: boolean;
  lastUpdated: string | null;
  overview: LocalMarketOverviewCounts;
  insights: string[];
  actions: string[];
  opportunitySummary: string;
}

const SERVICE_PROVIDER_KEYS = new Set([
  "dentists",
  "opticians",
  "physiotherapists",
  "podiatrists",
  "mentalHealthServices",
  "communityClinics",
  "urgentTreatmentCentres",
]);

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function countHealthcare(providers: HealthcareProviderEntity[]): Omit<LocalMarketOverviewCounts, "pharmacies"> {
  const live = realHealthcareProviders(providers);
  return {
    gpSurgeries: live.filter((p) => p.groupKey === "gpSurgeries").length,
    hospitals: live.filter((p) => p.groupKey === "hospitals").length,
    healthCentres: live.filter((p) => p.groupKey === "healthCentres").length,
    walkInCentres: live.filter((p) => p.groupKey === "walkInCentres").length,
    careHomes: live.filter((p) => p.groupKey === "careHomes").length,
    otherHealthcare: live.filter((p) => SERVICE_PROVIDER_KEYS.has(p.groupKey)).length,
  };
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ")}…`;
}

function buildExtraInsights(
  snapshot: GrowthEngineCompetitorSnapshot,
): string[] {
  const yours = snapshot.yourPharmacy;
  const pool = realGoogleCompetitors(snapshot.competitors);
  const insights: string[] = [];
  if (!yours || !pool.length) return insights;

  const reviewAvg = avg(pool.map((c) => c.reviewCount));
  if (reviewAvg != null && yours.reviewCount < reviewAvg) {
    insights.push("Your pharmacy has fewer Google reviews than the local average.");
  }

  const ratingAvg = avg(pool.map((c) => c.rating).filter((r): r is number => r != null));
  const maxRating = Math.max(...pool.map((c) => c.rating ?? 0));
  if (yours.rating != null && ratingAvg != null && yours.rating >= ratingAvg && yours.rating >= maxRating - 0.05) {
    insights.push("Your rating is one of the highest in your area.");
  }

  const photoAvg = avg(pool.map((c) => c.photoCount));
  if (photoAvg != null && yours.photoCount < photoAvg) {
    const significantlyMore = pool.filter((c) => c.photoCount > yours.photoCount + 10).length;
    if (significantlyMore >= 2) {
      insights.push("Most competitors have significantly more business photos on Google.");
    } else {
      insights.push("Your Google Business profile has fewer photos than the local average.");
    }
  }

  const yourCats = 1 + yours.secondaryCategories.length;
  const moreCategories = pool.filter((c) => 1 + c.secondaryCategories.length > yourCats).length;
  if (moreCategories >= 2) {
    insights.push("Several competitors promote additional services on their Google listing.");
  }

  if (!yours.openingHours.length && pool.filter((c) => c.openingHours.length > 0).length >= pool.length / 2) {
    insights.push("Many nearby pharmacies list opening hours on Google — yours may be incomplete.");
  }

  if (!yours.website && pool.filter((c) => c.website).length >= Math.ceil(pool.length / 2)) {
    insights.push("Many competitors link a website from Google — patients may not find yours as easily.");
  }

  return insights;
}

function dedupeInsights(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.slice(0, 6);
}

function buildRecommendedActions(insights: string[], snapshot: GrowthEngineCompetitorSnapshot): string[] {
  const yours = snapshot.yourPharmacy;
  const pool = realGoogleCompetitors(snapshot.competitors);
  const actions: string[] = [];

  const add = (action: string) => {
    if (actions.length < 6 && !actions.includes(action)) actions.push(action);
  };

  for (const insight of insights) {
    const lower = insight.toLowerCase();
    if (lower.includes("fewer google reviews")) add("Increase Google reviews by inviting patients to share their experience.");
    else if (lower.includes("fewer photos") || lower.includes("more business photos")) add("Upload additional business photos to your Google profile.");
    else if (lower.includes("additional services")) add("Promote more pharmacy services on your Google Business Profile.");
    else if (lower.includes("opening hours") || lower.includes("incomplete")) add("Complete missing business information on Google.");
    else if (lower.includes("website")) add("Add your website link to your Google Business Profile.");
    else if (lower.includes("below the local average") && lower.includes("rating")) add("Focus on patient experience to strengthen your Google rating.");
  }

  if (yours && pool.length) {
    if (!yours.phone) add("Complete missing business information on Google.");
    if (!yours.openingHours.length) add("Complete missing business information on Google.");
  }

  add("Keep your Google Business Profile active with regular updates and fresh photos.");

  return actions.slice(0, 6);
}

function buildOpportunitySummary(insights: string[], snapshot: GrowthEngineCompetitorSnapshot): string {
  const yours = snapshot.yourPharmacy;
  const pool = realGoogleCompetitors(snapshot.competitors);
  if (!pool.length) {
    return "Run Discover local market to load live Google Places data. We only show counts and comparisons from genuine Google listings — nothing is invented.";
  }

  const parts: string[] = [];
  if (yours?.rating != null && yours.rating >= 4.5) {
    parts.push("Your pharmacy already has a strong Google rating.");
  } else if (yours?.rating != null) {
    parts.push(`Your pharmacy is rated ${yours.rating.toFixed(1)} on Google among ${pool.length} nearby pharmacies.`);
  } else {
    parts.push(`We analysed ${pool.length} nearby pharmacies from Google Places.`);
  }

  const reviewInsight = insights.find((i) => /reviews/i.test(i));
  const photoInsight = insights.find((i) => /photo/i.test(i));
  const serviceInsight = insights.find((i) => /services/i.test(i));

  if (reviewInsight && photoInsight) {
    parts.push("Increasing your review count and adding more business photos represents the biggest opportunity to improve your local presence.");
  } else if (reviewInsight) {
    parts.push("Growing your Google review count is the clearest opportunity to strengthen your local presence.");
  } else if (photoInsight) {
    parts.push("Adding more business photos is a practical next step to stand out against nearby pharmacies.");
  } else if (serviceInsight) {
    parts.push("Expanding the services visible on your Google listing could help patients discover what you offer.");
  } else if (insights.some((i) => /highest/i.test(i))) {
    parts.push("Maintaining your reputation and keeping your profile fresh will help you stay ahead locally.");
  } else {
    parts.push("Keep your Google profile complete and active to stay competitive in your area.");
  }

  return truncateWords(parts.join(" "), 120);
}

export function buildLocalMarketReportView(snapshot: GrowthEngineCompetitorSnapshot | null): LocalMarketReportView {
  if (!snapshot) {
    return {
      live: false,
      lastUpdated: null,
      overview: { pharmacies: 0, gpSurgeries: 0, hospitals: 0, healthCentres: 0, walkInCentres: 0, careHomes: 0, otherHealthcare: 0 },
      insights: [],
      actions: [],
      opportunitySummary: "",
    };
  }

  const live = snapshot.analysis?.dataSource === "google-places-live";
  const pool = realGoogleCompetitors(snapshot.competitors);
  const providers = snapshot.healthcare?.providers || [];
  const hcCounts = countHealthcare(providers);

  const baseInsights = live && snapshot.yourPharmacy
    ? buildOpportunityHighlights(snapshot.yourPharmacy, snapshot.competitors)
    : [];
  const extraInsights = live ? buildExtraInsights(snapshot) : [];
  const insights = dedupeInsights([...extraInsights, ...baseInsights.map((o) => o.replace(/^You /, "Your pharmacy ").replace(/^You have/, "Your pharmacy has"))]);

  const actions = live ? buildRecommendedActions(insights, snapshot) : [];

  return {
    live,
    lastUpdated: snapshot.generatedAt || null,
    overview: {
      pharmacies: pool.length,
      ...hcCounts,
    },
    insights,
    actions,
    opportunitySummary: live ? buildOpportunitySummary(insights, snapshot) : "",
  };
}

export function sortCompetitorsByDistance<T extends { distanceKm: number | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
}
