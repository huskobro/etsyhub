"use client";

// useApplyInstantEdit — IA Phase 6 in-place edit on canonical Selection
// detail.
//
// Wraps the instant edit endpoint:
//   POST /api/selection/sets/[setId]/items/[itemId]/edit
//
// "Instant" = synchronous server work (crop / transparent-check); the
// response carries the updated SelectionItem so the cache can be
// invalidated and the detail page re-renders with new editedAssetId,
// editHistoryJson, etc.
//
// Heavy ops (background-remove / magic-eraser) DO NOT belong here. They
// run through `/edit/heavy` with a BullMQ enqueue + DB-side lock and
// require activeHeavyJobId polling — that lifecycle still lives in the
// Studio shell (HeavyActionButton + MagicEraserModal). EditsTab keeps
// linking those out to the Edit Studio for now; collapsing the heavy
// lifecycle onto canonical detail is a follow-up phase.
//
// Invalidation matches the Studio QuickActions pattern: invalidate the
// detail query key so the same cache feeds both the canonical detail
// and the studio shell when they're open in adjacent tabs. That
// guarantees a crop applied on /selections/[id]?tab=edits shows up the
// next time the operator opens the Studio (and vice-versa).

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { selectionSetQueryKey } from "@/features/selection/queries";

export type CropRatio = "2:3" | "4:5" | "1:1" | "3:4";

export const CROP_RATIO_OPTIONS: ReadonlyArray<{
  value: CropRatio;
  label: string;
}> = [
  { value: "2:3", label: "2:3 portrait" },
  { value: "4:5", label: "4:5 portrait" },
  { value: "1:1", label: "1:1 square" },
  { value: "3:4", label: "3:4 landscape" },
];

export type InstantEditOp =
  | { op: "crop"; params: { ratio: CropRatio } }
  | { op: "transparent-check" };

export interface InstantEditVariables {
  itemId: string;
  op: InstantEditOp;
}

export function useApplyInstantEdit(setId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: InstantEditVariables) => {
      const res = await fetch(
        `/api/selection/sets/${setId}/items/${vars.itemId}/edit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(vars.op),
        },
      );
      if (!res.ok) {
        let detail = "";
        try {
          const body = (await res.json()) as { error?: string };
          detail = typeof body.error === "string" ? body.error : "";
        } catch {
          // ignore parse error — fall back to status code
        }
        throw new Error(detail ? detail : `İşlem başarısız (${res.status})`);
      }
      return (await res.json()) as { item: unknown };
    },
    onSuccess: () => {
      // Detail query feeds both /selections/[id] and the Studio shell;
      // invalidating once keeps the two surfaces consistent.
      queryClient.invalidateQueries({
        queryKey: selectionSetQueryKey(setId),
      });
    },
  });
}
