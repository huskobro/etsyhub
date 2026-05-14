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

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "./studio.css";
import { useSelectionSet } from "@/features/selection/queries";
import { useMockupTemplates } from "@/features/mockups/hooks/useMockupTemplates";
import { MockupStudioPresetRail } from "./MockupStudioPresetRail";
import { MockupStudioSidebar } from "./MockupStudioSidebar";
import { MockupStudioStage } from "./MockupStudioStage";
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
          item as { sourceAsset?: { width?: number | null; height?: number | null } | null }
        ).sourceAsset;
        const dims =
          sourceAsset?.width && sourceAsset?.height
            ? `${sourceAsset.width}×${sourceAsset.height}`
            : "—";
        return {
          id: itemId,
          label: `Item ${idx + 1} · ${itemId.slice(0, 8)}`,
          colors: studioPaletteForItem(itemId),
          dims,
        };
      });
  }, [items]);

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
        item as { sourceAsset?: { width?: number | null; height?: number | null } | null }
      ).sourceAsset;
      const dims =
        sourceAsset?.width && sourceAsset?.height
          ? `${sourceAsset.width}×${sourceAsset.height}`
          : "—";
      return {
        id: i + 1,
        name: SLOT_NAMES[i]!,
        assigned: true,
        design: {
          name: `Item ${i + 1} · ${itemId.slice(0, 8)}`,
          dims,
          colors,
        },
      };
    });
  }, [set, items]);

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
      {/* Phase 94 — Dev/demo state switcher kaldırıldı (bug #19).
       *  Phase 77 baseline'da operatör görsel state'leri test etmek
       *  için sağ alt overlay vardı (MODE + STATE chip'leri); Phase 79
       *  gerçek render dispatch bağlandığında dev-only oldu. Shots.so'da
       *  bu yok ve operator-facing surface'i kirletiyordu — kaldırıldı.
       *  Mode switch artık sadece sidebar tab'ları (k-studio__sb-tabs)
       *  üzerinden yapılır; state switch gerçek render lifecycle'a
       *  bağlı (toolbar Render → POST /api/mockup/jobs → S7/S8). */}
    </div>
  );
}
