# Kivasy

Kivasy, **Etsy satıcıları için bir dijital ürün üretim sistemidir**. Kullanıcı referans
toplar, AI ile tasarım varyasyonları üretir, kalite kontrolünden geçirir, kürasyon
yapar, mockup uygular ve Etsy'ye **draft listing** olarak gönderir. Localhost-first
çalışır; ileride macOS / Windows native app'e (Tauri) taşınabilecek şekilde
tasarlanır.

> Not: Repo slug, mevcut git geçmişiyle uyum için şimdilik `EtsyHub` olarak kalmaya
> devam eder. **Public-facing ürün adı `Kivasy`'dir** ve yeni dokümanlar, marka
> dili, Claude Design handoff bu adı kullanır.

---

## Ürün scope'u

Kivasy **dijital indirilebilir ürünler** için tasarlanmıştır. Kullanıcının ürettiği
çıktılar Etsy'de "Digital Download" olarak listelenir.

**Desteklenen ürün tipleri:**

- Clipart bundle
- Wall art (canvas / poster / framed — dijital dosya olarak)
- Bookmark (kitap ayracı, dijital indirilebilir)
- Sticker / printable (sticker sheet, transparent PNG setleri)
- Genel digital download paketleri

**Dijital teslim formatları:**

- ZIP (bundle)
- PNG (transparent veya raster)
- PDF (printable, sheet)
- JPG / JPEG (raster çıktı)

**Bu ürün ne değildir:**

- Fiziksel print-on-demand (POD) aracı değildir.
- Print partner / fulfillment / shipping / kargo entegrasyonu yoktur.
- Garment POD aracı değildir (t-shirt, hoodie, mug, DTF gibi giysi/eşya
  ürünleri kapsam dışıdır).
- Made-to-order / "üretim partneri" akışı yoktur.

Mockup'lar **dijital listing sunumu** için kullanılır — fiziksel üretim için
değil.

---

## Ana workflow

```
Reference  →  Batch  →  Library  →  Selection  →  Product  →  Etsy Draft
```

| Aşama | Ne yapar |
|---|---|
| **Reference** | Üretim öncesi kaynak havuzu — referanslar, ilham fragmanları, rakip stories, bookmark inbox, koleksiyonlar |
| **Batch** | AI variation jobs — referanstan tasarım varyasyonu üretimi, retry-failed-only, review |
| **Library** | Üretilmiş tüm asset'lerin tek doğruluk kaynağı — filter, lineage, geçmiş |
| **Selection** | Kürasyon — Library'den seçilmiş + organize edilmiş set'ler, edit operasyonları (background remove, color edit, crop, upscale) |
| **Product** | Mockup'lanmış + bundle preview hazırlanmış + listing metadata'sı doldurulmuş + Etsy'ye gidecek paket |
| **Etsy Draft** | Etsy Open API üzerinden draft olarak gönderilir; **direct active publish yok** — kullanıcı onayı zorunlu |

Kullanıcı ayrıca **kendi tasarımlarını** sisteme yükleyip aynı pipeline'a sokabilir
(Library → Selection → Product → Etsy).

---

## Mockup modeli (3 tip)

Kivasy'de mockup tek tip değildir. Apply Mockups akışı 3 sınıfı destekler:

1. **Lifestyle mockups** — bağlamsal sunum (wall art duvarda, clipart masada,
   bookmark kitabın içinde, sticker laptop'ta).
2. **Bundle preview sheets** — alıcının ne aldığını gösterir ("25 PNG dahil",
   sticker sheet preview, multi-piece wall art set).
3. **User-uploaded custom templates** — kullanıcı kendi PSD / template
   dosyasını yükler; `Templates` altındaki `Mockup Templates` alt-tipinde
   yaşar ve Products genelinde yeniden kullanılır.

---

## Kullanım ölçeği

Aynı arayüz iki uçta da çalışır:

- **Küçük iş:** 1 batch, birkaç referans, ~4–10 varyasyon, bir selection set,
  birkaç mockup, tek Etsy draft. ~15 dakikada biter.
- **Büyük operasyon:** 10+ batch, 200+ asset, bulk review, bulk selection,
  multi-mockup uygulama, çoklu draft. Saatler boyu sürer.

UI küçük işte hafif ve hızlı, büyük işte güçlü ve organize hissetmelidir.
Density toggle, virtualized grid, floating action bar (bulk-select), chip
preset filtreler, keyboard-first review desteklenir.

---

## Platform hedefi

- **Desktop web (bugün)** — birincil çalışma ortamı.
- **Mobile web (bugün)** — browse, status check, küçük iş, hafif kararlar.
  Yüksek-yoğunluk operasyonları desktop'ta kalabilir; mobile'da çökmemeli.
- **Native macOS / Windows (gelecek)** — Tauri shell üzerinde paketlenebilir.
  App shell (sidebar + main + persistent task panel) bu geçişte korunmalı.
  Browser-only pattern'lerden kaçınılır.

---

## Teknoloji omurgası

- **Frontend:** Next.js 14 App Router · TypeScript strict · Tailwind · CSS
  variables tabanlı design token sistemi
- **Backend:** Next.js server actions + API routes · Prisma
- **Veritabanı:** PostgreSQL 16 (WAL)
- **Queue:** Redis 7 + BullMQ
- **Storage:** MinIO (S3-uyumlu) — provider abstraction
- **Auth:** NextAuth v5 Credentials + JWT + bcryptjs (multi-user, per-row
  `userId` filter zorunlu)
- **AI:** Midjourney (describe / generate / image-prompt API-first; `--sref`,
  `--oref`, `--ow`, `--cref`); KIE provider (GPT Image 1.5, Z-Image); Gemini
  2.5 Flash (review)
- **Test:** Vitest (unit + integration) + Playwright (e2e)

---

## Roller

- **User** — kendi referanslarını, batch'lerini, library'sini, selection'larını,
  product'larını ve Etsy bağlantısını yönetir.
- **Admin** — provider config, prompt templates, mockup templates, feature
  flags, theme, users, audit logs, cost usage. Admin scope **ayrı bir
  uygulama değil**, role-based bir görünüm katmanıdır.

Super admin yoktur. Multi-user veri izolasyonu zorunludur (UI'da gizlemek
yetmez, backend authorization zorunlu).

---

## Şu an nerede? (Implementation rollouts)

Kapasite olarak ürün omurgası **çalışıyor**. İmplementation rollout'u Kivasy
design system'e geçişi getirir; mevcut durum:

| Rollout | Kapsam | Durum |
|---|---|---|
| **R1** | Tokens + shell + sidebar (8/2 IA) + middleware redirects | ✓ Done |
| **R2** | Library (A1) — virtualized grid, density, bulk-select, detail panel | ✓ Done |
| **R3** | Batches index (A2) + Batch detail (A3) + Review workspace (A4 dark) + A6 Create Variations + Active Tasks data wire | ✓ Done |
| **R3.5** | Visual parity cleanup — token re-bind, font stack, .k-btn/.k-card--hero recipes, sidebar gradient, stale docs sync | ✓ Done (this commit) |
| **R4** | Selections (B2 + B3) + edit modals + handoff wires | ⏳ Next |
| **R5** | Products (A5 detail + A7 Apply Mockups + B6 Generate Listing) | ⏳ |
| **R6** | References (B1 — Pool/Stories/Inbox/Shops/Collections konsolidasyon) | ⏳ |
| **R7** | Templates (C1) + Settings (C2) + D1 AI Providers pane | ⏳ |
| **R8** | Overview rework (C3 — pipeline pulse, pending actions, recent activity) | ⏳ |

**Bilgi mimarisi yenileniyor:** mevcut top-level yüzeyler birleştiriliyor.
Yeni IA için bkz. [`docs/CLAUDE_DESIGN_CONTEXT.md`](docs/CLAUDE_DESIGN_CONTEXT.md).

**Çalışan capability'ler:**

- Bookmark / Reference / Collection iş akışı + multi-user veri izolasyonu
- Etsy rakip mağaza tarama, trend cluster tespiti
- AI Mode variation generation (KIE GPT Image 1.5 + Z-Image, per-user
  `kieApiKey`)
- Local Mode variation generation (disk asset'leri reference)
- AI Quality Review (Sharp deterministic alpha + KIE Gemini 2.5 Flash;
  USER override sticky; risk flag detection; conservative cost tracking)
- Midjourney describe / generate / image-prompt API-first; sref/oref/ow/cref
- Variation V1, batch generation, retry-failed-only
- Asset Library V1, Batch Review Studio V1, Kept Handoff, Selection
  Workspace V1
- Mockup apply (lifestyle), Selection Studio (background removal, color
  editor, crop, Magic Eraser inpainting via LaMa)
- Listing draft + Etsy OAuth + draft push (direct publish yok)
- Admin: prompt versioning, AI/scraper provider config, cost usage, audit
  logs, feature flags

**Bilgi mimarisi yenileniyor:** mevcut top-level yüzeyler birleştiriliyor.
Yeni IA için bkz. [`docs/CLAUDE_DESIGN_CONTEXT.md`](docs/CLAUDE_DESIGN_CONTEXT.md).

---

## Gereksinimler

- Node.js 20+
- Docker + Docker Compose
- npm 10+

## Hızlı başlangıç

```bash
# 1) Altyapı servislerini başlat
docker compose up -d

# 2) Bağımlılıkları yükle
npm install

# 3) Ortam değişkenlerini kopyala
cp .env.example .env.local

# 4) Veritabanını hazırla ve seed et
npx prisma migrate dev
npx prisma db seed

# 5) Dev server (ayrı terminal)
npm run dev

# 6) Worker process (ayrı terminal)
npm run worker
```

Admin girişi için `.env.local` dosyasındaki `ADMIN_EMAIL` / `ADMIN_PASSWORD`
değerlerini kullan.

### Magic Eraser kurulumu (opsiyonel)

Selection Studio'daki Magic Eraser (LaMa inpainting) Python subprocess
gerektirir. Worker `MAGIC_ERASER_INPAINT` job'unu picked up ettikten sonra
runner'ı çağırır.

**Production (gerçek LaMa):**

```bash
pip install simple-lama-inpainting Pillow
# .env.local
# MAGIC_ERASER_PYTHON=python3   # default; LaMa'nın yüklü olduğu Python'a yönlendir
```

İlk çağrı ~5-15 saniye (model lazy load); sonraki çağrılar ~1-3 saniye.
Worker concurrency 1 (4096×4096 ~1-2GB RAM peak).

**QA / mock (LaMa kurulu değil):**

```bash
pip install Pillow
# .env.local
# MAGIC_ERASER_RUNNER_OVERRIDE=$(pwd)/scripts/magic-eraser-mock-runner.py
```

Mock runner maskelenen alanı **gri** ile boyar (gerçek inpainting değil — UI
smoke için yeterli sinyal).

## Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | Next.js dev server |
| `npm run worker` | BullMQ worker süreci |
| `npm run build` | Production build |
| `npm run test` | Vitest unit + integration testleri |
| `npm run test:e2e` | Playwright e2e testleri |
| `npm run test:all` | Tüm kalite kapıları: typecheck + lint + token check + test + e2e |
| `npm run check:tokens` | Design token ihlallerini tara |
| `npm run db:migrate` | Prisma migration |
| `npm run db:seed` | Veritabanı seed |
| `npm run db:reset` | Veritabanını sıfırla + yeniden seed |

---

## Source-of-truth links

Repo'yu açan biri için tek-bakışta:

- **Project rules** → [`CLAUDE.md`](CLAUDE.md)
- **Implementation handoff** → [`docs/IMPLEMENTATION_HANDOFF.md`](docs/IMPLEMENTATION_HANDOFF.md)
  (rollout sırası, invariant'lar, surface→wave eşleşmesi)
- **Design system (Kivasy)** → [`docs/design-system/kivasy/`](docs/design-system/kivasy/)
  - Live UI kits: `ui_kits/kivasy/v4.html` (A1-A7), `v5.html` (B1-B6),
    `v6.html` (C1-C3), `v7.html` (D1-D2)
  - Tokens: `ui_kits/kivasy/v4/tokens.css`
- **Design context (handoff brief)** → [`docs/CLAUDE_DESIGN_CONTEXT.md`](docs/CLAUDE_DESIGN_CONTEXT.md)
- **Design parity checkpoint** → [`docs/DESIGN_PARITY_CHECKPOINT.md`](docs/DESIGN_PARITY_CHECKPOINT.md)
  (her rollout sonu uygulanır)

## Local preview (live app + design reference yan yana)

İki kanal:

**1. Canlı uygulama:**

```bash
docker compose up -d        # Postgres + Redis + MinIO
npm run dev                 # localhost:3000
npm run worker              # ayrı terminal — BullMQ worker
```

**2. Kivasy design system UI kits (tasarım referansı):**

UI kit dosyaları self-contained HTML — doğrudan tarayıcıda açılır:

```bash
open "docs/design-system/kivasy/ui_kits/kivasy/Kivasy UI Kit v4.html"
open "docs/design-system/kivasy/ui_kits/kivasy/Kivasy UI Kit v5.html"
open "docs/design-system/kivasy/ui_kits/kivasy/Kivasy UI Kit v6.html"
open "docs/design-system/kivasy/ui_kits/kivasy/Kivasy UI Kit v7.html"
```

Tasarım referansı + canlı app yan yana açıkken parity checkpoint'i (Cmd+K
palette / sidebar / tipografi / button gradient / sidebar gradient) gözle
doğrulanır. Kuralı için → [`docs/DESIGN_PARITY_CHECKPOINT.md`](docs/DESIGN_PARITY_CHECKPOINT.md).

## History (ignored — referans alma)

- [`docs/plans/`](docs/plans/) — geçmiş phase planları
- [`docs/design/`](docs/design/) — pre-Kivasy "Editorial Cockpit" history.
  [`docs/design/HISTORY.md`](docs/design/HISTORY.md)'de neyin neyle
  superseded olduğu yazılı.

## Lisans

Şu an lisans belirtilmemiştir; tüm haklar saklıdır.
