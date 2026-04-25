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
