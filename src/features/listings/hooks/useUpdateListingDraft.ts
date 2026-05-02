import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ListingDraft } from "../types";

/**
 * PATCH /api/listings/:id/draft
 * Update listing draft metadata, pricing, or tags.
 * Invalidates draft detail query after mutation.
 */
export function useUpdateListingDraft(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      updates: Partial<
        Pick<ListingDraft, "title" | "description" | "tags" | "priceCents">
      > & { materials?: string | string[] | undefined },
    ) => {
      const res = await fetch(`/api/listings/${id}/draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `PATCH failed: ${res.status}`);
      }

      return res.json() as Promise<ListingDraft>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["listing-draft", id],
      });
    },
  });
}
