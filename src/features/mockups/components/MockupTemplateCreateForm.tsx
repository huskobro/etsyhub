"use client";

/**
 * Phase 67 — User-facing mockup template create form (visual editor slice).
 *
 * Phase 66 baseline: text input thumbKey + 1024×1024 default + full-canvas
 * safe-area + create→bind→publish chain. Operatör görsel olarak hiçbir şey
 * göremiyordu — körlemesine giriş.
 *
 * Phase 67 değişikliği:
 *   1. Asset upload (multipart/form-data → /api/mockup-templates/upload-asset)
 *      → storageKey + width + height
 *   2. Visual SafeAreaEditor (rect drag/resize üzerinde uploaded asset)
 *      → SafeAreaRect normalized 0..1
 *   3. baseDimensions = upload'ın gerçek pixel boyutları (1024×1024 hardcode YOK)
 *   4. Aynı 3-step API chain (create → bind → publish)
 *   5. Aynı Phase 66 testid'ler korunur (regression safe)
 *
 * Form akışı:
 *   - Operator name + category + aspect girer
 *   - Asset upload → preview + visual editor açılır
 *   - Operator safe-area'yı drag/resize ile tanımlar (veya numeric input)
 *   - Submit → 3-step chain (Phase 66) + binding config gerçek
 *     baseDimensions + safeArea taşır
 *
 * Phase 68 candidate (bilinçli scope dışı):
 *   - Perspective quad editor (Phase 63 backend hazır; UI ayrı tur)
 *   - Multi-asset templates (single asset only — schema invariant)
 *   - Asset reuse picker (admin pattern paritesi; user storage list endpoint
 *     açıldığında)
 *   - Recipe editor (blendMode/shadow/etc. — şu an default normal blend)
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { SafeAreaEditor, type SafeAreaRect } from "./SafeAreaEditor";

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

type UploadResult = {
  storageKey: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
};

async function uploadBaseAsset(args: {
  file: File;
  categoryId: string;
}): Promise<UploadResult> {
  const fd = new FormData();
  fd.append("file", args.file);
  fd.append("categoryId", args.categoryId);
  fd.append("purpose", "base");
  const res = await fetch("/api/mockup-templates/upload-asset", {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Upload failed");
  }
  const data = (await res.json()) as UploadResult;
  if (!data.width || !data.height) {
    throw new Error("Upload succeeded but image dimensions missing");
  }
  return data;
}

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

export function MockupTemplateCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] =
    useState<(typeof CATEGORY_OPTIONS)[number]["value"]>("wall_art");
  const [aspectRatio, setAspectRatio] =
    useState<(typeof ASPECT_OPTIONS)[number]["value"]>("2:3");
  const [publishImmediately, setPublishImmediately] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Phase 67 — asset state (upload → preview → editor)
  const [asset, setAsset] = useState<UploadResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [safeArea, setSafeArea] = useState<SafeAreaRect>({
    x: 0.1,
    y: 0.1,
    w: 0.8,
    h: 0.8,
  });

  const uploadMutation = useMutation({
    mutationFn: uploadBaseAsset,
    onSuccess: (data) => {
      setAsset(data);
      // Reset safe-area to a reasonable default (10% inset full-canvas)
      setSafeArea({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
    },
  });

  // Fetch signed URL when asset uploaded (or asset key changes)
  useEffect(() => {
    if (!asset) {
      setPreviewUrl(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    fetchSignedUrl(asset.storageKey)
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
  }, [asset]);

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate({ file, categoryId });
    e.target.value = ""; // reset so same file repick triggers
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!asset) {
        throw new Error("Upload a base asset first");
      }
      // Phase 67 — Same 3-step chain (Phase 66) but binding config now
      // carries real baseDimensions + visual safe-area.
      setStatusMsg("Creating template…");
      const createRes = await fetch("/api/mockup-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          categoryId,
          name: name.trim(),
          thumbKey: asset.storageKey,
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
              baseAssetKey: asset.storageKey,
              baseDimensions: { w: asset.width, h: asset.height },
              safeArea: {
                type: "rect",
                x: safeArea.x,
                y: safeArea.y,
                w: safeArea.w,
                h: safeArea.h,
              },
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
      router.push("/templates");
      router.refresh();
    },
    onError: (e: Error) => {
      setStatusMsg(`Error: ${e.message}`);
    },
  });

  const formValid = name.trim().length > 0 && asset !== null;

  return (
    <div
      className="-m-6 flex h-screen flex-col bg-bg"
      data-testid="mockup-template-create-page"
    >
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
          className="mx-auto max-w-3xl space-y-6"
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

          {/* Category + Aspect — side-by-side */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[13px] font-semibold text-ink">
                Category
              </label>
              <p className="mt-0.5 text-[12px] text-ink-3">
                Apply Mockups drawer filters by category.
              </p>
              <select
                value={categoryId}
                onChange={(e) =>
                  setCategoryId(
                    e.target
                      .value as (typeof CATEGORY_OPTIONS)[number]["value"],
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

            <div>
              <label className="block text-[13px] font-semibold text-ink">
                Aspect ratio
              </label>
              <p className="mt-0.5 text-[12px] text-ink-3">
                Selections must match this ratio to apply.
              </p>
              <select
                value={aspectRatio}
                onChange={(e) =>
                  setAspectRatio(
                    e.target
                      .value as (typeof ASPECT_OPTIONS)[number]["value"],
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
          </div>

          {/* Asset upload + visual editor */}
          <div className="rounded-md border border-line bg-paper p-4">
            <label className="block text-[13px] font-semibold text-ink">
              Base asset & safe-area
            </label>
            <p className="mt-0.5 text-[12px] text-ink-3">
              Upload your mockup base image (where your design will be placed),
              then drag the orange rect to mark where the design fits.
              PNG/JPEG/WebP, max 25MB.
            </p>

            {!asset ? (
              <label
                className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-line bg-k-bg-2/40 px-6 py-12 text-center transition-colors hover:border-k-orange hover:bg-k-orange-soft/30"
                data-testid="mockup-template-create-upload-dropzone"
              >
                <Upload className="h-6 w-6 text-ink-3" aria-hidden />
                <span className="text-[13px] font-medium text-ink">
                  {uploadMutation.isPending
                    ? "Uploading…"
                    : "Pick a base image"}
                </span>
                <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                  PNG · JPEG · WebP · max 25MB
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={onFilePick}
                  disabled={uploadMutation.isPending}
                  className="hidden"
                  data-testid="mockup-template-create-upload-input"
                />
              </label>
            ) : previewUrl ? (
              <div
                className="mt-3 flex flex-col gap-3"
                data-testid="mockup-template-create-editor-loaded"
              >
                <div className="flex items-center justify-between gap-3 rounded-md bg-k-bg-2/40 px-3 py-2 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                  <span className="truncate">
                    {asset.storageKey.split("/").pop()} ·{" "}
                    {asset.width}×{asset.height} ·{" "}
                    {Math.round(asset.sizeBytes / 1024)}KB
                  </span>
                  <label
                    className="cursor-pointer text-k-orange-ink hover:underline"
                    data-testid="mockup-template-create-replace-asset"
                  >
                    Replace
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={onFilePick}
                      disabled={uploadMutation.isPending}
                      className="hidden"
                    />
                  </label>
                </div>
                <SafeAreaEditor
                  imageUrl={previewUrl}
                  imageWidth={asset.width}
                  imageHeight={asset.height}
                  value={safeArea}
                  onChange={setSafeArea}
                  disabled={createMutation.isPending}
                />
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-center rounded-md border border-line bg-k-bg-2/40 px-6 py-12 text-[13px] text-ink-3">
                {previewError ?? "Loading preview…"}
              </div>
            )}

            {uploadMutation.error ? (
              <p
                role="alert"
                className="mt-2 rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-[12px] text-danger"
                data-testid="mockup-template-create-upload-error"
              >
                {(uploadMutation.error as Error).message}
              </p>
            ) : null}
          </div>

          {/* Publish toggle */}
          <div className="rounded-md border border-line-soft bg-k-bg-2/40 p-3">
            <label className="flex cursor-pointer items-start gap-3">
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
