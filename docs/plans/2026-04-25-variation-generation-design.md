# Phase 5 — Variation Generation Design

> **Durum:** spec ONAYLI (2026-04-26). Plan turuna geçilebilir; onay sonrası `2026-04-26-variation-generation-plan.md` (writing-plans) çıkarılacak.
>
> **Tarih:** 2026-04-25 (oluşturma) · 2026-04-26 (6 açık soru kararları kilitlendi, R-numaraları güncellendi)
>
> **Bağlam:** EtsyHub Phase 5 = Reference Board → "Benzerini Yap" akışının ilk uçtan uca dilimi. Discovery omurgası (Trend Stories · Competitors · Bookmarks · References · Collections) tamam. Üretim omurgası bu fazda açılır. Phase 5 yalnız UI değil; provider abstraction, job queue ve persistence ilk dilimini de kurar.
>
> **Not:** Phase 6 (AI Quality Review skoru) bu fazın kapsamına ALMIYOR — kalite skoru lokal görseller için **bu fazda** uygulanacak (ürün kararı: madde R10), AI üretim çıktısı için Phase 6'ya bırakılır.

---

## 0. Genel Kural (her şeyin üstünde)

Bu kural design doc'taki her kararı dolaylı olarak bağlar; çelişki çıkarsa **bu kural kazanır**:

- **Local mode varsayılan** olacak.
- **AI mode açık ve bilinçli kullanıcı seçimiyle** açılacak.
- Kullanıcı **farkında olmadan AI üretim başlamayacak**.
- AI generated tarafı mimaride yer alacak, **ihmal edilmeyecek**, ama **varsayılan davranış olmayacak**.
- **Sessiz fallback yasak** — model capability farkları kullanıcıya görünür olacak.

---

## 1. Sözlük

| Terim | Anlam |
|---|---|
| **Local Library** | Kullanıcının diskinde belirlediği klasör + alt klasörler. Mevcut görselleri inceleme/seçme/export kaynağı. |
| **Local Mode** | Variation Generation'ın varsayılan kipi. Mevcut görseller listelenir, kalite skoru verilir, seçilir, export edilir. **Bu kipte AI üretim yapılmaz.** |
| **AI Mode** | Variation Generation'ın opsiyonel kipi. Kullanıcı açıkça seçer; image provider çağrılır, yeni görseller üretilir. Maliyetli aksiyon. |
| **Variation Job** | Bir reference + parametrelerle başlatılan üretim/inceleme görevi. State machine ile yönetilir. |
| **Capability** | Model yetisi: `image-to-image` (i2i), `text-to-image` (t2i). Capability bilinçli olarak kullanıcıya gösterilir. |
| **Quantity (Q)** | Klasör adındaki `Q10` gibi ifade — **klasördeki görsel sayısı**. **Kalite puanı değildir.** |
| **Brief** | Kullanıcının AI üretimi için yazdığı serbest metin yönlendirmesi (style note / ek değer). Sistem prompt'una EKLENİR, yerine geçmez. |

---

## 1.1 Ürün Gereksinimleri Master Listesi (R-numaraları)

Aşağıdaki R numaraları sözleşmedir; her madde daha sonra "bu tur / follow-up" diye işaretlenir (bkz. §10).

| ID | Gereksinim | Statü |
|---|---|---|
| **R0** | Local mode default; AI mode açık seçimle açılır | bu tur |
| **R1** | Text/copy provider (`kie.ai/gemini-2.5-flash`) image provider'dan AYRI abstraction | bu tur (provider katmanı) |
| **R2** | Image provider mimarisi extensible (model registry/adapter); ilk modeller `kie.ai/gpt-image-1.5` + `kie.ai/z-image` | bu tur (registry kabuk + 1 model entegre, 2. model carry-forward) |
| **R3** | Local mode'da AI üretim YOK; yalnız listeleme/inceleme/review/quality score | bu tur |
| **R4** | Local library tarama: belirlenen klasör + alt klasörler ayrı ayrı görünür; browse-first | bu tur |
| **R5** | Klasör adında `Q<n>` quantity'dir (kalite değildir); klasör adı korunur | bu tur |
| **R6** | Desteklenen format: JPG · JPEG · PNG; metadata'da mime type | bu tur |
| **R7** | Görsel metadata: path, hash, mime, size, width, height, DPI, klasör adı, kalite puanı, negatif işaret durumu, negatif neden, kullanıcı tarafından silindi mi | bu tur |
| **R8** | DPI hedefi **300**; 300 değilse kalite puanında düşüş + sebep görünür | bu tur |
| **R9** | Hedef çözünürlük kullanıcı ayarı; uymayan görseller kalite puanında işaretlenir, kullanıcıya açıkça anlatılır | bu tur (tespit + görünürlük); düzeltme aksiyonu carry-forward |
| **R10** | Quality score inputs: DPI · çözünürlük · arka plan beklentisi · yazı/imza/logo varlığı | bu tur (DPI + çözünürlük); arka plan + yazı/imza otomatik tespiti carry-forward, kullanıcı negatif işareti ile manuel kapatılır |
| **R11** | Negatif işaretleme + neden seçimi; örnek nedenler "arka plan beyaz değil" + "yazı/imza var"; sebep metadata'sı kaybolmaz; "olumsuz" görünüm | bu tur |
| **R12** | Uygulamadan silme = diskten silme; tehlikeli aksiyon olarak ConfirmDialog | bu tur |
| **R13** | Export rename: `<klasör/ürün adı> (1).jpeg`, `<klasör/ürün adı> (2).jpeg` | bu tur |
| **R14** | Export ZIP: max 20 MB/dosya; aşılırsa sıralı bölme `(1).zip`, `(2).zip` | **carry-forward** (Selection/Export ekranı Phase 5.5) |
| **R15** | AI mode görünür maliyetli aksiyon; fail → manuel "yeniden dene" (auto retry/chain yok) | bu tur (AI mode açıldığında) |
| **R16** | 3.A kararları: browse-first · initial index + manuel refresh · path+hash+thumbnail cache · 512×512 webp Q80 | bu tur |
| **R17.1** | i2i + t2i capability mimaride desteklenir; **sessiz fallback yok**; capability farkı kullanıcıya görünür | bu tur (mimari) |
| **R17.2** | Phase 5'te local source → AI reference köprüsü YOK; AI mode yalnız URL-kaynaklı reference'larla çalışır | bu tur (kural) |
| **R17.3** | Tek modele kilitlenme yok; capability-aware hibrit; uygulama scope'u "bu tur / follow-up" net ayrılır | bu tur (registry) + carry-forward (2. model) |
| **R17.4** | Üretilecek görsel sayısı kullanıcı seçimi; **default 3, max 6** | bu tur |
| **R18** | AI mode'da kullanıcı **brief/ek değer/style note** girer; sistem prompt'una EKLENİR (yerine geçmez); görünür ve kontrollü | bu tur |
| **R19** | Phase 5'te negative library minimum hardcoded liste: Disney · Marvel · Nike · celebrity names · watermark · signature · logo | bu tur (hardcoded sabit); admin ekranı carry-forward |
| **R20** | Roadmap: local → AI bridge (storage bridge / public URL bridge) ileride ayrı iş | **carry-forward (named)** |
| **R21** | Roadmap: Midjourney / dış üretim kaynakları için browser extension / import bridge / source connector | **carry-forward (named)** |
| **Q1** | **Quality görünümü iki ayrı sinyal:** (a) otomatik objektif **score** = DPI + Resolution; (b) manuel **review flags** = arka plan beyaz değil · yazı/imza/logo. Hiçbir şey gizlice tek sayıya yedirilmez; kullanıcı score'u + flag'leri **AYRI** görür | bu tur |
| **Q2** | Folder recursion derinliği: **root + first-level children**. Daha derin recursion carry-forward (`local-library-deep-recursion`) | bu tur |
| **Q3** | Settings: `rootFolderPath` + local-library tüm ayarları **user-level**; store-level override carry-forward (`local-library-store-level-override`) | bu tur |
| **Q4** | Sil onayı: **tek aşamalı ConfirmDialog** + sert uyarı (diskten silinecek + geri alınamaz + dosya adı + klasör adı görünür). Typing confirmation (`DELETE yaz`) carry-forward (`destructive-typing-confirmation` — bulk delete + diğer riskli toplu işlemler için) | bu tur |
| **Q5** | AI mode reference URL public check: **HEAD request**. HEAD başarısızsa "public URL doğrulanamadı" UI'da AÇIKÇA görünür; sessiz geçme + sessiz fallback YASAK (R17.1 ile aynı sözleşme) | bu tur |
| **Q6** | z-image Phase 5 kapsamı: **registry shell + capability görünürlüğü ŞART** (mimaride hem i2i hem t2i yer alır); gerçek `generate` impl carry-forward (`kie-z-image-integration`). Hardcoded tek-model çözüm YASAK | bu tur (kabuk) + carry-forward (impl) |

---

## 2. Mimari Çerçevesi

### 2.1 Katmanlar

```
┌─────────────────────────────────────────────────────┐
│  UI (Next.js, /references/[id]/variations)         │
│  - Mode switch (Local default / AI)                │
│  - Local: folder browser + grid + quality badges   │
│  - AI: brief input + count slider + cost notice    │
└─────────────────────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│  Service Layer (src/features/variation-generation) │
│  - local-library.service (scan, index, metadata)   │
│  - ai-generation.service (brief→prompt, job)       │
│  - quality-score.service (DPI/resolution)          │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│  Job Engine (BullMQ + Redis — yeni dilim)          │
│  - generate_variation (per-image task)             │
│  - scan_local_folder                               │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│  Provider Abstraction                              │
│  - providers/text  (kie.ai gemini-2.5-flash)       │
│  - providers/image (registry: gpt-image-1.5, …)    │
│  - providers/storage (carry-forward)               │
└─────────────────────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│  Persistence (Postgres + Prisma)                   │
│  - GeneratedDesign (yeni)                          │
│  - LocalLibraryAsset (yeni)                        │
│  - VariationJob (yeni)                             │
│  - PromptVersion link (admin'in mevcut tablosu)    │
└─────────────────────────────────────────────────────┘
```

### 2.2 Provider Abstraction (R1, R2)

Text ve image **AYRI** katmanlar:

```ts
// providers/text/text-provider.ts
interface TextProvider {
  id: string;            // "kie-gemini-2.5-flash"
  capability: "text";
  generate(input: { prompt: string; system?: string }): Promise<{ text: string; usageCost?: number }>;
}

// providers/image/image-provider.ts
type ImageCapability = "image-to-image" | "text-to-image";

interface ImageProvider {
  id: string;            // "kie-gpt-image-1.5"
  capabilities: ImageCapability[];
  generate(input: ImageGenerateInput): Promise<{ taskId: string }>;
  poll(taskId: string): Promise<{ state: VariationState; resultUrls?: string[]; error?: string }>;
}

interface ImageGenerateInput {
  prompt: string;
  referenceUrls?: string[];   // i2i için (url-only, R17.2)
  aspectRatio: "1:1" | "2:3" | "3:2" | "4:3" | "3:4" | "16:9" | "9:16";
  quality?: "medium" | "high";
}
```

**Registry yapısı (Q6 sözleşmesi):**

```ts
// providers/image/registry.ts
const IMAGE_PROVIDERS: Record<string, ImageProvider> = {
  "kie-gpt-image-1.5": kieGptImageProvider,    // bu tur GERÇEK entegre (i2i)
  "kie-z-image":       kieZImageProviderShell, // KABUK: capability görünür ama generate() throws NotImplementedError
};
```

**Q6 kuralı (KRİTİK):**
- Registry shell **ŞART** — hardcoded tek-model çözüm YASAK
- Capability görünürlüğü **ŞART** — `text-to-image` yolunun varlığı doc'ta + UI'da AÇIK
- Gerçek z-image `generate` impl carry-forward (`kie-z-image-integration`)
- UI: model picker'da z-image görünür ama "Yakında — capability hazır, entegrasyon devam ediyor" badge'i taşır
- Bu yapı R17.1 (sessiz fallback yok) ile %100 uyumlu: kullanıcı capability farkını AÇIK görür

**Yasaklar:**
- Provider call UI component içinde YASAK (CLAUDE.md kuralı korunur).
- Hardcoded model adı service içinde YASAK; her zaman registry'den alınır.
- Sessiz capability fallback YASAK (R17.1) — UI capability mismatch'i açıkça gösterir.

### 2.3 Job Engine (R15, ETA)

CLAUDE.md "Job Queue: BullMQ/Redis" diyor. Phase 5'te **ilk job tipi** açılır:

| Job tipi | Tetik | State'ler |
|---|---|---|
| `scan_local_folder` | kullanıcı manuel "Yenile" (R16) | `queued · running · success · fail` |
| `generate_variation` | kullanıcı AI mode "Üret" (R0, R15) | `queued · provider-pending · provider-running · success · fail` |

Her `generate_variation` job'u **1 görsel** üretir. Kullanıcı 3 seçtiyse 3 paralel job kuyruğa girer (R17.4).

**Hata davranışı (R15):**
- Provider 5xx / timeout / rate limit → job state = `fail`, error mesajı `VariationJob.errorMessage` alanına yazılır
- UI'da "Yeniden Dene" butonu görünür (her job için ayrı)
- **Otomatik retry yok, fallback chain yok** (kullanıcı kuralı)

### 2.4 Persistence Şeması

```prisma
// LocalLibraryAsset — local mode'un truth tablosu
model LocalLibraryAsset {
  id              String   @id @default(cuid())
  userId          String
  folderName      String              // "001- 1806074338 pastel anemone bunch Q10"
  folderPath      String              // "/Users/.../resimler/horse clipart"
  fileName        String              // "h01.png" (orijinal isim, R5)
  filePath        String              // mutlak path (R7)
  hash            String              // sha256 (R7)
  mimeType        String              // "image/png" (R6, R7)
  fileSize        Int                 // byte (R7)
  width           Int                 // px (R7)
  height          Int                 // px (R7)
  dpi             Int?                // null = çıkarılamadı (R7, R8)
  thumbnailPath   String?             // workspace/local-library/<hash>.webp (R16)
  qualityScore    Int?                // 0-100, null = henüz hesaplanmamış (R10)
  qualityReasons  Json?               // [{type: "dpi-low", detail: "200dpi < 300"}] (R8, R9)
  isNegative      Boolean  @default(false)   // R11
  negativeReason  String?                    // "arka plan beyaz değil" / "yazı/imza var" / serbest (R11)
  isUserDeleted   Boolean  @default(false)   // R7, R12
  deletedAt       DateTime?                  // R12
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([userId, hash])
  @@index([userId, folderName])
  @@index([userId, isNegative])
}

// GeneratedDesign — AI mode'un çıktı tablosu
model GeneratedDesign {
  id                String   @id @default(cuid())
  userId            String
  referenceId       String?              // Reference Board'dan tetiklendiyse
  variationJobId    String
  providerId        String               // "kie-gpt-image-1.5"
  providerTaskId    String               // kie.ai taskId
  capabilityUsed    String               // "image-to-image" | "text-to-image" (R17.1, sessiz fallback yok)
  promptSnapshot    String               // sistem prompt + brief (R18) snapshot — runtime config sızıntısı yok
  promptVersionId   String?              // PromptVersion FK (admin master prompt versiyonu, CLAUDE.md kuralı)
  briefSnapshot     String?              // R18 — kullanıcı brief'i (yazıldıysa)
  resultUrl         String?              // kie.ai resultUrls[0]
  state             VariationState       // queued | provider-pending | provider-running | success | fail
  errorMessage      String?              // R15
  costEstimate      Decimal?             // USD; doc'da yoksa null
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([userId, referenceId])
  @@index([userId, state])
}

model VariationJob {
  id            String   @id @default(cuid())
  userId        String
  referenceId   String
  mode          String                // "ai" (local mode'da job yok — scan_local_folder ayrı)
  providerId    String
  requestedCount Int                  // 3-6 (R17.4)
  brief         String?               // R18
  state         String                // aggregate state
  createdAt     DateTime @default(now())
  designs       GeneratedDesign[]

  @@index([userId, state])
}

enum VariationState {
  QUEUED
  PROVIDER_PENDING
  PROVIDER_RUNNING
  SUCCESS
  FAIL
}
```

**Snapshot kuralı (CLAUDE.md):** Job başladığında `promptSnapshot`, `briefSnapshot`, `promptVersionId` lock'lanır. Admin master prompt sonra değişse bile job'ın çıktısı **o anki** prompt'la üretilmiş kalır, retroaktif değişmez.

---

## 3. Local Mode Tasarımı

> **Default mode (R0).** Bu kipte AI üretim asla tetiklenmez (R3).

### 3.1 Akış

1. Kullanıcı Reference Board'da bir reference'a tıklar → `/references/[id]/variations`
2. URL açılır, **Mode: Local** default seçili (R0)
3. **İlk açılış:** Eğer kullanıcının local library kök klasörü Settings'te tanımlı değilse, "Klasör tanımla" call-to-action gösterilir; tanımlıysa folder list yüklenir
4. Folder list ekranda gösterilir (R4 — alt klasörler ayrı kart). Browse-first (R16): kullanıcı bir klasöre tıklar → grid o klasörün içeriğini gösterir
5. Grid'de her görsel için: thumbnail · DPI badge · resolution badge · quality score badge · negatif badge (varsa)
6. Kullanıcı görseli seçebilir, kalite puanını görebilir, negatif işaretleyebilir, silebilir, export'a alabilir

### 3.2 Klasör Tarama (R4, R5, R16)

**Tetik:** Kullanıcı "Yenile" butonuna basınca + ilk açılışta (eğer hiç index yoksa).

**Sözleşme:**
- Kök klasör altındaki **ilk seviye alt klasörler** ayrı kart olarak gelir (R4)
- Klasör adı **olduğu gibi korunur** (R5) — `001- 1806074338 pastel anemone bunch Q10` örneği gibi
- Q10'un quantity olduğu **parse edilebilir** ama **karar verici değil**; gerçek görsel sayısı taranır
- Her klasörün içindeki JPG/JPEG/PNG dosyaları (R6) `LocalLibraryAsset` tablosuna girer
- **Recursion derinliği (Q2 kararı):** **root + first-level children**. Yani sadece kök klasör + onun bir altındaki alt klasörler taranır. İkinci seviye ve daha derin alt klasörler bu turda **dikkate alınmaz**.
- Daha derin recursion ihtiyaç olursa carry-forward: `local-library-deep-recursion`

**Job:** `scan_local_folder` → BullMQ kuyruğuna girer; tarama bitince UI'a SSE/refetch ile sinyal verilir (mevcut React Query patterniyle uyumlu).

### 3.3 Metadata Çıkarımı (R7, R8, R9)

Her dosya için sharp ile:

```ts
{
  width, height,           // sharp metadata
  density: dpi,            // sharp.metadata().density
  size: fileSize,          // fs.stat
  format: mimeType,        // sharp.metadata().format → "image/png" map
  hash: sha256(fileBuffer) // dedupe için
}
```

**DPI not parsable durumu:** `dpi = null`. Quality score'da "DPI okunamadı" sebebiyle düşüş.

**Thumbnail (R16):** sharp ile `512×512` cover, webp Q80, `workspace/local-library/<hash>.webp`. Cache: hash değişmemişse yeniden üretmez.

### 3.4 Quality Score + Review Flags (R10, Q1)

> **Q1 sözleşmesi — KRİTİK:** Phase 5'te quality görünümü **iki ayrı sinyal**dir; tek sayıya yedirilmez.
>
> 1. **Quality Score (otomatik, objektif)** — DPI + Çözünürlük tabanlı 0–100 sayı
> 2. **Review Flags (manuel, görünür)** — kullanıcı negatif işareti + sebep
>
> Kullanıcı **her ikisini de AYRI görür**: kart üzerinde score badge + flag rozetleri/şeritleri yan yana.

#### 3.4.a Otomatik Quality Score (objektif)

Yalnız **iki teknik input**:

| Input | Hesap | Veri kaynağı |
|---|---|---|
| **DPI** (R8) | DPI ≥ 300 ise +50; 200–299 ise +25; <200 ise 0; null (okunamadı) ise 0 + "DPI okunamadı" reason | sharp metadata.density |
| **Çözünürlük** (R9) | Settings `targetResolution` hedefine göre: tüm hedefin ≥ ise +50; %80–99 ise +25; <%80 ise 0 + reason | sharp width × height |

**Formül (Phase 5):**
```
score = (DPI input)        // 0, 25 veya 50
      + (Resolution input) // 0, 25 veya 50
score = clamp(score, 0, 100)
```

**Maksimum 100, minimum 0.** Negatif işareti score'u **etkilemez** — Q1 kuralı: review flags ayrı sinyal.

**`qualityReasons` alanı** (R7): score 100'ün altındayken hangi input düşürdü açık biçimde listelenir:
```json
[
  { "type": "dpi-low", "actual": 200, "target": 300, "delta": -25 },
  { "type": "resolution-low", "actual": "3000x3000", "target": "4000x4000", "deltaPct": 75, "delta": -25 }
]
```

**UI badge eşikleri (yalnız score için):**
- **75+** Yeşil "iyi"
- **40–74** Sarı "kontrol et"
- **<40** Kırmızı "düşük"

#### 3.4.b Manuel Review Flags (R10, R11)

Otomatik **DEĞİL**. Kullanıcı manuel işaretler:

| Flag | Nedeni | Veri |
|---|---|---|
| Arka plan uygun değil | "arka plan beyaz değil" / serbest metin | R11, `isNegative=true`, `negativeReason` |
| Yazı/imza/logo var | "yazı/imza var" / "logo var" / serbest metin | R11, `isNegative=true`, `negativeReason` |

**Görünüm kuralı (Q1):**
- Score badge → kartın **bir köşesinde** (ör. üst-sol)
- Review flags → kartın **başka bir bölgesinde** (ör. alt-sol şerit + tooltip)
- İki sinyal **birleştirilmez**, **AYRI gösterilir**
- Kullanıcı "skoru iyi ama flag'li" durumu net görür (örn. 100 score + "yazı var" flag'i)

**Otomatik tespit (OCR/background detection) yok:** R10-followup `auto-quality-detection-ocr-bg` → Phase 6 AI Quality Review. Phase 5'te kullanıcı manuel quality kapısı.

### 3.5 Negatif İşaretleme (R11)

**UI:** her grid kartında "Negatif İşaretle" aksiyonu. Tıklayınca dropdown:

- "arka plan beyaz değil"
- "yazı/imza var"
- "logo var"
- "çözünürlük düşük"
- "DPI düşük"
- "diğer (serbest metin)"

**Veri:** `isNegative=true`, `negativeReason=<seçim veya serbest>`. Sebep **kalıcı** (R11 — kaybolmaz).

**"Olumsuz" görünümü (R11):** ayrı bir filter chip ("Negatifler") + kart üzerinde kırmızı şerit + reason tooltip. Ayrı klasör kopyalama YOK; veri katmanında flag.

### 3.6 Silme Davranışı (R12, Q4)

**Kural:** Uygulamadan sil → diskten sil. Tehlikeli aksiyon.

**Q4 sözleşmesi:** Tek aşamalı ConfirmDialog yeterli; ama dialog **çok açık ve sert uyarı** verir; dosya adı + klasör adı görünür olur. Typing confirmation (`DELETE yaz`) Phase 5'te YOK — bulk delete + diğer riskli toplu işlemler için carry-forward (`destructive-typing-confirmation`).

**UX (tek aşamalı, sert uyarı):**
1. Kullanıcı "Sil" butonuna basar
2. **ConfirmDialog** (CP-5 ailesi, mevcut altyapı, **destructive tone**) açılır:
   - **Title:** "Görseli sil — geri alınamaz"
   - **Body (sert uyarı):**
     ```
     Bu görsel:
     • EtsyHub uygulamasından silinecek
     • DİSKTEN de silinecek (kalıcı, geri alınamaz)

     Dosya:   <fileName>
     Klasör:  <folderName>
     Yol:     <filePath>
     ```
   - **Tone:** destructive
   - **Confirm label:** "Diskten Sil"
   - **Cancel label:** "Vazgeç" (default focus)
3. Onay verilirse: `LocalLibraryAsset.isUserDeleted=true`, `deletedAt=now()`, **fs.unlink(filePath)** çağrılır
4. Silme başarısız olursa (dosya yoksa, izin yoksa): `isUserDeleted` set edilmez, UI hata mesajı gösterir (mesaj net: "Dosya silinemedi: <sebep>")

**Yasaklar:**
- Silme onayı atlatma yok (tehlikeli aksiyon kuralı)
- Trash/recycle bin Phase 5'te yok — direct unlink (R12 davranışı net diyor)
- "Toplu sil" Phase 5'te yok; tek tek silme **carry-forward** olarak `bulk-delete-local-assets` ismiyle açılır
- Bulk delete + diğer riskli toplu işlemler için typing confirmation: `destructive-typing-confirmation` carry-forward

### 3.7 Export Rename (R13) ve ZIP (R14)

**R13 — bu tur:**
- Kullanıcı görselleri seçer → "Export" tıklar → "Çıktı adı" sorulur (default = klasör adından temizlenmiş ürün adı, örn. "pastel anemone bunch")
- Dosyalar `<ad> (1).jpeg`, `<ad> (2).jpeg` … şeklinde **kopyalanır** (orijinal disk dosyaları **dokunulmaz**)
- Hedef: `workspace/exports/<userId>/<jobId>/`

**R14 — carry-forward:**
- ZIP paketleme + 20 MB sıralı bölme **bu tur'da YOK**
- Sebep: Selection Studio + Mockup Studio (Phase 7-8) ile birlikte ele alınması daha tutarlı. Export tek başına Phase 5'te ham dosya kopyası verir; ZIP/split CLAUDE.md'deki `export_clipart_bundle` job tipiyle Phase 5.5+'da gelir
- **Carry-forward isim:** `export-zip-split-20mb` (R14 — unutulmayacak, named)

---

## 4. AI Mode Tasarımı

> **Opsiyonel mode (R0, R15).** Maliyetli aksiyon. Local mode'dan farkı UI'da AÇIK gösterilir.

### 4.1 Akış

1. `/references/[id]/variations` sayfasında kullanıcı Mode switch'ten **"AI Generated"** seçer
2. **Maliyet uyarısı banner'ı** açılır (R15): "Bu mod AI provider'a istek atar ve maliyet üretir."
3. Form açılır:
   - **Reference URL durumu (R17.2 + Q5):** Reference'ın `imageUrl` alanı public mi kontrol edilir.
     - **Q5 sözleşmesi:** Kontrol **HEAD request** ile yapılır (basit URL pattern matching YETERLİ DEĞİL).
     - HEAD `200 OK` → URL public, AI mode form aktif
     - HEAD `4xx/5xx/timeout/network error` → "Public URL doğrulanamadı" UI'da AÇIKÇA görünür (status code + sebep gösterilir); AI mode form **disable**; sessiz geçme + sessiz fallback YASAK (R17.1 sözleşmesi)
     - Local kaynaklı reference (URL yoksa veya dosya path'i ise): "Bu reference local kaynaklı, AI mode için public URL gerekli. Lokal kaynaklı reference'lar şu an AI mode'da kullanılamaz." mesajı + AI mode disable (R17.2)
   - **HEAD endpoint kuralları:**
     - Server-side fetch (CORS yok); user-agent açık (`EtsyHub/0.1`); timeout 5s; redirect izin verilir (max 3 hop)
     - Sonuç UI'a "URL durumu: ✓ public / ✗ doğrulanamadı (sebep)" satırı olarak yansır
     - Cache: aynı URL için kontrol sonucu **5 dakika** boyunca cachelenir (refetch button ile yenilenir)
   - **Capability seçimi** (R17.1): Hangi modeller hangi capability'i destekliyor açıkça listelenir:
     - `kie-gpt-image-1.5` → `image-to-image` ✓
     - `kie-z-image` → `text-to-image` (carry-forward, Phase 5'te entegre değil — gri görünür)
   - **Aspect ratio:** `1:1 · 2:3 · 3:2` (gpt-image-1.5'in kabul ettikleri)
   - **Quality:** `medium` / `high`
   - **Brief / Ek değer** (R18): serbest metin textarea (max 500 char). Etiket: "Style note / ek yönlendirme (opsiyonel)". Helper: "Sistem promp'una eklenir, yerine geçmez."
   - **Görsel sayısı slider** (R17.4): default 3, max 6
4. **"Üret"** butonuna basınca: ConfirmDialog açılır (R15 — bilinçli aksiyon):
   - "X görsel üretilecek. Tahmini maliyet: ~Y. Onaylıyor musun?"
   - Onay verilirse N adet `generate_variation` job'u kuyruğa girer
5. Grid'de her job'un state'i live (SSE veya 5sn polling) — `queued → provider-pending → provider-running → success | fail`
6. `success` → `resultUrl` thumbnail olarak görünür; `fail` → "Yeniden Dene" butonu görünür (R15)

### 4.2 Capability Sözleşmesi (R17.1) — sessiz fallback yok

**Kural:** Sistem "image-to-image desteklemiyorsa otomatik t2i'ye düşeyim" demez.

**Davranış:**
- Reference'ı kullanmak istiyorsan model i2i destekliyor olmalı (`kie-gpt-image-1.5` ✓)
- Eğer kullanıcı t2i-only bir model seçerse (gelecekte z-image entegre olunca): **Reference image kullanılmıyor** uyarısı UI'da açıkça görünür → kullanıcı caption-then-prompt akışını **bilinçli** seçer (Gemini 2.5 Flash → caption → t2i prompt). Caption kullanıcıya gösterilir, düzenlenebilir.
- Caption-then-prompt akışı **Phase 5'te disable** (z-image entegrasyonu carry-forward); UI'da tanıtım amaçlı görünür ama "Yakında" badge'i taşır

### 4.3 Local → AI Reference Köprüsü (R17.2)

**Phase 5'te YOK. Bilinçli ürün kararı.**

**Sebep:** kie.ai `gpt-image-1.5` `input_urls` parametresi public URL ister. Local diskteki dosyayı kie.ai'ye ulaştırmak için:
- ya localhost tunnel (kullanıcı bağımlılığı, kırılgan)
- ya geçici S3/R2 presigned URL (storage provider altyapısı gerekli)

İkisi de **scope büyütür**. CLAUDE.md `providers/storage` mimaride var ama bu turda boş. Phase 5'te:
- AI mode = yalnız **URL-kaynaklı reference**'larla (Bookmarks → Reference akışından gelenler; URL Etsy/Amazon/Pinterest gibi public)
- Local library reference olarak AI'ye gitmez
- UI'da local reference ile AI mode seçilirse açık mesaj: "Bu reference local kaynaklı. AI mode şu an yalnız URL-kaynaklı reference'larla çalışıyor."

**Carry-forward (R20):** `local-to-ai-reference-bridge` — storage provider ile birlikte ileride açılır.

### 4.4 Prompt Sözleşmesi

**Sistem promp'u + kullanıcı brief'i ayrı katmanlardır (R18).**

```ts
type ImagePromptInput = {
  productType: ProductType;          // "wall-art" | "clipart" | …
  referenceUrl?: string;             // i2i için
  brief?: string;                    // R18 — kullanıcı serbest metin
  capability: ImageCapability;
};

function buildImagePrompt(input: ImagePromptInput): string {
  const systemPrompt = getMasterPrompt(input.productType);   // PromptTemplate, admin yönetimi (mevcut altyapı)
  const negative     = NEGATIVE_LIBRARY.join(", ");          // R19 hardcoded
  const userBrief    = input.brief?.trim() ?? "";

  return [
    systemPrompt,
    userBrief ? `Style note from user: ${userBrief}` : "",
    `Avoid: ${negative}`,
  ].filter(Boolean).join("\n\n");
}
```

**Yasaklar:**
- Kullanıcı brief'i system prompt'un **yerine geçmez** (R18); ekleme olarak gider
- Negative library prompt'a OTOMATIK eklenir (R19); kullanıcı kapatamaz
- Master prompt PromptTemplate altında versiyonlanır (CLAUDE.md kuralı); job snapshot'ında promptVersionId lock'lanır

### 4.5 kie.ai Entegrasyonu (Phase 5'te yalnız `gpt-image-1.5`)

```ts
// providers/image/kie-gpt-image.ts
export const kieGptImageProvider: ImageProvider = {
  id: "kie-gpt-image-1.5",
  capabilities: ["image-to-image"],

  async generate(input) {
    const res = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.KIE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image/1.5-image-to-image",
        input: {
          input_urls: input.referenceUrls,
          prompt: input.prompt,
          aspect_ratio: input.aspectRatio,
          quality: input.quality ?? "medium",
        },
      }),
    });
    const json = await res.json();
    return { taskId: json.data.taskId };
  },

  async poll(taskId) {
    const res = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { "Authorization": `Bearer ${process.env.KIE_API_KEY}` },
    });
    const json = await res.json();
    const state = mapKieState(json.data.state);          // waiting/queuing/generating → PROVIDER_PENDING|RUNNING; success → SUCCESS; fail → FAIL
    const resultUrls = json.data.state === "success"
      ? JSON.parse(json.data.resultJson).resultUrls
      : undefined;
    return { state, resultUrls, error: json.data.errorMessage };
  },
};
```

**z-image (R2, Q6):** registry'de **kabuk** olarak yer alır:
- `capabilities: ["text-to-image"]` — capability AÇIK ve görünür
- `generate()` Phase 5'te `throw new NotImplementedError("z-image entegrasyonu carry-forward: kie-z-image-integration")` — gerçek impl carry-forward
- UI model picker'da: "kie-z-image (text-to-image) — Yakında" badge'i; seçilemez (disabled), hover tooltip'i: "Phase 5.x'te entegre edilecek; capability mimaride hazır."
- Sessiz fallback yok (R17.1) — kullanıcı kabuk olduğunu AÇIK görür

### 4.6 Cost Guardrails (R15)

Phase 5'te **minimum**:

- AI mode formunda "Tahmini maliyet" satırı (kie.ai fiyat doc'da yok → placeholder + "Doğrulanmamış maliyet" notu)
- Görsel sayısı × per-call placeholder gösterilir
- **Job başlatma engeli yok Phase 5'te** (kullanıcı kuralı: bilinçli seçim, manuel "yeniden dene")
- Daily/monthly limit, provider-bazlı toplam takibi, admin Cost Usage ekranı **carry-forward** (CLAUDE.md Phase 10'da Admin Hardening)

---

## 5. UI Yüzeyi — `/references/[id]/variations`

### 5.1 Sayfa kabuğu

```
┌─────────────────────────────────────────────────────────────┐
│ < Geri  |  Reference: <title>             [Mode: Local ▼] │ ← R0 default Local
├─────────────────────────────────────────────────────────────┤
│  [Local]  [AI Generated]                                  │ ← R0 segmented
├─────────────────────────────────────────────────────────────┤
│                                                            │
│   <Mode-aware content>                                     │
│                                                            │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Local Mode görünümü

Browse-first (R16):

```
[A] Klasör listesi ekranı (kullanıcı henüz klasör seçmedi):
   ┌─────────────────────────────────────────┐
   │ Kök klasör: /Users/.../resimler   [Yenile] │
   ├─────────────────────────────────────────┤
   │  ┌───────┐  ┌───────┐  ┌───────┐        │
   │  │ horse │  │ bird  │  │ cat   │ …      │
   │  │ Q10   │  │ Q15   │  │ Q8    │        │
   │  └───────┘  └───────┘  └───────┘        │
   └─────────────────────────────────────────┘

[B] Klasör grid'i:
   ┌─────────────────────────────────────────┐
   │ < horse clipart   12 görsel | 3 negatif │
   │  [Yenile] [Tüm Negatifleri Göster]     │
   ├─────────────────────────────────────────┤
   │  Her kart:                              │
   │   - thumbnail 512×512                   │
   │   - DPI badge (300✓ / <300✗)           │
   │   - Resolution badge (4000×4000✓/✗)    │
   │   - Quality score badge                 │
   │   - Negatif şerit (varsa, tooltip=neden)│
   │   - "Sil" / "Negatif" / "Seç" aksiyonları│
   └─────────────────────────────────────────┘
```

**Yeni primitive YOK** — mevcut tasarım sistemi (PageShell, Toolbar, FilterBar, Chip, ConfirmDialog) yeterli. Folder card ve image card görsel olarak farklı ama Card primitive'i tüketir.

### 5.3 AI Mode görünümü

```
┌─────────────────────────────────────────────────────────────┐
│ [Local]  [AI Generated*]                                    │
├─────────────────────────────────────────────────────────────┤
│ ⚠ AI mode AI provider'a istek atar ve maliyet üretir.     │ ← R15
├─────────────────────────────────────────────────────────────┤
│ Reference: <title> (URL: ✓ public / ✗ local)               │ ← R17.2
│                                                              │
│ Model:    [kie-gpt-image-1.5 (image-to-image)] ▼           │ ← R17.1 capability görünür
│                                                              │
│ Aspect ratio:  ( )1:1 (•)2:3 ( )3:2                         │
│ Quality:       (•)medium ( )high                            │
│                                                              │
│ Style note (opsiyonel):                                     │ ← R18
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ pastel tones, no text, soft watercolor                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Görsel sayısı: 1 ━━●━━━━ 6      Seçili: 3                  │ ← R17.4
│ Tahmini maliyet: ~$X (doğrulanmamış)                        │
│                                                              │
│             [Vazgeç]   [Üret]                               │
└─────────────────────────────────────────────────────────────┘

Onay sonrası:
┌─────────────────────────────────────────────────────────────┐
│  ┌───────┐  ┌───────┐  ┌───────┐                           │
│  │ ⏳    │  │ ✓     │  │ ✗     │                           │
│  │queued │  │success│  │ fail  │                           │
│  └───────┘  └───────┘  └───────┘                           │
│                          [Yeniden Dene]                    │ ← R15
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Capability mismatch UI (R17.1, sessiz fallback yok)

Eğer ileride z-image entegre olunca ve kullanıcı reference seçiliyken "z-image (text-to-image)" seçerse:

> **"⚠ Bu model image-to-image desteklemiyor. Reference görsel kullanılmayacak. Caption-then-prompt akışıyla devam etmek istiyor musun? (Reference görsel önce text'e çevrilecek)"**

Sessiz fallback YOK — kullanıcı bilinçli onaylar.

---

## 6. Mod Geçişi — Mode Switch Davranışı

| Geçiş | Davranış |
|---|---|
| Sayfa açılır | Default Local (R0). URL'de `?mode=ai` varsa AI seçili açılır ama maliyet uyarısı yine de görünür (R15) |
| Local → AI | Cost notice banner görünür; form temiz açılır; reference URL public değilse AI form disable (R17.2) |
| AI → Local | İptal yok; mevcut `generate_variation` job'ları arka planda devam eder, geri dönünce state'leri `success/fail` olur |
| Sayfa refresh / yeniden gir | URL state korunur; in-flight job'lar listelenir |

---

## 7. Negative Library (R19)

**Phase 5'te hardcoded sabit:**

```ts
// src/features/variation-generation/negative-library.ts
export const NEGATIVE_LIBRARY = [
  "Disney",
  "Marvel",
  "Nike",
  "celebrity names",
  "watermark",
  "signature",
  "logo",
] as const;
```

**Kullanım:**
- `buildImagePrompt`'ta `Avoid: <list>` olarak appendlenir
- Phase 5'te listing/title üretimi yok (Phase 9), o yüzden text tarafına dokunmaz
- **Carry-forward:** `negative-library-admin-screen` — admin paneli (Phase 10 Admin Hardening ile birlikte)

---

## 8. Settings — Phase 5'te Eklenenler

**Q3 sözleşmesi:** Tüm local-library ayarları **user-level**. Store-level override yok. Sebep: bu ayarlar fiziksel disk yolu + makine bağlamı; mağaza bazlı ayar gibi davranması bu aşamada gereksiz karmaşıklık.

```
src/features/settings/local-library/         (USER-LEVEL — Q3)
  - rootFolderPath: string                  // R4 — kullanıcı kök klasörü (mutlak path)
  - targetResolution: { width, height }     // R9 — hedef çözünürlük (örn. 4000×4000)
  - targetDpi: number = 300                 // R8 — hedef DPI (default 300, kullanıcı override edebilir ama düşürmesi önerilmez)

src/features/settings/ai-mode/                (USER-LEVEL)
  - kieApiKey: string (encrypted)           // R2 — kullanıcı kendi key'ini girer; encrypted at rest (CLAUDE.md güvenlik kuralı)
  - geminiApiKey: string (encrypted)        // R1 — text provider key (Phase 5'te kullanılmıyor ama altyapı hazır)
```

**Carry-forward (Q3 follow-up):** İleride store-level override ihtiyacı çıkarsa `local-library-store-level-override` adıyla açılır. Bu turda `userId` üzerinden tek truth.

---

## 9. Test Stratejisi

CLAUDE.md "Testing Strategy" minimum kapsam çerçevesi içinde:

| Test alanı | Phase 5 kapsamı |
|---|---|
| **Unit (service)** | local-library scan, hash hesaplama, quality score formülü, prompt builder, negative library injection |
| **Integration (API)** | `/api/local-library/folders` GET, `/api/local-library/assets/:id/negative` POST, `/api/local-library/assets/:id` DELETE, `/api/variation-jobs` POST/GET |
| **Provider mock** | kie.ai i2i mocked: `generate` → fake taskId, `poll` → state machine senaryoları (queued → success / queued → fail) |
| **Authorization** | userId izolasyonu — başka user'ın LocalLibraryAsset/GeneratedDesign'ına erişim 403 |
| **State machine** | VariationState transitions: queued → pending → running → success; fail path; "Yeniden Dene" yeni job açar (eskisini değiştirmez) |
| **Capability** | t2i-only model + reference seçimi → uyarı; sessiz fallback YOK assertion |
| **Permissions/Visibility** | AI mode reference URL public değilse form disable — UI test |
| **Smoke (RSC)** | `/references/[id]/variations` Local mode boş klasörle açılır, AI mode form çalışır |

**ETA / Job Detail entegrasyonu:** Phase 5'te `VariationJob`'un mevcut Job Detail page'ine bağlanması **carry-forward** (CLAUDE.md Phase 11 Job Detail ile zaten tamamlanmış altyapı; Phase 5 sadece job tipini ekler, view tarafı sonraki rötuşta).

---

## 10. Scope vs Carry-Forward — Net Tablo

### 10.1 Bu Tur (Phase 5)

| ID | Madde |
|---|---|
| R0 | Local mode default + AI mode bilinçli seçim |
| R1 | Text/image provider AYRI abstraction (text katmanı kabuk olarak kurulur, kullanım yok) |
| R2 | Image provider registry; **kie-gpt-image-1.5 entegre**; kie-z-image registry kabuğu (NotImplementedError) |
| R3 | Local mode'da AI üretim YOK |
| R4 | Browse-first folder list + ilk seviye recursion |
| R5 | Klasör adı korunur, Q parse opsiyonel |
| R6 | JPG/JPEG/PNG; mime metadata |
| R7 | LocalLibraryAsset tablosu — tüm metadata alanları |
| R8 | DPI 300 hedefi; quality score'da görünür |
| R9 | Çözünürlük tespit + görünürlük (düzeltme aksiyonu yok) |
| R10 | Quality score: DPI + çözünürlük otomatik; arka plan + yazı manuel (negatif işareti üzerinden) |
| R11 | Negatif işaret + sebep + "olumsuz" filter |
| R12 | Sil = diskten sil; ConfirmDialog destructive tone |
| R13 | Export rename `<ad> (1).jpeg` |
| R15 | AI mode maliyet uyarısı + manuel "Yeniden Dene" |
| R16 | Tarama: initial index + manuel refresh; thumbnail 512×512 webp Q80 |
| R17.1 | Capability mimaride var; sessiz fallback YOK |
| R17.2 | Phase 5'te local → AI köprüsü YOK; AI yalnız URL-kaynaklı |
| R17.3 | Tek modele kilitlenme yok (registry); 2. model entegrasyonu carry-forward |
| R17.4 | Görsel sayısı default 3, max 6 |
| R18 | Brief / ek değer alanı (sistem prompt'una eklenir) |
| R19 | Negative library hardcoded sabit |

### 10.2 Carry-Forward (named, unutulmayacak)

| ID | Carry-forward isim | Sebep |
|---|---|---|
| **R2-followup / Q6** | `kie-z-image-integration` | 2. model gerçek entegrasyonu — kabuk Phase 5'te, `generate` impl carry-forward |
| **R9-followup** | `local-asset-resolution-fix-actions` | Çözünürlük uymayan görsel için upscale/crop aksiyonları |
| **R10-followup** | `auto-quality-detection-ocr-bg` | Arka plan + yazı/imza/logo otomatik tespiti — Phase 6 (AI Quality Review) ile gelir |
| **R12-followup** | `bulk-delete-local-assets` | Toplu silme (tek tek silme Phase 5'te) |
| **Q4-followup** | `destructive-typing-confirmation` | Bulk delete + diğer riskli toplu işlemler için typing confirmation (`DELETE yaz`) |
| **R14** | `export-zip-split-20mb` | ZIP paketleme + 20 MB sıralı bölme — Selection/Export ekranıyla |
| **R15-followup** | `cost-guardrails-daily-limit` | Daily/monthly limit, admin Cost Usage ekranı |
| **R17.1-followup** | `caption-then-prompt-flow` | z-image entegrasyonu sonrası t2i-with-caption akışı UI'ı |
| **R19-followup** | `negative-library-admin-screen` | Admin paneli ekranı — hardcoded liste yönetimi UI'a gelir |
| **R20** | `local-to-ai-reference-bridge` | Storage bridge / public URL bridge — local diskten AI'ye reference taşıma |
| **R21** | `external-source-connector-midjourney` | Midjourney / browser extension / import bridge / source connector |
| **R8/R9-followup** | `dpi-resolution-batch-fix` | Quality score'da düşen görselleri batch düzeltme |
| **Q2-followup** | `local-library-deep-recursion` | Phase 5 root + first-level; daha derin recursion ihtiyacı çıkarsa |
| **Q3-followup** | `local-library-store-level-override` | Phase 5 user-level; store-level override ihtiyacı çıkarsa |

### 10.3 Bilinçli Olarak Phase 5 Dışında

- Selection Studio (background removal, color editor, crop) — CLAUDE.md Phase 7
- Mockup Studio — Phase 8
- Listing Builder — Phase 9
- Phase 6 AI Quality Review (otomatik OCR/background detection)
- Admin Master Prompt Editor UI (mevcut altyapı kullanılır, yeni admin ekranı yok)
- Multi-model paralel run (aynı reference 2 model'de aynı anda)
- Trend Cluster Detection bağlantısı

---

## 11. Açık Riskler ve Bilinmeyenler

| Risk | Etki | Hafifletme |
|---|---|---|
| kie.ai fiyatı doc'da yok | Cost guardrail placeholder'la başlıyor | UI "Doğrulanmamış maliyet" notu; ilk gerçek çağrıdan sonra observability ile fiyat çıkarılır |
| kie.ai `n` parametresi yok | 6 paralel job kuyruğu maliyet patlatabilir | R17.4 default 3 max 6; ConfirmDialog'da "X görsel üretilecek" net |
| DPI parsing güvenilirliği | sharp bazı PNG'lerde DPI dönmeyebilir | `dpi=null` durumu quality score'da "okunamadı" sebebi olarak gösterilir; kullanıcıya görünür |
| Local library kök klasörü çok büyükse | İlk index uzun sürebilir | `scan_local_folder` job; UI'da progress; manuel refresh |
| Disk silme geri alınamaz | Yanlışlıkla silme = veri kaybı | ConfirmDialog destructive tone (mevcut altyapı, CP-5) |
| kie.ai `input_urls` public erişim ister | Local reference desteklenmiyor | R17.2 — bilinçli kapsam dışı, kullanıcıya açık mesaj |

---

## 12. Self-Review Notu

Bu doc spec olarak yazıldı. Plan turunda (writing-plans) şu maddeler **task'a dönüşecek**:

1. Prisma migration (LocalLibraryAsset + GeneratedDesign + VariationJob)
2. Provider abstraction (text + image, kie-gpt-image-1.5 impl, z-image stub)
3. Local library service (scan + metadata + thumbnail)
4. Quality score service
5. Negative library hardcoded sabit + prompt builder
6. Variation job worker (BullMQ)
7. `/references/[id]/variations` route + Local mode UI
8. AI mode form + ConfirmDialog cost notice
9. Capability-aware model picker
10. Brief input + prompt snapshot
11. Delete-from-disk akışı + ConfirmDialog destructive
12. Export rename (R13) + ZIP **carry-forward stub**
13. Settings panel: rootFolderPath + targetResolution + targetDpi + kieApiKey
14. Test paketi (unit + integration + provider mock + authorization + state machine + capability)
15. Documentation: implementation notes + carry-forward kayıtları

Plan turunda tasks ~12-15 dilim olur (writing-plans kuralı: 2-5 dakikalık adımlar). Her task'ın commit'i SDD two-stage review'dan geçer (mevcut workflow).

---

## 13. Kapanmış Kararlar Referansı (Q1-Q6)

Plan turuna geçmeden önce sorulan 6 açık soru **2026-04-26'da kullanıcı tarafından kapatıldı**. Kararlar master tabloya (Q1-Q6) ve ilgili bölümlere entegre edildi. Bu bölüm yalnızca hızlı referans:

| Q | Soru | Karar | Entegre edildiği bölüm |
|---|---|---|---|
| **Q1** | Quality score formülü | Otomatik score (DPI + Resolution) **+ AYRI** manuel review flag (negative + reason). İki sinyal **birleştirilmez**. | §3.4 |
| **Q2** | Folder recursion derinliği | **Root + first-level alt klasör.** Daha derin recursion `local-library-deep-recursion` carry-forward. | §3.2 |
| **Q3** | Settings konumu | **User-level.** Store-level override `local-library-store-level-override` carry-forward. | §8 |
| **Q4** | Sil onayı | **Tek aşamalı ConfirmDialog + sert uyarı.** Body: dosya adı + klasör adı + path görünür. Typing confirmation YOK (`destructive-typing-confirmation` carry-forward). | §3.6 |
| **Q5** | URL public check | **HEAD request** (server-side fetch, UA `EtsyHub/0.1`, timeout 5sn, max 3 redirect, 5dk cache). Pattern matching ile sessiz fallback YASAK. | §4.1 |
| **Q6** | z-image Phase 5'te | **Registry shell ŞART, capability görünür ŞART.** `generate()` throws `NotImplementedError`; UI'da "Yakında" disabled badge. Hardcoded tek-model çözüm reddedildi. Gerçek impl `kie-z-image-integration` carry-forward. | §2.2, §4.5 |

Plan turuna (`writing-plans` skill, doc adı: `2026-04-26-variation-generation-plan.md`) geçilebilir.

---

## 14. Carry-Forward Master Listesi (özet — unutulmayacak)

Bu liste design doc'un **bağlayıcı** kısmıdır. İlerideki turlarda bu isimler değişmeden kullanılır:

```
1.  kie-z-image-integration
2.  local-asset-resolution-fix-actions
3.  auto-quality-detection-ocr-bg
4.  bulk-delete-local-assets
5.  destructive-typing-confirmation
6.  export-zip-split-20mb
7.  cost-guardrails-daily-limit
8.  caption-then-prompt-flow
9.  negative-library-admin-screen
10. local-to-ai-reference-bridge
11. external-source-connector-midjourney
12. dpi-resolution-batch-fix
13. local-library-deep-recursion
14. local-library-store-level-override
```

> Bu liste §10.2 ile **senkron**dur; aralarında çelişki çıkarsa §10.2 (gerekçe + doğum yeri kayıtlı tablo) kazanır.
