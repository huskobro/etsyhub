# Trend Stories — Ekran Migrasyonu Kararı

**Tarih:** 2026-04-25
**Bağlam:** CP-8 dalgası. T-36 (Trend feed) ve T-37 (Trend cluster
rail + drawer) primitive migrasyonu öncesi sözleşme kilidi.
**Status:** Kilitli.
**Wave kuralları (CP-8 taşıma):**
- Mikro grafik (sparkline / bar / progress) YASAK
- Yeni primitive YASAK (3. tüketim olmadan terfi yok — Toggle kuralı)
- Backend (prisma / API / scraper / cluster job) DOKUNULMAZ
- Karar dokümanı kod ÖNCESİ kilitlenir

## Canvas durumu

`docs/design/EtsyHub/screens.jsx` içinde **Trend Stories için ayrı
SCREEN yok.** Mevcut SCREEN'ler:

- SCREEN 1 Dashboard (içinde "Yükselen trendler" widget'ı 4 kart grid)
- SCREEN 2 Bookmarks
- SCREEN 3 Admin Users
- SCREEN 4 Login/Register

Yani T-35 için **yeni estetik keşif yapılmaz**; T-32 (Competitors)
kararıyla aynı çerçeve uygulanır:

- "Mevcut tasarım diline uyarlama" yaklaşımı
- Bookmarks paterni (Card grid + StateMessage) feed/drawer için taban
- Competitors paterni (PageShell + tablist) trend penceresi için taban
- Dashboard paterni (Card grid + Badge) cluster rail için taban

## Mevcut taban çizgisi (özet)

`src/features/trend-stories/components/`:
- `trend-stories-page.tsx` — manuel `<h1>` + `<p>`, manuel toast,
  WindowTabs + Rail + Feed + Drawer kompozisyonu
- `window-tabs.tsx` — manuel `role="tablist"` + `role="tab"`
  (`aria-controls` YOK — auth shell öncesi paterni; tabpanel YOK)
- `feed-listing-card.tsx` — manuel `<article rounded-md border>`
  (Card primitive **tüketmiyor**), thumb, title, store/review/date,
  TrendMembershipBadge, Kaynağı Aç + Bookmark butonları
- `trend-feed.tsx` — manuel skeleton grid, manuel empty/error,
  cursor sayfalama, "Daha fazla yükle" buton
- `trend-cluster-rail.tsx` — manuel skeleton + horizontal scroll grid,
  manuel empty/error
- `trend-cluster-card.tsx` — manuel `<button rounded-md border>`
  (Card primitive tüketmiyor), thumb, label, mağaza/ürün count
  pill'leri, SeasonalBadge + productType pill (`bg-accent/10`)
- `trend-cluster-drawer.tsx` — manuel modal-drawer (PromoteDialog
  paterni), header + stats grid + üye listesi + cursor sayfalama
- `seasonal-badge.tsx` — manuel `<span bg-warning/15>` (Badge
  primitive tüketmiyor; emoji + label)
- `trend-membership-badge.tsx` — manuel pill (Badge tüketmiyor)

## T-36 — Trend feed page kararı

### Yerleşim

`TrendStoriesPage` PageShell variant=default tüketir:
- `title="Trend Akışı"`
- `subtitle="Rakip mağazalardaki yeni listing'leri pencere bazında izle, kümelenmiş trendleri gör ve beğendiklerini Bookmark Inbox'a at."`
- `actions` slotu **boş** (manuel "yeni tarama" yok — feed otomatik
  scraper job'undan besleniyor; kullanıcı tetikleyici aksiyonu
  yok)
- `toolbar={<Toolbar>}` içinde **WindowTabs** yer alır

### WindowTabs — KILITLI KARAR (Competitors detail tab paterni)

WindowTabs **gerçek client tab** olarak kalır, route navigation
YAPILMAZ. `windowDays` filter state olarak kalır (mevcut
`useState`). Pencere değişimi rail + feed query param'ı senkron
günceller.

**Gerekçe (T-32 ile aynı):** Competitors detail tab kararıyla
semantik akrabalık var. WindowTabs aynı sayfada içerik filtresi —
auth tab gibi route nav DEĞİL. Mevcut `role="tablist"` + `role="tab"`
korunur, EKSİK olan ARIA tamamlanır:
- her tab `id={tabId}`
- her tab `aria-controls={panelId}`
- aktif panel `role="tabpanel"` + `aria-labelledby={activeTabId}` +
  `tabIndex={0}`
- T-34'teki `useId` paterni uygulanır

Tek aktif panel: rail + feed birlikte panel içeriği oluşturur (4
ayrı panel YAZILMAZ, T-34 paterni gibi tek görünür panel + aktif
tab id'sine bağlanır).

Klavye Arrow gez **opsiyonel** — Phase 2 a11y sweep carry-forward
(T-34 ile aynı).

### URL filter state — KARAR: HAYIR (T-34 carry-forward)

`?window=7` URL parametresi paylaşılabilir link için faydalı olur
ama Toolbar primitive `urlState` desteği yok. T-34 ile aynı
gerekçeyle ertelenir. Phase 5+'da Toolbar `urlState` slot
geldiğinde eklenir.

### Toast yerleşimi

Mevcut inline toast div KALIR (CP-5 ConfirmDialog scope dışı,
T-33/T-34 paterni). Toast primitive bu dalgada AÇILMAZ.

**Gereksinim:** Manuel `role="status"` div KORUNUR + üstüne T-33
paternindeki **GEÇİCİ yorum** eklenir. `bg-success/10` /
`bg-danger/10` opacity-utility → `bg-success-soft` / `bg-danger-soft`
semantik token (T-33/T-34 token disiplini).

### FeedListingCard primitive consumption

Mevcut `<article rounded-md border>` → **Card primitive sarması**
(T-15 Bookmarks paterni, T-33 CompetitorCard paterni). Card içinde:
- Thumb: mevcut `<img>` veya placeholder div KORU (Thumb primitive
  scope dışı; mevcut yapı zaten token-bound)
- Title: line-clamp-2 (mevcut)
- Meta satırı: store · review · firstSeenAt (mevcut)
- TrendMembershipBadge satırı: **Badge primitive'e taşınmaz** —
  mevcut `trend-membership-badge.tsx` `onOpenCluster` callback'i ile
  drawer açıyor; Badge primitive click event sözleşmesi yok. Yerel
  yardımcı kalır (Toggle paterni gibi: 3. tüketim olunca terfi).
  **Carry-forward:** Badge primitive `onClick` desteği aldığında
  TrendMembershipBadge → Badge.
- Footer: Kaynağı Aç (anchor styled, T-33 Detay link paterni) +
  `Bookmark'a ekle` Button (`variant="primary"`, `size="sm"`)

### Feed states

- Loading → `StateMessage tone="neutral"` (manuel 4'lü skeleton grid
  KALDIRILIR — T-33/T-34 tutarlılığı)
- Error → `StateMessage tone="error"`
- Empty → `StateMessage tone="neutral"` "Bu pencerede listing yok"
- "Daha fazla yükle" butonu → `Button variant="ghost" size="sm"`
  (mevcut anchor styled pattern Button primitive'ine geçer)

### Yasaklar (T-36 implementer için)

- Mikro grafik YASAK
- Yeni primitive YASAK (Card / Badge / Button / Toolbar / StateMessage
  / PageShell mevcut)
- TrendMembershipBadge → Badge migrasyonu YASAK (Badge `onClick`
  yok; carry-forward)
- SeasonalBadge → Badge migrasyonu YASAK (mevcut `bg-warning/15` ve
  emoji çözümü Badge primitive'i değiştirmeden taşınamaz; aynı
  carry-forward)
- WindowTabs → route navigation YASAK
- URL filter state YASAK (carry-forward)
- BulkActionBar tüketimi YASAK (aşağıda kapsam dışı bölümünde)
- Backend (prisma / API / scraper / cluster job) DOKUNULMAZ
- Mock data DEĞİŞMEZ

## T-37 — Trend cluster rail + drawer kararı

### TrendClusterRail yerleşim

Rail mevcut yatay-scroll grid'inde kalır:
- Header: `<h2>Trend Kümeleri</h2>` + `{N} küme` mono muted (mevcut)
- Grid: `flex gap-3 overflow-x-auto pb-2` (mevcut, dokunulmaz)
- States:
  - Loading → `StateMessage tone="neutral"` (manuel 4'lü skeleton
    horizontal grid KALDIRILIR — feed paterni)
  - Error → `StateMessage tone="error"`
  - Empty → `StateMessage tone="neutral"` "Bu pencerede trend kümesi
    henüz yok"

**Not:** Rail bağımsız bir PageShell tüketmez; sayfa kökünde
PageShell (T-36) tarafından sarmalanır. Rail tek başına bir
`<section>` olarak kalır.

### TrendClusterCard primitive consumption

Mevcut `<button rounded-md border>` → **Card primitive sarması**
(T-33 paterni). Card click davranışı:
- Card primitive `<button>` semantiğini desteklemiyorsa, Card
  içeriği aynı kalır ve tıklanabilir wrapper olarak `<button>`
  korunabilir VEYA Card `onClick` prop'u ile semantik korunur.
- **Karar:** Mevcut `<button>` semantiği kritik (klavye + ARIA);
  Card primitive `as="button"` desteği veya `<button>` içine Card
  içerik gömme tercih edilir. T-33'te Card `as="article"` kullandı
  → benzer şekilde `as="button"` tercih edilir; Card primitive bu
  prop'u destekliyorsa kullan, desteklemiyorsa **mevcut `<button>`
  KORUNUR + iç içerik elemanları (mağaza/ürün pill'leri,
  productType pill) Badge primitive'e geçer**.
- Implementer **kontrol et** (Card API'sini); destek varsa as="button",
  yoksa wrapper button + iç Badge migrasyonu.

İçerik:
- Thumb (mevcut img veya placeholder, dokunulmaz)
- Label (line-clamp-2, mevcut)
- Mağaza/Ürün count pill'leri → `Badge tone="neutral"` (mevcut
  `bg-surface-muted` pill'leri)
- SeasonalBadge → **dokunulmaz** (mevcut yerel pill, carry-forward)
- ProductType pill (`bg-accent/10 text-accent`) → `Badge tone="accent"`

### TrendClusterDrawer

Drawer **mevcut plain modal pattern KORUNUR** (PromoteDialog ile aynı
aile). CP-5 ConfirmDialog scope'u disclosure dialog'u kapsamıyor;
ayrı disclosure primitive ailesi geldiğinde terfi edilir.

**Mevcut yapı (dokunulmaz):**
- `role="dialog"` + `aria-modal="true"` + `aria-label="Trend kümesi detayı"`
- header (Kapat butonu) + scrollable body
- DrawerPage cursor sayfalama
- ClusterHeader (label + SeasonalBadge + productType pill + 3 stat)
- MemberRow (thumb + title + meta + Kaynağı Aç / silinmiş pill)

**Sınırlı dokunuşlar:**
- StatCard (3 kolon) → mevcut yapı KORUNUR; Card primitive tüketmek
  scope dışı (3 küçük inline stat; Card primitive granularity'i
  buraya uymaz, fazla ağır)
- ClusterHeader productType pill (`bg-accent/10`) → `Badge tone="accent"`
- MemberRow "Kaynak artık mevcut değil" pill (`bg-danger/10`) →
  `Badge tone="danger"` veya `bg-danger-soft` token migrasyonu
- MemberRow "Kaynağı Aç" anchor → mevcut styled anchor KORUNUR (T-33
  paterni)
- "Daha fazla yükle" buton → `Button variant="ghost" size="sm"`
- Loading "Küme yükleniyor…" → `StateMessage tone="neutral"`
- Error → `StateMessage tone="error"`
- Kapat butonu → `Button variant="ghost" size="sm"` (header'da)

### Yasaklar (T-37 implementer için)

- Mikro grafik YASAK
- Yeni primitive YASAK
- SeasonalBadge / TrendMembershipBadge dokunulmaz (carry-forward)
- TrendClusterDrawer modal-drawer yapısı dokunulmaz (disclosure
  ailesi scope dışı)
- StatCard inline yapısı dokunulmaz (Card primitive granularity'si
  uymaz)
- WindowTabs → route nav YASAK
- URL filter state YASAK
- BulkActionBar tüketimi YASAK (kapsam dışı)
- Backend (cluster job, dedupe service, scraper) DOKUNULMAZ
- Mock data DEĞİŞMEZ

## Kapsam dışı (carry-forward)

| Konu | Niye | Tetik |
|---|---|---|
| Toast primitive | 3+ ekran tüketimi olunca terfi (Toggle kuralı) | CP-9 / CP-10 |
| URL filter state (`?window=`) | Toolbar primitive `urlState` ihtiyacı | Phase 5+ |
| TrendMembershipBadge → Badge | Badge primitive `onClick` desteği yok | Badge `onClick` slot geldiğinde |
| SeasonalBadge → Badge | Badge primitive `tone="warning"` + emoji slot yok | Badge primitive emoji/icon slot geldiğinde |
| TrendClusterDrawer → Disclosure dialog ailesi | ConfirmDialog destructive aile; disclosure ayrı | Disclosure primitive ailesi geldiğinde |
| Klavye Arrow gez (WindowTabs) | A11y sweep | Phase 2 a11y |
| BulkActionBar (multi-select feed/cluster member) | **Şimdilik aday** — multi-select UX testi + 3+ ekran tüketimi sinyali olmadan açılmaz; T-37 cluster drawer'a şimdiden bağlanmaz | Multi-select UX testi + 3 ekran sinyali |
| StatCard primitive terfi | 3+ ekran inline stat tüketimi | Dashboard widgets dataset genişlediğinde (Phase 6+) |
| Card `as="button"` desteği | TrendClusterCard semantiği | Card primitive API genişlemesi |

### BulkActionBar adaylığı — KILITLI

BulkActionBar trend tarafında **kesin reuse değil**, yalnızca
aday. Aşağıdaki sinyallerden **ikisi** birleşmeden açılmaz:

1. Multi-select UX testi (kullanıcı testi: feed kartlarında
   multi-select ihtiyacı doğdu mu?)
2. 3+ ekran tüketim sinyali (Bookmarks + References + Trend
   feed/cluster — şu an yalnızca Bookmarks/References'ta var)

T-37 cluster drawer'da rail batch select için **şimdiden
bağlanmaz**. Cluster member'larında multi-select state modeli yok;
ihtiyaç doğmadan UI açılmaz (Toggle kuralı: 3. tüketime kadar
yalnızca yerel yardımcı).

## Yasaklar (T-36 + T-37 implementer için — birleşik)

- **Mikro grafik:** trend mağaza/ürün count için sparkline / trend
  line / bar yok. Yalnızca sayı + Badge.
- **Yeni primitive:** Card / Badge / Button / Toolbar / StateMessage
  / PageShell mevcut. Yeni primitive yazma.
- **Backend dokunma:** prisma, /api/trend-stories, /api/trend-clusters,
  scraper service, cluster job, dedupe service, queue job tipleri
  DOKUNULMAZ. Yalnızca UI migrasyonu.
- **WindowTabs → route nav:** YASAK. Client tab kalır.
- **TrendClusterDrawer rewrite:** Mevcut modal-drawer KALIR.
- **TrendMembershipBadge / SeasonalBadge rewrite:** Mevcut yerel
  yardımcı KORUNUR (carry-forward).
- **BulkActionBar tüketimi:** YASAK (şimdilik aday).
- **Mock data:** Mevcut query/mutation mock değişmez.

## Test sözleşmesi

### `tests/unit/trend-stories-page.test.tsx` (genişletme veya yeni)

Mevcut testleri korurken eklemeler:

1. PageShell tüketildi: title="Trend Akışı" + subtitle render
2. Toolbar slot'unda WindowTabs render (`role="tablist"` + 3 tab)
3. WindowTabs ARIA: her tab `id` + `aria-controls`; aktif panel
   `role="tabpanel"` + `aria-labelledby={activeTabId}` + `tabIndex=0`
4. Window değişince rail + feed query param senkron geçer
5. Toast: success → `role="status"` + GEÇİCİ yorum kod tarafında
   mevcut (kontrol için yorumun varlığını test etmek gerekmez —
   spec compliance review'da doğrulanır)
6. Toast `bg-success-soft` / `bg-danger-soft` semantik token (T-33
   paterni)

### `tests/unit/trend-feed.test.tsx` (genişletme)

1. FeedListingCard Card primitive tüketildi (mevcut `<article>` →
   Card)
2. Loading → StateMessage tone="neutral"
3. Empty → StateMessage "Bu pencerede listing yok"
4. Error → StateMessage tone="error"
5. "Daha fazla yükle" → Button variant ghost
6. Bookmark butonu → mutation çağrısı (mevcut)
7. TrendMembershipBadge KORUNDU (manuel pill, dokunulmadı)

### `tests/unit/trend-cluster-rail.test.tsx` (genişletme veya yeni)

1. TrendClusterCard Card primitive tüketildi (veya `<button>` +
   içerik Badge migrasyonu — Card API'sine bağlı)
2. Mağaza/Ürün count → Badge tone="neutral"
3. ProductType pill → Badge tone="accent"
4. SeasonalBadge KORUNDU (dokunulmadı)
5. Loading → StateMessage tone="neutral"
6. Empty → StateMessage "Bu pencerede trend kümesi henüz yok"
7. Error → StateMessage tone="error"
8. Click → onOpenCluster callback (mevcut)

### `tests/unit/trend-cluster-drawer.test.tsx` (genişletme)

1. Modal-drawer yapısı KORUNDU (`role="dialog"` + `aria-modal`)
2. Kapat butonu Button variant ghost
3. ClusterHeader productType pill → Badge tone="accent"
4. MemberRow "Kaynak artık mevcut değil" → Badge tone="danger" veya
   `bg-danger-soft`
5. "Daha fazla yükle" → Button variant ghost
6. Loading → StateMessage
7. Error → StateMessage tone="error"
8. StatCard inline yapısı KORUNDU (dokunulmadı)
9. SeasonalBadge KORUNDU

## Tetikleyici (kararı revize etmek için)

Aşağıdaki sinyallerden **ikisi** birleşince trend ekranları
yeniden açılır:

1. Listing analytics (review trendi, satış sinyali) → mikro grafik
   ihtiyacı
2. Multi-select UX testi → BulkActionBar açılır
3. Disclosure primitive ailesi → TrendClusterDrawer + AddCompetitor
   + PromoteDialog tek aileye geçer
4. URL filter state primitive desteği → Toolbar `urlState` slot →
   `?window=` paylaşılabilir link
5. Badge primitive `onClick` slot → TrendMembershipBadge → Badge
   migrasyonu

Tek başına biri scope açmaz; iki sinyal + UX testi gerekir.

Bu liste **kilitli**. T-36 + T-37 implementer'ı bu listeden sapmaz.
