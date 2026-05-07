# Midjourney Service — Capability Map

> Pass 70 — kullanıcı talebi: "mükemmel bir Midjourney servisimiz olsun;
> sonra bunu diğer uygulamalara da entegre edebilelim". Bu doc, bu hedef
> için **uygulama-bağımsız (app-agnostic) MJ servis yüzeyi**'nin haritası.

## Capability dağılımı (kanıt seviyesinde)

| # | Capability | Yol | Kanıt | Durum |
|---|---|---|---|---|
| 1 | **Generate (text→image)** | `submitPrompt` (DOM, Pass 49) | Yıllardır kullanılıyor | ✅ Production |
| 1b | Generate **API path** | `POST /api/submit-jobs` (MJ kendi domain) | Pass 69 live capture | 🟡 Kanıt + 1 belirsizlik (channelId resolution) |
| 2 | **Describe (image→4 prompt)** | `describeImageViaApi` (`POST /api/describe`) | Pass 67/68/69 (3 bağımsız doğrulama, ~4-6 sn) | ✅ Production |
| 2b | Describe DOM fallback | `describeImage` (Pass 66) | Pass 66 implementasyonu | ✅ Korunuyor |
| 3 | **Image-prompt** | "Add Images → Image Prompts" + setInputFiles + DOM submit | Pass 65 implementasyonu | 🟡 Bridge state polling stuck (Pass 65'ten devralınan) |
| 4 | **Style Reference (--sref)** | `buildMJPromptString` flag | `main.js` literal kanıt | 🟡 Bridge OK, EtsyHub UI input yok |
| 5 | **Omni Reference (--oref --ow)** | `buildMJPromptString` flag | `main.js` literal kanıt | 🟡 Bridge OK, EtsyHub UI input yok |
| 6 | **Character Reference (--cref)** | Henüz yok | `main.js` literal pattern aynı | 🟡 Bridge field eksik |
| 7 | **Upscale (Subtle/Creative)** | `triggerUpscale` (DOM) + `waitForUpscaleResult` | Pass 60-61 implementasyonu | 🟡 Park (V7 alpha dedup) |
| 8 | **Variation (Subtle/Strong)** | Henüz yok | Pass 41 contract'ta tanımlı | 🟡 Implement değil |
| 9 | **Animate / Start Frame (image→video)** | Pass 65 v1 smoke kanıtladı | "Add Images → Start Frame" + setInputFiles → MJ video çıkardı | 🟡 Bilinçli korundu, Pass 71+ kapsamı |
| 10 | **Render polling** | `waitForRender` (DOM image src + UUID baseline) | Pass 49 implementasyonu | ✅ Production (image-prompt'ta stuck bug) |
| 11 | **Storage upload** | `POST /api/storage-upload-file` (multipart) | Pass 67 capture + `describeImageViaApi` upload bypass kullanıyor | ✅ Helper ready |
| 12 | **Asset ingest (download → MinIO)** | `ingestOutputs` service | Pass 42 implementasyonu | ✅ Production |
| 13 | **Format export** (PNG/JPEG/WebP) | sharp pipeline | Pass 62 implementasyonu | ✅ Production |
| 14 | **Bulk export ZIP** | `archiver` + storage stream | Pass 63 implementasyonu | ✅ Production |
| 15 | **Auto-promote → Review** | `bulkPromoteMidjourneyAssets` | Pass 56 + Pass 64 | ✅ Production (referenceId + productTypeId şartı) |

## App-agnostic servis yüzeyi (önerilen soyutlama)

EtsyHub bu MJ servisini başka uygulamalara açmak isterse (örn. başka
POD platformu veya direkt Midjourney UI alternatifi), şu **6 capability
endpoint'i** yeterli:

```
POST /v1/mj/generate
  body: { prompt, aspectRatio, version?, styleRaw?, stylize?, chaos?,
          imagePromptUrls[]?, styleReferenceUrls[]?,
          omniReferenceUrl?, omniWeight?, characterReferenceUrl? }
  return: { jobId, status, eta }

POST /v1/mj/describe
  body: { imageUrl }
  return: { prompts[4], sourceImageUrl, resolvedImageUrl }

POST /v1/mj/upscale
  body: { parentMjJobId, gridIndex, mode: "subtle" | "creative" }
  return: { jobId, status }

GET /v1/mj/jobs/{jobId}
  return: { state, blockReason?, prompts?, outputs[]?, mjJobId? }

GET /v1/mj/jobs/{jobId}/outputs/{gridIndex}.{format}
  binary stream (PNG/JPEG/WebP via sharp pipeline)

POST /v1/mj/jobs/{jobId}/cancel
  return: { state }
```

Bu yüzey:
- **MJ-specific ama app-agnostic** (Etsy/Shopify/POD bağımsız)
- Auth: API key (Pass 71+)
- Async pattern: submit (sync ack) + poll/sub (state stream)
- Storage: MinIO output (cdn.midjourney.com URL'i + sharp dönüşümü)

## Kullanıcı tercihleri katmanı (Pass 70 yeni)

`src/app/(admin)/admin/midjourney/preferences.ts` typed registry:
- Bugün: `defaultExportFormat`, `autoExpandPromoteAfterCompletion`
- Yarın: rate-limit interval, filename rename rules, banned words,
  random pre/suffix, scheduled send

AutoSail'in `TAMPER_MIDJOURNEY_STORAGE_SETTINGS` (100+ field) modelinin
ürün-doğru karşılığı: typed registry + admin panel + (ileride) Settings
Registry server-side hub.

## Pass 70 carry-forward / Pass 71 ana hedefler

1. **Generate API helper** (`submitPromptViaApi`) — `channelId`
   resolution + render polling endpoint live capture (kullanıcı
   katılımı gerek)
2. **Image-prompt waitForRender stuck fix** (Pass 65'ten devralınan)
3. **`?reusePrompt=...` URL parametresi** TestRenderForm pre-fill
   (Pass 66'dan devralınan)
4. **Sref/oref/cref UI alanları** (TestRenderForm'da opsiyonel input'lar)
5. **`--cref` MjGenerateParams field** (bridge contract)
6. **Auto-expand-promote** preference detail page'e bağlama
7. **Public API yüzeyi** (yukarıdaki `/v1/mj/*`) — Pass 72+ kapsamı
