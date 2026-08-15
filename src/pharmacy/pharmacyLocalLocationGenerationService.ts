/**
 * RC1 local location generation — cluster pages only (one per approved area).
 */
import fs from "node:fs";
import path from "node:path";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import type { EcosystemAsset, GenerationStamp, LocalClusterLinkEntry } from "./benchmarkServiceEcosystemBuilder.ts";
import { getEcosystemRoot } from "./contentEngine/contentEnginePaths.ts";
import {
  hierarchyToContentGenerationAreas,
  resolveLocalLocationHierarchy,
  type LocalLocationHierarchy,
} from "./pharmacyLocalAreaResolver.ts";
import {
  resolveClusterPageSlug,
  resolveClusterPageUrlPath,
  resolveClusterPageFilesystemRelativePath,
  rewriteClusterLinksInHtml,
} from "./pharmacyClusterPageUrlResolver.ts";
import {
  renderLocalLocationClusterFullPage,
  renderLocalLocationHubFullPage,
} from "./pharmacyLocalHierarchyFullPageRenderer.ts";
import { scrubPublicLocalEngineHtml } from "./pharmacyLocalClusterCompositionDedupe.ts";
import { polishCommercialClusterPublicHtml } from "./contentEngine/pharmacyCommercialNarrativePolishV1.ts";
import {
  beginLocalityVariationSessionV1,
  endLocalityVariationSessionV1,
} from "./contentEngine/pharmacyLocalityVariationSessionV1.ts";
import { nextStrategyCandidate } from "./contentEngine/pharmacyLocalityPageStrategyV1.ts";
import {
  copySimilarityScore,
  normalizeCopyForSimilarity,
} from "./pharmacyLocalClusterVariantFamilies.ts";

function extractMainText(html: string): string {
  const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || html;
  return main
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripSharedLegalPhrases(text: string): string {
  return text
    .replace(
      /sore throat,? earache,? impetigo,? infected insect bites,? shingles,? sinusitis,? and uncomplicated UTI in eligible women/gi,
      " ",
    )
    .replace(
      /breathing difficulties,? chest pain,? severe dehydration,? confusion,? a non-blanching rash,? or any emergency symptoms that make you feel critically unwell/gi,
      " ",
    )
    .replace(/patient group directions?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function headingSequenceKey(html: string, areaNames: string[]): string {
  const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || html;
  let joined = [...main.matchAll(/<h2>([^<]+)<\/h2>/gi)]
    .map((m) => m[1]!.toLowerCase().trim())
    .join(" | ");
  for (const area of areaNames) {
    joined = joined.replace(new RegExp(area.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "{area}");
  }
  return joined;
}

function localitySimilarityScore(aHtml: string, bHtml: string, areaNames: string[], pharmacyName: string): number {
  const na = normalizeCopyForSimilarity(stripSharedLegalPhrases(extractMainText(aHtml)), areaNames, pharmacyName);
  const nb = normalizeCopyForSimilarity(stripSharedLegalPhrases(extractMainText(bHtml)), areaNames, pharmacyName);
  return copySimilarityScore(na, nb);
}

export interface LocalLocationGenerationResult {
  ok: boolean;
  blockedReason?: string;
  hierarchy: LocalLocationHierarchy;
  assets: EcosystemAsset[];
  localClusterEntries: LocalClusterLinkEntry[];
  hubPath?: string;
  clusterPaths: string[];
  areaPaths: string[];
}

function countWords(html: string): number {
  return html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
}

export function generateLocalLocationHierarchyPages(ctx: ContentGenerationContext): LocalLocationGenerationResult {
  const hierarchy = resolveLocalLocationHierarchy(ctx.resolvedSlug, ctx.serviceId, ctx.rawProfile);
  if (!hierarchy.ok) {
    return {
      ok: false,
      blockedReason: hierarchy.blockedReason,
      hierarchy,
      assets: [],
      localClusterEntries: [],
      clusterPaths: [],
      areaPaths: [],
    };
  }

  const ecosystemRoot = ctx.links.ecosystemRoot;
  const generatedAt = new Date().toISOString();
  const generationStamp: GenerationStamp = {
    tenantSlug: ctx.resolvedSlug,
    campaignId: ctx.serviceId,
    generatedAt,
    sourceContext: "customer-imported-profile",
  };

  const assets: EcosystemAsset[] = [];
  const localClusterEntries: LocalClusterLinkEntry[] = [];
  const clusterPaths: string[] = [];
  const areaPaths: string[] = [];

  const writeLocal = (relPath: string, html: string): string => {
    const outPath = path.join(ecosystemRoot, relPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, "utf8");
    return outPath;
  };

  const clusterSlugs = hierarchy.clusters.map((c) => resolveClusterPageSlug(c.slug));
  const generationRevision = `cpr-content-hotfix-04-${generatedAt}`;
  const session = beginLocalityVariationSessionV1(clusterSlugs);
  const areaNames = hierarchy.clusters.map((c) => c.name);
  const pharmacyName = ctx.profile.pharmacyName;

  const renderClusterHtml = (cluster: (typeof hierarchy.clusters)[number]): string => {
    const pageSlug = resolveClusterPageSlug(cluster.slug);
    const siblingNames = hierarchy.clusters
      .filter((c) => c.slug !== cluster.slug)
      .map((c) => c.name);
    return polishCommercialClusterPublicHtml(
      scrubPublicLocalEngineHtml(
        rewriteClusterLinksInHtml(
          renderLocalLocationClusterFullPage(ctx, hierarchy, { ...cluster, slug: pageSlug }),
          clusterSlugs,
        ),
      ),
      {
        areaName: cluster.name,
        pharmacyName,
        serviceName: ctx.serviceName,
        nearbyAreaNames: siblingNames,
        generationRevision,
      },
    );
  };

  const htmlBySlug = new Map<string, string>();
  for (const cluster of hierarchy.clusters) {
    const pageSlug = resolveClusterPageSlug(cluster.slug);
    htmlBySlug.set(pageSlug, renderClusterHtml(cluster));
  }

  // Cross-page duplicate gate — commercial threshold: normalised similarity must stay below 70%.
  const SIM_FAIL = 0.7;
  const faqKey = (html: string) =>
    [...html.matchAll(/class="faq-q">([^<]+)/g)]
      .map((m) => m[1]!.toLowerCase().replace(/\s+/g, " ").trim())
      .join("|");
  const ctaKey = (html: string) => {
    const h2 = (html.match(/data-template-block="final-cta"[\s\S]*?<h2>([^<]+)/i) || [])[1] || "";
    const prompt = (html.match(/data-template-block="final-cta"[\s\S]*?<p class="[^"]*">([\s\S]*?)<\/p>/i) || [])[1] || "";
    return normalizeCopyForSimilarity(`${h2} ${prompt}`, areaNames, pharmacyName);
  };
  for (let pass = 0; pass < 5; pass++) {
    const slugs = [...htmlBySlug.keys()];
    let rebuilt = false;
    for (let i = 0; i < slugs.length; i++) {
      for (let j = i + 1; j < slugs.length; j++) {
        const a = slugs[i]!;
        const b = slugs[j]!;
        const score = localitySimilarityScore(htmlBySlug.get(a)!, htmlBySlug.get(b)!, areaNames, pharmacyName);
        const sameHeadings =
          headingSequenceKey(htmlBySlug.get(a)!, areaNames) ===
          headingSequenceKey(htmlBySlug.get(b)!, areaNames);
        const sameFaqs =
          normalizeCopyForSimilarity(faqKey(htmlBySlug.get(a)!), areaNames, pharmacyName) ===
          normalizeCopyForSimilarity(faqKey(htmlBySlug.get(b)!), areaNames, pharmacyName);
        const sameCta = ctaKey(htmlBySlug.get(a)!) === ctaKey(htmlBySlug.get(b)!);
        if (score < SIM_FAIL && !sameHeadings && !sameFaqs && !sameCta) continue;
        const rebuildSlug = a === "headingley" ? b : a;
        if (rebuildSlug === "headingley") continue;
        const current = session.strategyBySlug.get(rebuildSlug);
        if (!current) continue;
        const next = nextStrategyCandidate(current, session.usedStrategies);
        session.forceStrategyBySlug.set(rebuildSlug, next);
        session.usedStrategies.delete(current);
        const cluster = hierarchy.clusters.find((c) => resolveClusterPageSlug(c.slug) === rebuildSlug);
        if (!cluster) continue;
        htmlBySlug.set(rebuildSlug, renderClusterHtml(cluster));
        rebuilt = true;
      }
    }
    if (!rebuilt) break;
  }

  for (const cluster of hierarchy.clusters) {
    const pageSlug = resolveClusterPageSlug(cluster.slug);
    const html = htmlBySlug.get(pageSlug) || renderClusterHtml(cluster);
    const rel = resolveClusterPageFilesystemRelativePath(pageSlug);
    const out = writeLocal(rel, html);
    clusterPaths.push(out);
    const urlPath = resolveClusterPageUrlPath(pageSlug);
    localClusterEntries.push({
      areaName: cluster.name,
      areaSlug: pageSlug,
      urlPath,
      outputPath: path.relative(ecosystemRoot, out),
      nearbyAreas: hierarchy.clusters
        .filter((c) => c.areaId !== cluster.areaId)
        .map((c) => {
          const nearbySlug = resolveClusterPageSlug(c.slug);
          return {
            areaName: c.name,
            areaSlug: nearbySlug,
            urlPath: resolveClusterPageUrlPath(nearbySlug),
          };
        }),
    });
    assets.push({
      id: `local-cluster-${pageSlug}`,
      type: "Cluster page",
      urlPath,
      outputPath: out,
      sourceSections: [
        "local-location-cluster",
        cluster.name,
        "rc1-cluster-page",
        session.strategyBySlug.get(pageSlug) || "strategy",
      ],
      wordCount: countWords(html),
    });
  }

  endLocalityVariationSessionV1();

  const linkMap = {
    slug: ctx.resolvedSlug,
    serviceId: ctx.serviceId,
    mainServiceUrlPath: ctx.serviceMeta.urlPath,
    serviceHubUrlPath: ctx.serviceMeta.urlPath,
    localClusterPages: localClusterEntries,
    localLocationClusters: hierarchy.clusters.map((c) => {
      const pageSlug = resolveClusterPageSlug(c.slug);
      return {
        areaName: c.name,
        areaSlug: pageSlug,
        urlPath: resolveClusterPageUrlPath(pageSlug),
        outputPath: resolveClusterPageFilesystemRelativePath(pageSlug),
      };
    }),
    localLocationHierarchy: hierarchy,
    architecture: "rc1-cluster-page-v1",
    generatedAt,
    generationStamp,
  };

  fs.mkdirSync(ecosystemRoot, { recursive: true });
  fs.writeFileSync(path.join(ecosystemRoot, "_internal-link-map.json"), JSON.stringify(linkMap, null, 2), "utf8");

  return {
    ok: true,
    hierarchy,
    assets,
    localClusterEntries,
    clusterPaths,
    areaPaths,
  };
}

/** Regenerate location hub + cluster HTML only — does not rewrite area pages. */
export function regenerateLocalHubAndClusterPagesOnly(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
): Pick<
  LocalLocationGenerationResult,
  "ok" | "hierarchy" | "assets" | "hubPath" | "clusterPaths"
> {
  const ecosystemRoot = ctx.links.ecosystemRoot;
  const assets: EcosystemAsset[] = [];
  const clusterPaths: string[] = [];

  const writeLocal = (relPath: string, html: string): string => {
    const outPath = path.join(ecosystemRoot, relPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, "utf8");
    return outPath;
  };

  const hubHtml = scrubPublicLocalEngineHtml(renderLocalLocationHubFullPage(ctx, hierarchy));
  const hubOut = writeLocal("local/locations/index.html", hubHtml);
  assets.push({
    id: "local-location-hub",
    type: "Location overview",
    urlPath: "/locations/",
    outputPath: hubOut,
    sourceSections: ["local-location-hub", "local-hub-v1"],
    wordCount: countWords(hubHtml),
  });

  for (const cluster of hierarchy.clusters) {
    const html = renderLocalLocationClusterFullPage(ctx, hierarchy, cluster);
    const rel = `local/${cluster.slug}/index.html`;
    const out = writeLocal(rel, html);
    clusterPaths.push(out);
    assets.push({
      id: `local-cluster-${cluster.slug}`,
      type: "Location cluster",
      urlPath: `/local/${cluster.slug}/`,
      outputPath: out,
      sourceSections: ["local-location-cluster", cluster.name, "local-cluster-v1"],
      wordCount: countWords(html),
    });
  }

  return { ok: true, hierarchy, assets, hubPath: hubOut, clusterPaths };
}

/** Regenerate location area HTML only — preserves hub/cluster ecosystem files. */
export function regenerateLocalAreaPagesOnly(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  options?: { onlyAreaSlugs?: string[] },
): Pick<LocalLocationGenerationResult, "ok" | "hierarchy" | "assets" | "areaPaths"> {
  const ecosystemRoot = ctx.links.ecosystemRoot;
  const assets: EcosystemAsset[] = [];
  const areaPaths: string[] = [];
  const localClusterEntries: LocalClusterLinkEntry[] = [];

  const writeLocal = (relPath: string, html: string): string => {
    const outPath = path.join(ecosystemRoot, relPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, "utf8");
    return outPath;
  };

  for (const area of hierarchy.areas) {
    if (options?.onlyAreaSlugs?.length && !options.onlyAreaSlugs.includes(area.slug)) {
      continue;
    }
    const scopedCtx = scopeContentGenerationContextForArea(ctx, area.name);
    const nearby = hierarchy.areas
      .filter((a) => a.areaId !== area.areaId)
      .map((a) => ({
        areaName: a.name,
        areaSlug: a.slug,
        urlPath: `/local/${a.slug}/`,
      }));
    const html = renderLocalLocationAreaFullPage(scopedCtx, hierarchy, area);
    const rel = `local/${area.slug}/index.html`;
    const out = writeLocal(rel, html);
    areaPaths.push(out);
    localClusterEntries.push({
      areaName: area.name,
      areaSlug: area.slug,
      urlPath: `/local/${area.slug}/`,
      outputPath: path.relative(ecosystemRoot, out),
      nearbyAreas: nearby,
    });
    assets.push({
      id: `local-area-${area.slug}`,
      type: "Location area page",
      urlPath: `/local/${area.slug}/`,
      outputPath: out,
      sourceSections: ["local-location-area", area.name, "local-area-v1"],
      wordCount: countWords(html),
    });
  }

  const linkMapPath = path.join(ecosystemRoot, "_internal-link-map.json");
  if (fs.existsSync(linkMapPath)) {
    try {
      const linkMap = JSON.parse(fs.readFileSync(linkMapPath, "utf8")) as Record<string, unknown>;
      fs.writeFileSync(
        linkMapPath,
        JSON.stringify({ ...linkMap, localClusterPages: localClusterEntries }, null, 2),
        "utf8",
      );
    } catch {
      /* preserve map if malformed */
    }
  }

  return { ok: true, hierarchy, assets, areaPaths };
}

export function mergeLocalHubClusterAssetsIntoEcosystemIndex(
  slug: string,
  serviceId: string,
  hubClusterAssets: EcosystemAsset[],
  hierarchy: LocalLocationHierarchy,
): void {
  const ecosystemRoot = getEcosystemRoot(serviceId, slug);
  const indexPath = path.join(ecosystemRoot, "_ecosystem-index.json");
  const existing = fs.existsSync(indexPath)
    ? (JSON.parse(fs.readFileSync(indexPath, "utf8")) as Record<string, unknown>)
    : { version: 1, serviceId, slug, assets: [] as EcosystemAsset[] };

  const assets = (existing.assets as EcosystemAsset[]) || [];
  const kept = assets.filter(
    (a) =>
      a.id !== "local-location-hub" &&
      !a.id.startsWith("local-cluster-") &&
      a.type !== "Location cluster" &&
      a.type !== "Location hub",
  );
  const merged = [...kept, ...hubClusterAssets];

  fs.writeFileSync(
    indexPath,
    JSON.stringify(
      {
        ...existing,
        localLocationHubGenerated: true,
        localLocationClustersGenerated: hierarchy.clusters.length,
        localLocationHierarchy: hierarchy,
        generatedAt: new Date().toISOString(),
        assets: merged,
      },
      null,
      2,
    ),
    "utf8",
  );
}

export function mergeLocalAssetsIntoEcosystemIndex(
  slug: string,
  serviceId: string,
  localResult: LocalLocationGenerationResult,
): void {
  if (!localResult.ok) return;
  const ecosystemRoot = getEcosystemRoot(serviceId, slug);
  const indexPath = path.join(ecosystemRoot, "_ecosystem-index.json");
  const existing = fs.existsSync(indexPath)
    ? (JSON.parse(fs.readFileSync(indexPath, "utf8")) as Record<string, unknown>)
    : { version: 1, serviceId, slug, assets: [] as EcosystemAsset[] };

  const assets = (existing.assets as EcosystemAsset[]) || [];
  const withoutLocal = assets.filter(
    (a) =>
      !a.id.startsWith("local-cluster-") &&
      !a.id.startsWith("local-area-") &&
      a.id !== "local-location-hub" &&
      a.type !== "Local cluster page",
  );
  const merged = [...withoutLocal, ...localResult.assets];
  const selectedAreas = hierarchyToContentGenerationAreas(localResult.hierarchy).map((a) => a.areaName);

  fs.writeFileSync(
    indexPath,
    JSON.stringify(
      {
        ...existing,
        selectedAreas,
        localClusterPagesGenerated: localResult.localClusterEntries.length,
        localLocationHubGenerated: true,
        localLocationClustersGenerated: localResult.hierarchy.clusters.length,
        localLocationAreasGenerated: localResult.hierarchy.areas.length,
        localLocationHierarchy: localResult.hierarchy,
        generatedAt: new Date().toISOString(),
        assets: merged,
        internalLinkMap: JSON.parse(fs.readFileSync(path.join(ecosystemRoot, "_internal-link-map.json"), "utf8")),
      },
      null,
      2,
    ),
    "utf8",
  );
}

export function canonicalPageSlugForLocalUrlPath(urlPath: string): string {
  const cleaned = urlPath.replace(/^\/+|\/+$/g, "");
  if (cleaned === "local/hub" || cleaned === "local/locations" || cleaned === "locations") {
    return "locations";
  }
  const parts = cleaned.split("/").filter(Boolean);
  if (parts[0] === "local" && parts[1]) {
    const segment = resolveClusterPageSlug(parts[1]);
    return `local-${segment || parts[1]}`;
  }
  return cleaned.replace(/\//g, "-");
}
