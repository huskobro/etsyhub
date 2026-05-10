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

import { useState } from "react";
import { Check as CheckIcon, AlertTriangle, Hourglass, MinusCircle, Zap } from "lucide-react";
import { SectionTitle } from "@/features/review/components/ReviewWorkspaceShell";
import {
  type Evaluation,
  lifecycleCaption,
} from "@/features/review/lib/evaluation";
import { cn } from "@/lib/cn";

/* eslint-disable no-restricted-syntax */
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

          {summary ? (
            <div className="mt-4">
              <SectionTitle>Summary</SectionTitle>
              <p className="mt-2 text-xs leading-relaxed text-white/75">
                {summary}
              </p>
            </div>
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

          {/* IA Phase 27 — Decision en altta + collapsible (default
           *   closed). CLAUDE.md Madde Q + kullanıcı talebi: operatör
           *   açıklamayı istediğinde okur, kart üstündeki yer Checks +
           *   Summary + Provider için ayrılır. */}
          {evaluation.decisionOutcome ? (
            <details
              className="mt-4 group"
              data-testid="evaluation-decision-outcome"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-2 list-none">
                <SectionTitle>Decision</SectionTitle>
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
                      evaluation.decisionOutcome.reasonKind === "auto_approved"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : evaluation.decisionOutcome.reasonKind === "blocker_fail"
                          ? "bg-rose-500/15 text-rose-200"
                          : evaluation.decisionOutcome.reasonKind === "low_score"
                            ? "bg-rose-500/10 text-rose-200"
                            : evaluation.decisionOutcome.reasonKind ===
                                "operator_override"
                              ? "bg-white/10 text-white"
                              : "bg-amber-500/10 text-amber-200",
                    )}
                    data-testid="evaluation-decision-status"
                  >
                    {evaluation.decisionOutcome.reasonKind ===
                    "operator_override"
                      ? "Operator decision"
                      : evaluation.decisionOutcome.status === "APPROVED"
                        ? "Auto-approved"
                        : "Needs review"}
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
            </details>
          ) : null}
        </>
      ) : (
        <>
          <p
            className="mt-2 text-xs leading-relaxed text-white/60"
            data-testid="evaluation-empty-copy"
          >
            {lifecycle === "not_queued" || lifecycle === "pending"
              ? "This asset has not been queued for review yet."
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
