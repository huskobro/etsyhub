# Phase 3 — Competitor Analysis Implementation Plan

> **Dil kuralı:** Türkçe iletişim; kod/teknik terimler İngilizce. Diacritic'ler eksiksiz.
> **Ajan çalıştırıcılar için:** Bu plan task-by-task uygulanır. Adımlar checkbox (`- [ ]`) ile işaretlidir.

**Hedef:** Kullanıcının girdiği Etsy mağaza URL/shop name'inden scraper provider üzerinden veri çekmek, review sayısı tabanlı ranking üretmek, rakip listing'leri bookmark/reference akışına bağlamak ve yeni listing takibi için periyodik scan altyapısı kurmak.

**Mimari Özet:** Scraper provider abstraction gerçek implementasyonla (Apify / Firecrawl / self-hosted fallback) bağlanır; `CompetitorStore` + `CompetitorListing` modeli aktive edilir; iki yeni BullMQ worker devreye girer (`SCRAPE_COMPETITOR`, `FETCH_NEW_LISTINGS`); URL import worker'ı Etsy/Amazon branch'iyle zenginleştirilir; `/competitors` sayfası ranking + bookmark/reference aksiyonları sunar.

**Tech Stack (Phase 1+2 üzerine ekleme):** Apify Client SDK (veya Firecrawl SDK), `node-cron`-eşdeğeri BullMQ repeat jobs, `cheerio` (HTML parsing fallback), `p-limit` (concurrent scrape kontrolü).

---

## Context

### Neden

Matesy'deki ana "fikir bulma" yolu rakip mağazaları izlemek:
- Hangi mağaza hangi ürün tiplerinde iyi satıyor?
- Hangi tasarım yorumlarda çok konuşuluyor? (Etsy satış sayısını gizlediği için **review count satış sinyali olarak kullanılır.**)
- Yeni listing'ler bir trend sinyali mi?

Phase 1+2'de `CompetitorStore` modeli schema'da var ama UI, API, worker akışı yok. Phase 3 bu boşluğu kapatır ve Phase 4 (Trend Stories) için veri alt yapısını kurar.

### Kapsam

Bu plan **yalnız Phase 3**'ü uygular. Kalan phase'ler ayrı planlara ayrılır:
- **Phase 4 (Trend Stories):** Çok mağazalı yeni listing akışı, trend cluster detection
- **Phase 5+ (Variation generation, review, mockups, listings):** Ayrı planlar

### Kritik Kurallar (CLAUDE.md + Phase 1+2 öğrendiklerimiz)

- **Provider abstraction:** Scraper çağrısı component'te değil, yalnız `src/providers/scraper/` altındaki interface'ten yapılır.
- **Data isolation:** `CompetitorStore` ve `CompetitorListing` her zaman `userId` scoped. `requireUser()` + `assertOwnsResource()` zorunlu.
- **Cost guardrails başlangıcı:** Scraper maliyeti provider tarafında fatura edilir. Job başlamadan `CostUsage` kaydı oluşturulur; admin bunu izler. Hard limit Phase 5'te gelecek; Phase 3'te **sadece izleme** yeterli.
- **Rate limit:** Etsy ve Amazon bot-aware. Per-user `p-limit(2)` + minimum 3 sn gap. Apify/Firecrawl bunu provider tarafında zaten yapıyor; self-hosted fallback için biz uygulamalıyız.
- **Review sayısı = satış sinyali (net satış değil):** UI metin şunu net göstermeli: "Yorum sayısı tahmini popülerlik göstergesidir; kesin satış rakamı değildir."
- **Enum kullanımı:** `SourcePlatform.ETSY`, `SourcePlatform.AMAZON`, `JobType.SCRAPE_COMPETITOR`, `JobType.FETCH_NEW_LISTINGS` — çıplak string yok.
- **Token kuralı:** Yeni UI elemanları token scale Tailwind sınıflarıyla; raw hex / arbitrary value yasak. Lint guard hâlâ aktif.
- **Feature flag:** `competitors.enabled` bu phase sonunda `true`'ya çekilir (seed'de `false` durumdu).
- **Test disiplini:** Her task TDD ile: unit test → impl → integration test → commit.
- **Admin visibility:** Scraper provider seçimi ve API key'leri admin panelinden yönetilir; plain text tutulmaz (encrypt helper `src/lib/secrets.ts` eklenir).

### Final Beklenen Davranış (Phase 3 sonunda)

1. Admin paneli → Scraper Providers: Apify / Firecrawl / Self-hosted seçilir, API key girilir (encrypted saklanır).
2. `/competitors` sayfası açılır; kullanıcı Etsy shop name veya URL girer → `SCRAPE_COMPETITOR` job'u tetiklenir.
3. Job tamamlandığında mağaza + listing'ler veritabanına yazılır; sayfada review count tabanlı ranking görünür.
4. Kullanıcı filtre yapabilir: son 30/90/365 gün/tüm zaman.
5. Her listing kartında aksiyonlar: **Bookmark**, **Referansa Ekle**, **Benzerini Yap (disabled until Phase 5)**, **Kaynağı Aç**.
6. Etsy/Amazon URL yapıştırıldığında `ASSET_INGEST_FROM_URL` worker'ı özel parser kullanarak title, çoklu görsel, review, price çıkarır.
7. Kullanıcı bir competitor store için "günlük yeni listing takibi" açabilir → `FETCH_NEW_LISTINGS` repeat job (BullMQ `repeat.every`).
8. Admin paneli → Jobs ekranında competitor job'ları status ile görünür.
9. `competitors.enabled` feature flag açık; kapatıldığında sayfa "Yakında" state'ine döner.
10. Data isolation: kullanıcı A'nın eklediği competitor store kullanıcı B'ye görünmez (integration test ile kanıtlı).

---

## Kaynaklar

### Scraper Provider Karşılaştırma

| Provider | Artı | Eksi | Seçim kararı |
|----------|------|------|-------------|
| **Apify** | Hazır Etsy/Amazon actor'ları var; rate limit + proxy dahil; CAPTCHA handling | Aylık ücretli; job başına credit | **Birincil seçim** — Etsy actor'ı olgun |
| **Firecrawl** | Basit API; JS-rendered sayfaları render ediyor; crawl + scrape | Etsy/Amazon için özel parsing yok, HTML+og:image döner | Fallback olarak uygun |
| **Self-hosted (cheerio + fetch)** | Bağımsız, ücretsiz | Bot detection hızlı; CAPTCHA yok; rate limit manuel; Etsy 403 vermeye yatkın | Sadece public listing sayfası için son çare |

**Phase 3 varsayılan:** Apify (Etsy store scraper + listing scraper actor). Firecrawl Phase 4'te Amazon/Pinterest için değerlendirilebilir.

### Etsy Resmi API Kararı

Etsy Open API (`developer.etsy.com`) OAuth ve listing read erişimi sunuyor **ama**:
- Üçüncü parti mağaza verisi erişimi sınırlı
- Rate limit düşük (10 req/sec, günlük quota)
- Review endpoint yok — bizim kritik sinyalimiz review count

**Karar:** Etsy Open API yalnız "kullanıcının kendi mağazası" için Phase 9'da (Listing Builder draft push) kullanılacak. Competitor analysis için scraper yolu şart.

### Bilinen Sınırlar (Phase 3 kapsamında kabul edilenler)

- Etsy **tam satış sayısı göstermez.** Review count proxy'dir; "~30×review" gibi çarpanlar **kullanılmayacak** — yanıltıcı.
- Listing silinir/güncellenirse scan sırasında `status: DELETED` olarak işaretlenir, veri silinmez (audit).
- Review sayfalaması Etsy'de client-side JS. Apify actor bunu hallediyor; self-hosted fallback yalnız ilk sayfayı alır.
- Amazon için özel parser basit: title, main image, ASIN, review count (görünürse). Sponsored results skip.
- Pinterest/Instagram ileride (Phase 4+); şimdilik URL import mevcut og:image akışı yeterli.

---

## Dosya Yapısı (Phase 3 sonunda yeni/değişen)

```
EtsyHub/
├── prisma/
│   ├── schema.prisma                        # + CompetitorListing, + CompetitorScan
│   └── migrations/<ts>_competitor_listings/
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── competitors/
│   │   │   │   ├── page.tsx                 # Liste + ekleme formu
│   │   │   │   └── [id]/page.tsx            # Mağaza detayı + ranking
│   │   └── api/
│   │       ├── competitors/
│   │       │   ├── route.ts                 # GET liste, POST ekle
│   │       │   └── [id]/
│   │       │       ├── route.ts             # GET detay, DELETE
│   │       │       ├── scan/route.ts        # POST manuel scan tetikle
│   │       │       └── listings/route.ts    # GET mağaza listing'leri (filtre + ranking)
│   │       └── admin/
│   │           └── scraper-providers/route.ts  # GET liste, PATCH key güncelle
│   ├── features/
│   │   ├── competitors/
│   │   │   ├── components/
│   │   │   │   ├── add-competitor-dialog.tsx
│   │   │   │   ├── competitor-card.tsx
│   │   │   │   ├── competitor-list.tsx
│   │   │   │   ├── listing-ranking-grid.tsx
│   │   │   │   ├── listing-ranking-card.tsx
│   │   │   │   ├── review-window-filter.tsx
│   │   │   │   └── empty-state.tsx
│   │   │   ├── schemas/
│   │   │   │   └── index.ts                 # Zod: addCompetitorInput, reviewWindow
│   │   │   ├── services/
│   │   │   │   ├── competitor-service.ts    # CRUD + scan orchestration
│   │   │   │   └── ranking-service.ts       # review count tabanlı sort + window filter
│   │   │   ├── queries/
│   │   │   │   └── use-competitors.ts
│   │   │   └── mutations/
│   │   │       ├── use-add-competitor.ts
│   │   │       ├── use-trigger-scan.ts
│   │   │       └── use-delete-competitor.ts
│   ├── providers/
│   │   └── scraper/
│   │       ├── index.ts                     # ScraperProvider interface + factory
│   │       ├── types.ts                     # ScrapedListing, ScrapedStore, ScanMeta
│   │       ├── apify-provider.ts            # ApifyClient + actor runs
│   │       ├── firecrawl-provider.ts        # Firecrawl SDK (fallback)
│   │       ├── self-hosted-provider.ts      # fetch + cheerio (son çare)
│   │       └── parsers/
│   │           ├── etsy-parser.ts           # HTML → ScrapedListing (self-hosted yol için)
│   │           └── amazon-parser.ts
│   ├── server/
│   │   └── workers/
│   │       ├── scrape-competitor.worker.ts  # Mağaza tam tarama
│   │       ├── fetch-new-listings.worker.ts # Yeni listing takip (repeat)
│   │       └── asset-ingest.worker.ts       # + Etsy/Amazon branch eklenecek
│   └── lib/
│       └── secrets.ts                       # AES-GCM encrypt/decrypt helper
├── tests/
│   ├── unit/
│   │   ├── competitor-service.test.ts
│   │   ├── ranking-service.test.ts
│   │   ├── scraper-factory.test.ts
│   │   ├── etsy-parser.test.ts              # HTML fixture → parsed listing
│   │   └── secrets.test.ts
│   ├── integration/
│   │   ├── api-competitors.test.ts
│   │   ├── api-competitor-data-isolation.test.ts
│   │   └── scrape-worker.test.ts            # Apify mock client ile full flow
│   └── e2e/
│       └── competitor-flow.spec.ts
└── docs/
    └── plans/
        └── phase3-competitor-analysis.md    # Bu dosya
```

---

## Phase 3 Task Listesi

### Task 1: Prisma Schema Genişletme

**Dosyalar:**
- Değiştir: `prisma/schema.prisma`

**Eklenecek modeller:** `CompetitorListing`, `CompetitorScan`. Mevcut `CompetitorStore` genişletilir.

- [ ] **Adım 1: Schema ekle**

```prisma
// prisma/schema.prisma — mevcut CompetitorStore güncellenir + iki yeni model

model CompetitorStore {
  id            String    @id @default(cuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Restrict)
  storeId       String?
  store         Store?    @relation(fields: [storeId], references: [id])
  etsyShopName  String
  shopUrl       String?   // eklendi
  platform      SourcePlatform @default(ETSY) // eklendi
  displayName   String?   // eklendi (scraper'dan dönen gerçek isim)
  totalListings Int?      // eklendi (son scan snapshot)
  totalReviews  Int?      // eklendi (son scan snapshot)
  autoScanEnabled Boolean @default(false) // eklendi — günlük yeni listing takibi
  lastScannedAt DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?

  listings CompetitorListing[]
  scans    CompetitorScan[]

  @@unique([userId, etsyShopName])
  @@index([storeId])
  @@index([userId])
}

enum CompetitorListingStatus {
  ACTIVE
  SOLD_OUT
  DELETED
  UNKNOWN
}

model CompetitorListing {
  id                  String                  @id @default(cuid())
  competitorStoreId   String
  competitorStore     CompetitorStore         @relation(fields: [competitorStoreId], references: [id], onDelete: Cascade)
  userId              String                  // denormalize — data isolation filter için
  externalId          String                  // Etsy listing_id veya Amazon ASIN
  platform            SourcePlatform
  sourceUrl           String
  title               String
  thumbnailUrl        String?
  imageUrls           String[]                @default([])
  priceCents          Int?
  currency            String?
  reviewCount         Int                     @default(0)
  favoritesCount      Int?                    // Etsy "favori" sayısı
  firstSeenAt         DateTime                @default(now())
  lastSeenAt          DateTime                @default(now())
  status              CompetitorListingStatus @default(ACTIVE)
  rawMetadata         Json?
  createdAt           DateTime                @default(now())
  updatedAt           DateTime                @updatedAt

  @@unique([competitorStoreId, externalId])
  @@index([userId])
  @@index([competitorStoreId, reviewCount(sort: Desc)])
  @@index([competitorStoreId, lastSeenAt(sort: Desc)])
}

enum CompetitorScanType {
  INITIAL_FULL
  INCREMENTAL_NEW
  MANUAL_REFRESH
}

enum CompetitorScanStatus {
  QUEUED
  RUNNING
  SUCCESS
  FAILED
  PARTIAL
}

model CompetitorScan {
  id                String               @id @default(cuid())
  competitorStoreId String
  competitorStore   CompetitorStore      @relation(fields: [competitorStoreId], references: [id], onDelete: Cascade)
  userId            String
  jobId             String?              // Job tablosu bağlantısı
  type              CompetitorScanType
  status            CompetitorScanStatus @default(QUEUED)
  provider          String               // "apify" | "firecrawl" | "self-hosted"
  listingsFound     Int                  @default(0)
  listingsNew       Int                  @default(0)
  listingsUpdated   Int                  @default(0)
  listingsRemoved   Int                  @default(0)
  errorMessage      String?
  startedAt         DateTime?
  finishedAt        DateTime?
  createdAt         DateTime             @default(now())

  @@index([competitorStoreId, createdAt(sort: Desc)])
  @@index([userId])
}
```

- [ ] **Adım 2: Migration uygula**

```bash
npx prisma migrate dev --name competitor_listings
```

Beklenen: `prisma/migrations/<ts>_competitor_listings/` oluşur, DB güncel.

- [ ] **Adım 3: Prisma Client regenerate + typecheck**

```bash
npx prisma generate
npm run typecheck
```

- [ ] **Adım 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): competitor listings + scans models for Phase 3"
```

---

### Task 2: Secrets Helper (API Key Encryption)

Scraper provider API key'leri plain text tutulmayacak. AES-GCM encrypt helper.

**Dosyalar:**
- Oluştur: `src/lib/secrets.ts`
- Test: `tests/unit/secrets.test.ts`
- Değiştir: `src/lib/env.ts` (yeni env: `SECRETS_ENCRYPTION_KEY`)

- [ ] **Adım 1: Env şemasına ekle**

```ts
// src/lib/env.ts içine
SECRETS_ENCRYPTION_KEY: z.string().length(64), // hex, 32 byte
```

`.env.example` içine:
```env
# 32-byte hex key — üretim için: node -e "console.log(crypto.randomBytes(32).toString('hex'))"
SECRETS_ENCRYPTION_KEY=replace-with-64-hex-chars
```

- [ ] **Adım 2: Failing test**

```ts
// tests/unit/secrets.test.ts
import { describe, expect, it } from "vitest";
import { encryptSecret, decryptSecret } from "@/lib/secrets";

describe("secrets", () => {
  it("encrypt + decrypt round-trip", () => {
    const plain = "apify_api_token_very_secret_abc123";
    const cipher = encryptSecret(plain);
    expect(cipher).not.toContain(plain);
    expect(cipher.split(":")).toHaveLength(3); // iv:tag:ciphertext
    expect(decryptSecret(cipher)).toBe(plain);
  });
  it("bozuk cipher text Error fırlatır", () => {
    expect(() => decryptSecret("invalid:format")).toThrow();
  });
  it("iki farklı encrypt çağrısı farklı cipher üretir (IV random)", () => {
    const plain = "same-input";
    expect(encryptSecret(plain)).not.toBe(encryptSecret(plain));
  });
});
```

`npm run test -- secrets` → FAIL.

- [ ] **Adım 3: Impl**

```ts
// src/lib/secrets.ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

const ALGO = "aes-256-gcm";
const KEY = Buffer.from(env.SECRETS_ENCRYPTION_KEY, "hex");

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(cipherText: string): string {
  const parts = cipherText.split(":");
  if (parts.length !== 3) throw new Error("Geçersiz cipher format");
  const [ivHex, tagHex, encHex] = parts;
  const decipher = createDecipheriv(ALGO, KEY, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}
```

- [ ] **Adım 4: Test pass + commit**

```bash
npm run test -- secrets
git add src/lib/secrets.ts tests/unit/secrets.test.ts src/lib/env.ts .env.example
git commit -m "feat(lib): AES-GCM secrets helper for provider API keys"
```

---

### Task 3: Scraper Provider Abstraction + Types

**Dosyalar:**
- Oluştur: `src/providers/scraper/types.ts`, `index.ts`
- Test: `tests/unit/scraper-factory.test.ts`

- [ ] **Adım 1: Type tanımları**

```ts
// src/providers/scraper/types.ts
import type { SourcePlatform, CompetitorListingStatus } from "@prisma/client";

export type ScrapedListing = {
  externalId: string;            // Etsy listing_id / Amazon ASIN
  platform: SourcePlatform;
  sourceUrl: string;
  title: string;
  thumbnailUrl: string | null;
  imageUrls: string[];
  priceCents: number | null;
  currency: string | null;
  reviewCount: number;
  favoritesCount: number | null;
  status: CompetitorListingStatus;
  rawMetadata?: Record<string, unknown>;
};

export type ScrapedStore = {
  etsyShopName: string;
  platform: SourcePlatform;
  displayName: string | null;
  shopUrl: string;
  totalListings: number | null;
  totalReviews: number | null;
};

export type ScanScope =
  | { mode: "initial_full" }
  | { mode: "incremental_since"; sinceIso: string; knownExternalIds: string[] };

export type ScanResult = {
  store: ScrapedStore;
  listings: ScrapedListing[];
  scanMeta: {
    provider: string;
    durationMs: number;
    apiCreditsUsed?: number;
  };
};

export interface ScraperProvider {
  readonly name: "apify" | "firecrawl" | "self-hosted";
  scanStore(input: {
    shopIdentifier: string;       // shop name veya URL
    platform: SourcePlatform;
    scope: ScanScope;
  }): Promise<ScanResult>;
  parseSingleListing(url: string): Promise<ScrapedListing>;
}
```

- [ ] **Adım 2: Factory**

```ts
// src/providers/scraper/index.ts
import { db } from "@/server/db";
import { decryptSecret } from "@/lib/secrets";
import type { ScraperProvider } from "./types";
import { ApifyScraper } from "./apify-provider";
import { FirecrawlScraper } from "./firecrawl-provider";
import { SelfHostedScraper } from "./self-hosted-provider";

export async function getScraper(): Promise<ScraperProvider> {
  const setting = await db.featureFlag.findUnique({ where: { key: "scraper.active_provider" } });
  const active = (setting?.metadata as { provider?: string } | null)?.provider ?? "self-hosted";

  if (active === "apify") {
    const keyRow = await db.featureFlag.findUnique({ where: { key: "scraper.apify.api_key" } });
    const token = keyRow?.metadata && (keyRow.metadata as { encrypted?: string }).encrypted;
    if (!token) throw new Error("Apify API key ayarlanmamış");
    return new ApifyScraper(decryptSecret(token));
  }
  if (active === "firecrawl") {
    const keyRow = await db.featureFlag.findUnique({ where: { key: "scraper.firecrawl.api_key" } });
    const token = keyRow?.metadata && (keyRow.metadata as { encrypted?: string }).encrypted;
    if (!token) throw new Error("Firecrawl API key ayarlanmamış");
    return new FirecrawlScraper(decryptSecret(token));
  }
  return new SelfHostedScraper();
}

export type { ScraperProvider, ScrapedListing, ScrapedStore, ScanResult, ScanScope } from "./types";
```

> **Not:** API key'ler `FeatureFlag.metadata` içinde `{ encrypted: "..." }` olarak tutulur. Ayrı `ProviderConfig` tablosu gerekmez — flag zaten admin-editable.

- [ ] **Adım 3: Test — factory kararları**

```ts
// tests/unit/scraper-factory.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { db } from "@/server/db";
import { encryptSecret } from "@/lib/secrets";
import { getScraper } from "@/providers/scraper";

describe("scraper factory", () => {
  beforeEach(async () => {
    await db.featureFlag.deleteMany({
      where: { key: { startsWith: "scraper." } },
    });
  });

  it("flag yoksa self-hosted döner", async () => {
    const s = await getScraper();
    expect(s.name).toBe("self-hosted");
  });

  it("apify seçiliyse ve key varsa apify döner", async () => {
    await db.featureFlag.create({
      data: { key: "scraper.active_provider", enabled: true, metadata: { provider: "apify" } },
    });
    await db.featureFlag.create({
      data: { key: "scraper.apify.api_key", enabled: true, metadata: { encrypted: encryptSecret("test-token") } },
    });
    const s = await getScraper();
    expect(s.name).toBe("apify");
  });

  it("apify seçili ama key yoksa hata fırlatır", async () => {
    await db.featureFlag.create({
      data: { key: "scraper.active_provider", enabled: true, metadata: { provider: "apify" } },
    });
    await expect(getScraper()).rejects.toThrow(/Apify API key/);
  });
});
```

- [ ] **Adım 4: Commit (stub impl'ler sonraki task'larda)**

```bash
# Geçici: factory çalışsın diye boş sınıflar
touch src/providers/scraper/{apify,firecrawl,self-hosted}-provider.ts
# Her dosyaya: export class Xxx implements ScraperProvider { readonly name = "xxx"; scanStore() { throw new Error("not impl") } parseSingleListing() { throw new Error("not impl") } }

git add src/providers/scraper tests/unit/scraper-factory.test.ts
git commit -m "feat(scraper): provider abstraction + factory + stubs"
```

---

### Task 4: Self-Hosted Scraper + Etsy/Amazon Parsers

MVP için Apify/Firecrawl gerekli değil — self-hosted ile başlayıp, Apify'ı Task 5'te opsiyonel ekle.

**Dosyalar:**
- Oluştur: `src/providers/scraper/self-hosted-provider.ts`, `parsers/etsy-parser.ts`, `parsers/amazon-parser.ts`
- Test: `tests/unit/etsy-parser.test.ts`

- [ ] **Adım 1: Failing parser testi (HTML fixture)**

`tests/fixtures/etsy-listing.html` — gerçek bir Etsy listing sayfasının statik HTML örneği (kısaltılmış; og: meta + JSON-LD + review count elemanları var). Kullanıcının bir kereliğine test için indirdiği örnek; commit'e dahil.

```ts
// tests/unit/etsy-parser.test.ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseEtsyListing } from "@/providers/scraper/parsers/etsy-parser";

describe("etsy parser", () => {
  it("fixture HTML'den listing alanlarını çıkarır", async () => {
    const html = await readFile(resolve(__dirname, "../fixtures/etsy-listing.html"), "utf8");
    const result = parseEtsyListing(html, "https://www.etsy.com/listing/1234567890/example-item");
    expect(result.externalId).toBe("1234567890");
    expect(result.title).toBeTruthy();
    expect(result.imageUrls.length).toBeGreaterThan(0);
    expect(result.reviewCount).toBeGreaterThanOrEqual(0);
    expect(result.priceCents).toBeGreaterThan(0);
    expect(result.currency).toBeTruthy();
  });

  it("bozuk HTML'de minimum bilgi döner, boş imageUrls kabul edilir", () => {
    const result = parseEtsyListing("<html></html>", "https://www.etsy.com/listing/999/x");
    expect(result.externalId).toBe("999");
    expect(result.imageUrls).toEqual([]);
    expect(result.title).toBe("");
  });
});
```

`npm run test -- etsy-parser` → FAIL.

- [ ] **Adım 2: Etsy parser impl**

```ts
// src/providers/scraper/parsers/etsy-parser.ts
import { load } from "cheerio";
import { SourcePlatform } from "@prisma/client";
import { CompetitorListingStatus } from "@prisma/client";
import type { ScrapedListing } from "../types";

export function parseEtsyListing(html: string, sourceUrl: string): ScrapedListing {
  const $ = load(html);
  const externalId = sourceUrl.match(/\/listing\/(\d+)/)?.[1] ?? "";

  const title = $('meta[property="og:title"]').attr("content")?.trim() ?? $("title").text().trim() ?? "";

  const ogImage = $('meta[property="og:image"]').attr("content") ?? null;
  const imageUrls: string[] = [];
  $('meta[property="og:image"], meta[property="og:image:secure_url"]').each((_, el) => {
    const content = $(el).attr("content");
    if (content && !imageUrls.includes(content)) imageUrls.push(content);
  });
  // JSON-LD'den image array (daha güvenilir)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).contents().text());
      if (data.image) {
        const images = Array.isArray(data.image) ? data.image : [data.image];
        for (const img of images) if (typeof img === "string" && !imageUrls.includes(img)) imageUrls.push(img);
      }
    } catch {
      /* ignore invalid JSON-LD */
    }
  });

  let priceCents: number | null = null;
  let currency: string | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).contents().text());
      const offers = data.offers ?? data["@graph"]?.find((g: { offers?: unknown }) => g.offers)?.offers;
      const price = offers?.price ?? offers?.[0]?.price;
      const curr = offers?.priceCurrency ?? offers?.[0]?.priceCurrency;
      if (price && !priceCents) priceCents = Math.round(parseFloat(price) * 100);
      if (curr && !currency) currency = curr;
    } catch {
      /* ignore */
    }
  });

  let reviewCount = 0;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).contents().text());
      const rating = data.aggregateRating ?? data["@graph"]?.find((g: { aggregateRating?: unknown }) => g.aggregateRating)?.aggregateRating;
      if (rating?.reviewCount) reviewCount = parseInt(String(rating.reviewCount), 10) || 0;
    } catch {
      /* ignore */
    }
  });

  return {
    externalId,
    platform: SourcePlatform.ETSY,
    sourceUrl,
    title,
    thumbnailUrl: ogImage,
    imageUrls,
    priceCents,
    currency,
    reviewCount,
    favoritesCount: null,
    status: CompetitorListingStatus.ACTIVE,
  };
}
```

- [ ] **Adım 3: Amazon parser (daha basit, og:image + title + ASIN)**

```ts
// src/providers/scraper/parsers/amazon-parser.ts
import { load } from "cheerio";
import { SourcePlatform, CompetitorListingStatus } from "@prisma/client";
import type { ScrapedListing } from "../types";

export function parseAmazonListing(html: string, sourceUrl: string): ScrapedListing {
  const $ = load(html);
  const asin = sourceUrl.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/)?.[1] ?? "";
  const title = $('meta[property="og:title"]').attr("content")?.trim() ?? "";
  const ogImage = $('meta[property="og:image"]').attr("content") ?? null;

  let reviewCount = 0;
  const reviewText = $('#acrCustomerReviewText').text();
  const match = reviewText.match(/([\d,]+)/);
  if (match) reviewCount = parseInt(match[1].replace(/,/g, ""), 10) || 0;

  return {
    externalId: asin,
    platform: SourcePlatform.AMAZON,
    sourceUrl,
    title,
    thumbnailUrl: ogImage,
    imageUrls: ogImage ? [ogImage] : [],
    priceCents: null,
    currency: null,
    reviewCount,
    favoritesCount: null,
    status: CompetitorListingStatus.ACTIVE,
  };
}
```

- [ ] **Adım 4: Self-hosted provider**

```ts
// src/providers/scraper/self-hosted-provider.ts
import pLimit from "p-limit";
import { SourcePlatform } from "@prisma/client";
import type { ScraperProvider, ScrapedListing, ScrapedStore, ScanResult, ScanScope } from "./types";
import { parseEtsyListing } from "./parsers/etsy-parser";
import { parseAmazonListing } from "./parsers/amazon-parser";
import { logger } from "@/lib/logger";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36";

export class SelfHostedScraper implements ScraperProvider {
  readonly name = "self-hosted" as const;

  async scanStore(input: { shopIdentifier: string; platform: SourcePlatform; scope: ScanScope }): Promise<ScanResult> {
    const started = Date.now();
    if (input.platform !== SourcePlatform.ETSY) {
      throw new Error("Self-hosted scraper Phase 3'te yalnız Etsy destekler");
    }
    const shopUrl = input.shopIdentifier.startsWith("http")
      ? input.shopIdentifier
      : `https://www.etsy.com/shop/${encodeURIComponent(input.shopIdentifier)}`;

    // 1. Shop sayfasını çek
    const shopHtml = await this.fetchHtml(shopUrl);
    const { listingUrls, store } = this.parseShopPage(shopHtml, shopUrl, input.shopIdentifier);

    // 2. Incremental mode — bilinen ID'leri atla
    const knownIds = input.scope.mode === "incremental_since" ? new Set(input.scope.knownExternalIds) : new Set<string>();
    const toFetch = listingUrls.filter((u) => {
      const id = u.match(/\/listing\/(\d+)/)?.[1];
      return id && !knownIds.has(id);
    });

    // 3. Rate limited listing fetch
    const limit = pLimit(2);
    const listings: ScrapedListing[] = [];
    await Promise.all(toFetch.slice(0, 50).map((url) => limit(async () => {
      try {
        await this.sleep(3000 + Math.random() * 2000);
        const html = await this.fetchHtml(url);
        listings.push(parseEtsyListing(html, url));
      } catch (err) {
        logger.warn({ url, err: (err as Error).message }, "listing scrape skipped");
      }
    })));

    return {
      store,
      listings,
      scanMeta: { provider: this.name, durationMs: Date.now() - started },
    };
  }

  async parseSingleListing(url: string): Promise<ScrapedListing> {
    const html = await this.fetchHtml(url);
    if (/etsy\.com/.test(url)) return parseEtsyListing(html, url);
    if (/amazon\./.test(url)) return parseAmazonListing(html, url);
    throw new Error(`Self-hosted parser desteklenmeyen platform: ${url}`);
  }

  private async fetchHtml(url: string): Promise<string> {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetch ${url}`);
    return res.text();
  }

  private parseShopPage(html: string, shopUrl: string, shopName: string): { listingUrls: string[]; store: ScrapedStore } {
    // Kısa MVP: regex ile /listing/<id>/... URL'lerini yakala. Daha zengin parsing Task 5'te Apify ile.
    const urls = Array.from(new Set(Array.from(html.matchAll(/https:\/\/www\.etsy\.com\/listing\/\d+\/[^"'<> ]+/g)).map((m) => m[0])));
    return {
      listingUrls: urls.slice(0, 100),
      store: {
        etsyShopName: shopName.replace(/.*\/shop\//, ""),
        platform: SourcePlatform.ETSY,
        displayName: null,
        shopUrl,
        totalListings: urls.length || null,
        totalReviews: null,
      },
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
```

- [ ] **Adım 5: `pLimit` + `cheerio` bağımlılıkları**

```bash
npm install p-limit cheerio
```

- [ ] **Adım 6: Testler + commit**

```bash
npm run test -- etsy-parser
git add src/providers/scraper tests/unit/etsy-parser.test.ts tests/fixtures package.json package-lock.json
git commit -m "feat(scraper): self-hosted etsy/amazon parser + rate-limited scan"
```

---

### Task 5: Apify Provider (Opsiyonel — Admin Seçerse)

**Dosyalar:**
- Oluştur: `src/providers/scraper/apify-provider.ts`

- [ ] **Adım 1: Apify client bağımlılığı**

```bash
npm install apify-client
```

- [ ] **Adım 2: Impl**

```ts
// src/providers/scraper/apify-provider.ts
import { ApifyClient } from "apify-client";
import { SourcePlatform, CompetitorListingStatus } from "@prisma/client";
import type { ScraperProvider, ScanResult, ScanScope, ScrapedListing } from "./types";
import { logger } from "@/lib/logger";

const ETSY_STORE_ACTOR = "epctex/etsy-scraper";
const ETSY_LISTING_ACTOR = "epctex/etsy-scraper";

export class ApifyScraper implements ScraperProvider {
  readonly name = "apify" as const;
  private client: ApifyClient;

  constructor(apiToken: string) {
    this.client = new ApifyClient({ token: apiToken });
  }

  async scanStore(input: { shopIdentifier: string; platform: SourcePlatform; scope: ScanScope }): Promise<ScanResult> {
    if (input.platform !== SourcePlatform.ETSY) throw new Error("Apify Phase 3'te yalnız Etsy destekler");
    const started = Date.now();

    const run = await this.client.actor(ETSY_STORE_ACTOR).call({
      startUrls: [{
        url: input.shopIdentifier.startsWith("http")
          ? input.shopIdentifier
          : `https://www.etsy.com/shop/${input.shopIdentifier}`,
      }],
      mode: "SHOP",
      maxItems: input.scope.mode === "initial_full" ? 200 : 50,
    });

    const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
    const listings: ScrapedListing[] = items
      .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
      .map((i) => this.mapApifyItem(i as Record<string, unknown>));

    return {
      store: {
        etsyShopName: input.shopIdentifier.replace(/.*\/shop\//, ""),
        platform: SourcePlatform.ETSY,
        displayName: (items[0] as { shopName?: string })?.shopName ?? null,
        shopUrl: `https://www.etsy.com/shop/${input.shopIdentifier}`,
        totalListings: listings.length,
        totalReviews: null,
      },
      listings,
      scanMeta: { provider: this.name, durationMs: Date.now() - started },
    };
  }

  async parseSingleListing(url: string): Promise<ScrapedListing> {
    const run = await this.client.actor(ETSY_LISTING_ACTOR).call({
      startUrls: [{ url }],
      mode: "LISTING",
      maxItems: 1,
    });
    const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
    if (!items[0]) throw new Error(`Apify listing boş döndü: ${url}`);
    return this.mapApifyItem(items[0] as Record<string, unknown>);
  }

  private mapApifyItem(item: Record<string, unknown>): ScrapedListing {
    const id = String(item.listingId ?? item.id ?? "");
    const images = Array.isArray(item.images) ? (item.images as string[]).filter((x) => typeof x === "string") : [];
    const priceNum = typeof item.price === "number" ? item.price : parseFloat(String(item.price ?? "0"));
    return {
      externalId: id,
      platform: SourcePlatform.ETSY,
      sourceUrl: String(item.url ?? ""),
      title: String(item.title ?? ""),
      thumbnailUrl: images[0] ?? null,
      imageUrls: images,
      priceCents: priceNum > 0 ? Math.round(priceNum * 100) : null,
      currency: typeof item.currency === "string" ? item.currency : null,
      reviewCount: typeof item.reviewCount === "number" ? item.reviewCount : 0,
      favoritesCount: typeof item.favorers === "number" ? item.favorers : null,
      status: CompetitorListingStatus.ACTIVE,
      rawMetadata: item,
    };
  }
}
```

- [ ] **Adım 3: Commit**

```bash
git add src/providers/scraper/apify-provider.ts package.json package-lock.json
git commit -m "feat(scraper): apify provider (etsy store + listing actors)"
```

---

### Task 6: Competitor Service + Ranking Service

**Dosyalar:**
- Oluştur: `src/features/competitors/services/competitor-service.ts`, `ranking-service.ts`, `schemas/index.ts`
- Test: `tests/unit/competitor-service.test.ts`, `ranking-service.test.ts`

- [ ] **Adım 1: Schemas**

```ts
// src/features/competitors/schemas/index.ts
import { z } from "zod";

export const addCompetitorInput = z.object({
  shopIdentifier: z.string().min(2).max(200),
  platform: z.enum(["ETSY", "AMAZON"]).default("ETSY"),
  autoScanEnabled: z.boolean().default(false),
});
export type AddCompetitorInput = z.infer<typeof addCompetitorInput>;

export const reviewWindowSchema = z.enum(["30d", "90d", "365d", "all"]).default("all");
export type ReviewWindow = z.infer<typeof reviewWindowSchema>;
```

- [ ] **Adım 2: Ranking service + test (TDD)**

Ranking service review count tabanlı sıralama + window filter yapar.

```ts
// tests/unit/ranking-service.test.ts
import { describe, expect, it } from "vitest";
import { rankListingsByReviews, filterByWindow } from "@/features/competitors/services/ranking-service";

const now = new Date("2026-04-23T00:00:00Z");

describe("ranking-service", () => {
  it("reviewCount desc sıralar", () => {
    const result = rankListingsByReviews([
      { reviewCount: 10, lastSeenAt: now },
      { reviewCount: 50, lastSeenAt: now },
      { reviewCount: 20, lastSeenAt: now },
    ]);
    expect(result.map((l) => l.reviewCount)).toEqual([50, 20, 10]);
  });

  it("30d window eski listingleri eler", () => {
    const items = [
      { reviewCount: 100, lastSeenAt: new Date("2026-04-20") }, // inside
      { reviewCount: 50, lastSeenAt: new Date("2026-01-01") }, // outside
    ];
    const result = filterByWindow(items, "30d", now);
    expect(result).toHaveLength(1);
    expect(result[0].reviewCount).toBe(100);
  });

  it("all window hiç elemez", () => {
    const items = [
      { reviewCount: 1, lastSeenAt: new Date("2020-01-01") },
      { reviewCount: 2, lastSeenAt: now },
    ];
    expect(filterByWindow(items, "all", now)).toHaveLength(2);
  });
});
```

Impl:

```ts
// src/features/competitors/services/ranking-service.ts
import type { ReviewWindow } from "../schemas";

type Rankable = { reviewCount: number; lastSeenAt: Date };

export function rankListingsByReviews<T extends Rankable>(listings: T[]): T[] {
  return [...listings].sort((a, b) => b.reviewCount - a.reviewCount);
}

const WINDOW_DAYS: Record<Exclude<ReviewWindow, "all">, number> = {
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

export function filterByWindow<T extends Rankable>(listings: T[], window: ReviewWindow, now = new Date()): T[] {
  if (window === "all") return listings;
  const days = WINDOW_DAYS[window];
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return listings.filter((l) => l.lastSeenAt >= cutoff);
}
```

- [ ] **Adım 3: Competitor service — CRUD + scan orchestration**

```ts
// src/features/competitors/services/competitor-service.ts
import { JobType, SourcePlatform, CompetitorScanType } from "@prisma/client";
import { db } from "@/server/db";
import { enqueue } from "@/server/queue";
import { assertOwnsResource, scopedWhere } from "@/server/authorization";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { AddCompetitorInput } from "../schemas";

export async function listCompetitors(userId: string) {
  return db.competitorStore.findMany({
    where: scopedWhere(userId),
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { listings: true } } },
  });
}

export async function getCompetitor(userId: string, id: string) {
  const store = await db.competitorStore.findFirst({ where: { id, userId, deletedAt: null } });
  if (!store) throw new NotFoundError("Rakip mağaza bulunamadı");
  return store;
}

export async function addCompetitor(userId: string, input: AddCompetitorInput) {
  const shopName = input.shopIdentifier.replace(/.*\/shop\//, "").replace(/\/$/, "");
  const exists = await db.competitorStore.findFirst({
    where: { userId, etsyShopName: shopName, deletedAt: null },
  });
  if (exists) throw new ConflictError("Bu mağaza zaten takibinde");

  const store = await db.competitorStore.create({
    data: {
      userId,
      etsyShopName: shopName,
      platform: input.platform === "AMAZON" ? SourcePlatform.AMAZON : SourcePlatform.ETSY,
      shopUrl: input.shopIdentifier.startsWith("http") ? input.shopIdentifier : null,
      autoScanEnabled: input.autoScanEnabled,
    },
  });

  await triggerScan({ userId, competitorStoreId: store.id, type: CompetitorScanType.INITIAL_FULL });
  return store;
}

export async function triggerScan(args: {
  userId: string;
  competitorStoreId: string;
  type: CompetitorScanType;
}) {
  const store = await getCompetitor(args.userId, args.competitorStoreId);
  const job = await db.job.create({
    data: {
      userId: args.userId,
      type: JobType.SCRAPE_COMPETITOR,
      metadata: { competitorStoreId: store.id, scanType: args.type },
    },
  });
  const scan = await db.competitorScan.create({
    data: {
      userId: args.userId,
      competitorStoreId: store.id,
      jobId: job.id,
      type: args.type,
      provider: "pending",
    },
  });
  const bull = await enqueue(JobType.SCRAPE_COMPETITOR, {
    jobId: job.id,
    scanId: scan.id,
    userId: args.userId,
    competitorStoreId: store.id,
    type: args.type,
  });
  await db.job.update({ where: { id: job.id }, data: { bullJobId: bull.id } });
  return { jobId: job.id, scanId: scan.id };
}

export async function deleteCompetitor(userId: string, id: string) {
  const store = await getCompetitor(userId, id);
  assertOwnsResource(userId, store);
  await db.competitorStore.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
```

- [ ] **Adım 4: Service testleri + data isolation**

```ts
// tests/unit/competitor-service.test.ts
// Setup: iki user oluştur, biri bir competitor store ekler, diğeri görmez.
// Test: addCompetitor aynı shopName ikinci kez ConflictError.
// Test: deleteCompetitor başka userın store'u ise ForbiddenError (getCompetitor üzerinden NotFoundError olur — bu kabul).
// Test: triggerScan job + scan kaydı oluşturur.
```

- [ ] **Adım 5: Commit**

```bash
git add src/features/competitors/services src/features/competitors/schemas tests/unit/competitor-service.test.ts tests/unit/ranking-service.test.ts
git commit -m "feat(competitors): service (CRUD + scan) + review-count ranking"
```

---

### Task 7: Scrape Competitor Worker

**Dosyalar:**
- Oluştur: `src/server/workers/scrape-competitor.worker.ts`
- Değiştir: `src/server/workers/bootstrap.ts` (handler ekle)

- [ ] **Adım 1: Worker impl**

```ts
// src/server/workers/scrape-competitor.worker.ts
import { JobStatus, CompetitorScanStatus, CompetitorScanType, CompetitorListingStatus } from "@prisma/client";
import { db } from "@/server/db";
import { getScraper } from "@/providers/scraper";
import { logger } from "@/lib/logger";

type Payload = {
  jobId: string;
  scanId: string;
  userId: string;
  competitorStoreId: string;
  type: CompetitorScanType;
};

export async function handleScrapeCompetitor(job: { data: Payload }) {
  const { jobId, scanId, userId, competitorStoreId, type } = job.data;

  await Promise.all([
    db.job.update({ where: { id: jobId }, data: { status: JobStatus.RUNNING, startedAt: new Date() } }),
    db.competitorScan.update({ where: { id: scanId }, data: { status: CompetitorScanStatus.RUNNING, startedAt: new Date() } }),
  ]);

  try {
    const store = await db.competitorStore.findFirstOrThrow({ where: { id: competitorStoreId, userId } });
    const scraper = await getScraper();

    const knownListings = await db.competitorListing.findMany({
      where: { competitorStoreId },
      select: { externalId: true },
    });
    const knownIds = knownListings.map((l) => l.externalId);

    const result = await scraper.scanStore({
      shopIdentifier: store.shopUrl ?? store.etsyShopName,
      platform: store.platform,
      scope: type === CompetitorScanType.INITIAL_FULL
        ? { mode: "initial_full" }
        : { mode: "incremental_since", sinceIso: store.lastScannedAt?.toISOString() ?? "1970-01-01", knownExternalIds: knownIds },
    });

    let newCount = 0;
    let updatedCount = 0;
    for (const l of result.listings) {
      const up = await db.competitorListing.upsert({
        where: { competitorStoreId_externalId: { competitorStoreId, externalId: l.externalId } },
        create: {
          competitorStoreId,
          userId,
          externalId: l.externalId,
          platform: l.platform,
          sourceUrl: l.sourceUrl,
          title: l.title,
          thumbnailUrl: l.thumbnailUrl,
          imageUrls: l.imageUrls,
          priceCents: l.priceCents,
          currency: l.currency,
          reviewCount: l.reviewCount,
          favoritesCount: l.favoritesCount,
          status: l.status,
          rawMetadata: l.rawMetadata ?? undefined,
        },
        update: {
          title: l.title,
          imageUrls: l.imageUrls,
          priceCents: l.priceCents,
          reviewCount: l.reviewCount,
          favoritesCount: l.favoritesCount,
          thumbnailUrl: l.thumbnailUrl,
          status: l.status,
          lastSeenAt: new Date(),
          rawMetadata: l.rawMetadata ?? undefined,
        },
      });
      if (up.createdAt.getTime() === up.updatedAt.getTime()) newCount++;
      else updatedCount++;
    }

    // Ortadan kalkan listingler — son scan'de görülmeyen aktif kayıtlar
    const seenIds = result.listings.map((l) => l.externalId);
    const removed = await db.competitorListing.updateMany({
      where: {
        competitorStoreId,
        status: CompetitorListingStatus.ACTIVE,
        externalId: { notIn: seenIds.length ? seenIds : ["__none__"] },
        lastSeenAt: { lt: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
      },
      data: { status: CompetitorListingStatus.DELETED },
    });

    await Promise.all([
      db.competitorStore.update({
        where: { id: competitorStoreId },
        data: {
          displayName: result.store.displayName,
          totalListings: result.store.totalListings ?? undefined,
          totalReviews: result.store.totalReviews ?? undefined,
          lastScannedAt: new Date(),
        },
      }),
      db.competitorScan.update({
        where: { id: scanId },
        data: {
          status: CompetitorScanStatus.SUCCESS,
          finishedAt: new Date(),
          provider: result.scanMeta.provider,
          listingsFound: result.listings.length,
          listingsNew: newCount,
          listingsUpdated: updatedCount,
          listingsRemoved: removed.count,
        },
      }),
      db.job.update({
        where: { id: jobId },
        data: { status: JobStatus.SUCCESS, finishedAt: new Date(), progress: 100 },
      }),
    ]);

    return { listingsFound: result.listings.length, newCount, updatedCount };
  } catch (err) {
    const message = (err as Error).message;
    logger.error({ jobId, scanId, err: message }, "scrape competitor failed");
    await Promise.all([
      db.competitorScan.update({
        where: { id: scanId },
        data: { status: CompetitorScanStatus.FAILED, errorMessage: message, finishedAt: new Date() },
      }),
      db.job.update({
        where: { id: jobId },
        data: { status: JobStatus.FAILED, error: message, finishedAt: new Date() },
      }),
    ]);
    throw err;
  }
}
```

- [ ] **Adım 2: Bootstrap'a ekle**

```ts
// src/server/workers/bootstrap.ts içine spec ekle
import { handleScrapeCompetitor } from "./scrape-competitor.worker";
// specs array'ine:
{ name: JobType.SCRAPE_COMPETITOR, handler: handleScrapeCompetitor },
```

- [ ] **Adım 3: Integration test — mock scraper**

```ts
// tests/integration/scrape-worker.test.ts
// Yaklaşım: getScraper'ı vi.mock ile stub'la, sabit bir ScanResult döndür.
// Test: 3 listing olan mock'u scan et → DB'de 3 kayıt, CompetitorScan SUCCESS.
// Test: İkinci run'da 1 listing kaybolursa → ilk taramadaki 1 kayıt 7 gün sonrası DELETED (bu için lastSeenAt manipüle et).
```

- [ ] **Adım 4: Commit**

```bash
git add src/server/workers/scrape-competitor.worker.ts src/server/workers/bootstrap.ts tests/integration/scrape-worker.test.ts
git commit -m "feat(worker): SCRAPE_COMPETITOR — full/incremental scan + DELETED marking"
```

---

### Task 8: Fetch New Listings Worker (Repeat Job)

Günde bir çalışan BullMQ repeat job; `autoScanEnabled: true` olan competitor store'lar için incremental scan tetikler.

**Dosyalar:**
- Oluştur: `src/server/workers/fetch-new-listings.worker.ts`
- Değiştir: `src/server/workers/bootstrap.ts` (repeat schedule)

- [ ] **Adım 1: Worker impl**

```ts
// src/server/workers/fetch-new-listings.worker.ts
import { JobStatus, CompetitorScanType } from "@prisma/client";
import { db } from "@/server/db";
import { triggerScan } from "@/features/competitors/services/competitor-service";
import { logger } from "@/lib/logger";

type Payload = Record<string, never>; // repeat job, payload yok

export async function handleFetchNewListings(_job: { data: Payload }) {
  const stores = await db.competitorStore.findMany({
    where: { autoScanEnabled: true, deletedAt: null },
    select: { id: true, userId: true },
  });
  logger.info({ count: stores.length }, "fetch new listings — scan triggering");

  for (const s of stores) {
    try {
      await triggerScan({
        userId: s.userId,
        competitorStoreId: s.id,
        type: CompetitorScanType.INCREMENTAL_NEW,
      });
    } catch (err) {
      logger.error({ storeId: s.id, err: (err as Error).message }, "auto scan trigger failed");
    }
  }

  return { triggered: stores.length };
}
```

- [ ] **Adım 2: Repeat schedule**

```ts
// bootstrap.ts içinde startWorkers() sonunda:
import { queues } from "@/server/queue";
// ...
await queues[JobType.FETCH_NEW_LISTINGS].add(
  JobType.FETCH_NEW_LISTINGS,
  {},
  { repeat: { pattern: "0 6 * * *" }, jobId: "fetch-new-listings-daily" }, // her gün 06:00
);
new Worker(JobType.FETCH_NEW_LISTINGS, handleFetchNewListings, { connection, concurrency: 1 });
```

- [ ] **Adım 3: Commit**

```bash
git add src/server/workers/fetch-new-listings.worker.ts src/server/workers/bootstrap.ts
git commit -m "feat(worker): FETCH_NEW_LISTINGS — daily repeat for auto-scan stores"
```

---

### Task 9: Competitor API Routes

**Dosyalar:**
- Oluştur: `src/app/api/competitors/route.ts`, `[id]/route.ts`, `[id]/scan/route.ts`, `[id]/listings/route.ts`

- [ ] **Adım 1: List + create**

```ts
// src/app/api/competitors/route.ts
import { NextResponse } from "next/server";
import { requireUser } from "@/server/authorization";
import { addCompetitorInput } from "@/features/competitors/schemas";
import { addCompetitor, listCompetitors } from "@/features/competitors/services/competitor-service";

export async function GET() {
  const user = await requireUser();
  const stores = await listCompetitors(user.id);
  return NextResponse.json(stores);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = addCompetitorInput.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  const store = await addCompetitor(user.id, parsed.data);
  return NextResponse.json(store, { status: 201 });
}
```

- [ ] **Adım 2: Detail + delete + scan trigger + listings filter**

Her handler `requireUser` → service çağrısı → hata durumunda AppError'dan status code. Listings endpoint window + sort + cursor pagination.

```ts
// src/app/api/competitors/[id]/listings/route.ts (özet)
import { NextResponse } from "next/server";
import { requireUser } from "@/server/authorization";
import { db } from "@/server/db";
import { reviewWindowSchema } from "@/features/competitors/schemas";
import { filterByWindow, rankListingsByReviews } from "@/features/competitors/services/ranking-service";
import { getCompetitor } from "@/features/competitors/services/competitor-service";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const url = new URL(req.url);
  const window = reviewWindowSchema.parse(url.searchParams.get("window") ?? "all");
  await getCompetitor(user.id, params.id); // ownership check

  const listings = await db.competitorListing.findMany({
    where: { competitorStoreId: params.id, userId: user.id },
  });
  const filtered = filterByWindow(listings, window);
  const ranked = rankListingsByReviews(filtered);
  return NextResponse.json({ items: ranked.slice(0, 100) });
}
```

- [ ] **Adım 3: Integration tests**

```ts
// tests/integration/api-competitors.test.ts
// Setup: iki user, mock scraper (vi.mock ile getScraper).
// Test: userA POST /api/competitors → 201; userB GET /api/competitors → item yok.
// Test: userB DELETE /api/competitors/{userA_id} → 404 (getCompetitor NotFound).
// Test: userA POST /api/competitors/{id}/scan → scan kaydı oluşur, job QUEUED.
// Test: listings window=30d filtresi eski kayıtları dışarıda bırakır.
```

- [ ] **Adım 4: Commit**

```bash
git add src/app/api/competitors tests/integration/api-competitors.test.ts tests/integration/api-competitor-data-isolation.test.ts
git commit -m "feat(api): competitors CRUD + scan trigger + ranked listings"
```

---

### Task 10: Admin Scraper Provider Ayarları

**Dosyalar:**
- Oluştur: `src/app/api/admin/scraper-providers/route.ts`
- Oluştur: `src/app/(admin)/admin/scraper-providers/page.tsx`

Admin panelinden aktif provider ve API key yönetimi.

- [ ] **Adım 1: API**

```ts
// src/app/api/admin/scraper-providers/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/authorization";
import { db } from "@/server/db";
import { encryptSecret } from "@/lib/secrets";
import { audit } from "@/server/audit";

export async function GET() {
  await requireAdmin();
  const flags = await db.featureFlag.findMany({ where: { key: { startsWith: "scraper." } } });
  return NextResponse.json(flags.map((f) => ({
    key: f.key,
    enabled: f.enabled,
    hasValue: !!(f.metadata as { encrypted?: string } | null)?.encrypted || !!(f.metadata as { provider?: string } | null)?.provider,
  })));
}

const patchBody = z.object({
  activeProvider: z.enum(["apify", "firecrawl", "self-hosted"]).optional(),
  apifyApiKey: z.string().min(10).optional(),
  firecrawlApiKey: z.string().min(10).optional(),
});

export async function PATCH(req: Request) {
  const user = await requireAdmin();
  const parsed = patchBody.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz" }, { status: 400 });

  if (parsed.data.activeProvider) {
    await db.featureFlag.upsert({
      where: { key: "scraper.active_provider" },
      create: { key: "scraper.active_provider", enabled: true, metadata: { provider: parsed.data.activeProvider } },
      update: { metadata: { provider: parsed.data.activeProvider } },
    });
  }
  if (parsed.data.apifyApiKey) {
    await db.featureFlag.upsert({
      where: { key: "scraper.apify.api_key" },
      create: { key: "scraper.apify.api_key", enabled: true, metadata: { encrypted: encryptSecret(parsed.data.apifyApiKey) } },
      update: { metadata: { encrypted: encryptSecret(parsed.data.apifyApiKey) } },
    });
  }
  if (parsed.data.firecrawlApiKey) {
    await db.featureFlag.upsert({
      where: { key: "scraper.firecrawl.api_key" },
      create: { key: "scraper.firecrawl.api_key", enabled: true, metadata: { encrypted: encryptSecret(parsed.data.firecrawlApiKey) } },
      update: { metadata: { encrypted: encryptSecret(parsed.data.firecrawlApiKey) } },
    });
  }

  await audit({ userId: user.id, actor: user.email, action: "admin.scraper_providers.update" });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Adım 2: Admin UI**

Sayfa form: radio seçimi (active provider) + 2 password input (Apify/Firecrawl key). Kaydedilen key geri gösterilmez — yalnız "Key kayıtlı" badge'i.

- [ ] **Adım 3: Commit**

```bash
git add src/app/api/admin/scraper-providers src/app/(admin)/admin/scraper-providers
git commit -m "feat(admin): scraper provider settings + encrypted api key"
```

---

### Task 11: User UI — `/competitors` + `[id]` Sayfaları

**Dosyalar:**
- Oluştur: `src/app/(app)/competitors/page.tsx`, `[id]/page.tsx`
- Oluştur: tüm `src/features/competitors/components/*`
- Oluştur: tüm `queries/` ve `mutations/`

- [ ] **Adım 1: Liste sayfası**

Server component — `listCompetitors()` çağır. Her kart: mağaza adı, son tarama, listing sayısı, auto-scan toggle. "Rakip Ekle" dialog bir text input + platform selector + auto scan checkbox.

- [ ] **Adım 2: Detay sayfası**

`CompetitorListingGrid`: window filter (30d/90d/365d/all), "Yeniden Tara" butonu, ranked grid. Her kart: thumbnail, title, reviewCount badge, fiyat, "Bookmark", "Referansa Ekle", "Kaynağı Aç".

"Bookmark" aksiyonu mevcut `POST /api/bookmarks` endpoint'ini kullanır; `sourceUrl` + `title` + `sourcePlatform` + `thumbnailUrl` → ilk asset import için `import-url` kullanır, ardından bookmark yaratır.

- [ ] **Adım 3: Feature flag entegrasyonu**

`competitors.enabled` kapalı ise sayfa "Yakında" state'i gösterir. Sidebar navigation da flag'e bağlı.

- [ ] **Adım 4: Review count uyarı metni**

Her ranking başlığının altında küçük açıklama:
> "Yorum sayısı tahmini popülerlik sinyalidir; kesin satış rakamı değildir."

Bu tek kaynak `src/features/competitors/components/review-count-disclaimer.tsx` içinde; herkes import eder (tek yerden değişim).

- [ ] **Adım 5: Commit**

```bash
git add src/app/(app)/competitors src/features/competitors/components src/features/competitors/queries src/features/competitors/mutations
git commit -m "feat(competitors): user ui (list + detail + ranking + bookmark wiring)"
```

---

### Task 12: Asset URL Import — Etsy/Amazon Branch

Phase 1+2'deki `asset-ingest.worker.ts` yalnız og:image alıyordu. Şimdi Etsy/Amazon için scraper'ın `parseSingleListing()` fonksiyonunu çağıran branch ekle.

**Dosyalar:**
- Değiştir: `src/server/workers/asset-ingest.worker.ts`

- [ ] **Adım 1: Branch ekle**

```ts
// asset-ingest.worker.ts içinde fetchImageFromUrl'den önce:
import { getScraper } from "@/providers/scraper";

async function handleAssetIngestFromUrl(job: { data: Payload }) {
  // ... (mevcut başlangıç)
  try {
    let title: string | undefined;
    let imageBuffer: { buffer: Buffer; mimeType: string };

    if (/etsy\.com\/listing\//.test(sourceUrl) || /amazon\.(com|de|co\.uk|fr)/.test(sourceUrl)) {
      const scraper = await getScraper();
      const parsed = await scraper.parseSingleListing(sourceUrl);
      title = parsed.title;
      const imageUrl = parsed.imageUrls[0] ?? parsed.thumbnailUrl;
      if (!imageUrl) throw new Error("Listing'den görsel çıkarılamadı");
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`Görsel fetch başarısız: ${res.status}`);
      imageBuffer = {
        buffer: Buffer.from(await res.arrayBuffer()),
        mimeType: res.headers.get("content-type") ?? "image/jpeg",
      };
    } else {
      const fetched = await fetchImageFromUrl(sourceUrl);
      imageBuffer = { buffer: fetched.buffer, mimeType: fetched.mimeType };
      title = fetched.title;
    }

    const asset = await createAssetFromBuffer({
      userId,
      buffer: imageBuffer.buffer,
      mimeType: imageBuffer.mimeType,
      sourceUrl,
      sourcePlatform: detectPlatform(sourceUrl),
    });
    // ... success update (title metadata'ya yazılır)
  }
}
```

- [ ] **Adım 2: Integration test**

Mock scraper ile: Etsy URL → parseSingleListing mock → imageUrls → asset oluşur. `metadata.title` parse edilen başlığa eşit.

- [ ] **Adım 3: Commit**

```bash
git add src/server/workers/asset-ingest.worker.ts tests/integration/asset-ingest-etsy.test.ts
git commit -m "feat(asset-ingest): etsy/amazon branch via scraper.parseSingleListing"
```

---

### Task 13: E2E Smoke Test + Feature Flag Enable

**Dosyalar:**
- Oluştur: `tests/e2e/competitor-flow.spec.ts`
- Değiştir: `prisma/seed.ts` (flag açık değil, test helper açar)

- [ ] **Adım 1: Playwright akışı**

```ts
// tests/e2e/competitor-flow.spec.ts
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("competitor ekleme → dialog → liste kartı", async ({ page }) => {
  await login(page);
  await page.goto("/competitors");
  // Feature flag on ise "Rakip Ekle" butonu görünür
  await expect(page.getByRole("heading", { name: /Rakipler/i })).toBeVisible();
  // Scraper self-hosted; test ortamında network engelli — en azından dialog açılıp kapanır
  await page.getByRole("button", { name: /Rakip Ekle/i }).click();
  await expect(page.getByRole("heading", { name: /Etsy Mağazası Ekle/i })).toBeVisible();
  await page.getByRole("button", { name: /Kapat/i }).click();
});
```

- [ ] **Adım 2: Flag açılması için seed güncellemesi**

```ts
// prisma/seed.ts içindeki flags array'ine:
{ key: "competitors.enabled", enabled: true },
```

(İlk seed'de kapalıydı; Phase 3 tamamlandığında açık.)

- [ ] **Adım 3: Commit**

```bash
git add tests/e2e/competitor-flow.spec.ts prisma/seed.ts
git commit -m "test(e2e): competitor smoke + feature flag enable"
```

---

### Task 14: Release Quality Gates + Phase 3 Notes

- [ ] `npm run test:all` yeşil olmalı (typecheck + lint + check:tokens + vitest + playwright).
- [ ] Manifest kontrol:
  - `rg "#[0-9a-fA-F]{3,8}" src/ tests/` → eşleşme yok
  - `rg "bg-\[" src/` → eşleşme yok
  - `grep -L "requireUser\|requireAdmin" src/app/api/competitors/**/route.ts` → boş (hepsi guard'lı)
- [ ] `docs/plans/phase3-notes.md` yaz:
  - Ne eklendi (modeller, worker'lar, provider'lar, UI)
  - Scraper provider seçim rehberi (Apify recommended vs self-hosted)
  - Etsy/Amazon parsing sınırları (Pinterest/Instagram defer)
  - Rate limit değerleri
  - Phase 4 başlangıç pointer'ları (trend stories, çok mağazalı feed, cluster detection)
- [ ] Final commit:

```bash
git add docs/plans/phase3-notes.md
git commit -m "chore: phase 3 complete; all gates green"
```

---

## Kritik Dosyalar (Phase 3 Hızlı Referans)

| Dosya | Sorumluluk |
|-------|-----------|
| `prisma/schema.prisma` | `CompetitorListing`, `CompetitorScan` modelleri; `CompetitorStore` genişletildi |
| `src/lib/secrets.ts` | AES-GCM encrypt/decrypt helper |
| `src/providers/scraper/index.ts` | Scraper provider interface + factory |
| `src/providers/scraper/self-hosted-provider.ts` | Default scraper (cheerio + fetch) |
| `src/providers/scraper/apify-provider.ts` | Admin seçerse aktif olan managed scraper |
| `src/providers/scraper/parsers/etsy-parser.ts` | Etsy HTML → ScrapedListing |
| `src/features/competitors/services/competitor-service.ts` | CRUD + scan trigger |
| `src/features/competitors/services/ranking-service.ts` | Review count sort + window filter |
| `src/server/workers/scrape-competitor.worker.ts` | Full/incremental scan worker |
| `src/server/workers/fetch-new-listings.worker.ts` | Günlük repeat job |
| `src/app/(app)/competitors/page.tsx` | Kullanıcı competitor liste UI |
| `src/app/(admin)/admin/scraper-providers/page.tsx` | Admin provider + key yönetimi |

---

## Verification Plan (End-to-End)

### Otomatik
```bash
docker compose up -d
npm install   # apify-client, cheerio, p-limit eklenince
npx prisma migrate dev
npx prisma db seed
npm run test:all
```

Tüm adımlar exit code 0.

### Manuel (Tarayıcı)

1. `npm run dev` + `npm run worker` — ikisi ayakta.
2. Admin ile giriş → `/admin/scraper-providers` → "Self-hosted" seçili (default) veya Apify API key gir.
3. `/competitors` → "Rakip Ekle" → test Etsy shop name gir (örneğin tanıdığın küçük bir shop) → INITIAL_FULL scan tetiklenir.
4. Admin Jobs ekranı → `SCRAPE_COMPETITOR` job'u QUEUED → RUNNING → SUCCESS (self-hosted tipik 30-60 sn).
5. `/competitors/{id}` → ranked listing grid, window filter çalışıyor.
6. Bir listing'de "Bookmark" → `/bookmarks`'ta yeni kart (Etsy sourcePlatform + thumbnail).
7. Auto-scan toggle aç → ertesi gün 06:00 repeat job tetikler (manuel test: BullMQ Bull Board veya manuel enqueue ile doğrula).
8. İkinci kullanıcı ile giriş → birinci kullanıcının rakipleri görünmüyor (data isolation).
9. Scraper provider'ı değiştir → admin "Apify" seç + key gir → yeni scan "apify" provider ile çalışır (CompetitorScan.provider alanında görülür).

### Quality Gate Checklist
- [ ] **Kod:** typecheck, lint, check:tokens, vitest, playwright — yeşil.
- [ ] **Davranış:** scan full + incremental + DELETED marking + bookmark wiring + ranking doğru.
- [ ] **Ürün:** review count uyarı metni her ranking ekranında görünür; kullanıcı yanıltıcı bilgi almaz.
- [ ] **Stabilite:** scraper hata verirse scan FAILED + kullanıcı görünür hata; worker restart'a dayanıklı.
- [ ] **Güvenlik:** API key encrypted; plain text response body'de dönmüyor; yalnız admin `PATCH` yapabiliyor.

---

## Bilinen Sınırlar / Phase 4+'e Ertelenenler

- **Pinterest/Instagram competitor scraping:** Phase 4 — platform API gereksinimleri farklı.
- **Satış sayısı tahmini (review × çarpan):** Yapılmayacak — yanıltıcı olur. Review count olduğu gibi gösterilir.
- **Trend cluster detection** (birden fazla mağazada aynı konu): Phase 4.
- **Review content analysis** (hangi ürün neden beğenilmiş): Phase 6 (review sentiment).
- **Etsy OAuth — kullanıcı kendi mağazası:** Phase 9 (Listing Builder draft push).
- **Embedding tabanlı similarity** (aynı/benzer tasarım tespiti): Phase 5+.
- **Semantic dedupe:** Phase 5+.
- **CAPTCHA bypass:** Uygulanmayacak — policy. Apify rate-limit + proxy çözüyor; self-hosted CAPTCHA görürse scan FAILED döner.
- **Per-user cost limit hard block:** Phase 5'te cost guardrails ile gelir; Phase 3'te yalnız CostUsage kayıt izleme.
