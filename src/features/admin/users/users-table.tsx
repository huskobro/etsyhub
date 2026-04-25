"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserRole, UserStatus } from "@prisma/client";
import { Download } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/components/ui/use-confirm";
import { confirmPresets } from "@/components/ui/confirm-presets";
import { Table, THead, TBody, TR, TH, TD, type SortDirection } from "@/components/ui/Table";
import { Toolbar } from "@/components/ui/Toolbar";
import { FilterBar } from "@/components/ui/FilterBar";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";

/**
 * Admin · Kullanıcılar tablosu — T-24 Table primitive migrasyonu.
 *
 * **Kapsam:**
 * - 5 kolon (E-posta, İsim, Rol, Durum, Oluşturma) Table primitive'ine taşındı.
 * - 3 chip filter (Tümü / Sadece admin / Pasif kullanıcı) client-side.
 * - CSV export (filtreli satırlar) + Davet et CTA disabled (API yok).
 * - E-posta kolonu sortable (asc → desc → null cycle).
 * - Selected row pattern: tek satır seçimi accent-soft ile primitive'den gelir.
 *
 * **Kapsam dışı (carry-forward):** canvas hedefi 9 kolondu;
 * `docs/plans/admin-users-extra-columns.md` içinde belirtildiği gibi mağaza
 * sayısı, plan, jobs, maliyet, son giriş alanları için backend domain
 * genişletmesi ayrı sprintte ele alınacak.
 */

type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
};

type FilterKey = "all" | "admin" | "disabled";

async function fetchUsers(): Promise<AdminUserRow[]> {
  const res = await fetch("/api/admin/users", { cache: "no-store" });
  if (!res.ok) throw new Error("Kullanıcı listesi alınamadı");
  const data = (await res.json()) as { users: AdminUserRow[] };
  return data.users;
}

async function patchUser(input: { userId: string; role?: UserRole; status?: UserStatus }) {
  const res = await fetch("/api/admin/users", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Güncelleme başarısız");
  return res.json();
}

function csvEscape(value: string): string {
  // RFC 4180: çift tırnak içerirse kaçır, virgül/yeni satır içeren alanı tırnağa al.
  const needsQuote = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function buildCsv(rows: AdminUserRow[]): string {
  const header = ["E-posta", "İsim", "Rol", "Durum", "Oluşturma"];
  const lines = [header.map(csvEscape).join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.email),
        csvEscape(r.name ?? ""),
        csvEscape(r.role),
        csvEscape(r.status),
        csvEscape(new Date(r.createdAt).toISOString()),
      ].join(","),
    );
  }
  return lines.join("\n");
}

function downloadCsv(filename: string, csv: string) {
  // SSR ortamında çağrılırsa no-op; jsdom URL.createObjectURL'i mock olabilir.
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function todayStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function UsersTable() {
  const qc = useQueryClient();
  const { confirm, close, run, state } = useConfirm();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchUsers,
  });
  const mutation = useMutation({
    mutationFn: patchUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  // Filtre + sıralama + seçim — local UI state (server kontratı değişmiyor).
  const [filter, setFilter] = useState<FilterKey>("all");
  const [emailSort, setEmailSort] = useState<SortDirection>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo<AdminUserRow[]>(() => {
    if (!data) return [];
    let rows = data;
    if (filter === "admin") rows = rows.filter((u) => u.role === "ADMIN");
    else if (filter === "disabled") rows = rows.filter((u) => u.status === "DISABLED");
    if (emailSort) {
      rows = [...rows].sort((a, b) => {
        const cmp = a.email.localeCompare(b.email, "tr");
        return emailSort === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [data, filter, emailSort]);

  const cycleEmailSort = () => {
    setEmailSort((prev) => (prev === null ? "asc" : prev === "asc" ? "desc" : null));
  };

  const exportCsv = () => {
    const csv = buildCsv(filtered);
    downloadCsv(`kullanicilar-${todayStamp()}.csv`, csv);
  };

  const toolbar = (
    <Toolbar
      trailing={
        <>
          <Button
            variant="ghost"
            size="sm"
            icon={<Download className="h-3.5 w-3.5" aria-hidden />}
            onClick={exportCsv}
            disabled={isLoading || !data || filtered.length === 0}
          >
            CSV indir
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled
            aria-describedby="users-invite-disabled-note"
            title="Davet API'si henüz hazır değil"
          >
            Davet et
          </Button>
          <span id="users-invite-disabled-note" className="sr-only">
            Davet API&apos;si henüz hazır değil
          </span>
        </>
      }
    >
      <FilterBar ariaLabel="Kullanıcı filtreleri">
        <Chip active={filter === "all"} onToggle={() => setFilter("all")}>
          Tümü
        </Chip>
        <Chip active={filter === "admin"} onToggle={() => setFilter("admin")}>
          Sadece admin
        </Chip>
        <Chip active={filter === "disabled"} onToggle={() => setFilter("disabled")}>
          Pasif kullanıcı
        </Chip>
      </FilterBar>
      <span className="ml-2 font-mono text-xs text-text-muted">
        {data ? `${filtered.length} / ${data.length} görüntüleniyor` : ""}
      </span>
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

      <Table density="admin">
        <THead>
          <TR>
            <TH sortable sortDirection={emailSort} onSort={cycleEmailSort}>
              E-posta
            </TH>
            <TH>İsim</TH>
            <TH>Rol</TH>
            <TH>Durum</TH>
            <TH>Oluşturma</TH>
          </TR>
        </THead>
        <TBody>
          {filtered.map((u) => (
            <TR
              key={u.id}
              interactive
              selected={u.id === selectedId}
              onClick={() => setSelectedId((prev) => (prev === u.id ? null : u.id))}
              aria-selected={u.id === selectedId}
            >
              <TD>{u.email}</TD>
              <TD muted>{u.name ?? "—"}</TD>
              <TD>
                <select
                  value={u.role}
                  disabled={mutation.isPending}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const nextRole = e.target.value as UserRole;
                    confirm(
                      confirmPresets.changeUserRole(u.email, nextRole),
                      async () => {
                        await mutation.mutateAsync({
                          userId: u.id,
                          role: nextRole,
                        });
                      },
                    );
                  }}
                  className="rounded-md border border-border bg-bg px-2 py-1 text-sm"
                  aria-label={`Rol: ${u.email}`}
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </TD>
              <TD>
                <select
                  value={u.status}
                  disabled={mutation.isPending}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    mutation.mutate({ userId: u.id, status: e.target.value as UserStatus })
                  }
                  className="rounded-md border border-border bg-bg px-2 py-1 text-sm"
                  aria-label={`Durum: ${u.email}`}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </TD>
              <TD muted>
                {new Date(u.createdAt).toLocaleDateString("tr-TR")}
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
