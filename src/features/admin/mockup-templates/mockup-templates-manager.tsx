"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

/**
 * Admin · MockupTemplate yöneticisi (V2 Phase 8 paketi).
 *
 * Kapsam (V2 başlangıç):
 * - List: GET /api/admin/mockup-templates (categoryId + status filter)
 * - Status transition: PATCH /api/admin/mockup-templates/[id] body { status }
 *   - DRAFT → ACTIVE (publish)
 *   - ACTIVE → DRAFT (geri çek)
 *   - DRAFT/ACTIVE → ARCHIVED (deprecate)
 *   - ARCHIVED → DRAFT (restore)
 * - Delete: DELETE /api/admin/mockup-templates/[id] — render history koruması
 *   (renderCount > 0 ise 409 ConflictError)
 *
 * Kapsam dışı (V2 carry-forward):
 * - Create (binding ile birlikte) — DB seed yolu açık; UI carry-forward.
 * - Binding management — sub-resource ayrı ekran.
 * - Bulk operations.
 *
 * V1 lock: Phase 8 implementation surface dokunulmadı; mockup render
 * lifecycle değişmedi. Sadece admin lifecycle + audit log.
 */

type MockupTemplateBindingRow = {
  id: string;
  providerId: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  version: number;
  estimatedRenderMs: number;
};

type MockupTemplateRow = {
  id: string;
  categoryId: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  thumbKey: string;
  aspectRatios: string[];
  tags: string[];
  estimatedRenderMs: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  bindings: MockupTemplateBindingRow[];
};

type StatusFilter = "all" | "DRAFT" | "ACTIVE" | "ARCHIVED";

async function fetchItems(): Promise<MockupTemplateRow[]> {
  const res = await fetch("/api/admin/mockup-templates", { cache: "no-store" });
  if (!res.ok) throw new Error("Liste alınamadı");
  const data = (await res.json()) as { items: MockupTemplateRow[] };
  return data.items;
}

async function patchStatus(input: {
  id: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
}) {
  const res = await fetch(`/api/admin/mockup-templates/${input.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: input.status }),
  });
  if (!res.ok) {
    throw new Error((await res.json()).error ?? "Status değişikliği başarısız");
  }
  return res.json();
}

async function deleteItem(id: string) {
  const res = await fetch(`/api/admin/mockup-templates/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Silme başarısız");
  return res.json();
}

async function cloneItem(input: { id: string; name: string }) {
  const res = await fetch(`/api/admin/mockup-templates/${input.id}/clone`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: input.name }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Klonlama başarısız");
  return res.json() as Promise<{ item: { id: string } }>;
}

function statusBadgeTone(s: MockupTemplateRow["status"]): "success" | "neutral" | "warning" {
  if (s === "ACTIVE") return "success";
  if (s === "ARCHIVED") return "neutral";
  return "warning";
}

function statusLabel(s: MockupTemplateRow["status"]): string {
  if (s === "ACTIVE") return "Aktif";
  if (s === "ARCHIVED") return "Arşivli";
  return "Taslak";
}

export function MockupTemplatesManager() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "mockup-templates"],
    queryFn: fetchItems,
  });
  const patchMutation = useMutation({
    mutationFn: patchStatus,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "mockup-templates"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteItem,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "mockup-templates"] }),
  });
  const cloneMutation = useMutation({
    mutationFn: cloneItem,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "mockup-templates"] }),
  });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [actionError, setActionError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const items = data ?? [];
    return {
      all: items.length,
      DRAFT: items.filter((i) => i.status === "DRAFT").length,
      ACTIVE: items.filter((i) => i.status === "ACTIVE").length,
      ARCHIVED: items.filter((i) => i.status === "ARCHIVED").length,
    };
  }, [data]);

  const filtered = useMemo(() => {
    const items = data ?? [];
    return items.filter((it) => {
      if (filter !== "all" && it.status !== filter) return false;
      if (search.trim().length > 0) {
        const q = search.toLowerCase();
        if (
          !it.name.toLowerCase().includes(q) &&
          !it.categoryId.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [data, filter, search]);

  if (isLoading) {
    return <p className="text-sm text-text-muted">Yükleniyor…</p>;
  }
  if (error) {
    return <p className="text-sm text-danger">{(error as Error).message}</p>;
  }

  const onTransition = (
    row: MockupTemplateRow,
    next: "DRAFT" | "ACTIVE" | "ARCHIVED",
  ) => {
    setActionError(null);
    patchMutation.mutate(
      { id: row.id, status: next },
      {
        onError: (err) => setActionError((err as Error).message),
      },
    );
  };

  const onDelete = (row: MockupTemplateRow) => {
    if (
      !window.confirm(
        `"${row.name}" silinsin mi? Render history içeren template'ler silinemez (önce ARCHIVED yap).`,
      )
    ) {
      return;
    }
    setActionError(null);
    deleteMutation.mutate(row.id, {
      onError: (err) => setActionError((err as Error).message),
    });
  };

  const onClone = (row: MockupTemplateRow) => {
    const defaultName = `${row.name} (kopya)`;
    const next = window.prompt(
      `"${row.name}" klonlanıyor. Yeni template adı:`,
      defaultName,
    );
    if (!next || next.trim().length === 0) return;
    setActionError(null);
    cloneMutation.mutate(
      { id: row.id, name: next.trim() },
      {
        onError: (err) => setActionError((err as Error).message),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ada veya kategoriye göre ara…"
          className="h-control-md w-72 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition-colors duration-fast ease-out focus:border-accent"
        />
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">{filtered.length} template</span>
          <Link href="/admin/mockup-templates/new">
            <Button variant="primary" size="sm">
              + Yeni template
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(["all", "DRAFT", "ACTIVE", "ARCHIVED"] as const).map((key) => {
          const label =
            key === "all"
              ? "Tümü"
              : key === "DRAFT"
                ? "Taslak"
                : key === "ACTIVE"
                  ? "Aktif"
                  : "Arşivli";
          const count = counts[key];
          const isActive = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`h-control-sm rounded-md border px-3 text-xs transition-colors duration-fast ease-out ${
                isActive
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-surface text-text hover:border-border-strong"
              }`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {actionError ? (
        <p className="text-sm text-danger" role="alert">
          {actionError}
        </p>
      ) : null}

      <Table density="admin">
        <THead>
          <TR>
            <TH>Ad</TH>
            <TH>Kategori</TH>
            <TH>Status</TH>
            <TH>Aspect</TH>
            <TH>Bindings</TH>
            <TH>İşlemler</TH>
          </TR>
        </THead>
        <TBody>
          {filtered.length === 0 ? (
            <TR>
              <TD colSpan={6}>
                <span className="text-text-muted">Sonuç yok</span>
              </TD>
            </TR>
          ) : (
            filtered.map((row) => (
              <TR key={row.id}>
                <TD>
                  <Link
                    href={`/admin/mockup-templates/${row.id}`}
                    className="font-medium text-text hover:text-accent"
                  >
                    {row.name}
                  </Link>
                </TD>
                <TD>
                  <span className="font-mono text-xs">{row.categoryId}</span>
                </TD>
                <TD>
                  <Badge tone={statusBadgeTone(row.status)}>
                    {statusLabel(row.status)}
                  </Badge>
                </TD>
                <TD>
                  <span className="font-mono text-xs">
                    {row.aspectRatios.join(", ")}
                  </span>
                </TD>
                <TD>
                  <span className="text-xs text-text-muted">
                    {row.bindings.length === 0
                      ? "—"
                      : `${row.bindings.filter((b) => b.status === "ACTIVE").length}/${row.bindings.length} aktif`}
                  </span>
                </TD>
                <TD>
                  <div className="flex flex-wrap items-center gap-1">
                    {row.status === "DRAFT" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onTransition(row, "ACTIVE")}
                        disabled={patchMutation.isPending}
                      >
                        Yayınla
                      </Button>
                    )}
                    {row.status === "ACTIVE" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onTransition(row, "DRAFT")}
                        disabled={patchMutation.isPending}
                      >
                        Geri çek
                      </Button>
                    )}
                    {row.status !== "ARCHIVED" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onTransition(row, "ARCHIVED")}
                        disabled={patchMutation.isPending}
                      >
                        Arşivle
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onTransition(row, "DRAFT")}
                        disabled={patchMutation.isPending}
                      >
                        Geri al
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onClone(row)}
                      disabled={cloneMutation.isPending}
                    >
                      Klonla
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDelete(row)}
                      disabled={deleteMutation.isPending}
                    >
                      Sil
                    </Button>
                  </div>
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
    </div>
  );
}
