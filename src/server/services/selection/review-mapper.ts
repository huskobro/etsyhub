// Phase 7 Task 16 — Phase 6 review mapper layer (READ-ONLY köprü).
//
// Bu mapper Phase 6 entity'lerinden (`GeneratedDesign`, `DesignReview`)
// okuyarak Selection Studio'nun AI Kalite paneli için view-model üretir
// (`ReviewView` — design Section 3.2). PURE fonksiyon: DB I/O yok, side
// effect yok; tüm input argümandan gelir.
//
// Sözleşmeler (plan Task 16, design Section 7.4):
//
//   1. "Review yok" kanonik shape: `null` döner. Phase 7
//      `SelectionItemView.review` opsiyonel — UI bu null durumu için
//      "henüz review yok" stati gösterir.
//
//   2. Score önceliği: `designReview.score` → `generatedDesign.reviewScore`
//      → `0` (fallback). 0-100 arasında sınırlanır.
//
//   3. Status: `designReview.decision` → `generatedDesign.reviewStatus`.
//      `ReviewStatus` enum string'e map edilir (lowercase + underscore).
//      Bilinmeyen değer → `"pending"` (graceful fallback).
//
//   4. Signals — risk flag aggregation:
//        - textDetection: `text_detected` | `gibberish_text_detected`
//          flag'i veya `generatedDesign.textDetected/gibberishDetected`
//          true → `"issue"`; aksi `"clean"`.
//        - artifactCheck: `transparent_edge_artifact` | `no_alpha_channel`
//          flag → `"issue"`; aksi `"clean"`.
//        - trademarkRisk: `watermark_detected` | `signature_detected` |
//          `visible_logo_detected` | `celebrity_face_detected` flag →
//          `"high"`; aksi `"low"`.
//        - resolution: `qualityScore` null → `"unknown"`; >= 60 → `"ok"`;
//          < 60 → `"low"`.
//
//   5. Defensive parsing: `issues` Json field runtime'da malformed olabilir.
//      Array değilse boş, array içinde non-flag obje skip — silently
//      degrade.
//
// READ-ONLY DİSİPLİN: Bu modül Phase 6 type'larını YALNIZ okur. Phase 6
// schema değişirse mapper güncellenir; aksi yön asla.

import type { DesignReview, GeneratedDesign } from "@prisma/client";
import { ReviewStatus } from "@prisma/client";
import type { ReviewRiskFlagType } from "@/providers/review/types";
import type { ReviewView } from "./types";

// ────────────────────────────────────────────────────────────
// Risk flag → signal kategorisi eşlemeleri (single source of truth)
// ────────────────────────────────────────────────────────────

const TEXT_FLAGS: ReadonlySet<ReviewRiskFlagType> = new Set([
  "text_detected",
  "gibberish_text_detected",
]);

const ARTIFACT_FLAGS: ReadonlySet<ReviewRiskFlagType> = new Set([
  "transparent_edge_artifact",
  "no_alpha_channel",
]);

const TRADEMARK_FLAGS: ReadonlySet<ReviewRiskFlagType> = new Set([
  "watermark_detected",
  "signature_detected",
  "visible_logo_detected",
  "celebrity_face_detected",
]);

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/**
 * Json field'ı flag listesine güvenli parse eder. Phase 6 `issues` /
 * `reviewIssues` kaynakları runtime'da malformed olabilir (legacy rowlar,
 * provider hatası, vb.). Array değil veya parse fail → boş array.
 *
 * Array içindeki her eleman `{ type: ReviewRiskFlagType }` shape'i kontrol
 * edilir; geçerli olmayan elementler silently skip edilir (defensive).
 */
function parseFlagTypes(raw: unknown): Set<ReviewRiskFlagType> {
  const result = new Set<ReviewRiskFlagType>();
  if (!Array.isArray(raw)) return result;
  for (const entry of raw) {
    if (entry === null || typeof entry !== "object") continue;
    const candidate = (entry as { type?: unknown }).type;
    if (typeof candidate !== "string") continue;
    // Type guard — single source of truth `REVIEW_RISK_FLAG_TYPES`
    // ile sözleşmeli. Bilinmeyen string skip.
    if (
      candidate === "text_detected" ||
      candidate === "gibberish_text_detected" ||
      candidate === "transparent_edge_artifact" ||
      candidate === "no_alpha_channel" ||
      candidate === "watermark_detected" ||
      candidate === "signature_detected" ||
      candidate === "visible_logo_detected" ||
      candidate === "celebrity_face_detected"
    ) {
      result.add(candidate);
    }
  }
  return result;
}

function mapStatus(decision: ReviewStatus | null | undefined): string {
  switch (decision) {
    case ReviewStatus.APPROVED:
      return "approved";
    case ReviewStatus.NEEDS_REVIEW:
      return "needs_review";
    case ReviewStatus.REJECTED:
      return "rejected";
    case ReviewStatus.PENDING:
      return "pending";
    default:
      return "pending";
  }
}

function clampScore(raw: number): number {
  return Math.max(0, Math.min(100, Math.trunc(raw)));
}

function mapResolution(qualityScore: number | null | undefined): string {
  if (typeof qualityScore !== "number") return "unknown";
  return qualityScore >= 60 ? "ok" : "low";
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Phase 6 review entity'lerini Selection Studio AI Kalite view-model'ine
 * dönüştürür. "Review yok" durumu kanonik olarak `null` döner.
 *
 * Pure fonksiyon — DB roundtrip yok, side effect yok.
 */
export function mapReviewToView(args: {
  generatedDesign: GeneratedDesign | null;
  designReview: DesignReview | null;
}): ReviewView | null {
  const { generatedDesign, designReview } = args;

  // 1. Kanonik "review yok": iki kaynak da yok.
  if (generatedDesign === null && designReview === null) return null;

  // 2. Generated design var ama hiç review yapılmamış (PENDING + reviewedAt
  //    null + designReview null) — UI "henüz review yok" stati. null döner.
  if (
    designReview === null &&
    generatedDesign !== null &&
    generatedDesign.reviewedAt === null
  ) {
    return null;
  }

  // 3. Score: designReview.score → gd.reviewScore → 0
  let score = 0;
  if (designReview && typeof designReview.score === "number") {
    score = clampScore(designReview.score);
  } else if (
    generatedDesign &&
    typeof generatedDesign.reviewScore === "number"
  ) {
    score = clampScore(generatedDesign.reviewScore);
  }

  // 4. Status: designReview.decision → gd.reviewStatus
  const status = mapStatus(
    designReview?.decision ?? generatedDesign?.reviewStatus ?? null,
  );

  // 5. Risk flags: önce designReview.issues, sonra gd.reviewIssues fallback.
  //    İkisi de varsa designReview kaynak (canonical).
  const flagSource =
    designReview?.issues !== null && designReview?.issues !== undefined
      ? designReview.issues
      : (generatedDesign?.reviewIssues ?? null);
  const flagTypes = parseFlagTypes(flagSource);

  // 6. Signal aggregation
  const hasTextFlag = [...flagTypes].some((f) => TEXT_FLAGS.has(f));
  const hasArtifactFlag = [...flagTypes].some((f) => ARTIFACT_FLAGS.has(f));
  const hasTrademarkFlag = [...flagTypes].some((f) => TRADEMARK_FLAGS.has(f));

  const textDetectionDenorm =
    generatedDesign?.textDetected === true ||
    generatedDesign?.gibberishDetected === true;

  const signals = {
    resolution: mapResolution(generatedDesign?.qualityScore ?? null),
    textDetection: hasTextFlag || textDetectionDenorm ? "issue" : "clean",
    artifactCheck: hasArtifactFlag ? "issue" : "clean",
    trademarkRisk: hasTrademarkFlag ? "high" : "low",
  };

  return { score, status, signals };
}
