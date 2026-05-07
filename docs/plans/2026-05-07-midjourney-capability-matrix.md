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

### Pass 42 (tamamlanan)
- ✅ `mj-bridge/` package + HTTP server + auth + lifecycle types
- ✅ Mock driver — `generate` job için end-to-end (4 grid PNG fixture)
- ✅ Playwright driver SHELL — visible browser bootstrap, MJ login heuristic
- ✅ EtsyHub: MidjourneyJob + MidjourneyAsset Prisma modelleri + migration
- ✅ EtsyHub: bridge HTTP client + service + BullMQ worker
- ✅ EtsyHub: /admin/midjourney sayfası

### Pass 47 (attached browser model — tamamlanan)
- ✅ **Stratejik karar**: manual generate + import REDDEDİLDİ. Hedef
  model **attached browser profile + automated workflow** —
  kullanıcı bir kez login olur, bridge oraya bağlanır, generate ve
  sonrası OTOMATİK.
- ✅ `PlaywrightDriverConfig` yeni alanlar:
    `mode: "attach" | "launch"` (default attach)
    `cdpUrl: string` (default http://127.0.0.1:9222)
    `browserKind: "chrome" | "brave" | "chromium"` (default chrome)
- ✅ `initAttach()` — `chromium.connectOverCDP(cdpUrl)` ile mevcut
  browser'a bağlanır. Yeni pencere AÇMAZ; mevcut tab'lara karışır.
  Mevcut MJ tab varsa onu seçer, yoksa yeni tab oluşturur. Shutdown
  attach modunda context'i kapatmaz (kullanıcı pencerelerini bozmaz).
- ✅ `initLaunch()` — Pass 43-46 davranışı korundu (test/dev için).
  `browserKind="brave"` Brave binary path desteği eklendi
  (`MJ_BRIDGE_BRAVE_PATH` env override).
- ✅ Attach mode error handling: CDP unreachable → human-readable
  exception (Brave/Chrome başlatma komutu önerisi içinde).
- ✅ Health endpoint genişletildi: `mode`, `cdpUrl`, `browserKind`
  alanları (admin teşhis için kritik).
- ✅ Mock driver kontrat senkron: `mode: "mock"`, `browserKind: "mock"`.
- ✅ EtsyHub bridge-client + admin sayfa Pass 47 alanlarını forward eder.
- ✅ Admin /admin/midjourney:
    - Browser kartında "Mod / Binary / Profile" + (attach ise) "CDP: ...".
    - Handoff banner attach modunda farklı metin: "Bridge sizin
      başlattığınız Brave/Chrome penceresine bağlı".
    - Kurulum ipucu paneli attach komutu varsayılan olarak gösterilir
      (default expanded), launch alternatifleri yorum olarak.
- ✅ Bridge index.ts env mapping: `MJ_BRIDGE_BROWSER_MODE`,
  `MJ_BRIDGE_CDP_URL`, `MJ_BRIDGE_BROWSER_KIND` (Pass 45
  `_BROWSER_CHANNEL` deprecated ama geriye uyumlu).
- ✅ Mock regression yok (canlı doğrulandı).
- ⚠ **Pass 47 dürüst sınır**: Bu turun Claude code session'ında
  kullanıcının fiziksel olarak Brave/Chrome'u remote-debugging
  port'uyla başlatması bekleniyor. Test ortamında bu manuel adım
  yapılamadığı için **attach modu canlı CDP bağlantısı
  doğrulanamadı**. Tüm kontrat (config, init, health, error message)
  yazıldı ve bridge tsc temiz; kullanıcı browser'ı manuel başlatınca
  bağlantı çalışacak.

### Pass 46 (driver gözlem + inspect script kalibrasyon — tamamlanan)
- ✅ PlaywrightDriver `lastDriverMessage` + `lastDriverError` alanları
  (state machine progress'i admin debug için yansır).
- ✅ executeJob içinde onProgress wrap — her transition lastMessage'ı
  set; AWAITING durumlarında lastError korunur, COMPLETED/yeni
  job'da temizlenir.
- ✅ BridgeDriver kontratı + Mock + http forward + EtsyHub bridge-client
  + admin sayfa hepsi senkron güncellendi.
- ✅ Admin /admin/midjourney Browser kartında yeni "Driver: ..." +
  kırmızı "Hata: ..." satırları (lastMessage/Error gösterimi).
- ✅ Inspect script Pass 45 channel + automation flag fix kullanır
  (system Chrome default; bundled fallback warning ile).
- ✅ Inspect script daha agresif DOM probe: `textInputs` (textarea +
  input[type=text] + role=textbox + contenteditable), `allImages`
  (src + alt sample), `dataAttrSample` (data-* attribute audit),
  page structure flags (hasMainNav, buttonCount, imgCount).
- ✅ Inspect bekleme süresi `MJ_INSPECT_WAIT_MS` env (default 30sn)
  ile konfigüre edilebilir — uzun manuel CF/login süreci için
  60sn+ verilebilir.
- ✅ Mock driver regression yok (canlı doğrulandı: COMPLETED + 4 grid).
- ⚠ **Pass 46 dürüst sınır**: Cloudflare managed challenge **kullanıcı
  tarafından manuel olarak** çözülmesi gerek. Bu turun Claude code
  session'ında manuel intervention yapılamadı; her bridge başlatmada
  CF interstitial tekrar tetiklendi → logged-in MJ DOM kalibre
  EDİLEMEDİ → generate flow real DOM'da TEST EDİLEMEDİ.
  Çözüm pratik: kullanıcı bridge'i kendi terminalinde başlatır,
  açılan Chrome penceresinde 1 kez manuel CF + Discord/Google login
  yapar, sonra inspect script tekrar çalıştırılır → MJ DOM görünür
  olur, selector default'lar kalibre edilebilir.

### Pass 44 (kalibrasyon turu — tamamlanan)
- ✅ Standalone DOM inspection script (`scripts/inspect-mj-dom.ts`):
  persistent profile'a bağlanır, MJ home/imagine/archive sayfalarını
  inspect eder, selector report + Cloudflare interstitial debug JSON
  yazar (`data/dom-inspection/`).
- ✅ **CRITICAL bulgu**: MJ web Türkçe lokalize Cloudflare full-page
  interstitial gösteriyor ("Bir dakika lütfen…" + "Güvenlik doğrulaması
  yapılıyor"). Pass 43 detection iframe-based'di; full-page interstitial
  yakalamadı.
- ✅ `detection.ts` `detectChallengeRequired` upgrade: title pattern
  (Just a moment / Bir dakika / Moment bitte / Momento por favor /
  Un moment / wait), Ray ID regex, `a[href*="cloudflare.com"]`,
  verify text lokalize (Güvenlik doğrulaması, Sicherheitsüberprüfung,
  Verificación de seguridad, Vérification de sécurité), cf- class.
  İki güçlü sinyal kombosu (Ray ID + cloudflare link, verify text +
  cloudflare link, title + cf-class).
- ✅ Stale lock cleanup: PlaywrightDriver init'inde
  `SingletonLock`/`SingletonCookie`/`SingletonSocket` best-effort sil
  (bridge crash veya inspection script profile'ı çökmüş bıraksa bile
  sonraki başlatma fail olmaz).
- ✅ tsconfig DOM lib: page.evaluate browser-context callback'leri için
  `document` global'ı tipler tanır.
- ✅ **CANLI DOĞRULAMA**: bridge real driver MJ home'a navigate etti +
  CF interstitial state algıladı + job state `AWAITING_CHALLENGE` +
  blockReason `challenge-required` + waitForChallengeCleared polling
  "Bekliyoruz… Ns" message'ı. **Pass 43'te bu state kaybediyordu**
  (AWAITING_LOGIN'e düşüyordu) — Pass 44 bunu fix etti.
- ✅ Admin /admin/midjourney: yeni handoff bilgi banner — bridge bağlı
  ama mjSession pasif ise "Manuel intervention bekleniyor: Cloudflare
  doğrulamasını tamamlayın + Discord/Google login".

### Pass 43 (önceki tur — tamamlanan)
- ✅ Selector katmanı: `selectors.ts` (17 key) + URL config + env override
  (`MJ_SELECTOR_OVERRIDES`, `MJ_BASE_URL`)
- ✅ Detection helpers: `detection.ts` — detectLoginRequired,
  detectChallengeRequired, waitForChallengeCleared, waitForLogin,
  smokeCheckSelectors
- ✅ Generate flow helpers: `generate-flow.ts` — buildMJPromptString
  (--ar / --v / --style raw / --stylize / --chaos / --sref / --oref / --ow
  flag desteği), submitPrompt (Cmd+A clear + char-by-char type + jitter
  + Enter), waitForRender (DOM polling + baselineCount), downloadGridImages
  (page.request.get aynı session)
- ✅ PlaywrightDriver real — shell yerine: launchPersistentContext +
  visible Chromium + selector smoke + executeJob gerçek lifecycle:
  OPENING_BROWSER → AWAITING_CHALLENGE? → AWAITING_LOGIN? →
  SUBMITTING_PROMPT → WAITING_FOR_RENDER → COLLECTING_OUTPUTS →
  DOWNLOADING → COMPLETED. Hata yolları: SelectorMismatchError →
  selector-mismatch, render timeout → render-timeout, login timeout →
  login-required.
- ✅ Health endpoint genişletildi: driver kimliği + selectorSmoke
  (PlaywrightDriver: prompt/loginIndicator/signInLink found durumu)
- ✅ EtsyHub admin /admin/midjourney: driver + selector smoke kart
- ✅ Mock + real driver birlikte yaşıyor (config: MJ_BRIDGE_DRIVER env)
- ✅ Canlı doğrulama: real driver MJ web'e gitti, login-required state'e
  doğru geçti

### V1.0 (Pass 43 ile büyük kısmı INDIRILDI — kullanıcı login akışıyla son kalibre)
1. **Login flow** — Pass 43 ✅ AWAITING_LOGIN state'i ve waitForLogin polling
   yazıldı; gerçek MJ ana sayfasında doğru detect ediyor (selectorSmoke
   `signInLinkFound: true`). Kullanıcının ilk gerçek login'de session
   persistent profile'a kaydolacak.
2. **Prompt submit (`generate`)** — Pass 43 ✅ submitPrompt + buildMJPromptString
   yazıldı. Selector default'lar logged-in kullanıcı testinde DOĞRULANACAK
   (V1.0 kalibrasyon turu).
3. **Render polling** — Pass 43 ✅ waitForRender (baselineCount + DOM polling +
   4 img bekleme). Selector kalibrasyonu logged-in test ile.
4. **Download** — Pass 43 ✅ downloadGridImages (page.request.get — aynı
   session cookie). Full-resolution upgrade (thumbnail → original) V1.1.
5. **Challenge detection** — Pass 43 ✅ Cloudflare + hCaptcha iframe + URL
   pattern detect, waitForChallengeCleared polling. Logged-in oturumda
   gerçek challenge testi V1.0 kalibrasyon turu.
6. **Manual handoff UX** — Pass 42'de admin sayfasında zaten kurulu;
   Pass 43'te selector smoke + driver kimliği eklendi.

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
