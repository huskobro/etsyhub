"use client";

// useApplyHeavyEdit — IA Phase 7 in-place heavy edit on canonical
// Selection detail.
//
// Wraps the heavy edit endpoint:
//   POST /api/selection/sets/[setId]/items/[itemId]/edit/heavy
//
// "Heavy" = asynchronous server work that runs through BullMQ + a
// DB-side per-item lock. The endpoint returns a jobId immediately; the
// worker eventually flips `item.activeHeavyJobId` back to null when the
// job completes (or writes a failed entry to editHistoryJson). The UI
// observes the lock via `item.activeHeavyJobId` and polls the set
// detail every 3s while the lock is held — same pattern the Studio's
// HeavyActionButton uses, factored out here so canonical detail and the
// Studio shell share a single lifecycle implementation.
//
// Surface boundary
//   • Today only `background-remove` is wired here — magic-eraser also
//     uses the heavy endpoint but needs a mask-canvas widget that lives
//     in the Studio (~600 lines, separate phase). Calling the hook with
//     op = "magic-eraser" is supported at the type level but EditsTab
//     keeps routing magic-eraser to the Studio for now.
//   • activeHeavyJobId is op-agnostic: a magic-eraser job in flight
//     also locks background-remove on the same item. The UI surfaces
//     this honestly ("another op in progress") instead of pretending
//     the lock belongs to the operator's last click.
//
// Cache contract
//   • Mutation success → invalidate selectionSetQueryKey(setId) so the
//     newly-set activeHeavyJobId reaches every consumer (canonical
//     detail + Studio shell share the key).
//   • Polling uses refetchQueries (force-refresh) rather than
//     invalidateQueries, because the QueryProvider's 30s staleTime
//     would otherwise defer the next refetch until mount/focus.
//   • Polling key is per-item — concurrent heavy jobs on different
//     rows each run their own poll loop without interfering.
//
// Failure mode
//   • Server 4xx → mutation onError; consumer renders inline alert and
//     a retry button. Worker failures land in editHistoryJson with
//     `failed: true` + reason; canonical detail surfaces them via the
//     same alert path on the next poll cycle (consumer reads the last
//     editHistoryJson entry; this hook intentionally doesn't parse it
//     so different surfaces can present failures differently).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { selectionSetQueryKey } from "@/features/selection/queries";

const POLL_INTERVAL_MS = 3000;

export type HeavyEditOp = "background-remove" | "magic-eraser";

export interface HeavyEditVariables {
  itemId: string;
  op: HeavyEditOp;
  /** Magic-eraser only — base64 mask payload. Ignored for other ops. */
  maskBase64?: string;
}

/**
 * Mutation only. Use {@link useHeavyEditPoll} on a per-item basis to
 * follow the lock state.
 */
export function useApplyHeavyEdit(setId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: HeavyEditVariables) => {
      const body =
        vars.op === "magic-eraser"
          ? { op: vars.op, maskBase64: vars.maskBase64 ?? "" }
          : { op: vars.op };
      const res = await fetch(
        `/api/selection/sets/${setId}/items/${vars.itemId}/edit/heavy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        let detail = "";
        try {
          const data = (await res.json()) as { error?: string };
          detail = typeof data.error === "string" ? data.error : "";
        } catch {
          // ignore parse error — fall back to status code
        }
        throw new Error(detail ? detail : `İşlem başarısız (${res.status})`);
      }
      return (await res.json()) as { jobId: string };
    },
    onSuccess: () => {
      // Server set activeHeavyJobId on the row; refresh the set detail
      // so consumers flip into processing mode and the per-item poll
      // picks up the lock.
      queryClient.invalidateQueries({
        queryKey: selectionSetQueryKey(setId),
      });
    },
  });
}

/**
 * Per-item poll loop — refetches the set detail every 3s while the
 * given item is locked. Idempotent: passing `processing=false` disables
 * the loop instantly (React Query unmount-safe).
 *
 * The hook deliberately returns nothing; consumers read the lock state
 * from `item.activeHeavyJobId` on the underlying detail query.
 */
export function useHeavyEditPoll(
  setId: string,
  itemId: string,
  processing: boolean,
): void {
  const queryClient = useQueryClient();

  useQuery({
    queryKey: ["selection", "set", setId, "heavy-poll", itemId],
    queryFn: async () => {
      await queryClient.refetchQueries({
        queryKey: selectionSetQueryKey(setId),
      });
      return Date.now();
    },
    enabled: processing,
    refetchInterval: processing ? POLL_INTERVAL_MS : false,
    staleTime: 0,
  });
}
