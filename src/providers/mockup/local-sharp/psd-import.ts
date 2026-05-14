/**
 * Phase 75 — PSD ETL contract + skeleton (proof-of-concept).
 *
 * Operatör Photoshop'ta hazırladığı PSD'yi sisteme import etmek isterse
 * bu modül smart object'lerin (her biri bir design slot'una karşılık
 * gelir) konumlarını okuyup `slots[]` template config'ine dönüştürür.
 *
 * Phase 75 scope (PoC):
 *   - Type sözleşmesi (PsdImportInput / PsdImportResult)
 *   - parsePsdSmartObjects() — pure function signature; implementation
 *     `ag-psd` dep eklenince doldurulacak (Phase 76+ candidate)
 *   - Operator manuel naming convention: layer name'inde "[slot]"
 *     işaretli smart object'ler slot olarak kabul edilir (örn.
 *     "[slot] Cover", "[slot] Back")
 *   - Bounds → normalize 0..1 → SafeAreaRect dönüşümü
 *
 * Phase 75 dışı (Phase 76+ candidate):
 *   - `ag-psd` npm dep + parser implementation
 *   - Worker dispatch (operatör PSD upload → BullMQ job → parse → template)
 *   - PSD perspective smart object detection (PSD transform matrix → 4-corner
 *     quad)
 *   - PSD layer name parsing convention variants
 *   - UI: PSD upload flow (PSDImportDialog component)
 *   - PSD asset extract (composite preview as baseAssetKey)
 *
 * 3rd-party render API path YASAK (operator self-hosted ana çizgi).
 * Bu modül **input parser**; render yine local-sharp pipeline.
 */

import type { SlotConfig } from "@/providers/mockup";

/** Operator-facing PSD import contract. */
export type PsdImportInput = {
  /** Raw PSD file buffer (uploaded by operator). */
  psdBuffer: Buffer;
  /** Convention prefix to detect slot layers. Default "[slot]". */
  slotPrefix?: string;
};

export type PsdImportLayerHit = {
  /** Original layer name from PSD (after stripping the prefix). */
  name: string;
  /** Layer pixel bounds in PSD coordinate space. */
  bounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  /** Is this a smart object? (vs raster layer matching the prefix) */
  isSmartObject: boolean;
};

export type PsdImportResult = {
  /** PSD canvas dimensions (operator template baseDimensions). */
  canvas: { w: number; h: number };
  /** Slot layers detected in PSD (filtered by slotPrefix convention). */
  slots: SlotConfig[];
  /** All matched layer hits — for debug / preview UI. */
  layerHits: PsdImportLayerHit[];
  /** Warnings (non-blocking; e.g., layer outside canvas, etc.) */
  warnings: string[];
};

/**
 * Phase 75 PoC — Implementation stub.
 *
 * Pre-condition: caller responsible for installing `ag-psd` and providing
 * a parsed PSD tree. This function takes the raw buffer and returns the
 * import result; for Phase 75 PoC it throws NOT_IMPLEMENTED.
 *
 * Phase 76+ candidate fills the body:
 *   1. const psd = readPsd(input.psdBuffer); // ag-psd
 *   2. Walk psd.children recursively; match by name starting with slotPrefix
 *   3. For each match, extract bounds (left/top/right/bottom)
 *   4. Detect smartObject flag (psd-spec: hasPlacedLayer or smartObject ref)
 *   5. Convert bounds → SafeAreaRect: { type: "rect",
 *        x: bounds.left / canvas.w,
 *        y: bounds.top / canvas.h,
 *        w: (bounds.right - bounds.left) / canvas.w,
 *        h: (bounds.bottom - bounds.top) / canvas.h }
 *   6. Compose SlotConfig[] (preserve top-to-bottom order = z-order)
 *   7. Warn for out-of-canvas bounds, missing smart objects, etc.
 */
export function parsePsdSmartObjects(
  _input: PsdImportInput,
): PsdImportResult {
  throw new Error(
    "PSD_IMPORT_NOT_IMPLEMENTED: Phase 76+ candidate (requires ag-psd dep + worker dispatch)",
  );
}

/**
 * Phase 75 — Pure helper: convert layer bounds → SafeAreaRect.
 *
 * Şu an parsePsdSmartObjects implementation'ı yok ama bu helper
 * server-side veya UI tarafında manuel slot construction için
 * kullanılabilir (örn. operator JSON yapıştırırsa, veya hardcoded
 * test template'leri için).
 *
 * Validates: bounds must be inside canvas; min dimension 5%.
 */
export function layerBoundsToSlot(args: {
  name: string;
  bounds: { left: number; top: number; right: number; bottom: number };
  canvas: { w: number; h: number };
  slotId: string;
}): SlotConfig {
  const { bounds, canvas, slotId, name } = args;
  const x = bounds.left / canvas.w;
  const y = bounds.top / canvas.h;
  const w = (bounds.right - bounds.left) / canvas.w;
  const h = (bounds.bottom - bounds.top) / canvas.h;

  // Clamp to canvas (defensive)
  const safeRect = {
    type: "rect" as const,
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    w: Math.max(0.05, Math.min(1, w)),
    h: Math.max(0.05, Math.min(1, h)),
  };

  return {
    id: slotId,
    name,
    safeArea: safeRect,
  };
}
