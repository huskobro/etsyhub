# Shell Strategy — PageShell vs Layout Band

**Karar tarihi:** 2026-04-24
**Bağlam:** T-15 (Bookmarks) migrasyonu sonrası, References / Collections / Trend Stories / Admin ekranlarına geçmeden önce shell seçiminin primitive-first ilkesiyle uyumlu biçimde kilitlenmesi.
**İlgili commit:** `f96a56d` (Bookmarks primitive migrasyonu)

## Karar Özeti

İki shell modelimiz var; **her ekran ikisinden birini** bilinçli seçecek, karışık kullanmayacak.

| Model | Ne sağlar | Ne gerektirir | Ne zaman kullanılır |
|---|---|---|---|
| **Layout band** — `(app)/layout.tsx` + `(admin)/admin/layout.tsx` | Sidebar + `max-w-content` + `p-6` + viewport scroll + `h-screen` | Ekran kendi başlık / aksiyon / filtre satırını doğrudan `<main>` içinde kurar | Editoryal iş akışı ekranları: liste / board / card-grid |
| **PageShell** — `@/components/ui/PageShell` (T-13) | Kendi `h-screen` + sidebar slot + topbar (56h) + toolbar band + density-aware pad | Layout band **devre dışı** kalacak — sayfa kendi shell'ini komple taşıyacak | Full-bleed kokpit ekranları: editörler, trace sayfaları, admin monitor tabloları |

## Ekran Bazlı Atama

### Layout band'de kalacak (default)

Bu ekranlarda topbar zaten küçük bir başlık + aksiyon barından ibaret. `max-w-content` editoryal okunabilirliği koruyor. PageShell getirmezdi.

- `bookmarks/` (T-15 — migrasyon tamam)
- `references/`
- `collections/`
- `trend-stories/`
- `competitors/` (liste)
- `dashboard/`
- `settings/`
- admin düz formları: `admin/feature-flags/`, `admin/theme/`, `admin/users/`, `admin/product-types/`, `admin/scraper-providers/`, `admin/audit-logs/`

### PageShell'e geçecek (gerektiğinde)

Bu ekranların hepsinde ya **full-bleed tablo/timeline**, ya **çift-yönlü density**, ya **iç-scroll / sabit topbar** ihtiyacı var. Layout band'in `max-w-content` constraint'i veri yoğunluğunu bozar, `h-screen` iki katmana binince çakışır.

- `admin/jobs/` — job monitor tablosu + filtreler + sabit topbar, density="admin"
- `admin/page.tsx` → admin dashboard (üst metrik + operational panel)
- ileride eklenecek: **Job Detail** (timeline + log + artifact paneli), **Prompt Playground** (editör + preview çift panel), **Selection Studio / Mockup Studio / Listing Builder** (full-bleed canvas)
- `competitors/[id]/` (rakip detay) — toolbar band'li listeleme, PageShell adayı

### Özel durum: auth + dev

- `(auth)/login/`, `(auth)/register/` — shell yok, hiçbir layout çalışmaz (public)
- `(dev)/primitives/` — geliştirici galerisi, custom layout kullanmaya devam eder

## Neden Layout Band Default?

Editoryal akış ekranlarının %80'i `başlık + aksiyon + toolbar + grid` kalıbını izliyor. Bu kalıp layout band içinde 6 satır JSX'le ifade ediliyor; PageShell sarmalı aynı çıktıyı veriyor ama her ekran için `sidebar={<Sidebar />}` prop'unu tekrar geçmeyi ve auth guard'ı ekran seviyesinde kurmayı zorluyor. Auth/session `layout.tsx`'te resolve olduğu için PageShell'e sidebar prop'u geçmek tekrar iş.

**Kural:** Primitive-first gevşemesini engellemek için ekran kendi `<h1>` ve aksiyon satırını doğrudan JSX ile değil, sonraki T-16+ adımında gelecek bir **`PageHeader`** primitive'i ile ifade edecek. Yani layout band + PageHeader = minimum primitive seti. PageShell tek dosyada sidebar + topbar + toolbar + density + scroll'ü birleştiren daha büyük primitive olarak kalacak.

## Neden PageShell Editör/Monitor Ekranlarında?

- **`h-screen` kritik** — job monitor / editor ekranlarında toolbar sabit, içerik scroll etmeli. Layout band scroll'ü `<main>` seviyesinde; toolbar scroll ile birlikte gider.
- **Density="admin"** — `p-4` ve daha dar row-h, admin monitor tablolarının yoğunluğu için tasarlandı; layout band tek density'ye kilitli (`p-6`).
- **Full-bleed** — editörlerde `max-w-content` (1120px) darlık yaratır; PageShell kendi `main` elementi `max-w` koymuyor.

## PageShell Kullanımı için Geçiş Kuralı

Bir ekran PageShell'e geçtiğinde:
1. `layout.tsx` içindeki ortak `<div h-screen><Sidebar /><main></main></div>` sarmalı bu ekranda **atlanmalı** (yoksa `h-screen` iç içe girer).
2. Bu Next.js App Router'da route group layout'unu değiştirmeden mümkün değil. Çözüm: ilgili ekran ailesi kendi route group'una ayrılır (`(app-shell)/jobs/`) veya layout içinde `children` kontrolüyle shell atlanır.
3. Pratik tercih: **ilk PageShell adayı geldiğinde** (muhtemelen `admin/jobs/`) layout.tsx'e `shellMode: "band" | "full"` pattern'i eklenir ve karar orada belgelenir.

Bu, bugün çözmemiz gereken bir problem değil — T-15'te PageShell'i by-pass etmemizin gerçek nedeni bu constraint, ve çözümünü PageShell'in ilk gerçek ihtiyacı geldiğinde kilitleyeceğiz.

## Primitive-first Uyum

Bu karar primitive-first çizgisini **gevşetmiyor**:

- Sidebar / NavItem / Toolbar / FilterBar / BulkActionBar / Card / Badge / Button / Chip / Input / StateMessage / Skeleton **her iki modelde de aynı** — primitive seti ekran içinden değişmiyor.
- PageShell de bir primitive; sadece daha büyük bir kompozit. Ekran onu "kullanmıyor" diye primitive kullanmamış olmuyor.
- Eksik görünen tek parça **PageHeader** primitive'i (başlık + subtitle + aksiyonlar + opsiyonel breadcrumb). Sonraki T-turunda eklenecek; o zamana kadar mevcut ekranlar inline `<h1>` + aksiyon div'i yazmaya devam ediyor.

## Açık İş

- [ ] **T-16 PageHeader primitive** — layout band ekranlarının topbar satırı için standart kompozit. Spec: `docs/design/EtsyHub/screens.jsx` içindeki her ekranın üst bandı kaynak.
- [ ] İlk PageShell ihtiyacı (`admin/jobs/`) geldiğinde `layout.tsx` shell-mode switch'i kilitlenecek.
- [ ] Bu karar notu yeni ekran tipleri eklendikçe güncellenmeli (ör. Listing Builder, Mockup Studio).
