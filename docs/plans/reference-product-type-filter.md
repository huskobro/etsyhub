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
