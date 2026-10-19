#!/usr/bin/env npx tsx
/**
 * Search-and-replace delivery HTML robots meta and spoke-folder canonicals.
 *
 * Walks output/delivery-engine, public delivery copies, and — when this
 * environment can see it — the live webroot under
 * /home/adminnet/public_html/content.pharmaconnect.uk/delivery/.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  deliveryCanonicalForHtmlFile,
  extractCanonical,
  extractRobotsMeta,
  INDEX_FOLLOW,
  loadDeliveryPilotCohort,
  prepareDeliveryPageHtml,
} from "../src/pharmacy/deliveryEnginePilotIndexing.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIVE_DELIVERY_ROOT = "/home/adminnet/public_html/content.pharmaconnect.uk/delivery";
const LIVE_HTACCESS = "/home/adminnet/public_html/content.pharmaconnect.uk/.htaccess";

function walkHtml(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const found: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith(".html")) found.push(full);
    }
  }
  return found;
}

function patchFile(filePath: string, baseUrl: string): "patched" | "unchanged" | "skipped" {
  const canonical = deliveryCanonicalForHtmlFile(filePath, baseUrl);
  if (!canonical) return "skipped";
  const before = fs.readFileSync(filePath, "utf8");
  const after = prepareDeliveryPageHtml(before, canonical);
  if (after === before) return "unchanged";
  fs.writeFileSync(filePath, after, "utf8");
  return "patched";
}

function tryLivePermissions(htmlFiles: string[]): void {
  if (!fs.existsSync(LIVE_DELIVERY_ROOT)) return;
  try {
    execFileSync("chown", ["-R", "adminnet:adminnet", LIVE_DELIVERY_ROOT], { stdio: "inherit" });
  } catch (err) {
    console.warn(`chown skipped: ${err instanceof Error ? err.message : err}`);
  }
  for (const file of htmlFiles) {
    try {
      fs.chmodSync(file, 0o644);
    } catch (err) {
      console.warn(`chmod skipped for ${file}: ${err instanceof Error ? err.message : err}`);
    }
  }
  if (fs.existsSync(LIVE_HTACCESS)) {
    const now = new Date();
    fs.utimesSync(LIVE_HTACCESS, now, now);
    console.log(`Touched ${LIVE_HTACCESS}`);
  }
}

function main(): void {
  const cohort = loadDeliveryPilotCohort();
  const roots = [
    path.join(ROOT, "output/delivery-engine"),
    path.join(ROOT, "public/delivery"),
    LIVE_DELIVERY_ROOT,
    ...process.argv.slice(2),
  ];
  let patched = 0;
  let unchanged = 0;
  let skipped = 0;
  const liveFiles: string[] = [];
  for (const root of roots) {
    const files = walkHtml(root);
    if (!files.length) {
      console.log(`No HTML in ${root}`);
      continue;
    }
    for (const file of files) {
      const result = patchFile(file, cohort.baseUrl);
      if (result === "patched") patched += 1;
      else if (result === "unchanged") unchanged += 1;
      else skipped += 1;
      if (file.startsWith(LIVE_DELIVERY_ROOT)) liveFiles.push(file);
      if (result === "patched") {
        const html = fs.readFileSync(file, "utf8");
        console.log(`${file}\n  robots=${extractRobotsMeta(html)}\n  canonical=${extractCanonical(html)}`);
      }
    }
  }
  tryLivePermissions(liveFiles);
  console.log(
    JSON.stringify(
      {
        robots: INDEX_FOLLOW,
        patched,
        unchanged,
        skipped,
        liveRootPresent: fs.existsSync(LIVE_DELIVERY_ROOT),
      },
      null,
      2,
    ),
  );
}

main();
