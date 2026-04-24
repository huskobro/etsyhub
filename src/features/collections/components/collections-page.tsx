"use client";

import { useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { CollectionCard } from "./collection-card";
import { CollectionCreateDialog } from "./collection-create-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/components/ui/use-confirm";
import { confirmPresets } from "@/components/ui/confirm-presets";

type CollectionLite = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  kind: "BOOKMARK" | "REFERENCE" | "MIXED";
  createdAt: string;
  _count: { bookmarks: number; references: number };
};

type ListResponse = { items: CollectionLite[] };

type KindFilter = "" | "BOOKMARK" | "REFERENCE" | "MIXED";

export function CollectionsPage() {
  const qc = useQueryClient();
  const { confirm, close, run, state } = useConfirm();
  const [kind, setKind] = useState<KindFilter>("");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const query = useQuery<ListResponse>({
    queryKey: ["collections", kind, q],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (kind) params.set("kind", kind);
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", "60");
      const res = await fetch(`/api/collections?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Liste alınamadı");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      kind: "BOOKMARK" | "REFERENCE" | "MIXED";
    }) => {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        throw new Error((await res.json()).error ?? "Koleksiyon oluşturulamadı");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      setCreating(false);
      setCreateError(null);
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Arşivleme başarısız");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collections"] }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Koleksiyonlar</h1>
          <p className="text-sm text-text-muted">
            Bookmark ve referansları tema/konu bazında grupla.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setCreating(true);
          }}
          className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground"
        >
          Yeni Koleksiyon
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as KindFilter)}
          className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-text"
        >
          <option value="">Tüm tipler</option>
          <option value="MIXED">Karma</option>
          <option value="BOOKMARK">Bookmark</option>
          <option value="REFERENCE">Reference</option>
        </select>
        <input
          type="search"
          placeholder="İsim veya açıklamada ara"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-9 min-w-60 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-text"
        />
      </div>

      {query.isLoading ? (
        <p className="text-sm text-text-muted">Yükleniyor…</p>
      ) : query.error ? (
        <p className="text-sm text-danger">{(query.error as Error).message}</p>
      ) : !query.data || query.data.items.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-6 text-center text-sm text-text-muted">
          Henüz koleksiyon yok. &quot;Yeni Koleksiyon&quot; ile başla.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {query.data.items.map((c) => (
            <CollectionCard
              key={c.id}
              collection={c}
              onArchive={(id) => {
                const item = query.data.items.find((col) => col.id === id);
                confirm(
                  confirmPresets.archiveCollection(item?.name),
                  async () => {
                    await archiveMutation.mutateAsync(id);
                  },
                );
              }}
            />
          ))}
        </div>
      )}

      {creating ? (
        <CollectionCreateDialog
          busy={createMutation.isPending}
          error={createError}
          onClose={() => {
            setCreating(false);
            setCreateError(null);
          }}
          onSubmit={(input) => createMutation.mutate(input)}
        />
      ) : null}

      {state.preset ? (
        <ConfirmDialog
          open={state.open}
          onOpenChange={(o) => {
            if (!o) close();
          }}
          {...state.preset}
          onConfirm={run}
          busy={state.busy}
          errorMessage={state.errorMessage}
        />
      ) : null}
    </div>
  );
}
