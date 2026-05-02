// Phase 8 Task 25 — Karar bandı (sticky footer, render et + durum).
//
// Spec §5.2.3: ETA, durum badge, render et butonu + 9 durum coverage
// (boş pack, uyumsuzluk, rendering, error, success, locked, retry, override, pending).
//
// Props: isQuickPack, packSize, isLoading, isDirty, error, isDisabled, estimatedSeconds, onRender
// Alanlar: durum badge (rendering/error/ready), ETA, render et butonunun enable/disable'ı

import { memo } from "react";

type DecisionState =
  | "empty" // Pack boş
  | "incompatible" // Uyumsuzluk var, kullanıcı onay verebilir
  | "rendering" // İş devam ediyor
  | "error" // İş başarısız
  | "success" // Tamamlandı
  | "locked" // Lock (iş yapan başka bir set)
  | "retry" // Yeniden denemelerde
  | "override" // Uyarı atlama onayı bekliyor
  | "ready"; // Render et hazır

interface DecisionBandProps {
  state?: DecisionState;
  isQuickPack?: boolean;
  packSize?: number;
  estimatedSeconds?: number;
  errorMessage?: string;
  isDisabled?: boolean;
  onRender?: () => void | Promise<void>;
  isDirty?: boolean;
  onCancel?: () => void;
}

function DecisionBandComponent({
  state = "ready",
  isQuickPack = true,
  packSize = 0,
  estimatedSeconds = 30,
  errorMessage,
  isDisabled = false,
  onRender,
  isDirty = false,
  onCancel,
}: DecisionBandProps) {
  // Durum badge'i ve stili
  const getStateUI = (s: DecisionState) => {
    switch (s) {
      case "empty":
        return {
          badge: "⚠ Boş Pack",
          badgeClass: "bg-zinc-100 text-zinc-700",
          buttonDisabled: true,
          buttonText: "Şablon Seçin",
        };
      case "incompatible":
        return {
          badge: "⚠ Uyumsuz",
          badgeClass: "bg-red-50 text-red-700",
          buttonDisabled: false,
          buttonText: "Yine de Render Et",
        };
      case "rendering":
        return {
          badge: "⏳ Rendering…",
          badgeClass: "bg-blue-50 text-blue-700",
          buttonDisabled: true,
          buttonText: "İptal",
          showSpinner: true,
        };
      case "error":
        return {
          badge: "✕ Hata",
          badgeClass: "bg-red-100 text-red-700",
          buttonDisabled: false,
          buttonText: "Yeniden Dene",
        };
      case "success":
        return {
          badge: "✓ Tamamlandı",
          badgeClass: "bg-green-50 text-green-700",
          buttonDisabled: true,
          buttonText: "Devam Et",
        };
      case "locked":
        return {
          badge: "🔒 Başka İş Var",
          badgeClass: "bg-yellow-50 text-yellow-700",
          buttonDisabled: true,
          buttonText: "Bekleyin",
        };
      case "retry":
        return {
          badge: "🔄 Yeniden Deneniyor",
          badgeClass: "bg-blue-50 text-blue-700",
          buttonDisabled: true,
          buttonText: "Devam Ediyor",
          showSpinner: true,
        };
      case "override":
        return {
          badge: "⚠ Onay Gerekli",
          badgeClass: "bg-orange-50 text-orange-700",
          buttonDisabled: false,
          buttonText: "Evet, Render Et",
        };
      case "ready":
      default:
        return {
          badge: "✓ Hazır",
          badgeClass: "bg-green-50 text-green-700",
          buttonDisabled: false,
          buttonText: `Render Et (${packSize || 0} × ${isQuickPack ? "Quick" : "Custom"})`,
        };
    }
  };

  const ui = getStateUI(state);
  const actualEstimate =
    state === "rendering" || state === "retry"
      ? `İşlem devam ediyor (~${estimatedSeconds}s kaldı)`
      : `Tahmini süre: ~${estimatedSeconds}s`;

  return (
    <footer
      className="sticky bottom-0 border-t border-border bg-white px-6 py-3"
      data-testid="decision-band"
      role="complementary"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Sol: Durum badge + tahmini süre */}
        <div className="flex flex-col gap-1.5">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ui.badgeClass}`}
            data-testid={`decision-state-${state}`}
          >
            {ui.showSpinner && (
              <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {ui.badge}
          </span>

          {/* Tahmini süre veya hata mesajı */}
          {state === "error" && errorMessage ? (
            <p className="text-xs text-red-600">Hata: {errorMessage}</p>
          ) : (
            <p className="text-xs text-text-muted">{actualEstimate}</p>
          )}
        </div>

        {/* Sağ: Render/İptal butonları */}
        <div className="flex items-center gap-2">
          {(state === "rendering" || state === "retry") && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md bg-zinc-200 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-300"
              data-testid="cancel-button"
            >
              İptal
            </button>
          )}

          <button
            type="button"
            onClick={onRender}
            disabled={isDisabled || ui.buttonDisabled}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              isDisabled || ui.buttonDisabled
                ? "cursor-not-allowed bg-zinc-300 text-zinc-600 opacity-50"
                : state === "error" || state === "incompatible" || state === "override"
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-zinc-900 text-white hover:bg-zinc-800"
            }`}
            data-testid={`render-button-${state}`}
          >
            {ui.buttonText}
          </button>
        </div>
      </div>

      {/* Dirty state uyarısı (değişiklikler kaydedilmedi) */}
      {isDirty && state !== "rendering" && state !== "retry" && (
        <p className="mt-2 text-xs text-orange-600">
          ⚠️ Değişiklikler kaydedilmedi. Render et butonunu tıklamak değişiklikleri uygulayacaktır.
        </p>
      )}
    </footer>
  );
}

export const DecisionBand = memo(DecisionBandComponent);
