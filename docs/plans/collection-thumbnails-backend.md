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
