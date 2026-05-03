# Phase 9 — Listing Builder Status (Pre-Closeout)

> **Tarih:** 2026-05-03 (sync 2026-05-04, repo-wide audit sonrası)
> **Status:** 🟡 **Pre-closeout** — Phase 9 V1 implementation/local foundation neredeyse tamam; live Etsy success **yalnız external credentials + manual QA** bekliyor (kod tarafında ek lokal blocker kalmadı); "PASS" / "tamamlandı" ilan edilmedi
> **HEAD:** `92b0072`
> **Spec:** [`../../plans/2026-05-02-phase9-listing-builder-design.md`](../../plans/2026-05-02-phase9-listing-builder-design.md)
> **Plan:** [`../../plans/2026-05-02-phase9-listing-builder-plan.md`](../../plans/2026-05-02-phase9-listing-builder-plan.md)
> **Manual QA:** [`./phase9-manual-qa.md`](./phase9-manual-qa.md) (henüz koşulmadı)
> **Phase 8 emsali:** [`./phase8-closeout.md`](./phase8-closeout.md) (Phase 8 V1 hâlâ `🟡 manual QA pending`)

## Özet

Phase 9 V1 Listing Builder lokal yüzeyi **uçtan uca yazıldı + final-product
seviyesinde polished**: listing CRUD + readiness + negative library + AI
metadata generate (KIE Gemini 2.5 Flash, foundation + live-if-configured) +
Etsy V3 provider + OAuth flow + Settings paneli + taxonomy mapping +
image upload pipeline + token refresh resilience (submit-time opportunistic) +
submit UX paketi (SubmitResultPanel + image diagnostics + Etsy admin
deep-links + FAILED → DRAFT recovery) + Etsy readiness diagnostics summary
(Settings panelinde 3-state checklist) + ZIP download. Submit pipeline
credentials + OAuth + `ETSY_TAXONOMY_MAP_JSON` üçü mevcutsa Etsy V3'e
canlı gider; eksikse her aşamada honest fail (typed AppError → HTTP map →
kullanıcı dostu Türkçe mesaj).

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
| Closeout-prep | phase9-status.md + phase9-manual-qa.md doc'ları | `af79e60` |
| ZIP download route | `GET /api/listings/draft/[id]/assets/download` — Phase 8 buildMockupZip reuse | `d128f15` (+ doc sync `f6a383a`) |
| OAuth full flow + Settings panel | `/api/etsy/oauth/start` + `/api/etsy/oauth/callback` + Settings Etsy connection panel + PKCE + cookie | `c875cf3` |
| Taxonomy + image upload + submit entegrasyonu | env-based taxonomy resolver + image-upload.service + submit pipeline tam yazıldı | `e5059cc` |
| Closeout-prep doc sync | phase9-status + manual-qa doc'larında ZIP/OAuth/taxonomy/image-upload yansıması | `7cb3f51` |
| Token refresh resilience | `resolveEtsyConnectionWithRefresh` (submit-time opportunistic) + 5dk grace + EtsyTokenRefreshFailedError 401 | `56a0b19` |
| Submit UX büyük paketi | SubmitResultPanel + ImageUploadDiagnostics + Etsy deep-links + FAILED → DRAFT recovery + listings index "Etsy'de Aç" | `ddb3acf` |
| V1 Finalization — readiness diagnostics | `GET /api/settings/etsy-connection/readiness` + EtsyReadinessSummary 3-state checklist + Settings panel polish (4-env tam liste + auto-refresh ipucu) | `92b0072` |
| Repo-wide final audit + doc finalize | İki audit pass (general-purpose + Explore deep stale) — fake fix-now bulgusu yok; phase9 doc HEAD/tarih sync; bilinçli V1.1+ carry-forward'lar (per-render download, Phase 6 canlı smoke gating, admin endpoint test gap) doğrulandı | (bu commit) |

**Toplam:** 28+ commit, 0 revert.

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

### 7. Submit pipeline (taxonomy + draft create + image upload — gerçek)
- **Endpoint:** `POST /api/listings/draft/[id]/submit`
- **Service:** [`submit.service.ts`](../../../src/features/listings/server/submit.service.ts) `submitListingDraft(listingId, userId)` — tam pipeline:
  1. Ownership 404 (`productType` include eklendi)
  2. `assertSubmittable` (status DRAFT/NEEDS_REVIEW + zorunlu alanlar)
  3. Readiness snapshot (V1 soft warn — bloklamaz, K3 lock)
  4. `isEtsyConfigured` guard → 503 `EtsyNotConfigured`
  5. `resolveEtsyConnection` → 400 `ConnectionNotFound` / 401 `TokenExpired` / 400 `TokenMissing`
  6. `resolveProductTypeKey` → `resolveEtsyTaxonomyId` → 422 `EtsyTaxonomyMissing` (env'de mapping yoksa)
  7. `provider.createDraftListing` (gerçek Etsy V3 POST)
  8. `uploadListingImages` (storage'tan buffer + multipart Etsy upload, cover-first, sequential)
  9. State persist (PUBLISHED + etsyListingId; partial → PUBLISHED + failedReason mesajı; all-failed → FAILED + orphan etsyListingId)
- **Hook:** [`useSubmitListingDraft.ts`](../../../src/features/listings/hooks/useSubmitListingDraft.ts) (cache invalidation: `["listing-draft", id]` + `["listings"]`)
- **UI:** ListingDraftView footer "Taslak Gönder" button + readiness uyarı + PUBLISHED/FAILED status banner + taze submit success/error banner
- **Response shape:** `{ status, etsyListingId, failedReason, providerSnapshot, imageUpload?: { successCount, failedCount, partial } }` (imageUpload additive)
- **Davranış:** Backend honest fail (typed AppError → HTTP map) UI'a kullanıcı dostu Türkçe mesaj olarak gelir; **fake success YOK**; live success ancak credentials + OAuth connection + `ETSY_TAXONOMY_MAP_JSON` env eş zamanlı doluysa
- **Test:** [`tests/integration/listings/submit.test.ts`](../../../tests/integration/listings/submit.test.ts) + [`tests/integration/listings/api/submit.test.ts`](../../../tests/integration/listings/api/submit.test.ts) + hook/UI testleri (taxonomy mock + image upload mock dahil)

### 8. Listing assets ZIP download
- **Endpoint:** `GET /api/listings/draft/[id]/assets/download`
- **Service:** Phase 8 [`buildMockupZip`](../../../src/features/mockups/server/download.service.ts) reuse — yeni archiver/storage/manifest kodu YOK; tek import köprü
- **Bridge mantığı:** Listing fetch + ownership 404 + soft-delete guard + `mockupJobId` null guard (409 `LISTING_ASSETS_NOT_READY`); Phase 8 service typed error'ları (404 `JobNotFound`, 403 `JobNotDownloadable`) `errorResponse` üzerinden HTTP'ye pass-through
- **UI:** [`AssetSection.tsx`](../../../src/features/listings/components/AssetSection.tsx) "ZIP İndir" link gerçek route'a bağlı; tüm imageOrder render'ları yüklüyse görünür
- **Filename:** `listing-{etsyListingId || cuid}.zip` (Etsy submit sonrası daha okunabilir)
- **Test:** [`tests/integration/listings/api/assets-download.test.ts`](../../../tests/integration/listings/api/assets-download.test.ts) (8 senaryo: 400 invalid path, 404 listing yok / cross-user / soft-deleted, 409 mockupJobId null, 403 job non-terminal, 200 happy + ZIP magic bytes, 200 etsyListingId filename)

### 9. Etsy OAuth flow (start + callback) + Settings panel
- **Start route:** `GET /api/etsy/oauth/start` — auth + state/PKCE üret + cookie set + Etsy auth URL'e 302 redirect; env yoksa 503 honest fail
- **Callback route:** `GET /api/etsy/oauth/callback` — error/missing/state-mismatch/exchange-fail tüm path'ler `/settings?etsy=...` query ile dürüst raporlar; happy path `/settings?etsy=connected`
- **Connection service:** [`connection.service.ts`](../../../src/providers/etsy/connection.service.ts) — `getEtsyConnectionStatus(userId)` 4-state non-throw + `persistEtsyConnection` (Etsy `/users/me` + `/shops` lookup → store auto-create + EtsyConnection upsert encrypted) + `deleteEtsyConnection`
- **Settings UI:** [`etsy-connection-settings-panel.tsx`](../../../src/features/settings/etsy-connection/components/etsy-connection-settings-panel.tsx) — 4 status (not_configured/not_connected/expired/connected) + URL query feedback banner + "Bağlantıyı kaldır" button + Etsy revoke uyarısı
- **PKCE + state cookie:** [`pkce.ts`](../../../src/providers/etsy/pkce.ts) (RFC 7636) + [`oauth-state-cookie.ts`](../../../src/providers/etsy/oauth-state-cookie.ts) (httpOnly + base64url + path scope `/api/etsy/oauth` + max-age 600s)
- **Davranış:** `ETSY_CLIENT_ID/SECRET/REDIRECT_URI` yoksa panel "not_configured" admin uyarısı + Bağlan CTA YOK; varsa kullanıcı tıklar → Etsy auth → callback → connected/expired
- **Test:** [`tests/integration/etsy/{oauth-start,oauth-callback,connection-service}.test.ts`](../../../tests/integration/etsy/) + [`tests/unit/etsy/{pkce,oauth-state-cookie}.test.ts`](../../../tests/unit/etsy/) + [`tests/unit/settings/etsy-connection-panel.test.tsx`](../../../tests/unit/settings/etsy-connection-panel.test.tsx) + [`tests/integration/settings/etsy-connection-api.test.ts`](../../../tests/integration/settings/etsy-connection-api.test.ts)

### 10. Etsy taxonomy mapping (env-based foundation)
- **Resolver:** [`taxonomy.ts`](../../../src/providers/etsy/taxonomy.ts) `resolveEtsyTaxonomyId(productTypeKey)` — env JSON `ETSY_TAXONOMY_MAP_JSON` lookup
- **Format:** `'{"wall_art":2078,"sticker":1208,...}'` — admin `developer.etsy.com /seller-taxonomy/nodes` endpoint'inden elle çıkarır + `.env.local`'e koyar
- **Submit pipeline kaynağı:** `listing.productType?.key` öncelik; yoksa `listing.category` fallback ("Wall Art" → "wall_art" lowercase + underscore normalize)
- **Hata sözlüğü:**
  - `EtsyTaxonomyMissingError` 422 (ProductType key mapping yok; `details.productTypeKey` payload)
  - `EtsyTaxonomyConfigError` 503 (bozuk JSON / array / non-numeric / zero / negative)
- **Cache + reset:** `resetTaxonomyCache()` test deterministic helper
- **`tryResolveEtsyTaxonomyId`:** non-throw lookup (UI/diagnostic)
- **Schema değişikliği YOK:** V1.1+ admin UI ile `ProductType.etsyTaxonomyId Int?` field eklenebilir (additive evolution)
- **Test:** [`tests/unit/etsy/taxonomy.test.ts`](../../../tests/unit/etsy/taxonomy.test.ts) (10 senaryo)

### 11. Image upload pipeline (storage → multipart Etsy)
- **Service:** [`image-upload.service.ts`](../../../src/features/listings/server/image-upload.service.ts) `uploadListingImages()`
- **Reuse:** `getStorage().download(outputKey)` (Phase 8 storage) + `etsyV3Provider.uploadListingImage` (mevcut provider, dokunulmadı)
- **Davranış:** `listing.imageOrderJson` packPosition ASC sıralı (defensive sort), cover (`packPosition=0`) rank=1, sequential upload (rate-limit safe), Etsy 10-image cap, default mimeType `image/png` (Phase 8 sharp renderer)
- **Partial fail:** `partial: true` + attempts array (rank, packPosition, renderId, isCover, ok+etsyImageId / ok=false+error)
- **All-failed:** `ListingImageUploadAllFailedError` 502 + `failedRanks[]` payload (caller listing FAILED + etsyListingId orphan persist)
- **Submit entegrasyonu:** Submit pipeline draft create sonrası bu service'i çağırır; partial → PUBLISHED + failedReason mesajı, all-failed → FAILED + orphan etsyListingId
- **Test:** [`tests/integration/listings/image-upload.test.ts`](../../../tests/integration/listings/image-upload.test.ts) (8 senaryo: happy, boş order skip, partial, all-failed, storage fail, 10-cap)

### 12. Etsy token refresh (submit-time opportunistic)
- **Service:** [`connection.service.ts`](../../../src/providers/etsy/connection.service.ts) `resolveEtsyConnectionWithRefresh(userId)` — submit pipeline tüketicisi
- **Davranış:** 5 dk grace window içinde proactive refresh; success → DB token update encrypted (yeni access + refresh + tokenExpires; scopes/shopId/shopName korunur); fail → `EtsyTokenRefreshFailedError` 401 (kullanıcı Settings → "Yeniden bağlan")
- **Read-only `resolveEtsyConnection` DOKUNULMADI** — submit pipeline'a yeni helper enjekte edildi
- **V1.1+:** Background pre-emptive refresh (BullMQ worker)
- **Test:** [`tests/integration/etsy/token-refresh.test.ts`](../../../tests/integration/etsy/token-refresh.test.ts)

### 13. Submit Result Panel + diagnostics + recovery
- **UI:** [`SubmitResultPanel.tsx`](../../../src/features/listings/components/SubmitResultPanel.tsx) — DRAFT/PUBLISHED/FAILED 3-state + taze submit success/error + provider snapshot footer
- **ImageUploadDiagnostics:** Submit response'taki `imageUpload.attempts` array'inden per-rank breakdown — expand/collapse "Detayı göster" toggle
- **Etsy deep-links:** "Etsy'de Aç" admin URL `https://www.etsy.com/your/shops/me/tools/listings/{etsyListingId}` + "Mağazaya Git" `https://www.etsy.com/shop/{shopName}` (etsyShop populated ise)
- **FAILED → DRAFT recovery:** `POST /api/listings/draft/[id]/reset-to-draft` + `useResetListingToDraft` hook + orphan listing rehberi UI'da
- **Listings index card "Etsy'de Aç" link:** PUBLISHED listing card'ında admin URL'e direct link (event.stopPropagation ile card click korunmuş)
- **Test:** `SubmitResultPanel.test.tsx` + `useResetListingToDraft.test.tsx` + `reset-to-draft.test.ts`

### 14. Etsy readiness diagnostics summary
- **Endpoint:** `GET /api/settings/etsy-connection/readiness` — OAuth env / Taxonomy env / Connection state 3-boyut + `liveReady` boolean. Live Etsy çağrısı YOK; sadece env + DB okuma (token expiry DB `tokenExpires` ile karşılaştırılır)
- **Component:** [`etsy-readiness-summary.tsx`](../../../src/features/settings/etsy-connection/components/etsy-readiness-summary.tsx) — Settings panelinde Etsy connection paneli'nin ÜSTÜNDE 3-state checklist + 30s polling (env hot-reload; admin .env'e taxonomy ekledikten sonra UI 30s içinde güncellenir, full restart gerekmesin)
- **Settings panel polish:** `not_configured` durumunda 4-env tam liste (TAXONOMY_MAP_JSON dahil); `connected` durumunda submit pipeline auto-refresh ipucu
- **Honest fail disipline:** Endpoint sadece env + DB okur; Etsy /users/me ya da refresh denemesi yapılmaz
- **Test:** [`tests/integration/settings/etsy-readiness-api.test.ts`](../../../tests/integration/settings/etsy-readiness-api.test.ts) (8 senaryo) + [`tests/unit/settings/etsy-readiness-summary.test.tsx`](../../../tests/unit/settings/etsy-readiness-summary.test.tsx) (8 senaryo) + [`tests/unit/settings/etsy-connection-panel.test.tsx`](../../../tests/unit/settings/etsy-connection-panel.test.tsx) (4-env + auto-refresh ipucu assertion'ları güncellendi)

---

## External dependency bekleyen alanlar

Phase 9 V1 implementation/local foundation neredeyse tamam. Live Etsy
success için kalan **lokal kod blocker'ı yok** — yalnız aşağıdaki
external/operasyonel dependency'ler var:

### Etsy app credentials (`developer.etsy.com`)
- **Eksik env değişkenleri** (`.env.local`'de yok, sadece `.env.example`'de yorum):
  - `ETSY_CLIENT_ID`
  - `ETSY_CLIENT_SECRET`
  - `ETSY_REDIRECT_URI` (verified on Etsy app config)
- **Kaynağı:** `developer.etsy.com` üzerinde app oluşturup credentials almak; redirect URI verify etmek
- **Etki:** Tüm Etsy yolu (OAuth start/callback, submit, image upload) 503 `EtsyNotConfigured` honest fail'a düşer
- **Operasyonel sorumluluk:** Sistem yöneticisi / kullanıcı

### `ETSY_TAXONOMY_MAP_JSON` env
- **Format:** `'{"wall_art":2078,"sticker":1208,"clipart":1207,...}'`
- **Kaynağı:** Admin `developer.etsy.com` `/seller-taxonomy/nodes` endpoint'ine canlı bağlanıp taxonomy node ID'lerini çıkarır + ProductType key'leriyle eşleştirir + `.env.local`'e yazar
- **Etki:** Credentials + connection olsa bile bu env yoksa submit 422 `EtsyTaxonomyMissing` honest fail (kullanıcıya `details.productTypeKey` ile rehber)
- **Operasyonel sorumluluk:** Admin (deploy zamanı çözüm); V1.1+ admin UI ile DB-backed `ProductType.etsyTaxonomyId Int?` field
- **Lokal foundation:** ✅ Resolver yazıldı, env'i okur, eksikse 422 fırlatır

### Etsy OAuth flow live test
- **Eksik:** Verified redirect URI Etsy app config'inde + kullanıcı browser'da bağlantı kuracak
- **Etki:** Code path tam yazılı (start + callback + cookie + state CSRF + token exchange + persist + Etsy /users/me + /shops lookup), live smoke ancak credentials + verified redirect URI olduğunda mümkün
- **Lokal foundation:** ✅ OAuth full flow + Settings panel + connection upsert + 4-state status

### Token refresh worker (V1.1+ carry-forward — V1'de submit-time opportunistic eklendi)
- **V1 mevcut durum:** Submit pipeline `resolveEtsyConnectionWithRefresh` ile opportunistic refresh yapar (5 dk grace). Refresh fail → 401 `EtsyTokenRefreshFailedError` → kullanıcı Settings'ten yeniden bağlanır.
- **V1.1+:** Background pre-emptive refresh (BullMQ worker) — submit'e gerek olmadan saat başı tüm yakın-expire connection'ları refresh eder
- **Etki:** V1'de UX dürüst + token expiry'si kullanıcıya görünmüyor (auto-refresh)

---

## Honest limitations (V1 kapsam dışı, V1.1+'a ertelenen)

### Auto-save YOK
- MetadataSection ve PricingSection değişiklikler kullanıcı "Kaydet" tıklayana kadar kaydedilmez
- AI generation sonrası form alanları doldurulur ama otomatik PATCH YAPILMAZ — kullanıcı görür, ister edit eder, ister "Kaydet" ile kaydeder
- Sebep: trust gate (AI çıktısı garantili Etsy-policy uyumlu değil) + iterative editing UX

### Active publish (Etsy `state: "active"`) YOK
- V1 sözleşmesi: bizim oluşturduğumuz Etsy listing `state: "draft"` (provider hardcoded). Yayına alma Etsy admin panelinden manuel
- UI status banner: "Etsy admin panelinden manuel publish yapılabilir"
- V2 carry-forward (admin gözetimi gerek)

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

### Image upload paralelleştirme + retry policy YOK
- V1 foundation: sequential upload (rate-limit + cover öncelik garantisi)
- V1.1+: paralel upload + Etsy 5xx/network retry policy + worker queue ile background upload + progress reporting

### Manual QA henüz koşulmadı
- Phase 9 manual QA checklist: [`./phase9-manual-qa.md`](./phase9-manual-qa.md) (henüz koşulmadı)
- Phase 8 manual QA da hâlâ pending (kullanıcı sorumluluğu)
- "Manual QA yapıldı" iddia edilmedi; "PASS" / "tamamlandı" ilan edilmedi

---

## Test pyramid (Phase 9 V1 mevcut state)

| Layer | Phase 9 katkı | Toplam | Komut |
|---|---|---|---|
| Default suite (unit + integration) | +275 test (önceki Phase 8 baseline'dan) | 1671 / 178 file | `npm test` |
| UI suite (jsdom) | +101 test | 946 / 85 file | `npm run test:ui` |
| E2E suite | Phase 9 için yeni E2E senaryosu YOK (foundation; submit live success external dep) | (Phase 8 baseline) | `npm run test:e2e` |

**Phase 9 test envanter (34 dosya):**

Integration — listings:
- [`tests/integration/listings/handoff.test.ts`](../../../tests/integration/listings/handoff.test.ts)
- [`tests/integration/listings/state.test.ts`](../../../tests/integration/listings/state.test.ts)
- [`tests/integration/listings/readiness.test.ts`](../../../tests/integration/listings/readiness.test.ts)
- [`tests/integration/listings/negative-library.test.ts`](../../../tests/integration/listings/negative-library.test.ts)
- [`tests/integration/listings/etsy-connection.test.ts`](../../../tests/integration/listings/etsy-connection.test.ts)
- [`tests/integration/listings/generate-meta.test.ts`](../../../tests/integration/listings/generate-meta.test.ts)
- [`tests/integration/listings/submit.test.ts`](../../../tests/integration/listings/submit.test.ts)
- [`tests/integration/listings/image-upload.test.ts`](../../../tests/integration/listings/image-upload.test.ts)
- [`tests/integration/listings/api/{create-draft,get-draft,list,update-draft,generate-meta,submit,assets-download}.test.ts`](../../../tests/integration/listings/api/)

Integration — etsy + settings:
- [`tests/integration/etsy/{oauth-start,oauth-callback,connection-service,token-refresh}.test.ts`](../../../tests/integration/etsy/)
- [`tests/integration/settings/etsy-connection-api.test.ts`](../../../tests/integration/settings/etsy-connection-api.test.ts)
- [`tests/integration/settings/etsy-readiness-api.test.ts`](../../../tests/integration/settings/etsy-readiness-api.test.ts)
- [`tests/integration/listings/api/reset-to-draft.test.ts`](../../../tests/integration/listings/api/reset-to-draft.test.ts)

Unit (default node):
- [`tests/unit/etsy/{error-classifier,oauth,registry,pkce,oauth-state-cookie,taxonomy}.test.ts`](../../../tests/unit/etsy/)
- [`tests/unit/listings/url-state.test.ts`](../../../tests/unit/listings/url-state.test.ts)
- [`tests/unit/listing-meta-{provider-registry,output-schema,prompt}.test.ts`](../../../tests/unit/)

Unit (UI / jsdom):
- [`tests/unit/listings/components/{AssetSection,ListingsIndexView,MetadataSection,PricingSection,SubmitResultPanel}.test.tsx`](../../../tests/unit/listings/components/)
- [`tests/unit/listings/hooks/{useGenerateListingMeta,useSubmitListingDraft,useResetListingToDraft}.test.tsx`](../../../tests/unit/listings/hooks/)
- [`tests/unit/listings/ui/ListingDraftView.test.tsx`](../../../tests/unit/listings/ui/ListingDraftView.test.tsx)
- [`tests/unit/settings/etsy-connection-panel.test.tsx`](../../../tests/unit/settings/etsy-connection-panel.test.tsx)
- [`tests/unit/settings/etsy-readiness-summary.test.tsx`](../../../tests/unit/settings/etsy-readiness-summary.test.tsx)

## Otomasyon kalite gate'leri (PASS — manual QA harici)

| Gate | Sonuç | Komut |
|---|---|---|
| TypeScript strict | 0 hata | `npx tsc --noEmit` |
| Token check (Tailwind disipline) | İhlal yok | `npm run check:tokens` |
| Default suite | 1671/1671 pass | `npm test` |
| UI suite | 946/946 pass | `npm run test:ui` |

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
| AI metadata generate (KIE Gemini 2.5 Flash) | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ KIE key gerek |
| Etsy provider abstraction | ✅ | n/a | n/a | n/a | ✅ | ⚠️ credentials gerek |
| Etsy connection resolve | ✅ | ✅ | n/a | n/a | ✅ | ⚠️ credentials + OAuth |
| Etsy OAuth flow (start + callback) + Settings panel | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ credentials gerek |
| Etsy taxonomy mapping (env-based) | ✅ | ✅ (env) | n/a | n/a | ✅ | ⚠️ env JSON gerek |
| Image upload pipeline (storage → multipart) | ✅ | ✅ | n/a | n/a | ✅ | ⚠️ credentials gerek |
| Listing submit (UI + taxonomy + draft + image upload) | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ credentials + env + OAuth |
| Etsy token refresh (submit-time opportunistic) | ✅ | ✅ | n/a | n/a | ✅ | ⚠️ credentials + OAuth |
| Submit pipeline + Result Panel + diagnostics | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ credentials + env + OAuth |
| FAILED → DRAFT recovery | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Etsy readiness diagnostics summary | ✅ | n/a | ✅ | ✅ | ✅ | ✅ |
| ZIP download (Phase 9 listing scope) | ✅ | ✅ (reuse Phase 8) | ✅ | ✅ | ✅ | ✅ |

**Live sütunu:** ✅ = lokal env'de tam çalışır; ⚠️ = lokal kod hazır, sadece external credential/env eksik. **Phase 9 V1'de `❌ kod blocker'ı` yüzeyi kalmadı.**

---

## Next-step options

Phase 9 V1 implementation/local foundation neredeyse tamam — kod tarafında
ek lokal blocker yok. Sıradaki seçenekler **operasyonel + manual QA**
ağırlıklı:

### (A) Manual QA tetikle (pre-closeout zorunluluğu)
- **Ne:** [`./phase9-manual-qa.md`](./phase9-manual-qa.md) checklist'ini browser'da koşmak
- **Bağımlılık:** Postgres + MinIO + Redis + Next dev server + (opsiyonel) KIE key + (opsiyonel) Etsy credentials + (opsiyonel) `ETSY_TAXONOMY_MAP_JSON`
- **Etki:** Lokal yüzey gerçek kullanıcı flow'larında doğrulanır; bulgu varsa carry-forward
- **Not:** Tüm external dep yoksa "honest-fail path" doğrulanır; varsa live success path doğrulanır — checklist iki yolu da ayrı ayrı tarif eder

### (B) Phase 8 manual QA tetikle (Phase 9 closeout için önkoşul)
- **Ne:** Phase 8 V1 [`./phase8-manual-qa.md`](./phase8-manual-qa.md) checklist'i
- **Bağımlılık:** Phase 8 V1 closeout sözleşmesi
- **Etki:** Phase 9 V1 final closeout (PASS ilanı) için önkoşul

### (C) Token refresh worker (V1.1 carry-forward)
- **Ne:** Submit pipeline öncesi expiry pre-check + auto-refresh + BullMQ background worker
- **Bağımlılık:** Manuel reconnect UX'inden memnun değilsek
- **Etki:** Expired token kullanıcıya görünmeden refresh edilir

### (D) Phase 9 V1 closeout (PASS ilanı)
- **Ne:** A + B tamamlandıktan sonra closeout doc'unu finalize et
- **Bağımlılık:** Phase 9 manual QA + Phase 8 manual QA tamamlanması
- **Etki:** Phase 9 V1 "🟢 PASS" ilan edilir; Phase 9.1 (token refresh worker, admin taxonomy UI, V2 active publish) açılabilir

---

## Status: 🟡 Phase 9 V1 implementation/local foundation neredeyse tamam, manual QA + external credentials bekliyor

**Tamamlanan (lokal):**
- 19+ commit, 0 revert, Phase 9 V1 lokal yüzey uçtan uca yazıldı
- Tüm otomasyon kalite gate'leri PASS (TS strict 0, token check pass, 1638 + 929 test yeşil)
- Hook + service + UI + provider abstraction + endpoint sözleşmeleri stable
- Phase 8 + Phase 6 review + Settings UI panel'leri dokunulmadı
- Submit pipeline gerçek (taxonomy resolve → draft create → image upload pipeline → state persist)

**Pending (insan-paralel + operasyonel):**
- Phase 9 manual QA browser-based smoke — [`./phase9-manual-qa.md`](./phase9-manual-qa.md)
- Phase 8 manual QA hâlâ pending — [`./phase8-manual-qa.md`](./phase8-manual-qa.md) (Phase 9 closeout'tan önce kapanması gerek)
- Live Etsy success external operasyonel dep:
  - Etsy app credentials (`developer.etsy.com` üzerinden + verified redirect URI)
  - `ETSY_TAXONOMY_MAP_JSON` env (admin elle çıkarır)
  - OAuth flow live test (kullanıcı browser'da bağlantı kurar)

**"PASS" / "tamamlandı" ilan edilmedi.** Bu doc **pre-closeout preparation**;
manual QA gerçek koşum sonucu bu doc'un altına `## Bulgular — YYYY-MM-DD`
başlığı eklenecek; Phase 9 V1 status `🟢 PASS` veya `🔴 BLOCK` olarak güncellenecek.
