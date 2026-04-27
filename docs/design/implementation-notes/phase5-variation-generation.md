# Phase 5 — Variation Generation Implementation Notes

> **Spec:** [`../../plans/2026-04-25-variation-generation-design.md`](../../plans/2026-04-25-variation-generation-design.md)
> **Plan:** [`../../plans/2026-04-26-variation-generation-plan.md`](../../plans/2026-04-26-variation-generation-plan.md)
> **Tarih:** 2026-04-27
> **Status:** Phase 5 kapanış (17/17 task)

## Bu Tur Tamamlanan

Phase 5 boyunca eklenen ürün capability'leri:

- **Veri modeli (Task 1):** `LocalLibraryAsset` tablosu + `VariationState` enum (Prisma migration). `GeneratedDesign` modeline `aspectRatio` + `quality` alanları eklendi.
- **Image provider abstraction (Task 2):** `ImageProvider` interface (capability-aware), `src/providers/image/registry.ts` registry pattern; R2 + R17.3 sözleşmesi (hardcoded model lookup yasak).
- **kie.ai gpt-image-1.5 entegrasyonu (Task 3):** Gerçek `image-to-image` (i2i) provider; state machine `mapKieState` ile `QUEUED → PROVIDER_PENDING → PROVIDER_RUNNING → SUCCESS|FAIL` dönüşümü.
- **kie-z-image shell (Task 16, Q6 sözleşmesi):** Capability görünür (`text-to-image` only), `generate()` `NotImplementedError` fırlatır. Hardcoded tek-model çözüm reddedildi.
- **Negative library (Task 4, R19):** `NEGATIVE_LIBRARY` hardcoded sabit + `buildImagePrompt` (R18 brief append).
- **Quality score servisi (Task 5, Q1):** Otomatik DPI + Resolution skoru. Manuel review flag (negatif + sebep) AYRI sinyal — birleştirilmez.
- **Local library scan worker (Task 6, Q2):** Root + first-level recursion; `discoverFolders`, hash hesaplama, `ensureThumbnail` (webp Q80, 512×512); TOCTOU hardening (in-flight + atomic rename — bkz. commit `c39dfe6`).
- **URL public check (Task 7, Q5):** Server-side HEAD request, 5dk TTL cache, max 3 redirect, UA `EtsyHub/0.1`. Pattern matching ile sessiz fallback YASAK.
- **User-level settings (Task 8, Q3):** `rootFolderPath`, `targetResolution`, `targetDpi`, `kieApiKey` (encrypted), `geminiApiKey` (encrypted) — store-level override yok.
- **Local library API (Task 9–11):** `/api/local-library/folders`, `/api/local-library/assets`, `/api/local-library/assets/[id]` (DELETE — fs.unlink), `/api/local-library/assets/[id]/negative` (POST), `/api/local-library/url-check`, `/api/local-library/scan`.
- **GENERATE_VARIATIONS worker (Task 10):** State machine, `failDesignAndJob` rollup, manuel retry (R15).
- **Variation jobs API (Task 12 + 12.5):** `POST /api/variation-jobs` (createN), `GET /api/variation-jobs` (list), `POST /api/variation-jobs/[id]/retry`. Atomicity + retry guards + resolver merge (commit `cfb42ce`).
- **`/references/[id]/variations` route + UI (Task 13):** `LocalModePanel` + `AiModePanel` mode switch (default Local — R0); `ConfirmDialog` destructive (Q4 sert uyarı) ve cost confirm (R15); negative ribbon AYRI bölge.
- **AI mode form + cost banner (Task 14):** Slider 1-6 default 3 (R17.4); brief textarea 500 char (R18); URL check banner (Q5); z-image disabled UI (R17.1 — capability mismatch).
- **Settings UI panel'leri (Task 15):** `/settings` sayfasına "Yerel kütüphane" ve "AI Mode anahtarları" panel'leri eklendi. Quality threshold consume (Task 15 carry-forward kapanışı). URL public check status code görünürlüğü (Task 15 carry-forward kapanışı).
- **useReference hook (Task 13+14, Gap A):** Reference detayını UI'dan çekmek için React Query hook'u.
- **Thumbnail GET endpoint (Task 13+14, Gap B):** `/api/local-library/thumbnail?hash=...` — webp thumbnail cache servis route'u.
- **Test paketi (Task 16):** Capability mismatch (R17.1 sessiz fallback YASAK) + z-image shell `NotImplementedError` regresyon koruması.

## Carry-Forward (named — design §10.2 ile senkron)

| # | Carry-forward isim | Sebep |
|---|---|---|
| 1 | `kie-z-image-integration` | 2. model gerçek entegrasyonu — kabuk Phase 5'te, `generate` impl carry-forward |
| 2 | `local-asset-resolution-fix-actions` | Çözünürlük uymayan görsel için upscale/crop aksiyonları |
| 3 | `auto-quality-detection-ocr-bg` | Arka plan + yazı/imza/logo otomatik tespiti — Phase 6 (AI Quality Review) ile gelir |
| 4 | `bulk-delete-local-assets` | Toplu silme (tek tek silme Phase 5'te) |
| 5 | `destructive-typing-confirmation` | Bulk delete + diğer riskli toplu işlemler için typing confirmation (`DELETE yaz`) |
| 6 | `export-zip-split-20mb` | ZIP paketleme + 20 MB sıralı bölme — Selection/Export ekranıyla |
| 7 | `cost-guardrails-daily-limit` | Daily/monthly limit, admin Cost Usage ekranı |
| 8 | `caption-then-prompt-flow` | z-image entegrasyonu sonrası t2i-with-caption akışı UI'ı |
| 9 | `negative-library-admin-screen` | Admin paneli ekranı — hardcoded liste yönetimi UI'a gelir |
| 10 | `local-to-ai-reference-bridge` | Storage bridge / public URL bridge — local diskten AI'ye reference taşıma |
| 11 | `external-source-connector-midjourney` | Midjourney / browser extension / import bridge / source connector |
| 12 | `dpi-resolution-batch-fix` | Quality score'da düşen görselleri batch düzeltme |
| 13 | `local-library-deep-recursion` | Phase 5 root + first-level; daha derin recursion ihtiyacı çıkarsa |
| 14 | `local-library-store-level-override` | Phase 5 user-level; store-level override ihtiyacı çıkarsa |

## Implementation-level Carry-Forward (Phase 5 yürütmesinden)

Phase 5 task'larını uygularken belirlenen, design §10.2'nin dışındaki teknik borçlar. Spec'e değil, kod organizasyonuna ait. Sonraki phase'lerde değerlendirilecek:

| # | Madde | Dosya / Bağlam | Sebep |
|---|---|---|---|
| A | `requireApiKey` env→user-setting injection (Task 12.5) | `src/providers/image/kie/*` — `KIE_AI_API_KEY` env'den okuyor | `kieApiKey` kullanıcı setting'i (Task 8'de tanımlı) provider çağrısına henüz inject edilmiyor; çok kullanıcılı senaryoda her kullanıcı kendi key'i üzerinden çağırmalı |
| B | `buildGenerateVariationsPayload` helper duplication | `createVariationJobs` (POST `/api/variation-jobs`) + retry route (`POST /api/variation-jobs/[id]/retry`) | Payload kurulumu iki yerde tekrar ediyor; tek shared helper'a indirilmeli (default `aspectRatio` `2:3` tek yerde) |
| C | `failDesign` worker + `failDesignAndJob` service merge | `src/features/variation-generation/workers/handle-generate-variations.ts` + `src/features/variation-generation/services/variation-job-service.ts` | İki adet fail rollup helper'ı var; tek shared helper'a indirilmeli |
| D | DELETE unlink-fail integration test | `tests/integration/local-library-api.test.ts` — `DELETE /api/local-library/assets/[id]` | Filesystem `unlink` hatası path'i (file already missing / permission denied) testte kapsanmamış |
| E | `urlPublicCache` LRU TTL-aware eviction | `src/features/variation-generation/services/url-public-check.ts` | Şu an LRU boyut bazlı eviction yapıyor; TTL'i geçmiş entry'ler set dolana kadar dursa da mantıksal olarak `expired` — TTL-aware eviction (lazy purge on insert) sızıntı riskini sıfırlar |
| F | `POLL_INTERVAL_MS` env knob / DI | `src/features/variation-generation/hooks/use-variation-jobs.ts` — UI hook | Şu an sabit 5sn interval; integration test + ileride product feedback için DI/env knob faydalı |
| G | TDD red→green ayrı commit ritmi | Phase 5 plan §1–17 | Phase 5'te task başına tek atomic commit benimsendi (plan'da review için pratik); gelecek phase'lerde kanonik TDD akışı tekrar değerlendirilebilir |
| H | Reference detail page | Phase 6 — şu an sadece reference card'tan `/variations` link var | Reference detayını gösteren ayrı page yok; "Benzerini Yap" akışı bu page olmadan çalışıyor ama reference card → preview/edit/notes UX Phase 6'ya bırakıldı |
| I | ARIA tablist `aria-controls` + `role="tabpanel"` | `src/features/variation-generation/components/variations-page.tsx` (Local / AI Generated tabları) | Tablist var, tab role var, ama `aria-controls` + tabpanel rolü eksik; a11y completeness için Phase 6 stabilization wave'ine alınabilir |
| J | Gap A/B route pattern tutarsızlığı | `/api/references/[id]` (path param) vs `/api/local-library/thumbnail?hash=...` (query param) | Bilinçli tasarım (thumbnail hash-content-addressable, reference id-based) ama tutarlılık notu düşülsün; ileride API style guide oluşturulurken referans |
| K | `ai-mode-panel` form reset useEffect bağımlılığı | `src/features/variation-generation/components/ai-mode-panel.tsx` — Phase 6 | Form state reset davranışı `useEffect` deps array bağlamında stabilization gerektiriyor; küçük UX detayı |
| L | Settings page heading hierarchy | `src/app/(app)/settings/page.tsx` — Phase 6 | `<h1>Ayarlar</h1>` + her panel `<h2>` — yapı doğru ama panel içlerinde `<h3>` boşlukları var; semantik temizlik Phase 6 stabilization wave'ine alınabilir |

## Test Sonuçları

Bu task'ta çalıştırılan full regression (2026-04-27):

| Komut | Sonuç |
|---|---|
| `npm run lint` | ✅ PASS — `✔ No ESLint warnings or errors` |
| `npm run typecheck` | ✅ PASS — `tsc --noEmit` exit 0, hata yok |
| `npm test` (vitest server suite) | ✅ PASS — **59/59 dosya, 430/430 test** (2.55s) |
| `npm run test:ui` (vitest UI suite) | ✅ PASS — **33/33 dosya, 428/428 test** (2.99s) |

**Toplam:** 92 dosya / 858 test PASS. Preexisting flake yok — `api-admin-scraper-config` / `provider-config` / `competitor-service` test'leri bu turda yeşil çalıştı. E2E (`test:e2e` / Playwright) bu task kapsamında çalıştırılmadı.

## Manuel Smoke Sonucu

Dev server otomatik smoke (HTTP düzeyinde, browser etkileşimi olmadan):

**Yapılabildi (otomatik):**
1. ✅ `npm run dev` bootstrap — `Ready in 1167ms`, `http://localhost:3000`
2. ✅ Login akışı (`POST /api/auth/callback/credentials`) — admin (`admin@etsyhub.local` / `admin12345`) ile session token alındı
3. ✅ `/references` sayfa render — "Referans Havuzu" başlığı + HTTP 200
4. ✅ `/settings` sayfa render — "Yerel kütüphane" + "AI Mode anahtarları" panel'leri görünür (Task 15 doğrulandı)
5. ✅ `/references/[id]/variations` sayfa render — geçerli reference id ile HTTP 200, "Local" + "AI Generated" tab'ları görünür (Task 13 doğrulandı)
6. ✅ `/references/nonexistent-id/variations` — beklenen 404 (NotFound) davranışı

**Bloke olunan (UI etkileşimi + dış bağımlılık gerekli):**

Plan §3908–3914 7-adımlı end-to-end smoke'un aşağıdaki adımları **gerçek browser otomasyonu + dış sistemler** olmadan otomatize edilemedi:

| Adım | Sebep |
|---|---|
| 1 — Settings → rootFolderPath kaydet | Form etkileşimi (input + submit) gerekli — curl ile yapılabilirdi ama gerçek bir disk klasörü (örn. `/Users/.../resimler`) seçilmesi gerekiyor |
| 2 — References → reference seç → "Benzerini Yap" | UI link tıklama; reference seed yapıldı + page render doğrulandı, ama akış end-to-end browser ile tamamlanmadı |
| 3 — Local mode → Yenile → folder list + grid | `SCAN_LOCAL_FOLDER` job'u → BullMQ + Redis worker bağımlılığı; gerçek disk klasörü gerekli |
| 4 — Asset Sil → ConfirmDialog → fs unlink | Browser klik etkileşimi gerekli (curl ile DELETE çağrılabilir ama ConfirmDialog UI doğrulaması browser ister) |
| 5 — Negatif işaretle → kart kırmızı şerit | Browser klik etkileşimi (drop-down + reason seçimi) |
| 6 — AI mode → URL check → 3 görsel → ConfirmDialog → grid | **KIE_AI_API_KEY gerçek secret** + Redis worker + kie.ai dış bağımlılığı |
| 7 — FAIL → Yeniden Dene | Adım 6'ya bağımlı |

**Kullanıcı handoff edilecek liste (manuel adımlar):**

1. `npm run db:seed` ile admin user'ın hazır olduğunu doğrula (`admin@etsyhub.local` / `admin12345`)
2. `.env.local`'e gerçek `KIE_AI_API_KEY` set et
3. `npm run dev` + `npm run worker` (worker `tsx watch scripts/dev-worker.ts`) — Redis bağlantısı gerekli
4. Browser'da:
   - `/settings` → Yerel kütüphane: rootFolderPath gerçek disk yolu (test resimleri içeren) kaydet
   - `/references` → bir reference oluştur veya mevcut bir tanesini seç → "Benzerini Yap" link
   - Local mode → "Yenile" butonu → folder list dolar mı, klasöre tıklayınca thumbnail + score badges görünüyor mu kontrol et
   - Bir asset → Sil → ConfirmDialog destructive uyarısını gör → Onayla → diskten silindi mi (FS doğrula)
   - Bir asset → Negatif İşaretle → reason seç (örn. "yazı/imza var") → kartta kırmızı şerit görünüyor mu
   - AI Generated mode → URL check banner → form'u doldur (3 görsel, brief'i 100 char) → ConfirmDialog cost notice → Onayla → grid'de QUEUED → SUCCESS / FAIL terminal state
   - FAIL durumunda "Yeniden Dene" → yeni job kuyruğa giriyor mu

## Bilinen Sınırlar

- **kie.ai fiyat bilinmiyor:** Cost banner placeholder ile başlıyor ("Doğrulanmamış maliyet" notu). İlk gerçek çağrılarla observability üzerinden fiyat çıkarılacak.
- **AI mode local kaynaklı reference desteklemiyor (R17.2):** Bilinçli kapsam dışı. Local diskten AI'ye köprü için `local-to-ai-reference-bridge` carry-forward (#10).
- **Bulk delete yok:** Tek tek silme Phase 5'te. Toplu silme `bulk-delete-local-assets` carry-forward (#4).
- **Otomatik OCR / background detection yok:** Phase 6 (AI Quality Review) ile gelir — `auto-quality-detection-ocr-bg` carry-forward (#3). Quality score Phase 5'te yalnız DPI + Resolution objektif sinyali; yazı/imza tespiti negatif işareti üzerinden manuel.

## Kontrat — sonraki turlar için kilitli

Aşağıdaki sözleşmeler Phase 5'in **bağlayıcı** çıktısıdır. Sonraki phase'ler bunlara dokunmadan üzerine inşa eder:

- **`ImageProvider` interface** (`src/providers/image/types.ts`) — capability-aware. Yeni model eklerken interface aynı kalır; `capabilities` field'ı (`text-to-image` / `image-to-image` / both) ile registry'ye girer.
- **Provider registry** (`src/providers/image/registry.ts`) — hardcoded model lookup **YASAK**. Tüm model dispatch registry üzerinden.
- **`VariationState` transitions** — `QUEUED → PROVIDER_PENDING → PROVIDER_RUNNING → SUCCESS|FAIL`. Uncontrolled state transition yok.
- **`promptSnapshot` + `briefSnapshot` lock** — CLAUDE.md snapshot kuralı: bir job başladıktan sonra setting değişiklikleri retroaktif uygulanmaz. Bu lock kırılamaz.
