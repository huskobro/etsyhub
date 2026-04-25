# CP-9 — Stabilization & Consistency Wave

**Tarih:** 2026-04-25
**Bağlam:** CP-9'un orijinal kapsamı (Selection Studio + Mockup Studio)
[cp9-selection-mockup-honesty.md](./cp9-selection-mockup-honesty.md) ile
**dürüst yüzey kuralı** gereği reddedildi (Phase 5/8 backend'i hazır
değil). Audit'te görünür yüzey + a11y borçları envanterlendi. CP-9
yeniden "Stabilization & Consistency Wave" olarak çerçevelendi.
**Status:** Kilitli.

**Wave kuralları:**
- Backend (prisma / API / worker / provider) DOKUNULMAZ
- Yeni primitive YALNIZCA hak edilmiş terfi (3+ ekran tüketim sinyali)
- Karar dokümanı kod ÖNCESİ kilitlenir
- Sözleşmeden sapma → kod ile değil, doküman güncellemesiyle açılır
- Per-commit two-stage review (spec + code-quality)
- "Kullanıcıya görünen davranış / API sözleşmesi / a11y / loading-error
  feedback → düzelt; yalnızca iç refactor / küçük yorum / isimlendirme
  → erteleyebilir" kuralı korunur

## Audit özeti (kilitli kanıt tabanı)

**Görünür yüzey büyük açıkları:**
1. Bookmarks promote dialog: manuel overlay `<div role="dialog">` +
   manuel kart ([bookmarks-page.tsx:352](../../../src/features/bookmarks/components/bookmarks-page.tsx))
2. Admin Audit Logs: manuel `<table>` ([audit-logs/page.tsx:17](../../../src/app/(admin)/admin/audit-logs/page.tsx))
3. Admin Jobs: manuel `<table>` ([jobs/page.tsx:18](../../../src/app/(admin)/admin/jobs/page.tsx))
4. Admin Themes: manuel kart + manuel button + `bg-success/15` opacity
   ([themes-list.tsx:58](../../../src/features/admin/themes/themes-list.tsx))
5. Sidebar Logout: manuel `<button>` ([Sidebar.tsx:38](../../../src/features/app-shell/Sidebar.tsx))
6. Settings: manuel kart ([settings/page.tsx:9](../../../src/app/(app)/settings/page.tsx))

**Toast tüketim sayımı:** 6 manuel toast / 3 ekran (Competitors list +
detail + Trend Stories) → Toggle kuralı eşiği geçti → Toast primitive
**hak edilmiş terfi**.

**A11y borçları (CRITICAL + IMPORTANT):**
1. Dialog/Drawer Tab focus trap (4 yer) — keyboard-only kullanıcı modal
   arkasına Tab ile kaçabiliyor — **CRITICAL**
2. AddCompetitorDialog + PromoteToReferenceDialog Escape + initial focus
   eksiği — `aria-modal="true"` taahhüdü ile davranış uyuşmazlığı
3. Competitor detail tab ArrowLeft/Right yok
4. Toast aria-live ton ayrımı tutarsızlığı (Trend doğru, diğerleri eksik)
   → T-38 ile tek atışta düşer
5. Skip link + landmark yapısı — wave kapsamı dışı (ayrı dalga)
6. Multi-select klavye runtime test gerekli — wave kapsamı dışı

## Wave omurgası — 6 commit

**Sıralama gerekçesi:** A11y kritik işler içerikten önce. Toast terfisi
T-38'de açılır çünkü T-40 dialog/drawer odaklı çalıştığında doğal olarak
toast tüketicilerine de değer; ama Toast'u T-40'tan önce kurmak T-40'ın
toast davranışını da aynı primitive üzerinden test etmesini sağlar.
T-43 polish commit'i wave sonunda enerji/scope baskısı olursa ilk
kesilecek.

### T-38 — Toast primitive terfisi

**Hak edilmiş terfi gerekçesi:**
- 6 manuel toast / 3 ekran tüketim sinyali — Toggle kuralı eşiği geçti
- T-33/T-34/T-36 karar dokümanlarında "3+ ekran sinyali olunca terfi"
  açıkça carry-forward edilmiş

**Scope (kilitli):**
- Yeni primitive: `src/components/ui/Toast.tsx`
- API: `<Toast tone="success" | "error" | "info" message={...} role="status|alert" />`
- aria-live davranışı içeride sabit:
  - `tone="success"` → `role="status" aria-live="polite"`
  - `tone="info"` → `role="status" aria-live="polite"`
  - `tone="error"` → `role="alert" aria-live="assertive"`
- Görsel: mevcut manuel toast (rounded border + bg-{tone}-soft + text)
  paterni primitive'e taşınır, yeni estetik keşif YOK
- Auto-dismiss YOK (controlled component, parent state ile temizlenir —
  mevcut paternle uyumlu)
- Konum YOK (parent yerleştirir; primitive yalnızca atom)

**Tüketim noktaları (T-38'de migrasyon):**
- [competitor-list-page.tsx](../../../src/features/competitors/components/competitor-list-page.tsx)
- [competitor-detail-page.tsx](../../../src/features/competitors/components/competitor-detail-page.tsx)
- [trend-stories-page.tsx](../../../src/features/trend-stories/components/trend-stories-page.tsx)

**Yasaklar:**
- Auto-dismiss timer YASAK (state karmaşası, scope dışı)
- Toast container / portal / stack yönetimi YASAK (ayrı sorun)
- Yeni varyant (warning, neutral) YASAK — 3 tüketim hak edilmiş, fazlası YOK
- İkon zorunluluğu YASAK (mesaj odaklı, ikon opsiyonel slot ileride)

**Test sözleşmesi:**
- `tests/unit/toast.test.tsx` (yeni)
  1. tone="success" → role="status" + aria-live="polite"
  2. tone="info" → role="status" + aria-live="polite"
  3. tone="error" → role="alert" + aria-live="assertive"
  4. message render edilir
  5. tone="success" → bg-success-soft sınıfı
  6. tone="error" → bg-danger-soft sınıfı
- Mevcut sayfa testleri (competitor list/detail, trend stories) **kırılmamalı**

### T-40 — Dialog/Drawer Tab focus trap + Escape/initial focus

**Sıra gerekçesi:** A11y CRITICAL borç. Klavye-only kullanıcı için
erişim engeli; en yüksek kullanıcı değeri.

**Scope (kilitli):**
- Yeni hook: `src/components/ui/use-focus-trap.ts`
- API: `useFocusTrap(ref: RefObject<HTMLElement>, isOpen: boolean): void`
- Davranış:
  - `isOpen` true → mount'ta ref içindeki ilk focusable element'e focus
  - Tab tuşu → focusable elementler arasında dolaşır, son element'ten
    sonra ilk element'e wraps
  - Shift+Tab → ters yönde wraps
  - `isOpen` false → cleanup, focus trap deaktif

**Tüketim noktaları (T-40'ta uygulama):**
- [trend-cluster-drawer.tsx](../../../src/features/trend-stories/components/trend-cluster-drawer.tsx) — Escape + initial focus zaten var (T-37 fix), Tab boundary eklenir
- [add-competitor-dialog.tsx](../../../src/features/competitors/components/add-competitor-dialog.tsx) — Escape + initial focus + Tab boundary (3'ü birden)
- [promote-to-reference-dialog.tsx](../../../src/features/competitors/components/promote-to-reference-dialog.tsx) — Escape + initial focus + Tab boundary (3'ü birden)
- (T-39 sonrası) Bookmarks promote ConfirmDialog — `ConfirmDialog` primitive zaten kuruyorsa hook tüketimi orada doğrulanır

**Hook terfisi gerekçesi:**
- 3+ tüketim noktası (drawer + 2 dialog + ConfirmDialog primitive
  potansiyel) — Toggle kuralının hook karşılığı
- Primitive değil davranış helper'ı, shared katmanda meşru
- Aynı useEffect mantığını 4 yerde kopyalamak DRY ihlali

**Yasaklar:**
- Focus trap **library import YASAK** (focus-trap-react vb.) — kendi
  hook'umuz, 30-50 satır vanilla
- Inert attribute polyfill YASAK
- Tabindex manipulation (programmatic tabindex=-1 atomu) YASAK — yalnızca
  Tab event preventDefault + manuel focus yönlendirme
- Backdrop click + Escape T-37 paterni korunur (hook BU davranışlara
  girmez, sadece Tab boundary)

**Test sözleşmesi:**
- `tests/unit/use-focus-trap.test.tsx` (yeni)
  1. isOpen=true mount → ilk focusable element focus alır
  2. Tab → bir sonraki focusable, son element'te → ilk element wrap
  3. Shift+Tab → bir önceki, ilk element'te → son element wrap
  4. isOpen=false → focus trap deaktif (Tab normal akış)
- AddCompetitorDialog test: Escape → onClose, initial focus → ilk input,
  Tab boundary → modal dışına çıkmaz
- PromoteToReferenceDialog test: aynı 3 senaryo
- TrendClusterDrawer test: Tab boundary senaryosu eklenir (Escape +
  initial focus zaten T-37'de)

### T-39 — Bookmarks promote dialog → standart disclosure pattern + a11y alignment

**Yeniden çerçeveleme (2026-04-25):**
Audit'in ilk metni "ConfirmDialog migrasyonu" diyordu, fakat
ConfirmDialog'un mevcut sözleşmesi sade yes/no confirmation:
`title` + `description` + `confirmLabel/cancelLabel` + `onConfirm`,
**children slot YOK**, autoFocus `Vazgeç` üstünde, tone
destructive/warning/neutral. Bookmarks promote akışı ise
**disclosure-style**: kullanıcıdan productType seçimi alır,
confirmation değildir. ConfirmDialog'a children slot eklemek
primitive sözleşmesini bozar (CP-5 lock'una ters; "yeni primitive
keşfi YASAK" kuralının bilinçsiz ihlali).

T-39 yeniden çerçevelendi: promote dialog **AddCompetitorDialog
+ PromoteToReferenceDialog** ile aynı manuel disclosure pattern'ine
hizalanır. ConfirmDialog primitive'e dokunulmaz.

**Scope (kilitli):**
- [bookmarks-page.tsx:334-394](../../../src/features/bookmarks/components/bookmarks-page.tsx)
  `PromoteDialog` mevcut manuel overlay yapısı korunur ama
  AddCompetitorDialog imza setine hizalanır:
  - `dialogRef = useRef<HTMLDivElement | null>(null)`
  - Initial focus ref: productTypes varsa `<select>`, yoksa close butonu
  - `useFocusTrap(dialogRef, true, initialFocusRef)` — T-40 hook tüketimi
    (3. ekran)
  - Escape handler → `onClose()` (busy / `isPending` iken iptal edilmez)
  - Backdrop click handler → `event.target === event.currentTarget`
    guard ile `onClose` (T-37 paterni); `isPending` iken iptal edilmez
  - `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
    (mevcut başlığa `id="promote-dialog-title"` eklenir)
  - `focus-visible:ring-accent` sınıfları close button + select +
    submit + Vazgeç butonlarına eklenir (AddCompetitor paterni)
- Mevcut productType select + submit + error mesajı + isPending
  davranışı **dokunulmaz** (kullanıcıya görünen davranış değişmez)
- Vazgeç butonu eklenir (AddCompetitor paterni — submit + cancel
  ikilisi). Mevcut "Kapat" link-text close button da korunur
  (header sağında); kullanıcı her iki yoldan kapatabilir.

**T-40 hook tüketim doğrulaması:**
- T-40 commit'i 3 yer kapsıyordu: trend-cluster-drawer +
  add-competitor-dialog + promote-to-reference-dialog
- T-39 ile bookmarks promote 4. tüketim olur — Toggle kuralı
  (3+ ekran tüketim sinyali) hook için **fazlasıyla karşılanır**.
  ConfirmDialog primitive'ine focus trap eklemek bu wave'de
  GEREKMİYOR (ConfirmDialog Radix Dialog kullanıyor, kendi
  modal trap'ı var; Radix `Dialog.Content` focus management
  davranışı standart — gözlem [confirm-dialog.tsx:62-77](../../../src/components/ui/confirm-dialog.tsx)).

**Yasaklar:**
- **ConfirmDialog primitive'i KULLANMA** (yanlış soyutlama —
  promote confirmation değil disclosure)
- **ConfirmDialog API genişletmesi YASAK** (children slot eklemek
  primitive sözleşmesini bozar)
- Yeni primitive yazma YASAK (manuel disclosure pattern AddCompetitor
  ile aynı satır seviyesinde kalır)
- Backend mutation davranışı (`promote` API, productType validation)
  DOKUNULMAZ
- Kullanıcı görünen akış değişmez (productType select → submit →
  mutation; iptal → close)
- AddCompetitorDialog'ı **referans olarak okuma**, ortak helper
  çıkarma YASAK (3 disclosure dialog ortak pattern'i tutar; helper
  terfisi 4. dialog ihtiyacı doğduğunda gündeme gelir)

**Test sözleşmesi:**
- `tests/unit/bookmarks-page.test.tsx` mevcut promote senaryoları
  güncellenir:
  - Promote butonu click → dialog açılır (`role="dialog"` query)
  - Dialog `aria-modal="true"` + `aria-labelledby` ile başlık bağı
  - ProductType select render edilir (productTypes prop'undan)
  - Submit → `promote` mutation çağrılır + dialog kapanır
  - Escape → dialog kapanır
  - Backdrop click → dialog kapanır
  - isPending true iken Escape + backdrop → iptal edilmez
  - Tab boundary: dialog içinde focus döner (en azından focus-trap
    kütüphanesi yerine kendi hook'umuzun çağrıldığı doğrulanır;
    AddCompetitor testindeki paterne uygun)
- Mevcut "Referansa Taşı" davranışsal akışı korunur (kullanıcıya
  görünen davranış değişmez)

### T-41 — Competitor detail tab ArrowLeft/Right

**Scope (kilitli):**
- [competitor-detail-page.tsx](../../../src/features/competitors/components/competitor-detail-page.tsx)
  date-range tabs (`30d` / `90d` / `365d` / `Tümü`)
- ArrowLeft → önceki tab focus + select
- ArrowRight → sonraki tab focus + select
- Home → ilk tab, End → son tab (opsiyonel — WAI-ARIA pattern, ekleyebiliriz)
- Roving tabIndex zaten T-34'te kuruldu

**Referans pattern:** [window-tabs.tsx](../../../src/features/trend-stories/components/window-tabs.tsx)
T-36 paterni — onKeyDown handler + index hesaplama + focus().

**Yasaklar:**
- Yeni primitive YASAK
- Tab semantiği (route nav DEĞİL client tab) — T-34 kararıyla aynı
- aria-controls / role="tab" / role="tabpanel" yapısı dokunulmaz

**Test sözleşmesi:**
- `tests/unit/competitor-detail-page.test.tsx` mevcut testlere +2-3
  senaryo:
  - ArrowRight → sonraki tab aria-selected="true" + focus
  - ArrowLeft (ilk tabda) → son tab wraps
  - Home/End davranışı (ekleyeceksek)

### T-42 — Admin görünür tablolar Table primitive consume

**Scope (kilitli):**
- [admin/audit-logs/page.tsx:17](../../../src/app/(admin)/admin/audit-logs/page.tsx)
  manuel `<table>` → [Table](../../../src/components/ui/Table.tsx) primitive
- [admin/jobs/page.tsx:18](../../../src/app/(admin)/admin/jobs/page.tsx)
  manuel `<table>` → Table primitive
- Header/cell sınıfları, semantic markup, status badge'leri (varsa Badge
  primitive tone)

**Yasaklar:**
- Backend (audit-logs API, jobs API) DOKUNULMAZ
- Sayfa veri akışı (server component fetch) dokunulmaz
- Yeni filtre/toolbar EKLENMEZ — yalnızca migrasyon

**Test sözleşmesi:**
- Bu sayfalar admin-only ve mevcut testleri yoksa minimal smoke test
  (header render + en az bir satır)

### T-43 — Themes + Sidebar Logout + Settings cleanup (POLISH)

**Scope (kilitli):**
- [themes-list.tsx:58](../../../src/features/admin/themes/themes-list.tsx)
  manuel kart → Card primitive; manuel button → Button primitive;
  `bg-success/15` opacity → Badge tone="success"
- [Sidebar.tsx:38](../../../src/features/app-shell/Sidebar.tsx)
  Logout manuel button → Button variant="ghost" size="sm"
- [settings/page.tsx:9](../../../src/app/(app)/settings/page.tsx)
  manuel kart → Card primitive

**Polish konumlandırması:**
- T-43 wave'in **son sıradaki polish commit'i**
- Enerji/scope baskısı oluşursa **ilk kesilecek commit** budur
- Carry-forward planı: T-43 atılırsa "stabilization wave kalan polish
  süpürgesi" carry-forward, sonraki dalgaya bağımsız olarak alınır

**Yasaklar:**
- Theme editor davranışı (form mantığı) DOKUNULMAZ
- Sidebar nav yapısı (NavItem primitive zaten tüketildi) DOKUNULMAZ
- Settings sayfa veri akışı DOKUNULMAZ

## Kapsam dışı (carry-forward — sonraki dalgalara)

| Konu | Niye | Tetik |
|---|---|---|
| Skip link + landmark yapısı | Layout düzeyi dokunuş, ayrı dalga | Ayrı a11y dalgası |
| Multi-select klavye (Ctrl+A, tab order) | Runtime test gerekli | E2E test ortamı |
| Toast container / portal / stack | Çoklu eşzamanlı toast yokken erken | 2+ eşzamanlı toast ihtiyacı |
| Toast auto-dismiss | UX kararı, scope dışı | Üç sayfada manuel timer ihtiyacı |
| Focus-visible token soyutlaması | MINOR, süsleme | Token registry düzenlemesi |
| Bookmarks/References checkbox aria-label | Runtime test | E2E |
| ConfirmDialog focus trap entegrasyonu | T-40'ta tüketilir, primitive değişimi gerekirse ayrı doğrulama | T-40 sırasında |
| AdminThemes davranış (form) | T-43 yalnızca chrome migrasyonu | Theme editor refactor |
| collection-create-dialog a11y hizalama | Wave audit'inde kaçırılmış 5. dialog: Escape + backdrop + initialFocus + Tab boundary yok; useFocusTrap 5. tüketim noktası olarak eklenmeli | Sonraki a11y dalgası (öncelikli) |
| T-42 admin sayfaları smoke test | Server component test altyapısı yok (Next 14 RSC adapter); audit-logs + jobs için header render + en az bir satır | Test altyapısı kurulumu |
| api-competitors integration test isolation | Full-suite paralelizmde tag-service DB state çakışması; izole 14/14 yeşil | Test parallelism / DB isolation görevi |
| Lint baseline temizliği | `auth-shell.tsx:103` unescaped entity + `competitor-list-page.tsx:65` exhaustive-deps; CP-9 öncesi mevcut | Lint hijyen sweep |
| Opacity-syntax kalıntıları sweep | `tags/color-map.ts`, `seasonal-badge.tsx`, `trend-membership-badge.tsx`, `scraper-config-form.tsx`, `BulkActionBar.tsx`, `confirm-dialog.tsx` — Badge tone migrasyonu veya semantic-soft token'a geçiş | Token discipline polish dalgası |
| PromoteToReferenceDialog Escape isPending guard | Bookmarks PromoteDialog'da var, PromoteToReference'ta yok; davranış kıran değil, kozmetik tutarsızlık | Disclosure pattern hizalama |

## Sıralama (kilitli)

1. **T-38** — Toast primitive terfisi (hak edilmiş, 3 tüketim eşzamanlı migrasyon)
2. **T-40** — Focus trap hook + dialog/drawer Escape/initial focus (CRITICAL a11y)
3. **T-39** — Bookmarks promote dialog → standart disclosure pattern + a11y alignment
4. **T-41** — Competitor detail tab ArrowLeft/Right
5. **T-42** — Admin Audit Logs + Jobs Table primitive
6. **T-43** — Themes + Sidebar Logout + Settings polish (wave sonunda enerji düşerse ilk kesilecek)

**Toplam:** 6 commit. T-43 esnek; T-38..T-42 zorunlu omurga.

## Tetikleyici (karar revize)

Aşağıdaki sinyallerden **biri** wave kapsamını revize edebilir:
- Audit'te kaçırılmış kritik a11y/davranış borcu yüzeye çıkarsa →
  carry-forward'a yazılır, sıraya girer
- Bir commit içinde sözleşmeden zorunlu sapma gerekirse → doküman
  güncellemesi kod ÖNCESİ yapılır, kod sonrasına bırakılmaz

Bu doküman **kilitlidir**. T-38..T-43 implementer'ı bu sıralamadan ve
scope'tan sapmaz.
