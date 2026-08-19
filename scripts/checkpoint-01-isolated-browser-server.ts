#!/usr/bin/env npx tsx
/**
 * Isolated Checkpoint 01 browser server.
 * Serves Business Intelligence and Website Intelligence HTML only.
 * Does not start the production API, PM2, DataForSEO, Places, or GSC.
 */
import http from "node:http";

import { renderBusinessIntelligencePage, renderWebsiteIntelligencePage } from "../src/pharmacy/growthEnginePageRenderers.ts";
import { ensureWebsiteIntelligenceInventory } from "../src/pharmacy/growthEngineWebsiteIntelligenceService.ts";

const PORT = Number(process.env.PORT || 4318);
const HOST = process.env.HOST || "127.0.0.1";

function send(res: http.ServerResponse, status: number, body: string, type = "text/html; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
    const slug = String(url.searchParams.get("slug") || "").trim();
    if (url.pathname === "/health") {
      send(res, 200, "ok", "text/plain; charset=utf-8");
      return;
    }
    if (!slug) {
      send(res, 400, "<pre>slug query parameter is required</pre>");
      return;
    }
    if (url.pathname === "/api/growth-engine/business-intelligence") {
      await ensureWebsiteIntelligenceInventory(slug);
      send(res, 200, renderBusinessIntelligencePage(slug, {} as never));
      return;
    }
    if (url.pathname === "/api/growth-engine/website-intelligence") {
      await ensureWebsiteIntelligenceInventory(slug);
      send(res, 200, renderWebsiteIntelligencePage(slug));
      return;
    }
    if (
      url.pathname === "/api/growth-engine/search-intelligence" ||
      url.pathname === "/api/growth-engine/local-market"
    ) {
      const { renderSearchIntelligencePage, renderLocalMarketPage } = await import("../src/pharmacy/growthEnginePageRenderers.ts");
      send(res, 200, url.pathname.endsWith("local-market") ? renderLocalMarketPage(slug, null) : renderSearchIntelligencePage(slug));
      return;
    }
    send(res, 404, "<pre>Not found</pre>");
  } catch (err) {
    send(res, 500, `<pre>${String(err instanceof Error ? err.stack || err.message : err)}</pre>`);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`CHECKPOINT_01_BROWSER_SERVER host=${HOST} port=${PORT}`);
  console.log(`BROWSER_URL=http://${HOST}:${PORT}/api/growth-engine/business-intelligence?slug=TENANT_SLUG`);
});
