#!/usr/bin/env npx tsx
/**
 * NI-03C.2 isolated browser smoke for Search Intelligence.
 * Reads the existing persisted snapshot. Does not collect.
 * Does not call DataForSEO, Google Places, or GSC.
 * Does not restart production PM2.
 */
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SECRET = process.env.SESSION_SECRET || "dev-fallback-secret-change-in-prod";
const PORT = process.env.PORT || "4173";
const BASE = (process.env.NI03C2_BASE_URL || `http://127.0.0.1:${PORT}`).replace(/\/$/, "");
const SNAPSHOT = path.join(WORKSPACE_ROOT, "data/national-growth-engine/pharmaconnect-search-intelligence-v1.json");
const VPS_SNAPSHOT = "/home/inboxingproweb/pharmaconnect-growth-engine/data/national-growth-engine/pharmaconnect-search-intelligence-v1.json";
const EXPECTED_CAPTURED_AT = "2026-08-18T13:02:53.532Z";

function puttyCommand(sha = "HEAD"): string {
  return [
    "cd /home/inboxingproweb/recovery/pharmaconnect-gp01c-validation",
    "git fetch origin cursor/gp01c-national-local-growth-plan-routing-ac7f",
    `git checkout ${sha}`,
    "set -a",
    ". /home/inboxingproweb/pharmaconnect-growth-engine/.env",
    "set +a",
    "export WORKSPACE_ROOT=/home/inboxingproweb/pharmaconnect-growth-engine",
    "export PORT=4173",
    "export NODE_ENV=development",
    "pnpm --filter @workspace/api-server run build",
    "pnpm exec tsx scripts/browser-ni03c2-search-intelligence-smoke.ts",
  ].join(" && ");
}

interface Item {
  id: string;
  pass: boolean;
  detail: string;
}

const items: Item[] = [];

function check(id: string, pass: boolean, detail: string) {
  items.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function tokenUrl(pathname: string, slug: string): string {
  const u = new URL(pathname, BASE);
  u.searchParams.set("slug", slug);
  u.searchParams.set("_t", SECRET);
  return u.toString();
}

async function waitForServer(url: string, timeoutMs = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.status > 0) return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  return false;
}

async function startIsolatedServer(): Promise<ChildProcess | null> {
  if (process.env.NI03C2_BASE_URL) return null;
  const dist = path.resolve("artifacts/api-server/dist/index.mjs");
  if (!fs.existsSync(dist)) {
    throw new Error(`Isolated api-server dist missing at ${dist}. Build it first with: pnpm --filter @workspace/api-server run build`);
  }
  const child = spawn(process.execPath, ["--enable-source-maps", dist], {
    env: {
      ...process.env,
      PORT,
      WORKSPACE_ROOT,
      SESSION_SECRET: SECRET,
      NODE_ENV: "development",
    },
    stdio: "inherit",
  });
  const ready = await waitForServer(`http://127.0.0.1:${PORT}/api/health`).catch(() => false)
    || await waitForServer(tokenUrl("/api/growth-engine/search-intelligence", "pharmaconnect"));
  if (!ready) {
    child.kill("SIGTERM");
    throw new Error(`Isolated api-server on port ${PORT} did not become ready`);
  }
  return child;
}

async function main() {
  console.log(`Workspace: ${WORKSPACE_ROOT}`);
  console.log(`Snapshot: ${SNAPSHOT}`);
  console.log(`Base URL: ${BASE}`);

  if (!fs.existsSync(SNAPSHOT)) {
    console.log("SNAPSHOT_MISSING — this process is not on the VPS workspace containing the verified snapshot.");
    console.log(`EXPECTED_VPS_SNAPSHOT=${VPS_SNAPSHOT}`);
    console.log("PUTTY_COMMAND=");
    console.log(puttyCommand("ORIGIN_HEAD"));
    process.exit(2);
  }

  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8")) as {
    capturedAt?: string;
    status?: string;
    costs?: { requests?: number; tasks?: number; totalCost?: number };
    customerKeywords?: unknown[];
    organicCompetitors?: unknown[];
    competitorKeywordUniverses?: unknown[];
  };
  check("snapshot-exists", true, SNAPSHOT);
  check("snapshot-status-collected", snapshot.status === "collected", String(snapshot.status));
  check(
    "snapshot-captured-at",
    snapshot.capturedAt === EXPECTED_CAPTURED_AT,
    String(snapshot.capturedAt),
  );

  let server: ChildProcess | null = null;
  try {
    server = await startIsolatedServer();
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${SECRET}` },
    });
    const page = await context.newPage();
    const url = tokenUrl("/api/growth-engine/search-intelligence", "pharmaconnect");
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    const status = response?.status() ?? 0;
    const html = await page.content();
    const text = await page.locator("body").innerText();

    console.log(`\nBROWSER_TEST_URL=${url}\n`);
    check("http-200", status === 200, String(status));
    check("page-status-collected", html.includes('data-ni03c2-page-status="COLLECTED"') || text.includes("COLLECTED"), "COLLECTED");
    check("customer-keywords-1", html.includes('data-ni03c2-customer-keywords="1"') || (snapshot.customerKeywords || []).length === 1, "1");
    check("organic-candidates-19", (html.match(/data-ni03c-competitor="/g) || []).length === (snapshot.organicCompetitors || []).length, String((html.match(/data-ni03c-competitor="/g) || []).length));
    check("qualified-0", html.includes('data-ni03c2-qualified-count="0"'), "0");
    check("paid-0", html.includes('data-ni03c2-paid-expansions="0"'), "0");
    check("sparse-warning", /sparse organic search footprint/i.test(text), "sparse warning");
    check("zero-commercial-copy", /No commercially qualified competitors were found/i.test(text), "zero commercial state");
    check("not-labelled-failed", !/Collection failed/i.test(text) && !/Intelligence not collected/i.test(text), "not failed");
    check("requests-2", html.includes(`data-ni03c2-requests="${snapshot.costs?.requests ?? 2}"`), String(snapshot.costs?.requests));
    check("tasks-2", html.includes(`data-ni03c2-tasks="${snapshot.costs?.tasks ?? 2}"`), String(snapshot.costs?.tasks));
    check("cost-rendered", html.includes(String(snapshot.costs?.totalCost ?? "0.02652")), String(snapshot.costs?.totalCost));
    check("evidence-live", html.includes("DATAFORSEO_LIVE"), "DATAFORSEO_LIVE");
    check("authority-persisted", html.includes("PERSISTED_PROVEN"), "PERSISTED_PROVEN");
    check("no-commercial-pills-for-false-positives", (html.match(/>commercial competitor</g) || []).length === 0, "no false commercial pills");

    await browser.close();
  } finally {
    if (server) {
      server.kill("SIGTERM");
    }
  }

  const failed = items.filter((row) => !row.pass).length;
  console.log(`\n${failed ? "FAIL" : "PASS"} — ${items.length - failed}/${items.length} checks\n`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  console.log("PUTTY_COMMAND=");
  console.log(puttyCommand("ORIGIN_HEAD"));
  process.exit(1);
});
