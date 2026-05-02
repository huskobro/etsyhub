// Phase 9 V1 — shared listing status label/badge maps.
//
// Hem index hem draft view'da kullanılır (DRY). UI consumer'ları local map
// tanımlamaz. Yeni status enum eklenirse tek noktadan güncellenir.

import type { ListingStatusValue } from "../types";

export const LISTING_STATUS_LABELS: Record<ListingStatusValue, string> = {
  DRAFT: "Taslak",
  SCHEDULED: "Zamanlanmış",
  PUBLISHED: "Yayınlanmış",
  FAILED: "Başarısız",
  REJECTED: "Reddedildi",
  NEEDS_REVIEW: "İnceleme bekleniyor",
};

export const LISTING_STATUS_BADGE_CLASS: Record<ListingStatusValue, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  PUBLISHED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  REJECTED: "bg-zinc-100 text-zinc-700",
  NEEDS_REVIEW: "bg-amber-100 text-amber-700",
};
