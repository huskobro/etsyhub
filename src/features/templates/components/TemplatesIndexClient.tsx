/* eslint-disable no-restricted-syntax */
// TemplatesIndexClient — Kivasy v6 C1 surface; v6 sabit tipografi:
//  · text-[13.5px] / text-[10.5px] / text-[14px] / text-[14.5px] yarı-piksel
//    typography (table + card body, A2 / A5 paterni ile tutarlı).
//  · `.k-card--hero` 2-col grid recipe Recipes tab'ında.
//  · max-w-sm search input + grid columns 32/1fr/200/200/80 sabitleri.
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Download,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import type {
  PromptTemplateRow,
  MockupTemplateRow,
  RecipeRow,
  TemplatesCounts,
} from "@/server/services/templates/index-view";

/**
 * TemplatesIndexClient — Kivasy C1 Templates surface.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v6/screens-c1.jsx →
 * C1Templates.
 *
 * 4 sub-tabs: Prompts · Presets · Mockups · Recipes. Each sub-type uses
 * its native layout per v6 spec — no detail page; URL state preserved
 * via ?sub=prompts|presets|mockups|recipes.
 *
 * Boundary (docs/IMPLEMENTATION_HANDOFF.md §7):
 *   Templates = system surface. Read-only listing in R6; CRUD lands in
 *   R7+. No new IA — sub-types are filterable categories within one
 *   route.
 */

type SubTab = "prompts" | "presets" | "mockups" | "recipes";

interface TemplatesIndexClientProps {
  counts: TemplatesCounts;
  prompts: PromptTemplateRow[];
  mockups: MockupTemplateRow[];
  recipes: RecipeRow[];
}

export function TemplatesIndexClient({
  counts,
  prompts,
  mockups,
  recipes,
}: TemplatesIndexClientProps) {
  const router = useRouter();
  const params = useSearchParams();
  const sub = (params.get("sub") as SubTab | null) ?? "prompts";

  function setSub(next: SubTab) {
    const sp = new URLSearchParams(params.toString());
    if (next === "prompts") sp.delete("sub");
    else sp.set("sub", next);
    const qs = sp.toString();
    router.push(qs ? `/templates?${qs}` : "/templates");
  }

  const totals = counts.prompts + counts.presets + counts.mockups + counts.recipes;

  const subTabs: Array<{ id: SubTab; label: string; count: number }> = [
    { id: "prompts", label: "Prompt Templates", count: counts.prompts },
    { id: "presets", label: "Style Presets", count: counts.presets },
    { id: "mockups", label: "Mockup Templates", count: counts.mockups },
    { id: "recipes", label: "Product Recipes", count: counts.recipes },
  ];

  const sectionRight =
    sub === "mockups" ? (
      <button
        type="button"
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-3 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink disabled:opacity-50"
        disabled
        title="Upload PSD ships in R7"
      >
        <Upload className="h-3 w-3" aria-hidden />
        Upload PSD
      </button>
    ) : sub === "recipes" ? (
      <button
        type="button"
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-3 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink disabled:opacity-50"
        disabled
        title="Import recipe ships in R7"
      >
        <Download className="h-3 w-3" aria-hidden />
        Import recipe
      </button>
    ) : null;

  return (
    <div
      className="-m-6 flex h-screen flex-col"
      data-testid="templates-page"
    >
      {/* Header */}
      <header className="flex items-center gap-4 border-b border-line bg-bg px-6 py-4">
        <div className="flex-1">
          <h1 className="k-display text-lg font-semibold tracking-tight text-ink">
            Templates
          </h1>
          <p className="mt-0.5 font-mono text-xs uppercase tracking-meta text-ink-3">
            {totals} · 4 sub-types
          </p>
        </div>
        <button
          type="button"
          data-size="sm"
          className="k-btn k-btn--primary"
          disabled
          title="New Template ships in R7"
          data-testid="templates-new-cta"
        >
          <Plus className="h-3 w-3" aria-hidden />
          New Template
        </button>
      </header>

      {/* Sibling tabs (sub-type selector) */}
      <div className="flex items-center gap-3 border-b border-line bg-bg px-6 pt-3 pb-3">
        <div className="flex gap-0.5">
          {subTabs.map((t) => {
            const active = t.id === sub;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSub(t.id)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-paper text-ink shadow-card"
                    : "text-ink-3 hover:text-ink-2",
                )}
                data-testid={`templates-tab-${t.id}`}
              >
                <span>{t.label}</span>
                <span
                  className={cn(
                    "font-mono text-xs tabular-nums",
                    active ? "text-ink-2" : "text-ink-3",
                  )}
                >
                  · {t.count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto">{sectionRight}</div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {sub === "prompts" ? <PromptsSubview rows={prompts} /> : null}
        {sub === "presets" ? <PresetsSubview /> : null}
        {sub === "mockups" ? <MockupsSubview rows={mockups} /> : null}
        {sub === "recipes" ? <RecipesSubview rows={recipes} /> : null}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Prompts subview
// ────────────────────────────────────────────────────────────

function PromptsSubview({ rows }: { rows: PromptTemplateRow[] }) {
  const [q, setQ] = useState("");
  const filtered = rows.filter((r) =>
    r.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="overflow-hidden rounded-md border border-line bg-paper">
      <div className="flex items-center gap-3 border-b border-line-soft px-4 py-3">
        <div className="relative max-w-sm flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search prompts…"
            className="h-8 w-full rounded-md border border-line bg-paper pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
            data-testid="templates-prompts-search"
          />
        </div>
        <span className="ml-auto font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
          {filtered.length} of {rows.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <h3 className="text-base font-semibold text-ink">
            {rows.length === 0
              ? "No prompt templates yet"
              : "No prompts match this search"}
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            {rows.length === 0
              ? "Prompt templates power the variation pipeline. CRUD UI lands in R7."
              : "Clear search or try another keyword."}
          </p>
        </div>
      ) : (
        <table
          className="w-full"
          data-testid="templates-prompts-table"
          aria-label="Prompt templates"
        >
          <thead>
            <tr>
              <th className="border-b border-line-soft bg-k-bg-2/40 px-4 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-meta text-ink-3">
                Prompt
              </th>
              <th className="w-32 border-b border-line-soft bg-k-bg-2/40 px-3 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-meta text-ink-3">
                Task
              </th>
              <th className="w-32 border-b border-line-soft bg-k-bg-2/40 px-3 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-meta text-ink-3">
                Provider
              </th>
              <th className="w-28 border-b border-line-soft bg-k-bg-2/40 px-3 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-meta text-ink-3">
                Versions
              </th>
              <th className="w-28 border-b border-line-soft bg-k-bg-2/40 px-3 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-meta text-ink-3">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="border-b border-line-soft last:border-b-0 hover:bg-k-bg-2/30"
                data-testid="templates-prompts-row"
              >
                <td className="px-4 py-3">
                  <div className="text-[13.5px] font-medium text-ink">
                    {r.name}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-ink-3">
                    {r.id}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Badge tone="neutral">{r.taskType}</Badge>
                </td>
                <td className="px-3 py-3">
                  <Badge tone="neutral">{r.providerKind}</Badge>
                </td>
                <td className="px-3 py-3 font-mono text-[12.5px] tabular-nums text-ink-2">
                  v{r.activeVersion ?? "—"} / {r.versionCount}
                </td>
                <td className="px-3 py-3 font-mono text-xs text-ink-3">
                  {relativeDate(r.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Presets subview (R7 deferred)
// ────────────────────────────────────────────────────────────

function PresetsSubview() {
  return (
    <div className="rounded-md border border-dashed border-line bg-paper px-6 py-12 text-center">
      <h3 className="text-base font-semibold text-ink">
        Style Presets — coming in R7
      </h3>
      <p className="mt-1 text-sm text-text-muted">
        Aspect ratio + similarity + palette + weight bundles for re-use across
        batches. Schema and CRUD ship next rollout.
      </p>
      <p className="mt-3 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
        Wave D · Templates CRUD
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Mockups subview — 3 sınıf gruplu (CLAUDE.md §6 mockup model)
// ────────────────────────────────────────────────────────────

function MockupsSubview({ rows }: { rows: MockupTemplateRow[] }) {
  // V1 classifier: tags / name'den derive (kind enum eksik R6'da).
  const groups: Record<
    "lifestyle" | "bundle" | "user",
    MockupTemplateRow[]
  > = { lifestyle: [], bundle: [], user: [] };
  for (const r of rows) {
    const hay = (r.name + " " + r.tags.join(" ")).toLowerCase();
    if (
      hay.includes("bundle") ||
      hay.includes("sheet") ||
      hay.includes("preview")
    ) {
      groups.bundle.push(r);
    } else if (
      hay.includes("psd") ||
      hay.includes("custom") ||
      hay.includes("user")
    ) {
      groups.user.push(r);
    } else {
      groups.lifestyle.push(r);
    }
  }

  const sectionMeta: Array<{
    id: "lifestyle" | "bundle" | "user";
    label: string;
    sub: string;
  }> = [
    { id: "lifestyle", label: "Lifestyle scenes", sub: "Room · desk · context" },
    { id: "bundle", label: "Bundle Preview Sheets", sub: "Multi-design composites" },
    { id: "user", label: "My Templates", sub: "Operator-uploaded PSDs" },
  ];

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line bg-paper px-6 py-12 text-center">
        <h3 className="text-base font-semibold text-ink">
          No mockup templates yet
        </h3>
        <p className="mt-1 text-sm text-text-muted">
          Mockup templates land here as the catalog grows. Upload PSD action
          ships in R7.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {sectionMeta.map((g) => {
        const items = groups[g.id];
        if (items.length === 0) return null;
        return (
          <section key={g.id}>
            <div className="mb-3 flex items-baseline gap-3">
              <h3 className="text-[14px] font-semibold tracking-tight text-ink">
                {g.label}
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
                {g.sub} · {items.length}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {items.map((m) => (
                <div
                  key={m.id}
                  className="k-card overflow-hidden p-3"
                  data-testid="templates-mockup-tile"
                >
                  <div className="mb-3 aspect-square overflow-hidden rounded-md bg-k-bg-2">
                    {m.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.thumbnailUrl}
                        alt={m.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <div className="truncate text-[13px] font-medium text-ink">
                    {m.name}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {m.aspectRatios.slice(0, 2).map((a) => (
                      <span
                        key={a}
                        className="rounded bg-k-bg-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-2"
                      >
                        {a}
                      </span>
                    ))}
                    <Badge
                      tone={m.status === "ACTIVE" ? "success" : "neutral"}
                    >
                      {m.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Recipes subview
// ────────────────────────────────────────────────────────────

function RecipesSubview({ rows }: { rows: RecipeRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line bg-paper px-6 py-12 text-center">
        <h3 className="text-base font-semibold text-ink">No recipes yet</h3>
        <p className="mt-1 text-sm text-text-muted">
          Recipes bundle prompt + preset + mockup + listing into one click.
          CRUD UI ships in R7.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => (
        <div
          key={r.id}
          className="k-card k-card--hero overflow-hidden p-4"
          data-testid="templates-recipe-card"
        >
          <div className="text-[14.5px] font-semibold leading-snug text-ink">
            {r.name}
          </div>
          <div className="mt-1 font-mono text-xs text-ink-3">
            {r.key}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {r.productTypeDisplay ? (
              <Badge tone="neutral">{r.productTypeDisplay}</Badge>
            ) : null}
            {r.isSystem ? <Badge tone="info">SYSTEM</Badge> : null}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line-soft pt-2.5">
            <span className="font-mono text-xs text-ink-3">
              {relativeDate(r.updatedAt)}
            </span>
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-ink-2 hover:text-ink disabled:opacity-50"
              disabled
              title="Run recipe ships in R7"
            >
              Run
              <ArrowRight className="h-3 w-3" aria-hidden />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function relativeDate(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("tr-TR");
}
