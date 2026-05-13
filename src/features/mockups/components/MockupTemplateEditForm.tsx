"use client";

/**
 * Phase 69 — User-facing mockup template edit form.
 *
 * Mevcut template'i açar, safe-area + name düzenleme + republish.
 * Phase 67/68 SafeAreaEditor'u + Phase 69 validity/sample/reset
 * pattern'ını re-use eder. Yeni big abstraction yok — create form'la
 * aynı parça setini consume eder, ama PATCH ile çalışır.
 *
 * Operasyonlar:
 *   - Rename (PATCH name)
 *   - Safe-area güncelle (PATCH bindingConfig — LOCAL_SHARP shape)
 *   - Save & keep status / Save & publish (publish guard backend'de)
 *   - Archive (PATCH status=ARCHIVED)
 *
 * Kullanmıyor (bilinçli scope dışı):
 *   - Replace base asset (current template asset key sabit; yeni asset
 *     için yeni template oluştur — operatör'ün authoring yeniden başlar)
 *   - Recipe edit (default normal blend; Phase 70+ candidate)
 *   - Aspect ratio / category değişikliği (existing template invariant'ları;
 *     değiştirmek mevcut apply zincirini kırar)
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Sparkles,
  Archive,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import {
  SafeAreaEditor,
  type SafeAreaValue,
  rectToPerspective,
  perspectiveToRect,
} from "./SafeAreaEditor";
import { validateSafeArea } from "./safe-area-validity";

type LocalSharpConfig = {
  baseAssetKey: string;
  baseDimensions: { w: number; h: number };
  safeArea:
    | { type: "rect"; x: number; y: number; w: number; h: number }
    | {
        type: "perspective";
        corners: [
          [number, number],
          [number, number],
          [number, number],
          [number, number],
        ];
      };
  recipe: { blendMode: string };
  coverPriority: number;
};

async function fetchSignedUrl(key: string): Promise<string> {
  const res = await fetch(
    `/api/mockup-templates/asset-url?key=${encodeURIComponent(key)}`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not load preview URL");
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

function configSafeAreaToValue(cfg: LocalSharpConfig): SafeAreaValue {
  if (cfg.safeArea.type === "rect") {
    return {
      mode: "rect",
      rect: {
        x: cfg.safeArea.x,
        y: cfg.safeArea.y,
        w: cfg.safeArea.w,
        h: cfg.safeArea.h,
      },
    };
  }
  return {
    mode: "perspective",
    perspective: { corners: cfg.safeArea.corners },
  };
}

export type MockupTemplateEditFormProps = {
  templateId: string;
  initialName: string;
  initialStatus: "DRAFT" | "ACTIVE" | "ARCHIVED";
  bindingConfig: Record<string, unknown>;
};

export function MockupTemplateEditForm({
  templateId,
  initialName,
  initialStatus,
  bindingConfig,
}: MockupTemplateEditFormProps) {
  const router = useRouter();
  const cfg = bindingConfig as unknown as LocalSharpConfig;

  const [name, setName] = useState(initialName);
  const [safeArea, setSafeArea] = useState<SafeAreaValue>(
    configSafeAreaToValue(cfg),
  );
  const [showSamplePreview, setShowSamplePreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const validity = validateSafeArea(safeArea);

  const resetSafeArea = () => {
    if (safeArea.mode === "rect") {
      setSafeArea({
        mode: "rect",
        rect: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
      });
    } else {
      setSafeArea({
        mode: "perspective",
        perspective: {
          corners: [
            [0.1, 0.1],
            [0.9, 0.1],
            [0.9, 0.9],
            [0.1, 0.9],
          ],
        },
      });
    }
  };

  const switchMode = (next: "rect" | "perspective") => {
    if (safeArea.mode === next) return;
    if (next === "perspective" && safeArea.mode === "rect") {
      setSafeArea({
        mode: "perspective",
        perspective: rectToPerspective(safeArea.rect),
      });
    } else if (next === "rect" && safeArea.mode === "perspective") {
      setSafeArea({
        mode: "rect",
        rect: perspectiveToRect(safeArea.perspective),
      });
    }
  };

  // Fetch signed URL for the existing base asset
  useEffect(() => {
    let cancelled = false;
    fetchSignedUrl(cfg.baseAssetKey)
      .then((u) => {
        if (!cancelled) {
          setPreviewUrl(u);
          setPreviewError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setPreviewUrl(null);
          setPreviewError(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cfg.baseAssetKey]);

  const saveMutation = useMutation({
    mutationFn: async (publishAfter: boolean) => {
      setStatusMsg("Saving changes…");
      const newConfig: LocalSharpConfig = {
        baseAssetKey: cfg.baseAssetKey,
        baseDimensions: cfg.baseDimensions,
        safeArea:
          safeArea.mode === "rect"
            ? {
                type: "rect",
                x: safeArea.rect.x,
                y: safeArea.rect.y,
                w: safeArea.rect.w,
                h: safeArea.rect.h,
              }
            : {
                type: "perspective",
                corners: safeArea.perspective.corners,
              },
        recipe: cfg.recipe,
        coverPriority: cfg.coverPriority,
      };

      const body: Record<string, unknown> = {
        name: name.trim(),
        bindingConfig: newConfig,
      };
      if (publishAfter && initialStatus !== "ACTIVE") {
        body.status = "ACTIVE";
      }

      const res = await fetch(`/api/mockup-templates/${templateId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Save failed");
      }
      setStatusMsg("Saved.");
      return res.json();
    },
    onSuccess: () => {
      router.push("/templates");
      router.refresh();
    },
    onError: (e: Error) => {
      setStatusMsg(`Error: ${e.message}`);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/mockup-templates/${templateId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Archive failed");
      }
      return res.json();
    },
    onSuccess: () => {
      router.push("/templates");
      router.refresh();
    },
  });

  const formValid = name.trim().length > 0 && validity.ok;
  const pending = saveMutation.isPending || archiveMutation.isPending;

  return (
    <div
      className="-m-6 flex h-screen flex-col bg-bg"
      data-testid="mockup-template-edit-page"
    >
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-line bg-paper px-6 py-4">
        <Link
          href="/templates"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-k-bg hover:text-ink"
          aria-label="Back to Templates"
          data-testid="mockup-template-edit-back"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[16px] font-semibold text-ink">
            Edit mockup template
          </h1>
          <p
            className="mt-0.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3"
            data-testid="mockup-template-edit-status"
          >
            {initialStatus} · safe-area + name editable · base asset locked
          </p>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <form
          className="mx-auto max-w-3xl space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (formValid && !pending) saveMutation.mutate(false);
          }}
          data-testid="mockup-template-edit-form"
        >
          {/* Name */}
          <div>
            <label className="block text-[13px] font-semibold text-ink">
              Template name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              className="mt-2 h-10 w-full rounded-md border border-line bg-paper px-3 text-[14px] text-ink focus:border-k-orange focus:outline-none"
              data-testid="mockup-template-edit-name"
            />
          </div>

          {/* Mode toggle + safe-area editor */}
          <div className="rounded-md border border-line bg-paper p-4">
            <label className="block text-[13px] font-semibold text-ink">
              Safe-area
            </label>
            <p className="mt-0.5 text-[12px] text-ink-3">
              Drag rect or perspective quad to update where the design lands.
              Base asset and dimensions are locked — to swap the asset, create
              a new template.
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div
                className="k-segment"
                role="group"
                aria-label="Safe-area authoring mode"
                data-testid="safe-area-mode-toggle"
              >
                {(["rect", "perspective"] as const).map((m) => {
                  const active = safeArea.mode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={active}
                      onClick={() => switchMode(m)}
                      disabled={pending}
                      data-testid={`safe-area-mode-${m}`}
                      data-active={active}
                    >
                      {m === "rect" ? "Rect" : "Perspective"}
                    </button>
                  );
                })}
              </div>
              <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                {safeArea.mode === "rect"
                  ? "Rect · simple flat surfaces"
                  : "Perspective · yamuk smart areas"}
              </span>
            </div>

            <div className="mt-3">
              {previewUrl ? (
                <SafeAreaEditor
                  imageUrl={previewUrl}
                  imageWidth={cfg.baseDimensions.w}
                  imageHeight={cfg.baseDimensions.h}
                  value={safeArea}
                  onChange={setSafeArea}
                  disabled={pending}
                  showSamplePreview={showSamplePreview}
                  onToggleSamplePreview={() =>
                    setShowSamplePreview((v) => !v)
                  }
                  onReset={resetSafeArea}
                />
              ) : (
                <div className="flex items-center justify-center rounded-md border border-line bg-k-bg-2/40 px-6 py-12 text-[13px] text-ink-3">
                  {previewError ?? "Loading preview…"}
                </div>
              )}
            </div>

            {/* Validity feedback */}
            {validity.issues.length > 0 ? (
              <div
                className="mt-3 space-y-1.5"
                data-testid="safe-area-validity-block"
              >
                {validity.issues.map((issue, i) => (
                  <div
                    key={i}
                    role="alert"
                    data-validity-code={issue.code}
                    data-validity-severity={issue.severity}
                    className={
                      issue.severity === "error"
                        ? "flex items-start gap-2 rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-[12px] text-danger"
                        : "flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft/40 px-3 py-2 text-[12px] text-ink-2"
                    }
                  >
                    {issue.severity === "error" ? (
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
                    )}
                    <span>{issue.message}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Phase 70+ recipe editor will live here.
              Placeholder hint so operator knows where future blendMode /
              shadow controls will appear. */}
          <div
            className="rounded-md border border-line-soft bg-k-bg-2/40 p-3 text-[12px] text-ink-2"
            data-testid="recipe-editor-placeholder"
          >
            <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
              Recipe (blend mode / shadow) · coming soon
            </span>
            <p className="mt-1">
              Currently locked to <code className="rounded bg-paper px-1 font-mono text-[11px]">{`{ blendMode: "${cfg.recipe.blendMode}" }`}</code>.
              Shadow + blend controls will land in a later phase.
            </p>
          </div>

          {saveMutation.isError ? (
            <div
              role="alert"
              className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-[13px] text-danger"
              data-testid="mockup-template-edit-error"
            >
              {(saveMutation.error as Error).message}
            </div>
          ) : null}
          {archiveMutation.isError ? (
            <div
              role="alert"
              className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-[13px] text-danger"
            >
              {(archiveMutation.error as Error).message}
            </div>
          ) : null}
          {statusMsg && !saveMutation.isError ? (
            <div className="font-mono text-[11px] uppercase tracking-meta text-ink-3">
              {statusMsg}
            </div>
          ) : null}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <div className="flex items-center gap-2">
              <Link
                href="/templates"
                className="k-btn k-btn--ghost"
                data-size="sm"
                data-testid="mockup-template-edit-cancel"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (
                    initialStatus !== "ARCHIVED" &&
                    confirm(
                      "Archive this template? It will disappear from Apply Mockups but existing renders are kept.",
                    )
                  ) {
                    archiveMutation.mutate();
                  }
                }}
                disabled={pending || initialStatus === "ARCHIVED"}
                className="k-btn k-btn--ghost"
                data-size="sm"
                data-testid="mockup-template-edit-archive"
                title={
                  initialStatus === "ARCHIVED"
                    ? "Already archived"
                    : "Archive this template (cannot be undone from this UI)"
                }
              >
                <Archive className="h-3 w-3" aria-hidden /> Archive
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!formValid || pending}
                className="k-btn k-btn--ghost"
                data-size="sm"
                data-testid="mockup-template-edit-save"
                title={
                  !validity.ok
                    ? "Fix the validation errors below before saving"
                    : "Save changes (status unchanged)"
                }
              >
                Save
              </button>
              {initialStatus !== "ACTIVE" ? (
                <button
                  type="button"
                  onClick={() => {
                    if (formValid && !pending) saveMutation.mutate(true);
                  }}
                  disabled={!formValid || pending}
                  className="k-btn k-btn--primary"
                  data-size="sm"
                  data-testid="mockup-template-edit-save-publish"
                >
                  <Sparkles className="h-3 w-3" aria-hidden /> Save & publish
                </button>
              ) : null}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
