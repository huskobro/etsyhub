"use client";

import type { GeneratedDesign } from "@prisma/client";
import { useRetryVariation } from "../mutations/use-retry-variation";
import { cn } from "@/lib/cn";

type StateBadge = {
  label: string;
  className: string;
};

const STATE_BADGES: Record<string, StateBadge> = {
  QUEUED: { label: "Kuyrukta", className: "bg-surface-2 text-text-muted" },
  PROVIDER_PENDING: {
    label: "Provider bekliyor",
    className: "bg-info-soft text-info",
  },
  PROVIDER_RUNNING: {
    label: "Generating",
    className: "bg-info-soft text-info",
  },
  SUCCESS: { label: "Tamam", className: "bg-success-soft text-success" },
  FAIL: { label: "Başarısız", className: "bg-danger-soft text-danger" },
};

function badge(state: string | null): StateBadge {
  if (!state) return { label: "—", className: "bg-surface-2 text-text-muted" };
  return STATE_BADGES[state] ?? { label: state, className: "bg-surface-2 text-text-muted" };
}

export function VariationResultGrid({
  referenceId,
  designs,
}: {
  referenceId: string;
  designs: GeneratedDesign[];
}) {
  const retry = useRetryVariation(referenceId);
  if (designs.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-text">Generation results</h3>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {designs.map((d) => {
          const b = badge(d.state);
          const isSuccess = d.state === "SUCCESS";
          const isFail = d.state === "FAIL";
          return (
            <article
              key={d.id}
              className="overflow-hidden rounded-md border border-border bg-surface"
            >
              <div className="relative aspect-square bg-surface-2">
                {isSuccess && d.resultUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={d.resultUrl}
                    alt="Generated image"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">
                    {isFail ? "Generation failed" : "Pending…"}
                  </div>
                )}
                <span
                  className={cn(
                    "absolute right-2 top-2 rounded-md px-2 py-0.5 text-xs font-medium",
                    b.className,
                  )}
                >
                  {b.label}
                </span>
              </div>
              <div className="flex flex-col gap-1 p-2 text-xs">
                <div className="text-text-muted">
                  {d.capabilityUsed ?? "—"}
                </div>
                {isFail ? (
                  <>
                    <div
                      className="line-clamp-2 text-danger"
                      title={d.errorMessage ?? ""}
                    >
                      {d.errorMessage ?? "Bilinmeyen hata"}
                    </div>
                    <button
                      type="button"
                      onClick={() => retry.mutate(d.id)}
                      disabled={retry.isPending}
                      className="mt-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text transition-colors hover:border-accent disabled:opacity-50"
                    >
                      {retry.isPending ? "Kuyruğa alınıyor…" : "Yeniden Dene"}
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
