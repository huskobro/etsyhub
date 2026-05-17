# Effect Settings Flyout — Design

**Tarih:** 2026-05-17
**Durum:** Onaylandı (3 guardrail ile) — implementasyona hazır
**Kapsam:** Mockup Studio Frame mode'da ayarlı effect'leri (Lens Blur + BG Effects) sol-panel-bitişik secondary flyout'a taşıma
**İlgili authoritative doc:** `docs/claude/mockup-studio-contract.md` (§7.5 Lens Blur, §7.7 BG Effects, §11.0 parity), `docs/claude/mockup-studio-rail-preview.md`

---

## 1. Problem

Frame mode sol panelinde:
- **BG Effects tile** tek-tıkla cycle uyguluyor (none→vignette→grain→none), intensity hep medium — kontrol hissi zayıf, ayar seçilemiyor, hangi effect uygulandığı net değil.
- **Lens Blur** target+intensity kontrolleri (`MockupStudioSidebar.tsx` ~1291-1420, ~130 satır) `efx` tile grid'inin HEMEN ALTINA inline render ediliyor → sol panel şişiyor, scroll ihtiyacı.

Hedef: Shots.so modeli — sol panel = feature giriş noktası, sağa açılan secondary panel = detay ayarları. Yalnız BG Effects fix değil, **ayarlı effect interaction modelini toparlama**.

## 2. Çözüm — Sol-panel-bitişik flyout

Sol sidebar'ın SAĞ kenarından açılan floating panel (Shots.so birebir). Sol ana panel **sabit** kalır (scroll/şişme yok). Sağ rail (zoom/navigator) **dokunulmaz**. Full-drawer/accordion DEĞİL.

```
[sol sidebar] [EffectFlyout→] [   stage   ] [sağ rail]
  Effects        Lens Blur
  • Lens Blur     ├ Enable: On/Off
  • BG Effects    ├ Target: Plate only | Plate + items
  (sol sabit)     └ Intensity: Soft | Medium | Strong
                  (detay flyout'ta, stage üzeri)
                  sağ rail DOKUNULMAZ
```

## 3. State (Shell)

Tek transient UI state — `sceneOverride`'a GİRMEZ:
```ts
const [activeEffectPanel, setActiveEffectPanel] =
  useState<"lens" | "bgfx" | null>(null);
```
- Exclusive: en fazla 1 flyout açık.
- Lens Blur tile → `"lens"`; BG Effects tile → `"bgfx"` (biri açılınca diğeri kapanır — `setActiveEffectPanel` tek değer).
- **Kapanma kuralları** (hepsi `setActiveEffectPanel(null)`):
  - Aynı tile'a tekrar tık (toggle).
  - `Esc` (keydown listener; flyout açıkken).
  - Dışarı tık (flyout + tile dışı pointerdown).
  - Mode değişimi (Mockup↔Frame) — Shell mode state değişince reset.
  - honest-disabled tile (Portrait/Watermark/VFX/Tilt) zaten `onOpenEffectPanel` çağırmaz → flyout açılmaz.

## 4. Tile davranışı değişimi

- **Lens Blur tile:** enabled-toggle YAPMAZ → yalnız `onOpenEffectPanel("lens")`. Enable/disable flyout içinde.
- **BG Effects tile:** cycle YAPMAZ (mevcut none→vignette→grain→none KALDIRILIR) → yalnız `onOpenEffectPanel("bgfx")`.
- **Current selection göstergesi (guardrail 1 — çok kısa, taranabilir):** tile aktif effect varsa active state (turuncu) + **kısa etiket**:
  - Lens Blur enabled + target plate → `Blur · Plate`
  - Lens Blur enabled + target all → `Blur · All`
  - Lens Blur disabled → etiket yok (inactive tile)
  - BG vignette → `Vignette`
  - BG grain → `Grain`
  - BG none → etiket yok (inactive tile)
  - **Uzun açıklama YASAK** — tek-bakış kısa kod. Mevcut tile `k-studio__tile-label` yapısı kullanılır (yeni layout yok).
- **Portrait/Watermark/VFX/Tilt:** DOKUNULMAZ — ana tile + honest-disabled (`data-wired="false"`, opacity 0.78) korunur, flyout açmaz.

## 5. Flyout içerikleri (Lens Blur ↔ BG Effects aynı segment-pattern ailesi)

**Lens Blur flyout** (mevcut inline kontrol → flyout'a taşınır, davranış birebir):
- **Enable toggle** (On/Off) — flyout başına taşınır (tile'dan çıkar).
- Disabled iken (guardrail 2): flyout açık ama Target/Intensity segment'leri **disabled görünür** + "Lens Blur is off — enable to adjust" gibi açık tek satır (kullanıcı "niye bir şey olmuyor" dememeli).
- Target segment: `Plate only | Plate + items` (mevcut `studio-lens-target-*` testid korunur).
- Intensity segment: `Soft | Medium | Strong`.

**BG Effects flyout:**
- Kind segment: `None | Vignette | Grain`.
- Intensity segment: `Soft | Medium | Strong`.
- Guardrail 2: kind=`None` → intensity segment **disabled** (gri, tıklanamaz) + opsiyonel "Select an effect" tek satır. (Gizleme değil disable — segment layout sabit kalsın, görsel zıplama olmasın.)

## 6. Positioning / dismissal (guardrail 3 — polished)

- Flyout `position: absolute`, sol sidebar'ın sağ kenarına **gerçekten bitişik** (sidebar width + 0 gap; veya sidebar container içinde sağ-overflow). Kaba-modal/backdrop YOK — Shots.so gibi hafif floating panel (Kivasy DS recipe: `.k-card` benzeri panel, `--ks-*` token, half-pixel typography).
- Dışarı-tık: flyout + ilgili tile dışı `pointerdown` → kapan (kendi tile'ına tık zaten toggle).
- `Esc`: flyout açıkken `keydown` → kapan.
- Mode değişimi: Shell mode state effect'i → `activeEffectPanel = null`.
- Açılış/kapanış: hafif transition (mevcut studio CSS pattern; abartılı animasyon yok). Stage üstüne binerken z-index sidebar üstü ama rail/modal altı.

## 7. Model DEĞİŞMEZ (kritik — parity riski sıfır)

`sceneOverride.lensBlur` (`{enabled, target, intensity}`) ve `sceneOverride.bgEffect` (`{kind, intensity}`) şemaları **AYNEN korunur**. Flyout yalnız bu değerleri set eden yeni UI yüzeyi — `onChangeSceneOverride` çağrısı aynı payload'ı üretir. Dolayısıyla:
- `resolvePlateEffects` / `frame-compositor.ts` / preview CSS layer / snapshot zinciri / `FrameExportResultBanner` isStale: **HİÇ etkilenmez**.
- §11.0 Preview = Export parity riski **sıfır** (resolver/compositor değişmiyor; yalnız UI input mekanizması).
- Mevcut `bg-effects.test.ts` (8 test) + Lens Blur testleri değişmeden geçer (resolver davranışı aynı).

## 8. Mimari (yeni component, izole)

- **Yeni:** `EffectFlyout` component (`src/features/mockups/studio/` altında ayrı dosya — `EffectFlyout.tsx`). Props: `panel: "lens"|"bgfx"`, `activeScene: SceneOverride`, `onChangeSceneOverride`, `onClose`. `panel`'e göre Lens veya BG içeriği render eder.
- **Shell:** `activeEffectPanel` state + setter; `MockupStudioSidebar`'a `activeEffectPanel` + `onOpenEffectPanel` + `onCloseEffectPanel` prop geçişi; mode state değişiminde `useEffect` ile reset.
- **Sidebar:** `efx` tile onClick → `onChangeSceneOverride` cycle/toggle yerine `onOpenEffectPanel(k)` (yalnız lens/bgfx için; honest-disabled tile'lar çağırmaz). Lens inline kontrol bloğu (1291-1420) → `EffectFlyout`'a **taşınır** (silinmez, yeniden konumlanır — JSX birebir, yalnız wrapper değişir). Tile current-selection etiketi.
- Flyout konumlama: sidebar container'a göre `absolute` (CSS — `studio.css` veya inline). Esc/dışarı-tık handler `EffectFlyout` içinde (`useEffect` + cleanup).

## 9. Değişecek dosyalar (~3-4)

| Dosya | Değişiklik |
|---|---|
| `src/features/mockups/studio/EffectFlyout.tsx` | **YENİ** — flyout host, Lens/BG segment içerikleri, Esc/dışarı-tık/disabled-state |
| `src/features/mockups/studio/MockupStudioSidebar.tsx` | `efx` tile onClick (cycle/toggle → panel-open), Lens inline kontrol bloğu flyout'a taşı, tile current-selection kısa etiket, EffectFlyout render |
| `src/features/mockups/studio/MockupStudioShell.tsx` | `activeEffectPanel` state + setter + sidebar prop geçişi + mode değişiminde reset |
| `src/features/mockups/studio/studio.css` (gerekirse) | flyout konumlama (sol-sidebar-bitişik absolute) + Kivasy DS recipe |

**Dokunulmaz:** `frame-scene.ts`, `frame-compositor.ts`, `MockupStudioStage.tsx`, `media-position.ts`, `cascade-layout.ts`, `zoom-bounds.ts`, `StageScenePreview.tsx`, `FrameExportResultBanner.tsx`, snapshot zinciri, `api/frame/export/route.ts`, `frame-export.service.ts`. Portrait/Watermark/VFX/Tilt tile'ları davranışsal olarak DOKUNULMAZ.

## 10. Guardrail'ler (kullanıcı kararı)

1. **Tile current-selection etiketi çok kısa + taranabilir:** `Blur · Plate` / `Blur · All` / `Vignette` / `Grain` — uzun açıklama YASAK, active state ile hızlı okunur, mevcut tile-label yapısı.
2. **Flyout disabled state net:** Lens Blur off → flyout'ta segment'ler disabled + açık tek-satır mesaj; BG None → intensity segment disabled (gizleme değil — layout zıplamasın). Kullanıcı "niye bir şey olmuyor" dememeli.
3. **Positioning/dismissal polished:** sidebar'a gerçekten bitişik, kaba-modal hissi yok, dışarı-tık+Esc+aynı-tile+mode-değişimi temiz kapanır.
4. **Flyout genişliği/yoğunluğu kontrollü:** sabit dar genişlik (~240-280px civarı, sidebar genişliğine yakın — stage'i gereksiz örtmez). Segment kontroller satır kırmaz: her segment grubu tek satır (2-3 buton), buton min-width yeterli + font half-pixel (`text-[10.5px]`/`12.5px` Kivasy DS); sıkışık ama okunabilir. İçerik dikey kısa (Lens: enable+target+intensity = 3 satır grup; BG: kind+intensity = 2 satır grup) — flyout yüksekliği stage'i boğmaz.
5. **Selected state ≠ Open state (görsel net ayrım):** bkz. §10.1 — feature-seçili (tile) ile panel-açık (flyout) AYRI görsel dil; karışmaz.
6. **Mode değişiminde TAM temizlik:** yalnız `activeEffectPanel=null` değil — flyout DOM unmount + içindeki Esc/dışarı-tık listener'ları cleanup (useEffect return) + flyout içi focus varsa blur (focus trap sızıntısı yok) + aria-expanded tile'da false. Mode değişiminde eski panel state/focus/listener sızıntısı KALMAZ.

## 10.1 Selected state ≠ Open state — UX ayrımı (guardrail 5)

İki bağımsız kavram, **görsel olarak net ayrı** (kullanıcı "feature seçili mi?" ile "panel açık mı?"yı karıştırmamalı):

- **Selected (feature aktif):** `sceneOverride`'da effect var (lensBlur.enabled / bgEffect.kind≠none). Göstergesi: **tile'da turuncu active state + kısa etiket** (`Blur · Plate` / `Vignette`). Flyout KAPALI olsa bile görünür — operatör panele bakmadan ne seçili anlar.
- **Open (panel açık):** `activeEffectPanel === k`. Göstergesi: **flyout görünür + tile'da AYRI bir "panel açık" işareti** (örn. tile sağ kenarında küçük chevron/caret yön değişimi veya ince outline-ring — active turuncu fill'den FARKLI bir sinyal). `aria-expanded={open}` tile'da.
- **4 kombinasyon hepsi net:**
  - seçili + kapalı → tile turuncu + etiket, flyout yok (en sık durum: ayar yaptın, paneli kapattın).
  - seçili + açık → tile turuncu + etiket + panel-açık işareti, flyout görünür.
  - seçilmemiş + açık → tile turuncu DEĞİL (None/disabled) + panel-açık işareti, flyout görünür (BG `None` seçiliyken panel açık — ayar yapmaya hazır).
  - seçilmemiş + kapalı → nötr tile.
- **Flyout = "yalnız ayar yüzeyi" hissi:** flyout başlığı feature adını taşır ("Lens Blur" / "BG Effects") + içerik yalnız segment kontroller; flyout kendisi "seçim" değil "ayarlama" yapar (seçim sceneOverride'a yazılır, tile yansıtır). Flyout kapanınca seçim KAYBOLMAZ (tile etiketi kanıt). Bu, panelin geçici/yardımcı olduğunu hissettirir — kaba modal/kalıcı sekme değil.

## 11. Scope dışı (bilinçli)

- Portrait/Watermark/VFX/Tilt'i panele almak (honest-disabled, ayarı yok — boş/sahte panel YASAK; ileride wire edilince aynı pattern).
- `sceneOverride` şema değişikliği (model aynı kalır).
- Slider-based intensity (segment 3-kademeye uygun + Lens Blur ile tutarlı).
- Çoklu flyout (exclusive tek flyout).
- Sağ rail / zoom / navigator / framing / shared resolver değişikliği.

## 12. Test stratejisi

- **Unit:** Yeni UI mantığı (tile→panel-open, exclusive toggle, disabled-state derivation) saf-fonksiyon test edilebilir kısımları (örn. current-selection etiket türetme helper'ı varsa). sceneOverride resolver testleri DEĞİŞMEZ (model aynı).
- **Quality gates:** `tsc --noEmit` + `vitest run tests/unit/mockup` (mevcut 284 + bg-effects 8 — regresyon yok, model değişmedi) + `next build`.
- **Browser (zorunlu, guardrail 1-6):** clean restart + fresh build → Frame mode, büyük ekran:
  - (a) Lens Blur tile → flyout açılır (sidebar-bitişik), enable/target/intensity çalışır, disabled-state net (Lens off → segment'ler disabled + mesaj).
  - (b) BG Effects tile → flyout, kind+intensity segment, None→intensity disabled (layout zıplamaz).
  - (c) Exclusive toggle (lens açıkken bgfx tıkla → lens kapanır, bgfx açılır).
  - (d) Kapanma: dışarı-tık + Esc + aynı-tile + mode-değişimi — hepsi temiz.
  - (e) **Selected≠Open (guardrail 5):** BG `Vignette` seç + paneli kapat → tile turuncu+`Vignette` etiket, flyout YOK; sonra tile aç → panel-açık işareti AYRI görünür; BG `None` iken panel aç → tile turuncu DEĞİL ama panel-açık işareti var. 4 kombinasyon görsel net.
  - (f) **Flyout genişlik/yoğunluk (guardrail 4):** flyout dar (~240-280px), stage'i boğmuyor, segment'ler satır kırmıyor, okunabilir.
  - (g) **Mode değişimi tam temizlik (guardrail 6):** flyout açıkken Mockup↔Frame → flyout unmount, listener sızıntısı yok (console error yok), tile aria-expanded false.
  - (h) Sol panel scroll azaldı mı (Lens kontrolleri artık inline değil — şişme gitti).
  - (i) Shots.so hissine yakın ama Kivasy DS (token/recipe/half-pixel).

## 13. Riskler

- **Flyout konumlama (absolute) layout taşması:** sidebar container overflow/z-index dikkat; sağ rail/stage ile çakışma olmamalı (browser doğrulama kritik). Risk düşük — yalnız sol-sidebar-bitişik, sağ tarafa uzanmaz.
- **Lens inline → flyout taşıma sırasında davranış kayması:** JSX birebir taşınmalı (yalnız wrapper); testid'ler (`studio-lens-target-*`, `studio-lens-blur-controls`) korunmalı. Davranış değişmemeli — yalnız konum.

## 14. Final raporda zorunlu (kullanıcı isteği)

1. UX olarak hangi model seçildi.
2. Hangi feature'lar flyout'a taşındı / hangileri bilerek taşınmadı.
3. BG Effects artık nasıl seçiliyor + ayarlanıyor.
4. Lens Blur nasıl değişti (inline → flyout).
5. **Selected state ile Open state ayrımını UX'te nasıl çözdün** (görsel sinyal farkı — tile turuncu+etiket vs panel-açık işareti).
6. **Flyout kapalıyken kullanıcı hangi effect'in seçili olduğunu nasıl anlıyor** (tile etiketi + active state).
7. **Panel açıkken bunun yalnız "ayar yüzeyi" olduğu nasıl hissediliyor** (flyout başlık + segment-only + kapanınca seçim kaybolmaz).
8. Scroll/yoğunluk problemi nasıl düzeldi (Lens inline kontroller sol panelden çıktı).
9. Değişen dosyalar.
10. Browser'da hangi state'lerde doğrulandı (guardrail 1-6 + 4-kombinasyon + mode-değişimi temizliği).
