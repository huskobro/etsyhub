# Review Module — Documentation

Kivasy review modülünün operatör, ürün/teknik ekip ve operasyon
için tam dokümantasyonu.

> Branch HEAD `87942ba` (IA-35) referans alınarak yazıldı. CLAUDE.md
> Madde V / V' / V'' / X+ / X++ ile tutarlı.

## Doküman seti

| Doküman | Hedef kitle | İçerik |
|---|---|---|
| [REVIEW_USER_GUIDE.md](REVIEW_USER_GUIDE.md) | Operatör | Review ekranını nasıl kullanırım: bölümler, kart bilgileri, AI suggestion vs operator decision, shortcuts, scope mantığı |
| [REVIEW_TECHNICAL_SPEC.md](REVIEW_TECHNICAL_SPEC.md) | Ürün/teknik ekip | Veri modeli, scoring pipeline, queue endpoint, lifecycle, polling, mapping, scope priority |
| [REVIEW_TROUBLESHOOTING.md](REVIEW_TROUBLESHOOTING.md) | Operasyon | "Item not found", "not queued", auto-review olmuyor, rerun beklentisi, sayım yanlış görünüyor |

## Kapsam ve mevcut durum

Bu dokümanlar yazıldığında review modülü şu durumdaydı:

- Operator truth vs AI suggestion ayrımı **tam** (CLAUDE.md Madde V).
- Score modeli **deterministic**, rule-based (IA-31).
- Lazy recompute response seviyesinde (IA-31).
- Threshold-aware 5-tier score tone + risk indicator (IA-31).
- Scope count invariant ghost-free (IA-32).
- Shortcuts collapsible (IA-32).
- Card preview parity content-type aware (IA-32).
- Local focus full-resolution asset endpoint (IA-33).
- Topbar source-specific pending + `THIS SCOPE` ayrımı (IA-33+34).
- Batch > reference scope priority (IA-34).
- Path-based folder mapping + legacy folderName fallback (IA-35).
- Polling cadence düzeltmesi (IA-35 — not_queued artık unsettled
  değil).
- Vitest workspace pattern (IA-35).

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

## Known limitations / açık kenarlar

Mevcut durumda review modülü "kapatma" turuna hazır ama tamamen
sıfır açık değil. Operatöre veya teknik ekibe görünebilecek
ufak kenarlar:

- **Batch'ler arası klavye prev/next scope shortcut'ı eksik** —
  AI Designs batch baskın moddayken `,` / `.` boş düşer; scope
  picker dropdown kullanılır.
- **Batch lineage gerçek üretim verisinde browser-test edilmedi**
  — Dev DB'sinde `Job.metadata.batchId` taşıyan variation job yok;
  grid kart şu an `ref-XXXXXX` fallback'ini gösteriyor. Kod
  path'i unit testlerle kilitli, production'a düşünce otomatik
  aktif olur.
- **`na` (not applicable) lifecycle** — UI render edebilir ama
  backend henüz üretmiyor; gelecek kullanım.
- **`Job.metadata.batchId` schema-zero pattern** — `WorkflowRun`
  tablosu canonical lineage identity olarak gelecek faza alındı
  (CLAUDE.md Madde G).
- **Repo-wide test borcu** — 141 fail review modülü kapsamı
  dışında ama tamamen yeşil olmayan bir CI durumu yaratır;
  review-only güven yüksek, ayrı temizlik turu işidir.

Detaylar her dokümanın "Known limitations" / "Açık / yarım
kalmış noktalar" bölümünde.

## İlgili dokümanlar

- [../../CLAUDE.md](../../CLAUDE.md) — ürün anayasası (Madde V'den
  itibaren review-spesifik bölümler).
- [../MVP_ACCEPTANCE.md](../MVP_ACCEPTANCE.md) — MVP kabul
  kriterleri (review modülü dahil).
