"use client";
/* eslint-disable no-restricted-syntax */
// File-level eslint-disable: Studio dark shell inline-style yoğun
// (MockupStudioSidebar / MockupStudioStage / FrameExportResultBanner
// aynı Phase 77+ pattern — `--ks-*` dark token CSS değişkenleri
// inline). Phase 109 larger-screen guard state'i de aynı konvansiyon.

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
import { MockupStudioStage } from "./MockupStudioStage";
import { cascadeLayoutFor } from "./cascade-layout";
import type { MediaPosition } from "./media-position";
import { ZOOM_DEFAULT } from "./zoom-bounds";
import { FrameExportResultBanner } from "./FrameExportResultBanner";
import { MockupStudioToolbar } from "./MockupStudioToolbar";
import {
  FRAME_ASPECT_CONFIG,
  type FrameAspectKey,
} from "./frame-aspects";
import {
  type BgEffectConfig,
  type LensBlurConfig,
  SCENE_AUTO,
  type SceneOverride,
} from "./frame-scene";
import {
  stageDeviceForProductType,
  studioDeviceLabel,
  studioPaletteForItem,
} from "./svg-art";
import type {
  StudioAppState,
  StudioKeptItem,
  StudioLayoutVariant,
  StudioMode,
  StudioSlotAssignmentMap,
  StudioSlotMeta,
} from "./types";

const SLOT_NAMES = ["Front View", "Side View", "Back View"];

/* Phase 131 — Canonical başlangıç/default preview-zoom değeri.
 *
 * Zoom'un gerçek initial state'i = sayfa ilk render'da `previewZoom`
 * state'inin başlangıç değeri (Phase 123 baseline `useState(100)`).
 * Reset butonu HARDCODED 100'e değil, bu canonical sabite döner —
 * default değişirse reset otomatik onu takip eder (tek kaynak).
 * Hem rail slider hem stage zoom-pill aynı Shell `previewZoom`
 * state'ini kullanır (zaten); reset de aynı state'i bu sabite çeker.
 * Kategori 2 preview-only helper (zoom export'a girmez §11.0).
 *
 * Phase 134 — Hardcoded 100 KALDIRILDI; shared `ZOOM_DEFAULT`
 * (zoom-bounds.ts) tek kaynak. Rail slider min/max, stage pill
 * clamp, reset, viewfinder math HEPSİ aynı modülden okur (min 75
 * / max 400 / default 100; "hidden eski değer" riski YOK). */
const DEFAULT_PREVIEW_ZOOM = ZOOM_DEFAULT;

/** Phase 137 — Effect Settings Flyout: ayarlı effect panel
 *  kimliği. Shell + Sidebar + EffectFlyout ortak (drift
 *  önleme — StudioMode/SceneOverride paylaşılan-tip pattern'i). */
export type EffectPanelKey = "lens" | "bgfx";

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
      /** Phase 109 — structured (target/intensity) veya legacy
       *  boolean; banner stale karşılaştırması normalizeLensBlur
       *  ile (Preview = Export Truth §11.0). */
      lensBlur?: boolean | LensBlurConfig;
      frameAspect: string;
      /** Phase 126 — canonical media-position (export anı; banner
       *  stale karşılaştırması epsilon ile). */
      mediaPosition?: MediaPosition;
      /** Phase 136 — BG Effects (export anı; banner stale
       *  karşılaştırması — §11.0). undefined = none. */
      bgEffect?: BgEffectConfig;
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

  /* Phase 114 — CANONICAL shared layout variant (unified studio
   * parameter). Right rail "Layout Presets" (Cascade/Centered/
   * Tilted/Stacked/Fan/Offset) Phase 96-113 boyunca NO-OP idi
   * (rail thumb highlight'tan ibaret; cascadeLayoutForRaw tek
   * hardcoded layout — Contract §6 sözü ile kod gerçeği ayrıştı,
   * Madde #12 sessiz drift). Phase 114: TEK Shell state. Operator
   * rail'de preset seçince buraya yazılır; Stage cascade + rail
   * thumb + Frame export payload HEPSİ bu tek değerden okur
   * (Preview = Export Truth §11.0 — final visual parameter, UI
   * helper DEĞİL). Default "cascade" = Phase 77-113 baseline
   * (regression koruması). Mode-AGNOSTIC (Mockup + Frame aynı). */
  const [layoutVariant, setLayoutVariant] =
    useState<StudioLayoutVariant>("cascade");

  /* Phase 123 — Preview-only zoom (rail-head Zoom slider).
   *
   * Phase 96-122 boyunca rail head'deki Zoom slider + Tilt/Precision
   * tab'ları NO-OP idi (browser kanıtı: slider/tab tıklamasından
   * önce/sonra plate birebir aynı). Operatör orta paneldeki
   * kompozisyonu yakınlaştırıp inceleyemiyordu (Shots.so preview-
   * inspection kontrolü eksik). Phase 123: Zoom slider canonical
   * Shell state'e bağlandı; yalnız ORTA PANEL plate'ine CSS scale
   * uygulanır. Bu canonical VISUAL parameter DEĞİL — Contract
   * kategori 2 (mode/UI-specific helper state): export'a girmez
   * (§11.0 Preview = Export Truth — zoom viewing aid), rail
   * candidate thumb'lara uygulanmaz (Phase 117-118 single-renderer
   * + chromeless baseline'ı bozulmaz). 100 = no-op (Phase 122
   * davranışı BİREBİR). DEFAULT_PREVIEW_ZOOM = canonical initial
   * state (reset butonu Phase 131 buna döner — hardcoded değil). */
  const [previewZoom, setPreviewZoom] = useState(DEFAULT_PREVIEW_ZOOM);

  /* Phase 126 — Global canonical media-position (Shots.so pad).
   *  Kategori 1 shared visual param (zoom'un AKSİNE: zoom kat 2
   *  preview-only). {0,0} = no-op (Phase 125 byte-identical).
   *  Preview + rail thumb + export hepsi bunu kullanır (tek
   *  resolveMediaOffsetPx). İleride per-slot override eklenir
   *  (slot.override ?? global) — bu turda global. */
  const [mediaPosition, setMediaPosition] = useState<MediaPosition>({
    x: 0,
    y: 0,
  });

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

  /* Phase 137 — Effect Settings Flyout: aktif secondary panel.
   *  Transient UI state (sceneOverride'a GİRMEZ). Exclusive —
   *  en fazla 1 flyout açık. null = kapalı. */
  const [activeEffectPanel, setActiveEffectPanel] =
    useState<EffectPanelKey | null>(null);

  /* Phase 137 — Mode değişiminde (Mockup↔Frame) flyout TAM
   *  kapanır: state null + flyout unmount (DOM'dan kalkar →
   *  içindeki Esc/dışarı-tık listener'ları + focus cleanup
   *  EffectFlyout useEffect return'ünde). Eski panel sızıntısı
   *  kalmaz (spec guardrail 6). */
  useEffect(() => {
    setActiveEffectPanel(null);
  }, [mode]);

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

  /* Phase 110 — 3-aşamalı responsive viewport (Shots.so canonical
   * davranış, browser+DOM ölçümüyle doğrulandı):
   *
   *   ≥ 1280px         → full (sidebar + stage + rail)
   *   880–1280px       → rail-collapse (sidebar + stage genişler;
   *                       rail gizli — Shots ~764-1200'de rail'i
   *                       gizleyip stage'i büyütür, eşik öncesi
   *                       usability korunur)
   *   < 880px / <640h  → larger-screen intercept (editor gizli,
   *                       sade Kivasy dark-shell-uyumlu state)
   *
   * Phase 109 tek-aşamalı idi (≥1100 full / <1100 intercept).
   * Shots.so live ölçümü 3-aşamalı kanıtladı: rail-collapse ara
   * aşaması dar viewport'ta studio'yu usable tutar (rail gizli,
   * stage o alanı kazanır). Phase 110 intercept eşiği 1100→880
   * çünkü rail-collapse ara aşaması artık 880-1280'de usable
   * studio sağlıyor. window dimensions plate-fit hesabına da
   * beslenir (aspect-locked plateDimensionsFor). Sözleşme §5. */
  const [viewport, setViewport] = useState<{
    w: number;
    h: number;
  }>({ w: 1440, h: 900 });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);
  const viewportTooSmall = viewport.w < 880 || viewport.h < 640;
  const railCollapsed = !viewportTooSmall && viewport.w < 1280;

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
          // Phase 113 — Stable slot→item identity (Sözleşme §11.0
          // slot assignment de Preview=Export Truth). realSlots
          // position-sorted dizilim canonical; export payload bunu
          // taşır (firstAssignedItemId fanout bug'ı kapatıldı).
          itemId,
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
      // Phase 114 — Export cascade preview ile AYNI layoutVariant'ı
      // kullanır (Preview = Export Truth §11.0; canonical shared
      // parameter). cascadeLayoutFor(kind, count, variant) — preview
      // MockupComposition/FrameComposition ile birebir slot
      // pozisyonları. Export "cascade" baseline + preview layoutVariant
      // ayrışması (Phase 114 öncesi) YASAK.
      const cascade = cascadeLayoutFor(deviceKind, layoutCount, layoutVariant);
      // Phase 113 — Slot→item identity zinciri (Sözleşme §11.0):
      //   1. operator override (slotAssignments — Phase 80) en güçlü
      //   2. slot'un DOĞAL item'ı (realSlots position-sorted dizilim;
      //      slot 0 → sorted[0], slot 1 → sorted[1], …) — preview ne
      //      çiziyorsa o
      //   3. firstAssignedItemId yalnız son çare (slot.design yoksa)
      // Eski kod adım 2'yi atlayıp doğrudan firstAssignedItemId'e
      // düşüyordu → operator override yokken (slotAssignments={})
      // 3 slot da items[0] alıyordu (export'ta 3 slot aynı item bug).
      const firstAssignedItemId = items[0]
        ? (items[0] as { id: string }).id
        : null;
      const slotsPayload = cascade.map((c) => {
        const slotIdx = c.si;
        const override = slotAssignments[slotIdx] ?? null;
        const slot = slots[slotIdx];
        const slotNaturalItemId = slot?.design?.itemId ?? null;
        const itemId = override ?? slotNaturalItemId ?? firstAssignedItemId ?? null;
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
        // Phase 136 — BG Effects → export payload (uçtan-uca;
        // undefined = none → server resolvePlateEffects no-op).
        bgEffect: sceneOverride.bgEffect,
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
          // Phase 126 — canonical global media-position (export parity).
          // previewZoom DELİBERATELY excluded (category-2 preview-only
          // helper — never reaches Sharp export; spec §11.0).
          mediaPosition,
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
          // Phase 126 — export anındaki canonical media-position
          // (banner stale: sonra pad sürülürse "re-export?").
          mediaPosition,
          // Phase 136 — export anındaki BG Effects (banner stale:
          // sonra vignette/grain değişirse "re-export?").
          bgEffect: sceneOverride.bgEffect,
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
    layoutVariant,
    // Phase 126 — mediaPosition deps'e ZORUNLU: yoksa
    // handleExportFrame stale closure ile eski mediaPosition'ı
    // export eder (Phase 124 zoom stale-closure emsali). Body'de
    // mediaPosition kullanılıyor → deps'te olmalı.
    mediaPosition,
  ]);

  /* Phase 99 — Export disabled gate. Frame mode'da bile assigned
   * slot yoksa export render edilmesinin anlamı yok. Set loading
   * durumunda da disabled. */
  const frameExportDisabled =
    setLoading ||
    !slots.some((s) => s.assigned) ||
    items.length === 0;

  /* Phase 109 — Larger-screen guard (Shots.so canonical: dar
   * viewport'ta broken editor gösterme; intercept screen).
   * Eşik altında studio shell render edilmez — sade, Kivasy
   * dark-shell-uyumlu "use a larger screen" state. Operatör için
   * dürüst: editor sığmıyor, bozuk değil. Yeni ürün yüzeyi DEĞİL
   * (Shell koşullu dal). Sözleşme §5 + §13. */
  if (viewportTooSmall) {
    return (
      <div
        className="k-studio"
        data-testid="studio-shell"
        data-mode={mode}
        data-viewport-too-small="true"
        style={{
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div
          data-testid="studio-larger-screen-state"
          style={{
            maxWidth: 360,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}
        >
          <svg
            width={48}
            height={48}
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--ks-or)"
            strokeWidth={1.5}
            aria-hidden
          >
            <rect x={2} y={4} width={20} height={13} rx={2} />
            <path d="M8 21h8M12 17v4" />
          </svg>
          <div
            style={{
              color: "var(--ks-t1)",
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            Mockup Studio needs a larger screen
          </div>
          <div
            style={{
              color: "var(--ks-t2)",
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            The studio canvas and side panel need at least an
            880×640 viewport. Open this on a wider window or
            larger display to compose mockups.
          </div>
          <a
            href={`/selections/${setId}`}
            data-testid="studio-larger-screen-back"
            style={{
              marginTop: 6,
              color: "var(--ks-or-bright)",
              fontSize: 12.5,
              textDecoration: "none",
              borderBottom: "1px solid var(--ks-orb)",
              paddingBottom: 1,
            }}
          >
            Back to selection
          </a>
        </div>
      </div>
    );
  }

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
      data-layout-variant={layoutVariant}
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
          activeEffectPanel={activeEffectPanel}
          onOpenEffectPanel={setActiveEffectPanel}
          onCloseEffectPanel={() => setActiveEffectPanel(null)}
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
          layoutVariant={layoutVariant}
          viewportW={viewport.w}
          viewportH={viewport.h}
          railCollapsed={railCollapsed}
          previewZoom={previewZoom / 100}
          previewZoomPct={previewZoom}
          onChangePreviewZoom={setPreviewZoom}
          mediaPosition={mediaPosition}
        />
        {/* Phase 110 — Rail-collapse ara aşaması (Shots.so canonical):
         *  880–1280px'te sağ rail gizli, stage o alanı kazanır.
         *  ≥1280px'te full. Mockup studio shell bozulmaz —
         *  rail conditional render, layout flex devam eder. */}
        {!railCollapsed ? (
          <MockupStudioPresetRail
            mode={mode}
            appState={appState}
            activePalette={activePalette}
            sceneOverride={sceneOverride}
            layoutCount={layoutCount}
            onChangeLayoutCount={setLayoutCount}
            layoutVariant={layoutVariant}
            onChangeLayoutVariant={setLayoutVariant}
            deviceShape={deviceKind}
            slots={slots}
            frameAspect={frameAspect}
            previewZoom={previewZoom}
            onChangePreviewZoom={setPreviewZoom}
            defaultPreviewZoom={DEFAULT_PREVIEW_ZOOM}
            onResetPreviewZoom={() =>
              setPreviewZoom(DEFAULT_PREVIEW_ZOOM)
            }
            mediaPosition={mediaPosition}
            onChangeMediaPosition={setMediaPosition}
          />
        ) : null}
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
            // Phase 126 — şu anki canonical media-position; export
            // snapshot'tan epsilon farklıysa banner stale gösterir.
            mediaPosition,
            // Phase 136 — şu anki BG Effects; export snapshot'tan
            // farklıysa banner stale gösterir (§11.0).
            bgEffect: sceneOverride.bgEffect,
          }}
          onClose={() => setFrameExportResult(null)}
          onReexport={handleExportFrame}
          isExporting={isExportingFrame}
        />
      ) : null}
    </div>
  );
}
