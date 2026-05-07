"use client";

// Pass 66 — Describe sonuç paneli (kind=DESCRIBE job'lar için).
//
// Bridge driver describeImage helper'ı 4 prompt scrape eder ve bunları
// `mjMetadata.describePrompts[]` olarak job'a yazar (pollAndUpdate
// snapshot.mjMetadata'yı doğrudan günceller). Bu component server'dan
// gelen prompts array'ini render eder + her prompt için:
//   - Copy butonu (clipboard)
//   - "Test Render olarak çalıştır" linki (URL parametre ile prompt
//     pre-fill — operatör admin/midjourney sayfasına dönünce
//     TestRenderForm prompt alanı dolu gelir)

import { useState } from "react";

type DescribeResultsProps = {
  prompts: string[];
  sourceImageUrl?: string | null;
};

export function DescribeResults({
  prompts,
  sourceImageUrl,
}: DescribeResultsProps) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  if (prompts.length === 0) return null;

  function copy(idx: number, text: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 2000);
    });
  }

  return (
    <section
      className="rounded-md border border-border bg-surface p-4"
      data-testid="mj-describe-results"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">
          Describe önerileri ({prompts.length})
        </h2>
        <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs text-accent-text">
          MJ describe
        </span>
        {sourceImageUrl ? (
          <a
            href={sourceImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-text-muted underline hover:text-text"
          >
            Kaynak görsel ↗
          </a>
        ) : null}
      </div>
      <p className="mb-3 text-xs text-text-muted">
        MJ&apos;nin görselden çıkardığı 4 prompt önerisi. Kopyala veya
        Test Render formuna aktar.
      </p>
      <ol className="flex flex-col gap-2">
        {prompts.map((p, i) => (
          <li
            key={i}
            className="flex flex-col gap-1 rounded border border-border bg-bg p-2 text-xs"
            data-testid={`mj-describe-prompt-${i}`}
          >
            <div className="flex items-start gap-2">
              <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-text-muted">
                {i + 1}
              </span>
              <p className="flex-1 break-words font-mono">{p}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => copy(i, p)}
                className="rounded-md border border-border bg-bg px-2 py-0.5 text-text-muted transition hover:border-accent hover:text-accent"
                data-testid={`mj-describe-copy-${i}`}
              >
                {copiedIdx === i ? "✓ Kopyalandı" : "📋 Kopyala"}
              </button>
              <a
                href={`/admin/midjourney?reusePrompt=${encodeURIComponent(p)}`}
                className="rounded-md border border-accent bg-accent-soft px-2 py-0.5 text-accent-text transition hover:opacity-90"
                data-testid={`mj-describe-reuse-${i}`}
                title="Bu prompt'u Test Render formuna aktar"
              >
                ↗ Test Render&apos;da kullan
              </a>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
