/**
 * Controlled pilot indexing for the NHS prescription delivery engine.
 * Hub + 5 local pages are indexable; every other suburb page is noindex, follow.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

export const INDEX_FOLLOW = "index, follow";
export const NOINDEX_FOLLOW = "noindex, follow";

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
  noindexRobots: string;
  suburbSlugs: string[];
}

export interface DeliveryPilotPage {
  id: string;
  label: string;
  kind: "hub" | "suburb";
  slug: string | null;
  path: string;
  url: string;
  robots: typeof INDEX_FOLLOW | typeof NOINDEX_FOLLOW;
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
      robots: indexable ? INDEX_FOLLOW : NOINDEX_FOLLOW,
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

export function robotsDirectiveForPath(
  urlPath: string,
  cohort: DeliveryPilotCohort = loadDeliveryPilotCohort(),
): typeof INDEX_FOLLOW | typeof NOINDEX_FOLLOW {
  const normalised = String(urlPath || "").replace(/\/+$/, "") || "/";
  const hubPath = cohort.hub.path.replace(/\/+$/, "");
  if (normalised === hubPath) return INDEX_FOLLOW;
  const prefix = cohort.suburbPathPrefix;
  if (normalised.startsWith(prefix)) {
    const slug = normalised.slice(prefix.length);
    return indexLocalSlugSet(cohort).has(slug) ? INDEX_FOLLOW : NOINDEX_FOLLOW;
  }
  return NOINDEX_FOLLOW;
}

const ROBOTS_META_RE = /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/i;

export function robotsMetaTag(directive: string): string {
  return `<meta name="robots" content="${directive}" />`;
}

export function applyRobotsMeta(html: string, directive: string): string {
  const tag = robotsMetaTag(directive);
  if (ROBOTS_META_RE.test(html)) {
    return html.replace(ROBOTS_META_RE, tag);
  }
  if (/<meta\s+name=["']viewport["'][^>]*>/i.test(html)) {
    return html.replace(/(<meta\s+name=["']viewport["'][^>]*>)/i, `$1\n${tag}`);
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/(<head[^>]*>)/i, `$1\n${tag}`);
  }
  return `${tag}\n${html}`;
}

export function extractRobotsMeta(html: string): string | null {
  const match = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i);
  return match?.[1] ?? null;
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
${robotsMetaTag(page.robots)}
<title>${page.label}</title>
<link rel="canonical" href="${page.url}" />
</head>
<body>
<main>
<h1>${page.label}</h1>
</main>
</body>
</html>
`;
}
