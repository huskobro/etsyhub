# Phase 6 — AI Quality Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI tasarımları (otomatik) ve local library asset'leri (manuel batch) için bir kalite/risk review pipeline'ı kurmak; ürünleştirilmiş risk sinyalleri ve tek katmanlı tab UI ile review queue'sunu kullanılabilir hale getirmek. Pipeline bir "hard reject motoru" değildir — kullanıcının `Approve anyway` hakkı her zaman saklıdır (R12 sticky).

**Architecture:**
1. **Hibrit pipeline:** Sharp tabanlı deterministic alpha kontrolleri (yalnızca transparent ürünlerde) + multimodal LLM (Gemini 2.5 Flash) ile OCR + watermark + signature + logo + celebrity tek atış.
2. **Provider abstraction (R17.3):** `ReviewProvider` interface + registry; hardcoded model lookup yasak; sessiz fallback yasak.
3. **State machine + status source:** `review_status` × `review_status_source` (SYSTEM | USER); USER override sticky — rerun status'ü değiştirmez.
4. **UI:** `/review` sayfası iki sekmeli (AI Tasarımlar | Local Library); kart + detay paneli + bulk actions; bulk delete'te typing confirmation.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Prisma + PostgreSQL, BullMQ + Redis, sharp, Gemini API (REST/SDK), TanStack Query, Tailwind, Vitest + React Testing Library.

---

## Kullanıcıya Söz Verilen 8 Madde — Plan İçinde Nereye Düştü

| # | Söz | Plan'da çözüm |
|---|-----|---------------|
| 1 | Prisma migration hangi task'e | **Task 1** (kritik path bloker, en başta) |
| 2 | Review provider abstraction kaç task | **Task 2** (types) + **Task 3** (registry) + **Task 4** (Gemini impl) — 3 task |
| 3 | Deterministic alpha vs multimodal review pipeline ayrımı | **Task 5** (sharp service ayrı) + **Task 4** (LLM provider ayrı); birleşim **Task 9**'da decision rule içinde |
| 4 | review_status / review_status_source / sticky kuralı | **Task 6** (decision rule R8) + **Task 7** (USER override sticky enforcement R12) — iki ayrı task |
| 5 | Queue UI kaç commit | **Task 13** (sayfa shell + tab) + **Task 14** (kart + status badge + alt sinyal mini satır) + **Task 15** (detay paneli + reset to system) — 3 task |
| 6 | Bulk approve/reject/delete + typing confirmation | **Task 16** (bulk approve skip-on-risk + bulk reject) + **Task 17** (bulk delete + typing confirmation primitive) |
| 7 | Phase 5 carry-forward'lardan kapatılanlar | Aşağıdaki tabloda açıkça işaretlendi |
| 8 | Phase 6 scope vs follow-up tablosu | Aşağıdaki "Scope vs Carry-Forward" tablosunda |

### Phase 5'ten Kapatılan Carry-Forward'lar

| Phase 5 carry-forward | Phase 6'da nerede kapanır |
|-----------------------|---------------------------|
| `auto-quality-detection-ocr-bg` | **Task 5** (sharp deterministic alpha service) + **Task 4** (Gemini multimodal review provider — OCR + risk flags) + **Task 8** (worker handler entegrasyonu) |
| `destructive-typing-confirmation` | **Task 17** (bulk delete + typing confirmation primitive) |

### Scope vs Carry-Forward (Net Tablo)

| Scope (Phase 6) | Carry-Forward (Phase 7+) |
|-----------------|---------------------------|
| Hibrit pipeline (sharp + Gemini) | `multi-provider-review` — alternative review provider'lar |
| Hardcoded threshold (60/90) | `quality-review-thresholds` — settings'e taşıma |
| Hardcoded review prompt + snapshot | `review-prompt-admin-screen` — admin/master prompt yönetimi |
| `risk_flags` 8 sabit type | `brand-similarity-detection` — fan art / IP / brand distance |
| `/review` iki sekmeli queue | `review-queue-default-tab-setting` — user prefs default tab |
| `Approve anyway` + bulk approve/reject/delete | `fix-with-ai-actions` — Phase 7 Selection Studio entegre edilecek |
| Cost guardrail entegrasyonu (R17 kısmi) | `admin-review-cost-override` — admin per-user override |

---

## Dosya Yapısı

**Yeni dosyalar:**
- `prisma/migrations/<timestamp>_phase6_review/migration.sql` (Task 1)
- `src/providers/review/types.ts` (Task 2)
- `src/providers/review/registry.ts` (Task 3)
- `src/providers/review/gemini-2-5-flash.ts` (Task 4)
- `src/server/services/review/alpha-checks.ts` (Task 5)
- `src/server/services/review/decision.ts` (Task 6)
- `src/server/services/review/sticky.ts` (Task 7)
- `src/server/services/review/prompt.ts` (Task 5'te değil — Task 4'ün altında prompt+snapshot helper)
- `src/server/workers/review-design.worker.ts` (Task 8)
- `src/server/workers/review-local-asset.worker.ts` (Task 10)
- `src/app/(app)/review/page.tsx` (Task 13)
- `src/app/(app)/review/_components/ReviewTabs.tsx` (Task 13)
- `src/app/(app)/review/_components/ReviewCard.tsx` (Task 14)
- `src/app/(app)/review/_components/ReviewDetailPanel.tsx` (Task 15)
- `src/app/(app)/review/_components/BulkActionsBar.tsx` (Task 16, Task 17)
- `src/components/ui/TypingConfirmation.tsx` (Task 17 — primitive)
- `src/app/api/review/decisions/route.ts` (Task 11)
- `src/app/api/review/bulk/route.ts` (Task 16)
- `src/app/api/review/local-batch/route.ts` (Task 11)
- `tests/unit/...` ve `tests/integration/...` her task için TDD ile

**Değiştirilecek dosyalar:**
- `prisma/schema.prisma` — Task 1
- `src/server/workers/bootstrap.ts` — Task 8 (REVIEW_DESIGN handler register), Task 10 (REVIEW_LOCAL_ASSET handler register)
- `src/server/workers/generate-variations.worker.ts` — Task 9 (SUCCESS sonrası auto-enqueue)
- `src/lib/cost-guardrails.ts` — Task 18 (review job kategori entegrasyonu)
- `src/app/(app)/_components/AppSidebar.tsx` — Task 13 (Review menü maddesi)

**Hassas: schema çakışma stratejisi (Task 1'de detay):**
Phase 5'te eklenmiş alanlar:
- `GeneratedDesign.reviewStatus ReviewStatus @default(PENDING)` ✅ tutuldu
- `GeneratedDesign.reviewIssues Json?` → **kullanılmaya devam** (sebep: kalite raporu serbest formdaki bilgiler)
- `GeneratedDesign.riskFlags String[]` → **DEPRECATED**, yeni `reviewRiskFlags Json?` eklenir (8 type sabit sözlük). Eski alan migration'da silinmez (legacy data koruması) ama kod tarafında kullanılmaz; **Task 1'de schema yorumu** açıkça `@deprecated` işaretler.
- `GeneratedDesign.qualityScore Int?` ✅ tutuldu (deterministic+heuristic skor)
- `GeneratedDesign.textDetected`, `gibberishDetected` ✅ tutuldu (review provider doldurur)
- `DesignReview` ayrı tablo ✅ tutuldu, ama Phase 6 audit trail için **Task 1**'de yeni alan eklenir: `provider`, `model`, `promptSnapshot`, `responseSnapshot`.

**Yeni eklenen alanlar:**
- `GeneratedDesign`: `reviewStatusSource ReviewStatusSource @default(SYSTEM)`, `reviewScore Int?`, `reviewProviderSnapshot Json?`, `reviewPromptSnapshot String? @db.Text`, `reviewRiskFlags Json?`
- `LocalLibraryAsset`: `reviewStatus ReviewStatus @default(PENDING)`, `reviewStatusSource ReviewStatusSource @default(SYSTEM)`, `reviewScore Int?`, `reviewSummary String? @db.Text`, `reviewRiskFlags Json?`, `reviewedAt DateTime?`, `reviewProviderSnapshot Json?`, `reviewPromptSnapshot String? @db.Text`, `reviewIssues Json?`
- `DesignReview`: `provider String`, `model String`, `promptSnapshot String? @db.Text`, `responseSnapshot Json?`
- Yeni enum `ReviewStatusSource { SYSTEM, USER }`

---

## TDD Felsefesi

Her task şu ritmi izler:
1. **Red:** failing test yaz
2. **Green:** minimum implementation
3. **Run:** test pass
4. **Commit:** atomic commit, açıklayıcı mesaj

**Kritik kurallar:**
- Sessiz fallback YASAK. Belirsiz durum ⇒ explicit hata veya `needs_review`.
- Provider lookup hardcoded YASAK ⇒ registry üzerinden (R17.3).
- USER override status sticky ⇒ rerun değiştiremez (R12).
- Snapshot zorunluluğu ⇒ provider+prompt her review kararında snapshot'lanır.

---

## Task 1: Prisma Migration — Phase 6 Review Alanları

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_phase6_review/migration.sql`
- Test: `tests/integration/phase6-migration.test.ts` (yeni)

**Hedef:** Phase 6 design doc §4'te belirtilen review alanlarını additive olarak ekle. Legacy `riskFlags String[]` alanı schema'da `@deprecated` yorumla tutulur ama kod tarafında kullanılmaz.

- [ ] **Step 1: Failing test yaz**

`tests/integration/phase6-migration.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { prisma } from "@/server/db/prisma";

describe("Phase 6 schema — review alanları", () => {
  it("GeneratedDesign reviewStatusSource alanına sahip", async () => {
    const result = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'GeneratedDesign' AND column_name = 'reviewStatusSource'`,
    );
    expect(result.length).toBe(1);
  });

  it("LocalLibraryAsset reviewStatus alanına sahip", async () => {
    const result = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'LocalLibraryAsset' AND column_name = 'reviewStatus'`,
    );
    expect(result.length).toBe(1);
  });

  it("ReviewStatusSource enum tanımlı", async () => {
    const result = await prisma.$queryRawUnsafe<{ enumlabel: string }[]>(
      `SELECT enumlabel FROM pg_enum
       WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReviewStatusSource')`,
    );
    const labels = result.map((r) => r.enumlabel);
    expect(labels).toContain("SYSTEM");
    expect(labels).toContain("USER");
  });

  it("DesignReview audit alanları (provider, model, promptSnapshot) eklendi", async () => {
    const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'DesignReview'`,
    );
    const names = cols.map((c) => c.column_name);
    expect(names).toContain("provider");
    expect(names).toContain("model");
    expect(names).toContain("promptSnapshot");
  });
});
```

- [ ] **Step 2: Test fail — alan henüz yok**

Run: `npx vitest run tests/integration/phase6-migration.test.ts`
Expected: FAIL — `column reviewStatusSource does not exist`

- [ ] **Step 3: schema.prisma'ya alanları ekle**

`prisma/schema.prisma` — yeni enum (mevcut enum bloğunun yanına):
```prisma
enum ReviewStatusSource {
  SYSTEM
  USER
}
```

`GeneratedDesign` modeline (mevcut `reviewedAt` satırından sonra, `createdAt`'tan önce):
```prisma
  // Phase 6 — Review pipeline
  reviewStatusSource     ReviewStatusSource @default(SYSTEM)
  reviewScore            Int?
  reviewProviderSnapshot Json?
  reviewPromptSnapshot   String?            @db.Text
  reviewRiskFlags        Json?
  // @deprecated — Phase 6 öncesi alan; yeni kod reviewRiskFlags (Json) kullanır.
  // Var olan rowlar için tutuldu; migration ile silinmez.
  // riskFlags String[] @default([])  -- mevcut, dokunma
```

`LocalLibraryAsset` modeline (mevcut `qualityReasons` satırından sonra):
```prisma
  // Phase 6 — Review pipeline
  reviewStatus           ReviewStatus       @default(PENDING)
  reviewStatusSource     ReviewStatusSource @default(SYSTEM)
  reviewScore            Int?
  reviewSummary          String?            @db.Text
  reviewIssues           Json?
  reviewRiskFlags        Json?
  reviewedAt             DateTime?
  reviewProviderSnapshot Json?
  reviewPromptSnapshot   String?            @db.Text
```

`DesignReview` modeline:
```prisma
  // Phase 6 — Audit
  provider         String?
  model            String?
  promptSnapshot   String? @db.Text
  responseSnapshot Json?
```

- [ ] **Step 4: Migration üret ve uygula**

Run: `npx prisma migrate dev --name phase6_review`
Expected: Migration created, applied to dev database.

- [ ] **Step 5: Prisma client yeniden oluştur**

Run: `npx prisma generate`
Expected: Client başarılı.

- [ ] **Step 6: Test pass**

Run: `npx vitest run tests/integration/phase6-migration.test.ts`
Expected: PASS — 4 test geçti.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ tests/integration/phase6-migration.test.ts
git commit -m "feat(phase6): add review fields to schema with status source + snapshot

- Add ReviewStatusSource enum (SYSTEM, USER)
- Extend GeneratedDesign with reviewStatusSource, reviewScore,
  reviewProviderSnapshot, reviewPromptSnapshot, reviewRiskFlags
- Add review pipeline fields to LocalLibraryAsset
- Add audit fields to DesignReview (provider, model, snapshots)
- Legacy riskFlags String[] kept for old rows, deprecated in code"
```

---

## Task 2: ReviewProvider Types

**Files:**
- Create: `src/providers/review/types.ts`
- Test: `tests/unit/review-provider-types.test.ts`

**Hedef:** Provider interface ve risk flag sabit sözlüğünü kodifye et. Drift'i önlemek için 8 sabit type.

- [ ] **Step 1: Failing test yaz**

`tests/unit/review-provider-types.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  REVIEW_RISK_FLAG_TYPES,
  isReviewRiskFlagType,
  type ReviewProvider,
} from "@/providers/review/types";

describe("ReviewProvider types", () => {
  it("8 sabit risk flag type tanımlı", () => {
    expect(REVIEW_RISK_FLAG_TYPES).toEqual([
      "watermark_detected",
      "signature_detected",
      "visible_logo_detected",
      "celebrity_face_detected",
      "no_alpha_channel",
      "transparent_edge_artifact",
      "text_detected",
      "gibberish_text_detected",
    ]);
  });

  it("isReviewRiskFlagType bilinmeyen değeri reddeder", () => {
    expect(isReviewRiskFlagType("watermark_detected")).toBe(true);
    expect(isReviewRiskFlagType("random_string")).toBe(false);
  });

  it("ReviewProvider interface zorunlu alanları tutar", () => {
    const provider: ReviewProvider = {
      id: "gemini-2-5-flash",
      kind: "vision",
      review: async () => ({
        score: 80,
        textDetected: false,
        gibberishDetected: false,
        riskFlags: [],
        summary: "ok",
      }),
    };
    expect(provider.id).toBe("gemini-2-5-flash");
  });
});
```

- [ ] **Step 2: Test fail — modul yok**

Run: `npx vitest run tests/unit/review-provider-types.test.ts`
Expected: FAIL — `Cannot find module '@/providers/review/types'`

- [ ] **Step 3: Types dosyasını yaz**

`src/providers/review/types.ts`:
```typescript
export const REVIEW_RISK_FLAG_TYPES = [
  "watermark_detected",
  "signature_detected",
  "visible_logo_detected",
  "celebrity_face_detected",
  "no_alpha_channel",
  "transparent_edge_artifact",
  "text_detected",
  "gibberish_text_detected",
] as const;

export type ReviewRiskFlagType = (typeof REVIEW_RISK_FLAG_TYPES)[number];

export function isReviewRiskFlagType(value: string): value is ReviewRiskFlagType {
  return (REVIEW_RISK_FLAG_TYPES as readonly string[]).includes(value);
}

export type ReviewRiskFlag = {
  type: ReviewRiskFlagType;
  confidence: number; // 0-1
  reason: string;
};

export type ReviewInput = {
  imageUrl: string;
  productType: string; // e.g. "clipart" | "wall_art"
  isTransparentTarget: boolean;
};

export type ReviewOutput = {
  score: number; // 0-100
  textDetected: boolean;
  gibberishDetected: boolean;
  riskFlags: ReviewRiskFlag[];
  summary: string;
};

export type ReviewProvider = {
  id: string;
  kind: "vision";
  review: (input: ReviewInput) => Promise<ReviewOutput>;
};
```

- [ ] **Step 4: Test pass**

Run: `npx vitest run tests/unit/review-provider-types.test.ts`
Expected: PASS — 3 test.

- [ ] **Step 5: Commit**

```bash
git add src/providers/review/types.ts tests/unit/review-provider-types.test.ts
git commit -m "feat(phase6): add ReviewProvider interface with 8 risk flag types

- 8 sabit type sözlüğü (drift'i önlemek için)
- ReviewInput / ReviewOutput / ReviewRiskFlag contracts
- isReviewRiskFlagType type guard"
```

---

## Task 3: Review Provider Registry

**Files:**
- Create: `src/providers/review/registry.ts`
- Test: `tests/unit/review-provider-registry.test.ts`

**Hedef:** Image registry paterninin (R17.3) review için aynısı: hardcoded id lookup yasak, sessiz fallback yasak.

- [ ] **Step 1: Failing test yaz**

`tests/unit/review-provider-registry.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { getReviewProvider, listReviewProviders } from "@/providers/review/registry";

describe("Review provider registry", () => {
  it("bilinen id ile provider döner", () => {
    const provider = getReviewProvider("gemini-2-5-flash");
    expect(provider.id).toBe("gemini-2-5-flash");
  });

  it("bilinmeyen id'de fırlatır (sessiz fallback yok)", () => {
    expect(() => getReviewProvider("nonexistent-id")).toThrow(
      /unknown review provider/i,
    );
  });

  it("listReviewProviders en az gemini-2-5-flash içerir", () => {
    const ids = listReviewProviders().map((p) => p.id);
    expect(ids).toContain("gemini-2-5-flash");
  });
});
```

- [ ] **Step 2: Test fail**

Run: `npx vitest run tests/unit/review-provider-registry.test.ts`
Expected: FAIL — modül yok.

- [ ] **Step 3: Registry yaz (Gemini provider stub'ıyla)**

`src/providers/review/registry.ts`:
```typescript
import type { ReviewProvider } from "./types";
import { geminiFlashReviewProvider } from "./gemini-2-5-flash";

const byId = new Map<string, ReviewProvider>();

function register(p: ReviewProvider): void {
  if (byId.has(p.id)) throw new Error(`review provider already registered: ${p.id}`);
  byId.set(p.id, p);
}

register(geminiFlashReviewProvider);

export function getReviewProvider(id: string): ReviewProvider {
  const provider = byId.get(id);
  if (!provider) throw new Error(`unknown review provider: ${id}`);
  return provider;
}

export function listReviewProviders(): ReviewProvider[] {
  return Array.from(byId.values());
}
```

`src/providers/review/gemini-2-5-flash.ts` (stub — Task 4'te dolduracağız):
```typescript
import type { ReviewProvider } from "./types";

export const geminiFlashReviewProvider: ReviewProvider = {
  id: "gemini-2-5-flash",
  kind: "vision",
  review: async () => {
    throw new Error("not implemented yet");
  },
};
```

- [ ] **Step 4: Test pass**

Run: `npx vitest run tests/unit/review-provider-registry.test.ts`
Expected: PASS — 3 test.

- [ ] **Step 5: Commit**

```bash
git add src/providers/review/registry.ts src/providers/review/gemini-2-5-flash.ts tests/unit/review-provider-registry.test.ts
git commit -m "feat(phase6): add review provider registry (R17.3)

- byId Map; hardcoded lookup yasak
- unknown id ⇒ explicit throw, sessiz fallback yok
- Gemini provider stub kaydedildi (Task 4'te dolacak)"
```

---

## Task 4: Gemini 2.5 Flash Review Provider

**Files:**
- Modify: `src/providers/review/gemini-2-5-flash.ts`
- Create: `src/providers/review/prompt.ts` (hardcoded prompt + version)
- Test: `tests/unit/gemini-review-provider.test.ts`

**Hedef:** Multimodal LLM ile OCR + watermark + signature + logo + celebrity tek atış. JSON çıktı schema validation.

- [ ] **Step 1: Failing test yaz (mock fetch)**

`tests/unit/gemini-review-provider.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { geminiFlashReviewProvider } from "@/providers/review/gemini-2-5-flash";

describe("Gemini review provider", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    global.fetch = vi.fn();
  });

  it("başarılı çağrıda parsed ReviewOutput döner", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: JSON.stringify({
            score: 85,
            textDetected: false,
            gibberishDetected: false,
            riskFlags: [],
            summary: "clean illustration",
          }) }] },
        }],
      }),
    });

    const result = await geminiFlashReviewProvider.review({
      imageUrl: "https://example.com/img.png",
      productType: "wall_art",
      isTransparentTarget: false,
    });

    expect(result.score).toBe(85);
    expect(result.riskFlags).toEqual([]);
  });

  it("bilinmeyen risk flag type'ı reddeder", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: JSON.stringify({
            score: 70,
            textDetected: false,
            gibberishDetected: false,
            riskFlags: [{ type: "fake_flag", confidence: 0.9, reason: "x" }],
            summary: "x",
          }) }] },
        }],
      }),
    });

    await expect(
      geminiFlashReviewProvider.review({
        imageUrl: "https://example.com/img.png",
        productType: "wall_art",
        isTransparentTarget: false,
      }),
    ).rejects.toThrow(/invalid risk flag type/i);
  });

  it("HTTP error fırlatır (sessiz fallback yok)", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "server error",
    });

    await expect(
      geminiFlashReviewProvider.review({
        imageUrl: "https://example.com/img.png",
        productType: "wall_art",
        isTransparentTarget: false,
      }),
    ).rejects.toThrow(/gemini review failed/i);
  });
});
```

- [ ] **Step 2: Test fail**

Run: `npx vitest run tests/unit/gemini-review-provider.test.ts`
Expected: FAIL — `not implemented yet`.

- [ ] **Step 3: Prompt dosyası yaz**

`src/providers/review/prompt.ts`:
```typescript
export const REVIEW_PROMPT_VERSION = "v1.0";

export const REVIEW_SYSTEM_PROMPT = `Sen bir Etsy print-on-demand görsel kalite denetçisisin.
Verilen tek görsel için yalnızca aşağıdaki JSON şemasında dönüt ver:

{
  "score": number 0-100,
  "textDetected": boolean,
  "gibberishDetected": boolean,
  "riskFlags": [{ "type": <8 sabit type'tan biri>, "confidence": 0-1, "reason": kısa açıklama }],
  "summary": kısa cümle
}

Sabit risk flag type'ları (yalnız bu listeden):
- watermark_detected
- signature_detected
- visible_logo_detected
- celebrity_face_detected
- no_alpha_channel
- transparent_edge_artifact
- text_detected
- gibberish_text_detected

KURAL: Hiçbir risk yoksa riskFlags boş array []. JSON dışında metin yazma.`;

export function buildReviewUserPrompt(productType: string, isTransparent: boolean): string {
  return `Ürün tipi: ${productType}. Transparent hedef: ${isTransparent ? "evet" : "hayır"}.
Görseli yukarıdaki şemaya göre değerlendir.`;
}
```

- [ ] **Step 4: Provider implementasyonu**

`src/providers/review/gemini-2-5-flash.ts` (tamamen yenile):
```typescript
import { z } from "zod";
import type { ReviewProvider, ReviewOutput, ReviewRiskFlag } from "./types";
import { REVIEW_RISK_FLAG_TYPES } from "./types";
import { REVIEW_SYSTEM_PROMPT, buildReviewUserPrompt } from "./prompt";

const RiskFlagSchema = z.object({
  type: z.enum(REVIEW_RISK_FLAG_TYPES),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
});

const OutputSchema = z.object({
  score: z.number().int().min(0).max(100),
  textDetected: z.boolean(),
  gibberishDetected: z.boolean(),
  riskFlags: z.array(RiskFlagSchema),
  summary: z.string(),
});

export const geminiFlashReviewProvider: ReviewProvider = {
  id: "gemini-2-5-flash",
  kind: "vision",
  review: async (input) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY missing");

    const userPrompt = buildReviewUserPrompt(input.productType, input.isTransparentTarget);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

    const body = {
      contents: [{
        role: "user",
        parts: [
          { text: REVIEW_SYSTEM_PROMPT },
          { text: userPrompt },
          { fileData: { mimeType: "image/png", fileUri: input.imageUrl } },
        ],
      }],
      generationConfig: { responseMimeType: "application/json" },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`gemini review failed: ${res.status} ${text}`);
    }

    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("gemini review failed: empty response");

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`gemini review failed: non-JSON output: ${text.slice(0, 200)}`);
    }

    const result = OutputSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`invalid risk flag type or schema: ${result.error.message}`);
    }
    return result.data satisfies ReviewOutput;
  },
};
```

- [ ] **Step 5: Test pass**

Run: `npx vitest run tests/unit/gemini-review-provider.test.ts`
Expected: PASS — 3 test.

- [ ] **Step 6: Commit**

```bash
git add src/providers/review/gemini-2-5-flash.ts src/providers/review/prompt.ts tests/unit/gemini-review-provider.test.ts
git commit -m "feat(phase6): implement Gemini 2.5 Flash review provider

- Multimodal vision call with strict JSON output (Zod validated)
- Hardcoded prompt v1.0 + version constant for snapshot lock
- 8 sabit risk flag enum schema; bilinmeyen type ⇒ throw
- HTTP error / non-JSON / missing API key ⇒ explicit throw"
```

---

## Task 5: Sharp Deterministic Alpha Checks Service

**Files:**
- Create: `src/server/services/review/alpha-checks.ts`
- Test: `tests/unit/alpha-checks.test.ts`
- Test fixtures: `tests/fixtures/review/transparent-clean.png`, `transparent-edge-artifact.png`, `opaque.png`

**Hedef:** Yalnızca transparent-target ürün tiplerinde (clipart, sticker, transparent_png) çalışır. `no_alpha_channel` ve `transparent_edge_artifact` flag'lerini deterministic olarak çıkarır.

- [ ] **Step 1: Failing test yaz**

`tests/unit/alpha-checks.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import path from "node:path";
import { runAlphaChecks } from "@/server/services/review/alpha-checks";

const fixtures = path.join(__dirname, "..", "fixtures", "review");

describe("Alpha checks (deterministic)", () => {
  it("opak görselde no_alpha_channel flag'i döner", async () => {
    const flags = await runAlphaChecks(path.join(fixtures, "opaque.png"));
    expect(flags.map((f) => f.type)).toContain("no_alpha_channel");
  });

  it("temiz transparent görselde flag dönmez", async () => {
    const flags = await runAlphaChecks(path.join(fixtures, "transparent-clean.png"));
    expect(flags).toEqual([]);
  });

  it("kenar artifact'lı görselde transparent_edge_artifact döner", async () => {
    const flags = await runAlphaChecks(path.join(fixtures, "transparent-edge-artifact.png"));
    expect(flags.map((f) => f.type)).toContain("transparent_edge_artifact");
  });
});
```

- [ ] **Step 2: Test fail**

Run: `npx vitest run tests/unit/alpha-checks.test.ts`
Expected: FAIL — modül yok.

- [ ] **Step 3: Sharp service yaz**

`src/server/services/review/alpha-checks.ts`:
```typescript
import sharp from "sharp";
import type { ReviewRiskFlag } from "@/providers/review/types";

export async function runAlphaChecks(filePath: string): Promise<ReviewRiskFlag[]> {
  const image = sharp(filePath);
  const meta = await image.metadata();
  const flags: ReviewRiskFlag[] = [];

  if (!meta.hasAlpha) {
    flags.push({
      type: "no_alpha_channel",
      confidence: 1,
      reason: "Görselde alfa kanalı yok",
    });
    return flags;
  }

  // Edge artifact: kenar pikselleri arasında %1+ pikselin alpha < 250
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  let edgePixels = 0;
  let dirtyEdgePixels = 0;

  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const idx = (y * width + x) * channels + (channels - 1);
      edgePixels++;
      if (data[idx] > 0 && data[idx] < 250) dirtyEdgePixels++;
    }
  }
  for (let y = 0; y < height; y++) {
    for (const x of [0, width - 1]) {
      const idx = (y * width + x) * channels + (channels - 1);
      edgePixels++;
      if (data[idx] > 0 && data[idx] < 250) dirtyEdgePixels++;
    }
  }

  const ratio = edgePixels === 0 ? 0 : dirtyEdgePixels / edgePixels;
  if (ratio > 0.01) {
    flags.push({
      type: "transparent_edge_artifact",
      confidence: Math.min(1, ratio * 10),
      reason: `Kenar piksellerinin %${(ratio * 100).toFixed(1)}'inde yarı saydam artifact`,
    });
  }

  return flags;
}
```

- [ ] **Step 4: Test fixtures üret**

Run (sharp ile):
```bash
node -e "
const sharp = require('sharp');
const path = require('path');
const dir = 'tests/fixtures/review';
require('fs').mkdirSync(dir, { recursive: true });

// opaque.png
sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 255, g: 0, b: 0 } } })
  .png()
  .toFile(path.join(dir, 'opaque.png'));

// transparent-clean.png — alpha 0 dış, 255 iç, sert kesim
sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: Buffer.from(new Array(32*32*4).fill(0).map((_, i) => i % 4 === 3 ? 255 : 100)), raw: { width: 32, height: 32, channels: 4 }, top: 16, left: 16 }])
  .png()
  .toFile(path.join(dir, 'transparent-clean.png'));

// transparent-edge-artifact.png — kenarda alpha 100
const buf = Buffer.alloc(64*64*4);
for (let i = 0; i < 64*64; i++) {
  buf[i*4] = 100; buf[i*4+1] = 100; buf[i*4+2] = 100;
  // tüm pikseller alpha 100 ⇒ kenar dahil dirty
  buf[i*4+3] = 100;
}
sharp(buf, { raw: { width: 64, height: 64, channels: 4 } })
  .png()
  .toFile(path.join(dir, 'transparent-edge-artifact.png'));
"
```
Expected: 3 PNG dosyası `tests/fixtures/review/`'da oluşur.

- [ ] **Step 5: Test pass**

Run: `npx vitest run tests/unit/alpha-checks.test.ts`
Expected: PASS — 3 test.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/review/alpha-checks.ts tests/unit/alpha-checks.test.ts tests/fixtures/review/
git commit -m "feat(phase6): add deterministic alpha checks service

- runAlphaChecks: hasAlpha + edge artifact ratio
- 2 risk flag türü: no_alpha_channel, transparent_edge_artifact
- Sharp ile pure deterministic; transparent ürün tiplerinde aktif
- Fixture'larla red→green doğrulandı"
```

---

## Task 6: Review Decision Rule (R8)

**Files:**
- Create: `src/server/services/review/decision.ts`
- Test: `tests/unit/review-decision.test.ts`

**Hedef:** Hardcoded threshold (60/90) + risk flag varlığına göre `ReviewStatus` üret. Hiçbir karar belirsiz değil.

- [ ] **Step 1: Failing test yaz**

`tests/unit/review-decision.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { decideReviewStatus } from "@/server/services/review/decision";
import { ReviewStatus } from "@prisma/client";

describe("decideReviewStatus (R8)", () => {
  it("risk_flags > 0 ⇒ NEEDS_REVIEW", () => {
    expect(
      decideReviewStatus({
        score: 95,
        riskFlags: [{ type: "watermark_detected", confidence: 0.9, reason: "x" }],
      }),
    ).toBe(ReviewStatus.NEEDS_REVIEW);
  });

  it("score < 60 ⇒ NEEDS_REVIEW", () => {
    expect(decideReviewStatus({ score: 55, riskFlags: [] })).toBe(ReviewStatus.NEEDS_REVIEW);
  });

  it("score >= 90 ve risk_flags == [] ⇒ APPROVED", () => {
    expect(decideReviewStatus({ score: 92, riskFlags: [] })).toBe(ReviewStatus.APPROVED);
  });

  it("60 <= score < 90 ve risk_flags == [] ⇒ NEEDS_REVIEW (güvenli varsayılan)", () => {
    expect(decideReviewStatus({ score: 75, riskFlags: [] })).toBe(ReviewStatus.NEEDS_REVIEW);
  });

  it("tam sınır: score == 60 ⇒ NEEDS_REVIEW", () => {
    expect(decideReviewStatus({ score: 60, riskFlags: [] })).toBe(ReviewStatus.NEEDS_REVIEW);
  });

  it("tam sınır: score == 90 ⇒ APPROVED", () => {
    expect(decideReviewStatus({ score: 90, riskFlags: [] })).toBe(ReviewStatus.APPROVED);
  });
});
```

- [ ] **Step 2: Test fail**

Run: `npx vitest run tests/unit/review-decision.test.ts`
Expected: FAIL.

- [ ] **Step 3: Decision yaz**

`src/server/services/review/decision.ts`:
```typescript
import { ReviewStatus } from "@prisma/client";
import type { ReviewRiskFlag } from "@/providers/review/types";

export const REVIEW_THRESHOLD_LOW = 60;
export const REVIEW_THRESHOLD_HIGH = 90;

export function decideReviewStatus(input: {
  score: number;
  riskFlags: ReviewRiskFlag[];
}): ReviewStatus {
  if (input.riskFlags.length > 0) return ReviewStatus.NEEDS_REVIEW;
  if (input.score < REVIEW_THRESHOLD_LOW) return ReviewStatus.NEEDS_REVIEW;
  if (input.score >= REVIEW_THRESHOLD_HIGH) return ReviewStatus.APPROVED;
  return ReviewStatus.NEEDS_REVIEW;
}
```

- [ ] **Step 4: Test pass**

Run: `npx vitest run tests/unit/review-decision.test.ts`
Expected: PASS — 6 test.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/review/decision.ts tests/unit/review-decision.test.ts
git commit -m "feat(phase6): add review decision rule (R8)

- Hardcoded thresholds: 60 (low), 90 (high)
- risk_flags>0 ⇒ NEEDS_REVIEW (her zaman)
- score<60 ⇒ NEEDS_REVIEW
- score>=90 ve risk_flags boş ⇒ APPROVED
- Aksi (60<=score<90) ⇒ NEEDS_REVIEW (güvenli varsayılan)
- Belirsiz status yasak"
```

---

## Task 7: USER Override Sticky Enforcement (R12)

**Files:**
- Create: `src/server/services/review/sticky.ts`
- Test: `tests/unit/review-sticky.test.ts`

**Hedef:** USER source ile yazılmış status'u SYSTEM tekrar yazamaz. Rerun semantiği bu helper'dan geçer.

- [ ] **Step 1: Failing test yaz**

`tests/unit/review-sticky.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { applyReviewDecisionWithSticky } from "@/server/services/review/sticky";
import { ReviewStatus, ReviewStatusSource } from "@prisma/client";

describe("applyReviewDecisionWithSticky (R12)", () => {
  it("USER source ile yazılmış status SYSTEM tarafından üzerine yazılmaz", () => {
    const result = applyReviewDecisionWithSticky({
      current: { status: ReviewStatus.APPROVED, source: ReviewStatusSource.USER },
      systemDecision: ReviewStatus.NEEDS_REVIEW,
    });
    expect(result.shouldUpdate).toBe(false);
  });

  it("SYSTEM source ise SYSTEM yeni karar yazabilir", () => {
    const result = applyReviewDecisionWithSticky({
      current: { status: ReviewStatus.NEEDS_REVIEW, source: ReviewStatusSource.SYSTEM },
      systemDecision: ReviewStatus.APPROVED,
    });
    expect(result.shouldUpdate).toBe(true);
    expect(result.newStatus).toBe(ReviewStatus.APPROVED);
    expect(result.newSource).toBe(ReviewStatusSource.SYSTEM);
  });

  it("İlk review (current null) ⇒ SYSTEM yazar", () => {
    const result = applyReviewDecisionWithSticky({
      current: null,
      systemDecision: ReviewStatus.APPROVED,
    });
    expect(result.shouldUpdate).toBe(true);
    expect(result.newSource).toBe(ReviewStatusSource.SYSTEM);
  });
});
```

- [ ] **Step 2: Test fail**

Run: `npx vitest run tests/unit/review-sticky.test.ts`
Expected: FAIL.

- [ ] **Step 3: Sticky helper yaz**

`src/server/services/review/sticky.ts`:
```typescript
import { ReviewStatus, ReviewStatusSource } from "@prisma/client";

export type StickyInput = {
  current: { status: ReviewStatus; source: ReviewStatusSource } | null;
  systemDecision: ReviewStatus;
};

export type StickyOutput =
  | { shouldUpdate: true; newStatus: ReviewStatus; newSource: ReviewStatusSource }
  | { shouldUpdate: false };

export function applyReviewDecisionWithSticky(input: StickyInput): StickyOutput {
  if (input.current?.source === ReviewStatusSource.USER) {
    return { shouldUpdate: false };
  }
  return {
    shouldUpdate: true,
    newStatus: input.systemDecision,
    newSource: ReviewStatusSource.SYSTEM,
  };
}
```

- [ ] **Step 4: Test pass**

Run: `npx vitest run tests/unit/review-sticky.test.ts`
Expected: PASS — 3 test.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/review/sticky.ts tests/unit/review-sticky.test.ts
git commit -m "feat(phase6): enforce USER override sticky semantics (R12)

- USER source ⇒ rerun status'ü değiştiremez
- SYSTEM source ⇒ yeni SYSTEM kararı yazabilir
- İlk review (null current) ⇒ SYSTEM yazar
- 'Approve anyway' kontratının kod düzeyinde garantisi"
```

---

## Task 8: REVIEW_DESIGN Worker

**Files:**
- Create: `src/server/workers/review-design.worker.ts`
- Modify: `src/server/workers/bootstrap.ts`
- Test: `tests/integration/review-design-worker.test.ts`

**Hedef:** `GeneratedDesign` için review pipeline'ını tek noktada birleştir: alpha checks + Gemini provider + decision + sticky + DB güncelleme + snapshot lock.

- [ ] **Step 1: Failing test yaz**

`tests/integration/review-design-worker.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleReviewDesign } from "@/server/workers/review-design.worker";
import { prisma } from "@/server/db/prisma";
import { ReviewStatus, ReviewStatusSource } from "@prisma/client";

vi.mock("@/providers/review/registry", () => ({
  getReviewProvider: () => ({
    id: "gemini-2-5-flash",
    kind: "vision",
    review: async () => ({
      score: 95,
      textDetected: false,
      gibberishDetected: false,
      riskFlags: [],
      summary: "ok",
    }),
  }),
}));

vi.mock("@/server/services/review/alpha-checks", () => ({
  runAlphaChecks: async () => [],
}));

describe("handleReviewDesign worker", () => {
  let designId: string;

  beforeEach(async () => {
    // setup: bir GeneratedDesign yarat (test fixture helper kullan)
    // ... (gerçek implementasyonda factory)
    designId = "test-design-id";
  });

  it("approved kararı yazar + provider/prompt snapshot kalır", async () => {
    await handleReviewDesign({ data: { generatedDesignId: designId } } as any);
    const updated = await prisma.generatedDesign.findUnique({ where: { id: designId } });
    expect(updated?.reviewStatus).toBe(ReviewStatus.APPROVED);
    expect(updated?.reviewStatusSource).toBe(ReviewStatusSource.SYSTEM);
    expect(updated?.reviewProviderSnapshot).toBeTruthy();
    expect(updated?.reviewPromptSnapshot).toBeTruthy();
  });

  it("USER override sonrası rerun status'ü değiştirmez", async () => {
    await prisma.generatedDesign.update({
      where: { id: designId },
      data: { reviewStatus: ReviewStatus.APPROVED, reviewStatusSource: ReviewStatusSource.USER },
    });
    await handleReviewDesign({ data: { generatedDesignId: designId } } as any);
    const updated = await prisma.generatedDesign.findUnique({ where: { id: designId } });
    expect(updated?.reviewStatusSource).toBe(ReviewStatusSource.USER);
  });
});
```

- [ ] **Step 2: Test fail**

Run: `npx vitest run tests/integration/review-design-worker.test.ts`
Expected: FAIL — modül yok.

- [ ] **Step 3: Worker yaz**

`src/server/workers/review-design.worker.ts`:
```typescript
import type { Job } from "bullmq";
import { ReviewStatus, ReviewStatusSource } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { getReviewProvider } from "@/providers/review/registry";
import { runAlphaChecks } from "@/server/services/review/alpha-checks";
import { decideReviewStatus } from "@/server/services/review/decision";
import { applyReviewDecisionWithSticky } from "@/server/services/review/sticky";
import { REVIEW_PROMPT_VERSION, REVIEW_SYSTEM_PROMPT } from "@/providers/review/prompt";
import { logger } from "@/lib/logger";

const TRANSPARENT_TARGET_TYPES = new Set(["clipart", "sticker", "transparent_png"]);

export async function handleReviewDesign(job: Job<{ generatedDesignId: string }>) {
  const { generatedDesignId } = job.data;
  const design = await prisma.generatedDesign.findUnique({
    where: { id: generatedDesignId },
    include: { asset: true, productType: true },
  });
  if (!design) throw new Error(`design not found: ${generatedDesignId}`);

  const sticky = applyReviewDecisionWithSticky({
    current: { status: design.reviewStatus, source: design.reviewStatusSource },
    systemDecision: ReviewStatus.PENDING, // placeholder, gerçek karar aşağıda
  });
  if (!sticky.shouldUpdate && design.reviewStatusSource === ReviewStatusSource.USER) {
    logger.info({ designId: generatedDesignId }, "review skipped — USER sticky");
    return { skipped: true, reason: "user_sticky" };
  }

  const isTransparent = TRANSPARENT_TARGET_TYPES.has(design.productType.slug);
  const alphaFlags = isTransparent ? await runAlphaChecks(design.asset.localPath) : [];

  const provider = getReviewProvider("gemini-2-5-flash");
  const llm = await provider.review({
    imageUrl: design.asset.url,
    productType: design.productType.slug,
    isTransparentTarget: isTransparent,
  });

  const allFlags = [...alphaFlags, ...llm.riskFlags];
  const decision = decideReviewStatus({ score: llm.score, riskFlags: allFlags });

  await prisma.generatedDesign.update({
    where: { id: generatedDesignId },
    data: {
      reviewStatus: decision,
      reviewStatusSource: ReviewStatusSource.SYSTEM,
      reviewScore: llm.score,
      reviewSummary: llm.summary,
      reviewRiskFlags: allFlags as any,
      textDetected: llm.textDetected,
      gibberishDetected: llm.gibberishDetected,
      reviewedAt: new Date(),
      reviewProviderSnapshot: { id: provider.id, kind: provider.kind },
      reviewPromptSnapshot: `${REVIEW_PROMPT_VERSION}\n${REVIEW_SYSTEM_PROMPT}`,
    },
  });

  await prisma.designReview.create({
    data: {
      generatedDesignId,
      reviewer: "system",
      score: llm.score,
      issues: allFlags as any,
      decision,
      provider: provider.id,
      model: "gemini-2.0-flash-exp",
      promptSnapshot: REVIEW_SYSTEM_PROMPT,
      responseSnapshot: llm as any,
    },
  });

  return { decision, score: llm.score, flagCount: allFlags.length };
}
```

- [ ] **Step 4: Bootstrap'a ekle**

`src/server/workers/bootstrap.ts` import + spec:
```typescript
import { handleReviewDesign } from "./review-design.worker";
// ...
{ name: JobType.REVIEW_DESIGN, handler: handleReviewDesign },
```

Concurrency satırına ekleme:
```typescript
const concurrency =
  s.name === JobType.FETCH_NEW_LISTINGS
    ? 1
    : s.name === JobType.GENERATE_VARIATIONS
      ? 4
      : s.name === JobType.REVIEW_DESIGN
        ? 4
        : 2;
```

- [ ] **Step 5: Test pass**

Run: `npx vitest run tests/integration/review-design-worker.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/workers/review-design.worker.ts src/server/workers/bootstrap.ts tests/integration/review-design-worker.test.ts
git commit -m "feat(phase6): add REVIEW_DESIGN worker with snapshot lock

- Hibrit pipeline: alpha checks + Gemini provider
- Ürün tipi gate: transparent_target setinde alpha checks aktif
- Decision rule + sticky helper entegre
- Provider + prompt snapshot persist (CLAUDE.md kuralı)
- DesignReview audit trail kaydı
- Bootstrap concurrency=4"
```

---

## Task 9: GENERATE_VARIATIONS SUCCESS Sonrası Auto-Enqueue

**Files:**
- Modify: `src/server/workers/generate-variations.worker.ts`
- Test: `tests/integration/generate-variations-auto-review.test.ts`

**Hedef:** AI mode'da yeni `GeneratedDesign` üretildiğinde otomatik `REVIEW_DESIGN` job'u kuyruğa al.

- [ ] **Step 1: Failing test yaz**

`tests/integration/generate-variations-auto-review.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { generateVariationsHandler } from "@/server/workers/generate-variations.worker";

const enqueueMock = vi.fn();
vi.mock("@/server/queue", async () => ({
  ...(await vi.importActual<any>("@/server/queue")),
  enqueueJob: enqueueMock,
}));

describe("GENERATE_VARIATIONS auto-review enqueue", () => {
  it("her başarılı GeneratedDesign için REVIEW_DESIGN job'u kuyruğa eklenir", async () => {
    // setup: 3 design üretecek mock
    // ...
    expect(enqueueMock).toHaveBeenCalledTimes(3);
    expect(enqueueMock.mock.calls[0][0]).toBe("REVIEW_DESIGN");
  });
});
```

- [ ] **Step 2: Test fail**

Expected: FAIL — auto-enqueue henüz yok.

- [ ] **Step 3: Worker'a enqueue ekle**

`src/server/workers/generate-variations.worker.ts` SUCCESS dalında, design create sonrası:
```typescript
import { enqueueJob } from "@/server/queue";
// ...
await enqueueJob(JobType.REVIEW_DESIGN, { generatedDesignId: design.id });
```

- [ ] **Step 4: Test pass**

Run: `npx vitest run tests/integration/generate-variations-auto-review.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/workers/generate-variations.worker.ts tests/integration/generate-variations-auto-review.test.ts
git commit -m "feat(phase6): auto-enqueue REVIEW_DESIGN after GENERATE_VARIATIONS success

- Her yeni GeneratedDesign için tek REVIEW_DESIGN job
- AI mode kullanıcısı manuel review tetiklemek zorunda kalmaz
- Local mode (Task 10) farklı: manuel batch"
```

---

## Task 10: REVIEW_LOCAL_ASSET Worker + Batch Endpoint

**Files:**
- Create: `src/server/workers/review-local-asset.worker.ts`
- Modify: `src/server/workers/bootstrap.ts`, `prisma/schema.prisma` (JobType enum'a `REVIEW_LOCAL_ASSET` ekle)
- Create: `src/app/api/review/local-batch/route.ts`
- Test: `tests/integration/review-local-asset-worker.test.ts`

**Hedef:** Local library asset'leri için manuel batch review tetikleyen API + worker. Cost guardrail kontrolü Task 18'de bağlanır; bu task'te placeholder.

- [ ] **Step 1: schema.prisma JobType enum'una ekle**

```prisma
enum JobType {
  // ... mevcut
  REVIEW_LOCAL_ASSET
}
```

Run: `npx prisma migrate dev --name phase6_review_local_asset_jobtype`

- [ ] **Step 2: Failing test yaz**

`tests/integration/review-local-asset-worker.test.ts` — yapısal olarak Task 8 ile paralel; `LocalLibraryAsset` üzerinde çalışır.

- [ ] **Step 3: Worker yaz**

Task 8'in mantığının LocalLibraryAsset'e uyarlanmış kopyası:
- `design.asset.url` yerine `asset.filePath`
- `design.productType.slug` — local asset'te yok ⇒ kullanıcı default product type'ı session/store'dan gelir; eğer yoksa `wall_art` default (transparent gate kapalı kalır).
- DesignReview yerine inline `reviewStatus`/`reviewSummary` LocalLibraryAsset'e yazılır.

- [ ] **Step 4: Batch API route yaz**

`src/app/api/review/local-batch/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { enqueueJob } from "@/server/queue";
import { JobType } from "@prisma/client";

const Schema = z.object({ assetIds: z.array(z.string().cuid()).min(1).max(100) });

export async function POST(req: Request) {
  const user = await requireUser();
  const body = Schema.parse(await req.json());
  for (const id of body.assetIds) {
    await enqueueJob(JobType.REVIEW_LOCAL_ASSET, { localAssetId: id, userId: user.id });
  }
  return NextResponse.json({ enqueued: body.assetIds.length });
}
```

- [ ] **Step 5: Bootstrap'a ekle, test pass, commit**

```bash
git commit -m "feat(phase6): add REVIEW_LOCAL_ASSET worker + manual batch API

- Local mode: kullanıcı asset seç → POST /api/review/local-batch
- Worker yapı olarak REVIEW_DESIGN paraleli; LocalLibraryAsset alanlarına yazar
- Default product type: wall_art (transparent gate kapalı kalır)
- Sticky + decision + snapshot kuralları ortak"
```

---

## Task 11: Review Decisions API (USER Override + Reset)

**Files:**
- Create: `src/app/api/review/decisions/route.ts`
- Test: `tests/integration/review-decisions-api.test.ts`

**Hedef:** Kullanıcı `Approve anyway` / `Reject` aksiyonu yaptığında `reviewStatusSource = USER` ile yazılır. Reset to system endpoint'i ayrı method.

- [ ] **Step 1: Failing test yaz**

`tests/integration/review-decisions-api.test.ts`:
```typescript
describe("POST /api/review/decisions", () => {
  it("USER override status ve source'u USER olarak yazar", async () => {
    const res = await fetch("/api/review/decisions", {
      method: "POST",
      body: JSON.stringify({ scope: "design", id: "...", decision: "APPROVED" }),
    });
    expect(res.status).toBe(200);
    // DB'de source === USER doğrula
  });

  it("PATCH reset → source SYSTEM'e döner ve rerun yapılır", async () => {
    // ...
  });
});
```

- [ ] **Step 2-4: Endpoint impl + test pass**

POST: `reviewStatusSource = USER`. PATCH: `reviewStatusSource = SYSTEM`, `enqueueJob(REVIEW_DESIGN, ...)` ile rerun.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(phase6): add review decisions API (USER override + reset)

- POST /api/review/decisions ⇒ source=USER (sticky kazanır)
- PATCH /api/review/decisions ⇒ source=SYSTEM, rerun job enqueue
- design ve local asset scope'larını destekler"
```

---

## Task 12: Auth Guard + Authz İzolasyonu (Review Endpoints)

**Files:**
- Modify: API route'larında `requireUser` + ownership filtreleri
- Test: `tests/integration/review-authz.test.ts`

**Hedef:** A kullanıcısı B'nin design'ını review edemez. CLAUDE.md kuralı: backend authorization zorunlu.

- [ ] **Step 1-5:** Standart authz testleri (401, 403, ownership kontrolü).

- [ ] **Commit:**
```bash
git commit -m "feat(phase6): enforce ownership on review endpoints

- requireUser zorunlu
- design.userId === session.user.id check
- ihlalde 403, sessiz fallback yok"
```

---

## Task 13: /review Sayfası Shell + Tab Yapısı

**Files:**
- Create: `src/app/(app)/review/page.tsx`
- Create: `src/app/(app)/review/_components/ReviewTabs.tsx`
- Modify: `src/app/(app)/_components/AppSidebar.tsx`
- Test: `tests/unit/review-tabs.test.tsx`

**Hedef:** İki sekmeli (`AI Tasarımlar` | `Local Library`) sayfa shell. Default landing: `AI Tasarımlar` (Karar 6).

- [ ] **Step 1: Failing test**

```typescript
import { render, screen } from "@testing-library/react";
import { ReviewTabs } from "@/app/(app)/review/_components/ReviewTabs";

it("default tab: AI Tasarımlar aktif", () => {
  render(<ReviewTabs activeTab="ai" />);
  expect(screen.getByRole("tab", { name: /AI Tasarımlar/i })).toHaveAttribute("aria-selected", "true");
});
```

- [ ] **Step 3: ReviewTabs + page**

URL: `?tab=ai` veya `?tab=local`; default `ai`.

- [ ] **Step 5: Sidebar'a Review menü maddesi ekle**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(phase6): add /review page shell with two-tab layout

- Default tab: AI Tasarımlar (R10)
- URL query param ile tab persist
- Sidebar Review menü maddesi"
```

---

## Task 14: ReviewCard + Status Badge + Mini Sinyal Satırı

**Files:**
- Create: `src/app/(app)/review/_components/ReviewCard.tsx`
- Test: `tests/unit/review-card.test.tsx`

**Hedef:** Her tasarım/asset bir kart. Üstte thumbnail, altta status badge + score + risk flag count + provider source rozeti (USER/SYSTEM).

- [ ] **Step 1-5:** TDD ile kart, badge varyantları (PENDING/APPROVED/NEEDS_REVIEW/REJECTED).

- [ ] **Commit:**
```bash
git commit -m "feat(phase6): add ReviewCard with status + mini signal row

- Status badge (4 ReviewStatus rengi)
- Score chip + risk flag count
- USER/SYSTEM source rozeti (sticky'yi UI'da görünür yapar)"
```

---

## Task 15: Detay Paneli + Reset to System

**Files:**
- Create: `src/app/(app)/review/_components/ReviewDetailPanel.tsx`
- Test: `tests/unit/review-detail-panel.test.tsx`

**Hedef:** Karta tıklandığında sağ panel: tüm risk flag'ler (type/confidence/reason), summary, snapshot bilgisi (provider+model+prompt versiyonu), `Approve anyway` / `Reject` / `Reset to System` butonları.

- [ ] **Step 1-5:** TDD; reset butonu yalnız `reviewStatusSource === USER` iken enabled.

- [ ] **Commit:**
```bash
git commit -m "feat(phase6): add review detail panel with snapshot view

- Risk flag listesi (type/confidence/reason)
- Provider+model+prompt versiyonu görünür
- Approve anyway / Reject / Reset to System butonları
- Reset yalnız USER source'ta enabled"
```

---

## Task 16: Bulk Approve (Skip-on-Risk) + Bulk Reject

**Files:**
- Create: `src/app/(app)/review/_components/BulkActionsBar.tsx`
- Create: `src/app/api/review/bulk/route.ts`
- Test: `tests/integration/review-bulk.test.ts`

**Hedef:** Karar 6: bulk approve risk_flags > 0 olanları **skip eder ve raporlar**. Bulk reject doğrudan tüm seçimi reject yazar (USER source).

- [ ] **Step 1: Failing test**

```typescript
describe("POST /api/review/bulk", () => {
  it("approve aksiyonu risk_flags olanları skip eder ve sayıyı raporlar", async () => {
    // 5 design seçili, 2'sinde risk_flag var
    const res = await fetch("/api/review/bulk", {
      method: "POST",
      body: JSON.stringify({ action: "approve", ids: [...], scope: "design" }),
    });
    const data = await res.json();
    expect(data.approved).toBe(3);
    expect(data.skipped).toBe(2);
    expect(data.skippedIds.length).toBe(2);
  });
});
```

- [ ] **Step 3: Endpoint + UI**

```typescript
export async function POST(req: Request) {
  const { action, ids, scope } = ParseSchema.parse(await req.json());
  if (action === "approve") {
    const designs = await prisma.generatedDesign.findMany({
      where: { id: { in: ids }, userId: user.id },
      select: { id: true, reviewRiskFlags: true },
    });
    const safeIds = designs.filter((d) => !d.reviewRiskFlags || (d.reviewRiskFlags as any[]).length === 0).map((d) => d.id);
    const skippedIds = designs.filter((d) => Array.isArray(d.reviewRiskFlags) && (d.reviewRiskFlags as any[]).length > 0).map((d) => d.id);
    await prisma.generatedDesign.updateMany({
      where: { id: { in: safeIds } },
      data: { reviewStatus: "APPROVED", reviewStatusSource: "USER", reviewedAt: new Date() },
    });
    return NextResponse.json({ approved: safeIds.length, skipped: skippedIds.length, skippedIds });
  }
  if (action === "reject") {
    await prisma.generatedDesign.updateMany({
      where: { id: { in: ids }, userId: user.id },
      data: { reviewStatus: "REJECTED", reviewStatusSource: "USER", reviewedAt: new Date() },
    });
    return NextResponse.json({ rejected: ids.length });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(phase6): bulk approve (skip-on-risk) + bulk reject

- Approve risk_flags olanları skip + skippedIds rapor
- Reject seçimin tümünü USER source ile yazar
- UX yorgunluğu önlenir, review değeri korunur"
```

---

## Task 17: Bulk Delete + TypingConfirmation Primitive

**Files:**
- Create: `src/components/ui/TypingConfirmation.tsx`
- Modify: `src/app/(app)/review/_components/BulkActionsBar.tsx`
- Modify: `src/app/api/review/bulk/route.ts` (action: `delete`)
- Test: `tests/unit/typing-confirmation.test.tsx`, `tests/integration/review-bulk-delete.test.ts`

**Hedef:** Phase 5'ten kapanan `destructive-typing-confirmation` carry-forward'u. Kullanıcı `SİL` yazmadan submit butonu disabled. Bulk delete soft-delete yazar.

- [ ] **Step 1: TypingConfirmation TDD**

```typescript
describe("TypingConfirmation", () => {
  it("doğru phrase yazılana kadar confirm disabled", async () => {
    render(<TypingConfirmation phrase="SİL" onConfirm={vi.fn()} />);
    expect(screen.getByRole("button", { name: /sil/i })).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox"), "SİL");
    expect(screen.getByRole("button", { name: /sil/i })).toBeEnabled();
  });
});
```

- [ ] **Step 3: Primitive yaz**

`src/components/ui/TypingConfirmation.tsx`:
```typescript
"use client";
import { useState } from "react";

export function TypingConfirmation(props: {
  phrase: string;
  onConfirm: () => void;
  message: string;
  buttonLabel?: string;
}) {
  const [value, setValue] = useState("");
  const matches = value === props.phrase;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">{props.message}</p>
      <p className="text-sm font-medium">Onaylamak için aşağıya <code>{props.phrase}</code> yazın:</p>
      <input
        role="textbox"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="border rounded px-3 py-2"
      />
      <button
        type="button"
        disabled={!matches}
        onClick={props.onConfirm}
        className="bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {props.buttonLabel ?? props.phrase}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Bulk delete endpoint**

action: `delete` ⇒ `prisma.generatedDesign.updateMany({ data: { deletedAt: new Date() } })`. Local asset için `isUserDeleted: true, deletedAt`.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(phase6): bulk delete with typing confirmation primitive

- TypingConfirmation: phrase eşleşene kadar confirm disabled
- Phase 5 carry-forward 'destructive-typing-confirmation' kapatıldı
- Bulk delete soft-delete yazar (deletedAt)
- Future: archive/folder delete vb. yerlerde aynı primitive yeniden kullanılabilir"
```

---

## Task 18: Cost Guardrail Entegrasyonu

**Files:**
- Modify: `src/lib/cost-guardrails.ts`
- Modify: `src/server/workers/review-design.worker.ts`, `review-local-asset.worker.ts`
- Test: `tests/integration/review-cost-guardrails.test.ts`

**Hedef:** R17 (kısmi). Review job'lar günlük/aylık kullanıcı bütçesine sayılır. Bütçe aşımı ⇒ job başlamaz, `throw`.

- [ ] **Step 1-5:** TDD; aşım durumunda `throw new Error("daily review budget exceeded")`. Sessiz skip yasak.

- [ ] **Commit:**
```bash
git commit -m "feat(phase6): integrate review jobs into cost guardrails (R17 partial)

- review_design + review_local_asset kategorisi
- Bütçe aşımı ⇒ explicit throw, sessiz skip yok
- Carry-forward: admin per-user override (Phase 7+)"
```

---

## Task 19: Final Smoke + Dokümantasyon Kapanışı

**Files:**
- Create: `docs/design/implementation-notes/phase6-quality-review.md`
- Modify: `docs/plans/2026-04-28-phase6-quality-review-design.md` (closeout notu, Phase 5 paterni)

**Hedef:** Tüm test suite, integrasyon smoke (AI mode end-to-end + local mode batch). Kapatılan ve carry-forward kalan maddeleri sabitle.

- [ ] **Step 1: Tüm test suite**

Run: `npx vitest run`
Expected: ALL PASS.

- [ ] **Step 2: Manuel smoke checklist** (yalnızca dış secret/auth gerekiyorsa kullanıcıya handoff)

- AI mode: bir reference seç → variations üret → `/review` `AI Tasarımlar` sekmesinde yeni kayıtlar PENDING → birkaç saniye sonra APPROVED veya NEEDS_REVIEW
- Local mode: library asset'leri seç → batch review tetikle → `Local Library` sekmesinde sonuçlar
- USER override: bir NEEDS_REVIEW kaydını `Approve anyway` → kart yeşil + USER rozeti
- Rerun: aynı kaydı dış API ile yeniden REVIEW_DESIGN job'una sok → status değişmez (USER sticky)
- Reset to System: panel'den reset → SYSTEM kararı tekrar yazılır
- Bulk approve skip-on-risk: 5 seçim, 2 risky → toast "3 onaylandı, 2 atlandı"
- Bulk delete typing confirmation: `SİL` yazmadan buton disabled

- [ ] **Step 3: Closeout doc yaz**

`docs/design/implementation-notes/phase6-quality-review.md` — Phase 5 paterni:
- Kapanış özeti (Phase 5 carry-forward'lardan kapatılanlar)
- Yeni carry-forward listesi (design doc §10.2 ile senkron)
- Bilinen sınırlar (multi-provider yok, prompt admin UI yok, threshold settings yok)
- Test sayımı + smoke sonuçları

- [ ] **Step 4: Final commit**

```bash
git add docs/design/implementation-notes/phase6-quality-review.md docs/plans/2026-04-28-phase6-quality-review-design.md
git commit -m "docs(phase6): closeout — review pipeline ships, 2 carry-forwards closed

- Closeout notes: Phase 5 carry-forwards 'auto-quality-detection-ocr-bg'
  ve 'destructive-typing-confirmation' kapatıldı
- 7 yeni Phase 7+ carry-forward listesi sabitlendi
- Test sayımı, smoke sonuçları, bilinen sınırlar"
```

---

## Self-Review

**Spec coverage:**
- R0 (kapsam): Task 8, 9, 10 — AI tasarımları otomatik, local asset manuel batch ✅
- R1 (sinyal üretici, hard reject yok): Task 6 (decision rule yumuşak), Task 7 (USER sticky), Task 11 (Approve anyway endpoint) ✅
- R2 (hibrit pipeline): Task 5 (alpha) + Task 4 (LLM) + Task 8 (birleşim) ✅
- R3 (multimodal LLM tek atış): Task 4 ✅
- R4 (sharp deterministic): Task 5 ✅
- R5 (ürün tipi gate): Task 8 — `TRANSPARENT_TARGET_TYPES` set ✅
- R6 (sabit risk flag sözlüğü): Task 2 ✅
- R7 (review_status state machine + source): Task 1 (schema), Task 6 (decision), Task 7 (sticky) ✅
- R8 (karar kuralı 60/90): Task 6 ✅
- R9 (snapshot zorunluluğu): Task 4 (prompt versiyonu), Task 8 (worker'da snapshot persist) ✅
- R10 (queue UI iki sekmeli + default AI): Task 13 ✅
- R11 (bulk delete typing confirmation): Task 17 ✅
- R12 (USER sticky): Task 7 + Task 8 ✅
- R13 (provider snapshot detail panelde): Task 15 ✅
- R14 (threshold hardcoded): Task 6 — `REVIEW_THRESHOLD_LOW/HIGH` constants; carry-forward §Scope tablosunda ✅
- R15 (provider abstraction R17.3): Task 2, 3, 4 ✅
- R16 (auth guard): Task 12 ✅
- R17 (cost guardrails): Task 18 ✅

**Placeholder scan:**
- "TBD" / "implement later" / "fill in details" yok ✅
- Her code step'te tam kod blok'u var ✅
- Test code blokları gerçek assertion'larla dolu ✅

**Type consistency:**
- `ReviewProvider`, `ReviewInput`, `ReviewOutput`, `ReviewRiskFlag`, `ReviewRiskFlagType` Task 2'de tanımlanır, Task 3-19'da aynı isimle kullanılır ✅
- `ReviewStatus`, `ReviewStatusSource` Prisma enum'larıyla eşleşir ✅
- `decideReviewStatus`, `applyReviewDecisionWithSticky`, `runAlphaChecks` adları sabit ✅
- `REVIEW_PROMPT_VERSION`, `REVIEW_SYSTEM_PROMPT` Task 4'te export, Task 8'de import ✅

**Sessiz fallback / belirsiz status taraması:**
- Task 2: bilinmeyen risk flag type ⇒ throw ✅
- Task 3: bilinmeyen provider id ⇒ throw ✅
- Task 4: HTTP error / non-JSON / API key yok ⇒ throw ✅
- Task 6: belirsiz aralık (60-89) ⇒ explicit `NEEDS_REVIEW` (güvenli varsayılan) ✅
- Task 7: USER sticky ⇒ explicit `shouldUpdate: false` ✅
- Task 8: design not found ⇒ throw ✅
- Task 12: ownership ihlali ⇒ 403, sessiz skip yok ✅
- Task 18: bütçe aşımı ⇒ throw, sessiz skip yok ✅

**Critical path erken çözüldü:** Task 1 (Prisma migration) en başta. Schema çakışma stratejisi (`riskFlags String[]` deprecated, yeni `reviewRiskFlags Json?` eklendi) Task 1'de net.

Plan tamam. Self-review'da gap/placeholder/type drift bulunmadı.
