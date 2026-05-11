/* eslint-disable no-restricted-syntax */
// UploadMockupTemplateModal — Kivasy v6 Templates Mockups upload.
// v6 sabit boyutlar:
//  · Modal md (max-w-[720px]) + drop zone border-dashed canon
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { Modal } from "@/features/library/components/Modal";

interface Props {
  onClose: () => void;
  onUploaded?: () => void;
}

interface UploadResponse {
  template: {
    id: string;
    name: string;
    status: string;
    tags: string[];
    aspectRatios: string[];
    suitability: {
      kind: "raster" | "psd" | "unsupported";
      width: number | null;
      height: number | null;
      detectedAspect: string | null;
      hasSmartObject: boolean;
    };
  };
}

// R11.8 — Kivasy digital-only scope (CLAUDE.md): tshirt/hoodie/dtf garment
// POD out-of-scope. Operatör'a sadece dijital ürün kategorileri:
const PRODUCT_TYPE_OPTIONS: Array<{
  value: "wall_art" | "clipart" | "sticker" | "printable" | "canvas";
  label: string;
  hint: string;
}> = [
  { value: "wall_art", label: "Wall art", hint: "Frame / poster / canvas — duvar mockup" },
  { value: "clipart", label: "Clipart", hint: "Bundle preview · sheet · multi-design" },
  { value: "sticker", label: "Sticker", hint: "Die-cut sheet · tek sticker" },
  { value: "printable", label: "Printable", hint: "PDF planner · printable journal" },
  { value: "canvas", label: "Canvas", hint: "Lifestyle canvas · gallery wall" },
];

export function UploadMockupTemplateModal({ onClose, onUploaded }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [tags, setTags] = useState<string>("");
  const [aspectRatios, setAspectRatios] = useState<string>("1:1, 2:3, 3:4");
  const [productType, setProductType] = useState<
    (typeof PRODUCT_TYPE_OPTIONS)[number]["value"]
  >("wall_art");
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation<UploadResponse, Error, void>({
    mutationFn: async () => {
      if (!file) throw new Error("Dosya seçilmedi");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name);
      fd.append("tags", tags);
      fd.append("aspectRatios", aspectRatios);
      fd.append("productType", productType);
      const r = await fetch("/api/templates/mockups", {
        method: "POST",
        body: fd,
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${r.status}`);
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      onUploaded?.();
      // R11 — Modal'ı hemen kapatmak yerine suitability sonucunu göster.
      // Operatör "Done" basınca kapanır.
    },
  });

  const result = mutation.data?.template ?? null;

  const canUpload = !!file && name.trim().length > 0;
  const fileLabel = file
    ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)}MB`
    : null;

  return (
    <Modal
      title="Upload mockup template"
      onClose={onClose}
      size="md"
      footer={
        result ? (
          <>
            <span className="font-mono text-[11px] text-ink-3">
              Template ID: {result.id.slice(0, 12)}
            </span>
            <button
              type="button"
              onClick={onClose}
              data-size="sm"
              className="k-btn k-btn--primary ml-auto"
              data-testid="mockup-upload-done"
            >
              Done
            </button>
          </>
        ) : (
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
                  <AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden />
                  {mutation.error.message}
                </span>
              ) : null}
              <button
                type="button"
                data-size="sm"
                className="k-btn k-btn--primary"
                disabled={!canUpload || mutation.isPending}
                onClick={() => mutation.mutate()}
                data-testid="mockup-upload-confirm"
              >
                {mutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <Upload className="h-3 w-3" aria-hidden />
                )}
                Upload to My Templates
              </button>
            </div>
          </>
        )
      }
    >
      {result ? (
        <SuitabilityReport result={result} />
      ) : (
      <div className="space-y-5">
        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-ink">
            Template name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Studio frame mockup"
            className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
          />
        </div>

        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-ink">
            Product type
          </label>
          <div
            className="flex flex-wrap gap-1.5"
            data-testid="mockup-upload-product-type"
          >
            {PRODUCT_TYPE_OPTIONS.map((opt) => {
              const active = productType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setProductType(opt.value)}
                  className={
                    active
                      ? "inline-flex h-8 items-center gap-1.5 rounded-md border border-k-orange bg-k-orange-soft px-3 text-xs font-medium text-k-orange-ink"
                      : "inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-3 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink"
                  }
                  data-product-type={opt.value}
                  data-active={active ? "true" : "false"}
                  aria-pressed={active}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            {PRODUCT_TYPE_OPTIONS.find((o) => o.value === productType)?.hint}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-ink">
            File (PSD, PNG, JPG · max 50MB)
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".psd,image/png,image/jpeg,image/webp,application/octet-stream"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
            data-testid="mockup-upload-file-input"
          />
          {file ? (
            <div className="flex items-center gap-2 rounded-md border border-line bg-k-bg-2/40 px-3 py-2">
              <span className="flex-1 truncate font-mono text-[12px] text-ink-2">
                {fileLabel}
              </span>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-3 hover:text-ink"
                aria-label="Remove file"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-line-strong bg-paper px-6 py-8 text-center hover:border-k-orange"
            >
              <Upload className="h-5 w-5 text-ink-3" aria-hidden />
              <span className="text-[13px] font-medium text-ink">
                Click to choose a file
              </span>
              <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                PSD · PNG · JPG · WEBP
              </span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-[12.5px] font-semibold text-ink">
              Aspect ratios (csv)
            </label>
            <input
              type="text"
              value={aspectRatios}
              onChange={(e) => setAspectRatios(e.target.value)}
              placeholder="1:1, 2:3, 3:4"
              className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12.5px] font-semibold text-ink">
              Tags (csv)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="psd, smart-obj, frame"
              className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
            />
          </div>
        </div>

        <div className="rounded-md border border-dashed border-line bg-k-bg-2/40 px-3 py-2">
          <p className="text-[12.5px] leading-snug text-ink-2">
            Upload lands as a <strong>DRAFT</strong> in My Templates. Smart-
            object deep parse + provider binding wizard ship in R12; for now
            the file is stored, sharp inspection runs (raster: thumbnail +
            aspect detect; PSD: smart-object hint).
          </p>
        </div>
      </div>
      )}
    </Modal>
  );
}

/* eslint-disable no-restricted-syntax */
// SuitabilityReport — Kivasy v6 hint card; v6 sabit ölçüler:
//  · text-[15px] / text-[12.5px] / text-[11px] / text-[10.5px] yarı-piksel
// Whitelisted in scripts/check-tokens.ts.
function SuitabilityReport({
  result,
}: {
  result: NonNullable<UploadResponse["template"]>;
}) {
  const ok = result.suitability.kind !== "unsupported";
  const isPsd = result.suitability.kind === "psd";
  const hasSmartObject = result.suitability.hasSmartObject;
  const detectedAspect = result.suitability.detectedAspect;
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-success bg-success-soft px-4 py-3">
        <div className="text-[15px] font-semibold text-success">
          Template uploaded
        </div>
        <div className="mt-1 font-mono text-[11px] text-ink-3">
          {result.name} · status {result.status}
        </div>
      </div>
      <div className="overflow-hidden rounded-md border border-line bg-paper">
        <div className="border-b border-line-soft px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
          File suitability
        </div>
        <div className="divide-y divide-line-soft">
          <Row label="Kind" value={result.suitability.kind.toUpperCase()} />
          {result.suitability.width && result.suitability.height ? (
            <Row
              label="Dimensions"
              value={`${result.suitability.width} × ${result.suitability.height}`}
            />
          ) : null}
          {detectedAspect ? (
            <Row label="Detected aspect" value={detectedAspect} />
          ) : null}
          <Row
            label="Aspect ratios"
            value={result.aspectRatios.join(" · ")}
          />
          <Row label="Tags" value={result.tags.join(", ") || "—"} />
          {isPsd ? (
            <Row
              label="Smart-object hint"
              value={hasSmartObject ? "Likely (PlcL marker)" : "Not detected"}
              tone={hasSmartObject ? "success" : "neutral"}
            />
          ) : null}
        </div>
      </div>
      {ok ? (
        <div className="rounded-md border border-info bg-info-soft px-4 py-2.5">
          <p className="text-[12.5px] leading-snug text-info">
            Next step: open My Templates, click <strong>Activate template</strong>{" "}
            to move from DRAFT to ACTIVE. Activated templates are visible in
            Selection &rarr; Apply Mockups.
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-warning bg-warning-soft px-4 py-2.5">
          <p className="text-[12.5px] leading-snug text-warning">
            File parsed as <strong>unsupported</strong> — upload persisted but
            no thumbnail rendered. Activation may fail. Use a PSD/PNG/JPG
            file for best results.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "success" | "neutral";
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
        {label}
      </span>
      <span
        className={
          tone === "success"
            ? "ml-auto font-mono text-[12.5px] text-k-green"
            : "ml-auto font-mono text-[12.5px] text-ink-2"
        }
      >
        {value}
      </span>
    </div>
  );
}
