/* eslint-disable no-restricted-syntax */
// OverviewClient — Kivasy v6 C3 Overview surface.
// Source: docs/design-system/kivasy/ui_kits/kivasy/v6/screens-c3.jsx
//
// 4-block layout:
//   1. Pipeline Pulse — 6-stage horizontal strip (References / Batches /
//      Library / Selections / Products / Etsy Drafts), color-tinted
//      left-edge bar (orange upstream, purple midstream, blue downstream)
//   2. Pending Actions — 2/3 column, 4 sub-section (Needs review / Mockup
//      ready / Drafts to send / Failed batches)
//   3. Active Batches — 1/3 column, real-time progress bars + ETA
//   4. Recent Activity — cross-surface log, 8 events
//
// v6 sabit boyutlar (k-display 26px, k-mono 9.5/10/10.5/11/11.5/12/12.5/13px)
// Whitelisted in scripts/check-tokens.ts.
"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCheck,
  Eye,
  ImageIcon,
  Loader2,
  Send,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import type {
  PipelinePulseData,
  PendingActionsData,
  ActiveBatchRow,
  RecentActivityRow,
} from "@/server/services/overview";

interface OverviewClientProps {
  pipeline: PipelinePulseData;
  pending: PendingActionsData;
  activeBatches: ActiveBatchRow[];
  recentActivity: RecentActivityRow[];
}

type StageTone = "orange" | "purple" | "blue";

interface StageDef {
  key: keyof PipelinePulseData;
  label: string;
  href: string;
  tone: StageTone;
  pulse?: boolean;
}

const STAGE_DEFS: StageDef[] = [
  { key: "references", label: "REFERENCES", href: "/references", tone: "orange" },
  { key: "batches", label: "BATCHES", href: "/batches", tone: "orange", pulse: true },
  { key: "library", label: "LIBRARY", href: "/library", tone: "purple" },
  { key: "selections", label: "SELECTIONS", href: "/selections", tone: "purple" },
  { key: "products", label: "PRODUCTS", href: "/products", tone: "blue" },
  { key: "etsyDrafts", label: "ETSY DRAFT", href: "/products?status=submitted", tone: "blue" },
];

const TONE_BG: Record<StageTone, string> = {
  orange: "bg-k-orange",
  purple: "bg-k-purple",
  blue: "bg-info",
};

function relativeTime(d: Date): string {
  const ms = Date.now() - d.getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function OverviewClient({
  pipeline,
  pending,
  activeBatches,
  recentActivity,
}: OverviewClientProps) {
  const subtitle = new Date()
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();

  return (
    <div
      className="-m-6 flex h-screen flex-col"
      data-testid="overview-page"
    >
      {/* Topbar */}
      <header className="flex flex-shrink-0 items-center gap-4 border-b border-line bg-bg px-6 py-4">
        <div className="flex-1">
          <h1 className="k-display text-lg font-semibold tracking-tight text-ink">
            Overview
          </h1>
          <p className="mt-0.5 font-mono text-xs uppercase tracking-meta text-ink-3">
            {subtitle}
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-7 pb-12 pt-5">
        {/* ── Block 1: Pipeline Pulse */}
        <section className="overflow-hidden rounded-md border border-line bg-paper shadow-card">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {STAGE_DEFS.map((s, i) => {
              const stage = pipeline[s.key];
              const isLast = i === STAGE_DEFS.length - 1;
              const showRunningPulse =
                s.key === "batches" && pipeline.batches.running > 0;
              return (
                <Link
                  key={s.key}
                  href={s.href}
                  className={cn(
                    "group relative px-4 py-4 transition-colors hover:bg-k-bg-2",
                    !isLast && "lg:border-r lg:border-line-soft",
                  )}
                  data-stage={s.key}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute bottom-3 left-0 top-3 w-[3px] rounded-r",
                      TONE_BG[s.tone],
                    )}
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[9.5px] uppercase tracking-meta text-ink-3">
                      {s.label}
                    </span>
                    {showRunningPulse ? (
                      <span className="relative inline-block h-1.5 w-1.5">
                        <span className="absolute inset-0 rounded-full bg-k-amber" />
                        <span className="absolute -inset-0.5 animate-ping rounded-full bg-k-amber opacity-30" />
                      </span>
                    ) : null}
                  </div>
                  <div className="k-display mt-2 text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink">
                    {stage.total.toLocaleString("en-US")}
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="truncate text-[11.5px] text-ink-2">
                      {stage.sub}
                    </span>
                    <ArrowRight
                      className="ml-auto h-3 w-3 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ── Block 2 + 3: Pending Actions (2/3) + Active Batches (1/3) */}
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Pending Actions */}
          <section className="space-y-3 lg:col-span-2">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[15.5px] font-semibold tracking-tight text-ink">
                Pending actions
              </h2>
              <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                {pending.needsReview.total +
                  pending.mockupReady.total +
                  pending.draftsToSend.total}{" "}
                ITEMS WAITING
              </span>
            </div>

            <PendingSectionView
              section={pending.needsReview}
              actionLabel="Open Review"
              actionIcon={<Eye className="h-3 w-3" aria-hidden />}
              cta="primary"
            />
            <PendingSectionView
              section={pending.mockupReady}
              actionLabel="Apply Mockups"
              actionIcon={<ImageIcon className="h-3 w-3" aria-hidden />}
              cta="primary"
            />
            <PendingSectionView
              section={pending.draftsToSend}
              actionLabel="Send to Etsy as Draft"
              actionIcon={<Send className="h-3 w-3" aria-hidden />}
              cta="publish"
            />

            {pending.failedBatches.total === 0 ? (
              <PendingEmpty
                title="Failed batches"
                line={
                  <span className="flex items-center gap-1.5">
                    <CheckCheck className="h-3 w-3 text-success" aria-hidden />
                    All caught up · 0 items waiting
                  </span>
                }
              />
            ) : (
              <PendingSectionView
                section={pending.failedBatches}
                actionLabel="Inspect"
                actionIcon={<ArrowRight className="h-3 w-3" aria-hidden />}
                cta="secondary"
              />
            )}
          </section>

          {/* Active Batches */}
          <section className="overflow-hidden rounded-md border border-line bg-paper">
            <div className="flex items-baseline gap-2 border-b border-line-soft px-4 py-2.5">
              <h3 className="text-[12.5px] font-semibold tracking-tight text-ink">
                Active batches
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
                {activeBatches.length} RUNNING
              </span>
            </div>
            {activeBatches.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[12.5px] text-ink-3">
                  No active batches.
                </p>
                <p className="mt-1 font-mono text-[10.5px] uppercase tracking-meta text-ink-4">
                  Start a new variation batch from Library.
                </p>
                <Link
                  href="/library?intent=start-batch"
                  className="mt-2 inline-flex h-7 items-center rounded-md border border-line bg-paper px-2 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink"
                >
                  Go to Library
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-line-soft">
                {activeBatches.map((b) => {
                  const pct = b.total > 0 ? (b.done / b.total) * 100 : 0;
                  return (
                    <Link
                      key={b.batchId}
                      href={b.href}
                      className="block px-4 py-3 transition-colors hover:bg-k-bg-2"
                    >
                      <div className="mb-1.5 flex items-baseline gap-2">
                        <div className="truncate text-[13px] font-medium text-ink">
                          {b.name}
                        </div>
                        <div className="ml-auto flex items-center gap-1 font-mono text-[10px] tabular-nums tracking-meta text-ink-3">
                          {b.eta === "running" ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          ) : null}
                          {b.eta}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-line-soft">
                          <div
                            className="h-full rounded-full bg-k-orange transition-all"
                            style={{ width: `${Math.max(2, pct)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10.5px] tabular-nums tracking-meta text-ink-2">
                          {b.done}/{b.total}
                        </span>
                      </div>
                      <div className="mt-1.5 font-mono text-[10px] tracking-meta text-ink-3">
                        batch_{b.batchId.slice(0, 8)}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ── Block 4: Recent Activity */}
        <section className="overflow-hidden rounded-md border border-line bg-paper">
          <div className="flex items-baseline gap-2 border-b border-line-soft px-4 py-2.5">
            <h3 className="text-[12.5px] font-semibold tracking-tight text-ink">
              Recent activity
            </h3>
            <span className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
              CROSS-SURFACE LOG
            </span>
          </div>
          {recentActivity.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[12.5px] text-ink-3">
                No recent activity yet.
              </p>
              <p className="mt-1 font-mono text-[10.5px] uppercase tracking-meta text-ink-4">
                Recipe runs · batch completions · mockup activations land here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-line-soft">
              {recentActivity.map((e, i) => (
                <Link
                  key={`${e.timestamp.toISOString()}-${i}`}
                  href={e.href}
                  className="grid items-center gap-3 px-4 py-2.5 transition-colors hover:bg-k-bg-2"
                  style={{
                    gridTemplateColumns: "60px 1fr 1fr 90px 24px",
                  }}
                >
                  <span className="font-mono text-[11px] tabular-nums tracking-meta text-ink-3">
                    {relativeTime(e.timestamp)}
                  </span>
                  <span className="truncate text-[13px] font-medium text-ink">
                    {e.event}
                  </span>
                  <span className="truncate text-[12px] text-ink-2">
                    {e.meta}
                  </span>
                  <Badge
                    tone={
                      e.tone === "purple"
                        ? "info"
                        : e.tone === "neutral"
                          ? "neutral"
                          : e.tone
                    }
                  >
                    {e.tone === "neutral"
                      ? "EVENT"
                      : e.tone === "success"
                        ? "SUCCESS"
                        : e.tone === "warning"
                          ? "WARNING"
                          : e.tone === "info"
                            ? "PUBLISH"
                            : "EDIT"}
                  </Badge>
                  <ArrowRight
                    className="h-3 w-3 text-ink-4"
                    aria-hidden
                  />
                </Link>
              ))}
            </div>
          )}
          <div className="flex justify-end border-t border-line-soft px-4 py-2">
            <Link
              href="/settings?pane=notifications"
              className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-ink-2 hover:text-ink"
            >
              View full activity (Inbox)
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function PendingSectionView({
  section,
  actionLabel,
  actionIcon,
  cta = "primary",
}: {
  section: { title: string; total: number; rows: { id: string; name: string; meta: string; href: string }[] };
  actionLabel: string;
  actionIcon: React.ReactNode;
  /** k-btn recipe variant. Source: docs/design-system/kivasy/v6/screens-c3.jsx
   *  PendingSection cta="primary" (orange) | "publish" (blue). secondary
   *  warning fallback için. */
  cta?: "primary" | "publish" | "secondary";
}) {
  const visible = section.rows.slice(0, 4);
  if (section.total === 0) {
    return (
      <PendingEmpty
        title={section.title}
        line={
          <span className="flex items-center gap-1.5">
            <CheckCheck className="h-3 w-3 text-success" aria-hidden />
            All caught up
          </span>
        }
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-md border border-line bg-paper">
      <div className="flex items-baseline gap-2 border-b border-line-soft px-4 py-2.5">
        <h3 className="text-[12.5px] font-semibold tracking-tight text-ink">
          {section.title}
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
          {section.total}
        </span>
      </div>
      <div className="divide-y divide-line-soft">
        {visible.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-k-bg-2"
          >
            <Link
              href={r.href}
              className="min-w-0 flex-1"
            >
              <div className="truncate text-[13.5px] font-medium text-ink hover:text-k-orange">
                {r.name}
              </div>
              <div className="mt-0.5 font-mono text-[10.5px] tabular-nums tracking-meta text-ink-3">
                {r.meta}
              </div>
            </Link>
            <Link
              href={r.href}
              data-size="sm"
              className={cn("k-btn", `k-btn--${cta}`)}
            >
              {actionIcon}
              {actionLabel}
            </Link>
          </div>
        ))}
      </div>
      {section.total > visible.length ? (
        <div className="flex justify-end border-t border-line-soft px-4 py-2">
          <Link
            href={visible[0]?.href ?? "#"}
            className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-ink-2 hover:text-ink"
          >
            View all ({section.total})
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function PendingEmpty({
  title,
  line,
}: {
  title: string;
  line: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2 rounded-md border border-line bg-paper px-4 py-3">
      <h3 className="text-[12.5px] font-semibold tracking-tight text-ink">
        {title}
      </h3>
      <span className="ml-auto text-[12px] text-ink-3">{line}</span>
    </div>
  );
}
