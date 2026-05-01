# Phase 8 — Mockup Studio Design Spec

**Tarih:** 2026-05-01
**Durum:** Spec (brainstorming kapandı, plan'a geçiş bekliyor)
**Önkoşul:** Phase 7 v1.0.1 🟢 (kapandı 2026-05-01) — Selection Studio,
`SelectionSet(status=ready)` Phase 8'in tek girdi yüzeyidir. Phase 7'de
formal "manifest schema v1" entity'si yoktur; Phase 8 job creation anında
SelectionSet + items'ın deterministik JSON snapshot'ını alır
(`setSnapshotId`).
**Sonraki:** Phase 9 — Listing Builder (S8 → "Listing'e gönder" köprüsü v1'de
disabled placeholder; Phase 9 tarafından activate edilecek).

> **Çerçeve — Final ürün zihniyeti:**
> Bu spec "sonra toparlarız" refleksiyle değil, kullanıcıya gerçekten teslim
> edebileceğimiz, dürüst ve ölçeklenebilir bir ürün dilimi tasarlıyormuşçasına
> yazıldı. Phase 8 v1 dar bir dikey dilim (1 kategori, 1 provider primary,
> 8 template, 6 ekran) — ama bu kesim **kalite tavizi değil**, üzerinde durduğu
> sözleşmelerin V2 genişlemesini şema kırmadan kaldıracak şekilde
> kurgulanmıştır. Carry-forward maddeleri açıkça ayrılmış; "fake capability"
> dili kullanılmamıştır.

> **Birincil yerel tasarım kaynağı:**
> `docs/design/EtsyHub_mockups/`. Bu klasör Phase 8 için **aktif tasarım
> kaynağı** olarak kullanıldı, sadece ilham değil. Spec'in %60'ı doğrudan
> `Mockup Studio Spec.html`'in MVP scope kararlarına, %20'si
> `Mockup Studio Hi-Fi.html`'in ekran anatomisine, %10'u `mockup-studio-shared.jsx`
> mock fixture sözleşmesine, %10'u Phase 7 emsallerine dayanır. Design system
> (`primitives.jsx`, `tokens.css`) Phase 7 ile birebir paylaşılır.

---

## 1. Amaç ve Kapsam

### 1.1 Amaç

Mockup Studio, Phase 7'den çıkan `SelectionSet(status=ready)` setlerini
**Etsy listing için publish-ready 10-görsel mockup paketine** dönüştüren
localhost-first dikey dilimdir. Akış zincirinde yeri:

```
Reference → Variation → [Phase 6: Review] → [Phase 7: Selection]
  → Mockup Studio → [Phase 9: Listing] → Etsy Draft
```

V1 vaadi (kullanıcıya):

> "Set'i seç, 'Render et'e bas, ~30 saniyede Etsy'ye yüklenmeye hazır
> 10 görsel pakete sahip ol."

Mockup Studio bir **editör değil, üretici**dir. Kullanıcı sıfırdan kompozisyon
kurmaz; sistem hazır template'lere set'in tasarımlarını yerleştirir, kategori-
aware curated pack çıkarır, Etsy 10-görsel limitine uyan bir paket teslim eder.
Kullanıcı dilerse pack'i tweak eder (Customize akışı), failed render'lar için
swap/retry yapar; ama default akış 1 tıklamaya yakındır.

### 1.2 Phase 8 v1 — In-scope

- **Tek kategori**: `canvas` / wall art (kategori = first-class entity, day-1
  zorunlu kolon)
- **Tek provider primary**: in-house Sharp compositor (`local-sharp`).
  `dynamic-mockups` (API) provider adapter'ı **contract-ready** mimaride yer
  alır; v1'de implementation stub (gerçek render V2'de)
- **8 template**: 7 frontal + 1 hafif perspective (3/4 açı) — kalite garantisi
  template seçim disipliniyle
- **6 ekran**:
  - **S3 Apply** — ana karar ekranı (route)
  - **S1 Browse** — template kütüphanesi (S3 üstünde drawer)
  - **S2 Detail** — template preview (S1 üstünde modal)
  - **S7 Job** — render progress (route)
  - **S8 Result** — pack teslim (route)
  - Phase 9 köprüsü: S8'de "Listing'e gönder →" CTA disabled placeholder
- **Veri modeli**: `MockupTemplate`, `MockupTemplateBinding`, `MockupJob`,
  `MockupRender`. Snapshot disiplini binding seviyesinde
- **Pack semantiği**: 1 SelectionSet → 1 MockupJob → 1 curated pack (max 10
  render). Cover first-class
- **Selection algoritması**: deterministik 3-katman (cover + template diversity
  + variant rotation)
- **Quick Pack default + Customize tweak** karma akış
- **State mimarisi**: URL primary (`t`, `customize`, `templateId` query
  params); local state mirror v1'de zorunlu değil
- **5-class hata sözlüğü**: TEMPLATE_INVALID / RENDER_TIMEOUT / SOURCE_QUALITY
  / SAFE_AREA_OVERFLOW / PROVIDER_DOWN — day-1 canlı
- **Partial complete** first-class: failed slot'lar görünür, retry/swap
  affordance, dürüst başlık (`actualPackSize < 10` durumunda "8/10 görsel"
  yazılır)
- **Background render**: kullanıcı S7'den ayrılabilir, in-app toast ile
  bilgilenir (Phase 7 `useExportCompletionToast` emsali)
- **Asset depolama**: MinIO/S3 versionlı path, signed URL TTL'li (Phase 7
  export emsali)
- **Test disiplini**: Phase 7 birebir (TDD + 2-stage review). Sharp
  deterministic snapshot test (frontal byte-stable, perspective SSIM tolerance)

### 1.3 Phase 8 v1 — Out-of-scope (carry-forward)

Aşağıdaki maddeler **kalite tavizi değil, bilinçli kesim**. Hepsi V2 (veya
ilgili Phase) için reserve, şema/route/abstraction bunları taşıyacak şekilde
hazırlanmıştır.

| # | Madde | Yer | Sebep |
|---|---|---|---|
| CF1 | Multi-category genişleme (mug, t-shirt, poster, vb.) | V2 | V1 disipline 1 kategori; binding tablosu V2'ye hazır |
| CF2 | Dynamic Mockups gerçek implementation | V2 | V1'de adapter stub + interface compliance test; gerçek render V2 |
| CF3 | S6 düzenleme paneli (tweaks panel) | V2 | "Editör değil üretici" — V1 düzenleme yok |
| CF4 | Saved Sets / Saved Presets | V2 | V1 Quick Pack default = preset prototipi |
| CF5 | Batch automation | V2 | V1 single-job |
| CF6 | Smart match (ML/AI öneri) | V2 | V1 deterministik vibe diversity |
| CF7 | Multi-platform pack size (Pinterest, Amazon) | V2 | V1 Etsy 10 sabit |
| CF8 | Render comparison / side-by-side | V2 | V1 single render view |
| CF9 | Job history list view | V1.5 | V1'de URL/bookmark; Phase 7 set detay'a tab |
| CF10 | Global Mockup Studio sidebar item | V2 | V1 set bağlamı |
| CF11 | Browser notification API | V2 | V1 in-app toast yeterli |
| CF12 | Mobile responsive layout | V2 | V1 desktop-first |
| CF13 | Tweak history undo (Cmd+Z) | V2 | V1 `router.replace` history'siz |
| CF14 | Asset version cleanup (eski binding asset'leri) | V2 | V1 marginal sorun |
| CF15 | SSE realtime job updates | V2 | V1 polling yeterli (Phase 7 emsali) |

V1 task 0 (plan'a aktarılacak operasyonel iş, scope dışı sayılmaz):

| # | Madde | Sorumluluk |
|---|---|---|
| T0a | 8 template asset üretimi (oda fotoğrafı + safe-area kalibrasyonu) | Tasarım/manuel — ~2-3 gün |
| T0b | 4-corner perspective Sharp library kararı (`sharp-perspective` paketi vs manuel matrix transform) | Plan task 1 detayı |
| T0c | `coverPriority` template metadata seed (admin UI yok, elle JSON) | Plan task 0 |

### 1.4 Phase 7 → Phase 8 → Phase 9 sözleşme zinciri

```
Phase 7 SelectionSet                        Phase 8 MockupJob                         Phase 9 Listing
  status: ready                  ─→            packSize: 10              ─→              draft
  set + items JSON snapshot                    coverRenderId                              imageOrder[]
   (job-time stable hash)                      renders: [MockupRender]                    images: 10
  items: [SelectionItem]                       cover ⇔ packPosition=0                    cover_image
   (ordered by position)                       (atomic swap invariant)                    (thumbnail = pack[0])
   ↳ generatedDesign.aspectRatio               aspectRatios[] match
                                               (per-render snapshot)
```

> **Cover invariant (V1):** `coverRenderId` her zaman packPosition=0 olan
> render'ı işaret eder. Cover swap (§4.8) iki render arasında atomic slot
> swap yapar; pointer'ın packPosition'dan ayrıldığı bir durum yoktur.
> Bu sayede ZIP filename ordering, S8 grid sırası ve Phase 9 listing
> image_order tek bir kaynak'tan (packPosition ASC) türer.

**Phase 7 → Phase 8 (gerçek schema):** Mevcut Phase 7 schema'sında dedicated
`isHero` alanı **yok**; SelectionItem `position: Int` ile ordered. V1 hero
fallback'i: **rank 0 = `position` ASC ilk SelectionItem (status≠rejected
filtered)**. Bu bilinçli v1 fallback — Phase 7'ye yeni alan eklemeden
çözüm. (V2'de admin "hero seç" UX gelirse `isHero` alanı eklenir; V1 sözleşmesi
kırılmaz.)

Variant-level aspect ratio kaynağı: **`SelectionItem → GeneratedDesign.aspectRatio`**
(Phase 7 schema, [prisma/schema.prisma:602](prisma/schema.prisma:602)).
Bu alan **nullable** (Phase 5 öncesi rows için NULL kuralı geçerli).
Fallback chain (job creation guard):

1. `selectionItem.generatedDesign.aspectRatio` — primary
2. `selectionItem.generatedDesign.productType.aspectRatio` — fallback (V1
   canvas için ProductType.aspectRatio set'lenmiş olmalı; admin seed)
3. Hâlâ null ise → variant pre-validation aşamasında **skip** (set'in diğer
   variantları ile devam; set'teki tüm variantlar null ise job creation
   reddedilir, "Bu set için aspect ratio bilgisi yok" hatası ile Phase 7'ye
   geri yönlendirilir)

Bu fallback chain `SAFE_AREA_OVERFLOW` hata sınıfından farklı; pre-validation
aşamasında "aspect bilgisi yok" durumu **set-level** problem olarak
kullanıcıya gösterilir (S3 incompatible state).

Job creation guard'ları:
- `SelectionSet.userId === currentUser.id`
- `SelectionSet.status === "ready"`
- En az 1 SelectionItem (status ≠ rejected) için aspect ratio resolved
- En az 1 template'in `aspectRatios`'u set'in en az 1 variant ile uyumlu

Item-level field referansları:
- `id` — SelectionItem.id
- Asset URL — `SelectionItem.editedAssetId` (varsa) veya `sourceAssetId`
  üzerinden Asset.url (Phase 7 emsali — son düzenlenmiş asset job'a girer)
- aspect ratio — yukarıdaki fallback chain
- order — `position` ASC

**Phase 8 → Phase 9:** MockupJob.coverRenderId + ordered renders[] +
zipDownloadUrl. Phase 9 listing builder bu pack'i input olarak alır,
Etsy listing draft oluşturur. Phase 9 v1'de yok; köprü S8'de placeholder.

---

## 2. Mimari Kararlar

### 2.1 Provider abstraction — binding model

V1'de iki provider yolu sistemde yer alır:

- **`local-sharp`** (primary) — in-house Sharp compositor, gerçek
  implementation. V1 deneyiminin tüm render'ları bu yoldan geçer.
- **`dynamic-mockups`** (secondary) — API-based, **contract-ready stub**.
  Adapter dosyası v1'de var, interface compliance testi geçiyor; ancak v1'de
  hiç binding satırı yok, gerçek `render()` çağrısı yapılmıyor.

> **Localhost-first disiplini:** API provider'ı v1'de "ana yol" olarak
> sunmuyoruz. Localhost-first felsefesi (CLAUDE.md) ve operasyonel risk
> minimizasyonu için primary yol her zaman in-house Sharp olarak kalır.
> V2'de Dynamic Mockups premium tier olarak eklenebilir; V1'de değil.

**Template ile provider arasındaki ilişki one-to-many** (ayrı tablo):

- `MockupTemplate` = kullanıcı katalogda gördüğü şey (taxonomy, identity)
- `MockupTemplateBinding` = template'in belirli bir provider ile nasıl render
  edileceği (config, version, status)

Bu ayrım V2'de "aynı template'i hem local-sharp hem API ile render etme"
senaryosunu **şema kırmadan** açar. V1'de her template tek `local-sharp`
binding'e sahip; V2'de admin ikinci binding ekler, mevcut data dokunulmaz.

**Provider seçim algoritması (deterministik):**

```ts
const PROVIDER_PRIORITY: MockupProviderId[] = [
  "LOCAL_SHARP",      // varsayılan, ücretsiz, local
  "DYNAMIC_MOCKUPS",  // V2 premium, V1'de hiç binding yok
];

function resolveBinding(
  template: MockupTemplate & { bindings: MockupTemplateBinding[] }
): MockupTemplateBinding | null {
  const active = template.bindings.filter(b => b.status === "ACTIVE");
  for (const providerId of PROVIDER_PRIORITY) {
    const binding = active.find(b => b.providerId === providerId);
    if (binding) return binding;
  }
  return null; // hiç active binding yok → TEMPLATE_INVALID
}
```

`resolveBinding()` job creation anında çağrılır. UI'da provider seçimi yok;
kullanıcıya görünmez. V2'de tier-aware genişleme (ücretsiz/premium kullanıcı
priority chain farklı) bu fonksiyon imzasını dokunmadan eklenebilir.

**Reject edilen alternatifler:**
- *Tek tablo + provider discriminator (template provider-bound):* V2'de aynı
  niyetli template'i iki provider için iki kez katalog'a koymak gerekir →
  template duplikasyonu, kullanıcı UI kirlenir.
- *Hibrit fallback (Dynamic Mockups primary + Sharp fallback):* iki render
  motorunu v1'de yazmak scope'u iki katına çıkarır; çıktı kalitesi farkı
  kullanıcıya tutarsızlık olarak yansır.

### 2.2 Render motoru — in-house Sharp

Primary render motoru: **Sharp** (CLAUDE.md stack'inde zaten var). BullMQ
worker içinde execute edilir; Phase 7 `EXPORT_SELECTION_SET` job emsali
operasyonel disiplin paylaşılır.

**Sharp'ın v1'de kullandığı primitives:**
- `composite()` — overlay placement
- `resize()` — design'ı target boyuta scale
- `extract()` — crop
- `affine()` — rotation, basit transform
- 4-corner perspective transform (perspective template için) — implementation
  detayı: `sharp-perspective` paketi vs manuel matrix transform plan task 1'de
  netleşir
- Channel ops (alpha, blend modes: normal/multiply/screen)
- `blur()` (gaussian) — shadow recipe için

**V1'de kullanmadığımız (V2'ye reserve):**
- Karmaşık lighting / color grading (recipe field reserve değil; gerçek
  ihtiyaç doğunca eklenir, CLAUDE.md "speculative architecture without
  immediate need" disiplini)
- Mask-based occlusion
- Multi-design layout (gallery wall benzeri, tek base'de N design slot)

**Render çıktı kalitesi v1:** ~2K (Etsy listing standart yeterliliği).
4K V2'ye reserve.

**Reject edilen alternatif:** *Dynamic Mockups primary*. Localhost-first
ihlali, billing setup engeli, IP dış servise gönderim, marginal cost gerçek.

### 2.3 Job / Render aggregate

**Tekil `MockupJob` 1:N `MockupRender`** ilişkisi (kullanıcı niyeti ↔
provider çağrıları).

```
Kullanıcı niyeti:    "Bu set'i 5 template'e uygula, pack ver"
                            ↓
                    1 MockupJob
                            ↓
                    N MockupRender (eager fan-out)
                            ↓
                    Curated pack (max 10, cover first)
```

**State machine:**

Job seviyesinde:
```
queued → running → (completed | partial_complete | failed | cancelled)
```

Render seviyesinde:
```
pending → rendering → (success | failed)
```

**Aggregate roll-up kuralı:**
- Tüm render'lar `success` → `completed`
- En az bir `success`, en az bir `failed` → `partial_complete`
- Hiçbir `success` yok → `failed`
- Kullanıcı cancel → `cancelled`

`partial_complete` first-class status. UI'da "10/10 hazır" yalanı **yok**;
S8'de "8/10 görsel" + failed slot'lar görünür + retry/swap affordance.

**Per-render retry:** failed render için yeni `MockupRender` satırı
oluşturulur (eski arşivlenir, `packPosition: null`); job aggregate sayıları
güncellenir. Full-job retry yok (kullanıcı yeni job açar).

**Phase 7 emsali:** `EXPORT_SELECTION_SET` job paterni birebir uyarlanır.
Polling 3sn `refetchInterval` (Phase 7 v1.0.1 polish: `refetchQueries`,
`invalidateQueries` değil — `staleTime` etkisini bypass eder).

### 2.4 Snapshot disiplini

CLAUDE.md non-negotiable: "Job başladığında settings/template/prompt
snapshot-lock; runtime config değişiklikleri çalışan job'ı etkilemez."

Phase 8'de snapshot **binding seviyesinde**:

```ts
type RenderSnapshot = {
  templateId: string;
  bindingId: string;
  bindingVersion: number;
  providerId: MockupProviderId;
  config: ProviderConfig;     // discriminated union, byte-stable JSON
  // catalog meta (denormalized, görüntü için):
  templateName: string;
  aspectRatios: string[];
  // tags snapshot edilmez (preset evolution doğal — V2 disiplini)
};
```

Bu disiplin sayesinde:
- Admin recipe değiştirir → `binding.version++` + asset versionlı path → eski
  job retry'lendiğinde aynı çıktı.
- Asset MinIO'da versionlı path (`mockup-templates/canvas/tpl-001/v3/base.png`)
  → eski version asset'leri kalmaya devam eder. Disk maliyeti V2 cleanup
  job'ına devredilir (CF14).

### 2.5 Curated pack mantığı

V1 vaadi: 1 SelectionSet → 1 MockupJob → 1 pack (max 10 render). Etsy
10-görsel limiti **birinci sınıf ürün kuralı**, sistemik enforce edilir
(`MockupJob.packSize` zorunlu kolon, default 10, v1'de hard-coded).

**Selection algoritması (3 katman, deterministik):**

```ts
function buildPackSelection(
  set: SelectionSet,                  // N variant
  bindings: MockupTemplateBinding[],  // M binding (her seçilen template)
  packSize: number = 10,
): PackSelection {
  // 1. Compatibility filter — aspect ratio uyumu
  const validPairs = filterValidPairs(set.variants, bindings);
  if (validPairs.length === 0) {
    throw new TemplateInvalidError("No compatible variant×template pair");
  }

  // 2. Cover slot (slot 0) — first-class
  //    - Hero variant fallback: SelectionItem.position ASC ilk item
  //      (status ≠ rejected filtered). Phase 7 schema'sında dedicated
  //      isHero alanı yok; v1 için rank 0 yeterli (V2'de isHero gelirse
  //      bu fonksiyon onu öncelikle kullanır).
  //    - En yüksek coverPriority'li binding (eşitlikte bindingId lex)
  const cover = pickCover(set.variants, bindings, validPairs);

  // 3. Template diversity (slot 1..M) — birincil kural
  //    - Her unique binding en az 1 kez temsil edilsin
  //    - Cover'dan farklı pair'ler tercih
  const diversitySlots = pickTemplateDiversity(validPairs, cover, bindings.length);

  // 4. Variant rotation (kalan slot'lar) — ikincil
  //    - Round-robin: variant[i % N] × binding[i % M]
  //    - Önceki seçimler atlanır
  const rotationSlots = pickVariantRotation(
    validPairs,
    [cover, ...diversitySlots],
    packSize - 1 - diversitySlots.length,
  );

  return {
    cover,
    slots: [cover, ...diversitySlots, ...rotationSlots],
  };
}
```

**Diversity önceliği (kasıtlı karar):** Template diversity birincil, variant
diversity ikincil/rotation tabanlı. Sebep: wall art mockup paketinde farklı
oda/ortam görmek satış yüzeyi açısından farklı renk varyasyonundan daha güçlü.
Variant rotation rolü "mümkünse her variant temsil edilsin"dir, garanti
değil.

**Determinizm disiplini:** `validPairs`, `bindings` ve `set.variants`
listeleri algoritma içinde iterasyondan önce stable sort'a tabidir
(`bindingId` lex, `variantId` lex). Aynı input → aynı pack. Test snapshot'ları
flaky değil. Bu disiplin `selectQuickPackDefault`'ta da geçerli (§2.6).

**Edge case:** `validPairs.length < packSize` → `actualPackSize` o değer
olur; S8'de "6/10 görsel — set'inde yeterli variant veya uyumlu template yok"
dürüst gösterimi. Sahte 10 yok.

**`totalRenders` ↔ `actualPackSize` ↔ `partial_complete` netleştirmesi:**

V1'de **`MockupJob.totalRenders = MockupJob.actualPackSize`**. Eager fan-out
yalnız `validPairs` üzerinde olur; **boş slot oluşmaz**. MockupRender
satırları `0..(actualPackSize-1)` packPosition aralığında.

Bu netleştirme **iki farklı durumu** ayırır:

| Durum | Ne demek | totalRenders | actualPackSize | Job status sonu |
|---|---|---|---|---|
| **Compatibility-limited pack** | validPairs.length < packSize. Hiç fail yok, ama set'in compat eşleşmesi 10'dan az. | = actualPackSize (örn. 6) | 6 | COMPLETED (eğer 6/6 success) |
| **Partial complete** | validPairs.length ≥ packSize → 10 render denendi, bazıları fail. | 10 | 10 | PARTIAL_COMPLETE (örn. 8/10 success) |
| **Karma** | Compatibility 7'ye düştü + 2 fail | 7 | 7 | PARTIAL_COMPLETE (5/7 success) |

UI sözleşmesi:
- "6/10 görsel" → compatibility-limited (zaten 10'a hiç çıkamadık)
- "8/10 görsel — 2 render başarısız" → partial complete (10 denendi, 2 fail)
- "5/7 görsel — 2 render başarısız" → karma (compat 7'ye sınırladı + 2 fail)

S8'de **paydanın `actualPackSize` olduğu** garanti edilir; "partial complete"
göstergesi `failedRenders > 0` ile tetiklenir.

**Reject edilen alternatifler:**
- *Eager full fan-out (her variant × her template):* 8 variant × 5 template =
  40 render → kombinatorik patlama, kullanıcı boğulur, "üretici" değil
  "editör" davranışı.
- *Manuel matrix subset (kullanıcı tüm 40 hücreden 10 seçer):* "üretici değil
  editör" anti-vision, cognitive load yüksek.

### 2.6 Quick Pack default + Customize karma akışı

Kullanıcının verdiği temel karar: "hangi template seti?"

V1 sözleşmesi: **Quick Pack default + Customize tweak** karma akış.

**Yol 1 — Quick Pack (default, ana akış):**
```
S3 Apply açılır → sistem 6 uyumlu template'i deterministik seçer →
"Render et (Quick Pack)" CTA → MockupJob.
```

**Yol 2 — Customize (opsiyonel):**
```
S3'te "Özelleştir →" → S1 Browse drawer açılır → kullanıcı template
ekle/çıkar → S3'e döner → "Render et (Custom Pack)" CTA → MockupJob.
```

**Quick Pack default selection algoritması (deterministik, score-free):**

```ts
function selectQuickPackDefault(
  set: SelectionSet,
  allActiveTemplates: MockupTemplate[],
  targetSize: number = 6,
): string[] {
  // 1. Aspect compatibility filter + deterministic sort
  const setAspects = unique(set.variants.map(v => v.aspectRatio));
  const compatible = allActiveTemplates
    .filter(t => t.aspectRatios.some(ar => setAspects.includes(ar)))
    .sort((a, b) => a.id.localeCompare(b.id));   // deterministik iteration
  if (compatible.length === 0) return [];

  // 2. Vibe diversity ranking
  const VIBE_TAGS = ["modern", "scandinavian", "boho", "minimalist",
                     "vintage", "playful"];
  const result: string[] = [];
  const usedVibes = new Set<string>();

  // 2a. Her unique vibe için 1 template
  for (const t of compatible) {
    const newVibe = t.tags.find(tag =>
      VIBE_TAGS.includes(tag) && !usedVibes.has(tag)
    );
    if (newVibe && result.length < targetSize) {
      result.push(t.id);
      usedVibes.add(newVibe);
    }
  }

  // 2b. Kalan slot'lar lexicographic order ile doldurulur
  if (result.length < targetSize) {
    const remaining = compatible
      .filter(t => !result.includes(t.id))
      .sort((a, b) => a.id.localeCompare(b.id));
    for (const t of remaining) {
      if (result.length >= targetSize) break;
      result.push(t.id);
    }
  }

  return result;
}
```

**Açıklanabilirlik:** S3'te ⓘ tooltip — "Sistem set'ine uygun X template
seçti, her vibe'dan temsil edildi." Algoritma "akıllı" değil, "dürüst";
test'lenebilir + geri izlenebilir.

**Default size = 6** kararı: 10 render slot için 6 template diversity
bütçesi (4 slot variant rotation'a kalır); 6 vibe tag'i v1 kütüphanesinde
mevcut; UI'da 6 chip görsel olarak temiz.

**API contract dokunulmaz:** Backend Quick/Custom ayrımı bilmez. Tek shape:

```ts
POST /api/mockup/jobs
body: { setId, categoryId, templateIds: string[] }
```

`templateIds` her durumda dolu — Quick Pack veya manuel, fark etmez.

**Reject edilen alternatifler:**
- *Pure manuel multi-select:* "tasarım seç, kategori seç — gerisini sistem
  yapar" vizyonu 4. karar adımıyla seyrelir.
- *Pure preset (sadece 2-3 mood paketi):* esneklik kaybı, V2 Saved Sets
  uyumsuz, S1 Browse + S2 Detail ekranları MVP'den çıkar.

### 2.7 URL primary state

**Kanonik state kaynağı = URL.** Local UI mirror v1'de zorunlu değil; sadece
debounce/animasyon ihtiyacı doğarsa eklenir.

**URL şeması:**

```
/selection/sets/[setId]/mockup/apply                    (S3, default)
/selection/sets/[setId]/mockup/apply?t=tpl-a,tpl-b      (S3, custom)
/selection/sets/[setId]/mockup/apply?customize=1        (S3 + S1 drawer)
/selection/sets/[setId]/mockup/apply?customize=1&templateId=tpl-c
                                                         (S3 + S1 + S2 modal)
/selection/sets/[setId]/mockup/jobs/[jobId]             (S7)
/selection/sets/[setId]/mockup/jobs/[jobId]/result      (S8)
```

Query semantik:
- `t` yok → Quick Pack default
- `t` var → Custom Pack override
- `customize=1` → S1 drawer açık
- `templateId=...` → S2 modal açık (S1 üstünde)

**Dirty state türev:** `t var && t ≠ defaultTemplateIds` → "Custom Pack"
rozeti. Ayrı boolean saklanmaz.

**`router.replace` disiplini:**
- Drawer/modal aç-kapa: `router.replace`, `scroll: false` → history'de iz yok
- S3 → S7: `router.push` (history entry)
- S7 → S8: `router.replace` (S7 history'den silinir; S8'den back → S3)

Browser back tuşu **app navigation** seviyesinde çalışır (Phase 7'ye dönüş);
drawer/modal kapatmak için UI affordance (Esc, X, backdrop). Phase 7 emsali
disiplin.

**Validation (URL'den geçersiz ID):** silently filter + URL update; geçersiz
template id'leri at, kullanılabilir set'le devam et.

**Cap:** templateIds max 8 (sanity). 8 × ~20 char = ~160 char query, browser
limitin çok altında.

### 2.8 Honesty discipline

Phase 7'den taşınan disiplin:

- **Fake confidence yok.** `actualPackSize < 10` durumunda "10/10" yazmıyoruz;
  "8/10 görsel — set'inde yeterli variant yok" dürüst metin.
- **Failed render gizlenmez.** S8'de partial complete'te failed slot'lar
  görünür kalır + 5-class hata sözlüğü ile açıklanır + retry/swap affordance.
- **ETA approximate.** "~12 saniye kaldı" tilde ile tahmin (CLAUDE.md "ETA
  approximate, fake precision yok").
- **Phase 9 köprüsü dürüst.** S8'de "Listing'e gönder →" CTA disabled +
  tooltip ("Phase 9'da listing builder eklenecek"). Aktif görünmüyor, sahte
  tıklanabilir değil.
- **API provider sahte sunulmuyor.** Dynamic Mockups v1'de "yer alıyor" demek
  = adapter dosyası + interface compliance + 0 binding satırı. Çağrılırsa
  `PROVIDER_NOT_CONFIGURED` döner.

---

## 3. Veri Modeli

### 3.1 Prisma şeması (yeni eklenenler)

```prisma
enum MockupProviderId {
  LOCAL_SHARP
  DYNAMIC_MOCKUPS    // V2 contract-ready, v1 stub
}

enum MockupTemplateStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

enum MockupBindingStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

enum MockupJobStatus {
  QUEUED
  RUNNING
  COMPLETED
  PARTIAL_COMPLETE
  FAILED
  CANCELLED
}

enum MockupRenderStatus {
  PENDING
  RENDERING
  SUCCESS
  FAILED
}

enum MockupErrorClass {
  TEMPLATE_INVALID
  RENDER_TIMEOUT
  SOURCE_QUALITY
  SAFE_AREA_OVERFLOW
  PROVIDER_DOWN
}

enum PackSelectionReason {
  COVER
  TEMPLATE_DIVERSITY
  VARIANT_ROTATION
}

model MockupTemplate {
  id                String                   @id @default(cuid())
  categoryId        String                                       // v1: "canvas"
  name              String
  status            MockupTemplateStatus     @default(DRAFT)

  // Catalog (provider-agnostik, kullanıcı UI'da görür)
  thumbKey          String                                        // MinIO key
  aspectRatios      String[]                                      // ["2:3","3:4"]
  tags              String[]                                      // vibe + room + composition
  estimatedRenderMs Int                                           // en hızlı active binding

  createdAt         DateTime                 @default(now())
  updatedAt         DateTime                 @updatedAt
  archivedAt        DateTime?

  bindings          MockupTemplateBinding[]

  @@index([categoryId, status])
}

model MockupTemplateBinding {
  id                String                @id @default(cuid())
  templateId        String
  providerId        MockupProviderId
  version           Int                   @default(1)
  status            MockupBindingStatus   @default(DRAFT)

  config            Json                                       // ProviderConfig (discriminated)
  estimatedRenderMs Int

  createdAt         DateTime              @default(now())
  updatedAt         DateTime              @updatedAt
  archivedAt        DateTime?

  template          MockupTemplate        @relation(fields: [templateId], references: [id])

  @@unique([templateId, providerId])
  @@index([providerId, status])
}

model MockupJob {
  id                 String          @id @default(cuid())
  userId             String
  setId              String
  setSnapshotId      String                                  // §3.4 deterministik set+items hash (sha256)
  categoryId         String                                  // v1: "canvas"
  status             MockupJobStatus
  packSize           Int                                     // hedef (default 10)
  actualPackSize     Int                                     // gerçekleşen (validPairs sınırı)
  coverRenderId      String?                                 // cover invariant: packPosition=0 render id (cover swap = atomic slot swap, §4.8)
  totalRenders       Int
  successRenders     Int             @default(0)
  failedRenders      Int             @default(0)
  errorSummary       Json?                                   // 5-class roll-up
  createdAt          DateTime        @default(now())
  startedAt          DateTime?
  completedAt        DateTime?

  user               User            @relation(fields: [userId], references: [id])
  set                SelectionSet    @relation(fields: [setId], references: [id])
  renders            MockupRender[]

  @@index([userId, createdAt])
  @@index([setId, createdAt])
  @@index([status])
}

model MockupRender {
  id               String               @id @default(cuid())
  jobId            String
  variantId        String                                          // SelectionItem.id
  bindingId        String
  templateSnapshot Json                                            // RenderSnapshot

  packPosition     Int?                                            // 0..9; null = arşivlenmiş swap
  selectionReason  PackSelectionReason

  status           MockupRenderStatus
  outputKey        String?                                         // MinIO output asset
  thumbnailKey     String?
  errorClass       MockupErrorClass?
  errorDetail      String?
  retryCount       Int                  @default(0)
  startedAt        DateTime?
  completedAt      DateTime?

  job              MockupJob            @relation(fields: [jobId], references: [id])

  @@index([jobId, packPosition])
  @@index([jobId, status])
}
```

### 3.2 LocalSharpConfig — provider config sözleşmesi

`MockupTemplateBinding.config` JSON kolonu, provider'a göre discriminated
union şekil alır. V1'de tek aktif tip:

```ts
// providers/mockup/types.ts

export type SafeAreaRect = {
  type: "rect";
  x: number; y: number; w: number; h: number;          // normalize 0..1
  rotation?: number;                                    // degrees
};

export type SafeAreaPerspective = {
  type: "perspective";
  // sıra: top-left, top-right, bottom-right, bottom-left (clockwise from TL)
  corners: [
    [number, number], [number, number],
    [number, number], [number, number]
  ];
};

export type SafeArea = SafeAreaRect | SafeAreaPerspective;

export type ShadowSpec = {
  offsetX: number;     // px (base asset koordinatı)
  offsetY: number;
  blur: number;        // gaussian blur radius px
  opacity: number;     // 0..1
};

export type MockupRecipe = {
  blendMode: "normal" | "multiply" | "screen";
  shadow?: ShadowSpec;
};

export type LocalSharpConfig = {
  providerId: "local-sharp";

  // Asset
  baseAssetKey: string;                              // MinIO versionlı yol
  baseDimensions: { w: number; h: number };          // base asset px

  // Geometry (önceki kararla discriminated union)
  safeArea: SafeArea;

  // Compositing davranışı (minimal)
  recipe: MockupRecipe;

  // Cover priority (selection algoritması için, snapshot edilmez)
  coverPriority: number;                             // 0..100, yüksek öncelikli
};

export type DynamicMockupsConfig = {
  providerId: "dynamic-mockups";
  externalTemplateId: string;
  smartObjectOptions?: Record<string, unknown>;
  safeAreaHint?: SafeArea;                           // UI overlay için
};

export type ProviderConfig = LocalSharpConfig | DynamicMockupsConfig;
```

**Recipe minimal kararı:** Sadece `blendMode` + opsiyonel `shadow`.
`cornerRadius`, `opacityOverlay`, `lighting`, `mask`, `multiDesign` v1'de
**yok** — gerçek ihtiyaç doğunca eklenir, V2 backward-compat (opsiyonel
alan eklemek migration değil, Zod schema güncelleme).

**Geometry recipe'te değil, safeArea'da:** Frontal vs perspective ayrımı
`safeArea.type` discriminator'ı ile; recipe geometry-agnostik kalır.

**`coverPriority` snapshot edilmez:** Selection algoritması için catalog
metadata; render snapshot'ı bunu taşımaz çünkü render zaten cover seçildikten
sonra çalışır.

### 3.3 RenderSnapshot — byte-stable

```ts
// providers/mockup/snapshot.ts

export function snapshotForRender(
  binding: MockupTemplateBinding,
  template: MockupTemplate,
): RenderSnapshot {
  const config = binding.config as ProviderConfig;
  // coverPriority snapshot dışı (catalog meta)
  const { coverPriority, ...snapshotConfig } = config as LocalSharpConfig;

  return {
    templateId: template.id,
    bindingId: binding.id,
    bindingVersion: binding.version,
    providerId: binding.providerId,
    config: snapshotConfig,
    templateName: template.name,
    aspectRatios: template.aspectRatios,
  };
}

// Stable serialization for hash/test:
export function stableStringify(snapshot: RenderSnapshot): string {
  return JSON.stringify(snapshot, Object.keys(snapshot).sort());
}
```

### 3.4 SelectionSet → MockupJob handoff

```
POST /api/mockup/jobs
body: {
  setId: string,
  categoryId: "canvas",
  templateIds: string[]   // 1..8
}
→ 202 { jobId }

Guard:
  - SelectionSet.userId === currentUser.id (ownership)
  - SelectionSet.status === "ready"
  - templateIds.length >= 1 && <= 8
  - Her template için resolveBinding() active binding döndürmeli
  - En az 1 template'in aspectRatios'u set'in en az 1 variant ile uyumlu
```

Job creation atomic:
1. **Set snapshot:** SelectionSet + items'ın deterministik JSON snapshot'ı
   alınır (Phase 8 job-time discipline; Phase 7'de formal manifest entity
   yok). Snapshot içeriği:
   ```ts
   const snapshotPayload = {
     setId: set.id,
     status: set.status,
     finalizedAt: set.finalizedAt?.toISOString(),
     items: set.items
       .filter(item => item.status !== "rejected")
       .sort((a, b) => a.position - b.position)
       .map(item => ({
         id: item.id,
         position: item.position,
         assetUrl: resolveAssetUrl(item),  // editedAsset || sourceAsset
         aspectRatio: resolveAspectRatio(item),  // §1.4 fallback chain
       })),
   };
   const setSnapshotId = stableHash(snapshotPayload);  // sha256(stableStringify(...))
   ```
   Bu hash `MockupJob.setSnapshotId` kolonunda saklanır; aynı set + aynı
   items kombinasyonu hep aynı hash'i verir (idempotent retry için
   yararlı, ama V1'de duplicate detect logic yok).
2. Her template için `resolveBinding()` çağrılır
3. `buildPackSelection()` deterministik pack üretir
4. Slot'lar için `MockupRender` satırları eager oluşturulur
   (`status: PENDING`, `templateSnapshot` doldurulmuş, `variantId` =
   SelectionItem.id)
5. Job `QUEUED` status'la oluşturulur, `totalRenders = actualPackSize`
6. BullMQ worker'a job dispatch edilir
7. 202 response'la `{ jobId }` döner

**Cross-user erişim:** 404 disiplini (Phase 6+7 emsali).

---

## 4. API Contract

V1'de aşağıdaki endpoint'ler:

### 4.1 `POST /api/mockup/jobs` — job oluştur

```
Request:
  body: { setId, categoryId, templateIds[] }

Response 202:
  { jobId: string }

Response 400:
  - INVALID_SET (status≠ready, ownership fail → 404)
  - INVALID_TEMPLATES (templateIds boş, > 8, hiç uyumlu yok)
  - TEMPLATE_INVALID (resolveBinding null)

Response 404:
  - SET_NOT_FOUND (cross-user veya yok)
```

### 4.2 `GET /api/mockup/jobs/[jobId]` — job durum

```
Response 200:
  {
    id, status, packSize, actualPackSize,
    totalRenders, successRenders, failedRenders,
    coverRenderId, errorSummary,
    startedAt, completedAt, estimatedCompletionAt,
    renders: [
      { id, packPosition, selectionReason, status,
        outputKey?, thumbnailKey?, errorClass?, errorDetail?,
        templateSnapshot: { templateName, aspectRatios, ... },
        variantId, retryCount, startedAt?, completedAt? }
    ]
  }

Response 404:
  - JOB_NOT_FOUND (cross-user veya yok)
```

`templateSnapshot.templateName` denormalized — UI grid'de ek query gerekmez.

### 4.3 `GET /api/mockup/templates?categoryId=canvas` — template listesi

```
Response 200:
  {
    templates: [
      { id, name, thumbKey, aspectRatios, tags,
        estimatedRenderMs, hasActiveBinding: boolean }
    ]
  }
```

`hasActiveBinding: false` olan template UI'da disabled görünür (v1'de tüm 8
template `hasActiveBinding: true` seed'lenir).

Provider/binding detayları client'a sızdırılmaz; UI provider-agnostik kalır.

### 4.4 `POST /api/mockup/jobs/[jobId]/renders/[renderId]/swap` — render swap

```
Request:
  body: {} (alternative auto-selected by deterministic algorithm)

Response 202:
  { newRenderId: string }

Behavior:
  - Eski render: packPosition=null (arşivlenir)
  - Yeni render: aynı packPosition, alternatif (variantId, bindingId) pair
  - Algoritma: bu pack'te kullanılmamış valid pair, lexicographic tie-break
  - Eski render output MinIO'da kalır (cleanup V2)
```

### 4.5 `POST /api/mockup/jobs/[jobId]/renders/[renderId]/retry` — render retry

```
Request:
  body: {}

Response 202:
  { renderId: string } (aynı render id, retryCount++)

Behavior:
  - Sadece status=FAILED render için
  - retryCount++, status=PENDING
  - errorClass/errorDetail temizlenir
  - BullMQ'ya yeniden dispatch
```

### 4.6 `GET /api/mockup/jobs/[jobId]/download` — bulk ZIP

```
Response 200:
  Content-Type: application/zip
  Content-Disposition: attachment; filename="mockup-pack-[jobId].zip"

  ZIP içeriği (success render'lar packPosition ASC):
    01-cover-{variantSlug}-{templateSlug}.png    (packPosition=0, cover)
    02-{variantSlug}-{templateSlug}.png           (packPosition=1)
    ...
    10-{variantSlug}-{templateSlug}.png           (packPosition=9)
    manifest.json    (variant×template eşleşmeleri, cover işareti, packSize)

Constraints:
  - job.status ∈ {COMPLETED, PARTIAL_COMPLETE} olmalı
  - Sadece success render'lar dahil edilir (failed slot'lar atlanır)
  - Cover invariant: packPosition=0 render her zaman `01-cover-...` prefix
    alır (cover swap = atomic slot swap olduğu için bu invariant her durumda
    korunur, §4.8)
  - Filename ordering = packPosition ASC → Etsy upload sırası korunur
  - Failed slot atlama davranışı: numbering packPosition'a göre değil,
    **success render sırasına** göre verilir (örn. 8/10 partial complete'te
    dosyalar 01-..08-, packPosition'da 4 ve 9'un boş olması ZIP içinde
    boşluk yaratmaz; manifest.json hangi packPosition'ların başarısız
    olduğunu kayıtlı tutar)
```

### 4.7 `POST /api/mockup/jobs/[jobId]/cancel` — job cancel

```
Request:
  body: {}

Response 200:
  { status: "CANCELLED" }

Behavior:
  - Sadece status ∈ {QUEUED, RUNNING} için geçerli
  - BullMQ job kaldırılır
  - Pending render'lar status=FAILED + errorClass=null (kullanıcı eylemi)
  - Tamamlanmış render output'ları MinIO'da kalır (kullanıcı geri dönüp
    görmek isterse)
```

### 4.8 `POST /api/mockup/jobs/[jobId]/cover` — cover değiştir

```
Request:
  body: { renderId: string }

Response 200:
  { coverRenderId: string }

Response 400:
  - INVALID_RENDER (renderId job'a ait değil)
  - RENDER_NOT_SUCCESS (status ≠ SUCCESS — fail/pending render cover olamaz)
  - ALREADY_COVER (renderId zaten coverRenderId; no-op edilmez, açıkça
    reddedilir → UI yanlışlıkla aynı render'a tıklarsa hatayı görür)

Response 404:
  - JOB_NOT_FOUND

Behavior — Atomic slot swap (V1):
  - Yalnız mevcut başarılı render'lar arasında cover değiştirilir
  - YENİ MockupRender oluşturmaz (cover swap = slot swap, pointer-only değil)
  - **Atomic swap**: yeni cover render packPosition=0'a taşınır; eski cover
    render yeni cover'ın eski packPosition'ını alır (iki render karşılıklı
    yer değiştirir, tek transaction)
  - `coverRenderId` artık yeni cover'ın id'sidir
  - **Sözleşme: cover ⇔ packPosition=0 invariant'ı korunur** — ZIP filename
    ordering, S8 grid sırası, Phase 9 listing image_order'ı bu invariant'a
    dayanır (§1.4, §3.1, §4.6, §14 ile tutarlı)

Sebep (per-render swap'tan farkı):
  - Per-render swap (§4.4): yeni render üretir (alternatif variant×binding)
  - Cover swap (§4.8): iki mevcut render arasında slot swap, yeni render yok
  - Phase 9 listing builder coverRenderId'yi listing thumbnail'i olarak alır
    (packPosition=0 = thumbnail invariant'ı sayesinde Phase 9 image order
    bilgisini packPosition'dan alabilir)
```

---

## 5. UI Ekranları

### 5.1 Route ağacı

```
/selection/sets/[setId]                                  (Phase 7 set detay)
  ↓ "Mockup'a gönder" CTA (set status="ready" iken)

/selection/sets/[setId]/mockup/apply                     (S3 ana route)
  query: ?t=tpl-a,tpl-b      (custom selection)
         ?customize=1         (S1 drawer açık)
         ?templateId=tpl-c    (S2 modal açık)

/selection/sets/[setId]/mockup/jobs/[jobId]              (S7 Job)
/selection/sets/[setId]/mockup/jobs/[jobId]/result       (S8 Result)
```

V2 reserve (V1'de yok):
```
/mockup-studio/library                  (V2: cross-set library)
/mockup-studio/templates                 (V2: global template gallery)
/mockup-studio/presets                   (V2: saved presets)
```

V1'de **Phase 8'in sidebar item'ı YOK**. Mockup Studio Phase 7'nin set detay
sayfasından "Mockup'a gönder" primary CTA ile girilir. V2'de global landing
sayfası eklenir; mevcut nested route migration olmadan korunur.

### 5.2 S3 Apply — ana karar ekranı

**Layout (4 zone, sticky header + footer):**

```
┌─────────────────────────────────────────────────────────┐
│ ← Selection / [Set Adı] / Mockup Studio                  │  ← üst bar (sticky)
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─ Set Özeti ───────────────────────────────────────┐   │  ← bağlam kartı
│ │ [hero][var2][var3][var4]+4         8 variant      │   │
│ │ [Set adı] • Canvas                                │   │
│ │ Aspect: 5×2:3, 3×3:4               [Set Detay ↗]  │   │
│ └───────────────────────────────────────────────────┘   │
│                                                         │
│ ┌─ Pack Önizleme ───────────────────────────────────┐   │  ← ana karar yüzeyi
│ │ ★ Quick Pack • 10 görsel üretilecek               │   │
│ │ Sistem set'ine uygun 6 template seçti.             │   │
│ │                                                   │   │
│ │ [thumb] Modern Sofa Wall              [×]         │   │
│ │ [thumb] Scandi Bedroom                [×]         │   │
│ │ [thumb] Boho Living Room              [×]         │   │
│ │ [thumb] Office 3/4 (perspective)      [×]         │   │
│ │ [thumb] Nursery Crib Wall             [×]         │   │
│ │ [thumb] Studio Clean Shot             [×]         │   │
│ │                                                   │   │
│ │ [+ Template Ekle]              [Özelleştir →]     │   │
│ │                                                   │   │
│ │ ⓘ Sistem set'ine uygun seçim yaptı (hover detay)  │   │
│ └───────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ Tahmini süre: ~30 saniye      [Render et (Quick Pack)]  │  ← karar bandı (sticky)
└─────────────────────────────────────────────────────────┘
```

**Set özeti kart** = bağlam kartı (eylem merkezi değil). Hero variant büyük,
3-4 alternatif variant küçük preview, variant sayısı + aspect breakdown +
Phase 7 set detay link.

**Pack özeti kart** = asıl karar yüzeyi. Rozet ("★ Quick Pack" / "Custom
Pack"), pack size dürüst metni, chip dizilimi (thumb + ad + ×), iki affordance
("+ Template Ekle" + "Özelleştir →" — ikisi de aynı drawer açar), diversity
ⓘ tooltip.

**Karar bandı** = güvence + CTA. Tahmini süre, dirty ise "Reset to Quick Pack
↺", actualPackSize<10 ise ⚠ uyarı, primary CTA "Render et (mode)".

**State coverage (9 state):**

| State | UI davranışı |
|---|---|
| Default + Quick Pack | Standart render (yukarıdaki layout) |
| Default + Custom Pack | Rozet outline "Custom Pack" + diversity tooltip gizli + "Reset ↺" link + CTA "Render et (Custom Pack)" |
| Compat-limited preview (actualPackSize<10) | Pack subtitle dürüst "6 görsel — set'inde yeterli variant veya uyumlu template yok" + footer ⚠. Pre-flight hesap; partial-complete S3'te yoktur (job henüz submit edilmedi). |
| Empty pack (templateIds=[]) | EmptyPackState component + CTA disabled + "Template Ekle" prompt |
| Incompatible set (hiç uyumlu yok) | Pack özeti yerine IncompatibleSetBand: "Bu set ile uyumlu template yok" + Phase 7 dön linki + CTA gizli |
| Set not ready (status≠ready) | Üst banner: "Bu set hazır değil. Phase 7'de review tamamla." + Phase 7 link + CTA gizli |
| Submit loading | CTA "Hazırlanıyor..." + spinner + disabled |
| Submit error | Inline alert (5sn fade Phase 7 emsali): "Render başlatılamadı: [error]." + retry buton |
| Post-submit | router.push redirect → S7 Job |

**Kararlar bilinçli sade:**
- Diversity tooltip ⓘ icon arkasında (göze sokmuyor; "akıllı sistem" hissi
  vermiyor — Phase 7 review heuristic tooltip emsali)
- Karar bandı checklist'e dönüşmez (form-doldurma anti-pattern)
- Set özeti yalnız "ben neyi mockup'lıyorum?" sorusunu cevaplar; eylem
  merkezi değil

**Reject edilen alternatifler:**
- *Minimal CTA (sadece buton):* set bağlamı kaybolur, kullanıcı pack içeriğini
  S1 drawer açmadan göremez
- *Pre-flight checklist (8 satır kontrol listesi):* "üretici" karakter
  öldürülür, decision paralysis

### 5.3 S1 Browse — drawer (S3 üstünde)

`?customize=1` query açıldığında S3'ün üstüne sağdan slide-in (40-50%
viewport width). Phase 7 `AddVariantsDrawer` emsali pattern.

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│ ← S3'e dön    Template Kütüphanesi          [X]     │
├─────────────────────────────────────────────────────┤
│ Filtre: [Tüm vibe ▾] [Tüm odalar ▾] [Aspect ▾]      │
│                                                     │
│ Pakette: 6 template • [Pack'i göster ↓]            │
│                                                     │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐                        │
│ │ ✓  │ │ ✓  │ │    │ │    │                        │
│ │thumb│ │thumb│ │thumb│ │thumb│                    │
│ └────┘ └────┘ └────┘ └────┘                        │
│ "Modern  "Scandi  "Boho   "Office                  │
│  Sofa"   Bedroom" Living"  3/4"                    │
│                                                     │
│ [...8 template grid + pagination yok, hepsi]       │
└─────────────────────────────────────────────────────┘
```

**Davranış:**
- Pakettekiler ✓ rozetli
- Tıklayınca S2 modal açılır (`?templateId=...`)
- Card üstünde + (ekle) / × (çıkar) toggle
- Filter chip'ler client-side query (server'dan zaten 8 template gelmiş)
- Aspect filter default: set'in aspect'leri ile uyumlu olanlar
- "Pack'i göster ↓" → S3'e dön (drawer kapat)

**Filter taxonomy v1:**
- **Vibe**: All, Modern, Scandinavian, Boho, Minimalist, Vintage, Playful
- **Room**: All, Living Room, Bedroom, Office, Nursery, Hallway, Dining
- **Aspect**: All, 1:1, 2:3, 3:4

**Min/max enforcement:** templateIds.length 1..8 UI'da enforced; 0 olunca
S3'te "empty pack" state, 8'i aşmaya çalışınca toast "max 8 template."

### 5.4 S2 Detail — modal (S1 üstünde)

`?templateId=...` query açıldığında S1 drawer'ın üstüne modal (60% viewport,
center). Backdrop S1'i blur'lar.

**Layout:**

```
┌──────────────────────────────────────────────┐
│ ← Geri                                  [X] │
├──────────────────────────────────────────────┤
│ Modern Sofa Wall                             │
│                                              │
│ ┌────────────────────────────────────┐       │
│ │  [Büyük preview: base + safeArea   │       │
│ │   overlay + örnek desain placement]│       │
│ └────────────────────────────────────┘       │
│                                              │
│ Aspect: 2:3, 3:4 • Vibe: Modern, Neutral    │
│ Room: Living Room • Composition: Frontal     │
│                                              │
│ Tahmini render süresi: 2 saniye              │
│                                              │
│ [✓ Pakette • Çıkar]   veya   [+ Pakete ekle] │
└──────────────────────────────────────────────┘
```

**v1'de preview = static:** base asset + safeArea overlay + opsiyonel sample
design placeholder. **Gerçek render preview YOK** (V2'de — kullanıcı template'i
set'iyle test render eder).

**Davranış:**
- Esc / X / backdrop → modal kapanır, drawer açık kalır
- Ekle/çıkar tıklayınca URL `t=` update; modal açık kalır (kullanıcı diğer
  template'lere geçebilir)

### 5.5 S7 Job — render progress (route)

**Layout (running state):**

```
┌─────────────────────────────────────────────────────┐
│ ← Selection / [Set] / Mockup / Job                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Pack hazırlanıyor                                   │
│                                                     │
│           ┌─────────────────┐                       │
│           │   ◐  6/10        │   ← progress ring    │
│           │  render hazır    │                       │
│           └─────────────────┘                       │
│                                                     │
│ ~12 saniye kaldı (yaklaşık)                         │
│                                                     │
│ ─ Render durumu ─                                   │
│ ✓ 1. Cover • Modern Sofa × Var-3      (2.1s)        │
│ ✓ 2. Scandi Bedroom × Var-1            (1.9s)        │
│ ✓ 3. Boho Living × Var-3               (2.0s)        │
│ ✓ 4. Office 3/4 × Var-3                (3.4s)        │
│ ✓ 5. Studio Clean × Var-2              (1.8s)        │
│ ✓ 6. Nursery Wall × Var-1              (2.0s)        │
│ ◐ 7. Modern Sofa × Var-1   (rendering...)           │
│ ⊙ 8. Scandi Bedroom × Var-3 (queued)                │
│ ⊙ 9. Office 3/4 × Var-1     (queued)                │
│ ⊙ 10. Studio Clean × Var-3  (queued)                │
│                                                     │
│ Bu sayfayı kapatabilirsin. Job arka planda devam   │
│ eder. Tamamlanınca bildirim alırsın.               │
│                                                     │
│                                  [Cancel job]       │
└─────────────────────────────────────────────────────┘
```

**Davranış:**
- Polling: TanStack Query `refetchInterval: 3000`, terminal status'ta durur.
  Phase 7 v1.0.1 fix: `refetchQueries` (not `invalidateQueries`) — global
  staleTime bypass.
- ETA: `(totalRenders - successRenders) * avgRenderTime` (ilk birkaç render'dan
  hesap). "~X saniye" tilde ile (CLAUDE.md "approximate, fake precision yok").
- "Sayfayı kapatabilirsin" güvence metni — background render disiplini açık.
- Cancel: secondary, alt köşe. Confirm modal değil (Phase 7 emsali — basit
  buton + tek tıklama; cancel zaten reversible çünkü render output'ları
  kalır).

**Auto-redirect:** `status ∈ {COMPLETED, PARTIAL_COMPLETE}` olduğunda:
1. Kısa success feedback (250-500ms): progress ring "10/10 ✓" + "Pack hazır!"
   metni success ton + hafif fade
2. `router.replace(/result)` — S7 history'den silinir

> **Yumuşatma kuralı (ürün şartı):** Auto-redirect "sert kesme" hissetmemeli.
> Ama yeni ara ekran/CTA eklemiyoruz; yalnız geçişi yumuşatan mikro
> davranış (250-500ms success state). Detay implementation plan'da.

**Failed view (terminal `FAILED` status):**

```
Pack hazırlanamadı

⚠ [Error class metni: Render motoruna erişilemiyor (PROVIDER_DOWN).]
  Sistem yeniden bağlanmaya çalıştı, başaramadı.

Olası çözümler:
 • Sistem yöneticisine bilgi ver
 • Birkaç dakika sonra tekrar dene

[Yeniden dene] [S3'e dön]
```

`Yeniden dene` → S3'e gider, aynı `templateIds` ile yeni job submit.

**Cancelled view:** "Job iptal edildi. [S3'e dön]"

### 5.6 S8 Result — pack teslim (route)

**Layout (completed):**

```
┌─────────────────────────────────────────────────────────┐
│ ← Selection / [Set] / Mockup / Result                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Pack hazır: 10/10 görsel                                │
│ [⬇ Bulk download ZIP]    [Listing'e gönder →]           │
│                                                         │
│ ┌────────────────────┐                                  │
│ │ ★ Cover            │  ┌────┐ ┌────┐                  │
│ │   [thumb büyük]    │  │ 2  │ │ 3  │                  │
│ │   Modern Sofa Wall │  └────┘ └────┘                  │
│ │   × Var-3          │  ┌────┐ ┌────┐                  │
│ │   [⬇][↻ Swap]      │  │ 4  │ │ 5  │                  │
│ └────────────────────┘  └────┘ └────┘                  │
│                         ┌────┐ ┌────┐                  │
│                         │ 6  │ │ 7  │                  │
│                         └────┘ └────┘                  │
│                         ┌────┐ ┌────┐                  │
│                         │ 8  │ │ 9  │                  │
│                         └────┘ └────┘                  │
│                         ┌────┐                         │
│                         │ 10 │                         │
│                         └────┘                         │
└─────────────────────────────────────────────────────────┘
```

**Cover slot** sol üst, biraz daha büyük, "★ Cover" rozetli. Diğer 9 slot
sıralı 4×3 grid (son slot tek, ya da 3+3+3+1 layout).

**Per-render hover overlay:**
```
┌────────────────────┐
│   [thumb]          │
│                    │   <- hover
│   ★ Cover          │
│   Modern Sofa      │
│   × Var-3          │
│   [⬇] [↻ Swap]    │
│   [⤢ Büyük göster] │
└────────────────────┘
```

**Aksiyonlar:**
- **Bulk download ZIP**: tüm pack'i indir (sadece success render'lar; failed
  slot'lar atlanır)
- **Listing'e gönder →**: v1'de `disabled` + tooltip "Phase 9'da listing
  builder eklenecek"
- **Per-render download**: tek render PNG/JPG
- **Per-render swap**: deterministik alternatif kombinasyon → yeni
  MockupRender, slot in-place güncellenir
- **Cover swap**: cover slot'una tıklandığında modal açılır. Modal içeriği:
  **mevcut başarılı render'lar arasından** alternatifler grid'i (cover
  hariç tüm success render'lar; max 9 alternatif). Kullanıcı tıklar →
  `POST /api/mockup/jobs/[jobId]/cover { renderId }` → atomic slot swap
  (yeni cover packPosition=0'a taşınır, eski cover yeni cover'ın eski
  slot'una geçer; §4.8). Yeni render üretilmez. UI: cover slot anında yeni
  thumbnail'i gösterir, swap edilen slot da yeni içeriğine güncellenir.
  (Eğer kullanıcı **farklı bir variant×template kombinasyonu** ile cover
  almak istiyorsa, önce per-render swap (§4.4) yapar, sonra cover swap;
  bu iki adım v1'de bilinçli ayrı.)

**Layout (partial_complete — örnek 8/10, fan-out=10 + 2 fail):**

```
┌─────────────────────────────────────────────────────────┐
│ Pack hazır: 8/10 görsel                                 │
│ ⚠ 2 render başarısız oldu. Tekrar dene veya swap yap.   │
│                                                         │
│ [⬇ Bulk download (8 görsel)] [Listing'e gönder (8) →]   │
│                                                         │
│ Cover + 7 başarılı                                      │
│ ─────                                                   │
│ Slot 4: ⚠ Failed (RENDER_TIMEOUT) [↻ Tekrar dene][↺Swap]│
│ Slot 9: ⚠ Failed (SAFE_AREA_OVERFLOW) [↺ Swap]          │
└─────────────────────────────────────────────────────────┘
```

> Pay/payda kuralı: Pay = `successRenders`, Payda = `actualPackSize`.
> Compatibility-limited senaryoda payda 10'dan küçük doğal ("6/6", "5/7");
> partial complete'te payda 10 (tam fan-out) ama success eksik. UI bu iki
> durumu aynı şablonla gösterir, alt mesaj `failedRenders > 0` ile
> ayrışır. Bu §2.5'teki netleştirmenin görsel karşılığıdır.

**Failed slot davranışı (5-class hata sözlüğü ile):**

| Error class | Slot rozeti | Eylem önerisi |
|---|---|---|
| `RENDER_TIMEOUT` | "Zaman aşımı" | [↻ Tekrar dene] (transient hata) + [↺ Swap] |
| `TEMPLATE_INVALID` | "Şablon geçersiz" | [↺ Swap] (retry işe yaramaz) |
| `SAFE_AREA_OVERFLOW` | "Tasarım sığmadı" | [↺ Swap] (farklı template) |
| `SOURCE_QUALITY` | "Kaynak yetersiz" | [↺ Swap] + Phase 7 link |
| `PROVIDER_DOWN` | "Motor erişilemez" | [↻ Tekrar dene] (sistem geri gelmiş olabilir) |

**Layout (incompatible — tüm pair invalid, ALL FAILED):**

```
Pack üretilemedi

⚠ Hiç render başarılı olmadı.
Hata özeti: 6× SAFE_AREA_OVERFLOW, 4× TEMPLATE_INVALID

Olası çözümler:
 • Phase 7'ye dön ve farklı aspect'lerle set hazırla
 • S3'e dön ve farklı template seç

[S3'e dön] [Phase 7'ye dön]
```

**Phase 9 köprüsü v1'de:**

`Listing'e gönder →` butonu **disabled + tooltip**: "Phase 9'da listing
builder eklenecek." V2/Phase 9'da activate;
`router.push("/selection/sets/[setId]/listings/draft?jobId=[jobId]")` ile
Phase 9 listing builder'a pack input'u olarak gider.

### 5.7 Background completion toast

Kullanıcı S7'den ayrıldıysa (başka tab/sayfa), job tamamlanınca **in-app
toast**: "Pack hazır: 10 görsel — [Sonucu gör]". Tıklayınca → S8.

Phase 7 `useExportCompletionToast` paterni Phase 8'e taşınır
(`useMockupJobCompletionToast`).

**V1'de browser notification API yok** (CF11). In-app toast yeterli.

### 5.8 Boş ve hata durumları kataloğu

V1'de S3'te karşılaşılabilecek state'lerin tam listesi (4.2'de detaylı):

| State | Tetikleyici | UI |
|---|---|---|
| Default Quick Pack | Set ready, default 6 template uyumlu | Standart |
| Custom Pack (dirty) | URL'de `t=` var, default'tan farklı | Outline rozet, reset link |
| actualPackSize<10 | validPairs sınırı | Dürüst sayım + ⚠ |
| Empty pack | Kullanıcı tüm template'leri çıkardı | EmptyPackState + CTA disabled |
| Incompatible set | Hiç template aspect uyumlu değil | IncompatibleSetBand + Phase 7 link |
| Set not ready | URL'den geldi, status≠ready | Banner + Phase 7 link, CTA gizli |
| Set not found / cross-user | 404 | Phase 7 emsali 404 sayfası |
| Submit loading | Mutation pending | CTA "Hazırlanıyor..." + spinner |
| Submit error | API 4xx/5xx | Inline alert 5sn fade + retry |

S7'de:

| State | UI |
|---|---|
| Queued/running | Progress ring + timeline + ETA + cancel |
| Completed | Kısa success → auto-redirect S8 |
| Partial complete | Kısa success → auto-redirect S8 |
| Failed | FailedView + Yeniden dene + S3'e dön |
| Cancelled | "İptal edildi" + S3'e dön |

S8'de:

| State | Tetikleyici | UI |
|---|---|---|
| Completed full (10/10) | actualPackSize=10, failedRenders=0 | Standart grid, cover first |
| Completed compat-limited (6/10) | actualPackSize<10, failedRenders=0 | "6/10 görsel — set'inde yeterli variant veya uyumlu template yok" + standart grid (6 slot, cover first) |
| Partial complete (8/10) | actualPackSize=10, failedRenders>0 | "8/10 görsel — 2 render başarısız" + grid + failed slot rozetli + retry/swap |
| Partial compat-limited (5/7) | actualPackSize<10, failedRenders>0 | "5/7 görsel — 2 render başarısız" + paydaya `actualPackSize` |
| All failed (0/10 veya 0/X) | successRenders=0 | "Pack üretilemedi" + hata özeti + recovery linkleri |
| Job not yet complete (deep-link) | status ∈ {QUEUED, RUNNING} | S7'ye nazik redirect |

---

## 6. State + Navigasyon Mimarisi

### 6.1 URL primary state

Kanonik kaynak = URL. Local UI mirror (Zustand) v1'de zorunlu **değil**;
React Query (server state) + `useSearchParams` + `useMemo` yeterli.

```ts
// src/features/mockups/hooks/useMockupPackState.ts

export function useMockupPackState(setId: string) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const { data: set } = useSelectionSet(setId);
  const { data: templates } = useMockupTemplates({ categoryId: "canvas" });

  const defaultTemplateIds = useMemo(() =>
    set && templates ? selectQuickPackDefault(set, templates, 6) : [],
    [set, templates]
  );

  const urlTemplateIds = parseTemplateIds(searchParams.get("t"));
  const selectedTemplateIds = urlTemplateIds ?? defaultTemplateIds;

  // Validation: invalid IDs silently filter
  const validIds = selectedTemplateIds.filter(id =>
    templates?.some(t => t.id === id)
  );

  const isDirty =
    urlTemplateIds !== null &&
    !arraysEqual(urlTemplateIds, defaultTemplateIds);

  const isCustom = urlTemplateIds !== null;

  const toggleTemplate = useDebouncedCallback((templateId: string) => {
    const next = selectedTemplateIds.includes(templateId)
      ? selectedTemplateIds.filter(x => x !== templateId)
      : [...selectedTemplateIds, templateId];
    if (arraysEqual(next, defaultTemplateIds)) {
      updateUrl({ t: undefined });
    } else {
      updateUrl({ t: next.join(",") });
    }
  }, 150);

  const resetToQuickPack = () => updateUrl({ t: undefined });

  return {
    selectedTemplateIds: validIds,
    defaultTemplateIds,
    isDirty,
    isCustom,
    toggleTemplate,
    resetToQuickPack,
  };
}
```

**Cap + validation:** `t=` max 8 ID, geçersizler silently filter. URL update
debounced 150ms.

### 6.2 Route + replace/push disiplini

| Eylem | Method | Sonuç |
|---|---|---|
| S3 → submit → S7 | `router.push` | History entry |
| S7 → complete → S8 | `router.replace` | S7 history'den silinir |
| S8 → back | Browser back → Phase 7 set detay (S3 önce) |
| S3'te toggle | `router.replace`, scroll: false | History'de iz yok |
| Drawer aç (`?customize=1`) | `router.replace`, scroll: false | History'de iz yok |
| Modal aç (`?templateId=...`) | `router.replace`, scroll: false | History'de iz yok |
| Drawer/modal kapatma | UI affordance (Esc, X, backdrop) | Browser back **değil** |
| S8 deep-link, job not complete | `router.replace(/jobs/[jobId])` | S7'ye nazik redirect |

**Browser back UX:** Drawer/modal kapanması browser back ile **değil** UI
affordance ile. Phase 7 `AddVariantsDrawer` emsali. Kullanıcı zaten alışkın.

### 6.3 Auto-redirect yumuşatma

S7 → S8 transition kuralları:
1. `status ∈ {COMPLETED, PARTIAL_COMPLETE}` algılanır
2. Progress ring "10/10 ✓" success state — 250-500ms görünür
3. `router.replace("/.../result")` çağrılır
4. S8 mount edilir, pack render olur

Yumuşatma yalnız mikro davranış; **yeni ara ekran/CTA yok**.

Implementation detayı (timing, animasyon discipline) plan'da netleşir. Spec
sözleşmesi: "sert kesme hissetmemeli, ek tıklama yok".

---

## 7. Hata Sözlüğü ve Operasyonel Davranış

### 7.1 5-class hata sözlüğü

Day-1 canlı, **sözlük genişlemiyor**. Yeni hata sınıfı ihtiyacı doğunca
spec'te tartışılır, ad-hoc eklenmez.

| Class | Tetikleyici | Kullanıcı mesajı (TR) | Eylem önerisi |
|---|---|---|---|
| `TEMPLATE_INVALID` | Zod parse fail, asset eksik, binding yok | "Şablon geçersiz" | Swap |
| `RENDER_TIMEOUT` | Sharp execution > timeout cap (v1: 60s/render) | "Zaman aşımı" | Retry + Swap |
| `SOURCE_QUALITY` | Design asset bozuk (alpha eksik, dim < min) | "Kaynak yetersiz" | Swap + Phase 7 link |
| `SAFE_AREA_OVERFLOW` | Design safe area'ya sığmıyor (pre-val veya runtime) | "Tasarım sığmadı" | Swap (farklı template) |
| `PROVIDER_DOWN` | Worker crash, MinIO erişimsiz, BullMQ down | "Motor erişilemez" | Retry |

**Validation katmanları:**
- **Pre-validation** (S3 client + server): aspect compatibility, safe area
  minimum size → `SAFE_AREA_OVERFLOW` fail-fast (job creation reddedilir)
- **Render-time validation** (Sharp worker): Zod parse `LocalSharpConfigSchema`
  → fail → `TEMPLATE_INVALID`
- **Provider failure** (worker exception): `PROVIDER_DOWN`
- **Timeout** (BullMQ stalled): `RENDER_TIMEOUT`

### 7.2 Retry policy

V1'de:
- **Auto-retry yok.** Failed render kalır, kullanıcı manuel retry/swap eder.
  Sebep: localhost-first, kullanıcı bilinçli kontrol.
- **Manual retry** sadece `RENDER_TIMEOUT` ve `PROVIDER_DOWN` için anlamlı
  (transient). Diğerleri için swap önerilir.
- **`retryCount` cap**: 3. Aşılırsa "yeterince denendi, swap kullan" mesajı.

V2'ye reserve: auto-retry exponential backoff (`PROVIDER_DOWN` için).

### 7.3 Cancellation

- Job status ∈ `{QUEUED, RUNNING}` iken cancel mümkün
- BullMQ job kaldırılır, in-flight render'lar status=FAILED + errorClass=null
  (kullanıcı eylemi)
- Tamamlanmış render'lar MinIO'da kalır
- Cancelled job retry edilemez (yeni job aç)

### 7.4 Storage / cleanup

- Asset versionlı path (`mockup-templates/canvas/tpl-001/v3/base.png`) →
  eski version'lar kalır (snapshot retry için gerekli)
- Render output: signed URL TTL 24h (Phase 7 export emsali)
- Swap arşivlenen render output: MinIO'da kalır, cleanup V2 (CF14)
- Failed render output: yok (render başarısız olduğu için zaten output
  yazılmamış)

### 7.5 BullMQ job konfigürasyonu

```ts
// jobs/mockup-render.config.ts
export const MOCKUP_RENDER_JOB = {
  name: "MOCKUP_RENDER",
  attempts: 1,                  // auto-retry yok
  timeout: 60_000,              // 60s/render → RENDER_TIMEOUT
  removeOnComplete: 100,        // son 100 başarılı job
  removeOnFail: 200,            // son 200 başarısız job (debug için)
};
```

Phase 7 BullMQ job emsali; aynı disiplin.

---

## 8. Test Stratejisi

### 8.1 Sharp deterministic snapshot

V1 template seti 8 mockup, kalite garantisi:
- **7 frontal template (rect safeArea):** Sharp `composite()` pixel-perfect
  deterministic → SHA hash snapshot test (byte-stable)
- **1 perspective template (Office 3/4):** 4-corner transform deterministic
  değil (antialiasing) → SSIM tolerance test (~%1 fark kabul)

**Test fixture:**
```
__tests__/fixtures/mockup/
  designs/
    var-frontal-2x3.png
    var-frontal-3x4.png
    var-perspective.png
  expected/
    tpl-001-x-var-2x3.png      (snapshot referansı)
    tpl-001-x-var-2x3.sha256
    ...
```

Her aktif binding × her aspect-uyumlu test design = ~10-15 snapshot.

### 8.2 Zod schema validation

`LocalSharpConfigSchema`, `MockupRecipeSchema`, `SafeAreaSchema` (discriminated
union), API contract body schemas. Pre-render `parse()` zorunlu; fail =
`TEMPLATE_INVALID`.

### 8.3 State machine tests

- `MockupJob` state geçişleri (queued → running → completed/partial/failed/
  cancelled) — 5-7 senaryo
- `MockupRender` state geçişleri — 3 senaryo
- Aggregate roll-up (success/fail count → status) — 4 edge case
- `resolveBinding` priority chain — 5 senaryo (active local, no local fallback
  to API, no active, missing template, cross-version)
- `buildPackSelection` algoritması — 6 senaryo (full, partial, empty,
  cover-from-hero, cover-from-priority, edge cases)
- `selectQuickPackDefault` — 6 senaryo (vibe diversity, lex tie-break,
  insufficient compatible, no compatible, all-vibes-covered)

### 8.4 UI integration tests

- S3 default render → "Render et" → S7 redirect
- S3 customize → URL update → drawer açılır → template ekle → URL update
- S3 → S1 → S2 → S1 → S3 round-trip + state preservation (URL'den hydrate)
- Refresh on S3 with `?t=` → state restore
- S7 polling → completed → auto-redirect S8 (mock timer)
- S8 deep-link with job not complete → S7 redirect
- S8 swap action → URL stable, slot updated
- Partial complete render → S8 failed slot görünür + retry CTA
- Empty pack → CTA disabled
- Incompatible set → IncompatibleSetBand + Phase 7 link

### 8.5 E2E golden path

Phase 7 emsali tek kapsamlı E2E:
```
1. Phase 7 set ready hazırla (fixture)
2. /selection/sets/[setId] → "Mockup'a gönder" tıkla
3. S3 default Quick Pack görünür
4. "Render et (Quick Pack)" tıkla
5. S7'ye redirect, polling başlar
6. Mock worker render'ları success ile bitirir
7. Auto-redirect S8
8. 10/10 görsel görünür, cover first
9. "Bulk download ZIP" → download başlar
```

### 8.6 Ölçek

- Unit: ~80-100 test (Sharp snapshot ~15, state machine ~25, schema ~15,
  algoritma ~15, helper ~15)
- Integration: ~15-20 test
- E2E: 1 golden path
- Phase 7 ölçeğinde (Phase 7 toplam ~735 unit). Phase 8 ekleyeceği ~100
  unit + ~20 integration.

---

## 9. V1 Template Asset Envanteri

V1'de seed'lenecek 8 template:

| # | Template | Aspect ratios | safeArea tipi | Vibe | Room | coverPriority |
|---|---|---|---|---|---|---|
| 1 | Modern Living Room — Sofa Wall | 2:3, 3:4 | rect | modern, neutral | living-room | 90 |
| 2 | Scandinavian Bedroom — Bed Wall | 2:3, 3:4 | rect | scandinavian, minimal | bedroom | 80 |
| 3 | Minimalist Office — Desk Wall (3/4 açı) | 3:4 | **perspective** | minimalist, modern | office | 50 |
| 4 | Boho Living Room — Gallery Wall | 1:1, 2:3 | rect | boho, neutral | living-room | 70 |
| 5 | Nursery — Crib Wall | 2:3 | rect | playful, soft | nursery | 60 |
| 6 | Hallway — Single Canvas | 2:3, 3:4 | rect | modern, vintage | hallway | 40 |
| 7 | Dining Room — Table Wall | 2:3 | rect | vintage, warm | dining | 30 |
| 8 | Studio Shot — White Background | 1:1, 2:3, 3:4 | rect | minimalist | studio | 100 (clean shot, default cover) |

V1 vibe diversity envanteri: modern, scandinavian, minimalist, boho, playful,
vintage = 6 vibe (Quick Pack default 6 template hedefli).

> **Mock fixture ↔ V1 envanter ayrımı (dürüstlük notu):**
> `mockup-studio-shared.jsx` mock fixture'ı (t-w-01..t-w-08 wall-art
> template'leri) Hi-Fi'da **tasarım dilini ve davranış referansını** verir
> (chip pattern, filter taxonomy, recommended/premium rozet fikri).
> Spec §9'daki V1 envanteri ise **implementation için bağımsız tasarlanmış**
> bir set'tir; mock fixture'daki template adları/property'leri birebir
> kullanılmaz. Sebep: mock fixture'da bazı template'ler (örn. "Boho gallery
> wall · 3-up", "Square print · brass frame") V1 scope'u içinde olmayan
> kompozisyonlara işaret ediyor (gallery set veya 1:1 frame'li); V1
> kapsamı (`canvas` kategorisi, frontal+1 perspective, 6 vibe diversity
> bütçesi) için bağımsız 8 template kümesi seçildi. Asset üretim T0a
> bu envantere göre yapılır; mock JSX hiç render edilmez.

Asset üretim pipeline (T0a):
- Stock photo veya AI-generated oda fotoğrafı (Etsy commercial use uyumlu
  lisans)
- Manuel safe area kalibrasyonu — JSON ile (`SafeAreaRect` veya
  `SafeAreaPerspective`)
- 4-corner perspective (template 3) için fiziksel canvas-on-wall fotoğrafı
  + manuel corner pick
- Recipe seed (`blendMode: normal` + `shadow: { offsetX: 8, offsetY: 12,
  blur: 16, opacity: 0.3 }`) — normal canvas-on-wall görünüm
- Thumbnail otomatik (Sharp resize 400×400)

Tahmini efor: 2-3 gün tasarım + kalibrasyon + admin seed JSON.

---

## 10. Phase 7 Pattern Sürekliliği

V1 Mockup Studio aşağıdaki Phase 7 patternlarını birebir taşır:

| Pattern | Phase 7'de | Phase 8'de |
|---|---|---|
| Drawer (sağdan slide-in 40-50%) | `AddVariantsDrawer` | S1 Browse drawer |
| Modal (center, Radix Dialog + backdrop) | `CreateSetModal`, `FinalizeModal` | S2 Detail modal, Cover Swap modal |
| Polling (`refetchInterval: 3000` + terminal stop) | Heavy edit + Export job | S7 Job |
| `refetchQueries` (not `invalidate`) v1.0.1 fix | ExportButton, HeavyActionButton | S7 Job polling |
| Inline alert 5sn fade | QuickActions, ExportButton | S3 submit error |
| Sticky header + sticky footer | Set detail | S3 Apply |
| Background completion toast | `useExportCompletionToast` | `useMockupJobCompletionToast` |
| 404 cross-user disiplin | Phase 6 + 7 | API endpoints |
| Snapshot-lock | Phase 7 export job (set finalize → ZIP içeriği donar) | Binding + render snapshot (job-time deterministik hash) |
| BullMQ job pattern | EXPORT_SELECTION_SET | MOCKUP_RENDER |
| Zod schema runtime validation | Phase 7 review JSON | LocalSharpConfig |
| Honesty discipline (no fake confidence) | Phase 7 review heuristics | actualPackSize<10, partial complete |
| URL state primary | Selection filmstrip filter | Pack `t=` query |
| `router.replace` for overlay state | Phase 7 drawer URL | S1/S2 customize+templateId |

Yeni risk surface yok; kanıtlanmış pattern'ler.

---

## 11. CLAUDE.md Disiplin Trace

V1'in CLAUDE.md kurallarına haritası:

| Kural | Phase 8'de uygulama |
|---|---|
| "Localhost-first MVP" | Sharp primary, API provider stub |
| "Provider abstraction, hiçbir provider doğrudan UI'dan çağrılmaz" | `providers/mockup/` katmanı + `resolveBinding` |
| "Snapshot-lock job başladığında" | `RenderSnapshot` byte-stable JSON |
| "AI render kodu üretemez" | Recipe veri, kod değil |
| "ETA approximate, fake precision yok" | "~12 saniye kaldı" tilde |
| "Otomasyon her zaman review bırakır" | S3 pre-render review + S8 swap/retry |
| "Speculative architecture without immediate need yok" | Recipe minimal (V2 alanları YOK) |
| "Templates evolve eski job'ı kırmamalı" | Asset versionlı path + binding.version |
| "Guided + Advanced Mode coexist" | Quick Pack default + Customize tweak |
| "Fail fast where correctness matters" | Empty/incompatible set state'leri |
| "Zustand client-only UI state, React Query server-synchronized" | URL primary; Zustand opt-in |
| "Visibility/state server-side enforce" | API guard'ları (ownership, status) |
| "Parallel patterns oluşturma" | Phase 7 emsali drawer/modal/polling/snapshot |
| "Test edilmemiş kritik davranış yok" | Sharp snapshot + state machine + integration |

---

## 12. Açık Riskler ve Karar Tabanı

### 12.1 Açık riskler (plan'a aktarılacak)

| # | Risk | Etki | Plan'da çözüm |
|---|---|---|---|
| R1 | 4-corner perspective Sharp library seçimi | 1 template'in render kalitesi | Plan task 1: `sharp-perspective` paketi vs manuel matrix transform spike + karar |
| R2 | Asset üretim süresi (~2-3 gün) | Implementation timeline | Plan task 0 paralel başlatılır (tasarım/manuel) |
| R3 | Auto-redirect timing micro-interaction | UX hissi | Plan task: animasyon timing 250-500ms, smoke test |
| R4 | Storage maliyeti versionlama | Disk dolması (uzun vade) | V2 cleanup job (CF14); V1 marginal |
| R5 | URL `t=` uzunluğu (8 template × 20 char) | URL bar görsel rahatsızlık | V2 preset key kısaltması (CF4); V1 kabul |
| R6 | BullMQ stalled job timeout (RENDER_TIMEOUT cap) | False positive timeout | Plan task: 60s cap + monitoring; V2 dynamic |
| R7 | Phase 9 köprüsü disabled placeholder UX | Kullanıcı "ne zaman?" sorusu | Tooltip metni + Phase 9 docs link |
| R8 | Sharp version upgrade snapshot drift | Test regression | Phase 7 emsali pin + upgrade ritüeli |

### 12.2 Karar tabanı

V1'de aşağıdaki kararlar **kilitli sayılır**, plan boyunca yeniden tartışmaya
açılmaz:

1. V1 scope: 1 kategori (canvas), 1 provider primary (local-sharp), 8 template
2. `MockupTemplate` + `MockupTemplateBinding` ayrı tablo (one-to-many)
3. `MockupJob` 1:N `MockupRender` aggregate
4. Snapshot binding seviyesinde
5. SafeArea discriminated union (rect + perspective)
6. Recipe minimal (blendMode + opsiyonel shadow)
7. Curated pack: cover + template diversity + variant rotation
8. Quick Pack default + Customize tweak
9. URL primary state (`t`, `customize`, `templateId`)
10. S3 ana route + S1 drawer + S2 modal overlay layered
11. S7/S8 ayrı route + auto-redirect (yumuşatılmış)
12. 5-class hata sözlüğü
13. Phase 9 köprüsü S8'de disabled placeholder
14. V1 sidebar item yok; Phase 7 set bağlamından giriş

Plan ve implementation bu kararları **uygular**, tartışmaz.

---

## 13. Spec Self-Review

> **Revizyon turu (2026-05-01 review-1):** Reviewer'ın 7 maddelik dar
> kapsamlı bulguları kapatıldı (K1-K7). Hiçbir mimari karar değişmedi.
> Düzeltmeler: gerçek Phase 7 schema'sı ile hizalanma (K1), formal
> "manifest schema v1" iddiasının sadeleştirilmesi (K2), Cover Swap
> endpoint'inin eklenmesi (K3), `actualPackSize`/`partial_complete`
> ayrımının netleştirilmesi (K4), Quick Pack default iterasyonunun
> deterministik hale getirilmesi (K5), Phase 7 modal emsalinin
> düzeltilmesi (K6), mock fixture/V1 envanter ayrımının dürüst not'u (K7).
>
> **Revizyon turu (2026-05-01 review-2):** Reviewer retry'da yakalanan
> K8 (cover swap packPosition tutarsızlığı, 4 yerde stale referans) ve
> K9 (tipo) kapatıldı. K8 için Seçenek A benimsendi: **cover swap = atomic
> slot swap, cover ⇔ packPosition=0 invariant'ı korunur**. §4.8 davranışı
> atomic swap'a güncellendi; §1.4, §3.1, §4.6, §14 ve §5.6 cover swap UI
> sözleşmesi bu invariant'a hizalandı. Pointer-only varyant reddedildi
> (§4.8'de explicit "pointer-only değil" negation). K9: §2.5'teki
> `aktualpack size` tipo'su `actualPackSize`'a düzeltildi.

### 13.1 Placeholder scan

- [x] "TBD", "TODO", "ileride netleşir" yok (sadece V2 carry-forward'lar
  açıkça etiketli)
- [x] "Implement later" yok
- [x] "Add appropriate error handling" gibi muğlak ifade yok — 5-class hata
  sözlüğü explicit
- [x] "Similar to Phase 7" referansları açıkça emsal trace tablosunda
  (bölüm 10)
- [x] **K2 düzeltme:** "manifest schema v1" formal iddiası kaldırıldı,
  yerine §3.4'te explicit snapshot payload tanımı (deterministik hash)

### 13.2 İç tutarlılık

- [x] Veri modeli ↔ API contract ↔ UI eşleşiyor (örn. `coverRenderId`
  S8'de cover slot, schema'da MockupJob field, §4.8 endpoint'i)
- [x] State machine ↔ UI state coverage tutarlı (5 job status × UI views)
- [x] Snapshot disiplini schema + render flow + test'te tutarlı
- [x] URL şeması + route ağacı + browser back disiplini birbiriyle uyumlu
- [x] Honesty discipline her bölümde (actualPackSize, partial complete,
  Phase 9 placeholder) tutarlı uygulanmış
- [x] Phase 7 emsalleri 10. bölümde haritada, her uygulama yerinde
  işaretlenmiş
- [x] **K1 düzeltme:** §1.4 sözleşme zinciri **gerçek Phase 7 schema'sıyla
  hizalandı**: `isHero` yok → position 0 fallback; `aspectRatio` →
  `GeneratedDesign.aspectRatio` + nullable fallback chain explicit
- [x] **K3 düzeltme:** Cover Swap için §4.8 endpoint eklendi; §5.6 UI
  davranışı bu endpoint'e bağlandı (per-render swap'tan farkı net)
- [x] **K6 düzeltme:** §10 modal pattern emsalinden TypingConfirmation
  kaldırıldı, doğru emsal CreateSetModal/FinalizeModal yazıldı
- [x] **K8 düzeltme (review-2):** Cover swap atomic slot swap olarak
  netleştirildi; **cover ⇔ packPosition=0 invariant'ı** §4.8 + §1.4 + §3.1
  + §4.6 + §14 + §5.6 hepsinde tutarlı. ZIP filename ordering
  (`01-cover-...`, `02-...`, ..., packPosition ASC) cover swap sonrası
  bozulmuyor. Phase 9 listing image_order packPosition'dan türeyebilir.
  Stale "pack[0]" referansı schema yorumunda düzeltildi; sözlük genişletildi.

### 13.3 Scope check

- [x] V1 scope tek implementation plan'a sığar (Phase 7 ölçeği:
  ~80-100 unit + ~20 integration test, ~3 hafta)
- [x] Carry-forward'lar dürüst ayrılmış (15 madde + 3 task 0)
- [x] Spec içinde tek "MVP" kapsamı — birden fazla sub-project yok
- [x] V2 reserve şema kırmadan genişlemeye hazır (her omurga karar bunu
  doğruluyor)
- [x] **Revizyon turunda yeni mimari karar açılmadı** — K1-K7 yalnız mevcut
  spec'teki tutarsızlık/ambiguity'leri kapattı; mimari kararlar (15 madde,
  §12.2) kilitli kaldı

### 13.4 Ambiguity check

- [x] "Default 6 template" sayısının sebebi açıkça gerekçelendirilmiş
- [x] "Quick Pack" vs "Custom Pack" rozeti dirty türevi — fake state yok
- [x] `actualPackSize < 10` davranışı dürüst metin ile gösterim sözleşmesi
- [x] Auto-redirect "kısa success feedback (250-500ms)" — micro-interaction
  detayı plan'a aktarıldı, spec sözleşmesi net
- [x] 4-corner perspective library kararı plan task 1'e devredildi (spec
  seçim yapmıyor, scope'una uygun değil)
- [x] Phase 9 köprüsü davranışı: disabled + tooltip metni explicit
- [x] **K4 düzeltme:** `totalRenders = actualPackSize` netleştirildi; §2.5
  3 ayrı durum tablosu (compatibility-limited / partial complete / karma)
  + §5.8 S8 state coverage 6 satıra ayrıldı + §5.6 layout pay/payda kuralı
- [x] **K5 düzeltme:** `selectQuickPackDefault` ve `buildPackSelection`
  iterasyon öncesi `id` ASC stable sort disiplini explicit (§2.5 + §2.6)
- [x] **K7 düzeltme:** §9'a mock fixture ↔ V1 envanter ayrım notu eklendi
- [x] **K9 düzeltme (review-2):** §2.5'teki `aktualpack size` tipo'su
  `actualPackSize` olarak düzeltildi.

### 13.5 Honesty discipline final check

- [x] "Fake 10/10" yok → `actualPackSize` dürüst gösterim
- [x] Failed render gizlenmez → S8 partial complete first-class
- [x] ETA "approximate" → tilde ifade
- [x] Dynamic Mockups "ana yol" gibi sunulmadı → "secondary stub" olarak net
- [x] Phase 9 köprüsü "yakında" değil, "Phase 9'da activate" → dürüst tooltip
- [x] V2 carry-forward'lar "v1'de eksik" değil "bilinçli kesim" olarak
  konumlandı
- [x] **K1 honesty:** "Phase 7'de isHero alanı var" sahte iddiası kaldırıldı;
  v1 hero fallback (position 0) bilinçli v1 kararı olarak yazıldı
- [x] **K2 honesty:** "Phase 7 manifest schema v1" formal iddiası
  kaldırıldı; Phase 8 job-time snapshot disiplini olarak dürüst yazıldı
- [x] **K7 honesty:** Mock fixture ↔ V1 envanter farkı dürüstçe açıklandı
  (mock JSX render edilmez, V1 envanter bağımsız tasarlandı)
- [x] **K8 honesty (review-2):** Cover swap için iki seçenek (atomic swap
  vs pointer-only) açıkça tartışıldı; Seçenek A (atomic swap) tek
  invariant ile (cover ⇔ packPosition=0) seçildi. Pointer-only varyantı
  spec'te "pointer-only değil" diye explicit reddedildi — gizli mental
  model yok.

**Self-review sonucu: GEÇTİ (revizyon turu sonrası — review-1 + review-2
kapalı).** Spec plan yazımına hazır.

---

## 14. Sözlük

| Terim | Tanım |
|---|---|
| **MockupJob** | Kullanıcı niyetinin aggregate entity'si. 1 SelectionSet → 1 job. |
| **MockupRender** | Job'un alt çıktıları. Variant×template kombinasyonu, deterministik seçilmiş. |
| **Pack** | MockupJob'un teslim ettiği curated 10-görsel set. Cover + 9 diversity slot. |
| **Cover** | Pack'in 1. görseli (`coverRenderId` = packPosition=0 invariant'ı, §4.8 atomic slot swap), Etsy listing thumbnail'i. Cover seçimi: hero variant (rank 0 fallback) × en yüksek `coverPriority`'li binding (§2.5). |
| **Quick Pack** | Sistem default'u: 6 template otomatik seç, deterministik. |
| **Custom Pack** | Kullanıcı default'tan saptığında URL'de `t=` ile override edilmiş seçim. |
| **MockupTemplate** | Kullanıcı kataloğunda görünen template entity'si (provider-agnostik). |
| **MockupTemplateBinding** | Template'in belirli bir provider ile nasıl render edileceği (provider-config). |
| **resolveBinding** | Deterministik provider seçim algoritması: priority chain. |
| **LocalSharpConfig** | local-sharp provider için config (asset + safeArea + recipe). |
| **SafeArea** | Design'ın template'e yerleşeceği zone. Discriminated union: rect (frontal) veya perspective (4-corner). |
| **Recipe** | Compositing davranış talimatı: blendMode + opsiyonel shadow. |
| **RenderSnapshot** | Render başına byte-stable JSON; binding state'ini dondurur. |
| **PackSelectionReason** | Slot'un seçim sebebi: COVER / TEMPLATE_DIVERSITY / VARIANT_ROTATION. |
| **partial_complete** | First-class job status: en az 1 success + en az 1 fail. |
| **actualPackSize** | Pack'in gerçekleşen boyutu (validPairs sınırı; max packSize). |
| **5-class hata sözlüğü** | TEMPLATE_INVALID / RENDER_TIMEOUT / SOURCE_QUALITY / SAFE_AREA_OVERFLOW / PROVIDER_DOWN. |

---

## 15. Sözleşme Onayı

Bu spec, brainstorming session'ında alınan 8 turluk omurga kararlarının
mekanik karşılığıdır. Yeni karar açılmamış, mevcut kararlar sulandırılmamış,
carry-forward'lar dürüst ayrılmıştır.

Spec hazır → plan yazımına geçmek için kullanıcı onayı beklenir
(`superpowers:writing-plans` skill).

**Plan dosyası önerilen yol:**
`docs/plans/2026-05-01-phase8-mockup-studio-plan.md`
