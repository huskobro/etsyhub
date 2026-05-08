"use client";

// Pass 90 — Kept Workspace: Filter bar.
//
// Chip'ler:
//   - Variant: all/GRID/UPSCALE/VARIATION
//   - Search: prompt
//   - Scope chip (batchId/templateId varsa) ✕ ile clear
//
// Batch chip'leri ana sayfa header'ında summary kısmından gelir
// (KeptBatchGroup); buradaki filter zaten URL'de set edilmişse
// görünür.

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

const VARIANT_CHIPS: Array<{
  key: "all" | "GRID" | "UPSCALE" | "VARIATION";
  label: string;
}> = [
  { key: "all", label: "Tümü" },
  { key: "GRID", label: "Grid" },
  { key: "UPSCALE", label: "Upscale" },
  { key: "VARIATION", label: "Variation" },
];

export function KeptFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const currentVariant = params.get("variantKind") ?? "all";
  const currentBatchId = params.get("batchId");
  const currentTemplateId = params.get("templateId");
  const [keyword, setKeyword] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  function pushWith(updater: (sp: URLSearchParams) => void) {
    const sp = new URLSearchParams(params.toString());
    sp.delete("cursorId");
    updater(sp);
    startTransition(() => {
      router.push(`/admin/midjourney/kept?${sp.toString()}`);
    });
  }

  function setVariant(v: string) {
    pushWith((sp) => {
      if (v === "all") sp.delete("variantKind");
      else sp.set("variantKind", v);
    });
  }

  function applyKeyword(e: React.FormEvent) {
    e.preventDefault();
    pushWith((sp) => {
      const q = keyword.trim();
      if (q.length === 0) sp.delete("q");
      else sp.set("q", q);
    });
  }

  function clearScope(key: string) {
    pushWith((sp) => sp.delete(key));
  }

  function clearAll() {
    setKeyword("");
    startTransition(() => {
      router.push("/admin/midjourney/kept");
    });
  }

  const hasFilter =
    currentVariant !== "all" ||
    currentBatchId !== null ||
    currentTemplateId !== null ||
    (params.get("q") ?? "").length > 0;

  return (
    <div
      className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3"
      data-testid="mj-kept-filters"
    >
      {currentBatchId || currentTemplateId ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-text-muted">Kapsam:</span>
          {currentBatchId ? (
            <button
              type="button"
              onClick={() => clearScope("batchId")}
              disabled={pending}
              className="rounded-full border border-accent bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent disabled:opacity-50"
              data-testid="mj-kept-scope-batch"
            >
              batch {currentBatchId.slice(0, 8)} ✕
            </button>
          ) : null}
          {currentTemplateId ? (
            <button
              type="button"
              onClick={() => clearScope("templateId")}
              disabled={pending}
              className="rounded-full border border-accent bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent disabled:opacity-50"
              data-testid="mj-kept-scope-template"
            >
              template {currentTemplateId.slice(0, 8)} ✕
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-text-muted">Tür:</span>
        {VARIANT_CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setVariant(c.key)}
            disabled={pending}
            className={
              "rounded-full border px-2 py-0.5 text-xs transition disabled:opacity-50 " +
              (currentVariant === c.key
                ? "border-accent bg-accent text-on-accent font-semibold"
                : "border-border bg-bg text-text-muted hover:border-border-strong hover:text-text")
            }
            data-testid={`mj-kept-variant-${c.key}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={applyKeyword}
        className="flex flex-wrap items-center gap-2"
      >
        <span className="text-xs font-semibold text-text-muted">Arama:</span>
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="prompt içeriğinde ara…"
          disabled={pending}
          className="w-64 rounded-md border border-border bg-bg px-3 py-1 text-xs disabled:opacity-50"
          data-testid="mj-kept-q-input"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-text-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
          data-testid="mj-kept-q-submit"
        >
          Ara
        </button>
        {hasFilter ? (
          <button
            type="button"
            onClick={clearAll}
            disabled={pending}
            className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-text-muted transition hover:border-danger hover:text-danger disabled:opacity-50"
            data-testid="mj-kept-clear"
          >
            ✕ Filtreleri temizle
          </button>
        ) : null}
      </form>
    </div>
  );
}
