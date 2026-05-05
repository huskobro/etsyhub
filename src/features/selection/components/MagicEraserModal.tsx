"use client";

// Pass 29 — Magic Eraser modal. Selection Studio QuickActions'tan açılır;
// fullscreen modal ile büyük canvas + brush + commit. Image-reviewer
// SettingsModal/CardStack içinden mantığı uyarlanmıştır (god-file YOK,
// modular component); brush boyut + clear + tetikleme.
//
// Akış:
//   1. Kullanıcı MagicEraserModal açar (item.editedAssetId ?? sourceAssetId)
//   2. MaskCanvas'a fırça ile silinecek alan çiziyor
//   3. "Sil" tıklayınca: maskExport → base64 → POST /edit/heavy
//      { op: "magic-eraser", maskBase64 }
//   4. Mutation success → modal kapanır; HeavyActionButton zaten polling
//      yapıyor (Phase 7 selection edit lifecycle).
//   5. Cancel/Esc → modal kapanır, mask atılır.
//
// Honest sınırlar:
//   - Asset URL: signed URL gerek (Phase 7 mevcut hook). Item'ın aktif
//     asset id'si edited > source önceliğinde.
//   - Mask boyut limit: ≤500KB base64 (endpoint zod). Aşılırsa kullanıcı
//     mesaj alır. 4096×4096 binarize ~50KB safe.

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { Eraser, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { selectionSetQueryKey, type SelectionItemView } from "../queries";
import { MaskCanvas, type MaskCanvasHandle } from "./MaskCanvas";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setId: string;
  item: SelectionItemView;
  /** İmaj URL — signed URL kaynağı parent'ta resolve edilir. */
  imageSrc: string;
};

export function MagicEraserModal({
  open,
  onOpenChange,
  setId,
  item,
  imageSrc,
}: Props) {
  const qc = useQueryClient();
  const canvasRef = useRef<MaskCanvasHandle>(null);
  const [brushSize, setBrushSize] = useState(60);
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      const ref = canvasRef.current;
      if (!ref || !ref.hasContent()) {
        throw new Error(
          "Önce silinecek alanı işaretle (fırça ile çiz).",
        );
      }
      const blob = await ref.exportMaskPng();
      const arrayBuffer = await blob.arrayBuffer();
      // base64 — chunked btoa (büyük buffer'lar için stack overflow önleme)
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        const slice = bytes.subarray(i, i + CHUNK);
        binary += String.fromCharCode.apply(
          null,
          Array.from(slice) as number[],
        );
      }
      const maskBase64 = btoa(binary);

      const res = await fetch(
        `/api/selection/sets/${setId}/items/${item.id}/edit/heavy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "magic-eraser", maskBase64 }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : `HTTP ${res.status}`,
        );
      }
      return (await res.json()) as { jobId: string };
    },
    onSuccess: () => {
      // SelectionSet query invalidate — activeHeavyJobId set edildi,
      // HeavyActionButton lifecycle yakalar.
      qc.invalidateQueries({ queryKey: selectionSetQueryKey(setId) });
      onOpenChange(false);
    },
    onError: (err) => setError((err as Error).message),
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-4 z-50 flex flex-col overflow-hidden rounded-md border border-border bg-bg shadow-card md:inset-8"
        >
          {/* Pass 31 — Header polish: title + kullanıcı-dostu subtitle
              ("LaMa inpainting" teknik etiket sağa). */}
          <header className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-border px-6 py-4">
            <div className="flex items-start gap-3">
              <Eraser
                className="mt-1 h-5 w-5 flex-shrink-0 text-accent"
                aria-hidden
              />
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <Dialog.Title className="text-lg font-semibold text-text">
                    Magic Eraser
                  </Dialog.Title>
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-text">
                    LaMa
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  Görseldeki istenmeyen bölgeyi fırça ile işaretleyin —
                  AI o bölgeyi siler ve doğal şekilde doldurur.
                </p>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Kapat"
                className="flex-shrink-0 rounded-md p-1 text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </Dialog.Close>
          </header>

          {/* Canvas area */}
          <div className="flex flex-1 overflow-hidden bg-surface-2 p-4">
            <MaskCanvas
              ref={canvasRef}
              imageSrc={imageSrc}
              brushSize={brushSize}
            />
          </div>

          {/* Footer: brush + actions */}
          <footer className="flex flex-shrink-0 flex-col gap-3 border-t border-border bg-surface px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-text-muted">
                <span>Fırça boyutu</span>
                <input
                  type="range"
                  min={10}
                  max={200}
                  step={5}
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-32"
                />
                <span className="font-mono text-text">{brushSize}px</span>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  canvasRef.current?.clear();
                  setError(null);
                }}
                disabled={submit.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                <span className="ml-1">Maskeyi temizle</span>
              </Button>
              <p className="text-xs text-text-muted">
                İşaretlediğiniz bölgeler silinecek. Esc kapatır.
              </p>
            </div>

            {error ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}

            {/* Pass 31 — Submit pending inline feedback. Modal kapanırken
                kullanıcı boşluğa düşmesin: "İşlem kuyruğa alındı" mesajı +
                progress bilgisi. Gerçek completion toast page-level
                useHeavyEditCompletionToast tarafından (worker bittiğinde). */}
            {submit.isPending ? (
              <div
                className="rounded-md bg-accent-soft px-3 py-2 text-xs text-accent-text"
                role="status"
              >
                İşlem kuyruğa alınıyor… Sonuç hazırlandığında modal kapanır
                ve sağ panelde edited önizleme görünür (genellikle birkaç
                saniye).
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost" disabled={submit.isPending}>
                  Vazgeç
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setError(null);
                  submit.mutate();
                }}
                loading={submit.isPending}
                disabled={submit.isPending}
              >
                {/* Pass 31 — Sil → Uygula. "Sil" butonu kullanıcıyı
                    "asset siliniyor mu?" diye düşündürebiliyordu;
                    "Uygula" daha açık (mask uygulanır, asset değil). */}
                {submit.isPending ? "Gönderiliyor…" : "Uygula"}
              </Button>
            </div>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
