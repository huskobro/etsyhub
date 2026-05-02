// Phase 9 V1 Task 8 — Listing readiness service (foundation slice).
//
// Compute readiness checks for draft listing.
// V1: 6 soft warns (title, description, tags, category, price, cover).
// K3 lock: severity always "warn", no failure blocks (soft gate).
//
// Spec §7 (readiness checks) + §3.1.3 (UI soft warn semantics).

import type { Listing } from "@prisma/client";
import type { ReadinessCheck, ListingImageOrderEntry } from "../types";
import { checkNegativeLibrary } from "./negative-library.service";

// ────────────────────────────────────────────────────────────
// Readiness Rules (V1 soft warn)
// ────────────────────────────────────────────────────────────

const TITLE_MIN_LEN = 5;
const TITLE_MAX_LEN = 140;
const DESCRIPTION_MIN_LEN = 1;
const TAGS_COUNT = 13;
const PRICE_MIN_CENTS = 100; // $1.00 minimum

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

/**
 * Compute readiness checks for listing (V1: soft warns).
 *
 * Returns array of 6+ checks (6 baseline + 0..N negative library matches):
 *   1. title: min 5, max 140 chars
 *   2. description: non-empty
 *   3. tags: exactly 13 tags
 *   4. category: non-empty
 *   5. price: >= 100 cents ($1.00)
 *   6. cover: imageOrderJson[0].isCover = true (Phase 8 handoff guarantee)
 *   7+. negative library matches (Task 12): policy/trademark/spam uyarıları
 *
 * V1 spec (K3): All severity = "warn" (soft gate).
 * Severity "error" reserved for V1.1 hard gate / Task 17.
 *
 * @param listing Draft listing (may have null/empty metadata)
 * @returns ReadinessCheck[] (baseline 6 items + 0..N negative library matches)
 */
export function computeReadiness(listing: Listing): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];

  // 1. Title check
  const titleLen = listing.title?.trim().length ?? 0;
  checks.push({
    field: "title",
    pass: titleLen >= TITLE_MIN_LEN && titleLen <= TITLE_MAX_LEN,
    severity: "warn",
    message:
      titleLen === 0
        ? `Title başlığı gereklidir (${TITLE_MIN_LEN}-${TITLE_MAX_LEN} karakter)`
        : titleLen < TITLE_MIN_LEN
          ? `Title çok kısa (en az ${TITLE_MIN_LEN} karakter gerekli, şu an ${titleLen})`
          : `Title çok uzun (maksimum ${TITLE_MAX_LEN} karakter, şu an ${titleLen})`,
  });

  // 2. Description check
  const descLen = listing.description?.trim().length ?? 0;
  checks.push({
    field: "description",
    pass: descLen > 0,
    severity: "warn",
    message:
      descLen === 0
        ? "Açıklama (description) gereklidir"
        : "Açıklama hazır",
  });

  // 3. Tags check (exactly 13)
  const tagsCount = listing.tags?.length ?? 0;
  checks.push({
    field: "tags",
    pass: tagsCount === TAGS_COUNT,
    severity: "warn",
    message:
      tagsCount === 0
        ? `${TAGS_COUNT} tag gereklidir`
        : tagsCount < TAGS_COUNT
          ? `${tagsCount}/${TAGS_COUNT} tag (${TAGS_COUNT - tagsCount} eksik)`
          : `${tagsCount} tag (maksimum ${TAGS_COUNT})`,
  });

  // 4. Category check
  checks.push({
    field: "category",
    pass: !!listing.category && listing.category.trim().length > 0,
    severity: "warn",
    message: listing.category ? "Kategori seçildi" : "Kategori seçimi gereklidir",
  });

  // 5. Price check
  checks.push({
    field: "price",
    pass:
      listing.priceCents !== null &&
      listing.priceCents !== undefined &&
      listing.priceCents >= PRICE_MIN_CENTS,
    severity: "warn",
    message:
      !listing.priceCents || listing.priceCents === 0
        ? `Fiyat gereklidir (minimum ${PRICE_MIN_CENTS} cent = $${(PRICE_MIN_CENTS / 100).toFixed(2)})`
        : listing.priceCents < PRICE_MIN_CENTS
          ? `Fiyat çok düşük (minimum ${PRICE_MIN_CENTS} cent)`
          : `Fiyat: $${(listing.priceCents / 100).toFixed(2)}`,
  });

  // 6. Cover image check
  const imageOrder = (listing.imageOrderJson as ListingImageOrderEntry[] | null) ?? [];
  const hasCover = imageOrder.length > 0 && imageOrder[0]?.isCover === true;
  checks.push({
    field: "cover",
    pass: hasCover,
    severity: "warn",
    message: hasCover
      ? `Kapak görseli hazır (${imageOrder[0]?.templateName ?? "Bilinmeyen"})`
      : "Kapak görselü (cover image) gereklidir (mockup'tan generate edilmeli)",
  });

  // 7. Negative library check (Task 12)
  // K3 lock soft warn — submit blocked DEĞİL, sadece UI uyarısı.
  const negativeMatches = checkNegativeLibrary({
    title: listing.title,
    description: listing.description,
    tags: listing.tags,
  });

  for (const match of negativeMatches) {
    checks.push({
      field: match.field,
      pass: false,
      severity: "warn",
      message: `Politika uyarısı: "${match.phrase}" ifadesi (${match.field}) — ${match.reason}`,
    });
  }

  return checks;
}

/**
 * Helper: check if all readiness checks pass.
 * V1 usage: UI summary (how many warn/pass).
 */
export function allReadinessPass(checks: ReadinessCheck[]): boolean {
  return checks.every((c) => c.pass);
}

/**
 * Helper: filter checks by severity.
 * V1: all "warn"; V1.1/V2: mix of "warn" + "error".
 */
export function filterChecksBySeverity(
  checks: ReadinessCheck[],
  severity: "warn" | "error",
): ReadinessCheck[] {
  return checks.filter((c) => c.severity === severity);
}
