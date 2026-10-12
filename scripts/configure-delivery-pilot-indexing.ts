#!/usr/bin/env npx tsx
/**
 * Apply the controlled delivery-engine pilot indexing cohort:
 * hub + 5 local pages index,follow; remaining suburb pages noindex,follow;
 * sitemap-pilot.xml contains strictly those 6 URLs. Generates Whiston from the
 * Kimberworth territory template when the live page is missing.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRobotsMeta,
  listDeliveryPilotPages,
  listPilotSitemapPages,
  loadDeliveryPilotCohort,
  localHtmlRelativePath,
  NOINDEX_FOLLOW,
  type DeliveryPilotPage,
} from "../src/pharmacy/deliveryEnginePilotIndexing.ts";
import {
  deliveryOutputRoot,
  ensureWhistonOnHub,
  generateWhistonHtmlFromKimberworth,
  materializeDeliveryPageFiles,
  rootDeliveryHtaccess,
  writePilotSitemaps,
  writeUtf8,
} from "../src/pharmacy/deliveryEnginePublicService.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

async function fetchLiveHtml(page: DeliveryPilotPage): Promise<string | null> {
  const candidates = [page.url, `${page.url}/`];
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

  const fetched = new Map<string, string>();
  for (const page of pages) {
    const live = await fetchLiveHtml(page);
    if (live) fetched.set(page.id, live);
  }

  const kimberworth = pages.find((page) => page.slug === "kimberworth");
  const kimberworthHtml = kimberworth ? fetched.get(kimberworth.id) : null;
  if (!kimberworthHtml) {
    throw new Error("Kimberworth live HTML is required to generate the Whiston territory page");
  }

  const results: Array<{ url: string; robots: string; source: "live" | "generated"; path: string }> = [];

  for (const page of pages) {
    let html = fetched.get(page.id) || null;
    let source: "live" | "generated" = html ? "live" : "generated";
    if (page.slug === "whiston") {
      html = generateWhistonHtmlFromKimberworth(kimberworthHtml);
      source = "generated";
    } else if (page.kind === "hub" && html) {
      html = ensureWhistonOnHub(html);
    } else if (!html && page.robots === NOINDEX_FOLLOW) {
      throw new Error(`Missing live HTML for noindex suburb ${page.url}`);
    }
    if (!html) {
      throw new Error(`Missing HTML for ${page.url}`);
    }
    html = applyRobotsMeta(html, page.robots);
    materializeDeliveryPageFiles(page, html);
    results.push({ url: page.url, robots: page.robots, source, path: localHtmlRelativePath(page) });
  }

  const sitemapXml = writePilotSitemaps();
  writeUtf8(path.join(deliveryOutputRoot(), "sitemap.xml"), sitemapXml);

  const indexableSlugs = cohort.indexLocalPages.map((page) => page.slug);
  const parentHtaccess = rootDeliveryHtaccess(indexableSlugs);
  writeUtf8(
    path.join(deliveryOutputRoot(), "delivery/reliable-direct-pharmacy-sheffield/.htaccess"),
    parentHtaccess,
  );
  writeUtf8(
    path.join(ROOT, "public/delivery/reliable-direct-pharmacy-sheffield/.htaccess"),
    parentHtaccess,
  );

  const report = {
    generatedAt: new Date().toISOString(),
    hubIndexFollow: 1,
    localIndexFollow: sitemapPages.filter((page) => page.kind === "suburb").length,
    suburbNoindexFollow: pages.filter((page) => page.kind === "suburb" && page.robots === NOINDEX_FOLLOW).length,
    sitemapUrls: sitemapPages.map((page) => page.url),
    pages: results,
  };
  writeUtf8(path.join(deliveryOutputRoot(), "pilot-indexing-report.json"), JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));
  console.log("Wrote delivery/sitemap-pilot.xml and public/sitemap-pilot.xml");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
