/**
 * Shared Website-discovered ↔ configured tenant service reconciliation.
 * Evidence-only until Product Owner approval. No tenant-specific hardcoding.
 */
import fs from "node:fs";
import path from "node:path";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { CLINICAL_PHARMACY_SERVICE_PATTERNS } from "./growthEngineWebsiteServiceDetection.ts";
import {
  loadPharmacyServiceLibrary,
  normalizeServiceId,
  type PharmacyServiceLibrary,
  WORKSPACE_ROOT,
} from "./pharmacyServiceLibraryService.ts";
import { BENCHMARK_MASTER_SERVICE_IDS, getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";

function isProfileReviewApproved(slug: string): boolean {
  const file = path.join(
    WORKSPACE_ROOT,
    "data/pharmacy-master-admin/business-profile-approvals",
    slug,
    "latest.json",
  );
  if (!fs.existsSync(file)) return false;
  try {
    const doc = JSON.parse(fs.readFileSync(file, "utf8")) as { approvedAt?: string };
    return Boolean(doc.approvedAt);
  } catch {
    return false;
  }
}

export type ServiceMatchState =
  | "CONFIRMED_MATCH"
  | "CONFIGURED_NOT_CONFIRMED"
  | "NEWLY_DISCOVERED"
  | "REQUIRES_REVIEW"
  | "INCOMPATIBLE_EXCLUDED";

export interface WebsiteDiscoveredServiceInput {
  serviceId?: string;
  serviceName: string;
  sourceUrl?: string;
  pageTitle?: string;
  confidence?: number;
  detectionMethod?: string;
}

export interface ConfiguredServiceInput {
  serviceId: string;
  serviceName: string;
  source: "service-library" | "priorityServices" | "serviceDeliveryProfiles";
}

export interface ReconciledServiceRow {
  canonicalServiceId: string;
  canonicalServiceName: string;
  configuredServiceId: string | null;
  configuredServiceName: string | null;
  websiteDiscoveredLabel: string | null;
  websiteSourceUrl: string | null;
  websiteConfidence: number | null;
  websiteDetectionMethod: string | null;
  matchState: ServiceMatchState;
  matchReason: string;
  proposedForCanonical: boolean;
}

export interface ServiceReconciliationProposal {
  slug: string;
  websiteSnapshotImportedAt: string | null;
  businessClassificationClass: string | null;
  clinicalServiceDetectionEnabled: boolean;
  clinicalCatalogueEligible: boolean;
  configuredServices: ConfiguredServiceInput[];
  websiteDiscoveredServices: WebsiteDiscoveredServiceInput[];
  rows: ReconciledServiceRow[];
  proposedCanonicalServiceIds: string[];
  excludedIncompatibleServiceIds: string[];
  approvedCanonicalServiceIds: string[] | null;
  trustedDownstreamServiceIds: string[];
  downstreamTrusted: boolean;
}

/** Deterministic commercial / alias map (normalized display name → canonical id). */
const DETERMINISTIC_SERVICE_NAME_ALIASES: Record<string, string> = {
  "pharmacy website design": "pharmacy-website-design",
  "pharmacy local seo": "pharmacy-local-seo",
  "local seo for pharmacies": "pharmacy-local-seo",
  "local seo pharmacies": "pharmacy-local-seo",
  "pharmacy website hosting": "pharmacy-website-hosting",
  "pharmacy email marketing": "pharmacy-email-marketing",
  "pharmacy email communication": "pharmacy-email-marketing",
  "email communication": "pharmacy-email-marketing",
  "email marketing": "pharmacy-email-marketing",
  "pharmacy growth audits": "pharmacy-growth-audits",
  "pharmacy growth audit": "pharmacy-growth-audits",
};

const CLINICAL_SERVICE_ID_SET = new Set<string>([
  ...CLINICAL_PHARMACY_SERVICE_PATTERNS.map((p) => normalizeServiceId(p.id)),
  ...BENCHMARK_MASTER_SERVICE_IDS.map((id) => normalizeServiceId(id)),
  "ear-wax-removal",
  "covid-vaccinations",
  "discharge-medicines-service",
  "smoking-cessation",
  "weight-management",
  "health-checks",
  "private-prescribing",
  "travel-health-consultations",
  "vitamin-b12-injections",
  "minor-ailments",
]);

export function isClinicalPharmacyServiceId(serviceId: string): boolean {
  return CLINICAL_SERVICE_ID_SET.has(normalizeServiceId(serviceId));
}

export function normalizeServiceDisplayName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/&amp;/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveDeterministicServiceIdFromName(name: string): string | null {
  const norm = normalizeServiceDisplayName(name);
  if (!norm) return null;
  if (DETERMINISTIC_SERVICE_NAME_ALIASES[norm]) return DETERMINISTIC_SERVICE_NAME_ALIASES[norm];
  const slug = normalizeServiceId(norm.replace(/\s+/g, "-"));
  if (DETERMINISTIC_SERVICE_NAME_ALIASES[normalizeServiceDisplayName(slug.replace(/-/g, " "))]) {
    return DETERMINISTIC_SERVICE_NAME_ALIASES[normalizeServiceDisplayName(slug.replace(/-/g, " "))];
  }
  const meta = getServicePublishMeta(slug);
  if (meta) return meta.serviceId;
  return null;
}

/** Clinical missing-page gaps only when clinical dictionaries are active. */
export function resolveClinicalMissingServicePages(opts: {
  clinicalServiceDetectionEnabled: boolean;
  detectedClinicalServiceIds?: string[];
}): string[] {
  if (!opts.clinicalServiceDetectionEnabled) return [];
  const detected = new Set((opts.detectedClinicalServiceIds || []).map(normalizeServiceId));
  return CLINICAL_PHARMACY_SERVICE_PATTERNS.filter((p) => !detected.has(normalizeServiceId(p.id)))
    .map((p) => p.name)
    .slice(0, 12);
}

function displayNameForId(serviceId: string, fallback?: string): string {
  const libName = fallback?.trim();
  if (libName) return libName;
  const meta = getServicePublishMeta(serviceId);
  if (meta?.serviceName) return meta.serviceName;
  return serviceId
    .split("-")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function readClassification(profile: ReturnType<typeof readSetupProfile>): {
  className: string | null;
  clinicalEnabled: boolean;
} {
  const intel = (profile.websiteImportSnapshot?.intelligence || {}) as Record<string, unknown>;
  const bc = (intel.businessClassification || {}) as Record<string, unknown>;
  const className = typeof bc.class === "string" ? bc.class : null;
  const clinicalEnabled = bc.clinicalServiceDetectionEnabled === true;
  return { className, clinicalEnabled };
}

export function isClinicalCatalogueEligible(opts: {
  clinicalServiceDetectionEnabled: boolean;
  businessClassificationClass?: string | null;
  configuredServiceIds?: string[];
}): boolean {
  if (opts.clinicalServiceDetectionEnabled) return true;
  const cls = String(opts.businessClassificationClass || "");
  if (cls === "community_pharmacy" || cls === "retail_pharmacy") return true;
  if (cls === "digital_agency" || cls === "supplier" || cls === "agency") return false;
  const configured = opts.configuredServiceIds || [];
  if (configured.length && configured.every((id) => !isClinicalPharmacyServiceId(id))) return false;
  if (configured.some((id) => isClinicalPharmacyServiceId(id))) return true;
  return false;
}

function loadConfiguredServices(slug: string, profile: ReturnType<typeof readSetupProfile>): ConfiguredServiceInput[] {
  const out = new Map<string, ConfiguredServiceInput>();
  let lib: PharmacyServiceLibrary | null = null;
  try {
    lib = loadPharmacyServiceLibrary(slug);
  } catch {
    lib = null;
  }
  if (lib?.services?.length) {
    for (const svc of lib.services) {
      if (!svc.selected && !(lib.selectedServices || []).includes(svc.id)) continue;
      const id = normalizeServiceId(svc.id);
      out.set(id, {
        serviceId: id,
        serviceName: svc.serviceName || displayNameForId(id),
        source: "service-library",
      });
    }
  }
  for (const idRaw of profile.priorityServices || []) {
    const id = normalizeServiceId(String(idRaw));
    if (!id || out.has(id)) continue;
    out.set(id, {
      serviceId: id,
      serviceName: displayNameForId(id),
      source: "priorityServices",
    });
  }
  const delivery = profile.serviceDeliveryProfiles || {};
  const prioritySet = new Set((profile.priorityServices || []).map((id) => normalizeServiceId(String(id))));
  for (const idRaw of Object.keys(delivery)) {
    const id = normalizeServiceId(idRaw);
    if (!id || out.has(id)) continue;
    // Delivery profiles may retain historical clinical residue — only extend configured set from
    // priorityServices / service-library, never from selectedServices alone.
    if (!prioritySet.has(id)) continue;
    const name = delivery[idRaw]?.serviceName;
    out.set(id, {
      serviceId: id,
      serviceName: displayNameForId(id, name),
      source: "serviceDeliveryProfiles",
    });
  }
  return [...out.values()];
}

function loadWebsiteDiscoveredServices(profile: ReturnType<typeof readSetupProfile>): WebsiteDiscoveredServiceInput[] {
  const snap = profile.websiteImportSnapshot;
  const intel = (snap?.intelligence || {}) as Record<string, unknown>;
  const commercial = Array.isArray(intel.commercialServiceEvidence)
    ? (intel.commercialServiceEvidence as Array<Record<string, unknown>>)
    : [];
  if (commercial.length) {
    return commercial
      .map((row) => ({
        serviceId: typeof row.serviceId === "string" ? row.serviceId : undefined,
        serviceName: String(row.serviceName || "").trim(),
        sourceUrl: typeof row.sourceUrl === "string" ? row.sourceUrl : undefined,
        pageTitle: typeof row.pageTitle === "string" ? row.pageTitle : undefined,
        confidence: typeof row.confidence === "number" ? row.confidence : undefined,
        detectionMethod:
          typeof row.detectionMethod === "string"
            ? row.detectionMethod
            : typeof (row.evidence as { detectionMethod?: string } | undefined)?.detectionMethod === "string"
              ? (row.evidence as { detectionMethod: string }).detectionMethod
              : undefined,
      }))
      .filter((r) => r.serviceName);
  }
  const visible = snap?.customerVisibleServices || [];
  if (visible.length) {
    return visible.map((v) => ({
      serviceId: v.serviceId,
      serviceName: v.serviceName,
      sourceUrl: v.sourceUrl,
      confidence: v.confidence,
      detectionMethod: v.detectionMethod,
    }));
  }
  return (snap?.servicesDetected || []).map((name) => ({ serviceName: String(name) }));
}

function resolveWebsiteToConfiguredId(
  discovered: WebsiteDiscoveredServiceInput,
  configuredIds: Set<string>,
): { serviceId: string | null; certainty: "strong" | "uncertain" | "none"; reason: string } {
  const byName = resolveDeterministicServiceIdFromName(discovered.serviceName);
  if (byName && configuredIds.has(byName)) {
    return { serviceId: byName, certainty: "strong", reason: "deterministic-name-alias-to-configured" };
  }
  if (byName) {
    return { serviceId: byName, certainty: "strong", reason: "deterministic-name-alias" };
  }
  const rawId = discovered.serviceId ? normalizeServiceId(discovered.serviceId.replace(/^website:/, "")) : "";
  if (rawId && configuredIds.has(rawId)) {
    return { serviceId: rawId, certainty: "strong", reason: "normalized-website-id-to-configured" };
  }
  const discoveredNorm = normalizeServiceDisplayName(discovered.serviceName);
  for (const configuredId of configuredIds) {
    const configuredNorm = normalizeServiceDisplayName(displayNameForId(configuredId));
    if (discoveredNorm === configuredNorm) {
      return { serviceId: configuredId, certainty: "strong", reason: "exact-normalized-label" };
    }
  }
  // Uncertain: shared significant tokens but not aliased
  const discTokens = new Set(discoveredNorm.split(" ").filter((t) => t.length > 2 && !["for", "the", "and", "pharmacy", "pharmacies"].includes(t)));
  let best: { id: string; score: number } | null = null;
  for (const configuredId of configuredIds) {
    const confTokens = normalizeServiceDisplayName(displayNameForId(configuredId))
      .split(" ")
      .filter((t) => t.length > 2 && !["for", "the", "and", "pharmacy", "pharmacies"].includes(t));
    const overlap = confTokens.filter((t) => discTokens.has(t)).length;
    if (overlap >= 2) {
      const score = overlap / Math.max(confTokens.length, discTokens.size, 1);
      if (!best || score > best.score) best = { id: configuredId, score };
    }
  }
  if (best && best.score >= 0.5 && best.score < 1) {
    return { serviceId: best.id, certainty: "uncertain", reason: "token-overlap-requires-review" };
  }
  return { serviceId: null, certainty: "none", reason: "no-deterministic-match" };
}

export function buildServiceReconciliationProposal(slug: string): ServiceReconciliationProposal {
  const safe = String(slug || "").trim().toLowerCase();
  const profile = readSetupProfile(safe);
  const { className, clinicalEnabled } = readClassification(profile);
  const configuredServices = loadConfiguredServices(safe, profile);
  const configuredIds = new Set(configuredServices.map((c) => c.serviceId));
  const clinicalCatalogueEligible = isClinicalCatalogueEligible({
    clinicalServiceDetectionEnabled: clinicalEnabled,
    businessClassificationClass: className,
    configuredServiceIds: [...configuredIds],
  });

  const websiteDiscoveredServices = loadWebsiteDiscoveredServices(profile);
  const rows: ReconciledServiceRow[] = [];
  const matchedConfigured = new Set<string>();
  const excludedIncompatibleServiceIds: string[] = [];

  // Historical selectedServices residue that conflicts with classification
  for (const idRaw of profile.selectedServices || []) {
    const id = normalizeServiceId(String(idRaw));
    if (!id) continue;
    if (!clinicalCatalogueEligible && isClinicalPharmacyServiceId(id) && !configuredIds.has(id)) {
      excludedIncompatibleServiceIds.push(id);
      rows.push({
        canonicalServiceId: id,
        canonicalServiceName: displayNameForId(id),
        configuredServiceId: null,
        configuredServiceName: null,
        websiteDiscoveredLabel: null,
        websiteSourceUrl: null,
        websiteConfidence: null,
        websiteDetectionMethod: null,
        matchState: "INCOMPATIBLE_EXCLUDED",
        matchReason: "historical-selectedServices-incompatible-with-business-classification",
        proposedForCanonical: false,
      });
    }
  }

  for (const discovered of websiteDiscoveredServices) {
    const resolved = resolveWebsiteToConfiguredId(discovered, configuredIds);
    if (resolved.serviceId && !clinicalCatalogueEligible && isClinicalPharmacyServiceId(resolved.serviceId)) {
      excludedIncompatibleServiceIds.push(resolved.serviceId);
      rows.push({
        canonicalServiceId: resolved.serviceId,
        canonicalServiceName: displayNameForId(resolved.serviceId, discovered.serviceName),
        configuredServiceId: configuredIds.has(resolved.serviceId) ? resolved.serviceId : null,
        configuredServiceName: configuredServices.find((c) => c.serviceId === resolved.serviceId)?.serviceName || null,
        websiteDiscoveredLabel: discovered.serviceName,
        websiteSourceUrl: discovered.sourceUrl || null,
        websiteConfidence: discovered.confidence ?? null,
        websiteDetectionMethod: discovered.detectionMethod || null,
        matchState: "INCOMPATIBLE_EXCLUDED",
        matchReason: "clinical-service-incompatible-with-business-classification",
        proposedForCanonical: false,
      });
      continue;
    }

    if (resolved.certainty === "strong" && resolved.serviceId && configuredIds.has(resolved.serviceId)) {
      matchedConfigured.add(resolved.serviceId);
      const configured = configuredServices.find((c) => c.serviceId === resolved.serviceId)!;
      rows.push({
        canonicalServiceId: resolved.serviceId,
        canonicalServiceName: configured.serviceName,
        configuredServiceId: configured.serviceId,
        configuredServiceName: configured.serviceName,
        websiteDiscoveredLabel: discovered.serviceName,
        websiteSourceUrl: discovered.sourceUrl || null,
        websiteConfidence: discovered.confidence ?? null,
        websiteDetectionMethod: discovered.detectionMethod || null,
        matchState: "CONFIRMED_MATCH",
        matchReason: resolved.reason,
        proposedForCanonical: true,
      });
      continue;
    }

    if (resolved.certainty === "uncertain" && resolved.serviceId) {
      matchedConfigured.add(resolved.serviceId);
      const configured = configuredServices.find((c) => c.serviceId === resolved.serviceId);
      rows.push({
        canonicalServiceId: resolved.serviceId,
        canonicalServiceName: configured?.serviceName || discovered.serviceName,
        configuredServiceId: configured?.serviceId || null,
        configuredServiceName: configured?.serviceName || null,
        websiteDiscoveredLabel: discovered.serviceName,
        websiteSourceUrl: discovered.sourceUrl || null,
        websiteConfidence: discovered.confidence ?? null,
        websiteDetectionMethod: discovered.detectionMethod || null,
        matchState: "REQUIRES_REVIEW",
        matchReason: resolved.reason,
        proposedForCanonical: false,
      });
      continue;
    }

    if (resolved.certainty === "strong" && resolved.serviceId && !configuredIds.has(resolved.serviceId)) {
      // Deterministic id known to platform catalog but not configured for tenant
      if (!clinicalCatalogueEligible && isClinicalPharmacyServiceId(resolved.serviceId)) {
        excludedIncompatibleServiceIds.push(resolved.serviceId);
        rows.push({
          canonicalServiceId: resolved.serviceId,
          canonicalServiceName: displayNameForId(resolved.serviceId, discovered.serviceName),
          configuredServiceId: null,
          configuredServiceName: null,
          websiteDiscoveredLabel: discovered.serviceName,
          websiteSourceUrl: discovered.sourceUrl || null,
          websiteConfidence: discovered.confidence ?? null,
          websiteDetectionMethod: discovered.detectionMethod || null,
          matchState: "INCOMPATIBLE_EXCLUDED",
          matchReason: "clinical-discovery-incompatible-with-business-classification",
          proposedForCanonical: false,
        });
        continue;
      }
      rows.push({
        canonicalServiceId: resolved.serviceId,
        canonicalServiceName: displayNameForId(resolved.serviceId, discovered.serviceName),
        configuredServiceId: null,
        configuredServiceName: null,
        websiteDiscoveredLabel: discovered.serviceName,
        websiteSourceUrl: discovered.sourceUrl || null,
        websiteConfidence: discovered.confidence ?? null,
        websiteDetectionMethod: discovered.detectionMethod || null,
        matchState: "NEWLY_DISCOVERED",
        matchReason: resolved.reason,
        proposedForCanonical: false,
      });
      continue;
    }

    // No deterministic match — newly discovered under synthetic id for PO review
    const syntheticId = normalizeServiceId(
      (discovered.serviceId || discovered.serviceName).replace(/^website:/, ""),
    ) || normalizeServiceId(discovered.serviceName);
    rows.push({
      canonicalServiceId: syntheticId.startsWith("website-") ? syntheticId : `website-${syntheticId}`,
      canonicalServiceName: discovered.serviceName,
      configuredServiceId: null,
      configuredServiceName: null,
      websiteDiscoveredLabel: discovered.serviceName,
      websiteSourceUrl: discovered.sourceUrl || null,
      websiteConfidence: discovered.confidence ?? null,
      websiteDetectionMethod: discovered.detectionMethod || null,
      matchState: "NEWLY_DISCOVERED",
      matchReason: resolved.reason,
      proposedForCanonical: false,
    });
  }

  for (const configured of configuredServices) {
    if (matchedConfigured.has(configured.serviceId)) continue;
    if (!clinicalCatalogueEligible && isClinicalPharmacyServiceId(configured.serviceId)) {
      excludedIncompatibleServiceIds.push(configured.serviceId);
      rows.push({
        canonicalServiceId: configured.serviceId,
        canonicalServiceName: configured.serviceName,
        configuredServiceId: configured.serviceId,
        configuredServiceName: configured.serviceName,
        websiteDiscoveredLabel: null,
        websiteSourceUrl: null,
        websiteConfidence: null,
        websiteDetectionMethod: null,
        matchState: "INCOMPATIBLE_EXCLUDED",
        matchReason: "configured-clinical-incompatible-with-business-classification",
        proposedForCanonical: false,
      });
      continue;
    }
    rows.push({
      canonicalServiceId: configured.serviceId,
      canonicalServiceName: configured.serviceName,
      configuredServiceId: configured.serviceId,
      configuredServiceName: configured.serviceName,
      websiteDiscoveredLabel: null,
      websiteSourceUrl: null,
      websiteConfidence: null,
      websiteDetectionMethod: null,
      matchState: "CONFIGURED_NOT_CONFIRMED",
      matchReason: "configured-not-found-in-website-commercial-evidence",
      proposedForCanonical: true,
    });
  }

  // Deduplicate rows by canonicalServiceId preferring CONFIRMED_MATCH
  const rank: Record<ServiceMatchState, number> = {
    CONFIRMED_MATCH: 5,
    CONFIGURED_NOT_CONFIRMED: 4,
    REQUIRES_REVIEW: 3,
    NEWLY_DISCOVERED: 2,
    INCOMPATIBLE_EXCLUDED: 1,
  };
  const byId = new Map<string, ReconciledServiceRow>();
  for (const row of rows) {
    const prev = byId.get(row.canonicalServiceId);
    if (!prev || rank[row.matchState] > rank[prev.matchState]) byId.set(row.canonicalServiceId, row);
  }
  const deduped = [...byId.values()].sort((a, b) => a.canonicalServiceName.localeCompare(b.canonicalServiceName));

  const proposedCanonicalServiceIds = deduped
    .filter((r) => r.proposedForCanonical && r.matchState !== "INCOMPATIBLE_EXCLUDED")
    .map((r) => r.canonicalServiceId);

  const approvedCanonicalServiceIds = readApprovedCanonicalServiceIds(safe, profile);
  const downstreamTrusted = Boolean(approvedCanonicalServiceIds?.length) && isProfileReviewApproved(safe);
  const trustedDownstreamServiceIds = downstreamTrusted
    ? [...approvedCanonicalServiceIds!]
    : [];

  return {
    slug: safe,
    websiteSnapshotImportedAt: profile.websiteImportSnapshot?.importedAt || null,
    businessClassificationClass: className,
    clinicalServiceDetectionEnabled: clinicalEnabled,
    clinicalCatalogueEligible,
    configuredServices,
    websiteDiscoveredServices,
    rows: deduped,
    proposedCanonicalServiceIds,
    excludedIncompatibleServiceIds: [...new Set(excludedIncompatibleServiceIds)],
    approvedCanonicalServiceIds,
    trustedDownstreamServiceIds,
    downstreamTrusted,
  };
}

function readApprovedCanonicalServiceIds(
  slug: string,
  profile: ReturnType<typeof readSetupProfile>,
): string[] | null {
  const confirmations = (profile.profileFieldConfirmations || {}) as Record<string, unknown>;
  const approved = confirmations.approvedCanonicalServiceIds;
  if (Array.isArray(approved) && approved.length) {
    return approved.map((id) => normalizeServiceId(String(id))).filter(Boolean);
  }
  if (!isProfileReviewApproved(slug)) return null;
  return null;
}

/**
 * Trusted downstream service identity gate.
 * Before PO approval: empty (not trusted). After approval with stored approved IDs: those IDs.
 * Follow-up: persist approvedCanonicalServiceIds on service/profile approval.
 */
export function resolveTrustedCanonicalServiceIds(slug: string): string[] {
  return buildServiceReconciliationProposal(slug).trustedDownstreamServiceIds;
}

/** Filter profile-collected IDs so incompatible clinical residue cannot contaminate non-clinical tenants. */
export function filterServiceIdsForBusinessContext(
  serviceIds: string[],
  opts: { clinicalCatalogueEligible: boolean },
): string[] {
  if (opts.clinicalCatalogueEligible) return [...new Set(serviceIds.map(normalizeServiceId).filter(Boolean))];
  return [...new Set(serviceIds.map(normalizeServiceId).filter((id) => id && !isClinicalPharmacyServiceId(id)))];
}

export function resolveActiveServiceIdsForTenant(slug: string): string[] {
  const proposal = buildServiceReconciliationProposal(slug);
  if (proposal.downstreamTrusted) return proposal.trustedDownstreamServiceIds;
  // Pre-approval: proposed commercial identity only (excludes incompatible). Not "trusted" for strategy execution.
  return proposal.proposedCanonicalServiceIds;
}

export function listWizardServicesForTenant(slug: string): { serviceId: string; serviceName: string }[] {
  const proposal = buildServiceReconciliationProposal(slug);
  if (proposal.clinicalCatalogueEligible) {
    return BENCHMARK_MASTER_SERVICE_IDS.map((id) => {
      const meta = getServicePublishMeta(id);
      return { serviceId: id, serviceName: meta?.serviceName || id };
    });
  }
  const rows = proposal.rows.filter((r) => r.matchState !== "INCOMPATIBLE_EXCLUDED");
  const byId = new Map<string, { serviceId: string; serviceName: string }>();
  for (const row of rows) {
    const id = row.configuredServiceId || row.canonicalServiceId;
    if (id.startsWith("website-")) continue;
    byId.set(id, { serviceId: id, serviceName: row.canonicalServiceName });
  }
  for (const cfg of proposal.configuredServices) {
    if (!isClinicalPharmacyServiceId(cfg.serviceId)) {
      byId.set(cfg.serviceId, { serviceId: cfg.serviceId, serviceName: cfg.serviceName });
    }
  }
  return [...byId.values()].sort((a, b) => a.serviceName.localeCompare(b.serviceName));
}

export function formatServiceMatchStateLabel(state: ServiceMatchState): string {
  switch (state) {
    case "CONFIRMED_MATCH":
      return "CONFIRMED MATCH";
    case "CONFIGURED_NOT_CONFIRMED":
      return "CONFIGURED — NOT CONFIRMED BY WEBSITE";
    case "NEWLY_DISCOVERED":
      return "NEWLY DISCOVERED";
    case "REQUIRES_REVIEW":
      return "REQUIRES REVIEW";
    case "INCOMPATIBLE_EXCLUDED":
      return "INCOMPATIBLE / EXCLUDED";
    default:
      return state;
  }
}
