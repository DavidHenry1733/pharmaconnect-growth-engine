/**
 * NC-02 — National Competitor Discovery Storage V1
 */

import fs from "node:fs";
import path from "node:path";

import type {
  NationalCompetitorDiscoveryResult,
} from "./nationalCompetitorDiscoveryModel.ts";

const ROOT = path.resolve(
  process.cwd(),
  "data",
  "national-growth-engine",
);

function safeSlug(slug: string): string {
  const safe = String(slug || "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "");

  if (!safe) throw new Error("Invalid national growth platform slug");

  return safe;
}

export function nationalCompetitorDiscoveryPath(slug: string): string {
  return path.join(
    ROOT,
    `${safeSlug(slug)}-competitor-discovery.json`,
  );
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

export function writeNationalCompetitorDiscovery(
  result: NationalCompetitorDiscoveryResult,
): string {
  fs.mkdirSync(ROOT, { recursive: true });

  const file = nationalCompetitorDiscoveryPath(result.slug);

  fs.writeFileSync(
    file,
    JSON.stringify(result, null, 2) + "\n",
    "utf8",
  );

  return file;
}
