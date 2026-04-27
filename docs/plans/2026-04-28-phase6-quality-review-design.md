# Phase 6 — AI Quality Review Design

> **Tarih:** 2026-04-28
> **Status:** Brainstorming sonu, plan yazımına hazır
> **Önceki phase:** [Phase 5 closeout](../design/implementation-notes/phase5-variation-generation.md)

---

## 1. Genel Bakış

Phase 6 amacı: Üretilen veya local library'den gelen görselleri **otomatik kalite/risk sinyalleri** ile zenginleştirip kullanıcıya bir **review queue** üzerinden sunmak.

**Konumlandırma cümlesi (her şey buna bağlı):**

> **Phase 6 review pipeline'ı bir "hard reject motoru" DEĞİLDİR.** Otomatik sonuç en fazla `approved` veya `needs_review` durumu önerir; nihai karar her zaman kullanıcıdadır. Sistem sinyal üretici (review signal producer) görevini görür; karar verici kullanıcıdır.

Phase 5 sonunda `LocalLibraryAsset` ve `GeneratedDesign` tablolarında **iki sinyal** vardı:
1. **Quality score** (objektif: DPI + Resolution, Phase 5)
2. **Negative flag** (manuel: kullanıcı işaretler + reason, Phase 5)

Phase 6 bunlara **iki yeni sinyal** ekler:
3. **AI review score** (multimodal LLM, 0–100)
4. **AI risk flags** (`[{type, confidence, reason}]`, açıklamalı)

Ve bu dört sinyalin üstüne **tek karar göstergesi** koyar:
5. **`review_status`** (`pending | approved | needs_review | rejected`)

---

## 2. Requirements (R-numbered)

| ID | Madde | Kapsam |
|---|---|---|
| **R0** | Phase 6 hard reject motoru değildir; sistem sinyal üretir, kullanıcı karar verir; `Approve anyway` çizgisi her durumda korunur | bu tur |
| **R1** | Review job tetikleme **hibrit**: AI generated → otomatik enqueue (`GENERATE_VARIATIONS` SUCCESS sonrası); Local library → manuel batch (kullanıcı butonu) | bu tur (Karar 1-C) |
| **R2** | OCR + gibberish + watermark + logo + celebrity → **multimodal vision LLM tek atış**; provider abstraction `providers/review/` registry pattern; tek model lock yasak | bu tur (Karar 2-C) |
| **R3** | Review = signal producer; sonuç `risk_flags: [{type, confidence, reason}]` açıklamalı; binary değil | bu tur |
| **R4** | Background detection **hibrit**: alpha kanalı `sharp` ile deterministic; halo / edge artifact / cutout izi vision LLM ile | bu tur (Karar 3-C) |
| **R5** | Background kontrolü **ürün tipi gate'li**: yalnız `clipart` / `sticker` / `transparent_png` ürün tiplerinde aktif; wall art / canvas için kompozisyon yorumu Phase 7 Selection Studio | bu tur |
| **R6** | Risk kategorileri **dar kapsam**: watermark/signature, visible logo/wordmark, recognizable celebrity face; fan art / brand similarity / pose similarity carry-forward | bu tur (Karar 4-A) |
| **R7** | `review_status` enum: `pending | approved | needs_review | rejected`; tek karar göstergesi kart UI'ında; alt sinyaller (quality, AI score, risk flags) **detay panelinde AYRI** görünür | bu tur (Karar 5-C1) |
| **R8** | Karar kuralı (Phase 6'da **hardcoded**): `risk_flags.length > 0 → needs_review`; `quality_score < 60` veya `ai_review_score < 60 → needs_review`; `quality_score >= 90` ve `ai_review_score >= 90` ve `risk_flags == [] → approved`; aksi halde `needs_review` (güvenli varsayılan: belirsizlik review'a düşer) | bu tur |
| **R9** | Threshold settings UI'a taşıma carry-forward (`quality-review-thresholds`); Phase 6'da hardcoded başlar — Phase 5 quality threshold paterninin (Task 15 paterni) tekrarı | bu tur (carry-forward) |
| **R10** | Review queue **sekmeli ikili**: `AI Tasarımlar` (default landing) + `Yerel Görseller`; aksiyon setleri kaynağa göre farklı; `Fix with AI` Phase 7'ye | bu tur (Karar 6-B) |
| **R11** | Bulk işlemler: Bulk Approve (risk_flag taşıyanlar **otomatik skip**, kullanıcıya rapor) + Bulk Reject + Bulk Delete (yalnız Local tab, **typing confirmation** ile — `destructive-typing-confirmation` Phase 5 carry-forward'u burada hayata geçer); Bulk Regenerate / Mark Risky / Fix-with-AI YOK | bu tur |
| **R12** | **Manuel override sticky kuralı:** `review_status_source = USER` olduktan sonra sonraki otomatik review rerun'ları status'ü **sessizce geri almaz**. Sistem yeni `review_score` ve `review_risk_flags` yazabilir; ama status ancak **explicit "reset to system"** aksiyonu ile `SYSTEM`'e döner. Aksi halde `Approve anyway` anlamını kaybeder | bu tur |
| **R13** | **Review rerun semantiği:** Bir tasarım tekrar review edilirse → yeni `review_score`, yeni `review_risk_flags`, yeni `review_provider_snapshot`, yeni `review_prompt_snapshot` yazılır. `review_status_source = USER` ise status korunur (R12); `SYSTEM` ise yeni karar kuralı sonucu yazılır. `reviewed_at` her rerun'da güncellenir | bu tur |
| **R14** | Review prompt Phase 6'da **hardcoded** (Phase 5 NEGATIVE_LIBRARY paterni); `review_prompt_snapshot` her job'da yazılır (snapshot lock); admin master prompt UI carry-forward (`review-prompt-admin-screen`) | bu tur (carry-forward) |
| **R15** | Snapshot lock kuralı korunur (CLAUDE.md): job tamamlandıktan sonra prompt veya provider değişse bile review **retroaktif yeniden değerlendirilmez** — tabii ki kullanıcı manuel rerun tetikleyebilir | bu tur |
| **R16** | `review_risk_flags.type` başlangıç sözlüğü **sabit liste** (drift'i önlemek için): `watermark_detected`, `signature_detected`, `visible_logo_detected`, `celebrity_face_detected`, `no_alpha_channel`, `transparent_edge_artifact`, `text_detected`, `gibberish_text_detected`. Yeni tip eklemek migration + doc update gerektirir | bu tur |
| **R17** | Cost guardrails: Phase 5 carry-forward `cost-guardrails-daily-limit` Phase 6 review job'larını da kapsamalı; günlük review çağrısı sayısı kullanıcı bazında izlenir; limit aşımında otomatik enqueue durur, manuel batch ekranda uyarı gösterir | bu tur (kısmi — limit altyapısı carry-forward devamı) |

---

## 3. Mimari

### 3.1 Provider abstraction

Phase 5 paterninin tekrarı: `src/providers/review/` (veya `src/providers/vision/` — implementasyon planında final isim seçilir):

```
src/providers/review/
├── types.ts          # ReviewProvider interface, ReviewInput, ReviewOutput, ReviewRiskFlag
├── registry.ts       # private byId Map + getReviewProvider helper (R17.3 paterni)
└── gemini-2.5-flash.ts  # ilk provider — multimodal vision review
```

**Interface taslağı:**

```typescript
export type ReviewRiskFlagType =
  | "watermark_detected"
  | "signature_detected"
  | "visible_logo_detected"
  | "celebrity_face_detected"
  | "no_alpha_channel"
  | "transparent_edge_artifact"
  | "text_detected"
  | "gibberish_text_detected";

export type ReviewRiskFlag = {
  type: ReviewRiskFlagType;
  confidence: number; // 0-1
  reason: string;     // human-readable, LLM'in açıklaması
};

export type ReviewInput = {
  imageUrl: string;            // public HTTPS URL veya local file:// path (provider-specific)
  productType: ProductType;    // ürün tipi gate'i için (R5)
  metadata?: { hasAlpha?: boolean }; // sharp deterministic ön-bilgisi (R4)
};

export type ReviewOutput = {
  score: number;               // 0-100, AI'nin genel kalite yorumu
  riskFlags: ReviewRiskFlag[]; // boş array = risk yok
  providerSnapshot: string;    // örn. "gemini-2.5-flash@2026-04-28"
  promptSnapshot: string;      // R14: hardcoded prompt versiyon hash'i
};

export interface ReviewProvider {
  readonly id: string;
  review(input: ReviewInput): Promise<ReviewOutput>;
}
```

**R2 + R17.3 sözleşmesi:** Hardcoded model lookup yasak; tüm dispatch registry üzerinden.

### 3.2 Review job pipeline

İki ayrı tetikleme yolu (R1):

**(a) AI generated — otomatik:**

```
GENERATE_VARIATIONS worker → SUCCESS state →
  enqueueReviewDesign(designId)
  ↓
REVIEW_DESIGN worker (yeni job tipi):
  1. design'ı yükle (image URL + productType)
  2. (R4) productType clipart/sticker/transparent_png ise sharp deterministic checks → no_alpha_channel flag (varsa)
  3. ReviewProvider.review(input) → score + riskFlags
  4. (R8) karar kuralı uygula → review_status
  5. design'ı update (review_status, review_score, review_risk_flags, snapshot'lar)
  6. (R12) eğer review_status_source === USER → status korunur, score/flags güncellenir
```

**(b) Local library — manuel batch:**

```
Kullanıcı /review sayfası → "Yerel Görseller" sekmesi → asset'leri seç → "Kalite kontrolünü çalıştır"
  ↓
N adet REVIEW_LOCAL_ASSET job enqueue (BullMQ; R17.4 paterni — paralel sınır 3, max 6)
  ↓
Her job:
  1. (R4) sharp deterministic checks
  2. (R5) ürün tipi gate kontrolü
  3. ReviewProvider.review
  4. asset'i update (R12 sticky kuralı korunarak)
```

**Job kuyruğu:** Yeni iki job tipi `REVIEW_DESIGN` ve `REVIEW_LOCAL_ASSET` (Phase 5 BullMQ altyapısı kullanılır). State machine: `QUEUED → RUNNING → SUCCESS|FAIL`. R15: manuel retry, otomatik retry yok.

### 3.3 Deterministic vs LLM ayrımı

| Kontrol | Deterministic | LLM |
|---|---|---|
| `hasAlpha` (alpha kanalı varlığı) | ✅ sharp | — |
| Transparent pixel oranı | ✅ sharp raw buffer | — |
| Edge artifact / halo / feathering | — | ✅ vision LLM |
| Watermark / signature | — | ✅ vision LLM |
| Visible logo / wordmark | — | ✅ vision LLM |
| Recognizable celebrity face | — | ✅ vision LLM |
| Text on image (OCR) | — | ✅ vision LLM |
| Gibberish text | — | ✅ vision LLM |

**Ürün tipi gate (R5):** Background kontrolleri yalnız `clipart` / `sticker` / `transparent_png` ürün tiplerinde çalışır. Diğer tipler için `no_alpha_channel` ve `transparent_edge_artifact` flag'leri **hiç üretilmez**.

---

## 4. Veri Modeli

### 4.1 Yeni enum'lar

```sql
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'needs_review', 'rejected');
CREATE TYPE "ReviewStatusSource" AS ENUM ('SYSTEM', 'USER');
```

### 4.2 `GeneratedDesign` additive migration

```sql
ALTER TABLE "GeneratedDesign"
  ADD COLUMN "review_status" "ReviewStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN "review_status_source" "ReviewStatusSource" NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "review_score" INTEGER,
  ADD COLUMN "review_risk_flags" JSONB,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "review_provider_snapshot" TEXT,
  ADD COLUMN "review_prompt_snapshot" TEXT;

CREATE INDEX "GeneratedDesign_review_status_idx" ON "GeneratedDesign"("review_status");
```

### 4.3 `LocalLibraryAsset` additive migration

```sql
ALTER TABLE "LocalLibraryAsset"
  ADD COLUMN "review_status" "ReviewStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN "review_status_source" "ReviewStatusSource" NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "review_score" INTEGER,
  ADD COLUMN "review_risk_flags" JSONB,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "review_provider_snapshot" TEXT,
  ADD COLUMN "review_prompt_snapshot" TEXT;

CREATE INDEX "LocalLibraryAsset_review_status_idx" ON "LocalLibraryAsset"("review_status");
```

### 4.4 `review_risk_flags` JSONB şeması

```typescript
// Tip sözlüğü R16 ile sabit:
type ReviewRiskFlagType =
  | "watermark_detected"
  | "signature_detected"
  | "visible_logo_detected"
  | "celebrity_face_detected"
  | "no_alpha_channel"
  | "transparent_edge_artifact"
  | "text_detected"
  | "gibberish_text_detected";

type ReviewRiskFlag = {
  type: ReviewRiskFlagType;
  confidence: number; // 0..1
  reason: string;     // örn. "Sağ alt köşede 'shutterstock' watermark izi"
};

// JSONB: ReviewRiskFlag[]
// Boş array [] = risk yok, NULL = henüz review edilmedi (status === 'pending')
```

**Validation (Zod):**

```typescript
export const ReviewRiskFlagSchema = z.object({
  type: z.enum([...]),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(500),
});
export const ReviewRiskFlagsSchema = z.array(ReviewRiskFlagSchema);
```

---

## 5. State Machine — `review_status` Transitions

```
                    [yeni asset/design]
                           ↓
                       pending
                           ↓
              REVIEW_DESIGN/REVIEW_LOCAL_ASSET worker tamamlanır
                           ↓
              R8 karar kuralı uygulanır (SYSTEM):
                  ├── approved (90/90/no-flags)
                  ├── needs_review (60/60/any-flag/aksi)
                  └── (rejected SYSTEM tarafından atanmaz; R0)
                           ↓
                  Kullanıcı override (USER):
                  ├── Approve anyway → approved
                  ├── Reject → rejected
                  ├── Mark Risky → needs_review (zaten orada da olabilir; user_source kilitler)
                  └── Reset to System → status_source = SYSTEM, R8 yeniden uygulanır

  R12: review_status_source === USER ise rerun status'ü değiştirmez,
       sadece score + risk_flags + snapshot güncellenir.
```

**Önemli notlar:**
- `rejected` durumu **yalnızca USER** tarafından atanır (R0 — sistem hard reject vermez)
- `Reset to System` aksiyonu var: kullanıcı override'ı geri alıp R8 kararına dönebilir
- `pending → approved` veya `pending → needs_review` ilk job sonucu (SYSTEM)
- Manuel override (`USER`) → sticky (R12)

---

## 6. Review Prompt (Hardcoded — R14)

### 6.1 Konum

```
src/features/quality-review/
├── review-prompt.ts   # hardcoded sürüm + hash export
```

### 6.2 İçerik taslağı (Türkçe yorumlu, prompt İngilizce)

```typescript
export const REVIEW_PROMPT_VERSION = "v1.0.0-2026-04-28";

export const REVIEW_PROMPT = `
You are an Etsy listing quality reviewer. Analyze the image and return a JSON
object with two top-level keys: "score" (integer 0-100) and "risk_flags" (array).

For each detected issue, append a risk_flag with:
- type: one of [watermark_detected, signature_detected, visible_logo_detected,
        celebrity_face_detected, transparent_edge_artifact, text_detected,
        gibberish_text_detected]
- confidence: 0.0-1.0
- reason: short human-readable explanation in Turkish

Detection scope (do NOT extend):
- Watermarks/signatures: stock photo marks, AI artifact signatures, prior artist marks
- Visible logos/wordmarks: brand marks like Coca-Cola, Nike swoosh, Disney logo
- Recognizable celebrities: well-known public figures whose face is identifiable
- Text on image: any readable text (OCR detection)
- Gibberish text: nonsensical letter sequences (AI artifact)
- Transparent edge artifact: ONLY if product_type ∈ {clipart, sticker, transparent_png}
  and the image has alpha channel — check halo, feathering, cutout quality

Out of scope (DO NOT flag):
- Fan art / franchise vibe / pose similarity / "this could be Spider-Man"
- Composition quality / focal point / scene clutter

Score guidance:
- 90+: clean, no issues
- 60-89: usable but has some concerns
- <60: significant concerns

Be conservative. Prefer false negatives over false positives.
`;

export const REVIEW_PROMPT_HASH = sha256(REVIEW_PROMPT); // ya da düz versiyon string
```

### 6.3 Snapshot kuralı (R15)

Her review job tamamlandığında:
- `review_provider_snapshot = "gemini-2.5-flash@2026-04-28"` (provider id + tarih veya semver)
- `review_prompt_snapshot = REVIEW_PROMPT_VERSION` (örn. `"v1.0.0-2026-04-28"`)

Prompt sonradan değişse bile eski review'ler retroaktif yeniden değerlendirilmez. Manuel rerun mümkün (R13).

---

## 7. UI — Review Queue

### 7.1 Sayfa yapısı

```
/review (yeni route)
  ├── Sekme 1: AI Tasarımlar (default landing)
  └── Sekme 2: Yerel Görseller
```

Phase 5 Local/AI tab paterninin tekrarı (`variations-page.tsx`).

### 7.2 Kart anatomisi

```
┌─────────────────────────────────┐
│ [thumbnail]                     │
│                                 │
│ [review_status badge]           │  ← R7 tek karar göstergesi
│ ✓ Sistem  veya  👤 Sen          │  ← review_status_source mikro-ipucu
│                                 │
│ Q:75 · AI:60 · 2 risk           │  ← Q1 alt sinyaller mini satır
│                                 │
│ [Aksiyon butonları] (kaynağa göre R10)
└─────────────────────────────────┘
```

Karta tıklayınca → **detay paneli** açılır:
- Quality score detayı (DPI, Resolution)
- AI review score
- Risk flags listesi: her satırda `type` (Türkçe etiket), `confidence`, `reason`
- "Reset to System" butonu (varsa USER override)
- Provider + prompt snapshot küçük metin (debug/audit için görünür)

### 7.3 Aksiyon setleri

**AI Tasarımlar sekmesi (Karar 6-b):**
- `Approve` → status=approved, source=USER
- `Reject` → status=rejected, source=USER
- `Regenerate` → yeni `GENERATE_VARIATIONS` job (Phase 5 retry paterni)
- `Mark Risky` → status=needs_review, source=USER

**Yerel Görseller sekmesi:**
- `Approve` → status=approved, source=USER
- `Reject` → status=rejected, source=USER
- `Mark Negative` → Phase 5 mevcut menü (negative_reason + status=needs_review, source=USER)
- `Delete` → Phase 5 destructive ConfirmDialog (fs.unlink + DB)

**Yok (Phase 7'ye):** `Fix with AI` (text kaldır / typography düzelt / background temizle)

### 7.4 Bulk işlemler (R11)

| İşlem | AI tab | Local tab | Davranış |
|---|---|---|---|
| Bulk Approve | ✅ | ✅ | `risk_flags.length > 0` olanlar **otomatik skip**; sonuç raporu: "X tasarım approve edildi, Y tasarım risk nedeniyle atlandı (liste açılır)" |
| Bulk Reject | ✅ | ✅ | ConfirmDialog destructive (Phase 5 paterni) |
| Bulk Delete | ❌ | ✅ | **Typing confirmation** (`destructive-typing-confirmation` Phase 5 carry-forward'u burada kapatılır — kullanıcı `DELETE` yazar) |
| Bulk Regenerate | ❌ | ❌ | YOK (her regen = yeni AI maliyeti, manuel niyet gerekir) |
| Bulk Mark Risky | ❌ | ❌ | YOK (manuel niyet gerektirir) |
| Bulk Fix with AI | ❌ | ❌ | YOK (Phase 7) |

### 7.5 Filter / sort

- Default filter: `review_status === 'needs_review'` (queue'nun amacı bu)
- Filter chip'leri: `Pending` / `Needs Review` / `Approved` / `Rejected`
- Sort: `reviewed_at DESC` (en son review yapılan üstte)
- "Risk var" filter'ı: `review_risk_flags.length > 0`

### 7.6 Default landing tab

`AI Tasarımlar` (settings'e taşıma carry-forward `review-queue-default-tab-setting`).

### 7.7 References Page entegrasyonu

`/references/[id]/variations` sayfasında variation result grid'i (Phase 5) zaten var. Phase 6'da:
- Her result kartına `review_status` badge eklenir
- Karta tıklayınca `/review` sayfasına AI tab + design id filter ile yönlendirme (veya inline detay panel — implementasyon kararı plan'da)

---

## 8. Cost & Rate Limits (R17)

Phase 5 carry-forward `cost-guardrails-daily-limit` **Phase 6 review job'larını da kapsamalı**:

- **Per-user günlük limit:** Settings UI'da `dailyReviewCallLimit` (örn. default 200/gün)
- **Cost izleme:** her review job sonrası `cost_estimate` kayıt (Phase 5'in cost izleme altyapısına ek)
- **Limit aşımında:**
  - **Otomatik enqueue (AI generated):** durur, tasarım `review_status=pending` kalır, kullanıcıya banner "Günlük review limitiniz dolu — yarın otomatik review devam eder veya manuel tetikle"
  - **Manuel batch (Local):** ekranda uyarı, batch küçültülür ya da iptal edilir
- **Admin global override:** carry-forward (`admin-review-cost-override`)

**Phase 5 cost-guardrails-daily-limit altyapısı yoksa:** Phase 6 task listesinde önce cost altyapısını kurma adımı eklenir (plan içinde dependency).

---

## 9. Test Stratejisi

### 9.1 Unit

- `review-decision.ts` — R8 karar kuralı (8 senaryo: tüm threshold kombinasyonları)
- `review-rerun-sticky.ts` — R12 USER override sticky kuralı (rerun → status korunur, score güncellenir)
- `review-prompt-snapshot.ts` — R15 snapshot lock (prompt değişse bile eski snapshot korunur)
- `review-risk-flag-schema.ts` — R16 tip sözlüğü Zod validation
- `gemini-2.5-flash-provider.ts` — happy path + error path mock fetch
- `review-provider-registry.ts` — R17.3 hardcoded model lookup yasak

### 9.2 Integration

- `review-design-worker.test.ts` — `REVIEW_DESIGN` worker happy path + retry
- `review-local-asset-worker.test.ts` — `REVIEW_LOCAL_ASSET` worker + ürün tipi gate (R5)
- `review-api.test.ts` — `/api/review/queue` GET (filter/sort), `/api/review/[id]/approve|reject|reset` POST
- `review-queue-bulk.test.ts` — bulk approve skip-on-risk (R11)
- `review-rerun.test.ts` — R13 rerun semantiği (yeni snapshot, USER status korunur)

### 9.3 UI Smoke (manuel)

- AI tasarımı üret → otomatik review → `/review` AI tab'da görünür
- Local asset batch review → "Yerel Görseller" tab'da görünür
- Bulk approve → risk skip raporu
- Manuel override → rerun → status korunur, score güncellenir
- Reset to System → R8 yeniden uygulanır

---

## 10. Scope vs Carry-Forward

### 10.1 Bu Tur (Phase 6)

| ID | Madde |
|---|---|
| R0 | Hard reject yok cümlesi sözleşmesi |
| R1 | Hibrit tetikleme (AI auto + Local manuel) |
| R2 | `providers/review/` registry + Gemini 2.5 Flash entegre |
| R3 | `risk_flags` açıklamalı çıktı |
| R4 | Hibrit background detection (sharp + LLM) |
| R5 | Ürün tipi gate (clipart/sticker/transparent_png) |
| R6 | Dar kapsam risk kategorileri |
| R7 | `review_status` tek karar göstergesi + detay panelinde alt sinyaller |
| R8 | Karar kuralı hardcoded (60/90 + risk_flag.any) |
| R10 | Sekmeli ikili queue + kaynak-bilinçli aksiyonlar |
| R11 | Sınırlı bulk (Approve skip-on-risk + Reject + Delete typing-confirm) |
| R12 | USER override sticky kuralı |
| R13 | Rerun semantiği |
| R14 | Hardcoded prompt + snapshot |
| R15 | Snapshot lock kuralı |
| R16 | `review_risk_flags.type` sabit sözlük |
| R17 | Cost guardrail entegrasyonu (kısmi) |

### 10.2 Carry-Forward (named, unutulmayacak)

| ID | Carry-forward isim | Sebep |
|---|---|---|
| **R6-followup** | `brand-similarity-detection` | Fan art / franchise vibe / pose similarity — Phase 6'da gri alan, opt-in admin ayarı olarak gelir |
| **R9-followup** | `quality-review-thresholds` | Karar kuralı threshold'larını settings UI'a taşıma — Phase 5 quality threshold paterninin tekrarı |
| **R10-followup** | `review-queue-default-tab-setting` | Default landing tab kullanıcı ayarı |
| **R14-followup** | `review-prompt-admin-screen` | Admin master prompt UI (Phase 5'in `negative-library-admin-screen` ile simetrik) |
| **R6-followup** | `fix-with-ai-actions` | Text kaldır / typography düzelt / background temizle — Phase 7 Selection Studio |
| **R17-followup** | `admin-review-cost-override` | Admin global limit override + per-user override |
| **R2-followup** | `multi-provider-review` | Aynı görseli 2 model'de paralel review (consensus mantığı) |

### 10.3 Phase 5'ten devralınan ve Phase 6'da **kapanan**

| Phase 5 carry-forward | Phase 6'da nasıl kapandı |
|---|---|
| `auto-quality-detection-ocr-bg` | R2 + R4 ile tamamen kapanır (multimodal LLM tek atış + sharp deterministic alpha) |
| `destructive-typing-confirmation` | R11 Bulk Delete (Yerel Görseller) ile kapanır |

### 10.4 Bilinçli Olarak Phase 6 Dışında

- `Fix with AI` aksiyonları → Phase 7 Selection Studio
- Wall art / canvas kompozisyon yorumu → Phase 7
- Trademark/legal hukuki risk değerlendirmesi → ürün politikası, code dışı
- Multi-language gibberish detection → şu an İngilizce + Türkçe yeterli
- Custom user prompt'u (kullanıcı kendi review prompt'unu yazsın) → carry-forward `user-review-prompt-override`

---

## 11. Açık Riskler

1. **LLM determinism:** Aynı görsel için Gemini farklı çağrılarda %5–10 dalgalanabilir. R0 (hard reject yok) bunu kabul edilebilir kılar; ama bulk approve sırasında "kararsız" tasarımlar tutarsız davranabilir. Mitigation: `review_score` >= 90 sınırını yüksek tutmak (ufak dalgalanmalar `needs_review`'a düşürür, güvenli).

2. **Cost belirsizliği:** Gemini 2.5 Flash fiyatı ~$0.001/görsel, ama büyük batch'lerde (50+ asset) anlamlı maliyet çıkar. Phase 5 cost-guardrails altyapısı henüz tam değil → R17 risk taşır. Mitigation: Phase 6'nın ilk task'larından biri "cost tracking minimum altyapısı" olabilir.

3. **Ürün tipi gate'inin doğruluğu (R5):** `productType` `null` olabilir mi? Phase 5 `LocalLibraryAsset.productType` opsiyonel. Eğer null ise background kontrolü çalışmaz → eksik sinyal. Mitigation: null ise default `unknown` ile çalış, `no_alpha_channel` flag'i atlanır, kullanıcıya banner.

4. **Master prompt gelecekte değişirse retroaktif uygulama:** R15 retroaktif değil diyor. Ama kullanıcı eski review'leri "yenile" isteyebilir. Mitigation: `Manual rerun` butonu (R13) bunu çözer; her tasarımı tek tek veya batch ile yenileyebilir.

5. **Review queue'da "pending" tıkanması:** Eğer review job'ları sürekli FAIL alırsa queue tıkanabilir. R15: manuel retry. Mitigation: failed job'lar UI'da görünür, kullanıcı "Yeniden Dene" basar.

6. **`risk_flags` LLM hallucination:** LLM "watermark var" diyebilir ama gerçekte yok. R0 (hard reject yok) bunu kabul edilebilir kılar; kullanıcı `Approve anyway` ile geçer. Mitigation: `confidence` field düşük olanları kart UI'ında soluk göster.

---

## 12. Sonraki Adım — Implementation Plan

Bu design doc onaylandıktan sonra **superpowers:writing-plans** skill'i ile implementation plan'a geçilecek. Plan path: `docs/plans/2026-04-28-phase6-quality-review-plan.md`.

Plan task sayısı tahmini: **~12–15 task** (Phase 5 örneği 17 task'tı; Phase 6'nın UI tarafı daha küçük çünkü Phase 5'in tab paternlerini tekrarlıyor).

**Önemli plan kuralları (Phase 5'ten taşınan):**
- npm (pnpm değil)
- Single atomic commit per task
- TDD red→green ayrı commit ritmi (Phase 5'te tek commit'e indirildi; Phase 6'da yeniden değerlendirilebilir)
- Subagent-driven development (SDD) pattern devam
- Carry-forward registry doc kapanışında güncellenir

---

## 13. Self-Review

**Placeholder scan:** TBD/TODO yok ✅

**Internal consistency:**
- R7 + R8 + R12 birbirini destekliyor ✅
- R5 (ürün tipi gate) + R4 (background detection) + R16 (`no_alpha_channel` + `transparent_edge_artifact`) tutarlı ✅
- R14 (hardcoded prompt) + R15 (snapshot) + R13 (rerun semantiği) birbirini destekliyor ✅

**Scope check:** Phase 6 tek tutarlı subsystem (review pipeline + queue UI). Tek implementation plan'a sığar. ✅

**Ambiguity check:**
- R8 "aksi halde → needs_review" net ✅
- R12 "explicit reset to system" UI butonu (R7 detay paneli) ✅
- R11 "skip-on-risk" rapor formatı R10 alt başlıklarında detaylı ✅

**Düzeltilen iki bulgu:**
- R3 başta "boolean değil" derken örnek vermemişti — §4.4 JSONB schema ile somutlaştırıldı
- R17 cost altyapısı Phase 5'ten devralınma riskini §11.2 açık risk olarak işaretledim

---

**Status:** Design tamamlandı. Implementation plan için onay bekliyor.
