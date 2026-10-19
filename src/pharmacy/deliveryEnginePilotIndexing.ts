/**
 * Controlled pilot indexing for the NHS prescription delivery engine.
 * Published delivery HTML is indexable. sitemap-pilot.xml still lists the
 * hub plus five local pages; child pages canonicalise to their own delivery URL.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

export const INDEX_FOLLOW =
  "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

export interface DeliveryPilotLocalPage {
  id: string;
  label: string;
  city: string;
  slug: string;
}

export interface DeliveryPilotCohort {
  version: 1;
  name: string;
  baseUrl: string;
  hub: {
    id: string;
    label: string;
    path: string;
    robots: string;
  };
  indexLocalPages: DeliveryPilotLocalPage[];
  suburbPathPrefix: string;
  indexRobots: string;
  suburbSlugs: string[];
}

export interface DeliveryPilotPage {
  id: string;
  label: string;
  kind: "hub" | "suburb";
  slug: string | null;
  path: string;
  url: string;
  robots: typeof INDEX_FOLLOW;
  inSitemap: boolean;
}

function resolveConfigPath(): string {
  const candidates = [
    process.env.WORKSPACE_ROOT
      ? path.join(process.env.WORKSPACE_ROOT, "config/delivery/pilot-indexing-cohort.json")
      : "",
    path.resolve(MODULE_DIR, "../../config/delivery/pilot-indexing-cohort.json"),
    path.resolve(process.cwd(), "config/delivery/pilot-indexing-cohort.json"),
  ].filter(Boolean);
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  throw new Error("Delivery pilot indexing cohort config not found");
}

export function loadDeliveryPilotCohort(): DeliveryPilotCohort {
  return JSON.parse(fs.readFileSync(resolveConfigPath(), "utf8")) as DeliveryPilotCohort;
}

function joinUrl(baseUrl: string, urlPath: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${urlPath.startsWith("/") ? urlPath : `/${urlPath}`}`;
}

export function suburbPathForSlug(cohort: DeliveryPilotCohort, slug: string): string {
  return `${cohort.suburbPathPrefix}${slug}`;
}

export function indexLocalSlugSet(cohort: DeliveryPilotCohort): Set<string> {
  return new Set(cohort.indexLocalPages.map((page) => page.slug));
}

export function listDeliveryPilotPages(cohort: DeliveryPilotCohort = loadDeliveryPilotCohort()): DeliveryPilotPage[] {
  const indexSlugs = indexLocalSlugSet(cohort);
  const hub: DeliveryPilotPage = {
    id: cohort.hub.id,
    label: cohort.hub.label,
    kind: "hub",
    slug: null,
    path: cohort.hub.path,
    url: joinUrl(cohort.baseUrl, cohort.hub.path),
    robots: INDEX_FOLLOW,
    inSitemap: true,
  };
  const seen = new Set<string>();
  const suburbs: DeliveryPilotPage[] = [];
  const slugs = [...cohort.suburbSlugs, ...cohort.indexLocalPages.map((page) => page.slug)];
  for (const slug of slugs) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    const indexable = indexSlugs.has(slug);
    const local = cohort.indexLocalPages.find((page) => page.slug === slug);
    const urlPath = suburbPathForSlug(cohort, slug);
    suburbs.push({
      id: slug,
      label: local?.label || slug,
      kind: "suburb",
      slug,
      path: urlPath,
      url: joinUrl(cohort.baseUrl, urlPath),
      robots: INDEX_FOLLOW,
      inSitemap: indexable,
    });
  }
  return [hub, ...suburbs];
}

export function listPilotSitemapPages(cohort: DeliveryPilotCohort = loadDeliveryPilotCohort()): DeliveryPilotPage[] {
  const pages = listDeliveryPilotPages(cohort);
  const hub = pages.find((page) => page.kind === "hub");
  if (!hub) throw new Error("Delivery pilot hub page missing");
  const locals = cohort.indexLocalPages.map((local) => {
    const page = pages.find((candidate) => candidate.slug === local.slug);
    if (!page) throw new Error(`Delivery pilot local page missing: ${local.slug}`);
    return page;
  });
  return [hub, ...locals];
}

export function normalizeDeliveryPath(urlPath: string): string {
  const raw = String(urlPath || "").split("?")[0] || "/";
  const normalised = raw.replace(/\/+$/, "") || "/";
  return normalised;
}

export function isDeliveryEnginePath(urlPath: string): boolean {
  const normalised = normalizeDeliveryPath(urlPath);
  return (
    normalised === "/sitemap-pilot.xml" ||
    normalised === "/delivery" ||
    normalised.startsWith("/delivery/")
  );
}

export function isPilotCohortPath(
  urlPath: string,
  cohort: DeliveryPilotCohort = loadDeliveryPilotCohort(),
): boolean {
  const normalised = normalizeDeliveryPath(urlPath);
  const hubPath = cohort.hub.path.replace(/\/+$/, "");
  if (normalised === hubPath) return true;
  const prefix = cohort.suburbPathPrefix;
  if (!normalised.startsWith(prefix)) return false;
  return indexLocalSlugSet(cohort).has(normalised.slice(prefix.length));
}

export function robotsDirectiveForPath(
  _urlPath: string,
  _cohort: DeliveryPilotCohort = loadDeliveryPilotCohort(),
): typeof INDEX_FOLLOW {
  return INDEX_FOLLOW;
}

export function xRobotsTagForDeliveryPath(
  urlPath: string,
  cohort: DeliveryPilotCohort = loadDeliveryPilotCohort(),
): typeof INDEX_FOLLOW | null {
  if (!isDeliveryEnginePath(urlPath)) return null;
  if (normalizeDeliveryPath(urlPath) === "/sitemap-pilot.xml") return INDEX_FOLLOW;
  return robotsDirectiveForPath(urlPath, cohort);
}

const ROBOTS_META_RE = /<meta\b[^>]*\bname=["']robots["'][^>]*>/gi;
const CANONICAL_LINK_RE = /<link\b[^>]*\brel=["']canonical["'][^>]*>/gi;

export function robotsMetaTag(directive: string = INDEX_FOLLOW): string {
  return `<meta name="robots" content="${directive}" />`;
}

export function canonicalLinkTag(url: string): string {
  const href = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<link rel="canonical" href="${href}" />`;
}

export function applyRobotsMeta(html: string, directive: string = INDEX_FOLLOW): string {
  const tag = robotsMetaTag(directive);
  const re = new RegExp(ROBOTS_META_RE.source, "gi");
  if (re.test(html)) {
    re.lastIndex = 0;
    return html.replace(re, tag);
  }
  if (/<meta\s+name=["']viewport["'][^>]*>/i.test(html)) {
    return html.replace(/(<meta\s+name=["']viewport["'][^>]*>)/i, `$1\n${tag}`);
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/(<head[^>]*>)/i, `$1\n${tag}`);
  }
  return `${tag}\n${html}`;
}

export function applyCanonicalLink(html: string, url: string): string {
  const tag = canonicalLinkTag(url);
  const re = new RegExp(CANONICAL_LINK_RE.source, "gi");
  if (re.test(html)) {
    re.lastIndex = 0;
    return html.replace(re, tag);
  }
  const robots = /<meta\b[^>]*\bname=["']robots["'][^>]*>/i;
  if (robots.test(html)) {
    return html.replace(robots, (match) => `${match}\n${tag}`);
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/(<head[^>]*>)/i, `$1\n${tag}`);
  }
  return `${tag}\n${html}`;
}

/** Indexable robots meta plus a self-referential canonical for the published URL. */
export function prepareDeliveryPageHtml(html: string, canonicalUrl: string): string {
  return applyCanonicalLink(applyRobotsMeta(html, INDEX_FOLLOW), canonicalUrl);
}

export function extractRobotsMeta(html: string): string | null {
  const match = html.match(/<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["']([^"']*)["']/i)
    ?? html.match(/<meta\b[^>]*\bcontent=["']([^"']*)["'][^>]*\bname=["']robots["']/i);
  return match?.[1] ?? null;
}

export function extractCanonical(html: string): string | null {
  const match = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["']/i)
    ?? html.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']canonical["']/i);
  return match?.[1]?.replace(/&amp;/g, "&") ?? null;
}

/**
 * Canonical for a generated delivery file. Spoke folders such as `whiston/`
 * publish at `free-nhs-prescription-delivery-whiston`, not the parent folder.
 */
export function deliveryCanonicalForHtmlFile(filePath: string, baseUrl: string): string | null {
  const normalized = filePath.replace(/\\/g, "/");
  let rel = "";
  for (const marker of ["/output/delivery-engine/", "/public/"]) {
    const idx = normalized.indexOf(marker);
    if (idx >= 0) {
      rel = normalized.slice(idx + marker.length);
      break;
    }
  }
  if (!rel) {
    const deliveryIdx = normalized.lastIndexOf("delivery/");
    if (deliveryIdx >= 0) rel = normalized.slice(deliveryIdx);
  }
  if (!rel.endsWith(".html")) return null;
  let route = rel.replace(/\/index\.html$/, "").replace(/\.html$/, "");
  const hub = "delivery/reliable-direct-pharmacy-sheffield";
  if (route === hub || route.startsWith(`${hub}/`)) {
    const rest = route.slice(hub.length).replace(/^\//, "");
    if (rest && !rest.startsWith("free-nhs-prescription-delivery-") && !rest.includes("/")) {
      route = `${hub}/free-nhs-prescription-delivery-${rest}`;
    }
  }
  return `${baseUrl.replace(/\/+$/, "")}/${route}`;
}

export function buildPilotSitemapXml(
  pages: DeliveryPilotPage[] = listPilotSitemapPages(),
  lastmod = new Date().toISOString().slice(0, 10),
): string {
  const body = pages
    .map(
      (page) =>
        `  <url>\n    <loc>${page.url.replace(/&/g, "&amp;")}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function parseSitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!.trim());
}

export function localHtmlRelativePath(page: DeliveryPilotPage): string {
  const trimmed = page.path.replace(/^\/+/, "");
  return `${trimmed}/index.html`;
}

export function minimalIndexableHtml(page: DeliveryPilotPage): string {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${robotsMetaTag(INDEX_FOLLOW)}
<title>${page.label}</title>
${canonicalLinkTag(page.url)}
</head>
<body>
<main>
<h1>${page.label}</h1>
</main>
</body>
</html>
`;
}
