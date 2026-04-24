"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/components/ui/use-confirm";
import { confirmPresets } from "@/components/ui/confirm-presets";

type ProductTypeRow = {
  id: string;
  key: string;
  displayName: string;
  aspectRatio: string | null;
  description: string | null;
  isSystem: boolean;
};

async function fetchItems(): Promise<ProductTypeRow[]> {
  const res = await fetch("/api/admin/product-types", { cache: "no-store" });
  if (!res.ok) throw new Error("Liste alınamadı");
  const data = (await res.json()) as { items: ProductTypeRow[] };
  return data.items;
}

async function createItem(input: {
  key: string;
  displayName: string;
  aspectRatio?: string;
  description?: string;
}) {
  const res = await fetch("/api/admin/product-types", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Oluşturma başarısız");
  return res.json();
}

async function deleteItem(id: string) {
  const res = await fetch("/api/admin/product-types", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Silme başarısız");
  return res.json();
}

export function ProductTypesManager() {
  const qc = useQueryClient();
  const { confirm, close, run, state } = useConfirm();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "product-types"],
    queryFn: fetchItems,
  });
  const createMutation = useMutation({
    mutationFn: createItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "product-types"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "product-types"] }),
  });

  const [key, setKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [aspectRatio, setAspectRatio] = useState("");

  if (isLoading) return <p className="text-sm text-text-muted">Yükleniyor…</p>;
  if (error) return <p className="text-sm text-danger">{(error as Error).message}</p>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate(
            {
              key,
              displayName,
              aspectRatio: aspectRatio || undefined,
            },
            {
              onSuccess: () => {
                setKey("");
                setDisplayName("");
                setAspectRatio("");
              },
            },
          );
        }}
        className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">Key</label>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="mug"
            className="h-9 rounded-md border border-border bg-bg px-3 text-sm"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">Görünen Ad</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Mug"
            className="h-9 rounded-md border border-border bg-bg px-3 text-sm"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">Oran</label>
          <input
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            placeholder="1:1"
            className="h-9 rounded-md border border-border bg-bg px-3 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="h-9 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          Ekle
        </button>
        {createMutation.error ? (
          <span className="text-sm text-danger">
            {(createMutation.error as Error).message}
          </span>
        ) : null}
      </form>

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Key</th>
              <th className="px-4 py-2 text-left font-medium">Ad</th>
              <th className="px-4 py-2 text-left font-medium">Oran</th>
              <th className="px-4 py-2 text-left font-medium">Sistem</th>
              <th className="px-4 py-2 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-text">{p.key}</td>
                <td className="px-4 py-2 text-text">{p.displayName}</td>
                <td className="px-4 py-2 text-text-muted">{p.aspectRatio ?? "—"}</td>
                <td className="px-4 py-2 text-text-muted">{p.isSystem ? "Evet" : "Hayır"}</td>
                <td className="px-4 py-2 text-right">
                  {p.isSystem ? (
                    <span className="text-xs text-text-muted">Silinemez</span>
                  ) : (
                    <button
                      type="button"
                      disabled={deleteMutation.isPending}
                      onClick={() =>
                        confirm(
                          confirmPresets.deleteProductType(p.displayName),
                          async () => {
                            await deleteMutation.mutateAsync(p.id);
                          },
                        )
                      }
                      className="rounded-md border border-border px-3 py-1 text-xs text-danger hover:bg-surface-muted"
                    >
                      Sil
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
