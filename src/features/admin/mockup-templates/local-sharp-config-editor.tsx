"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { AssetUploadField } from "./asset-upload-field";

/**
 * V2 Phase 8 — LocalSharpConfig Structured Editor.
 *
 * Mevcut binding form JSON textarea idi; admin baseDimensions, safeArea,
 * recipe, coverPriority gibi alanları manuel JSON yazıyor — hata yapması
 * çok kolay. Bu component LocalSharpConfigSchema alanlarını dedicated
 * input'lara çıkarır + canlı validate endpoint'iyle preview-ready feedback
 * verir.
 *
 * Props:
 *   - value: LocalSharpConfig (parent state'inden)
 *   - onChange: tam config object'i parent'a iletir
 *   - categoryId: AssetUploadField için
 *
 * Form alanları:
 *   - baseAssetKey (AssetUploadField)
 *   - baseDimensions { w, h }
 *   - safeArea (rect): { x, y, w, h, rotation? } — perspective JSON-only
 *   - recipe { blendMode } — shadow opsiyonel JSON-only
 *   - coverPriority (0-100 slider/number)
 *
 * Advanced JSON fallback:
 *   - "Gelişmiş: JSON modunda düzenle" details — tüm config'i raw JSON
 *     olarak edit etme imkanı (perspective safeArea + shadow vs.)
 *
 * Validate endpoint çağrısı:
 *   - Component değiştiğinde debounced (500ms) `/api/admin/mockup-templates/validate-config`
 *   - Response: { valid, errors[], summary: { baseAsset.exists, safeAreaType, ... } }
 *   - UI: errors listesi + baseAsset preview status + summary chip'leri
 */

type SafeAreaRect = {
  type: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
};

type SafeAreaPerspective = {
  type: "perspective";
  corners: [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ];
};

type SafeArea = SafeAreaRect | SafeAreaPerspective;

type LocalSharpConfig = {
  providerId?: "local-sharp"; // discriminator (otomatik eklenir)
  baseAssetKey: string;
  baseDimensions: { w: number; h: number };
  safeArea: SafeArea;
  recipe: {
    blendMode: "normal" | "multiply" | "screen";
    shadow?: {
      offsetX: number;
      offsetY: number;
      blur: number;
      opacity: number;
    };
  };
  coverPriority: number;
};

type ValidationResponse = {
  valid: boolean;
  errors: { path: string; message: string }[];
  summary: {
    providerId: string;
    baseAsset?: { exists: boolean; mimeType?: string; sizeBytes?: number };
    safeAreaType?: "rect" | "perspective";
    baseDimensions?: { w: number; h: number };
    coverPriority?: number;
  };
};

async function validateConfig(input: {
  providerId: "LOCAL_SHARP";
  config: unknown;
}): Promise<ValidationResponse> {
  const res = await fetch("/api/admin/mockup-templates/validate-config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Validate başarısız");
  }
  return res.json();
}

export type LocalSharpConfigEditorProps = {
  value: LocalSharpConfig;
  onChange: (next: LocalSharpConfig) => void;
  categoryId: string;
};

export function LocalSharpConfigEditor({
  value,
  onChange,
  categoryId,
}: LocalSharpConfigEditorProps) {
  // Validate debounced
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const validateMutation = useMutation({
    mutationFn: validateConfig,
    onSuccess: (data) => setValidation(data),
  });

  useEffect(() => {
    const handle = setTimeout(() => {
      // Sadece baseAssetKey doluysa validate; aksi takdirde hata gürültüsü olur
      if (value.baseAssetKey && value.baseAssetKey.trim().length > 0) {
        validateMutation.mutate({ providerId: "LOCAL_SHARP", config: value });
      } else {
        setValidation(null);
      }
    }, 500);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value)]);

  // Advanced JSON fallback toggle
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Safe area is rect by default; perspective requires JSON mode
  const isRect = value.safeArea.type === "rect";

  const update = <K extends keyof LocalSharpConfig>(key: K, val: LocalSharpConfig[K]) => {
    onChange({ ...value, [key]: val });
  };

  const updateSafeAreaRect = (patch: Partial<Omit<SafeAreaRect, "type">>) => {
    if (value.safeArea.type !== "rect") return; // ignore in perspective mode
    onChange({
      ...value,
      safeArea: { ...value.safeArea, ...patch },
    });
  };

  const updateBaseDim = (patch: Partial<{ w: number; h: number }>) => {
    onChange({
      ...value,
      baseDimensions: { ...value.baseDimensions, ...patch },
    });
  };

  const updateRecipe = (patch: Partial<LocalSharpConfig["recipe"]>) => {
    onChange({
      ...value,
      recipe: { ...value.recipe, ...patch },
    });
  };

  const onJsonModeToggle = () => {
    if (!jsonMode) {
      setJsonDraft(JSON.stringify(value, null, 2));
      setJsonMode(true);
    } else {
      setJsonMode(false);
      setJsonError(null);
    }
  };

  const onJsonApply = () => {
    setJsonError(null);
    try {
      const parsed = JSON.parse(jsonDraft) as LocalSharpConfig;
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Config object olmalı");
      }
      onChange(parsed);
      setJsonMode(false);
    } catch (e) {
      setJsonError((e as Error).message);
    }
  };

  // SVG safeArea overlay (rect normalize 0..1)
  const previewExists = validation?.summary?.baseAsset?.exists === true;
  const safeAreaSvgRect = useMemo(() => {
    if (!isRect) return null;
    const sa = value.safeArea as SafeAreaRect;
    return { x: sa.x * 100, y: sa.y * 100, w: sa.w * 100, h: sa.h * 100 };
  }, [isRect, value.safeArea]);

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-bg p-4">
      {/* Provider info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text">LOCAL_SHARP Config</h3>
          {/* Phase 63 — Self-hosted capability signal. Operator-facing
           *   confidence: this template ships through pure Sharp pipeline
           *   (no API calls, unlimited renders, perspective supported). */}
          <span
            className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-meta text-success"
            data-testid="local-sharp-capability-badge"
            title="Self-hosted Sharp compositor (no API calls, unlimited renders). Supports rect + perspective safeArea."
          >
            ✓ Self-hosted · rect + perspective
          </span>
        </div>
        <button
          type="button"
          onClick={onJsonModeToggle}
          className="text-xs text-text-muted hover:text-text"
        >
          {jsonMode ? "← Form moduna dön" : "Gelişmiş: JSON modunda düzenle →"}
        </button>
      </div>

      {jsonMode ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="jsonDraft" className="text-xs font-medium text-text-muted">
            Config (JSON)
          </label>
          <textarea
            id="jsonDraft"
            value={jsonDraft}
            onChange={(e) => setJsonDraft(e.target.value)}
            rows={14}
            className="rounded-md border border-border bg-surface p-3 font-mono text-xs text-text outline-none focus:border-accent"
          />
          {jsonError ? (
            <p className="text-xs text-danger" role="alert">
              {jsonError}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="primary" onClick={onJsonApply}>
              JSON&apos;u uygula
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* baseAssetKey upload */}
          <AssetUploadField
            value={value.baseAssetKey}
            onChange={(key, extra) => {
              const next = { ...value, baseAssetKey: key };
              if (extra?.width && extra.height) {
                next.baseDimensions = { w: extra.width, h: extra.height };
              }
              onChange(next);
            }}
            categoryId={categoryId}
            purpose="base"
            label="Base Asset"
            description="Mockup base image (frame, t-shirt body, vb.). Yüklenince boyutlar otomatik baseDimensions alanına yazılır."
          />

          {/* baseDimensions */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Base Dimensions (px)</label>
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Width</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={value.baseDimensions.w}
                  onChange={(e) => updateBaseDim({ w: Number(e.target.value) })}
                  className="h-control-md w-32 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-accent"
                />
              </div>
              <span className="text-text-muted">×</span>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Height</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={value.baseDimensions.h}
                  onChange={(e) => updateBaseDim({ h: Number(e.target.value) })}
                  className="h-control-md w-32 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* SafeArea — rect form (perspective JSON-only) */}
          {isRect ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text">
                Safe Area (rect, 0..1 normalize)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">x</span>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={(value.safeArea as SafeAreaRect).x}
                    onChange={(e) => updateSafeAreaRect({ x: Number(e.target.value) })}
                    className="h-control-md rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-accent"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">y</span>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={(value.safeArea as SafeAreaRect).y}
                    onChange={(e) => updateSafeAreaRect({ y: Number(e.target.value) })}
                    className="h-control-md rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-accent"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">width</span>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={(value.safeArea as SafeAreaRect).w}
                    onChange={(e) => updateSafeAreaRect({ w: Number(e.target.value) })}
                    className="h-control-md rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-accent"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">height</span>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={(value.safeArea as SafeAreaRect).h}
                    onChange={(e) => updateSafeAreaRect({ h: Number(e.target.value) })}
                    className="h-control-md rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-accent"
                  />
                </div>
              </div>
              <p className="text-xs text-text-muted">
                Tasarımın yerleşeceği alan. Tüm değerler 0..1 normalize (base asset&apos;e göre oran).
              </p>
            </div>
          ) : (
            <div
              className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-text"
              data-testid="local-sharp-perspective-hint"
            >
              Perspective safeArea form modunda düzenlenemiyor — JSON moduna
              geç.{" "}
              <span className="font-medium">
                Phase 63: 4-corner perspective transform self-hosted Sharp
                pipeline tarafından destekleniyor (no API calls).
              </span>
            </div>
          )}

          {/* Recipe blendMode */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="blendMode" className="text-sm font-medium text-text">
              Blend Mode
            </label>
            <select
              id="blendMode"
              value={value.recipe.blendMode}
              onChange={(e) =>
                updateRecipe({
                  blendMode: e.target.value as "normal" | "multiply" | "screen",
                })
              }
              className="h-control-md w-48 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-accent"
            >
              <option value="normal">Normal</option>
              <option value="multiply">Multiply</option>
              <option value="screen">Screen</option>
            </select>
            <p className="text-xs text-text-muted">
              Tasarım base asset üzerine nasıl bindirilecek. Frame için <code>normal</code>, t-shirt için <code>multiply</code> tipiktir.
            </p>
          </div>

          {/* coverPriority */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="coverPriority" className="text-sm font-medium text-text">
              Cover Priority (0-100)
            </label>
            <div className="flex items-center gap-3">
              <input
                id="coverPriority"
                type="range"
                min={0}
                max={100}
                step={1}
                value={value.coverPriority}
                onChange={(e) => update("coverPriority", Number(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={value.coverPriority}
                onChange={(e) => update("coverPriority", Number(e.target.value))}
                className="h-control-md w-20 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-accent"
              />
            </div>
            <p className="text-xs text-text-muted">
              Pack cover slot (packPosition=0) için seçim önceliği. Yüksek değer = cover&apos;a daha sık seçilir.
            </p>
          </div>
        </>
      )}

      {/* Validation panel */}
      <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-muted">Preview-ready durum:</span>
          {validateMutation.isPending ? (
            <span className="text-xs text-text-muted">kontrol ediliyor…</span>
          ) : validation === null ? (
            <span className="text-xs text-text-muted">
              baseAssetKey gir veya yükle
            </span>
          ) : validation.valid ? (
            <span className="text-xs font-medium text-success">✓ Hazır</span>
          ) : (
            <span className="text-xs font-medium text-danger">
              ✕ Sorun var ({validation.errors.length})
            </span>
          )}
        </div>

        {validation?.errors.length ? (
          <ul className="ml-4 list-disc text-xs text-danger">
            {validation.errors.map((e, i) => (
              <li key={i}>
                {e.path ? (
                  <span className="font-mono">{e.path}</span>
                ) : null}
                {e.path ? ": " : ""}
                {e.message}
              </li>
            ))}
          </ul>
        ) : null}

        {validation?.summary.baseAsset ? (
          <div className="text-xs text-text-muted">
            Base asset:{" "}
            {validation.summary.baseAsset.exists ? (
              <span className="text-success">
                ✓ {validation.summary.baseAsset.mimeType ?? "?"} ·{" "}
                {validation.summary.baseAsset.sizeBytes
                  ? `${Math.round(validation.summary.baseAsset.sizeBytes / 1024)}KB`
                  : "?"}
              </span>
            ) : (
              <span className="text-danger">storage&apos;da yok</span>
            )}
          </div>
        ) : null}
      </div>

      {/* Visual preview overlay (base asset signed URL + safeArea SVG) */}
      {previewExists && safeAreaSvgRect && value.baseAssetKey ? (
        <PreviewOverlay
          assetKey={value.baseAssetKey}
          rect={safeAreaSvgRect}
        />
      ) : null}
    </div>
  );
}

function PreviewOverlay({
  assetKey,
  rect,
}: {
  assetKey: string;
  rect: { x: number; y: number; w: number; h: number };
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/admin/mockup-templates/asset-url?key=${encodeURIComponent(assetKey)}`,
    )
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? "Could not load preview URL");
        }
        const d = (await r.json()) as { url: string };
        if (!cancelled) {
          setSignedUrl(d.url);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setSignedUrl(null);
          setError(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [assetKey]);

  if (error) {
    return (
      <p className="text-xs text-danger">Could not load preview URL: {error}</p>
    );
  }
  if (!signedUrl) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium text-text-muted">
        Preview (base asset + safeArea overlay)
      </div>
      <div className="relative inline-block max-w-md overflow-hidden rounded-md border border-border bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={signedUrl}
          alt="Base asset preview"
          className="block h-auto w-full"
        />
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute left-0 top-0 h-full w-full text-accent"
        >
          {/* fill/stroke = currentColor → Tailwind text-accent token'ından gelir */}
          <rect
            x={rect.x}
            y={rect.y}
            width={rect.w}
            height={rect.h}
            fill="currentColor"
            fillOpacity={0.15}
            stroke="currentColor"
            strokeOpacity={0.85}
            strokeWidth={0.5}
            strokeDasharray="1,1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <p className="text-xs text-text-muted">
        Bu preview gerçek render değil — sadece base asset + safeArea overlay (gerçek render Sharp pipeline ile job sırasında üretilir).
      </p>
    </div>
  );
}
