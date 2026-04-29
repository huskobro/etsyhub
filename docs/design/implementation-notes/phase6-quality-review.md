# Phase 6 — AI Quality Review Closeout

> **Tarih:** 2026-04-29
> **Status:** Backend pipeline + UI vitrin + UX kapanış + cost tracking + selectable
> review provider mimarisi tamam (Aşama 1). KIE review provider implementasyonu
> Aşama 2'de yapılacak (KIE.ai Gemini endpoint kontratı bekleniyor); default
> kullanıcıda review job FAIL durumda — bu bilinen bir sınırdır, dürüstçe
> dokümante edildi.

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
- `fix-with-ai-actions` — Phase 7 Selection Studio entegrasyonu
- `admin-review-cost-override` — admin per-user override UI
- `multi-provider-review` — alternatif vision provider'lar (Claude / GPT-4V)

### Aşama 1 Mimari Düzeltmesinden — Yeni

- **`phase6-asama2-kie-review-provider`** — KIE.ai Gemini endpoint
  implementasyonu (`kie-gemini-flash.ts` STUB → real). KIE.ai dashboard/docs'tan
  bekleniyor: endpoint URL, auth header, sync/async pattern, request body
  image input format, response envelope, model id string. Phase 5
  `kie-shared.ts` paterni reuse edilebilir.
- **`direct-google-gemini-live-validation`** (opsiyonel) — kullanıcının canlı
  Google `geminiApiKey`'iyle `google-gemini-flash` provider'ı doğrulaması.
  Ürün önceliği KIE; bu yol bypass için bırakıldı.

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

1. **KIE review provider STUB durumda (Aşama 2 bekleniyor):**
   `kie-gemini-flash` provider registry'ye kayıtlı ama `review()` çağrılırsa
   yön mesajıyla throw atar. Default user (`reviewProvider: "kie"`) için
   review job FAIL. Kullanıcı `"google-gemini"`'ye geçebilir (mock-tested
   direct Google API) veya Aşama 2 implementasyonunu bekleyebilir. KIE.ai
   Gemini endpoint kontratı netleştikten sonra impl edilecek.

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

## Real Gemini Smoke Checklist (Kullanıcı Handoff)

> **Aşama 1 sonrası bu checklist UYGULANMAZ.** Aşama 2 KIE provider
> implementasyonu sonrası kullanılacak (KIE varyantı için adımlar adapte
> edilir). Mevcut adımlar Google direct yolu için referans olarak korunuyor;
> kullanıcı opsiyonel olarak `direct-google-gemini-live-validation`
> carry-forward kapsamında çalıştırabilir.

> **Önkoşul:** `/settings` → AI Mode → Gemini API Key ekle + provider
> "Google Gemini (ileri seviye)" seç (encrypted at rest).

### 1. AI Mode auto-review

- Reference promote + `/references/[id]/variations` sayfasından AI Mode'da
  1 variation üret
- `/review` → "AI Tasarımları" sekmesi → yeni kayıt PENDING (1–2 sn içinde)
- Birkaç saniye sonra refresh → status `APPROVED` veya `NEEDS_REVIEW`
- Karta tıkla → drawer açıldı, `riskFlags` listesi + provider snapshot
  (`gemini-2-5-flash@2026-04-29`) görünür

### 2. USER Override + Reset

- `NEEDS_REVIEW` kaydında "Approve anyway" → status `APPROVED` + USER rozeti
- "Reset to system" → SYSTEM `PENDING`'e döner + yeni review job tetiklenir
- Birkaç saniye sonra refresh → SYSTEM yeniden değerlendirme yazdı

### 3. Local Batch

- Local Library'den 5 asset seç → batch review tetikle
  (`POST /api/review/local-batch`)
- `/review` → "Local Library" sekmesi → kayıtlar gelir (productTypeKey ile)

### 4. Bulk Actions

- 10 kart seç (bazı risk flag'li, bazı temiz)
- Bulk Onayla → confirm dialog skip-on-risk hint görünür
- Onayla → toast "X onaylandı, Y atlandı"
- Local'da 3 asset seç → Bulk Sil → "SİL" yazana kadar disabled → SİL → soft-delete

### 5. Cost Tracking (Task 18)

- `npx prisma studio` → `CostUsage` tablosu
- Yapılan review sayısı kadar row mevcut (her biri 1 cent, periodKey YYYY-MM-DD)
- Daily limit test (opsiyonel, vakti varsa): 1000+ row insert et + 1001.
  review tetikle → worker explicit throw `daily review budget exceeded`

### Smoke Sonucu Bu Doc'a Eklenmeli (Kullanıcı)

`## Real Gemini Smoke Sonuçları (YYYY-MM-DD)` başlığı altında:

- Hangi adımlar geçti / hangileri sürpriz çıkardı
- Türkçe prompt + İngilizce JSON anahtar varsayımı doğrulandı mı
- Beklenmedik error / edge case
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
