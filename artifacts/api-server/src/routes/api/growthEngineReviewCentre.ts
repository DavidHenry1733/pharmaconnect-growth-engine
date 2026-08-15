/**
 * Review Centre V2 — approve / improve JSON API.
 */
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import {
  approveReviewCentreAsset,
  buildReviewCentreView,
  improveReviewCentreAsset,
} from "../../../../../src/pharmacy/growthEngineReviewCentreService.ts";
import {
  buildReviewCentreSourceDebug,
  getContentPackageReviewSections,
} from "../../../../../src/pharmacy/pharmacyContentPackageService.ts";
import { resolveTenantProfileSlug } from "../../../../../src/pharmacy/pharmacyTenantSlug.ts";
import { resolveVisualExperienceHtmlPath } from "../../../../../src/pharmacy/pharmacyVisualExperience.ts";
import {
  findPreviewSourceMarker,
  renderBenchmarkEcosystemPreviewIndex,
  renderBenchmarkPagePreviewHtml,
  renderMissingReviewPreview,
  renderPackPreviewPage,
  resolveBenchmarkPackAsset,
  sanitizeReviewPreviewHtml,
} from "../../../../../src/pharmacy/pharmacyContentEcosystemPreviewRoute.ts";

const router = Router();

function resolveSlug(raw: string): string | null {
  return (
    resolveTenantProfileSlug(raw) ||
    String(raw || "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") ||
    null
  );
}

function sendHtml(res: import("express").Response, html: string): void {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.status(200).send(html);
}

function htmlFlags(html: string) {
  return {
    sourceMarkerFound: findPreviewSourceMarker(html),
    headerPresent: /<header\b/i.test(html),
    footerPresent: /<footer\b/i.test(html),
    imagePresent: /<img\b/i.test(html),
    visibleImagePlaceholderPresent: /Image will be added before publishing|data-image-missing="true"/i.test(html),
    placeholderTextFound: /Professional review details available from the pharmacy|Trust & credentials|SOCIAL CONTENT LIBRARY/i.test(html),
    trustBlockSource: /trust-strip/i.test(html)
      ? "review-wrapper"
      : /pharmacy-trust-cards/i.test(html)
        ? "visual-experience"
        : /Professional review details available from the pharmacy/i.test(html)
          ? "placeholder-copy"
          : "missing",
  };
}

function packIdForSourcePath(sourcePath: string): string | null {
  const base = path.basename(sourcePath).replace(/\.(json|md)$/i, "");
  if (base === "gbp-posts") return "gbp-pack";
  if (base === "social-posts") return "social-pack";
  if (base === "email-sequence") return "email-sequence";
  if (base === "video-script") return "video-script";
  return null;
}

function firstHtmlInDirectory(dir: string): string | null {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
  const direct = path.join(dir, "index.html");
  if (fs.existsSync(direct)) return direct;
  for (const name of fs.readdirSync(dir).sort()) {
    const candidate = path.join(dir, name, "index.html");
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function renderReviewPreviewAsset(slug: string, campaignId: string, assetKey: string): { html: string; sourcePath: string | null; sourceRoute: string } {
  if (assetKey === "service-page") {
    const file = resolveVisualExperienceHtmlPath(campaignId as never, slug);
    if (!file) throw new Error("Service page preview source missing");
    return {
      html: renderBenchmarkPagePreviewHtml(file, campaignId, slug, "service-page"),
      sourcePath: file,
      sourceRoute: "review-wrapper-service-page",
    };
  }

  const section = getContentPackageReviewSections(slug, campaignId).find((sec) => sec.type === assetKey);
  const sourcePath = section?.outputPath || null;
  if (!sourcePath) throw new Error(`Review preview source missing for ${assetKey}`);

  const htmlFile = fs.existsSync(sourcePath) && fs.statSync(sourcePath).isDirectory() ? firstHtmlInDirectory(sourcePath) : sourcePath;
  if (htmlFile && /\.html$/i.test(htmlFile)) {
    return {
      html: renderBenchmarkPagePreviewHtml(htmlFile, campaignId, slug, path.basename(path.dirname(htmlFile))),
      sourcePath: htmlFile,
      sourceRoute: "review-wrapper-page",
    };
  }

  const packId = packIdForSourcePath(sourcePath);
  if (packId) {
    const asset = resolveBenchmarkPackAsset(campaignId, packId, slug);
    const html = asset ? renderPackPreviewPage(asset, campaignId, slug) : null;
    if (!html) throw new Error(`Review pack preview source missing for ${assetKey}`);
    return { html, sourcePath, sourceRoute: "review-wrapper-pack" };
  }

  const indexHtml = renderBenchmarkEcosystemPreviewIndex(campaignId, slug);
  if (!indexHtml) throw new Error(`Review preview source unsupported for ${assetKey}`);
  return { html: indexHtml, sourcePath, sourceRoute: "raw-content-preview-route" };
}

router.post("/growth-engine/:slug/review-centre/approve", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid pharmacy" });

  const campaignId = String(req.body?.campaignId || req.body?.campaign || "");
  const assetKey = String(req.body?.assetKey || "");
  if (!campaignId) return res.status(400).json({ ok: false, error: "Campaign required" });
  if (!assetKey) return res.status(400).json({ ok: false, error: "Section required" });

  try {
    approveReviewCentreAsset(slug, campaignId, assetKey);
    const view = buildReviewCentreView(slug, campaignId);
    return res.json({
      ok: true,
      canPublish: view?.canPublish ?? false,
      allApproved: view?.allApproved ?? false,
    });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/growth-engine/:slug/review-centre-debug", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid pharmacy" });
  const campaignId = String(req.query.campaign || req.query.campaignId || "");
  if (!campaignId) return res.status(400).json({ ok: false, error: "Campaign required" });

  try {
    return res.json(buildReviewCentreSourceDebug(slug, campaignId));
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/growth-engine/:slug/review-preview", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).send("Invalid pharmacy");
  const campaignId = String(req.query.campaign || req.query.campaignId || "");
  const assetKey = String(req.query.asset || req.query.assetKey || "");
  if (!campaignId) return res.status(400).send("Campaign required");
  if (!assetKey) return res.status(400).send("Asset required");

  try {
    const rendered = renderReviewPreviewAsset(slug, campaignId, assetKey);
    return sendHtml(res, rendered.html);
  } catch (err: unknown) {
    return sendHtml(res, renderMissingReviewPreview(slug, campaignId, "Campaign content"));
  }
});

router.get("/growth-engine/:slug/review-preview-debug", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid pharmacy" });
  const campaignId = String(req.query.campaign || req.query.campaignId || "");
  if (!campaignId) return res.status(400).json({ ok: false, error: "Campaign required" });

  try {
    const view = buildReviewCentreView(slug, campaignId);
    const sourceDebug = buildReviewCentreSourceDebug(slug, campaignId);
    const previewAssets = (view?.groups || []).flatMap((group) => group.assets);
    const previews = previewAssets
      .filter((asset) => asset.previewUrl)
      .map((asset) => {
        const rendered = asset.previewUrl?.includes("/review-preview?")
          ? renderReviewPreviewAsset(slug, campaignId, asset.key)
          : { html: "", sourcePath: sourceDebug.assets.find((a) => a.group === asset.key)?.sourcePath || null, sourceRoute: "external-preview" };
        const flags = rendered.html ? htmlFlags(rendered.html) : {
          sourceMarkerFound: null,
          headerPresent: false,
          footerPresent: false,
          imagePresent: false,
          visibleImagePlaceholderPresent: false,
          placeholderTextFound: false,
          trustBlockSource: "not-rendered",
        };
        return {
          assetKey: asset.key,
          assetTitle: asset.title,
          previewUrl: asset.previewUrl,
          sourceFilePath: rendered.sourcePath,
          sourceRoute: rendered.sourceRoute,
          ...flags,
        };
      });
    return res.json({
      ok: true,
      slug,
      campaignId,
      previewUrls: previews.map((preview) => preview.previewUrl),
      previews,
    });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/growth-engine/:slug/review-centre/improve", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid pharmacy" });

  const campaignId = String(req.body?.campaignId || req.body?.campaign || "");
  const assetKey = String(req.body?.assetKey || "");
  if (!campaignId) return res.status(400).json({ ok: false, error: "Campaign required" });
  if (!assetKey) return res.status(400).json({ ok: false, error: "Section required" });

  try {
    const result = improveReviewCentreAsset(slug, campaignId, assetKey);
    const view = buildReviewCentreView(slug, campaignId);
    return res.json({
      ok: true,
      improved: result.improved,
      message: result.message,
      canPublish: view?.canPublish ?? false,
    });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
