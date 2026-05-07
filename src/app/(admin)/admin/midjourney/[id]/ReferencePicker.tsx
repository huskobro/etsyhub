"use client";

// Pass 58 — Reusable Reference picker (search + select).
//
// PromoteToReview ve TestRenderForm'da iki kez basit `<select>` kullanılıyordu;
// 50+ reference olan kullanıcılar için arama yoktu. Bu component:
//   • İlk render'da `/api/references?limit=50` lazy fetch
//   • Search input (300ms debounce) — `?q=...&limit=50` API arama
//   • Select option'lar: "ProductType.displayName · notes" (mevcut format)
//   • Reference seçildiğinde caller'a id + productTypeId iletilir (auto-fill)
//   • allowEmpty=true ise "— yok —" default option
//
// API zaten q parametresini destekliyor (listReferencesQuery.q optional;
// service notes contains insensitive). Sadece UI tarafı.

import { useEffect, useMemo, useRef, useState } from "react";

export type ReferenceOption = {
  id: string;
  productTypeId: string;
  label: string;
};

type ReferencePickerProps = {
  value: string;
  onChange: (refId: string, opt: ReferenceOption | null) => void;
  /** True ise "— yok —" default option (TestRenderForm). False (default)
   * ise ilk reference auto-select (PromoteToReview). */
  allowEmpty?: boolean;
  /** Empty option label (default "— yok (manuel promote) —"). */
  emptyLabel?: string;
  disabled?: boolean;
  /** "data-testid" prefix (PromoteToReview vs TestRenderForm ayrımı için). */
  testIdPrefix?: string;
};

export function ReferencePicker({
  value,
  onChange,
  allowEmpty = false,
  emptyLabel = "— yok (manuel promote) —",
  disabled = false,
  testIdPrefix = "ref-picker",
}: ReferencePickerProps) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ReferenceOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchSeq = useRef(0);

  // Lazy fetch + debounce (300ms).
  useEffect(() => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const url = new URL("/api/references", window.location.origin);
        url.searchParams.set("limit", "50");
        if (query.trim()) url.searchParams.set("q", query.trim());
        const res = await fetch(url.toString());
        const json: unknown = await res.json().catch(() => null);
        if (seq !== fetchSeq.current) return; // race guard
        const items = extractList(json);
        const mapped: ReferenceOption[] = items
          .map((r) => {
            const pt = r["productType"] as
              | { displayName?: string; key?: string }
              | undefined;
            const ptLabel = pt?.displayName ?? pt?.key ?? "?";
            const note =
              (r["notes"] as string | undefined)?.slice(0, 30) || "—";
            return {
              id: String(r["id"] ?? ""),
              productTypeId: String(r["productTypeId"] ?? ""),
              label: `${ptLabel} · ${note}`,
            };
          })
          .filter((r) => r.id);
        setOptions(mapped);
        setLoading(false);
        // İlk yükleme + value yoksa + allowEmpty=false → ilk option auto-select.
        if (!allowEmpty && !value && mapped.length > 0) {
          onChange(mapped[0]!.id, mapped[0]!);
        }
      } catch (err) {
        if (seq !== fetchSeq.current) return;
        setLoading(false);
        setError(err instanceof Error ? err.message : "Yüklenemedi");
        setOptions([]);
      }
    }, 300);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const optionMap = useMemo(() => {
    const m = new Map<string, ReferenceOption>();
    for (const o of options ?? []) m.set(o.id, o);
    return m;
  }, [options]);

  return (
    <div className="flex flex-col gap-1" data-testid={`${testIdPrefix}-wrap`}>
      <input
        type="search"
        placeholder="Reference ara…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
        className="rounded-md border border-border bg-bg px-2 py-1 text-xs disabled:opacity-50"
        data-testid={`${testIdPrefix}-search`}
      />
      <select
        value={value}
        onChange={(e) => {
          const id = e.target.value;
          onChange(id, id ? optionMap.get(id) ?? null : null);
        }}
        disabled={disabled || (loading && !options)}
        className="rounded-md border border-border bg-bg px-2 py-1 text-xs disabled:opacity-50"
        data-testid={`${testIdPrefix}-select`}
      >
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {!options && !allowEmpty ? (
          <option value="">Yükleniyor…</option>
        ) : null}
        {options && options.length === 0 && !allowEmpty ? (
          <option value="">Reference yok — önce ekle</option>
        ) : null}
        {(options ?? []).map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      {loading && options ? (
        <div className="text-xs text-text-muted">…</div>
      ) : null}
      {error ? <div className="text-xs text-danger">⚠ {error}</div> : null}
    </div>
  );
}

function extractList(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === "object") {
    if ("items" in json) {
      const items = (json as { items: unknown }).items;
      if (Array.isArray(items)) return items as Record<string, unknown>[];
    }
    if ("references" in json) {
      const refs = (json as { references: unknown }).references;
      if (Array.isArray(refs)) return refs as Record<string, unknown>[];
    }
  }
  return [];
}
