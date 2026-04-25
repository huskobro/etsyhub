"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/components/ui/use-confirm";
import { confirmPresets } from "@/components/ui/confirm-presets";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/components/ui/Table";
import { Toolbar } from "@/components/ui/Toolbar";
import { FilterBar } from "@/components/ui/FilterBar";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/features/admin/_shared/toggle";

/**
 * Admin · Product Types yöneticisi — T-25 Table primitive migrasyonu.
 *
 * **Kapsam:**
 * - Raw `<table>` HTML, Table/THead/TR/TH/TD primitive ailesine taşındı
 *   (density="admin" → 48h satır, mono 11px head).
 * - Toolbar: search input + 3 chip (Tümü / Sistem / Custom) + "Yeni tip" CTA.
 * - Toggle 1. kullanım: yerel `admin/_shared/toggle.tsx` tüketildi. `enabled`
 *   alanı backend'de yok → `disabled` ile render edilir; click no-op.
 * - Sub-title: "N tip" (aktif sayısı bilinmediği için sadece toplam).
 * - "Yeni tip" CTA → mevcut create form'unu disclosure ile açar/gizler.
 * - Sil akışı (ConfirmDialog) ve create akışı korunur.
 *
 * **Kapsam dışı (carry-forward):**
 * - `enabled`/`active` alanı, recipe count, usage count, pasif sub-copy
 *   `docs/plans/admin-product-types-data-model.md` içinde belirtilen
 *   migration ile gelir. O güne kadar Recipe/Usage hücreleri "—" gösterir,
 *   chip filter'ı Aktif/Pasif yerine Sistem/Custom üzerinden çalışır.
 * - Action `⋯` (dots) menüsü için Menu primitive yok → bu sprint disabled.
 */

type ProductTypeRow = {
  id: string;
  key: string;
  displayName: string;
  aspectRatio: string | null;
  description: string | null;
  isSystem: boolean;
};

type FilterKey = "all" | "system" | "custom";

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

  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [key, setKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [aspectRatio, setAspectRatio] = useState("");

  const counts = useMemo(() => {
    const all = data?.length ?? 0;
    const system = data?.filter((p) => p.isSystem).length ?? 0;
    const custom = all - system;
    return { all, system, custom };
  }, [data]);

  const filtered = useMemo<ProductTypeRow[]>(() => {
    if (!data) return [];
    let rows = data;
    if (filter === "system") rows = rows.filter((p) => p.isSystem);
    else if (filter === "custom") rows = rows.filter((p) => !p.isSystem);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (p) =>
          p.displayName.toLowerCase().includes(q) ||
          p.key.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [data, filter, search]);

  const toolbar = (
    <Toolbar
      leading={
        <div className="w-60">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tip adı ara"
            aria-label="Tip adı ara"
            prefix={<Search className="h-3.5 w-3.5 text-text-muted" aria-hidden />}
          />
        </div>
      }
      trailing={
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="h-3.5 w-3.5" aria-hidden />}
          onClick={() => setShowCreate((s) => !s)}
          aria-expanded={showCreate}
        >
          Yeni tip
        </Button>
      }
    >
      <FilterBar ariaLabel="Tip filtreleri">
        <Chip active={filter === "all"} onToggle={() => setFilter("all")}>
          Tümü · {counts.all}
        </Chip>
        <Chip active={filter === "system"} onToggle={() => setFilter("system")}>
          Sistem · {counts.system}
        </Chip>
        <Chip active={filter === "custom"} onToggle={() => setFilter("custom")}>
          Custom · {counts.custom}
        </Chip>
      </FilterBar>
    </Toolbar>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {toolbar}
        <p className="text-sm text-text-muted" role="status">
          Yükleniyor…
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col gap-3">
        {toolbar}
        <p className="text-sm text-danger">{(error as Error).message}</p>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="flex flex-col gap-3">
      {toolbar}

      <p className="font-mono text-xs text-text-muted">
        {counts.all} tip
      </p>

      {showCreate ? (
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
                  setShowCreate(false);
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
      ) : null}

      <Table density="admin">
        <THead>
          <TR>
            <TH>Tip</TH>
            <TH>Slug</TH>
            <TH>Aspect</TH>
            <TH align="right">Recipe</TH>
            <TH align="right">Usage</TH>
            <TH>Durum</TH>
            <TH align="right">
              <span className="sr-only">Eylem</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {filtered.map((p) => (
            <TR key={p.id}>
              <TD>
                <span className="font-medium text-text">{p.displayName}</span>
              </TD>
              <TD>
                <span className="font-mono text-xs text-text-muted">
                  {p.key}
                </span>
              </TD>
              <TD>
                <span className="font-mono text-xs text-text">
                  {p.aspectRatio ?? "—"}
                </span>
              </TD>
              <TD align="right" muted>
                <span className="font-mono text-xs">—</span>
              </TD>
              <TD align="right" muted>
                <span className="font-mono text-xs">—</span>
              </TD>
              <TD>
                <Toggle
                  on={false}
                  onChange={() => {
                    /* enabled alanı backend'de yok — carry-forward */
                  }}
                  disabled
                  size="sm"
                  aria-label={`${p.displayName} etkinleştirme yakında`}
                />
              </TD>
              <TD align="right">
                {p.isSystem ? (
                  <span className="font-mono text-xs text-text-muted">
                    Sistem
                  </span>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleteMutation.isPending}
                    onClick={() =>
                      confirm(
                        confirmPresets.deleteProductType(p.displayName),
                        async () => {
                          await deleteMutation.mutateAsync(p.id);
                        },
                      )
                    }
                  >
                    Sil
                  </Button>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

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
