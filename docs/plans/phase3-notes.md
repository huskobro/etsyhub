# Phase 3 — Competitor Analysis Tamamlanma Notları

Bu belge Phase 3 kapsamında yapılan işi, geçen testleri, uygulanan düzeltme maddelerini ve bilinen sınırları kayda geçirir.

## Kapsam Özeti

Phase 3'ün hedefi rakip Etsy mağazalarını taramak, her listing için review count tabanlı sinyal üretmek ve kullanıcıya pencere (30/90/365/tümü) bazlı ranking göstermekti. Bunun için:

- Scraper provider abstraction (`self-hosted`, `apify`, `firecrawl`) eklendi.
- CompetitorStore / CompetitorListing / CompetitorScan modelleri Prisma'ya girdi.
- 2 yeni worker (`SCRAPE_COMPETITOR`, `FETCH_NEW_LISTINGS`) devreye alındı, günlük 06:00 cron idempotent repeat scheduler'ı kuruldu.
- Kullanıcı paneli `/competitors` + `/competitors/[id]` ekranları yazıldı.
- Admin paneli `/admin/scraper-providers` ekranı AES-256-GCM şifreli API key yönetimini sağladı.
- 173 vitest + 9 Playwright smoke testi yeşil, ek olarak 14 competitor integration testi eklendi.

## 8 Düzeltme Maddesinin Uygulama Haritası

| # | Düzeltme | Uygulandığı Yer(ler) |
|---|----------|----------------------|
| 1 | Canonical normalization (`etsyShopName`, `shopUrl`, `externalId`) | `src/features/competitors/services/competitor-service.ts` + `normalizeShopName/Url/ExternalId` helper'ları; Task 6 |
| 2 | Tarih alanı ayrımı (`listingCreatedAt`, `latestReviewAt`, `lastSeenAt`) ve window filter önceliği | `CompetitorListing` modeli, `ranking-service.ts > filterByWindow`; Task 6 |
| 3 | Parser debug & confidence (`parseWarnings`, `parserSource`, `parserConfidence`) | `ScrapedListing` tipi + her parser; Task 3-5 |
| 4 | Soft-fail parsing (tek alan hatası tüm listing'i düşürmesin) | Parser'lar try/catch ile alan bazlı; Task 3-5 |
| 5 | Repeat job tekilleştirme (cron duplicate olmasın) | `src/server/queue.ts > scheduleRepeatJob` `getRepeatableJobs` filter; Task 8 |
| 6 | Provider config abstraction (UI/service DB'ye doğrudan dokunmasın) | `src/providers/scraper/provider-config.ts > getScraperConfig/updateScraperConfig`; Task 10 |
| 7 | Review count disclaimer ("kesin satış değil") | `src/features/competitors/constants.ts > REVIEW_COUNT_DISCLAIMER` single source; Task 9 + 11 |
| 8 | Asset-ingest Etsy/Amazon branch + generic og:image fallback korunsun | `src/server/workers/asset-ingest.worker.ts > tryParserBranch`; Task 12 |

## Commit Serisi (Phase 3)

```
8617586 feat(e2e): competitor-flow smoke test + enable competitors.enabled flag
fc320fc feat(workers): asset-ingest Etsy/Amazon parser branch with generic og:image fallback
d081871 feat(competitors): user UI — list/detail page, ranking grid, review disclaimer, bookmark action
208c4f1 feat(admin): scraper provider settings UI + encrypted API keys via provider-config abstraction
dcb05c7 feat(api): competitor routes (list/create/detail/delete/scan/listings) + ranking + data isolation
0ed06fc feat(workers): FETCH_NEW_LISTINGS scheduler + idempotent repeat + cron 06:00
851e092 feat(workers): SCRAPE_COMPETITOR worker + 7d grace soft-delete + scan aggregation
172ba8a feat(competitors): service + ranking + canonical normalization + review disclaimer
592aeba feat(scraper): apify provider (etsy store + listing actors)
77d512d feat(scraper): self-hosted etsy/amazon parser + rate-limited scan
2ee7edd feat(scraper): provider abstraction + factory + stubs
c5c1b6a feat(lib): AES-GCM secrets helper for provider API keys
df69c91 feat(db): competitor listings + scans models for Phase 3
5e001f3 docs(plan): phase 3 competitor analysis implementation plan
```

## Release Gate Sonuçları

- `npm run typecheck` → PASS
- `npm run lint` → PASS (0 error, 0 warning)
- `npm run check:tokens` → PASS (raw hex / arbitrary / inline style yok)
- `npm run test` → **173/173 PASS** (23 test dosyası)
- `npx playwright test` → **9/9 PASS** (auth, bookmark, reference, competitor flow)
- Manifest grep:
  - `rg "#[0-9a-fA-F]{3,8}" src/` → eşleşme yok
  - `rg "bg-\[" src/` → eşleşme yok
  - Tüm `src/app/api/competitors/**/route.ts` (4/4) `requireUser()` çağırıyor
  - Tüm `src/app/api/admin/scraper-config/route.ts` `requireAdmin()` çağırıyor

## Bilinen Sınırlar ve Kasıtlı Ertelemeler

- **Trend Stories UI (Phase 4)**: Rakip listingleri story/card akışıyla sunan ekran yok. `competitors.enabled` flag bugün `true`; `trend_stories.enabled` hâlâ `false`.
- **Trend Cluster Detection (Phase 4)**: Benzer konu clusterlama yok.
- **Embedding tabanlı similarity (Phase 5+)**: Duplicate detection şu an yalnızca `(competitorStoreId, externalId)` unique constraint seviyesinde.
- **Rakip silme UI'ı**: `DELETE /api/competitors/[id]` endpoint'i hazır fakat kullanıcı arayüzünde silme butonu Phase 3'te eklenmedi. Plan Task 13 bunu istemiyordu.
- **API route gating**: `competitors.enabled` bayrağı yalnızca UI/nav gating için kullanılıyor. API route'ları bayrağa bakmıyor — kapalı bayrakla da authenticated kullanıcı endpoint'e çarpabilir. Bu plan'la uyumlu; trend/competitor UI kapandığında endpoint'lerin de kapatılması gerekirse Phase 4+ planında ele alınmalı.
- **Amazon parser scope**: `parseAmazonListing` yalnızca og:title + og:image + `#acrCustomerReviewText` tabanlı temel alanları çıkarır; Amazon A+ content / variations / price history yok.
- **Scraper fail retry stratejisi**: Worker'lar BullMQ default retry'ına güveniyor. Per-provider exponential backoff ve cost guardrail (Phase 5+ plan'da) devreye alınmadı.

## Geçici Çözümler / Bilinen Artifact'lar

- **`<img>` etiketi rakip listing thumbnail'larında**: Next.js `<Image/>` remote pattern config gerektiriyor; scraper çıktıları çok çeşitli host'lardan geliyor. Şimdilik `<img>` + `eslint-disable-next-line @next/next/no-img-element` kullanıldı. Kalıcı çözüm: admin'e remote pattern whitelist ekranı veya image proxy.
- **Playwright webServer pino child thread error**: Dev mode'da `Cannot find module '.next/server/vendor-chunks/lib/worker.js'` uyarıları log'da görünüyor. Test sonuçlarını etkilemiyor (9/9 PASS) ama gürültü. Çözüm önerisi: `pino-pretty` transport'u dev'de kullanmaktan vazgeçip doğrudan stdout'a yazmak.
- **`api-competitors.test.ts > POST geçerli gövde` flaky riski**: Paralel vitest run'ında `bullJobId` unique constraint çakışması olasılığı (ilk Task 10 run'ında gözlemlenmişti). Sonraki task'lardaki full-suite run'larında tekrar üretilemedi. Uzun vadede mock fixture'da bullJobId'ye test-unique suffix eklenmeli.
- **Audit pattern tutarsızlığı**: Competitor mutation'larına `audit()` eklendi (düzeltme talimatı gereği), fakat bookmark/reference mutation'larında yok. Gelecek refactor'da ya tümüne ya da hiçbirine — admin panel Audit Logs ekranı bugün yalnızca admin aksiyonlarını + competitor aksiyonlarını gösteriyor.

## Phase 4'e Girişte İlk Yapılacaklar

1. Trend Stories UI (story akışı / swipe / kaydır) için veri kaynağı: `CompetitorListing` `listingCreatedAt` DESC sıralı, son 7 gün.
2. Trend cluster detection (benzer başlık / benzer thumbnail) — embedding tabanlı başlamadan önce basit n-gram başlık clusterlama prototipi.
3. Trend ekranı feature flag: `trend_stories.enabled` admin panelinden açılabilir.
4. `FETCH_NEW_LISTINGS` worker'ı Phase 3'te günlük 06:00'da tetikleniyor — Phase 4'te Trend Stories story'lerinin tazeliği bu cron'a bağımlı; gerekirse 4 saatte bir tetiklemeye yükseltilebilir.

## Final Durum

Phase 3 planının tüm 14 task'ı tamamlandı, tüm release gate'leri yeşil. Phase 4'e (Trend Stories + Trend Cluster Detection) geçişe hazır.
