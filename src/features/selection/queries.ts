"use client";

// Phase 7 Task 23 — Selection sets list veri çekim hook'u.
// Phase 7 Task 25 — Selection set DETAY hook'u (`useSelectionSet`).
//
// List endpoint: `/api/selection/sets[?status=...]` (Task 18 GET) → entity
// satırları (items aggregate değil).
//
// Detail endpoint: `/api/selection/sets/[setId]` (Task 20 GET) → tek set +
// items[] (review mapper output dahil) + activeExport (queue durumu). Studio
// shell + filmstrip + sağ panel bu payload'a bağlanır.
//
// Multi-tenant: server route `requireUser` + `requireSetOwnership`
// (cross-user / yok → 404) — istemci `userId` yollamaz, ownership backend.

import { useQuery } from "@tanstack/react-query";
import type { SelectionItem, SelectionSet } from "@prisma/client";
import type { ReviewView } from "@/server/services/selection/types";

export type SelectionSetStatus = "draft" | "ready" | "archived";

export type SelectionSetListItem = {
  id: string;
  name: string;
  status: SelectionSetStatus;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  archivedAt: string | null;
  lastExportedAt: string | null;
};

export type SelectionSetsResponse = {
  sets: SelectionSetListItem[];
};

export const selectionSetsQueryKey = (status?: SelectionSetStatus) =>
  ["selection", "sets", status ?? "all"] as const;

export function useSelectionSets(status?: SelectionSetStatus) {
  return useQuery<SelectionSetListItem[]>({
    queryKey: selectionSetsQueryKey(status),
    queryFn: async () => {
      const url = new URL("/api/selection/sets", window.location.origin);
      if (status) url.searchParams.set("status", status);

      const res = await fetch(url.toString());
      if (!res.ok) {
        let detail = "";
        try {
          const body = (await res.json()) as { error?: string };
          detail = body.error ?? "";
        } catch {
          // ignore parse hatası
        }
        throw new Error(
          detail
            ? `Selection set listesi alınamadı (${res.status}): ${detail}`
            : `Selection set listesi alınamadı (${res.status})`,
        );
      }
      const data = (await res.json()) as SelectionSetsResponse;
      return data.sets;
    },
  });
}

// ────────────────────────────────────────────────────────────
// Phase 7 Task 25 — Set detay hook'u (`useSelectionSet`)
// ────────────────────────────────────────────────────────────

/**
 * SelectionItem view shape (route payload).
 *
 * Server `getSet` (Task 3 + Task 16 mapper) DB row + review join → DB
 * item alanları + `review: ReviewView | null`. Mapper `generatedDesign`
 * raw payload'ı sızdırmaz — yalnız review view eklenir.
 *
 * `types.ts` içindeki `SelectionItemView` placeholder (review opsiyonel,
 * `?:`); route payload'ı `null` döndürdüğü için burada explicit `null`
 * kullanılır — UI tarafında `item.review === null` ile kontrol kolay.
 */
export type SelectionItemView = SelectionItem & {
  review: ReviewView | null;
};

/**
 * Active export view (Task 14 — Set GET payload genişletme).
 *
 * BullMQ EXPORT_SELECTION_SET queue'sundan en son job'un durumu. Job
 * yoksa `null`. UI bu objeye bakarak "İndir hazır" / "İşleniyor" /
 * "Tekrar dene" buton state'ini render eder.
 */
export type ActiveExportView = {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  downloadUrl?: string;
  expiresAt?: string;
  failedReason?: string;
} | null;

/** Set detay payload — route `getSet` output'una birebir uyumlu. */
export type SelectionSetDetailView = SelectionSet & {
  items: SelectionItemView[];
  activeExport: ActiveExportView;
};

export const selectionSetQueryKey = (setId: string | null | undefined) =>
  ["selection", "set", setId ?? "_none"] as const;

/**
 * Tek set detayı + items + activeExport.
 *
 * `setId` null/undefined → query disabled (loading=false, data=undefined).
 * 404 → "Set bulunamadı" (cross-user / yok; varlık sızıntısı yok).
 * Diğer non-OK → generic "Set yüklenemedi" mesajı (raw error UI'a sızmaz —
 * Phase 6 disiplini, error.message kullanılırsa shell yine generic title
 * gösterir).
 */
export function useSelectionSet(setId: string | null | undefined) {
  return useQuery<SelectionSetDetailView>({
    queryKey: selectionSetQueryKey(setId),
    enabled: !!setId,
    queryFn: async () => {
      const res = await fetch(`/api/selection/sets/${setId}`);
      if (res.status === 404) {
        throw new Error("Set bulunamadı");
      }
      if (!res.ok) {
        throw new Error(`Set yüklenemedi (${res.status})`);
      }
      return (await res.json()) as SelectionSetDetailView;
    },
  });
}
