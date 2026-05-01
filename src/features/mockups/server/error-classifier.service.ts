// Phase 8 Task 11 — 5-class error classifier (Spec §7.1).
//
// Worker (Task 7) ve render service (Task 18) tarafından kullanılır.
// Task 7'deki minimal classifier (4-class regex match) bu service'e taşınır
// + 5-class tam sözlük (SOURCE_QUALITY + SAFE_AREA_OVERFLOW eklenir).
//
// Sıra önemli: specific → general. AbortError + timeout önce; custom error
// classes (SafeAreaOverflow, SourceQuality) ZodError'dan önce; ZodError +
// asset errors orta; default PROVIDER_DOWN.
//
// Spec §7.1 sözlüğü:
//   - TEMPLATE_INVALID  → swap (retry işe yaramaz)
//   - RENDER_TIMEOUT    → retry + swap (transient)
//   - SOURCE_QUALITY    → swap + Phase 7 link
//   - SAFE_AREA_OVERFLOW→ swap (farklı template)
//   - PROVIDER_DOWN     → retry (transient)
//
// Phase 7 emsali: src/features/mockups/server/handoff.service.ts custom
// error class export pattern (SetNotFoundError, InvalidSetError, vs).
// Burada AppError extend etmiyoruz çünkü classifier'ın HTTP map'leme
// sorumluluğu yok — yalnız MockupErrorClass enum dönmesi gerekiyor.

import { ZodError } from "zod";
import type { MockupErrorClass } from "@prisma/client";

// ────────────────────────────────────────────────────────────
// Custom error classes — Spec §7.1 SAFE_AREA_OVERFLOW + SOURCE_QUALITY
// ────────────────────────────────────────────────────────────

/**
 * Pre-validation veya runtime safe area overflow — design safeArea'ya
 * sığmıyor (resolution çok küçük, aspect mismatch runtime detect, vs).
 *
 * Worker veya pack-selection bu hatayı fırlatır; classifier
 * SAFE_AREA_OVERFLOW dönsün diye `name` üzerinden detect eder.
 *
 * Spec §7.1: tetikleyici "Design safeArea'ya sığmıyor, runtime'da
 * pre-validation fail"; worker eylemi "swap (farklı template)".
 */
export class SafeAreaOverflowError extends Error {
  override name = "SafeAreaOverflowError";
  constructor(message: string) {
    super(message);
  }
}

/**
 * Design asset bozuk (resolution, format, alpha kanal) — Sharp metadata
 * read fail veya min dimension check fail senaryoları.
 *
 * Spec §7.1: tetikleyici "Design asset bozuk (resolution, format), Phase 7
 * review tag (low_resolution gibi)"; worker eylemi "swap + Phase 7 link".
 *
 * Phase 7 review heuristics (low_resolution / corrupted_alpha) runtime'da
 * render adımında tekrar yakalanırsa bu error fırlatılır.
 */
export class SourceQualityError extends Error {
  override name = "SourceQualityError";
  constructor(message: string) {
    super(message);
  }
}

// ────────────────────────────────────────────────────────────
// Classifier — Spec §7.1 5-class
// ────────────────────────────────────────────────────────────

/**
 * Spec §7.1: 5-class hata sözlüğü classify.
 *
 * Tetikleyici sırası (specific → general; sıra önemli):
 *   1. AbortError veya `/timeout/i.test` → RENDER_TIMEOUT
 *   2. SafeAreaOverflowError name match → SAFE_AREA_OVERFLOW
 *   3. SourceQualityError name match → SOURCE_QUALITY
 *   4. ZodError (instanceof veya name) → TEMPLATE_INVALID
 *   5. /NOT_IMPLEMENTED/ veya /PROVIDER_NOT_CONFIGURED/ → PROVIDER_DOWN
 *   6. /TEMPLATE_INVALID|asset.*not found|baseAssetKey|invalid provider
 *      config/i → TEMPLATE_INVALID
 *   7. /unsupported image|metadata missing|min dimension/i → SOURCE_QUALITY
 *   8. default → PROVIDER_DOWN
 *
 * Order disiplini: SafeAreaOverflowError önce ZodError'dan kontrol edilir
 * çünkü name match güvenilirdir, generic ZodError catch-all'a düşmez.
 * Aynı şekilde NOT_IMPLEMENTED specific message match TEMPLATE_INVALID
 * regex'inden önce gelir.
 */
export function classifyRenderError(err: unknown): MockupErrorClass {
  if (err instanceof Error) {
    // 1. RENDER_TIMEOUT — AbortSignal trigger, Sharp execution > 60s cap,
    //    BullMQ stalled.
    if (err.name === "AbortError" || /timeout/i.test(err.message)) {
      return "RENDER_TIMEOUT";
    }

    // 2. SAFE_AREA_OVERFLOW (custom error class) — design safeArea'ya
    //    sığmıyor.
    if (err.name === "SafeAreaOverflowError") {
      return "SAFE_AREA_OVERFLOW";
    }

    // 3. SOURCE_QUALITY (custom error class) — design asset bozuk.
    if (err.name === "SourceQualityError") {
      return "SOURCE_QUALITY";
    }

    // 4. TEMPLATE_INVALID — ZodError (Zod parse fail, LocalSharpConfig
    //    invalid). instanceof + name fallback (cross-realm güvenilirliği).
    if (err instanceof ZodError || err.name === "ZodError") {
      return "TEMPLATE_INVALID";
    }

    // 5. PROVIDER_DOWN — implementation/config eksiği (Sharp NOT_IMPLEMENTED
    //    throw, default fallback). Specific message match TEMPLATE_INVALID
    //    regex'inden önce gelmeli.
    if (
      /NOT_IMPLEMENTED/.test(err.message) ||
      /PROVIDER_NOT_CONFIGURED/.test(err.message)
    ) {
      return "PROVIDER_DOWN";
    }

    // 6. TEMPLATE_INVALID — asset key MinIO'da yok, binding config eksik
    //    field'lar, baseAssetKey eksik.
    if (
      /TEMPLATE_INVALID/.test(err.message) ||
      /asset.*not\s*found/i.test(err.message) ||
      /baseAssetKey/i.test(err.message) ||
      /invalid[\s_]*provider[\s_]*config/i.test(err.message)
    ) {
      return "TEMPLATE_INVALID";
    }

    // 7. SOURCE_QUALITY — Sharp metadata read fail, format unsupported,
    //    min dimension check fail.
    if (
      /unsupported\s*image/i.test(err.message) ||
      /metadata.*missing/i.test(err.message) ||
      /min\s*dimension/i.test(err.message)
    ) {
      return "SOURCE_QUALITY";
    }
  }

  // 8. default — PROVIDER_DOWN (non-Error value veya yakalanamayan Error).
  return "PROVIDER_DOWN";
}
