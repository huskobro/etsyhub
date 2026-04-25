# Admin Product Types — Data Model Carry-Forward (T-25)

## Bağlam

T-25, `src/features/admin/product-types/product-types-manager.tsx` ekranını
Table primitive ailesine taşıdı (CP-6 dalgası). Canvas'ın tam hedefi (status
toggle, recipe sayısı, usage sayısı, pasif satır sub-copy) bu sprint
**kapsamı dışında** kaldı çünkü domain modeli ilgili alanları içermiyor.
Bu doküman boşlukları ve unblock için gereken adımları kayda geçirir.

## Canvas hedefi vs mevcut model

`docs/design/EtsyHub/screens-b.jsx` artboard `AdminProductTypes` (satır
211-283) şu sözleşmeyi kuruyor:

| Kolon | Canvas hedefi | T-25 karşılığı |
|-------|--------------|----------------|
| Tip | thumb + name + (pasifse "Kullanıcı panelinde gizli" sub-copy) | name (sub-copy yok — `enabled` alanı yok) |
| Slug | mono 11px muted | OK (key alanı) |
| Aspect | mono 11px | OK |
| Recipe | mono sağa hizalı sayı | "—" placeholder |
| Usage | mono sağa hizalı sayı (0 muted) | "—" placeholder |
| Durum | Toggle on/off | Toggle disabled — `enabled` yok |
| Action | `⋯` dots menü | Sil butonu (Menu primitive yok) |

Toolbar canvas hedefi: search + 3 chip (`Tümü · N`, `Aktif · N`, `Pasif · N`)
+ "Yeni tip" CTA. T-25'te chip'ler `Tümü / Sistem / Custom` üzerinden çalışır
çünkü `Aktif/Pasif` ayrımı için datada `enabled` alanı yok.

Subtitle canvas hedefi: `7 tip · 4 aktif`. T-25'te `7 tip` (aktif sayısı
hesaplanamaz).

## Eksik alanlar

`prisma/schema.prisma` içindeki `ProductType` modelinde şu alanlar yok:

1. **`enabled Boolean @default(true)`** — Toggle veri kaynağı, kullanıcı
   panelinde tipin görünür/gizli olmasını kontrol eder.
2. **Aggregate count'lar** — GET `/api/admin/product-types` şu anda yalın
   item listesi döner. Recipe ve Usage sayıları için Prisma `_count` join'i
   gerekir:
   ```ts
   prisma.productType.findMany({
     include: {
       _count: { select: { recipes: true, bookmarks: true, references: true, listings: true } }
     }
   })
   ```
   Endpoint sözleşmesi `{ items: ProductTypeRow[] }`'da `recipes` ve
   `usage` (aggregate of bookmarks+references+listings) alanları eklenir.

## Migration tetikleyici

Bu sprint açılır:

- 2. data ihtiyacı: kullanıcı paneline ürün tipi visibility (örn. yeni
  variation üretirken yalnız `enabled=true` tipler listelenir), VEYA
- Wizard governance: Trend Stories / Variation wizard'ında ürün tipi seçimi
  başlangıçta hangilerinin sunulacağını admin kontrol etsin.

Tetikleyici geldiği gün:

1. `ProductType` modeline `enabled Boolean @default(true)` eklenir.
2. Migration: tüm mevcut satırlara `enabled = true` set edilir.
3. PATCH endpoint `enabled` alanını destekler.
4. GET endpoint `_count` join'iyle recipe/usage döner.
5. T-25 Toggle'da `disabled` kaldırılır, `onChange` mutation'a bağlanır.
6. Chip filtreleri canvas formatına döner (`Tümü / Aktif / Pasif`).
7. Recipe/Usage hücreleri gerçek sayıları gösterir; 0 muted, dolu normal.
8. Pasif sub-copy: `!enabled && "Kullanıcı panelinde gizli"`.

## Toggle 1. kullanım onayı

Toggle yerel yardımcısının (`src/features/admin/_shared/toggle.tsx`) **gerçek
1. ekran kullanımı** T-25'te gerçekleşti — visual yerleşim ve sözleşme
(role="switch", aria-checked, disabled prop) doğrulandı. Backend `enabled`
alanı geldiği gün `disabled={false}` + `onChange={toggleMutation}` aktive
olur; Toggle sözleşmesi (`on`, `onChange`, `size?`, `disabled?`) korunur.

T-26 (Feature Flags) Toggle'ın 2. kullanımı olur. Brief 5.1 carry-forward #1
gereği üçüncü tüketici geldiğinde Toggle `src/components/ui/` katmanına
terfi edilir.

## Action menüsü

Canvas'ta her satırda `⋯` dots menü vardı (Edit, Duplicate, Archive vs.).
Menu primitive henüz yok; bu sprintte action olarak yalnız "Sil" butonu
korundu (custom satırlar için). Menu primitive geldiği sprintte her satıra
unified `⋯` menü taşınır; Sil aksiyonu o menünün altına iner.

## İlgili belgeler

- Brief: `docs/design/implementation-brief.md` satır 230 (T-25 satırı)
- Canvas: `docs/design/EtsyHub/screens-b.jsx` artboard `AdminProductTypes`
- Toggle sözleşmesi: `src/features/admin/_shared/toggle.tsx` (header doc)
