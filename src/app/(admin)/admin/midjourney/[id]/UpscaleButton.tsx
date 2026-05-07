"use client";

// Pass 60 — Per-grid Upscale (Subtle) buton.
//
// Detail page'de her thumb altında görünür. Click → POST /upscale →
// yeni MJ Job (kind=UPSCALE) → router.push child job sayfasına.
// MVP: sadece "subtle" mode (Creative ileride).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type UpscaleButtonProps = {
  midjourneyAssetId: string;
  /** Disabled state için bilgi (parent job COMPLETED değilse). */
  disabled?: boolean;
};

export function UpscaleButton({
  midjourneyAssetId,
  disabled,
}: UpscaleButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/midjourney/upscale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ midjourneyAssetId, mode: "subtle" }),
        });
        const json: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          if (
            json &&
            typeof json === "object" &&
            "error" in json &&
            typeof (json as { error: unknown }).error === "string"
          ) {
            msg = (json as { error: string }).error;
          }
          setError(msg);
          return;
        }
        const data = json as { midjourneyJobId?: string };
        if (data.midjourneyJobId) {
          router.push(`/admin/midjourney/${data.midjourneyJobId}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bilinmeyen hata");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        className="rounded-md border border-accent bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent transition hover:opacity-90 disabled:opacity-40"
        data-testid={`mj-upscale-${midjourneyAssetId}`}
        title="Upscale (Subtle) — V7 alpha 'More → Subtle' yolu"
      >
        {pending ? "Tetikleniyor…" : "⤴ Upscale"}
      </button>
      {error ? (
        <p
          className="text-xs text-danger"
          data-testid={`mj-upscale-error-${midjourneyAssetId}`}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
