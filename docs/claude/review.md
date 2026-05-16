# Review (Canonical Decision Workspace — FROZEN)

> **AUTHORITATIVE — CURRENT (pointer doc).** Stage #4 (karar).
> Review modülü **2026-05-11'de KAPATILMIŞ ve KİLİTLİ** (CLAUDE.md
> Madde Z). Bu doc kısa router + Freeze invariant özetidir; detay
> paket `docs/review/*` (authoritative). Phase narrative DEĞİL.
>
> **Son güncelleme:** Phase 135 (2026-05-16)
> **Router:** `docs/claude/00-router.md` · **Önceki:**
> `batch-pipeline.md` · **Sonraki:** `selection-library-products.md`

---

## 1. Kapsam / Rol / Boundary

Review = tek canonical decision workspace (`/review` + scope
param'ları: `?batch=` / `?source=ai|local` / `?decision=` /
`?item=`). Operatör AI/scan advisory ile **üretilen design'ları
keep/discard/undecided** eder. **Boundary:** Review yalnız karar
katmanı; üretim **Batch**'te, kürasyon **Selection**'da. Review
downstream gate'tir (operator kept olmadan Library→Selection→
Product ilerlemez).

## 2. Current behavior

**MODÜL FROZEN — açıkça talep edilmedikçe değiştirilmez.** Güncel
davranış detay paketi:

| Konu | Authoritative dosya |
|---|---|
| Genel + ops + automation | `docs/review/README.md` |
| Teknik spec (scoring, schema, lifecycle) | `docs/review/REVIEW_TECHNICAL_SPEC.md` |
| Sorun giderme | `docs/review/REVIEW_TROUBLESHOOTING.md` |
| Operatör rehberi | `docs/review/REVIEW_USER_GUIDE.md` |

Kısa özet: canonical `/review` scope-aware (batch/folder/reference/
queue); operator decision (`reviewStatus`+`reviewStatusSource`)
vs AI advisory (`reviewSuggestedStatus`) ayrı; deterministic
score (`finalScore = clamp(0,100,100−Σ weight(failed))`); lifecycle
(not_queued/queued/running/ready/failed/na); automation toggles
(`aiAutoEnqueue`/`localAutoEnqueue`/`localScanIntervalMinutes`);
worker auto-start (`instrumentation.ts`).

## 3. Invariants (değişmez — Madde Z kilitli sözleşmeler)

> **Enforcement-tier (kod-grounding 2026-05-17):** Aşağıdaki
> çekirdek sözleşmelerin tamamı **KOD-ENFORCED** doğrulandı —
> doc %100 koda dayalı (tarihsel niyet değil). UI-layout maddesi
> tek POLICY istisnası (component layer; aşağıda işaretli).

- **Operator truth vs AI advisory (KOD-ENFORCED):** `reviewStatus`
  = operatör damgası — worker ASLA dokunmaz (`review-design.
  worker.ts:343,571` yalnız `reviewSuggestedStatus` yazar;
  `sticky.ts:181-191` USER-source iken `reviewStatus` update'i
  bloklar). `reviewSuggestedStatus` = AI advisory.
- **Score modeli (KOD-ENFORCED):** `finalScore = clamp(0,100,
  100−Σ weight(failed))` (`decision.ts:204-207` birebir; blocker
  severity yalnız UI presentation, score'a girmez — eski
  blockerForce kaldırıldı). "hidden auto-zero" geri eklenemez.
- **Downstream gate (KOD-ENFORCED):** `reviewStatus=APPROVED ∧
  reviewStatusSource=USER` SQL filter (`queue/route.ts:302`,
  `kept.ts:783-784`) olmadan hiçbir pipeline "kept" saymaz. AI
  advisory gate geçemez.
- **Scope count invariant (KOD-ENFORCED):** `total = kept +
  rejected + undecided`; `undecided = reviewStatusSource != USER`
  (`queue/route.ts:293-305` count query'leri bu axis; ghost-free).
- **UI semantics (POLICY — component layer):** topbar hiyerarşi,
  batch>reference scope priority, klavye sözleşmesi
  (`K/D/U/←/→/,/.`), progress bar, lifecycle gösterimi —
  `REVIEW_USER_GUIDE.md` + component'lerde; structural lock
  runtime-enforced DEĞİL (component değiştirilebilir; Madde Z
  3-koşul kuralı + code-review disiplini korur).
- **Automation contract kilitli:** 3 toggle + 7-kod `not_queued`
  reason taxonomy (`pending_mapping`/`ignored`/`auto_enqueue_
  disabled`/`discovery_not_run`/`design_pending_worker`/`legacy`/
  `unknown`).
- **Worker auto-start kilitli:** `src/instrumentation.ts`
  (BullMQ + chokidar; ayrı `npm run worker` gerekmez).
- **Değişiklik kuralı (Madde Z):** review tarafına dokunmak için
  3 koşuldan biri zorunlu — (1) açık kullanıcı talebi, (2) review
  modülü bug fix (scope yalnız o bug), (3) zorunlu altyapı
  (Prisma migration vb., dokunuş minimuma indirilir + açıkça
  belirtilir). Bu 3 dışında **tek satır dokunulmaz**.

## 4. Relevant files / Ownership

- `src/features/review/` — QueueReviewWorkspace,
  ReviewWorkspaceShell, ScopeCompletionCard, EvaluationPanel
- `src/app/(app)/review/` — canonical route + scope resolve
- `src/app/api/review/` — queue endpoint, PATCH decision, rerun
- `src/features/.../review-design.worker` + scan worker —
  scoring pipeline
- `src/instrumentation.ts` — worker + watcher auto-start
- Detay → `docs/review/*`

## 5. Open issues / Deferred

→ `docs/claude/known-issues-and-deferred.md` (D: Frame export
Etsy V3 e2e ilişkili; review kendi modülü FROZEN, yeni açık item
eklenmez — değişiklik yalnız Madde Z 3-koşul). Settings Registry'ye
threshold/prompt taşıma uzun-vade (CLAUDE.md Madde R) — açık ama
freeze altında.

## 6. Archive / Historical pointer

Tarihsel detay (Phase 6 → IA-39+ review automation final close,
Phase 12-96 review-ilişkili turlar) → `docs/claude/archive/
phase-log-12-96.md` (NOT authoritative). Canonical review
sözleşmesi → `CLAUDE.md` Madde B/M/N/O/R/S/V/X + Madde Z (Freeze)
+ `docs/review/*`.
