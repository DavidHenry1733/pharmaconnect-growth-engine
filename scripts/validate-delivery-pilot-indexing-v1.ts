#!/usr/bin/env npx tsx
/**
 * Delivery engine indexing — indexable robots, self-canonicals, 6-URL sitemap.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRobotsMeta,
  buildPilotSitemapXml,
  deliveryCanonicalForHtmlFile,
  extractCanonical,
  extractRobotsMeta,
  INDEX_FOLLOW,
  isPilotCohortPath,
  listDeliveryPilotPages,
  listPilotSitemapPages,
  loadDeliveryPilotCohort,
  parseSitemapLocs,
  prepareDeliveryPageHtml,
  robotsDirectiveForPath,
  xRobotsTagForDeliveryPath,
} from "../src/pharmacy/deliveryEnginePilotIndexing.ts";
import {
  ensureWhistonOnHub,
  generateWhistonHtmlFromKimberworth,
  WHISTON_DELIVERY_URL,
} from "../src/pharmacy/deliveryEnginePublicService.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function main() {
  console.log("\n=== Delivery Engine Pilot Indexing Cohort V1 ===\n");
  const cohort = loadDeliveryPilotCohort();
  const pages = listDeliveryPilotPages(cohort);
  const sitemapPages = listPilotSitemapPages(cohort);
  const indexLocals = pages.filter((page) => page.kind === "suburb" && page.inSitemap);
  const otherLocals = pages.filter((page) => page.kind === "suburb" && !page.inSitemap);

  record("hub-index-follow", pages[0]?.kind === "hub" && pages[0].robots === INDEX_FOLLOW, pages[0]?.url || "missing hub");
  record("five-local-index", indexLocals.length === 5, `${indexLocals.length} indexable local pages`);
  record(
    "index-local-names",
    ["rotherham-central", "kimberworth", "whiston", "richmond", "norton"].every((slug) =>
      indexLocals.some((page) => page.slug === slug),
    ),
    indexLocals.map((page) => page.slug).join(", "),
  );
  record(
    "remaining-suburbs-index-follow",
    otherLocals.length >= 41 && pages.every((page) => page.robots === INDEX_FOLLOW),
    `${pages.length} delivery pages use the indexable robots directive`,
  );
  record("sitemap-six-urls", sitemapPages.length === 6, `${sitemapPages.length} sitemap URLs`);

  const xml = buildPilotSitemapXml(sitemapPages);
  const locs = parseSitemapLocs(xml);
  record("sitemap-locs-match", locs.length === 6 && locs.every((loc, i) => loc === sitemapPages[i]?.url), locs.join(" | "));
  record(
    "sitemap-excludes-non-cohort",
    otherLocals.every((page) => !locs.includes(page.url)),
    "non-cohort suburb URLs absent from sitemap-pilot.xml",
  );

  const sample = "<html><head><meta name=\"viewport\" content=\"width=device-width\" /></head></html>";
  record(
    "robots-inject-index",
    extractRobotsMeta(applyRobotsMeta(sample, INDEX_FOLLOW)) === INDEX_FOLLOW,
    INDEX_FOLLOW,
  );
  const noindexFollow = `<html><head><meta name="robots" content="noindex, follow" /></head></html>`;
  const bareNoindex = `<html><head><meta name="robots" content="noindex" /></head></html>`;
  record(
    "robots-replace-noindex-follow",
    extractRobotsMeta(applyRobotsMeta(noindexFollow)) === INDEX_FOLLOW && !applyRobotsMeta(noindexFollow).includes("noindex"),
    "noindex, follow replaced",
  );
  record(
    "robots-replace-bare-noindex",
    extractRobotsMeta(applyRobotsMeta(bareNoindex)) === INDEX_FOLLOW && !applyRobotsMeta(bareNoindex).includes("noindex"),
    "bare noindex replaced",
  );
  record(
    "path-norton-index",
    robotsDirectiveForPath("/delivery/reliable-direct-pharmacy-sheffield/free-nhs-prescription-delivery-norton") ===
      INDEX_FOLLOW,
    "Norton",
  );
  record(
    "path-clifton-index",
    robotsDirectiveForPath("/delivery/reliable-direct-pharmacy-sheffield/free-nhs-prescription-delivery-clifton") ===
      INDEX_FOLLOW,
    "Clifton",
  );
  record(
    "header-richmond-index",
    xRobotsTagForDeliveryPath("/delivery/reliable-direct-pharmacy-sheffield/free-nhs-prescription-delivery-richmond") ===
      INDEX_FOLLOW &&
      isPilotCohortPath("/delivery/reliable-direct-pharmacy-sheffield/free-nhs-prescription-delivery-richmond"),
    "Richmond X-Robots-Tag index, follow",
  );
  record(
    "header-ecclesall-index",
    xRobotsTagForDeliveryPath("/delivery/reliable-direct-pharmacy-sheffield/free-nhs-prescription-delivery-ecclesall") ===
      INDEX_FOLLOW &&
      !isPilotCohortPath("/delivery/reliable-direct-pharmacy-sheffield/free-nhs-prescription-delivery-ecclesall"),
    "Ecclesall X-Robots-Tag index, follow",
  );
  const spokeHtml = `<!DOCTYPE html>
<html><head>
<meta name="robots" content="noindex, follow" />
<link rel="canonical" href="https://content.pharmaconnect.uk/delivery/reliable-direct-pharmacy-sheffield/whiston/" />
</head><body></body></html>`;
  const spokeFixed = prepareDeliveryPageHtml(spokeHtml, WHISTON_DELIVERY_URL);
  record(
    "spoke-canonical-self-referential",
    extractRobotsMeta(spokeFixed) === INDEX_FOLLOW &&
      extractCanonical(spokeFixed) === WHISTON_DELIVERY_URL &&
      !spokeFixed.includes("/whiston/"),
    extractCanonical(spokeFixed) || "missing canonical",
  );
  record(
    "spoke-file-canonical",
    deliveryCanonicalForHtmlFile(
      "output/delivery-engine/delivery/reliable-direct-pharmacy-sheffield/whiston/index.html",
      "https://content.pharmaconnect.uk",
    ) === WHISTON_DELIVERY_URL,
    "spoke folder file maps to the delivery URL",
  );
  record(
    "whiston-generated-from-kimberworth",
    (() => {
      const sample =
        '<title>Prescription delivery for Kimberworth &amp; Greasbrough, Rotherham</title><meta name="robots" content="noindex, follow" /><link rel="canonical" href="https://content.pharmaconnect.uk/delivery/reliable-direct-pharmacy-sheffield/kimberworth/" />';
      const generated = generateWhistonHtmlFromKimberworth(sample);
      return (
        generated.includes("Whiston") &&
        generated.includes("free-nhs-prescription-delivery-whiston") &&
        !generated.includes("kimberworth") &&
        extractRobotsMeta(generated) === INDEX_FOLLOW &&
        extractCanonical(generated) === WHISTON_DELIVERY_URL
      );
    })(),
    "Whiston page generated with index, follow and its own canonical",
  );
  record(
    "hub-lists-whiston",
    ensureWhistonOnHub(
      '<li><a href="/delivery/reliable-direct-pharmacy-sheffield/free-nhs-prescription-delivery-kimberworth">Kimberworth &amp; Greasbrough</a> <span>(S61)</span></li>',
    ).includes("free-nhs-prescription-delivery-whiston"),
    "Hub Rotherham list includes Whiston",
  );

  const tracked = path.join(ROOT, "delivery/sitemap-pilot.xml");
  if (fs.existsSync(tracked)) {
    const trackedLocs = parseSitemapLocs(fs.readFileSync(tracked, "utf8"));
    record("tracked-sitemap-six", trackedLocs.length === 6, `${trackedLocs.length} loc in delivery/sitemap-pilot.xml`);
    record(
      "tracked-sitemap-urls",
      sitemapPages.every((page) => trackedLocs.includes(page.url)) && trackedLocs.length === 6,
      trackedLocs.join(" | "),
    );
  } else {
    record("tracked-sitemap-six", false, "delivery/sitemap-pilot.xml missing — run configure-delivery-pilot-indexing.ts");
  }

  const outputRoot = path.join(ROOT, "output/delivery-engine");
  if (fs.existsSync(outputRoot)) {
    const hubHtml = fs.readFileSync(
      path.join(outputRoot, "delivery/reliable-direct-pharmacy-sheffield/index.html"),
      "utf8",
    );
    record("output-hub-robots", extractRobotsMeta(hubHtml) === INDEX_FOLLOW, extractRobotsMeta(hubHtml) || "missing");
    const cliftonHtml = fs.readFileSync(
      path.join(outputRoot, "delivery/reliable-direct-pharmacy-sheffield/free-nhs-prescription-delivery-clifton/index.html"),
      "utf8",
    );
    record("output-clifton-robots", extractRobotsMeta(cliftonHtml) === INDEX_FOLLOW, extractRobotsMeta(cliftonHtml) || "missing");
    record(
      "output-clifton-canonical",
      extractCanonical(cliftonHtml) ===
        "https://content.pharmaconnect.uk/delivery/reliable-direct-pharmacy-sheffield/free-nhs-prescription-delivery-clifton",
      extractCanonical(cliftonHtml) || "missing",
    );
  }

  const failed = checks.filter((check) => !check.pass);
  console.log(`\n${failed.length ? "FAIL" : "PASS"}  ${checks.length - failed.length}/${checks.length} checks`);
  if (failed.length) process.exit(1);
}

main();
