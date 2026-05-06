# Midjourney Web Bridge — Design Doc · Pass 41

**Tarih:** 2026-05-06
**Durum:** Design / Pre-implementation
**HEAD:** `3106088`

## 0. TL;DR

- **Discord yok, MJ web sitesi hedef.** Kullanıcının ülkesinde Discord engelli.
- **MJ resmi public API yok** (2026 Mayıs itibarıyla); sadece davete bağlı enterprise.
- **MJ TOS otomasyonu açıkça yasaklıyor**, kalıcı ban riski gerçek. Bu kısıt mimariyi belirler.
- **Captcha bypass / anti-bot bypass / TOS bypass YOK.** Tek meşru yol: kullanıcının kendi tarayıcısında, kendi oturumunda, kendi gözetimi altında çalışan **görünür** bir köprü.
- Önerilen: **EtsyHub yan komşusu lokal Node.js servisi** ("MJ Bridge") + **Playwright görünür browser** + **persistent profile** + **manuel intervention pause/resume** + **download-only ingestion**.
- Yani: **MJ tarafına hiçbir gizli/otomatik istek atmıyoruz** — kullanıcı MJ web'de oturup işini yapar; bridge yalnızca **download + import + lineage capture** yapar. Bu, banlanma riskini en aza indirir ve ürün-için-değerli capability'lerin %80'ini verir.
- **Provider pattern'imize uyumlu** (Phase 5 `ImageProvider`), ama farklı: `submit()` async kuyruk + manuel pause + result polling.
- **3rd party araçlar** (AutoSail, AutoJourney) ürün UX dersini öğretir ama **dependency olarak alınmaz** — kendimiz inşa ederiz.

---

## 1. Bağlam ve kısıtlar

### 1.1 Çevresel kısıtlar
- **Discord erişimi yok** (kullanıcı ülkesinde engelli) → web hedef tek seçenek.
- **MJ resmi API yok** → her programatik erişim "unofficial" sayılır.
- **MJ TOS** otomasyonu, scripting'i, third-party API'yi yasaklar (kalıcı ban).
- **Captcha / human verification** uzun oturumlarda görünür; bypass etmeyeceğiz.

### 1.2 Ürün kısıtları (CLAUDE.md)
- "Build from scratch. Do not copy code from any external repository."
- "AI may not generate uncontrolled render code."
- "Provider abstraction" — `providers/ai`, `providers/image` deseni mevcut.
- "Fail fast where correctness matters."
- "Job engine first-class objects" — BullMQ + state machine.

### 1.3 Etik / hukuki kısıt
- MJ TOS ihlali → kalıcı ban + **iade yok** (subscription kaybı).
- Kullanıcının **kendi MJ aboneliğini, kendi tarayıcısında, kendi gözünde** kullanması farklı bir konum: tarayıcı eklentilerinin yıllardır var olması ve MJ'nin doğrudan eklentilere ban kampanyası açmaması bunun **gri alan** olduğunu gösterir. Yine de ürün **kullanıcıyı uyarmalı** ve **görünür akış** sunmalı; "headless / arka plan / arka taraftan istek" yapmamalı.

### 1.4 Bu doc neyi hedeflemiyor
- ❌ Captcha auto-solve / 2captcha / anti-captcha API entegrasyonu
- ❌ Headless browser, stealth plugin, fingerprint bypass
- ❌ Discord otomasyonu
- ❌ Reverse-engineered private API çağrıları
- ❌ MJ tarafına direkt HTTP request atan "bridge" ya da proxy
- ❌ AutoSail / AutoJourney extension'ını fork'lamak veya reimplement etmek

---

## 2. Black-box: 3rd party araçlar

### 2.1 AutoSail for Midjourney (Chrome extension)
**Vaadleri** (chromewebstore'dan kamuya açık özet):
- Batch prompt submission (queue management)
- Otomatik upscale
- Batch download + prompt metadata local storage
- Relax Mode bypass (gece çalıştır, sabah uyan)
- Prompt template / prefix / suffix
- T2I, I2I, image-to-video desteği

**İma ettiği capability set**:
1. MJ web UI'sındaki prompt input + button click otomasyonu
2. Render bitiminde DOM event yakalama
3. Generated image URL + metadata (prompt, params) extraction
4. Batch download mechanism

**Bizim için anlamı**: Bu extension'ın **yaptığı şey teknik olarak mümkün** (DOM otomasyonu + metadata extraction) — ama bunu ürünümüzün omurgasına bağlamak iki şeye neden olur:
- Vendor lock-in: extension güncellemesi bizi kırar
- Ban riski: extension'ın yapma şekli MJ TOS'a uyar mı bilmiyoruz; bu riski **kullanıcıya devretmiş** oluruz

### 2.2 AutoJourney Downloader (desktop tool + extension)
**Vaadleri**:
- Browser extension + desktop "manager" hibrit
- Prompt, parameter, source link, Job ID, folder metadata persistence
- Smart search (prompt, platform, date, type, favorites)
- Built-in upscale / cutout / watermark removal
- Multi-platform multi-account
- Bulk download (browser crash önleme)

**İma ettiği capability**:
- Browser-side capture + native bridge mimarisi (extension ↔ desktop service messaging)
- Yapısal metadata schema (prompt + params + source link + job id + folder)

**Bizim için anlamı**: **Bridge mimarisi doğru fikir** — browser observer + lokal işlemci ayrımı. Ama bu spesifik ürün:
- VIP membership zorunlu (vendor lock)
- Watermark removal / cutout pazarlaması — bu *bizim* sorumluluğumuz değil
- Multi-platform birleşik UI bizim sorunumuz değil (Etsy odaklıyız)

### 2.3 Capability bazlı özet matrisi

| Capability | AutoSail | AutoJourney | EtsyHub'a değer |
|---|---|---|---|
| Prompt submit otomasyonu | ✓ | (extension'la) | ⚠ TOS gri alan; manuel daha güvenli |
| Auto-upscale | ✓ | ✓ | Düşük (Selection Studio'da Sharp upscale Pass 7 var) |
| Batch download | ✓ | ✓ | **Yüksek** — ana ingest yolu |
| Prompt+params metadata capture | ✓ | ✓ | **Yüksek** — lineage için zorunlu |
| Job ID capture | (kısmi) | ✓ | **Yüksek** — re-run/incele için |
| Local file management | (yok) | ✓ | Orta — bizde Asset model var |
| Multi-account | (yok) | ✓ | Düşük — V1 tek kullanıcı |
| Watermark removal | (yok) | ✓ | ❌ Bize değmez |

### 2.4 Üç kova
1. **Capability olarak almak mantıklı**: download + metadata capture + lineage
2. **Ürün deneyimi olarak ilham al**: queue UI, prompt template, "gece çalıştır sabah uyan" pattern (ama biz bunu inline değil **manuel batch** olarak sunarız)
3. **Dışa bağımlı kalmamalı**: extension capability'lerini *kendi* bridge'imizde inşa et
4. **Bizim sistemde gereksiz**: watermark removal, multi-platform unified UI, built-in upscale

---

## 3. Mimari karar: Local Bridge + Visible Browser

### 3.1 Aday yaklaşımlar

**A. Sadece Chrome extension yazmak (DOM scripting)**
- Pro: kullanıcının zaten açık olduğu bağlamda çalışır; oturum doğal
- Con: extension'lar Chrome Web Store onayı gerektirir; Manifest V3 kısıtları (background SW); EtsyHub UI ile state senkronizasyonu zor; storage limited; bana background polling pattern'i uygun değil
- **Verdict**: Anlamlı **destekleyici** olabilir (örn. yardımcı UI), ama omurga değil

**B. EtsyHub içinde server-side Playwright (lokal)**
- Pro: BullMQ worker pattern'iyle tek tip; persistent context bizim kontrolümüzde
- Con: Worker süreci kullanıcı browser oturumuyla ilişkili olamaz (ayrı profile); MJ'ye **headless** istek attığımız izlenimi yaratır → ban riski en yüksek
- **Verdict**: ❌ Reddedildi

**C. Local MJ Bridge servisi (ayrı proses, görünür browser, persistent profile)**
- Pro: kullanıcının tarayıcısı **gözle görülür**, **manuel müdahale doğal**, **persistent profile** ile oturum + cookie + Cloudflare token tek seferlik kurulur, **EtsyHub server-side worker ile temiz interface**
- Con: ekstra prosess; kullanıcının ekranını işgal eder (visible browser); persistent profile path konfigürasyonu; sürdürülebilir versioning gerek
- **Verdict**: ✅ **Önerilen omurga**

**D. Hybrid (Local Bridge omurga + opsiyonel companion extension)**
- Pro: bridge omurga, extension yardımcı (ör. "import current selection" buton)
- Con: iki cephe; karmaşıklık
- **Verdict**: V2'de değerlendirilebilir; V1'de **sadece local bridge** yeter

### 3.2 Seçilen mimari

```
┌────────────────────────────────────────────────────────────┐
│ EtsyHub (Next.js)                                           │
│  ├── /references/[id]/variations  (UI: Üretim Atölyesi)    │
│  │     "Midjourney" mode chip eklenir                       │
│  ├── BullMQ worker:  midjourney-web-bridge.worker.ts        │
│  │     → MJBridge HTTP client                               │
│  ├── Provider:        providers/image/midjourney-bridge.ts  │
│  │     ImageProvider impl; submit / poll                    │
│  ├── DB:              MidjourneyJob, MidjourneyAsset        │
│  │                    (yeni tablolar; aşağıda §6)           │
│  └── Admin:           /admin/midjourney  (bridge sağlığı)   │
└─────────────────┬──────────────────────────────────────────┘
                  │  HTTP localhost:8780  (auth: shared secret)
                  ▼
┌────────────────────────────────────────────────────────────┐
│ MJ Bridge — bağımsız Node.js servis (yerel)                 │
│  ├── Express / Fastify HTTP server                          │
│  │     POST  /jobs            enqueue                       │
│  │     GET   /jobs/:id        poll                          │
│  │     POST  /jobs/:id/resume manuel devam (challenge sonra)│
│  │     POST  /jobs/:id/cancel                               │
│  ├── Job queue (in-memory + disk persistence; ayrı Redis    │
│  │   gerekmez; tek kullanıcı, düşük concurrency)            │
│  ├── Playwright (chromium, **headless: false**)             │
│  │   - persistent profile dir (./mj-profile)                │
│  │   - tek browser instance, sürekli açık                   │
│  ├── Page automator                                         │
│  │   - prompt submit (input fill + Enter)                   │
│  │   - render polling (DOM mutation observer)               │
│  │   - download (image link → fs)                           │
│  │   - challenge detection (Cloudflare iframe / captcha     │
│  │     iframe URL pattern)                                  │
│  └── State machine + Job log (persisted JSONL)              │
└────────────────────────────────────────────────────────────┘
```

### 3.3 Iletişim sözleşmesi
- Loopback HTTP (`http://127.0.0.1:8780`) — sadece localhost'tan erişilebilir
- Shared secret header `X-Bridge-Token` (kullanıcı `.env.local`'den oluşturur, EtsyHub server-side worker bilir)
- Bridge **EtsyHub DB'sini bilmez**; sadece job lifecycle + outputs (file paths) döner. EtsyHub worker bunları DB'ye yazar.
- Bridge **stateless EtsyHub'a göre**; kendi diskinde job log + image dosyaları tutar; EtsyHub crash/restart'ı bridge'i etkilemez.

### 3.4 Neden ayrı proses?
1. **Görünürlük**: kullanıcı tek bir browser penceresi görür, hep açık
2. **Persistent oturum**: Cloudflare cookie + MJ session storage uzun ömürlü; her seferde "login" yok
3. **EtsyHub deploy'una bağlı değil**: `npm run dev` restart bridge'i etkilemez; oturum korunur
4. **TOS uyumu**: bridge tek kullanıcının kendi profilinde, görünür şekilde; "headless server farm" değil
5. **Test edilebilir**: bridge kendi başına `curl POST` ile sınanabilir

### 3.5 Neden BullMQ değil bridge'in kendi kuyruğu?
- Bridge düşük concurrency (tek browser, tek MJ oturumu = max 1-2 paralel job)
- Redis dependency'sini ayrı proseste taşımak fazla
- Disk persistence (JSONL append) yeterli; restart'ta resume mümkün
- EtsyHub tarafındaki BullMQ ayrı katmanda — `midjourney-web-bridge.worker.ts` bridge'e HTTP istek atar, polling EtsyHub job'unu canlı tutar

---

## 4. Captcha / challenge handling — manuel handoff

### 4.1 İlke
> Sistem **algılar**, **bekler**, **kullanıcıya bildirir**, **kullanıcı çözer**, **sistem devam eder**.

Hiçbir aşamada otomatik çözüm yok. 2captcha, hCaptcha solver, Cloudflare bypass — ❌.

### 4.2 Detection sözleşmesi
Bridge sayfa yüklemesi / submit sonrası şunları kontrol eder:
- DOM'da `iframe[src*="challenges.cloudflare.com"]` var mı
- DOM'da `iframe[src*="hcaptcha.com"]` var mı
- URL `*/challenges/*` veya `cf-please-wait` pattern'i mi
- HTTP response 403 / 503 + Cloudflare body mi
- "Verify you are human" / "I'm not a robot" text içeren element

Detection algılarsa job state `AWAITING_CHALLENGE`'a geçer.

### 4.3 Lifecycle state machine

```
QUEUED                        — bridge kabul etti, sırada
  ↓
OPENING_BROWSER               — Playwright launch / yeni tab açma
  ↓
AWAITING_LOGIN                — MJ login sayfası geldi; kullanıcı login
  ↓                              olana dek beklenir
SUBMITTING_PROMPT             — input doldurma + submit
  ↓
AWAITING_CHALLENGE  ─────────┐ — Cloudflare/hCaptcha algılandı
  ↓ (kullanıcı çözer)        │   Bridge bekler; UI bildirir
  ↓ ◄──────────────────────  │   Submit / poll fail olduğunda da
  ↓                          │   bu state'e dönülebilir
WAITING_FOR_RENDER            — submit kabul edildi; MJ "imagining"
  ↓
COLLECTING_OUTPUTS            — render tamamlandı; thumbnail + 4 grid
  ↓
DOWNLOADING                   — full-resolution images indir
  ↓
IMPORTING                     — EtsyHub worker MJBridge'den fetch eder,
  ↓                              Asset row + GeneratedDesign yazar
COMPLETED                     — review queue'ya inserted

FAILED                        — terminal: timeout, browser crash,
                                challenge timeout, manuel cancel
```

### 4.4 Manuel handoff UX

EtsyHub UI tarafı (`/references/[id]/variations` Midjourney mode):
- Job state badge: `Sırada → Browser açılıyor → Login bekleniyor → Doğrulama bekleniyor → Render bekleniyor → İndiriliyor → İçeri alınıyor → Tamamlandı`
- `AWAITING_CHALLENGE` durumunda kart üstünde **kırmızı banner**:
  > "Midjourney 'sen insan mısın?' kontrolü gösteriyor. Bridge browser penceresine geçip doğrulamayı tamamlayın. Sistem otomatik devam edecek."
  + "Bridge penceresini öne getir" butonu (bridge'e `POST /focus` çağrısı; `BrowserContext.bringToFront()`)
- `AWAITING_LOGIN` durumunda benzer banner:
  > "Midjourney oturumu aktif değil. Bridge browser'ında giriş yapın."
- Timeout: AWAITING_CHALLENGE'da 10 dk hareket yoksa job FAILED. Bridge state heartbeat ile takip eder.

### 4.5 Bridge tarafı pause mekanizması
- Bridge `AWAITING_CHALLENGE` state'ine girdiğinde **işlemi blok etmiyor**: yeni job submit'leri kuyrukta tutulur, mevcut job DOM polling'i devam eder.
- Polling her 2sn'de challenge-resolved kontrolü yapar (iframe kaybolunca).
- Resolved → state `SUBMITTING_PROMPT` veya `WAITING_FOR_RENDER`'a döner.

---

## 5. Capability matrix — neyi entegre edeceğiz

### 5.1 Build now (V1 omurga)
| Capability | Açıklama | Sebep |
|---|---|---|
| Prompt submit (single) | Tek prompt, MJ web /imagine | Ana kullanım |
| Render polling (DOM observer) | Job ID + grid thumbnail capture | Lineage için zorunlu |
| Download 4-grid | İlk render'ın 4 görselini indir | Ana ingest |
| Prompt + params capture | Prompt, version (--v 7), aspect ratio | Lineage |
| MJ Job ID capture | URL pattern'den / DOM'dan | Re-run + admin trace |
| Source asset import | Bridge → EtsyHub `/api/midjourney/ingest` | Asset model |
| Review queue insertion | Phase 6 GeneratedDesign + reviewStatus=PENDING | Mevcut akış |

### 5.2 Worth adapting (V1.x — yakın takip)
| Capability | Açıklama | Sebep |
|---|---|---|
| Upscale (U1-U4) | Render sonrası belirli grid item upscale | "Hangi varyantı seçtim" → MJ upscale → ingest |
| Variation (V1-V4) | Render sonrası varyasyon türetme | "Beğendim ama biraz farklı" |
| Image-to-image (`--cref` / image URL) | Reference image ile prompt | EtsyHub Reference → MJ ingest döngüsü |
| Batch prompt (sequential) | 5-10 prompt'u sırayla submit | Üretim hacmi |
| Job history scrape | Mevcut MJ history'den geçmiş job'lar import | Onboarding kolaylığı |

### 5.3 Useful later (V2+)
- Prompt template + variable expansion (AutoSail emsali)
- Relax mode tracking + "gece kuyruğu"
- Multi-account (V1 tek hesap)
- Upscale model selection (subtle / creative)
- Animate / video generation

### 5.4 Do not integrate (asla)
- ❌ Captcha auto-solve (2captcha, AntiCaptcha, vs.)
- ❌ Headless mod (görünür browser zorunlu)
- ❌ Stealth plugin (puppeteer-extra-plugin-stealth, vs.) — TOS bypass kokar
- ❌ Direct HTTP request to MJ private API endpoints
- ❌ Discord WebSocket / DM bot
- ❌ Multi-account fingerprint rotation
- ❌ Watermark removal (etik dışı)

---

## 6. Veri modeli ve job lifecycle

### 6.1 Yeni tablolar

```prisma
// Pass 41 — Midjourney bridge integration

model MidjourneyJob {
  id              String              @id @default(cuid())
  userId          String
  user            User                @relation(fields: [userId], references: [id])
  // EtsyHub Job entity'sine bağlanma (mevcut admin/jobs sayfasında görünür)
  jobId           String?             @unique
  job             Job?                @relation(fields: [jobId], references: [id])
  // İsteğe bağlı: bir Reference'la ilişki (image-to-image / kontekst)
  referenceId     String?
  reference       Reference?          @relation(fields: [referenceId], references: [id])
  productTypeId   String?
  productType     ProductType?        @relation(fields: [productTypeId], references: [id])

  // Bridge tarafı
  bridgeJobId     String              @unique  // bridge'in kendi UUID'si
  state           MidjourneyJobState  @default(QUEUED)
  stateReason     String?             // "captcha", "login", "render-timeout"

  // Prompt + parametreler (snapshot — runtime değişiklik etkilemez)
  prompt          String              @db.Text
  promptParams    Json                // { aspectRatio, version, stylize, chaos, ... }
  referenceUrls   String[]            @default([])  // image-to-image için

  // MJ-side capture
  mjJobId         String?             // MJ web'in kendi job id'si (URL'den)
  mjGridUrl       String?             // ilk grid'in URL'si
  mjMetadata      Json?               // { seed, weight, model, ... }

  // Lifecycle timestamps
  enqueuedAt      DateTime            @default(now())
  submittedAt     DateTime?
  renderedAt      DateTime?
  completedAt     DateTime?
  failedAt        DateTime?
  failedReason    String?

  // Output asset'lere bağlama
  generatedAssets MidjourneyAsset[]

  @@index([userId, state])
  @@index([bridgeJobId])
}

enum MidjourneyJobState {
  QUEUED
  OPENING_BROWSER
  AWAITING_LOGIN
  AWAITING_CHALLENGE
  SUBMITTING_PROMPT
  WAITING_FOR_RENDER
  COLLECTING_OUTPUTS
  DOWNLOADING
  IMPORTING
  COMPLETED
  FAILED
  CANCELLED
}

model MidjourneyAsset {
  id             String        @id @default(cuid())
  midjourneyJob  MidjourneyJob @relation(fields: [midjourneyJobId], references: [id], onDelete: Cascade)
  midjourneyJobId String

  gridIndex      Int           // 0..3 (4-grid içinde pozisyon)
  variantKind    MJVariantKind @default(GRID)  // GRID, UPSCALE, VARIATION
  parentAssetId  String?       // upscale/variation lineage (self-reference)
  parent         MidjourneyAsset? @relation("Lineage", fields: [parentAssetId], references: [id])
  children       MidjourneyAsset[] @relation("Lineage")

  // EtsyHub Asset model'ine bağlanma
  assetId        String        @unique
  asset          Asset         @relation(fields: [assetId], references: [id])

  // Opsiyonel: GeneratedDesign'a bağlanma (review queue'ya import edilirse)
  generatedDesignId String?    @unique
  generatedDesign GeneratedDesign? @relation(fields: [generatedDesignId], references: [id])

  // MJ-side capture (lineage debug için)
  mjActionLabel  String?       // "U1", "U2", "V3", vb.
  mjImageUrl     String?       // MJ CDN URL (kayıt için, indirilmiş asset ayrı)
  importedAt     DateTime      @default(now())

  @@index([midjourneyJobId])
  @@index([variantKind])
}

enum MJVariantKind {
  GRID       // İlk 4-grid render'ın bir parçası
  UPSCALE    // U1/U2/U3/U4 sonucu
  VARIATION  // V1/V2/V3/V4 sonucu
}
```

### 6.2 EtsyHub `Asset` ile ilişki
- Bridge indirdiği görselleri **kendi diskinde** tutar (`./outputs/{job-id}/0.png` vs.)
- EtsyHub worker `MidjourneyJob.state === COLLECTING_OUTPUTS` görünce bridge'den dosyaları fetch eder, MinIO'ya yükler, `Asset` row'u açar.
- **`MidjourneyAsset.assetId` zorunlu** — her MJ asset bir EtsyHub asset'idir; storage tek yerden geçer.
- Asset.sourceMetadata: `{ kind: "midjourney", mjJobId, gridIndex, prompt }` — Pass 24 source clarity pattern'i.

### 6.3 GeneratedDesign'a bridging
- MJ asset → review queue insertion **opsiyonel** ve **kullanıcı kontrollü**.
- Default: Bridge import → Asset oluştu, ama `GeneratedDesign` oluşturulmadı.
- Kullanıcı UI'da **"Review'a gönder"** butonuyla `GeneratedDesign` row'u açar; mevcut review pipeline (Pass 6) tetiklenir.
- Bu **kasıtlı** bir tasarım: MJ outputs review-noise'i azaltmak için, kullanıcı önce kendi ön-elemesini yapsın.

### 6.4 EtsyHub `Job` ile ilişki
- Her `MidjourneyJob` için bir `Job` row'u (`type: MIDJOURNEY_BRIDGE`, yeni JobType enum değeri) açılır.
- Pass 40 `/admin/jobs` sayfasında otomatik görünür (TR label "Midjourney köprüsü" eklenir).
- BullMQ side: `midjourney-web-bridge` queue, polling worker — bridge'in `/jobs/:bridgeJobId` GET'ini çağırır, state senkronize eder.

### 6.5 Lineage örneği
```
MidjourneyJob          (prompt: "boho wall art", aspect: 2:3)
├── MidjourneyAsset    (gridIndex: 0, kind: GRID,    label: -)
├── MidjourneyAsset    (gridIndex: 1, kind: GRID,    label: -)
├── MidjourneyAsset    (gridIndex: 2, kind: GRID,    label: -)
├── MidjourneyAsset    (gridIndex: 3, kind: GRID,    label: -)
├── MidjourneyAsset    (kind: UPSCALE, parent: gridIndex 1, label: "U2")
└── MidjourneyAsset    (kind: VARIATION, parent: gridIndex 1, label: "V2")
                                      └── MidjourneyAsset (gridIndex 0, kind: GRID, parent: V2)
                                      └── ...
```

### 6.6 Provider arayüzü uyumlu mu?
Mevcut `ImageProvider` interface (Phase 5):
```ts
interface ImageProvider {
  generate(input, options): Promise<{ providerTaskId, state }>;
  poll(providerTaskId, options): Promise<{ state, imageUrls?, error? }>;
}
```

Bridge için **uyumlu** ama **farklı semantik**:
- `generate` → bridge HTTP `/jobs` POST, `providerTaskId = bridgeJobId`
- `poll` → bridge HTTP `/jobs/:id` GET; `state` map MJState → VariationState
- `imageUrls`: bridge dosya yolları değil, **EtsyHub'a import edilmiş Asset URL'leri** döndürür (worker import adımını yapar)

**Komplikasyon**: mevcut `referenceUrls` HTTPS URL bekliyor (R17.2 sıkı kural). MJ image-to-image için aynı sözleşme — bridge `referenceUrls`'i Playwright'a base64 yerine URL olarak verir; reference Cloudflare-proxied URL gerekir. Bu V1.x'te ele alınır.

---

## 7. EtsyHub UI bağlama

### 7.1 `/references/[id]/variations` — yeni mode chip
Mevcut: `Local` / `AI Generated` (KIE provider).
Eklenir: `Midjourney` (Bridge mode).

Mode panel:
- Prompt textarea (mevcut)
- Aspect ratio (mevcut)
- Quality / version selector (`--v 6.1`, `--v 7`, `--v 8.1`, `--style raw`)
- Stylize / Chaos slider (advanced drawer)
- "Bridge sağlığı: Bağlı / Bağlı değil" indicator (sağ üstte; admin/midjourney sayfasına link)
- "Üret (1)" buton — submit

### 7.2 Job state UI
- Mevcut variation grid pattern reuse edilir
- State badge: TR label (Pass 40 shared module pattern'i — `JOB_TYPE_LABELS["MIDJOURNEY_BRIDGE"] = "Midjourney köprüsü"`)
- AWAITING_CHALLENGE durumunda banner + "Bridge'i öne getir" butonu

### 7.3 `/admin/midjourney` — yeni admin sayfası
- Bridge sağlığı: heartbeat son zamanı, browser pid, sayfa URL'i, MJ login durumu
- Aktif bridge job sayacı + son N job listesi
- "Bridge'i yeniden başlat" / "Browser pencerini öne getir" actionları
- Bridge log canlı tail (son 100 satır)

---

## 8. Risk analizi ve kırılganlıklar

### 8.1 Yüksek risk: MJ web UI değişimi
MJ aktif geliştirme aşamasında (V8.1 alpha). DOM selector'larım kırılır:
- **Mitigasyon**: Selector'ları **tek dosyada** topla (`src/services/mj-bridge/selectors.ts`); değişimde tek dosya güncellenir.
- **Mitigasyon**: ARIA / role-based selector'lar tercih edilir (DOM yapısından bağımsız).
- **Mitigasyon**: Smoke test: bridge başlatıldığında MJ ana sayfasında **prompt input bulunabiliyor mu?** kontrol et; bulamazsa "Bridge versiyonu MJ web ile uyumsuz" şeklinde explicit hata.

### 8.2 Yüksek risk: TOS ihlali algılaması
MJ'nin "automation detection" sistemi var. Bizim mitigasyonumuz:
- **Görünür browser** (headless değil)
- **Persistent profile** (her çalıştırmada yeni session değil)
- **Düşük throughput**: aynı anda 1 prompt; iki prompt arası min. 10sn
- **Manuel intervention'a izin verme**: bot-benzeri davranış pattern'i azalır
- **TOS uyarısı UI'da**: ilk Bridge bağlantısında modal: "MJ TOS'u tek kullanıcı manuel kullanım için yazılmıştır. Bu araç sizin gözetiminizde çalışır; MJ uygunsuz kullanım durumunda hesabınızı askıya alabilir. EtsyHub kullanım sorumluluğunu üstlenir misiniz?"

**Çıplak gerçek**: tüm bu mitigasyonlar **azaltır**, **sıfırlamaz**. Kullanıcı banlanma riskini kabul ederek bu yola girer.

### 8.3 Orta risk: Cloudflare evolves
Cloudflare bot detection sürekli güncellenir. Bizim "challenge detect → bekle → kullanıcı çözer" stratejimiz **şu an** çalışır; yarın yeni bir DOM yapısı gelirse detection update gerekir.
- **Mitigasyon**: Detection rules JSON-config (kullanıcı update'leyebilsin)
- **Mitigasyon**: "Belirsiz state" durumunda otomatik AWAITING_CHALLENGE + banner

### 8.4 Düşük risk: bridge crash
Playwright + Node.js stabil. Yine de:
- Disk-persisted job log (JSONL append) → restart sonrası resume
- Heartbeat (her 30sn EtsyHub'a /health) → bridge öldüğünde admin alert

### 8.5 Operational: kullanıcı browser'ı kapatabilir
Kullanıcı yanlışlıkla MJ tab'ını kapatır → bridge re-açar (yeni tab); ana penceeyi kapatır → bridge yeni window açar; tüm Chrome'u kapatır → bridge persistent profile ile yeniden başlatır.

### 8.6 Yasal: ban olursa
- Kullanıcının MJ aboneliği iade edilmez (TOS)
- EtsyHub bu riski **explicit yazmalı** (ilk kurulum modal + admin sayfa banner)
- Alternatif yol: KIE / Recraft / Flux / Ideogram resmi API'leri her zaman aktif kalır; MJ "premium" bir yol olur

---

## 9. Alternatifin alternatifi: resmi API'ler

**Dürüstlük gereği:** MJ TOS gri alan; ban riski gerçek; UI kırılganlığı gerçek.

EtsyHub mevcut `KIE GPT Image` provider'ı zaten Phase 5'te entegre. Diğer alternatifler:
- **Flux Pro / Flux Dev** (resmi API; TOS'lu otomasyon; benzer kalite)
- **Recraft V3** (resmi API; vector + raster; Etsy POD'a uygun)
- **Ideogram 3** (resmi API; text rendering güçlü)
- **Nano Banana** (resmi API; Google)

**Strateji önerisi**:
1. MJ Bridge'i build et — kullanıcı için **premium / opsiyonel** yol
2. Aynı zamanda **Flux + Recraft + Ideogram resmi API provider'larını ekle** — `providers/image/registry.ts`'a 3 yeni provider, mevcut KIE pattern'iyle
3. Kullanıcı UI'da seçer: "MJ Bridge (manuel müdahale gerekebilir, oturum açık olmalı)" vs "Flux Pro (tek tık, daha hızlı)" — açık trade-off

Bu **mimari kararın gözden kaçmaması gereken parçası**: tek MJ'ye yatırım sürdürülebilir değil; **3-4 paralel resmi API + 1 MJ Bridge** olgun ürün konfigürasyonudur.

---

## 10. Önerilen rollout planı (faz-numarasız)

### Adım 1: Skeleton + protokol kontratı
- Yeni package: `mj-bridge/` (workspace içinde ayrı; kendi `package.json`)
- HTTP server iskeleti, shared secret auth, in-memory job kuyruğu
- Sadece `POST /jobs` (no-op), `GET /jobs/:id` (state echo), `GET /health`
- EtsyHub tarafı: `providers/image/midjourney-bridge.ts` provider (mock); `MidjourneyJob` Prisma migration; `/admin/midjourney` placeholder sayfa
- **Smoke**: EtsyHub'tan curl ile mock job submit; state QUEUED → COMPLETED (no-op) görünmeli

### Adım 2: Playwright launch + persistent profile + login flow
- Bridge gerçek Chromium başlatır (visible)
- MJ.com'a navigate
- Login state detection (eğer `?join=...` redirect varsa AWAITING_LOGIN)
- Kullanıcı login eder → bridge ilerler → status: idle
- **Smoke**: Bridge başlat → browser açıldığını gör → MJ login → bridge logs idle

### Adım 3: Prompt submit + render polling + grid capture
- Page automator: prompt input bul, doldur, Enter
- DOM mutation observer: yeni grid container'ı yakala
- Grid hazır olduğunda: 4 image URL'i çıkar, MJ Job ID URL'den parse
- **Smoke**: tek prompt submit → 60-90 sn sonra 4 thumbnail URL döner

### Adım 4: Download + EtsyHub ingest endpoint
- Bridge tüm 4 grid item'ı `./outputs/{job-id}/{0..3}.png` olarak indirir (full resolution)
- EtsyHub tarafı: yeni endpoint `POST /api/midjourney/jobs/:id/ingest` — bridge worker'ı çağırır
- Worker: dosyaları MinIO'ya upload, Asset rows + MidjourneyAsset rows + GeneratedDesign opt-in
- **Smoke**: end-to-end 1 prompt → 4 asset EtsyHub'da görünür

### Adım 5: Challenge detection + manual handoff UX
- Bridge DOM polling'e Cloudflare/captcha selector'ları ekler
- AWAITING_CHALLENGE state + heartbeat
- EtsyHub UI: state badge + banner + "Bridge'i öne getir" buton
- Bridge `POST /focus` endpoint
- **Smoke**: MJ login sonrası kasıtlı 50 paralel job submit (rate limit) → challenge tetikle → kullanıcı çözer → resume gör

### Adım 6: Upscale / variation / image-to-image
- Render sonrası grid item'ı U1-U4 / V1-V4 buton click otomasyonu
- `POST /jobs/:id/upscale` (bridgeJobId, gridIndex)
- Image-to-image: `referenceUrls[0]` → MJ /imagine prompt başına ekle (`<URL>` syntax)
- MidjourneyAsset.parentAssetId chain dolar
- **Smoke**: grid 0 → U1 → ingest → 1 yeni MidjourneyAsset (kind: UPSCALE, parent: grid 0)

### Adım 7: Admin dashboard + bridge sağlığı
- `/admin/midjourney`: heartbeat, browser durumu, son 50 job, log tail
- Bridge `GET /admin/state` endpoint (browser pid, MJ login, queue depth)
- Pass 40 admin pattern'i (TR label + filter)
- **Smoke**: admin sayfası canlı veri

### Adım 8: Resmi API alternatifleri (paralel)
- `providers/image/flux-pro.ts`, `recraft-v3.ts`, `ideogram-3.ts` — KIE provider pattern emsali
- Variation generation UI'da provider seçim chip'leri
- Trade-off açık (rapid vs MJ premium)

### Adım 9: Hardening
- Selector versioning + smoke test boot-time check
- TOS uyarı modal (ilk kurulum)
- Bridge restart + state recover testi
- Persistent profile şifreleme (kullanıcı seçimi)

### Adım 10: Documentation + operatör guide
- `docs/midjourney-bridge/README.md` — kullanıcı kurulum
- `docs/midjourney-bridge/troubleshooting.md` — challenge, login, crash
- `docs/midjourney-bridge/risks.md` — TOS, ban, alternatifler

---

## 11. Risk vs değer özeti

| Bileşen | Değer | Risk | Karar |
|---|---|---|---|
| MJ Bridge omurga | Yüksek (premium quality) | Yüksek (ban, UI break) | **Build now** |
| Flux/Recraft/Ideogram paralel API | Yüksek (sürdürülebilir) | Düşük | **Build now** |
| Captcha auto-solve | (-) | Çok yüksek (ban garanti) | **Asla** |
| Discord otomasyon | (-) | Çok yüksek + erişilemez | **Asla** |
| Multi-account fingerprint | (-) | Çok yüksek + etik dışı | **Asla** |
| Companion Chrome extension | Düşük | Orta | **V2** |
| Headless mode | Düşük | Çok yüksek | **Asla** |

---

## 12. Açık sorular / sonraki turda kararlaştırılacak

1. **Bridge package nereye konacak?**
   - Önerilen: `mj-bridge/` workspace root'ta, ayrı package.json. EtsyHub `package.json` workspace yapılandırması (npm workspaces).
2. **Persistent profile path platform-bağımlı mı yoksa user-config mi?**
   - Önerilen: `./mj-profile/` repo root, `.gitignore`'da; kullanıcı `MJ_BRIDGE_PROFILE_DIR` env ile override edebilir.
3. **Shared secret key rotation**
   - Önerilen: kurulumda `npx mj-bridge init` rastgele oluşturur, `.env.local`'e yazar.
4. **Bridge update flow**
   - Önerilen: bridge package version'u semver; EtsyHub bridge'in `/health` response'ında min compatible version kontrol eder; mismatch durumunda admin uyarı.
5. **Birden fazla EtsyHub instance + tek bridge?**
   - V1: tek-tek eşleştirme. V2: bridge kendi auth tablosu (multi-instance shared secret).

---

## 13. Sonuç

**Önerilen mimari**:
- Lokal **MJ Bridge** servisi (Node + Playwright + visible Chromium + persistent profile)
- EtsyHub `providers/image/midjourney-bridge.ts` provider abstraction'ına oturur
- BullMQ worker bridge'i HTTP üzerinden konuşur
- **Manuel handoff** captcha/login için **kasıtlı tek meşru çözüm**
- Yeni `MidjourneyJob` + `MidjourneyAsset` tabloları lineage taşır
- **Aynı anda Flux/Recraft/Ideogram resmi API provider'ları** alternatif olarak eklenir (sürdürülebilirlik)
- **TOS riski açık iletilir**, kullanıcı bilinçli karar verir

Bu plan **çalışabilir** çünkü:
1. Kullanıcının kendi tarayıcısı + kendi oturumu → en az "otomasyon kokar" yol
2. Görünür browser → manuel müdahale doğal, kullanıcı her an sürece sahip
3. Provider abstraction zaten var → mimari ekleme değil, doldurma
4. Resmi API alternatifleri paralel akar → MJ ban olursa ürün ölmüyor

Bu plan **hala kırılgan** çünkü:
1. MJ web UI'sı kontrolünüzde değil; selector'lar kırılır
2. MJ TOS yorumu MJ'nin elinde; gri alan
3. Cloudflare mekanizması evrim geçirir; detection güncellenmesi gerekir

Bu kabul edilebilir bir kırılganlık çünkü değer yüksek (premium MJ kalitesi) ve fallback (Flux/Recraft) hep var.

---

## Kaynaklar (black-box inceleme)

- [AutoSail for Midjourney — Chrome Web Store](https://chromewebstore.google.com/detail/autosail-for-midjourney-a/dkbkadmoadhbpdelhmplnolhfpdikijm)
- [AutoJourney Downloader](https://autojourney.ai/en/downloader)
- [Midjourney 2026 web interface guide — AI Tools DevPro](https://aitoolsdevpro.com/ai-tools/midjourney-guide/)
- [Midjourney V7 web UI guide — Textify Analytics](https://textify.ai/midjourney-v7-2026-the-complete-creative-workflow-guide-for-professionals/)
- [Midjourney Terms of Service](https://docs.midjourney.com/hc/en-us/articles/32083055291277-Terms-of-Service)
- [10 Best Midjourney APIs (third-party) — myarchitectai](https://www.myarchitectai.com/blog/midjourney-apis)
- [GitHub: third-party automation ban warning](https://github.com/erictik/midjourney-api/issues/222)
