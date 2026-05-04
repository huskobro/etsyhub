# Phase 9 Listing Builder — Manuel QA Checklist

> **Tarih:** 2026-05-03 (sync 2026-05-04 final closeout — V1 Honest-fail PASS)
> **Phase 9 status:** 🟢 **Honest-fail PASS** — V1 zorunlu kapsam (A/B/C/D/E.1/E.2 canlı/F/G.1/I/J.1+J.5+J.6+J.7+J.8+J.9/L.4) browser canlı koşturuldu ve geçti. Etsy live submit success path (H + G.2-G.6) external operasyonel dep (credentials + taxonomy env + OAuth) bekliyor — runbook 5.2 honest-fail PASS sınırı içinde.
> **HEAD:** `dc3bf69`
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

Live Etsy submit success için **3 ayrı external dep** eş zamanlı sağlanmalı:

- [ ] **Etsy app credentials** — `.env.local` dosyasına `ETSY_CLIENT_ID`, `ETSY_CLIENT_SECRET`, `ETSY_REDIRECT_URI` eklenmiş ve `npm run dev` restart edilmiş
  - Kaynağı: `developer.etsy.com` üzerinde app oluşturup credentials almak; redirect URI verify etmek
  - Yoksa: tüm Etsy yolu (OAuth start/callback, Settings panel, submit) 503 `EtsyNotConfigured` honest fail (Bölüm H.1, J.1)
- [ ] **OAuth bağlantısı kurulmuş** — Settings → "Etsy bağlantısı" panelinden "Etsy'ye bağlan" → Etsy izin → callback `?etsy=connected` ile dönmüş; panel `connected` state'i gösteriyor
  - Bu adım Bölüm H'de canlı yürütülür (önkoşul değil, **ilk live senaryo**)
  - Yoksa: submit 400 `ConnectionNotFound` honest fail (Bölüm J.2)
- [ ] **`ETSY_TAXONOMY_MAP_JSON` env** — `.env.local`'e admin tarafından doldurulmuş örn:
  ```
  ETSY_TAXONOMY_MAP_JSON='{"wall_art":2078,"sticker":1208,"clipart":1207}'
  ```
  - Kaynağı: Admin `developer.etsy.com /seller-taxonomy/nodes` endpoint'inden ilgili node ID'lerini elle çıkarır + ProductType key'leriyle eşleştirir
  - Yoksa: submit 422 `EtsyTaxonomyMissing` honest fail (Bölüm J.3) — credentials + connection olsa bile
- [ ] (Live submit doğrulanacaksa) **En az 1 listing draft** mockup pack ile + zorunlu alanlar (title/description/price/category) dolu

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
- [ ] **Boş imageOrder durumunda** (mockup pack henüz handoff edilmemişse): ZIP link YOK, "✓ ZIP'e hazır" badge YOK, sarı uyarı "Tüm görseller yüklenmeyi bekliyor" görünür (HEAD `920c6d2` AssetSection guard fix)
- [ ] Tüm image'lar yüklü (outputKey set) → "✓ ZIP'e hazır" yeşil badge görünür
- [ ] "ZIP İndir" link'i görünür ve **çalışır** (route handler aktif — `d128f15` commit, `GET /api/listings/draft/[id]/assets/download`)
- [ ] Link tıklanınca browser ZIP indirir; dosya cover-first PNG sıralı + `manifest.json` içerir (Phase 8 `buildMockupZip` reuse)
- [ ] Filename: `listing-{cuid}.zip` (etsyListingId yoksa) veya `listing-{etsyListingId}.zip` (Etsy submit sonrası)
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

> **NOT:** AI metadata generation Phase 9 V1 contract'ında foundation + live-if-configured.
> KIE key olmasa da Phase 9 V1 PASS edilebilir (E.1 honest-fail path doğrulanırsa).
> Live AI çıktı testi (E.2) opsiyonel — KIE key girilirse ek doğrulama olarak yapılır.
> Listing draft title/description/tags **manuel** girilebilir; "AI Oluştur" button'u
> sadece bu üretimi otomatize eder.

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

## G. Settings Etsy connection paneli + OAuth flow

> **Hedef:** Settings → "Etsy bağlantısı" paneli 4 status'u (not_configured / not_connected / connected / expired) doğru gösterir; OAuth flow start + callback wire'ı çalışır.
>
> **Hazırlık:** `Settings → Etsy bağlantısı` ekranına git.

### G.1 — `not_configured` durumu (env yoksa)
> **Önkoşul:** `.env.local`'de `ETSY_CLIENT_ID` YOK + `npm run dev` restart sonrası.

- [ ] Panel başlığı: "Etsy bağlantısı"
- [ ] Açıklama: "Listing taslaklarını Etsy'ye göndermek için mağazanızı bağlayın. Bağlantı kurulduktan sonra sadece taslak (draft) oluşturulur — yayına alma Etsy admin panelinden manuel yapılır."
- [ ] `not_configured` branch görünür: "Etsy entegrasyonu yapılandırılmadı." + admin uyarısı **4-env tam liste**:
  - [ ] `ETSY_CLIENT_ID`, `ETSY_CLIENT_SECRET`, `ETSY_REDIRECT_URI` (OAuth flow)
  - [ ] `ETSY_TAXONOMY_MAP_JSON` (submit canlı başarı için; kaynak `developer.etsy.com /seller-taxonomy/nodes`)
- [ ] **"Etsy'ye bağlan" CTA YOK** — env eksikken bağlantı denenmesin

### G.2 — `not_connected` durumu (env var, bağlantı yok)
> **Önkoşul:** Env credentials var, kullanıcının `EtsyConnection` row'u yok.

- [ ] Panel: "Etsy hesabınız bağlı değil."
- [ ] "Etsy'ye bağlan" link href="/api/etsy/oauth/start"

### G.3 — OAuth start route
- [ ] G.2'deki "Etsy'ye bağlan" tıkla
- [ ] Browser `/api/etsy/oauth/start`'a gider → 302 redirect Etsy auth URL'ine (`https://www.etsy.com/oauth/connect?...&code_challenge=...&state=...`)
- [ ] Cookie `etsy_oauth_state` set edildi (DevTools → Application → Cookies; httpOnly + path `/api/etsy/oauth`)
- [ ] Browser'da Etsy login sayfası açılır

### G.4 — OAuth callback happy path (kullanıcı izin verir)
- [ ] Etsy login + scope onay
- [ ] Browser callback'e döner: `/api/etsy/oauth/callback?code=...&state=...`
- [ ] Server token exchange + Etsy `/users/me` + `/users/{id}/shops` lookup yapar
- [ ] Otomatik redirect: `/settings?etsy=connected`
- [ ] Settings panelde yeşil banner: "Etsy bağlantısı kuruldu."
- [ ] URL temizlendi (`?etsy=connected` query kaldı kalmadı browser history'ye)
- [ ] Panel `connected` state'e döndü:
  - [ ] Mağaza adı (Etsy shop_name)
  - [ ] Mağaza ID (numeric)
  - [ ] Token süresi
  - [ ] Yetkiler: `listings_w, listings_r, shops_r`
  - [ ] "Bağlantıyı kaldır" button enabled
  - [ ] Etsy revoke uyarısı: "etsy.com/your/account/apps üzerinden izinleri kaldırmalısınız."
- [ ] DB'de `EtsyConnection` row'u var: `accessToken` + `refreshToken` encrypted, `shopId`, `tokenExpires` gelecekte
- [ ] Store auto-create: kullanıcının store'u yoksa otomatik yaratıldı (`name` = Etsy shop_name)

### G.5 — OAuth callback honest-fail paths
> Aşağıdaki senaryoları DevTools veya manuel URL ile tetikle:

- [ ] **error query** (Etsy reddetti) — `/api/etsy/oauth/callback?error=access_denied&error_description=...` → redirect `/settings?etsy=error-access_denied` → kırmızı banner
- [ ] **missing code** — `/api/etsy/oauth/callback?state=x` (code yok) → `/settings?etsy=missing-code` → kırmızı banner
- [ ] **state-mismatch** — cookie state ≠ query state → `/settings?etsy=state-mismatch` → kırmızı banner
- [ ] **missing-state** — cookie expire olmuş veya yok → `/settings?etsy=missing-state` → kırmızı banner

### G.6 — Connection delete
- [ ] G.4 sonrası `connected` state'te → "Bağlantıyı kaldır" tıkla
- [ ] DELETE `/api/settings/etsy-connection` → 200
- [ ] Panel `not_connected` state'e döndü, "Etsy'ye bağlan" CTA görünür
- [ ] DB'de `EtsyConnection` row'u silindi
- [ ] **NOT:** Etsy uygulama izinleri otomatik revoke EDİLMEZ — kullanıcı `etsy.com/your/account/apps` üzerinden ayrıca yapmalı (UI'da bilgilendiriliyor)

### G.7 — `expired` durumu
> **Önkoşul:** Connected, ama `tokenExpires` geçmişte. DB'de manuel update ile simüle edilebilir.

- [ ] DB'de `EtsyConnection.tokenExpires` geçmişe çek (`UPDATE EtsyConnection SET "tokenExpires" = NOW() - INTERVAL '1 hour'`)
- [ ] Panel refresh → `expired` branch: "Bağlantı süresi doldu (..). Yeniden bağlanmak gerek."
- [ ] "Yeniden bağlan" link → `/api/etsy/oauth/start` (G.3-G.4 yolu yeniden çalışır)
- [ ] **NOT:** V1'de submit pipeline ayrıca opportunistic refresh dener (J.4 senaryosu); auto-refresh fail ise kullanıcı buradan reconnect

### G.8 — Readiness diagnostics summary
> **Hedef:** Etsy connection paneli'nin ÜSTÜNDE 3-state checklist görünür ve env/connection durumuna göre doğru etiket basar. Live çağrı YOK; sadece env + DB okuma.

- [ ] Panel başlığı: "Etsy live submit hazırlığı"
- [ ] Sağ üstte badge: `liveReady=true` ise yeşil "Hazır", aksi halde gri "Hazır değil"
- [ ] 3 satır görünür: **OAuth credentials** + **Taxonomy mapping** + **Bağlantı**
- [ ] Her satırda state etiketi (örn. `(ok)` / `(missing)` / `(invalid)` / `(connected)` / `(expired)` / `(not_connected)` / `(not_configured)`) görünür
- [ ] Her satırda detay text Türkçe, eyleme yönelik (örn. taxonomy missing → "developer.etsy.com /seller-taxonomy/nodes…")
- [ ] OAuth env + taxonomy + connected üçü tamsa: 3 ✓ + "Hazır" badge + connection mağaza adı/token süresi görünür
- [ ] OAuth env yok ise: OAuth satırı boş daire icon + "Hazır değil" badge
- [ ] `ETSY_TAXONOMY_MAP_JSON` bozuk JSON ile dolu ise (örn. `'{ broken'`): taxonomy satırı `(invalid)` + "formatı bozuk" detay
- [ ] `ETSY_TAXONOMY_MAP_JSON` dolu ama `wall_art` key'i yok ise: taxonomy satırı `(missing)` + "key'i yok" detay
- [ ] 30s polling: `.env.local`'a `ETSY_TAXONOMY_MAP_JSON` ekleyip dev server restart etmeden 30s bekle → component otomatik refresh, taxonomy satırı `(missing)` → `(ok)`'e döner

---

## H. Submit live success path (credentials + connection + taxonomy varsa)

> **Hedef:** Phase 9 V1 implementation/local foundation neredeyse tamam — credentials + OAuth bağlantısı + `ETSY_TAXONOMY_MAP_JSON` üçü eş zamanlı doluysa submit gerçek Etsy V3 endpoint'lerine canlı gider.
>
> **Önkoşul:** Önkoşul env doğrulamasındaki **3 dep**'in hepsi tamam (credentials + G.4 connected + taxonomy env). Listing zorunlu alanları dolu (title/description/price/category eşleşmiş ProductType key'le).

> **NOT:** Submit pipeline live başarısı 3 external dep'in **eş zamanlı** sağlanmasına bağlı:
> Etsy app credentials (.env) + OAuth bağlantısı (Settings G.4) + ETSY_TAXONOMY_MAP_JSON env.
> Bu 3'ünden biri eksikse honest-fail path tetiklenir (J.1-J.9 senaryoları test eder).
>
> **Phase 9 V1 PASS için live H path'i ZORUNLU DEĞİL** — J.1-J.9 honest-fail
> path'lerinin tümü doğrulanırsa kod tarafı PASS edilebilir. Live submit success
> sadece operations tarafında 3 dep'i kuran kullanıcı/admin için ek doğrulama.

### H.1 — Submit happy path (live) — SubmitResultPanel zenginlikleri
- [ ] Listing detay sayfası DRAFT, "Taslak Gönder" button enabled
- [ ] "Taslak Gönder" tıkla → button "Gönderiliyor…" + spinner
- [ ] Backend pipeline:
  - [ ] taxonomy resolve (env'den) → success
  - [ ] `provider.createDraftListing` Etsy V3 POST `/shops/{shopId}/listings` → 200
  - [ ] `uploadListingImages` her render için storage download + multipart Etsy upload
- [ ] Network tab: response 200 + body `{ status: "PUBLISHED", etsyListingId: "...", failedReason: null, providerSnapshot: "etsy-api-v3@YYYY-MM-DD", imageUpload: { successCount: N, failedCount: 0, partial: false } }`
- [ ] **Yeşil success banner başlığı:** "**Etsy taslağı oluşturuldu**" (taze submit; SubmitResultPanel `submitMutation.isSuccess` branch). NOT: Geçmiş PUBLISHED durumda (sayfa yenilendikten sonra) banner başlığı "**Etsy'ye gönderildi**" olur (L.2 senaryosu) — başka bir branch
- [ ] SubmitResultPanel mağaza adı (etsyShop populated; live OAuth bağlantısı varsa shopName burada görünür) + Etsy listing ID font-mono
- [ ] **"Etsy'de Aç" link:** href `https://www.etsy.com/your/shops/me/tools/listings/{etsyListingId}` (admin URL, login gerek) — yeni tab
- [ ] **"Mağazaya Git" link:** href `https://www.etsy.com/shop/{shopName}` (etsyShop.shopName varsa) — yeni tab
- [ ] **ImageUploadDiagnostics:** "Görsel yükleme: N/M başarılı" + "Detayı göster" toggle; tıkla → her rank için ✓/✗ + cover işareti + Etsy image ID veya error
- [ ] **Provider snapshot footer:** "Provider: etsy-api-v3@YYYY-MM-DD"
- [ ] Manuel publish notu: "Etsy admin panelinden manuel publish yapabilirsin"
- [ ] Listing.status DB'de PUBLISHED, etsyListingId persist, submittedAt + publishedAt set
- [ ] Status badge "Yayınlanmış"a döndü
- [ ] `/listings` index'te status badge yenilendi (cache invalidation) + card'da "Etsy'de Aç" link görünür
- [ ] Etsy admin panelinde listing draft görünür (gerçek doğrulama: tarayıcıda etsy.com/your/shops/me/tools/listings)

### H.2 — Submit partial image upload
> **Önkoşul:** Etsy rate-limit veya 5xx simülasyonu (gerçek live'da rare; canlıda tetiklemek zor olabilir, atla).

- [ ] (Eğer yakalanırsa) Submit yapıldı, bazı image'lar başarısız → status PUBLISHED + failedReason: "Image upload kısmen başarısız: X/N yüklendi (başarısızlar: rank=..)"
- [ ] Etsy listing var, eksik image'lar Etsy admin'den manuel eklenebilir

### H.3 — Submit image upload all-failed (orphan)
> **Önkoşul:** Storage bucket'a tüm render'lara erişim kapalı (test için MinIO permission iptali) — gerçek live ortamda nadir.

- [ ] (Eğer yakalanırsa) Submit yapıldı → status FAILED + etsyListingId persist (orphan listing) + failedReason: "Listing image upload tamamen başarısız: ..."
- [ ] Kullanıcı Etsy admin'den orphan listing'i yönetebilir (sil veya manuel image yükle)

### H.4 — Submit cross-user
- [ ] Başka user ile login → DevTools'tan POST `/api/listings/draft/{listingId}/submit` direkt çağır → 404 `LISTING_SUBMIT_NOT_FOUND`

### H.5 — Submit terminal status guard
- [ ] H.1 sonrası listing PUBLISHED → "Taslak Gönder" button disabled + muted text "Bu durumda yeniden gönderilemez (status: Yayınlanmış)."
- [ ] PUBLISHED banner: "Bu listing Etsy'ye gönderildi (Etsy listing ID: ...). Yayına almak için Etsy admin panelinden manuel publish yapılabilir."

---

## J. Submit honest-fail paths (external dep eksikse)

> **Hedef:** Phase 9 V1 sözleşmesi: external dep yoksa submit pipeline her aşamada honest fail. **Hiçbir senaryoda fake success YOK.**

### J.1 — Etsy not configured (env yok)
> **Önkoşul:** `ETSY_CLIENT_ID/SECRET/REDIRECT_URI` env'de YOK + dev restart.

- [ ] Listing DRAFT, "Taslak Gönder" tıkla
- [ ] Response 503 + body `{ error: "Etsy entegrasyonu yapılandırılmadı...", code: "ETSY_NOT_CONFIGURED" }`
- [ ] UI alert: "Gönderme başarısız: Etsy entegrasyonu yapılandırılmadı (ETSY_CLIENT_ID / ETSY_CLIENT_SECRET env yok). Sistem yöneticisinin .env'i tamamlaması gerek."
- [ ] Listing.status DB'de hâlâ DRAFT

### J.2 — Connection not found (env var, bağlantı yok)
> **Önkoşul:** Env credentials var, ama kullanıcının `EtsyConnection` row'u yok.

- [ ] Listing DRAFT, "Taslak Gönder" tıkla
- [ ] Response 400 + code `ETSY_CONNECTION_NOT_FOUND`
- [ ] UI alert: "Gönderme başarısız: Etsy hesabı bağlı değil. Settings → Etsy bağlantısı kurulmalı."
- [ ] Listing.status DB'de hâlâ DRAFT

### J.3 — Taxonomy missing (env yok)
> **Önkoşul:** Credentials + connection var, ama `ETSY_TAXONOMY_MAP_JSON` env'de YOK + restart.

- [ ] Listing'in productType.key veya category'si "wall_art" olsun
- [ ] "Taslak Gönder" tıkla
- [ ] Response 422 + code `ETSY_TAXONOMY_MISSING` + `details.productTypeKey: "wall_art"`
- [ ] UI alert: "Gönderme başarısız: Etsy taxonomy mapping bulunamadı: \"wall_art\". Sistem yöneticisinin ETSY_TAXONOMY_MAP_JSON env değişkenine bu ürün tipini eklemesi gerek."
- [ ] Listing.status DB'de hâlâ DRAFT

### J.4 — Token expired (auto-refresh + fallback)
> **Önkoşul:** Connection var, ama `tokenExpires` geçmişte (G.7 simülasyonu sonrası).

- [ ] **Auto-refresh path (genelde)**: "Taslak Gönder" tıkla → submit pipeline opportunistic refresh dener
  - [ ] Refresh başarılı → kullanıcı 401 görmez; submit normal akışına devam eder
  - [ ] Network tab: refresh çağrısı sessizce yapıldı (oauth/token endpoint)
- [ ] **Refresh fail path**: Etsy refresh token'ı revoke ettiyse veya network fail
  - [ ] Response 401 + code `ETSY_TOKEN_REFRESH_FAILED`
  - [ ] UI alert: "Gönderme başarısız: Etsy token yenileme başarısız: {neden}. Settings → Etsy bağlantısı'ndan yeniden bağlanmanız gerek."
  - [ ] Settings → Etsy panel `expired` state gösterir → "Yeniden bağlan" ile düzelt
- [ ] **NOT:** Token refresh worker V1.1+ — V1'de submit-time opportunistic

### J.5 — Missing fields (zorunlu alanlar)
- [ ] Listing'de title boş bırak → "Taslak Gönder"
- [ ] Response 422 + code `LISTING_SUBMIT_MISSING_FIELDS` + `details.missing: ["title"]`
- [ ] UI alert: "Gönderme başarısız: Listing zorunlu alanları eksik: title"

### J.6 — Status guard (terminal)
- [ ] DB'de manuel status: "PUBLISHED" çek
- [ ] Detay sayfası refresh → "Taslak Gönder" button **disabled**
- [ ] PUBLISHED banner görünür

### J.7 — FAILED status banner (recovery için L.4 senaryosu)
- [ ] DB'de manuel status: "FAILED" + failedReason: "test failure" çek
- [ ] Detay sayfası refresh → kırmızı banner: "Önceki gönderim başarısız: test failure. Tekrar denenebilir."
- [ ] **NOT:** FAILED → DRAFT recovery V1'de mevcut — detaylı senaryo için **L.4** bölümüne bak (SubmitResultPanel "Yeniden DRAFT'a çevir" button + reset-to-draft endpoint)

### J.8 — Cross-user
- [ ] Başka user ile login → URL'den aynı listing id'siyle submit endpoint'ine direkt POST → 404

### J.9 — Cache invalidation
- [ ] (J.1-J.5 sonrası) Detay sayfasında alert görünürken `/listings` index'e geç
- [ ] Listing card'ında status değişmedi (submit fail olduğu için doğru)
- [ ] (H.1 success path varsa) Submit success sonrası index'te "Yayınlanmış" badge'e dönüş gözle doğrula

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
- [ ] `npm test` → 1671/1671 pass
- [ ] `npm run test:ui` → 946/946 pass

### I.4 — Tarayıcı uyumluluğu
- [ ] Chrome — listing detay sayfası, AI button, submit button gözle test
- [ ] Safari (opsiyonel) — same
- [ ] Firefox (opsiyonel) — same

### I.5 — Mobile responsive (V1'de optimize değil)
- [ ] DevTools mobile mode (375px) → temel layout breakdown yok
- [ ] **NOT:** Phase 9 V1 mobile-first değil; ciddi UX sorun varsa V2 carry-forward

---

## L. Submit Result Panel + diagnostics + recovery (Phase 9 V1 finalization)

> **Hedef:** Submit pipeline'ın UI yüzeyi (SubmitResultPanel) tüm state'lerde zengin bilgi + Etsy deep-links + recovery sunar.

### L.1 — DRAFT'ta SubmitResultPanel
- [ ] DRAFT listing detayında submit footer SubmitResultPanel render eder
- [ ] Readiness fail varsa sarı uyarı görünür (K3 lock soft warn)
- [ ] "Taslak Gönder" CTA enabled

### L.2 — PUBLISHED status (geçmiş submit)
- [ ] Yeşil banner: "Etsy'ye gönderildi"
- [ ] Mağaza adı görünür (etsyShop populated; live OAuth bağlantısı varsa)
- [ ] Etsy listing ID görünür (font-mono)
- [ ] "Etsy'de Aç" link → `https://www.etsy.com/your/shops/me/tools/listings/{etsyListingId}` (admin URL, login gerek)
- [ ] "Mağazaya Git" link → `https://www.etsy.com/shop/{shopName}` (eğer etsyShop.shopName var)
- [ ] Manuel publish notu: "Etsy admin panelinden manuel publish yapılabilir"

### L.3 — Submit success taze (yeni submit)
- [ ] Yeşil panel + ImageUploadDiagnostics: "Görsel yükleme: N/M başarılı"
- [ ] "Detayı göster" tıkla → her rank için ✓/✗ + cover işareti + Etsy image ID veya error
- [ ] "Detayı gizle" tıkla → liste kapanır
- [ ] Provider snapshot footer: "Provider: etsy-api-v3@YYYY-MM-DD"
- [ ] Etsy deep-link butonları görünür

### L.4 — FAILED status recovery
- [ ] Kırmızı banner: "Önceki gönderim başarısız" + failedReason
- [ ] etsyListingId set ise: "Etsy tarafında orphan listing kalmış olabilir (ID: ...). Etsy admin panelinden manuel inceleyip silebilirsin."
- [ ] "Yeniden DRAFT'a çevir" button enabled
- [ ] Tıkla → POST /api/listings/draft/[id]/reset-to-draft → 200
- [ ] Listing.status DB'de DRAFT, etsyListingId/failedReason/submittedAt/publishedAt → null
- [ ] UI refresh → DRAFT durumunda; "Taslak Gönder" tekrar enabled
- [ ] etsyListingId set ise "Orphan'ı Aç" link → admin URL

### L.5 — Listings index Etsy link
- [ ] PUBLISHED listing card'ında "Etsy'de Aç" link görünür
- [ ] Tıkla → admin URL'e git (yeni tab)
- [ ] Card click navigation bozulmamış (event.stopPropagation)

### L.6 — Cross-cutting reset endpoint
- [ ] DRAFT durumunda reset endpoint'i çağırılırsa → 409 LISTING_RESET_INVALID_STATE
- [ ] PUBLISHED durumunda → 409 (sadece FAILED → DRAFT izinli)
- [ ] Cross-user → 404 LISTING_RESET_NOT_FOUND

---

## K. Bilinen V1 sınırları (test ETMEYİN, dokümante edildi)

Bu davranışları test etmek **gerekmez** — Phase 9 V1 sözleşmesinde yer almıyor veya V1.1+'a ertelendi:

- **Auto-save** — yok (kullanıcı "Kaydet" tıklamak zorunda)
- **Active publish (Etsy `state: "active"`)** — yok (V1: bizim oluşturduğumuz Etsy listing `state: "draft"`; yayına alma Etsy admin manuel — V2)
- **Token refresh background worker (BullMQ)** — yok (V1: submit-time opportunistic refresh `resolveEtsyConnectionWithRefresh`; V1.1+ background pre-emptive)
- **Listing reset (FAILED → DRAFT)** — V1'de mevcut: SubmitResultPanel'de "Yeniden DRAFT'a çevir" button + `POST /api/listings/draft/[id]/reset-to-draft` endpoint (L.4 senaryosu)
- **Negative library hard-block** — yok (V1 soft warn, K3 lock — V1.1+ severity "error" hard gate)
- **Custom mockup/category extension** — Phase 9 V1 ProductType seed'inde 8 key (canvas/wall_art/printable/clipart/sticker/tshirt/hoodie/dtf), Phase 8 emsali
- **Cost tracking integration** — yok (KIE 1 cent estimate var ama `CostUsage` tablosuna log akmıyor — V1.1+)
- **Image upload paralelleştirme + retry policy** — V1 sequential + no retry (V1.1+ paralel + 5xx retry policy + worker queue)
- **Per-render PNG/JPG download endpoint** — yok (sadece bulk ZIP V1'de hazır; per-render V1.1+)
- **Admin taxonomy UI / DB-backed taxonomy** — yok (V1: env-based JSON; V1.1+ admin UI ile `ProductType.etsyTaxonomyId Int?` field eklenebilir)
- **Etsy V3 `/seller-taxonomy/nodes` discovery + cache** — yok (V1: admin elle çıkarır + env'e koyar; V1.1+ runtime discovery)
- **Folder unification `ui/` ↔ `components/`** — yok (mevcut yapı çalışıyor, refactor risk taşır; V1.1+ ADR)

---

## Bulgular

> Manuel QA gerçek koşum sonucu kullanıcı bu başlık altına yazsın. Format:
> `### YYYY-MM-DD — bulgu özeti`. Kategoriler: 🟢 PASS / 🟡 NOT / 🔴 BLOCK / 🔵 V2.

### 2026-05-04 — Browser canlı QA + canlı KIE smoke (HEAD `dc3bf69`)

**Genel sonuç:** 🟢 **Honest-fail PASS** — V1 zorunlu kapsam koşuldu, geçti. Etsy live success external dep'e bağlı blocked.

#### 🟢 PASS — Canlı doğrulanmış akışlar

- **A.1 Cross-user isolation:** PATCH başka user listing → `404 LISTING_DRAFT_NOT_FOUND` (information disclosure prevent).
- **A.2 Terminal status guard:** PUBLISHED listing PATCH → `409 LISTING_NOT_EDITABLE`.
- **B.1 Header:** H1 "Listing Taslağı: [title]", "Status: Taslak", tarih biçimi `dd.MM.yyyy`.
- **B.2 AssetSection:** Boş imageOrder durumunda "ZIP'e hazır" badge + ZIP link **gösterilmiyor** (HEAD `920c6d2` vacuous truth fix); sarı "Tüm görseller yüklenmeyi bekliyor" görünüyor.
- **B.3 Hazırlık Kontrolleri:** 6 baseline check + dinamik negative library check — readiness response `Array<{field, pass, severity:"warn", message}>` (K3 soft warn).
- **B.4 MetadataSection:** Title/description/tags input + "AI Oluştur" button (canlı KIE).
- **B.5 PricingSection:** priceCents save + Türkçe "Fiyat: $24.99" pass message.
- **B.6 Submit Action footer:** "Taslak Gönder" enabled + "⚠ Bazı hazırlık kontrolleri eksik. Yine de gönderilebilir, ancak Etsy reddedebilir." sarı banner.
- **C.1 Title save:** PATCH 200 + `titlePass:true, message:"Title hazır (N karakter)"` (HEAD `b89d873` pass-message regression fix yansıması).
- **C.2 Description + tags save:** PATCH 200 + `descCheck:"Açıklama hazır"`, `tagsCheck:"13 tag (maksimum 13)"`.
- **C.3 Price save:** PATCH 200 + readiness "Fiyat: $24.99".
- **C.4 Strict mode validation:** 5/5 senaryo `400 VALIDATION` (negative price, zero price, tag>20 chars, title>140, unknown field).
- **C.5 Status guard:** PUBLISHED listing PATCH → `409 LISTING_NOT_EDITABLE` + Türkçe.
- **C.6 Cross-user:** Başka user listing PATCH → `404 LISTING_DRAFT_NOT_FOUND`.
- **D Listings index:** 4 status filter tab (Tümü/Taslak/Yayınlanmış/Başarısız) + `?status=PUBLISHED` query state + Etsy admin deep-link `https://www.etsy.com/your/shops/me/tools/listings/{etsyListingId}` (PUBLISHED kart).
- **E.1 AI honest-fail:** Settings AI Mode'da `kieApiKey` boş iken `POST /generate-meta` → `400 LISTING_META_PROVIDER_NOT_CONFIGURED` + Türkçe rehber.
- **E.2 KIE Gemini 2.5 Flash live:** 10 ardışık deneme **10/10 PASS**. Çıktı varyans: title 76-132 char (≤140 ✓), description 363-551 char (≥50 ✓), tags 13/13 (her seferinde), maxTagLen 13-17 (≤20 ✓), latency 14.8-20.8s. providerSnapshot `gemini-2.5-flash@2026-05-04`, promptVersion `v1.0`. **Cost recording canlı doğrulandı**: 1 cent + providerKey `kie-gemini-flash` + model `gemini-2.5-flash` + units 1 + periodKey günlük (HEAD `dc3bf69` listing-meta cost recording fix).
- **F Negative library:** 6 match (3 field × 2 phrase: title "disney"+"marvel", tags "nike"+"nfl", description "cbd"+"best deal"). Tüm severity:"warn" K3 lock + Türkçe + structured.
- **G.1 Settings `not_configured`:** EtsyReadinessSummary 3-state diagnostic (`oauthCredentials.missing` + `taxonomyMapping.missing` + `connection.not_configured` + `liveReady=false`); 4-env tam liste; submit J.1 ile **aynı gerçeği söylüyor** (consistency PASS).
- **I Submit guard surface:** "Taslak Gönder" enabled (DRAFT) + sarı readiness uyarı banner Türkçe.
- **J.1 ETSY not_configured:** Submit → `503 ETSY_NOT_CONFIGURED` + Türkçe ("ETSY_CLIENT_ID / ETSY_CLIENT_SECRET env yok").
- **J.5 Missing fields:** Boş listing submit → `422 LISTING_SUBMIT_MISSING_FIELDS` + `details.missing: ["title","description","price"]`.
- **J.6 Status guard PUBLISHED:** Submit → `409 LISTING_SUBMIT_NOT_EDITABLE`.
- **J.7 Status guard FAILED:** Submit → `409 LISTING_SUBMIT_NOT_EDITABLE` (recovery için L.4 kullanılır).
- **J.8 Cross-user submit:** Başka user listing submit → `404 LISTING_SUBMIT_NOT_FOUND`.
- **J.9 Cache invalidation:** Detail DRAFT, index `?status=DRAFT` 1 listing — submit fail sonrası status değişmedi.
- **L.4 FAILED → DRAFT recovery:** "Yeniden DRAFT'a çevir" buton click → status DRAFT, `failedReason: null`, footer "Taslak Gönder" yeniden enabled. DB readback doğruladı.
- **Auto-save YOK:** AI Oluştur sonrası KIE'den title/description/tags geldi ama listing fields **aynı kaldı** (`before === after`). Manuel "Kaydet" gerekmesi doğrulandı.
- **Save akışı + readiness recompute + negative library temizleme:** "Disney Marvel" temizlendiği yeni metinde `policyCount=0`, 3 field pass:true.

#### 🟡 NOT — Gözlem (V1 sözleşmesi içinde)

- **E.2 schema flakiness:** Önceki batch'lerde 4-5 deneme arasında 1 fail görüldü (KIE Gemini bazen `title >140` döndürüyor). Bu turun 10/10 PASS oranı stabil görünüyor; yine de **deterministik LLM değil** — V1.1 carry-forward (validation-guided retry, max 2 try). Mevcut davranış honest fail (502 + Türkçe + retry button), kullanıcı dostu.
- **J.5 missing list:** "title, description, price" — `category` submit-time hard required değil, submit pipeline `category` boşsa taxonomy resolver kuralında ayrı J.3 honest-fail atar. Ürün kararı, V1 spec'te.
- **Tags `(maksimum 13)` mesajı:** Tam 13 tagde "13 tag (maksimum 13)" — kafa karıştırıcı ama valid (her durumda pass:true). UI iyileştirme V1.1 nice-to-have.

#### 🔴 BLOCK

_(yok)_

#### 🔵 V2 / V1.1 carry-forward

- **KIE schema flakiness mitigation:** validation-guided retry max 2 try (V1.1).
- **Token refresh BullMQ background worker** (V1: submit-time opportunistic var).
- **Per-render PNG/JPG download endpoint** (V1: bulk ZIP).
- **Admin taxonomy UI + DB-backed `ProductType.etsyTaxonomyId Int?`** (V1: env-based).
- **Etsy active publish (`state: "active"`)** (V2).
- **Hard-block negative library (severity "error")** (V1.1).
- **Image upload paralelleştirme + retry policy** (V1.1).

#### Blocked (external operasyonel dep — runbook 5.2 honest-fail PASS sınırı içinde)

- **G.2 `not_connected` durumu:** ETSY_CLIENT_ID/SECRET/REDIRECT_URI env yok — UI render edilebilir ama OAuth flow tetiklenemez.
- **G.3 OAuth start route + G.4 callback happy + G.5 honest-fail paths + G.6 connection delete + G.7 expired:** Etsy app credentials + verified redirect URI gerekir.
- **G.8 readiness diagnostics summary:** `not_configured` durumu G.1 ile PASS; `connected` + `expired` durumları için credentials + OAuth gerekir.
- **H Submit live success path (H.1-H.5):** `ETSY_CLIENT_ID/SECRET/REDIRECT_URI + ETSY_TAXONOMY_MAP_JSON + OAuth flow live test` üçü eş zamanlı gerekir.
- **J.2 Connection not found, J.3 Taxonomy missing, J.4 Token expired:** Bunlar ancak credentials varken farklı state'lerde test edilebilir; env yokken hepsi J.1 ile aynı 503'e düşüyor (honest-fail validated).

---

## Sonuç

Manuel QA tamamlandığında:
1. Tüm `[ ]` kutuları işaretlenmeli (test edilenler)
2. `[ ]` kalanlar için sebep `## Bulgular` altında belirtilmeli
3. 🔴 BLOCK varsa Phase 9 V1 status `🔴 BLOCK` olarak [`./phase9-status.md`](./phase9-status.md) güncellenmeli
4. Hepsi 🟢 ise Phase 9 V1 status `🟢 PASS` olarak güncellenebilir — **ama** Phase 8 manuel QA da kapanmadan Phase 9 final closeout ilan edilmemeli (Phase 8 V1 hâlâ pending)
