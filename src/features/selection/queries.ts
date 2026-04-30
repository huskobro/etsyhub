"use client";

// Phase 7 Task 23 — Selection sets veri çekim hook'u.
//
// `/api/selection/sets[?status=...]` GET endpoint'i (Task 18) için TanStack
// Query wrapper. Multi-tenant: server route `requireUser` ile user-scope
// filtreler — istemci `userId` yollamaz.
//
// Phase 7 v1 list payload, SelectionSet entity satırlarıdır (items dahil
// değil). Item count alanı bu listede yok — index ekranı bunu gösterMEZ;
// gelecek aggregate (`selection-list-item-count` carry-forward) eklenince
// bu hook payload'ı genişletilir.

import { useQuery } from "@tanstack/react-query";

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
