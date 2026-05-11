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

Targeted test suite: **96/96 pass**. Production build: PASS.

## Açık / yarım kalmış noktalar (özet)

- Batch scope adjacent navigation (prev/next batch shortcut) eksik.
- `Job.metadata.batchId` schema-zero pattern; `WorkflowRun` table
  ileride canonical lineage olarak gelecek.
- `na` lifecycle UI'da render edilebilir ama backend henüz üretmiyor.
- Pre-existing test borçları (~141 fail) review modülü dışı (Phase
  3/4 sayfaları + bulk-* eski semantiği). IA-30+ regression değil.

Detaylar her dokümanın "Açık / yarım kalmış noktalar" bölümünde.

## İlgili dokümanlar

- [../../CLAUDE.md](../../CLAUDE.md) — ürün anayasası (Madde V'den
  itibaren review-spesifik bölümler).
- [../MVP_ACCEPTANCE.md](../MVP_ACCEPTANCE.md) — MVP kabul
  kriterleri (review modülü dahil).
