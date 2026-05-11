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
