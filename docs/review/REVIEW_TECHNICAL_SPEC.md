# Review — Technical Spec

Bu döküman Kivasy review modülünün **mevcut** veri modelini ve
pipeline'larını anlatır. Branch HEAD'i `87942ba` (IA-35) referans
alınarak yazılmıştır. Açık / yarım kalmış yerler ayrı bir bölümde
listelenir.

> Tüm sözleşmeler CLAUDE.md Madde V / V' / V'' / X+ / X++ ile
> tutarlıdır. Çelişen herhangi bir nokta görürsen CLAUDE.md kaynaktır.

---

## 1. Veri modeli — operator truth vs AI suggestion

Review iki bağımsız sinyal katmanı taşır. Schema açısından her ikisi
de aynı `GeneratedDesign` veya `LocalLibraryAsset` row'unda yaşar.
İki katman birbirinden bağımsız alanlarda durur ve mevcut kod
tarafında bunları yazan path'ler birbirine dokunmayacak şekilde
tasarlanmıştır:

### Operator truth (canonical)

| Alan | Tip | Anlamı |
|---|---|---|
| `reviewStatus` | enum `PENDING` / `APPROVED` / `REJECTED` / `NEEDS_REVIEW` | Operatörün damgası. Default `PENDING`; operatör Keep/Discard yazdığında `APPROVED` / `REJECTED` olur. |
| `reviewStatusSource` | enum `SYSTEM` / `USER` | Damganın kaynağı. `USER` → operatör explicit aksiyonu. `SYSTEM` → worker veya legacy seed yazdı. Default `SYSTEM`. |
| `reviewedAt` | DateTime? | Operator veya worker'ın son güncelleme zamanı. |

**Operatör kararı sözleşmesi:**

```
kept     = reviewStatus = APPROVED AND reviewStatusSource = USER
rejected = reviewStatus = REJECTED AND reviewStatusSource = USER
undecided = reviewStatusSource != USER (PENDING + legacy SYSTEM-source APPROVED/NEEDS_REVIEW/REJECTED hepsi)
```

> `NEEDS_REVIEW` artık **operator axis'te yok** — advisory katmanda
> kalır. Eski pipeline döneminde worker bunu yazıyordu; UI bunları
> "operatör henüz karar vermedi" semantiğiyle undecided sayar.

### AI suggestion (advisory)

| Alan | Tip | Anlamı |
|---|---|---|
| `reviewSuggestedStatus` | enum? `APPROVED` / `NEEDS_REVIEW` / `REJECTED` | AI'nın tavsiye ettiği outcome. Operatörü bağlamaz. Default null (AI henüz değerlendirmedi). |
| `reviewScore` | Int? | Sistem (deterministic) skor. **UI ana score** budur. 0..100. |
| `reviewProviderRawScore` | Int? | Provider'ın döndürdüğü ham skor. **Audit/debug için**; UI ana skoru göstermez. |
| `reviewSummary` | String? | Provider'ın TR özet metni. |
| `reviewRiskFlags` | Json? | `Array<{ kind, severity, reason, confidence }>`. |
| `reviewProviderSnapshot` | String? | Provider id + prompt versiyonu. |

**Mevcut kontrat** (CLAUDE.md Madde V, kod tarafında karşılığı
`src/server/workers/review-design.worker.ts` ve
`src/app/api/review/decisions/route.ts`):
- Review worker `reviewStatus` ve `reviewStatusSource` alanlarına
  yazmaz; yalnız AI advisory alanlarına (`reviewSuggestedStatus`,
  `reviewScore`, `reviewSummary`, `reviewRiskFlags`,
  `reviewProviderSnapshot`, `reviewProviderRawScore`) dokunur.
- Operator decision endpoint'i yalnız `reviewStatus +
  reviewStatusSource + reviewedAt` üçlüsünü güncelleyecek şekilde
  yazılmıştır; AI advisory alanlarına dokunmaz.
- Bu ayrım runtime'da enforced bir constraint değildir (DB
  trigger / check constraint yok); ürün anayasası seviyesinde
  korunur ve PR review'da gözetilir.

---

## 2. Score modeli — deterministic, severity-agnostic, weight-only, applicability-aware (IA-38b)

Provider raw fluctuation skoru **etkilemez**. Sistem skoru kriterler
ve risk flag kinds üzerinden hesaplanır:

```
finalScore = clamp(0, 100, 100 − Σ weight(failed applicable criteria))
```

**Applicability-aware**: Detail panel'da "Not applicable" diye N/A
gösterilen kriterler score'a **düşmez** (IA-38b). Lazy recompute path'i
queue endpoint'inde her item için `composeContext` (productType +
format + hasAlpha + sourceKind) kurar; `isCriterionApplicable` ile
N/A kriterler atlanır. Sonuç: **kullanıcıya görünen failed applicable
checks = score deductions** birebir eşit.

**Duplicate risk flags**: Provider snapshot aynı kind'ı iki kez
yazmış olabilir; `failedSet = new Set(riskFlagKinds)` ile unique'leştirilir.
Aynı kind iki kez bayrak alsa bile weight tek kez sayılır.

**Severity (blocker / warning) score'u etkilemez.** Severity yalnız:
- UI risk indicator tone seçimi (`Critical risk` vs `1 warning`)
- AI suggestion outcome (advisory NEEDS_REVIEW için blocker tetikleyici)

için kullanılır — **score üzerinde direkt etki yoktur**. Eski
"blockerForce = 100 hidden zero" davranışı IA-38'de **kaldırıldı**
(kullanıcı kararı: gizli auto-zero ürün sözleşmesini ihlal ediyordu).

Bir kriterin score'u 0'a çekmesi isteniyorsa: admin paneline gidip
o kriterin `weight`'ini 100'e set et. Davranış görünür ve düzenlenebilir.

Aynı failed flags → aynı score. Provider birinde 95, ötekinde 105
verirse bile ikisi de aynı kriterleri tetiklediyse aynı `finalScore`'u
alır (eski döneme ait 85/75 gibi sapmalar IA-31'de bu yolla
düzeldi).

Eski snapshot'lar (worker pre-IA-31 algoritmasında yazılmış)
`Queue endpoint /api/review/queue`'da **lazy recompute** ile yeniden
hesaplanır:

- Persist yok — sadece response projection (CLAUDE.md Madde S).
- `recomputeStoredScore(storedScore, riskFlags, criteria)` helper'ı
  bugünkü criteria + risk flag kinds matematiğiyle yeniden çalışır.
- Operatör 85/75 yerine bugünkü 80/80 görür; provider çağrılmaz.

Score tone (UI):
- threshold-aware, 5 kademe (`critical` / `poor` / `warning` /
  `caution` / `success` / `neutral`).
- default `low=60, high=90` (`DEFAULT_REVIEW_THRESHOLDS` in
  `src/server/services/review/decision.ts`).
- thresholds Settings → Review'dan admin tarafından override
  edilebilir (`UserSetting key="review"`).

Risk indicator score chip rengini **EZMEZ**. Ayrı badge
(`getRiskTone`): blocker → critical, warning_count > 0 → warning,
yoksa hidden.

---

## 3. Scoring lifecycle

Asset'in scoring durumu beş resmi state taşır. Server-side
`resolveReviewLifecycle` (`src/server/services/review/lifecycle.ts`)
ile her queue request'inde resolve edilir:

| State | Tetik | Resolution |
|---|---|---|
| `not_queued` | Asset için hiç REVIEW_DESIGN job'u açılmamış. | Job tablosunda asset id'sine bağlı pending/active record yok. |
| `queued` | Job kuyrukta, worker henüz almadı. | `db.job` row'unda `status: PENDING` veya `QUEUED`. |
| `running` | Worker active job çalıştırıyor. | `db.job` row'unda `status: RUNNING`. |
| `ready` | Snapshot dolu (`reviewedAt + reviewProviderSnapshot`). | Operator için "AI değerlendirmesi hazır". |
| `failed` | Provider/parse error. | `db.job` row'unda `status: FAILED`. |

`na` (UI side) — Reserved future use; backend henüz üretmiyor.

> UI evaluation katmanı (`EvaluationLifecycle` in
> `src/features/review/lib/evaluation.ts`) backend lifecycle'i
> doğrudan alır + legacy alias'ları (`pending` → `not_queued`,
> `scoring` → `running`, `error` → `failed`) maintain eder.

---

## 4. Pipeline akışları

### a) MJ promote → review

Midjourney batch tarafında `MidjourneyAsset.reviewDecision`
(KEPT/REJECTED/UNDECIDED) ayrı bir taksonomi taşır. Promote akışında
asset `GeneratedDesign` olarak duplicate edilir; review akışı buradan
itibaren standart GeneratedDesign pipeline'ı izler.

### b) Variation üretim → auto-enqueue review

```
references/[id]/variations
  → POST /api/variation-jobs
    → Job(GENERATE_VARIATIONS) BullMQ
      → variation worker → GeneratedDesign rows
        → enqueueReviewDesign({ designId, productTypeKey })
          → Job(REVIEW_DESIGN) BullMQ
            → review-design.worker
              → provider call → snapshot persist
              → reviewSuggestedStatus + reviewScore + risk flags
```

### c) Local scan → auto-enqueue review (mapping varsa)

```
Settings → Local Library → Scan
  → POST /api/local-library/scan
    → Job(SCAN_LOCAL_FOLDER) BullMQ
      → scan-local-folder.worker
        → discoverFolders + listAssetFiles
        → upsert LocalLibraryAsset row + ensureThumbnail
        → resolveLocalFolder({ folderName, folderPath, folderMap })
          - mapped (alias/convention) → enqueueReviewDesign
          - pending → skip (operatör mapping atayacak)
          - ignored → skip
```

> "Already-scored guard": asset'in snapshot'ı doluysa worker erken
> skip yapar; çift-billing yok (CLAUDE.md Madde N).

### d) Manual scope-trigger

Operatör focus mode'da "Enqueue review for this scope" CTA'sı veya
admin Settings → Review → ops dashboard'undan tetikler:

```
POST /api/review/scope-trigger
  body: { scope: "folder" | "reference", folderName?/referenceId?, productTypeKey? }
  → candidate listesi (PENDING + snapshot null)
  → productTypeKey resolve (body override → folder map → convention)
  → her candidate için enqueueReviewDesign
```

### e) Operator decision

```
POST /api/review/decisions
  body: { scope: "design" | "local", id, decision: APPROVED | REJECTED }
  → reviewStatus + reviewStatusSource = USER yazılır
  → reviewedAt güncellenir
  → AI snapshot DOKUNULMAZ
  → DesignReview audit row eklenir (design scope için)
```

### f) Operator reset / rerun (PATCH)

```
PATCH /api/review/decisions
  body: { scope, id, rerun?: boolean, productTypeKey?: string }
  → rerun=false (default): status PENDING, source SYSTEM
    → AI snapshot KORUNUR (referans)
  → rerun=true:
    → snapshot temizlenir
    → enqueueReviewDesign (yeni job)
    → bir provider çağrısı; cost-billed
```

---

### Automation truth — mevcut otomasyon davranışı

Üretim hattında **otomatik** AI scoring tetikleme noktaları:

| Source | Otomatik tetik | Kural | Tetiklenmeme nedeni |
|---|---|---|---|
| AI Designs (variation) | Variation worker design oluşturduğu anda | `enqueueReviewDesign` her yeni design için | Worker fail (audit log'da görünür) |
| AI Designs (MJ promote) | `promoteMidjourneyAssetToGeneratedDesign` sonunda | Best-effort enqueue | Enqueue exception (logged, promote commit olur) |
| Local Library | Scan worker keşfedilen yeni asset için (`reviewProviderSnapshot: null` filter'ı) | Folder mapping resolved olmalı (path-based > legacy folderName > convention) | Mapping pending / ignored / scan tetiklenmemiş |

**Local scan tetikleme**: Scan job operatör tarafından `Settings →
Local Library → Scan` veya admin script ile başlatılır. **Düzenli
otomatik schedule eklenmedi**; bu future work — bir cron veya
file-watcher (Tauri `notify` plugin'i) ileride değerlendirilebilir
(CLAUDE.md "Local File Watch Folder" maddesi).

**Mapping sonradan eklenen klasörler**: Operatör yeni folder
mapping atadığında, o klasördeki **mevcut** asset'ler otomatik
score'lanmaz (auto-enqueue zaten "yeni keşfedildi" filter'ında).
Mevcut dosyalar için focus mode `scopeTrigger` CTA'sı veya admin
ops dashboard manuel scope-trigger kullanılır.

**Operatör görünürlüğü**:
- Kart'taki minus icon `not_queued` lifecycle title'ında neden
  açıklanır.
- Focus mode info-rail evaluation empty copy'sinde detaylı
  açıklama + scope-trigger CTA.
- Settings → Review ops dashboard'unda queued/running/failed
  sayaçları + last enqueue/scan timestamps.

---

## 5. `enqueueReviewDesign` helper — single source of truth

`src/features/review/server/enqueue-review.ts` (veya benzer yol):

- DB'ye `db.job` row'unu yazar (status PENDING/QUEUED).
- BullMQ queue'ya job ekler.
- İki adım **atomik** — UI lifecycle (queued/running/ready) gerçek
  backend durumuyla uyuşur.
- Already-scored guard: aynı asset için snapshot doluysa job
  açılmaz (cost discipline).

---

## 6. Queue endpoint payload — sözleşme

```
GET /api/review/queue
  query:
    scope         "design" | "local"        (zorunlu)
    status        ReviewStatus                (optional decision filter)
    decision      undecided | kept | rejected (UI helper, status'e map)
    page          int >= 1, default 1
    q             search (max 120)
    folder        scope identity ZOOM (local-only)
    reference     scope identity ZOOM (design-only)
    batch         scope identity ZOOM (design-only, IA-34)
```

Response (her item için):

```ts
{
  id, thumbnailUrl, fullResolutionUrl,
  reviewStatus, reviewStatusSource,
  reviewScore,                     // lazy recompute uygulanmış
  reviewProviderRawScore,          // audit
  reviewSummary, riskFlagCount, riskFlags,
  reviewedAt, reviewProviderSnapshot,
  reviewSuggestedStatus,           // AI advisory
  referenceId, productTypeId, jobId,
  reviewLifecycle,
  source: {
    kind: "design" | "local-library",
    productTypeKey,                // IA-35: design + local her ikisi
    referenceShortId,
    batchId, batchShortId,         // IA-34: design only
    folderName, fileName, folderPath,
    mimeType, fileSize, width, height, dpi, hasAlpha,
    qualityScore, qualityReasons,  // local-only
  },
}
```

Response top-level:

```ts
{
  items: Item[],
  total: number,
  page: number,
  pageSize: 24,
  scope: {
    kind: "batch" | "reference" | "folder" | "queue",
    label?: string,
    total, cardinality,
    breakdown: { undecided, kept, discarded },
  },
  policy: { thresholds: { low, high } },  // CLAUDE.md Madde R
}
```

**Scope priority (IA-34)**: `batch > reference > queue` (design),
`folder > queue` (local). Caller (page loader) item'ın
`Job.metadata.batchId`'sini resolve edip default scope kararına
batch dominansını uygular; reference param'ını yalnız batch yoksa
veya `?scope=reference` explicit'se geçer.

---

## 7. Folder/path mapping — local productType resolution

`src/features/settings/local-library/folder-mapping.ts`:

```ts
type FolderProductTypeMap = Record<string, string>;
// Anahtar canonical: LocalLibraryAsset.folderPath (IA-35).
// Legacy: folderName-keyed entries fallback olarak okunmaya devam eder.

resolveLocalFolder({ folderName, folderPath?, folderMap })
  → { kind: "mapped", productTypeKey, reason: "alias" | "convention" }
  | { kind: "ignored" }
  | { kind: "pending", folderName }
```

Resolution sırası:

1. **Path-based alias** — `folderMap[folderPath]`. Aynı isimli farklı
   path'teki klasörler çarpışmaz.
2. **Legacy folderName alias** — `folderMap[folderName]`. Eski user
   settings için geriye uyumluluk.
3. **Convention** — folderName normalize edilmiş hali bilinen bir
   PT key'i ise (`wall_art`, `clipart`, `sticker`, `transparent_png`,
   `bookmark`, `printable`).
4. **Pending** — operatöre Settings → Review → Local library'de
   mapping atama mesajı.

`IGNORE_FOLDER_SENTINEL = "__ignore__"` — operatör folder'ı atlamak
isterse mapping'e bunu yazar; resolver `kind: "ignored"` döner ve
scan worker auto-enqueue yapmaz.

Aktif root filter (CLAUDE.md Madde V):
- `getActiveLocalRootFilter(userId)` → Prisma `where` fragment'i
  (`folderPath: { startsWith: rootFolderPath }`).
- Tüm local review query'leri (queue, picker, scope-trigger,
  decisions, scan worker, total pending) bu filter ile sınırlı.
- Operatör root değiştirince eski path'teki asset'ler **gizlenir**
  (silinmez).

---

## 8. Live refresh — polling + invalidate

UI client-side polling (`useReviewQueue` in
`src/features/review/queries.ts`):

```ts
refetchInterval = unsettledCount > 0 ? 5000 : false;
unsettled = items.filter(it => it.reviewLifecycle === 'queued' || 'running')
```

> IA-35 düzeltmesi: `not_queued` eskiden unsettled sayılıyordu;
> idle scope'larda polling yakıyordu. Yeni: yalnız gerçek in-flight
> iş için 5s; idle'da polling false.

`refetchOnWindowFocus: true` — tab geri görününce manuel refetch.
`refetchIntervalInBackground: false` — sekme gizliyken polling yok.

**Mutation-driven invalidation**:
- Operator decision POST/PATCH sonrası caller
  `queryClient.invalidateQueries(reviewQueueQueryKey)` çağırır.
- Rerun sonrası `queued` state pencere kısa polling açar; lifecycle
  `ready`'ye varınca polling kendiliğinden durur.

Library / Settings gibi server-rendered surface'ler ayrı pattern:
- Library: 8s `router.refresh()` interval (tab visibility-aware).
- Settings → Local library mapping: scan tetiklendikten 3s sonra
  mapping list query invalidate.

---

## 9. Scope priority sözleşmesi (IA-34)

Default deep-link scope karar ağacı:

```
focusScope = "local"  → folder (folderName) > source all
focusScope = "design" →
    batchId resolved AND !referenceForcedExplicit  → batch
    else if reference                              → reference
    else                                           → source all (queue)
```

- Aynı reference farklı batch'lerde farklı variation üretebilir;
  operatör çoğu zaman "şu batch'i temizliyorum" mantığıyla çalışır.
- `?scope=reference` explicit override.
- Picker kind aynı sıralamayı izler: `batch` → `folder` → `reference`.
- Queue endpoint `batch` + `reference` ikisi de gelirse **batch
  baskındır** (route guard).
- Grid kart source label: design `batchShortId > referenceShortId`;
  local `folderName + fileName` (folder zaten doğal scope).

**Bu sözleşmenin gerekçesi**: aynı reference iki ayrı job'ta
çalıştırılırsa item'lar iki ayrı output set'i oluşturur — operatör
biri için "kept" derken diğeri için "reject" diyebilir. Reference
scope tek başına bu ayrımı yapamaz; batch yapar.

### 9.1. Batch lineage data path (IA-37)

`createVariationJobs` (`src/features/variation-generation/services/
ai-generation.service.ts`) bir çağrıdan oluşan **N variation job**'a
aynı `batchId`'yi paylaştırır:

- `cuid2.createId()` ile generate edilir.
- Her job'un `metadata.batchId` alanına yazılır (designId +
  referenceId ile birlikte).
- Queue endpoint bu metadata'yı `db.job.findMany({ id: { in: ... } })`
  ile resolve eder; her design item'a `source.batchId` +
  `source.batchShortId` projecte edilir.
- UI bu alanları "primary lineage" olarak kullanır; reference
  fallback yalnız batch yoksa görünür.

**Eski jobs**: IA-37 öncesinde oluşturulmuş variation job'lar
`metadata.batchId` taşımıyor (schema-zero pattern, default null
geçer). UI bu durumda zarif şekilde `referenceShortId` fallback'ine
düşer. Migration yapmıyoruz; yeni üretim ile birlikte batch
lineage otomatik dolacak (Known limitation, docs README'de).

> **Schema-zero pattern**: `Job.metadata` bir JSON alanı; batchId
> dahil olmak üzere lineage anahtarları burada string olarak
> taşınır. `WorkflowRun` canonical lineage tablosu gelecek faza
> alındı (CLAUDE.md Madde G).

---

### 9.2. Risk count & failed checks — tek kaynak (IA-37)

Kart ve detail panel **aynı sayıyı** göstermeli. Eski davranışta:

- Kart `item.riskFlagCount` → DB `reviewRiskFlags` array length.
- Detail panel `EvaluationPanel` → `composeContext` sonrası
  applicable + failed check sayımı.

Bu iki sayı farklı senaryolarda farklı çıkıyordu:

- Provider snapshot'a duplicate flag yazmış olabilir (örn. iki
  kez `no_alpha_channel`). DB count = 4, detail = 2.
- "Not applicable for JPEG" gibi N/A check'ler DB array length'e
  girer ama detail'de neutral state olarak sayılmaz.

**IA-37 düzeltmesi**: kart artık `buildEvaluation` çıktısından
beslenir — aynı `composeContext` + applicability rules + criteria
katalogundan geçer. `evaluation.checks.filter(state === "failed").
length` ve `severity === "blocker"` kontrolü kart ve detail
panelde **aynı sayıyı** üretir.

> `item.riskFlagCount` payload alanı sözleşme olarak kalır
> (geriye uyumluluk), ama UI kart artık bu ham sayıyı görsel
> sinyal için doğrudan kullanmaz.

---

## 10. UI <-> server tek doğruluk kaynağı helper'ları

`src/features/review/lib/operator-decision.ts`:

```ts
getOperatorDecision({ reviewStatus, reviewStatusSource })
  → "KEPT" | "REJECTED" | "UNDECIDED"
operatorDecisionLabel(d) → "Kept" / "Rejected" / "Undecided"

getAiScoreTone({ score, thresholds })
  → "critical" | "poor" | "warning" | "caution" | "success" | "neutral"
getAiScoreDistanceLabel({ score, thresholds })
  → "passes threshold" / "near pass" / "near review threshold" / "far below"

getRiskTone({ count, hasBlocker })
  → "critical" | "warning" | "none"
riskIndicatorLabel({ count, hasBlocker })
  → "Critical risk" / "1 warning" / "N risks" / null
```

Kart, focus mode, filmstrip, breakdown sayıları, bulk action sayıları
hepsi bu helper'lardan beslenir.

---

## 11. Test kapsamı

`vitest.workspace.ts` (IA-35) iki project tanımlar:

- **node**: `tests/**/*.test.ts`, node env, `tests/setup-integration.ts`.
- **ui**: `tests/unit/**/*.test.tsx`, jsdom env, `tests/setup-ui.ts`.

Tek `npm test` her ikisini paralel koşar.

Targeted review test suite'leri:

| Dosya | Kapsam |
|---|---|
| `tests/unit/operator-decision-tone.test.ts` | Helper score tone + risk indicator (35 test) |
| `tests/unit/queue-scope-count.test.ts` | Count invariant (6 test) |
| `tests/unit/source-pending-count.test.ts` | Source-specific pending (6 test) |
| `tests/unit/folder-mapping-path-key.test.ts` | Path-based mapping (8 test) |
| `tests/unit/review-decision.test.ts` | Decision engine (9 test) |
| `tests/unit/review-card.test.tsx` | ReviewCard UI (14 test) |
| `tests/unit/review-card-scope-label.test.tsx` | Card scope label (5 test) |
| `tests/unit/review-queue-list.test.tsx` | Queue list UI (5 test) |
| `tests/integration/api-local-library-asset.test.ts` | Asset endpoint (8 test) |

Toplam targeted: **96 test passing**.

---

## 12. Açık / yarım kalmış noktalar

- **Batch scope adjacent nav** — `getAdjacentPendingBatchIds` helper'ı
  yok; batch dominant moddayken `,` / `.` (prev/next scope) shortcut'ı
  scopeNav null'a düşer. Operatör picker dropdown'u kullanır.
- **`Job.metadata.batchId` schema-zero pattern** — `WorkflowRun`
  tablosu canonical lineage identity olarak gelecek faza alındı
  (CLAUDE.md Madde G).
- **Pre-existing test borçları** — 141 fail (workspace combined run);
  hepsi review modülü dışı (bookmarks, competitors, references,
  collections, trend-*, selection bulk-*) Phase 3/4 dönem suite
  borcu. IA-30+ regression değil.
- **`na` lifecycle state** — UI'da render edilebilir ama backend
  henüz üretmiyor; gelecek kullanım için ayrılmış.
- **Settings → Review threshold UI** — admin override input var ama
  "Revert to defaults" + change history (audit) ileride genişletilebilir.

---

## İlgili dokümanlar

- [Review User Guide](REVIEW_USER_GUIDE.md)
- [Review Troubleshooting Guide](REVIEW_TROUBLESHOOTING.md)
- [CLAUDE.md](../../CLAUDE.md) — ürün anayasası
