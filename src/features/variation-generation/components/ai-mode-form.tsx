"use client";

import { useState } from "react";
import { useCreateVariations } from "../mutations/use-create-variations";
import { CostConfirmDialog } from "./cost-confirm-dialog";

// Q6 capability görünür: z-image (text-to-image) "Yakında" disabled — sessiz
// fallback YOK; provider yok ise UI açıkça reddeder.
const MODELS: Array<{ id: string; label: string; available: boolean }> = [
  {
    id: "kie-gpt-image-1.5",
    label: "kie-gpt-image-1.5 (image-to-image)",
    available: true,
  },
  {
    id: "kie-z-image",
    label: "kie-z-image (text-to-image) — Yakında",
    available: false,
  },
];

type AspectRatio = "1:1" | "2:3" | "3:2";
type Quality = "medium" | "high";

const ASPECT_OPTIONS: AspectRatio[] = ["1:1", "2:3", "3:2"];
const QUALITY_OPTIONS: Quality[] = ["medium", "high"];

// R17.4 — count default 3, range 1..6.
const COUNT_MIN = 1;
const COUNT_MAX = 6;
const COUNT_DEFAULT = 3;
const BRIEF_MAX = 500;

function parseAspectRatio(v: string): AspectRatio {
  if (v === "1:1" || v === "2:3" || v === "3:2") return v;
  return "2:3";
}

function parseQuality(v: string): Quality {
  return v === "high" ? "high" : "medium";
}

export function AiModeForm({
  referenceId,
  disabled,
}: {
  referenceId: string;
  disabled: boolean;
}) {
  const [providerId, setProviderId] = useState("kie-gpt-image-1.5");
  const [aspectRatio, setAspect] = useState<AspectRatio>("2:3");
  const [quality, setQuality] = useState<Quality>("medium");
  const [brief, setBrief] = useState("");
  const [count, setCount] = useState(COUNT_DEFAULT);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [partialNotice, setPartialNotice] = useState<string | null>(null);
  const create = useCreateVariations();

  async function onConfirm() {
    setPartialNotice(null);
    const out = await create.mutateAsync({
      referenceId,
      providerId,
      aspectRatio,
      quality,
      brief: brief.trim() || undefined,
      count,
    });
    setConfirmOpen(false);
    if (out.failedDesignIds && out.failedDesignIds.length > 0) {
      setPartialNotice(
        `${out.failedDesignIds.length}/${count} kuyruk başarısız oldu (${out.designIds.length} başarılı). Failed design'ları FAIL listesinden tekrar deneyebilirsin.`,
      );
    }
  }

  return (
    <fieldset
      disabled={disabled}
      className="rounded-md border border-border bg-surface p-4 disabled:opacity-50"
    >
      <legend className="px-2 text-sm font-medium text-text">
        AI mode formu
      </legend>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-text">
          Model
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="h-control-md rounded-md border border-border bg-bg px-3 text-sm text-text"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id} disabled={!m.available}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-text">
          Aspect ratio
          <select
            value={aspectRatio}
            onChange={(e) => setAspect(parseAspectRatio(e.target.value))}
            className="h-control-md rounded-md border border-border bg-bg px-3 text-sm text-text"
          >
            {ASPECT_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-text">
          Kalite
          <select
            value={quality}
            onChange={(e) => setQuality(parseQuality(e.target.value))}
            className="h-control-md rounded-md border border-border bg-bg px-3 text-sm text-text"
          >
            {QUALITY_OPTIONS.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-text">
          Görsel sayısı: <span className="font-medium">{count}</span>
          <input
            type="range"
            min={COUNT_MIN}
            max={COUNT_MAX}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="accent-accent"
          />
        </label>
      </div>
      <label className="mt-3 flex flex-col gap-1 text-sm text-text">
        Style note / ek yönlendirme (opsiyonel)
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value.slice(0, BRIEF_MAX))}
          maxLength={BRIEF_MAX}
          rows={3}
          className="rounded-md border border-border bg-bg p-2 text-sm text-text"
          placeholder="ör. pastel tones, no text, soft watercolor"
        />
        <span className="text-xs text-text-muted">
          Sistem promptuna eklenir, yerine geçmez. {brief.length}/{BRIEF_MAX}
        </span>
      </label>
      {partialNotice ? (
        <div
          role="alert"
          className="mt-3 rounded-md border border-warning bg-warning-soft px-3 py-2 text-sm text-text"
        >
          {partialNotice}
        </div>
      ) : null}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={disabled}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        >
          Üret
        </button>
      </div>

      <CostConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        count={count}
        busy={create.isPending}
        errorMessage={create.error?.message ?? null}
        onConfirm={onConfirm}
      />
    </fieldset>
  );
}
