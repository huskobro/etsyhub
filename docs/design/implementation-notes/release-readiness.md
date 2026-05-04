# EtsyHub Release Readiness — Repo-Wide Status

> **Tarih:** 2026-05-04 (repo-wide final audit sonrası)
> **HEAD:** `92b0072`
> **Audit sonucu:** 2 paralel audit pass (general-purpose + Explore deep stale code) — fake fix-now bulgu yok; doc-drift sync edildi; bilinçli V1.1+ carry-forward'lar doğrulandı.

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
| Phase 6 | AI quality review | 🟡 Backend + UI + provider tam (drift #6 + Aşama 2B kod kapandı) | ⏳ canlı smoke pending — KIE flaky external | ⚠️ KIE key | KIE/Google Gemini Flash review provider; UI vitrin tamam, kod tarafı kapanmış (data URL inline drift #6 fix); Selection Studio AI Quality Panel & Review Queue canlı smoke gating'i kullanıcı/altyapı sorumluluğunda |
| Phase 7 | Selection studio | 🟢 v1.0.1 (Manuel QA GEÇTİ) | ✅ Geçti | — | 42 task + 2 polish; SelectionSet state machine + heavy edit-op + Quick Pack + cover invariant |
| Phase 8 | Mockup studio | 🟡 Implementation complete | ⏳ pending — `phase8-manual-qa.md` checklist'i kullanıcı koşturacak | — | 33 task; Sharp local renderer + Dynamic Mockups stub; Phase 9 köprüsü tamam |
| Phase 9 | Listing builder | 🟡 Pre-closeout — implementation/local foundation neredeyse tamam | ⏳ pending — `phase9-manual-qa.md` | ⚠️ Etsy credentials + `ETSY_TAXONOMY_MAP_JSON` env + OAuth live test + KIE key (AI metadata) | 28+ commit; submit pipeline tam (taxonomy resolve + draft create + image upload + token refresh resilience); SubmitResultPanel + recovery; readiness diagnostics |

**Genel durum:** 1 phase 🟢 PASS (Phase 7), 5 phase ✅ Live (1-5), 2 phase 🟡 manual QA pending (Phase 6, 8), 1 phase 🟡 pre-closeout (Phase 9).

---

## Otomasyon gate'leri (HEAD `92b0072`)

| Gate | Sonuç | Komut |
|---|---|---|
| TypeScript strict | 0 hata | `npx tsc --noEmit` |
| Token check (Tailwind disipline) | İhlal yok | `npm run check:tokens` |
| Default test suite | 1671/1671 pass | `npm test` |
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
| **Phase 6 V1** | [`phase6-manual-qa.md`](./phase6-manual-qa.md) | ⏳ henüz koşulmadı (kod tarafı tamam — drift #6 + Aşama 2B kapandı HEAD `f686882`; KIE flaky external dep — health probe 3/3 HEALTHY önkoşulu); **Phase 7 v1.0.1 Review Queue gating'i bağlı** — kapanana kadar Review Queue + AiQualityPanel "Review'a gönder" disabled kalır |
| Phase 8 V1 | [`phase8-manual-qa.md`](./phase8-manual-qa.md) | ⏳ henüz koşulmadı |
| Phase 9 V1 | [`phase9-manual-qa.md`](./phase9-manual-qa.md) | ⏳ henüz koşulmadı (HEAD `92b0072` sync edildi; L bölümü dahil tüm yüzey test edilebilir) |

Phase 6 canlı smoke kapanmadan **Phase 7 v1.0.1**'in Review Queue tab'ı disabled
kalır (intentional gating); kapanınca aktif olur. Phase 9 V1 PASS ilanı için
Phase 8 V1 manual QA da kapanması gerekir.

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

- **Phase 9.1+** — token refresh background BullMQ worker (V1: submit-time opportunistic), per-render PNG/JPG download endpoint (V1: bulk ZIP), admin taxonomy UI (V1: env-based), DB-backed `ProductType.etsyTaxonomyId Int?` field
- **V2** — Etsy active publish (`state: "active"`), multi-store, custom mockup upload (Spec §10), AI-assisted style variant
- **Phase 10+** — Admin theme token editor (mevcut: aktif tema seçimi), advanced analytics, cost tracking integration
- **Auth** — Google sign-in / forgot password (intentional MVP scope dışı)
- **Test gap** — 7 admin endpoint integration test (audit pass bulgusu, V1.1+ pragmatik öncelik)

---

## Kapanış için kalan adımlar

1. **Phase 6 canlı smoke** — drift #6 + KIE flaky kapanması; Phase 7 v1.0.1 Review Queue + AI Quality Panel "Review'a gönder" button bağlı
2. **Phase 8 V1 manual QA** — kullanıcı browser smoke'u (Phase 9 closeout için önkoşul)
3. **Phase 9 V1 manual QA** — kullanıcı browser smoke'u (`phase9-manual-qa.md` checklist; readiness summary + L bölümü dahil)
4. **Etsy operasyonel hazırlık** — kullanıcı/admin: 3 external dep'i (credentials + taxonomy env + OAuth live test) tamamlar
5. **Phase 9 V1 final closeout** — A-B-C-D tamamlandıktan sonra `phase9-status.md` ve bu doc'ta status `🟡` → `🟢 PASS`

**"PASS" / "tamamlandı" ilan edilmedi.** Bu doc **release readiness snapshot**;
manual QA gerçek koşumu sonrası status güncellenir.
