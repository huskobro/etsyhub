// Pass 88 — Asset Library V1: variantKind helper.
//
// MJVariantKind enum'una karşılık gelen UI metaverisi (label + tone).
// Card rozetinde, filter chip'lerinde tek kaynak olsun diye burada.

import type { MJVariantKind } from "@prisma/client";
import type { BadgeTone } from "@/components/ui/Badge";

export type VariantMeta = {
  label: string;
  tone: BadgeTone;
  /** Kısa açıklama (tooltip için). */
  hint: string;
};

export const VARIANT_KIND_META: Record<MJVariantKind, VariantMeta> = {
  GRID: {
    label: "Grid",
    tone: "neutral",
    hint: "İlk üretim — 4-grid render'ın bir parçası",
  },
  UPSCALE: {
    label: "Upscale",
    tone: "accent",
    hint: "U1/U2/U3/U4 sonucu — yüksek çözünürlük",
  },
  VARIATION: {
    label: "Variation",
    tone: "success",
    hint: "V1/V2/V3/V4 sonucu — alt-grid varyasyon",
  },
  DESCRIBE: {
    label: "Describe",
    tone: "warning",
    hint: "Describe çıktısı — image yok, sadece prompt önerileri",
  },
};

export const VARIANT_KIND_OPTIONS: ReadonlyArray<{
  value: MJVariantKind | "ALL";
  label: string;
}> = [
  { value: "ALL", label: "Tümü" },
  { value: "GRID", label: "Grid" },
  { value: "UPSCALE", label: "Upscale" },
  { value: "VARIATION", label: "Variation" },
  { value: "DESCRIBE", label: "Describe" },
];
