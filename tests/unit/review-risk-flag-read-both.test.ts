// Phase 6 Drift #5 — KIE strict JSON schema validator değişti:
// `properties: { type: { ... } }` JSON Schema reserved word çakışması nedeniyle
// 422 dönüyor. Hotfix: alan adı `type` → `kind`.
//
// Geçiş modeli (kullanıcı yön kararı C — Hibrit):
//   - Yazma (write-new): yeni review output'larında `riskFlags[].kind` üretilir
//   - Okuma (read-both): tüketiciler önce `kind`, yoksa `type` okur
//
// Bu dosya read-both helper sözleşmesini doğrular. Helper:
//   - `kind` (yeni format) → string döner
//   - `type` (legacy format) → string döner
//   - Hem `kind` hem `type` → `kind` öncelikli
//   - Geçersiz / null / non-string → null döner
//
// Konum: `src/providers/review/types.ts` — minimum yüzey, mapper + queue
// route + UI tüketicileri tek noktadan import eder.

import { describe, it, expect } from "vitest";
import { readRiskFlagKind } from "@/providers/review/types";

describe("readRiskFlagKind — Drift #5 read-both helper", () => {
  it("yeni format { kind: '...' } → kind döner", () => {
    expect(
      readRiskFlagKind({
        kind: "watermark_detected",
        confidence: 0.9,
        reason: "x",
      }),
    ).toBe("watermark_detected");
  });

  it("legacy format { type: '...' } → type döner (backward-compat)", () => {
    expect(
      readRiskFlagKind({
        type: "watermark_detected",
        confidence: 0.9,
        reason: "x",
      }),
    ).toBe("watermark_detected");
  });

  it("hem kind hem type varsa → kind öncelikli", () => {
    expect(
      readRiskFlagKind({
        kind: "watermark_detected",
        type: "signature_detected",
        confidence: 0.9,
        reason: "x",
      }),
    ).toBe("watermark_detected");
  });

  it("kind ve type yok → null", () => {
    expect(
      readRiskFlagKind({ confidence: 0.9, reason: "x" }),
    ).toBeNull();
  });

  it("kind non-string (number) → type'a fallback", () => {
    expect(
      readRiskFlagKind({
        kind: 42,
        type: "watermark_detected",
        confidence: 0.9,
        reason: "x",
      }),
    ).toBe("watermark_detected");
  });

  it("type non-string + kind yok → null", () => {
    expect(readRiskFlagKind({ type: 42, confidence: 0.9 })).toBeNull();
  });

  it("null entry → null", () => {
    expect(readRiskFlagKind(null)).toBeNull();
  });

  it("primitive entry (string) → null", () => {
    expect(readRiskFlagKind("not-an-object")).toBeNull();
  });

  it("undefined entry → null", () => {
    expect(readRiskFlagKind(undefined)).toBeNull();
  });
});
