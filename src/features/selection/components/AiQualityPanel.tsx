"use client";

// Phase 7 Task 27 — Selection Studio sağ panel AI Kalite bölümü.
//
// Spec Section 3.2 + Section 1.4 + Section 8.1:
//   - Review yok → muted "henüz review yok" hint + disabled "Review'a gönder"
//     button (Phase 6 canlı smoke sonrası aktif edilecek; Task 38 carry-forward
//     gate `selection-studio-trigger-review`).
//   - Review var → score (büyük rakam, tone'a göre renk: ≥90 success, ≥60
//     warning, <60 danger) + status Badge (TR human-readable: Onaylandı /
//     Gözden geçir / Reddedildi / Beklemede) + 4 sinyal listesi:
//       1. Çözünürlük: ok→OK / low→Düşük / unknown→Bilinmiyor
//       2. Text detection: clean→Temiz / issue→İşaret var
//       3. Artifact check: clean→Temiz / issue→İşaret var
//       4. Trademark risk: low→Düşük / high→Yüksek
//
// Panel kaybolmaz (review yok dahi olsa) — fake capability vermez ama
// kullanıcıya "AI Kalite" başlığı + neden boş olduğu net görünür.
//
// Phase 6 mapper sözleşmesi (Task 16): `review.status` enum string'ler
// ("approved" / "needs_review" / "rejected" / "pending"). Bilinmeyen string
// gelirse defansif olarak "Beklemede" tonuna düşer (statusDisplay default).

import type { SelectionItemView } from "../queries";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

export type AiQualityPanelProps = {
  item: SelectionItemView;
};

type SignalKey =
  | "resolution"
  | "textDetection"
  | "artifactCheck"
  | "trademarkRisk";

const SIGNAL_LABELS: ReadonlyArray<{ key: SignalKey; label: string }> = [
  { key: "resolution", label: "Çözünürlük" },
  { key: "textDetection", label: "Text detection" },
  { key: "artifactCheck", label: "Artifact check" },
  { key: "trademarkRisk", label: "Trademark risk" },
];

type SignalTone = "success" | "warning" | "danger" | "muted";

/** Sinyal değer → tone (dot rengi + semantic). */
function signalTone(key: SignalKey, value: string): SignalTone {
  if (key === "resolution") {
    if (value === "ok") return "success";
    if (value === "low") return "warning";
    return "muted"; // "unknown" veya bilinmeyen
  }
  if (key === "textDetection" || key === "artifactCheck") {
    return value === "clean" ? "success" : "warning";
  }
  if (key === "trademarkRisk") {
    return value === "low" ? "success" : "danger";
  }
  return "muted";
}

/** Sinyal değer → TR human-readable display. */
function signalDisplay(key: SignalKey, value: string): string {
  if (key === "resolution") {
    if (value === "ok") return "OK";
    if (value === "low") return "Low";
    return "Bilinmiyor";
  }
  if (key === "textDetection" || key === "artifactCheck") {
    return value === "clean" ? "Temiz" : "İşaret var";
  }
  if (key === "trademarkRisk") {
    return value === "low" ? "Low" : "High";
  }
  return value;
}

/** Phase 6 review.status enum → TR label + Badge tone. */
function statusDisplay(status: string): { label: string; tone: BadgeTone } {
  if (status === "approved") return { label: "Approved", tone: "success" };
  if (status === "needs_review")
    return { label: "Review", tone: "warning" };
  if (status === "rejected") return { label: "Reddedildi", tone: "danger" };
  return { label: "Beklemede", tone: "neutral" };
}

/** Score rengi — ≥90 success, ≥60 warning, <60 danger (Phase 6 eşiği). */
function scoreColorClass(score: number): string {
  if (score >= 90) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-danger";
}

/** Sinyal tone → dot rengi (token-only). */
function dotColorClass(tone: SignalTone): string {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  return "bg-text-muted";
}

const SECTION_LABEL_CLASS =
  "font-mono text-xs uppercase tracking-meta text-text-muted";

export function AiQualityPanel({ item }: AiQualityPanelProps) {
  // queries.ts: `review: ReviewView | null` (route mapper). types.ts'ta
  // opsiyonel `?:` (undefined). Her ikisi de "review yok" anlamına gelir.
  const review = item.review ?? null;

  if (review === null) {
    return (
      <div className="border-b border-border-subtle px-4 py-3">
        <div className={SECTION_LABEL_CLASS}>AI Kalite</div>
        <p className="mt-2 text-xs text-text-muted">
          Bu varyant için AI kalite analizi yapılmamış.
        </p>
        <button
          type="button"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          title="Phase 6 canlı smoke sonrası aktif edilecek"
          className="mt-2 cursor-not-allowed text-xs text-text-muted underline decoration-dotted disabled:opacity-60"
        >
          Review&apos;a gönder
        </button>
      </div>
    );
  }

  const status = statusDisplay(review.status);

  return (
    <div className="border-b border-border-subtle px-4 py-3">
      <div className={SECTION_LABEL_CLASS}>AI Kalite</div>
      <div className="mt-2 flex items-baseline gap-3">
        <div
          className={`text-3xl font-semibold leading-none ${scoreColorClass(
            review.score,
          )}`}
        >
          {review.score}
        </div>
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
      </div>

      <div className="mt-3 flex flex-col gap-1.5 text-xs text-text-muted">
        {SIGNAL_LABELS.map(({ key, label }) => {
          const value = review.signals[key];
          const tone = signalTone(key, value);
          const display = signalDisplay(key, value);
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${dotColorClass(tone)}`}
                aria-hidden
              />
              <span className="flex-1">{label}</span>
              <span className="font-mono text-text">{display}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
