/* eslint-disable no-restricted-syntax */
// PaneReview — IA Phase 17. Review scoring config admin surface.
//
// CLAUDE.md Madde O — admin manages review scoring through three
// surfaces inside this pane:
//   1. Decision rule snapshot (threshold low/high, mid-band default,
//      blocker semantics, scoring math overview)
//   2. Master prompt editor — edit the spine (placeholder
//      {{CRITERIA_BLOCK_LIST}} required), see final composed
//      preview live, revert to builtin
//   3. Criteria manager — per-criterion editor: label, description,
//      block text, weight, severity, active toggle, applicability
//      delta + revert. Changes persist via /api/settings/review.
//
// "Compose token" raw string is no longer surfaced. The fingerprint
// (= prompt version signature) lives under a Developer / Audit
// disclosure for engineers; the primary admin focus is on the
// final prompt preview, active blocks, weights, applicability.
//
// EN-only UI per CLAUDE.md Dil Kuralı update.

"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ChevronDown, ChevronRight, RotateCcw, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  REVIEW_THRESHOLD_HIGH,
  REVIEW_THRESHOLD_LOW,
} from "@/server/services/review/decision";

type Severity = "info" | "warning" | "blocker";

type Applicability = {
  productTypes: string[] | null;
  formats: string[] | null;
  transparency: "with_alpha" | "no_alpha" | null;
  sourceKinds: Array<"design" | "local-library"> | null;
  requiresAnyTransform: string[] | null;
};

type Criterion = {
  id: string;
  label: string;
  description: string;
  blockText: string;
  active: boolean;
  weight: number;
  severity: Severity;
  applicability: Applicability;
  version: string;
};

type ReviewConfigResponse = {
  settings: {
    coreMasterPrompt: string | null;
    criterionOverrides: Record<string, Partial<Criterion> | undefined>;
  };
  criteria: Criterion[];
  builtinCore: string;
  preview: {
    context: { productType: string; format: string; sourceKind: string };
    systemPrompt: string;
    selectedCriterionIds: string[];
    fingerprint: string;
    coreOverrideRejected: boolean;
  };
  ops: {
    queued: number;
    running: number;
    failed: number;
    lastEnqueueAt: string | null;
    lastLocalScanAt: string | null;
  };
};

const QUERY_KEY = ["settings", "review"] as const;

export function PaneReview() {
  const qc = useQueryClient();
  const [previewProductType, setPreviewProductType] = useState("clipart");
  const [previewFormat, setPreviewFormat] = useState("png");

  const query = useQuery<ReviewConfigResponse>({
    queryKey: [...QUERY_KEY, previewProductType, previewFormat],
    queryFn: async () => {
      const url = new URL("/api/settings/review", window.location.origin);
      url.searchParams.set("productType", previewProductType);
      url.searchParams.set("format", previewFormat);
      const r = await fetch(url.toString());
      if (!r.ok) throw new Error("Could not load review settings");
      return r.json();
    },
  });

  const updateMutation = useMutation<
    { settings: ReviewConfigResponse["settings"] },
    Error,
    {
      coreMasterPrompt?: string | null;
      criterionOverrides?: Record<string, Partial<Criterion>>;
    }
  >({
    mutationFn: async (patch) => {
      const r = await fetch("/api/settings/review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${r.status}`);
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const resetCriterion = useMutation<
    { settings: ReviewConfigResponse["settings"] },
    Error,
    string
  >({
    mutationFn: async (criterionId) => {
      const r = await fetch("/api/settings/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criterionId }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  if (query.isLoading || !query.data) {
    return (
      <div className="max-w-[680px] px-10 py-9">
        <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
          Review scoring
        </h2>
        <p className="mt-2 text-sm text-ink-2">Loading review settings…</p>
      </div>
    );
  }

  const data = query.data;
  const overrides = data.settings.criterionOverrides ?? {};
  const activeCount = data.criteria.filter((c) => c.active).length;
  const includedCount = data.preview.selectedCriterionIds.length;

  return (
    <div className="max-w-[860px] px-10 py-9">
      <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
        Review scoring
      </h2>
      <p className="mt-2 text-sm text-ink-2">
        Master prompt, criteria, and weights for the AI quality
        review. Changes apply to future scoring jobs; existing
        decisions stay in place until reset.
      </p>

      {/* 0) Operations — live pipeline state + manual trigger */}
      <ReviewOpsSection ops={data.ops} />

      {/* 1) Decision rule */}
      <section className="mt-8" data-testid="review-pane-thresholds">
        <h3 className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
          Decision rule
        </h3>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-ink-3">Threshold low</dt>
          <dd className="font-mono text-ink">
            {REVIEW_THRESHOLD_LOW}/100 — below this, status flips to
            NEEDS_REVIEW.
          </dd>
          <dt className="text-ink-3">Threshold high</dt>
          <dd className="font-mono text-ink">
            {REVIEW_THRESHOLD_HIGH}/100 — at or above, auto-approved
            (when no blocker fails).
          </dd>
          <dt className="text-ink-3">Mid-band</dt>
          <dd className="text-ink">NEEDS_REVIEW (safe default)</dd>
          <dt className="text-ink-3">Score math</dt>
          <dd className="text-ink">
            <span className="font-mono">finalScore = max(0, providerRaw − Σ weight(failed warning))</span>
            ; blocker fails force NEEDS_REVIEW regardless of score.
          </dd>
        </dl>
      </section>

      {/* 2) Master prompt editor */}
      <section className="mt-8" data-testid="review-pane-master-prompt">
        <div className="flex items-baseline justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
            Master prompt — core
          </h3>
          <span className="font-mono text-[10px] tracking-wider text-ink-3">
            {data.settings.coreMasterPrompt
              ? "OVERRIDE ACTIVE"
              : "BUILTIN"}
          </span>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          Edit the spine. Keep the placeholder{" "}
          <code className="rounded bg-ink/5 px-1 font-mono">
            {"{{CRITERIA_BLOCK_LIST}}"}
          </code>{" "}
          where active criterion lines should be injected.
        </p>
        <CoreMasterPromptEditor
          value={data.settings.coreMasterPrompt ?? data.builtinCore}
          isOverride={data.settings.coreMasterPrompt !== null}
          onSave={(next) => updateMutation.mutate({ coreMasterPrompt: next })}
          onRevert={() =>
            updateMutation.mutate({ coreMasterPrompt: null })
          }
          coreOverrideRejected={data.preview.coreOverrideRejected}
        />
      </section>

      {/* 3) Final prompt preview */}
      <section className="mt-8" data-testid="review-pane-preview">
        <div className="flex items-baseline justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
            Final prompt preview
          </h3>
          <span className="font-mono text-[10px] tracking-wider text-ink-3">
            {includedCount}/{activeCount} blocks included
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-2 text-ink-3">
            <span className="font-mono text-[10px] uppercase tracking-meta">
              productType
            </span>
            <select
              value={previewProductType}
              onChange={(e) => setPreviewProductType(e.target.value)}
              className="rounded-md border border-line bg-paper px-2 py-1 text-ink"
            >
              <option value="wall_art">wall_art</option>
              <option value="clipart">clipart</option>
              <option value="sticker">sticker</option>
              <option value="transparent_png">transparent_png</option>
              <option value="bookmark">bookmark</option>
              <option value="printable">printable</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-ink-3">
            <span className="font-mono text-[10px] uppercase tracking-meta">
              format
            </span>
            <select
              value={previewFormat}
              onChange={(e) => setPreviewFormat(e.target.value)}
              className="rounded-md border border-line bg-paper px-2 py-1 text-ink"
            >
              <option value="png">png</option>
              <option value="webp">webp</option>
              <option value="jpeg">jpeg</option>
              <option value="jpg">jpg</option>
              <option value="tiff">tiff</option>
            </select>
          </label>
        </div>
        <pre className="mt-3 overflow-x-auto rounded-md border border-line bg-bg p-3 font-mono text-[11px] leading-relaxed text-ink-2">
          {data.preview.systemPrompt}
        </pre>
        <details className="mt-2">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-meta text-ink-3 hover:text-ink-2">
            Audit · prompt fingerprint
          </summary>
          <p className="mt-1 break-all font-mono text-[10px] text-ink-3">
            {data.preview.fingerprint || "(no blocks selected)"}
          </p>
        </details>
      </section>

      {/* 4) Criteria manager */}
      <section className="mt-8" data-testid="review-pane-criteria">
        <div className="flex items-baseline justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
            Criteria
          </h3>
          <span className="font-mono text-[10px] tracking-wider text-ink-3">
            {activeCount}/{data.criteria.length} active
          </span>
        </div>
        <ul className="mt-3 space-y-2.5">
          {data.criteria.map((c) => {
            const isOverridden = !!overrides[c.id];
            const isIncluded = data.preview.selectedCriterionIds.includes(c.id);
            return (
              <CriterionRow
                key={c.id}
                criterion={c}
                isOverridden={isOverridden}
                isIncludedInPreview={isIncluded}
                onSave={(patch) =>
                  updateMutation.mutate({
                    criterionOverrides: {
                      ...(overrides as Record<string, Partial<Criterion>>),
                      [c.id]: {
                        ...((overrides[c.id] ?? {}) as Partial<Criterion>),
                        ...patch,
                      },
                    },
                  })
                }
                onRevert={() => resetCriterion.mutate(c.id)}
              />
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-ink-3">
          New criterion ids cannot be added through this surface — the
          provider response schema enumerates them. Future versions will
          allow custom kinds via separate audit-flagged storage.
        </p>
      </section>

      {/* 5) Cost discipline reminder */}
      <section className="mt-8" data-testid="review-pane-cost">
        <h3 className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
          Scoring cost discipline
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-ink-2">
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-k-green" aria-hidden />
            <span>
              Already-scored assets do not trigger a new provider call.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-k-green" aria-hidden />
            <span>
              Operator reset (PATCH) clears snapshots and re-enqueues
              scoring.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-k-green" aria-hidden />
            <span>
              Image-content transforms (background-remove, crop,
              upscale, remaster, re-export, color-edit) invalidate the
              score and queue a re-score.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Review operations dashboard + manual trigger
// ────────────────────────────────────────────────────────────────────────

function ReviewOpsSection({
  ops,
}: {
  ops: ReviewConfigResponse["ops"];
}) {
  const [folderName, setFolderName] = useState("");
  const [productType, setProductType] = useState("clipart");
  const [batchId, setBatchId] = useState("");
  const [lastResult, setLastResult] = useState<string | null>(null);

  const triggerFolder = async () => {
    setLastResult(null);
    if (!folderName.trim()) {
      setLastResult("Folder name required.");
      return;
    }
    try {
      const r = await fetch("/api/review/scope-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "folder",
          folderName: folderName.trim(),
          productTypeKey: productType,
        }),
      });
      const body = await r.json();
      if (!r.ok) {
        setLastResult(`Folder trigger failed: ${body?.error ?? r.status}`);
        return;
      }
      setLastResult(
        `Folder · ${folderName} → enqueued ${body.enqueueSucceeded}/${body.requested} (errors: ${body.enqueueErrors}).`,
      );
    } catch (err) {
      setLastResult(
        `Folder trigger error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const triggerBatch = async () => {
    setLastResult(null);
    if (!batchId.trim()) {
      setLastResult("Batch id required.");
      return;
    }
    try {
      const r = await fetch("/api/review/scope-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "batch",
          batchId: batchId.trim(),
        }),
      });
      const body = await r.json();
      if (!r.ok) {
        setLastResult(`Batch trigger failed: ${body?.error ?? r.status}`);
        return;
      }
      setLastResult(
        `Batch · ${batchId} → enqueued ${body.enqueueSucceeded}/${body.requested} (errors: ${body.enqueueErrors}).`,
      );
    } catch (err) {
      setLastResult(
        `Batch trigger error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  return (
    <section className="mt-8" data-testid="review-pane-ops">
      <h3 className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
        Review operations
      </h3>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <OpsTile label="Queued" value={ops.queued} testId="ops-queued" />
        <OpsTile label="Running" value={ops.running} testId="ops-running" />
        <OpsTile
          label="Failed"
          value={ops.failed}
          tone={ops.failed > 0 ? "danger" : "muted"}
          testId="ops-failed"
        />
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-xs">
        <dt className="text-ink-3">Last enqueue</dt>
        <dd className="font-mono text-ink-2">
          {ops.lastEnqueueAt
            ? new Date(ops.lastEnqueueAt).toLocaleString("en-US")
            : "—"}
        </dd>
        <dt className="text-ink-3">Last local scan</dt>
        <dd className="font-mono text-ink-2">
          {ops.lastLocalScanAt
            ? new Date(ops.lastLocalScanAt).toLocaleString("en-US")
            : "—"}
        </dd>
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div
          className="rounded-md border border-line bg-paper p-3"
          data-testid="ops-trigger-folder"
        >
          <div className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
            Trigger · folder
          </div>
          <input
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="folderName"
            className="mt-2 w-full rounded-md border border-line bg-bg px-2 py-1.5 font-mono text-[11px] text-ink"
          />
          <select
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
            className="mt-2 w-full rounded-md border border-line bg-bg px-2 py-1.5 text-xs text-ink"
          >
            <option value="clipart">clipart</option>
            <option value="sticker">sticker</option>
            <option value="transparent_png">transparent_png</option>
            <option value="wall_art">wall_art</option>
            <option value="bookmark">bookmark</option>
            <option value="printable">printable</option>
          </select>
          <button
            type="button"
            onClick={triggerFolder}
            className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-md border border-k-orange bg-k-orange/10 text-xs font-medium text-ink hover:bg-k-orange/20"
          >
            Enqueue folder review
          </button>
        </div>
        <div
          className="rounded-md border border-line bg-paper p-3"
          data-testid="ops-trigger-batch"
        >
          <div className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
            Trigger · batch
          </div>
          <input
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            placeholder="batchId"
            className="mt-2 w-full rounded-md border border-line bg-bg px-2 py-1.5 font-mono text-[11px] text-ink"
          />
          <div className="mt-2 h-[34px] text-[10px] text-ink-3">
            Picks every undecided + never-scored design in this batch.
          </div>
          <button
            type="button"
            onClick={triggerBatch}
            className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-md border border-k-orange bg-k-orange/10 text-xs font-medium text-ink hover:bg-k-orange/20"
          >
            Enqueue batch review
          </button>
        </div>
      </div>
      {lastResult ? (
        <p
          className="mt-2 text-xs text-ink-2"
          data-testid="ops-last-result"
        >
          {lastResult}
        </p>
      ) : null}
    </section>
  );
}

function OpsTile({
  label,
  value,
  tone = "muted",
  testId,
}: {
  label: string;
  value: number;
  tone?: "muted" | "danger";
  testId: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-paper p-3",
        tone === "danger" && value > 0 ? "border-rose-300" : "border-line",
      )}
      data-testid={testId}
    >
      <div className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 k-display text-[26px] font-semibold tabular-nums",
          tone === "danger" && value > 0 ? "text-rose-600" : "text-ink",
        )}
      >
        {value}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Core master prompt editor
// ────────────────────────────────────────────────────────────────────────

function CoreMasterPromptEditor({
  value,
  isOverride,
  onSave,
  onRevert,
  coreOverrideRejected,
}: {
  value: string;
  isOverride: boolean;
  onSave: (next: string) => void;
  onRevert: () => void;
  coreOverrideRejected: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const dirty = draft !== value;
  const placeholderOk = draft.includes("{{CRITERIA_BLOCK_LIST}}");

  return (
    <>
      <textarea
        value={draft}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
          setDraft(e.target.value)
        }
        rows={12}
        spellCheck={false}
        className="mt-3 w-full rounded-md border border-line bg-bg p-3 font-mono text-[11px] leading-relaxed text-ink-2 focus:border-k-orange focus:outline-none"
        data-testid="review-pane-core-prompt"
      />
      {coreOverrideRejected ? (
        <p className="mt-2 text-xs text-amber-600">
          The override was saved but is currently rejected at compose
          time — the placeholder{" "}
          <code className="rounded bg-ink/5 px-1 font-mono">
            {"{{CRITERIA_BLOCK_LIST}}"}
          </code>{" "}
          is missing. Builtin core is in use until you add it back.
        </p>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={!dirty || !placeholderOk}
          onClick={() => onSave(draft)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-k-orange bg-k-orange/10 px-3 text-xs font-medium text-ink hover:bg-k-orange/20 disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="review-pane-core-save"
        >
          Save core override
        </button>
        {!placeholderOk ? (
          <span className="font-mono text-[10px] uppercase tracking-meta text-amber-600">
            Placeholder missing
          </span>
        ) : null}
        {isOverride ? (
          <button
            type="button"
            onClick={onRevert}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-3 text-xs text-ink-2 hover:border-ink-3"
            data-testid="review-pane-core-revert"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Revert to builtin
          </button>
        ) : null}
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Criterion row — collapsible editor
// ────────────────────────────────────────────────────────────────────────

function CriterionRow({
  criterion,
  isOverridden,
  isIncludedInPreview,
  onSave,
  onRevert,
}: {
  criterion: Criterion;
  isOverridden: boolean;
  isIncludedInPreview: boolean;
  onSave: (patch: Partial<Criterion>) => void;
  onRevert: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Criterion>(criterion);
  useEffect(() => {
    setDraft(criterion);
  }, [criterion]);

  const dirty = useMemo(() => {
    return (
      draft.label !== criterion.label ||
      draft.description !== criterion.description ||
      draft.blockText !== criterion.blockText ||
      draft.weight !== criterion.weight ||
      draft.severity !== criterion.severity ||
      draft.active !== criterion.active
    );
  }, [draft, criterion]);

  return (
    <li
      className="rounded-md border border-line bg-paper"
      data-testid="review-pane-criterion"
      data-active={criterion.active || undefined}
      data-overridden={isOverridden || undefined}
    >
      <header
        className="flex cursor-pointer items-baseline gap-3 px-3 py-2.5"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 self-center text-ink-3" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 self-center text-ink-3" />
        )}
        <span className="font-mono text-[12.5px] text-ink">
          {criterion.id}
        </span>
        <span className="text-sm text-ink-2">{criterion.label}</span>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn(
              "font-mono text-[10px] tracking-wider",
              criterion.severity === "blocker"
                ? "text-rose-600"
                : criterion.severity === "warning"
                  ? "text-amber-600"
                  : "text-ink-3",
            )}
          >
            {criterion.severity.toUpperCase()}
            {criterion.severity !== "info" && criterion.weight > 0
              ? ` · w${criterion.weight}`
              : ""}
          </span>
          <span
            className={
              criterion.active
                ? "font-mono text-[10px] tracking-wider text-k-green"
                : "font-mono text-[10px] tracking-wider text-ink-3"
            }
          >
            {criterion.active ? "ACTIVE" : "INACTIVE"}
          </span>
          {isOverridden ? (
            <span className="font-mono text-[10px] tracking-wider text-k-orange-bright">
              OVERRIDE
            </span>
          ) : null}
          {isIncludedInPreview ? (
            <span className="font-mono text-[10px] tracking-wider text-ink-3">
              IN PREVIEW
            </span>
          ) : (
            <span className="font-mono text-[10px] tracking-wider text-ink-3">
              N/A
            </span>
          )}
        </div>
      </header>
      {open ? (
        <div className="border-t border-line px-3 py-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-ink-3">
              Label
              <input
                value={draft.label}
                onChange={(e) =>
                  setDraft({ ...draft, label: e.target.value })
                }
                className="rounded-md border border-line bg-bg px-2 py-1.5 text-sm text-ink focus:border-k-orange focus:outline-none"
                data-testid="criterion-label"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-3">
              Weight (0–100)
              <input
                type="number"
                min={0}
                max={100}
                value={draft.weight}
                onChange={(e) =>
                  setDraft({ ...draft, weight: Number(e.target.value) })
                }
                className="rounded-md border border-line bg-bg px-2 py-1.5 font-mono text-sm text-ink focus:border-k-orange focus:outline-none"
                data-testid="criterion-weight"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-3">
              Severity
              <select
                value={draft.severity}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    severity: e.target.value as Severity,
                  })
                }
                className="rounded-md border border-line bg-bg px-2 py-1.5 text-sm text-ink"
                data-testid="criterion-severity"
              >
                <option value="info">info — no score impact</option>
                <option value="warning">warning — subtracts weight</option>
                <option value="blocker">blocker — forces NEEDS_REVIEW</option>
              </select>
            </label>
            <label className="flex items-center gap-2 self-end pb-1.5 text-xs text-ink-2">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) =>
                  setDraft({ ...draft, active: e.target.checked })
                }
                data-testid="criterion-active"
              />
              Active
            </label>
          </div>
          <label className="mt-3 flex flex-col gap-1 text-xs text-ink-3">
            Description
            <input
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              className="rounded-md border border-line bg-bg px-2 py-1.5 text-sm text-ink"
              data-testid="criterion-description"
            />
          </label>
          <label className="mt-3 flex flex-col gap-1 text-xs text-ink-3">
            Prompt block text
            <textarea
              value={draft.blockText}
              onChange={(e) =>
                setDraft({ ...draft, blockText: e.target.value })
              }
              rows={2}
              className="rounded-md border border-line bg-bg px-2 py-1.5 font-mono text-[11px] text-ink"
              data-testid="criterion-block-text"
            />
          </label>

          {/* Applicability snapshot — read-only in this turn; full
              applicability editor (formats, transparency, transforms)
              is part of the planned admin extension. The fields below
              show what's effective so the operator understands why a
              criterion is or isn't in the preview. */}
          <div className="mt-3 grid grid-cols-2 gap-3 rounded-md border border-line bg-bg p-3 text-xs text-ink-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-meta">
                Product types
              </div>
              <div className="mt-1 text-ink-2">
                {criterion.applicability.productTypes
                  ? criterion.applicability.productTypes.join(", ")
                  : "all"}
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-meta">
                Formats
              </div>
              <div className="mt-1 text-ink-2">
                {criterion.applicability.formats
                  ? criterion.applicability.formats.join(", ")
                  : "all"}
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-meta">
                Transparency
              </div>
              <div className="mt-1 text-ink-2">
                {criterion.applicability.transparency ?? "any"}
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-meta">
                Source kinds
              </div>
              <div className="mt-1 text-ink-2">
                {criterion.applicability.sourceKinds
                  ? criterion.applicability.sourceKinds.join(", ")
                  : "all"}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={!dirty}
              onClick={() => {
                onSave({
                  label: draft.label,
                  description: draft.description,
                  blockText: draft.blockText,
                  weight: draft.weight,
                  severity: draft.severity,
                  active: draft.active,
                });
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-k-orange bg-k-orange/10 px-3 text-xs font-medium text-ink hover:bg-k-orange/20 disabled:cursor-not-allowed disabled:opacity-40"
              data-testid="criterion-save"
            >
              Save changes
            </button>
            {isOverridden ? (
              <button
                type="button"
                onClick={onRevert}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-3 text-xs text-ink-2 hover:border-ink-3"
                data-testid="criterion-revert"
              >
                <RotateCcw className="h-3 w-3" aria-hidden />
                Revert to builtin
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}
