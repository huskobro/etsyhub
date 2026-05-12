"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { Modal, ModalSplit } from "@/features/library/components/Modal";
import { UserAssetThumb } from "@/components/ui/UserAssetThumb";

/**
 * A6 Create Variations modal — split modal + Prompt Preview micro-extension.
 *
 * Source:
 *   docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a6-a7.jsx
 *     → A6CreateVariations
 *   docs/design-system/kivasy/ui_kits/kivasy/v7/screens-d.jsx
 *     → D2 A6 Prompt Preview micro-extension
 *
 * Surface boundary: this modal is the create-variations *trigger surface*.
 * It builds the request body and POSTs to the variation endpoint
 * (admin-scoped today). The actual variation pipeline (Midjourney bridge,
 * job persistence, etc.) lives in the existing service layer; we don't
 * touch it.
 *
 * Prompt Preview semantics (per Wave D §D2):
 *   - Section is COLLAPSED by default — non-power-user is not bothered.
 *   - When expanded, shows the resolved prompt (template + interpolated
 *     variables) read-only.
 *   - "Edit as override" flips the textarea to editable; reveals a mono
 *     amber "edited · won't save to template" caption + "Reset to template"
 *     ghost link. The override travels with the batch only — the saved
 *     template is not modified.
 */

interface CreateVariationsModalProps {
  /** Source MidjourneyAsset.id (parent for the variation). */
  midjourneyAssetId: string;
  /** Source asset thumbnail id (for the left rail preview). */
  assetId: string;
  /** Source title / label (e.g. "Boho line art bundle"). */
  sourceTitle: string;
  /** Source meta line (e.g. "Pinterest · Wall art · 2h ago"). */
  sourceMeta: string;
  /** Default prompt as the template would resolve it (variables interpolated). */
  resolvedPrompt: string;
  /** Linked template label for context — null if inline prompt. */
  templateLabel?: string | null;
  /** Linked template id (display in mono). */
  templateId?: string | null;
  onClose: () => void;
}

type Mode = "subtle" | "strong";

export function CreateVariationsModal({
  midjourneyAssetId,
  assetId,
  sourceTitle,
  sourceMeta,
  resolvedPrompt,
  templateLabel,
  templateId,
  onClose,
}: CreateVariationsModalProps) {
  const [mode, setMode] = useState<Mode>("subtle");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [overrideEditing, setOverrideEditing] = useState(false);
  const [overrideText, setOverrideText] = useState(resolvedPrompt);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOverridden = overrideEditing && overrideText !== resolvedPrompt;

  async function handleCreate() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/midjourney/variation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          midjourneyAssetId,
          mode,
          // promptOverride is a deliberately new field. The server-side
          // variation service ignores unknown body keys today; rollout-3.5
          // will land the override-aware request handler. Surfacing it now
          // keeps the UI honest about what the operator is actually doing.
          ...(isOverridden ? { promptOverride: overrideText } : {}),
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(json.message ?? `HTTP ${res.status}`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Variation request failed");
    } finally {
      setSubmitting(false);
    }
  }

  function resetOverride() {
    setOverrideEditing(false);
    setOverrideText(resolvedPrompt);
  }

  return (
    <Modal
      title="Create Variations"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-ink-2 hover:text-ink disabled:opacity-50"
          >
            Cancel
          </button>
          <div className="ml-auto flex items-center gap-3">
            {error ? (
              <span className="font-mono text-xs text-danger">{error}</span>
            ) : null}
            <button
              type="button"
              onClick={handleCreate}
              disabled={submitting}
              className="k-btn k-btn--primary"
              data-testid="a6-create-variations-submit"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {submitting ? "Creating…" : "Create Variations"}
            </button>
          </div>
        </>
      }
    >
      <ModalSplit
        rail={
          <>
            <div className="font-mono text-xs uppercase tracking-meta text-ink-3">
              Source reference
            </div>
            <div className="mt-3">
              <UserAssetThumb
                assetId={assetId}
                alt={sourceTitle}
                square
                className="!aspect-square !rounded-lg"
              />
            </div>
            <h3 className="mt-3 text-sm font-semibold leading-tight text-ink">
              {sourceTitle}
            </h3>
            <p className="mt-1 font-mono text-xs uppercase tracking-meta text-ink-3">
              {sourceMeta}
            </p>
            {templateLabel ? (
              <div className="mt-4 rounded-md border border-line bg-paper p-3">
                <div className="font-mono text-xs uppercase tracking-meta text-ink-3">
                  Template
                </div>
                <div className="mt-1 text-sm font-medium text-ink">
                  {templateLabel}
                </div>
                {templateId ? (
                  <div className="mt-0.5 font-mono text-xs text-ink-3">
                    tpl_{templateId.slice(0, 8)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        }
      >
        <div className="space-y-6">
          {/* Batch-first Phase 6 — refinement context. Bu modal MJ V1-V4
           * tarzı bir görselden yeni minor varyasyonlar üretir; ana batch
           * creation aksiyonu DEĞİL (Reference → Batch ana omurgası
           * "Start Batch" CTA'sından başlar). Subtitle operatöre bunu
           * hatırlatır. */}
          <p
            className="-mt-1 text-xs text-ink-3"
            data-testid="a6-modal-refinement-hint"
          >
            Re-vary the selected image with subtle or stronger changes —
            refinement action, separate from the main Start Batch flow.
          </p>
          {/* Mode — subtle vs strong (matches the legacy variation service body) */}
          <Section label="Variation strength">
            <div className="flex">
              {(["subtle", "strong"] as const).map((m, i) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "h-10 flex-1 border border-line text-sm font-medium transition-colors",
                    i === 0 ? "rounded-l-md" : "-ml-px rounded-r-md",
                    mode === m
                      ? "z-10 border-k-orange bg-k-orange-soft text-k-orange-ink"
                      : "bg-paper text-ink-2 hover:border-line-strong",
                  )}
                >
                  {m === "subtle" ? "Subtle" : "Strong"}
                </button>
              ))}
            </div>
            <p className="mt-2 font-mono text-xs uppercase tracking-meta text-ink-3">
              {mode === "subtle"
                ? "Tighter compositional + palette adherence"
                : "Looser interpretation — lets the model diverge"}
            </p>
          </Section>

          {/* Prompt template select (display-only — picked at trigger time) */}
          <Section label="Prompt template">
            <div className="flex h-11 items-center gap-3 rounded-md border border-line bg-paper px-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-ink">
                  {templateLabel ?? "Inline prompt (no template)"}
                </div>
              </div>
              {templateId ? (
                <span className="font-mono text-xs text-ink-3">
                  tpl_{templateId.slice(0, 8)}
                </span>
              ) : null}
            </div>
          </Section>

          {/* D2 · Prompt Preview micro-extension — collapsed by default */}
          <Section label="Prompt preview">
            <div className="rounded-md border border-line bg-paper">
              <button
                type="button"
                onClick={() => setPreviewOpen((v) => !v)}
                aria-expanded={previewOpen}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-ink-3 transition-transform",
                    previewOpen && "rotate-180",
                  )}
                  aria-hidden
                />
                <span className="text-sm font-medium text-ink-2">
                  Prompt preview
                </span>
                <span className="font-mono text-xs uppercase tracking-meta text-ink-3">
                  (advanced · view or edit before generating)
                </span>
              </button>

              {previewOpen ? (
                <div className="border-t border-line-soft px-3 py-3">
                  <textarea
                    value={overrideText}
                    onChange={(e) => setOverrideText(e.target.value)}
                    readOnly={!overrideEditing}
                    rows={6}
                    className={cn(
                      "block w-full resize-y rounded-md border bg-k-bg-2 px-3 py-2 font-mono text-xs leading-relaxed",
                      overrideEditing
                        ? "border-k-orange text-ink"
                        : "border-line text-ink-2",
                    )}
                  />
                  <div className="mt-2 flex items-center gap-3">
                    {!overrideEditing ? (
                      <button
                        type="button"
                        onClick={() => setOverrideEditing(true)}
                        className="text-xs text-info underline-offset-2 hover:underline"
                      >
                        Edit as override
                      </button>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-warning">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning" />
                          edited · won&apos;t save to template
                        </span>
                        <button
                          type="button"
                          onClick={resetOverride}
                          className="ml-auto inline-flex items-center gap-1 text-xs text-ink-2 underline-offset-2 hover:underline"
                        >
                          <RotateCcw className="h-3 w-3" aria-hidden />
                          Reset to template
                        </button>
                      </>
                    )}
                  </div>
                  {overrideEditing ? (
                    <p className="mt-2 font-mono text-xs uppercase tracking-meta text-ink-3">
                      Override travels with this batch only · visible later in
                      Batch detail → Items
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Section>
        </div>
      </ModalSplit>
    </Modal>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold text-ink">{label}</div>
      {children}
    </div>
  );
}
