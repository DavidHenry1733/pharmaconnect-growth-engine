import * as growthPlatformResolverService from "../src/pharmacy/growthPlatformResolverService.ts";

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const { resolveGrowthPlatform, isNationalGrowthPlatform, isLocalGrowthPlatform } = exported(growthPlatformResolverService);

let passed = 0;
let failed = 0;

function check(id: string, ok: boolean, detail: string) {
  if (ok) {
    passed++;
    console.log(`PASS  ${id} — ${detail}`);
  } else {
    failed++;
    console.log(`FAIL  ${id} — ${detail}`);
  }
}

console.log("\n=== GROWTH PLATFORM RUNTIME ROUTER V1 ===\n");

const pc = resolveGrowthPlatform("pharmaconnect");

check(
  "pharmaconnect-national",
  pc.platform === "national",
  pc.platform,
);

check(
  "pharmaconnect-explicit-source",
  pc.source === "project-config-explicit",
  pc.source,
);

check(
  "pharmaconnect-national-helper",
  isNationalGrowthPlatform("pharmaconnect") === true,
  String(isNationalGrowthPlatform("pharmaconnect")),
);

check(
  "pharmaconnect-not-local",
  isLocalGrowthPlatform("pharmaconnect") === false,
  String(isLocalGrowthPlatform("pharmaconnect")),
);

check(
  "pharmaconnect-local-engine-disabled",
  pc.contract.localEngineApplicable === false,
  String(pc.contract.localEngineApplicable),
);

check(
  "pharmaconnect-google-places-disabled",
  pc.contract.googlePlacesCompetitorDiscoveryApplicable === false,
  String(pc.contract.googlePlacesCompetitorDiscoveryApplicable),
);

check(
  "pharmaconnect-local-market-disabled",
  pc.contract.localMarketIntelligenceApplicable === false,
  String(pc.contract.localMarketIntelligenceApplicable),
);

check(
  "pharmaconnect-healthcare-disabled",
  pc.contract.healthcareIntelligenceApplicable === false,
  String(pc.contract.healthcareIntelligenceApplicable),
);

check(
  "pharmaconnect-national-competitor-enabled",
  pc.contract.nationalCompetitorDiscoveryApplicable === true,
  String(pc.contract.nationalCompetitorDiscoveryApplicable),
);

/*
 * Backwards-compatibility fixture:
 * an unknown tenant with no explicit project setting remains LOCAL.
 * This protects all established local tenants from migration-by-default.
 */
const legacy = resolveGrowthPlatform("__validation_legacy_local__");

check(
  "legacy-default-local",
  legacy.platform === "local",
  legacy.platform,
);

check(
  "legacy-local-engine",
  legacy.contract.localEngineApplicable === true,
  String(legacy.contract.localEngineApplicable),
);

check(
  "legacy-national-disabled",
  legacy.contract.nationalEngineApplicable === false,
  String(legacy.contract.nationalEngineApplicable),
);

console.log(`\n${failed ? "FAIL" : "PASS"} — ${passed}/${passed + failed} checks\n`);

if (failed) process.exit(1);
