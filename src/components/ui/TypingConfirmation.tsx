"use client";

// Phase 6 Dalga B (Task 17) — TypingConfirmation primitive.
//
// Phase 5 carry-forward "destructive-typing-confirmation" gereği — yıkıcı
// işlemlerde kullanıcının `phrase` kelimesini birebir yazması gerekir.
// Karar 4: review yüzeyinde phrase = "SİL" (Türkçe).
//
// Sözleşme:
//   - Phrase eşleşmediği sürece confirm butonu disabled.
//   - isLoading durumunda da disabled (mutation pending).
//   - Eşleşme TAM string compare — case-sensitive, trim YOK
//     ("sıl" / "SIL" / " SİL " kabul edilmez).
//
// `message` prop semantiği (Dalga B polish):
//   - OPSİYONEL ek bağlam/uyarı satırı (örn. "Bu işlem geri alınamaz").
//   - Typing yönergesi component'in kendi cümlesidir ("Onaylamak için
//     aşağıya `phrase` yazın:") — caller bunu tekrar göndermesin
//     (önceden BulkDeleteDialog aynı cümleyi message ile geçiyordu →
//     iki ardışık cümle render oluyordu, UX bug).
//   - Caller dialog body'sinde uyarısını zaten gösteriyorsa message
//     hiç verilmez (default: undefined → satır gizli).
//
// A11y:
//   - Input aria-label phrase'i içerir
//   - Confirm butonu aria-disabled mantığını native disabled ile sağlar
//   - phrase görsel olarak `<code>` ile vurgulanır

import { useState } from "react";

type Props = {
  phrase: string;
  /**
   * Opsiyonel ek bağlam/uyarı satırı. Typing yönergesi component
   * tarafından render edilir; bu prop AYRI bir uyarı içindir
   * ("Bu işlem geri alınamaz" gibi). Caller uyarısını dialog body'sinde
   * gösteriyorsa boş bırakılır.
   */
  message?: string;
  buttonLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
};

export function TypingConfirmation({
  phrase,
  message,
  buttonLabel,
  isLoading = false,
  onConfirm,
}: Props) {
  const [value, setValue] = useState("");
  const matches = value === phrase;

  return (
    <div className="flex flex-col gap-3" data-testid="typing-confirmation">
      {message ? <p className="text-sm text-text">{message}</p> : null}
      <p className="text-sm text-text-muted">
        Onaylamak için aşağıya{" "}
        <code
          className="rounded-sm bg-surface-muted px-1 font-mono text-text"
          data-testid="typing-confirmation-phrase"
        >
          {phrase}
        </code>{" "}
        yazın:
      </p>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={`Onay phrase: ${phrase}`}
        data-testid="typing-confirmation-input"
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      <button
        type="button"
        disabled={!matches || isLoading}
        onClick={onConfirm}
        data-testid="typing-confirmation-confirm"
        className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {isLoading ? "Çalışıyor…" : (buttonLabel ?? phrase)}
      </button>
    </div>
  );
}
