# Phase 9 Listing Builder — Manuel QA Checklist

> **Tarih:** 2026-05-03
> **Phase 9 status:** 🟡 (lokal yüzey doygun, otomasyon gate'leri PASS; manuel QA kullanıcı tarafından adım adım yürütülecek — sonuç bu dosyaya işaretlenecek)
> **HEAD:** `ebd20af`
> **Status doc:** [`./phase9-status.md`](./phase9-status.md)
> **Spec:** [`../../plans/2026-05-02-phase9-listing-builder-design.md`](../../plans/2026-05-02-phase9-listing-builder-design.md)
> **Phase 8 emsali:** [`./phase8-manual-qa.md`](./phase8-manual-qa.md) (Phase 8 manuel QA hâlâ pending — Phase 9 closeout'tan önce kapanmalı)

Bu doküman Phase 9 V1 closeout-prep aşamasının **manuel QA katmanı**.
Subagent / otomasyon tarafından yürütülemez (gerçek tarayıcı + gerçek Postgres
+ MinIO + Phase 8 MockupJob + opsiyonel KIE/Etsy credentials gerektirir).

Aşağıdaki bölümleri sırayla geçin, sonuçları her satırın yanındaki kutuya
işaretleyin (`[x]` yapın). Sürpriz bulgu olursa bu dosyaya `## Bulgular —
YYYY-MM-DD` başlığı altında ekleyin; gerekirse status doc
([`./phase9-status.md`](./phase9-status.md)) drift olarak yansıtın.

**Önemli:** Bu checklist hazırlandığı anda **henüz koşturulmadı**. Tüm
checkbox'lar boş `[ ]`. Kullanıcı koşum sonrası tikleyecek.

---

## Önkoşul env doğrulaması

### Zorunlu (tüm senaryolar için)

- [ ] `docker ps` ile Postgres + Redis + MinIO container'ları RUNNING
- [ ] `npm run dev` başlatıldı (3000 portunda, healthy)
- [ ] `npm run worker` başlatıldı (BullMQ worker logging görünür — Phase 8 mockup render için gerek)
- [ ] `/login` → `admin@etsyhub.local` / `admin12345` ile giriş başarılı
- [ ] En az 1 tamamlanmış MockupJob (`status ∈ {COMPLETED, PARTIAL_COMPLETE}`) Phase 8 yüzeyinden hazır

### Opsiyonel (AI metadata generation testi için)

- [ ] `Settings → AI Mode` ekranında `kieApiKey` doldurulmuş ve kaydedilmiş
  - **NOT:** KIE key yoksa AI generation bölümü "honest fail" path olarak doğrulanır (Bölüm E.1)
  - **NOT:** Provider = KIE Gemini 2.5 Flash (text-only chat/completions)

### Opsiyonel (Etsy submit live success testi için)

- [ ] `.env.local` dosyasına `ETSY_CLIENT_ID`, `ETSY_CLIENT_SECRET`, `ETSY_REDIRECT_URI` eklenmiş ve `npm run dev` restart edilmiş
  - **NOT:** Bu env'ler yoksa Submit honest-fail path olarak doğrulanır (Bölüm G.1) — Phase 9 V1'in beklenen davranışı bu
- [ ] (Eğer credentials varsa) Kullanıcının Etsy hesabı bağlı (DB'de `EtsyConnection` row'u doldurulmuş — V1'de UI yok, manuel `psql` veya OAuth callback flow eksik olduğu için bu adım external dependency)

---

## A. Phase 8 → Phase 9 handoff (S8 → listing draft)

> **Hedef:** Spec §2.1 — canonical akış: tamamlanmış MockupJob'tan listing draft yaratma.
>
> **Hazırlık:** Phase 8 S8 result ekranına git: `/selection/sets/[setId]/mockup/jobs/[jobId]/result`

- [ ] S8 ekranında "Listing'e gönder" CTA görünür ve **enabled** (Phase 8 V1'de placeholder değil; Phase 9 binding aktif)
- [ ] CTA tıklanır → `POST /api/listings/draft` çağrılır (Network tab ile doğrula)
- [ ] Response 202 + `{ listingId }` döner
- [ ] Otomatik redirect: `/listings/draft/[listingId]` sayfasına yönlendirilir
- [ ] Yeni Listing row DB'de yaratıldı (Prisma Studio veya `psql` ile doğrula):
  - [ ] `userId` = current user
  - [ ] `mockupJobId` = source MockupJob.id
  - [ ] `coverRenderId` = MockupJob.coverRenderId (cover invariant taşındı)
  - [ ] `imageOrderJson` snapshot alındı (success render'lar packPosition ASC)
  - [ ] `status: DRAFT`
  - [ ] `submittedAt`, `publishedAt`, `etsyListingId`, `failedReason` hepsi `null`

### A.1 — Cross-user isolation
- [ ] Başka user ile login → aynı `mockupJobId`'yi `POST /api/listings/draft`'a gönder → 404 döner (cross-user 404 disiplini)

### A.2 — Terminal status guard
- [ ] `status: PROCESSING` MockupJob'ı POST'a gönder → 409 (terminal değil)
- [ ] `status: FAILED` (hiç başarılı render yok) MockupJob'ı POST'a gönder → 409

---

## B. Listing draft detay görünümü

> **Hedef:** Spec §8.1.1 — Listing draft detay sayfası (asset + readiness + metadata + pricing + submit).
>
> **Hazırlık:** A bölümünden gelen `/listings/draft/[listingId]` sayfası.

### B.1 — Header
- [ ] Sayfa başlığı: "Listing Taslağı: {title || '(başlıksız)'}"
- [ ] Status satırı: "Status: Taslak • Oluşturuldu: {tarih}" (Türkçe label, status-labels.ts mapping)

### B.2 — AssetSection
- [ ] "Görseller & Dosyalar" başlığı
- [ ] Cover image (sol kolon, turuncu border, "★ COVER" badge)
- [ ] Cover image alt text: "Kapak görseli ({templateName})" (a11y)
- [ ] Diğer image'lar grid'de (packPosition ASC), her birinde "#N" badge (1-indexed)
- [ ] Diğer image'ların alt text'i: "Görsel {N} ({templateName})"
- [ ] Tüm image'lar yüklü (outputKey set) → "✓ ZIP'e hazır" yeşil badge görünür
- [ ] "ZIP İndir" link'i görünür ⚠️ (link mevcut ama route handler henüz yazılmadı — Phase 9.1+; tıklayınca 404 normal)
- [ ] mockupJobId set ise "1 mockup" mavi badge görünür

### B.3 — Hazırlık Kontrolleri (readiness checklist)
- [ ] 6 check görünür: Title, Description, Tags, Category, Price, Cover
- [ ] Her check için yeşil ✓ veya sarı ⚠ icon (aria-hidden)
- [ ] Field name + sr-only "geçti" / "uyarı" suffix (screen reader friendly)
- [ ] Eksik alanlar (örn. başlangıçta hepsi boş) "uyarı" gösterir
- [ ] **Soft warn disipline:** Submit button hâlâ aktif (K3 lock — bloklamaz)

### B.4 — MetadataSection
- [ ] "Başlık & Açıklama" başlığı
- [ ] Title input (placeholder: "Listing başlığı girin", help text "Etsy'de gözükecek ana başlık (140 karaktere kadar)")
- [ ] Description textarea (6 satır)
- [ ] Tags input (comma-separated, counter "X/13 etiket")
- [ ] "Kaydet" button **disabled** (henüz değişiklik yok)
- [ ] "AI Oluştur" button **enabled** + Wand2 icon (Phase 9 V1'de aktif)

### B.5 — PricingSection
- [ ] "Fiyat & Malzemeler" başlığı
- [ ] Price input (number, $ prefix, step 0.01, placeholder "5.99")
- [ ] Materials textarea
- [ ] "Kaydet" button disabled (değişiklik yok)

### B.6 — Submit Action footer
- [ ] "Taslak Gönder" button enabled (DRAFT status)
- [ ] readiness fail varsa sarı uyarı text görünür: "⚠ Bazı hazırlık kontrolleri eksik. Yine de gönderilebilir, ancak Etsy reddedebilir."

---

## C. Listing draft edit + save

> **Hedef:** Spec §6.3 — PATCH /api/listings/draft/[id] + readiness recompute.
>
> **Hazırlık:** B bölümünden devam.

### C.1 — Title save
- [ ] Title input'a "Beautiful Modern Wall Art Print Set" yaz
- [ ] "Kaydet" button enabled olur
- [ ] "Kaydet" tıkla → button "Kaydediliyor…" → success
- [ ] DB'de Listing.title güncellendi (Prisma Studio)
- [ ] Readiness "Title" check yeşil ✓'ya döndü (recompute)
- [ ] Listings index sayfasına git (`/listings`) → title yeni değer ile görünür (cache invalidation)

### C.2 — Description + tags save
- [ ] Description textarea'ya 50+ karakter metin gir
- [ ] Tags input'a 13 tag virgülle gir (örn. "wall art, canvas, modern, abstract, home decor, minimalist, interior design, contemporary, trendy, art print, decoration, living room, gift")
- [ ] Counter "13/13 etiket" gösterir
- [ ] "Kaydet" → success → readiness Description ve Tags yeşil

### C.3 — Price save
- [ ] PricingSection price input'a "29.99" gir
- [ ] "Kaydet" → success (priceCents = 2999 DB'de)
- [ ] Readiness "Price" check yeşil

### C.4 — Strict mode validation
- [ ] Browser DevTools'tan manuel: `fetch("/api/listings/draft/[id]", { method: "PATCH", body: JSON.stringify({ productionPartner: "x" }), headers: {...} })`
- [ ] Response 400 (strict mode: bilinmeyen field reject)

### C.5 — Status guard
- [ ] DB'de listing.status'unu manuel "PUBLISHED"a çek (`psql` veya Prisma Studio)
- [ ] PATCH dene → 409 (NotEditable)
- [ ] DB'de status'u "DRAFT"a geri çek (sonraki testler için)

### C.6 — Cross-user
- [ ] Başka user ile login → URL'de aynı listing id'siyle PATCH dene → 404 (cross-user)

---

## D. Listings index

> **Hedef:** Spec §5.1 — listings index + status filter.
>
> **Hazırlık:** En az 2 listing (1 DRAFT, 1 PUBLISHED) DB'de olsun.

- [ ] `/listings` sayfası açılır
- [ ] Listing card'ları görünür (updatedAt DESC sıralı)
- [ ] Her card'da: cover thumbnail + title + status badge (Türkçe label "Taslak"/"Yayınlanmış"/...)
- [ ] Status filter dropdown'u: All / DRAFT / SCHEDULED / PUBLISHED / FAILED / REJECTED / NEEDS_REVIEW
- [ ] Filter "DRAFT" seçilir → URL `?status=DRAFT` query parametresi eklenir → sadece DRAFT'lar listelenir
- [ ] Filter "All" seçilir → tüm listing'ler görünür
- [ ] Card tıklanır → `/listings/draft/[id]` detay sayfasına yönlendirir
- [ ] Empty state (filter sonucu boş): "Taslak durumda listing yok." + alt text guidance
- [ ] Soft-delete (manuel `deletedAt` set edilirse) → listing index'te gözükmez

---

## E. AI metadata generation (KIE Gemini 2.5 Flash)

> **Hedef:** Spec §6.4 — AI metadata generation.
>
> **NOT:** Bu bölüm KIE key konfigürasyonuna göre 2 path'e ayrılır.

### E.1 — Honest fail (KIE key yok)

> **Önkoşul:** `aiMode.kieApiKey` settings'te boş olmalı.

- [ ] Listing detay sayfasında "AI Oluştur" button tıkla
- [ ] Button "Üretiliyor…" → spinner görünür
- [ ] Network tab: `POST /api/listings/draft/[id]/generate-meta` → response 400
- [ ] UI'da kırmızı alert: "AI üretim başarısız: AI provider configured değil — Settings → AI Mode'dan KIE anahtarı ekleyin"
- [ ] Form alanları **DEĞİŞMEDİ** (title/description/tags eski değerler)
- [ ] `Settings → AI Mode` link'i kullanıcı için açıklayıcı

### E.2 — Live path (KIE key configured)

> **Önkoşul:** `aiMode.kieApiKey` settings'te dolduruldu (Settings → AI Mode'dan).

- [ ] Listing detay sayfasında "AI Oluştur" button tıkla
- [ ] Button "Üretiliyor…" → spinner görünür (~3-10s gerçek KIE call)
- [ ] Network tab: `POST /api/listings/draft/[id]/generate-meta` → response 200
- [ ] Response body: `{ output: { title, description, tags }, providerSnapshot, promptVersion }`
  - [ ] `providerSnapshot` formatı: `gemini-2.5-flash@YYYY-MM-DD`
  - [ ] `promptVersion`: `v1.0`
  - [ ] `output.tags.length === 13`
  - [ ] `output.title.length` 5-140 arası
- [ ] Form alanları otomatik dolduruldu:
  - [ ] Title input AI çıktısıyla değişti
  - [ ] Description textarea AI çıktısıyla değişti
  - [ ] Tags input AI çıktısıyla değişti (comma-separated, 13 tag)
- [ ] Status mesajı görünür: "AI önerisi alanlara yazıldı. İncele ve 'Kaydet' ile kaydet."
- [ ] **Auto-save guard:** Form alanları değiştirilmedi (dirty state OK), ama PATCH henüz çağrılmadı — DB'deki Listing.title hâlâ ESKİ değer
- [ ] Kullanıcı "Kaydet" tıklar → PATCH çağrılır → DB güncellenir
- [ ] AI button tekrar tıklanabilir (yeni üretim) — eski AI çıktısı override edilir (kaydedilmemişse)

### E.3 — Provider hatası
- [ ] (Mocking imkanı yoksa atla) KIE servisi 5xx dönerse → 502 wrap + UI alert "AI üretim başarısız: AI listing metadata üretimi başarısız: ..."

### E.4 — Cross-user
- [ ] Başka user ile login → aynı listing id'siyle generate-meta dene → 404

---

## F. Negative library warnings

> **Hedef:** Spec §7.2 — banned terms guard (V1 soft warn).

- [ ] Listing title'ına "Disney Castle Wall Art" yaz → "Kaydet"
- [ ] Readiness checklist Title check sarı ⚠ olur
- [ ] Mesaj: "Politika uyarısı: 'disney' ..." (negative library match)
- [ ] **Submit button hâlâ aktif** (hard-block YOK — V1 K3 lock soft warn)
- [ ] Title'a "Modern Castle Wall Art" yaz (Disney kaldırıldı) → "Kaydet"
- [ ] Readiness Title check yeşil ✓

---

## G. Submit honest-fail path (Etsy credentials yoksa)

> **Hedef:** Phase 9 V1 sözleşmesi: `ETSY_CLIENT_ID/SECRET/REDIRECT_URI` env yoksa submit endpoint 503 honest fail.
>
> **Önkoşul:** `.env.local`'de Etsy env değişkenleri YOK + `npm run dev` restart sonrası.

### G.1 — Etsy not configured
- [ ] Listing detay sayfası DRAFT status, title/description/price doluysa "Taslak Gönder" button enabled
- [ ] "Taslak Gönder" tıkla → button "Gönderiliyor…" → spinner
- [ ] Network: `POST /api/listings/draft/[id]/submit` → response 503
- [ ] UI'da kırmızı alert: "Gönderme başarısız: Etsy entegrasyonu yapılandırılmadı (ETSY_CLIENT_ID / ETSY_CLIENT_SECRET env yok). Sistem yöneticisinin .env'i tamamlaması gerek."
- [ ] Listing.status DB'de hâlâ DRAFT (FAIL path service'de re-throw, ama 503 öncesi durduğu için DB transaction yok)

### G.2 — Missing fields guard
- [ ] Listing'de title boş bırak → "Taslak Gönder" tıkla
- [ ] Response 422 + body `{ error: "Listing zorunlu alanları eksik: title", details: { missing: ["title"] } }`
- [ ] UI alert: "Gönderme başarısız: Listing zorunlu alanları eksik: title"

### G.3 — Status guard (terminal)
- [ ] DB'de manuel status: "PUBLISHED" çek
- [ ] Detay sayfası refresh → "Taslak Gönder" button **disabled**
- [ ] Yanında muted text: "Bu durumda yeniden gönderilemez (status: Yayınlanmış)."
- [ ] PUBLISHED banner görünür: "Bu listing Etsy'ye gönderildi (Etsy listing ID: ...)" + "Yayına almak için Etsy admin panelinden manuel publish yapılabilir."

### G.4 — FAILED status banner
- [ ] DB'de manuel status: "FAILED" + failedReason: "test failure" çek
- [ ] Detay sayfası refresh → kırmızı banner: "Önceki gönderim başarısız: test failure. Tekrar denenebilir."
- [ ] **NOT:** V1'de FAILED → DRAFT'a geri reset etmek için manuel DB intervention gerek (UI'da "Reset" button yok — V1.1+ carry-forward)

### G.5 — Cross-user
- [ ] Başka user ile login → URL'den aynı listing id'siyle submit endpoint'ine direkt POST → 404

### G.6 — Cache invalidation
- [ ] (G.1 sonrası) Detay sayfasında alert görünürken `/listings` index'e geç
- [ ] Listing card'ında status değişmedi (DRAFT) — submit fail olduğu için doğru
- [ ] (E.2 success path varsa) Submit success sonrası index'te status "Yayınlanmış" badge'e dönüş gözle doğrula

---

## H. Submit success path prerequisites

> **Bu bölüm Phase 9 V1'de TAM tamamlanmamıştır.** Aşağıdaki tüm önkoşullar karşılanmadan submit live success çalışmaz:

### H.1 — External dependency checklist (kullanıcı önkoşulu)

- [ ] `developer.etsy.com` üzerinde app oluşturuldu (V1'de geliştirici tarafından)
- [ ] `ETSY_CLIENT_ID`, `ETSY_CLIENT_SECRET`, `ETSY_REDIRECT_URI` `.env.local`'de set
- [ ] `npm run dev` restart edildi
- [ ] OAuth callback route mevcut (`/api/etsy/oauth/callback/route.ts`) ⚠️ **BU TURDA YOK** (Phase 9.1+)
- [ ] Settings → Etsy bağlantı UI mevcut ⚠️ **BU TURDA YOK** (Phase 9.1+)
- [ ] Kullanıcının `EtsyConnection` row'u DB'de doldurulmuş (accessToken encrypted, shopId set, tokenExpires gelecekte)

### H.2 — V1'de bilinen blocker'lar

- [ ] **Taxonomy mapping:** Submit yapılsa bile provider 422 fırlatır ("taxonomy_id required") — Phase 9.1+ gerek
- [ ] **Image upload:** Submit success olsa bile listing image'sız oluşur (provider'da `uploadListingImage` var ama submit pipeline çağırmıyor) — Phase 9.1+

### H.3 — Honest gözlem (V1 V1.1 carry-forward)

Bu bölüm `[ ]` boş kalır — Phase 9 V1'de submit live success **bilinçli olarak**
külliyen test edilemez. Phase 9 V1 closeout'u **lokal honest-fail path'in
doğrulanmasıyla** tamamlanır; live success Phase 9.1+ kapsamında.

---

## I. Cross-cutting

### I.1 — Cross-user isolation
- [ ] User A login → listing yarattı (id=X)
- [ ] User B login → URL'den `/listings/draft/X` direkt git → 404 (Listing yüklenemedi alert)
- [ ] User B → `/listings` index → User A'nın listing'i görünmez

### I.2 — Soft-delete
- [ ] DB'de manuel `deletedAt` set
- [ ] `/listings` index'te listing kaybolur
- [ ] `/listings/draft/[id]` direkt URL'den 404

### I.3 — TypeScript / build sağlığı
- [ ] `npx tsc --noEmit` → 0 hata
- [ ] `npm run check:tokens` → ihlal yok
- [ ] `npm test` → 1562/1562 pass
- [ ] `npm run test:ui` → 921/921 pass

### I.4 — Tarayıcı uyumluluğu
- [ ] Chrome — listing detay sayfası, AI button, submit button gözle test
- [ ] Safari (opsiyonel) — same
- [ ] Firefox (opsiyonel) — same

### I.5 — Mobile responsive (V1'de optimize değil)
- [ ] DevTools mobile mode (375px) → temel layout breakdown yok
- [ ] **NOT:** Phase 9 V1 mobile-first değil; ciddi UX sorun varsa V2 carry-forward

---

## J. Bilinen V1 sınırları (test ETMEYİN, dokümante edildi)

Bu davranışları test etmek **gerekmez** — Phase 9 V1 sözleşmesinde yer almıyor:

- **Auto-save** — yok (kullanıcı "Kaydet" tıklamak zorunda)
- **OAuth flow UI** — yok (Settings → Etsy bağlantı paneli Phase 9.1+)
- **OAuth callback route** — yok
- **Token refresh worker** — yok (expired token → 401 honest fail)
- **Etsy taxonomy mapping** — yok (provider 422)
- **Image upload pipeline** — yok (listing image'sız oluşur)
- **ZIP download route handler** — yok (`/api/listings/[id]/assets/download` link var ama 404 verir — Phase 9.1+)
- **Listing reset (FAILED → DRAFT)** — yok (manuel DB intervention)
- **Negative library hard-block** — yok (V1 soft warn, K3 lock)
- **Custom mockup/category extension** — Phase 9 V1 tek kategori (canvas), Phase 8 emsali
- **Cost tracking integration** — yok (KIE 1 cent estimate var ama CostUsage tablosuna log akmıyor)

---

## Bulgular

> **Bu bölüm hazırlandığı anda boş.** Manuel QA gerçek koşum sonucu kullanıcı
> bu başlık altına `### YYYY-MM-DD — bulgu özeti` formatında yazsın.
>
> Kategoriler:
> - 🟢 PASS (beklenen davranış)
> - 🟡 NOT (gözlem, V1 sözleşmesi içinde)
> - 🔴 BLOCK (V1'i pas geçirmeyen sürpriz hata)
> - 🔵 V2 (carry-forward önerisi)

_(boş)_

---

## Sonuç

Manuel QA tamamlandığında:
1. Tüm `[ ]` kutuları işaretlenmeli (test edilenler)
2. `[ ]` kalanlar için sebep `## Bulgular` altında belirtilmeli
3. 🔴 BLOCK varsa Phase 9 V1 status `🔴 BLOCK` olarak [`./phase9-status.md`](./phase9-status.md) güncellenmeli
4. Hepsi 🟢 ise Phase 9 V1 status `🟢 PASS` olarak güncellenebilir — **ama** Phase 8 manuel QA da kapanmadan Phase 9 final closeout ilan edilmemeli (Phase 8 V1 hâlâ pending)
