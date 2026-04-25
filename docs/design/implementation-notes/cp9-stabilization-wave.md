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

### T-39 — Bookmarks promote dialog → ConfirmDialog migrasyonu

**Scope (kilitli):**
- [bookmarks-page.tsx:352](../../../src/features/bookmarks/components/bookmarks-page.tsx)
  manuel overlay div + manuel kart kaldırılır
- [ConfirmDialog](../../../src/components/ui/ConfirmDialog.tsx)
  primitive tüketilir
- T-40'ta kurulan `useFocusTrap` ConfirmDialog primitive'i içinde mi
  tüketiliyor? **Doğrulama gerekli:** ConfirmDialog mevcut implementasyonu
  okunur, focus trap yoksa T-40'ta hook ConfirmDialog'a da eklenir
  (T-39'un kendisi yalnızca migrasyon — primitive davranışı T-40
  kapsamında)

**Yasaklar:**
- ConfirmDialog API genişletmesi YASAK
- Yeni varyant YASAK
- Backend mutation davranışı (promote API) DOKUNULMAZ

**Test sözleşmesi:**
- `tests/unit/bookmarks-page.test.tsx` mevcut promote senaryolarını
  güncelle: manuel overlay yerine ConfirmDialog primitive query
- Kullanıcı görünen davranış (onay → mutation, iptal → kapanır)
  davranışsal kalır

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

## Sıralama (kilitli)

1. **T-38** — Toast primitive terfisi (hak edilmiş, 3 tüketim eşzamanlı migrasyon)
2. **T-40** — Focus trap hook + dialog/drawer Escape/initial focus (CRITICAL a11y)
3. **T-39** — Bookmarks promote dialog → ConfirmDialog
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
