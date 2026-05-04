# Phase 8 Mockup Studio — Manuel QA Checklist

> **Tarih:** 2026-05-02 (sync 2026-05-04 — QA fixture + Phase 7→8 köprü aspectRatio resolve fix)
> **Phase 8 status:** 🟡 **Pending — A-O browser smoke pending (Apply + S8 + köprü + ZIP canlı PASS)** (HEAD `e4eb36d`+). Kod-otomasyon gate'leri PASS; Selection Studio entry browser render PASS; QA fixture seed (`scripts/seed-qa-fixtures.ts`) admin user için ready SelectionSet + terminal MockupJob + cover invariant + MinIO sample PNG'ler üretiyor. **Yeni: Phase 7→8 köprü `getSet` items[].aspectRatio resolve fix** (Spec §1.4 fallback chain) — Apply page Quick Pack default önceden "0 görsel üretilecek" + "Render et" disabled idi; fix sonrası "6 görsel üretilecek" + "Render et" enabled (canlı doğrulandı). A-O ana akış (S3-S8 + ZIP + cover swap + per-render retry/swap) artık tam yürünebilir; Phase 8 self-contained (KIE bağımsız Sharp local renderer); runbook 4.2 honest-fail path YOK — tam A-O kullanıcı/admin browser smoke koşumu sonrasında PASS ilan edilir.
> **Önkoşul:**
>   - `npm run dev` (Next.js dev server)
>   - Postgres + MinIO + Redis local'de çalışıyor olmalı (Phase 7 emsali)
>   - `npm run worker` (BullMQ worker süreci arka planda)
>   - Test user: `admin@etsyhub.local` / `admin12345`
>   - Seed: en az 1 `status=ready` SelectionSet (admin user) + 8 ACTIVE MockupTemplate (`categoryId="canvas"`) + her biri için en az 1 ACTIVE binding
> **Spec referans:** [`../../plans/2026-05-01-phase8-mockup-studio-design.md`](../../plans/2026-05-01-phase8-mockup-studio-design.md) — §5.1-5.7
> **Closeout doc:** [`./phase8-closeout.md`](./phase8-closeout.md)
> **Phase 7 emsali:** [`./phase7-manual-qa.md`](./phase7-manual-qa.md)

Bu doküman Phase 8 V1 closeout'unun **manuel QA katmanı**. Subagent /
otomasyon tarafından yürütülemez (gerçek tarayıcı + gerçek MinIO render
output + gerçek BullMQ worker bekleyiş + gerçek ZIP extract gözle
değerlendirme gerektirir).

Aşağıdaki bölümleri sırayla geçin, sonuçları her satırın yanındaki kutuya
işaretleyin (`[x]` yapın). Sürpriz bulgu olursa bu dosyaya `## Bulgular —
YYYY-MM-DD` başlığı altında ekleyin; gerekirse closeout doc
([`./phase8-closeout.md`](./phase8-closeout.md)) drift olarak yansıtın.

**Önemli:** Bu checklist hazırlandığı anda **henüz koşturulmadı**. Tüm
checkbox'lar boş `[ ]`. Kullanıcı koşum sonrası tikleyecek.

---

## Önkoşul env doğrulaması

Tüm senaryolar başlamadan önce:

- [ ] `docker ps` ile Postgres + Redis + MinIO container'ları RUNNING
- [ ] `npm run dev` başlatıldı (3000 portunda, healthy)
- [ ] `npm run worker` başlatıldı (BullMQ worker logging görünür)
- [ ] `/login` → `admin@etsyhub.local` / `admin12345` ile giriş başarılı
- [ ] **QA fixture seed script çalıştırıldı (A-O senaryoları için):**
  ```bash
  npx tsx scripts/seed-qa-fixtures.ts
  ```
  Beklenen output:
  - **COMPLETED set + job** (10 SUCCESS render, A-H + I cover swap senaryoları için)
  - **PARTIAL_COMPLETE set + job** (8 SUCCESS + 2 FAILED render, J Per-render retry + K Per-render swap + L Failed render UI 5-class hata sözlüğü senaryoları için; FAILED render'lar pos=4 RENDER_TIMEOUT + pos=9 SOURCE_QUALITY)
  - 6 Asset + 3 GeneratedDesign (3 farklı review state — Phase 6 için de kullanılır)
  Console'da setId / jobId / result page URL'leri yazdırılır. Reset için `--reset` flag.
- [ ] `/selection` index sayfasında **"[QA] Phase 8 fixture set"** + **"[QA] Phase 8 PARTIAL fixture set"** kartlar `ready` durumda görünür
- [ ] Admin seed: en az 1 ACTIVE MockupTemplate `canvas` kategorisinde mevcut (production seed'den)
- [ ] Her template için en az 1 ACTIVE MockupTemplateBinding mevcut
  - Not: V1'de `provider=DYNAMIC_MOCKUPS` binding'leri yok (Task 12 KOŞULLU); `provider=LOCAL_SHARP` binding'leri olmalı

---

## A. S3 Apply landing

> **Hedef:** Spec §5.2 — S3 ana karar ekranı.
>
> **Hazırlık:** `/selection` → ready set "Aç" → set detay → URL'den setId al → `/selection/sets/[setId]/mockup/apply` navigate.

- [ ] Sayfa yüklenir, breadcrumb "Selection / [Set Adı] / Mockup Studio" görünür (sticky header)
- [ ] Zone 2 (Set Özeti) — hero variant thumbnail görünür (rank 0 = `position` ASC ilk SelectionItem, status≠rejected)
- [ ] Zone 2 — variant sayısı görünür ("X variant")
- [ ] Zone 2 — Phase 7 set detail link (`/selection/sets/[setId]`) tıklanabilir
- [ ] Zone 3 (Pack Önizleme) — "★ Quick Pack" rozet görünür (default state)
- [ ] Zone 3 — "X görsel üretilecek" sayım dürüst (Spec §2.5: actualPackSize)
- [ ] Zone 3 — TemplateChip dizisi default 6 template gösterir (selectQuickPackDefault)
- [ ] Zone 3 — "+ Template Ekle" + "Özelleştir →" butonları görünür
- [ ] Zone 3 — ⓘ diversity tooltip görünür (Quick Pack'te)
- [ ] Zone 4 (Karar bandı) — "Tahmini süre: ~Xs" görünür
- [ ] Zone 4 — "Render et (Quick Pack)" CTA enabled (selectedTemplateIds > 0)
- [ ] Zone 4 — sticky footer (scroll'da yapışık kalır)

---

## B. Customize drawer (S1 Browse)

> **Hedef:** Spec §5.3 — Sağdan slide-in template kütüphanesi.
>
> **Hazırlık:** A bölümündeki S3 ekranında "+ Template Ekle" butonuna tıkla.

- [ ] Drawer sağdan slide-in animasyonla açılır (~50% viewport width)
- [ ] URL `?customize=1` query parametresi eklenir
- [ ] "Template Kütüphanesi" heading görünür
- [ ] 3 filter chip: Vibe + Room + Aspect dropdown'ları görünür
- [ ] Filter taxonomy doğru (Spec §5.3 satır 1213-1215):
  - [ ] Vibe: All, Modern, Scandinavian, Boho, Minimalist, Vintage, Playful
  - [ ] Room: All, Living Room, Bedroom, Office, Nursery, Hallway, Dining
  - [ ] Aspect: All, 1:1, 2:3, 3:4
- [ ] Aspect filter default = set'in aspect'leri (varsa; yoksa "All")
- [ ] 8 template grid render olur (admin seed)
- [ ] Pakettekiler ✓ rozetli görünür (selectedTemplateIds match)
- [ ] "Pakette: X template" sayım üstte görünür
- [ ] Filter chip değişikliği → grid client-side filter eder (server'a istek gitmez)
- [ ] Min/max enforcement: 0 selected → inline alert "En az 1 template seç"
- [ ] Min/max enforcement: 8 selected'tan sonra ekleme denemesi → 3sn auto-clear warning "En fazla 8 template ekleyebilirsin"
- [ ] Esc tuşu → drawer kapanır + URL `?customize=1` temizlenir
- [ ] Header'daki "X" butonu → drawer kapanır + URL temizlenir
- [ ] Backdrop click → drawer kapanır + URL temizlenir (Task 32 reviewer minor notu — burada gerçek browser'da doğrulanır)

---

## C. S2 Detail modal

> **Hedef:** Spec §5.4 — Drawer üstünde template detay modal.
>
> **Hazırlık:** B bölümünde drawer açıkken bir template card'a tıkla.

- [ ] Modal center'da açılır (~60% viewport)
- [ ] Backdrop S1 drawer'ı blur'lar (`backdrop-blur-sm`)
- [ ] URL `?customize=1&templateId=X` (her ikisi birden)
- [ ] Modal header'da template adı + "X" kapama butonu
- [ ] Static preview placeholder görünür (V1: gerçek render YOK; sadece base + safeArea overlay placeholder)
- [ ] Meta gösterimi:
  - [ ] Aspect: `template.aspectRatios.join(", ")`
  - [ ] Tags: `template.tags.join(", ")`
  - [ ] Tahmini render süresi: `~X saniye` (`estimatedRenderMs / 1000`)
- [ ] CTA: `isSelected ? "✓ Pakette • Çıkar" : "+ Pakete ekle"` toggle
- [ ] Toggle tıkla → URL `?t=` update + modal AÇIK kalır (Spec §5.4 satır 1253 — kullanıcı diğer template'lere geçebilir)
- [ ] Toggle tekrar tıkla → tersine state (ekle ↔ çıkar)
- [ ] Min/max enforcement: 8 selected + non-selected modal açıkken CTA disabled + warning "En fazla 8 template ekleyebilirsin"
- [ ] Esc tuşu → modal kapanır, drawer AÇIK kalır (Spec §5.4 satır 1252)
- [ ] Modal kapanınca URL `templateId=` temizlenir, `customize=1` korunur
- [ ] Header "X" butonu → modal kapanır
- [ ] Backdrop click → modal kapanır (drawer arkada açık görünür)

---

## D. Submit flow (S3 → S7)

> **Hedef:** Spec §4.1 — POST /api/mockup/jobs + S3 → S7 redirect.
>
> **Hazırlık:** S3'te selectedTemplateIds.length ≥ 1 (default Quick Pack veya custom).

- [ ] "Render et (Quick Pack)" / "Render et (Custom Pack)" CTA tıkla
- [ ] CTA label "Hazırlanıyor..." + spinner görünür (isSubmitting state)
- [ ] CTA disabled olur (double-submit önlenir)
- [ ] DevTools Network tab'da `POST /api/mockup/jobs` 202 response (body: `{ jobId }`)
- [ ] Sayfa `/selection/sets/[setId]/mockup/jobs/[jobId]` path'ine redirect olur
- [ ] Submit error senaryosu (örn. server kapalı): inline alert "Render başlatılamadı: [error]" + CTA enabled (retry mümkün)

---

## E. S7 polling

> **Hedef:** Spec §5.5 — S7 Job render progress sayfası.
>
> **Hazırlık:** D bölümünden sonra S7 sayfasında.

- [ ] Breadcrumb "Selection / [Set] / Mockup / Job" görünür (sticky header)
- [ ] Progress ring "X/Y render hazır" gösterir (X = successRenders, Y = totalRenders)
- [ ] ETA "~X saniye kaldı (yaklaşık)" görünür (running state, estimatedCompletionAt'ten hesap)
- [ ] Per-render timeline list:
  - [ ] Status icon: ✓ (SUCCESS) / ◐ (RENDERING) / ⊙ (QUEUED) / ⚠ (FAILED)
  - [ ] "X. {templateName} × {variantId}" (cover slot ise "Cover" prefix)
  - [ ] Süre: success'te `(completedAt - startedAt) / 1000`s
- [ ] Polling 3sn interval (DevTools Network tab'da `/api/mockup/jobs/[jobId]` her 3sn'de tekrar fetch)
- [ ] Terminal'e ulaşınca polling durur (refetchInterval false)
- [ ] "Bu sayfayı kapatabilirsin. Job arka planda devam eder." güvence metni görünür (running state)
- [ ] Cancel butonu görünür (queued/running state, sticky alt köşe)
- [ ] Cancel tıkla → `POST /api/mockup/jobs/[jobId]/cancel` 202 → status CANCELLED
- [ ] Cancel sonrası: pending render'lar FAILED + errorClass=null (kullanıcı eylemi)
- [ ] CANCELLED state UI: "Job iptal edildi" + "S3'e dön" butonu

---

## F. S7 → S8 auto-redirect

> **Hedef:** Spec §5.5 satır 1304-1311 — yumuşatma 250-500ms feedback + router.replace.
>
> **Hazırlık:** S7'de tüm render'lar terminal'e ulaşana kadar bekle (COMPLETED veya PARTIAL_COMPLETE).

- [ ] Kısa success feedback görünür: "Pack hazır! X/Y ✓"
- [ ] ~400ms sonra otomatik `/selection/sets/[setId]/mockup/jobs/[jobId]/result` path'ine geçiş
- [ ] S7 history'den silinir (router.replace, geri tuşu S7'ye dönmez — başka sayfaya gider)
- [ ] FAILED state'te auto-redirect YOK; "Pack hazırlanamadı" + "Yeniden dene" + "S3'e dön"

---

## G. S8 cover + grid

> **Hedef:** Spec §5.6 — S8 Result pack teslim sayfası.
>
> **Hazırlık:** F bölümünden sonra S8 sayfasında.

- [ ] Header "Pack hazır: X/Y görsel" (X = successRenders, Y = actualPackSize)
- [ ] Cover slot sol üst, daha büyük (örn. 1×2 grid cell)
- [ ] Cover slot'ta "★ Cover" rozeti
- [ ] Cover invariant doğrulama: cover render'ın `packPosition === 0` (DevTools Inspector veya manuel kontrol)
- [ ] 9 sub-slot grid (3+3+3 veya 3+3+3+1 layout)
- [ ] Sub-slot'larda render thumbnail + slot numarası
- [ ] Per-render hover overlay açılır:
  - [ ] Success: "Cover Yap" (cover swap modal tetikler) + "Büyüt" (V1 disabled veya placeholder)
  - [ ] Failed: 5-class error rozet + retry/swap action butonları
- [ ] Partial complete (8/10): header "Pack hazır: 8/10 görsel" + "⚠ 2 render başarısız oldu" alert
- [ ] All failed (success=0): "Pack üretilemedi" + hata özeti + "S3'e dön" + "Phase 7'ye dön" recovery CTA'ları
- [ ] Status guard: URL manuel `/result`'e gidilirse + status ∉ {COMPLETED, PARTIAL_COMPLETE} → S7'ye otomatik redirect

### G.1 — Phase 9 köprüsü: "Listing'e gönder" CTA

> **Hedef:** Phase 8 → Phase 9 V1 handoff (Task 19) canlı; CTA active ve yeni listing draft sayfasına yönlendirir.

- [ ] S8 başarılı pack ekranında "Listing'e gönder →" button visible ve **enabled**
- [ ] Button tıkla → button "Listing yaratılıyor..." (loading state)
- [ ] Network tab: `POST /api/listings/draft` → 202 response + body `{listingId: "..."}`
- [ ] Otomatik redirect: `/listings/draft/[listingId]` (Phase 9 V1 detay sayfası)
- [ ] Yeni listing detay sayfası yüklendi (DRAFT status, başlık boş, AssetSection cover/grid + readiness checklist)
- [ ] DB'de Listing row yaratıldı: `userId`, `mockupJobId` (source MockupJob), `coverRenderId`, `imageOrderJson` snapshot
- [ ] Cross-user 404: başka user ile login → aynı `mockupJobId`'yi `POST /api/listings/draft`'a manuel gönder → 404 honest fail

---

## H. Bulk ZIP download

> **Hedef:** Spec §4.6 — bulk ZIP cover-first ordering + manifest.

- [ ] "⬇ Bulk download ZIP (X görsel)" butonu görünür
- [ ] Tıkla → ZIP download başlar (browser indirme dialog)
- [ ] ZIP filename `mockup-pack-[jobId].zip`
- [ ] ZIP extract et, içerik kontrol:
  - [ ] `01-cover-{templateName}-{variantSlug}.png` (cover, packPosition=0)
  - [ ] `02-{templateName}-{variantSlug}.png` (success sırası 2)
  - [ ] ... `0X-{...}.png` (success sırası X)
  - [ ] `manifest.json` mevcut
- [ ] Failed slot'lar ZIP'te YOK (numbering boşluksuz — partial complete 8/10 ise dosyalar 01-08, packPosition'da 4 ve 9 boş olabilir)
- [ ] manifest.json içerik doğrulama:
  - [ ] `jobId`, `status`, `packSize`, `actualPackSize`, `coverRenderId`
  - [ ] `images[]` her birinde `{ filename, packPosition, renderId, variantId, templateName, isCover }`
  - [ ] `failedPackPositions[]` failed render'ların packPosition'larını içerir
  - [ ] `exportedAt` ISO datetime

---

## I. Cover swap modal

> **Hedef:** Spec §5.6 + §4.8 — cover invariant atomic slot swap.
>
> **Hazırlık:** S8'de en az 2 success render var.

- [ ] Cover slot'a tıkla → CoverSwapModal açılır
- [ ] Modal'da alternative grid: success render'lar (current cover hariç, max 9)
- [ ] Alternative tıkla → `POST /api/mockup/jobs/[jobId]/cover` 200
- [ ] Modal kapanır
- [ ] Cover slot anında yeni render thumbnail gösterir
- [ ] Eski cover swap edilen slot'a geçer (atomic invariant: yeni cover packPosition=0, eski cover newCover'ın eski position'ı)
- [ ] DevTools Network: `coverRenderId` job response'da yeni renderId
- [ ] 400 senaryoları:
  - [ ] INVALID_RENDER (renderId job'a ait değil)
  - [ ] RENDER_NOT_SUCCESS (status≠SUCCESS render seçilirse)
  - [ ] ALREADY_COVER (aynı render'a tıklarsa açık reddet, no-op DEĞİL)

---

## J. Per-render retry (failed render)

> **Hedef:** Spec §4.5 + §7.2 — retry policy V1 (sadece RENDER_TIMEOUT + PROVIDER_DOWN, cap=3).
>
> **Hazırlık:** Partial complete senaryosu — en az 1 RENDER_TIMEOUT veya PROVIDER_DOWN failed render. (Test setup: BullMQ worker'a kasıtlı timeout veya MinIO down simülasyonu)

- [ ] Failed slot'ta "↻ Tekrar dene" butonu görünür (RENDER_TIMEOUT veya PROVIDER_DOWN için)
- [ ] Click → `POST /api/mockup/jobs/[jobId]/renders/[renderId]/retry` 202
- [ ] Render status PENDING'e döner (UI yansıma, refetchQueries)
- [ ] retryCount artar (DB veya UI tracking)
- [ ] S7 polling otomatik resume (job artık terminal değil, status RUNNING'e döner)
- [ ] Retry cap aşıldıysa (3) → 409 RETRY_CAP_EXCEEDED + UI uyarısı
- [ ] Retryable olmayan errorClass'lar (TEMPLATE_INVALID, SAFE_AREA_OVERFLOW, SOURCE_QUALITY) için "Tekrar dene" butonu görünmez (sadece "Swap")

---

## K. Per-render swap (failed render)

> **Hedef:** Spec §4.4 — manuel swap deterministik alternatif (variantId, bindingId) pair.
>
> **Hazırlık:** Failed render mevcut.

- [ ] Failed slot'ta "↺ Swap" butonu görünür (5-class hata için, RENDER_NOT_SUCCESS değil yani yalnız failed'da)
- [ ] Click → `POST /api/mockup/jobs/[jobId]/renders/[renderId]/swap` 202
- [ ] Eski render arşivlenir (packPosition=null)
- [ ] Yeni MockupRender PENDING durumunda yaratılır (aynı packPosition + selectionReason, deterministik alternatif (variantId, bindingId))
- [ ] BullMQ queue'ya dispatch edilir (`MOCKUP_RENDER` job)
- [ ] S7 polling resume (job RUNNING)
- [ ] No alternative pair varsa → 409 NO_ALTERNATIVE_PAIR + UI "Alternatif kombinasyon yok" mesaj

---

## L. Failed render UI (5-class hata sözlüğü)

> **Hedef:** Spec §5.6 satır 1422-1428 — 5-class hata × eylem önerisi.
>
> **Hazırlık:** Her error class için en az 1 failed render. Test setup zorlu — manuel olarak DB'de errorClass field'ı set ederek simüle edilebilir.

| Error class | Slot rozeti (beklenen) | Eylem butonları (beklenen) |
|---|---|---|
| `RENDER_TIMEOUT` | "Zaman aşımı" | [↻ Tekrar dene] + [↺ Swap] |
| `TEMPLATE_INVALID` | "Şablon geçersiz" | [↺ Swap] (retry yok) |
| `SAFE_AREA_OVERFLOW` | "Tasarım sığmadı" | [↺ Swap] (retry yok) |
| `SOURCE_QUALITY` | "Kaynak yetersiz" | [↺ Swap] + Phase 7 link |
| `PROVIDER_DOWN` | "Motor erişilemez" | [↻ Tekrar dene] (sistem geri gelmiş olabilir) |

- [ ] Her satır gerçek browser'da doğrulanır (rozet + eylem butonları doğru)

---

## M. Cross-user 404 (varlık sızıntısı yok)

> **Hedef:** Phase 6/7 emsali 404 disipline — "var ama senin değil" ile "yok" istemciden ayırt edilemez.
>
> **Hazırlık:** İkinci admin user oluştur (Prisma Studio veya `psql`) veya farklı browser session'da farklı admin.

- [ ] User A (admin1) ile bir job submit et, jobId al (örn. `clxxx...`)
- [ ] User B (admin2) ile login ol, navigate `/selection/sets/[admin1-setId]/mockup/jobs/[admin1-jobId]`
- [ ] Beklenen: 404 sayfası ("Bulunamadı" / Phase 7 emsali notFound rendering)
- [ ] Aynı şekilde `/result` path'te 404
- [ ] API direkt: `GET /api/mockup/jobs/[admin1-jobId]` (admin2 session) → 404 JSON response
- [ ] `POST /api/mockup/jobs/[admin1-jobId]/cancel` → 404
- [ ] `POST /api/mockup/jobs/[admin1-jobId]/renders/[renderId]/retry` → 404
- [ ] `POST /api/mockup/jobs/[admin1-jobId]/cover` → 404
- [ ] `GET /api/mockup/jobs/[admin1-jobId]/download` → 404

---

## N. Completion toast (Spec §5.7)

> **Hedef:** S7 mount'lu iken job terminal'e geçince in-app toast emit.
>
> **Hazırlık:** S7 sayfasında render polling devam ediyor.

- [ ] RUNNING → COMPLETED transition'da toast emit:
  - [ ] Tone: success
  - [ ] Mesaj: "Pack hazır: X görsel — Sonucu gör"
  - [ ] Source: `mockup-job` (DevTools veya toast UI inspect)
- [ ] RUNNING → PARTIAL_COMPLETE transition'da:
  - [ ] Tone: success
  - [ ] Mesaj: "Pack hazır: X/Y görsel — Sonucu gör" (dürüst sayım)
- [ ] RUNNING → FAILED transition'da:
  - [ ] Tone: error
  - [ ] Mesaj: "Pack hazırlanamadı"
- [ ] RUNNING → CANCELLED transition'da:
  - [ ] Toast emit ETMEZ (kullanıcı kendi eylemi — Spec §5.7)
- [ ] Aynı terminal'de re-render olursa re-push OLMAZ (debounce guard)
- [ ] **V1 dürüst sınırlama:** Hook S7 mount'lu iken çalışır. Kullanıcı S7'den ayrılır + başka tab/sayfada bekler iken toast emit olmaz (CF11 + Phase 7 emsali sınırlama). Bu davranış doğrulansın:
  - [ ] S7'yi açıp render başlat → başka tab'a geç → render tamamlanınca dönüş yap → toast YOK (beklenen V1 davranışı)

---

## O. Backdrop davranışları (Task 32 reviewer minor notu)

> **Hedef:** Drawer + modal click-outside ile kapanır mı?
>
> **Sebep:** E2E senaryo 5'te `data-testid="drawer-backdrop"` component'te yok; manuel QA'da gerçek doğrulama.

- [ ] Drawer açıkken backdrop'a tıkla (drawer dışındaki karartılmış alan)
  - [ ] Drawer kapanır
  - [ ] URL `?customize=1` temizlenir
- [ ] Modal açıkken backdrop'a tıkla
  - [ ] Modal kapanır
  - [ ] Drawer AÇIK kalır
  - [ ] URL `templateId=` temizlenir, `customize=1` korunur

---

## P. E2E suite gerçek koşum

> **Hedef:** Task 32 Playwright E2E suite gerçek browser + backend ile doğrulansın.

- [ ] `npm run test:e2e` çalıştır
- [ ] 5 senaryo sonucu raporla:
  - [ ] Test 1 (S3 Apply landing): pass / skip / fail
  - [ ] Test 2 (Customize drawer): pass / skip / fail
  - [ ] Test 3 (Template detail modal): pass / skip / fail
  - [ ] Test 4 (Render CTA state): pass / skip / fail
  - [ ] Test 5 (X/backdrop close): pass / skip / fail
- [ ] Skip varsa sebep: "ready set yok" gibi DB-state aware (Phase 7 emsali graceful) — fail değil
- [ ] Fail varsa: bulgu olarak aşağıya yansıt

---

## Önemli ayrım — bug vs ürün-kararı vs BLOCKED

| Bulgu tipi | Aksiyon |
|---|---|
| **Bug** (beklenen ≠ gerçekleşen, kod hatası) | "## Bulgular" başlığı altında raporla; closeout doc'ta drift olarak işaretle; gerekirse fix commit |
| **Ürün kararı** (V1'de bilinçli kapalı affordance — örn. per-render download YOK, AI variant YOK) | Bulgu DEĞİL; closeout doc "Dürüst sınırlamalar" + "Teknik borç" bölümünde zaten dokümante |
| **BLOCKED** (Task 0/10/12 — human dep veya teknik blok) | Bulgu DEĞİL; closeout doc "Dürüst sınırlamalar" bölümünde dokümante |

---

## Bulgular — 2026-05-04 (QA fixture + Phase 7→8 aspectRatio resolve fix, HEAD `e4eb36d`+)

**Genel sonuç:** 🟡 **Pending — A-O browser smoke pending (Apply + S8 + köprü + ZIP canlı PASS).** Selection Studio entry browser PASS + QA fixture seed + getSet aspectRatio fix sonrası: Apply page Quick Pack default canlı + S8 result + Phase 9 köprüsü + ZIP route canlı doğrulandı. Tam A-O akışı kullanıcı browser smoke'una hazır.

### 🟢 PASS — Canlı doğrulanmış

- **Selection Studio (`/selection`) entry render:** browser canlı PASS — H1 "Selection Studio", H2 "Aktif draft" + H2 "Son finalize edilen set'ler", Türkçe empty state ("Henüz aktif draft set yok" / "Henüz finalize edilen set yok").
- **Phase 9 köprüsü S8 → listing draft (Phase 9 A.1 + A.2):** Phase 9 manual QA execution turunda cross-user 404 + terminal status guard canlı PASS (handoff endpoint integration testler 6 senaryo ✓).

#### QA fixture + Phase 7→8 aspectRatio resolve fix sonrası canlı doğrulama (2026-05-04, HEAD `e4eb36d`+)

**Phase 7→8 köprü gerçek bug + fix (HEAD `e4eb36d`+):** Apply page Quick Pack default önceden `0 görsel üretilecek` + `Render et` disabled — root cause: `getSet` service'ı `items[].aspectRatio`'yu döndürmüyordu (Spec §1.4 fallback chain "backend'de" diyordu ama uygulanmamıştı). Hook `useMockupPackState` `extractVariants` boş array döndürüyor → `selectQuickPackDefault` 0 template → 0 valid pair. Fix: `getSet` mapper'a `productType` include + `items[].aspectRatio = generatedDesign.productType.aspectRatio ?? null` resolve. **Bu sadece QA fixture'ı değil, üretim akışını da düzeltti** — herhangi bir gerçek SelectionSet (variation→review→selection finalize) artık Apply page'de Quick Pack default 6 template otomatik seçecek.

**Browser canlı doğrulama (HEAD `e4eb36d`+):**

- **`/selection` Selection Studio kart:** "[QA] Phase 8 fixture set / Finalize: 04 May 2026 / Ready" görünüyor. Empty state kayboldu.
- **`/selection/sets/[setId]/mockup/apply` (S3 Apply landing):** H1 fixture set adı + breadcrumb "← Selection / [QA] Phase 8 fixture set / Mockup Studio"; "Toplam 3 tasarım seçili"; "Hazır" status; "★ Quick Pack" rozet; **aspectRatio fix sonrası: "6 görsel üretilecek" + "Render et (Quick Pack)" enabled + "Tahmini süre: ~30 saniye"** (önceki state "0 görsel üretilecek" + "Render et" disabled idi — Phase 7→8 köprü `getSet` aspectRatio resolve fix HEAD `e4eb36d`+ ile düzeldi).
- **`/selection/sets/[setId]/mockup/jobs/[jobId]/result` (S8 result page):** H1 "Pack hazır: 10/10 görsel"; 10 görsel render ediliyor (qa-fixture/mockup-pos-0..9.png); 5 CTA: "⬇ Bulk download ZIP (10 görsel)", "Listing'e gönder →", "Cover'ı Değiştir", "İndir", "Listingler".
- **Phase 9 köprüsü canlı doğrulandı:** `POST /api/listings/draft { mockupJobId }` 202 + listingId. Listing detail sayfasında `imageOrder.length=10`, `coverRenderId` set, cover image isCover:true packPosition:0 outputKey valid; readiness "Kapak görseli hazır" pass:true.
- **AssetSection cover render canlı:** Yeni listing'in detail sayfasında cover image (qa-fixture/mockup-pos-0.png) görünüyor + 9 grid image; "ZIP İndir" link aktif; "✓ ZIP'e hazır" badge görünüyor.
- **ZIP download (Phase 9 ZIP route + Phase 8 buildMockupZip reuse):** `GET /api/listings/draft/[id]/assets/download` 200 application/zip + filename `listing-{cuid}.zip` + ZIP magic bytes (PK\x03\x04) + 64KB content.

A-O senaryolarının **tetiklenebilir + tam yürünebilir** olduğu canlı doğrulandı:
- **A S3 Apply landing PASS** (Quick Pack default 6 template + "Render et" enabled)
- **G S8 cover + grid + G.1 Phase 9 köprüsü PASS**
- **H Bulk ZIP PASS**
- B (S1 Browse drawer) + C (S2 Detail modal) + D (Submit flow) + E (S7 polling) + F (S7→S8 auto-redirect) + I (Cover swap modal) + J/K (Per-render retry/swap) + L (Failed render UI) + M (Cross-user 404) + N (Completion toast) + O (Backdrop) **kullanıcı/admin tarafında pending** — fixture + üretim akışı (aspectRatio fix) ikisi de canlı, doğrudan koşturulabilir.

### 🟡 NOT

- **Otomasyon kalite gate'leri (önceki tur):** TS strict 0, lint clean, token check pass, 1396 + 845 test yeşil (Phase 8 V1 baseline). Mevcut HEAD `dc3bf69`'de 1674 + 946 test PASS, Phase 8 dahil regression yok.

### 🔴 BLOCK

_(yok)_

### 🔵 V1.1 / V2 carry-forward

- **Phase 8 fixture seed:** admin user için 1 ready SelectionSet + 1 terminal MockupJob seed scripti — manual QA browser-based smoke'u admin için doğrudan açar.
- **Task 12 Dynamic Mockups real adapter:** V1'de stub-only.
- **Task 10 perspective Sharp render:** spike sonrası schema-only.
- **Per-render PNG/JPG download endpoint:** V1 bulk ZIP yeterli.

### Pending (manual QA browser smoke — fixture + üretim akışı hazır, kullanıcı koşturmalı)

QA fixture seed + Phase 7→8 aspectRatio fix sonrası A-O senaryolarının hepsi tam yürünebilir:

- **A S3 Apply landing** — ✅ canlı PASS (Quick Pack default 6 template + "Render et" enabled)
- **B S1 Browse drawer + C S2 Detail modal + D Submit flow + E S7 polling + F S7 → S8 auto-redirect** — apply → submit → polling → S8 redirect zinciri kullanıcı browser'da koşturabilir (Render et tıklanınca)
- **G S8 cover + grid + G.1 Phase 9 köprüsü** — ✅ canlı PASS
- **H Bulk ZIP** — ✅ canlı PASS (Phase 9 ZIP route üzerinden)
- **I Cover swap modal** — kullanıcı browser'da test edebilir
- **J Per-render retry + K Per-render swap + L Failed render UI** — ✅ **PARTIAL_COMPLETE fixture eklendi (HEAD `5af5ae7`+ sonrası, scripts/seed-qa-fixtures.ts)**: 2. SelectionSet + 2. MockupJob (status=PARTIAL_COMPLETE, 8 SUCCESS + 2 FAILED render). FAILED render'lar 5-class hata sözlüğünden 2 kategori içerir: pos=4 RENDER_TIMEOUT (retryable) + pos=9 SOURCE_QUALITY (non-retryable, swap önerisi). Browser canlı doğrulandı: H1 "Pack hazır: 8/10 görsel" + 8 İndir hover + 2 FAILED slot ("Retry" + "Swap" CTA enabled, errorClass + errorDetail Türkçe görünür).
- **M Cross-user 404** — Phase 9'da analog akış canlı PASS oldu (cross-user ownership disipline aynı pattern); Phase 8 endpoint'leri için integration testler 33 task kapsamında PASS
- **N Completion toast** — Phase 7 emsali baseline; Phase 8 fixture toast tetikleyici background completion için ayrı senaryo
- **O Backdrop davranışları** — kullanıcı browser'da koşturmalı

**Phase 8 V1 PASS sözleşmesi (runbook 4.1):** "Tüm bölümler PASS" — A-F + G+G.1 + H-O + P E2E. Fixture + aspectRatio fix sonrası A-O kapsamı **tam yürünebilir**; tam PASS ilanı için kullanıcı/admin browser smoke koşumu gerekli (özellikle B/C/D/E/F submit→polling→S8 zinciri ve I/J/K/L UI).

**Karar:** Phase 8 V1 status **🟡 Pending — A-O browser smoke pending (Apply + S8 + köprü + ZIP canlı PASS)** kalır; runbook 4.1 PASS sözleşmesi kullanıcı tarafında. Phase 9 V1 closeout PASS'i Phase 8 V1 PASS'a göre değil **runbook 5.2 honest-fail PASS sınırına göre** değerlendirildi.
