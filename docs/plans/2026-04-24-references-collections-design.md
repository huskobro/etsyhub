# References + Collections — Primitive Migrasyonu Design Spec (T-16)

**Tarih:** 2026-04-24
**Kapsam:** T-16 — References + Collections ekranları, Bookmarks taban çizgisinden türeyen primitive migrasyonu
**Önceki karar notları:**
- `docs/plans/shell-strategy.md` — her iki ekran Layout band'de kalıyor (PageShell değil)
- `docs/plans/bulk-action-behavior.md` — bulk aksiyon davranış şablonu (sequential + ConfirmDialog + ilk-hata-sürdür)
- `docs/design/EtsyHub/screens-b.jsx` (B.4, B.5) — canvas referansı

---

## 1. Kapsam ve Varyant

Bu tur **Varyant B** ile ilerliyor: primitive migrasyonu + collection chip filter + multi-select. Mosaic thumbnail datası (backend aggregate) bu turda yok; T-17 olarak ayrı ve isimli bir takip işi açılıyor (Follow-up 1).

**Hangileri bu turda GİRER:**
- Bookmarks taban çizgisinin (shell, Toolbar, FilterBar, BulkActionBar, Card `variant="asset"`, ConfirmDialog + useConfirm) References ve Collections'a uygulanması
- References için collection chip filter (server-side count) + `uncategorized` sentinel
- References multi-select + bulk archive (sequential, `archiveReferencesBulk` preset)
- CollectionThumb primitive'i (mosaic-ready anatomi, placeholder davranışı bugün aktif)
- Collection kartı visual-first anatomiye geçişi (CollectionThumb + kind badge + item count + arşivle ghost aksiyonu)
- `/collections?intent=create` URL intent desteği — References sayfasından navigasyon

**Hangileri bu turda GİRMEZ (ayrı follow-up):**
- Mosaic için backend `thumbnailAssetIds` aggregate (Follow-up 1)
- Bulk `Koleksiyona taşı` UI (Follow-up 2)
- Reference product type filter UI (Follow-up 3)
- Arşivli koleksiyonun orphan referans davranışı (Follow-up 4)

---

## 2. Mimari Çerçeve

### 2.1 Commit Sırası

Bağımlılıklar: **1+2 → 3 → 4**. API ve primitive ilk, ekranlar sonra.

| # | Commit | Tip | Dosyalar | Bağımlılık |
|---|---|---|---|---|
| 1 | `feat(api): references uncategorized sentinel + collections uncategorizedReferenceCount` | API | `src/features/references/schemas/index.ts`, `src/features/references/services/reference-service.ts`, `src/features/collections/services/collection-service.ts`, `src/app/api/collections/route.ts` | — |
| 2 | `feat(ui): add CollectionThumb primitive` | Primitive | `src/components/ui/CollectionThumb.tsx`, `tests/unit/collection-thumb.test.tsx` | — |
| 3 | `refactor(references): primitive migration + chip filter + multi-select` | Ekran | `src/features/references/components/references-page.tsx`, `.../reference-card.tsx`, `src/components/ui/confirm-presets.ts`, `tests/unit/references-page.test.tsx` | 1 |
| 4 | `refactor(collections): primitive migration + visual-first card` | Ekran | `src/features/collections/components/collections-page.tsx`, `.../collection-card.tsx`, `src/components/ui/confirm-presets.ts`, `tests/unit/collections-page.test.tsx` | 1, 2 |

**Kapanış commit'i (5):** `docs: add 4 follow-up notes (T-17 roadmap + bulk-move + product-type-filter + orphan-references)` — 4 markdown dosyası (detay Bölüm 9).

### 2.2 Landing/Review Sırası

Her commit için iki aşamalı review (SDD pattern): önce spec-compliance, sonra code-quality. Commit sırası dependency order ile aynı; commit 3 commit 1'in API değişikliklerini kullandığı için commit 1'den önce landing edilemez.

### 2.3 Shell Kararı

Her iki ekran **Layout band**'de kalıyor (`src/app/(app)/layout.tsx`). PageShell geçişi bu turda yok — karar `shell-strategy.md`'de kilitli.

---

## 3. API Sözleşme Değişiklikleri (Commit 1)

### 3.1 `listReferencesQuery` schema daraltması

Dosya: `src/features/references/schemas/index.ts`

**Önce:**
```ts
collectionId: z.string().optional(),
```

**Sonra:**
```ts
collectionId: z
  .union([z.literal("uncategorized"), z.string().cuid()])
  .optional(),
```

**Neden:** Query sözleşmesi mümkün olduğunca dar tutulacak. `"uncategorized"` sentinel değeri cuid formatıyla çakışamaz; union açık ve güvenli. Rastgele string artık 400 hatası döner.

### 3.2 `listReferences` service — sentinel mantığı

Dosya: `src/features/references/services/reference-service.ts` (mevcut `listReferences`)

**Önce:**
```ts
...(collectionId ? { collectionId } : {}),
```

**Sonra:**
```ts
...(collectionId === "uncategorized"
  ? { collectionId: null }
  : collectionId
    ? { collectionId }
    : {}),
```

Üç hal: undefined → filtre yok; `"uncategorized"` → `collectionId: null` eşleşmesi; cuid → exact match.

### 3.3 `listCollections` response zenginleştirme

Dosya: `src/features/collections/services/collection-service.ts`

**Mevcut davranış:**
- Service `db.collection.findMany(...)` ile **düz dizi** döndürüyor (return type `Collection[]`)
- `src/app/api/collections/route.ts` ise bunu `{ items }` şeklinde sarmalayarak dönüyor

**Yeni davranış:**
Service imzası sabit dizi dönmeye devam edebilir; API route katmanında iki aggregate alanı eklenir. Sorumluluk ayrımı açısından **aggregate değerleri service'te hesaplanıp response'a eklenir**:

```ts
// collection-service.ts
export async function listCollectionsWithStats(args: {
  userId: string;
  query: ListCollectionsQuery;
}) {
  const items = await listCollections(args);

  // "Koleksiyonsuz" — hiç collection'a bağlı olmayan aktif referanslar
  const uncategorizedReferenceCount = await db.reference.count({
    where: {
      userId: args.userId,
      deletedAt: null,
      collectionId: null,
    },
  });

  // "Orphan" — collection'a bağlı ama o collection soft-delete olmuş aktif referanslar
  // Bugünkü listReferences davranışı bu kayıtları listede göstermeye devam eder;
  // sayımın bunu da kapsaması "Tümü · N" chip'ini gerçek aktif toplama eşitler.
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

```ts
// app/api/collections/route.ts (GET)
const result = await listCollectionsWithStats({ userId: user.id, query: parsed.data });
return NextResponse.json(result);
```

**Response shape değişikliği (backward-compatible):**

```jsonc
// Önce
{ "items": [...] }

// Sonra
{
  "items": [...],
  "uncategorizedReferenceCount": 4,
  "orphanedReferenceCount": 2
}
```

**`uncategorizedReferenceCount`** → `collectionId: null` olan aktif referans sayısı. Havuz dağılımında "Koleksiyonsuz" chip'inin veri kaynağı.

**`orphanedReferenceCount`** → `collectionId: <cuid>` olan ama `Collection.deletedAt != null` olan aktif referans sayısı. UI'da **kendi chip'i yok** (bu turda görünür bir bucket olarak ele alınmayacak — Follow-up 4); ama **`Tümü · N` hesabına dahil edilir** ki sayım gerçek aktif havuza eşit olsun. Aksi halde kullanıcı `Tümü`'de eksik sayı görür ve bazı referanslar hiçbir chip altında sayılmamış olur.

Her iki alan da **global**: aktif `kind` veya `q` filtrelerinden bağımsızdır. Chip bar havuz dağılımı sinyali taşır, ekrandaki anlık filtreye göre kaymaz.

Mevcut `CollectionPicker` bileşeni zaten `data.items` kullanıyor (kontrol edildi); response'a ek alan eklemek onu **bozmaz**. Breaking yok.

### 3.4 Commit 1 mesajı

```
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
```

---

## 4. CollectionThumb Primitive (Commit 2)

### 4.1 Dosya ve sözleşme

Dosya: `src/components/ui/CollectionThumb.tsx`

```tsx
export interface CollectionThumbProps {
  assetIds: string[];
  alt?: string;
  className?: string;
}

export function CollectionThumb({ assetIds, alt, className }: CollectionThumbProps): JSX.Element;
```

### 4.2 Davranış matrisi

| `assetIds.length` | Render | data-testid |
|---|---|---|
| `0` | Placeholder: `bg-surface-muted` + `border-border-subtle` iç halka + ortada folder icon (`text-text-subtle`) | `collection-thumb-placeholder` |
| `1` | Tek `AssetImage` (`aspect-video`, `object-cover`) | yok |
| `2–3` | **Tek `AssetImage`**, listedeki ilk asset (mosaic YOK) | yok |
| `>= 4` | 2×2 mosaic: `grid grid-cols-2 grid-rows-2 gap-px aspect-video` + her slot `<AssetImage>` | `collection-thumb-mosaic` |

**Karar gerekçesi (özet):**
- 2–3 asset'te yarım/eksik mosaic premium hissini düşürür; tek büyük görsel daha sakin.
- `gap-px` Tailwind built-in (arbitrary yok); `aspect-video` 16/9 için doğru named utility.
- 4+ senaryosunda fazla asset atılır (ilk 4 alınır).

### 4.3 T-17 uyumu

Bugün backend bu alanı **göndermiyor**; `CollectionCard` tüketici tarafında `thumbnailAssetIds ?? []` normalize ettiği için tüm kartlar placeholder görür. T-17'de backend aggregate devreye alındığında bu primitive'in frontend sözleşmesi **değişmez** — sadece artık dolu array gelir, mosaic görünür. `CollectionCard` tüketicisi dokunulmaz. (Tüm katmanlarda opsiyonel; detay Bölüm 5.1 sözleşme notu.)

### 4.4 Token uyumu

- Arbitrary Tailwind değeri **yok**.
- `aspect-video`, `gap-px`, `grid-cols-2`, `grid-rows-2`, `object-cover`, `rounded-md`, `border`, `border-border-subtle`, `bg-surface-muted`, `text-text-subtle` — tamamı named utility.

### 4.5 Test (`tests/unit/collection-thumb.test.tsx`)

4 senaryo:

1. `assetIds=[]` → `getByTestId("collection-thumb-placeholder")` bulunur
2. `assetIds=["a1"]` → mosaic testid'i yok, AssetImage fetch'i 1 kez çağrılır
3. `assetIds=["a1","a2","a3"]` → mosaic testid'i **yok** (single-fallback regression)
4. `assetIds=["a1","a2","a3","a4","a5"]` → mosaic testid'i var; AssetImage fetch'i ilk 4 için çağrılır, 5. atılır

`AssetImage` mock'u Bookmarks testindekiyle aynı fetch helper'ı kullanır (`/api/assets/:id/url`).

---

## 5. References Sayfa Migrasyonu (Commit 3)

### 5.1 `references-page.tsx` — tam rewrite

**Amaç:** Bookmarks pattern'ini birebir replike etmek; ekran seviyesinde davranış Bookmarks'la aynı kalacak şekilde filter eksenini koleksiyon chip'ine bağlamak.

**Durum ve tipler:**

```ts
type CollectionFilter = null | "uncategorized" | string; // null = Tümü

type CollectionLite = {
  id: string;
  name: string;
  _count: { references: number };
  // T-17'de backend tarafında dolacak; bugün response'ta yok → opsiyonel.
  thumbnailAssetIds?: string[];
};

type CollectionsResponse = {
  items: CollectionLite[];
  uncategorizedReferenceCount: number;
  orphanedReferenceCount: number;
};

const [activeCollection, setActiveCollection] = useState<CollectionFilter>(null);
const [q, setQ] = useState("");
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const { confirm, close, run, state } = useConfirm();
const router = useRouter();
```

**Sözleşme notu (`thumbnailAssetIds`):** Bu alan **tüm katmanlarda opsiyonel**:
- API response'unda bugün yok (T-17'de eklenecek)
- Page-level `CollectionLite` tipinde `?: string[]`
- `CollectionsResponse` tipinde `items` dizisindeki her öğe için `?: string[]`
- `CollectionCard` props tipinde `?: string[]`
- Kullanım noktalarında `collection.thumbnailAssetIds ?? []` normalize edilir

T-17 backend zenginleştirmesinde alan her zaman dolu gelecek; o zaman opsiyonel işareti tüm katmanlarda aynı anda kaldırılabilir. Bu turda zorunlu yapmak yanlış sözleşme sinyalidir (sunucu göndermediği alanı UI zorunlu tiplemez).

**İki query:**
- `useQuery<CollectionsResponse>` → `/api/collections?kind=REFERENCE`, queryKey `["collections", { kind: "REFERENCE" }]`
- `useQuery<ListResponse>` → `/api/references?...`, queryKey `["references", activeCollection, q]`. `activeCollection` true ise `collectionId` param olarak geçirilir (`"uncategorized"` sentinel direkt URL'e düşer).

**Mutation:**
```ts
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
```

Chip sayaçlarının canlı kalması için collections query'si de invalidate edilir.

**Seçim (Bookmarks birebir):**

```ts
const items = useMemo(() => query.data?.items ?? [], [query.data]);
const visibleIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);
const selectedCount = useMemo(
  () => items.filter((i) => selectedIds.has(i.id)).length,
  [items, selectedIds],
);

const toggleSelect = (id: string) => {
  setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
};
const clearSelection = () => setSelectedIds(new Set());

const bulkArchive = () => {
  const targets = items.filter((i) => selectedIds.has(i.id)).map((i) => i.id);
  if (targets.length === 0) return;
  confirm(confirmPresets.archiveReferencesBulk(targets.length), async () => {
    for (const id of targets) await archiveMutation.mutateAsync(id);
    clearSelection();
  });
};

useEffect(() => {
  setSelectedIds((prev) => {
    const next = new Set<string>();
    for (const id of prev) if (visibleIds.has(id)) next.add(id);
    return next;
  });
}, [visibleIds]);
```

**Tümü sayacı (global, üç bileşen):**

```ts
const totalCount = useMemo(() => {
  if (!collectionsQuery.data) return 0;
  const sumNamed = collectionsQuery.data.items.reduce(
    (sum, c) => sum + c._count.references, 0,
  );
  return (
    sumNamed +
    collectionsQuery.data.uncategorizedReferenceCount +
    collectionsQuery.data.orphanedReferenceCount
  );
}, [collectionsQuery.data]);
```

**Formül bileşenleri:**
- `sumNamed` → aktif (soft-delete olmamış) koleksiyonların `_count.references` toplamı. Görünür chip'lerin sayaçları.
- `uncategorizedReferenceCount` → `Koleksiyonsuz · N` chip'i olarak görünür.
- `orphanedReferenceCount` → **kendi chip'i yok**, ama toplama dahil. Görünmeyen bucket.

Gerekçe: chip satırı filtre sonucu değil, havuz dağılımı sinyali. `items.length` kullanılmaz. Orphan referanslar `listReferences` tarafından listede hâlâ döndürüldüğü için (arşivli koleksiyona bağlı, ancak kendi `deletedAt: null`), kullanıcının gördüğü `Tümü · N` gerçek aktif havuzu temsil etmelidir — aksi halde chip sayaçlarının toplamı liste uzunluğuyla tutmaz ve kullanıcı "neden 3 seçtim, Tümü'de 2 yazıyor?" gibi bir kırılma görür.

**Follow-up 4 bu davranışı çözecek:** orphan referansları ya listeden dışlayacak (o zaman `orphanedReferenceCount` `Tümü`'den de düşer), ya görünür bir bucket'a çevirecek ("Arşivli koleksiyondan · N" gibi), ya da taşı/temizle aksiyonu sunacak. Bugünkü spec orphan'ı **görünmez ama sayılabilir** konumda bırakır — en az yanıltıcı ara durum.

### 5.2 JSX iskeleti

Özet (detay Bölüm 4/6 onayında verildi):

- Başlık satırı: `h1 "Referans Havuzu"` + alt özet + sağda **aktif** `Yeni koleksiyon` butonu (`router.push("/collections?intent=create")`)
- `Toolbar`:
  - `leading`: `Input` (`placeholder="Başlık, tag veya koleksiyonda ara"`, `prefix={Search}`)
  - `trailing`: `Button variant="ghost"` (`icon={SlidersHorizontal}`, label `"Filtre"`, `disabled` — product type filter follow-up'a bağlı)
  - children: `FilterBar` içinde:
    - `Chip active={activeCollection === null}` → `Tümü · {totalCount}`
    - Her named koleksiyon: `Chip active={activeCollection === c.id}` → `{c.name} · {c._count.references}`
    - `uncategorizedReferenceCount > 0` ise: `Chip active={activeCollection === "uncategorized"}` → `Koleksiyonsuz · {uncategorizedReferenceCount}`
- `BulkActionBar` (selectedCount bağımlı render):
  - Label: `{selectedCount} referans seçildi`
  - Actions: `Benzerini yap` (disabled), `Koleksiyona taşı` (disabled), `Arşivle` (aktif, `onClick={bulkArchive}`, `disabled={archiveMutation.isPending}`)
  - `onDismiss={clearSelection}`
- Body: loading → `SkeletonCardGrid count={8}` / error → `StateMessage tone="error"` / empty → `StateMessage tone="neutral"` (aktif filtreye göre body metni farklı; CTA `Referans ekle` disabled) / default → `grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4` içinde `ReferenceCard`
- `ConfirmDialog` (useConfirm state'ine bağlı render)

### 5.3 `reference-card.tsx` — rewrite

**Kaldırılanlar:** `<article>` wrapper, inline product type chip, custom `<button>` class'ları, inline görsel.

**Yeniler:**
- `Card variant="asset" interactive selected={selected}`
- Görsel kısmı `<div className="relative">` içinde `AssetImage` + Bookmarks'taki CheckIcon overlay'i birebir kopya (`absolute left-2 top-2`, aynı class matrisi)
- Sağ üst `Badge tone="neutral"`: `{reference.variantCount} varyant` (varsa)
- `AssetCardMeta` içinde:
  - Üst: truncate title + sağda `Badge tone="accent"` product type display name (varsa)
  - Orta: platform · tarih meta (Bookmarks formatı)
  - Alt: solda `collection.name ?? "Koleksiyon yok"`, sağda aksiyonlar — `Benzerini yap` (secondary, disabled), `Arşivle` (ghost, `onClick={() => onArchive(reference.id)}`)

**Props:**
```ts
{
  reference: ReferenceLite;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onArchive?: (id: string) => void;
}
```

Bookmarks'taki gibi `onOpen`, `onSetTags`, `onSetCollection` şu an eklenmez — scope dışı.

### 5.4 Yeni preset'ler

`src/components/ui/confirm-presets.ts` altına:

```ts
archiveReferencesBulk: (count: number) => ({
  title: "Seçili referansları arşivle",
  body: `${count} referans arşivlenecek. Bu işlem geri alınamaz.`,
  confirmLabel: "Arşivle",
  tone: "destructive" as const,
}),
archiveReference: (title?: string | null) => ({
  title: "Referansı arşivle",
  body: title ? `"${title}" arşivlenecek.` : "Bu referans arşivlenecek.",
  confirmLabel: "Arşivle",
  tone: "destructive" as const,
}),
```

### 5.5 Test (`tests/unit/references-page.test.tsx`)

Bookmarks testinin birebir türevi, 10 senaryo:

1. loading → `SkeletonCardGrid` (role="status")
2. empty (`items=[]`, hiç filtre yok) → `StateMessage` + "Referans ekle" CTA (disabled)
3. default → 4-col grid, kart başlıkları görünür, üst özet `N referans`
4. **chip filter: specific cuid** → chip tıkla, son fetch URL'i `/api/references?collectionId=<cuid>&limit=60` içerir
5. **chip filter: uncategorized** → `Koleksiyonsuz · 4` tıkla, son fetch URL'i `collectionId=uncategorized` içerir
6. `Tümü · N` sayaç doğruluğu → mock `items: [{_count: 3}, {_count: 5}]` + `uncategorizedReferenceCount: 4` + `orphanedReferenceCount: 2` iken chip label'ı `Tümü · 14` (3+5+4+2). Ayrı bir alt-assertion: `orphanedReferenceCount` için **chip render edilmez** (sadece `Tümü` hesabında yer alır).
7. multi-select → 2 kart seç → `BulkActionBar` `2 referans seçildi` + `Arşivle` butonu
8. bulk archive → `Arşivle` tıkla → dialog açılır → başlık `"Seçili referansları arşivle"`, body `"2 referans arşivlenecek"`
9. dismiss → seçim temizlenir, BulkActionBar gizlenir
10. `Yeni koleksiyon` butonu tıklanınca `router.push` çağrılır → argüman `"/collections?intent=create"`

Mock fetch URL matcher'ları: `/api/references`, `/api/collections?kind=REFERENCE`, `/api/assets/:id/url`, `/api/tags`, `/api/product-types`.

`next/navigation`'ın `useRouter` mock'u: `push` vi.fn() ile takip edilir.

### 5.6 Commit 3 mesajı

```
refactor(references): primitive migration + chip filter + multi-select

- ReferencesPage'i Bookmarks pattern'ine taşı: Toolbar + FilterBar + BulkActionBar + ConfirmDialog
- Collection chip bar (sayaçlı) native <select> filtresini değiştirir
- "Koleksiyonsuz · N" chip'i uncategorized sentinel ile backend'e bağlanır
- "Tümü · N" sayacı global havuz dağılımı (Σ active _count.references + uncategorizedReferenceCount + orphanedReferenceCount)
- Multi-select + bulkArchive (sequential, archiveReferencesBulk preset)
- Yeni koleksiyon butonu /collections?intent=create'e navigate eder
- ReferenceCard Card variant="asset" + interactive + selected primitive kompozisyonuna geçer
- confirmPresets: archiveReferencesBulk, archiveReference eklendi

Follow-up'lar: bulk Koleksiyona taşı, product type filter, mosaic backend ayrı notlarda.
```

---

## 6. Collections Sayfa Migrasyonu (Commit 4)

### 6.1 `collections-page.tsx` — rewrite

**Durum:**

```ts
type CollectionKind = "BOOKMARK" | "REFERENCE";
type KindFilter = "ALL" | CollectionKind;

const [kind, setKind] = useState<KindFilter>("ALL");
const [q, setQ] = useState("");
const [createOpen, setCreateOpen] = useState(false);
const { confirm, close, run, state } = useConfirm();
const qc = useQueryClient();
const router = useRouter();
```

**URL intent effect:**

```ts
useEffect(() => {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("intent") === "create") {
    setCreateOpen(true);
    router.replace("/collections");
  }
}, [router]);
```

Dialog kapandıktan sonra URL temiz olduğu için tekrar açılmaz.

**Query:**

```ts
type CollectionLite = {
  id: string;
  name: string;
  kind: CollectionKind;
  updatedAt: string;
  _count: { bookmarks: number; references: number };
  // T-17'de backend tarafında dolacak; bugün response'ta yok → opsiyonel.
  thumbnailAssetIds?: string[];
};

const query = useQuery<{
  items: CollectionLite[];
  uncategorizedReferenceCount: number;
  orphanedReferenceCount: number;
}>({
  queryKey: ["collections-all", kind, q],
  queryFn: async () => {
    const params = new URLSearchParams();
    if (kind !== "ALL") params.set("kind", kind);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/collections?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Koleksiyonlar alınamadı");
    return res.json();
  },
});
```

`uncategorizedReferenceCount` ve `orphanedReferenceCount` bu ekranda kullanılmıyor ama response'tan gelir; tipte yer alması sözleşme tutarlılığı için (References sayfasıyla aynı shape). `thumbnailAssetIds` tüm katmanlarda opsiyonel — sözleşme notu Bölüm 5.1.

**Mutation (arşivle):**

```ts
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
```

**Multi-select YOK.** Koleksiyon global bir yapı; bulk seçim ihtiyacı yok. Bookmarks/References pattern'inden bilinçli sapma.

### 6.2 JSX iskeleti

- Başlık satırı: `h1 "Koleksiyonlar"` + alt özet + sağda `Yeni koleksiyon` primary (`onClick={() => setCreateOpen(true)}`)
- `Toolbar`:
  - `leading`: `Input` (`placeholder="Koleksiyon ara"`)
  - children: `FilterBar` — 3 chip (sayaçsız): `Tümü`, `Bookmark`, `Referans`
- Body: loading → `SkeletonCardGrid count={6}` / error / empty (arama var/yok iki farklı body) / default → `grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3` içinde `CollectionCard`
- `NewCollectionDialog` (mevcut bileşen korunur; `onClose` invalidate tetikler)
- `ConfirmDialog`

### 6.3 `collection-card.tsx` — visual-first anatomi

```tsx
<Card variant="asset" interactive>
  <CollectionThumb assetIds={collection.thumbnailAssetIds ?? []} alt={collection.name} />
  <div className="flex flex-col gap-2 p-3">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-text">{collection.name}</h3>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-text-subtle">
          <span className="font-mono">{`${itemCount} ${itemLabel}`}</span>
          <span aria-hidden>·</span>
          <span>{new Date(collection.updatedAt).toLocaleDateString("tr-TR")}</span>
        </div>
      </div>
      <Badge tone={collection.kind === "BOOKMARK" ? "accent" : "success"}>
        {collection.kind === "BOOKMARK" ? "Bookmark" : "Referans"}
      </Badge>
    </div>
    {onArchive ? (
      <div className="flex justify-end pt-1">
        <Button variant="ghost" size="sm" onClick={() => onArchive(collection.id)}>
          Arşivle
        </Button>
      </div>
    ) : null}
  </div>
</Card>
```

**Kararlar (Bölüm 5/6 onayı):**
- Kind chip sayacı **yok** — chip'ler mod anahtarı, havuz dağılımı değil.
- Kind Badge kart üzerinde **kalıyor** — "Tümü" görünümünde hızlı tarama için gerekli.
- Arşivle aksiyonu **açık ghost button** (kebab değil) — Menu primitive gelene kadar en dürüst seçenek.

**Bugünden sözleşmeye giren alan (tüm katmanlarda opsiyonel):**
```ts
thumbnailAssetIds?: string[]; // bugün backend göndermez; T-17'de dolacak
```

Backend response'unda bu alan bugün yok; `CollectionCard` props tipi, `CollectionLite` page tipi ve `CollectionsResponse` query tipi üçü de alanı **opsiyonel** tutar. Kullanım noktasında `collection.thumbnailAssetIds ?? []` normalize edilir. Detaylı sözleşme notu Bölüm 5.1'de; buradaki `CollectionCard` props tipi aynı kurala uyar. T-17 backend zenginleştirmesinde üç katmanda aynı anda opsiyonel işareti kaldırılır.

### 6.4 Yeni preset

```ts
archiveCollection: (name?: string | null) => ({
  title: "Koleksiyonu arşivle",
  body: name
    ? `"${name}" koleksiyonu arşivlenecek. İçindeki bookmark ve referanslar silinmez; ama bu koleksiyon filtresi altında artık görünmez.`
    : "Bu koleksiyon arşivlenecek. İçindeki bookmark ve referanslar silinmez; ama bu koleksiyon filtresi altında artık görünmez.",
  confirmLabel: "Arşivle",
  tone: "destructive" as const,
}),
```

**Cümlenin doğruluğu (kod okumasıyla doğrulandı):**
- `softDeleteCollection` sadece `Collection.deletedAt` set eder.
- Bookmark/reference tablolarına **dokunmaz**; cascade yok. `collectionId` FK olduğu gibi kalır.
- `listCollections` `deletedAt: null` filtresi nedeniyle chip bar'ında artık görünmez.
- `listReferences` referansın `deletedAt: null`'a bakar; koleksiyonun soft-delete durumunu kontrol etmez — kayıtlar ayrı bir ekrana veya filtreye düşmez.

Bu davranış bir açık uç (orphan) yaratır; Follow-up 4 bunu ele alır. Preset cümlesi bugünkü gerçek davranışı dürüstçe ifade ediyor.

### 6.5 Test (`tests/unit/collections-page.test.tsx`)

9 senaryo:

1. loading → `SkeletonCardGrid`
2. empty (arama yok) → "Henüz koleksiyon yok" + "İlk koleksiyonunu oluştur" CTA
3. empty (arama var) → "Eşleşen koleksiyon yok" + farklı body
4. default → 3-col grid, kart başlıkları + kind Badge + item count + CollectionThumb placeholder görünür (çünkü `thumbnailAssetIds` undefined → `?? []` → 0 asset → placeholder)
5. kind chip filter → `Referans` chip → fetch URL'i `kind=REFERENCE` içerir
6. arama → input'a yaz → fetch URL'i `q=<term>` içerir
7. `Yeni koleksiyon` butonu → dialog açılır (NewCollectionDialog render)
8. `?intent=create` URL param → ilk render'da dialog otomatik açılır; `router.replace("/collections")` çağrılır
9. arşivle → `archiveCollection(name)` preset dialog'u açılır; title `"Koleksiyonu arşivle"`, body içinde `"silinmez"` geçer

`window.location` mock'u `Object.defineProperty` ile kurulur; senaryo 8 için `?intent=create` set edilir, diğerlerinde temiz URL.

### 6.6 Commit 4 mesajı

```
refactor(collections): primitive migration + visual-first card

- CollectionsPage Toolbar + FilterBar + ConfirmDialog + useConfirm pattern'ine geçer
- Kind filter 3 Chip'e indi (Tümü/Bookmark/Referans, sayaçsız — mod anahtarı)
- CollectionCard visual-first: CollectionThumb (16:9) + title/meta/kind badge + Arşivle ghost
- thumbnailAssetIds sözleşmesi bugünden frontend tarafında (T-17'de backend dolacak)
- ?intent=create URL param desteği: References'tan "Yeni koleksiyon" navigasyonu
- confirmPresets.archiveCollection — body cümlesi gerçek soft-delete davranışını yansıtır

Multi-select bilinçli olarak eklenmedi; koleksiyon global yapı.
```

---

## 7. Test Stratejisi — Özet

| Dosya | Commit | Senaryo sayısı |
|---|---|---|
| `tests/unit/collection-thumb.test.tsx` | 2 | 4 (placeholder / 1-asset / 2-3 asset single fallback / 4+ mosaic) |
| `tests/unit/confirm-presets.test.ts` (mevcut, genişletilir) | 3, 4 | 3 yeni: `archiveReferencesBulk`, `archiveReference`, `archiveCollection` (body cümle assertion'ı kritik) |
| `tests/unit/references-page.test.tsx` | 3 | 10 (loading/empty/default/cuid-chip/uncategorized-chip/tümü-sayaç/multi-select/bulk-archive/dismiss/router-push) |
| `tests/unit/references-service.test.ts` (varsa genişle, yoksa oluştur) | 1 | 3 (undefined / uncategorized / cuid — Prisma where clause doğrulaması) |
| `tests/unit/references-query-schema.test.ts` (yeni) | 1 | 4 (uncategorized OK / cuid OK / random string FAIL / undefined OK) |
| `tests/unit/collection-service-stats.test.ts` (yeni) | 1 | 3 (`uncategorizedReferenceCount` `collectionId: null` sayar / `orphanedReferenceCount` arşivli collection'a bağlı aktif referansları sayar / ikisi kind ve q filtrelerinden bağımsız) |
| `tests/unit/collections-page.test.tsx` | 4 | 9 (loading/empty-noq/empty-withq/default/kind-chip/search/create-btn/url-intent/archive-preset) |

**Mock altyapısı:** Bookmarks testindeki `wrapper`, `mockFetch`, `matchMedia` helper'ları birebir kullanılır. `next/navigation`'ın `useRouter` mock'u iki yeni ekran testinde de gerekli (`push`, `replace`).

---

## 8. Quality Gates

Her commit için 4 gate:

1. **Code quality:** `pnpm lint`, `pnpm typecheck`, `pnpm check:tokens` (arbitrary Tailwind taraması temiz — `gap-px` kullanımı zorunlu)
2. **Behavior:** İlgili `vitest run` dosyası yeşil
3. **Spec match:** `docs/design/EtsyHub/screens-b.jsx` B.4/B.5 ile görsel tutarlılık (manuel karşılaştırma, snapshot yok)
4. **Data isolation:** `archiveMutation` + servis çağrıları `userId` ile scoped; arşiv/delete yollarında `assertOwnsResource` çalışır (mevcut kod bunu garantiliyor; değişmiyor)

SDD pattern: her commit sonrası spec-compliance review → approved → code-quality review → approved → bir sonraki commit.

---

## 9. Follow-Up Notları (T-16 kapanışında 4 dosya)

1. **`docs/plans/collection-thumbnails-backend.md` (T-17)** — `listCollections` response'una `thumbnailAssetIds` aggregate ekleme; son güncellenen 4 bookmark/reference asset id'si; index ve N+1 stratejisi.
2. **`docs/plans/bulk-move-to-collection.md`** — bulk `Koleksiyona taşı` UI primitive seçimi; önerilen yön **modal + arama** (`CollectionPickerDialog`).
3. **`docs/plans/reference-product-type-filter.md`** — References toolbar'daki Filter ghost butonunun ürün tipi filtresine bağlanması; önerilen yön **popover + dropdown**, Menu primitive'ine bağlı.
4. **`docs/plans/archived-collection-orphan-references.md`** — soft-delete edilmiş koleksiyonun aktif referansları. Bu turda `orphanedReferenceCount` response'a eklendi ve `Tümü · N` hesabına dahil oldu, ama **görünür bir chip'i yok**; `listReferences` hâlâ bu kayıtları listede döndürüyor. Çözüm seçenekleri: A) cascade `collectionId: null` → Koleksiyonsuz'a taşınsın, B) `listReferences` response'undan dışla, C) `"Arşivli koleksiyondan · N"` adıyla görünür chip, D) kullanıcıya interaktif "taşı veya temizle" sorusu (koleksiyon arşivlenirken). Not orphan bucket'ın UX/veri anlamını tartışır, karar T-17+ iterasyonuna bırakılır.

Bu 4 dosya tek commit'te (`docs: add 4 follow-up notes (T-17 roadmap + bulk-move + product-type-filter + orphan-references)`) eklenecek.

---

## 10. Landing/Review Sırası — Kapanış

1. Commit 1 (API) → spec review → quality review → merge
2. Commit 2 (CollectionThumb) → spec review → quality review → merge
3. Commit 3 (References) → spec review → quality review → merge
4. Commit 4 (Collections) → spec review → quality review → merge
5. Commit 5 (4 follow-up notu) → merge

T-16 sonu: Bookmarks + References + Collections tek primitive ailesinde; mosaic datası ve bulk move ayrı görünür iş olarak kilitli.
