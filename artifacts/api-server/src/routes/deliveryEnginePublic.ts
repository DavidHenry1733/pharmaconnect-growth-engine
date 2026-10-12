/**
 * Public delivery-engine routes for content.pharmaconnect.uk.
 * Sets X-Robots-Tag to match the pilot cohort meta robots directive.
 */
import { Router, type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import {
  INDEX_FOLLOW,
  xRobotsTagForDeliveryPath,
} from "../../../../src/pharmacy/deliveryEnginePilotIndexing.ts";
import {
  resolveDeliveryHtmlFile,
  resolvePilotSitemapFile,
  writePilotSitemaps,
} from "../../../../src/pharmacy/deliveryEnginePublicService.ts";

export function deliveryEngineRobotsHeaderMiddleware(req: Request, res: Response, next: NextFunction): void {
  const tag = xRobotsTagForDeliveryPath(req.path);
  if (tag) res.setHeader("X-Robots-Tag", tag);
  next();
}

function sendHtml(res: Response, filePath: string, robots: string): void {
  const html = fs.readFileSync(filePath, "utf8");
  res.status(200);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Robots-Tag", robots);
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(html);
}

export const deliveryEnginePublicRouter = Router();

deliveryEnginePublicRouter.get("/sitemap-pilot.xml", (_req, res) => {
  const file = resolvePilotSitemapFile() || (writePilotSitemaps(), resolvePilotSitemapFile());
  if (!file) {
    res.status(404).type("text/plain").send("sitemap-pilot.xml not found");
    return;
  }
  res.status(200);
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("X-Robots-Tag", INDEX_FOLLOW);
  res.send(fs.readFileSync(file, "utf8"));
});

function handleDeliveryPage(req: Request, res: Response, next: NextFunction): void {
  const file = resolveDeliveryHtmlFile(req.path);
  const robots = xRobotsTagForDeliveryPath(req.path);
  if (!file || !robots) {
    next();
    return;
  }
  sendHtml(res, file, robots);
}

deliveryEnginePublicRouter.get("/delivery/reliable-direct-pharmacy-sheffield", handleDeliveryPage);
deliveryEnginePublicRouter.get("/delivery/reliable-direct-pharmacy-sheffield/", handleDeliveryPage);
deliveryEnginePublicRouter.get(
  "/delivery/reliable-direct-pharmacy-sheffield/free-nhs-prescription-delivery-:slug",
  handleDeliveryPage,
);
deliveryEnginePublicRouter.get(
  "/delivery/reliable-direct-pharmacy-sheffield/free-nhs-prescription-delivery-:slug/",
  handleDeliveryPage,
);
