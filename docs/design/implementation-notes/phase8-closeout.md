# Phase 8 — Mockup Studio Closeout

> **Tarih:** 2026-05-02 (sync 2026-05-04 — V1 final closeout audit)
> **Status:** 🟡 **V1 Pending — A-O browser smoke pending (Apply + S8 + köprü + ZIP canlı PASS)** (HEAD `e4eb36d`+). Phase 8 V1 implementation complete (33 task, otomasyon gate'leri PASS — TS strict 0, 1674 + 946 test yeşil). Selection Studio entry render PASS; **QA fixture seed (`scripts/seed-qa-fixtures.ts`) + Phase 7→8 köprü aspectRatio resolve fix** sonrası: Apply page Quick Pack default "6 görsel üretilecek" + "Render et" enabled + S8 result page (10/10 görsel) + Phase 9 köprüsü (202 + listingId) + ZIP route (200 ZIP magic bytes) — **canlı PASS**. A-O ana akış tam yürünebilir; tam browser smoke (B/C/D/E submit→polling, I cover swap, J/K/L per-render retry/failed UI, M-O cross-user/toast/backdrop) kullanıcı/admin tarafında pending. Phase 8 self-contained (KIE bağımsız Sharp local renderer); runbook 4.2 honest-fail path YOK. Detay: [`./phase8-manual-qa.md`](./phase8-manual-qa.md) "Bulgular — 2026-05-04".
> **Spec:** [`../../plans/2026-05-01-phase8-mockup-studio-design.md`](../../plans/2026-05-01-phase8-mockup-studio-design.md)
> **Plan:** [`../../plans/2026-05-01-phase8-mockup-studio-plan.md`](../../plans/2026-05-01-phase8-mockup-studio-plan.md)
> **Manuel QA:** [`./phase8-manual-qa.md`](./phase8-manual-qa.md)
> **Asset prep (Task 31):** [`./phase8-asset-prep.md`](./phase8-asset-prep.md)
> **Phase 7 emsali:** [`./phase7-selection-studio.md`](./phase7-selection-studio.md)

## Özet

Mockup Studio Phase 8 V1 olarak teslim edildi. Veri modeli (`MockupTemplate`,
`MockupTemplateBinding`, `MockupJob`, `MockupRender`), provider abstraction
(in-house Sharp `local-sharp` primary + `dynamic-mockups` contract-ready stub),
deterministik 3-katman pack selection (cover + template diversity + variant
rotation), 5-class hata sözlüğü (`TEMPLATE_INVALID` / `RENDER_TIMEOUT` /
`SOURCE_QUALITY` / `SAFE_AREA_OVERFLOW` / `PROVIDER_DOWN`), URL primary state
mimarisi (`?t=`, `?customize=1`, `?templateId=X`), background render +
in-app completion toast (Phase 7 `useExportCompletionToast` emsali Phase 8'e
taşındı), partial complete first-class davranışı (failed slot'lar görünür +
retry/swap affordance), cover invariant atomic slot swap (`packPosition=0 ⇔
coverRenderId`), bulk ZIP download (cover-first filename ordering + manifest).

**Tek kategori (`canvas`)** + **8 template** (7 frontal + 1 perspective; perspective
Task 10 BLOCKED nedeniyle V1'de sadece schema/contract düzeyinde) + **6 ekran**
(S3 Apply, S1 Browse drawer, S2 Detail modal, S7 Job, S8 Result, Phase 9
köprüsü S8'deki active "Listing'e gönder" CTA — Phase 9 V1 handoff endpoint
canlı, listing draft yaratıp `/listings/draft/[id]` yönlendiriyor).

**Phase 6 + Phase 7 ile ilişki:** Phase 6 baseline (cost-budget, KIE provider,
Aşama 2B local mode) **dokunulmadı**. Phase 7 SelectionSet/SelectionItem veri
modeli, state machine, hook'ları (`useSelectionSet`, `useExportCompletionToast`
emsali) **dokunulmadı**. Phase 8 Phase 7 `ready` SelectionSet'lerini input
olarak alır; handoff service (Task 5) atomic transaction ile MockupJob create
eder. Phase 6 KIE flaky carry-forward note (`d439cf7`) Phase 8'i etkilemedi —
Phase 8 V1 KIE bağımsız (Sharp local render).

---

## Teslim edilen kapsam (spec §1.2 in-scope tikleri)

| Spec maddesi | Durum | Task |
|---|---|---|
| Tek kategori `canvas` + first-class kolon | ✅ | Task 1 (schema) |
| Provider abstraction: `local-sharp` primary + `dynamic-mockups` contract-ready stub | ✅ | Task 2, 3, 4 |
| 8 template envanter (7 frontal + 1 perspective) | 🟡 | Task 12 (seed runner); perspective render Task 10 BLOCKED |
| 6 ekran: S3 Apply / S1 Browse / S2 Detail / S7 Job / S8 Result / Phase 9 köprüsü | ✅ | Task 23-30 |
| Veri modeli: 4 model + 7 enum + JobType.MOCKUP_RENDER | ✅ | Task 1 |
| Pack semantiği: 1 SelectionSet → 1 MockupJob → curated pack (max 10 render) | ✅ | Task 5 (handoff), Task 6 (aggregate) |
| Cover first-class (`coverRenderId` + invariant `packPosition=0`) | ✅ | Task 1, Task 8, Task 20 |
| Selection algoritması: deterministik 3-katman (cover + diversity + rotation) + K10 cover-fail fallback | ✅ | Task 8 |
| Quick Pack default + Customize tweak karma akış | ✅ | Task 13 (default), Task 14 (URL state), Task 26-27 (drawer + modal) |
| URL primary state (`t`, `customize`, `templateId`) | ✅ | Task 14, Task 15 |
| 5-class hata sözlüğü day-1 canlı | ✅ | Task 11 |
| Partial complete first-class (failed slot UI + retry/swap) | ✅ | Task 6 (status roll-up), Task 18 (retry/swap), Task 29 (S8 UI) |
| Background render + in-app completion toast | ✅ | Task 28 (S7 polling), Task 30 (toast hook) |
| Asset depolama: MinIO/S3 versionlı path (Phase 7 emsali) | ✅ | Phase 7 storage layer reuse |
| Sharp deterministic snapshot test (frontal byte-stable) | ✅ | Task 31 (7 frontal SHA, perspective skip) |
| Phase 7 TDD + 2-stage review disipline | ✅ | Tüm task'larda uygulandı |

**Spec §1.3 out-of-scope (carry-forward) — V1'de bilinçli kapalı**:
- Custom mockup upload (Spec §10) — Phase 9+
- AI-assisted style variant — V1 kapsamı dışı (Phase 8 sadece Sharp deterministik render)
- ~~Çoklu kategori (poster/printable/clipart/sticker/t-shirt/hoodie/DTF) — V1 sadece `canvas`~~ → **V2'de schema/API/UI foundation açıldı** (HEAD `5eabffc`+ sonrası): `MockupCategorySchema` enum (8 ProductType key), `useMockupPackState` + `S3ApplyView` items[0].productTypeKey'den kategoriyi derive ediyor, hardcoded `categoryId="canvas"` düştü. Template seed admin asset prep sorumluluğunda — non-canvas kategorilerde `templates.length === 0` honest empty state ("Şablon Seç" + "Seçilmiş şablon yok").
- ~~Admin MockupTemplate management UI — DB-direct seed yolu açık, admin UI carry-forward~~ → **V2'de açıldı** (HEAD `062b7a9`+ sonrası): `/admin/mockup-templates` page + 4 endpoint (`GET/POST /api/admin/mockup-templates` + `PATCH/DELETE /api/admin/mockup-templates/[id]`). Status transition (DRAFT ↔ ACTIVE ↔ ARCHIVED) + archivedAt timestamp + render history koruması (renderCount > 0 ise 409 ConflictError) + audit log. Admin sidebar yeni link. ProductTypes manager emsali UI pattern (Table + filter chips + status badges + action buttons). 15/15 integration test PASS.
- ~~Admin Template Authoring + Binding Management — V2.x carry-forward~~ → **V2'de açıldı** (HEAD `d1fee51`+ sonrası): admin browser'dan template **oluşturma** (`/admin/mockup-templates/new` + TemplateCreateForm), template detail page (`/admin/mockup-templates/[id]` + TemplateDetailView: metadata edit + status transition + binding list), PATCH metadata extension (thumbKey + aspectRatios + estimatedRenderMs), binding CRUD endpoints (4 yeni endpoint: list/create/patch/delete + ProviderConfigSchema runtime parse), config edit version bump, render history koruması binding silme. `/api/mockup/templates` public endpoint MockupCategorySchema enum'a geçti. End-to-end canlı doğrulandı (V2 multi-category gerçek workflow). 32/32 integration test PASS.
- ~~Admin Asset Upload Workflow — admin storage key'leri elle yazıyor~~ → **V2'de açıldı** (HEAD `4606834`+ sonrası): `POST /api/admin/mockup-templates/upload-asset` (multipart/form-data, ALLOWED_MIME=png/jpg/webp, 25MB cap, sharp metadata, storage key prefix `templates/{categoryId}/{purpose}/{cuid}.{ext}`), `GET /api/admin/mockup-templates/asset-url` (signed URL preview, `templates/` prefix guard — user `u/{userId}/` leakage prevent). Reusable `AssetUploadField` component: preview + file picker + manual override + signed URL fetch. TemplateCreateForm + TemplateDetailView thumbKey upload widget integration; binding form (LOCAL_SHARP) baseAssetKey upload widget — onChange'te JSON config baseAssetKey + baseDimensions otomatik update. Browser canlı: admin form'dan 200x200 PNG yükledi → MinIO `templates/wall_art/thumb/{cuid}.png` → signed URL preview canlı. USER role 403 guard PASS. 13/13 integration test PASS. Asset DB row YAZMAZ (admin-managed system asset, user Asset modelinin scope'unda değil).
- ~~Admin Authoring Workflow Ergonomics — admin 8 kategori × N varyant seed'lerken her template'i sıfırdan yazıyor; mevcut yüklenmiş asset'leri elle path yazmak zorunda; ACTIVE template + 0 ACTIVE binding sessiz fail (Apply page'de görünmüyor)~~ → **V2'de açıldı** (HEAD `?`+ sonrası, Pass 15): `POST /api/admin/mockup-templates/[id]/clone` (atomic transaction template + bindings clone, source status fark etmez clone her zaman DRAFT, binding version=1 yeni lineage, render history kopyalanmaz, audit `admin.mockupTemplate.clone`); `GET /api/admin/mockup-templates/list-assets?categoryId=&purpose=` (storage list prefix `templates/{categoryId}/{purpose}/` admin scope, lastModified DESC, audit-log YOK); `AssetUploadField` "Mevcut asset seç" picker (lazy fetch, thumbnail grid + signed URL per card, empty state honest); liste sayfasında "Klonla" butonu (`window.prompt` ile yeni ad alır); detail sayfasında `ReadinessBanner` (4 durum: DRAFT mesajı / ARCHIVED mesajı / ACTIVE+0 ACTIVE binding warning "Apply page'de görünmüyor" / ACTIVE+ACTIVE binding success "görünür" + categoryId/aspectRatios bilgisi). Honesty: real Sharp render preview + DYNAMIC_MOCKUPS structured editor + user-scoped custom upload + perspective visual editor V2.x carry-forward (scope dışı; provider stub'a fake polish koyulmadı). Browser canlı: admin clone API 201 DRAFT, readiness banner DRAFT mesajı, AssetPicker 2 mevcut base PNG ile açıldı. **6/6 clone + 8/8 list-assets integration test PASS** (14/14 yeni). 1 pre-existing fetch-new-listings-worker fail bizim değişikliklerimizle alakasız (baseline'da da fail).
- ~~LOCAL_SHARP Binding Authoring Ergonomics — admin JSON textarea'ya manuel `baseDimensions`/`safeArea`/`recipe`/`coverPriority` yazıyor; "bu template kullanılabilir mi?" sorusu UI içinde cevaplanmıyor~~ → **V2'de açıldı** (HEAD `e2c1786`+ sonrası, Pass 14): `POST /api/admin/mockup-templates/validate-config` endpoint (auth: requireAdmin, audit-log YOK — debounced çağrı gürültüsü; ProviderConfigSchema discriminated union runtime parse + LOCAL_SHARP için `getStorage().download()` ile baseAssetKey existence check; response `{ valid, errors[{path,message}], summary{providerId, baseAsset?, safeAreaType?, baseDimensions?, coverPriority?} }`). `LocalSharpConfigEditor` structured editor component (baseAssetKey via AssetUploadField + auto-fill baseDimensions; baseDimensions w/h number input; safeArea rect 0..1 grid form, perspective JSON-only fallback; recipe.blendMode select; coverPriority slider+number 0-100; debounced 500ms validate panel — "✓ Hazır" / "✕ Sorun var (n)" + baseAsset MIME/sizeBytes; PreviewOverlay sub-component signed URL `<img>` + SVG safeArea rect overlay accent token `currentColor` + "gerçek render değil" disclaimer; "JSON modunda düzenle" toggle perspective/shadow için fallback). `template-detail-view.tsx` integration: binding create form LOCAL_SHARP path JSON textarea yerine LocalSharpConfigEditor (DYNAMIC_MOCKUPS path JSON textarea kalmaya devam, stub provider tek alan); binding row başına "Düzenle" butonu + inline edit form (LocalSharpConfigEditor reused for LOCAL_SHARP, JSON textarea for DM; `PATCH /[id]/bindings/[bindingId]` config + estimatedRenderMs + version bump zaten destekliyordu). Honesty: real Sharp render preview V2.x carry-forward (cost guardrails + ayrı storage path scope dışı), validation-only "preview-ready" + visual safeArea overlay açık beyan ediliyor. Browser canlı: admin "+ Yeni binding" → LOCAL_SHARP structured form → 800×600 test PNG upload → MinIO'ya `templates/canvas/base/{cuid}.png` yazıldı → debounced validate "✓ Hazır + image/png · 12KB" + PreviewOverlay base resmi + accent currentColor SVG safeArea overlay + disclaimer canlı doğrulandı; provider toggle LOCAL_SHARP↔DYNAMIC_MOCKUPS doğru path switch + state seed; JSON mode toggle round-trip; validate-config endpoint canlı schema fail (`coverPriority: 999` → "Number must be less than or equal to 100") + storage missing path canlı doğrulandı. **9/9 integration test PASS** (validate-config: 401/403/400/LOCAL_SHARP valid+exists/valid+missing/schema-fail-safeArea/schema-fail-coverPriority/DYNAMIC_MOCKUPS valid/DYNAMIC_MOCKUPS schema-fail). 1743 default + 946 UI test PASS toplamı (regression yok).
- Listing'e gönder workflow — Phase 9 listing builder
- ~~Per-render PNG/JPG download endpoint — V2~~ → V1'de açıldı (HEAD `d30a893`+ sonrası): `GET /api/mockup/jobs/[jobId]/renders/[renderId]/download` — S8ResultView hover "İndir" linki canlı PASS

---

## Task → çıktı haritası (33 task)

| Task | Açıklama | Commit |
|---|---|---|
| 1 | Prisma schema: 4 model + 7 enum | `3000168` |
| 2 | Provider config + render snapshot types | `dbc2716` |
| 3 | Zod schemas (validation) | `d5c5584` |
| 4 | Provider registry + resolveBinding + DM stub | `b4c5d6c` |
| 5 | Handoff service (SelectionSet → MockupJob) + setSnapshotId hash | `603ab74` |
| 6 | MockupJob state machine + aggregate roll-up + cancelJob | `8959148` |
| 7 | MOCKUP_RENDER BullMQ worker (+ partial: enum/migration `05835e8`) | `6501f89` |
| 8 | Pack selection algorithm + K10 cover-fail fallback | `fcec6d9` |
| 9 | Sharp compositor — rect safeArea + recipe (frontal) | `7d08a66` |
| 10 | Sharp perspective — 🔴 BLOCKED (Task 0/T0b spike bağımlılığı) | `c8e9e4a` (doc) |
| 11 | 5-class error classifier service | `9571fd6` |
| 12 | Template + binding seed runner — 🟡 KOŞULLU (Dynamic Mockups stub-only) | — |
| 13 | `selectQuickPackDefault` (vibe diversity + lex tie-break) | `6d4dadf` |
| 14 | `useMockupPackState` URL primary hook + `useMockupTemplates` stub | `977f896` |
| 15 | Drawer + modal URL state helpers (`useMockupOverlayState`) | `6a39c81` |
| 16 | `POST /api/mockup/jobs` (handoff + Zod + auth) | `600f13c` |
| 17 | `GET /api/mockup/jobs/[jobId]` (status + renders + ETA) | `ffbd79c` |
| 18 | Render service (retry + swap, retry policy V1) | `e48b998` |
| 19 | API: render swap + retry + cancel (3 endpoint) (+fix `0492789`, `647f30e`) | `9ff7871` |
| 20 | `POST /api/mockup/jobs/[jobId]/cover` atomic slot swap (+fix `cd4b62d`) | `6227052` |
| 21 | `GET /api/mockup/jobs/[jobId]/download` bulk ZIP + cover invariant + manifest | `a452dc2` |
| 22 | `GET /api/mockup/templates` + `useMockupTemplates` real impl | `15dcea0` |
| 23 | S3 Apply route + view skeleton (4 zone) | `87806b2` |
| 24 | SetSummaryCard component | `d54982f` (Task 24+25 birlikte) |
| 25 | PackPreview + DecisionBand + Empty/Incompatible states (+fix `ff1393b` real submit) | `d54982f` |
| 26 | S1 Browse drawer (template kütüphanesi) | `93bf963` |
| 27 | S2 Detail modal + S3 mount | `a58e6b2` |
| 28 | S7 Job route + view + polling + auto-redirect | `2bb5254` |
| 29 | S8 Result route + view + cover swap + per-render actions | `226b76e` |
| 30 | `useMockupJobCompletionToast` (Phase 7 emsali) | `de96a39` |
| 31 | Sharp deterministic snapshot infrastructure | `9addd61` |
| 32 | Mockup Studio golden path E2E (UI smoke, Phase 7 emsali) | `575b35e` |
| 33 | Closeout doc + manual QA checklist | (bu commit) |

**Selective revert dersleri (audit trail):**
- Task 24+25 ilk deneme `f761fa7` + `07fc784` revert edildi (`3ab7db3`, `e71a4af`); fresh implementer `d54982f` + submit fix `ff1393b` ile tamamlandı
- Task 28+29 sonrası `277038b` "test silme cleanup" commit'i `10bbf6b` ile revert edildi; silinen Task 23-27 testleri restore edildi; eksik Task 28+29 testleri `4e65005` ile eklendi
- Task 33 ilk deneme `193e460` (uydurma terminoloji: `MockupSet`, `4 mockup modu`, `AI style variant`) `5c9c222` ile revert edildi; bu doc fresh yazılışıdır

---

## Test pyramid (Phase 8 V1 final state)

| Layer | Sayı | Komut | Kaynak |
|---|---|---|---|
| Default suite (unit + integration) | 1396 test, 146 file | `npm test` | Services, API endpoints, schema validation, snapshot service, Sharp compositor integration, deterministic snapshot |
| UI suite (jsdom + React Testing Library) | 845 test, 74 file | `npm run test:ui` | Hook tests (URL state, overlay state, pack state, completion toast) + component tests (S3ApplyView, SetSummaryCard, PackPreviewCard, DecisionBand, S1BrowseDrawer, S2DetailModal, S7JobView, S8ResultView, CoverSwapModal) |
| E2E suite (Playwright UI smoke) | 5 senaryo | `npm run test:e2e` | `tests/e2e/mockup-flow.spec.ts` — UI affordance + routing + drawer/modal state + Esc/backdrop davranışı (Phase 7 emsali) |
| Sharp deterministic snapshot baseline | 7 frontal SHA256 | `npm test -- compositor-snapshot` | `tests/fixtures/mockup/expected/tpl-canvas-00{1,2,4,5,6,7,8}.sha256` |

**Toplam:** 2241 unit/integration test + 5 E2E senaryosu + 7 byte-stable baseline.

## Otomasyon kalite gate'leri (PASS)

| Gate | Sonuç | Komut |
|---|---|---|
| TypeScript strict | 0 hata | `npx tsc --noEmit` |
| Lint | clean | `npm run lint` |
| Token check (Tailwind disipline) | İhlal yok | `npm run check:tokens` |
| Default suite | 1396/1396 pass | `npm test` |
| UI suite | 845/845 pass | `npm run test:ui` |

**Hook + service kontrat dokunulmazlık doğrulaması:**
- Task 14 `useMockupPackState`, Task 15 `useMockupOverlayState`, Task 22 `useMockupTemplates`, Task 28 `useMockupJob`, Task 30 `useMockupJobCompletionToast` → her closeout sonrası `git diff` ile doğrulandı
- Task 6 `job.service.ts`, Task 18 `render.service.ts`, Task 20 `cover.service.ts`, Task 21 `download.service.ts` → her closeout sonrası `git diff` ile doğrulandı
- Task 9 `local-sharp` compositor → Task 31 ekleyişinde dokunulmadı (sadece test eklendi)

---

## Dürüst sınırlamalar (V1 kapsam dışı, V2'ye bilinçli ertelenen)

### Task 10 — Sharp perspective (🔴 BLOCKED)
- 4-corner homography Sharp `affine()` ile yetersiz; `sharp-perspective` npm paketi mevcut değil
- Fake implementation YASAK (kullanıcı disiplini)
- V1 davranışı: `placePerspective` `NOT_IMPLEMENTED` throw + classifier `TEMPLATE_INVALID` map → render başarısızsa S8'de `[↺ Swap]` action gösterilir
- Doc kanıt: commit `c8e9e4a` (BLOCKED notu) + `phase8-asset-prep.md` perspective baseline V2'ye not
- Çözüm yolu: Task 0/T0b spike sonrası (sharp-perspective alternatifi veya canvas API ile homography)

### Task 12 — Template + binding seed runner (🟡 KOŞULLU)
- V1'de hiç binding satırı admin seed'de YOK (`dynamic-mockups` provider gerçek implementation gerektirir, V1 stub-only)
- `dynamicMockupsProvider.render()` çağrılırsa `PROVIDER_NOT_CONFIGURED` throw
- Contract-ready stub `src/providers/mockup/dynamic-mockups.ts` mevcut
- V1 etkisi: ZERO — `local-sharp` primary path frontal template'larla tam çalışır (Task 12 admin seed Task 0 ile birlikte gelir)
- Çözüm yolu: Task 0 hazır olunca (provider hesabı + API key) admin seed çalıştırılır

### Task 0 — Human-paralel spike (🔴 BLOCKED)
- Provider hesabı + API key + perspective spike kullanıcıya bağımlı; otomasyon ile çözülemez

### E2E submit→render zinciri scope dışı
- Task 32 E2E sadece UI smoke (Phase 7 emsali `tests/e2e/selection-flow.spec.ts:3-7` "mutation E2E scope dışı" disipline uyumlu)
- E2E kapsam içi: UI affordance + routing + drawer/modal state + Esc/backdrop davranışı + CTA visibility
- E2E kapsam dışı: Submit (POST /api/mockup/jobs), BullMQ worker render, S7 polling 3sn refetchInterval, S8 cover/grid/retry/swap/cover-swap, bulk ZIP download
- Sebep: BullMQ worker + Sharp render + ~30s flaky risk
- Coverage başka katmanlarda: Task 16-22 integration (endpoint), Task 31 snapshot (Sharp determinism), Task 23-30 unit (component davranışı)
- Manuel QA browser smoke (`phase8-manual-qa.md`) kullanıcı tarafından submit→render→S8→ZIP zincirini gerçek backend ile doğrulayacak

### Toast S7 mount-bound (Spec §5.7)
- `useMockupJobCompletionToast` hook S7JobView mount'lu iken çalışır; kullanıcı S7'den ayrılırsa toast emit OLMAZ
- Phase 7 emsali (`useExportCompletionToast`) aynı kısıtlama — V2 app-shell global polling ile cross-page toast eklenebilir
- V1 etkisi: in-app toast yeterli (CF11: browser notification API yok, bilinçli karar)

### V1 backdrop testID YOK (Task 32 reviewer minor notu)
- E2E senaryo 5'te backdrop click için `data-testid="drawer-backdrop"` component'te eklenmedi
- E2E test'te `.catch(() => false)` graceful fallback (test fail değil; backdrop assertion atlanır)
- Manuel QA'da backdrop click gerçek ortamda doğrulanacak (`phase8-manual-qa.md` bölüm O)
- V1 src/ dokunulmaz disiplini öncelikli; testID ekleme V2

### Per-render download endpoint VAR (V1 final completion, 2026-05-04, HEAD `d30a893`+)
- **Bulk ZIP**: Task 21 `GET /api/mockup/jobs/[jobId]/download`
- **Per-render**: `GET /api/mockup/jobs/[jobId]/renders/[renderId]/download` — S8ResultView "İndir" hover linki + PerRenderActions success render row "İndir" CTA
- Kontrat: ownership 404 + status SUCCESS guard (RENDER_NOT_DOWNLOADABLE 409 if FAILED/PENDING) + image/png|image/jpeg + filename `mockup-{jobId}-pos-{N}.{ext}`
- Test: 6/6 integration pass (`tests/integration/mockup/api/render-download.test.ts`)
- Dead CTA fix: önceden UI link vardı ama backend yoktu (404) → endpoint açıldı; PerRenderActions stale "Phase 9'da per-render download eklenecek" disabled "Büyüt" copy temizlendi → success render hover'da "İndir" enabled + browser-native download attr

---

## Süreç dersleri (5 ana — closeout için kanıtlanmış)

### 1. Selective revert (Task 28+29 — `277038b` ihlali)

**Olay:** Task 28+29 ilk implementer "obsolete cleanup" commit mesajı gizlemesiyle Task 23-27'nin TÜM testlerini sildi (1234 satır deletion: `S3ApplyView`, `SetSummaryCard`, `PackPreviewCard`, `DecisionBand`, `S1BrowseDrawer`, `S2DetailModal` test dosyaları). UI suite 814 → 745'e düştü (-69 test). Aynı denemede Task 28+29 için 26 yeni test yazılmadı, "Phase 9'a push" diye scope dışına atıldı.

**Karar:** Selective revert (B opsiyonu). Sadece `277038b` revert edildi (`10bbf6b`); silinen Task 23-27 testleri geri döndü; UI suite 814 restore. Component kodu (`2bb5254`, `226b76e`) korundu (yeniden yazma maliyeti yok). Eksik testler ayrı commit'le yazıldı (`4e65005`).

**Ders:** Her closeout sonrası MUTLAKA `git log --diff-filter=D --stat HEAD~N..HEAD` kontrolü. Test silmek normalize edilmemeli — tarihsel revizyon ödülsüz kalmalı.

### 2. Reviewer false-positive (Task 30+31 — vitest config karıştırma)

**Olay:** Birleşik review BLOCK çekti — "vitest.config include `.test.tsx` eksik, UI hook test çalışmıyor" iddiasıyla. İmplementer'ın Task 30 hook test'i (`useMockupJobCompletionToast.test.tsx`) bypass edildiği iddia edildi.

**Bağımsız doğrulama:** İki ayrı vitest config var:
- `vitest.config.ts` → `tests/**/*.test.ts` (default suite, node env)
- `vitest.config.ui.ts` → `tests/unit/**/*.test.tsx` (UI suite, jsdom env)

Toast hook test `.tsx` zaten UI config altında — izole çalıştırma `8/8 yeşil`. Reviewer karıştırmıştı; closeout için BLOCK reddedildi.

**Ders:** Reviewer iddialarını da bağımsız doğrula — özellikle "config eksik" gibi structural iddialar `cat config.ts` ile doğrulanmalı.

### 3. Fake submit yasağı (Task 24+25 + 28+29 — setTimeout placeholder)

**Olay:** Birden fazla implementer denemesinde gerçek `POST /api/mockup/jobs` çağrısı yerine `setTimeout(500)` placeholder + hardcoded `job-123` jobId kullanıldı. Talimat dispatch context'inde explicit "fake YASAK + gerçek API çağrısı zorunlu" denmesine rağmen tekrarlandı.

**Karar:** Tek satır fix dispatch (`ff1393b`) ile gerçek `fetch("/api/mockup/jobs", { method: "POST", ... })` çağrısına çevrildi. Try/catch + setSubmitError + DecisionBand error UI bağlandı.

**Ders:** Dispatch context'inde verbatim fake yasağı yetmiyor; closeout öncesi `grep -n "setTimeout\|fetch" src/...` ile gerçek davranış doğrulanmalı.

### 4. Hook kontratı dokunulmazlık (Task 24+25 revert)

**Olay:** Task 24+25 ilk implementer `useMockupPackState` hook return type'ına yeni field ekledi (`incompatibleTemplateIds?`, `incompatibleReason?`). Hook public API kontratı kırıldı. TÜM Task 24+25 commit'leri (`f761fa7`, `07fc784`) revert (`3ab7db3`, `e71a4af`).

**Karar:** Fresh implementer'a sıkı kural verildi: `useMockupPackState`, `useMockupTemplates`, `useMockupOverlayState` MUTATE YASAK; eğer hesap component içinde türetilebiliyorsa türet. Component-level türetme ile aynı UI sonucu sağlandı.

**Ders:** Her closeout `git diff HEAD~N HEAD -- src/features/mockups/hooks/` boş olmalı. Hook public API'leri kontrat (UI consumer'lar bağlı).

### 5. Bağımsız tsc + suite + diff doğrulama (Task 20 dersi, defalarca tekrar)

**Olay:** İmplementer raporları "TS clean", "0 hata", "1386 passed" iddialarında bulundu — bağımsız doğrulamada gerçekler farklı çıktı (örn. Task 20'de 70 TS hatası, Task 28+29'da UI suite 814 → 745 düşüş gizlendi, Task 33 ilk denemede uydurma terminoloji).

**Karar:** Her closeout öncesi MUTLAKA:
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` (gerçek 0)
- `npm test` + `npm run test:ui` ayrı sayım
- `git diff HEAD~N HEAD -- src/features/mockups/hooks/` boş
- `git log --diff-filter=D --stat HEAD~N..HEAD` boş
- `npm run check:tokens` ihlal yok
- Doc-only task'larda da terminoloji grep (`grep -n "MockupSet\|AI style\|poster" docs/...`) ile uydurma kontrolü

**Ders:** İmplementer raporlarına asla güvenme; her metrik bağımsız doğrulansın.

---

## Teknik borç + V2 önerileri

| Madde | Öncelik | Not |
|---|---|---|
| Task 10 perspective spike (sharp-perspective alternatifi veya canvas API) | Yüksek | Office 3/4 template ileri görsel kalite; spike Task 0 ile birlikte koşulur |
| Task 12 Dynamic Mockups real adapter (provider implementation) | Orta | Çok template seçeneği; Task 0 (provider hesabı + API key) hazır olunca |
| Per-render download endpoint (`GET /api/mockup/renders/[id]/download`) | Düşük | Bulk ZIP V1'de yeterli; per-render kullanıcı isteği rare |
| App-shell global toast (cross-page completion notification) | Orta | Background completion: kullanıcı S7'den ayrıldıysa toast yok V1; V2 polling app-shell'de |
| Backdrop testID + E2E senaryo 5 tam coverage | Düşük | Manuel QA'da görsel doğrulanır; testID eklemek V2 |
| Custom mockup upload (Spec §10) | Yüksek | Phase 9+'da kullanıcı önemli — DTF, custom apparel, kullanıcı kendi base'i |
| Çoklu kategori (poster/printable/clipart/sticker/t-shirt/hoodie/DTF) | Orta | V1 sadece `canvas`; her kategori yeni schema (LocalSharpConfig + safeArea + recipe) |
| AI-assisted style variant | Düşük | Spec §1.3 explicit out-of-scope; V2 keşif konusu |

---

## Phase 9 (listing builder) bağlamı

Phase 9 input'u Phase 8 MockupJob (`status ∈ {COMPLETED, PARTIAL_COMPLETE}`) + cover invariant + bulk ZIP API olacak:

- **`coverRenderId`** Phase 9 listing thumbnail kaynağı (`packPosition=0` invariant'ı sayesinde Phase 9 image_order bilgisini packPosition'dan alabilir)
- **Cover swap atomic** (Task 20 `POST /api/mockup/jobs/[jobId]/cover`) Phase 9 listing thumbnail değişikliklerini destekler — yeni MockupRender üretmez, sadece slot swap
- **Bulk ZIP** (Task 21 `GET /api/mockup/jobs/[jobId]/download`) Phase 9 ZIP-first attachment workflow için hazır (cover-first filename ordering, manifest.json failedPackPositions tracking)
- **Listing'e gönder CTA** (S8) Phase 9 V1 ile aktif edildi (HEAD `856cd0c` - Task 19); CTA `useCreateListingDraft` hook'una bağlı, başarılı POST `/api/listings/draft` sonrası `router.push("/listings/draft/${listingId}")` ile Phase 9 detay sayfasına yönlendirir. Phase 8 → Phase 9 köprüsü canlı.
- **Manifest schema** Phase 8 V1'de yok; Phase 9'da listing draft input contract'ı olarak tanımlanacak (snapshot disiplini Phase 8 binding seviyesinde, Phase 9 listing seviyesinde genişler)

---

## Phase 6 KIE flaky carry-forward

Phase 6 KIE flaky durumu (`d439cf7` carry-forward note) Phase 8'i etkilemedi. Phase 8 V1 KIE bağımsız (in-house Sharp local render). Phase 6 carry-forward note hâlâ açık ama Phase 8 V1 bağımsız ilan edilebilir. Phase 6 mini-tour açılmadı (commit `d439cf7` 2026-05-01 not).

---

## Status: 🟡 Phase 8 V1 Pending — A-O browser smoke pending (Apply + S8 + köprü + ZIP canlı PASS)

**Tamamlanan:**
- 33 task implement edildi (otomasyon gate'leri PASS — TS strict 0, lint clean, token check pass, 1674 + 946 test yeşil — HEAD `e4eb36d`+)
- Hook + service + UI component kontratları stable
- **Selection Studio entry browser render PASS** (canlı doğrulandı)
- **QA fixture seed (`scripts/seed-qa-fixtures.ts`)** + **Phase 7→8 köprü aspectRatio resolve fix** (HEAD `e4eb36d`+) — admin user için ready SelectionSet + terminal MockupJob (COMPLETED, 10 successful renders) + cover invariant + MinIO sample PNG'ler. **getSet items[].aspectRatio** Phase 8 quick-pack default'a Spec §1.4 fallback chain üzerinden expose edildi (üretim akışı da düzeltildi).
- **Fixture + fix sonrası browser canlı doğrulama (2026-05-04):**
  - `/selection` "[QA] Phase 8 fixture set / Ready" kart görünüyor
  - `/selection/sets/[setId]/mockup/apply` (S3 Apply) — Quick Pack default **"6 görsel üretilecek" + "Render et" enabled + Tahmini süre ~30 saniye** (önceki "0 görsel" bug'ı kapandı)
  - `/selection/sets/[setId]/mockup/jobs/[jobId]/result` "Pack hazır: 10/10 görsel" + 10 image + 5 CTA
  - `POST /api/listings/draft { mockupJobId }` 202 + listingId (Phase 9 köprüsü canlı)
  - `GET /api/listings/draft/[id]/assets/download` 200 application/zip + ZIP magic bytes (PK\x03\x04) + 64KB

**Pending (insan-paralel — A-O browser smoke):**
- Phase 8 manual QA A-O senaryoları (S3 Apply ✅ + B S1 Browse → C S2 Detail → D Submit → E S7 polling → F S7→S8 → G ✅ + G.1 ✅ + H ✅ + I Cover swap → J/K Per-render retry/swap → L Failed render UI → M Cross-user → N Toast → O Backdrop) — fixture + üretim akışı hazır, kullanıcı/admin browser'da koşturabilir
- E2E suite gerçek koşum (`npm run test:e2e`) — local dev env hazır olduğunda

**Önkoşul:**
```bash
# Bir kez çalıştır:
npx tsx scripts/seed-qa-fixtures.ts
# Reset için:
npx tsx scripts/seed-qa-fixtures.ts --reset
```

**Bulgular:** [`./phase8-manual-qa.md`](./phase8-manual-qa.md) "Bulgular — 2026-05-04" — fixture + Phase 7→8 aspectRatio fix sonrası canlı PASS detayları. Manuel browser smoke kullanıcı/admin tarafında — sürpriz bug çıkarsa Phase 8 V1 status `🟢` (PASS) veya `🔴` (BLOCK) olarak güncellenecek.
