/* eslint-disable no-restricted-syntax */
// PaneNotifications — R11.5 stabilization:
//   · UserSetting key="notifications" persistence (R8'den beri canlı).
//   · In-app inbox feed: 15s polling fallback, SSE channel R12 scope.
//   · Desktop push + daily email digest: capability eksik (R12 delivery
//     backend); toggle'lar UI'da disabled görünür ve "R12" rozetiyle
//     işaretlenir.
//
// v6 sabit boyutlar (max-w-[680px] + text-[26px] k-display + yarı-piksel)
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Inbox, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
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
        In-app inbox + signal preferences. Recipe runs, batch results,
        and mockup activations land in the inbox below. Feed refreshes
        every 15s until the SSE channel ships in R12.
      </p>

      <NotificationsInbox />

      <div className="mt-7 overflow-hidden rounded-md border border-line bg-paper">
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
                        R12
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
                  aria-label={`${enabled ? "Disable" : "Enable"} ${s.label} notifications`}
                  title={
                    !s.live
                      ? `${s.label} channel is not yet live — toggle is locked.`
                      : enabled
                        ? `Click to disable ${s.label} notifications.`
                        : `Click to enable ${s.label} notifications.`
                  }
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
        ) : query.isLoading && !query.data ? (
          "Loading preferences…"
        ) : (
          "Toggles persist instantly · in-app inbox active · desktop push + email digest land in R12"
        )}
      </p>
    </div>
  );
}

interface InboxItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
}

function NotificationsInbox() {
  const qc = useQueryClient();
  // R11 — Real-time polling (light SSE-lite). 15s refetch interval +
  // 10s stale time + window focus refetch — feed canlı hisseder. Backend
  // SSE channel R12'de gelecek (`notifications:user:{id}`).
  // R11.5 — retry: 1 to fail-fast on auth/network errors (avoid infinite
  // spinner if endpoint hangs); error path renders inline retry CTA.
  const inbox = useQuery<{ items: InboxItem[] }>({
    queryKey: ["notifications", "inbox"],
    queryFn: async () => {
      const r = await fetch("/api/notifications/inbox");
      if (!r.ok) throw new Error("Inbox yüklenemedi");
      return r.json();
    },
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const readAll = useMutation<unknown, Error, void>({
    mutationFn: async () => {
      const r = await fetch("/api/notifications/inbox/read-all", {
        method: "POST",
      });
      if (!r.ok) throw new Error("Mark all failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", "inbox"] });
    },
  });

  const clear = useMutation<unknown, Error, void>({
    mutationFn: async () => {
      const r = await fetch("/api/notifications/inbox/clear", {
        method: "POST",
      });
      if (!r.ok) throw new Error("Clear failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", "inbox"] });
    },
  });

  const items = inbox.data?.items ?? [];
  const unreadCount = items.filter((it) => !it.read).length;

  return (
    <div className="overflow-hidden rounded-md border border-line bg-paper">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Inbox className="h-3.5 w-3.5 text-k-orange" aria-hidden />
          <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            Inbox
          </span>
          {unreadCount > 0 ? (
            <span className="font-mono text-[10.5px] tabular-nums text-k-orange">
              {unreadCount} unread
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => readAll.mutate()}
            disabled={readAll.isPending || unreadCount === 0}
            className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-ink-2 hover:text-ink disabled:opacity-50"
            data-testid="inbox-read-all"
          >
            <CheckCheck className="h-3 w-3" aria-hidden />
            Read all
          </button>
          <button
            type="button"
            onClick={() => clear.mutate()}
            disabled={clear.isPending || items.length === 0}
            className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-ink-2 hover:text-ink disabled:opacity-50"
            data-testid="inbox-clear"
          >
            <Trash2 className="h-3 w-3" aria-hidden />
            Clear
          </button>
        </div>
      </div>
      {inbox.isLoading && !inbox.data ? (
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-k-orange" aria-hidden />
        </div>
      ) : inbox.error && !inbox.data ? (
        <div
          className="flex items-center justify-between px-4 py-3 text-[12.5px] text-danger"
          data-testid="inbox-error"
        >
          <span>
            Inbox yüklenemedi: {(inbox.error as Error).message}
          </span>
          <button
            type="button"
            onClick={() => inbox.refetch()}
            className="inline-flex h-6 items-center rounded-md border border-line bg-paper px-2 text-[11px] font-medium text-ink-2 hover:text-ink"
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-[12.5px] text-ink-3">No notifications yet.</p>
          <p className="mt-1 font-mono text-[10.5px] uppercase tracking-meta text-ink-4">
            Recipe runs · Mockup activations · Magic eraser jobs land here
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line-soft">
          {items.slice(0, 8).map((it) => (
            <NotificationRow key={it.id} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationRow({ item }: { item: InboxItem }) {
  const qc = useQueryClient();
  const markRead = useMutation<unknown, Error, void>({
    mutationFn: async () => {
      const r = await fetch(`/api/notifications/inbox/${item.id}/read`, {
        method: "POST",
      });
      if (!r.ok) throw new Error("Mark read failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", "inbox"] });
    },
  });

  const Wrapper = item.href
    ? ({ children }: { children: React.ReactNode }) => (
        <Link
          href={item.href!}
          className="block px-4 py-3 transition-colors hover:bg-k-bg-2/40"
        >
          {children}
        </Link>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <div className="px-4 py-3">{children}</div>
      );

  return (
    <div
      className={cn(
        "relative",
        !item.read && "bg-k-orange-soft/15",
      )}
      data-testid="inbox-row"
      data-read={item.read ? "true" : undefined}
    >
      <Wrapper>
        <div className="flex items-start gap-3">
          {!item.read ? (
            <span
              aria-hidden
              className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-k-orange"
            />
          ) : (
            <span aria-hidden className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <div className="text-[13px] font-medium text-ink">
                {item.title}
              </div>
              <span className="font-mono text-[10.5px] tracking-meta text-ink-3">
                {new Date(item.createdAt).toLocaleString("tr-TR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {item.body ? (
              <div className="mt-0.5 text-[11.5px] leading-snug text-ink-3">
                {item.body}
              </div>
            ) : null}
          </div>
          {!item.read ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                markRead.mutate();
              }}
              className="mt-0.5 inline-flex h-6 items-center rounded-md px-2 text-[10.5px] font-medium text-ink-3 hover:text-ink"
            >
              Mark read
            </button>
          ) : null}
        </div>
      </Wrapper>
    </div>
  );
}
