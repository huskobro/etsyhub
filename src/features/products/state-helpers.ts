// R5 — Product (Listing model) stage derivation + display helpers.
//
// CLAUDE.md disiplini gereği "Product" UI konseptini schema'daki `Listing`
// üzerine bindiriyoruz — yeni model yok, additive view layer. Listing
// statüleri (DRAFT/SCHEDULED/PUBLISHED/FAILED/REJECTED/NEEDS_REVIEW)
// B4 design statülerine 1:1 eşlenir:
//
//   DRAFT          → "Draft"          (henüz Etsy'ye gitmemiş)
//   DRAFT + mockup → "Mockup ready"   (mockupJobId var ama submit yok)
//   SCHEDULED      → "Etsy-bound"     (zamanlanmış)
//   PUBLISHED      → "Sent"           (Etsy'de draft oluştu)
//   FAILED         → "Failed"         (submit başarısız)
//   REJECTED       → "Failed"         (Etsy reject)
//   NEEDS_REVIEW   → "Mockup ready"   (insan onayı bekleyen)
//
// Bu eşleme yalnız UI tarafında; service/route Listing.status enum'unu
// olduğu gibi kullanmaya devam eder. CLAUDE.md "no parallel patterns"
// disiplini: yeni status enum eklenmedi.
//
// Stage CTA mapping (B4 table satırı):
//   Draft         · "Open"             secondary
//   Mockup ready  · "Open"             secondary
//   Etsy-bound    · "Open"             secondary
//   Sent          · "Open Etsy draft"  ghost (etsyListingId ile deep-link)
//   Failed        · "Retry"            ghost-danger

import type { ListingStatus } from "@prisma/client";
import type { BadgeTone } from "@/components/ui/Badge";

export type ProductStage =
  | "Draft"
  | "Mockup ready"
  | "Etsy-bound"
  | "Sent"
  | "Failed";

export interface ProductStageInput {
  status: ListingStatus;
  mockupJobId: string | null;
  coverRenderId: string | null;
  etsyListingId: string | null;
}

export function deriveProductStage(input: ProductStageInput): ProductStage {
  if (input.status === "FAILED" || input.status === "REJECTED") return "Failed";
  if (input.status === "PUBLISHED") return "Sent";
  if (input.status === "SCHEDULED") return "Etsy-bound";
  // DRAFT / NEEDS_REVIEW — mockup orchestration tamamlandıysa "Mockup ready",
  // yoksa "Draft".
  if (input.mockupJobId && input.coverRenderId) return "Mockup ready";
  return "Draft";
}

const STAGE_BADGE_TONE: Record<ProductStage, BadgeTone> = {
  Draft: "neutral",
  "Mockup ready": "info",
  "Etsy-bound": "info",
  Sent: "success",
  Failed: "danger",
};

export function productStageBadgeTone(stage: ProductStage): BadgeTone {
  return STAGE_BADGE_TONE[stage];
}

/**
 * Listing health hesabı — readiness check'lerinin pass oranını 0..100'e map.
 *
 * Spec §7.1 (Phase 9 V1 readiness): 6 check (title/description/tags/category/
 * price/cover) — her biri pass/fail. Health = passCount * 100 / totalCount.
 * Color mapping (A5 spec):
 *   ≥ 90 → green
 *   ≥ 80 → orange
 *   ≥ 70 → amber
 *   <  70 → red
 */
export function listingHealthScore(
  readiness: { pass: boolean }[],
): number {
  if (readiness.length === 0) return 0;
  const passCount = readiness.filter((r) => r.pass).length;
  return Math.round((passCount * 100) / readiness.length);
}

export function listingHealthTone(
  score: number,
): "green" | "orange" | "amber" | "red" {
  if (score >= 90) return "green";
  if (score >= 80) return "orange";
  if (score >= 70) return "amber";
  return "red";
}

/**
 * Digital file format derivation — outputKey/file uzantısından format çıkarma.
 *
 * Phase 9 V1'de file delivery yalnızca mockup render'larından (PNG/JPG) +
 * ZIP bundle (henüz auto-generate yok; UI surface ileride). R5 kapsamında
 * mockup render'ların outputKey'lerinden format türeterek "ne teslim ediyor"
 * sinyalini yansıtırız.
 *
 * `image/png` / `image/jpeg` MIME map'lerine de cevap verir; mockup pipeline
 * şu an PNG default.
 */
export type DeliverableFormat = "ZIP" | "PNG" | "PDF" | "JPG" | "JPEG";

const ALLOWED_FORMATS: ReadonlyArray<DeliverableFormat> = [
  "ZIP",
  "PNG",
  "PDF",
  "JPG",
  "JPEG",
];

export function detectFormat(filename: string): DeliverableFormat | null {
  const m = filename.match(/\.(zip|png|pdf|jpe?g)(\?.*)?$/i);
  if (!m || !m[1]) return null;
  const ext = m[1].toUpperCase();
  if (ext === "JPEG") return "JPEG";
  if (ext === "JPG") return "JPG";
  if ((ALLOWED_FORMATS as ReadonlyArray<string>).includes(ext)) {
    return ext as DeliverableFormat;
  }
  return null;
}
