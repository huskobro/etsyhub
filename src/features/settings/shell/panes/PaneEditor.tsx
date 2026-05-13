/* eslint-disable no-restricted-syntax */
// PaneEditor — R8: Editor pane edit-op defaults (UserSetting key="editor").
// Brush size, mask compositing, magic-eraser strength, upscale model,
// crop snap-to-aspect.
//
// v6 sabit boyutlar (max-w-[680px] + text-[26px] k-display + yarı-piksel)
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface EditorSettings {
  brushSize: number;
  maskComposite: "multiply" | "overlay" | "soft-light";
  magicEraserStrength: "light" | "medium" | "aggressive";
  upscaleModel: "realesrgan-v3" | "swinir" | "esrgan";
  eraserFillMode: "context" | "transparent";
  cropSnapToAspect: boolean;
}

const QUERY_KEY = ["settings", "editor"] as const;

export function PaneEditor() {
  const qc = useQueryClient();

  const query = useQuery<{ settings: EditorSettings }>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/settings/editor");
      if (!r.ok) throw new Error("Could not load editor settings");
      return r.json();
    },
  });

  const mutation = useMutation<
    { settings: EditorSettings },
    Error,
    Partial<EditorSettings>
  >({
    mutationFn: async (patch) => {
      const r = await fetch("/api/settings/editor", {
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
  const [local, setLocal] = useState<EditorSettings | null>(null);

  useEffect(() => {
    if (remote) setLocal(remote);
  }, [remote]);

  const prefs = local ?? remote ?? null;

  function patch<K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) {
    if (!prefs) return;
    setLocal({ ...prefs, [key]: value });
    mutation.mutate({ [key]: value } as Partial<EditorSettings>);
  }

  if (!prefs) {
    return (
      <div className="max-w-[680px] px-10 py-9">
        <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
          Editor
        </h2>
        <div className="mt-8 flex items-center gap-2 text-sm text-ink-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading editor defaults…
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[680px] px-10 py-9">
      <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
        Editor
      </h2>
      <p className="mt-1 mb-7 text-[13px] text-ink-2">
        Default values for Selection edit operations (background remove,
        color edit, crop, upscale, magic eraser). Persists via{" "}
        <span className="font-mono text-xs">UserSetting key=editor</span>;
        edit modals will pick these up as initial state.
      </p>

      <SettingRow
        label="Brush size"
        hint="Default mask brush radius (px). Range 4–120."
      >
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={4}
            max={120}
            value={prefs.brushSize}
            onChange={(e) => patch("brushSize", parseInt(e.target.value, 10))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-line-soft accent-k-orange"
          />
          <span className="w-12 text-right font-mono text-[13px] tabular-nums text-ink-2">
            {prefs.brushSize}px
          </span>
        </div>
      </SettingRow>

      <SettingRow
        label="Mask composite"
        hint="How the mask preview blends with the canvas."
      >
        <Segment>
          {(["multiply", "overlay", "soft-light"] as const).map((m) => (
            <SegmentBtn
              key={m}
              active={prefs.maskComposite === m}
              onClick={() => patch("maskComposite", m)}
            >
              {m}
            </SegmentBtn>
          ))}
        </Segment>
      </SettingRow>

      <SettingRow
        label="Magic eraser strength"
        hint="How aggressively the eraser cleans nearby pixels."
      >
        <Segment>
          {(["light", "medium", "aggressive"] as const).map((s) => (
            <SegmentBtn
              key={s}
              active={prefs.magicEraserStrength === s}
              onClick={() => patch("magicEraserStrength", s)}
            >
              {s}
            </SegmentBtn>
          ))}
        </Segment>
      </SettingRow>

      <SettingRow
        label="Eraser fill mode"
        hint="What replaces erased pixels."
      >
        <Segment>
          <SegmentBtn
            active={prefs.eraserFillMode === "context"}
            onClick={() => patch("eraserFillMode", "context")}
          >
            Context-aware
          </SegmentBtn>
          <SegmentBtn
            active={prefs.eraserFillMode === "transparent"}
            onClick={() => patch("eraserFillMode", "transparent")}
          >
            Transparent
          </SegmentBtn>
        </Segment>
      </SettingRow>

      <SettingRow
        label="Upscale model"
        hint="Default model used by the upscale edit operation."
      >
        <select
          value={prefs.upscaleModel}
          onChange={(e) =>
            patch("upscaleModel", e.target.value as EditorSettings["upscaleModel"])
          }
          className="h-9 w-[260px] rounded-md border border-line bg-paper px-3 text-sm text-ink focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
        >
          <option value="realesrgan-v3">realesrgan-v3 (default)</option>
          <option value="swinir">swinir</option>
          <option value="esrgan">esrgan</option>
        </select>
      </SettingRow>

      <SettingRow
        label="Crop snap-to-aspect"
        hint="Auto-snap crop selection to the product type's preferred ratio."
      >
        <button
          type="button"
          onClick={() => patch("cropSnapToAspect", !prefs.cropSnapToAspect)}
          aria-pressed={prefs.cropSnapToAspect}
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors",
            prefs.cropSnapToAspect ? "bg-k-orange" : "bg-line-strong",
          )}
        >
          <span
            aria-hidden
            className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
            style={{ left: prefs.cropSnapToAspect ? 18 : 2 }}
          />
        </button>
      </SettingRow>

      <p className="mt-6 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
        {mutation.isPending
          ? "Saving…"
          : mutation.isError
            ? `Save failed: ${mutation.error?.message}`
            : "Toggles persist instantly · synced via UserSetting key=editor"}
      </p>
    </div>
  );
}

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 border-b border-line-soft py-4 md:grid-cols-[220px_1fr] md:items-start">
      <div>
        <div className="text-[13.5px] font-medium text-ink">{label}</div>
        {hint ? (
          <div className="mt-0.5 text-[12px] leading-snug text-ink-3">
            {hint}
          </div>
        ) : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Segment({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-line bg-k-bg-2 p-0.5">
      {children}
    </div>
  );
}

function SegmentBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
        active
          ? "bg-paper text-ink shadow-card"
          : "text-ink-3 hover:text-ink-2",
      )}
    >
      {children}
    </button>
  );
}
