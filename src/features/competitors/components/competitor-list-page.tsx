"use client";

import { useState } from "react";
import { useCompetitorsList } from "../queries/use-competitors";
import { useTriggerScanStandalone } from "../mutations/use-trigger-scan-standalone";
import { CompetitorCard } from "./competitor-card";
import { AddCompetitorDialog } from "./add-competitor-dialog";

export function CompetitorListPage() {
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [toast, setToast] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null);

  const list = useCompetitorsList({ q });
  const scan = useTriggerScanStandalone();

  function handleScan(id: string) {
    setScanningId(id);
    scan.mutate(id, {
      onSuccess: () => {
        setToast({ kind: "success", message: "Tarama kuyruğa alındı." });
      },
      onError: (err) => {
        setToast({ kind: "error", message: err.message });
      },
      onSettled: () => setScanningId(null),
    });
  }

  const items = list.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Rakipler</h1>
          <p className="text-sm text-text-muted">
            Etsy/Amazon mağazalarını takibe al, yeni listingleri analiz et.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          + Rakip Ekle
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Mağaza adına göre ara…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-9 min-w-60 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Rakip arama"
        />
      </div>

      {toast ? (
        <div
          role="status"
          className={
            toast.kind === "success"
              ? "rounded-md border border-border bg-success/10 px-3 py-2 text-xs text-success"
              : "rounded-md border border-border bg-danger/10 px-3 py-2 text-xs text-danger"
          }
        >
          {toast.message}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Kapat
          </button>
        </div>
      ) : null}

      {list.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-md border border-border bg-surface-muted"
              aria-hidden
            />
          ))}
        </div>
      ) : list.isError ? (
        <p className="text-sm text-danger" role="alert">
          {(list.error as Error).message}
        </p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-6 text-center text-sm text-text-muted">
          Henüz rakip mağaza yok. Yukarıdaki &quot;+ Rakip Ekle&quot; ile ilk
          mağazayı takibe al.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <CompetitorCard
              key={c.id}
              competitor={c}
              scanning={scanningId === c.id}
              onTriggerScan={handleScan}
            />
          ))}
        </div>
      )}

      {dialogOpen ? (
        <AddCompetitorDialog
          onClose={() => setDialogOpen(false)}
          onCreated={() => {
            setToast({
              kind: "success",
              message: "Rakip eklendi, ilk tarama kuyruğa alındı.",
            });
          }}
        />
      ) : null}
    </div>
  );
}
