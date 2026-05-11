// Phase 6 Dalga B (Task 15) — ReviewRiskFlagList
//
// Detay panelin risk flag bölümü. Provider'ın döndüğü 8 sabit kind'ı Türkçe
// label + confidence yüzdesi + reason ile listeler.
//
// Drift koruması: FLAG_LABEL anahtar listesi `ReviewRiskFlagType` enum'unu
// `Record` kapsamasıyla zorunlu kılar — yeni flag eklenirse compile-time
// hata verir (TypeScript exhaustiveness).
//
// Drift #5 (2026-04-30) read-both: alan adı `type` → `kind` (KIE strict
// JSON schema reserved-word fix). Queue route DB'deki Json'ı parse ETMEDEN
// UI'ya gönderir; eski row'lar (`type`) hâlâ olabilir. `readRiskFlagKind`
// helper'ı önce `kind`, yoksa legacy `type` okur — UI graceful render eder.
// Bilinmeyen string'i FLAG_LABEL key'i olarak yakalamak için type guard.
//
// CLAUDE.md design tokens: hardcoded renk yasak; surface-2/text-muted
// alias'ları kullanılır.

import {
  readRiskFlagKind,
  isReviewRiskFlagType,
  type ReviewRiskFlag,
  type ReviewRiskFlagType,
} from "@/providers/review/types";
import { StateMessage } from "@/components/ui/StateMessage";

const FLAG_LABEL: Record<ReviewRiskFlagType, string> = {
  watermark_detected: "Watermark",
  signature_detected: "İmza",
  visible_logo_detected: "Logo",
  celebrity_face_detected: "Ünlü yüzü",
  no_alpha_channel: "Alfa kanalı yok",
  transparent_edge_artifact: "Kenar artifact",
  text_detected: "Yazı tespit edildi",
  gibberish_text_detected: "Bozuk yazı",
};

type Props = { flags: ReviewRiskFlag[] };

export function ReviewRiskFlagList({ flags }: Props) {
  if (flags.length === 0) {
    return (
      <StateMessage
        tone="neutral"
        title="Risk işareti yok"
      />
    );
  }

  return (
    <section
      aria-label="Risk işaretleri"
      className="flex flex-col gap-2"
      data-testid="risk-flag-list"
    >
      <h3 className="text-sm font-medium text-text">
        Risk işaretleri ({flags.length})
      </h3>
      <ul className="flex flex-col gap-2">
        {flags.map((flag, idx) => {
          // Drift #5 read-both: önce kind (yeni), yoksa type (legacy DB row).
          const rawKind = readRiskFlagKind(flag);
          const known = rawKind !== null && isReviewRiskFlagType(rawKind);
          const label = known
            ? FLAG_LABEL[rawKind as ReviewRiskFlagType]
            : (rawKind ?? "Bilinmeyen");
          return (
            <li
              key={`${rawKind ?? "unknown"}-${idx}`}
              data-testid="risk-flag-item"
              className="rounded-md border border-border bg-surface-muted p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text">{label}</span>
                <span
                  className="font-mono text-xs text-text-muted"
                  aria-label={`Güven: %${Math.round(flag.confidence * 100)}`}
                >
                  %{Math.round(flag.confidence * 100)}
                </span>
              </div>
              <p className="mt-1 text-xs text-text-muted">{flag.reason}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
