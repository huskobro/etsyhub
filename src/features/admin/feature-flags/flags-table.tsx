"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import type { FeatureFlagScope } from "@prisma/client";
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
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/features/admin/_shared/toggle";
import { RolloutBar } from "@/features/admin/feature-flags/_shared/rollout-bar";

/**
 * Admin · Feature Flags tablo — T-26 Table primitive migrasyonu.
 *
 * **Kapsam:**
 * - Raw `<table>` HTML, Table/THead/TR/TH/TD primitive ailesine taşındı
 *   (density="admin").
 * - Toolbar: search input + 3 chip (Tümü / Açık / Kapalı) + "Yeni flag"
 *   disabled CTA (create endpoint yok → title="Yakında").
 * - Toggle 2. kullanım: yerel `admin/_shared/toggle.tsx` tüketildi. **Bu
 *   ekranda gerçek PATCH mutation aktif**; T-25'teki disabled kullanımdan
 *   farklı olarak kullanıcı click'i backend'e yazar.
 * - RolloutBar yerel bileşen: tek tüketici olduğu için `_shared/` altında
 *   kaldı; 2. tüketici terfiyi tetikler (carry-forward).
 * - Scope/Durum Badge üçlüsü canvas'a uygun (env kolonu data yokluğundan
 *   çıkarıldı).
 *
 * **Kapsam dışı (carry-forward → docs/plans/admin-feature-flags-data-model.md):**
 * - name / description / state (ON|OFF|ROLLOUT|BETA) / rolloutPercent / env
 *   alanları prisma schema'da yok. Görsel placeholder'lar:
 *     name → key pretty-format, description → boş
 *     state → enabled ? "Açık" : "Kapalı" (2 state, 4 değil)
 *     rolloutPercent → enabled ? 100 : 0 proxy
 *     env kolonu → çıkarıldı
 * - Action `⋯` (dots) menüsü için Menu primitive yok → disabled.
 */

type FlagMetadata = { name?: string; description?: string } | null;

type FlagRow = {
  id: string;
  key: string;
  enabled: boolean;
  scope: FeatureFlagScope;
  metadata?: FlagMetadata;
};

type FilterKey = "all" | "on" | "off";

async function fetchFlags(): Promise<FlagRow[]> {
  const res = await fetch("/api/admin/feature-flags", { cache: "no-store" });
  if (!res.ok) throw new Error("Flag listesi alınamadı");
  const data = (await res.json()) as { flags: FlagRow[] };
  return data.flags;
}

async function toggleFlag(input: { key: string; enabled: boolean }) {
  const res = await fetch("/api/admin/feature-flags", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Güncelleme başarısız");
  return res.json();
}

/**
 * `key` → pretty-format. `wall_art_variations` → "Wall Art Variations".
 * metadata.name varsa onu tercih eder (carry-forward için güvenli).
 */
function displayName(row: FlagRow): string {
  const meta = row.metadata;
  if (meta && typeof meta === "object" && meta.name) return meta.name;
  return row.key
    .split(/[_\-.]+/g)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function description(row: FlagRow): string | null {
  const meta = row.metadata;
  if (meta && typeof meta === "object" && meta.description) return meta.description;
  return null;
}

export function FlagsTable() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "feature-flags"],
    queryFn: fetchFlags,
  });

  // Satır bazlı hata geri bildirimi (CLAUDE.md: "Hatalar kullanıcıya
  // anlaşılır Türkçe mesajlarla gösterilecek."). Toast primitive
  // yok; inline satır içi span kullanıyoruz.
  const [errorByKey, setErrorByKey] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: toggleFlag,
    onSuccess: (_data, variables) => {
      setErrorByKey((prev) => {
        if (!(variables.key in prev)) return prev;
        const next = { ...prev };
        delete next[variables.key];
        return next;
      });
      return qc.invalidateQueries({ queryKey: ["admin", "feature-flags"] });
    },
    onError: (err: Error, variables) => {
      setErrorByKey((prev) => ({ ...prev, [variables.key]: err.message }));
    },
  });

  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const all = data?.length ?? 0;
    const on = data?.filter((f) => f.enabled).length ?? 0;
    const off = all - on;
    return { all, on, off };
  }, [data]);

  const filtered = useMemo<FlagRow[]>(() => {
    if (!data) return [];
    let rows = data;
    if (filter === "on") rows = rows.filter((f) => f.enabled);
    else if (filter === "off") rows = rows.filter((f) => !f.enabled);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (f) =>
          f.key.toLowerCase().includes(q) ||
          displayName(f).toLowerCase().includes(q),
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
            placeholder="Flag anahtarı veya isim ara"
            aria-label="Flag anahtarı veya isim ara"
            prefix={<Search className="h-3.5 w-3.5 text-text-muted" aria-hidden />}
          />
        </div>
      }
      trailing={
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="h-3.5 w-3.5" aria-hidden />}
          disabled
          title="Yakında"
        >
          Yeni flag
        </Button>
      }
    >
      <FilterBar ariaLabel="Flag filtreleri">
        <Chip active={filter === "all"} onToggle={() => setFilter("all")}>
          Tümü · {counts.all}
        </Chip>
        <Chip active={filter === "on"} onToggle={() => setFilter("on")}>
          Açık · {counts.on}
        </Chip>
        <Chip active={filter === "off"} onToggle={() => setFilter("off")}>
          Kapalı · {counts.off}
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
        {counts.all} flag · {counts.on} açık
      </p>

      <Table density="admin">
        <THead>
          <TR>
            <TH>Flag</TH>
            <TH>Kapsam</TH>
            <TH>Durum</TH>
            <TH>Rollout</TH>
            <TH>Toggle</TH>
            <TH align="right">
              <span className="sr-only">Eylem</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {filtered.map((f) => {
            const name = displayName(f);
            const desc = description(f);
            const rolloutPercent = f.enabled ? 100 : 0;
            const isRowPending =
              mutation.isPending && mutation.variables?.key === f.key;
            const rowError = errorByKey[f.key];
            return (
              <TR key={f.id}>
                <TD>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-xs text-text-muted">
                      {f.key}
                    </span>
                    <span className="text-sm font-medium text-text">
                      {name}
                    </span>
                    {desc ? (
                      <span className="text-xs text-text-muted">{desc}</span>
                    ) : null}
                  </div>
                </TD>
                <TD>
                  <Badge tone="neutral">{f.scope}</Badge>
                </TD>
                <TD>
                  <Badge
                    tone={f.enabled ? "success" : "neutral"}
                    dot
                  >
                    {f.enabled ? "Açık" : "Kapalı"}
                  </Badge>
                </TD>
                <TD>
                  <div className="w-40">
                    <RolloutBar
                      percent={rolloutPercent}
                      aria-label={`${name} rollout yüzdesi`}
                    />
                  </div>
                </TD>
                <TD>
                  <div className="flex flex-col gap-1">
                    <Toggle
                      on={f.enabled}
                      onChange={(next) =>
                        mutation.mutate({ key: f.key, enabled: next })
                      }
                      size="sm"
                      disabled={isRowPending}
                      aria-label={`${name} flag'ini aç/kapat`}
                    />
                    {rowError ? (
                      <span
                        role="alert"
                        className="text-xs text-danger"
                      >
                        {rowError}
                      </span>
                    ) : null}
                  </div>
                </TD>
                <TD align="right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    title="Yakında"
                    aria-label={`${name} eylemleri (yakında)`}
                  >
                    ⋯
                  </Button>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
