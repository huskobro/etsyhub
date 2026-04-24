# Claude Design Brief — EtsyHub Final Ürün Tasarım Dili + Somut Ekran Tasarımları

Merhaba. Senden EtsyHub adlı lokal-first üretim uygulamasının **final ürün seviyesinde tasarım dilini** oluşturmanı ve aynı brief içinde bu dilin **somut ekran tasarımlarını** göstermeni istiyorum. Bu çıktı iki iş birden yapacak: (1) bundan sonra her ekranın, her primitive'in ve her etkileşimin referansı olacak bir tasarım dili dokümanı, (2) final ürünün görsel yönünü gözle görebileceğim kadar net, düşük/orta sadakatli ama somut ekran tasarımları.

Yani "sadece metin spec" değil, "metin spec + görsel yön birlikte". Bu iki şey birbirinden ayrı düşmesin; tasarım dili ekranlarda gözüksün, ekranlar tasarım dilini kanıtlasın.

Promptu dikkatli oku. Bağlam, kararlar ve beklentiler kasten eksiksiz yazıldı; varsayım üretmene gerek yok.

## 1. Ürün bağlamı

EtsyHub, Etsy ve POD (print-on-demand) satıcılarının günlük üretim iş akışlarını yürüttüğü bir **üretim kokpitidir**. Kullanıcı buraya ilham için değil, üretim yapmak için geliyor. Ekranda uzun saatler geçiriyor: rakip mağazaları tarıyor, trend stories akışında geziyor, bookmark topluyor, reference havuzunu düzenliyor, AI ile varyasyon üretiyor, kalite reviewundan geçiriyor, mockup hazırlıyor, listing yazıyor, Etsy draft'ı gönderiyor.

Bu yüzden uygulama hissi şöyle olmalı:

- **Yoğun ama sakin.** Ekranda çok veri, çok görsel, çok aksiyon var; ama sayfa gürültülü hissetmemeli.
- **Üretim kokpiti.** Pazarlama sitesi değil. Her ekran işe yarıyor, hiçbir alan dekoratif değil.
- **Premium disiplin.** Sade, net, tokenla yönetilen, her detayı düşünülmüş bir sistem. Ucuz admin şablonu hissi olmamalı.
- **Asset-first.** Ürünün kalbi görseller: bookmark thumbnail'ları, reference grid'i, generated design varyasyonları, mockup'lar. Görsel yüzeyler UI'ın ana kahramanıdır; tipografi ve kenarlık ikinci plandadır.

Referans olarak **Matesy** (https://matesy.co/) ve **Listybox** (https://listybox.com/tr/) ürünlerinin uygulama içi UX mantığı ilham veriyor: sol sidebar, beyaz çalışma alanı, turuncu/kırmızı aksan, kart/grid yapısı, story akışı, tek ana aksiyon mantığı. Birebir kopya istemiyoruz; aynı kullanım kolaylığı ve akış hissini özgün bir dille kuracağız.

## 2. Kesin olarak istemediklerimiz

Bunlar tartışmaya kapalı. Ne tasarım dili dokümanında öner, ne de somut ekran tasarımlarında kullan:

- Gradient hero'lar, büyük marketing banner'ları, landing page dili
- Blob şekiller, dekoratif SVG arka planlar
- Glassmorphism, yarı saydam buzlu panel efektleri
- Shimmer gradient (skeleton dahil — sade pulse kullanacağız)
- Overlay'lerde `backdrop-blur`
- `tracking-tight` veya negatif letter-spacing (letter-spacing 0)
- Arbitrary Tailwind value'ları (`aspect-[4/3]`, `min-h-[80px]`, `scale-[1.02]` gibi) — hepsi named utility veya token olacak
- Emoji veya ikon bazlı dekorasyon (fonksiyonel ikon OK)
- Abartılı hover: büyük scale sıçramaları, renk patlamaları, gölge fişeği
- Yuvarlatılmış her şey — pill button, balon kartlar, rounded-full blok elemanlar
- Neon, glow, drop-shadow efektleri
- Animasyonlu vurgular, bouncing, slide-in gibi dikkat dağıtıcı geçişler

## 3. Mevcut ürün durumu

Şu ekranlar bugün **canlı ve çalışıyor**, tasarım dilini bunların üzerine kuracağız (yeniden yazmıyoruz, uyumlu hale getireceğiz):

**Kullanıcı paneli:**
- Dashboard (iskelet; final dil içinde yeniden düzenlenecek)
- Bookmarks (grid + filtre + bulk actions)
- References (grid + collections)
- Collections (liste)
- Competitors (mağaza ekleme + analiz)
- Trend Stories (story/card akışı)
- Settings (kendi mağazaları, Etsy bağlantısı)

**Admin paneli:**
- Users (tablo)
- Themes (liste + editor)
- Product Types
- Feature Flags
- Scraper Providers (config form)
- Prompt Templates (versiyonlu)
- Job Monitor
- Audit Logs

Henüz yazılmayan ama ilerleyen fazlarda gelecek ekranlar:
- Variation Generation, AI Quality Review, Human Review Queue
- Selection Studio, Mockup Studio, Listing Builder
- Publishing Queue, Export Center, Clipart Studio
- Prompt Playground, Cost Usage, Negative Library, Recipes, Seasonal Calendar

Tasarım dilin, **bugün mevcut olan ekranları taşıyacak kadar somut**, **henüz olmayan ekranları da hazırlıkla karşılayacak kadar esnek** olmalı.

## 4. Teknik zemin

Tasarım dilin bu teknik zemini varsayarak yazılacak — asla onu bozmayacak:

- **Stack:** Next.js + TypeScript + Tailwind CSS + Radix UI primitives + React Query + Zustand
- **Token sistemi:** CSS custom properties (`--color-bg`, `--color-surface`, `--color-text`, `--color-muted`, `--color-accent`, `--color-danger`, `--color-warning`, `--color-success`, `--space-1…--space-20`, `--radius-sm/md/lg`, `--shadow-card/popover`)
- **Mimari:** Feature-based klasör yapısı (`src/features/bookmarks`, `src/features/admin/themes` vb.)
- **Primitive lokasyonu:** `src/components/ui/`
- **Çift panel:** `/` altı user paneli, `/admin` altı admin paneli — **aynı tasarım ailesi, farklı yoğunluk**
- **Dil:** Tüm kullanıcıya dönük metinler Türkçe; tam diacritic şart

Bu zeminin dışına çıkma. Arbitrary Tailwind value'su önerme, tasarım sisteminin dışından token icat etme, Radix dışında UI kütüphanesi çağırma.

## 5. Kararlaştırılmış ilkeler (varsayım olarak al)

Aşağıdakiler zaten kararlaştırıldı. Hem dokümanda hem ekran tasarımlarında bu kararları kabul edilmiş gibi uygula; tartışma, üzerine inşa et:

1. **Skeleton** sade `animate-pulse` ile yapılır, shimmer gradient yok
2. **Grid skeleton** varsayılan olarak 6 sabit kart render eder
3. **Admin tablo skeleton** varsayılan olarak 5 sabit satır render eder
4. **Overlay** `bg-text/50` katmanıdır, `backdrop-blur` yok
5. **Letter-spacing** 0 (Tailwind default) — `tracking-tight` kullanılmaz
6. **Arbitrary value** yasak; her aspect ratio, min-height, scale named utility veya token olmalı
7. **Named token örnekleri** (eklenmek üzere): `aspect-card` (4/3), `aspect-portrait` (2/3), `min-h-textarea` (`--space-20` = 80px)
8. **Hover scale** değeri Tailwind default `scale-105` olabilir veya named `scale-subtle` token önerebilirsin — **bunun kararını senden istiyorum (açık soru 4 içinde)**
9. **Hover dili** abartısız, sakin, kontrollü; sınır rengi değişimi + hafif scale + subtle shadow kabul edilir, renk patlaması olmaz
10. **Aksan rengi** turuncu/kırmızı ailesi (mevcut `--color-accent`); ana çalışma alanı beyaz/light; metin koyu
11. **User paneli** gevşek yoğunluk: `p-6`, `gap-4`, daha hava alan kartlar
12. **Admin paneli** sıkı yoğunluk: `p-4`, `gap-3`, daha fazla satır per ekran, tablo-ağırlıklı
13. **Competitors ve Trend Stories** ekranları bu tasarım ailesine bağlanacak — ikisi de mevcut ve polish sprintinin Phase 2 kapsamında migre edilecek
14. **Radius** küçük-orta: `rounded-md` default, `rounded-lg` büyük yüzeyler için; tam yuvarlak pill yok
15. **Shadow** sadece `shadow-card` (kalıcı yüzeyler) ve `shadow-popover` (dialog/dropdown) — başka shadow yok

## 6. Çıktı yapısı — iki yarım, birlikte

Çıktını **iki büyük bölüme** ayıracaksın: **Bölüm A: Tasarım Dili Dokümanı** ve **Bölüm B: Somut Ekran Tasarımları**. İkisi tek bir Markdown dokümanında, sırayla, birbirine referans vererek yer alsın. Bölüm B'deki her ekran, Bölüm A'daki primitive ve ilkelerin uygulamasını gözle görünür hale getirsin.

---

## BÖLÜM A — TASARIM DİLİ DOKÜMANI

### A.1 — Final Ürün Tasarım Prensipleri

EtsyHub'ın ruhunu belirleyen 5 ila 8 ilke. Her ilke:
- Kısa, akılda kalır bir başlık (3-6 kelime)
- 2-4 cümle açıklama (neden bu ilke, ne zaman uygulanır)
- En az 1 somut örnek (hangi ekranda, hangi karar anında)

İlkeler şunları kapsamalı: **hissiyat** (sakin/yoğun dengesi), **görsel öncelik** (asset vs veri), **güven** (hata ve loading dili), **hız** (keyboard ve bulk actions), **yoğunluk** (user vs admin), **premium disiplin** (detay titizliği).

### A.2 — UI Language Kit (Tasarım Dilinin Hammaddeleri)

En uzun ve en somut bölüm. Aşağıdaki 15 alt başlığın **hepsini eksiksiz** dolduracaksın. Her alt başlık için:
- Anatomi (hangi parçalardan oluşur)
- Varyantlar / modlar (primary/secondary, sm/md/lg, success/warning/danger/neutral vb.)
- Durumlar (default, hover, focus, active/selected, disabled, busy, error — uygulanabiliyorsa)
- Spacing, radius, border, shadow önerileri (token adıyla)
- Kullanım kuralları (nerede kullanılır, nerede kullanılmaz)
- En az 1 "yanlış kullanım" örneği

Alt başlıklar:

1. **Button** (primary, secondary/ghost, destructive, icon-only; sm/md/lg; loading state)
2. **Input / Select / Textarea** (label, help text, error text, prefix/suffix; focus ring; disabled)
3. **Card** (bookmark card, reference card, design variation card, stat card — tip tip)
4. **List / Table** (admin tablo density, satır hover, sort header, sticky header, bulk select, empty satırı)
5. **Badge / Chip / Tag** (status badge, count badge, category tag, filter chip — nerede hangisi)
6. **Dialog / Drawer / Confirm** (confirm variantlarının birbirinden farkı, drawer ne zaman tercih edilir, dialog ne zaman)
7. **Skeleton / Loading** (Skeleton, SkeletonCard, SkeletonRow, SkeletonLine; sade pulse dili)
8. **Empty / No-Data / Error State** (StateMessage primitive'i — üç ton: neutral/warning/error; ikon, başlık, açıklama, aksiyon)
9. **Asset / Image yüzeyi** (thumbnail, cover, grid item, preview modal; aspect ratio'lar; fallback; alt text)
10. **Page Shell / Section Shell** (sayfa header'ı, breadcrumb, section title hierarchy, içerik kolonu genişliği)
11. **Toolbar / Filter bar** (search, filter chip'leri, bulk action bar, view toggle)
12. **Etkileşim durumları** (hover/focus/selected/disabled/busy — her biri için somut token kombinasyonu)
13. **Spacing / Radius / Border / Shadow / Density** (ne zaman hangi değer; user-admin density farkı)
14. **User vs Admin ton farkı** (aynı primitive nasıl iki panelde farklı hissettirilir — sadece padding mı, tipografi de mi, shadow da mı)
15. **Veri yoğun vs thumbnail yoğun hiyerarşi** (admin tablo satırında ne öne çıkar, bookmark grid kartında ne öne çıkar — iki farklı hiyerarşi grameri)

Her alt başlık için tokenlarla konuş: `bg-surface`, `border-border`, `text-text-muted`, `shadow-card`, `rounded-md`, `p-6`, `gap-3` gibi. Spec'i class-level somutlukta yaz; inline kod örneği gerekmez ama token adlarıyla konuş.

### A.3 — 2 Alternatif Yön + Öneri

İki farklı global yön sun. Her yön:
- Kısa isim ve 1 cümle pozisyonlama
- Kime uygun, neyi öne çıkarıyor
- Renk/spacing/shadow/density dokusu nasıl hissettiriyor
- 3 artı, 3 eksi
- Hangi ekran ailesinde daha güçlü, hangisinde zayıf

Sonunda **senin önerdiğin yönü** gerekçesiyle belirt. Önerini tek kararlı cümleyle kapat. **Bölüm B'deki somut ekran tasarımlarının hepsi bu önerilen yönde çizilecek.**

### A.4 — Claude Code Handoff

Bu bölüm operasyonel. Claude Code bu bölümü alıp sırayla implement edecek. Beklentim:

- **Primitive sırası:** Hangi primitive önce, hangisi sonra inşa edilmeli (bağımlılık sırası)
- **Ekran aile migrasyon sırası:** Hangi aile önce migre edilir, hangisi sonra (risk + etki analizine göre)
- **Polish sprint kapsamı:** Şu anki sprintte bitecek olanlar (Skeleton, StateMessage, Badge + grid/admin sayfa migrasyonları)
- **Phase 2 kapsamı:** Sprint sonrası (Competitors, Trend Stories, AdminPageHeader, Dashboard layout, Auth brand paneli, Sidebar accent bar, Filter chip'leri)
- **Token ekleri:** Tailwind config'e eklenmesi gereken named utility'ler listesi (aspect-card, aspect-portrait, min-h-textarea, scale-subtle varsa vb.)
- **Kabul kriterleri:** Her primitive/aile için "bitti" sayılmasının şartı

**Kritik sıralama kuralı:** Uygulama sırası **primitive-first** olmalı. Önce primitive'ler inşa edilir ve stabilize olur, sonra ekran aileleri bu primitive'leri **olduğu gibi tüketerek** migre edilir. Ekran tasarımları primitive kararlarını delmesin, tek seferlik custom çözüm eklemesin; eğer bir ekran yeni bir davranışa ihtiyaç duyuyorsa, önce primitive genişletilir, sonra ekran onu kullanır. Handoff bölümünde bu sırayı açıkça vurgula.

Handoff'u yazarken, Claude Code'un yapmasını **istemediğin** şeyleri de açıkça belirt (örn. "mevcut confirm-dialog.tsx'i yeniden yazma, sadece overlay'den `backdrop-blur-sm` kaldır").

---

## BÖLÜM B — SOMUT EKRAN TASARIMLARI

Bu bölüm görsel yönü gözle görünür hale getirir. Aşağıdaki 12 ekran için **düşük/orta sadakatli ama somut** tasarımlar çizeceksin. Sadece metin spec değil: metinsel spec'e ek olarak somut ekran tasarımlarını **açık ve okunabilir biçimde** üret. Bu beklenti isteğe bağlı değil; her ekranın görsel yönü tek bakışta anlaşılır olmalı.

### B'nin format kuralları

Her ekran için:

1. **Ekran adı** ve 1 cümlelik amaç
2. **Görsel yön** — üç sunum yolundan en az **ikisini** kullan:
   - **ASCII/metin wireframe** (kutu/blok seviyesinde yerleşim, kolon genişlikleri, boşluklar, başlık hiyerarşisi)
   - **Bölge bölge anatomi** (header bandı, toolbar, içerik kolonu, yan panel, footer) — her bölge için boyut, token, içerik özeti
   - **Varyant çekimleri** (aynı ekranın default / empty / loading / error / selected hallerinden anlamlı olanları)
3. **Kullanılan primitive'ler** — Bölüm A.2'den hangi primitive'ler kullanıldı, hangi varyantlarla
4. **Token kararları** — spacing, radius, shadow, border, renk token'larının somut eşleşmesi (`p-6`, `gap-4`, `shadow-card`, `border-border`, `text-text-muted` gibi)
5. **Etkileşim notları** — hover, focus, selected, bulk-action, keyboard kısa yolları
6. **Responsive notları** — dar viewport'ta nasıl davranır (kolon sayısı, toolbar collapse, sidebar)
7. **Kaçınılan şeyler** — bu ekranda özellikle yapmadığın ve neden yapmadığın (ilke + karar referansıyla)
8. **Bitti kriteri** — bu ekran "bitmiş sayılır" demek için ne doğru olmalı

ASCII wireframe örneği senin stilinde olsun — kutular, kolonlar, hizalama net görünsün. Metin kalabalığından kaçın; ama görsel yön bir bakışta anlaşılsın.

### B'nin kapsadığı 12 ekran

Aşağıdaki 12 ekranın **hepsi** Bölüm B'de yer alsın. Her biri için yukarıdaki 8 başlığı eksiksiz doldur.

1. **Dashboard** (son joblar + bekleyen reviewlar + hızlı aksiyon + mozaik stat) — **Kapsam notu:** Bu ekran için şimdilik **direction** ver; stat widget'larının full detay çözümüne girme, hangi widget'ların olacağının bire bir listesini çıkarma, mikro grafik detayına inme. Amaç: Dashboard'un genel iskeleti, hiyerarşisi ve ton olarak nereye oturduğunu göstermek. Full ekran çözümü sonraki faz.
2. **Login / Register** (tek ekran iki mod; brand paneli + form paneli)
3. **Bookmarks grid** (thumbnail yoğun; filtre bar, bulk select, kart hover, empty, skeleton)
4. **References grid** (Bookmarks'a benzer ama koleksiyon entegrasyonlu; collection filter)
5. **Collections list/grid** (koleksiyon kartları; içerik sayısı, son güncelleme, hover aksiyonları)
6. **Admin Users table** (veri yoğun; sort header, row hover, bulk action bar, status badge, empty satırı)
7. **Admin Product Types / Feature Flags tablo** (Users'a benzer ama daha dar; aç-kapa toggle, inline edit)
8. **Competitors** (mağaza ekleme formu + analiz sonucu grid/liste; review-count bazlı sıralama görsel dili)
9. **Trend Stories** (story/card akışı; yatay scroll, kart tıklama preview, bookmark/reference CTA)
10. **Confirm dialog** (destructive/warning/neutral tone'ları yan yana; overlay, icon var mı yok mu, buton hiyerarşisi)
11. **Empty state örneği** (Bookmarks boş hali; StateMessage primitive'inin gerçek kullanımı)
12. **Skeleton/loading örneği** (Bookmarks grid loading + admin Users tablo loading — iki farklı density)

### Ekstra notlar

- Bölüm A ve Bölüm B birbirine referans versin: Bölüm B'deki kararlar "A.2.3 Card primitive'in reference varyantı" gibi doğrudan bağlansın
- Somut ekran tasarımlarında renk/token konusunda metin kalmasın; her bloğun hangi token'ı kullandığı yazsın
- Tüm Bölüm B ekranları, Bölüm A.3'te önerdiğin yönü uygulasın — alternatif yönde ekran çizme, kafa karıştırmasın
- ASCII wireframe'lerde 80 karakter civarında kalmaya çalış, okunabilirlik kritik

## 7. Cevaplamanı istediğimiz 8 açık soru

Bölüm A ve B'ye ek olarak, **ayrı bir başlık altında** bu 8 soruya net, kararlı cevap ver. "Duruma göre" yerine yön seç. Her cevap 3-6 cümle olsun.

1. **Wow noktası ne olmalı, ne olmamalı?** EtsyHub'da kullanıcıyı etkileyen görsel an ne olmalı? Ama marketing dili olmadan. Hangi ekran, hangi detay "bu iyi yapılmış" hissini verir?
2. **Asset-first ürün olduğu için görsel yüzey ne kadar baskın olmalı?** Thumbnail, grid, preview ne kadar büyük, ne kadar öne çıkar? Tipografi ve veri bunun neresinde durur?
3. **Admin tarafı ne kadar sade, ne kadar operatif?** User paneliyle aynı ailede ama farkı nasıl kurarız? Sadece density mi, typography scale de mi değişir?
4. **Hover dili ne kadar görünür olmalı?** Kart hover'ında ne olur: border rengi değişimi, hafif scale, shadow — hangisi tek başına yeterli, hangisi kombinlenir? `scale-105` mi yeterli yoksa named `scale-subtle` token mı önerirsin (ve değeri ne olur)?
5. **Badge/chip kullanımı nerede yoğun, nerede minimal?** Status badge (job status, listing status), count badge, filter chip, category tag — bunların her biri hangi ekranda ne kadar baskın olur?
6. **Empty state'ler nasıl sıcak ama profesyonel olur?** İllüstrasyon mu, sadece tipografi mi, ikon + başlık + CTA mı? Hangi tonla konuşur (yardımcı mı, nötr mü, yönlendirici mi)?
7. **Trend Stories + Competitors aynı aileye nasıl bağlanır?** İkisi de keşif ekranı ama biri story akışı, diğeri mağaza analizi. Hangi ortak primitive'lerle birleştirilir, hangi noktada ayrışırlar?
8. **Hangi primitive'ler tüm ürünü taşıyan çekirdek sistem?** Bütün ekranların dayandığı 5-7 temel primitive'i seç ve sırala. Hangisi olmazsa hiçbir şey çalışmaz?

## 8. Çıktı formatı ve dil

- **Tek bir Markdown dokümanı** — içinde Bölüm A, Bölüm B ve Açık Sorular sırayla
- Başlıklar numaralı (A.1, A.2, B.1, B.2…) hiyerarşi net görünsün
- ASCII wireframe'ler `text` kod bloğu içinde olsun (syntax highlight gereksiz)
- Token adıyla konuş: class-level somutluk, framework-free anlatım; gerektiğinde kısa kod-benzeri snippet OK
- Görsel yön somutlaşsın; karar veren, yön gösteren bir dille yaz — "belki şöyle olabilir" değil "şöyle olsun"
- **Türkçe yaz**; teknik terim (token, primitive, hover, focus, density, skeleton, thumbnail vb.) İngilizce kalabilir
- Türkçe metinlerde tam diacritic kullan (ç, ğ, ı, İ, ö, ş, ü)
- Dolgu metin yazma; uzunluk hedefi yok, gerektiği kadar uzun olsun ama her cümle iş yapsın

## 9. Son not

Bu dokümanın amacı **tek bir sprintin iskelesini kurmak değil**; EtsyHub'ın ürün ömrü boyunca tüm arayüz kararlarını taşıyacak ana tasarım dilini kurmak ve bu dili gözle görülür somut ekranlarla kanıtlamak. Sonra her yeni ekran, her yeni primitive, her yeni hover kararı bu dokümana dönüp bakacak. Kararlı yaz, net yaz, somutla, "belki şöyle olabilir" yapıları yerine "şöyle olsun" seç.

Başla.
