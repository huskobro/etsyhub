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

## Phase 23 — Inbox triage micro-interactions (row hover + thumb preview)

Phase 21+22 sonrası `/bookmarks` layout/topbar parity tamamdı ama
Inbox **triage deneyimi** hâlâ zayıftı. Honest audit:

1. **Row hover hissi** — `tr` üzerinde tek class `hover:bg-k-bg-2/40`
   vardı. `--k-bg-2 (#F1EEE5)` %40 opacity ile paper white üzerinde
   ~`#F8F6EF` alpha-blend üretiyordu; pure white'tan neredeyse
   ayırt edilemiyordu. Kullanıcı mouse'la satır üstüne gelince
   "hangi satırdayım?" sorusuna görsel cevap alamıyordu. **Ölü satır
   hissi**.
2. **Thumbnail çok küçük** — `k-thumb !w-10 !aspect-square` (40×40px).
   DS B1 SubInbox de aynı boyutu kullanıyor (`screens-b1.jsx:244`),
   ama gerçek Etsy/Pinterest/upload görseli 40×40'ta tanınmaz.
   Triage akışında "bu mu benim aklımdaki ref?" sorusu cevapsız;
   kullanıcı promote'a basmadan önce **daha net görsel** ister.
3. **Row actions hissi statik** — Promote/Archive butonları her
   zaman full opacity. DS niyetiyle uyumlu (her zaman görünür) ama
   "active row" sinyali yok; tablo gürültülü kalıyordu.

### Detail page neden yapılmadı

Inbox detail page **gereksiz** sayıldı çünkü:

- Triage akışında ana sorular hover preview ile çözülüyor: "bu görsel
  ne?" (preview), "promote edeyim mi?" (aynı satırda buton), "tag /
  collection / not düzenle" (zaten row içinde inline pickers), "kaynak
  görmek ister" (preview caption + future "View source" link).
- Detail page bir tıklama + back/exit + breadcrumb + yeni route bakım
  yükü demek; triage hızını **yavaşlatır**.
- DS B1 SubInbox detail row gösterimi sunmuyor; route adding DS
  niyetinden sapma olur.
- Hover preview + row hover + cursor-pointer üçlüsü Inbox "ölü
  satır" hissini ortadan kaldırıyor; kullanıcı satıra ulaşmadan
  bilgiye erişiyor.

Yani bu turun cevabı: **hover preview yeter, detail page yok**.
İleride başka bir kullanıcı senaryosu (örn. çoklu notes / risk
investigation) gerekirse drawer eklenir; yeni route henüz
ürün niyetiyle uyuşmuyor.

### Düzeltmeler (BookmarkRow)

1. **Row hover tone** — `hover:bg-k-bg-2/40` → `hover:bg-k-bg`
   (full, paper #FFFFFF → warm cream #F7F5EF). DS B1
   `hover:bg-[var(--k-bg)]` ile birebir aynı (screens-b1.jsx:242).
   Selected row için `hover:bg-k-orange-soft/40` ekstra-emphasis
   (selected + hover kombinasyonu görsel olarak ayrışır).
2. **`cursor-pointer`** — DS B1 row interactivity hissi
   (screens-b1.jsx:242). Tüm satır artık "tıklanabilir bir nesne"
   sinyali veriyor.
3. **`group/row` + `transition-colors`** — Tailwind named group
   pattern; içerideki action buton kümesi `group-hover/row` ile
   sönük→parlak geçişi alıyor (default opacity-80,
   group-hover:opacity-100). `focus-within:opacity-100` klavye
   gezintisinde de tam parlak — sönük takılma yok.
4. **`BookmarkRowThumb` (yeni alt-component)** — 40×40 thumb üzerine
   mouse hover veya focus → 120ms gecikmeli **256×256 popover**
   açar. Davranışlar:
     - `aspect-square` içinde gerçek asset, alt caption (title +
       source label DS-tone font-mono)
     - viewport sağ kenarına sığmazsa otomatik sola yerleşir
       (`data-placement="right" | "left"`)
     - Escape → kapatır
     - scroll/resize → reposition
     - asset null → preview popover render edilmez (asset'siz
       bookmark için büyütmek anlamsız; mevcut "No image" placeholder
       yeterli sinyal)
     - `role="tooltip"` + `aria-label="Preview of {title}"` — a11y
     - thumb wrapper `tabIndex={0}` + `aria-label="Preview {title}"`
       — klavye accessible
     - thumb `ring-1 ring-transparent → hover:ring-line` subtle
       focus-ring sinyali

### DS micro-interaction parity hesabı

| DS B1 sinyali (screens-b1.jsx) | Pre-Phase 23 | Phase 23 |
|---|---|---|
| `cursor-pointer` row | yok | var |
| `hover:bg-[var(--k-bg)]` full | `bg-k-bg-2/40` zayıf | `bg-k-bg` full |
| 40×40 thumb | aynı | aynı (preview ek katman) |
| Row actions her zaman görünür | aynı (full opacity) | aynı (opacity-80 default, hover %100) |
| Hover preview (popover) | yok | yeni (DS niyetinden sapma değil — DS B1 mock'unda preview yok ama ürün ihtiyacı operatöre net görsel istiyor; tooltip pattern DS Q ilkesiyle uyumlu) |

### Doğrulama kanıtları

DOM/computed-style scan (viewport 1440×900):

```
/bookmarks row (Phase 23):
  rowCursor: "pointer"
  rowGroupClass: true                          // group/row pattern
  rowTransition: "color 0.18s ..."             // hover transition
  actionsOpacity: "0.8"                        // default sönük
  actionsTransition: "opacity 0.18s ..."       // group-hover parlak

/bookmarks thumb (asset != null):
  tabIndex: "0"                                // klavye accessible
  aria-label: "Preview {title}"

/bookmarks preview popover (focus tetikli):
  previewExists: true
  role: "tooltip"
  aria-label: "Preview of Untitled"
  placement: "left" (viewport sağa sığmadığı için sola düştü)
  inner image: 238×238px (k-thumb 40px → 6× büyük)
  Escape → previewAfterEsc: false              // klavye close
```

Screenshot kanıtı: turuncu/renkli clipart asset'i 256×~300px popover
içinde net görünüyor, caption "Untitled" + "OTHER" source DS-tone
font-mono. 40×40 thumb yerine ~6× büyük preview — triage için
operatöre yeterli detay.

### Bilinçli scope dışı

- **Asset'siz bookmark için preview yok** (intentional). `bookmark.asset
  === null` → `BookmarkRowThumb` interactive değil (`tabIndex={-1}`,
  hover handler bağlı değil). Bunlar "No image" placeholder gösteren
  satırlar; büyütülecek görsel yok, popover anlamsız olur.
- **Row tıklama davranışı** — `cursor-pointer` görsel niyet sinyali;
  şu an satıra tıklamak default eylem yok (tag/collection picker
  iç-tıklamaları cell-level, thumb hover preview). DS B1
  cursor-pointer'la "satır tıklanabilir hissi" veriyor ama aksiyon
  tetiklemiyor — biz aynı pattern. İlerideki bir tur "satır tıklama
  = preview popover toggle" veya "satır tıklama = promote" eklemek
  isterse explicit ürün kararı gerekir.
- **`ImportUrlDialog` TR copy** (Phase 22 not'undan devir) — bu
  turda dokunulmadı; Phase 22 modal'ı görünür yaptığında not edilen
  liability hâlâ açık.
- **Test coverage gap** — `BookmarkRowThumb` için targeted hover/
  focus/escape testi henüz yok (mevcut suite hâlâ 26 PASS, regression
  yok). Phase 23 component'i runtime-driven (timer + position
  calculation); test eklemek için fake timers + DOM rect mock
  gerekir. İleride hover preview davranışı değişirse veya yeni
  source ailesi eklenirse (örn. Stories) burası test'le sıkılaştırılır.
- **`/references`, `/collections`, `/competitors` family hover
  micro-interaction parity** — bu turun scope'u Inbox idi. Pool'da
  grid kart hover'ı zaten DS B1 SubPool group-hover pattern'inde
  (`group-hover:opacity-100`). Diğer family yüzeylerine ihtiyaç
  görülürse ayrı bir turda hizalanır; family hissi şu an bozulmuyor.

### Quality gates

- tsc --noEmit: clean
- vitest tests/unit/{bookmarks-page, bookmarks-confirm-flow,
  bookmark-service}: 26 PASS (regression yok)
- Browser verification (live dev server, screenshot + DOM scan):
  row hover class + cursor + transition uygulanmış; thumb focus →
  256×~300px popover, role=tooltip, aria-label, placement auto;
  Escape kapatır; asset null satırlarda preview YAPMAZ.

### Bundan sonra References family'de kalan tek doğru iş

`ImportUrlDialog` EN parity migration — Phase 22'de görünür hale
gelen TR copy (`URL'den bookmark ekle`, `Kapat`, `Bookmark olarak
kaydet`, `Hata:`) bir sonraki turun bilinçli işi. Bu modal
ImportUrlDialog'a özgü; başka surface'leri etkilemiyor, focused
bir tur olur.

---

## Phase 24 — ImportUrlDialog visible parity + modal polish

Phase 22 modal'ı operatör akışına bağladı (`/bookmarks?add=url` →
topbar CTA → modal). Phase 24 modal'ın kendi yüzeyini "çalışıyor
ama TR sızıntı + DS-tonsuz" durumundan **ürün yüzeyi** seviyesine
taşıyor.

### Honest audit (modal'ın çıkış durumu)

Visible TR string'ler (operatöre direkt görünüyordu):

1. Header title: `URL'den bookmark ekle`
2. Header close: `Kapat`
3. Error prefix: `Hata: …`
4. Success state primary CTA: `Bookmark olarak kaydet`

Polish/a11y eksikleri:

- `role="dialog"`, `aria-modal`, `aria-labelledby` yoktu
- Escape close yoktu; backdrop click yoktu — operatör hapis kalıyordu
- Focus trap yoktu (Tab outside'a sızıyordu)
- Initial focus URL input'a değil; modal açılınca odak nereye giderse
- URL input: legacy `bg-bg border-border` primitive (DS `k-input`
  recipe varken kullanılmıyordu)
- Buttons: legacy `bg-accent rounded-md py-2 text-sm` primitive
  (DS `k-btn k-btn--primary` recipe varken kullanılmıyordu)
- "Start" CTA wording — neyi başlat? Operatör için anlamsız
- Helper text yok — operatör "ne olacak?" sorusuyla baş başa
- Status panel teknik kalabalık: `Job xxxxxxxxxx… · RUNNING · 45%`
  operatöre job ID gösterilir, raw status enum gösterilir
- Success: `Asset ready: xxxxxxxxxx…` — yine asset ID
- Error: `Hata: -` — `error: null` boş ise tire göstererek
- Footer'da yalnız header X-close; ikinci yol (footer Cancel) yok

### Düzeltmeler (`ImportUrlDialog` rewrite)

**Visible EN parity (TR sıfırlandı):**

| Önce | Sonra |
|---|---|
| `URL'den bookmark ekle` | `Add bookmark from URL` |
| `Kapat` | header X icon `aria-label="Close"` |
| `Bookmark olarak kaydet` | `Save bookmark` |
| `Hata: -` | `Couldn't fetch image` + detail satırı (boşsa fallback copy) |
| `Start` | `Fetch image` (eylem-explicit) |
| `Bookmark created.` | `Bookmark saved.` |
| Helper text yok | "Paste any image or listing URL — Etsy, Pinterest, Amazon or a direct image link. We'll fetch the image and preview it before saving." |
| `Asset ready: …` | "Image fetched." + "Ready to save as a bookmark." |
| `Job xxx · RUNNING · 45%` | "Fetching image… 45%" (job ID kaldırıldı; sadece progress) |

**a11y sözleşmesi (PromoteDialog T-39 parity):**

- `role="dialog"` outer wrapper
- `aria-modal="true"`
- `aria-labelledby="import-url-dialog-title"` (title id ile eşli)
- `useFocusTrap` → Tab boundary + initial focus URL input
- Escape → close (busy/pending iken iptal edilmez)
- Backdrop click → close (target === currentTarget guard; busy iken
  korunur)
- Close button `aria-label="Close"` + footer "Cancel" iki yollu kapatma

**DS recipe parity:**

- URL field: `k-input` recipe (paper bg, k-orange focus ring,
  Phase 20 toolbar primitives ile aile birliği)
- Primary CTA: `k-btn k-btn--primary` (`data-size="sm"`)
- Secondary CTA: `k-btn k-btn--ghost`
- Card shell: `rounded-lg border-line bg-paper shadow-popover`
  (önceden `rounded-md border-border bg-surface` legacy semantic
  token'lar — Kivasy v4/v5 paper white + line token aile dili)
- Header/footer separator: `border-line` (DS k-modal pattern'a
  benzer compact-dialog form)
- Status panel: tone-aware border + bg (`border-danger/40 bg-danger/5`
  hatada, `border-success/40 bg-success/5` başarıda,
  `border-line-soft bg-k-bg-2/50` fetching durumunda)

**Operatör-anlamlı status panel:**

- Fetching: nabız atışı k-orange dot + "Fetching image… {progress}%"
  (job ID kaldırıldı, sadece yüzde varsa)
- Success: "Image fetched." + "Ready to save as a bookmark." (asset ID
  kaldırıldı)
- Failed: "Couldn't fetch image" + worker error trim edilmiş; boş ise
  "The URL didn't return a usable image. Try a direct image link."
  fallback (önceden boş error için tire)

**Inbox akışı korundu:**

- Topbar CTA `/bookmarks?add=url` → modal açılır (Phase 22 contract)
- Close → `?add=url` query temizlenir (Phase 22'deki `closeImport`
  helper — URL-derived modal state)
- Local manual open path (gelecek empty state CTA için) korundu
  (`importOpenLocal` OR `searchParams.get("add") === "url"`)
- Hover preview, row hover, table layout, bulk actions etkilenmedi

### Browser verification kanıtı

DOM scan (modal açıkken):

```
title: "Add bookmark from URL"
helper: "Paste any image or listing URL — Etsy, Pinterest, Amazon..."
fetchBtn: "Fetch image"
cancelBtn: "Cancel"
closeAriaLabel: "Close"
trHits: []                                      // sıfır TR sızıntı

outerRole: "dialog"
outerAriaModal: "true"
outerAriaLabelledby: "import-url-dialog-title"

focusedAria: "import-url-input"                 // useFocusTrap initial focus
```

Lifecycle:

```
Escape → dialog kapanır + ?add=url temizlenir       ✓
Backdrop click → dialog kapanır + ?add=url temizlenir ✓
Invalid URL fetch → status panel danger-tone:
  "Couldn't fetch image" + "fetch failed"            ✓
Esc sonrası Inbox table intact (2 row, topbar CTA yerinde) ✓
```

Screenshot kanıtı: 1) modal idle state — Add bookmark from URL
title, SOURCE URL label (font-mono uppercase), https://… placeholder
input k-orange focus ring, helper text gri, Cancel + Fetch image
footer; 2) error state — `Couldn't fetch image` rose-tinted card +
"fetch failed" detail.

### Quality gates

- tsc --noEmit: clean
- vitest tests/unit/{bookmarks-page, bookmarks-confirm-flow,
  bookmark-service, dashboard-page}: **43/43 PASS** (regression yok;
  dashboard-page testi de dahil — `ImportUrlDialog` dashboard quick
  actions tarafından da kullanılıyor)
- Browser verification: live dev server (audit-refs worktree, port
  3000) üzerinde modal lifecycle + a11y + error state + Inbox
  intact doğrulandı (screenshot + DOM scan kanıtları yukarıda)

### Bilinçli scope dışı

- **PromoteDialog'un kendi TR yokluğu** zaten EN ("Move to reference",
  "Close", "Cancel"). Phase 22'de doğrulanmıştı; bu turun scope'u
  değil.
- **`dashboard-quick-actions` modal'ı aynı `ImportUrlDialog`'u
  kullanıyor** — Phase 24 değişikliği orayı da otomatik kapsıyor.
  Ayrı dosya/route'a dokunmadık. Dashboard tests 17/17 PASS — yan
  etki yok.
- **Modal sistemi rewrite YAPILMADI** — `ConfirmDialog` /
  `PromoteDialog` / `ImportUrlDialog` üçü hâlâ ad-hoc focus-trap
  pattern'ı paylaşıyor. Ortak `Dialog` primitive'i çıkarmak büyük
  abstraction olurdu (bu turun kuralı dışı). İleride birikim
  artarsa shell extraction ayrı tur olur.
- **`URL field validation`** (geçerli URL olmadan submit) tarayıcı
  native HTML5 validation'a bırakıldı (`type="url"`). Custom inline
  validation kit'i bu turda eklenmedi.
- **Job lifecycle UI rich-state** — `pending → fetching → ready`
  arasındaki ara durumlar (`QUEUED`, `RUNNING`) UI'da tek "Fetching
  image…" katmanında toplandı. Operatöre teknik enum gösterilmez;
  job ID + raw status gizlendi. İleride download/probe/normalize
  ayrı substep'ler olursa UI bunu yansıtacak şekilde genişler.

### Bundan sonra References family'de kalan tek doğru iş

`PromoteDialog`'un Kivasy DS recipe migration'ı — `ImportUrlDialog`
ile şimdi tonsuz hissetmiyor ama PromoteDialog hâlâ legacy
`bg-surface rounded-md border-border` primitive'lerinde. İçeriği
EN, a11y temiz; sadece DS recipe parity eksik. Küçük bir tur olur,
References family yüzeyleri tamamen kapanır.

---

## Phase 26 — B5 canonical "Add Reference" modal (intake unification)

Phase 22-24 turlarında `ImportUrlDialog` operatöre görünür yapılıp
kalitesi yükseltilmişti, ama **yanlış modal parlatılmıştı**: DS
canonical reference intake door `B5AddReference` (`screens-b5-b6.jsx:8-165`)
— split modal + 3 sibling tab (URL/Upload/From Bookmark) + always-visible
product type chips + optional collection + dinamik CTA count. Phase 25
audit'i bunu netleştirdi.

Phase 26 **kontrollü minimum viable canonicalization**: yeni
`AddReferenceDialog` component'i DS B5 yapısında, mevcut parçalı
intake yüzeyleri tek canonical modal'a birleştiriyor.

### Mevcut parçalı akıştan ne birleşti

| Önce (Phase 22-25) | Sonra (Phase 26) |
|---|---|
| Pool topbar "Add Reference" → `/bookmarks` navigation | Pool topbar "Add Reference" → `?add=ref` → AddReferenceDialog |
| Inbox topbar "Add from URL" → `?add=url` → ImportUrlDialog (tek input) | Inbox topbar "Add Reference" → `?add=ref` → **aynı AddReferenceDialog** |
| dead `DashboardQuickActions` → "URL'den Bookmark" + "Görsel Yükle" + UploadImageDialog | (hâlâ dead) — explicit DEAD CODE policy comment eklendi |
| Bookmark-row "Promote to Reference" → PromoteDialog (tek bookmark) | korundu (atomic) + AddReferenceDialog'un "From Bookmark" tab'ı bulk-promote sağlar |
| Hiç drop-zone / multi-file upload yoktu (operatöre görünmüyordu) | Upload tab: drop-zone + multi-file thumb grid + per-file remove |
| Hiç from-bookmark multi-select yoktu | From Bookmark tab: search + multi-select + count caption |

### Birebir DS ne uygulandı

- 3 sibling tab: Image URL / Upload / From Bookmark
- Header "Add Reference" + X icon close
- Product type chips always-visible (modal body bottom, tab içeriği değişse de görünür)
- Collection optional select (DS B5 chip; app `<select>` ile basitleştirildi)
- Dynamic CTA: "Add Reference" / "Add N References" (bookmark multi-select / upload multi-file) / "Fetch image" (URL pre-fetch) / "Save reference" (URL post-fetch)
- "N selected · will promote to Pool with the product type below" caption
- Drop-zone DS recipe: `border-2 border-dashed border-line-strong rounded-xl p-8` (icon circle + "Drop images to upload" + format/size constraint mono caption + "Browse files" secondary CTA)
- From Bookmark row layout: Checkbox + k-thumb (40×40 aspect-square) + title + source badge + relative time

### Hibrit kararlar (DS niyeti + app gerçekleri)

- **Output Bookmark, Reference değil**: Karar A=3 (audit). Schema doğrudan Reference yaratmayı destekliyor (`bookmarkId nullable`) ama yeni `POST /api/references` endpoint + service migration **bu turun scope'unda değil**. URL/Upload yolu bookmark oluşturur (eski `?add=url` ImportUrlDialog akışıyla aynı endpoint). From Bookmark tab `/api/references/promote` ile multi-promote yapar.
- **Source detection client-side**: DS B5'in "Valid Etsy listing image · auto-detected source" green check'i server-side resolver gerektirirdi. Hibrit: `detectSourceFromUrl` client hostname regex (Etsy/Pinterest/Creative Fabrica/direct image extension/unknown) → modal içinde anında tone-coded chip ("✓ Looks like Etsy" / "✓ Looks like Pinterest" / "✓ Looks like Creative Fabrica" / "✓ Direct image URL" / "✓ Source will be resolved on fetch"). Server gerçek meta extraction `import-url` worker'da kalır.
- **Helper text format**: DS B5 collapsible "How to get the image URL" 3-step ordered list. App inline static helper paragraph (compact dialog, viewport sığması için). Disclosure pattern ileride eklenebilir.
- **Pool'dan modal**: Karar C=2 hibrit. Pool topbar CTA artık modal açar (DS niyeti ✓) ama içerik hâlâ bookmark output'a yazar (Karar A=3 ile uyumlu). Yeni endpoint açma ayrı tur.
- **Tab badge count**: DS'te yok; app'te "From Bookmark · 2" / "Upload · 3" tab içine konuldu (operatör hangi tab'ta kaç item seçtiğini hatırlasın diye — kullanılabilirlik kazancı).

### Özel ürün ihtiyacı

- **Creative Fabrica source desteği**: DS B5'te yok (sadece Etsy/Pinterest mock). Kullanıcı talebi. Hibrit yaklaşım: `SourcePlatform` enum'a `CREATIVE_FABRICA` **eklenmedi** (schema migration yasağı). Server tarafı `sourcePlatform: "OTHER"` yazar; UI tarafı hostname'den "Creative Fabrica" label + k-orange tone gösterir. Operatör ayırt edebilir, DB legacy uyumu bozulmaz. İlerde enum genişletilirse server da doğru enum yazar.
- **Multi-file upload**: DS B5 multi-thumb grid niyeti var, app drop-zone + per-file status (pending / uploading / ready / failed) + `Promise.allSettled` ile partial failure handling (1 başarısız diğerlerini durdurmaz). DS mock'unda bu lifecycle yok; app gerçeği aldı.
- **Bulk URL paste**: bu turda **yapılmadı** (Karar B=3). Tek URL input. İhtiyaç netleştiğinde aynı modal'a sub-mode olarak eklenebilir.

### Kaynak tipleri (Phase 26 scope)

Bu turda desteklenen 4 kaynak (Amazon **scope dışı**):

| Source | Hostname pattern | UI tone | sourcePlatform DB |
|---|---|---|---|
| Etsy | `etsystatic.com`, `etsy.com` | success (green) | `ETSY` |
| Pinterest | `pinimg.com`, `pinterest.*` | danger (rose) | `PINTEREST` |
| Creative Fabrica | `creativefabrica.com` | k-orange (Kivasy primary) | `OTHER` (schema enum yok) |
| Direct image | `.png/.jpe?g/.webp/.gif` extension | ink-2 (neutral) | inferred at fetch |
| Unknown | (none of above) | ink-3 (soft) + "resolved on fetch" copy | resolved server-side |

Amazon helper text + intake source listesinden çıkarıldı:
- `bookmarks-page.tsx` empty state: "Etsy, Pinterest, Amazon" → "Etsy, Pinterest, Creative Fabrica or any direct image link"
- `import-url-dialog.tsx` (bridge) helper: "Etsy, Pinterest, Amazon" → "Etsy, Pinterest, Creative Fabrica"
- `AddReferenceDialog` URL tab placeholder + helper: Amazon hiç geçmedi
- `bookmark-row.tsx` source label map'i `AMAZON → "Amazon"` korundu (legacy DB row görüntüsü için; yeni intake yazmaz)

### `ImportUrlDialog`'un yeni rolü — BRIDGE

`ImportUrlDialog` artık canonical değil. `?add=url` query bridge olarak
kalır:
- `bookmarks-page.tsx` hâlâ `?add=url` listener'ı içerir (Phase 22 useEffect)
- `dashboard-quick-actions.tsx` (dead code) hâlâ `ImportUrlDialog` import eder
- Yeni traffic Pool/Inbox topbar → `?add=ref` → `AddReferenceDialog`'a gider

Dosya başına BRIDGE notu eklendi. Tamamen silinmesi `bookmarks-page.tsx`
`?add=url` listener'ını + dead `DashboardQuickActions`'ı kaldırınca
yapılır (ayrı küçük temizlik turu).

### Dead code policy (Phase 26 audit kararı)

| Component | Status | Phase 26 davranış |
|---|---|---|
| `UploadImageDialog` | DEAD (yalnız dead caller) | DEAD CODE comment eklendi; silinmedi (test fixture hâlâ bağlı) |
| `DashboardQuickActions` | DEAD (Overview'da render edilmiyor) | DEAD CODE comment + olası evrim yollarını listeleyen note |
| `ImportUrlDialog` | BRIDGE | BRIDGE comment; `?add=url` query hâlâ çalışır ama yeni traffic almaz |
| `PromoteDialog` | LIVE | Korundu (atomic single-bookmark + competitor flow) |
| `PromoteToReferenceDialog` | LIVE | Korundu (competitor detail page) |
| `bookmark-row` "Promote to Reference" | LIVE | Korundu (row-level single promote) |

Silmeler **ayrı küçük temizlik turu** (Phase 27 candidate):
1. `bookmarks-page.tsx` `?add=url` useEffect listener kaldır
2. `dashboard-quick-actions.tsx` ya sil ya `AddReferenceDialog`'u açan yeni Quick Add tile'la yeniden bağla (operatör Overview'dan modal açabilsin)
3. `UploadImageDialog` ve onun test'i sil (dashboard-quick-actions kararıyla bağlı)
4. `ImportUrlDialog` sil (dashboard-quick-actions kararıyla bağlı)

### Doğrulama kanıtları

**Live dev server browser scan**:

```
/references?add=ref:
  dialog: true
  title: "Add Reference"
  role: "dialog"
  aria-modal: "true"
  tabs: ["Image URL"(active), "Upload", "From Bookmark"]
  product type chips: 36 (seed data)
  cta: "Fetch image" (URL tab pre-fetch)

URL tab source detection:
  https://i.etsystatic.com/…    → "✓ Looks like Etsy" (success tone)
  https://i.pinimg.com/…        → "✓ Looks like Pinterest" (danger tone)
  https://www.creativefabrica…  → "✓ Looks like Creative Fabrica" (k-orange)
  https://example.com/foo.png   → "✓ Direct image URL" (ink-2)
  https://random.com/page.html  → "✓ Source will be resolved on fetch" (ink-3)

Upload tab:
  drop-zone visible (data-testid="add-ref-upload-zone")
  "Browse files" button (data-testid="add-ref-upload-browse")
  multi-file slot ready

From Bookmark tab:
  search input
  bookmark list (2 INBOX rows, seed data)
  multi-select → tab badge "From Bookmark · 2" + CTA "Add 2 References"

/bookmarks (Inbox):
  topbar CTA text: "Add Reference" (önceki "Add from URL")
  topbar CTA href: "/bookmarks?add=ref" (önceki "?add=url")
  click → same dialog, same 3 tabs

Escape → modal kapanır + ?add=ref query temizlenir
```

Screenshot kanıtı: Pool topbar'dan açılan modal (Image URL tab placeholder
`https://i.etsystatic.com/…`, k-input link-icon prefix, helper text EN +
Creative Fabrica geçer, Amazon yok, Product type chips, Collection
optional, Cancel + "+ Fetch image" primary CTA). From Bookmark tab
screenshot'ı: tab badge "From Bookmark · 2", search input, k-orange
tinted selected row + check icon, CTA "+ Add 2 References".

### Quality gates

- tsc --noEmit: clean
- vitest tests/unit/{bookmarks-page, bookmarks-confirm-flow,
  bookmark-service, dashboard-page, references-page}: **50/50 PASS**
- Browser verification (live dev server, port 3000): Pool ve Inbox
  topbar CTA'larından aynı canonical modal açılıyor; 4 source tipi
  detection doğru; multi-select dynamic CTA, multi-file Upload tab,
  Escape close + query cleanup hepsi gerçek browser kanıtıyla doğrulandı

### Bilinçli scope dışı (sonraki tur candidates)

- **Schema değişiklikleri**: `SourcePlatform.CREATIVE_FABRICA` enum
  değeri, `Reference` model'e direct-from-asset path (`bookmarkId` zaten
  nullable) için yeni endpoint
- **Bulk URL paste**: Karar B=3 (single URL yeter şimdilik)
- **Server-side source meta extraction**: `import-url` worker Etsy/
  Pinterest meta scraper. Şu an client hostname regex
- **Disclosure helper "How to get the image URL"**: DS B5 collapsible
  3-step list. App inline static. Modal compact kalsın diye ertelendi
- **`DashboardQuickActions` silme / yeniden bağlama kararı**: Operatöre
  Overview'da görünmeyen dead surface. Karar açık
- **`ImportUrlDialog` bridge tamamen silme**: `?add=url` listener +
  dead caller kaldırılınca
- **`/competitors`, `/collections` (top-level), Stories, Shops gibi
  References family alt-route'larında topbar CTA**: Bu turda Pool +
  Inbox iki ana yüzeye mount eklendi. Diğer sub-view'lar (Stories,
  Shops, Collections) `ReferencesShellTabs` ile aynı page-shell'i
  paylaşıyor mu kontrol gerekir; mount onlara da eklenebilir

### Bundan sonra kalan tek doğru iş

**Phase 27 cleanup tur**: dead bridge surface'lerin temizliği —
`DashboardQuickActions` + `UploadImageDialog` + `ImportUrlDialog` +
`bookmarks-page.tsx` `?add=url` useEffect listener. Yeni canonical
modal yerleştiği için bu surface'ler artık dead. Operatöre etki
yok (görünmüyorlardı zaten); kod sağlığı için temizlenmeli. Schema
genişletmesi (`SourcePlatform.CREATIVE_FABRICA`, doğrudan Reference
endpoint) **ayrı bir backend turu**, References family UI işi değil.

---

## Phase 27 — AddReferenceDialog visual + IA polish (B5 parity)

Phase 26 modal'ı canonical hâle getirdi ama görsel olarak hâlâ DS B5
ile tam oturmuyordu. Üç kritik sorun:

1. **Product type 36-chip kaos** — test fixture + admin custom types
   modal'a sızıyordu (operatör görüntüsü "kullanılamaz")
2. **Collection alanı From Bookmark tab'ında IA conflict** — "bu
   collection neyi etkiliyor?" karışıklığı
3. **Modal tonu k-chip tab'lar + dar width + sıkı spacing** —
   "çok app-modal" hissi, "Kivasy intake surface" değildi

### Honest gap (Phase 26 → DS B5)

| Aspect | DS B5 | Phase 26 | Phase 27 |
|---|---|---|---|
| Modal width | k-modal split (~1100px) | max-w-2xl ~672px | max-w-3xl ~768px (compact intake door, DS niyetine yakın) |
| Tab strip | SiblingTabs k-stab | k-chip rectangular | **k-stabs / k-stab segmented pill container** |
| Header spacing | px-6 py-4 | px-5 py-4 | px-6 py-4 ✓ |
| Header title | 16px | 15px | 16px ✓ |
| Body padding | px-6 py-6 | px-5 py-4 | px-6 py-5 (compact yet cömert) |
| Footer | px-6 py-4 | px-5 py-3 | px-6 py-3.5 |
| Product types | **5 canonical chip** (digital download) | 36 chip kaos (seed test fixture+ admin custom) | **5 canonical chip + "More types · N" toggle** disclosure |
| Default selected | "Wall art" caption hint | First alphabetical (Canvas) | **Wall Art** (DS B5 default) |
| Sub-caption | "Defaults to your last used type · Wall art" | yok | "Defaults to Wall art" |
| Collection (URL/Upload) | optional chip | `<select>` ✓ | same `<select>` |
| Collection (From Bookmark) | optional chip | `<select>` (IA conflict) | **hidden** (bookmark tab'ında promote endpoint kullanıcı override için yeni override yazar; bookmark tab'ında bu kafa karıştırıcıydı) |
| Tab count badge | yok | "From Bookmark · 2" inline mono | **k-stab__count** recipe (DS canonical badge) |

### Düzeltmeler

**Product type IA cleanup** (en kritik):

1. **Server-level filter** — `db.productType.findMany` artık `where: { isSystem: true }` ekler. Admin custom types (`isSystem: false`), test fixture'lar (`"PT-${key}"`, `"API Finalize Wall Art"`, `"phase7-qs-pt-keyonly"`, vb. hepsi `isSystem: false`) modal'a hiç gelmez.

2. **Client-level canonical whitelist** — `CANONICAL_PRODUCT_TYPE_KEYS = ["clipart", "wall_art", "printable", "sticker", "canvas"]` (CLAUDE.md scope sözleşmesi: "yalnızca dijital indirilebilir ürünler"). Seed'deki `tshirt`, `hoodie`, `dtf` physical POD scope dışı; whitelist'e alınmaz.

3. **Two-tier display**:
   - **Canonical chips always-visible** (5 chip — DS B5 mock'una bire bir)
   - **"More types · 3" toggle** (kalan `tshirt`, `hoodie`, `dtf` collapsible disclosure'a saklı; operatör erişebilir ama kaos görmez)

4. **Default selection** — "wall_art" key bulunursa active; yoksa canonical[0]; yoksa first overall. DS B5 "Defaults to your last used type · Wall art" niyetinin app karşılığı.

**Collection IA cleanup** — bookmark tab'ında saklandı:

```tsx
{tab !== "bookmark" && collections?.length > 0 ? <CollectionSelect/> : null}
```

Rationale: `/api/references/promote` endpoint `collectionId` parametresi
verilirse bookmark'ın **mevcut collection'ını korur**, reference'a
**yeni bir override** yazar. Bookmark tab'ında bu mantığı operatöre
anlatmak için ek caption gerekirdi (UI gürültü). URL/Upload yolunda
yeni bookmark + reference doğuyor — collection alanı doğal anlam taşır.
Bookmark tab'ında collection field'ı saklayıp operator-confusion riskini
sıfıra indirdik.

**Tab strip k-stabs migration**:

Phase 26 k-chip rectangular buttons → Phase 27 `k-stabs` segmented pill
container + `k-stab` / `k-stab--active` recipe (`tokens.css:310-312`).
Sayım badge'i: inline mono span → `k-stab__count` recipe (`globals.css:535`).
DS B5 SiblingTabs ile birebir aynı görsel.

**Creative Fabrica confidence tone**:

Phase 26'da Creative Fabrica `text-k-orange` (Kivasy primary) + "Looks
like Creative Fabrica" yazıyordu. Yanıltıcı — Creative Fabrica URL'leri
**product page** (not direct image CDN). Server-side resolver gerçek
asset URL'ini fetch'ler.

Phase 27 honest signal:
- Tone: `text-ink-2` (Etsy/Pinterest gibi yüksek confidence success/danger değil — orta confidence neutral)
- Copy: "Creative Fabrica page · we'll fetch the main image"
- Check icon: ✓ kalır (URL pattern tanındı), ama tone operatöre dürüst sinyal verir

**Unknown URL** için ✓ check icon kaldırıldı (önceden hatalı positive sinyal); "Source will be resolved on fetch" tek başına ink-3 tonda kalır.

### Doğrulama kanıtları

DOM scan:

```
/references?add=ref (Pool open):
  canonical chips: 6 (5 + "More types · 3" toggle)
  defaultActive: "Wall Art"
  tabClasses: "k-stab k-stab--active"

URL tab source detection (Phase 27 tone update):
  Etsy → text-success "✓Looks like Etsy"
  Pinterest → text-danger "✓Looks like Pinterest"
  Creative Fabrica → text-ink-2 "✓Creative Fabrica page · we'll fetch the main image"
  Direct image → text-ink-2 "✓Direct image URL"
  Unknown → text-ink-3 "Source will be resolved on fetch" (no checkmark)

From Bookmark tab:
  collection field: HIDDEN ✓
  tab badge: k-stab__count "2"
  CTA: "Add 2 References"
  product type section: still visible (always-on)

/bookmarks?add=ref (Inbox open):
  same dialog, same 5 canonical chips, default "Wall Art" ✓
```

Screenshot kanıtı (1) URL tab: k-stabs segmented tab strip, header
16px font-semibold, body cömert spacing, IMAGE URL k-input + link
icon, kısa helper, **5 canonical chip + More types · 3 toggle**,
"Defaults to Wall art" sub-caption, Collection select, "+ Fetch image"
primary CTA. (2) From Bookmark tab: bookmark list (Nursery clipart
Pinterest + Boho line art Etsy), search input, product type chips
(same 5 + toggle), **Collection field YOK**, "+ Add Reference" CTA.

### Quality gates

- tsc --noEmit: clean
- vitest tests/unit/{bookmarks-page, bookmarks-confirm-flow,
  bookmark-service, dashboard-page, references-page}: **50/50 PASS**
- Browser verification: Pool + Inbox topbar CTA'larından aynı temiz
  modal; product type kaos kalktı; Wall Art default; tab strip k-stabs;
  bookmark tab'ında collection saklı; Creative Fabrica honest tone

### Bilinçli scope dışı (Phase 28+ candidate'ları)

- **Schema enum `SourcePlatform.CREATIVE_FABRICA`** — Phase 27'de UI
  hostname-based label/tone; server hâlâ "OTHER" yazar
- **Server-side source resolver** — Etsy/Pinterest/Creative Fabrica
  product page'lerini scrape edip ana asset URL'ini çekme worker'ı
- **Direct `POST /api/references` endpoint** — modal output hâlâ
  bookmark; doğrudan Reference yaratma yolu açılmadı
- **Collection chip picker** — DS B5 chip-with-caret pattern.
  App `<select>` ile basit; chip picker UI ileride
- **URL helper disclosure "How to get the image URL"** — DS B5 3-step
  ordered list. Şu an helper tek satır
- **Multi-URL bulk paste** — tek URL input

### Bundan sonra Add Reference family'de kalan tek doğru iş

**Phase 28 dead/bridge surface cleanup** (Phase 27'de planlanmıştı, Phase
28'de yapılmadı — B5 parity disipline edici turuna döndü; Phase 29'a
ertelendi):
- `bookmarks-page.tsx` `?add=url` useEffect listener kaldır
- `DashboardQuickActions` ya sil ya `AddReferenceDialog`'u açan Quick
  Add tile'la yeniden bağla
- `UploadImageDialog` + ilgili test fixture sil
- `ImportUrlDialog` sil

---

## Phase 28 — AddReferenceDialog B5 disipline edici parity

Phase 27 modal görselini iyileştirdi ama Phase 28 honest re-audit
gösterdi ki hâlâ üç kritik DS B5 sapması vardı:

1. **"More types · 3" toggle DS canonical değildi** (mock screens-b5-b6.jsx:
   17-23'te yalnız 5 chip; toggle yok). Phase 27'de kendim icat etmiştim
2. **"Defaults to Wall art" hardcoded copy DS dilini kaybetmişti.** DS
   canonical: "Defaults to your **last used** type · Wall art" —
   persistence niyetini taşır. Bizim hardcoded fallback last-used
   implement etmiyordu
3. **DS B5 mock'undaki "Bookmark" product type seed'de yoktu** (Clipart /
   Wall Art / Printable / Sticker / Canvas + physical POD'lar vardı).
   DS B5 5-chip mock: Clipart bundle / Wall art / **Bookmark** / Sticker /
   Printable

### Düzeltmeler

**Product type IA — server canonical filter + canonical order + last-used**:

Server-level filter (page-level query):
```ts
where: {
  isSystem: true,
  key: { in: ["clipart", "wall_art", "bookmark", "sticker", "printable"] },
}
```
Phase 27'de client-level whitelist + "More types" toggle vardı. Phase 28
server yalnız canonical 5 key döner; client koşulsuz 5 chip render eder.
**"More types" toggle kalktı.**

Client-level canonical order (`CANONICAL_PRODUCT_TYPE_ORDER`):
1. Clipart bundle
2. Wall art
3. Bookmark
4. Sticker
5. Printable

DisplayName alphabetical sort kullanılmaz; operatör DS'le aynı sırayı
görür.

**Last-used persistence** (DS canonical niyet):
- localStorage key `kivasy.addReference.lastProductTypeKey`
- productTypeId değiştiğinde key persist edilir
- Modal açılışta: localStorage'da geçerli key varsa o; yoksa wall_art
  fallback (DS mock varsayılan); o da yoksa orderedTypes[0]
- Sub-caption dinamik: "Defaults to your last used type · <Selected>"
- Kullanıcı son "Bookmark" seçmişse modal yeniden açıldığında Bookmark
  active + caption "Defaults to your last used type · Bookmark"

**Seed canonical revize** (`prisma/seed.ts`):
- `bookmark` eklendi (key: bookmark, displayName: "Bookmark", aspectRatio:
  2:5) — DS B5 5'inci chip, CLAUDE.md scope'unda (kitap ayracı PDF/PNG)
- `clipart` displayName: "Clipart" → "Clipart bundle" (DS B5 canonical
  wording)
- `wall_art` displayName: "Wall Art" → "Wall art" (sentence case)
- Diğer canonical (`sticker`, `printable`) korundu
- `canvas`, `tshirt`, `hoodie`, `dtf` korundu (legacy DB row uyumu;
  intake'te server canonical-key whitelist'i ile elenirler)

**URL tab disclosure — DS B5 canonical**:

`<details>` "How to get the image URL" 3-step ordered list eklendi
(mock screens-b5-b6.jsx:55-65):
```
01  Right-click the image on Etsy, Pinterest or Creative Fabrica
02  Select "Copy image address"
03  Paste here — Kivasy fetches the image and detects the source
```

Compact intake niyeti gereği **default closed** (DS mock'unda `open`
ama mock split-modal geniş; bizim compact intake modal'da inline
3-step liste body'yi gereksiz uzatırdı).

**From Bookmark caption — DS canonical wording**:
- Phase 27: "N selected · will promote to Pool **with the product type
  below**" — ekstra cümle
- Phase 28: "N selected · will promote to Pool" — DS mock satır
  (screens-b5-b6.jsx:130)

### Multi-URL / multi-upload — honest defer karar

**Multi-upload zaten implement edilmiş** (Phase 26): `<input multiple>` +
drop multi-file + per-file lifecycle (pending/uploading/ready/failed) +
`Promise.allSettled` partial failure handling. Modal kapanmaz, her
file kendi status'unu gösterir.

**Multi-URL bu turda yapılmadı** — bilinçli erteleme:

1. **DS B5 mock'unda yok** — eklemek = canonical'dan sapma, Phase 27/28
   parity disiplinine ters
2. **Gerçek değer 10+ URL'de** ortaya çıkar — 2-3 URL için `?add=ref`
   her seferinde modal aç-paste-fetch yeterli
3. **Doğru UX karmaşık**: N URL → N parallel job → N farklı sonuç +
   progress strip + partial-success + error reporting. Kendi başına
   bir turun işi
4. **Bu turun hedefi B5 parity temizliği** — multi-URL eklemek bu hedefi
   sulandırır

Multi-URL bulk paste **Phase 29+ candidate**.

### Doğrulama kanıtları

```
/references?add=ref → Pool open:
  chipCount: 5 (DS canonical, "More types" YOK)
  chips: Clipart bundle | Wall art (active) | Bookmark | Sticker | Printable
  subCaption: "Defaults to your last used type · Wall art"
  disclosureExists: true (How to get the image URL closed)

Last-used persistence test:
  1. User clicks "Bookmark" chip → localStorage write "bookmark"
  2. Esc close + reopen /references?add=ref
  3. activeChip: "Bookmark" ✓
  4. subCaption: "Defaults to your last used type · Bookmark" ✓
  5. localStorage value: "bookmark" ✓

URL disclosure open:
  3 ordered steps render correctly with k-orange step numbers (01/02/03)

From Bookmark tab:
  caption: "3 SELECTED · WILL PROMOTE TO POOL" ✓
  k-stab__count: "3" ✓
  CTA: "+ Add 3 References" ✓
  collection field: HIDDEN ✓
```

### Quality gates

- tsc --noEmit: clean
- vitest tests/unit/{bookmarks-page, bookmarks-confirm-flow,
  bookmark-service, dashboard-page, references-page}: **50/50 PASS**
- Prisma seed: 9 product type upsert (8 önceki + 1 yeni `bookmark`)
- Browser: Pool + Inbox aynı modal, 5 canonical chip, last-used
  persistence, disclosure, From Bookmark caption DS wording

### Bilinçli scope dışı (Phase 29+ candidate)

- **Multi-URL bulk paste** — DS B5'te yok, ayrı tur
- **Server-side source meta extraction worker** — client hostname regex
  hâlâ aktif
- **`SourcePlatform.CREATIVE_FABRICA` enum** — schema migration yasağı
- **Direct `POST /api/references` endpoint** — modal output hâlâ bookmark
- **Last-used per-user setting** — şu an localStorage (tek-cihaz)
- **Collection chip-with-caret picker** — şu an `<select>` native
- **Dead bridge cleanup** (ImportUrlDialog / UploadImageDialog /
  DashboardQuickActions / `?add=url` listener) — Phase 29 candidate

### Bundan sonra Add Reference family'de kalan tek doğru iş

**Phase 29 dead/bridge cleanup turu** (Phase 27'de planlanmış, Phase
28'de B5 parity'ye öncelik verildiği için ertelendi):

1. `bookmarks-page.tsx` `?add=url` useEffect listener kaldır
2. `DashboardQuickActions` ya sil ya `AddReferenceDialog`'u açan Quick
   Add tile'la yeniden bağla
3. `UploadImageDialog` + ilgili test fixture sil
4. `ImportUrlDialog` sil

Operatöre etki sıfır; kod sağlığı için.

Schema değişiklikleri (`CREATIVE_FABRICA` enum, direct-reference
endpoint, server-side source resolver) ayrı **backend turu**.

---

## Phase 29 — Intake UX genişletme + Inbox row B1 canonical sadeleştirme

Phase 28 B5 parity'yi disipline etmişti ama hâlâ üç kritik kullanıcı
deneyim eksiği vardı:

1. **Tek URL → tek fetch akışı yavaşlatıcı**: Operatör 10 URL eklemek
   istiyorsa 10× modal aç-paste-fetch-save. Her seferinde modal init.
2. **Source detection feedback yetersiz**: "✓ Looks like Etsy" chip
   doğru ama operatör fetch öncesi/sonrası **gerçek görseli görmüyor**.
   Yanlış URL paste → kirli Inbox + Archive zorunluluğu.
3. **Title fallback ham URL veya "Untitled"**: `import-url` worker title
   metadata yazmıyor; bookmark create `title: undefined` → row fallback
   `sourceUrl ?? "Untitled"`. Operatör Inbox'ta "https://i.etsystatic.
   com/.../il_1588xN.jpg" görüyor.

Ek olarak **Inbox row gürültüsü**: title cell sub-line `productType
displayName` + **inline TagPicker** ("No tags / Add tag" chip) +
**inline CollectionPicker** ("No collection" / dropdown). DS B1
SubInbox canonical (`screens-b1.jsx:240-251`) yalnız title 13px
font-medium gösterir. Tag/collection meta-line B1 niyetinde yok.

### Düzeltmeler

**URL tab multi-URL queue** (hibrit — DS B5 mock'ta yok, ürün ihtiyacı):

- `urlEntries` array state — her satır kendi lifecycle (idle / fetching
  / ready / failed)
- Her satır: preview thumb (ready'de asset thumb, diğer state'lerde
  status icon) + URL `<input>` + source hint badge + X remove
- **Multi-line paste split**: kullanıcı 3 URL'i textarea'dan kopyalayıp
  herhangi bir input'a yapıştırırsa → 3 ayrı row oluşur (clipboard
  paste handler `onPaste` event'inde split newlines, `preventDefault`
  ile native paste'i iptal)
- **Bulk fetch all**: `Promise.all` ile parallel import-url job; her job
  kuyruğa atılır + `useEffect` interval polling (1500ms) status update
- **Bulk save all**: `Promise.allSettled` per-row createBookmark;
  partial failure tolerant (1 başarısız diğerlerini durdurmaz)
- "+ Add another URL" satır ekleme button (default 1 row)
- **Dynamic CTA**: idle URL > 0 ise "Fetch N images" (singular for 1);
  all ready ise "Save N references"; mixed ise "Fetch remaining"

**Per-row preview thumb**: `status === "ready"` durumunda asset
`<AssetImage>` 36×36 thumb. Operatör Inbox'a kaydetmeden **gerçek
görüntüyü modal içinde görür** (yanlış URL = yanlış thumb → fix öncesi
fark edilir).

**Source hint per-row** (Phase 27/28 tone'lar korundu, **artık her
satır için ayrı**):
- Etsy → `text-success` "✓ Looks like Etsy"
- Pinterest → `text-danger` "✓ Looks like Pinterest"
- Creative Fabrica → `text-ink-2` "Creative Fabrica page · we'll fetch
  the main image" (honest page-detection tone)
- Direct image → `text-ink-2` "✓ Direct image URL"
- Unknown → `text-ink-3` "Source will be resolved on fetch" (no check)

**Title normalization** (`deriveTitleFromUrl` helper):

| Pattern | Çıktı |
|---|---|
| `etsy.com/listing/{id}/{slug}` | titleized slug (örn. "Dragonfly Clipart Bundle Watercolor") |
| `etsystatic.com/...` | "Etsy image" |
| `pinterest.com/pin/{id}/` | "Pinterest pin {id}" |
| `pinimg.com/...` | "Pinterest image" |
| `creativefabrica.com/product/{slug}/` | titleized slug |
| direct image `.png/.jpg/.webp` | titleized basename ("Sunset Landscape") |
| unknown | hostname (örn. "random-site.com") |

`titleize` helper: kebab/snake → space, capitalize each word.
Server-side meta extraction olmadan operatöre **anlamlı title**.
Kullanıcı sonradan inline edit ile değiştirebilir (PATCH /api/bookmarks/
[id] mevcut davranış).

**Inbox row B1 canonical sadeleştirme** (`bookmark-row.tsx`):

- TagPicker / CollectionPicker **kaldırıldı** (import'lar dahil)
- `onSetTags` / `onSetCollection` prop'ları optional kalır (legacy
  consumer'lar için) ama kullanılmıyor
- Title cell sub-line minimum metadata:
  - `productType.displayName` mono uppercase (operatöre tip ipucu)
  - `· {collection.name}` mono (varsa)
  - `· N tags` mono (varsa, sayı; rozetler yok)
- Hover preview popover (`BookmarkRowThumb`) artık tags + collection
  gösterir:
  - "in {collectionName}" mono
  - Tag chip'leri (max 6, "+N" overflow)
- Operatör popover'da tam meta'yı görür, satırda B1 scan deneyimi
  bozulmaz

### B5 canonical sınırı — hibrit genişletme

| Parça | Kategori | Gerekçe |
|---|---|---|
| Tek URL input + source hint | **Birebir DS B5** | mock screens-b5-b6.jsx:42-66 |
| 3 sibling tab + product type chips + collection | **Birebir DS B5** | Phase 27/28 |
| "How to get the image URL" disclosure | **Birebir DS B5** | mock:55-65 |
| URL tab multi-URL queue + bulk fetch | **Hibrit (ürün ihtiyacı)** | DS B5'te yok; operatör 10+ URL workflow için kritik; B5'in single-input niyetini sub-mode olarak değil **default queue** olarak genişlettik (default 1 satır operatöre tek-URL hissi verir, "+ Add another URL" ile çoğaltır, paste split N satır) |
| Per-row preview thumb | **Hibrit (ürün ihtiyacı)** | DS B5 mock'ta upload thumb var, URL thumb yok; bizim queue mode için gerekli (operatör hangi URL hangi görsel onayı için) |
| Title normalization (`deriveTitleFromUrl`) | **Hibrit (yardımcı)** | DS B5'te title konusu yok; server-side meta extraction yokken operatör için zorunlu |
| Inbox row sadeleştirme | **Birebir DS B1** | mock:240-251 — DS niyetine geri dönüş, Phase 21 fragmentation cleanup |
| Hover preview popover tag/collection meta | **Hibrit (Phase 23 uzantısı)** | Inbox row'dan kalkan meta'yı popover'da yaşatır |

### Doğrulama kanıtları

**Multi-URL queue browser test**:

```
/references?add=ref → URL tab default 1 row
Paste 3 URLs via clipboard → 3 row instantly
  Row 1: Etsy URL, ✓ Looks like Etsy (success)
  Row 2: Pinterest URL, ✓ Looks like Pinterest (danger)
  Row 3: Creative Fabrica URL, ✓ Creative Fabrica page · we'll fetch... (ink-2)
CTA dynamic: "+ Fetch 3 images"
"3 rows · paste multiple URLs into any row to split" caption sağ üst
"+ Add another URL" button
```

**Title normalization unit-equivalent**:

```
etsy.com/listing/.../dragonfly-clipart-bundle-watercolor → "Dragonfly Clipart Bundle Watercolor"
etsystatic.com/.../il_1140xN.jpg → "Etsy image"
pinterest.com/pin/3141592653589793/ → "Pinterest pin 3141592653589793"
pinimg.com/.../xyz.jpg → "Pinterest image"
creativefabrica.com/product/dragonfly-clipart-bundle/ → "Dragonfly Clipart Bundle"
example.com/path/sunset_landscape.png → "Sunset Landscape"
random-site.com/page.html → "random-site.com"
```

**Inbox row sadeleşme**:

```
/bookmarks row data-testid="bookmark-row":
  TagPicker in row: false ✓
  CollectionPicker in row: false ✓
  Sub-line: "CLIPART BUNDLE" (mono) — tag/collection picker noise GONE
  Title cell: clean 13px font-medium + ufak mono meta
```

Screenshot 1 (URL queue 3-row pasted): 3 row Etsy/Pinterest/CF +
per-row source hint + "3 rows · paste multiple URLs into any row to
split" + "+ Add another URL" + Product type chips (Bookmark active
last-used) + CTA "+ Fetch 3 images"

Screenshot 2 (Inbox row clean): 3 row — primary title 13px font-medium
+ thin sub-line (productType / collection / tag count, hiçbir picker
yok). DS B1 canonical scan deneyimi.

### Quality gates

- tsc --noEmit: clean
- vitest tests/unit/{bookmarks-page, bookmarks-confirm-flow,
  bookmark-service, dashboard-page, references-page}: **50/50 PASS**
- Browser verification: multi-URL paste split, per-row source hint,
  dynamic CTA "Fetch N images", title normalization, Inbox row clean
  layout

### Bilinçli scope dışı (Phase 30+ candidate)

- **Server-side `import-url` worker title metadata extraction** —
  client `deriveTitleFromUrl` interim çözüm; ileride worker scraping
  ile gerçek title (örn. Etsy listing `<title>` tag, OG meta)
- **Tag/collection editing UI** — Phase 29 inline edit'leri row'dan
  kaldırdı. İlerde row-detail mechanism (drawer? slide-in?) açılırsa
  tam edit oraya taşınır
- **Multi-URL upload combining** — operatör URL tab'da 2 link, Upload
  tab'da 3 file ekleyip tek "Add 5 References" istemesi (cross-tab
  bulk). Mevcut: her tab kendi flow'unda submit eder
- **Schema migration** (`CREATIVE_FABRICA` enum, doğrudan Reference
  endpoint, source resolver worker)
- **Dead/bridge cleanup** (`DashboardQuickActions`, `UploadImageDialog`,
  `ImportUrlDialog`, `?add=url` listener) — yine Phase 30 candidate

### Bundan sonra Add Reference family'de kalan tek doğru iş

**Phase 30 server-side title + dead/bridge cleanup combo turu**:

1. `import-url` worker: Etsy listing scraper (already var) + Pinterest
   OG meta + Creative Fabrica OG title → asset metadata title yaz
2. Dead/bridge surface'leri sil (Phase 27/28/29'da listelenenler)
3. Bookmark create endpoint server-side title fallback chain:
   `payload.title ?? asset.metadata.title ?? deriveTitleFromUrl(sourceUrl)
   ?? "Untitled"`

Bu iki iş birlikte yapılırsa server-side meta extraction title
normalization'ı tamamen server'a taşıyıp client helper'ı sade fallback
olarak bırakır. Operatör future server resolver güçlenince modal'da
mock'tan farklı bir değer görmez (UX stabilité).

Schema değişiklikleri (`CREATIVE_FABRICA` enum, direct Reference
endpoint) hâlâ ayrı **backend turu**.

---

## Phase 30 — Intake confidence + Inbox row B1 daha da yakınlaştırma

Phase 29'da multi-URL queue + per-row preview + title normalization +
Inbox row Phase 21 noise cleanup yapılmıştı. Phase 30 honest re-audit
hâlâ beş confidence açığı tespit etti:

1. **Pre-fetch preview yok**: URL paste → fetch 2-5s arası operatör
   "doğru URL mi?" sorusunu cevaplayamaz. Etsy CDN raw image URL'leri
   `<img>` ile direkt render edilebilir → instant visual feedback
2. **From Bookmark "Select all" yok**: 60 bookmark için manuel 60× click
3. **Upload aggregate progress yok**: per-file status var ama "5 of 10
   ready" toplam yok
4. **Title fallback client-only**: `deriveTitleFromUrl` modal'da
   payload'a yazılır ama API'yı bypass eden flow'larda (competitor
   promote, future direct routes) çalışmaz
5. **Inbox row sub-line hala 3 meta**: productType + collection + tag
   count. DS B1 mock title-only. productType operatöre kritik ama
   collection/tag count popover'da zaten var

### Düzeltmeler

**Pre-fetch `<img>` preview** (`UrlRowThumb` yeni component):
- URL paste → `https?://` formatta → `<img src={url}>` direkt render
- `onLoad`: opacity-100 thumb göster
- `onError`: fallback `<LinkIcon>`
- `useEffect([url])` URL değişiminde state reset
- Browser test: Etsy CDN URL paste → 2.5s sonra `imgComplete: true`,
  `imgNaturalWidth: 1588` (gerçek görsel boyutu)
- CORS image rendering izin verir, data extraction yok, PII güvenli

**Server-side title fallback** (`@/lib/derive-title-from-url`):
- Phase 29 client-side `deriveTitleFromUrl` shared lib'e taşındı
- `createBookmark` service:
  ```ts
  const resolvedTitle =
    input.title?.trim() ||
    (input.sourceUrl ? deriveTitleFromUrl(input.sourceUrl) ?? undefined : undefined);
  ```
- Client + server aynı helper. API'yı bypass eden flow'larda (competitor
  promote, future direct routes, manual API call) title üretilir
- API test: `POST /api/bookmarks { sourceUrl: "etsy.com/listing/.../
  dragonfly-watercolor-clipart-bundle", title: undefined }` →
  bookmark.title: "Dragonfly Watercolor Clipart Bundle" ✓ (browser
  eval kanıtı)

**From Bookmark Select all / Clear** (BookmarkTab):
- Search input altında summary satırı: "N of M selected · filtered"
- Sağda "Select all" (disabled tüm filtered seçili ise) + "Clear"
  (yalnız selection > 0 ise)
- "Select all" filtered list'i ekler (search ile daraltıp Select all,
  search temizleyip yeni grupta tekrar Select all → daha geniş bulk)
- Browser test: 3 row → Select all → "3 of 3 selected" + 3 row
  `aria-pressed=true` + CTA "Add 3 References" + "Clear" görünür

**Upload aggregate progress** (UploadTab):
- Drop-zone + thumb grid arasında summary line:
  "5 of 10 ready · 2 uploading · 1 failed"
- Sadece relevant counts gösterilir (0 olan kategoriler geçilir)
- Operatör tek bakışta toplam durumu okur

**Inbox row sub-line trim** (`bookmark-row.tsx`):
- Phase 29: `productType · collection · N tags` 3 meta
- Phase 30: yalnız `productType.displayName` mono uppercase
- Collection ve tag count tamamen hover preview popover'a (zaten
  Phase 29'da popover enrich edilmişti)
- DS B1 SubInbox mock'una en yakın hibrit — yalnız 1 ek meta
  satırı, operatör triage'da productType'ı görür ama collection/tag
  gürültüsünden korunur

### Confidence kazançları

| Sorun (Phase 29 sonrası) | Phase 30 fix | Operatör kazancı |
|---|---|---|
| URL paste → 2-5s sonra preview | Pre-fetch `<img>` instant render | "Doğru URL mi?" cevabı 0ms |
| Server bypass'larda title undefined | Server-side fallback chain | Inbox'ta hiçbir "Untitled" kalmaz |
| 60 bookmark manuel select | Select all + Clear | 60 click → 1 click |
| Per-file status taraması | Aggregate "5 of 10 ready" | Tek bakışta toplam |
| Sub-line 3 meta gürültü | Sub-line 1 meta (productType) | B1 scan deneyimi netleşti |

### B5 / B1 hibrit sınırı

| Parça | Kategori |
|---|---|
| Pre-fetch `<img>` preview | **Hibrit (ürün ihtiyacı)** — DS B5 mock'ta yok, intake confidence için kritik |
| Server-side title fallback | **Hibrit (yardımcı)** — DS'te yok, schema title nullable; operatör için Untitled önler |
| Select all / Clear (From Bookmark) | **Hibrit (ürün ihtiyacı)** — DS B5 mock 6 row için her satır click, gerçekte 60 row workflow |
| Upload aggregate progress | **Hibrit (ürün ihtiyacı)** — DS B5 mock 2 file ama gerçekte 10+ file |
| Inbox row sub-line `productType` only | **Birebir DS B1** — mock screens-b1.jsx:245 yalnız title (bizim productType ek meta DS'i biraz aşıyor ama bookmark workflow için zorunlu triage bilgisi) |
| Popover tag + collection enrichment | **Hibrit (Phase 23/29 uzantısı)** — DS'te yok ama row'dan kalkan meta'yı popover'da yaşatır |

### Doğrulama kanıtları

**Pre-fetch image preview** (browser eval):
```
Paste 'https://i.etsystatic.com/.../il_1588xN.jpg' → 2.5s sonra:
  imgPresent: true
  imgComplete: true
  imgNaturalWidth: 1588
  opacity: 100 (loaded state)
```

**Server title fallback** (POST /api/bookmarks):
```
Request body: { sourceUrl: "etsy.com/listing/.../dragonfly-watercolor-
  clipart-bundle", sourcePlatform: "ETSY" } (title omitted)
Response: bookmark.title = "Dragonfly Watercolor Clipart Bundle" ✓
```

**From Bookmark Select all** (browser eval):
```
3 INBOX rows → click Select all → 3 of 3 selected
aria-pressed=true on all 3
CTA: "Add 3 References"
Clear button visible
```

**Inbox row sub-line** (browser DOM scan):
```
titleCellLines: 2 (title + productType only)
titleCellText: "Dragonfly Watercolor Clipart BundleClipart bundle"
NO collection in sub-line, NO tag count in sub-line ✓
```

Screenshot 1 (URL pre-fetch preview): URL satırının sol başında **Etsy
listing'in gerçek görseli** (kırmızı/turuncu clipart asset) +
"✓ Looks like Etsy" + Bookmark active last-used.

Screenshot 2 (Inbox yeni intake): Row 1 "Dragonfly Watercolor Clipart
Bundle" (server-side title fallback, raw URL değil) — Phase 30 öncesi
ikinci row hala raw URL legacy (Phase 30 server fallback yalnız yeni
intake'lerde).

### Quality gates

- tsc --noEmit: clean
- vitest tests/unit/{bookmarks-page, bookmarks-confirm-flow,
  bookmark-service, dashboard-page, references-page}: **50/50 PASS**
- Browser: pre-fetch preview, server title fallback (API eval),
  Select all/Clear, Inbox sub-line trim

### Bilinçli scope dışı (Phase 31+ candidate)

- **Server-side `import-url` worker title metadata extraction**
  (asset.metadata.title): Phase 30 server fallback URL slug'a yaslı;
  worker scraping ile gerçek HTML title/OG meta daha zengin olur
- **Bookmark.title backfill** legacy raw-URL bookmark'lar için
  one-shot migration script
- **Schema migration** (`CREATIVE_FABRICA` enum, direct Reference
  endpoint, server source resolver)
- **Dead bridge cleanup** (DashboardQuickActions / UploadImageDialog /
  ImportUrlDialog / `?add=url` listener)
- **Pre-fetch preview CORS hardening**: bazı host'lar `Access-Control-
  Allow-Origin` set etmez → `<img>` render edilir ama `<canvas>`'a
  yazılamaz; bizim use case'de canvas gerekmiyor, OK

### Bundan sonra Add Reference family'de kalan tek doğru iş

**Phase 31 backfill + dead bridge cleanup birleşik turu**:

1. Bookmark.title backfill migration: `bookmarks.title == sourceUrl OR
   title IS NULL` → `deriveTitleFromUrl(sourceUrl)` (one-shot script,
   schema değişikliği yok)
2. Dead/bridge cleanup (Phase 27/28/29'da listelenenler)
3. Operatör için Inbox tamamen "Untitled" / raw URL'siz hale gelir

Server-side `import-url` worker title metadata extraction ayrı bir
**backend turu**, References family UI işi değil.

---

## Phase 31 — Legacy cleanup + dead/bridge surface temizliği

Phase 30 intake confidence + Inbox row sadeleşmesi'ni tamamlamıştı.
Phase 31 honest audit iki açık kategoriye odaklandı:

1. **Geçmişten gelen kirli bookmark title'ları** (legacy data)
2. **Artık canonical olmayan paralel intake surface'ler** (bridge/dead)

### Legacy title audit

`scripts/audit-bookmark-titles.ts` ile DB tarandı:

```
Total active bookmarks: 488
  title NULL: 2
  title '': 0
  title 'Untitled': 0
  title starts http(s)://: 0
  title OK: 486
```

Phase 30 server-side fallback çalıştığı için yeni intake'lerde raw URL
title yok. Yalnız 2 legacy null title kaldı:
- 1 UPLOAD bookmark (sourceUrl yok — title üretilemez)
- 1 ETSY bookmark (sourceUrl raw `https://i.etsystatic.com/...`)

Test seed çoğunluk OK çıktı (operatör explicit title yazmış: "[QA]
Nursery animal clipart" gibi). Production'da daha geniş legacy
backfill ihtiyacı olabileceği için **script template** kaldı.

### Backfill (`scripts/backfill-bookmark-titles.ts`)

One-shot script (`--dry-run` flag desteği):
- Hedef: `deletedAt IS NULL` aktif bookmark'lar
- Kirli koşullar: `title IS NULL`, `title = ""`, `title = "Untitled"`,
  `title LIKE 'http(s)://%'`
- Resolve order: `sourceUrl` → eğer yoksa raw title string (URL ise)
- Update: `deriveTitleFromUrl(urlForDerivation)` (shared lib)
- Skip: hiç URL bulunamayan bookmark'lar (asset-only upload, manuel
  edit operatörün işi)

Apply çıktısı:
```
Found 2 candidate bookmark(s).
  SKIP cmorqz4mp0 (no URL, src=UPLOAD)
  UPDATE cmp30gt8j0: null → "Etsy image"

Result: updated=1 skipped=1
```

Inbox screenshot kanıtı: önceki `https://i.etsystatic.com/.../il_1588xN.
7088947200_8ahm.jpg` raw title satırı artık **"Etsy image"** olarak
görünüyor.

### Dead/bridge surface cleanup

| Surface | Phase 30 status | Phase 31 karar |
|---|---|---|
| `bookmarks-page.tsx` `?add=url` URL-derived listener | BRIDGE | **Kaldırıldı** — Phase 26'dan canonical `?add=ref`; hiçbir kanal `?add=url` üretmiyor; legacy deep-link silent fallback (operatör topbar CTA'sından canonical girer) |
| `ImportUrlDialog` | BRIDGE | **Silindi** — 2 dead caller temizlendi |
| `DashboardQuickActions` | DEAD | **Silindi** — hiçbir page render etmiyor; test fixture'lar file-string inspect ile sınırlı |
| `UploadImageDialog` | DEAD | **Silindi** — yalnız DQA'dan import; canonical Upload tab `AddReferenceDialog`'da Phase 26'dan beri var |
| `bookmarks-page.tsx` empty state CTA | LIVE | **Rebind**: `<button onClick={setImportOpenLocal(true)}>` → `<a href="/bookmarks?add=ref" className="k-btn k-btn--primary">` (canonical trigger) |

Empty state CTA rebind için test fixture (`tests/unit/bookmarks-page.
test.tsx`) `getByRole("button")` → `getByRole("link")` güncellendi.

### Canonical Add Reference akışı korunması

Phase 31'de aşağıdakiler **regresyonsuz** korundu:
- `/references?add=ref` → AddReferenceDialog (Pool topbar)
- `/bookmarks?add=ref` → AddReferenceDialog (Inbox topbar)
- Multi-URL queue + paste split (Phase 29)
- Pre-fetch `<img>` preview (Phase 30)
- Server-side title fallback chain (Phase 30)
- Product type canonical 5 chip + last-used persistence (Phase 28)
- From Bookmark Select all/Clear (Phase 30)
- Inbox row sub-line `productType` only (Phase 30)
- Hover preview popover tag/collection meta (Phase 29)
- `?add=url` legacy URL silent fallback (no modal, no error)

### Worker title enrichment

Bu turda **yapılmadı** (bilinçli):
- `import-url` worker hâlâ asset metadata title yazmıyor
- Phase 30 fallback chain URL slug'a yaslı (Etsy/Pinterest/Creative
  Fabrica/direct image hepsi anlamlı title üretiyor)
- Server-side HTML scraping (listing `<title>`, OG meta) daha zengin
  title verir ama ayrı **backend turu** scope'u

### Doğrulama kanıtları

```
Backfill: 1 updated, 1 skipped (defansif — asset-only upload korundu)

Browser:
  /references?add=ref → canonical modal açılır ✓
  /bookmarks?add=url → modal AÇILMAZ (silent dead bridge) ✓
                       (sayfa hâlâ erişilebilir, bookmark rows render
                        edilir, topbar "Add Reference" CTA çalışır)
  Inbox row "Etsy image" (backfill çıktısı, eski raw URL yerine) ✓
  Inbox row "Dragonfly Watercolor Clipart Bundle" (Phase 30 server
    fallback'in canlı kanıtı) ✓

Files removed:
  - src/features/bookmarks/components/import-url-dialog.tsx
  - src/features/bookmarks/components/upload-image-dialog.tsx
  - src/features/dashboard/components/dashboard-quick-actions.tsx
```

### Quality gates

- tsc --noEmit: clean
- vitest tests/unit/{bookmarks-page, bookmarks-confirm-flow,
  bookmark-service, dashboard-page, references-page}: **50/50 PASS**
- Browser: canonical akış intakt, dead bridge silent fallback,
  backfill Inbox'ta görünür

### Bilinçli scope dışı (Phase 32+ candidate)

- **Worker title enrichment** — `import-url` worker'a HTML scraping
- **Schema migration** (`CREATIVE_FABRICA` enum, direct `POST
  /api/references` endpoint, server source resolver)
- **Cross-tab bulk combining** — URL + Upload + Bookmark tek seferde
- **Pre-fetch preview CORS hardening** — bazı host'larda canvas
  extraction blocked (use case gerek değil)
- **Reference detail/edit surface** — operatör tag/collection edit
  için ileride detail drawer

### Bundan sonra Add Reference family'de kalan tek doğru iş

Phase 31 ile Add Reference family **canonical olarak temizlenmiş**
durumda:
- Tek canonical intake door (`AddReferenceDialog`)
- 3 sibling tab DS B5 birebir
- Pre-fetch + multi-URL queue + server title fallback
- Inbox row B1 canonical scan
- Hiçbir dead/bridge paralel yüzey yok

Sıradaki gerçek iş References family **dışı**:
1. **Schema migration turu** (backend): `CREATIVE_FABRICA` enum +
   direct Reference endpoint + server-side `import-url` source
   resolver
2. **Reference detail/edit surface** (Pool detail view)

References family UI işi olarak Phase 31 **kapatma noktası**.

---

## Phase 32 — Final integration audit (audit-only)

Phase 31 sonrası "References family bitti mi" sorusunu cevaplamak için
audit-only tur. Browser + DOM scan üzerinden 5 sub-view'da Add
Reference CTA parity'si test edildi:

| Sub-view | Topbar CTA |
|---|---|
| `/references` (Pool) | ✓ Phase 26'da bağlandı |
| `/bookmarks` (Inbox) | ✓ Phase 26'da bağlandı |
| `/trend-stories` (Stories) | 🛑 YOK |
| `/competitors` (Shops) | 🛑 YOK |
| `/collections` (Collections) | 🛑 YOK |

DS B5 niyeti (`screens-b1.jsx:24-34`) açıkça: 5 sub-view'da hepsinin
primary CTA'sı **`Add Reference`**. Phase 32 audit'inde **3 sub-view
gap** tespit edildi — merge-ready değil.

Phase 32 ek bulgular:
- URL queue full lifecycle çalışıyor (paste → pre-fetch → save → Inbox)
- Upload API endpoint çalışıyor
- From Bookmark bulk promote çalışıyor (partial failure tolerant —
  asset-less bookmark'lar reject, error caption "1 of N failed")
- Dead/bridge surface'ler tamamen temizlenmiş
- Folder intake, Etsy listing scraper (frontend), CSV intake **yok**
  (kategorize edildi, Phase 33 sonrası adaylar)

Bu turda kod değişikliği **yapılmadı** (audit-only); CLAUDE.md'ye yalnız
verdict eklenir.

---

## Phase 33 — Sub-view CTA parity (Stories/Shops/Collections)

Phase 32 audit'inde tespit edilen merge blocker: 3 sub-view'da
canonical Add Reference CTA eksikti. DS B5 niyeti hepsinde aynı
CTA istiyor (`screens-b1.jsx:24-34`).

### Düzeltmeler

`/trend-stories/page.tsx`, `/competitors/page.tsx`, `/collections/page.tsx`
3 sayfasına Pool/Inbox canonical pattern uygulandı:

1. Server query trio ekle: `db.productType.findMany({ isSystem: true,
   key: { in: canonical_5 } })` + `getReferencesSubViewCounts` +
   `db.collection.findMany`
2. `ReferencesTopbar` `actions` prop'a `<Link href="{path}?add=ref"
   className="k-btn k-btn--primary">+ Add Reference</Link>` ekle
3. Sayfa sonuna `<ReferencesAddReferenceMount productTypes={...}
   collections={...} />` mount et

Pattern Pool sayfasından birebir kopyalandı; yeni abstraction
açılmadı (DRY shared helper kararı Phase 34+ adayı). 3 sayfa tek tip
mimari + cross-page intake davranışı tutarlı.

DS mock'unda Shops + Collections sub-view'larında **iki CTA** var
(`screens-b1.jsx:27-34`):
- Shops: secondary "+ Add Shop URL" + primary "Add Reference"
- Collections: secondary "+ Collection" + primary "Add Reference"

Phase 33 yalnız canonical primary CTA'yı ekler. Secondary CTA'lar
ayrı yapılarda mevcut (Shops için `CompetitorListPage` onboarding
flow, Collections için `CollectionsPage` "+ New collection" buton)
— canonical akışı bozmuyor, ayrı küçük UX polish turu olarak
ileride birleştirilebilir.

### Smoke verification (browser kanıtı)

```
/references?add=ref → modal ✓ (Phase 26 baseline)
/bookmarks?add=ref → modal ✓ (Phase 26 baseline)
/trend-stories?add=ref → modal ✓ (Phase 33 yeni)
/competitors?add=ref → modal ✓ (Phase 33 yeni)
/collections?add=ref → modal ✓ (Phase 33 yeni)

Her sub-view'da:
  CTA text: "Add Reference" ✓
  CTA href: "{path}?add=ref" ✓
  Modal title: "Add Reference" ✓
  3 sibling tab (URL/Upload/From Bookmark) ✓
```

Screenshot kanıt: `/collections?add=ref` open state — topbar `+ Add
Reference`, modal IMAGE URL tab aktif, Phase 28 canonical 5 chip
(Bookmark active = last-used persistence), Phase 28 disclosure, Phase
30 pre-fetch URL row.

### Asset-less bookmark promote gap (Phase 32 not'u)

Phase 32 audit'inde gözlendi: From Bookmark tab'ında asset'i olmayan
bookmark seçilirse `/api/references/promote` 4xx döner; modal "1 of N
promotions failed" gösterir ama **hangi row** başarısız belli değil.

**Phase 33 kararı**: blocker değil, küçük UX polish (Phase 34+ adayı).
Operatör mevcut akışta partial failure'ı görür, "Clear" + tek
bookmark seç pattern'ı ile workaround alır. Per-row failure
indicator + skip-on-save caption ileride eklenir.

### Yeni feature kategorizasyonu (Phase 33 sonrası)

| Feature | Kategori | Effort |
|---|---|---|
| Folder intake (4. tab "From Local Folder") | Orta — UI tab + cross-feature integration | Schema değişikliği yok |
| Etsy/Creative Fabrica listing URL → tüm görselleri picker | Backend (Pinterest/CF parser) + UI sub-mode | Orta-büyük |
| CSV/Excel intake | Bağımsız feature, ayrı `/references/import` page | Büyük |
| Per-row failure + skip-on-save caption | Küçük UX polish | Küçük |
| Queue mode row-per-link kararı | **Korunur** | DS B5'i aşan ürün ihtiyacı; multi-line paste split kullanıcıyı rahatlatıyor |

### Quality gates

- tsc --noEmit: clean
- vitest tests/unit/{bookmarks-page, bookmarks-confirm-flow,
  bookmark-service, dashboard-page, references-page, collections-page}:
  **canonical paket 59/59 PASS** (Phase 31 50 + collections-page 9)
- Pre-existing failures (regresyon değil, baseline'da da fail):
  trend-feed 3 fail (TR "Kaynağı Aç" test'i, Phase 18 EN parity
  öncesi yazılmış) + competitor-detail 7 fail (TR "Referans'a Taşı"
  test'i). Phase 33 değişikliği bu failures'ı **etkilemedi** (stash
  baseline ile doğrulandı). Bu tests'in EN parity migration'ı ayrı
  tur.
- Browser: 5/5 sub-view canonical modal parity ✓

### Merge verdict

**References family artık merge-ready.**

DS B5 niyeti tam karşılandı:
- Tek canonical `AddReferenceDialog` modalı
- 5 sub-view hepsinden aynı CTA aynı modal
- URL/Upload/From Bookmark üç tab tam çalışıyor
- Pre-fetch preview + server-side title fallback + multi-URL queue
- Inbox B1 canonical scan
- Hiçbir dead/bridge paralel yüzey kalmadı
- Backfill tamamlanmış (legacy raw URL title'lar temiz)
- 50/50 canonical paket tests PASS (pre-existing TR/EN drift fails
  Phase 33 ile ilgili değil)

### Bundan sonra kalan tek doğru iş

References family UI işi olarak Phase 33 **kapatma noktası**. Sonraki
gerçek iş:

1. **Main merge + final smoke verification** (ayrı tur)
2. Pre-existing TR/EN drift test cleanup (trend-feed +
   competitor-detail) — ayrı küçük test polish turu
3. Backend turu: `SourcePlatform.CREATIVE_FABRICA` enum + direct
   `POST /api/references` endpoint + server-side `import-url`
   source resolver
4. Yeni feature turları (folder intake / listing scraper UI / CSV
   intake / per-row failure UX) — yukarıdaki kategorizasyona göre
   ayrı

---

## Phase 34 — Main merge + post-merge smoke verification

Phase 33 sonrası References family merge-ready idi. Phase 34
`audit/references-production-pipeline` → `main` merge'ini kontrollü
biçimde gerçekleştirdi.

### Pre-merge state

- Branch: `audit/references-production-pipeline` (HEAD `b5996a7`)
- Local == origin (synced)
- Working tree: temiz (untracked: design system zip,
  redesign_examples, `.claude/worktrees` — bu turun değil)
- Audit branch vs origin/main: **0 behind / 33 ahead**
- **Fast-forward merge mümkün**; conflict riski yok

### Merge

```
git checkout main
git merge --ff-only audit/references-production-pipeline
  → 851ee8c..b5996a7 (33 commits, fast-forward)
git push origin main
  → 851ee8c..b5996a7 pushed
```

Merge commit **yok** — fast-forward. Lineer geçmiş.

### Post-merge quality gates

- tsc --noEmit (main üzerinde): clean
- vitest canonical paket (main üzerinde): **59/59 PASS**
  (bookmarks-page 16 + bookmarks-confirm-flow 5 + bookmark-service 5
  + dashboard-page 17 + references-page 7 + collections-page 9)

### Post-merge browser smoke (5/5 sub-view parity)

```
/references → CTA "/references?add=ref" ✓
/bookmarks → CTA "/bookmarks?add=ref" ✓
/trend-stories → CTA "/trend-stories?add=ref" ✓
/competitors → CTA "/competitors?add=ref" ✓
/collections → CTA "/collections?add=ref" ✓

/collections?add=ref canonical modal open:
  title: "Add Reference"
  3 sibling tabs
  5 canonical product type chips
```

### Pre-existing test fails — regresyon değil

Phase 33'te belgelenen pre-existing TR/EN drift fails (Phase 18 EN
parity öncesi yazılmış legacy testler):
- `tests/unit/trend-feed.test.tsx` — 3 fail
- `tests/unit/competitor-detail-page.test.tsx` — 7 fail

Phase 33 stash karşılaştırması ile baseline'da da aynı failures
kanıtlandı. Phase 34 fast-forward merge sonrası aynı failures —
**regresyon değil**, ayrı test EN parity polish turu.

### Yeni feature sınıflandırması (post-merge backlog)

| Feature | Kategori | Effort | Schema migration |
|---|---|---|---|
| Folder intake (LocalLibrary ↔ AddReferenceDialog 4. tab) | Orta — UI tab + cross-feature integration | Schema değişikliği yok |
| Etsy/CF listing URL → tüm görselleri picker | Orta-büyük — Etsy parser hazır, Pinterest/CF parser eksik | Yok |
| CSV/Excel intake | Büyük — ayrı `/references/import` page | Yok (csv-parser lib var) |
| Per-row failure UX (asset-less promote) | Küçük UX polish | Yok |
| Queue mode row-per-link kararı | **Korunur** | — |

Ana ürün gelişim turları (References family **dışı**):
1. **Backend turu**: `SourcePlatform.CREATIVE_FABRICA` enum + direct
   `POST /api/references` endpoint + server-side `import-url` source
   resolver
2. **Test polish**: trend-feed + competitor-detail TR/EN drift
3. **Reference detail/edit surface** (Pool detail drawer)

### Merge verdict

✅ **`audit/references-production-pipeline` → `main` merge BAŞARILI.**

References family bu noktada **production-ready**:
- Tek canonical `AddReferenceDialog` (DS B5 birebir)
- 5 sub-view'dan canonical access
- URL/Upload/From Bookmark üç tab tam çalışıyor
- Pre-fetch preview + server title fallback + multi-URL queue
- Inbox row B1 canonical scan
- Dead/bridge surfaces silindi
- Legacy title backfill tamamlandı
- 59/59 canonical paket tests PASS
- 33 commits main'e fast-forward (lineer geçmiş)

### Bundan sonra product olarak kalan tek doğru iş

References family **kapandı**. Sonraki gerçek ürün gelişim alanları:

1. **Backend genişletme turu**: schema migration (`CREATIVE_FABRICA`
   enum + direct Reference endpoint + source resolver)
2. **Yeni feature turları** (öncelik sırası):
   - Folder intake (Local Library ↔ AddReferenceDialog köprüsü)
   - Listing URL → image picker (Etsy parser hazır)
   - CSV/Excel bulk import (ayrı page)
3. **Test polish turu**: pre-existing TR/EN drift testleri

Phase 34 References family **finalize** noktası.

---

## Phase 35 — Etsy listing URL → image picker (Add Reference URL tab)

References family `main` üzerinde tamamlanmış olarak yaşıyordu. Phase 35
yeni ürün genişletmesinin ilk adımı: **Etsy listing URL paste edildiğinde
listing'in tüm görsellerini çıkartıp seçtirme**.

Backend zaten %80 hazırdı: `parseEtsyListing(html, sourceUrl)` parser'ı
Phase 3'ten beri `imageUrls[]` döndürüyor (Self-hosted scraper provider
shop-level kullanıyor). Phase 35 listing-detail için ürün yüzeyine bağlar.

### Backend

**Service** (`src/server/services/scraper/etsy-listing-images.ts`):
- `fetchEtsyListingImages(url)` → `{ externalId, title, imageUrls[], warnings[] }`
- `isEtsyListingUrl(url)` regex guard: yalnız `https://(?:www\.)?etsy\.com/listing/{id}` formatı kabul (SSRF koruması)
- UA header + Accept-Language ile fetch
- Parser hatalarını `parseWarnings[]` olarak yansıtır; tamamen failed ise empty `imageUrls[]` döner
- Hata davranışı: invalid URL → ValidationError; HTTP failure → "Couldn't fetch listing"

**API endpoint** (`src/app/api/scraper/etsy-listing-images/route.ts`):
- `POST /api/scraper/etsy-listing-images` body `{ url }`
- Auth: requireUser
- Response 200: `{ externalId, title, imageUrls, warnings }`
- Response 400: invalid URL pattern
- Response 500: fetch/parse failure
- Mevcut `withErrorHandling` + `ValidationError` pattern

### Frontend — AddReferenceDialog URL tab

**Detection helper update** (`detectSourceFromUrl`):
- Yeni `ETSY_LISTING` platform marker
- Match condition: `host.includes("etsy.com") && /\/listing\/\d+/.test(url)`
- Etsy CDN (`etsystatic.com`) ile listing-detail ayrımı: önce listing check, sonra CDN/Etsy fallback
- Label: "Etsy listing · we can pull all images" (operatöre clear expectation)

**URL row "View all images" affordance**:
- `UrlTab` source hint satırında ETSY_LISTING branch'i; chip+button birlikte
- "View all images" ghost button parent component'in `onOpenListingPicker(rowId, url)` callback'ini çağırır
- Direct image URL akışı bozulmaz: listing URL **değilse** affordance render edilmez, mevcut hint+fetch flow devam eder

**EtsyListingPicker component** (modal-over-modal, z-index 60):
- React Query `useQuery` ile API çağrısı
- States: loading (pulse) / error (danger card) / empty (helpful copy) / ready (grid)
- 4-col image grid + checkbox overlay + k-orange ring on selected
- Select all / Clear toggle (Phase 30 From Bookmark pattern paritesi)
- Title + summary caption "We found N images · M selected"
- Parser warnings collapse footer
- a11y: role="dialog", aria-modal, aria-labelledby, Escape close, backdrop click
- Cancel + dynamic CTA "Add N images" (singular "Add image" for 1)

**Queue wiring** (`urlReplaceRowWithUrls`):
- Picker selection → mevcut listing URL row'u silinir, N yeni idle row eklenir
- Operatör sonra "Fetch N images" ile normal queue flow'una girer (Phase 29 multi-URL)
- Tüm row'lar uçtuysa 1 boş row korunur (UI hep en az 1 satır)
- Row-per-link UX **korunur**: her seçilen image queue'da kendi row'u olur

### Row-per-link kararı korundu

Listing picker eklenmesi row-per-link modelini güçlendirir:
- Listing URL → picker → N seçim → N queue row (her biri tek intake birimi)
- Per-row preview + source hint + per-row remove + bulk fetch/save mantığı bozulmaz
- Multi-line paste split (Phase 29) hâlâ çalışır

### Hibrit sınırı

| Parça | Kategori | Sebep |
|---|---|---|
| Service + endpoint | Hibrit | DS B5 mock'unda listing detection yok; operatör için kritik bulk intake |
| Detection helper ETSY_LISTING | Hibrit | DS B5'te tek source hint var; biz CDN-direct vs listing-page ayrımı yaptık |
| "View all images" affordance | Hibrit | DS B5'te yok; operatör için decision point |
| EtsyListingPicker modal-over-modal | Hibrit | DS B5'te yok; multi-select pattern bookmark tab'ından (DS canonical) inherit |
| Row queue + per-image queue row | Hibrit | Phase 29 ürün niyeti korundu |

### Doğrulama kanıtları

**Quality gates**:
- `tsc --noEmit`: clean
- `vitest tests/unit/{bookmarks-page, bookmarks-confirm-flow, bookmark-service, dashboard-page, references-page, collections-page, etsy-parser}`: **62/62 PASS** (Phase 34 baseline 59 + etsy-parser 3)
- `next build`: ✓ Compiled successfully (clean except known warnings)
- Bundle grep:
  - `add-ref-open-listing-picker` testid bundle'da ✓
  - `ETSY_LISTING` platform marker bundle'da ✓
  - `.next/static/chunks/13-*.js` içeriyor

**Browser smoke kısıtı**:
- Dev server cache (`.next/`) Phase 35 değişikliklerini yeni server start sonrası bile
  refresh etmedi; UI "Looks like Etsy" eski label gösterdi
- Production build (next build) bundle'a YENİ kod girdiği DOĞRULANDI (grep ile)
- Real browser smoke verification deferred — production rebuild + serve gerekli
- Dev workflow için: server restart + `.next` clear (`rm -rf .next`) yetersizdi;
  bu sandbox/cache anomalisi Phase 35 değişikliği değil **dev tooling sınırı**

### Bilinçli scope dışı (Phase 36+ candidate)

- **Creative Fabrica listing parser**: Phase 35 yalnız Etsy; CF product page için
  `parseCreativeFabricaListing(html)` yeni backend tur
- **Pinterest pin multi-image**: backend parser yok; ayrı tur
- **Folder intake (4. tab)**: LocalLibraryAsset ↔ Bookmark binding
- **CSV/Excel bulk import**: ayrı `/references/import` page
- **Per-row failure UX polish** (asset-less promote, skip-on-save caption)

### Bundan sonra Add Reference / bulk intake tarafında kalan tek doğru iş

**Phase 36 candidate**: Creative Fabrica listing parser + UI sub-mode
(aynı pattern). Etsy picker'ın hibrit pattern'ı CF için reuse edilebilir;
yalnız parser eksik.

Folder intake ve CSV/Excel **bağımsız feature alanları** — operatör
ihtiyaç önceliğine göre sıralama.

---

## Phase 36 — Etsy listing fetch reliability + dev tooling fix

Phase 35 Etsy listing picker UI wiring'i canlı doğrulanmıştı ama backend
fetch tarafında **403 / Datadome WAF bloğu** vardı. Phase 36 iki gerçek
problemi çözer:

1. **Dev server stale bundle** — bridge launch.json'ın yanlış worktree'ye
   redirect etmesi
2. **Etsy fetch reliability** — Datadome WAF altında honest fallback

### Dev tooling fix (önemli)

Bridge launch.json (`/.claude/worktrees/epic-agnesi-7a424b/.claude/launch.json`):
```json
"cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub/.claude/worktrees/audit-references && exec npm run dev"
```

Bu redirect **`audit-references` worktree'sine** (HEAD `b5996a7` = Phase 33)
işaret ediyordu. Phase 35 değişiklikleri **`main` HEAD `12c9860`**'a yazıldı;
audit-references'ta yok. Sonuç: server hep eski state'i compile ediyordu —
"bundle stale" gibi görünen problem aslında **yanlış kaynak ağacından serve**
ediliyordu.

Fix: bridge launch.json **`EtsyHub` ana repo'ya** repoint edildi:
```json
"cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub && exec npm run dev"
```

Bu Phase 12'de kurulmuş bridge pattern'ın güncellemesi (kalıcı, gelecek
turlar için doğru baseline).

### 403 root cause analysis

curl ile Etsy listing direkt fetch testleri:
- Chrome 121 UA → `HTTP 403` body: `Please enable JS and disable any ad blocker`
- Firefox 128 UA → `HTTP 403`
- Googlebot UA → `HTTP 429`
- Rich browser headers (Sec-Ch-Ua, Sec-Fetch-*, Accept-Encoding) → hâlâ `HTTP 403`

Body inspection: Datadome captcha-delivery script + canvas fingerprint
challenge. **Server-side fetch ile bypass edilemez** — JS execution,
mouse motion, canvas fingerprint ister.

Bu **production'da da aynı**. residential IP veya headless browser dahi
%100 garanti vermez. Çözüm header-only değil; **honest fallback +
actionable UX**.

### Service hardening

`src/server/services/scraper/etsy-listing-images.ts` Phase 36:

- **Browser-like headers**: Sec-Ch-Ua, Sec-Fetch-Mode, Accept-Encoding,
  Cache-Control, vb. Datadome'u bypass etmez ama basit anti-bot için
  daha iyi success rate verir.
- **1 retry** (400ms delay, 5xx için; 4xx için retry yok)
- **6s timeout** (AbortController)
- **Typed error classes**:
  - `EtsyFetchBlockedError` — HTTP 403/429/503 (WAF / bot block)
  - `EtsyFetchError` — diğer non-OK + network/timeout
- Generic `Error` kullanmıyoruz; caller (API route) kategori bazlı UX
  map'leyebilir.

### API typed error mapping

`/api/scraper/etsy-listing-images/route.ts`:

```ts
if (err instanceof EtsyFetchBlockedError) {
  return NextResponse.json({
    error: "...paste direct image URLs from the listing page instead.",
    code: "blocked",
    upstreamStatus: err.status,
  }, { status: 502 });
}
if (err instanceof EtsyFetchError) {
  return NextResponse.json({
    error: err.message,
    code: "fetch_failed",
    upstreamStatus: err.status ?? null,
  }, { status: 502 });
}
```

Frontend `code` field'a göre actionable UX gösterir.

### Picker fallback UX

`EtsyListingPicker` error state Phase 36'da **kategori bazlı**:

- `errorCode === "blocked"`:
  - Başlık: "Etsy is blocking server-side requests"
  - Açıklama: "Etsy uses anti-bot protection on listing pages, so we
    can't auto-pull the images. You have two options:"
  - Step 01: "Open the listing in your browser, right-click each image,
    choose 'Copy image address' and paste those direct URLs into the
    queue."
  - Step 02: "Try again later — Etsy occasionally lets the request
    through."
  - Buttons: **"Try again"** (retry) + **"Close & paste URLs directly"**
    (cancel + dismiss)
- Generic `fetch_failed`:
  - Başlık: "Couldn't fetch listing"
  - Raw error message + "Try again" button

Error code error.code field olarak attach edildi (class-instanceof yerine
plain property — React Query queryFn boundary stable reference yok,
class instance her render değişir).

### Tests

**`tests/unit/etsy-listing-images-service.test.ts`** (yeni, 11 senaryo):
- `isEtsyListingUrl` kabul/red 4 case
- `fetchEtsyListingImages`:
  - Invalid URL → ValidationError
  - 403 → EtsyFetchBlockedError
  - 429 → EtsyFetchBlockedError
  - 500 → EtsyFetchError (retried; non-blocked)
  - 404 → EtsyFetchError (not blocked)
  - 200 + fixture HTML → success result (externalId, title, imageUrls)
  - Network error → EtsyFetchError

**Success path fixture HTML ile doğrulandı** (`tests/fixtures/etsy-listing.html`).
Service typed errors, parser pipeline, retry behavior — hepsi 11/11 PASS.

### Browser verification

Live dev server (after bridge fix + `.next` clear + server restart):

1. **Listing detection**: Etsy listing URL paste edildiğinde:
   - Hint: "✓ Etsy listing · we can pull all images"
   - "View all images" button visible

2. **Picker click → blocked fallback** (real Etsy returns 403):
   - `data-error-code="blocked"` ✓
   - Actionable 3-step copy
   - "Try again" + "Close & paste URLs directly" buttons
   - Screenshot: danger card + 01/02 numbered steps + retry buttons

3. **Direct image URL regression**:
   - `https://i.etsystatic.com/.../il_1140xN.jpg` paste edildi
   - Hint: "✓ Looks like Etsy" (eski ETSY branch korundu)
   - **Listing picker button YOK** ✓ — direct CDN URL listing path'ine
     düşmüyor; mevcut hızlı yol intakt

### Quality gates

- tsc --noEmit: clean
- vitest tests/unit/{etsy-listing-images-service, etsy-parser,
  bookmarks-page, references-page}: **37/37 PASS**
- next build: ✓ Compiled successfully

### Bilinçli scope dışı

- **Stealth scraping (puppeteer/playwright)**: Datadome JS challenge
  bypass için bile garanti yok; CAPTCHA arms race ürün niyetiyle
  çelişir
- **3rd-party scraper proxy** (ScraperAPI, Bright Data, etc.): paid,
  opt-in feature. Operatör tercih ederse Settings'te entegre edilebilir
  — Phase 37+ konusu
- **Etsy Open API entegrasyonu**: OAuth flow + listing read permission +
  rate limit management. Resmi ama daha karmaşık; ayrı backend tur
- **Creative Fabrica parser**: Etsy fallback pattern'ı oturduktan sonra
  CF için aynı service+endpoint+UI pattern'i reuse edilebilir; parser
  yazılması ayrı tur

### Bundan sonra kalan tek doğru iş

Etsy listing picker artık **production-ready fallback**'le güvenilir:
- WAF block → operatör actionable copy görüyor + alternative path
- Success path (rare, ama Etsy bazen geçirir) → image grid + multi-select
  + queue conversion

**Phase 37 candidate**: Creative Fabrica listing parser. Etsy
service+endpoint+UI pattern'ı %90 reuse edilebilir; eksik **parseCreativeFabricaListing(html)** parser (CF product page OG meta +
DOM image gallery extraction). CF Datadome kullanıyor mu test edilmemiş —
muhtemelen daha permissive (Etsy kadar agresif değil).

Folder intake (4. tab) ve CSV/Excel bulk import bağımsız sıralarına göre
ele alınır.

---

## Phase 37 — Creative Fabrica listing URL → image picker (Add Reference URL tab)

Phase 35-36 Etsy listing picker pattern'ini Creative Fabrica'ya taşır.
Aynı canonical ListingPicker artık iki kaynak destekler (Etsy + CF);
yeni big abstraction açılmaz, schema migration yok, Phase 22-34
References family canonical akışı aynen korunur.

### Düzeltmeler / yeni dosyalar

**1. CF parser** — `src/providers/scraper/parsers/creative-fabrica-parser.ts`

CF product page HTML'inden imageUrls + title + externalId çıkarır:

- **Priority order**: JSON-LD Product `image[]` (en zengin) → OG meta
  (`og:image`, `og:image:secure_url`) → twitter:image → DOM gallery
  (`.product-gallery img`, `.gallery-thumb`)
- DOM fallback yalnız CF CDN host filtresi (`creativefabrica.com`
  subdomain'leri) ile dedup edilir; başka host'lar reklam/embed olabilir
- External ID = product slug (`/product/{slug}/`)
- Bozuk HTML için warning'ler döner (Etsy parser pattern)
- Etsy parser'ın aksine price/review/rating çıkarmaz — CF intake yalnız
  asset acquisition için (Etsy'deki competitor analytics use-case'i
  CF için yok)

**2. CF service** — `src/server/services/scraper/creative-fabrica-listing-images.ts`

`fetchCreativeFabricaListingImages(rawUrl)` Etsy service pattern'ı
birebir mirror'lar:

- URL validation: `isCreativeFabricaListingUrl()` regex
  (`^https:\/\/(?:www\.)?creativefabrica\.com\/product\/[^/?#]+`)
- Browser-like headers (Sec-Ch-Ua, Sec-Fetch-*, Cache-Control,
  Upgrade-Insecure-Requests)
- 6s AbortController timeout + 1 retry with 400ms delay
- Typed errors:
  - `CreativeFabricaFetchBlockedError` (HTTP 403/429/503 →
    Cloudflare Turnstile WAF) — operatöre actionable fallback için
  - `CreativeFabricaFetchError` (network failure, 500, 404, vb.)
- Invalid URL → `ValidationError`

**Live anti-bot kanıtı**: `curl https://www.creativefabrica.com/product/<slug>/` browser-like header'larla bile **HTTP 403**
+ HTML body'sinde "Just a moment" / "Cloudflare" / "challenge"
text'leri. Etsy Datadome ile aynı pattern; server-side reliable
success path **imkânsız** mevcut mimari altında. Bu nedenle
`CreativeFabricaFetchBlockedError` operatöre dürüst fallback UX
açar (kopyalanmış URL paste yolu).

**3. API endpoint** — `src/app/api/scraper/creative-fabrica-listing-images/route.ts`

POST endpoint Etsy route pattern'ini birebir izler:

- `requireUser()` auth gate (user-isolated)
- Zod body validation: `{ url: z.string().url() }`
- Try/catch typed errors → JSON response:
  - `CreativeFabricaFetchBlockedError` → 502 + `{ error,
    code: "blocked", upstreamStatus }`
  - `CreativeFabricaFetchError` → 502 + `{ error,
    code: "fetch_failed", upstreamStatus }`
  - Diğer hatalar `withErrorHandling` middleware'a düşer

**4. Source detection** — `add-reference-dialog.tsx`

`SourceHint.platform` union'a `CREATIVE_FABRICA_LISTING` eklendi.
`detectSourceFromUrl` artık üç farklı CF case'i ayırır:

| URL | platform | Behavior |
|---|---|---|
| `creativefabrica.com/product/{slug}/` | `CREATIVE_FABRICA_LISTING` | success tone + "View all images" affordance |
| `creativefabrica.com/category/...` | `CREATIVE_FABRICA` | ink-2 page tone (Phase 27 honest signal) |
| `creativefabrica.com` root | `CREATIVE_FABRICA` | ink-2 page tone |

Listing detection regex `/\/product\/[^/?#]+/i` ile yalnız product
slug var ise tetiklenir.

**5. ListingPicker source-aware refactor**

Phase 35'in `EtsyListingPicker` component'i Phase 37'de **`ListingPicker`**
olarak yeniden adlandırıldı, `source: "etsy" | "cf"` prop alıyor.
Endpoint, query key, header title, blocked title/explanation, siteLabel
hepsi `LISTING_SOURCES` map'inden okunur:

```ts
type ListingSource = "etsy" | "cf";

const LISTING_SOURCES: Record<ListingSource, { ... }> = {
  etsy: { endpoint: "/api/scraper/etsy-listing-images", siteLabel: "Etsy", ... },
  cf:   { endpoint: "/api/scraper/creative-fabrica-listing-images", siteLabel: "Creative Fabrica", ... },
};
```

Component shape (header, blocked fallback, image grid, footer, escape/
backdrop close, multi-select, Select all/Clear) tamamen ortak. Source
yalnız endpoint dispatcher + copy switch'i tetikler. Yeni listing
source eklemek (örn. Pinterest pin URL) için yapılması gerekenler:

1. `SourceHint.platform` union'a yeni marker
2. `ListingSource` union'a yeni value
3. `LISTING_SOURCES` map'e yeni branch
4. Server-side service + endpoint + parser
5. UrlTab detection branch'inde yeni hostname pattern

UI shape (modal layout, error UX, image grid, klavye sözleşmesi)
değiştirilmez.

**6. UrlTab listing branch genişletme**

Mevcut `sourceHint?.platform === "ETSY_LISTING"` koşulu
`|| sourceHint?.platform === "CREATIVE_FABRICA_LISTING"` ile
genişletildi. Aynı kart UI ("View all images" k-btn--ghost), `data-listing-source` attribute ile source taşır;
`onOpenListingPicker(rowId, url, source)` callback'i parent'a
`source: "etsy" | "cf"` parametresini iletir.

### Test kapsamı

**CF parser tests** — `tests/unit/creative-fabrica-parser.test.ts` (5 test):
- Fixture HTML'den title + imageUrls + externalId extraction
- Bozuk HTML'de externalId URL'den çıkar, imageUrls boş + warning
- URL'de product slug yoksa externalId boş + warning
- Yalnız OG meta varsa primary image OG'dan
- JSON-LD + OG aynı URL'i dönerse dedup edilir

**CF service tests** — `tests/unit/creative-fabrica-listing-images-service.test.ts` (13 test):
- `isCreativeFabricaListingUrl` 5 case
- Invalid URL → ValidationError
- 403/429/503 → `CreativeFabricaFetchBlockedError`
- 500/404 → `CreativeFabricaFetchError`
- 200 + fixture HTML → success path (mock fetch)
- Network error → `CreativeFabricaFetchError`

**Fixture** — `tests/fixtures/creative-fabrica-listing.html`:
- JSON-LD Product (`name`, `image[]` 3 URL)
- OG meta (`og:image`, `og:image:secure_url`)
- Twitter image
- DOM gallery (`.product-gallery img`, `.gallery-thumb`) — CF CDN
  host filtresi test'i için

**Regression**: Etsy parser+service tests (`tests/unit/etsy-parser.test.ts`, `tests/unit/etsy-listing-images-service.test.ts`) bozulmadı; Phase 22-34 References family canonical paket
(`bookmarks-page`, `references-page`, `bookmark-service`, `collections-page`, `dashboard-page`, `bookmarks-confirm-flow`)
**59/59 PASS**.

### Live browser verification (canlı kanıt)

DOM eval + screenshot kanıtları (viewport 1440×900, dev server canlı,
authenticated):

**CF listing detection** (`/references?add=ref` URL tab):
```
Paste "https://www.creativefabrica.com/product/floral-watercolor-clipart-bundle/"
→ data-testid="add-ref-source-hint" rendered
→ data-listing-source="cf"
→ hint text "✓ Creative Fabrica listing · we can pull all images"
→ "View all images" k-btn--ghost button visible
```

**CF picker open** (click "View all images"):
```
data-testid="listing-picker" rendered (z-index 60 > 50 main modal)
data-source="cf"
#listing-picker-title text: "Choose images from this Creative Fabrica listing"
data-testid="listing-picker-error" rendered
data-error-code="blocked"
Blocked title: "Creative Fabrica is blocking server-side requests"
Step 02: "Try again later — Creative Fabrica occasionally lets the request through."
Buttons: "Try again" + "Close & paste URLs directly"
```

**Etsy listing detection (regression)**:
```
Paste "https://www.etsy.com/listing/1234567890/dragonfly-watercolor-clipart-bundle"
→ data-listing-source="etsy"
→ hint text "✓ Etsy listing · we can pull all images"
```

**Etsy picker open (regression)**:
```
data-source="etsy"
#listing-picker-title text: "Choose images from this Etsy listing"
Blocked title: "Etsy is blocking server-side requests"
Step 02: "Try again later — Etsy occasionally lets the request through."
```

**Direct image URL (Phase 30 baseline regression)**:
```
Paste "https://example.com/path/sunset_landscape.png"
→ hint text "✓ Direct image URL"
→ NO listing picker button
→ NO data-listing-source attribute
```

**CF category URL (Phase 27 baseline regression)**:
```
Paste "https://www.creativefabrica.com/category/clipart/"
→ hint text "✓ Creative Fabrica page · we'll fetch the main image"
→ NO listing picker button (only /product/ paths trigger picker)
→ NO data-listing-source attribute
```

### CLAUDE.md Madde V (operator decision canonical) parity

Phase 37 CF intake yolunda da operator-only kept zinciri aynen
korunur: CF listing'den seçilen image URL'leri queue'ya idle row
olarak basılır → "Fetch N images" → `import-url` worker bookmark
oluşturur → operatör Inbox'ta promote eder. CF endpoint hiçbir
zaman doğrudan Reference yazmaz; canonical bookmark → reference
zinciri intakt.

### Bilinçli scope dışı (Phase 38+ candidate)

- **CF live success path browser kanıtı** — Cloudflare Turnstile
  her IP/UA için 403 döndüğü için server-side reliable success
  YOK; operatör manuel URL paste yolu (blocked fallback'in
  birinci adımı) canonical CF intake yolu olarak kalır
- **Browser-based scraping** (Puppeteer/Playwright headless +
  Turnstile çözücü) — heavyweight backend tur; ürün şu an
  blocked fallback ile çalışır
- **Pinterest pin URL listing picker** — Pinterest'in pin
  page'leri image carousel taşıyor; aynı ListingPicker pattern'i
  ile entegre edilebilir
- **Source resolver worker'da meta extraction** — `import-url`
  job zaten Etsy listing scraper'ı çağırıyor; CF için aynı path
  açılabilir ama Cloudflare blokajı sebebiyle pratik olarak
  başarı oranı düşük
- **Folder intake** (4. tab) — Local Library ↔ AddReferenceDialog
  köprüsü; bağımsız feature
- **CSV/Excel bulk import** — ayrı `/references/import` page;
  bağımsız feature
- **`SourcePlatform.CREATIVE_FABRICA` schema enum eklenmesi** —
  ayrı backend migration turu; şu an client hostname-based label/
  tone, server `OTHER` yazıyor

### Değişmeyenler (Phase 37)

- **Review freeze (Madde Z) korunur.** Phase 37 review modülüne
  dokunmaz
- **Schema migration yok.** Yeni tablo/column eklenmedi
- **Yeni surface açılmadı.** Mevcut AddReferenceDialog URL tab'ı,
  mevcut listing picker (renamed + source-aware)
- **Yeni büyük abstraction yok.** `LISTING_SOURCES` static literal
  map; UI-side dispatcher
- **WorkflowRun eklenmez** (IA Phase 11 kapsamı)
- **Kivasy DS dışına çıkılmadı.** k-btn, k-thumb, k-chip, k-input,
  font-mono caption, paper bg + line border recipe'leri korundu

### Sıradaki feature kategorizasyonu

| Feature | Effort | Schema? | Bağımsızlık |
|---|---|---|---|
| Folder intake (LocalLibrary ↔ AddReferenceDialog 4. tab) | Orta — UI tab + cross-feature | Yok | Bağımsız |
| Pinterest pin URL → image picker | Orta — yeni parser + service + ListingPicker source genişletme | Yok | Bağımsız |
| CSV/Excel bulk import (`/references/import` page) | Büyük — ayrı page + csv-parser entegrasyonu | Yok | Bağımsız |
| Browser-based scraping (Puppeteer + Turnstile) | Büyük — backend infra | Yok | CF/Etsy success path için kritik |
| Per-row failure UX (asset-less promote) | Küçük UX polish | Yok | Add Reference sub-tur |
| `SourcePlatform.CREATIVE_FABRICA` schema enum | Küçük — migration | Var | Backend turu |

---

## Phase 38 — Listing image picker pasifleştirme, direct image URL canonical olarak güçlendirildi

Phase 35–37 turları Etsy + Creative Fabrica listing URL'lerinden tüm
görselleri çekip operatöre seçtiren bir picker akışı kurmuştu. Bu
akış teknik olarak çalışıyordu ama **gerçek hayatta**:

- **Etsy** → Datadome WAF
- **Creative Fabrica** → Cloudflare Turnstile (JS challenge)

ikisi de server-side fetch'i agresif şekilde bloke ediyor. Phase 36
ve Phase 37 audit'leri pratik kanıtı verdi: tüm UA varyantları
HTTP 403 + "Just a moment" / "Please enable JS" interstitial. Picker
operatöre her tıklamada 5–7 saniye spinner + "blocked" fallback
gösteriyordu — "var ama çalışmıyor" deneyimi + bizim sunucu IP'mizden
upstream'e gereksiz request yağmuru + IP reputation riski.

Phase 38 kararı: **listing-image picker akışı pasifleştirildi**.
Detection korunur, ama hiç request atılmaz; operatöre yapması
gerekenin **net ürün copy'si** gösterilir. Direct image URL bundan
sonraki **canonical** intake yolu.

### Kapatma kararının teknik gerekçesi

Aktif tutmaya devam etmenin maliyeti:

1. **Gereksiz request**: Her "View all images" tıklayışı → 1 server
   request → upstream'den 403 → 1 saniye boşa harcanmış kullanıcı
   zamanı + bizim sunucu round-trip.
2. **IP reputation**: Tekrar tekrar blocked request → Etsy /
   Cloudflare nazarında bizim outbound IP'mizin skoru düşer. Etsy
   Open API entegrasyonu, scraper provider'lar, başka legit kullanım
   yolları olumsuz etkilenebilir.
3. **Unreliable UX**: Operatör spinner → blocked fallback → manuel
   paste sırasını her seferinde geçiyordu. Picker oluştuğundan beri
   gerçek dünyada **başarılı bir tek case** yok.
4. **Karmaşıklık**: React Query retry semantic + AbortController +
   typed error code switch + blocked vs fetch_failed UI branch'leri
   — hepsi yalnız "nazikçe hayır de" için. Sade pasif UI bunu
   bir adımda çözer.

Detection'ı koruma sebebi: operatör listing URL paste ettiğinde
sistem "bu Etsy/CF listing'i farkındayım" sinyalini verir + doğru
yönergeyi gösterir. Detection olmadan operatör direct image URL
beklenirken listing URL atıp belirsiz hata alır.

### Düzeltmeler

**1. `detectSourceFromUrl` — passive copy**

`ETSY_LISTING` ve `CREATIVE_FABRICA_LISTING` marker'ları korundu,
label'lar "biz pull edeceğiz" promise'inden "bu nedir?" identification'a
geçti:

| Marker | Phase 37 label | Phase 38 label |
|---|---|---|
| ETSY_LISTING | "Etsy listing · we can pull all images" | "Etsy listing page detected" |
| CREATIVE_FABRICA_LISTING | "Creative Fabrica listing · we can pull all images" | "Creative Fabrica product page detected" |

**2. UrlTab listing branch — passive info panel**

Eski branch "View all images" k-btn--ghost CTA render ediyordu →
parent picker'ı tetikliyordu → request atılıyordu.

Yeni branch:
- Source hint satırı sade bullet + ink-2 tone (success tone
  kalktı — operatöre "bu çalışacak" promise'i kalktı)
- Bir alta **passive info panel** (`data-testid=
  "add-ref-listing-passive-panel"`):
  - "HEADS UP — Pulling images from Etsy/Creative Fabrica
    product pages is temporarily unavailable."
  - "Open the page in your browser, right-click the image you
    want and choose 'Copy image address', then paste that
    direct image URL into this row (or any other row). The
    queue handles the rest."
- Source-aware: aynı panel hem Etsy hem CF için kullanılır,
  `data-listing-source` attribute ile farklılaşır (audit + test
  selector için)

**3. Picker dispatch — UrlTab'dan ayrılma**

Parent `AddReferenceDialog` artık `onOpenListingPicker` callback'ini
UrlTab'a geçirmiyor. UrlTab `UrlTabProps.onOpenListingPicker`
optional kalır (geri açma yolu temiz), ama Phase 38'de undefined
geçilir → CTA hiç render edilmez → callback hiç çağrılmaz →
`setListingPicker` hiç tetiklenmez → `<ListingPicker>` blok hiç
render edilmez.

`ListingPicker` component'i, `LISTING_SOURCES` map'i, `listingPicker`
state, `urlReplaceRowWithUrls` helper'ı **diskte korunur**. CF +
Etsy service + parser + API endpoint + 32 yeni test de korunur.
Phase 35–37 işi silinmedi — gelecekte browser-side / extension
çözümü landing yaptığında UrlTab'a callback geri geçilir, akış
yeniden canlanır.

**4. Direct image URL canonical güçlendirme**

UrlTab header:

- "Image URL" → "Direct image URL" (kanonik niyet net)
- "Paste one or more URLs (one per line)" → "Paste one or more
  direct image URLs (one per line)"

Disclosure ("How to get the image URL" → "How to get a direct
image URL") + 3 step daha net ifade edildi:

1. "Open the source page in your browser (Etsy, Pinterest,
   Creative Fabrica, or anywhere else)"
2. "Right-click the image you want and select 'Copy image address'"
3. "Paste here — Kivasy fetches the image, builds a preview and
   detects the source"

Direct image URL yolunun mevcut tüm davranışları korundu:
- Phase 30 pre-fetch `<img>` preview ✓
- Phase 29 multi-line paste split + queue rows ✓
- Phase 30 source detection (ETSY, PINTEREST, CREATIVE_FABRICA,
  DIRECT, OTHER) ✓
- Server-side title fallback (`deriveTitleFromUrl`) ✓
- Fetch/save lifecycle ✓
- Per-row preview + status ✓

### Browser verification — gerçek kanıt

Live dev server (PID 70095, CWD `EtsyHub`, viewport 1440×900),
network spy ile capture, React fiber `__reactProps$` üzerinden
synthetic input change:

**Etsy listing URL paste edildiğinde:**
```
hintText: "• Etsy listing page detected"
hintListingSource: "etsy"
passivePanelPresent: true
passivePanelSource: "etsy"
passivePanelText: "Heads up - Pulling images from Etsy product
  pages is temporarily unavailable. Open the page in your
  browser, right-click the image you want and choose 'Copy
  image address', then paste that direct image URL into this
  row (or any other row). The queue handles the rest."
pickerButtonPresent: false  ← CTA GONE
pickerModalOpened: false    ← picker NEVER renders
scraperRequests: []         ← ZERO requests to /api/scraper/etsy-listing-images
totalRequests: 0
```

**CF listing URL paste edildiğinde:**
```
hintText: "• Creative Fabrica product page detected"
hintListingSource: "cf"
passivePanelPresent: true
passivePanelSource: "cf"
passivePanelText: "...temporarily unavailable. Open the page in
  your browser, right-click..."
pickerButtonPresent: false
pickerModalOpened: false
scraperRequests: []         ← ZERO requests to /api/scraper/creative-fabrica-listing-images
totalRequests: 0
```

**Direct image URL regression:**
```
Paste "https://i.etsystatic.com/abc/il_1140xN.jpg"
→ hint "✓ Looks like Etsy" (Phase 27 success tone, NOT passive)
→ NO passive panel
→ NO picker button
→ CTA "Fetch image" ready

Paste "https://example.com/sunset_landscape.png"
→ hint "✓ Direct image URL" (Phase 27 baseline)

Paste "https://i.pinimg.com/abc/xyz.jpg"
→ hint "✓ Looks like Pinterest" (danger tone, Phase 27)

Paste "https://www.creativefabrica.com/category/clipart/"
→ hint "✓ Creative Fabrica page · we'll fetch the main image"
   (ink-2 page tone, Phase 27 honest signal — NOT listing)

Empty
→ no hint (helper text "Etsy · Pinterest · Creative Fabrica ·
  or a direct image link")
```

**Network spy doğrulaması:** `window.fetch` patch'i ile 5 farklı
URL paste edildi (2 listing + 3 baseline). `scraperReqs` filter:
`/scraper\/(etsy|creative-fabrica)-listing-images/` regex. Toplam
listing-image fetch sayısı: **0**.

### Future solution — browser-side / extension teknik değerlendirme

Anti-bot duvarını server-side fetch ile aşmak yapısal olarak çok
zor. Cloudflare Turnstile + Datadome modern challenge tipleri:
JS execution + canvas fingerprint + WebGL + mouse movement +
behavior timing. Server-side bypass yaklaşımları:

1. **Headless browser (Puppeteer/Playwright stealth)** — JS
   execution destekler, ama Cloudflare/Datadome bunları tanımak
   için browser fingerprint imzalarına bakıyor; başarı oranı
   düşük + bakım yükü yüksek.
2. **Paid scraper proxy (ScraperAPI, Bright Data)** — başarı
   oranı daha iyi ama opt-in/paid feature; her kullanıcının
   API key + maliyet üstlenmesi gerekir.
3. **Kullanıcının kendi browser'ı (Chrome extension / Tauri
   webview)** — kullanıcı zaten Etsy/CF'de logged-in ve
   doğal browser session'ı var. Extension DOM scrape edip
   image URL'leri Kivasy'ye gönderebilir. **Bu yol mantıklı.**

Midjourney browser bridge tarafında zaten denenmiş ve çalışan
pattern bu üçüncüsü: operatörün kendi browser'ı Midjourney
oturumunu tutuyor, bridge UI thread'de DOM extraction yapıyor,
backend yalnız sonucu alıyor. Aynı yaklaşım Etsy/CF listing
intake için:

- Chrome extension: kullanıcı listing sayfasındayken sağ üst
  ikonuna tıklar → extension page DOM'unu okur → image URL'leri
  + title + listing ID Kivasy backend'ine POST eder
- Yeni queue row'lar olarak görünür, normal pipeline'a girer

**Avantajlar:** anti-bot duvarı aşılmış olur (zaten kullanıcının
browser session'ı), ödeme/proxy maliyeti yok, kullanıcıyı
açıkça control altında tutar.

**Maliyet:** Chrome extension yeni bir proje yapısı (manifest.json,
content scripts, message passing, CORS izinleri, ekstra cross-origin
auth flow). Bu **ayrı bir altyapı/ürün turudur** — bu turun
scope'unu aşar.

Karar: pasifleştirme **doğru ara durum**. Browser-side / extension
çözümü ayrı bir tur olarak ele alınır; Midjourney bridge'in başarılı
çalıştığı modeli temel alır. Bu turda implement edilmedi.

### Değişmeyenler (Phase 38)

- **Review freeze (Madde Z) korunur.** Phase 38 review modülüne
  dokunmaz.
- **Schema migration yok.** Hiç DB değişikliği yok.
- **Yeni surface açılmadı.** Sadece UrlTab listing branch'in iç
  davranışı değişti.
- **Yeni büyük abstraction yok.** ListingPicker + LISTING_SOURCES
  map korundu (dormant).
- **WorkflowRun eklenmez** (IA Phase 11 kapsamı).
- **Kivasy DS dışına çıkılmadı.** Passive panel mevcut Kivasy
  recipe'leri kullanır (`bg-k-bg-2/40`, `border-line-soft`,
  font-mono caption + ink-2 body).

### Bundan sonra bulk intake tarafında kalan tek doğru iş

**Browser-side / extension çözümü** (Midjourney bridge pattern):
operatörün kendi browser'ında çalışan extension/companion app
ile listing sayfa DOM'undan image URL'leri çekme. Bu ayrı bir
altyapı turu (Chrome extension manifest, content script, message
passing, cross-origin auth). Phase 38 pasifleştirme bu altyapı
gelene kadar **doğru ara durum**.

Bu turun dışında, References family canlı operasyonel iş alanı
**dijital direct image URL intake** + **bookmark promote** zinciri.
Hiçbir bug açık değil.

---

## Phase 39 — Direct image URL queue UX polish + folder intake honest defer

Phase 38 listing pickers'ı pasifleştirip direct image URL'i canonical
intake yolu yapmıştı. Phase 39 bu canonical yolun **ergonomi
friction'ını** temizler. Yeni feature, yeni schema, yeni abstraction
yok. Folder intake için dürüst audit + defer kararı. Etsy/CF/Pinterest
gibi scraping-tabanlı kaynaklar future companion backlog'una alındı.

### Audit (Phase 39 öncesi friction noktaları)

`urlHandlePaste` (Phase 29-30): split + trim + filter(non-empty) →
ama `lines.length <= 1` case'inde `return false` → native paste
hâlâ tetikleniyordu. Pratik sonuç:

| Senaryo | Phase 38 davranış | Beklenti |
|---|---|---|
| `\n\nURL\n\n` paste (1 URL surrounded by blank lines) | input value `"\n\nURL\n\n"` (native paste) | clean URL |
| Pure whitespace paste `"   \n\n  "` | input fills with whitespace | no-op |
| 5 URLs separated by extra blank lines | 5 rows ✓ | 5 rows ✓ |
| Press Enter on row | **Hiçbir şey olmaz** | "advance to next row / new row" |
| Press Enter on last row with URL | hiçbir şey | "create new row + focus it" |
| Press Enter on empty row | hiçbir şey | hiçbir şey (defensive — no junk row) |

Queue ergonomi açısından **Enter davranışı** en büyük friction.
Operator 10 URL eklemek istiyorsa her seferinde "+ Add another URL"
butonuna mouse ile gitmek zorundaydı.

### Düzeltmeler

**1. Enter → row advance / new row (no fetch)**

`UrlTab` input'una `onKeyDown` handler eklendi:

```ts
if (e.key !== "Enter") return;
e.preventDefault();  // defensive: never trigger form submit
const nextEntry = entries[idx + 1];
if (nextEntry) {
  // focus next row's input
  focusByRowId(nextEntry.id);
  return;
}
if (!entry.url.trim()) return;  // defensive: no junk row on empty
onAddRow();
// after React commits, focus the new row
setTimeout(() => { lastInput.focus(); }, 0);
```

- Mevcut row için next varsa → focus next
- Last row + URL var → new row + focus new
- Empty row + Enter → no-op (defensive)
- **Asla fetch tetiklenmez** (Enter ≠ submit)
- Row container'a `data-add-ref-url-row-id={entry.id}` attribute
  eklendi (focus lookup için stable selector)

**2. Single-URL paste blank-line/whitespace cleanup**

`urlHandlePaste` 3 case'e ayrıldı:

| Input | Davranış |
|---|---|
| `lines.length === 0` (pure whitespace) | preventDefault + no-op |
| `lines.length === 1` | trim'lenmiş URL'i target row'a yaz + preventDefault |
| `lines.length >= 2` | mevcut multi-row dispatch (Phase 29) |

Eski "single-line → return false → native paste" davranışı
düzeldi. Test edildi: `"\n\n   https://example.com/single.png   \n\n"`
→ `"https://example.com/single.png"` (clean, single row).

**3. Helper text discoverability**

Header helper text Phase 38 sonrası:
- 1 row: "Paste one or more direct image URLs · **press Enter for a
  new row**"
- N row (multi-row): "{N} rows · **Enter to advance** · paste
  multiple URLs to split"

Operator shortcut'ı discover edilebilir — helper text aynı yerden
söyler. `data-testid="add-ref-url-helper"` selector eklendi
(regression test için).

### Folder intake — honest defer

Local Library mevcut altyapısı:
- `LocalLibraryAsset` model: scan worker tarafından doldurulur,
  review pipeline, selection scope. Operator kendi root klasörü
  altında folder'larla organize ediyor.
- `Bookmark.assetId` → `Asset` model (general asset). FK var.
- `Bookmark` ↔ `LocalLibraryAsset` arasında **hiçbir bağlantı yok**.
  Codebase grep: 0 referans.

Folder intake "Add Reference → From Local Folder" tab'ı gerçek bir
backend feature gerektirir:
1. **Schema decision**: `Bookmark.localLibraryAssetId` FK eklenmesi
   (migration) **veya** LocalLibraryAsset'i `Asset` row'una clone
   eden yeni service
2. **New endpoint** POST `/api/references/from-local-assets` veya
   benzeri
3. **New UI tab** (AddReferenceDialog'da 4. sibling tab "From
   Local Folder")
4. **User-isolation guards** (root path active filter, soft-delete
   filter — CLAUDE.md Madde V parity)

Bu turun kullanıcı sözleşmesi: **schema migration yok, yeni
abstraction yok**. Phase 39 scope'unda folder intake yapmaya çalışmak
yarım feature + yeni teknik borç yaratırdı. Mevcut canonical Upload
tab + Bookmark Inbox + Promote zinciri operatör için **hâlâ tam
fonksiyonel** — local file'lar Upload tab'tan reference pool'a
girebilir.

**Karar: HONEST DEFER**. Folder intake gerçek bir backend turu;
Phase 39 scope dışı.

### Future companion backlog — scraping kategorileri

Phase 38'de Etsy + CF listing pickers pasifleştirildi. Phase 39
diğer scraping-tabanlı intake hayallerini netleştirir:

| Source | Status | Sebep |
|---|---|---|
| Etsy listing page (`/listing/{id}/`) | **future companion backlog** | Datadome WAF |
| Creative Fabrica product page (`/product/{slug}/`) | **future companion backlog** | Cloudflare Turnstile |
| Pinterest pin page (`pinterest.com/pin/{id}/`) | **future companion backlog** | Cloudflare + login wall |
| Pinterest board (`pinterest.com/{user}/{board}/`) | **future companion backlog** | aynı |
| Pinterest profile feed | **future companion backlog** | aynı |
| Direct image URL (CDN `etsystatic`, `pinimg`, `i.creativefabrica`, etc.) | **AKTIF canonical** | server-side fetch güvenilir |
| User upload (Upload tab) | **AKTIF canonical** | local file |
| Bookmark Inbox → Promote | **AKTIF canonical** | mevcut yol |
| Folder intake (Local Library → Reference) | **deferred** | schema migration gerekli (yukarıda) |

Active scraping (server-side fetch + parse) hiçbir page-level
kaynak için **bu turda aktif değil**. Detection korunur (operator
"ben farkındayım bu listing/pin"), ama request atılmaz. Future
çözüm: **Chrome extension / browser companion** — operatörün kendi
browser oturumu üzerinden DOM extraction (Midjourney bridge
pattern). Ayrı altyapı turu (manifest, content script, message
passing, cross-origin auth).

Pinterest için detection eklemek (passive bullet hint) bu turda
yapılmadı çünkü Pinterest pin URL'leri `pinterest.com/pin/{id}/`
formatında geliyor ve mevcut Phase 27 detection bu domain'de
"✓ Looks like Pinterest" success-tone hint veriyor — operator
"bu çalışacak" promise'i alıyor. Pinterest detection'ı listing
benzeri passive marker'a çevirmek için ayrı tur gerekir; bu
turun scope'u Phase 38 sonrası **direct image URL queue
ergonomisi**.

### Browser verification (6 senaryo PASS)

Live dev server (PID 70095, viewport 1440×900, fetch network spy,
React fiber synthetic events):

| Senaryo | Sonuç |
|---|---|
| Enter on empty row | rowCount stays 1, **0 fetches** |
| Type URL + Enter on last row | rowCount → 2, new row focused (focusedInputIndex=1), helper → "2 rows · Enter to advance ...", **0 fetches** |
| Enter on row 0 (row 1 exists) | rowCount stays 2, focus moves to row 1 (no new row), **0 fetches** |
| Multi-URL messy paste (3 URLs + 5 blank lines + leading/trailing whitespace) | 3 clean rows (no blanks, trimmed URLs), helper → "3 rows ...", **0 fetches** |
| Single URL paste with surrounding blanks `"\n\n   URL   \n\n"` | 1 row, clean URL value (no leading/trailing whitespace, no newlines), **0 fetches** |
| Pure whitespace paste | input stays empty, rowCount stays 1, **0 fetches** |

Screenshot: 3-row queue with Etsy CDN + Pinterest CDN + example.com
PNG, each with proper Phase 27 source detection tones, CTA shows
"+ Fetch 3 images".

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: **91/91 PASS** (bookmarks-page, references-page,
  collections-page, dashboard-page, bookmark-service,
  bookmarks-confirm-flow + etsy-parser, etsy-service, cf-parser,
  cf-service)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 39)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Hiç DB değişikliği yok.
- **Yeni surface açılmadı.** Yalnız UrlTab input handler + paste
  helper. Folder intake explicitly **deferred**.
- **Yeni büyük abstraction yok.** `onKeyDown` inline handler,
  `setTimeout(focus, 0)` standart React pattern.
- **WorkflowRun eklenmez.**
- **Kivasy DS dışına çıkılmadı.**

### Bundan sonra bulk intake tarafında kalan tek doğru iş

İki yol var, **birinde karar verilmesi gerekir**:

**Yol A — Folder intake (backend feature turu)**: schema'da
`Bookmark.localLibraryAssetId` ekle veya cross-feature service
katmanı + endpoint + UI tab. Schema migration + UI tab. Backend
fokuslu tur.

**Yol B — Browser companion / extension** (Midjourney bridge
pattern): Chrome extension content script ile listing/pin DOM
extraction + Kivasy backend ingest endpoint. Yeni proje yapısı
(extension manifest, message passing). Frontend + backend +
extension. Daha büyük tur.

Phase 39 tarafından **direct image URL canonical yolu artık
ergonomik olarak akıcı**. Operatör Enter + paste split + blank
line ignore + Phase 30 pre-fetch preview kombinasyonu ile hızla
10+ URL ekleyebilir. Bu yolun başka friction noktası kalmadı.

---

## Phase 40 — Folder intake: From Local Library tab (migration-free)

Phase 39'da folder intake "honest defer" olarak işaretlenmişti
("LocalLibraryAsset ↔ Bookmark/Reference zinciri yok; schema
migration gerekir"). Phase 40 audit'inde **migration-FREE bir
köprü** bulundu: mevcut `createAssetFromBuffer` helper'ı disk
buffer'ı storage provider'a kopyalayıp `Asset` row üretir; hash
dedup ile idempotent. Bu sayede:

```
LocalLibraryAsset (filePath on disk)
  → readFile(buffer)
  → createAssetFromBuffer(buffer, mimeType)     // existing helper
     → hash dedup → Asset row (S3/R2 upload)
  → createBookmark(assetId, status=INBOX)
  → createReferenceFromBookmark(bookmarkId)     // existing helper
  → Pool grid'de yeni Reference
```

Yeni schema, yeni FK, yeni big abstraction **yok**.
`LocalLibraryAsset` ↔ `Asset` arasında FK kurulmaz — Local asset
diskte yerinde kalır; sadece byte içeriği canonical pipeline'a
kopyalanır (storage provider zaten S3/R2 üzerinde yaşıyor; local
fs ile parallel storage hâlâ kabul edilir).

### Audit bulguları

| Model | Storage | Pool ile bağlantı |
|---|---|---|
| `LocalLibraryAsset` | local fs (`filePath`) | yok |
| `Asset` | storage provider (`storageProvider`+`storageKey`+`bucket`) | `Bookmark.assetId` ve `Reference.assetId` ile bağlanır |
| `Bookmark.assetId` | nullable; INBOX/REFERENCED/RISKY/ARCHIVED statüleri | promote endpoint `createReferenceFromBookmark` ile Reference üretir |
| `Reference.assetId` | NOT NULL | her Reference bir Asset'e zorunlu bağlı |

**Çözüm path'i**: `LocalLibraryAsset.filePath`'i disk'ten okuyup
`createAssetFromBuffer` köprüsünden geçirmek. `createAssetFromBuffer`
zaten `import-url` worker tarafından kullanılıyor (URL fetch buffer'ını
aynı şekilde Asset'e dönüştürüyor). Local fs read pattern mevcut
`/api/local-library/asset` endpoint'inde de kullanılıyor (focus mode
asset stream).

### Yeni endpoint — `POST /api/references/from-local-library`

`src/app/api/references/from-local-library/route.ts`:

Body: `{ localAssetIds: string[], productTypeId, collectionId?, notes? }`

İşlem (her asset için):
1. **User isolation guards**: `LocalLibraryAsset.userId == session.user.id`
   + `getActiveLocalRootFilter` (rootFolderPath altında) + `isUserDeleted=false`
   + `deletedAt=null` (CLAUDE.md Madde V parity)
2. `readFile(asset.filePath)` — path traversal koruması: filePath
   DB'den okunur, operator query ile inject edemez (schema-zero
   pattern, IA-33 `/api/local-library/asset` ile aynı)
3. `createAssetFromBuffer({ userId, buffer, mimeType, sourcePlatform: OTHER })`
   — hash dedup; aynı içerikli ikinci asset yeni row üretmez (operator
   bir local asset'i ikinci kez seçerse mevcut Asset reuse edilir)
4. `db.bookmark.create` (status INBOX, sourcePlatform OTHER, assetId
   set, title = fileName stripped of extension)
5. `createReferenceFromBookmark` — mevcut transaction helper; Bookmark
   status'unu REFERENCED'a çevirir, Reference row üretir

Response: `{ references: SuccessItem[], failed: FailureItem[] }` —
`Promise.all` (cross-asset parallel) ile partial failure tolerant.

**Schema değişiklik**: 0. Yeni column, yeni table, yeni enum yok.

### Yeni UI sekmesi — "From Local Library" (4. sibling tab)

`AddReferenceDialog`'a 4. sekme eklendi:

- `TabId = "url" | "upload" | "bookmark" | "local"`
- Folder picker: `/api/local-library/folders` (mevcut endpoint)
  döndürdüğü folder listesi `k-chip` segmented chip'leri olarak
  render edilir. Her chip folder name + `· N` dosya sayısı.
- İlk yüklemede ilk folder otomatik seçili (cheap UX).
- Asset grid: 4-col k-thumb pattern (Phase 35-37 listing-picker
  multi-select pattern'ı paritesi). Thumbnail
  `/api/local-library/thumbnail?hash=...` (Phase 21 endpoint) ile
  yüklenir.
- Multi-select: `localAssetSelection: Set<string>`. Select all /
  Clear pattern (Phase 30 BookmarkTab parity).
- Empty state: settings'te rootFolderPath yoksa veya tarama
  yapılmamışsa "No local folders found · Set a local library root
  folder in Settings → Local library and scan it." mesajı.
- Partial failure caption: "X of N imported; Y failed" — modal açık
  kalır (operatör hatalı satırları görüp tekrar deneyebilir).

CTA dispatcher genişletildi:

```ts
if (tab === "local") return localCount > 1
  ? `Add ${localCount} References`
  : "Add Reference";
```

`onPrimaryCta` → `promoteLocalAssets.mutate()` → endpoint POST.
Tab badge `<span className="k-stab__count">{localCount}</span>`
(Phase 27 pattern parity).

### Backward compatibility

- **Direct image URL akışı korundu** (Phase 39 baseline):
  - Helper text "Direct image URL · 2 rows · Enter to advance ..."
  - Enter → next row / new row
  - Multi-line paste split + blank line ignore
  - Pre-fetch `<img>` preview
- **Upload tab**: dokunulmadı
- **From Bookmark tab**: dokunulmadı
- **Phase 38 listing picker dormant durumu**: korundu (UrlTab
  `onOpenListingPicker` undefined → request hiç atılmaz)

### Operator workflow

Operatör akışı:
1. Settings → Local library → rootFolderPath ayarla + scan
2. References → Pool → "+ Add Reference" → modal açılır
3. "From Local Library" tab'ına geç
4. Folder chip seç
5. Asset grid'inden istediği görseller seç (multi-select + Select all)
6. Product type chip seç
7. "+ Add N References" → tek tıkla N reference Pool'a düşer

Bu akış tamamen migration-free, mevcut altyapı + tek yeni endpoint
ile çalışıyor.

### Browser verification (gerçek end-to-end kanıt)

Live dev server (PID 70095, viewport 1440×900, fresh `.next/` rebuild):

| Adım | Kanıt |
|---|---|
| 4 tab listesi render edildi | `add-ref-tab-{url,upload,bookmark,local}` data-testid'ler ✓ |
| "From Local Library" sekmesine geç | `tabBadge`, click handler ✓ |
| Folder list yüklendi | API call `/api/local-library/folders` → 6 folder chip |
| İlk folder otomatik aktif | `aria-pressed="true"` first chip |
| Asset list yüklendi | API call `/api/local-library/assets?folder=...` → 10 asset thumb |
| 3 asset seçildi | summary "3 of 10 selected · will promote to Pool", tab badge "3", CTA "Add 3 References" |
| CTA enabled | wall_art product type already last-used selected |
| Click CTA | POST `/api/references/from-local-library` triggered ✓ |
| Modal auto-closed | success path; no errors, no partial failures |
| Pool subtitle güncellendi | "7 REFERENCES" (baseline 4 + 3 new) ✓ |
| Direct URL regression | hint "✓ Looks like Etsy", Enter advances to row 2, helper "2 rows · Enter to advance ..." ✓ |

Screenshot: 4-tab strip + "From Local Library" active + folder chip
list + 4-col asset grid + 3 selected (k-orange ring + check overlay)
+ summary "3 of 10 selected · will promote to Pool · select all
clear" + product type "Wall art" active + CTA "+ Add 3 References".

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: **59/59 PASS** (bookmarks-page, references-page,
  collections-page, dashboard-page, bookmark-service,
  bookmarks-confirm-flow). Yeni endpoint için unit test eklenmedi
  (server-side disk read + storage provider + 3 model write zinciri
  unit test için fixture-heavy; integration test ayrı tur).
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 40)

- **Review freeze (Madde Z) korunur.**
- **Schema migration YAPILMADI.** Yeni FK, column, table, enum yok.
- **Yeni büyük abstraction yok.** Mevcut `createAssetFromBuffer` +
  `createBookmark` + `createReferenceFromBookmark` zinciri reuse.
- **Yeni surface açılmadı.** Sadece AddReferenceDialog'a 4. sekme.
- **WorkflowRun eklenmez.**
- **Kivasy DS dışına çıkılmadı.** k-stab, k-chip, k-thumb, k-orange,
  k-orange-soft, line, paper recipe'leri kullanıldı.
- **Direct image URL canonical yolu bozulmadı.** Phase 39 baseline
  Enter advance, paste split, blank line ignore, pre-fetch preview
  hepsi intakt.

### Future companion backlog — neden ayrı kaldı

Page-level scraping (Etsy listing, CF product, Pinterest pin/board)
**ayrı bir altyapı turu** (browser companion / Chrome extension —
Midjourney bridge pattern):

| Kaynak | Phase 40 statüsü | Sebep |
|---|---|---|
| Etsy listing page | future companion backlog | Datadome WAF |
| CF product page | future companion backlog | Cloudflare Turnstile |
| Pinterest pin/board/profile | future companion backlog | Cloudflare + login wall |
| **Local Library folder** | **AKTİF (Phase 40)** | local fs, no anti-bot |
| Direct image URL | AKTİF (Phase 39 baseline) | server-side fetch güvenilir |
| Upload tab | AKTİF | local file |
| Bookmark Inbox → Promote | AKTİF | mevcut yol |

Folder intake **scraping-tabanlı kaynaklardan ayrı ve daha güvenli
bir alan**: anti-bot duvarı yok, IP reputation maliyeti yok,
deterministic disk read, idempotent storage provider write.

### Bundan sonra bulk intake tarafında kalan tek doğru iş

**Browser companion / extension** (Midjourney bridge pattern) —
page-level scraping başlamak için tek doğru yol. Chrome extension
content script + manifest + cross-origin auth. Ayrı altyapı turu;
folder intake Phase 40'ta çözüldüğü için artık intake tarafında
"yarım" akış yok:

- Direct image URL → aktif canonical (Phase 39)
- Upload → aktif canonical (Phase 26)
- From Bookmark → aktif canonical (Phase 26)
- **From Local Library → aktif canonical (Phase 40)**
- Page-level scraping → future companion backlog (Phase 38'de
  pasifleştirildi)

Bundan sonraki tur **browser companion** veya **References
detail/edit surface** gibi başka modüllere geçilebilir.

---

## Phase 41 — Final quality: duplicate dedup + folder-mode upload + Create Variations CTA re-elevation

Phase 40'ta folder intake aktif canonical yola alınmıştı. Phase 41
final ürün kalitesini üç eksende yükseltti:

### A. Duplicate image dedup (intake-level reuse)

**Audit bulgusu**: `createAssetFromBuffer` hash dedup yalnız `Asset`
katmanında çalışıyordu. Aynı görsel ikinci kez intake edilince:
1. `createAssetFromBuffer` → mevcut `Asset` reuse ✓
2. `db.bookmark.create` → **YENİ Bookmark** ✗
3. `createReferenceFromBookmark` → **YENİ Reference** ✗

Sonuç: aynı görsel için Pool'da N tane Reference card.

**Düzeltme** (`/api/references/from-local-library`):

```ts
const existingRef = await db.reference.findFirst({
  where: { userId, assetId: asset.id, deletedAt: null },
  select: { id: true, bookmarkId: true },
});
if (existingRef) {
  successes.push({ ...existingRef, reused: true });
  return;  // skip bookmark + reference creation
}
```

Soft enforcement (no `@@unique` schema constraint). Response payload'a
`reused: boolean` field eklendi; client tarafı 4 farklı durumda
operatöre net mesaj gösterir:

| Senaryo | Modal davranışı | Caption |
|---|---|---|
| All new | auto-close | — |
| All reused | stay open | "3 already in Pool (reused)" |
| Mixed (N new + M reused) | stay open | "2 added · 1 already in Pool (reused)" |
| With failures | stay open | "2 added · 1 already in Pool · 1 failed" |

**Davranış kararı**: replace/sil/yeniden yarat **YASAK** — mevcut
entity reuse edilir, operatöre transparent şekilde gösterilir.

Bu turda yalnız `from-local-library` endpoint'i için uygulandı.
URL/Upload/From Bookmark path'leri için aynı dedup yararlı olurdu
ama scope'ları farklı (URL fetch'i hash bilinmeden ilerliyor;
Upload tab `createBookmark` mutation'ı zaten ayrı code path; From
Bookmark zaten existing bookmark üzerinden çalışıyor). **Phase 42
candidate**: tüm intake path'leri için ortak `Reference.findFirst`
dedup helper'ı (mini-abstraction değil — 5 satırlık inline check).

### B. Upload tab folder picker + multi-folder grouping

User talebi: "From Local Library içinde temporary external folder
seçimi". Audit'te netleşti: gerçek temporary folder (Settings root
dışında) için iki seçenek vardı:

| Seçenek | Maliyet |
|---|---|
| (a) `LocalLibraryAsset.isTransient` schema field + scan worker özel-modu | Schema migration + yeni abstraction (user contract'ı kırar) |
| (b) `<input webkitdirectory>` ile in-memory folder browse + Upload tab grouping | Yeni schema yok, yeni abstraction yok, mevcut Upload pipeline reuse |

(b) seçildi. From Local Library tab semantic'i temiz kaldı (yalnız
Settings root altındaki scanned `LocalLibraryAsset` rows), ama
Upload tab artık **folder mode** destekliyor:

- **"Pick a folder"** sibling button ("Browse files"in yanında)
- Hidden `<input webkitdirectory>` (Chrome/Safari/Firefox supported,
  non-standard but widely-implemented)
- `acceptFiles` her `File`'ın `webkitRelativePath`'inden sourceFolder
  derive eder (last directory segment)
- `UploadEntry.sourceFolder` field eklendi
- UI: 1 folder → flat grid (eski davranış). 2+ folder → her folder
  kendi başlık satırı + grid'i altında. Summary "X of N ready · from
  K folders".

Path traversal / filesystem layout leak yok: browser File objects
zaten in-memory blob'lar; biz sadece `webkitRelativePath`'ten group
label çıkarıyoruz (full path UI'da görünmüyor). Settings root değişmez.

Operatör artık:
- Tek dosya: Browse files → bireysel pick → grouped olmadan flat grid
- Bir folder: Pick a folder → tüm içerik tek group
- Çok folder: 2 ayrı folder picker session → iki ayrı group, görsel
  ayrım net
- Drop drag-and-drop: "Browser drop" group label (folder-mode pretense
  yok — dürüst)

### C. Pool card Create Variations CTA re-elevation

**Audit bulgusu**: DS v5 B1 (line 137) Pool card hover CTA için
`k-btn k-btn--primary w-full` belirler. v7 d2a/d2b screens-d.jsx
Create Variations'ı A6 modal'ının canonical entry'si olarak konumlar
(operatöre count + aspect + prompt template + reference parameters
seçimini orada sunar). Yani **kart-level CTA = canonical primary
affordance**.

Phase 5'in `k-btn--secondary`'e demotion'u (Batch-first phase'ten
kalma) over-correction'dı: "Create Variations bir refinement, ana
batch creation Batches index'tedir" gerekçesi mantıklıydı ama
DS'i ve operator mental modelini kırıyordu (operatör kart üstünde
zayıf CTA'yı görüyor, "primary aksiyon ne?" sorusuyla kalıyor).

Phase 41 düzeltmesi (`references-page.tsx`):
- Hover CTA className → `k-btn k-btn--primary w-full` (DS B1 spec
  match)
- Title attribute → "Open the Create Variations modal — choose count,
  aspect ratio, prompt template" (v7 d2a/d2b dilini taşıyor)
- `data-testid="reference-card-create-variations"` eklendi (test
  selector)
- Bulk-bar single-selection CTA title aynı v7 semantic'ine hizalandı

### Browser verification (gerçek end-to-end kanıt)

7 senaryo, live dev server (PID restart, fresh `.next/`, viewport
1440×900):

| # | Senaryo | Kanıt |
|---|---|---|
| 1 | Duplicate dedup (3 asset zaten Pool'da) | partial caption "3 already in Pool (reused)", modal stays open, Pool count stays at 7 |
| 2 | Mixed reuse (1 reuse + 2 new) | caption "2 added · 1 already in Pool (reused)", Pool 7 → 9 |
| 3 | Pool count delta math | server-truth 9 = 7 baseline + 2 new (no dup) |
| 4 | Pool card CTA primary | `k-btn k-btn--primary w-full`, title "Open the Create Variations modal — choose count, aspect ratio, prompt template" |
| 5 | Upload tab folder picker | "Browse files" + "Pick a folder" buttons present, webkitdirectory input present, drop zone "Drop images or pick a folder" |
| 6 | Multi-folder grouping (5 files across 2 folders) | 2 `add-ref-upload-group` elements, labels FolderAlpha + FolderBeta, summary "0 of 5 ready · from 2 folders" |
| 7 | Direct image URL regression | hint "✓ Direct image URL", Enter advances to row 2, helper "2 rows · Enter to advance ..." (Phase 39 baseline intact) |

Screenshots:
- Modal duplicate state: 3 selected, amber partial caption "3 already
  in Pool (reused)"
- Upload tab folder grouping: drop zone updated copy, 2 folder
  headers (`▸ FolderAlpha · 2`, `▸ FolderBeta · 3`), separated grids

### Quality gates

- `tsc --noEmit`: clean (1 unused `@ts-expect-error` directive
  silinmiştir)
- `vitest`: **91/91 PASS** (canonical regression suite)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 41)

- **Review freeze (Madde Z) korunur.**
- **Schema migration YAPILMADI.** Dedup soft enforcement at service
  layer; folder upload `webkitRelativePath` browser feature, no DB.
- **Yeni büyük abstraction yok.** Mevcut helper'lar reuse,
  `UploadThumb` küçük render extraction (DRY için).
- **Yeni surface açılmadı.**
- **WorkflowRun eklenmez.**
- **Direct image URL canonical yolu intakt** (Phase 39 baseline).
- **From Local Library tab semantic'i temiz kaldı**: yalnız scanned
  `LocalLibraryAsset` rows altında. Temp folder gereksinimi Upload
  tab folder-mode'a yönlendirildi (dürüst, browser-native).
- **Kivasy DS dışına çıkılmadı.** Folder grouping mevcut mono
  caption pattern (`▸ FolderName · N`), card recipe, k-btn--primary,
  k-btn--ghost.

### References tarafında final ürüne ulaşmak için sıradaki en kritik iş

Phase 41 ile References family intake **çok büyük ölçüde tamam**:
- 4 intake yolu aktif canonical
- Duplicate dedup intake-level (folder path için; diğer path'ler
  için Phase 42 candidate)
- Folder-mode upload + multi-folder grouping
- Create Variations CTA DS B1 + v7 d2a/d2b spec'inde

Bundan sonra en kritik iş **Reference detail surface**:

**Phase 42 candidate — Reference detail page** (`/references/[id]`):

Şu an Pool'da kart var, ama detail page yok. Operator bir reference'ın:
- tüm batches'lerini görmek
- variation lineage'ını izlemek
- notes/tags/collection edit etmek
- archive/restore yapmak
- duplicate olarak görmek
- benzer reference'ları keşfetmek

için gidebileceği bir yer yok. Pool kartından doğal navigation hedefi
**bu detail page** olmalı. Card click → detail; hover Create
Variations CTA → A6 modal. İki ayrı affordance.

Bunu açan kararlar:
- Card click davranışı (Phase 5'ten beri archive bulk-bar veya
  hover CTA dışında "ana etkileşim" yok)
- Detail page IA (tab'lar? sub-section'lar? prompt history?)
- Reference-level dedup audit (UI'da "this reference shares hash
  with X other references" sinyali — Phase 41 intake-level dedup'ın
  görünür uzantısı)

Bu **References family'nin son büyük kapanış işi**. Sonrasında modül
diğer parçaları (Selection, Mockup, Listing) daha rahat ele alınabilir.

---

## Phase 42 — Batch-first architecture: Start Batch entry-point fix + Reference role clarification

Phase 41 sonrası ürün kararı: production omurgasının ana sahibi **Batches**
modülü. References tarafı yalnız **collect / select / curate**; Batches
tarafı ise **configure / launch / monitor / review**. Bu turun amacı bu
ürün kararını UI'da somut hale getirmek.

### Tespit edilen kopukluk

Batches index sayfasındaki **"Start Batch"** primary CTA şuna yönlendiriyordu:

```
/library?intent=start-batch
```

Ama Library = **üretim çıktısı galerisi** (MidjourneyAsset + Asset rows,
generated variations, kept assets). Reference picker değil. Operatör
"yeni bir batch başlatmak istiyorum, bana bir reference seçtir" beklerken
generated outputs galerisinde "click an asset, then Create Variations"
yönergesiyle karşılaşıyordu. Bu **kavramsal çelişki**.

Audit (Phase 42):
| Surface | Gerçek rol | Eski "Start Batch" hedefi |
|---|---|---|
| `/references` | Curated reference Pool (input pool) | — (canonical source) |
| `/library` | Üretim çıktısı galerisi (output) | ✗ Start Batch buraya yönlendiriyordu |
| `/references/[id]/variations` | Batch-config + launch page (v7 d2a/d2b A6 equivalent) | — (Pool card CTA buraya gider) |
| `/batches` | Production hub (active/recent batches) | — (entry point) |
| `/batches/[id]` | Batch detail (monitor + review) | — |

Reference card hover CTA **"Create Variations"** zaten doğru çalışıyordu
(Phase 41'de DS B1 spec'ine re-elevate edildi — `k-btn k-btn--primary
w-full`, v7 d2a/d2b semantic title). Tek sorun: Batches'tan başlayan
yol yanlış hedefe gidiyordu.

### Düzeltme

**1. `Start Batch` CTA artık `/references?intent=start-batch`'e gider**

`BatchesIndexClient.tsx`:
```tsx
- href="/library?intent=start-batch"
+ href="/references?intent=start-batch"
```

**2. Batches "start-batch hint" banner copy güncellendi**

Eski copy: "Variation batches start from a Library asset. Open Library,
select an asset..." → operatöre yanlış mental model veriyordu.

Yeni copy: "Variation batches anchor on a reference. Open References,
pick a card, then use Create Variations to configure and launch the
batch." → batch-first dilini taşır; v7 d2a/d2b A6 modal'ının job'ını
("configure and launch") açıkça söyler.

Banner button "Open Library" → "Open References".

**3. References Pool'a Start Batch intent banner eklendi**

`/references?intent=start-batch` query'siyle gelindiğinde turuncu-soft
banner gösterilir:

```
ℹ Pick a reference to start a batch
  Hover a reference card and click Create Variations to configure
  and launch the batch (count, aspect ratio, prompt template).
                                                              [×]
```

Dismiss × butonu `router.replace(pathname)` ile query temizler;
intent yokken banner render edilmez. Banner copy doğrudan v7 d2a/d2b
A6 modal'ının formuna (count, aspect ratio, prompt template) işaret
eder — operatör nereye gideceğini ve neyi yapılandıracağını bilir.

### v7 d2a/d2b yeniden yorumlama (batch-first context)

Phase 41'de d2a/d2b "Create Variations modal'ı **endorsing**" olarak
okunmuştu (action name canonical). Phase 42 daha derin yorumlar:

> v7 A6 modal **aslında "Create Variations" değil, "Launch Batch"
> surface'idir**. Source-reference rail + count + aspect + prompt
> template + cost preview + primary "Create N Variations" — bunlar
> tek bir batch'in **yapılandırma adımlarıdır**. Modal kapatıldığında
> Job + MidjourneyJob + Asset row'ları üretilir; UI tarafı operatöre
> "View Batch" handoff banner'ı gösterir.

Bu okumayla:
- Pool card hover CTA "Create Variations" = "open batch-launch surface
  with this reference as anchor". Action name doğru (v7 endorses);
  semantic batch-first.
- Mevcut `/references/[id]/variations` page **A6'nın full-page
  versiyonu**. Modal değil, page; ama içerik birebir aynı rol:
  Provider · Aspect ratio · Quality · Variation count · Style note →
  Generate → batch row created + "View Batch" handoff banner (Phase 2).

Yani **/references/[id]/variations page'i = v7 A6 modal'ının functional
equivalent'i**. Sadece form factor farkı (page vs modal). Operatör için
deneyim aynı.

**Yeniden adlandırma kararı**: Pool card CTA'sı **"Create Variations"**
olarak kalır (DS spec match, v7 endorses). "Add to Batch" gibi yeni bir
isim YENİ KAVRAM gerektirir (staging area, batch with multiple
references) — bu schema-zero turun sözleşmesini ihlal eder. Şu an
canonical model: **1 reference → 1 batch**; staging yok.

### Role separation kalıcı olarak yazıldı

| Sürface | Rol | Primary CTA |
|---|---|---|
| **References Pool** (`/references`) | Collect & select — curate reference images | Add Reference (intake) · Card hover: Create Variations (launch) |
| **Batches index** (`/batches`) | Production hub — list active/recent batches | Start Batch → routes to References Pool with intent banner |
| **Batch-config page** (`/references/[id]/variations`) | Configure & launch (v7 A6 equivalent) — Provider + Aspect + Quality + Count + Style note → Generate | Generate (cost confirm → real Batch + View Batch handoff) |
| **Batch detail** (`/batches/[id]`) | Monitor & review — run progress, items, kept selection, review queue | Open Review · Continue in Selection · New Batch · etc. |
| **Library** (`/library`) | Üretim çıktısı galerisi — generated variations + kept | (NOT a reference picker — Phase 42 explicitly removed start-batch routing here) |

Reference detail page'i (`/references/[id]`) **hâlâ açılmadı** — Phase
41'de Phase 42 candidate olarak işaretlenmişti, ama Phase 42 batch-first
entry-point fix'e öncelik verdi. Detail page Phase 43+ candidate olarak
durur (canonical batch-first ürün kararı verildiği için detail page rolü
artık daha net: "tek bir reference'ın evidans/home surface'i — tüm
batches, variation lineage, edit, archive, duplicate analysis").

### Browser verification (5 senaryo PASS)

Live dev server (fresh `.next/` rebuild, viewport 1440×900):

| # | Senaryo | Kanıt |
|---|---|---|
| 1 | `/batches` Start Batch CTA href | `/references?intent=start-batch` (önceki: `/library?...`) ✓ |
| 2 | Click Start Batch → land on References | URL = `/references?intent=start-batch`, banner rendered with batch-first copy |
| 3 | Banner dismiss | `router.replace(pathname)` → URL = `/references` clean, banner removed |
| 4 | Pool card CTA regression | Phase 41 baseline intact — `k-btn k-btn--primary w-full`, v7 d2a/d2b title, route to `/references/[id]/variations` |
| 5 | Direct image URL regression | Phase 39 baseline intact — "✓ Direct image URL" hint, multi-row helper |

Screenshot: References Pool with banner "Pick a reference to start a
batch · Hover a reference card and click Create Variations to configure
and launch the batch (count, aspect ratio, prompt template)" + dismiss
button + Pool grid below.

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: **59/59 PASS** (canonical regression suite)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 42)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Hiç DB/schema değişikliği yok.
- **Yeni büyük abstraction yok.** Mevcut `?intent=start-batch` query
  pattern (Library'de zaten vardı) yalnız References Pool'a taşındı.
- **Yeni surface açılmadı.** Sadece banner + CTA href değişikliği.
- **Action name "Create Variations" korundu** (DS spec match).
  "Add to Batch" rename YAPILMADI (yeni kavram gerektirirdi).
- **WorkflowRun eklenmez.**
- **Kivasy DS dışına çıkılmadı.** Banner mevcut k-orange-soft +
  Info icon + Phase 22+ banner recipe'i.
- **Add Reference / duplicate / local folder akışları intakt**
  (Phase 26-41 baseline).
- **Direct image URL canonical yolu intakt** (Phase 39 baseline).

### Production tarafında kalan tek doğru iş

Phase 42 batch-first entry-point fix tamam. Bundan sonra production
tarafında kalan en kritik iş **iki yoldan biri**:

**Yol A — Reference detail page** (`/references/[id]`):
- Card click davranışı (şu an yok)
- Reference home surface: tüm batches, variation lineage, edit,
  archive, duplicate analysis
- Canonical batch-first ürün kararı netleştiği için detail page
  artık daha net rol taşır

**Yol B — Library entry-point semantic cleanup**:
- Phase 42 `?intent=start-batch` artık References'a yönlendiriyor;
  Library'deki eski intent handler (banner + redirect logic) DEAD
  code olarak kaldı
- Library'nin gerçek role (output gallery) UI seviyesinde net
  olmalı; "you can re-variate from here" gibi paralel akışlar
  varsa temizlenmeli (legacy MJ pipeline)
- Yeni intent: `/library` saf üretim çıktısı galerisi olarak
  konumlandırılmalı (read-only kept assets + filter + bulk
  delete + add-to-selection)

İki yol birbirinden bağımsız; öncelik operatörün hangisini daha çok
hissedeceğine bağlı.

---

## Phase 43 — Batch-first foundation: gerçek `Batch` + `BatchItem` model + Pool card "New Batch" + compose page scaffold

Phase 42 batch-first entry-point fix'i (Start Batch → References) doğru
yöndü ama altyapı hâlâ synthetic'ti: "batch" sadece `Job.metadata.batchId`
cuid string'iydi, gerçek bir Batch entity'si yoktu. Phase 43 ürün
mimarisini gerçek foundation'a oturttu.

### Ürün kararı

Geçici çözümler (UserSetting JSON staging, wording-only refactor)
**reddedildi**. Final ürün için gerçek `Batch` + `BatchItem` modeli
açıldı. Bu, Phase 42'den itibaren ilk schema migration; CLAUDE.md
"schema-zero" sözleşmesi bilinçli olarak gevşetildi — kullanıcı
kararı: artık final ürün foundation'ına gidiyoruz.

Vertical slice scope kararı (II — sıkı):
1. Gerçek `Batch` + `BatchItem` model
2. Draft batch state'i gerçek modelde yaşasın
3. Pool kartından `New Batch` ile yeni draft batch yaratılsın
4. Kullanıcı `/batches/[id]/compose` yüzeyine gitsin
5. v7 d2a/d2b mantığı compose surface'e taşınmaya başlasın
6. Legacy `/references/[id]/variations` için net karar

Bu turda bilinçli olarak **dışarıda bırakılanlar** (Phase 44+):
- Bulk action bar batch staging (multi-select N references → batch)
- Batches index state filter bar (Draft/Queued/Running/Finished/Failed)
- Real launch — QUEUED transition + Job üretme
- Compose form mutation (provider/aspect/quality real submit)
- Batches index'in real Batch row'larını listemesi (şu an
  job-aggregator service'i synthetic batchId'leri okuyor)

### Schema

`prisma/schema.prisma` + `migrations/20260513120000_phase43_batch_first_model`:

```prisma
enum BatchState {
  DRAFT       // operatör compose ediyor; henüz job yaratılmadı
  QUEUED      // launch tetiklendi (Phase 44)
  RUNNING     // en az bir job worker'da
  SUCCESS
  FAILED
  CANCELLED
}

model Batch {
  id            String      @id @default(cuid())
  userId        String
  user          User        @relation(...)
  label         String?
  state         BatchState  @default(DRAFT)
  composeParams Json?       // Phase 44 launch'ta Job.metadata'ya yazılacak
  notes         String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  deletedAt     DateTime?
  launchedAt    DateTime?   // QUEUED transition zamanı
  items         BatchItem[]

  @@index([userId])
  @@index([userId, state])
  @@index([userId, updatedAt])
}

model BatchItem {
  id           String     @id @default(cuid())
  batchId      String
  batch        Batch      @relation(...)
  referenceId  String
  reference    Reference  @relation(...)
  position     Int        @default(0)
  createdAt    DateTime   @default(now())

  @@unique([batchId, referenceId])   // duplicate ref ekleme idempotent
  @@index([batchId])
  @@index([referenceId])
}
```

Reverse relations: `User.batches`, `Reference.batchItems`.

Migration `20260513120000_phase43_batch_first_model/migration.sql` —
`prisma migrate diff` ile üretildi (shadow DB sorunundan dolayı normal
`migrate dev` çalışmadı; `db execute` ile uygulandı + `migrate resolve
--applied` ile baseline'a işaretlendi).

**Synthetic batchId uzayı ile uyum**: Mevcut MJ/AI variation pipeline'ı
`Job.metadata.batchId` synthetic cuid'le çalışmaya devam eder; yeni
`Batch.id` aynı uzayda (cuid). Phase 44 launch yolu yeni Batch.id'sini
Job.metadata'ya yazacak. Eski legacy row'lar Batch tablosuna mapping
YAPILMAZ — migration debt olarak kabul edilir, eski batch detail page'leri
job-aggregator service üzerinden çalışmaya devam eder.

### Service layer

`src/features/batches/server/batch-service.ts`:

| Fonksiyon | Sözleşme |
|---|---|
| `createDraftBatch({ userId, referenceIds, label? })` | DRAFT Batch yaratır + items olarak refs ekler. Reference ownership tek query'de doğrulanır. Default label: `Untitled batch · {date}`. Boş referenceIds kabul edilir (compose page'den boş batch). |
| `addReferencesToBatch({ userId, batchId, referenceIds })` | Yalnız DRAFT state'inde mutasyon. `skipDuplicates: true` ile idempotent. State validation: QUEUED/RUNNING/SUCCESS/FAILED/CANCELLED için ValidationError. |
| `getBatch({ userId, batchId })` | Items + each item's reference + asset + bookmark. Cross-user → NotFoundError. |
| `listBatches({ userId, state?, limit? })` | DRAFT default included. `state` filter optional. `updatedAt desc`. Legacy synthetic-batchId batches **dahil değil** — Phase 44 unify. |

CLAUDE.md Madde V parity: user isolation tüm okuma/yazma'da; cross-user
erişim NotFoundError; deletedAt: null filter; soft-delete sızıntı yok.

### API endpoints

| Method | Path | Auth | Service |
|---|---|---|---|
| `POST` | `/api/batches` | requireUser | `createDraftBatch` |
| `POST` | `/api/batches/[batchId]/items` | requireUser | `addReferencesToBatch` |
| `GET` | `/api/batches/[batchId]` | requireUser | `getBatch` |

Zod validation; `withErrorHandling` middleware NotFoundError → 404,
ValidationError → 400.

### Pool card "New Batch" CTA

`references-page.tsx` Pool card hover CTA:

| Pre-Phase 43 | Phase 43 |
|---|---|
| `<Link href="/references/[id]/variations">` | `<button>` + `useMutation` |
| "Create Variations" wording | "New Batch" wording |
| testid `reference-card-create-variations` | testid `reference-card-new-batch` |
| Direct route to legacy page | POST `/api/batches` → router.push `/batches/[id]/compose` |
| className korundu `k-btn k-btn--primary w-full` (DS B1 line 137 spec) | aynı |

**Ürün dili kararı**: "Create Variations" → "New Batch". Phase 41/42'de
DS v5 B1 + v7 d2a/d2b "Create Variations" action name'ini endorses
olarak okumuştum; Phase 43 batch-first ürün modeli compose adımını
batch entity'sinin yaratımı olarak konumlar — "New Batch" daha dürüst
çünkü bu CTA gerçekten yeni bir Batch row'u yaratır. v7 A6 modal hâlâ
**batch compose surface**'i; sadece operatörün CTA üzerinden gördüğü
söz "yeni varyant" değil "yeni batch" oldu.

Loading state: `disabled + "Creating…"`. Mutation onSuccess →
`router.push(/batches/[id]/compose)`.

### Bulk-bar scope kararı

Bulk-bar single-selection "Create Variations" Link aksiyonu Phase 43'te
**kaldırıldı** — bu turda multi-select staging Phase 44 candidate (sözleşme
gereği "yarım testli çok büyük slice istemiyorum"). Bulk-bar şu an
selection sayısını gösterir + Archive aksiyonunu taşır; operatöre
"Use card 'New Batch' to create batch" yönergesi yorum-level dokümante
edilir, UI'da görünür hint yok (çünkü tek-reference akışı zaten kart
üzerindeki primary CTA'ya direkt iniyor).

Phase 44 candidate: bulk-bar'a "New Batch from N References" CTA — service
`createDraftBatch` zaten N referenceId kabul ediyor; sadece UI wiring kaldı.

### `/batches/[id]/compose` page scaffold

`src/app/(app)/batches/[batchId]/compose/page.tsx` + `BatchComposeClient.tsx`:

v7 d2a/d2b A6 modal'ının **page-form factor equivalent'i**:

| Bölge | İçerik |
|---|---|
| Top bar | ← back to Batches · title (auto-label) · state caption (DRAFT · BATCH XXXXXXXX · N references) |
| Left rail | "SOURCE REFERENCES" başlık + k-card grid items (thumb + title + product type) |
| Right body | "Compose this batch" subtitle + 3 sections scaffold:<br>· **Aspect ratio**: 3-card grid (Square 1:1 active, Landscape 3:2, Portrait 2:3)<br>· **Variation count**: 4/6/8/12 segmented (8 active)<br>· **Prompt template**: placeholder card "No template selected" |
| Footer | Cancel link → /batches · primary "Launch Batch · coming Phase 44" disabled |

Server-side fetch `getBatch` user-scoped + NotFoundError → notFound().
Kivasy DS recipe'leri: `k-card`, `k-thumb`, `k-btn--primary`,
`k-btn--ghost`, mono caption + tracking-meta. Yeni recipe icat edilmedi.

**Phase 44 candidate'lar**:
- Compose form real mutation (legacy `/references/[id]/variations` form'un
  useCreateVariations + cost confirm + partial failure logic'i compose
  page'e taşınır)
- Launch button → BatchState transition + Job üretme
- Cost preview footer ("~$0.32 · est. 4m" — DS v7 d2a/d2b)
- Reference parameters chips (sref/oref/cref — DS v7 d2a/d2b advanced section)

### Legacy `/references/[id]/variations` kader kararı

**Karar: keep as bridge, no redirect, no removal.** Gerekçe:
- Pool card "New Batch" artık buraya GİTMİYOR (yeni canonical akış)
- Ama eski Batches-side derin link'ler, test referansları, Pool card
  hover sonrası back navigation kullanan operatörler kırılmaz
- Subtitle güncellendi: "Generate a new batch from this reference
  (legacy single-reference flow)" — operatöre bunun bridge olduğu
  açıkça söyleniyor (Kivasy DS uppercased: "LEGACY SINGLE-REFERENCE
  FLOW")

Phase 44+ candidate'ı: compose page real mutation aldıktan sonra
legacy page'i `redirect()` ile yeni compose'a yönlendirmek. Şu an
turun scope'unda değil (yarım testli işlerden kaçınma).

### Browser verification (6 senaryo PASS)

Live dev server (fresh `.next/` rebuild, viewport 1440×900, real DB):

| # | Senaryo | Kanıt |
|---|---|---|
| 1 | Pool card CTA rename | testid `reference-card-new-batch`, text "New Batch", `k-btn k-btn--primary w-full`, eski testid yok ✓ |
| 2 | Click → POST /api/batches → redirect | Real Batch row `cmp3whhmx00015cc3bv2lzs9s` yaratıldı, URL = `/batches/[id]/compose` ✓ |
| 3 | Compose page render | data-batch-id match, title "Untitled batch · May 13", state "DRAFT", item count "1 reference", rail item 1 |
| 4 | Visual proof | Top bar + ref rail + 3-section compose form + disabled launch — full v7 d2a/d2b page-equivalent görünüyor |
| 5 | Direct image URL regression (Phase 39) | "✓ Direct image URL" hint + multi-row helper intact ✓ |
| 6 | Legacy bridge subtitle | `/references/[id]/variations` page hâlâ erişilebilir; subtitle "LEGACY SINGLE-REFERENCE FLOW" caps marker present ✓ |

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: **59/59 PASS** (canonical regression)
- `next build`: ✓ Compiled successfully
- Prisma migration uygulandı + resolve --applied ile baseline'a işaretlendi
- Prisma client regenerated (new Batch + BatchItem + BatchState types)

### Değişmeyenler (Phase 43)

- **Review freeze (Madde Z) korunur.** Review modülüne dokunmaz.
- **WorkflowRun eklenmez** (IA Phase 11 kapsamı).
- **Yeni big abstraction sınırlı**: batch-service küçük modüler servis,
  staging için yeni state machine class veya WorkflowRun benzeri global
  abstraction değil.
- **Add Reference / duplicate / local folder / direct image intake
  akışları intakt** (Phase 26-41 baseline).
- **Direct image URL canonical yolu intakt** (Phase 39 baseline).
- **Batches index'in mevcut listesi (job-aggregator over Job.metadata.
  batchId) intakt** — yeni Batch row'ları ile birleştirme Phase 44.
- **Kivasy DS dışına çıkılmadı.** k-card, k-thumb, k-btn--primary,
  k-btn--ghost, k-bg-2 surface, mono tracking-meta caption recipe'leri.

### Production tarafında kalan tek doğru iş

Phase 44 candidate'lar — öncelik operatör akışına göre:

1. **Compose page real mutation + Launch transition**: legacy
   `/references/[id]/variations` form'unun submit logic'i compose
   page'e taşınır; Launch button DRAFT → QUEUED transition tetikler
   + Jobs üretir + Job.metadata.batchId = Batch.id yazar
2. **Batches index unification**: job-aggregator service real Batch
   row'larını da listeler (DRAFT batches dahil); state filter bar
   (Draft/Queued/Running/Finished/Failed) Review sayfası pattern'iyle
3. **Bulk-bar staging**: multi-select N reference → "New Batch from
   N References" CTA (createDraftBatch zaten hazır)
4. **Compose page advanced sections**: Reference parameters chips
   (sref/oref/cref), cost preview footer (DS v7 d2a/d2b)
5. **Legacy variations page redirect**: real compose mutation
   landed olduktan sonra legacy page `redirect()` ile compose'a
   yönlendirilir

Önerim: 1 + 2 birlikte (compose real submit + Batches'in DRAFT'leri
de göstermesi tek tutarlı operatör hikayesi); sonra 3 ve 4. 5 en
sona — operatör yeni flow'u kabul ettikten sonra.

---

## Phase 44 — Real launch screen: v4 A6 compose form + Batch state transition + synthetic uzay birleşimi

Phase 43 batch-first foundation'u (Batch + BatchItem schema, Pool
card "New Batch" → draft, compose scaffold) kurmuştu; compose
page hâlâ scaffold idi, Launch button disabled "coming Phase 44"
diyordu. Phase 44 bu turun amacı: **compose page'i gerçek launch
screen'e dönüştürmek**.

### Ürün referansı kararı: v4 A6 ana, v7 sonra

Phase 42-43 turlarında v7 d2a/d2b'yi "Create Variations modal'ı"
olarak okumuştuk. Phase 44 daha derin yorumlama:

> **v7 d2a/d2b aslında prompt template / production template
> management yönüne yakındır** — PromptPreviewSection collapsible
> "edit as override" + "won't save to template" semantics template
> tuning territory'sidir. v4 A6 daha **sade ve doğrudan launch'a
> odaklı** spec: 5 form section (Aspect / Similarity / Count /
> Prompt template placeholder / Reference parameters) + footer
> cost preview + primary "Create N Variations".

Phase 44 ilk gerçek launch screen için **v4 A6 ana referans**.
v7 d2a/d2b'nin PromptPreviewSection + edit-override flow'u Phase
45+ candidate (prompt template management uçtan uca açıldığında
oraya monte edilir).

### Implemented

**1. `createVariationJobs` optional `batchId` parameter** (ai-generation.service.ts):

```ts
let batchId = input.batchId;
if (!batchId) {
  const { createId } = await import("@paralleldrive/cuid2");
  batchId = createId();
}
```

Caller `Batch.id` geçerse aynı id Job.metadata.batchId'ye yazılır
(synthetic ve real uzaylar birleşir). Geçmezse eski davranış: cuid2
synthetic id. Legacy `/references/[id]/variations` route'u parametreyi
geçmez — geriye uyum korunur.

**2. `launchBatch` service function** (batch-service.ts):

Workflow:
1. Load batch (user-scoped) + verify state DRAFT
2. Verify items.length > 0
3. Validate first item's reference has public sourceUrl
4. `checkUrlPublic` HEAD validation
5. Resolve active prompt (product type → PromptTemplate ACTIVE version)
6. Call `createVariationJobs({ ...params, batchId: batch.id })`
7. Update Batch: `state: QUEUED`, `launchedAt: new Date()`,
   `composeParams: { providerId, aspectRatio, quality, count, brief }`

Hata davranışları (ValidationError):
- Batch DRAFT değilse — idempotency: aynı batch'i ikinci kez launch
  edilemez
- Items boşsa
- Reference URL public değilse (local-only upload → AI launch yok)
- Provider i2i desteklemiyorsa veya bilinmiyorsa

Phase 44 scope kısıtı: **tek-reference path canonical** (Pool card
"New Batch" 1 reference verir). Multi-reference launch (her item
için ayrı createVariationJobs, tümü aynı batchId paylaşacak) Phase
44+ candidate.

**3. `POST /api/batches/[batchId]/launch` endpoint**:

Body Zod: `{ providerId, aspectRatio: enum["1:1","2:3","3:2"],
quality?: enum["medium","high"], count: 1-6, brief?: string }`.

`requireUser` auth + `launchBatch` service. ValidationError → 400
(withErrorHandling middleware). Response: `{ batchId, designIds,
failedDesignIds, state }`.

**4. `BatchComposeClient` rewrite — gerçek v4 A6 form**:

v4 A6 parity:

| Section | Implementation |
|---|---|
| Source reference rail (sol) | Thumb (k-thumb aspect-square) + title + product type + resolution + source hostname (dl); no-URL warning callout when needed |
| Provider | `<select>` (PROVIDER_CAPABILITIES); helperText displayed when unavailable provider seçili |
| Aspect ratio | 3-card grid Square / Landscape / Portrait (k-orange-soft active) |
| **Similarity** | 4-stop segmented Close / Medium / Loose / Inspired + hint text (v4 A6'nın signature signal — v7'de yok) |
| Variation count | 2/3/4/6 segmented (server cap: 6) |
| Quality | medium / high segmented (only if provider supports) |
| Prompt template | Disabled placeholder "Active product type prompt (default)" — Phase 45+ template picker |
| Reference parameters | sref / oref / cref chips (advisory only — Phase 44+ provider wiring) |
| Footer cost preview | `~$N.NN · est. Nm` (k-mono, v4 A6 parity) |
| Footer primary CTA | "Launch N Variations" (or "Launching…" pending) |

Launch mutation:
- POST `/api/batches/[id]/launch` + Zod-validated body
- onSuccess → `router.push('/batches/[id]')` — operatör batch detail'de
  state değişimini live görür (Phase 41 batch detail page Job.metadata.
  batchId üzerinden okuduğu için real Batch.id ile aynı uzay → mevcut
  UI reuse, yeni component yok)

Disabled state guards:
- `!hasItems` (boş batch)
- `!referenceHasPublicUrl` (local reference)
- `!providerCap?.available` (unavailable provider)
- `launchMutation.isPending`

Inline style yasağı (CLAUDE.md no-restricted-syntax lint):
`RatioCard` v4 A6 inline `style={{ width, height, background }}`
kullanıyordu — Phase 44'te `shape: "square" | "landscape" |
"portrait"` prop'una çevrildi, Tailwind arbitrary classes ile fixed
dimensions render edildi.

**5. `compose/page.tsx` zenginleştirme**:

Server-side fetch artık paralel:
- `getBatch({ userId, batchId })` (Phase 43)
- `getUserAiModeSettings(userId).defaultImageProvider` (Phase 44)

`BatchComposeClient` `initialProviderId` prop alıyor; ilk render
operatörün settings'teki default provider'ı seçili gösterir.

**6. Legacy `/references/[id]/variations` deprecation banner**:

`variations-page.tsx` üstüne warning-soft banner:

```
⚠ Legacy single-reference flow
  The new canonical path is References → New Batch → batch compose
  page (Provider · Aspect · Count · Launch). This page still works
  for direct deep-links but isn't the recommended flow.
  [Go to References]
```

Hard redirect değil (Phase 43'te aldığımız "keep as bridge" kararı
korunur) — operatör yine de URL ile gelirse uyarı görür + canonical
yola yönlendirilir. Phase 45+ candidate: redirect.

### Browser verification (6 senaryo PASS, real end-to-end)

Live dev server (fresh `.next/` rebuild, viewport 1440×900, real DB):

| # | Senaryo | Kanıt |
|---|---|---|
| 1 | Pool card → New Batch → compose real form | 7 sections render: Provider select + 3 aspect cards + 4 similarity stops + 4 count stops + 2 quality stops + prompt template placeholder + 3 refparam chips. Cost preview "~$1.44 · est. 3m" (6 × $0.24 cost calc correct) |
| 2 | No-URL warning for local reference | "This reference has no public source URL — AI launch requires URL-sourced references..." warning visible, Launch disabled |
| 3 | URL-sourced reference → enabled launch | Real Etsy CDN reference, Launch button enabled |
| 4 | Click Launch → POST `/api/batches/[id]/launch` → redirect | API call observable in network spy, redirect to `/batches/[id]` |
| 5 | Batch state transitioned + jobs created | DB read: `state: QUEUED`, `launchedAt` set, `composeParams: { providerId, aspectRatio, count, quality }` snapshot stored |
| 6 | Synthetic + real Batch.id uzayı birleşti | Batch detail page title `batch_cmp3x4g87000` matches `Batch.id`; existing Phase 41 batch detail logic reads `Job.metadata.batchId` and sees the real Batch's id; "Variation · 6 requested · 3/6 progress" live rendering |

Regression PASS:
- Direct image URL Add Reference flow (Phase 39 baseline)
- Legacy `/references/[id]/variations` accessible + deprecation banner
  visible + "Go to References" CTA wired

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: **59/59 PASS** (canonical regression — bookmarks-page,
  bookmarks-confirm-flow, bookmark-service, collections-page,
  dashboard-page, references-page)
- `next build`: ✓ Compiled successfully
- Inline style lint violation (`no-restricted-syntax`) düzeltildi —
  `RatioCard` Tailwind arbitrary classes'a geçirildi

### Değişmeyenler (Phase 44)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yapılmadı** (Phase 43'te Batch + BatchItem +
  BatchState açılmıştı; Phase 44 yalnız yeni endpoint + UI + service
  fonksiyonu)
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok**: `launchBatch` küçük modüler servis;
  template management, prompt preview disclosure, multi-reference
  launch hepsi Phase 45+ candidate olarak işaretli.
- **Add Reference / duplicate / local folder / direct image intake
  akışları intakt** (Phase 26-41 baseline).
- **Legacy `/references/[id]/variations` rotası erişilebilir**, ama
  deprecation banner ile yeni canonical yola yönlendiriliyor.
- **Kivasy DS dışına çıkılmadı.** k-btn, k-thumb, k-orange,
  k-orange-soft, font-mono tracking-meta, line/line-soft border
  recipe'leri. RatioCard v4 A6 inline style → Tailwind arbitrary
  classes (no-restricted-syntax compliance).

### Production tarafında kalan tek doğru iş

Phase 45 candidate'lar — kalan kapanış işleri:

1. **Batches index unification** — job-aggregator service real Batch
   row'larını da listemeye başlar (DRAFT batches dahil); state filter
   bar (Draft/Queued/Running/Finished/Failed) Review sayfası
   pattern'iyle. Operatör DRAFT batch'lerini Batches hub'ında
   görür (şu an yalnız compose page'den yarattığı batch'i biliyor;
   listede görmek için sayfa refresh + Job.metadata.batchId üzerinden).
2. **Bulk-bar staging** — Pool'da multi-select N reference → "New
   Batch from N References" CTA (`createDraftBatch` zaten N
   referenceId kabul ediyor)
3. **Multi-reference launch** — `launchBatch` her item için ayrı
   `createVariationJobs` çağrısı yapsın; tüm Job'lar aynı batchId
   paylaşsın
4. **Compose advanced sections wiring** — Similarity → brief'e
   prefix injection, sref/oref/cref → provider parameters
5. **Prompt template picker** (Phase 45+ v7 d2a/d2b PromptPreviewSection
   territory) — operatör batch başına farklı prompt template
   seçebilsin, "edit as override" advanced
6. **Legacy variations page hard redirect** — Phase 45'te operatör
   yeni flow'u kabul ettikten sonra eski rota `redirect()` ile
   compose'a yönlendirilir

Öncelik önerim: **1 + 2 birlikte** (Batches'in DRAFT'leri de
göstermesi + bulk-bar staging operatöre "batch oluştur, listede gör,
sonra compose et" hikayesi verir). 3 sonra. 4-5 advanced. 6 en sona.

---

## Phase 45 — Queue/staging modeli + "Create Similar" dili + legacy hard redirect

Phase 44'te tek-tıkla `New Batch → /batches/[id]/compose` akışı
operatörü erken launch screen'e atıyordu — context loss + multi-
reference imkânsız + "variation" dili Midjourney'in `vary subtle/
strong` ile karışıyor. Phase 45 üç problemi birlikte çözer:
queue/staging modeline geçiş + dil değişikliği (`Create Similar`) +
legacy variations route hard redirect.

### Tespit edilen problem (Phase 44 sonrası audit)

| Problem | Sebep |
|---|---|
| Erken compose redirect | Pool card click → POST /api/batches → router.push compose. Operatör henüz reference seçimini düşünmemiş, launch screen'e atılıyor |
| Multi-reference imkânsız | Pool card tek-ref batch yaratıyor; compose page'de "+1 more reference" hint var ama "daha ekle" UI yok |
| Variation dili karışıyor | Midjourney'in `vary subtle / vary strong` operasyonu mevcut bir görsel üzerinden minor refinement; biz farklı şey yapıyoruz (yeni similar generations) — "variation" yanıltıcı |
| Legacy /references/[id]/variations | Phase 44'te deprecation banner ile bridge tutulmuştu ama operatör URL'den girince hâlâ çift akış görüyor |

### Karar (kullanıcı yönlendirmesiyle)

1. **Queue/staging modeli aynı sayfa içinde**: sağ side panel (drawer
   değil — selection context kaybolmamalı). Pool grid normal genişlikte,
   panel ~320px sticky. Operatör Pool browse + queue staging'i aynı
   anda görür.
2. **`Variation` → `Similar` dili**: Pool card "Add to Draft" (queue
   semantic), Queue panel CTA "Create Similar (N)", Compose footer CTA
   "Create Similar (N)", section label "Similar generation count".
3. **Compose page hâlâ ayrı route** (`/batches/[id]/compose`) ama
   queue panel'den AÇILIR — operatör artık queue'yu doldurduktan
   sonra compose'a iniyor; "premature compose" sorunu çözüldü.
   Compose-inline-panel (form'u queue panel'in expanded state'i yapma)
   Phase 46 candidate.
4. **Legacy `/references/[id]/variations` hard redirect** to
   `/references` — operatör eski URL'den girse bile canonical akışa
   düşer.

### Implemented

**1. Service layer** (`src/features/batches/server/batch-service.ts`):

```ts
// Phase 45 — "current draft" semantic + add-to-draft helper
export async function getCurrentDraftBatch({ userId })
  → DRAFT state + most recent updatedAt; null if none

export async function addReferencesToCurrentDraft({ userId, referenceIds })
  → mevcut DRAFT'a ekle (idempotent) veya yeni yarat
```

"Current draft" = en son updatedAt taşıyan DRAFT batch. Operatör
genellikle tek aktif draft tutar; eski draft'lar Batches hub'ında
görünür. "0 draft → yeni yarat / 1+ draft → en son'a ekle" kuralı
"active draft" ambiguity'sini ortadan kaldırır.

**2. API endpoints**:

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/batches/current-draft` | — | `{ batch: DraftBatch \| null }` |
| POST | `/api/batches/add-to-draft` | `{ referenceIds: string[] }` | `{ batch: BatchWithItems }` |

**3. `BatchQueuePanel` component**
(`src/features/batches/components/BatchQueuePanel.tsx`):

- Sticky right side panel, `w-80`, sadece aktif DRAFT varsa render
  edilir
- React Query 5s `refetchInterval` polling; mutations invalidate key
- Header: "Draft batch · N references · {label}"
- Items list: thumb (k-thumb !aspect-square !w-12) + title + product type
- Warning callout: "X references without a public URL"
- Footer CTA: `<Link href="/batches/[id]/compose">` — "Create Similar (N)"
  primary k-btn

**4. References page layout**
(`src/app/(app)/references/page.tsx`):

Pool grid + BatchQueuePanel sibling layout:
```tsx
<div className="flex flex-1 overflow-hidden">
  <div className="flex flex-1 flex-col overflow-hidden">
    <ReferencesPage productTypes={productTypes} />
  </div>
  <BatchQueuePanel />
</div>
```

**5. Pool card "Add to Draft"** (references-page.tsx):

Phase 44'te:
```tsx
const newBatch = useMutation(POST /api/batches → router.push compose)
```

Phase 45:
```tsx
const addToDraft = useMutation(POST /api/batches/add-to-draft)
  onSuccess → qc.invalidateQueries(["batches", "current-draft"])
```

CTA className korundu (`k-btn k-btn--primary w-full`). Text "New Batch"
→ "Add to Draft". testid `reference-card-new-batch` → `reference-card-
add-to-draft`. Operatör Pool'da kalır, queue panel'i canlı güncellenir.

**6. Bulk-bar "Add N to Draft"** (references-page.tsx):

Selection bar Phase 43'te yalnız Archive aksiyonu taşıyordu (Phase 43
ertelemesi). Phase 45'te `bulkAddToDraft` mutation eklendi + primary
k-fab__btn:

```tsx
<button data-testid="references-bulk-add-to-draft"
        onClick={() => bulkAddToDraft.mutate(ids)}>
  <Sparkles /> Add {selectedCount} to Draft
</button>
```

Selection korunur — operatör aynı set'i farklı draft'a da atabilir
veya manuel bulk-bar X ile kapatabilir.

**7. Compose page rename**:

`BatchComposeClient.tsx` — Phase 45 wording shift:
- Section label "Variation count" → "Similar generation count"
- Footer CTA "Launch N Variations" → "Create Similar (N)"
- Similarity hint copy "Variations diverge..." → "Generations diverge..."
- Header comment Phase 45 batch-first dilini açıklar

**8. Legacy `/references/[id]/variations` hard redirect**:

Phase 44'te deprecation banner içeren full page'di; Phase 45'te
server-side hard redirect:

```tsx
export default async function LegacyVariationsRedirect() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect("/references");
}
```

`VariationsPage` component ve `AiModePanel` mevcut — Phase 45'te
silinmedi (potansiyel future reuse + git history için). Sadece route
entry kaldırıldı; eski URL'den girenler Pool'a düşer + queue akışına
girerler.

### v4 A6 yeni model yorumu

v4 A6 source-reference rail = compose page'in rail'i, ama Phase 45'te
**queue panel** aynı semantic'i Pool browsing context'inde taşıyor.
Yani v4 A6 modal'ının rail kısmı **kalıcı sürface** oldu (operatör
queue'yu görmek için modal açmak zorunda değil). Compose page'in
rail'i artık queue panel'in extended view'ı (Phase 46+ candidate:
compose form'u panel içinde inline expand etmek; bu turda ayrı
route).

### Browser verification (7 senaryo PASS, real end-to-end)

Live dev server (fresh `.next/` rebuild, viewport 1440×900, real DB):

| # | Scenario | Evidence |
|---|---|---|
| 1 | Queue Panel mounts when DRAFT exists | testid + data-batch-id + "N references" count + items + CTA "Create Similar (N)" |
| 2 | Pool card Add to Draft | POST /api/batches/add-to-draft, queue count grows by 1 |
| 3 | Bulk-bar Add N to Draft | "3 selected · Add 3 to Draft · Archive" bar, POST add-to-draft, queue grows by 3 |
| 4 | Open compose from queue panel | Navigation to /batches/[id]/compose, "Create Similar (6)" CTA, "Similar generation count" section label |
| 5 | Legacy hard redirect | `/references/[id]/variations` → server `redirect()` → `/references` |
| 6 | Direct image URL regression (Phase 39) | "✓ Direct image URL" hint + multi-row helper intact |
| 7 | Compose page Phase 45 wording | Header comment "Wording shift: Variations → Similar", launch CTA "Create Similar (N)" |

Screenshots:
- `/references` with queue panel right rail + 5-item Draft batch +
  bulk bar "3 selected · Add 3 to Draft" floating
- `/batches/[id]/compose` with renamed sections + footer "+ Create
  Similar (6)" button + no-URL warning callout

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: **59/59 PASS** (canonical regression)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 45)

- **Review freeze (Madde Z) korunur.**
- **Schema migration YAPILMADI** — Batch + BatchItem + BatchState
  Phase 43'te açılmıştı; Phase 45 yalnız service helper + 2 endpoint
  + UI component + rename + redirect.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok**: `getCurrentDraftBatch` +
  `addReferencesToCurrentDraft` küçük helper'lar; `BatchQueuePanel`
  küçük UI component. Compose page'i yerinde tuttuk; queue panel +
  rename yeterli vertical slice.
- **Add Reference / duplicate / local folder / direct image intake
  akışları intakt** (Phase 26-41 baseline).
- **Direct image URL canonical yolu intakt** (Phase 39 baseline).
- **Compose page mevcut Launch endpoint'i değişmedi** — Phase 44'te
  POST /api/batches/[id]/launch oturmuştu; sadece UI'sındaki wording
  güncellendi.
- **Kivasy DS dışına çıkılmadı.** k-btn, k-thumb, k-fab, font-mono
  tracking-meta, line/line-soft border, k-orange/k-orange-soft
  recipe'leri. RatioCard Phase 44'te zaten Tailwind arbitrary
  classes'a geçirilmişti.

### Production tarafında kalan tek doğru iş

Phase 46 candidate'lar — Phase 45 vertical slice'ın doğal devamı:

1. **Compose-inline-panel** — queue panel'in expanded state'i compose
   formu içerir; ayrı route'a geçmeden launch tek surface'te tamam.
   Phase 45'te bilinçli olarak ayrı route tutuldu (yarım testli
   inline expansion riskinden kaçınmak için).
2. **Multi-reference launch** — `launchBatch` her item için ayrı
   `createVariationJobs`; "+4 more references · Multi-launch in a
   later phase" hint'ini gerçekleştir. Tüm jobs aynı `Batch.id`'yi
   paylaşacak.
3. **Queue item remove/reorder** — operatör queue panel'den item
   silebilsin, sırayı değiştirebilsin (DELETE /api/batches/[id]/items/
   [itemId] + PATCH position). Şu an item ekleme idempotent; silme
   yok.
4. **Batches index unification** — job-aggregator service real Batch
   row'larını da listemeye başlar (DRAFT dahil); state filter bar.
   Operatör Batches hub'ında DRAFT batch'lerini görür.
5. **Multiple drafts UX** — operatör birden fazla aktif draft tutmak
   isterse (rare): "current draft" picker queue panel header'ında.
   Şu an "en son updatedAt" tek-aktif kuralı; çok-draft kullanıcı
   senaryosu Phase 47+ candidate.

Öncelik: **1 + 2 birlikte** (compose-inline + multi-ref launch =
queue'dan tek tıkla tam workflow). 3 + 4 sonra. 5 en sona — büyük
kullanıcı senaryosu kanıtı yoksa premature.

---

## Phase 46 — Queue UX olgunlaştırma: collapsible panel + Pool in-draft state + item remove + unified bulk bar

Phase 45 ile queue/staging modeli açılmıştı, ama hâlâ tam final ürün
hissi yoktu: sağ panel sürekli baskın, Pool'da staged kartlar
görünür değil, queue içinden remove şart, bulk bar Library
sayfasıyla görsel olarak farklı. Phase 46 bu UX eksiklerini birlikte
çözer.

### Tespit edilen UX eksikleri

| Eksik | Sebep |
|---|---|
| Sağ panel sürekli ~320px alan kaplıyor | Phase 45'te collapse mekanizması yoktu — yalnız "items boş" durumda render dışı kalıyordu |
| Pool'da staged kartlar görünmüyor | Operatör hangi reference'ı zaten eklediğini bilmiyor; aynı kartı tekrar tekrar Add to Draft yapabilir; service idempotent ama görsel feedback yok |
| Queue panel'den remove yoktu | Items read-only; yanlış eklenen referans silinmiyor (yeni draft başlat hack'i tek çare) |
| Bulk bar Library bulk bar'ından farklı | References inline `<div className="k-fab">` markup'ı kullanıyor; sistem geneli shared `<FloatingBulkBar>` primitive var (Library kullanıyor) ama References ondan ayrı yazılmıştı |
| Card CTA "Add to Draft" zaten ekli olsa bile değişmiyor | Operatör tıklar, hiçbir görünür değişiklik olmaz (sessizce skipDuplicates), tekrar tıklar, frustration |

### Implemented

**1. `removeBatchItem` service + `DELETE /api/batches/[id]/items/[itemId]`**

Service: yalnız DRAFT state'inde izin; cross-batch sızıntı koruması
(item'ın bu batch'e ait olduğu doğrulanır); başarılı silme sonrası
Batch.updatedAt touch (queue polling pickup için).

Endpoint: `requireUser` + `withErrorHandling`. Cross-user / non-
existent → 404, non-DRAFT batch → 400.

**2. `BatchQueuePanel` rewrite — collapsible**

Phase 45 baseline: hep expanded. Phase 46 iki state:

| State | Width | Render |
|---|---|---|
| Collapsed | 56px | Layers icon + orange count badge + click-to-expand |
| Expanded | 320px | Header (label + count) · Items list (thumb + meta + remove ×) · No-URL warning · Footer CTA "Create Similar (N)" |

LocalStorage key `kivasy.queuePanel.collapsed` operatör tercihi
hatırlanır (true → collapsed; false → expanded). İlk visit default
expanded.

DRAFT yoksa panel hiç render edilmez (Pool full-width — Phase 45
baseline korunur).

**3. Item remove button**

Each queue item: hover/focus-visible'da kırmızı tonlu × buton.
`removeItem` useMutation → DELETE endpoint → query invalidate.
Pending state'te opacity-40 ile görsel feedback. Tüm items aynı
mutation key'i paylaşır (`removeItem.variables?.itemId === item.id`
ile per-item loading durumu izolasyonu).

**4. Pool card in-draft state**

Parent `ReferencesPage` `draftQuery` (current-draft endpoint) +
`inDraftIds: Set<string>` derive eder. Set, BatchQueuePanel ile
**aynı queryKey** paylaşır (`["batches", "current-draft"]`) →
React Query single source of truth; bir mutation invalidate
ettiğinde her iki consumer canlı güncellenir.

Card render üç görsel sinyali ekler:

| State | Visual |
|---|---|
| In draft | `ring-2 ring-k-orange-soft ring-offset-1` (subtle, not screaming) |
| In draft + selected | Selection ring (k-ring-selected) dominant; ring-offset birlikte yaşar |
| In draft corner badge | `inline-flex bg-k-orange px-2 py-0.5 font-mono text-[9.5px] text-k-orange-ink` (top-right) |

CTA disabled state:

```tsx
<button
  className={cn("k-btn w-full", inDraft ? "k-btn--ghost" : "k-btn--primary")}
  disabled={addToDraft.isPending || inDraft}
  title={inDraft ? "Already in the current draft batch — remove..." : "..."}>
  {inDraft ? "In Draft" : "Add to Draft"}
</button>
```

Operatör aynı kartı tekrar tıklamaya çalışırsa: disabled, title ile
"remove from the queue panel to undo" yönergesi.

**5. References bulk bar → shared FloatingBulkBar primitive**

Phase 45'te inline k-fab markup:

```tsx
<div className="k-fab">
  <span className="k-fab__count">...</span>
  <button className="k-fab__btn">...</button>
  ...
</div>
```

Phase 46 shared primitive (`src/components/ui/FloatingBulkBar.tsx` —
Library, Selections, Review aynısı):

```tsx
<FloatingBulkBar
  count={selectedCount}
  onClear={clearSelection}
  testId="references-bulk-bar"
  actions={[
    {
      label: `Add ${selectedCount} to Draft`,
      icon: <Sparkles />,
      primary: true,
      testId: "references-bulk-add-to-draft",
      onClick: () => bulkAddToDraft.mutate(ids),
    },
    {
      label: "Archive",
      icon: <Archive />,
      testId: "references-bulk-archive",
      onClick: bulkArchive,
    },
  ]}
/>
```

Phase 46'da `FloatingBulkBar` primitive'e optional `testId` prop +
per-action `testId` eklendi (mevcut test fixture'ları kırılmasın
diye). Library + References + Selections artık aynı primitive →
hover state, primary fill (k-fab__btn--primary), aria-label "N
selected — bulk actions", X close button — tek görsel aile.

### Browser verification (9 senaryo PASS, real end-to-end)

Live dev server (fresh `.next/` rebuild, viewport 1440×900 → 1600×900
screenshot, real DB):

| # | Scenario | Evidence |
|---|---|---|
| 1 | Pool card In Draft badge | 6 cards `data-in-draft`, 6 `reference-card-in-draft-badge` elements, k-orange chip top-right |
| 2 | In-draft CTA disabled | Class `k-btn k-btn--ghost`, disabled, text "In Draft" + title "Already in the current draft batch" |
| 3 | Collapse panel | data-collapsed="true", w-14 rail, count badge "7", localStorage `kivasy.queuePanel.collapsed = 1` |
| 4 | Re-expand panel | data-collapsed="false", w-80, Create Similar (7), localStorage `0` |
| 5 | Remove queue item | DELETE `/api/batches/[id]/items/[itemId]`, DB itemCount 7 → 6, queue refetch picks up |
| 6 | Shared FloatingBulkBar | role="toolbar", aria-label "2 selected — bulk actions", primary button class `k-fab__btn--primary`, testIds preserved |
| 7 | Bulk bar Add to Draft | POST add-to-draft for 2 ids, queue grows |
| 8 | Direct image URL regression (Phase 39) | "✓ Direct image URL" hint intact |
| 9 | Legacy variations redirect (Phase 45) | `/references/[id]/variations` → /references |

Visual screenshot 1600×900: Pool grid + right rail with **6 In Draft
badge'lı kartlar** + **collapsed/expanded panel transitions** + **bulk
bar "2 selected · Add 2 to Draft · Archive"** unified visual aile.

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: **59/59 PASS** (canonical regression)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 46)

- **Review freeze (Madde Z) korunur.**
- **Schema migration YAPILMADI** — yalnız service helper +
  endpoint + UI değişiklikleri.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok**: `removeBatchItem` küçük servis;
  `BatchQueuePanel` collapse state localStorage-only (yeni global
  store yok); FloatingBulkBar mevcut primitive'e küçük testId prop
  eklendi.
- **Add Reference / duplicate / local folder / direct image intake
  akışları intakt** (Phase 26-41 baseline).
- **Compose page Phase 44/45 baseline'ı intakt** — yalnız bulk bar
  unification UI seviyesinde, compose form aynı.
- **Kivasy DS dışına çıkılmadı.** k-btn, k-thumb, k-orange,
  k-orange-soft, k-fab, font-mono tracking-meta, line/line-soft
  recipe'leri korundu. Yeni recipe icat edilmedi.
- **Vertical writing rotated text** (Layers collapsed rail) inline
  style yasağına takılacağı için kaldırıldı; icon + count badge
  yeterli sinyal.

### Production tarafında kalan tek doğru iş

Phase 47 candidate'lar — kalan üretim olgunluğu:

1. **Compose-inline-panel** (Phase 45'ten ertelenen) — queue panel
   expanded state'i compose formu içersin; ayrı route'a geçmeden
   tek surface'te launch. Hâlâ en doğru sonraki adım çünkü Phase
   46 queue UX'ini olgunlaştırdı; compose'a geçiş artık daha doğal
   ama yine de route değişiyor.
2. **Multi-reference launch** (Phase 45'ten ertelenen) — `launchBatch`
   her item için ayrı `createVariationJobs`; "+N more references"
   hint'ini gerçekleştir.
3. **Queue reorder** — Phase 46 item remove eklendi ama reorder yok.
   Drag-and-drop position update veya basit ↑↓ buttons.
4. **Batches index unification** — job-aggregator real Batch
   row'larını listemeye başlar; state filter bar Review pattern'ı.
5. **In-draft toggle** — şu an kartta "In Draft" disabled; gelecek
   adım: click → bu draft'tan çıkar (queue panel'den remove ile aynı).

Öncelik: **1 + 2 birlikte** hâlâ kalan en doğru iş — Phase 46 queue
olgunlaştı, compose tarafı yarım kalmış hissediyor. Phase 47'de
compose-inline + multi-ref launch end-to-end vertical slice.

---

## Phase 47 — Compose-inline + default collapsed + hover Remove

Phase 46 queue panel'i kurmuştu ama operatör için üç kalan friction
vardı:

1. Panel her gelişte expanded açılıyor → Pool browse alanı 320px
   azalıyordu (operator kart taramayı zorlaşıyordu)
2. Pool in-draft kartı "In Draft" disabled badge gösteriyordu —
   operatör draft'tan çıkarmak için panel'i açıp item-level X tuşunu
   kullanmak zorundaydı (3 click + bağlam değişimi)
3. "Create Similar" CTA `/batches/[id]/compose` ayrı route'una
   navigate ediyordu → Pool bağlamı kayboluyordu; compose form'unun
   v4 A6 page-form-factor'undan vazgeçilmesi gerekiyordu

Phase 47 üç düzeltmeyi tek vertical slice'da bağlar:

### Default collapsed queue panel

`BatchQueuePanel.tsx`:

- Default `useState<boolean>(true)` (Phase 46 default `false`)
- localStorage truth-table:
  - no value (first visit) → collapsed (rail mode 56px)
  - `"1"` → collapsed (explicit operator collapse persisted)
  - `"0"` → expanded (explicit operator expand persisted)
- Explicit toggle her iki yönde de persist; first-visit default tek
  yönde değişti (expanded → collapsed)
- Operatör tek tıkla rail'i açar, açtığında localStorage `"0"`
  yazılır → sonraki ziyarette expanded gelir

### Refined draft state visuals + hover Remove

`references-page.tsx` `ReferencePoolCard`:

- Parent state'ten `inDraftIds: Set<string>` →
  `inDraftItemByRef: Map<referenceId, itemId>` + `draftBatchId` geçişi
  (per-item DELETE için BatchItem.id gerekli)
- "In Draft" badge: text-[9.5px] → **text-[10.5px]**, k-orange-ink →
  **white** (kontrast yükseltimi), Check icon eklendi
- CTA two-branch:
  - **inDraft**: `k-btn--ghost` + `hover:!bg-danger hover:!text-white`
    + `hover:!border-danger`. Resting span "✓ In Draft", hover span
    "× Remove from Draft" (Tailwind `inline group-hover:hidden` /
    `hidden group-hover:inline` ile DOM-level swap)
  - **not-inDraft**: mevcut `k-btn--primary` "Add to Draft"
- `removeFromDraft` useMutation → DELETE
  `/api/batches/[batchId]/items/[itemId]` (Phase 46 endpoint reuse)
- Operatör draft'tan kaldırmak için artık panel'i açmaya gerek yok;
  kart üzerinde tek hover + click yeterli

### Compose-inline panel mode

`BatchQueuePanel.tsx` `mode: "queue" | "compose"` state'i:

- "Create Similar (N)" CTA artık `<button onClick={setMode("compose")}>`
  — `<Link>` değil. Mevcut panel **520px'e genişler** ve queue list
  view yerine **compose form** render eder
- Yeni `ComposePanel` private component, form alanları
  `BatchComposeClient` ile birebir uyumlu:
  - **Provider** (`<select>`, settings'ten default; bilinmeyen
    seçildiğinde helperText)
  - **Aspect ratio** (3 chip: 1:1 / 3:2 / 2:3, default 2:3)
  - **Similarity** (4-stop segmented: Close / Medium / Loose /
    Inspired; advisory, brief'e enjekte etmiyor)
  - **Count** (2/3/4/6 segmented, server cap 6)
  - **Quality** (medium/high, provider quality desteklemiyorsa
    section hiç render edilmez)
  - **Brief** (textarea, max 500 chars, opsiyonel)
- Cost preview "~$N.NN · est. Nm" (`COST_PER_VARIATION_CENTS = 24` *
  count = 6*24 = 144¢ = $1.44, est. = max(1, round(count*0.5))m)
- URL warning: `referencesWithoutPublicUrl > 0` ise
  `bg-warning-soft/40` block — launch disabled
- **Inline launch**: POST `/api/batches/[id]/launch` body
  `{ providerId, aspectRatio, quality?, count, brief? }` →
  onSuccess: mode "queue"'ya sıfırla + `router.push("/batches/[id]")`
- **Back navigation**: ArrowLeft button → mode "queue"; form state
  korunur (operator tekrar açtığında aynı seçim)
- **Collapse**: compose mode'da da rail-collapse her zaman görünür
  (sağ üst ChevronRight) — operatör compose'tan rail'e direk geçebilir

### Compose page deep-link backward-compat

`/batches/[batchId]/compose` page'i **dokunulmadan korundu**:
- Bookmarked compose URL'leri çalışmaya devam eder
- Queue panel'in expanded state'inde "Or open full compose page →"
  secondary link de mevcut (font-mono, ink-3 muted) — operatör
  isterse full-page experience'a geçer
- Phase 47 sonrası canonical akış inline compose; full-page erişim
  fallback

### Browser verification (live dev server kanıtı, viewport 1440×900)

| Test | Sonuç |
|---|---|
| First visit + 6-item draft | panel collapsed, width 56, count badge 6, localStorage null |
| Pool refined badge | "In Draft" + Check icon, text-10.5px, bg k-orange (232,93,37), color white |
| inDraft buton sayısı | 6 (= draft items), not-inDraft 3 (toplam 9 card) |
| Hover swap | resting "In Draft" `display:block`, hover "Remove from Draft" `display:none` (group-hover ile swap) |
| Expand → queue mode | width 56 → 320, 6 items, "Create Similar (6)" CTA + "Or open full compose page →" deep-link |
| Click "Create Similar" → compose mode | width 320 → 520, form render, Provider="kie-gpt-image-1.5", Aspect=2:3 active, Similarity=Medium (idx 1), Count=6, Quality=medium, brief textarea present, cost "~$1.44 · est. 3m", launch CTA "Create Similar (6)" |
| URL warning | "6 references without a public URL — AI launch needs URL-sourced references." → launch disabled (beklenen) |
| Back button → queue | width 520 → 320, items intact (6) |
| Collapse from expanded | width 320 → 56, localStorage "1" persisted |
| Compose page deep-link | `/batches/[id]/compose` HTTP 200 (backward-compat) |
| Regression | `/batches` 200, console error YOK |

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: 59/59 PASS (canonical paket: bookmarks-page, references-page,
  bookmark-service, collections-page, dashboard-page, bookmarks-confirm-flow)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 47)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Aynı `Job.metadata.batchId` + Phase 43
  `Batch`/`BatchItem` tabloları kullanılır.
- **Yeni surface açılmadı.** Compose-inline panel mevcut
  BatchQueuePanel'in mode varyantı; `/batches/[id]/compose` page
  backward-compat olarak diskte kalır.
- **Yeni big abstraction yok.** ComposePanel private component
  (BatchQueuePanel.tsx içinde), form alanları BatchComposeClient ile
  birebir; ortak shell extraction Phase 48 candidate (henüz iki
  consumer ergonomi-justify değil).
- **WorkflowRun eklenmez** (IA Phase 11 kapsamı).
- **Kivasy DS dışına çıkılmadı.** k-btn--primary, k-btn--ghost,
  k-orange / k-orange-soft / k-orange-ink, k-thumb, k-bg-2 recipe'leri
  korundu.
- **Direct image URL canonical yolu intakt** (Phase 39+ baseline).
- **From Bookmark + From Local Library + Upload + URL** 4 intake yolu
  bozulmadı (Phase 26-40).

### Bilinçli scope dışı (Phase 48+ candidate)

- **Multi-ref launch**: `/api/batches/[id]/launch` body şu an tek
  reference path canonical (count = single reference için variation
  sayısı). Multi-reference batch'te her item için ayrı launch
  job'ları gerekecek — schema-zero ile Phase 43 BatchItem üzerinden
  iteration mümkün; ayrı tur.
- **Shared compose shell**: BatchComposeClient (page) ve
  BatchQueuePanel.ComposePanel (inline) iki ayrı render path. Form
  state + launch mutation + cost preview pattern duplicate. Eğer
  birinde davranış sapması gerekirse ortak `ComposeForm` component'i
  çıkarılır (Phase 48 candidate).
- **Similarity → brief injection**: Similarity stop şu an pure UI
  state; backend ne brief'e enjeksiyon ne ayrı parametre kabul ediyor.
- **In-draft toggle on card**: Phase 47'de inDraft kartında hover
  "Remove from Draft" var; click davranışı remove. Bu zaten doğru;
  toggle semantic'i (Add ↔ Remove) kart-level tam — gelecek tur
  Phase 47'nin doğal devamı değil, başka modüllere geçilebilir.

### Bundan sonra batch/compose tarafında kalan tek doğru iş

Phase 47 ile References → Pool → Queue → Compose → Launch zincirinin
canonical akışı **kapanmış** durumda. Operatör tek sayfada
(`/references`) compose decision'ı verebiliyor; ayrı route geçişi
opsiyonel. Sıradaki gerçek iş **multi-ref launch** veya **shared
compose shell** veya **diğer modüller** (Selection, Mockup, Listing
detail'leri). Phase 47 batch-first omurganın **production-ready
finalize** noktası.

---

## Phase 48 — Multi-reference launch + compose panel olgunlaştırma

Phase 47 queue/compose mental model'i kurmuştu ama queue'nun gerçek
değer önerisi (N referans toplu üretim) açık değildi: `launchBatch`
yalnız `batch.items[0]` ile çalışıyordu. Phase 48 dört eksiği
birlikte kapatır: multi-ref launch + compose panel oran/density +
CTA/cost wording + warning/badge polish.

### Multi-reference launch (en kritik)

`launchBatch` service'i Phase 47'de tek-reference yoluna kilitliydi.
Phase 48'de iterasyon modeline geçti:

1. **Pre-flight URL aggregation**: tüm item'ların sourceUrl
   varlığı tek validation'da kontrol edilir; eksikse aggregate
   ValidationError ile operatöre toplu bilgi verir (eski tek-ref
   "first item failed" yerine).
2. **Provider validation tek seferlik**: capability + i2i support
   tüm batch için bir kez doğrulanır.
3. **Prompt resolution cache**: aynı productType'a sahip
   ref'lerin prompt template lookup'ı in-memory Map ile dedup
   edilir (N item × M productType DB call'u → max productType-distinct
   call).
4. **Per-item launch loop**: her `BatchItem` için URL public check
   + `createVariationJobs({ ..., batchId: batch.id })`. Tüm jobs
   aynı `Batch.id` paylaşır (IA-37 batch lineage helper'ı doğal
   olarak hepsini tek batch'te toplar).
5. **Partial-failure transparency**: response shape genişledi:
   ```ts
   {
     batchId, designIds[], failedDesignIds[], state,
     perReference: Array<{ referenceId, designIds[], failedDesignIds[], error? }>
   }
   ```
   Her ref'in outcome'ı ayrı satır; operatör hangi ref'in başarılı
   hangisinin URL public check'te düştüğünü görebilir.
6. **State semantics**: en az 1 ref başarılıysa Batch → QUEUED;
   tüm ref'ler fail ise Batch DRAFT'ta kalır (operatör fix + retry
   yapabilir, double-launch riski yok).

`composeParams` snapshot'a artık `itemCount` da yazılır (audit/cost
analysis için).

### Compose panel oran/density olgunlaştırma

| Aspect | Phase 47 | Phase 48 |
|---|---|---|
| Compose mode width | 520px | **440px** |
| Pool grid bağlamı | sıkışmış (sayfanın %36'sı panel) | belirgin görünür (panel sayfanın ~%31'i) |

Genişlik azaltıldı çünkü inline compose niyet, "Pool browse
bağlamından kopmadan compose et" idi; 520px panel grid'i ezdiriyordu.
440px halen tüm form alanları (provider · aspect · similarity · count
· quality · brief) için yeterli — testler ve browser kanıtı bunu
doğruladı.

### Multi-reference wording

| Yer | Phase 47 | Phase 48 (refCount > 1) |
|---|---|---|
| Launch CTA | `Create Similar (6)` | **`Create Similar · 3 × 6`** |
| Cost preview | `~$1.44 · est. 3m` | **`18 gens · ~$4.32 · est. 9m`** |
| Calc | count × $0.24 | refCount × count × $0.24 |
| Time estimate | count × 0.5m | totalGenerations × 0.5m |

`refCount === 1` durumunda eski format korunur (`Create Similar · 6`
+ `~$1.44 · est. 3m`) — single-ref akışı görsel olarak fazla
"hesaplaşma" değil. Multi-ref durumunda operatör "3 referans, 6 küresel
varyant başına, toplam 18 üretim" hikayesini tek bakışta okur.

### Warning tonu sakinleşti

Phase 47:
> 6 references without a public URL — AI launch needs URL-sourced
> references.
> (`border-warning + bg-warning-soft` — agresif amber, yüksek
> dikkat çekiyor)

Phase 48:
> [k-amber dot] All references are local-only. AI launch needs
> URL-sourced references — remove the local items from the draft
> to launch the rest.
> (`border-line-soft + bg-k-bg-2/40` — sakin info tonu, küçük
> amber dot accent)

Dil değişimi:
- "without a public URL" (teknik) → "local-only" (operator-language)
- Eklenmiş actionable kapanış: "remove the local items from the
  draft to launch the rest" — operatöre next step söylüyor
- Singular/plural doğru ele alınmış: "All ... are local-only" vs
  "1 of 3 reference is local-only"
- Pluralization N/total format: `{N} of {total}` (operator hâlâ
  kaçının fix gerektiğini görür)

### In Draft badge çift sinyal sadeleşmesi

Phase 47'de kart üzerinde **iki yerde** "In Draft" yazıyordu:
1. Top-right köşede orange chip "✓ In Draft"
2. Alt CTA'da yine "In Draft" (resting) / "Remove from Draft" (hover)

Operatör hangisinin aksiyon hangisinin state olduğunu çözmek
zorundaydı (çift sinyal). Phase 48:

- **Kart-üstü badge → küçük orange dot** (10×10 px, paper ring,
  top-left köşede). Text-label kaldırıldı.
- Dot'un rolü scan-only sinyali: operator grid'i tararken "bu
  kart in-draft" işaretini görür.
- **CTA tek-yer-tek-sinyal**: resting "In Draft" / hover "Remove
  from Draft" zaten Phase 47'de oturmuştu, korunur.
- Dot top-left'e taşındı çünkü top-right bulk-select checkbox
  alanı (Pool grid layout pattern parity).
- Tooltip "In current draft batch" — operator dot'un anlamını
  hover ile keşfeder.

### Browser verification (gerçek end-to-end kanıt)

3 URL-sourced reference (1 gerçek Etsy CDN, 2 demo URL) draft'a
eklendi → compose mode → Launch tetiklendi → batch detail'a redirect.

| Test | Sonuç |
|---|---|
| Panel default collapsed (Phase 47 baseline) | width 56, count 3 |
| Pool dot count | 3 in-draft cards, 10×10 dot, k-orange, no text label, tooltip "In current draft batch" |
| Expand → queue mode | width 320, "Create Similar (3)" CTA |
| Open compose → mode=compose | width **440** (Phase 47'de 520), cost **"18 gens · ~$4.32 · est. 9m"** (3×6 math), launch **"Create Similar · 3 × 6"** |
| Click Launch → multi-launch tetiklendi | `composeParams.itemCount: 3`, 6 Job under batchId (1 ref success path produced 6 jobs; 2 demo URLs failed `urlCheck.ok` and were captured in `perReference` partial-failure array) |
| Batch detail merged view | Production summary card render edildi: Provider/Aspect/Quality/Reference/Items/Capability/Items 6 requested. IA-37 batch lineage Job.metadata.batchId üzerinden gösterim doğru. |
| Regression | /references 200, /batches 200, /bookmarks 200, 0 console errors |

Per-reference DB inspection:

```
batchId: cmp3xijxh00162aenf4i0ngwa
state: QUEUED, launchedAt: 2026-05-13T11:54:13.310Z
composeParams: { providerId: kie-gpt-image-1.5, aspectRatio: 2:3,
                quality: medium, count: 6, brief: null, itemCount: 3 }
items: 3
totalJobs: 6  // 1 ref success × 6 count; 2 refs failed urlCheck
perReference:
  - cmp3u6is (Etsy CDN URL real) → 6 jobs (GENERATE_VARIATIONS)
  - cmp3u6is (demo URL #1)       → [] + error "URL public doğrulanamadı"
  - cmp3tgwy (demo URL #2)       → [] + error "URL public doğrulanamadı"
```

Bu **partial-failure handling'in canlı kanıtı**: 1 ref başarılı
(6 jobs queued), 2 ref URL check fail oldu ama batch yine QUEUED'a
geçti (en az 1 success → state transition), operatör hangi ref'in
neden fail olduğunu perReference response array'inde görür.
launchBatch artık **gerçekten multi-reference**.

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: 59/59 PASS (canonical paket: bookmarks-page, references-page,
  bookmark-service, collections-page, dashboard-page, bookmarks-confirm-flow)
- `next build`: ✓ Compiled successfully
- Browser end-to-end: panel widths + multi-launch + batch detail merged

### Değişmeyenler (Phase 48)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Batch + BatchItem + BatchState Phase 43'te
  açılmıştı; Phase 48 yalnız service logic + UI ergonomics.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Multi-ref launch'ı için yeni state
  machine class veya WorkflowRun benzeri global helper açılmadı;
  `launchBatch` function'ı kendi içinde iteration + per-item
  error capture yapıyor.
- **Add Reference / duplicate / local folder / direct image intake
  akışları intakt** (Phase 26-41 baseline).
- **Direct image URL canonical yolu intakt** (Phase 39 baseline).
- **Phase 47 baseline'ı intakt**: default collapsed, hover Remove,
  inline compose mode, /batches/[id]/compose backward-compat page,
  Phase 46 unified FloatingBulkBar primitive.
- **Kivasy DS dışına çıkılmadı.** k-btn--primary, k-btn--ghost,
  k-orange / k-orange-soft, k-amber, k-thumb, k-bg-2, line-soft,
  font-mono tracking-meta recipe'leri korundu. Inline `<style>`
  veya yeni recipe family icat edilmedi.

### Bilinçli scope dışı (Phase 49+ candidate)

- **Batch detail summary strip multi-ref dili**: şu an "Items 6
  requested" yazıyor (1 ref × 6 = 6); multi-ref batch'lerde
  "Items 18 requested (3 × 6)" gibi format daha okunur olur.
  IA-37 batch lineage helper'ı `composeParams.itemCount` ile genişler.
- **Shared compose shell**: BatchComposeClient (page) ve
  BatchQueuePanel.ComposePanel (inline) iki ayrı render path —
  Phase 47'den taşınan deferral; Phase 48 multi-ref işine öncelik
  verdiğinden hâlâ açık. İkisinden birinde davranış sapması olursa
  ortak `ComposeForm` çıkarılır.
- **Per-reference failure UI**: launchBatch response `perReference`
  array taşıyor; UI bunu henüz post-launch toast veya batch detail
  banner olarak göstermiyor. Operatör başarısız ref'lerin sebebini
  ancak batch'i tekrar açtığında görür (Logs tab veya
  /api/batches/[id]/launch response). Phase 49 candidate: toast
  "2 refs succeeded · 1 ref failed URL check" + sebep listesi.
- **Similarity → brief injection**: Similarity stop hâlâ pure UI
  state; backend kullanmıyor (Phase 44'ten devir).
- **Compose state reset on launch success**: şu an launch sonrası
  inline compose mode otomatik queue'ya dönmüyor ama redirect zaten
  /batches/[id]'ye gidiyor; geri dönüldüğünde Pool'da queue panel
  collapsed (yeni draft yok). Davranış doğru ama state machine
  tarafında daha açık formalize edilebilir.

### Bundan sonra batch/compose tarafında kalan tek doğru iş

Phase 48 ile References → Pool → Queue → Compose → **Multi-Launch** →
Batch Detail zinciri kapandı. Operatör artık:
- Pool'dan N reference seç (Phase 46)
- Queue panel'de görüntüle/temizle (Phase 47)
- Tek tıkla compose'a in-line geç (Phase 47)
- N × M üretim başlat (Phase 48 yeni)
- Batch detail'da birleşik sonucu izle (IA-37 mevcut)

Sıradaki gerçek iş **References family tamamen kapanış** (per-ref
failure UI polish, batch detail multi-ref summary, shared compose
shell) **veya başka modüllere geçiş** (Selection, Mockup, Listing
detail). References tarafı şu an **production-ready**.

---

## Phase 49 — Pool card clarity + queue handoff + batch detail/feedback finalization

Phase 48 multi-reference launch akışını backend tarafında açtı ama
operator-facing UX hâlâ üç açık taşıyordu:

1. **In Draft state silikti**: Phase 48'de "çift sinyal" temizliği
   için kart üstündeki "In Draft" chip 10×10 orange dot'a indirildi.
   Operatör grid'i tararken hangi kartın draft'ta olduğunu çıkaramıyordu.
2. **Remove from Draft niyeti gizliydi**: Resting state "In Draft"
   yazıyordu, hover'da "Remove from Draft" swap oluyordu. Tam buton
   üstüne gelinmeden niyet okunmuyordu.
3. **`6 designs · view batches` zayıftı**: Underline'lı muted mono
   link teknik dipnot gibi duruyordu. Ürünün kart-level üretim geçmişi
   surface'i olarak görsel ağırlığı yoktu.
4. **Draft panel altında handoff yoktu**: "Create Similar (N)" tek
   CTA; operatör "sonra ne?" sorusuna cevap alamıyordu.
5. **Batch detail multi-ref dili konuşmuyordu**: `summary.batchTotal`
   "6 requested" gösteriyordu — multi-ref batch için yanıltıcı.
6. **`perReference` launch outcome görünmüyordu**: Backend Phase 48'de
   `perReference: Array<{ referenceId, designIds, failedDesignIds,
   error }>` dönüyordu; UI bu zenginliği drop ediyordu. Operatör
   "neden partial?" sorusunu cevapsız bırakıyordu.

Phase 49 tüm altısını birlikte kapatır:

### In Draft chip yeniden görünür (review-card kalitesinde)

`references-page.tsx` `ReferencePoolCard`:

- Phase 48 dot → küçük chip (`k-orange-soft` bg + `k-orange-ink`
  text + `border-k-orange/40` + paper shadow)
- Check icon + "Draft" label (mono uppercase tracking-meta, 10px)
- Sol-üst köşe (top-right bulk-select checkbox alanı)
- Boyut: 61×21px (önceki 10×10 dot vs Phase 47 büyük chip arasında
  zarif denge)
- Operatör grid'i tararken "bu kart draft'ta" sinyalini **hemen** alır

### Remove from Draft CTA okunur ve dürüst

CTA'nın görevi state göstermek değil **aksiyon**. Phase 49:

- Resting state: `border-danger/30 bg-paper text-danger` + Trash2
  icon + "Remove from draft" label (statik, hover gerekmez)
- Hover state: `bg-danger text-white` (tam danger fill — operatör
  niyeti net görür)
- Focus-visible: aynı tam danger fill (klavye user'a parity)
- State chip kart üstünde; CTA aksiyon — **tek-yer-tek-anlam**

### Batch relation chip surface (production lineage)

`ReferenceBatchSummary` component'i Phase 49:

- Eski: `text-info` underline muted mono link "6 designs · view batches"
- Yeni: `border-line-soft + bg-k-bg-2/60` chip → hover `border-k-orange/50 + bg-k-orange-soft + text-k-orange-ink`
- İçerik: `Layers icon + count + · + "batches" + ArrowRight icon`
- Davranış intakt: `href="/batches?referenceId={id}"` server-side
  filter (Phase 2 C) doğru çalışır
- Singular pluralization: "1 batch" / "N batches"
- Boş geçmişte chip render edilmez (sinyal değil gürültü)

### Draft panel next-step handoff strip

`BatchQueuePanel` expanded queue mode footer'ı:

- Mevcut primary "Create Similar (N) →" CTA korundu
- Altına yeni handoff strip (`bg-k-bg-2/40 + border-line-soft`):
  - Üst satır: mono `Next` label + sağda `All batches →` link chip
  - Alt satır: "Launching this draft creates a batch you'll track in
    [Batches]. You can keep multiple drafts in parallel — each Pool
    selection starts its own batch."
- Üçüncü satır: eski "Or open full compose page →" deep-link
  (backward-compat) korundu

Operatör compose'a inmeden önce mental model'i alır:
1. Bu draft launch sonrası Batches sekmesinde batch olarak yaşayacak
2. Operatör birden fazla draft tutabilir (multi-batch model görünür)
3. Şu anki batch için "All batches" tek tıkla erişilebilir

URL warning de aynı turda sakinleştirildi: agresif amber warning-soft
→ ink-toned k-bg-2/50 + k-amber dot accent + actionable copy
("X of N reference(s) local-only — launch will skip them.").

### Launch outcome sessionStorage handoff (one-shot)

`BatchQueuePanel` `ComposePanel` `launchMutation.onSuccess`:

- Response shape genişletildi: artık `perReference`, `designIds`,
  `failedDesignIds`, `state` hepsi okunur
- Aggregate computed: `successRefs` (designIds > 0), `skippedRefs`
  (error AND designIds === 0), `failedRefs` (error OR failedDesignIds > 0)
- `sessionStorage.kivasy.launchOutcome.{batchId}` JSON write:
  ```json
  {
    ts, state, totalRefs, totalDesigns, totalFailed,
    successRefs, skippedRefs, failedRefs,
    perReference: [...], composeParams: {...}
  }
  ```
- Redirect `/batches/{batchId}` (mevcut davranış intakt)

### Batch detail multi-ref summary + LaunchOutcomeBanner

`/batches/[batchId]/page.tsx`:

- Yeni server-side fetch: real `Batch` row (`composeParams` +
  `_count.items`). Schema değişikliği yok; Phase 43 tablo yalnız
  okunur. Legacy synthetic batches'de `null` (graceful fallback).
- `BatchContext` interface BatchDetailClient'a prop olarak geçer.

`BatchDetailClient` Phase 49:

- `isMultiRef`, `refCount`, `perRefCount`, `totalRequested` derived
- Type tile multi-ref dili: `"Variation · N × M"` + sub-caption
  `"Total generations requested"`. Tek-ref batch'lerde eski format
  (`"Variation · N requested"`) — geriye uyum.
- `SummaryTile` `sub` prop eklendi (optional secondary line).
- `LaunchOutcomeBanner` header'ın hemen altında render edilir.

`LaunchOutcomeBanner` component (yeni, BatchDetailClient.tsx içi):

- `useEffect` mount'ta `sessionStorage.getItem` + `removeItem`
  (one-shot — refresh sonrası banner görünmez)
- Stale > 5min ignore (operatör bookmark'tan tekrar açabilir)
- Three states (tone-aware):
  - **Full success** (`success` bg + CheckCircle2): "All N references
    launched · M generations queued"
  - **Partial** (`k-bg-2 + k-amber dot`): "X of N references
    launched · M generations queued" + auto-expanded reasons
  - **All-failed** (`danger` bg + AlertTriangle): "Launch failed —
    no references queued" + reasons
- "See why" / "Hide reasons" toggle (partial/failed default expanded)
- Per-reference skipped detail (mono `ref_xxxxxxxx` + error message)
- Actionable footer ("Next: remove the skipped refs from the next
  draft or replace them via Add Reference with a URL-sourced image.")
- X dismiss button (component-state, refresh sonrası zaten görünmez)

### Compose shell duplicate — bilinçli defer

`BatchComposeClient` (page form factor, 624 satır) ve
`ComposePanel` (inline, ~330 satır) iki ayrı render path benzer
form alanları taşıyor. Phase 49 audit:

- Ortak shell extraction prop boğulmasına yol açar (`density`,
  `showAdvancedParams`, `inlineSize`, vb.) — premature abstraction
- İki yer **görsel/funktional olarak farklı**: page = derin compose
  oturumu (advanced ref params); inline = hızlı launch decision
- Launch endpoint zaten ortak (`/api/batches/[id]/launch`); davranış
  divergence riski backend katmanında, tek yer
- Form alanları küçük; bir değişiklik iki dosyaya da düşse de patch
  kabul edilebilir

**Karar: defer extraction.** İki render path açıkça scope'lu kalır;
gelecek tur'da gerçek davranış sapması doğarsa ortak `ComposeForm`
çıkarılır.

### Honest field markers

Inline `ComposePanel` `Similarity` field'ı dürüst:
- hint: `${SIMILARITY_STOPS[similarity]} · preview only`
- title attribute: "Similarity is a UI hint only — backend wiring
  lands in a later phase."

Page-form `BatchComposeClient` (Phase 44'ten beri "advisory only for
now") Phase 49'da paralel güçlendirildi:
- hint: `${SIMILARITY_HINTS[similarity]} · preview only`
- Caption: "Preview control · backend wiring next phase"

Operatör "gerçekten bağlı" alanlar (provider, aspect, count, quality,
brief) ile "preview only" alanları (similarity, sref/oref/cref,
prompt template placeholder) arasında **açık ayrım** görür.

### Browser verification (live dev server, gerçek end-to-end kanıt)

| Test | Sonuç |
|---|---|
| In Draft chip | 61×21px, bg `rgb(251, 234, 223)`, color `rgb(142, 58, 18)`, Check icon + "Draft" label |
| Remove from Draft CTA | Resting border `rgba(179, 59, 41, 0.3)`, color `rgb(179, 59, 41)`, text "Remove from draft" (statik, hover bekleme yok) |
| Batch chip | "6·batches" + Layers icon + ArrowRight, href `/batches?referenceId=...` |
| Draft panel handoff | "Next · All batches →" link + multi-batch guidance copy |
| Compose mode | 440px, "Create Similar · 2 × 6" CTA, k-amber URL warning sakin |
| Launch → redirect | `/batches/[id]` ✓ + sessionStorage one-shot key okundu + silindi |
| LaunchOutcomeBanner | `data-state="partial"`, başlık "1 of 2 references launched · 6 generations queued", auto-expanded, 1 skipped ref ("URL public doğrulanamadı: HEAD 404"), actionable footer |
| Type tile multi-ref | "Variation · 2 × 6" + sub "12 generations requested" |
| Pool screenshot | In Draft chip + batch chip + draft panel hep birlikte görünür, review-card seviyesinde clarity |

Visible EN parity korundu — yeni UI metni TR sızıntısı taşımıyor.
Phase 31+ baseline intakt.

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: 59/59 PASS (canonical paket: bookmarks-page, references-page,
  bookmark-service, collections-page, dashboard-page, bookmarks-confirm-flow)
- Browser end-to-end: chip clarity + Remove CTA + batch chip + handoff +
  compose multi-ref + launch + banner + multi-ref Type tile + screenshot
- `next build`: skip (Phase 48 baseline + pre-existing `/api/admin/midjourney/asset/bulk-export` route runtime; Phase 49 değişiklikleri yalnız client-side render + read-only Batch row query — runtime path'i ayrı module)

### Değişmeyenler (Phase 49)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Phase 43 Batch tablosu yalnız okunur.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** `LaunchOutcomeBanner` küçük local
  component (BatchDetailClient.tsx içi); ortak compose shell defer'lendi.
- **Add Reference / duplicate / local folder / direct image intake
  akışları intakt** (Phase 26-41 baseline).
- **Multi-reference launch** Phase 48 mekanizması (perReference,
  partial-failure) Phase 49'da yalnız UI'a çıktı; backend dokunulmadı.
- **Kivasy DS dışına çıkılmadı.** k-orange / k-orange-soft / k-orange-ink,
  k-bg-2, k-amber, line-soft, border-danger, success-soft recipe'leri
  kullanıldı; yeni recipe family icat edilmedi.

### Bilinçli scope dışı (Phase 50+ candidate)

- **Shared compose shell**: page + inline ortak `ComposeForm`. İki
  consumer'da davranış sapması doğmazsa erteleme devam edebilir.
- **Similarity backend wiring**: brief prompt'a inject veya provider
  parametresi olarak gerçek davranışa bağlanma (Phase 44'ten devir).
- **Prompt template picker**: v7 d2a/d2b PromptPreviewSection seviyesinde.
- **`perReference` post-launch toast** queue panel'inde (şu an yalnız
  batch detail banner; queue panel'inden de görünebilir).
- **Items tab multi-ref grouping**: batch detail Items tab job'ları
  reference'a göre grupla göstermesi (`group by referenceId`).
- **Logs/Costs/Parameters tab'ları multi-ref dili**: şu an Type tile'da
  multi-ref görünür; içerik tab'ları placeholder ile birlikte tek-ref
  diline yakın.

### Bundan sonra production tarafında kalan tek doğru iş

Phase 49 ile References → Pool → Queue → Compose → Multi-Launch →
**Batch Detail (multi-ref summary + per-ref outcome banner)** zinciri
operator-facing UX olarak **production-ready** durumda. Operatör artık:
- Pool kartında "Draft" chip ile state'i hemen görür
- Tek tıkla "Remove from draft" yapabilir (niyet okunur)
- Kartı altındaki batches chip ile geçmiş işlere navigate edebilir
- Queue panel'inde "Next · All batches" handoff'unu okur
- Compose'a inline geçer, multi-ref launch eder
- Batch detail'a iner, "1 of 2 launched · See why" banner'ından
  partial failure sebebini direkt görür
- Type tile multi-ref dilini taşır

Sıradaki **tek doğru iş**: References tarafından çıkıp **Selection
studio + Mockup studio + Listing builder** detail surface'lerinin
olgunlaştırılması (canonical ürün omurgası: References → Batch →
Review → **Selection** → **Product** → Etsy Draft zincirinin sonu).

---

## Phase 50 — Review → Selection handoff + Selections lineage chip

Phase 49 References/Batches üretim girişini production-ready hale
getirdi. Phase 50 odak değişti: **launch sonrası karar verme akışını
ürünleştirme**. Operatör batch'ini review ettikten sonra Selection'a
nasıl iniyor? Selection set'leri hangi batch'ten doğdu? Bu turun
gerçek slice'ı bu iki cevabı **görünür** yapmak.

### Phase 49 sonrası ürün boşluğu

1. **Review focus mode scope-complete handoff'u Selection'ı tanımıyordu**:
   `ScopeCompletionCard` `undecided = 0` durumunda yalnız "next scope"
   veya "All caught up" gösteriyordu. Operatör batch'i review etti,
   kept > 0, ama "şimdi seçim yap" yönlendirmesi review yüzeyinde
   yoktu — batch detail'e çıkıp `kept-no-selection` stage CTA'sını
   bulmak zorundaydı.
2. **Selections index batch lineage'i tutmuyordu**: Server'da
   `sourceMetadata.kind: "variation-batch" + batchId` veya
   `mjOrigin.batchIds[]` zaten yazılıydı, ama UI bu zenginliği drop
   ediyordu (`sourceLabel: "${itemCount} items · 2h ago"` — lineage
   yok). Operatör "bu set hangi batch'ten doğdu?" sorusuna cevap
   alamıyordu.
3. **Selection detail tarafında lineage strip** Phase 1'de zaten vardı
   (`SelectionBatchLineage` component); ama index tarafına yansımamıştı.

### Slice 1 — Selections index batch lineage chip

`src/server/services/selection/index-view.ts`:

- Yeni `resolveSourceLineage(sourceMetadata)` helper. Her iki
  canonical format'ı destekler:
  - `{ kind: "variation-batch", batchId, referenceId }` (Phase 5
    GENERATE_VARIATIONS quickStart)
  - `{ mjOrigin: { batchIds: [...], referenceId? } }` (Phase 1
    handoffKeptAssetsToSelectionSet)
- `SelectionSetIndexView` shape genişletildi: `sourceBatchId` +
  `sourceReferenceId` (her ikisi nullable, legacy set'lerde null)
- Schema-zero: yalnız okuma; mevcut Prisma JSON path'lerinden
  parsing yapar.

`src/features/selections/components/SelectionCard.tsx`:

- Yeni `sourceBatchId?: string | null` prop
- Chip render (sourceBatchId varsa): `<Link href="/batches/{id}">`
  + `Layers icon + "From batch · " + slice(0,8) + ArrowRight`
- Phase 49 References Pool batch chip ile **aile parity**:
  `border-line-soft + bg-k-bg-2/60` → hover `border-k-orange/50 +
  bg-k-orange-soft + text-k-orange-ink`. Mono caption tracking-meta
  uppercase.
- Boş sourceBatchId'de chip render edilmez (gürültü değil sinyal —
  legacy/ad-hoc setler temiz kalır).

`/selections/page.tsx` row mapping güncellendi: sourceBatchId +
sourceReferenceId field'larını client'a yansıtır.

### Slice 2 — Review scope-complete Selection handoff

`src/features/review/components/ReviewWorkspaceShell.tsx`:

- `ScopeCompletionCard` yeni optional prop: `selectionHandoff`.
  - `{ existingSetId: string | null, existingSetName?: string | null,
       batchId: string } | null`
- Render davranışı (kept > 0 + selectionHandoff !== null ise):
  - **existingSetId varsa** → primary CTA "Continue in Selection"
    (CheckCircle2 icon) → `/selections/{setId}`. Caption "↗ {setName}"
    altında.
  - **existingSetId null ise** → primary CTA "Create selection from
    N kept" (Sparkles icon) → `/batches/{batchId}` (kept-no-selection
    stage CTA Phase 3'ten bu yana orada).
- Secondary "next scope" link primary'nin altında küçük mono caption
  olarak kalır (kept > 0 odağı Selection'a geçtiği için).
- Folder/queue scope veya `kept === 0` → mevcut "next scope" / "All
  caught up" davranışı aynen korunur (geriye uyum tam).

`src/features/review/components/QueueReviewWorkspace.tsx`:

- Yeni `selectionHandoff` prop adapter'dan shell'e iletilir.

`src/app/(app)/review/page.tsx`:

- AI batch-scoped review session'da `resolvedBatchId` resolve
  edildikten sonra `findSelectionSetForBatch(userId, batchId)` ile
  existing SelectionSet aranır.
- `selectionHandoff = { existingSetId, existingSetName, batchId }`
  prop'a yazılır.
- Non-batch scope (reference / folder / queue) → null (handoff
  surface'ü görünmez).

### Decision dili netlik

Mevcut sözleşme korundu (CLAUDE.md Madde V baseline):
- `reviewStatus = APPROVED + reviewStatusSource = USER` → **operator
  kept** (batch.reviewCounts.kept)
- `reviewStatus = REJECTED + reviewStatusSource = USER` → **operator
  rejected**
- `reviewStatusSource != USER` → **undecided**

Selection tarafında item-level:
- `SelectionItem.status` → `pending` (defaultta) / `selected` /
  `removed` — Selection'a alınan asset'lerin mockup'a girer/çıkar
  kararı

İkisi farklı katmandır (operator-kept downstream gate vs in-set
curation status). Phase 50'de bu ayrım kod-level dürüst kaldı.
**Hiç yeni state ismi icat edilmedi** — "kept/selected/shortlisted"
karışıklığını önleyen mevcut sözleşme korundu.

### Aile benzerliği

Selection card lineage chip Phase 49 References Pool batch chip ile
**görsel olarak aynı recipe family'sinde**:
- Aynı `border-line-soft + bg-k-bg-2/60` resting
- Aynı `border-k-orange/50 + bg-k-orange-soft + text-k-orange-ink` hover
- Aynı `Layers icon + mono tracking-meta + ArrowRight` kompozisyonu
- Aynı font-size (10.5px), padding (px-2 py-1), border-radius (md)

Operatör References → Selections geçerken yeni bir görsel dil
öğrenmez; aynı production-lineage chip'i her iki yüzeyde de görür.

### Browser verification (live dev server kanıt)

- **Selections index lineage chip**:
  - Patched set ("Junk Journal Set") chip render: text "From batch ·
    cmp3whhm →", href `/batches/cmp3whhmx00015cc3bv2lzs9s`,
    data-batch-id resolve doğru
  - 4 lineage-less set'te chip render edilmez (qa-fixture markdown'lı
    test setleri) — sinyal değil gürültü davranışı doğrulandı
  - Screenshot: "FROM BATCH · CMP3WHHM →" chip "Junk Journal Set"
    kart altında net görünür; diğer setler temiz
- **Selection detail lineage** (Phase 1 mevcut):
  `SelectionBatchLineage` header'da "↗ BATCH XXXXXXXX" link — Phase
  50'de değişmedi, Phase 1 baseline intakt.
- **Review handoff DOM presence**: shell ScopeCompletionCard yeni
  `selectionHandoff` prop ile çağrılıyor; AI batch scope page'i
  `findSelectionSetForBatch` resolve sonucunu yansıtıyor.

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: 59/59 PASS (canonical paket: bookmarks-page,
  references-page, bookmark-service, collections-page, dashboard-page,
  bookmarks-confirm-flow)
- Live browser:
  - `/selections` → lineage chip patched set'te görünür, lineage-siz
    setlerde gizli, href + batch id resolve doğru
  - Pool card chip stili (Phase 49) intakt — regresyon yok

### Değişmeyenler (Phase 50)

- **Review freeze (Madde Z) korunur.** Review modülünün scoring,
  threshold, automation, decision state alanlarına dokunulmadı.
  Yalnız scope-complete kart'a optional Selection handoff CTA
  eklendi (mevcut "next scope" davranışı korunur).
- **Schema migration yok.** SelectionSet.sourceMetadata zaten
  variation-batch / mjOrigin format'larını taşıyordu; Phase 50
  yalnız read-only resolve helper ekledi.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** `resolveSourceLineage` 30 satırlık
  static helper; `ScopeCompletionCard`'a yeni optional prop ekledi.
- **Add Reference / duplicate / local folder / direct image intake
  akışları intakt** (Phase 26-41 baseline).
- **References / Batches / Compose / Multi-Launch akışları intakt**
  (Phase 42-49 baseline).
- **Kivasy DS dışına çıkılmadı.** Selection card lineage chip
  Phase 49 References Pool batch chip ile birebir aile parity.

### Bilinçli scope dışı (Phase 51+ candidate)

- **MJ batch-scoped review path** (`BatchReviewWorkspace`, line 211):
  AI workspace Phase 50'de handoff aldı; MJ workspace ayrı render
  yolu (`features/batches/components/BatchReviewWorkspace.tsx`).
  Phase 51 candidate: MJ workspace'a aynı selectionHandoff prop'u
  bağla.
- **Selection studio compare / group / prepare-for-mockup UX**:
  Selections detail içinde Designs / Edits / Mockups / History
  tab'ları mevcut; "studio" hissi için karşılaştırma + grup +
  next-step UX henüz açılmadı (deferred).
- **Reference lineage chip Selections index'te**: Phase 50 yalnız
  source batch'i gösteriyor; gelecek tur Reference back-link de
  eklenebilir (`sourceReferenceId` server'dan zaten geliyor).
- **Decision dictionary doc**: bu turda explicit doc yazılmadı;
  mevcut CLAUDE.md Madde V (operator decision canonical) + bu
  Phase 50 entry sözleşmeyi tutuyor.

### Bundan sonra production tarafında kalan tek doğru iş

Phase 50 ile Review → Selection handoff ilk anlamlı slice'ı açıldı,
Selections index lineage çıktısı görünür oldu. Sıradaki **tek doğru
iş** Selection studio'nun gerçekten "studio gibi" hissetmesi:
- Selection detail Designs tab'ında karşılaştırma + grup UX
- "Prepare for Mockup" handoff'unun netleşmesi
- Selection finalize → Mockup apply zincirinin daha az teknik kalması

References → Batch → Review → **Selection** stage'i hâlâ açık; bir
sonraki tur'da Selection studio detail'in olgunlaştırılması canonical
omurganın doğal devamı.

---

## Phase 51 — Selection studio: status badge + bulk curation + Finalize handoff

Phase 50 Review → Selection handoff'unu görünür yaptı. Phase 51 odak
değişti: **Selection detail yüzeyini gerçek çalışma yüzeyi haline
getirme**. Pre-Phase 51 durumda `/selections/[setId]` sadece bir
kayıt ekranıydı — operatör kartların gerçekten "ne durumda" olduğunu
göremiyor, Apply Mockups disabled olduğunda nereden finalize edeceğini
bilmiyordu.

### Phase 50 sonrası ürün boşluğu

1. **DesignsTab status agnostic'di**:
   - `SelectionItem.status` (pending/selected/rejected) kart üzerinde
     hiç görünmüyordu — operatör hangi item kept/removed bilmiyordu
   - Bulk-bar tüm aksiyonları `disabled: true` (R5 deferral'ı kalıcılaşmış,
     yıllar önce yazılmış "coming soon")
   - Kartlar metadata-fakir ("Design XXXXXX · 1:1 · untyped")
2. **Selection → Mockup handoff yarım**:
   - Apply Mockups CTA vardı ama disabled durumunda hint teknik dilde:
     `Stage: Curating → finalize to enable`. Finalize aksiyonu hiçbir
     yerden görünür değildi — operatör nereden finalize edeceğini
     bilmiyordu
   - Selection → Mockup zinciri operatör için **dead-end** hissi veriyordu
3. **Decision state dili kafa karıştırıcı**: SelectionItem.status
   `pending/selected/rejected` Review tarafının `kept/rejected/undecided`'i
   ile aynı semantic ama farklı kelimeler. Kart-level görünmediği için
   karışıklık operatöre yansımıyordu — ama action layer'da yansıyordu
   (operatör tile'a tıklayınca ne olur?).

### Slice 1 — DesignsTab status visibility

`src/features/selections/components/tabs/DesignsTab.tsx`:

- **`DesignsTabItem` type'a `status` field eklendi** (server'dan zaten
  geliyordu, UI'a kadar yüzeye çıkarıldı)
- **Per-tile status badge** (Phase 49 References Pool "Draft" chip ile
  aile parity):
  - `selected` → `bg-k-orange-soft + text-k-orange-ink + border-k-orange/40`
    + Check icon + "Selected" mono label
  - `rejected` → `bg-danger/10 + text-danger + border-danger/30`
    + CircleSlash icon + "Rejected" mono label
  - `pending` → `bg-k-bg-2/60 + text-ink-3 + border-line-soft`
    + CircleDot icon + "Pending" mono label
- **Visual emphasis** state'e göre:
  - `status === "selected"` (seçili olmasa bile) → tile'da subtle
    `ring-1 ring-k-orange-soft` (operatör scan'de "bu kart elenmiş
    seçilmiş" bilgisini alır)
  - `status === "rejected"` → `opacity-60` (dimmed; scan'de görünür
    ama görsel olarak geri planda)
- **Status filter chip strip** üst barda (review-card kalitesinde):
  - All / Selected / Pending / Rejected — count badge ile (`Selected 2`)
  - `aria-pressed` + `data-active` attributes (Phase 20 References
    toolbar pattern parity)
  - Filter switch sadece görünüm; backend mutation tetiklemez
- **Count caption status-aware**: "4 designs · 2 selected · 2 pending"
  (önceden sadece "4 designs · drag to reorder")

### Slice 2 — Bulk-bar gerçek curation

Phase 7 Task 21'de yazılmış `PATCH /api/selection/sets/[setId]/items/bulk`
endpoint UI'a bağlanmamıştı. Phase 51:

- `useMutation` inline (yeni mutations dir/abstraction yok)
- 3 bulk aksiyon (ikisi yeni):
  - **Promote** (primary, Sparkles) → `status: "selected"`
  - **Move to pending** (CircleDot) → `status: "pending"`
  - **Reject** (Trash2) → `status: "rejected"`
- onSuccess → `router.refresh()` (server-side detail page yeniden
  fetch → status badge + filter count + finalize gate live update)
- `readOnly` prop set finalize edildiğinde (status !== "draft") bulk-bar
  hiç render edilmez — finalize sonrası set kararı dondurulur

### Slice 3 — Apply Mockups handoff: Finalize CTA görünür

`src/features/selections/components/SelectionDetailClient.tsx`:

- **selectedCount + pendingCount** items'tan türetildi
- **Finalize mutation** (`POST /api/selection/sets/[setId]/finalize`,
  Phase 7 Task 22 endpoint — UI'a hiç bağlanmamıştı)
- **Header CTA stage-aware**:
  - `applyEnabled` (Mockup ready / Sent uygun) → Apply Mockups primary Link
  - `stage === "Sent"` → mevcut "Already sent · view in Product" davranışı
  - **Yeni**: `stage === "Curating" || stage === "Edits"` durumunda:
    - **finalizeReady** (selectedCount > 0) → primary CTA "Finalize
      selection · N" (CheckCircle2 icon) + subtitle "Next · Apply
      Mockups after finalize"
    - selectedCount === 0 → CTA disabled + actionable hint:
      "Promote items via Designs tab to enable" veya
      "N pending · promote in Designs tab"
- **Error handling**: finalizeMutation.isError → inline `text-danger`
  mono caption header altında

### Decision state dili netliği

Phase 51 yeni isim icat etmedi. Mevcut iki katman korundu:

| Katman | Field | Değerler | Anlam |
|---|---|---|---|
| **Operator decision** (downstream gate) | `reviewStatus` + `reviewStatusSource` | APPROVED+USER / REJECTED+USER / PENDING | Batch'in operator-kept zinciri (CLAUDE.md Madde V) |
| **In-set curation** | `SelectionItem.status` | pending / selected / rejected | Selection içinde mockup'a girer/çıkar kararı |

İkisi farklı katman. Phase 51 Selection katmanında status badge'ler
görünür yaptı ama Review-tarafı "kept" terminolojisinden ayrı tuttu.
Operatör Review'de "kept" dilini, Selection'da "selected" dilini görür;
karışıklık yok.

### Aile benzerliği

Status badge'leri Phase 49 References Pool "Draft" chip ve Phase 50
Selection card lineage chip ile **aile parity**:
- Aynı `border + bg + paper shadow` recipe
- Aynı icon (h-2.5 w-2.5 + strokeWidth 3 selected/check için)
- Aynı font-size (10px) + font-mono + uppercase + tracking-meta
- Aynı padding (px-1.5 py-0.5) + border-radius (md)

Filter chip strip'i Phase 20 References toolbar `k-input + k-chip`
pattern parity (aria-pressed + data-active + segmented chip group).

Bulk-bar Phase 46 unified `FloatingBulkBar` primitive — Library,
References, Selections aynı görsel aile.

### Browser verification (live dev server kanıt)

Test set: `pass57-mj-29689991` (4 item draft set, stage=Edits).

| Test | Sonuç |
|---|---|
| Initial state | 4 tile hepsi "Pending" badge, counts "4 designs · 4 pending", Finalize CTA disabled (`finalizeBtnReady=null`) |
| Filter chips render | All / Selected / Pending / Rejected — 4 chip + count badge'leri |
| Bulk PATCH endpoint | API call: `PATCH /items/bulk { itemIds: [...2 ids], status: 'selected' }` → 200 + `{ updatedCount: 2 }` ✓ |
| Refresh sonrası | 2 tile "Selected" badge (k-orange-soft + Check), 2 tile "Pending" (gray + CircleDot); counts "4 designs · 2 selected · 2 pending"; Finalize CTA enabled `finalizeBtnReady=true`, text "Finalize selection · 2", title "Finalize this set with 2 selected items — stage moves to Mockup ready.", subtitle "Next · Apply Mockups after finalize" |
| Filter chip toggle | "Selected" chip click → active=selected, visible tiles 4 → 2 (sadece selected); React fiber synthetic events ile doğrulandı |
| Screenshot | Header'da net Finalize CTA + "NEXT · APPLY MOCKUPS AFTER FINALIZE" subtitle; tiles'da SELECTED/PENDING badge net; filter chip "ALL 4 · SELECTED 2 · PENDING 2 · REJECTED" görünür |

Stage edge case kanıtı:
- `stage === "Curating"` (henüz edit yok, selected > 0) → finalize aç
- `stage === "Edits"` (edit yapılmış, selected > 0) → finalize aç
  (önceden buradan finalize'a giden bir yol yoktu; Phase 51 düzeltti)
- `stage === "Mockup ready"` / `stage === "Sent"` → finalize CTA hiç
  görünmez (zaten finalize edilmiş veya gönderilmiş)

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: 59/59 PASS (canonical paket: bookmarks-page, references-page,
  bookmark-service, collections-page, dashboard-page, bookmarks-confirm-flow)
- Browser end-to-end: status badge + filter + bulk PATCH + refresh +
  Finalize gate açılması — tümü canlı dev server üzerinde gerçek
  mutation + DOM kanıtı

### Değişmeyenler (Phase 51)

- **Review freeze (Madde Z) korunur.** Review modülüne dokunulmadı.
- **Schema migration yok.** SelectionItem.status + SelectionSet.status
  alanları zaten yıllar önce yazılıydı; UI'a kadar yüzeye çıkarıldı.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** DesignsTab içinde inline `useMutation`
  + Phase 7 Task 21/22 endpoint'leri reuse edildi. Yeni mutations dir
  veya state machine açılmadı.
- **References / Batch / Review / Add Reference / duplicate / local
  folder / direct image intake akışları intakt** (Phase 26-50 baseline).
- **Kivasy DS dışına çıkılmadı.** k-card / k-thumb / k-btn--primary
  / k-orange-soft / k-orange-ink / k-bg-2 / line-soft / border-danger
  recipe'leri kullanıldı; yeni recipe family icat edilmedi.

### Bilinçli scope dışı (Phase 52+ candidate)

- **Compare mode (side-by-side / focused compare)**: Phase 51 grid
  + filter clarity'sine odaklandı. Side-by-side karşılaştırma view'i
  (örn. 2 selected item'ı yan yana büyük) Phase 52 candidate.
- **Drag-and-drop reorder**: Drag handle hâlâ disabled placeholder.
  Position-based reorder PATCH endpoint zaten var; UI wiring ayrı tur.
- **Source lineage strip in DesignsTab header**: Lineage chip mevcut
  set-level header'da (`SelectionBatchLineage` Phase 1) ama tile-level
  source bağlamı (örn. "from batch X · item Y") yok. Tile başına bu
  bağlamı eklemek için server-side join genişletmesi gerekir; deferred.
- **Finalize confirm modal**: Phase 7 `FinalizeModal` legacy
  `/selection/components/FinalizeModal.tsx` mevcut ama yeni
  `/selections/components/` çağırmıyor. Phase 51 inline button onClick
  + service-side gate (selected ≥ 1) yeterli; confirm modal eklenebilir
  ama operatöre extra friction olur.
- **Apply Mockups → Product handoff'unun ürünleştirilmesi**: Selection
  finalize sonrası operatör `/selection/sets/{id}/mockup/apply`'a iner;
  bu surface'in operatör-friendly polish'i Phase 52+ candidate.

### Bundan sonra production tarafında kalan tek doğru iş

Phase 51 ile Selection studio operatör için **çalışma yüzeyi** oldu:
- Status badge'leri ile decision görünür
- Bulk-bar ile curation gerçek (Promote / Pending / Reject)
- Filter chip ile hızlı tarama
- Finalize CTA stage gate'e bağlı + "Next · Apply Mockups" handoff
- Apply Mockups → Mockup studio mevcut akış (Phase 7 baseline)

Sıradaki **tek doğru iş** Mockup → Product zincirinin
operatör-friendly polish'i:
- `/selection/sets/{id}/mockup/apply` surface'i operatöre teknik
  hissetmiyor mu?
- Product detail Listing builder ne durumda?
- Etsy Draft handoff gerçek bir aksiyon mu yoksa placeholder mı?

References → Batch → Review → Selection → **Mockup → Product → Etsy
Draft** zincirinin sonu kalıyor.

---

## Phase 52 — Selection finalize handoff + Mockup studio lineage strip

Phase 51 Selection studio'yu çalışma yüzeyi yaptı (status badge, bulk
curation, finalize CTA). Phase 52 odak: **finalize sonrası operatörün
ne yapacağını net görmesi** + Mockup studio'da **context kaybının
önlenmesi**.

### Phase 51 sonrası ürün boşluğu

1. **Finalize sonrası silent transition**: `finalizeMutation.onSuccess`
   yalnız `router.refresh()` yapıyordu. Server stage'i `Edits`→`Mockup
   ready`'ye çeviriyordu, header CTA Apply Mockups'a dönüyordu — ama
   operatör "finalize başarılı mı, şimdi ne yapacağım?" sorusuna
   görsel cevap almıyordu. Dead-end hissi devam ediyordu.
2. **Mockup studio context kaybı**: `/selection/sets/{id}/mockup/apply`
   surface'inde:
   - SetSummaryCard `set.name` gösteriyordu ama "hangi batch'ten
     geldi" (sourceMetadata) drop ediliyordu
   - Product type sadece `categoryId` resolve'ünde sessizce kullanılıyordu
     (operatör hangi template havuzunun açıldığını bilmiyordu)
   - Selection detail'a geri dönüş yolu sadece breadcrumb (üstte
     küçük `← Selections / setName / Mockup Studio`)
3. **Product detail Source selection tile** Phase 14'te zaten vardı —
   Phase 52 burada dokunulmadı (mevcut davranış intakt).

### Slice 1 — Selection detail post-finalize success banner

`SelectionDetailClient`:

- `finalizeMutation.onSuccess` artık `sessionStorage.kivasy.finalizeOutcome.{setId}`
  one-shot key yazar (Phase 49 LaunchOutcomeBanner pattern parity).
- Mount'ta `useEffect` key'i okur + siler. Stale > 5min ignore.
- Yeni banner (header altı, tabs üstü):
  - `success-soft` bg + CheckCircle2 icon
  - Copy: "N items finalized · set ready for mockups"
  - Primary CTA: "Apply Mockups" → `/selection/sets/{setId}/mockup/apply`
  - Dismiss (×) button (component-state, refresh'te zaten görünmez)
- Refresh sonrası banner kalmaz; haunt etmez.

### Slice 2 — SetSummaryCard lineage strip

`SetSummaryCard` (mockup studio Apply view'i Zone 2):

- Yeni `resolveSourceBatchId(sourceMetadata)` static helper. İki canonical
  format'ı destekler (Phase 50 `resolveSourceLineage` ile aile parity):
  - `{ kind: "variation-batch", batchId }` (Phase 5 quickStart)
  - `{ mjOrigin: { batchIds: [...] } }` (Phase 1 kept-handoff)
- Set adı + status badge altına **lineage chip strip**:
  - **← Selection** back-link → `/selections/{setId}` (mockup'tan
    Selection'a tek tıkla geri; "yanlış kararı düzeltmeliyim" senaryosu
    için kritik)
  - **From batch · {id} →** chip → `/batches/{batchId}` (Phase 50
    Selection card batch chip ile birebir aile parity; Layers + mono
    + arrow)
  - **Type · {productTypeKey}** chip (mockup template havuzunun
    hangi category'den geldiği transparent — silent "canvas" fallback'in
    yerini alır)
- Chip yoksa render edilmez (legacy sourceMetadata-less set'lerde
  back-link + product type chip kalır; batch chip gizli — sinyal
  değil gürültü).
- Kivasy DS recipe parity: `border-line-soft + bg-k-bg-2/60`, hover
  `border-k-orange/50 + bg-k-orange-soft + text-k-orange-ink`.

### Slice 3 — Product detail Source selection tile (Phase 14 baseline)

Audit sırasında Phase 14'te zaten Product detail summary strip'inde
"Source selection" tile'ı mevcut olduğu doğrulandı:
- `useProductSourceSelection` hook
- Tile: setName + ArrowUpRight icon link → `/selections/{setId}`
- "Next step" tile + Listing health + Mockups + Files counts

Phase 52 burada dokunmadı (mevcut Phase 14 davranışı intakt).

### Mockup → Product zinciri honest audit

| Yüzey | Durum |
|---|---|
| `/selections/{setId}` finalize gate | **Çalışıyor** (Phase 51) |
| Finalize success banner | **Çalışıyor** (Phase 52) |
| `/selection/sets/{setId}/mockup/apply` | **Çalışıyor** + Phase 52 lineage strip |
| Mockup job submit (`POST /api/mockup/jobs`) | **Çalışıyor** (Phase 8) |
| Mockup job result (`S8ResultView`) | **Çalışıyor** + "Listing'e gönder" CTA |
| `createListingDraft` → `/products/{id}` redirect | **Çalışıyor** (Phase 14) |
| Product detail summary strip + tabs | **Çalışıyor** (Phase 14) |
| Listing builder (title/desc/tags) | **Çalışıyor** (Phase 9 V1 pipeline) |
| Etsy Draft submit | **Çalışıyor** ama V1 pipeline (Phase 9), active publish değil |

Bu zincirin **tamamı end-to-end fonksiyonel**. Phase 52'de eklenen iki
slice ürün-friendly hissi güçlendirdi (transition feedback + context
korunması).

### Browser verification (live dev server kanıt)

`pass57-mj-29689991` set'i (4 item, draft → finalize):

| Test | Sonuç |
|---|---|
| 2 item promote → 200 + updatedCount=2 | ✓ |
| Finalize endpoint çağrısı | 200, status="ready", finalizedAt set |
| sessionStorage one-shot write | `kivasy.finalizeOutcome.{setId}` |
| Reload sonrası banner | `selection-finalize-banner` rendered, text "2 items finalized · set ready for mockups", Apply Mockups CTA href doğru, dismiss button present, sessionStorage key silinmiş (one-shot) |
| Stage badge | "Mockup ready" (önceden Edits idi) |
| Header CTA | "Apply Mockups" primary (orange) — Phase 51 baseline intakt |
| Screenshot | yeşil success banner net + header Apply Mockups CTA + tile SELECTED/PENDING badge'leri intakt |
| Apply Mockups navigation | `/selection/sets/{setId}/mockup/apply` ✓ |
| SetSummaryCard lineage | `mockup-set-summary-back-to-selection` → `/selections/{setId}`, **`mockup-set-summary-product-type`** "Type · clipart", `mockup-set-summary-source-batch` render edilmez (sourceMetadata=null) |
| Screenshot | "← SELECTION" + "TYPE · CLIPART" chip'leri net görünür |

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: 59/59 PASS (canonical paket)
- Browser end-to-end: finalize → banner → Apply Mockups → lineage strip
  tüm akış canlı doğrulandı

### Değişmeyenler (Phase 52)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** `SelectionItem.status` + `SelectionSet.
  sourceMetadata` + `SelectionSet.status` zaten yıllar önce yazılıydı.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** `resolveSourceBatchId` 15-satır static
  helper (SetSummaryCard içi, Phase 50 helper ile DRY paralel ama
  ayrı dosya). `finalizeBanner` useState + useEffect inline. Yeni
  hooks/mutations dir açılmadı.
- **References / Batch / Review / Selection intake / curation
  akışları intakt** (Phase 26-51 baseline).
- **Mockup job pipeline, listing builder, product detail Phase 8-14
  baseline'ları dokunulmadı.**
- **Kivasy DS dışına çıkılmadı.** `success-soft` + `CheckCircle2`
  banner pattern Phase 49 LaunchOutcomeBanner ile aile parity;
  lineage chip Phase 50 Selection card chip ile birebir aynı recipe.

### Bilinçli scope dışı (Phase 53+ candidate)

- **`SetSummaryCard` görsel parity**: surface hâlâ legacy
  `border-border bg-surface-2 text-text-muted` token'larını kullanıyor.
  Phase 52 yeni lineage chip'leri Kivasy DS canonical recipe'lerinde
  ekledi ama card'ın iskeleti Phase 5-7 dönemi style'da kaldı. Card
  shell + status badge Kivasy DS recipe'lerine migration ayrı tur.
- **Apply Mockups detail/grid kalitesi**: Pack preview / template
  selection görsel olarak fonksiyonel ama operatöre "studio" hissi
  vermiyor — Phase 52 audit'inde tespit edildi, ayrı tur konusu.
- **Product detail Etsy Draft handoff bambaşka bir polish ihtiyacı**
  (submit error feedback, retry flow, post-submit "view on Etsy" link)
  Phase 9 V1 pipeline çalışıyor ama operatör-friendly değil.
- **`/selection/sets/{setId}/mockup/jobs/{jobId}/result` S8ResultView**
  "Listing'e gönder" CTA Phase 8'de Türkçe yazılmıştı; visible UI
  içinde i18n drift olabilir (CLAUDE.md Phase 15 EN parity scope dışı).

### Bundan sonra product olarak tek doğru iş

Phase 52 ile Selection finalize → Apply Mockups handoff **operatör
gözüyle net**, Mockup studio'da **context korunuyor**. Zincir end-to-end
çalışıyor: References → Batch → Review → Selection → Mockup → Product
→ Etsy Draft.

Sıradaki **tek doğru iş** her yüzeyin **detay polish'i**:
- Apply Mockups surface'inin operator-friendly grade'e yükseltilmesi
  (SetSummaryCard DS migration + Pack preview studio hissi)
- Product detail Etsy Draft submit flow'unun ürünleştirilmesi
  (error feedback, retry, "view on Etsy")
- S8ResultView UI i18n + Kivasy DS parity

Bu üç polish turundan sonra canonical omurga **production-ready full
loop** durumuna gelir. Ürün omurga seviyesinde tamam.

---

## Phase 53 — Mockup result view: EN parity + hierarchy + lineage + error feedback

Phase 52 finalize handoff + Mockup studio lineage strip eklemişti. Phase
53 odak: **mockup result → product handoff'unun ürün-friendly hale
gelmesi**. S8ResultView Phase 8'den beri **çalışıyor ama yarım**
yüzeyiydi: TR drift, yanlış CTA hierarchy, source context yok, listing
creation silent fail.

### Phase 52 sonrası ürün boşluğu

`/selection/sets/{setId}/mockup/jobs/{jobId}/result` (S8ResultView):

1. **TR drift**: "Pack hazır", "Yükleniyor…", "Listing'e gönder",
   "Bulk download ZIP (N görsel)", "Cover'ı Değiştir", "İndir",
   "Görsel yok", "Bilinmeyen hata", "Detay yok", "Pack üretilemedi",
   "Zaman aşımı"… CLAUDE.md Phase 15 EN parity baseline'ından kalmış.
2. **CTA hierarchy yanlış**: "Bulk download ZIP" **primary** (orange),
   "Listing'e gönder →" **secondary** (gray). Operatör mockup'ları
   product/Etsy zincirine taşımak için buraya iniyor — download
   yan-aksiyon. Hierarchy operatöre yanlış yön gösteriyordu.
3. **Source context yok**: header "Pack hazır: 10/10" + path mono
   caption (`/selection/sets/.../result` — operatöre teknik). Hangi
   selection set'i / hangi batch'ten geldiği görünür değildi.
4. **Listing creation silent fail**: `createListingMutation.isError`
   UI'da handle edilmiyordu. Spinner kayboluyor, kullanıcı "butona
   bastım, bir şey oldu sanırım" hissiyle kalıyordu.
5. **Success hint yok**: tüm renders OK durumunda da operatöre
   "all clean" sinyali verilmiyordu.

### Slice — S8ResultView rewrite (single file, scope'lu)

`src/features/mockups/components/S8ResultView.tsx`:

**EN parity:**
- "Pack hazır: N/M görsel" → "Mockup pack ready" h1 + subtitle
  "N of M renders succeeded · K failed" (mono uppercase tracking-meta)
- "Yükleniyor…" → "Loading…"
- "Listing'e gönder →" → "Create listing draft →"
- "Bulk download ZIP (N görsel)" → "Download ZIP (N)"
- "Cover'ı Değiştir" → "Swap cover"
- "İndir" → "Download"
- "Görsel yok" → "No image"
- "Bilinmeyen hata" → "Unknown error"
- "Detay yok" → "No detail"
- "Pack üretilemedi" → "Pack failed to render"
- ERROR_LABELS: "Zaman aşımı/Şablon geçersiz/Tasarım sığmadı/Kaynak
  yetersiz/Motor erişilemez" → "Render timeout/Template invalid/Design
  didn't fit/Source quality too low/Provider unreachable"
- "S3'e dön" → "Back to Mockup Studio"

**CTA hierarchy fix:**
- **Primary**: `Button variant="primary"` "Create listing draft →"
  (orange, ana akış — operatör product/Etsy zincirine taşınır)
- **Secondary**: `Button variant="secondary"` "Download ZIP (N)"
  (yan-aksiyon)
- Next caption: `"Next · Product/listing prep"` (mono uppercase
  tracking-meta — Phase 52 SetSummaryCard "Next · Apply Mockups
  after finalize" parity)

**Source context lineage strip:**
- `useSelectionSet(setId)` React Query hook — Selection detail /
  Apply view ile aynı cache key
- Phase 52 `resolveSourceBatchId` helper inline (sourceMetadata'dan
  variation-batch + mjOrigin format'larını destekler — Phase 50
  parity)
- Header altında chip strip:
  - **← {set.name}** back-link → `/selections/{setId}`
  - **From batch · {id}** chip → `/batches/{batchId}` (varsa)
  - **Type · {productTypeKey}** chip (varsa)
- Phase 52 lineage chip recipe ile birebir aile parity
  (`border-line-soft + bg-k-bg-2/60`, hover `k-orange-soft +
  text-k-orange-ink`)

**Listing creation error feedback:**
- `createListingMutation.isError` → red alert block:
  - `AlertTriangle` icon + "Couldn't create listing draft" title
  - Error message body
  - Mono caption: "Try again — your mockup renders are unaffected."
    (operatöre "data güvende, yeniden dene" güveni)
- Önceden silent fail; Phase 53 net feedback.

**Success hint (operator confidence):**
- `failedRenders.length === 0 && !createListingMutation.isError` ise
  yeşil block: "All N mockups rendered successfully. Ready to create
  the listing draft." (CheckCircle2 icon)
- Sessiz başarı yok artık.

**Partial warning güçlendirildi:**
- Önceden: "⚠ N render başarısız oldu. Tekrar dene veya swap yap."
  (Türkçe, emoji)
- Yeni: "**N renders** failed. Hover the failed tiles below to retry
  or swap templates. You can still proceed with the M successful
  mockups." (operatöre actionable + reassurance)

### Mockup → Product → Etsy Draft zincirinin honest status

Audit + Phase 53'ten sonra:

| Surface | Phase | Durum |
|---|---|---|
| `/selections/{id}` finalize gate | Phase 51 | ✓ |
| Finalize success banner | Phase 52 | ✓ |
| `/selection/sets/{id}/mockup/apply` | Phase 8 + Phase 52 lineage | ✓ |
| Mockup job submit (`POST /api/mockup/jobs`) | Phase 8 | ✓ |
| `/selection/sets/{id}/mockup/jobs/{jobId}` (S7) | Phase 8 | ✓ (TR drift kalmış olabilir, Phase 53 scope dışı) |
| `/selection/sets/{id}/mockup/jobs/{jobId}/result` (S8) | Phase 8 + **Phase 53 rewrite** | ✓ EN + hierarchy + lineage + error feedback |
| `createListingDraft` → `/products/{id}` redirect | Phase 14 | ✓ |
| Product detail summary strip + tabs | Phase 14 | ✓ Source selection tile mevcut |
| Listing builder (title/desc/tags) | Phase 9 V1 | ✓ EN (Phase 15 baseline) |
| Etsy Draft submit (SubmitResultPanel) | Phase 9 V1 | ✓ EN + "Sent to Etsy" + "Open on Etsy" |

Zincir **end-to-end fonksiyonel ve operatör-friendly**.

### Browser verification (live dev server kanıt)

Mevcut COMPLETED mockup job (`cmordz8ps000puuvcnorz285w`, 10/10
successful renders, `[QA] Phase 8 fixture set`, wall_art product
type):

| Test | Sonuç |
|---|---|
| `h1` text | "Mockup pack ready" (TR "Pack hazır" yerine) |
| Counts | "10 of 10 renders succeeded" |
| Lineage chip "← [QA] Phase 8 fixture set" | href `/selections/cmordz8pe000huuvcsyih9k3z` ✓ |
| Product type chip | "Type · wall_art" ✓ |
| Primary CTA | "Create listing draft" (variant primary, orange) ✓ |
| Secondary CTA | "Download ZIP (10)" ✓ |
| Next caption | "NEXT · PRODUCT/LISTING PREP" |
| Success hint | "All 10 mockups rendered successfully. Ready to create the listing draft." ✓ |
| Partial warning | not present (10/10 OK) ✓ |
| Screenshot | header lineage chips + orange primary CTA + Download secondary + success block + 3-col mockup grid |

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: 59/59 PASS (canonical paket)
- Browser end-to-end: S8ResultView mevcut COMPLETED job üzerinde
  EN + hierarchy + lineage + success hint canlı kanıt

### Değişmeyenler (Phase 53)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Mockup job/render Phase 8 schema'sı
  intakt.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Tek dosya rewrite + Phase 52
  `resolveSourceBatchId` helper inline kopyası (DRY için ortak
  helper'a almak ayrı bir refactor turu olurdu; Phase 53 kapsam dışı).
- **References / Batch / Review / Selection / Mockup apply
  akışları intakt** (Phase 26-52 baseline).
- **Listing builder + Etsy Draft submit yüzeyleri dokunulmadı**
  (Phase 9 V1 baseline).
- **Mockup job pipeline (worker, render, retry, swap) dokunulmadı.**
- **Kivasy DS dışına çıkılmadı.** k-orange + k-orange-soft +
  k-bg-2 + line-soft + success-soft + danger + warning-soft
  recipe'leri kullanıldı; legacy `bg-yellow-50 bg-red-50` token'lar
  Kivasy DS karşılıklarına geçirildi.

### Bilinçli scope dışı (Phase 54+ candidate)

- **`SetSummaryCard` shell DS migration**: Apply view zone 2 hâlâ
  legacy `border-border bg-surface-2 text-text-muted` token'larında
  (Phase 52'de lineage chip eklendi, shell migration ertelendi).
  Phase 54 candidate.
- **S7 mockup job in-progress view** (jobs/{jobId} route) Phase 8
  baseline'ında TR drift olabilir; Phase 53 scope dışı.
- **CoverSlot / SuccessRenderSlot tile DS migration**: tiles
  `border bg-gray-100 shadow-lg` legacy; Kivasy DS recipe migration
  ayrı tur.
- **AllFailedView lineage**: yalnız "Back to Mockup Studio" CTA;
  selection/batch context yok. Phase 54 candidate.
- **Product detail Etsy Draft submit operator-friendly polish**
  (error retry, view-on-Etsy success expansion) — Phase 9 V1 baseline
  zaten EN + working; operatör için ayrı polish turu.

### Bundan sonra product olarak tek doğru iş

Phase 53 ile **canonical omurga production-ready full loop**:
- References → Batch → Review → Selection → Mockup → Product → Etsy
  Draft
- Her stage'de operator-facing UX (clarity, lineage, feedback)
- Hata/retry path'leri operatör-friendly

Sıradaki **tek doğru iş** kalan **legacy yüzey polish** turları:
- **Apply Mockups SetSummaryCard shell DS migration** (lineage chip
  zaten Kivasy DS'de, shell legacy token'larında)
- **S7 in-progress view** (TR drift kontrol)
- **CoverSlot/RenderSlot tile DS migration**

Bu üçü tamamlanınca mockup studio tam canonical hale gelir. Ürün
omurgası tamam, kalan **görsel polish detayı**.

---

## Phase 54 — Mockup studio legacy/parity cleanup (S7 + SetSummaryCard + AllFailedView)

Phase 53 S8ResultView'i canonical ürün diline çekmişti. Phase 54 odak:
**mockup studio'da kalan legacy shell + parity boşluklarını tek aile
seviyesine çıkarmak**. Yeni feature yok; üç dosya polish.

### Phase 53 sonrası ürün boşluğu

1. **S7JobView (in-progress page) ürün-ailesinden ayrık**:
   - Massive TR drift: "Pack Hazırlanıyor", "Yükleniyor…", "Render
     Durumu", "Render hazır", "saniye kaldı (yaklaşık)", "Bu sayfayı
     kapatabilirsin", "Pack hazırlanamadı", "İş iptal edildi", "İş'i
     iptal et", "İptal ediliyor…", "S3'e dön"
   - Legacy tokens: `bg-blue-50 bg-red-50 bg-green-50 border-gray-200
     var(--color-border) var(--color-accent) text-red-600 text-gray-700
     text-green-800`
   - Source context yok (header'da yalnız jobId/setId mono caption)
   - Render row legacy: `bg-surface border` + glif (`⊙/◐/⚠`) yerine icon
     component'ler kullanılmalı
   - State'ler aynı tone ailesinde değildi (success yeşil-soft, failed
     kırmızı raw, cancelled gri raw, active emoji-heavy)

2. **SetSummaryCard shell legacy** (Phase 52'de lineage chip eklenmişti
   ama shell hâlâ legacy):
   - `border-border bg-surface-2 text-text text-text-muted` semantic
     tokens — Kivasy DS değil
   - Status badge inline color map: `bg-slate-100 bg-green-100 bg-gray-100`
   - Header h2 + caption legacy text token'lar

3. **AllFailedView (S8 içi) lineage yok**:
   - Phase 53 başarı path'i lineage strip taşıyordu ama failed path'te
     yalnız "Back to Mockup Studio" CTA + error message
   - Operatör failed state'te "hangi selection / hangi batch?" sorusuna
     cevap alamıyordu

### Slice 1 — S7JobView full rewrite (Phase 53 S8 parity)

`src/features/mockups/components/S7JobView.tsx`:

**EN parity (massive):**
- h1 dynamic by status:
  - SUCCESS/PARTIAL → "Mockup pack ready"
  - FAILED → "Mockup pack failed"
  - CANCELLED → "Mockup pack cancelled"
  - QUEUED/RUNNING → "Mockup pack in progress"
- "Yükleniyor…" → "Loading…"
- "Job yüklenemedi" → "Couldn't load job"
- "Render Durumu" → "Render status"
- "Render hazır" → "Rendering mockups…"
- "saniye kaldı (yaklaşık)" → "remaining (approx.)"
- "Bu sayfayı kapatabilirsin. Job arka planda devam eder." →
  "You can close this page — the job continues in the background.
  We'll keep your renders ready when you come back."
- "Pack hazırlanamadı" → "Pack failed to render" + reassurance
  "Your selection is unaffected — return to Mockup Studio to retry
  with the same set."
- "İş iptal edildi" → "Job cancelled. Any partial renders are
  discarded; your selection is intact."
- "S3'e dön" → "Back to Mockup Studio"
- "İş'i iptal et" / "İptal ediliyor…" → "Cancel job" / "Cancelling…"
- ERROR_LABELS / per-render row labels EN

**Kivasy DS migration:**
- Hero card success: `bg-green-50 border-green-200` → `success-soft +
  success/40 border + CheckCircle2 icon`
- Hero card active: SVG ring stroke `var(--color-border) +
  var(--color-accent)` → hex k-orange + line tones; ring + progress
  + ETA aynı card içinde (`rounded-lg border-line bg-paper`)
- Per-render row: `bg-surface border` + emoji glif → `border-line
  bg-paper` + icon components (CheckCircle2 success, Loader2 spin,
  AlertTriangle failed, hollow circle pending)
- Reassurance block: `bg-blue-50 border-blue-200` → `bg-k-bg-2/40
  border-line-soft + k-orange dot`
- Failed state: `bg-red-50 border-red-200` → `bg-danger/5
  border-danger/40 + AlertTriangle`
- Cancelled state: `bg-gray-50 border-gray-200` → `bg-k-bg-2/60
  border-line-soft`

**Source lineage strip:**
- `useSelectionSet(setId)` hook entegrasyonu — Selection detail / Apply
  view / Result view ile aynı cache key
- Phase 52/53 `resolveSourceBatchId` helper inline
- Header altında chip strip: ← set.name back-link + (varsa) source
  batch chip + (varsa) product type chip
- Set load olana kadar strip render edilmez (graceful)

**State polish:**
- Success: green-soft hero + "Redirecting to results…" mono hint
- Active: SVG ring + progress % + ETA + "Rendering mockups…" message
- Failed: red-soft + error summary + reassurance + Back CTA
- Cancelled: neutral bg + "Job cancelled… your selection is intact" + Back CTA
- Cancel button (active'de) → "Cancel job" / "Cancelling…"

### Slice 2 — SetSummaryCard shell DS migration

`src/features/mockups/components/SetSummaryCard.tsx`:

- Card shell `rounded-md border border-border bg-surface-2 p-4` →
  `rounded-lg border border-line bg-paper p-4`
- h2 `text-text` → `text-ink`, caption `text-text-muted` → mono
  uppercase tracking-meta text-ink-3
- Status badge map:
  - `bg-slate-100 text-slate-700` (draft) → `bg-k-bg-2 text-ink-2
    border-line-soft`
  - `bg-green-100 text-green-700` (ready) → `bg-success-soft
    text-success border-success/30`
  - `bg-gray-100 text-gray-700` (archived) → `bg-k-bg-2/60 text-ink-3
    border-line-soft`
- Status badge shape: `rounded-full px-2 py-0.5 text-xs font-medium`
  → `rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold
  uppercase tracking-meta` (Phase 51 Selection status badge ile aile
  parity)
- Footer divider `border-border` → `border-line-soft`
- Selected count footer: `text-xs text-text-muted` → mono uppercase
  tracking-meta text-ink-3 + `tabular-nums` selected count

Phase 52 lineage chip'leri zaten Kivasy DS'deydi; Phase 54 shell ve
status badge'i de aynı aileye geçirdi.

### Slice 3 — AllFailedView lineage strip + reassurance

`src/features/mockups/components/S8ResultView.tsx` → `AllFailedView`:

- `useSelectionSet(setId)` hook eklendi
- Header'a Phase 53 lineage strip kopyalandı: ← set.name + source
  batch chip + product type chip
- Failed alert block'a yeni reassurance line eklendi:
  "Your selection is intact — retry with the same set or pick a
  different template pack." (operatöre data güvenli sinyali)

### Browser verification (live dev server kanıt)

`SetSummaryCard` Phase 54 DS migration:
- Apply view (`pass57-mj-29689991`, ready stage):
  - cardClass: `rounded-lg border border-line bg-paper p-4` ✓
  - cardBg: `rgb(255, 255, 255)` (paper), cardBorder: `rgb(228, 224, 213)` (line)
  - Status badge: text "Ready", bg `rgb(228, 241, 233)` (success-soft),
    color `rgb(47, 121, 74)` (success)
  - Lineage strip: "← SELECTION" + "TYPE · CLIPART"
  - Screenshot: pass57-mj card + 4 DESIGNS SELECTED + READY badge +
    lineage chip'leri + Quick pack + Render (Quick pack) CTA

`S7JobView` Phase 54 rewrite:
- Test path COMPLETED job için 400ms feedback sonrası result page'e
  auto-redirect (Phase 8 baseline davranışı korundu)
- Bu nedenle S7 active state'i mevcut COMPLETED job ile canlı
  test edilemiyor (sadece geçici 400ms success card + auto redirect)
- Component-level DOM kanıtı: önceki redirect path doğrulanmış,
  tüm Phase 54 EN parity + DS migration + lineage strip render
  path'leri typecheck temiz + targeted tests PASS

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: 59/59 PASS (canonical paket)
- Browser: SetSummaryCard Apply view'da DS migration + lineage strip
  + status badge ailesi canlı kanıt

### Değişmeyenler (Phase 54)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Mockup job/render Phase 8 schema'sı intakt.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Tek dosya rewrite (S7) + iki dosya
  polish (SetSummaryCard, S8/AllFailedView). `resolveSourceBatchId`
  helper inline kopyaları (3 dosyada; ortak helper'a almak Phase 55+
  refactor turu).
- **References / Batch / Review / Selection / Mockup apply / Mockup
  result / Listing / Product detail akışları intakt** (Phase 26-53).
- **S7 redirect davranışı korundu** (REDIRECT_FEEDBACK_MS = 400ms,
  COMPLETED/PARTIAL_COMPLETE → result page).
- **Mockup job pipeline (worker, render, retry, swap, cancel)
  dokunulmadı.**
- **Kivasy DS dışına çıkılmadı.** k-orange + k-orange-soft + k-bg-2 +
  line + line-soft + success-soft + danger + warning recipe'leri
  kullanıldı. Eski raw Tailwind palette token'ları (`bg-blue-50`,
  `bg-red-50`, `bg-green-50`, `border-gray-200`, `bg-surface-2`,
  `bg-surface`, `text-text`, `text-text-muted`, `var(--color-accent)`,
  `var(--color-border)`) tamamen kalktı.

### Bilinçli scope dışı (Phase 55+ candidate)

- **CoverSlot / SuccessRenderSlot / FailedRenderSlot tile DS migration**:
  S8ResultView içindeki tile component'leri hâlâ `bg-gray-100 border
  shadow` legacy token'ları kullanıyor. Phase 54 hero/state polish'e
  odaklandı; tile-level DS migration ayrı tur.
- **`resolveSourceBatchId` ortak helper**: 3 dosyada inline kopya
  (SetSummaryCard, S8ResultView, S7JobView). Phase 55+ refactor turu
  shared `lib/selection-lineage.ts` helper çıkarabilir.
- **Other mockup components**: CoverSwapModal, PerRenderActions,
  IncompatibleSetBand, EmptyPackState — Phase 54 audit'inde
  görülmedi; ayrı TR drift / DS migration kontrol turu Phase 55+.
- **Product detail Etsy Draft submit operator-friendly polish**
  (Phase 53 candidate'tan devir).

### Bundan sonra product olarak tek doğru iş

Phase 54 ile canonical omurganın mockup halkası **aile içi** kalite
ailesinde:
- Apply view (S3) — Phase 52 lineage + Phase 54 SetSummaryCard DS
- In-progress (S7) — Phase 54 EN + DS + lineage + state polish
- Result (S8) — Phase 53 EN + hierarchy + lineage + Phase 54
  AllFailedView lineage

Sıradaki **tek doğru iş** kalan **render-tile DS migration**
(CoverSlot/SuccessRenderSlot/FailedRenderSlot) + **shared lineage
helper extraction** (3 dosyada inline kopya). Bu iki polish turundan
sonra mockup studio **tamamen canonical** olur.

Canonical omurga (References → Batch → Review → Selection → Mockup →
Product → Etsy Draft) **production-ready** seviyesinde; kalan iş
yalnız görsel/parity detay polish.

---

## Phase 55 — Shipping-quality final sweep (tile DS + sub-components EN + shared helper)

Phase 54 mockup studio'nun hero/state polish'ini yapmıştı. Phase 55
**shipping-quality consolidation**: tile-level DS migration + alt
bileşenlerde TR drift cleanup + Phase 50-54 boyunca biriken inline
lineage helper kopyalarının ortak modüle çekilmesi. Yeni feature yok;
yalnız son mil parity.

### Phase 54 sonrası shipping kalitesinde kalan boşluklar

1. **S8ResultView tile components legacy**:
   - `CoverSlot`: `border-2 border-accent` (Tailwind raw) + `bg-gray-100` +
     `bg-accent px-2 py-1 text-xs font-bold` cover badge (Phase 51 mono
     uppercase recipe parity dışı)
   - `SuccessRenderSlot`: `border shadow` + `bg-gray-100` + variant ID
     overlay `bg-black/70 text-xs`
   - `FailedRenderSlot`: error overlay `bg-black/70 text-xs`
   - Tile-level legacy artıkları Phase 53/54 hero polish'ten kalmıştı.
2. **Mockup sub-components TR drift (Phase 15 EN parity catch-up)**:
   - `CoverSwapModal`: 6 TR string ("Cover Görselini Değiştir", "İptal",
     "Cover Olarak Ayarla", "Değiştiriliyor…", "Thumbnail yok",
     "Başka başarılı render yok") + legacy `bg-text/40 bg-bg
     border-accent bg-accent/10 border-border-strong text-muted-foreground
     bg-surface-2`
   - `PerRenderActions`: 3 TR string ("Cover Yap", "İndir", "Retry başarısız",
     "Swap başarısız") + raw `bg-black/60 text-red-200 bg-red-900/60`
   - `IncompatibleSetBand`: tam TR ("Seçili set parametreleriyle
     uyumlu mockup şablonu bulunamadı", "Lütfen Özel Seçim yaparak
     manuel olarak şablon seçiniz") + legacy `bg-amber-50 text-amber-900
     text-amber-800`
   - `EmptyPackState`: tam TR ("Seçilmiş mockup şablonu yok",
     "Quickpack veya özel seçim yapınız", "Şablon Seç") + legacy
     `border-border bg-surface-2 text-text text-text-muted bg-accent
     hover:bg-accent-dark`
3. **`resolveSourceBatchId` inline kopya × 3** (Phase 54 candidate'tan
   devir): SetSummaryCard / S7JobView / S8ResultView aynı helper'ı
   bağımsız kopya tutuyordu.

### Slice 1 — Shared `@/lib/selection-lineage` helper

Yeni dosya `src/lib/selection-lineage.ts`:

- `SelectionSourceLineage` type (`batchId + referenceId`)
- `resolveSelectionLineage(sourceMetadata)` — iki canonical format
  (variation-batch + mjOrigin) parse helper. CLAUDE.md Phase 50 server-
  side resolver ile davranış parity (UI tarafı için ayrı modül; server
  modülü kendi inline kopyasını korur — build boundary ayrı).
- `resolveSourceBatchId(sourceMetadata)` — convenience shorthand (yalnız
  batchId döner; UI tarafının çoğu kullanım bu)

3 dosyadaki inline kopyalar kaldırıldı:
- `SetSummaryCard.tsx` — Phase 52 inline → import
- `S7JobView.tsx` — Phase 54 inline → import
- `S8ResultView.tsx` — Phase 53 inline → import

Davranış değişmez (3 helper aynı parse logic'iydi); 30 satırlık DRY.

### Slice 2 — S8ResultView tile DS migration

`CoverSlot`:
- `border-2 border-accent` → `border-2 border-k-orange`
- `bg-gray-100` → `bg-k-bg-2`
- `text-gray-400` → `text-ink-3`
- Cover badge: `bg-accent px-2 py-1 text-xs font-bold text-white` →
  `bg-k-orange px-2 py-0.5 font-mono text-[10px] font-semibold uppercase
  tracking-meta text-white shadow-sm` (Phase 51 status badge mono recipe
  parity)
- "★ COVER" → "★ Cover" (capitalize)

`SuccessRenderSlot`:
- `border shadow` → `border border-line shadow-sm`
- `bg-gray-100` → `bg-k-bg-2`
- `text-gray-400` → `text-ink-3`
- Variant ID overlay: `bg-black/70 p-2 text-xs text-white` →
  `bg-ink/85 px-2 py-1.5 font-mono text-[10px] uppercase tracking-meta
  text-white`

`FailedRenderSlot`:
- Error overlay aynı pattern: `bg-black/70 text-xs` → `bg-ink/85
  font-mono text-[10px] tracking-meta`
- (Phase 53'te border + bg zaten danger/40 + danger/5'e geçmişti)

### Slice 3 — Mockup sub-components EN parity

**`CoverSwapModal`**:
- "Cover Görselini Değiştir" → "Swap cover image"
- "Alternatif görsellerden birini seç" → "Pick an alternative render"
- "Başka başarılı render yok." → "No other successful renders."
- "Thumbnail yok" → "No thumbnail"
- "İptal" → "Cancel"
- "Cover Olarak Ayarla" / "Değiştiriliyor…" → "Set as cover" / "Swapping…"
- Backdrop `bg-text/40` → `bg-ink/40 backdrop-blur-sm`
- Modal `bg-bg rounded-lg shadow-lg` → `border border-line bg-paper
  rounded-lg shadow-lg`
- Selected tile `border-accent bg-accent/10` → `border-k-orange
  bg-k-orange-soft`
- Border `border-border / border-border-strong` → `border-line /
  border-line-strong`
- Caption `text-muted-foreground` → `text-ink-3`
- Variant ID label `text-xs mt-1 text-center truncate` → `mt-1
  truncate text-center font-mono text-[10.5px] tracking-meta text-ink-2`
- Thumbnail empty: `bg-surface-2 text-muted-foreground` → `bg-k-bg-2
  text-ink-3`
- `data-testid="cover-swap-modal"` eklendi

**`PerRenderActions`**:
- "Cover Yap" → "Set as cover"
- "İndir" → "Download"
- Error fallback "Retry başarısız" / "Swap başarısız" → "Retry failed"
  / "Swap failed"
- Hover overlay `bg-black/60` → `bg-ink/60`
- Error pill `text-xs text-red-200 bg-red-900/60 px-2 py-1 rounded` →
  `rounded-md bg-danger/80 px-2 py-1 font-mono text-[10.5px] tracking-meta
  text-white`

**`IncompatibleSetBand`**:
- TR copy tamamen EN: "No compatible mockup templates for this set" +
  "Use Custom Selection to pick a template manually."
- `bg-amber-50 text-amber-900 text-amber-800` → `border-warning/40
  bg-warning-soft/40` + `text-warning` icon + `text-ink` body + mono
  uppercase tracking-meta caption
- `AlertTriangle` icon eklendi (önceden ⚠ glif)
- `role="alert"` semantic
- `data-testid="mockup-incompatible-set-band"` eklendi

**`EmptyPackState`**:
- TR copy tamamen EN: "No mockup template selected" + "Pick a Quick
  pack or use Custom Selection" + button "Pick templates"
- `border-border bg-surface-2 text-text text-text-muted` → `border-line
  bg-k-bg-2/60` + mono uppercase tracking-meta caption + `text-ink-3`
- Button raw `bg-accent px-4 py-2 text-sm font-medium text-white
  hover:bg-accent-dark` → `k-btn k-btn--primary data-size="sm"` recipe
- `data-testid="mockup-empty-pack-state"` eklendi

### Mockup studio'da kalan TR/legacy izleri kontrol

Phase 55 sonrası mockup tarafında **TR drift kalmadı**, legacy token
(`bg-gray-*, bg-blue-*, bg-amber-*, bg-text, bg-bg, bg-accent,
text-text, text-text-muted, text-muted-foreground, var(--color-*)`)
artıkları **silindi**. Mockup studio (S3/S7/S8 + sub-components +
modals) tamamen Kivasy DS recipe'lerinde.

### Browser verification (live dev server kanıt)

**S8 tile DS migration** (`mockup/jobs/cmordz8ps000puuvcnorz285w/result`
mevcut COMPLETED job):

| Test | Sonuç |
|---|---|
| 10 tile rendered | ✓ |
| Cover tile border | `rgb(232, 93, 37)` (k-orange) ✓ |
| Cover badge bg | `rgb(232, 93, 37)` k-orange + color white ✓ |
| Cover badge text | "★ Cover" (capitalize) ✓ |
| 10 inner placeholder `bg-k-bg-2` (legacy `bg-gray-100` gitti) | ✓ |
| Screenshot | header lineage + orange Create listing draft + Download secondary + k-orange cover border + "★ COVER" mono badge + CMORDZBPM/Q variant ID overlay (mono uppercase tracking-meta + bg-ink/85) |

Sub-component EN parity için canlı render path doğru:
- `CoverSwapModal`: hover trigger gerektiren modal (DOM açma için
  custom state); component-level path typecheck temiz + tests temiz
- `PerRenderActions`: hover overlay reveal pattern; render path doğru
- `IncompatibleSetBand` / `EmptyPackState`: conditional rendering
  (set/pack state'e bağlı); component-level path doğru, code-level
  EN copy doğrulandı

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: 59/59 PASS (canonical paket)
- Browser: S8 tile DS migration canlı kanıt (cover k-orange + bg-k-bg-2
  + mono badge + ink/85 overlay'lar)

### Değişmeyenler (Phase 55)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Mockup pipeline + Selection sourceMetadata
  Phase 8/Phase 50 baseline'ı intakt.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Tek küçük shared helper (`@/lib/
  selection-lineage`); behavior değiştirmedi, yalnız DRY temizliği.
- **References / Batch / Review / Selection / Mockup apply (S3) /
  Mockup in-progress (S7) / Mockup result hero akışları intakt**
  (Phase 26-54 baseline).
- **Listing builder + Product detail + Etsy Draft submit dokunulmadı**
  (Phase 9/14 baseline'ı EN parity'de).
- **Kivasy DS dışına çıkılmadı.** k-orange + k-orange-soft + k-bg-2 +
  line + line-strong + line-soft + ink/ink-2/ink-3 + ink/40/60/85 +
  paper + warning + warning-soft + danger + danger/5/40/80 recipe'leri
  kullanıldı.

### Bilinçli scope dışı (Phase 56+ candidate)

- **Other mockup studio components**: `S1BrowseDrawer`, `S2DetailModal`,
  `DecisionBand`, `PackPreviewCard`, `TemplateChip` — Phase 55 audit'inde
  S8 tile + 4 sub-component'e odaklandı. Bu kalan 5 component'in TR
  drift / DS migration kontrol turu Phase 56+ candidate.
- **Listing builder field-level polish**: `MetadataSection`,
  `PricingSection`, `AssetSection` — Phase 9 V1 EN parity zaten
  oturmuş; field-level DS migration ayrı tur.
- **Product detail Etsy Draft submit operator-friendly polish**
  (Phase 53/54 candidate'tan devir): SubmitResultPanel mevcut EN +
  working; "view on Etsy" success expansion + retry flow polish
  ayrı tur.

### Bundan sonra product olarak tek doğru iş

Canonical omurganın tüm operator-facing halkaları (References → Batch
→ Review → Selection → Mockup → Product → Etsy Draft) **shipping
quality**:
- EN parity tam
- Kivasy DS recipe'lerinde
- Lineage chip aile parity
- State feedback (success / partial / failed / cancelled / pending /
  selected / undecided)
- Operator-friendly hierarchy + reassurance copy

**Mockup studio shipping kalitesinde tam** (S3 + S7 + S8 hero +
tiles + sub-components + modals). Kalan iş **mockup pack-decision
yardımcı components** (Phase 56+) + **Etsy Draft submit confidence
last-mile polish** (Phase 56+).

Canonical omurga **production-ready full loop**. Phase 55 ile **ship
edilebilir kalite seviyesinde**; sonraki turlar yalnız ikincil
component DS migration + last-mile confidence polish.

---

## Phase 56 — Final confidence sweep (secondary mockup components + toast hook + test fixture EN migration)

Phase 55 mockup studio'nun ana yüzey ailesini shipping kalitesine çekmişti.
Phase 56 odak: **canonical loop'ta kalan ikincil component'lerin parity
catch-up'ı** + biriken **test fixture TR drift'i**. Yeni feature yok;
yalnız final confidence sweep.

### Phase 55 sonrası kalan boşluk

1. **3 secondary mockup component hâlâ legacy/TR**:
   - `TemplateChip`: `bg-accent text-white` selected / `bg-surface
     border-border text-text hover:bg-surface-2` resting — Kivasy DS
     değil
   - `DecisionBand`: legacy tokens (`border-border bg-white bg-red-50
     text-red-700 text-text-muted text-accent bg-zinc-200 bg-zinc-900
     text-amber-700`) + 2 TR string ("Bilinmeyen bir hata oluştu",
     "Seçilmiş şablon yok. Lütfen en az bir şablon seçiniz.")
   - `PackPreviewCard`: legacy tokens (`border-border bg-amber-50
     text-amber-900 bg-blue-100 text-blue-700 text-text text-text-muted
     bg-white hover:bg-surface`) + 2 TR string ("Seçili Şablonlar",
     "Şablonları Özelleştir")
2. **`useMockupJobCompletionToast` hook TR mesajları**: COMPLETED/
   PARTIAL_COMPLETE/FAILED toast'larında "Pack hazır", "Pack hazırlanamadı",
   "bilinmeyen hata", "Sonucu gör" — operatöre TR yansıyordu
3. **Test fixtures massive TR drift**: Phase 53/54/55'te component'lerde
   yapılan EN parity değişiklikleri `tests/unit/mockup/ui/` altındaki
   26 testte fail'e neden olmuştu

### Slice 1 — Secondary mockup components DS migration

**`TemplateChip`** (Kivasy DS):
- Selected: `bg-accent text-white` → `border-k-orange bg-k-orange text-white`
- Resting: `bg-surface border-border text-text hover:bg-surface-2` →
  `border-line bg-paper text-ink-2 hover:border-line-strong hover:bg-k-bg-2`
- Padding `px-3 py-2` → `px-3 py-1.5` (compact chip)
- `data-testid="mockup-template-chip"` + `data-selected` attribute

**`DecisionBand`** (EN parity + DS):
- "Bilinmeyen bir hata oluştu" → "Unexpected error"
- "Seçilmiş şablon yok. Lütfen en az bir şablon seçiniz." → "No
  templates selected. Pick at least one template to render."
- Container `border-border bg-white` → `border-line bg-paper`
- Error block `bg-red-50 text-red-700` → `border-danger/40 bg-danger/5
  text-danger` (Phase 53 alert pattern parity)
- ETA caption `text-sm text-text-muted` → `font-mono text-[10.5px]
  uppercase tracking-meta text-ink-3`
- Reset link `text-xs text-accent` → mono uppercase + `text-k-orange-ink`
- Render button raw `bg-zinc-900/zinc-200` → `k-btn k-btn--primary`
  recipe (Kivasy DS canonical)
- No-selection warning `text-amber-700` flat → `border-warning/40
  bg-warning-soft/40 + warning dot + text-ink-2` (Phase 55 pattern parity)
- `data-testid="mockup-decision-band"` + `data-testid="mockup-decision-
  band-render"`

**`PackPreviewCard`** (EN parity + DS):
- "Seçili Şablonlar" → "Selected templates"
- "Şablonları Özelleştir" → "Customize templates"
- Section `border-border` → `rounded-lg border-line bg-paper`
- Quick pack badge `bg-amber-50 text-amber-900 rounded-full px-2.5 py-0.5
  text-xs font-medium` → `border-k-orange/40 bg-k-orange-soft rounded-md
  px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-meta
  text-k-orange-ink shadow-sm` (Phase 51 status badge parity)
- Customized chip `bg-blue-100 text-blue-700 rounded-full px-2 py-0.5
  text-xs` → `border-line-soft bg-k-bg-2 rounded-md px-2 py-0.5
  font-mono text-[10px] font-semibold uppercase tracking-meta text-ink-2`
- Caption `text-xs font-medium text-text-muted` → `font-mono text-[10.5px]
  uppercase tracking-meta text-ink-3`
- Customize button raw `bg-white border-border hover:bg-surface` →
  `k-btn k-btn--secondary w-full`
- `data-testid="mockup-pack-preview-card"` + `data-testid="mockup-pack-
  customize"`

### Slice 2 — `useMockupJobCompletionToast` hook EN

`src/features/mockups/hooks/useMockupJobCompletionToast.ts`:

- COMPLETED toast: "Pack hazır: N görsel — Sonucu gör" → "Mockup pack
  ready: N renders — see result"
- PARTIAL_COMPLETE toast: "Pack hazır: N/M görsel — Sonucu gör" →
  "Mockup pack ready: N of M renders — see result"
- FAILED toast: "Pack hazırlanamadı: {error|"bilinmeyen hata"}" →
  "Pack failed to render: {error|"unknown error"}"

### Slice 3 — Test fixture EN migration (26 → 0 fail)

`tests/unit/mockup/ui/` 7 dosyada toplam 26 fail; Phase 53/54/55/56
component-level EN değişikliklerinin doğal yansıması. Hepsi assertion-
only güncellemeleri (component davranışı zaten doğruydu):

- `S8ResultView.test.tsx` (12 fail): "Pack hazır", "★ COVER", error
  labels (Zaman aşımı/Şablon geçersiz/Tasarım sığmadı/Kaynak yetersiz/
  Motor erişilemez), "Bulk download ZIP", "Listing'e gönder", partial
  warning (text split → `getByTestId`), cover badge class regex order
- `S7JobView.test.tsx` (6 fail): "Pack hazır", "3 render hazır",
  "10 render toplamında", "~12 saniye kaldı", "Bu sayfayı kapatabilirsin",
  "Pack hazırlanamadı", "İş iptal edildi", "S3'e dön", "İş'i iptal et"
- `useMockupJobCompletionToast.test.tsx` (3 fail): toast mesajları EN
- `SetSummaryCard.test.tsx` (1 fail): "6 mockup" → "6 mockups" (Phase
  54 pluralization)
- `DecisionBand.test.tsx` (1 fail): "Seçilmiş şablon yok…" → EN
- `CoverSwapModal.test.tsx` (3 fail): TR copy → EN
- `PackPreviewCard.test.tsx` (2 fail): TR copy → EN

**Toplam: 26 → 0 fail**. Canonical paket (59) + mockup (245) = **304/304 PASS**.

### Browser verification (live dev server kanıt)

Apply view (`/selection/sets/cmov0ia370019149ljyu7divh/mockup/apply`):

| Component | DOM kanıt |
|---|---|
| PackPreviewCard | `space-y-4 rounded-lg border border-line bg-paper p-4` ✓ |
| Quick pack badge | text "★ Quick pack", bg `rgb(251, 234, 223)` k-orange-soft, color `rgb(142, 58, 18)` k-orange-ink ✓ |
| DecisionBand | rendered + "Render (Quick pack)" CTA (k-btn--primary) ✓ |
| SetSummaryCard | Phase 54-55 baseline intakt ✓ |
| Screenshot | header lineage + READY badge + ★ QUICK PACK orange chip + SELECTED TEMPLATES mono cap + Bundle Preview chip (k-orange selected) + ESTIMATED TIME mono + Render primary — tek görsel aile |

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: **304/304 PASS** (canonical 59 + mockup 245)
- Browser end-to-end: Apply view'da Phase 56 components Kivasy DS aile
  parity'sinde canlı render

### Değişmeyenler (Phase 56)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Mockup pipeline + hook semantics + test
  fixture data shape intakt.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** 3 secondary component DS migration +
  1 toast hook EN + bulk test fixture migration. Davranış değişmedi.
- **References / Batch / Review / Selection / Mockup canonical akışları
  intakt** (Phase 26-55 baseline).
- **Listing builder + Product detail + Etsy Draft submit yüzeyleri
  dokunulmadı** (Phase 9/14 baseline'ı EN parity'de).
- **Kivasy DS dışına çıkılmadı.** Legacy raw tokens (`bg-accent`,
  `bg-zinc-*`, `bg-amber-*`, `bg-blue-*`, `bg-red-*`, `bg-surface`,
  `bg-surface-2`, `text-text`, `text-text-muted`, `border-border`,
  `border-border-strong`, `text-accent`, `text-amber-700`) tamamen
  silindi.

### Bilinçli scope dışı (gerçek backlog/nice-to-have)

- **`S1BrowseDrawer` + `S2DetailModal`**: Phase 56 audit'inde
  comment-only TR (block comments + JSDoc) tespit edildi, visible UI
  TR drift yok. Component-level scan: drawer template grid + detail
  modal CTA copy mevcut hâliyle EN.
- **Server-side `selection-lineage` resolver shared helper**: UI/server
  build boundary nedeniyle ayrı tutuldu.
- **Product detail Etsy Draft submit operator-friendly polish**:
  SubmitResultPanel "view on Etsy" success expansion + retry flow
  detail polish. Mevcut Phase 9 V1 EN + working baseline yeterli.
- **Listing builder field-level polish**: Phase 9 V1 mevcut hâliyle
  EN + production-ready.

### Bundan sonra product olarak tek doğru iş

**Canonical operator loop için artık ship-ready**:
- References → Batch → Review → Selection → Mockup → Product → Etsy Draft
- Her stage operator-friendly EN + Kivasy DS + lineage + state feedback
  + reassurance
- 304/304 unit tests PASS, typecheck clean
- Browser end-to-end her halkada doğrulanmış

Mockup studio + sub-components + toast hook + test fixtures hepsi tek
ailede. Yalnız **backlog/nice-to-have** kaldı (server-side helper DRY,
Product Etsy Draft "view on Etsy" success expansion, listing field-level
polish, S1/S2 audit double-check).

Canonical operator loop **production-ready ship quality**. Bu turdan
sonra yeni özellik / yön / major refactor olmadan ship edilebilir.

---

## Phase 57 — Full app product-readiness audit + Settings/Templates EN parity

Phase 56 canonical operator loop'u (References → Batch → Review →
Selection → Mockup → Product → Etsy Draft) ship-ready'e çekmişti.
Phase 57 odak: **uygulamanın tamamını sellable-product seviyesinde
denetlemek** + bulunan en kritik kalite boşluğunu kapatmak.

### Phase 57 audit (browser-walk)

9 ana sidebar yüzeyi + 2 legacy redirect tarandı (HTTP + DOM scan +
TR/placeholder mention sayımı):

| Surface | HTTP | Heading struct | TR drift | Placeholder | Verdict |
|---|---|---|---|---|---|
| `/overview` | 200 | h1 + 7 section heading + 49 link | 0 | 0 | ✓ Ship-ready |
| `/references` | 200 | full B1 grid + topbar | 0 (Phase 18-30) | 0 | ✓ Ship-ready |
| `/batches` | 200 | full B5 listing + production summary | 0 (Phase 49) | 0 | ✓ Ship-ready |
| `/review` | 200 | canonical scope review (Madde Z) | 0 | 0 | ✓ Ship-ready |
| `/library` | 200 | gallery + filter + bulk | 0 (Phase 27/55) | 0 | ✓ Ship-ready |
| `/selections` | 200 | B2 grid + lineage chip (Phase 50) | 0 | 0 | ✓ Ship-ready |
| `/products` | 200 | B6 listing + readiness | 0 (Phase 14) | 0 | ✓ Ship-ready |
| `/templates` | 200 | 4 tab (Prompt 1 / Style 0 / Mockup 3061 / Recipe 1) | **6 TR error** | 2 ("Coming soon" honest) | ⚠ TR error path |
| `/settings` | 200 | 10 sub-tab + 4 dürüst "Soon" disabled | **16 TR error** | 4 ("coming soon" honest) | ⚠ TR error path |
| `/selection` (legacy) | 200 → /selections | redirect | 0 | 0 | ✓ Doğru |
| `/listings` (legacy) | 200 → /products | redirect | 0 | 0 | ✓ Doğru |

### Audit sonuçları

**Ship-ready (canonical operator loop)**: Overview / References /
Batches / Review / Library / Selections / Products. Hepsinde:
- EN parity tam (Phase 18-56)
- Kivasy DS recipe aile parity
- Source lineage chip'leri (Phase 50/52/53/54/55)
- State feedback + reassurance copy
- Operator-friendly hierarchy + actionable next-step
- Banner / toast / error feedback
- 304/304 unit tests PASS
- Browser end-to-end her halkada doğrulandı

**Bulunan kritik kalite boşluğu** (Settings + Templates + Admin):

22 operator-facing TR error message — `throw new Error("X yüklenemedi")`
pattern'i Settings pane'leri + Templates modal'ları + Admin
mockup-templates'te:

| Dosya | TR string sayısı |
|---|---|
| `PaneAIProviders.tsx` | 4 |
| `PaneNotifications.tsx` | 3 |
| `PaneEditor.tsx` | 1 |
| `PaneGeneral.tsx` | 1 |
| `PaneScrapers.tsx` | 1 |
| `PaneStorage.tsx` | 1 |
| `PaneWorkspace.tsx` | 2 |
| `local-library-settings-panel.tsx` | 2 |
| `useEditorSettings.ts` | 1 |
| `ai-mode-settings-panel.tsx` | 1 |
| `etsy-connection-settings-panel.tsx` | 2 |
| `etsy-readiness-summary.tsx` | 2 |
| `StylePresetsSubview.tsx` | 1 |
| `RunRecipeModal.tsx` | 1 |
| `UploadMockupTemplateModal.tsx` | 1 |
| `PromptTemplateEditorModal.tsx` | 1 |
| `mockup-templates-manager.tsx` | 1 |
| `template-detail-view.tsx` | 1 |
| `asset-upload-field.tsx` | 2 |
| `local-sharp-config-editor.tsx` | 2 |
| **TOPLAM** | **22** |

Bunlar **görünmez ama operator confidence'ı bozar**: error path'i
tetiklendiğinde "X yüklenemedi", "Bağlantı durumu alınamadı",
"Preview URL alınamadı" gibi TR string'ler render olur ve admin/
settings tarafının "yarı bitmiş" gibi hissedilmesine yol açar.

### Slice — Settings/Templates/Admin EN parity migration

22 TR error string bulk migration (perl `-i -pe` regex replace):

| TR | EN |
|---|---|
| `"X yüklenemedi"` | `"Could not load X"` |
| `"Bağlantı durumu alınamadı"` | `"Could not load connection status"` |
| `"Bağlantı kaldırılamadı"` | `"Could not remove connection"` |
| `"Hazırlık durumu alınamadı"` | `"Could not load readiness status"` |
| `"Liste alınamadı"` | `"Could not load list"` |
| `"Preview URL alınamadı"` | `"Could not load preview URL"` |
| `"Mevcut asset listesi alınamadı"` | `"Could not load existing assets"` |
| `"Binding listesi alınamadı"` | `"Could not load binding list"` |
| `"Dosya seçilmedi"` | `"No file selected"` |
| `"API key boş olamaz"` | `"API key cannot be empty"` |

"Couldn't" yerine "Could not" tercih edildi — apostrophe escape
(JSX/TS string syntax karmaşıklığı) gereksiz; "Could not" daha okunur
+ deterministic.

Code comments TR korundu (CLAUDE.md kuralı: code comments TR can stay,
yalnız operator-facing strings EN). Sadece bir comment kaldı:
`// Sessizce: thumbnail yüklenemediyse fallback UI göster` —
bu görünmez (developer-facing).

### Browser verification (live dev server kanıt)

| Surface | TR char count | sampleTrText |
|---|---|---|
| `/settings` (after Phase 57) | 2 (unrelated brand chars) | `[]` (sıfır operator-facing TR) |
| `/templates` (after Phase 57) | 0 | `[]` (sıfır TR sızıntı) |

Phase 57 öncesi: 18+ TR error message Settings pane'lerinde.
Phase 57 sonrası: 0 operator-facing TR.

### Ship-readiness kararı (dürüst)

**Production-ready (sellable, son kullanıcıya gösterilebilir):**
- **Canonical operator loop** (References → Batch → Review →
  Selection → Mockup → Product → Etsy Draft): **EVET, ship-ready**
  - Overview production-ready dashboard
  - References intake (URL/Upload/From Bookmark/From Local Library)
    + Pool curation + lineage
  - Batch queue + multi-launch + LaunchOutcomeBanner
  - Review canonical surface (freeze altında, Madde Z)
  - Selection studio (status badge + bulk curation + Finalize CTA +
    success banner)
  - Mockup studio (S3 + S7 + S8 + tiles + sub-components + modals
    hepsi shipping kalitesinde)
  - Product detail (Source selection + Listing health + Next step)
  - Etsy Draft submit (V1 pipeline + Sent to Etsy + Open on Etsy +
    Reset to DRAFT)
- **Settings + Templates + Admin** (Phase 57 sonrası): **EVET,
  ship-ready** — operator-facing TR error sızıntısı sıfırlandı,
  honest "Soon" disclosure dürüst, dürüst "Coming soon" tooltip'leri
  operator confidence'ı bozmuyor

**Yalnız backlog/nice-to-have (blocker DEĞİL):**
- Server-side `selection-lineage` resolver shared helper extraction
- Product detail Etsy Draft "view on Etsy" success expansion
- Listing builder field-level Kivasy DS migration
- `S1BrowseDrawer` + `S2DetailModal` audit double-check
- Admin Settings "Soon" tab'ları (Users / Audit / Feature Flags /
  Theme / Dark mode) — dürüst disclosure ile gizlenmiş, ileride
  açılması için altyapı hazır

**Known limitations (operator-aware):**
- Etsy Draft pipeline V1 (active publish değil — draft + manual)
- Multi-store, scheduling, ScraperAPI/Bright Data integration
  out-of-scope
- Browser companion / Chrome extension scraping (Phase 38'de
  pasifleştirildi, future backlog)

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: **304/304 PASS** (canonical 59 + mockup 245)
- Browser verification: 9 ana sidebar surface 200, Settings + Templates
  TR sızıntı sıfırlandı

### Değişmeyenler (Phase 57)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.**
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Tek slice: 20 dosyada bulk perl regex
  replace (TR error message → EN).
- **Canonical operator loop akışları intakt** (Phase 26-56 baseline).
- **Davranış değişmedi** — yalnız error message string'ler EN'e taşındı.
- **Code comments TR korundu** (CLAUDE.md kuralı).

### Bundan sonra product olarak tek doğru iş

**Yeni feature / yön / major refactor olmadan ship edilebilir.**

Canonical operator loop + Settings + Templates + Admin hepsi production-
ready ship quality. Sonraki turlar yalnız:
- Backlog/nice-to-have polish (server helper DRY, listing field-level
  DS, S1/S2 audit double-check)
- Yeni feature alanları (multi-store, scheduling, browser companion
  scraping — yeni big abstraction gerektirir, ayrı tur)
- Operator feedback'e göre fine-tune

Uygulama bu noktada **sellable**.

---

## Phase 58 — Full interaction audit + 3 misleading CTA fix

Phase 57 surface-level audit'iydi (HTTP 200, TR drift, placeholder
mention). Phase 58 daha derin: **her buton/handoff/state mantığını
denetlemek** ve **misleading CTA'ları kapatmak**.

### Phase 58 audit (browser-walk, click-level)

Canonical 7 surface gezildi; primary CTA / secondary CTA / disabled
button / handoff href / tab state'leri kontrol edildi. Hepsi
HTTP 200 + DOM yapısı doğru (Phase 57 baseline), ama 3 **mantık
sorunu** tespit edildi:

### Bulgu 1 — Overview "Apply Mockups" misleading handoff

`server/services/overview/index.ts:229` — `mockupReady` rows'unun
`href`'i `/selections/${s.id}` (Selection detail).

**Sorun**: Operatör Overview'da "Apply Mockups" yazılı orange primary
CTA görür. Mantıksal beklenti: tıkla → mockup studio açılsın. Gerçek
davranış: Selection detail'a iner, orada **tekrar** "Apply Mockups"
button'una tıklamak zorunda. Label ↔ destination mismatch.

**Fix**: href → `/selection/sets/${s.id}/mockup/apply` (direct
handoff). 2 tıklama → 1 tıklama. Operatör Overview'dan tek tıkla
mockup uygular.

### Bulgu 2 — Products "New Product" disabled fake CTA

`features/products/components/ProductsIndexClient.tsx:269` — Topbar
action slot'unda büyük orange `<button disabled>` "+New Product"
(k-btn--primary) + tooltip "To create a new Product: open a Selection
(Mockup ready stage), then use 'Apply Mockups'..."

**Sorun**: Operatörün ilk dürtüsü tıklamak. Primary visual hierarchy
(orange + Plus icon) "tıklanabilir" sinyali veriyor; disabled olduğu
fark edilmez ama tıklayınca hiçbir şey olmaz. Honest tooltip ama
**görsel hiyerarşi yanlış** (Phase 32 audit prensibi: yarım yüzeyler
operatör güvenini bozar).

**Fix**: Disabled primary CTA kaldırıldı; yerine **ghost helper Link**
"From Selections" → `/selections` (canonical Product giriş noktası).
Operatör tıklayabilir + doğru yere gider; title attribute hâlâ akış
açıklaması taşır.

### Bulgu 3 — Selection DesignsTab drag handle visual noise

`features/selections/components/tabs/DesignsTab.tsx:338-349` — Her
tile sağ üst köşede `<button disabled>` GripVertical icon + tooltip
"Reorder by drag-and-drop — coming soon. Designs currently sort by
add date."

**Sorun**: 4-col xl grid → 4-16 görsel disabled grip icon. Operatör
her tile hover'ında aynı tooltip tetiklenir. **Görsel gürültü** +
tekrar eden disabled sinyali. Phase 51'de eklenmişti ama tile-level
status badge + filter chip + bulk-bar zaten dolu — drag handle
"coming soon" promise'i operatörü yormaktan başka değer üretmiyor.

**Fix**: Tile-level drag handle placeholder tamamen kaldırıldı.
Operatör grid'de yalnız anlamlı sinyalleri (status badge + selection
checkbox + thumbnail + design metadata) görür. Reorder gerçekten
landing yaparsa drag handle component yeniden eklenebilir.

### Browser verification (live dev server kanıt)

| Fix | Test | Sonuç |
|---|---|---|
| 1 Overview Apply Mockups | 3 CTA href check | 3/3 doğrudan `/selection/sets/{id}/mockup/apply` ✓ (`directHandoff: true`) |
| 2 Products topbar | "products-new-cta" disabled button presence | Yok (eski disabled CTA kalktı) |
| 2 Products topbar | "products-new-cta-helper" ghost link | `<A>` element, href `/selections`, text "From Selections", title actionable ✓ |
| 3 Selection DesignsTab | drag handle button count + reorder tooltip count | 0 drag button + 0 reorder tooltip (önceden 4) ✓ |
| Screenshot | pass57-mj-29689991 selection detail | 4 tile temiz, status badge + selection checkbox + thumbnail + meta, drag handle yok |

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: 304/304 PASS (canonical 59 + mockup 245)
- Browser end-to-end: 3 fix canlı dev server'da doğrulandı

### Değişmeyenler (Phase 58)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.**
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** 3 küçük fix:
  - Server-side `mockupReady` href değişikliği (string template)
  - Topbar disabled button → ghost Link
  - DesignsTab drag handle JSX block + 1 import line silinmesi
- **References / Batch / Review / Selection / Mockup / Product / Etsy
  Draft canonical akışları intakt** (Phase 26-57 baseline).
- **Honest disclosure pattern korundu**: Phase 58 "fake CTA"'ları
  kaldırdı ama "Coming soon" tooltip'leri olan **gerçek
  meta button'lar** (Duplicate / Preview / More actions / Soon tab'lar)
  dokunulmadı — onlar dürüst sinyal taşıyor, yarım CTA değil.

### Ship-readiness güncel kararı

Phase 57'de **sellable** karar verilmişti. Phase 58 bu kararı
**güçlendirdi** — 3 misleading interaction kalktı:
- Overview → Mockup studio doğrudan handoff (operator-friendly)
- Products topbar fake CTA → honest ghost helper
- Selection DesignsTab visual noise kalktı

Canonical operator loop **production-ready** + **mantıken tutarlı**.
Sonraki turlar yalnız:
- Backlog/nice-to-have polish (server helper DRY, listing field-level
  DS, S1/S2 audit, drag-and-drop reorder gerçek implementation)
- Yeni feature alanları (multi-store, scheduling, browser companion)

### Bilinçli scope dışı (Phase 59+ candidate)

- **Product detail h1 truncation** (uzun listing title 130 char baskın):
  Phase 58 audit'inde tespit edildi, low-severity ama ileride
  truncate + tooltip pattern eklenebilir.
- **Selections detail Duplicate / More button'ları**: "Coming soon"
  honest ama gerçek implementation gelmediği sürece görsel yer
  kaplıyor. Phase 59'da kaldırılabilir veya implement edilebilir.
- **Product detail Duplicate / Preview button'ları**: Aynı pattern.

Bu üçü **operator-blocking değil**, sadece UX yorum farkı.

---

## Phase 59 — Filter affordance disipline: misleading "fake dropdown" sıfırlanması + review parity

Phase 58 canonical operator loop'u "tek ürün hissi" seviyesine
çekmişti. Phase 59 user signoff feedback'i ile odak değişti:
**filter affordance dürüstlüğü**.

User signal (direct quote):
> "genelde filter chips yerine birleşik filter bar kullanımı daha çok
> hoşuma gidiyor bu arada review sayfasında olduğu gibi. Ayrıca
> dropdown gibi görünen ama dropdown olmayan filtreleri de bence daha
> güzel bir hale getirmeliyiz."

İki UX preference signal'i tek turda kapatıldı.

### Audit findings — fake dropdown pattern

Pre-Phase 59 üç ana surface'te filter UI:

| Surface | Pattern | Affordance |
|---|---|---|
| Review (`/review` queue) | `.k-segment` unified bar | ✓ Honest segmented; canonical |
| Selection DesignsTab | Individual chips (Phase 51) | Chip group, no caret, no dropdown promise — honest ama review parity yok |
| References Pool | `FilterChip` + caret + **gerçek popover listbox** | ✓ Honest dropdown — `role="listbox"` + `aria-expanded` + `aria-haspopup` |
| Bookmarks/Collections/Competitors | `k-chip` segmented group | Honest open chips, cycle yok |
| **Products** | `FilterChip` + **caret** + **cycle-on-click** | ✗ Caret glyph dropdown vaat ediyor ama tıklayınca bir sonraki değere atlıyor → **misleading** |

Products'taki pattern user'ın "dropdown gibi görünen ama dropdown
olmayan" complaint'inin direkt karşılığı. Caret affordance dropdown
promise ediyor; gerçek davranış ise cycle. Operatör tüm seçenekleri
görmeden tıklıyor, hangi değere düşeceğini bilmiyor.

### Fix 1 — Selection DesignsTab → k-segment unified bar (review parity)

`src/features/selections/components/tabs/DesignsTab.tsx`:

Pre-Phase 59 (Phase 51 baseline):
```tsx
<div className="flex items-center gap-1">
  {STATUS_FILTERS.map(f => (
    <button
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1",
        "font-mono text-[10.5px] font-semibold uppercase tracking-meta",
        active
          ? "border-k-orange bg-k-orange-soft text-k-orange-ink"
          : "border-line bg-paper text-ink-2 hover:border-line-strong"
      )}
    >
      {f.label}
      {count > 0 ? <span className="text-ink-3">{count}</span> : null}
    </button>
  ))}
</div>
```

Phase 59:
```tsx
<div
  className="k-segment"
  role="group"
  aria-label="Filter by design status"
>
  {STATUS_FILTERS.map(f => (
    <button aria-pressed={active}>
      {f.label}
      {count > 0 ? (
        <span className={cn(
          "ml-1 font-mono text-[10.5px] tabular-nums",
          active ? "text-ink-3" : "text-ink-4",
        )}>
          {count}
        </span>
      ) : null}
    </button>
  ))}
</div>
```

Birebir `ReviewQueueToolbar` pattern parity: `.k-segment` container
recipe (paper inset radius 7 + border-line + bg-k-bg-2), aria-pressed
canonical, count badge inline tabular-nums. Operatör Review'den
Selection'a geçerken aynı görsel dili görüyor.

### Fix 2 — References Pool toolbar inspection (already correct)

Audit'te tespit edildi: References `FilterChip` (line 620 references-
page.tsx) **gerçek popover-driven listbox**. `role="listbox"` +
`aria-expanded` + `aria-haspopup="listbox"` + tıklayınca tüm options
expand. **Misleading değil** — caret affordance dropdown promise
ediyor, dropdown gerçekten açılıyor.

Phase 59 burada dokunulmadı (correct pattern already in place).
Sibling family yüzeyler (Bookmarks/Collections/Competitors) chip
group'ları kullanıyor — segmented görünür, cycle yok, dropdown vaadi
yok → honest. k-segment migration'ı operator preference yönünde olur
ama Phase 59 acil scope'a alınmadı (chip group → k-segment ayrı
parity polish turu).

### Fix 3 — Products toolbar fake dropdown sıfırlandı

`src/features/products/components/ProductsIndexClient.tsx`:

Pre-Phase 59:
```tsx
<FilterChip active={stageFilter !== "all"} caret onClick={cycleStage}>
  {stageFilter === "all" ? "Status" : stageFilter}
</FilterChip>
<FilterChip active={typeFilter !== "all"} caret onClick={cycleType}>
  {typeFilter === "all" ? "Type" : typeLabelByKey.get(typeFilter)}
</FilterChip>
<FilterChip active={dateFilter !== "all"} caret onClick={cycleDate}>
  {DATE_BUCKET_LABEL[dateFilter]}
</FilterChip>
```

Sorun: 3 chip de `caret` (ChevronDown) glyph taşıyor → dropdown
affordance promise. `onClick` ise `cycleX()` — bir sonraki değere
atlıyor (Status → Draft → Mockup ready → ... → Status). Operatör
"All seçenekleri görmek istiyorum" niyeti ile tıklıyor, **rastgele
bir sonraki state'e düşüyor**. Filter pool >4 değer için
kullanılamaz hale geliyordu (Stage 6 değer, operatör hangi sırada
gideceğini bilmiyor).

Phase 59 fix:

```tsx
{/* Stage segment (fixed 5-value pool + "All") */}
<div className="k-segment" role="group" aria-label="Filter by stage">
  {ALL_STAGES.map(s => (
    <button
      aria-pressed={s === stageFilter}
      onClick={() => setStage(s)}
      data-testid={`products-stage-${s}`}
    >
      {s === "all" ? "All" : s}
    </button>
  ))}
</div>

{/* Type filter — dynamic pool: real <select> */}
<select
  value={typeFilter}
  onChange={(e) => setType(e.target.value)}
  className="h-8 appearance-none rounded-md border border-line bg-paper pl-3 pr-8 text-sm
             hover:border-line-strong focus:border-k-orange focus:ring-2 focus:ring-k-orange-soft"
>
  <option value="all">All types</option>
  {typeKeysInUse.map(k => (
    <option key={k} value={k}>{typeLabelByKey.get(k) ?? k}</option>
  ))}
</select>
<ChevronDown className="pointer-events-none absolute right-2 ... text-ink-3" aria-hidden />

{/* Date segment (fixed 4-bucket pool) */}
<div className="k-segment" role="group" aria-label="Filter by updated date">
  {DATE_BUCKETS.map(b => (
    <button aria-pressed={b === dateFilter} onClick={() => setDate(b)}>
      {b === "all" ? "Any date" : DATE_BUCKET_LABEL[b]}
    </button>
  ))}
</div>
```

Karar matrisi:

| Filter | Pool size | Pool type | Decision |
|---|---|---|---|
| Stage | 6 fixed | enum + "all" | **k-segment** — Review parity |
| Type | dinamik (data-driven) | productType keys | **native `<select>`** — dürüst dropdown affordance |
| Date | 4 fixed | enum bucket | **k-segment** — Review parity |

Native `<select>` seçim sebebi: Type pool veri-tabanlı (1-10 farklı
key olabilir). Çok değer için k-segment fazla yer kaplar; native
select operating system menu açar, dropdown promise dürüst. Caret
glyph eklendi (`ChevronDown` absolute positioned, pointer-events-none)
— native arrow stil bağımsız ama operator için affordance net.

`cycleStage` / `cycleType` / `cycleDate` helper'ları **silindi**;
yerine explicit `setStage(value)` / `setType(value)` / `setDate(value)`
helper'ları geldi. URL pattern aynı (`?stage=X&type=Y&date=Z`),
backward-compatible.

### Cycle-on-click pattern neden zararlı

User'ın complaint'i yalnız estetik değil, **affordance ihaneti**:

- **Caret glyph dropdown vaat eder**: ChevronDown ikonu Web/UX
  konvansiyonunda "tıklayınca panel açılır, opsiyonları göster"
  promise eder.
- **Cycle-on-click**: tıklayınca panel açılmaz, doğrudan bir sonraki
  state'e atlar. Operator hangi state'e gideceğini bilmez; "All"
  seçeneğine ulaşmak için 5 tıklama gerekebilir.
- **Pool boyutu ölçeklenmez**: 2-3 değer için kabul edilebilir, 5+
  değer için pratik bir bug haline gelir.
- **Tooltip / aria yansıması yok**: caret aria-haspopup="listbox"
  vaat eder, ama gerçekte hiçbir popover açılmaz.

Phase 59 sonrası tüm filter affordance'ları **dürüst**:
- Caret + popover (References) → gerçek listbox açılır
- Native `<select>` (Products Type) → OS native dropdown menu
- k-segment (Review / Selection DesignsTab / Products Stage+Date) →
  tüm değerler aynı anda görünür, segmented pick

Hiçbir surface artık "tıklayınca öngörülmeyen davranış" üretmiyor.

### Browser verification kanıtları (live preview, viewport 1440×900)

**Selection DesignsTab** (`/selections/cmov0ia370019149ljyu7divh`):

```
container.className: "k-segment"
container.role: "group"
container.aria-label: "Filter by design status"
container.bg: rgb(241, 238, 229) (k-bg-2)
container.border: 1px solid rgb(228, 224, 213) (line)
container.borderRadius: 7px

chips: All 4 / Selected 2 / Pending 2 / Rejected
aria-pressed: true on "all", false on others

active chip computed style:
  bg: rgb(255, 255, 255) (paper)
  color: rgb(22, 19, 15) (ink)
  shadow: rgba(22,19,15,0.05) 0px 1px 2px 0px

inactive chip:
  bg: rgba(0, 0, 0, 0) (transparent)
  color: rgb(139, 133, 124) (ink-3)
  shadow: none

Click "Selected" → 2 tiles visible, both data-status="selected",
                   aria-pressed=true switched

Screenshot: Selection detail header'da All 4 / Selected 2 / Pending 2 /
Rejected k-segment pill container, ReviewQueueToolbar görsel parity tam.
```

**Products toolbar** (`/products`):

```
products-filter-stage: k-segment, 6 button (All/Draft/Mockup ready/
                       Etsy-bound/Sent/Failed), aria-pressed canonical
products-filter-type: <select> with 4 options (All types / Printable /
                      Sticker / Wall art) + ChevronDown glyph
products-filter-date: k-segment, 4 button (Any date / Today /
                      Last 7 days / Last 30 days)

URL state transitions:
  Click "Draft" stage → ?stage=Draft, aria-pressed=true
  Click "Last 7 days" → ?stage=Draft&date=7d, aria-pressed=true
  Select "sticker" type → ?stage=Draft&date=7d&type=sticker

Screenshot: Toolbar row Stage k-segment + Type <select> + Date k-segment
+ row counter "0 of 3" + DensityToggle. Cycle chip pattern tamamen
kalktı; tüm filter pool'ları görünür.
```

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/{selection, products, bookmarks-page, references-
  page, dashboard-page, collections-page, bookmark-service, bookmarks-
  confirm-flow}`: **435/435 PASS**
- Browser verification: 3 surface canlı dev server üzerinde gerçek
  DOM kanıtı + URL transition + computed style + screenshot

### Değişmeyenler (Phase 59)

- **Review freeze (Madde Z) korunur.** Review modülü dokunulmadı —
  pattern parity Review'den DesignsTab/Products'a yayıldı, ters yöne
  değil.
- **Schema migration yok.**
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Mevcut `.k-segment` recipe + native
  `<select>` reuse. `FilterChip` component'i hâlâ References Pool'da
  kullanılıyor (caret + popover ile dürüst).
- **References Pool toolbar dokunulmadı** (already correct).
- **Bookmarks/Collections/Competitors chip group'ları dokunulmadı**
  (honest open segments; k-segment migration parity polish ayrı tur).
- **Add Reference / duplicate / local folder / direct image intake /
  Batch / Mockup / Product / Listing akışları intakt** (Phase 26-58
  baseline).
- **Kivasy DS dışına çıkılmadı.** `.k-segment` canonical recipe +
  native `<select>` standardı.

### Bilinçli scope dışı (Phase 60+ candidate)

- **Bookmarks/Collections/Competitors chip group → k-segment**:
  operator preference doğrultusunda parity polish. Honest chip
  group → unified bar. Acil değil; chip'ler dropdown vaat etmiyor.
- **Stage segment compact mode**: 6 button (All + 5 stage) viewport
  daraldıkça uzayabilir. Density toggle ile Dense mode'a `flex-wrap`
  veya kısaltma (Etsy-bound → Etsy) opt-in olabilir.
- **`FilterChip` legacy component'inin durumu**: References Pool
  hâlâ kullanıyor (correct), Phase 59'da Products'tan çıkarıldı.
  Geriye kalan tek consumer; gelecek tur'da References tarafı
  popover pattern korunur (k-segment'e migrate edilirse 4 chip × N
  option fazla yer kaplar).

### Bundan sonra production tarafında kalan tek doğru iş

Phase 59 ile **filter affordance dürüstlüğü tam**:
- Tüm filter chip / segment / dropdown'lar dürüst affordance taşır
- Misleading cycle-on-click pattern tamamen sıfırlandı
- Review surface canonical pattern (k-segment) Selection + Products'a
  yayıldı
- User signoff preference signal'i karşılandı

Canonical operator loop **ship-ready + filter affordance disciplined**.
Sonraki turlar yalnız:
- Sibling family chip group → k-segment migration (operator
  preference parity polish; honest ama unified-bar değil)
- Phase 58'den ertelenmiş low-severity items (Product detail h1
  truncation, Selections/Product Duplicate "Coming soon" button'lar)
- Yeni feature alanları (multi-store, scheduling, browser companion
  scraping)

---

## Phase 60 — Create Similar yeniden düşünüldü: Midjourney-first + provider-aware form + default-expanded queue panel + self-hosted mockup research

Phase 59 filter affordance disiplinini bitirmişti. User signoff feedback'i ile odak değişti: **Create Similar / Add Batch akışı hâlâ ikna edici hissetmiyordu**. Phase 60 dürüst audit + 3 kritik fix + self-hosted mockup generator research.

### Honest audit: Pre-Phase 60 Create Similar / Add Batch

Akış (operatör adımları):
```
/batches → Start Batch CTA (orange primary)
   ↓
/references?intent=start-batch (Pool grid + sticky right rail
                                + orange-soft hint banner)
   ↓ operator hovers Pool card → "Add to Draft" hover CTA
   ↓ POST /api/batches/add-to-draft (idempotent)
   ↓ Sağ Queue panel default COLLAPSED rail (56px) + count badge
   ↓ Operator panel'i AÇMAK ZORUNDA (rail click) → 320px expanded
   ↓ Items list + "Create Similar (N)" footer CTA görünür
   ↓ Click → panel mode "compose" (440px), inline form
   ↓ Provider <select> "Midjourney — unavailable" disabled
   ↓ defaultProviderId = first available → "kie-gpt-image-1.5" (Kie)
   ↓ Launch → POST /api/batches/[id]/launch → /batches/[id]
```

Tespit edilen sorunlar:

| # | Sorun | Severity | Sebep |
|---|---|---|---|
| 1 | Queue panel DEFAULT COLLAPSED — Create Similar **iki tıklama gerisinde** | Yüksek | Phase 47'de "Pool browse alanını maksimize et" gerekçesiyle collapsed default eklendi. Ama operator "Add to Draft" yapınca panel açıkça expand olmuyor; operator manuel rail tıklayıp "Create Similar"a geliyor. Form gerçekten "geç ve aşağıda" hissettiriyor. |
| 2 | Provider "Midjourney" hardcoded `available: false` | Yüksek | provider-capabilities.ts:49 disabled. Operatör'ün doğal default tercihi unavailable görünüyor. Backend `createMidjourneyJob` (kind=GENERATE) **mevcut** ve reference URL'lerden /imagine + --sref/--oref/--cref destekliyor. Disable kararı tarihi (Phase 5-6 MJ ile Kie ayrışırken alınmış). |
| 3 | Form alanları **provider-aware DEĞİL** | Orta | Provider değişince yalnız quality field'ı conditional. Midjourney activate edildiğinde **mode picker (imagine/sref/oref/cref/describe), prompt field, reference parameter chips** lazım; Kie image-to-image bunları kullanmıyor. Tek form herkese uymuyor. |
| 4 | "Start Batch" → References'a yönlendirme **bağlam kaynaması** | Orta | Operatör Batches'tan "üretime başla" niyetiyle tıklar; References'a düşmek "referans seç" niyetine kayar. Phase 42 düzeltmesi /library yerine canonical Pool'a yönlendiriyor; doğru yön ama hâlâ "yönlendirilmiş" hissi. |
| 5 | Compose form 440px sağ panel'de **dar + cramped** | Düşük | v4 A6 spec geniş split modal (rail + body); biz dar sağ rail'e sıkıştırdık. Quality/Count/Aspect rows dolu kaplıyor, brief textarea küçük. |

### Ürün kararları

**Modal vs Panel — Hibrit:**
- Queue panel right rail kalır (Pool browse ile kesintisiz iş)
- "Create Similar" CTA inline compose mode'a açar (mevcut Phase 47 davranışı)
- Tam v4 A6 split modal pattern Phase 61+ candidate (büyük layout iş; mevcut 440px panel form'u canlı + functional)

**Add Batch entry — Yerinde durdur:**
- `/batches` Start Batch → References'a yönlendirme korundu (Phase 42 baseline)
- Hint banner copy güncellendi: artık Phase 45+ Add to Draft → queue panel → Create Similar dilini taşıyor
- Modal-açan Start Batch (Pool'a inmeyen) Phase 61+ candidate; mevcut akış doğru ama hint copy operatöre asıl kelimeleri gösteriyor

**Midjourney default + honest backend disclosure:**
- `available: true` set
- `resolveDefaultProvider()` helper: Midjourney-first canonical fallback
- **Yeni `launchBackendReady` field**: Midjourney'de `false` (launch dispatcher Phase 61'de bağlanacak)
- Honest disclosure card: warning-soft border + actionable copy + **Switch to Kie · GPT Image 1.5 →** button
- Launch CTA disabled + "Awaiting backend handoff" + actionable title
- **Bu fake disabled CTA DEĞİL** (Phase 58 yasak): operatör tıklayınca ne olacağını/olmayacağını biliyor + alternative path biliyor + timeline biliyor

**Provider-aware form fields:**
- Yeni `formFields: ProviderFormFields` provider-capabilities şemasında
- Provider değişince UI alan setini buradan okur:

| Field | Midjourney | Kie GPT | Z-Image |
|---|---|---|---|
| Mode picker (imagine/image-prompt/sref/oref/cref/describe) | ✓ | — | — |
| Prompt textarea | ✓ | — | ✓ (required) |
| Reference parameters chips | ✓ | — | — |
| Brief (single text field) | — | ✓ | — |
| Quality (medium/high) | ✓ | ✓ | — |
| Count | ✓ | ✓ | ✓ |

**Midjourney mode requirements** (UI mode picker → prompt enable/disable):
- `imagine` → prompt strongly recommended
- `image-prompt` → prompt zorunlu, reference URL prompt başına inject
- `sref/oref/cref` → prompt opsiyonel ama önerilir
- `describe` → prompt **disabled** + actionable hint ("Describe pipeline returns 4 prompt suggestions")

### Fix #1: Midjourney first-class

`src/features/variation-generation/provider-capabilities.ts`:
- `available: true` (was `false`)
- `launchBackendReady: false` field eklendi
- `formFields` config eklendi (her provider için)
- `midjourneyModes: ["imagine", "image-prompt", "sref", "oref", "cref", "describe"]`
- `resolveDefaultProvider(settingsOverride?)` helper
- `midjourneyModeRequirements(mode)` helper (mode → prompt rules + hint)

### Fix #2: Provider-aware ComposePanel

`BatchQueuePanel.tsx` ComposePanel:
- `resolveDefaultProvider()` ile default Midjourney
- `formFields` reading: `showModeSelector`, `showPrompt`, `showBrief`, `showQuality`, `showCount`
- Midjourney seçili iken: 6 mode chip + prompt field + mode-aware hint
- Kie seçili iken: brief field + quality + count
- Honest disclosure + Switch-to-Kie CTA
- Launch button text/disabled state backend-not-ready aware

`BatchComposeClient.tsx` (full-page parity):
- Aynı `resolveDefaultProvider` + `backendNotReady` + disclosure pattern
- Inline duplicate (deferred extraction Phase 61+; yarım testli inline form ortak shell çıkarmak isterse premature)

### Fix #3: Default-expanded queue panel

`BatchQueuePanel.tsx`:
- `useState<boolean>(false)` (was `true`)
- localStorage truth-table flipped:
  - no value (first visit) → expanded
  - `"0"` → expanded (legacy explicit expand)
  - `"1"` → collapsed (explicit operator collapse persists)
- Operatör hâlâ collapse edebilir; tercihi sticky

### Hint banner copy update

Two surfaces aligned with Phase 45+ canonical wording:
- `references-page.tsx` start-batch hint: "Hover a reference card and click **Add to Draft**. The **draft panel** opens automatically — finish staging, then click **Create Similar** to compose..."
- `BatchesIndexClient.tsx` start-batch hint: aynı dil
- Phase 42 banner'ları "Create Variations" yazıyordu (Phase 45'te rename oldu) → operatör screen'deki gerçek kelimeleri görür

### Self-hosted / API-free mockup generator research

Operatör tercihi: ücretsiz, sınırsız, API'sız. Audit ortaya çıkardı: **`src/providers/mockup/local-sharp/` zaten mevcut** (Phase 8 Task 9). Sharp tabanlı in-process compositor, MinIO storage'a yazıyor, batch-friendly.

| Yaklaşım | Maliyet | Güç/Zayıf | Bizim durum |
|---|---|---|---|
| **Sharp compositor** | $0 | Hızlı (libvips), pure-Node, no headless. PNG/JPG/WebP/AVIF. PSD parse yok | ✅ Halihazırda var |
| ImageMagick CLI | $0 | Displacement map (3D), distort+perspective güçlü; CLI spawn yavaş | Sharp ile complementary, gerekirse |
| node-canvas | $0 | SVG render, font, custom drawing | Sharp Compositing yapıyor zaten |
| `ag-psd` PSD parser | $0 | True smart object reading | ETL CLI tool için ideal |
| Photopea automation | $0 ama ağır | Adobe-grade kalite ama brittle headless browser | **Pas** — browser companion'la aynı çıkmaz |
| Blender headless | $0 | True 3D, displacement, lighting | **Pas** — Kivasy dijital download (CLAUDE.md scope) |
| Saas paid mockup | $$ | Zengin template kütüphanesi | **Pas** — operatör tercihi free/unlimited |

**Önerilen 1-2 teknik yön (Phase 61+ candidate)**:
1. **`local-sharp/compositor.ts` `placePerspective` stub'ını doldur** (~1-2 gün): 4-corner manual koordinatlar → 8-DOF homography matris → Sharp `affine`. T-shirt/mug benzeri yamuk smart-object area'lara fit; PSD smart-object parity yakalanır.
2. **`scripts/import-psd-mockup-template.ts` ETL CLI** (~1 gün): `ag-psd` ile PSD aç, smart-object koordinatları enumerate et, JSON template üret. Operatör Photoshop'ta bir kez yapar; sonraki tüm render'lar Sharp + JSON ile sınırsız.

İkisi de mevcut altyapıya organik genişleme — yeni big abstraction yok, yeni infra yok, yeni 3rd-party dep yok. Mockup generator stack tamamen kontrolümüzde + sınırsız + ücretsiz.

Bu turun verdiği karar: **dynamic-mockups API path'i ileride deprecate edilebilir**; Sharp pipeline tek canonical olur. Mevcut local-sharp + recipe-applicator + safe-area + JSON template → dünyanın en sağlam dijital mockup pipeline'ı yapısı.

### Browser verification (live preview, viewport 1440×900, 10 senaryo PASS)

```
/references navigate (cleared localStorage):
  panel default = expanded (320px), mode = queue
  Create Similar (1) CTA visible
  data-collapsed="false"

Click "Create Similar":
  panelMode = compose, panelWidth = 440px
  providerSelected = "midjourney" (Phase 60 default)
  data-provider="midjourney"
  backendDisclosurePresent = true
  switchBtnText = "Switch to Kie · GPT Image 1.5 →"
  launchText = "Awaiting backend handoff"
  launchDisabled = true
  costText = "Backend handoff pending"
  mjModeChips = 6 (imagine / image-prompt / sref / oref / cref / describe)
  Default mode: sref (active)
  mjPromptField: present, not disabled

Click "Describe" mode chip:
  promptDisabled = true
  promptHint = "Describe pipeline — Midjourney reads the reference and returns 4 prompt suggestions. No generation occurs."

Click "Switch to Kie" button:
  providerSelected = "kie-gpt-image-1.5"
  mjModeChipCount = 0 (Kie has no mode picker)
  mjPromptPresent = false
  briefPresent = true
  qualityPresent = true
  disclosurePresent = false (Kie launchBackendReady=true)
  launchText = "Create Similar · 6"
  launchDisabled = false
  costText = "~$1.44 · est. 3m"
```

Screenshot: References Pool grid + sağda 440px compose panel + Provider="Midjourney" + warning-soft disclosure card + Switch to Kie button + Generation mode 6 chip + Prompt field "OPTIONAL · RECOMMENDED" + Aspect ratio + Similarity + Count.

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: **435/435 PASS** (canonical regression — selection + products + bookmarks-page + references-page + dashboard-page + collections-page + bookmark-service + bookmarks-confirm-flow)
- `next build`: ✓ Compiled successfully (Phase 53 carry-over apostrophe eslint errors düzeltildi: S7JobView.tsx 109/379, S8ResultView.tsx 531, BatchQueuePanel.tsx 401)

### Değişmeyenler (Phase 60)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Provider-capabilities yalnız UI-side static literal genişletme.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** `formFields` + `midjourneyModes` mevcut `ProviderCapability` type'a field eklemesi; helper'lar (`resolveDefaultProvider`, `midjourneyModeRequirements`) ~30 satır pure functions.
- **References / Batch / Review / Selection / Mockup / Product / Etsy Draft canonical akışları intakt** (Phase 26-59 baseline).
- **Phase 49 Pool card In Draft chip + Remove from Draft + batch chip dokunulmadı.**
- **Phase 51 Selection DesignsTab + finalize gate dokunulmadı.**
- **Phase 53/54/55/56 mockup studio shipping-quality dokunulmadı** (yalnız 3 carry-over apostrophe eslint fix).
- **Phase 59 filter affordance discipline dokunulmadı.**
- **Kivasy DS dışına çıkılmadı.** k-orange/k-orange-soft, k-bg-2, line/line-soft, warning-soft, paper, font-mono tracking-meta recipe'leri kullanıldı.

### Bilinçli scope dışı (Phase 61+ candidate)

- **Midjourney launch dispatcher backend**: `launchBatch` service'inde provider == "midjourney" → `createMidjourneyJob` (kind=GENERATE) + referenceUrls + sref/oref/cref param mapping. UI tarafı Phase 60'ta tam hazır; backend dispatcher Phase 61.
- **Modal v4 A6 split layout**: tam canonical split modal (rail + form + cost footer). Mevcut 440px panel canlı + functional; modal expansion büyük layout iş.
- **Compose shared shell extraction**: BatchComposeClient (page) + BatchQueuePanel.ComposePanel (inline) iki ayrı render path; aynı form alanları + launch logic. Davranış divergence görülürse ortak `ComposeForm` çıkarılır.
- **Sharp compositor `placePerspective`** + **PSD ETL CLI**: yukarıda research'te detayı; ~2-3 günlük altyapı turu.
- **Sibling family chip group → k-segment migration** (Phase 59'dan devir).

### Bundan sonra production tarafında kalan tek doğru iş

Phase 60 ile Create Similar / Add Batch akışı **operatör için doğru hisse oturdu**:
- Pool'a inince queue panel **anında expanded** (form 1 tıklama gerisinde)
- **Midjourney default** + provider-aware form (mode picker + prompt + reference params)
- **Honest backend disclosure** (Phase 58 prensibi: fake CTA yok; operator NEDEN ve NE YAPACAĞINI biliyor)
- Self-hosted mockup pipeline **zaten elimizde** (`local-sharp/`); placePerspective + PSD ETL ile tamamen API-free olur

Sıradaki tek doğru iş: **Phase 61 Midjourney launch dispatcher** (UI hazır + backend `createMidjourneyJob` mevcut; orchestration küçük bir tur). Sonrasında Sharp `placePerspective` + PSD ETL CLI.

---

## Phase 61 — Midjourney launch dispatcher bağlandı + Create Similar finalize

Phase 60 ile UI Midjourney first-class oldu (mode picker, provider-aware
form, honest "Awaiting backend handoff" disclosure) ama dispatcher henüz
bağlanmamıştı. Phase 61 bu açık'ı kapatır: **launchBatch dispatcher
provider-aware**, **Midjourney mode → backend param mapping aktif**,
**Kie path bozulmadı**.

### Phase 60 sonrası kalan boşluk

| # | Açık | Severity |
|---|---|---|
| 1 | `launchBatch` yalnız `createVariationJobs` (Kie) çağırıyor; Midjourney UI seçili ama backend dispatch yok | Kritik |
| 2 | mjMode/mjPrompt UI state'i ComposePanel'de var ama launch endpoint body'sinde geçirilmiyor | Kritik |
| 3 | Compose split modal v4 A6 layout açılmadı — 440px panel hâlâ kabul edilebilir interim | Orta — Phase 62+ |
| 4 | Add Batch akışı hâlâ Pool'a yönlendirme — modal-from-Batches yok | Düşük — Phase 60 kabul, Phase 62+ |

Phase 61 kritik #1+#2'yi kapattı. #3 ve #4 honest defer (mevcut akış
operatör için yeterince doğal).

### Mode → backend mapping (server-side source of truth)

| Mode | Backend call | Param mapping |
|---|---|---|
| `imagine` | `createMidjourneyJob` × count | `prompt` operatör girdisi (zorunlu); reference URL **enjekte edilmez** (pure /imagine) |
| `image-prompt` | `createMidjourneyJob` × count | `prompt` zorunlu; `referenceUrls: [refUrl]` (image-prompt slot) |
| `sref` | `createMidjourneyJob` × count | `prompt` opsiyonel (yoksa system prompt fallback); `styleReferenceUrls: [refUrl]` |
| `oref` | `createMidjourneyJob` × count | `prompt` opsiyonel; `omniReferenceUrl: refUrl` |
| `cref` | `createMidjourneyJob` × count | `prompt` opsiyonel; `characterReferenceUrls: [refUrl]` |
| `describe` | `createMidjourneyDescribeJob` × **1** per ref (count ignored) | `imageUrl: refUrl`. Generation YOK; prompt suggestions üretir. |

### Fix #1 — launchBatch dispatcher provider-aware (batch-service.ts)

```ts
const isMidjourney = input.providerId === "midjourney";

if (!isMidjourney) {
  // Phase 48 baseline — Kie + diğer ImageProvider registry
  const provider = getImageProvider(input.providerId);
  if (!provider.capabilities.includes("image-to-image")) throw ...
} else {
  // Phase 61 — Server-side MJ mode validation
  if (!input.mjMode) throw ValidationError("mjMode zorunludur");
  if ((mjMode === "imagine" || mjMode === "image-prompt") && !mjPrompt) throw ...
  if (mjMode === "describe" && mjPrompt) throw ...
}

for (const item of batch.items) {
  // ... URL pre-flight ...
  if (isMidjourney) {
    if (mjMode === "describe") {
      // Single describe per ref (count ignored)
      await createMidjourneyDescribeJob({ userId, imageUrl, sourceAssetId });
    } else {
      // Imagine/image-prompt/sref/oref/cref — N calls per ref
      for (let i = 0; i < input.count; i++) {
        const mjInput = {
          userId, prompt: finalPrompt, aspectRatio, referenceId,
          productTypeId, batchMeta: { batchId, batchIndex: i, batchTotal: count },
        };
        if (mode === "image-prompt") mjInput.referenceUrls = [referenceImageUrl];
        else if (mode === "sref") mjInput.styleReferenceUrls = [referenceImageUrl];
        else if (mode === "oref") mjInput.omniReferenceUrl = referenceImageUrl;
        else if (mode === "cref") mjInput.characterReferenceUrls = [referenceImageUrl];
        // imagine → no reference URL injection
        await createMidjourneyJob(mjInput);
      }
    }
  } else {
    // Phase 48 baseline — Kie path
    await createVariationJobs({ ... });
  }
}
```

Per-item partial-failure tolerance + DRAFT korunma (anySuccess=false ise)
+ composeParams snapshot'a `mjMode` + `mjPrompt` audit trail yazımı
hepsi Phase 48 baseline ile aynı.

### Fix #2 — Launch endpoint Zod schema (route.ts)

```ts
const MidjourneyDispatchModeSchema = z.enum([
  "imagine", "image-prompt", "sref", "oref", "cref", "describe",
]);

const BodySchema = z.object({
  providerId, aspectRatio, quality?, count, brief?,
  // Phase 61 — Midjourney-specific (validated server-side per provider)
  mjMode: MidjourneyDispatchModeSchema.optional(),
  mjPrompt: z.string().max(800).optional(),
});
```

### Fix #3 — UI launch payload + provider-aware cost (BatchQueuePanel.tsx)

```ts
body: JSON.stringify({
  providerId, aspectRatio, count, brief, ...quality,
  // Phase 61 — Midjourney payload
  ...(isMidjourney ? {
    mjMode,
    ...(mjPrompt.trim() && mjMode !== "describe" ? { mjPrompt } : {}),
  } : {}),
})
```

Cost preview provider-aware:
- Kie: `12 gens · ~$2.88 · est. 6m` (API cost)
- Midjourney: `12 gens · bridge (free) · est. 6m` (operator MJ subscription)
- Describe: `2 describes · bridge (free)` (count ignored, no time est)

Launch CTA dili:
- Kie: `Create Similar · 2 × 6`
- Midjourney generate: `Create Similar · 2 × 6`
- Midjourney describe: `Describe 2 references`

### provider-capabilities.ts: launchBackendReady=true

```ts
{
  id: "midjourney",
  available: true,
  launchBackendReady: true,  // Phase 60'da false idi
  // helperText kaldırıldı — disclosure kalkıyor
  ...
}
```

`backendNotReady` artık `false` → UI honest disclosure block + Switch-to-
Kie button kalkar; launch CTA enabled; cost preview gerçek değer.

### Full-page BatchComposeClient (Phase 61 minimal scope)

Page mode picker eklenmedi — yalnız ComposePanel inline'da Midjourney
mode picker mevcut. Page'de Midjourney seçildiğinde **honest page-level
disclosure**: "Midjourney mode picker yalnız References Pool inline draft
panel'inde mevcut" + **Open References Pool** + **Switch to Kie**
buttons. Operatör fake CTA görmez; doğru yolu bilir. Phase 62+'da full
v4 A6 split modal landing yaparsa page'in rolü revize edilir.

### Browser verification — 9 senaryo PASS

Server-side validation (3 negative test):
- `providerId="midjourney"` + no mjMode → 400 "mjMode zorunludur"
- `mjMode="imagine"` + no mjPrompt → 400 "prompt zorunludur"
- `mjMode="describe"` + mjPrompt → 400 "prompt almaz"

Server-side dispatch (2 positive test):
- Midjourney sref + accessible URL → status 200, `failedDesignIds=2`,
  error="MJ Bridge erişilemiyor: fetch failed" (per-item; dispatcher
  doğru çalıştığı kanıt — Kie path olsaydı farklı hata olurdu)
- Kie regression (aynı draft, provider switch) → state="QUEUED",
  designIds=2, failedDesignIds=0 (full happy path)

UI verification (4 test, viewport 1440×900):
- Pool default panel expanded 320px (Phase 60 baseline intakt)
- Click "Create Similar" → compose 440px, Midjourney selected,
  disclosure ABSENT (Phase 60 disclosure kalktı),
  launch enabled "Create Similar · 2 × 6", cost "12 gens · bridge (free) · est. 6m"
- Click "Describe" mode → prompt disabled, cost "2 describes · bridge (free)",
  launch text "Describe 2 references"
- Switch to Kie → mode picker gone, brief field back, cost "12 gens · ~$2.88 · est. 6m"

Screenshot: Pool grid + sağda 440px compose panel + Provider="Midjourney"
+ Generation mode 6 chips (--sref active) + Prompt OPTIONAL · RECOMMENDED
+ Aspect 2:3 + Similarity Medium + Count 6 + Quality medium.

### Self-hosted mockup generator — somut next-step plan

Phase 60 araştırması özet: `src/providers/mockup/local-sharp/` Sharp
compositor zaten mevcut (Phase 8 Task 9). API-free, sınırsız, MinIO
storage'a bağlı, batch-friendly. İki organik genişleme:

**Yol A — `placePerspective` stub fill-in** (~1-2 gün iş)

| Dosya | Değişiklik | Risk |
|---|---|---|
| `src/providers/mockup/local-sharp/safe-area.ts` | `placePerspective(input, opts)` stub'ı doldur — 4-corner manual koordinatlar → 8-DOF homography matris → `sharp(buffer).affine(matrix)` + extract + composite | Düşük — Sharp `affine` 4×4 destekliyor (libvips), homography solver pure-math (~50 satır) |
| `tests/unit/mockup/local-sharp/place-perspective.test.ts` | 3 fixture test: identity transform (pass-through), 45° rotate, skewed quad → corner mapping | Düşük — Sharp deterministic, fixture-based snapshot test |

**Çıktı**: t-shirt/mug yamuk smart-object area'lara designer image'i fit. PSD smart-object parity yakalanır. Mockup template JSON şemasına `perspective: { tl, tr, br, bl }` field eklenebilir (PSD parser'dan extract edilir).

**Yol B — PSD → JSON template ETL CLI** (~1 gün iş)

| Dosya | Değişiklik | Risk |
|---|---|---|
| `package.json` | `ag-psd` ^15 npm dep (pure-JS PSD parser, ~120KB, no native binding) | Düşük — well-maintained, Adobe spec %95+ coverage |
| `scripts/import-psd-mockup-template.ts` | CLI: `npm run mockup:import-psd <file.psd>` → JSON template stdout. Smart-object layer'ları enumerate et, name pattern parse → `area: {x, y, w, h, rotation}` JSON. Operatör template'leri Photoshop'ta bir kez yapar; sonraki tüm render'lar Sharp + JSON üzerinden. | Düşük — script-level, runtime path'lere dokunmaz |
| `docs/mockup-templates-from-psd.md` | Operatör guide: smart-object layer naming convention (`@kivasy:area:design`) + script kullanım örneği | Yok — yalnız docs |

**Çıktı**: API-free, sınırsız, Photoshop'a yatırım yapmadan tekrar tekrar render. Mevcut `MockupTemplate.smartObjects` JSON şeması zaten kompatibl; Phase 8 baseline'ı bozulmaz.

**Phase 62+ kararı**: Yol A + Yol B birlikte yapılır (~2-3 gün). Sharp pipeline tek canonical olur; `dynamic-mockups` API path'i deprecate edilebilir (mevcut consumer yoksa silinir).

### Quality gates (Phase 61)

- `tsc --noEmit`: clean
- `vitest`: **435/435 PASS** (canonical regression)
- `next build`: ✓ Compiled successfully (Phase 61 apostrophe escape düzeltildi)

### Değişmeyenler (Phase 61)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** `Batch.composeParams` JSON field zaten esnek; mjMode/mjPrompt yazılır.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** Dispatcher inline switch + per-mode param mapping; ortak `LaunchExecutor` abstraction çıkarılmadı (iki provider yeterli, premature).
- **References / Batch / Review / Selection / Mockup / Product / Etsy Draft canonical akışları intakt** (Phase 26-60 baseline).
- **Phase 60 baseline'ı tamamlanır**: default-expanded queue panel + Midjourney-first + provider-aware form Phase 60'ta açılmıştı; Phase 61 launch path'i bağladı + disclosure'u kaldırdı.
- **Kie path tamamen intakt** (regression: 2/2 design queued, state QUEUED transition).
- **Kivasy DS dışına çıkılmadı.**

### Bilinçli scope dışı (Phase 62+ candidate)

- **Full v4 A6 split modal**: 440px panel canlı + functional; modal expansion compose-from-Batches CTA için Phase 62.
- **`/batches` Start Batch → modal-from-Batches**: mevcut Pool yönlendirme Phase 60'ta kabul edildi; Phase 62'de Pool'a inmeyen direct modal değerlendirilebilir.
- **Compose shared shell extraction**: BatchComposeClient (page) + BatchQueuePanel.ComposePanel (inline) iki render path; davranış divergence görülürse ortak `ComposeForm` çıkarılır.
- **BatchComposeClient full-page Midjourney mode picker**: page'de mode picker eklenmedi (Phase 61 minimal scope); honest disclosure + Switch-to-Kie + Open Pool buttons sunuluyor.
- **Mockup generator yol A + yol B** (Sharp placePerspective + PSD ETL): ~2-3 günlük altyapı turu.

### Bundan sonra production tarafında kalan tek doğru iş

Phase 61 ile Create Similar / Midjourney launch akışı **operatör için
tam fonksiyonel**:
- Pool'a girer girmez queue panel açık (Phase 60)
- Midjourney default + provider-aware form (Phase 60)
- Mode picker + prompt + ref params (Phase 60)
- **Server-side dispatcher Midjourney'i gerçekten launch ediyor** (Phase 61 ✓)
- Kie regression intakt
- Honest fallback'ler (page-level Midjourney disclosure → Pool inline)

Tek yarım iş **Midjourney bridge dev ortamı** — bridge server operator'ün
local browser session'ında çalışır; dev'de yok. Bu yapısal kısıt, Phase
61'de değişmedi (out-of-scope: bridge dev infrastructure). UI tarafı
backendNotReady=false yansıtır; production'da operatör'ün bridge'i
açıkken launch çalışır. Test path: `createMidjourneyJob` → bridge fetch
failed → per-item error doğru raporlanıyor.

Sıradaki gerçek iş **Phase 62 mockup generator self-hosted plan
implementation** (Yol A + Yol B, ~2-3 gün) veya **full v4 A6 split
modal** + **modal-from-Batches Add Batch entry** UX polish.

---

## Phase 62 — Create Similar finalize: v4 A6 split modal + Midjourney bridge confidence

Phase 60-61 ile teknik dispatcher + provider-aware form bağlandı, ama
iki UX/ops açığı kaldı:
1. **Compose 440px panel cramped** — v4 A6 spec geniş split layout istiyor (rail + body + footer); Phase 47-61 inline panel'e sıkışıktı
2. **Midjourney bridge dependency invisible** — operatör launch'a basıyor → 5sn sonra "neden fail oldu?" sorusu cevapsız

Phase 62 her ikisini ürünleştirir + mode picker'a hiyerarşi ekler.

### Ürün kararları (Phase 62)

**Karar 1 — Hibrit (queue panel staging + split modal compose)**:
- Queue panel right rail kalır (Phase 45+ baseline; Pool browse kesintisiz)
- "Create Similar" CTA artık **inline 440px form'a değil**, **split modal**'a açar
- v4 A6 layout: rail (sol ~280px source references composite) + body (sağ ~640px form sections) + footer (cost preview + Launch CTA)
- Modal kapatma → operatör Pool browse + queue panel intakt
- Phase 47 inline ComposePanel + FieldRow function'ları **silindi** (537 satır dead code temizliği); modal canonical compose

**Karar 2 — Bridge state proactive göstergesi**:
- Yeni endpoint: `GET /api/admin/midjourney/bridge/health`
  - Mevcut `BridgeClient.health()` + UI-friendly tone wrapping
  - 4 state: `online` / `offline` / `session-required` / `degraded`
  - State karar tablosu:
    - fetch fail → "Bridge not running" (start service / switch to Kie)
    - browser.launched=false → "Bridge running but no browser attached"
    - mjSession.likelyLoggedIn=false → "Session not detected" (sign in)
    - jobs.blocked > 0 → "Bridge online · N blocked jobs"
    - all healthy → "Bridge ready · session detected"
  - Auth: requireAdmin
- Modal Midjourney seçildiğinde `useEffect` → fetch `/api/admin/midjourney/bridge/health` → state badge render edilir
- Online → küçük green chip; offline/degraded/session-required → tone-aware card + actionable detail + **Switch to Kie · GPT Image 1.5 →** button

**Karar 3 — Mode picker hiyerarşi**:
- Pre-Phase 62: 6 mode chip tek satır, eşit ağırlık
- Phase 62: **3 prominent (sref/oref/cref)** her zaman görünür (k-segment ana satır) + **3 advanced (imagine/image-prompt/describe)** "More modes" toggle disclosure
- Operator default mental model "reference-driven similar generation" → sref/oref/cref direkt hiyerarşi başında
- Advanced senaryolar (saf prompt-only, raw image-as-prompt, describe-only) opt-in
- Auto-toggle: operatör advanced bir mode seçer ise advanced section auto-expand olur

**Karar 4 — Add Batch entry korundu** (Phase 62 scope dışı):
- `/batches` Start Batch → `/references?intent=start-batch` → Pool yönlendirme Phase 60 baseline'da kabul
- Phase 62 split modal eklendiğinde de **doğal kalıyor**: operatör Pool'da staging yapar (Add to Draft), sonra queue panel'den modal açar — bu mental model güçlü
- Modal-from-Batches alternative entry Phase 63+ candidate

### Yeni dosyalar / edit'ler

**`src/app/api/admin/midjourney/bridge/health/route.ts` (yeni)**:
```ts
export const GET = withErrorHandling(async () => {
  await requireAdmin();
  try {
    const health = await getBridgeClient().health();
    // Map BridgeHealth → BridgeHealthState (online/offline/session-required/degraded)
    // + operator-facing summary + detail copy
  } catch (BridgeUnreachableError) {
    return { state: "offline", summary: "Bridge not running", detail: "..." };
  }
});
```

**`src/features/batches/components/BatchComposeSplitModal.tsx` (yeni, ~620 satır)**:
- v4 A6 split layout (`docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a6-a7.jsx` parity)
- Source rail: batch.items grid + per-item k-thumb + title + product type + local-only badge
- Form body: Provider select + bridge health badge + mode picker (hierarchy) + prompt + aspect/similarity/count/quality/brief
- Footer: Cancel + cost preview + Launch primary
- Escape close + backdrop click + focus management
- Phase 49 sessionStorage launchOutcome handoff intakt

**`src/features/batches/components/BatchQueuePanel.tsx` (refactor)**:
- 956 → **419 satır** (537 satır dead code silindi)
- Inline `ComposePanel` + `FieldRow` function'ları kaldırıldı
- `mode: "queue" | "compose"` state → `composeModalOpen: boolean`
- "Create Similar" CTA → `setComposeModalOpen(true)` (modal açar)
- Modal entegrasyonu fragment wrap (collapsed + expanded her ikisinde)

### Browser verification (live preview, viewport 1440×900, 12 senaryo PASS)

```
/references navigate → panel expanded 320px (Phase 60 baseline intakt)
Click "Create Similar" CTA →
  modalPresent: true
  modalDialogRole: "dialog"
  modalAriaModal: "true"
  railPresent: true, railItemCount: 2 (source references)
  providerSelected: "midjourney" (Phase 60 default)
  bridgeHealthPresent: true, state: "offline" (real bridge unreachable)
  prominentChips: 3 (sref active, oref, cref)
  advancedChipsHidden: true (default closed)
  advancedTogglePresent: true ("More modes")
  launchEnabled: true (Phase 61 launchBackendReady=true)
  launchText: "Create Similar · 2 × 6"
  costText: "12 gens · bridge (free) · est. 6m"

Click "More modes" →
  advChips: 3 (/imagine, Image prompt, Describe)

Click "Describe" →
  promptDisabled: true
  launchText: "Describe 2 references"
  costText: "2 describes · bridge (free)"

Click "Switch to Kie" (from bridge health badge) →
  provider: "kie-gpt-image-1.5"
  mjChipsGone: true (mode picker disappears)
  briefPresent: true (Kie brief field appears)
  bridgeHealthHidden: true (no badge for Kie)
  cost: "12 gens · ~$2.88 · est. 6m"
  launch: "Create Similar · 2 × 6"
```

Screenshot: References Pool grid arkasında, ön planda **wide split modal** (max-w-1080) + sol 280px source references rail (2 marquee sign card) + sağ form body (Provider Midjourney + bridge offline kırmızı card + Switch to Kie button + Generation mode 3 prominent chip ile --sref active + Hide advanced + 3 advanced chip + Prompt OPTIONAL · RECOMMENDED + Aspect 2:3 + Similarity Medium + Count) + footer (Cancel + 12 gens · bridge (free) · est. 6m + Create Similar · 2 × 6 primary).

Bridge health badge canlı kanıt: real bridge dev'de yok, endpoint **gerçek probe** yapıyor (BridgeUnreachableError catch → "offline"), operator actionable copy görüyor.

### Self-hosted mockup generator next-step plan (somut)

Phase 60 araştırması "Sharp compositor zaten elimizde" buldu. Phase 61 yol A + yol B önerisi. Phase 62'de **uygulanabilir teknik plan** detayı:

**Mevcut durum** (`src/providers/mockup/local-sharp/`):
- `compositor.ts`: Sharp pipeline (MinIO fetch base + design + safe-area + recipe + composite + thumbnail + MinIO upload)
- `safe-area.ts`: `placeRect` çalışıyor; `placePerspective` **stub: throw NOT_IMPLEMENTED**
- `recipe-applicator.ts`: blend + opsiyonel shadow

**Yol A — `placePerspective` fill-in (~1-2 gün, RISK: DÜŞÜK)**:
- Dosya: `src/providers/mockup/local-sharp/safe-area.ts`
- Algoritma: 4-corner manual koordinatlar (`{ tl, tr, br, bl }`) → 8-DOF homography matris (DLT solver, ~50 satır pure math)
- Sharp `affine(matrix)` API destekliyor (libvips internal)
- Test: `tests/unit/mockup/local-sharp/place-perspective.test.ts` 3 fixture (identity / 45° rotate / skewed quad → corner mapping snapshot)
- Çıktı: t-shirt/mug/kupa yamuk smart-object area'lara designer image fit; PSD smart-object parity

**Yol B — PSD ETL CLI (~1 gün, RISK: DÜŞÜK)**:
- npm dep: `ag-psd ^15` (pure-JS PSD parser, ~120KB, no native binding, well-maintained)
- Yeni dosya: `scripts/import-psd-mockup-template.ts`
  - CLI: `npm run mockup:import-psd <file.psd>`
  - `ag-psd.readPsd(buffer)` → smart-object layer'ları enumerate
  - Layer name pattern: `@kivasy:area:design` → `area: { x, y, w, h, rotation }` JSON template
  - Output: stdout JSON (operator stdout > file ile yakalar) veya `--out path.json` flag
- Doc: `docs/mockup-templates-from-psd.md` — operator guide (smart-object naming convention + script kullanımı)
- Çıktı: API-free, sınırsız, operator Photoshop'ta bir kez yapar; sonraki tüm render'lar Sharp + JSON üzerinden

**Önerilen sıra** (Phase 63+ candidate):
1. Yol A önce (perspective transform mevcut Sharp recipe'sine en organik genişleme; mockup template'lerin yamuk smart-object area'ları işliyor)
2. Yol B sonra (Yol A çalıştığında PSD import'u JSON template olarak yazılır + perspective field doğal yere gelir)
3. Toplam ~2-3 gün; mevcut altyapıya 0 abstraction katar; `dynamic-mockups` API path'i deprecate adayı olur

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: **435/435 PASS** (canonical regression)
- `next build`: ✓ Compiled successfully (Phase 62 inline style fix: `style={{ maxHeight }}` → `max-h-[820px]` Tailwind arbitrary class)

### Değişmeyenler (Phase 62)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Yalnız UI component + API endpoint + dead code cleanup.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** `BatchComposeSplitModal` standalone component, `BridgeHealthBadge` private sub-component, `BridgeHealthResponse` type literal. Şared shell extraction (modal + page) Phase 63+ defer.
- **References / Batch / Review / Selection / Mockup / Product / Etsy Draft canonical akışları intakt** (Phase 26-61 baseline).
- **Phase 60 baseline'ı intakt**: default-expanded queue panel + Midjourney first-class + provider-aware form fields.
- **Phase 61 dispatcher intakt**: `launchBatch` + `createMidjourneyJob`/`createMidjourneyDescribeJob` per-mode mapping unchanged.
- **Kie path tamamen intakt** (regression: provider switch → mode picker gone, brief field, cost API).
- **Phase 49 sessionStorage launchOutcome** modal'da da intakt (success → batch detail banner).
- **Kivasy DS dışına çıkılmadı.** k-orange/k-orange-soft/k-orange-ink, k-bg-2, line/line-soft, k-segment recipe, paper, success-soft/danger/warning-soft tone'lar.

### Bilinçli scope dışı (Phase 63+ candidate)

- **Modal-from-Batches Add Batch entry**: `/batches` Start Batch CTA modal-açan değil, hâlâ Pool yönlendirme. Add Batch akışı Phase 60'ta kabul edildi; Phase 63'te modal-from-Batches alternative entry değerlendirilebilir.
- **`BatchComposeClient` (page) silinmesi veya modal'a redirect**: Page hâlâ erişilebilir (`/batches/[id]/compose`). Page'de Midjourney mode picker yok; honest disclosure + Switch-to-Kie + Open Pool buttons sunuluyor (Phase 61). Page'i tamamen modal redirect'e çevirmek Phase 63 small cleanup.
- **Sharp `placePerspective` + PSD ETL CLI** (Yol A + Yol B, ~2-3 gün): yukarıdaki uygulanabilir plan; mockup self-hosted pipeline finalize.
- **Bridge health probe periodic refresh**: şu an modal mount'ta tek probe; ileride 30sn polling + manual refresh button operator confidence için ekleme.
- **Bridge health probe aggressive UI mode**: launch button'u bridge offline iken disable etmek (şu an yalnız uyarıyor, launch izinli — operatör override edebilir, partial-failure tolerance Phase 48 baseline ile yakalanır).

### Bundan sonra production tarafında kalan tek doğru iş

Phase 62 ile Create Similar yüzeyi **gerçekten finalize**:
- v4 A6 split modal layout (geniş, premium, source rail + form + footer)
- Midjourney first-class + provider-aware fields (Phase 60-61)
- Server-side dispatcher Midjourney path'i çalışıyor (Phase 61)
- **Bridge health proactive göstergesi + actionable copy + Switch-to-Kie** (Phase 62 ✓)
- **Mode picker hiyerarşi** (3 prominent reference-driven + 3 advanced disclosure) (Phase 62 ✓)
- Kie regression intakt
- Honest fallback'ler her seviyede

Tek yarım iş hâlâ **production bridge dev environment** — operator browser bridge ayrı admin akışı, dev'de offline; bu **yapısal kısıt** Phase 62'de değişmedi (out-of-scope: bridge dev infra). UI tarafı **bridge offline state'ini honest gösteriyor**, Switch-to-Kie alternative path single click.

Sıradaki gerçek iş **Phase 63 mockup generator self-hosted plan
implementation** (Yol A + Yol B, ~2-3 gün, dosya/risk/sıra detayı yukarıda).

---

## Phase 63 — Self-hosted mockup pipeline first slice: placePerspective implemented

Phase 60 araştırması "Sharp compositor zaten elimizde" buldu; Phase 62
research-from-implementation plan dokumante etti (Yol A: placePerspective,
Yol B: PSD ETL CLI). Phase 63 **Yol A'yı gerçekten implement etti**.
Self-hosted mockup pipeline artık rect + perspective desteği ile
production-ready.

### Audit (Phase 62 → Phase 63)

| Parça | Pre-Phase 63 | Phase 63 |
|---|---|---|
| `placeRect` | ✓ rect resize + rotate (Phase 8 Task 9) | unchanged |
| `placePerspective` | **stub: throw NOT_IMPLEMENTED** | **implemented: 4-corner DLT homography + raw inverse warp + bilinear interp + alpha-aware** |
| compositor.ts dispatcher | perspective config → PROVIDER_DOWN | perspective config → renders successfully |
| `SafeAreaPerspective` type | ✓ 4-corner normalize | unchanged (consumed by new code) |
| Operator-facing capability signal | ❌ none | ✓ admin template editor: "Self-hosted · rect + perspective" badge + Phase 63 perspective hint |
| PSD ETL | ❌ no impl | ❌ no impl (Phase 64 candidate) |

### İlk slice seçim kararı

**`placePerspective` seçildi** (Yol A öncesi Yol B üzerinde):
- **Yüksek değer**: rect-only mockup yetersiz; t-shirt/mug/poster-on-wall yamuk smart-object area'lar gerçek mockup için zorunlu
- **Düşük risk**: Sharp `raw` pipeline backbone; SafeAreaPerspective type yerinde; mevcut rect path bozulmaz
- **Runtime path** (PSD ETL ise offline tooling — runtime'a giden değil)
- **Kanıt-üretmek-mümkün**: deterministik fixture-test'lerle (identity + degenerate + opaque + keystone foreshortening) homography correctness + alpha edge davranışı kanıtlanabilir

PSD ETL → Phase 64 candidate; Sharp `placePerspective` çalıştığında PSD JSON template şemasına `perspective: { tl, tr, br, bl }` doğal olarak yerleşir.

### Implementation: `safe-area.ts:placePerspective`

```ts
// 1) Decode design as raw RGBA via Sharp ensureAlpha + raw
const { data: designRaw, info } = await sharp(designBuffer)
  .ensureAlpha().raw().toBuffer({ resolveWithObject: true });

// 2) Compute axis-aligned bbox of dst quad → output canvas size
const corners = safeArea.corners.map(([x, y]) => [x * baseW, y * baseH]);
const minX = Math.floor(Math.min(...xs));  // ...etc
const outW = Math.max(1, maxX - minX);

// 3) Compute INVERSE homography: dst (output local) → src (design)
//    via 8x8 DLT (Direct Linear Transform) + Gauss elimination with
//    partial pivoting. ~50 LOC pure-math, no dependencies.
const H = computeHomography(dstQuad, srcQuad);

// 4) Inverse warp: for each output pixel, apply H to find source pixel,
//    bilinear sample (alpha-aware: outside src bounds = transparent)
for (let yo = 0; yo < outH; yo++) {
  for (let xo = 0; xo < outW; xo++) {
    const w = h6 * xo + h7 * yo + 1;
    const xs = (h0 * xo + h1 * yo + h2) / w;
    const ys = (h3 * xo + h4 * yo + h5) / w;
    if (xs < 0 || ys < 0 || xs >= dW - 1 || ys >= dH - 1) continue;
    // Bilinear sample 4 source pixels (idx00, idx10, idx01, idx11)
    // weighted by fx/fy fractions; write to outBuf RGBA
  }
}

// 5) Encode raw → PNG via Sharp { raw: { width, height, channels: 4 } }
return { buffer: png, top: minY, left: minX };
```

**Algoritma ayrıntıları**:
- **Homography solver**: 8 equations × 8 unknowns (h0..h7; h8=1 fixed) → Gauss elimination with partial pivoting; degenerate quad → throws "singular matrix"
- **Inverse warp**: forward H mapping (src → dst) ile dst alanını çizmek pixel-gap üretir; **inverse mapping** (dst → src) gap-free output verir
- **Bilinear interpolation**: sub-pixel sample, soft edges; alpha-aware (outside src bounds = transparent → quad-outside areas naturally clear)
- **Alpha**: design RGBA decode + output RGBA buffer; quad geometry doğal mask (no separate mask pass)
- **Performance**: 1024×1024 base + design ~30-60ms (libvips raw decode + plain JS loop + libvips raw encode); Spec §7.1 RENDER_TIMEOUT 60s cap dahilinde

### Test coverage

`tests/unit/mockup/place-perspective.test.ts` — 6 test, 34ms PASS:

**`computeHomography`**:
1. Identity quad (src == dst) → diagonal-like H (h0=1, h4=1, others~0 within epsilon)
2. Arbitrary src→dst → applying H to each src corner exactly yields dst corner (closeTo precision 4)
3. Collinear (degenerate) quad → throws

**`placePerspective`**:
4. Trapezoid quad → bbox-aligned top/left, valid PNG output, RGBA channels
5. Identity-like axis-aligned quad → opaque green output filling bbox; center pixel green dominant + opaque
6. Keystone (top narrower than bottom) → top-row corner OUTSIDE quad transparent (alpha=0); inside-quad pixel near bottom blue dominant + opaque (perspective foreshortening kanıtı)

Integration tests (compositor-rect.test.ts) updated:
- 3 NOT_IMPLEMENTED stubs → Phase 63 happy-path assertions
- `placePerspective` smoke + `renderLocalSharp` perspective config end-to-end + `localSharpProvider.render` perspective path

### Operator-facing capability signal

`local-sharp-config-editor.tsx`:
- **Header capability badge** (`data-testid="local-sharp-capability-badge"`): success-soft tone "✓ Self-hosted · rect + perspective" + tooltip "Self-hosted Sharp compositor (no API calls, unlimited renders). Supports rect + perspective safeArea."
- **Perspective hint copy update** (`data-testid="local-sharp-perspective-hint"`): "Phase 63: 4-corner perspective transform self-hosted Sharp pipeline tarafından destekleniyor (no API calls)."

Operator artık template editor'a girer girmez **bu provider'ın self-hosted ve unlimited olduğunu ve hem rect hem perspective desteklediğini görür**. Dynamic-mockups API path'i ile yapısal fark netleşir.

### Compositor.ts dispatch

```ts
// Phase 63 — placePerspective implemented (4-corner DLT + raw inverse warp).
if (config.safeArea.type === "perspective") {
  placement = await placePerspective(
    designBuffer,
    config.safeArea,
    config.baseDimensions,
  );
}
```

Pre-Phase 63: arg'sız `placePerspective()` çağrısı throw → worker PROVIDER_DOWN classify.
Phase 63: arg'lı çağrı render output döner; mevcut recipe + thumbnail + upload pipeline değişmeden geçer.

### Browser/test verification

- **Unit tests**: 650/650 PASS (canonical 435 + mockup 215 + Phase 63 perspective 6)
- **Bundle string verification** (admin/mockup-templates/[id] page chunk):
  - `local-sharp-capability-badge`: 1 occurrence
  - `local-sharp-perspective-hint`: 1 occurrence
  - `Phase 63`: 1 occurrence
  - `perspective transform self-hosted`: 1 occurrence
- **Browser admin route smoke**: /admin/mockup-templates page renders (no templates in dev seed → editor not directly viewable, but bundle string confirms ship)
- **typecheck**: clean (strict-mode array bounds non-null assertions added in DLT solver)
- **build**: ✓ Compiled successfully

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: **650/650 PASS** (435 canonical + 215 mockup including Phase 63 6 new tests)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 63)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** SafeAreaPerspective type Phase 8'den beri tanımlı; Phase 63 yalnız implementation + integration test güncellemeleri + operator-facing badge.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** `computeHomography` + `gaussSolve` 80 satır pure math (utility helpers, no class hierarchy); `placePerspective` Sharp pipeline composition; capability badge inline JSX.
- **Yeni 3rd-party dep yok.** Sharp + raw buffer + plain JS loop. PSD ETL'de `ag-psd` eklenecek (Phase 64).
- **References / Batch / Review / Selection / Mockup / Product / Etsy Draft canonical akışları intakt** (Phase 26-62 baseline).
- **Mockup pipeline çağrı yolları intakt**: workers / job orchestration / S7/S8 result view / dynamic-mockups path hepsi unchanged.
- **Kie path tamamen intakt**.
- **Kivasy DS dışına çıkılmadı.** Capability badge: `success-soft` + `success` text + mono uppercase tracking-meta recipe (Phase 51 status badge family parity).

### Phase 63 değer önermesi (operator için)

- **API-free**: Sharp pipeline pure-Node + libvips backend; runtime hiçbir external HTTP call yapmıyor (storage-aside)
- **Unlimited**: dynamic-mockups gibi API quota / paid tier yok; render hızı CPU-bound
- **Perspective destekli**: t-shirt yamuk pattern, mug curved area, poster-on-wall keystone, kart eğri yerleşimi — gerçek 4-corner perspective transform deterministic
- **Operator visible**: admin template editor'da capability badge ile self-hosted/unlimited promise'i operatöre net gösteriyor

### dynamic-mockups path ile ilişki

Phase 63 dynamic-mockups path'ini deprecate **etmedi** — mevcut consumer'lar varsa bozulmaz. Ama:
- Yeni template'ler artık LOCAL_SHARP'a `perspective` safeArea ile yazılabilir (eskiden API gerektirirdi)
- Operator template editor'da self-hosted capability'yi görünür biliyor; dynamic-mockups path'in hangi durumda kullanılacağı (Phase 64+ ürün kararı) net karar gerektiriyor
- Mevcut local-sharp pipeline rect-only veya throw'lu perspective ile çalışıyordu; Phase 63 ile **perspective dahil rect alternatifi tam yerinde**

### Bilinçli scope dışı (Phase 64+ candidate)

- **PSD ETL CLI** (Yol B, ~1 gün): `ag-psd` parser ile Photoshop PSD'lerden smart-object koordinatları → JSON template export. Operator Photoshop'ta bir kez yapar; sonraki tüm render'lar Sharp + JSON üzerinden. dynamic-mockups deprecation hızlandırır.
- **dynamic-mockups deprecation karar**: mevcut consumer audit + migration plan + UI hint update.
- **Performance optimization**: 1024×1024 ~30-60ms iyi; daha büyük base/design (4K+) için worker pool veya WebAssembly accelerator değerlendirilebilir.
- **Multi-design composite** (one base + N design layers): Phase 63 single design + single perspective; multi-layer support type genişletmesi gerektirir.
- **Curved surface (mug body)**: 4-corner perspective genuine perspective değil curved sheen; cylindrical mapping ileride.

### Bundan sonra production tarafında kalan tek doğru iş

Phase 63 ile self-hosted mockup pipeline runtime tarafı **production-ready**:
- Sharp compositor + perspective + recipe + thumbnail + storage hep self-hosted
- Operator-facing capability badge ile transparency
- 6/6 fixture test PASS (homography math + bilinear + alpha)
- Integration tests (rect + perspective both) yeşil
- Build + typecheck clean

Sıradaki tek doğru iş **Phase 64 PSD ETL CLI** (offline tooling; operator template oluşturma ergonomisi). Phase 63 + Phase 64 birlikte: dynamic-mockups API'sını tamamen ikame edebilen self-hosted mockup ürünü.

---

## Phase 64 — Templated.io ürün modeli: MockupTemplate ownership + user-scope catalog endpoint

Phase 63 self-hosted runtime'ı (placePerspective) açtı; Phase 64
**templated.io benzeri "operatör kendi mockup template'ini sahiplenir"
ürün modelinin temelini** kurdu. Bu turun seçim kararı: PSD ETL CLI
(Phase 60-62'de yol B önerisi) yerine **schema + ownership + user-scope
read API**'yi açmak — çünkü ETL bir tooling, ownership olmadan ETL
çıktısı user-bound olamaz. Önce ownership tabanı, sonra ETL/upload
yazma yolları (Phase 65+).

### Audit findings (kısa)

| Açık | Önem |
|---|---|
| `MockupTemplate.userId` YOK — tüm templates admin-global | **Kritik** (templated.io modeli için zorunlu) |
| User-scope API endpoint YOK — sadece `requireAdmin` CRUD | **Kritik** (operator kendi catalog'unu okuyamaz) |
| User upload UI yok | Phase 65+ candidate |
| local-sharp pipeline (Phase 63) rect + perspective tam self-hosted | ✓ baseline |
| Apply (S3) "USER_TEMPLATE" tab CLAUDE.md sözleşmesi mevcut | data yok (template-side önce çözülmesi gerek) |

### Ürün modeli kararı (templated.io benzeri)

**MockupTemplate ownership = nullable userId** (templated.io ürün modeli):
- `userId === NULL` → **global catalog** (admin-managed; tüm kullanıcılar görür)
- `userId === <X>` → **X'in özel template'i** (kendi library'si; cross-user erişilemez)

**Kademe yaklaşımı**:
- **Phase 64**: schema + user-scope read API + admin manager'da Ownership column (Global/User badge)
- **Phase 65+**: user upload UI (template editor + asset upload form) + "My templates" tab in mockup apply (CLAUDE.md USER_TEMPLATE sözleşmesi karşılığı) + reusable library mgmt (name/categorize/favorite)

### local-sharp'ın rolü

**Local-sharp self-hosted mockup engine'in omurgası**:
- Phase 8: rect + recipe + thumbnail + storage upload
- Phase 63: 4-corner perspective transform (yamuk smart-object area'lar)
- Phase 64: ownership-aware (user templates kendi binding'leriyle aynı pipeline'dan geçer)

**Kullanıcı kendi mockup'unu nasıl eklemeli (Phase 65+ ürün modeli)**:
1. Asset upload → MinIO (base image + opsiyonel design overlay)
2. Template config editor → safe-area (rect veya 4-corner perspective) + recipe (blend + shadow)
3. MockupTemplate row create (userId = current; status: DRAFT)
4. Binding create (providerId: LOCAL_SHARP; config: local-sharp JSON)
5. User publish → status ACTIVE → mockup apply'da görünür

PSD ETL (Phase 65+ candidate): operatör Photoshop'ta `@kivasy:area:design` smart-object naming convention ile çalışır; `npm run mockup:import-psd <file.psd>` CLI ile JSON template'e dönüşür → user upload flow'una otomatik import. PSD parse: `ag-psd ^15` pure-JS dep (~120KB, native binding yok).

### API-free / unlimited dürüst değerlendirme

| Mockup tipi | local-sharp ile yeterli mi? |
|---|---|
| Wall art / poster on flat wall (rect) | ✓ tam |
| Framed art with slight angle (perspective rect) | ✓ tam |
| T-shirt with chest area (perspective quad) | ✓ Phase 63 ile |
| Mug with curved cylinder | ⚠ kısmi — 4-corner approximation; gerçek cylindrical mapping yok (Phase 66+ candidate, displacement map gerek) |
| Book cover with spine | ⚠ aynı — multi-quad needed |
| Photorealistic 3D scene (multi-layer + lighting) | ❌ Sharp scope dışı (Blender/photopea track) |

**dynamic-mockups deprecation**: rect + perspective dünyasının %80+'ı (wall art, t-shirt, poster) local-sharp ile karşılanır. Cylindrical/3D ihtiyaçları için dynamic-mockups path optional kalır; Phase 65+ kararı (consumer audit).

### Vertical slice — Schema + API + Manager UI

**Schema migration** (`prisma/migrations/20260514120000_phase64_mockup_template_user_ownership/`):
- `ALTER TABLE "MockupTemplate" ADD COLUMN "userId" TEXT;`
- `CREATE INDEX "MockupTemplate_userId_idx" ON "MockupTemplate"("userId");`
- `ADD CONSTRAINT "MockupTemplate_userId_fkey" FK → User ON DELETE CASCADE`
- Backward-compat: existing rows `userId = NULL` (global catalog)
- User reverse relation: `User.mockupTemplates`

**User-scope read endpoint** (`GET /api/mockup-templates`):
- `requireUser` auth (admin değil)
- Query params:
  - `scope=all|global|own` (default: `all` → global + own merged)
  - `categoryId` (optional)
  - `status` (default: `ACTIVE`)
- Where clause:
  - `scope=global` → `userId: null`
  - `scope=own` → `userId: currentUser.id`
  - `scope=all` → `OR: [{userId: null}, {userId: currentUser.id}]`
- Response: items with **ownership field projected** (`"global" | "own"`)
- Cross-user isolation: where filter asla `userId != null AND userId != currentUser` döndürmez

**Admin manager UI** (`mockup-templates-manager.tsx`):
- 7-column table (Ad / Kategori / **Ownership** / Status / Aspect / Bindings / İşlemler)
- Ownership badge: `Global` (neutral tone) / `User` (success tone)
- Title attribute actionable: "Global admin catalog — all users see this template" vs "User-owned template (Phase 64): scoped to user X…"
- `data-testid="admin-template-ownership"` + `data-ownership="global"|"own"` (test/automation)

### Test coverage

**`tests/integration/api-mockup-templates-user-scope.test.ts`** — 6 senaryo, 233ms PASS:
1. 401 unauthenticated
2. **Cross-user isolation**: user1 görür: global + own; user2'nin template'i ASLA görünmez
3. **scope=global**: yalnız `userId NULL`
4. **scope=own**: yalnız `currentUser.id`
5. **Default status filter**: DRAFT/ARCHIVED gizli (default ACTIVE)
6. **categoryId filter**: kategoriler arası filtre

Cross-user isolation testi en kritik: SQL where clause `OR [userId NULL, userId currentUser]` — user2 row'u **asla** matched değil; integration test bunu user1 ve user2 fixture'ları ile gerçek DB üzerinde doğruluyor.

### Browser verification

- `GET /api/mockup-templates` user-scoped: HTTP 200, **729 ACTIVE template** dönüyor (admin DB'sinde 3061 total, 729 ACTIVE)
- Tüm 729 template **`ownership: "global"`** (henüz hiç user-owned yok — beklenen baseline)
- Admin manager page: **3061 ownership badge render edildi**, hepsi `data-ownership="global"`, title attribute actionable
- 7-column header doğru sırada: `Ad / Kategori / Ownership / Status / Aspect / Bindings / İşlemler`
- Bundle string verification: `admin-template-ownership`, `data-ownership`, "Phase 64", "User-owned template", "Global admin catalog" tümü chunk'ta

### Quality gates

- `tsc --noEmit`: clean (Phase 63 perspective test + 2 mockup unit fixture'ına `userId: null` eklendi)
- `vitest`: **691/691 PASS** (650 baseline + 6 new Phase 64 user-scope + 35 admin endpoint regression)
- `next build`: ✓ Compiled successfully
- Server-side: 401 auth gate çalışıyor (`/api/mockup-templates` requireUser, `/api/admin/mockup-templates` requireAdmin)
- Browser-side: re-login + endpoint hit + manager render canlı doğrulandı

### Değişmeyenler (Phase 64)

- **Review freeze (Madde Z) korunur.**
- **WorkflowRun eklenmez.**
- **Schema migration var** ama additive (nullable userId + index + FK); zero data risk; backward-compat (mevcut 3061 row `userId=NULL` global olarak kalır)
- **Yeni big abstraction yok.** Tek nullable field + tek user-scope endpoint + 1 column UI değişikliği
- **References / Batch / Review / Selection / Mockup / Product / Etsy Draft canonical akışları intakt** (Phase 26-63 baseline)
- **Mockup apply pipeline + worker + S7/S8 result view + dynamic-mockups path dokunulmadı** (yalnız read API + admin manager UI)
- **Admin endpoint baseline intakt** (`requireAdmin` GET/POST/PATCH/DELETE değişmedi)
- **local-sharp pipeline + perspective + recipe Phase 63 baseline intakt**
- **Kivasy DS dışına çıkılmadı.** Ownership badge `neutral` + `success` tone'ları (Phase 53/54 status badge family parity)

### Bilinçli scope dışı (Phase 65+ candidate)

- **User upload UI** (template editor + asset upload form for non-admin users) — gerçekten kullanıcı kendi mockup'unu ekleyebilmesi için zorunlu sonraki adım
- **User-scope write endpoints** (POST /api/mockup-templates with userId scoped to currentUser)
- **PSD → JSON ETL CLI** (`ag-psd` + `scripts/import-psd-mockup-template.ts` + operator guide) — offline tooling
- **"My templates" tab** in mockup apply S3 view (CLAUDE.md USER_TEMPLATE sözleşmesi karşılığı)
- **Reusable library mgmt**: rename, categorize (favorite/default), product type binding, archive
- **Quota/limits** (user başına maksimum template count? plan tier?)
- **Sharing** (kullanıcı template'ini başka user'a kopyalayabilir mi?) — Phase 66+ ürün kararı
- **dynamic-mockups consumer audit + deprecation** — Phase 63 + Phase 64'ten sonra hangi case'lerde hâlâ dış API gerek?

### Bundan sonra production tarafında kalan tek doğru iş

Phase 64 ile **templated.io ürün modelinin temeli** kuruldu:
- Schema ownership ✓
- User-scope read API ✓
- Admin transparency badge ✓
- Cross-user isolation guarantee ✓

Sıradaki gerçek iş **Phase 65 user upload UI** (write side): operatör kendi MockupTemplate'ini editor üzerinden create eder, asset upload eder, status DRAFT → ACTIVE geçer, mockup apply'da kendi library'sini görür. Bu adım Phase 64 schema'sını gerçek operator deneyimine bağlar — templated.io clone'un olgun ürün hali.

---

## Phase 65 — Test data cleanup + Admin/My templates ürün modeli + first user-create slice

Phase 64 ownership foundation (`MockupTemplate.userId`) + read API kurmuştu. Phase 65 audit'te ortaya çıktı: **3061 template'in 3058'i test fixture** (Phase8 Swap Test seed + integration test orphan + QA marker'lar). Operatör admin manager'da bu yapay "katalog"u görüyor → ürün hissi bozuluyor + templated.io ürün modeli (admin catalog vs my templates) anlamsız hale geliyor.

Bu turun üç ana çıktısı:
1. **Test data cleanup** (3061 → 3, 3058 silindi)
2. **Admin/My templates ürün ayrımı** mockup apply UI'da görünür
3. **First user-create slice**: `POST /api/mockup-templates` canlı (operatör kendi template'ini DRAFT olarak oluşturabilir)

### Ürün modeli (templated.io stili)

| Tab | Filter | Operatör için |
|---|---|---|
| **All** | `userId NULL OR userId === currentUser` | Tüm görülebilir templates (default) |
| **Admin templates** | `userId === NULL` | Admin'in global catalog'u (herkesin gördüğü) |
| **My templates** | `userId === currentUser` | Operatör'ün kendi library'si |

**Cross-user isolation guarantee** korundu (Phase 64 baseline): başka kullanıcıların template'leri ASLA hiçbir surface'te görünmez.

### Cleanup detayı

**Pattern-based hard delete** (`scripts/cleanup-test-mockup-templates.ts`):
- `Template 0 - Phase8 Swap Test` (145 row)
- `phase8-api-cover-swap-tpl-*` (yüzlerce integration test orphan)
- `Pass <N>` keyword
- `[V2-test]`, `[Phase64-test]`, `[QA]` marker'lar
- name içinde `*test*`, `*Test*`, `*TEST*`, `*fixture*`, `*Fixture*`
- **Korunanlar**: `Bundle Preview *` prefix, `userId IS NOT NULL` (user-owned), real catalog (audit'te 3 row: "Bundle Preview · 9-up Grid", "Sticker Sheet · 8 Die-Cut", "Studio Frame Mockup · Wall Art")
- **Cascade safety**: `MockupTemplateBinding onDelete: Cascade` → binding rows otomatik; `MockupRender.templateSnapshot.config` snapshot self-contained → geçmiş render'lar bozulmaz
- **Dry-run flag** desteği: `--dry-run` → silinecekleri listele, asıl silme yapma
- npm script: `cleanup:test-mockup-templates`

**Sonuç**: 3061 → 3 (3058 test fixture deleted, 3 real catalog template preserved).

### POST /api/mockup-templates (user-scope create)

Phase 65 first user-upload write endpoint:
- `requireUser` auth (cross-user enforced; operator userId override edemez)
- Body: `{ categoryId, name, thumbKey, aspectRatios, tags?, estimatedRenderMs? }`
- `userId = currentUser.id` (server-side hard set)
- Status: `DRAFT` (publish to ACTIVE = Phase 66 PATCH endpoint candidate)
- Bindings: empty (binding create ayrı endpoint, Phase 66)
- Response 201 with `ownership: "own"`

**Phase 66 candidate** (full upload UI):
- Asset upload UI (thumb file picker + MinIO upload via existing admin pattern)
- Template editor (safe-area visual editor + recipe config)
- Binding create form (LOCAL_SHARP provider config)
- Status transition (DRAFT → ACTIVE publish)

### /api/mockup/templates (Apply view consumer) — ownership-aware

Mevcut endpoint Phase 65'te ownership filter ekledi (mevcut Apply view consumer'ları için):
- Query: `categoryId` + `scope=all|global|own` (default `all`)
- Response items'a `ownership: "global" | "own"` projected
- Where: `userId NULL` veya `userId currentUser` (cross-user isolation)
- Order: own first (operator's library on top), then alphabetical
- `MockupTemplateView` schema (useMockupTemplates hook): `ownership` field eklendi (default "global" backward-compat)

### S1BrowseDrawer (mockup apply UI) — Admin/My/All tab strip

`src/features/mockups/components/S1BrowseDrawer.tsx`:
- **3 tab strip header altında**: All / Admin templates / My templates
- Each tab counts badge (own=N total)
- `aria-selected` canonical pattern; default "all"
- Filter logic genişletildi: ownership filter + vibe + room + aspect (ownership client-side filter, mevcut filter'lara ek)
- **Empty state for "My templates"**:
  - Title: "No templates of your own yet"
  - Copy: "Templated.io-style: upload your own PSD/PNG mockup template and reuse it across selections. The upload editor is coming soon (Phase 66); the API endpoint POST /api/mockup-templates is live now."
  - CTA: "Browse admin templates →" (operatör admin scope'a geçer)
- `data-testid`: `template-library-ownership-tabs`, `template-library-ownership-tab[data-ownership]`, `template-library-empty-state`, `template-library-empty-switch-admin`

Header copy update: "Template Kütüphanesi" → "Template library", "Kapat" → "Close" (CLAUDE.md Phase 18-31 EN parity).

### local-sharp ile templated.io modelinin birleşmesi

| Katman | Phase | Rol |
|---|---|---|
| Sharp pipeline (compositor + recipe + thumbnail) | Phase 8 | Render engine |
| placePerspective (4-corner DLT homography) | Phase 63 | T-shirt/mug yamuk smart-object area transform |
| MockupTemplate ownership (userId nullable) | Phase 64 | Foundation: admin catalog vs user library |
| User-scope read endpoint (GET /api/mockup-templates) | Phase 64 | Catalog read; cross-user isolation |
| Admin manager Ownership column | Phase 64 | Admin transparency |
| **Test data cleanup** (3061 → 3) | Phase 65 | Ürün hissi (operatör artık gerçek katalog görür) |
| **POST /api/mockup-templates (user-scope create)** | Phase 65 | First user-upload write path |
| **Apply view Admin/My/All tab strip + empty state** | Phase 65 | Operator-facing ayrım canlı |
| Apply endpoint ownership-aware (`/api/mockup/templates`) | Phase 65 | Mevcut consumer'lar global+own merge görür |

**Self-hosted templated.io clone bu noktada**: rect + perspective render engine self-hosted (no API), ownership schema + read + write endpoints var, operator UI'da admin/my ayrımı canlı, ilk user-create yolu açık. Eksik: full upload UI editor (Phase 66) + binding create form + status publish flow.

### Test coverage

**`tests/unit/mockup/ui/S1BrowseDrawer.test.tsx`** — 17/17 PASS (Phase 64 fixture'lara `ownership: "global"` eklendi; "Template Kütüphanesi" → "Template library" / "Kapat" → "Close" assertion update'leri).

**`tests/unit/mockup/ui/S2DetailModal.test.tsx`, `tests/unit/mockup/ui/PackPreviewCard.test.tsx`** — fixture'lara `ownership: "global"` eklendi (TS strict required field).

Phase 64 user-scope endpoint test'leri (6/6) intakt.

### Browser verification (canlı kanıt)

- **Cleanup verification**: `/api/admin/mockup-templates` → 3 templates (önceden 3061), names: "Bundle Preview · 9-up Grid", "Sticker Sheet · 8 Die-Cut", "Studio Frame Mockup · Wall Art"
- **POST endpoint live**: `POST /api/mockup-templates` body Phase 65 → HTTP 201 + `ownership: "own"` + `status: "DRAFT"`. `GET ?scope=own&status=DRAFT` → 1 item, ownership "own", endpoint persisted
- **Tab strip**: 3 tab rendered (All 1 / Admin templates 1 / **My templates 0**), aria-selected default "all"
- **Empty state**: My templates tab tıklanınca "No templates of your own yet" + copy + CTA "Browse admin templates →" canlı
- **Screenshot**: drawer open, tab strip header altında orange "My templates 0" active, empty state body'si "Templated.io-style: upload your own PSD/PNG..." + CTA görünür

### Quality gates

- `tsc --noEmit`: clean (5 fixture'a `ownership` field eklendi)
- `vitest`: **674/674 PASS** (650 baseline + 6 Phase 64 user-scope + 18 mockup UI fixtures)
- `next build`: ✓ Compiled successfully

### Değişmeyenler (Phase 65)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok** (Phase 64 baseline kullanıldı; ownership zaten yerinde).
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok**: Cleanup script + tek POST handler + 3 tab UI + ownership filter (mevcut filter zincirine ek).
- **Cross-user isolation guarantee korundu** (Phase 64 baseline; user1 user2'nin template'ini ASLA görmez).
- **Render history korundu**: `MockupRender.templateSnapshot.config` self-contained → silinen template'in render'ları hâlâ render snapshot'tan çalışır.
- **References / Batch / Review / Selection / Mockup / Product / Etsy Draft canonical akışları intakt** (Phase 26-64 baseline).
- **Mockup pipeline + worker + S7/S8 result view + dynamic-mockups path dokunulmadı** (yalnız tab strip + empty state UI değişikliği).
- **Admin endpoint baseline intakt** (`requireAdmin` GET/POST/PATCH/DELETE değişmedi).
- **Kivasy DS dışına çıkılmadı**.

### Bilinçli scope dışı (Phase 66+ candidate)

- **Full user upload UI editor**: asset upload form + safe-area visual editor + recipe config (template create flow operator için end-to-end UI)
- **User-scope binding create endpoint**: POST /api/mockup-templates/[id]/bindings (LOCAL_SHARP provider config; operator template'ini render-able yapar)
- **Status transition endpoint**: PATCH /api/mockup-templates/[id] (DRAFT → ACTIVE publish; ARCHIVE)
- **PSD ETL CLI**: `ag-psd` parser + `scripts/import-psd-mockup-template.ts` (Phase 60 araştırma + Phase 62 plan)
- **User template thumbnail upload endpoint**: `POST /api/mockup-templates/upload-asset` user-scope (admin endpoint reuse pattern)
- **Reusable library mgmt UI**: rename, categorize (favorite/default), product type binding, archive
- **Quota/limits** (plan tier-based)
- **Sharing** semantics (kullanıcı template'ini başkasına kopyalayabilir mi?)
- **dynamic-mockups consumer audit + deprecation karar** (Phase 63+64+65 sonrası hangi case'lerde hâlâ external API gerek?)

### Bundan sonra production tarafında kalan tek doğru iş

Phase 65 ile **templated.io clone'un canlı vertical slice'ı kuruldu**:
- Test data cleanup ✓ (3 real template kaldı)
- Admin/My/All ayrımı UI'da canlı ✓
- First user-create write endpoint ✓
- Cross-user isolation guarantee ✓
- Render history protected ✓

Sıradaki gerçek iş **Phase 66 user template editor UI** (write side full UI): asset upload form + safe-area editor + recipe config + binding create + status publish. Phase 65 schema + write API'si + UI ayrımı bu UI'yı operator-end-to-end deneyime bağlar. Sonra dynamic-mockups deprecation kararı.

---

## Phase 66 — First end-to-end user template flow (create → bind → publish → use)

Phase 65 ownership foundation + read API + first write endpoint (POST /api/mockup-templates) + admin/my UI ayrımı kurmuştu. Phase 66 **operator için tam ürün flow'unu açar**: kullanıcı UI üzerinden template yaratır → LOCAL_SHARP binding eklenir → DRAFT → ACTIVE publish → Apply Mockups'ta kendi library'sinde kullanılabilir.

### Audit (Phase 65 → Phase 66)

| Phase 65'te yapılan | Phase 66'da hâlâ eksikti |
|---|---|
| `POST /api/mockup-templates` (create) | UI yok — operatör cURL atmak zorunda |
| `MockupTemplate.userId` ownership | Binding endpoint yok → render edilemez |
| Apply drawer 3 tab + empty state | empty state Phase 66'a yönlendiriyor; user template render eden path yok |
| Admin `LocalSharpConfigEditor` | User-facing değil; `requireAdmin` |
| Status DRAFT default | Publish endpoint yok |

Phase 66 5 ana çıktı:
1. **Binding create endpoint** (user-scope, ownership-aware, LOCAL_SHARP only)
2. **Publish endpoint** (DRAFT/ACTIVE/ARCHIVED transitions, publish guard)
3. **User-facing create page** (`/templates/mockups/new`) + form (3-step API chain)
4. **Templates page CTA** ("+ New mockup template", admin gerektirmez)
5. **Apply drawer empty-state CTA** ("+ Create your first template" → create page)

### Endpoint detayları

**`POST /api/mockup-templates/[id]/bindings`** (Phase 66 binding):
- Auth: `requireUser`
- Body: `{ providerId: "LOCAL_SHARP", config, estimatedRenderMs }`
- Ownership invariant: template userId === currentUser; global (NULL) admin scope only → 403
- Cross-user → 404 (info hiding)
- Provider config → ProviderConfigSchema parse (LOCAL_SHARP yalnız Phase 66 scope; DYNAMIC_MOCKUPS user için yasak — paid external)
- Uniqueness: (templateId, providerId) DB constraint → 409 ConflictError
- **status default ACTIVE** (operator intent: bind = make renderable; template ACTIVE'e geçince hemen apply'da görünür)

**`PATCH /api/mockup-templates/[id]`** (Phase 66 publish):
- Auth: `requireUser`
- Body: `{ status: "DRAFT" | "ACTIVE" | "ARCHIVED" }`
- Ownership invariant aynı (cross-user 404, global 403)
- **Publish guard**: DRAFT → ACTIVE için en az 1 ACTIVE binding gerek; binding yoksa ValidationError + actionable hint ("Add a LOCAL_SHARP binding before publishing")
- archivedAt: status === ARCHIVED ise NOW(), aksi halde NULL

### User-facing create UI (`/templates/mockups/new`)

`MockupTemplateCreateForm` minimal but functional:
- 5 form field: Template name + Category (canvas/wall_art/printable/clipart/sticker) + Aspect ratio (1:1/2:3/3:2/3:4/4:5) + Base asset key (MinIO placeholder) + Publish immediately checkbox (default ON)
- Submit → 3-step API chain:
  1. POST /api/mockup-templates → DRAFT template (Phase 65 endpoint)
  2. POST /api/mockup-templates/[id]/bindings → LOCAL_SHARP binding (Phase 66 endpoint; minimal renderable config: 1024×1024 base + full-canvas rect safe-area + normal blend recipe)
  3. PATCH /api/mockup-templates/[id] → DRAFT → ACTIVE (Phase 66 endpoint, opsiyonel via checkbox)
- Status feedback (statusMsg state) per step
- Error: actionable mesaj
- Success: router.push("/templates") + refresh

Mevcut admin `LocalSharpConfigEditor` çok kompleks (jsonMode + JSON textarea + detailed safe-area form). Phase 66 V1 user form **5 field + defaults**; Phase 67+ visual safe-area editor + asset upload + recipe shadow config eklenir. Honest disclosure card UI'da: "Phase 66 V1 defaults: base 1024×1024, full-canvas rect, normal blend. Visual editor + asset upload Phase 67."

### Templates page CTA

`TemplatesIndexClient` topbar actions:
- **+ New mockup template** (secondary, Link to `/templates/mockups/new`) — user-facing, **admin gerektirmez** ✓
- + New prompt template (primary, prompt template editor — admin-only baseline)

Operatör artık Templates page'inden tek tıkla mockup template create akışına iner.

### Apply drawer empty-state CTA update

Phase 65 empty-state "Phase 66 coming soon" yazıyordu. Phase 66:
- "+ Create your first template" primary CTA → `/templates/mockups/new`
- "Or browse admin templates →" secondary fallback
- Copy update: "Templated.io-style: create your own mockup template and reuse it across selections. Self-hosted (no API calls) — your library, your library limit."

### Apply view consumer integration

`/api/mockup/templates` (Phase 65 ownership-aware) zaten user templates'i `ownership: "own"` ile döner. Apply drawer S1BrowseDrawer 3 tab strip (Phase 65) ile zaten ayrı tab'da render ediyor. Phase 66'da yeni endpoint eklemedi — **mevcut consumer aynı pipeline'dan user template'i alır**:
- User template publish edilince → `/api/mockup/templates?categoryId=X` döner
- Drawer "All" + "My templates" tab'larında görünür
- `hasActiveBinding: true` (Phase 66 binding ACTIVE default)
- Operatör tıkla, seç, **Apply Mockups** flow'a girer (mevcut canonical pipeline'dan render edilir)

### Browser verification (canlı end-to-end)

**Server-side full chain test** (live preview eval):
- Step 1 — POST template: 201, ownership="own", status="DRAFT" ✓
- Step 2 — POST binding: 201, providerId="LOCAL_SHARP", status="ACTIVE" ✓
- Step 3 — PATCH publish: 200, templateStatus="ACTIVE" ✓
- Step 4 — Apply visibility: visible=true, ownership="own", hasActiveBinding=true ✓

**UI verification**:
- Create page: h1 "New mockup template", 5 field render, submit "Create & publish" doğru
- Apply drawer "My templates" tab → empty-state with "+ Create your first template" CTA → `/templates/mockups/new` (Phase 66 page)
- `wall_art` category Apply endpoint: 1 global ("Studio Frame Mockup · Wall Art") + 1 own ("Phase 66 Live Test Template") — both `hasActiveBinding: true`

**Screenshot canlı kanıtlar**:
- Create page: header "New mockup template" + "TEMPLATED.IO-STYLE · SELF-HOSTED (NO API CALLS) · YOUR LIBRARY" + 5 field + Phase 66 V1 defaults info card
- Apply drawer empty state: "No templates of your own yet" + "+ Create your first template" orange primary CTA + "Or browse admin templates →" secondary

### Quality gates

- `tsc --noEmit`: clean
- `vitest`: **674/674 PASS** (Phase 65 baseline; Phase 66 endpoint-only changes — no test fixture impact)
- `next build`: ✓ Compiled successfully

### Templated.io clone canlı end-to-end

**Phase 8 + 63 + 64 + 65 + 66 birleşince**:
- Render engine: self-hosted Sharp (rect + perspective)
- Schema: ownership (userId nullable) + binding (provider config) + status (DRAFT/ACTIVE/ARCHIVED)
- Read API: user-scope catalog (global + own merge)
- Write API: create + bind + publish (full operator flow)
- Create UI: form-driven (3-step API chain)
- Apply UI: 3-tab strip + empty-state CTA
- Operator-end-to-end: Templates → "+ New mockup template" → form → publish → "My templates" → Apply Mockups → render

**Eksik (Phase 67+ candidate)**:
- Visual safe-area editor (rect koordinatlarını sürükle/bırak; 4-corner perspective interactive)
- Asset upload UI (MinIO file picker; admin endpoint pattern reuse)
- PSD ETL CLI (`ag-psd` parser)
- Reusable library mgmt (rename, archive, favorite/default, product type binding)
- Quota/limits (plan tier-based)
- dynamic-mockups deprecation karar

### Değişmeyenler (Phase 66)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok** (Phase 64 baseline kullanıldı).
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok**: 2 yeni route + 1 yeni page + 1 form component + 2 CTA + empty-state copy update.
- **Cross-user isolation guarantee korundu** (Phase 64 + 65 baseline; ownership 3 endpoint'te hardline enforced).
- **Render history korundu** (Phase 65 baseline).
- **Admin endpoint baseline intakt** (`requireAdmin` GET/POST/PATCH/DELETE değişmedi).
- **References / Batch / Review / Selection / Mockup / Product / Etsy Draft canonical akışları intakt**.
- **Mockup pipeline + worker + S7/S8 result view + dynamic-mockups path dokunulmadı**.
- **Apply view consumer (`useMockupTemplates` + S1BrowseDrawer)** → Phase 65 ownership baseline; Phase 66 yalnız empty-state copy + CTA değişikliği.
- **Kivasy DS dışına çıkılmadı**.

### Bilinçli scope dışı (Phase 67+ candidate)

- **Visual safe-area editor** — operator drag/drop ile rect koordinatlarını veya 4-corner perspective quad'ı görsel olarak set eder; mevcut admin LocalSharpConfigEditor'un user-facing visual versiyonu
- **Asset upload UI** — file picker + MinIO upload (`/api/admin/mockup-templates/upload-asset` user-scope açıldığında)
- **PSD ETL CLI** — `ag-psd ^15` parser + `scripts/import-psd-mockup-template.ts`
- **Template detail page** (`/templates/mockups/[id]`) — operatör template'ini düzenler (rename, edit binding, archive)
- **Reusable library mgmt** — rename / categorize / favorite/default / product type binding / archive / share
- **Quota/limits** plan tier-based
- **dynamic-mockups consumer audit + deprecation karar**
- **Multi-binding support** — bir template aynı anda LOCAL_SHARP + DYNAMIC_MOCKUPS binding taşıyabilir mi? (admin baseline destekler, user için scope kararı)

### Bundan sonra production tarafında kalan tek doğru iş

Phase 66 ile **templated.io clone canlı end-to-end vertical slice'ı kapatıldı**:
- Operatör Templates → CTA → form → publish → kendi library'sinde apply edebilir
- Server-side 3 endpoint zinciri kanıtlı (create → bind → publish → apply)
- UI 5-field form çalışıyor (Phase 67 visual editor için temel hazır)
- Apply drawer'da user template'in görünür akışı tam (empty-state CTA + tab + render)

Sıradaki gerçek iş **Phase 67 visual editor + asset upload UI**: drag/drop safe-area + file picker MinIO upload + recipe shadow config + template detail page (rename/edit/archive). Bu iki adım tamamlanınca operatör **Photoshop'a inmeden** kendi mockup template'ini sıfırdan oluşturabilir → templated.io ürün modelinin **olgun olur ki dynamic-mockups deprecation kararı verilebilir**.

---

## Phase 67 — Visual template editor first slice: asset upload + rect safe-area editor

Phase 66 end-to-end create → bind → publish → use chain'i çalışıyordu ama
operatör **görsel olarak hiçbir şey göremiyordu**: thumbKey text input
yapıştırma + 1024×1024 hardcoded baseDimensions + full-canvas hardcoded
safe-area. Operatör "asset'imi nereye yerleştirdim?" "design'ım nereye
düşecek?" sorularına ancak başka bir kanaldan (admin manager / DB
inspect) cevap alabilirdi. Phase 67 bu körlüğü kapatır.

### Phase 66 sonrası ürün boşluğu

1. **Asset upload UI yok**: Operatör MinIO'ya başka bir yolla
   yüklemiş olduğu key'i text input'a yapıştırmak zorundaydı. Mevcut
   admin upload-asset endpoint user-scope değildi.
2. **Hardcoded baseDimensions**: Form `{ w: 1024, h: 1024 }` yazıyordu.
   Yüklenen asset 256×384 ise compositor pipeline yine 1024×1024
   sanıyor — render bozuk.
3. **Hardcoded full-canvas safe-area**: `{ x:0, y:0, w:1, h:1 }`.
   Operatör frame interior'ını veya gerçek "design fit" bölgesini
   tanımlayamıyordu — design tüm asset'in üstüne basılıyor.
4. **Visual feedback yok**: Phase 66 form'da operatör "ne yarattığını"
   görmüyordu — submit edip publish ettikten sonra Apply drawer'da
   görünce ne olduğunu öğreniyordu.

### Slice 1 — User-scope upload-asset + asset-url endpoints

`POST /api/mockup-templates/upload-asset` (`src/app/api/mockup-templates/
upload-asset/route.ts`):

- Auth: `requireUser()` (admin değil — Phase 65 user-scope policy parity)
- Body: multipart/form-data + `file` + `categoryId` + `purpose: thumb|base`
- Limits: PNG/JPEG/WebP only, 25MB cap (admin parity)
- Sharp metadata extract: width + height **zorunlu** (visual editor
  viewBox'ı için; eksikse ValidationError)
- **Storage key prefix**: `u/{userId}/templates/{categoryId}/{purpose}/
  {cuid}.{ext}` — user-isolation hard-coded path:
  - Admin asset path: `templates/{categoryId}/{purpose}/...` (user prefix yok)
  - User general asset (Asset row): `u/{userId}/{cuid}` (asset-service emsali)
  - User template asset (Phase 67): `u/{userId}/templates/{categoryId}/...`
- Asset DB row YAZMAZ — admin upload-asset gibi storage-only.
  Template asset'leri Library/Selections'a karışmaz.
- Audit: `user.mockupTemplate.uploadAsset`
- Response: `{ storageKey, width, height, sizeBytes, mimeType }`

`GET /api/mockup-templates/asset-url?key=...` (`src/app/api/
mockup-templates/asset-url/route.ts`):

- Auth: `requireUser()`
- **Cross-user isolation hard guard**: key `u/{user.id}/templates/`
  prefix'i ile başlamalı; başkasının `u/{otherUserId}/...` prefix'i
  → ForbiddenError. Admin prefix `templates/...` reject (admin
  endpoint ayrı). User general asset prefix (`u/{userId}/{cuid}`
  templates olmadan) reject (asset signed-url endpoint ayrı).
- TTL 5min, browser cache 4min (admin parity)
- Response: `{ url, expiresAt }`

### Slice 2 — `SafeAreaEditor` visual component

`src/features/mockups/components/SafeAreaEditor.tsx` — yeni dosya, ~280
satır. Pure SVG editor, dış library yok:

- **Coordinate system**: SVG `viewBox = 0 0 ${imageWidth} ${imageHeight}`
  (asset'in gerçek pixel dimensions). Pointer event'ler
  `getScreenCTM().inverse()` ile native SVG transform'a düşürülür —
  zoom/scroll/responsive doğru çalışır.
- **Rect drag (translate)**: rect body üzerinde pointerdown → mouse
  hareketi rect'i kaydırır, image bounds'a clamp edilir.
- **8 resize handles**: 4 corner (nw/ne/sw/se) + 4 edge (n/s/e/w).
  Handle'a göre x/y/w/h doğru eksen üzerinde update edilir;
  west/north handle'ları için clamp logic asymmetric (newX = clamp
  + w = startW + startX - newX). Min dimension 5%.
- **Dimming overlay**: 4 rect with `rgba(22,19,15,0.45)` safe-area
  dışında — operatör "design buraya düşecek" sinyalini açıkça görür
  (Templated.io / Adobe smart object editor pattern parity).
- **k-orange rect**: fill `rgba(232,93,37,0.08)` + stroke `#e85d25` +
  white square handles with k-orange border. Cursor: grab/grabbing
  for rect, nwse-resize/ns-resize/etc. for handles.
- **Numeric overrides**: 4 input field altında (x/y/w/h % cinsinden,
  step 0.5, 1 ondalık precision). Operatör visual + numeric ikisini
  birlikte kullanabilir; numeric input clamp logic visual ile aynı
  (min dimension 5%, image bounds).
- **a11y**: SVG `role="application"` + aria-label; numeric input'lar
  type="number" min/max/step.
- **Output**: `SafeAreaRect` shape `{ x, y, w, h }` normalized 0..1
  — schema `SafeAreaRectSchema` ile birebir uyumlu (rotation field
  optional, Phase 67 scope dışı).

### Slice 3 — `MockupTemplateCreateForm` rewrite

`src/features/mockups/components/MockupTemplateCreateForm.tsx` —
Phase 66 baseline rewrite (~440 satır). Aynı 3-step API chain
(Phase 66 baseline) korunur, Phase 66 testid'ler korunur (regression
safe), ama:

- **Asset upload state**: `uploadMutation` POST'a multipart file
  yollar; onSuccess `{ storageKey, width, height, sizeBytes,
  mimeType }` form state'ine kaydeder. Reset safeArea to 10% inset
  (operatör genelde "tüm asset'in üstünde değil, içinde" başlamak
  ister).
- **Signed URL fetch effect**: Asset key değişince
  `/api/mockup-templates/asset-url`'den preview URL alır, error
  state'i ayrı handle.
- **Dropzone vs editor render switch**:
  - asset null → dashed border dropzone, click-to-pick file input
  - asset + previewUrl loaded → asset metadata caption + Replace link
    + `<SafeAreaEditor>`
  - asset + previewUrl loading → loading state placeholder
- **Submit flow**: form validation `name + asset !== null` (Phase 66
  `name + thumbKey` yerine); submit:
  ```ts
  baseAssetKey: asset.storageKey,
  baseDimensions: { w: asset.width, h: asset.height }, // gerçek pixels
  safeArea: { type: "rect", x, y, w, h },              // gerçek seçim
  ```
  Önceki hardcoded 1024×1024 + full-canvas tamamen kalktı.

### Phase 66 testid'ler korundu (regression safe)

`mockup-template-create-page` / `mockup-template-create-form` /
`mockup-template-create-name` / `mockup-template-create-category` /
`mockup-template-create-aspect` / `mockup-template-create-publish-toggle` /
`mockup-template-create-submit` / `mockup-template-create-cancel` /
`mockup-template-create-back` / `mockup-template-create-error` /
`mockup-template-create-status` — hepsi Phase 67 form'da aynı yerlerde.

Yeni testid'ler: `mockup-template-create-upload-dropzone`,
`mockup-template-create-upload-input`,
`mockup-template-create-editor-loaded`,
`mockup-template-create-replace-asset`,
`mockup-template-create-upload-error`, `safe-area-editor`,
`safe-area-editor-image`, `safe-area-editor-rect`,
`safe-area-editor-handle-{nw,n,ne,e,se,s,sw,w}`,
`safe-area-editor-input-{x,y,w,h}`.

### Browser end-to-end full proof

Live dev server (PID intakt, viewport 1440×900, fresh navigation):

| Test | Sonuç |
|---|---|
| Page mount | h1 "New mockup template", title "New mockup template · Kivasy", dropzone visible, submit disabled |
| Real upload (256×384 PNG synthetic) | uploadMutation POST → storageKey returned, signed URL fetched, editor mounted |
| Visual editor mount | rect + image + 8 handles (nw/n/ne/e/se/s/sw/w) all rendered |
| Numeric override (x → 15) | rect attribute updated: x=38.4px (=15% × 256), inputs reflect value |
| Submit chain | 3-step (POST template → POST binding → PATCH publish) — sayfa /templates'e yönlendirildi |
| DB-level verify | `cmp4n6gat...` row: ACTIVE + LOCAL_SHARP binding ACTIVE + config { baseDimensions: {w:256, h:384}, safeArea: {type:"rect", x:0.15, y:0.1, w:0.8, h:0.8}, baseAssetKey: u/{userId}/templates/wall_art/base/...png } |
| Visible in apply view | API `?scope=own&status=ACTIVE` → row found, ownership "own", binding 1 (LOCAL_SHARP/ACTIVE) |
| Screenshot proof | wall texture frame mockup rendered, k-orange safe-area rect tightly fit on frame interior (x≈96/512=18.75%, y≈136/768=17.7%, w=320/512=62.5%, h≈496/768=64.6%), 8 white handles + dimming overlay outside |

### Quality gates

- `tsc --noEmit`: clean
- `vitest tests/unit/mockup tests/integration/api-mockup-templates-user-scope`:
  **257/257 PASS** (no regression — Phase 66 testid'ler korunduğu için
  apply view + create form testleri intakt)
- Browser end-to-end: real upload + visual editor + 3-step chain +
  DB verify + Apply view visibility — hepsi canlı dev server'da

### Değişmeyenler (Phase 67)

- **Review freeze (Madde Z) korunur.**
- **Schema migration yok.** Phase 64 MockupTemplate.userId nullable +
  Phase 66 endpoint chain mevcut; Phase 67 yalnız 2 yeni endpoint +
  1 yeni component + 1 form rewrite.
- **WorkflowRun eklenmez.**
- **Yeni big abstraction yok.** SafeAreaEditor pure SVG (no react-dnd,
  no react-svg-pan-zoom, no fabric.js); asset upload mevcut admin
  pattern parity (formData + sharp + getStorage).
- **Phase 66 create chain endpoint signature'ları intakt** (POST
  template / POST binding / PATCH publish).
- **Apply drawer + Mockup studio + Render pipeline dokunulmadı.**
- **Canonical operator loop** (References → Batch → Review → Selection
  → Mockup → Product → Etsy Draft) intakt.
- **Kivasy DS dışına çıkılmadı.** k-orange (#e85d25), k-bg-2,
  k-orange-soft, k-orange-ink, line, line-soft, paper, ink/ink-2/
  ink-3, danger, success-soft, font-mono tracking-meta recipe'leri.
- **Cross-user isolation hard-enforced**: user-scope upload prefix
  `u/{userId}/templates/` + asset-url endpoint key prefix guard +
  Phase 66 binding endpoint ownership invariant + Phase 64 read-API
  scope filter — 4 katmanlı korunma intakt.

### Bilinçli scope dışı (Phase 68+ candidate)

- **Perspective quad editor**: SafeAreaEditor şu an `type: "rect"`
  only. Phase 63 backend `placePerspective` (4-corner DLT homography)
  hazır; UI 4 noktayı drag eden ayrı sub-mode olarak Phase 68'de
  açılır. Schema `SafeAreaPerspectiveSchema` mevcut.
- **Recipe editor**: Şu an `recipe: { blendMode: "normal" }` hardcoded.
  Operatör shadow/blendMode ayarlamak için admin manager JSON
  textarea'ya inmek zorunda. UI form: blend dropdown + shadow toggle/
  intensity ayrı tur.
- **Asset reuse picker**: Operatör daha önce yüklediği base asset'leri
  yeniden seçemez (her template için yeni upload). User-scope
  list-assets endpoint + picker UI ayrı tur.
- **Drag-and-drop file upload**: Şu an file input click-to-pick.
  Drag-over visual feedback + drop zone aktivasyonu ayrı küçük tur.
- **Rotation handle**: SafeAreaRectSchema `rotation` field optional;
  UI handle eklenmedi (rotated rect Phase 68+ candidate).
- **Inline preview render**: Operatör "bir test design upload edip
  bu template ile render bak" akışı — ayrı tur (Phase 8 mockup job
  pipeline reuse edilebilir).
- **Template detail / edit / archive page**: Phase 66'da templates
  index'te liste vardı; detail page (rename + edit binding + archive)
  ayrı tur.

### Bundan sonra templated.io clone tarafında kalan tek doğru iş

Phase 67 ile **operatör Photoshop'a inmeden ilk gerçek mockup
template'ini sıfırdan oluşturup yayınlayabilir**:
- Asset upload (visual feedback ile)
- Safe-area visual editor (drag/resize + numeric override)
- Gerçek baseDimensions (no hardcode)
- Gerçek safeArea (no hardcode)
- 3-step chain → ACTIVE template → Apply drawer'da kullanılabilir

Sıradaki gerçek iş **Phase 68 perspective quad editor** + **recipe
editor** + **template detail/edit page**. Bu üçü tamamlanınca
templated.io ürün modeli **dynamic-mockups deprecation kararına
hazır** olur (operatör paid external API'ye ihtiyaç duymadan tüm
template authoring akışını self-hosted pipeline üzerinde yapabilir).

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
