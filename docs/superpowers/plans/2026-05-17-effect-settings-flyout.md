# Effect Settings Flyout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mockup Studio Frame mode'da Lens Blur + BG Effects ayar kontrollerini sol-panel-bitişik secondary flyout'a taşı; tile artık cycle/toggle yapmaz, yalnız flyout açar.

**Architecture:** Yeni izole `EffectFlyout` component (segment kontroller + Esc/dışarı-tık/disabled-state). Shell'de tek transient `activeEffectPanel: "lens"|"bgfx"|null` state (exclusive toggle, mode değişiminde reset). `sceneOverride` modeli HİÇ değişmez → resolver/compositor/snapshot/parity riski sıfır.

**Tech Stack:** Next.js + TypeScript (strict), React 17+, Vitest, Kivasy DS (token/recipe/half-pixel).

**Spec:** `docs/superpowers/specs/2026-05-17-effect-settings-flyout-design.md`

---

## Kod-gerçeği referansları (okunması zorunlu — plan bunlara dayanır)

- `src/features/mockups/studio/MockupStudioSidebar.tsx`:
  - import: `useState` (satır 26 — `useEffect`/`useRef` eklenecek); frame-scene import bloğu (33-45: `LENS_BLUR_DEFAULT`, `LensBlurConfig`, `LensBlurIntensity`, `LensBlurTarget`, `normalizeLensBlur`, `SCENE_AUTO`, `SceneOverride`, ayrıca `BgEffectConfig`/`BgEffectKind`/`BgEffectIntensity`/`BG_VIGNETTE_ALPHA`/`BG_GRAIN_OPACITY` mevcut — Phase 136).
  - Component props (satır ~908-920): `mode`, `setMode`, `sceneOverride?`, `onChangeSceneOverride?`; `activeScene = sceneOverride ?? SCENE_AUTO`; `lensTargetingSupported = studioDeviceCapability(...)`.
  - `efx` array (949-953): `lens`/`portrait`/`watermark`/`bgfx`.
  - efx tile grid + onClick (1202-1290): `isLens`/`isBgfx`/`isWired`, Lens toggle branch (1224-1239), BG cycle branch (1240-1265), `setEffect(k)` (1266), tile JSX (1268-1288: `data-testid=studio-frame-effect-${k}`, `data-active`, `data-wired`, `k-studio__tile-label`).
  - Lens inline kontrol bloğu: **satır 1291 (yorum başı) → 1413 (`) : null}`)** — `{normalizeLensBlur(activeScene.lensBlur).enabled && onChangeSceneOverride && lensTargetingSupported ? ( <div data-testid="studio-lens-blur-controls" ...> Blur target segment + Intensity segment </div> ) : null}`. Bu blok flyout'a TAŞINACAK.
- `src/features/mockups/studio/MockupStudioShell.tsx`:
  - `[mode, setMode] = useState<StudioMode>("mockup")` (satır 102; "mockup"|"frame").
  - `[sceneOverride, setSceneOverride] = useState<SceneOverride>(...)` (satır 220).
  - `<MockupStudioSidebar mode={mode} setMode={setMode} ... sceneOverride={sceneOverride} onChangeSceneOverride={setSceneOverride} />` (satır 904-920).

## File Structure

| Dosya | Sorumluluk |
|---|---|
| `EffectFlyout.tsx` (YENİ) | Flyout host: panel="lens"|"bgfx", Lens (enable+target+intensity) / BG (kind+intensity) segment içerikleri, disabled-state, Esc + dışarı-tık handler. Tek sorumluluk: ayar yüzeyi. |
| `MockupStudioSidebar.tsx` | efx tile onClick (cycle/toggle → `onOpenEffectPanel`), tile current-selection kısa etiket + open-state işareti, Lens inline blok SİL (flyout'a taşındı), EffectFlyout render. |
| `MockupStudioShell.tsx` | `activeEffectPanel` state + setter + sidebar prop; mode değişiminde reset (useEffect). |
| `studio.css` | `.k-studio__effect-flyout` konumlama (sol-sidebar-bitişik absolute) + Kivasy DS recipe. |

---

## Task 1: Shell — activeEffectPanel state + mode-reset + sidebar prop

**Files:**
- Modify: `src/features/mockups/studio/MockupStudioShell.tsx` (satır 102 mode komşuluğu + 220 sceneOverride komşuluğu + 904-920 sidebar render)

- [ ] **Step 1: activeEffectPanel state ekle**

`MockupStudioShell.tsx`'te `[sceneOverride, setSceneOverride]` tanımından (satır ~220) HEMEN SONRA ekle:

```tsx
  /* Phase 137 — Effect Settings Flyout: aktif secondary panel.
   *  Transient UI state (sceneOverride'a GİRMEZ). Exclusive —
   *  en fazla 1 flyout açık. null = kapalı. */
  const [activeEffectPanel, setActiveEffectPanel] = useState<
    "lens" | "bgfx" | null
  >(null);
```

- [ ] **Step 2: Mode değişiminde reset (useEffect)**

`MockupStudioShell.tsx`'te `useEffect` import edildiğinden emin ol (dosya başı `import { ... useEffect ... } from "react"` — yoksa ekle). `activeEffectPanel` state'inden sonra ekle:

```tsx
  /* Phase 137 — Mode değişiminde (Mockup↔Frame) flyout TAM
   *  kapanır: state null + flyout unmount (DOM'dan kalkar →
   *  içindeki Esc/dışarı-tık listener'ları + focus cleanup
   *  EffectFlyout useEffect return'ünde). Eski panel sızıntısı
   *  kalmaz (spec guardrail 6). */
  useEffect(() => {
    setActiveEffectPanel(null);
  }, [mode]);
```

- [ ] **Step 3: Sidebar'a prop geçişi**

`<MockupStudioSidebar ... onChangeSceneOverride={setSceneOverride} />` (satır ~919) içine, `onChangeSceneOverride` satırından sonra ekle:

```tsx
          activeEffectPanel={activeEffectPanel}
          onOpenEffectPanel={setActiveEffectPanel}
          onCloseEffectPanel={() => setActiveEffectPanel(null)}
```

- [ ] **Step 4: Typecheck (Sidebar prop'ları henüz tanımsız → beklenen geçici hata)**

Run: `npx tsc --noEmit 2>&1 | grep -i "MockupStudioShell\|activeEffectPanel" | head`
Expected: `MockupStudioSidebar` prop tip hatası (activeEffectPanel/onOpenEffectPanel/onCloseEffectPanel henüz Sidebar props'ta yok) — Task 2'de düzelir. Başka Shell hatası OLMAMALI.

- [ ] **Step 5: Commit**

```bash
git add src/features/mockups/studio/MockupStudioShell.tsx
git commit -m "feat(mockup): Phase 137 (1/5) — Shell activeEffectPanel state + mode-reset + sidebar prop"
```

---

## Task 2: EffectFlyout component (yeni — Lens + BG segment + disabled + Esc/dışarı-tık)

**Files:**
- Create: `src/features/mockups/studio/EffectFlyout.tsx`

- [ ] **Step 1: EffectFlyout.tsx oluştur**

Lens inline bloğunun (Sidebar 1291-1413) JSX'i bu component'e taşınır (Task 3'te Sidebar'dan silinecek). Lens segment yapısı mevcut koddan birebir; BG segment yeni ama aynı recipe. Create `src/features/mockups/studio/EffectFlyout.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import {
  BG_GRAIN_OPACITY,
  BG_VIGNETTE_ALPHA,
  type BgEffectIntensity,
  type BgEffectKind,
  LENS_BLUR_DEFAULT,
  type LensBlurConfig,
  type LensBlurIntensity,
  type LensBlurTarget,
  normalizeLensBlur,
  type SceneOverride,
} from "./frame-scene";

interface EffectFlyoutProps {
  panel: "lens" | "bgfx";
  activeScene: SceneOverride;
  lensTargetingSupported: boolean;
  onChangeSceneOverride: (next: SceneOverride) => void;
  onClose: () => void;
}

const SEG_LABEL_STYLE: React.CSSProperties = {
  fontSize: 9.5,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ks-t3)",
  marginBottom: 4,
};

/* Phase 137 — Effect Settings Flyout. Sol-sidebar-bitişik
 *  secondary panel: feature ayar yüzeyi (seçim DEĞİL — seçim
 *  sceneOverride'a yazılır, tile yansıtır). Esc + dışarı-tık
 *  ile kapanır; mode değişiminde Shell unmount eder. sceneOverride
 *  modeli DEĞİŞMEZ — yalnız bu değerleri set eden UI yüzeyi. */
export function EffectFlyout({
  panel,
  activeScene,
  lensTargetingSupported,
  onChangeSceneOverride,
  onClose,
}: EffectFlyoutProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onPointer(e: PointerEvent) {
      const el = ref.current;
      const target = e.target as Node | null;
      if (!el || !target) return;
      // flyout içi tık → kapatma. Tile tık → tile kendi toggle
      // eder (onOpenEffectPanel aynı değer → Shell aynı; ama
      // dışarı-tık tile'ı da dışarı sayar → kapat. Tile re-open
      // toggle'ı Sidebar tarafında çözülür.)
      if (el.contains(target)) return;
      const tileWrap = (target as Element).closest?.(
        "[data-effect-tile]",
      );
      if (tileWrap) return; // tile'a tık → tile handler'ı yönetir
      onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [onClose]);

  const lensCfg = normalizeLensBlur(activeScene.lensBlur);
  const bgKind: BgEffectKind | "none" =
    activeScene.bgEffect?.kind ?? "none";
  const bgIntensity: BgEffectIntensity =
    activeScene.bgEffect?.intensity ?? "medium";

  return (
    <div
      ref={ref}
      className="k-studio__effect-flyout"
      data-testid={`studio-effect-flyout-${panel}`}
      role="dialog"
      aria-label={panel === "lens" ? "Lens Blur settings" : "BG Effects settings"}
    >
      <div className="k-studio__effect-flyout-title">
        {panel === "lens" ? "Lens Blur" : "BG Effects"}
      </div>

      {panel === "lens" ? (
        <div style={{ display: "grid", gap: 8 }}>
          {/* Enable toggle (tile'dan flyout'a taşındı) */}
          <div style={{ display: "flex", gap: 4 }}>
            {(
              [
                [true, "On"],
                [false, "Off"],
              ] as [boolean, string][]
            ).map(([en, lbl]) => {
              const active = lensCfg.enabled === en;
              return (
                <button
                  key={String(en)}
                  type="button"
                  className="k-studio__tile"
                  data-testid={`studio-lens-enable-${en ? "on" : "off"}`}
                  data-active={active ? "true" : "false"}
                  aria-pressed={active}
                  onClick={() =>
                    onChangeSceneOverride({
                      ...activeScene,
                      lensBlur: en
                        ? { ...LENS_BLUR_DEFAULT }
                        : { ...lensCfg, enabled: false },
                    })
                  }
                  style={{
                    flex: 1,
                    minHeight: 30,
                    fontSize: 10.5,
                    color: active ? "var(--ks-or-bright)" : "var(--ks-t2)",
                    borderColor: active
                      ? "var(--ks-orb)"
                      : "rgba(255,255,255,0.12)",
                  }}
                >
                  {lbl}
                </button>
              );
            })}
          </div>

          {/* Disabled-state (guardrail 2): Lens off → segment'ler
           *  disabled + açık mesaj. */}
          {!lensCfg.enabled ? (
            <div
              data-testid="studio-lens-disabled-note"
              style={{
                fontSize: 10.5,
                color: "var(--ks-t3)",
                padding: "4px 0",
              }}
            >
              Lens Blur is off — enable to adjust.
            </div>
          ) : !lensTargetingSupported ? null : (
            <>
              <div>
                <div style={SEG_LABEL_STYLE}>Blur target</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {(
                    [
                      ["plate", "Plate only"],
                      ["all", "Plate + items"],
                    ] as [LensBlurTarget, string][]
                  ).map(([t, lbl]) => {
                    const active = lensCfg.target === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        className="k-studio__tile"
                        data-testid={`studio-lens-target-${t}`}
                        data-active={active ? "true" : "false"}
                        aria-pressed={active}
                        onClick={() =>
                          onChangeSceneOverride({
                            ...activeScene,
                            lensBlur: { ...lensCfg, target: t },
                          })
                        }
                        style={{
                          flex: 1,
                          minHeight: 30,
                          fontSize: 10.5,
                          color: active
                            ? "var(--ks-or-bright)"
                            : "var(--ks-t2)",
                          borderColor: active
                            ? "var(--ks-orb)"
                            : "rgba(255,255,255,0.12)",
                        }}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div style={SEG_LABEL_STYLE}>Intensity</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {(
                    [
                      ["soft", "Soft"],
                      ["medium", "Medium"],
                      ["strong", "Strong"],
                    ] as [LensBlurIntensity, string][]
                  ).map(([iv, lbl]) => {
                    const active = lensCfg.intensity === iv;
                    return (
                      <button
                        key={iv}
                        type="button"
                        className="k-studio__tile"
                        data-testid={`studio-lens-intensity-${iv}`}
                        data-active={active ? "true" : "false"}
                        aria-pressed={active}
                        onClick={() =>
                          onChangeSceneOverride({
                            ...activeScene,
                            lensBlur: { ...lensCfg, intensity: iv },
                          })
                        }
                        style={{
                          flex: 1,
                          minHeight: 30,
                          fontSize: 10.5,
                          color: active
                            ? "var(--ks-or-bright)"
                            : "var(--ks-t2)",
                          borderColor: active
                            ? "var(--ks-orb)"
                            : "rgba(255,255,255,0.12)",
                        }}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {/* BG Effects: Kind segment */}
          <div>
            <div style={SEG_LABEL_STYLE}>Effect</div>
            <div style={{ display: "flex", gap: 4 }}>
              {(
                [
                  ["none", "None"],
                  ["vignette", "Vignette"],
                  ["grain", "Grain"],
                ] as [BgEffectKind | "none", string][]
              ).map(([kd, lbl]) => {
                const active = bgKind === kd;
                return (
                  <button
                    key={kd}
                    type="button"
                    className="k-studio__tile"
                    data-testid={`studio-bg-kind-${kd}`}
                    data-active={active ? "true" : "false"}
                    aria-pressed={active}
                    onClick={() =>
                      onChangeSceneOverride({
                        ...activeScene,
                        bgEffect:
                          kd === "none"
                            ? undefined
                            : {
                                kind: kd,
                                intensity: bgIntensity,
                              },
                      })
                    }
                    style={{
                      flex: 1,
                      minHeight: 30,
                      fontSize: 10.5,
                      color: active
                        ? "var(--ks-or-bright)"
                        : "var(--ks-t2)",
                      borderColor: active
                        ? "var(--ks-orb)"
                        : "rgba(255,255,255,0.12)",
                    }}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Intensity segment — kind=none → disabled (guardrail 2:
           *  gizleme değil disable; layout zıplamasın). */}
          <div>
            <div style={SEG_LABEL_STYLE}>Intensity</div>
            <div style={{ display: "flex", gap: 4 }}>
              {(
                [
                  ["soft", "Soft"],
                  ["medium", "Medium"],
                  ["strong", "Strong"],
                ] as [BgEffectIntensity, string][]
              ).map(([iv, lbl]) => {
                const disabled = bgKind === "none";
                const active = !disabled && bgIntensity === iv;
                return (
                  <button
                    key={iv}
                    type="button"
                    className="k-studio__tile"
                    data-testid={`studio-bg-intensity-${iv}`}
                    data-active={active ? "true" : "false"}
                    data-disabled={disabled ? "true" : "false"}
                    aria-pressed={active}
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      onChangeSceneOverride({
                        ...activeScene,
                        bgEffect: {
                          kind: bgKind as BgEffectKind,
                          intensity: iv,
                        },
                      });
                    }}
                    style={{
                      flex: 1,
                      minHeight: 30,
                      fontSize: 10.5,
                      opacity: disabled ? 0.4 : 1,
                      cursor: disabled ? "not-allowed" : "pointer",
                      color: active
                        ? "var(--ks-or-bright)"
                        : "var(--ks-t2)",
                      borderColor: active
                        ? "var(--ks-orb)"
                        : "rgba(255,255,255,0.12)",
                    }}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

(Not: `BG_VIGNETTE_ALPHA`/`BG_GRAIN_OPACITY` import edildi ama doğrudan kullanılmıyor — kaldır; yalnız `BgEffectIntensity`/`BgEffectKind`/`LENS_BLUR_DEFAULT`/`LensBlurConfig`/`LensBlurIntensity`/`LensBlurTarget`/`normalizeLensBlur`/`SceneOverride` gerekli. `LensBlurConfig` tip-only kullanılıyorsa `import type` ile. tsc unused-import uyarısı çıkarsa temizle.)

- [ ] **Step 2: Typecheck (component izole derlenmeli)**

Run: `npx tsc --noEmit 2>&1 | grep -i "EffectFlyout" | head`
Expected: `EffectFlyout.tsx` içinde tip hatası YOK (unused import varsa onu temizle, sonra tekrar). Shell hatası (Task 1'den prop) hâlâ olabilir — Task 3'te kapanır.

- [ ] **Step 3: Commit**

```bash
git add src/features/mockups/studio/EffectFlyout.tsx
git commit -m "feat(mockup): Phase 137 (2/5) — EffectFlyout component (Lens enable/target/intensity + BG kind/intensity + Esc/dışarı-tık/disabled-state)"
```

---

## Task 3: Sidebar — tile onClick flyout-open + Lens inline blok SİL + EffectFlyout render + current-selection etiket

**Files:**
- Modify: `src/features/mockups/studio/MockupStudioSidebar.tsx` (props ~908-920, import 26+33-45, efx tile 1202-1290, Lens inline blok 1291-1413)

- [ ] **Step 1: Props + import ekle**

`MockupStudioSidebar.tsx` props interface'ine (`onChangeSceneOverride?` komşuluğu, ~satır 914) ekle:

```tsx
  activeEffectPanel?: "lens" | "bgfx" | null;
  onOpenEffectPanel?: (panel: "lens" | "bgfx" | null) => void;
  onCloseEffectPanel?: () => void;
```
Component parametre destructuring'ine (`onChangeSceneOverride,` komşuluğu) ekle: `activeEffectPanel, onOpenEffectPanel, onCloseEffectPanel,`.
Dosya başına import ekle (satır 27 `import { StudioIcon }` komşuluğu): `import { EffectFlyout } from "./EffectFlyout";`

- [ ] **Step 2: efx tile onClick → flyout-open (cycle/toggle SİL) + current-selection etiket**

`efx.map(...)` bloğunda (satır 1202-1290), tile'ın `onClick` ve label kısmını değiştir. **Mevcut** `onClick={() => { if (isLens) {...} if (isBgfx) {...} setEffect(k); }}` ve `<span className="k-studio__tile-label">{l}</span>` yerine:

```tsx
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
```
Ve tile JSX'inde `data-testid={...}` satırına ek attribute + label'ı kısa-selection ile değiştir. `<button ...>` açılışına ekle (mevcut `data-wired` satırından sonra):

```tsx
                data-effect-tile={k}
                aria-expanded={
                  k === "lens" || k === "bgfx"
                    ? activeEffectPanel === k
                    : undefined
                }
```
`<span className="k-studio__tile-label">{l}</span>` yerine (kısa current-selection — guardrail 1):

```tsx
                <span className="k-studio__tile-label">
                  {k === "lens" && lensCfg.enabled
                    ? `Blur · ${
                        normalizeLensBlur(activeScene.lensBlur).target ===
                        "plate"
                          ? "Plate"
                          : "All"
                      }`
                    : k === "bgfx" && bgKind === "vignette"
                      ? "Vignette"
                      : k === "bgfx" && bgKind === "grain"
                        ? "Grain"
                        : l}
                </span>
```
(`lensCfg`/`bgKind` zaten bu map scope'unda tanımlı — satır 1208/1212. `on` değişkeni de aynı kalır → tile turuncu active state selected'ı gösterir; `aria-expanded` open'ı ayrı gösterir = spec §10.1 selected≠open.)

- [ ] **Step 3: Lens inline kontrol bloğunu SİL**

`MockupStudioSidebar.tsx` satır **1291 (yorum `{/* Phase 109 — Lens Blur target + intensity ...`) → 1413 (`) : null}`)** arasındaki tüm bloğu KALDIR (efx `</div>` kapanışı satır 1290'dan sonra, `{/* SCENE */}` yorumundan önce). Bu blok artık EffectFlyout'ta (Task 2). Yerine HİÇBİR ŞEY koyma (flyout ayrı render edilecek — Step 4).

- [ ] **Step 4: EffectFlyout render (sidebar köküne)**

Sidebar'ın render return'ünde, en dış sarmalayıcı (root `<div>` / `<aside>`) içinde EN SONA (kapanış tag'inden hemen önce) ekle:

```tsx
      {(activeEffectPanel === "lens" || activeEffectPanel === "bgfx") &&
      onChangeSceneOverride ? (
        <EffectFlyout
          panel={activeEffectPanel}
          activeScene={activeScene}
          lensTargetingSupported={lensTargetingSupported}
          onChangeSceneOverride={onChangeSceneOverride}
          onClose={onCloseEffectPanel ?? (() => undefined)}
        />
      ) : null}
```

- [ ] **Step 5: Typecheck — tüm zincir kapanmalı**

Run: `npx tsc --noEmit 2>&1 | tail -3; echo "exit $?"`
Expected: **exit 0, hata yok** (Shell prop'ları + Sidebar props + EffectFlyout hepsi bağlandı; `setEffect`/`effect` hâlâ portrait/watermark/vfx için kullanılıyor, kalır).

- [ ] **Step 6: Commit**

```bash
git add src/features/mockups/studio/MockupStudioSidebar.tsx
git commit -m "feat(mockup): Phase 137 (3/5) — tile flyout-open (cycle/toggle SİL) + Lens inline blok flyout'a taşındı + current-selection etiket + EffectFlyout render"
```

---

## Task 4: studio.css — flyout konumlama (sol-sidebar-bitişik, Kivasy DS)

**Files:**
- Modify: `src/features/mockups/studio/studio.css`

- [ ] **Step 1: Mevcut sidebar genişliği + z-index pattern oku**

Run: `grep -n "k-studio__sidebar\|k-studio__rail\|z-index\|--ks-side\|width:.*2[0-9][0-9]px\|position: absolute" src/features/mockups/studio/studio.css | head -20`
(Sidebar genişliği + mevcut z-index katmanlarını gör — flyout sidebar üstü ama rail/modal altı; sidebar'ın sağ kenar koordinatını referans al.)

- [ ] **Step 2: Flyout CSS ekle**

`studio.css` sonuna ekle (mevcut `--ks-*` token + recipe konvansiyonu; Step 1'de bulduğun sidebar genişliğine göre `left` ayarla — örnek değer sidebar ~210-220px ise):

```css
/* Phase 137 — Effect Settings Flyout: sol-sidebar-bitişik
 *  secondary panel. Sol sidebar'ın sağ kenarından açılır,
 *  stage üstüne biner (kaba modal değil — hafif floating).
 *  Genişlik dar (guardrail 4: stage'i boğmaz). */
.k-studio__effect-flyout {
  position: absolute;
  top: 64px;
  left: var(--ks-sidebar-w, 220px);
  width: 252px;
  max-height: calc(100% - 96px);
  overflow-y: auto;
  z-index: 40;
  padding: 12px;
  background: var(--ks-s1, #14130f);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  display: grid;
  gap: 10px;
  animation: k-studio-flyout-in 120ms ease-out;
}
@keyframes k-studio-flyout-in {
  from {
    opacity: 0;
    transform: translateX(-6px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
.k-studio__effect-flyout-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ks-t1, #f4f1ea);
  letter-spacing: 0.01em;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
```
(`--ks-sidebar-w` yoksa Step 1'deki gerçek sidebar genişliği sabitini kullan, örn. `left: 220px`. `--ks-s1`/`--ks-t1` yoksa Step 1'de bulduğun mevcut surface/text token'larını kullan — Kivasy DS tutarlılığı.)

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && NODE_OPTIONS=--max-old-space-size=4096 npx next build 2>&1 | grep -E "Compiled successfully|Failed|error" | head`
Expected: tsc temiz; `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add src/features/mockups/studio/studio.css
git commit -m "feat(mockup): Phase 137 (4/5) — effect flyout konumlama (sol-sidebar-bitişik absolute, Kivasy DS, dar genişlik)"
```

---

## Task 5: Quality gates + browser doğrulama + final

**Files:** (doğrulama — kod değişikliği yalnız regresyon düzeltmesi gerekirse)

- [ ] **Step 1: Quality gates**

Run: `npx tsc --noEmit && npx vitest run tests/unit/mockup && NODE_OPTIONS=--max-old-space-size=4096 npx next build`
Expected: tsc exit 0; mockup suite **284+ PASS** (model değişmedi → resolver/bg-effects testleri aynen geçer; regresyon YOK); build `✓ Compiled successfully`.

- [ ] **Step 2: Clean restart**

```bash
(lsof -ti:3000 | xargs kill -9 2>/dev/null; sleep 1) && rm -rf .next && nohup npm run dev > /tmp/kivasy-dev.log 2>&1 &
until grep -qE "Ready in|✓ Ready" /tmp/kivasy-dev.log 2>/dev/null; do sleep 2; done; echo "READY"
```

- [ ] **Step 3: Browser doğrulama (zorunlu — guardrail 1-6)**

Claude in Chrome, test set `cmov0ia370019149ljyu7divh` → `/mockup/studio` → Frame mode, büyük ekran:
- (a) Lens Blur tile → flyout açılır (sidebar-bitişik, dar ~252px), enable On/Off + target + intensity çalışır; Lens Off → segment'ler disabled + "Lens Blur is off — enable to adjust" mesajı.
- (b) BG Effects tile → flyout, Effect [None|Vignette|Grain] + Intensity segment; None → intensity disabled (opacity 0.4, tıklanamaz, layout zıplamaz).
- (c) Exclusive: Lens açıkken BG tile tıkla → Lens kapanır, BG açılır.
- (d) Kapanma: dışarı-tık + Esc + aynı-tile (toggle) + mode-değişimi (Mockup↔Frame) — hepsi temiz; flyout DOM'dan kalkar.
- (e) **Selected≠Open (guardrail 5):** BG Vignette seç + panel kapat → tile turuncu + "Vignette" etiket, flyout YOK; tile tekrar aç → `aria-expanded=true` (open işareti) + flyout; BG None iken panel aç → tile turuncu DEĞİL ama flyout açık. DOM ile `data-active`/`aria-expanded`/`k-studio__tile-label` teyit.
- (f) **Genişlik/yoğunluk (guardrail 4):** flyout dar, stage'i boğmuyor, segment'ler satır kırmıyor.
- (g) **Mode temizlik (guardrail 6):** flyout açıkken mode değiştir → flyout unmount, console error YOK (`read_console_messages onlyErrors`), tile `aria-expanded` false.
- (h) Sol panel scroll: Lens inline kontroller artık yok → sol panel şişmiyor (DOM: `studio-lens-blur-controls` artık sidebar'da YOK, flyout'ta).
- Parity regresyon kontrolü: BG vignette/grain hâlâ preview'da render (`data-bg-vignette`/`data-bg-grain` DOM'da, opacity doğru) — model değişmedi kanıtı.

Sorun çıkarsa: ilgili dosyada minimal düzelt → tsc + vitest + ilgili commit (`fix(mockup): Phase 137 (5/5 fix) — <ne>`).

- [ ] **Step 4: Contract + known-issues güncelle**

`docs/claude/mockup-studio-rail-preview.md` (rail/sidebar interaction) veya `mockup-studio-contract.md` §6 (right rail / sidebar behavior) — kısa normatif not: "Frame mode ayarlı effect'ler (Lens Blur, BG Effects) sol-sidebar-bitişik EffectFlyout secondary panel ile ayarlanır; tile cycle/toggle YAPMAZ (yalnız exclusive flyout açar); sceneOverride modeli değişmez; selected (tile turuncu+etiket) ≠ open (aria-expanded+flyout) ayrı sinyal; Esc/dışarı-tık/aynı-tile/mode-değişimi kapatır." `mockup-studio-contract.md` §0 "Son güncelleme" → Phase 137. `known-issues-and-deferred.md`: Portrait/Watermark/VFX/Tilt hâlâ honest-disabled (panele alınmadı) notu — Phase 137'de değişmedi, korundu.

- [ ] **Step 5: Commit + push + finishing**

```bash
git add docs/claude/mockup-studio-contract.md docs/claude/known-issues-and-deferred.md docs/claude/mockup-studio-rail-preview.md
git commit -m "docs(mockup): Phase 137 (5/5) — Effect Flyout Contract notu + known-issues + browser parity doğrulandı"
git push origin main
```
REQUIRED SUB-SKILL: `superpowers:finishing-a-development-branch`.

---

## Final raporda zorunlu (spec §14)

1. UX modeli. 2. Taşınan/taşınmayan feature'lar. 3. BG Effects yeni seçim+ayar. 4. Lens Blur değişimi (inline→flyout). 5. **Selected≠Open UX çözümü** (tile turuncu+etiket vs aria-expanded+flyout). 6. **Flyout kapalıyken seçili effect nasıl anlaşılıyor** (tile etiketi). 7. **Panel açıkken "yalnız ayar yüzeyi" hissi** (flyout başlık + segment-only + kapanınca seçim kalır). 8. Scroll/yoğunluk çözümü (Lens inline çıktı). 9. Değişen dosyalar. 10. Browser state'leri (guardrail 1-6 + 4-kombinasyon + mode-temizlik).
