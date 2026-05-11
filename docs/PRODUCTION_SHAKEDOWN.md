# Kivasy — Production Deployment Shakedown

> Pratik, uygulamalı ön-release kontrol kılavuzu. **Yeni feature
> rollout'u değildir** — MVP omurgası kabul edildikten sonra release
> günü gerçekten kullanılacak operasyonel checklist'tir.
>
> Acceptance source of truth: [`MVP_ACCEPTANCE.md`](MVP_ACCEPTANCE.md).
> Bu doküman onun pratik yansımasıdır.

---

## 1. Release öncesi hazırlık (T-1 gün)

### 1.1 Code & build sanity

```bash
# Temiz checkout'tan derle
git fetch && git checkout claude/epic-agnesi-7a424b && git pull
rm -rf .next node_modules
npm ci
npm run typecheck             # PASS bekle
npm run lint                  # PASS bekle (worktree config conflict warning OK)
npm run check:tokens          # "0 leak" bekle
npm run build                 # 60+ route compile, ~87 kB shared JS
```

Beklenen son satırlar:
```
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

### 1.2 Test suite spot-check

```bash
npm run test                  # 1779/1790 pass beklenir
                              # 11 fail Redis/BullMQ-dep integration
                              # → env eksikse beklenen (kod hatası değil)
```

Production-grade Redis bağlıysa tam pass'i hedefle:
```bash
docker compose up -d redis
npm run test
```

### 1.3 Env hazırlık (kritik)

`.env.local` üretim sürümünü `.env.example` baz alarak doldur. **Aşağıdaki env'ler olmadan sistem ayağa kalkmaz:**

| Env | Zorunlu | Not |
|---|---|---|
| `NODE_ENV` | ✓ | `production` (build time) |
| `APP_URL` | ✓ | Production HTTPS URL — Etsy OAuth callback'i için must-match |
| `AUTH_SECRET` | ✓ | `openssl rand -hex 32` (min 32 char) — JWT signing |
| `AUTH_TRUST_HOST` | ✓ | `true` (reverse proxy arkasında) |
| `SECRETS_ENCRYPTION_KEY` | ✓ | 32-byte hex — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — **rotasyon sırasında mevcut secret'lar decrypt edilemez (silent null fallback)** |
| `DATABASE_URL` | ✓ | Postgres 16, WAL aktif |
| `REDIS_URL` | ✓ | Redis 7, AOF aktif (`appendonly yes`) |
| `STORAGE_*` | ✓ | MinIO veya S3 — bucket pre-create, public URL HTTPS, force-path-style true (MinIO için) |
| `ADMIN_EMAIL`/`ADMIN_PASSWORD` | ⚠ | İlk admin user için seed kullanır — release sonrası şifre rotasyonu **manuel** |
| `REGISTRATION_ENABLED` | ⚠ | Production: `false` — açık registration istenmiyor |

**Sistem yarım çalışır (ama ayağa kalkar) — eksikse 503 döner:**

| Env | Etki |
|---|---|
| `ETSY_CLIENT_ID` / `ETSY_CLIENT_SECRET` / `ETSY_REDIRECT_URI` | Yoksa `/api/etsy/oauth/connect` 503; user Settings → Etsy "Connect" butonu çalışmaz |
| `ETSY_TAXONOMY_MAP_JSON` | Yoksa product type için draft submit 422; missing key honest fail |
| `MAGIC_ERASER_PYTHON` | Yoksa selection edit "Magic Eraser" job fail; UI feedback verir, başka edit-op'lar çalışır |
| `MJ_BRIDGE_URL` / `MJ_BRIDGE_TOKEN` | Yoksa Midjourney bridge job'ları `BridgeUnreachableError`; KIE direct path bağımsız çalışır |

**User-scoped secrets (workspace runtime'da girilir, env'de yok):**

- KIE API key — `Settings → AI Providers → KIE` (encrypted at rest, `UserSetting key=aiMode`)
- Gemini API key — `Settings → AI Providers → Google Gemini`
- Etsy OAuth tokens — OAuth flow sonrası persisted (`EtsyConnection` table)

### 1.4 Database migration prep

```bash
# Migration plan (production):
DATABASE_URL=<production_url> npx prisma migrate deploy

# Schema durumu doğrula
npx prisma db pull --print     # Şema uyumu kontrol
```

**Backup-before-migrate kural:** Tüm production migration'lardan önce
Postgres snapshot al ([§4.1](#41-postgres-backup--restore)).

### 1.5 First admin seed

İlk deploy'da admin user oluşturulması zorunlu — sistem registrationsız:

```bash
DATABASE_URL=<production_url> npm run db:seed
```

Seed admin'i `ADMIN_EMAIL` / `ADMIN_PASSWORD` env'lerinden okur. **Seed
sonrası şifreyi UI'dan değiştir** veya bcrypt hash'ini direkt update et.

---

## 2. Release günü

### 2.1 Deploy sırası

```
1. docker compose up -d postgres redis minio    # infrastructure
2. (gerekiyorsa) prisma migrate deploy           # schema sync
3. npm run db:seed                               # ilk deploy ise
4. npm run build                                 # production build
5. npm run start                                 # web server (port 3000)
6. npm run worker                                # BullMQ worker (ayrı process)
```

**Worker process zorunludur** — web server worker'sız çalışır ama
hiçbir job tamamlanmaz (variation, review, mockup-render, magic-eraser,
selection-export, midjourney-bridge tüm pipeline durur).

### 2.2 Process monitoring

| Process | Komut | Restart policy | Fail mode |
|---|---|---|---|
| Web | `npm run start` | systemd / pm2 / docker `restart: unless-stopped` | 503 — user görür |
| Worker | `npm run worker` | aynı | jobs queue'da birikir, UI "queued" gösterir |
| Postgres | docker compose | `restart: unless-stopped` | full outage |
| Redis | docker compose | `restart: unless-stopped` | jobs durur, web frontend ayakta |
| MinIO/S3 | docker compose / managed | `restart: unless-stopped` | asset upload/download fail; UI honest 503 |

### 2.3 Health endpoints (manuel)

`/api/health` route şu an yok. Manuel sanity:

```bash
curl -I https://your-domain/login                  # → 200
curl -I https://your-domain/api/auth/session       # → 200 (null session OK)
curl -I https://your-domain/dashboard              # → 307 → /login (logged-out)

# İlk admin login sonrası
curl -b cookies.txt https://your-domain/api/settings/cost-summary  # → 200
curl -b cookies.txt https://your-domain/api/notifications/inbox     # → 200
```

---

## 3. Worker / queue topology

Tek `worker` process **15 worker spawn eder**, her biri kendi queue'sundan job picker. Tablodan kritik concurrency + fail mode:

| Job type | Concurrency | Cron | Fail mode notu |
|---|---|---|---|
| `GENERATE_VARIATIONS` | 4 | — | KIE/MJ provider HTTP I/O bound; rate limit'te 429 |
| `REVIEW_DESIGN` | 4 | — | Gemini paralel HTTP; quality_score üretmezse `needs_review` fallback |
| `MAGIC_ERASER_INPAINT` | 1 | — | Python LaMa RAM-heavy; concurrency artışı OOM riski |
| `MOCKUP_RENDER` | 2 | — | Sharp CPU+I/O; 60s AbortSignal timeout |
| `EXPORT_SELECTION_SET` | 2 | — | Storage download + archiver + upload |
| `SELECTION_EXPORT_CLEANUP` | 1 | UTC 04:00 daily | Idempotent; eski export ZIP cleanup |
| `FETCH_NEW_LISTINGS` | 1 | UTC 06:00 daily | Trend Stories feed update |
| `MIDJOURNEY_BRIDGE` | 1 | — | mj-bridge unreachable → BridgeUnreachableError, user explicit fail görür |
| `REMOVE_BACKGROUND` | 2 | — | imgly model inference CPU-heavy |
| `ASSET_INGEST_FROM_URL` | 2 | — | URL fetch + storage put |
| `GENERATE_THUMBNAIL` | 2 | — | Sharp resize |
| `BOOKMARK_PREVIEW_METADATA` | 2 | — | URL fetch + OG meta extract |
| `SCRAPE_COMPETITOR` | 2 | — | Provider HTTP (Apify/Firecrawl) |
| `TREND_CLUSTER_UPDATE` | 2 | — | Embedding + similarity check |
| `SCAN_LOCAL_FOLDER` | 2 | — | Filesystem walk (dev only typically) |

**Retry policy: blanket retry yok (default 1 attempt).** Permanent
error'lar (api key yok, image too large, Zod fail) tek seferde fail;
transient error'lar (429/503) follow-up ile elle re-enqueue edilir
(Active Tasks panel "retry" CTA).

---

## 4. Backup / restore / observability

### 4.1 Postgres backup + restore

**Günlük snapshot (manuel veya cron):**

```bash
# Backup (production host'unda)
docker exec etsyhub-postgres pg_dump -U etsyhub etsyhub \
  | gzip > backups/etsyhub-$(date +%Y%m%d-%H%M).sql.gz

# Restore drill (staging önce!)
gunzip -c backups/etsyhub-20260509-0300.sql.gz \
  | docker exec -i etsyhub-postgres psql -U etsyhub etsyhub
```

**Retention önerisi:** 7 günlük günlük snapshot + 4 haftalık + 6 aylık.

**Migration öncesi mutlaka snapshot.** `prisma migrate deploy`
geri-alınamaz; rollback yalnızca restore ile yapılabilir.

### 4.2 Redis backup

Redis BullMQ queue + repeatable scheduler state'ini tutar. AOF
(`appendonly yes`) aktif — restart'larda son N saniyenin job'ları
kaybolabilir; **veri value'su Postgres'tedir, queue durumu re-enqueue
ile rebuild edilebilir.**

```bash
# Snapshot (RDB + AOF)
docker exec etsyhub-redis redis-cli BGSAVE
docker cp etsyhub-redis:/data/dump.rdb backups/redis-$(date +%Y%m%d).rdb
docker cp etsyhub-redis:/data/appendonlydir backups/redis-aof-$(date +%Y%m%d)
```

**Restore:** Container durdurup `dump.rdb` + AOF dosyasını volume'a
kopyala; container yeniden başlat.

**"Stuck queue" senaryosu:** Worker process restart yetmiyor; ya da
job DLQ benzeri durumda — `redis-cli` ile kontrol:

```bash
docker exec -it etsyhub-redis redis-cli
> KEYS "bull:*:waiting"     # pending jobs
> KEYS "bull:*:failed"      # failed jobs (last 1000 retain edildi)
> LLEN "bull:GENERATE_VARIATIONS:waiting"
> XLEN "bull:GENERATE_VARIATIONS:events"
```

Stuck job'ı re-enqueue: BullMQ Board UI'sı yok (post-MVP). CLI
yöntem — Active Tasks panel'den retry CTA ya da:

```bash
# Manuel job'ı reset (admin Postgres console üzerinden Job tablosunu update)
UPDATE "Job" SET state='WAITING', "lastError"=NULL WHERE id='<job_id>';
# Sonra worker'a re-enqueue (yalnız development; production'da bu rotalar var)
```

### 4.3 Storage (MinIO / S3) backup

Asset binary'leri MinIO'da. **Postgres `Asset` tablosundaki
`storageKey` referansı kaybolan binary'leri görmez** — ölü pointer
oluşur. MinIO için:

```bash
# Mirror bucket (production-grade için aws s3 sync veya rclone önerilir)
docker exec etsyhub-minio mc mirror local/etsyhub /backup/etsyhub-snapshot
```

S3 production: bucket versioning + lifecycle rule; cross-region
replication if budget allows.

### 4.4 Observability — ilk 24 saatte bakılacak ekranlar

**Operasyonel (admin user ile):**

| Ekran | Ne gösterir | Bakma sıklığı |
|---|---|---|
| `/admin/jobs` | Job state distribution (WAITING/RUNNING/DONE/FAILED) | Saatte 1 |
| `/admin/audit-logs` | User action audit trail | İhtiyaç hâlinde |
| `/admin/midjourney` | Provider error rate (KIE/Gemini son 24h) | Günde 2 |
| `/settings?pane=providers` | Cost summary 4-stat row (daily/monthly/active/failed24h) | Günde 1 |
| `/dashboard` veya `/overview` | Pending actions, active batches, recent activity | Sürekli açık |

**App log (production stdout):**

```bash
# Web server logs
journalctl -u kivasy-web -f --since "1 hour ago"

# Worker logs (kritik — job failure'ları burada)
journalctl -u kivasy-worker -f --since "1 hour ago" | grep -E "job failed|error"
```

**Notification provider failures:**

- Inbox `/settings?pane=notifications` — recipe run, batch result
  notification'ları geliyor mu (15s polling)
- `Job.lastError` field Postgres'te raw error mesajı — `SELECT id,
  type, "lastError" FROM "Job" WHERE state='FAILED' ORDER BY
  "createdAt" DESC LIMIT 20;`

### 4.5 Cost guardrails

- `/settings?pane=providers` daily/monthly spend reading `CostUsage`
  aggregation
- Spend limit hit → variation + listing-copy job 429 ile fail
  (`assertWithinBudget`); user UI'da "budget exceeded" mesajı görür
- Admin spend limit override `/settings?pane=providers` → KIE / Gemini
  per-day + per-month USD ceiling

---

## 5. Release sonrası ilk smoke akışı

**Tam zincirin minimum doğrulaması — 15-20 dk.** Üretim ortamında
bir admin user ile uçtan uca git:

### Adım adım

1. **Login** — `/login` üzerinden admin credentials ile gir.

2. **Settings → AI Providers** kontrol — `?pane=providers`
   - 4-stat row görünür (DAILY / MONTHLY / ACTIVE / FAILED24H)
   - "Loading provider settings…" 8s'den fazla kalmıyor (R11.5 watchdog)
   - KIE API key ekle (CONNECTED rozeti görünmeli)

3. **Settings → Etsy connection** — `?pane=etsy`
   - "Connect" butonuna tıkla → Etsy OAuth consent → callback başarılı
   - `EtsyConnection` row Postgres'te oluştu mu (DB spot check)

4. **Reference yükle** — `/references` veya `/bookmarks`
   - 1 görseli URL'den ekle veya local upload
   - Asset Library'de `/library` görünür mü kontrol et

5. **Batch oluştur** — `/batches` → "+ New Batch"
   - A6 Create Variations modal açılır
   - Reference seç, similarity=medium, count=4, prompt template seç
   - "Start Batch" → enqueue mesajı görünür
   - **Active Tasks panel** sağ alt köşede yeni job görünür

6. **Worker tamamlamayı bekle** — 30-90s arası (provider'a göre)
   - `/batches/[id]` Items tab'inde 4 asset DONE state'inde olmalı
   - Quality score badge görünür mü

7. **Batch Review** — `/batches/[id]/review`
   - Dark workspace açılır
   - `k` ile keep, `r` ile reject, `d` ile defer kararı kaydet
   - "Apply Decisions" CTA submission yapar

8. **Selection set oluştur** — `/library` veya `/selections`
   - Library'den 2+ asset seç → "Add to Selection" → yeni set
   - `/selections/[setId]` Designs tab'inde itemler görünür
   - **Test edit op:** Background remove modal aç, 1 item üzerinde
     çalıştır (≤30s)

9. **Apply Mockups** — `/selections/[setId]` → Mockups tab → CTA
   - Lifestyle / Bundle preview / My templates sibling tabs görünür
   - 1 lifestyle template seç → render queue'ye düşer
   - 30-60s sonra `/selection/sets/[setId]/mockup/jobs/[jobId]/result`
     görüntüsü hazır

10. **Product paket oluştur** — `/products` → New Product (Selection seçimi)
    - Detail page A5 4-tab: Mockups / Listing / Files / History
    - Listing tab title + description doldur, 13 tag seç, digital
      file types checklist (ZIP / PNG)
    - "Generate Listing" butonu — B6 modal AI listing copy üretir

11. **Etsy draft submit** — Product detail → "Submit to Etsy"
    - 422 dönüyorsa `ETSY_TAXONOMY_MAP_JSON` eksik — env'i fix et
    - 200 dönüyorsa Etsy.com'da draft listing açılır (manuel kontrol)
    - Submit history Product History tab'inde görünür

12. **Notifications inbox** — `/settings?pane=notifications`
    - Recipe run, batch completed, listing submitted bildirimleri
      inbox'a düştü mü
    - "Read all" + "Clear" CTA çalışıyor mu

### Beklenen son durum

- 1 active EtsyConnection
- 1+ Reference, 1 Batch DONE, 4+ Library asset
- 1 Selection set, mockup render'ı tamamlandı
- 1 Product, listing draft çevrim, Etsy'de draft listing açıldı
- 4-6 inbox bildirimi (recipe yoksa: batch + listing submitted +
  mockup activated)

---

## 6. Rollback senaryoları

### 6.1 Build/deploy başarısız

- Önceki commit'e checkout → tekrar `npm run build && npm run start`
- Worker process önceki commit'e dön
- DB migration **olmadıysa** rollback risksiz; migration **olduysa**
  Postgres restore gerekli ([§4.1](#41-postgres-backup--restore))

### 6.2 Migration sonrası schema bozuk

```bash
# Snapshot'tan restore
gunzip -c backups/etsyhub-pre-migrate.sql.gz \
  | docker exec -i etsyhub-postgres psql -U etsyhub etsyhub

# Önceki commit'e checkout
git checkout <previous_commit>
npm run build && npm run start && npm run worker
```

### 6.3 Worker stuck / job loop

```bash
# Worker process restart
systemctl restart kivasy-worker
# veya pm2: pm2 restart worker

# Spesifik queue temizle (son çare — pending job'lar kaybolur)
docker exec -it etsyhub-redis redis-cli
> DEL bull:GENERATE_VARIATIONS:waiting
> DEL bull:GENERATE_VARIATIONS:active
```

User'a etkisi: Active Tasks panel'de iptal görür; manuel re-enqueue
gerekli.

### 6.4 Provider down (KIE / Gemini / Etsy)

- KIE: variation enqueue'leri fail; user `/settings?pane=providers`
  KEY MISSING durumuna düşmez ama "last error" görünür
- Gemini: review job düşer; quality_score `needs_review` fallback;
  user kararı vermeye devam eder
- Etsy: draft submit 503; user "tekrar dene" CTA görür; mevcut draft
  veri kaybı yok (Postgres'te tutulur)

---

## 7. Known limitations (release notu için)

Operatöre / kullanıcıya iletilmesi gerekenler:

- **In-app inbox 15s polling** — anlık bildirim değil; SSE channel
  R12'de gelecek
- **Recipe run "Continue to destination" CTA** — full chain
  orchestration (otomatik batch+selection+mockup) post-MVP
- **OpenAI / Fal.ai / Replicate / Recraft** — şu an UI'da "KEY
  MISSING + ships in R12"; KIE + Gemini canlı
- **Mockup binding wizard** — yeni mockup template eklerken CLI
  setup gerekli; UI wizard post-MVP
- **References Pool / Stories / Inbox / Shops / Collections** — şu
  an ayrı top-level route'larda; B1 single-surface consolidation
  post-MVP
- **Native macOS / Windows shell** — design ready, build post-MVP
- **Watch folder** — design ready, post-MVP
- **Bulk review on phone** — browse-only acceptable; full
  keyboard-first review desktop'ta

Detaylı liste: [`MVP_ACCEPTANCE.md`](MVP_ACCEPTANCE.md) §5.

---

## 8. Tek-bakış checklist

```
[ ] Code & build
    [ ] git checkout claude/epic-agnesi-7a424b @ tag/release commit
    [ ] rm -rf .next node_modules && npm ci
    [ ] npm run typecheck PASS
    [ ] npm run lint PASS (config conflict warning OK)
    [ ] npm run check:tokens "0 leak"
    [ ] npm run build PASS

[ ] Env (.env.local production)
    [ ] AUTH_SECRET (openssl rand -hex 32)
    [ ] SECRETS_ENCRYPTION_KEY (32-byte hex, rotasyon planı yazılı)
    [ ] DATABASE_URL (production Postgres, WAL mode)
    [ ] REDIS_URL (Redis 7, AOF aktif)
    [ ] STORAGE_* (bucket pre-create, public URL HTTPS)
    [ ] APP_URL (Etsy OAuth callback için must-match)
    [ ] REGISTRATION_ENABLED=false
    [ ] ADMIN_EMAIL/PASSWORD (seed için)
    [ ] ETSY_CLIENT_ID/SECRET/REDIRECT_URI (varsa Etsy aktivasyon)
    [ ] ETSY_TAXONOMY_MAP_JSON (product type → numeric ID)
    [ ] MAGIC_ERASER_PYTHON (LaMa kuruluysa)

[ ] Data
    [ ] Postgres pre-migrate snapshot
    [ ] prisma migrate deploy
    [ ] db:seed (ilk admin)
    [ ] Spot check: SELECT count(*) FROM "User"

[ ] Process
    [ ] docker compose up -d (postgres, redis, minio)
    [ ] npm run start (web)
    [ ] npm run worker (worker — ayrı process; ZORUNLU)
    [ ] systemd / pm2 restart policy aktif

[ ] Smoke (§5 — 15-20 dk)
    [ ] Login → Providers → Etsy → Reference → Batch → Library
    [ ] → Review → Selection → Mockup → Product → Etsy draft
    [ ] → Inbox bildirimleri görünüyor

[ ] T+24h observation (§4.4)
    [ ] /admin/jobs queue health
    [ ] /settings?pane=providers cost summary
    [ ] Job FAILED state'inde 0 stuck
    [ ] Worker logs error rate trendi
    [ ] Postgres backup zamanlandı (cron)
```

---

_Bu doküman R11.5 baseline'ında üretildi. Yeni provider / queue / job
type eklendiğinde buradaki tablolar güncellenmelidir._
