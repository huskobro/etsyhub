# Kivasy — Post-MVP Backlog

> R11.12.1 baseline'ında (commit `73d719b`) consolidation. MVP omurgası
> tamamlandı (R1 → R11.12.1) ve release blocker yok. Bu doküman, farklı
> dokümanlara dağılmış post-MVP scope'unu tek source-of-truth altında
> topluyor.
>
> Hiçbir madde release-blocking değildir; UI'da "SOON" rozetler, "R12"
> hint'ler, "post-MVP enrichment" placeholder'lar ile operatöre dürüstçe
> etiketli.
>
> **Derived from:**
> - [`docs/MVP_ACCEPTANCE.md`](MVP_ACCEPTANCE.md) §4 (works but limited) + §5 (deferred)
> - [`docs/IMPLEMENTATION_HANDOFF.md`](IMPLEMENTATION_HANDOFF.md) §10 (Rollouts deferred to post-MVP) + §11 (out-of-scope)
> - [`docs/STAGING.md`](STAGING.md) §7 (post-staging deferred)
> - [`docs/PRODUCTION_SHAKEDOWN.md`](PRODUCTION_SHAKEDOWN.md) §7 (known limitations)
> - [`docs/design-system/kivasy/README.md`](design-system/kivasy/README.md) (implementation status)
> - Rollout commit notları (R11 → R11.12.1)
>
> Item formatı:
> - **Item** — kısa adı
> - **Why** — neden değerli
> - **Priority** — High / Medium / Low (operatör + kullanıcı görünürlüğü ekseninde)
> - **Size** — S (≤1 gün) / M (1-3 gün) / L (1+ hafta)
> - **Depends on** — varsa
> - **Not release-blocking because** — neden MVP'yi durdurmadı

---

## A. User-facing parity gaps

UI'da operatöre görünen ama tam Kivasy design parity'sinde olmayan
yüzeyler. Hepsi "SOON" / placeholder rozetli; release blocker değil.

### A1. Overview C3 4-block view
- **Why:** `/overview` sidebar entry; bugün placeholder ("post-MVP enrichment"). C3 design 4-block view (pipeline pulse / pending actions / active batches / recent activity) operatörün morning landing'i; sayfayı value'lu hale getirir.
- **Priority:** High (sidebar'ın ilk item'ı; bugün boş)
- **Size:** L
- **Depends on:** —
- **Not release-blocking because:** Sidebar'da "SOON" rozetli; operatör Library/Batches/Selections'a doğrudan atlar. Pipeline state Library + Batches + Products'tan zaten görülebiliyor.

### A2. References B1 single-surface consolidation
- **Why:** `/references` Türkçe legacy "Referans Havuzu" view; sub-view'lar (Pool / Stories / Inbox / Shops / Collections) `/bookmarks`, `/collections`, `/trend-stories`, `/competitors` ayrı route'larda. B1 design tek surface + sibling-tab pattern öneriyor.
- **Priority:** High (sidebar entry; dağınık deneyim)
- **Size:** L
- **Depends on:** —
- **Not release-blocking because:** Sub-view'lar her biri canlı ve fonksiyonel; sidebar'da "SOON" rozetli; deep-link ile erişilebilir.

### A3. Selection edit operations in-place modal
- **Why:** Selection detail Edits tab'ında her edit operation (bg-remove / color / crop / upscale / magic eraser) split modal yerine **legacy `/selection/sets/[id]` Selection Studio**'ya yönlendiriyor. R11.7 caption'da "edit operations open in a split modal" hint var ama gerçek modal post-MVP.
- **Priority:** Medium
- **Size:** L
- **Depends on:** Selection edit ops backend (zaten canlı)
- **Not release-blocking because:** Legacy bridge gerçek edit operations'ı çalıştırıyor (R11.9'da render PASS); brand cleanup R11.11'de yapıldı (Türkçe legacy copy "Selection Studio · Kivasy" title'lı).

### A4. Legacy Selection/Mockup Studio Türkçe legacy copy
- **Why:** `/selection/sets/[id]/mockup/apply` Türkçe legacy strings ("Quick Pack", "Hazır", "Render et", "Tahmini süre"). Brand title artık Kivasy ✓ ama içerik tasarımı eski. Yeni Apply Mockups split modal R12 scope.
- **Priority:** Medium (operatör mockup smoke'unda görüyor)
- **Size:** M
- **Depends on:** A3 (edit modal pattern reuse)
- **Not release-blocking because:** Brand title temizlendi (R11.11); render pipeline canlı ve fonksiyonel.

### A5. Settings GOVERNANCE group panes
- **Why:** Settings sidebar'da Users / Audit / Feature Flags / Theme — 4 deferred pane "SOON" rozetli, placeholder render. Legacy `/admin/users`, `/admin/audit-logs`, `/admin/feature-flags`, `/admin/theme` admin scope'ta canlı. Settings altına taşıma post-MVP.
- **Priority:** Low (admin'ler legacy admin shell üzerinden çalışıyor)
- **Size:** M (her biri ayrı pane composition)
- **Depends on:** —
- **Not release-blocking because:** Legacy `/admin/*` route'ları fonksiyonel; sidebar'da "SOON" rozetli.

### A6. Sidebar "Overview SOON / References SOON" rozet temizliği
- **Why:** A1+A2 yapılınca rozetler kalkar. Şu an dürüst sinyal veriyor.
- **Priority:** Low (mevcut dürüst hint)
- **Size:** S
- **Depends on:** A1 ve A2 done
- **Not release-blocking because:** Dürüstçe işaretli; operatör için doğru sinyal.

---

## B. Capability expansion

Mevcut altyapıyı ileri taşıyacak yeni özellikler. R12 rollout adayları.

### B1. SSE notifications channel
- **Why:** Inbox feed bugün 15s polling. Real-time için SSE channel `notifications:user:{id}` (PaneNotifications docblock'ta R12 referansı).
- **Priority:** Medium (15s polling production'da kabul edilebilir)
- **Size:** M
- **Depends on:** —
- **Not release-blocking because:** Polling backup; operatör 15s gecikme ile haberdar olur.

### B2. Recipe full-chain orchestration
- **Why:** Recipe runner bugün "Continue to Batch Run / Selections" CTA döndürüyor (R11). Otomatik chain (batch + selection + mockup pipeline tetikleme) ileri sürüm.
- **Priority:** Medium (operator-driven workflow yeterli)
- **Size:** L
- **Depends on:** Recipe modeli (canlı)
- **Not release-blocking because:** Operatör manuel "Continue" tıklıyor; pipeline her aşamada görünür.

### B3. Provider integration expansion (OpenAI / Fal.ai / Replicate / Recraft)
- **Why:** Settings → AI Providers'da 4 provider "KEY MISSING + ships in R12" hint'li. KIE + Gemini canlı; diğer 4 schema-ready ama wiring yok.
- **Priority:** Medium (KIE/Gemini variation + listing AI fill için yeterli)
- **Size:** L (her provider için ayrı integration + config schema)
- **Depends on:** —
- **Not release-blocking because:** KIE direct path tüm task type'larda fonksiyonel; UI'da "ships in R12" dürüst hint.

### B4. Mockup binding wizard UI
- **Why:** R11.9'da raster mockup template upload sırasında binding auto-create ekledim (default centered safe area). Custom binding (PSD smart-object placement coordinates, perspective transformation, recipe blend mode editor) için admin UI wizard post-MVP.
- **Priority:** Low (auto-binding raster için yeterli; PSD smart-object deep parse R12)
- **Size:** L
- **Depends on:** PSD smart-object parser (post-MVP)
- **Not release-blocking because:** R11.9 auto-create raster pipeline canlı; admin manual editor `/admin/mockup-templates/[id]` mevcut.

### B5. Variation worker model parameter migration
- **Why:** `resolveTaskModel` pre-flight çalışıyor ama worker call hâlâ `providerKey` üzerinden. Model granularity (örn. KIE içinde `midjourney-v7` vs `gpt-image-1`) provider registry geldiğinde tam wire.
- **Priority:** Low
- **Size:** M
- **Depends on:** Provider registry expansion (B3 çıktısı)
- **Not release-blocking because:** Mevcut KIE provider tek model çalıştırıyor; smoke'larda doğrulandı.

### B6. Desktop push + daily email digest delivery
- **Why:** Settings → Notifications'da 2 toggle disabled + "R12" rozetli. In-app inbox aktif; bu iki kanal delivery backend ile gelecek.
- **Priority:** Low (in-app inbox yeterli)
- **Size:** M
- **Depends on:** Email provider integration (yeni)
- **Not release-blocking because:** UI toggle dürüstçe disabled.

### B7. Trend Cluster Detection (semantic dedupe)
- **Why:** Trend Stories veri akışı canlı (`/trend-stories`). Embedding-based similarity ile aynı konuya benzer yeni listing'leri otomatik clusterlama (CLAUDE.md "trend grubu sinyali") post-MVP.
- **Priority:** Low (operator hard dedupe çalışıyor)
- **Size:** L
- **Depends on:** Embedding service + similarity index
- **Not release-blocking because:** Hard dedupe (URL/asset hash) canlı; semantic dedupe gelişmiş özellik.

### B8. Preview-first major-decision wizard
- **Why:** CLAUDE.md preview-first roadmap (style cards, mock frames, subtitle samples, lower-third samples, thumbnail samples). Style preset cards + mockup template grid mevcut; subtitle/lower-third/draft preview seviyesi yok.
- **Priority:** Low (mevcut decision UI yeterli)
- **Size:** L
- **Depends on:** Per-product preview compositor
- **Not release-blocking because:** Var olan style/mockup grid'i operatöre yeterli sinyal veriyor.

---

## C. Architecture / infra / platform

Geliştirme + ops platformu seviyesinde post-MVP iş.

### C1. Native shell (Tauri macOS / Windows)
- **Why:** CLAUDE.md "ileride Tauri wrapper" hedefi. App shell pattern (sidebar + main + persistent floating Active Tasks panel) Tauri'ye uygun bırakıldı; native build post-MVP.
- **Priority:** Medium (kullanıcı için web yeterli; native app ürün talebi gelirse)
- **Size:** L
- **Depends on:** Tauri shell config + Local file API'lerin abstraction'a alınması
- **Not release-blocking because:** Web app primary deployment; CLAUDE.md tasarımı Tauri-feasible.

### C2. Watch folder feature
- **Why:** CLAUDE.md "kullanıcı bir klasöre görsel attığında sistem otomatik içeri alabilir". Tauri `notify` plugin ile native; web için File System Access API.
- **Priority:** Low
- **Size:** M
- **Depends on:** C1 (native) veya File System Access API browser support
- **Not release-blocking because:** URL/upload yolu canlı; watch folder ek konfor.

### C3. BullMQ Board / queue management UI
- **Why:** PRODUCTION_SHAKEDOWN §4.2'de "BullMQ Board UI yok (post-MVP). CLI yöntem" notu. Stuck job re-enqueue UI ile yapılabilirse admin debug ergonomi artar.
- **Priority:** Medium
- **Size:** M
- **Depends on:** —
- **Not release-blocking because:** Active Tasks panel + admin `/admin/jobs` görünürlük yeterli; CLI rollback yolu var.

### C4. Multi-worker / horizontal scaling
- **Why:** Şu an 1 worker process; production'da concurrent job sayısı artarsa multi-worker (BullMQ concurrency knob'lar mevcut ama scale-out test edilmedi).
- **Priority:** Low (single worker MVP ölçeğinde yeterli)
- **Size:** M
- **Depends on:** Production load profile
- **Not release-blocking because:** STAGING.md staging için 1 worker, single-process yeterli.

### C5. Backup/restore drill + observability refinement
- **Why:** PRODUCTION_SHAKEDOWN §4.1-4.4 backup pattern + observability ekran tablosu var. Production'da otomatik snapshot cron + log aggregation (örn. Grafana/Loki) post-MVP polish.
- **Priority:** Medium (production deploy sonrası lazım)
- **Size:** M
- **Depends on:** Production infrastructure provisioned
- **Not release-blocking because:** Manuel `pg_dump` + `journalctl` yolu PRODUCTION_SHAKEDOWN'da yazılı.

### C6. Cost dashboard expansion
- **Why:** Settings → AI Providers'da 4-stat row (daily / monthly / active / failed24h) canlı. Provider × task × time-range cost dashboard genişlemesi (Phase 9 dashboard scope) post-MVP.
- **Priority:** Low
- **Size:** M
- **Depends on:** B3 (multi-provider için)
- **Not release-blocking because:** Mevcut 4-stat row operatöre günlük/aylık spend görünümü veriyor.

---

## D. Tech debt / cleanup

Kod tabanı bakım işleri. Hiçbiri kullanıcı görünür değil; future contributor onay alana kadar dokunulmaması gerekenler R11.10 audit'te işaretli.

### D1. `variantKindHelper` relocation
- **Why:** `src/app/(admin)/admin/midjourney/library/variantKindHelper.ts` yeni Library yüzeyi (`LibraryAssetCard.tsx`, `LibraryDetailPanel.tsx`) tarafından import ediliyor. Yeri yanlış (admin debug klasörü); doğru yer `src/features/library/utils/`. R11.10 audit'te belirlendi.
- **Priority:** Medium (organizasyonel borç; legacy admin/midjourney klasörünü silmeyi engelleyen blocker)
- **Size:** S
- **Depends on:** —
- **Not release-blocking because:** Mevcut import çalışıyor; sadece kod yeri yanlış.

### D2. Legacy `/dashboard` page kod silme
- **Why:** `src/app/(app)/dashboard/page.tsx` middleware redirect 308 ile gizli; T-31 dashboard kodu hâlâ disk'te (~230 satır). Silmek güvenli; backwards-compat redirect rejimi yedek.
- **Priority:** Low
- **Size:** S
- **Depends on:** A1 (Overview C3 implementation — bazı parça reference olarak kullanılabilir)
- **Not release-blocking because:** Redirect ile gizli; kullanıcı görmez.

### D3. Legacy `/listings` + `/listings/draft/[id]` page kod silme
- **Why:** Middleware 308 redirect ile gizli; `features/listings/components/ListingsIndexView` ve `ui/ListingDraftView` view-only dosyaları silmemek için backwards-compat fallback değeri var.
- **Priority:** Low
- **Size:** S
- **Depends on:** —
- **Not release-blocking because:** Redirect rejimi backwards-compat sağlar; `features/listings/` shared module yeni Products surface'ı için canlı.

### D4. Admin/midjourney IA cleanup
- **Why:** `/admin/midjourney` ControlCenter eski MJ-first IA. Kivasy ile uyumlu yeni admin shell'e taşıma post-MVP.
- **Priority:** Low
- **Size:** L
- **Depends on:** D1 (variantKindHelper relocation önce)
- **Not release-blocking because:** Admin scope; sidebar'dan görünmez; admin debug için canlı.

### D5. `package.json` `engines` field
- **Why:** Node 20+ pinning explicit. Şu an STAGING.md doc-level söylüyor; package.json metadata'sında yok.
- **Priority:** Low
- **Size:** S
- **Depends on:** —
- **Not release-blocking because:** Orchestration tarafı (Docker / systemd) zaten Node sürüm kontrolü yapıyor.

### D6. Legacy listing view file cleanup
- **Why:** `src/features/listings/components/ListingsIndexView.tsx` ve `ui/ListingDraftView.tsx` redirect arkasında; yeni Products UI bunları kullanmıyor. Refactor sırasında silinebilir.
- **Priority:** Low
- **Size:** S
- **Depends on:** D3
- **Not release-blocking because:** Sadece import edilmeyen view component'leri; çalışan kodu etkilemiyor.

### D7. Test suite Redis-dep failures
- **Why:** `npm run test` 11 fail (selection-export integration testleri Redis bağlı, env eksikliğinden). R11 baseline ile aynı; %99.4 pass.
- **Priority:** Low
- **Size:** M (test environment + CI Redis instance)
- **Depends on:** CI/CD pipeline kurulumu
- **Not release-blocking because:** Smoke + production build PASS; failures environment eksikliğinden, kod hatasından değil.

### D8. JSDoc "EtsyHub" reference cleanup
- **Why:** `src/components/ui/*.tsx` JSDoc comment'larında "EtsyHub" referansları (Card / Toolbar / FilterBar / PageShell / Chip / Sidebar / Toast). Code documentation; kullanıcı görmez. R11.11'de bilinçli olarak dokunulmadı.
- **Priority:** Low
- **Size:** S (sed find/replace)
- **Depends on:** —
- **Not release-blocking because:** Kullanıcı görmez; sadece development docs.

---

## En yüksek öncelikli 5 madde (önerilen R12 sequencing)

| # | Item | Group | Size | Sebep |
|---|---|---|---|---|
| 1 | **A1 Overview C3** | parity | L | Sidebar'ın ilk item'ı bugün boş; en görünür gap |
| 2 | **A2 References B1 consolidation** | parity | L | Sidebar entry; sub-view'lar dağınık |
| 3 | **B3 Provider integration (OpenAI/Fal/Replicate/Recraft)** | capability | L | UI'da "ships in R12" dürüst hint, beklenti yarattı |
| 4 | **B1 SSE notifications** | capability | M | 15s polling production'da OK ama gerçek-zamanlı UX iyileşmesi |
| 5 | **D1 variantKindHelper relocation** | tech debt | S | Hızlı win + admin/midjourney cleanup'ı açar (D2-D4 dominoları) |

Toplam tahmini: ~3-4 hafta development (paralel çalışılırsa).

---

## Sequencing notları

- **A1 + A2 paralel olabilir** (farklı feature klasörleri)
- **B3 provider integrations**: 4 provider için sequential (OpenAI → Fal → Replicate → Recraft); her biri ~1 hafta
- **D1 relocation önce, D2-D4 sonra** (admin/midjourney klasörü cleanup adayı)
- **C5 backup/observability** production deployment sonrası (gerçek load profile gelince)
- **C1 Tauri** ürün talebi geldiğinde; web app primary deployment

---

_Bu doküman R11.12.1 baseline'ında üretildi. Item'lar tamamlandıkça
işaretlenir veya yeni rollout commit'lerine bağlanır. Yeni post-MVP
item bulunursa (production deploy sırasında / staging smoke'da)
ilgili gruba eklenir._
