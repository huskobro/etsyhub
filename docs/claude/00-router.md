# Kivasy — Authoritative Doc Router (READ THIS FIRST)

> **AUTHORITATIVE — CURRENT.** Bu dosya günlük çalışmanın **giriş
> noktası**dır. Bir modül/surface'e dokunmadan önce buradan ilgili
> yaşayan doc'a git. Phase tarihsel anlatısı **archive**'dadır
> (authoritative DEĞİL — günlük çalışmada inilmez).
>
> **Son güncelleme:** Phase 135 (2026-05-16)

---

## Nasıl kullanılır

1. `CLAUDE.md` = ürün anayasası core (scope, roller, güvenlik,
   Canonical Surface İlkeleri A–Y, Madde Z Review Freeze, Marka).
   Anayasa kuralı değişiyorsa orada güncellenir.
2. **Bir modül/surface'in GÜNCEL davranışı + invariant'ı** →
   aşağıdaki pipeline-stage doc tablosundan ilgili dosya.
3. **Tarihsel "neden bu karar"** → archive (yalnız gerekirse).

Her yaşayan doc **aynı 6-başlık iskeleti** taşır: Kapsam/Rol/
Boundary → Current behavior → Invariants → Relevant files/Ownership
→ Open issues/Deferred → Archive pointer. (Karmaşık modülde 6
başlığın ALTINA modül-spesifik ek başlık olabilir; çekirdek 6
başlık yeri sabittir.)

## Canonical pipeline (ürün omurgası)

```
References → Batch → Review → Selection → Library → Products → Etsy Draft
   (intake)  (üretim) (karar)  (kürasyon)  (asset)  (mockup+listing) (publish)
```

Her ok bir **action** (single primary CTA), sayfa zinciri değil.
Stage doc'ları bu sıraya göre numaralandırılır.

## Yaşayan authoritative doc'lar (pipeline sırası)

| # | Stage / alan | Doc |
|---|---|---|
| 0 | Router (bu dosya) | `docs/claude/00-router.md` |
| 1 | App shell / sidebar / nav / palette / notifications | `docs/claude/app-shell.md` |
| 2 | References intake (Pool/Stories/Inbox/Shops/Collections + Add Reference + Bookmark/Competitor/Trend) | `docs/claude/references-intake.md` |
| 3 | Batch pipeline (compose/launch/queue/lineage/batch detail) | `docs/claude/batch-pipeline.md` |
| 4 | Review (canonical decision workspace — **FREEZE**) | `docs/claude/review.md` → `docs/review/*` |
| 5 | Selection / Library / Products **boundary** + Selection edit studio + finalize handoff | `docs/claude/selection-library-products.md` |
| 6 | Mockup Studio — genel davranış sözleşmesi (§1–13) | `docs/claude/mockup-studio-contract.md` |
| 6a | Mockup Studio — zoom / navigator pad / viewfinder / marker / pan-reach | `docs/claude/mockup-studio-zoom-navigator.md` |
| 6b | Mockup Studio — plate / composition / cascade / aspect-fit / rotated-AABB | `docs/claude/mockup-studio-framing.md` |
| 6c | Mockup Studio — right rail thumb / chrome / aspect / single-renderer | `docs/claude/mockup-studio-rail-preview.md` |
| 7 | Product / Etsy (Products detail, Listing builder, Frame export, Etsy draft V1) | `docs/claude/product-etsy.md` |
| 8 | Settings / Admin (panes, prompt/provider/template admin, negative library, cost) | `docs/claude/settings-admin.md` |
| — | Açık item'lar / bilinçli erteleme / future direction (tüm modüller) | `docs/claude/known-issues-and-deferred.md` |

## Sidebar surface → stage doc eşlemesi

Operatör hangi sidebar öğesindeyse hangi doc'a bakacağı:

| Sidebar | Stage doc |
|---|---|
| Overview / Dashboard | `app-shell.md` (#1) |
| References (Pool/Stories/Inbox/Shops) · Bookmarks · Collections · Competitors · Trend Stories | `references-intake.md` (#2) |
| Batches | `batch-pipeline.md` (#3) |
| Review | `review.md` (#4) |
| Library · Selections · Products | `selection-library-products.md` (#5) |
| (Selection → Apply Mockups → Mockup Studio) | `mockup-studio-*.md` (#6/6a/6b/6c) |
| (Products → Listing / Frame export / Etsy) | `product-etsy.md` (#7) |
| Templates · Settings | `settings-admin.md` (#8) |

## Mevcut docs/ authoritative (DOKUNULMAZ — bu router'dan linklenir)

| Konu | Dosya |
|---|---|
| MVP acceptance + readiness | `docs/MVP_ACCEPTANCE.md` |
| Production shakedown (release günü) | `docs/PRODUCTION_SHAKEDOWN.md` |
| Implementation handoff (rollout sırası) | `docs/IMPLEMENTATION_HANDOFF.md` |
| Design parity checkpoint | `docs/DESIGN_PARITY_CHECKPOINT.md` |
| Review modülü detay paketi | `docs/review/` (README, TECHNICAL_SPEC, TROUBLESHOOTING, USER_GUIDE) |
| Design system | `docs/design-system/kivasy/` |

## Archive — NOT AUTHORITATIVE (yalnız tarihsel bağlam)

| Dosya | İçerik |
|---|---|
| `docs/claude/archive/phase-log-12-96.md` | Batch-First Phase 1 → Mockup Studio Phase ~96 |
| `docs/claude/archive/phase-log-97-135.md` | Phase 97 → 135 (framing/zoom/rail/Frame export) |

**Günlük çalışmada archive'a İNİLMEZ.** Karar mantığı stage
doc'lara invariant olarak özetlenmiştir. Archive yalnız "bu
karar tarihsel olarak neden böyle verildi" sorusu için.

## Canonical boundary haritası (en kritik invariant)

```
Library  ≠  Selections  ≠  Products   — KARIŞTIRILMAZ
Library      = üretilmiş asset'lerin tek doğruluk kaynağı (filter-driven)
Selections   = kürate edilmiş set (mockup'a giden hat; edit studio)
Products     = mockup + listing + Etsy paket
State akışı TEK YÖNLÜ (geri yazım yok):
Reference → Batch → Library asset → Selection set → Product → Etsy draft
```
Detay + ihlal riskleri → `selection-library-products.md`.

## CRITICAL DOCUMENTATION PATTERN — yeni iş bitince NEREYE yazılır

1. **Davranış değişikliği canonical invariant ise** → ilgili
   stage doc'a **kural olarak** yaz (narrative DEĞİL — "şu
   değişmez" özeti) + "Son güncelleme: Phase N" güncelle.
2. **Tarihsel "neden" gerekçesi** → ilgili archive phase-log
   dosyasının SONUNA `## Phase N — başlık` entry.
3. **Ürün anayasası / Canonical Surface / Review Freeze / Marka
   değişiyorsa** (nadir) → `CLAUDE.md` core.
4. **Yeni açık item / erteleme** → `known-issues-and-deferred.md`.
5. Asla yeni davranışı yalnız archive'a yazıp stage doc'u
   güncellemeden bırakma (gelecek ajan archive'ı authoritative
   sanmaz; stage doc canonical kaynaktır).
6. Yeni stage doc gerekirse `docs/claude/` altına ekle + bu
   router tablolarına satır ekle + cross-ref ver (broken
   reference YOK). Çok sayıda küçük dosya AÇMA — pipeline-stage
   bazlı az sayıda doc; gerçekten karmaşık alt-alanlar 6 sabit
   başlığın ALTINA modül-spesifik ek başlık olur (ayrı dosya
   değil), Mockup Studio gibi çok büyükse companion doc (6a/6b/6c
   pattern).
