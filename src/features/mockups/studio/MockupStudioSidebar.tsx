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
  STUDIO_SAMPLE_DESIGNS,
  TinyPhone,
  type TinyPhoneStyle,
} from "./svg-art";
import type { StudioMode, StudioSlotMeta } from "./types";

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
}

function MockupBody({ slots, selectedSlot }: MockupBodyProps) {
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
              Hero Phone Bundle
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--ks-t3)",
                fontFamily: "var(--ks-fm)",
                marginTop: 1.5,
              }}
            >
              3 slots · Active
            </div>
          </div>
          <StudioIcon name="chevD" size={10} color="rgba(255,255,255,0.28)" />
        </div>
      </div>

      {/* Magic preset */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "5px 9px",
          margin: "4px 7px",
          borderRadius: 7,
        }}
      >
        <StudioIcon name="sparkle" size={12} color="rgba(232,93,37,0.65)" />
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
interface SlotFooterProps {
  slots: ReadonlyArray<StudioSlotMeta>;
  selectedSlot: number;
  setSelectedSlot: (i: number) => void;
}

function SlotFooter({ slots, selectedSlot, setSelectedSlot }: SlotFooterProps) {
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
        <span className="k-studio__lbl-line" />
        <button
          type="button"
          className="k-studio__tb-icon"
          style={{ width: 18, height: 18, borderRadius: 4 }}
          aria-label="Add slot"
        >
          <StudioIcon name="plus" size={9} color="var(--ks-t3)" />
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {slots.map((sl, i) => {
          const on = selectedSlot === i;
          return (
            <button
              key={sl.id}
              type="button"
              className="k-studio__slot-pill"
              aria-pressed={on}
              onClick={() => setSelectedSlot(i)}
              data-testid={`studio-sidebar-slot-${i}`}
            >
              <span className="k-studio__slot-pill-num">
                {String(sl.id).padStart(2, "0")}
              </span>
              {sl.assigned && sl.design ? (
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
    </div>
  );
}

/* ─── Frame mode body ───────────────────────────────────── */
function FrameBody() {
  const [effect, setEffect] = useState<"lens" | "portrait" | "watermark" | "bgfx">(
    "lens",
  );
  const [scene, setScene] = useState<"none" | "shadow" | "shapes">("none");
  const [bgVal, setBgVal] = useState<"trans" | "color" | "image" | "upload">(
    "color",
  );

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
  const solids = [
    "#111009",
    "#F7F5EF",
    "#F0E9D8",
    "#D4CCC0",
    "#C8C0B4",
    "#B0A898",
  ];
  const grads = [
    "linear-gradient(145deg,#E8E0D4,#C8BFB4)",
    "linear-gradient(135deg,#2A2420,#1A1410)",
    "linear-gradient(145deg,#F0EAE0,#D8D0C4)",
    "linear-gradient(160deg,#DDD5C8,#B8B0A4)",
  ];

  return (
    <div className="k-studio__sb-scroll">
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
              >
                Default 16:9
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--ks-t3)",
                  fontFamily: "var(--ks-fm)",
                  marginTop: 1,
                }}
              >
                1920 × 1080
              </div>
            </div>
            <StudioIcon
              name="chevD"
              size={10}
              color="rgba(255,255,255,0.28)"
            />
          </div>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {["1:1", "4:5", "9:16", "Story", "···"].map((r, i) => (
              <button
                key={r}
                type="button"
                style={{
                  height: 18,
                  padding: "0 6px",
                  borderRadius: 4,
                  background:
                    i === 0
                      ? "rgba(232,93,37,0.12)"
                      : "rgba(255,255,255,0.055)",
                  border: `1px solid ${i === 0 ? "rgba(232,93,37,0.35)" : "rgba(255,255,255,0.08)"}`,
                  fontSize: 9.5,
                  color: i === 0 ? "var(--ks-or)" : "var(--ks-t2)",
                  cursor: "pointer",
                  fontFamily: "var(--ks-fm)",
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* EFFECTS */}
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
            const on = effect === k;
            return (
              <button
                key={k}
                type="button"
                className="k-studio__tile"
                aria-pressed={on}
                onClick={() => setEffect(k)}
                style={{ minHeight: 56 }}
              >
                <StudioIcon
                  name={n}
                  size={16}
                  color={on ? "rgba(232,93,37,0.8)" : "rgba(255,255,255,0.3)"}
                />
                <span className="k-studio__tile-label">{l}</span>
              </button>
            );
          })}
        </div>
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

      {/* SOLID */}
      <div style={{ padding: "0 10px", marginTop: 11 }}>
        <div className="k-studio__lbl" style={{ marginBottom: 6 }}>
          Solid
          <span className="k-studio__lbl-line" />
        </div>
        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
          {solids.map((c, i) => (
            <div
              key={i}
              style={{
                width: 28,
                height: 20,
                borderRadius: 4,
                background: c,
                border: "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
                flexShrink: 0,
              }}
            />
          ))}
          <StudioIcon
            name="chevD"
            size={10}
            color="rgba(255,255,255,0.22)"
          />
        </div>
      </div>

      {/* GRADIENT */}
      <div style={{ padding: "0 10px", marginTop: 8 }}>
        <div className="k-studio__lbl" style={{ marginBottom: 6 }}>
          Gradient
          <span className="k-studio__lbl-line" />
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {grads.map((g, i) => (
            <div
              key={i}
              style={{
                width: 38,
                height: 26,
                borderRadius: 5,
                background: g,
                border: "1px solid rgba(255,255,255,0.07)",
                cursor: "pointer",
                flexShrink: 0,
              }}
            />
          ))}
          <StudioIcon
            name="chevD"
            size={10}
            color="rgba(255,255,255,0.22)"
          />
        </div>
      </div>

      {/* GLASS */}
      <div style={{ padding: "0 10px", marginTop: 8, marginBottom: 4 }}>
        <SectionLabel badge>Glass</SectionLabel>
        <div style={{ display: "flex", gap: 4 }}>
          {["Glass Light", "Glass Dark", "Frosted"].map((l, i) => (
            <button
              key={l}
              type="button"
              className="k-studio__tile"
              data-mode="tri"
            >
              <div
                style={{
                  width: 28,
                  height: 20,
                  borderRadius: 3,
                  background: [
                    "rgba(255,255,255,0.15)",
                    "rgba(0,0,0,0.6)",
                    "rgba(255,255,255,0.08)",
                  ][i],
                  border: `1px solid ${
                    [
                      "rgba(255,255,255,0.25)",
                      "rgba(255,255,255,0.1)",
                      "rgba(255,255,255,0.15)",
                    ][i]
                  }`,
                }}
              />
              <span className="k-studio__tile-label">{l}</span>
            </button>
          ))}
        </div>
      </div>
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
}

export function MockupStudioSidebar({
  mode,
  setMode,
  slots,
  selectedSlot,
  setSelectedSlot,
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
        <MockupBody slots={slots} selectedSlot={selectedSlot} />
      ) : (
        <FrameBody />
      )}
      {mode === "mockup" ? (
        <SlotFooter
          slots={slots}
          selectedSlot={selectedSlot}
          setSelectedSlot={setSelectedSlot}
        />
      ) : null}
    </aside>
  );
}
