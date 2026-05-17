"use client";
/* eslint-disable no-restricted-syntax */

/* Phase 77 — Studio sidebar (mode-aware).
 *
 * Final HTML SidebarShell pattern paritesi:
 *   - Üstte Mockup / Frame tabs
 *   - Mockup mode: template card + magic preset + media + style tiles
 *     + border + shadow + visibility footer + slot pills
 *   - Frame mode: frame selector + effects + scene + background +
 *     magic / solid / gradient / glass
 *   - Bottom (Mockup only): slot pills footer
 *
 * Phase 77 scope: shell + visible state. Controls dummy/soft tutar
 * (state local; backend wiring Phase 78+).
 *
 * File-level eslint-disable rationale: studio shell port'u final HTML
 * mockup'tan geliyor; tile button gridleri, gradient swatches ve
 * tone-aware inline visual değişkenleri yoğun şekilde inline style +
 * SVG color literal kullanıyor (SafeAreaEditor pattern paritesi).
 * Stable visual recipes studio.css'de namespace-d; geri kalan
 * geçici dynamic style'lar JSX'te kaldı. Phase 78+ candidate:
 * tile gridlerini full CSS class'a indirgemek.
 */

import { useState } from "react";
import { StudioIcon } from "./icons";
import {
  FRAME_ASPECT_CONFIG,
  FRAME_ASPECT_KEYS,
  type FrameAspectKey,
} from "./frame-aspects";
import {
  type EffectPanelKey,
  GRADIENT_PRESETS,
  normalizeLensBlur,
  SCENE_AUTO,
  SOLID_PRESETS,
  type SceneOverride,
} from "./frame-scene";
import {
  MagicPresetThumb,
  STUDIO_SAMPLE_DESIGNS,
  TinyPhone,
  type TinyPhoneStyle,
} from "./svg-art";
import type {
  StudioKeptItem,
  StudioMode,
  StudioSlotAssignmentMap,
  StudioSlotMeta,
} from "./types";

interface SectionLabelProps {
  children: React.ReactNode;
  badge?: boolean;
}
function SectionLabel({ children, badge }: SectionLabelProps) {
  return (
    <div className="k-studio__lbl">
      {children}
      {badge ? (
        <span
          className="k-studio__lbl-badge"
          style={{
            background: "rgba(110,71,168,0.18)",
            border: "1px solid rgba(110,71,168,0.28)",
            color: "rgba(175,140,220,0.85)",
            borderRadius: 4,
            fontSize: 8.5,
            padding: "0 5px",
            height: 15,
            display: "inline-flex",
            alignItems: "center",
            letterSpacing: "0.04em",
          }}
        >
          New
        </span>
      ) : null}
      <span className="k-studio__lbl-line" />
    </div>
  );
}

/* ─── Mockup mode body ──────────────────────────────────── */
interface MockupBodyProps {
  slots: ReadonlyArray<StudioSlotMeta>;
  selectedSlot: number;
  /** Phase 79 — real template binding (useMockupTemplates hydrate). */
  templateName?: string | null;
  /** Phase 79 — real template slot count (multi-slot detection). */
  templateSlotCount?: number;
  /** Phase 86 — Asset-aware Magic Preset thumb.
   *
   * Shots.so'da Magic Preset operator'ın yüklediği asset'in
   * renklerinden auto-generated thumb gösteriyor. Bizde selected
   * slot palette'i Magic Preset row'una thumb olarak iner.
   * Palette undefined ise k-orange fallback (Studio accent). */
  activePalette?: readonly [string, string];
}

function MockupBody({
  slots,
  selectedSlot,
  templateName,
  templateSlotCount,
  activePalette,
}: MockupBodyProps) {
  const [shadow, setShadow] = useState<"none" | "spread" | "hug" | "adapt">(
    "spread",
  );
  const [border, setBorder] = useState<"sharp" | "curved" | "round">(
    "curved",
  );
  const [sty, setSty] = useState<TinyPhoneStyle | "more">("default");
  const [opacity, setOpacity] = useState(40);

  const slot = slots[selectedSlot];
  const isAssigned = Boolean(slot && slot.assigned && slot.design);

  const styleItems: ReadonlyArray<{ k: TinyPhoneStyle | "more"; l: string }> = [
    { k: "default", l: "Default" },
    { k: "glassLight", l: "Glass Lt" },
    { k: "glassDark", l: "Glass Dk" },
    { k: "liquid", l: "Liquid" },
    { k: "insetLight", l: "Inset Lt" },
    { k: "insetDark", l: "Inset Dk" },
    { k: "outline", l: "Outline" },
    { k: "border", l: "Border" },
    { k: "more", l: "More…" },
  ];
  const shItems = [
    { k: "none" as const, l: "None" },
    { k: "spread" as const, l: "Spread" },
    { k: "hug" as const, l: "Hug" },
    { k: "adapt" as const, l: "Adapt." },
  ];
  const shadowMap: Record<typeof shadow, string> = {
    none: "none",
    spread: "0 12px 36px -4px rgba(0,0,0,0.75)",
    hug: "0 4px 12px rgba(0,0,0,0.82)",
    adapt: "0 16px 48px -8px rgba(90,55,20,0.7)",
  };
  const bdItems = [
    { k: "sharp" as const, l: "Sharp", r: 2 },
    { k: "curved" as const, l: "Curved", r: 9 },
    { k: "round" as const, l: "Round", r: 20 },
  ];

  return (
    <div className="k-studio__sb-scroll">
      {/* Phase 81 — Object surface role chip. Studio Mockup mode'un
       * ne yaptığını operatöre tek bakışta söyler: object-first
       * authoring (renderable mockup template + slot assignment +
       * style/border/shadow). Frame mode rolü (presentation-first)
       * FrameBody banner'ında konumlanmıştır. */}
      <div
        style={{
          margin: "8px 9px 4px",
          padding: "8px 10px 7px",
          borderRadius: 8,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
        data-testid="studio-mockup-role-chip"
        role="note"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            marginBottom: 3,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--ks-or)",
            }}
            aria-hidden
          />
          <span
            style={{
              fontFamily: "var(--ks-fm)",
              fontSize: 9.5,
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--ks-or)",
            }}
          >
            Object surface
          </span>
        </div>
        <div
          style={{
            fontSize: 11,
            lineHeight: 1.4,
            color: "var(--ks-t2)",
          }}
        >
          Author the renderable mockup — template, per-slot design,
          style, border, shadow. Render dispatch → real mockup pack.
        </div>
      </div>

      {/* Template card */}
      <div style={{ padding: "0 9px", marginTop: 5 }}>
        <div className="k-studio__tpl-card">
          <div
            style={{
              width: 35,
              height: 27,
              borderRadius: 5,
              flexShrink: 0,
              background: "linear-gradient(135deg,#F0E6D3,#C49862)",
              border: "1px solid rgba(255,255,255,0.09)",
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 540,
                color: "var(--ks-t1)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {/* Phase 79 — real template name (useMockupTemplates
                  hydrate). Loading durumunda placeholder. */}
              {templateName ?? "Loading template…"}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--ks-t3)",
                fontFamily: "var(--ks-fm)",
                marginTop: 1.5,
              }}
              data-testid="studio-sidebar-template-meta"
            >
              {/* Phase 79 — real slot count (multi-slot template
                  signal). N/A için "—". */}
              {(templateSlotCount ?? 1) > 1
                ? `${templateSlotCount} slots · Active`
                : "1 slot · Active"}
            </div>
          </div>
          <StudioIcon name="chevD" size={10} color="rgba(255,255,255,0.28)" />
        </div>
      </div>

      {/* Magic preset (Phase 86 asset-aware thumb) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "5px 9px",
          margin: "4px 7px",
          borderRadius: 7,
        }}
        data-testid="studio-sidebar-magic-preset"
        data-asset-aware={activePalette ? "true" : "false"}
      >
        <StudioIcon name="sparkle" size={12} color="rgba(232,93,37,0.65)" />
        {/* Phase 86 — Asset-aware Magic Preset thumb. Shots.so'da
            Magic Preset operator asset paletinden auto-generated thumb;
            bizde selected slot palette'i mini gradient swatch olarak
            iner. Operator için "kendi asset'imden Magic ne üretir"
            sinyali. Palette undefined ise k-orange fallback. */}
        <div data-testid="studio-sidebar-magic-preset-thumb">
          <MagicPresetThumb palette={activePalette} size={20} />
        </div>
        <span style={{ flex: 1, fontSize: 12, color: "var(--ks-t2)" }}>
          Magic Preset
        </span>
        <button
          type="button"
          className="k-studio__tb-icon"
          style={{ width: 22, height: 22, borderRadius: 5 }}
          aria-label="Previous preset"
        >
          <StudioIcon name="arrowL" size={10} />
        </button>
        <button
          type="button"
          className="k-studio__tb-icon"
          style={{ width: 22, height: 22, borderRadius: 5 }}
          aria-label="Next preset"
        >
          <StudioIcon name="arrow" size={10} />
        </button>
      </div>

      {/* MEDIA */}
      <div style={{ padding: "0 10px", marginTop: 10 }}>
        <SectionLabel>Media</SectionLabel>
        {isAssigned && slot && slot.design ? (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "8px 9px",
                borderRadius: 9,
                background: "var(--ks-b1)",
                border: "1px solid rgba(255,255,255,0.09)",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 30,
                  borderRadius: 5,
                  flexShrink: 0,
                  background: `linear-gradient(135deg,${slot.design.colors[0]},${slot.design.colors[1]})`,
                  border: "1px solid rgba(255,255,255,0.09)",
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 520,
                    color: "var(--ks-t1)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {slot.design.name}
                </div>
                <div
                  style={{
                    fontSize: 9.5,
                    color: "var(--ks-t3)",
                    fontFamily: "var(--ks-fm)",
                    marginTop: 1.5,
                  }}
                >
                  {slot.design.dims} · PNG
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
              <button
                type="button"
                style={{
                  flex: 1,
                  height: 24,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 6,
                  fontSize: 11,
                  color: "var(--ks-t2)",
                  cursor: "pointer",
                  fontFamily: "var(--ks-fn)",
                }}
              >
                Replace
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  height: 24,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 6,
                  fontSize: 11,
                  color: "rgba(195,90,72,0.85)",
                  cursor: "pointer",
                  fontFamily: "var(--ks-fn)",
                }}
              >
                Clear
              </button>
            </div>
          </>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              border: "1.5px dashed rgba(255,255,255,0.11)",
              borderRadius: 10,
              height: 80,
              background: "rgba(255,255,255,0.022)",
              cursor: "pointer",
            }}
          >
            <StudioIcon name="plus" size={20} color="rgba(255,255,255,0.2)" />
            <span
              style={{
                fontSize: 11,
                color: "var(--ks-t3)",
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              Drop or click to choose
            </span>
          </div>
        )}
      </div>

      {/* STYLE */}
      <div style={{ padding: "0 10px", marginTop: 12 }}>
        <SectionLabel>Style</SectionLabel>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 4,
          }}
        >
          {styleItems.map(({ k, l }) => {
            const on = sty === k;
            return (
              <button
                key={k}
                type="button"
                className="k-studio__tile"
                aria-pressed={on}
                onClick={() => setSty(k)}
              >
                {k === "more" ? (
                  <span
                    style={{
                      fontSize: 15,
                      color: "var(--ks-t3)",
                      lineHeight: 1,
                      marginBottom: 2,
                    }}
                  >
                    ···
                  </span>
                ) : (
                  <TinyPhone sty={k} />
                )}
                <span className="k-studio__tile-label">{l}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* BORDER */}
      <div style={{ padding: "0 10px", marginTop: 11 }}>
        <SectionLabel>Border</SectionLabel>
        <div style={{ display: "flex", gap: 4 }}>
          {bdItems.map(({ k, l, r }) => {
            const on = border === k;
            return (
              <button
                key={k}
                type="button"
                className="k-studio__tile"
                data-mode="tri"
                aria-pressed={on}
                onClick={() => setBorder(k)}
              >
                <div
                  style={{
                    width: 26,
                    height: 18,
                    borderRadius: r,
                    background: "rgba(255,255,255,0.07)",
                    border: `1.5px solid ${on ? "var(--ks-or)" : "rgba(255,255,255,0.22)"}`,
                  }}
                />
                <span className="k-studio__tile-label">{l}</span>
              </button>
            );
          })}
        </div>
        <div className="k-studio__range-row">
          <span className="k-studio__range-cap">Radius</span>
          <input
            type="range"
            className="k-studio__range"
            min={0}
            max={32}
            defaultValue={12}
            aria-label="Border radius"
          />
          <span className="k-studio__range-val">12</span>
        </div>
      </div>

      {/* SHADOW */}
      <div style={{ padding: "0 10px", marginTop: 11 }}>
        <SectionLabel>Shadow</SectionLabel>
        <div style={{ display: "flex", gap: 4 }}>
          {shItems.map(({ k, l }) => {
            const on = shadow === k;
            return (
              <button
                key={k}
                type="button"
                className="k-studio__tile"
                data-mode="sh"
                aria-pressed={on}
                onClick={() => setShadow(k)}
              >
                <div
                  style={{
                    width: 22,
                    height: 28,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 22,
                      borderRadius: 2.5,
                      background: "#3A3532",
                      boxShadow: shadowMap[k],
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  />
                </div>
                <span className="k-studio__tile-label">{l}</span>
              </button>
            );
          })}
        </div>
        <div className="k-studio__range-row" style={{ marginTop: 8 }}>
          <span className="k-studio__range-cap">Opacity</span>
          <input
            type="range"
            className="k-studio__range"
            min={0}
            max={100}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            aria-label="Shadow opacity"
          />
          <span className="k-studio__range-val">{opacity}</span>
        </div>
      </div>

      {/* VISIBILITY (footer) */}
      <div style={{ padding: "0 7px", marginTop: 10, marginBottom: 4 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 9px",
            borderRadius: 7,
            cursor: "pointer",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <StudioIcon name="sun" size={13} color="rgba(255,255,255,0.35)" />
          <span style={{ fontSize: 12, color: "var(--ks-t2)", flex: 1 }}>
            Adjust Light
          </span>
          <StudioIcon name="chevR" size={10} color="var(--ks-t3)" />
        </div>
      </div>
    </div>
  );
}

/* ─── Slot Footer (Mockup only) ─────────────────────────── */
/* Phase 80 — Sidebar slot footer artık operator-driven slot
 * assignment'ın canonical yüzeyi. Apply view'daki SlotAssignmentPanel
 * UX paritesi (per-slot picker + Fill all / Clear all + fanout
 * fallback caption) dark studio recipe'leriyle yeniden çizildi.
 * Phase 76 panel hâlâ Apply view'da Quick pack akışı için canlı;
 * Studio canonical authoring yüzeyi → bu footer. */
interface SlotFooterProps {
  slots: ReadonlyArray<StudioSlotMeta>;
  selectedSlot: number;
  setSelectedSlot: (i: number) => void;
  keptItems: ReadonlyArray<StudioKeptItem>;
  slotAssignments: StudioSlotAssignmentMap;
  onChangeSlotAssignments?: (next: StudioSlotAssignmentMap) => void;
}

function SlotFooter({
  slots,
  selectedSlot,
  setSelectedSlot,
  keptItems,
  slotAssignments,
  onChangeSlotAssignments,
}: SlotFooterProps) {
  const primaryItem = keptItems[0];
  const assignedCount =
    Object.values(slotAssignments).filter(Boolean).length;

  const assignSlot = (slotIdx: number, itemId: string | null) => {
    if (!onChangeSlotAssignments) return;
    const next = { ...slotAssignments };
    if (itemId === null) {
      delete next[slotIdx];
    } else {
      next[slotIdx] = itemId;
    }
    onChangeSlotAssignments(next);
  };

  const fillAllWithPrimary = () => {
    if (!onChangeSlotAssignments || !primaryItem) return;
    const next: StudioSlotAssignmentMap = {};
    slots.forEach((_, i) => {
      next[i] = primaryItem.id;
    });
    onChangeSlotAssignments(next);
  };

  const clearAll = () => {
    if (!onChangeSlotAssignments) return;
    onChangeSlotAssignments({});
  };

  const activeSlot = slots[selectedSlot];
  const assignedItemId = slotAssignments[selectedSlot] ?? null;
  const assignedItem =
    assignedItemId !== null
      ? keptItems.find((k) => k.id === assignedItemId) ?? null
      : null;

  return (
    <div className="k-studio__sb-footer" data-testid="studio-sidebar-slot-footer">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginBottom: 5,
        }}
      >
        <span className="k-studio__lbl" style={{ marginBottom: 0 }}>
          Slots
        </span>
        {assignedCount > 0 ? (
          <span
            style={{
              fontFamily: "var(--ks-fm)",
              fontSize: 9,
              color: "var(--ks-or)",
              padding: "0 5px",
              height: 14,
              display: "inline-flex",
              alignItems: "center",
              background: "var(--ks-ors)",
              border: "1px solid var(--ks-orb)",
              borderRadius: 3,
              letterSpacing: "0.04em",
            }}
            data-testid="studio-sidebar-assignment-count"
          >
            {assignedCount} assigned
          </span>
        ) : null}
        <span className="k-studio__lbl-line" />
        {keptItems.length > 0 && primaryItem ? (
          <>
            <button
              type="button"
              className="k-studio__tb-icon"
              style={{ height: 18, padding: "0 5px", fontSize: 9.5, gap: 3 }}
              onClick={fillAllWithPrimary}
              title="Assign primary kept item to all slots"
              data-testid="studio-sidebar-slot-fill-all"
            >
              <StudioIcon name="sparkle" size={9} color="var(--ks-or)" />
              Fill all
            </button>
            {assignedCount > 0 ? (
              <button
                type="button"
                className="k-studio__tb-icon"
                style={{ height: 18, padding: "0 5px", fontSize: 9.5 }}
                onClick={clearAll}
                title="Clear all slot assignments (revert to fanout)"
                data-testid="studio-sidebar-slot-clear-all"
              >
                Clear
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {slots.map((sl, i) => {
          const on = selectedSlot === i;
          const slotAssignedId = slotAssignments[i] ?? null;
          const slotAssignedItem =
            slotAssignedId !== null
              ? keptItems.find((k) => k.id === slotAssignedId) ?? null
              : null;
          return (
            <button
              key={sl.id}
              type="button"
              className="k-studio__slot-pill"
              aria-pressed={on}
              onClick={() => setSelectedSlot(i)}
              data-testid={`studio-sidebar-slot-${i}`}
              data-assigned={slotAssignedItem ? "true" : "false"}
            >
              <span className="k-studio__slot-pill-num">
                {String(sl.id).padStart(2, "0")}
              </span>
              {/* Phase 80 — Operator-driven assignment dot has priority
                  over default sl.design colors (if assigned). */}
              {slotAssignedItem ? (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    flexShrink: 0,
                    background: `linear-gradient(135deg,${slotAssignedItem.colors[0]},${slotAssignedItem.colors[1]})`,
                    boxShadow: "0 0 0 1px var(--ks-or)",
                  }}
                  data-testid={`studio-sidebar-slot-${i}-assigned-dot`}
                />
              ) : sl.assigned && sl.design ? (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    flexShrink: 0,
                    background: `linear-gradient(135deg,${sl.design.colors[0]},${sl.design.colors[1]})`,
                  }}
                />
              ) : null}
              <span style={{ fontWeight: on ? 540 : 400 }}>{sl.name}</span>
              <span
                className="k-studio__slot-pill-dot"
                data-empty={!sl.assigned}
              />
            </button>
          );
        })}
      </div>

      {/* Phase 80 — Active slot inline picker. Operator selectedSlot
          pill'i tıklayıp aktif yapar; aşağıda picker kept-item listesi
          açılır (Phase 76 panel UX paritesi, dark studio recipe). */}
      {keptItems.length > 0 && activeSlot ? (
        <div
          style={{
            marginTop: 7,
            padding: "8px 9px 9px",
            background: "rgba(0,0,0,0.18)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 8,
          }}
          data-testid="studio-sidebar-slot-picker"
          data-active-slot={selectedSlot}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontFamily: "var(--ks-fm)",
                fontSize: 9,
                fontWeight: 500,
                letterSpacing: "0.13em",
                textTransform: "uppercase",
                color: "var(--ks-t3)",
              }}
            >
              Slot {String(selectedSlot + 1).padStart(2, "0")}
            </span>
            <span
              style={{
                fontSize: 10,
                color: assignedItem ? "var(--ks-or)" : "var(--ks-t3)",
                fontFamily: "var(--ks-fm)",
              }}
              data-testid="studio-sidebar-slot-picker-status"
            >
              {assignedItem
                ? `→ ${assignedItem.label}`
                : primaryItem
                  ? `Fanout · ${primaryItem.label}`
                  : "No kept items"}
            </span>
            {assignedItem ? (
              <button
                type="button"
                style={{
                  marginLeft: "auto",
                  height: 16,
                  padding: "0 5px",
                  fontFamily: "var(--ks-fm)",
                  fontSize: 9,
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 3,
                  color: "var(--ks-t3)",
                  cursor: "pointer",
                }}
                onClick={() => assignSlot(selectedSlot, null)}
                data-testid="studio-sidebar-slot-picker-clear"
                title="Revert this slot to fanout"
              >
                Clear
              </button>
            ) : null}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 3,
              maxHeight: 168,
              overflowY: "auto",
            }}
          >
            {keptItems.map((k) => {
              const on = assignedItemId === k.id;
              return (
                <button
                  key={k.id}
                  type="button"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "5px 7px",
                    background: on
                      ? "var(--ks-ors)"
                      : "rgba(255,255,255,0.04)",
                    border: `1px solid ${on ? "var(--ks-orb)" : "rgba(255,255,255,0.06)"}`,
                    borderRadius: 5,
                    color: on ? "var(--ks-or)" : "var(--ks-t2)",
                    fontFamily: "var(--ks-fn)",
                    fontSize: 11,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onClick={() => assignSlot(selectedSlot, on ? null : k.id)}
                  aria-pressed={on}
                  data-testid={`studio-sidebar-slot-picker-item-${k.id}`}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      flexShrink: 0,
                      background: `linear-gradient(135deg,${k.colors[0]},${k.colors[1]})`,
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {k.label}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--ks-fm)",
                      fontSize: 9,
                      color: on ? "var(--ks-or)" : "var(--ks-t3)",
                    }}
                  >
                    {k.dims}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ─── Frame mode body ───────────────────────────────────── */
/* Phase 79 — Honest disclosure: Frame mode preset/effects/scene/
 * background controls visual-only durumda. Gerçek export pipeline
 * (listing hero / social / storefront deliverable) Phase 80+ candidate.
 * Operatöre dürüst sinyal: top banner + disabled state'leri title
 * tooltip ile (Phase 80+ adayları). */
function FrameBody({
  frameAspect,
  onChangeFrameAspect,
  sceneOverride,
  onChangeSceneOverride,
  activeEffectPanel,
  onOpenEffectPanel,
  onCloseEffectPanel,
  deviceKind,
}: {
  frameAspect?: FrameAspectKey;
  onChangeFrameAspect?: (next: FrameAspectKey) => void;
  /** Phase 89 — Frame scene control state (Shell). */
  sceneOverride?: SceneOverride;
  onChangeSceneOverride?: (next: SceneOverride) => void;
  /** Phase 137 — Effect Settings Flyout panel state (Shell-owned).
   *  Tile click flyout açar (cycle/toggle YOK); sceneOverride
   *  değişimi flyout'tan gelir. */
  activeEffectPanel?: EffectPanelKey | null;
  onOpenEffectPanel?: (panel: EffectPanelKey | null) => void;
  onCloseEffectPanel?: () => void;
  /** Phase 112 — Capability gating (deviceKind → shape →
   *  supportsLensBlurTargeting). Dead STUDIO_DEVICE_CAPABILITIES
   *  fiilen tüketilir; tek tek hack yerine tek kapı. */
  deviceKind?: string;
}) {
  /* Phase 137 (4/5 fu) — `lensTargetingSupported` hesabı + EffectFlyout
   *  render'ı MockupStudioShell `k-studio__body`'ye taşındı (Sidebar
   *  overflow zinciri flyout'u clip ediyordu). FrameBody artık flyout'u
   *  host etmez; `deviceKind` prop'u Shell→Sidebar→FrameBody prop
   *  surface'inde korunur (capability gating Shell'de uygulanır). */
  const [effect, setEffect] = useState<"lens" | "portrait" | "watermark" | "bgfx">(
    "lens",
  );
  const [scene, setScene] = useState<"none" | "shadow" | "shapes">("none");
  const [bgVal, setBgVal] = useState<"trans" | "color" | "image" | "upload">(
    "color",
  );
  // Phase 83 — Frame aspect (controlled by Shell). Bilinmeyen
  // prop durumunda "16:9" fallback (operator dağılmasın).
  const activeAspect: FrameAspectKey = frameAspect ?? "16:9";
  const activeAspectCfg = FRAME_ASPECT_CONFIG[activeAspect];

  /* Phase 89 — Active scene state (Shell-controlled, default auto). */
  const activeScene: SceneOverride = sceneOverride ?? SCENE_AUTO;

  const efx = [
    { k: "lens" as const, l: "Lens Blur", n: "blur" as const },
    { k: "portrait" as const, l: "Portrait", n: "eye" as const },
    { k: "watermark" as const, l: "Watermark", n: "layers" as const },
    { k: "bgfx" as const, l: "BG Effects", n: "sparkle" as const },
  ];
  const scenes = [
    { k: "none" as const, l: "None", sym: "∅" },
    { k: "shadow" as const, l: "Shadow", sym: "▽" },
    { k: "shapes" as const, l: "Shapes", sym: "△" },
  ];
  const bgs = [
    { k: "trans" as const, l: "Trans.", n: "image" as const },
    { k: "color" as const, l: "Color", n: "sun" as const },
    { k: "image" as const, l: "Image", n: "image" as const },
    { k: "upload" as const, l: "Upload", n: "upload" as const },
  ];
  /* Phase 89 — Frame mode scene preset palettes.
   *
   * frame-scene.ts SOLID_PRESETS + GRADIENT_PRESETS canonical kaynak.
   * Operator swatch tıklayınca Shell sceneOverride state'i güncellenir;
   * Stage'in CSS custom properties hesabı resolveSceneStyle ile mode'a
   * göre warm/deep tone alpha ayarlanır. */
  const solids = SOLID_PRESETS;
  const grads = GRADIENT_PRESETS;

  return (
    <div className="k-studio__sb-scroll">
      {/* Phase 79 + Phase 81 — Presentation surface role chip.
       *
       * Phase 79 baseline'da "Coming Phase 80+" stale copy idi; Phase 81
       * Mockup vs Frame role clarity kararıyla netleştirdi: Frame mode
       * = presentation-first authoring (canvas + background + scene +
       * export). Mockup mode çıktısını veya kept asset'i Etsy listing
       * hero / Instagram square / Story / storefront banner için
       * presentation composition'a yerleştirir. Controls aşağıda
       * görsel-only; real export pipeline Phase 82+ candidate
       * (operator-friendly canvas + bg + export zinciri). */}
      <div
        style={{
          margin: "8px 9px 4px",
          padding: "9px 10px",
          borderRadius: 8,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)",
          color: "var(--ks-t2)",
        }}
        data-testid="studio-frame-role-chip"
        role="note"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 3,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--ks-or)",
            }}
            aria-hidden
          />
          <span
            style={{
              fontFamily: "var(--ks-fm)",
              fontSize: 9.5,
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--ks-or)",
            }}
          >
            Presentation surface
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontFamily: "var(--ks-fm)",
              fontSize: 9,
              padding: "1px 5px",
              borderRadius: 3,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--ks-t3)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Export Phase 82+
          </span>
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.4, color: "var(--ks-t2)" }}>
          Compose listing hero / social card / storefront banner — canvas
          size, background, scene. Controls below preview the
          presentation surface; real export lands in Phase 82+.
        </div>
      </div>

      {/* Frame selector */}
      <div style={{ padding: "0 9px", marginTop: 5 }}>
        <div className="k-studio__tpl-card" data-stack="true">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
            }}
          >
            <div
              style={{
                width: 35,
                height: 27,
                borderRadius: 4,
                flexShrink: 0,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width={20} height={14} viewBox="0 0 20 14" aria-hidden>
                <rect
                  x={0}
                  y={0}
                  width={20}
                  height={14}
                  rx={2}
                  fill="none"
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth={1}
                />
                <line
                  x1={0}
                  y1={4}
                  x2={20}
                  y2={4}
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth={0.75}
                />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{ fontSize: 12, fontWeight: 540, color: "var(--ks-t1)" }}
                data-testid="studio-sidebar-frame-selector-name"
              >
                Frame · {activeAspect}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--ks-t3)",
                  fontFamily: "var(--ks-fm)",
                  marginTop: 1,
                }}
                data-testid="studio-sidebar-frame-selector-dims"
              >
                {activeAspectCfg.outputW} × {activeAspectCfg.outputH}
              </div>
            </div>
            <StudioIcon
              name="chevD"
              size={10}
              color="rgba(255,255,255,0.28)"
            />
          </div>
          {/* Phase 83 — Aspect chips state-controlled. Operator chip
              click → Shell state update → Stage canvas dims + caption
              + Toolbar status badge live update. */}
          <div
            style={{ display: "flex", gap: 3, flexWrap: "wrap" }}
            data-testid="studio-sidebar-frame-aspects"
          >
            {FRAME_ASPECT_KEYS.map((key) => {
              const on = key === activeAspect;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChangeFrameAspect?.(key)}
                  aria-pressed={on}
                  data-testid={`studio-sidebar-frame-aspect-${key}`}
                  style={{
                    height: 18,
                    padding: "0 6px",
                    borderRadius: 4,
                    background: on
                      ? "rgba(232,93,37,0.12)"
                      : "rgba(255,255,255,0.055)",
                    border: `1px solid ${on ? "rgba(232,93,37,0.35)" : "rgba(255,255,255,0.08)"}`,
                    fontSize: 9.5,
                    color: on ? "var(--ks-or)" : "var(--ks-t2)",
                    cursor: "pointer",
                    fontFamily: "var(--ks-fm)",
                  }}
                  title={FRAME_ASPECT_CONFIG[key].deliverable}
                >
                  {key}
                </button>
              );
            })}
          </div>
          {/* Phase 83 — Live deliverable caption + output dims. */}
          <div
            style={{
              marginTop: 6,
              fontFamily: "var(--ks-fm)",
              fontSize: 9.5,
              color: "var(--ks-t3)",
              letterSpacing: "0.04em",
            }}
            data-testid="studio-sidebar-frame-deliverable"
          >
            {activeAspectCfg.deliverable} ·{" "}
            <span style={{ color: "var(--ks-t2)" }}>
              {activeAspectCfg.outputW}×{activeAspectCfg.outputH}
            </span>
          </div>
        </div>
      </div>

      {/* EFFECTS — Phase 98 Lens Blur wired to plate.
       *
       * Sözleşme #11 + #1 ("Frame = scene + effects ile composition").
       * Phase 89'a kadar Effects tile'ları local `useState` ile sadece
       * active state'i tutuyor, plate'e hiç bağlanmıyordu. Phase 98:
       *   - Lens Blur tile → sceneOverride.lensBlur toggle (plate
       *     CSS filter blur applied; mode-AGNOSTIC continuity).
       *   - Portrait / Watermark / BG Effects: honest disclosure —
       *     görünür ama Phase 99+ candidate (operator için "var ama
       *     henüz aktif değil" şeffaflık; sözleşme #12 silent magic
       *     yasağına uyum).
       *
       * BG Effects ileride noise/grain/vignette pattern overlay
       * eklendiğinde sceneOverride'a `bgEffect` field ile bağlanır
       * (Phase 99 candidate; sözleşmede roadmap notu var). */}
      <div style={{ padding: "0 10px", marginTop: 10 }}>
        <SectionLabel>Effects &amp; Watermark</SectionLabel>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 4,
          }}
        >
          {efx.map(({ k, l, n }) => {
            const isLens = k === "lens";
            // Phase 136 — BG Effects wired (vignette/grain tek-seçim).
            const isBgfx = k === "bgfx";
            const isWired = isLens || isBgfx;
            // Phase 109 — structured Lens Blur (backward-compat).
            const lensCfg = normalizeLensBlur(activeScene.lensBlur);
            const lensActive = isLens && lensCfg.enabled;
            // Phase 136 — bgEffect set → tile active (kind !== null).
            const bgKind = activeScene.bgEffect?.kind ?? null;
            const on = isLens
              ? lensActive
              : isBgfx
                ? bgKind !== null
                : effect === k;
            return (
              <button
                key={k}
                type="button"
                className="k-studio__tile"
                aria-pressed={on}
                onClick={() => {
                  // Phase 137 — tile artık cycle/toggle YAPMAZ.
                  // Wired effect (lens/bgfx) → flyout aç (exclusive
                  // toggle: aynı panel açıksa kapat). Honest-disabled
                  // (portrait/watermark/vfx) → flyout açmaz, no-op.
                  if (k === "lens" || k === "bgfx") {
                    if (onOpenEffectPanel) {
                      onOpenEffectPanel(
                        activeEffectPanel === k ? null : k,
                      );
                    }
                    return;
                  }
                  setEffect(k);
                }}
                title={
                  isWired
                    ? l
                    : `${l} — preview only (Phase 99+ candidate)`
                }
                style={{
                  minHeight: 56,
                  opacity: isWired ? 1 : 0.78,
                }}
                data-testid={`studio-frame-effect-${k}`}
                data-active={on ? "true" : "false"}
                data-wired={isWired ? "true" : "false"}
                data-effect-tile={k}
                aria-expanded={
                  k === "lens" || k === "bgfx"
                    ? activeEffectPanel === k
                    : undefined
                }
              >
                <StudioIcon
                  name={n}
                  size={16}
                  color={on ? "rgba(232,93,37,0.8)" : "rgba(255,255,255,0.3)"}
                />
                <span className="k-studio__tile-label">
                  {/* Phase 139 — Lens Blur tek-davranışlı:
                      "Blur · Plate/All" target etiketi KALDIRILDI
                      (target ayrımı yok). enabled → "Blur". */}
                  {k === "lens" && lensCfg.enabled
                    ? "Blur"
                    : k === "bgfx" && bgKind === "vignette"
                      ? "Vignette"
                      : k === "bgfx" && bgKind === "grain"
                        ? "Grain"
                        : l}
                </span>
              </button>
            );
          })}
        </div>
        {/* Lens Blur kontrolleri EffectFlyout'ta (Phase 137 tile
         *  → flyout devri). Phase 139 — tek-davranışlı: flyout'ta
         *  yalnız Intensity ("Blur target" segment KALDIRILDI).
         *  Bkz. EffectFlyout.tsx. */}
      </div>

      {/* SCENE */}
      <div style={{ padding: "0 10px", marginTop: 11 }}>
        <SectionLabel>Scene</SectionLabel>
        <div style={{ display: "flex", gap: 4 }}>
          {scenes.map(({ k, l, sym }) => {
            const on = scene === k;
            return (
              <button
                key={k}
                type="button"
                className="k-studio__tile"
                data-mode="tri"
                aria-pressed={on}
                onClick={() => setScene(k)}
              >
                <div
                  style={{
                    width: 26,
                    height: 20,
                    borderRadius: 3,
                    background: "rgba(255,255,255,0.07)",
                    border: `1px solid ${on ? "var(--ks-or)" : "rgba(255,255,255,0.15)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgba(255,255,255,0.35)",
                    fontSize: 11,
                  }}
                >
                  {sym}
                </div>
                <span className="k-studio__tile-label">{l}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* BACKGROUND */}
      <div style={{ padding: "0 10px", marginTop: 11 }}>
        <SectionLabel>Background</SectionLabel>
        <div style={{ display: "flex", gap: 4 }}>
          {bgs.map(({ k, l, n }) => {
            const on = bgVal === k;
            return (
              <button
                key={k}
                type="button"
                className="k-studio__tile"
                aria-pressed={on}
                onClick={() => setBgVal(k)}
                style={{ minHeight: 50 }}
              >
                <StudioIcon
                  name={n}
                  size={13}
                  color={on ? "rgba(232,93,37,0.8)" : "rgba(255,255,255,0.3)"}
                />
                <span className="k-studio__tile-label">{l}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SOLID — Phase 89 clickable + active state */}
      <div
        style={{ padding: "0 10px", marginTop: 11 }}
        data-testid="studio-frame-solid-section"
      >
        <div className="k-studio__lbl" style={{ marginBottom: 6 }}>
          Solid
          <span className="k-studio__lbl-line" />
        </div>
        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
          {solids.map((c, i) => {
            const isActive =
              activeScene.mode === "solid" &&
              activeScene.color?.toLowerCase() === c.toLowerCase();
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (onChangeSceneOverride) {
                    onChangeSceneOverride({ mode: "solid", color: c });
                  }
                }}
                aria-pressed={isActive}
                aria-label={`Solid scene ${c}`}
                data-testid={`studio-frame-solid-${i}`}
                data-active={isActive ? "true" : "false"}
                style={{
                  width: 28,
                  height: 20,
                  borderRadius: 4,
                  background: c,
                  border: isActive
                    ? "1.5px solid rgba(232,93,37,0.85)"
                    : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: isActive
                    ? "0 0 0 2px rgba(232,93,37,0.25)"
                    : "none",
                  cursor: "pointer",
                  flexShrink: 0,
                  padding: 0,
                }}
              />
            );
          })}
          <StudioIcon
            name="chevD"
            size={10}
            color="rgba(255,255,255,0.22)"
          />
        </div>
      </div>

      {/* GRADIENT — Phase 89 clickable + active state */}
      <div
        style={{ padding: "0 10px", marginTop: 8 }}
        data-testid="studio-frame-gradient-section"
      >
        <div className="k-studio__lbl" style={{ marginBottom: 6 }}>
          Gradient
          <span className="k-studio__lbl-line" />
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {grads.map((g, i) => {
            const isActive =
              activeScene.mode === "gradient" &&
              activeScene.color?.toLowerCase() === g.from.toLowerCase() &&
              activeScene.colorTo?.toLowerCase() === g.to.toLowerCase();
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (onChangeSceneOverride) {
                    onChangeSceneOverride({
                      mode: "gradient",
                      color: g.from,
                      colorTo: g.to,
                    });
                  }
                }}
                aria-pressed={isActive}
                aria-label={`Gradient scene ${g.from} → ${g.to}`}
                data-testid={`studio-frame-gradient-${i}`}
                data-active={isActive ? "true" : "false"}
                style={{
                  width: 38,
                  height: 26,
                  borderRadius: 5,
                  background: `linear-gradient(145deg,${g.from},${g.to})`,
                  border: isActive
                    ? "1.5px solid rgba(232,93,37,0.85)"
                    : "1px solid rgba(255,255,255,0.07)",
                  boxShadow: isActive
                    ? "0 0 0 2px rgba(232,93,37,0.25)"
                    : "none",
                  cursor: "pointer",
                  flexShrink: 0,
                  padding: 0,
                }}
              />
            );
          })}
          <StudioIcon
            name="chevD"
            size={10}
            color="rgba(255,255,255,0.22)"
          />
        </div>
        {/* Phase 89 — Reset to Auto when operator wants Magic baseline back */}
        {activeScene.mode !== "auto" ? (
          <button
            type="button"
            onClick={() => {
              if (onChangeSceneOverride) onChangeSceneOverride(SCENE_AUTO);
            }}
            data-testid="studio-frame-scene-reset"
            style={{
              marginTop: 8,
              padding: "4px 8px",
              fontSize: 10,
              fontFamily: "var(--ks-fm)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Reset to Auto
          </button>
        ) : null}
      </div>

      {/* GLASS — Phase 98 clickable + active state.
       *
       * Sözleşme #11 baseline: "Frame mode sidebar controls (Magic
       * Preset, Solid, Gradient, **Glass swatch'ları**) plate
       * bg'sini değiştirir". Phase 89'a kadar yalnız solid + gradient
       * wire edilmişti; Glass swatch'lar no-op idi (silent drift
       * sözleşme #12 ihlali).
       *
       * Phase 98: 3 variant (light / dark / frosted) → Shell
       * setSceneOverride({ mode: "glass", glassVariant }). Plate
       * üstüne `backdrop-filter` + tone overlay uygular. Aktif
       * variant orange ring + active state highlight. */}
      <div
        style={{ padding: "0 10px", marginTop: 8, marginBottom: 4 }}
        data-testid="studio-frame-glass-section"
      >
        <SectionLabel badge>Glass</SectionLabel>
        <div style={{ display: "flex", gap: 4 }}>
          {(
            [
              { variant: "light" as const, label: "Glass Light", swatchBg: "rgba(255,255,255,0.18)", swatchBorder: "rgba(255,255,255,0.28)" },
              { variant: "dark" as const, label: "Glass Dark", swatchBg: "rgba(0,0,0,0.55)", swatchBorder: "rgba(255,255,255,0.12)" },
              { variant: "frosted" as const, label: "Frosted", swatchBg: "rgba(255,255,255,0.10)", swatchBorder: "rgba(255,255,255,0.18)" },
            ]
          ).map((opt) => {
            const isActive =
              activeScene.mode === "glass" &&
              (activeScene.glassVariant ?? "light") === opt.variant;
            return (
              <button
                key={opt.variant}
                type="button"
                className="k-studio__tile"
                data-mode="tri"
                aria-pressed={isActive}
                onClick={() => {
                  if (onChangeSceneOverride) {
                    onChangeSceneOverride({
                      mode: "glass",
                      glassVariant: opt.variant,
                      lensBlur: activeScene.lensBlur ?? false,
                    });
                  }
                }}
                data-testid={`studio-frame-glass-${opt.variant}`}
                data-active={isActive ? "true" : "false"}
              >
                <div
                  style={{
                    width: 28,
                    height: 20,
                    borderRadius: 3,
                    background: opt.swatchBg,
                    border: `1px solid ${isActive ? "rgba(232,93,37,0.85)" : opt.swatchBorder}`,
                    boxShadow: isActive
                      ? "0 0 0 2px rgba(232,93,37,0.25)"
                      : "none",
                    backdropFilter: "blur(2px)",
                  }}
                />
                <span className="k-studio__tile-label">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {/* Phase 137 (4/5 fu) — Effect Settings Flyout render'ı
       *  MockupStudioShell `k-studio__body`'ye taşındı (Sidebar/Stage
       *  sibling). Sidebar `.k-studio__sb-scroll` overflow zinciri
       *  flyout'u sidebar dışına taşırken clip + scroll'la
       *  kaydırıyordu (guardrail 4+6). Tile click davranışı burada
       *  kalır (onOpenEffectPanel); flyout DOM'u Shell'de. */}
    </div>
  );
}

/* ─── Sidebar shell ─────────────────────────────────────── */
export interface MockupStudioSidebarProps {
  mode: StudioMode;
  setMode: (m: StudioMode) => void;
  slots: ReadonlyArray<StudioSlotMeta>;
  selectedSlot: number;
  setSelectedSlot: (i: number) => void;
  /** Phase 79 — real template name (useMockupTemplates hydrate). */
  templateName?: string | null;
  /** Phase 79 — real template slot count (multi-slot detection). */
  templateSlotCount?: number;
  /** Phase 80 — kept items (selection set items[]) sidebar slot
   *  picker dropdown'una verilir. */
  keptItems?: ReadonlyArray<StudioKeptItem>;
  /** Phase 80 — operator-driven slot → kept-item id mapping
   *  (`null` veya eksik = fanout fallback). */
  slotAssignments?: StudioSlotAssignmentMap;
  /** Phase 80 — assignment change callback (Shell state taşır). */
  onChangeSlotAssignments?: (next: StudioSlotAssignmentMap) => void;
  /** Phase 83 — Frame mode bounded canvas aspect ratio (Shell state). */
  frameAspect?: FrameAspectKey;
  /** Phase 83 — Frame aspect change callback (Shell state taşır). */
  onChangeFrameAspect?: (next: FrameAspectKey) => void;
  /** Phase 86 — Selected slot palette (asset-aware Magic Preset thumb).
   *
   * Shell selected slot'tan palette türetir ve sidebar'a geçer.
   * Magic Preset row thumb operator asset'inin renklerini gösterir
   * (Shots.so Magic Preset parity). Undefined → k-orange fallback. */
  activePalette?: readonly [string, string];
  /** Phase 89 — Frame mode scene override state.
   *
   * Shots.so real-image-upload: Frame mode'da operator Magic/Solid/
   * Gradient swatch tıklayınca stage scene değişiyor. Shell state'i
   * tutar; Frame sidebar'a current sceneOverride iletilir (active
   * swatch highlight için) + onChangeSceneOverride callback ile
   * swatch click handler'ı Shell state'i günceller. */
  sceneOverride?: SceneOverride;
  onChangeSceneOverride?: (next: SceneOverride) => void;
  /** Phase 137 — Effect Settings Flyout panel state (Shell-owned).
   *  Tile click artık cycle/toggle yapmaz; wired effect (lens/bgfx)
   *  flyout açar (exclusive). sceneOverride değişimi flyout'tan
   *  gelir; tile yalnız onOpenEffectPanel çağırır. */
  activeEffectPanel?: EffectPanelKey | null;
  onOpenEffectPanel?: (panel: EffectPanelKey | null) => void;
  onCloseEffectPanel?: () => void;
  /** Phase 112 — Device shape capability gating (Shell zaten
   *  `deviceKind={deviceKind}` geçiriyordu ama prop tanımsızdı →
   *  ignore ediliyordu). Lens Blur targeting UI'ı
   *  `studioDeviceCapability(deviceKindToShape(deviceKind))
   *  .supportsLensBlurTargeting` ile gate'lenir. Şu an tüm shape
   *  true (davranış değişmez) ama capability model artık FİİLEN
   *  tüketiliyor (Phase 109 dead-code canlandı); ileride bir
   *  shape false olursa UI otomatik gizlenir — tek tek hack yok. */
  deviceKind?: string;
}

export function MockupStudioSidebar({
  mode,
  setMode,
  slots,
  selectedSlot,
  setSelectedSlot,
  templateName,
  templateSlotCount,
  keptItems,
  slotAssignments,
  onChangeSlotAssignments,
  frameAspect,
  onChangeFrameAspect,
  activePalette,
  sceneOverride,
  onChangeSceneOverride,
  activeEffectPanel,
  onOpenEffectPanel,
  onCloseEffectPanel,
  deviceKind,
}: MockupStudioSidebarProps) {
  void STUDIO_SAMPLE_DESIGNS; // imported for slot defaults usage in tests
  return (
    <aside className="k-studio__sidebar" data-testid="studio-sidebar">
      <div
        className="k-studio__sb-tabs"
        role="tablist"
        aria-label="Studio mode"
      >
        <button
          type="button"
          className="k-studio__sb-tab"
          role="tab"
          aria-pressed={mode === "mockup"}
          onClick={() => setMode("mockup")}
          data-testid="studio-sidebar-mode-mockup"
        >
          Mockup
        </button>
        <button
          type="button"
          className="k-studio__sb-tab"
          role="tab"
          aria-pressed={mode === "frame"}
          onClick={() => setMode("frame")}
          data-testid="studio-sidebar-mode-frame"
        >
          Frame
        </button>
      </div>
      {mode === "mockup" ? (
        <MockupBody
          slots={slots}
          selectedSlot={selectedSlot}
          templateName={templateName}
          templateSlotCount={templateSlotCount}
          activePalette={activePalette}
        />
      ) : (
        <FrameBody
          frameAspect={frameAspect}
          onChangeFrameAspect={onChangeFrameAspect}
          sceneOverride={sceneOverride}
          onChangeSceneOverride={onChangeSceneOverride}
          activeEffectPanel={activeEffectPanel}
          onOpenEffectPanel={onOpenEffectPanel}
          onCloseEffectPanel={onCloseEffectPanel}
          deviceKind={deviceKind}
        />
      )}
      {mode === "mockup" ? (
        <SlotFooter
          slots={slots}
          selectedSlot={selectedSlot}
          setSelectedSlot={setSelectedSlot}
          keptItems={keptItems ?? []}
          slotAssignments={slotAssignments ?? {}}
          onChangeSlotAssignments={onChangeSlotAssignments}
        />
      ) : null}
    </aside>
  );
}
