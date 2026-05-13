"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";

/**
 * Admin asset upload field (V2 Phase 8 authoring).
 *
 * Reusable component:
 *   - Storage key + dimensions input (admin elle de girebilir)
 *   - File picker → POST /api/admin/mockup-templates/upload-asset
 *     (multipart/form-data + categoryId + purpose form fields)
 *   - Upload sonrası storage key'i form'a auto-fill + preview göster
 *   - Preview signed URL: GET /api/admin/mockup-templates/asset-url?key=...
 *   - Manual override: admin dilerse mevcut bir storage key'i elle girebilir
 *
 * Props:
 *   - value: mevcut storage key (form state'inden)
 *   - onChange: storage key + opsiyonel width/height bilgisini parent'a iletir
 *   - categoryId: upload prefix'i için
 *   - purpose: 'thumb' (template thumbnail) / 'base' (binding baseAsset)
 *   - label: UI label
 */

type UploadResponse = {
  storageKey: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  mimeType: string;
};

async function uploadAsset(args: {
  file: File;
  categoryId: string;
  purpose: "thumb" | "base";
}): Promise<UploadResponse> {
  const fd = new FormData();
  fd.append("file", args.file);
  fd.append("categoryId", args.categoryId);
  fd.append("purpose", args.purpose);
  const res = await fetch("/api/admin/mockup-templates/upload-asset", {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Upload başarısız");
  }
  return res.json();
}

async function fetchSignedUrl(key: string): Promise<string> {
  const res = await fetch(
    `/api/admin/mockup-templates/asset-url?key=${encodeURIComponent(key)}`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not load preview URL");
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

type ExistingAsset = {
  key: string;
  sizeBytes: number;
  lastModified: string;
};

async function listExistingAssets(args: {
  categoryId: string;
  purpose: "thumb" | "base";
}): Promise<ExistingAsset[]> {
  const url = `/api/admin/mockup-templates/list-assets?categoryId=${encodeURIComponent(args.categoryId)}&purpose=${args.purpose}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not load existing assets");
  }
  const data = (await res.json()) as { items: ExistingAsset[] };
  return data.items;
}

export type AssetUploadFieldProps = {
  value: string;
  onChange: (
    storageKey: string,
    extra?: { width: number | null; height: number | null },
  ) => void;
  categoryId: string;
  purpose: "thumb" | "base";
  label: string;
  description?: string;
  required?: boolean;
};

export function AssetUploadField({
  value,
  onChange,
  categoryId,
  purpose,
  label,
  description,
  required = false,
}: AssetUploadFieldProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: uploadAsset,
    onSuccess: (data) => {
      onChange(data.storageKey, { width: data.width, height: data.height });
    },
  });

  // Existing assets — yalnız picker açıldığında çağrılır (lazy)
  const existingAssetsQuery = useQuery({
    queryKey: ["admin", "mockup-template-assets", categoryId, purpose],
    queryFn: () => listExistingAssets({ categoryId, purpose }),
    enabled: pickerOpen,
    // Picker her açıldığında tazele (yeni upload olmuş olabilir)
    staleTime: 0,
  });

  // Value değiştiğinde signed URL fetch (preview)
  useEffect(() => {
    if (!value || !value.startsWith("templates/")) {
      setPreviewUrl(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    fetchSignedUrl(value)
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
  }, [value]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    mutation.mutate({ file, categoryId, purpose });
    // Reset input so same file re-pick triggers onChange
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={`upload-${purpose}`}
        className="text-sm font-medium text-text"
      >
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>

      <div className="flex flex-col gap-2 rounded-md border border-border bg-bg p-3">
        {/* Preview */}
        {previewUrl ? (
          <div className="flex items-center gap-3">
            <img
              src={previewUrl}
              alt={`${label} preview`}
              className="h-24 w-24 rounded-md border border-border object-cover"
            />
            <div className="flex flex-col gap-0.5 text-xs text-text-muted">
              <span className="font-mono break-all">{value}</span>
              {previewError ? (
                <span className="text-danger">{previewError}</span>
              ) : null}
            </div>
          </div>
        ) : value ? (
          <div className="flex items-center gap-3 text-xs text-text-muted">
            <div className="flex h-24 w-24 items-center justify-center rounded-md border border-border bg-surface">
              <span>preview yok</span>
            </div>
            <span className="font-mono break-all">{value}</span>
          </div>
        ) : (
          <div className="flex h-24 w-full items-center justify-center rounded-md border border-dashed border-border bg-surface text-xs text-text-muted">
            Henüz dosya yok
          </div>
        )}

        {/* File picker + existing asset reuse + manual override */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={`upload-${purpose}`}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onFileChange}
            disabled={mutation.isPending}
            className="block flex-1 text-sm text-text-muted file:mr-2 file:h-control-sm file:cursor-pointer file:rounded-md file:border-0 file:bg-accent file:px-3 file:text-xs file:font-medium file:text-white hover:file:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setPickerOpen((v) => !v)}
            disabled={mutation.isPending}
          >
            {pickerOpen ? "Picker'ı kapat" : "Mevcut asset seç"}
          </Button>
          {mutation.isPending ? (
            <span className="text-xs text-text-muted">Yükleniyor…</span>
          ) : null}
        </div>

        {/* Existing asset picker (lazy fetch on open) */}
        {pickerOpen ? (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">
                {categoryId} / {purpose} · daha önce yüklenmişler
              </span>
              {existingAssetsQuery.isFetching ? (
                <span className="text-xs text-text-muted">Yükleniyor…</span>
              ) : null}
            </div>
            {existingAssetsQuery.error ? (
              <p className="text-xs text-danger" role="alert">
                {(existingAssetsQuery.error as Error).message}
              </p>
            ) : null}
            {existingAssetsQuery.data ? (
              existingAssetsQuery.data.length === 0 ? (
                <p className="text-xs text-text-muted">
                  Bu kategori + purpose için henüz yüklü asset yok.
                </p>
              ) : (
                <div className="grid max-h-60 grid-cols-3 gap-2 overflow-auto sm:grid-cols-4">
                  {existingAssetsQuery.data.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => {
                        // Picker'dan seçim — width/height bilinmiyor (storage list metadata sınırlı)
                        // Admin manuel override için boyutu ayrı düzenler
                        onChange(a.key);
                        setPickerOpen(false);
                      }}
                      className="flex flex-col items-stretch gap-1 rounded-md border border-border bg-bg p-1 text-left transition-colors hover:border-accent"
                    >
                      <AssetThumb assetKey={a.key} />
                      <span className="truncate font-mono text-xs text-text-muted">
                        {a.key.split("/").pop()}
                      </span>
                      <span className="text-xs text-text-muted">
                        {Math.round(a.sizeBytes / 1024)}KB
                      </span>
                    </button>
                  ))}
                </div>
              )
            ) : null}
          </div>
        ) : null}

        {/* Manual key override */}
        <details className="text-xs">
          <summary className="cursor-pointer text-text-muted hover:text-text">
            Manuel storage key gir (mevcut yüklenmiş asset için)
          </summary>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="templates/canvas/thumb/your-key.png"
              maxLength={500}
              className="h-control-sm flex-1 rounded-md border border-border bg-surface px-2 font-mono text-xs text-text outline-none focus:border-accent"
            />
            {value ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onChange("")}
              >
                Temizle
              </Button>
            ) : null}
          </div>
        </details>

        {mutation.error ? (
          <p className="text-xs text-danger" role="alert">
            {(mutation.error as Error).message}
          </p>
        ) : null}
      </div>

      {description ? (
        <p className="text-xs text-text-muted">{description}</p>
      ) : null}
    </div>
  );
}

function AssetThumb({ assetKey }: { assetKey: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchSignedUrl(assetKey)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        // Sessizce: thumbnail yüklenemediyse fallback UI göster
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [assetKey]);

  if (!url) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-md bg-surface text-xs text-text-muted">
        …
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={assetKey}
      className="aspect-square w-full rounded-md object-cover"
    />
  );
}
