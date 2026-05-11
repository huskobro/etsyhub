// IA Phase 16 — sağ panelin sistem değerlendirmesi bölümü.
//
// Operator sağ panele girdiğinde bir tek "47/100" sayı görmek istemez;
// neden 47 olduğunu görmek ister. Bu bileşen:
//   • Lifecycle (Pending / Scoring / Ready / Error / N/A)
//   • Score chip — yalnız Ready durumunda
//   • Checks — passed (yeşil tik) / failed (amber × + reason)
//   • Summary — provider'ın TR özeti
//   • Provider satırı — snapshot + prompt versiyonu
//
// AI Generated ve Local Library aynı bileşeni kullanır; kaynak farkı
// caller adapter'da kalır (AI'da promptVersion v1.1 wireup; Local'de
// alpha-checks ek satırlar carry-forward).

"use client";

import { Fragment, useState } from "react";
import { Check as CheckIcon, AlertTriangle, Hourglass, MinusCircle, Zap } from "lucide-react";
import { SectionTitle } from "@/features/review/components/ReviewWorkspaceShell";
import {
  type Evaluation,
  type NotQueuedReason,
  lifecycleCaption,
} from "@/features/review/lib/evaluation";
import { cn } from "@/lib/cn";

/* eslint-disable no-restricted-syntax */

/** IA-39 — reason-specific copy for not_queued lifecycle. */
function notQueuedCopy(reason?: NotQueuedReason): string {
  switch (reason) {
    case "pending_mapping":
      return "This folder has no product type mapping — auto-enqueue is paused. Go to Settings → Review → Local library and assign a product type to this folder, then click \"Enqueue review for this scope\".";
    case "ignored":
      return "This folder is marked as ignored — scoring is intentionally skipped. To re-enable, go to Settings → Review → Local library and change the mapping.";
    case "auto_enqueue_disabled":
      return "Automatic review scoring is disabled in Settings → Review → Automation. Toggle it on to re-enable auto-enqueue, or use \"Enqueue review for this scope\" to score manually.";
    case "discovery_not_run":
      return "Your local folder has never been scanned. Click \"Scan now\" in Settings → Review → Local library, or wait for the file watcher / periodic scan to trigger automatically.";
    case "design_pending_worker":
      return "Variation generation is still in progress — review scoring will start automatically once the worker finishes.";
    case "legacy":
      return "This asset was created before auto-enqueue was introduced. Click \"Enqueue review for this scope\" to score it now.";
    default:
      return "AI has not evaluated this asset yet — auto-enqueue runs when the source pipeline produces a fresh asset (AI variation create or local scan). Click \"Enqueue review for this scope\" to score existing files.";
  }
}
// Hex sabitler shell whitelisting'inde tanımlı; bu modül de sağ
// panelin v4 dark surface zincirinde olduğu için tone class'ları için
// rgba/white-opacity Tailwind alias'larından beslenir. Eslint kuralı
// yalnız text/bg literal hex için çalışır.

export function EvaluationPanel({
  evaluation,
  scopeTrigger,
  rerun,
}: {
  evaluation: Evaluation;
  /** IA Phase 22 — manual trigger affordance for non-ready
   *  lifecycles. When provided, an "Enqueue review for this scope"
   *  button appears in the empty-state copy. Operator clicks once;
   *  the parent runs the POST /api/review/scope-trigger and the
   *  queue cache invalidates so the lifecycle promotes to
   *  `queued`. */
  scopeTrigger?: {
    label: string;
    onTrigger: () => Promise<void>;
  };
  /** IA Phase 26 — explicit "Reset and rerun review" affordance.
   *  Wipes the snapshot and enqueues a fresh provider call. Costs
   *  one Gemini invocation; the button copy + confirm prompt
   *  flag this so the operator doesn't trigger it accidentally. */
  rerun?: {
    enabled: boolean;
    onRerun: () => Promise<void>;
  };
}) {
  const { lifecycle, score, summary, checks, provider, promptVersion } =
    evaluation;
  const caption = lifecycleCaption(lifecycle);

  // Counts for the section header chip — neutral checks are excluded
  // from the "X/Y passed" denominator so the operator sees the
  // applicable check ratio.
  const applicable = checks.filter((c) => c.state !== "neutral");
  const failedCount = applicable.filter((c) => c.state === "failed").length;
  const passedCount = applicable.filter((c) => c.state === "passed").length;
  const neutralCount = checks.length - applicable.length;
  // CLAUDE.md Madde N+ — blocker fail forces NEEDS_REVIEW regardless
  // of score. Score chip turns red when a blocker is failed, so the
  // operator instantly reads "high score is misleading — there's a
  // blocker."
  const hasBlockerFail = applicable.some(
    (c) => c.state === "failed" && c.severity === "blocker",
  );

  return (
    <section data-testid="evaluation-panel">
      <SectionTitle>System evaluation</SectionTitle>

      {/* Lifecycle row — operator önce hangi state'te olduğunu görür. */}
      <div
        className="mt-2 flex items-center gap-2"
        data-testid="evaluation-lifecycle"
        data-state={lifecycle}
      >
        {lifecycle === "ready" && score !== null ? (
          <span
            className={cn(
              "rounded-md px-2 py-0.5 font-mono text-xs",
              hasBlockerFail
                ? "bg-rose-500/20 text-rose-200"
                : "bg-white/10 text-white",
            )}
            data-testid="evaluation-score"
            data-blocker-fail={hasBlockerFail || undefined}
          >
            {score}/100
          </span>
        ) : null}
        <span
          className={cn(
            "inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-meta",
            lifecycle === "ready"
              ? "text-white/70"
              : lifecycle === "error"
                ? "text-rose-300"
                : "text-amber-300",
          )}
        >
          {lifecycle !== "ready" ? (
            <Hourglass className="h-3 w-3" aria-hidden />
          ) : null}
          {caption}
        </span>
      </div>

      {/* Honest copy — sadece ready'de checklist + summary anlamlı.
        Pending/scoring/error'da operatöre dürüst durum mesajı. */}
      {lifecycle === "ready" ? (
        <>
          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <SectionTitle>Checks</SectionTitle>
              <span
                className="font-mono text-[10.5px] uppercase tracking-meta text-white/40"
                data-testid="evaluation-checks-count"
              >
                {passedCount}/{applicable.length} passed
                {neutralCount > 0 ? ` · ${neutralCount} n/a` : ""}
              </span>
            </div>
            <ul className="mt-2 space-y-1.5">
              {checks.map((c) => {
                // Severity-aware tone: blocker = red, warning = amber,
                // info = neutral. CLAUDE.md Madde N+ — failed satırlar
                // ciddiyet seviyesine göre görsel ayrılır.
                const tone =
                  c.state === "failed"
                    ? c.severity === "blocker"
                      ? "text-rose-200"
                      : c.severity === "warning"
                        ? "text-amber-200"
                        : "text-white/70"
                    : c.state === "neutral"
                      ? "text-white/40"
                      : "text-white/70";
                const iconColor =
                  c.state === "failed"
                    ? c.severity === "blocker"
                      ? "text-rose-400"
                      : c.severity === "warning"
                        ? "text-amber-400"
                        : "text-white/40"
                    : c.state === "passed"
                      ? "text-emerald-400"
                      : "text-white/30";
                return (
                  <li
                    key={c.id}
                    className={cn("flex items-start gap-2 text-xs", tone)}
                    data-testid="evaluation-check"
                    data-state={c.state}
                    data-severity={c.severity}
                    data-passed={c.state === "passed" || undefined}
                  >
                    {c.state === "passed" ? (
                      <CheckIcon
                        className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", iconColor)}
                        aria-hidden
                      />
                    ) : c.state === "failed" ? (
                      <AlertTriangle
                        className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", iconColor)}
                        aria-hidden
                      />
                    ) : (
                      <MinusCircle
                        className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", iconColor)}
                        aria-hidden
                      />
                    )}
                    <span>
                      {c.label}
                      {c.state === "failed" && c.reason ? (
                        <span className="block text-[11px] text-white/50">
                          {c.reason}
                        </span>
                      ) : null}
                      {c.state === "neutral" && c.neutralReason ? (
                        <span className="block text-[11px] text-white/40">
                          {c.neutralReason}
                        </span>
                      ) : null}
                      {c.severity &&
                      c.weight !== undefined &&
                      c.state === "failed" ? (
                        // IA Phase 20 — severity chip yalnız FAILED satırlarında
                        // görünür. Passed/neutral satırlarda göstermek
                        // operatörü yanıltıyor (yeşil tikin yanında "BLOCKER"
                        // ciddiyet çağrıştırıyor).
                        <span
                          className={cn(
                            "ml-1.5 inline-flex items-center gap-1 align-baseline font-mono text-[10px] uppercase tracking-meta",
                            c.severity === "blocker"
                              ? "text-rose-300"
                              : c.severity === "warning"
                                ? "text-amber-300"
                                : "text-white/30",
                          )}
                        >
                          {c.severity}
                          {c.severity !== "info" && c.weight > 0
                            ? ` · w${c.weight}`
                            : ""}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* IA-29 — AI suggestion (advisory only). Operatör kararına
           *   karışmaz; küçük inline chip + bir satır gerekçe. Stored
           *   operator decision varsa onun yanında advisory referans
           *   olarak durur. */}
          {evaluation.aiSuggestion ? (
            <div
              className="mt-4 rounded-md border border-white/8 bg-white/[0.03] px-3 py-2"
              data-testid="evaluation-ai-suggestion"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-meta text-white/45">
                  AI suggestion
                </span>
                <span
                  className={cn(
                    "rounded-sm px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-meta",
                    evaluation.aiSuggestion.status === "APPROVED"
                      ? "bg-emerald-500/12 text-emerald-200"
                      : evaluation.aiSuggestion.reasonKind === "blocker_fail"
                        ? "bg-rose-500/15 text-rose-200"
                        : "bg-amber-500/12 text-amber-200",
                  )}
                  data-testid="ai-suggestion-status"
                >
                  {evaluation.aiSuggestion.status === "APPROVED"
                    ? "Looks good"
                    : "Review recommended"}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-white/55">
                {evaluation.aiSuggestion.reason}
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-white/35">
                Advisory only — final decision is yours via Keep / Discard.
              </p>
            </div>
          ) : null}

          {summary ? (
            <div className="mt-4">
              <SectionTitle>Summary</SectionTitle>
              <p className="mt-2 text-xs leading-relaxed text-white/75">
                {summary}
              </p>
            </div>
          ) : null}

          {/* IA-38b — Score breakdown collapsible. Default kapalı;
           *   operatör açtığında score'un nasıl oluştuğunu satır satır
           *   görür. Base 100 → her failed applicable kriterin weight'i
           *   ayrı satır → final score. Hidden contribution yok; matematik
           *   tam görünür. */}
          {score !== null && applicable.length > 0 ? (
            <details
              className="mt-4 group"
              data-testid="evaluation-score-breakdown"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-2 list-none">
                <SectionTitle>Score breakdown</SectionTitle>
                <span
                  className="font-mono text-[10px] uppercase tracking-meta text-white/40"
                  aria-hidden
                >
                  +
                </span>
              </summary>
              <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 font-mono text-[11px]">
                <dt className="text-white/55">Base</dt>
                <dd className="tabular-nums text-white/75">100</dd>
                {applicable
                  .filter((c) => c.state === "failed" && (c.weight ?? 0) > 0)
                  .map((c) => (
                    <Fragment key={c.id}>
                      <dt
                        className={cn(
                          "truncate",
                          c.severity === "blocker"
                            ? "text-rose-200/80"
                            : "text-amber-200/80",
                        )}
                        title={c.label}
                      >
                        {c.label}
                      </dt>
                      <dd className="tabular-nums text-rose-300/90">
                        −{c.weight}
                      </dd>
                    </Fragment>
                  ))}
                <dt className="border-t border-white/10 pt-1 text-white/60">
                  Final
                </dt>
                <dd className="border-t border-white/10 pt-1 font-semibold tabular-nums text-white">
                  {score}
                </dd>
              </dl>
              <p className="mt-2 text-[10.5px] leading-relaxed text-white/40">
                N/A criteria score'a girmez. Severity (blocker / warning)
                yalnız UI tone — score yalnız weight'lerden hesaplanır.
              </p>
            </details>
          ) : null}

          {provider ? (
            <details
              className="mt-4 group"
              data-testid="evaluation-provider-section"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-2 list-none">
                <SectionTitle>Provider</SectionTitle>
                <span
                  className="font-mono text-[10px] uppercase tracking-meta text-white/40"
                  aria-hidden
                >
                  +
                </span>
              </summary>
              <p
                className="mt-2 font-mono text-[11px] text-white/55"
                data-testid="evaluation-provider"
              >
                {provider}
                {promptVersion ? ` · prompt ${promptVersion}` : ""}
              </p>
            </details>
          ) : null}

          {/* IA Phase 27 — Rerun collapsible (default closed). Operator
           *   nadiren açar; default kapalı tutmak panelde gürültü
           *   üretmiyor. CLAUDE.md Madde Q (information density). */}
          {rerun ? <RerunSection {...rerun} /> : null}

          {/* IA Phase 28 (CLAUDE.md Madde S) — Stored decision en
           *   altta + collapsible. **Canonical truth**: persisted
           *   reviewStatus + operator override sinyali. Current
           *   policy preview ayrı bir alan; yalnız stored ≠ preview
           *   olduğunda görünür ve "with current thresholds" etiketi
           *   taşır, asla ana karar gibi sunulmaz. */}
          {evaluation.decisionOutcome ? (
            <details
              className="mt-4 group"
              data-testid="evaluation-decision-outcome"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-2 list-none">
                <SectionTitle>Stored decision</SectionTitle>
                <span className="flex items-center gap-1.5">
                  {evaluation.decisionOutcome.reasonKind ===
                  "operator_override" ? (
                    <span className="font-mono text-[10px] uppercase tracking-meta text-white/40">
                      Operator
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-meta",
                      evaluation.decisionOutcome.status === "APPROVED"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : evaluation.decisionOutcome.status === "REJECTED"
                          ? "bg-rose-500/20 text-rose-200"
                          : evaluation.decisionOutcome.status === "NEEDS_REVIEW"
                            ? evaluation.decisionOutcome.reasonKind ===
                              "blocker_fail"
                              ? "bg-rose-500/15 text-rose-200"
                              : "bg-amber-500/10 text-amber-200"
                            : "bg-white/10 text-white",
                    )}
                    data-testid="evaluation-decision-status"
                  >
                    {storedDecisionLabel(evaluation.decisionOutcome)}
                  </span>
                  <span
                    className="font-mono text-[10px] uppercase tracking-meta text-white/40"
                    aria-hidden
                  >
                    +
                  </span>
                </span>
              </summary>
              {evaluation.decisionOutcome.reasonKind ===
              "operator_override" ? (
                <p className="mt-2 text-[10.5px] uppercase tracking-meta text-white/40">
                  System eval kept as reference
                </p>
              ) : null}
              <p
                className="mt-2 text-xs leading-relaxed text-white/75"
                data-testid="evaluation-decision-reason"
              >
                {evaluation.decisionOutcome.reason}
              </p>
              <p className="mt-2 text-[10.5px] leading-relaxed text-white/40">
                Threshold changes do not rewrite stored decisions.
                The persisted status above is the truth listings,
                exports and downstream actions follow.
              </p>
            </details>
          ) : null}

          {/* IA Phase 28 — Current policy preview. Yalnız stored
           *   decision'dan farklı çıktığında dolar; canonical
           *   karar gibi sunulmaz, açık "preview" etiketi taşır. */}
          {evaluation.currentPolicyPreview ? (
            <div
              className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2"
              data-testid="evaluation-policy-preview"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-meta text-amber-200">
                  Current policy preview
                </span>
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-meta",
                    evaluation.currentPolicyPreview.status === "APPROVED"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-amber-500/15 text-amber-200",
                  )}
                  data-testid="policy-preview-status"
                >
                  {evaluation.currentPolicyPreview.status === "APPROVED"
                    ? "would auto-approve"
                    : "would need review"}
                </span>
              </div>
              <p
                className="mt-1.5 text-[11px] leading-relaxed text-white/70"
                data-testid="policy-preview-reason"
              >
                With current thresholds (
                {evaluation.currentPolicyPreview.thresholds.low}/
                {evaluation.currentPolicyPreview.thresholds.high}),
                this asset would be re-evaluated as above. The stored
                decision stays unchanged until you trigger an
                explicit rerun.
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {/* IA-30 (B3) — Operator decision lifecycle-bağımsız.
           *   Operatör Keep/Reject damgalı item için panel "not queued"
           *   empty state göstermez; canonical karar görünür. */}
          {evaluation.decisionOutcome ? (
            <div
              className="mt-3 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2"
              data-testid="evaluation-decision-outcome"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-meta text-white/55">
                  Stored decision
                </span>
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-meta",
                    evaluation.decisionOutcome.status === "APPROVED"
                      ? "bg-emerald-500/15 text-emerald-200"
                      : evaluation.decisionOutcome.status === "REJECTED"
                        ? "bg-rose-500/15 text-rose-200"
                        : "bg-white/10 text-white/75",
                  )}
                  data-testid="evaluation-decision-status"
                >
                  {evaluation.decisionOutcome.status === "APPROVED"
                    ? "Kept"
                    : evaluation.decisionOutcome.status === "REJECTED"
                      ? "Rejected"
                      : "Operator decision"}
                </span>
              </div>
              <p
                className="mt-1.5 text-[11px] leading-relaxed text-white/65"
                data-testid="evaluation-decision-reason"
              >
                {evaluation.decisionOutcome.reason}
              </p>
            </div>
          ) : null}
          <p
            className="mt-2 text-xs leading-relaxed text-white/60"
            data-testid="evaluation-empty-copy"
          >
            {lifecycle === "not_queued" || lifecycle === "pending"
              ? notQueuedCopy(evaluation.notQueuedReason)
              : lifecycle === "queued"
                ? "Queued for review — the worker will pick this up shortly."
                : lifecycle === "running" || lifecycle === "scoring"
                  ? "Waiting for AI response — refresh in a few seconds."
                  : lifecycle === "failed" || lifecycle === "error"
                    ? "Review failed. Check Settings → Review for provider status."
                    : "Evaluation is not applicable for this asset."}
          </p>
          {scopeTrigger &&
          (lifecycle === "not_queued" ||
            lifecycle === "pending" ||
            lifecycle === "failed" ||
            lifecycle === "error") ? (
            <ScopeTriggerButton
              label={scopeTrigger.label}
              onTrigger={scopeTrigger.onTrigger}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

function ScopeTriggerButton({
  label,
  onTrigger,
}: {
  label: string;
  onTrigger: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-3" data-testid="evaluation-scope-trigger">
      <button
        type="button"
        disabled={busy || done}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await onTrigger();
            setDone(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-k-orange bg-k-orange/15 px-3 text-xs font-medium text-white hover:bg-k-orange/25 disabled:cursor-not-allowed disabled:opacity-60"
        data-testid="evaluation-trigger-btn"
      >
        <Zap className="h-3 w-3" aria-hidden />
        {busy
          ? "Enqueueing…"
          : done
            ? "Enqueued"
            : `Enqueue review for ${label}`}
      </button>
      <p className="mt-1.5 text-[10.5px] text-white/45">
        Queues undecided items in this scope that do not have a valid
        review yet. Already-scored items are skipped automatically.
      </p>
      {error ? (
        <p className="mt-1.5 text-[11px] text-rose-300">{error}</p>
      ) : null}
    </div>
  );
}

// IA Phase 28 — stored decision chip label helper. Operator override
// her statüsü "Operator decision" olarak gösterir; SYSTEM kararı için
// status'ten okunaklı bir kelime üretiriz.
function storedDecisionLabel(
  outcome: NonNullable<import("@/features/review/lib/evaluation").Evaluation["decisionOutcome"]>,
): string {
  if (outcome.reasonKind === "operator_override") return "Operator decision";
  switch (outcome.status) {
    case "APPROVED":
      return "Auto-approved";
    case "REJECTED":
      return "Rejected";
    case "NEEDS_REVIEW":
      return "Needs review";
    default:
      return "Pending";
  }
}

function RerunSection({
  enabled,
  onRerun,
}: {
  enabled: boolean;
  onRerun: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // IA Phase 27 — collapsible (default closed). Operatör nadiren rerun
  // ister; default kapalı tutarak panel gürültüsünü düşürüyoruz
  // (CLAUDE.md Madde Q + kullanıcı talebi). `<details>` yapısı a11y
  // ve klavye için native; ek state gereksiz.
  return (
    <details
      className="mt-4 group"
      data-testid="evaluation-rerun"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-2 list-none">
        <SectionTitle>Rerun review</SectionTitle>
        <span
          className="font-mono text-[10px] uppercase tracking-meta text-white/40"
          aria-hidden
        >
          +
        </span>
      </summary>
      <p className="mt-2 text-[10.5px] leading-relaxed text-white/45">
        Discards the current AI snapshot and queues a fresh provider
        call. Costs one Gemini invocation; use only when the existing
        evaluation is wrong or stale.
      </p>
      {!confirming ? (
        <button
          type="button"
          disabled={!enabled || busy}
          onClick={() => setConfirming(true)}
          className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-md border border-white/15 px-2.5 text-[11px] text-white/75 hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="evaluation-rerun-btn"
        >
          Reset and rerun review
        </button>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onRerun();
                setConfirming(false);
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : String(err),
                );
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-rose-400/60 bg-rose-500/15 px-2.5 text-[11px] font-medium text-rose-100 hover:bg-rose-500/25 disabled:opacity-50"
            data-testid="evaluation-rerun-confirm"
          >
            {busy ? "Rerunning…" : "Confirm rerun"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/15 px-2.5 text-[11px] text-white/70 hover:border-white/30"
          >
            Cancel
          </button>
        </div>
      )}
      {error ? (
        <p className="mt-1.5 text-[11px] text-rose-300">{error}</p>
      ) : null}
    </details>
  );
}
