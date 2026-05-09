# Kivasy — Staging / Deployment Runbook

> Localhost-sonrası ilk staging/deployment için pratik runbook. Yeni
> feature listesi değildir; mevcut R11.11 sistemi staging'e taşımak için
> minimum çalışır setup'ı tarif eder.
>
> Acceptance source-of-truth: [`MVP_ACCEPTANCE.md`](MVP_ACCEPTANCE.md).
> Production shakedown (release günü): [`PRODUCTION_SHAKEDOWN.md`](PRODUCTION_SHAKEDOWN.md).
> Bu doküman ikisinin pratik staging türevi.

---

## 1. Genel readiness hükmü

Localhost MVP smoke uçtan uca tamamlandı (R11.9 + R11.11 son commit
`1494b22`). Variation pipeline + mockup binding + listing AI fill +
listing save **gerçek KIE provider call'larıyla** doğrulandı. Brand
cleanup yapıldı, parity gap'leri operatör için dürüstçe etiketli
("SOON" rozetler + "post-MVP enrichment" placeholder).

**Staging için kalan iş: infrastructure provisioning + env
configuration + seed.** Kod tarafında release blocker yok.

---

## 2. Minimum çalışır staging seti

### 2.1 Servisler (sistem ayağa kalkmaz, eksikse)

| Servis | Sürüm | Not |
|---|---|---|
| **Postgres** | 16.x | WAL aktif; `prisma migrate deploy` ile schema kurulur |
| **Redis** | 7.x | AOF aktif (`appendonly yes`) — BullMQ queue + repeatable scheduler |
| **S3 / MinIO** | uyumlu | Bucket pre-create; signed URL desteklenmeli; `STORAGE_PUBLIC_URL` HTTPS olmalı |
| **Node.js** | 20+ | Production runtime (worker + web). `package.json`'da `engines` field yok — Node 20 hedef |
| **Web process** | 1+ | `next start` (port 3000 default; orchestration ile esnek) |
| **Worker process** | 1+ | `npm run worker:prod` (R11.12 — production-friendly, watch yok) |

### 2.2 Opsiyonel (sistem açılır, bazı akışlar fail olur)

| Servis | Etkisi |
|---|---|
| **mj-bridge** (`http://127.0.0.1:8780`) | Yoksa: variation worker `BridgeUnreachableError`; KIE direct path bağımsız çalışır |
| **Magic Eraser Python (LaMa)** | Yoksa: Selection edit-op "Magic Eraser" job fail; bg-remove/color/crop/upscale çalışır |
| **Etsy OAuth credentials** | Yoksa: `/api/etsy/oauth/connect` 503; Settings → Etsy Connect butonu çalışmaz |

---

## 3. Env / dependency matrisi

### 3.1 ZORUNLU (eksikse `next start` runtime'da Zod parse fail)

| Env | Üretim | Not |
|---|---|---|
| `NODE_ENV` | `production` | Build sırasında set; runtime'da da set edilmiş olmalı |
| `APP_URL` | `https://staging.kivasy.app` (örnek) | Etsy OAuth callback'i ile must-match |
| `AUTH_SECRET` | `openssl rand -hex 32` | min 32 char; JWT signing |
| `AUTH_TRUST_HOST` | `true` | Reverse proxy arkasında |
| `SECRETS_ENCRYPTION_KEY` | 64-hex string | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — KIE/Gemini key encryption |
| `DATABASE_URL` | Postgres URL | `postgresql://user:pass@host:5432/db?schema=public` |
| `REDIS_URL` | Redis URL | `redis://host:6379` |
| `STORAGE_PROVIDER` | `s3` veya `minio` | Default minio |
| `STORAGE_BUCKET` | bucket adı | Pre-create gerekli |
| `STORAGE_ENDPOINT` | URL | S3 için `https://s3.region.amazonaws.com`, MinIO için ssl URL |
| `STORAGE_REGION` | `us-east-1` (default) | S3 için provider region |
| `STORAGE_ACCESS_KEY` | string | IAM access key veya MinIO root |
| `STORAGE_SECRET_KEY` | string | İlgili secret |
| `STORAGE_FORCE_PATH_STYLE` | `true` (MinIO) / `false` (S3 yeni) | Path-style addressing |
| `STORAGE_PUBLIC_URL` | URL (opsiyonel ama önerilen) | Signed URL'lerin domain'i |

### 3.2 SEED için zorunlu (ilk admin user)

| Env | Üretim |
|---|---|
| `ADMIN_EMAIL` | İlk admin (örn. `admin@staging.kivasy.app`) |
| `ADMIN_PASSWORD` | min 8 char; deploy sonrası UI'dan değiştir |

### 3.3 OPSİYONEL — feature gating

| Env | Yoksa fail mode |
|---|---|
| `REGISTRATION_ENABLED` | Default `false`; staging için ✓ |
| `LOG_LEVEL` | Default `info`; debug için `debug` |
| `ETSY_CLIENT_ID` / `ETSY_CLIENT_SECRET` / `ETSY_REDIRECT_URI` | Yoksa Settings → Etsy "Connect" 503; readiness endpoint `not_configured` honest fail |
| `ETSY_TAXONOMY_MAP_JSON` | Yoksa Etsy submit 422 (`ETSY_TAXONOMY_MISSING`); UI'da Türkçe hint döner |
| `MJ_BRIDGE_URL` / `MJ_BRIDGE_TOKEN` | Default `http://127.0.0.1:8780`; bridge yoksa `BridgeUnreachableError` |
| `MAGIC_ERASER_PYTHON` / `MAGIC_ERASER_RUNNER_OVERRIDE` | Yoksa Magic Eraser job fail; diğer 4 edit-op çalışır |

### 3.4 USER-scoped secrets (env'de DEĞİL — UI'dan girilir)

| Secret | Nerede |
|---|---|
| KIE API key | `Settings → AI Providers → KIE` (encrypted at rest, `UserSetting key=aiMode`) |
| Gemini API key | `Settings → AI Providers → Google Gemini` |
| Etsy OAuth tokens | OAuth flow sonrası `EtsyConnection` table'a persist |

---

## 4. Akış bazlı deploy readiness tablosu

| Akış | Hazır mı | Bağımlılık | Eksikse fail mode |
|---|---|---|---|
| **Auth/login** | ✅ Hazır | Postgres + AUTH_SECRET | DB yoksa: 500; AUTH_SECRET yoksa: env startup fail |
| **Library/assets** | ✅ Hazır | Storage + DB | Storage yoksa: signed-url fail; DB yoksa: 500 |
| **Batches index/detail** | ✅ Hazır | DB | — |
| **Batches → variation create (A6)** | ⚠ Kısmi | mj-bridge VEYA KIE provider key | Bridge yoksa: variation worker `BridgeUnreachableError`; KIE key yoksa: provider HTTP fail |
| **Review workspace (A4)** | ✅ Hazır | DB | A4 dark workspace overlay; keyboard handler |
| **Selections index/detail** | ✅ Hazır | DB | Edit ops legacy bridge `/selection/sets/[id]` üzerinden |
| **Mockup render** | ✅ Hazır | Worker + Sharp + Storage | R11.9 binding auto-create + render uçtan uca canlı; binding'ler raster için otomatik |
| **Apply Mockups** | ✅ Hazır | Mockup template'lerin ACTIVE binding'i | User-upload otomatik (R11.9), seed'ler manuel admin/mockup-templates |
| **Products + Listing tab** | ✅ Hazır | DB + Storage | Listing handoff `/api/listings/draft` ile çalışır |
| **Listing AI fill** | ⚠ Kısmi | KIE API key (UserSetting) | Yoksa: 502 honest fail; UI "Add API key" hint |
| **Save listing** | ✅ Hazır | DB | — |
| **Notifications inbox** | ✅ Hazır | DB | 15s polling (SSE channel post-MVP) |
| **Templates / Settings** | ✅ Hazır | DB | 8 live pane (General/Workspace/Editor/Notifications/Etsy/Providers/Storage/Scrapers) |
| **Etsy submit** | ❌ Operatör credential | ETSY_* env (4 değer) | 503 (`EtsyNotConfigured`) — readiness endpoint Türkçe hint |

---

## 5. Staging runbook

### A. Ön hazırlık (T-1 gün)

```bash
# 1. Build sanity (local'de doğrula)
git fetch && git checkout claude/epic-agnesi-7a424b && git pull
rm -rf .next node_modules
npm ci
npm run typecheck   # PASS bekle
npm run lint        # PASS bekle (worktree config conflict warning OK)
npm run check:tokens  # 0 leak
npm run build       # 60+ route, shared 87.3 kB
```

```bash
# 2. Provision staging infrastructure
# - Postgres 16 instance (managed: RDS, DigitalOcean Managed DB, vb.)
# - Redis 7 instance (managed: ElastiCache, Upstash, vb.)
# - S3 bucket (veya MinIO instance) + IAM access key
# - DNS: staging.kivasy.app → app server
# - SSL cert (Let's Encrypt veya managed)
```

```bash
# 3. Generate secrets (operatör host'ta)
openssl rand -hex 32                                  # AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # SECRETS_ENCRYPTION_KEY
```

### B. İlk ayağa kaldırma (deploy günü)

```bash
# 1. .env.production hazırla
cat > .env.production <<'EOF'
NODE_ENV=production
APP_URL=https://staging.kivasy.app
LOG_LEVEL=info
AUTH_SECRET=<openssl çıktısı>
AUTH_TRUST_HOST=true
REGISTRATION_ENABLED=false
ADMIN_EMAIL=admin@staging.kivasy.app
ADMIN_PASSWORD=<staging admin pass>
SECRETS_ENCRYPTION_KEY=<64-hex>
DATABASE_URL=postgresql://USER:PASS@HOST:5432/DB?schema=public
REDIS_URL=redis://HOST:6379
STORAGE_PROVIDER=s3
STORAGE_BUCKET=kivasy-staging
STORAGE_ENDPOINT=https://s3.us-east-1.amazonaws.com
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=<iam access key>
STORAGE_SECRET_KEY=<iam secret>
STORAGE_FORCE_PATH_STYLE=false
STORAGE_PUBLIC_URL=https://kivasy-staging.s3.us-east-1.amazonaws.com
EOF
```

```bash
# 2. Schema migration (Postgres pre-migrate snapshot al!)
npm run db:migrate:deploy

# 3. Seed (ilk admin user + product types + theme)
npm run db:seed
# Doğrula: psql -c "SELECT id, email, role FROM \"User\" WHERE role='ADMIN';"
```

```bash
# 4. Build (sunucuda) ve start
npm ci --production=false   # build için tüm deps
npm run build
npm ci --production         # runtime için sadece production deps

# 5. Process'ler — ZORUNLU iki ayrı process
# Web (PM2/systemd/Docker arkasında)
PORT=3000 NODE_ENV=production npm start

# Worker — AYRI process; web'siz ya da web farklı host'ta olabilir
NODE_ENV=production npm run worker:prod
```

### C. Sanity check (deploy sonrası)

```bash
# Health endpoint (R11.12 — auth gerektirmez)
curl -s https://staging.kivasy.app/api/health | jq
# Beklenen 200: { "status": "ok", "checks": { "db": true, "redis": true, "storage": true }, "uptime": N, "timestamp": "..." }

# Auth public flow
curl -I https://staging.kivasy.app/login         # → 200
curl -I https://staging.kivasy.app/dashboard     # → 308 → /overview
curl -I https://staging.kivasy.app/admin         # → 307 → /login (auth-gated)

# API
curl -I https://staging.kivasy.app/api/auth/session  # → 200 (null session OK)
```

### D. İlk staging smoke (gerçek browser, 15-20 dk)

1. **Login** — admin credentials (ADMIN_EMAIL/PASSWORD)
2. **Settings → AI Providers** — KIE API key gir (`Save` → CONNECTED rozet)
3. **Library** — boş veya seed asset'leriyle açılır; eğer asset yoksa Library deep-link veya Reference upload
4. **Settings → Etsy** — eğer ETSY_* env hazırsa Connect; yoksa "not_configured" honest fail
5. **Reference yükle** veya mevcut asset üzerinde A6 modal aç:
   - Library asset → detail panel → "Variations" CTA → A6 modal
   - Reference + similarity + count seç → Submit
6. **Worker pickup** — Active Tasks panel'de batch görünür (~30-90s sonra DONE)
7. **Batches/[id]/review** — A4 dark workspace; keyboard k/d/r/?
8. **Selection → Apply Mockups** — Mockup ready stage'inde → "Apply Mockups" CTA → legacy bridge `/selection/sets/[id]/mockup/apply` → "Render et" tıkla
9. **Mockup output** — `mockup-renders/...` MinIO/S3'e yazılır
10. **POST /api/listings/draft** — `body={mockupJobId}` → yeni Product paketi
11. **Products/[id]/listing** — AI fill → KIE call (~30s) → title + desc + 13 tags → "Save listing"
12. **Etsy submit** — env hazırsa draft push; yoksa 503 honest fail (smoke için kabul)
13. **Notifications inbox** — `/settings?pane=notifications` → recipe/batch/mockup bildirimleri

### E. T+24h observability

| Ekran | Ne gösterir | Bakma sıklığı |
|---|---|---|
| `/admin/jobs` | Job state distribution | Saatte 1 |
| `/settings?pane=providers` | Cost summary 4-stat row | Günde 1 |
| `/api/health` | DB/Redis/Storage probe | Sürekli (uptime monitor) |
| `journalctl -u kivasy-worker -f` | Worker logs | Continuous (error filter) |
| Postgres `Job.lastError` SQL | Failed job error detail | İhtiyaç hâlinde |

---

## 6. Son blocker'lar

### Kod blocker: ❌ YOK
- Build PASS, typecheck PASS, lint PASS, token check PASS
- 60+ route compile, 87.3 kB shared JS
- End-to-end smoke (Library → Variation → Mockup → Listing AI fill) doğrulandı

### Infra blocker: ⚠ Provisioning kararı operatöre
- Postgres + Redis + Storage instance (managed önerilen)
- DNS + SSL + reverse proxy (Nginx/Caddy/Cloud LB)
- App server (1+ web process + 1 worker process)

### Env blocker: ❌ YOK
- 16 zorunlu env tanımlı (Zod parse + R11.12 staging matrisi)
- Operatör credential aşamasında durulur (Etsy + KIE/Gemini per-user keys)

### Third-party blocker: ⚠ Operatör credential aşaması
- **KIE API key**: kie.ai üzerinden (UI'dan girilir; UserSetting per-user)
- **Gemini API key** (opsiyonel): Google AI Studio (UI'dan girilir)
- **Etsy app credentials** (opsiyonel ama öneriliyor): developer.etsy.com app create + ClientID/Secret + Redirect URI register
- **mj-bridge** (opsiyonel): variation web bridge service deploy (ayrı paket)

### "Bunu çözmeden staging'e geçme" maddesi: ❌ YOK
Sistem mevcut haliyle staging'e taşınabilir. KIE provider key'i UI'dan girildiğinde gerçek smoke koşturulabilir. Etsy submit denenirse honest fail döner (operatör credential aşamasında çözülür). Geri kalan tüm pipeline staging'de çalışır.

---

## 7. Bilinçli post-staging deferred

Staging smoke geçtikten sonra production'a geçmeden önce ek polish (release blocker değil):

- **Postgres backup + restore drill** — production-grade backup stratejisi (`pg_dump` cron + retention)
- **MinIO/S3 mirror policy** — versioning + lifecycle
- **Worker process replication** — single instance bottleneck olabilir; multi-worker için BullMQ konsantrasyon (concurrency knob'lar mevcut)
- **SSE delivery channel** (`notifications:user:{id}`) — şu an 15s polling
- **Provider integration genişlemesi** — OpenAI / Fal.ai / Replicate / Recraft (R12 scope)
- **References B1 consolidation** — sub-view'lar tek surface'e
- **Overview C3 4-block view** — şu an placeholder

---

_Bu doküman R11.11 baseline'ında (commit `1494b22`) üretildi. Staging
deploy sonrası bulgular geri yansıtılır; production'a geçişte
[`PRODUCTION_SHAKEDOWN.md`](PRODUCTION_SHAKEDOWN.md) full-form
checklist devreye girer._
