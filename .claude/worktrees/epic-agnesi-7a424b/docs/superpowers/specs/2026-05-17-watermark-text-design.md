# Watermark (text) — İlk Tur Tasarım Spec'i

> **Status:** Design approved by operator 2026-05-17. Bu spec
> implementasyon planının (writing-plans) girdisidir.
> **Scope:** Mockup Studio Frame mode — text watermark ilk tur.
> **Pattern kaynağı:** BG Effects (Phase 136) + Effect Settings
> Flyout (Phase 137) kanıtlanmış pattern'i birebir izlenir.

---

## 1. Neden Watermark — Portrait'ten önce

Effect Settings Flyout modeli (Phase 137) ve BG Effects pattern
(Phase 136) oturmuş durumda. Watermark bu kanıtlanmış pattern'in
üstüne **yeni mimari risk açmadan** oturur:

- Effect interaction pattern (tile = entry, flyout = settings,
  `activeEffectPanel` exclusive state) stabil.
- BG Effects'in `SceneOverride` alanı + resolver + preview layer +
  Sharp composite phase + snapshot persistence zinciri birebir
  şablon olarak kullanılabilir.
- Operatör değeri net ve görünür: Etsy satıcısı mockup'a kontrollü
  imza / anti-copy mark koyar (dijital ürün, printable, template,
  preview koruma).

Portrait alternatifi plate-only / framing semantiği taşır (Phase
135'te zorlukları görüldü — zoom-aware pan reach, plate isolation).
Watermark bu mimari riski taşımaz; "kanıtlanmış küçük ama güçlü"
ilk tur ilkesine daha uygun.

---

## 2. İlk Tur Scope

### 2.1 Kapsam içi (ilk tur)

- **Tip:** yalnız **text watermark** (operatör bir metin yazar).
- **Katman:** **tüm frame'in en üstü** — plate + cascade item'lar +
  vignette dahil her şeyin üzerinde. "Mockup'ın üzerine imza"
  semantiği. Plate-area'ya özel clip / pan davranışı **yok**.
- **Flyout kontrol seti (4 kontrol):**
  1. **Enable** On/Off
  2. **Text input** (operatör serbest metin)
  3. **Opacity** — 3-kademeli segment (soft / medium / strong)
  4. **Placement** — 3-segment (Bottom-right / Center /
     Diagonal-tile)
- **Font:** `sans-serif` generic family (preview CSS + export SVG
  aynı generic'i kullanır — parity).

### 2.2 Kapsam dışı (bilerek Phase 2'ye ertelendi)

| Ertelenen | Neden ertelendi |
|---|---|
| Image/logo watermark | Asset upload / signed URL / image-state / logo scale parity ek karmaşıklık. Phase 2'de kanıtlanmış slot asset pipeline'ı reuse edilir. |
| Boyut (size) kontrolü | Her boyut kademesi için preview↔export font-metric parity ayrı doğrulama ister. İlk tur dar tutulur. |
| Renk seçimi | DS token'lardan renk preset'leri (Madde L) Phase 2. İlk tur tek renk (yarı-saydam beyaz). |
| Font seçimi | Server-side font-family çeşitliliği fontconfig işi gerektirir. İlk tur tek generic family. |
| Serbest rotation | Diagonal-tile'ın sabit açısı dışında kullanıcı-kontrollü rotation yok. |
| Per-store default watermark | Settings Registry entegrasyonu Phase 2. |

---

## 3. Mimari

### 3.1 Veri modeli (`SceneOverride` genişletmesi)

`frame-scene.ts` (canonical scene model) içine eklenir:

```ts
export type WmOpacity = "soft" | "medium" | "strong";
export type WmPlacement = "br" | "center" | "tile";

export interface WatermarkConfig {
  enabled: boolean;
  text: string;
  opacity: WmOpacity;
  placement: WmPlacement;
}

export const WM_OPACITY: Record<WmOpacity, number> = {
  soft: 0.18,
  medium: 0.30,
  strong: 0.45,
};

export const WM_DEFAULT: WatermarkConfig = {
  enabled: false,
  text: "",
  opacity: "medium",
  placement: "br",
};

export const WM_TEXT_MAX = 48; // layout-safe clamp (bkz. §5.2)

// SceneOverride'a eklenir:
//   watermark?: WatermarkConfig | null;
```

`normalizeWatermark(raw): WatermarkConfig` — BG Effects'in
`normalizeBgEffect` deseniyle: bilinmeyen/eksik alanlar default'a
düşer, `text` `WM_TEXT_MAX`'e clamp edilir (trim sonrası), enum
dışı `opacity`/`placement` default'a döner.

### 3.2 Tek doğruluk kaynağı resolver

Yeni `resolveWatermarkLayout` — `resolvePlateEffects` /
`resolveLensBlurLayout` komşusu. **Pure-TS, DOM/zoom/bg-bağımsız.**
Hem preview hem export bu fonksiyondan beslenir → §11.0 Preview =
Export Truth tek yerde garanti.

**İmza:**

```ts
export type WmAnchor = "start" | "middle" | "end";

export interface WatermarkGlyph {
  text: string;       // daima normalize edilmiş config.text
  xPct: number;       // 0..100 — frame genişliğinin yüzdesi
  yPct: number;       // 0..100 — frame yüksekliğinin yüzdesi
  rotateDeg: number;
}

export interface WatermarkLayout {
  active: boolean;            // false → hiçbir şey render edilmez
  glyphs: WatermarkGlyph[];   // br/center: 1 eleman; tile: N eleman
  opacity: number;            // WM_OPACITY[config.opacity]
  fontPctOfMin: number;       // font-size = min(frameW,frameH) * bu
  anchor: WmAnchor;           // tüm glyph'ler için ortak text-anchor
                              // br→"end", center→"middle", tile→"middle"
}

export function resolveWatermarkLayout(
  config: WatermarkConfig | null | undefined,
  frame: { w: number; h: number },
): WatermarkLayout;
```

**Davranış sözleşmesi:**

- `config` null / `enabled === false` / `text.trim() === ""` →
  `{ active: false, glyphs: [], opacity: 0, fontPctOfMin: 0 }`
  (render hiç çizilmez — boş watermark feature'ı anlamsız).
- `text` her zaman normalize edilmiş (clamp + trim) kabul edilir;
  resolver içinde tekrar clamp eder (defensive).
- Geometri **yüzde tabanlı** (`xPct`/`yPct`) → frame boyutundan
  bağımsız; preview (CSS %) ve export (px = % × outputDim) aynı
  matematik.

**Placement geometrisi** (her glyph'in `text` alanı daima
normalize edilmiş `config.text`'tir — tile mode'da N glyph'in
hepsi aynı metni taşır):

| Placement | glyphs | Geometri |
|---|---|---|
| `br` (bottom-right) | 1 | Sağ-alt ankraj: text-anchor `end`, `xPct: 95`, `yPct: 93`, `rotateDeg: 0`, `fontPctOfMin: 0.035`. |
| `center` | 1 | `xPct: 50`, `yPct: 50`, text-anchor `middle`, `rotateDeg: 0`, `fontPctOfMin: 0.060` (daha büyük koruyucu mark; uzun metinde §5.2 kademe kuralı geçerli). |
| `tile` (diagonal) | N | Deterministik rotated grid (§4), text-anchor `middle`, `rotateDeg: -30`, `fontPctOfMin: 0.026`. |

> Not: `br` için text-anchor `end` olduğundan `xPct: 95`
> right-edge'den %5 inset demektir; preview tarafında karşılığı
> sağ kenardan %5 inset + sağa hizalı metin, export SVG tarafında
> `text-anchor="end" x="95%"` — ikisi aynı sonucu verir.
> `WatermarkLayout.anchor` (layout seviyesinde tek alan, tüm
> glyph'ler ortak) bu bilgiyi taşır: `br→"end"`,
> `center→"middle"`, `tile→"middle"`. Preview ve export aynı
> anchor'ı okur — ayrı hesap yok.

### 3.3 Render katmanları (preview + export aynı z-order)

**Preview** (`MockupStudioStage.tsx`): vignette bloğundan
(z-index 9) **sonra**, `.k-studio__stage-plate` içinde **z-index
10** absolute overlay. `pointer-events: none`. `resolveWatermarkLayout`
çıktısından map'lenir; her glyph absolute-positioned, CSS
`transform: rotate()` + `opacity` + `font-family: sans-serif`.

**Export** (`frame-compositor.ts`): mevcut compositing zinciri
Phase 4 (plate) → … → 7b (vignette). **Phase 7c** eklenir —
watermark. Vignette buffer composite'inden sonra, aynı SVG-buffer
deseniyle (vignette radialGradient buffer'ı gibi):

```
const wmSvg = `<svg width="${outputW}" height="${outputH}" ...>
  ${glyphs.map(g => `<text
     x="${g.xPct/100*outputW}" y="${g.yPct/100*outputH}"
     text-anchor="${anchor}"
     font-family="sans-serif"
     font-size="${fontPctOfMin*Math.min(outputW,outputH)}"
     fill="rgba(255,255,255,${opacity})"
     transform="rotate(${g.rotateDeg} cx cy)">${escapeXml(g.text)}</text>`).join("")}
</svg>`;
canvasBuffer = await sharp(canvasBuffer)
  .composite([{ input: Buffer.from(wmSvg), top: 0, left: 0 }])
  .png().toBuffer();
```

`escapeXml` zorunlu — operatör metni `<`/`>`/`&`/`"`/`'`
içerebilir; SVG-injection / parse-break engellenir (bkz. §5.2).

### 3.4 `EffectPanelKey` genişletmesi

`frame-scene.ts` tek kaynak: `EffectPanelKey = "lens" | "bgfx"` →
`"lens" | "bgfx" | "watermark"`. Drift-safe (tek tanım; Sidebar +
Shell + EffectFlyout buradan tüketir).

---

## 4. Diagonal-tile — Teknik Yaklaşım ve Grid Yoğunluğu

### 4.1 Neden manuel rotated `<text>` grid (patternTransform değil)

Fizibilite testi (2026-05-17, gerçek Sharp 0.33.5 render):

- `<pattern patternTransform="rotate()">` librsvg sürümleri arası
  **tutarsız** (fizibilite raporu) — preview CSS ile sapma riski.
- **Kanıtlanan yol:** SVG'ye N adet `<text>` elementi, her birine
  `transform="rotate(deg cx cy)"`. Sharp/librsvg bunu **temiz
  render etti** (test çıktısı `/tmp/wm_test_diagonal.png` — okunur
  anti-copy deseni, sapma yok, `stdev > 0` = text gerçekten çizdi).
- Bu yaklaşım preview tarafında da birebir çoğaltılabilir (React
  absolute span'lar veya inline SVG, aynı `xPct/yPct/rotateDeg`
  matematiği).

### 4.2 Grid yoğunluğu kararı (Guardrail 1 — satış-görseli kalitesi)

Operatör guardrail'i: *diagonal-tile koruyucu olsun ama hâlâ satış
görseli olarak kullanılabilir kalsın; spacing çok sıkı,
opacity çok agresif, tekrar çok yoğun olmasın.*

Fizibilite prototipinde (`step 260×90, rotate -30, opacity 0.22`)
görsel "koruyucu ama satılabilir" çıktı — referans alındı.
Normatif değerler (frame boyutuna **orantısal**, sabit px değil):

| Parametre | Değer | Gerekçe |
|---|---|---|
| `rotateDeg` | `-30` | 45° "ucuz stock" hissi verir; -30° daha yumuşak, profesyonel. |
| Yatay step | `min(frameW,frameH) × 0.42` | Sıkı değil; metinler nefes alır. |
| Dikey step | `min(frameW,frameH) × 0.16` | Satırlar üst üste binmez, ürün okunur kalır. |
| `fontPctOfMin` | `0.026` | Küçük ama okunur; ürünü ezmez. |
| `opacity` | `WM_OPACITY` (max strong = 0.45) | Strong bile %45 → ürün altından görünür. soft 0.18 hafif filigran. |
| Grid kapsama | Frame'i tam kaplar, kenar taşması clip'lenir | Köşelerde yarım tile boşluk kalmaz. |

Step'ler `min(frameW,frameH)`'e orantısal — kare ve dikey
frame'lerde tutarlı yoğunluk. Grid başlangıcı negatif offset'ten
(`-0.5 × step`) başlar ki köşeler boş kalmasın.

**Yoğunluk doğrulama (implementasyon zorunlu):** browser preview +
gerçek Sharp export 3 aspect (1:1, 4:5, 9:16) için karşılaştırılır;
"ürün tamamen ölmüş mü / stock-photo hissi var mı" gözle kontrol.
Varsa step çarpanları büyütülür (daha seyrek).

---

## 5. Guardrail'ler (operatör tarafından eklendi — normatif)

### 5.1 Guardrail 1 — Diagonal-tile satış-görseli kalitesi

§4.2'de normatif sayılara bağlandı. Kural: diagonal-tile asla
ürünü tamamen okunamaz yapmaz; strong opacity'de bile mockup
content tile'ların altından seçilebilir kalır. Implementasyon
proof'unda (browser + export) bu gözle doğrulanır; ölürse fallback
(§6) devreye girer.

### 5.2 Guardrail 2 — Text input layout-safe + güvenli

Operatör kötü input verince feature çökmemeli / çirkin taşma
olmamalı:

- **Boş / whitespace-only metin:** `resolveWatermarkLayout` →
  `active: false` (hiçbir şey render edilmez; flyout enable On
  olsa bile). Flyout'ta küçük not: "Enter watermark text to
  preview." (İngilizce — UI standardı).
- **Aşırı uzun metin:** `WM_TEXT_MAX = 48` karakter. `normalizeWatermark`
  trim + `slice(0, WM_TEXT_MAX)`. Flyout input `maxLength={48}` +
  altında karakter sayacı (örn. `12 / 48`). Clamp sessiz değil —
  operatör neden kesildiğini görür.
- **SVG-injection / parse-break:** export SVG'de `escapeXml(text)`
  zorunlu (`& < > " '` → entity). Eksikse `<` içeren metin
  Sharp SVG parse'ını kırar → export fail. Bu, opsiyonel değil
  güvenlik koşulu.
- **Tek satır garantisi:** ilk tur watermark tek satırdır (newline
  yok). `normalizeWatermark` `\n`/`\r` → space replace. Çok-satır
  layout Phase 2.
- **Center taşma:** uzun metin (48 char) + center placement'ta
  font `fontPctOfMin 0.060` ile dar frame'de kenara taşabilir.
  Mitigasyon: center glyph'e `textLength`/`lengthAdjust` yerine
  basit kural — center mode'da `fontPctOfMin` metin uzunluğuna
  göre kademeli düşürülür (≤16 char: 0.060; ≤32: 0.045; >32:
  0.034). Bu, çok uzun metnin frame dışına taşmasını engeller,
  parity'yi bozmaz (aynı kural her iki tarafta).

---

## 6. Fallback — tam koşul

Operatör guardrail'i: *diagonal-tile parity'yi kirletiyorsa veya
ilk turu gereksiz büyütüyorsa fallback set'e dön: Bottom-right /
Center / Bottom-bar; inat etme.*

**Fallback tetik koşulu (implementasyon sırasında değerlendirilir,
net):**

Fallback'e geçilir EĞER aşağıdakilerden **herhangi biri** doğruysa:

1. **Parity divergence kanıtlandı:** Browser preview ile gerçek
   Sharp export diagonal-tile için **gözle belirgin** sapma
   gösteriyor (tile pozisyonu kayması, rotation farkı, opacity
   uyuşmazlığı) ve bu sapma `resolveWatermarkLayout` matematiği
   tek-kaynak yapılmasına rağmen kapatılamıyor (örn. librsvg
   `transform="rotate()"` baseline'ı CSS'ten yapısal farklı).
2. **Effort patlaması:** Diagonal-tile'ı parity-safe yapmak,
   tasarlanan tek-resolver + SVG-text-grid yaklaşımının ötesinde
   ek mimari (custom font embedding, fontconfig setup, ayrı render
   pipeline) gerektiriyor — yani ilk turu "kanıtlanmış küçük"
   sınırının dışına itiyor.
3. **Satış-görseli kalitesi kurtarılamıyor:** Grid yoğunluğu
   ayarları (§4.2) denenmesine rağmen diagonal-tile ya ürünü
   tamamen öldürüyor ya da koruma vermeyecek kadar zayıf — orta
   nokta bulunamıyor.

**Fallback davranışı:** `WmPlacement` enum'unda `"tile"` →
`"bar"` ile değiştirilir. `bottom-bar` = frame alt kenarında
edge-to-edge tek `<text>` şerit (sol→sağ ortalı, `yPct: 95`,
`rotateDeg: 0`, `fontPctOfMin: 0.030`). Tek glyph → parity riski
minimum (br/center ile aynı kod yolu). Spec'in geri kalanı (resolver
sözleşmesi, guardrail 2, katman, flyout) **değişmez** — yalnız
`tile` case yerine `bar` case.

Fallback'e geçilirse veya geçilmezse **final raporda açıkça
yazılır** (hangi koşul, hangi kanıt).

---

## 7. Dokunulacak dosya katmanları (10 dosya — BG Effects ile aynı set)

| # | Dosya | Sorumluluk değişikliği |
|---|---|---|
| 1 | `src/features/mockups/studio/frame-scene.ts` | `WatermarkConfig` / `WmOpacity` / `WmPlacement` type, `WM_OPACITY` / `WM_DEFAULT` / `WM_TEXT_MAX`, `normalizeWatermark`, `resolveWatermarkLayout`, `SceneOverride.watermark?`, `EffectPanelKey` += `"watermark"` |
| 2 | `src/features/mockups/studio/MockupStudioSidebar.tsx` | watermark tile `data-wired="true"`, opacity 1, title güncel, onClick → `setActiveEffectPanel("watermark")`; stale "preview only / Phase 99+ candidate" dili kaldır; tile label (enabled → metin özeti veya "On") |
| 3 | `src/features/mockups/studio/EffectFlyout.tsx` | `panel === "watermark"` case: enable On/Off + text input (`maxLength=48` + sayaç) + opacity 3-segment + placement 3-segment + boş-metin notu |
| 4 | `src/features/mockups/studio/MockupStudioStage.tsx` | watermark preview overlay z-index 10 (vignette bloğundan sonra, `.k-studio__stage-plate` içinde), `resolveWatermarkLayout`'tan map |
| 5 | `src/providers/mockup/local-sharp/frame-compositor.ts` | Phase 7c — watermark SVG buffer composite (vignette sonrası), `escapeXml`, `resolveWatermarkLayout` aynı çıktıdan |
| 6 | `src/features/mockups/studio/MockupStudioShell.tsx` | `sceneSnapshot`'a `watermark` alanı (normalize); `EffectPanelKey` reset zaten `mode` effect'inde mevcut |
| 7 | `src/features/mockups/studio/FrameExportResultBanner.tsx` | `isStale` — `watermarkChanged` kontrolü (enabled/text/opacity/placement diff) |
| 8 | `src/server/services/frame/frame-export.service.ts` | persist sceneSnapshot — `watermark` normalize edilerek yazılır |
| 9 | `tests/unit/mockup/bg-effects.test.ts` (veya yeni `watermark.test.ts`) | `resolveWatermarkLayout` testleri: disabled→inactive; empty/whitespace→inactive; br/center/tile glyph sayısı + geometri; opacity reflect; clamp (49 char → 48); newline→space; center uzun-metin font kademesi |
| 10 | `docs/claude/mockup-studio-contract.md` + `docs/claude/known-issues-and-deferred.md` | §7.9 Watermark normatif (scope, resolver sözleşmesi, guardrail'ler, fallback); known-issues: image/size/color/rotation/per-store deferred + (varsa) fallback'e dönüş nedeni |

`escapeXml` yardımcı fonksiyonu compositor'da yoksa eklenir
(küçük, saf string replace — yeni bağımlılık yok).

---

## 8. Preview/Export Parity Riski — çerçeve

| Risk | Seviye | Mitigasyon |
|---|---|---|
| **Font metric farkı** | Düşük-orta | Her iki taraf `font-family: sans-serif` generic. Risk kalıntısı: preview OS sans-serif'i (Helvetica vb.) ↔ export librsvg sans-serif'i (DejaVu vb.) glyph genişliği farkı → watermark **biraz** kaymış/farklı genişlikte. Görsel etki düşük (yarı-saydam mark, milimetrik). Implementasyonda browser + export karşılaştırması ile ölçülür; kabul edilemez sapma çıkarsa rapora yazılır. **Özel font adı kullanılmaz** (fizibilite: özel font fontconfig-level kurulum ister, ilk tur scope dışı). |
| **Diagonal-tile grid kayması** | Orta | Tek `resolveWatermarkLayout` her iki tarafı besler; ikinci/ayrı hesap yasak. Risk: librsvg `transform="rotate(deg cx cy)"` baseline'ı CSS `transform-origin` ile yapısal farklıysa. Mitigasyon: rotation merkezi her glyph için explicit `cx cy` verilir (CSS'te `transform-origin` aynı px'e set edilir), implied origin'e güvenilmez. Doğrulanamazsa → fallback (§6). |
| **Opacity** | Düşük | CSS `opacity` (element) vs SVG `fill="rgba(...,a)"` aynı alpha. Vignette pattern'inde (Phase 136) kanıtlı. Watermark text fill-alpha kullanır, element opacity değil — daha deterministik. |
| **XML escape eksikliği** | Yüksek (önlenebilir) | `escapeXml` zorunlu (§5.2). Eksikse export fail — bu bir bug değil, spec ihlali. |

§11.0 Preview = Export Truth korunur: tek resolver, aynı yüzde
geometrisi, aynı font generic, aynı z-order. Risk noktaları
implementasyonda **iddia değil kanıt** ile (browser snapshot +
gerçek Sharp export dosyası) kapatılır.

---

## 9. Implementasyonun "experiment alt-turu" boyutu

Operatör bunu fizibilite/experiment gibi ele almamı istedi.
Implementasyon planı şu proof'ları **zorunlu** içerir:

1. **Basit placement (br + center) önce:** parity'si en düşük
   riskli — önce bunlar wire + browser + export proof.
2. **Diagonal-tile ayrı doğrulama adımı:** preview ekran görüntüsü
   + gerçek Sharp export dosyası 3 aspect (1:1, 4:5, 9:16) için
   yan yana. Gözle: parity sapması? satış-görseli ölmüş mü?
3. **Karar noktası:** §6 fallback koşulları değerlendirilir;
   geçilirse `tile`→`bar` refactor (spec'in geri kalanı sabit).
4. **Final rapor:** hangi teknik yaklaşım, neden, parity durumu
   (kanıtla), Etsy satıcısı açısından kullanılabilirlik, kalan
   risk, fallback'e dönüldü mü.

---

## 10. Quality Gates (CLAUDE.md "Model Esnekliği" — done tanımı)

İlk tur "done" sayılması için:

1. `npx tsc --noEmit` — clean.
2. Targeted tests — `resolveWatermarkLayout` suite + mevcut
   mockup suite regresyonsuz.
3. `npm run build` — PASS.
4. Browser verification — preview server üzerinden 3 placement ×
   örnek metin; snapshot + console clean; gerçek export dosyası
   indirilip preview ile karşılaştırma (parity proof).
5. Ürün sözleşmesi — Contract §7.9 + known-issues güncel; kod ↔
   yorum ↔ doküman ayrışması yok.
6. Dev server clean + running bırakılır (memory rule).
