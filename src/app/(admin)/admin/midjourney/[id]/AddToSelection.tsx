"use client";

// Pass 57 — MJ → Selection direct entry.
//
// Mevcut Selection API'lerini reuse eder (yeni schema gerekmez):
//   GET  /api/selection/sets?status=draft        → mevcut draft set'ler
//   POST /api/selection/sets                     → yeni set { name }
//   POST /api/selection/sets/[setId]/items       → batch ekle
//                                                  body { items: [{ generatedDesignId }] }
//
// UX:
//   • Sadece auto-promote olmuş (her asset.generatedDesignId dolu) job'larda
//     görünür. Yarısı promoted olan jobs için detail page önce promote'u
//     bitirsin (PromoteToReview panel idempotent).
//   • Mevcut draft set picker veya "yeni set" inline.
//   • Tek tıkla 4 GeneratedDesign batch eklenir; duplicate silent skip
//     (selection items endpoint sözleşmesi).
//   • Submit success'te /selection/{setId} link'i göster.

import { useEffect, useState, useTransition } from "react";

type SetOption = { id: string; name: string };

type AddToSelectionProps = {
  /** Bu MJ job'un GeneratedDesign id'leri (auto-promote sonrası dolu). */
  generatedDesignIds: string[];
};

export function AddToSelection({ generatedDesignIds }: AddToSelectionProps) {
  const [sets, setSets] = useState<SetOption[] | null>(null);
  const [setId, setSetId] = useState<string>("");
  const [newName, setNewName] = useState<string>("");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    setId: string;
    addedCount: number;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  // Mevcut draft set'leri lazy fetch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/selection/sets?status=draft");
        const json: unknown = await res.json().catch(() => null);
        if (cancelled) return;
        const items = extractList(json);
        const mapped: SetOption[] = items
          .map((s) => ({
            id: String(s["id"] ?? ""),
            name: String(s["name"] ?? "(isimsiz)"),
          }))
          .filter((s) => s.id);
        setSets(mapped);
        if (mapped.length > 0) {
          setSetId(mapped[0]!.id);
        } else {
          setMode("new");
        }
      } catch (err) {
        if (!cancelled) {
          setSets([]);
          setMode("new");
          setError(
            `Set listesi yüklenemedi: ${err instanceof Error ? err.message : "?"}`,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (generatedDesignIds.length === 0) {
      setError("Önce asset'leri Review'a promote et");
      return;
    }
    if (mode === "existing" && !setId) {
      setError("Set seç");
      return;
    }
    if (mode === "new" && newName.trim().length === 0) {
      setError("Yeni set adı gir");
      return;
    }
    startTransition(async () => {
      try {
        // 1. Mode = new ise set yarat.
        let targetSetId = setId;
        let createdSetName: string | null = null;
        if (mode === "new") {
          const cRes = await fetch("/api/selection/sets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newName.trim() }),
          });
          const cJson: unknown = await cRes.json().catch(() => null);
          if (!cRes.ok) {
            setError(extractError(cJson) ?? `HTTP ${cRes.status}`);
            return;
          }
          const set = (cJson as { set?: { id?: string; name?: string } }).set;
          if (!set?.id) {
            setError("Set oluşturuldu ama id dönmedi");
            return;
          }
          targetSetId = set.id;
          createdSetName = set.name ?? newName.trim();
        }

        // 2. Items batch ekle.
        const iRes = await fetch(
          `/api/selection/sets/${targetSetId}/items`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: generatedDesignIds.map((id) => ({ generatedDesignId: id })),
            }),
          },
        );
        const iJson: unknown = await iRes.json().catch(() => null);
        if (!iRes.ok) {
          setError(extractError(iJson) ?? `HTTP ${iRes.status}`);
          return;
        }
        const added = (iJson as { items?: unknown[] }).items ?? [];
        setSuccess({ setId: targetSetId, addedCount: added.length });
        // Created set picker listesine eklensin (sonraki tıklamalar için).
        if (createdSetName && mode === "new") {
          setSets((prev) =>
            prev
              ? [{ id: targetSetId, name: createdSetName! }, ...prev]
              : [{ id: targetSetId, name: createdSetName! }],
          );
          setSetId(targetSetId);
          setMode("existing");
          setNewName("");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bilinmeyen hata");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3"
      data-testid="mj-add-to-selection"
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Selection set&apos;e ekle</div>
        <span className="text-xs text-text-muted">
          {generatedDesignIds.length} GeneratedDesign hazır
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={mode === "existing"}
            onChange={() => setMode("existing")}
            disabled={pending || !sets || sets.length === 0}
          />
          Mevcut set
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={mode === "new"}
            onChange={() => setMode("new")}
            disabled={pending}
          />
          Yeni set
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {mode === "existing" ? (
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-text-muted">Draft set</span>
            <select
              value={setId}
              onChange={(e) => setSetId(e.target.value)}
              disabled={pending || !sets}
              className="rounded-md border border-border bg-bg px-2 py-1 text-xs disabled:opacity-50"
              data-testid="mj-selection-set-picker"
            >
              {!sets ? (
                <option value="">Yükleniyor…</option>
              ) : sets.length === 0 ? (
                <option value="">Draft set yok — yeni oluştur</option>
              ) : (
                sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              )}
            </select>
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-text-muted">Yeni set adı</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={pending}
              maxLength={120}
              className="rounded-md border border-border bg-bg px-2 py-1 text-xs disabled:opacity-50"
              placeholder="ör: pass57-mj-batch"
              data-testid="mj-selection-new-name"
            />
          </label>
        )}

        <button
          type="submit"
          disabled={
            pending ||
            generatedDesignIds.length === 0 ||
            (mode === "existing" && !setId) ||
            (mode === "new" && newName.trim().length === 0)
          }
          className="rounded-md border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent transition hover:opacity-90 disabled:opacity-40"
          data-testid="mj-selection-submit"
        >
          {pending ? "Ekleniyor…" : "→ Selection set'e ekle"}
        </button>
      </div>

      {error ? (
        <p className="text-xs text-danger" data-testid="mj-selection-error">
          ⚠ {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="text-xs text-success"
          data-testid="mj-selection-success"
        >
          ✓ {success.addedCount} item eklendi ·{" "}
          <a
            href={`/selection/${success.setId}`}
            className="underline hover:no-underline"
          >
            Set&apos;i aç ↗
          </a>
        </p>
      ) : null}
    </form>
  );
}

function extractList(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === "object") {
    if ("items" in json) {
      const items = (json as { items: unknown }).items;
      if (Array.isArray(items)) return items as Record<string, unknown>[];
    }
    if ("sets" in json) {
      const sets = (json as { sets: unknown }).sets;
      if (Array.isArray(sets)) return sets as Record<string, unknown>[];
    }
  }
  return [];
}

function extractError(json: unknown): string | null {
  if (
    json &&
    typeof json === "object" &&
    "error" in json &&
    typeof (json as { error: unknown }).error === "string"
  ) {
    return (json as { error: string }).error;
  }
  return null;
}
