# Phase 7 — Selection Studio Design Spec

**Tarih:** 2026-04-30
**Durum:** Spec (brainstorming kapandı, plan'a geçiş bekliyor)
**Önkoşul:** Phase 6 (Quality Review) — Aşama 2A canlı smoke devam ediyor (KIE
maintenance). Bu spec Phase 6 smoke'tan **bağımsız tasarlandı**; Phase 6 review
verisi yalnızca **read-only** köprüleniyor ve provisional entegrasyon noktaları
açıkça işaretlendi.

> **Çerçeve — Final ürün zihniyeti:**
> Bu spec "sonra toparlarız" refleksiyle değil, kullanıcıya gerçekten iyi ve
> ölçeklenebilir bir ürün veriyormuşuz gibi yazıldı. Phase 7 v1 minimum scope
> olsa da, alınan kararlar final ürün davranışını destekleyecek şekilde
> seçildi. Out-of-scope çizgileri kasıtlı bir kesim — kalite tavizi değil.

> **Birincil yerel tasarım kaynağı:**
> `docs/design/EtsyHub_mockups/` (bkz.
> [phase7-mockup-studio-prep.md](../design/implementation-notes/phase7-mockup-studio-prep.md)).
> Selection Studio mockup'ı `screens-b.jsx:862` (B.13). Design language:
> `EtsyHub Design Spec.md`, `tokens.css`, `primitives.jsx`. Phase 6'dan
> devralınan UI patternlar (drawer, TypingConfirmation, BulkActionsBar,
> selection store, StateMessage) reuse edilir.

---

## 1. Amaç ve Kapsam

### 1.1 Amaç

Selection Studio, kullanıcının üretilmiş tasarım varyantları (`GeneratedDesign`)
üzerinde **seçim ve deterministik düzenleme** yaparak Mockup Studio'ya
(Phase 8) hazır bir **`SelectionSet`** oluşturduğu kokpittir. Akış zincirinde
yeri:

```
Reference → Variation → [Phase 6: Review] → Selection Studio → [Phase 8: Mockup] → Listing → Etsy
```

Phase 6 review verisi varsa Selection Studio'da **read-only** gösterilir,
seçim kararını destekler. Yoksa Studio yine işler — Phase 6'ya bağımlı
değildir.

### 1.2 Phase 7 v1 — In-scope

- `SelectionSet` ve `SelectionItem` veri modeli + state machine
  (`draft / ready / archived`)
- Quick start: `/review` AI Tasarımları sekmesinden batch-level "Selection
  Studio'da Aç" (lazy auto-create) → canonical `/selection/sets/[setId]`
- `/selection` minimal index (aktif draft + son ready listesi)
- Selection Studio canvas: aktif preview + filmstrip + sağ panel
- 3 deterministik hızlı işlem: **Crop**, **Transparent PNG kontrolü**,
  **Background remove**
- Hibrit edit semantiği: `sourceAssetId` immutable + tek seviye undo +
  reset to original + `editHistoryJson` audit
- Hibrit işleme modeli: instant ops senkron, heavy ops BullMQ (paralel heavy
  yasağı aynı item'da)
- AI Kalite paneli (Phase 6 review verisi read-only, mapper layer ile
  şema izolasyonu)
- Item ekleme drawer'ı (Reference Batches tab aktif, Review Queue tab
  disabled)
- Item status: `pending / selected / rejected` (default `pending`, opt-in)
- Bulk action: multi-select + sticky bar (Seçime ekle / Reddet / Kalıcı çıkar)
- Soft remove (`rejected`) + hard delete (TypingConfirmation, "SİL" onayı)
- Filmstrip filter: `Tümü / Aktif / Reddedilenler`
- User-controlled reorder (a11y stratejisi plan'da netleşir)
- Finalize action: `draft → ready` (state machine zorunlu, item status'lar
  donar)
- Async ZIP export: `EXPORT_SELECTION_SET` job, signed URL 24h, cleanup 7g
- Inline UI feedback + Phase 6 notification altyapısı reuse (heavy edit +
  export completion/failure)
- Cross-user erişim: **404** disiplini (Phase 6 ile tutarlı)
- Test disiplini: Phase 6 birebir (TDD + 2-stage review)

### 1.3 Phase 7 v1 — Out-of-scope

- AI destekli "Edit prompt / Edit uygula" (serbest metinle image editing,
  inpainting, style rewrite, text removal by prompt)
- Upscale 2× implementasyonu (UI buton görünür, **disabled placeholder**)
- Non-destructive edit chain, multi-step undo/redo, op enable/disable,
  reusable edit preset
- Set rename, archived set yönetimi UX'i, çoklu aktif draft set yönetimi
- `ready → draft` geri dönüş
- Review tetikleme, re-review, review filtreleme, review-to-selection
  otomasyonu
- Reference detay sayfasından Quick start
- Reference geçmişinin tamamını sete toplama
- Aynı batch'ten ikinci kez Quick start uyarısı (Phase 7 v1: her tıklama yeni
  set)
- Item-level note/etiket, çoklu set arası item taşıma, otomatik AI sort
- Item-level `exported` durumu (set düzeyinde yeterli)
- Mockup Studio handoff implementasyonu (Phase 8 sorumluluğu)
- Listing/CSV export (Export Center kapsamında, Phase 9+)
- Mobile-optimized layout (desktop-first; mobile responsive Phase 7+)

### 1.4 Tasarım disiplinleri

- **Honesty:** Mockup'ı sahte capability ile göstermiyoruz. Edit prompt
  bölümü komple **gizli** (placeholder bile değil); Upscale 2× **disabled
  "Yakında"**; review yoksa sade hint. İki farklı "Yakında" yüzeyini
  istemediğimiz için Edit prompt için gizleme tercih edildi.
- **Multi-user izolasyon:** Tüm endpoint'lerde owner-filtered query. Cross-user
  erişim **404** (Phase 6 ile aynı semantik — varlık sızıntısı önlenmesi).
- **Final ürün:** Set zaman içinde büyüyebilir, item'lar reorder edilebilir,
  user explicit selection yapar. Phase 7 v1 minimum UX olsa da davranış final
  ürün gibi.
- **Phase 6 izolasyonu:** Review verisi yalnız okunur, Selection Studio
  yazmaz/güncellemez/silmez. Mapper layer Phase 6 schema değişikliklerini
  Studio'dan izole eder.
- **CLAUDE.md uyumu:** Explicit state machines, backend authorization, test
  ve dokümantasyon disiplini, provider abstraction kapısı (in-process default).

---

## 2. Kullanıcı Akışları

### 2.1 Quick start (canonical akış)

1. User Reference Board'da reference seçer → "Benzerini Yap" → variation
   üretimi başlar (Phase 5 sorumluluğu).
2. Üretim tamamlanınca user `/review` AI Tasarımları sekmesinde batch'i
   görür.
3. **Batch grubu kartında primary action: "Selection Studio'da Aç"** tıklanır.
4. Server: yeni `SelectionSet` (auto-name: `{reference/productType} —
   {tarih}`), batch'in tüm `GeneratedDesign`'ları `SelectionItem` olarak
   eklenir (`status: pending`, `position: 0..n-1`), `sourceMetadata` yazılır.
5. Frontend: redirect `/selection/sets/[setId]`.
6. Studio açılır; user filmstrip + sağ panel ile çalışmaya başlar.

**Lazy auto-create**: Variation üretimi tamamlanınca otomatik set
**oluşturulmaz**. User explicit eylemiyle oluşur — selection kararı production
kararından ayrı tutulur.

### 2.2 Set'e variant ekleme (drawer)

1. Studio'da filmstrip sonunda "+ Varyant ekle" butonu.
2. Drawer açılır, iki tab:
   - **Reference Batches (aktif)**: User'ın geçmiş variation batch'leri
     listelenir (yeni → eski). Her batch için kapak grid + meta. Set'te zaten
     olan item'lar **disabled** (duplicate koruma). "Tüm batch'i ekle" veya
     çoklu seçim ile alt küme.
   - **Review Queue (disabled)**: "Phase 6 canlı smoke sonrası aktif"
     açıklamasıyla muted.
3. Action: "İptal" / "Eklenecek N variant" + primary "Ekle".
4. Eklenen item'lar set'e `status: pending` ile düşer, filmstrip sonuna
   eklenir.

### 2.3 Edit ve selection

1. User filmstrip'ten variant seçer (preview sol canvas'ta).
2. Sağ panelde:
   - **AI Kalite** (read-only, Phase 6 verisi varsa) — selection kararını
     destekler.
   - **Hızlı işlemler**: Crop / Transparent PNG / Background remove (Upscale
     disabled).
3. Crop / Transparent → instant, panel anında günceller.
4. Background remove → button spinner, completion'da otomatik refresh.
   Aynı item'da paralel heavy yasak (button disabled).
5. Edit yapıldı → `editedAssetId` güncellenir, önceki `lastUndoableAssetId`'ye
   düşer, `editHistoryJson`'a op eklenir.
6. **Son işlemi geri al** veya **Orijinale döndür** seçenekleri sağ panelde.
7. User "Seçime ekle" / "Reddet" ile item status değiştirir. **Edit ≠ select**
   — edit yapmak otomatik selected yapmaz.

### 2.4 Reorder

User-controlled reorder Phase 7 v1 in-scope. Erişilebilirlik şart:
- Drag handle + accessible DnD, **veya**
- Item menüsünde "Sola taşı / Sağa taşı / Başa al / Sona al" buton tabanlı
  reorder

İmplementasyon stratejisi (accessible DnD vs button-based) plan'da netleşir.
Sonuç her halükarda user-controlled.

### 2.5 Finalize ve export

1. User "Set'i finalize et" tıklar (en az 1 item gerekli).
2. Confirmation modal: "X varyant Mockup Studio'ya hazırlanıyor olarak
   işaretlenecek. Set sonrasında düzenlenemez. (X selected, Y pending, Z
   rejected — yalnız selected'lar Phase 8 input'u olur.)"
3. Onay → `set.status: draft → ready`, UI read-only mode.
4. Banner: "Bu set finalize edildi — Phase 8 Mockup Studio'da işlenecek."
5. **İndir (ZIP)** action set status'tan bağımsız her zaman mevcut (draft veya
   ready iken export edilebilir):
   - User tıklar → `EXPORT_SELECTION_SET` job enqueue.
   - Inline badge: "Export hazırlanıyor..." + notification panel'inde de
     görünür (Phase 6 reuse).
   - Tamamlanınca: signed URL 24h, "İndir" linki aktif.
   - 7 gün sonra otomatik cleanup.

---

## 3. Ekran Anatomisi

### 3.1 `/selection` — Index

Layout:
- **Üstte**: Aktif draft set kartı.
  - Set varsa: isim + item count + status badge + "Aç" primary action.
  - Set yoksa: empty state + "Yeni set oluştur" CTA (POST /api/selection/sets
    → redirect).
- **Altta**: "Son finalize edilen set'ler" (max 5, link
  `/selection/sets/[id]`).

Phase 7 v1'de minimal — set rename / search / archive UX yok
(`selection-set-management-expanded` carry-forward).

### 3.2 `/selection/sets/[setId]` — Studio

Üç bölgeli layout (mockup `screens-b.jsx:862` paterni):

**Üst bar**:
- Set adı + item count + status badge (`Draft` / `Ready`)
- Sağda: **İndir (ZIP)** secondary + **Set'i finalize et** primary (set
  draft ise)
- Ready set'te: read-only banner

**Sol canvas (1fr)**:
- Aktif preview kartı (varyant numarası "X / N", boyut "WxH · DPI", thumb
  preview, prev/next nav)
- Altında filmstrip:
  - Filtre dropdown: `Tümü / Aktif / Reddedilenler`
  - Grid layout (item count'a göre adaptif, mockup'taki sabit 12 değil)
  - Selected'lar checkmark, aktif item border accent
  - Rejected'lar opacity reduced + "Reddedildi" badge
  - Reorder: drag handle veya item menüsü (a11y plan'da)
  - Sonunda "+ Varyant ekle" butonu

**Sağ panel (320px)**:
- Header: "Edit" + "Varyant N düzenleniyor"
- **AI Kalite** bölümü:
  - Review varsa: score (büyük) + status badge + 4 sinyal (Resolution / Text
    detection / Artifact check / Trademark risk) — read-only.
  - Yoksa: muted "Bu varyant için AI kalite analizi yapılmamış" + disabled
    "Review'a gönder" link (tooltip: "Phase 6 canlı smoke sonrası aktif").
- **Hızlı işlemler**: 4 buton grid
  - Background remove ✅
  - Upscale 2× **disabled** ("Yakında" hint)
  - Crop · oran seçimi ✅ (default product type'a göre)
  - Transparent PNG kontrolü ✅
- Heavy edit çalışırken aynı item'da diğer heavy disabled
- **Edit history** (info-only liste, replay/timeline yok)
- **Undo bar**: "Son işlemi geri al" (lastUndoable varsa) + "Orijinale
  döndür"
- **Bottom**: "Reddet" secondary + "Seçime ekle" primary

**Edit prompt bölümü mockup'ta var ama Phase 7 v1'de komple gizli** (honesty
disiplini — sahte placeholder yok). Carry-forward: `selection-studio-ai-edit`.

**Bulk action mode**:
- Multi-select aktif olduğunda sticky bottom bar (Phase 6 BulkActionsBar reuse
  veya UX gerektiriyorsa adapte): "Seçime ekle (N)" / "Reddet (N)" / filtre
  reddedilenler iken "Kalıcı çıkar (N) (TypingConfirmation)".

### 3.3 Notification entegrasyonu

Phase 6 notification altyapısı reuse. Phase 7 v1 sınırı:
- Heavy edit completion / failure → notification
- Export completion / failure → notification
- Mikro state'ler için notification YOK (button spinner, badge yeterli)

Inline UI ana feedback yüzeyi; notification user sayfadan ayrılırsa kaybolma
koruması.

---

## 4. Veri Modeli

### 4.1 `SelectionSet`

| Alan | Tip | Açıklama |
|------|-----|----------|
| `id` | `String` | cuid |
| `userId` | `String` | sahibi (multi-user isolation) |
| `name` | `String` | auto-generated (`{reference/productType} — {date}`); rename Phase 7 v1'de yok |
| `status` | `Enum` | `draft / ready / archived` |
| `sourceMetadata` | `Json?` | quick-start kaynağı: `{ kind, referenceId, batchId, productTypeId, batchCreatedAt, originalCount }` |
| `lastExportedAt` | `DateTime?` | son ZIP export zamanı (item-level değil, set-level) |
| `finalizedAt` | `DateTime?` | `ready` state geçiş zamanı |
| `archivedAt` | `DateTime?` | `archived` state geçiş zamanı |
| `createdAt`, `updatedAt` | `DateTime` | standart |

### 4.2 `SelectionItem`

| Alan | Tip | Açıklama |
|------|-----|----------|
| `id` | `String` | cuid |
| `selectionSetId` | `String` | FK |
| `generatedDesignId` | `String` | FK — orijinal üretim çıktısı (immutable) |
| `sourceAssetId` | `String` | FK Asset — `generatedDesign.assetId`'e default eşit, immutable |
| `editedAssetId` | `String?` | FK Asset — son edit çıktısı (varsa aktif görüntü) |
| `lastUndoableAssetId` | `String?` | FK Asset — bir önceki edit çıktısı (tek seviye undo) |
| `editHistoryJson` | `Json` | `[{ op, params?, at }]` audit log |
| `status` | `Enum` | `pending / selected / rejected` (default `pending`, opt-in) |
| `position` | `Int` | reorder için |
| `createdAt`, `updatedAt` | `DateTime` | standart |

### 4.3 State machine — `SelectionSet.status`

Geçişler:
- `draft → ready` — finalize action (en az 1 item gerekli)
- `draft → archived` — explicit archive
- `ready → archived` — explicit archive
- `ready → draft` — **YOK** (carry-forward `selection-set-unfinalize`)

Read-only kuralı:
- Set `ready` veya `archived` ise tüm item mutasyonları (status değişimi,
  edit, reorder, ekleme, silme) **kapalı** — endpoint 409, UI'dan zaten
  butonlar disabled.

### 4.4 State machine — `SelectionItem.status`

Geçişler (yalnız set `draft` iken):

| Mevcut → | pending | selected | rejected |
|----------|---------|----------|----------|
| **pending** | — | "Seçime ekle" | "Reddet" |
| **selected** | "Seçimden çıkar" | — | "Reddet" |
| **rejected** | "Geri al" | "Seçime ekle" | — |

Edit / export item status'unu değiştirmez — ayrı boyut.

### 4.5 Edit semantiği özeti

**Aktif görüntü kuralı**: `editedAssetId` varsa o, yoksa `sourceAssetId`.

**Her deterministik edit**:
1. Mevcut aktif asset → input
2. Yeni Asset üretilir
3. Eski `editedAssetId` (varsa) `lastUndoableAssetId`'ye düşer
4. Yeni asset `editedAssetId` olur
5. `editHistoryJson`'a op eklenir

**Undo last edit**: `lastUndoableAssetId` swap, tek seviye.

**Reset to original**: aktif görüntü `sourceAssetId`, `editedAssetId`
arşivlenebilir veya temizlenebilir (öneri: temizlenir; archived asset
tablosu out-of-scope), `lastUndoableAssetId` sıfır.

**`editHistoryJson`** info/audit — interaktif replay/timeline değil.

**Out-of-scope** (carry-forward `selection-studio-nondestructive-edit-chain`):
non-destructive chain, multi-step undo, op enable/disable, chain reorder,
edit preset/template.

---

## 5. Hızlı İşlem Matrisi

| Aksiyon | Tier | İmplementasyon | Phase 7 v1 |
|---------|------|----------------|------------|
| Crop · oran seçimi | Instant (sync) | Sharp `resize` | ✅ Full |
| Transparent PNG kontrolü | Instant (sync) | **Phase 6 alpha-check motoru reuse** | ✅ Full |
| Background remove | Heavy (BullMQ) | `@imgly/background-removal` (WASM, in-process) | ✅ Full — **orta risk** |
| Upscale 2× | — | — | 🟡 **Disabled placeholder** |

**Crop**: Aspect ratio seçimi UI'da (default product type'a göre — wall art
2:3, clipart 1:1, vb.); 2:3, 4:5, 1:1, 3:4 minimum set. Sharp `fit: 'cover'`.

**Transparent PNG kontrolü**: Phase 6'daki alpha-check service layer reuse —
yeni "farklı kural seti" icat etmiyoruz. Aynı motor, aynı eşikler. Phase 6
servisi Selection Studio için expose edilmesi gerekiyorsa küçük refactor
(plan'da netleşir).

**Background remove**: `@imgly/background-removal` WASM. Risk profili:
- Model boyutu ~30-80MB → deployment + cold start etkisi
- Worker memory profili (büyük asset → OOM riski)
- Edge cases: saç, transparent objeler, low-contrast bg
- Format support: PNG/JPG/WebP minimum

Plan'da implementation karmaşıklığı ve risk **orta** olarak işaretlenir.

**Upscale 2× neden disabled**: Gerçek AI upscale (Real-ESRGAN) için ya Python
subprocess + GPU ya external provider. Phase 6 KIE smoke kapanmadan ikinci
provider yüzeyi açılmıyor. Sharp Lanczos basit interpolation "AI upscale"
diye sunulamaz (honesty). Carry-forward: `selection-studio-upscale` (zaten
açık `selection-studio-edit-providers` ile çiftlenir).

### 5.1 İşleme modeli kuralları

- **Instant (sync)**: API route içinde işlenir, response'ta yeni Asset.
  Loading state inline, başarısızsa toast + mevcut görüntü korunur.
- **Heavy (BullMQ)**: Job enqueue → `{ jobId }` response. Button spinner +
  "İşleniyor" badge. Completion'da otomatik refresh + notification. Failure'da
  retry affordance.
- **Paralel heavy yasak**: Aynı item üzerinde aynı anda ikinci heavy başlamaz.
  Upscale + bg-remove kesişimi (Upscale disabled olduğu için pratikte yok ama
  kural genel — heavy job çalışırken aynı item'da diğer heavy butonlar
  disabled).

---

## 6. ZIP Export Yapısı

### 6.1 Asset stratejisi (A3)

- **Aktif görüntü her zaman**: `images/[name].png` — aktif (`editedAssetId`
  varsa o, yoksa `sourceAssetId`).
- **Orijinal yalnız edit yapılmışsa**: `originals/[name].png` —
  `sourceAssetId`. Edit yapılmamış item'larda `originals/` içinde dosya yok.

Disk verimli, edit yapılmamış item için tekrar yaratım yok.

### 6.2 Klasör yapısı (B2)

Kökte:
```
images/
  var-001.png
  var-002.png
  ...
originals/                    (yalnız edit yapılmış item'lar için)
  var-003.png
  ...
manifest.json
README.txt
```

Set-isimlendirilmiş ek kök klasörü **yok** (gereksiz nesting).

### 6.3 Manifest schema (genişletilmiş)

```json
{
  "schemaVersion": "1",
  "exportedAt": "2026-04-30T...",
  "exportedBy": { "userEmail": "..." },
  "set": {
    "id": "...",
    "name": "...",
    "status": "draft | ready",
    "createdAt": "...",
    "sourceMetadata": { "kind": "...", "referenceId": "...", ... }
  },
  "items": [
    {
      "filename": "var-001.png",
      "originalFilename": "originals/var-003.png",
      "generatedDesignId": "...",
      "sourceAssetId": "...",
      "editedAssetId": "...",
      "editHistory": [
        { "op": "removeBackground", "at": "..." },
        { "op": "crop", "params": { "ratio": "2:3" }, "at": "..." }
      ],
      "review": {
        "score": 92,
        "status": "approved",
        "signals": { "resolution": "ok", "textDetection": "clean", ... }
      },
      "status": "selected",
      "metadata": {
        "width": 4961, "height": 7016, "dpi": 300,
        "mimeType": "image/png"
      }
    }
  ]
}
```

**Disiplin notları**:
- `review` alanı **opsiyonel** — null yığma; veri yoksa alan eklenmiyor.
- `originalFilename` yalnız edit yapılmış item'da var.
- `schemaVersion` Phase 8 Mockup Studio handoff için sözleşme alanı —
  **manifest schema sözleşme testiyle korunur**.

### 6.4 README.txt

Sade, Türkçe, 10-15 satır:
- Bu export nedir
- Klasör yapısı (`images/`, `originals/` varsa, `manifest.json`)
- Phase 8 Mockup Studio ilişkisi (export ≠ final ürün)
- Nasıl kullanılmalı (kendi mockup için, Procreate/Photoshop, vb.)

### 6.5 Export modeli (E2 async)

- BullMQ job tipi: `EXPORT_SELECTION_SET`
- User tıklar → enqueue → inline badge + notification
- Completion: signed URL **24 saat**
- Cleanup: **7 gün** sonra ZIP otomatik silinir (cron)
- Tek kod yolu (Phase 7 v1) — sync hibrit fast-path optimizasyonu sonra
  (`selection-studio-export-fast-path`)
- Set status değiştirmez (draft veya ready'de export edilebilir)

**Neden sync seçilmedi**: Büyük set (50+ variant, edit asset dahil 100+ dosya,
~500MB) request timeout + memory riski. Async tek yol → kod yolu basit, test
yükü tek pattern.

**Neden manifest zengin**: Phase 8 Mockup Studio handoff'una doğal akar; user
bugün de anlamlı çıktı alır (Procreate/Photoshop'ta tasarımlarını yönetebilir).

---

## 7. Route ve API Yüzeyi

### 7.1 Route yüzeyi

- `/selection` — index (aktif draft + son ready)
- `/selection/sets/[setId]` — Studio canvas (canonical)
- Quick start canonical değil — Reference/`/review`'den auto-create + redirect

### 7.2 API endpoint'leri (Phase 7 v1 — kesinleşmiş kontrat plan'da)

Tüm endpoint'ler **owner-filtered** (cross-user 404).

| Method | Path | Amaç |
|--------|------|------|
| `GET` | `/api/selection/sets` | Kullanıcı set'leri (status filtreli) |
| `POST` | `/api/selection/sets` | Yeni set (manuel, set-first) |
| `POST` | `/api/selection/sets/quick-start` | Batch-level auto-create (`{ source: "variation-batch", referenceId, batchId, ... }`) |
| `GET` | `/api/selection/sets/[setId]` | Set + items + review (mapper layer ile) |
| `POST` | `/api/selection/sets/[setId]/items` | Drawer ile item ekleme (batch'ten çoklu, duplicate koruma) |
| `PATCH` | `/api/selection/sets/[setId]/items/[itemId]` | Status değişimi |
| `PATCH` | `/api/selection/sets/[setId]/items/bulk` | Bulk status değişimi |
| `POST` | `/api/selection/sets/[setId]/items/bulk-delete` | Hard delete (TypingConfirmation server-side enforcement) |
| `POST` | `/api/selection/sets/[setId]/items/[itemId]/edit` | Instant edit (crop, transparent-check) |
| `POST` | `/api/selection/sets/[setId]/items/[itemId]/edit/heavy` | Heavy edit job enqueue (bg-remove) — `{ jobId }` |
| `POST` | `/api/selection/sets/[setId]/items/[itemId]/undo` | Tek seviye undo |
| `POST` | `/api/selection/sets/[setId]/items/[itemId]/reset` | Orijinale döndür |
| `POST` | `/api/selection/sets/[setId]/items/reorder` | Bulk position update (atomik) |
| `POST` | `/api/selection/sets/[setId]/finalize` | `draft → ready` |
| `POST` | `/api/selection/sets/[setId]/archive` | `draft|ready → archived` |
| `POST` | `/api/selection/sets/[setId]/export` | Async ZIP job — `{ jobId }` |

**Authorization**: Tüm path-param'lı endpoint'ler set ownership doğrular —
yoksa 404 (Phase 6 paterni). Bulk endpoint'ler ownership filtrasyonunu DB
query'sinde uygular.

**State enforcement**: `set.status != draft` durumunda mutation endpoint'leri
409 (UI zaten butonları disabled gösterir).

**TypingConfirmation enforcement**: `bulk-delete` endpoint'i Phase 6
TypingConfirmation server-side enforcement paterni reuse — istemci onay
sentinel'i (Phase 6 sözleşmesi) yokluğunda 400. Mekanizma plan'da Phase 6'dan
adapte edilir.

### 7.3 Job tipleri (BullMQ)

| Job | Amaç |
|-----|------|
| `EDIT_BACKGROUND_REMOVE` | `@imgly/...` ile bg-remove, asset persist, item update |
| `EXPORT_SELECTION_SET` | ZIP üretimi + manifest + signed URL + cleanup schedule |

### 7.4 Phase 6 köprüsü — read-only

Selection Studio yalnız okur:
```ts
prisma.selectionItem.findUnique({
  include: {
    generatedDesign: { include: { review: true } }
  }
})
```

**Mapper layer** Phase 6 schema'sını Selection Studio view-model'e çevirir
(şema değişikliği izolasyonu). Plan'da netleşir.

Yazma / tetikleme / güncelleme / silme **YOK**.

---

## 8. Riskler ve Provisional Kararlar

### 8.1 Provisional (Phase 6 smoke'a bağlı)

- **Drawer Review Queue tab**: UI'da görünür, **disabled**. Phase 6 canlı
  smoke kapandığında aktif edilecek. Implementasyon plan'da hazır
  (carry-forward `selection-studio-review-queue-source`).
- **Sağ panel "Review'a gönder" link**: Review yok durumunda disabled.
  `selection-studio-trigger-review` carry-forward.

### 8.2 Riskler

| Risk | Etki | Mitigation |
|------|------|------------|
| `@imgly/background-removal` model boyutu / cold start | Worker startup yavaş, deployment paketi büyük | Worker process'in lifecycle'ı belirgin; lazy init; plan'da netleşir |
| BG-remove OOM (büyük asset) | Job fail | Job-level memory limit, asset size pre-check, failure UI'a yansıma |
| BG-remove edge cases (saç, transparent obje) | Düşük kalite çıktı | Manuel QA fixture set, user "yeniden dene" affordance |
| Manifest schema değişimi | Phase 8 handoff kırılır | `schemaVersion: "1"` discriminator + sözleşme testi |
| Phase 6 review schema değişimi | Selection Studio AI Kalite paneli kırılır | Mapper layer view-model izolasyonu |
| Reorder a11y | Klavye kullanıcısı reorder yapamaz | İmplementasyon plan'da accessible DnD veya menu-based seçilir; user-controlled garantili |
| Async export büyük set | Worker memory + ZIP üretim süresi | Streaming archiver, worker-level memory limit |
| Cross-user erişim | Veri sızıntısı | 404 disiplini + ownership filter unit + integration test |

### 8.3 Bilinen sınırlar (honesty)

- Edit prompt komple yok (gizli; placeholder bile değil) — kullanıcı serbest
  metinle düzenleme yapamaz
- Upscale 2× UI'da görünür ama disabled — gerçek AI upscale yok
- Set rename / multiple draft set yönetimi yok — Phase 7 v1 minimal
- `ready → draft` geri dönüş yok — finalize tek yön
- Reference detay sayfasından Quick start yok — yalnız `/review` AI Tasarımları
- Aynı batch'ten ikinci kez Quick start uyarısı yok — her tıklama yeni set
- Mockup Studio handoff stub — `ready` set'leri Phase 8 input olur, gerçek
  handoff Phase 8'de implement edilir
- Item-level export tracking yok — set düzeyinde `lastExportedAt` yeterli

---

## 9. Carry-forward Listesi

| Carry-forward | Kapsam |
|---------------|--------|
| `selection-studio-ai-edit` | AI destekli "Edit prompt / Edit uygula" — yeni image-edit provider abstraction |
| `selection-studio-review-queue-source` | Drawer'da Review Queue tab aktivasyonu |
| `selection-studio-direct-upload-source` | Drawer'a Bookmark / direct upload kaynağı |
| `selection-set-management-expanded` | Set rename, archived UX, multiple draft, search/filter |
| `selection-set-unfinalize` | `ready → draft` geri dönüş |
| `selection-studio-export-center` | Tam Export Center (CSV/JSON listing, mockup pack) |
| `selection-to-mockup-handoff` | Phase 8 Mockup Studio handoff implementasyonu |
| `selection-studio-trigger-review` | "Review'a gönder" link aktivasyonu |
| `selection-studio-edit-providers` | External edit provider abstraction (bg-remove cloud, upscale cloud) |
| `selection-studio-upscale` | Upscale 2× implementasyonu (provider + UI aktif) |
| `selection-studio-export-fast-path` | Küçük set için sync export optimizasyonu (E3 hibrit) |
| `selection-studio-nondestructive-edit-chain` | Full operation graph + replay + cache |
| `selection-import-reference-history` | Reference geçmişinin tamamını sete toplama |
| `selection-quick-start-from-reference-detail` | Reference detay sayfasından Quick start |
| `selection-quick-start-duplicate-warning` | Aynı batch'ten ikinci set uyarısı |
| `asset-orphan-cleanup` | Orphan asset cleanup (genel scope) |

---

## 10. Test Stratejisi

### 10.1 Disiplin

**Phase 6 birebir** — TDD + 2-stage review (spec compliance + code quality)
her task için. Her implementation step'te:
- Failing test
- Minimal implementation
- Run + pass
- Commit

Subagent-driven development pattern'i (Phase 6'daki gibi).

### 10.2 Katman matrisi

| Katman | Disiplin | Yüzey |
|--------|----------|-------|
| Service unit | Yüksek | SelectionSet/Item, edit ops, export, mapper layer, authorization helpers |
| API integration | Yüksek | Endpoint behavior, status code, ownership 404, state machine enforcement |
| Worker | Orta-yüksek | `EDIT_BACKGROUND_REMOVE` (mock'lu), `EXPORT_SELECTION_SET` (gerçek archiver) |
| Component | Orta | Filmstrip, sağ panel, drawer, bulk bar, reorder, finalize modal |
| Authorization | Yüksek | Cross-user 404, ready set read-only enforcement |
| State machine | Yüksek | Tüm SelectionSet ve SelectionItem geçişleri, invariantlar |
| E2E (golden path) | Orta | Quick start → edit → finalize → export, drawer ekleme, bulk delete |

### 10.3 Manifest schema sözleşme testi

ZIP export "dosya oluştu" testiyle geçmez. **`manifest.json` shape sözleşme
testi** ayrı bir doğrulama katmanı:
- `schemaVersion: "1"` discriminator
- Item yapısı (zorunlu/opsiyonel alanlar)
- `review` alanı opsiyonel doğru şekilde
- `originalFilename` yalnız edit yapılmış item'da
- Phase 8 Mockup Studio handoff bu testin üstüne biner

### 10.4 Manuel QA checklist

- Reorder erişilebilirlik (keyboard tab/arrow ile reorder)
- Background remove görsel kalitesi (saç, transparent obje, low-contrast)
- Export ZIP gerçek extract testi (klasör yapısı, manifest validate, README
  okunabilir)
- Notification + inline feedback senkronizasyonu (heavy edit, export)
- Cross-browser smoke (Chrome + Safari minimum)

### 10.5 Fixture stratejisi

`tests/fixtures/selection/`:
- `portrait-2x3.png` (crop fixture, yüksek çözünürlük)
- `with-background.png` (bg-remove input)
- `no-background.png` (bg-remove expected output, mock test)
- `multi-format/*` (jpg, png, webp coverage)
- `selection/seed/` (DB seed: SelectionSet + Items + Phase 6 review fixtures)

### 10.6 Mock stratejisi

| Bağımlılık | Test'te |
|------------|---------|
| `@imgly/background-removal` | Mock — fixture in/out swap (model accuracy bizim sorumluluğumuz değil) |
| BullMQ | In-memory test instance veya mock |
| MinIO/S3 | Phase 6 paterniyle local FS adapter |
| Phase 6 review | DB seed (gerçek `DesignReview` row) |
| Notification | Phase 6 mock |

### 10.7 Out-of-scope (test)

- `@imgly/...` model accuracy testing
- Performans/load testing (100+ item reorder, 1000+ batch drawer)
- Cross-browser visual regression (manuel QA)
- A11y audit otomasyon (manuel QA + axe spot-check)

---

## 11. Plan'a Geçiş

Bu spec onaylandıktan sonra:
1. Spec self-review (placeholder scan, internal consistency, scope check,
   ambiguity check)
2. User reviewi
3. `superpowers:writing-plans` skill ile implementation plan üretimi:
   `docs/plans/2026-04-30-phase7-selection-studio-plan.md`
4. Subagent-driven execution (Phase 6 disiplini)

**Önkoşul hatırlatması**: Phase 6 Aşama 2A canlı smoke kapanmadığı sürece
"Review Queue" entegrasyonu disabled kalır. Selection Studio çekirdeği
(`SelectionSet`, edit semantiği, export, finalize) Phase 6'dan bağımsız
implement edilebilir; sadece review-tetikleme ilişkili noktalar Phase 6
smoke'una gated kalır.
