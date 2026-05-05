"use client";

// Pass 29 — MaskCanvas: kullanıcının silinecek alanları fırça ile çizdiği
// canvas component. Image-reviewer DrawingOverlay'den **mantığı uyarlanmıştır**;
// birebir kopya değil — bizim Tailwind tokens + accessibility + reusable
// boundary disipliniyle yeniden yerleştirildi.
//
// API:
//   - imageSrc: arka planda gösterilecek görselin URL'i (signed/server-relative)
//   - imageWidth/imageHeight: orijinal görsel piksel boyutları (mask aynı oranda
//     scale edilir; runner Python tarafında binarize edilir)
//   - brushSize: 10-200 px (settings'ten configurable; v1 default 60)
//   - onMaskChange?: opsiyonel — her stroke sonrası mask data URL emit
//
// Imperative handle (forwardRef):
//   - exportMaskPng(): Promise<Blob>  — mask'ı binary PNG olarak verir
//   - clear(): boş canvas'a döner
//   - hasContent(): boolean — en az 1 stroke çizildi mi
//
// Mask kontratı:
//   White (255) = remove area · Black (0) = keep area
//   Çıktı her zaman görsel boyutunda (imageWidth × imageHeight) PNG; binarize
//   Python runner'da yapılır (>127 → remove).

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export type MaskCanvasHandle = {
  /** Mask'ı PNG Blob olarak verir (görsel boyutunda, beyaz=remove). */
  exportMaskPng: () => Promise<Blob>;
  /** Canvas'ı temizler (tüm stroke'lar silinir). */
  clear: () => void;
  /** Şu ana kadar en az 1 stroke çizildi mi. */
  hasContent: () => boolean;
};

export type MaskCanvasProps = {
  imageSrc: string;
  brushSize?: number;
  className?: string;
};

export const MaskCanvas = forwardRef<MaskCanvasHandle, MaskCanvasProps>(
  function MaskCanvas(
    { imageSrc, brushSize = 60, className },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgElRef = useRef<HTMLImageElement>(null);
    const isDrawingRef = useRef(false);
    const lastPosRef = useRef<{ x: number; y: number } | null>(null);
    const hasContentRef = useRef(false);

    // Image native boyutları img onLoad sırasında set edilir.
    const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

    // Canvas pixel size = image native (mask çıktısı tam çözünürlüklü olur).
    // Display tarafında canvas image'in render edilen kutusuyla overlay olur.
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !imgSize) return;
      canvas.width = imgSize.w;
      canvas.height = imgSize.h;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasContentRef.current = false;
    }, [imgSize]);

    const getPos = (e: PointerEvent | React.PointerEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      // Canvas DOM rect = image rendered rect (overlay'lendi)
      const rect = canvas.getBoundingClientRect();
      // Mouse pixel → canvas pixel scale
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      return { x, y };
    };

    const drawSegment = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.strokeStyle = "white";
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      hasContentRef.current = true;
    };

    const onPointerDown = (e: React.PointerEvent) => {
      const pos = getPos(e);
      if (!pos) return;
      isDrawingRef.current = true;
      lastPosRef.current = pos;
      // Ilk dot — kullanıcının tek-tık deneyimi için
      drawSegment(pos, pos);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: React.PointerEvent) => {
      if (!isDrawingRef.current) return;
      const pos = getPos(e);
      if (!pos || !lastPosRef.current) return;
      drawSegment(lastPosRef.current, pos);
      lastPosRef.current = pos;
    };

    const onPointerUp = (e: React.PointerEvent) => {
      isDrawingRef.current = false;
      lastPosRef.current = null;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // capture set edilmemiş olabilir
      }
    };

    useImperativeHandle(
      ref,
      () => ({
        exportMaskPng: () => {
          return new Promise<Blob>((resolve, reject) => {
            const canvas = canvasRef.current;
            if (!canvas) {
              reject(new Error("Canvas hazır değil"));
              return;
            }
            // Mask çıktısı: black background + white strokes.
            // Canvas default transparent → black background ile compose et.
            const exportCanvas = document.createElement("canvas");
            exportCanvas.width = canvas.width;
            exportCanvas.height = canvas.height;
            const ctx = exportCanvas.getContext("2d");
            if (!ctx) {
              reject(new Error("Canvas context alınamadı"));
              return;
            }
            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
            ctx.drawImage(canvas, 0, 0);
            exportCanvas.toBlob((blob) => {
              if (!blob) {
                reject(new Error("Mask blob üretilemedi"));
                return;
              }
              resolve(blob);
            }, "image/png");
          });
        },
        clear: () => {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            hasContentRef.current = false;
          }
        },
        hasContent: () => hasContentRef.current,
      }),
      [],
    );

    return (
      <div
        ref={containerRef}
        className={
          "relative flex h-full w-full items-center justify-center overflow-hidden " +
          (className ?? "")
        }
      >
        {/* Image + canvas overlay — wrapper inline-block; image kendi
            aspect'ini taşır, canvas absolute inset-0 ile aynı kutuyu
            kaplar. Token check inline style yasakladığı için CSS-only
            aspect-fit (max-h/max-w + object-contain). */}
        <div className="relative inline-block max-h-full max-w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgElRef}
            key={imageSrc}
            src={imageSrc}
            alt="Düzenlenecek görsel"
            className="block max-h-full max-w-full object-contain"
            draggable={false}
            onLoad={(e) => {
              const target = e.currentTarget;
              setImgSize({ w: target.naturalWidth, h: target.naturalHeight });
            }}
          />
          {imgSize ? (
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="absolute inset-0 h-full w-full cursor-crosshair touch-none opacity-50 mix-blend-screen"
            />
          ) : null}
        </div>
        {!imgSize ? (
          <p className="absolute text-sm text-text-muted">Görsel yükleniyor…</p>
        ) : null}
      </div>
    );
  },
);
