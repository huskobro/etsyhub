/* eslint-disable no-restricted-syntax */
// PaneNotifications — R8: persistence canlı (UserSetting key="notifications").
// Toggle'lar artık backend'e yazılır; desktop push + email digest hâlâ
// capability eksik (R9'da backend ile gelir).
//
// v6 sabit boyutlar (max-w-[680px] + text-[26px] k-display + yarı-piksel)
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface NotificationsPrefs {
  batchCompleted: boolean;
  batchFailed: boolean;
  reviewDecision: boolean;
  listingSubmitted: boolean;
  magicEraser: boolean;
  desktopPush: boolean;
  dailyEmailDigest: boolean;
}

type SignalKey = keyof NotificationsPrefs;

interface Signal {
  id: SignalKey;
  label: string;
  desc: string;
  live: boolean;
}

const SIGNALS: Signal[] = [
  {
    id: "batchCompleted",
    label: "Batch completed",
    desc: "Variation batch reaches 100% — toast appears in Active Tasks panel.",
    live: true,
  },
  {
    id: "batchFailed",
    label: "Batch failed",
    desc: "At least one job in a batch errors — appears as red toast.",
    live: true,
  },
  {
    id: "reviewDecision",
    label: "Review decision recorded",
    desc: "K/D/R shortcut decisions in Batch Review surface inline confirms.",
    live: true,
  },
  {
    id: "listingSubmitted",
    label: "Listing submitted to Etsy",
    desc: "Submit success/failure surfaces inline in Product detail panel.",
    live: true,
  },
  {
    id: "magicEraser",
    label: "Magic eraser job done",
    desc: "Selection edit-op completion → toast surfaces edited preview.",
    live: true,
  },
  {
    id: "desktopPush",
    label: "Desktop push notifications",
    desc: "Browser-level push (granted permission) for long-running batches.",
    live: false,
  },
  {
    id: "dailyEmailDigest",
    label: "Daily email digest",
    desc: "Summary of yesterday's submits + failures + cost.",
    live: false,
  },
];

const QUERY_KEY = ["settings", "notifications"] as const;

export function PaneNotifications() {
  const qc = useQueryClient();

  const query = useQuery<{ settings: NotificationsPrefs }>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/settings/notifications");
      if (!r.ok) throw new Error("Notifications yüklenemedi");
      return r.json();
    },
  });

  const mutation = useMutation<
    { settings: NotificationsPrefs },
    Error,
    Partial<NotificationsPrefs>
  >({
    mutationFn: async (patch) => {
      const r = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${r.status}`);
      }
      return r.json();
    },
    onSuccess: (data) => {
      qc.setQueryData(QUERY_KEY, data);
    },
  });

  const remote = query.data?.settings;
  const [local, setLocal] = useState<NotificationsPrefs | null>(null);

  useEffect(() => {
    if (remote) setLocal(remote);
  }, [remote]);

  const prefs = local ?? remote ?? null;

  function toggle(id: SignalKey) {
    if (!prefs) return;
    const next = !prefs[id];
    setLocal({ ...prefs, [id]: next });
    mutation.mutate({ [id]: next } as Partial<NotificationsPrefs>);
  }

  return (
    <div className="max-w-[680px] px-10 py-9">
      <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
        Notifications
      </h2>
      <p className="mt-1 mb-7 text-[13px] text-ink-2">
        Active signals delivered to the cockpit (Active Tasks panel, toasts).
        Toggles persist via{" "}
        <span className="font-mono text-xs">UserSetting key=notifications</span>;
        desktop push and email digest still need a delivery backend (R9).
      </p>

      <div className="overflow-hidden rounded-md border border-line bg-paper">
        <div className="border-b border-line-soft px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
          In-app signals
        </div>
        <div className="divide-y divide-line-soft">
          {SIGNALS.map((s) => {
            const enabled = prefs?.[s.id] ?? false;
            return (
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
                        R9
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-[11.5px] leading-snug text-ink-3">
                    {s.desc}
                  </div>
                </div>
                <button
                  type="button"
                  aria-pressed={enabled}
                  onClick={() => toggle(s.id)}
                  disabled={!s.live || query.isLoading}
                  className={cn(
                    "relative h-5 w-9 flex-shrink-0 rounded-full transition-colors",
                    enabled && s.live ? "bg-k-orange" : "bg-line-strong",
                    !s.live && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <span
                    aria-hidden
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                    style={{ left: enabled && s.live ? 18 : 2 }}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
        {mutation.isPending ? (
          <>
            <Loader2
              className="mr-1 inline h-3 w-3 animate-spin"
              aria-hidden
            />
            Saving…
          </>
        ) : mutation.isError ? (
          `Save failed: ${mutation.error?.message}`
        ) : query.isLoading ? (
          "Loading…"
        ) : (
          "Toggles persist instantly · delivery rules ship in R9"
        )}
      </p>
    </div>
  );
}
