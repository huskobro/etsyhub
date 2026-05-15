"use client";

/* Phase 77 — Studio shell composer.
 * Phase 79 — Real selection set + template hydrate + render dispatch.
 *
 * Phase 77 baseline yalnız UI state'leri taşıyordu (sample WORKING_SLOTS
 * hardcoded). Phase 79 ile shell gerçek ürün davranışlarına bağlandı:
 *
 *   - `useSelectionSet(setId)` ile operatörün gerçek SelectionSet detayı
 *     (items[] + sourceAsset/editedAsset meta) hydrate edilir.
 *   - Slot pills + stage cascade ilk 3 item üzerinden gerçek label +
 *     deterministik renk üretir (raw asset URL Phase 80+).
 *   - `useMockupTemplates({ categoryId })` ile gerçek template katalog
 *     yüklenir; ilk ACTIVE template otomatik seçilir (selectedTemplateId
 *     state). Toolbar template pill bu template'in adını gösterir.
 *   - Toolbar Render butonu + Stage `Create Mockup` CTA artık gerçek
 *     `POST /api/mockup/jobs` çağrısı yapar; başarılı dispatch sonrası
 *     `/selection/sets/[setId]/mockup/jobs/[jobId]` (S7) yüzeyine
 *     redirect olur. Hata durumunda appState `working`'e döner +
 *     toolbar'da inline error mesajı.
 *   - Frame mode "Coming soon" honest disclosure ile çerçevelendi —
 *     gerçek output authoring Phase 80+ candidate (export pipeline +
 *     bounded canvas background composite).
 *
 * Studio route entry: `/selection/sets/[setId]/mockup/studio`.
 * Apply route ve admin yüzeyleri intakt.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "./studio.css";
import { useSelectionSet } from "@/features/selection/queries";
import { useMockupTemplates } from "@/features/mockups/hooks/useMockupTemplates";
import { MockupStudioPresetRail } from "./MockupStudioPresetRail";
import { MockupStudioSidebar } from "./MockupStudioSidebar";
import { MockupStudioStage, cascadeLayoutFor } from "./MockupStudioStage";
import { FrameExportResultBanner } from "./FrameExportResultBanner";
import { MockupStudioToolbar } from "./MockupStudioToolbar";
import {
  FRAME_ASPECT_CONFIG,
  type FrameAspectKey,
} from "./frame-aspects";
import { SCENE_AUTO, type SceneOverride } from "./frame-scene";
import {
  stageDeviceForProductType,
  studioDeviceLabel,
  studioPaletteForItem,
} from "./svg-art";
import type {
  StudioAppState,
  StudioKeptItem,
  StudioMode,
  StudioSlotAssignmentMap,
  StudioSlotMeta,
} from "./types";

const SLOT_NAMES = ["Front View", "Side View", "Back View"];

export interface MockupStudioShellProps {
  /**
   * Selection set id this studio session is anchored on. Phase 79'da
   * gerçek hydrate için React Query hook'una geçilir; SSR ownership
   * check page'de zaten yapıldı (cross-user 404).
   */
  setId: string;
  /** Operator-friendly set name; toolbar template pill'inde gösterilir. */
  setName?: string | null;
}

export function MockupStudioShell({ setId, setName }: MockupStudioShellProps) {
  const router = useRouter();
  const [mode, setMode] = useState<StudioMode>("mockup");
  const [appState, setAppState] = useState<StudioAppState>("working");
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);

  /* Phase 99 — Frame export state (sözleşme #11 + #13.C fulfilled).
   *
   * Operator Frame mode'da Export · 1× · PNG capsule tıklayınca POST
   * /api/frame/export'a Shell state (sceneOverride + frameAspect +
   * slots + layoutCount + deviceKind) ile dispatch eder. Preview ↔
   * export aynı kaynak — operator preview'da gördüğü kompozisyonu
   * birebir export'ta görür (Sözleşme #1 + #11).
   *
   * Result panel inline: signed download URL + sizeBytes + dims +
   * "Open" + "Download" CTA'ları. Persistence (FrameExport history)
   * Phase 100+ candidate; bu turun çekirdeği stateless render. */
  const [isExportingFrame, setIsExportingFrame] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [frameExportResult, setFrameExportResult] = useState<{
    downloadUrl: string;
    storageKey: string;
    width: number;
    height: number;
    sizeBytes: number;
    exportId: string;
    durationMs: number;
    /** Phase 100 — FrameExport row id (persistence). null ise persist
     *  başarısız oldu (banner Send to Product CTA disable edilir). */
    frameExportId: string | null;
    /** Hangi sceneMode + glassVariant + lensBlur ile üretildi —
     *  operator için "şu an gördüğüm preview bu PNG mi?" sinyali
     *  (state değişirse banner stale işareti gösterir). */
    sceneSnapshot: {
      mode: string;
      glassVariant?: string;
      lensBlur?: boolean;
      frameAspect: string;
    };
  } | null>(null);
  /* Phase 83 — Frame mode aspect ratio (presentation surface).
   * Default 16:9 (Phase 82 baseline canvas dims paritesi). Operator
   * chip click → aspect değişir → Stage canvas dims + caption live
   * update + Toolbar status badge gerçek dims gösterir. */
  const [frameAspect, setFrameAspect] = useState<FrameAspectKey>("16:9");
  /* Phase 96 — Layout count Shell state (Shots.so canonical 1/2/3
   * count layout parity). Phase 77 baseline'da count rail head'de
   * LOCAL state'ti — stage'e veya thumb'lara yansımıyordu (kullanıcı
   * bug #13). Shots.so'da rail head 1/2/3 buttons rail thumb'ları
   * gerçekten değiştirir (1-device variations / 2-device variations
   * / 3-device variations); stage cascade item count'unu sınırlar.
   * Phase 96'da Shell-level state; rail head buttons → Shell setter;
   * rail thumb'larda displayCount prop ile cascade item N ile sınırlı;
   * stage MockupComposition/FrameComposition aynı limit'i uygular. */
  const [layoutCount, setLayoutCount] = useState<1 | 2 | 3>(3);

  /* Phase 89 — Frame mode scene control override state.
   *
   * Shots.so real browser araştırması: Frame mode'da operator
   * Solid/Gradient swatch tıklayınca stage scene surface override
   * oluyor; Mockup mode'a geçince scene KORUNUYOR ama controls
   * görünmüyor. State'i Shell'de tutmak iki gereksinimi karşılar:
   *   - Mode geçişinde scene continuity (state preserved)
   *   - Sağ rail preset thumbs scene-aware bg (Stage'le aynı state)
   *
   * Default "auto" mode Phase 88 baseline'a düşer (asset-aware
   * subtle ambient). Operator Solid/Gradient swatch tıklayınca
   * override aktif olur. */
  const [sceneOverride, setSceneOverride] = useState<SceneOverride>(
    SCENE_AUTO,
  );

  // Phase 79 — Real selection set hydrate.
  const { data: set, isLoading: setLoading } = useSelectionSet(setId);

  // Phase 79 — Real category resolve (V2 multi-category baseline parity:
  // S3ApplyView.tsx:40 ile aynı pattern).
  const items = set?.items ?? [];
  const categoryId =
    (items[0] as { productTypeKey?: string | null } | undefined)
      ?.productTypeKey ?? "canvas";

  // Phase 79 — Real template katalog hydrate.
  const { data: templates = [], isLoading: templatesLoading } =
    useMockupTemplates({ categoryId });

  // İlk ACTIVE binding'i olan template'i otomatik seç. Operatör daha sonra
  // template card'tan farklı template seçebilir (Phase 80+ picker drawer).
  const defaultTemplateId = useMemo(() => {
    const withBinding = templates.find((t) => t.hasActiveBinding);
    return withBinding?.id ?? templates[0]?.id ?? null;
  }, [templates]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const activeTemplateId = selectedTemplateId ?? defaultTemplateId;
  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === activeTemplateId) ?? null,
    [templates, activeTemplateId],
  );

  /* Phase 80 — Slot-mapped assignment state (canonical Studio truth).
   * Phase 76 SlotAssignmentPanel parity ama Studio sidebar-native:
   * slot index → kept item id, `null` (veya eksik key) = fanout fallback.
   * Render dispatch body bu mapping'i opsiyonel `slotAssignments`
   * field'ında taşır; backend Phase 81+ pack-selection override için
   * tüketir (Phase 80 baseline'da yalnız UI canonical + dispatch
   * audit'inde görünür). */
  const [slotAssignments, setSlotAssignments] =
    useState<StudioSlotAssignmentMap>({});

  /* Phase 80 — Kept items (selection set'in items[]'inden türev) Studio
   * sidebar slot picker dropdown'una verilir. Phase 76 panel
   * `SlotAssignmentKeptItem` parity. */
  /* Phase 98 — Real asset signed URL hydrate state (Sözleşme #9).
   *
   * Selection set hydrate sourceAsset.id verir; Shell bunu
   * /api/assets/[id]/signed-url üzerinden lazy fetch eder ve
   * mevcut placeholder palette üstüne gerçek image URL'i ekler.
   * Operator için Studio artık gerçek görseliyle çalışıyor —
   * placeholder fallback yalnız fetch failed durumunda. */
  const [assetSignedUrls, setAssetSignedUrls] = useState<
    Record<string, string | null>
  >({});

  const keptItems: StudioKeptItem[] = useMemo(() => {
    if (!items.length) return [];
    return items
      .slice()
      .sort(
        (a, b) =>
          (a as { position?: number }).position! -
          (b as { position?: number }).position!,
      )
      .map((item, idx) => {
        const itemId = (item as { id: string }).id;
        const sourceAsset = (
          item as {
            sourceAsset?: {
              id?: string | null;
              width?: number | null;
              height?: number | null;
            } | null;
          }
        ).sourceAsset;
        const dims =
          sourceAsset?.width && sourceAsset?.height
            ? `${sourceAsset.width}×${sourceAsset.height}`
            : "—";
        const sourceAssetId = sourceAsset?.id ?? null;
        const imageUrl = sourceAssetId
          ? (assetSignedUrls[sourceAssetId] ?? undefined)
          : undefined;
        return {
          id: itemId,
          label: `Item ${idx + 1} · ${itemId.slice(0, 8)}`,
          colors: studioPaletteForItem(itemId),
          dims,
          sourceAssetId,
          imageUrl,
        };
      });
  }, [items, assetSignedUrls]);

  /* Phase 98 — Lazy signed URL fetch for selection set assets.
   *
   * Operator Studio'ya girer girmez set.items[].sourceAsset.id'leri
   * /api/assets/[id]/signed-url ile çevirir, state'e doldurur.
   * useMemo bu state'i izleyerek keptItems + slots'a imageUrl yansıtır.
   * Fetch hata verirse null kaydedilir (operator için "asset yüklenemedi"
   * sinyali — placeholder palette korunur). */
  useEffect(() => {
    if (!items.length) return;
    const assetIds = items
      .map(
        (item) =>
          (
            item as {
              sourceAsset?: { id?: string | null } | null;
            }
          ).sourceAsset?.id ?? null,
      )
      .filter((x): x is string => typeof x === "string" && x.length > 0);
    const toFetch = assetIds.filter((id) => !(id in assetSignedUrls));
    if (toFetch.length === 0) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string | null> = {};
      await Promise.all(
        toFetch.map(async (id) => {
          try {
            const res = await fetch(`/api/assets/${id}/signed-url`, {
              method: "GET",
              credentials: "include",
            });
            if (!res.ok) {
              next[id] = null;
              return;
            }
            const json = (await res.json()) as { url?: string };
            next[id] = json.url ?? null;
          } catch {
            next[id] = null;
          }
        }),
      );
      if (!cancelled && Object.keys(next).length > 0) {
        setAssetSignedUrls((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items, assetSignedUrls]);

  // Phase 79 — Slot meta'yı items'tan türet. Final HTML 3-slot cascade
  // (Front/Side/Back View) baseline'ını koruyoruz; gerçek item sayısı
  // 3'ten azsa kalan slot'lar boş kalır, 3'ten fazlaysa ilk 3 görünür
  // (Phase 80+ candidate: multi-slot template + slot count > 3 desteği).
  const realSlots: ReadonlyArray<StudioSlotMeta> = useMemo(() => {
    if (!set) {
      // No data yet — fall back to empty placeholder slot list (operatör
      // loading state'i görür ama shell collapse olmaz).
      return [
        { id: 1, name: SLOT_NAMES[0]!, assigned: false, design: null },
        { id: 2, name: SLOT_NAMES[1]!, assigned: false, design: null },
        { id: 3, name: SLOT_NAMES[2]!, assigned: false, design: null },
      ];
    }

    const sorted = items
      .slice()
      .sort(
        (a, b) =>
          (a as { position?: number }).position! -
          (b as { position?: number }).position!,
      );

    return [0, 1, 2].map((i) => {
      const item = sorted[i];
      if (!item) {
        return {
          id: i + 1,
          name: SLOT_NAMES[i]!,
          assigned: false,
          design: null,
        };
      }
      const itemId = (item as { id: string }).id;
      const colors = studioPaletteForItem(itemId);
      const sourceAsset = (
        item as {
          sourceAsset?: {
            id?: string | null;
            width?: number | null;
            height?: number | null;
          } | null;
        }
      ).sourceAsset;
      const dims =
        sourceAsset?.width && sourceAsset?.height
          ? `${sourceAsset.width}×${sourceAsset.height}`
          : "—";
      /* Phase 98 — Real asset signed URL hydrate (Sözleşme #9).
       *
       * `sourceAsset.id` Shell signed URL fetch'iyle resolve edilir
       * (yukarıdaki useEffect). Mevcut placeholder palette korunur
       * (fetch failed veya henüz yüklenmedi durumunda fallback).
       * StageDeviceSVG bu imageUrl'i alınca gerçek `<image>` SVG
       * element olarak render eder (Phase 98 svg-art.tsx). */
      const imageUrl = sourceAsset?.id
        ? (assetSignedUrls[sourceAsset.id] ?? undefined)
        : undefined;
      return {
        id: i + 1,
        name: SLOT_NAMES[i]!,
        assigned: true,
        design: {
          name: `Item ${i + 1} · ${itemId.slice(0, 8)}`,
          dims,
          colors,
          imageUrl,
        },
      };
    });
  }, [set, items, assetSignedUrls]);

  // appState === "empty" zorunlu boş — operatör state switcher'dan açıkça
  // istemiş demek; gerçek items varsa yine empty davranışı korunur (Phase
  // 77 dev sw parity).
  const slots: ReadonlyArray<StudioSlotMeta> =
    appState === "empty"
      ? realSlots.map((s) => ({
          ...s,
          assigned: false,
          design: null,
        }))
      : realSlots;

  // Phase 79 — Real render dispatch.
  // Phase 80 — Body opsiyonel `slotAssignments` taşır. Backend Zod
  // schema'sı strict değil (mevcut `CreateJobBodySchema` extra field
  // reddetmez; Zod default behavior); şu an audit/log seviyesinde
  // canlı. Phase 81+ pack-selection override için tüketilir.
  const handleRender = useCallback(async () => {
    if (!activeTemplateId) {
      setRenderError("No template selected");
      return;
    }
    setRenderError(null);
    setAppState("render");
    try {
      // Phase 80 — Slot-mapped body. Boş `{}` veya all-null durumda
      // backend baseline fanout (Phase 8 pack-selection). Operator
      // override varsa key/value paritesi: slotIndex → keptItemId.
      const slotAssignmentsBody: Record<string, string> = {};
      for (const [k, v] of Object.entries(slotAssignments)) {
        if (v) slotAssignmentsBody[k] = v;
      }
      const res = await fetch("/api/mockup/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setId,
          categoryId,
          templateIds: [activeTemplateId],
          ...(Object.keys(slotAssignmentsBody).length > 0
            ? { slotAssignments: slotAssignmentsBody }
            : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          body?.error ?? body?.message ?? `HTTP ${res.status}`;
        throw new Error(message);
      }
      const { jobId } = (await res.json()) as { jobId: string };
      router.push(`/selection/sets/${setId}/mockup/jobs/${jobId}`);
    } catch (err) {
      setAppState("working");
      setRenderError(err instanceof Error ? err.message : "Render failed");
    }
  }, [setId, categoryId, activeTemplateId, router, slotAssignments]);

  const backHref = `/selections/${setId}`;
  /* Phase 82 — productType-aware stage device. Shell `categoryId`
   * zaten resolve ediyor (`items[0].productTypeKey ?? "canvas"`);
   * Stage'e geçirilen `deviceKind` o key'i shape ailesine map eder
   * (wall_art frame, sticker die-cut, bookmark strip, tshirt
   * silhouette vb.). Bilinmeyen key → phone fallback. */
  const deviceKind = stageDeviceForProductType(categoryId);
  const deviceLabel = studioDeviceLabel(deviceKind);
  /* Phase 83 — Frame mode template pill ve status badge artık
   * aspect ratio config'inden besleniyor. Operator hangi aspect'i
   * seçtiyse template pill ona göre etiketleniyor; status badge
   * gerçek output dims taşıyor (1080×1080 vb.) — Phase 82'deki
   * stale "Export Phase 82+" placeholder yerine. */
  const frameAspectCfg = FRAME_ASPECT_CONFIG[frameAspect];
  const templateLabel =
    mode === "frame"
      ? `Frame · ${frameAspectCfg.deliverable}`
      : (activeTemplate?.name ||
          (setLoading || templatesLoading ? "Loading…" : "No template"));
  const statusLabel =
    mode === "frame"
      ? `${frameAspectCfg.outputW}×${frameAspectCfg.outputH}`
      : deviceKind !== "phone"
        ? deviceLabel
        : (set?.name?.trim() || setName?.trim() || "Set");

  /* Phase 86 — Active palette for asset-aware decision surfaces.
   *
   * Shots.so canlı browser araştırması: operator yüklediği asset'i
   * değiştirdiğinde sağ rail preset thumbnails + Magic Preset thumb
   * + rail head live thumb hepsi o asset'in renkleriyle yeniden
   * render oluyor. Rail artık statik decoration değil, gerçek
   * karar destek yüzeyi.
   *
   * Bizde: selected slot assigned ise onun design.colors palette'i
   * Sidebar (Magic Preset) + PresetRail (Mockup/Frame preset
   * thumbnails) + Rail head live thumb'a iner. Hiç assigned slot
   * yoksa undefined (preset thumbs Phase 77 baseline statik dark
   * rendering + Magic Preset thumb k-orange fallback).
   *
   * Phase 93 — Selection-stable plate bg (Shots.so parity bugfix):
   * Phase 86-92'de activePalette = selectedSlot.design.colors idi;
   * her slot click plate bg'i değiştiriyordu — kullanıcı bug #3
   * "Front/Side/Back arasında geçince arka planda farklılık".
   * Shots.so'da slot tıklamak plate bg'sini değiştirmez (plate
   * scene'i operator-driven via Magic Preset / Frame swatch
   * controls, slot selection-stable). Phase 93'te activePalette
   * = İLK assigned slot'un palette'i (selection-stable) —
   * operator slot'lar arasında geçince plate stable kalır. */
  const activePalette = (() => {
    const firstAssigned = slots.find((s) => s.assigned && s.design);
    return firstAssigned?.design?.colors;
  })();

  /* Phase 99 — Frame export dispatcher.
   *
   * Operator Frame mode'da Export capsule tıklayınca:
   *   1. cascadeLayoutFor ile preview ile aynı slot pozisyonlarını
   *      hesapla (deviceKind + layoutCount).
   *   2. Her slot için itemId resolve et (slotAssignments override
   *      varsa onu kullan, yoksa fanout fallback = primary item).
   *   3. POST /api/frame/export — Shell state + slot positions body.
   *   4. Result panel inline gösterir (signed download URL + dims).
   *
   * Preview ↔ export aynı kaynak (sözleşme #1 + #11):
   *   - frameAspect (Shell SHARED state)
   *   - sceneOverride (Shell state)
   *   - layoutCount (Shell state)
   *   - deviceKind (productType-aware)
   *   - slotAssignments (Phase 80 operator override)
   *   - activePalette (selection set hydrate)
   *
   * Backend Sharp pipeline output dims (aspect-aware) + plate bg +
   * real asset MinIO buffer'larını compose eder; signed download
   * URL ile operator-facing PNG döner. */
  const handleExportFrame = useCallback(async () => {
    if (mode !== "frame") return;
    if (isExportingFrame) return;
    setExportError(null);
    setIsExportingFrame(true);
    try {
      const cascade = cascadeLayoutFor(deviceKind, layoutCount);
      const firstAssignedItemId = items[0]
        ? (items[0] as { id: string }).id
        : null;
      const slotsPayload = cascade.map((c) => {
        const slotIdx = c.si;
        const override = slotAssignments[slotIdx] ?? null;
        const slot = slots[slotIdx];
        const itemId = override ?? firstAssignedItemId ?? null;
        const assigned = !!slot?.assigned && !!itemId;
        return {
          slotIndex: slotIdx,
          assigned,
          itemId,
          x: c.x,
          y: c.y,
          w: c.w,
          h: c.h,
          r: c.r,
          z: c.z,
        };
      });

      const sceneBody = {
        mode: sceneOverride.mode,
        color: sceneOverride.color,
        colorTo: sceneOverride.colorTo,
        glassVariant: sceneOverride.glassVariant,
        lensBlur: sceneOverride.lensBlur,
        palette: activePalette ?? null,
      };

      // Phase 105/106 — productType-aware device shape (preview
      // StageDeviceSVG parity). deviceKind (stageDeviceForProductType)
      // → compositor shape ailesi. Server'da resolveDeviceShape ile
      // aynı mapping; burada client-local inline (client/server
      // boundary: compositor server-only). Preview hangi StageDeviceSVG
      // shape'i çiziyorsa export aynı shape ailesinden gelir (§11.0).
      // Phase 108 — hoodie → "garment-hooded" (preview
      // TshirtSilhouetteSVG hooded ellipse parity, svg-art.tsx:1095).
      // tshirt/dtf hood YOK → "garment".
      const deviceShape:
        | "frame"
        | "sticker"
        | "bezel"
        | "bookmark"
        | "garment"
        | "garment-hooded" =
        deviceKind === "wall_art" ||
        deviceKind === "canvas" ||
        deviceKind === "printable"
          ? "frame"
          : deviceKind === "phone"
            ? "bezel"
            : deviceKind === "bookmark"
              ? "bookmark"
              : deviceKind === "hoodie"
                ? "garment-hooded"
                : deviceKind === "tshirt" || deviceKind === "dtf"
                  ? "garment"
                  : "sticker";

      const res = await fetch("/api/frame/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setId,
          frameAspect,
          scene: sceneBody,
          slots: slotsPayload,
          stageInnerW: 572,
          stageInnerH: 504,
          deviceShape,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          (body as { error?: string; message?: string }).error ??
          (body as { error?: string; message?: string }).message ??
          `HTTP ${res.status}`;
        throw new Error(message);
      }
      const result = (await res.json()) as {
        downloadUrl: string;
        storageKey: string;
        width: number;
        height: number;
        sizeBytes: number;
        exportId: string;
        durationMs: number;
        /** Phase 100 — FrameExport row id (null ise persist hata). */
        frameExportId: string | null;
      };
      setFrameExportResult({
        ...result,
        frameExportId: result.frameExportId ?? null,
        sceneSnapshot: {
          mode: sceneOverride.mode,
          glassVariant: sceneOverride.glassVariant,
          lensBlur: sceneOverride.lensBlur,
          frameAspect,
        },
      });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExportingFrame(false);
    }
  }, [
    mode,
    isExportingFrame,
    deviceKind,
    layoutCount,
    slots,
    slotAssignments,
    items,
    setId,
    frameAspect,
    sceneOverride,
    activePalette,
  ]);

  /* Phase 99 — Export disabled gate. Frame mode'da bile assigned
   * slot yoksa export render edilmesinin anlamı yok. Set loading
   * durumunda da disabled. */
  const frameExportDisabled =
    setLoading ||
    !slots.some((s) => s.assigned) ||
    items.length === 0;

  return (
    <div
      className="k-studio"
      data-testid="studio-shell"
      data-mode={mode}
      data-set-id={setId}
      data-template-id={activeTemplateId ?? ""}
      data-item-count={items.length}
      data-device-kind={deviceKind}
      data-category-id={categoryId}
      data-frame-aspect={frameAspect}
      data-layout-count={layoutCount}
      data-slot-assignment-count={
        Object.values(slotAssignments).filter(Boolean).length
      }
      data-kept-item-count={keptItems.length}
      data-active-palette={activePalette ? activePalette.join(",") : ""}
      data-scene-mode={sceneOverride.mode}
      data-scene-color={sceneOverride.color ?? ""}
      data-scene-color-to={sceneOverride.colorTo ?? ""}
    >
      <MockupStudioToolbar
        mode={mode}
        appState={appState}
        setAppState={setAppState}
        templateLabel={templateLabel}
        statusLabel={statusLabel}
        backHref={backHref}
        onRender={handleRender}
        renderDisabled={
          !activeTemplateId || setLoading || templatesLoading || mode === "frame"
        }
        renderError={renderError}
        onExportFrame={handleExportFrame}
        exportDisabled={frameExportDisabled}
        isExporting={isExportingFrame}
        exportError={exportError}
      />
      <div className="k-studio__body">
        <MockupStudioSidebar
          mode={mode}
          setMode={setMode}
          slots={slots}
          selectedSlot={selectedSlot}
          setSelectedSlot={setSelectedSlot}
          templateName={activeTemplate?.name ?? null}
          templateSlotCount={activeTemplate?.slotCount ?? 1}
          keptItems={keptItems}
          slotAssignments={slotAssignments}
          onChangeSlotAssignments={setSlotAssignments}
          frameAspect={frameAspect}
          onChangeFrameAspect={setFrameAspect}
          activePalette={activePalette}
          sceneOverride={sceneOverride}
          onChangeSceneOverride={setSceneOverride}
        />
        <MockupStudioStage
          mode={mode}
          slots={slots}
          selectedSlot={selectedSlot}
          setSelectedSlot={setSelectedSlot}
          appState={appState}
          setAppState={setAppState}
          onCreateMockup={handleRender}
          deviceKind={deviceKind}
          frameAspect={frameAspect}
          activePalette={activePalette}
          sceneOverride={sceneOverride}
          layoutCount={layoutCount}
        />
        <MockupStudioPresetRail
          mode={mode}
          appState={appState}
          activePalette={activePalette}
          sceneOverride={sceneOverride}
          layoutCount={layoutCount}
          onChangeLayoutCount={setLayoutCount}
        />
      </div>
      {/* Phase 94 — Dev/demo state switcher kaldırıldı (bug #19). */}
      {/* Phase 99 — Frame export result panel (inline, bottom-center).
       *
       * Sözleşme #11 + #13.C fulfilled: operator Frame mode'da Export
       * tıkladıktan sonra gerçek MinIO PNG signed download URL'i bu
       * banner'da görür. Mode-aware: yalnız Frame mode'da görünür (Mockup
       * mode'da Render dispatch S7/S8 result view'a iner, ayrı surface).
       *
       * Result panel:
       *   - Dims + size + duration (operator visibility)
       *   - Preview thumbnail (signed URL ile real PNG)
       *   - "Open" (new tab) + "Download" (download attribute) + "Close"
       *   - Scene snapshot drift indicator: snapshot ile şu anki state
       *     farklıysa "Preview changed — re-export?" caption (operator
       *     için "bu PNG güncel mi?" sinyali; sözleşme #12 silent magic
       *     yasağı uyumu). */}
      {mode === "frame" && frameExportResult ? (
        <FrameExportResultBanner
          result={frameExportResult}
          currentSceneSnapshot={{
            mode: sceneOverride.mode,
            glassVariant: sceneOverride.glassVariant,
            lensBlur: sceneOverride.lensBlur,
            frameAspect,
          }}
          onClose={() => setFrameExportResult(null)}
          onReexport={handleExportFrame}
          isExporting={isExportingFrame}
        />
      ) : null}
    </div>
  );
}
