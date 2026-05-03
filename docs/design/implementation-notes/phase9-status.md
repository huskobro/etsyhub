# Phase 9 — Listing Builder Status (Pre-Closeout)

> **Tarih:** 2026-05-03
> **Status:** 🟡 **Pre-closeout** — Phase 9 V1 lokal yüzeyi doygun (listing CRUD + AI metadata + submit UI hazır), Etsy live success external dependency bekliyor; manual QA henüz koşulmadı; "PASS" / "tamamlandı" ilan edilmedi
> **HEAD:** `ebd20af`
> **Spec:** [`../../plans/2026-05-02-phase9-listing-builder-design.md`](../../plans/2026-05-02-phase9-listing-builder-design.md)
> **Plan:** [`../../plans/2026-05-02-phase9-listing-builder-plan.md`](../../plans/2026-05-02-phase9-listing-builder-plan.md)
> **Manual QA:** [`./phase9-manual-qa.md`](./phase9-manual-qa.md) (henüz koşulmadı)
> **Phase 8 emsali:** [`./phase8-closeout.md`](./phase8-closeout.md) (Phase 8 V1 hâlâ `🟡 manual QA pending`)

## Özet

Phase 9 V1 Listing Builder lokal yüzeyi **bağımsız çalışır** seviyede:
listing draft create (Phase 8 handoff'tan), GET/PATCH detay, listings index,
readiness checklist (soft warn), negative library guard, AI metadata
generation (KIE/Gemini 2.5 Flash, foundation + live-if-configured) ve submit
UI (gerçek endpoint, honest fail). Etsy V3 provider abstraction + OAuth
scaffold + submit service + endpoint **foundation** olarak yazıldı; ama gerçek
Etsy publish success **external dependency** (developer credentials, OAuth
callback flow tamamlanması, taxonomy mapping, image upload pipeline)
bekliyor.

**Phase 8 → Phase 9 contract:** MockupJob terminal state (`COMPLETED` veya
`PARTIAL_COMPLETE`) + `coverRenderId` invariant + `imageOrderJson`
snapshot — Phase 9 handoff service Phase 8 output'unu listing draft
input'una çevirir, Phase 8 yüzeyine **dokunulmadı**.

**Phase 6 (review) ve KIE/Gemini ilişkisi:** Phase 6 review provider yüzeyi
**dokunulmadı**. Phase 9 listing-meta için ayrı abstraction
(`src/providers/listing-meta-ai/`) yazıldı — text-only, image input yok.
Mevcut `aiMode.kieApiKey` settings altyapısı (encrypted-at-rest) reuse edildi.

---

## Phase 8 → Phase 9 Contract

| Phase 8 çıktısı | Phase 9 girdisi | Nerede |
|---|---|---|
| `MockupJob.status ∈ {COMPLETED, PARTIAL_COMPLETE}` | Handoff input gate | [handoff.service.ts](../../../src/features/listings/server/handoff.service.ts) terminal status check |
| `MockupRender[]` (success only, packPosition ASC) | `Listing.imageOrderJson` snapshot | Handoff anında snapshot alınır; sonradan re-fetch yok |
| `MockupJob.coverRenderId` (cover invariant `packPosition=0`) | `Listing.coverRenderId` (cover thumbnail kaynağı) | Direkt taşınır |
| `MockupJob.id` | `Listing.mockupJobId` (FK, `onDelete: SetNull`) | Listing detay artık asset re-fetch yapmaz |

**Reuse'lanan Phase 8 invariant'ları:**
- Cover invariant `packPosition=0` ⇔ `coverRenderId` (Listing seviyesinde de geçerli)
- Bulk ZIP cover-first filename ordering — Phase 9 listing draft view "ZIP İndir" link'inde aynı pattern
- Status enum ekleme YOK — Phase 9 mevcut `ListingStatus` ile çalışır

**Dokunulmayan Phase 8 alanları:** `src/features/mockups/**`, `src/providers/mockup/**`,
`src/app/api/mockup/**`, `prisma/schema.prisma` (Phase 8 modelleri).

---

## Tamamlanan Phase 9 katmanları (commit haritası)

| Slice | Açıklama | Commit |
|---|---|---|
| Foundation | Listing extend (additive: mockupJobId, coverRenderId, imageOrderJson, submittedAt, publishedAt, etsyListingId, failedReason) + handoff service (Task 1-3) | `6c76733` |
| State + readiness | State machine (V1: DRAFT only) + readiness service (6 check, soft warn) | `9b904a8` |
| API foundation | POST/GET/PATCH draft + GET listings index (Task 13-15+18) | `1e6226d` (+ TS fix `7859893`) |
| UI foundation | ListingDraftView + S8 CTA activation (Task 19) | `856cd0c` |
| Edit forms | AssetSection + MetadataSection + PricingSection (Task 20) | `d22870a` (+ types contract fix `a8213f5`) |
| Listings index page | `/listings` route + status filter (Task 18 V2) | `7726876` |
| Negative library | Service + readiness integration (Task 12) | `c54d04b` |
| Test stability | Unique email + FK-safe cleanup chain | `9aa581c` |
| Consolidation batch | Listings surface non-blocked polish (a11y + cache + status labels) | `8eaa43a` |
| AI provider foundation | listing-meta-ai abstraction + KIE Gemini Flash + generateListingMeta service (Task 5+9) | `1cf4be4` |
| AI vertical slice | generate-meta endpoint + UI button activation (Task 16) | `1b778ca` |
| Etsy foundation | Provider abstraction + OAuth scaffold + error classifier + submit service + endpoint (Task 4+10+11+17) | `23f6ffd` |
| Submit UI | useSubmitListingDraft hook + ListingDraftView submit button activation (Task 22) | `ebd20af` |

**Toplam:** 18+ commit, 0 revert.

---

## Çalışan yüzeyler (lokal — external credential gerekmez)

### 1. Draft create (Phase 8 → Phase 9 handoff)
- **Endpoint:** `POST /api/listings/draft` (body: `{ mockupJobId }`)
- **Service:** [`handoff.service.ts`](../../../src/features/listings/server/handoff.service.ts) `createListingDraftFromMockupJob`
- **UI:** Phase 8 S8ResultView "Listing'e gönder" CTA — `router.push("/listings/draft/${listingId}")`
- **Davranış:** Terminal MockupJob → Listing DRAFT yaratır, `imageOrderJson` snapshot alır, ownership cross-user 404 disiplini uygular
- **Test:** [`tests/integration/listings/handoff.test.ts`](../../../tests/integration/listings/handoff.test.ts) (6 senaryo)

### 2. Draft detail (read + edit)
- **Endpoint:** `GET /api/listings/draft/[id]` + `PATCH /api/listings/draft/[id]`
- **UI:** [`/listings/draft/[id]`](../../../src/app/(app)/listings/draft/[id]/page.tsx) — `ListingDraftView` (AssetSection + readiness checklist + MetadataSection + PricingSection + Submit)
- **Davranış:** Manuel "Kaydet" — auto-save YOK; readiness recompute her PATCH sonrası; legacy alanlar (generatedDesignId, etsyDraftId, productTypeId, mockups[], imageOrderJson, deletedAt) view'da expose edilmez (K6 lock)
- **Test:** [`tests/integration/listings/api/{get,update}-draft.test.ts`](../../../tests/integration/listings/api/) + UI testleri

### 3. Listings index
- **Endpoint:** `GET /api/listings?status=...` (opsiyonel status filter)
- **UI:** [`/listings`](../../../src/app/(app)/listings/page.tsx) — `ListingsIndexView` (status filter + Türkçe label badge'ler + empty state guidance)
- **Davranış:** User scope, `deletedAt: null`, `updatedAt DESC`; readiness DÖNMEZ (perf — detail'de hesaplanır)
- **Test:** [`tests/integration/listings/api/list.test.ts`](../../../tests/integration/listings/api/list.test.ts) (6 senaryo)

### 4. Readiness checklist (soft warn)
- **Service:** [`readiness.service.ts`](../../../src/features/listings/server/readiness.service.ts) `computeReadiness(listing)` → 6 check (title/description/tags/category/price/cover)
- **UI:** ListingDraftView "Hazırlık Kontrolleri" bölümü — yeşil ✓ / sarı ⚠ + screen-reader-friendly suffix
- **Davranış:** K3 lock = SOFT WARN — submit'i bloklamaz, sadece kullanıcıyı bilgilendirir
- **Test:** [`tests/integration/listings/readiness.test.ts`](../../../tests/integration/listings/readiness.test.ts)

### 5. Negative library warnings
- **Service:** [`negative-library.service.ts`](../../../src/features/listings/server/negative-library.service.ts) `checkNegativeLibrary(text)` — banned terms (Disney, Marvel, Nike, Taylor Swift vb.) ile match check
- **Integration:** Readiness service title/description/tags üzerinde otomatik check; match varsa readiness mesajına yansır ("Politika uyarısı: ...")
- **Davranış:** Hard-block YOK — soft warn (K3 lock); kullanıcı yine de submit edebilir, Etsy reddedebilir
- **Test:** [`tests/integration/listings/negative-library.test.ts`](../../../tests/integration/listings/negative-library.test.ts) + readiness integration

### 6. AI metadata generation (KIE Gemini 2.5 Flash — foundation + live-if-configured)
- **Provider:** [`src/providers/listing-meta-ai/`](../../../src/providers/listing-meta-ai/)
  - Endpoint: `https://api.kie.ai/gemini-2.5-flash/v1/chat/completions` (chat/completions wire format; KIE'nin bu transport'u kullandığı bir gerçek — OpenAI provider DEĞİL)
  - Auth: `Bearer ${kieApiKey}` (per-user settings'ten decrypt)
  - Output: `{ title (5-140), description (≥1), tags (exactly 13, ≤20 char each) }` — Zod schema + KIE strict JSON schema (json_object fallback dahil)
  - Cost: 1 cent estimate (Phase 6 review provider emsali)
- **Service:** [`generate-meta.service.ts`](../../../src/features/listings/server/generate-meta.service.ts) `generateListingMeta(listingId, userId, options)` — cross-user 404 + NOT_CONFIGURED 400 + ProviderError 502
- **Endpoint:** `POST /api/listings/draft/[id]/generate-meta` (auth + Zod body strict opsiyonel `productType`/`toneHint`)
- **UI:** MetadataSection "AI Oluştur" button — click → form alanlarını doldurur (auto-save guard; kullanıcı sonra "Kaydet" tıklar)
- **Config durumu:**
  - `aiMode.kieApiKey` settings'te boşsa → runtime 400 NOT_CONFIGURED ("AI provider configured değil — Settings → AI Mode'dan KIE anahtarı ekleyin")
  - Key varsa → gerçek KIE çağrısı yapılır (live-if-configured)
- **Test:** [`tests/integration/listings/generate-meta.test.ts`](../../../tests/integration/listings/generate-meta.test.ts) + [`tests/integration/listings/api/generate-meta.test.ts`](../../../tests/integration/listings/api/generate-meta.test.ts) + UI/hook testleri

### 7. Submit UI wiring (endpoint reachable, honest fail)
- **Endpoint:** `POST /api/listings/draft/[id]/submit`
- **Service:** [`submit.service.ts`](../../../src/features/listings/server/submit.service.ts) `submitListingDraft(listingId, userId)` — pipeline: ownership → status guard → readiness snapshot → Etsy config guard → connection resolve → provider call
- **Hook:** [`useSubmitListingDraft.ts`](../../../src/features/listings/hooks/useSubmitListingDraft.ts) (cache invalidation: `["listing-draft", id]` + `["listings"]`)
- **UI:** ListingDraftView footer "Taslak Gönder" button + readiness uyarı + PUBLISHED/FAILED status banner + taze submit success/error banner
- **Davranış:** Backend honest fail (typed AppError → HTTP map) UI'a kullanıcı dostu Türkçe mesaj olarak gelir; **fake success YOK**
- **Test:** [`tests/integration/listings/submit.test.ts`](../../../tests/integration/listings/submit.test.ts) + [`tests/integration/listings/api/submit.test.ts`](../../../tests/integration/listings/api/submit.test.ts) + hook/UI testleri

### 8. Listing assets ZIP download
- **Endpoint:** `GET /api/listings/draft/[id]/assets/download`
- **Service:** Phase 8 [`buildMockupZip`](../../../src/features/mockups/server/download.service.ts) reuse — yeni archiver/storage/manifest kodu YOK; tek import köprü
- **Bridge mantığı:** Listing fetch + ownership 404 + soft-delete guard + `mockupJobId` null guard (409 `LISTING_ASSETS_NOT_READY`); Phase 8 service typed error'ları (404 `JobNotFound`, 403 `JobNotDownloadable`) `errorResponse` üzerinden HTTP'ye pass-through
- **UI:** [`AssetSection.tsx`](../../../src/features/listings/components/AssetSection.tsx) "ZIP İndir" link gerçek route'a bağlı; tüm imageOrder render'ları yüklüyse görünür
- **Filename:** `listing-{etsyListingId || cuid}.zip` (Etsy submit sonrası daha okunabilir)
- **Test:** [`tests/integration/listings/api/assets-download.test.ts`](../../../tests/integration/listings/api/assets-download.test.ts) (8 senaryo: 400 invalid path, 404 listing yok / cross-user / soft-deleted, 409 mockupJobId null, 403 job non-terminal, 200 happy + ZIP magic bytes, 200 etsyListingId filename)

---

## External dependency bekleyen alanlar

### Etsy OAuth
- **Foundation hazır:** [`src/providers/etsy/oauth.ts`](../../../src/providers/etsy/oauth.ts) — `buildAuthorizationUrl` (PKCE), `exchangeAuthorizationCode`, `refreshAccessToken`, `getEtsyOAuthConfig`, `isEtsyConfigured`
- **Eksik:**
  - OAuth callback route (`/api/etsy/oauth/callback/route.ts` yok)
  - State CSRF cookie helper yok
  - PKCE code_verifier persistence yok (cookie/session)
  - Settings → Etsy bağlantı paneli UI yok
- **Etki:** Kullanıcı browser'dan Etsy bağlantı flow'unu başlatamıyor

### Etsy credentials
- **Eksik env değişkenleri** (`.env.local`'de yok, sadece `.env.example`'de yorum):
  - `ETSY_CLIENT_ID`
  - `ETSY_CLIENT_SECRET`
  - `ETSY_REDIRECT_URI`
- **Kaynağı:** `developer.etsy.com` üzerinde app oluşturup credentials almak gerek
- **Etki:** `isEtsyConfigured()` her zaman `false` döner → submit her zaman `503 EtsyNotConfigured`

### Etsy taxonomy mapping
- **Mevcut durum:** [`buildEtsyDraftPayload`](../../../src/features/listings/server/submit.service.ts) `taxonomyId: null` döner; provider gerçek çağrıda `EtsyValidationError 422` "taxonomy_id required" fırlatır (honest signal)
- **Eksik:**
  - Etsy V3 `/seller-taxonomy/nodes` API client
  - ProductType → taxonomyId mapping table
  - Listing'de productType binding (mevcut Listing.productTypeId schema'da var ama Phase 9 V1 view'da expose edilmedi — K6 lock)
- **Etki:** Tam credential + connection olsa bile submit her zaman 422

### Image upload
- **Mevcut durum:** Provider [`uploadListingImage`](../../../src/providers/etsy/client.ts) tanımlı (multipart, buffer-only) ama submit pipeline'da çağrılmıyor
- **Eksik:**
  - Storage'tan render buffer fetch helper (S3/MinIO `getObject`)
  - Submit pipeline'a image upload step eklemesi (cover + her render rank 1-10)
  - Hata recovery (image upload kısmen fail → listing var ama image yok)
- **Etki:** Tam credential olsa bile listing image'sız oluşur

### Token refresh
- **Mevcut durum:** [`refreshAccessToken`](../../../src/providers/etsy/oauth.ts) tanımlı, kullanıcı yok
- **Eksik:**
  - Submit pipeline öncesi token expiry pre-check + auto-refresh
  - Refresh job/worker (Phase 9.1+ BullMQ)
  - Connection update transaction (yeni token encrypt + persist)
- **Etki:** Token expired olduğunda kullanıcı 401 honest fail görür, manuel re-connect gerek

---

## Honest limitations (V1 kapsam dışı, V1.1+'a ertelenen)

### Auto-save YOK
- MetadataSection ve PricingSection değişiklikler kullanıcı "Kaydet" tıklayana kadar kaydedilmez
- AI generation sonrası form alanları doldurulur ama otomatik PATCH YAPILMAZ — kullanıcı görür, ister edit eder, ister "Kaydet" ile kaydeder
- Sebep: trust gate (AI çıktısı garantili Etsy-policy uyumlu değil) + iterative editing UX

### OAuth callback route + Settings Etsy UI YOK
- Foundation `oauth.ts` yazılı; ama callback handler ve settings panel bu turun kapsamında değildi
- Kullanıcı Etsy bağlanmak için manuel `developer.etsy.com` üzerinden token üretip DB'ye `psql` ile yazmak zorunda kalır (V1 dışı UX)
- Carry-forward: Phase 9.1 settings UI slice

### Taxonomy mapping YOK
- Provider hardcoded `EtsyValidationError "taxonomy_id required (V1 foundation: caller henüz resolve etmiyor)"` fırlatır
- Phase 9.1+ ProductType → Etsy V3 taxonomy node mapping (Etsy V3 `/seller-taxonomy/nodes` API)

### Image upload pipeline YOK
- Provider `uploadListingImage` tanımlı (buffer-only, URL kind explicit reject)
- Submit pipeline'da çağrılmıyor — listing image'sız oluşur
- Carry-forward: Phase 9.1+ storage buffer fetch + multipart upload step

### Token refresh worker YOK
- `refreshAccessToken` consumer yok
- Expired token → kullanıcı 401 görür, manuel reconnect (Phase 9.1+ refresh worker)

### Cost tracking integration YOK
- KIE çağrıları başına 1 cent estimate üretiyor ama `CostUsage` tablosuna log akmıyor
- Phase 6 review-design.worker.ts emsali Phase 9.1+'a carry-forward

### Negative library hard-block YOK (V1 K3 lock)
- Negative match → readiness mesajına yansır (soft warn), submit'i bloklamaz
- Phase 9.1+: severity "error" check'leri = hard gate

### Folder unification YOK (`ui/` ↔ `components/`)
- ListingDraftView `ui/`, AssetSection/MetadataSection/PricingSection `components/`
- V1.1+ ADR ile rasyonalize edilecek (mevcut yapı çalışıyor, refactor risk taşır)

### Per-render PNG/JPG download endpoint YOK
- Sadece bulk ZIP (Phase 9 V1 endpoint hazır — `GET /api/listings/draft/[id]/assets/download`, Phase 8 `buildMockupZip` reuse; per-render PNG/JPG endpoint V1.1+)

### Manual QA henüz koşulmadı
- Phase 9 manual QA checklist: [`./phase9-manual-qa.md`](./phase9-manual-qa.md) (henüz koşulmadı)
- Phase 8 manual QA da hâlâ pending (kullanıcı sorumluluğu)
- "Manual QA yapıldı" iddia edilmedi; "PASS" / "tamamlandı" ilan edilmedi

---

## Test pyramid (Phase 9 V1 mevcut state)

| Layer | Phase 9 katkı | Toplam | Komut |
|---|---|---|---|
| Default suite (unit + integration) | +166 test (önceki Phase 8 baseline'dan) | 1570 / 167 file | `npm test` |
| UI suite (jsdom) | +63 test | 921 / 81 file | `npm run test:ui` |
| E2E suite | Phase 9 için yeni E2E senaryosu YOK (foundation; submit live success external dep) | (Phase 8 baseline) | `npm run test:e2e` |

**Phase 9 test envanter (24 dosya):**

Integration:
- [`tests/integration/listings/handoff.test.ts`](../../../tests/integration/listings/handoff.test.ts)
- [`tests/integration/listings/state.test.ts`](../../../tests/integration/listings/state.test.ts)
- [`tests/integration/listings/readiness.test.ts`](../../../tests/integration/listings/readiness.test.ts)
- [`tests/integration/listings/negative-library.test.ts`](../../../tests/integration/listings/negative-library.test.ts)
- [`tests/integration/listings/etsy-connection.test.ts`](../../../tests/integration/listings/etsy-connection.test.ts)
- [`tests/integration/listings/generate-meta.test.ts`](../../../tests/integration/listings/generate-meta.test.ts)
- [`tests/integration/listings/submit.test.ts`](../../../tests/integration/listings/submit.test.ts)
- [`tests/integration/listings/api/{create-draft,get-draft,list,update-draft,generate-meta,submit}.test.ts`](../../../tests/integration/listings/api/)

Unit (default node):
- [`tests/unit/etsy/{error-classifier,oauth,registry}.test.ts`](../../../tests/unit/etsy/)
- [`tests/unit/listings/url-state.test.ts`](../../../tests/unit/listings/url-state.test.ts)
- [`tests/unit/listing-meta-{provider-registry,output-schema,prompt}.test.ts`](../../../tests/unit/)

Unit (UI / jsdom):
- [`tests/unit/listings/components/{AssetSection,ListingsIndexView,MetadataSection,PricingSection}.test.tsx`](../../../tests/unit/listings/components/)
- [`tests/unit/listings/hooks/{useGenerateListingMeta,useSubmitListingDraft}.test.tsx`](../../../tests/unit/listings/hooks/)
- [`tests/unit/listings/ui/ListingDraftView.test.tsx`](../../../tests/unit/listings/ui/ListingDraftView.test.tsx)

## Otomasyon kalite gate'leri (PASS — manual QA harici)

| Gate | Sonuç | Komut |
|---|---|---|
| TypeScript strict | 0 hata | `npx tsc --noEmit` |
| Token check (Tailwind disipline) | İhlal yok | `npm run check:tokens` |
| Default suite | 1570/1570 pass | `npm test` |
| UI suite | 921/921 pass | `npm run test:ui` |

---

## Süreç dersleri (Phase 9 boyunca uygulananlar)

### 1. Hook + service kontrat dokunulmazlık
Phase 8 dersi (Task 24+25 revert) Phase 9'da carry-forward edildi:
- Her closeout sonrası `git diff src/features/listings/types.ts schemas.ts server/*.service.ts` boş olmalı
- AI provider abstraction (`src/providers/listing-meta-ai/`) yazıldıktan sonra dokunulmadı (3 commit boyunca scope korundu)
- Mevcut hook'lar (`useListingDraft`, `useUpdateListingDraft`, `useCreateListingDraft`, `useListings`, `useGenerateListingMeta`) submit slice'ında dokunulmadı

### 2. Selective revert (Phase 9'da kullanılmadı — 0 revert)
Phase 9 boyunca implementer çıktıları kontrat ihlali yapmadı; revert gerekmedi.
Phase 8'in 3 selective revert dersi (Task 24+25, Task 28+29, Task 33) Phase 9'a aktarıldı:
implementer dispatch context'inde DOKUNULMAZ alanlar her seferinde verbatim
listelendi.

### 3. Bağımsız tsc + suite + diff doğrulama
Her implementer raporundan sonra:
- `npx tsc --noEmit | grep -c "error TS"` (gerçek 0)
- `npm test` + `npm run test:ui` ayrı sayım
- `git diff --stat <DOKUNULMAZ alanlar>` boş olmalı
- `git status --short` ile yeni vs modified dosya doğrulaması

### 4. Honest fail disipline
Phase 9 boyunca **fake success / mock-as-real** denemesi olmadı. Üç kritik nokta:
- AI generation: KIE key yoksa NOT_CONFIGURED 400 (hardcoded sample copy YOK)
- Submit: Etsy not configured → 503; not connected → 400 (mock submit YOK)
- Submit UI: success banner sadece backend gerçek 200 döndüğünde gösteriliyor

### 5. Test stability (Phase 9'a özel ders)
İlk-run flakiness kök sebebi: test email kollizyonu + eksik FK cleanup chain.
Çözüm: 4 listings api/*.test.ts dosyasında `uniqueEmail()` pattern + `handoff.test.ts` emsali
FK-safe cleanup chain (commit `9aa581c`). Sonraki tüm Phase 9 integration test'leri (generate-meta,
submit, etsy-connection) bu pattern'ı sıfırdan uyguladı.

---

## Phase 9 V1 yüzey doluluk haritası

| Akış | Foundation | Service | Endpoint | UI | Tests | Live |
|---|---|---|---|---|---|---|
| Listing draft create (handoff) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Listing draft GET/PATCH | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Listings index | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Readiness compute | ✅ | ✅ | (inline) | ✅ | ✅ | ✅ |
| Negative library | ✅ | ✅ | (inline) | (inline) | ✅ | ✅ |
| AI metadata generate | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ KIE key gerek |
| Etsy provider abstraction | ✅ | n/a | n/a | n/a | ✅ | ❌ credentials |
| Etsy connection resolve | ✅ | ✅ | n/a | ❌ | ✅ | ❌ OAuth flow |
| Listing submit (UI binding) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ taxonomy + image upload |
| OAuth full flow | ⚠️ scaffold | n/a | ❌ | ❌ | partial | ❌ |
| ZIP download (Phase 9 listing scope) | ✅ | ✅ (reuse Phase 8) | ✅ | ✅ | ✅ | ✅ |

---

## Next-step options

Phase 9 lokal yüzey doygun. Sıradaki seçenekler:

### (A) OAuth callback + Settings Etsy panel UI
- **Ne:** `/api/etsy/oauth/callback/route.ts` + state CSRF cookie helper + Settings → Etsy bağlantı paneli UI
- **Bağımlılık:** ETSY_CLIENT_ID/SECRET env (mock secret ile foundation test edilebilir)
- **Etki:** Kullanıcı browser'dan Etsy bağlantı kurabilecek; live submit yolu açılır

### (B) Etsy taxonomy mapping foundation
- **Ne:** Etsy V3 `/seller-taxonomy/nodes` API client + ProductType → taxonomyId binding
- **Bağımlılık:** Live test için credentials gerek
- **Etki:** Submit "taxonomy_id required" hatasını aşar

### (C) Image upload pipeline
- **Ne:** Storage buffer fetch + multipart Etsy upload + submit pipeline'a step ekleme
- **Bağımlılık:** Live test için credentials gerek
- **Etki:** Listing image'lı oluşur

### (D) Manual QA tetikle
- **Ne:** [`./phase9-manual-qa.md`](./phase9-manual-qa.md) checklist'ini browser'da koşmak
- **Bağımlılık:** Postgres + MinIO + Redis + Next dev server + (opsiyonel) KIE key + (opsiyonel) Etsy credentials
- **Etki:** Lokal yüzey gerçek kullanıcı flow'larında doğrulanır; bulgu varsa carry-forward
- **Not:** Etsy credentials yoksa B-G blokları (submit live) "honest-fail path" olarak doğrulanır

### (E) Phase 9 V1 closeout (PASS ilanı)
- **Ne:** Manual QA + Phase 8 manual QA tamamlandıktan sonra closeout doc'unu finalize et
- **Bağımlılık:** D (Phase 9 manual QA) + Phase 8 manual QA tamamlanması
- **Etki:** Phase 9 V1 "🟢 PASS" ilan edilir; Phase 9.1 (Etsy live success enabler'ları) açılabilir

---

## Status: 🟡 Phase 9 V1 lokal yüzey doygun, manual QA + external dep bekliyor

**Tamamlanan:**
- 18+ commit, 0 revert, lokal yüzeyde tüm Phase 9 task'lar (1-19, 22) implement edildi
- Tüm otomasyon kalite gate'leri PASS (TS strict 0, token check pass, 1570 + 921 test yeşil)
- Hook + service + UI + provider abstraction + endpoint sözleşmeleri stable
- Phase 8 + Phase 6 review + settings yüzeyleri dokunulmadı

**Pending (insan-paralel):**
- Phase 9 manual QA browser-based smoke — [`./phase9-manual-qa.md`](./phase9-manual-qa.md)
- Phase 8 manual QA hâlâ pending — [`./phase8-manual-qa.md`](./phase8-manual-qa.md) (Phase 9 closeout'tan önce kapanması gerek)
- Etsy live success external dep (credentials + OAuth callback + taxonomy + image upload)

**"PASS" / "tamamlandı" ilan edilmedi.** Bu doc **pre-closeout preparation**;
manual QA gerçek koşum sonucu bu doc'un altına `## Bulgular — YYYY-MM-DD`
başlığı eklenecek; Phase 9 V1 status `🟢 PASS` veya `🔴 BLOCK` olarak güncellenecek.
