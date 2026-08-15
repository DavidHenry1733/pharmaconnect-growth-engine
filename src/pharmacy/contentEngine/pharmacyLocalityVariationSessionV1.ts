/**
 * Generation-session state for cross-locality uniqueness (Content Engine V1).
 */
import type { LocalityPageStrategyId } from "./pharmacyLocalityPageStrategyV1.ts";

export type LocalityVariationSessionV1 = {
  usedStrategies: Set<LocalityPageStrategyId>;
  forceStrategyBySlug: Map<string, LocalityPageStrategyId>;
  areaIndexBySlug: Map<string, number>;
  strategyBySlug: Map<string, LocalityPageStrategyId>;
};

let active: LocalityVariationSessionV1 | null = null;

export function beginLocalityVariationSessionV1(areaSlugs: string[] = []): LocalityVariationSessionV1 {
  active = {
    usedStrategies: new Set(),
    forceStrategyBySlug: new Map(),
    areaIndexBySlug: new Map(areaSlugs.map((slug, i) => [slug, i])),
    strategyBySlug: new Map(),
  };
  return active;
}

export function getLocalityVariationSessionV1(): LocalityVariationSessionV1 | null {
  return active;
}

export function endLocalityVariationSessionV1(): void {
  active = null;
}

export function rememberStrategyForSlug(slug: string, strategy: LocalityPageStrategyId): void {
  if (!active) return;
  active.strategyBySlug.set(slug, strategy);
  active.usedStrategies.add(strategy);
}
