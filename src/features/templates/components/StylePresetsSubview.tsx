/* eslint-disable no-restricted-syntax */
// StylePresetsSubview — Kivasy v6 C1 Presets sub-view; v6 sabit boyutlar:
//  · text-[14px] font-semibold preset card title (v6 canon)
//  · text-[10px] / text-[10.5px] / text-[11px] yarı-piksel mono labels
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import { Modal } from "@/features/library/components/Modal";
import { cn } from "@/lib/cn";

interface StylePresetRow {
  id: string;
  key: string;
  name: string;
  aspect: "square" | "portrait" | "landscape" | "multi";
  similarity: "subtle" | "medium" | "heavy";
  palette: string;
  weight: string;
  notes: string | null;
  isSystem: boolean;
  updatedAt: string;
}

const QUERY_KEY = ["templates", "style-presets"] as const;

export function StylePresetsSubview({ isAdmin }: { isAdmin: boolean }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const query = useQuery<{ presets: StylePresetRow[] }>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/templates/style-presets");
      if (!r.ok) throw new Error("Style presets yüklenemedi");
      return r.json();
    },
  });

  const presets = query.data?.presets ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-text-muted">
          Aspect + similarity + palette + weight bundles. Reuse across A6
          Create Variations &amp; Recipes. Persisted via{" "}
          <span className="font-mono text-xs">Recipe.config.kind=&quot;style-preset&quot;</span>
          {" "}— no schema migration.
        </p>
        <button
          type="button"
          data-size="sm"
          className="k-btn k-btn--primary"
          disabled={!isAdmin}
          onClick={() => setEditorOpen(true)}
          title={
            isAdmin
              ? "Add new style preset"
              : "Admin scope — only admins can create presets"
          }
          data-testid="style-presets-new-cta"
        >
          <Plus className="h-3 w-3" aria-hidden />
          New Preset
        </button>
      </div>

      {query.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-k-orange" aria-hidden />
        </div>
      ) : presets.length === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-paper px-6 py-12 text-center">
          <h3 className="text-base font-semibold text-ink">
            No style presets yet
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            Save aspect + similarity + palette combos as named presets so
            operators can reuse them across batches.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {presets.map((p) => (
            <div
              key={p.id}
              className="k-card p-4"
              data-testid="style-preset-card"
              data-preset-key={p.key}
            >
              <div className="mb-3 flex items-center gap-1.5">
                <AspectChip aspect={p.aspect} />
                <span className="ml-auto font-mono text-[10px] uppercase tracking-meta text-ink-3">
                  SIM · {p.similarity}
                </span>
              </div>
              <div className="mb-2 text-[14px] font-semibold leading-snug text-ink">
                {p.name}
              </div>
              <div className="mb-3 flex flex-wrap gap-1">
                <span className="rounded bg-k-bg-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-2">
                  palette: {p.palette}
                </span>
                <span className="rounded bg-k-bg-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-2">
                  weight: {p.weight}
                </span>
              </div>
              {p.notes ? (
                <p className="mb-3 text-[12px] leading-snug text-ink-3">
                  {p.notes}
                </p>
              ) : null}
              <div className="flex items-center justify-between border-t border-line-soft pt-2.5">
                <span className="font-mono text-[11px] tracking-wider text-ink-3">
                  {p.key}
                </span>
                <button
                  type="button"
                  className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-ink-2 hover:text-ink disabled:opacity-50"
                  disabled
                  title="Apply ships in R8 — A6 modal preset selector"
                >
                  Apply
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editorOpen ? (
        <NewStylePresetModal onClose={() => setEditorOpen(false)} />
      ) : null}
    </div>
  );
}

function AspectChip({ aspect }: { aspect: StylePresetRow["aspect"] }) {
  const dot =
    aspect === "landscape"
      ? { w: 12, h: 6 }
      : aspect === "portrait"
        ? { w: 6, h: 12 }
        : aspect === "multi"
          ? { w: 10, h: 10 }
          : { w: 9, h: 9 };
  return (
    <span className="inline-flex items-center gap-1 rounded border border-line bg-k-bg-2 px-2 py-1 font-mono text-[9.5px] uppercase tracking-meta text-ink-2">
      <span
        aria-hidden
        className="inline-block bg-ink-3"
        style={{ width: dot.w, height: dot.h, borderRadius: 1.5 }}
      />
      {aspect}
    </span>
  );
}

function NewStylePresetModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [aspect, setAspect] = useState<StylePresetRow["aspect"]>("square");
  const [similarity, setSimilarity] =
    useState<StylePresetRow["similarity"]>("medium");
  const [palette, setPalette] = useState("");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation<unknown, Error, void>({
    mutationFn: async () => {
      const r = await fetch("/api/templates/style-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, aspect, similarity, palette, weight, notes }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${r.status}`);
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      onClose();
    },
  });

  const canSave =
    name.trim().length > 0 &&
    palette.trim().length > 0 &&
    weight.trim().length > 0;

  return (
    <Modal
      title="New Style Preset"
      onClose={onClose}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-ink-2 hover:text-ink"
          >
            Cancel
          </button>
          <div className="ml-auto flex items-center gap-3">
            {mutation.error ? (
              <span className="font-mono text-[11px] text-danger">
                {mutation.error.message}
              </span>
            ) : null}
            <button
              type="button"
              data-size="sm"
              className="k-btn k-btn--primary"
              disabled={!canSave || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : null}
              Create Preset
            </button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Square · neutral · refs medium"
            className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Aspect">
            <select
              value={aspect}
              onChange={(e) =>
                setAspect(e.target.value as StylePresetRow["aspect"])
              }
              className={selectClass}
            >
              <option value="square">Square (1:1)</option>
              <option value="portrait">Portrait (2:3)</option>
              <option value="landscape">Landscape (3:2)</option>
              <option value="multi">Multi (bundle)</option>
            </select>
          </Field>
          <Field label="Similarity">
            <select
              value={similarity}
              onChange={(e) =>
                setSimilarity(e.target.value as StylePresetRow["similarity"])
              }
              className={selectClass}
            >
              <option value="subtle">Subtle</option>
              <option value="medium">Medium</option>
              <option value="heavy">Heavy</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Palette">
            <input
              type="text"
              value={palette}
              onChange={(e) => setPalette(e.target.value)}
              placeholder="neutral / brand / locked"
              className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
            />
          </Field>
          <Field label="Weight">
            <input
              type="text"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="subtle / medium / heavy"
              className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
            />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="When to reach for this preset"
            className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
          />
        </Field>
      </div>
    </Modal>
  );
}

const selectClass = cn(
  "h-9 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink",
  "focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft",
);

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[12.5px] font-semibold text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}
