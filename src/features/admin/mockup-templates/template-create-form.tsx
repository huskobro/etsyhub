"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";

/**
 * Admin · Yeni MockupTemplate creation form (V2 admin authoring).
 *
 * V2 admin authoring foundation: admin browser'dan yeni template oluşturabilir.
 * Asset upload pipeline V2.x scope dışı — admin storage key'i (örn.
 * "templates/canvas-frame-3-thumb.png") elle girer; MinIO'ya admin asset prep
 * pipeline ile yükleme ayrı operasyonel adım.
 *
 * Form state'leri:
 * - categoryId (V2 8-değer enum)
 * - name (1-120 char)
 * - thumbKey (storage key, 1-500 char)
 * - aspectRatios (comma-separated, en az 1)
 * - tags (comma-separated, opsiyonel)
 * - estimatedRenderMs (100-60000)
 *
 * Submit sonrası: DRAFT state'te oluşur → list page'e dön + invalidate.
 */

const CATEGORIES = [
  { value: "canvas", label: "Canvas" },
  { value: "wall_art", label: "Wall Art" },
  { value: "printable", label: "Printable" },
  { value: "clipart", label: "Clipart" },
  { value: "sticker", label: "Sticker" },
  { value: "tshirt", label: "T-Shirt" },
  { value: "hoodie", label: "Hoodie" },
  { value: "dtf", label: "DTF" },
];

type CreateInput = {
  categoryId: string;
  name: string;
  thumbKey: string;
  aspectRatios: string[];
  tags: string[];
  estimatedRenderMs: number;
};

async function createTemplate(input: CreateInput) {
  const res = await fetch("/api/admin/mockup-templates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Oluşturma başarısız");
  }
  return res.json();
}

function parseCsv(s: string): string[] {
  return s
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function TemplateCreateForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const [categoryId, setCategoryId] = useState("canvas");
  const [name, setName] = useState("");
  const [thumbKey, setThumbKey] = useState("");
  const [aspectRatiosCsv, setAspectRatiosCsv] = useState("3:4");
  const [tagsCsv, setTagsCsv] = useState("");
  const [estimatedRenderMs, setEstimatedRenderMs] = useState(2000);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin", "mockup-templates"] });
      router.push(`/admin/mockup-templates/${data.item.id}`);
    },
    onError: (err) => setError((err as Error).message),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const aspectRatios = parseCsv(aspectRatiosCsv);
    if (aspectRatios.length === 0) {
      setError("En az bir aspect ratio gerekli (örn. 3:4 veya 2:3)");
      return;
    }
    mutation.mutate({
      categoryId,
      name: name.trim(),
      thumbKey: thumbKey.trim(),
      aspectRatios,
      tags: parseCsv(tagsCsv),
      estimatedRenderMs,
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex max-w-2xl flex-col gap-4 rounded-md border border-border bg-surface p-6"
    >
      {/* Category */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoryId" className="text-sm font-medium text-text">
          Kategori
        </label>
        <select
          id="categoryId"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-control-md rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition-colors duration-fast ease-out focus:border-accent"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-text">
          Ad
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={1}
          maxLength={120}
          placeholder="Örn. Modern Frame Canvas"
          className="h-control-md rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition-colors duration-fast ease-out focus:border-accent"
        />
      </div>

      {/* ThumbKey */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="thumbKey" className="text-sm font-medium text-text">
          Thumbnail Storage Key
        </label>
        <input
          id="thumbKey"
          type="text"
          value={thumbKey}
          onChange={(e) => setThumbKey(e.target.value)}
          required
          minLength={1}
          maxLength={500}
          placeholder="Örn. templates/canvas/modern-frame-thumb.png"
          className="h-control-md rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition-colors duration-fast ease-out focus:border-accent"
        />
        <p className="text-xs text-text-muted">
          MinIO/S3 storage key. Admin asset prep ile yüklenmiş olmalı; upload UI V2.x carry-forward.
        </p>
      </div>

      {/* Aspect ratios CSV */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="aspectRatios" className="text-sm font-medium text-text">
          Aspect Ratios (virgülle)
        </label>
        <input
          id="aspectRatios"
          type="text"
          value={aspectRatiosCsv}
          onChange={(e) => setAspectRatiosCsv(e.target.value)}
          required
          placeholder="3:4, 2:3"
          className="h-control-md rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition-colors duration-fast ease-out focus:border-accent"
        />
        <p className="text-xs text-text-muted">
          ProductType.aspectRatio ile uyumlu olmalı. Canvas → 3:4, Wall Art / Printable → 2:3, Sticker / Clipart / Hoodie / T-shirt / DTF → 1:1.
        </p>
      </div>

      {/* Tags CSV */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="tags" className="text-sm font-medium text-text">
          Tagler (virgülle, opsiyonel)
        </label>
        <input
          id="tags"
          type="text"
          value={tagsCsv}
          onChange={(e) => setTagsCsv(e.target.value)}
          maxLength={500}
          placeholder="modern, frame, light"
          className="h-control-md rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition-colors duration-fast ease-out focus:border-accent"
        />
      </div>

      {/* estimatedRenderMs */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="estimatedRenderMs"
          className="text-sm font-medium text-text"
        >
          Tahmini Render Süresi (ms)
        </label>
        <input
          id="estimatedRenderMs"
          type="number"
          value={estimatedRenderMs}
          onChange={(e) => setEstimatedRenderMs(Number(e.target.value))}
          required
          min={100}
          max={60000}
          step={100}
          className="h-control-md w-40 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition-colors duration-fast ease-out focus:border-accent"
        />
        <p className="text-xs text-text-muted">
          Job ETA hesabında kullanılır. Sharp local render için tipik 1500-3000ms.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          variant="primary"
          loading={mutation.isPending}
          disabled={mutation.isPending}
        >
          Oluştur
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/admin/mockup-templates")}
          disabled={mutation.isPending}
        >
          İptal
        </Button>
      </div>
    </form>
  );
}
