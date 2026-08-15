/**
 * Pharmacy Indexing Bridge V1 — JSON API.
 */
import { Router } from "express";
import {
  getPharmacyIndexingBridgeStatus,
  readPharmacyIndexingSummary,
  readPharmacyRegistry,
  refreshPharmacyIndexingStatus,
  registerPharmacyPages,
  submitReadyPharmacyPages,
} from "../../../../../src/pharmacy/pharmacyIndexingBridgeService.ts";

const router = Router();

function safeSlug(v: string): string {
  return String(v || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

router.get("/pharmacy-indexing/:slug", (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const status = getPharmacyIndexingBridgeStatus(slug);
    res.json({
      ok: true,
      slug,
      registry: status.registry,
      summary: status.summary,
      sitemapExists: status.sitemapExists,
      sitemapPath: status.sitemapPath,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy-indexing/:slug/register", (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const result = registerPharmacyPages(slug);
    res.json({
      ok: true,
      slug,
      registered: result.registered,
      registryPath: result.registryPath,
      sitemapPath: result.sitemapPath,
      summaryPath: result.summaryPath,
      summary: readPharmacyIndexingSummary(slug),
      pages: result.pages,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy-indexing/:slug/submit", (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const result = submitReadyPharmacyPages(slug);
    res.json({
      ok: true,
      slug,
      submitted: result.submitted,
      summary: result.summary,
      registry: readPharmacyRegistry(slug),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy-indexing/:slug/refresh", (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const result = refreshPharmacyIndexingStatus(slug);
    res.json({
      ok: true,
      slug,
      checked: result.checked,
      summary: result.summary,
      registry: readPharmacyRegistry(slug),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
