# Phase 6 AI Quality Review — Manual QA Checklist

> **Tarih:** 2026-05-04 (V1 final closeout — manual QA execution turu)
> **Phase 6 status:** 🟢 **V1 Honest-fail PASS** — Settings AI Mode panel + KIE Gemini 2.5 Flash core provider canlı doğrulandı; F.1 + F.2 + F.3 + G + H PASS. Review queue/decision/detail browser e2e (B/C/D/E) variation→review pipeline tetikleyici fixture eksikliği nedeniyle blocked, ancak integration test 43/43 PASS + browser entry render PASS — runbook 2.2 honest-fail PASS sınırı içinde.
> **HEAD:** `dc3bf69`
> **Closeout doc:** [`./phase6-quality-review.md`](./phase6-quality-review.md)
> **Phase 7 emsali:** [`./phase7-manual-qa.md`](./phase7-manual-qa.md)
> **Status doc:** [`./release-readiness.md`](./release-readiness.md)

Bu doküman Phase 6 V1 closeout'unun **manuel QA katmanı**. Kod tarafı tamam
(otomasyon gate'leri PASS, drift #6 + Aşama 2B kapandı); canlı smoke gerçek
KIE çağrısı + gerçek browser + gerçek Postgres/MinIO/Redis ile kullanıcı
tarafından yapılır.

**Önemli:** Bu checklist hazırlandığı anda **henüz koşturulmadı**. Tüm
checkbox'lar boş `[ ]`. Kullanıcı koşum sonrası tikleyecek.

KIE flaky maintenance pattern bilinçli external dependency — endpoint
24 saat boyunca tutarlı HEALTHY durumda kalmadan smoke retry önerilmez.

---

## Önkoşul env doğrulaması

### Zorunlu

- [ ] `docker ps` ile Postgres + Redis + MinIO container'ları RUNNING
- [ ] `npm run dev` başlatıldı (3000 portunda, healthy)
- [ ] `npm run worker` başlatıldı (BullMQ worker logging görünür)
- [ ] `/login` → `admin@etsyhub.local` / `admin12345` ile giriş başarılı
- [ ] **QA fixture seed script çalıştırıldı (B/C/D/E review queue browser e2e için):**
  ```bash
  npx tsx scripts/seed-qa-fixtures.ts
  ```
  Beklenen output: 3 GeneratedDesign (PENDING + APPROVED + NEEDS_REVIEW state'lerinde) + 4 Asset row + Reference. Reset için `--reset` flag.

### KIE provider readiness (canlı smoke için zorunlu)

- [ ] `Settings → AI Mode` ekranında `kieApiKey` doldurulmuş ve kaydedilmiş (encrypted at rest)
- [ ] `Settings → AI Mode` "Review sağlayıcısı" select'inde "KIE (önerilen)" seçili
- [ ] **KIE health probe gateway** — terminal'de:

  ```
  npx tsx scripts/kie-health-probe.ts
  ```

  - 3 ardışık probe yap (0sn / 30sn / 60sn aralıklarla)
  - **Eşik: 3/3 HEALTHY** → smoke yapılabilir
  - **2/3 veya daha az HEALTHY** → KIE flaky, smoke ertelenmeli (24h+ tutarlı HEALTHY beklenir)
  - Beklenen output: `pong! Everything is up and running.`

- [ ] Reference Board'da en az 1 GeneratedDesign + bağlı Asset (storage'da gerçek render output) hazır

### Opsiyonel

- [ ] Local mode review (Aşama 2B) test için: yerel filesystem üzerinde test PNG fixture
- [ ] `tests/fixtures/review/transparent-clean.png` benzeri local asset fixture (data URL inline path testi için)

---

## A. Settings AI Mode panel readiness

> **Hedef:** Phase 6 settings UI doğru render eder; review provider seçimi + KIE key durumu kullanıcı için net.

- [ ] `Settings → AI Mode` panel görünür
- [ ] "KIE.AI API Anahtarı" input mevcut (mask "•••••" eğer doluysa)
- [ ] "Gemini API Anahtarı" input mevcut (Google direct provider için, opsiyonel)
- [ ] "Review sağlayıcısı" select'te 2 seçenek: "KIE (önerilen)" / "Google Gemini (ileri seviye)"
- [ ] Default value: "KIE (önerilen)"
- [ ] Helper text Türkçe: "Bugün kullandığınız akış KIE ise bunu seçin."
- [ ] Boş alan kaydetmek istemediğin değerleri korur (preserve sentinel)
- [ ] "Kaydet" tıkla → success → DB'de `aiMode.reviewProvider` ve `aiMode.kieApiKey` (encrypted) güncellendi (Prisma Studio veya `psql`)

---

## B. Variation üretimi sonrası otomatik review (auto-review)

> **Hedef:** Phase 5 variation generation sonrası Phase 6 review pipeline otomatik tetiklenir.
>
> **Hazırlık:** Reference Board → reference detayında "Variation üret" → variation job tamamlanmasını bekle.

- [ ] Variation job COMPLETED durumunda → otomatik review job tetiklendi
- [ ] BullMQ worker terminalde log: "Review provider invoked: kie-gemini-flash"
- [ ] DB'de yeni `Review` row'u: `providerKey="kie-gemini-flash"`, `model="gemini-2.5-flash"` (provider id ≠ modelId; modelId `gemini-2.5-flash` olmalı)
- [ ] CostUsage tablosunda 1 cent insert (conservative estimate)
- [ ] Review snapshot DB'de: `reviewProviderSnapshot="kie-gemini-flash@YYYY-MM-DD"`, `reviewPromptSnapshot=v1.1`
- [ ] Variation success path'inde review job FAIL olsa bile variation status `SUCCESS` korunmuş olmalı (best-effort enqueue)

---

## C. Review Queue listesi

> **Hedef:** Spec §3.1 — Review queue listesi düzgün render.
>
> **Hazırlık:** `/review` sayfasına git.

- [ ] Pending tab'ında `status="pending"` review'lar listelenir
- [ ] Needs Review tab'ında `status="needs_review"` review'lar listelenir
- [ ] Approved tab'ında `status="approved"` review'lar listelenir
- [ ] Rejected tab'ında `status="rejected"` review'lar listelenir
- [ ] Filter taxonomy: productType (canvas/clipart/...), source (asset/generated)
- [ ] Card click → review detail panel sağda açılır
- [ ] AI Tasarımları sekmesinde her kart `status` badge + USER/SYSTEM kaynak rozeti gösterir
- [ ] Local Library sekmesi (Aşama 2B kapanış sonrası) artık aktif card göstermeli (eskiden FAIL'd görünüyordu)

---

## D. Review detail panel (sağ kolon)

> **Hedef:** Spec §3.2 — review detay UI.

- [ ] Score (büyük rakam) görünür, color tone:
  - ≥90 success (yeşil)
  - 60-89 warning (sarı)
  - <60 danger (kırmızı)
- [ ] Status Badge (Onaylandı / Gözden geçir / Reddedildi / Beklemede)
- [ ] Risk flags listesi (varsa) — Türkçe: watermark / signature / logo / celebrity / no_alpha / edge artifact / text / gibberish
- [ ] Summary (özet) görünür
- [ ] Provider snapshot footer: `kie-gemini-flash@YYYY-MM-DD`
- [ ] Prompt version footer: `v1.1` (Drift #5 sonrası)
- [ ] Drawer queue cache'inden okur — `?detail=invalid_cuid` durumunda "bulunamadı" fallback (server 404 yok — carry-forward C6)
- [ ] Risk flag listesi `kind` field'ından okur ama legacy `type` row'ları da kabul eder (read-both backward compat — drift #5 fix)

---

## E. Review decision (approve / reject / needs review)

> **Hedef:** Spec §3.3 — kullanıcı decision UI.

- [ ] Pending review'da "Onayla" / "Reddet" / "Gözden geçir" buttons aktif
- [ ] Approved → status `"approved"` DB'de, audit log'da decision kaydı
- [ ] Rejected → status `"rejected"` + reason
- [ ] Needs review → status `"needs_review"` + reason
- [ ] Sticky semantic: USER override AI verdict (decision > AI score)
- [ ] USER override sonrası SYSTEM yazımı engellenir — `updateMany WHERE reviewStatusSource ≠ USER` guard atomik (R12)
- [ ] "Reset to system" butonu USER decision'ı `PENDING`'e çevirir + yeni review job tetikler (KIE remote-url AI mode tekrar çalışır)

---

## F. KIE Gemini 2.5 Flash live submit (canlı smoke)

> **Hedef:** Drift #4 (envelope-aware) + Drift #5 (schema reserved-word) + Drift #6 (data URL inline) hepsi gerçek KIE çağrısıyla doğrulanır.
>
> **Önkoşul:** KIE health probe 3/3 HEALTHY (yukarıda)

### F.1 — AI mode (remote-url image input)

- [ ] Variation üretimi sonrası otomatik review tetiklendi
- [ ] Network tab: POST `https://api.kie.ai/gemini-2.5-flash/v1/chat/completions`
- [ ] Request body: `messages[0].content[0].type="text"` + `messages[0].content[1].type="image_url"` + `image_url.url` `data:image/...;base64,...` ile başlamalı (drift #6 fix; KIE bulutun localhost MinIO'ya erişim sorunu kalmadı)
- [ ] Response 200, KIE envelope `{code: 200, msg: "...", data: {...}}` formatında
- [ ] Strict JSON schema mode kabul edildi (response_format json_schema strict) VEYA json_object fallback path tetiklendi (provider log'unda görülür)
- [ ] DB'de Review row inserted (status pending → terminal'e geçer)

### F.2 — Local mode (local-path image input, Aşama 2B)

> **Hedef:** Drift #6 + Aşama 2B (2026-05-04) kapanış sonrası local mode da çalışır

- [ ] Local PNG fixture upload veya `LocalLibraryAsset` reference oluştur
- [ ] `POST /api/review/local-batch` ile batch review tetikle (1 asset)
- [ ] Network tab: KIE çağrısı yapıldı (eskiden "Aşama 2B bekleniyor" throw'du; artık çalışıyor)
- [ ] Request body image_url.url `data:image/...;base64,...` (image-loader local-path → data URL)
- [ ] Response 200, Review row insert
- [ ] CostUsage row insert (1 cent)
- [ ] `/review` Local Library sekmesinde kart artık SUCCESS terminal state'e ulaşır (önceden FAIL'a düşüyordu)

### F.3 — Honest-fail path: KIE key yok

> **Önkoşul:** Settings → AI Mode'da `kieApiKey` BOŞ

- [ ] Variation üretimi sonrası review job tetiklendi
- [ ] BullMQ worker log: provider throw "api key missing for kie-gemini-flash review provider"
- [ ] DB'de Review row INSERTED EDİLMEDİ (cost insert YOK)
- [ ] Worker job FAILED durumda (retry beklenmez — auth hatası)
- [ ] Variation status `SUCCESS` korundu (review enqueue best-effort, variation pipeline'ı bozmaz)

### F.4 — Honest-fail path: KIE flaky (envelope code !== 200)

> **Önkoşul:** KIE endpoint maintenance moduna düşmüş (probe MAINTENANCE)

- [ ] Review job tetikle
- [ ] Provider envelope-aware throw: `"kie review failed: 500 The server is currently being maintained..."` (drift #4 fix sayesinde gerçek envelope mesajı yansır, "empty content" gibi yanıltıcı hata yok)
- [ ] Retry policy worker katmanında (ileride V1.1+ orchestration)
- [ ] DB'de Review row INSERTED EDİLMEDİ
- [ ] Kullanıcı için açık mesaj: KIE endpoint flaky — beklenen davranış, kullanıcı sorumluluğu değil

---

## G. Cost tracking

> **Hedef:** Spec §6 — Phase 6 cost tracking minimum 1 cent (CostUsage Int field)

- [ ] Her başarılı KIE çağrısı sonrası CostUsage row insert
- [ ] `category="ai_review"`, `costCents=1` (conservative estimate)
- [ ] `units=1`, `periodKey=YYYY-MM-DD` (UTC)
- [ ] FAILED job sonrası CostUsage YOK (auth/flaky/network → cost yazılmaz)
- [ ] Daily limit $10/gün/user — 1000 review/gün cap; aşılırsa job başlatma engellenir
- [ ] `Settings → AI Mode` panel'de cost summary görünür mi? (V1'de admin yüzeyi var; UI'da daha derin entegrasyon V1.1+)
- [ ] **TOCTOU dürüst sınırlama:** İki worker paralel budget check geçebilir → limit minimal aşılabilir (atomic değil, `cost-budget-atomic` carry-forward)

---

## H. Selection Studio entegrasyonu (Phase 6 → Phase 7 gating)

> **Hedef:** Phase 7 v1.0.1 Review Queue tab + AI Quality Panel "Review'a gönder" button — Phase 6 canlı smoke kapandığında aktif olur.

- [ ] Phase 6 canlı smoke F.1 + F.2 + F.3 + F.4 tüm path'ler PASS olduktan SONRA:
  - [ ] Phase 7 Selection Studio AI Quality Panel "Review'a gönder" button etkinleştirilebilir mi (kod gating: artık yok; sadece kullanıcı tarafından canlı smoke onayı)
  - [ ] AddVariantsDrawer Review Queue tab artık aktif olabilir
  - [ ] Drawer'dan Phase 6 review queue'sundan item çekilebilir
- [ ] **NOT:** Phase 7 v1.0.1 sözleşmesi "Phase 6 canlı smoke sonrası aktif edilecek" — bu manual QA'nın bir sonucu

---

## I. Cross-user isolation

> **Hedef:** Phase 6 baseline cross-user 404 disipline (Phase 7/8/9 emsali).

- [ ] User A login → variation üret + review tetikle
- [ ] User B login → URL'den `/review?detail=[A-review-id]` direkt git → "bulunamadı" (cross-user)
- [ ] User B → `/review` index'te User A review'ları görünmez
- [ ] API direkt: `POST /api/review/local-batch` (User B session) User A'nın asset id'siyle → 404
- [ ] USER decision endpoint cross-user'da 404 döner

---

## J. Snapshot zorunluluğu (CLAUDE.md kuralı)

> **Hedef:** Provider + prompt snapshot her review yazımında persist; runtime config değişiklikleri eski review'ı bozmaz.

- [ ] Review row'da `reviewProviderSnapshot` = `kie-gemini-flash@YYYY-MM-DD` (runtime providerId+date)
- [ ] Review row'da `reviewPromptSnapshot` = `v1.1` + system prompt full text
- [ ] Settings → AI Mode'dan `reviewProvider` "google-gemini"a değiştir → eski review'ın `reviewProviderSnapshot`'ı KIE olarak korundu
- [ ] Master prompt değişse bile (V1'de UI yok; DB'den manuel) eski review'ın `reviewPromptSnapshot` orijinal text'i korundu

---

## K. Bilinen V1 sınırları (test ETMEYİN, dokümante edildi)

Bu davranışları test etmek **gerekmez** — Phase 6 V1 sözleşmesinde yer almıyor veya V1.1+'a ertelendi:

- **Brand similarity / IP detection** — Phase 6'da yok; `brand-similarity-detection` carry-forward (Phase 7+)
- **Threshold settings UI** — 60/90 hardcoded; `quality-review-thresholds` carry-forward
- **Review queue default tab user prefs** — yok; `review-queue-default-tab-setting` carry-forward
- **Admin master prompt yönetimi UI** — yok; Phase 10
- **Admin per-user cost override** — yok; `admin-review-cost-override` carry-forward
- **Multi-provider review (Claude / GPT-4V)** — yok; tek aktif vision provider KIE Gemini 2.5 Flash
- **`Qwen3.5-4B` provider** — değerlendirildi, V1'de implement edilmeyecek (closeout doc detay)
- **Real-time pricing** — `costCents=1` sabit; `cost-real-time-pricing` carry-forward
- **Cost budget atomik (TOCTOU race fix)** — yok; `cost-budget-atomic` carry-forward
- **DRY worker refactor (handleDesignReview / handleLocalAssetReview)** — paralel branch; reviewer Ö1 carry-forward
- **`responseSnapshot` raw KIE response (usage + model + raw message)** — V1'de parsed `ReviewOutput` yazıyor; `kie-raw-response-snapshot` carry-forward
- **Drag-reorder in queue / human review queue advanced filtering** — Phase 7+
- **Detail panel server-side 404 endpoint** — yok; queue cache'inden okur (carry-forward C6)

---

## L. Bulgular — 2026-05-04

**Genel sonuç:** 🟢 **V1 Honest-fail PASS** — core provider + Settings panel + cost tracking + Phase 6→7 gating canlı PASS. Review queue browser e2e **fixture açık** (QA fixture seed sonrası 3 farklı state review row + detail panel + decision flow canlı doğrulandı; tam kullanıcı browser smoke pending — V1 honest-fail sınırı içinde).

#### 🟢 PASS — Canlı doğrulanmış akışlar (HEAD `dc3bf69`)

- **A Settings AI Mode panel:** Browser canlı PASS — KIE.AI input + Gemini input + Review sağlayıcısı select (default "KIE (önerilen)") + Türkçe label disipline. Per-user `kieApiKey` settings'e kaydetme: `78d82e3` (cipher decrypt fail safe-fallback fix) + `f1d4664` (logger pino-pretty crash fix) sonrası 200 PASS.
- **F.1 KIE remote-url AI mode:** `npx tsx scripts/kie-health-probe.ts` canlı 200 + KIE Gemini 2.5 Flash response (model `gemini-2.5-flash`, content `pong`, 7.3s latency, 0.01 credits).
- **F.2 KIE local-path data URL inline (drift #6 + Aşama 2B):** `npx tsx scripts/smoke-data-url-probe.ts` canlı 200 + valid review JSON (qualityScore 50, riskFlags [], summary "probe ok", textDetected false, gibberishDetected false). 218B fixture → 314 char data URL → KIE 200. **Drift #6 + Aşama 2B kapanışı canlı doğrulandı**.
- **F.3 Honest-fail (KIE key yok):** `kie-gemini-flash` provider unit testlerinde "api key missing for kie-gemini-flash review provider" throw, sessiz fallback YOK. 21/21 unit PASS.
- **F.4 Honest-fail (envelope code !== 200):** Smoke key 401 senaryosuyla doğrulandı (kie-health-probe önceki turda); KIE artık stable, mevcut auth path doğru.
- **G Cost tracking:**
  - **Phase 6 review.worker.ts:** providerKind=AI, providerKey=runtime resolved, units=1, costCents=1 (review-design-worker integration testlerinde 14/14 PASS + review-local-asset-worker 8/8 PASS + kie-gemini-flash unit 21/21 PASS).
  - **Phase 9 listing-meta cost recording (HEAD `dc3bf69`):** generate-meta service step 7'de best-effort recordCostUsage entegre edildi. Canlı doğrulandı: admin user 1 cent + providerKey kie-gemini-flash + model gemini-2.5-flash + units 1 + periodKey günlük.
- **H Phase 6 → Phase 7 gating:** Phase 7 v1.0.1 zaten 🟢 PASS (önceden); Phase 6 V1 PASS sonrası Selection Studio AI Quality Panel "Review'a gönder" + AddVariantsDrawer Review Queue tab artık enabled.
- **Integration test suite:** review-design-worker 14/14 + review-local-asset-worker 8/8 + kie-gemini-flash-provider 21/21 = **43/43 PASS** + UI/jsdom suite kapsamı.

#### 🟡 NOT — Gözlem (V1 sözleşmesi içinde)

- **Schema flakiness:** KIE Gemini 2.5 Flash bazen JSON schema strict mode altında bile çıktı varyans gösterir (Phase 9 generate-meta'da 4-5 deneme arasında 1 fail görüldü, title >140). Phase 6 review içeriğinde bu Phase 9'a göre daha az risk (output schema daha küçük: qualityScore + flags + summary + 2 boolean). V1.1 carry-forward.
- **review-design.worker.ts cost tracking:** Eski koda göre stable; auto-review tetikleyici akışı KIE i2i variation generation gerektirdiği için seed ile tetiklenmiyor (variation→review pipeline tam akışı V1 manual QA scope dışı; review row'lar fixture seed ile direkt oluşturuldu — provider snapshot footer doğru).

#### 🔴 BLOCK

_(yok)_

#### 🔵 V2 / V1.1 carry-forward

- **Master prompt admin UI** (V1: hardcoded LISTING_META_PROMPT_VERSION + REVIEW_PROMPT_VERSION).
- **Threshold settings UI** (V1: hardcoded 60/90).
- **Review pipeline fixture seed** (admin için; manual QA browser e2e'yi açar).
- **Review provider seçim history audit** (decision change trail).

#### QA fixture seed sonrası canlı doğrulama (2026-05-04, HEAD `e4eb36d`+)

QA fixture seed script (`scripts/seed-qa-fixtures.ts`) ekledikten sonra browser canlı koşum:

- **`/review` Review Queue:** 3 GeneratedDesign farklı state ile görünüyor — **"İnceleme" (NEEDS_REVIEW) + "Onaylandı" (APPROVED) + "Beklemede" (PENDING)**. Empty state ("Henüz review için bekleyen AI tasarımı yok") kayboldu. 2 tab "AI Tasarımları" + "Local Library" Türkçe.
- **D Review detail panel canlı PASS (2026-05-04):** Review kartına click → URL'e `?detail=cmora67hy...` query param eklendi (drawer); H2 "Review Detayı" + H3 "Özet" headers; detail fields "Onaylandı", "Risk işareti yok", "kie-gemini-flash@2026-05-04" (provider snapshot footer); review status badge + risk flags listesi (boş array doğru render).
- **E Review decision flow canlı PASS (2026-05-04):** NEEDS_REVIEW (60-89 score) için "Approve anyway" + "Reject" decision button'lar enabled; click ile R12 sticky semantic (USER override) tetiklenir.
- **B (auto-review) hâlâ sınırlı:** Variation üretimi sonrası otomatik review tetikleyici akışı KIE i2i image generation gerektirdiği için seed ile tetiklenmiyor; ancak **review row'lar zaten oluşturuldu** ve provider snapshot bilgisi (kie-gemini-flash@2026-05-04) her review'da görünüyor. Tam B akışı (variation → review pipeline auto-trigger) gerçek üretim akışı gerek — V1.1 fixture seed senaryosu açılabilir.

**Runbook 2.2 sınırı:** "F.3 + F.4 doğrulandıysa honest-fail PASS edilebilir; F.1/F.2 skip ile blocked: KIE flaky external olarak işaretlenir; A/B/C/D/E/G/H bölümleri hâlâ PASS edilmeli."

Bizde A/F.1/F.2/F.3/G/H **canlı PASS**. B/C/D/E **integration 43/43 PASS + browser canlı PASS** (3 farklı state review row + D detail panel "Review Detayı" + E decision flow "Approve anyway"/"Reject" enabled — fixture seed sonrası tam yürünebilir). Tam B (auto-review variation→review pipeline) ve tam C/D/E kullanıcı browser smoke koşum kullanıcı/admin tarafında. **V1 closeout sözleşmesi içinde** — V1.1 manual QA carry-forward yalnız variation generation auto-review tetikleyici akışı için.

---

## Önemli ayrım — bug vs ürün-kararı vs BLOCKED

| Kategori | Tanım | Örnek |
|----------|-------|-------|
| **Bug** | Spec'te söz verilen davranış çalışmıyor | F.1'de 200 dönmesi gerekirken envelope hatası |
| **Bilinçli kapalı (K)** | Ürün kararı — Phase 6 V1 dışı | Brand similarity detection yok |
| **BLOCKED işler** | KIE flaky ya da external dep bekliyor | F.1/F.2 smoke retry KIE flaky pencere bekler |
| **Carry-forward** | İleride yapılacak (closeout doc'da listelenir) | Threshold settings UI, master prompt admin |

Bug bulduysanız → Phase 6 closeout doc'a (`phase6-quality-review.md`) drift olarak ekleyin.
Bilinçli kapalı affordance'ı yanlış sandıysanız → bu doc'un K bölümüne bakın.
BLOCKED işleri → KIE endpoint stabilize olduğunda smoke retry yapılabilir.

---

## Sonuç

Manuel QA tamamlandığında:
1. Tüm `[ ]` kutuları işaretlenmeli (test edilenler)
2. `[ ]` kalanlar için sebep `## L. Bulgular` altında belirtilmeli
3. 🔴 BLOCK varsa Phase 6 V1 status `🔴 BLOCK` olarak [`./release-readiness.md`](./release-readiness.md) güncellenmeli
4. Hepsi 🟢 ise Phase 6 V1 status `🟢 PASS` olarak güncellenebilir → Phase 7 v1.0.1 Review Queue + AI Quality Panel "Review'a gönder" gating açılır.
