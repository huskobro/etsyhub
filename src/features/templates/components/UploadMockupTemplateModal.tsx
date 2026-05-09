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

export function UploadMockupTemplateModal({ onClose, onUploaded }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [tags, setTags] = useState<string>("");
  const [aspectRatios, setAspectRatios] = useState<string>("1:1, 2:3, 3:4");
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation<unknown, Error, void>({
    mutationFn: async () => {
      if (!file) throw new Error("Dosya seçilmedi");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name);
      fd.append("tags", tags);
      fd.append("aspectRatios", aspectRatios);
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
      onClose();
    },
  });

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
      }
    >
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
            object deep parse + provider binding wizard ship in R9; for now
            the file is stored and metadata persists so operators can
            reference it.
          </p>
        </div>
      </div>
    </Modal>
  );
}
