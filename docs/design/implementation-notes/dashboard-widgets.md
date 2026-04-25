# Dashboard — Widget Seti Kararı

**Tarih:** 2026-04-25
**Bağlam:** T-31 (Dashboard widget grid migrasyonu) öncesi, brief
carry-forward #2 gereği widget seti kod yazılmadan önce kilitlenir.
**Status:** Kilitli.
**Ek kural:** Mikro grafik (sparkline / bar chart / trend line) **YASAK**
(controller talimatı, CP-7 wave kuralı).

## Mevcut data ile canvas hedefi

Canvas direction (`docs/design/EtsyHub/screens.jsx` SCREEN 1, satır 4-115):
- Stat row: Bekleyen review · Hazır listing · Aktif job · Günlük hedef
- 2 kolon: Son işler (5 satır + thumb + status badge) | Review bekleyen
  (4 thumb grid + AI score badge + "Review queue'ya git" CTA)
- Yükselen trendler (4 thumb card grid + listing count)

Mevcut data (`src/app/(app)/dashboard/page.tsx`):
- Sayılar: `bookmark count` · `reference count` · `collection count` ·
  `job count` (hesaplanabilir)
- Listeler: son 5 bookmark / 5 reference / 5 collection / 5 job

## Karar — T-31 widget seti (kilitli)

### A. Stat row (4 kart)

| Slot | Etiket | Değer | Tone | Data kaynağı |
|---|---|---|---|---|
| 1 | Bookmark | `bookmarkCount` | neutral | Mevcut `db.bookmark.count` |
| 2 | Referans | `referenceCount` | neutral | Mevcut `db.reference.count` |
| 3 | Koleksiyon | `collectionCount` | neutral | Mevcut `db.collection.count` |
| 4 | Aktif job | `running + queued` count | accent | Mevcut `recentJobs.filter(s => s in [QUEUED, RUNNING]).length` |

**Canvas'ta var, T-31'de YOK:**
- "Bekleyen review" — Review modeli yok, AI Quality Review Phase 6'da
- "Hazır listing" — Listing modeli var ama dashboard'da listing count yok
- "Günlük hedef" — User profile'da hedef alanı yok
- "Trend" badge'i (her stat'ın altındaki +N veya % ibaresi) — historik
  veri snapshot'ı yok

Bu eksikler `docs/plans/dashboard-widgets-data-gaps.md` carry-forward'a
**T-31 commit'inde** yazılır (ayrı dosya değil, dashboard-widgets.md
yanına notlanır).

### B. İki kolon (1.4fr / 1fr)

**Sol — Son işler (Card primitive):**
- Mevcut `recentJobs` (5 satır)
- Her satır: job type + relativeTime + status badge (tone: QUEUED neutral,
  RUNNING accent, SUCCESS success, FAILED danger, CANCELLED neutral)
- Thumb yok (job'larda asset yok)
- Header: "Son işler" + sağda "son 24 saat" mono muted

**Sağ — Son referanslar (Card primitive):**
- Mevcut `recentReferences` (5 satır → 4 thumb grid'e indirilebilir)
- Canvas'ta "Review bekleyen" var; Review modeli olmadığı için **Son
  referanslar** yerleşimi (4 thumb grid + assetlinkleri)
- Asset thumb'ı `reference.bookmark?.assetId` üzerinden (mevcut data)
- Score badge yerleşimi yok (skor data yok)
- Footer CTA: "Referans havuzuna git" → `/references`

### C. Alt blok — Son koleksiyonlar (4 kart grid)

Canvas'taki "Yükselen trendler" yerleşimine sadık, ama trend data yok.
Yerine **Son koleksiyonlar** (mevcut `recentCollections`, max 4 kart):
- CollectionCard primitive (mevcut, T-16'da migre edildi)
- Her kart: thumb + name + bookmark/reference count

Carry-forward not: TrendCluster modeli + scraper job geldiğinde Yükselen
Trendler bu yerleşime taşınır; CollectionCard yerine TrendCard yazılır
(yeni primitive değil, varyant).

## Yasaklar (T-31 implementer için)

- **Mikro grafik:** sparkline / bar chart / trend line / progress bar
  (RolloutBar feature flag dışı kullanım YASAK). Sadece sayı + badge.
- **Yeni primitive:** Stat card için yeni primitive eklenmeyecek;
  `Card` + Tailwind layout yeterli.
- **Mock data:** "Bekleyen review", "Hazır listing", "Günlük hedef"
  uydurulmayacak. Stat row 4 yerine 4 mevcut metrik (bookmark/ref/coll/job).
- **DashboardQuickActions** mevcut — yerleşimi koru, baştan yazma.
- **Scope:** API/prisma/server endpoint dokunulmayacak. `dashboard/page.tsx`
  zaten server component; `Promise.all` query'leri korunur, sadece widget
  yerleşimi/visual değişir.

## Carry-forward (T-31 commit body'sinde inline)

T-31 commit'i şu eksikleri inline kayıt altına alır:
- Bekleyen review metric → AI Quality Review (Phase 6) tetikler
- Hazır listing metric → Listing model count + status filter (Phase 9)
- Günlük hedef → User profile `dailyTarget` alanı (Phase 10+ admin
  hardening)
- Stat trend badge'leri → günlük snapshot tablosu (`DailyMetric`)
- Yükselen trendler → `TrendCluster` model + scraper (Phase 4)
- Review queue thumb grid + AI score → `DesignReview` model (Phase 6)

Tetikleyici: Phase 6 (AI Review) + Phase 4 (Trend) eş zamanlı yeşil olunca
Dashboard ikinci-tur migrasyonu açılır; o sprintte stat row 4 → 4-yeni
metrik, yükselen trendler `TrendCard`'a döner.

## Test sözleşmesi

`tests/unit/dashboard-page.test.tsx` (T-31'de yazılır):
1. 4 stat kart render (bookmark/referans/koleksiyon/aktif job sayıları)
2. "Aktif job" stat'ı QUEUED + RUNNING sayar (FAILED hariç)
3. Son işler kartı: 5 satır, status badge tone doğru
4. Son referanslar kartı: 4 thumb grid (5'ten az ise eksik thumb yer
   tutucu)
5. Son koleksiyonlar grid: 4 kart, CollectionCard primitive tüketildi
6. DashboardQuickActions korundu (regresyon)
7. Empty state: tüm sayılar 0 ise 4 kart 0 gösterir, listeler "henüz
   yok" mesajları

Bu liste **kilitli**. T-31 implementer'ı bu listeden sapmaz.
