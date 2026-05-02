# Phase 9 — Listing Builder Design (Taslak)

> **Status:** 🟡 Brainstorm taslağı (kullanıcı onayı bekliyor)
> **Tarih:** 2026-05-02
> **Phase 8 referans:** [`./2026-05-01-phase8-mockup-studio-design.md`](./2026-05-01-phase8-mockup-studio-design.md)
> **Phase 8 closeout:** [`../design/implementation-notes/phase8-closeout.md`](../design/implementation-notes/phase8-closeout.md)
> **CLAUDE.md disipline referansı:** §11 Listing Builder, §12 Publishing Queue, "Listing Readiness Checklist", "Master Prompt Yönetimi"
>
> **Önemli:**
> - Phase 8 V1 status: 🟡 implementation complete + audit fix-now uygulandı + **manuel QA pending**
> - Phase 8 manuel QA henüz koşturulmadı; sürpriz bug çıkarsa Phase 9 implementation bekleyebilir
> - Bu doküman **brainstorm taslağı**; K1-K6 kararları kullanıcı onayı bekliyor
> - Önerilen varsayımlar açıkça **"Önerilen varsayım"** etiketiyle işaretli

---

## 1. Problem Statement

### 1.1 Kullanıcı problemi

Phase 8 sonrası kullanıcı elinde:
- Mockup pack (max 10 görsel: 1 cover + 9 sub-slot)
- `MockupJob` terminal state (`COMPLETED` veya `PARTIAL_COMPLETE`)
- Bulk ZIP download imkânı
- Cover swap + per-render retry/swap aksiyonları

**Eksik adım:** Bu pack'i Etsy'ye listing draft olarak göndermek. Şu anda S8 "Listing'e gönder →" CTA disabled (Phase 8'de placeholder, Phase 9'da activate edilecek). Kullanıcı manuel olarak Etsy'ye yüklemek zorunda — friction yüksek, akış kırık.

### 1.2 Phase 9 amacı

**"Mockup pack → Etsy listing draft" köprüsünü kurmak.**

V1 hedef:
- Kullanıcı S8'deki CTA ile tek tıkla listing draft oluşturur
- Asset'ler (cover + 9 sub-slot) listing'e otomatik bağlanır (cover invariant + image order korunur)
- AI ile metadata (title, description, 13 tags) üretilir (manuel düzenleme + onay disipline)
- Pricing + materials + production partner manuel girilir
- Readiness checklist görünür (V1 soft warn — submit blocked DEĞİL)
- Kullanıcı tek tıkla Etsy'ye **draft olarak** gönderir
- Etsy'de **active publish YOK** (CLAUDE.md disipline: "direct active publish yapılmayacak; draft/human approval")

### 1.3 CLAUDE.md disipline tetkikleri

| Madde | Phase 9 etkisi |
|---|---|
| "Etsy'ye direct active publish yapılmayacak" | V1+'da hiçbir zaman active publish; sadece draft |
| "AI listing metni master promptlardan üretilecek" | V1'de hardcoded prompt, V2'de admin panel master prompt management |
| "Listing Readiness Checklist" | V1 soft warn (önerilen varsayım K3); V1.1 hard gate |
| "Store Profile / Brand Voice" | V1.1+'da entegrasyon (V1'de hardcoded prompt yeterli) |
| "Visibility Engine" | Listing draft state machine `ListingStatus` enum reuse |
| "Job engine" | Etsy submit BullMQ job (`ETSY_LISTING_SUBMIT`) — async + retry |
| "Audit log" | Listing submit + state transition audit (V1.1) |

---

## 2. Kullanıcı Akışı

### 2.1 Canonical akış (S8 → listing draft)

```
S8 (Phase 8 Mockup Result)
  ├─ "★ Cover" + 9 sub-slot grid
  ├─ Bulk ZIP download (mevcut)
  └─ "Listing'e gönder →" CTA (V1'de disabled, Phase 9'da active)
       │
       │ click → POST /api/listings/draft { mockupJobId }
       ▼
Listing draft create (atomik tx, 202)
  ├─ Listing entity create (status DRAFT, mockupJobId, coverRenderId, imageOrderJson)
  ├─ AI meta generate (önerilen varsayım K2: handoff'ta DEĞİL, manuel button ile)
  └─ router.push(/listings/draft/[id])
       │
       ▼
/listings/draft/[id] (ana builder ekranı)
  ├─ Asset section (cover + ordered renders)
  ├─ Metadata section (title + description + 13 tags + category)
  │   └─ "AI ile üret" button → POST /generate-meta
  ├─ Pricing section (price + materials + production partner + digital/physical)
  ├─ Readiness checklist (V1 soft warn)
  └─ "Etsy'ye gönder" CTA
       │
       │ click → confirm modal → POST /api/listings/draft/[id]/submit
       ▼
Etsy submit (BullMQ ETSY_LISTING_SUBMIT job)
  ├─ Etsy Open API: createDraftListing + uploadListingImage (her packPosition için)
  ├─ Success: status DRAFT (Etsy'de draft) + etsyListingId saklanır
  └─ Failure: status FAILED + failedReason
       │
       ▼
/listings/[id] (post-submit detay)
  └─ Read-only listing detayı, "Etsy'de aç" link, status badge
```

### 2.2 Alternatif giriş

| Giriş | Tetikleyici | Önerilen varsayım |
|---|---|---|
| `/listings` index → "Yeni Listing" | Sidebar nav (mevcut `nav-config.ts:40` phase:9 disabled) | **Önerilen varsayım K4:** S8'den canonical, bu giriş existing draft listeleme + yeni create için (önce mockup pack seç) |
| `/listings/draft/[id]` direct URL | Mevcut draft devam | Standart deep link |

---

## 3. Phase 8 → Phase 9 Input Contract

Phase 8 closeout doc satır 256-264 verbatim contract:

| Phase 8 surface | Phase 9 kullanımı | Tip |
|---|---|---|
| `MockupJob` (`status COMPLETED|PARTIAL_COMPLETE`) | Listing draft asset kaynağı | Entity reuse |
| `coverRenderId` invariant | Listing primary thumbnail (Etsy listing image_order=1) | Field reuse |
| `MockupRender.packPosition` (0..9) | Etsy `image_order` map | Field reuse |
| `MockupRender.outputKey` (MinIO) | Etsy listing image upload kaynağı | Field reuse |
| `MockupRender.templateSnapshot.templateName` | Listing builder UI asset audit/info | Field reuse |
| `GET /api/mockup/jobs/[jobId]` (Task 17) | Mockup pack detayını listing draft create sırasında çek | Endpoint reuse |
| `GET /api/mockup/jobs/[jobId]/download` (Task 21) | Alternatif ZIP-first attachment workflow (V1.1) | Endpoint reuse |
| `EtsyConnection` (Phase 1+ schema) | Etsy OAuth token saklama | Entity reuse |
| `Store` (multi-store user model) | Listing'in hangi store'a ait olduğunu belirler | Entity reuse |

### Yeniden kullanılacak invariant'lar

- **Cover invariant:** `packPosition=0 ⇔ coverRenderId` — listing thumbnail otomatik resolve
- **Image ordering:** `packPosition ASC` — Etsy `image_order` map'i (cover 1, sonra 2..10)
- **Cross-user 404 disipline:** Phase 6/7/8 emsali (varlık sızıntısı yasak)
- **Status guard:** sadece terminal MockupJob (`COMPLETED|PARTIAL_COMPLETE`) listing draft'a dönüşebilir
- **Snapshot disipline:** Listing draft submit edilirken `imageOrderJson` snapshot dondurulur (Phase 8 binding seviyesinde, Phase 9 listing seviyesinde genişler)

---

## 4. Mevcut Schema Drift Analizi

### 4.1 Mevcut `Listing` modeli ([prisma/schema.prisma:654-679](../../prisma/schema.prisma))

```prisma
model Listing {
  id                String           @id @default(cuid())
  userId            String
  storeId           String?
  generatedDesignId String?          // Phase 5 dönemi tek-design bağlama (legacy)
  productTypeId     String?
  title             String?
  description       String?
  tags              String[]         @default([])
  category          String?
  priceCents        Int?
  materials         String[]         @default([])
  status            ListingStatus    @default(DRAFT)
  etsyDraftId       String?
  mockups           Mockup[]         // Phase 8 öncesi farklı Mockup model (legacy)
  // ... timestamps
}

enum ListingStatus {
  DRAFT | SCHEDULED | PUBLISHED | FAILED | REJECTED | NEEDS_REVIEW
}
```

### 4.2 Mevcut eski `Mockup` modeli (legacy, Phase 8 öncesi)

```prisma
model Mockup {
  id                String     @id @default(cuid())
  userId            String
  generatedDesignId String?
  assetId           String     // tek asset, basit bağlama
  templateKey       String?    // string-based template, Phase 8 schema YOK
  // ...
  listings Listing[]
}
```

### 4.3 Drift tespiti

**Eski schema vs Phase 8 schema uyumsuzluğu:**

| Eski Listing/Mockup | Phase 8 MockupJob/MockupRender |
|---|---|
| Tek `generatedDesignId` | Pack of variants (`SelectionSet → SelectionItem[]`) |
| Tek `assetId` mockup | 10 render (`MockupRender[]` packPosition'lı) |
| String `templateKey` | First-class `MockupTemplate` + `MockupTemplateBinding` entity |
| Cover kavramı yok | `coverRenderId` invariant |
| `image_order` yok | `packPosition` ASC ordering |

**Kullanım durumu (kod tarafı doğrulaması):**
- `src/features/listings/` → **YOK** (henüz feature klasörü yok)
- `src/app/api/listings/` → **YOK**
- Eski `Listing` / `Mockup` modellerine kod referansı bulunamadı (Prisma client `prisma.listing.*` veya `prisma.mockup.*` çağrısı yok)
- Sidebar nav: `/listings` route phase:9 disabled (`nav-config.ts:40`)

**Sonuç:** Eski `Listing` ve `Mockup` modelleri **şu an kullanılmıyor** (schema'da var, prod data muhtemelen boş). Phase 9 yeni listing'leri Phase 8 contract'ı üzerinden inşa edebilir.

### 4.4 Schema seçenekleri

**Seçenek 1 — `Listing` modelini additive extend** *(Önerilen varsayım K1)*

```prisma
model Listing {
  // ... mevcut alanlar (DOKUNULMAZ — Phase 5 legacy)
  
  // Phase 9 eklemeleri (additive, nullable):
  mockupJobId       String?
  mockupJob         MockupJob?       @relation(fields: [mockupJobId], references: [id], onDelete: SetNull)
  coverRenderId     String?          // Phase 8 cover invariant snapshot (submit anında dondur)
  imageOrderJson    Json?            // [{packPosition, renderId, outputKey}, ...] frozen at submit
  productionPartner String?
  productType       String?          // V1 sadece "canvas" (Phase 8 ile uyumlu)
  isDigital         Boolean          @default(false)
  publishedAt       DateTime?
  submittedAt       DateTime?
  etsyListingId     String?          // Etsy gerçek listing id (post-submit)
  failedReason      String?
  
  @@index([mockupJobId])
}

model MockupJob {
  // ... mevcut alanlar (DOKUNULMAZ — Phase 8 V1)
  
  listings Listing[]  // Phase 9 reverse relation (1 mockup pack → 1+ listing draft, V1'de 1:1)
}
```

**Avantajlar:**
- Migration küçük (additive, nullable)
- Phase 5 legacy listing'ler korunur
- `ListingStatus` enum reuse (DRAFT/SCHEDULED/PUBLISHED/FAILED/REJECTED/NEEDS_REVIEW zaten mevcut)
- Phase 8 `MockupJob` schema dokunulmaz (kontrat ihlali yok)

**Dezavantajlar:**
- Nullable spagettisi (eski `generatedDesignId` + yeni `mockupJobId` aynı tabloda)
- V2 cleanup gerekecek (legacy alanlar)

**Seçenek 2 — Yeni `ListingDraft` entity, eski `Listing` arşiv**

- Phase 8/9 native model (tüm alanlar non-null)
- Eski `Listing` legacy arşiv (read-only, V2'de drop)
- Avantaj: Net schema, baggage yok
- Dezavantaj: Paralel iki entity, UI zorluğu (`/listings` index hangisini gösterir?)

> **🟡 Karar gerekli (K1):** Önerilen varsayım = **Seçenek 1**. Sebep: Phase 5 legacy zaten kullanılmıyor (kod tarafı doğrulandı); migration kolay; `ListingStatus` enum reuse hediye. Kullanıcı onayı sonrası kesinleşir.

### 4.5 Eski `Mockup` modeli kararı

> **🟡 Karar gerekli (K6):** Önerilen varsayım = **V1'de dokunma, deprecation note ekle, V2 cleanup**. Sebep: Phase 5 legacy artifact; Phase 9 yeni listing'ler `MockupJob`'a bağlanacak; eski `Mockup` model V2 schema audit'inde temizlenir.

---

## 5. Route / Screen Topolojisi

### 5.1 Route ağacı (V1)

```
/listings                                     # Index
  └─ Active drafts grid + status filter

/selection/sets/[setId]/mockup/jobs/[jobId]   # Phase 8 S8 (mevcut)
  └─ "Listing'e gönder →" CTA aktif olur (Phase 8'de disabled, Phase 9 enable)

/listings/draft/[id]                          # Ana builder
  └─ Asset / Metadata / Pricing / Readiness / Submit

/listings/[id]                                # Post-submit detay (read-only)
```

> **🟡 Karar gerekli (K4):** Önerilen varsayım = S8 → handoff sonrası `router.push(/listings/draft/[id])`. Spec uyumlu (Phase 8 closeout doc satır 263 path önerisi: `/selection/sets/[setId]/listings/draft?jobId=[jobId]`). **Tercih edilen path: flat `/listings/draft/[id]`** (selection-altı path uzun ve listing'in selection'a sıkı bağımlılığını gerektirmez; mockupJobId field zaten ilişkiyi tutuyor). Karar onay bekliyor.

### 5.2 Ana builder ekran layout

```
┌─────────────────────────────────────────────────────────────┐
│ ← Selection / [Set] / Mockup / Listing Draft   [Status: DRAFT]│  ← üst bar
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─ Asset Section ─────┐  ┌─ Metadata Section ────────────┐ │
│ │ [★ Cover]           │  │ Title:                          │ │
│ │ [thumb 2]           │  │ ___________________________     │ │
│ │ [thumb 3]           │  │ (60-140 char önerilir)          │ │
│ │ [thumb 4]           │  │                                 │ │
│ │ [thumb 5]           │  │ Description:                    │ │
│ │ [+5 more]           │  │ ___________________________     │ │
│ │                     │  │ ___________________________     │ │
│ │ [⬇ Bulk ZIP]        │  │                                 │ │
│ │ [↩ Mockup'a dön]    │  │ Tags (max 13):                  │ │
│ └─────────────────────┘  │ [tag1] [tag2] [+] ...           │ │
│                          │                                 │ │
│                          │ Category: [dropdown]            │ │
│                          │                                 │ │
│                          │ [✨ AI ile üret]                │ │
│                          └─────────────────────────────────┘ │
│                                                             │
│ ┌─ Pricing + Readiness ──────────────────────────────────┐ │
│ │ Price: $___  Materials: [chip array]                    │ │
│ │ Production Partner: [dropdown]                          │ │
│ │ Digital / Physical: [toggle]                            │ │
│ │                                                         │ │
│ │ Readiness checklist (5 soft warn):                     │ │
│ │ ✓ Title set                                            │ │
│ │ ⚠ Description çok kısa (önerilen 140+)                 │ │
│ │ ✓ 13 tag tamam                                         │ │
│ │ ✓ Cover image set                                      │ │
│ │ ⚠ Price set değil                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [Save draft]                          [Etsy'ye gönder →]   │  ← sticky footer
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Auto-save davranışı

**Önerilen varsayım:** Phase 7 `ExportButton` polling emsali tersi: kullanıcı her edit'te debounced PATCH (300ms). V1'de `useMutation` + `react-hook-form` veya basit local state + debounce.

> **🟡 Karar gerekli (auxiliary):** Auto-save vs explicit "Save draft" button. Önerim: hibrit — auto-save (debounce 1sn) + footer "Save draft" feedback button (manuel kaydetme isteyene için). V1.1'e bırakılabilir; V1 explicit button yeterli.

---

## 6. Veri Modeli + API Yüzeyi

### 6.1 Schema migration (V1 — önerilen varsayım K1)

Yukarıda §4.4 Seçenek 1'deki `Listing` extend.

**Yeni JobType enum eklemesi:**
```prisma
enum JobType {
  // ... mevcut (FETCH_NEW_LISTINGS, MOCKUP_RENDER, vb.)
  ETSY_LISTING_SUBMIT
}
```

### 6.2 API endpoint'leri (V1)

| Endpoint | Method | Body | Response | Sorumluluk |
|---|---|---|---|---|
| `POST /api/listings/draft` | POST | `{ mockupJobId }` | `{ listingId }` 202 | Mockup pack → listing draft handoff (atomik tx) |
| `GET /api/listings/draft/[id]` | GET | — | `ListingDraftView` | Draft detay (status + meta + assets + readiness) |
| `PATCH /api/listings/draft/[id]` | PATCH | `Partial<ListingMeta>` | `{ id, updatedAt }` | Manuel edit (title, description, tags, price, vb.) |
| `POST /api/listings/draft/[id]/generate-meta` | POST | `{ tone? }` | `{ title, description, tags }` | AI meta üretimi (manuel tetiklemeli) |
| `POST /api/listings/draft/[id]/submit` | POST | — | `{ status, etsyListingId? }` 202 | BullMQ ETSY_LISTING_SUBMIT job dispatch |
| `GET /api/listings` | GET | query: `?status=...` | `{ listings: ListingView[] }` | User listing'leri index |

**Auth:** `requireUser` + cross-user 404 (Phase 6/7/8 emsali).

**Validation:** Zod schemas (Phase 8 emsali).

**Error mapping:** `withErrorHandling` HOF + AppError extend pattern (Phase 8 Task 16-22 emsali).

### 6.3 ListingDraftView shape (önerilen)

```ts
type ListingDraftView = {
  id: string;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "FAILED" | "REJECTED" | "NEEDS_REVIEW";
  
  // Phase 8 source
  mockupJobId: string;
  coverRenderId: string;
  imageOrder: Array<{
    packPosition: number;
    renderId: string;
    outputKey: string;
    templateName: string;
    isCover: boolean;
  }>;
  
  // Metadata (kullanıcı edit eder)
  title: string | null;
  description: string | null;
  tags: string[];        // max 13
  category: string | null;
  
  // Pricing
  priceCents: number | null;
  materials: string[];
  productionPartner: string | null;
  isDigital: boolean;
  
  // Submit state
  submittedAt: string | null;
  publishedAt: string | null;
  etsyListingId: string | null;
  failedReason: string | null;
  
  // Computed (server-side)
  readiness: ReadinessCheck[];
  
  createdAt: string;
  updatedAt: string;
};

type ReadinessCheck = {
  field: "title" | "description" | "tags" | "price" | "cover" | "category";
  pass: boolean;
  severity: "warn" | "error";  // V1 hep "warn" (soft), V1.1 hard gate'te "error" eklenir
  message: string;
};
```

### 6.4 BullMQ job tipleri

`ETSY_LISTING_SUBMIT` worker:
- Input: `{ listingId }`
- Lifecycle:
  1. Listing fetch + status guard (sadece DRAFT)
  2. Etsy OAuth token refresh check (`EtsyConnection` üzerinden)
  3. Etsy Open API: `createDraftListing` → `etsyListingId` al
  4. Per-render: `uploadListingImage` (packPosition=image_order)
  5. Success: status `DRAFT` (Etsy'de draft, henüz active değil), `etsyListingId` save
  6. Failure: status `FAILED` + `failedReason`
- Retry: BullMQ default 3 attempt + exponential backoff (transient Etsy 5xx için)
- AbortSignal: yok V1 (Etsy submit kısa süreli)

### 6.5 Provider abstraction (Phase 8 emsali)

Phase 8'de `mockup` provider abstraction (local-sharp + dynamic-mockups stub) emsali.

Phase 9'da:
- `src/providers/etsy/` — Etsy Open API client
- `src/providers/listing-meta-ai/` — AI metadata provider (V1 hardcoded prompt + tek provider, V2 admin master prompt management)

> **🟡 Karar gerekli (T2):** AI provider seçimi. Seçenekler:
> - **OpenAI gpt-4** (kullanıma hazır, cost var)
> - **KIE provider** (Phase 6 carry-forward, flaky note hâlâ açık)
> - **Local model** (deneysel, V1'de risk)
>
> **Önerim:** OpenAI gpt-4 (V1 minimum), provider abstraction sayesinde V2'de switch kolay.

---

## 7. Readiness Checklist Yaklaşımı

### 7.1 V1 kontrol listesi (önerilen varsayım K3 = soft warn)

| Field | Kontrol | Severity (V1) |
|---|---|---|
| `title` | Min 5 char, max 140 char | warn |
| `description` | Min 140 char | warn |
| `tags` | Tam 13 olmalı, her biri min 1 char | warn |
| `category` | Set edilmiş olmalı | warn |
| `priceCents` | > 0 olmalı | warn |
| `coverRenderId` | Set edilmiş olmalı (Phase 8 invariant'tan otomatik) | error (her zaman pass — invariant garanti) |

### 7.2 V1 davranışı

- **Soft warn:** Submit button **enabled** kalır, kullanıcı yine de gönderebilir; checklist UI'da uyarı gösterir
- Submit handler içinde explicit guard YOK
- V1.1 hard gate ile değiştirilebilir

### 7.3 V1.1 davranışı (V1.1 nice-to-have)

- Hard gate: Submit button disabled until tüm `severity:error` checks pass
- Daha sıkı kontroller (trademark scan, gibberish detect, vb.)

> **🟡 Karar gerekli (K3):** Önerilen varsayım = **soft warn**. Sebep: V1 onboarding sürtünmesi düşük; kullanıcı hızlıca submit deneyebilir. V1.1'de hard gate'e geçiş kolay (UI flag).

---

## 8. Etsy Draft Submit Yaklaşımı

### 8.1 V1 davranış (önerilen varsayım K5 = gerçek + feature flag)

**Etsy Open API entegrasyonu:**
- `createDraftListing` endpoint (Etsy v3 API)
- `uploadListingImage` endpoint (her packPosition için, image_order=packPosition+1)
- OAuth 2.0 token (mevcut `EtsyConnection` schema)

**Feature flag:**
```env
ETSY_API_ENABLED=true   # production: gerçek Etsy submit
ETSY_API_ENABLED=false  # dev/test: simulate (mock response)
```

**Active publish DİSİPLİNE:**
- Etsy draft endpoint kullanılır → listing Etsy panelinde DRAFT olarak görünür
- Kullanıcı Etsy panelinden manuel olarak "Publish" yapar
- **EtsyHub V1 hiçbir zaman active publish yapmaz** (CLAUDE.md disipline mutlak)

### 8.2 OAuth flow durumu

**External dependency (kritik):**
- `EtsyConnection` schema mevcut ([prisma/schema.prisma](../../prisma/schema.prisma)) — token saklama hazır
- **Etsy OAuth flow implementation YOK** (`src/app/api/etsy/` klasörü yok)
- `/settings/etsy-connection` veya benzeri OAuth UI YOK

**Phase 9 V1 task'ları:**
1. Etsy Open API key + secret (kullanıcı Etsy developer portal'dan alır — **human dependency**)
2. OAuth callback endpoint (`POST /api/etsy/callback`)
3. OAuth init UI (`/settings/store-connections` veya `/settings/etsy`)
4. Token refresh handler

> **🔴 External dependency:** Etsy Open API key + secret kullanıcıya bağımlı. Test/sandbox için yeterli, production için gerçek shop bağlantısı gerekli.

### 8.3 Hata sözlüğü (Etsy submit)

V1 minimal:

| Error class | Tetikleyici | Eylem |
|---|---|---|
| `ETSY_AUTH_EXPIRED` | Token refresh fail | Re-OAuth UI'a yönlendir |
| `ETSY_RATE_LIMITED` | 429 response | Backoff + retry (BullMQ default) |
| `ETSY_VALIDATION_FAILED` | 4xx Etsy reddi | Kullanıcıya Etsy'nin verdiği message göster |
| `ETSY_PROVIDER_DOWN` | 5xx Etsy down | Auto-retry (BullMQ); Manual retry CTA |
| `LISTING_NOT_READY` | V1.1 hard gate'te checklist fail (V1'de yok) | UI inline alert |

---

## 9. AI Metadata Üretimi Yaklaşımı

### 9.1 V1 davranış (önerilen varsayım K2 = manuel tetiklemeli)

**UI:** Metadata section'da "✨ AI ile üret" button. Click → `POST /api/listings/draft/[id]/generate-meta` → response { title, description, tags } → form fields'ı doldur (kullanıcı yine düzenleyebilir).

**Sebep (önerilen varsayım):**
- Otomatik handoff'ta üretmek = kullanıcı "ben yazmak istiyordum" frustration'ı
- Manuel button = kullanıcı kontrol kuruyor; cost da düşük (sadece istenince çalışır)
- V1.1'de "auto on create" toggle eklenebilir

> **🟡 Karar gerekli (K2):** Önerilen varsayım = **manuel button**. Alternatif: handoff sırasında otomatik üretim. Karar onay bekliyor.

### 9.2 Master prompt yapısı (V1)

V1'de **hardcoded system prompt + user prompt template** (CLAUDE.md "Master Prompt Yönetimi" admin panel V2'ye bırakıldı):

```
System prompt:
"Sen Etsy listing metadata uzmanısın. Mockup pack'inden Etsy listing
title (max 140 char), description (min 140 char, SEO-friendly),
ve tam 13 tag üret. Türkçe ya da İngilizce kullanıcının seçimine göre.
Tags lowercase, hyphenated."

User prompt:
"Mockup pack info:
- Template names: {templateNames}
- Variants: {variantSlugs}
- Cover template: {coverTemplateName}
- (Opsiyonel) Tone: {tone}
- (Opsiyonel) Target audience: {audience}

Bu pack için Etsy listing metadata üret."
```

V2'de admin panel "Master Prompt Editor" ile customize edilir (CLAUDE.md "Master Prompt Yönetimi"). V1'de hardcoded.

### 9.3 Negative library entegrasyonu (V1.1+)

CLAUDE.md "Negative Library" — yasak kelime/marka listesi. AI çıktısı listing'e set edilmeden önce kontrol edilir (Disney, Marvel, vb. trademark riskleri).

V1: hardcoded basic blocklist (5-10 madde). V2: admin panel managed list.

### 9.4 Provider seçimi

> **🟡 Karar gerekli (T2):** AI provider seçimi (yukarıda §6.5).

---

## 10. Riskler / Açık Kararlar

### 10.1 Ürün/Mimari kararlar (kullanıcı onayı gerekli)

| # | Karar | Önerilen varsayım | Aciliyet |
|---|---|---|---|
| **K1** | Schema seçeneği: `Listing` extend (S1) vs yeni `ListingDraft` (S2) | **S1 extend** (legacy doğrulandı, kullanılmıyor) | Brainstorm onay |
| **K2** | AI meta V1: otomatik (handoff) vs manuel (button) | **Manuel button** | Brainstorm onay |
| **K3** | Readiness V1: soft warn vs hard gate | **Soft warn** | Brainstorm onay |
| **K4** | S8 → Phase 9 path: selection-altı vs flat `/listings/draft` | **Flat `/listings/draft/[id]`** | Brainstorm onay |
| **K5** | Etsy submit V1: gerçek API + feature flag vs simulate | **Gerçek + `ETSY_API_ENABLED` flag** | Brainstorm onay |
| **K6** | Eski `Listing`/`Mockup` modelleri ne olacak | **Dokunma, V2 cleanup** | Brainstorm onay |

### 10.2 Teknik riskler

| # | Risk | Etki | V1 mitigation |
|---|---|---|---|
| **T1** | Etsy Open API rate limit + OAuth token refresh + sandbox vs prod | High | BullMQ retry, EtsyConnection token expiry tracking, dev `ETSY_API_ENABLED=false` |
| **T2** | AI provider seçimi (OpenAI/KIE/local) + cost | Medium | OpenAI gpt-4 V1, provider abstraction V2 swap kolay |
| **T3** | Image upload Etsy'ye: 10 görsel × per-image API call rate limit | Medium | Sequential upload + transient retry; bulk ZIP upload Etsy API desteklerse V1.1 |
| **T4** | Listing draft auto-save concurrency (PATCH debounce) | Low | Phase 7 emsali debounce 300ms; V1 explicit "Save draft" button yeterli |
| **T5** | Master prompt management UI (CLAUDE.md gerek var ama yok) | Medium | V1 hardcoded prompt; V2 admin panel |
| **T6** | OAuth flow eksikliği (`src/app/api/etsy/` YOK) | High | Phase 9 V1 task: OAuth init + callback + UI |

### 10.3 Phase 8 dürüst sınırlamaların etkisi

| Phase 8 sınır | Phase 9 etkisi |
|---|---|
| Task 10 perspective BLOCKED | ZERO etki — listing builder mockup output'u tüketir, render mekanizması değil |
| Task 12 Dynamic Mockups KOŞULLU | ZERO etki — V1 local-sharp output yeterli |
| E2E submit/render scope dışı | Phase 9'da E2E benzer disipline (Etsy submit scope dışı, sadece UI smoke) |
| Toast S7 mount-bound | Phase 9 listing-submit toast aynı kısıtlama |
| Per-render download yok | Phase 9'da bulk ZIP'ten upload yapar; per-render gerek yok |
| **Manual QA pending** | **Sürpriz bug Phase 9 implementation'ı bloklayabilir** — kritik bağımlılık |

### 10.4 External dependency

| # | Dependency | Sahibi | V1 etkisi |
|---|---|---|---|
| **E1** | Etsy Open API key + secret | Kullanıcı (Etsy developer portal) | OAuth flow gerçek test için zorunlu |
| **E2** | Etsy shop (sandbox veya production) | Kullanıcı | Test fixture için sandbox shop yeterli |
| **E3** | OpenAI API key (T2 önerisi onaylanırsa) | Kullanıcı | AI meta V1 için zorunlu |
| **E4** | Phase 6 KIE provider (alternatif AI seçeneği T2'de) | Phase 6 carry-forward note (`d439cf7`) | Phase 9 V1'de OpenAI tercih edilirse etki yok |
| **E5** | Phase 8 Manual QA gerçek koşum | Kullanıcı | Phase 9 implementation öncesi tamamlanması ideal |

---

## 11. V1 Must-have / V1.1 / Out-of-scope / Blocked

### 11.1 V1 Must-have

1. **Schema migration** (`Listing` extend — Phase 8 köprü alanları + `ETSY_LISTING_SUBMIT` JobType)
2. **Handoff service** (`MockupJob → ListingDraft` atomik create, S8 CTA aktivasyonu)
3. **Etsy provider abstraction** (`src/providers/etsy/`) + OAuth init + callback + token refresh
4. **AI metadata provider** (`src/providers/listing-meta-ai/`) — OpenAI V1, hardcoded prompt
5. **Listing CRUD service** (handoff, get, patch, generate-meta, submit)
6. **6 API endpoint** (yukarıda §6.2)
7. **`/listings/draft/[id]` ana builder ekran** (Asset / Metadata / Pricing / Readiness / Submit)
8. **`/listings` index** (status filter)
9. **`/listings/[id]` post-submit detay**
10. **Readiness checklist UI** (V1 soft warn)
11. **S8 "Listing'e gönder" CTA aktivasyonu** (Phase 8 koduna minimal dokunuş; sadece disabled flag kaldırma + path bağlama)
12. **Etsy submit BullMQ worker** (`ETSY_LISTING_SUBMIT`)
13. **Etsy hata sözlüğü** (5-class V1 minimum)
14. **Quality gates** (TS strict + lint + token check + unit + integration + UI + E2E UI smoke)
15. **Phase 9 closeout doc + manual QA checklist** (Phase 8 emsali)

### 11.2 V1.1 / Nice-to-have

- Auto-save draft (debounced PATCH)
- Hard gate readiness (V1 soft warn → V1.1 hard gate flag)
- AI meta auto-on-create toggle (handoff sırasında otomatik üretim)
- Store Profile / Brand Voice entegrasyonu (CLAUDE.md "Store Profile") — AI prompt'a brand context geçer
- Negative library entegrasyonu (trademark scan)
- Listing template system (CLAUDE.md "Publish Template")
- Bulk listing draft create (multi-MockupJob → multi-listing)
- Auto-tag suggestion (Etsy tag taxonomy)

### 11.3 V1 Out-of-scope (carry-forward)

- **Etsy active publish** — CLAUDE.md disipline mutlak yasak
- **Listing schedule** (`SCHEDULED` status) — V2 (cron/queue gerekir)
- **Listing analytics** (CLAUDE.md §Analytics) — Phase 10+
- **Multi-platform publish** (Amazon, Etsy dışı) — V2+
- **Bulk publish queue** (CLAUDE.md "Publishing Queue") — V2
- **Listing CSV / JSON export** (CLAUDE.md "Export Center") — V2
- **Master prompt management UI** (CLAUDE.md "Master Prompt Yönetimi" admin panel) — Phase 10+
- **Eski `Listing` ve `Mockup` model temizliği** — V2 schema migration
- **Image cropping/aspect override** — V1'de Etsy raw image upload yeterli

### 11.4 Blocked / External dependency

- **Etsy Open API key** — kullanıcı (E1)
- **Etsy shop (sandbox/production)** — kullanıcı (E2)
- **OpenAI API key** — kullanıcı (E3)
- **OAuth implementation** — Phase 9 V1 içinde (mevcut değil; T6)
- **Phase 8 manual QA** — kullanıcı; ideal: Phase 9 implementation öncesi (E5)

---

## 12. Phase 9 → Phase 10+ Köprüsü

Phase 9 V1 sonrası açılabilecek phase'ler:

- **Phase 10 — Listing Analytics** (CLAUDE.md §Analytics): publish count, success rate, retry rate, template impact
- **Phase 11 — Publishing Queue** (CLAUDE.md §12): scheduled publish + cron + multi-listing batch
- **Phase 12 — Master Prompt Management** (CLAUDE.md "Master Prompt Yönetimi"): admin panel prompt editor + version history + A/B testing
- **Phase 13 — Multi-platform** (Amazon, Shopify): provider abstraction genişlemesi

Bu phase'ler Phase 9 V1 implementation tamamlandıktan sonra brainstorm/spec turlarıyla açılır.

---

## Status

🟡 **Brainstorm taslağı.** K1-K6 ürün/mimari kararları kullanıcı onayı bekliyor. Önerilen varsayımlar açıkça işaretlendi. Onay sonrası:

1. Bu doc finalize edilir (`Status: 🟢 approved` olarak güncellenir)
2. Plan doc finalize edilir
3. Phase 9 V1 implementation başlar (subagent-driven-development emsali)

**Önemli hatırlatma:** Phase 8 V1 manual QA pending (`phase8-manual-qa.md` koşum bekliyor). İdeal akış: manual QA → sürpriz bug yoksa Phase 8 V1 status `🟢 PASS` → Phase 9 implementation başlar. Manual QA bekleyemezsek Phase 9 implementation paralel yürür ama Phase 8 fix önceliği bloklayabilir.
