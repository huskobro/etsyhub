# Phase 4 — Trend Stories Implementation Plan

> **Dil kuralı:** Kullanıcıyla tüm iletişim **Türkçe**. Açıklamalar, plan adımları, status güncellemeleri Türkçe; kod/dosya adları/enum/teknik terimler İngilizce. Diacritic'ler (ç, ğ, ı, ö, ş, ü) eksiksiz.

> **Ajan çalıştırıcılar için:** `superpowers:subagent-driven-development` veya `superpowers:executing-plans` skill'i ile task-by-task uygula. Adımlar `- [ ]` checkbox. Her task sonunda typecheck + lint + `check:tokens` + test + commit.

**Hedef:** Rakip Etsy mağazalarından toplanan competitor listing verisini kullanıcıya pencere (Bugün / 7G / 30G) bazlı trend akışı ve n-gram tabanlı trend cluster detection ile sunmak. `/trend-stories` ekranı Phase 4'te user-facing hale gelir; `trend_stories.enabled` flag açılır. Bookmark akışı trend cluster context'i ile zenginleşir.

**Mimari özet:** Phase 3'te kurulu `CompetitorListing` tablosu ana veri kaynağıdır. Yeni `TrendCluster` + `TrendClusterMember` materialized tabloları per-user recompute ile `TREND_CLUSTER_UPDATE` worker'ı tarafından doldurulur. Worker scrape job SUCCESS branch'inde merkezi helper (`enqueueTrendClusterUpdate`) ile debounce + aktif job kontrolü arkasından tetiklenir. API `/api/trend-stories/**` user-scoped + iki flag gate (`trend_stories.enabled` + `competitors.enabled`) ile korunur. UI `/trend-stories` sayfası rail (cluster) + feed (listing) iki katmanlı görünümle çalışır.

**Tech stack (yeni eklenen):** Prisma migration (TrendCluster, TrendClusterMember, Bookmark alanları), yeni worker (`TREND_CLUSTER_UPDATE`), yeni feature klasörü `src/features/trend-stories/`, yeni API klasörü `src/app/api/trend-stories/`, yeni nav entry aktivasyonu.

---

## Context

### Neden

Phase 3'te rakip mağaza tarama altyapısı kuruldu: `CompetitorListing` kayıtları `firstSeenAt`, `lastSeenAt`, `listingCreatedAt`, `latestReviewAt` alanlarıyla tarih zenginliğine sahip. Ama kullanıcı şu an bu veriyi yalnızca rakip-bazlı listeleme olarak görüyor. Trend Stories Phase 4'te:

- Aynı konu birden fazla mağazada tekrarlıyorsa "trend kümesi" sinyali ver.
- Son 1/7/30 gündeki "yeni" listingleri story/card akışı olarak sun.
- Kullanıcı bu akıştan bookmark'a taşıyıp ileride varyasyon üretimine (Phase 5) hazırlık yapabilsin.

### Phase 4 Kapsamı

Bu plan yalnızca **Phase 4 (Trend Stories + Trend Cluster Detection)**'ü uygular. Kalan phase'ler kendi planlarında ele alınır.

Phase 4'te **aktifleşen**:
- `/trend-stories` ekranı (rail + feed + drawer)
- Window tabs: Bugün / 7G / 30G
- Trend cluster detection (n-gram tabanlı + overlap pruning)
- Seasonal keyword hafif zenginleştirme
- Bookmark mutation → `trendClusterId` + snapshot alanları
- `trend_stories.enabled` flag `true`

Phase 4'te **aktifleşmeyen** (Phase 5+):
- Embedding tabanlı cluster merge
- Admin seasonal registry UI
- Batch cluster-level bookmark
- Cluster archive admin UI
- Cross-user/global trend leaderboard
- SSE real-time cluster update
- Trend Stories → varyasyon akışı (Phase 5)

### Kritik Kurallar (CLAUDE.md + Phase 3 carry-forward)

- **Dil:** Türkçe iletişim + hata mesajları; kod İngilizce.
- **Token kuralı:** Raw hex (`#ff0000`), arbitrary value (`bg-[#ff0000]`, `w-[432px]`), inline `style={{...}}` yasak. Token scale Tailwind (`p-4`, `bg-accent`, `rounded-md`) serbest.
- **Auth & Data Isolation:** Her trend endpoint `requireUser()` + `userId` filtre. `TrendCluster.userId` + `TrendClusterMember.userId` denormalize; iki seviyede de izolasyon test edilir.
- **Feature gate merkezi:** `assertTrendStoriesAvailable()` tek noktada `trend_stories.enabled` + `competitors.enabled` iki flag'ı kontrol eder; biri kapalıysa `NotFoundError` (id enumeration önlemi). Tüm trend API route'ları bu helper'ı ilk satırda çağırır.
- **Enum kullanımı:** Prisma enum kod içinde typed import (`TrendClusterStatus.ACTIVE`). Zod API payload şemaları hariç çıplak string yasak.
- **Trend enqueue hatası scrape'i etkilemez:** `scrape-competitor.worker.ts` SUCCESS branch'inde `try/catch` ile `enqueueTrendClusterUpdate(userId)`; hata warning log + `CompetitorScan.metadata.trendEnqueueError` not, scrape SUCCESS kalır. Regression test zorunlu.
- **Worker enqueue merkezi:** `src/features/trend-stories/services/trend-update-scheduler.ts > enqueueTrendClusterUpdate(userId)` tek giriş noktası; ham `enqueue(JobType.TREND_CLUSTER_UPDATE, ...)` çağrısı yasak.
- **Debounce sırası:** önce aktif QUEUED/RUNNING job kontrol → sonra son 60sn SUCCESS debounce. İki kontrolden biri true ise enqueue atlanır, warning log düşer.
- **Snapshot lock:** Bookmark'a `trendClusterId` yazıldığında `trendClusterLabelSnapshot` + `trendWindowDaysSnapshot` aynı anda yazılır. Cluster sonradan STALE/ARCHIVED olsa bile bookmark trend izini korur.
- **Cursor kararlılığı:** `membersCursor` için `CompetitorListing.firstSeenAt DESC, CompetitorListing.id DESC` birleşik cursor kullanılır; `TrendClusterMember.id` cursor yasak (recompute member row'unu silip yeniden oluşturabilir → cursor kararsızlaşır).

### Phase 4 Final Beklenen Davranış

1. User `/trend-stories` açar. İki flag da açık değilse 404 görür.
2. Varsayılan pencere 7G. Tab değişimi URL query param'a yazılır (`?window=7`).
3. Üstte "Trend Kümeleri" rail: cluster kartları `clusterScore DESC` sıralı; her kart label, storeCount, memberCount, seasonalTag rozeti, hero thumbnail gösterir.
4. Altta "Yeni Listingler" feed: pencereye giren `CompetitorListing` kayıtları `firstSeenAt DESC` sıralı, her kart gerekirse `trendMembershipHint` rozeti (tekil cluster badge).
5. Cluster kartı tıklanınca drawer açılır: cluster label, member listeler (pagination-ready), hero listing detay, seasonalTag, productType.
6. Feed kartından bookmark → modal `trendClusterId` ve snapshot otomatik yazılır.
7. Scrape job her SUCCESS sonrası `TREND_CLUSTER_UPDATE` tetiklenir (debounce'lu). Worker user-scoped full recompute yapar.
8. Admin `POST /api/admin/trend-clusters/recompute?userId=...` ile manuel tetikleyebilir (audit log yazar).
9. `npm run test:all` yeşil, manifest grep temiz, data isolation integration testi geçer.

---

## Kaynaklar

- Phase 3 planı: `docs/plans/phase3-competitor-analysis.md`
- Phase 3 notları: `docs/plans/phase3-notes.md`
- CLAUDE.md: `/Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub/CLAUDE.md`
- Nav config: `src/features/app-shell/nav-config.ts` (satır 29, `phase: 4, enabled: false` — bu plan `true` yapar).
- Mevcut Prisma modelleri: `CompetitorStore`, `CompetitorListing`, `CompetitorScan`, `Bookmark`, `ProductType`, `FeatureFlag`, `JobType.TREND_CLUSTER_UPDATE` (enum var, worker yok).

---

## Dosya Yapısı (Phase 4 sonunda)

```
EtsyHub/
├── prisma/
│   ├── schema.prisma                                  # TrendCluster + TrendClusterMember + Bookmark alanları
│   └── migrations/<ts>_add_trend_clusters/            # yeni migration
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   └── trend-stories/page.tsx                 # yeni sayfa (user)
│   │   └── api/
│   │       ├── trend-stories/
│   │       │   ├── clusters/route.ts                  # GET list
│   │       │   ├── clusters/[id]/route.ts             # GET detail + membersCursor
│   │       │   └── feed/route.ts                      # GET feed
│   │       └── admin/
│   │           └── trend-clusters/recompute/route.ts  # POST manuel tetik (admin)
│   ├── features/
│   │   └── trend-stories/
│   │       ├── components/
│   │       │   ├── trend-stories-page.tsx
│   │       │   ├── window-tabs.tsx
│   │       │   ├── trend-cluster-rail.tsx
│   │       │   ├── trend-cluster-card.tsx
│   │       │   ├── trend-cluster-drawer.tsx
│   │       │   ├── trend-feed.tsx
│   │       │   ├── feed-listing-card.tsx
│   │       │   ├── seasonal-badge.tsx
│   │       │   └── trend-membership-badge.tsx
│   │       ├── queries/
│   │       │   ├── use-clusters.ts
│   │       │   ├── use-cluster-detail.ts
│   │       │   └── use-feed.ts
│   │       ├── services/
│   │       │   ├── cluster-service.ts                 # pure clusterListings() + DB upsert
│   │       │   ├── feature-gate.ts                    # assertTrendStoriesAvailable()
│   │       │   ├── trend-update-scheduler.ts          # enqueueTrendClusterUpdate()
│   │       │   ├── feed-service.ts                    # listing feed + trendMembershipHint resolve
│   │       │   ├── normalize.ts                       # normalizeForSimilarity + normalizeForProductType
│   │       │   ├── product-type-derive.ts             # deriveProductTypeKey()
│   │       │   ├── seasonal-detect.ts                 # detectSeasonalTag()
│   │       │   └── members-cursor.ts                  # encode/decode birleşik cursor
│   │       ├── constants.ts                           # WINDOW_DAYS, pencere-eşik haritası
│   │       ├── seasonal-keywords.ts                   # keyword + tarih aralığı sözlüğü
│   │       ├── stop-words.ts                          # signature stop-word seti
│   │       ├── product-type-keywords.ts               # productType sinyal sözlüğü
│   │       └── schemas/
│   │           └── index.ts                           # Zod input şemaları
│   ├── server/
│   │   └── workers/
│   │       ├── bootstrap.ts                           # TREND_CLUSTER_UPDATE handler kaydı
│   │       ├── trend-cluster-update.worker.ts         # yeni worker
│   │       └── scrape-competitor.worker.ts            # SUCCESS branch'e enqueueTrendClusterUpdate try/catch
│   └── features/
│       ├── app-shell/nav-config.ts                    # `/trend-stories` enabled: true
│       └── bookmarks/
│           ├── schemas/index.ts                       # bookmarkListingInput → trendClusterId?
│           └── services/bookmark-service.ts           # snapshot yazımı + cluster sahiplik kontrol
└── tests/
    ├── unit/
    │   ├── trend-cluster-listings.test.ts             # pure clusterListings()
    │   ├── trend-normalize.test.ts                    # iki normalize fonksiyonu
    │   ├── trend-product-type-derive.test.ts
    │   ├── trend-seasonal-detect.test.ts
    │   ├── trend-membership-hint.test.ts              # tekil seçim kuralı 4 katman
    │   └── trend-members-cursor.test.ts               # encode/decode + kararlılık
    ├── integration/
    │   ├── trend-cluster-worker.test.ts               # user-scoped full recompute + STALE geçişi
    │   ├── trend-scrape-regression.test.ts            # enqueue fail → scrape SUCCESS kalır
    │   ├── api-trend-stories.test.ts                  # 3 endpoint + flag kombinasyonları
    │   ├── api-trend-data-isolation.test.ts
    │   ├── api-trend-cluster-detail-partial.test.ts   # drawer partial/empty state
    │   └── bookmark-trend-snapshot.test.ts
    └── e2e/
        └── trend-stories-flow.spec.ts
```

---

## Veri Modeli (Prisma)

> **Not:** Aşağıdaki alanlar `prisma/schema.prisma`'ya eklenir; mevcut modellerin (`Bookmark`, `CompetitorListing`, `User`, `ProductType`) relation blokları da güncellenir. Migration adı: `add_trend_clusters`.

```prisma
enum TrendClusterStatus {
  ACTIVE
  STALE
  ARCHIVED
}

model TrendCluster {
  id                    String               @id @default(cuid())
  userId                String
  user                  User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  signature             String               // normalize edilmiş n-gram imzası (token order korunur)
  label                 String               // UI'a gösterilecek okunabilir etiket
  productTypeId         String?
  productType           ProductType?         @relation(fields: [productTypeId], references: [id], onDelete: SetNull)
  productTypeSource     String?              // "keyword_match" | "member_majority" | null
  productTypeConfidence Int?                 // 0-100
  windowDays            Int                  // 1 | 7 | 30
  memberCount           Int                  @default(0)
  storeCount            Int                  @default(0)
  totalReviewCount      Int                  @default(0)
  latestMemberSeenAt    DateTime?
  heroListingId         String?
  heroListing           CompetitorListing?   @relation("TrendClusterHero", fields: [heroListingId], references: [id], onDelete: SetNull)
  seasonalTag           String?              // "christmas" | "halloween" | null
  status                TrendClusterStatus   @default(ACTIVE)
  clusterScore          Int                  @default(0) // pre-compute edilmiş rank (performans)
  computedAt            DateTime             @default(now())

  members               TrendClusterMember[]
  bookmarks             Bookmark[]

  @@unique([userId, signature, windowDays])
  @@index([userId, status, latestMemberSeenAt(sort: Desc)])
  @@index([userId, windowDays, clusterScore(sort: Desc)])
}

model TrendClusterMember {
  id        String             @id @default(cuid())
  clusterId String
  cluster   TrendCluster       @relation(fields: [clusterId], references: [id], onDelete: Cascade)
  listingId String
  listing   CompetitorListing  @relation(fields: [listingId], references: [id], onDelete: Cascade)
  userId    String             // denormalize (cluster'ın userId'si)
  addedAt   DateTime           @default(now())

  @@unique([clusterId, listingId])
  @@index([listingId])
  @@index([userId, clusterId])
  @@index([userId, listingId])
}
```

**Mevcut modellere eklenecek relation bloklar:**

```prisma
// model User'a:
trendClusters   TrendCluster[]

// model CompetitorListing'e:
trendMembers    TrendClusterMember[]
heroOfClusters  TrendCluster[]        @relation("TrendClusterHero")

// model ProductType'a:
trendClusters   TrendCluster[]

// model Bookmark'a:
trendClusterId              String?
trendCluster                TrendCluster?  @relation(fields: [trendClusterId], references: [id], onDelete: SetNull)
trendClusterLabelSnapshot   String?
trendWindowDaysSnapshot     Int?

@@index([trendClusterId])
```

---

## Clusterlama Algoritması (Özet)

> Detay kod Task 3'te üretilir. Aşağıdaki kurallar spec niteliğindedir.

**1. Pencere eşikleri (`constants.ts`):**
```ts
export const WINDOW_DAYS = [1, 7, 30] as const;
export const WINDOW_THRESHOLDS: Record<number, { minStore: number; minListing: number }> = {
  1:  { minStore: 2, minListing: 2 }, // "Bugün" sekmesinin boş kalmasını engeller
  7:  { minStore: 2, minListing: 3 },
  30: { minStore: 2, minListing: 3 },
};
```

**2. Normalize (`normalize.ts`):**
```ts
// similarity için: punctuation temiz, whitespace tek, lowercase, stop-word çıkar
normalizeForSimilarity(title): string[]  // tokens

// productType derive için: punctuation temiz, whitespace tek, lowercase; stop-word ÇIKARILMAZ
normalizeForProductType(title): string[]
```

**3. N-gram üretimi:** 2-gram + 3-gram (1-gram atılır, çok geniş; 4-gram çok dar). Token order **korunur** (sorted signature yasak — "wall art print" ≠ "print wall art" karışımını önler).

**4. Signature:** `tokens.slice(i, i + n).join(" ")`. `(userId, signature, windowDays)` unique.

**5. Aday cluster toplama:** Her n-gram için hangi listingler üye. Dinamik eşiği (minStore + minListing) geçenler cluster adayı.

**6. Overlap pruning:** İki cluster arasında `|A ∩ B| / min(|A|, |B|) ≥ 0.80` ise güçlüyü tut:
- birinci kriter: `storeCount` ↓
- ikinci: `totalReviewCount` ↓
- üçüncü: signature token sayısı (3-gram 2-gram'e göre daha spesifik → tercih)
- dördüncü: alphabetical

**7. Cluster score (pre-compute):**
```ts
clusterScore = storeCount * 3
             + Math.round(Math.log10(totalReviewCount + 1) * 2)
             + memberCount * 1
             + recencyBoost;  // latestMemberSeenAt son 3 gün ise +5, son 7 gün +2
```

**8. Pure function imzası:**
```ts
// cluster-service.ts
export type ClusterCandidate = {
  signature: string;
  label: string;
  memberListingIds: string[];
  storeCount: number;
  memberCount: number;
  totalReviewCount: number;
  latestMemberSeenAt: Date | null;
  heroListingId: string | null;
  productTypeKey: string | null; // FK outer layer'da resolve edilir
  seasonalTag: string | null;
  clusterScore: number;
};

export function clusterListings(input: {
  listings: CompetitorListingForCluster[];
  windowDays: 1 | 7 | 30;
  today: Date;
}): ClusterCandidate[];
```

Pure fonksiyon DB bilmez. FK resolve (`productTypeId`) ve upsert outer service katmanında yapılır.

---

## Task Listesi

### Task 1: Prisma Migration — TrendCluster + TrendClusterMember + Bookmark alanları

**Dosyalar:**
- Modify: `prisma/schema.prisma` (yukarıdaki veri modeli bloğu)
- Create: `prisma/migrations/<ts>_add_trend_clusters/migration.sql` (prisma generate edecek)

- [ ] **Adım 1:** `prisma/schema.prisma` dosyasına yukarıdaki veri modeli bloğunu ekle (TrendClusterStatus enum, TrendCluster model, TrendClusterMember model, Bookmark/CompetitorListing/ProductType/User relation ekleri).

- [ ] **Adım 2:** Migration üret.

```bash
npx prisma migrate dev --name add_trend_clusters
```

Beklenen: `prisma/migrations/<ts>_add_trend_clusters/` oluştu, DB güncel, `@prisma/client` yeni tipleri yayınladı.

- [ ] **Adım 3:** Typecheck.

```bash
npm run typecheck
```

Beklenen: PASS (yeni tipler relation eklemeleri sayesinde çözülür).

- [ ] **Adım 4:** Commit.

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): trend cluster + member models + bookmark trend snapshot fields"
```

---

### Task 2: Constants, Stop-Words, Seasonal Keywords, ProductType Keywords

**Dosyalar:**
- Create: `src/features/trend-stories/constants.ts`
- Create: `src/features/trend-stories/stop-words.ts`
- Create: `src/features/trend-stories/seasonal-keywords.ts`
- Create: `src/features/trend-stories/product-type-keywords.ts`

- [ ] **Adım 1:** `constants.ts`.

```ts
export const WINDOW_DAYS = [1, 7, 30] as const;
export type WindowDays = (typeof WINDOW_DAYS)[number];

export const WINDOW_THRESHOLDS: Record<WindowDays, { minStore: number; minListing: number }> = {
  1: { minStore: 2, minListing: 2 },
  7: { minStore: 2, minListing: 3 },
  30: { minStore: 2, minListing: 3 },
};

export const OVERLAP_PRUNE_THRESHOLD = 0.8;
export const FEED_PAGE_SIZE = 40;
export const CLUSTER_MEMBERS_PAGE_SIZE = 30;
export const DEBOUNCE_WINDOW_MS = 60_000;
export const MAX_CLUSTER_MEMBERS_SCAN = 500; // güvenlik tavanı
```

- [ ] **Adım 2:** `stop-words.ts` — İngilizce + POD context (digital, download, printable, art, poster stop değil; "for", "and", "with", "your", "gift" stop).

```ts
export const STOP_WORDS = new Set<string>([
  "a","an","the","and","or","for","with","of","in","on","to","by","from","at","as",
  "your","you","my","our","their","his","her","its",
  "is","are","was","be","been","being",
  "this","that","these","those",
  "gift","gifts","idea","ideas","set","sets","pack","bundle","instant",
  "svg","png","jpg", // format tokenları signature'dan atılır (ayrı sinyal)
]);
```

- [ ] **Adım 3:** `seasonal-keywords.ts` — label + tarih aralığı (month-day bazlı).

```ts
export type SeasonalRule = {
  tag: string;
  keywords: string[];   // hepsi lowercase
  startMonth: number;   // 1-12
  startDay: number;
  endMonth: number;
  endDay: number;
};

export const SEASONAL_RULES: SeasonalRule[] = [
  { tag: "christmas",   keywords: ["christmas","xmas","santa","holiday","winter"], startMonth: 10, startDay: 15, endMonth: 12, endDay: 31 },
  { tag: "halloween",   keywords: ["halloween","spooky","pumpkin","ghost"],        startMonth: 9,  startDay: 1,  endMonth: 10, endDay: 31 },
  { tag: "valentines",  keywords: ["valentine","valentines","love","heart"],       startMonth: 1,  startDay: 15, endMonth: 2,  endDay: 14 },
  { tag: "mothers_day", keywords: ["mothers day","mom","mama"],                    startMonth: 4,  startDay: 1,  endMonth: 5,  endDay: 15 },
  { tag: "fathers_day", keywords: ["fathers day","dad","papa"],                    startMonth: 5,  startDay: 15, endMonth: 6,  endDay: 20 },
  { tag: "thanksgiving",keywords: ["thanksgiving","turkey","fall","autumn"],       startMonth: 10, startDay: 15, endMonth: 11, endDay: 30 },
  { tag: "easter",      keywords: ["easter","bunny","spring"],                     startMonth: 3,  startDay: 1,  endMonth: 4,  endDay: 20 },
  { tag: "back_to_school", keywords: ["back to school","teacher","classroom"],     startMonth: 7,  startDay: 15, endMonth: 9,  endDay: 15 },
];
```

- [ ] **Adım 4:** `product-type-keywords.ts` — `ProductType.key` → keyword eşleşme sözlüğü (derive için ham başlık üzerinde çalışır).

```ts
export const PRODUCT_TYPE_KEYWORDS: Record<string, string[]> = {
  canvas:    ["canvas"],
  wall_art:  ["wall art","poster","print"],
  printable: ["printable","digital download","instant download"],
  clipart:   ["clipart","clip art","png pack","svg bundle"],
  sticker:   ["sticker","decal"],
  tshirt:    ["t-shirt","tshirt","tee"],
  hoodie:    ["hoodie","sweatshirt"],
  dtf:       ["dtf","dtf transfer","dtf print"],
};
```

- [ ] **Adım 5:** Commit.

```bash
git add src/features/trend-stories/constants.ts src/features/trend-stories/stop-words.ts src/features/trend-stories/seasonal-keywords.ts src/features/trend-stories/product-type-keywords.ts
git commit -m "feat(trend-stories): constants, stop-words, seasonal + product-type keyword dictionaries"
```

---

### Task 3: Normalize + ProductType Derive + Seasonal Detect (Pure Functions + Unit Tests)

**Dosyalar:**
- Create: `src/features/trend-stories/services/normalize.ts`
- Create: `src/features/trend-stories/services/product-type-derive.ts`
- Create: `src/features/trend-stories/services/seasonal-detect.ts`
- Test: `tests/unit/trend-normalize.test.ts`, `trend-product-type-derive.test.ts`, `trend-seasonal-detect.test.ts`

- [ ] **Adım 1: Failing test — `trend-normalize.test.ts`.**

```ts
import { describe, expect, it } from "vitest";
import { normalizeForSimilarity, normalizeForProductType } from "@/features/trend-stories/services/normalize";

describe("normalizeForSimilarity", () => {
  it("lowercase + punctuation temizliği + stop-word atar", () => {
    expect(normalizeForSimilarity("Boho Wall Art for Your Home!!!"))
      .toEqual(["boho","wall","art","home"]);
  });
  it("tek boşluğa indirger, token order korur", () => {
    expect(normalizeForSimilarity("  Wall   Art   Boho  "))
      .toEqual(["wall","art","boho"]);
  });
  it("format token'larını (svg/png/jpg) atar", () => {
    expect(normalizeForSimilarity("Boho PNG Pack SVG"))
      .toEqual(["boho"]);
  });
});

describe("normalizeForProductType", () => {
  it("stop-word'leri ATMAZ — productType derive için ham sinyal korunur", () => {
    expect(normalizeForProductType("Wall Art for Your Home"))
      .toEqual(["wall","art","for","your","home"]);
  });
});
```

Çalıştır: FAIL (modül yok).

- [ ] **Adım 2:** `normalize.ts` implementation.

```ts
import { STOP_WORDS } from "@/features/trend-stories/stop-words";

function baseTokens(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function normalizeForSimilarity(input: string): string[] {
  return baseTokens(input).filter((t) => !STOP_WORDS.has(t));
}

export function normalizeForProductType(input: string): string[] {
  return baseTokens(input);
}
```

Test PASS.

- [ ] **Adım 3: Failing test — `trend-product-type-derive.test.ts`.**

```ts
import { describe, expect, it } from "vitest";
import { deriveProductTypeKey } from "@/features/trend-stories/services/product-type-derive";

describe("deriveProductTypeKey", () => {
  it("tek güçlü keyword eşleşmesi döner", () => {
    expect(deriveProductTypeKey(["Boho Canvas Print"]))
      .toEqual({ key: "canvas", source: "keyword_match", confidence: expect.any(Number) });
  });
  it("multi-word keyword (digital download) eşleşir", () => {
    const r = deriveProductTypeKey(["Minimalist Printable Wall Art — Instant Download"]);
    expect(r?.key).toBe("printable");
  });
  it("hiç eşleşme yoksa null", () => {
    expect(deriveProductTypeKey(["Random Thing"]))
      .toBeNull();
  });
  it("çoğunluk oyu — 3 listing 2'si canvas 1'i sticker → canvas", () => {
    const r = deriveProductTypeKey([
      "Boho Canvas Art",
      "Minimalist Canvas Print",
      "Cute Sticker",
    ]);
    expect(r?.key).toBe("canvas");
    expect(r?.source).toBe("member_majority");
  });
});
```

- [ ] **Adım 4:** `product-type-derive.ts` implementation.

```ts
import { normalizeForProductType } from "./normalize";
import { PRODUCT_TYPE_KEYWORDS } from "@/features/trend-stories/product-type-keywords";

export type ProductTypeDerivation = {
  key: string;
  source: "keyword_match" | "member_majority";
  confidence: number;
};

export function deriveProductTypeKey(memberTitles: string[]): ProductTypeDerivation | null {
  if (memberTitles.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const title of memberTitles) {
    const haystack = normalizeForProductType(title).join(" ");
    for (const [key, keywords] of Object.entries(PRODUCT_TYPE_KEYWORDS)) {
      if (keywords.some((kw) => haystack.includes(kw))) {
        counts[key] = (counts[key] ?? 0) + 1;
        break;
      }
    }
  }
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [topKey, topCount] = entries[0];
  const totalMatched = entries.reduce((acc, [, n]) => acc + n, 0);
  const confidence = Math.round((topCount / Math.max(memberTitles.length, 1)) * 100);
  const source = memberTitles.length === 1 || topCount === totalMatched
    ? "keyword_match"
    : "member_majority";
  return { key: topKey, source, confidence };
}
```

Test PASS.

- [ ] **Adım 5: Failing test — `trend-seasonal-detect.test.ts`.**

```ts
import { describe, expect, it } from "vitest";
import { detectSeasonalTag } from "@/features/trend-stories/services/seasonal-detect";

describe("detectSeasonalTag", () => {
  it("christmas label + aralık içi tarih → 'christmas'", () => {
    expect(detectSeasonalTag("Christmas Wall Art", new Date("2026-12-10")))
      .toBe("christmas");
  });
  it("christmas label ama temmuz → null", () => {
    expect(detectSeasonalTag("Christmas Wall Art", new Date("2026-07-10")))
      .toBeNull();
  });
  it("keyword yoksa → null", () => {
    expect(detectSeasonalTag("Boho Print", new Date("2026-12-10")))
      .toBeNull();
  });
  it("yıl sonu sarma (10-15 → 12-31) doğru çalışır", () => {
    expect(detectSeasonalTag("xmas gift", new Date("2026-10-20"))).toBe("christmas");
  });
});
```

- [ ] **Adım 6:** `seasonal-detect.ts` implementation.

```ts
import { SEASONAL_RULES } from "@/features/trend-stories/seasonal-keywords";

function inRange(today: Date, rule: { startMonth: number; startDay: number; endMonth: number; endDay: number }): boolean {
  const m = today.getMonth() + 1;
  const d = today.getDate();
  const start = rule.startMonth * 100 + rule.startDay;
  const end = rule.endMonth * 100 + rule.endDay;
  const now = m * 100 + d;
  return start <= end ? now >= start && now <= end : now >= start || now <= end;
}

export function detectSeasonalTag(label: string, today: Date): string | null {
  const hay = label.toLowerCase();
  for (const rule of SEASONAL_RULES) {
    if (rule.keywords.some((kw) => hay.includes(kw)) && inRange(today, rule)) {
      return rule.tag;
    }
  }
  return null;
}
```

Test PASS.

- [ ] **Adım 7:** Commit.

```bash
git add src/features/trend-stories/services/normalize.ts src/features/trend-stories/services/product-type-derive.ts src/features/trend-stories/services/seasonal-detect.ts tests/unit/trend-normalize.test.ts tests/unit/trend-product-type-derive.test.ts tests/unit/trend-seasonal-detect.test.ts
git commit -m "feat(trend-stories): normalize + product-type derive + seasonal detect helpers"
```

---

### Task 4: Pure `clusterListings()` + Unit Tests

**Dosyalar:**
- Create: `src/features/trend-stories/services/cluster-service.ts` (yalnız pure function kısmı bu task'ta; DB upsert Task 6'da eklenir)
- Test: `tests/unit/trend-cluster-listings.test.ts`

- [ ] **Adım 1: Failing test — `trend-cluster-listings.test.ts`.**

```ts
import { describe, expect, it } from "vitest";
import { clusterListings } from "@/features/trend-stories/services/cluster-service";

type L = { id: string; competitorStoreId: string; title: string; reviewCount: number; firstSeenAt: Date; listingCreatedAt: Date | null };

const mk = (overrides: Partial<L> & { id: string; store: string; title: string }): L => ({
  id: overrides.id,
  competitorStoreId: overrides.store,
  title: overrides.title,
  reviewCount: overrides.reviewCount ?? 0,
  firstSeenAt: overrides.firstSeenAt ?? new Date("2026-04-20"),
  listingCreatedAt: overrides.listingCreatedAt ?? null,
});

describe("clusterListings", () => {
  const today = new Date("2026-04-24");

  it("boş girdi → boş çıktı", () => {
    expect(clusterListings({ listings: [], windowDays: 7, today })).toEqual([]);
  });

  it("tek listing — eşiği geçemez, cluster yok", () => {
    const r = clusterListings({
      listings: [mk({ id: "l1", store: "s1", title: "boho wall art" })],
      windowDays: 7,
      today,
    });
    expect(r).toEqual([]);
  });

  it("7G: 2 store 3 listing 'boho wall art' → 1 cluster", () => {
    const r = clusterListings({
      listings: [
        mk({ id: "l1", store: "s1", title: "Boho Wall Art Print" }),
        mk({ id: "l2", store: "s2", title: "Modern Boho Wall Art" }),
        mk({ id: "l3", store: "s1", title: "Cute Boho Wall Art Sticker" }),
      ],
      windowDays: 7,
      today,
    });
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[0].signature).toMatch(/boho wall|wall art/);
    expect(r[0].storeCount).toBe(2);
    expect(r[0].memberCount).toBe(3);
  });

  it("1G: 2 store 2 listing → cluster (dinamik eşik)", () => {
    const r = clusterListings({
      listings: [
        mk({ id: "l1", store: "s1", title: "Halloween Pumpkin Print" }),
        mk({ id: "l2", store: "s2", title: "Halloween Pumpkin Sticker" }),
      ],
      windowDays: 1,
      today,
    });
    expect(r.length).toBeGreaterThanOrEqual(1);
  });

  it("1-gram atılır — yalnız 2/3-gram signature üretir", () => {
    const r = clusterListings({
      listings: [
        mk({ id: "l1", store: "s1", title: "Boho Home Decor" }),
        mk({ id: "l2", store: "s2", title: "Minimalist Home Design" }),
        mk({ id: "l3", store: "s3", title: "Modern Home Style" }),
      ],
      windowDays: 7,
      today,
    });
    for (const c of r) expect(c.signature.split(" ").length).toBeGreaterThanOrEqual(2);
  });

  it("token order korunur — 'wall art print' ve 'print wall art' farklı signature", () => {
    const r = clusterListings({
      listings: [
        mk({ id: "l1", store: "s1", title: "Wall Art Print" }),
        mk({ id: "l2", store: "s2", title: "Wall Art Print Design" }),
        mk({ id: "l3", store: "s3", title: "Wall Art Print Set" }),
      ],
      windowDays: 7,
      today,
    });
    const signatures = r.map((c) => c.signature);
    expect(signatures.some((s) => s.includes("wall art print"))).toBe(true);
    expect(signatures.every((s) => !s.includes("print wall art"))).toBe(true);
  });

  it("overlap pruning: aynı üyelerden oluşan iki cluster → biri tutulur", () => {
    const r = clusterListings({
      listings: [
        mk({ id: "l1", store: "s1", title: "Boho Wall Art Print" }),
        mk({ id: "l2", store: "s2", title: "Boho Wall Art Design" }),
        mk({ id: "l3", store: "s3", title: "Boho Wall Art Sticker" }),
      ],
      windowDays: 7,
      today,
    });
    // "boho wall art" + "wall art" + "boho wall" çıkabilirdi, overlap pruning ile 1 kalmalı
    expect(r.length).toBeLessThanOrEqual(2);
  });

  it("cluster score: recencyBoost son 3 gün için +5", () => {
    const recent = new Date("2026-04-23");
    const old = new Date("2026-03-01");
    const r = clusterListings({
      listings: [
        mk({ id: "l1", store: "s1", title: "Boho Wall Art", firstSeenAt: recent }),
        mk({ id: "l2", store: "s2", title: "Boho Wall Art Set", firstSeenAt: recent }),
        mk({ id: "l3", store: "s3", title: "Boho Wall Art Print", firstSeenAt: recent }),
      ],
      windowDays: 7,
      today,
    });
    const r2 = clusterListings({
      listings: [
        mk({ id: "l1", store: "s1", title: "Boho Wall Art", firstSeenAt: old }),
        mk({ id: "l2", store: "s2", title: "Boho Wall Art Set", firstSeenAt: old }),
        mk({ id: "l3", store: "s3", title: "Boho Wall Art Print", firstSeenAt: old }),
      ],
      windowDays: 30,
      today,
    });
    expect(r[0].clusterScore).toBeGreaterThan(r2[0].clusterScore);
  });

  it("productTypeKey resolve: üç canvas başlığı → 'canvas'", () => {
    const r = clusterListings({
      listings: [
        mk({ id: "l1", store: "s1", title: "Boho Canvas Art" }),
        mk({ id: "l2", store: "s2", title: "Minimalist Canvas Print" }),
        mk({ id: "l3", store: "s3", title: "Modern Canvas Poster" }),
      ],
      windowDays: 7,
      today,
    });
    expect(r[0].productTypeKey).toBe("canvas");
  });

  it("hero listing: en yüksek reviewCount", () => {
    const r = clusterListings({
      listings: [
        mk({ id: "l1", store: "s1", title: "Boho Wall Art", reviewCount: 10 }),
        mk({ id: "l2", store: "s2", title: "Boho Wall Art Set", reviewCount: 50 }),
        mk({ id: "l3", store: "s3", title: "Boho Wall Art Print", reviewCount: 20 }),
      ],
      windowDays: 7,
      today,
    });
    expect(r[0].heroListingId).toBe("l2");
  });
});
```

- [ ] **Adım 2:** `cluster-service.ts` pure function implementation (yalnız `clusterListings`; DB upsert Task 6).

```ts
import { normalizeForSimilarity } from "./normalize";
import { deriveProductTypeKey } from "./product-type-derive";
import { detectSeasonalTag } from "./seasonal-detect";
import {
  WINDOW_THRESHOLDS,
  OVERLAP_PRUNE_THRESHOLD,
  type WindowDays,
} from "@/features/trend-stories/constants";

export type CompetitorListingForCluster = {
  id: string;
  competitorStoreId: string;
  title: string;
  reviewCount: number;
  firstSeenAt: Date;
  listingCreatedAt: Date | null;
};

export type ClusterCandidate = {
  signature: string;
  label: string;
  memberListingIds: string[];
  storeCount: number;
  memberCount: number;
  totalReviewCount: number;
  latestMemberSeenAt: Date | null;
  heroListingId: string | null;
  productTypeKey: string | null;
  productTypeSource: "keyword_match" | "member_majority" | null;
  productTypeConfidence: number | null;
  seasonalTag: string | null;
  clusterScore: number;
};

function buildNGrams(tokens: string[], n: number): string[] {
  if (tokens.length < n) return [];
  const grams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) grams.push(tokens.slice(i, i + n).join(" "));
  return grams;
}

function recencyBoost(latest: Date | null, today: Date): number {
  if (!latest) return 0;
  const diffDays = (today.getTime() - latest.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 3) return 5;
  if (diffDays <= 7) return 2;
  return 0;
}

export function clusterListings(input: {
  listings: CompetitorListingForCluster[];
  windowDays: WindowDays;
  today: Date;
}): ClusterCandidate[] {
  const { listings, windowDays, today } = input;
  const threshold = WINDOW_THRESHOLDS[windowDays];

  // 1. Her listing için n-gram (2+3) üret
  type SigIdx = Map<string, Set<string>>; // signature -> listing ids
  const sigToListings: SigIdx = new Map();
  const listingById = new Map<string, CompetitorListingForCluster>();

  for (const l of listings) {
    listingById.set(l.id, l);
    const tokens = normalizeForSimilarity(l.title);
    const grams = [...buildNGrams(tokens, 2), ...buildNGrams(tokens, 3)];
    for (const g of grams) {
      if (!sigToListings.has(g)) sigToListings.set(g, new Set());
      sigToListings.get(g)!.add(l.id);
    }
  }

  // 2. Eşik filtrele → aday cluster
  const candidates: ClusterCandidate[] = [];
  for (const [sig, idSet] of sigToListings.entries()) {
    const memberIds = Array.from(idSet);
    if (memberIds.length < threshold.minListing) continue;
    const members = memberIds.map((id) => listingById.get(id)!);
    const storeSet = new Set(members.map((m) => m.competitorStoreId));
    if (storeSet.size < threshold.minStore) continue;

    const totalReviewCount = members.reduce((acc, m) => acc + m.reviewCount, 0);
    const latestMemberSeenAt = members.reduce<Date | null>(
      (acc, m) => (acc === null || m.firstSeenAt > acc ? m.firstSeenAt : acc),
      null,
    );
    const hero = members.reduce((acc, m) => (acc === null || m.reviewCount > acc.reviewCount ? m : acc), members[0]);
    const titles = members.map((m) => m.title);
    const pt = deriveProductTypeKey(titles);
    const seasonal = detectSeasonalTag(sig, today);

    const score =
      storeSet.size * 3 +
      Math.round(Math.log10(totalReviewCount + 1) * 2) +
      members.length * 1 +
      recencyBoost(latestMemberSeenAt, today);

    candidates.push({
      signature: sig,
      label: sig,
      memberListingIds: memberIds,
      storeCount: storeSet.size,
      memberCount: members.length,
      totalReviewCount,
      latestMemberSeenAt,
      heroListingId: hero?.id ?? null,
      productTypeKey: pt?.key ?? null,
      productTypeSource: pt?.source ?? null,
      productTypeConfidence: pt?.confidence ?? null,
      seasonalTag: seasonal,
      clusterScore: score,
    });
  }

  // 3. Overlap pruning
  candidates.sort((a, b) => {
    if (b.storeCount !== a.storeCount) return b.storeCount - a.storeCount;
    if (b.totalReviewCount !== a.totalReviewCount) return b.totalReviewCount - a.totalReviewCount;
    const aToks = a.signature.split(" ").length;
    const bToks = b.signature.split(" ").length;
    if (bToks !== aToks) return bToks - aToks;
    return a.signature.localeCompare(b.signature);
  });

  const kept: ClusterCandidate[] = [];
  const suppressed = new Set<string>();
  for (const c of candidates) {
    if (suppressed.has(c.signature)) continue;
    kept.push(c);
    const cSet = new Set(c.memberListingIds);
    for (const other of candidates) {
      if (other === c || suppressed.has(other.signature)) continue;
      const oSet = new Set(other.memberListingIds);
      const inter = [...cSet].filter((x) => oSet.has(x)).length;
      const overlap = inter / Math.min(cSet.size, oSet.size);
      if (overlap >= OVERLAP_PRUNE_THRESHOLD) suppressed.add(other.signature);
    }
  }

  return kept;
}
```

- [ ] **Adım 3:** Çalıştır — tüm test senaryoları PASS.

```bash
npm run test -- trend-cluster-listings
```

- [ ] **Adım 4:** Commit.

```bash
git add src/features/trend-stories/services/cluster-service.ts tests/unit/trend-cluster-listings.test.ts
git commit -m "feat(trend-stories): pure clusterListings with n-gram + dynamic thresholds + overlap pruning"
```

---

### Task 5: Listing Cursor Encode/Decode + Unit Tests

**Dosyalar:**
- Create: `src/features/trend-stories/services/listing-cursor.ts`
- Test: `tests/unit/trend-listing-cursor.test.ts`

> **Not:** Aynı cursor formatı hem feed endpoint'inde (`GET /api/trend-stories/feed?cursor=...`) hem cluster detail endpoint'inde (`GET /api/trend-stories/clusters/[id]?membersCursor=...`) kullanılır. İkisi de `CompetitorListing` satırlarını sayfalar. Bu yüzden helper generic isimlendirildi: `listing-cursor.ts` (önceki taslakta `members-cursor` idi; yanıltıcıydı).

Cursor sözleşmesi: `CompetitorListing.firstSeenAt DESC, CompetitorListing.id DESC`. Encode: `base64("<firstSeenAt ISO>|<listingId>")`. `TrendClusterMember.id` kullanılmaz — recompute member row'u silip yeniden oluşturabilir → cursor kararsızlaşır. Listing PK + tarih kararlı.

- [ ] **Adım 1: Failing test.**

```ts
import { describe, expect, it } from "vitest";
import { encodeMembersCursor, decodeMembersCursor } from "@/features/trend-stories/services/members-cursor";

describe("members cursor", () => {
  it("round-trip", () => {
    const seen = new Date("2026-04-24T12:34:56.000Z");
    const cur = encodeMembersCursor({ firstSeenAt: seen, listingId: "l_abc" });
    expect(decodeMembersCursor(cur)).toEqual({ firstSeenAt: seen, listingId: "l_abc" });
  });
  it("bozuk cursor → null", () => {
    expect(decodeMembersCursor("not-base64!")).toBeNull();
    expect(decodeMembersCursor(Buffer.from("just-a-string").toString("base64"))).toBeNull();
  });
  it("empty → null", () => {
    expect(decodeMembersCursor("")).toBeNull();
  });
});
```

- [ ] **Adım 2:** Implementation.

```ts
export type MembersCursor = { firstSeenAt: Date; listingId: string };

export function encodeMembersCursor(c: MembersCursor): string {
  return Buffer.from(`${c.firstSeenAt.toISOString()}|${c.listingId}`, "utf8").toString("base64");
}

export function decodeMembersCursor(raw: string | null | undefined): MembersCursor | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    const parts = decoded.split("|");
    if (parts.length !== 2) return null;
    const d = new Date(parts[0]);
    if (Number.isNaN(d.getTime())) return null;
    if (!parts[1]) return null;
    return { firstSeenAt: d, listingId: parts[1] };
  } catch {
    return null;
  }
}
```

- [ ] **Adım 3:** Test PASS + commit.

```bash
npm run test -- trend-members-cursor
git add src/features/trend-stories/services/members-cursor.ts tests/unit/trend-members-cursor.test.ts
git commit -m "feat(trend-stories): members cursor encode/decode (firstSeenAt + listingId)"
```

---

### Task 6: Cluster Upsert Service + Feature Gate + Scheduler

**Dosyalar:**
- Update: `src/features/trend-stories/services/cluster-service.ts` (DB upsert katmanı ekle)
- Create: `src/features/trend-stories/services/feature-gate.ts`
- Create: `src/features/trend-stories/services/trend-update-scheduler.ts`

- [ ] **Adım 1:** `feature-gate.ts`.

```ts
import { db } from "@/server/db";
import { NotFoundError } from "@/lib/errors";

export async function assertTrendStoriesAvailable(): Promise<void> {
  const flags = await db.featureFlag.findMany({
    where: { key: { in: ["trend_stories.enabled", "competitors.enabled"] } },
  });
  const trend = flags.find((f) => f.key === "trend_stories.enabled")?.enabled ?? false;
  const comp = flags.find((f) => f.key === "competitors.enabled")?.enabled ?? false;
  if (!trend || !comp) throw new NotFoundError();
}
```

- [ ] **Adım 2:** `trend-update-scheduler.ts`.

```ts
import { JobType, JobStatus } from "@prisma/client";
import { db } from "@/server/db";
import { enqueue } from "@/server/queue";
import { logger } from "@/lib/logger";
import { DEBOUNCE_WINDOW_MS } from "@/features/trend-stories/constants";

export async function enqueueTrendClusterUpdate(userId: string): Promise<
  { status: "enqueued"; jobId: string } | { status: "skipped"; reason: "active_job" | "debounced" }
> {
  // 1. Aktif QUEUED/RUNNING var mı?
  const active = await db.job.findFirst({
    where: {
      userId,
      type: JobType.TREND_CLUSTER_UPDATE,
      status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] },
    },
    select: { id: true },
  });
  if (active) {
    logger.info({ userId }, "trend enqueue skipped: active job exists");
    return { status: "skipped", reason: "active_job" };
  }
  // 2. Son 60sn içinde SUCCESS var mı?
  const recent = await db.job.findFirst({
    where: {
      userId,
      type: JobType.TREND_CLUSTER_UPDATE,
      status: JobStatus.SUCCESS,
      finishedAt: { gte: new Date(Date.now() - DEBOUNCE_WINDOW_MS) },
    },
    select: { id: true },
  });
  if (recent) {
    logger.info({ userId }, "trend enqueue skipped: debounced");
    return { status: "skipped", reason: "debounced" };
  }
  // 3. Enqueue
  const job = await db.job.create({
    data: { userId, type: JobType.TREND_CLUSTER_UPDATE, metadata: { trigger: "scheduler" } },
  });
  const bull = await enqueue(JobType.TREND_CLUSTER_UPDATE, { jobId: job.id, userId });
  await db.job.update({ where: { id: job.id }, data: { bullJobId: bull.id } });
  return { status: "enqueued", jobId: job.id };
}
```

- [ ] **Adım 3:** `cluster-service.ts`'ya DB upsert katmanı ekle.

```ts
// src/features/trend-stories/services/cluster-service.ts (alt kısmına ekle)
import { db } from "@/server/db";
import { TrendClusterStatus } from "@prisma/client";
import { WINDOW_DAYS, MAX_CLUSTER_MEMBERS_SCAN } from "@/features/trend-stories/constants";

export async function recomputeTrendClustersForUser(userId: string, now: Date = new Date()): Promise<void> {
  // Her pencere için:
  // 1. Pencereye giren CompetitorListing'leri çek (firstSeenAt son N gün, user scope).
  // 2. clusterListings() ile aday üret.
  // 3. ProductType FK resolve (productTypeKey → productTypeId).
  // 4. (userId, signature, windowDays) bazlı upsert; member diff.
  // 5. Eşik altına düşenleri STALE işaretle.

  const userCompetitorStoreIds = (
    await db.competitorStore.findMany({
      where: { userId, deletedAt: null },
      select: { id: true },
    })
  ).map((s) => s.id);

  if (userCompetitorStoreIds.length === 0) {
    // Hiç competitor store yoksa kullanıcının tüm cluster'larını STALE yap
    await db.trendCluster.updateMany({
      where: { userId, status: TrendClusterStatus.ACTIVE },
      data: { status: TrendClusterStatus.STALE, computedAt: now },
    });
    return;
  }

  for (const windowDays of WINDOW_DAYS) {
    const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const listings = await db.competitorListing.findMany({
      where: {
        competitorStoreId: { in: userCompetitorStoreIds },
        firstSeenAt: { gte: since },
        deletedAt: null,
      },
      select: {
        id: true,
        competitorStoreId: true,
        title: true,
        reviewCount: true,
        firstSeenAt: true,
        listingCreatedAt: true,
      },
      take: MAX_CLUSTER_MEMBERS_SCAN,
      orderBy: { firstSeenAt: "desc" },
    });

    const candidates = clusterListings({ listings, windowDays, today: now });

    // ProductType FK resolve
    const neededKeys = Array.from(new Set(candidates.map((c) => c.productTypeKey).filter((k): k is string => !!k)));
    const productTypes = neededKeys.length
      ? await db.productType.findMany({ where: { key: { in: neededKeys } }, select: { id: true, key: true } })
      : [];
    const keyToId = new Map(productTypes.map((p) => [p.key, p.id]));

    const activeSignatures = new Set<string>();
    for (const c of candidates) {
      activeSignatures.add(c.signature);
      const cluster = await db.trendCluster.upsert({
        where: { userId_signature_windowDays: { userId, signature: c.signature, windowDays } },
        create: {
          userId,
          signature: c.signature,
          label: c.label,
          productTypeId: c.productTypeKey ? keyToId.get(c.productTypeKey) ?? null : null,
          productTypeSource: c.productTypeSource,
          productTypeConfidence: c.productTypeConfidence,
          windowDays,
          memberCount: c.memberCount,
          storeCount: c.storeCount,
          totalReviewCount: c.totalReviewCount,
          latestMemberSeenAt: c.latestMemberSeenAt,
          heroListingId: c.heroListingId,
          seasonalTag: c.seasonalTag,
          status: TrendClusterStatus.ACTIVE,
          clusterScore: c.clusterScore,
          computedAt: now,
        },
        update: {
          label: c.label,
          productTypeId: c.productTypeKey ? keyToId.get(c.productTypeKey) ?? null : null,
          productTypeSource: c.productTypeSource,
          productTypeConfidence: c.productTypeConfidence,
          memberCount: c.memberCount,
          storeCount: c.storeCount,
          totalReviewCount: c.totalReviewCount,
          latestMemberSeenAt: c.latestMemberSeenAt,
          heroListingId: c.heroListingId,
          seasonalTag: c.seasonalTag,
          status: TrendClusterStatus.ACTIVE,
          clusterScore: c.clusterScore,
          computedAt: now,
        },
      });

      // Member diff
      const existing = await db.trendClusterMember.findMany({
        where: { clusterId: cluster.id },
        select: { listingId: true },
      });
      const existingIds = new Set(existing.map((e) => e.listingId));
      const newIds = new Set(c.memberListingIds);
      const toAdd = [...newIds].filter((id) => !existingIds.has(id));
      const toRemove = [...existingIds].filter((id) => !newIds.has(id));

      if (toAdd.length) {
        await db.trendClusterMember.createMany({
          data: toAdd.map((listingId) => ({ clusterId: cluster.id, listingId, userId })),
          skipDuplicates: true,
        });
      }
      if (toRemove.length) {
        await db.trendClusterMember.deleteMany({
          where: { clusterId: cluster.id, listingId: { in: toRemove } },
        });
      }
    }

    // Eşik altına düşen cluster'ları STALE işaretle
    await db.trendCluster.updateMany({
      where: {
        userId,
        windowDays,
        status: TrendClusterStatus.ACTIVE,
        signature: { notIn: Array.from(activeSignatures) },
      },
      data: { status: TrendClusterStatus.STALE, computedAt: now },
    });
  }
}
```

- [ ] **Adım 4:** Typecheck.

```bash
npm run typecheck
```

- [ ] **Adım 5:** Commit.

```bash
git add src/features/trend-stories/services/cluster-service.ts src/features/trend-stories/services/feature-gate.ts src/features/trend-stories/services/trend-update-scheduler.ts
git commit -m "feat(trend-stories): DB upsert recompute + feature gate + enqueue scheduler with debounce"
```

---

### Task 7: `TREND_CLUSTER_UPDATE` Worker + Bootstrap Registration

**Dosyalar:**
- Create: `src/server/workers/trend-cluster-update.worker.ts`
- Update: `src/server/workers/bootstrap.ts` (handler kaydı)
- Test: `tests/integration/trend-cluster-worker.test.ts`

- [ ] **Adım 1: Failing integration test — `trend-cluster-worker.test.ts`.**

Senaryolar:
- User A için 7G penceresinde "boho wall art" konusu 2 store/3 listing → cluster ACTIVE oluşturur.
- Sonraki recompute'ta eşik altına düşerse cluster STALE olur.
- **STALE sonrası bookmark trendClusterLabelSnapshot korunur.**
- User B verisi User A cluster'ına karışmaz (data isolation).

(Test kodu bu spec'e dahil etmiyorum — implementation task'ında TDD akışıyla yazılır; yukarıdaki 4 senaryo zorunlu.)

- [ ] **Adım 2:** Worker.

```ts
// src/server/workers/trend-cluster-update.worker.ts
import { JobStatus } from "@prisma/client";
import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import { recomputeTrendClustersForUser } from "@/features/trend-stories/services/cluster-service";

type Payload = { jobId: string; userId: string };

export async function handleTrendClusterUpdate(job: { data: Payload }) {
  const { jobId, userId } = job.data;
  await db.job.update({ where: { id: jobId }, data: { status: JobStatus.RUNNING, startedAt: new Date() } });
  try {
    await recomputeTrendClustersForUser(userId);
    await db.job.update({
      where: { id: jobId },
      data: { status: JobStatus.SUCCESS, finishedAt: new Date(), progress: 100 },
    });
  } catch (err) {
    logger.error({ jobId, userId, err: (err as Error).message }, "trend cluster update failed");
    await db.job.update({
      where: { id: jobId },
      data: { status: JobStatus.FAILED, finishedAt: new Date(), error: (err as Error).message },
    });
    throw err;
  }
}
```

- [ ] **Adım 3:** `bootstrap.ts`'a handler kaydı ekle.

```ts
import { JobType } from "@prisma/client";
import { handleTrendClusterUpdate } from "./trend-cluster-update.worker";
// ...
const specs = [
  // ... mevcut handler'lar
  { name: JobType.TREND_CLUSTER_UPDATE, handler: handleTrendClusterUpdate },
] as const;
```

- [ ] **Adım 4:** Test PASS + commit.

```bash
git add src/server/workers/trend-cluster-update.worker.ts src/server/workers/bootstrap.ts tests/integration/trend-cluster-worker.test.ts
git commit -m "feat(workers): TREND_CLUSTER_UPDATE worker with user-scoped recompute and STALE transition"
```

---

### Task 8: Scrape Worker SUCCESS Branch → Trend Enqueue + Regression Test

**Dosyalar:**
- Update: `src/server/workers/scrape-competitor.worker.ts` (SUCCESS branch'e try/catch içinde enqueue)
- Test: `tests/integration/trend-scrape-regression.test.ts`

- [ ] **Adım 1: Failing regression test.**

Senaryo: `enqueueTrendClusterUpdate` mock fn `throw new Error("redis down")` → scrape job SUCCESS kalır, `CompetitorScan.metadata.trendEnqueueError` dolu, scrape failed değil.

- [ ] **Adım 2:** Worker güncelle. Mevcut SUCCESS branch'in sonuna:

```ts
// scrape-competitor.worker.ts — SUCCESS branch içinde, scan kaydı final update'inden sonra
try {
  await enqueueTrendClusterUpdate(userId);
} catch (err) {
  logger.warn({ userId, err: (err as Error).message }, "trend enqueue failed after scrape SUCCESS");
  await db.competitorScan.update({
    where: { id: scanId },
    data: { metadata: { ...(existingMetadata ?? {}), trendEnqueueError: (err as Error).message } },
  });
}
```

- [ ] **Adım 3:** Test PASS + commit.

```bash
git add src/server/workers/scrape-competitor.worker.ts tests/integration/trend-scrape-regression.test.ts
git commit -m "feat(workers): trigger trend cluster update after scrape SUCCESS (non-blocking)"
```

---

### Task 9: Feed Service + Membership Hint Resolver

**Dosyalar:**
- Create: `src/features/trend-stories/services/feed-service.ts`
- Test: `tests/unit/trend-membership-hint.test.ts`

- [ ] **Adım 1: Failing unit test — membership hint tekil seçim.**

Senaryolar:
- Listing 3 cluster'a üye; `clusterScore` farklı → en yüksek seçilir.
- `clusterScore` eşit; `storeCount` farklı → büyük seçilir.
- storeCount eşit; `memberCount` farklı → büyük seçilir.
- hepsi eşit → `label` alfabetik en küçük.

- [ ] **Adım 2:** `feed-service.ts`.

```ts
import { db } from "@/server/db";
import { FEED_PAGE_SIZE, type WindowDays } from "@/features/trend-stories/constants";
import { TrendClusterStatus } from "@prisma/client";

type MembershipHint = { clusterId: string; label: string; seasonalTag: string | null };

export type FeedItem = {
  listingId: string;
  title: string;
  thumbnailUrl: string | null;
  reviewCount: number;
  sourceUrl: string;
  competitorStoreId: string;
  competitorStoreName: string;
  firstSeenAt: Date;
  trendMembershipHint: MembershipHint | null;
};

export async function fetchFeed(args: {
  userId: string;
  windowDays: WindowDays;
  cursor: { firstSeenAt: Date; listingId: string } | null;
  limit?: number;
}): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
  const limit = args.limit ?? FEED_PAGE_SIZE;
  const since = new Date(Date.now() - args.windowDays * 24 * 60 * 60 * 1000);

  const userCompetitorStoreIds = (
    await db.competitorStore.findMany({
      where: { userId: args.userId, deletedAt: null },
      select: { id: true },
    })
  ).map((s) => s.id);

  if (userCompetitorStoreIds.length === 0) return { items: [], nextCursor: null };

  const listings = await db.competitorListing.findMany({
    where: {
      competitorStoreId: { in: userCompetitorStoreIds },
      firstSeenAt: { gte: since, ...(args.cursor ? { lte: args.cursor.firstSeenAt } : {}) },
      ...(args.cursor ? { NOT: { id: args.cursor.listingId } } : {}),
      deletedAt: null,
    },
    orderBy: [{ firstSeenAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { competitorStore: { select: { displayName: true, etsyShopName: true } } },
  });

  const hasMore = listings.length > limit;
  const page = listings.slice(0, limit);

  const listingIds = page.map((l) => l.id);
  const memberships = listingIds.length
    ? await db.trendClusterMember.findMany({
        where: { userId: args.userId, listingId: { in: listingIds }, cluster: { status: TrendClusterStatus.ACTIVE } },
        include: { cluster: { select: { id: true, label: true, seasonalTag: true, clusterScore: true, storeCount: true, memberCount: true } } },
      })
    : [];

  const listingToMemberships = new Map<string, typeof memberships>();
  for (const m of memberships) {
    if (!listingToMemberships.has(m.listingId)) listingToMemberships.set(m.listingId, []);
    listingToMemberships.get(m.listingId)!.push(m);
  }

  const items: FeedItem[] = page.map((l) => {
    const ms = listingToMemberships.get(l.id) ?? [];
    ms.sort((a, b) => {
      if (b.cluster.clusterScore !== a.cluster.clusterScore) return b.cluster.clusterScore - a.cluster.clusterScore;
      if (b.cluster.storeCount !== a.cluster.storeCount) return b.cluster.storeCount - a.cluster.storeCount;
      if (b.cluster.memberCount !== a.cluster.memberCount) return b.cluster.memberCount - a.cluster.memberCount;
      return a.cluster.label.localeCompare(b.cluster.label);
    });
    const top = ms[0] ?? null;
    return {
      listingId: l.id,
      title: l.title,
      thumbnailUrl: l.thumbnailUrl,
      reviewCount: l.reviewCount,
      sourceUrl: l.sourceUrl,
      competitorStoreId: l.competitorStoreId,
      competitorStoreName: l.competitorStore.displayName ?? l.competitorStore.etsyShopName,
      firstSeenAt: l.firstSeenAt,
      trendMembershipHint: top ? { clusterId: top.cluster.id, label: top.cluster.label, seasonalTag: top.cluster.seasonalTag } : null,
    };
  });

  let nextCursor: string | null = null;
  if (hasMore && page.length > 0) {
    const last = page[page.length - 1];
    nextCursor = Buffer.from(`${last.firstSeenAt.toISOString()}|${last.id}`, "utf8").toString("base64");
  }
  return { items, nextCursor };
}
```

- [ ] **Adım 3:** Test PASS + commit.

```bash
git add src/features/trend-stories/services/feed-service.ts tests/unit/trend-membership-hint.test.ts
git commit -m "feat(trend-stories): feed service + deterministic membership hint resolver"
```

---

### Task 10: API Routes — Clusters List / Detail / Feed + Admin Recompute

**Dosyalar:**
- Create: `src/app/api/trend-stories/clusters/route.ts`
- Create: `src/app/api/trend-stories/clusters/[id]/route.ts`
- Create: `src/app/api/trend-stories/feed/route.ts`
- Create: `src/app/api/admin/trend-clusters/recompute/route.ts`
- Test: `tests/integration/api-trend-stories.test.ts`, `api-trend-data-isolation.test.ts`, `api-trend-cluster-detail-partial.test.ts`

- [ ] **Adım 1:** `clusters/route.ts`.

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { TrendClusterStatus } from "@prisma/client";
import { requireUser } from "@/server/authorization";
import { assertTrendStoriesAvailable } from "@/features/trend-stories/services/feature-gate";
import { db } from "@/server/db";

const query = z.object({ window: z.enum(["1","7","30"]).default("7") });

export async function GET(req: Request) {
  await assertTrendStoriesAvailable();
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const parsed = query.safeParse({ window: searchParams.get("window") ?? "7" });
  if (!parsed.success) return NextResponse.json({ error: "invalid window" }, { status: 400 });
  const windowDays = Number(parsed.data.window);

  const clusters = await db.trendCluster.findMany({
    where: { userId: user.id, windowDays, status: TrendClusterStatus.ACTIVE },
    orderBy: [{ clusterScore: "desc" }, { latestMemberSeenAt: "desc" }],
    include: {
      heroListing: { select: { id: true, title: true, thumbnailUrl: true, sourceUrl: true, reviewCount: true } },
      productType: { select: { id: true, key: true, displayName: true } },
    },
    take: 50,
  });

  return NextResponse.json({
    clusters: clusters.map((c) => ({
      id: c.id,
      label: c.label,
      memberCount: c.memberCount,
      storeCount: c.storeCount,
      totalReviewCount: c.totalReviewCount,
      latestMemberSeenAt: c.latestMemberSeenAt,
      seasonalTag: c.seasonalTag,
      productType: c.productType,
      hero: c.heroListing, // null kabul
      clusterScore: c.clusterScore,
    })),
  });
}
```

- [ ] **Adım 2:** `clusters/[id]/route.ts`.

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { TrendClusterStatus } from "@prisma/client";
import { requireUser } from "@/server/authorization";
import { assertTrendStoriesAvailable } from "@/features/trend-stories/services/feature-gate";
import { NotFoundError } from "@/lib/errors";
import { db } from "@/server/db";
import {
  CLUSTER_MEMBERS_PAGE_SIZE,
} from "@/features/trend-stories/constants";
import {
  encodeMembersCursor,
  decodeMembersCursor,
} from "@/features/trend-stories/services/members-cursor";

const query = z.object({ membersCursor: z.string().optional() });

export async function GET(req: Request, { params }: { params: { id: string } }) {
  await assertTrendStoriesAvailable();
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const parsed = query.safeParse({ membersCursor: searchParams.get("membersCursor") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "invalid cursor" }, { status: 400 });

  const cluster = await db.trendCluster.findFirst({
    where: { id: params.id, userId: user.id, status: { not: TrendClusterStatus.ARCHIVED } },
    include: {
      heroListing: { select: { id: true, title: true, thumbnailUrl: true, sourceUrl: true, reviewCount: true, deletedAt: true } },
      productType: { select: { id: true, key: true, displayName: true } },
    },
  });
  if (!cluster) throw new NotFoundError();

  const cursor = decodeMembersCursor(parsed.data.membersCursor ?? null);
  const members = await db.trendClusterMember.findMany({
    where: {
      clusterId: cluster.id,
      ...(cursor
        ? {
            OR: [
              { listing: { firstSeenAt: { lt: cursor.firstSeenAt } } },
              { listing: { firstSeenAt: cursor.firstSeenAt, id: { lt: cursor.listingId } } },
            ],
          }
        : {}),
    },
    orderBy: [{ listing: { firstSeenAt: "desc" } }, { listing: { id: "desc" } }],
    take: CLUSTER_MEMBERS_PAGE_SIZE + 1,
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          sourceUrl: true,
          reviewCount: true,
          firstSeenAt: true,
          deletedAt: true,
          competitorStore: { select: { displayName: true, etsyShopName: true } },
        },
      },
    },
  });

  const hasMore = members.length > CLUSTER_MEMBERS_PAGE_SIZE;
  const pageMembers = members.slice(0, CLUSTER_MEMBERS_PAGE_SIZE);
  const nextCursor =
    hasMore && pageMembers.length > 0
      ? encodeMembersCursor({
          firstSeenAt: pageMembers[pageMembers.length - 1].listing.firstSeenAt,
          listingId: pageMembers[pageMembers.length - 1].listing.id,
        })
      : null;

  return NextResponse.json({
    cluster: {
      id: cluster.id,
      label: cluster.label,
      memberCount: cluster.memberCount,
      storeCount: cluster.storeCount,
      totalReviewCount: cluster.totalReviewCount,
      seasonalTag: cluster.seasonalTag,
      productType: cluster.productType,
      hero: cluster.heroListing && !cluster.heroListing.deletedAt ? cluster.heroListing : null,
      status: cluster.status,
      clusterScore: cluster.clusterScore,
    },
    members: pageMembers.map((m) => ({
      listingId: m.listing.id,
      title: m.listing.title,
      thumbnailUrl: m.listing.thumbnailUrl,
      sourceUrl: m.listing.sourceUrl,
      reviewCount: m.listing.reviewCount,
      firstSeenAt: m.listing.firstSeenAt,
      competitorStoreName: m.listing.competitorStore.displayName ?? m.listing.competitorStore.etsyShopName,
      deleted: m.listing.deletedAt !== null,
    })),
    nextCursor,
  });
}
```

- [ ] **Adım 3:** `feed/route.ts`.

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/authorization";
import { assertTrendStoriesAvailable } from "@/features/trend-stories/services/feature-gate";
import { fetchFeed } from "@/features/trend-stories/services/feed-service";
import { decodeMembersCursor } from "@/features/trend-stories/services/members-cursor";
import type { WindowDays } from "@/features/trend-stories/constants";

const query = z.object({
  window: z.enum(["1","7","30"]).default("7"),
  cursor: z.string().optional(),
});

export async function GET(req: Request) {
  await assertTrendStoriesAvailable();
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const parsed = query.safeParse({
    window: searchParams.get("window") ?? "7",
    cursor: searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "invalid params" }, { status: 400 });

  const cursor = decodeMembersCursor(parsed.data.cursor ?? null);
  const result = await fetchFeed({
    userId: user.id,
    windowDays: Number(parsed.data.window) as WindowDays,
    cursor,
  });
  return NextResponse.json(result);
}
```

- [ ] **Adım 4:** `admin/trend-clusters/recompute/route.ts`.

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/authorization";
import { enqueueTrendClusterUpdate } from "@/features/trend-stories/services/trend-update-scheduler";
import { audit } from "@/server/audit";

const body = z.object({ userId: z.string() });

export async function POST(req: Request) {
  const admin = await requireAdmin();
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const result = await enqueueTrendClusterUpdate(parsed.data.userId);
  await audit({
    actor: admin.email,
    userId: admin.id,
    action: "trend_clusters.recompute",
    targetType: "user",
    targetId: parsed.data.userId,
    metadata: { result },
  });
  return NextResponse.json(result);
}
```

- [ ] **Adım 5: Integration testler.**

- `api-trend-stories.test.ts`:
  - Flag kombinasyonları (TT/TF/FT/FF): FF, TF, FT → 404; TT → 200.
  - `membersCursor` round-trip: ilk sayfa 30 member, `nextCursor` var; ikinci sayfa sonraki 30.
- `api-trend-data-isolation.test.ts`: User B user A'nın cluster id'si ile endpoint çağırır → 404.
- `api-trend-cluster-detail-partial.test.ts` (**yeni Phase 4 talebi**):
  - heroListing `deletedAt != null` → response `hero: null`.
  - bazı member'lar `deletedAt != null` → response `members[].deleted: true`.
  - `seasonalTag = null` → response temiz.
  - `productType = null` → response temiz.
  - Drawer UI crash olmadan hepsini gösterebilmeli (e2e task'ta test edilir).

- [ ] **Adım 6:** Testler PASS + commit.

```bash
git add src/app/api/trend-stories src/app/api/admin/trend-clusters tests/integration/api-trend-stories.test.ts tests/integration/api-trend-data-isolation.test.ts tests/integration/api-trend-cluster-detail-partial.test.ts
git commit -m "feat(api): trend-stories routes (clusters list/detail/feed) + admin recompute with data isolation + cursor pagination"
```

---

### Task 11: Bookmark Mutation Extension — `trendClusterId` + Snapshot Alanları

**Dosyalar:**
- Update: `src/features/bookmarks/schemas/index.ts`
- Update: `src/features/bookmarks/services/bookmark-service.ts`
- Test: `tests/integration/bookmark-trend-snapshot.test.ts`

- [ ] **Adım 1:** Zod schema genişlet.

```ts
// bookmarkListingInput mevcut schema'ya ekle:
trendClusterId: z.string().optional(),
```

- [ ] **Adım 2:** Service — sahiplik + snapshot yazımı.

```ts
// bookmark-service.ts > createBookmarkFromCompetitorListing (veya createBookmark) içinde:
let trendClusterLabelSnapshot: string | null = null;
let trendWindowDaysSnapshot: number | null = null;
if (input.trendClusterId) {
  const cluster = await db.trendCluster.findFirst({
    where: { id: input.trendClusterId, userId: args.userId },
    select: { id: true, label: true, windowDays: true },
  });
  if (!cluster) throw new ForbiddenError(); // başka user veya yok → erişim reddi
  trendClusterLabelSnapshot = cluster.label;
  trendWindowDaysSnapshot = cluster.windowDays;
}

// db.bookmark.create({ data: { ..., trendClusterId, trendClusterLabelSnapshot, trendWindowDaysSnapshot } })
```

- [ ] **Adım 3:** Integration test.

Senaryolar:
- User A kendi cluster id'si ile bookmark → snapshot yazılır.
- User B user A'nın cluster id'si ile → `ForbiddenError`.
- Cluster STALE olduktan sonra bile `trendClusterLabelSnapshot` değişmez (sonraki recompute testi).

- [ ] **Adım 4:** Test PASS + commit.

```bash
git add src/features/bookmarks/schemas/index.ts src/features/bookmarks/services/bookmark-service.ts tests/integration/bookmark-trend-snapshot.test.ts
git commit -m "feat(bookmarks): trend cluster linkage + snapshot fields with ownership enforcement"
```

---

### Task 12: UI — `/trend-stories` Sayfası + Rail + Feed + Drawer + Nav Aktivasyonu

**Dosyalar:**
- Create: `src/app/(app)/trend-stories/page.tsx`
- Create: `src/features/trend-stories/components/*`
- Create: `src/features/trend-stories/queries/*`
- Update: `src/features/app-shell/nav-config.ts` (satır 29: `enabled: true`)
- Update: `prisma/seed.ts` — `trend_stories.enabled: true` yap

- [ ] **Adım 1:** Seed güncelle.

```ts
// prisma/seed.ts flag'ler içinde:
{ key: "trend_stories.enabled", enabled: true },
```

Seed reset: `npx prisma db seed`.

- [ ] **Adım 2:** `nav-config.ts` satır 29 `enabled: false` → `enabled: true`.

- [ ] **Adım 3:** TanStack Query hooks (`use-clusters.ts`, `use-cluster-detail.ts`, `use-feed.ts`) — standart pattern (`useQuery` + key: `["trend-stories","clusters",window]` vb.).

- [ ] **Adım 4:** Componentler. Token scale class'lar (`bg-surface`, `text-text-muted`, `rounded-md`, `p-4`, `gap-3`, `shadow-card`). Yasak: hex, arbitrary, inline style.

- `trend-stories-page.tsx` (server component): `assertTrendStoriesAvailable()` call (404 → Next.js `notFound()`) + client shell.
- `window-tabs.tsx`: Bugün/7G/30G (URL query param'a yaz).
- `trend-cluster-rail.tsx`: horizontal scroll rail; card grid.
- `trend-cluster-card.tsx`: label, memberCount, storeCount, seasonalBadge, hero thumbnail (`<img>` + `eslint-disable-next-line @next/next/no-img-element` — Phase 3 carry-forward).
- `trend-cluster-drawer.tsx`: radix Dialog, member list, hero detay, pagination-ready UI (`nextCursor` varsa "Daha fazla yükle" butonu).
- `trend-feed.tsx` + `feed-listing-card.tsx`: listing card + `trendMembershipHint` rozeti + Bookmark action (modal mevcut bookmark modal'ını reuse eder, `trendClusterId` otomatik doldurulur).
- `seasonal-badge.tsx` / `trend-membership-badge.tsx`: küçük pill.

- [ ] **Adım 5:** Empty/partial state UI.
  - Hiç competitor store yoksa: "Henüz rakip mağaza eklemedin. Rakipler sayfasından başla" linki.
  - Window + veri yoksa: "Bu pencerede yeni listing yok" mesajı.
  - Cluster yok feed var: rail gizlenir, yalnız feed görünür.
  - Hero null (drawer): fallback ilk member thumbnail; tamamı silinmişse gri placeholder.
  - Member silinmiş (`deleted: true`): kart grileşir, "Kaynak artık mevcut değil" pill.

- [ ] **Adım 6:** Manifest kontrol + commit.

```bash
npm run check:tokens
npm run lint
git add src/app/(app)/trend-stories src/features/trend-stories/components src/features/trend-stories/queries src/features/app-shell/nav-config.ts prisma/seed.ts
git commit -m "feat(trend-stories): user UI — rail + feed + drawer + window tabs + nav activation"
```

---

### Task 13: E2E Smoke Test

**Dosyalar:**
- Create: `tests/e2e/trend-stories-flow.spec.ts`

- [ ] **Adım 1:** Playwright spec.

Senaryolar:
- Login → `/trend-stories` → window tabs görünür, varsayılan 7G aktif.
- Seed edilmiş competitor + listing fixture ile en az 1 cluster rail'de görünür.
- Cluster kart tıklanır → drawer açılır → member listesi görünür → drawer kapanır.
- Feed listing kartından "Bookmark" aksiyonu → modal `trendClusterId` dolu → kayıt sonrası `/bookmarks`'ta görünür.
- Window tab değişimi → URL param + farklı data.
- Flag kapalıyken `/trend-stories` → Next.js 404 page.

- [ ] **Adım 2:** Test PASS + commit.

```bash
npx playwright test trend-stories-flow
git add tests/e2e/trend-stories-flow.spec.ts
git commit -m "test(e2e): trend-stories flow smoke (rail, drawer, feed→bookmark, window tabs, flag gate)"
```

---

### Task 14: Release Quality Gates + Phase 4 Notes

**Dosyalar:**
- Create: `docs/plans/phase4-notes.md`

- [ ] **Adım 1:** Release gate'leri çalıştır.

```bash
npm run typecheck
npm run lint
npm run check:tokens
npm run test
npx playwright test
```

Hepsi PASS olmalı.

- [ ] **Adım 2:** Manifest grep kontrol.

```bash
rg "#[0-9a-fA-F]{3,8}" src/features/trend-stories/   # boş
rg "bg-\[" src/features/trend-stories/               # boş
rg -L "requireUser" src/app/api/trend-stories/**/route.ts  # boş (hepsi çağırıyor)
rg -L "assertTrendStoriesAvailable" src/app/api/trend-stories/**/route.ts  # boş
rg "enqueue\(JobType\.TREND_CLUSTER_UPDATE" src/ | rg -v "trend-update-scheduler"  # boş (ham çağrı yasak)
```

- [ ] **Adım 3:** `docs/plans/phase4-notes.md` yaz — kapsam özeti, uygulanan sıkılaştırmalar haritası (3 eklenen: STALE testi, membersCursor sözleşmesi, drawer partial state), commit serisi, release gate sonuçları, bilinen sınırlar (Phase 5+ deferred), Phase 5'e giriş notları.

- [ ] **Adım 4:** Final commit.

```bash
git add docs/plans/phase4-notes.md
git commit -m "chore: phase 4 complete; all gates green"
```

---

## Kritik Dosyalar (Hızlı Referans)

| Dosya | Sorumluluk |
|-------|-----------|
| `prisma/schema.prisma` | `TrendCluster`, `TrendClusterMember`, Bookmark snapshot alanları |
| `src/features/trend-stories/services/cluster-service.ts` | Pure `clusterListings` + DB upsert `recomputeTrendClustersForUser` |
| `src/features/trend-stories/services/feature-gate.ts` | `assertTrendStoriesAvailable` iki-flag gate |
| `src/features/trend-stories/services/trend-update-scheduler.ts` | `enqueueTrendClusterUpdate` debounce + aktif job kontrol |
| `src/features/trend-stories/services/feed-service.ts` | Feed + deterministik `trendMembershipHint` |
| `src/features/trend-stories/services/members-cursor.ts` | Birleşik cursor encode/decode |
| `src/server/workers/trend-cluster-update.worker.ts` | User-scoped recompute worker |
| `src/server/workers/scrape-competitor.worker.ts` | SUCCESS branch'te try/catch ile trend enqueue |
| `src/app/api/trend-stories/**/route.ts` | User-scoped + flag-gated REST endpoint'ler |
| `src/app/(app)/trend-stories/page.tsx` | Rail + feed + drawer sayfası |

---

## Kararlar Özeti (Hızlı Referans)

| Konu | Karar |
|------|-------|
| Birincil trend sinyali | `CompetitorListing.firstSeenAt` (listing ne zaman bizim tarafımıza girdi) |
| İkincil zenginleştirme | `listingCreatedAt` (varsa UI pill "Etsy'de X gün önce oluşturuldu") |
| Pencere tab'ları | 1G / 7G / 30G — varsayılan 7G |
| Dinamik eşik | 1G: 2 store / 2 listing; 7G-30G: 2 store / 3 listing |
| N-gram | 2 + 3 (1-gram atılır), token order korunur |
| Overlap pruning | ≥ %80 overlap → güçlüyü tut |
| Cluster score | `storeCount*3 + log(reviews+1)*2 + memberCount + recencyBoost` |
| Recency boost | 0-3 gün → +5; 4-7 gün → +2; sonra 0 |
| Cluster tablosu | Materialized, per-user, `(userId, signature, windowDays)` unique |
| Cluster status | `ACTIVE` / `STALE` / `ARCHIVED` (eşik altına düşen → STALE) |
| Recompute trigger | Scrape SUCCESS sonrası merkezi helper; debounce 60sn + aktif job kontrolü |
| Enqueue helper | `enqueueTrendClusterUpdate(userId)` tek giriş; ham `enqueue` yasak |
| Scrape etkisi | Trend enqueue hata verse scrape SUCCESS kalır (try/catch + metadata warning) |
| Feature gate | `assertTrendStoriesAvailable()` → `trend_stories.enabled` + `competitors.enabled` iki flag → `NotFoundError` |
| Feed data source | Doğrudan `CompetitorListing`; cluster-aware `trendMembershipHint` servis seviyesinde resolve |
| Membership hint tekil seçim | `clusterScore DESC → storeCount → memberCount → label alfabetik` (deterministik) |
| Cursor | `firstSeenAt DESC, id DESC` birleşik; base64 encoded; `TrendClusterMember.id` yasak (recompute kararsızlaştırır) |
| Cluster detail pagination | İlk sayfa 30 member + `nextCursor`; UI Phase 4'te tek sayfa gösterse bile backend hazır |
| Bookmark entegrasyonu | Mevcut mutation reuse; `trendClusterId` + `trendClusterLabelSnapshot` + `trendWindowDaysSnapshot` write-time snapshot |
| Seasonal | `seasonal-keywords.ts` sözlük + tarih aralığı; cluster üzerinde rozet |
| Admin trigger | `POST /api/admin/trend-clusters/recompute?userId=...` + audit log |

---

## Test Stratejisi

**Unit:**
- `clusterListings` (boş, tek, dinamik eşik, n-gram, order, overlap pruning, score, hero, productType).
- `normalizeForSimilarity` vs `normalizeForProductType`.
- `deriveProductTypeKey` (keyword_match / member_majority / null).
- `detectSeasonalTag` (aralık içi/dışı, yıl sarma).
- `encodeMembersCursor` / `decodeMembersCursor` round-trip + bozuk input.
- `trendMembershipHint` resolver (4 katman tekil seçim).

**Integration (gerçek Postgres + Redis):**
- `TREND_CLUSTER_UPDATE` worker: user-scoped full recompute, member diff, **ACTIVE → STALE geçişi** (bu Phase 4 ek talebi):
  - cluster ACTIVE iken bookmark yazıldı → `trendClusterLabelSnapshot` dolu
  - sonraki recompute'ta eşik altına düştü → cluster STALE
  - rail: STALE görünmez (yalnız ACTIVE)
  - feed: `trendMembershipHint` null (çünkü sorgu `status: ACTIVE` filtreli)
  - bookmark: `trendClusterLabelSnapshot` **değişmemiş** (snapshot korunur)
- `enqueueTrendClusterUpdate` debounce (aktif job / 60sn SUCCESS).
- **Scrape regression: enqueue fail → scrape SUCCESS + `trendEnqueueError` metadata.**
- API 3 endpoint × 2 flag × 2 kullanıcı izolasyonu matris.
- `api-trend-cluster-detail-partial.test.ts` (**Phase 4 ek talebi**):
  - hero deleted → `hero: null`.
  - member deleted → `members[].deleted: true`.
  - seasonalTag null → response temiz.
  - productType null → response temiz.
- Bookmark snapshot + cross-user ForbiddenError.
- `membersCursor` round-trip: 30 member sayfalama → ikinci sayfa devam.

**E2E:**
- `/trend-stories` sayfa smoke: window tabs, rail, drawer, feed, bookmark mutation, flag 404.
- **Drawer partial state** (Phase 4 ek talebi): test fixture'da hero null + 1 member deleted cluster → drawer bozulmadan açılır, placeholder'lar görünür.

---

## Error Handling Pattern'ları

- Feature gate → `NotFoundError` (ID enumeration önlemi).
- Cluster detail başka user → `NotFoundError`.
- Bookmark + trendClusterId başka user → `ForbiddenError`.
- Worker throw → job FAILED + audit log; scrape zinciri etkilenmez.
- `trendMembershipHint` resolve hatası → listing badge'siz gösterilir, hata log'lanır, feed 500 dönmez.
- Invalid cursor → null'a normalize, ilk sayfa döner (kullanıcıya hata göstermez).

---

## Known Limitations / Intentional Deferrals

- Embedding tabanlı cluster merge — Phase 5+.
- Admin seasonal keyword registry UI — Phase 10.
- Batch cluster-level bookmark — Phase 5+.
- Cluster archive admin UI — Phase 10.
- Cross-user/global trend leaderboard — Phase 5+ ürün kararı.
- SSE real-time cluster update — TanStack Query polling yeterli; SSE Phase 5+.
- Trend Stories → varyasyon akışı — Phase 5.

## Phase 3 → Phase 4 Carry-Forward

1. **pino dev worker thread error** — Yeni worker eklemek gürültüyü arttırır; çözüm Phase 5+ backlog.
2. **flaky `api-competitors.test.ts`** — Phase 4 integration testleri aynı risk; yeni fixture helper `testBullJobId()` kullanılır.
3. **thumbnail `<img>` geçici çözüm** — Trend story kartlarında da aynı pattern; kalıcı çözüm (remote pattern whitelist / image proxy) Phase 5+.
4. **audit pattern tutarsızlığı** — Trend-stories read-only, audit gerekmez. Admin recompute endpoint `audit()` çağırır. Tam tutarlılık refactor Phase 10.

---

## Verification Plan (End-to-End)

### Otomatik
```bash
docker compose up -d
npm install
npx prisma migrate dev
npx prisma db seed
npm run test:all
```
Tüm adımlar exit code 0.

### Manuel (Tarayıcı)
1. `npm run dev` + `npm run worker` ayrı terminal.
2. `http://localhost:3000/trend-stories` → flag kapalı başladıysa önce admin panelden `trend_stories.enabled` aç (seed değiştirdiysen seed reset).
3. Rakipler sayfasından 2+ competitor store ekle, scan tetikle.
4. Scan SUCCESS sonrası 60sn bekle, `/trend-stories` yenile → cluster rail + feed görünür.
5. Cluster kart tıkla → drawer açılır → member listesi.
6. Feed kartından bookmark aksiyonu → `/bookmarks`'ta kayıt, `trendClusterLabelSnapshot` DB'de dolu.
7. Admin ile `POST /api/admin/trend-clusters/recompute {"userId":"..."}` → audit log yazıldı.
8. İkinci kullanıcı → ilk kullanıcının cluster id'si ile `/api/trend-stories/clusters/<id>` → 404.
9. Bir cluster üyesini manuel soft-delete → drawer açıldığında "Kaynak artık mevcut değil" pill.

### Quality Gate Checklist
- [ ] **Kod:** typecheck, lint, check:tokens, vitest, playwright — hepsi yeşil.
- [ ] **Davranış:** window tabs, rail, drawer, feed, bookmark snapshot, flag gate, STALE geçişi, partial state, data isolation.
- [ ] **Ürün:** UX Türkçe; empty state mesajları anlaşılır; drawer crash etmez; carry-forward 4 not bilinçli bırakıldı.
- [ ] **Stabilite:** scrape → trend enqueue zinciri non-blocking; debounce gürültüyü engelliyor; worker FAILED → job detail'de error görünür.
- [ ] **Doküman:** `docs/plans/phase4-notes.md` güncel, Phase 5+ deferred'lar net.
