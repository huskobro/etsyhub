# EtsyHub Release Readiness — Repo-Wide Status

> **Tarih:** 2026-05-04 (V1 final closeout — manual QA execution sonrası)
> **HEAD:** `dc3bf69`
> **Closeout runbook:** [`./final-closeout-runbook.md`](./final-closeout-runbook.md) — kullanıcı/admin **buradan** son 1 mile'ı yürür (PASS/honest-fail PASS/blocked sınırları + closeout sonrası doc update planı)
> **Audit sonucu:** 5 audit pass — Pass 1+2 (HEAD `92b0072`): cross-phase consistency + stale claim; Pass 3 (HEAD `0e9436d`): script env + integration test runner + UI claim verify; Pass 4 (HEAD `920c6d2`): browser-based manual QA + AssetSection ZIP-ready vacuous truth fix; **Pass 5 (HEAD `dc3bf69`): manual QA execution + 5 fix-now bug + canlı KIE smoke + 10/10 stability** (title pass-message regression `b89d873` + ai-mode 500 cipher decrypt safe-fallback `78d82e3` + logger pino-pretty crash `f1d4664` + listing-meta cost recording `dc3bf69`). **1674 default + 946 UI test PASS** doğrulandı.
>
> **Genel durum (V1 Honest-fail PASS):** Kod tamam ✅, V1 zorunlu kapsam canlı PASS ✅, schema flakiness V1.1 carry-forward ✅, Phase 8 + Etsy live submit success **external dep'lere bağlı** 🟡. **"Kod tamam" ≠ "Full release PASS"** — full release PASS Phase 8 manual QA fixture + Etsy credentials/taxonomy/OAuth tamamlandığında ilan edilir.

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
| Phase 6 | AI quality review | 🟢 **V1 Honest-fail PASS** (2026-05-04) | ✅ A + F.1 + F.2 + F.3 + G + H canlı PASS; B/C/D/E browser e2e fixture-blocked (integration 43/43 PASS) | ⚠️ KIE key (V1: per-user settings; canlı doğrulandı) | KIE Gemini 2.5 Flash review provider canlı doğrulandı (`kie-health-probe.ts` 200 + `smoke-data-url-probe.ts` 200); cost tracking aktif; runbook 2.2 honest-fail PASS sınırı içinde |
| Phase 7 | Selection studio | 🟢 v1.0.1 (Manuel QA GEÇTİ) | ✅ Geçti | — | 42 task + 2 polish; SelectionSet state machine + heavy edit-op + Quick Pack + cover invariant |
| Phase 8 | Mockup studio | 🟡 **Pending — fixture-blocked** | ⏳ Selection Studio entry render PASS; A-O ana akış admin user için SelectionSet/MockupJob fixture eksikliği nedeniyle blocked | — (Phase 8 self-contained; honest-fail path YOK) | 33 task; Sharp local renderer + Dynamic Mockups stub; Phase 9 köprüsü tamam; runbook 4.1 "tüm bölümler PASS" sözleşmesi fixture'lı gerçek akışı zorunlu kılıyor |
| Phase 9 | Listing builder | 🟢 **V1 Honest-fail PASS** (2026-05-04) | ✅ A.1 + A.2 + B + C + D + E.1 + E.2 canlı KIE 10/10 + F + G.1 + I + J.1+J.5+J.6+J.7+J.8+J.9 + L.4 + auto-save yokluk + readiness recompute canlı PASS | ⚠️ Etsy credentials + `ETSY_TAXONOMY_MAP_JSON` env + OAuth live test (H + G.2-G.6 blocked — runbook 5.2 honest-fail PASS sınırı içinde) | 32+ commit (V1) + 5 closeout fix; submit pipeline tam (taxonomy resolve + draft create + image upload + token refresh resilience); SubmitResultPanel + recovery; readiness diagnostics; cost recording aktif |

**Genel durum:** **2 phase 🟢 V1 PASS (Phase 7) + 2 phase 🟢 V1 Honest-fail PASS (Phase 6, 9)** + 5 phase ✅ Live (1-5) + **1 phase 🟡 Pending — fixture-blocked (Phase 8)**.

**Repo-wide release stance:** 🟡 — Phase 8 fixture-blocked + Phase 9 H (live submit success) external dep'e bağlı. **"V1 Honest-fail PASS" ≠ "Full release PASS"**. Full release PASS Phase 8 manual QA + Etsy operasyonel dep tamamlanınca ilan edilir.

---

## Otomasyon gate'leri (HEAD `dc3bf69`)

| Gate | Sonuç | Komut |
|---|---|---|
| TypeScript strict | 0 hata | `npx tsc --noEmit` |
| Token check (Tailwind disipline) | İhlal yok | `npm run check:tokens` |
| Default test suite | 1674/1674 pass | `npm test` |
| UI test suite (jsdom) | 946/946 pass | `npm run test:ui` |
| E2E suite | (Phase 8 baseline + Phase 7 selection-flow + auth-flow) | `npm run test:e2e` |

**Toplam test:** 2617 unit/integration test + E2E senaryosu Phase 7+8 baseline.

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
| **Phase 6 V1** | [`phase6-manual-qa.md`](./phase6-manual-qa.md) | 🟢 **Honest-fail PASS** (2026-05-04 — A + F.1 + F.2 + F.3 + G + H canlı; B/C/D/E browser e2e fixture-blocked, integration 43/43 PASS). Phase 7 v1.0.1 Review Queue + AI Quality Panel "Review'a gönder" gating zaten açık |
| Phase 8 V1 | [`phase8-manual-qa.md`](./phase8-manual-qa.md) | 🟡 **Pending — fixture-blocked** (Selection Studio entry render PASS; A-O ana akış admin user için SelectionSet/MockupJob seed eksikliği nedeniyle blocked; runbook 4.2 honest-fail path YOK) |
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

- **Phase 9.1+** — token refresh background BullMQ worker (V1: submit-time opportunistic), per-render PNG/JPG download endpoint (V1: bulk ZIP), admin taxonomy UI (V1: env-based), DB-backed `ProductType.etsyTaxonomyId Int?` field, KIE Gemini schema flakiness mitigation (validation-guided retry max 2 try; V1: honest 502 + retry button), hard-block negative library (severity "error"; V1: K3 soft warn), image upload paralelleştirme + retry policy (V1: sequential)
- **Phase 8 V1.1** — admin user için fixture seed scripti (variation→review→selection→mockup pipeline tetikleyici); manual QA browser-based smoke'u doğrudan açar
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
