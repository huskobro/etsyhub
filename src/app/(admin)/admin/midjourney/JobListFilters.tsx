"use client";

// Pass 63 — List filter UI: gün chip'leri + keyword search.
//
// URL state ile persistent (?days=today|yesterday|7d|all & ?q=...).
// Server component query bunu okur.

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

const DAY_CHIPS: Array<{ key: "today" | "yesterday" | "7d" | "all"; label: string }> = [
  { key: "all", label: "Tümü" },
  { key: "today", label: "Bugün" },
  { key: "yesterday", label: "Dün" },
  { key: "7d", label: "Son 7 gün" },
];

export function JobListFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const currentDays = params.get("days") ?? "all";
  const [keyword, setKeyword] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  function setDays(days: string) {
    const sp = new URLSearchParams(params.toString());
    if (days === "all") sp.delete("days");
    else sp.set("days", days);
    startTransition(() => {
      router.push(`/admin/midjourney?${sp.toString()}`);
    });
  }

  function applyKeyword(e: React.FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams(params.toString());
    const q = keyword.trim();
    if (q.length === 0) sp.delete("q");
    else sp.set("q", q);
    startTransition(() => {
      router.push(`/admin/midjourney?${sp.toString()}`);
    });
  }

  function clearAll() {
    setKeyword("");
    startTransition(() => {
      router.push(`/admin/midjourney`);
    });
  }

  const hasFilter = currentDays !== "all" || (params.get("q") ?? "").length > 0;

  return (
    <div
      className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3"
      data-testid="mj-list-filters"
    >
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
            data-testid={`mj-filter-day-${c.key}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <form onSubmit={applyKeyword} className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-text-muted">Arama:</span>
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="prompt, mjJobId veya bridgeJobId…"
          disabled={pending}
          className="w-72 flex-1 rounded-md border border-border bg-bg px-3 py-1 text-xs disabled:opacity-50"
          data-testid="mj-filter-q-input"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-text-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
          data-testid="mj-filter-q-submit"
        >
          Ara
        </button>
        {hasFilter ? (
          <button
            type="button"
            onClick={clearAll}
            disabled={pending}
            className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-text-muted transition hover:border-danger hover:text-danger disabled:opacity-50"
            data-testid="mj-filter-clear"
          >
            ✕ Filtreleri temizle
          </button>
        ) : null}
      </form>
    </div>
  );
}
