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
- **Live updates (KOD-DOĞRU, scope sınırlı):** **Library** client-side
  8s `router.refresh` + tab-hidden pause (`LibraryClient.tsx:87,95`);
  **Review queue** 5s React Query refetchInterval
  (`review/queries.ts:282`, unsettled item varken). **Overview/
  Dashboard polling YOK** — `force-dynamic` server-rendered
  (`overview/page.tsx:17`), client polling değil. Pattern Library
  baseline; yeni server-rendered surface aynı pattern'i alır.

## 3. Invariants (değişmez)

- Top-level sidebar **9 öğe / 2 grup** (KOD-DOĞRU:
  `nav-config.ts:53-66` PRODUCE 7 + SYSTEM 2). **Closed-list =
  POLICY** (sabit array konvansiyonu — yeni öğe eklemeyi engelleyen
  runtime guard YOK; CLAUDE.md IA kuralı + code-review disiplini).
  Not: `Sidebar.tsx:23` yorumu "8 items" der (kod 9; yorum stale,
  davranışı etkilemez).
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
- Live update pattern (POLICY, şu an Library-only enforced):
  yeni server-rendered surface eklenince visibility-aware polling
  (`router.refresh` interval + tab-hidden pause) **uygulanmalı**;
  şu an yalnız Library bunu taşır (Overview/Dashboard force-dynamic,
  polling yok). SSE/WebSocket ileride eklenebilir, pattern bozulmaz.
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
