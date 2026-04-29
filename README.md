# EtsyHub

Localhost-first Etsy / POD productivity web app. Farklı ürünlerden ilham alan bağımsız bir ürün.

## Mevcut Durum (2026-04-29)

Phase 1–5 production-ready. **Phase 6 (AI Quality Review)** AI mode canlı çalışır durumda; local mode Aşama 2B (KIE data URL probe sonrası) bekliyor.

**Önemli dürüstlük notları:**

- Phase 6 AI mode review canlı çalışır — KIE.ai üzerinden Gemini 2.5 Flash; signed URL → multimodal chat/completions → strict JSON schema (veya `json_object` fallback). Aşama 2A (2026-04-29) kapanışı.
- Local mode review Aşama 2B bekliyor: KIE'nin data URL desteği canlı smoke'da test edilecek; sonuca göre küçük patch (`image-loader.ts` local-path data URL inline) veya orta patch (MinIO temp upload bridge). Şu an local + KIE = explicit throw `"KIE local review henüz etkin değil; Aşama 2B bekleniyor."`.
- `google-gemini-flash` provider Google API direct yolu mock-tested; canlı doğrulama opsiyonel (kullanıcının canlı Google key'i yok; pratikte KIE üzerinden gidiliyor).
- Phase 6 cost tracking **conservative estimate** kullanır (1 cent/review, daily $10/user); gerçek KIE/Gemini faturalama değildir. Aşama 2A sonrası AI mode review'larda CostUsage tablosu dolar.

**Bugün gerçekten ne yapıyor:**

- Etsy / Amazon rakip mağaza tarama, yeni listing kümeleri (trend) tespiti
- Bookmark → Reference → Collection iş akışı, multi-user veri izolasyonu
- **AI Mode variation generation:** Reference görselden 6–12 varyasyon, KIE GPT Image 1.5 + Z-Image provider'ları üzerinden, per-user `kieApiKey` ile
- **Local Mode variation generation:** Disk'teki PNG/JPG asset'lerini reference olarak işaretleme + alpha/DPI/boyut tabanlı kalite skoru
- **AI Quality Review (Phase 6, Aşama 2A — AI mode canlı; local Aşama 2B bekliyor):**
  - Review provider seçimi (`/settings` → AI Mode): `kie` (önerilen, default; AI mode canlı KIE Gemini 2.5 Flash) veya `google-gemini` (ileri seviye)
  - AI tasarımları için `GENERATE_VARIATIONS` SUCCESS sonrası otomatik review job tetiklenir
  - Local asset'ler için `POST /api/review/local-batch` ile manuel batch (Aşama 2A: KIE seçili kullanıcıda local job FAIL — "Aşama 2B bekleniyor" yön mesajı)
  - Hibrit pipeline mimarisi: Sharp deterministic alpha kontrolleri (sadece transparent ürünlerde) + provider-selectable LLM (KIE.ai chat/completions multimodal veya Google Gemini direct mock-tested)
  - 8 sabit risk flag türü (watermark, signature, logo, celebrity face, alpha, edge artifact, text, gibberish text)
  - Karar kuralı: `risk_flags > 0` veya `score < 60` ⇒ NEEDS_REVIEW; `score ≥ 90` + risk yok ⇒ APPROVED; aksi NEEDS_REVIEW (güvenli varsayılan)
  - USER override sticky (R12): "Approve anyway" sonrası SYSTEM yazımı race-safe `updateMany` ile engellenir
  - `/review` queue UI: iki sekme (AI Tasarımları / Local Library), kart grid, status badge, USER/SYSTEM görünür rozet, detay drawer, bulk approve (skip-on-risk) + bulk reject + bulk delete (typing confirmation "SİL")
- **Conservative cost tracking (Phase 6 Task 18):** Her review çağrısı `CostUsage` tablosuna 1 cent estimate olarak yazılır (gerçek Gemini faturalama değil — minimum hesap birimi $0.01 nedeniyle yuvarlanmış sabit). Daily limit: $10/gün/kullanıcı; aşımda explicit throw, sessiz skip yok. Real-time pricing + admin settings carry-forward.
- Provider snapshot + prompt snapshot her review yazımında persist edilir (CLAUDE.md kuralı)
- Admin paneli: prompt versioning, AI/scraper provider config, cost usage, audit logs, feature flags

**Henüz çalışmayan / eksik (dürüstlük):**

- **KIE local review (Aşama 2B bekliyor — data URL probe sonrası kapsam netleşir)** — local mode + `reviewProvider: "kie"` durumunda job FAIL (yön mesajı: `"KIE local review henüz etkin değil; Aşama 2B bekleniyor."`). Aşama 2B'de KIE'nin data URL desteği canlı smoke'da test edilip kapsam (küçük data URL patch / orta MinIO upload bridge) seçilecek
- KIE strict JSON schema vs `json_object` fallback canlı davranışı smoke'ta gözlemlenecek (heuristic kod hazır; gerçek KIE error format'ı bilinmiyor)
- Direct Google Gemini provider canlı doğrulanmadı (`google-gemini` seçeneği mock testleriyle çalışır; kullanıcı canlı Google `geminiApiKey` girerse çalışabilir ama smoke yapılmadı)
- Real-time cost pricing yok (conservative 1 cent estimate; carry-forward `cost-real-time-pricing`)
- Admin cost-usage UI yok (carry-forward `cost-budget-settings-ui`)
- Generate-variations cost tracking yok (Phase 5 KIE provider için; carry-forward `generate-variations-cost-tracking`)
- Selection Studio, Mockup Studio, Listing Builder, Etsy draft push: **Phase 7+ scope dışı**

## Local Mode vs AI Mode

İki bağımsız akış aynı pipeline'ı paylaşır:

| | AI Mode | Local Mode |
|---|---------|------------|
| Reference kaynağı | Bookmark → Reference promote | Local Library (disk klasör) |
| Variation üretimi | KIE provider (per-user `kieApiKey`) | Yok — sadece review akışı |
| Review tetikleyici | Otomatik (variation success sonrası enqueue) | Manuel batch (`POST /api/review/local-batch`) |
| Image input | Signed URL (R2/MinIO 1h TTL) | Local file path |
| Alpha checks | Atlanır (LLM yeterli) | Çalışır (transparent ürünlerde) |
| Audit trail | `DesignReview` tablosu | Asset row'unda inline |

İki mod da aynı `REVIEW_DESIGN` worker'dan geçer (scope discriminated union ile ayrılır).

## Mimari Omurga

**Workers (`src/server/workers/`):**
- `generate-variations.worker.ts` — KIE provider çağrısı, design persist, review auto-enqueue (best-effort, fail durumunda variation SUCCESS korunur)
- `review-design.worker.ts` — Sticky check → API key resolve → image input → alpha gate → Gemini → decision → race-safe persist + idempotent audit upsert
- `scrape-competitor.worker.ts`, `fetch-new-listings.worker.ts`, `trend-cluster-update.worker.ts` (Phase 3-4)
- `scan-local-folder.worker.ts`, `bookmark-preview.worker.ts`, `thumbnail.worker.ts` (Phase 1-5)

**Provider abstraction (`src/providers/`):**
- `image/` — KIE GPT Image 1.5, KIE Z-Image (Phase 5)
- `review/` — selectable provider (Phase 6 Aşama 2A): `google-gemini-flash` (Google direct, mock-tested) + `kie-gemini-flash` (KIE.ai chat/completions multimodal — AI mode canlı, local mode Aşama 2B bekliyor). Paylaşılan `output-schema.ts` (Zod + OpenAI JSON schema). Runtime seçim `settings.reviewProvider`. `ReviewProvider.modelId` field audit/CostUsage için kanonik kaynak.
- `scraper/`, `storage/`, `mockup/`, `ocr/` — Phase 3-5
- Registry paterni (R17.3): Hardcoded provider lookup yasak, sessiz fallback yasak.

**Settings (`src/features/settings/`):**
- `aiMode` — per-user encrypted `kieApiKey` + `geminiApiKey` (Phase 5'te kuruldu, Phase 6'da review provider tüketir) + plain `reviewProvider: "kie"|"google-gemini"` runtime seçimi (Aşama 1)
- `localLibrary` — kök klasör yolu, hedef çözünürlük/DPI

**Review pipeline (`src/server/services/review/`):**
- `alpha-checks.ts` — Sharp deterministic kenar piksel + alpha kanal kontrolleri (pure fonksiyon)
- `decision.ts` — `decideReviewStatus({score, riskFlags})` (R8 hardcoded threshold 60/90)
- `sticky.ts` — `applyReviewDecisionWithSticky` (R12 USER override koruması)

**Auth & multi-tenancy:**
- NextAuth v5 + per-row `userId` filter zorunlu
- Ownership ihlalinde 404 (varlık sızıntısı yok)
- Soft-delete dual-flag (`deletedAt` + `isUserDeleted`)

## Sıradaki Ana İşler

| Adım | Kapsam |
|------|--------|
| Phase 6 Aşama 2B | Local mode KIE review (data URL probe sonrası küçük/orta patch) + canlı smoke. Aşama 2A AI mode canlı; smoke'ta strict/fallback davranışı, `usage.total_tokens`, CostUsage row doğrulanacak. |
| Phase 7 | Selection Studio (background removal, color editor, crop, upscale, transparent PNG kontrolü) |
| Phase 8 | Mockup Studio (canvas/wall art, clipart bundle cover, sticker sheet) |
| Phase 9 | Listing Builder + Etsy draft push (direct active publish YOK; human approval gate'i) |
| Phase 10 | Admin hardening (prompt versioning UI, theme editor, cost dashboard, real-time pricing, negative library) |

Phase dokümanları: [`docs/plans/`](docs/plans/). Phase 6 design + plan: `docs/plans/2026-04-28-phase6-quality-review-{design,plan}.md`.

## Gereksinimler

- Node.js 20+
- Docker + Docker Compose
- npm 10+

## Hızlı Başlangıç

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

Admin girişi için `.env.local` dosyasındaki `ADMIN_EMAIL` / `ADMIN_PASSWORD` değerlerini kullan.

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

## Mimari Özeti

- **Frontend:** Next.js 14 App Router + TypeScript strict + Tailwind + shadcn/ui primitive
- **Backend:** Next.js server actions + API routes + Prisma
- **Veritabanı:** PostgreSQL 16
- **Queue:** Redis 7 + BullMQ
- **Storage:** MinIO (S3-compatible) — provider abstraction
- **Auth:** NextAuth v5 Credentials + JWT + bcryptjs
- **Test:** Vitest (unit + integration) + Playwright (e2e)

## Phase Durumu

| Phase | Kapsam | Durum |
|-------|--------|-------|
| 1 | App iskelet: auth, user/admin rolleri, theme token, app shell, dashboard | ✅ |
| 2 | Bookmark Inbox, Reference Board, Collections, Tags, Asset upload/URL import, data isolation | ✅ |
| 3 | Competitor Analysis: scraper abstraction, review-based ranking, Etsy/Amazon parser, daily cron | ✅ |
| 4 | Trend Stories: n-gram cluster + rail/feed/drawer + window tabs + feature gate | ✅ |
| 5 | Variation Generation: KIE provider abstraction, AI Mode + Local Mode, quality scoring | ✅ |
| 6 | AI Quality Review: hibrit pipeline (Sharp + selectable LLM), USER sticky, queue UI, bulk actions, conservative cost tracking | 🟡 (Aşama 2A AI mode ✅; Aşama 2B local mode ⏳ — KIE data URL probe sonrası kapsam) |
| 7 | Selection Studio | ⏳ |
| 8 | Mockup Studio | ⏳ |
| 9 | Listing Builder + Etsy draft push | ⏳ |
| 10 | Admin hardening (prompt versioning, theme editor, cost usage, negative library) | ⏳ |

Phase dokümanları: [`docs/plans/`](docs/plans/). Matesy/Listybox referansları için `CLAUDE.md`'ye bak.

## Lisans

Şu an lisans belirtilmemiştir; tüm haklar saklıdır.
