/**
 * Master Admin onboarding — automatic local area discovery (Local SEO Engine reuse).
 */
import { createHash } from "node:crypto";
import { loadCityAreaData } from "../area/loadCityAreaData.ts";
import { readSetupProfile, writeSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import {
  LOCAL_AREA_MINIMUM_FOR_LOCAL_PAGES,
  saveGenerationSetupLocalAreas,
} from "./masterAdminGenerationSetupService.ts";
import { discoverPharmacyAreas } from "./pharmacyAreaDiscoveryService.ts";
import {
  evaluateAreaNameForDiscovery,
  RECOMMENDED_SELECTED_AREAS,
} from "./pharmacyAreaSelectionService.ts";
import type { PharmacyProfileData, ProfileAreaEntry } from "./pharmacyProfileSchema.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import { isNationalMarketScope, resolvePrimaryMarket } from "./masterAdminMarketScopeService.ts";

export const ONBOARDING_AREA_DISCOVERY_SOURCE = "onboarding-area-discovery-v1";
export const MAX_ONBOARDING_DISCOVERY_DISTANCE_KM = 12;

export interface OnboardingDiscoveredArea {
  areaId: string;
  areaName: string;
  slug: string;
  type: "primary locality" | "district" | "neighbourhood" | "nearby locality" | "service area";
  parentTown: string;
  source: string;
  evidence: string;
  distanceKm: number | null;
  distanceLabel: string;
  confidence: number;
  recommended: boolean;
  selected: boolean;
  generationEligible: boolean;
}

export interface OnboardingAreaDiscoveryState {
  slug: string;
  primaryTown: string;
  discoveryRevision: string;
  discoveredAt: string;
  recommendedCount: number;
  selectedCount: number;
  minimumRecommended: number;
  localGenerationReadiness: string;
  readinessWarning: string | null;
  areas: OnboardingDiscoveredArea[];
  rejected: Array<{ name: string; reason: string }>;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function areaSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function discoveryInputRevision(input: {
  town: string;
  postcode: string;
  addressLine1: string;
}): string {
  const raw = [input.town, input.postcode, input.addressLine1]
    .map((v) => text(v).toLowerCase())
    .join("|");
  return createHash("sha1").update(raw).digest("hex").slice(0, 12);
}

function mapAreaType(entry: ProfileAreaEntry): OnboardingDiscoveredArea["type"] {
  if (entry.source === "manual" || entry.source === "operator") return "service area";
  const label = text(entry.areaType).toLowerCase();
  if (label.includes("priority") || label.includes("district")) return "district";
  if (label.includes("neighbourhood") || label.includes("secondary")) return "neighbourhood";
  return "nearby locality";
}

function distanceMeta(town: string, areaName: string): { km: number | null; label: string } {
  try {
    const cityData = loadCityAreaData(town);
    const profile = cityData.areas.find((a) => a.name.toLowerCase() === areaName.toLowerCase());
    if (profile?.distanceKm != null) {
      return {
        km: profile.distanceKm,
        label: `Approx. ${profile.distanceKm} km from ${town}`,
      };
    }
  } catch {
    /* ignore */
  }
  return { km: null, label: "Distance unavailable" };
}

function readinessLabel(selectedCount: number): { label: string; warning: string | null } {
  if (selectedCount >= LOCAL_AREA_MINIMUM_FOR_LOCAL_PAGES) {
    return { label: "READY FOR LOCAL GENERATION", warning: null };
  }
  if (selectedCount > 0) {
    return {
      label: "INSUFFICIENT AREAS SELECTED",
      warning: `Select at least ${LOCAL_AREA_MINIMUM_FOR_LOCAL_PAGES} areas for local page generation (${selectedCount} selected).`,
    };
  }
  return {
    label: "NO AREAS SELECTED",
    warning: `Review discovered areas and select at least ${LOCAL_AREA_MINIMUM_FOR_LOCAL_PAGES} for local page generation.`,
  };
}

function preservedSelectionMap(profile: PharmacyProfileData): Map<string, ProfileAreaEntry> {
  return new Map(
    (profile.selectedAreas || []).map((entry) => [entry.areaName.toLowerCase(), entry]),
  );
}

export function discoverOnboardingAreasForProfile(
  slug: string,
  options?: { force?: boolean; townOverride?: string },
): OnboardingAreaDiscoveryState {
  const safe = safeAdminSlug(slug);
  const profile = readSetupProfile(safe);
  const primaryTown = text(options?.townOverride || profile.primaryTown || profile.townCity);
  if (!primaryTown) {
    return {
      slug: safe,
      primaryTown: "",
      discoveryRevision: "",
      discoveredAt: "",
      recommendedCount: 0,
      selectedCount: 0,
      minimumRecommended: LOCAL_AREA_MINIMUM_FOR_LOCAL_PAGES,
      localGenerationReadiness: "TOWN REQUIRED",
      readinessWarning: "Confirm Town or City before discovering local areas.",
      areas: [],
      rejected: [],
    };
  }

  const revision = discoveryInputRevision({
    town: primaryTown,
    postcode: profile.postcode,
    addressLine1: profile.addressLine1,
  });

  const cachedRevision = text(profile.onboardingAreaDiscoveryRevision);
  const hasCachedAreas = (profile.selectedAreas || []).some((a) => text(a.areaName));
  if (!options?.force && cachedRevision === revision && hasCachedAreas) {
    return buildStateFromProfile(safe, profile, primaryTown, revision);
  }

  const preserved = preservedSelectionMap(profile);
  const hasConfirmedSelection = [...preserved.values()].some((a) => a.selected !== false);

  const discovery = discoverPharmacyAreas({
    town: primaryTown,
    limit: 15,
    preserveSelection: profile.selectedAreas || [],
  });

  const rejected: Array<{ name: string; reason: string }> = [];
  const seen = new Set<string>();
  const areas: OnboardingDiscoveredArea[] = [];

  for (const [index, entry] of discovery.areas.entries()) {
    const name = text(entry.areaName);
    if (!name) continue;
    const key = areaSlug(name);
    if (seen.has(key)) {
      rejected.push({ name, reason: "Duplicate slug" });
      continue;
    }

    const distance = distanceMeta(primaryTown, name);
    const filter = evaluateAreaNameForDiscovery(name, primaryTown);
    if (!filter.accept) {
      rejected.push({ name, reason: filter.reason || "Filtered" });
      continue;
    }
    if (distance.km != null && distance.km > MAX_ONBOARDING_DISCOVERY_DISTANCE_KM) {
      rejected.push({ name, reason: "Excessively distant" });
      continue;
    }

    seen.add(key);
    const saved = preserved.get(name.toLowerCase());
    const recommended = index < RECOMMENDED_SELECTED_AREAS;
    const selected = saved ? saved.selected !== false : hasConfirmedSelection ? false : recommended;

    areas.push({
      areaId: key,
      areaName: name,
      slug: key,
      type: mapAreaType(entry),
      parentTown: primaryTown,
      source: entry.source || discovery.source,
      evidence: `Discovered from ${primaryTown} local market data`,
      distanceKm: distance.km,
      distanceLabel: distance.label,
      confidence: entry.confidence ?? 70,
      recommended,
      selected,
      generationEligible: selected,
    });
  }

  for (const [key, saved] of preserved) {
    if (areas.some((a) => a.areaName.toLowerCase() === key)) continue;
    if (saved.source === "manual" || saved.source === "operator") {
      areas.push({
        areaId: areaSlug(saved.areaName),
        areaName: saved.areaName,
        slug: areaSlug(saved.areaName),
        type: "service area",
        parentTown: primaryTown,
        source: saved.source || "operator",
        evidence: "Operator custom area",
        distanceKm: null,
        distanceLabel: "Distance unavailable",
        confidence: saved.confidence ?? 100,
        recommended: false,
        selected: saved.selected !== false,
        generationEligible: saved.selected !== false,
      });
    }
  }

  const selectedCount = areas.filter((a) => a.selected).length;
  const recommendedCount = areas.filter((a) => a.recommended).length;
  const readiness = readinessLabel(selectedCount);
  const discoveredAt = new Date().toISOString();

  const profileEntries: ProfileAreaEntry[] = areas.map((a, idx) => ({
    areaName: a.areaName,
    areaType: a.type,
    priority: idx + 1,
    order: idx + 1,
    selected: a.selected,
    source: a.source,
    confidence: a.confidence,
    tier: a.recommended ? "priority" : "secondary",
  }));

  writeSetupProfile(safe, {
    ...profile,
    primaryTown,
    primaryCity: primaryTown,
    townCity: primaryTown,
    selectedAreas: profileEntries,
    areaDiscoverySource: ONBOARDING_AREA_DISCOVERY_SOURCE,
    areaDiscoveryUpdatedAt: discoveredAt,
    onboardingAreaDiscoveryRevision: revision,
  });

  return {
    slug: safe,
    primaryTown,
    discoveryRevision: revision,
    discoveredAt,
    recommendedCount,
    selectedCount,
    minimumRecommended: LOCAL_AREA_MINIMUM_FOR_LOCAL_PAGES,
    localGenerationReadiness: readiness.label,
    readinessWarning: readiness.warning,
    areas,
    rejected,
  };
}

function buildStateFromProfile(
  slug: string,
  profile: PharmacyProfileData,
  primaryTown: string,
  revision: string,
): OnboardingAreaDiscoveryState {
  const preserved = preservedSelectionMap(profile);
  const areas: OnboardingDiscoveredArea[] = (profile.selectedAreas || []).map((entry, index) => {
    const name = text(entry.areaName);
    const distance = distanceMeta(primaryTown, name);
    const recommended = index < RECOMMENDED_SELECTED_AREAS;
    return {
      areaId: areaSlug(name),
      areaName: name,
      slug: areaSlug(name),
      type: mapAreaType(entry),
      parentTown: primaryTown,
      source: entry.source || ONBOARDING_AREA_DISCOVERY_SOURCE,
      evidence: entry.source === "manual" || entry.source === "operator"
        ? "Operator custom area"
        : `Discovered from ${primaryTown} local market data`,
      distanceKm: distance.km,
      distanceLabel: distance.label,
      confidence: entry.confidence ?? 70,
      recommended,
      selected: entry.selected !== false,
      generationEligible: entry.selected !== false,
    };
  });

  const selectedCount = areas.filter((a) => a.selected).length;
  const readiness = readinessLabel(selectedCount);

  return {
    slug,
    primaryTown,
    discoveryRevision: revision,
    discoveredAt: text(profile.areaDiscoveryUpdatedAt),
    recommendedCount: areas.filter((a) => a.recommended).length,
    selectedCount,
    minimumRecommended: LOCAL_AREA_MINIMUM_FOR_LOCAL_PAGES,
    localGenerationReadiness: readiness.label,
    readinessWarning: readiness.warning,
    areas,
    rejected: [],
  };
}

function buildNationalAreaDiscoveryState(slug: string, profile: PharmacyProfileData): OnboardingAreaDiscoveryState {
  return {
    slug,
    primaryTown: text(profile.primaryTown || profile.townCity),
    discoveryRevision: "national",
    discoveredAt: "",
    recommendedCount: 0,
    selectedCount: 0,
    minimumRecommended: 0,
    localGenerationReadiness: "NOT REQUIRED — NATIONAL MARKET",
    readinessWarning: `Primary market: ${resolvePrimaryMarket(slug, profile)}. Local areas are optional and do not control national campaign strategy.`,
    areas: [],
    rejected: [],
  };
}

export function getOnboardingAreaDiscoveryState(slug: string): OnboardingAreaDiscoveryState {
  const safe = safeAdminSlug(slug);
  const profile = readSetupProfile(safe);
  if (isNationalMarketScope(safe, profile)) {
    return buildNationalAreaDiscoveryState(safe, profile);
  }
  const primaryTown = text(profile.primaryTown || profile.townCity);
  const revision = discoveryInputRevision({
    town: primaryTown,
    postcode: profile.postcode,
    addressLine1: profile.addressLine1,
  });
  if (text(profile.onboardingAreaDiscoveryRevision) === revision && (profile.selectedAreas || []).length) {
    return buildStateFromProfile(safe, profile, primaryTown, revision);
  }
  return discoverOnboardingAreasForProfile(safe);
}

export function refreshOnboardingAreaDiscovery(slug: string): OnboardingAreaDiscoveryState {
  const safe = safeAdminSlug(slug);
  const profile = readSetupProfile(safe);
  if (isNationalMarketScope(safe, profile)) {
    return buildNationalAreaDiscoveryState(safe, profile);
  }
  return discoverOnboardingAreasForProfile(slug, { force: true });
}

export function saveOnboardingAreaSelections(
  slug: string,
  input: {
    primaryTown?: string;
    areas: Array<{ areaName: string; selected: boolean; source?: string }>;
    manualAreas?: string[];
  },
): OnboardingAreaDiscoveryState {
  const safe = safeAdminSlug(slug);
  const current = readSetupProfile(safe);
  if (isNationalMarketScope(safe, current)) {
    return buildNationalAreaDiscoveryState(safe, current);
  }
  saveGenerationSetupLocalAreas(safe, {
    primaryTown: input.primaryTown,
    areas: input.areas.map((a) => ({ areaName: a.areaName, selected: a.selected })),
    manualAreas: input.manualAreas,
  });
  const profile = readSetupProfile(safe);
  const primaryTown = text(input.primaryTown || profile.primaryTown || profile.townCity);
  const revision = discoveryInputRevision({
    town: primaryTown,
    postcode: profile.postcode,
    addressLine1: profile.addressLine1,
  });
  writeSetupProfile(safe, {
    ...readSetupProfile(safe),
    onboardingAreaDiscoveryRevision: revision,
    areaDiscoverySource: ONBOARDING_AREA_DISCOVERY_SOURCE,
  });
  return buildStateFromProfile(safe, readSetupProfile(safe), primaryTown, revision);
}

export function maybeRefreshOnboardingAreaDiscovery(
  slug: string,
  input: { town: string; postcode?: string; addressLine1?: string },
): OnboardingAreaDiscoveryState | null {
  const safe = safeAdminSlug(slug);
  const profile = readSetupProfile(safe);
  if (isNationalMarketScope(safe, profile)) {
    return buildNationalAreaDiscoveryState(safe, profile);
  }
  const revision = discoveryInputRevision({
    town: input.town,
    postcode: text(input.postcode || profile.postcode),
    addressLine1: text(input.addressLine1 || profile.addressLine1),
  });
  if (text(profile.onboardingAreaDiscoveryRevision) === revision && (profile.selectedAreas || []).length) {
    return null;
  }
  return discoverOnboardingAreasForProfile(safe, {
    force: true,
    townOverride: input.town,
  });
}
