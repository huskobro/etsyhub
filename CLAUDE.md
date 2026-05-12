# Kivasy — Ürün ve Proje Kuralları

> **Status:** Implementation **R1 → R11.5 complete** (2026-05-09). MVP
> omurgası canlı; production build PASSING; %99.4 test pass. IA-39+
> review automation final close 2026-05-11: BullMQ workers + chokidar
> watcher artık Next.js instrumentation hook ile uygulama başlangıcında
> otomatik başlar — ayrı `npm run worker` komutu gerekmez. Tek komut:
> `npm run dev` veya `npm run start`. MVP Final Acceptance gate operatör
> onayını bekliyor.
>
> **Review modülü 2026-05-11 itibarıyla KAPANMIŞTIR.** Bkz. Madde Z.
>
> Source of truth ağacı:
> - **MVP acceptance + readiness** → [`docs/MVP_ACCEPTANCE.md`](docs/MVP_ACCEPTANCE.md)
> - **Production shakedown (release günü)** →
>   [`docs/PRODUCTION_SHAKEDOWN.md`](docs/PRODUCTION_SHAKEDOWN.md)
> - **Implementation handoff (rollout sırası, invariant'lar)** →
>   [`docs/IMPLEMENTATION_HANDOFF.md`](docs/IMPLEMENTATION_HANDOFF.md)
> - **Design system** → [`docs/design-system/kivasy/`](docs/design-system/kivasy/)
> - **Parity checkpoint (her rollout sonu uygulanır)** →
>   [`docs/DESIGN_PARITY_CHECKPOINT.md`](docs/DESIGN_PARITY_CHECKPOINT.md)

> **Marka adı:** `Kivasy`. Public-facing ürün adı budur. Repo slug, mevcut git
> geçmişi nedeniyle şimdilik `EtsyHub` olarak kalır; bu bir uyumluluk
> kararıdır, marka değildir. Yeni dokümanlar, UI metinleri, Claude Design
> handoff ve tüm kullanıcıya dönük anlatım `Kivasy` adını kullanır.
>
> Marka dili **Etsy'yi sahiplenmez**: "for Etsy sellers", "Etsy draft
> listings", "Etsy-connected workflow" gibi nötr ifadeler kullanılabilir;
> ancak `Etsy` adının ürün markası gibi kullanılmasından kaçınılır.

## Dil Kuralı

Claude Code ↔ kullanıcı iletişimi Türkçe yapılır (açıklamalar, planlar,
durum güncellemeleri, final yanıtlar). Kod, dosya adları, teknik terimler,
API alanları ve değişken isimleri İngilizce kalır.

Ancak **ürün UI'ı İngilizce standardize**dir: kullanıcıya görünen tüm
metinler (button label, badge, lifecycle caption, criterion label,
admin pane heading, error toast, empty state, completion card, vb.)
tek dilden — İngilizceden — beslenir. UI içinde TR/EN karışık
metin **kabul edilmez**: aynı sayfada İngilizce başlık altında
Türkçe açıklama, ya da İngilizce action button yanında Türkçe
caption gibi durumlar regresyondur.

Localization mimarisi: İngilizce metinler kod-level sabit veya
kaynak adı altında string key olarak kalır; ileride i18n katmanı
(`@/lib/i18n` ya da next-intl benzeri) eklendiğinde key bazında
ek diller eklenir. Bu turun standartı sadece İngilizce'dir;
TR'ye geri dönüş veya başka dil eklenmesi i18n katmanı
açılmadan yapılmaz.

## Model Esnekliği — Verification Esnekliği DEĞİL

Bu proje üzerinde kod yazımı **tek bir modele bağlı değildir**.
Genelde Claude Opus 4.7 ile çalışılır; gerektiğinde Sonnet,
Haiku veya başka bir model (Anthropic veya başka sağlayıcı)
kullanılabilir. Hız, maliyet, görev tipi (refactor / küçük fix /
docs / debug) modele göre değişebilir; bu bir tercih meselesidir.

**Verification standardı esnek değildir.** Hangi model kullanılırsa
kullanılsın, bir turun "done" sayılabilmesi için aşağıdakiler
zorunludur (uygun olduğu ölçüde):

1. **Typecheck** — `npx tsc --noEmit` (TypeScript projelerde).
2. **İlgili targeted testler** — değişikliklerin dokunduğu modülün
   test suite'leri. Yeni davranış eklendiyse yeni test ile gelir.
3. **Build** — `npm run build` (Next.js / Vite tarafı temizse).
4. **Browser verification** — UI değişikliği veya runtime davranış
   varsa preview server üzerinden gerçek akış. Snapshot, network,
   console kontrol edilir; "iddia" yerine "kanıt" yazılır.
5. **Ürün sözleşmesi kontrolü** — CLAUDE.md (Madde V vb.) ve modül
   bazlı `docs/<modül>/` paketleri ile çelişen davranış üretilmiş
   mi? Eğer üretilmişse ya kod düzeltilir ya da sözleşme açıkça
   güncellenir; ikisi sessizce ayrışmaz.

Hızlı / kabukta görünmez bir refactor için bile bu beşinin
**uygulanmadığı** kombinasyonlar finalize edilmez. Modeli
değiştirmek bu gerekliliklerin atlanması için bahane değildir.
Bir tur "kapatma" diyorsa, bu beş madde checklist olarak
geçirilmiş olmalı.

> Bu ilke review modülünün IA-36 done checklist'inde de
> uygulanmıştır (bkz. `docs/review/README.md`).

## Self-Managed Desktop Product — Arka Plan Otomasyon İlkesi

Kivasy masaüstü ürün hedefliyor: kullanıcı terminal komutu çalıştırmak,
cache temizlemek, worker başlatmak veya teknik süreç yönetimi yapmak
zorunda kalmayacak.

Bu ilkenin somut uygulamaları:

- **Background automation app tarafından yönetilir.** BullMQ workers ve
  chokidar watcher `instrumentation.ts` hook'u ile uygulama başlangıcında
  otomatik başlar. Tek komut: `npm run dev` (geliştirme) veya
  `npm run start` (production).
- **Ayrı `npm run worker` gerekmez.** Bu komut geriye dönük uyumluluk için
  script olarak kalabilir, ama temel kullanıcı akışı için zorunlu değildir.
- **CSS / runtime instability kullanıcıya yıkılmaz.** Cache bozulması,
  HMR kaynaklı görsel çökme gibi durumlar için `dev:fresh` script'i
  (`rm -rf .next && next dev`) mevcuttur; kullanıcı teknik adım atmaz.
- **Health / liveness kullanıcı dostu dille gösterilir.** "Worker process
  not running — npm run worker" gibi teknik remediation yerine "Background
  automation warming up" gibi ürün dili kullanılır.
- **Operational burden kullanıcıya itilmez.** Admin ops görünürlüğü
  olabilir, ama bu görünürlük "teknik işi sen çöz" değil "sistem şu an
  sağlıklı / bekleniyor" anlamı taşır.
- **Self-healing beklentisi:** Otomasyon çökerse veya yavaş başlarsa sistem
  bunu detect eder ve ürün düzeyinde bilgi verir. Kullanıcı log veya
  terminal okumak zorunda kalmaz.

Yeni feature eklerken kontrol: bu özellik kullanıcıdan teknik bir adım
mı bekliyor? Eğer evet ise ya otomatikleştirilir ya da self-healing
mekanizması eklenir; "known limitation" diye bırakılmaz.

## Cross-surface Metric Consistency

Kullanıcıya gösterilen özet metrikler — count, risk sayısı, score,
state badge'leri, "pending" sayıları, lifecycle göstergeleri —
**farklı yüzeylerde birbiriyle çelişmemeli**. Aynı kavram iki
yerde gösteriliyorsa:

1. **Tek kaynaktan türetilmeli** — örn. risk sayımı hem kart
   üzerinde hem detail panelde gösteriliyorsa, ikisi de aynı
   helper'dan (`buildEvaluation` → `applicable.filter(state ===
   "failed")`) beslenmeli. DB'deki ham `reviewRiskFlags` array
   length ile UI'da görünen check sayısı farklılaşamaz.
2. **Veya açıkça farklı kavramlar olarak etiketlenmeli** —
   örn. "Workspace pending" (workspace anchor) ile "This scope
   undecided" (current scope breakdown) farklı sayılar olabilir,
   ama her ikisinin de **net etiketi** olmalı; tek-kelime label
   (sadece "REVIEW PENDING") operatörü yanıltır.

Çelişkinin sık kök nedenleri:

- **Context-aware filtre eksikliği**: Ham DB array length UI'da
  doğrudan kullanılıyor; halbuki detail panel applicability
  rules sonrası filtrelenmiş sayım gösteriyor.
- **Duplicate yazımlar**: Provider snapshot'a aynı flag'i birden
  fazla kez yazmış olabilir; UI bunu unique'leştirmeden ham
  sayıyor.
- **Eski semantic vs yeni semantic**: Schema'da eski rol taşıyan
  alan UI tarafında yeniyi yansıtmaya başlayınca, başka yüzeyler
  eskiyi okumaya devam ediyor.

Yeni feature eklerken kontrol: bu metric başka bir yüzeyde de
gösteriliyor mu? Eğer evet, ikisi de aynı helper'dan beslenmeli.
Drift olursa bug açıkça operatörün gözüne çarpar (bir sayı diğeri
ile uyuşmaz) ve güveni sarsar.

> Bu ilke review modülünün IA-37 turunda uygulandı: kart üzerindeki
> risk indicator artık `buildEvaluation` çıktısından beslenir —
> detail panel ile aynı sayıyı verir.

## No Hidden Behavior — Admin Visibility

Davranışı **anlamlı şekilde etkileyen** her şey admin tarafından
**görülebilir ve düzenlenebilir** olmalıdır. Kullanıcının ürün
deneyimini etkileyen ama yalnız kod içinde saklı kalan davranış
kabul edilmez.

Bu kuralın somut uygulamaları:

- **Scoring**: Formül, kriterler, severity, weight, applicability
  rules, threshold'lar — hepsi `Settings → Review` altında
  görünür ve admin tarafından düzenlenebilir. "Bir kriter
  blocker olduğunda score 0 zorlanır" gibi gizli hardcoded
  kararlar yasaktır. Bir kriterin score'u 0'a çekmesi
  isteniyorsa admin'de `weight = 100` set edilir; davranış
  şeffaf kalır.
- **Severity**: UI tone + AI suggestion önem sinyali için
  kullanılır (`blocker` → `Critical risk` badge, `warning` →
  amber). Severity tek başına gizli score kuralı üretmez.
- **Prompts**: Master prompt + criteria block'lar admin
  paneline gelir; prompt'a gömülü ama panelde görünmeyen
  davranış yasaktır (CLAUDE.md Madde O).
- **Policy & defaults**: Builtin defaults (örn. 60/90) bir
  fallback referansıdır; admin override ettiği anda explicit
  konfigürasyon olur. "Sessiz default" yasaktır (Phase 6
  Karar 3).
- **AI suggestion outcome**: Provider raw, score, threshold,
  blocker flag — outcome'ı belirleyen alanların hepsi admin
  paneline yansır ve operator-truth'tan ayrı **advisory**
  katmanında yaşar.

Yeni davranış eklerken kontrol: bu davranışı admin görebilir mi /
değiştirebilir mi? Eğer "hayır" ise ya admin yüzeyi eklenir ya
da davranış kaldırılır. Hiçbir ciddi davranış kabuk altında kalmaz.

> IA-38 review final close turunda uygulandı: `blockerForce = 100`
> hidden auto-zero davranışı kaldırıldı; score yalnız
> weight-based formülle çalışır (admin panel'inde görünür).

## Kaynaklar

Bu proje planı aşağıdaki kaynaklar incelenerek oluşturuldu.

Video kaynakları:

- Matesy eski otomasyon videosu: <https://www.youtube.com/watch?v=_6Wex9-vbzM>
- Etsy otomasyon / mağaza analizi videosu: <https://www.youtube.com/watch?v=vu9q99QUQSw>
- Matesy V2 / güncel ürün anlatımı: <https://www.youtube.com/watch?v=PBV94Pl_kpQ>
- POD üç temel unsur short: <https://www.youtube.com/shorts/eVhcDXWUeJw>

Site kaynakları:

- Matesy: <https://matesy.co/>
- Listybox TR: <https://listybox.com/tr/>
- Etsy Open API: <https://developer.etsy.com/documentation/>
- Dynamic Mockups API: <https://docs.dynamicmockups.com/api-reference/render-api>

Yerel video ve altyazı dosyaları:

- `/Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub/videolar/ETSY Yapay Zeka Otomasyonu ile Tek Tıkla Binlerce Ürün Oluştur.mp4`
- `/Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub/videolar/ETSY Yapay Zeka Otomasyonu ile Tek Tıkla Binlerce Ürün Oluştur.srt`
- `/Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub/videolar/1 Dakikada Ürün Hazırlayan ETSY Yapay Zeka Otomasyonu.mp4`
- `/Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub/videolar/1 Dakikada Ürün Hazırlayan ETSY Yapay Zeka Otomasyonu.srt`
- `/Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub/videolar/youtube_new/PBV94Pl_kpQ.mp4`
- `/Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub/videolar/youtube_new/PBV94Pl_kpQ.tr-orig.srt`
- `/Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub/videolar/youtube_new/eVhcDXWUeJw.mp4`
- `/Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub/videolar/youtube_new/eVhcDXWUeJw.tr-orig.srt`

Çıkarılmış görsel referanslar:

- `/Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub/videolar/frames/video1_sheet.jpg`
- `/Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub/videolar/frames/video2_sheet.jpg`
- `/Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub/videolar/youtube_new/matesy_full.png`
- `/Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub/videolar/youtube_new/matesy_mobile.png`
- `/Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub/videolar/youtube_new/frames/matesy_app_sheet_18_43.jpg`
- `/Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub/videolar/youtube_new/frames/matesy_app_sheet_30_43.jpg`
- `/Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub/videolar/youtube_new/frames/matesy_short_sheet.jpg`

Bu görseller özellikle Matesy’nin uygulama içi arayüz akışını anlamak için kullanılacak: sol sidebar, analiz ekranı, story benzeri trend akışı, referans havuzu, tasarım varyasyon grid’i, karşılaştırma, edit, mockup ve listing ekranları.

## Ürün Tanımı

Kivasy, **Etsy satıcıları için bir dijital ürün üretim sistemidir**. İlk sürüm
localhost üzerinde çalışan bir productivity web app olarak çalışır; ileride
Tauri ile macOS / Windows native app olarak paketlenebilir.

### Scope (in-scope)

Kivasy yalnızca **dijital indirilebilir ürünleri** üretir. Çıktılar Etsy'de
"Digital Download" olarak listelenir.

Ana ürün tipleri:

- Clipart bundle
- Wall art (canvas / poster / framed — dijital dosya)
- Bookmark (kitap ayracı, dijital indirilebilir)
- Sticker / printable (sticker sheet, transparent PNG setleri)
- Genel digital download paketleri

Dijital teslim formatları:

- ZIP (bundle)
- PNG (transparent veya raster)
- PDF (printable, sheet)
- JPG / JPEG (raster çıktı)

### Out-of-scope

Bu ürün **fiziksel POD aracı değildir**. Aşağıdakiler **kapsam dışıdır** ve
herhangi bir UI metni / form alanı / iş akışı tarafından desteklenmez:

- Print partner / üretim partneri akışları
- Fulfillment / shipping / kargo
- Made-to-order
- Garment POD (t-shirt, hoodie, mug, DTF, sweatshirt, tank top)
- Fiziksel envanter, stok takibi, lojistik

Bir ekran, listing alanı, mockup template'i veya prompt yukarıdakilere
imada bulunuyorsa **scope sapması** demektir; bu durumda iş durdurulup
scope düzeltilir.

### Ana amaç

Kullanıcı Etsy için ürün fikirlerini bulsun, referans havuzuna taşısın,
AI ile özgün tasarım varyasyonları üretsin, kalite kontrolünden geçirsin,
kürasyon yapsın, mockup uygulasın, listing metadata'sını hazırlasın ve
Etsy'ye **draft** olarak göndersin. Direct active publish yapılmaz; insan
onayı zorunludur.

Kullanıcı ayrıca **kendi tasarımlarını da** sisteme yükleyip aynı pipeline'a
sokabilir (Library → Selection → Product → Etsy).

### Ana iş akışı (final omurga)

```
Reference  →  Batch  →  Library  →  Selection  →  Product  →  Etsy Draft
```

Her ok bir **action** (single primary CTA); sayfa zinciri değil. Uzun
alt-akışlar split modal olarak açılır (Create Variations, Apply Mockups,
Crop, Aspect Ratio, Color Edit, Add Reference). Operatör sayfa
değiştirme sayısını minimumda tutar.

## Ana Kararlar

- Landing page yapılmayacak.
- İlk ekran dashboard (Overview) olacak.
- Localhost-first Next.js app yapılacak.
- Native app şimdilik yapılmayacak; mimari ileride Tauri wrapper'a uygun
  olacak.
- Etsy'ye direct active publish yapılmayacak; draft / human approval
  kullanılacak.
- Arayüz sade, akış bazlı ve operatör-dostu olacak. Matesy ve benzeri
  mevcut araçlar **referans olarak incelenir**, ama birebir kopyalanmaz;
  Kivasy daha sade, daha net ve daha operatör odaklı olur.
- Marka adı **Kivasy**'dir. Etsy'yi sahiplenen veya başka bir markayı
  taklit eden marka dili kullanılmaz.
- Kullanıcı prompt mühendisliği yapmak zorunda kalmayacak.
- Admin panelinde master prompt, provider, tema, product type ve sistem
  ayarları yönetilecek.
- Üretim kullanıcı panelinden yapılacak.

## Teknoloji

Önerilen stack:

- Next.js
- TypeScript
- PostgreSQL
- Prisma
- Redis
- BullMQ
- S3 veya Cloudflare R2 uyumlu asset storage
- Sharp image processing
- OpenAI / Fal.ai / Replicate / Recraft provider abstraction
- Apify / Firecrawl / scraper provider abstraction
- Dynamic Mockups veya alternatif mockup provider abstraction
- Etsy Open API
- Tailwind veya CSS variables tabanlı design token sistemi

## Roller

Sistemde yalnızca iki rol olacak:

- user
- admin

User:

- kendi verilerini görür
- kendi mağazalarını ekler
- kendi bookmark, reference, design, mockup ve listing verilerini yönetir
- üretim yapar
- kendi Etsy bağlantısını yönetir
- kendi job geçmişini görür

Admin:

- tüm kullanıcıları, mağazaları ve işleri görebilir
- master promptları ve prompt versiyonlarını yönetir
- AI, scraper, mockup ve storage provider ayarlarını yönetir
- product type, recipe, mockup template yönetir
- global theme/design token ayarlarını yönetir
- AI quality review kurallarını yönetir
- job monitor, cost usage ve audit log ekranlarını görür
- kullanıcı üretim akışını test edebilir

Super admin yapılmayacak.

## Multi-User ve Veri İzolasyonu

Sistem baştan çok kullanıcılı tasarlanacak.

Her kullanıcı sadece kendi verisini görecek. UI’da gizlemek yeterli değildir; backend authorization zorunludur.

Temel modeller:

- User
- Store
- EtsyConnection
- CompetitorStore
- Bookmark
- Reference
- GeneratedDesign
- DesignReview
- Mockup
- Listing
- Job
- Asset
- Collection
- ProductType
- Recipe
- PromptTemplate
- PromptVersion
- Theme
- AuditLog
- CostUsage
- FeatureFlag

Her ana tabloda `user_id` veya gerekiyorsa `store_id` bağlantısı olacak.

## Design System

Kesinlikle hardcoded renk, boşluk, radius, font, shadow kullanılmayacak.

Tüm görsel değerler token/theme sisteminden gelecek:

- colors
- spacing
- radius
- typography
- shadows
- borders
- density
- layout widths
- status colors

Varsayılan tema Matesy hissinde olacak:

- beyaz/light çalışma alanı
- siyah metin
- turuncu/kırmızı aksan
- sol sidebar
- kart/grid bazlı ekranlar
- küçük radius
- sade, yoğun ama okunabilir SaaS UI

Örnek tokenlar:

- `--color-bg`
- `--color-surface`
- `--color-text`
- `--color-muted`
- `--color-accent`
- `--space-1` ... `--space-12`
- `--radius-sm`
- `--radius-md`
- `--shadow-card`

İleride farklı temalar oluşturulabilecek.

## UX İlkeleri

- Arayüz karmaşık olmayacak.
- Her ekranda birincil aksiyon net olacak.
- Kullanıcı tablo karmaşası yerine kart, story, stepper ve batch action mantığıyla çalışacak.
- Matesy’deki “seç, gönder, benzerini yap, mockup oluştur, listing hazırla” akışı korunacak.
- Gelişmiş ayarlar admin panelinde veya advanced drawer içinde olacak.
- Her job için açık status badge olacak.
- Hatalar kullanıcıya anlaşılır Türkçe mesajlarla gösterilecek.
- Çok sayıda tasarım üretildiğinde AI kalite skoru ile filtreleme/sıralama yapılacak.

## Kullanıcı Paneli Ekranları

### 1. Dashboard

Gösterilecekler:

- son işler
- bekleyen reviewlar
- yeni trend sinyalleri
- hazır listingler
- hata alan joblar
- mağaza bazlı özet
- günlük üretim hedefleri
- store launch plan ilerlemesi

### 2. Trend Stories

Matesy’deki “Instagram story gibi trend takip” mantığı uygulanacak.

Özellikler:

- rakip mağazaların yeni listingleri kart/story akışıyla gösterilir
- kullanıcı kaydırarak inceler
- kartta görsel, mağaza, kaynak, tarih, ürün tipi, kısa trend notu gösterilir
- aksiyonlar: Bookmark, Referansa Ekle, Benzerini Yap, Kaynağı Aç

İleride Trend Cluster Detection:

- aynı konu farklı mağazalarda tekrar ediyorsa sistem trend cluster oluşturur

### 3. Competitor Analysis

Kullanıcı Etsy shop name veya shop URL girer.

Sistem:

- mağaza yorumlarını çeker
- hangi listingin kaç yorum aldığını hesaplar
- son 30/90/365 gün/tüm zaman filtreleri sunar
- en çok yorum alan ürünleri potansiyel en çok satan ürün olarak sıralar

Not:
Etsy’de satış sayısı net görülmediği için review count satış sinyali olarak kullanılacak. Bu kesin satış verisi gibi gösterilmeyecek.

### 4. Bookmark Inbox

Bookmark, üretim öncesi fikir/inbox katmanıdır. Kullanıcı gördüğü her fikri hemen üretmek zorunda değildir.

Kaynaklar:

- Etsy
- Pinterest
- Instagram
- herhangi bir URL
- lokal upload

Bookmark alanları:

- source_url
- source_platform
- image_url
- local_asset_id
- title
- notes
- tags
- product_type
- collection_id
- status
- risk_level
- created_at

Aksiyonlar:

- Referanslara Ekle
- Benzerini Yap
- Koleksiyona Ekle
- Riskli Olarak İşaretle
- Arşivle
- Kaynak Sayfayı Aç

İleride Chrome extension/bookmarklet eklenebilir. MVP’de URL yapıştırma ve uygulama içinden kaydetme yeterli.

### 5. Reference Board

Reference, üretime hazır seçilmiş kaynak katmanıdır.

Özellikler:

- bookmark’tan referansa taşıma
- doğrudan görsel/URL ekleme
- ürün tipi atama
- koleksiyonlama
- batch select
- benzerini yap aksiyonu

Ürün tipleri (yalnızca dijital indirilebilir):

- clipart bundle
- wall art (canvas / poster / framed — dijital dosya)
- bookmark (kitap ayracı)
- sticker / sticker sheet
- printable (genel)
- digital download paketleri

### 6. Create Variations

Referanstan yeni tasarımlar üretir.

Özellikler:

- ürün tipine göre optimize edilmiş prompt
- ürün tipine göre model seçimi
- 6-12 varyasyon üretimi
- similarity control: close / medium / loose / inspired
- referans görsel ile yeni görseli yan yana kıyaslama
- hover/detay modalında karşılaştırma
- edit prompt ile düzeltme

Edit prompt örnekleri:

- rengi değiştir
- daha minimal yap
- text’i kaldır
- arka planı sadeleştir
- canvas oranına uygun yap

### 7. AI Quality Review

Her generated design üretildikten sonra otomatik review job çalışacak.

Kontroller:

- resolution
- aspect ratio
- file size
- alpha channel
- OCR/text detection
- gibberish text detection
- bozuk obje / garip element tespiti
- watermark / signature benzeri izler
- print readiness
- crop problemi
- transparent background kalitesi
- marketplace/trademark risk flags

GeneratedDesign alanları:

- quality_score
- review_status: pending | approved | needs_review | rejected
- review_issues
- review_summary
- text_detected
- gibberish_detected
- risk_flags
- reviewed_at

UI:

- her kartta kalite badge’i
- 90+ Good
- 60-89 Review
- <60 Reject
- kullanıcı `Approve anyway` yapabilir
- düşük skorlu görseller Human Review Queue’ya düşer

### 8. Human Review Queue

AI review düşük skor verdiyse tasarım ayrı review ekranına düşer.

Aksiyonlar:

- approve
- reject
- regenerate
- fix with AI
- text’i kaldır
- typography düzelt
- background temizle
- riskli işaretle

### 9. Selection Studio

Kullanıcı beğendiği tasarımları seçer ve son düzenlemeleri yapar.

Özellikler:

- background removal
- color editor
- upscale
- crop
- aspect ratio
- transparent PNG kontrolü
- wall art için baskı ölçüsü kontrolü
- clipart için temiz kenar/alpha kontrolü

### 10. Mockup Studio

Mockup üretim ekranı. Mockup'lar **dijital listing sunumu** içindir;
fiziksel üretim için değildir.

Mockup 3 sınıfı destekler (Apply Mockups akışında sibling tab'lar):

1. **Lifestyle mockups** — bağlamsal sunum
   - wall art duvarda (oturma / çocuk odası, çerçeveli/çerçevesiz)
   - clipart masada / planner / scrapbook
   - bookmark kitabın içinde
   - sticker laptop / su şişesi / notebook
2. **Bundle preview sheets** — "ne aldığım" görseli
   - clipart bundle: 25 PNG'nin grid sheet'i ("All 25 designs included")
   - wall art set: multi-piece composite preview
   - sticker sheet: layout preview
   - bookmark set: "5 Bookmark Set" composite
3. **User-uploaded custom templates** — kullanıcının kendi PSD / smart
   object template'leri; `Templates` altındaki `Mockup Templates` alt-tipi
   olarak persiste edilir, Products genelinde yeniden kullanılır.

Özellikler:

- kullanıcı kendi template'ini yükleyebilir
- mockup template seçebilir
- bir tasarımı birden fazla mockup template'ine uygulayabilir
- grup / batch mockup uygulaması desteklenir

### 11. Listing Builder

Etsy listing hazırlama ekranı. Çıktı **digital download** listing tipindedir;
fiziksel / made-to-order alanları **kullanılmaz**.

Üretilecek alanlar:

- title
- description
- 13 tags
- category (Etsy "Digital Downloads" alt-kategorileri)
- price
- materials
- digital file types: ZIP, PNG, PDF, JPG, JPEG (checklist)
- file resolution / dimensions per file
- commercial license text (özellikle clipart için)
- "Instant download" işareti
- mockup images (lifestyle + bundle preview)
- downloadable files (alıcının indireceği dijital paket)

Üretilmeyen / kullanılmayan alanlar:

- production partner
- physical seçeneği
- shipping / kargo / weight / dimensions (fiziksel)
- made-to-order

Özellik:

- AI listing metni master promptlardan üretilecek
- kullanıcı düzenleyebilecek
- Etsy'ye **draft** olarak gönderilecek
- direct active publish yok

### 12. Publishing Queue

Listing durumları:

- draft
- scheduled
- failed
- published
- rejected
- needs_review

Aksiyonlar:

- retry
- error detail
- Etsy’de aç
- yeniden hazırla
- export et

### 13. Clipart Studio

Bu sistemin Matesy’den ayrışacağı önemli alan.

Özellikler:

- transparent PNG set
- SVG/vector opsiyonu
- ZIP bundle
- sticker sheet
- bundle cover
- preview sheet
- commercial license text
- digital download Etsy listing

Clipart kalite kontrolleri:

- transparent background
- kenar temizliği
- dosya çözünürlüğü
- set tutarlılığı
- gereksiz background artifact
- gibberish/text bozukluğu

### 14. Export Center

Etsy’ye göndermeden dosya export edilebilecek.

Export tipleri:

- PNG
- JPG
- transparent PNG
- ZIP bundle
- mockup pack
- listing CSV
- listing JSON

### 15. Settings

User settings:

- mağazalar
- Etsy bağlantısı
- kullanıcı API keyleri gerekiyorsa
- default product type
- default export ayarları

## Admin Paneli

Admin ekranları:

- Users
- Stores
- Prompt Templates
- Prompt Versions
- Product Types
- Recipes / Presets
- AI Providers
- Scraper Providers
- Mockup Providers
- Mockup Templates
- Themes
- Feature Flags
- Negative Library
- Job Monitor
- Cost Usage
- Audit Logs
- System Settings

## Master Prompt Yönetimi

Admin panelinde promptlar versiyonlu yönetilecek.

PromptTemplate alanları:

- prompt_name
- task_type
- product_type
- provider
- model
- system_prompt
- user_prompt_template
- output_schema
- status: draft | active | archived
- version
- changelog
- test_input
- test_output

Her üretim çıktısı hangi prompt versiyonu ile üretildiğini saklayacak.

Admin için Prompt Playground yapılacak:

- örnek görsel/link ver
- promptu test et
- çıktıyı gör
- beğenilirse yeni versiyonu active yap

## Recipes / Presets

Kullanıcı teknik ayarlarla uğraşmadan üretim reçetesi seçebilmeli.

Örnek recipes:

- Canvas Wall Art Starter
- Clipart Bundle 25 PNG
- Sticker Sheet
- Boho Printable Set
- Nursery Wall Art
- Minimalist Poster Set

Recipe şunları belirleyebilir:

- product_type
- aspect_ratio
- model/provider
- prompt template
- mockup template set
- listing template
- review rules
- export format

## Collections

Bookmark, reference ve generated design’lar koleksiyonlara ayrılabilecek.

Örnek:

- Christmas Wall Art
- Nursery Clipart
- Boho Canvas
- Halloween Stickers
- Abstract Posters

## Negative Library

Admin veya kullanıcı yasak kelime/stil/marka listesi tanımlayabilir.

Örnek:

- Disney
- Marvel
- NFL
- Nike
- Taylor Swift
- celebrity names
- watermark
- fake signature
- gibberish text

Bu liste:

- prompt üretiminde negative prompt olarak kullanılabilir
- AI review’da risk flag oluşturabilir
- listing metinlerini kontrol edebilir

## Duplicate / Similarity Detection

Sistem aynı veya çok benzer tasarımları tespit etmeli.

Amaç:

- kullanıcı aynı görseli tekrar tekrar üretmesin
- yakın kopyalar engellensin
- koleksiyon oluşturma kolaylaşsın
- arşiv içinde visual search yapılabilsin

İleride embedding tabanlı visual similarity search eklenebilir.

## Trend Cluster Detection

Trend Stories içinde benzer yeni listingler clusterlanmalı.

Örnek:

- 8 mağaza aynı konuya benzer tasarım eklediyse sistem “Trend yükseliyor” sinyali verebilir
- kullanıcı tek tek kart bakmak yerine trend grubu görebilir

## Listing Readiness Checklist

Her listing için otomatik hazır olma kontrolü yapılacak.

Kontroller:

- yeterli mockup var mı
- title uygun mu
- 13 tag tamam mı
- description var mı
- görseller yeterli çözünürlükte mi
- AI review geçti mi
- trademark risk var mı
- export dosyaları hazır mı
- Etsy draft için zorunlu alanlar tamam mı

## Store Profile / Brand Voice

Her mağazanın profil ayarı olacak.

Alanlar:

- store_name
- niche
- target_audience
- tone
- default_product_types
- banned_terms
- preferred_style
- description_style

Örnek tone:

- minimalist
- playful
- premium
- nursery/kids
- boho
- spiritual
- modern gallery

Listing metinleri bu profile göre üretilecek.

## Seasonal Calendar

Etsy dijital ürün satışı için önemli tarihleri gösterecek.

Örnek:

- Valentine’s Day
- Mother’s Day
- Father’s Day
- Halloween
- Thanksgiving
- Christmas
- Graduation season
- wedding season

İleride Trend Stories ve recipe önerileriyle bağlanabilir.

## Cost Guardrails

AI görsel üretiminde maliyet kontrolü şart.

Özellikler:

- kullanıcı bazlı günlük/aylık limit
- provider bazlı maliyet takibi
- job bazlı tahmini maliyet
- admin cost usage ekranı
- limit aşılırsa job başlatma engeli

## Prompt / Result Memory

Sistem hangi prompt/model kombinasyonlarının iyi çalıştığını takip etmeli.

Takip edilecekler:

- accepted rate
- rejected rate
- average quality score
- user approve rate
- product type bazlı performans
- provider/model bazlı performans

Admin panelinde prompt/model performansı görülebilmeli.

## Failure Recovery

Uzun joblar yarıda kalırsa kullanıcı yeniden başlatabilmeli.

Aksiyonlar:

- retry step
- resume from failed step
- cancel job
- clone job
- show error detail

## Local File Watch Folder

İleride localhost/native kullanım için faydalı.

Kullanıcı bir klasöre görsel attığında sistem otomatik içeri alabilir.
Bu MVP’de şart değil ama mimari buna uygun olmalı.

## Provider Abstraction

Hiçbir provider doğrudan UI componentlerinden çağrılmayacak.

Katmanlar:

- providers/ai
- providers/scraper
- providers/mockup
- providers/storage
- providers/etsy
- providers/ocr

Her provider interface üzerinden çalışacak. OpenAI yerine başka model, Apify yerine başka scraper, Dynamic Mockups yerine başka mockup provider takılabilir.

## Job Queue

Uzun işler API request içinde yapılmayacak. BullMQ/Redis kullanılacak.

Job tipleri:

- scrape_competitor
- fetch_new_listings
- create_bookmark_preview
- generate_variations
- review_design
- remove_background
- upscale_image
- create_mockup
- generate_listing_copy
- push_etsy_draft
- export_clipart_bundle
- similarity_check
- trend_cluster_update

Her job alanları:

- status
- progress
- error
- retry_count
- cost_estimate
- created_by
- user_id
- store_id
- metadata

## Kod Organizasyonu

Feature based yapı kullanılacak.

Örnek:

- src/features/bookmarks
- src/features/references
- src/features/competitors
- src/features/trend-stories
- src/features/design-generation
- src/features/design-review
- src/features/selection-studio
- src/features/mockups
- src/features/listings
- src/features/exports
- src/features/admin
- src/features/theme
- src/features/jobs
- src/features/providers

Her feature içinde:

- components
- server
- schemas
- types
- services
- queries
- mutations

Kurallar:

- god-file yok
- büyük component yok
- business logic UI içinde olmayacak
- provider call component içinde olmayacak
- API route şişmeyecek
- ortak UI componentleri ayrı olacak
- domain logic feature klasöründe olacak

## Güvenlik

- API keyler plain text tutulmayacak
- provider credentials admin scope’ta korunacak
- user kendi keyini giriyorsa encrypt edilmeli
- tüm mutationlarda authorization kontrolü olacak
- audit log tutulacak
- admin işlemleri loglanacak
- Etsy tokenları güvenli saklanacak

## Test ve Kalite

Minimum test alanları:

- authorization
- user data isolation
- bookmark to reference flow
- generated design review flow
- listing readiness
- provider abstraction mock tests
- job retry/failure flow
- prompt version selection

## MVP Sırası

### Phase 1: Temel Uygulama

- Next.js app
- auth
- user/admin rolleri
- store modeli
- app shell
- sidebar
- dashboard skeleton
- theme token sistemi
- admin/user route ayrımı

### Phase 2: Bookmark ve Reference

- Bookmark Inbox
- URL/upload ile asset ekleme
- Reference Board
- collections/tags
- bookmark -> reference akışı

### Phase 3: Competitor Analysis

- Etsy shop URL/name
- scraper abstraction
- review-based ranking
- product cards
- bookmark/reference aksiyonları

### Phase 4: Trend Stories

- rakip yeni listing akışı
- story/card UI
- bookmark/reference aksiyonları
- temel trend cluster hazırlığı

### Phase 5: Variation Generation

- AI provider abstraction
- master prompt kullanımı
- similarity control
- generated design grid
- reference vs output comparison

### Phase 6: AI Quality Review

- technical image checks
- OCR/text/gibberish detection
- visual artifact review
- risk flags
- score badge
- Human Review Queue

### Phase 7: Selection Studio

- background removal
- color editor
- crop/aspect ratio
- upscale
- transparent PNG kontrolü

### Phase 8: Mockup Studio

- canvas/wall art mockups
- clipart bundle cover
- sticker sheet preview
- custom mockup upload

### Phase 9: Listing Builder

- title/description/13 tags
- store profile/brand voice kullanımı
- readiness checklist
- Etsy draft push

### Phase 10: Admin Hardening

- prompt versioning UI
- Prompt Playground
- provider settings
- negative library
- cost usage
- audit logs
- recipes/presets
- theme editor

## Uygulama Hissi

Arayüz Matesy’nin uygulama içi UX’inden ilham almalı:

- sol sidebar
- beyaz çalışma alanı
- turuncu/kırmızı aksan
- kart/grid yapısı
- story akışı
- görsel karşılaştırma
- tek ana aksiyon mantığı
- sade ama güçlü üretim kokpiti

Matesy birebir kopyalanmayacak. Aynı kullanım kolaylığı ve akış mantığı özgün bir tasarımla uygulanacak.

## Ürün Felsefesi

Bu sistemin güçlü olması gereken noktalar:

- fikirleri organize toplamak ve referans havuzu oluşturmak
- üretimden önce ve sonra kalite kontrol yapmak
- dijital download (clipart, wall art, bookmark, sticker, printable) tarafını
  uçtan uca güçlü desteklemek
- admin prompt yönetimiyle sistemi sürekli iyileştirmek
- kullanıcıyı karmaşık ayarlara boğmadan üretim yaptırmak
- düşük kaliteli veya riskli görselleri otomatik elemek
- çok kullanıcılı ve çok mağazalı yapıyı baştan doğru kurmak
- aynı arayüzde hem küçük hem yüzlerce-asset'lik büyük operasyonu
  desteklemek

## Bilgi Mimarisi (Final Yön)

Top-level navigasyon **9 öğe / 2 grup**'tur. Yeni ekran/feature bu listenin
dışında top-level olarak eklenmez; uygun yerinin alt-akışına yerleşir.

**Closed-list istisnası — Review (IA Phase 10):** Önceki yapı 8 öğe idi
ve Review canonical surface'i sub-view olarak Batches içinde
düşünülmüştü. Operatör entry visibility audit'i sonrası karar şudur:
review canonical bir stage'tir (Madde C) ve Batches sub-view olarak
gizlemek operatörü "review nereden açılır?" sorusuna düşürüyordu.
Review top-level olarak listeye eklendi; closed-list invariant'ı yeni
9 öğe ile yeniden kilitlendi. Yeni top-level eklemesi yine yasaktır.

**PRODUCE**

- **Overview** — bekleyen aksiyonlar, aktif batch'ler, son üretim
- **References** — üretim öncesi havuz; aşağıdaki sub-view'lar **References
  içinde** birleşir (tab / sol subnav / segment / saved view biçimi UI
  kararıdır):
  - Pool — kürasyon yapılmış referans havuzu (default view)
  - Stories — rakip yeni listing story-feed
  - Inbox — bookmark inbox
  - Shops — Etsy shop analizleri
  - Collections — operatör-organize gruplamalar
- **Batches** — variation jobs, retry-failed-only, logs, history
  (Review tab'ı top-level Review surface'ine yönlenir — tek canonical
  review ürünü, Madde B)
- **Review** — canonical decision workspace; queue mode + scope
  param'ları ile batch / source / item focus modları
- **Library** — üretilmiş tüm asset'lerin tek doğruluk kaynağı
- **Selections** — kürate edilmiş set'ler (Designs / Edits / Mockups /
  History tab'ları detail içinde)
- **Products** — mockup + bundle preview + listing draft + Etsy draft
  prep (Mockups / Listing / Files / History tab'ları detail içinde)

**SYSTEM**

- **Templates** — Prompt / Style / Mockup / Recipe (4 sub-tip filter)
- **Settings** — Preferences / Providers / Mockup Templates / Theme /
  Users / Audit / Feature Flags

**Top-level olmayanlar (alt-akışlara yerleşir):**

- Batch Run → Batches index'inde "+ New Batch" primary CTA → split-modal
  stepper
- Review Studio → Batches/[id] içinde **Review** tab
- Job Detail → Batches/[id]/Logs tab + persistent "Active Tasks" floating
  panel
- Kept Workspace → Selections içinde **All Kept** filter view
- Mockup Apply → Selections/[id]/Mockups tab'ından açılan split-modal
- Listing Builder → Products/[id]/Listing tab
- Color Editor / Crop / Upscale → Selections/[id]/Edits tab'ından açılan
  split-modal'lar
- Trend Stories / Bookmarks / Competitors / Collections → References
  altında sub-view'lar

**Admin scope ayrı bir sidebar değildir.** Footer'da küçük bir rozet ile
işaretlenir; admin-only section'lar `Settings` ve `Templates` içinde
role-gated olarak görünür.

## Canonical Surface İlkeleri (Ürün Anayasası)

Bu bölüm, IA Phase çalışmaları boyunca kristalize olan ürün/mimari
prensiplerini sözleşmeye bağlar. Yeni feature, refactor veya bug fix
yapılırken bu ilkelere uyulmalı; ihlal eden değişiklik **sınır
gözden geçirilmeden** birleştirilmez.

### A. Canonical surface ilkesi

- Aynı iş / aynı stage / aynı kullanıcı amacı için birden fazla paralel
  yüzey **olmaz**. Operatör hangi sayfadan, hangi butondan gelirse
  gelsin **aynı canonical surface'e** iner.
- Legacy / duplicate / bridge / fallback yüzeyler kullanıcıya ana yol
  olarak sunulmaz. Eski yüzeyler ya canonical olana **redirect**
  edilir, ya **thin wrapper** olarak çalışır, ya da kaldırılır.
- Yeni canonical replacement açılmadan eski yüzey kapatılmaz: önce
  replacement path doğrulanır, sonra eski yüzey kapatma adımına alınır.
- Bir yüzey "tek canonical" iken UI/CTA seviyesinde de dağılım yok
  demektir: tüm "Open X" CTA'ları aynı canonical URL'e gider; alt
  scope'lar için canonical query param taksonomisi kullanılır.

### B. Tek canonical review experience

- Review için tek canonical route ailesi: **`/review`**.
- Batch / local / AI / item review ayrı ürün yüzeyleri **değildir**;
  canonical `/review` yüzeyinin **scope'lanmış modlarıdır**:
  - `/review` — queue mode (tab grid)
  - `/review?source=ai|local` — source filter
  - `/review?decision=undecided|kept|rejected` — decision filter
  - `/review?batch=<id>` — batch-scoped focus mode
  - `/review?item=<id>` — single-item focus mode (MJ ise parent
    batch'e otomatik resolve)
- Operatör farkında olmadan legacy review veya deaktif review
  yüzeyine **düşmez**: sidebar / Overview / Batches / References
  hepsinde "Review" girişi `/review` veya scoped variant'ına yönelir.
- Review erişimi **görünür ve bulunabilir** olmalıdır; gizli route
  gibi kalmaz.

### C. Tek canonical surface per stage

Sadece review için değil, üretim hattının her aşaması için canonical
yüzey yaklaşımı:

| Stage | Canonical surface |
|---|---|
| Source picking | `/references` (+ alt sub-view'lar) |
| Generation | `/references/[id]/variations` → `/batches` |
| Review | `/review` (+ scope param'ları) |
| Selection / Edit | `/selections/[setId]` (+ `?tab=edits`) |
| Mockup | `/products/[id]` (read-only preview Selections'ta) |
| Listing / Export | `/products/[id]?tab=listing` |

- Aynı stage'i yapan duplicate sayfalar **uzun vadede kaldırılır**
  veya canonical olana yönlendirilir. Mevcut duplicate'lar açıkça
  **bridge** olarak işaretlenir (Madde J).

### D. Digital-only ürün sınırı

- Kivasy **dijital ürün üretim sistemi**dir.
- Fiziksel / POD dili, fiziksel ürün seed data'sı, fiziksel fulfillment
  varsayımları **ürün omurgasına sızmaz**. Print partner, kargo,
  made-to-order, garment POD (t-shirt, hoodie, mug) UI'da **görünmez**.
- Ana product type'lar dijital indirilebilir kategorilerdir: clipart,
  wall art (dijital dosya), bookmark, sticker, printable. Yeni
  product type bu sınırı koruyarak eklenir.

### E. Source picking prensibi

- Source picking tek-image-upload mantığına sıkışmaz; **first-class
  adımdır**.
- Desteklenen kaynak türleri:
  - lokal tek/çoklu file upload
  - lokal folder scan (LocalLibraryAsset pipeline)
  - image URL paste
  - listing / product URL — kaynağın image set'i çekilip operatöre
    seçim yaptırılır
- Yeni kaynak tipi eklenirken canonical "Add Source" modal'ına
  sub-tab olarak takılır; ayrı top-level page açılmaz.

### F. Target output type first-class olmalı

- Source ne olursa olsun, generation öncesinde operatör **ne ürettiğini
  seçer**: clipart / wall art / bookmark / sticker / printable.
- Target aspect ratio (2:3 / 4:5 / 1:1 / 3:4) ve output type generation
  öncesinin birinci sınıf kararıdır; defaults UI'da görünür ve
  değiştirilebilir.
- WorkflowRun tablosu (gelecek) bu iki alanı **denormalize** field
  olarak tutar — runtime config drift'i önlemek için.

### G. Workflow / run / lineage görünürlüğü

- Tüm üretim süreci **tek bir run/workflow/job kimliği** altında
  izlenebilir olmalı.
- Source → generation → review → selection → mockup → listing zinciri
  **kopmaz**; her aşama bir önceki aşamanın run kimliğini taşır.
- Workflow tracking ayrı ve görünür bir ürün sorumluluğu olarak ele
  alınır. Şu an `Job.metadata.batchId` schema-zero pattern'i kullanılıyor;
  WorkflowRun tablosu IA Phase 11'de eklenecek (canonical lineage
  identity).

### H. Decision ve progression gate prensibi

- Bir scope'ta **undecided item kaldığı sürece** kullanıcı bir sonraki
  aşamaya yanlışlıkla ilerlemez.
- UI'da "kaç undecided kaldı" **açıkça görünür** olmalı. Sayı görünmez
  ise gate görünmez demektir.
- Gate hem **görünürlük** (caption / badge / disabled state) hem
  **davranış** (CTA disabled, server 4xx) seviyesinde tutarlıdır.
- Operatör override etmeli ise (örn. "Apply mockups anyway"), bu
  override **explicit** ve audit'lenebilir bir aksiyondur; sessiz
  bypass yoktur.

**Scope completion + auto-progress:** Bir scope (batch / folder)
tamamen `undecided=0`'a düştüğünde operatör akışı **kesilmez**:

- Workspace canonical "scope tamamlandı" ekranı gösterir
  (silent teleport yok — operatör nereye geçtiğini bilir).
- Sıradaki scope **eldeki sırayla deterministik** seçilir:
  - Batch için: aynı kullanıcının `undecided > 0` olan en eski
    `Job.metadata.batchId` (oldest pending — operatör birikmiş işi
    önce kapatır).
  - Local folder için: `LocalLibraryAsset.folderName` üzerinden
    gruplanmış; aynı user'ın `undecided > 0` olan en eski folder
    (oldest pending).
- Sıra dışı kalan scope yoksa "All caught up" ekranı + canonical
  exit (queue grid).
- Bu davranış server-truth'a yaslıdır: client cache'inden değil,
  her scope-completion sonrasında server'dan "next pending scope"
  resolve edilir.

### I. Bakım yükü / shell duplication prensibi

- Aynı deneyimi veren **iki büyük paralel workspace component'i**
  uzun vadede istenmez.
- Tercih edilen pattern: **ortak shell + source adapter / presenter**.
  Layout, action bar, filmstrip, keyboard model, info rail iskeleti
  ortaklaşır; source farkları adapter katmanında kalır.
- "İleride taşırız" kabul edilebilir bir karar değil — refactor
  ertelendiği her tur teknik borç birikir. İkinci consumer geldiği
  anda shell'e taşıma o turun zorunlu işidir.

### J. Legacy yüzeyleri kapatma kuralı

- "İleride kaldırırız" diyerek paralel legacy yüzeyler **sürekli
  yaşatılmaz**.
- Bir yüzey bridge olarak kalıyorsa şu üç bilgi **yorum + dokümantasyon
  seviyesinde** açıkça yazılır:
  1. Neden bridge olarak duruyor (canonical replacement henüz hangi
     parça için hazır değil).
  2. Ne zaman kaldırılacağı (tetik koşulu — örn. "QueueReviewWorkspace
     MJ source'unu da host edince").
  3. Canonical replacement'ın URL'i veya component adı.
- Bridge surface'lerin user-facing wording'inde "legacy" kelimesi
  geçmez (operatöre teknik borç sızdırma); ama internal yorum/PR
  notunda açık tutulur.
- Legacy yüzeyler temizlenirken yerlerine **ad hoc paralel UI** değil,
  Kivasy design system component / recipe / layout pattern'leri geçer
  (bkz. Madde L).

### K. Surface completion disiplini

- Bir yüzey / stage / ana kullanıcı akışı tam kapanmadan **bir sonraki
  büyük yüzeye geçilmez**. "Büyük ölçüde tamam" yeterli değildir.
- Bir surface tamamlanmış sayılmadan önce şu alanlar gözden geçirilmiş
  olmalı:
  - canonical route + entry points
  - duplicate / legacy / bridge yüzeyler (Madde A + J)
  - primary ve secondary CTA'lar
  - empty / filled / loading / error state'leri
  - bulk / selection / focus / detail davranışları
  - progression gates (Madde H)
  - keyboard / navigation / back/exit davranışı
  - visual parity / design-system uyumu
  - metadata / status / badge / count hiyerarşisi
  - TR/EN sızıntıları, placeholder / roadmap dili (operatöre "rollout-N"
    veya "coming in phase X" gibi internal etiket sızdırılmaz)
- Surface'te hâlâ büyük açıklar varsa, yeni yüzeye feature taşımak
  yerine önce mevcut surface kapatılır.

### L. Kivasy design system önceliği

- HTML hedefinde (`docs/design-system/kivasy/ui_kits/kivasy/v4`,
  `v5`, `v6`) bir yüzey tanımlıysa **ona uyulur** — sapma için
  gerekçe yorum/PR notunda açıklanır.
- Hedefte yüzey yoksa yeni yüzeyler Kivasy design system component /
  recipe / layout mantığıyla kurulur:
  - Recipe class'ları: `.k-card`, `.k-thumb`, `.k-badge`, `.k-iconbtn`,
    `.k-stabs/.k-stab`, `.k-fab`, `.k-segment`, `.k-input`,
    `.k-checkbox`, `.k-ring-selected`, `.k-display`, vb.
  - Token sistemi: `paper`, `ink/ink-2/ink-3/ink-4`, `line/line-strong/
    line-soft`, `k-orange/k-orange-soft/k-orange-ink`, `k-bg/k-bg-2`.
  - Half-pixel typography: `text-[10.5px]`, `text-[12.5px]`,
    `text-[13.5px]`, `text-[24px] k-display`.
- Ad hoc paralel UI katmanı (custom div hierarchy + utility soup +
  inline border-color) yeni feature için kabul edilmez. Eskiden
  böyle yapılmış yerler legacy temizliği sırasında DS'ye geçirilir.
- Token discipline (`scripts/check-tokens.ts`) ihlal edilirse yeni
  yüzey merge edilmez. Whitelist sadece DS-spec kararıyla yazılır
  (örn. v4 dark workspace hex sabitleri).

### M. Review surface — sabit kararlar

Bu bölüm Phase 6 → Phase 13 boyunca review surface'i için verilen
ürün/UX kararlarını yazıya bağlar. Yeni feature, refactor veya UI
polish bu sabitleri korur:

**Scope identity:** Review workspace daima açıkça tanımlı bir
**aktif scope identity** üzerinde çalışır:
- `batch` (BatchId, AI batch review)
- `folder` (LocalLibraryAsset.folderName, local review)
- `reference` (Reference.id, AI design review tek reference)
- `queue-filter` (operatörün filtre kombinasyonu — fallback)

Tüm sayaçlar (undecided/kept/discarded), `Item N / M` ifadesindeki
`M`, scope summary, progress bar, picker, prev/next scope nav ve
shortcut'lar **bu scope identity üzerinden** server-side
hesaplanır. Page size, cache window veya filtreli queue total
scope cardinality yerine geçmez. Kapsam dışı sayılar (workspace-
wide pending) **anchor** seviyesinde kalır, scope-içi sayımları
bastırmaz.

**Tek tip review experience:** folder / batch / reference review
ayrı ürün değildir — aynı canonical surface'in scope variant'larıdır.
Top-bar yapısı, scope summary mantığı, item navigation, scope
navigation, picker, right panel, shortcuts üçü için aynı çatıdan
beslenir. Source farkı (filename vs prompt vs ref short-id)
içerikte olur, experience farkı **olmaz**.

**Top-bar bilgi hiyerarşisi:**

1. **Total review pending** (workspace anchor) — workspace çapında
   "ne kadar iş kaldı" cevabı.
2. **Scope summary** — `Batch / Folder · N undecided · K kept ·
   D discarded`. Üç sayım scope identity üzerinden gelir.
   Undecided > 0 iken accent.
3. **Aktif item** (`Item N / M`) — `M` = scope identity'nin
   gerçek toplam item sayısı. Page bilgisi top-bar'a girmez.

Top-bar **yatay** kalır; uzun scope adları (folder path, batch id)
truncate ile ezilir, top-bar yüksekliğini artırmaz.

**Sistem skorları:** Operator karar ekseninden ayrı, AI/scan
pipeline çıktıları (reviewScore, qualityScore, riskFlagCount) UI'da
**sistem değerlendirmesi** olarak gösterilir. Skor null ise chip
hiç render edilmez (sahte default değil). Operatör override sinyali
kart üzerinde değil, info-rail seviyesinde kalır.

**Progress bar:** her zaman **current scope progress** —
`(kept + discarded) / scopeTotal`. Workspace-wide ilerleme bar'a
girmez (anchor'a girer).

**Action bar düzeni:** **Keep · Undecided · Discard** (sol → sağ).
Kullanıcı talimatı: operatör action sırasını decision axis ile
okur, UI verb ile değil. "Reset" değil "Undecided".

**Filter bar düzeni:** Tek satır, segmented Kivasy DS recipe'ler
(`.k-segment`, `.k-input`). Source / decision / arama her zaman
aynı barda toplanır; ayrı tab + chip + arama satırları kabul
edilmez. Aspect ratio / ürün tipi / format gibi ek filtreler
varsa aynı bar'a sığar.

**Scope completion:** undecided=0 olduğunda canonical "Scope
complete" kart gösterilir (silent teleport yok). Sıradaki scope
**oldest pending** stratejisi ile resolve edilir (operatör birikmiş
işi önce kapatır). nextScope null → "All caught up" copy.

**Scope navigation:** Review focus mode'da iki bağımsız navigation
ekseni vardır:
- **Item** ekseni (within scope): ←/→ shortcut'larıyla aynı scope
  içinde geziyoruz.
- **Scope** ekseni (across scopes): `[` / `]` shortcut'larıyla
  önceki/sonraki scope'a geçiyoruz (local için folder, batch için
  batch). Operatör scope tamamlanmadan da bu eksende ilerleyebilir.
İki eksen birbirine karışmaz; UI yardım modalında ve right-panel
shortcuts'ta ayrı sıralarda gösterilir.

**Klavye sözleşmesi:** `K` keep · `D` discard · `U` undecided
(reset) · `←/→` prev/next item · `,` / `.` prev/next scope ·
`Esc` exit focus → scope grid · `?` shortcut help.

`,` ve `.` (görsel anlamda `<` / `>` shifted) seçildi:
- Item navigation (`←/→`) ile aynı tuş ailesinde değil — kazara karışma riski yok.
- HTML/markdown metin girişinde nadiren kullanılır (`[/]` aksine).
- macOS / Windows / Linux'ta sistem shortcut'larıyla çakışmaz.

**Sistem skor contract'ı (açıklanabilir değerlendirme):** AI / scan
pipeline çıktısı bir **lifecycle taşıyan değerlendirme**dir, çıplak
sayı değil. Her review item'ı şu durumlardan birine eşlenir:
`pending` (henüz değerlendirilmedi), `scoring` (kuyrukta / işleniyor),
`ready` (sonuç hazır), `error` (provider/parse fail), `na`
(uygulanabilir değil). UI tüm beş durumu **dürüstçe** gösterir;
`pending` veya `error` sahte sayıyla maskelenmez. `ready` durumunda
sonuç şu alanları taşır: `score` (0–100), `summary`, `checksPassed[]`,
`checksFailed[]` (= riskFlags), `provider`, `promptVersion`,
`evaluatedAt`. Operator override `reviewStatusSource = USER` info-rail
sinyalidir; sistem skoru ile karıştırılmaz.

**Sağ panel checklist düzeni:** Sistem değerlendirmesi sağ panele
kontrol noktası listesi olarak iner — passed (yeşil tik) / failed
(amber/risk) ayrımı; serbest paragraf değil. Liste taksonomisi sabit
sözlükten gelir (drift koruması). Summary nihai operatör notu olarak
ayrı bölümde durur.

**Kart minimalizmi:** Grid kart değerli sinyalin yoğun gösterimi
içindir. Operatör override / user-source bilgisi karta taşınmaz —
karttaki yer sistem değerlendirmesi (skor + state + risk hint),
kaynak metadata (boyut, format, DPI, transparency) ve karar
chip'i için ayrılır. Operatör override info-rail seviyesinde kalır.

**AI ↔ Local kart/panel parity:** Kart ve sağ panel **kaynak adapter
seviyesinde** AI ↔ Local farklılaşır; UI dili (section sırası,
başlıklar, score/checklist/summary/risk yerleşimi) ortak
contract'tan gelir. İki ayrı UI ailesi yaşatılmaz.

**Settings / admin yönelimi:** Threshold (low/high), prompt template
ve provider parametreleri uzun vadede **Settings Registry**'den
yönetilir (CLAUDE.md ürün anayasası: master prompt admin yönetimi).
Hardcoded sabitler ara katmandadır; canonical kaynak settings
olduğunda pipeline buradan okur, kod sabit değişmez.

### M++. Information density — no duplication

Sağ panelde aynı bilgi iki farklı section'da tekrar etmez. Operator
override gibi sinyaller **bir kez** yazılır (en doğru yerde —
Decision bloğu) ve diğer section'lardan çıkarılır. Geri kalan
detay (Provider snapshot, prompt version) ihtiyaç anında
collapsible bloklar ile sunulur.

### M+. Decision explainability discipline

Bir item `NEEDS_REVIEW` durumuna düştüğünde **sebep operatöre
açıkça gösterilir**:

- "All checks passed but needs_review" çelişkisini önlemek için
  decision reasoning UI'a Decision/Outcome bloğu olarak iner.
- Olası sebepler: blocker fail, low score, mid-band safe default,
  threshold'a uzaklık. Her kuralın hangisinin tetiklendiği server
  tarafında resolve edilir, UI'a string olarak iletilir.
- Score breakdown + decision reason iki ayrı bilgidir: breakdown
  sayıların matematiğini, reason kararın "neden böyle çıktığını"
  anlatır.

### N. Scoring lifecycle dürüstlüğü ve cost disiplini

Sistem skoru bir **lifecycle** taşır; UI tek bir "waiting for AI"
captionı ile bu lifecycle'ı maskeleyemez. Backend ayrımı yapılır,
UI dürüstçe yansıtır:

- `not_queued` — asset henüz hiç review job'ına alınmadı (scoring
  pipeline'a girmedi).
- `queued` — REVIEW_DESIGN job'u kuyruğa alındı, henüz başlamadı.
- `running` — provider'a gönderildi, response bekleniyor.
- `ready` — provider response başarıyla yazıldı.
- `failed` — provider başarısız (audit log'da neden var).
- `na` — asset için review uygulanabilir değil (gelecek kullanım).

Operatöre + admin'e bu beş durum **ayrı kelimelerle** gösterilir.

AI scoring (Gemini vb.) **pahalı bir işlem** olarak ele alınır. Bu
nedenle:

- Bir asset için sistem skoru bir kez **başarıyla** üretildiyse
  (`reviewedAt` dolu, `reviewProviderSnapshot` dolu, source = SYSTEM),
  asset'in **content fingerprint'i değişmediği sürece** tekrar
  scoring tetiklenmez.
- Operatör kararı verilmiş (`KEPT` / `REJECTED`) item'lar için ek
  scoring çalıştırılmaz; karar verilen item'a yeni provider çağrısı
  düşmez.
- Scoring tetiklemesi **idempotent** kabul edilir: aynı içeriğe ait
  job ikinci kez kuyruğa atılırsa worker en içte erken-skip yapar
  (sticky guard'ın eşdeğeri "already-scored guard").
- Re-score yalnızca iki yoldan biriyle yapılır:
  1. Operatör manuel **reset** ettiğinde (`reviewedAt → null`,
     snapshot'lar temizlenir, rerun enqueue),
  2. Asset üzerinde scoring'i etkileyen **anlamlı bir image-content
     değişikliği** olduğunda (background remove, crop, upscale,
     remaster, re-export gibi); bu durumda invalidation helper
     kararı resetler ve item undecided'a düşer.
- Scoring'i etkilemeyen değişiklikler re-score doğurmaz: kullanıcı
  kararı (keep / reject), label / metadata güncellemesi, sadece
  thumbnail regen, taxonomy değişikliği. Bu sınır pipeline kodunda
  açık tek bir invalidation helper'ında tanımlıdır; başka yerlerde
  ad-hoc reset yapılmaz.
- **Kept/Rejected → Undecided dönüşü** tek başına re-score sebebi
  **değildir**: status PENDING'e döner, kararın USER damgası
  silinir, ama mevcut snapshot (score, riskFlags, summary,
  reviewedAt) **korunur**. Operatör kararını geri çekti — AI
  değerlendirmesi hâlâ referans olarak durur. Re-score istiyorsa
  explicit "rerun" akışı ile (snapshot temizle + enqueue)
  tetikler. Hiç skor yoksa zaten not_queued.
- "Sıraya alındı" (queued) durumu ile "henüz hiç değerlendirilmedi"
  (pending) durumu UI'da ayrı lifecycle olarak temsil edilir; sahte
  default skor gösterilmez.

### N+. Review automation + manual trigger

Review yalnız reaktif değildir; pipeline yeni asset gördüğünde
otomatik olarak scoring kuyruğa alır (CLAUDE.md ürün anayasası
"görselleri kalite kontrolünden geçir"). Üç tetikleme yolu vardır:

1. **Production auto-enqueue** — yeni asset üretildiği veya
   keşfedildiği anda (variation worker, local scan worker)
   REVIEW_DESIGN job'u otomatik kuyruğa alınır. Aynı asset için
   geçerli skor varsa enqueue **YAPILMAZ** (already-scored guard
   pre-filter; cost discipline).
2. **Manual scope trigger** — operatör Settings → Review pane'den
   veya review surface'ten "scope için tüm undecided'ları score'la"
   diyebilir. Scope = batch veya folder (CLAUDE.md scope identity).
3. **Operator reset** — PATCH'la snapshot temizlenir, rerun enqueue.

Manual trigger ve auto-scan operasyonel görünürlük için admin
panelinde sayılar olarak yansır: queued / running / failed counts +
last scan time + last auto-enqueue time. Operatör pipeline'ın gerçek
durumunu görmeden "review ne durumda?" sorusuna cevap veremez.

### O. Prompt-block / criteria architecture

Sistem genelinde kullanılan master promptlar **tek parça sabit
metin** olmamalıdır. Bunun yerine:

- Master prompt = **core (admin-editable spine)** + **active applicable
  blocks**. Compose her job'da bağlama göre yeniden hesaplanır;
  pasif veya bağlama uymayan bloklar prompttan çıkarılır.
- Her blok yalnızca prompt metni değil, kendi **config payload'ı**dır:
  key, label, description, prompt block text, weight (score
  contribution), severity / fail behavior, applicability rules
  (product type / format / source type / image state / transform
  history), active flag, version.
- Applicability rules **kompozit** (çoklu boyutlar AND'lenir): bir
  kriter sadece "şu product type'larda" değil, gerekirse "şu
  format'larda" + "şu image state'inde" + "şu transform sonrası"
  açılır. Aynı asset farklı yaşam evrelerinde farklı checklist
  görür (örn. JPEG'in transparent kuralı applicable değildir;
  background remove sonrası applicable olur).
- Block-driven scoring: provider raw score ya doğrudan ya da
  ağırlıklı kriter geçişlerinden türev olarak persist edilir;
  kriter weight'leri admin tarafından görünür ve ayarlanabilir.
  Final skor matematiği (additive / weighted / binary fail gate)
  **kapalı kutu olamaz** — admin paneline açıklanır.
- Compose edilmiş prompt + block listesi + selected block
  signature her job'da snapshot'lanır (audit / drift detection /
  reproducibility).
- Admin paneli iki ayrı yüzey gösterir: (1) **core master prompt
  editor** — ana çatı düzenlenebilir; (2) **block manager** — CRUD
  + active toggle + weight + applicability rules + final compose
  preview. Operatör/admin "neden bu skor?" sorusuna **prompt + block
  + weight + applicability** dörtlüsü üzerinden cevap bulabilir.
- Bu prensip review ile sınırlı değildir: ileride listing copy,
  metadata, recipe instructions vb. tüm prompt-driven sistemler
  aynı block-compose modeline geçer. Tek parça hardcoded prompt
  string yeni feature için kabul edilmez.
- Geçiş modeli: builtin bloklar kod-level kalır, settings store'da
  kullanıcı override katmanı vardır; admin override yokken
  builtin'ler etkili. UI yazma yüzeyi her builtin için override
  oluşturup updates yazar (delete override = revert to builtin).
- Criteria sistemi yalnızca semantic/moderation kuralları (provider'ın
  cevaplayacağı) için değil, **teknik kalite kuralları** (DPI,
  resolution, aspect ratio, format, transparency) için de
  kullanılabilir. Server-side rule evaluator asset metadata'sını
  okur ve teknik kuralların failed olanlarını risk flag olarak
  ekler; provider çağrısı gerekmez. Aynı UI (label/description/
  weight/severity/applicability/active) iki aileye de açıktır
  — operatör hangi kuralın provider veya local evaluator
  tarafından kontrol edildiğini bir family chip ile görür.

### P. Stable interaction surfaces

Yoğun etkileşimli yüzeylerde (review, batch detail, library grid,
mockup apply) kazara etkileşim **engellenir**. Operatör niyet
etmediği halde sayfa cevap vermemeli:

- Boş alana double-click görünür bir state üretmemeli (text
  selection, focus ring, overlay açma vb.). Default browser
  selection bu yüzeylerde `user-select: none` ile kapatılır;
  yalnız yazılabilir input/textarea/code regions text selection'a
  izin verir.
- Filmstrip, grid, picker thumb'ları **click-first** davranır.
  `<img>` child'ları default `draggable` özelliği taşımaz; native
  drag tetiklemesi (DOM drag-and-drop API) bu yüzeylerde devre
  dışıdır.
- Navigation aksiyonları (prev/next item, prev/next scope, exit)
  hem klavye hem mouse ile **erişilebilir**, ikisi aynı sonucu
  verir. Klavye-only veya mouse-only davranış kabul edilmez.
- Klavye shortcut'ları sistem kısayollarıyla çakışmamalı; aynı
  surface içinde item navigation ile scope navigation ayrı
  tuş ailesinde durur (ör. `←/→` item, `,/.` scope — `[/]` HTML
  metin girişinde sık kullanıldığı için ergonomik değildir).

### Q. Information density without clutter

Kullanıcıya gerekli bilgi verilir, ama görsel gürültü üretilmez:

- Kart üzeri durum/state göstergeleri **kompakt** kalır
  (icon-only badge, kısa harf kodu, küçük chip). Uzun cümle
  ("Not queued yet" vb.) karta sığmaz.
- Detaylı lifecycle, scoring breakdown, applicability, summary
  kart üzerinde değil, **detail panelde** yaşar.
- Bilgi kaybetmeden sadeleştirmek temel kuraldır: kartta gizlenen
  her sinyal detail panelde aynen kalır.
- Section'lar uzunsa collapsible olabilir (operator override info,
  variation lineage gibi); ana scoring breakdown her zaman
  görünür kalır.

### R. Configurable scoring policy (admin-editable thresholds)

CLAUDE.md ürün anayasası "tüm operatör-facing davranış (prompt,
threshold, default, scoring rule) Settings Registry üzerinden
yönetilir; service/pipeline kodunda hardcoded kalmaz." Review
scoring eşikleri (`thresholdLow` ve `thresholdHigh`) bu kuralın
kapsamındadır:

- Eşikler **kod sabiti olamaz**; settings store'da yaşar
  (`UserSetting key="review"` → `thresholds: { low, high }`).
- Builtin defaults (60 / 90) tek bir referans olarak kalır;
  user override yoksa builtin etkili. Bu Phase 6 Karar 3
  (sessiz default YASAK) ile çelişmez — operatör değer atadığı
  anda explicit konfigürasyon olur, atamadığı sürece "ürün
  anayasası tarafından belirlenen referans" devrededir.
- Constraint: `0 ≤ low < high ≤ 100`. Schema seviyesinde
  enforce; ihlal eden payload PUT'ta 400 döner.
- Decision engine **kompoze edilen değerleri** parametre olarak
  alır; `decideReviewOutcomeFromBreakdown(breakdown, { low, high })`.
  Sabit constant'tan okuma yasaktır.
- Worker resolved review config'ten thresholds'ı çeker ve outcome
  çağrısına geçirir. Aynı **snapshot** prensibi (CLAUDE.md ürün
  anayasası) gereği job başlangıcında thresholds policy snapshot'a
  yazılır — runtime'da admin değer değiştirirse çalışan job'lar
  eski eşiklerle bitirir.
- Queue endpoint thresholds'ı response-level `policy.thresholds`
  field'ında client'a döner; UI client-side decision türevini
  (Decision/Outcome bloğu) bu değerlerle hesaplar. Hardcoded
  60/90 fallback bırakılmaz — payload eksikse builtin defaults
  kullanılır ve dev console'a warn düşer.
- Admin paneli (`Settings → Review`) eşikleri **editable input**
  olarak gösterir: Save / Revert to defaults eylemleri vardır.
  Save sonrası decision engine yeni değerlerle çalışır; mevcut
  scored item'lar yeniden değerlendirilmez (re-score yalnız
  reset/transform ile — CLAUDE.md Madde N).
- Mid-band policy değişkeni şimdilik sabit (`safe default →
  NEEDS_REVIEW`). İleride mid-band davranışı da settings'e
  bağlanırsa aynı admin pane'de yer alır; bu turda "kapı açık,
  davranış sabit" kararı alınır.

Bu prensip yalnız review için değil, ileride listing pricing
heuristic'leri, brand-voice scoring, recipe parameter limit'leri
gibi tüm policy-driven sayısal kararlar için geçerlidir. Settings
Registry pattern'i: değer kod'tan okunmaz, hep resolved config
helper'ından geçer.

### S. Stored decision vs current policy preview ayrımı

Operatöre gösterilen bir karar **iki ayrı kavram** taşıyabilir:

- **Stored decision** — kayıtta duran, persisted truth. Sistem o
  anda hangi karar verildiyse veya operatör override yazdıysa,
  o değer. Listing/export/akış kararları **bu** truth üzerinden
  ilerler.
- **Current policy preview** — bugünkü policy ile aynı item bugün
  yeniden değerlendirilseydi sonuç ne olurdu? Yalnız bilgi
  amaçlıdır; persisted state'i değiştirmez.

Bu ikisi aynı kart üzerinde **karıştırılamaz**:

- Decision UI'da canonical alan **stored decision**'dır. Operatör
  "bu görsel ne durumda?" sorusunun cevabını burada okur.
- Current policy preview yalnız **stored decision'dan farklı**
  olduğunda gösterilir; gösterimde "Preview" / "would be" /
  "with current thresholds" gibi açık bir etiket taşır.
- Aynı görsel için iki farklı status sayısı çelişiyormuş gibi
  hissettirilmez; preview daima ek bağlam katmanıdır, ana karar
  değildir.

Re-evaluate kararı ürün sözleşmesidir:

- Default davranış: threshold/policy değişiklikleri **gelecek
  jobs**'a yansır; mevcut stored kararlar **olduğu gibi** kalır
  (CLAUDE.md Madde N — already-scored guard).
- Operatör mevcut kararı current policy ile yeniden hesaplatmak
  isterse explicit "Reset and rerun review" ile tetikler;
  preview alanı bu rerun'a kestirme bir entry olabilir ama
  sessiz re-evaluate yapmaz.

UI dilinde net çeviri:

- Stored decision: "Auto-approved" / "Needs review" / "Operator
  decision" — kart üst chip'i + sağ panel başlığı.
- Current policy preview: "With current thresholds (X/Y) this
  would be …" — yalnız stored ≠ preview olduğunda görünür.

### T. Proof-before-done (lifecycle / automation / policy)

Lifecycle, automation veya scoring policy değişiklikleri
"tamamlandı" sayılmadan önce **canlı state transition** ile
doğrulanmalıdır. Yalnız kod / schema seviyesinde tamam saymak
yeterli değildir:

- Lifecycle değişikliği için: enqueue → queued → running → ready
  geçişlerinin **en az birini** browser preview üzerinden gözlem.
  Polling/SSE kanıtı: refresh atmadan UI'da state'in değiştiği
  görüldü.
- Automation değişikliği için: gerçek bir asset üzerinde tetiklenen
  job'ın kuyruğa alındığı + worker tarafından alındığı **en yakın**
  state kanıtıyla teyit. "Worker kodu gönderildi" kanıt değildir.
- Scoring policy değişikliği için: PUT sonrası API'nin yeni değeri
  döndürdüğü + decision engine'in (worker veya client derivation)
  yeni değerle çalıştığı somut kanıt.

Final raporda hangi proof'un alındığı + neyin gerçek kanıtla
desteklenmediği açıkça yazılır.

### U. Automation must be provable

Automation kodu (worker auto-enqueue, scan job, retry, polling)
yalnız backend'de yaşıyorsa ve operatör görmüyor / değiştiremiyor
ise **eksik** kabul edilir:

- Auto-enqueue / scheduling parametreleri (örn. local scan folder
  → productType mapping, IA-35'te path-based) admin/settings
  yüzeyinde **görünür ve ayarlanabilir** olmalıdır. Sessiz default
  veya yalnız schema field'ı yeterli değildir.
- Scheduled / triggered automation davranışı operatöre
  **görünür** olmalı: ops dashboard sayaçları (queued, running,
  failed), last enqueue/last scan zaman damgaları, otomatik
  enqueue olduğunda log/notification.
- Operatör automation'ı manuel tetikleyebilmeli (scope-trigger
  manual enqueue) ve mevcut state'i sıfırlayabilmeli (reset →
  rerun).

Bir feature "tamam" sayılmadan önce: schema, worker, settings UI,
ops görünürlüğü, manual tetik ve canlı state kanıtı **beşi de**
yerinde olmalı.

**IA-39 uygulaması — Review automation toggles:**

`Settings → Review → Automation` altında üç admin-editable alan bulunur:

| Alan | Tip | Default | Açıklama |
|---|---|---|---|
| `aiAutoEnqueue` | boolean | `true` | AI variation worker SUCCESS sonrası REVIEW_DESIGN otomatik kuyruğa alınır |
| `localAutoEnqueue` | boolean | `true` | Local folder scan worker yeni asset bulduğunda REVIEW_DESIGN otomatik kuyruğa alınır |
| `localScanIntervalMinutes` | int 0–1440 | `0` | 0 = periodic scan devre dışı; >0 = dakika cinsinden BullMQ repeat job aralığı |

Worker davranışı (her iki worker aynı sözleşmeyi izler):

1. Worker `getResolvedReviewConfig(userId)` çağırır.
2. İlgili flag (`aiAutoEnqueue` veya `localAutoEnqueue`) `false` ise
   enqueue YAPILMAZ; `logger.info(...)` ile durum kaydedilir; job
   SUCCESS olarak biter.
3. Flag `true` ise mevcut `already-scored guard` (CLAUDE.md Madde N)
   hâlâ geçerlidir — geçerli skoru olan asset tekrar kuyruğa alınmaz.

Periodic scan (`localScanIntervalMinutes > 0`):

- `Settings → Review` PUT handler'ı değer değiştiğinde
  `syncLocalScanSchedule(userId, intervalMinutes)` çağırır.
- `intervalMinutes > 0` → BullMQ repeat job `local-scan-periodic-<userId>`
  key'iyle upsert edilir (cron pattern: `*/N * * * *`).
- `intervalMinutes = 0` → repeat job iptal edilir.
- Root path yoksa (`localSettings.rootFolderPath` null) schedule
  oluşturulmaz; operatör önce root path atamalı.

`not_queued` reason taxonomy (queue endpoint → lifecycle resolver →
UI copy):

| Reason | Açıklama |
|---|---|
| `pending_mapping` | Folder → productType mapping yok; operatör Settings → Review → Local library'den atamalı |
| `ignored` | Folder `__ignore__` olarak etiketlenmiş |
| `auto_enqueue_disabled` | `aiAutoEnqueue` veya `localAutoEnqueue` kapalı; Settings → Review → Automation'dan etkinleştirilebilir |
| `discovery_not_run` | Folder mapped ama SCAN_LOCAL_FOLDER henüz hiç başarıyla çalışmadı; operatör "Scan now" ile manuel tetiklemeli veya watcher/periodic scan beklemeli |
| `design_pending_worker` | Design henüz QUEUED/RUNNING; worker tamamlandığında scoring otomatik başlar |
| `legacy` | Pre-IA-29 satırı; yeniden scan veya rerun ile düzelir |
| `unknown` | Sınıflandırılamayan durum; worker log'larına bakılmalı |

Reason UI copy pattern: `EvaluationPanel` her reason için operatöre
actionable mesaj gösterir (ne yapması gerektiğini söyler, teknik kod vermez).

**Local discovery — hybrid model (IA-39+ final karar):**

**Otomatik başlatma (instrumentation hook):**

BullMQ workers ve chokidar watcher, Next.js `instrumentation.ts` hook'u
aracılığıyla uygulama başlangıcında otomatik başlar. Tek komut yeterlidir:
`npm run dev` (development) veya `npm run start` (production). Ayrı
`npm run worker` komutu **gerekmez**; kullanıcıdan teknik process yönetimi
beklenmez.

| Yol | Koşul | Durum |
|---|---|---|
| **Event-driven** (chokidar) | App çalışıyor + `localAutoEnqueue=true` | **Otomatik** |
| **Periodic** (BullMQ repeat) | App çalışıyor + `localScanIntervalMinutes > 0` | **Otomatik** |
| **Manuel** ("Scan now") | App çalışıyor | **Her zaman kullanılabilir** |

`discoveryMode` hesaplama (Settings → Review → ops alanı):

```
watcherActive && hasPeriodic → "event+periodic"
watcherActive && !hasPeriodic → "event_only"
!watcherActive && hasPeriodic → "periodic_only"
!watcherActive && !hasPeriodic → "manual_only"
```

**Mimari kısıt — chokidar + tüm native binary'ler webpack-safe:**

chokidar (`fsevents` native binary), sharp, @imgly/background-removal-node,
apify-client ve diğer server-only paketler Next.js webpack bundle'ına
**girmez**; `experimental.serverComponentsExternalPackages` + `webpack.externals`
callback ile exclude edilir ve Node.js runtime'da resolve edilir.
`instrumentation.ts` Next.js'in Node.js server process'inde çalışır —
webpack bundle'ı değil. `src/instrumentation.ts` konumunda bulunur
(`src/app` layout için `src/` gerekli; proje root'u taranmaz).

`next.config.mjs` iki katmanlı external stratejisi kullanır:
1. `experimental.serverComponentsExternalPackages` — Server Component
   ve API route bundle'ları için.
2. `webpack.externals` callback — instrumentation + worker chain bundle'ı
   için; `node:` prefix'li built-in'ler + tüm server-only paketler dahil.
3. Client-side `resolve.fallback = false` — tarayıcı bundle'ına hiçbir
   Node.js modülü polyfill'lenmez.

API route'ları watcher modülünü hâlâ **import etmez** (bundle güvenliği).
Watcher state, aynı process içindeki `getWatcherStatusMap()` ile okunur
ve `getReviewOpsCounts(opts.watcherInfo)` üzerinden inject edilir.

**Runtime kanıt (2026-05-11):**
`npm run dev` başlatıldığında log çıktısı:
```
✓ Compiled /instrumentation in 1777ms (1619 modules)
workers started  (active: 15 worker type)
local-library watcher started  (userId=..., rootPath=...)
✓ Ready in 3.9s
```
500 page yok. Production build `✓ Compiled successfully`. `npx tsc --noEmit` hatasız.

**Worker liveness detection (`workerRunning` field):**

`ReviewOpsCounts.workerRunning` — son 5 dakika içinde herhangi bir
`REVIEW_DESIGN` veya `SCAN_LOCAL_FOLDER` job'unun `SUCCESS/FAILED`
state'ine geçip geçmediğini DB'den kontrol eder. Next.js API route'unda
çalışır; chokidar veya BullMQ Redis CLIENT LIST gerektirmez.

- **Avantaj**: Stale Redis kayıtlarından etkilenmez. False negative olmaz
  (çalışan worker'ın işlediği job'lar anında yansır).
- **Bilinen gap**: Yeni başlatılmış worker ilk job'unu tamamlayana kadar
  `false` görünür (~saniyeler içinde düzelir aktif queue'da).
- **Kullanım**: Ops panelinde "worker offline" banner'ını tetikler.
  Hard guarantee değil — ops hint olarak kullanılır.

Admin panel davranışı:
- `workerRunning: false` → amber banner: "Background automation warming up".
  App yeni başlatıldığında ilk job tamamlanana kadar kısa süre görünebilir.
  Manual Scan now her zaman çalışır.
- `workerRunning: true` → banner görünmez; `discoveryMode` field'ı gerçek
  aktif modu gösterir (event+periodic / event_only / periodic_only).

`syncWatchersForAllUsers()` worker startup'ta: tüm `userSetting key=localLibrary`
row'larını okur, `rootFolderPath + localAutoEnqueue=true` olan kullanıcılar
için watcher başlatır. SIGINT/SIGTERM: `stopAllLocalLibraryWatchers()`.

**Rerun live-refresh contract:**

- Rerun mutation `onSuccess` → `refetchQueries` (immediate, stale-while-revalidate değil).
- Refetch sonrası lifecycle `queued` → UI anında döner.
- 5s polling `useReviewQueue` aktif item varken devam eder;
  `running → ready` geçişi de otomatik yakalanır.
- `invalidateQueries` yerine `refetchQueries` seçildi: invalidate
  sadece "stale" işaretler, client arka planda fetch atar;
  refetch immediate network isteği açar — rerun action'ı için
  "değişti, yenile" semantiği doğrudur.

### V. AI evaluation advisory — operator decision canonical

AI scoring sistemi review pipeline'ında **advisory katmandır**;
asla persisted final review kararı yazmaz.

- **Schema sözleşmesi**:
  - `reviewStatus` (enum) = **operatör damgası**. PENDING (default) =
    operatör henüz aksiyon almadı. APPROVED/REJECTED = operatör
    kararı. Worker bu alana ASLA dokunmaz.
  - `reviewSuggestedStatus` (enum, nullable) = AI advisory. Worker
    yazar; operatörü bağlamaz. UI "AI suggestion" katmanı olarak
    gösterir.
  - `reviewScore` = sistem normalize skor (deterministic; aşağıda).
  - `reviewProviderRawScore` (nullable) = provider'ın döndürdüğü ham
    skor — **sadece audit/debug**. UI ana score chip'i bu değeri
    göstermez.

- **Skor modeli** (provider raw'dan bağımsız, deterministic):
  ```
  finalScore = clamp(0, 100, 100 − Σ weight(failed warning) − blockerForce)
  blockerForce = hasBlockerFail ? 100 : 0
  ```
  Aynı failed flags = aynı score. Provider raw fluctuation skoru
  ETKİLEMEZ.

- **Queue endpoint kept/rejected semantiği**:
  - `kept` = `reviewStatus = APPROVED AND reviewStatusSource = USER`
  - `rejected` = `reviewStatus = REJECTED AND reviewStatusSource = USER`
  - `undecided` = `reviewStatus = PENDING`
  - AI'nın `APPROVED` advisory yazması "kept" sayımını ETKİLEMEZ.

- **UI katmanı**:
  - Stored decision (canonical) — operatör damgası varsa burada
    görünür. Kart üst chip'i bu sinyali render eder.
  - AI suggestion — küçük inline banner (advisory only). "Looks good"
    veya "Review recommended" + bir cümle gerekçe. Operatör kararını
    görsel olarak gölgelememeli.
  - Current policy preview — eski thresholds ile kayıtlı suggestion
    bugünkü thresholds'tan farklıysa ek bilgi olarak görünür.

- **Folder convention** (local automation):
  - Operatör root altında productType başına klasör açar
    (`clipart/`, `wall_art/`, `bookmark/`, ...). Scan worker
    asset'in bulunduğu üst klasör adına bakar; bilinen
    productType ise auto-enqueue.
  - Bilinmeyen klasör (örn. `ekmek/`) "pending" durumunda kalır
    ve UI'da listelenir. Operatör ya bilinen bir klasöre asset'leri
    taşır ya alias yazar (`ekmek` → `printable`) ya `__ignore__`
    eder. Global default fallback YOK — operatöre sessiz default
    atanmaz.

- **Enqueue truth**: `enqueueReviewDesign` helper'ı `db.job` row'unu
  ve BullMQ enqueue'yu **tek atomik adımda** yapar; lifecycle UI
  (queued/running/ready/failed) gerçek backend durumuyla uyuşur.
  Eski "enqueue but no db.job row" pattern'i artık yasaktır.

### V'. UI single-source semantik helper'ları (IA-30 + IA-31)

`getOperatorDecision`, `getAiScoreTone` ve `getRiskTone` review
surface'inin tek doğruluk kaynağıdır. Kart, focus mode, filmstrip,
breakdown sayıları, bulk action eşikleri hepsi aynı helper'lardan
beslenir:

- **`getOperatorDecision({ reviewStatus, reviewStatusSource })`** —
  operator damgası canonical eksen. `source !== USER` ise UNDECIDED.
  AI advisory hiçbir yerde "Kept/Rejected" görsel diliyle
  karıştırılmaz.

- **`getAiScoreTone({ score, thresholds })`** — threshold-aware,
  5 kademeli AI score tone (`critical` / `poor` / `warning` /
  `caution` / `success` / `neutral`). Sabit magic number yasak;
  her kademe operatör/admin'in belirlediği `low/high` threshold'lara
  orantısal hesap yapar:
  - `score >= high` → `success`
  - band içi (`low ≤ score < high`): midpoint `(low+high)/2` altı
    `warning`, üstü `caution` (near-pass)
  - band altı (`score < low`): half-low `low/2` altı `critical`,
    üstü `poor`
  - `score === null` → `neutral`
  Default 60/90 yalnızca fallback'tir (Settings Registry değer
  bulunmazsa). Hardcoded hex yok; Tailwind palette token'ları
  (rose/orange/amber/yellow/emerald) kullanılır.

- **`getRiskTone({ count, hasBlocker })`** — risk indicator score
  rengini **EZMEZ**. Ayrı badge:
  - `hasBlocker === true` → `critical` (dolu kırmızı)
  - `count > 0` → `warning` (amber outline)
  - aksi halde `none` (badge render edilmez)
  Score yüksek + risk varsa: score chip success kalır, risk badge
  ayrıca görünür (CLAUDE.md Madde Q — information density without
  conflict). Operator hem AI'nın yüksek puan verdiğini hem dikkat
  edilmesi gereken risk olduğunu **aynı anda** okuyabilir.

- **Lazy recompute (CLAUDE.md Madde S kapsamı)** — Queue endpoint
  eski snapshot'lardaki `reviewScore`'u bugünkü criteria + risk
  kinds matematiğiyle yeniden hesaplayıp response'a projekte eder
  (`recomputeStoredScore`). Persist YAPILMAZ — provider çağrılmaz,
  DB güncellenmez. Operatör 85/75 gibi eski algoritma çıktısı yerine
  bugünkü deterministic skoru görür. Re-score için explicit
  "Reset and rerun review" akışı zorunlu (CLAUDE.md Madde N — cost
  discipline).

- **Local rerun productTypeKey** — UI hardcoded değer **gönderir
  değildir**. Server tarafı asset'in `folderName`'i + operatör
  mapping'i (alias) + convention'dan resolve eder. Mapping yoksa
  endpoint 400 döner ve operatöre Settings → Review → Local library
  altında mapping atamasını söyler.

### V''. Downstream gate — operator-only "kept" zinciri (IA-31)

Library/Selection/Product/Etsy Draft hattı boyunca bir asset'in
ilerlemesi, sadece operatör damgasıyla mümkündür:

- AI advisory (`reviewSuggestedStatus`) hiçbir downstream gate'te
  "kept" olarak sayılmaz. `reviewStatus = APPROVED` tek başına
  yeterli değildir — `reviewStatusSource = USER` **zorunlu**.
- Downstream akış kendi gate'ini operatör kararına yaslar:
  Library'den selection set'e ekleme operatörün UI'da tetiklediği
  bir aksiyondur (silent auto-add yok); selection finalize ve mockup
  apply `SelectionItem.status` üzerinden gate'lenir; Etsy draft
  push ise listing handoff'undan ilerler.
- Yeni downstream consumer'lar eklenirken aynı kural geçerli:
  `reviewStatus = APPROVED AND reviewStatusSource = USER` veya
  selection layer'a teslim edilmiş status. Worker veya AI'nın
  yazdığı advisory sinyalleri downstream'e sızdırılamaz.

### W. Live updates — manuel refresh gerektirmez

Operatör backend değişikliklerini görmek için sayfa yenilemek
zorunda kalmamalı:

- **Review queue / focus mode**: `useReviewQueue` polling 5s aralık
  (unsettled lifecycle varsa: queued/running/not_queued).
- **Library** (server-rendered): `LibraryClient` 8s `router.refresh()`
  polling. Tab gizlendiğinde durur; geri görününce devam.
- **Settings → Local library mapping**: scan tetiklendikten 3s
  sonra mapping list query invalidate.

Polling cadence'leri:
- Aktif iş varken (queued/running): 5s
- Server-rendered listeler: 8s
- Tab hidden: tüm interval'lar pause

Yeni server-rendered surface eklendiğinde aynı pattern (router.refresh
interval + visibility-aware) uygulanır. SSE/WebSocket gelecekte
eklenebilir; pattern bozulmaz çünkü polling client-side, izole.

### X. Scope count invariant — operator-truth axis ghost-free (IA-32)

Review surface'inde scope sayımları (top-bar breakdown, folder/
reference/batch picker pending count, total review pending anchor)
**tek bir axis** kullanır: `reviewStatusSource != USER` →
"operatör henüz karar vermedi". Bu eski PENDING-only axis'in
yerini alır.

Domain invariant her zaman:

```
total = kept + rejected + undecided
```

- `kept` = `reviewStatus = APPROVED AND reviewStatusSource = USER`
- `rejected` = `reviewStatus = REJECTED AND reviewStatusSource = USER`
- `undecided` = `reviewStatusSource != USER` (PENDING + AI-yazılmış
  SYSTEM-source advisory snapshot'ları, NEEDS_REVIEW, vb. tümü
  bu bucket'a)

Bu axis'in zorunluluğu: pre-IA-29 dönemde worker `reviewStatus`'e
yazıyordu — operatör onları "henüz karar vermedim" olarak görmeli,
ama legacy SYSTEM-source rows axis dışına düştüğünde **ghost count**
oluşur (total > kept + rejected + undecided). UI'da "kayıp 1 item"
sorusunu doğurur. Yeni axis bu boşluğu kapatır.

Aynı axis hem queue endpoint hem next-scope picker resolver'larında
kullanılır (folder picker pending count = grid filtered count =
top-bar undecided sayısı). Picker'da farklı axis kullanmak ghost
count'a, yanıltıcı pending sayılarına ve operatörü yanlış scope'a
yönlendirmeye yol açar.

Yeni count consumer eklenirken aynı axis kullanılır. PENDING-only
axis kullanılmaz — invariant kırılır.

### X+. Topbar source-specific pending vs scope copy (IA-34)

Review focus topbar üç ayrı sayım katmanını **görsel olarak ayırır**:

- **Sol blok** — `22 AI PENDING` veya `67 LOCAL PENDING`. Bu
  **current source pending**: hangi source'a bakılıyorsa o source'un
  operator-undecided sayısı (`getSourcePendingCount({ source })`).
  AI ve Local focus mode'da farklı sayılar görünür — operatör hangi
  source'a baktığını sayıdan da okur. Workspace-wide global anchor
  (`getTotalReviewPendingCount`, "ALL PENDING") **review focus
  topbar'da kullanılmaz**; gelecekte dashboard gibi başka surface'lere
  ayrı olarak tüketilir (IA-33 kararı IA-34'te revize: "ALL PENDING"
  topbar'da yanıltıcıydı — kaldırıldı).
- **Sağ blok** — `THIS SCOPE 12 UNDECIDED · 0 KEPT · 0 DISCARDED`.
  Bu **current scope breakdown**: queue endpoint
  `scope.breakdown` payload'ı (batch / folder / reference / queue
  cardinality üzerinden). "THIS SCOPE" prefix etiketi ile source
  pending'den net ayrılır.
- **Item index** — `Item N / M`. M = current scope cardinality
  (resolved scope kind'a göre — batch dominant ise batch toplam).

Yeni count consumer eklenirken aynı dil kullanılır: source-içi sayım
"ai pending" / "local pending" prefix'i; scope-içi sayım "THIS
SCOPE …" prefix'i. Workspace-wide global anchor (eğer ileride başka
yüzeyde gösterilirse) "ALL …" prefix'i ve **ayrı bir surface
sorumluluğu** olarak yaşamalı — review focus topbar'a sızdırılmaz.

### X++. Scope priority — batch > folder > reference > source all (IA-34)

AI Designs source'da bir item hem batch hem reference lineage'i
taşıyorsa, **default scope = batch**:

- Aynı reference görselinden farklı batch'lerde farklı variation
  setleri üretilebilir; operatör çoğu zaman "şu batch'i temizliyorum"
  mantığıyla çalışır.
- Page loader item'ın `jobId`'sini → `Job.metadata.batchId`'sini
  resolve eder; batchId varsa default scope batch, picker kind
  batch, queue API param `batch=<id>`.
- Explicit `?scope=reference` URL param'ı dominance'ı override eder;
  operatör reference scope'a düşmek isterse açıkça seçer.
- Reference fallback: batch lineage yok veya explicit reference
  scope seçili → `kind: "reference"`.
- Local source: folder zaten doğal dominant (batch lineage local
  asset'lerde uygulanmaz).
- Source all: hiçbir scope identity verilmemişse `kind: "queue"`
  (default queue mode).

Bu öncelik **hem focus mode hem grid kart metadata** seviyesinde
uygulanır:
- ReviewCard `source.batchShortId` → `batch-XXXXXX` (primary scope
  label); yoksa `source.referenceShortId` → `ref-XXXXXX` (fallback).
- Focus topbar scope label, scope picker kind, filmstrip, next/prev
  scope navigation aynı priority'yi takip eder.

Queue endpoint response'unda her design item için `source.batchId` +
`source.batchShortId` projecte edilir (job metadata bulk fetch ile;
N+1 yok). UI bu alanları source-agnostic helper olarak kullanır.

### Y. Card preview parity — content-type aware object-fit (IA-32)

Grid kart thumbnail render'ı kaynak (`AI Designs` vs `Local Library`)
farkına değil, **asset content type'ına** göre `object-fit` seçer:

- `source.hasAlpha === true` (clipart, transparent PNG, sticker) →
  `object-contain`. Kenarlar kesilmez, full asset görünür.
- Aksi halde (fotografik wall art, JPEG, opak) → `object-cover`.
  Kart aspect-square'i tam doldursun.

AI Designs ve Local Library aynı kurala uyar. Source-bazlı
condition kullanmak `kaynak X buradan geldi, gri görünüyor`
gibi anlamsız asimetri yaratır. Asset metadata canonical:
`Sharp probe` (`LocalLibraryAsset.hasAlpha`, `Asset.hasAlpha`)
import zamanında doldurulur; UI bu sinyale yaslanır.

Legacy rows (`hasAlpha = null`) fallback olarak `object-cover`
alır — eski JPEG fotografik content için doğru karar.

### Y++. Info-rail collapsible sections — visual consistency (IA-34)

Review focus mode sağ panelinde uzun metadata blokları (`File`,
`Variation`, `Provider`, `Rerun review`, `Stored decision`)
**collapsible** olur; default kapalı. Visual pattern aynı:

- Header: `<button aria-expanded aria-controls>` + `SectionTitle`
- Toggle glyph: `+` (kapalı) / `−` (açık). **`Show / Hide` metni
  kullanılmaz** — text varyasyonu görsel gürültü yapar.
- Kapalı durumda kısa özet satırı (örn. file name) operatörü
  bağlamda tutar; tam detay açıldığında görünür.

CLAUDE.md Madde Q (information density without clutter) gereği:
operatör panelin scroll'una düşmemeli. Yeni info-rail section
eklenirken aynı pattern kullanılır.

### Y+. Focus stage full-resolution asset (IA-33)

Review focus mode'daki ana preview alanı (`aspect-square w-full
max-w-[760px]` stage) **thumbnail değil orijinal asset** kullanır.
Grid kart performans için thumbnail kullanmaya devam eder; focus
mode "yakından incele" deneyimi olduğu için orijinal/full-resolution
gerekli.

Queue endpoint her item için iki URL döner:

- `thumbnailUrl` — Local: `/api/local-library/thumbnail` (512×512
  webp); AI: provider signed URL. Grid kart kullanır.
- `fullResolutionUrl` — Local: `/api/local-library/asset` (orijinal
  dosya stream, mime'a göre content-type); AI: provider signed URL
  (provider zaten orijinali sunar, ek round-trip yok). Focus stage
  kullanır.

`/api/local-library/asset` sözleşmesi (CLAUDE.md Madde V — local
data isolation):
- user ownership zorunlu (cross-user 404)
- `isUserDeleted = false AND deletedAt = null` (soft-delete sızıntı YOK)
- `getActiveLocalRootFilter` (root değişince eski path'lerden sızıntı YOK)
- path traversal koruması: `filePath` DB'den okunur, query'den derive
  edilmez (schema-zero)
- content-type asset.mimeType (image/jpeg, image/png, image/webp)

AI Designs storage signed URL zaten orijinal asset'i sunduğu için
`fullResolutionUrl === thumbnailUrl` (ek endpoint gerekmez). Bu
sözleşme yeni source'lar için de geçerli: focus stage canonical
"full-resolution" channel'ı tek alandan okur (`fullResolutionUrl ??
thumbnailUrl` defansif zinciri).

## Library / Selections / Products — Sınır Invariant'ları

Bu üç ekranı **karıştırmak yasaktır**. Kod, route, copy ve UI seviyesinde
sınırlar şöyledir:

| Ekran | Tek-cümle tanım | İçerir | İçermez |
|---|---|---|---|
| **Library** | Üretilmiş tüm asset'lerin tek doğruluk kaynağı | Variation çıktıları, user upload'ları, lineage; filter-driven (kept / rejected / all / by ref / by batch) | Set / kürasyon yönetimi yok; "Add to Selection" sadece bir aksiyondur |
| **Selections** | Kürate edilmiş set'ler — mockup'a giden hat | Operatör-isimlendirilmiş, sıralanmış, edit'lenmiş gruplar; edit operasyonları (bg remove, color edit, crop, upscale) | Mockup üretimi ve listing burada **olmaz**; sadece "Apply Mockups" CTA'sı oradan açılır |
| **Products** | Mockup'lanmış + bundle-preview-hazırlanmış + listing-draft'lanmış + Etsy'ye giden paket | Lifestyle mockup'lar, bundle preview sheet'leri, listing metadata, digital files (PNG/ZIP/PDF/JPG/JPEG), Etsy draft history | Variation üretimi burada **olmaz**; selection set kaynaktır, Product paket olarak yaşar |

**State akışı tek yönlüdür** (geri yazım yok):

```
Reference  ─[create variations]─▶  Batch
           └─[items succeed]─────▶  Library asset
Library asset  ─[add to selection]─▶  Selection set
Selection set  ─[apply mockups]──────▶  Product
Product  ─[generate listing + send]──▶  Etsy draft
```

Her ok bir **action**'dır (single primary CTA), sayfa değildir. Çoğu action
bir **split modal** açar; operatör sayfa değiştirmez.

**Sınır ihlali riskleri:**

- "Selection" denilip Library grid'i çizilirse → ihlal
- Products'a variation generate eklenirse → ihlal
- Library'de set CRUD yapılırsa → ihlal
- Etsy draft history Selections'ta tutulursa → ihlal

Yeni feature / migration / refactor bu sınırlardan birini bulanıklaştırırsa,
iş durdurulup sınır gözden geçirilir.

## Mockup Modeli (3 Tip)

Mockup'lar dijital listing sunumu içindir; fiziksel üretim değil. Apply
Mockups akışı 3 sınıfı sibling tab olarak gösterir:

1. **Lifestyle mockups** — bağlamsal sunum
2. **Bundle preview sheets** — "ne aldığım" görseli
3. **User-uploaded custom templates** — `Templates` altında `Mockup
   Templates` sub-tipi olarak persiste edilir; "afterthought" gibi
   hissettirilmez

Schema açısından `MockupTemplate` modeli `kind: LIFESTYLE | PREVIEW_SHEET |
USER_TEMPLATE` ayrımını desteklemelidir (bu enum eksikse migration
gerekir).

## Mobile / Native / High-volume Gereksinimleri

### Mobile (web responsive, bugün)

- Sidebar → bottom-tab (4 slot: Overview / References / Batches / Library)
  + "More" kebab (Selections / Products / Templates / Settings)
- Tablo → kart liste
- Grid → 2 sütun
- Split modal → full-screen bottom sheet (sol kaynak üstte sticky 30%,
  sağ aşağıda)
- Filter bar → bottom-sheet filter selector
- Active Tasks floating panel → swipe-up bottom drawer
- Big-job decision ekranları (200+ asset review) mobile'da browse-only
  olabilir; "Better on desktop" hint'i ile

### Native (Tauri ready, gelecek)

- App shell (sidebar + main + persistent floating Active Tasks panel)
  olduğu gibi taşınır
- Selection workspace ve Color editor ayrı pencere (multi-window) olabilir
- Settings macOS Preferences-style detail-list pattern'i
- Local file actions browser-only assumption yapmaz (Tauri `fs`
  abstraction'ına geçirilebilir olmalı)
- Watch folder feature: Tauri `notify` plugin → klasöre PNG bırakınca
  Library'ye düşer

### High-volume (yüzlerce asset, onlarca batch)

Bunlar **opsiyonel değil**:

- Library, Selection items, Batch items, Products için **virtualized grid**
- Bulk-select aktifken **floating action bar** (sticky bottom)
- Density toggle (Comfortable / Compact / Dense) — list / grid / table
  ekranlarında zorunlu, persist
- Filter chip preset'ler (sık kullanılan kombinasyonlar saklanır)
- Keyboard-first review: Cmd+K palette, j/k row nav, k=keep, r=reject,
  e=edit, ? help
- Fan-in / fan-out: Reference × N → Variations × M; Library × M →
  Selections × K; Selection × 1 → Mockup template × T → Products × T

## Z. Review Modülü — Freeze (2026-05-11)

**Review modülü 2026-05-11 itibarıyla tamamlanmış ve kilitli kabul edilir.**
Bu madde, review sözleşmesini korumak için koyulan en yüksek öncelikli
kuraldır. Açıkça talep edilmedikçe aşağıdakilere hiçbir şekilde dokunulmaz:

### Kilitli sözleşmeler

- **Operator truth vs. AI advisory ayrımı** — `reviewStatus` operatör
  damgasıdır; `reviewSuggestedStatus` AI önerisidır. Worker yalnızca
  `reviewSuggestedStatus` yazar, `reviewStatus`'e asla dokunmaz. Bu
  ayrım mimari sözleşmedir, refactor veya "temizlik" adıyla
  değiştirilemez.

- **Score modeli** — `finalScore = clamp(0, 100, 100 − Σ weight(failed))`.
  Blocker'ın skoru otomatik sıfırlaması yoktur; admin panelinde
  `weight=100` set edilerek sağlanır. Bu davranış değiştirilemez;
  "hidden auto-zero" pattern'i geri eklenemez.

- **Advisory/operator downstream gate** — `reviewStatus=APPROVED AND
  reviewStatusSource=USER` olmadan hiçbir downstream pipeline
  (Library → Selection → Product → Etsy) bir design'ı "kept"
  saymaz. AI advisory skoru ve `reviewSuggestedStatus` gate'i
  geçiremez.

- **Review UI semantics** — Scope count invariant (`total = kept +
  rejected + undecided`), topbar bilgi hiyerarşisi, batch > reference
  scope priority, klavye sözleşmesi (`K/D/U/←/→/,/.`), progress bar
  hesabı, lifecycle durum gösterimi (not_queued/queued/running/ready/
  failed) — bunların tümü kilitlidir.

- **Automation contract** — `aiAutoEnqueue`, `localAutoEnqueue`,
  `localScanIntervalMinutes` toggle'ları ve `not_queued` reason
  taxonomy (6-kod: `pending_mapping`, `ignored`,
  `auto_enqueue_disabled`, `discovery_not_run`,
  `design_pending_worker`, `legacy`, `unknown`) kilitlidir.

- **Worker auto-start** — `src/instrumentation.ts` Next.js
  instrumentation hook ile BullMQ workers + chokidar watcher
  uygulama başlangıcında otomatik başlar. Ayrı `npm run worker`
  komutu gerekmez. Bu davranış korunur.

- **Review ops visibility** — `workerRunning` activity-based liveness
  proxy, amber banner, `discoveryMode` hesabı kilitlidir.

### Değişiklik kuralı

Bir sonraki iş review modülünü etkileyecekse **üç koşuldan biri**
zorunludur:

1. **Açık kullanıcı talebi** — "Review'a şunu ekle / değiştir" gibi
   net yönlendirme.
2. **Bug fix** — Review modülünde keşfedilen regression; scope sadece
   o bug'ı kapsar, etraf temizlenmez.
3. **Zorunlu altyapı** — Örneğin Prisma migration, başka bir modülün
   zorunlu kıldığı schema değişikliği. Bu durumda review alanlarına
   dokunmak **minimuma indirilir** ve açıkça belirtilir.

Bu üç koşul dışında review tarafına tek satır dokunulmaz.

### Bundan sonra odak

Yeni implementasyon şu hatta odaklanır:

```
Reference  →  Batch  →  Library  →  Selection  →  Product  →  Etsy Draft
```

Öncelikli çalışma alanları:
- **References** — reference veri modeli netleştirmesi, production
  brief bağlantısı, variation run ilişkisi
- **Production/Product hattı** — product canonical surface, mockup
  studio tam akış, listing builder
- **Selection** — selection set UI, edit studio tamamlama
- **Etsy Draft** — listing push altyapısı

---

## AA. Batch-First Production Pipeline (2026-05-12)

**Batch, üretim pipeline'ının merkezi çalışma birimidir.**
Bu madde `audit/references-production-pipeline` branch'inde Batch-first
Phase 1 olarak uygulandı (2026-05-12). Madde Z (Review Freeze) korunarak,
review modülüne dokunulmadan uygulandı.

Canonical tek yönlü akış:

```
Reference  →  Batch  →  Review  →  Selection  →  Product  →  Etsy Draft
```

Her ok bir **action** (single primary CTA). Geri yazım yok.

### Roller

| Yüzey | Tek-cümle tanım |
|---|---|
| **Reference** | Üretim öncesi input/havuz. "Bu kaynaktan kaç batch/design üretildi?" özeti kart üzerinde gösterilir. Primary CTA: "Create Variations" → yeni batch. |
| **Batch** | Tek üretim birimi. Başı/sonu olan, izlenebilir, kararla kapatılan iş birimi. Stage logic: running → review-pending → selection-ready / kept-no-selection → no-kept. |
| **Review** | `/review?batch={id}` — canonical scope. Freeze altında (Madde Z). |
| **Selection** | Kürate edilmiş set. Header'da batch lineage linki görünür (sourceMetadata JSON'dan okunur, schema migration yok). |
| **Product** | Mockup + listing + Etsy draft. |

### Batch detail stage logic (5 ayrı stage, CTA tekrarsız)

`deriveBatchStage()` 5 semantik olarak ayrı değer döndürür. `BatchStageCTA`
bu değerleri sadece render eder — re-derivasyon yapmaz.

| Stage | Koşul | Primary CTA |
|---|---|---|
| `running` | `running + queued > 0` | Spinner (bekleniyor) |
| `review-pending` | `undecided > 0` veya `reviewCounts.total = 0` | **Open Review** |
| `selection-ready` | `undecided = 0, kept > 0, set var` | **Continue in Selection** |
| `kept-no-selection` | `undecided = 0, kept > 0, set yok` | **Open Review** (kept badge) |
| `no-kept` | `kept = 0` | **New Batch** |

### Teknik kararlar (schema-zero)

- Batch kimliği: `Job.metadata.batchId` JSON field (schema migration yok).
- Batch → SelectionSet bağlantısı: `findSelectionSetForBatch()` Prisma
  JSON path query — hem `mjOrigin.batchIds[]` hem `{kind:"variation-batch",batchId}` path'ini kontrol eder.
- Selection → Batch lineage: `sourceMetadata.mjOrigin.batchIds[0]` →
  `/batches/{id}` link (SelectionBatchLineage component, header'da).
- Reference production history: `_count: { generatedDesigns, midjourneyJobs }`
  Prisma include ile; ReferenceBatchSummary card meta component'i.

### Değişmeyenler

- **Review freeze (Madde Z) korunur** — bu madde review semantics, scoring,
  automation contract veya review UI'a dokunmaz.
- `WorkflowRun` tablosu eklenmez (IA Phase 11 kapsamı).
- Schema migration yapılmaz.
- Yeni büyük abstraction açılmaz.

### Batch-first Phase 2 (2026-05-12 — handoff & lineage canonical)

Phase 1'in üzerine, Reference → Batch el geçişi ve Batches index lineer
akışa uygun hale getirildi. Schema-zero korunur — yeni tablo veya migration
yok; `Job.metadata.referenceId` (ai-generation.service:179'da zaten yazılıyor)
yeni UI/filter sözleşmelerinin canonical kaynağı oldu.

#### Reference → Batch handoff canonical

Audit'te tespit edildi: variation submit sonrası kullanıcı `/references/
[id]/variations` sayfasında bağlamsız kalıyordu — batchId yüzeye çıkmıyor,
"şimdi hangi batch'e bakıyorum?" sorusunun cevabı yoktu. Phase 2 çözümü:

1. `createVariationJobs` artık `batchId`'yi response payload'a çıkarır
   (`CreateVariationJobsOutput.batchId`). Canonical kaynak hâlâ
   `Job.metadata.batchId` — bu alan yalnız response surface'i.
2. `useCreateVariations` hook tipinde `batchId` field'ı eklendi.
3. `AiModeForm` submit başarılı olduğunda success banner gösterir:
   "Batch started · N/M queued" + "View Batch" CTA → `/batches/{batchId}`.
   Kullanıcı reference sayfasında kalır (grid update etmeye devam eder)
   ama bağlamı batch'e taşıma seçeneği açık görünür.

#### Batches index lineer akışa uygun hale geldi

`/batches` index'i şu yeni sözleşmeleri taşır:

1. **Reference lineage chip** her satırda — `Job.metadata.referenceId`
   geldiği batch'lerde "↗ REF XXXXXXXX" chip; href `/batches?referenceId=
   {id}`. Filter aktifken (zaten o reference'a scope edilmişken) chip'ler
   render edilmez (gürültü değil sinyal).
2. **Review breakdown caption** her satırda — `reviewCounts.undecided`
   varsa orange "N undecided", yoksa kept varsa green "N kept". Operatör
   detail'e girmeden gating signal'i grid'ten okur (CLAUDE.md Madde H).
3. **Reference filter chip toolbar'da** — `?referenceId=` aktifken
   "REF CMORQZNY · ✕" chip; clear için `/batches`'a düşer. Reference
   bulunamadıysa "not found" suffix ile dürüstçe gösterilir
   (silent ID display yok).

#### `referenceId` filter — schema-zero & güvenli

`listRecentBatches(userId, limit, { referenceId })` üçüncü parametre
opsiyonel:
- Prisma JSON path query: `metadata.path = ["referenceId"], equals: X`.
- Server tarafı `/batches/page.tsx` `searchParams.referenceId`'yi okuyup
  service'e geçirir; reference adı (`Reference.notes`) user-scoped +
  `deletedAt:null` ile resolve edilir (silent leak protection).
- Cross-user erişim engellidir — başkasının reference ID'siyle gelen
  istek "not found" chip'ine düşer; filtreli liste boş döner.
- `MidjourneyJob.referenceId` (DB column) **set edilmiyor** — lineage
  hâlâ `Job.metadata.referenceId` JSON field'ından geliyor. Schema
  migration gerekmiyor; Prisma JSON path filter yeterli.

#### Reference page — link tekrar aktif (gerçekten çalışıyor)

Phase 1'de kırık olduğu için plain text'e dönüştürülmüş
`ReferenceBatchSummary` linki Phase 2'de tekrar `<Link>` oldu:
- `href={`/batches?referenceId=${id}`}` — server-side filter aktif
- "N designs · view batches" copy
- info color + underline-offset, Kivasy DS uyumlu

#### Batch detail — reference back-link

`BatchDetailClient` artık opsiyonel `sourceReference` prop alır.
Server tarafı `getBatchSummary().referenceId`'yi Reference.notes ile
resolve eder (user-scoped + deletedAt:null). Header'da "↩ FROM REF
CMORQZNY" link; `/batches?referenceId=` filter scope'una geri döner.
Soft-deleted reference için back-link render edilmez (sessiz).

#### Değişmeyenler (Phase 2)

- **Review freeze (Madde Z) korunur.** Phase 2 review modülüne dokunmaz.
- **Schema migration yok.** `Job.metadata.referenceId` + Prisma JSON path
  filter ile çalışır.
- **Selection / Product semantics değişmez.** Lineage sadece Reference →
  Batch yönüne uygulandı.
- **`WorkflowRun` tablosu eklenmez** (IA Phase 11 kapsamı).
- **Kivasy DS dışına çıkılmadı.** Yeni recipe, token veya component
  family icat edilmedi; mevcut `.k-card`, `text-info`, mono caption
  pattern'leri kullanıldı.

### Batch-first Phase 3 (2026-05-12 — Selection creation canonical)

Phase 2'nin üzerine, **Batch → Selection** el geçişi canonical hale getirildi.
`kept-no-selection` stage'i artık operatörü review'a geri göndermez —
**Create Selection** primary CTA'sı ile yeni SelectionSet yaratır.

#### kept-no-selection stage — Create Selection action

Önceden bu stage `/review?batch=...`'a yönlendiriyordu. Sorun: review zaten
tamamlanmış (undecided = 0, kept > 0), operatör doğal sonraki adımı
("şimdi seçim yap") bulmak için review'a geri girip orada Studio CTA'sını
bulmak zorundaydı. Phase 3 çözümü:

- Stage CTA artık `<button>` (link değil) — onClick mutation tetikler.
- `useCreateSelectionFromBatch` hook → POST `/api/batches/[batchId]/create-selection`.
- Success → `router.push('/selections/{newSetId}')`. Operatör bağlamı
  Selection scope'una doğal taşınır.
- Loading state: spinner + "Creating…" caption.
- Error state: caption olarak operatöre actionable mesaj
  (`NO_KEPT_ASSETS`, `REFERENCE_NOT_RESOLVED`, vb.).
- Secondary fallback: "Re-open review" linki (operatör yine de review'a
  dönmek isterse görünür).

#### Server orchestration — createSelectionFromMjBatch

Yeni service fonksiyonu mevcut `handoffKeptAssetsToSelectionSet`'in
**batch-scope thin wrapper'ı**dır (`kept.ts`'de tanımlı):

1. `batchId`'den MJ jobs + KEPT asset id'lerini topla (user-scoped).
2. İlk MJ job'dan `referenceId` + `productTypeId` resolve et
   (variation single-reference; Job.metadata.referenceId fallback).
3. Auto-name: `reference.notes` (varsa) veya `productType.displayName`
   + bugünkü tarih — `quickStartFromBatch` pattern'ı.
4. `handoffKeptAssetsToSelectionSet`'i çağır: atomik
   promote + createSet + addItems + `sourceMetadata.mjOrigin` write.

Yeni schema yok. Mevcut `MidjourneyAsset.reviewDecision = KEPT` filter
+ `Job.metadata.batchId` group + handoff orchestrator yeniden kullanıldı.

#### selection-ready stage — context güçlendirme

Önceden CTA sadece "Continue in Selection · N kept · selection started"
gösteriyordu — operatör hangi selection set'e gittiğini görmüyordu.
Phase 3 güçlendirmesi:

- CTA artık `↗ {selectionSet.name}` caption'ı ile gösterir (max 280px
  truncate + title tooltip uzun isimler için).
- Secondary hint `N kept · selection started` korundu.
- Operatör "bu batch'ten selection zaten başlamış (<isim>)" bilgisini
  CTA üzerinde okur.

#### Selection lineage — Phase 1 ile uyumlu

Yeni `createSelectionFromMjBatch` `handoffKeptAssetsToSelectionSet`
çağırdığı için `SelectionSet.sourceMetadata.mjOrigin`'a aynı blob yazılır:
- `kindFamily: "midjourney_kept"`
- `batchIds: [batchId]`
- `referenceId`, `productTypeId`, `keptAssetCount`, `handedOffAt`

Selection detail header'ı bu blob'u Phase 1'de eklenen
`SelectionBatchLineage` ile zaten `↗ BATCH XXXXXXXX` clickable link
olarak gösteriyor. Phase 3 lineage modeline dokunmadı — sadece daha
fazla selection set bu yapıyı taşıyacak.

#### Değişmeyenler (Phase 3)

- **Review freeze (Madde Z) korunur.** Phase 3 review modülüne dokunmaz.
- **Schema migration yok.** Yeni tablo veya column eklenmedi; mevcut
  `handoffKeptAssetsToSelectionSet` orchestrator wrap edildi.
- **Product semantics değişmez.** Phase 3 sadece Batch → Selection
  yönüne uygulandı.
- **`WorkflowRun` tablosu eklenmez** (IA Phase 11 kapsamı).
- **Kivasy DS dışına çıkılmadı.** Yeni icon family yok; mevcut
  `Sparkles`, `ArrowRight`, `CheckCircle2`, mono caption pattern'leri.

### Batch-first Phase 4 (2026-05-12 — Unified batch detail surface)

Phase 2'de eklenen "View Batch" CTA AI variation batch'leri için 404
veriyordu çünkü `getBatchSummary` sadece `JobType.MIDJOURNEY_BRIDGE`
job'larını okuyordu. Phase 4 ile **kullanıcı-facing tek `/batches/[id]`
yüzeyi** her iki pipeline'ı taşır:

- **MIDJOURNEY_BRIDGE** (eski MJ bridge pipeline) — outputs `MidjourneyAsset`
- **GENERATE_VARIATIONS** (yeni AI pipeline — kie.ai vb.) — outputs `GeneratedDesign`

Operatör altyapı tipini bilmek zorunda kalmaz; UI küçük bir
`MJ` / `AI` chip'i ile sinyal verir (audit/debug için).

#### Unified resolver pattern

- `getBatchSummary(batchId, userId)`:
  - Önce `getAiVariationBatchSummary` (GENERATE_VARIATIONS) dener
  - Yoksa MJ_BRIDGE fallback yapar
  - `summary.pipeline` field'ı (`"midjourney" | "ai-variation"`) UI'da
    chip + handoff route kararı için kullanılır
- `listRecentBatches(userId, limit, options)`:
  - MJ batch'leri + `listAiVariationBatches` çıktısı `createdAt desc`
    sıralı merge edilir
  - Aynı `referenceId` filter'ı her iki pipeline'da uygulanır

Her iki pipeline aynı `Job.metadata.batchId` (cuid) semantic'ini paylaşır.
Schema-zero — yeni tablo yok, sadece JSON path query'leri.

#### AI metadata standardı

`ai-generation.service.ts` artık her job'a aşağıdaki field'ları yazar:
- `batchId` (cuid, IA-37)
- `referenceId` (Phase 2)
- `batchIndex` (yeni — MJ pattern parity)
- `batchTotal` (yeni — `"X / Y done"` caption için)

Eski AI batch'leri legacy `batchTotal: 0` gösterir (bir kez) — yeni
batch'ler doğru caption verir.

#### Pipeline-aware Create Selection dispatcher

Yeni `createSelectionFromBatch` dispatcher (`kept.ts`) batchId'den
pipeline'ı detect eder:
- GENERATE_VARIATIONS bulursa → `createSelectionFromAiBatch` (Phase 4)
  - `GeneratedDesign.reviewStatus=APPROVED + reviewStatusSource=USER`
    olan design'ları yeni SelectionSet'e ekler
  - `sourceMetadata.kind="variation-batch"` blob yazılır (Phase 1
    lineage parity — Selection detail header'da `↗ BATCH XXXXXXXX`
    görünür)
- MJ_BRIDGE bulursa → `createSelectionFromMjBatch` (Phase 3, değişmez)
- API endpoint `/api/batches/[batchId]/create-selection` artık
  pipeline-agnostic — UI handoff aynı CTA üzerinden her iki pipeline'a
  çalışır

CLAUDE.md Madde V'' downstream gate (operator-only kept zinciri)
korunur: AI batch'lerde KEPT semantic'i `reviewStatus=APPROVED +
reviewStatusSource=USER` (Madde V).

#### Değişmeyenler (Phase 4)

- **Review freeze (Madde Z) korunur.** Phase 4 review modülüne dokunmaz;
  AI pipeline'da `reviewSuggestedStatus` (advisory) ile `reviewStatus`
  (operator decision) ayrımı zaten yerleşik.
- **Schema migration yok.** İki pipeline aynı `Job.metadata.batchId`
  field'ını paylaşır; Prisma JSON path query unified resolver.
- **Yeni büyük abstraction açılmadı.** `BatchPipeline` type literal
  union + `getAiVariationBatchSummary` private helper; ana surface
  (`getBatchSummary`) signature'ı değişmez.
- **WorkflowRun eklenmez** (IA Phase 11 kapsamı).
- **Kivasy DS dışına çıkılmadı.** Pipeline chip mevcut `font-mono
  text-[10.5px] tracking-meta` recipe'iyle yazıldı.

### Batch-first Phase 5 (2026-05-12 — Kavramsal netleştirme + DS hizası)

Phase 1-4 boyunca implementasyon ilerlerken ürün dilinde iki kritik
karışıklık görüldü ve Phase 5'te netleştirildi:

#### Kavram 1: Batch ana üretim birimi, Create Variations ikincil refinement

- **Batch** ürün omurgasının **ana üretim birimi**dir. Pipeline:
  Reference → **Batch** → Review → Selection → Product. Batch creation
  birincil iş akışı.
- **Create Variations** ana üretim aksiyonu **DEĞİLDİR**. Bir
  referans/asset beğenilmediğinde veya yetersiz bulunduğunda
  küçük değişikliklerle yeniden üretim için kullanılan **ikincil
  refinement / re-variation** aksiyonudur.
- **Ana üretim aksiyonu**: `Batches index` (`/batches`) topbar'ındaki
  **`Start Batch`** primary CTA. Bu CTA Library'ye yönlendirir,
  operatör reference seçer, A6 modal açılır.
- **A6 "Create Variations" modal**: Reference seçildikten sonra
  açılan modal; modal title "Create Variations" canonical (v4 A6
  spec). Modal'ın primary CTA'sı da "Create Variations" — çünkü
  modal bu aksiyonun **trigger surface**'idir. Modal başlığı
  doğru.
- **Reference card hover CTA**: Phase 5 öncesi `k-btn--primary`
  ile renderlanıyordu; Phase 5'te `k-btn--secondary` indirildi.
  Reference card bağlamında "Create Variations" ikincil
  refinement aksiyonudur, ana üretim aksiyonu değildir.
- **Reference bulk floating bar**: Aynı şekilde primary class
  kaldırıldı, `k-fab__btn` neutral kalır.

#### Kavram 2: Pipeline naming — "MJ/AI" yerine "Auto/Manual"

Phase 4'te eklenen pipeline chip kullanıcı diline altyapı jargonu
("MJ" / "AI") taşıyordu. Phase 5'te ürün diline çevrildi:

- `"midjourney"` pipeline (MIDJOURNEY_BRIDGE — operatör Midjourney
  browser bridge üzerinden üretti) → chip label **`MANUAL`**
- `"ai-variation"` pipeline (GENERATE_VARIATIONS — AI provider
  doğrudan üretti) → chip label **`AUTO`**

Operatör artık altyapı detayı yerine "üretim biçimi" sinyali görür.
`data-pipeline` attribute audit/debug için literal değer korur.

#### Kavram 3: Review gate (CLAUDE.md Madde H reiteration)

Phase 3 `kept-no-selection` Create Selection CTA'sı **yalnız** şu
koşulda görünür:
- `summary.reviewCounts.undecided === 0` AND
- `summary.reviewCounts.kept > 0` AND
- `existingSelectionSet === null`

`undecided > 0` olduğu sürece stage `review-pending` kalır ve
primary CTA "Open Review" olur. Operatör selection creation'ı
review tamamlamadan tetikleyemez. Bu CLAUDE.md Madde H "decision
gate" prensibinin batch detail'deki uygulanışıdır.

#### Kavram 4: Kivasy DS canonical screen hizası

Phase 5 audit'inde mevcut surface'ler v4-v7 canonical screen
ailelerine göre konumlandırıldı:

| Surface | Canonical screen | Hiza durumu |
|---|---|---|
| `/library` (Pool) | v4 A1 LIBRARY | ✓ Aligned — "Start Batch" topbar primary |
| `/batches` | v4 A2 BATCHES INDEX | ✓ Aligned — "Start Batch" + "Retry-failed-only" |
| `/batches/[id]` | v4 A3 BATCH DETAIL | ✓ Aligned + Phase 1-4 enhancements |
| `/review` | v4 A4 BATCH REVIEW STUDIO | ✓ Aligned (review freeze) |
| `/products/[id]` | v4 A5 PRODUCT DETAIL | Aligned (this rollout dışı) |
| A6 Create Variations modal | v4 A6 SPLIT MODAL | ✓ Canonical (modal IS trigger surface) |
| A7 Apply Mockups modal | v4 A7 SPLIT MODAL | Aligned (Phase 3 selection-ready) |
| `/references` (Pool) | v5 B1 REFERENCES | ✓ Aligned + Phase 5 CTA demotion |
| `/selections` | v5 B2 SELECTIONS INDEX | Aligned |
| `/selections/[id]` | v5 B3 SELECTION DETAIL | ✓ Aligned + Phase 1-3 enhancements |
| Settings surfaces | v6 / v7 D screens | Aligned (this rollout dışı) |

#### Değişmeyenler (Phase 5)

- **Review freeze (Madde Z) korunur.** Phase 5 yalnız UI dili +
  CTA emphasis düzeltti.
- **Schema migration yok.** Hiç DB değişikliği yok.
- **Yeni surface açılmadı.** Yalnız mevcut surface'lerde copy /
  className / priority ayarlamaları.
- **WorkflowRun eklenmez** (IA Phase 11 kapsamı).
- **Kivasy DS dışına çıkılmadı.** Tüm değişiklikler mevcut
  recipe'leri (`k-btn--secondary`, `k-fab__btn`, mono caption)
  kullanır.

### Batch-first Phase 6 (2026-05-12 — Production vs refinement axis + canonical tabs)

Phase 5'in kavramsal düzeltmesi (Batch vs Create Variations) daha ince
bir ayrımı netleştirdi: Tek "Create Variations" kavramı içinde **iki
farklı aksiyon ailesi** birlikte yaşıyordu.

#### Production vs Refinement axis

**Ana üretim akışları (production / batch creation):**
- MJ bridge `imagine`, `generate`, `sref`, `oref`, `cref`
  (`MidjourneyJobKind.GENERATE`) — `/imagine` prompt ile tek
  primary üretim aksiyonu
- AI variation pipeline `createVariationJobs` — provider doğrudan
  N variation üretir
- Bunlar **batch creation tetikleyicileri**; ana omurganın başlangıcı

**Yardımcı refinement akışları:**
- MJ `variation subtle` / `variation strong`
  (`MidjourneyJobKind.VARIATION` + V1-V4) — mevcut bir
  MidjourneyAsset üzerinden minor re-generation
- MJ `upscale` (U1-U4) — mevcut bir asset'in çözünürlük artışı
- Bunlar **re-do / refinement / retry aksiyonları**; ana
  batch creation aksiyonu DEĞİL

**v4 A6 "Create Variations" modal** (mevcut `CreateVariationsModal.tsx`)
aslında **subtle/strong refinement modal'ıdır** — POST
`/api/admin/midjourney/variation` çağırır, MidjourneyAsset üzerinden
V1-V4 style minor re-generation tetikler. Phase 6'da modal'a açık
refinement context caption eklendi: operatör bu modal'ı `Start Batch`
ile karıştırmaz.

#### Canonical Start Batch entry point

Tek kullanıcı-facing ana üretim giriş aksiyonu:

```
Batches index topbar
  → "Start Batch" primary CTA (k-btn--primary, Plus icon)
  → /library?intent=start-batch
  → Library reference picker mode (Phase 6 banner)
  → asset card → detail panel
  → "Variations" secondary CTA → A6 modal opens
  → A6 modal: refinement subtitle + subtle/strong selector
  → POST /api/admin/midjourney/variation → batch creation
```

Phase 6 Library intent banner copy "Start Batch · pick a reference
asset" — eski "Create Variations" copy'si kafa karıştırıyordu.

#### Library vs References rol ayrımı

- **`/library` (v4 A1 LIBRARY)** = **ana operasyonel giriş yüzeyi**.
  Asset gallery; "Start Batch" intent banner ile reference picker
  mode'a girilir; primary üretim akışının ana sahnesi.
- **`/references` (v5 B1 REFERENCES)** = **bağlamsal source pool
  yüzeyi**. Pool / Stories / Inbox / Shops / Collections sub-view'lar.
  Reference card hover CTA Phase 5'te `k-btn--secondary` (refinement
  context). Reference page batch creation ana entry'si DEĞİL —
  ana entry Library üzerinden Start Batch'tir.
- Bu ikisi birbirini tekrar etmez: Library "production focus",
  References "source curation focus".

#### Batch detail canonical tab order (v4 A3)

Phase 4'e kadar tab order: `Overview / Items / Logs / Costs` (4 tab).
Canonical v4 A3 spec: `Items / Parameters / Logs / Costs`. Phase 6
hizalama:

- **Order:** `Overview → Items → Parameters → Logs → Costs`
- **Default:** Overview (Phase 1+'de eklendi, kullanıcı bağlamı için
  korunur; canonical'da yok ama scope drift'i kabul edilir).
- **Parameters tab** (placeholder, Phase 6'da eklendi): resolved
  prompt, reference parameters (sref / oref / cref), aspect ratio,
  similarity, quality — read-only snapshot. Wires up sonraki phase'de.

#### Pipeline language karar (MANUAL / AUTO)

Phase 5'te `MJ` / `AI` altyapı jargonu → `MANUAL` / `AUTO` ürün
diline çevrildi. Phase 6 audit'inde alternative naming'ler
(`Browser/API`, `Studio/Auto`, `MJ/AI`) değerlendirildi; `MANUAL/AUTO`
korundu üç sebepten:

1. Operatör altyapı bilgisi (`MJ`, `kie.ai`, vb.) almaz
2. Üretim **biçimi**ne odaklanır: "operator manuel müdahale" vs
   "sistem otomatik"
3. Chip küçük bir audit/debug sinyali; ana akış değil

Tooltip Phase 6'da güçlendirildi:
- `AUTO` → "Auto — generated directly by AI variation provider"
- `MANUAL` → "Manual — operator-driven Midjourney browser flow"

#### Kivasy DS canonical alignment matrix (Phase 6 update)

Phase 5 matrix'ine ek tablo: hangi parçalar **drift**, hangileri
**aligned**:

| Surface | Canonical | Phase 6 durum |
|---|---|---|
| Batches index topbar | v4 A2 (Start Batch primary) | ✓ Aligned |
| Batches index toolbar | v4 A2 (search + status chips) | ✓ Aligned |
| Batches index empty state | v4 A2 | ✓ Phase 6 copy fix |
| Batch detail header | v4 A3 (title + status + actions) | ✓ Aligned + Phase 2-4 |
| Batch detail summary strip | v4 A3 (Reference/Type/Progress/Success/Items) | ✓ Aligned |
| Batch detail tabs | v4 A3 (Items/Parameters/Logs/Costs) | ✓ Phase 6 Parameters tab eklendi |
| Library intent banner | v4 A1 reference picker | ✓ Phase 6 copy fix |
| Library detail panel CTA | v4 A1 (Add to Selection primary, Variations secondary) | ✓ Aligned |
| References card hover CTA | v5 B1 + Phase 5 demotion | ✓ Aligned (refinement bağlamı) |
| A6 Create Variations modal | v4 A6 (refinement trigger) | ✓ Phase 6 subtitle eklendi |

**Drift kalan parçalar** (Phase 6 dışı, sonraya):
- A6 modal reference parameters (sref / oref / cref) — design spec'te
  var, modal'da deferred
- Library bulk bar "Variations" action — rollout-3 deferred
- Batch detail Parameters tab — placeholder (gerçek prompt snapshot
  unified job-stream feed gerektirir)

#### Review gate kontrolü (yeniden onaylandı)

`deriveBatchStage()` mantığı Phase 6 audit'inde teyit edildi:

- `undecided > 0` → `review-pending` (ana CTA "Open Review")
- `undecided = 0` AND `kept > 0` AND `set yok` → `kept-no-selection`
  (ana CTA "Create Selection")
- `undecided = 0` AND `kept = 0` → `no-kept` (ana CTA "New Batch")
- `undecided = 0` AND `kept > 0` AND `set var` → `selection-ready`
  (ana CTA "Continue in Selection")

Operatör review tamamlamadan selection creation tetikleyemez.
CLAUDE.md Madde H decision gate prensibinin batch detail
uygulaması **sağlam**; Phase 6 review gate'e dokunmadı.

#### Değişmeyenler (Phase 6)

- **Review freeze (Madde Z) korunur.** Phase 6 yalnız UI dili,
  CTA emphasis ve tab order düzenledi.
- **Schema migration yok.** Hiç DB değişikliği yok.
- **Yeni surface açılmadı.** Parameters tab placeholder eklendi
  (mevcut tab pattern'i).
- **WorkflowRun eklenmez** (IA Phase 11 kapsamı).
- **Kivasy DS dışına çıkılmadı.** Phase 6 tüm değişiklikler v4
  A2/A3 + v5 B1 canonical screen'lerle hizada.

### Batch-first Phase 7 (2026-05-12 — Provider-first + batch detail content)

Phase 5/6'da "MANUAL/AUTO" dil katmanı operatöre üretim biçimi
sinyali veriyordu; kullanıcı yeni karar verdi: **provider-first dil**.
Ayrıca batch detail tabs (Phase 6'da canonical order) boş kalıyordu —
Phase 7 bu sekmeleri gerçek ürün değerine taşıdı.

#### Provider modeli ürün diline çevrildi

- **Default image provider settings'te yönetilir**: `UserSetting`
  key `aiMode` altında yeni `defaultImageProvider` field
  (enum: `"midjourney" | "kie-gpt-image-1.5" | "kie-z-image"`,
  default: `"midjourney"`). Backwards compat: eski row'lar default'a düşer.
- **Pipeline chip artık "Provider: <name>"** dilini taşır.
  - Pre-Phase 7: `MANUAL` / `AUTO` (Phase 5/6 dili — production *biçimi*)
  - Phase 7: `Provider: Midjourney` / `Provider: Kie · GPT Image 1.5`
    (production *sağlayıcısı*)
  - data-pipeline attribute literal değer korur (audit/debug).
- **`formatProviderLabel(providerId)` helper** (`batches.ts`):
  - `"midjourney"` → "Midjourney"
  - `"kie-gpt-image-1.5"` → "Kie · GPT Image 1.5"
  - `"kie-z-image"` → "Kie · Z-Image"
  - Bilinmeyen id fallback: kendisi (operatöre dürüst).

#### BatchSummary provider-first snapshot

`BatchSummary` type Phase 7'de zenginleştirildi:

```
{
  providerId, providerLabel, capabilityUsed, aspectRatio, quality,
  ...existing fields,
  jobs: BatchJobRow[] // her row'a assetId eklendi (thumbnail)
}
```

**AI variation pipeline (`getAiVariationBatchSummary`):**
- Job.metadata'dan `providerId / aspectRatio / quality / capabilityUsed`
  okur (Phase 7'den itibaren yazılır — `ai-generation.service:189-195`).
- Legacy AI batch'leri (Phase 7 öncesi) için `GeneratedDesign` row'undan
  fallback resolve eder; backwards compat.
- `GeneratedDesign.assetId` her BatchJobRow'a doldurur (Items
  thumbnail grid için).

**MJ pipeline (`getBatchSummary` MJ branch):**
- Provider sabit: `"midjourney"`, label "Midjourney".
- aspectRatio/quality MJ_BRIDGE Job.metadata'sında yazılmadığı için null.
- Her job için MidjourneyAsset.assetId (gridIndex=0 tercih) BatchJobRow
  `assetId`'sine doldurulur.

#### Batch detail Overview tab — production summary

**Eski:** Sadece prompt template + state breakdown (yoğun ama
"şimdi ne yapmalıyım?" sorusuna boş).

**Yeni:** İki katlı yapı:
1. **Production summary card** (provider-first):
   - Provider (label)
   - Reference (clickable back-link)
   - Capability (image-to-image / text-to-image)
   - Aspect ratio · Quality · Items requested
2. **Prompt template** snippet (korundu)
3. **Decision summary** (kept · rejected · undecided — operator gate
   sinyali zaten header CTA'sında ama burada da görünür)
4. **State breakdown** (mevcut, korundu)

#### Batch detail Items tab — thumbnail grid

**Eski:** Tablo (kolonlar: #, Status, Prompt, Variables, Asset count,
Library link). "Thumbnail olmaması ciddi eksik" yorumu doğru.

**Yeni:** **Card grid** (responsive: 2/3/4/5/6 cols viewport'a göre):
- `UserAssetThumb` ile asset render (gridIndex=0 MJ; design.assetId AI)
- Top-left badge: `#{batchIndex}` mono caption
- Top-right badge: state (Succeeded/Queued/Failed tone'lu)
- Footer: prompt preview (line-clamp-2) + asset count + error indicator
- AssetId null ise `Layers` icon placeholder (state durumunu hala
  gösterir)

#### Batch detail Parameters tab — real snapshot

**Eski:** EmptyTabPlaceholder (placeholder string).

**Yeni:** Read-only batch request snapshot — sol kolon Provider card +
Generation parameters card + Reference parameters note (dashed
border, design-only); sağ kolon Prompt snapshot + Retry lineage (varsa).
Tüm değerler BatchSummary'den gerçek read; null ise "—".

#### Tabs vs single-page karar

**Karar: Tabs korundu.** Gerekçe:
- v4 A3 canonical spec tabs ile tasarlanmış (Items/Parameters/Logs/Costs).
- Phase 7'de tab içerikleri gerçek ürün değerine taşındı —
  Overview = "ne oldu", Items = "ne çıktı", Parameters = "hangi
  ayarlar". Sekmeler artık dolu.
- Single-page'e geçmek büyük rewrite + scroll yoğunluğu
  (kullanıcı talimatı: "tabs yapısını hemen atma; önce mevcut yapıyı
  gerçekten doldur").
- Logs ve Costs hala placeholder; unified job-stream feed gelene
  kadar tab placeholder'larıyla işaretli (operatöre dürüst).

#### Settings — defaultImageProvider field

- `UserSetting.value.aiMode.defaultImageProvider` field eklendi
  (Zod default "midjourney")
- `getUserAiModeSettings` + `updateUserAiModeSettings` schema
  güncellendi
- Backwards compat: eski row'lar field'ı taşımıyor; Zod parse
  default'a düşer. Migration yok.
- AI mode form ve A6 modal bu setting'i tüketmek için sonraki phase
  (Phase 7 scope dışı; form hardcoded provider dropdown'u korunur
  — settings field hazır, consumer bağlantısı gelecek faz).

#### Değişmeyenler (Phase 7)

- **Review freeze (Madde Z) korunur.** Phase 7 review modülüne
  dokunmaz.
- **Schema migration yok.** `UserSetting.value` Json field zaten
  esnek; provider snapshot Job.metadata JSON path query.
- **Yeni surface açılmadı.** Mevcut tabs + summary strip + cards.
- **WorkflowRun eklenmez** (IA Phase 11 kapsamı).
- **Kivasy DS dışına çıkılmadı.** Phase 7 tüm değişiklikler v4 A3
  canonical screen'le hizada (summary strip, tabs, card grid).
  Sayfa-spesifik `.k-card` recipe + mono caption pattern korundu.

#### Browser doğrulama disiplini (Phase 7 ders)

Preview tool screenshot'ı küçük render edebiliyor — DOM
verification (eval ile state okuma) + okunabilir screenshot (1280px+
viewport) **kombine** olmalı. Tek başına "screenshot küçüktü → doğrulandı"
demek yetmez; eval ile DOM kanıtı + okunabilir viewport screenshot
birlikte gerekir.

### Batch-first Phase 8 (2026-05-12 — Fit-and-finish: default provider UI wiring)

Phase 8 yeni feature açmadı; **Phase 7'nin yarım kalan UI wiring'ini
tamamladı**. Audit ortaya çıkardı:

**Phase 7'de GERÇEKTEN tamamlanan:**
- Server-side `BatchSummary` provider snapshot (providerId,
  providerLabel, capabilityUsed, aspectRatio, quality)
- Job.metadata yazımı (providerId/aspectRatio/quality/capabilityUsed)
- BatchJobRow.assetId (Items thumbnail)
- `formatProviderLabel` helper
- Provider chip "Provider: <name>" UI
- Overview/Items/Parameters tab content
- `UserSetting.aiMode.defaultImageProvider` schema + service

**Phase 7'de YARIM kalan (Phase 8 fix):**
- `defaultImageProvider` settings field UI consumer'a bağlı **değildi**
- `ai-mode-form.tsx` hala hardcoded `"kie-gpt-image-1.5"` initial state
  kullanıyordu
- `MODELS` array'inde Midjourney **yoktu** — kullanıcı default'u Midjourney
  olarak ayarlasa bile form'da hiç göremiyordu

#### Phase 8 fix — Default provider server-side resolution

```
/references/[id]/variations page (server component)
  → auth() + getUserAiModeSettings(session.user.id)
  → VariationsPage initialProviderId={settings.defaultImageProvider}
  → AiModePanel initialProviderId={...}
  → AiModeForm initialProviderId={...}
  → useState(defaultId) — resolve: settings'ten gelen MODELS'ta varsa
    onu kullan, yoksa ilk available provider'a düş
```

**Sonuç:** Variations sayfası açıldığında Provider dropdown
settings'teki default'u seçili getirir. Batch bazında dropdown
override eder.

#### Phase 8 fix — MODELS list provider-first

Eski:
```
{ id: "kie-gpt-image-1.5", label: "kie-gpt-image-1.5 (image-to-image)" }
{ id: "kie-z-image", label: "kie-z-image (text-to-image) — Yakında" }
```

Yeni:
```
{ id: "midjourney", label: "Midjourney", available: false, helperText: "..." }
{ id: "kie-gpt-image-1.5", label: "Kie · GPT Image 1.5 (image-to-image)", available: true }
{ id: "kie-z-image", label: "Kie · Z-Image (text-to-image) — coming soon", available: false }
```

- **Midjourney** opsiyonu eklendi ama `available: false`. Form'dan
  doğrudan tetiklenmez — MJ bridge ayrı admin akışı kullanır
  (`/api/admin/midjourney/variation`).
- **`helperText`** field'ı: seçili provider available değilse operatöre
  nedenini söyler. Midjourney için: "Midjourney runs through the
  operator browser bridge (separate admin flow). Select a Kie provider
  here to launch from this form."
- Provider-first labels: `Kie · GPT Image 1.5`, `Kie · Z-Image` —
  internal id (`kie-gpt-image-1.5`) yerine kullanıcı-okur etiketler.

#### Phase 8 fix — Provider-aware helper text

`ai-mode-form.tsx` provider dropdown altına `data-testid="ai-mode-provider-helper"`
helper text bloğu eklendi. Seçili provider available değilse görünür;
boş alanları olmayan dürüst UX.

#### Provider-aware form alanları (Phase 8 scope dışı)

Aspect ratio / quality / variation strength gibi alanlar hala
provider-agnostic. Bu fit-and-finish turunda **bilinçli olarak**
düzeltilmedi — yeni big abstraction (`ImageProvider.capabilities`
runtime mapping UI'a) açmak gerekiyor; Phase 9+ scope.

#### Doğrulanan kanıtlar

- `npx tsc --noEmit`: 0 errors
- `vitest`: 90/90 PASS (Phase 1-8 invariants)
- `npm run build`: ✓ Compiled successfully
- Browser DOM eval:
  - `/references/[id]/variations` → AI tab → `data-testid="ai-mode-provider-select"`
  - `selectValue: "midjourney"` (settings'ten gelen default seçili)
  - 3 option: Midjourney (selected, disabled), Kie · GPT Image 1.5
    (available, selectable), Kie · Z-Image (coming soon, disabled)
  - `data-testid="ai-mode-provider-helper"` görünüyor: "Midjourney runs
    through the operator browser bridge..."

#### Kivasy DS drift kapatma (Phase 8 minor)

- Label string'i `"Model"` → `"Provider"` (provider-first dil)
- Helper text mono caption pattern (`text-xs text-text-muted`)
- MODELS label'ları `Kie · GPT Image 1.5` formatına çevrildi —
  `formatProviderLabel` helper ile aynı format

#### Değişmeyenler (Phase 8)

- **Review freeze (Madde Z) korunur.** Phase 8 review modülüne dokunmaz.
- **Schema migration yok.** Yalnız UI consumer wiring + label refactor.
- **Yeni surface açılmadı.** Mevcut variations page + ai-mode-form +
  ai-mode-panel zinciri.
- **Yeni büyük abstraction yok.** ImageProvider.capabilities runtime
  mapping UI'a Phase 9+ scope.
- **WorkflowRun eklenmez** (IA Phase 11 kapsamı).
- **Kivasy DS dışına çıkılmadı.** Var olan `<select>` recipe + mono
  caption pattern.

### Batch-first Phase 9 (2026-05-12 — Polish: provider-aware form + A3 summary reference tile)

Phase 9 fit-and-finish turu. Audit ortaya çıkardı:

**Phase 7+8 sonrası GERÇEKTEN tamam:**
- Server-side BatchSummary + provider snapshot
- Items thumbnail grid (UserAssetThumb)
- Parameters tab gerçek snapshot
- Provider chip "Provider: <name>"
- Settings `defaultImageProvider` + UI consumer wiring
- AI mode form initial provider state settings'ten

**Phase 9'da kalan boşluklar dürüstçe ayırıldı ve düzeltildi:**

#### Provider capability registry (UI-side)

`src/features/variation-generation/provider-capabilities.ts` — yeni
UI-side registry; **yeni büyük abstraction DEĞİL**, mevcut hardcoded
`MODELS` array'i zenginleştiren minimal static metadata.

```typescript
PROVIDER_CAPABILITIES: ReadonlyArray<ProviderCapability> = [
  { id: "midjourney", available: false, supportedAspectRatios: [...], ... },
  { id: "kie-gpt-image-1.5", available: true, supportedAspectRatios: [...], supportedQualities: [...] },
  { id: "kie-z-image", available: false, supportedAspectRatios: [...], supportedQualities: [] },
];
```

- `getProviderCapability(id)` — id'den capability metadata
- `isAspectRatioSupported(id, ratio)` — provider validation
- `resolveDefaultAspectRatio(id, current)` — provider değişikliğinde
  invalid ise destekli ilk değere düşür

Server-side `ImageProvider` interface'i değişmedi — bu UI-side
metadata; client-bundle'a girer.

#### Provider-aware form fields

`ai-mode-form.tsx`:
- Hardcoded `MODELS` array kaldırıldı → `PROVIDER_CAPABILITIES` tek
  doğruluk kaynağı
- Hardcoded `ASPECT_OPTIONS` / `QUALITY_OPTIONS` array'leri kaldırıldı
  → provider'a göre dinamik render
- **Provider değişikliği handler** (`handleProviderChange`): aspect
  ratio invalid ise fallback; quality desteklenmiyorsa eski state
  korunur ama payload'a koyulmaz
- **Quality dropdown disabled** + helper text "Quality parameter is not
  supported by this provider" — Kie · Z-Image için (`supportedQualities: []`)
- **Aspect ratio options filtered** — `CreateVariationsBody.aspectRatio`
  schema sözleşmesi "1:1" | "2:3" | "3:2" korunur; Z-Image kümesi
  (4:3, 16:9, ...) şu an form'dan tetiklenmediği için (available: false)
  contract bozulmaz
- **Submit payload filtering**: provider quality desteklemiyorsa
  `quality` field payload'a koyulmaz (server-side null-safe)

#### A3 canonical summary strip — Reference tile

`BatchDetailClient.tsx` summary strip:
- Eski: `Source` tile (text-only: "template X" / "inline prompt" / "—")
- Yeni: **`Reference` tile** (canonical v4 A3'te de Reference + thumbnail):
  - `UserAssetThumb` (server-side `sourceReference.assetId` projection)
  - Reference label (notes veya fallback `ref_XXXXXXXX`)
  - Clickable link → `/batches?referenceId=...` (Phase 2 back-link
    paritesi)
- **Fallback**: `sourceReference` null ise (legacy batch, retry batch,
  reference soft-deleted) eski `Source` tile gösterilir; kullanıcı
  bilgi kaybetmez
- `data-testid="batch-summary-reference-tile"` test için

Server tarafı: `/batches/[batchId]/page.tsx` artık `Reference.assetId`
projection'a dahil eder.

#### Diğer DS drift kapatmaları

1. **Batches index "0 kept" → "—"**: empty state neutral (sıfır
   sayı vs henüz karar yok ayrımı operatöre yanıltıcıydı)
2. **VariationsPage subtitle batch dili**: "Generate new variants
   from this reference" → "Generate a new batch from this reference.
   Track progress in Batches; decide kept items in Review."
3. **Logs/Costs placeholder copy** operator-friendly:
   - Eski: "Wires up after the unified job-stream feed lands."
     (teknik jargon)
   - Yeni: "Coming soon — batch streaming infrastructure in progress."
     (operatör-dostu)

#### Provider-aware form alanları — deferred Phase 10+

- Count slider provider-specific limits (Midjourney 4-grid)
- Z-Image text-to-image flow (referenceImage zorunlu DEĞİL) UI'a
  yansıtmak
- Aspect ratio kümesi `CreateVariationsBody` schema extension
  (Z-Image için 4:3, 16:9, ...)
- ETA + Operator tile'ları A3 summary strip (yeni DB field + Job
  duration aggregation)

Bunlar **yeni büyük abstraction** veya **schema migration**
gerektirir; Phase 9 fit-and-finish scope dışı.

#### Doğrulanan kanıtlar

- `npx tsc --noEmit`: 0 errors
- `vitest`: 90/90 PASS (Phase 1-9 invariants korundu)
- `npm run build`: ✓ Compiled successfully
- Browser DOM eval + 1280px screenshot:
  - `/references/[id]/variations` AI tab: provider dropdown
    (Midjourney/Kie GPT/Kie Z-Image), aspect ratio dropdown
    Kie GPT için ["1:1","2:3","3:2"], quality dropdown
    ["medium","high"] enabled
  - VariationsPage subtitle: "GENERATE A NEW BATCH FROM THIS
    REFERENCE..." canlı
  - `/batches/[id]` summary strip: Reference tile gerçek MinIO
    thumbnail + reference id link, eski Source tile fallback olarak
    çalışıyor

#### Değişmeyenler (Phase 9)

- **Review freeze (Madde Z) korunur.** Phase 9 review modülüne
  dokunmaz.
- **Schema migration yok.** Yalnız `Reference.assetId` projection
  eklendi (mevcut field).
- **Yeni surface açılmadı.** Var olan summary strip + form alanları.
- **Yeni büyük abstraction yok.** `provider-capabilities.ts` static
  literal registry; UI-side metadata.
- **WorkflowRun eklenmez** (IA Phase 11 kapsamı).
- **Kivasy DS dışına çıkılmadı.** SummaryTile recipe + mono caption +
  k-thumb pattern korundu; A3 canonical hizası güçlendirildi.

### Batch-first Phase 10 (2026-05-12 — Single-branch discipline + UI English standardization polish)

Phase 10 yeni feature açmadı; **branch/worktree disiplinini sabitledi**
ve **Phase 5 İngilizce UI standardı**'na göre kalan Türkçe sızıntıları
düzeltti.

#### Single-branch discipline (kalıcı kural)

Bu turdan itibaren tüm batch-first işleri **tek branch + tek worktree**
üzerinde yapılır:

- **Branch:** `audit/references-production-pipeline`
- **Worktree:** `.claude/worktrees/audit-references`
- **Symlink:** `node_modules` → main repo'nun `node_modules`'una
  (audit worktree'nin kendi node_modules'u yok)
- **Dev server:** Bash-managed external server, audit-references CWD
  (kanıt: `lsof -p $PID -a -d cwd` ile doğrulandı)
- **Quality gates:** typecheck/tests/build hepsi audit-references
  worktree'de **direkt** koşar (önceden main worktree'ye sync gerekiyordu)
- **Cookie-based auth test:** `curl /api/auth/csrf` + credentials POST
  ile session alınır; HTTP-level page render kanıtı (Provider chip
  + Production summary HTML'de görünür)

**Preview tool kısıtı (dürüst rapor):** mcp__Claude_Preview tool
session başlangıç worktree'sini hatırlıyor (epic-agnesi). External
Bash-managed server bu kısıtı bypass eder; `preview_start` çağrılmaz.
Browser doğrulaması curl + HTML inspection ile yapılır; kullanıcı
manuel browser open ile UI'ı test edebilir.

#### Phase 10 polish düzeltmeleri

**1. UI English standardization (CLAUDE.md dil kuralı):**

Phase 5'te kabul edilen ürün UI standardı = sadece İngilizce. Phase 10
ai-mode-form + ai-mode-panel'da kalan Türkçe sızıntıları düzeltti:

- `"AI mode formu"` → `"AI variation form"`
- `"Kalite"` → `"Quality"`
- `"Görsel sayısı:"` → `"Variation count:"`
- `"Style note / ek yönlendirme (opsiyonel)"` → `"Style note (optional)"`
- AI mode panel URL status badges:
  - `"URL yok"` → `"No public URL"`
  - `"Kontrol ediliyor…"` → `"Checking…"`
  - `"Erişilebilir"` → `"Reachable"`
  - `"Erişilemiyor · HTTP …"` → `"Unreachable · HTTP …"`
- StateMessage title'ları:
  - `"Reference yükleniyor…"` → `"Loading reference…"`
  - `"Reference yüklenemedi"` + `"Beklenmeyen hata"` → İngilizce
- No-public-URL açıklama bloğu tam İngilizceye çevrildi (Resolutions
  listesi + Bookmark Inbox CTA)
- ai-mode-form partial notice toast:
  - `"X/Y kuyruk başarısız oldu (Z başarılı). Failed design'ları FAIL
    listesinden tekrar deneyebilirsin."` → İngilizce

**2. Outdated comment fix:**

`references-page.tsx` header comment Phase 5 öncesi `k-btn--primary`
referans ediyordu; Phase 5'te `k-btn--secondary` indirildi (canonical
v5 B1 + Madde V). Comment güncellendi.

#### Doğrulanan kanıtlar (single-branch live server)

External Bash-managed dev server PID 7074, CWD
`.claude/worktrees/audit-references`. Kanıt zinciri:

- `lsof -p 7074 -a -d cwd` → `/audit-references` ✓
- HTTP login: `curl /api/auth/csrf` + credentials POST → session OK
- `curl /api/auth/session` → `{"user":{"id":"cmoqwkfls...","role":"ADMIN"}}`
- `curl /batches/mgge2ao38wx8r81vpmel1pyh` → HTTP 200 + HTML içinde:
  - `data-testid="batch-detail-provider-chip"` ✓
  - `title="Provider: Midjourney"` ✓
  - `data-testid="batch-overview-production-summary"` count 1 ✓
- `curl /batches` → HTTP 200 + `batches-row-review-counts` chips ✓
- `curl /references/<id>/variations` → HTTP 200 + Phase 9 subtitle
  `"Generate a new batch from this reference"` ✓

**Başka branch/worktree'ye kopyalama YAPILMADI.** Phase 10'da hiç
"sync to epic-agnesi" hareketi yok; tüm değişiklikler audit-references
worktree'sinde commit edildi.

#### Değişmeyenler (Phase 10)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Hiç DB değişikliği yok.
- **Yeni surface açılmadı.** Sadece copy/comment polish.
- **Yeni büyük abstraction yok.**
- **WorkflowRun eklenmez** (IA Phase 11).
- **Kivasy DS dışına çıkılmadı.** Sadece UI metni İngilizce
  standardına çekildi.

### Batch-first Phase 11 (2026-05-12 — Logs tab lifecycle timeline)

Phase 11 yalnız **Logs tab**'ını gerçek surface'e dönüştürdü. Yeni
feature veya schema field yok; mevcut `Job` + `MidjourneyJob`
timestamp'lerinden chronological event timeline derliyor.

#### Veri kaynakları (schema-zero)

Phase 11 **hiç yeni schema field eklemedi**. UI Logs tab şu mevcut
DB alanlarından besleniyor:

**Job (her iki pipeline):**
- `status` (QUEUED / RUNNING / SUCCESS / FAILED / CANCELLED)
- `error` (string)
- `retryCount`
- `createdAt` → "queued" event
- `startedAt` → "started" event
- `finishedAt` → "succeeded" / "failed" / "cancelled" event
- `updatedAt` → blocked state fallback timestamp

**MidjourneyJob (sadece MJ pipeline):**
- `submittedAt` → "submitted" event (bridge'e gönderildi)
- `renderedAt` → "rendered" event (MJ render tamamlandı)
- `completedAt` → "completed" event (asset import edildi)
- `failedAt` → "failed" event + `failedReason` / `blockReason`
  detail

**BatchJobRow** Phase 11'de bu alanlarla zenginleştirildi
(`jobStatus`, `jobError`, `retryCount`, `startedAt`, `updatedAt`,
`mjSubmittedAt`, `mjRenderedAt`, `mjCompletedAt`, `mjFailedAt`).

#### Lifecycle event derivation

UI-side `buildLifecycleEvents(job, pipeline)` her job için kronolojik
event listesi derler:

```
queued (Job.createdAt)
  ↓
started (Job.startedAt, varsa)
  ↓
[MJ pipeline only]
submitted (mjSubmittedAt)
  ↓
rendered (mjRenderedAt)
  ↓
completed (mjCompletedAt)
  ↓
[MJ failed yolu]
failed (mjFailedAt + failedReason)
  ↓
[Job terminal — finishedAt + jobStatus]
succeeded / failed (Job.error) / cancelled
  ↓
[fail-safe — block reason var ama mjFailedAt yok]
blocked (Job.updatedAt + blockReason)
```

Events `at` timestamp'iyle ascending sıralanır.

#### UI: `LogsTab` component

`BatchDetailClient.tsx` içinde `LogsTab` + `LogJobRow` + helper
functions (`buildLifecycleEvents`, `jobStatusTone`, `jobStatusLabel`,
`eventKindClass`, `formatEventTime`).

Layout: Her job için **kompakt card** — header (job index +
status badge + retry chip + truncated jobId) + lifecycle timeline
(border-l-line-soft list, her event kind'a göre renkli mono caption +
ISO timestamp + opsiyonel detail). Job failed ise error mesajı ayrı
`bg-danger-soft` block'unda gösterilir (timeline'a karışmaz).

Görsel hiyerarşi:
- **Job-card border**: failed/blocked olunca `border-danger/40`
- **Status badge**: `success` / `danger` / `warning` / `neutral`
  tone'lu (Phase 7 jobStatusTone helper)
- **Event kind**: kendine özel renk (success/danger/warning/neutral) +
  mono caption + min-width 5.5rem (kolon hizası)
- **Retry chip**: `retryCount > 0` ise warning chip + counter
- **Timestamp**: ISO format (`YYYY-MM-DD HH:MM:SS`), `tabular-nums`
  hizalama

`data-testid` attribute'lar (test/automation için):
- `batch-logs` (tab container)
- `batch-logs-job` (her job card, `data-job-id` + `data-status`)
- `batch-logs-events` (timeline list)
- `batch-logs-error` (job error block, varsa)
- `data-event-kind` (her event li'de event türü)

#### Kapsam dışı (bilinçli olarak)

Phase 11'de yapılmadı:
- **Job timeline streaming**: Realtime updates (SSE/polling) — şu an
  static server-render. Polling Phase 12+ scope.
- **Event store table**: `JobEvent` veya benzeri ayrı tablo yok —
  schema-zero korunur.
- **Cost per event**: Costs tab hala placeholder; Phase 12+ scope.
- **Worker bridge errors detail**: `MidjourneyJob.failedReason` /
  `blockReason` truncated görünür; full stack trace yok (audit
  log'da kalır).

#### Kivasy DS hizası

- `Badge` + `border-line` + `bg-paper` + `bg-danger-soft` + mono
  caption pattern korundu (canonical A3/A4 style).
- Empty state dashed border + center text (mevcut `EmptyTabPlaceholder`
  recipe).
- Timeline border-l-line-soft (yeni recipe değil; mevcut `border-line-soft`
  + padding).

#### Doğrulanan kanıtlar

**Single-branch live server (audit-references CWD):**
- `lsof -p $PID -a -d cwd` → audit-references ✓
- `./node_modules/.bin/tsc --noEmit` → 0 errors
- `./node_modules/.bin/vitest run` → 90/90 PASS
- `./node_modules/.bin/next build` → ✓ Compiled successfully
- **Build bundle string verification** (browser eval kısıtı nedeniyle):
  - `batch-logs-job` data-testid build chunk'ta: 1
  - `batch-logs-events` data-testid build chunk'ta: 1
  - "Job lifecycle" caption build chunk'ta: 1
  - Eski Phase 10 placeholder ("Coming soon — batch streaming")
    bundle'da: **0** (kaldırıldı)
- HTTP `/batches/[id]` → 200 + Phase 7+9 attribute'ları HTML'de görünür

**Preview tool kısıtı:** Tab click sonrası DOM kanıtı için browser
tab click gerekli. Phase 10'da kabul edilen kısıt aynı; external
Bash-managed server üzerinden eval/screenshot yapılamıyor. Kullanıcı
browser ile manuel tab click yaparak gerçek DOM kanıtı alabilir.

#### Değişmeyenler (Phase 11)

- **Review freeze (Madde Z) korunur.** Phase 11 review modülüne
  dokunmaz.
- **Schema migration yok.** Yalnız mevcut Job + MidjourneyJob
  field'larından projection eklendi (BatchJobRow extension).
- **Yeni surface açılmadı.** Logs tab mevcut tab pattern'i
  doldurdu; yeni page/modal yok.
- **Yeni büyük abstraction yok.** Lifecycle event derivation
  UI-side static function (`buildLifecycleEvents`); event store /
  schema değil.
- **WorkflowRun eklenmez** (IA Phase 11 kapsamı — bizim Phase 11
  bundan ayrı, naming çakışması yok).
- **Kivasy DS dışına çıkılmadı.** Badge + bg-paper + mono caption +
  border-l-line-soft recipe'leri korundu.

### Epic-agnesi branch notu

`claude/epic-agnesi-7a424b` branch'inde Batch-first Phase 1'in ilk
implementasyonu yanlışlıkla review kapanış branch'ine yazıldı (commit
`f3e3476`). Bu branch artık yalnız review kapanış değişikliklerini içermeli;
batch-first değişiklikler `audit/references-production-pipeline`'da temiz
şekilde yeniden uygulandı. `epic-agnesi` branch'inin batch-first commit'i
bu implementasyon tamamlandıktan sonra silinebilir veya yoksayılabilir.

---

## BB. Runtime Reconciliation Discipline (Phase 12 — 2026-05-12)

**"Code exists" is NOT enough.** Kod-level değişiklik bittiğinde iş bitmiş
sayılmaz; aynı değişiklik **çalışan runtime'da operatörün gözüyle**
görünür olmalı. Phase 1-11 turlarının kapanışında ortaya çıkan güven
problemi (kod var ama preview göstermiyor) bu maddeyi doğurdu.

### Disiplin

Bir feature/refactor "tamam" sayılmadan önce:

1. **Kod**: edit + typecheck + unit test geçti.
2. **Build**: `npm run build` veya equivalent başarılı.
3. **Runtime parity**: Değişiklik **gerçek çalışan dev/preview server'da
   browser kullanıcısı gözüyle** görünür. DOM grep veya bundle string
   araması yardımcıdır, **final kanıt değildir**.
4. **Visual proof**: Ekran görüntüsü veya gerçek DOM inspection — pixel
   boyutları, image natural width, computed style — talep edilen
   davranışın görünür olduğunu kanıtlar.
5. **Honest gap reporting**: Eğer kanıtlanamayan bir parça kaldıysa
   açıkça yaz; "muhtemelen çalışıyor" yerine "şu nedenle browser
   kanıtı alınamadı".

### Worktree / preview tool köşe taşı

Multi-worktree development ortamında runtime parity'nin **en sık
unutulan** kök nedeni:

- Preview tool (örn. `mcp__Claude_Preview`) genelde session-start
  worktree'sini hardcoded path olarak tutar.
- Kod gerçek geliştirme worktree'sinde (örn. `audit-references`)
  yazılır.
- Preview tool eski worktree'yi (örn. `epic-agnesi-7a424b`) servis
  eder ve eski (Phase N-K) kodu gösterir.
- "Kod var ama preview yok" parity gap'i bu yüzden ortaya çıkar.

**Çözüm — bridge launch.json pattern:**

Preview tool'un beklediği session-start path'e (`.claude/worktrees/
<frozen-name>/.claude/launch.json`) yalnızca redirect yapan bir
launch config bırakılır:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "etsyhub-dev",
      "runtimeExecutable": "/bin/bash",
      "runtimeArgs": [
        "-c",
        "cd <absolute-path-to-real-worktree> && exec npm run dev"
      ],
      "port": 3000,
      "autoPort": false
    }
  ]
}
```

Bu pattern:
- Preview tool'un MCP'inde tek bir hardcoded path varsayımını bozmaz.
- Süreç gerçekten **target worktree'nin CWD'sinde** başlar (lsof ile
  doğrulanır).
- Single-branch discipline'i korur — git çalışmaları gerçek worktree'de
  yapılır, bridge worktree yalnız bir launch redirect taşır.

### Browser preview viewport sözleşmesi

Headless browser preview tool'ları default viewport ile 0×0 başlayabilir.
Bu durumda flex/grid layout collapse olur ve thumbnail / kart / grid
"görünmez" sanılır — halbuki kod doğru, **viewport sıfırdır**.

**Kural**: Preview-based visual verification'ın ilk adımı viewport
boyutunu set etmektir. Default: 1440×900 desktop. Visual regression
testleri viewport-aware olmalı.

Pre-flight pattern:

```js
await preview_resize({ width: 1440, height: 900 });
// then inspect DOM, take screenshots, etc.
```

### Visual proof checklist

Yeni feature claim'i için kanıt seti:

1. **DOM presence**: `[data-testid="..."]` query, count, outerHTML.
2. **Layout dimensions**: `offsetWidth`, `offsetHeight`,
   `getBoundingClientRect()`. Pixel düzeyinde sıfır olmamalı.
3. **Image health**: `naturalWidth > 0`, `complete === true`,
   `src` URL signed/valid.
4. **Active state**: tab `aria-selected="true"`, route match
   `location.href`, gerekirse `aria-controls` paneli görünür.
5. **Screenshot**: en az 1280px geniş bir görüntü.

Beşinden biri eksikse "kanıtlandı" denmez — eksik kanıt PR notunda
yazılır.

### Honest placeholder declaration

Bazı surface'ler hâlâ placeholder (örn. Costs tab "Coming soon —
provider usage aggregation lands with the AI Providers pane").
Bu durum:

- UI'da **görünür** placeholder copy ile söylenir; sessiz boş alan
  bırakılmaz.
- CLAUDE.md / docs'ta "henüz implement değil" açıkça yazılır.
- Phase rollout planında kalan iş haritalanır.

Placeholder bir başarısızlık değil; **sessiz** placeholder
başarısızlıktır.

### Seed data parity gap

Bir kod path canonical olarak doğru olsa bile seed data o path'i
egzersiz etmiyorsa runtime parity **görünmez**. Phase 12'de
karşılaşılan örnek: Reference tile + back-link kodu mevcut idi
(`page.tsx` sourceReference projection, `BatchDetailClient` RefTile
component), ama tüm seed MJ batch'ler `Job.metadata.referenceId`
olmadan üretildiği için tile asla render olmuyordu.

**Kural**: Yeni feature için **en az bir** seed senaryosu o path'i
egzersiz etmeli. Eğer mevcut seed bunu kapsamıyorsa, controlled
test seed ile path doğrulanır (Phase 12'de `referenceId` patch ile
Reference tile görünür yapıldı). "Code path var, seed yok → runtime
yok" parity gap'i de bu disipline tabidir.

---

## CC. Costs Tab Surface (Phase 13 — 2026-05-12)

Phase 13 batch detail içindeki son büyük placeholder yüzeyi (`Costs` tab)
gerçek operatör yüzeyine dönüştürdü. Yeni schema, yeni write path,
yeni cost sistemi **eklenmedi** — mevcut `CostUsage.jobId` write'larını
batch scope'una projecte eden bir aggregate helper + UI eklendi.

### Parity sonrası güvenilirlik notu

Phase 12'de kurulan bridge launch.json + parity disiplini bu turda
yeniden kullanıldı:

- Bridge launch.json **kalıcı çözümdür**. epic-agnesi-7a424b path'i
  artık kalıcı bir redirect taşır (`cd audit-references && exec
  npm run dev`). Hangi worktree dosyası editliyorsam preview tool
  o worktree'yi servis eder; "kod var, preview yok" gap'i bu pattern
  ile kapandı.
- Phase 12'deki reference seed patch (`Job.metadata.referenceId`)
  **kalıcı DB değişikliği**; runtime parity için yapıldı, üretim
  data drift değil. Yeni MJ batch'lerinde referenceId metadata'sı
  zaten yazılıyor — eski seed'lerde eksikti, patch ile bir batch
  için backfill edildi.
- Phase 13 Costs seed (`.tmp_seed_cost.mjs`) **yalnız debug
  yardımıydı**; filled-state UI yolunu doğrulamak için 4 CostUsage
  row eklendi, screenshot alındıktan sonra silindi. Production
  state şu an MJ batch için "no recorded provider usage" empty
  state'tedir — ki bu doğru ürün davranışıdır.

### Costs tab veri sözleşmesi

- **Tek veri kaynağı**: `CostUsage` table.
  `track-usage.ts:39` worker'lardan job-attribued row yazıyor;
  `generate-variations.worker.ts:121` (kie midjourney baseline
  24¢/call), review scoring (kie-gemini-flash), vb.
- **Batch scope query**: `getBatchCostBreakdown(jobIds)`
  (`src/server/services/cost/batch-cost-breakdown.ts`).
  Prisma `groupBy(providerKind, providerKey, model)` ile aggregate;
  yeni write path yok.
- **Birim**: cost cent (Int). `formatCostUSD(cents)` UI boyunca
  tutarlı USD format'ı verir (`$0.24`, `$1.92`, `$45.60`).
- **Sıralama**: costCents DESC (en pahalı üstte).
- **Boş query**: jobIds boş ise zero result; UI fallback empty
  state'i render eder.

### Pipeline-aware honest empty state

Empty state copy operatöre teknik jargon değil ürün dili sunar:

- **midjourney** pipeline → "Midjourney batches run through the
  operator browser bridge; provider usage is billed by Midjourney
  directly and isn't recorded here." MJ_BRIDGE worker CostUsage
  yazmaz (operator-driven browser akışı; provider fatura ayrı
  kanaldan); "no charge recorded" doğru ürün davranışı.
- **ai-variation** pipeline → "No provider usage rows for this
  batch yet. Costs land after each variation job completes
  successfully." Failed AI batch'lerde row yok (no charge for
  failure); SUCCESS sonrası 24¢/call yazılır.

Empty state "Coming soon" placeholder DEĞİLDİR; gerçek ürün cevabıdır.

### UI hiyerarşisi

- **Total cost card** (üstte) — k-orange büyük mono sayı, units +
  rows caption, "Estimate, not contractual" disclaimer.
- **Provider breakdown card** (altta) — divide-y list:
  - sol: provider key + model + providerKind chip (AI/SCRAPER/...)
  - sağ: units + cost (mono, tabular-nums)
- Kivasy DS recipe'leri korundu: `k-card`, `bg-paper`, mono tracking-meta,
  `text-k-orange` total, line divider.

### Mixed pipeline ve eksik data dürüstlüğü

- CostUsage row gerçekten yazılmışsa breakdown gösterilir.
- Karışık batch (örn. variation cost + review scoring cost) doğal
  olarak ayrı satırlarda görünür (provider key bazlı grup).
- Yazılmamışsa "no recorded provider usage" + pipeline-spesifik
  sebep gösterilir; sayı uydurulmaz, "$0.00" şeklinde sahte sıfır
  gösterilmez.

### Bilinçli olarak Phase 13 scope dışı

- **Estimated vs actual ayrımı**: `CostUsage.costCents` zaten
  conservative estimate (track-usage.ts:8); ayrı "actual provider
  invoice" alanı yok. Provider invoice reconciliation ayrı bir
  sistem (out-of-scope).
- **Item-level cost breakdown**: Şu an provider × model boyutunda
  aggregate. Item-level (her job'un kendi cost'u) için yeni UI
  iterasyonu gerekir; current surface "batch toplamı + provider
  breakdown" sorusuna cevap verir.
- **Cost trend / sparkline**: zaman serisi UI gerekirse ayrı bir
  pane (Cost analytics) konusu.
- **MJ bridge cost tracking**: provider fatura ayrı kanaldan
  geldiği için worker write yok. İleride Midjourney fatura
  reconciliation eklenirse aynı CostUsage table'a yazılır;
  bu UI değişiklik yapmadan tutar.

---

## DD. Selection → Product Handoff & Product Detail (Phase 14 — 2026-05-12)

Phase 14 Selection → Product hattını **ürün yüzeyi olarak** netleştirdi.
Yeni feature alanı, yeni schema, yeni "Product" modeli açılmadı —
mevcut Selection → Mockup Apply → Listing zinciri üzerine handoff dili
ve Product detail canonical summary strip eklendi.

### Audit bulguları

**Selection → Product handoff doğal zincir aşağıdaki gibi (değişmedi):**

```
SelectionSet  →  Mockup Apply  →  MockupJob result
               (operator click)    "Listing'e gönder" CTA
                                    │
                                    ▼
                                  Listing  →  /products/[id]
                                  (DB row;     (UI brand:
                                  schema-      Product)
                                  zero — yeni
                                  "Product"
                                  modeli yok)
```

Yani **Product = Listing**. UI'da "Product" branding'i kullanılır, DB'de
`Listing` tablosu yaşar. Doğrudan Selection → Product CTA'sı YOK; mockup
apply zorunlu ara durak. Bu ürün kararı korundu (Mockup → Listing zinciri
selection finalize sonrası gerekli).

**Product detail mevcut olgunluğu (pre-Phase 14):**

4 tab canonical (A5 spec): Mockups · Listing · Files · History. Header'da
arrow back · title · stage badge · Etsy chip · Duplicate (disabled) ·
Preview (disabled) · "Send to Etsy as Draft" CTA. ListingTab tam
fonksiyonel (title, description, 13 tags, category, price, materials,
file types, instant download). FilesTab gerçek deliverable tablosu.
HistoryTab timeline.

### Phase 14 ürün düzeltmeleri

**Selection handoff (StudioShell):**

- Read-only banner copy TR → EN; internal phase etiketi ("Phase 8")
  operatör UI'ından kaldırıldı. Yeni copy: "Selection finalized — next
  step is applying mockups to prepare a product listing." CTA: "Apply
  mockups →" (önceki: "Mockup Studio'da Aç →").
- Üst bar "Set'i finalize et" → "Finalize selection". Subtitle "varyant ·
  seçili" → "variant(s) · selected". Finalize tooltip "En az 1 'Seçime
  ekle' yapılmış varyant gerekli" → "Mark at least 1 variant as selected
  before finalizing".
- data-testid: `selection-handoff-banner`, `selection-handoff-apply-mockups`
  (sonraki turlarda regression testleri için).
- Error block TR ("Bilinmeyen hata", "Product yüklenemedi") → EN
  ("Unknown error", "Product failed to load").

**Product detail canonical summary strip (A5/B4 alignment):**

Header altında 5 muted tile, batch detail overview-production-summary
ile parity. Operatör tek bakışta cevap alır: "ne için product var,
nereden geldi, ne kadar hazır?". Tile'lar:

1. **Source selection** — `useProductSourceSelection(productId)` hook
   `/api/products/[id]/source-selection` üzerinden listing.mockupJobId →
   MockupJob.setId → SelectionSet zincirini izler. Tile back-link
   olarak `/selections/[setId]`'e çıkar (ArrowUpRight glyph). null →
   "—" fallback.
2. **Mockups** — `listing.imageOrder.length` mono numeric.
3. **Files** — aynı sayı (deliverable count); file types tab'ta detay.
4. **Listing health** — `listingHealthScore(listing.readiness)`
   threshold-aware ton: ≥80 success, ≥50 k-amber, <50 ink-3.
5. **Next step** — stage'e göre operatöre tek-cümle sıradaki aksiyon
   ("Apply mockups", "Review listing → send to Etsy", "Scheduled for
   Etsy", "Track on Etsy", "Resolve failure on Listing tab").

Tile pattern Kivasy DS A5 / batch detail summary strip ile uyumlu:
`bg-paper`, font-mono `text-[10.5px] uppercase tracking-meta` label,
body value tabular-nums.

### Kivasy DS referansları

- `docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a5.jsx` — Product
  detail (4 tabs, header, listing health sidebar).
- `docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b2-b3.jsx` —
  Selection index card stages (Curating/Edits/Mockup ready/Sent) ve
  "Apply Mockups" primary CTA.
- `docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b4.jsx` — Products
  index table + retry/Etsy chip pattern.
- `docs/design-system/kivasy/ui_kits/kivasy/v4/base.jsx` — Tabs, Badge,
  Btn recipe'leri (zaten kullanımda).

### Bilinçli olarak Phase 14 scope dışı kalan drift

Bu tur "küçük ama kritik düzeltmeler" scope'unda kaldı. Aşağıdaki TR
drift'ler **intra-surface** (handoff touchpoint değil) olduğu için
sonraki turlara bırakıldı:

- `StudioShell` RightPanel: "Edit", "AI KALİTE", "HIZLI İŞLEM", "İŞLEM
  GEÇMİŞİ", "Background remove", "Magic Eraser", "Upscale 2× YAKINDA",
  "Transparent PNG kontrolü", quick-actions panel.
- `Filmstrip` empty states: "Reddedilen varyant yok", "Henüz varyant
  yok", "Varyantlar (N)".
- `PreviewCard` placeholder + "Varyant N / M" badge (kullanıcı UI
  içinde görülür — string mixed).
- `BulkHardDeleteDialog` confirmation copy.
- `SelectionBulkBar` "N varyant seçildi" toast.
- `AiQualityPanel` "Bu varyant için AI kalite analizi yapılmamış".
- `MjOriginBar` (Pass 91) handoff bar TR caption.
- `Product detail Listing tab` RIGHT RAIL Listing Health item labels:
  "Title hazır (N karakter)", "Açıklama hazır", "13 tag (maksimum 13)",
  "Kategori seçimi geçerli", "Fiyat geçerlilik", "Kapak görseli hazır
  (Pass'le wall_art QA template)".
- `MockupsTab` / `FilesTab` / `HistoryTab` internal TR strings (audit
  edilmedi).

Bu drift'leri kapatmak ayrı bir "i18n cleanup" turunun konusudur. Bir
i18n katmanı (`@/lib/i18n` veya next-intl) açılırsa hepsi tek pasta
olarak migrate edilir; tek tek string replace turu verimsiz olur.

### Selection → Product handoff sözleşmesi (kalıcı)

- Selection canonical detail = `/selection/sets/[setId]` (StudioShell).
- Read-only banner finalized status'te görünür (status === "ready").
- Tek primary CTA: "Apply mockups →" → `/selection/sets/[setId]/
  mockup/apply`.
- Mockup apply başarılı olduğunda S8ResultView "Listing'e gönder" CTA
  ile `createListingDraftFromMockupJob` → `/products/[id]` redirect.
- `/products/[id]` server-rendered, `ProductDetailClient` hydrates;
  source selection back-link summary strip ile görünür.
- Product detail kendisi yeni mockup uygulayabilir (Mockups tab swap UI)
  ama Selection edit'i yapamaz; SelectionSet finalize sonrası
  immutable (Phase 7 Task 35 invariant).

---

## EE. Visible UI Language Parity (Phase 15 — 2026-05-12)

Phase 15, Selection + Product yüzeylerinde **operatöre görünür** TR/EN
karışıklığını sıfıra indiren bir **surface cleanup** turuydu. Yeni
i18n framework açılmadı; mevcut hardcoded string'ler tek tek EN'e
geçirildi.

### Audit kapsamı

10 dosya, ~70 görünür operator-facing TR string'i:

- `src/features/selection/components/`
  - StudioShell.tsx (Phase 14'te kısmen) — error/loading state TR temizlendi
  - RightPanel.tsx — Edit / Editing variant / No variant selected /
    Pick a variant from the filmstrip / Reject / Add to selection /
    Remove from selection / Undo reject
  - AiQualityPanel.tsx — AI quality / Resolution / Clean / Flagged /
    Rejected / Pending / Send for review / No AI analysis…
  - QuickActions.tsx — Quick actions / Magic Eraser / Crop · aspect
    ratio / Transparent PNG check / Selection finalized — editing
    disabled / Another action is in progress / Coming soon / Loading
  - UndoResetBar.tsx — Action history / Undo last action / Revert to
    original / Nothing to undo / No edits / No edits yet / older
    actions / Transparent check / "just now" / "Nm ago" / "Nh ago" /
    "Nd ago"
  - Filmstrip.tsx — All / Active / Rejected / Variants (N) /
    Variants (M / N) / No rejected variants / No variants match this
    filter / aria-labels "Variant NN (selected)" / "(rejected)" /
    "(edited)" / thumbnail alt
  - PreviewCard.tsx — Variant NN / NN / Variant NN — original /
    Edited / Original / Previous / Next / No variants yet / Show
    edited or original image
  - SelectionBulkBar.tsx — variant(s) selected / Reject (N) / Add to
    selection (N) / Permanently remove (N) / Bulk action failed
  - BulkHardDeleteDialog.tsx — Permanently remove / N rejected
    variants will be permanently removed / Cancel
  - FinalizeModal.tsx — Finalize selection / The set will be marked
    ready for Mockup Studio / Pending / Rejected / Only selected
    variants become the Mockup Studio input / Cancel / Finalize /
    Finalizing… / At least 1 variant must be marked 'Add to
    selection'
  - ArchiveAction.tsx — Set options / Set options menu / Archive set /
    Archived sets are hidden from the main /selection list / Archive
    / Cancel
  - ExportButton.tsx — The set must contain at least 1 variant /
    Preparing export… / Download / Previous download link expired —
    prepare again / Export failed
  - MjOriginBar.tsx — relative time EN ("just now" / "Nm ago" / etc.)

- `src/features/listings/` (Product/Listing visible)
  - server/readiness.service.ts — Right-rail check labels: Title
    ready (N chars) / Description ready / N tags (max N) / Category
    selected / Price: $N.NN / Cover image ready / "required" /
    "too short" / "too long" / "too low" / "Policy warning"
  - ui/status-labels.ts — Draft / Scheduled / Published / Failed /
    Rejected / Needs review
  - ui/ListingDraftView.tsx — Loading listing… / Failed to load
    listing / Untitled / Readiness checks / passed / warning
  - components/MetadataSection.tsx — Title & Description / Title /
    Description / Tags (max 13) / "Comma-separated tags…" / "AI
    suggestion applied to the form…" / Save / Saving… / Generate
    with AI / Generating…
  - components/PricingSection.tsx — Price & Materials / Price (USD) /
    Etsy sale price (excluding discounts and taxes) / Save / Saving…
  - components/AssetSection.tsx — Images & Files / Download ZIP /
    Cover image / No image / Ready for ZIP / Waiting for all images
    to upload
  - components/SubmitResultPanel.tsx — Image upload: N/M succeeded
    (M failed) / Show details / Hide details / Some readiness checks
    are missing / Sent to Etsy / Open on Etsy / Go to shop / Submit
    draft / Submitting… / Submission failed / Note: … / Previous
    submission failed / Reset to DRAFT / Resetting… / Open orphan on
    Etsy / Reset failed / Etsy draft created
  - components/ListingsIndexView.tsx — Listings / All / Draft /
    Published / Failed / Loading… / Failed to load listings / No
    listings yet / No listings in {Status} status / Untitled draft /
    Listing cards / Updated: {date(en-US)} / Open on Etsy / No
    preview

- `src/features/mockups/components/`
  - SetSummaryCard.tsx — Set summary / Draft / Ready / Archived / N
    designs selected / Quick pack / Custom selection
  - PackPreviewCard.tsx — Pack preview / ★ Quick pack / Custom pack /
    N images to render / Customized / "Different from the default
    Quick pack"
  - DecisionBand.tsx — Render (Quick pack) / Render (Custom pack) /
    Reset to Quick pack / Estimated time
  - S3ApplyView.tsx — Loading… / Set not found.

### Sözleşmeyi yeniden teyit

- **Tek dil**: UI'da görünür her metin **İngilizce**. TR sadece
  operator-girdi-veri (örn. reference label "Smoke Aşama 2A reference")
  alanlarında kalır — bu kullanıcının kendi yazdığı içeriktir, UI
  string değil.
- **Yeni i18n framework AÇILMADI**: `@/lib/i18n` veya next-intl
  eklenmedi. Bu turun amacı parity, framework değil.
- **Code comments TR bırakıldı**: doc comment blokları, JSDoc, inline
  açıklamalar (// veya /* */ içinde) TR kalabilir — CLAUDE.md "kod,
  dosya adları, teknik terimler İngilizce kalır; comments TR can stay"
  sözleşmesine bağlıdır. Yalnız operator-görünür string'ler EN.

### Test fixtures TR → EN

UI string'leri EN'e geçince testler de güncellendi (~10 test
dosyası): selection (ai-quality-panel, archive-action, bulk-hard-
delete-dialog, export-button, filmstrip, finalize-modal, preview-
card, quick-actions, right-panel, selection-bulk-bar, studio-shell,
undo-reset-bar), listings (ListingDraftView, ListingsIndexView,
MetadataSection, PricingSection, SubmitResultPanel, AssetSection,
readiness.test), mockup (S3ApplyView, SetSummaryCard, PackPreviewCard,
DecisionBand). Targeted testler tüm dosyalarda PASS.

### Bilinçli scope dışı

Bu tur Selection + Product visible yüzeyle sınırlandırıldı (user
talimatı: "scope'u Selection + Product hattında tut"). Aşağıdaki
diğer modüllerin TR drift audit'i bu turda **yapılmadı**:

- Reference / Bookmark / Story / Competitor surfaces
- Batch detail comments + audit messages
- Admin / Settings surfaces
- Job lifecycle / SSE notifications
- Mockup orchestration internals (S5/S6/S7 views — Phase 15
  S3ApplyView + DecisionBand + PackPreviewCard + SetSummaryCard kapatıldı)

Bunlar ileride bir **i18n katmanı** açılırsa tek pasta migrate
edilir; o güne kadar bu yüzeylerde TR sızıntı kalabilir.

### Doğrulama kanıtları

- Selection studio `/selection/sets/cmordz90j001buuvcgsceygvy` —
  DOM scan: **0 TR string** in operator-facing UI.
- Product detail `/products/cmort0m2t0044udcxco3xrl14` — DOM scan:
  **0 TR string**.
- Batch detail `/batches/mgge2ao38wx8r81vpmel1pyh` — DOM scan: **1 TR
  line** ("Smoke Aşama 2A reference" — operator-entered reference
  label, not UI string).

Quality gates:
- `tsc --noEmit`: clean
- `vitest tests/unit/selection tests/unit/listings tests/unit/mockup
  tests/unit/products tests/integration/listing tests/integration/
  products`: all PASS
- `next build`: ✓ Compiled successfully

---

## FF. Products Index — B4 Canonical Hizası (Phase 16 — 2026-05-12)

Phase 16, `/products` index yüzeyini Kivasy DS v5 B4 canonical
çizgisine hizalayan **küçük ama kritik düzeltmeler** turuydu. Yeni
ürün modeli, yeni feature alanı veya schema migration AÇILMADI;
mevcut Listing model'i üzerine B4 spec'in eksik bilgi mimarisi
parçaları eklendi.

### `/products` rolü ürün omurgasında

```
Reference → Batch → Review → Selection → Product
                                            │
                                            ▼
                                       /products
                                       (B4 index)
                                            │
                                            ▼
                                       /products/[id]
                                       (A5 detail)
```

- **Surface tipi**: tarayıcı liste yüzeyi (dense/comfortable density,
  search, filter chips, sortable header pattern).
- **Operatör sorusu**: "Hangi product hangi stage'de? Ne hazır, ne
  eksik, ne gönderilmiş?"
- **Detail entry**: row click → `/products/[id]`; title link explicit;
  hover chevron.
- **External link entry**: Etsy chip → Etsy admin listing editor.
- **Cross-link entry**: `?fromSelection=setId` query param subtitle
  filter banner.

### Audit bulguları (pre-Phase 16)

`/products` aslında **fairly mature** idi:
- ProductIndexRow type + signed thumb URL pipeline + health scoring
  zaten kurulu.
- 7 column table (thumb / product / files / health / status / updated /
  chevron).
- Search + Status chip cycle + density toggle + "of N" row counter.
- Empty/loading/error states.
- EN parity (Phase 15 carry).

**Eksik olan B4 canonical alignment'lar:**
1. **Type column yok** — Listing.productTypeId mevcut ama UI'da hiç
   görünmüyor; operatör ürün tipini ancak title'dan tahmin ediyor.
2. **Type filter chip yok** — B4 Status/Type/Date chip üçlüsünden
   sadece Status var.
3. **Subtitle phrasing drift** — B4: "{N} PRODUCTS · {M} SENT THIS
   WEEK" (kadans sinyali); current: "{N} PRODUCTS · {M} SENT TO ETSY"
   (kümülatif, daha az aksiyon yönlendirici).
4. **Search scope drift** — B4 "name, type, draft id"; current "title,
   id, draft id" (type aranamıyor).
5. **Pluralization yoktu** — "1 PRODUCTS" durumu.

### Phase 16 düzeltmeleri

**Server (index-view.ts)**:
- `ProductIndexRow` type'a `productTypeKey` + `productTypeLabel`
  alanları eklendi (Listing → ProductType.displayName join).
- `findMany` query `productType` ilişkisini include eder
  (`{ key, displayName }` select).
- Yeni model/migration yok; mevcut Listing.productTypeId field'ı
  zaten vardı, sadece UI'a kadar yüzeye çıkarıldı.

**Client (ProductsIndexClient.tsx)**:
- **Type column** (w-28, neutral badge with `productType.displayName`)
  Title ile Files arasına eklendi. Null type → "—" muted dash.
- **Type filter chip** (Status chip'in sağında) — caret cycle pattern.
  Pool data'dan dinamik (`typeKeysInUse = unique productTypeKeys`).
  Hiç type yoksa chip render edilmez (boş chip operatörü yanıltmaz).
- **`?type=<key>` URL param** ile filter persist; same pattern as
  `?stage=...`.
- **Subtitle**: "{N} PRODUCTS · {M} SENT THIS WEEK" — week = last 7
  days (now - 7×24×60×60×1000 ms) AND stage=Sent. Pluralize
  `PRODUCT`/`PRODUCTS`.
- **Search placeholder** B4 spec'e hizalandı:
  "Search products by name, type, draft id…"
- **Search predicate** type label'ı haystack'e ekledi (operatör
  productType adı yazarak filtreleyebilir).

**Test surfaces**: `data-testid="products-filter-stage"`,
`data-testid="products-filter-type"`, `data-testid="products-row-type"`
geleceği için stable selectors.

### Operatör için ne değişti

Önce:
- "Hangi ürün hangi tip?" → Title okumadan bilinmiyordu (e.g.,
  "Modern Abstract Wall Art Print Set Boho" ≠ certain product type).
- Bütün ürün tipleri arasında filtreleme yok → büyük catalog'lar
  zorlaşıyor.
- Subtitle "{N} SENT TO ETSY" → ne kadar aktif gönderim ritmi var
  bilinmiyor.

Sonra:
- Her satırda Type badge — operatör Sticker/Printable/Wall Art/etc.
  ürün ailesini görsel olarak tarar.
- Type chip — tek ailenin işlerine odaklan ("yalnız Sticker'larım").
- "SENT THIS WEEK" — operasyonel kadans sinyali; haftalık ritim
  görünür.
- "1 PRODUCT" vs "3 PRODUCTS" — count semantics dürüstçe pluralize.

### B4 canonical hizası — completed vs deferred

**Tamamlandı (Phase 16)**:
- Type column (w-28 neutral badge) ✓
- Type filter chip (caret cycle) ✓
- Subtitle "SENT THIS WEEK" + pluralize ✓
- Search placeholder + scope ✓
- Row counter "{N} of M" (zaten vardı) ✓
- 8-column table layout (thumb/product/type/files/health/status/
  updated/chevron) ✓
- Stage badge dot ✓
- Etsy chip (warm bg + deep-link) ✓
- Health bar + threshold colors ✓
- Retry button (Failed stage) ✓
- Hover chevron ✓
- Density toggle ✓
- 4-up thumb composite ✓

**Bilinçli deferred (B4 spec'te var, bu turda yapılmadı)**:
- **Date filter chip** — B4'ün üçüncü chip'i (Status/Type/**Date**).
  Date filter pool için bir URL state + relative time predicate
  gerekli. Bu turda scope dışı; operatör updated time'ı görsel olarak
  tarayarak halletmiyor değil (4 rows için).
- **"Saved views" secondary button** — B4 header'da Status/Type/Date
  kombinasyonlarını kaydetmek için secondary CTA. Bu storage layer
  açılmasını gerektirir; küçük cleanup değil.
- **Failure message line below status badge** — B4 spec'te Failed
  state için badge altında "Etsy API timeout · 3 retries" tarzı kısa
  açıklama. Current sadece Retry button gösteriyor. Listing.
  failedReason field'ı mevcut; sonraki tur bunu badge altına
  taşıyabilir.

### EN parity (Phase 15 carry)

- `/products` DOM scan: **0 TR strings** (operatör-görünür UI).
- "just now / Nm ago / Nh ago / Nd ago" relative time formatter EN.
- Subtitle, search placeholder, header CTA tooltip, empty state copy,
  filter chip labels, badge tone labels (Draft / Mockup ready / Sent /
  Failed / Etsy-bound) tümü EN.
- Phase 15 sözleşmesi korundu.

---

## GG. Products Index — Final B4 Polish (Phase 17 — 2026-05-12)

Phase 17, Phase 16'da bilinçli deferred edilmiş B4 canonical son
parçalarını kapatan polish turuydu. Schema migration veya yeni feature
alanı AÇILMADI; mevcut `Listing.failedReason` field'ı UI'a kadar
yüzeye çıkarıldı + relative date filter chip eklendi.

### Pre-Phase 17 deferred listesi

1. **Date filter chip** — B4 Status/Type/**Date** chip üçlüsünün
   üçüncüsü eksikti. Operatör updated time'ı sadece görsel olarak
   tarayabiliyordu.
2. **Failure detail line** — Failed stage row'unda sadece Retry button
   görünüyordu, neden fail olduğu görünmüyordu. `Listing.failedReason`
   field'ı DB'de mevcuttu ama UI'a yansımıyordu.
3. **Saved views** — B4 spec'te secondary "Saved views" button mevcut;
   storage layer açılması gerektiği için Phase 17'de de **deferred**
   tutuldu (rationale aşağıda).

### Date filter chip

`ProductsIndexClient.tsx`:

- 4 relative bucket: `today / 7d / 30d / all` (absolute date picker bu
  turda kapsam dışı — date-range UI ağır + state karmaşık).
- URL param: `?date=today` / `?date=7d` / `?date=30d` (default "all" →
  param yok). Bookmark/share edilebilir.
- Cycle pattern: same as Status/Type — `cycleDate()` handler URL
  param'ı next bucket'a günceller.
- Filter predicate: `dateBucketCutoffMs(bucket)` → `updatedAt >=
  cutoff`. null cutoff → no filter.
- Label map (`DATE_BUCKET_LABEL`):
  - `all` → "Date" (default label, chip muted)
  - `today` → "Today" (chip active orange-soft)
  - `7d` → "Last 7 days"
  - `30d` → "Last 30 days"

### Failure detail line

`ProductIndexRow` extended:
- `failedReason: string | null` field eklendi (server resolves from
  `Listing.failedReason`).

UI render (Status TD):
- Status badge + Etsy chip + Retry button **bir satır** (flex row).
- Altında **eğer ve sadece eğer** `stage === "Failed" && failedReason`
  → kırmızı mono micro-copy line görünür.
- Style: `font-mono text-[10px] tracking-wider text-k-red truncate`.
- `title={failedReason}` attribute → full text tooltip (truncate
  sonrası uzun reason'ları hover'da görür).
- `data-testid="products-row-failure"` regression test surface'i.

Honest fallback: `failedReason` null veya boş ise satır render
edilmez (sahte caption üretmiyoruz; CLAUDE.md "no silent magic"
sözleşmesi).

### Saved views — bilinçli ertelendi

B4 spec'te `<Btn variant="secondary">Saved views</Btn>` secondary
header CTA var. Phase 17'de **uygulanmadı**, sebep:

**Storage gereksinim — küçük ama risksiz değil:**

Saved view'lar şu state'i taşır: `keyword + stage + type + date`
4-tuple → kullanıcı tanımlı label ("My drafts this week", "Etsy
failed last 30d", vb.). Storage seçenekleri:

1. **localStorage** — kullanıcı bazında, taşınmaz, multi-device sync
   yok. Yeterli görünüyor ama Kivasy ürün omurgası "self-managed
   desktop product" hedefiyle multi-machine sync ileride sorun olur.
2. **UserSetting key** — `userSetting.products.savedViews` JSON array.
   Bu canonical yol, ama:
   - Schema-zero korunsa da yeni setting key'i admin paneline
     gelmesi gerekir (CLAUDE.md "no hidden behavior" sözleşmesi —
     operatör/admin tüm settings'i görür).
   - CRUD API endpoint + mutation hook + UI (rename, delete, set
     active) gerekir → yeni feature alanı.
3. **Dedicated `SavedView` model** — ileride paylaşılır views
   (admin → user push) gerekirse. Phase 17 scope dışı.

Phase 17 user talimatı: "yeni storage sistemi, yeni preference
sistemi, yeni saved-view framework'ü açma". O yüzden Phase 17'de
şunlar dürüstçe yapıldı: 4 filter (search + stage + type + date)
URL param'da persist edilir → kullanıcı browser bookmark ile "saved
view eşdeğeri" elde eder. Bu yeterli mi?

- **Çoğu kullanım için: evet.** Browser bookmark UI + URL share
  zaten "saved view" deneyiminin %80'ini verir.
- **Yetersiz olduğu durum**: kullanıcı isim-etiketli view'lar görmek
  ve hızlı toggle yapmak istiyor. Bu **nice-to-have**, mevcut yapı
  blocker değil.

Eğer ileride saved views eklenirse: `UserSetting.products.savedViews`
JSON array, admin panel'de görünür, CRUD API minimal. Bu Phase 18+
konusudur.

### Operatör için ne değişti

| Önceden | Şimdi |
|---|---|
| "Bu hafta neler değişti?" → görsel tarama + tahmin | Date chip "Last 7 days" → 1 click |
| Failed row → "neden fail oldu?" → detail'e gir | Failed row → kırmızı micro-copy satır anında okunur |
| Status/Type chip'leri vardı | Status/Type/**Date** triplet tamam |
| Saved views yoktu | Filter kombinasyonu URL'de → browser bookmark eşdeğer |

### EN parity (Phase 15 carry)

- Date chip labels: "Date" / "Today" / "Last 7 days" / "Last 30 days"
  (tümü EN)
- Failure micro-copy: server-side `Listing.failedReason` field'ı —
  submit pipeline EN error message'ları yazar (Etsy API error
  strings, "Submission failed: ...", vb.). Operator-girdi-veri değil,
  server message; Phase 15 sözleşmesi: server hata mesajları zaten
  EN baseline'a hizalı.
- DOM scan `/products`: **0 TR strings**.

### B4 alignment final durumu

| B4 element | Status |
|---|---|
| Title + uppercase subtitle | ✓ |
| Sent this week kadans phrasing | ✓ |
| Pluralization | ✓ |
| Search placeholder (name, type, draft id) | ✓ |
| Status filter chip | ✓ |
| Type filter chip | ✓ |
| **Date filter chip** | ✓ (Phase 17) |
| Row counter "N of M" | ✓ |
| Density toggle | ✓ |
| 8-column table | ✓ |
| Thumbnail 4-up composite | ✓ |
| Product title + id mono caption | ✓ |
| Type neutral badge column | ✓ |
| Files mono numeric | ✓ |
| Health bar + threshold colors | ✓ |
| Stage badge with dot | ✓ |
| Etsy chip (warm bg, deep-link) | ✓ |
| Retry button (Failed stage) | ✓ |
| **Failure micro-copy below badge** | ✓ (Phase 17) |
| Updated relative time | ✓ |
| Hover chevron | ✓ |
| Empty state | ✓ |
| Saved views secondary CTA | **Deferred** (rationale ↑) |

20/21 B4 element complete. Saved views yalnız scope-dışı kaldı; URL
param-based filter persistence operatöre eşdeğer pratik deneyim
sunuyor.

---

## HH. Browse/List Surfaces — Visible Parity + IA Cleanup (Phase 18 — 2026-05-12)

Phase 15 i18n cleanup'ı Selection + Product hattını kapsamıştı; Phase
18 bu hattın **dışında kalan** browse/list yüzeylerinde aynı parity'yi
sağladı. Yeni i18n framework AÇILMADI; mevcut hardcoded string'ler
tek tek EN'e geçirildi + bir IA wording düzeltmesi yapıldı.

### Surface audit özeti (pre-Phase 18)

| Surface | Operatör readiness | Görünür TR |
|---|---|---|
| `/references` (Pool) | 75% — fairly mature, B1 spec'e büyük ölçüde uygun | reference-card.tsx 5 string |
| `/bookmarks` (Inbox) | 70% — status/action label mismatch | bookmarks-page + 2 dialog |
| `/competitors` (Shops) | 60% — detail pattern undefined | 4 component visible TR |
| `/trend-stories` (Stories) | feature-gated; partial | 6 component visible TR |
| `/library` | 85% canonical (Phase 17 patterns); ✓ | 0 (✓) |

### Surface-by-surface değişiklikler

**`/references` — reference-card.tsx**:
- "Referans" → "Reference" (fallback title)
- "Görsel yok" → "No image"
- aria-label "Seç" → "Select"
- "Koleksiyon yok" → "No collection"
- **IA wording fix**: "Üret" → **"Open workshop"** + title attribute EN.
  Phase 5 conceptual shift'i ("Create Variations" = refinement, primary
  batch creation Batches index'inde) artık card-level entry'de net.
  Title tooltip: "Open the production workshop (pick from your local
  library or generate new AI variations)".
- "Arşivle" → "Archive"
- `toLocaleDateString("tr-TR")` → `toLocaleDateString("en-US")`

**`/bookmarks` — bookmarks-page.tsx + dialogs**:
- 4 error toast EN: Failed to load list / Archive failed / Update
  failed / Move to reference failed
- "N bookmark seçildi" → "N bookmark(s) selected"
- "Arşivle" → "Archive"
- "Referansa taşı" → "Move to reference" (button + dialog title)
- PromoteDialog: "Kapat" → "Close", "Vazgeç" → "Cancel",
  "Taşınıyor…" → "Moving…"
- upload-image-dialog: "Görsel yükle" → "Upload image",
  "Başlık (opsiyonel)" → "Title (optional)",
  "Yükle ve Bookmark Yap" → "Upload & bookmark",
  4 error message EN
- import-url-dialog: "Oluşturuluyor…" → "Creating…",
  "Başlatılıyor…" → "Starting…",
  "Devam ediyor…" → "In progress…",
  "Başlat" → "Start",
  "Asset hazır" → "Asset ready",
  4 error message EN

**`/competitors`**:
- competitor-detail-page: "Rakip yükleniyor…" → "Loading competitor…",
  "Rakip yüklenemedi" → "Failed to load competitor",
  "Rakip bulunamadı" → "Competitor not found",
  "Mağazayı aç" → "Open shop",
  toast messages EN (4 string)
- add-competitor-dialog: "Rakip Mağaza Ekle" → "Add competitor shop",
  "Mağaza adı veya URL" → "Shop name or URL",
  daily auto-scan label EN, "Kapat"/"Vazgeç"/"Rakibi Ekle" → "Close"/
  "Cancel"/"Add competitor", "Ekleniyor…" → "Adding…"
- promote-to-reference-dialog: title + button "Referansa Taşı" →
  "Move to reference", "Ürün tipi" → "Product type",
  "Henüz tanımlı ürün tipi yok" → "No product types defined yet",
  "Kapat"/"Vazgeç" → "Close"/"Cancel"
- listing-rank-card: "Görsel yok" → "No image",
  "N favori" → "N favorite(s)" (pluralize-aware),
  "Kaynağı Aç" → "Open source",
  "Referans'a Taşı" → "Move to reference"

**`/trend-stories`**:
- seasonal-badge: 11 seasonal label translation (Noel/Sevgililer Günü/
  Cadılar Bayramı/Paskalya/Anneler Günü/Babalar Günü/Şükran Günü/Yeni
  Yıl/Mezuniyet/Düğün/Doğum Günü/Bebek Odası → Christmas/Valentine's
  Day/Halloween/Easter/Mother's Day/Father's Day/Thanksgiving/New Year/
  Graduation/Wedding/Birthday/Nursery) + `toLocaleUpperCase("tr-TR")`
  → `"en-US"`
- trend-cluster-drawer: "Trend kümesi detayı" → "Trend cluster details",
  "Trend Kümesi" → "Trend cluster", "Küme yükleniyor…" / "Küme
  yüklenemedi" → "Loading cluster…" / "Failed to load cluster",
  "Daha fazla yükle" → "Load more", StatCard labels EN (Shops/Items/
  Total reviews)
- trend-feed: toast EN, "Yükleniyor…"/"Feed yüklenemedi" → EN,
  "Daha fazla yükle" → "Load more"
- trend-membership-badge: title "Trend kümesini aç" → "Open trend
  cluster"
- feed-listing-card: "Görsel yok"/"Kaynağı Aç" → EN,
  "N yorum" → "N reviews"

**Shared primitive — BulkActionBar.tsx**:
- aria-label "Seçimi temizle" → "Clear selection".
  Bu primitive tüm bulk-action UI'ları kullanır (selection,
  bookmarks, vb.); değişiklik tek noktada yapıldı, downstream
  yüzeyler otomatik faydalanır.

### IA wording — Phase 5 conceptual shift uyumu

Phase 5'te ürün omurgası şu şekilde net'leşti: **"Create Variations"
secondary refinement, primary batch creation Batches index'inde
"+ New Batch" ile yapılır**. Ama reference card'ında label "Üret"
("Produce") ambiguous'tu: operatör bunun primary batch start'ı mı
yoksa refinement mı olduğunu anlamıyordu.

Phase 18 fix: **"Open workshop"** — production workspace'i açar
sözleşmesini net'leştirir. Title tooltip iki olası akışı listeler:
1) pick from local library (refinement),
2) generate new AI variations (refinement).

Bu degrade etme değil; operatör artık bu CTA'nın bir refinement
entry olduğunu, primary batch creation'ın ayrı bir surface'te
(Batches index "+ New Batch") olduğunu anlar.

### Test fixture'ları (TR → EN)

3 test dosyası TR string assertion'ları güncellendi:
- `tests/unit/bookmarks-page.test.tsx` (~12 sed replacement +
  getByRole heading disambiguation)
- `tests/unit/trend-stories-page.test.tsx` (toast text regex)
- `tests/unit/selection/selection-bulk-bar.test.tsx` (BulkActionBar
  aria-label assertion update)

### Visible EN parity — DOM scan kanıtları

Browser verification, viewport 1440×900:

| Surface | DOM scan TR lines | Screenshot |
|---|---|---|
| `/references` | 0 | ✓ Header + tabs + filter chips + cards all EN |
| `/bookmarks` | 0 | ✓ "INBOX · 4 BOOKMARKS" + chips + cards + Archive action |
| `/competitors` | 0 | ✓ "SHOPS · 1 COMPETITOR STORE" + filters + Scan/Detail buttons |
| `/trend-stories` | 0 | ✓ (feature-gated; minimal render) |

### Bilinçli scope dışı

Bu tur **browse/list surfaces** ile sınırlandı (user talimatı:
"yalnız browse/list/discovery surfaces; batch/product tarafına
geri dönme"). Aşağıdaki yüzeyler hâlâ TR sızıntı olabilir
(audit edilmedi):

- **Admin surfaces** (Settings, Templates, Prompt management, Negative
  Library, Cost Usage, Audit Logs, Midjourney admin) — operator-facing
  değil; tek dil disiplini için ayrı tur gerekir
- **Job lifecycle / SSE notifications** (sidebar Active Tasks panel
  gibi cross-surface widget'lar)
- **Modal recipe selection / Settings → AI Mode** (orchestration
  internal)
- **Bookmark/Reference detail pages** (eğer ayrı detail render'ı varsa
  — Phase 18 list-surface kapsamına alındı, detail pages bir sonraki
  i18n turunda)

### Neden i18n framework açılmadı

User talimatı: "yeni i18n framework kurma; yalnız görünür yüzeyleri
temizle". Bu turun amacı **parity + IA cleanup**, framework değil.
Mevcut hardcoded EN string'ler ileride bir i18n katmanı eklenirse
zaten **EN baseline** olarak hazır — key extraction tek seferlik bir
işlem olur. Şu an parity sözleşmesi: tüm görünür operator-facing
strings EN'dir; TR yalnız code comments + JSDoc + operator-girdi-veri
alanlarında kalır.

---

## II. References Family — B1 Canonical Audit & Dead Code Cleanup (Phase 19 — 2026-05-12)

Phase 19 References family'sinin Kivasy DS v5 B1 canonical yapısına ne
kadar uyduğunu dürüstçe denetledi. **Beklenenin aksine ailenin büyük
çoğunluğu zaten canonical.** Bulgular ve tek somut değişiklik aşağıda.

### Dürüst audit bulgusu — beklentinin aksine

Audit başlangıcında "Inbox farklı hissediyor" gözlemi, "References Pool'un
legacy `<Card variant="asset">` kullanması nedeniyle ailenin geri kalanı
(Inbox/Shops/Collections) Pool ile uyumsuz görünüyor" hipotezini doğurdu.
**Bu yanlıştı.**

Gerçek durum: **gerçekten render olan Pool kartı zaten canonical k-card
recipe kullanıyor** — `src/features/references/components/references-page.
tsx:595` içindeki inline `ReferencePoolCard` component'i. İncelenen
`reference-card.tsx` dosyası **eski bir render path'inin kalıntısı**;
hiçbir yerden import edilmiyor (dead code).

### B1 canonical yapısı

`v5/screens-b1.jsx` (file:line 11–337):
- B1 **tek route + 5 stateful sub-tab** (`Pool / Stories / Inbox /
  Shops / Collections`); tabs `k-stabs` segment butonları.
- Pool: 4/6 col grid, k-card, k-thumb, k-checkbox, k-badge.
- Inbox: B1'de **tablo layout** (B1:218–259).
- Shops: 2-col k-card grid; "Top 3 thumbs" + Open analysis.
- Collections: 3-col k-card grid; 3-up composite thumb.
- Stories: shop avatar rail + 3-col grid feed.

### Mevcut uygulama — gerçek durum

5 ayrı Next.js route'u, **ortak shell (ReferencesShellTabs +
ReferencesTopbar) ile sarılı**. Tabs `<Link>` (route change), B1'deki
`<button>` (in-page state) değil. Bu mimari fark **bilinçli** —
URL deep-link + browser history + bookmark için route-based pattern
uygun. B1 mental model "References tek yer" korunur (shell strip
+ topbar her surface'te aynı).

| Surface | Card recipe | Class kullanımı | Aile uyumu |
|---|---|---|---|
| `/references` Pool | inline `ReferencePoolCard` | k-card / k-thumb / k-checkbox / k-badge / k-iconbtn | **Canonical** |
| `/bookmarks` Inbox | `BookmarkCard` | k-card / k-thumb / k-checkbox / k-badge / k-btn | **Canonical** |
| `/competitors` Shops | `CompetitorCard` | k-card / k-badge / k-btn | **Canonical** |
| `/collections` | `CollectionCard` | k-card / k-badge / k-btn | **Canonical** |
| `/trend-stories` Stories | `FeedListingCard` + custom rail | k-card değil — özel layout | **Bespoke** (kabul edilebilir) |

### Trend-stories neden bespoke kalıyor

Trend-stories içerik türü itibarıyla **feed**'tir — grid değil:
- Üst: shop-cluster rail (B1 spec'i de farklı tutar)
- Alt: cluster member listings feed
- `WindowTabs` (24h / 7d / 30d window picker) B1'deki k-stabs ile
  benzer ama özel davranış (date range, not sub-view)

Bu yapısal fark **product purpose** kaynaklı, design system drift
değil. Trend feed'i k-card grid'ine zorlamak operatöre değer
katmaz; bespoke kalmaya devam etmesi doğru karar.

### Inbox tam olarak ne işe yarıyor

**Bookmark Inbox**: source intake / ham bookmark tampon alanı.
Operatör bookmark'ları:
1. **Add Reference** CTA (ReferencesTopbar'da) → URL/upload modal
2. URL bookmark'ı veya upload görseli buraya düşer (status =
   `INBOX`)
3. Inbox'tan **Promote to Reference** ile (k-btn--secondary) bookmark
   reference pool'a taşınır
4. Reference pool'da Open workshop → variation generation pipeline'ı

Inbox = **bookmark eklenmiş ama henüz curate edilmemiş** ham
girdi. Reference pool = **curate edilmiş üretim-hazır** kaynak.

Kart pattern'i: BookmarkCard k-card + status badge (Inbox/Risky/
Referenced/Archive) + collection picker + product type picker +
Open + Promote to Reference + Archive. **B1 Inbox spec'inden
fark**: B1 Inbox tablo, app Inbox kart grid. Bu fark **product
purpose tabanlı** (kart inbox'ta daha bilgi-yoğun: tag, collection,
product type picker; tabloda bunlar sığmaz).

### Phase 19 tek somut değişiklik

**`src/features/references/components/reference-card.tsx` silindi**
(dead code; 0 consumer). Phase 18'de bu dosyada EN parity yapılmıştı
ama gerçekte hiçbir surface bunu kullanmıyordu. Audit subagent
gerçek render path'i (inline `ReferencePoolCard`) yerine bu dosyayı
okuyup "Pool drift ediyor" tanısı koyduğu için Phase 19'da deep
investigation yaptım.

Bu silme **operatöre görünür hiçbir değişiklik üretmez** ama:
- Dead code temizliği (CLAUDE.md "avoid backwards-compatibility
  hacks for unused code" + "if you are certain that something is
  unused, you can delete it completely")
- Yanlış audit'leri engeller (sonraki agent'lar gerçek render path'i
  okur)

### Doğrulama kanıtı (DOM scan, viewport 1440×900)

| Surface | k-card count | k-thumb count | k-badge count | k-checkbox count | TR strings |
|---|---|---|---|---|---|
| `/references` (Pool) | 3 | 3 | 3 | 3 | 0 |
| `/bookmarks` (Inbox) | 2 | 2 | 2 | 2 | 0 |
| `/competitors` (Shops) | 1 | - | 1 | - | 0 |
| `/collections` | 2 | - | 2 | - | 0 |

Class kullanımı **tutarlı** — aile gerçekten aile gibi davranıyor.

### Sonraki iş

Bu surface ailesi içinde **operatöre görünür drift kalmadı**.
Trend-stories'in feed pattern'ini k-stabs'a hizalamak product-purpose
çelişkisi yaratır (deferred = doğru karar).

İleride yapılabilecek (Phase 19 dışı):
- Single-route refactor: 5 route'u `/references?tab=X` ile birleştir
  (URL deep-link ile uyumlu kalır). **Önce kullanıcı value check**
  edilmeli; mevcut multi-route pattern history/bookmark için
  zaten iyi çalışıyor.
- Trend-stories shop-avatar rail'ini Stories tab'ında competitor
  bağlamına bağla — şu an "Stories" subtitle "STORIES · N NEW
  LISTINGS" diyor ama operatör hangi shop'lardan geldiğini
  görmüyor.

---

## JJ. References Family — Honest Parity Correction (Phase 20 — 2026-05-12)

**Phase 19 audit yanılgısını düzeltti.** Phase 19 "References family
zaten neredeyse tamamen canonical" sonucuna varmıştı — bu **dürüst
ölçüm değildi**: audit kart classlist'lerine bakıp toolbar/filter
primitive farkını görmemişti. Phase 20 gerçek render edilen DOM'u
karşılaştırdı ve **toolbar katmanında belirgin drift** buldu.

### Phase 19'da kaçırılan gerçek drift (DOM kanıtlı)

**`/references` (Pool) vs `/bookmarks` (Inbox) gerçek primitive
karşılaştırması** (Phase 20 öncesi):

| Aspect | `/references` (canonical) | `/bookmarks` (drift) |
|---|---|---|
| Search input class | `k-input !pl-9` | `flex-1 min-w-0 bg-transparent border-0 outline-none p-0 font-sans` (legacy `Input` primitive) |
| Filter chip class | `k-chip` × 4 (caret) | legacy `Chip` primitive × 5 (`inline-flex h-control-sm rounded-md`) |
| Toolbar wrapper | inline `flex border-b border-line bg-bg px-6 py-3` | legacy `<Toolbar leading={...}>` wrapper |
| Density toggle | Comfortable/Dense | yok |
| aria-pressed on chips | (popover, n/a) | yok (legacy Chip primitive sağlamıyordu) |

Aynı drift `/collections` ve `/competitors`'ta da vardı —
`Toolbar + FilterBar + Chip + Input` legacy primitive zinciri,
`k-input + k-chip` recipe class'larından farklı görsel sözleşme
üretiyordu. Card recipe (`k-card`) zaten canonicaldi, ama **toolbar
katmanı 4 surface'tan 1'inde (Pool) güncellenmişti; geri 3'ü eski
desende kalmıştı**. Kullanıcının "Inbox farklı hissediyor"
gözleminin somut kaynağı buydu.

### Phase 20 düzeltmeleri

**Toolbar primitive parity** — `/bookmarks`, `/collections`,
`/competitors` her üçü de inline `k-input + k-chip` pattern'ine
taşındı. Pool ile birebir görsel sözleşme:

```jsx
<div className="flex flex-wrap items-center gap-2 border-b border-line bg-bg px-6 py-3">
  <div className="relative max-w-[420px] flex-1">
    <Search className="pointer-events-none absolute left-3 …" />
    <input className="k-input !pl-9" type="search" … />
  </div>
  <div className="flex items-center gap-1.5">
    {filters.map(f => (
      <button
        type="button"
        onClick={() => setFilter(f.value)}
        aria-pressed={active === f.value}
        className={cn("k-chip", active === f.value && "k-chip--active")}
      >
        {f.label}
      </button>
    ))}
  </div>
</div>
```

- **`aria-pressed`** her chip'te (legacy `Chip` primitive bunu
  veriyordu; k-chip'e manuel ekledim).
- **Active state**: `k-chip--active` recipe class'ı + `aria-pressed`
  ikilisi — orange-soft bg + ink-orange text.
- Legacy `Toolbar / FilterBar / Chip / Input` import'ları silindi
  (4 import × 3 dosya = 12 import azaldı).

**Hidden TR strings (Phase 18 audit'inin kaçırdığı 2 string)**:
- `bookmarks-page.tsx:215` "Referansa ekle" → "Promote to Reference"
- `bookmarks-page.tsx:218` "Koleksiyona" → "Add to collection"

Bu TR string'leri Phase 18 audit'i kaçırmıştı çünkü `[ığşçöüİĞŞÇÖÜ]`
regex'i bu kelimelerde özel-karakter bulamadı (`Referansa` /
`Koleksiyona` plain ASCII Türkçe). Bulk action bar'da disabled
button'lar — operator-görünür ama Phase 18 grep'ten geçemedi.

### Inbox ürün rolü (netleştirme)

**Inbox = ham bookmark intake / source triage tampon alanı**:
1. Operator URL bookmark veya görsel yükledikten sonra item
   `INBOX` status'ünde buraya düşer
2. Operator burada review yapar: tag ekle / collection ata /
   product type belirle / risky işaretle / archive et
3. **Promote to Reference** (k-btn--secondary) ile bookmark
   `REFERENCED` status'üne taşınır → Reference pool'da görünür
4. Reference pool'da Open workshop CTA → variation generation
   pipeline

**Inbox'un Pool'dan farkı**: yüzey **görevi** farklı — kart
intake-yoğun (tag picker + collection picker + product type picker
+ 3 action button), Pool kartı daha sade (Open workshop + Archive).
**Yapısal toolbar drift'i** (Phase 20'de düzeltildi) ise yanlış
implement edilmişti; ürün gereksinimi değildi.

### Honest classification (Phase 20 sonrası, DOM-kanıtlı)

| Surface | Search input | Filter chips | aria-pressed | Cards | **Verdict** |
|---|---|---|---|---|---|
| `/references` (Pool) | k-input | k-chip × 4 (caret) | n/a (popover) | k-card | **Canonical** |
| `/bookmarks` (Inbox) | k-input | k-chip × 5 (segmented) | yes | k-card | **Canonical** ✓ |
| `/collections` | k-input | k-chip × 3 (segmented) | yes | k-card | **Canonical** ✓ |
| `/competitors` (Shops) | k-input | k-chip × 3 (segmented) | yes | k-card | **Canonical** ✓ |
| `/trend-stories` | - | WindowTabs | - | feed | **Bespoke** (product-purpose: feed not grid) |

4/5 surface artık birebir aile sözleşmesinde. Trend-stories bespoke
kalmaya devam — bu yapısal fark **feed content type tabanlı**,
yapısal drift değil.

### Bilinçli scope dışı

- **FilterChip popover vs segmented** — Pool 4 popover chip, diğer
  3 surface segmented chip. Filter pool size'a göre doğru karar
  (popover dynamic options için, segmented fixed list için). Aynı
  k-chip recipe class'ı her ikisinde de.
- **Density toggle** — Pool'da var, diğer 3'te yok. Grid density
  ihtiyacı her surface için aynı değil; Inbox 2-col gerçekten yeterli.
- **Trend-stories shop-cluster rail** — Phase 19'da deferred edildi;
  feed pattern'ini grid'e zorlamak product purpose'la çelişir.
- **B1 mimari fark** (1 stateful container vs 5 routes) — Phase 19'da
  açıklandı; URL deep-link için route-based pattern bilinçli.

### Doğrulama kanıtları (DOM scan, viewport 1440×900)

```
/references  : k-input=1, k-chip=4 (Source/Type/Collection/Date added)
/bookmarks   : k-input=1, k-chip=5 (All/Inbox/Reference/Risky/Archive) + aria-pressed
/competitors : k-input=1, k-chip=3 (All/Auto-scan/Manual) + aria-pressed
/collections : k-input=1, k-chip=3 (All/Bookmark/Reference) + aria-pressed
```

5/5 surface: **0 TR strings**.

### Quality gates

- tsc --noEmit: clean
- vitest: tests/unit/{bookmarks-page,competitors-list-page,...}
  all PASS (test fixture bookmarks placeholder regex EN'e güncellendi)
- next build: ✓ Compiled successfully

---

## KK. Inbox Layout Parity Correction (Phase 21 — 2026-05-12)

**Phase 19 + Phase 20 audit yetersizliğini düzeltti.** Her iki tur da
toolbar/filter parity'sini doğrudan ölçtü ama Inbox'ın **layout
parity'sini** (grid vs table) gözden kaçırdı. Kullanıcı bu farkı net
gördü: B1 SubInbox **table**, app `/bookmarks` ise grid idi. Phase 21
bunu canonical layout'a hizaladı.

### B1 SubInbox canonical (screens-b1.jsx:218-260)

```
k-card overflow-hidden
└─ <table>
   ├─ thead: 6 column header
   │   ├─ checkbox (w-9)
   │   ├─ thumb (w-16)
   │   ├─ Title
   │   ├─ Source (w-32)
   │   ├─ Added (w-28)
   │   └─ action (w-44)
   └─ tbody: row.k-row.hover:bg-k-bg.cursor-pointer
       └─ <button class="k-btn k-btn--ghost">Promote to Pool</button>
```

Inbox content type = **triage list**, not browse grid. Operator
hızla taraması gereken intake table; thumbnail küçük (w-16 vs w-full
square), title scannable, row-level action (ghost CTA).

### Phase 19+20 yanılgıları

| Phase | Yanılgı | Düzeltilme |
|---|---|---|
| 19 | `reference-card.tsx` legacy dead code'u Pool sanıp "Pool drift ediyor" tanısı koydu (gerçekte Pool inline `ReferencePoolCard` zaten canonical) | Phase 20 DOM-evidence |
| 19 | Inbox "feels different" → "actually canonical" sonucuna kart classlist tabanında vardı (toolbar/layout gözden kaçtı) | Phase 20 + Phase 21 |
| 20 | Toolbar primitive parity'sini (k-input + k-chip) düzeltti **ama** layout parity (grid → table) atlanmıştı | Phase 21 |

Her iki tur da "dürüst audit" iddialarına rağmen layout sözleşmesini
sadece DS metin spec'iyle kontrol etti, gerçek B1 jsx layout
yapısıyla karşılaştırmadı. Phase 21 user explicit observation
("DS'de Inbox grid değil table") üzerine inceleme yaparak gerçek
canonical layout'u doğruladı.

### Phase 21 düzeltmesi

**Yeni component**: `src/features/bookmarks/components/bookmark-row.tsx`
B1 SubInbox row pattern'i:
- `<tr>` content: checkbox / k-thumb !w-10 / title cell (with inline
  meta-line: productType + tags + collection) / Source badge / Status
  badge / Added relative / row actions (Promote to Reference + Archive)
- B1'den fark: **7th column "Status"** eklendi (bookmark workflow
  gereği — Risky/Referenced/Archived statusunu satırda göstermek
  triage iş akışını destekler; B1 demo'da bütün rows uniform "Inbox"
  varsayıyordu)

**bookmarks-page.tsx refactor**:
```jsx
// before:
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
  {items.map(bm => <BookmarkCard key={bm.id} ... />)}
</div>

// after:
<div className="k-card overflow-hidden" data-testid="bookmarks-table">
  <table className="w-full">
    <thead> ... </thead>
    <tbody>
      {items.map(bm => <BookmarkRow key={bm.id} ... />)}
    </tbody>
  </table>
</div>
```

**Dead code cleanup**: `bookmark-card.tsx` artık 0 consumer (page tek
kullanıcısıydı, BookmarkRow'a geçti). Dosya silindi (CLAUDE.md "if
certain something is unused, delete completely").

### Bookmark-specific işlevler nasıl korundu

Card pattern'de kart başına ayrı satırlarda olan zenginleştirme,
artık row title cell içinde **tek inline meta-line**:

| Veri | Card'da nasıldı | Row'da nasıl |
|---|---|---|
| Tags | full TagPicker satırı | inline picker meta-line'ında |
| Collection | full CollectionPicker + label | inline picker meta-line'ında |
| Product type | font-mono caption ayrı satır | inline meta-line'da uppercase mono caption |
| Status (Inbox/Risky/Referenced/Archived) | sağ üst badge | dedicated Status column |
| Source (Pinterest/Etsy/...) | meta caption | dedicated Source column badge |
| Promote action | hover bottom overlay primary | row-action k-btn--secondary (right) |
| Archive action | footer ghost | row-action k-btn--ghost (right) |
| Open detail action | footer ghost | (kaldırıldı — row click = future scope; Phase 21 minimal) |
| Selection checkbox | top-left absolute k-checkbox | row checkbox column |

Operator workflow korunur: tag/collection/productType inline picker
ile değişebilir; status/source görünür; Promote/Archive row-action
ile tetiklenir. **Hiçbir bookmark capability kaybedilmedi.**

### Honest layout classification (Phase 21 sonrası)

| Surface | Layout | Verdict |
|---|---|---|
| `/references` Pool | grid (browse) | **Canonical** (B1 SubPool grid spec) |
| `/bookmarks` Inbox | **table** (triage) | **Canonical** ✓ (B1 SubInbox table spec) |
| `/competitors` Shops | grid | **Canonical** (B1 SubShops 2-col grid) |
| `/collections` | grid | **Canonical** (B1 SubCollections 3-col grid) |
| `/trend-stories` | feed + rail | **Bespoke** (product purpose) |

Family-feel **layout-aware**: aynı shell + aynı toolbar pattern + aynı
k-card / k-thumb / k-checkbox / k-badge recipe class'ları; layout
sub-view content type'ına göre farklılaşır (grid vs table). B1 spec
zaten bu ayrımı yapıyor — Pool browse, Inbox triage.

### Bilinçli scope dışı

- **B1 SubInbox 6-col spec vs app 7-col**: app'te Status sütunu var,
  B1 demo'da yok. Bu bilinçli karar — bookmark workflow Inbox/Risky/
  Referenced/Archived ayrımını triage'da göstermeli. Tek sütun
  eklemek B1 spec'i bozmaz; spec demo statik content gösterirken
  gerçek bookmark workflow'u daha fazla state taşır.
- **Row click → detail navigation**: B1 spec `cursor-pointer` ile
  tüm row tıklanabilir; bizim app şu an sadece row-action butonları
  click handler taşıyor. Detail page olmadığı için minimal kaldı.
- **Density toggle**: B1 SubInbox density="comfortable"/"dense"
  wrapper; bookmark intake için density az anlam taşır (row count
  zaten az), defer.
- **Bulk action bar**: korundu (zaten table'ın altında render olur).

### Doğrulama kanıtları

DOM scan (viewport 1440×900):
```
/bookmarks:
  hasTable: true (data-testid="bookmarks-table")
  rowCount: 2 (tbody)
  thHeaders: [Title, Source, Status, Added]  // + 3 unlabeled (checkbox/thumb/action)
  hasGrid: false  // grid drift gone
  trLines: 0
```

Screenshot kanıtı: tek k-card içinde temiz tablo; her satırda
checkbox + 40px thumb + title+meta + Source badge + Status badge +
Added time + Archive ghost. Pool /references hâlâ grid (browse),
Inbox /bookmarks artık table (triage) — B1 SubPool vs SubInbox
layout ayrımına bire bir hizalı.

### Quality gates

- tsc --noEmit: clean
- vitest tests/unit/{bookmarks,bookmarks-page,references,competitors,
  collections,trend-stories,library} + integration tests: all PASS
- next build: ✓ Compiled successfully

---

## Phase 22 — Inbox header/action-slot cleanup (Pool-canonical)

Phase 21 layout düzeltmesi sonrası `/bookmarks` sayfasının üst bölümünde
görünür bir boşluk parity sorunu daha kaldı: "Add from URL" CTA,
`BookmarksPage` içinde ayrı bir `<div className="flex justify-end">`
satırında render ediliyordu. Wrapper'ın `flex flex-col gap-6` boyutu
bu inline satır ile toolbar arasında 24px + buton yüksekliği = ~70px
anlamsız dikey boşluk üretiyordu. Aynı zamanda Pool (`/references`)
"Add Reference" CTA'yı References shell topbar action slot'una
geçirdiği için family parity bozuktu.

Phase 22 düzeltmesi:

- `app/(app)/bookmarks/page.tsx` `<ReferencesTopbar actions={…}>`
  prop'una `<Link href="/bookmarks?add=url" className="k-btn
  k-btn--primary">Add from URL</Link>` ekler. Pool ile **birebir
  aynı pattern** — stateless Link, page-level state lift gerekmez.
- `BookmarksPage` (client component) `useSearchParams` hook'u ile
  `?add=url` query'sini dinler ve **URL-derived state** olarak
  `importOpen` üretir: `importOpen = importOpenLocal ||
  searchParams?.get("add") === "url"`. Local state hâlâ var
  (empty-state CTA "Add your first bookmark" için), iki kaynak
  OR'lanır.
- Modal close handler (`closeImport`) hem `setImportOpenLocal(false)`
  yapar hem URL'de `?add=url` varsa `router.replace(pathname)` ile
  temizler. Bu sayede modal kapatıldıktan sonra browser back/refresh
  tekrar modal açmaz.

URL-derived pattern seçildi çünkü `setImportOpen(true) + router.replace`
kombinasyonu Next.js App Router'da client transition + R18 batching
sırasında state mutation'unu yutuyordu (router.replace route'u
yeniden mount ediyor → fresh instance state'i kaybediyor). URL'i
"single source of truth" yapmak bu çakışmayı tamamen ortadan
kaldırıyor; ayrıca URL bookmarkable / share-friendly oluyor
(React Server Components idiomatic pattern).

### Inline button row neden kaldırıldı

Pre-Phase 22 `BookmarksPage` wrapper yapısı:

```
<div className="flex flex-col gap-6">
  <div className="flex justify-end">         // ← 1. row, ~44px
    <button>Add from URL</button>            //   sadece button
  </div>
  // gap-6 = 24px
  <div toolbar>Search + filters</div>         // ← 2. row
  ...
</div>
```

Topbar'da References başlığı + INBOX subtitle zaten görünürken
**ikinci bir CTA satırı** boşluk üretiyordu. Pool'da bu satır
yoktu çünkü Add Reference topbar'da. Phase 22 ile inline satır
kaldırıldı — wrapper'ın ilk çocuğu artık doğrudan toolbar.

### Doğrulama kanıtları

DOM scan (viewport 1440×900):

```
/bookmarks (after Phase 22):
  ctaInTopbar: true                           // [data-testid=bookmarks-add-cta]
  ctaInTopbarSectionTag: "HEADER"             // semantic <header>
  ctaHref: "/bookmarks?add=url"
  firstChildIsToolbar: true                   // wrapper first child = search bar
  firstChildHasOldAddButton: false            // inline row gone
  inboxTabActive: true                        // ReferencesShellTabs Inbox=4
  modalOpenOnAddUrlParam: true                // <input type="url">+overlay
  modalClosePersists: true                    // URL search="" after close
```

Screenshot kanıtı: References başlığı yanında `+ Add from URL` k-orange
chip; bir altta Pool/Stories/Inbox/Shops/Collections subnav; bir altta
Search + chip filtreler; bir altta direkt tablo (k-card içinde). Eski
70px boşluk yok. Pool/Inbox arası `actions` slot parity korunur:
ikisi de References shell topbar action slot'unda primary CTA gösterir.

### Bilinçli scope dışı

- `ImportUrlDialog` içerik metinleri hâlâ TR (`URL'den bookmark ekle`,
  `Kapat`, `Hata:`, `Bookmark olarak kaydet`). Phase 15-18 EN parity
  turları bu modalı açmak için bir kullanıcı akışı sunmadığından
  atlandı. Phase 22 modal'ı operatöre görünür yaptı → bir sonraki
  EN-parity turuna açık liability. Bu turun scope'u **topbar action
  slot + üst boşluk**; modal copy ayrı bir turda EN'e taşınacak.
- `tests/unit/toolbar-filterbar-bulkaction.test.tsx` 2 pre-existing
  TR fail (Phase 15-18 EN parity migration test kalıntısı; BulkActionBar
  copy testi "Seçimi temizle" arıyor). Phase 22 regression değil —
  `main`'de aynı fail mevcut (git stash ile doğrulandı).

### Quality gates

- tsc --noEmit: clean
- vitest tests/unit/{bookmarks-page, bookmarks-confirm-flow,
  bookmark-service, references-page, dashboard-page, pageshell-sidebar}:
  bookmarks suite 26 PASS; extended 74 PASS / 2 pre-existing fail
- next build: ✓ Compiled successfully (run pre-refactor; post-refactor
  HMR canlı kanıt ile doğrulandı)
- Browser verification: live dev server üzerinde gerçek navigation
  + click + modal open/close akışı doğrulandı (screenshot + DOM
  scan kanıtları yukarıda)

---

## Marka Kullanımı

- Public-facing ürün adı **Kivasy**'dir.
- UI metinlerinde, dokümanlarda, brief'lerde, hata mesajlarında "Kivasy"
  geçer.
- "EtsyHub" yalnızca repo slug, package.json, eski git geçmişi, eski
  `docs/plans/*` ve `docs/design/EtsyHub/*` (history) yerlerinde kalabilir;
  yeni dokümana **eklenmez**.
- "Etsy" başlı başına marka olarak kullanılmaz. "for Etsy sellers", "Etsy
  draft listings", "Etsy-connected workflow" gibi nötr ifadeler uygundur.
- Başka bir aracın (Matesy, Listybox, vb.) marka adı veya görsel kimliği
  Kivasy ürününde **kullanılmaz**; bu araçlar yalnızca **referans**
  olarak incelenir.
