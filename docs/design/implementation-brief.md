# EtsyHub — Implementation Brief

> Onaylı tasarım dili: [`docs/design/EtsyHub/EtsyHub Design Spec.md`](EtsyHub/EtsyHub%20Design%20Spec.md) ve yanındaki canlı canvas [`docs/design/EtsyHub/EtsyHub Design Language.html`](EtsyHub/EtsyHub%20Design%20Language.html). Bu brief o spec'in kod tarafındaki uygulama planıdır. **Yeni tasarım yönü üretmez.** Her karar spec'e + canvas'a bağlıdır; sapma çıkarsa önce spec güncellenir, sonra uygulanır.

> **Kapsam tonu:** Bu brief implementation *planıdır* — kod yazma adımı bundan sonraki turda. Burada sadece **ne, hangi sırayla, hangi risklerle** uygulanacak yazılıyor.

> **Kesin envanter (spec ile birebir hizalı):** 7 bölüm · **18 artboard**. Tek doğru liste: `EtsyHub Design Spec.md` → "TEK VE KESİN ENVANTER". Bu brief boyunca artboard sayısı tek yerden okunur, başka bir sayı (17 vb.) kullanılmaz.

> **Badge casing kararı (kilitli):** Badge etiketleri **title-case Türkçe** ("Hazır", "Review", "Üretiliyor", "Hata", "Rollout", "Açık") — badge primitivi `text-transform: uppercase` uygulamaz. Mono hissi yalnızca font ailesi + 11px boyut + 0.6 letter-spacing ile taşınır. Bu karar tüm Badge / tablo head / sidebar group header / stat card label render'larını kapsar.

---

## 1. Implementation stratejisi

### Neden primitive-first

EtsyHub'ın onaylı tasarım dili **18 artboard** üzerinde tek bir sistem üzerinden konuşuyor (spec envanteri: 7 bölüm · 18 artboard). Ekranlar kendi özel davranışlarını üretmiyor; hep aynı `Card`, aynı `Badge`, aynı `Thumb`, aynı `StateMessage`, aynı `Table` davranışını tüketiyor. Bu durumda ekran-önce bir sıra:

- Ekranın kendi içinde "tek seferlik" Card/Badge türevleri doğurur
- Aynı primitive'in 3 farklı yerel kopyası çıkar
- Token sistemi delinir, sprint sonunda geri dönüp "senkronlama" yapmak zorunda kalırız

Primitive-first sıralama bunu tersine çevirir: primitive olgunlaşır → ekran primitive'i olduğu gibi tüketir → ekran kodu ince kalır, davranış tek yerde yaşar. Spec `A.4 Claude Code Handoff` bölümünde **"Ekran aileleri primitive tüketir, davranış delemez"** kuralını koyuyor; bu brief o kuralı operasyonelleştiriyor.

### Hangi parçalar foundation

Spec'in **"Çekirdek 7 primitive"** cevabına + mevcut kod envanterine dayanarak foundation şu katmanlardan oluşur:

**Foundation — Katman 0 (zemin):**
- Tokens (`globals.css` revizyonu — warm off-white palette, `#E85D25` aksan, IBM Plex Mono, spacing/radius/shadow scale)
- Tailwind config genişletmesi (`aspect-card`, `aspect-portrait`, `min-h-textarea`, `scale-subtle`, `ehPulse` keyframe)
- Font entegrasyonu (Inter + IBM Plex Mono)

**Foundation — Katman 1 (çekirdek primitive):**
- `Button` (primary/secondary/ghost/destructive; sm/md/lg)
- `Input` / `Textarea` (prefix/suffix/error/disabled)
- `Badge` (neutral/accent/success/warning/danger/info; mono + 11px + tracking 0.6, **title-case**, uppercase yok)
- `Chip` (active/removable)
- `Card` (Stat / Asset / List 3 tipi — single component, variant prop)
- `Skeleton` + `SkeletonCard` + `SkeletonRow`
- `StateMessage` (neutral/warning/error)
- `Thumb` / `AssetSurface` (named aspect ratios, fallback kind'lar)
- `Dialog` + `Confirm` (mevcut `confirm-dialog.tsx` üzerine küçük refactor)
- `Table` primitive ailesi (`Table` / `THead` / `TR` / `TH` / `TD` + selected row + bulk bar)
- `Toggle` (spec carry-forward #1 — şimdilik yerel, 3. admin ekranı gelince terfi)

**Foundation — Katman 2 (shell):**
- `NavItem` + `Sidebar` (accent-bar-left, group headers mono title-case — uppercase yok)
- `PageShell` (topbar + title + subtitle + actions + optional toolbar)
- `Toolbar` / `FilterBar` / `BulkActionBar`

### Hangi ekranlar bu foundation'a bağımlı

| Ekran ailesi | Kritik bağımlılıklar |
|---|---|
| Bookmarks · References · Collections | Card (Asset), Thumb, Badge, Chip, Toolbar, BulkActionBar, Skeleton, StateMessage |
| Dashboard | Card (Stat + List + Asset), Badge, Thumb, PageShell |
| Competitors | Card (List), Table, Badge, StatMini, SectionTitle |
| Trend Stories | Card (Asset), Thumb, Badge, Chip |
| Selection Studio · Mockup Studio | Card, Thumb, Badge, Button, edit sidebar yapısı (PageShell içinde) |
| Admin Users · Product Types · Feature Flags | Table, Badge, Toggle, Chip, PageShell (admin density) |
| Login | PageShell (auth varyantı), Button, Input |
| Confirm/Empty/Skeleton katalog | Zaten karşılıkları primitive içinde; demo amaçlı değil, ürün içinde kullanılıyor |

Her ekran ailesi primitive setinin **tamamı hazır olmadan** başlatılmaz; ama Katman 0 + Katman 1'in ilgili alt küme'si tamamsa başlatılabilir. Bu nedenle primitive sırası bilinçli olarak "tablo" ve "shell"i sonraya atmıyor — onlar da kritik.

---

## 2. Primitive uygulama sırası

Sıra spec'in `A.4` handoff sıralamasını takip ediyor; sadece mevcut kod gerçekliğine göre (bugünkü `src/components/ui/` yalnızca 4 dosya içeriyor) **Storybook yerine hafif demo sayfası** + **TDD ile vitest testleri** varyantı seçiliyor.

| # | Primitive | Neden bu sırada | Hangi ekranları açar |
|---|---|---|---|
| **0** | **Tokens + globals + Tailwind config + font** | Tüm primitive'ler renk/spacing/radius/shadow/mono token'ına dayanıyor; eksik token'la primitive yazmak = sonradan geri dönmek | Hiçbir ekran açmaz; ama olmazsa hiçbir primitive düzgün çizilmez |
| 1 | Button | En yalın; hemen hemen her primitive onu tüketiyor (StateMessage CTA, Card aksiyon, Dialog footer, Toolbar) | Dolaylı: tüm ekranlar |
| 2 | Input / Textarea | Button'dan sonra formlar açılabilir; `min-h-textarea` token'ı burada ilk kez tüketilir | Login, Competitors "mağaza ekle" formu, Selection edit prompt, Scraper Providers config |
| 3 | Badge / Chip | Card ve Table içinde kullanılıyor — onlardan önce gelmeli; Badge mono + 11px + tracking 0.6 + **title-case** render'ını tek yerde kilitler (uppercase yok) | Her grid/tablo ekranı, filter bar'lar, status göstergeleri |
| 4 | Skeleton + SkeletonCard + SkeletonRow | Loading state için acil; token `ehPulse` keyframe'i burada ilk kez tüketilir; 6 sabit kart / 5 sabit satır varsayılanları sabitlenir | Bookmarks loading, References loading, admin tablo loading |
| 5 | StateMessage | Empty/error state için acil; Bookmarks empty migration'ı için gereklidir | Bookmarks empty, References empty, Collections empty, admin tablo empty, hata ekranları |
| 6 | Thumb / AssetSurface | `aspect-card` / `aspect-portrait` / `aspect-square` token'ları ve `scale-subtle` hover davranışını tek yerde kilitler; fallback kind'ları standartlaştırır | Bookmarks, References, Collections, Trend Stories, Selection, Mockup |
| 7 | Card (Stat / Asset / List variant'ları) | Foundation'ın kalbi; Thumb + Badge + Button tamamsa Card varyantlarının hepsi tek turda yazılabilir | Dashboard, Bookmarks, References, Collections, Competitors store cards, Trend cluster cards |
| 8 | NavItem + Sidebar | Shell katmanının tabanı; accent-bar-left davranışı ve scope farkı (user/admin) burada kilitlenir | Tüm sayfalar shell içine girer |
| 9 | PageShell | Sidebar + topbar + title + actions + opsiyonel toolbar; her yeni ekran bunu kullanacak | Bu aşamadan sonra hiçbir ekran shell kendi yazmaz |
| 10 | Toolbar / FilterBar / BulkActionBar | PageShell'in toolbar slot'unu doldurur; bulk bar'ın accent-soft bg + sayaç + ghost aksiyon davranışı standartlaşır | Bookmarks, References, admin tablo ekranları |
| 11 | Dialog / Confirm refactor | Mevcut `confirm-dialog.tsx` yeniden yazılmıyor — sadece spec'e göre: overlay'den `backdrop-blur-sm` kaldır, ikon kutusu 36×36 tone-soft radius-md ekle, overlay opacity `text/50`, footer yapısı korunur | Tüm destructive/warning/neutral onay akışları (zaten kullanılıyor) |
| 12 | Table primitive ailesi | Admin Users/Product Types/Feature Flags tek çatı altına toplanır; head mono title-case 11px, row 48h, selected row accent-soft, sort header ok'ları burada kilitlenir | Admin Users, Product Types, Feature Flags, Competitors tablo, Audit Logs ileride |
| 13 | Toggle (yerel → terfi adayı) | Şimdilik `src/features/admin/.../components/` altında yerel kalır; spec carry-forward #1 gereği 3. admin ekranı istediğinde çekirdeğe terfi | Admin Product Types, Admin Feature Flags (şimdi); diğer admin toggle'ları (ileride) |

**Kritik nokta:** 0 → 5 arası "yeni ekran yazmadan" bitmeli. 6 → 7 ile Bookmarks migrasyonuna başlanabilir. 8 → 10 ile shell katmanı migre edilir. 11 → 12 foundation'ı kapatır.

---

## 3. Ekran migrasyon sırası

Spec Phase 1/2'yi "kapandı" diye işaretliyor — bu **canvas tarafında** kapandı demek; kod tarafında hiçbir ekran bu yeni dile göre migre edilmedi. Kod migrasyonu sırası:

| Sıra | Ekran ailesi | Neden bu sırada | Risk / bağımlılık |
|---|---|---|---|
| **R1** | **Bookmarks** (3 state: default + empty + loading) | Spec'te en çok derinleşen ekran; primitive setinin **hepsini** aynı anda test eder (Card-Asset, Thumb, Badge, Chip, Toolbar, BulkActionBar, Skeleton, StateMessage). Burası yeşilse sistem konuşuyor demektir. | Mevcut Bookmarks kodu bulk-action + filtre + koleksiyon entegrasyonu zaten var; migrasyon **yüzey + primitive tüketimi**, data layer'a dokunmayacak. |
| R2 | References | Bookmarks'ın kardeşi; kart dili aynı + koleksiyon filter chip satırı ekler. Bookmarks yeşilse R2 hızlı gider. | Koleksiyon filter chip satırı Chip primitive'ini gerçek kullanımla test eder. Bookmarks empty + loading kararları burada tekrarlanır. |
| R3 | Collections | Mosaic kart (2×2 thumbnail) ilk kez kullanılır; Card-Asset varyantının yeni bir alt formu gerekirse primitive'e eklenir (ekran delmez). | Mosaic thumbnail davranışı Thumb primitive'ine yeni prop (`mosaic`) eklemeyi gerektirebilir; bu **primitive genişlemesi**, ekran customization'ı değil. |
| R4 | Admin Users | Table primitive'in ilk gerçek kullanımı; admin density (`p-4 gap-3`, row 48, text-sm) burada ilk kez aktive olur. PageShell'in admin scope varyantı burada kanıtlanır. | 9-kolon genişlik 1024+ viewport'ta test edilmeli. Selected row accent-soft davranışı Bookmarks bulk-action deneyiminden farklı — iki pattern net ayrışmalı. |
| R5 | Admin Product Types | Table + yerel `Toggle` yardımcısı birlikte. Toggle davranışı admin density içinde test edilir. | Toggle primitive'inin `on/onChange/size/disabled` prop'ları net olmalı; 3. admin ekranında terfi için izleme notu düşülür. |
| R6 | Admin Feature Flags | Table + Toggle + rollout progress bar. Progress bar **Card primitive'ine özel bir varyant olmayacak** — ekran içi küçük yardımcı yeterli (spec onayı: ekran seviyesinde çözülmüş). | Rollout bar'ın yeni primitive'e terfi eşiği: 2. kullanım yeri çıkarsa ürün primitive'ine alınır. |
| R7 | Login (full hi-fi) + Register (direction-level refine) | Auth shell ayrı tasarım dili istemiyor; PageShell'in "auth layout" varyantı + mevcut Button/Input'la çözülür. Register tab alan listesi spec carry-forward #2 gereği **implementation'ın ilk turunda** kilitlenir. | Auth layout PageShell içinde mi yoksa `PageShell.Auth` alt bileşeni mi? Karar: PageShell'e `variant="auth"` prop'u — ek bileşen değil. |
| R8 | Dashboard (direction-level) | Stat row + list card + asset pair + trend grid. **Widget seti spec'te direction-level bırakıldı**; implementation'da widget kombinasyonu + mikro grafik kararları carry-forward #2 gereği netleşir. | Mikro grafik: şu an **grafik yok** — stat kartı sadece numeral + trend badge. Mini grafik kararı implementation ilk turuna bırakılır, yeni primitive doğurmaz. |
| R9 | Competitors (mevcut — polish Phase 2) | Üç blok yapısı: hızlı ekle formu + takipli mağaza kart grid + top-reviewed tablo. PageShell + Card + Table + Chip + StatMini (yerel) kombinasyonu. | StatMini yerel yardımcı kalır (spec onayı); mağaza kart hover davranışı Card-List varyantına eklenir. |
| R10 | Trend Stories (mevcut — polish Phase 2) | Cluster satırı + story feed (portrait asset + gradient overlay + hover CTA üçlüsü). Thumb'ın `aspect-portrait` kullanımı + hover scale-subtle + accent overlay burada tepeye çıkar. | Gradient overlay spec'te geçiyor ama "gradient hero" yasağıyla karışmamalı — bu yalnızca **story kartı üstünde metin okunurluğu için dark-to-transparent** küçük overlay, dekoratif değil. Bu ayrım kod yorumunda açık yazılacak. |
| R11 | Selection Studio (mevcut sonraki tur) | Üretim akışı — Phase 3'ün ilk ekranı. Sol preview + filmstrip + sağ edit sidebar (quality score + prompt + quick edits). Carry-forward "yeni tasarım yok" kuralı gereği shell içinde primitive'ler tüketilir. | Filmstrip 12-slot genişlik/overflow davranışı test edilmeli. Quick edit button satırı ekran içi yardımcı kalır. |
| R12 | Mockup Studio (mevcut sonraki tur) | Featured render + template grid + render queue. MockupScene spec'te **katalog/demo** olarak işaretli — ürün tarafında gerçek render üretildikçe ayrı issue. | Render queue progress bar aynı (R6) paterni — tekrarı görürsek Progress primitive'ine terfi eşiği değerlendirilir. |

**Ayrı sprint (Phase 3+):** AI Review Queue, Listing Builder, Publishing Queue, Export Center, Clipart Studio, Prompt Playground, Cost Usage, Negative Library, Recipes, Seasonal Calendar, Audit Logs, Job Monitor detayları. Bu brief'in kapsamında **değil** — burası "temel dili yayma" işi ve sırası geldiğinde ayrı brief yazılır.

---

## 4. Checkpoint planı

Her checkpoint'te **aynı kalite kapısı** koşar:

- `pnpm typecheck` / `npm run typecheck`
- `pnpm lint` / `npm run lint`
- `npm run check-tokens` (arbitrary Tailwind value tarayıcısı — spec disiplinini koruyan asıl kapı)
- `npm run test` (vitest — primitive testleri, confirm flow testleri)
- `npm run test:ui` (Playwright smoke — shell + migre edilen ekran)
- **Visual check:** ilgili ekranı dev server'da açıp canvas artboard'uyla yan yana karşılaştırma (manuel)

Bu 6 kapının hepsi yeşilse checkpoint "geçti" sayılır. Ek olarak her checkpoint sonunda **Claude Code + insan** review: sapma var mı, spec ile uyumsuz bir yer var mı?

### Checkpoint sırası

| CP | Kapanış durumu | Kapıya ek kontrol |
|---|---|---|
| **CP-0** | Tokens + Tailwind config + font tamam (Katman 0) | `check-tokens` yeni `aspect-card/portrait/square`, `min-h-textarea`, `scale-subtle` utility'lerini arbitrary-value sapmasına karşı tarayabiliyor mu? |
| **CP-1** | Çekirdek primitive'ler Button → Card arası (1-7) tamam | Her primitive için vitest unit testi (default + hover + focus + disabled varyantları); `primitives-demo` route'unda görsel showcase canvas `primitives` artboard'uyla eşleşiyor mu |
| **CP-2** | Shell (NavItem + Sidebar + PageShell + Toolbar/FilterBar/BulkActionBar) tamam | Sidebar accent-bar-left active item; user/admin scope toggle; smoke test: herhangi bir boş sayfa shell içinde render olsun |
| **CP-3** | Dialog refactor + Table primitive tamam | Mevcut confirm-flow testleri hâlâ yeşil (regresyon yok); table-primitive-demo canvas admin ekran artboard'uyla eşleşiyor |
| **CP-4** | Bookmarks (3 state) migre | 3 state: default + empty + loading gerçek dev server'da görünüyor; canvas artboard ile yan yana; bulk action + filter + bookmark CRUD akışları yeşil |
| **CP-5** | References + Collections migre | Koleksiyon filter chip davranışı doğru; Collections mosaic thumbnail render doğru |
| **CP-6** | Admin tablo üçlüsü (Users + Product Types + Feature Flags) migre | Toggle davranışı; admin density gerçekten user'dan farklı hissediyor mu; rollout progress bar tekrarsa Progress primitive'e terfi eşiği tartışılır |
| **CP-7** | Login + Dashboard direction | Auth varyantı; Register tab alan listesi kilitlendi; Dashboard widget seti kilitlendi; mikro grafik kararı verildi |
| **CP-8** | Competitors + Trend Stories migre | Mağaza kart grid; story feed portrait overlay; gradient yasağı delinmedi |
| **CP-9** | Selection Studio + Mockup Studio migre | Filmstrip + edit sidebar; render queue progress; custom mockup upload modalı sonraki tura (spec onayı) |
| **CP-FINAL** | Tüm migrasyon tamam, Phase 3 için brief girdisi hazır | Tüm kalite kapıları; spec + canvas + kod üç yönlü hizalı; carry-forward #3 ("yeni tasarım yok") ihlali var mı tarandı |

**Checkpoint = dur, review al, commit, devam et.** Atomik iş parçaları checkpoint içinde yaşar; checkpoint atlanmaz.

---

## 5. Carry-forward notların implementation karşılığı

Spec'in sonundaki 3 carry-forward notunun her biri için somut implementation kuralı:

### 5.1 `Toggle` terfi kuralı

- **Şimdi:** `Toggle` yerel yardımcı olarak `src/features/admin/product-types/components/toggle.tsx` ve `src/features/admin/feature-flags/components/toggle.tsx` altında duplike olarak yazılmaz — **tek yerel kopya** olarak `src/features/admin/_shared/toggle.tsx` altında durur. Böylece iki ekran aynı dosyayı tüketir.
- **Terfi eşiği:** Üçüncü admin ekranı Toggle'a dokunduğu anda (örn. Scraper Providers'a "aktif sağlayıcı" toggle'ı veya Audit Logs'a bir filter toggle'ı), **o sprintte** `src/components/ui/toggle.tsx` altına terfi edilir. Terfi sırasında prop sözleşmesi korunur: `on: boolean`, `onChange: (next: boolean) => void`, `size?: 'sm' | 'md'`, `disabled?: boolean`.
- **Yasak:** "Şimdiden çekirdeğe alalım, belki lazım olur" varsayımıyla erken terfi. Spec gerekçesi: primitive'in prop sözleşmesi 3. kullanıma kadar tam olgunlaşmaz.
- **Implementation tetiği:** Toggle'a 3. kullanım gelen PR'da **ayrı commit** olarak terfi edilir (ekran PR'ı ile karışmaz); migrasyon minimal diff olur.

### 5.2 Dashboard widget detayı

- **Şimdi:** Dashboard R8 turunda **direction-level** migre edilir — stat row (4 col) + son işler + bekleyen review + yükselen trendler ana iskelet canvas'la birebir. İçerik ise gerçek domain datasıyla doldurulur (mock değil).
- **Widget kombinasyonu kilidi:** R8'in *ilk adımı* widget set kararını yazıya dökmek: "hangi 4 stat metriği (ör. aktif job, bekleyen review, yayında listing, bugünkü üretim)?", "son işler kaç satır?", "bekleyen review kaç asset?". Bu karar R8 başladığında `docs/design/implementation-notes/dashboard-widgets.md` altına yazılır, commit edilir, sonra kod yazılır.
- **Mikro grafik:** İlk turda grafik **yok**. Stat kart yalnızca numeral + mono label + trend badge. Grafik ihtiyacı Phase 3'te Cost Usage / Analytics ekranları geldiğinde doğal olarak çıkacak; o zaman yeni primitive (`SparkLine` veya `MiniChart`) için ayrı spec çıkarılır. Dashboard'a tek seferlik grafik eklenmez.
- **Drill-through link'ler:** Her widget "tümünü gör" CTA'sı olarak ilgili ekrana navigate eder — yeni navigation primitive'i gerekmez, standart `Button variant="ghost" size="sm" iconRight="chev"` tüketilir.

### 5.3 Login / Register tab revizyonu

- **Şimdi:** R7 turunda Login full hi-fi migre edilir. Register tab'ının **alan listesi** R7'nin ilk adımında kilitlenir: email + şifre + şifre tekrar + *koşullar kabul* checkbox (marketing opt-in **eklenmez** — EtsyHub lokal-first, marketing list yok). Karar `docs/design/implementation-notes/register-fields.md` altına yazılır.
- **Auth layout:** Ayrı `AuthShell` bileşeni yazılmaz — `PageShell` bileşenine `variant="auth"` prop'u eklenir: sidebar gizler, topbar gizler, iki kolon (brand | form) layout uygular. Prop adı spec-level karardır, PR'da spec dosyasına küçük bir not olarak yansıtılır (bir satır).
- **Brand panel içeriği:** Canvas'ta 4 asset strip var; implementation'da gerçek dashboard thumbnail'larından seçilmiş statik asset seti kullanılır (mock görsel yok). Asset strip verisi hardcoded değil, `src/features/auth/brand-assets.ts` altında liste olarak durur — ileride admin'den yönetilebilir olmak üzere (Phase 3+).

### 5.4 "Yeni keşif yok" kuralı nasıl korunacak

Bu kural implementation boyunca tek bir kapıdan geçer: **her PR'ın açıklamasında spec referansı + canvas artboard referansı zorunlu**. PR açılırken şu üç soru cevaplanır:

1. Bu PR hangi spec bölümünü uyguluyor? (`A.2 Button`, `B.3 Bookmarks`, …)
2. Canvas'ta hangi artboard karşılığı var? (`bookmarks · default`, `bookmarks-loading`, …)
3. Spec'i / canvas'ı delen bir karar var mı? Varsa: **önce spec güncellenir, ayrı commit** → sonra kod.

Review aşamasında Claude Code veya insan reviewer bu 3 soruyu sormak zorundadır. Cevap yoksa PR bloklu. Yeni primitive veya yeni davranış ihtiyacı çıkarsa, implementation durdurulur, spec dosyasına küçük bir ek yapılır (bir-iki satır), sonra devam edilir.

Ek olarak `check-tokens` scripti **primitive-first ihlali** için de çalışır: ekran dosyasında `className` içinde `bg-[#...]`, `aspect-[..]`, `min-h-[..]`, `scale-[..]` gibi arbitrary value'lar bulursa fail eder. Script kapsamı CP-0'da genişletilir.

---

## 6. Önerilen task listesi

Aşağıdaki task'lar atomiktir — her biri 2-5 küçük adım, her biri sonunda kalite kapısı koşabilir, her biri tek bir commit'e sığar.

### Foundation (CP-0 → CP-3 arası)

| T# | Task | Kabul kriteri |
|---|---|---|
| T-01 | `globals.css` token katmanını spec'in `tokens.css`'ine göre yeniden yaz (warm off-white palette, accent #E85D25, warm gri nötrler, surface-2/3 scale, space-20, status soft'lar). HSL tuple'dan hex değerlere geçiş veya HSL korunuyorsa renk değerleri hex'ten HSL'e çevrilerek tutarlılık | Dev server arkaplanı warm off-white; `--color-accent` spec rengi; `check-tokens` yeşil |
| T-02 | Tailwind config genişletmesi: `aspectRatio.card/portrait`, `minHeight.textarea`, `scale.subtle`, keyframes `ehPulse`, `fontFamily.sans/mono` Inter + IBM Plex Mono | `className="aspect-card"`, `min-h-textarea`, `animate-ehPulse`, `font-mono` çalışır |
| T-03 | Font yüklemesi: Inter + IBM Plex Mono `next/font` ile `app/layout.tsx` içinde | Typography sans/mono canvas'la eşleşir |
| T-04 | `check-tokens` scripti: `aspect-[..]`, `min-h-[..]`, `scale-[..]`, `bg-[#..]`, `text-[#..]`, `border-[#..]` pattern'lerini tarar | `src/**/*.{ts,tsx}` üzerinde 0 bulgu (temizdir); script PR reviewda koşar |
| T-05 | `Button` primitive (variant: primary/secondary/ghost/destructive; size: sm/md/lg; loading) + unit test (her variant her size default/hover/focus/disabled/loading) | Unit test yeşil; `primitives-demo` sayfasında 4×3 grid canvas `primitives` artboard'u ile eşleşir |
| T-06 | `Input` + `Textarea` primitive (prefix/suffix/error/disabled; Textarea `min-h-textarea`) + unit test | Focus accent border (ring yok); error border-danger; unit test yeşil |
| T-07 | `Badge` primitive (neutral/accent/success/warning/danger/info; `dot`; mono 11px; tracking 0.6; **title-case**, `text-transform: uppercase` yok) + unit test | Render'da etiket title-case olarak görünür (ör. "Hazır" → DOM'da "Hazır"); mono font + tracking 0.6 aktif; unit test title-case korunduğunu doğrular |
| T-08 | `Chip` primitive (active/removable; sans 13; active→accent-soft) + unit test | Active bg accent-soft; removable click event; unit test yeşil |
| T-09 | `Skeleton` + `SkeletonCard` + `SkeletonRow` (ehPulse; SkeletonCard default=6 count, SkeletonRow default=5 count) + unit test | Count prop hariç çağrıda 6/5 defaults; unit test yeşil |
| T-10 | `StateMessage` primitive (tone: neutral/warning/error; icon 40×40 tone-soft box; title 15/600; body 13 muted; optional action) + unit test | 3 tone canvas `empties` artboard'u ile eşleşir; CTA işlevsel; unit test yeşil |
| T-11 | `Thumb` / `AssetSurface` primitive (aspect card/portrait/square; kind fallback'ları; hover scale-subtle; selected accent ring) + unit test | `mevcut asset-image.tsx` ile uyumlu (gerekirse Thumb onu tüketir); unit test yeşil |
| T-12 | `Card` primitive (variant: stat/asset/list; interactive prop; hover border-strong + shadow 1→4) + unit test | 3 variant canvas primitive showcase ile eşleşir; unit test yeşil |
| **CP-1 checkpoint** | T-01 → T-12 arası kalite kapısı tam koşar | Primitive demo sayfası canvas ile yan yana onaylanır |
| T-13 | `NavItem` + `Sidebar` (scope: user/admin; accent-bar-left; group headers mono title-case, uppercase yok; count badge slot) + unit test | Active item'da sol 2×16px accent bar; count badge Badge primitive'i tüketir; group header casing title-case |
| T-14 | `PageShell` (sidebar + topbar 56h + title + subtitle + actions + optional toolbar slot + `variant="auth"`) + smoke test | Shell içinde boş sayfa render olur; auth variant iki kolon brand/form; smoke test yeşil |
| T-15 | `Toolbar` + `FilterBar` + `BulkActionBar` (search + chip row + view toggle; bulk bar accent-soft bg + sayaç + ghost aksiyonlar) + unit test | Bulk bar açılınca/kapanınca layout stabil; chip row kaydırma davranışı kontrollü |
| **CP-2 checkpoint** | Shell katmanı kapatıldı | Smoke test yeşil |
| T-16 | `confirm-dialog.tsx` refactor: overlay `bg-text/50`, `backdrop-blur-sm` kaldır, ikon kutusu 36×36 tone-soft radius-md ekle, footer yapısı korunur (mevcut props + state slot kalır) | Mevcut confirm-flow testleri yeşil; görsel canvas `confirms` artboard'u ile eşleşir |
| T-17 | `Table` primitive ailesi (`Table` + `THead` + `TR` + `TH` + `TD` + selected row accent-soft + sort header ok + empty row StateMessage slot) + unit test | Canvas admin artboard'u ile eşleşir; admin density tokens (row 48h, text-sm) aktif |
| **CP-3 checkpoint** | Foundation tamam | Tüm kalite kapıları; primitive-demo sayfası onaylı |

### Ekran migrasyonu (CP-4 → CP-9 arası)

| T# | Task | Kabul kriteri |
|---|---|---|
| T-18 | Bookmarks grid default migrasyonu: mevcut bookmark list component'ı PageShell + Toolbar + Card-Asset + Thumb + Badge + Chip + BulkActionBar içine taşı | Bulk action + filter + CRUD akışları regresyonsuz; canvas `bookmarks · default` ile eşleşir |
| T-19 | Bookmarks empty state: StateMessage neutral + 2 CTA (URL ekle + reference'a bak) | Empty state canvas `bookmarks-empty` ile eşleşir |
| T-20 | Bookmarks loading state: 6 sabit SkeletonCard grid | Loading state canvas `bookmarks-loading` ile eşleşir |
| **CP-4 checkpoint** | Bookmarks 3 state yeşil | Tüm kapılar + görsel karşılaştırma |
| T-21 | References grid: Bookmarks kart dili + koleksiyon filter chip satırı (6 koleksiyon + "koleksiyonsuz" chip) + kart altı folder-accent badge | Canvas `references` ile eşleşir |
| T-22 | References empty + loading (Bookmarks ile aynı dil) | 3 state yeşil |
| T-23 | Collections list/grid: 3-col mosaic (2×2 thumbnail aspect-card), başlık + count + son güncelleme mono + active accent bar (3px sol) | Canvas `collections` ile eşleşir; Thumb primitive'e gerekirse `mosaic` prop eklenir (ayrı commit) |
| **CP-5 checkpoint** | References + Collections yeşil | Kapılar + görsel |
| T-24 | Admin Users tablo migrasyonu: 9-kolon Table + 3 chip filter + CSV export + davet CTA topbar + selected row accent-soft | Canvas `admin-users` ile eşleşir; admin density aktif |
| T-25 | Admin Product Types tablo: 7-satır + yerel Toggle (2. kullanım) + usage + recipe sayısı + "pasif satırda sub-copy" | Canvas `admin-product-types` ile eşleşir |
| T-26 | Admin Feature Flags tablo: 7-flag + rollout progress bar (yerel) + scope/env/state badge üçlüsü + toggle | Canvas `admin-feature-flags` ile eşleşir; rollout bar 2. kullanım — terfi eşiği değerlendirilir (karar yazıya dökülür) |
| **CP-6 checkpoint** | Admin tablo üçlüsü yeşil | Kapılar + görsel |
| T-27 | `register-fields.md` karar dosyası (carry-forward #3 gereği) | Alan listesi kilitli; doc commit |
| T-28 | Login migrasyonu: PageShell `variant="auth"` + brand panel (4 asset strip) + form panel (tab switch + email + şifre + primary CTA + Google OAuth) | Canvas `login` ile eşleşir |
| T-29 | Register tab: T-27'deki alan listesiyle | Auth shell içinde register doğru render olur |
| T-30 | `dashboard-widgets.md` karar dosyası (carry-forward #2 gereği) | Widget seti kilitli; doc commit |
| T-31 | Dashboard migrasyonu: stat row (4 col) + son işler (list card) + review bekleyen (asset preview pair) + yükselen trendler (4-col asset grid). Mikro grafik **yok**. | Canvas `dashboard` direction-level ile eşleşir |
| **CP-7 checkpoint** | Login + Register + Dashboard yeşil | Kapılar + görsel + karar doc'ları commit |
| T-32 | Competitors migrasyonu: hızlı ekle formu + 3-col takipli mağaza kartı (avatar + growth badge + stat üçlüsü) + 8-satır top-reviewed tablo | Canvas `competitors` ile eşleşir; StatMini yerel yardımcı olarak kalır |
| T-33 | Trend Stories migrasyonu: 4-col cluster kartı (2-gözlü mosaic + heat badge + count chip) + 4-col story feed (portrait asset + story overlay + bookmark/folder/wand hover) | Canvas `trend-stories` ile eşleşir; gradient yasağı delinmedi (overlay yalnızca okunurluk için dark-to-transparent, dekoratif değil) |
| **CP-8 checkpoint** | Competitors + Trend Stories yeşil | Kapılar + görsel + gradient yasağı teyidi |
| T-34 | Selection Studio migrasyonu: sol varyant preview + 12-slot filmstrip + sağ 320w edit sidebar (kalite skoru + kontrol listesi + prompt + 4 quick edit button) | Canvas `selection` ile eşleşir |
| T-35 | Mockup Studio migrasyonu: sol featured render + 3-col 6 template grid + sağ 320w render queue (progress bar + status + ZIP indir) | Canvas `mockup` ile eşleşir; custom mockup upload modalı bu brief kapsamı dışı |
| **CP-9 checkpoint** | Selection + Mockup yeşil | Kapılar + görsel |
| **CP-FINAL** | Tüm onaylı ekran aileleri migre — Phase 3 girdisi hazır | Sistem katalog artboard'ları (Confirm + Empty + Skeleton) gerçek ekranlarda ürün davranışı olarak kanıtlanmış |

---

## 7. Riskli noktalar

Tasarımın koda taşınırken en kolay bozulduğu yerler. Her biri için **erken tespit mekanizması** + **çözüm yaklaşımı**:

### 7.1 Token sistemi bozulması

**Risk:** Mevcut `globals.css` HSL tuple'la yazılmış, spec `tokens.css` düz hex'le yazılmış. T-01'de geçiş sırasında renk değerleri "yakın ama aynı değil" duruma düşerse tüm palette canvas'tan kayar — sonraki her ekran o kaymayı taşır.

**Erken tespit:** T-01 bittikten sonra `primitives-demo` sayfası canvas `primitives` artboard'uyla yan yana açılır; **her token kendi adıyla etiketli** küçük bir swatch grid'i eklenir (`--color-bg`, `--color-surface`, `--color-accent`, …). Gözle karşılaştırma + pixel-by-pixel değil, ton kontrolü.

**Çözüm:** HSL'i koruyarak spec hex'lerine HSL'e çevrilmiş karşılığı yazılır; ya da düz hex'e geçilir (daha basit, `check-tokens`'a yük bindirmez). Karar: **düz hex**, çünkü spec de hex kullanıyor ve Tailwind `hsl(var(...))` sarmalayıcısı kod tarafında ek gürültü.

### 7.2 Density farkı silikleşmesi

**Risk:** Spec user panelini `p-6 gap-4` + body 14px, admin'i `p-4 gap-3` + body 13px diye net ayırıyor. İlk migrasyonlarda (T-18 Bookmarks user paneli) density hissi kurulur; ama T-24 admin Users'a gelince yanlışlıkla aynı padding kullanılırsa iki panel birbirine benzer, ton farkı kaybolur.

**Erken tespit:** PageShell `scope` prop'u (`"user" | "admin"`) her sayfada zorunlu olsun. Shell içinde `data-density` attribute'u set edilsin (`tokens.css`'teki `[data-density="admin"]` / `[data-density="user"]` selector'leri tüketilir). PageShell testinde bu attribute kontrol edilir.

**Çözüm:** CP-2 checkpoint'inde boş bir "admin" ve "user" test sayfası yan yana açılır; padding/gap/body size farkı gözle kontrol edilir. Fark hissedilmiyorsa density token'ları revize edilir, sonra ekran migrasyonuna geçilir.

### 7.3 Card ↔ Table ayrımının bulanıklaşması

**Risk:** Card primitive'inin `list` varyantı (yatay sıra + sol thumb + sağ meta) ile Table'ın satırı birbirine çok benzer. İlk bakışta "list card = table row" sanılır; sonra competitor top-reviewed tablosu hangi primitive'den gitmeli çelişkisi çıkar.

**Erken tespit:** T-12 (Card) ve T-17 (Table) birbirinden bağımsız ama bitiş testi ortak: primitives-demo sayfasında **aynı ekranda** iki örnek yan yana; biri list-card'la, diğeri Table row'la render edilsin. Hangi token farkı, hangi davranış farkı net görünsün.

**Karar kuralı:** 
- **Tablo** → veri yoğun, 5+ kolon, sort header, selected row, bulk action — admin ekranları, top-reviewed listing, audit logs.
- **List Card** → 2-3 kolon, mağaza kartı / job satırı / bildirim satırı gibi "bir kart içinde özet" tonunda — Competitors takipli mağaza, Dashboard son işler.

Bu kural `docs/design/implementation-notes/card-vs-table.md` altına yazılır.

### 7.4 Hover dilinin sürünmesi

**Risk:** Spec hover'ı üç katmanlı ama ölçülü tanımlıyor: border-strong + thumbnail-only scale-subtle + shadow 1→4. İlk birkaç kartta doğru uygulanır; sonra bir ekran "biraz daha belirgin olsun" diyerek scale'i kart kutusuna taşır, shadow'u kalınlaştırır, border rengini accent'e çeker. Bir sapma diğer ekranları kirletir.

**Erken tespit:** `Card` primitive'inde hover davranışı **prop değil**, component'ın kendi içinde sabit. Ekran Card'ın `interactive` prop'unu `true` yapar; hover dili Card'ın kendi class'larında. Ekran asla `hover:` sınıfı üzerine yazmaz.

**Çözüm:** `check-tokens` script'i ekran dosyalarında (`src/features/**/*.tsx`) `hover:scale-`, `hover:shadow-`, `hover:border-` pattern'lerini tarar; bulursa fail eder. Primitive dosyaları muaftır.

### 7.5 Skeleton / StateMessage / Badge tutarsızlığı

**Risk:** Spec bu üçünü spesifik şekilde kilitliyor:
- Skeleton **sade pulse**, 6 sabit / 5 sabit defaults
- StateMessage 3 tone + 40×40 ikon kutusu + 15/600 title
- Badge mono 11px + tracking 0.6 + **title-case** (uppercase uygulanmaz)

Ekran migrasyonunda biri "bu ekrana özel 4 kart skeleton gerek" der, diğeri "burada ikon kutusu 32×32 olsa daha hoş" der, üçüncüsü "bu badge title-case olsun". Spec disiplini ufalanır.

**Erken tespit:** Üç primitive'in de testi sadece anatomi değil, **default değerleri** de kilitliyor:
- `SkeletonCard()` (prop'suz) → 6 kart render etmeli (test)
- `SkeletonRow()` (prop'suz) → 5 satır render etmeli (test)
- `StateMessage` ikon slot'u sabit 40×40 class'larla dolu olmalı (snapshot test)
- `Badge` render'da **title-case korunmalı**, `text-transform` değeri `none` olmalı, font mono + 11px + tracking 0.6 olmalı (style test — input "Hazır" verildiğinde DOM text "Hazır" kalır)

**Çözüm:** Bu dört test T-09/T-10/T-07'ye **kabul kriteri olarak** eklenir. Herhangi biri bozulursa CP yeşil olmaz.

### 7.6 Mono font'un karışması

**Risk:** Spec "tarih, email, URL, score, kaynak domain'i mono" diyor. İlk ekranlarda doğru uygulanır; sonra bir geliştirici "şu kolonun sayısal değeri, mono olmasın daha hoş" der, tutarsızlık başlar.

**Erken tespit:** `Badge` ve mono meta için tek yardımcı sınıf: spec'teki `.eh-mono`. Ekran kodunda `font-mono` kullanılmaz; her mono metin `<span className="eh-mono">` ile sarmalanır veya `text-mono` adında tailwind utility `globals.css`'e eklenir. Tek kaynağa bağlanır.

**Çözüm:** T-01/T-02'de `font-mono` utility Tailwind config'inde `--font-mono` CSS variable'ına bağlanır; ekran kodu direkt `font-mono` kullanabilir. Ama hangi metnin mono olacağı konusunda `card-vs-table.md`'ye benzer bir `typography-grammar.md` notu yazılır: "mono = ne, sans = ne" net tanım.

### 7.7 Canvas referansının kaybolması

**Risk:** Migrasyon ilerledikçe geliştirici canvas'ı açmadan "hatırladığı kadarıyla" kod yazar. Spec'le kod arasındaki iki-yönlü bağ zayıflar.

**Erken tespit:** Her PR'ın açıklama şablonunda 3 zorunlu alan: (1) spec bölümü, (2) canvas artboard id'si, (3) sapma var mı. CP review sırasında bu alan boşsa PR bloklu.

**Çözüm:** Canvas HTML dosyasını `docs/design/EtsyHub/EtsyHub Design Language.html` yolundan değiştirmiyoruz; PR açıklamasında artboard adı yazılırsa reviewer aynı dosyadan açıp karşılaştırır. Claude Code bu karşılaştırmayı kendi review aşamasında yapar.

---

## Son söz

Bu brief onaylı tasarım dilinin **uygulama planı**, yeni bir yön değil. Primitive-first disiplini, user/admin aynı aile-farklı density kuralı, "yeni keşif yok" kapısı — üçü birden korunursa CP-FINAL'de kod canvas ile birebir konuşur.

Bir sonraki adım: bu brief'i gözden geçir, T-01'den başlamak için onay ver. Onay gelirse Claude Code ilk task'ı (T-01 Tokens) çekip başlar; her task sonunda kalite kapısı koşar, her checkpoint'te durur, review alır, devam eder.
