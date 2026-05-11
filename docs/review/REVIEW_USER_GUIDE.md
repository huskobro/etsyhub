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
  an verilen karardır. Library, Selection, Mockup, Listing
  zincirinin gerçekten beslendiği imzadır. Sadece sen
  damgalayabilirsin.

> Kural: AI ne derse desin, bir görsel "kept" sayılmaz — operatör
> Keep'e basana kadar bir kenarda durur.

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

### Score chip — beş kademe

AI score (deterministic system skoru — provider raw değil) admin
threshold'larına göre renklenir (default `low=60, high=90`):

| Kademe | Aralık (default 60/90) | Tone |
|---|---|---|
| critical | `< 30` | bg-rose-600 |
| poor | `30 ≤ score < 60` | bg-orange-500 |
| warning | `60 ≤ score < 75` (band içi, midpoint altı) | bg-amber-500 |
| caution | `75 ≤ score < 90` (band içi, midpoint üstü) | bg-yellow-300 |
| success | `≥ 90` | bg-emerald-500 |
| neutral | score yok | bg-text |

Risk flag score rengini **ezmez** — score 100 olsa bile blocker
varsa amber/red risk badge ayrıca görünür.

---

## 5. Lifecycle state'leri

Her item'ın bir scoring lifecycle'i var. Kart sağ üstündeki
chip / icon bunu gösterir:

| State | Anlamı | UI sinyali |
|---|---|---|
| `not_queued` | Asset henüz hiç scoring'e gönderilmedi. Manuel veya scan auto-trigger gerekir. | "Not queued yet" minus icon |
| `queued` | REVIEW_DESIGN job'u BullMQ kuyruğunda; worker henüz almadı. | Clock icon |
| `running` | Worker provider çağrısı yapıyor. | Hourglass icon |
| `ready` | Scoring tamamlandı; score + checks + summary kaydedildi. | Score chip (sayı) |
| `failed` | Provider veya parse hatası. | Red alert icon |
| `na` | Asset için scoring uygulanabilir değil (gelecek kullanım). | Minus icon |

> **Not**: `pending`, `scoring`, `error` eski isimler. Backend
> bunlarla yazabilir; UI bunları `not_queued` / `running` /
> `failed`'a alias'lar.

---

## 6. Keep / Undecided / Discard ne yapar

- **Keep (`K`)** — Item'ı operatör-kept yapar
  (`reviewStatus = APPROVED`, `reviewStatusSource = USER`). Library
  / Selection downstream akışı buradan akar. Otomatik next item.
- **Discard (`D`)** — Reject (`reviewStatus = REJECTED`,
  `reviewStatusSource = USER`). Bu item downstream'e geçmez.
  Otomatik next item.
- **Undecided (`U`)** — Operatör damgasını kaldırır
  (`reviewStatus = PENDING`, `reviewStatusSource = SYSTEM`). AI
  evaluation snapshot'ı (score, checks, summary, reviewedAt)
  **silinmez** — referans olarak kalır. Auto-advance yok.

> Önemli: Undecided'a almak **re-score tetiklemez**. Mevcut AI
> evaluation aynen durur. Re-score istiyorsan "Rerun review" kullan
> (aşağıya bak).

---

## 7. Rerun review ne yapar

Sağ panelin alt kısmında **Rerun review** collapsible'ı vardır.
Açıp tıklarsan:

1. Mevcut snapshot **silinir** (`reviewedAt` → null,
   `reviewProviderSnapshot` / `reviewScore` / `reviewRiskFlags` →
   temizlenir).
2. Status PENDING'e, source SYSTEM'e döner (operatör damgası
   silinir).
3. Yeni REVIEW_DESIGN job'u BullMQ'ya enqueue olur.
4. UI lifecycle'ı kısa pencerede `queued → running → ready`
   olarak izlersin.

Maliyet: **bir provider çağrısı (Gemini vs.)**. Confirm prompt'u
sebebiyle yanlışlıkla tetiklenmez.

> Local item için: rerun yapılacaksa o asset'in folder'ının
> productType mapping'i atanmış olmalı. Atanmamışsa endpoint 400
> döner ve sana "Map folder in Settings → Review" mesajı çıkar.

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

| Konu | AI Designs | Local Library |
|---|---|---|
| Kaynak | Variation worker'ın ürettiği `GeneratedDesign` row'ları | Disk üzerinden scan'lenmiş `LocalLibraryAsset` row'ları |
| Scope identity | Batch (dominant) → reference → queue | Folder (`folderName`, root-filtered) → queue |
| Auto-review | Variation worker üretim sonrası otomatik enqueue eder | Scan worker yeni asset gördüğünde, **folder mapping resolved ise** enqueue eder |
| Manuel scope-trigger | Reference / batch CTA'sı | Folder "Enqueue review for this scope" CTA'sı |
| Focus stage | Provider signed URL (orijinal) | `/api/local-library/asset?hash=…` (orijinal dosya stream) |
| Grid thumbnail | Provider signed URL | `/api/local-library/thumbnail?hash=…` (512×512 webp) |
| productType bağlamı | Variation row'unun ürettiği `productTypeKey` | Folder mapping (path-based, legacy folderName fallback, convention) |

---

## 10. Batch / reference / folder / source — scope mantığı

Operatör review yaparken çoğu zaman **bir reference'ı temizlemiyor,
bir üretim batch'ini temizliyor**. Aynı reference farklı batch'lerde
farklı variation setleri üretebilir; biri bittiğinde diğerini
karıştırmak istemezsin.

Bu nedenle scope çözüm sırası:

```
AI Designs:   batch > folder (yok) > reference > source all
Local:        folder > source all
```

Pratikte:

- Bir AI item deep-link açtığında (`?item=<id>`), item'ın
  `Job.metadata.batchId`'sini sistem bakar:
  - varsa **default scope = batch**; topbar `BATCH · <id>`,
    picker batch dropdown.
  - yoksa fallback **reference**; topbar `REFERENCE · ref-…`.
  - `?scope=reference` query param verirsen batch dominance'ı
    geçersiz kılarsın (operatör reference'a düşmek isteyebilir).
- Local item için: scope her zaman folder
  (`LocalLibraryAsset.folderName` + active root filter).
- Source all (folder/reference/batch verilmemiş queue mode'u)
  default toolbar görünümüdür.

Grid kartta source label da aynı önceliği yansıtır:

- **Design source**: `batch-XXXXXX` (varsa) > `ref-XXXXXX` > em-dash.
- **Local source**: folder adı + dosya adı (folder zaten doğal
  scope; başka birincil kimlik yok).

---

## 11. Sık karşılaşacağın yan davranışlar

- **Live update** — Keep / Discard sonrası grid sayıları refresh
  atmadan yansır (React Query cache invalidation). Background
  polling yalnız listede `queued` / `running` item varsa 5s
  cadence ile çalışır; idle scope'larda polling yok.
- **AI advisory banner** — focus mode info-rail'de "AI suggestion:
  LOOKS GOOD" veya "REVIEW RECOMMENDED" kısa metni görünür. Bu
  **tavsiyedir** — operatör Keep / Discard kararıyla geçersiz
  kılabilir.
- **Stored decision vs current policy** — Threshold'lar admin'de
  değişirse persisted karar değişmez. "Current policy preview"
  ayrı bir collapsible blok olarak görünür (yalnız stored ≠
  preview olduğunda).

---

## 12. Açık / yarım kalmış noktalar (dürüst)

- **Batch lineage gerçek üretim verisinde test edilmedi**. Mevcut
  development DB'sinde `Job.metadata.batchId` taşıyan variation
  job yok; kart `ref-XXXXXX` fallback'i gösteriyor. Kod path'i 5
  unit testle kanıtlı, production'da yeni variation üretildiğinde
  batch dominance otomatik aktif olur.
- **Batch scope için adjacent scope navigation** (prev/next
  batch) eksik. Scope picker dropdown çalışıyor, `,` / `.` shortcut'ı
  reference için var ama batch dominant moddayken scopeNav null
  düşüyor. Folder picker UX'i yeterli ama batch için ek work
  gerek.
- **Operator override notu UI'da info-rail'de tek yerde**
  yaşıyor (Decision bloğu). Bazı eski UI noktalarında ayrı
  vurgular kalmış olabilir.

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
