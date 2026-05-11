// IA Phase 23 — server-side technical criteria evaluator.
//
// CLAUDE.md Madde O — teknik kalite kuralları (DPI, resolution,
// format, aspect ratio, transparency) provider çağrısı gerektirmez.
// Server asset metadata'sını okur, kuralı uygular, fail edenleri
// risk flag olarak ekler. Provider tarafı semantic kriterleri
// dönerken bu modül technical kriterleri ekler; worker iki listeyi
// birleştirir ve compute scoring breakdown'u beraber çalıştırır.

import type {
  ReviewComposeContext,
  ReviewCriterion,
  TechnicalRule,
} from "@/providers/review/criteria";
import { isCriterionApplicable } from "@/providers/review/criteria";
import type {
  ReviewRiskFlag,
  TechnicalReviewFlagType,
} from "@/providers/review/types";

export type TechnicalAssetSnapshot = {
  /** Image format (mime sub-type, lowercase). */
  format: string;
  width: number | null;
  height: number | null;
  dpi: number | null;
  /** Sharp probe; null on legacy rows. */
  hasAlpha: boolean | null;
};

/** Evaluate a single technical rule against an asset snapshot.
 *  Returns the failure reason (English) when the rule fails;
 *  null when it passes or cannot be evaluated. */
function evaluateRule(
  rule: TechnicalRule,
  asset: TechnicalAssetSnapshot,
): string | null {
  switch (rule.kind) {
    case "min_dpi": {
      if (asset.dpi == null) return null; // Unknown DPI → defer
      if (asset.dpi < rule.minDpi) {
        return `DPI ${asset.dpi} is below the required minimum (${rule.minDpi}).`;
      }
      return null;
    }
    case "min_resolution": {
      if (asset.width == null || asset.height == null) return null;
      const minSide = Math.min(asset.width, asset.height);
      if (minSide < rule.minMinSidePx) {
        return `Smaller side ${minSide}px is below the required minimum (${rule.minMinSidePx}px).`;
      }
      return null;
    }
    case "format_whitelist": {
      if (!rule.allowed.includes(asset.format)) {
        return `Format "${asset.format}" is not in the allowed list (${rule.allowed.join(", ")}).`;
      }
      return null;
    }
    case "aspect_ratio": {
      if (
        asset.width == null ||
        asset.height == null ||
        asset.height === 0
      ) {
        return null;
      }
      const actual = asset.width / asset.height;
      if (Math.abs(actual - rule.target) > rule.tolerance) {
        return `Aspect ratio ${actual.toFixed(3)} does not match target ${rule.target.toFixed(3)} (±${rule.tolerance}).`;
      }
      return null;
    }
    case "transparency_required": {
      if (asset.hasAlpha === false) {
        return "Asset does not carry an alpha channel; transparent target requires one.";
      }
      return null;
    }
  }
}

/**
 * Run every active, applicable technical criterion against the
 * asset snapshot. Returns risk flags for the failures (same shape
 * as provider response so the merged list goes through the same
 * scoring breakdown).
 */
export function runTechnicalEvaluation(args: {
  criteria: ReadonlyArray<ReviewCriterion>;
  ctx: ReviewComposeContext;
  asset: TechnicalAssetSnapshot;
}): ReviewRiskFlag[] {
  const { criteria, ctx, asset } = args;
  const flags: ReviewRiskFlag[] = [];
  for (const c of criteria) {
    if (c.family !== "technical") continue;
    if (!c.technicalRule) continue;
    if (!isCriterionApplicable(c, ctx)) continue;
    const reason = evaluateRule(c.technicalRule, asset);
    if (reason) {
      flags.push({
        kind: c.id as TechnicalReviewFlagType as never,
        confidence: 1,
        reason,
      });
    }
  }
  return flags;
}
