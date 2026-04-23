"use client";

import { useState } from "react";

type CollectionKindOption = "BOOKMARK" | "REFERENCE" | "MIXED";

export function CollectionCreateDialog({
  onClose,
  onSubmit,
  busy,
  error,
}: {
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    description?: string;
    kind: CollectionKindOption;
  }) => void;
  busy: boolean;
  error: string | null;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<CollectionKindOption>("MIXED");

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-text/40 p-4">
      <div className="w-full max-w-md rounded-md border border-border bg-surface p-6 shadow-popover">
        <h2 className="text-lg font-semibold text-text">Yeni Koleksiyon</h2>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || busy) return;
            onSubmit({
              name: name.trim(),
              description: description.trim() || undefined,
              kind,
            });
          }}
        >
          <label className="flex flex-col gap-1 text-sm text-text">
            İsim
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              className="h-9 rounded-md border border-border bg-bg px-3 text-sm text-text"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text">
            Açıklama (opsiyonel)
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              className="rounded-md border border-border bg-bg px-3 py-2 text-sm text-text"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text">
            Tip
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as CollectionKindOption)}
              className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-text"
            >
              <option value="MIXED">Karma</option>
              <option value="BOOKMARK">Bookmark</option>
              <option value="REFERENCE">Reference</option>
            </select>
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-text hover:bg-surface-muted"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground disabled:opacity-50"
            >
              {busy ? "Kaydediliyor…" : "Oluştur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
