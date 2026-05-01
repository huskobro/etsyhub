// Phase 8 Task 11 — 5-class error classifier tests.
//
// Spec §7.1: 5 hata sınıfı tam sözlük.
// Task 7'deki minimal worker.test.ts classifier testleri korunur (Task 11
// service çağrısı sayesinde aynı davranış); bu yeni dosyada 5-class tam
// kapsam + custom error classes (SafeAreaOverflowError, SourceQualityError).
//
// Order disiplini: specific → general (AbortError + timeout önce; ZodError
// + asset errors orta; default PROVIDER_DOWN). Test edge case'ler bu
// disiplini doğrular.

import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  classifyRenderError,
  SafeAreaOverflowError,
  SourceQualityError,
} from "@/features/mockups/server/error-classifier.service";

describe("classifyRenderError — Spec §7.1 5-class", () => {
  // ────────────────────────────────────────────────────────────
  // RENDER_TIMEOUT (transient — retry önerilir)
  // ────────────────────────────────────────────────────────────
  describe("RENDER_TIMEOUT", () => {
    it("AbortError → RENDER_TIMEOUT", () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      expect(classifyRenderError(err)).toBe("RENDER_TIMEOUT");
    });

    it("'timeout' message → RENDER_TIMEOUT", () => {
      expect(classifyRenderError(new Error("Request timeout"))).toBe(
        "RENDER_TIMEOUT",
      );
    });

    it("'TIMEOUT' uppercase → RENDER_TIMEOUT (case insensitive)", () => {
      expect(classifyRenderError(new Error("OPERATION TIMEOUT"))).toBe(
        "RENDER_TIMEOUT",
      );
    });
  });

  // ────────────────────────────────────────────────────────────
  // SAFE_AREA_OVERFLOW (custom error class)
  // ────────────────────────────────────────────────────────────
  describe("SAFE_AREA_OVERFLOW", () => {
    it("SafeAreaOverflowError → SAFE_AREA_OVERFLOW", () => {
      expect(
        classifyRenderError(
          new SafeAreaOverflowError("Design too small for safeArea"),
        ),
      ).toBe("SAFE_AREA_OVERFLOW");
    });

    it("SafeAreaOverflowError'ın name property doğru", () => {
      const err = new SafeAreaOverflowError("test");
      expect(err.name).toBe("SafeAreaOverflowError");
    });
  });

  // ────────────────────────────────────────────────────────────
  // SOURCE_QUALITY (custom class + message heuristics)
  // ────────────────────────────────────────────────────────────
  describe("SOURCE_QUALITY", () => {
    it("SourceQualityError → SOURCE_QUALITY", () => {
      expect(
        classifyRenderError(new SourceQualityError("Design alpha corrupt")),
      ).toBe("SOURCE_QUALITY");
    });

    it("'unsupported image' message → SOURCE_QUALITY", () => {
      expect(classifyRenderError(new Error("unsupported image format"))).toBe(
        "SOURCE_QUALITY",
      );
    });

    it("'metadata missing' message → SOURCE_QUALITY", () => {
      expect(classifyRenderError(new Error("Image metadata missing"))).toBe(
        "SOURCE_QUALITY",
      );
    });

    it("'min dimension' message → SOURCE_QUALITY", () => {
      expect(
        classifyRenderError(new Error("min dimension 100x100 required")),
      ).toBe("SOURCE_QUALITY");
    });
  });

  // ────────────────────────────────────────────────────────────
  // TEMPLATE_INVALID (Zod + asset missing + provider config)
  // ────────────────────────────────────────────────────────────
  describe("TEMPLATE_INVALID", () => {
    it("ZodError (instanceof) → TEMPLATE_INVALID", () => {
      const schema = z.object({ x: z.string() });
      try {
        schema.parse({ x: 42 });
        expect.fail("should throw");
      } catch (zErr) {
        expect(classifyRenderError(zErr)).toBe("TEMPLATE_INVALID");
      }
    });

    it("ZodError name match (loose) → TEMPLATE_INVALID", () => {
      const z = new Error("validation failed");
      z.name = "ZodError";
      expect(classifyRenderError(z)).toBe("TEMPLATE_INVALID");
    });

    it("'TEMPLATE_INVALID' message → TEMPLATE_INVALID", () => {
      expect(
        classifyRenderError(new Error("TEMPLATE_INVALID: missing field")),
      ).toBe("TEMPLATE_INVALID");
    });

    it("'asset not found' message → TEMPLATE_INVALID", () => {
      expect(classifyRenderError(new Error("Asset not found in MinIO"))).toBe(
        "TEMPLATE_INVALID",
      );
    });

    it("'baseAssetKey' message → TEMPLATE_INVALID", () => {
      expect(classifyRenderError(new Error("baseAssetKey invalid"))).toBe(
        "TEMPLATE_INVALID",
      );
    });

    it("'invalid provider config' message → TEMPLATE_INVALID", () => {
      expect(
        classifyRenderError(
          new Error("INVALID_PROVIDER_CONFIG: expected local-sharp"),
        ),
      ).toBe("TEMPLATE_INVALID");
    });
  });

  // ────────────────────────────────────────────────────────────
  // PROVIDER_DOWN (transient + default fallback)
  // ────────────────────────────────────────────────────────────
  describe("PROVIDER_DOWN", () => {
    it("NOT_IMPLEMENTED → PROVIDER_DOWN", () => {
      expect(
        classifyRenderError(
          new Error("NOT_IMPLEMENTED: Sharp render Task 9-10"),
        ),
      ).toBe("PROVIDER_DOWN");
    });

    it("PROVIDER_NOT_CONFIGURED → PROVIDER_DOWN", () => {
      expect(
        classifyRenderError(
          new Error("PROVIDER_NOT_CONFIGURED: Dynamic Mockups V2"),
        ),
      ).toBe("PROVIDER_DOWN");
    });

    it("unknown Error → PROVIDER_DOWN (default fallback)", () => {
      expect(classifyRenderError(new Error("something weird"))).toBe(
        "PROVIDER_DOWN",
      );
    });

    it("non-Error value → PROVIDER_DOWN", () => {
      expect(classifyRenderError("string error")).toBe("PROVIDER_DOWN");
      expect(classifyRenderError(null)).toBe("PROVIDER_DOWN");
      expect(classifyRenderError(undefined)).toBe("PROVIDER_DOWN");
      expect(classifyRenderError(42)).toBe("PROVIDER_DOWN");
    });
  });

  // ────────────────────────────────────────────────────────────
  // Order disiplin: specific → general
  // ────────────────────────────────────────────────────────────
  describe("Order: specific → general", () => {
    it("AbortError + 'timeout' message → RENDER_TIMEOUT (specific önce)", () => {
      const err = new Error("Operation timeout exceeded");
      err.name = "AbortError";
      expect(classifyRenderError(err)).toBe("RENDER_TIMEOUT");
    });

    it("SafeAreaOverflowError + Zod-like message → SAFE_AREA_OVERFLOW (custom name match önce)", () => {
      const err = new SafeAreaOverflowError(
        "validation failed: design too small",
      );
      expect(classifyRenderError(err)).toBe("SAFE_AREA_OVERFLOW");
    });

    it("Generic Error 'NOT_IMPLEMENTED' message → PROVIDER_DOWN (specific message match)", () => {
      expect(
        classifyRenderError(new Error("NOT_IMPLEMENTED: any operation")),
      ).toBe("PROVIDER_DOWN");
    });
  });
});

describe("Custom error classes", () => {
  it("SafeAreaOverflowError instanceof Error", () => {
    const err = new SafeAreaOverflowError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(SafeAreaOverflowError);
  });

  it("SourceQualityError instanceof Error", () => {
    const err = new SourceQualityError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(SourceQualityError);
  });

  it("SafeAreaOverflowError message preserved", () => {
    const err = new SafeAreaOverflowError("design too small");
    expect(err.message).toBe("design too small");
  });

  it("SourceQualityError message preserved", () => {
    const err = new SourceQualityError("alpha corrupt");
    expect(err.message).toBe("alpha corrupt");
  });
});
