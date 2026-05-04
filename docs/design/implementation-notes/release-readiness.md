# EtsyHub Release Readiness — Repo-Wide Status

> **Tarih:** 2026-05-04 (Pass 16 gerçek browser ürün QA + Pass 17 closeout sync)
> **HEAD:** `72522f3`+ (Pass 16) → bu doc Pass 17 sync sonrası
> **Closeout runbook:** [`./final-closeout-runbook.md`](./final-closeout-runbook.md) — kullanıcı/admin **buradan** son 1 mile'ı yürür (PASS/honest-fail PASS/blocked sınırları + closeout sonrası doc update planı)
> **Audit sonucu:** 17 audit pass — Pass 1-9 (önceki turlar): closeout disipline + V1 fix paketleri + QA enablement; Pass 10 (HEAD `062b7a9`): V2 başlangıcı — Phase 8 Multi-Category Mockup Foundation; Pass 11 (HEAD `d1fee51`): V2 ilerleme — Phase 8 Admin MockupTemplate Management (CRUD + status lifecycle); Pass 12 (HEAD `4606834`): V2 Authoring — Phase 8 Admin Template Authoring + Binding Management; Pass 13 (HEAD `e2c1786`): V2 Asset Upload — Phase 8 Admin Asset Upload Workflow (`upload-asset` + `asset-url` + `AssetUploadField`, MinIO live PASS). Pass 14 (HEAD `a8a5eaa`): V2 LOCAL_SHARP Editor + Preview Foundation — Phase 8 Admin Binding Authoring Ergonomics — `POST /api/admin/mockup-templates/validate-config` (auth: requireAdmin, audit-log YOK; ProviderConfigSchema discriminated union runtime parse + LOCAL_SHARP için `getStorage().download()` ile baseAssetKey existence check; response `{ valid, errors[{path,message}], summary{providerId, baseAsset?, safeAreaType?, baseDimensions?, coverPriority?} }`). `LocalSharpConfigEditor` structured editor component (baseAssetKey via AssetUploadField + auto-fill baseDimensions; baseDimensions w/h number input; safeArea rect 0..1 grid form + perspective JSON-only fallback; recipe.blendMode select; coverPriority slider+number 0-100; debounced 500ms validate panel — "✓ Hazır" / "✕ Sorun var (n)" + baseAsset MIME/sizeBytes; PreviewOverlay sub-component signed URL `<img>` + SVG safeArea rect overlay accent token currentColor + "gerçek render değil" disclaimer; "JSON modunda düzenle" toggle perspective/shadow için fallback). `template-detail-view.tsx` integration: binding create form LOCAL_SHARP path JSON textarea yerine LocalSharpConfigEditor; binding row başına "Düzenle" butonu + inline edit form (config + estimatedRenderMs PATCH; PATCH endpoint zaten config + version bump destekliyordu). Browser canlı: admin "+ Yeni binding" → LOCAL_SHARP structured form → 800×600 test PNG upload → MinIO'ya `templates/canvas/base/{cuid}.png` yazıldı → debounced validate "✓ Hazır + image/png · 12KB" + PreviewOverlay base resmi + accent currentColor SVG safeArea overlay + "gerçek render değil" disclaimer canlı doğrulandı; provider toggle LOCAL_SHARP↔DYNAMIC_MOCKUPS doğru path switch + state seed; JSON mode toggle round-trip; validate-config endpoint canlı schema fail (coverPriority 999 → "Number must be less than or equal to 100") + storage missing path canlı doğrulandı. **1743 default + 946 UI test PASS** + Pass 14 yeni suite: 9/9 admin-mockup-template-validate-config (401/403/400/LOCAL_SHARP valid+exists/valid+missing/schema-fail-safeArea/schema-fail-coverPriority/DYNAMIC_MOCKUPS valid/DYNAMIC_MOCKUPS schema-fail). — admin browser'dan template **oluşturma** (`/admin/mockup-templates/new` page + TemplateCreateForm: 8 kategori dropdown + name + thumbKey + aspectRatios + tags + estimatedRenderMs), template detail page (`/admin/mockup-templates/[id]` + TemplateDetailView: metadata edit form + status transition + binding list), PATCH metadata extension (thumbKey + aspectRatios + estimatedRenderMs eklendi), binding CRUD endpoints (POST/GET `/[id]/bindings` + PATCH/DELETE `/[id]/bindings/[bindingId]`), ProviderConfigSchema discriminated union runtime parse (LOCAL_SHARP / DYNAMIC_MOCKUPS), config edit version bump, render history koruması (binding silme: renderCount > 0 → 409). `/api/mockup/templates` public endpoint MockupCategorySchema enum'a geçti — non-canvas kategoriler honest (V1 hardcoded "canvas" düştü). **End-to-end browser canlı doğrulandı**: admin yeni "Wall Art Modern Frame" template oluşturdu → LOCAL_SHARP binding ekledi → ACTIVE'e geçirdi → wall_art ProductType'lı QA fixture set Apply page Quick Pack default "1 görsel üretilecek" + "Render et" enabled (önceden 0 görsel + disabled idi). **1674 default + 946 UI test PASS** + Pass 12 affected suite: 18/18 admin-mockup-templates + 14/14 admin-mockup-template-bindings + 24/24 mockup schemas (regression yok). **Pass 16 (HEAD `72522f3`): gerçek browser ürün QA turu + S8 thumbnail bug fix** — admin akışı uçtan uca canlı: USER login QA (sidebar P5/P8 disabled honest carry, route guard /admin/* server-side ForbiddenError + UI redirect, settings KIE key sunucuda şifreli plain text dönmez); ADMIN login QA (admin paneli 6 metric, mockup-templates 1491 satır + Pass 15 Klonla butonu); end-to-end fixture set Apply → POST /api/mockup/jobs 202 → S7 polling 0/3 → BullMQ MOCKUP_RENDER worker (`npm run worker` ayrı terminal) Sharp local 3/3 SUCCESS → S7 → S8 auto-redirect → S8 result page → "Listing'e gönder" → /listings/draft yaratıldı → KIE Gemini 2.5 Flash AI Oluştur title (133 char) + desc + 13/13 tag canlı + Kaydet sonrası readiness 3/5 ✓ + "Taslak Gönder" honest fail "Listing zorunlu alanları eksik: price". **Bug fix:** S8ResultView (`src/features/mockups/components/S8ResultView.tsx:62,114`) + CoverSwapModal (`src/features/mockups/components/CoverSwapModal.tsx:83`) `<img src={render.outputKey}>` storage path doğrudan src'e koyuyordu (relative URL → 404 broken thumbnail) → `/api/mockup/jobs/[jobId]/renders/[renderId]/download` image stream endpoint'i kullanıldı (auth ownership server-side korunur). Pass 16 fix sonrası 800×600 PNG canlı render (kırmızı/yeşil/mavi variant + "[QA] Variant 1/2/3" overlay). 19/19 mevcut S8ResultView + CoverSwapModal UI test PASS (regression yok). Honest sınırlar: AI vision-aware değil (asset görmüyor, generic copy V2.x carry); worker ayrı process beklenen production deployment model (README + manual-qa docs'larda zaten önkoşul); Etsy live submit success external dep. **Pass 17 (bu commit): Pass 16 sonrası closeout doc sync** — phase8-manual-qa.md'ye "Bulgular — Pass 16" bölümü eklendi (A/D/E/F/G/G.1/H + I cover swap modal canlı PASS olarak); phase8-closeout.md status başlığı "🟡 V1 Pending — A-O browser smoke pending" → "🟡 V1 Pending — A-H + G.1 canlı PASS, I/J/K/L/M/N/O/P kullanıcı browser smoke'a açık"; release-readiness.md Phase 8 satırı + manual QA sırası tablosu Pass 16 deltasını yansıtacak şekilde güncellendi. Repo-side bug yok; geriye sadece kullanıcı/admin browser smoke (I swap submit + J/K/L failed UI + M cross-user + N toast + O backdrop) ve external Etsy operasyonel dep kaldı. **Pass 15 (HEAD `0891240`): V2 Admin Authoring Workflow Ergonomics — Phase 8 son completion paketi** — `POST /api/admin/mockup-templates/[id]/clone` (atomic transaction template + bindings clone, source ACTIVE'e bakmaksızın clone DRAFT, binding version=1 yeni lineage, audit `admin.mockupTemplate.clone`); `GET /api/admin/mockup-templates/list-assets?categoryId=&purpose=` (storage list prefix `templates/{categoryId}/{purpose}/`, sızıntı yok, audit-log YOK gürültü, lastModified DESC); `AssetUploadField` "Mevcut asset seç" picker (lazy fetch, 3-4 col grid thumbnail card, signed URL `<img>` per card, empty state honest, açıkken `staleTime: 0` taze listeleme); list sayfasına "Klonla" butonu + `window.prompt` ile yeni ad sorulup clone API çağrısı; detail sayfasına `ReadinessBanner` (DRAFT/ARCHIVED/ACTIVE 0-binding/ACTIVE healthy 4 durum mesajı — sessiz fail önleme: ACTIVE template + 0 ACTIVE binding warning rengi + "Apply page'de görünmüyor" mesajı; ACTIVE healthy success rengi + categoryId/aspectRatios bilgisi). Browser canlı: admin liste sayfasından template clone API çağrısı 201 + DRAFT döndü; clone'lanan template detail sayfasında DRAFT readiness banner görünür ("kullanıcı Apply page'inde görünmez. Yayınlamak için en az 1 ACTIVE binding ekleyin"); list-assets API canlı 2 mevcut base PNG döndü (Pass 13/14 upload kalıntısı); AssetPicker UI binding form'da açıldı, label "canvas / base · daha önce yüklenmişler" + 2 thumbnail card grid render. **Pass 15 yeni testler**: 6/6 clone (401/403/400/404/no-bindings/with-bindings) + 8/8 list-assets (401/403/400×3/empty/multi DESC/category-prefix). Honesty: real Sharp render preview + DYNAMIC_MOCKUPS structured editor + user-scoped custom upload + perspective visual editor V2.x carry-forward, scope dışında.
>
> **Genel durum (V1 Honest-fail PASS + Pass 16 end-to-end PASS):** Kod tamam ✅, V1 zorunlu kapsam canlı PASS ✅, **Pass 16 admin akışı uçtan uca canlı PASS** (Apply → render Sharp local → S7 polling → S8 cover+grid thumbnail bug fix sonrası canlı → Phase 9 köprüsü → KIE generate-meta → honest submit fail) ✅, **S8 thumbnail bug fix kapatıldı** (commit `72522f3`) ✅, schema flakiness V1.1 carry-forward ✅, kullanıcı/admin Phase 8 I/J/K/L/M/N/O/P browser smoke + Etsy live submit success **external dep'lere bağlı** 🟡. **"Kod tamam" ≠ "Full release PASS"** — full release PASS Phase 8 kalan kullanıcı browser smoke + Etsy credentials/taxonomy/OAuth tamamlandığında ilan edilir. **Repo-side bug yok**, V2.x carry-forward'lar bilinçli ertelendi (real Sharp render preview, vision-aware AI, perspective render, DM structured editor, user custom upload).

Bu doküman tüm phase'lerin release readiness durumunu tek yerde gösterir.
Manual QA tamamlanmamış phase'ler için **PASS ilan edilmemiştir**;
external dependency bekleyen alanlar dürüstçe işaretlenmiştir.

---

## Phase status haritası

| Phase | Konu | Status | Manual QA | External Dep | Detay |
|---|---|---|---|---|---|
| Phase 1 | App shell + auth + nav | ✅ Live | ✅ implicit (production smoke ile geçti) | — | sidebar + login + register + role guard |
| Phase 2 | Bookmark inbox + reference board + collections | ✅ Live | ✅ implicit | — | bookmark/reference CRUD + tag + collection |
| Phase 3 | Competitor analysis | ✅ Live | ✅ implicit | ⚠️ Apify/Firecrawl scraper API key gerekirse | scraper provider abstraction + competitor card UI |
| Phase 4 | Trend stories | ✅ Live | ✅ implicit | ⚠️ Apify scraper API key gerekirse | story timeline + cluster detection + bookmark/reference action |
| Phase 5 | Variation generation | 🟢 Kapanış (17/17 task) | ✅ implicit | ⚠️ KIE key (per-user settings) | KIE GPT/Z image provider abstraction + per-user encrypted settings |
| Phase 6 | AI quality review | 🟢 **V1 Honest-fail PASS** (2026-05-04) | ✅ A + F.1 + F.2 + F.3 + G + H canlı PASS; B/C/D/E **fixture sonrası açıldı** (review queue 3 farklı state row + detail panel + decision flow "Approve anyway"/"Reject" canlı doğrulandı; tam kullanıcı browser smoke pending) + integration 43/43 PASS | ⚠️ KIE key (V1: per-user settings; canlı doğrulandı) | KIE Gemini 2.5 Flash review provider canlı doğrulandı (`kie-health-probe.ts` 200 + `smoke-data-url-probe.ts` 200); cost tracking aktif; runbook 2.2 honest-fail PASS sınırı içinde |
| Phase 7 | Selection studio | 🟢 v1.0.1 (Manuel QA GEÇTİ) | ✅ Geçti | — | 42 task + 2 polish; SelectionSet state machine + heavy edit-op + Quick Pack + cover invariant |
| Phase 8 | Mockup studio | 🟡 **Pending — A-H + G.1 canlı PASS (Pass 16 sonrası), I/J/K/L/M/N/O/P kullanıcı browser smoke'a açık** | ⏳ **Pass 16 (HEAD `72522f3`) gerçek browser ürün QA turunda admin akışı uçtan uca canlı koşturuldu**: Apply (Quick Pack default + Render et enabled) → POST /api/mockup/jobs 202 → S7 polling (Pack Hazırlanıyor 0/3 → 3/3) → BullMQ MOCKUP_RENDER worker Sharp local 3/3 SUCCESS → S7 → S8 auto-redirect → S8 result page (cover + 2 grid render canlı thumbnail 800×600) → "Listing'e gönder" handoff → /listings/draft yaratıldı → KIE Gemini 2.5 Flash AI Oluştur title+desc+13 tag canlı + honest submit fail (price missing). **Pass 16 bug fix (commit `72522f3`):** S8ResultView + CoverSwapModal `<img src={render.outputKey}>` storage path direkt src kullanıyordu (broken thumbnail) → `/api/mockup/jobs/[jobId]/renders/[renderId]/download` image stream endpoint'ine geçildi (auth ownership server-side korunur). I cover swap submit + J/K/L PARTIAL_COMPLETE failed render UI + M cross-user + N completion toast + O backdrop kullanıcı/admin browser smoke'una açık (fixture + üretim akışı tetiklenebilir + tam yürünebilir). | — (Phase 8 self-contained; honest-fail path YOK) | 33 task; Sharp local renderer + Dynamic Mockups stub; Phase 9 köprüsü tamam; runbook 4.1 "tüm bölümler PASS" sözleşmesi tam koşum gerektirir; Pass 16 sonrası Apply→render→result→handoff→KIE→submit honest zinciri uçtan uca canlı; geriye sadece I/J/K/L/M/N/O/P kullanıcı koşumu kaldı |
| Phase 9 | Listing builder | 🟢 **V1 Honest-fail PASS** (2026-05-04) | ✅ A.1 + A.2 + B + C + D + E.1 + E.2 canlı KIE 10/10 + F + G.1 + I + J.1+J.5+J.6+J.7+J.8+J.9 + L.4 + auto-save yokluk + readiness recompute canlı PASS | ⚠️ Etsy credentials + `ETSY_TAXONOMY_MAP_JSON` env + OAuth live test (H + G.2-G.6 blocked — runbook 5.2 honest-fail PASS sınırı içinde) | 32+ commit (V1) + 5 closeout fix; submit pipeline tam (taxonomy resolve + draft create + image upload + token refresh resilience); SubmitResultPanel + recovery; readiness diagnostics; cost recording aktif |

**Genel durum:** **2 phase 🟢 V1 PASS (Phase 7) + 2 phase 🟢 V1 Honest-fail PASS (Phase 6, 9)** + 5 phase ✅ Live (1-5) + **1 phase 🟡 Pending — manual QA başlatma noktası açık (Phase 8 — fixture seed eklendi)**.

**Repo-wide release stance:** 🟡 — Phase 8 fixture'lı manual QA browser smoke kullanıcı/admin tarafında pending + Phase 9 H (live submit success) external dep'e bağlı. **"V1 Honest-fail PASS" ≠ "Full release PASS"**. Full release PASS Phase 8 fixture'lı manual QA + Etsy operasyonel dep tamamlanınca ilan edilir. **Repo-side blocker'lar bu turda tamamen kapatıldı** — fixture seed `scripts/seed-qa-fixtures.ts` Phase 6 + Phase 8 manual QA başlatma noktasını açtı.

---

## Otomasyon gate'leri (HEAD `72522f3`+ Pass 16/17)

| Gate | Sonuç | Komut |
|---|---|---|
| TypeScript strict | 0 hata (Pass 15 değişiklik dosyalarında); 3 pre-existing route-export class hatası bizden değil (Phase 9 listings) | `npx tsc --noEmit` |
| Lint (Pass 15 değişiklik dosyaları) | 0 hata (1 pre-existing img warning) | `npx next lint --file ...` |
| Token check (Tailwind disipline) | İhlal yok | `npm run check:tokens` |
| Default test suite (Pass 15 + Pass 14 yeni testler) | clone 6/6 + list-assets 8/8 + validate-config 9/9 = 23/23 yeni; 1 pre-existing fetch-new-listings-worker fail bizden değil (baseline'da da fail) | `npm test` |
| UI test suite (jsdom) | 946/946 pass | `npm run test:ui` |
| E2E suite | (Phase 8 baseline + Phase 7 selection-flow + auth-flow) | `npm run test:e2e` |

**Toplam test:** 2700+ unit/integration test + E2E senaryosu Phase 7+8 baseline.

---

## Repo-wide audit sonucu (2026-05-04)

İki paralel audit pass yapıldı:

### Pass 1 — General-purpose audit (kullanıcı/QA görünür açıklar)
- Cross-phase consistency: ✅ temiz (Phase 5→6→7→8→9 deep-link/cache/state mismatch yok)
- Cache invalidation: ✅ tam (tüm listing mutation'ları `["listing-draft", id]` + `["listings"]` invalidate ediyor)
- Honest fail discipline: ✅ tam (`EtsyNotConfiguredError` 503, `EtsyTokenRefreshFailedError` 401, `EtsyTaxonomyMissingError` 422, `LISTING_*` family — fake success/mock-as-real yok)
- Fix-now bulgu: 1 doc-drift (`phase9-status.md` HEAD `ddb3acf` → `92b0072` sync) — bu commit'te kapatıldı
- Phase 6 drift #6 + Aşama 2B kod kapanışı (2026-05-04 patch): kie-gemini-flash.ts data URL inline; canlı smoke hâlâ external dep

### Pass 2 — Explore deep stale code/drift audit
- Stale TODO/Phase-X-eklenecek yorumları: 5 bulgu
  - **3 doğru claim** (`AiQualityPanel` + `AddVariantsDrawer` "Phase 6 canlı smoke sonrası aktif" + `themes-list` "Phase 10'da" — Phase 6 canlı smoke gating doğru, drift #6 + KIE flaky bekliyor)
  - **2 minor copy** (per-render download "Phase 9'da" — Phase 9 V1.1+'da; admin auth Google sign-in "yakında" — intentional MVP scope dışı)
- Disabled UI button'lar: 4 bulgu — hepsi bilinçli carry-forward (Review Queue, AI Review, Upscale, Auth Google) veya admin V1.1+
- Test gap: 7 admin endpoint integration test eksik — V1.1+ pragmatik (admin yüzeyleri ana akışta değil)
- Unused export: ✅ yok (`src/providers/etsy/index.ts` 36 import, hooks 35 import — hepsi tüketilmiş)
- CLAUDE.md uyumu: ✅ "do not skip ahead" ihlali yok (Phase 1-9 sıralı)

### Audit kararı
**Repo gerçekten temiz** — büyük "fix-now" paketi gerekmiyordu. Audit doğrulaması: implementation/local foundation seviyesinde Phase 1-9 V1 demo değil ürün kalitesinde.

---

## External dependency listesi (operasyonel)

Live Etsy submit success için tüm 3'ü gerek:

1. **Etsy app credentials** — `developer.etsy.com` üzerinde app oluşturulmalı + `.env.local`'e `ETSY_CLIENT_ID/SECRET/REDIRECT_URI` eklenmeli + redirect URI verify edilmeli
2. **`ETSY_TAXONOMY_MAP_JSON` env** — Admin `developer.etsy.com /seller-taxonomy/nodes` endpoint'inden ProductType key (canvas/wall_art/printable/clipart/sticker/tshirt/hoodie/dtf) için ID'leri çıkarmalı + JSON object olarak `.env.local`'e koymalı
3. **OAuth flow live test** — Kullanıcı browser'da Settings → "Etsy'ye bağlan" akışını gerçek bir Etsy hesabıyla geçmeli

AI metadata generation için (opsiyonel, "AI Oluştur" butonu için):
- **KIE Gemini 2.5 Flash key** — Settings → AI Mode'dan kullanıcı `kieApiKey` girmeli (per-user settings, encrypted at rest)

---

## Manual QA kuyruğu (kullanıcı sorumluluğu)

| Phase | Doküman | Status |
|---|---|---|
| **Phase 6 V1** | [`phase6-manual-qa.md`](./phase6-manual-qa.md) | 🟢 **Honest-fail PASS** (2026-05-04 — A + F.1 + F.2 + F.3 + G + H canlı; B/C/D/E fixture sonrası açıldı: review queue 3 state row + detail panel "Review Detayı" + decision flow "Approve anyway"/"Reject" canlı doğrulandı; integration 43/43 PASS). Phase 7 v1.0.1 Review Queue + AI Quality Panel "Review'a gönder" gating zaten açık |
| Phase 8 V1 | [`phase8-manual-qa.md`](./phase8-manual-qa.md) | 🟡 **Pending — A-H + G.1 canlı PASS (Pass 16), I/J/K/L/M/N/O/P kullanıcı browser smoke'a açık** (Pass 16 turunda Apply → render → S7 polling → S8 auto-redirect → cover+grid render thumbnail (bug fix sonrası canlı) → bulk ZIP → Phase 9 köprüsü → KIE generate-meta → honest submit fail uçtan uca canlı PASS; cover swap submit + per-render failed UI + cross-user + toast + backdrop kullanıcı tarafında pending) |
| **Phase 9 V1** | [`phase9-manual-qa.md`](./phase9-manual-qa.md) | 🟢 **Honest-fail PASS** (2026-05-04 — V1 zorunlu kapsam canlı PASS + KIE Gemini 2.5 Flash 10/10 stabilite + cost recording canlı doğrulandı; H Etsy live submit success + G.2-G.6 OAuth flow live external dep blocked, runbook 5.2 sınırı içinde) |

---

## Manual QA sıra planı (zorunlu)

Phase'ler arası bağımlılıklar nedeniyle manual QA aşağıdaki sırada yapılmalı:

1. **Phase 6 V1** — [`phase6-manual-qa.md`](./phase6-manual-qa.md)
   - Önkoşul: KIE health probe 3/3 HEALTHY (terminal: `npx tsx scripts/kie-health-probe.ts`)
   - Önkoşul: Settings → AI Mode'da `kieApiKey` doldurulmuş
   - Kapsam: AI mode (F.1) + local mode (F.2) + honest-fail (F.3, F.4)
   - **Sonuç:** Phase 7 v1.0.1 Review Queue + AiQualityPanel gating açılır
   - **KIE flaky external dep** — endpoint 24h+ tutarlı HEALTHY olmadan smoke retry önerilmez

2. **Phase 7 v1.0.1 Review Queue activation** (Phase 6 sonrası)
   - Manuel test gerekmez — Phase 6 PASS sonrası kod tarafı zaten aktif
   - Selection Studio AI Quality Panel "Review'a gönder" button artık enabled
   - AddVariantsDrawer Review Queue tab erişilebilir

3. **Phase 8 V1** — [`phase8-manual-qa.md`](./phase8-manual-qa.md)
   - Önkoşul: Postgres + MinIO + Redis + BullMQ worker running
   - Önkoşul: 8 ACTIVE MockupTemplate seed (admin user)
   - Kapsam: 6 ekran (S3-S8) + ZIP download + cover swap + per-render retry
   - **Phase 9 köprüsü:** G.1 alt-section "Listing'e gönder" CTA test (Phase 9 V1 handoff)
   - **Sonuç:** Phase 8 V1 closeout PASS ilanı

4. **Phase 9 V1** — [`phase9-manual-qa.md`](./phase9-manual-qa.md)
   - Önkoşul: Phase 8 V1 manual QA PASS (S8 result valid pack required)
   - Kapsam zorunlu: A-G bölümleri (handoff + detail + edit + index + AI E.1 honest-fail + negative library + Settings)
   - Kapsam opsiyonel: E.2 (KIE live AI), H (Etsy live submit success), J (honest-fail tüm path'ler)
   - **3 external dep eş zamanlı:** ETSY_CLIENT_ID/SECRET/REDIRECT_URI + ETSY_TAXONOMY_MAP_JSON + OAuth live test
   - **Sonuç:** Phase 9 V1 closeout PASS ilanı

5. **Final closeout** — bu doc + her phase'in status doc'u
   - Status `🟡` → `🟢 PASS` update
   - `## Bulgular — YYYY-MM-DD` section'ı her phase'in manual-qa.md doc'una ekle
   - Sürpriz bulgu varsa drift olarak status doc'a yansıt

---

## V1.1+ / V2 carry-forward (bilinçli)

Bu işler V1 sözleşmesinde **kasıtlı olarak yok**; release readiness'i etkilemez:

- **Phase 9.1+** — token refresh background BullMQ worker (V1: submit-time opportunistic), admin taxonomy UI (V1: env-based), DB-backed `ProductType.etsyTaxonomyId Int?` field, KIE Gemini schema flakiness mitigation (validation-guided retry max 2 try; V1: honest 502 + retry button), hard-block negative library (severity "error"; V1: K3 soft warn), image upload paralelleştirme + retry policy (V1: sequential)
- **Seed drift V1.1** — production seed canvas ProductType.aspectRatio "3:4" ama Phase 8 canvas MockupTemplate'lar "2:3" aspectRatio ile seed (asset prep tarafı). V1'de QA fixture seed bu drift'i runtime'da çözüyor (template'ın aspect'ine uyan ProductType seçimi); V1.1: seed normalization (admin asset prep + production seed aspectRatio uyumu) veya quick-pack aspect normalization (loose match)
- ~~**Phase 8 V1.1** — admin user için fixture seed scripti~~ → **V1'de açıldı** (`scripts/seed-qa-fixtures.ts`, COMPLETED + PARTIAL_COMPLETE varyantları); manual QA A-O senaryoları doğrudan başlatılabilir
- **Phase 6 V1.1** — review pipeline browser e2e fixture; master prompt admin UI; threshold settings UI (V1: hardcoded 60/90)
- **V2** — Etsy active publish (`state: "active"`), multi-store, custom mockup upload (Spec §10), AI-assisted style variant
- **Phase 10+** — Admin theme token editor (mevcut: aktif tema seçimi), advanced analytics
- **Auth** — Google sign-in / forgot password (intentional MVP scope dışı)
- **Test gap** — 7 admin endpoint integration test (audit pass bulgusu, V1.1+ pragmatik öncelik)
- **Folder unification** — `ui/` ↔ `components/` ADR'lı rasyonalizasyon

---

## Kapanış için kalan adımlar (Full release PASS için)

V1 Honest-fail PASS ilan edildi (Phase 6 + 9). **Full release PASS** için kalan:

1. **Phase 8 V1 manual QA** — kullanıcı/admin Phase 7 üzerinden 1 ready SelectionSet hazırlar (variation generation → review approve → selection finalize) sonra `/selection/sets/[setId]/mockup/apply` üzerinden Phase 8 A-O senaryolarını koşturur. Phase 8 self-contained (KIE bağımsız Sharp local renderer) — gerçek browser akışı zorunlu.
2. **Etsy operasyonel hazırlık** — sysadmin/admin: 3 external dep'i sırayla tamamlar:
   - `developer.etsy.com` üzerinde Etsy app oluştur + `.env.local`'e `ETSY_CLIENT_ID/SECRET/REDIRECT_URI` ekle + redirect URI verify
   - `developer.etsy.com /seller-taxonomy/nodes` endpoint'inden ProductType ID'lerini çıkar + `ETSY_TAXONOMY_MAP_JSON` env JSON'u `.env.local`'e koy
   - Browser'dan `Settings → Etsy bağlantısı → "Etsy'ye bağlan"` ile gerçek OAuth flow live test
3. **Phase 9 H + G.2-G.6 final smoke** — credentials + taxonomy + OAuth tamamlandıktan sonra Phase 9 manual QA H + G.2-G.6 bölümleri canlı koşturulur (submit live success path → 200 + etsyListingId + image upload diagnostics; OAuth start/callback/expired/delete state'leri).
4. **Final closeout doc update** — kalan 🟡'ler 🟢'a çevrilir; `phase8-closeout.md` + `release-readiness.md` Phase status haritası "Full release PASS" olarak güncellenir.

**Mevcut durum sözlüğü:**
- ✅ **Kod tamam** — V1 implementation/local foundation neredeyse tamam, otomasyon gate'leri PASS, 5 fix-now bug bu turlarda kapatıldı
- 🟢 **V1 Honest-fail PASS (Phase 6, 9)** — V1 zorunlu kapsam canlı PASS, runbook honest-fail PASS sınırı içinde
- 🟡 **Pending — fixture-blocked (Phase 8)** — kod tamam, fixture'lı manual QA bekliyor
- 🟡 **Full release PASS** — Phase 8 + Etsy operasyonel dep tamamlanınca ilan edilecek

**Bu doc release readiness snapshot.** Manual QA gerçek koşumu sonrası status güncellendi (HEAD `dc3bf69`, 2026-05-04). Full release PASS için yukarıdaki 4 adım tamamlanmalı.
