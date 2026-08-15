import fs from "node:fs";
import path from "node:path";
import {
  scoreAndBucketEntities,
  type LocalEntityInput,
  type ScoredLocalEntity,
} from "./localRelevanceScoring.ts";

const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";

function readJson(file: string, fallback: any = null) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file: string, data: any) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function slugify(v: string) {
  return String(v || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function unique(items: string[]) {
  return Array.from(new Set(items.map((x) => String(x || "").trim()).filter(Boolean)));
}

function selectedAreasFromBlueprint(blueprint: any) {
  return unique((blueprint?.areaOpportunities || []).map((a: any) => a.area)).slice(0, 12);
}

async function googlePlacesSearch(query: string, maxResultCount = 6): Promise<LocalEntityInput[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return [];

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.types,places.location",
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google Places failed ${res.status}: ${txt.slice(0, 500)}`);
  }

  const data: any = await res.json();
  return (data.places || [])
    .map((p: any) => ({
      name: p.displayName?.text || "",
      address: p.formattedAddress || "",
      types: p.types || [],
      location: p.location || null,
    }))
    .filter((p: LocalEntityInput) => p.name && !/pharmacy|chemist|boots|rowlands|asda/i.test(p.name));
}

function scoringContext(area: string, ctx: any) {
  const localIntel = ctx.localIntel || {};
  return {
    area,
    areaSlug: slugify(area),
    town: ctx.town || localIntel.town || ctx.primaryLocation || "the local area",
    postcode: ctx.postcode || localIntel.postcode,
    pharmacyLat: localIntel.latitude,
    pharmacyLng: localIntel.longitude,
  };
}

function stringsToEntities(names: string[]): LocalEntityInput[] {
  return names.map((name) => ({ name, types: [], address: "", location: null }));
}

function applyScoring(rawEntities: LocalEntityInput[], area: string, ctx: any) {
  return scoreAndBucketEntities(rawEntities, scoringContext(area, ctx));
}

async function buildGooglePack(slug: string, area: string, ctx: any) {
  const areaSlug = slugify(area);
  const town = ctx.town || ctx.localIntel?.town || ctx.primaryLocation || "the local area";

  const [healthcareRaw, schoolsRaw, communityRaw, landmarksRaw, retailRaw, transportRaw] =
    await Promise.all([
      googlePlacesSearch(`GP surgeries medical centres walk-in centres NHS near ${area} ${town}`, 8),
      googlePlacesSearch(`schools primary secondary near ${area} ${town}`, 6),
      googlePlacesSearch(`libraries community centres leisure centres sports centres near ${area} ${town}`, 8),
      googlePlacesSearch(`parks retail centres high street landmarks near ${area} ${town}`, 8),
      googlePlacesSearch(`retail parks shopping centres major stores near ${area} ${town}`, 6),
      googlePlacesSearch(`train station bus station transport near ${area} ${town}`, 5),
    ]);

  const allRaw = [
    ...healthcareRaw,
    ...schoolsRaw,
    ...communityRaw,
    ...landmarksRaw,
    ...retailRaw,
    ...transportRaw,
  ];

  const scored = applyScoring(allRaw, area, ctx);

  const pack = {
    version: "v2",
    slug,
    area,
    areaSlug,
    provider: "googlePlaces",
    generatedAt: new Date().toISOString(),
    sourceStatus: "google-places-live",
    town,
    ...scored,
    excluded: {
      pharmacies: true,
      reason: "Competitor pharmacy names are intentionally excluded from local relevance packs.",
    },
    contentAngles: [
      `${area} patients looking for convenient pharmacy service access near ${town}`,
      `families and working adults in ${area} needing practical healthcare advice`,
      `local residents around ${area} using nearby healthcare, community and landmark references`,
    ],
    rewriteGuidance: {
      intro: `Open with ${area} patient intent and service need, not a generic location swap.`,
      whyThisArea: `Use 1-2 genuinely relevant local signals from topHealthcare, topCommunity or topLandmarks.`,
      localRelevance: `Use one healthcare, one community and one landmark signal — never list everything.`,
      avoid: [
        "Do not list competitors.",
        "Do not keyword-stuff place names.",
        "Do not mention every nearby place.",
        "Do not repeat the same area sentence across all sections.",
      ],
    },
    qualitySignals: {
      healthcareCount: scored.healthcare.length,
      communityCount: scored.community.length,
      landmarkCount: scored.landmarks.length,
      retailCount: scored.retail.length,
      transportCount: scored.transport.length,
      schoolCount: scored.schools.length,
      topHealthcareCount: scored.topHealthcare.length,
      topCommunityCount: scored.topCommunity.length,
      topLandmarkCount: scored.topLandmarks.length,
      hasGooglePlaces: true,
      competitorPharmaciesExcluded: true,
      scoringVersion: "v2",
    },
  };

  return pack;
}

function buildFallbackPack(slug: string, area: string, ctx: any) {
  const areaSlug = slugify(area);
  const local = ctx.localIntel || {};
  const town = ctx.town || local.town || ctx.primaryLocation || "the local area";

  const rawEntities: LocalEntityInput[] = [
    ...stringsToEntities(local.localGps || []),
    ...stringsToEntities(local.localHospitals || []),
    ...stringsToEntities(local.localHealthcareLocations || []),
    ...stringsToEntities(local.localSchools || []),
    ...stringsToEntities(local.localCommunityLocations || []),
    ...stringsToEntities(local.localLandmarks || []),
    ...stringsToEntities(local.localRetailCentres || []),
  ];

  const scored = applyScoring(rawEntities, area, ctx);

  return {
    version: "v2",
    slug,
    area,
    areaSlug,
    provider: process.env.GOOGLE_PLACES_API_KEY ? "googlePlaces-ready" : "fallback-local-intelligence",
    generatedAt: new Date().toISOString(),
    sourceStatus: process.env.GOOGLE_PLACES_API_KEY
      ? "google-key-present-not-yet-called"
      : "no-google-key-fallback-used",
    town,
    ...scored,
    excluded: {
      pharmacies: true,
      reason: "Competitor pharmacy names are intentionally excluded from local relevance packs.",
    },
    contentAngles: [
      `${area} patients looking for convenient pharmacy service access near ${town}`,
      `families and working adults in ${area} needing practical healthcare advice`,
      `local residents around ${area} comparing pharmacy service availability`,
    ],
    rewriteGuidance: {
      intro: `Open with ${area} patient intent and service need, not a generic location swap.`,
      whyThisArea: `Explain why patients from ${area} may find the pharmacy service convenient, using scored local signals.`,
      localRelevance: `Use one healthcare, one community and one landmark signal naturally.`,
      avoid: [
        "Do not list competitors.",
        "Do not keyword-stuff place names.",
        "Do not mention every nearby place.",
        "Do not repeat the same area sentence across all sections.",
      ],
    },
    qualitySignals: {
      healthcareCount: scored.healthcare.length,
      communityCount: scored.community.length,
      landmarkCount: scored.landmarks.length,
      retailCount: scored.retail.length,
      transportCount: scored.transport.length,
      schoolCount: scored.schools.length,
      topHealthcareCount: scored.topHealthcare.length,
      topCommunityCount: scored.topCommunity.length,
      topLandmarkCount: scored.topLandmarks.length,
      hasGooglePlaces: !!process.env.GOOGLE_PLACES_API_KEY,
      competitorPharmaciesExcluded: true,
      scoringVersion: "v2",
    },
  };
}

export async function generatePharmacyLocalRelevancePacks(slug: string) {
  const profile = readJson(path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`), {});
  const blueprint = readJson(path.join(ROOT, "data/pharmacy-content-blueprints", `${slug}.json`));
  const localIntel = readJson(path.join(ROOT, "data/pharmacy-local-intelligence", `${slug}.json`), {});

  if (!blueprint) throw new Error(`Content Blueprint not found for ${slug}`);

  const profileData = profile.data || profile || {};
  const town = profileData.townCity || blueprint.primaryLocation || localIntel.town || "the local area";
  const areas = selectedAreasFromBlueprint(blueprint);

  const outDir = path.join(ROOT, "data/pharmacy-local-relevance-packs", slug);
  fs.mkdirSync(outDir, { recursive: true });

  const packs = [];
  for (const area of areas) {
    const ctx = {
      localIntel,
      town,
      primaryLocation: blueprint.primaryLocation,
      postcode: profileData.postcode || localIntel.postcode,
    };
    const pack = process.env.GOOGLE_PLACES_API_KEY
      ? await buildGooglePack(slug, area, ctx)
      : buildFallbackPack(slug, area, ctx);

    writeJson(path.join(outDir, `${pack.areaSlug}.json`), pack);

    packs.push({
      area: pack.area,
      areaSlug: pack.areaSlug,
      provider: pack.provider,
      version: pack.version,
      healthcareCount: pack.qualitySignals.healthcareCount,
      communityCount: pack.qualitySignals.communityCount,
      landmarkCount: pack.qualitySignals.landmarkCount,
      transportCount: pack.qualitySignals.transportCount,
      topHealthcare: (pack.topHealthcare as ScoredLocalEntity[]).map((e) => e.name),
      topCommunity: (pack.topCommunity as ScoredLocalEntity[]).map((e) => e.name),
      topLandmarks: (pack.topLandmarks as ScoredLocalEntity[]).map((e) => e.name),
      competitorPharmaciesExcluded: true,
    });
  }

  const index = {
    slug,
    version: "v2",
    generatedAt: new Date().toISOString(),
    pageCount: packs.length,
    maxAreas: 12,
    provider: process.env.GOOGLE_PLACES_API_KEY ? "googlePlaces" : "fallback-local-intelligence",
    googlePlacesConfigured: !!process.env.GOOGLE_PLACES_API_KEY,
    packs,
  };

  writeJson(path.join(outDir, "_index.json"), index);
  return index;
}

export function loadPharmacyLocalRelevancePack(slug: string, area: string) {
  const areaSlug = slugify(area);
  return readJson(path.join(ROOT, "data/pharmacy-local-relevance-packs", slug, `${areaSlug}.json`));
}
