# EtsyHub Final Closeout Runbook

> **Tarih:** 2026-05-04
> **HEAD:** `920c6d2`
> **Amaç:** Repo-wide release readiness'i `🟡 Pre-closeout` → `🟢 PASS` hâline getirmek için gereken **tek operasyonel rehber**. Kullanıcı/admin bu doc'tan adım adım yürüyerek son 1 mile'ı tamamlar.

Bu doküman:
- Yeni manual QA checklist'i **DEĞİL** (mevcutlar var: `phase6-manual-qa.md`, `phase8-manual-qa.md`, `phase9-manual-qa.md`)
- Yeni feature spec'i **DEĞİL** (kod release-ready)
- Sıralama + PASS kriteri + closeout sonrası doc update planı

İçerik 6 bölüm: önkoşul env → QA sırası → her phase'in PASS kriterleri → honest-fail PASS sınırı → blocked sınırı → closeout sonrası doc update.

---

## 0. Önkoşul env (tek seferlik kurulum)

QA başlamadan önce kullanıcı/admin **bir kez** aşağıdakileri sağlar:

### 0.1 Altyapı (zorunlu, tüm phase'ler için)
- [ ] `docker ps`: Postgres + Redis + MinIO container'ları RUNNING (`etsyhub-postgres`, `etsyhub-redis`, `etsyhub-minio`)
- [ ] `npx tsx --env-file=.env.local prisma/seed.ts` çalıştırıldı (admin user + 8 ProductType + theme + feature flags seed)
- [ ] `.env.local`'de zorunlu env'ler dolu: `APP_URL`, `AUTH_SECRET` (32+ char), `SECRETS_ENCRYPTION_KEY` (64-hex), `DATABASE_URL`, `REDIS_URL`, `STORAGE_*`
- [ ] `npm run dev` ve `npm run worker` ayrı terminallerde başlatılır
- [ ] `/login` → `admin@etsyhub.local` / `admin12345` ile giriş yapılabilir

### 0.2 Phase 6 canlı smoke için (opsiyonel)
- [ ] **KIE Gemini 2.5 Flash key** — `Settings → AI Mode` ekranından `kieApiKey` doldurulur (encrypted at rest)
- [ ] **KIE health probe gateway** — `npx tsx scripts/kie-health-probe.ts` ile 3/3 ardışık HEALTHY (24h+ tutarlı stabilite önerilir; KIE flaky maintenance external dep)

### 0.3 Phase 9 Etsy live submit success için (opsiyonel)
Live Etsy submit success **3 external dep'in eş zamanlı sağlanmasına** bağlı:
- [ ] **Etsy app credentials** — `developer.etsy.com` üzerinde app oluşturulur; `.env.local`'e `ETSY_CLIENT_ID`, `ETSY_CLIENT_SECRET`, `ETSY_REDIRECT_URI` eklenir; redirect URI Etsy app config'inde verify edilir
- [ ] **`ETSY_TAXONOMY_MAP_JSON` env** — admin Etsy V3 `/seller-taxonomy/nodes` endpoint'inden ProductType key'leri için node ID'lerini çıkarır + `.env.local`'e koyar (örn. `'{"wall_art":2078,"sticker":1208,"clipart":1207,...}'`)
- [ ] **OAuth bağlantısı kurulur** — `Settings → Etsy bağlantısı` panelinden "Etsy'ye bağlan" → Etsy izin → callback `?etsy=connected`

**Eğer 0.2 veya 0.3 sağlanamıyorsa**: ilgili phase'in **honest-fail PASS** path'i takip edilir — bu yine geçerli closeout'tur (V1 sözleşmesinde belirtilmiş).

---

## 1. QA sırası (zorunlu)

Aşağıdaki 5 adım sırayla yürütülür. Phase'ler arası bağımlılık var; sıra atlanmamalı.

```
   [0. Önkoşul env]
            │
            ▼
   [1. Phase 6 V1 manual QA]  ──┐
            │                   │ Phase 7 v1.0.1 Review Queue
            ▼                   │ gating'i Phase 6 PASS'a bağlı
   [2. Phase 7 v1.0.1] ◀────────┘
       (otomatik aktif —
        manuel test gerekmez)
            │
            ▼
   [3. Phase 8 V1 manual QA]
            │  S8 result valid pack
            │  → Phase 9 köprüsü test
            ▼
   [4. Phase 9 V1 manual QA]
            │
            ▼
   [5. Final closeout doc update]
            │
            ▼
   release-readiness.md 🟡 → 🟢
```

---

## 2. Phase 6 V1 manual QA

**Doküman:** [`phase6-manual-qa.md`](./phase6-manual-qa.md)
**Önkoşul:** 0.1 + 0.2 (KIE key + health probe 3/3 HEALTHY)
**Kapsam:** 8 senaryo (A Settings panel, B auto-review, C queue, D detail panel, E decision, F KIE live F.1-F.4, G cost tracking, H Phase 6→7 gating)

### 2.1 PASS kriteri
**Tüm 4 path doğrulandığında PASS:**
- F.1 AI mode (remote-url) — KIE 200 + Review row insert + cost +1
- F.2 Local mode (local-path, Aşama 2B) — image-loader data URL inline + KIE 200
- F.3 Honest-fail (KIE key yok) — provider throw "api key missing" + Review row YOK
- F.4 Honest-fail (KIE flaky envelope code !== 200) — provider envelope-aware throw

### 2.2 Honest-fail PASS sınırı
**KIE key/runtime eksikse Phase 6 V1 PASS edilebilir mi?**
- ✅ EVET — eğer F.3 + F.4 (honest-fail path'leri) doğrulandıysa
- F.1/F.2 (canlı KIE) skip edilebilir; durumu "blocked: KIE flaky external" olarak işaretle
- A/B/C/D/E/G/H bölümleri hâlâ PASS edilmeli (UI vitrin + decision + cost tracking + Phase 7 gating)

### 2.3 Blocked sınırı
**Şu durumlarda Phase 6 PASS edilmemeli:**
- F.3 honest-fail çalışmıyor (provider sessiz fallback yapıyor)
- A/B/C/D/E/G/H bölümlerinde gerçek bug var
- Phase 6 → Phase 7 gating çalışmıyor (Phase 7 Review Queue açılmıyor)

### 2.4 Sonrası
Phase 6 PASS olduğunda:
- `phase6-manual-qa.md` "Bulgular" bölümüne `### YYYY-MM-DD — PASS` ekle
- `phase6-quality-review.md` header status `🟡 Kod tarafı tamam, canlı smoke pending` → `🟢 Phase 6 V1 PASS` (canlı smoke yapıldıysa) **veya** `🟡 Honest-fail PASS — canlı KIE smoke external dep` (yapılmadıysa)

---

## 3. Phase 7 v1.0.1 Review Queue activation (otomatik)

**Doküman:** [`phase7-selection-studio.md`](./phase7-selection-studio.md) — referans
**Status:** 🟢 PASS (manuel QA daha önce geçti)

Phase 6 PASS sonrası **manuel test gerekmez** — kod gating'i yok, sadece kullanıcı tarafı UI gating'di.

### 3.1 PASS kriteri
- Selection Studio "AI Quality Panel" → "Review'a gönder" button **enabled**
- AddVariantsDrawer "Review Queue" tab **enabled**

### 3.2 Sonrası
- `phase7-manual-qa.md` Bulgular bölümüne `### YYYY-MM-DD — Phase 6 PASS sonrası gating açıldı` ekle (opsiyonel, audit trail)

---

## 4. Phase 8 V1 manual QA

**Doküman:** [`phase8-manual-qa.md`](./phase8-manual-qa.md)
**Önkoşul:** 0.1 + admin user'a ait en az 1 `status=ready` SelectionSet seed (Selection Studio Phase 7 üzerinden manuel hazırlanır)
**Kapsam:** A-O bölümleri + G.1 Phase 9 köprüsü (toplam ~16 senaryo)

### 4.1 PASS kriteri
**Tüm bölümler PASS:**
- A-F: S3 Apply → S1 Browse → S2 Detail → Submit → S7 polling → S8 redirect
- G + G.1: S8 result + Phase 9 köprüsü (Listing'e gönder CTA)
- H-K: ZIP download + Cover swap + Per-render retry + Per-render swap
- L: 5-class hata sözlüğü
- M: Cross-user 404
- N: Completion toast
- O: Backdrop davranışları
- P: E2E suite (`npm run test:e2e`)

### 4.2 Honest-fail PASS sınırı
**Phase 8'de honest-fail path yok** — Phase 8 self-contained (Sharp local renderer, KIE bağımsız). Eğer bir senaryo başarısızsa fix-now gerek.

### 4.3 Blocked sınırı
- Sharp render perspective Task 10 BLOCKED (V1'de schema-only, Task 0 spike bağımlılığı) — bu zaten dokümante; bu durumda perspective template'lar render fail eder, **bu beklenen** ve PASS sayılır.
- Dynamic Mockups provider stub-only (V1'de gerçek impl yok) — Task 12 KOŞULLU; admin seed'de DM binding yok. Sadece LOCAL_SHARP path test edilir.

### 4.4 Sonrası
Phase 8 PASS olduğunda:
- `phase8-manual-qa.md` "Bulgular" bölümüne `### YYYY-MM-DD — PASS` ekle
- `phase8-closeout.md` header status `🟡 implementation complete, manual QA pending` → `🟢 Phase 8 V1 PASS`

---

## 5. Phase 9 V1 manual QA

**Doküman:** [`phase9-manual-qa.md`](./phase9-manual-qa.md)
**Önkoşul:** 0.1 + Phase 8 V1 PASS (S8 result valid pack required for handoff)
**Kapsam:** A-L bölümleri + opsiyonel E.2 (KIE live AI metadata) + opsiyonel H (Etsy live submit)

### 5.1 PASS kriteri
**Tüm zorunlu bölümler PASS:**
- A: Phase 8 → Phase 9 handoff (S8 → listing draft)
- B: Listing draft detay
- C: Listing draft edit + save
- D: Listings index
- E.1: AI metadata honest-fail (KIE key yok ise)
- F: Negative library warnings
- G: Settings Etsy connection paneli (G.1 not_configured + G.7 expired)
- I: Cross-cutting (cross-user, soft-delete, TS, build)
- J.1-J.9: Submit honest-fail tüm path'ler
- L: SubmitResultPanel + diagnostics + recovery (L.1-L.6)

### 5.2 Honest-fail PASS sınırı
**KIE key + Etsy credentials yoksa Phase 9 V1 PASS edilebilir mi?**
- ✅ EVET — eğer aşağıdakiler sağlanmışsa:
  - E.1 (KIE NOT_CONFIGURED honest-fail) doğrulandı
  - J.1 (ETSY_NOT_CONFIGURED 503) doğrulandı
  - J.3 (ETSY_TAXONOMY_MISSING 422) doğrulandı *(eğer credentials var ama taxonomy env yok)*
  - J.5 (LISTING_SUBMIT_MISSING_FIELDS 422) doğrulandı
  - L.4 (FAILED → DRAFT recovery) doğrulandı
- E.2 (KIE live), H (Etsy live submit) opsiyonel — skip edilebilir, "blocked: external dep" olarak işaretlenir
- G.2-G.6 (OAuth flow live) opsiyonel — skip edilebilir

### 5.3 Blocked sınırı
- Phase 8 V1 manual QA pending ise A bölümü tetiklenebilir değil (handoff için S8 valid pack gerek) — Phase 9 PASS Phase 8 PASS sonrasına bekler
- E.1 honest-fail çalışmıyor (KIE key boş ama AI generate başarılı görünüyor) → fix-now bug
- L.4 reset endpoint çalışmıyor → fix-now bug

### 5.4 Browser-based Pass 4 sonuçları (HEAD `920c6d2` audit, kullanıcı yararına referans)
Aşağıdaki akışlar **2026-05-04 browser smoke** ile doğrulandı:
- ✅ Login + Dashboard + Listings index + Settings page
- ✅ EtsyReadinessSummary 3-state (not_configured → liveReady=false)
- ✅ Etsy connection panel `not_configured` 4-env tam liste
- ✅ ListingDraftView render (header + AssetSection + readiness 6-check + Metadata/Pricing forms + Submit footer)
- ✅ AI button click → 400 LISTING_META_PROVIDER_NOT_CONFIGURED honest fail
- ✅ Submit J.1 (ETSY_NOT_CONFIGURED 503) + J.5 (MissingFields 422)
- ✅ FAILED state SubmitResultPanel + reset endpoint + orphan link
- ✅ ZIP route 409 LISTING_ASSETS_NOT_READY
- ✅ Cross-user 404 mockupJobId disclosure prevent
- ✅ AssetSection ZIP-ready guard fix (boş imageOrder → link/badge YOK)

Bu **otomatik PASS değil** — kullanıcı `phase9-manual-qa.md`'yi kendi browser'ında koşturup tikleyecek.

### 5.5 Sonrası
Phase 9 PASS olduğunda:
- `phase9-manual-qa.md` "Bulgular" bölümüne `### YYYY-MM-DD — PASS` ekle
- `phase9-status.md` header status `🟡 Pre-closeout` → `🟢 Phase 9 V1 PASS`

---

## 6. Final closeout doc update planı

Phase 6 + 7 + 8 + 9 PASS olduktan sonra **release-readiness.md** finalize edilir:

### 6.1 release-readiness.md update
Mevcut Phase status haritası tablosu:
- `Phase 6 | 🟡 Backend + UI + provider tam ...` → `🟢 Phase 6 V1 PASS (YYYY-MM-DD)`
- `Phase 7 | 🟢 v1.0.1 (Manuel QA GEÇTİ)` → değişmez
- `Phase 8 | 🟡 Implementation complete` → `🟢 Phase 8 V1 PASS (YYYY-MM-DD)`
- `Phase 9 | 🟡 Pre-closeout — implementation/local foundation neredeyse tamam` → `🟢 Phase 9 V1 PASS (YYYY-MM-DD)`

Header status satırı:
```
> **Status:** 🟢 EtsyHub V1 release-ready — tüm phase'ler PASS (YYYY-MM-DD)
```

### 6.2 Genel durum satırı
Mevcut: `1 phase 🟢 PASS, 5 phase ✅ Live, 2 phase 🟡 manual QA pending, 1 phase 🟡 pre-closeout`
Yeni: `9 phase 🟢 PASS / Live; release-ready (YYYY-MM-DD)`

### 6.3 Manual QA kuyruğu tablosu
Tüm satırlar `⏳ pending` → `✅ PASS (YYYY-MM-DD)` veya `✅ honest-fail PASS — external dep blocked`

### 6.4 Bu runbook
- `final-closeout-runbook.md` "Closeout tamamlandı" notu eklenebilir; veya bu doc kalıcı arşiv (gelecekte V1.1 closeout için referans)

---

## V1.1+ / V2 carry-forward (release-readiness.md ile uyumlu)

Bu işler V1 sözleşmesinde **kasıtlı olarak yok**; PASS ilanını engellemez:
- **Phase 9.1+** — token refresh BullMQ worker, per-render PNG/JPG endpoint, admin taxonomy UI, DB-backed `ProductType.etsyTaxonomyId Int?`
- **V2** — Etsy active publish (`state: "active"`), multi-store, custom mockup upload (Spec §10), AI-assisted style variant
- **Phase 10+** — Admin theme token editor, advanced analytics, cost tracking integration
- **Auth** — Google sign-in / forgot password (intentional MVP scope dışı)
- **Test gap** — 7 admin endpoint integration test (audit pass bulgusu, V1.1+ pragmatik)
- **Nice-to-have** — ReviewReadinessSummary Settings component, Phase 6 inline review provider rehberi

---

## Kısa özet (TL;DR)

1. Env'i kur (0.1 zorunlu; 0.2 + 0.3 opsiyonel — yoksa honest-fail path)
2. Phase 6 manual QA → PASS veya honest-fail PASS
3. Phase 7 — otomatik aktif (test gerekmez)
4. Phase 8 manual QA → PASS
5. Phase 9 manual QA → PASS veya honest-fail PASS
6. release-readiness.md `🟡` → `🟢` update + Bulgular section'larına PASS işaretle

**"PASS" / "tamamlandı" ilan etme sorumluluğu kullanıcı/admin'in.** Bu doc ne zaman PASS edilebilir + ne zaman honest-fail PASS yeterli sınırını net çizer.
