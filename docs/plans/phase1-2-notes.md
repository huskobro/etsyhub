# Phase 1 + Phase 2 Tamamlanma Notları

**Tarih:** 2026-04-23
**Durum:** Tamamlandı — tüm kalite kapıları yeşil.

## Ne Eklendi

### Phase 1 — Temel Uygulama
- Docker Compose: Postgres 16 + Redis 7 + MinIO
- Next.js 14 App Router + TypeScript strict + Tailwind + shadcn-style primitives
- Zod-validated environment (`src/lib/env.ts`)
- Design tokens + CSS variable zinciri + Tailwind + iki katmanlı lint guard (ESLint AST + grep script)
- Prisma schema (20+ model) — Phase 1–10 kapsamı tek migration'da
- Prisma singleton + zorunlu admin seed + product types + aktif tema + feature flag'ler
- Pino logger, tipli hata sınıfları, id/hash helper'lar
- NextAuth v5 Credentials + JWT + custom Prisma lookup (PrismaAdapter **yok**, Account/Session tabloları **yok**)
- Auth gate: `/` → `/login` → `/dashboard`; register ekranı `registration.enabled` flag ile açılır/kapanır
- App shell: sidebar + header + tema provider + TanStack Query provider
- BullMQ queue factory (15 JobType için queue; yalnız 3 handler aktif: `ASSET_INGEST_FROM_URL`, `GENERATE_THUMBNAIL`, `BOOKMARK_PREVIEW_METADATA`)
- Provider abstraction: storage (MinIO gerçek + S3 alias) + stub ai/scraper/mockup/etsy/ocr
- Admin paneli: users, feature flags, theme (aktif seçimi), audit logs, jobs, product types

### Phase 2 — Bookmark + Reference + Collections + Assets
- Asset service: multipart upload + sha256 dedupe + Sharp metadata + user-scoped storage key
- URL import: BullMQ job → image/html og:image fetch → asset create; job status polling endpoint
- Bookmark service + API + UI (grid + filters + create dialog + data isolation tests)
- Reference service + API + UI + bookmark→reference promotion (product type zorunlu)
- Collections + Tags CRUD (tag color: semantic key whitelist — raw hex yasak)
- Bookmark & Reference card'larında inline koleksiyon/tag atama
- Dashboard: 3 sayaç + hızlı aksiyonlar (URL bookmark / görsel yükle / yeni koleksiyon) + 4 recent list (bookmark/reference/collection/job)
- Playwright e2e smoke testler (auth, bookmark, reference akışları)

## Kalite Kapıları

| Kapı | Komut | Sonuç |
|------|-------|-------|
| Typecheck | `npm run typecheck` | ✅ Geçti |
| Lint (ESLint) | `npm run lint` | ✅ No warnings/errors |
| Token check (grep) | `npm run check:tokens` | ✅ Token ihlali yok |
| Unit + integration | `npm run test` | ✅ 50/50 pass (10 test dosyası) |
| E2E (Playwright) | `npm run test:e2e` | ✅ 7/7 pass |

### Test Kapsamı Özeti
- **Unit:** env, design tokens, authorization, storage round-trip, asset service (dedupe + Sharp), bookmark service, reference service, tag service, collection service
- **Integration:** API data isolation (user A, user B bookmark görmüyor; PATCH/DELETE 403)
- **E2E:** auth gate + login + yanlış parola; bookmark URL dialog + /collections erişimi; /references + dashboard hızlı aksiyonlar

## Manifest Kontrolleri (Manuel Grep)
- `rg "#[0-9a-fA-F]{3,8}" src/` → sıfır eşleşme
- `rg "bg-\[|w-\[|h-\[|p-\[|m-\[" src/` → sıfır eşleşme
- `rg "style=\{\{" src/` → sıfır eşleşme
- Her `src/app/api/**/route.ts` `requireUser` veya `requireAdmin` çağırıyor (auth ve register route'ları hariç, bunlar bilerek public)

## Kapanan Kullanıcı Düzeltmeleri
1. **Auth stratejisi:** PrismaAdapter ve Auth.js standart tabloları yok; Credentials + JWT + custom lookup
2. **Theme akışı:** Server root layout `status=ACTIVE` tema çeker → deep-merge → ThemeProvider'a prop → CSS var inject
3. **Asset test fixture:** Gerçek Sharp-üretilmiş PNG buffer (fake bytes değil)
4. **Enum kullanımı:** Prisma enum typed import (`UserRole.USER`, `JobType.ASSET_INGEST_FROM_URL`)
5. **Lint guard:** ESLint AST + grep script iki katmanı; token scale sınıfları serbest
6. **Tag color whitelist:** `accent|success|warning|danger|muted|berry` semantic key — raw hex yasak
7. **Register default:** production'da `false`, lokal geliştirme için `.env`'de `true`
8. **Worker kapsamı:** Queue factory 15 JobType için queue oluşturur; bootstrap yalnız 3 handler başlatır

## Phase 1+2 Dışında Bırakılanlar (Bilinen Sınırlar)

Aşağıdakilerin UI hissi veya iskeleti yok — sonraki phase'lerde eklenecek. Feature flag'ler seed'de `false` olarak kayıtlı:

- `trend_stories.enabled` — Trend Stories (Phase 4)
- `competitors.enabled` — Competitor Analysis (Phase 3)
- `variations.enabled` — AI variation generation (Phase 5)
- `mockups.enabled` — Mockup Studio (Phase 8)
- `listings.enabled` — Listing Builder + Etsy draft push (Phase 9)

Ayrıca deferred:
- Etsy/Amazon özel URL parsing (listing title, review count, price, multi-image) — Phase 3
- Chrome extension / bookmarklet — Phase 3+
- AI review, selection studio — Phase 6–7
- Admin Prompt Playground, prompt versioning UI, cost usage UI, negative library UI — Phase 10
- Theme editor (aktif seçimi dışında token editor) — Phase 10
- SSE real-time güncelleme (şimdilik TanStack Query polling) — Phase 5
- Embedding tabanlı visual similarity search — Phase 5+
- Cost guardrails, multi-store switcher — Phase 3+

## Phase 3'e Girişte İlk Yapılacaklar

1. **Scraper provider abstraction'ı gerçeğe bağla** (`src/providers/scraper/`) — Apify / Firecrawl / özel scraper.
2. **Competitor store modeli aktif UI:** `/competitors` sayfası, Etsy shop URL/name ile store ekleme, review count tabanlı listing ranking.
3. **Etsy listing özel parser'ı:** `asset-ingest.worker.ts`'a Etsy/Amazon branch ekle (title, price, reviews, multi-image).
4. **`SCRAPE_COMPETITOR` + `FETCH_NEW_LISTINGS` worker'ları:** `startWorkers()` içine ekle.
5. **Source registry + scan history:** RSS/manual URL/API source desteği, scan modes (manual/auto/curated), used news registry.
6. **Feature flag aç:** `competitors.enabled`, `trend_stories.enabled`.

## Uygulama Boot Akışı (Geliştirici)

```bash
docker compose up -d
npm install
npx prisma migrate dev
npx prisma db seed
# terminal 1
npm run dev
# terminal 2
npm run worker
```

Test için:
```bash
npm run test:all   # typecheck + lint + check:tokens + vitest + playwright
```

## Kritik Kararlar Özeti

- **Landing page yok:** `/` → auth gate → dashboard.
- **Tüm görsel değerler token zinciri üzerinden:** raw hex / arbitrary value / inline style yasak; `bg-accent`, `p-4`, `rounded-md` gibi token scale sınıfları serbest.
- **Data isolation:** Her Prisma sorgusunda `userId + deletedAt: null`; her mutation `requireUser()` / `assertOwnsResource()`.
- **Queue factory tüm 15 JobType için queue oluşturur; worker bootstrap kapsama göre handler başlatır.**
- **Seed admin zorunlu; register lokal için açık, production default kapalı.**

## Teknik Borç ve Stabilizasyon Notları (2026-04-23)

Phase 1+2 kapanışından önce oturumda biriken, Phase 3'e girmeden kaydedilmesi gereken notlar:

### 1. Collection Uniqueness — Service-Level

- **Mevcut durum:** `Collection` modelinde DB seviyesinde yalnız `@@unique([userId, slug])` var. `(userId, name)` unique constraint'i yok.
- **Çözüm:** `createCollection` servisinde isim çakışması `findFirst` ile pre-check ediliyor ve `ConflictError` atılıyor. Aksi halde `uniqueSlug` helper'ı `-2`, `-3` gibi suffix üretip aynı isimli ikinci kaydı sessizce oluşturuyordu.
- **Borç:** İleride DB seviyesinde `@@unique([userId, name])` constraint'i ve buna uygun migration değerlendirilecek. Şimdilik service-level guard yeterli, test kapsamında (`tests/unit/collection-service.test.ts`).
- **Neden sertleştirilmedi:** Schema migration Phase 3 başında başka değişiklikler yapılmadan tek başına maliyetli. Phase 3'te schema dokunuşu olduğunda birlikte eklenebilir.

### 2. `.env.local` vs `prisma/.env` Kullanımı

İki ayrı env dosyası var, görevleri farklı:

- **`.env.local`** (git ignored, `dotenv/config` + Next.js otomatik):
  - Uygulama runtime'ı okuyor: `npm run dev`, `npm run worker`, Playwright test runner, Vitest
  - Tüm `src/lib/env.ts` Zod şemasına girecek değerler burada
  - Dosya mevcut değilse Next.js boot etmez
- **`prisma/.env`** (git ignored, **yalnız Prisma CLI**):
  - `prisma migrate dev`, `prisma db seed`, `prisma studio` gibi CLI komutları için
  - Sadece `DATABASE_URL` (ve gerekirse `SHADOW_DATABASE_URL`) yazılır
  - Uygulama runtime'ı bunu **okumaz**; sadece Prisma CLI okur
- **Pratik akış:** Yeni makinada `.env.example` → `.env.local` kopyalanır; `prisma/.env` içine de `DATABASE_URL` satırı elle eklenir. İki dosya içindeki `DATABASE_URL` aynı değer olmalı.
- **Borç:** Phase 3'te `scripts/setup-env.ts` gibi bir helper ile `.env.example`'dan iki hedefi birden üretmek değerlendirilebilir.

### 3. Redirect Kaynaklı Dev Log Gürültüsü — Bilinen Davranış

`/` ve admin/user guard'larındaki `redirect()` çağrıları Next.js 14'te development sunucusunda `NEXT_REDIRECT` hata stack'i olarak loglanıyor:

```
Error: NEXT_REDIRECT
    at getRedirectError (...)
```

- **Neden:** Next.js 14 App Router'da `redirect()` yapısı throw ile çalışıyor; dev modda stack trace pretty-printer tarafından yazılıyor.
- **Gerçek etki:** Yok — HTTP response 307 ile doğru çalışıyor, Playwright testleri geçiyor.
- **Not:** Bunu susturmak için try/catch eklemek veya custom logger filtresi yazmak **yapılmamalı** — kütüphane davranışı. Gerekirse Phase 3'te dev-experience için `next.config.ts` onDemandEntries veya logger filter değerlendirilebilir.

### 4. Asset URL Import — Şu An Basit Mode

`ASSET_INGEST_FROM_URL` worker'ı (`src/server/workers/asset-ingest.worker.ts`) yalnız iki dal işliyor:

1. **Direkt image URL** (`content-type: image/*`) → doğrudan asset kaydı
2. **HTML sayfa** → `<meta property="og:image">` veya `<meta name="twitter:image">` çıkar, o URL'yi tekrar fetch et, asset kaydet

**Sınırlar:**

- Etsy listing sayfasından **yalnız ana og:image** alınır. Listing title, açıklama, fiyat, review count, çoklu görsel, tag'ler, mağaza bilgisi **alınmaz**.
- Amazon listing sayfalarından sadece og:image alınır; fiyat/review/kategori parsing yok.
- Pinterest/Instagram public pin URL'leri genelde og:image veriyor; private içerikler başarısız olur.
- User-Agent başlığı yok → bazı siteler 403/redirect dönebilir (bilinen edge case).
- JavaScript-rendered sayfalar (CSR-only) og:image göstermeyebilir → başarısız olur.

**Phase 3'te eklenecek:** `SourcePlatform.ETSY` / `AMAZON` için URL detect + özel parser branch + çoklu görsel + listing metadata extraction. Bu plan aşağıdaki Phase 3 dokümanında detaylandırıldı.
