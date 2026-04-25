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
