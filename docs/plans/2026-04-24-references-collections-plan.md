# References + Collections Primitive Migration — Implementation Plan (T-16)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** References ve Collections ekranlarını Bookmarks (T-15) taban çizgisindeki primitive ailesine taşı; References'a collection chip filter + multi-select + bulk archive getir; Collections'ı visual-first kart anatomisine çevir; API'ye `uncategorized` sentinel ve iki aggregate sayaç ekle.

**Architecture:** 4 bağımlı commit (API → primitive → References → Collections) + 1 bağımsız follow-up docs commit'i. Her commit TDD ile ilerler; fail → implement → pass → commit. Bookmarks pattern'ine birebir uyum; primitive seti genişletilmez (sadece `CollectionThumb` yeni). İki ekran da Layout band'de kalır.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma, Zod, React Query, Tailwind (token-bound, arbitrary değer yok), Vitest + Testing Library, Radix Dialog (ConfirmDialog altında).

**Spec kaynağı:** [`docs/plans/2026-04-24-references-collections-design.md`](2026-04-24-references-collections-design.md) — bu plan spec'e birebir bağlı. Çatışma olursa spec kazanır.

---

## Commit Haritası ve Bağımlılık

| # | Commit | Tür | Bağımlılık | Dosya sayısı |
|---|---|---|---|---|
| 1 | `feat(api): references uncategorized sentinel + collections aggregate counts` | API | — | 4 kaynak + 3 test |
| 2 | `feat(ui): add CollectionThumb primitive` | Primitive | — | 1 kaynak + 1 test |
| 3 | `refactor(references): primitive migration + chip filter + multi-select` | Ekran | 1 | 3 kaynak + 2 test |
| 4 | `refactor(collections): primitive migration + visual-first card` | Ekran | 1, 2 | 3 kaynak + 2 test |
| 5 | `docs: add 4 follow-up notes (T-17 roadmap + bulk-move + product-type-filter + orphan-references)` | Docs | — | 4 markdown |

**Landing sırası:** 1 → 2 → 3 → 4 → 5. Commit 2 API'ya bağımlı değil, 1'den önce/paralel gidebilir ama SDD iki aşamalı review akışında sıra sabitlenmiştir.

---

## Reuse Edilecek Mevcut Bileşenler

Bu plan **yeni primitive yazmıyor** (tek istisna `CollectionThumb`). Aşağıdaki bileşenler birebir reuse edilir, import yolları aynı:

**UI primitive'leri (zaten mevcut, tüketim):**
- `src/components/ui/Toolbar.tsx` — `<Toolbar leading trailing>` + children FilterBar
- `src/components/ui/FilterBar.tsx` — chip satırı container'ı
- `src/components/ui/Chip.tsx` — `active`, `onToggle` props
- `src/components/ui/BulkActionBar.tsx` — `selectedCount`, `label`, `actions`, `onDismiss`
- `src/components/ui/Card.tsx` — `variant="asset"`, `interactive`, `selected` props; `AssetCardMeta` subcomponent
- `src/components/ui/Badge.tsx` — `tone="neutral" | "accent" | "success"`
- `src/components/ui/Button.tsx` — `variant`, `size`, `icon`, `disabled`
- `src/components/ui/Input.tsx` — `prefix` slot
- `src/components/ui/StateMessage.tsx` — `tone`, `title`, `body`, `icon`, `action`
- `src/components/ui/Skeleton.tsx` (`SkeletonCardGrid`) — `count` prop
- `src/components/ui/AssetImage.tsx` — `assetId`, `alt` props; `/api/assets/:id/url` üzerinden URL çözümü
- `src/components/ui/confirm-dialog.tsx` (`ConfirmDialog`) — preset spread + `onConfirm` + `busy` + `errorMessage`
- `src/components/ui/use-confirm.ts` (`useConfirm`) — `{ confirm, close, run, state }`
- `src/components/ui/confirm-presets.ts` — `archiveReference`, `archiveCollection` **mevcut** (Commit 3 ve 4'te body metni güncellenir); `archiveReferencesBulk` **yeni eklenecek**

**Feature katmanı (kısmi reuse):**
- `src/features/references/components/reference-card.tsx` — **rewrite**; eski sürüm tamamen değişir, asset-variant card anatomisine geçer
- `src/features/collections/components/collection-card.tsx` — **rewrite**; visual-first anatomi + `CollectionThumb`
- `src/features/collections/components/collection-create-dialog.tsx` — **aynı kalır**, sadece `?intent=create` URL intent ile de açılır
- `src/features/bookmarks/components/bookmarks-page.tsx` — **dokunulmaz**, pattern şablonu olarak References'a kopyalanır

**Servis / API (kısmi reuse):**
- `src/features/references/services/reference-service.ts` — `listReferences` sentinel mantığıyla genişletilir (Commit 1)
- `src/features/collections/services/collection-service.ts` — `listCollectionsWithStats` yeni export (Commit 1)
- `src/app/api/collections/route.ts` — GET handler yeni service'i çağırır (Commit 1)
- `src/features/references/schemas/index.ts` — `listReferencesQuery.collectionId` şeması daraltılır (Commit 1)
- `src/app/api/references/route.ts` — **dokunulmaz**, schema zaten orada parse edilir

**Test altyapısı (reuse):**
- `tests/unit/bookmarks-page.test.tsx` — `wrapper`, `mockFetch`, `matchMedia` helper'ları **kopyalanır** (References ve Collections testlerine)
- `tests/unit/bookmarks-confirm-flow.test.tsx` — hata akışı şablonu (gerekirse References bulk hatasına benzetilir; bu tur dışında)

---

## Carry-Forward Notları (Implementation Sırasında Mutlaka Aklında Tut)

Plan yazılırken tespit edilen ve implementer'ın gözünden kaçırmaması gereken gerçekler:

1. **`confirm-presets.ts` field adı: `description`, `body` DEĞİL.** Spec bazı yerlerde `body:` yazıyor; gerçek kod ve tüm mevcut preset'ler `description:` kullanıyor. Plan'daki kod blokları bu gerçekle hizalıdır. **`body` yazma — `description` yaz.**
2. **`cancelLabel: "Vazgeç"` zorunlu alandır.** `ConfirmPresetValue` tipi bu alanı required işaretliyor; eksik bırakırsan TS derlenmez.
3. **`archiveReference` ve `archiveCollection` preset'leri MEVCUT.** Yeni eklemiyorsun; body metnini güncelliyorsun (References: bugünkü cümle zaten kabul edilebilir → minimal değişiklik; Collections: mevcut cümle `"koleksiyon bağlantısı kopar"` diyor ki **yanlış** — soft-delete cascade yapmıyor. Commit 4'te bu cümle `"silinmez; ama bu koleksiyon filtresi altında artık görünmez"` olarak değişir).
4. **`archiveReferencesBulk` YENİ.** Tamamen eklenir, çakışma yok.
5. **`/api/collections` GET response'u zaten `{ items }` sarmalıyor.** Spec'in "breaking change" endişesi yok; sadece iki alan eklenir (`uncategorizedReferenceCount`, `orphanedReferenceCount`). `CollectionPicker` tüketicisi `data.items` kullanıyor, etkilenmez.
6. **`listReferences` orphan referansları listeden dışlamaz.** Koleksiyonu soft-delete edilen ama kendisi aktif referans listede görünmeye devam eder. Bu karar bilinçlidir (Follow-up 4); `Tümü · N` formülü bu yüzden `orphanedReferenceCount`'u da toplamaya dahil eder.
7. **`gap-px` kullan, `gap-[1px]` YAZMA.** Token check gate `pnpm check:tokens` arbitrary Tailwind değerini fail eder. Bu tüm yeni kod için geçerli.
8. **2–3 asset'te mosaic YOK.** `CollectionThumb` davranış matrisinde 2–3 asset tek büyük görsele düşer. Yarım mosaic render etme.
9. **Multi-select Collections'ta YOK.** Bookmarks/References pattern'ine benzer görünse de koleksiyonlar global yapı; `selectedIds` state'i eklenmez.
10. **URL intent `?intent=create`** Collections ekranında sadece ilk render'da tetiklenir; dialog açıldıktan sonra `router.replace("/collections")` ile URL temizlenir. Aksi halde dialog kapansa bile `intent` kalır ve sonraki navigasyonda tekrar açılır.
11. **`thumbnailAssetIds` tüm katmanlarda opsiyonel.** API tipinde yok, `CollectionLite` page tipinde `?: string[]`, `CollectionCard` props'ta `?: string[]`. Kullanım noktasında `collection.thumbnailAssetIds ?? []` normalize edilir. T-17'de opsiyonel işareti tüm katmanlarda aynı anda kaldırılır.
12. **Chip sayaç invalidate:** References `archiveMutation.onSuccess` iki query'yi de invalidate etmeli: `["references"]` VE `["collections", { kind: "REFERENCE" }]`. Aksi halde chip sayaçları canlı kalmaz.
13. **`next/navigation.useRouter` iki ekran testinde de mock gerekir.** References testi `push` izler, Collections testi hem `push` hem `replace` izler.
14. **`window.location.search` Collections testinde `Object.defineProperty` ile mock'lanır** (senaryo 8: `?intent=create`). Diğer senaryolarda temiz URL.

---

## Test Stratejisi — Commit-Test Eşlemesi

| Test dosyası | Commit | Tür | Çalıştırma komutu |
|---|---|---|---|
| `tests/unit/references-query-schema.test.ts` | 1 | Schema unit (yeni) | `pnpm vitest run tests/unit/references-query-schema.test.ts` |
| `tests/unit/references-service.test.ts` | 1 | Service integration (yeni veya genişlet) | `pnpm vitest run tests/unit/references-service.test.ts` |
| `tests/unit/collection-service-stats.test.ts` | 1 | Service integration (yeni) | `pnpm vitest run tests/unit/collection-service-stats.test.ts` |
| `tests/unit/collection-thumb.test.tsx` | 2 | Component unit (yeni) | `pnpm vitest run tests/unit/collection-thumb.test.tsx` |
| `tests/unit/confirm-presets.test.ts` | 3, 4 | Preset content (genişlet) | `pnpm vitest run tests/unit/confirm-presets.test.ts` |
| `tests/unit/references-page.test.tsx` | 3 | Page integration (yeni) | `pnpm vitest run tests/unit/references-page.test.tsx` |
| `tests/unit/collections-page.test.tsx` | 4 | Page integration (yeni) | `pnpm vitest run tests/unit/collections-page.test.tsx` |

**Her commit öncesi tam suite:** `pnpm vitest run` — mevcut Bookmarks + genel testler regression için yeşil kalmalı.

---

## Quality Gates (Her Commit İçin 4 Kapı)

Bir commit kapanmadan önce bu 4 kapı yeşil olmalı:

1. **Code quality:**
   - `pnpm lint` → temiz
   - `pnpm typecheck` → temiz
   - `pnpm check:tokens` → arbitrary Tailwind değeri yok
2. **Behavior:** Commit'in test dosyaları + tam suite (`pnpm vitest run`) yeşil
3. **Spec match:** Commit'in davranışı [`docs/plans/2026-04-24-references-collections-design.md`](2026-04-24-references-collections-design.md) ilgili bölümüyle bire bir; SDD spec-reviewer bu aşamada sign-off verir
4. **Data isolation:** Tüm servis çağrıları `userId` bağlamında; arşiv/delete yolları `assertOwnsResource` kullanır; yeni endpoint ya da route bu pattern'den sapmaz

Bir kapı fail olursa implementer düzeltir, re-review'e girer. Spec-reviewer yeşil olmadan code-quality-reviewer başlamaz.

---

## Risk Matrisi

| Commit | Risk | Şiddet | Mitigation |
|---|---|---|---|
| 1 | `listCollectionsWithStats` iki count query'si çekilirse N+1 değil ama extra latency | Orta | İki `db.reference.count` çağrısı paralel değil sıralı; sayım işlemi O(1) indexed — profile et, gerekirse `Promise.all` |
| 1 | Mevcut `CollectionPicker` tüketicisi response shape değişikliğinden etkilenir mi? | Düşük | Ek alan eklendi, `items` aynı; mevcut kullanım noktası zaten `data.items` üzerinden gidiyor (spec Bölüm 3.3 kontrol edildi). Yine de testle regression doğrula |
| 1 | Zod union daraltması mevcut istemcileri kırar mı? | Düşük | Sadece invalid string'ler artık 400 döner; geçerli cuid'ler etkilenmez. UI'da `collectionId` query param'ını yalnız chip akışı set ediyor |
| 2 | `AssetImage` mosaic içinde 4 kez fetch → ağ pik | Düşük | Test 4. senaryoda fetch sayısı doğrulanır; prod'da React Query asset URL cache'i var |
| 2 | `aspect-video` 16/9 yerine farklı oran beklenirse | Düşük | Spec kilitli; 16/9 kabul. Test buna göre |
| 3 | `invalidateQueries({ queryKey: ["collections", { kind: "REFERENCE" }] })` referanslar sayfasından chip bar'ı yeniden fetch'ler; stale count gösterimi | Orta | Mutation `onSuccess`'inde iki invalidate çağrısı; testte queryKey match'i doğrula |
| 3 | Orphan referanslar `Tümü · N`'de sayılır ama listede görünür → kullanıcı "neden 3 seçtim 2 yazıyor?" demez; ama Follow-up 4'te değişecek | Düşük | Spec Bölüm 5.1 gerekçesi commit mesajında; Follow-up 4 not edildi |
| 3 | `useRouter` mock'u SSR ortamında `window` erişimini bozabilir | Düşük | `typeof window === "undefined"` guard Collections ekranında var; References'ta `router.push` Client side çağrılır |
| 4 | `?intent=create` effect ilk render'dan sonra tetiklendiğinde `router.replace` yeniden render tetikler | Düşük | Effect guard'ı: `params.get("intent") === "create"` koşulu ikinci render'da false olur (URL temizlendi) |
| 4 | `archiveCollection` body metni değişirse mevcut Collections ekranında preset tüketiciler etkilenir | Düşük | Aynı ekran preset'i tek tüketici; Commit 4 içinde hem preset hem ekran aynı anda değişir |
| 4 | Yanlışlıkla `CollectionCard` tipine `thumbnailAssetIds` required eklenir → T-17'ye kadar tüm kartlar `undefined` → TS hatası | Orta | Her katmanda `?: string[]` + `?? []` normalize; plan bu gerçeği 4 yerde tekrarlar |
| 5 | Follow-up dosyalar iç link'lerle çapraz referans verir; dosya adları değişirse kırılır | Düşük | Tüm dosya adları bu planda sabittir; commit 5 tek atomik değişiklik |

---

# Task Breakdown

## Commit 1: API Sözleşme Değişiklikleri

**Hedef:** `listReferencesQuery.collectionId` şemasını daraltmak; `listReferences` sentinel mantığını eklemek; `listCollectionsWithStats` export'unu eklemek; API route'u bu servis'e yönlendirmek.

**Files:**
- Modify: `src/features/references/schemas/index.ts:29-35`
- Modify: `src/features/references/services/reference-service.ts:12-52`
- Modify: `src/features/collections/services/collection-service.ts:36-65`
- Modify: `src/app/api/collections/route.ts` (GET handler)
- Test: `tests/unit/references-query-schema.test.ts` (yeni)
- Test: `tests/unit/references-service.test.ts` (yeni — sentinel Prisma where clause)
- Test: `tests/unit/collection-service-stats.test.ts` (yeni — aggregate sayım)

**Risks (bu commit):**
- Mevcut `CollectionPicker` response shape etkilenmesi (düşük — `items` korunuyor)
- İki count query latency (orta — paralel hale gelebilir)
- Zod daraltma invalid string'leri 400'e çeviriyor (düşük — UI yalnız sentinel veya cuid set eder)

**Quality gates (bu commit):**
- `pnpm lint`, `pnpm typecheck`, `pnpm check:tokens` yeşil
- 3 yeni test dosyası + tam `pnpm vitest run` yeşil
- Spec Bölüm 3.1 / 3.2 / 3.3 ile davranış birebir
- `userId` scoping tüm yeni count sorgularında var

---

### Task 1.1: `listReferencesQuery.collectionId` şemasını daralt

- [ ] **Step 1: Failing test yaz**

File: `tests/unit/references-query-schema.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { listReferencesQuery } from "@/features/references/schemas";

describe("listReferencesQuery.collectionId", () => {
  it("accepts 'uncategorized' sentinel", () => {
    const result = listReferencesQuery.safeParse({ collectionId: "uncategorized" });
    expect(result.success).toBe(true);
  });

  it("accepts valid cuid", () => {
    const result = listReferencesQuery.safeParse({
      collectionId: "cksnbp3sf0000abcdzxvmn123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects random non-cuid string", () => {
    const result = listReferencesQuery.safeParse({ collectionId: "hello-world" });
    expect(result.success).toBe(false);
  });

  it("accepts undefined (omitted)", () => {
    const result = listReferencesQuery.safeParse({});
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `pnpm vitest run tests/unit/references-query-schema.test.ts`
Expected: "rejects random non-cuid string" FAILs (mevcut şema her string'i kabul ediyor).

- [ ] **Step 3: Schema'yı daralt**

File: `src/features/references/schemas/index.ts` — `listReferencesQuery` içindeki `collectionId` satırını güncelle:

```ts
export const listReferencesQuery = z.object({
  productTypeId: z.string().optional(),
  collectionId: z
    .union([z.literal("uncategorized"), z.string().cuid()])
    .optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(60),
  cursor: z.string().optional(),
});
```

- [ ] **Step 4: Run test — pass**

Run: `pnpm vitest run tests/unit/references-query-schema.test.ts`
Expected: 4/4 PASS.

---

### Task 1.2: `listReferences` sentinel mantığı

- [ ] **Step 1: Failing test yaz**

File: `tests/unit/references-service.test.ts` (yeni veya mevcut genişletme)

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/db", () => ({
  db: {
    reference: { findMany: vi.fn() },
  },
}));

import { db } from "@/server/db";
import { listReferences } from "@/features/references/services/reference-service";

describe("listReferences — collectionId sentinel", () => {
  beforeEach(() => {
    vi.mocked(db.reference.findMany).mockResolvedValue([]);
  });

  it("undefined → where.collectionId omitted", async () => {
    await listReferences({ userId: "u1", query: { limit: 60 } });
    const call = vi.mocked(db.reference.findMany).mock.calls[0]![0];
    expect(call.where).not.toHaveProperty("collectionId");
  });

  it("'uncategorized' → where.collectionId = null", async () => {
    await listReferences({
      userId: "u1",
      query: { limit: 60, collectionId: "uncategorized" },
    });
    const call = vi.mocked(db.reference.findMany).mock.calls[0]![0];
    expect(call.where.collectionId).toBeNull();
  });

  it("cuid → where.collectionId = <cuid>", async () => {
    await listReferences({
      userId: "u1",
      query: { limit: 60, collectionId: "cksnbp3sf0000abcdzxvmn123" },
    });
    const call = vi.mocked(db.reference.findMany).mock.calls[0]![0];
    expect(call.where.collectionId).toBe("cksnbp3sf0000abcdzxvmn123");
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run tests/unit/references-service.test.ts`
Expected: "uncategorized → where.collectionId = null" FAILs (mevcut kod `{ collectionId: "uncategorized" }` yazıyor, string olarak geçiyor).

- [ ] **Step 3: Service'te sentinel'i çöz**

File: `src/features/references/services/reference-service.ts` — `listReferences` içindeki `where` tanımını güncelle:

```ts
const where: Prisma.ReferenceWhereInput = {
  userId,
  deletedAt: null,
  ...(productTypeId ? { productTypeId } : {}),
  ...(collectionId === "uncategorized"
    ? { collectionId: null }
    : collectionId
      ? { collectionId }
      : {}),
  ...(q
    ? {
        OR: [
          { notes: { contains: q, mode: "insensitive" } },
        ],
      }
    : {}),
};
```

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run tests/unit/references-service.test.ts`
Expected: 3/3 PASS.

---

### Task 1.3: `listCollectionsWithStats` export'u

- [ ] **Step 1: Failing test yaz**

File: `tests/unit/collection-service-stats.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/db", () => ({
  db: {
    collection: { findMany: vi.fn() },
    reference: { count: vi.fn() },
  },
}));

import { db } from "@/server/db";
import { listCollectionsWithStats } from "@/features/collections/services/collection-service";

describe("listCollectionsWithStats", () => {
  beforeEach(() => {
    vi.mocked(db.collection.findMany).mockResolvedValue([]);
    vi.mocked(db.reference.count).mockReset();
  });

  it("counts uncategorizedReferenceCount with collectionId: null", async () => {
    vi.mocked(db.reference.count)
      .mockResolvedValueOnce(4) // uncategorized
      .mockResolvedValueOnce(0); // orphan

    await listCollectionsWithStats({
      userId: "u1",
      query: { limit: 60 },
    });

    const firstCountCall = vi.mocked(db.reference.count).mock.calls[0]![0];
    expect(firstCountCall.where).toMatchObject({
      userId: "u1",
      deletedAt: null,
      collectionId: null,
    });
  });

  it("counts orphanedReferenceCount with collection.deletedAt not null", async () => {
    vi.mocked(db.reference.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2);

    await listCollectionsWithStats({
      userId: "u1",
      query: { limit: 60 },
    });

    const secondCountCall = vi.mocked(db.reference.count).mock.calls[1]![0];
    expect(secondCountCall.where).toMatchObject({
      userId: "u1",
      deletedAt: null,
      collectionId: { not: null },
      collection: { deletedAt: { not: null } },
    });
  });

  it("returns items + both aggregate counts", async () => {
    vi.mocked(db.collection.findMany).mockResolvedValue([
      { id: "c1", name: "A", _count: { bookmarks: 0, references: 3 } } as never,
    ]);
    vi.mocked(db.reference.count)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);

    const result = await listCollectionsWithStats({
      userId: "u1",
      query: { limit: 60 },
    });

    expect(result.items).toHaveLength(1);
    expect(result.uncategorizedReferenceCount).toBe(4);
    expect(result.orphanedReferenceCount).toBe(2);
  });

  it("aggregate counts ignore kind and q filters", async () => {
    vi.mocked(db.reference.count).mockResolvedValue(0);

    await listCollectionsWithStats({
      userId: "u1",
      query: { limit: 60, kind: "REFERENCE", q: "search" },
    });

    const firstCountCall = vi.mocked(db.reference.count).mock.calls[0]![0];
    expect(firstCountCall.where).not.toHaveProperty("kind");
    expect(firstCountCall.where).not.toHaveProperty("q");
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run tests/unit/collection-service-stats.test.ts`
Expected: import FAILs (`listCollectionsWithStats` henüz export edilmedi).

- [ ] **Step 3: `listCollectionsWithStats` ekle**

File: `src/features/collections/services/collection-service.ts` — dosya sonuna ekle:

```ts
export async function listCollectionsWithStats(args: {
  userId: string;
  query: ListCollectionsQuery;
}) {
  const items = await listCollections(args);

  const uncategorizedReferenceCount = await db.reference.count({
    where: {
      userId: args.userId,
      deletedAt: null,
      collectionId: null,
    },
  });

  const orphanedReferenceCount = await db.reference.count({
    where: {
      userId: args.userId,
      deletedAt: null,
      collectionId: { not: null },
      collection: { deletedAt: { not: null } },
    },
  });

  return { items, uncategorizedReferenceCount, orphanedReferenceCount };
}
```

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run tests/unit/collection-service-stats.test.ts`
Expected: 4/4 PASS.

---

### Task 1.4: API route'u yeni service'e yönlendir

- [ ] **Step 1: Mevcut route'u oku**

Read: `src/app/api/collections/route.ts` — GET handler'da `listCollections` çağrısını bul.

- [ ] **Step 2: Handler'ı güncelle**

File: `src/app/api/collections/route.ts` — GET handler içinde:

```ts
// Önce:
const items = await listCollections({ userId: user.id, query: parsed.data });
return NextResponse.json({ items });

// Sonra:
const result = await listCollectionsWithStats({
  userId: user.id,
  query: parsed.data,
});
return NextResponse.json(result);
```

Import satırını güncelle:
```ts
import {
  listCollectionsWithStats,
} from "@/features/collections/services/collection-service";
```

- [ ] **Step 3: Typecheck + tam suite**

Run: `pnpm typecheck && pnpm vitest run`
Expected: tüm testler yeşil. `CollectionPicker` tüketicisi `data.items` kullandığı için kırılmaz.

---

### Task 1.5: Quality gates ve commit

- [ ] **Step 1: Gate'leri çalıştır**

Run:
```
pnpm lint
pnpm typecheck
pnpm check:tokens
pnpm vitest run
```
Hepsi yeşil olmalı.

- [ ] **Step 2: Commit**

```bash
git add \
  src/features/references/schemas/index.ts \
  src/features/references/services/reference-service.ts \
  src/features/collections/services/collection-service.ts \
  src/app/api/collections/route.ts \
  tests/unit/references-query-schema.test.ts \
  tests/unit/references-service.test.ts \
  tests/unit/collection-service-stats.test.ts
git commit -m "$(cat <<'EOF'
feat(api): references uncategorized sentinel + collections aggregate counts

- listReferencesQuery.collectionId şemasını z.union([literal("uncategorized"), cuid]) olarak daralt
- listReferences sentinel'i where.collectionId = null eşleşmesine çevir
- /api/collections response'una iki global alan ekle (filtre-bağımsız):
  - uncategorizedReferenceCount: collectionId = null olan aktif referanslar
  - orphanedReferenceCount: collection soft-delete olmuş ama referans hâlâ aktif
- Aggregate'ler service tarafında hesaplanıyor (listCollectionsWithStats)

References sayfası için "Koleksiyonsuz · N" chip'ine gerçek veri sağlar ve
"Tümü · N" sayacının orphan referansları da kapsamasını mümkün kılar. Mevcut
CollectionPicker tüketicisi etkilenmez (backward-compatible extension).
EOF
)"
```

---

## Commit 2: CollectionThumb Primitive

**Hedef:** Mosaic-ready thumbnail primitive'i; bugün placeholder, T-17'de dolacak.

**Files:**
- Create: `src/components/ui/CollectionThumb.tsx`
- Test: `tests/unit/collection-thumb.test.tsx`

**Risks (bu commit):**
- Mosaic 4 asset paralel fetch → ağ pik (düşük — cache var)
- Aspect oran kararı (düşük — spec 16/9 sabitliyor)

**Quality gates (bu commit):**
- `pnpm lint`, `pnpm typecheck`, `pnpm check:tokens` yeşil
- 4 senaryo test yeşil
- Spec Bölüm 4 davranış matrisine birebir uyum
- Arbitrary Tailwind değeri yok (`gap-px`, `aspect-video`)

---

### Task 2.1: CollectionThumb primitive'i yaz

- [ ] **Step 1: Failing test yaz**

File: `tests/unit/collection-thumb.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CollectionThumb } from "@/components/ui/CollectionThumb";

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/assets/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ url: "https://example.com/img.jpg" }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }),
  );
});

describe("CollectionThumb", () => {
  it("0 asset → placeholder render", () => {
    render(<CollectionThumb assetIds={[]} alt="Koleksiyon" />);
    expect(screen.getByTestId("collection-thumb-placeholder")).toBeInTheDocument();
  });

  it("1 asset → tek AssetImage, mosaic YOK", () => {
    render(<CollectionThumb assetIds={["a1"]} alt="Koleksiyon" />);
    expect(screen.queryByTestId("collection-thumb-mosaic")).not.toBeInTheDocument();
    expect(screen.queryByTestId("collection-thumb-placeholder")).not.toBeInTheDocument();
  });

  it("3 asset → single fallback (mosaic YOK)", () => {
    render(<CollectionThumb assetIds={["a1", "a2", "a3"]} alt="Koleksiyon" />);
    expect(screen.queryByTestId("collection-thumb-mosaic")).not.toBeInTheDocument();
    expect(screen.queryByTestId("collection-thumb-placeholder")).not.toBeInTheDocument();
  });

  it("5 asset → 2×2 mosaic, ilk 4 AssetImage fetch'lenir", async () => {
    render(
      <CollectionThumb
        assetIds={["a1", "a2", "a3", "a4", "a5"]}
        alt="Koleksiyon"
      />,
    );
    expect(screen.getByTestId("collection-thumb-mosaic")).toBeInTheDocument();
    // AssetImage fetch URL'leri ilk 4 için çağrılmalı; 5. atılmalı
    const fetchMock = vi.mocked(global.fetch);
    // Fetch effect'leri React tick'te gelir; en az 4 asset URL çağrısı
    const calls = fetchMock.mock.calls.map((c) => String(c[0]));
    // Bu test componentin AssetImage'ı 4 kez render ettiğini dolaylı doğrular;
    // kesin sayım için getAllByRole("img") toString'e başvurmak yerine
    // testid'li 4 slot kontrol edilir:
    const mosaic = screen.getByTestId("collection-thumb-mosaic");
    expect(mosaic.children.length).toBe(4);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run tests/unit/collection-thumb.test.tsx`
Expected: import FAILs (`CollectionThumb` yok).

- [ ] **Step 3: Primitive'i yaz**

File: `src/components/ui/CollectionThumb.tsx`

```tsx
import { Folder } from "lucide-react";
import { AssetImage } from "@/components/ui/AssetImage";
import { cn } from "@/lib/cn";

export interface CollectionThumbProps {
  assetIds: string[];
  alt?: string;
  className?: string;
}

export function CollectionThumb({
  assetIds,
  alt,
  className,
}: CollectionThumbProps) {
  if (assetIds.length === 0) {
    return (
      <div
        data-testid="collection-thumb-placeholder"
        className={cn(
          "flex aspect-video items-center justify-center rounded-md border border-border-subtle bg-surface-muted text-text-subtle",
          className,
        )}
        aria-label={alt}
      >
        <Folder className="h-8 w-8" aria-hidden />
      </div>
    );
  }

  if (assetIds.length < 4) {
    const first = assetIds[0]!;
    return (
      <div className={cn("aspect-video overflow-hidden rounded-md", className)}>
        <AssetImage
          assetId={first}
          alt={alt ?? ""}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  const slots = assetIds.slice(0, 4);
  return (
    <div
      data-testid="collection-thumb-mosaic"
      className={cn(
        "grid aspect-video grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-md bg-border-subtle",
        className,
      )}
      aria-label={alt}
    >
      {slots.map((id) => (
        <AssetImage
          key={id}
          assetId={id}
          alt=""
          className="h-full w-full object-cover"
        />
      ))}
    </div>
  );
}
```

**Not:** `cn` helper'ı `src/lib/cn.ts`'de mevcut; değilse `clsx` veya inline template literal kullan. `AssetImage` mevcut primitive; `className` prop'u destekliyorsa yukarıdaki gibi; yoksa sarmalayıcı `<div>` ile boyut kontrolü ver.

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run tests/unit/collection-thumb.test.tsx`
Expected: 4/4 PASS.

---

### Task 2.2: Quality gates ve commit

- [ ] **Step 1: Gate'leri çalıştır**

Run:
```
pnpm lint
pnpm typecheck
pnpm check:tokens
pnpm vitest run
```

- [ ] **Step 2: Commit**

```bash
git add \
  src/components/ui/CollectionThumb.tsx \
  tests/unit/collection-thumb.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add CollectionThumb primitive

- Davranış matrisi: 0 → placeholder (folder icon), 1–3 → tek AssetImage (single fallback), 4+ → 2x2 mosaic
- aspect-video (16/9), gap-px, grid-cols-2/grid-rows-2 — named utility'ler, arbitrary yok
- assetIds 4'ten fazlaysa ilk 4 alınır, gerisi atılır
- className prop'u dış kompozisyon için açık

T-17'de backend `thumbnailAssetIds` aggregate'i geldiğinde bu primitive'in
sözleşmesi değişmez; dolu array mosaic'e dönüşür, CollectionCard dokunulmaz.
EOF
)"
```

---

## Commit 3: References Sayfa Migrasyonu

**Hedef:** ReferencesPage'i Bookmarks pattern'ine taşımak; collection chip filter + multi-select + bulk archive; `archiveReferencesBulk` preset'ini eklemek; ReferenceCard'ı asset variant kompozisyonuna çevirmek.

**Files:**
- Rewrite: `src/features/references/components/references-page.tsx`
- Rewrite: `src/features/references/components/reference-card.tsx`
- Modify: `src/components/ui/confirm-presets.ts` — `archiveReferencesBulk` **yeni**, `archiveReference` minimal cümle güncellemesi
- Modify: `tests/unit/confirm-presets.test.ts` — yeni preset assertion
- Test: `tests/unit/references-page.test.tsx` (yeni)

**Risks (bu commit):**
- `invalidateQueries` iki queryKey — stale chip sayaçları (orta)
- Orphan referanslar listede görünmeye devam eder (düşük — Follow-up 4)
- `useRouter` mock konfigürasyonu (düşük)

**Quality gates (bu commit):**
- `pnpm lint`, `pnpm typecheck`, `pnpm check:tokens` yeşil
- 10 senaryo test + preset test + tam suite yeşil
- Spec Bölüm 5 davranış birebir
- `archiveMutation` user context'te çalışır (mevcut endpoint değişmiyor; isolation korunuyor)

---

### Task 3.1: `archiveReferencesBulk` preset'ini ekle

- [ ] **Step 1: Failing preset test yaz**

File: `tests/unit/confirm-presets.test.ts` — dosyayı aç, aşağıdaki test'i ekle (mevcut describe içinde veya yeni describe ile):

```ts
import { describe, it, expect } from "vitest";
import { confirmPresets } from "@/components/ui/confirm-presets";

describe("confirmPresets.archiveReferencesBulk", () => {
  it("count'u description'a koyar", () => {
    const p = confirmPresets.archiveReferencesBulk(3);
    expect(p.title).toBe("Seçili referansları arşivle");
    expect(p.description).toMatch(/3 referans arşivlenecek/);
    expect(p.confirmLabel).toBe("Arşivle");
    expect(p.cancelLabel).toBe("Vazgeç");
    expect(p.tone).toBe("destructive");
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run tests/unit/confirm-presets.test.ts`
Expected: `archiveReferencesBulk is not a function`.

- [ ] **Step 3: Preset'i ekle**

File: `src/components/ui/confirm-presets.ts` — `archiveReference` preset'inden sonra:

```ts
archiveReferencesBulk: (count: number): ConfirmPresetValue => ({
  title: "Seçili referansları arşivle",
  description: `${count} referans arşivlenecek. Reference Board'dan kaldırılırlar; üretime dahil olmazlar.`,
  confirmLabel: "Arşivle",
  cancelLabel: "Vazgeç",
  tone: "destructive",
}),
```

**Not:** Mevcut `archiveReference` preset'ini bu turda DEĞİŞTİRME — body'si zaten "Reference Board'dan kaldırılır; üretime dahil olmaz" diyor ki kabul edilebilir. Spec'in önerdiği cümle ile mevcut cümle aynı anlamı taşıyor; alışılmış cümleyi koru.

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run tests/unit/confirm-presets.test.ts`
Expected: yeni test PASS; mevcut testler de yeşil.

---

### Task 3.2: ReferenceCard'ı asset variant kompozisyonuna çevir

- [ ] **Step 1: Mevcut card'ı oku**

Read: `src/features/references/components/reference-card.tsx` — mevcut props, asset erişimi, onArchive/onSetCollection/onSetTags handler kullanımı.

- [ ] **Step 2: Rewrite — tam dosya**

File: `src/features/references/components/reference-card.tsx`

```tsx
"use client";

import { Check } from "lucide-react";
import { Card, AssetCardMeta } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AssetImage } from "@/components/ui/AssetImage";
import { cn } from "@/lib/cn";

type ReferenceLite = {
  id: string;
  notes: string | null;
  createdAt: string;
  asset: { id: string; storageKey: string; bucket: string } | null;
  productType: { id: string; displayName: string } | null;
  collection: { id: string; name: string } | null;
  bookmark: { id: string; title: string | null; sourceUrl: string | null } | null;
  tags: { tag: { id: string; name: string; color: string | null } }[];
};

export function ReferenceCard({
  reference,
  selected,
  onToggleSelect,
  onArchive,
}: {
  reference: ReferenceLite;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onArchive?: (id: string) => void;
}) {
  const title =
    reference.bookmark?.title ?? reference.bookmark?.sourceUrl ?? "Referans";
  const createdLabel = new Date(reference.createdAt).toLocaleDateString("tr-TR");
  const source = reference.bookmark?.sourceUrl
    ? new URL(reference.bookmark.sourceUrl).hostname.replace(/^www\./, "")
    : "—";

  return (
    <Card variant="asset" interactive selected={selected}>
      <div className="relative">
        {reference.asset ? (
          <AssetImage
            assetId={reference.asset.id}
            alt={title}
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="flex aspect-square items-center justify-center bg-surface-muted text-xs text-text-subtle">
            Görsel yok
          </div>
        )}
        {onToggleSelect ? (
          <button
            type="button"
            aria-label="Seç"
            aria-pressed={selected}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(reference.id);
            }}
            className={cn(
              "absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-sm border",
              selected
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-surface/80 text-text-subtle hover:text-text",
            )}
          >
            {selected ? <Check className="h-4 w-4" aria-hidden /> : null}
          </button>
        ) : null}
      </div>
      <AssetCardMeta>
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-text">
            {title}
          </h3>
          {reference.productType ? (
            <Badge tone="accent">{reference.productType.displayName}</Badge>
          ) : null}
        </div>
        <div className="text-xs text-text-subtle">
          {source} · {createdLabel}
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="truncate text-xs text-text-subtle">
            {reference.collection?.name ?? "Koleksiyon yok"}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" disabled>
              Benzerini yap
            </Button>
            {onArchive ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onArchive(reference.id)}
              >
                Arşivle
              </Button>
            ) : null}
          </div>
        </div>
      </AssetCardMeta>
    </Card>
  );
}
```

**Not:** Eski `onSetCollection` ve `onSetTags` handler'ları bu turda kaldırılır; CollectionPicker ve TagPicker reference card içinden çıkar. Parent sayfa da bu handler'ları artık geçirmez.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: yeşil. Eğer `AssetCardMeta`, `Card variant="asset" interactive selected` bookmarks card'ında nasıl import ediliyorsa aynı yoldan al.

---

### Task 3.3: ReferencesPage rewrite

- [ ] **Step 1: Failing page test yaz**

File: `tests/unit/references-page.test.tsx`

Bu test Bookmarks testinin birebir türevidir; 10 senaryo. Mock fetch helper'ı `/api/references`, `/api/collections?kind=REFERENCE`, `/api/assets/:id/url`, `/api/tags`, `/api/product-types` URL matcher'larını taşır. `next/navigation.useRouter` mock'u `push: vi.fn()` ile takip edilir.

```tsx
/**
 * references-page.test.tsx
 *
 * ReferencesPage primitive entegrasyonu — T-16 spec doğrulaması.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReferencesPage } from "@/features/references/components/references-page";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

function wrapper(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  pushMock.mockReset();
  vi.unstubAllGlobals();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function mockFetch(
  references: unknown[],
  collectionsResponse: {
    items: { id: string; name: string; _count: { references: number } }[];
    uncategorizedReferenceCount: number;
    orphanedReferenceCount: number;
  } = {
    items: [],
    uncategorizedReferenceCount: 0,
    orphanedReferenceCount: 0,
  },
) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/references")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ items: references, nextCursor: null }),
      });
    }
    if (url.startsWith("/api/collections")) {
      return Promise.resolve({ ok: true, json: async () => collectionsResponse });
    }
    if (url.includes("/api/assets/")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ url: "https://example.com/img.jpg" }),
      });
    }
    if (url.startsWith("/api/tags") || url.startsWith("/api/product-types")) {
      return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const sampleRef = (id: string, title: string) => ({
  id,
  notes: null,
  createdAt: new Date("2026-04-20").toISOString(),
  asset: { id: `asset-${id}`, storageKey: `k/${id}`, bucket: "b" },
  productType: { id: "pt", displayName: "Canvas" },
  collection: null,
  bookmark: { id: `bm-${id}`, title, sourceUrl: `https://example.com/${id}` },
  tags: [],
});

const productTypes = [{ id: "pt", displayName: "Canvas" }];

describe("ReferencesPage", () => {
  it("loading → SkeletonCardGrid (role=status)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    wrapper(<ReferencesPage productTypes={productTypes} />);
    const skeletons = await screen.findAllByRole("status");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("empty → StateMessage + Referans ekle CTA (disabled)", async () => {
    mockFetch([]);
    wrapper(<ReferencesPage productTypes={productTypes} />);
    expect(await screen.findByText("Henüz referans yok")).toBeInTheDocument();
  });

  it("default → kart başlıkları görünür, üst özet 'N referans'", async () => {
    mockFetch([sampleRef("r1", "Boho Print"), sampleRef("r2", "Çiçek")]);
    wrapper(<ReferencesPage productTypes={productTypes} />);
    expect(await screen.findByText("Boho Print")).toBeInTheDocument();
    expect(screen.getByText(/2 referans/)).toBeInTheDocument();
  });

  it("chip filter: specific cuid → fetch URL'i collectionId=<cuid> içerir", async () => {
    const fetchMock = mockFetch([sampleRef("r1", "Boho")], {
      items: [
        { id: "cksnbp3sf0000abcdzxvmn123", name: "Boho", _count: { references: 1 } },
      ],
      uncategorizedReferenceCount: 0,
      orphanedReferenceCount: 0,
    });
    wrapper(<ReferencesPage productTypes={productTypes} />);
    await screen.findByText("Boho");
    const chip = await screen.findByRole("button", { name: /Boho · 1/ });
    act(() => fireEvent.click(chip));
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes("collectionId=cksnbp3sf0000abcdzxvmn123"))).toBe(true);
    });
  });

  it("chip filter: uncategorized → fetch URL'i collectionId=uncategorized içerir", async () => {
    const fetchMock = mockFetch([], {
      items: [],
      uncategorizedReferenceCount: 4,
      orphanedReferenceCount: 0,
    });
    wrapper(<ReferencesPage productTypes={productTypes} />);
    const chip = await screen.findByRole("button", { name: /Koleksiyonsuz · 4/ });
    act(() => fireEvent.click(chip));
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes("collectionId=uncategorized"))).toBe(true);
    });
  });

  it("Tümü · N sayacı = Σ _count.references + uncategorized + orphan", async () => {
    mockFetch([], {
      items: [
        { id: "c1", name: "A", _count: { references: 3 } },
        { id: "c2", name: "B", _count: { references: 5 } },
      ],
      uncategorizedReferenceCount: 4,
      orphanedReferenceCount: 2,
    });
    wrapper(<ReferencesPage productTypes={productTypes} />);
    expect(await screen.findByRole("button", { name: /Tümü · 14/ })).toBeInTheDocument();
    // orphan için kendi chip'i YOK
    expect(screen.queryByText(/Arşivli koleksiyondan/)).not.toBeInTheDocument();
  });

  it("multi-select → BulkActionBar 'N referans seçildi' + Arşivle", async () => {
    mockFetch([sampleRef("r1", "A"), sampleRef("r2", "B")]);
    wrapper(<ReferencesPage productTypes={productTypes} />);
    await screen.findByText("A");
    const selectBtns = screen.getAllByRole("button", { name: "Seç" });
    act(() => {
      fireEvent.click(selectBtns[0]!);
      fireEvent.click(selectBtns[1]!);
    });
    const region = await screen.findByRole("region");
    expect(within(region).getByText("2 referans seçildi")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Arşivle" })).toBeInTheDocument();
  });

  it("bulk archive → dialog archiveReferencesBulk(2) preset'i gösterir", async () => {
    mockFetch([sampleRef("r1", "A"), sampleRef("r2", "B")]);
    wrapper(<ReferencesPage productTypes={productTypes} />);
    await screen.findByText("A");
    const selectBtns = screen.getAllByRole("button", { name: "Seç" });
    act(() => {
      fireEvent.click(selectBtns[0]!);
      fireEvent.click(selectBtns[1]!);
    });
    const region = await screen.findByRole("region");
    act(() => {
      fireEvent.click(within(region).getByRole("button", { name: "Arşivle" }));
    });
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Seçili referansları arşivle")).toBeInTheDocument();
    expect(within(dialog).getByText(/2 referans arşivlenecek/)).toBeInTheDocument();
  });

  it("dismiss → selection temizlenir, BulkActionBar gizlenir", async () => {
    mockFetch([sampleRef("r1", "A")]);
    wrapper(<ReferencesPage productTypes={productTypes} />);
    await screen.findByText("A");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Seç" }));
    });
    const region = await screen.findByRole("region");
    const dismiss = within(region).getByRole("button", { name: /Seçimi temizle/ });
    act(() => fireEvent.click(dismiss));
    await waitFor(() => {
      expect(screen.queryByRole("region")).not.toBeInTheDocument();
    });
  });

  it("Yeni koleksiyon → router.push('/collections?intent=create')", async () => {
    mockFetch([]);
    wrapper(<ReferencesPage productTypes={productTypes} />);
    const btn = await screen.findByRole("button", { name: /Yeni koleksiyon/ });
    act(() => fireEvent.click(btn));
    expect(pushMock).toHaveBeenCalledWith("/collections?intent=create");
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run tests/unit/references-page.test.tsx`
Expected: çoğu senaryo FAILs (mevcut sayfa chip bar, bulk action, router push içermiyor).

- [ ] **Step 3: ReferencesPage'i rewrite**

File: `src/features/references/components/references-page.tsx`

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Search, Plus, SlidersHorizontal, BookmarkIcon } from "lucide-react";
import { ReferenceCard } from "./reference-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/components/ui/use-confirm";
import { confirmPresets } from "@/components/ui/confirm-presets";
import { Toolbar } from "@/components/ui/Toolbar";
import { FilterBar } from "@/components/ui/FilterBar";
import { BulkActionBar } from "@/components/ui/BulkActionBar";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { StateMessage } from "@/components/ui/StateMessage";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";

type ReferenceLite = {
  id: string;
  notes: string | null;
  createdAt: string;
  asset: { id: string; storageKey: string; bucket: string } | null;
  productType: { id: string; displayName: string } | null;
  collection: { id: string; name: string } | null;
  bookmark: { id: string; title: string | null; sourceUrl: string | null } | null;
  tags: { tag: { id: string; name: string; color: string | null } }[];
};

type ListResponse = {
  items: ReferenceLite[];
  nextCursor: string | null;
};

type CollectionLite = {
  id: string;
  name: string;
  _count: { references: number };
  thumbnailAssetIds?: string[];
};

type CollectionsResponse = {
  items: CollectionLite[];
  uncategorizedReferenceCount: number;
  orphanedReferenceCount: number;
};

type CollectionFilter = null | "uncategorized" | string;

type ProductTypeOption = { id: string; displayName: string };

export function ReferencesPage({
  productTypes: _productTypes,
}: {
  productTypes: ProductTypeOption[];
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const { confirm, close, run, state } = useConfirm();
  const [activeCollection, setActiveCollection] =
    useState<CollectionFilter>(null);
  const [q, setQ] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const collectionsQuery = useQuery<CollectionsResponse>({
    queryKey: ["collections", { kind: "REFERENCE" }],
    queryFn: async () => {
      const res = await fetch("/api/collections?kind=REFERENCE", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Koleksiyonlar alınamadı");
      return res.json();
    },
  });

  const query = useQuery<ListResponse>({
    queryKey: ["references", activeCollection, q],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeCollection) params.set("collectionId", activeCollection);
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", "60");
      const res = await fetch(`/api/references?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Liste alınamadı");
      return res.json();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/references/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Arşivleme başarısız");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["references"] });
      qc.invalidateQueries({ queryKey: ["collections", { kind: "REFERENCE" }] });
    },
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const visibleIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const selectedCount = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)).length,
    [items, selectedIds],
  );

  const totalCount = useMemo(() => {
    if (!collectionsQuery.data) return 0;
    const sumNamed = collectionsQuery.data.items.reduce(
      (sum, c) => sum + c._count.references,
      0,
    );
    return (
      sumNamed +
      collectionsQuery.data.uncategorizedReferenceCount +
      collectionsQuery.data.orphanedReferenceCount
    );
  }, [collectionsQuery.data]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkArchive = () => {
    const targets = items.filter((i) => selectedIds.has(i.id)).map((i) => i.id);
    if (targets.length === 0) return;
    confirm(
      confirmPresets.archiveReferencesBulk(targets.length),
      async () => {
        for (const id of targets) await archiveMutation.mutateAsync(id);
        clearSelection();
      },
    );
  };

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (visibleIds.has(id)) next.add(id);
      return next;
    });
  }, [visibleIds]);

  const uncategorizedCount =
    collectionsQuery.data?.uncategorizedReferenceCount ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Referans Havuzu</h1>
          <p className="text-xs text-text-muted">
            {items.length > 0
              ? `${items.length} referans · üretime hazır kaynak havuzu`
              : "Üretime hazır kaynak havuzu"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" aria-hidden />}
            onClick={() => router.push("/collections?intent=create")}
          >
            Yeni koleksiyon
          </Button>
        </div>
      </div>

      <Toolbar
        leading={
          <div className="w-60">
            <Input
              type="search"
              placeholder="Başlık, tag veya koleksiyonda ara"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              prefix={<Search className="h-4 w-4" aria-hidden />}
            />
          </div>
        }
        trailing={
          <Button
            variant="ghost"
            size="sm"
            icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
            disabled
          >
            Filtre
          </Button>
        }
      >
        <FilterBar>
          <Chip
            active={activeCollection === null}
            onToggle={() => setActiveCollection(null)}
          >
            {`Tümü · ${totalCount}`}
          </Chip>
          {(collectionsQuery.data?.items ?? []).map((c) => (
            <Chip
              key={c.id}
              active={activeCollection === c.id}
              onToggle={() => setActiveCollection(c.id)}
            >
              {`${c.name} · ${c._count.references}`}
            </Chip>
          ))}
          {uncategorizedCount > 0 ? (
            <Chip
              active={activeCollection === "uncategorized"}
              onToggle={() => setActiveCollection("uncategorized")}
            >
              {`Koleksiyonsuz · ${uncategorizedCount}`}
            </Chip>
          ) : null}
        </FilterBar>
      </Toolbar>

      <BulkActionBar
        selectedCount={selectedCount}
        label={
          selectedCount > 0 ? `${selectedCount} referans seçildi` : undefined
        }
        actions={
          <>
            <Button variant="ghost" size="sm" disabled>
              Benzerini yap
            </Button>
            <Button variant="ghost" size="sm" disabled>
              Koleksiyona taşı
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={bulkArchive}
              disabled={archiveMutation.isPending}
            >
              Arşivle
            </Button>
          </>
        }
        onDismiss={clearSelection}
      />

      {query.isLoading ? (
        <SkeletonCardGrid count={8} />
      ) : query.error ? (
        <StateMessage
          tone="error"
          title="Liste yüklenemedi"
          body={(query.error as Error).message}
        />
      ) : items.length === 0 ? (
        <StateMessage
          tone="neutral"
          icon={<BookmarkIcon className="h-5 w-5" aria-hidden />}
          title="Henüz referans yok"
          body="Bookmark sayfasından 'Referansa Taşı' ile ekleyebilir ya da doğrudan görsel yükleyerek havuza bir referans alabilirsin."
          action={
            <Button variant="primary" disabled>
              Referans ekle
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((ref) => (
            <ReferenceCard
              key={ref.id}
              reference={ref}
              selected={selectedIds.has(ref.id)}
              onToggleSelect={toggleSelect}
              onArchive={(id) => {
                const item = items.find((r) => r.id === id);
                confirm(
                  confirmPresets.archiveReference(
                    item?.bookmark?.title ?? item?.bookmark?.sourceUrl,
                  ),
                  async () => {
                    await archiveMutation.mutateAsync(id);
                  },
                );
              }}
            />
          ))}
        </div>
      )}

      {state.preset ? (
        <ConfirmDialog
          open={state.open}
          onOpenChange={(o) => {
            if (!o) close();
          }}
          {...state.preset}
          onConfirm={run}
          busy={state.busy}
          errorMessage={state.errorMessage}
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run tests/unit/references-page.test.tsx`
Expected: 10/10 PASS. Eğer "Seçimi temizle" veya "Seç" butonu testid/label'larından biri farklı import ediliyorsa Bookmarks'taki adlandırma ile hizala (BulkActionBar primitive aynı — label'lar paylaşılıyor).

---

### Task 3.4: Quality gates + commit

- [ ] **Step 1: Tüm gate'leri çalıştır**

Run:
```
pnpm lint
pnpm typecheck
pnpm check:tokens
pnpm vitest run
```

- [ ] **Step 2: Commit**

```bash
git add \
  src/features/references/components/references-page.tsx \
  src/features/references/components/reference-card.tsx \
  src/components/ui/confirm-presets.ts \
  tests/unit/confirm-presets.test.ts \
  tests/unit/references-page.test.tsx
git commit -m "$(cat <<'EOF'
refactor(references): primitive migration + chip filter + multi-select

- ReferencesPage'i Bookmarks pattern'ine taşı: Toolbar + FilterBar + BulkActionBar + ConfirmDialog
- Collection chip bar (sayaçlı) native <select> filtresini değiştirir
- "Koleksiyonsuz · N" chip'i uncategorized sentinel ile backend'e bağlanır
- "Tümü · N" sayacı global havuz dağılımı (Σ active _count.references + uncategorizedReferenceCount + orphanedReferenceCount)
- Multi-select + bulkArchive (sequential, archiveReferencesBulk preset)
- Yeni koleksiyon butonu /collections?intent=create'e navigate eder
- ReferenceCard Card variant="asset" + interactive + selected primitive kompozisyonuna geçer
- confirmPresets.archiveReferencesBulk eklendi

Follow-up'lar: bulk Koleksiyona taşı, product type filter, mosaic backend ayrı notlarda.
EOF
)"
```

---

## Commit 4: Collections Sayfa Migrasyonu

**Hedef:** CollectionsPage'i Toolbar + FilterBar + ConfirmDialog pattern'ine taşımak; CollectionCard'ı visual-first anatomiye çevirmek (`CollectionThumb` + kind Badge + Arşivle ghost); `?intent=create` URL intent desteği; `archiveCollection` preset body'sini doğru cümleye güncellemek.

**Files:**
- Rewrite: `src/features/collections/components/collections-page.tsx`
- Rewrite: `src/features/collections/components/collection-card.tsx`
- Modify: `src/components/ui/confirm-presets.ts` — `archiveCollection` body cümlesi
- Modify: `tests/unit/confirm-presets.test.ts` — `archiveCollection` yeni cümle assertion
- Test: `tests/unit/collections-page.test.tsx` (yeni)

**Risks (bu commit):**
- `archiveCollection` body değişikliği mevcut tüketici (CollectionsPage) — aynı commit içinde değişir (düşük)
- `?intent=create` effect re-render loop (düşük — guard koşullu)
- `thumbnailAssetIds` katman tutarlılığı (orta — 4 yerde `?: string[]`)

**Quality gates (bu commit):**
- `pnpm lint`, `pnpm typecheck`, `pnpm check:tokens` yeşil
- 9 senaryo test + preset test + tam suite yeşil
- Spec Bölüm 6 birebir
- `archiveMutation` user context korunuyor (mevcut endpoint)

---

### Task 4.1: `archiveCollection` body cümlesini düzelt

- [ ] **Step 1: Failing preset test yaz**

File: `tests/unit/confirm-presets.test.ts` — ekle:

```ts
describe("confirmPresets.archiveCollection — body doğruluğu", () => {
  it("name ile: 'silinmez' ve 'bu koleksiyon filtresi altında artık görünmez' geçer", () => {
    const p = confirmPresets.archiveCollection("Nursery");
    expect(p.description).toMatch(/"Nursery"/);
    expect(p.description).toMatch(/silinmez/);
    expect(p.description).toMatch(/bu koleksiyon filtresi altında artık görünmez/);
  });

  it("name olmadan: default metin 'silinmez' + 'artık görünmez' içerir", () => {
    const p = confirmPresets.archiveCollection();
    expect(p.description).toMatch(/silinmez/);
    expect(p.description).toMatch(/artık görünmez/);
  });

  it("eski 'koleksiyon bağlantısı kopar' ifadesi KALMADI", () => {
    const p = confirmPresets.archiveCollection("X");
    expect(p.description).not.toMatch(/bağlantısı kopar/);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run tests/unit/confirm-presets.test.ts`
Expected: "eski 'koleksiyon bağlantısı kopar' ifadesi KALMADI" FAILs — mevcut body hâlâ kopar diyor.

- [ ] **Step 3: Body'yi düzelt**

File: `src/components/ui/confirm-presets.ts` — `archiveCollection` içinde description alanını değiştir:

```ts
archiveCollection: (name?: string | null): ConfirmPresetValue => ({
  title: "Koleksiyonu arşivle",
  description: name
    ? `"${name}" koleksiyonu arşivlenecek. İçindeki bookmark ve referanslar silinmez; ama bu koleksiyon filtresi altında artık görünmez.`
    : "Bu koleksiyon arşivlenecek. İçindeki bookmark ve referanslar silinmez; ama bu koleksiyon filtresi altında artık görünmez.",
  confirmLabel: "Arşivle",
  cancelLabel: "Vazgeç",
  tone: "destructive",
}),
```

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run tests/unit/confirm-presets.test.ts`
Expected: 3/3 PASS (bu describe); mevcut testler de yeşil.

---

### Task 4.2: CollectionCard'ı visual-first anatomiye çevir

- [ ] **Step 1: Mevcut card'ı oku**

Read: `src/features/collections/components/collection-card.tsx` — mevcut props ve layout.

- [ ] **Step 2: Rewrite — tam dosya**

File: `src/features/collections/components/collection-card.tsx`

```tsx
"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CollectionThumb } from "@/components/ui/CollectionThumb";

type CollectionKind = "BOOKMARK" | "REFERENCE" | "MIXED";

type CollectionLite = {
  id: string;
  name: string;
  kind: CollectionKind;
  updatedAt?: string;
  createdAt: string;
  _count: { bookmarks: number; references: number };
  thumbnailAssetIds?: string[];
};

export function CollectionCard({
  collection,
  onArchive,
}: {
  collection: CollectionLite;
  onArchive?: (id: string) => void;
}) {
  const itemCount =
    collection.kind === "REFERENCE"
      ? collection._count.references
      : collection.kind === "BOOKMARK"
        ? collection._count.bookmarks
        : collection._count.bookmarks + collection._count.references;
  const itemLabel =
    collection.kind === "BOOKMARK"
      ? "bookmark"
      : collection.kind === "REFERENCE"
        ? "referans"
        : "kayıt";
  const kindLabel =
    collection.kind === "BOOKMARK"
      ? "Bookmark"
      : collection.kind === "REFERENCE"
        ? "Referans"
        : "Karma";
  const kindTone =
    collection.kind === "BOOKMARK"
      ? "accent"
      : collection.kind === "REFERENCE"
        ? "success"
        : "neutral";
  const updated = new Date(
    collection.updatedAt ?? collection.createdAt,
  ).toLocaleDateString("tr-TR");

  return (
    <Card variant="asset" interactive>
      <CollectionThumb
        assetIds={collection.thumbnailAssetIds ?? []}
        alt={collection.name}
      />
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-text">
              {collection.name}
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-text-subtle">
              <span className="font-mono">{`${itemCount} ${itemLabel}`}</span>
              <span aria-hidden>·</span>
              <span>{updated}</span>
            </div>
          </div>
          <Badge tone={kindTone}>{kindLabel}</Badge>
        </div>
        {onArchive ? (
          <div className="flex justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onArchive(collection.id)}
            >
              Arşivle
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: yeşil. `Badge` `tone` union'ında `"neutral"` varsa MIXED için kullanılır; yoksa varsayılan değer.

---

### Task 4.3: CollectionsPage rewrite

- [ ] **Step 1: Failing page test yaz**

File: `tests/unit/collections-page.test.tsx`

```tsx
/**
 * collections-page.test.tsx
 *
 * CollectionsPage primitive entegrasyonu — T-16 spec doğrulaması.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CollectionsPage } from "@/features/collections/components/collections-page";

const pushMock = vi.fn();
const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

function wrapper(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function setLocationSearch(search: string) {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, search, pathname: "/collections" },
  });
}

beforeEach(() => {
  pushMock.mockReset();
  replaceMock.mockReset();
  setLocationSearch("");
  vi.unstubAllGlobals();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function mockFetch(items: unknown[]) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/collections")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          items,
          uncategorizedReferenceCount: 0,
          orphanedReferenceCount: 0,
        }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const sample = (id: string, name: string, kind: "BOOKMARK" | "REFERENCE" | "MIXED" = "REFERENCE") => ({
  id,
  name,
  slug: name.toLowerCase(),
  description: null,
  kind,
  createdAt: new Date("2026-04-20").toISOString(),
  updatedAt: new Date("2026-04-22").toISOString(),
  _count: { bookmarks: 0, references: 3 },
});

describe("CollectionsPage", () => {
  it("loading → SkeletonCardGrid", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    wrapper(<CollectionsPage />);
    const skeletons = await screen.findAllByRole("status");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("empty (arama yok) → 'Henüz koleksiyon yok' + CTA", async () => {
    mockFetch([]);
    wrapper(<CollectionsPage />);
    expect(await screen.findByText(/Henüz koleksiyon yok/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /İlk koleksiyonunu oluştur/ }),
    ).toBeInTheDocument();
  });

  it("empty (arama var) → 'Eşleşen koleksiyon yok'", async () => {
    mockFetch([]);
    wrapper(<CollectionsPage />);
    const input = await screen.findByPlaceholderText(/Koleksiyon ara/);
    act(() => fireEvent.change(input, { target: { value: "xyz" } }));
    await waitFor(() => {
      expect(screen.getByText(/Eşleşen koleksiyon yok/)).toBeInTheDocument();
    });
  });

  it("default → 3-col grid, kart + kind Badge + CollectionThumb placeholder", async () => {
    mockFetch([sample("c1", "Boho")]);
    wrapper(<CollectionsPage />);
    expect(await screen.findByText("Boho")).toBeInTheDocument();
    expect(screen.getByText("Referans")).toBeInTheDocument(); // Badge
    expect(screen.getByTestId("collection-thumb-placeholder")).toBeInTheDocument();
  });

  it("kind chip: Referans → fetch URL'i kind=REFERENCE içerir", async () => {
    const fetchMock = mockFetch([sample("c1", "A")]);
    wrapper(<CollectionsPage />);
    await screen.findByText("A");
    const chip = await screen.findByRole("button", { name: /^Referans$/ });
    act(() => fireEvent.click(chip));
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes("kind=REFERENCE"))).toBe(true);
    });
  });

  it("arama → fetch URL'i q=<term>", async () => {
    const fetchMock = mockFetch([]);
    wrapper(<CollectionsPage />);
    const input = await screen.findByPlaceholderText(/Koleksiyon ara/);
    act(() => fireEvent.change(input, { target: { value: "boho" } }));
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes("q=boho"))).toBe(true);
    });
  });

  it("Yeni koleksiyon butonu → dialog açılır", async () => {
    mockFetch([]);
    wrapper(<CollectionsPage />);
    const btn = await screen.findByRole("button", { name: /Yeni koleksiyon/ });
    act(() => fireEvent.click(btn));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("?intent=create URL param → ilk render'da dialog açılır + router.replace('/collections')", async () => {
    setLocationSearch("?intent=create");
    mockFetch([]);
    wrapper(<CollectionsPage />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("/collections");
  });

  it("arşivle → archiveCollection preset dialog'u + body 'silinmez'", async () => {
    mockFetch([sample("c1", "Boho")]);
    wrapper(<CollectionsPage />);
    await screen.findByText("Boho");
    const archiveBtn = screen.getByRole("button", { name: "Arşivle" });
    act(() => fireEvent.click(archiveBtn));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Koleksiyonu arşivle")).toBeInTheDocument();
    expect(within(dialog).getByText(/silinmez/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run tests/unit/collections-page.test.tsx`
Expected: çoğu senaryo FAILs (chip bar native select, URL intent desteği yok).

- [ ] **Step 3: CollectionsPage'i rewrite**

File: `src/features/collections/components/collections-page.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Search, Plus, FolderIcon } from "lucide-react";
import { CollectionCard } from "./collection-card";
import { CollectionCreateDialog } from "./collection-create-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/components/ui/use-confirm";
import { confirmPresets } from "@/components/ui/confirm-presets";
import { Toolbar } from "@/components/ui/Toolbar";
import { FilterBar } from "@/components/ui/FilterBar";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { StateMessage } from "@/components/ui/StateMessage";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";

type CollectionKind = "BOOKMARK" | "REFERENCE" | "MIXED";
type KindFilter = "ALL" | CollectionKind;

type CollectionLite = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  kind: CollectionKind;
  createdAt: string;
  updatedAt?: string;
  _count: { bookmarks: number; references: number };
  thumbnailAssetIds?: string[];
};

type ListResponse = {
  items: CollectionLite[];
  uncategorizedReferenceCount: number;
  orphanedReferenceCount: number;
};

export function CollectionsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { confirm, close, run, state } = useConfirm();
  const [kind, setKind] = useState<KindFilter>("ALL");
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("intent") === "create") {
      setCreateOpen(true);
      router.replace("/collections");
    }
  }, [router]);

  const query = useQuery<ListResponse>({
    queryKey: ["collections-all", kind, q],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (kind !== "ALL") params.set("kind", kind);
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", "60");
      const res = await fetch(`/api/collections?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Koleksiyonlar alınamadı");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      kind: CollectionKind;
    }) => {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok)
        throw new Error((await res.json()).error ?? "Koleksiyon oluşturulamadı");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections-all"] });
      qc.invalidateQueries({ queryKey: ["collections", { kind: "REFERENCE" }] });
      qc.invalidateQueries({ queryKey: ["collections", { kind: "BOOKMARK" }] });
      setCreateOpen(false);
      setCreateError(null);
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Arşivleme başarısız");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections-all"] });
      qc.invalidateQueries({ queryKey: ["collections", { kind: "REFERENCE" }] });
      qc.invalidateQueries({ queryKey: ["collections", { kind: "BOOKMARK" }] });
    },
  });

  const items = query.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Koleksiyonlar</h1>
          <p className="text-xs text-text-muted">
            Bookmark ve referansları tema/konu bazında grupla.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus className="h-4 w-4" aria-hidden />}
          onClick={() => {
            setCreateError(null);
            setCreateOpen(true);
          }}
        >
          Yeni koleksiyon
        </Button>
      </div>

      <Toolbar
        leading={
          <div className="w-60">
            <Input
              type="search"
              placeholder="Koleksiyon ara"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              prefix={<Search className="h-4 w-4" aria-hidden />}
            />
          </div>
        }
      >
        <FilterBar>
          <Chip active={kind === "ALL"} onToggle={() => setKind("ALL")}>
            Tümü
          </Chip>
          <Chip
            active={kind === "BOOKMARK"}
            onToggle={() => setKind("BOOKMARK")}
          >
            Bookmark
          </Chip>
          <Chip
            active={kind === "REFERENCE"}
            onToggle={() => setKind("REFERENCE")}
          >
            Referans
          </Chip>
        </FilterBar>
      </Toolbar>

      {query.isLoading ? (
        <SkeletonCardGrid count={6} />
      ) : query.error ? (
        <StateMessage
          tone="error"
          title="Liste yüklenemedi"
          body={(query.error as Error).message}
        />
      ) : items.length === 0 ? (
        q.trim() ? (
          <StateMessage
            tone="neutral"
            icon={<FolderIcon className="h-5 w-5" aria-hidden />}
            title="Eşleşen koleksiyon yok"
            body="Farklı bir arama terimi dene ya da yeni bir koleksiyon oluştur."
          />
        ) : (
          <StateMessage
            tone="neutral"
            icon={<FolderIcon className="h-5 w-5" aria-hidden />}
            title="Henüz koleksiyon yok"
            body="Bookmark ve referansları tema bazında grupla. İlk koleksiyonunu oluşturarak başla."
            action={
              <Button
                variant="primary"
                icon={<Plus className="h-4 w-4" aria-hidden />}
                onClick={() => {
                  setCreateError(null);
                  setCreateOpen(true);
                }}
              >
                İlk koleksiyonunu oluştur
              </Button>
            }
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <CollectionCard
              key={c.id}
              collection={c}
              onArchive={(id) => {
                const item = items.find((col) => col.id === id);
                confirm(
                  confirmPresets.archiveCollection(item?.name),
                  async () => {
                    await archiveMutation.mutateAsync(id);
                  },
                );
              }}
            />
          ))}
        </div>
      )}

      {createOpen ? (
        <CollectionCreateDialog
          busy={createMutation.isPending}
          error={createError}
          onClose={() => {
            setCreateOpen(false);
            setCreateError(null);
          }}
          onSubmit={(input) => createMutation.mutate(input)}
        />
      ) : null}

      {state.preset ? (
        <ConfirmDialog
          open={state.open}
          onOpenChange={(o) => {
            if (!o) close();
          }}
          {...state.preset}
          onConfirm={run}
          busy={state.busy}
          errorMessage={state.errorMessage}
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run tests/unit/collections-page.test.tsx`
Expected: 9/9 PASS.

---

### Task 4.4: Quality gates + commit

- [ ] **Step 1: Tüm gate'leri çalıştır**

Run:
```
pnpm lint
pnpm typecheck
pnpm check:tokens
pnpm vitest run
```

- [ ] **Step 2: Commit**

```bash
git add \
  src/features/collections/components/collections-page.tsx \
  src/features/collections/components/collection-card.tsx \
  src/components/ui/confirm-presets.ts \
  tests/unit/confirm-presets.test.ts \
  tests/unit/collections-page.test.tsx
git commit -m "$(cat <<'EOF'
refactor(collections): primitive migration + visual-first card

- CollectionsPage Toolbar + FilterBar + ConfirmDialog + useConfirm pattern'ine geçer
- Kind filter 3 Chip'e indi (Tümü/Bookmark/Referans, sayaçsız — mod anahtarı)
- CollectionCard visual-first: CollectionThumb (16:9) + title/meta/kind badge + Arşivle ghost
- thumbnailAssetIds sözleşmesi bugünden frontend tarafında (T-17'de backend dolacak)
- ?intent=create URL param desteği: References'tan "Yeni koleksiyon" navigasyonu
- confirmPresets.archiveCollection — body cümlesi gerçek soft-delete davranışını yansıtır

Multi-select bilinçli olarak eklenmedi; koleksiyon global yapı.
EOF
)"
```

---

## Commit 5: Follow-Up Notları

**Hedef:** T-17+ iş kilitlerini 4 ayrı docs dosyasına yazıp tek atomik commit'te eklemek.

**Files (tümü yeni):**
- Create: `docs/plans/collection-thumbnails-backend.md`
- Create: `docs/plans/bulk-move-to-collection.md`
- Create: `docs/plans/reference-product-type-filter.md`
- Create: `docs/plans/archived-collection-orphan-references.md`

**Risks (bu commit):** yok — sadece dokümantasyon.

**Quality gates (bu commit):** 4 dosya da geçerli markdown; spec Bölüm 9 içerikleriyle birebir.

---

### Task 5.1: 4 follow-up dosyası yaz

- [ ] **Step 1: `collection-thumbnails-backend.md` yaz**

File: `docs/plans/collection-thumbnails-backend.md`

```markdown
# Collection Thumbnails Backend (T-17)

**Tarih:** 2026-04-24
**Bağlam:** T-16 `CollectionThumb` primitive'i frontend'de sözleşmelendi ama
`thumbnailAssetIds` alanı şu an `/api/collections` response'unda yok;
tüm kartlar placeholder gösteriyor.

## Kapsam

`listCollectionsWithStats` response'undaki her `CollectionLite` öğesine
`thumbnailAssetIds: string[]` eklenecek. Kural:

- Koleksiyona bağlı en son güncellenen bookmark ve reference kayıtlarının
  asset id'leri (bookmark.assetId ?? null ile reference.assetId union'ı)
- En son 4 kayıt alınır, daha fazlası atılır
- `deletedAt: null` filtresi hem bookmark hem reference için uygulanır
- Asset yoksa kayıt atlanır (null asset'li bookmark dahil edilmez)

## Query stratejisi

İki seçenek:
1. Her collection için N+1 sorgu (basit ama yavaş)
2. `Collection` listesinde `id`'leri toplayıp tek `db.asset.findMany` +
   grup-by collection (verimli)

Öneri: 2. Prisma `include: { bookmarks: { take: 4, orderBy }, references: { take: 4, orderBy } }` ile tek round-trip.

## Sözleşme değişikliği

Tüm 4 katmanda aynı anda opsiyonel işareti kalkar:
- API response `CollectionLite.thumbnailAssetIds: string[]` (required)
- Page-level `CollectionLite` tipi
- `CollectionsResponse.items[*]`
- `CollectionCard` props

`collection.thumbnailAssetIds ?? []` normalize kullanımı silinir; doğrudan
`collection.thumbnailAssetIds` erişilir.

## Test

- `tests/unit/collection-service-stats.test.ts` — `thumbnailAssetIds` populate
  assertion (en son 4, asset'siz kayıtlar atlanır, deleted dışlanır)
- `tests/unit/collections-page.test.tsx` 4. senaryo — placeholder yerine
  mosaic (4+ asset), single (1–3 asset) kontrolleri

## Risk

- Asset join N+1 — tek sorguyla çözülmeli
- `updatedAt` Asset'te yoksa Bookmark/Reference `updatedAt` kullanılır
- Thumbnail cache invalidation — koleksiyona kayıt eklendiğinde
  `["collections-all"]` invalidate zaten var, yeterli
```

- [ ] **Step 2: `bulk-move-to-collection.md` yaz**

File: `docs/plans/bulk-move-to-collection.md`

```markdown
# Bulk Move to Collection (References)

**Tarih:** 2026-04-24
**Bağlam:** T-16 References BulkActionBar'ında `Koleksiyona taşı` aksiyonu
bilinçli olarak `disabled` bırakıldı. UI primitive kararı ertelendi.

## Kapsam

Seçili N referansı tek seferde bir koleksiyona atamak (veya Koleksiyonsuz'a
taşımak / mevcut koleksiyon bağlantısını koparmak).

## UI Önerisi: CollectionPickerDialog

Yeni primitive değil; mevcut `CollectionPicker` komponenti modal sarmalında:

- Dialog header: "N referansı taşı"
- İçerik: `CollectionPicker` + arama input'u + "Koleksiyonsuz" seçeneği +
  "Yeni koleksiyon oluştur" inline CTA
- Confirm: `PATCH /api/references/:id` N kez sequential (bulk endpoint yok)
- onSuccess: `clearSelection()`, `invalidateQueries(["references"])` +
  `invalidateQueries(["collections", { kind: "REFERENCE" }])`

## Alternatif: Popover

Daha hafif ama çok N'de kullanıcının arama-odaklı ekran ihtiyacını
karşılamaz. Bookmarks pattern'iyle tutarlılık için modal tercih edilir.

## Backend

Bulk endpoint eklenmiyor; Bookmarks bulk-action-behavior.md şablonunda
kal (sequential + ilk-hata-sürdür). İlerleme `useConfirm` busy'sine bırakılır.

## Risk

- N >10 için sequential yavaş — Listing Queue bulk ekranında gerekirse
  backend bulk endpoint düşünülür
- Çok büyük koleksiyonlara taşıma sonrası chip sayaçları stale kalabilir
  (invalidate çözer)
```

- [ ] **Step 3: `reference-product-type-filter.md` yaz**

File: `docs/plans/reference-product-type-filter.md`

```markdown
# Reference Product Type Filter

**Tarih:** 2026-04-24
**Bağlam:** T-16 References Toolbar'ında `Filtre` ghost butonu
bilinçli olarak `disabled` bırakıldı. Ürün tipi filtresi Bookmarks
tarafındakinin paraleli olacak ama Toolbar `trailing` slot'una düşecek.

## Kapsam

Referansları `productTypeId` ile filtrelemek.

## UI Önerisi: Popover + Dropdown

`Menu` primitive'i (henüz yok) geldiğinde Toolbar `trailing` slot'undaki
Filtre butonu bir popover açar:
- Ürün tipi listesi (checkbox değil, radio — tek seçim)
- "Tümü" seçeneği (undefined'e karşılık)
- Apply + Vazgeç

`Menu` primitive yoksa ara çözüm: Popover + native button list.

## Backend

`listReferences` zaten `productTypeId` parametresini destekliyor; backend
değişikliği yok.

## Test

- `tests/unit/references-page.test.tsx` yeni senaryo: Filtre tıklandığında
  popover açılır; ürün tipi seçilince fetch URL'i `productTypeId=<id>`
  içerir

## Risk

- Menu primitive gelmeden kararı ertele — yarım popover implementasyonu
  primitive-first ilkesinden sapar
```

- [ ] **Step 4: `archived-collection-orphan-references.md` yaz**

File: `docs/plans/archived-collection-orphan-references.md`

```markdown
# Archived Collection — Orphan References

**Tarih:** 2026-04-24
**Bağlam:** T-16 spec'i koleksiyon soft-delete davranışını dürüstçe ifade
etti ama orphan referanslar için görünür çözüm ertelendi.

## Bugünkü Durum

- `softDeleteCollection` yalnız `Collection.deletedAt` set eder; cascade yok
- Bookmark/reference `collectionId` FK değeri korunur
- `listCollections` `deletedAt: null` nedeniyle chip bar'da artık görünmez
- `listReferences` `reference.deletedAt: null`'a bakar; koleksiyonun
  durumuna bakmaz → orphan referanslar listede görünür
- `listCollectionsWithStats.orphanedReferenceCount` bu kayıtları sayar
- References `Tümü · N` hesabı bu sayıyı da içerir
- UI'da **kendi chip'i yok** — görünmez bucket

## Karar Alternatifleri

### A. Cascade `collectionId: null` (Koleksiyonsuz'a taşı)
Koleksiyon arşivlenirken bağlı aktif referansların `collectionId`'si `null`
yapılır. Davranış temiz; geri döndürme (restore) komplikasyon.

### B. `listReferences`'tan dışla
Koleksiyonu silinmiş referans listeden düşer. `Tümü · N` formülünden
`orphanedReferenceCount` çıkarılır. En konservatif çözüm.

### C. Görünür chip ("Arşivli koleksiyondan · N")
Kullanıcıya şeffaf ama UX'i karmaşıklaştırır; arşivli koleksiyonun
kendisi gösterilmediği için "nereden geliyor" belirsiz.

### D. Arşivleme sırasında soru
Kullanıcıdan arşiv confirm'ünde "İçindekileri taşı (Koleksiyonsuz'a) /
koru (orphan) / sil" seçtirilir. En kontrol-dolu ama UX sürtünmesi yüksek.

## Öneri

**A + D birleşimi:** Default cascade (A); confirm dialog'da ek "koruma"
toggle'ı (D). "Koru" işaretliyse orphan kalır; default `collectionId = null`.

## Implementation İçin Gerekli

- `softDeleteCollection` signature'a `{ cascade: boolean }` eklenir
- `ConfirmDialog` preset genişlemesi — yeni opsiyonel toggle alanı
- `confirmPresets.archiveCollection` body cümlesi güncellenir
- `tests/unit/collection-service.test.ts` cascade davranış coverage

## Risk

- Restore senaryosu: koleksiyon geri getirilirse cascade'le kaybolan
  collectionId geri gelmez — undo için ayrı job/history
- ConfirmDialog primitive'ine toggle eklemek primitive'i kirletir;
  alternatif: ayrı "arşiv" dialog'u (primitive üstü kompozisyon)
```

- [ ] **Step 5: Commit**

```bash
git add \
  docs/plans/collection-thumbnails-backend.md \
  docs/plans/bulk-move-to-collection.md \
  docs/plans/reference-product-type-filter.md \
  docs/plans/archived-collection-orphan-references.md
git commit -m "$(cat <<'EOF'
docs: add 4 follow-up notes (T-17 roadmap + bulk-move + product-type-filter + orphan-references)

- collection-thumbnails-backend.md — listCollectionsWithStats'a thumbnailAssetIds aggregate (T-17)
- bulk-move-to-collection.md — References BulkActionBar "Koleksiyona taşı" UI primitive kararı
- reference-product-type-filter.md — Toolbar Filtre butonu popover + Menu primitive bağlantısı
- archived-collection-orphan-references.md — soft-delete cascade alternatifleri (A/B/C/D + öneri)
EOF
)"
```

---

## Bitirme — Tüm Commit'ler Merge Sonrası

- [ ] **Tam suite + lint + typecheck son kez**

Run:
```
pnpm lint
pnpm typecheck
pnpm check:tokens
pnpm vitest run
```

- [ ] **SDD final code-reviewer dispatch** (subagent-driven-development akışı bunu kendi yapacak)

- [ ] **`superpowers:finishing-a-development-branch`** skill'i ile kapanış

---

## Spec Coverage Doğrulaması

Design spec'in 10 bölümü ve plan task'ları arasındaki eşleme:

| Spec bölüm | Plan karşılığı |
|---|---|
| 1. Kapsam ve Varyant | Plan Commit Haritası + Reuse Listesi |
| 2. Mimari Çerçeve | Plan Commit 1–5 sıralaması ve bağımlılık tablosu |
| 3. API Sözleşme (1) | Commit 1, Task 1.1–1.4 |
| 4. CollectionThumb (2) | Commit 2, Task 2.1 |
| 5. References Sayfa (3) | Commit 3, Task 3.1–3.3 |
| 6. Collections Sayfa (4) | Commit 4, Task 4.1–4.3 |
| 7. Test Stratejisi | Plan "Test Stratejisi — Commit-Test Eşlemesi" tablosu |
| 8. Quality Gates | Plan "Quality Gates (Her Commit İçin 4 Kapı)" bölümü |
| 9. Follow-Up Notları | Commit 5, Task 5.1 (4 dosya) |
| 10. Landing/Review Sırası | Plan Commit Haritası + Bitirme bölümü |

---

## Execution Handoff

Plan tamam ve kaydedildi: `docs/plans/2026-04-24-references-collections-plan.md`.

İki execution seçeneği:

**1. Subagent-Driven (önerilen)** — Her task için ayrı bir implementer subagent dispatch edilir; iki aşamalı review (önce spec-compliance sonra code-quality) sonrası bir sonraki task'a geçilir. Kontrol bu oturumda kalır.

**2. Inline Execution** — `superpowers:executing-plans` ile bu oturumda batch olarak ilerlenir, her commit sonrası checkpoint.

Hangisini tercih edersin?
