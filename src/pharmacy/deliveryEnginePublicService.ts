/**
 * Public NHS prescription delivery engine — HTML generation, Whiston territory,
 * robots meta, and LiteSpeed/Express X-Robots-Tag alignment.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyCanonicalLink,
  applyRobotsMeta,
  buildPilotSitemapXml,
  INDEX_FOLLOW,
  listDeliveryPilotPages,
  listPilotSitemapPages,
  loadDeliveryPilotCohort,
  localHtmlRelativePath,
  prepareDeliveryPageHtml,
  type DeliveryPilotPage,
} from "./deliveryEnginePilotIndexing.ts";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

export function deliveryWorkspaceRoot(): string {
  const env = process.env.WORKSPACE_ROOT?.trim();
  if (env && fs.existsSync(env)) return env;
  return path.resolve(MODULE_DIR, "../..");
}

export function deliveryOutputRoot(): string {
  return path.join(deliveryWorkspaceRoot(), "output/delivery-engine");
}

export function deliveryPublicRoot(): string {
  return path.join(deliveryWorkspaceRoot(), "public");
}

export function trackedPilotSitemapPath(): string {
  return path.join(deliveryWorkspaceRoot(), "delivery/sitemap-pilot.xml");
}

export const WHISTON_DELIVERY_URL =
  "https://content.pharmaconnect.uk/delivery/reliable-direct-pharmacy-sheffield/free-nhs-prescription-delivery-whiston";

const WHISTON_HUB_LINK =
  '<li><a href="/delivery/reliable-direct-pharmacy-sheffield/free-nhs-prescription-delivery-whiston">Whiston</a> <span>(S60)</span></li>';
const KIMBERWORTH_HUB_LINK =
  '<li><a href="/delivery/reliable-direct-pharmacy-sheffield/free-nhs-prescription-delivery-kimberworth">Kimberworth &amp; Greasbrough</a> <span>(S61)</span></li>';

export function ensureWhistonOnHub(html: string): string {
  if (html.includes("free-nhs-prescription-delivery-whiston")) return html;
  if (html.includes(KIMBERWORTH_HUB_LINK)) {
    return html.replace(KIMBERWORTH_HUB_LINK, `${KIMBERWORTH_HUB_LINK}${WHISTON_HUB_LINK}`);
  }
  return html.replace(
    "</ul></section>",
    `${WHISTON_HUB_LINK}</ul></section>`,
  );
}

export function generateWhistonHtmlFromKimberworth(source: string): string {
  let html = source;
  const replacements: Array<[string, string]> = [
    ["Kimberworth &amp; Greasbrough", "Whiston"],
    ["Kimberworth & Greasbrough", "Whiston"],
    ["Kimberworth Park Medical Centre", "Whiston Primary Care Centre"],
    ["Langdon Road, Rotherham, S61 3EY, Kimberworth Park", "East Bawtry Road, Whiston, Rotherham, S60 4NY"],
    ["Greasbrough Medical Centre", "Sitwell Surgery"],
    ["Greasbrough, Rotherham, S61 4NP, Greasbrough", "Pleasley Road, Whiston, Rotherham, S60 4HQ"],
    ["Kimberworth Park", "Whiston"],
    ["Wortley Road and Church Street corridor", "East Bawtry Road and Pleasley Road"],
    [
      "Steep hillside gradients around Whiston and limited direct chemist parking.",
      "Residential streets around Sitwell Vale and limited on-street parking near the primary care centre.",
    ],
    ["free-nhs-prescription-delivery-kimberworth", "free-nhs-prescription-delivery-whiston"],
    ["S61", "S60"],
    ["Kimberworth", "Whiston"],
    ["Greasbrough", "Whiston"],
    ["kimberworth", "whiston"],
    ["greasbrough", "whiston"],
  ];
  for (const [from, to] of replacements) {
    html = html.split(from).join(to);
  }
  return applyCanonicalLink(applyRobotsMeta(html, INDEX_FOLLOW), WHISTON_DELIVERY_URL);
}

export function writeUtf8(filePath: string, contents: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
}

export function htaccessForDirective(directive: string): string {
  return `<IfModule mod_headers.c>
  Header always unset X-Robots-Tag
  Header always set X-Robots-Tag "${directive}"
</IfModule>
`;
}

export function rootDeliveryHtaccess(_indexableSlugs: string[] = []): string {
  return htaccessForDirective(INDEX_FOLLOW);
}

export function materializeDeliveryPageFiles(page: DeliveryPilotPage, html: string): string[] {
  const written: string[] = [];
  const prepared = prepareDeliveryPageHtml(html, page.url);
  const rel = localHtmlRelativePath(page);
  const outputHtml = path.join(deliveryOutputRoot(), rel);
  const publicHtml = path.join(deliveryPublicRoot(), rel);
  writeUtf8(outputHtml, prepared);
  writeUtf8(publicHtml, prepared);
  written.push(outputHtml, publicHtml);

  const htaccess = htaccessForDirective(INDEX_FOLLOW);
  writeUtf8(path.join(path.dirname(outputHtml), ".htaccess"), htaccess);
  writeUtf8(path.join(path.dirname(publicHtml), ".htaccess"), htaccess);

  if (page.kind === "suburb" && page.slug) {
    const htmlName = path.join(
      "delivery/reliable-direct-pharmacy-sheffield",
      `free-nhs-prescription-delivery-${page.slug}.html`,
    );
    writeUtf8(path.join(deliveryOutputRoot(), htmlName), prepared);
    writeUtf8(path.join(deliveryPublicRoot(), htmlName), prepared);
  }
  return written;
}

export function resolveDeliveryHtmlFile(urlPath: string): string | null {
  const normalised = String(urlPath || "").split("?")[0]!.replace(/\/+$/, "") || "/";
  const cohort = loadDeliveryPilotCohort();
  const pages = listDeliveryPilotPages(cohort);
  const page = pages.find((candidate) => candidate.path.replace(/\/+$/, "") === normalised);
  if (!page) return null;
  const rel = localHtmlRelativePath(page);
  const htmlName =
    page.kind === "suburb" && page.slug
      ? path.join(
          "delivery/reliable-direct-pharmacy-sheffield",
          `free-nhs-prescription-delivery-${page.slug}.html`,
        )
      : "";
  const candidates = [
    path.join(deliveryOutputRoot(), rel),
    path.join(deliveryPublicRoot(), rel),
    htmlName ? path.join(deliveryOutputRoot(), htmlName) : "",
    htmlName ? path.join(deliveryPublicRoot(), htmlName) : "",
  ].filter(Boolean);
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  return null;
}

export function writePilotSitemaps(): string {
  const xml = buildPilotSitemapXml(listPilotSitemapPages());
  writeUtf8(trackedPilotSitemapPath(), xml);
  writeUtf8(path.join(deliveryOutputRoot(), "sitemap-pilot.xml"), xml);
  writeUtf8(path.join(deliveryPublicRoot(), "sitemap-pilot.xml"), xml);
  return xml;
}

export function resolvePilotSitemapFile(): string | null {
  const candidates = [
    trackedPilotSitemapPath(),
    path.join(deliveryPublicRoot(), "sitemap-pilot.xml"),
    path.join(deliveryOutputRoot(), "sitemap-pilot.xml"),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  return null;
}
