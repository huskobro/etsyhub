# Bulk Action Behavior — Bookmarks Referans Davranışı

**Karar tarihi:** 2026-04-24
**Referans commit:** `c4e566c` (T-15b Bookmarks multi-select + bulk archive)
**Kapsam:** Bundan sonraki bulk-heavy ekranlar (References, Collections, Trend Stories, Listing Queue) bu davranışı **taban çizgisi** alacak. Sapma olursa ekran seviyesinde belgelenmeli.

## Akış (Kanonik)

Bookmarks ekranındaki `bulkArchive`:

```ts
const bulkArchive = () => {
  const targets = items.filter((i) => selectedIds.has(i.id)).map((i) => i.id);
  if (targets.length === 0) return;
  confirm(confirmPresets.archiveBookmarksBulk(targets.length), async () => {
    for (const id of targets) {
      await archiveMutation.mutateAsync(id);
    }
    clearSelection();
  });
};
```

Akış adımları:
1. Kullanıcı BulkActionBar'dan **Arşivle**'ye basar.
2. `confirm()` tek bir `ConfirmDialog` açar (`archiveBookmarksBulk(count)` preset'i).
3. Kullanıcı onaylayınca `useConfirm.run()` callback'i çağırır.
4. Callback **sequential** döngü ile her id için `mutateAsync(id)` çalıştırır.
5. Hepsi başarılıysa `clearSelection()` + dialog kapanır.

## İlk Hata Davranışı

`await archiveMutation.mutateAsync(id)` throw ederse:

- Döngü o noktada kırılır; **kalan id'ler denenmez**.
- `useConfirm.run()` hatayı yakalar, `state.errorMessage` set edilir, `state.busy` düşer.
- **ConfirmDialog açık kalır** (`bookmarks-confirm-flow.test.tsx` bu davranışı 5. senaryoda doğruluyor).
- Dialog içinde:
  - `role="alert"` ile hata mesajı görünür.
  - Confirm butonu "Tekrar dene" etiketine döner.
- `clearSelection()` **çağrılmaz** — seçim duruyor, kullanıcı yeniden deneyebilir.
- React Query cache durumu: başarılı id'ler için `invalidateQueries(["bookmarks"])` zaten `onSuccess`'te tetiklendi; listede hemen düşerler. Hata alan ve denenmemiş id'ler seçili kalmaya devam eder.

Net sonuç: **N seçtin, K başarılı, 1 başarısız, M denenmedi** durumunda → seçim içinde K başarılı düştü, 1 başarısız + M denenmemiş kaldı. Kullanıcı "Tekrar dene" der, aynı callback yeniden çalışır, kalan seçime sadece başarısız + denenmemişleri dener (çünkü `items` liste güncel, `targets` filtresi `visibleIds` ile kesişir).

## Kullanıcıya Görünürlük

Şu an ekranda:
- **Başarı** → dialog kapanır, BulkActionBar gizlenir (selection 0), liste invalidate → kayıtlar düşer. Toast veya banner **yok**.
- **Hata** → dialog açık kalır, `role="alert"` mesajı, "Tekrar dene" butonu. Seçim duruyor.

## Bilinen Boşluklar (Bir Sonraki Bulk-Heavy Ekrana Geçmeden Önce Görülmeli)

1. **Kısmi başarı raporu yok** — "5 seçtin, 3 arşivlendi, 2 başarısız" bilgisi kullanıcıya aktarılmıyor. Dialog sadece son hatayı gösteriyor. Bu MVP için kabul; bulk-heavy ekrana geçildiğinde (ör. Listing Queue) **toplu sonuç özeti** gerekecek (ör. "3/5 başarılı — detay için Hata logu").
2. **İlerleme göstergesi yok** — 50+ item bulk'ta "3/50 işleniyor" geri bildirimi yok. Progress, bulk API olmadığı için client-side sayaca indirgenebilir ama şu an dialog sadece `busy` boolean'ı taşıyor.
3. **Sequential mi paralel mi?** — Bugün sequential. Server-side race condition riskini minimize eder ve rate limit'e uyar. Paralel (Promise.all) sürat kazandırır ama ilk hata davranışını dağıtır. **Kural: bulk-heavy ekranlarda önce sequential'de kal; paralelleşme ancak sunucu bulk endpoint'i gelince tartışılır.**
4. **Bulk endpoint yok** — `DELETE /api/bookmarks?ids=…` yerine N ayrı `DELETE /api/bookmarks/:id`. N>10 için anlamlı latency. Listing Queue gibi yoğun ekranlara geçerken backend bulk endpoint eklenmeli (ve o zaman "tek transaction, tek hata" davranışına geçilir).

## Referans Alınması İçin Checklist (Bir Sonraki Ekran)

Bir ekran bulk aksiyon kuruyorsa:

- [ ] Tek `ConfirmDialog`, bulk-specific preset (`confirmPresets.xxxBulk(count)`).
- [ ] Sequential `await mutateAsync` (aksini yazılı gerekçelendirmeden paralel geçme).
- [ ] İlk hata → dialog açık kalmalı, "Tekrar dene" görünmeli, seçim korunmalı.
- [ ] `onSuccess`'te `clearSelection()` (hatadan önce değil).
- [ ] BulkActionBar `onDismiss` seçimi tamamen temizler — confirm akışı dışında manuel iptal yolu.
- [ ] React Query `invalidateQueries` ilgili listelerde çağrılır (ör. bookmarks + references her ikisi etkileniyorsa ikisi de invalidate).
- [ ] Test: "bulk action → preset dialog açılır", "dismiss → seçim temizlenir" senaryoları `tests/unit/<ekran>-page.test.tsx` içinde yer almalı (Bookmarks testleri birebir şablon).

## İleride Kilitlenecek

- **Toplu sonuç toast'ı / banner'ı** — Notification Center primitive'i geldiğinde. O zaman bu notun "Kullanıcıya Görünürlük" bölümü güncellenir.
- **Backend bulk endpoint'leri** — performans gerektiğinde eklenir, o zaman sequential client akışı tek request'e indirgenir ama confirm UX aynı kalır.
