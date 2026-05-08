"use client";

// Pass 88 — Asset Library V1: Filter bar.
//
// URL state ile persistent (?days, ?variantKind, ?q, ?batchId, ?templateId,
// ?parentAssetId). Server component query'leri bu URL'i okur.
//
// Pass 87 JobListFilters'a benzer pattern; library scope'unda variantKind +
// batch/template/parent rozetleri farkı.

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { VARIANT_KIND_OPTIONS } from "./variantKindHelper";

const DAY_CHIPS: Array<{ key: "recent" | "7d" | "30d" | "all"; label: string }> =
  [
    { key: "recent", label: "Son 7 gün" },
    { key: "30d", label: "Son 30 gün" },
    { key: "all", label: "Tümü" },
  ];

// Pass 89 — Review decision filter chip'leri (Library scope)
const DECISION_CHIPS: Array<{
  key: "all" | "UNDECIDED" | "KEPT" | "REJECTED";
  label: string;
}> = [
  { key: "all", label: "Tümü" },
  { key: "KEPT", label: "✓ Tutulanlar" },
  { key: "UNDECIDED", label: "Bekleyenler" },
  { key: "REJECTED", label: "Reddedilenler" },
];

export function LibraryFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const currentDays = params.get("days") ?? "recent";
  const currentVariant = params.get("variantKind") ?? "ALL";
  const currentDecision = params.get("reviewDecision") ?? "all";
  const currentBatchId = params.get("batchId");
  const currentTemplateId = params.get("templateId");
  const currentParentAssetId = params.get("parentAssetId");
  const [keyword, setKeyword] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  function pushWith(updater: (sp: URLSearchParams) => void) {
    const sp = new URLSearchParams(params.toString());
    // Cursor'ı her filtre değişiminde sıfırla (yeni sayfaya geçilir).
    sp.delete("cursorId");
    updater(sp);
    startTransition(() => {
      router.push(`/admin/midjourney/library?${sp.toString()}`);
    });
  }

  function setDays(days: string) {
    pushWith((sp) => {
      if (days === "recent") sp.delete("days");
      else sp.set("days", days);
    });
  }

  function setVariant(v: string) {
    pushWith((sp) => {
      if (v === "ALL") sp.delete("variantKind");
      else sp.set("variantKind", v);
    });
  }

  function setDecision(d: string) {
    pushWith((sp) => {
      if (d === "all") sp.delete("reviewDecision");
      else sp.set("reviewDecision", d);
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

  function clearScopeChip(key: string) {
    pushWith((sp) => sp.delete(key));
  }

  function clearAll() {
    setKeyword("");
    startTransition(() => {
      router.push(`/admin/midjourney/library`);
    });
  }

  const hasAnyFilter =
    currentDays !== "recent" ||
    currentVariant !== "ALL" ||
    currentDecision !== "all" ||
    currentBatchId !== null ||
    currentTemplateId !== null ||
    currentParentAssetId !== null ||
    (params.get("q") ?? "").length > 0;

  return (
    <div
      className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3"
      data-testid="mj-library-filters"
    >
      {/* Scope chip'leri (batch/template/parent) — varsa görünür, ✕ ile clear */}
      {currentBatchId || currentTemplateId || currentParentAssetId ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-text-muted">
            Kapsam:
          </span>
          {currentBatchId ? (
            <button
              type="button"
              onClick={() => clearScopeChip("batchId")}
              disabled={pending}
              className="rounded-full border border-accent bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent hover:no-underline disabled:opacity-50"
              data-testid="mj-library-scope-batch"
            >
              batch {currentBatchId.slice(0, 8)} ✕
            </button>
          ) : null}
          {currentTemplateId ? (
            <button
              type="button"
              onClick={() => clearScopeChip("templateId")}
              disabled={pending}
              className="rounded-full border border-accent bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent disabled:opacity-50"
              data-testid="mj-library-scope-template"
            >
              template {currentTemplateId.slice(0, 8)} ✕
            </button>
          ) : null}
          {currentParentAssetId ? (
            <button
              type="button"
              onClick={() => clearScopeChip("parentAssetId")}
              disabled={pending}
              className="rounded-full border border-accent bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent disabled:opacity-50"
              data-testid="mj-library-scope-parent"
            >
              parent {currentParentAssetId.slice(0, 8)} ✕
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-text-muted">Tarih:</span>
        {DAY_CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setDays(c.key)}
            disabled={pending}
            className={
              "rounded-full border px-2 py-0.5 text-xs transition disabled:opacity-50 " +
              (currentDays === c.key
                ? "border-accent bg-accent text-on-accent font-semibold"
                : "border-border bg-bg text-text-muted hover:border-border-strong hover:text-text")
            }
            data-testid={`mj-library-day-${c.key}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-text-muted">Tür:</span>
        {VARIANT_KIND_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setVariant(opt.value)}
            disabled={pending}
            className={
              "rounded-full border px-2 py-0.5 text-xs transition disabled:opacity-50 " +
              (currentVariant === opt.value
                ? "border-accent bg-accent text-on-accent font-semibold"
                : "border-border bg-bg text-text-muted hover:border-border-strong hover:text-text")
            }
            data-testid={`mj-library-variant-${opt.value}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Pass 89 — Review decision filter (Library scope) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-text-muted">Karar:</span>
        {DECISION_CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setDecision(c.key)}
            disabled={pending}
            className={
              "rounded-full border px-2 py-0.5 text-xs transition disabled:opacity-50 " +
              (currentDecision === c.key
                ? "border-accent bg-accent text-on-accent font-semibold"
                : "border-border bg-bg text-text-muted hover:border-border-strong hover:text-text")
            }
            data-testid={`mj-library-decision-${c.key}`}
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
          className="w-72 flex-1 rounded-md border border-border bg-bg px-3 py-1 text-xs disabled:opacity-50"
          data-testid="mj-library-q-input"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-text-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
          data-testid="mj-library-q-submit"
        >
          Ara
        </button>
        {hasAnyFilter ? (
          <button
            type="button"
            onClick={clearAll}
            disabled={pending}
            className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-text-muted transition hover:border-danger hover:text-danger disabled:opacity-50"
            data-testid="mj-library-clear"
          >
            ✕ Filtreleri temizle
          </button>
        ) : null}
      </form>
    </div>
  );
}
