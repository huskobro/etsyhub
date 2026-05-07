"use client";

// Pass 53/54 — Detail sayfası state-aware action bar + retry edit.
//
// State'e göre doğru butonları gösterir:
//   • AWAITING_LOGIN / AWAITING_CHALLENGE → "MJ pencerene git" (focus)
//                                          + Cancel
//   • QUEUED + diğer in-progress         → Cancel
//   • FAILED / CANCELLED / COMPLETED     → Retry (aynı) + Düzenleyip
//                                          retry (Pass 54 modal)
//
// Auto-refresh: terminal değilse 4sn'de bir router.refresh().

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
const BLOCKED = new Set(["AWAITING_LOGIN", "AWAITING_CHALLENGE"]);

const ASPECT_RATIOS = ["1:1", "2:3", "3:2", "4:3", "3:4", "16:9", "9:16"] as const;
type AspectRatio = (typeof ASPECT_RATIOS)[number];

type JobActionBarProps = {
  midjourneyJobId: string;
  state: string;
  /** Pass 54 — edit modal default'ları için mevcut job'un prompt + aspectRatio'su. */
  basePrompt: string;
  baseAspectRatio?: string;
};

export function JobActionBar({
  midjourneyJobId,
  state,
  basePrompt,
  baseAspectRatio,
}: JobActionBarProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Pass 54 — edit modal state.
  const [editOpen, setEditOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState(basePrompt);
  const [editRatio, setEditRatio] = useState<AspectRatio>(
    (ASPECT_RATIOS as readonly string[]).includes(baseAspectRatio ?? "")
      ? (baseAspectRatio as AspectRatio)
      : "1:1",
  );

  const isTerminal = TERMINAL.has(state);
  const isBlocked = BLOCKED.has(state);

  // Auto-refresh in-progress state'lerinde — terminal'de durur.
  useEffect(() => {
    if (isTerminal) return;
    const id = window.setInterval(() => {
      router.refresh();
    }, 4000);
    return () => window.clearInterval(id);
  }, [isTerminal, router]);

  function call(
    path: string,
    okMsg: (data: unknown) => string,
    body?: unknown,
  ): void {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await fetch(path, {
          method: "POST",
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
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
        setSuccess(okMsg(json));
        // Sayfa yenile — yeni state veya yeni job ID görünür.
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bilinmeyen hata");
      }
    });
  }

  function handleCancel() {
    if (
      !window.confirm(
        "Bu job iptal edilecek. Bridge job'u abort edilecek ve DB CANCELLED olarak işaretlenecek. Devam edilsin mi?",
      )
    )
      return;
    call(
      `/api/admin/midjourney/${midjourneyJobId}/cancel`,
      () => "Job iptal edildi",
    );
  }

  function handleRetry() {
    call(`/api/admin/midjourney/${midjourneyJobId}/retry`, (data) => {
      const d = data as { newMidjourneyJobId?: string };
      const newId = d.newMidjourneyJobId?.slice(0, 8) ?? "?";
      // Yeni job sayfasına yönlendir.
      if (d.newMidjourneyJobId) {
        router.push(`/admin/midjourney/${d.newMidjourneyJobId}`);
      }
      return `Yeni job tetiklendi (${newId}…)`;
    });
  }

  // Pass 54 — düzenlenmiş prompt/aspectRatio ile retry.
  function handleEditedRetry(e: React.FormEvent) {
    e.preventDefault();
    if (!editPrompt.trim() || editPrompt.trim().length < 3) {
      setError("Prompt en az 3 karakter olmalı");
      return;
    }
    setEditOpen(false);
    call(
      `/api/admin/midjourney/${midjourneyJobId}/retry`,
      (data) => {
        const d = data as { newMidjourneyJobId?: string };
        const newId = d.newMidjourneyJobId?.slice(0, 8) ?? "?";
        if (d.newMidjourneyJobId) {
          router.push(`/admin/midjourney/${d.newMidjourneyJobId}`);
        }
        return `Düzenlenmiş retry tetiklendi (${newId}…)`;
      },
      { prompt: editPrompt.trim(), aspectRatio: editRatio },
    );
  }

  function handleFocus() {
    call(
      `/api/admin/midjourney/focus-browser`,
      () => "MJ tarayıcı penceresi öne getirildi",
    );
  }

  return (
    <section
      className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3"
      data-testid="mj-job-action-bar"
    >
      <div className="flex flex-wrap items-center gap-2">
        {isBlocked ? (
          <button
            type="button"
            onClick={handleFocus}
            disabled={pending}
            className="rounded-md border border-warning bg-warning-soft px-3 py-1.5 text-xs font-semibold text-warning-text transition hover:opacity-90 disabled:opacity-40"
            data-testid="mj-action-focus"
          >
            🪟 MJ penceresini öne getir
          </button>
        ) : null}
        {!isTerminal ? (
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="rounded-md border border-border bg-bg px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:border-danger hover:text-danger disabled:opacity-40"
            data-testid="mj-action-cancel"
          >
            ✕ İptal et
          </button>
        ) : null}
        {isTerminal ? (
          <>
            <button
              type="button"
              onClick={handleRetry}
              disabled={pending}
              className="rounded-md border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent transition hover:opacity-90 disabled:opacity-40"
              data-testid="mj-action-retry"
            >
              ↻ Aynı promptla tekrar dene
            </button>
            <button
              type="button"
              onClick={() => {
                setEditPrompt(basePrompt);
                setError(null);
                setSuccess(null);
                setEditOpen(true);
              }}
              disabled={pending}
              className="rounded-md border border-border bg-bg px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text disabled:opacity-40"
              data-testid="mj-action-retry-edit"
            >
              ✎ Düzenleyip retry
            </button>
          </>
        ) : null}
        {!isTerminal ? (
          <span className="text-xs text-text-muted">
            ⓘ Bu sayfa her 4sn yenilenir.
          </span>
        ) : null}
      </div>

      {/* Pass 54 — edit modal (inline, ek kütüphane yok). */}
      {editOpen ? (
        <form
          onSubmit={handleEditedRetry}
          className="mt-1 flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3"
          data-testid="mj-action-retry-edit-form"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Düzenleyip retry</span>
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              disabled={pending}
              className="text-xs text-text-muted hover:text-text"
              aria-label="Modal kapat"
            >
              ✕
            </button>
          </div>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-text-muted">Prompt</span>
            <textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              disabled={pending}
              minLength={3}
              maxLength={800}
              required
              rows={3}
              className="rounded-md border border-border bg-bg px-3 py-1.5 font-mono text-xs disabled:opacity-50"
            />
          </label>
          <div className="flex items-end gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-text-muted">Aspect ratio</span>
              <select
                value={editRatio}
                onChange={(e) => setEditRatio(e.target.value as AspectRatio)}
                disabled={pending}
                className="rounded-md border border-border bg-bg px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {ASPECT_RATIOS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md border border-accent bg-accent px-4 py-1.5 text-xs font-semibold text-on-accent transition hover:opacity-90 disabled:opacity-40"
              data-testid="mj-action-retry-edit-submit"
            >
              {pending ? "Tetikleniyor…" : "Yeni job tetikle"}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p className="text-xs text-danger" data-testid="mj-action-error">
          ⚠ {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="text-xs text-success"
          data-testid="mj-action-success"
        >
          ✓ {success}
        </p>
      ) : null}
    </section>
  );
}
