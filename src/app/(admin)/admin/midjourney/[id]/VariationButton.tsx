"use client";

// Pass 83 — Per-grid Variation (Subtle/Strong) buton.
//
// Detail page'de her grid thumb altında UpscaleButton'ın yanında görünür.
// İki ayrı buton: "Vary Subtle" + "Vary Strong" (Pass 83 capture: subtle
// strong:false; strong strong:true).
//
// Click → POST /api/admin/midjourney/variation → yeni MJ Job
// (kind=VARIATION) → router.push child job sayfasına.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type VariationButtonProps = {
  midjourneyAssetId: string;
  /** Pass 83 capture: subtle = strong:false, strong = strong:true */
  mode: "subtle" | "strong";
  /** Disabled state için bilgi (parent job COMPLETED değilse). */
  disabled?: boolean;
};

export function VariationButton({
  midjourneyAssetId,
  mode,
  disabled,
}: VariationButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/midjourney/variation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ midjourneyAssetId, mode }),
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

  const label = mode === "subtle" ? "Vary Subtle" : "Vary Strong";
  const title =
    mode === "subtle"
      ? "Variation Subtle — küçük çeşitleme (4 yeni grid)"
      : "Variation Strong — güçlü çeşitleme (4 yeni grid)";

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-medium text-text transition hover:border-border-strong hover:bg-surface-2 disabled:opacity-40"
        data-testid={`mj-variation-${mode}-${midjourneyAssetId}`}
        title={title}
      >
        {pending ? "Tetikleniyor…" : `↻ ${label}`}
      </button>
      {error ? (
        <p
          className="text-xs text-danger"
          data-testid={`mj-variation-error-${mode}-${midjourneyAssetId}`}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
