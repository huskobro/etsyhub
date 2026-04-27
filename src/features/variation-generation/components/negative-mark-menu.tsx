"use client";

import { useState } from "react";
import type { LocalLibraryAsset } from "@prisma/client";

// R11 — 5 önerili sebep + serbest metin (≤200 char). Sebep zorunlu değil
// (server tarafında null kabul); ama UI 5 hazır seçenekle hızlandırır.
const REASONS = [
  "arka plan beyaz değil",
  "yazı/imza var",
  "logo var",
  "çözünürlük düşük",
  "DPI düşük",
];

const MAX_REASON_LEN = 200;

export function NegativeMarkMenu({
  asset,
  onMark,
}: {
  asset: LocalLibraryAsset;
  onMark: (reason: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  if (asset.isNegative) {
    return (
      <button
        type="button"
        onClick={() => onMark(undefined)}
        className="text-xs text-text-muted underline hover:text-text"
      >
        Negatifi kaldır
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-text underline hover:text-accent"
      >
        Negatif İşaretle
      </button>
      {open ? (
        <div className="absolute z-10 mt-1 flex w-64 flex-col gap-1 rounded-md border border-border bg-surface p-2 shadow-popover">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setOpen(false);
                onMark(r);
              }}
              className="rounded-sm px-2 py-1 text-left text-xs text-text hover:bg-surface-2"
            >
              {r}
            </button>
          ))}
          <div className="mt-1 border-t border-border-subtle pt-2">
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Serbest sebep (opsiyonel)
              <textarea
                value={custom}
                onChange={(e) => setCustom(e.target.value.slice(0, MAX_REASON_LEN))}
                maxLength={MAX_REASON_LEN}
                rows={2}
                className="rounded-sm border border-border bg-bg p-1 text-xs text-text"
              />
              <span className="text-text-subtle">
                {custom.length}/{MAX_REASON_LEN}
              </span>
            </label>
            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setCustom("");
                }}
                className="rounded-sm px-2 py-1 text-xs text-text-muted hover:text-text"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  const trimmed = custom.trim();
                  setCustom("");
                  onMark(trimmed.length > 0 ? trimmed : undefined);
                }}
                className="rounded-sm bg-accent px-2 py-1 text-xs text-accent-foreground hover:bg-accent-hover"
              >
                İşaretle
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
