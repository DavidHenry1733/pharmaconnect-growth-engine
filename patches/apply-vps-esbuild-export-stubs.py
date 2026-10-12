#!/usr/bin/env python3
"""Append the missing src/pharmacy exports so VPS esbuild can bundle api-server."""
from pathlib import Path
import sys

ROOT = Path.cwd()


def ensure(rel: str, marker: str, block: str) -> None:
    path = ROOT / rel
    if not path.exists():
        raise SystemExit(f"missing {rel}")
    text = path.read_text()
    if marker in text:
        print(f"skip {rel} (already exports {marker})")
        return
    path.write_text(text.rstrip() + "\n\n" + block.strip() + "\n")
    print(f"patched {rel}")


ensure(
    "src/pharmacy/contentEngine/pharmacyAiLocalPageCandidatePaths.ts",
    "AI_LOCAL_FULL_PAGE_UNIQUENESS_VERSION",
    'export const AI_LOCAL_FULL_PAGE_UNIQUENESS_VERSION = "full-page-uniqueness-v1";',
)

ensure(
    "src/pharmacy/pharmacyWorkspacePaths.ts",
    "getPharmacyLocalityHeroEvidencePath",
    """
export function getPharmacyLocalityHeroEvidencePath(slug: string, areaSlug?: string): string {
  const s = safePharmacySlug(slug);
  const area = String(areaSlug || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return area
    ? path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-locality-hero-evidence", s, `${area}.json`)
    : path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-locality-hero-evidence", `${s}.json`);
}

export function getPharmacyOpportunityCachePath(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-opportunity-cache", `${safePharmacySlug(slug)}.json`);
}

export function getPharmacyCompetitorCachePath(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-competitor-cache", `${safePharmacySlug(slug)}.json`);
}
""",
)

ensure(
    "src/pharmacy/pharmacyClusterPageUrlResolver.ts",
    "export function sitemapLocalitySlug",
    """
export function sitemapLocalitySlug(name: string, fallbackSlug = ""): string {
  return resolveClusterPageSlug(name) || resolveClusterPageSlug(fallbackSlug);
}
""",
)

ensure(
    "src/pharmacy/pharmacyAcceptedPageRouteResolverV1.ts",
    "isPublicBrookSalesDemoHubVisualExperienceGet",
    """
export function isPublicBrookSalesDemoHubVisualExperienceGet(input: {
  method: string;
  path?: string;
  originalUrl?: string;
  url?: string;
  query?: Record<string, unknown>;
}): boolean {
  const method = String(input.method || "").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;
  const blob = [input.originalUrl, input.path, input.url, JSON.stringify(input.query || {})]
    .join("\\n")
    .toLowerCase();
  return (
    blob.includes("/pharmacy-visual-experience/pharmacy-first") ||
    blob.includes("pharmacy-visual-experience/pharmacy-first")
  );
}
""",
)

ensure(
    "src/pharmacy/dashboardCustomerStore.ts",
    "upsertPharmacyCustomer",
    """
export function persistCustomerOpportunityData(slug: string, data: unknown): void {
  const key = str(slug).toLowerCase();
  if (!key) return;
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-opportunity-cache", `${key}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function persistCustomerCompetitorData(slug: string, data: unknown): void {
  const key = str(slug).toLowerCase();
  if (!key) return;
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-competitor-cache", `${key}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function upsertPharmacyCustomer(customer: PharmacyCustomerRecord): PharmacyCustomerRecord {
  const slug = str(customer.slug).toLowerCase();
  if (!slug || isRejectedSandboxSlug(slug)) {
    throw new Error("Refusing to upsert a rejected or empty pharmacy customer slug");
  }
  const filePath = customerFileCandidates().find((candidate) => fs.existsSync(candidate)) || customerFileCandidates()[0];
  let parsed: { pharmacies?: unknown[]; [key: string]: unknown } = { version: 1, pharmacies: [] };
  if (fs.existsSync(filePath)) {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as { pharmacies?: unknown[] };
  }
  const pharmacies = Array.isArray(parsed.pharmacies) ? [...parsed.pharmacies] : [];
  const idx = pharmacies.findIndex((row) => str((row as { slug?: unknown } | null)?.slug).toLowerCase() === slug);
  const record = { ...customer, slug };
  if (idx >= 0) pharmacies[idx] = { ...(pharmacies[idx] as object), ...record };
  else pharmacies.push(record);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ ...parsed, pharmacies }, null, 2));
  catalogCache = null;
  return findPharmacyCustomer(slug) || record;
}
""",
)

print("done", file=sys.stderr)
