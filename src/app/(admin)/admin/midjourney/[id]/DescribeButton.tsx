"use client";

// Pass 66 — Per-asset Describe tetikleyici (Pass 65 audit'in düzeltmesi).
//
// Operatör grid asset üstünde "🔍 Describe" tıklar → POST /describe ile
// yeni bir kind=DESCRIBE MJ job tetiklenir (3 dk içinde 4 prompt önerisi
// scrape edilir + DB'ye yazılır). Yeni job /admin/midjourney listesinde
// görünür; kullanıcı detail page'ine gidip prompt önerilerini görür.
//
// Bridge yoksa banner zaten parent sayfada gösteriliyor; burada UI
// minimum: button → API → toast.

import { useState } from "react";
import { useRouter } from "next/navigation";

type DescribeButtonProps = {
  /** Source MidjourneyAsset id (lineage için API'ye gönderilir). */
  sourceAssetId: string;
  /** MJ CDN URL'i (HTTPS). Bridge buradan indirip describe akışına sokar. */
  imageUrl: string | null;
  /** Bridge erişilebilir mi (parent kontrol). Yoksa buton disabled. */
  bridgeOk?: boolean;
};

export function DescribeButton({
  sourceAssetId,
  imageUrl,
  bridgeOk = true,
}: DescribeButtonProps) {
  const router = useRouter();
  // Pass 70 fix: useTransition `async () =>` callback'i sessiz drop ediyordu
  // (Pass 69 carry-over bug). Plain async + manuel pending state daha güvenli.
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const disabled = !bridgeOk || !imageUrl || pending;

  async function handleClick() {
    if (!imageUrl) return;
    setError(null);
    setSuccess(null);
    setPending(true);
    try {
      const res = await fetch("/api/admin/midjourney/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, sourceAssetId }),
      });
      const json = (await res.json().catch(() => null)) as
        | {
            ok: true;
            jobId: string;
            midjourneyJobId: string;
            bridgeJobId: string;
          }
        | { ok: false; error: string; code?: string }
        | null;
      if (!res.ok || !json || json.ok !== true) {
        setError(
          (json && json.ok === false && json.error) || `HTTP ${res.status}`,
        );
        return;
      }
      setSuccess(
        `Describe job tetiklendi · ${json.midjourneyJobId.slice(0, 8)}…`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-text-muted transition hover:border-accent hover:text-accent disabled:opacity-40"
        data-testid={`mj-describe-btn-${sourceAssetId}`}
        title={
          !imageUrl
            ? "MJ CDN URL yok"
            : !bridgeOk
              ? "Bridge erişilemiyor"
              : "Describe: bu asset'ten 4 prompt önerisi al"
        }
      >
        {pending ? "🔍 Tetikleniyor…" : "🔍 Describe"}
      </button>
      {error ? (
        <p
          className="text-xs text-danger"
          data-testid={`mj-describe-error-${sourceAssetId}`}
        >
          ⚠ {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="text-xs text-success"
          data-testid={`mj-describe-success-${sourceAssetId}`}
        >
          ✓ {success}
        </p>
      ) : null}
    </div>
  );
}
