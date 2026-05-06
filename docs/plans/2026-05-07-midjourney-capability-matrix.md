# MJ Capability Matrix — Pass 42

**Tarih:** 2026-05-07
**Durum:** Pass 41 design doc'unun feature genişlemesi
**HEAD:** Pass 42 implementation üstüne

Pass 41 design doc bridge mimarisini koydu. Pass 42 audit'ı 3rd party
araçların ve MJ web'in yeni capability'lerini (Omni Reference, Style
Reference, Describe) ortaya çıkardı. Bu doc capability'leri **net 4
kovaya ayırır** ve roadmap'e bağlar.

## A. Capability evreni

| ID | Capability | MJ web flag/UI | Bridge ihtiyacı |
|---|---|---|---|
| `generate` | Text-to-image | `/imagine PROMPT` | Prompt input + Enter + render polling |
| `image-prompt` | Image-to-image (URL) | Prompt başına URL | Drag-drop / paste image URL DOM action |
| `style-ref` | Style Reference | `--sref URL` | Param flag append |
| `omni-ref` | Omni Reference (V7+) | `--oref URL --ow N` | Drag-drop "Omni-reference" bin DOM action |
| `character-ref` | (V6 legacy) | `--cref URL` | (V7'de Omni-Ref'e taşındı) |
| `describe` | Image → 4 prompt | Web /describe button | Image upload + DOM scrape 4 prompt |
| `upscale` | U1-U4 | Render sonrası buton | Buton click + yeni job DOM observer |
| `variation` | V1-V4 | Render sonrası buton | Aynı pattern |
| `batch-download` | Toplu indirme | Multi-select + download | DOM batch click + file save |
| `history-import` | Geçmiş job import | /archive sayfası tarama | Pagination + scrape + map |
| `metadata-capture` | Prompt+params kayıt | DOM + URL parse | Her job için zorunlu |

## B. 4 kova

### Build now (Pass 42 V1 hedefi)

| ID | Sebep |
|---|---|
| `generate` | Ana value proposition. Skeleton mock driver + service zaten kurulu. Real driver gelirse direkt çalışır. |
| `metadata-capture` | Lineage zorunlu — MidjourneyJob.mjJobId, mjMetadata, prompt snapshot. Her capability bunu omurga alır. |

### Worth adapting (V1.x — yakın takip, kullanıcı üyelik aldıktan sonraki ilk 1-2 tur)

| ID | Sebep |
|---|---|
| `image-prompt` | EtsyHub Reference → MJ akışı için kritik. Prompt başına URL append yeterli (drag-drop yerine). Bridge `imagePromptUrls[]` field zaten var. |
| `style-ref` | `--sref URL` flag append; minimal DOM iş. `referenceUrls[]` ile birlikte gönderilebilir. |
| `omni-ref` | V7+ premium feature — "char/object consistency" için kritik (kullanıcının Etsy nichesi karakter + obje setleri için ideal). Drag-drop "Omni-reference" bin selector'ı şart. **Ama**: 2x GPU cost, fast mode yok — kullanıcı UI'da explicit consent lazım. |
| `upscale` | "Bu varyantı seçtim → upscale" tek-tık akışı. DOM buton selector'u (U1/U2/U3/U4). Bridge `kind: upscale` zaten kontratta var. |
| `variation` | Aynı pattern — V1/V2/V3/V4 buton. |
| `describe` | EtsyHub Reference → "MJ'ye sor: hangi prompt'lar bu görsele benzer?" → 4 prompt önerisi review queue. Image upload akışı + 4 prompt scrape. AutoSail/AutoJourney bu feature'ı sunmuyor — biz farklılaşırız. |

### Useful later (V2+)

| ID | Sebep |
|---|---|
| `batch-download` | EtsyHub Asset import zaten tek-tek download yapıyor (her grid 4 PNG). Batch'in artı değeri sadece UX speed — kullanıcı V1 akışıyla zaten 1 job → 4 asset alır. |
| `history-import` | Onboarding aşaması: kullanıcının önceki MJ history'sini EtsyHub'a alma. Pagination + scrape + duplicate detection karmaşık; V1 müşterileri yeni başladığında gereksiz. |
| `character-ref` | V6 legacy — V7+ kullananlar için Omni Reference yeterli. |
| Prompt template / variable expansion (AutoSail emsali) | Kullanıcı bunu prompt'unda zaten yapıyor (zihin akıcı). Form-driven template UI değer/maliyet düşük. |
| Relax mode "gece kuyruğu" | Bridge tek browser → 1 paralel; relax mode user-initiated, sistem bilmesi gerekmez. |
| Multi-account | V1 tek kullanıcı, tek profile; V2+'da settings.midjourney.profiles[]. |

### Do not build now (kasıtlı dışlama)

| ID | Sebep |
|---|---|
| Captcha auto-solve | TOS bypass — Pass 41 doc §1.3 + §5.4 net dışladı. |
| Headless mode | TOS bypass — kullanıcının görmediği otomasyon. |
| Stealth plugin / fingerprint manipulation | TOS bypass kokar; ban hızlandırır. |
| MJ private API direct | Reverse-engineered endpoints; ban garantili. |
| Discord otomasyon | Kullanıcı ülkesinde Discord engelli + ekstra TOS riski. |
| Watermark removal | Etik dışı. |
| Multi-account fingerprint rotation | Ban kaçınma niyeti — TOS açık ihlal. |

## C. Roadmap'e bağlama

### Pass 42 (bu tur — tamamlanan)
- ✅ `mj-bridge/` package + HTTP server + auth + lifecycle types
- ✅ Mock driver — `generate` job için end-to-end (4 grid PNG fixture)
- ✅ Playwright driver shell — visible browser bootstrap, MJ login heuristic
- ✅ EtsyHub: MidjourneyJob + MidjourneyAsset Prisma modelleri + migration
- ✅ EtsyHub: bridge HTTP client + service + BullMQ worker
- ✅ EtsyHub: /admin/midjourney sayfası

### V1.0 (kullanıcı üyelik aldıktan sonra ilk tur — Playwright real driver)
1. **Login flow** — kullanıcı browser'da MJ'ye login eder; session persistent profile'da kalır
2. **Prompt submit (`generate`)** — Playwright DOM otomasyonu (input + Enter)
3. **Render polling** — DOM mutation observer; grid 4-up hazır olunca capture
4. **Download** — 4 image URL fetch (page request — same session cookie)
5. **Challenge detection** — Cloudflare/hCaptcha selector + AWAITING_CHALLENGE state
6. **Manual handoff UX** — `/admin/midjourney` "Bridge'i öne getir" butonu zaten kurulu

### V1.1 (Worth adapting)
- **Image prompt** (`imagePromptUrls`) — bridge zaten kontratta; Playwright tarafında prompt başına URL paste
- **Style reference** (`--sref`) — flag append; simple
- **Upscale + variation** (`kind: upscale|variation`) — yeni route + UI button + bridge butonu click selector'u

### V1.2
- **Omni reference** (`--oref --ow`) — drag-drop "Omni-reference" bin DOM action; UI param panel
- **Describe** — yeni `kind: describe` action; image upload + 4 prompt scrape; review queue insertion (kullanıcı 1 prompt seçip generate'e gönderir)

### V2+
- Resmi API alternatifleri (Flux Pro / Recraft V3 / Ideogram 3) — Pass 41 doc §9 önerisi; sürdürülebilir omurga
- Batch download UX
- History import (V2.x)
- Prompt template UI

## D. Üçüncü taraf araç değerlendirmesi (Pass 41'in update'i)

### AutoSail
- ✅ İlham: queue UI, batch submit, prompt template (V2+)
- ❌ Dependency: extension güncellemesi bizi kırar; vendor lock; TOS riskini kullanıcıya devreder

### AutoJourney Downloader
- ✅ İlham: bridge mimarisi (browser + native bridge messaging) ✓ (zaten benimsedik), structured metadata schema ✓ (MidjourneyJob.promptParams + MidjourneyAsset.mjImageUrl)
- ❌ Dependency: VIP membership lock-in; watermark removal etik dışı; multi-platform unified UI bizim sorunumuz değil

### Pass 41 sonrası yeni öğrendiklerimiz (Pass 42)
- **Omni Reference V7+** — character + object consistency kullanıcının Etsy nichesi için kritik. Bridge'in bunu desteklemesi V1.1'de zorunlu (V7+ users için).
- **Describe** — image → 4 prompt → user picks → generate. Hızlı feedback loop; AutoSail/AutoJourney bunu sunmuyor → biz farklılaşırız (Reference Atölyesi'ne entegre edilebilir).
- **Style Reference (--sref)** — simple flag, düşük effort; V1.1'de gelir.

## E. Honest dürüstlük raporu

### TOS gerçekleri (yeniden vurgu — Pass 41 §1.3)
- MJ TOS otomasyonu açıkça yasaklar; kalıcı ban riski gerçek
- Görünür browser + persistent profile + manuel intervention tercihimiz **azaltır, sıfırlamaz**
- Kullanıcı bilinçli risk alır; UI'da explicit uyarı (V1 hardening turunda)

### Capability vs effort vs risk tablosu

| Capability | Effort | Risk artışı | V1 dahil mi |
|---|---|---|---|
| `generate` (skeleton hazır) | Orta | Düşük | V1.0 |
| `metadata-capture` | Düşük | Sıfır | V1.0 |
| `image-prompt` | Düşük (URL paste) | Düşük | V1.1 |
| `style-ref` | Düşük (flag append) | Düşük | V1.1 |
| `upscale` / `variation` | Orta (DOM observer) | Orta (yeni job paterni) | V1.1 |
| `omni-ref` | Orta (drag-drop bin) | Orta (premium feature, kullanıcı consent UI) | V1.2 |
| `describe` | Orta (image upload + scrape) | Düşük | V1.2 |
| `batch-download` | Yüksek | Yüksek (rate limit kokar) | V2+ |
| `history-import` | Yüksek (pagination + duplicate) | Orta | V2+ |

## F. Sonuç

Pass 42 bridge skeleton'ı **uygulanabilir** — mock driver end-to-end test edildi. Pass 41 design doc'undaki "Local Bridge + visible browser + manuel handoff" kararı capability matrix ile somutlaştı.

Kullanıcının üyelik almasıyla **V1.0 doğrudan başlayabilir** (sırayla rollout adım 2-6 — Pass 41 doc §10). V1.1 sürpriz değişiklik gerektirmez (capability'ler bridge kontratında zaten field-level destekleniyor: `imagePromptUrls`, `styleReferenceUrls`, `omniReferenceUrl`, `omniWeight`).

**Paralel olarak resmi API provider'larının** (Flux/Recraft/Ideogram) eklenmesi sürdürülebilirlik garantisi. MJ ban olursa ürün ölmez.

## Kaynaklar (Pass 42 capability audit)

- [Midjourney Omni Reference docs](https://docs.midjourney.com/hc/en-us/articles/36285124473997-Omni-Reference)
- [Midjourney Style Reference docs](https://docs.midjourney.com/hc/en-us/articles/32180011136653-Style-Reference)
- [Midjourney Character Reference docs](https://docs.midjourney.com/hc/en-us/articles/32162917505293-Character-Reference)
- [Midjourney /describe coverage — promptsera](https://promptsera.com/free-image-to-prompt-generator/)
- [Pass 41 design doc — local web bridge](2026-05-06-midjourney-web-bridge-design.md)
