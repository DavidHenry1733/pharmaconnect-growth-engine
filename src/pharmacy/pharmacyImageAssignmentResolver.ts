/**
 * Unified pharmacy image resolution — assignment → upload → AI → library fallback.
 */
import {
  resolvePharmacyImageForSlot,
  type ImageMatrixSlot,
} from "./pharmacyImageOperatingSystem.ts";
import { isPharmacyFirstProductionLibraryReady } from "./imagePlatform/pharmacyImagePlatformProductionResolver.ts";
import {
  resolvePharmacySlotImage,
  type PharmacyImageRenderContext,
  type PharmacyImageSlot,
  type ResolvedPharmacyImage,
} from "./templates/pharmacyImageLibrary.ts";

export function resolvePharmacyImageWithAssignments(
  slug: string,
  slot: PharmacyImageSlot,
  ctx: PharmacyImageRenderContext,
  assignmentSlot: ImageMatrixSlot = slot as ImageMatrixSlot,
  options?: { assignmentOnly?: boolean },
): ResolvedPharmacyImage {
  const assignmentOnly =
    options?.assignmentOnly ??
    (ctx.serviceKey === "pharmacy-first" && isPharmacyFirstProductionLibraryReady());
  const resolved = resolvePharmacyImageForSlot(slug, ctx.serviceKey, assignmentSlot, ctx, { assignmentOnly });
  return { ...resolved, slot };
}

export function resolvePharmacyPageSlotImages(
  slug: string,
  ctx: PharmacyImageRenderContext,
): Record<PharmacyImageSlot, ResolvedPharmacyImage> {
  const slots: PharmacyImageSlot[] = ["hero", "support", "trust", "conversion"];
  return Object.fromEntries(
    slots.map((s) => [s, resolvePharmacyImageWithAssignments(slug, s, ctx)]),
  ) as Record<PharmacyImageSlot, ResolvedPharmacyImage>;
}

/** Library-only resolution (no per-pharmacy assignments). */
export function resolvePharmacyLibrarySlotImage(
  slot: PharmacyImageSlot,
  ctx: PharmacyImageRenderContext,
): ResolvedPharmacyImage {
  return resolvePharmacySlotImage(slot, ctx);
}
