# References Intake (References / Bookmarks / Collections / Competitors / Trend / Add Reference)

> **AUTHORITATIVE — CURRENT.** Stage #2 (pipeline başı — intake).
> References Pool ve tüm intake yüzeyleri (Add Reference modal,
> Bookmark Inbox, Competitor, Trend Stories, Collections) **güncel
> davranış + invariant** tanımı. Phase narrative DEĞİL.
>
> **Son güncelleme:** Phase 135 (2026-05-16)
> **Router:** `docs/claude/00-router.md` · **Sonraki stage:**
> `docs/claude/batch-pipeline.md`

---

## 1. Kapsam / Rol / Boundary

References = üretim öncesi **input/havuz** stage'i. Tek shell +
5 sub-view: Pool (default — kürate referans), Stories (rakip yeni
listing feed), Inbox (bookmark intake), Shops (Etsy shop analiz),
Collections (operatör gruplama). **Add Reference** = tek canonical
intake modal (4 yol: URL / Upload / From Bookmark / From Local
Library). **Boundary:** intake yalnız kaynak toplar; üretim
**Batch** stage'inde (References → Batch). References'tan
doğrudan Product/Mockup'a geçilmez.

## 2. Current behavior

- **References Pool:** k-card grid; her kartta hover **"Add to
  Draft"** (primary) → batch queue panel (Phase 45+). Kart "In
  Draft" chip + "Remove from draft" + batch lineage chip
  (`/batches?referenceId=`). Bulk-bar "Add N to Draft".
- **Add Reference modal (canonical, tek door):** 5 sub-view
  topbar'ından `?add=ref` ile açılır. 3 sibling tab + 4. tab:
  - **URL tab:** multi-URL queue (paste-split, per-row pre-fetch
    `<img>` preview, source detection Etsy/Pinterest/Creative
    Fabrica/direct/unknown, server-side title fallback). Etsy/CF
    listing-URL detection → "View all images" (Phase 38'de
    pasifleştirildi — WAF; passive disclosure, request atmaz).
  - **Upload tab:** drop-zone + multi-file + folder-mode
    (`webkitdirectory`) + multi-folder grouping + aggregate
    progress.
  - **From Bookmark tab:** multi-select + Select all/Clear +
    bulk promote.
  - **From Local Library tab:** LocalLibraryAsset → folder picker
    + multi-select → bookmark → reference (migration-free;
    Phase 40).
  - Canonical 5 product type chip (clipart bundle / wall art /
    bookmark / sticker / printable) + last-used persistence
    (localStorage) + collection optional. Duplicate dedup
    (intake-level; mevcut entity reuse, replace YOK).
- **Bookmark Inbox:** ham intake tampon; B1 SubInbox **table**
  layout (triage; Pool grid değil) + hover preview popover.
  Promote to Reference → REFERENCED status.
- **Competitor Analysis:** shop URL/name → review-based ranking
  (satış sinyali olarak review count; "kesin satış" gibi
  gösterilmez). Promote to Reference.
- **Trend Stories:** rakip yeni listing story-feed + trend
  cluster + seasonal badge. Promote/Bookmark/Reference aksiyonları.
- **Collections:** bookmark/reference/design gruplama.
- 5/5 sub-view topbar'da canonical "Add Reference" CTA aynı modal
  (Phase 33).

## 3. Invariants (değişmez)

- **Tek canonical intake door:** `AddReferenceDialog` (`?add=ref`).
  Eski `?add=url` ImportUrlDialog / UploadImageDialog /
  DashboardQuickActions = silinmiş dead/bridge (Phase 31).
  Yeni intake yolu bu modale **sub-tab** olarak takılır; ayrı
  top-level page açılmaz (CLAUDE.md Madde E source picking).
- **Output Bookmark** (Reference değil) — URL/Upload yolu bookmark
  yaratır; From Bookmark/Local promote ile reference. Doğrudan
  `POST /api/references` endpoint YOK (Phase 26 Karar A=3; ileride
  ayrı backend turu).
- **Digital-only product type'lar** (clipart/wall_art/bookmark/
  sticker/printable; canonical 5). Physical POD (tshirt/hoodie/
  dtf) intake'te canonical-key whitelist ile elenir; server
  `isSystem: true` + canonical key filter (Phase 28).
- **Add Reference → bookmark → reference** zinciri:
  `createAssetFromBuffer` → `createBookmark` (INBOX) →
  `createReferenceFromBookmark`. Cross-user isolation hard-enforced
  (userId scope; CLAUDE.md Multi-User).
- Source detection **client hostname regex** (server-side meta
  extraction YOK; title fallback `deriveTitleFromUrl` shared lib
  client+server aynı).
- **Page-level scraping (Etsy listing / CF product / Pinterest)
  pasif** — Datadome/Cloudflare WAF; passive detection korunur,
  request atılmaz (Phase 38; future companion backlog). Local
  Library + direct image URL + Upload + From Bookmark = aktif
  canonical.
- Inbox = **table** (triage), Pool = **grid** (browse) — B1
  SubInbox vs SubPool layout ayrımı (Phase 21; karıştırılmaz).
- 5 sub-view tek `ReferencesShellTabs` shell; tüm topbar'da aynı
  canonical Add Reference CTA (Phase 33).
- Used-news / dedupe protections (CLAUDE.md News Module): hard +
  soft dedupe; semantic dedupe ileride.

## 4. Relevant files / Ownership

- `src/features/references/` — Pool, ReferencesShellTabs,
  ReferencePoolCard, AddReferenceDialog
- `src/features/bookmarks/` — Inbox, BookmarkRow, BookmarkRowThumb
- `src/features/competitors/` — shop analiz, ranking
- `src/features/trend-stories/` — feed, cluster, seasonal
- `src/features/collections/` — gruplama
- `src/app/(app)/references/` `/bookmarks/` `/competitors/`
  `/trend-stories/` `/collections/`
- `@/lib/derive-title-from-url` — shared title fallback
- `src/server/services/scraper/` — etsy/CF listing-images
  (passive), parsers

## 5. Open issues / Deferred

→ `docs/claude/known-issues-and-deferred.md`:
- Schema migration turu: `SourcePlatform.CREATIVE_FABRICA` enum +
  direct `POST /api/references` endpoint + server-side
  `import-url` source resolver
- Browser companion / Chrome extension scraping (Etsy/CF/Pinterest
  — WAF; future backlog)
- Pre-existing TR/EN drift testleri (`trend-feed`,
  `competitor-detail` — legacy, regression değil)
- Reference detail/edit surface (Pool detail drawer — açılmadı)

## 6. Archive / Historical pointer

Tarihsel detay (Phase 18-41 References family canonicalization,
Add Reference modal evrimi, dead/bridge cleanup, Local Library
intake) → `docs/claude/archive/phase-log-12-96.md` (NOT
authoritative). Source picking + digital-only sınır canonical
kuralı → `CLAUDE.md` Madde D/E.
