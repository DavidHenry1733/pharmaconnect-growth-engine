#!/usr/bin/env npx tsx
/**
 * Apply the controlled delivery-engine pilot indexing cohort:
 * hub + 5 local pages index,follow; remaining suburb pages noindex,follow;
 * sitemap-pilot.xml contains strictly those 6 URLs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRobotsMeta,
  buildPilotSitemapXml,
  listDeliveryPilotPages,
  listPilotSitemapPages,
  loadDeliveryPilotCohort,
  localHtmlRelativePath,
  minimalIndexableHtml,
  NOINDEX_FOLLOW,
  type DeliveryPilotPage,
} from "../src/pharmacy/deliveryEnginePilotIndexing.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

const OUTPUT_ROOT = path.join(ROOT, "output/delivery-engine");
const TRACKED_SITEMAP = path.join(ROOT, "delivery/sitemap-pilot.xml");

function writeFile(filePath: string, contents: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
}

async function fetchLiveHtml(page: DeliveryPilotPage): Promise<string | null> {
  const candidates = page.kind === "hub" ? [page.url, `${page.url}/`] : [page.url, `${page.url}/`];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) continue;
      const html = await res.text();
      if (!/<html/i.test(html)) continue;
      return html;
    } catch {
      continue;
    }
  }
  return null;
}

async function main(): Promise<void> {
  const cohort = loadDeliveryPilotCohort();
  const pages = listDeliveryPilotPages(cohort);
  const sitemapPages = listPilotSitemapPages(cohort);
  if (sitemapPages.length !== 6) {
    throw new Error(`Pilot sitemap must contain 6 URLs, found ${sitemapPages.length}`);
  }

  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  const results: Array<{ url: string; robots: string; source: "live" | "stub"; path: string }> = [];

  for (const page of pages) {
    const live = await fetchLiveHtml(page);
    const source = live ? "live" : "stub";
    if (!live && page.robots === NOINDEX_FOLLOW) {
      throw new Error(`Missing live HTML for noindex suburb ${page.url}`);
    }
    const html = applyRobotsMeta(live ?? minimalIndexableHtml(page), page.robots);
    const rel = localHtmlRelativePath(page);
    const outPath = path.join(OUTPUT_ROOT, rel);
    writeFile(outPath, html);
    results.push({ url: page.url, robots: page.robots, source, path: rel });
  }

  const sitemapXml = buildPilotSitemapXml(sitemapPages);
  writeFile(path.join(OUTPUT_ROOT, "sitemap-pilot.xml"), sitemapXml);
  writeFile(path.join(OUTPUT_ROOT, "sitemap.xml"), sitemapXml);
  writeFile(TRACKED_SITEMAP, sitemapXml);

  const report = {
    generatedAt: new Date().toISOString(),
    hubIndexFollow: 1,
    localIndexFollow: sitemapPages.filter((page) => page.kind === "suburb").length,
    suburbNoindexFollow: pages.filter((page) => page.kind === "suburb" && page.robots === NOINDEX_FOLLOW).length,
    sitemapUrls: sitemapPages.map((page) => page.url),
    pages: results,
  };
  writeFile(path.join(OUTPUT_ROOT, "pilot-indexing-report.json"), JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));
  console.log(`Wrote ${TRACKED_SITEMAP}`);
  console.log(`Wrote ${pages.length} HTML pages under ${OUTPUT_ROOT}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
