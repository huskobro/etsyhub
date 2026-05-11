# Review — User Guide

Bu döküman Kivasy'nin **Review** modülünü kullanan operatör için
yazıldı. Mevcut branch'teki **gerçek davranışı** anlatır — gelecek
plan değildir. Açık veya yarım kalmış noktalar açıkça işaretlidir.

> Marka: Kivasy. Repo slug `EtsyHub`, marka değil.

---

## 1. Review nedir, ne için var

Review, sisteme yeni giren görsellerin (AI tarafından üretilmiş
variation'lar veya operatörün diskten taradığı local asset'ler)
**operatör tarafından onaylandığı / reddedildiği** noktadır.

İki taraf vardır ve **karışmaz**:

- **AI suggestion** — Sistem (Gemini gibi bir provider) görseli
  inceler, bir puan ve risk işaretleri üretir. Bu **tavsiyedir**;
  herhangi bir akışı kendiliğinden ilerletmez.
- **Operator decision** — Senin Keep / Discard butonuna bastığın
  an verilen karardır. Sistemin canonical "review signal"i bu —
  yani bir görselin review aşamasını tamamladığını söyleyen tek
  resmi sinyal. Downstream ekranlar (Library, Selection, Mockup,
  Listing) operatörün ayrıca yaptığı aksiyonlarla (selection
  set'e ekleme, mockup apply tetikleme vb.) beslenir; review
  decision'ı orada **etiket / referans** olarak görünür ama
  zincirin tamamını otomatik olarak tetiklemez.

> Kural: AI ne derse desin, bir görsel review tarafında "kept"
> sayılmaz — operatör Keep'e basana kadar undecided olarak
> bekler.

---

## 2. Review ekranının bölümleri

### Queue grid mode (`/review`)

Default açılış. Üstte toolbar, altta kart grid:

- **Source segment** — AI Designs / Local Library. Hangi
  source'a baktığını belirler.
- **Decision filter** — All / Undecided / Kept / Rejected.
  Operatör damgasına göre filtreler. AI suggestion bu filter'a
  girmez.
- **Search** — AI tarafında productType key + reference notes,
  Local tarafında file name + folder name içinde tarar.
- **Card grid** — 24 item / sayfa. Kart üzerine tıklayınca focus
  mode açılır.
- **Pagination** — toplam item'a göre.
- **Bulk actions bar** — kart üstündeki checkbox'larla birden çok
  seçim alıp toplu Keep / Reject / Delete (yalnız local).

### Focus mode (`/review?item=<id>`)

Tek bir item'a yakından bakmak için. Soldaki büyük stage + sağ
info-rail + üstte topbar + altta action bar:

- **Topbar** — `<N> AI/LOCAL PENDING · THIS SCOPE … · ITEM N / M
  · progress bar · prev/scope picker/next`. Detay aşağıda.
- **Stage** — asıl görsel. Local'de orijinal asset (4096×4096
  vb.), AI'da provider sunduğu orijinal URL. Aspect-square
  container, `object-contain` (kenarlar kesilmez).
- **Filmstrip** — alt kenarda scope içindeki tüm item'ların
  thumbnail'ları, click ile geçiş.
- **Action bar** — Keep · Undecided · Discard sırasıyla. Klavye:
  `K` / `U` / `D`. Otomatik next item (Keep / Discard'ta
  ~kısa gecikmeyle).
- **Info-rail (sağ panel)** — Item, File (collapsed), System
  evaluation, Checks, AI suggestion, Summary, Provider,
  Rerun review, Stored decision, Shortcuts. Çoğu bölüm
  collapsible (`+` / `−` toggle); default kapalı.

---

## 3. Topbar — sayılar ne anlama gelir

Soldan sağa üç bilgi katmanı:

| Blok | Örnek | Anlamı |
|---|---|---|
| Source pending | `22 AI PENDING` | Şu anda baktığın source'un toplam **operatör henüz karar vermemiş** item sayısı. AI'a baksan AI rakamı, Local'e baksan Local rakamı gelir. Workspace-wide global toplam **değildir**. |
| This scope | `THIS SCOPE 12 UNDECIDED · 0 KEPT · 0 DISCARDED` | Aktif scope (folder / reference / batch / queue) içindeki operatör damgalı kırılım. Decision filter aktif olsa bile bu sayılar scope cardinality üzerinden gelir. |
| Item index | `ITEM 1 / 12` | Aktif scope içindeki cursor. M = scope toplam, page kavramı yoktur. |

Sağda ek olarak:

- **Progress bar** — `(kept + discarded) / scopeTotal`.
- **Prev / next scope** — `[` / `]` veya `,` / `.` shortcut'ı.
  Local'de folder, AI'da batch veya reference (aşağıya bak).
- **Scope picker** — dropdown; aynı kind içindeki scope'lar
  arasında atlamak için (her birinde "kaç pending var" da
  görünür).

> Eski "ALL PENDING" workspace anchor copy'si bu turda kaldırıldı
> — operatörü yanıltıyordu. Helper backend'de duruyor; dashboard
> gibi başka surface'lerde ileride kullanılabilir.

---

## 4. Grid kartta hangi bilgiler ne anlama gelir

Her kart aspect-square thumbnail + üstte / altta meta:

- **Selection checkbox** (sol üst) — bulk action için.
- **Lifecycle / score chip** (sağ üst) — Aşağıdaki "Lifecycle"
  bölümü.
- **Status badge** (sol alt) — `Kept` (yeşil) / `Rejected`
  (kırmızı) / `Undecided` (nötr). Bu **operatör damgasıdır**.
  AI suggestion bu badge'i değiştirmez.
- **Source label** —
  - **Design**: batch dominantsa `batch-XXXXXX`; yoksa
    `ref-XXXXXX` (her ikisi de yoksa em-dash).
  - **Local**: folder adı + dosya adı + format · boyut.
- **Risk indicator** (alt blok) — Blocker varsa kırmızı dolu,
  warning varsa amber outline, yoksa hiç gösterilmez. Score
  chip rengini **ezmez** — ayrı bir bilgidir.
- **"Studio" CTA** (sadece AI variation) — tek tıkla seçili
  item'dan SelectionSet açar (Quick Start).

### Score chip

AI'nın görsele verdiği 0-100 arası puan. Renk genelde şu mantıkla:

- **Yeşil** — admin'in belirlediği "iyi" eşiğin üstünde
- **Sarı tonları** — eşik bandında
- **Turuncu / kırmızı** — eşiğin altında
- **Hiç chip yok** — AI henüz puan üretmedi

Eşiklerin tam aralıkları Settings → Review tarafında ayarlanabilir
(default 60/90). Risk uyarısı varsa puan ne olursa olsun ayrı bir
küçük badge ile görünür — yüksek puanı sessizce ezmez.

---

## 5. AI değerlendirmesi ne zaman gelir

Kart sağ üstündeki chip / icon AI scoring'in nerede olduğunu söyler:

- **Saat / kum saati icon** — değerlendirme yolda, biraz bekle.
  Yaklaşık 5-30 saniye (provider hızına göre).
- **Sayı (puan)** — değerlendirme hazır.
- **Kırmızı uyarı icon** — değerlendirme başarısız oldu. Sağ
  panelden "Rerun review" ile yeniden dene.
- **Minus icon ("Not queued yet")** — bu görsel henüz scoring'e
  hiç gönderilmedi. Local source'ta klasör mapping'i atanmamış
  olabilir (Settings → Review'a bak). AI Designs için variation
  worker'ı henüz tetiklememiş olabilir.

> Beklemeyi seviyorsan: aktif scoring varken ekran her ~5 saniyede
> bir kendini günceller. Hiçbir şey yoksa polling durur ve sekme
> sessiz kalır.

---

## 6. Keep / Undecided / Discard ne yapar

- **Keep (`K`)** — Bu görseli operatör onayı altına alır.
  Üzerinde kept etiketi kalır; review tarafında "iş bitti" sayılır.
  Otomatik bir sonraki item'a geçer.
- **Discard (`D`)** — Görseli operatör reddi olarak işaretler.
  Otomatik bir sonraki item'a geçer.
- **Undecided (`U`)** — Operatör damganı geri alır. AI'ın yaptığı
  değerlendirme (puan, checks, özet) **silinmez** — referans olarak
  kalır. Otomatik geçiş yapmaz, aynı item'da kalırsın.

> Undecided'a almak yeni bir AI scoring tetiklemez. Yeniden
> puanlatmak istersen sağ panelden "Rerun review" kullan.

---

## 7. Rerun review ne yapar

Sağ panelin alt kısmında **Rerun review** açılır bloku vardır.
Tıkladığında:

1. Mevcut AI değerlendirmesi (puan, özet, risk flag'ler) silinir.
2. Operatör damgan da kalkmış olur — item undecided'a döner.
3. Yeni bir AI scoring tetiklenir. Kısa süre içinde önce "queued",
   sonra "running", sonra puan görünür.

> Rerun bir provider çağrısıdır — yani **küçük bir maliyet**.
> Yanlışlıkla tetiklenmesin diye onay isteyen bir prompt var.

**Local item özel durumu**: rerun çalışması için o görselin
bulunduğu klasöre productType atanmış olmalı (Settings → Review →
Local library). Atanmamışsa rerun başlamadan bir hata mesajı
çıkar.

---

## 8. Keyboard shortcuts

| Tuş | Aksiyon |
|---|---|
| `K` | Keep |
| `D` | Discard |
| `U` (veya `Shift+Z`) | Undecided (reset) |
| `←` / `→` | Önceki / sonraki item (aynı scope içinde) |
| `,` / `.` | Önceki / sonraki scope (folder / reference / batch) |
| `Esc` | Help modal açıksa kapatır; aksi halde focus'u kapatıp grid'e çıkar |
| `?` | Tüm shortcut'ları gösteren modal |

Shortcut'lar metin input'larında devre dışıdır (typo riski yok).
Sağ panelin altındaki `SHORTCUTS · SHOW` toggle session-scoped
localStorage'a yazılır; default kapalı.

---

## 9. Local source vs AI source

İki tarafın da review ekranı aynıdır, ama altyapı şu farklarla
gelir:

- **AI Designs** — Variation üreten worker yeni görsel ekleyince
  AI scoring otomatik tetiklenir.
- **Local Library** — Diskten taradığın klasörlerden gelir.
  Auto-scoring sadece klasörün productType'ı atanmışsa çalışır
  (Settings → Review → Local library). Atanmamışsa görsel listede
  görünür ama puan üretilmez — operatör mapping'i atayınca veya
  "Enqueue review for this scope" tetiklenince başlar.

Focus mode'daki ana görselin boyutu her iki tarafta da aynıdır;
local için orijinal dosyayı yükler, AI için provider'ın sunduğu
orijinal URL'i. Grid kartlardaki küçük thumbnail performans için
ayrı bir kaynaktan gelir.

---

## 10. Scope mantığı — ne ile filtrelenir?

Aynı reference'tan farklı zamanlarda farklı **üretim batch'leri**
çıkabilir. Operatör çoğu zaman "şu batch'i temizliyorum" mantığıyla
çalışır — bu yüzden review batch'i ön plana alır.

**AI Designs için öncelik**: `batch > reference`.
**Local için**: folder doğal scope.

Pratikte:
- Bir AI görseli aç (kart tıkla veya deep-link). Eğer o görselin
  bir batch geçmişi varsa topbar **batch**'i ve scope dropdown'u
  batch'leri gösterir. Yoksa reference'a düşer.
- Local için topbar her zaman folder'ı gösterir.
- Source-all görünümü (hiç scope seçmeden) default toolbar
  modudur.

Grid kartlardaki küçük "batch-XXXXXX" / "ref-XXXXXX" etiketi de
aynı önceliği yansıtır: batch varsa batch, yoksa reference.

> Reference scope'a inmek istersen URL'e `?scope=reference` ekle —
> batch baskınlığını geçersiz kılar.

---

## 11. Sık karşılaşacağın yan davranışlar

- **Live update** — Keep / Discard sonrası ekran kendiliğinden
  güncellenir, sayfayı yenilemen gerekmez. AI scoring çalışırken
  ~5 saniyede bir kontrol eder; her şey hazırsa sessiz durur.
- **AI advisory banner** — focus mode'da info-rail'de "AI
  suggestion: LOOKS GOOD" veya "REVIEW RECOMMENDED" gibi kısa
  bir not görünür. Bu sadece tavsiyedir — Keep / Discard kararı
  hâlâ senin.
- **Threshold değişirse eski item'lar** — Admin Settings →
  Review'da puanlama eşiklerini değiştirirse, mevcut item'ların
  zaten verilmiş kararları değişmez. UI sağ panelde "Current
  policy preview" diye ek bir bilgi gösterir (yalnız mevcut
  karar yeni eşiklerle farklılaşıyorsa).

---

## Risk sayısı, failed checks ve score — aynı hikâye

Sağ panelde "Checks 7/9 passed" gibi bir sayı görürsün; kart üzerinde
de bir risk indicator (örn. "1 warning") olabilir. Bu iki sayı **aynı
kaynaktan** beslenir:

- Kart üstündeki risk indicator = sağ paneldeki failed (applicable)
  check sayısı.
- "Not applicable for JPEG" gibi N/A check'ler iki tarafta da
  sayılmaz.
- Provider geçmişten kalan duplicate flag'lar otomatik elenir.

Score şu kuralla üretilir:

```
score = max(0, 100 − failed her kriterin weight'lerinin toplamı)
```

- Her failed (applicable) check **weight kadar** puandan düşer.
  Blocker ve warning aynı kurala uyar; severity score'u
  doğrudan etkilemez.
- Severity yalnız UI tone'unu ve AI suggestion önem mesajını
  belirler:
  - **blocker** = `Critical risk` badge, AI suggestion `REVIEW
    RECOMMENDED`
  - **warning** = amber tone, daha hafif copy
- Bir kriterin score'u 0'a indirmesini istiyorsan admin panelinde
  o kriterin weight'ini 100'e set edersin. Sürpriz "hidden zero"
  yoktur.
- N/A (Not applicable) işaretli check'ler **score'a düşmez** — sağ
  panelde N/A diye gördüğün her kriter score matematiğinin dışında
  kalır.
- Tüm check'ler N/A veya passed ise score 100.

Sağ panelde **Score breakdown** açılır bloku score'un nasıl
hesaplandığını satır satır gösterir: `Base 100 → her failed
weight → Final`. Görünen failed applicable checks ile score
deductions birebir eşittir; gizli katkı yoktur.

> Yani: score düşükse her zaman sebebini sağ panelin check listesinde
> görürsün. Yüksek score + blocker var senaryosunda "Critical risk"
> badge görürsün ama score yine weight matematiğinden çıkar — gizli
> zorlama yok.

## 12. Bilinen sınırlar (Known limitations)

Bunlar mevcut durumda çalışmıyor / eksik olan ufak yerler.
Operatör için göze çarpacak ölçüde önemli olabilir:

- **Batch'ler arası `,` / `.` shortcut'ı çalışmıyor** — AI
  Designs'ta batch baskın moddayken klavye prev/next scope
  kısayolu boş düşer. Çözüm: scope picker dropdown'unu kullan
  (üst sağ).
- **Batch lineage gerçek üretim verisi üzerinde browser-test
  edilmedi** — Mevcut development verisinde batch geçmişi taşıyan
  variation job bulunmuyor; kart şu anda hep `ref-XXXXXX`
  fallback'ini gösteriyor. Kod tarafında batch baskınlığı
  testlerle kilitli; production'da yeni variation üretildiğinde
  otomatik devreye girer.
- **`na` (not applicable) lifecycle** — Henüz hiç asset için
  üretilmiyor. UI render edebilir ama göreceğin senaryo yok.
- **Operator override notu birden fazla yerde tekrar edebilir**
  — UI'da çoğunlukla tek info-rail bloğunda yaşıyor; bazı eski
  noktalarda ufak tekrarlar kalmış olabilir.

---

## 13. Hızlı checklist — operatör akışı

1. `/review` aç → source segment (`AI Designs` veya `Local Library`)
2. Decision filter `Undecided`
3. Grid'den bir item seç → focus mode
4. Sağ panelde:
   - System evaluation: score + 9/9 passed
   - Checks: hangi kriterler geçti / fail / N/A
   - AI suggestion: looks good / review recommended
   - Summary: provider TR özeti
5. Karar ver: **Keep** veya **Discard**
6. Otomatik next item açılır; scope tükenince "All caught up"
   ekranı veya sıradaki scope.
7. Scope tükendiğinde `[` `]` ile başka scope'a geç.

---

## İlgili dokümanlar

- [Review Technical Spec](REVIEW_TECHNICAL_SPEC.md) — veri modeli,
  pipeline, queue, polling, mapping ayrıntıları.
- [Review Troubleshooting Guide](REVIEW_TROUBLESHOOTING.md) — sık
  görülen sorunlar.
- [CLAUDE.md](../../CLAUDE.md) Madde V / V' / V'' — operator
  truth ve scope priority sözleşmesi.
