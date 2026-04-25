# Admin Users — Eksik Kolonlar (Brief T-24 Carry-Forward)

**Tarih:** 2026-04-25
**Bağlam:** T-24 migrasyonu Table primitive'ine geçişi tamamlandı; mevcut
5 kolon faithful biçimde taşındı. Brief'in canvas hedefi 9 kolondu — kalan
4 kolon backend domain alanları olmadığı için ertelendi.

## Mevcut (taşındı)

E-posta · İsim · Rol · Durum · Oluşturma · (interaksiyon: rol/durum select +
ConfirmDialog akışı korundu)

## Eksik (carry-forward)

Canvas hedefiyle (`docs/design/EtsyHub/screens.jsx` artboard `admin-users`,
satır ~308-356) örtüşmek için eklenecek alanlar ve gereksinimleri:

1. **Mağaza sayısı** — `Store` ilişkisinin agregat sayımı (`_count.stores`)
2. **Plan rozeti** — billing modeli geldiğinde (`User.plan` veya
   `Subscription`); şimdilik backend yok
3. **Aktif iş sayısı (Jobs)** — `Job` ilişkisinin `status: "RUNNING"` filtreli
   sayımı; Job Engine henüz kurulmadı
4. **Toplam maliyet (Cost)** — `CostUsage` agregatı; admin cost ekranı
   geldiğinde aktive
5. **Son giriş** — `User.lastLoginAt` Prisma'ya eklenir; auth callback'inde
   set edilir
6. **Davet tarihi / davet eden** — Davet sistemi geldiğinde

## Davet CTA

Topbar'da `Davet et` butonu disabled. `POST /api/admin/users/invite` endpoint'i
(şifre sıfırlama davet akışıyla) eklendiğinde aktive edilir. Tooltip notu
(`title="Davet API'si henüz hazır değil"`) + `aria-describedby` mevcut.

## Tetikleyici

Bu kolonlardan herhangi 2'si için domain alanı eklendiği gün ayrı sprint
açılır (ör. "Admin Users — domain genişletme"). Burada eksik bırakılması
bilinçli scope kararı; primitive-first migrasyon korundu.

## Notlar

- Sıralama: yalnızca E-posta sortable (client-side cycle). Sunucu tarafı
  sort/pagination eklendiğinde TH sortable diğer kolonlara genişletilebilir.
- Filtreleme: 3 chip (Tümü / Sadece admin / Pasif) client-side. Liste
  büyüdükçe sunucu tarafı filtreye geçilmesi gerekebilir.
- Seçim: tek satır accent-soft; bulk action / multi-select kapsam dışıdır
  (admin Users için BulkActionBar yok — brief satır 103 ayrımı korunuyor).
