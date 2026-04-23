# EtsyHub / Matesy-Inspired Local App Plan

## Dil Kuralı

Kullanıcıyla tüm iletişim Türkçe yapılacak. Claude Code açıklamalarını, planlarını, durum güncellemelerini ve final yanıtlarını Türkçe yazacak. Kod, dosya adları, teknik terimler, API alanları ve değişken isimleri İngilizce kalabilir; fakat kullanıcıya dönük tüm anlatım Türkçe olmalıdır.

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

Bu proje landing page değildir. İlk sürüm localhost üzerinde çalışan bir productivity web app olacaktır. İleride Tauri ile macOS/Windows native app olarak paketlenebilecek şekilde tasarlanacaktır.

Odak:

- wall art
- canvas art
- printable art
- clipart bundle
- sticker / transparent PNG setleri
- ileride t-shirt, hoodie, DTF gibi POD ürünleri

Ana amaç:
Kullanıcı Etsy için ürün fikirlerini bulsun, bookmark etsin, referans havuzuna taşısın, AI ile benzer ama özgün tasarımlar üretsin, kalite kontrolünden geçirsin, mockup hazırlasın, SEO listing oluştursun ve Etsy’ye draft olarak göndersin.

Ana akış:
Analysis -> Trend Stories -> Bookmarks -> References -> Variations -> AI Review -> Selection -> Mockup -> Listing -> Etsy Draft

## Ana Kararlar

- Landing page yapılmayacak.
- İlk ekran dashboard olacak.
- Localhost-first Next.js app yapılacak.
- Native app şimdilik yapılmayacak.
- Mimari ileride Tauri wrapper’a uygun olacak.
- Etsy’ye direct active publish yapılmayacak; draft/human approval kullanılacak.
- Arayüz sade, akış bazlı ve Matesy’nin uygulama içi UX mantığından ilham alacak.
- Listybox’taki geniş ürün kapsamı incelenecek ama birebir kopyalanmayacak.
- Kullanıcı prompt mühendisliği yapmak zorunda kalmayacak.
- Admin panelinde master prompt, provider, tema, product type ve sistem ayarları yönetilecek.
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
- Amazon
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

Ürün tipleri:

- canvas
- wall art
- printable
- clipart
- sticker
- t-shirt
- hoodie
- DTF

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

Mockup üretim ekranı.

Modlar:

- canvas/wall art mockup
- poster/printable mockup
- t-shirt/hoodie mockup
- clipart bundle cover
- sticker sheet preview
- custom mockup upload

Özellikler:

- kullanıcı kendi mockup’ını yükleyebilir
- mockup template seçebilir
- bir tasarımı birden fazla mockup’a uygulayabilir
- grup mockup mantığı desteklenebilir

### 11. Listing Builder

Etsy listing hazırlama ekranı.

Üretilecek alanlar:

- title
- description
- 13 tags
- category
- price
- materials
- production partner
- digital/physical seçimi
- mockup images
- downloadable files

Özellik:

- AI listing metni master promptlardan üretilecek
- kullanıcı düzenleyebilecek
- Etsy’ye draft olarak gönderilecek
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

Etsy/POD için önemli tarihleri gösterecek.

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

Matesy üretimi hızlandırıyor. Bu sistemin daha güçlü olması gereken noktalar:

- fikirleri bookmark ile düzenli toplamak
- referans havuzu oluşturmak
- üretimden önce ve sonra kalite kontrol yapmak
- clipart/digital download tarafını güçlü desteklemek
- admin prompt yönetimiyle sistemi sürekli iyileştirmek
- kullanıcıyı karmaşık ayarlara boğmadan üretim yaptırmak
- düşük kaliteli veya riskli görselleri otomatik elemek
- çok kullanıcılı ve çok mağazalı yapıyı baştan doğru kurmak
