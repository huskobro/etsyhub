"use client";

/**
 * Phase 66 — User-facing mockup template create form.
 *
 * Templated.io clone first end-to-end create UI. Minimal but functional:
 * operator template name + category + thumb key + (defaults: 1024×1024
 * base, full-canvas rect safe-area, normal blend) → 3-step API zincir
 * çalışır:
 *   1. POST /api/mockup-templates (Phase 65) — DRAFT template create
 *   2. POST /api/mockup-templates/[id]/bindings (Phase 66) — LOCAL_SHARP
 *      binding (renderable)
 *   3. PATCH /api/mockup-templates/[id] (Phase 66) — DRAFT → ACTIVE
 *      publish (operator opt-in via "Publish immediately" checkbox)
 *
 * Asset upload UI Phase 67+ candidate (file picker + MinIO upload via
 * existing admin upload-asset endpoint user-scope açıldığında). V1:
 * operator placeholder thumb key girer (example: "user-templates/sample.png").
 *
 * Mevcut admin LocalSharpConfigEditor karmaşık (jsonMode + JSON textarea +
 * detailed safe-area form). User flow bunu basitleştirir: 4 field +
 * defaults + 1 button. Phase 67+ visual safe-area editor candidate.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";

const CATEGORY_OPTIONS = [
  { value: "canvas", label: "Canvas (digital wall art)" },
  { value: "wall_art", label: "Wall art (framed prints)" },
  { value: "printable", label: "Printable" },
  { value: "clipart", label: "Clipart" },
  { value: "sticker", label: "Sticker" },
] as const;

const ASPECT_OPTIONS = [
  { value: "1:1", label: "Square (1:1)" },
  { value: "2:3", label: "Portrait (2:3)" },
  { value: "3:2", label: "Landscape (3:2)" },
  { value: "3:4", label: "Portrait (3:4)" },
  { value: "4:5", label: "Portrait (4:5)" },
] as const;

export function MockupTemplateCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] =
    useState<(typeof CATEGORY_OPTIONS)[number]["value"]>("wall_art");
  const [thumbKey, setThumbKey] = useState("");
  const [aspectRatio, setAspectRatio] =
    useState<(typeof ASPECT_OPTIONS)[number]["value"]>("2:3");
  const [publishImmediately, setPublishImmediately] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      // Phase 66 — 3-step chain: create → bind → publish (optional)
      setStatusMsg("Creating template…");
      const createRes = await fetch("/api/mockup-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          categoryId,
          name: name.trim(),
          thumbKey: thumbKey.trim(),
          aspectRatios: [aspectRatio],
          tags: [],
          estimatedRenderMs: 2000,
        }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Template create failed");
      }
      const created = (await createRes.json()) as { id: string; name: string };

      setStatusMsg("Adding LOCAL_SHARP binding…");
      const bindingRes = await fetch(
        `/api/mockup-templates/${created.id}/bindings`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            providerId: "LOCAL_SHARP",
            estimatedRenderMs: 2000,
            config: {
              // Phase 66 — Minimal renderable config:
              //   - base 1024×1024 (safe default; thumbKey doubles as
              //     baseAssetKey for V1)
              //   - full-canvas rect safe-area (operator can refine in
              //     Phase 67+ visual editor)
              //   - normal blend recipe (no shadow)
              baseAssetKey: thumbKey.trim(),
              baseDimensions: { w: 1024, h: 1024 },
              safeArea: { type: "rect", x: 0, y: 0, w: 1, h: 1 },
              recipe: { blendMode: "normal" },
              coverPriority: 0,
            },
          }),
        },
      );
      if (!bindingRes.ok) {
        const err = await bindingRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Binding create failed");
      }

      if (publishImmediately) {
        setStatusMsg("Publishing template (DRAFT → ACTIVE)…");
        const publishRes = await fetch(`/api/mockup-templates/${created.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "ACTIVE" }),
        });
        if (!publishRes.ok) {
          const err = await publishRes.json().catch(() => ({}));
          throw new Error(err.error ?? "Publish failed");
        }
      }

      setStatusMsg("Done!");
      return created;
    },
    onSuccess: () => {
      // Templated.io ürün hissi: operator template oluşturduktan sonra
      // /templates surface'ine geri döner (kendi library'sini görür).
      router.push("/templates");
      router.refresh();
    },
    onError: (e: Error) => {
      setStatusMsg(`Error: ${e.message}`);
    },
  });

  const formValid =
    name.trim().length > 0 && thumbKey.trim().length > 0;

  return (
    <div className="-m-6 flex h-screen flex-col bg-bg" data-testid="mockup-template-create-page">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-line bg-paper px-6 py-4">
        <Link
          href="/templates"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-k-bg hover:text-ink"
          aria-label="Back to Templates"
          data-testid="mockup-template-create-back"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[16px] font-semibold text-ink">
            New mockup template
          </h1>
          <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            Templated.io-style · self-hosted (no API calls) · your library
          </p>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <form
          className="mx-auto max-w-2xl space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (formValid && !createMutation.isPending) {
              createMutation.mutate();
            }
          }}
          data-testid="mockup-template-create-form"
        >
          {/* Name */}
          <div>
            <label className="block text-[13px] font-semibold text-ink">
              Template name
            </label>
            <p className="mt-0.5 text-[12px] text-ink-3">
              Operator-facing label. Shows in the Apply Mockups drawer.
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              placeholder="e.g., Living Room Wall Art Mockup"
              className="mt-2 h-10 w-full rounded-md border border-line bg-paper px-3 text-[14px] text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none"
              data-testid="mockup-template-create-name"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-[13px] font-semibold text-ink">
              Category
            </label>
            <p className="mt-0.5 text-[12px] text-ink-3">
              Apply Mockups drawer filters by category — pick the closest
              match.
            </p>
            <select
              value={categoryId}
              onChange={(e) =>
                setCategoryId(
                  e.target.value as (typeof CATEGORY_OPTIONS)[number]["value"],
                )
              }
              className="mt-2 h-10 w-full rounded-md border border-line bg-paper px-3 text-[14px] text-ink"
              data-testid="mockup-template-create-category"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Aspect ratio */}
          <div>
            <label className="block text-[13px] font-semibold text-ink">
              Aspect ratio
            </label>
            <p className="mt-0.5 text-[12px] text-ink-3">
              Operator selections must match this aspect ratio to apply
              this template.
            </p>
            <select
              value={aspectRatio}
              onChange={(e) =>
                setAspectRatio(
                  e.target.value as (typeof ASPECT_OPTIONS)[number]["value"],
                )
              }
              className="mt-2 h-10 w-full rounded-md border border-line bg-paper px-3 text-[14px] text-ink"
              data-testid="mockup-template-create-aspect"
            >
              {ASPECT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Thumb key (Phase 66 V1: text input; Phase 67+ file upload) */}
          <div>
            <label className="block text-[13px] font-semibold text-ink">
              Base asset key (MinIO)
            </label>
            <p className="mt-0.5 text-[12px] text-ink-3">
              Phase 66 V1: paste an existing MinIO storage key (also used
              as thumbnail). Asset upload UI lands in Phase 67. For now:
              use any key from your storage (e.g.,{" "}
              <code className="rounded bg-k-bg-2 px-1 font-mono text-[11px]">
                user-templates/sample.png
              </code>
              ).
            </p>
            <input
              type="text"
              value={thumbKey}
              onChange={(e) => setThumbKey(e.target.value)}
              required
              maxLength={500}
              placeholder="user-templates/sample.png"
              className="mt-2 h-10 w-full rounded-md border border-line bg-paper px-3 font-mono text-[12.5px] text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none"
              data-testid="mockup-template-create-thumb"
            />
          </div>

          {/* Publish immediately toggle */}
          <div className="rounded-md border border-line-soft bg-k-bg-2/40 p-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={publishImmediately}
                onChange={(e) => setPublishImmediately(e.target.checked)}
                className="mt-1 h-4 w-4 accent-k-orange"
                data-testid="mockup-template-create-publish-toggle"
              />
              <div>
                <div className="text-[13px] font-semibold text-ink">
                  Publish immediately (DRAFT → ACTIVE)
                </div>
                <p className="mt-0.5 text-[12px] text-ink-2">
                  When enabled, the template appears in Apply Mockups
                  &quot;My templates&quot; tab right after creation.
                  Uncheck to keep as DRAFT for further editing.
                </p>
              </div>
            </label>
          </div>

          {/* Phase 66 — minimal config note */}
          <div className="rounded-md border border-warning/40 bg-warning-soft/40 px-3 py-2 text-[12px] text-ink-2">
            <strong className="text-ink">Phase 66 V1 defaults:</strong> base
            dimensions 1024×1024, full-canvas rect safe-area, normal blend
            recipe. Visual safe-area editor (rect + 4-corner perspective
            from Phase 63), recipe shadow config, and asset upload UI ship
            in Phase 67. Operator can edit binding config via JSON in
            admin manager today.
          </div>

          {createMutation.isError ? (
            <div
              role="alert"
              className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-[13px] text-danger"
              data-testid="mockup-template-create-error"
            >
              {(createMutation.error as Error).message}
            </div>
          ) : null}

          {statusMsg && !createMutation.isError ? (
            <div
              className="font-mono text-[11px] uppercase tracking-meta text-ink-3"
              data-testid="mockup-template-create-status"
            >
              {statusMsg}
            </div>
          ) : null}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <Link
              href="/templates"
              className="k-btn k-btn--ghost"
              data-size="sm"
              data-testid="mockup-template-create-cancel"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!formValid || createMutation.isPending}
              className="k-btn k-btn--primary"
              data-size="sm"
              data-testid="mockup-template-create-submit"
            >
              <Sparkles className="h-3 w-3" aria-hidden />
              {createMutation.isPending
                ? "Creating…"
                : publishImmediately
                  ? "Create & publish"
                  : "Create as draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
