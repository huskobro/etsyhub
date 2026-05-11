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
type Family = "semantic" | "technical";

type Applicability = {
  productTypes: string[] | null;
  formats: string[] | null;
  transparency: "with_alpha" | "no_alpha" | null;
  sourceKinds: Array<"design" | "local-library"> | null;
  requiresAnyTransform: string[] | null;
};

type TechnicalRule =
  | { kind: "min_dpi"; minDpi: number }
  | { kind: "min_resolution"; minMinSidePx: number }
  | { kind: "format_whitelist"; allowed: string[] }
  | { kind: "aspect_ratio"; target: number; tolerance: number }
  | { kind: "transparency_required" };

type Criterion = {
  id: string;
  family: Family;
  label: string;
  description: string;
  blockText: string;
  active: boolean;
  weight: number;
  severity: Severity;
  applicability: Applicability;
  technicalRule?: TechnicalRule;
  version: string;
};

type ReviewConfigResponse = {
  settings: {
    coreMasterPrompt: string | null;
    criterionOverrides: Record<string, Partial<Criterion> | undefined>;
    thresholds: { low: number; high: number };
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
  pickers: {
    folder: Array<{
      id: string;
      label: string;
      pendingCount: number;
      firstPendingItemId: string | null;
    }>;
    batch: Array<{
      id: string;
      label: string;
      pendingCount: number;
      firstPendingItemId: string | null;
    }>;
    reference: Array<{
      id: string;
      label: string;
      pendingCount: number;
      firstPendingItemId: string | null;
    }>;
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
      thresholds?: { low: number; high: number };
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
      <ReviewOpsSection ops={data.ops} pickers={data.pickers} />

      {/* IA Phase 28 (CLAUDE.md Madde U) — local auto-review on
       *   scan automation. Operatör defaultProductTypeKey'i burada
       *   set eder; null kalırsa scan auto-enqueue yapmaz, manuel
       *   trigger gerekir. Görünür + ayarlanabilir + ops dashboard'a
       *   yansır. */}
      <LocalFolderMappingSection />


      {/* 1) Decision rule — IA Phase 27 (CLAUDE.md Madde R) editable */}
      <section className="mt-8" data-testid="review-pane-thresholds">
        <div className="flex items-baseline justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
            Decision rule
          </h3>
          <span className="font-mono text-[10px] tracking-wider text-ink-3">
            {data.settings.thresholds.low === REVIEW_THRESHOLD_LOW &&
            data.settings.thresholds.high === REVIEW_THRESHOLD_HIGH
              ? "BUILTIN"
              : "OVERRIDE ACTIVE"}
          </span>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          Below <span className="font-mono">low</span> ⇒ NEEDS_REVIEW.
          At or above <span className="font-mono">high</span> ⇒
          auto-approved (when no blocker fails). Mid-band stays on the
          safe default (NEEDS_REVIEW).
        </p>
        <ThresholdsEditor
          value={data.settings.thresholds}
          onSave={(next) =>
            updateMutation.mutateAsync({ thresholds: next })
          }
          onRevert={() =>
            updateMutation.mutateAsync({
              thresholds: {
                low: REVIEW_THRESHOLD_LOW,
                high: REVIEW_THRESHOLD_HIGH,
              },
            })
          }
        />
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-ink-3">Score math</dt>
          <dd className="text-ink">
            <span className="font-mono">finalScore = max(0, providerRaw − Σ weight(failed warning))</span>
            ; blocker fails force NEEDS_REVIEW regardless of score.
          </dd>
        </dl>
        {/* IA Phase 28 (CLAUDE.md Madde S) — operatör threshold'u
         *   değiştirdiğinde ne olur, ne olmaz. Net cümlelerle yazılı:
         *   stored kararlara dokunmaz, gelecek scoring jobs'a
         *   uygulanır, preview farkı olabilir. */}
        <div
          className="mt-4 rounded-md border border-line bg-bg p-3 text-xs text-ink-2"
          data-testid="threshold-policy-note"
        >
          <div className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
            What changes when you save thresholds
          </div>
          <ul className="mt-2 space-y-1.5">
            <li>
              <span className="font-medium text-ink">Future scoring jobs</span>{" "}
              use the new low/high values immediately.
            </li>
            <li>
              <span className="font-medium text-ink">Stored decisions</span> on
              already-scored assets stay unchanged. The review surface
              flags any item where the current policy preview differs
              from the stored decision so you can rerun explicitly.
            </li>
            <li>
              <span className="font-medium text-ink">Re-evaluation</span>{" "}
              happens only via "Reset and rerun review" or an
              image-content transform (background-remove, crop,
              upscale). Saving thresholds alone does not trigger
              re-scoring.
            </li>
          </ul>
        </div>
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
                  updateMutation.mutateAsync({
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
        <div className="mt-3 rounded-md border border-dashed border-line bg-bg p-3">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
              Add custom criterion
            </span>
            <span className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
              Soon
            </span>
          </div>
          <p className="mt-1.5 text-xs text-ink-3">
            New criterion kinds cannot be added today — the provider
            response schema enumerates the eight builtin ids. The next
            phase ships a custom-kind path: provider parser becomes
            lenient, the prompt includes operator-defined blocks, and
            unknown kinds return as warnings instead of decision
            blockers. Until then, every builtin row above is fully
            editable (label, description, prompt block, weight,
            severity, applicability).
          </p>
          <button
            type="button"
            disabled
            className="mt-2 inline-flex h-7 cursor-not-allowed items-center gap-1.5 rounded-md border border-line px-3 text-xs text-ink-3 opacity-60"
            data-testid="custom-criterion-add"
          >
            + New criterion
          </button>
        </div>
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
  pickers,
}: {
  ops: ReviewConfigResponse["ops"];
  pickers: ReviewConfigResponse["pickers"];
}) {
  // IA Phase 23 — unified scope-trigger picker. Operator selects
  // a kind (folder / batch / reference) and the scope dropdown
  // refreshes against the server-provided pending list. No more
  // free-text inputs; the only typed parameter is the productType
  // for folder scope (local items lack a productType field).
  const [scopeKind, setScopeKind] = useState<
    "folder" | "batch" | "reference"
  >("folder");
  const [scopeId, setScopeId] = useState<string>("");
  const [productType, setProductType] = useState("clipart");
  const [lastResult, setLastResult] = useState<string | null>(null);

  const activePickerList =
    scopeKind === "folder"
      ? pickers.folder
      : scopeKind === "batch"
        ? pickers.batch
        : pickers.reference;
  const activePickerEntry = activePickerList.find((p) => p.id === scopeId);

  const triggerScope = async () => {
    setLastResult(null);
    if (!scopeId) {
      setLastResult("Pick a scope first.");
      return;
    }
    try {
      const body =
        scopeKind === "folder"
          ? {
              scope: "folder" as const,
              folderName: scopeId,
              productTypeKey: productType,
            }
          : scopeKind === "batch"
            ? { scope: "batch" as const, batchId: scopeId }
            : { scope: "reference" as const, referenceId: scopeId };
      const r = await fetch("/api/review/scope-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        setLastResult(`Trigger failed: ${data?.error ?? r.status}`);
        return;
      }
      setLastResult(
        `${scopeKind} · ${activePickerEntry?.label ?? scopeId} → enqueued ${data.enqueueSucceeded}/${data.requested} (errors: ${data.enqueueErrors}).`,
      );
    } catch (err) {
      setLastResult(
        `Trigger error: ${err instanceof Error ? err.message : String(err)}`,
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

      <div
        className="mt-4 rounded-md border border-line bg-paper p-3"
        data-testid="ops-trigger-unified"
      >
        <div className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
          Manual trigger
        </div>
        <p className="mt-1.5 text-xs text-ink-3">
          Pick a scope kind, then choose a pending scope from the
          dropdown. Already-scored items are skipped automatically.
        </p>
        <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center">
          <span className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
            Kind
          </span>
          <div className="flex gap-1.5">
            {(["folder", "batch", "reference"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setScopeKind(k);
                  setScopeId("");
                }}
                className={cn(
                  "rounded-sm border px-2.5 py-1 font-mono text-[10px] uppercase tracking-meta",
                  scopeKind === k
                    ? "border-k-orange bg-k-orange/10 text-ink"
                    : "border-line bg-paper text-ink-3 hover:border-ink-3",
                )}
                data-testid={`ops-kind-${k}`}
              >
                {k}
              </button>
            ))}
          </div>
          <span className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
            Scope
          </span>
          <select
            value={scopeId}
            onChange={(e) => setScopeId(e.target.value)}
            className="w-full rounded-md border border-line bg-bg px-2 py-1.5 text-xs text-ink"
            data-testid="ops-scope-select"
          >
            <option value="">— select pending {scopeKind} —</option>
            {activePickerList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} · {p.pendingCount} pending
              </option>
            ))}
          </select>
          {scopeKind === "folder" ? (
            <>
              <span className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
                Product
              </span>
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                className="w-full rounded-md border border-line bg-bg px-2 py-1.5 text-xs text-ink"
                data-testid="ops-product-select"
              >
                <option value="clipart">clipart</option>
                <option value="sticker">sticker</option>
                <option value="transparent_png">transparent_png</option>
                <option value="wall_art">wall_art</option>
                <option value="bookmark">bookmark</option>
                <option value="printable">printable</option>
              </select>
            </>
          ) : null}
        </div>
        <button
          type="button"
          onClick={triggerScope}
          disabled={!scopeId}
          className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-k-orange bg-k-orange/15 px-3 text-xs font-medium text-ink hover:bg-k-orange/25 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="ops-trigger-btn"
        >
          Enqueue review for {scopeKind}
        </button>
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
  onSave: (patch: Partial<Criterion>) => Promise<unknown>;
  onRevert: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Criterion>(criterion);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | { error: string }
  >("idle");
  useEffect(() => {
    setDraft(criterion);
    // Server cevabı criterion'u güncelleyince saveState idle'a iner.
    setSaveState("idle");
  }, [criterion]);

  const dirty = useMemo(() => {
    return (
      draft.label !== criterion.label ||
      draft.description !== criterion.description ||
      draft.blockText !== criterion.blockText ||
      draft.weight !== criterion.weight ||
      draft.severity !== criterion.severity ||
      draft.active !== criterion.active ||
      JSON.stringify(draft.applicability) !==
        JSON.stringify(criterion.applicability) ||
      JSON.stringify(draft.technicalRule ?? null) !==
        JSON.stringify(criterion.technicalRule ?? null)
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
        <span
          className={cn(
            "rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-meta",
            criterion.family === "technical"
              ? "bg-k-orange/15 text-k-orange-ink"
              : "bg-ink/8 text-ink-2",
          )}
          data-testid="criterion-family-chip"
        >
          {criterion.family === "technical" ? "tech" : "ai"}
        </span>
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
          {draft.family === "semantic" ? (
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
          ) : draft.technicalRule ? (
            <TechnicalRuleEditor
              rule={draft.technicalRule}
              onChange={(rule) =>
                setDraft({ ...draft, technicalRule: rule })
              }
            />
          ) : null}

          {/* IA Phase 22 — Applicability editor (CLAUDE.md Madde O).
              Composite filter: productTypes ∧ formats ∧ transparency
              ∧ sourceKinds ∧ requiresAnyTransform. "all" toggle
              clears the array (= null = matches everything); chip
              click toggles membership. */}
          <div className="mt-3 rounded-md border border-line bg-bg p-3">
            <div className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
              Applicability
            </div>
            <div className="mt-3 space-y-3 text-xs text-ink-2">
              <ApplicabilityChips
                label="Product types"
                value={draft.applicability.productTypes}
                options={[
                  "wall_art",
                  "clipart",
                  "sticker",
                  "transparent_png",
                  "bookmark",
                  "printable",
                ]}
                onChange={(productTypes) =>
                  setDraft({
                    ...draft,
                    applicability: { ...draft.applicability, productTypes },
                  })
                }
              />
              <ApplicabilityChips
                label="Formats"
                value={draft.applicability.formats}
                options={["png", "webp", "jpeg", "jpg", "gif", "tiff"]}
                onChange={(formats) =>
                  setDraft({
                    ...draft,
                    applicability: { ...draft.applicability, formats },
                  })
                }
              />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
                  Transparency
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  {(["any", "with_alpha", "no_alpha"] as const).map((opt) => {
                    const active =
                      (draft.applicability.transparency ?? "any") === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            applicability: {
                              ...draft.applicability,
                              transparency:
                                opt === "any" ? null : opt,
                            },
                          })
                        }
                        className={cn(
                          "rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-meta",
                          active
                            ? "border-k-orange bg-k-orange/10 text-ink"
                            : "border-line bg-paper text-ink-3 hover:border-ink-3",
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
              <ApplicabilityChips
                label="Source kinds"
                value={draft.applicability.sourceKinds}
                options={["design", "local-library"]}
                onChange={(sourceKinds) =>
                  setDraft({
                    ...draft,
                    applicability: {
                      ...draft.applicability,
                      sourceKinds: (sourceKinds as Applicability["sourceKinds"]) ?? null,
                    },
                  })
                }
              />
              <ApplicabilityChips
                label="Requires any transform"
                value={draft.applicability.requiresAnyTransform}
                options={[
                  "background_removed",
                  "cropped",
                  "upscaled",
                  "remastered",
                  "re_exported",
                  "color_edited",
                ]}
                onChange={(requiresAnyTransform) =>
                  setDraft({
                    ...draft,
                    applicability: {
                      ...draft.applicability,
                      requiresAnyTransform,
                    },
                  })
                }
              />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={!dirty || saveState === "saving"}
              onClick={async () => {
                setSaveState("saving");
                try {
                  await onSave({
                    label: draft.label,
                    description: draft.description,
                    blockText: draft.blockText,
                    weight: draft.weight,
                    severity: draft.severity,
                    active: draft.active,
                    applicability: draft.applicability,
                    ...(draft.technicalRule
                      ? { technicalRule: draft.technicalRule }
                      : {}),
                  });
                  setSaveState("saved");
                  // 1.5s sonra idle'a iner; query invalidation
                  // criterion prop'u yeniler ve useEffect saveState'i
                  // de idle'a çeker.
                  setTimeout(() => setSaveState("idle"), 1500);
                } catch (err) {
                  setSaveState({
                    error: err instanceof Error ? err.message : String(err),
                  });
                }
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-k-orange bg-k-orange/10 px-3 text-xs font-medium text-ink hover:bg-k-orange/20 disabled:cursor-not-allowed disabled:opacity-40"
              data-testid="criterion-save"
              data-state={
                typeof saveState === "string" ? saveState : "error"
              }
            >
              {saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                  ? "Saved ✓"
                  : "Save changes"}
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
            {typeof saveState === "object" ? (
              <span
                className="text-xs text-rose-600"
                data-testid="criterion-save-error"
              >
                {saveState.error}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

// ────────────────────────────────────────────────────────────────────────
// ApplicabilityChips — toggleable chip group for array filters.
// `value === null` ⇒ "all" mode (matches everything); chip click
// flips into a discrete subset; clearing every chip returns to null.
// ────────────────────────────────────────────────────────────────────────

function ApplicabilityChips({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string[] | null;
  options: ReadonlyArray<string>;
  onChange: (next: string[] | null) => void;
}) {
  const isAll = value === null;
  return (
    <div data-testid="applicability-chips" data-label={label}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
          {label}
        </span>
        <button
          type="button"
          onClick={() => onChange(isAll ? [] : null)}
          className={cn(
            "rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-meta",
            isAll
              ? "border-k-orange bg-k-orange/10 text-ink"
              : "border-line bg-paper text-ink-3 hover:border-ink-3",
          )}
        >
          {isAll ? "all" : "subset"}
        </button>
      </div>
      {!isAll ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {options.map((opt) => {
            const active = value?.includes(opt) ?? false;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  if (active) {
                    onChange((value ?? []).filter((v) => v !== opt));
                  } else {
                    onChange([...(value ?? []), opt]);
                  }
                }}
                className={cn(
                  "rounded-sm border px-2 py-0.5 font-mono text-[10px]",
                  active
                    ? "border-k-orange bg-k-orange/10 text-ink"
                    : "border-line bg-paper text-ink-3 hover:border-ink-3",
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// IA Phase 23 — TechnicalRuleEditor
// Renders a discriminated-union editor for technical criteria. Each
// rule kind has bespoke fields; the wrapper switches on `rule.kind`.
// ────────────────────────────────────────────────────────────────────────

function TechnicalRuleEditor({
  rule,
  onChange,
}: {
  rule: TechnicalRule;
  onChange: (rule: TechnicalRule) => void;
}) {
  return (
    <div
      className="mt-3 rounded-md border border-line bg-bg p-3"
      data-testid="technical-rule-editor"
    >
      <div className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
        Technical rule · {rule.kind}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-ink-3">
        {rule.kind === "min_dpi" ? (
          <label className="flex flex-col gap-1">
            Minimum DPI
            <input
              type="number"
              min={1}
              max={1200}
              value={rule.minDpi}
              onChange={(e) =>
                onChange({ kind: "min_dpi", minDpi: Number(e.target.value) })
              }
              className="rounded-md border border-line bg-paper px-2 py-1.5 font-mono text-sm text-ink"
              data-testid="rule-min-dpi"
            />
          </label>
        ) : null}
        {rule.kind === "min_resolution" ? (
          <label className="flex flex-col gap-1">
            Minimum smaller-side px
            <input
              type="number"
              min={100}
              max={20000}
              value={rule.minMinSidePx}
              onChange={(e) =>
                onChange({
                  kind: "min_resolution",
                  minMinSidePx: Number(e.target.value),
                })
              }
              className="rounded-md border border-line bg-paper px-2 py-1.5 font-mono text-sm text-ink"
              data-testid="rule-min-resolution"
            />
          </label>
        ) : null}
        {rule.kind === "format_whitelist" ? (
          <label className="col-span-2 flex flex-col gap-1">
            Allowed formats (comma-separated)
            <input
              value={rule.allowed.join(", ")}
              onChange={(e) =>
                onChange({
                  kind: "format_whitelist",
                  allowed: e.target.value
                    .split(",")
                    .map((s) => s.trim().toLowerCase())
                    .filter(Boolean),
                })
              }
              className="rounded-md border border-line bg-paper px-2 py-1.5 font-mono text-sm text-ink"
              data-testid="rule-format-whitelist"
            />
          </label>
        ) : null}
        {rule.kind === "aspect_ratio" ? (
          <>
            <label className="flex flex-col gap-1">
              Target ratio (w / h)
              <input
                type="number"
                step="0.01"
                min={0.1}
                max={10}
                value={rule.target}
                onChange={(e) =>
                  onChange({
                    ...rule,
                    target: Number(e.target.value),
                  })
                }
                className="rounded-md border border-line bg-paper px-2 py-1.5 font-mono text-sm text-ink"
                data-testid="rule-aspect-target"
              />
            </label>
            <label className="flex flex-col gap-1">
              Tolerance (±)
              <input
                type="number"
                step="0.001"
                min={0}
                max={1}
                value={rule.tolerance}
                onChange={(e) =>
                  onChange({
                    ...rule,
                    tolerance: Number(e.target.value),
                  })
                }
                className="rounded-md border border-line bg-paper px-2 py-1.5 font-mono text-sm text-ink"
                data-testid="rule-aspect-tolerance"
              />
            </label>
          </>
        ) : null}
        {rule.kind === "transparency_required" ? (
          <p className="col-span-2 text-xs text-ink-3">
            No parameters — fails when the asset has no alpha channel.
            Combine with applicability filters to scope (e.g. only
            <code className="ml-1 rounded bg-ink/5 px-1 font-mono">
              transparent_png
            </code>{" "}
            product types).
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// IA-29 (CLAUDE.md Madde V) — LocalFolderMappingSection
//
// Tek global default YOK. Operatör her klasör için açık seçim yapar:
//   • bir productType atayabilir (auto-enqueue tetiklenir)
//   • __ignore__ ile yok sayabilir (klasör atlanır, asla enqueue olmaz)
//   • mapping yoksa "pending" — UI listede gösterir, operatör atar
// Aynı bölümde root folder + scan tetikleme de yer alır.
// ────────────────────────────────────────────────────────────────────────

const PRODUCT_TYPE_OPTIONS = [
  "wall_art",
  "clipart",
  "sticker",
  "transparent_png",
  "bookmark",
  "printable",
] as const;

// IA-29 — operator-facing labels for the folder convention reference.
const PRODUCT_TYPE_LABELS: Record<(typeof PRODUCT_TYPE_OPTIONS)[number], string> = {
  wall_art: "Wall art",
  clipart: "Clipart",
  sticker: "Sticker",
  transparent_png: "Transparent PNG",
  bookmark: "Bookmark",
  printable: "Printable",
};

function productTypeLabel(pt: string): string {
  return PRODUCT_TYPE_LABELS[pt as keyof typeof PRODUCT_TYPE_LABELS] ?? pt;
}

// IA-29 — compact convention card + mkdir helper.
function ConventionReference({
  rootFolderPath,
  onCreated,
}: {
  rootFolderPath: string | null;
  onCreated: () => void;
}) {
  const mutation = useMutation<
    {
      rootFolderPath: string;
      created: string[];
      existed: string[];
      failed: Array<{ folder: string; error: string }>;
    },
    Error,
    void
  >({
    mutationFn: async () => {
      const r = await fetch("/api/local-library/create-product-folders", {
        method: "POST",
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${r.status}`);
      }
      return r.json();
    },
    onSuccess: () => onCreated(),
  });

  return (
    <div
      className="mt-3 rounded-md border border-line bg-bg px-3 py-2"
      data-testid="folder-convention-reference"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
          Folder convention
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PRODUCT_TYPE_OPTIONS.map((pt) => (
            <code
              key={pt}
              className="rounded-sm bg-ink/5 px-1.5 py-0.5 font-mono text-[11px] text-ink"
              title={productTypeLabel(pt)}
              data-testid="folder-convention-chip"
              data-product-type={pt}
            >
              {pt}/
            </code>
          ))}
        </div>
        <button
          type="button"
          disabled={!rootFolderPath || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-k-orange bg-k-orange/10 px-2.5 text-[11px] font-medium text-ink hover:bg-k-orange/20 disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="create-product-folders-btn"
        >
          {mutation.isPending
            ? "Creating…"
            : mutation.isSuccess
              ? "Created ✓"
              : "Create folders"}
        </button>
      </div>
      {mutation.isSuccess ? (
        <p className="mt-1.5 text-[10.5px] text-ink-3" data-testid="create-folders-result">
          {mutation.data.created.length} created
          {mutation.data.existed.length > 0
            ? ` · ${mutation.data.existed.length} already existed`
            : ""}
          {mutation.data.failed.length > 0
            ? ` · ${mutation.data.failed.length} failed`
            : ""}
        </p>
      ) : mutation.isError ? (
        <p className="mt-1.5 text-[10.5px] text-rose-600">
          {mutation.error.message}
        </p>
      ) : !rootFolderPath ? (
        <p className="mt-1.5 text-[10.5px] text-ink-3">
          Save a root path first to enable "Create folders".
        </p>
      ) : null}
    </div>
  );
}

const IGNORE_SENTINEL = "__ignore__";

type LocalLibrarySettingsView = {
  rootFolderPath: string | null;
  targetResolution: { width: number; height: number };
  targetDpi: number;
  qualityThresholds: { ok: number; warn: number };
  folderProductTypeMap: Record<string, string>;
};

type FolderMappingEntry = {
  folderName: string;
  folderPath: string;
  assetCount: number;
  status: "pending" | "convention" | "alias" | "ignored";
  productTypeKey: string | null;
};

type FolderMappingResponse = {
  folders: FolderMappingEntry[];
  summary: {
    total: number;
    pending: number;
    convention: number;
    alias: number;
    ignored: number;
    /** IA-29 — AI scoring tamamlanmış asset sayısı (aktif root altında). */
    reviewedCount: number;
  };
  knownProductTypes: ReadonlyArray<string>;
};

function LocalFolderMappingSection() {
  const qc = useQueryClient();

  const settingsQuery = useQuery<{ settings: LocalLibrarySettingsView }>({
    queryKey: ["settings", "local-library"],
    queryFn: async () => {
      const r = await fetch("/api/settings/local-library");
      if (!r.ok) throw new Error("Could not load local library settings");
      return r.json();
    },
  });

  // IA-29 — query key root-aware. Root değişince yeni queryKey ile
  // taze fetch tetiklenir; eski cache stale kalmaz.
  const activeRootForKey = settingsQuery.data?.settings.rootFolderPath ?? "";
  const mappingQuery = useQuery<FolderMappingResponse>({
    queryKey: ["local-library", "folder-mapping", activeRootForKey],
    queryFn: async () => {
      const r = await fetch("/api/local-library/folder-mapping");
      if (!r.ok) throw new Error("Could not load folder mapping");
      return r.json();
    },
    // Hold off until settings has loaded so we don't fire with an
    // empty root and then re-fetch.
    enabled: settingsQuery.data !== undefined,
  });

  const settingsMutation = useMutation({
    mutationFn: async (next: LocalLibrarySettingsView) => {
      const r = await fetch("/api/settings/local-library", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${r.status}`);
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "local-library"] });
      // IA-29 — root değiştiğinde mapping listesi de yenilenmeli.
      qc.invalidateQueries({ queryKey: ["local-library", "folder-mapping"] });
    },
  });

  const mappingMutation = useMutation({
    mutationFn: async (args: { folderKey: string; productTypeKey: string | null }) => {
      const r = await fetch("/api/local-library/folder-mapping", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["local-library", "folder-mapping"] });
      qc.invalidateQueries({ queryKey: ["settings", "local-library"] });
    },
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/local-library/scan", { method: "POST" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ jobId: string }>;
    },
    onSuccess: () => {
      // Scan async; mapping listesi 3sn sonra yenilenir.
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["local-library", "folder-mapping"] });
      }, 3000);
    },
  });

  const [rootDraft, setRootDraft] = useState<string>("");
  useEffect(() => {
    if (settingsQuery.data) {
      setRootDraft(settingsQuery.data.settings.rootFolderPath ?? "");
    }
  }, [settingsQuery.data]);

  if (settingsQuery.isLoading || !settingsQuery.data) {
    return (
      <section className="mt-8" data-testid="review-pane-local-mapping">
        <h3 className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
          Local library
        </h3>
        <p className="mt-2 text-xs text-ink-3">Loading…</p>
      </section>
    );
  }

  const settings = settingsQuery.data.settings;
  const folders = mappingQuery.data?.folders ?? [];
  const summary = mappingQuery.data?.summary;
  const rootPath = settings.rootFolderPath;
  const rootDirty = rootDraft.trim() !== (rootPath ?? "");
  const rootValid = rootDraft.trim() === "" || rootDraft.trim().startsWith("/");

  const saveRoot = async () => {
    if (!rootValid) return;
    await settingsMutation.mutateAsync({
      ...settings,
      rootFolderPath: rootDraft.trim() || null,
    });
  };

  const known = folders.filter(
    (f) => f.status === "convention" || f.status === "alias",
  );
  const pending = folders.filter((f) => f.status === "pending");
  const ignored = folders.filter((f) => f.status === "ignored");

  return (
    <section className="mt-8" data-testid="review-pane-local-mapping">
      <div className="flex items-baseline justify-between">
        <h3 className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
          Local library
        </h3>
        {summary ? (
          <span className="font-mono text-[10px] tracking-wider text-ink-3">
            {known.length} known · {pending.length} pending ·{" "}
            {ignored.length} ignored
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-ink-3">
        Convention: each folder under your root maps to a product type
        by name. Folders that don't match a known product type land in
        the "Pending" list — assign one or ignore them.
      </p>
      {/* IA-29 — review state preservation note + reviewedCount. */}
      {summary && rootPath ? (
        <p
          className="mt-1 text-[11px] text-ink-3"
          data-testid="review-preservation-note"
        >
          <span className="font-medium text-ink-2">
            {summary.reviewedCount}
          </span>{" "}
          asset
          {summary.reviewedCount === 1 ? " has" : "s have"} an AI
          evaluation under this root. Changing the root hides them
          from review (data is preserved — re-saving the old root
          brings them back).
        </p>
      ) : null}

      {/* IA-29 — compact convention reference + create-folders helper.
       *   Single row: inline chips for each productType + an action
       *   button that mkdir's all six under the saved root. */}
      <ConventionReference
        rootFolderPath={rootPath}
        onCreated={() => {
          qc.invalidateQueries({
            queryKey: ["local-library", "folder-mapping"],
          });
        }}
      />

      {/* Root path + scan */}
      <div
        className="mt-3 rounded-md border border-line bg-bg p-3"
        data-testid="local-root-config"
      >
        <label className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
          Root folder (absolute path)
        </label>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="text"
            value={rootDraft}
            onChange={(e) => setRootDraft(e.target.value)}
            placeholder="/Users/you/Pictures"
            className="flex-1 rounded-md border border-line bg-paper px-2 py-1.5 font-mono text-sm text-ink focus:border-k-orange focus:outline-none"
            data-testid="local-root-input"
          />
          <button
            type="button"
            disabled={!rootDirty || !rootValid || settingsMutation.isPending}
            onClick={() => {
              void saveRoot();
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-k-orange bg-k-orange/10 px-3 text-xs font-medium text-ink hover:bg-k-orange/20 disabled:opacity-40"
            data-testid="local-root-save"
          >
            Save
          </button>
          <button
            type="button"
            disabled={!rootPath || scanMutation.isPending}
            onClick={() => scanMutation.mutate()}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-3 text-xs text-ink-2 hover:border-ink-3 disabled:opacity-40"
            data-testid="local-scan-now"
          >
            {scanMutation.isPending ? "Scanning…" : "Scan now"}
          </button>
        </div>
        {!rootValid ? (
          <p className="mt-1.5 text-[11px] text-amber-600">
            Path must be absolute (start with /).
          </p>
        ) : null}
        {scanMutation.isSuccess ? (
          <p className="mt-1.5 text-[11px] text-ink-3">
            Scan queued. Folder list refreshes in a few seconds.
          </p>
        ) : null}
      </div>

      {/* Pending folders — operatör action needed */}
      {pending.length > 0 ? (
        <div className="mt-4" data-testid="folder-pending-block">
          <div className="flex items-baseline justify-between">
            <h4 className="font-mono text-[10px] uppercase tracking-meta text-amber-600">
              Pending — needs your decision
            </h4>
            <span className="font-mono text-[10px] tracking-wider text-ink-3">
              {pending.length} folder{pending.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">
            These folders don't match a known product type. Map them
            to a product type (alias) or ignore them so the scan worker
            knows what to do.
          </p>
          <ul className="mt-2 space-y-2">
            {pending.map((f) => (
              <FolderMappingRow
                key={f.folderPath}
                entry={f}
                disabled={mappingMutation.isPending}
                onChange={(next) =>
                  mappingMutation.mutate({
                    folderKey: f.folderName,
                    productTypeKey: next,
                  })
                }
              />
            ))}
          </ul>
        </div>
      ) : null}

      {/* Known folders — convention + alias */}
      {known.length > 0 ? (
        <div className="mt-4" data-testid="folder-known-block">
          <h4 className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
            Mapped folders
          </h4>
          <ul className="mt-2 space-y-2">
            {known.map((f) => (
              <FolderMappingRow
                key={f.folderPath}
                entry={f}
                disabled={mappingMutation.isPending}
                onChange={(next) =>
                  mappingMutation.mutate({
                    folderKey: f.folderName,
                    productTypeKey: next,
                  })
                }
              />
            ))}
          </ul>
        </div>
      ) : null}

      {/* Ignored folders — collapsed for cleanliness */}
      {ignored.length > 0 ? (
        <details className="mt-4" data-testid="folder-ignored-block">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-meta text-ink-3">
            Ignored folders ({ignored.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {ignored.map((f) => (
              <FolderMappingRow
                key={f.folderPath}
                entry={f}
                disabled={mappingMutation.isPending}
                onChange={(next) =>
                  mappingMutation.mutate({
                    folderKey: f.folderName,
                    productTypeKey: next,
                  })
                }
              />
            ))}
          </ul>
        </details>
      ) : null}

      {!rootPath && folders.length === 0 ? (
        <p className="mt-3 text-xs text-ink-3">
          Save a root folder first, then click "Scan now". Discovered
          folders will appear here.
        </p>
      ) : null}
      {rootPath && folders.length === 0 ? (
        <p className="mt-3 text-xs text-ink-3">
          No folders yet — run a scan or check the root path.
        </p>
      ) : null}
    </section>
  );
}

function FolderMappingRow({
  entry,
  onChange,
  disabled,
}: {
  entry: FolderMappingEntry;
  onChange: (next: string | null) => void;
  disabled: boolean;
}) {
  const value =
    entry.status === "ignored"
      ? IGNORE_SENTINEL
      : entry.productTypeKey ?? "";
  const dotColor =
    entry.status === "convention"
      ? "bg-k-green"
      : entry.status === "alias"
        ? "bg-k-orange"
        : entry.status === "ignored"
          ? "bg-ink-3"
          : "bg-amber-500";
  return (
    <li
      className="flex items-center gap-3 rounded-md border border-line bg-paper px-3 py-2"
      data-testid="folder-mapping-row"
      data-status={entry.status}
    >
      <span
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotColor)}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm text-ink" title={entry.folderName}>
          {entry.folderName}
          {entry.status === "convention" ? (
            <span className="ml-2 font-mono text-[10px] uppercase tracking-meta text-ink-3">
              auto
            </span>
          ) : entry.status === "alias" ? (
            <span className="ml-2 font-mono text-[10px] uppercase tracking-meta text-k-orange-ink">
              alias
            </span>
          ) : null}
        </div>
        <div
          className="truncate font-mono text-[11px] text-ink-3"
          title={entry.folderPath}
        >
          {entry.folderPath} · {entry.assetCount} assets
        </div>
      </div>
      <select
        value={value}
        disabled={disabled || entry.status === "convention"}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : v);
        }}
        className="rounded-md border border-line bg-bg px-2 py-1.5 text-xs text-ink disabled:opacity-50"
        data-testid="folder-mapping-select"
      >
        <option value="">— pending (assign) —</option>
        {PRODUCT_TYPE_OPTIONS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
        <option value={IGNORE_SENTINEL}>Ignore folder</option>
      </select>
    </li>
  );
}

// ────────────────────────────────────────────────────────────────────────
// IA Phase 27 — ThresholdsEditor (CLAUDE.md Madde R)
// Editable low/high inputs with refine validation (low < high) +
// save / revert buttons. Save state mirrors CriterionRow pattern
// (idle → saving → saved ✓ → idle), error surfaces inline.
// ────────────────────────────────────────────────────────────────────────

function ThresholdsEditor({
  value,
  onSave,
  onRevert,
}: {
  value: { low: number; high: number };
  onSave: (next: { low: number; high: number }) => Promise<unknown>;
  onRevert: () => Promise<unknown>;
}) {
  const [draft, setDraft] = useState(value);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | { error: string }
  >("idle");
  useEffect(() => {
    setDraft(value);
    setSaveState("idle");
  }, [value]);

  const dirty = draft.low !== value.low || draft.high !== value.high;
  const validRange =
    Number.isInteger(draft.low) &&
    Number.isInteger(draft.high) &&
    draft.low >= 0 &&
    draft.high <= 100 &&
    draft.low < draft.high;
  const isOverride =
    value.low !== REVIEW_THRESHOLD_LOW || value.high !== REVIEW_THRESHOLD_HIGH;

  return (
    <div
      className="mt-4 rounded-md border border-line bg-bg p-3"
      data-testid="thresholds-editor"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Threshold low (0–99)
          <input
            type="number"
            min={0}
            max={99}
            value={draft.low}
            onChange={(e) =>
              setDraft({ ...draft, low: Number(e.target.value) })
            }
            className="rounded-md border border-line bg-paper px-2 py-1.5 font-mono text-sm text-ink focus:border-k-orange focus:outline-none"
            data-testid="threshold-low-input"
          />
          <span className="text-[10.5px] text-ink-3">
            Below this score ⇒ NEEDS_REVIEW.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Threshold high (1–100)
          <input
            type="number"
            min={1}
            max={100}
            value={draft.high}
            onChange={(e) =>
              setDraft({ ...draft, high: Number(e.target.value) })
            }
            className="rounded-md border border-line bg-paper px-2 py-1.5 font-mono text-sm text-ink focus:border-k-orange focus:outline-none"
            data-testid="threshold-high-input"
          />
          <span className="text-[10.5px] text-ink-3">
            At or above ⇒ auto-approved (no blocker fails).
          </span>
        </label>
      </div>
      {!validRange ? (
        <p className="mt-2 text-xs text-amber-600">
          low must be a whole number strictly below high; both within
          0–100.
        </p>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={!dirty || !validRange || saveState === "saving"}
          onClick={async () => {
            setSaveState("saving");
            try {
              await onSave(draft);
              setSaveState("saved");
              setTimeout(() => setSaveState("idle"), 1500);
            } catch (err) {
              setSaveState({
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-k-orange bg-k-orange/10 px-3 text-xs font-medium text-ink hover:bg-k-orange/20 disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="thresholds-save"
        >
          {saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "Saved ✓"
              : "Save thresholds"}
        </button>
        {isOverride ? (
          <button
            type="button"
            onClick={async () => {
              setSaveState("saving");
              try {
                await onRevert();
                setSaveState("saved");
                setTimeout(() => setSaveState("idle"), 1500);
              } catch (err) {
                setSaveState({
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            }}
            disabled={saveState === "saving"}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-3 text-xs text-ink-2 hover:border-ink-3 disabled:opacity-50"
            data-testid="thresholds-revert"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Revert to defaults ({REVIEW_THRESHOLD_LOW}/{REVIEW_THRESHOLD_HIGH})
          </button>
        ) : null}
        {typeof saveState === "object" ? (
          <span
            className="text-xs text-rose-600"
            data-testid="thresholds-save-error"
          >
            {saveState.error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
