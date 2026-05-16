# App Shell / Navigation / Dashboard

> **AUTHORITATIVE — CURRENT.** Stage #1. Bu doc app shell, sidebar
> navigasyonu, command palette, notification center, Overview/
> Dashboard ve cross-surface widget'ların **güncel davranış +
> invariant** tanımıdır. Phase narrative DEĞİL.
>
> **Son güncelleme:** Phase 135 (2026-05-16)
> **Router:** `docs/claude/00-router.md`

---

## 1. Kapsam / Rol / Boundary

App shell = ürünün kalıcı çerçevesi: sol sidebar (9 öğe / 2 grup),
ana içerik alanı, persistent floating "Active Tasks" paneli,
command palette (Cmd+K), notification center. Overview/Dashboard
operatörün ilk indiği özet ekran. **Boundary:** shell yalnız
navigasyon + cross-surface görünürlük; iş mantığı stage modüllerinde
(References/Batch/Review/Selection/Product/Settings). Shell bir
stage'in işini yapmaz.

## 2. Current behavior

- **Sidebar 9 öğe / 2 grup (closed-list):** PRODUCE = Overview,
  References, Batches, Review, Library, Selections, Products;
  SYSTEM = Templates, Settings. Yeni top-level eklenmez; yeni
  ekran ilgili stage'in alt-akışına yerleşir.
- **References** alt-view'lar tek surface'te birleşir: Pool
  (default) / Stories / Inbox / Shops / Collections.
- **Admin scope ayrı sidebar değil** — footer'da küçük rozet;
  admin-only section'lar Settings/Templates içinde role-gated.
- **Overview/Dashboard:** bekleyen aksiyonlar, aktif batch'ler,
  son üretim, hazır listing'ler, hata alan job'lar, mağaza özeti,
  günlük üretim hedefleri. Mockup-ready row → `/mockup/studio`
  doğrudan handoff (Phase 78).
- **Active Tasks floating panel:** job lifecycle görünürlüğü
  (persistent; mobile'da swipe-up bottom drawer).
- **Command palette** Cmd+K + keyboard-first review (j/k row nav,
  k=keep, r=reject, e=edit, ? help).
- **Mobile:** sidebar → bottom-tab (4 slot: Overview/References/
  Batches/Library) + "More" kebab. Tablo → kart liste, grid →
  2 sütun, split modal → full-screen bottom sheet.
- **Live updates:** server-rendered surface'ler visibility-aware
  polling (8s `router.refresh`; tab hidden → pause). Review queue
  5s. Manuel refresh gerektirmez.

## 3. Invariants (değişmez)

- Top-level sidebar **9 öğe / 2 grup closed-list** — yeni
  top-level YASAK (CLAUDE.md IA bölümü; closed-list istisnası
  Review için zaten uygulandı, yeniden kilitli).
- Yeni ekran/feature ilgili stage'in **alt-akışına** yerleşir
  (Batch Run → Batches "+ New Batch", Review Studio → `/review`,
  Job Detail → Batches/Logs + Active Tasks, Mockup Apply →
  Selections split-modal, Listing Builder → Products/Listing).
- Admin **ayrı sidebar değil**; role-gated section Settings/
  Templates içinde.
- Background automation (BullMQ workers + chokidar watcher)
  app başlangıcında `instrumentation.ts` ile **otomatik** başlar;
  ayrı `npm run worker` gerekmez (self-managed desktop ilkesi —
  CLAUDE.md). Health/liveness operatöre **ürün diliyle** gösterilir
  ("Background automation warming up" — teknik remediation değil).
- Cross-surface metric tutarlılığı: aynı kavram iki yüzeyde
  gösteriliyorsa **tek helper'dan** beslenir veya **açık farklı
  etiketlenir** (CLAUDE.md Cross-surface Metric Consistency).
- Live update pattern: server-rendered surface eklenince
  visibility-aware polling (`router.refresh` interval + tab-hidden
  pause); SSE/WebSocket ileride eklenebilir, pattern bozulmaz.
- Mobile responsive + Tauri-ready: app shell (sidebar+main+
  Active Tasks) olduğu gibi taşınır; local file actions
  browser-only assumption yapmaz.

## 4. Relevant files / Ownership

- `src/features/app-shell/` — shell layout, sidebar, command palette
- `src/features/dashboard/` + `src/features/overview/` — Overview/
  Dashboard
- `src/features/jobs/` — Active Tasks panel, job lifecycle
- `src/features/theme/` — design token / theme
- `src/app/(app)/layout.tsx` — sidebar + Active Tasks shell
- `src/app/(app)/overview/` , `src/app/(app)/dashboard/`
- `src/instrumentation.ts` — worker + watcher otomatik başlatma

## 5. Open issues / Deferred

→ `docs/claude/known-issues-and-deferred.md` (F: pre-existing
limitations; G: erken-abstraction guard'ları). App-shell'e özel
açık kritik item yok; multi-store/scheduling out-of-scope.

## 6. Archive / Historical pointer

Tarihsel detay (IA Phase 1-39 closed-list kararları, Active Tasks
evrimi, automation instrumentation hook) → `docs/claude/archive/
phase-log-12-96.md` (NOT authoritative; günlük çalışmada inilmez).
Canonical IA + closed-list kuralı → `CLAUDE.md` "Bilgi Mimarisi".
