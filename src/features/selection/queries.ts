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
  /**
   * Pass 35 — Set thumbnail. İlk item'ın aktif asset'inin (editedAssetId ??
   * sourceAssetId) signed URL'i. Storage fail olduysa veya item yoksa null.
   */
  thumbnailUrl: string | null;
  /** Pass 35 — Set'teki toplam item sayısı (UI'da "N varyant"). */
  itemCount: number;
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
 *
 * Pass 33 — sourceAsset/editedAsset metadata projection eklendi
 * (PreviewCard boyut + before/after compare için). Raw Asset entity
 * sızmaz; yalnız `width/height/sizeBytes/mimeType` (CLAUDE.md
 * "no leak" disiplini).
 */
export type SelectionAssetMetaView = {
  id: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  mimeType: string;
};

export type SelectionItemView = SelectionItem & {
  review: ReviewView | null;
  sourceAsset: SelectionAssetMetaView | null;
  editedAsset: SelectionAssetMetaView | null;
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

// ────────────────────────────────────────────────────────────
// Phase 7 Task 32 — AddVariantsDrawer hook'ları
// ────────────────────────────────────────────────────────────
//
// Drawer'da reference selector + jobId üzerinden batch grouping yapılır.
// Mevcut endpoint'ler reuse edilir:
//   - `/api/references` (GET, listReferences) → `{ items, nextCursor }`
//   - `/api/variation-jobs?referenceId=...` (GET) → `{ designs }`
//
// Repo'da `references` feature'ında ortak hook yok (page-level fetch yapılıyor),
// drawer izolasyonu için burada hafif hook'lar açıyoruz. Query key paterni:
// `["selection", "drawer", ...]` — Phase 7 namespace altında.

export type DrawerReference = {
  id: string;
  notes: string | null;
  productType: { id: string; key: string; displayName: string } | null;
};

export type DrawerDesign = {
  id: string;
  jobId: string | null;
  assetId: string;
  createdAt: string;
};

/**
 * Drawer reference selector için kullanıcının referans listesi.
 *
 * `/api/references` cevabı `{ items, nextCursor }` shape'i (route dosyası).
 * Drawer için yalnız `id + notes + productType.displayName` yeterli; diğer
 * alanlar (asset/tags vb.) drawer UX'ine gerekmez.
 */
export function useDrawerReferences(enabled: boolean) {
  return useQuery<DrawerReference[]>({
    queryKey: ["selection", "drawer", "references"],
    enabled,
    queryFn: async () => {
      const res = await fetch("/api/references");
      if (!res.ok) {
        throw new Error(`Referans listesi alınamadı (${res.status})`);
      }
      const data = (await res.json()) as {
        items: Array<{
          id: string;
          notes: string | null;
          productType: {
            id: string;
            key: string;
            displayName: string;
          } | null;
        }>;
      };
      return data.items.map((r) => ({
        id: r.id,
        notes: r.notes,
        productType: r.productType,
      }));
    },
  });
}

/**
 * Seçili reference için variation designs listesi.
 *
 * `/api/variation-jobs?referenceId=...` (Phase 5) → `{ designs }`.
 * Drawer'da jobId üzerinden batch grouping client-side yapılır (server bu
 * grouping'i yansıtmaz; aynı reference altında farklı jobId → ayrı batch).
 */
export function useDrawerDesigns(referenceId: string | null) {
  return useQuery<DrawerDesign[]>({
    queryKey: ["selection", "drawer", "designs", referenceId ?? "_none"],
    enabled: !!referenceId,
    queryFn: async () => {
      const res = await fetch(
        `/api/variation-jobs?referenceId=${encodeURIComponent(
          referenceId ?? "",
        )}`,
      );
      if (!res.ok) {
        throw new Error(`Variation designs alınamadı (${res.status})`);
      }
      const data = (await res.json()) as {
        designs: Array<{
          id: string;
          jobId: string | null;
          assetId: string;
          createdAt: string;
        }>;
      };
      return data.designs.map((d) => ({
        id: d.id,
        jobId: d.jobId,
        assetId: d.assetId,
        createdAt: d.createdAt,
      }));
    },
  });
}
