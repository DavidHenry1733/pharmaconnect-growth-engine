/**
 * NC-02 — National Competitor Discovery Storage V1
 *
 * REAL_DISCOVERY and FIXTURE_VALIDATION are persisted separately.
 * Fixture candidates must never be written to the real discovery file.
 */

import fs from "node:fs";
import path from "node:path";

import type {
  NationalCompetitorDiscoveryResult,
} from "./nationalCompetitorDiscoveryModel.ts";
import {
  ensureNationalIntelligenceDataDir,
  nationalIntelligenceDataDir,
  nationalIntelligenceDataPath,
} from "./nationalIntelligenceStorageService.ts";
import { safePharmacySlug } from "./pharmacyWorkspacePaths.ts";

export const COMMERCIAL_DISCOVERY_FIXTURE_VALIDATION_DOMAINS = [
  "pharmacy-digital-agency.co.uk",
  "retail-pharmacy-chain.co.uk",
  "pharmacy-trade-press.co.uk",
  "royal-college.example",
  "scientific-articles.example",
  "pharmacy-pmr-software.co.uk",
  "high-authority-overlap.example",
  "broad-vocab.example",
] as const;

const FIXTURE_DOMAIN_SET = new Set(
  COMMERCIAL_DISCOVERY_FIXTURE_VALIDATION_DOMAINS.map((domain) => domain.toLowerCase()),
);

export function nationalCompetitorDiscoveryPath(slug: string): string {
  return nationalIntelligenceDataPath(slug, "competitor-discovery");
}

export function nationalCompetitorDiscoveryFixturePath(slug: string): string {
  return path.join(
    nationalIntelligenceDataDir(),
    `${safePharmacySlug(slug)}-competitor-discovery.fixture.json`,
  );
}

export function isExampleTldDomain(domain: string): boolean {
  const host = String(domain || "").trim().toLowerCase().replace(/^www\./, "");
  return host === "example" || host.endsWith(".example");
}

export function isCommercialDiscoveryFixtureValidationDomain(domain: string): boolean {
  const host = String(domain || "").trim().toLowerCase().replace(/^www\./, "");
  return FIXTURE_DOMAIN_SET.has(host) || isExampleTldDomain(host);
}

export function readNationalCompetitorDiscovery(
  slug: string,
): NationalCompetitorDiscoveryResult | null {
  const file = nationalCompetitorDiscoveryPath(slug);

  if (!fs.existsSync(file)) return null;

  return JSON.parse(
    fs.readFileSync(file, "utf8"),
  ) as NationalCompetitorDiscoveryResult;
}

export function readFixtureCommercialCompetitorDiscovery(
  slug: string,
): NationalCompetitorDiscoveryResult | null {
  const file = nationalCompetitorDiscoveryFixturePath(slug);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as NationalCompetitorDiscoveryResult;
}

function writeJson(file: string, result: NationalCompetitorDiscoveryResult): string {
  ensureNationalIntelligenceDataDir();
  fs.writeFileSync(file, JSON.stringify(result, null, 2) + "\n", "utf8");
  return file;
}

export function writeFixtureCommercialCompetitorDiscovery(
  result: NationalCompetitorDiscoveryResult,
): string {
  const copy: NationalCompetitorDiscoveryResult = {
    ...result,
    evidenceKind: "FIXTURE_VALIDATION",
  };
  return writeJson(nationalCompetitorDiscoveryFixturePath(copy.slug), copy);
}

export function writeRealCommercialCompetitorDiscovery(
  result: NationalCompetitorDiscoveryResult,
): string {
  if (result.evidenceKind !== "REAL_DISCOVERY") {
    throw new Error("FIXTURE_VALIDATION cannot persist as REAL_DISCOVERY");
  }
  const exampleDomains = (result.candidates || []).filter((row) => isExampleTldDomain(row.domain));
  if (exampleDomains.length) {
    throw new Error("REAL_DISCOVERY cannot persist .example fixture domains");
  }
  if ((result.discoveryProvider || "").toLowerCase() === "fixture") {
    throw new Error("Fixture provider results cannot persist as REAL_DISCOVERY");
  }
  return writeJson(nationalCompetitorDiscoveryPath(result.slug), result);
}

export function writeNationalCompetitorDiscovery(
  result: NationalCompetitorDiscoveryResult,
): string {
  if (result.evidenceKind === "FIXTURE_VALIDATION") {
    return writeFixtureCommercialCompetitorDiscovery(result);
  }
  if (result.evidenceKind === "REAL_DISCOVERY") {
    return writeRealCommercialCompetitorDiscovery(result);
  }
  const existing = readNationalCompetitorDiscovery(result.slug);
  if (existing?.evidenceKind === "REAL_DISCOVERY") {
    return nationalCompetitorDiscoveryPath(result.slug);
  }
  ensureNationalIntelligenceDataDir();
  const file = nationalCompetitorDiscoveryPath(result.slug);
  fs.writeFileSync(file, JSON.stringify(result, null, 2) + "\n", "utf8");
  return file;
}
