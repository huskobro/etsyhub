# Kivasy — Claude Design Context

> **Bu dosyanın amacı:** Claude Design (veya başka herhangi bir tasarım
> ajanı / işbirlikçisi) bu repo'yu okuduğunda **doğru bağlamı**, **doğru
> markayı** ve **doğru kapsamı** alsın. Bu dosya, ürünün **şu anki
> doğruluk kaynağıdır**. Repo'nun başka herhangi bir yerindeki eski / tarihsel
> anlatım bu dosyayla çelişirse — bu dosya kazanır.

> **Tarihsel notlar (uyumluluk):** Repo slug'ı `EtsyHub`. Eski
> `docs/plans/*` ve `docs/design/EtsyHub/*` altında **eski marka adı** ve
> **kapsam dışı** akışlar (Amazon scraping, t-shirt mockup'ı, vb.) geçer —
> bunlar **history**'dir, referans alınmaz.

---

## 1. Ürün özeti

**Kivasy**, Etsy satıcıları için bir **dijital ürün üretim sistemidir**.
Operatör (= ürünün asıl kullanıcısı) referans toplar, AI ile tasarım
varyasyonları üretir, kalite kontrolünden geçirir, kürasyon yapar, mockup
uygular, listing metadata'sı hazırlar ve Etsy'ye **draft** olarak gönderir.

Kivasy localhost-first çalışır; ileride Tauri ile macOS / Windows native
app'e taşınabilecek şekilde tasarlanır.

Operatör iki uçta da çalışır:

- **Küçük iş:** 1 batch, birkaç referans, ~4-10 varyasyon, bir selection
  set, birkaç mockup, tek Etsy draft. ~15 dakikada biter.
- **Büyük operasyon:** 10+ batch, 200+ asset, bulk review, bulk selection,
  multi-mockup uygulama, çoklu draft. Saatler boyu sürer.

Aynı arayüz iki uca da hizmet eder.

---

## 2. Marka kullanımı

- Public-facing ürün adı: **Kivasy**
- Repo slug: `EtsyHub` (uyumluluk için kalır; marka değildir)
- "for Etsy sellers", "Etsy draft listings", "Etsy-connected workflow"
  gibi nötr ifadeler kullanılabilir
- "Etsy" tek başına marka olarak kullanılmaz; "EtsyHub" yeni dokümana
  eklenmez
- Matesy / Listybox gibi mevcut araçların marka adı / görsel kimliği
  Kivasy ürününde kullanılmaz; bunlar yalnızca **referans** olarak
  incelenir

---

## 3. Scope — in-scope

Kivasy yalnızca **dijital indirilebilir ürünleri** üretir. Çıktılar Etsy'de
"Digital Download" listing tipindedir.

**Desteklenen ürün tipleri:**

- Clipart bundle
- Wall art (canvas / poster / framed — dijital dosya olarak)
- Bookmark (kitap ayracı, dijital indirilebilir)
- Sticker / printable (sticker sheet, transparent PNG setleri)
- Genel digital download paketleri

**Dijital teslim formatları (alıcının indirdiği):**

- ZIP (bundle paketleme)
- PNG (transparent veya raster)
- PDF (printable, sheet)
- JPG / JPEG (raster çıktı)

Listing Builder'da bu format'lar bir checklist olarak görünür ("File types:
☑ PNG ☑ ZIP ☐ PDF ..."), her dosya için resolution / dimensions girilebilir,
"Instant download" işaretlenir.

---

## 4. Scope — out-of-scope (kesin yasaklar)

Kivasy **fiziksel POD aracı değildir**. Aşağıdakiler tasarımın hiçbir
ekranında / form alanında / iş akışında **görünmez**:

- Fiziksel print-on-demand (POD)
- Print partner / üretim partneri akışları
- Fulfillment / shipping / kargo / weight / dimensions (fiziksel)
- Made-to-order
- Garment POD (t-shirt, hoodie, mug, DTF, sweatshirt, tank top)
- Fiziksel envanter, stok takibi, lojistik

Bir ekran, copy, mockup template örneği, listing alanı veya prompt
yukarıdakilere imada bulunuyorsa **scope sapmasıdır**. Tasarım durur,
scope düzeltilir, sonra devam eder.

Mockup'lar **dijital listing sunumu** içindir — fiziksel üretim için
değildir.

---

## 5. Final Information Architecture

Top-level navigasyon **8 öğe / 2 grup**'tur. Bu liste **kapalı**dır; yeni
top-level eklenmez, mevcut olanlar başkalaşmaz.

```
PRODUCE
  Overview     ne yapmalıyım? (panel + bekleyen aksiyonlar + aktif batch)
  References   üretim öncesi havuz (Pool / Stories / Inbox / Shops / Collections)
  Batches      üretim akışı (variation + retry + review hepsi burada)
  Library      üretilenlerin tek doğruluk kaynağı (filter, lineage, history)
  Selections   kürate edilmiş set'ler (mockup'a giden hat)
  Products     mockup + bundle preview + listing draft + Etsy-bound

SYSTEM
  Templates    Prompt / Style / Mockup / Recipe (4 sub-tip filter)
  Settings     Preferences / Providers / Mockup Templates / Theme / Users / Audit / Flags
```

**Admin scope ayrı bir sidebar değildir.** Footer'da küçük bir rozet ile
işaretlenir; admin-only section'lar `Settings` ve `Templates` içinde
role-gated olarak görünür.

### Top-level olmayanlar (alt-akışlara yerleşir)

- Batch Run → Batches index'inde "+ New Batch" primary CTA → split-modal
  stepper
- Review Studio → Batches/[id] içinde **Review** tab
- Job Detail → Batches/[id]/Logs tab + persistent **Active Tasks**
  floating panel (her sayfada)
- Kept Workspace → Selections içinde **All Kept** filter view
- Mockup Apply → Selections/[id]/Mockups tab'ından açılan split-modal
- Listing Builder → Products/[id]/Listing tab
- Color Editor / Crop / Upscale → Selections/[id]/Edits tab'ından açılan
  split-modal'lar
- Trend Stories / Bookmarks / Competitors / Collections → References
  altında sub-view'lar (UI biçimi tasarım kararı: tab / sol subnav /
  segment / saved view)

---

## 6. References sub-view'ları (consolidated)

`References`, ürünün **giriş kapısı** ve **pre-production discovery**'nin
konsolide ev'idir. Aşağıdaki 5 sub-view tek top-level içinde yaşar:

| Sub-view | İçerik |
|---|---|
| **Pool** | Üretime girmeye hazır kürasyonlanmış referans havuzu (default view) |
| **Stories** | Rakip mağazaların yeni listing'lerinden story-feed (Instagram-story benzeri akış) |
| **Inbox** | Bookmark inbox — operatörün hızlıca yakaladığı, henüz kürate edilmemiş fragmentler |
| **Shops** | Etsy shop analizleri — operatör shop URL girer, review-based ranking gelir |
| **Collections** | Operatör-organize gruplamalar (örn. "Christmas Wall Art", "Boho Clipart") |

**UI biçimi tasarım kararıdır.** Tasarım: tab bar, sol subnav, segmented
control, saved views, veya başka bir tighter pattern seçebilir. Önemli
olan: bu 5 sub-view'ın **References altında tek top-level surface** olarak
kalması, ayrı sidebar item'ı haline gelmemesi.

---

## 7. Library / Selections / Products — sınır invariant'ları

Bu üç ekranı **karıştırmak yasaktır**. Kod, copy, UI seviyesinde sınırlar:

| Ekran | Tek-cümle tanım | İçerir | İçermez |
|---|---|---|---|
| **Library** | Üretilmiş tüm asset'lerin tek doğruluk kaynağı | Variation çıktıları + user upload'ları + üretilmiş tüm görseller; filter-driven (kept/rejected/all/by ref/by batch); lineage graph buradan açılır | Set / kürasyon yönetimi yok; sadece "Add to Selection" aksiyonu vardır |
| **Selections** | Kürate edilmiş set'ler — mockup'a giden hat | Operatör-isimlendirilmiş, sıralanmış, edit'lenmiş gruplar; edit operasyonları (background remove, color edit, crop, upscale, magic eraser) | Mockup ve listing burada **üretilmez**; sadece "Apply Mockups" CTA'sı oradan açılır |
| **Products** | Mockup'lanmış + bundle-preview-hazırlanmış + listing-draft'lanmış + Etsy'ye giden paket | Lifestyle mockup'lar, bundle preview sheet'leri, listing metadata (title/desc/13 tags), digital files (PNG/ZIP/PDF/JPG/JPEG), Etsy draft history | Variation üretimi burada **olmaz**; selection set kaynaktır, Product paket olarak yaşar |

### State akışı (tek yönlü)

```
Reference  ─[create variations]─▶  Batch
           └─[items succeed]─────▶  Library asset
Library asset  ─[add to selection]─▶  Selection set
Selection set  ─[apply mockups]──────▶  Product
Product  ─[generate listing + send]──▶  Etsy draft
```

Her ok bir **action**'dır (single primary CTA), sayfa değildir. Çoğu action
bir **split modal** açar; operatör sayfa değiştirmez.

### Sınır ihlali örnekleri (kaçınılır)

- "Selection" ekranı çizilip içine Library'nin filter-driven grid'i konursa
- Products'a "Generate variations" CTA eklenirse
- Library'de "Create new selection set" formu açılırsa
- Etsy draft history Selections'ta tutulursa

Tasarımcı bu sınırlardan birini bulanıklaştıran bir layout / akış
düşünüyorsa, durup gerekçesini bu doc'un §7'sine referansla yazar.

---

## 8. Mockup ve Preview modeli (3 tip)

Mockup tek tip değildir. Apply Mockups split-modal'ı 3 sınıfı **sibling
tab** olarak gösterir:

### Tip 1 — Lifestyle mockups
Bağlamsal sunum. Etsy listing'in birinci fotoğrafı.
- Wall art duvarda (oturma odası, çocuk odası, çerçeveli/çerçevesiz)
- Clipart masada / planner / scrapbook
- Bookmark kitabın içinde, masa üstünde
- Sticker laptop / su şişesi / notebook

### Tip 2 — Bundle preview sheets
"Ne aldığım" görseli. Dijital ürünün doğası bunu zorunlu kılar.
- Clipart bundle: 25 PNG'nin bir arada gösterildiği grid sheet ("All 25
  designs included")
- Wall art set: multi-piece composite preview ("3 Print Set")
- Sticker sheet: layout preview (pre-cut çizgileri ile)
- Bookmark set: "5 Bookmark Set" composite

### Tip 3 — User-uploaded custom templates
Operatör kendi PSD / smart object template'ini yükler. `Templates`
top-level'ında `Mockup Templates` sub-tipinde **persiste edilir**, Products
genelinde **yeniden kullanılır**. Bir Apply Mockups akışında "afterthought"
gibi davranılmaz; Lifestyle ve Preview Sheet'le **eşit** bir tab'dır.

Bir Product, üç tipi de birlikte içerir; operatör hangisinin listing'in
**birincil fotoğrafı** olacağını seçer.

---

## 9. Mobile, Native, High-volume gereksinimleri

### 9.1 Mobile (web responsive, bugün)

| Yapı taşı | Desktop | Mobile |
|---|---|---|
| Sidebar | persistent 232w | bottom-tab (4 slot: Overview / References / Batches / Library) + "More" kebab |
| PageHeader | inline | sticky top, primary CTA tek button (sağ üst), kebab secondary |
| Tablo | dense rows | kart liste (her row → kart) |
| Grid | 4-6 col | 2 col |
| Modal-lg (split) | 1100w sol/sağ | full-screen sheet, sol kaynak üstte (sticky 30%), sağ aşağıda |
| Filter bar | inline chips | "Filter" buton → bottom sheet (multi-select) |
| Active Tasks panel | sağ alt floating | bottom-up swipe drawer |
| Detail tab'leri | yatay tab | yatay scroll tab + sticky |

**Mobile karar kuralı:** Küçük iş (1-4 görsel) tüm operasyonu mobile'dan
yapabilir. Büyük iş (50+ görsel) review için **mobile = browse-only**;
decision/edit için desktop'a iter ("Better on desktop" hint).

### 9.2 Native (Tauri ready, gelecek)

Tasarım kararları **Tauri'ye taşınabilir** olmalı. Browser-only pattern
(URL anchor zorunluluğu, hover-only akış, browser back-stack bağımlılığı)
ortaya çıkıyorsa, native-equivalent fallback düşünülmeli.

- App shell (sidebar + main + persistent floating Active Tasks panel)
  olduğu gibi taşınır
- Selection workspace ve Color editor ayrı pencere (multi-window) olabilir
- Settings macOS Preferences-style detail-list pattern'i
- Local file actions browser sandbox limit'i varsaymaz
- Multi-window: büyük operatörler için kritik; tasarım buna engel olmamalı

### 9.3 High-volume (yüzlerce asset, onlarca batch) — opsiyonel değil

- **Virtualized grid:** Library, Batch items, Selection items, Products —
  hepsi 200+ row'da virtualize (örn. `@tanstack/react-virtual`)
- **Floating action bar:** bulk-select aktifken ekran altında sticky
  ("12 selected · Keep · Reject · Add to Selection · Apply Mockups")
- **Density toggle:** Comfortable / Compact / Dense — list / grid / table
  ekranlarında zorunlu, persist
- **Filter chip preset'ler:** sık kullanılan filter kombinasyonları
  saklanır ("Last 7 days kept · clipart · ratio square")
- **Keyboard-first:** Cmd+K palette, j/k row nav, k=keep, r=reject,
  e=edit, ? help — review/selection ekranlarında kritik
- **Fan-in / fan-out:** Reference × N → Variations × M; Library × M →
  Selections × K; Selection × 1 → Mockup template × T → Products × T —
  her aşamada multi-select + bulk apply

---

## 10. Workflow zinciri — somut

```
1. References          rakip stories / shop analizi / inbox / pool'dan ilham bul
   │  [aksiyon] Bookmark
   │  [aksiyon] Add to References Pool
   │  [aksiyon] + Add Reference  → split modal: Image URL / Upload
   ▼
2. Batches             AI variation generation çalışıyor
   │  Real-time progress, retry-failed-only
   │  Tab: Overview · Items · Review · Logs · History
   │  [aksiyon] Keep / Reject / Regenerate (Review tab, keyboard-first)
   ▼
3. Library             tüm üretilmiş asset'ler (filter: kept, by ref, by batch)
   │  [aksiyon] Add to Selection
   ▼
4. Selections          kürate edilmiş set'ler (kept'in alt-kümesi + manuel sıralama)
   │  Tab: Designs · Edits · Mockups · History
   │  [aksiyon] Edit (background remove, color edit, crop, upscale, magic eraser)
   │  [aksiyon] Apply Mockups → split modal (Lifestyle / Preview Sheet / My Templates)
   ▼
5. Products            mockup'lanmış + listing draft'lı paket
   │  Tab: Mockups · Listing · Files · History
   │  Listing tab: title, description, 13 tags, materials, digital files
   │             checklist (PNG/ZIP/PDF/JPG/JPEG), instant download
   │  [aksiyon] Send to Etsy as Draft
   ▼
6. Etsy Draft          draft tarafta, manuel approval (direct publish yok)
```

Her aşamada **tek primary CTA** ve **alt-akışlar split modal** olarak
açılır. Operatör sayfa değiştirme sayısını minimumda tutar.

---

## 11. Görsel / tasarım yön özeti

> Detaylı palette / typography / token önerisi tasarım çıktısında olur;
> bu doc sadece yön sabitlerini taşır.

- **Yön:** premium, sakin, modern, operatör-dostu — Dribbble shot değil,
  günde 8 saat açık duracak bir kokpit
- **Aksent:** tek warm orange / coral, restraint ile (primary CTA, active
  nav, küçük accent moment'leri); brown / muddy terracotta / pink-heavy
  red / yellow-heavy amber'a kaymaz
- **Yüzey:** parlak, sakin, hafif warm-leaning beyaz; gradient / glow /
  hero illustration yok
- **CTA dili:** sayfa başına 1 primary, modal başına 1 primary; secondary
  ghost / borderless / kebab
- **Stage-aware CTA renk dili (öneri):** orange = create upstream;
  purple = edit midstream; blue = publish downstream — operatör buton
  rengiyle aşamayı okur
- **Card enflasyonu yok:** tablo tablo, grid grid kalır; card sadece atomic
  unit (1 product, 1 batch, 1 setting unit) için
- **Split modal > multi-page wizard:** uzun alt-akışlar split modal olur,
  yeni sayfa açmaz
- **Persistent Active Tasks panel:** uzun süren job'lar her sayfada
  görünür; dashboard widget'ında gömülü değil
- **Density first-class:** her list/grid/table için Comfortable /
  Compact / Dense toggle, persist
- **Token-driven:** color, spacing, radius, typography hepsi CSS variable;
  hardcoded yasak (repo zaten bunu enforce ediyor — `npm run check:tokens`)

---

## 12. Bu doc ile çelişen yerler

Aşağıdaki dosyalar **history**'dir, bu doc'la çelişebilir, **referans
alınmaz**:

- `docs/plans/*` — phase planları, eski IA, eski scope (Amazon parser,
  vb.)
- `docs/design/EtsyHub/*` — eski marka adıyla yapılmış tasarım çalışmaları;
  visual diller eski olabilir
- `docs/design/EtsyHub_mockups/*` — aynı şekilde history
- `docs/design/EtsyHub/uploads/CLAUDE.md` — eski snapshot, bu doc'la
  çelişen scope satırları içerir

Aşağıdakiler **canlı doğruluk kaynağı**dır:

- `README.md` (root) — ürün özeti, Kivasy marka, scope, workflow, hızlı
  başlangıç
- `CLAUDE.md` (root) — proje kuralları, scope invariant'ları, IA kararı,
  Library/Selections/Products sınırları, mockup modeli, mobile/native/
  high-volume gereksinimleri
- `docs/CLAUDE_DESIGN_CONTEXT.md` (bu dosya) — Claude Design ve diğer
  tasarım ajanları için tek-parça bağlam

Çelişki olursa: **bu doc kazanır.**
