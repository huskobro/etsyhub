# Competitors — Ekran Migrasyonu Kararı

**Tarih:** 2026-04-25
**Bağlam:** CP-8 dalgası. T-33 (Competitors list) ve T-34 (Competitor
detail) primitive migrasyonu öncesi sözleşme kilidi.
**Status:** Kilitli.
**Wave kuralları (CP-8 taşıma):**
- Mikro grafik (sparkline / bar / progress) YASAK
- Yeni primitive YASAK (3. tüketim olmadan terfi yok — Toggle kuralı)
- Backend (prisma / API / scraper sözleşmesi) DOKUNULMAZ
- Karar dokümanı kod ÖNCESİ kilitlenir

## Canvas durumu

`docs/design/EtsyHub/screens.jsx` içinde **Competitors için direction yok.**
SCREEN 1 Dashboard, SCREEN 2 Bookmarks, SCREEN 3 Admin Users, SCREEN 4
Login/Register var. Yani competitors için yeni bir tasarım keşfi yapılmaz;
**Bookmarks + Admin Users patern'leri tabanı oluşturur**:

- **List page (T-33):** Bookmarks paterni (PageShell + Toolbar + Card grid)
- **Detail page (T-34):** Bookmarks detay yok — Admin Users paterni
  (PageShell + breadcrumb + filtre toolbar + içerik bloğu) ve Bookmarks
  card grid'in karması.

## Mevcut taban çizgisi (özet)

`src/features/competitors/components/`:
- `competitor-list-page.tsx` — manuel `<input search>`, manuel toast,
  manuel `+ Rakip Ekle` button, manuel skeleton grid, AddCompetitorDialog
- `competitor-card.tsx` — manuel `<article rounded-md border>` (Card
  primitive **tüketmiyor**), Oto-tarama / Manuel pill, dl grid, Tara/Detay
- `competitor-detail-page.tsx` — manuel header + Link breadcrumb, manuel
  date-range tabs (`role="tab"` ama `aria-controls` yok — auth shell
  öncesi paterni), ReviewCountDisclaimer, listing grid, toast, dialog
- `listing-rank-card.tsx` — manuel `<article rounded-md border>` (Card
  tüketmiyor), rank pill + review pill, thumb, title, price/favori,
  Kaynağı Aç / Referans / Bookmark butonları
- `add-competitor-dialog.tsx` — diyalog (CP-5 ConfirmDialog değil; ayrı)
- `promote-to-reference-dialog.tsx` — productType picker dialog

## T-33 — Competitors list page kararı

### Yerleşim

PageShell (variant default) tüketilir:
- `title="Rakipler"`
- `subtitle="Etsy/Amazon mağazalarını takibe al, yeni listingleri analiz et."`
- `actions={<Button>+ Rakip Ekle</Button>}` (disclosure CTA, dialog açar)
- `toolbar={<Toolbar>}`
  - Search input (mağaza adı arama)
  - **Filter chips:** `Tümü` / `Oto-tarama` / `Manuel` (3 chip,
    Bookmarks Toolbar paterni)
  - `trailing` slot boş (filtre popover ileriye)

İçerik:
- `Card` primitive ile competitor grid (md:2 / lg:3 kolon, mevcut grid)
- `StateMessage` ile empty/loading/error (manuel skeleton + manuel empty
  div kaldırılır; Bookmarks paterni)
- `AddCompetitorDialog` mevcut, dokunulmaz (CP-5 ConfirmDialog değil —
  ayrı disclosure dialog, scope dışı)

### CompetitorCard primitive consumption

Mevcut `<article>` taban → `Card` primitive sarması (T-15 Bookmarks
paterni). Card içinde:
- Header: shopLabel + platform · etsyShopName + auto/manual `Badge`
  (success/neutral tone)
- Body: dl grid (Listing / Son tarama)
- Footer: Tara butonu (`Button variant="ghost"`) + Detay link
  (`Button variant="secondary"` veya Link styled as button)

Yeni primitive YOK. `Badge` + `Button` mevcut.

### Toast yerleşimi

Mevcut inline toast div kalır (CP-5 ConfirmDialog scope'u dışı).
Karar: Toast primitive bu dalgada AÇILMAZ. 3+ ekranda toast tüketimi
olduğunda ayrı dalgada terfi edilir. Şimdilik manuel `role="status"` div
korunur.

## T-34 — Competitor detail page kararı

### Tab semantiği — KILITLI KARAR

Date-range tabs (`30d` / `90d` / `365d` / `Tümü`) **gerçek client tab**
olarak kalır, route navigation YAPILMAZ.

**Gerekçe:** Auth tab semantiği (`<Link aria-current="page">` segmented
control) sayfa-bazlı navigasyon içindi (login ↔ register ayrı route).
Date-range filtre URL'e taşınmıyor (mevcut `useState`), aynı sayfada
listings query'si re-fetch oluyor. Bu pattern **route navigation
DEĞİL**, **filter state**.

Auth ile semantik akrabalık:
- Auth: route-bazlı segmented Link (`role="tab"` YOK, çünkü bu nav)
- Detail date-range: client-side filter (gerçek `role="tablist"` +
  `role="tab"` + `aria-controls` doğru, çünkü içerik aynı sayfada
  değişiyor)

**Gereksinim:** Mevcut `role="tablist"` + `role="tab"` korunur, EKSIK
olan `aria-controls` ve panel `role="tabpanel"` + `aria-labelledby`
TAMAMLANIR. Klavye desteği (ArrowLeft/ArrowRight) **opsiyonel** — MVP
için aria sözleşmesi yeterli, klavye gez Phase 2 a11y sweep'inde.

### Filtre URL'e taşımalı mı? — KARAR: HAYIR (carry-forward)

`?window=90d` URL parametresi paylaşılabilir link için faydalı olur ama:
- Kapsam genişler (Toolbar primitive değişir)
- Mevcut sayfa SSR + client query karması, useSearchParams entegrasyonu
  ek work

Carry-forward: "Competitor detail filtre URL paylaşımı" → ileride
Toolbar primitive `urlState` desteği geldiğinde (Phase 5+) eklenir.

### Yerleşim

PageShell:
- `title={shopLabel}`
- `subtitle={platform · etsyShopName · Mağazayı aç}` (mevcut)
- `actions={<Button>Yeni Tarama</Button>}`
- breadcrumb (`Rakipler · {shopLabel}`) PageShell `title` üstünde manuel
  nav olarak kalır (PageShell breadcrumb slot YOK, scope ekleme yapma)

Yapı:
1. Header bloğu (lastScan satırı dahil)
2. Date-range tabs (`role="tablist"` + tabpanel, KILITLI)
3. ReviewCountDisclaimer (mevcut, dokunulmaz)
4. Toast (manuel kalır)
5. Listing grid:
   - `ListingRankCard` → `Card` primitive sarması
   - Empty/loading/error → `StateMessage`
   - Grid layout (mevcut: md:2 / lg:3 / xl:4)

### ListingRankCard primitive consumption

Mevcut `<article>` → `Card`. Card içinde:
- Header: `Badge` (rank, accent tone) + `Badge` (review count, neutral)
- Thumb: `Thumb` veya `AssetImage` primitive (mevcut, T-15'te tüketildi)
- Title: line-clamp-2
- Price/favori meta satırı
- Footer: 3 buton — Kaynağı Aç (anchor styled as button ghost) /
  Referansa Taşı (`Button ghost`) / Bookmark Ekle (`Button primary`)

## Kapsam dışı (carry-forward)

| Konu | Niye | Tetik |
|---|---|---|
| Toast primitive | 3+ ekran tüketimi olunca terfi | CP-9 / CP-10 |
| URL filter state (`?window=`) | Toolbar primitive `urlState` ihtiyacı | Phase 5+ |
| AddCompetitorDialog → ConfirmDialog ailesi | Disclosure, destructive değil — ayrı diyalog ailesi gerekir | Disclosure primitive geldiğinde |
| Tab klavye gez (ArrowLeft/Right) | A11y sweep | Phase 2 a11y |
| Listing detail page | Etsy listing detay ayrı ekran | Phase 9 (Listing Builder) |
| BulkActionBar (multi-select listing) | Mevcut state modeli single-select; çoklu seçim ihtiyacı doğmadı | 3+ ekran multi-select kararı + UX testi |

## Yasaklar (T-33 + T-34 implementer için)

- **Mikro grafik:** rakip mağaza için sparkline / trend line / bar yok.
  Yalnızca sayı + Badge.
- **Yeni primitive:** Card / Badge / Button / Toolbar / Chip / Thumb /
  StateMessage / PageShell mevcut. Yeni primitive yazma. Toast = manuel
  div, Disclosure dialog = mevcut.
- **Backend dokunma:** prisma, /api/competitors, scraper service, queue
  job tipleri DOKUNULMAZ. Yalnızca UI migrasyonu.
- **Date-range tab → route nav:** YASAK. Client tab kalır.
- **AddCompetitorDialog rewrite:** Mevcut diyalog kalır. CP-8'de
  ConfirmDialog ailesine taşıma scope dışı.
- **Mock data:** Mevcut query/mutation mock değişmez. Test fixture
  düzeyi mevcut testlerle aynı.

## Test sözleşmesi

### `tests/unit/competitors-list-page.test.tsx` (yeni veya genişletme)
1. Header: title "Rakipler" + subtitle render
2. `+ Rakip Ekle` Button click → AddCompetitorDialog açılır
3. Search input → `useCompetitorsList` query `q` parametresi geçer
4. Filter chips: Tümü / Oto-tarama / Manuel — chip click filtre uygular
5. Loading → StateMessage skeleton render
6. Empty → StateMessage "Henüz rakip yok" mesajı
7. Items render → CompetitorCard grid
8. CompetitorCard: Tara button click → `onTriggerScan` çağrılır
9. CompetitorCard: Detay link `/competitors/{id}` href

### `tests/unit/competitor-detail-page.test.tsx`
1. Header: shopLabel, platform, lastScan satırı render
2. `Yeni Tarama` Button click → scan mutation
3. Date-range tabs: `role="tablist"` + tab `aria-controls={panelId}`
4. Tab click → `aria-selected` doğru, panel içerik değişir, listing
   query window param geçer
5. Tabpanel: `role="tabpanel"` + `aria-labelledby={tabId}`
6. ReviewCountDisclaimer render edilir
7. Loading / empty / error → StateMessage
8. ListingRankCard: rank Badge accent tone, review count Badge neutral
9. Bookmark Ekle button → bookmark mutation
10. Referansa Taşı button → PromoteDialog açılır

## Tetikleyici (kararı revize etmek için)

Aşağıdaki sinyallerden **ikisi** birleşince competitor ekranları
yeniden açılır:
1. Listing analytics (yorum sayısı trendi, satış sinyali) → mikro grafik
   ihtiyacı
2. Multi-store karşılaştırma → yeni "Compare" ekranı
3. Listing detail screen geldiğinde → ListingRankCard tıklama davranışı
   değişir
4. URL filter state primitive desteği → Toolbar `urlState` slot

Tek başına biri scope açmaz; iki sinyal + UX testi gerekir.

Bu liste **kilitli**. T-33 + T-34 implementer'ı bu listeden sapmaz.
