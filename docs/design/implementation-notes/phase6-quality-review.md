# Phase 6 — AI Quality Review Closeout

> **Tarih:** 2026-04-29
> **Status:** Backend pipeline + UI vitrin + UX kapanış + cost tracking + selectable
> review provider mimarisi tamam. **Aşama 2A (2026-04-29):** KIE provider AI mode
> için canlı çalışır durumda (kontrat KIE.ai docs'tan onaylı). Local mode
> (`scope: "local"`) **Aşama 2B bekliyor** — canlı smoke sırasında manuel data URL
> probe sonrası kapsam (küçük data URL patch / orta MinIO upload bridge)
> netleşecek. Phase 6 full ✅ Aşama 2B sonrası.

## Aşama 1: Mimari Düzeltme (2026-04-29)

Phase 6'nın ilk implementasyonu (Task 1–19) direct Google Gemini API
varsayımıyla kuruldu. Smoke öncesi tespit: ürün gerçekliği farklı — KIE.ai
üzerinden Gemini 2.5 Flash kullanılıyor (kullanıcının canlı Google
`geminiApiKey`'i yok). Mimari selectable provider modeline çevrildi.

**Yapılan değişiklikler:**

- **Settings shape genişletildi:** `reviewProvider: "kie" | "google-gemini"`
  default `"kie"`. **Migration YOK** — `aiMode` Json field; mevcut row'larda
  alan eksikse Zod parse default `"kie"` döndürür (backwards compat).
- **UI:** Settings → AI Mode'da "Review sağlayıcısı" select alanı
  ("KIE (önerilen)" / "Google Gemini (ileri seviye)") + helper "Bugün
  kullandığınız akış KIE ise bunu seçin." Kullanıcı diline net.
- **Provider rename:** `gemini-2-5-flash` ⇒ `google-gemini-flash`
  (`src/providers/review/google-gemini-flash.ts`). Doğrulama notu eklendi:
  mock-tested, canlı doğrulanmadı.
- **Yeni STUB:** `kie-gemini-flash` (`src/providers/review/kie-gemini-flash.ts`).
  `review()` çağrılırsa yön mesajıyla throw (Aşama 2 bekleniyor;
  `google-gemini` alternatifi).
- **Worker:** `PROVIDER_ID` hardcoded constant SİLİNDİ;
  `resolveReviewProviderConfig(userId)` runtime'da `{providerId, apiKey}` döner.
  Eksik key durumunda explicit throw (sessiz fallback YASAK).
- **DesignReview audit + CostUsage `providerKey`** runtime providerId yazar;
  log'larda `providerId` alanı debug için eklendi.

**Aşama 1 sonrası canlı durum:**

- Default user (`reviewProvider: "kie"`) ⇒ review job FAIL (KIE STUB throw)
- `"google-gemini"` seçeneği ⇒ mock-tested direct Google API (canlı
  doğrulanmadı; kullanıcı canlı Google key'i girerse çalışabilir)
- Review pipeline'ın TAMAMI (sticky, decision, persist, cost tracking, UI)
  mimari olarak doğru; sadece review inference adımı (KIE) Aşama 2'yi bekliyor

**Aşama 2 için bekleyen dış kontrat bilgileri (KIE.ai dashboard/docs'tan):**

1. KIE endpoint URL (review için)
2. Auth header formatı
3. Sync vs async pattern (createTask + polling pattern'ı kullanılacak mı)
4. Request body: image input format (inlineData base64 / URL / file upload)
5. Response body: envelope shape (`{code,msg,data}` mı, native passthrough mı)
6. Model id string KIE'de nasıl iletiliyor

**Aşama 1 test sonuçları (2026-04-29):**

| Komut | Sonuç |
|---|---|
| `npx tsc --noEmit` | ✅ 0 hata |
| `npx next lint` | ✅ `No ESLint warnings or errors` |
| `npm run check:tokens` | ✅ Token ihlali yok |
| `npx vitest run` (server) | ✅ 81 dosya / 606 test PASS |
| `npx vitest run --config vitest.config.ui.ts` | ✅ 41 dosya / 479 test PASS |

**Yeni testler:**

- `tests/unit/google-gemini-flash-provider.test.ts` (rename, 11 test)
- `tests/unit/kie-gemini-flash-provider.test.ts` (yeni STUB canary, 3 test)
- `tests/unit/review-provider-registry.test.ts` (güncel, 7 test — 2 provider,
  eski `gemini-2-5-flash` id reddedilir)
- `tests/integration/review-design-worker.test.ts` (+3 yeni Aşama 1 test:
  KIE stub throw, key-yok varyantları)
- `tests/integration/settings-ai-mode.test.ts` (+1 backwards compat test)

## Aşama 2A: KIE Provider Implementasyonu — AI Mode (2026-04-29)

KIE.ai docs'tan onaylı kontrat:

- Endpoint: `POST https://api.kie.ai/gemini-2.5-flash/v1/chat/completions`
- Auth: `Authorization: Bearer <kieApiKey>`
- Sync (non-streaming); OpenAI-compatible chat/completions; multimodal `image_url`
  (dış erişilebilir HTTP/HTTPS URL)
- `response_format` strict JSON schema → fail durumunda `json_object` fallback
  (heuristic: 400/422 + body'de `response_format|json_schema|strict` geçerse)
- Response: `choices[0].message.content` (JSON string), `usage.total_tokens`,
  `model: "gemini-2.5-flash"`

**Aşama 2A kapsamı:**

- KIE provider `kie-gemini-flash` gerçek implementasyon (STUB silindi)
- AI mode (`scope: "design"`, `image.kind: "remote-url"`) — signed URL üzerinden
  KIE'ye gider, **canlı çalışır**
- Local mode (`scope: "local"`, `image.kind: "local-path"`) — explicit throw
  `"KIE local review henüz etkin değil; Aşama 2B bekleniyor."` (kullanıcıya UI
  yön mesajı)
- `ReviewProvider` interface'e `modelId: string` field eklendi
- `audit.model = provider.modelId` + `CostUsage.model = provider.modelId`
  (Phase 6 reviewer Ö4 carry-forward kapanışı; geriye dönük backfill YOK —
  cosmetic, production'da CostUsage hâlâ boş olduğu için pratik etki yok)
- `output-schema.ts` extract — `ReviewOutputSchema` (Zod) +
  `REVIEW_OUTPUT_JSON_SCHEMA` (KIE strict mode için OpenAI-compatible JSON
  schema) iki provider tarafından paylaşılır

**Karar matrisi (5 onaylı + 2 uygulama notu):**

1. Aşama 2A + 2B bölünmesi ✅ (bu kapanış 2A)
2. Local mode 2A'da explicit throw "2B bekliyor" ✅
3. Data URL probe 2A smoke'undan SONRA ✅ (bu kapanışta probe YAPILMADI)
4. `modelId` field provider interface'e eklenir + `audit.model = provider.modelId`;
   backfill YOK ✅
5. `response_format` strict JSON schema dene; fail ⇒ `json_object` fallback ✅
6. (Uygulama Notu 1) Local mode throw mesajı tam olarak: `"KIE local review
   henüz etkin değil; Aşama 2B bekleniyor."` ✅
7. (Uygulama Notu 2) Smoke checklist'te 3 spesifik gözlem maddesi: strict vs
   fallback / `usage.total_tokens` / CostUsage row ✅

**Bekleyen Aşama 2B kararı:**

KIE'nin data URL (`data:image/png;base64,...`) image input desteği AI mode
smoke'undan SONRA manuel probe ile test edilecek:

- Kabul ederse → küçük patch (`image-loader.ts` local-path için data URL inline)
- Etmezse → orta patch (MinIO temp upload bridge — local asset'i kısa TTL'le
  upload + signed URL ile KIE'ye gönder)

**Aşama 2A test sonuçları (2026-04-29):**

| Komut | Sonuç |
|---|---|
| `npx tsc --noEmit` | ✅ 0 hata |
| `npx next lint` | ✅ `No ESLint warnings or errors` |
| `npm run check:tokens` | ✅ Token ihlali yok |
| `npx vitest run` (server) | ✅ 82 dosya / 621 test PASS |
| `npx vitest run --config vitest.config.ui.ts` | ✅ 42 dosya / 483 test PASS |

**Aşama 2A yeni / değişen testler:**

- `tests/unit/kie-gemini-flash-provider.test.ts` — STUB canary 3 test silindi,
  yerine 13 gerçek davranış testi (strict + fallback + local 2B + auth + http +
  json + zod + provider id/modelId/kind)
- `tests/unit/review-output-schema.test.ts` (yeni, 3 test) — DRY extract
  doğrulama: bilinmeyen risk flag, score>100, confidence>1 reddedilir
- `tests/unit/review-provider-registry.test.ts` — KIE STUB testi silindi;
  modelId field doğrulama + KIE local 2B throw + KIE auth-missing throw eklendi
  (8 test)
- `tests/unit/google-gemini-flash-provider.test.ts` — DRY refactor:
  `OutputSchema` import değişimi (test path aynı, `ReviewOutputSchema`'ya geçti);
  davranış aynı (11 test)
- `tests/unit/review-provider-types.test.ts` — minimal stub provider'a `modelId`
  field eklendi (5 test)
- `tests/integration/review-design-worker.test.ts` — KIE STUB throw testi
  silindi; yerine "KIE provider AI mode canlı + audit.model = modelId" testi
  (14 test); mevcut audit/CostUsage `model` beklentileri provider id'den modelId'e
  güncellendi (`google-gemini-flash` → `gemini-2-5-flash`)
- `tests/integration/review-local-asset-worker.test.ts` — Aşama 2A "local + KIE
  ⇒ '2B bekleniyor' throw, cost insert YOK" testi eklendi (8 test); CostUsage
  `model` provider id'den modelId'e güncellendi

## Phase 6 Özet

19 task, 3 ana dalga + 2 polish iterasyonu:

- **Task 1–11 (Backend pipeline):** Migration, types, registry, Gemini real impl,
  alpha-checks (Sharp), decision rule, sticky helper, ortak REVIEW_DESIGN
  worker (race-safe + idempotent audit), auto-enqueue (variation success),
  local batch endpoint, USER decisions API (POST override + PATCH reset+rerun)
- **Dalga A (Task 12+13+14):** Authz verification + `/review` shell + tab'lar +
  queue UI + a11y
- **Dalga B (Task 15+16+17):** Detay drawer + bulk actions (approve/reject/delete)
  + typing confirmation primitive
- **Dalga C (Task 18+19) — bu kapanış:** Conservative cost tracking + daily
  budget guardrail + closeout doc + README

**Test:**

- Phase 6 yeni: 200+ test
- Phase 5 regression: 30+
- Full suite (Dalga C sonrası): **80 dosya / 596 server test PASS** + **41 dosya / 479 UI test PASS** = **1075 PASS**

**Kalite gate (Dalga C bitiminde, 2026-04-29):**

| Komut | Sonuç |
|---|---|
| `npx tsc --noEmit` | ✅ 0 hata |
| `npx next lint` | ✅ `No ESLint warnings or errors` |
| `npm run check:tokens` | ✅ Token ihlali yok |
| `npx vitest run` (server) | ✅ 596/596 PASS |
| `npx vitest run --config vitest.config.ui.ts` | ✅ 479/479 PASS |

## Çalışan Capability'ler

- **AI mode auto-review:** Variation success → review job otomatik enqueue
  (best-effort; fail durumunda variation SUCCESS korunur)
- **Local batch review:** `POST /api/review/local-batch` ile 100 asset/sayfa,
  per-row enqueue
- **Hibrit pipeline mimarisi:** Sharp deterministic alpha kontrolleri (sadece
  transparent ürün tipleri: `clipart` / `sticker` / `transparent_png`) +
  provider-selectable LLM (KIE veya Google Gemini direct). Aşama 1: KIE STUB,
  google-gemini direct mock-tested.
- **8 sabit risk flag türü** (drift koruması, Zod enforce):
  `watermark_detected`, `signature_detected`, `visible_logo_detected`,
  `celebrity_face_detected`, `no_alpha_channel`, `transparent_edge_artifact`,
  `text_detected`, `gibberish_text_detected`
- **Decision rule (deterministic):** `risk_flags > 0` veya `score < 60` ⇒
  `NEEDS_REVIEW`; `score >= 90` + risk yok ⇒ `APPROVED`; aksi `NEEDS_REVIEW`
  (güvenli varsayılan, R8)
- **USER override sticky (R12):** "Approve anyway" sonrası SYSTEM yazımı
  race-safe `updateMany WHERE reviewStatusSource ≠ USER` ile engellenir;
  TOCTOU race penceresinde de korunur
- **`/review` queue UI:**
  - İki sekme (AI Tasarımları / Local Library)
  - Kart grid + status badge + USER/SYSTEM kaynak rozeti
  - Detay drawer (queue cache'inden okur, server 404 yok — carry-forward C6)
  - Bulk approve (skip-on-risk hint), bulk reject, bulk delete
  - Typing confirmation ("SİL" yaz) destructive bulk delete için
- **Conservative cost tracking (Task 18):** Her review çağrısı `CostUsage`
  tablosuna 1 cent estimate olarak yazılır; daily limit $10/gün/user
- **Snapshot zorunluluğu** (CLAUDE.md kuralı): provider snapshot
  (`<providerId>@YYYY-MM-DD`, runtime providerId) + prompt snapshot
  (`v1.0` + system prompt) her review yazımında persist; runtime config
  değişiklikleri eski review'ı bozmaz

## Phase 5'ten Kapatılan Carry-Forward

| Carry-forward | Phase 6'da nerede kapandı |
|---|---|
| `auto-quality-detection-ocr-bg` | Task 4 (Gemini multimodal) + Task 5 (Sharp alpha) + Task 8 (worker hybrid pipeline) |
| `destructive-typing-confirmation` | Task 17 (TypingConfirmation primitive + BulkDeleteDialog "SİL" zorunluluğu) |

## Phase 7+ Carry-Forward (Yeni)

### Phase 6 Brainstorm'dan

- `brand-similarity-detection` — fan art / IP / brand distance kontrolü
- `quality-review-thresholds` — threshold settings UI (60/90 hardcoded)
- `review-queue-default-tab-setting` — user prefs: default tab AI vs Local
- `review-prompt-admin-screen` — admin/master prompt yönetimi (Phase 10)
- `fix-with-ai-actions` — Phase 7 Selection Studio entegrasyonu.
  **Phase 7+ tasarım kaynağı:** `docs/design/EtsyHub_mockups/`
  (birincil yerel referans — `design-canvas.jsx`, `tweaks-panel.jsx`
  Selection Studio için yön verir). Ayrıntı için
  [`phase7-mockup-studio-prep.md`](./phase7-mockup-studio-prep.md).
- `admin-review-cost-override` — admin per-user override UI
- `multi-provider-review` — alternatif vision provider'lar (Claude / GPT-4V).
  **Alt-madde (2026-04-30 değerlendirmesi):** `Qwen3.5-4B` aday — Apache 2.0,
  native multimodal, OpenAI-uyumlu `image_url`. KIE host etmiyor; DeepInfra
  vision desteği belirsiz; lokal MLX self-host + HTTP wrapper gerekli.
  Phase 7+ hardening turunda probe + prototip.

### Aşama 1 Mimari Düzeltmesinden — Yeni

- **`phase6-asama2a-kie-review-provider`** ✅ Aşama 2A'da kapatıldı
  (2026-04-29) — `kie-gemini-flash.ts` STUB → real impl; AI mode canlı.
- **`phase6-asama2b-kie-local-review`** — local mode KIE review (data URL
  probe sonrası kapsam netleşir): küçük patch (`image-loader.ts` local-path
  data URL inline) veya orta patch (MinIO temp upload bridge — local asset'i
  kısa TTL'le upload + signed URL). Smoke'ta manuel curl probe ile karar
  verilir.
- **`direct-google-gemini-live-validation`** (opsiyonel) — kullanıcının canlı
  Google `geminiApiKey`'iyle `google-gemini-flash` provider'ı doğrulaması.
  Ürün önceliği KIE; bu yol bypass için bırakıldı.
- **`kie-raw-response-snapshot`** — Aşama 2A worker `responseSnapshot` olarak
  parsed `ReviewOutput` yazıyor; KIE ham response'u (`usage`, `model`, raw
  message) saklanmıyor. Phase 7+ follow-up: ham KIE response object'i de
  audit'e ekle (debug + token tracking için).

### Dalga C (Cost Tracking) — Yeni

- `cost-budget-settings-ui` — daily limit settings + admin per-user override
- `cost-real-time-pricing` — estimate yerine canlı Gemini fiyat (gerçek
  faturalama)
- `generate-variations-cost-tracking` — Phase 5'e geri-port (KIE provider
  cost tracking yok)
- `cost-tracking-recovery` (opsiyonel) — best-effort fail recovery (retry
  queue ya da idempotent retry key)
- `cost-budget-atomic` (opsiyonel) — TOCTOU race fix (Postgres advisory
  lock veya `INSERT ... WHERE` ile atomik tüketme)

### Dalga A–B Reviewer Notları (Ertelenen)

**Task 4 (Gemini provider):**

- Log redaction (PII koruma error mesajlarda)
- Provider id ↔ model id ayrımı (Gemini deprecation hazırlık)
- `candidates` field eksik test case
- `.avif` mime support
- `systemInstruction` field kullanımı (context caching)

**Task 5 (alpha-checks):**

- Sharp pipeline tek instance refactor
- Fixture üretim script repo'ya
- `src/features/design-review/` taşıma değerlendirmesi

**Task 7+8 (worker):**

- Ö1 — DRY worker refactor (handleDesignReview + handleLocalAssetReview ortak
  pipeline). Dalga C'de cost tracking için **paralel** ekleme yapıldı; DRY
  refactor ileri ertelendi.
- Ö3 — Sticky helper API ikilemi (`canSystemWrite` vs `systemDecision`)
- Ö4 — Hata mesajlarında ID PII koruma
- Ö5 — JSON `as unknown as Prisma.InputJsonValue` çift cast
- Ö6 — Test cleanup `afterAll` (user temizliği)

**Task 9+10 (auto-enqueue + local batch):**

- B3 — Magic number `100` named constant (batch page size)
- B5 — Enqueue payload runtime Zod validation

**Dalga B (drawer + bulk):**

- B2 — Phase 5 `BulkActionBar` primitive reuse refactor
- C1 — `selectAll` UI butonu veya dead code temizleme
- C3 — Drawer body scroll lock
- C4 — `ReviewCard` checkbox `aria-label` granular
- C5 — Pagination `aria-live="polite"`
- C6 — Drawer 404 endpoint (server-side detail not found)
- D1 — Bulk endpoint response `action` field
- D2 — `pageNum` parse `Number.isFinite` kullanımı
- D3 — Thumbnail TTL drawer için ayrı fetch
- ESLint `no-mixed-operators` config (approveDisabled parantez)
- Reset endpoint `productTypeKey` revision (Phase 7+ scope)

## Bilinen Sınırlar (Dürüstlük)

**Aşama 2A canlı smoke durumu (2026-05-01 itibarıyla):**

| Bileşen | Durum |
|---------|-------|
| Variation generation (z-image t2i) | ✅ Canlı doğrulandı (`state: SUCCESS`, KIE'den `resultUrl` döndü) |
| Review provider envelope drift (#4) | ✅ Düzeltildi (commit `1367b7c`); yanıltıcı "empty content" hatası kayboldu |
| Phase 5 KIE provider env-var bağımlılığı (drift #2) | ✅ Hotfix `f2ca19c` ile çözüldü (settings-aware refactor) |
| Review provider strict JSON schema reserved-word drift (#5) | ✅ Düzeltildi (commit `b681006`); `riskFlags[].type` → `riskFlags[].kind` write-new + read-both backward-compat. KIE strict schema kabul ediyor — smoke retry job 63'te 422 kayboldu. |
| Review pipeline canlı smoke | ⏳ Drift #5 sonrası ilerledi; ardından **drift #6 (image URL erişim)** ve KIE flaky maintenance ile bloke oldu. Detay aşağıda. |
| Phase 6 status | 🟡 (Aşama 2A mimari tamam + variation üretimi canlı + drift #5 kapandı; drift #6 ve KIE flaky stabilite bekliyor) |

**Açık drift / blocker listesi (sırasıyla):**

1. **Phase 5 drift #1 — `/variations` UI route eksikliği:** Sayfa kodu yok
   (`src/app/(app)/variations/` klasörü yok), feature flag `false`. Smoke
   şu an `scripts/smoke-trigger-variation.ts` CLI tetiklemesiyle yapılıyor.
   Ayrı Phase 5 closeout fix gerek; Phase 6 closeout'una dahil değil.
2. **Phase 5 drift #3 — KIE GPT image model id mismatch:** Phase 5 KIE
   GPT Image provider hardcoded `model: "gpt-image/1.5-image-to-image"`
   KIE'de tanınmıyor (canlı curl probe ile doğrulandı: 422 "model not
   supported"). Smoke `kie-z-image` text-to-image ile geçici unblock;
   gerçek model id'leri kullanıcı tarafından KIE docs'tan getirilip
   provider güncellenecek. Ayrı follow-up.
3. **Drift #6 — KIE bulut image URL erişimi (NEW, 2026-05-01):**
   Smoke retry job 63'te schema fix sonrası KIE `image_url`
   content-part'ında verilen MinIO signed URL'ini indiremedi:
   `kie review failed: 400 The image URL <localhost:9000/...> image
   download failed: HTTP 403: Forbidden`. Kök neden: KIE bulut
   servisi `localhost:9000` MinIO instance'ına erişemez (dev
   ortamı). İki olası çözüm Aşama 2B kapsamına genişletildi
   (aşağıda).
4. **Aşama 2B — Local mode + drift #6 için data URL probe (PENDING):**
   KIE Gemini `image_url` content-part'ında `data:image/...;base64,...`
   destekli mi probe smoke retry sırasında **yapılamadı** (KIE flaky
   maintenance'a düştü, deterministik sonuç alınamadı):
   - 200 ⇒ küçük patch (`image-loader.ts` hem local-path hem
     remote-url için data URL inline; drift #6 da çözülür)
   - 400/415 ⇒ orta patch (MinIO temp upload bridge + ngrok-style
     public proxy veya production object storage migration)
   Probe sonucuna göre Aşama 2B impl yönü belirlenir.
5. **KIE flaky maintenance pattern (NEW, 2026-05-01):**
   Smoke retry günü endpoint sürekli arasıra `code:500
   "maintained"` envelope dönmeye başladı (HEALTHY → flaky → drift
   #6 hatası → flaky döngüsü). Provider envelope-aware (drift #4
   fix) bunu zaten doğru hata mesajıyla throw ediyor; ek bir
   provider değişikliği gerekmiyor. KIE infrastructure stabilize
   olunca drift #6 + Aşama 2B probe + smoke retry yeniden denenir.

**Drift #4 (envelope-aware) detay (commit `1367b7c`):**
Provider artık HTTP 200 + KIE envelope `{code, msg, data}` shape'ini doğru
parse eder; `code !== 200` durumunda gerçek envelope mesajıyla throw.
Defansif: envelope yoksa (KIE ileride flat OpenAI dönerse) flat body
fallback. Production'da her gerçek KIE hata mesajı (rate limit, auth,
validation) artık doğru yansır.

**Drift #5 (KIE strict JSON schema reserved-word) detay (commit `b681006`):**
KIE maintenance bittikten sonra strict JSON schema validator davranışı
değişti: HTTP 200 + envelope `{ code: 422, msg:
"$.response_format.json_schema.schema.properties.riskFlags.items.properties.type
must be string or array", ... }`. Üç curl probe ile kök neden: KIE'nin
JSON schema parser'ı `properties: { type: { ... } }` yapısını JSON
Schema reserved word çakışması olarak reddediyor.

Kullanıcı yön kararı **(C) Hibrit — write-new + read-both backward-compat**:
- **Write-new**: Yeni review output'larda `riskFlags[].kind` üretilir
  (Zod schema + KIE strict JSON schema güncel; alpha-checks `kind` üretir;
  master prompt v1.0 → v1.1).
- **Read-both**: `readRiskFlagKind(entry)` helper hem `kind` (yeni) hem
  `type` (legacy) okur. Tüketiciler: Phase 7 selection review-mapper +
  Phase 6 UI ReviewRiskFlagList. DB'de eski format row'u olmadığı için
  backfill yapılmadı; defansif disipline gereği helper eklendi.

Kapsam: 19 dosya değişti / 1 yeni helper test dosyası. Phase 6 baseline
minimum blast radius (cost-budget, KIE image provider, Aşama 2B local
mode, Phase 7 selection edit-ops dokunulmadı). Tam regression: 1664
test PASS (Phase 6 baseline 178/178, Phase 7 selection 399/399, UI
623/623).

Smoke retry job 63 (2026-05-01): drift #5 sonrası 422 kayboldu, akış
KIE image URL download'a kadar ilerledi → drift #6 ortaya çıktı (MinIO
localhost erişim). Schema fix kanıtlanmış şekilde çalışıyor.

**Qwen3.5-4B değerlendirmesi (2026-04-30 — implement EDİLMEYECEK):**

KIE bakımı sırasında alternatif review provider olarak araştırıldı.
**Sonuç: Phase 6'da implement edilmeyecek**, sadece `multi-provider-review`
carry-forward'una alt-madde olarak kayıt. Sebepler:

- **KIE.ai bu modeli host etmiyor** — KIE Qwen *Image* (text-to-image
  generation) sunuyor, Qwen3.5-4B (LLM/VLM) değil. Mevcut KIE
  entegrasyonumuzla uyumlu yol yok.
- **DeepInfra vision input desteği kanıtlanmamış** — Artificial Analysis
  sayfasında belirtilmemiş; production öncesi probe gerek.
- **Lokal MLX self-host ek altyapı istiyor** — `mlx-lm.server` veya custom
  HTTP wrapper, supervisor (PM2/launchd), kaynak rekabeti. 2-3 saatlik
  prototip işi.
- **JSON schema compliance canlı probe gerektiriyor** — 4B sınıfında
  strict JSON + Türkçe/İngilizce karışık prompt invariant'ı kanıt-validated
  değil; Gemini'de KESİN KURAL ile zorlamak gerekti.
- **Vision quality 4B sınıfında 9B/27B'nin gerisinde** (MMMU-Pro 66.3
  makul ama image-based risk flag tespiti için yeterli olup olmayacağı
  kanıtlanmadı).

Olumlu yanlar (gelecek değerlendirme için): Apache 2.0 lisans, native
multimodal, OpenAI-uyumlu `image_url` content-part, function calling +
JSON mode + MCP destekli, M-series'te MLX 4-bit (~3-4GB RAM) interaktif
hız. **Ana neden ertelenme:** KIE bakımı geçici; Phase 6 ana yol Gemini
ile kapanır; multi-provider hardening Phase 7+'da.

0. **Phase 5 KIE image provider settings-aware hotfix uygulandı (2026-04-29 — Aşama 2A smoke öncesi):**
   Phase 6 Aşama 2A canlı smoke'unda Phase 5 KIE image provider'ının
   `process.env.KIE_AI_API_KEY` beklediği tespit edildi (Phase 5 closeout
   drift). Hotfix: image provider settings-aware refactor — per-user
   encrypted `kieApiKey` setting'inden okur, env var bağımlılığı kalktı.
   Phase 6 review provider'ıyla simetrik pattern (`ImageGenerateOptions
   { apiKey: string }` ↔ `ReviewProviderRunOptions { apiKey: string }`).
   `kie-shared.requireApiKey()` env helper SİLİNDİ; yerine
   `assertApiKey(providerId, apiKey)` validasyon helper'ı geldi.

   **Phase 5 closeout drift hâlâ açık:** `/variations` UI route'u eksik
   (sayfa kodu yok, feature flag `false`). Ayrı task gerekli; bu hotfix'e
   dahil DEĞİL. Smoke şu an CLI tetiklemeyle yapılıyor
   (`scripts/smoke-trigger-variation.ts`).

1. **KIE review provider AI mode canlı; local mode Aşama 2B bekliyor:**
   `kie-gemini-flash` provider AI mode (`scope: "design"`, signed URL) için
   gerçek impl tamam — KIE.ai Gemini 2.5 Flash chat/completions ile çalışır.
   Local mode (`scope: "local"`, `local-path`) explicit throw `"KIE local
   review henüz etkin değil; Aşama 2B bekleniyor."`. Aşama 2B'de KIE'nin data
   URL desteği canlı smoke'da probe edilecek; sonuca göre küçük patch
   (`image-loader.ts` data URL inline) veya orta patch (MinIO temp upload
   bridge) seçilecek.

2. **Direct Google Gemini provider canlı doğrulanmadı:**
   `google-gemini-flash` provider mock testlerle entegre; canlı
   `geminiApiKey` ile smoke YAPILMADI. Kullanıcı canlı Google key'i girerse
   çalışabilir, ancak ürün önceliği KIE — pratikte bu yol seçilmiyor.
   Carry-forward: `direct-google-gemini-live-validation` (opsiyonel).

3. **Conservative cost estimate, gerçek faturalama değil:**
   `REVIEW_ESTIMATED_COST_CENTS = 1` sabit; Gemini'nin real-time fiyatı
   farklı olabilir (~$0.001/çağrı). Minimum hesap birimi $0.01 (Int alan)
   olduğu için fractional fiyatlar yuvarlanmıştır. Real-time pricing
   carry-forward: `cost-real-time-pricing`. Aşama 1 sonrası review pipeline
   canlı çalışmadığı için CostUsage tablosu henüz dolmuyor.

4. **Detail panel server-side 404 endpoint yok:**
   Drawer queue cache'inden okur. URL `?detail=invalid_cuid` durumunda
   "bulunamadı" fallback gösterir; sunucuya gidilmez. Carry-forward C6.

5. **Tek aktif vision provider (KIE STUB hariç):** `google-gemini-flash`
   tek mock-tested vision provider; `kie-gemini-flash` Aşama 2'de aynı kind
   altında implemente edilecek. Alternatif provider (Claude / GPT-4V) için
   `multi-provider-review` carry-forward.

6. **TOCTOU race penceresi (cost budget):**
   Hızlı ardışık review'larda iki worker aynı anda budget check geçebilir
   ⇒ limit minimal aşılabilir. USER sticky koruması atomik (`updateMany`
   guard) ama cost budget atomik değil. `cost-budget-atomic` carry-forward.

7. **DRY ihlali (handleDesignReview / handleLocalAssetReview):**
   Cost tracking + budget check + provider resolve iki branch'te paralel
   eklendi (Task 7+8 reviewer Ö1 carry-forward'da DRY refactor ileri
   ertelendi). Aşama 1'de yeni ihlal eklenmedi; mevcut paterne uyuldu.

## Aşama 2A Smoke Checklist (Kullanıcı Handoff)

> **Önkoşul:** `/settings` → AI Mode → KIE API Key girilmiş, `reviewProvider:
> "kie"` (default). Encrypted at rest.

### 1. AI Mode auto-review

- Bookmark → Reference promote → `/references/[id]/variations` sayfasından
  AI Mode'da 1 variation üret
- `/review` → "AI Tasarımları" sekmesi → yeni kayıt PENDING (1–2 sn içinde)
- Birkaç saniye sonra refresh → status `APPROVED` veya `NEEDS_REVIEW`
- Karta tıkla → drawer açıldı, `riskFlags` listesi + provider snapshot
  `kie-gemini-flash@YYYY-MM-DD` görünür

### 2. Strict JSON schema vs json_object fallback gözlemi (RAPOR ET)

- Worker log'larında (terminal `npm run worker`) review sırasında
  `"kie review failed: 400 ... response_format"` veya benzeri görünüyor mu?
- Görünüyorsa → strict mode reddedildi, fallback aktif
- Görünmüyorsa → strict mode çalıştı (KIE strict destekliyor)
- **RAPOR ET:** strict mı fallback mı kullanıldı

### 3. `usage.total_tokens` gözlemi (RAPOR ET)

- DesignReview tablosu `responseSnapshot` alanında KIE response full JSON saklı
- `npx prisma studio` → `DesignReview` row → `responseSnapshot` JSON içinde
  `usage.total_tokens` field'ı var mı?
- **NOT:** Şu an worker `responseSnapshot` olarak `llm` (parsed `ReviewOutput`)
  yazıyor — KIE'nin ham response'u (usage dahil) saklanmıyor. Smoke'ta
  total_tokens'ı KIE'nin direct API call log'undan veya KIE dashboard'dan
  doğrulayın. Phase 7+ follow-up: ham response snapshot (`llm` + raw KIE
  response object).
- **RAPOR ET:** total_tokens geldi mi (response içinde), hangi aralıkta
  (~100? ~500? ~1500?)

### 4. CostUsage row doğrulama (RAPOR ET)

- `npx prisma studio` → `CostUsage` tablosu
- Yeni row: `providerKey: "kie-gemini-flash"`, `model: "gemini-2.5-flash"`,
  `costCents: 1`, `units: 1`, `periodKey: YYYY-MM-DD` (UTC)
- **RAPOR ET:** row yazıldı mı, model field gerçek model id mi
  (provider id değil)

### 5. Local Mode "Aşama 2B bekliyor" kontrolü

- Local Library → 1 asset seç → `POST /api/review/local-batch` ile batch
  review tetikle
- Job FAIL olmalı, error message:
  `"KIE local review henüz etkin değil; Aşama 2B bekleniyor."`
- `/review` → "Local Library" sekmesinde kart hâlâ PENDING (job error)

### 6. USER Override + Reset (Aşama 2A'dan etkilenmedi, regression)

- `NEEDS_REVIEW` kaydında "Approve anyway" → status `APPROVED` + USER rozeti
- "Reset to system" → SYSTEM `PENDING`'e döner + yeni review job tetiklenir
- KIE provider tekrar çalışır (AI mode ⇒ remote URL)

### Aşama 2B Karar Girdisi — Manuel Data URL Probe

Smoke sırasında (1. adımdan sonra, ekstra adım) KIE'nin data URL desteğini
manuel test edin:

```bash
# Küçük PNG'i base64+data URL formatına çevir
PNG_B64=$(base64 -i /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub/tests/fixtures/review/transparent-clean.png | tr -d '\n')
DATA_URL="data:image/png;base64,${PNG_B64}"

# KIE'ye doğrudan gönder
curl -X POST https://api.kie.ai/gemini-2.5-flash/v1/chat/completions \
  -H "Authorization: Bearer <KIE_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": [
      {"type": "text", "text": "What is in this image?"},
      {"type": "image_url", "image_url": {"url": "'"${DATA_URL}"'"}}
    ]}]
  }'
```

- 200 + sensible response ⇒ data URL kabul ediliyor → Aşama 2B küçük patch
  (`image-loader.ts` local-path data URL inline)
- 4xx + "invalid url" / "must be http" benzeri ⇒ Aşama 2B orta patch (MinIO
  temp upload bridge — local asset'i kısa TTL'le upload + signed URL)

### Smoke Sonucu Bu Doc'a Eklenmeli (Kullanıcı)

`## Real KIE Smoke Sonuçları (YYYY-MM-DD)` başlığı altında:

- 3 spesifik gözlem maddesi (strict/fallback, total_tokens, CostUsage row)
- Hangi adımlar geçti / hangileri sürpriz çıkardı
- Türkçe prompt + İngilizce JSON anahtar varsayımı doğrulandı mı
- Beklenmedik error / edge case
- Aşama 2B data URL probe sonucu (200 mı 4xx mı)
- 8 risk flag türünün tetiklenebildiği gerçek görseller (varsa)

## Kontrat — Sonraki Phase'ler İçin Kilitli

Aşağıdaki sözleşmeler Phase 6'nın **bağlayıcı** çıktısıdır:

- **`ReviewProvider` interface** (`src/providers/review/types.ts`) — `kind:
  "vision"` tek tipi, Phase 7+'da deterministic kind eklenebilir
  (discriminated union genişletilir)
- **Provider registry** (`src/providers/review/registry.ts`) — hardcoded
  lookup YASAK, sessiz fallback YASAK (Phase 5'ten devam). Aşama 1'de iki
  provider register: `google-gemini-flash` + `kie-gemini-flash` (STUB).
- **Selectable review provider settings** (Aşama 1) — `reviewProvider:
  "kie" | "google-gemini"` settings alanı + worker
  `resolveReviewProviderConfig` helper. Yeni provider eklerken bu enum
  genişletilir; settings UI ve worker resolve eşit güncellenir.
- **`REVIEW_RISK_FLAG_TYPES`** — 8 sabit tür, Zod enforced. Yeni tür
  eklenmeden önce prompt + decision rule + UI badge mapping güncellenmeli
- **Decision rule** (`decideReviewStatus`) — deterministic, hardcoded
  threshold 60/90. Settings'e taşıma carry-forward
- **Sticky kuralı (R12)** — `reviewStatusSource = USER` ⇒ SYSTEM dokunmaz.
  `updateMany WHERE reviewStatusSource ≠ USER` guard atomik
- **Snapshot zorunluluğu** — provider + prompt her review yazımında
  persist; runtime config değişiklikleri eski review'ı bozmaz
- **`CostUsage` schema** — `costCents` Int, `units` Int, `periodKey` daily
  string YYYY-MM-DD UTC. Real-time pricing eklenirse aynı tabloya yazılır
  (sadece sabit ≠ 1 olur)
