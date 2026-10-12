#!/usr/bin/env npx tsx
/**
 * Local public delivery-engine server — same robots header contract as Express.
 */
import http from "node:http";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { xRobotsTagForDeliveryPath } from "../src/pharmacy/deliveryEnginePilotIndexing.ts";
import {
  resolveDeliveryHtmlFile,
  resolvePilotSitemapFile,
} from "../src/pharmacy/deliveryEnginePublicService.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

const PORT = Number(process.env.DELIVERY_ENGINE_PORT || 8766);

const server = http.createServer((req, res) => {
  const urlPath = req.url?.split("?")[0] || "/";
  const tag = xRobotsTagForDeliveryPath(urlPath);
  if (tag) res.setHeader("X-Robots-Tag", tag);

  if (urlPath === "/sitemap-pilot.xml") {
    const file = resolvePilotSitemapFile();
    if (!file) {
      res.statusCode = 404;
      res.end("sitemap-pilot.xml not found");
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.end(fs.readFileSync(file));
    return;
  }

  const file = resolveDeliveryHtmlFile(urlPath);
  if (!file) {
    res.statusCode = 404;
    res.end(`Cannot GET ${urlPath}`);
    return;
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(fs.readFileSync(file));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`delivery-engine public server http://127.0.0.1:${PORT}`);
});
