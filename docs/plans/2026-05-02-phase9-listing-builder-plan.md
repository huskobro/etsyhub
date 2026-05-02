# Phase 9 — Listing Builder Plan (Taslak)

> **Status:** 🟡 Plan taslağı (kullanıcı onayı bekliyor)
> **Tarih:** 2026-05-02
> **Design doc:** [`./2026-05-02-phase9-listing-builder-design.md`](./2026-05-02-phase9-listing-builder-design.md)
> **Phase 8 emsali:** [`./2026-05-01-phase8-mockup-studio-plan.md`](./2026-05-01-phase8-mockup-studio-plan.md)
>
> **Önemli:**
> - Bu plan **taslak**; design doc K1-K6 kararları onaylandıktan sonra finalize edilir
> - Phase 8 V1 manual QA pending; sürpriz bug Phase 9 implementation'ı bloklayabilir
> - Implementation `superpowers:subagent-driven-development` ile yürütülür (Phase 8 emsali)

---

## 1. Hedef ve Non-Goals

### 1.1 Hedef

Mockup pack'inden Etsy listing draft'ı oluşturup Etsy'ye **draft olarak** göndermek. AI ile metadata üretip kullanıcı düzenlesin, sonra tek tıkla Etsy'ye git.

### 1.2 Non-Goals (V1 mutlak yapılmayacak)

- **Etsy active publish** — CLAUDE.md disipline yasak
- Listing schedule (cron/zamanlı publish)
- Multi-platform publish (Amazon, Shopify)
- Listing analytics
- Master prompt management UI (admin panel)
- Eski `Listing`/`Mockup` model temizliği
- Custom image cropping / aspect override

### 1.3 Success kriterleri

- Kullanıcı S8 "Listing'e gönder" CTA → 5 dakika içinde Etsy'de listing draft görünür
- AI ile metadata üretip düzenleyebilmek
- Readiness checklist UI'da görünür
- TS strict 0, default + UI suite yeşil, token check pass
- Phase 9 V1 manual QA checklist hazır (gerçek koşum kullanıcıya bağlı)

---

## 2. Task Grupları

Phase 8'in 33 task topolojisini emsal alarak Phase 9 V1 ~28-30 task tahmin. Gruplama:

```
Foundation (5 task) ──→ Backend Services (7 task) ──→ API (6 task)
                                                          │
                                                          ▼
                       UI Screens (8 task) ←── Etsy Integration (4 task)
                              │
                              ▼
                       Quality Gates (3 task) ──→ Closeout (2 task)
```

Toplam: **35 task** (Phase 8'in 33'üne yakın).

---

## 3. Foundation (Task 1-5)

### Task 1 — Prisma migration: `Listing` extend + `JobType.ETSY_LISTING_SUBMIT`

**Açıklama:** `Listing` modeline Phase 8 köprü alanları ekle (additive, nullable). `JobType` enum'una `ETSY_LISTING_SUBMIT` ekle.

**Önerilen varsayım K1:** `Listing` extend (S1).

**Files:**
- `prisma/schema.prisma` (modify)
- `prisma/migrations/{ts}_phase9_listing_extend/migration.sql` (yeni)

**Bağımlılık:** Yok.

**Risk:** Mevcut `Listing` legacy alanları (`generatedDesignId`, `mockups`) korunur; ama eski data varsa migration güvenli mi doğrula. **Kanıt gerekli:** prod DB'de `SELECT count(*) FROM "Listing"` çalıştır; 0 ise risksiz.

### Task 2 — Provider config types

**Açıklama:** Etsy provider config + AI provider config TypeScript tipleri.

**Files:**
- `src/providers/etsy/types.ts` (yeni)
- `src/providers/listing-meta-ai/types.ts` (yeni)

**Bağımlılık:** Task 1.

### Task 3 — Zod schemas (validation)

**Açıklama:** API endpoint'leri için Zod request/response schemas.

**Files:**
- `src/features/listings/schemas.ts` (yeni)

**Bağımlılık:** Task 2.

### Task 4 — Etsy provider abstraction + OAuth scaffold

**Açıklama:** Etsy Open API client wrapper + OAuth flow scaffold (auth init + callback + token refresh).

**Files:**
- `src/providers/etsy/client.ts` (yeni)
- `src/providers/etsy/oauth.ts` (yeni)
- `src/app/api/etsy/auth/route.ts` (yeni — OAuth init redirect)
- `src/app/api/etsy/callback/route.ts` (yeni — OAuth code → token exchange)

**Bağımlılık:** Task 2.

**Risk (T6):** OAuth implementation Phase 9'da ilk kez yazılıyor. Etsy API key + secret kullanıcı tarafından sağlanmalı (E1).

**External dependency:** ⚠️ Etsy developer portal hesabı + API key/secret.

### Task 5 — AI provider abstraction (V1 OpenAI)

**Açıklama:** AI metadata provider abstraction. V1'de OpenAI gpt-4 (hardcoded prompt). V2'de master prompt management.

**Files:**
- `src/providers/listing-meta-ai/openai-provider.ts` (yeni)
- `src/providers/listing-meta-ai/registry.ts` (yeni)
- `src/providers/listing-meta-ai/prompts.ts` (yeni — V1 hardcoded)

**Bağımlılık:** Task 2.

**External dependency:** ⚠️ OpenAI API key (E3).

> **🟡 T2 Karar gerekli:** Provider seçimi (OpenAI vs KIE vs local). Önerilen varsayım = OpenAI gpt-4.

---

## 4. Backend Services (Task 6-12)

### Task 6 — Listing handoff service (Phase 8 emsali)

**Açıklama:** `MockupJob → Listing` atomik handoff (S8 CTA arkası). Cover invariant + image order snapshot.

**Files:**
- `src/features/listings/server/handoff.service.ts` (yeni)

**Bağımlılık:** Task 1, 3.

**Risk:** Phase 8 `MockupJob` schema'sına dokunma (sadece reverse relation eklendi, kontrat dokunulmaz).

### Task 7 — Listing state machine + aggregate

**Açıklama:** ListingStatus state transitions (DRAFT → SCHEDULED → PUBLISHED veya FAILED/REJECTED), submit lifecycle.

**Files:**
- `src/features/listings/server/listing.service.ts` (yeni)

**Bağımlılık:** Task 1.

### Task 8 — Readiness check service

**Açıklama:** ListingDraftView içinde readiness array hesaplama (V1 6 check, soft warn).

**Files:**
- `src/features/listings/server/readiness.service.ts` (yeni)

**Bağımlılık:** Task 7.

### Task 9 — AI metadata generation service

**Açıklama:** `generateListingMeta(listingId, options)` — OpenAI gpt-4 çağrısı + parse + validate.

**Files:**
- `src/features/listings/server/ai-meta.service.ts` (yeni)

**Bağımlılık:** Task 5, 7.

**Risk:** AI provider down / rate limit; UI feedback graceful (Phase 8 emsali submit error inline alert).

### Task 10 — Etsy submit service

**Açıklama:** `submitListingToEtsy(listingId)` — BullMQ ETSY_LISTING_SUBMIT job dispatch + worker.

**Files:**
- `src/features/listings/server/submit.service.ts` (yeni)
- `src/server/workers/etsy-listing-submit.worker.ts` (yeni)
- `src/jobs/etsy-listing-submit.config.ts` (yeni — BullMQ config)

**Bağımlılık:** Task 4, 7.

**Risk (T1):** Etsy API rate limit + token refresh + 5xx transient. BullMQ retry policy.

### Task 11 — Etsy error classifier

**Açıklama:** Etsy submit hata sınıflandırması (5-class minimum: AUTH_EXPIRED / RATE_LIMITED / VALIDATION_FAILED / PROVIDER_DOWN / LISTING_NOT_READY).

**Files:**
- `src/features/listings/server/error-classifier.service.ts` (yeni)

**Bağımlılık:** Task 10.

### Task 12 — Negative library check service (V1 minimal)

**Açıklama:** Hardcoded blocklist (Disney, Marvel, vb. ~10 madde). AI çıktısı listing'e set edilmeden önce kontrol. V2'de admin panel managed.

**Files:**
- `src/features/listings/server/negative-library.service.ts` (yeni)

**Bağımlılık:** Task 9.

**Karar gerekli (auxiliary):** V1'de negative library hard-block mi (üretilen çıktı içeriyorsa reddet) yoksa warn-only mi? Önerim: **warn-only** V1; V1.1 hard block.

---

## 5. API Endpoints (Task 13-18)

### Task 13 — `POST /api/listings/draft`

**Açıklama:** Mockup pack → listing draft handoff endpoint.

**Files:**
- `src/app/api/listings/draft/route.ts` (yeni)
- `tests/integration/listings/api/create-draft.test.ts` (yeni)

**Bağımlılık:** Task 6.

### Task 14 — `GET /api/listings/draft/[id]`

**Açıklama:** Draft detay (status + meta + assets + readiness).

**Files:**
- `src/app/api/listings/draft/[id]/route.ts` (yeni)
- `tests/integration/listings/api/get-draft.test.ts` (yeni)

**Bağımlılık:** Task 7, 8.

### Task 15 — `PATCH /api/listings/draft/[id]`

**Açıklama:** Manuel edit (title, description, tags, price, vb.). Zod partial validate.

**Files:**
- Reuse `src/app/api/listings/draft/[id]/route.ts` (PATCH method)
- `tests/integration/listings/api/update-draft.test.ts` (yeni)

**Bağımlılık:** Task 14.

### Task 16 — `POST /api/listings/draft/[id]/generate-meta`

**Açıklama:** AI metadata üretimi (manuel button trigger).

**Files:**
- `src/app/api/listings/draft/[id]/generate-meta/route.ts` (yeni)
- `tests/integration/listings/api/generate-meta.test.ts` (yeni)

**Bağımlılık:** Task 9.

> **🟡 K2 Karar gerekli:** Manuel button vs handoff'ta otomatik. Önerilen varsayım = manuel button.

### Task 17 — `POST /api/listings/draft/[id]/submit`

**Açıklama:** Etsy submit BullMQ dispatch + 202 response.

**Files:**
- `src/app/api/listings/draft/[id]/submit/route.ts` (yeni)
- `tests/integration/listings/api/submit-draft.test.ts` (yeni)

**Bağımlılık:** Task 10, 11.

### Task 18 — `GET /api/listings`

**Açıklama:** User listing'leri index (status filter).

**Files:**
- `src/app/api/listings/route.ts` (yeni)
- `tests/integration/listings/api/list-listings.test.ts` (yeni)

**Bağımlılık:** Task 7.

---

## 6. UI Screens (Task 19-26)

### Task 19 — Listing hooks (`useListingDraft`, `useListings`)

**Açıklama:** TanStack Query hook'ları (Phase 8 `useMockupJob` emsali). Polling submit status için.

**Files:**
- `src/features/listings/hooks/useListingDraft.ts` (yeni)
- `src/features/listings/hooks/useListings.ts` (yeni)
- `tests/unit/listings/url-state.test.tsx` (yeni)

**Bağımlılık:** Task 14, 18.

### Task 20 — `/listings` index sayfası

**Açıklama:** Sidebar nav `/listings` route enable (mevcut `nav-config.ts:40` phase:9 disabled flag kaldır). Active drafts grid + status filter.

**Files:**
- `src/app/(app)/listings/page.tsx` (yeni — server entry)
- `src/features/listings/components/ListingsIndex.tsx` (yeni)
- `src/features/app-shell/nav-config.ts` (modify — `enabled: true`)
- `tests/unit/listings/ui/ListingsIndex.test.tsx` (yeni)

**Bağımlılık:** Task 19.

### Task 21 — `/listings/draft/[id]` ana builder layout

**Açıklama:** 4-zone layout (Asset / Metadata / Pricing / Footer Submit). Phase 8 S3ApplyView emsali.

**Files:**
- `src/app/(app)/listings/draft/[id]/page.tsx` (yeni — server entry)
- `src/features/listings/components/ListingDraftView.tsx` (yeni)
- `tests/unit/listings/ui/ListingDraftView.test.tsx` (yeni)

**Bağımlılık:** Task 19.

### Task 22 — Asset section component

**Açıklama:** Cover + ordered render thumbnails grid; "Mockup'a dön" link; bulk ZIP CTA.

**Files:**
- `src/features/listings/components/AssetSection.tsx` (yeni)
- `tests/unit/listings/ui/AssetSection.test.tsx` (yeni)

**Bağımlılık:** Task 21.

### Task 23 — Metadata section component (with AI generate button)

**Açıklama:** Title input + description textarea + tags chip array + category dropdown + "✨ AI ile üret" button.

**Files:**
- `src/features/listings/components/MetadataSection.tsx` (yeni)
- `tests/unit/listings/ui/MetadataSection.test.tsx` (yeni)

**Bağımlılık:** Task 21.

### Task 24 — Pricing section + Readiness checklist

**Açıklama:** Price input + materials chip array + production partner dropdown + digital/physical toggle + readiness checklist (V1 soft warn).

**Files:**
- `src/features/listings/components/PricingSection.tsx` (yeni)
- `src/features/listings/components/ReadinessChecklist.tsx` (yeni)
- `tests/unit/listings/ui/PricingSection.test.tsx` (yeni)

**Bağımlılık:** Task 21.

> **🟡 K3 Karar gerekli:** Soft warn vs hard gate. Önerilen varsayım = soft warn.

### Task 25 — Submit modal + footer

**Açıklama:** Sticky footer + "Etsy'ye gönder" CTA + confirmation modal. Submit error inline alert (Phase 8 emsali).

**Files:**
- `src/features/listings/components/SubmitFooter.tsx` (yeni)
- `src/features/listings/components/SubmitConfirmModal.tsx` (yeni)
- `tests/unit/listings/ui/SubmitFooter.test.tsx` (yeni)

**Bağımlılık:** Task 21.

### Task 26 — `/listings/[id]` post-submit detay sayfası

**Açıklama:** Read-only listing detayı, Etsy'de aç link, status badge.

**Files:**
- `src/app/(app)/listings/[id]/page.tsx` (yeni)
- `src/features/listings/components/ListingDetailView.tsx` (yeni)
- `tests/unit/listings/ui/ListingDetailView.test.tsx` (yeni)

**Bağımlılık:** Task 19.

---

## 7. Etsy Integration (Task 27-30)

### Task 27 — OAuth init UI (`/settings/etsy-connection`)

**Açıklama:** Kullanıcı Etsy hesabı bağlama UI'ı. "Etsy ile bağlan" button → OAuth init redirect.

**Files:**
- `src/app/(app)/settings/etsy-connection/page.tsx` (yeni)
- `src/features/listings/components/EtsyConnectionCard.tsx` (yeni)
- `tests/unit/listings/ui/EtsyConnectionCard.test.tsx` (yeni)

**Bağımlılık:** Task 4.

**External dependency (E1, E2):** Etsy developer portal API key + sandbox shop.

### Task 28 — OAuth callback handler doğrulama

**Açıklama:** Task 4'te scaffold'lanan callback endpoint'ini gerçek Etsy OAuth response ile bağla.

**Files:**
- `src/app/api/etsy/callback/route.ts` (modify — Task 4'ten)
- `tests/integration/listings/api/etsy-callback.test.ts` (yeni)

**Bağımlılık:** Task 4, 27.

### Task 29 — Etsy submit worker integration test

**Açıklama:** `ETSY_LISTING_SUBMIT` worker'ın gerçek Etsy sandbox submit'i ile test (mocked Etsy API).

**Files:**
- `tests/integration/listings/etsy-submit.test.ts` (yeni)

**Bağımlılık:** Task 10.

**Risk (T1):** Mock fixture flaky olabilir. Phase 6 KIE flaky carry-forward emsali.

### Task 30 — Token refresh handler + expiry tracking

**Açıklama:** `EtsyConnection.tokenExpires` proactive refresh; submit handler içinde token expired → re-OAuth UI redirect.

**Files:**
- `src/features/listings/server/etsy-token.service.ts` (yeni)
- `tests/integration/listings/etsy-token-refresh.test.ts` (yeni)

**Bağımlılık:** Task 4.

---

## 8. Quality Gates (Task 31-33)

### Task 31 — Phase 8 S8 CTA aktivasyonu (köprü tamamlama)

**Açıklama:** Phase 8 S8ResultView içindeki "Listing'e gönder" disabled CTA'yı enable et + handoff endpoint'e bağla. **Phase 8 koduna minimal dokunuş.**

**Files:**
- `src/features/mockups/components/S8ResultView.tsx` (modify — sadece CTA enable + onClick)
- `tests/unit/mockup/ui/S8ResultView.test.tsx` (modify — yeni senaryo: CTA click → POST /listings/draft)

**Bağımlılık:** Task 13.

**Risk:** Phase 8 closeout disipline'i — minimal mutate, kontrat dokunulmaz. Sadece UI affordance enable.

### Task 32 — E2E golden path UI smoke

**Açıklama:** Phase 7/8 E2E emsali — UI smoke (Etsy submit scope dışı).

**Files:**
- `tests/e2e/listings-flow.spec.ts` (yeni)

**Bağımlılık:** Task 26.

**Senaryolar (V1):**
- S8 → "Listing'e gönder" → /listings/draft/[id] navigate
- Metadata edit + AI generate button
- Pricing edit + readiness checklist görünür
- "Etsy'ye gönder" CTA görünür (Etsy submit scope dışı)
- /listings index'e dön

### Task 33 — Listing service unit + integration test coverage

**Açıklama:** Phase 8 Task 31 snapshot emsali değil; bu task unit/integration test coverage doğrulama (handoff, state machine, readiness, AI meta, submit).

**Files:**
- Tüm `tests/integration/listings/**` dosyalarının coverage doğrulaması
- Eksik senaryolar eklenir

**Bağımlılık:** Task 6-12 (services).

---

## 9. Closeout (Task 34-35)

### Task 34 — Phase 9 closeout doc

**Açıklama:** Phase 8 emsali (`phase8-closeout.md`). V1 kapsam + dürüst sınırlamalar + süreç dersleri + V2 önerileri + Phase 10+ köprüsü.

**Files:**
- `docs/design/implementation-notes/phase9-closeout.md` (yeni)

**Bağımlılık:** Task 1-33.

### Task 35 — Phase 9 manual QA checklist

**Açıklama:** Phase 8 emsali (`phase8-manual-qa.md`). 14-16 senaryo bloku.

**Files:**
- `docs/design/implementation-notes/phase9-manual-qa.md` (yeni)

**Bağımlılık:** Task 34.

**External dependency:** ⚠️ Manuel QA gerçek koşum kullanıcıya bağlı (insan-paralel iş, Phase 8 emsali).

---

## 10. Execution Sırası (önerilen)

```
Faz 1: Foundation
  Task 1 → Task 2 → Task 3 → (Task 4 + Task 5 paralel)

Faz 2: Backend Services
  Task 6 → Task 7 → (Task 8 + Task 9 + Task 10 paralel)
                  → Task 11 → Task 12

Faz 3: API
  Task 13 → Task 14 → Task 15 → Task 16 → Task 17 → Task 18

Faz 4: UI (Phase 8 mikro-batch emsali)
  Task 19 (hooks)
  Task 20 (index)
  Task 21+22+23+24+25 (mikro-batch — ana builder)
  Task 26 (post-submit)

Faz 5: Etsy Integration (paralel UI ile)
  Task 27 → Task 28 → Task 29 → Task 30

Faz 6: Quality Gates
  Task 31 (S8 CTA aktivasyonu)
  Task 32 (E2E)
  Task 33 (test coverage)

Faz 7: Closeout
  Task 34 → Task 35
```

**Mikro-batch fırsatları (Phase 8 emsali):**
- Task 4 + Task 5 (provider abstraction'lar)
- Task 13 + Task 14 + Task 15 (CRUD endpoint'leri)
- Task 21 + Task 22 + Task 23 + Task 24 + Task 25 (ana builder + sub-component'ler)
- Task 27 + Task 28 (OAuth UI + callback)

---

## 11. Human / External Dependency Task'ları

| Task | Dependency | Sahibi |
|---|---|---|
| Task 4 | Etsy API key + secret | Kullanıcı (E1) |
| Task 5 | OpenAI API key | Kullanıcı (E3) — T2 onaylandıktan sonra |
| Task 27 | Etsy sandbox shop | Kullanıcı (E2) |
| Task 28 | OAuth gerçek test (Etsy callback) | Kullanıcı (E1, E2) |
| Task 35 | Phase 9 manual QA gerçek koşum | Kullanıcı (insan-paralel) |

**Phase 8 → Phase 9 köprüsü dependency:**
- Phase 8 manual QA pending (`phase8-manual-qa.md`) — ideal Phase 9 implementation öncesi tamamlanır (E5)
- Sürpriz Phase 8 bug çıkarsa Phase 9 implementation bloklanır

---

## 12. Risk Notları (Task-bazlı)

| Task | Risk | Mitigation |
|---|---|---|
| Task 1 | Mevcut `Listing` legacy data var mı? | DB query: `SELECT count(*) FROM "Listing"` ÖNCE. 0 ise risksiz. |
| Task 4 | OAuth flow ilk kez yazılıyor (T6) | Phase 4 EtsyConnection schema mevcut; sadece flow lazım. Sandbox test öncelikli. |
| Task 5 | AI provider seçimi (T2) belirsiz | Önerilen varsayım OpenAI; provider abstraction sayesinde V2 swap kolay |
| Task 9 | AI provider down / rate limit | Phase 8 emsali submit error inline alert; manuel retry CTA |
| Task 10 | Etsy rate limit + 5xx transient | BullMQ retry + exponential backoff (Phase 8 emsali) |
| Task 12 | Negative library V1 minimal | Hardcoded ~10 madde V1; admin panel V2 |
| Task 17 | Etsy submit gerçek API çağrısı | `ETSY_API_ENABLED` feature flag (T1 mitigation) |
| Task 24 | Readiness V1 soft warn (K3) | UI flag — V1.1'de hard gate'e geçiş kolay |
| Task 31 | Phase 8 S8 CTA aktivasyonu (kontrat dokunulmaz) | Sadece disabled flag kaldırma + onClick — minimal dokunuş |
| Task 32 | E2E Etsy submit scope dışı (Phase 7/8 emsali) | UI smoke yeterli; Etsy real API E2E V2 |

---

## 13. Test Pyramid Hedefi (V1)

Phase 8 emsali sayım:

| Layer | Hedef sayı | Kaynak |
|---|---|---|
| Default suite (unit + integration) | +30 yeni test | Listing services + API endpoints + AI meta + Etsy submit (mocked) |
| UI suite (jsdom + RTL) | +25 yeni test | Listing hooks + UI components |
| E2E suite | +1 senaryo | listings-flow.spec.ts (UI smoke) |

**Phase 8 + Phase 9 toplam tahmin:**
- Default: 1396 + 30 = ~1426
- UI: 846 + 25 = ~871
- E2E: 5 + 1 = 6

---

## 14. Plan Self-Review Checklist (Phase 8 emsali)

Plan finalize edilmeden önce kontrol:

- [ ] Tüm spec maddeleri (design doc §11.1 V1 must-have) bir task'a bağlandı mı?
- [ ] Type consistency: Listing entity field'ları, ListingDraftView shape, ReadinessCheck — tüm task'larda tutarlı mı?
- [ ] Phase 8 contract dokunulmaz (Task 31 sadece S8 CTA flag) — kontrol edildi mi?
- [ ] External dependency'ler (E1-E5) açık işaretlendi mi?
- [ ] K1-K6 kararları "önerilen varsayım" olarak yazıldı mı, kesin gibi değil mi?
- [ ] CLAUDE.md disipline (active publish yasağı, manual onay) tüm task'larda korunuyor mu?

---

## Status

🟡 **Plan taslağı.** Design doc K1-K6 kararları onaylandıktan sonra finalize edilir. Implementation `superpowers:subagent-driven-development` ile yürütülür (Phase 8 emsali — fresh implementer per task + 2-stage review + bağımsız doğrulama).

**Onay sonrası:**
1. Bu plan finalize edilir (`Status: 🟢 approved`)
2. Phase 8 manual QA tamamlanmasını bekle (ideal) veya paralel başla (Phase 8 fix bağımlılığı kabul ederek)
3. Task 1'den başla (Foundation)
