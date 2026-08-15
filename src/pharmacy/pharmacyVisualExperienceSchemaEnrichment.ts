/**
 * CPR-RB01-V1 — Enrich visual service page JSON-LD for Commercial Page Contract (renderer output only).
 */
import type { ServicePageFaqLike } from "./pharmacyFaqAlignment.ts";
import { syncSchemaFaqs } from "./pharmacyFaqAlignment.ts";

export interface VisualServicePageSchemaContext {
  serviceName: string;
  pharmacyName: string;
  town: string;
  pageUrl: string;
  metaDescription: string;
  website: string;
}

function schemaGraphNodes(schema: Record<string, unknown>): Record<string, unknown>[] {
  const graph = schema["@graph"];
  if (Array.isArray(graph)) {
    return graph.filter((n) => n && typeof n === "object") as Record<string, unknown>[];
  }
  return [schema];
}

function nodeTypes(node: Record<string, unknown>): string[] {
  const t = node["@type"];
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x) => typeof x === "string") as string[];
  return [];
}

function graphHasType(nodes: Record<string, unknown>[], type: string): boolean {
  return nodes.some((n) => nodeTypes(n).includes(type));
}

export function enrichVisualServicePageSchemaDocument(
  schema: Record<string, unknown>,
  ctx: VisualServicePageSchemaContext,
  faqs: ServicePageFaqLike[],
): Record<string, unknown> {
  const normalized: Record<string, unknown> = Array.isArray(schema["@graph"])
    ? { ...schema }
    : {
        "@context": schema["@context"] || "https://schema.org",
        "@graph": [schema],
      };

  const graph = [...schemaGraphNodes(normalized)];

  if (!graphHasType(graph, "Service")) {
    graph.push({
      "@type": "Service",
      name: ctx.serviceName,
      serviceType: ctx.serviceName,
      description: ctx.metaDescription,
      areaServed: { "@type": "Place", name: ctx.town },
      provider: {
        "@type": "MedicalBusiness",
        name: ctx.pharmacyName,
        url: ctx.website || ctx.pageUrl,
      },
    });
  }

  if (!graphHasType(graph, "BreadcrumbList")) {
    const homeUrl = (ctx.website || ctx.pageUrl).replace(/\/$/, "") || ctx.pageUrl;
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: ctx.pharmacyName, item: `${homeUrl}/` },
        { "@type": "ListItem", position: 2, name: ctx.serviceName, item: ctx.pageUrl },
      ],
    });
  }

  if (!graphHasType(graph, "FAQPage")) {
    graph.push({ "@type": "FAQPage", mainEntity: [] });
  }

  normalized["@graph"] = graph;
  normalized["@context"] = "https://schema.org";

  const faqSource = faqs.length ? faqs : [];
  return (syncSchemaFaqs(normalized, faqSource) as Record<string, unknown>) || normalized;
}

export function parseFirstJsonLdScript(schemaScriptsHtml: string): Record<string, unknown> | null {
  const match = schemaScriptsHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function serializeJsonLdScript(doc: Record<string, unknown>): string {
  const json = JSON.stringify(doc).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}
