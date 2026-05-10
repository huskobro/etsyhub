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

import { Check as CheckIcon, AlertTriangle, Hourglass, MinusCircle } from "lucide-react";
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
}: {
  evaluation: Evaluation;
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
            <div className="mt-4">
              <SectionTitle>Provider</SectionTitle>
              <p
                className="mt-2 font-mono text-[11px] text-white/55"
                data-testid="evaluation-provider"
              >
                {provider}
                {promptVersion ? ` · prompt ${promptVersion}` : ""}
              </p>
            </div>
          ) : null}
        </>
      ) : (
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
      )}
    </section>
  );
}
