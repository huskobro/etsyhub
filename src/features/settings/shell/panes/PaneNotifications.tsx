/* eslint-disable no-restricted-syntax */
// PaneNotifications — Local notification preferences. Bu rollout'ta
// backend persistence YOK; Active Tasks ve toast'lar zaten SSE ile
// çalışıyor. Pane'in görevi mevcut sinyalleri operatör için açık
// kılmak ve "ileride buradan disable/enable yapacaksın" sinyali vermek.
//
// v6 sabit boyutlar (max-w-[680px] + text-[26px] k-display + yarı-piksel
// captions) Settings canon ile aynı.
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/cn";

const SIGNALS = [
  {
    id: "batch-completed",
    label: "Batch completed",
    desc: "Variation batch reaches 100% — toast appears in Active Tasks panel.",
    live: true,
  },
  {
    id: "batch-failed",
    label: "Batch failed",
    desc: "At least one job in a batch errors — appears as red toast.",
    live: true,
  },
  {
    id: "review-decision",
    label: "Review decision recorded",
    desc: "K/D/R shortcut decisions in Batch Review surface inline confirms.",
    live: true,
  },
  {
    id: "listing-submitted",
    label: "Listing submitted to Etsy",
    desc: "Submit success/failure surfaces inline in Product detail panel.",
    live: true,
  },
  {
    id: "magic-eraser",
    label: "Magic eraser job done",
    desc: "Selection edit-op completion → toast surfaces edited preview.",
    live: true,
  },
  {
    id: "desktop-push",
    label: "Desktop push notifications",
    desc: "Browser-level push (granted permission) for long-running batches.",
    live: false,
  },
  {
    id: "email-digest",
    label: "Daily email digest",
    desc: "Summary of yesterday's submits + failures + cost.",
    live: false,
  },
];

export function PaneNotifications() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {};
    for (const s of SIGNALS) out[s.id] = s.live;
    return out;
  });

  return (
    <div className="max-w-[680px] px-10 py-9">
      <div className="flex items-start gap-3">
        <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
          Notifications
        </h2>
      </div>
      <p className="mt-1 mb-7 text-[13px] text-ink-2">
        Active signals delivered to the cockpit (Active Tasks panel, toasts).
        Toggles are local for this session — desktop push and email digest
        ship in R8.
      </p>

      <div className="overflow-hidden rounded-md border border-line bg-paper">
        <div className="border-b border-line-soft px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
          In-app signals
        </div>
        <div className="divide-y divide-line-soft">
          {SIGNALS.map((s) => (
            <div
              key={s.id}
              className="flex items-start gap-3 px-4 py-3"
              data-testid="notifications-signal"
              data-signal-id={s.id}
            >
              <Bell
                className={cn(
                  "mt-0.5 h-3.5 w-3.5",
                  s.live ? "text-k-orange" : "text-ink-4",
                )}
                aria-hidden
              />
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <div className="text-[13px] font-medium text-ink">
                    {s.label}
                  </div>
                  {!s.live ? (
                    <span className="font-mono text-[9.5px] uppercase tracking-meta text-ink-4">
                      R8
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-ink-3">
                  {s.desc}
                </div>
              </div>
              <button
                type="button"
                aria-pressed={enabled[s.id]}
                onClick={() =>
                  setEnabled((p) => ({ ...p, [s.id]: !p[s.id] }))
                }
                disabled={!s.live}
                className={cn(
                  "relative h-5 w-9 flex-shrink-0 rounded-full transition-colors",
                  enabled[s.id] && s.live
                    ? "bg-k-orange"
                    : "bg-line-strong",
                  !s.live && "opacity-50 cursor-not-allowed",
                )}
              >
                <span
                  aria-hidden
                  className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                  style={{ left: enabled[s.id] && s.live ? 18 : 2 }}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
        Toggles local · persistence + delivery rules ship in R8 with the
        notifications backend
      </p>
    </div>
  );
}
