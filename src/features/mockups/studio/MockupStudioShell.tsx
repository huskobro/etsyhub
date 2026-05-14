"use client";

/* Phase 77 — Studio shell composer.
 *
 * Final HTML "App" component → MockupStudioShell:
 *   - mode state (Mockup / Frame) — sidebar tabs + dev sw
 *   - appState state (working / empty / preview / render / renderDone)
 *     — toolbar Edit/Preview + stage state surfaces + dev sw
 *   - selectedSlot state (mockup mode device cascade selection)
 *
 * Bu bileşen yalnız UI state taşır. Render dispatch + selection set
 * binding'i Phase 78+ candidate; bu turda görsel state'ler yeterli
 * kanıt için yerinde.
 *
 * Studio route entry: `/selection/sets/[setId]/mockup/studio`.
 * Apply route (`/mockup/apply`) ve admin yüzeyleri bozulmadan kalır.
 */

import { useState } from "react";
import "./studio.css";
import { MockupStudioPresetRail } from "./MockupStudioPresetRail";
import { MockupStudioSidebar } from "./MockupStudioSidebar";
import { MockupStudioStage } from "./MockupStudioStage";
import { MockupStudioToolbar } from "./MockupStudioToolbar";
import { STUDIO_SAMPLE_DESIGNS } from "./svg-art";
import type { StudioAppState, StudioMode, StudioSlotMeta } from "./types";

const SLOT_NAMES = ["Front View", "Side View", "Back View"];

const WORKING_SLOTS: ReadonlyArray<StudioSlotMeta> = [
  {
    id: 1,
    name: SLOT_NAMES[0]!,
    assigned: true,
    design: STUDIO_SAMPLE_DESIGNS.d1,
  },
  {
    id: 2,
    name: SLOT_NAMES[1]!,
    assigned: true,
    design: STUDIO_SAMPLE_DESIGNS.d2,
  },
  { id: 3, name: SLOT_NAMES[2]!, assigned: false, design: null },
];

const EMPTY_SLOTS: ReadonlyArray<StudioSlotMeta> = [
  { id: 1, name: SLOT_NAMES[0]!, assigned: false, design: null },
  { id: 2, name: SLOT_NAMES[1]!, assigned: false, design: null },
  { id: 3, name: SLOT_NAMES[2]!, assigned: false, design: null },
];

export interface MockupStudioShellProps {
  /**
   * Selection set id this studio session is anchored on. Phase 77 görsel
   * yüzey: sadece toolbar back href ve operatöre context için kullanılır;
   * gerçek selection items + template binding Phase 78+ candidate (Phase
   * 75 backend zaten `RenderInput.designUrls[]` hazır).
   */
  setId: string;
  /** Operator-friendly set name; toolbar template pill'inde gösterilir. */
  setName?: string | null;
}

export function MockupStudioShell({ setId, setName }: MockupStudioShellProps) {
  const [mode, setMode] = useState<StudioMode>("mockup");
  const [appState, setAppState] = useState<StudioAppState>("working");
  const [selectedSlot, setSelectedSlot] = useState(0);

  const slots = appState === "empty" ? EMPTY_SLOTS : WORKING_SLOTS;
  const backHref = `/selections/${setId}`;
  const templateLabel =
    mode === "frame"
      ? "Default 16:9"
      : (setName?.trim() || "Hero Phone Bundle");
  const statusLabel = mode === "frame" ? "1920×1080" : "Active";

  return (
    <div className="k-studio" data-testid="studio-shell" data-mode={mode}>
      <MockupStudioToolbar
        mode={mode}
        appState={appState}
        setAppState={setAppState}
        templateLabel={templateLabel}
        statusLabel={statusLabel}
        backHref={backHref}
      />
      <div className="k-studio__body">
        <MockupStudioSidebar
          mode={mode}
          setMode={setMode}
          slots={slots}
          selectedSlot={selectedSlot}
          setSelectedSlot={setSelectedSlot}
        />
        <MockupStudioStage
          mode={mode}
          slots={slots}
          selectedSlot={selectedSlot}
          setSelectedSlot={setSelectedSlot}
          appState={appState}
          setAppState={setAppState}
        />
        <MockupStudioPresetRail mode={mode} appState={appState} />
      </div>
      {/* Phase 77 dev/demo switcher — mode + state arasında geçiş yapılır.
          UI design parity için final HTML'deki "sw" overlay'i; Phase 78
          gerçek render pipeline bağlanınca kaldırılır veya admin-only
          ops yardımcısına dönüşür. */}
      <div className="k-studio__sw" data-testid="studio-state-switcher">
        <span className="k-studio__sw-lbl">MODE</span>
        <button
          type="button"
          className="k-studio__sw-btn"
          aria-pressed={mode === "mockup"}
          onClick={() => setMode("mockup")}
          data-testid="studio-sw-mode-mockup"
        >
          Mockup
        </button>
        <button
          type="button"
          className="k-studio__sw-btn"
          aria-pressed={mode === "frame"}
          onClick={() => setMode("frame")}
          data-testid="studio-sw-mode-frame"
        >
          Frame
        </button>
        <span className="k-studio__sw-sep" aria-hidden />
        <span className="k-studio__sw-lbl">STATE</span>
        {(
          [
            { id: "working", l: "Working" },
            { id: "empty", l: "Empty" },
            { id: "preview", l: "Preview" },
            { id: "render", l: "Render" },
          ] as const
        ).map((s) => {
          const on =
            appState === s.id ||
            (s.id === "render" && appState === "renderDone");
          return (
            <button
              key={s.id}
              type="button"
              className="k-studio__sw-btn"
              aria-pressed={on}
              onClick={() => setAppState(s.id)}
              data-testid={`studio-sw-state-${s.id}`}
            >
              {s.l}
            </button>
          );
        })}
      </div>
    </div>
  );
}
