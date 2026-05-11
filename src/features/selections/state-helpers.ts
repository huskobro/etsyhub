// R4 — Selection stage derivation (UI-katmanı türetme).
//
// Selection set'lerinin DB tarafında bir "stage" alanı yok; status (draft /
// ready / archived) + finalizedAt + lastExportedAt + items özetinden UI için
// 4 üretim aşaması türetilir. Source: docs/design-system/kivasy/ui_kits/
// kivasy/v5/screens-b2-b3.jsx → B2SelectionsIndex STAGE_CTA tablosu.
//
// Stage geçişleri tek yönlü, B2/B3 spec'iyle birebir:
//   Curating     → draft, hiç edit yok (editedAssetId null), select sayısı 0
//                  (ya da edit'siz draft kart)
//   Edits        → draft, en az bir item'da editedAssetId var
//                  (background-remove / color / crop / upscale / magic-eraser
//                  uygulanmış)
//   Mockup ready → ready (finalize sonrası set, mockup uygulamaya hazır)
//   Sent         → ready + lastExportedAt var (Etsy draft / export atılmış)
//
// CTA mapping deterministic (her stage için tek dominant action):
//   Curating     · Open Selection · secondary
//   Edits        · Open Selection · secondary
//   Mockup ready · Apply Mockups  · primary (orange)
//   Sent         · Open Product   · ghost
//
// Apply Mockups CTA, B3 spec'inde stage="Mockup ready" olan setlerde aktif —
// "Curating" set için disabled (set hazır değil).

import type { BadgeTone } from "@/components/ui/Badge";

export type SelectionStage = "Curating" | "Edits" | "Mockup ready" | "Sent";

export interface SelectionStageInput {
  status: "draft" | "ready" | "archived";
  finalizedAt: string | Date | null;
  lastExportedAt: string | Date | null;
  /** Edit uygulanmış item sayısı (editedAssetId not null). */
  editedItemCount: number;
}

/** UI 4 stage türetme — design Section B2 mapping. */
export function deriveStage(input: SelectionStageInput): SelectionStage {
  if (input.status === "ready") {
    return input.lastExportedAt ? "Sent" : "Mockup ready";
  }
  // draft (archived'leri B2 listesine almıyoruz)
  return input.editedItemCount > 0 ? "Edits" : "Curating";
}

export interface StageCta {
  label: string;
  /** Button variant (k-btn modifier seçimi). */
  variant: "primary" | "secondary" | "ghost";
  /** Lucide icon name (mevcut ikonlardan biri). */
  iconKind: "arrow" | "image";
  /** Stage gerekiyorsa CTA disabled olur (B3 Apply Mockups gating). */
  disabled?: boolean;
}

const STAGE_CTA: Record<SelectionStage, StageCta> = {
  Curating: { label: "Open Selection", variant: "secondary", iconKind: "arrow" },
  Edits: { label: "Open Selection", variant: "secondary", iconKind: "arrow" },
  "Mockup ready": {
    label: "Apply Mockups",
    variant: "primary",
    iconKind: "image",
  },
  Sent: { label: "Open Product", variant: "ghost", iconKind: "arrow" },
};

export function stageCta(stage: SelectionStage): StageCta {
  return STAGE_CTA[stage];
}

const STAGE_BADGE_TONE: Record<SelectionStage, BadgeTone> = {
  Curating: "neutral",
  Edits: "accent", // purple-leaning soft (Kivasy accent renderer purple-tone)
  "Mockup ready": "info",
  Sent: "success",
};

export function stageBadgeTone(stage: SelectionStage): BadgeTone {
  return STAGE_BADGE_TONE[stage];
}

/**
 * Apply Mockups primary CTA gating (B3 header).
 *
 * Spec: Mockup ready stage olmadan Apply Mockups disabled — kullanıcı önce
 * setı finalize etmeli. Curating setlerde aksiyon `Open Selection` olur (B2),
 * detayda Duplicate ve kebab kalır, Apply Mockups gri.
 */
export function canApplyMockups(stage: SelectionStage): boolean {
  return stage === "Mockup ready";
}
