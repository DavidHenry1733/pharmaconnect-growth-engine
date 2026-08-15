/**
 * CPR-PRODUCT-OWNER-GENERATION-01 — Product Owner controlled generation/regeneration.
 * Master Admin orchestration only. Does not modify Content Engine / Locality Engine.
 * Does not auto-approve or auto-publish. Does not generate unless a PO-triggered job runs.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";
import {
  readPharmacyCampaignStore,
  writePharmacyCampaignStore,
  type CampaignAreaEntry,
  type PharmacyCampaign,
} from "./pharmacyCampaignService.ts";
import { resolveProfileCampaignAreas } from "./pharmacyAreaDiscoveryService.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import {
  CPR_DASHBOARD_INITIATION_SOURCE,
  assertServicePageGenerationAllowed,
  isServicePageGeneratedForIdentity,
  readServicePageGenerationRecord,
  resolveServicePageGenerationIdentity,
  writeServicePageGenerationRecord,
} from "./masterAdminCoreProductRecoveryService.ts";
import { evaluateServicePageGenerationReadiness } from "./masterAdminServicePageGenerationReadinessService.ts";
import {
  getMasterAdminJob,
  listMasterAdminJobs,
  runMasterAdminJobAsync,
  updateMasterAdminJob,
  type MasterAdminJob,
} from "./masterAdminJobService.ts";
import { queueServicePageOnlyJob, SERVICE_PAGE_ONLY_SCOPE } from "./masterAdminServicePageJobService.ts";
import {
  createLocalClusterPagesJob,
  LOCAL_CLUSTER_JOB_ACTION,
} from "./masterAdminLocalClusterJobService.ts";
import { selectCampaignBuilderService } from "./growthEngineCampaignBuilderService.ts";

export const REGENERATE_SERVICE_PAGE_ACTION = "regenerate_service_page" as const;
export const REGENERATE_LOCALITY_PAGE_ACTION = "regenerate_local_cluster_page" as const;
export const REGENERATE_ALL_LOCALITY_PAGES_ACTION = "regenerate_all_local_cluster_pages" as const;

function safeSlug(slug: string): string {
  return resolveTenantProfileSlug(slug) || slug;
}

function freezeFilePath(slug: string, serviceId: string): string {
  return path.join(
    WORKSPACE_ROOT,
    "data/growth-engine",
    `${safeSlug(slug)}-campaign-generation-context-${serviceId}.json`,
  );
}

function toAreaSlug(areaName: string): string {
  return slugifyArea(String(areaName || "").trim());
}

function normalizeCampaignAreas(areas: CampaignAreaEntry[]): CampaignAreaEntry[] {
  return (areas || [])
    .map((a, idx) => ({
      areaName: String(a.areaName || "").trim(),
      selected: a.selected !== false,
      source: String(a.source || "product-owner-selection").trim() || "product-owner-selection",
      priority: typeof a.priority === "number" ? a.priority : 50 + idx,
    }))
    .filter((a) => a.areaName);
}

/** Persist campaign-owned locality list + freeze file used by existing hierarchy resolver. */
export function updatePharmacyCampaignLocalitySelection(
  slug: string,
  campaignId: string,
  areas: CampaignAreaEntry[],
): { ok: boolean; error?: string; campaign?: PharmacyCampaign; freezePath?: string } {
  const s = safeSlug(slug);
  const store = readPharmacyCampaignStore(s);
  if (!store) return { ok: false, error: "campaign_store_not_found" };
  const idx = store.campaigns.findIndex((c) => c.id === campaignId);
  if (idx < 0) return { ok: false, error: "campaign_not_found" };

  const campaign = store.campaigns[idx]!;
  const normalized = normalizeCampaignAreas(areas);
  if (!normalized.some((a) => a.selected !== false)) {
    return { ok: false, error: "at_least_one_locality_required" };
  }

  const next: PharmacyCampaign = {
    ...campaign,
    areaSource: "custom",
    campaignAreas: normalized,
  };
  store.campaigns[idx] = next;
  store.updatedAt = new Date().toISOString();
  writePharmacyCampaignStore(store);

  const selected = normalized.filter((a) => a.selected !== false);
  const freezePath = freezeFilePath(s, campaign.serviceId);
  const existing = fs.existsSync(freezePath)
    ? (JSON.parse(fs.readFileSync(freezePath, "utf8")) as Record<string, unknown>)
    : {};
  const payload = {
    ...existing,
    version: existing.version || "1.0.0",
    frozenAt: new Date().toISOString(),
    slug: s,
    serviceId: campaign.serviceId,
    campaignId,
    targetAreas: selected.map((a) => a.areaName),
    generationContext: {
      ...((existing.generationContext as Record<string, unknown>) || {}),
      selectedAreas: selected.map((a, order) => ({
        areaName: a.areaName,
        areaSlug: toAreaSlug(a.areaName),
        selected: true,
        order: order + 1,
        priority: a.priority,
      })),
    },
    sourceRefs: {
      ...((existing.sourceRefs as Record<string, unknown>) || {}),
      localitySelectionUpdatedAt: new Date().toISOString(),
      localitySelectionSource: "product_owner_dashboard",
    },
  };
  fs.mkdirSync(path.dirname(freezePath), { recursive: true });
  fs.writeFileSync(freezePath, JSON.stringify(payload, null, 2), "utf8");

  return { ok: true, campaign: next, freezePath };
}

export function buildCampaignLocalitySelectionDashboard(
  slug: string,
  campaignId: string,
): {
  ok: boolean;
  error?: string;
  campaignId?: string;
  serviceId?: string;
  serviceName?: string;
  areaSource?: string;
  selectedAreas?: CampaignAreaEntry[];
  availableAreas?: CampaignAreaEntry[];
  hasLocalPages?: boolean;
  canGenerateLocalities?: boolean;
} {
  const s = safeSlug(slug);
  const store = readPharmacyCampaignStore(s);
  const campaign = store?.campaigns.find((c) => c.id === campaignId);
  if (!campaign) return { ok: false, error: "campaign_not_found" };

  const profileAreas = resolveProfileCampaignAreas(s);
  const availableMap = new Map<string, CampaignAreaEntry>();
  for (const a of [...profileAreas, ...(campaign.campaignAreas || [])]) {
    const key = toAreaSlug(a.areaName);
    if (!key) continue;
    availableMap.set(key, {
      areaName: a.areaName,
      selected: false,
      source: a.source || "profile",
      priority: a.priority ?? 50,
    });
  }
  const selectedKeys = new Set(
    (campaign.campaignAreas || [])
      .filter((a) => a.selected !== false)
      .map((a) => toAreaSlug(a.areaName)),
  );
  const availableAreas = [...availableMap.values()].map((a) => ({
    ...a,
    selected: selectedKeys.has(toAreaSlug(a.areaName)),
  }));

  const ecoRoot = path.join(
    WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    s,
    campaign.serviceId,
    "local",
  );
  const hasLocalPages =
    fs.existsSync(ecoRoot) &&
    fs.readdirSync(ecoRoot, { withFileTypes: true }).some((d) => d.isDirectory() && d.name !== "locations");

  const identity = resolveServicePageGenerationIdentity(s, campaign.serviceId, campaign.id);
  const serviceGenerated = isServicePageGeneratedForIdentity(s, identity.serviceId, identity.campaignId);

  return {
    ok: true,
    campaignId: campaign.id,
    serviceId: campaign.serviceId,
    serviceName: campaign.serviceName,
    areaSource: campaign.areaSource,
    selectedAreas: (campaign.campaignAreas || []).filter((a) => a.selected !== false),
    availableAreas,
    hasLocalPages,
    canGenerateLocalities: serviceGenerated && availableAreas.some((a) => a.selected),
  };
}

export function snapshotServicePageRevision(slug: string, serviceId: string): string | null {
  const s = safeSlug(slug);
  const livePath = path.join(WORKSPACE_ROOT, "output/pharmacy-visual-experience", s, serviceId, "index.html");
  if (!fs.existsSync(livePath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const revDir = path.join(
    WORKSPACE_ROOT,
    "output/pharmacy-visual-experience",
    s,
    serviceId,
    "revisions",
    stamp,
  );
  fs.mkdirSync(revDir, { recursive: true });
  const revPath = path.join(revDir, "index.html");
  fs.copyFileSync(livePath, revPath);
  return revPath;
}

export function snapshotLocalityRevision(
  slug: string,
  serviceId: string,
  areaSlug: string,
): string | null {
  const s = safeSlug(slug);
  const livePath = path.join(
    WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    s,
    serviceId,
    "local",
    areaSlug,
    "index.html",
  );
  if (!fs.existsSync(livePath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const revDir = path.join(
    WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    s,
    serviceId,
    "local",
    areaSlug,
    "revisions",
    stamp,
  );
  fs.mkdirSync(revDir, { recursive: true });
  const revPath = path.join(revDir, "index.html");
  fs.copyFileSync(livePath, revPath);
  return revPath;
}

function findActiveJob(
  slug: string,
  actions: string[],
  serviceId?: string,
): MasterAdminJob | null {
  return (
    listMasterAdminJobs({ slug, limit: 20 }).find(
      (j) =>
        actions.includes(j.action) &&
        (!serviceId || !j.serviceId || j.serviceId === serviceId) &&
        (j.status === "queued" || j.status === "claimed" || j.status === "running"),
    ) || null
  );
}

export function confirmProductOwnerServicePageGeneration(
  slug: string,
  operator: string,
  options: {
    operatorConfirmed?: boolean;
    initiationSource?: string;
    regenerate?: boolean;
  } = {},
): { ok: boolean; error?: string; jobId?: string; blockers?: string[]; regenerate?: boolean } {
  if (options.initiationSource !== CPR_DASHBOARD_INITIATION_SOURCE) {
    return {
      ok: false,
      error: "dashboard_only_required",
      blockers: ["Service page generation must be initiated from the Product Owner dashboard"],
    };
  }
  if (options.operatorConfirmed !== true) {
    return { ok: false, error: "confirmation_required", blockers: ["Product Owner confirmation required"] };
  }

  const identity = resolveServicePageGenerationIdentity(slug);
  const serviceId = identity.serviceId;
  const campaignId = identity.campaignId;
  const already = isServicePageGeneratedForIdentity(slug, serviceId, campaignId);
  const regenerate = options.regenerate === true;

  if (already && !regenerate) {
    return {
      ok: false,
      error: "service_page_already_generated",
      blockers: ["Service page already generated — use Regenerate Service Page"],
    };
  }
  if (!already && regenerate) {
    return {
      ok: false,
      error: "service_page_not_generated",
      blockers: ["Generate the service page before regenerating"],
    };
  }

  if (!regenerate) {
    const gate = assertServicePageGenerationAllowed(slug, serviceId, campaignId);
    if (!gate.ok) return { ok: false, error: gate.error, blockers: gate.blockers };
  } else {
    const readiness = evaluateServicePageGenerationReadiness(slug, serviceId);
    if (!readiness.canGenerateEvidence) {
      return { ok: false, error: "evidence_incomplete", blockers: readiness.blockers };
    }
  }

  const active = findActiveJob(
    slug,
    ["generate_service_page", REGENERATE_SERVICE_PAGE_ACTION],
    serviceId,
  );
  if (active) {
    if (active.status === "queued") {
      runMasterAdminJobAsync(active.id, active.executionPayload || {});
    }
    return { ok: true, jobId: active.id, regenerate };
  }

  if (regenerate) {
    snapshotServicePageRevision(slug, serviceId);
    const record = readServicePageGenerationRecord(slug, serviceId, campaignId);
    if (record) {
      writeServicePageGenerationRecord({
        ...record,
        status: "queued",
        generationError: null,
      });
    }
  }

  const job = queueServicePageOnlyJob({
    slug,
    operator,
    serviceId,
    campaignId: campaignId || undefined,
    executionPayload: {
      operatorConfirmed: true,
      scope: SERVICE_PAGE_ONLY_SCOPE,
      initiationSource: CPR_DASHBOARD_INITIATION_SOURCE,
      serviceId,
      campaignId,
      generationType: "service-page",
      regenerate,
      preservePreviousRevision: regenerate,
      autoApprove: false,
      autoPublish: false,
    },
  });

  if (regenerate) {
    updateMasterAdminJob(job.id, {
      progressLabel: "Queued regeneration",
    });
  }

  return { ok: true, jobId: job.id, regenerate };
}

export function queueProductOwnerLocalityGeneration(
  slug: string,
  operator: string,
  options: {
    operatorConfirmed?: boolean;
    initiationSource?: string;
    mode: "generate_all" | "regenerate_all" | "regenerate_one";
    areaSlug?: string;
    campaignId?: string;
    serviceId?: string;
  },
): { ok: boolean; error?: string; jobId?: string; blockers?: string[] } {
  if (options.initiationSource !== CPR_DASHBOARD_INITIATION_SOURCE) {
    return {
      ok: false,
      error: "dashboard_only_required",
      blockers: ["Locality generation must be initiated from the Product Owner dashboard"],
    };
  }
  if (options.operatorConfirmed !== true) {
    return { ok: false, error: "confirmation_required", blockers: ["Product Owner confirmation required"] };
  }

  const identity = resolveServicePageGenerationIdentity(
    slug,
    options.serviceId,
    options.campaignId,
  );
  const serviceId = identity.serviceId;
  const campaignId = identity.campaignId;

  if (!isServicePageGeneratedForIdentity(slug, serviceId, campaignId)) {
    return {
      ok: false,
      error: "service_page_required",
      blockers: ["Generate and review the service page before locality generation"],
    };
  }

  if (options.mode === "regenerate_one" && !String(options.areaSlug || "").trim()) {
    return { ok: false, error: "area_slug_required", blockers: ["Select a locality to regenerate"] };
  }

  const active = findActiveJob(
    slug,
    [
      LOCAL_CLUSTER_JOB_ACTION,
      REGENERATE_LOCALITY_PAGE_ACTION,
      REGENERATE_ALL_LOCALITY_PAGES_ACTION,
    ],
    serviceId,
  );
  if (active) {
    return {
      ok: false,
      error: "job_already_running",
      blockers: [`A locality job is already ${active.status}`],
      jobId: active.id,
    };
  }

  selectCampaignBuilderService(slug, serviceId);

  if (options.mode === "regenerate_one" && options.areaSlug) {
    snapshotLocalityRevision(slug, serviceId, options.areaSlug);
  } else if (options.mode === "regenerate_all") {
    const localRoot = path.join(
      WORKSPACE_ROOT,
      "output/pharmacy-content-ecosystem",
      safeSlug(slug),
      serviceId,
      "local",
    );
    if (fs.existsSync(localRoot)) {
      for (const ent of fs.readdirSync(localRoot, { withFileTypes: true })) {
        if (ent.isDirectory() && ent.name !== "locations") {
          snapshotLocalityRevision(slug, serviceId, ent.name);
        }
      }
    }
  }

  const action =
    options.mode === "regenerate_one"
      ? REGENERATE_LOCALITY_PAGE_ACTION
      : options.mode === "regenerate_all"
        ? REGENERATE_ALL_LOCALITY_PAGES_ACTION
        : LOCAL_CLUSTER_JOB_ACTION;

  const job = createLocalClusterPagesJob({
    slug,
    operator,
    serviceId,
    campaignId: campaignId || undefined,
    executionPayload: {
      operatorConfirmed: true,
      initiationSource: CPR_DASHBOARD_INITIATION_SOURCE,
      serviceId,
      campaignId,
      regenerateMode: options.mode,
      onlyAreaSlug: options.areaSlug || null,
      preservePreviousRevision: options.mode !== "generate_all",
      autoApprove: false,
      autoPublish: false,
    },
  });
  updateMasterAdminJob(job.id, {
    action,
    progressLabel:
      options.mode === "regenerate_one"
        ? `Queued regenerate ${options.areaSlug}`
        : options.mode === "regenerate_all"
          ? "Queued regenerate all localities"
          : "Queued generate localities",
  });
  runMasterAdminJobAsync(job.id, job.executionPayload || {});
  return { ok: true, jobId: job.id };
}

export function getProductOwnerGenerationJobStatus(jobId: string): MasterAdminJob | null {
  return getMasterAdminJob(jobId);
}
