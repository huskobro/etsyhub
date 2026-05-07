"use client";

// Pass 54 — Klipboard kopyalama primitive'i.
//
// Operatör Slack/dashboard/log paylaşırken bridgeJobId / mjJobId /
// failedReason gibi değerleri eliyle seçip kopyalamaya çalışıyordu.
// Bu küçük buton tek tıkla kopyalar ve 1.5sn "Kopyalandı" geri
// bildirimi verir.

import { useState } from "react";

type CopyButtonProps = {
  value: string;
  /** Buton üzerine yazılacak label (default "Kopyala"). */
  label?: string;
  /** "Kopyalandı" feedback süresi ms (default 1500). */
  resetMs?: number;
  className?: string;
};

export function CopyButton({
  value,
  label = "Kopyala",
  resetMs = 1500,
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function handleClick() {
    setError(false);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), resetMs);
    } catch {
      setError(true);
      setTimeout(() => setError(false), resetMs);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={
        "rounded-md border border-border bg-bg px-2 py-0.5 font-mono text-xs text-text-muted transition hover:border-border-strong hover:text-text " +
        (className ?? "")
      }
      data-testid="mj-copy-button"
      title={`Kopyala: ${value.slice(0, 60)}`}
    >
      {error ? "✗ hata" : copied ? "✓ kopyalandı" : `📋 ${label}`}
    </button>
  );
}
