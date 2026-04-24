# Phase 4 — Trend Stories Tamamlanma Notları

Bu belge Phase 4 kapsamında yapılan işi, geçen testleri, plan üstüne eklenen 3 sıkılaştırmayı ve bilinen sınırları kayda geçirir.

## Kapsam Özeti

Phase 4'ün hedefi Phase 3'te scrape edilen rakip listing'lerini pencere bazlı (1/7/30 gün) kümelemek, kümeleri cluster rail + feed + drawer ile kullanıcıya sunmak ve feed'den doğrudan Bookmark Inbox'a atma akışını tamamlamaktı. Bunun için:

- `TrendCluster` + `TrendClusterMember` modelleri Prisma'ya eklendi; `Bookmark`'a `trendClusterId` + `trendClusterLabelSnapshot` + `trendWindowDaysSnapshot` snapshot alanları girdi.
- N-gram tabanlı saf clustering (`clusterListings`) + dinamik eşik + overlap pruning + STALE geçişi yazıldı; 100% pure, DB'siz test edilebilir.
- `TREND_CLUSTER_UPDATE` worker'ı BullMQ queue'ya eklendi; SCRAPE_COMPETITOR SUCCESS sonrası non-blocking tetikleniyor, debounce ile user-scoped recompute yapıyor.
- Kullanıcı paneli `/trend-stories` sayfası: `WindowTabs` (1G/7G/30G), `TrendClusterRail`, `TrendFeed` (cursor-based pagination), `TrendClusterDrawer` — tek `openClusterId` state ile rail + feed rozetinden açılabilir.
- Admin paneli `/admin/trend-stories/recompute` route'u + `seasonal.keywords` setting bazı hazırlandı (UI Phase 10'a erteli).
- Feature gate (`trend_stories.enabled`) hem UI hem 3 API route hem sayfa seviyesinde uygulandı.
- 235 vitest + 14 Playwright testi yeşil; Phase 4 için 14 yeni unit/integration + 5 yeni Playwright senaryosu eklendi.

## Plan Üstü 3 Sıkılaştırmanın Uygulama Haritası

Phase 4 execution sırasında plan metnine eklenen 3 kritik sıkılaştırma:

| # | Sıkılaştırma | Gerekçe | Uygulandığı Yer(ler) |
|---|--------------|---------|----------------------|
| 1 | STALE geçişi integration testi | Worker recompute sırasında eski cluster'ların silinmek yerine `status = STALE` yapılması spec'te vardı ama Task 8 ilk pass'inde koverage yoktu; incident-recovery için önemli | `tests/integration/trend-cluster-worker.test.ts > STALE transition` senaryosu + [`src/server/workers/trend-cluster.worker.ts`](../../src/server/workers/trend-cluster.worker.ts) `withdrawStaleClusters` yardımcısı |
| 2 | `membersCursor` sözleşmesi | `GET /api/trend-stories/clusters/[id]` member listesi için paginate sözleşmesi; cursor string `{addedAt}:{listingId}` compound key olarak netleştirildi; encode/decode test coverage eklendi | [`src/features/trend-stories/cursor.ts`](../../src/features/trend-stories/cursor.ts) + `tests/unit/trend-listing-cursor.test.ts` + Task 10 route'ta kullanım |
| 3 | Drawer partial-state toleransı | Cluster recompute sırasında drawer açıksa member listesi DELETED/STALE state'ine düşebilir; drawer bu durumu crash etmeden göstermeli | [`src/features/trend-stories/components/trend-cluster-drawer.tsx`](../../src/features/trend-stories/components/trend-cluster-drawer.tsx) deleted member tolerance + tombstone render pattern |

## Commit Serisi (Phase 4)

Phase 4 başlangıcı Phase 3 kapanış commit'i `34fac9c` sonrasıdır.

```
fd9edc3 test(e2e): harden trend-stories cleanup + extract fixture constants
ea83ecd test(e2e): assert trend membership badge + persisted snapshot for feed bookmark
1e7b389 test(e2e): trend-stories flow smoke (rail, drawer, feed→bookmark, window tabs, flag gate)
628a3d3 feat(trend-stories): user UI — rail + feed + drawer + window tabs + nav activation
e529595 refactor(bookmarks): lock trendClusterId to create-only path
e3d7202 feat(bookmarks): support trendClusterId with snapshot fields
5bcb29d refactor(trend-stories): extract clusters list page size constant + validate admin recompute target user (task 10 quality nits)
bcfcd32 fix(tests): mock feature-gate in trend-stories flag-gate suite to eliminate parallel DB-row race (task 10 review #2)
0669c4d fix(trend-stories): spec-aligned cursor compound + test isolation for feature flag toggles (task 10 review)
3158980 feat(api): trend-stories routes (clusters list/detail/feed) + admin recompute with data isolation + cursor pagination
d0ee18a refactor(trend-stories): reuse listing-cursor encoder + tighten membership types (task 9 nits)
ff3a32e feat(trend-stories): feed service + deterministic membership hint resolver
96a5c00 refactor(workers): document race window + clean up test fixtures (task 8 nits)
84a5b78 feat(workers): trigger trend cluster update after scrape SUCCESS (non-blocking)
2a3d0f8 test(trend-stories): cleanup dead imports and fix snapshot store cleanup scope
1e00a8f feat(workers): TREND_CLUSTER_UPDATE worker with user-scoped recompute and STALE transition
5016fa5 fix(trend-stories): enum tutarlılığı + transaction + scheduler doc
d18f532 feat(trend-stories): DB upsert recompute + feature gate + enqueue scheduler with debounce
9da62c9 feat(trend-stories): listing cursor encode/decode (firstSeenAt + listingId)
8d8f967 refactor(trend-stories): isolate recencyBoost test from windowDays confounder
9228a76 feat(trend-stories): pure clusterListings with n-gram + dynamic thresholds + overlap pruning
8a38339 refactor(trend-stories): clarify product-type dictionary order + source semantics
e174634 feat(trend-stories): normalize + product-type derive + seasonal detect helpers
2096f31 fix(trend-stories): match SEASONAL_RULES type to spec (mutable array)
d1e193f fix(trend-stories): match PRODUCT_TYPE_KEYWORDS type to spec
445c251 feat(trend-stories): constants, stop-words, seasonal + product-type keyword dictionaries
26dfdb3 feat(db): add updatedAt to TrendCluster for consistency with other models
9bf3601 feat(db): trend cluster + member models + bookmark trend snapshot fields
202525d docs(plan): phase 4 spec — unify listing-cursor naming + clarify feature-gate conversion
9105c57 docs(plan): phase 4 trend stories implementation plan
```

## Release Gate Sonuçları

- `npm run typecheck` → **PASS**
- `npm run lint` → **PASS** (0 error, 0 warning)
- `npm run check:tokens` → **PASS** (raw hex / arbitrary / inline style yok)
- `npm run test` → **235/235 PASS** (35 test dosyası; Phase 4 öncesi 173 → Phase 4 sonu 235, +62 test)
- `npx playwright test` → **14/14 PASS** (auth, bookmark, reference, competitor, trend-stories smoke)
- Manifest grep:
  - `rg "#[0-9a-fA-F]{3,8}" src/` → eşleşme yok
  - `rg "bg-\[" src/` → eşleşme yok
  - Tüm `src/app/api/trend-stories/**/route.ts` (3/3) `requireUser()` + `assertTrendStoriesAvailable()` çağırıyor
  - Admin recompute route'u `requireAdmin()` çağırıyor

## Bilinen Sınırlar ve Kasıtlı Ertelemeler (Phase 5+)

Plan'ın Known Limitations listesinden devreden ve Phase 4 execution sırasında netleşen maddeler:

- **Embedding tabanlı cluster birleştirme (Phase 5+)**: Şu an n-gram Jaccard + dinamik eşik; aynı ürünü farklı kelimelerle anlatan listing'ler ayrı cluster'a düşebilir. Visual/text embedding similarity Phase 5'te eklenecek.
- **Admin seasonal keyword UI (Phase 10)**: `seasonal.keywords` setting-store key'i hazır, fakat `/admin/trend-stories` ekranında yönetim UI'ı yok. Şu an admin `SettingsRegistry` üzerinden elle ekleyebilir.
- **Batch cluster bookmark**: Kullanıcı bir cluster'ı açıp tek tıkla tüm member'ları Bookmark Inbox'a atamıyor; tek tek butonla gidiyor. Phase 5 içinde "Tüm cluster'ı bookmark'a at" toplu aksiyonu düşünülebilir.
- **Cluster archive / mute UI**: Kullanıcı artık takip etmek istemediği cluster'ı elle gizleyemiyor. Sadece STALE geçişine (window dışına kayma) güveniyor. "Cluster'ı gizle" kullanıcı aksiyonu yok.
- **Cross-user trend leaderboard**: Her user'ın cluster'ı user-scoped recompute ile izole; "genel olarak en çok konuşulan trend" global leaderboard yok. Gizlilik gerekçesiyle erteli.
- **SSE real-time trend güncellemesi (Phase 5+)**: Recompute sonrası UI TanStack Query `invalidateQueries` ile yeni veriyi çekiyor; SSE push yok. Worker tamamlandığında kullanıcı sayfayı refresh etmeli veya tab değiştirmeli.
- **Trend → varyasyon akışı (Phase 5)**: Drawer'da "Bu cluster'dan varyasyon üret" kısayolu yok. Phase 5 Variation Generation aktifleştiğinde reference → variation akışının yanına eklenecek.

## Grooming Backlog (Phase 5+ refactor adayları)

Task 10–13 code quality review'larından toplanan 🟡/🟢 non-blocking maddeler:

**Task 10–11:**
- Shared cluster serializer: `trend-cluster-drawer.tsx` + feed membership hint + clusters-rail üçü de cluster → DTO dönüşümü yapıyor; ortak serializer
- Hero DELETED consistency: Drawer hero render'ı ile rail kart render'ı arasında DELETED/STALE tombstone stilinde ufak farklar
- Shared test helpers: `tests/integration/trend-cluster-worker.test.ts` ve `api-trend-stories.test.ts`'de tekrarlanan fixture setup'ı
- Feed flag-gate test: `GET /api/trend-stories/feed` için trend_stories.enabled kapalıyken 404 döndüğünü doğrulayan integration testi yok (clusters route'larında var)
- Params type style: Next.js 14 `params: Promise<{id:string}>` vs `{params: {id: string}}` stil tutarsızlığı bir-iki route'ta
- `mockBullCounter` factory: test utility olarak her route testinde yeniden tanımlanıyor
- Prisma index verification: `TrendClusterMember(clusterId, listingId)` composite index beklendiği gibi kullanılıyor mu `EXPLAIN` ile doğrula
- Redundant null-check: `trend-feed.tsx` içinde bir `?? null` zinciri
- `bookmark-trend-snapshot` afterEach cleanup: test'te `db.bookmark.deleteMany` kapsamı daraltılabilir
- `ensureOwnedEntity` helper: trend routes'ta tekrarlanan "user bu cluster'ın sahibi mi" kontrolü
- `listBookmarks` trendClusterId filter/sort: Phase 2 bookmark servisine trend filtresi eklenebilir
- Prisma `onDelete: SetNull` regression testi: bookmark'ın trendClusterId'si, cluster silindiğinde NULL olmalı

**Task 12:**
- Shared `<Dialog>` primitive: drawer + bookmark-create-dialog + competitor-add-dialog üç ayrı implementation
- Shared `useToast` hook: TrendStoriesPage'in inline toast state'i + competitor page'in benzer pattern'i
- `ClusterDetailInfo` type re-export: drawer + feed + rail farklı import path'leri
- TrendFeed cursor reset via useEffect: şu an `key={feed-${windowDays}}` remount tetikliyor; useEffect ile cursor state reset daha temiz
- Cursor-string list keys: map key'de cursor string kullanılıyor, idx yerine cursor'ın kendisi daha stabil
- Deleted member tombstone styling: drawer'da DELETED member render'ı minimal, "silinmiş listing" etiketi daha görünür olabilir

**Task 13 (E2E):**
- `feedCard.first()` ordering assumption comment: testte ilk feed card'ı alıyoruz; sıralama `firstSeenAt DESC` varsayımı yoruma yazılmalı
- `test.step()` splitting: 316 satırlık single-file senaryolar `test.step` ile okunabilirlik arttırılabilir
- `crypto.randomUUID()` for workers>1: şu an `Date.now().toString(36)`; `workers:1` ile güvenli ama paralelleşirse çakışabilir
- Drawer `toBeHidden` animation comment: animasyon bitmeden assertion koşulabileceği için waitFor gerekirse
- `Promise.all` ordering comment: cleanup'ta `Promise.all` kullanıyoruz, bağımlılık yok ama not düşülebilir

## Phase 3 → Phase 4 Taşınan Maddeler

- **`<img>` etiketi rakip thumbnail'larında**: Phase 3 notes'ta kayıtlı; Phase 4'te trend rail + feed + drawer aynı `<img>` pattern'ini kullandı. Remote pattern whitelist çözümü hâlâ Phase 10'a erteli.
- **Playwright pino child thread error**: Dev log'da gürültü olmaya devam ediyor, test sonuçlarını etkilemiyor.
- **Audit pattern tutarsızlığı**: Phase 3'te competitor mutation'larına eklenen `audit()` Phase 4'te trend recompute route'una da eklendi (admin action). Bookmark/reference mutation'ları hâlâ audit'siz.
- **`FETCH_NEW_LISTINGS` cron'u**: Phase 3'te 06:00 günlük; Phase 4 trend cluster'ları bu cron'un çıktısına bağımlı. 1G pencere için 6 saatte bir tetiklemeye yükseltilebilir — hâlâ erteli.

## Phase 5'e Girişte İlk Yapılacaklar

1. **Variation Generation** için AI provider abstraction'ı (scraper'da kullanılan pattern'i taklit et — self-hosted / openai / replicate / fal.ai).
2. **Master prompt sistemi** (PromptTemplate + PromptVersion modelleri Prisma'da hazır; UI Phase 10'da); Phase 5 generate step bu template'leri kullanacak.
3. **Trend → variation köprüsü**: Drawer'a "Bu cluster'dan varyasyon üret" butonu; cluster hero listing'i otomatik reference olarak kullanılsın.
4. **Similarity control**: close / medium / loose / inspired seviyeleri Phase 5 prompt parametresine map edilecek; `clusterListings` n-gram similarity threshold'u bu seviyelerle aynı kategoride değil — ayrı tut.
5. **Cost guardrail**: CostUsage modeli Phase 1'de hazır; Phase 5 generate job'ı ilk gerçek usage yazacak provider.
6. **SSE real-time**: Phase 5 generate job'ları uzun sürdüğü için SSE altyapısı Phase 5'te kurulmalı; Phase 4 trend recompute bu altyapıdan retroaktif faydalanabilir.

## Final Durum

Phase 4 planının tüm 14 task'ı tamamlandı, tüm release gate'leri yeşil. Trend Stories modülü hem UI hem backend hem worker + cron entegrasyonu hem feature gate ile production-ready. Phase 5'e (Variation Generation) geçişe hazır.
