# EtsyHub

Localhost-first Etsy / POD productivity web app. Matesy / Listybox'tan ilham alan bağımsız bir ürün.

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

## Kaynaklar ve Notlar

Matesy/Listybox referansları ve video/screenshot arşivi için `CLAUDE.md` ve `docs/references/` klasörüne bak.

Phase 1+2 kapsamı: iskelet + auth + admin baz + Bookmark/Reference/Collections/Assets. Sonraki phase'ler kendi planlarında ele alınacak.
