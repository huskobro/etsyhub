// Pass 58 — Failure detail structured panel.
//
// Pass 53'te `failedReason` salt-pre tek bloktu; Pass 58 bunu yapısal hâle
// getirir:
//   • Üstte kısa tek-satır özet (operatörün ilk gördüğü)
//   • blockReason'a göre actionable öneri (selector-mismatch, render-timeout,
//     login-required vs.)
//   • Multi-line / stack trace ise <details> içinde collapse (kopya butonu
//     hâlâ var; FailureDetail'in kendi reusable copy'siyle).
//
// Pure server component (CopyButton client çocuk olarak).

import { CopyButton } from "./CopyButton";

type FailureDetailProps = {
  failedReason: string;
  blockReason: string | null;
};

const ACTION_HINTS: Record<string, string> = {
  "challenge-required":
    "MJ tarayıcı penceresine gidin, Cloudflare/captcha doğrulamasını tamamlayın. Bridge bekliyor; tamamlanınca otomatik devam eder.",
  "login-required":
    "MJ tarayıcı penceresinde Discord/Google ile login olun. Bridge persistent profile session'ı saklar; sonraki turda tekrar gerekmez.",
  "render-timeout":
    "Render 3 dk içinde tamamlanmadı. MJ premium kotanız bitmiş olabilir veya MJ tarafında yavaşlık var. Aynı promptla retry deneyin; tekrar timeout olursa MJ web'de manuel test edin.",
  "selector-mismatch":
    "MJ web tarafında DOM değişmiş — bridge selector'ları kalibre edilmeli. mj-bridge/scripts/inspect-mj-dom.ts ile gerçek DOM'u dump edin, selectors.ts default'larını güncelleyin.",
  "browser-crashed":
    "Chrome attach session düştü. Bridge'i restart edin; Chrome ayrı user-data-dir profile ile hâlâ açıksa attach pre-flight başarılı olur.",
  "rate-limited":
    "MJ rate-limit'e takıldı. Birkaç dakika bekleyip retry deneyin. Çok sık tetikleme yapılmamalı (TOS).",
  "user-cancelled":
    "Operatör manuel iptal etti. Aynı promptla retry uygun.",
  "internal-error":
    "Bridge tarafında beklenmeyen hata. Bridge log'unu kontrol edin (tail -f /tmp/mj-bridge.log).",
};

function summarize(failedReason: string): {
  short: string;
  rest: string | null;
} {
  // İlk satırı al; geri kalan stack trace varsa rest'e koy.
  const lines = failedReason.split(/\r?\n/);
  const short = (lines[0] ?? "").trim();
  if (lines.length === 1) return { short, rest: null };
  const rest = lines.slice(1).join("\n").trim();
  if (rest.length === 0) return { short, rest: null };
  return { short, rest };
}

export function FailureDetail({
  failedReason,
  blockReason,
}: FailureDetailProps) {
  const { short, rest } = summarize(failedReason);
  const hint = blockReason ? ACTION_HINTS[blockReason] : null;

  return (
    <section
      className="rounded-md border border-danger bg-danger-soft p-4 text-sm text-danger-text"
      data-testid="mj-job-failed-reason"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">⚠ Başarısızlık nedeni</span>
        {blockReason ? (
          <span className="rounded bg-danger px-1.5 py-0.5 font-mono text-xs text-on-accent">
            {blockReason}
          </span>
        ) : null}
        <CopyButton value={failedReason} label="hata" />
      </div>

      <div className="mt-2 font-mono text-xs">{short}</div>

      {hint ? (
        <div
          className="mt-2 rounded border border-danger bg-bg p-2 text-xs text-text"
          data-testid="mj-failure-hint"
        >
          <span className="font-semibold">Önerilen aksiyon:</span> {hint}
        </div>
      ) : null}

      {rest ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-text-muted hover:text-text">
            Stack / detay ({rest.split(/\r?\n/).length} satır)
          </summary>
          <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-bg p-2 font-mono text-xs text-text">
            {rest}
          </pre>
        </details>
      ) : null}
    </section>
  );
}
