# Review Module — Documentation

Kivasy review modülünün operatör, ürün/teknik ekip ve operasyon
için tam dokümantasyonu.

> IA-36 kapanış turu sonrası yazıldı. CLAUDE.md Madde V / V' / V'' /
> X+ / X++ ile tutarlı. Sayfalar mevcut branch davranışı gerçeğini
> anlatır; "tamamen kesin" gibi mutlak iddialar yumuşatılmış,
> known limitations görünür şekilde işaretlenmiştir.

## Doküman seti

| Doküman | Hedef kitle | İçerik |
|---|---|---|
| [REVIEW_USER_GUIDE.md](REVIEW_USER_GUIDE.md) | Operatör | Review ekranını nasıl kullanırım: bölümler, kart bilgileri, AI suggestion vs operator decision, shortcuts, scope mantığı |
| [REVIEW_TECHNICAL_SPEC.md](REVIEW_TECHNICAL_SPEC.md) | Ürün/teknik ekip | Veri modeli, scoring pipeline, queue endpoint, lifecycle, polling, mapping, scope priority |
| [REVIEW_TROUBLESHOOTING.md](REVIEW_TROUBLESHOOTING.md) | Operasyon | "Item not found", "not queued", auto-review olmuyor, rerun beklentisi, sayım yanlış görünüyor |

## Kapsam ve mevcut durum

Review modülünün IA-30..IA-36 turları boyunca eklenen davranışları:

- Operator truth vs AI suggestion ayrımı (CLAUDE.md Madde V).
- Deterministic, rule-based score modeli (IA-31).
- Lazy recompute response seviyesinde (IA-31).
- Threshold-aware 5-tier score tone + risk indicator (IA-31).
- Scope count invariant ghost-free (IA-32).
- Shortcuts collapsible (IA-32).
- Card preview parity content-type aware (IA-32).
- Local focus full-resolution asset endpoint (IA-33).
- Topbar source-specific pending + `THIS SCOPE` ayrımı (IA-33+34).
- Batch > reference scope priority — grid card + focus topbar +
  info-rail tutarlı (IA-34, IA-36'da info-rail uzantısı + scopeNav
  hizalaması).
- Path-based folder mapping + legacy folderName fallback (IA-35).
- Polling cadence düzeltmesi (IA-35 — not_queued artık unsettled
  değil).
- Vitest workspace pattern (IA-35).

## Review done checklist (IA-36)

Bu turdan sonra review modülünün "kapanmış" sayılması için kontrol
edilmesi gereken koşullar. Hepsi sağlanıyorsa modül downstream'e
güvenle teslim edilebilir; checklist son turda gerçek durumla
işaretlendi.

| Koşul | Durum | Not |
|---|---|---|
| Operator truth ↔ AI suggestion ayrımı sözleşmesi yazılı + kod tarafında tasarım gereği korunuyor | ✓ | CLAUDE.md Madde V; runtime constraint yok, PR review disiplini |
| Score modeli deterministic ve UI'da bugünkü kurallarla görünür (lazy recompute) | ✓ | IA-31 |
| Threshold-aware tone + ayrı risk indicator | ✓ | IA-31 |
| Scope count invariant `total = kept + rejected + undecided` | ✓ | IA-32 |
| Local focus stage AI ile parity (full-resolution asset endpoint) | ✓ | IA-33 |
| Local productType context gerçek mapping ile resolve (sahte fallback yok) | ✓ | IA-35 |
| Folder mapping path-based (collision yok) + legacy fallback | ✓ | IA-35 |
| Batch > reference scope priority — grid card + focus topbar + info-rail | ✓ | IA-34 + IA-36 |
| Live update polling: gerçek iş varken 5s, idle'da kapalı | ✓ | IA-35 |
| Vitest workspace tek `npm test` ile UI + node combined | ✓ | IA-35 |
| Targeted review test suite clean | ✓ | 79+ targeted pass |
| Production build clean | ✓ | PASS |
| Browser akış doğrulama (focus mode, FILE collapsible, topbar copy, batch label, polling idle) | ✓ | IA-32..IA-36 turlarında |
| User Guide + Technical Spec + Troubleshooting yazılı | ✓ | bu paket |

**Non-blocker known limitations** (kapanışı engellemez):

- Batch'ler arası klavye prev/next scope shortcut'ı eksik —
  picker dropdown workaround.
- Batch lineage gerçek üretim verisinde **browser-proof**
  yapılmadı (dev DB'sinde batchId taşıyan job yok); kod path'i
  unit + API testleri ile kanıtlı.
- `na` (not applicable) lifecycle UI render edebilir; backend
  henüz üretmiyor.
- `WorkflowRun` canonical lineage table gelecek faza alındı
  (CLAUDE.md Madde G).
- Repo-wide test borcu (~141 fail) review modülü dışı pre-existing
  iş.

## Test durumu — dürüst özet

| Kapsam | Durum | Anlamı |
|---|---|---|
| **Review modülü targeted suites** | **96 / 96 pass** | IA-30..IA-35 boyunca eklenen helper + UI + endpoint testleri tamamı geçer. Review davranışı için güven yüksek. |
| **Workspace-wide combined run** (`npx vitest run`) | **~2641 pass / ~141 fail** | Repo bütünü **tamamen green değil**. Fail'lerin tamamı review modülü dışındaki pre-existing borçlar (Phase 3/4 sayfaları: bookmarks, competitors, references, collections, trend-*; bulk-* eski semantik; mockup UI eski expectation'lar). |
| **Production build** (`npm run build`) | **PASS** | Type ve build tarafı temiz. |

> Bu sayılar IA-35 turunda vitest workspace pattern'ine geçildiği
> için ilk kez **görünür** hale geldi. Önceki turlar default
> `npm test` ile yalnız `.test.ts` koşuyordu; `.test.tsx` UI
> fail'leri zaten vardı ama gizliydi. IA-30+ yeni regression
> getirmedi.

## Known limitations / açık kenarlar (detay)

Done checklist'in "non-blocker" bölümünün detay açıklamaları:

- **Batch'ler arası klavye prev/next scope shortcut'ı eksik** —
  AI Designs batch baskın moddayken `,` / `.` boş düşer
  (`adjacentReferences` artık batch dominantsa scopeNav null'a
  düşer; reference adjacent göstermek yerine doğru olan davranış
  — IA-36). Scope picker dropdown çalışır.
- **Batch lineage gerçek üretim verisinde browser-proof
  yapılmadı** — Dev DB'sinde `Job.metadata.batchId` taşıyan
  variation job yok. UI render path'i:
  - `ReviewCard` batch dominance: `batchShortId ? "batch-…" :
    "ref-…"`
  - Focus topbar scope label: `scope.kind === "batch" ?
    "Batch · batch-…" : "Reference · ref-…"`
  - Info-rail variation summary: `batchShortId ? "batch-…" :
    "ref-…"` + open-state'de Batch + Reference iki satır
  Tüm path'ler kodda + unit testlerde + queue API'sinde manuel
  `?batch=` param ile doğrulandı; production'a düşünce otomatik
  aktif olur.
- **`na` (not applicable) lifecycle** — UI render edebilir ama
  backend henüz üretmiyor; gelecek kullanım için ayrılmış.
- **`Job.metadata.batchId` schema-zero pattern** — `WorkflowRun`
  tablosu canonical lineage identity olarak gelecek faza alındı
  (CLAUDE.md Madde G).
- **Repo-wide test borcu** — ~141 fail review modülü kapsamı
  dışında; review-only güven yüksek, ayrı temizlik turu işidir.

## İlgili dokümanlar

- [../../CLAUDE.md](../../CLAUDE.md) — ürün anayasası (Madde V'den
  itibaren review-spesifik bölümler).
- [../MVP_ACCEPTANCE.md](../MVP_ACCEPTANCE.md) — MVP kabul
  kriterleri (review modülü dahil).
