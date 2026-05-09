# Kivasy — MVP Final Acceptance

> **Status:** R11.5 stabilization pass kabul edildi (2026-05-09).
> Production build PASSING; %99.4 test pass; canlı runtime sorunu yok.
> MVP Final Acceptance gate **AÇIK** — operatör onayı bekliyor.
>
> Bu doküman, R1'den R11.5'e kadar tamamlanan iş, MVP-ready akışlar,
> bilinçli olarak post-MVP'ye bırakılan parçalar ve release readiness
> özeti için **tek source of truth**'tur.
>
> Source of truth ağacı:
> - **MVP acceptance (bu dosya)** — operatör release kararı için
> - [`docs/POST_MVP_BACKLOG.md`](POST_MVP_BACKLOG.md) — post-MVP scope
>   (parity gaps + capability expansion + architecture + tech debt) tek doc'ta
> - [`docs/PRODUCTION_SHAKEDOWN.md`](PRODUCTION_SHAKEDOWN.md) — release
>   günü operasyonel checklist (env, worker, backup, smoke, rollback)
> - [`README.md`](../README.md) — repo girişi
> - [`CLAUDE.md`](../CLAUDE.md) — proje kuralları, marka, scope
> - [`docs/IMPLEMENTATION_HANDOFF.md`](IMPLEMENTATION_HANDOFF.md) —
>   design→implementation süreci ve invariant'lar
> - [`docs/DESIGN_PARITY_CHECKPOINT.md`](DESIGN_PARITY_CHECKPOINT.md) —
>   her rollout sonu uygulanan parity rule'ları
> - [`docs/design-system/kivasy/`](design-system/kivasy/) — design system
>   tek doğruluk kaynağı (v4-v7 UI kits, tokens, primitives)

---

## 1. Genel hüküm

Kivasy MVP omurgası **çalışıyor**. Reference → Batch → Library →
Selection → Product → Etsy Draft zinciri uçtan uca yaşıyor; admin
governance, settings persistence, AI provider enforcement, in-app
notifications inbox, recipe runner, mockup upload + activation hatları
canlı.

**Bilinçli olarak post-MVP'ye bırakılan kısımlar dürüstçe etiketli
durumda** (UI'da R12 / "Soon" / "post-MVP" rozetleri); operatör hangi
yüzeyin canlı, hangi yüzeyin ileride geleceği konusunda yanlış sinyal
almaz.

---

## 2. Tamamlanan rollout'lar (R1 → R11.5)

| Rollout | Commit | Kapsam | Status |
|---|---|---|---|
| **R1+R2+R3+R3.5** | `23708bb` | Kivasy shell · Library · Batches · Review · A6 modal · parity cleanup | ✓ Kabul |
| **R4** | `87a9737` | Selections family — B2 index + B3 detail + Library handoff | ✓ Kabul |
| **R5** | `2211c05` | Products family — B4 index + A5 detail + listing builder | ✓ Kabul |
| **R5.5** | `a982db8` | Topbar H1 Clash Display + review full-bleed + tablo separator | ✓ Kabul |
| **R6** | `fec3e9b` | Templates family + Settings shell + AI Providers (D1 surface) | ✓ Kabul |
| **R7** | `cead59f` | Templates CRUD + Settings persist + AI Providers real backing | ✓ Kabul |
| **R8** | `3341db9` | Recipe runner + Mockup upload + Editor/Scrapers/Storage live | ✓ Kabul |
| **R9** | `95fe0b6` | Production wiring — recipe real start + PSD smart-object + inbox + enforcement layer | ✓ Kabul |
| **R10** | `e744e7b` | Production call-path migration — enforcement live (variation+listingCopy) + delivery + recipe deeper | ✓ Kabul |
| **R11** | `8d1b983` | MVP final acceptance hardening — production build PASSING + tests + honesty cleanup | ✓ Kabul |
| **R11.5** | `c7c6564` | Settings stabilization — providers/notifications resilient, stale rollout copy cleanup | ✓ Kabul |

---

## 3. MVP-ready akışlar

Aşağıdaki akışlar **production-ready**. Yeni bir geliştirici / operatör
bu akışları bugün uçtan uca koşturabilir.

### 3.1 Production spine (yatay zincir)

| Akış | Live route | Durum | Not |
|---|---|---|---|
| References (Pool / Stories / Inbox / Shops / Collections) | `/references`, `/bookmarks`, `/competitors`, `/collections`, `/trend-stories` | ✓ Live | Sub-view'lar şu an ayrı route'lar; B1 consolidasyonu post-MVP |
| Batches index | `/batches` | ✓ Live | A2 surface, retry-failed-only, virtualized rows |
| Batch detail | `/batches/[batchId]` | ✓ Live | A3 4-tab (Overview/Items/Logs/Costs) |
| Batch Review | `/batches/[batchId]/review` | ✓ Live | A4 dark workspace + keyboard handler (k/d/r/?/) |
| Library | `/library` | ✓ Live | A1 virtualized grid + density + bulk-select + slide-in detail panel |
| Selections index | `/selections` | ✓ Live | B2 stage-aware CTAs |
| Selection detail | `/selections/[setId]` | ✓ Live | B3 4-tab (Designs/Edits/Mockups/History) + edit modals |
| Apply Mockups | Selections → Mockups CTA → split modal | ✓ Live | A7 3 sibling tab (Lifestyle / Bundle preview / My templates) |
| Products index | `/products` | ✓ Live | B4 row pattern |
| Product detail | `/products/[id]` | ✓ Live | A5 4-tab (Mockups/Listing/Files/History) |
| Listing builder | Products → Listing tab | ✓ Live | Title/description/13 tags/digital-files checklist (ZIP/PNG/PDF/JPG/JPEG) |
| Etsy draft submit | Products → Submit | ✓ Live | OAuth + draft push (active publish yok — guard'lı) |

### 3.2 System surfaces

| Akış | Live route | Durum | Not |
|---|---|---|---|
| Templates index | `/templates?sub=prompts\|styles\|mockups\|recipes` | ✓ Live | C1 4 sub-type filter, CRUD + import |
| Prompt Templates | Templates → Prompts | ✓ Live | Editor modal + versioning + active/draft |
| Style Presets | Templates → Style Presets | ✓ Live | Style preset config |
| Mockup Templates | Templates → Mockups | ✓ Live | PSD upload + suitability report (R8) + activation (R9) |
| Recipes (Product Recipes) | Templates → Recipes | ✓ Live | Recipe chain + run modal + audit history (R9) + explicit "Continue" CTA (R11) |
| Settings shell | `/settings` | ✓ Live | C2 detail-list, 8 live + 4 deferred panes |
| Settings → General | `?pane=general` | ✓ Live | Density, locale, time format, theme prefs |
| Settings → Workspace | `?pane=workspace` | ✓ Live | Per-user override, default product type, file format prefs |
| Settings → Editor | `?pane=editor` | ✓ Live | Magic eraser defaults, edit-op preferences |
| Settings → Notifications | `?pane=notifications` | ✓ Live | Toggle persistence, in-app inbox, 15s polling (R11.5 hardened) |
| Settings → Etsy | `?pane=etsy` | ✓ Live | OAuth token connection state |
| Settings → AI Providers | `?pane=providers` | ✓ Live | KIE + Gemini key persistence, cost summary, spend limits, task assignments (R11.5 watchdog'lu) |
| Settings → Storage | `?pane=storage` | ✓ Live | Signed URL TTL, thumbnail cache |
| Settings → Scrapers | `?pane=scrapers` | ✓ Live | Token persistence, hourly rate limit |

### 3.3 Cross-cutting capabilities

- **Multi-user veri izolasyonu** — her ana tabloda `userId` filter,
  backend authorization (UI gizleme yetmez kuralı uygulandı).
- **Auth** — NextAuth v5 Credentials + JWT + bcrypt, role-based (USER /
  ADMIN); admin scope footer rozet ile, ayrı sidebar değil.
- **Job engine** — BullMQ + Redis worker pipeline; variation, review,
  magic-eraser, mockup-render, listing-copy job tipleri canlı.
- **Provider abstraction** — KIE (Midjourney v7, qc-vision-2, copy-flash,
  cutout-v2, compose-pro), Gemini 2.5 Flash; OpenAI/Fal/Replicate/Recraft
  schema-ready ama wiring R12.
- **Budget guard** — `assertWithinBudget` enforcement variation +
  listing-copy call-path'lerinde aktif (R10).
- **In-app notifications inbox** — recipe run, batch result, mockup
  activation, magic eraser job done sinyalleri inbox'a düşer; 15s
  polling, R12'de SSE ile gelecek.
- **Cost tracking** — CostUsage tablosu daily/monthly aggregation;
  AI Providers pane 4-stat row gerçek backing (R7).
- **AI Quality Review** — Sharp deterministic alpha + KIE Gemini 2.5
  Flash; quality_score badge, Human Review Queue, USER override sticky.
- **Magic Eraser** — LaMa inpainting Python subprocess (production) /
  mock runner (QA); concurrency 1, ~1-3s warm.

---

## 4. Works but limited (MVP'de yer alıyor, ileride genişlemesi
planlanan)

Bu akışlar canlı ama **bilinçli olarak sınırlı**. Operatör için
çalışıyor; ama "tam çözüm" değil.

| Akış | Limit | Geleceği |
|---|---|---|
| Recipe runner | "Continue to Batch Run / Selections" CTA mevcut; gerçek tam-zincir orchestration (otomatik batch+selection+mockup pipeline) yok | R12 — full chain orchestrator |
| References consolidation | Sub-view'lar (Pool/Stories/Inbox/Shops/Collections) ayrı top-level route'larda; B1 single-surface consolidation tamamlanmadı | post-MVP refactor |
| Real-time delivery | Inbox feed 15s polling | R12 — SSE channel `notifications:user:{id}` |
| Variation worker model param | resolveTaskModel pre-flight çalışıyor; worker call hâlâ providerKey üzerinden — model granularity provider registry geldiğinde tam wire | R12 — provider registry |
| Provider keys (OpenAI/Fal/Replicate/Recraft) | Schema slot var, UI'da "KEY MISSING" + "ships in R12" hint, persistence wiring yok | R12 — provider integration pass |
| Mockup binding wizard | LOCAL_SHARP MockupTemplateBinding setup CLI ile yapılıyor | post-MVP — wizard UI |
| Trend Cluster Detection | Trend Stories veri akışı canlı; cluster detection embedding bazlı sürüm yok | post-MVP |
| Preview-first major-decision | Style preset cards, mockup template grid mevcut; subtitle/lower-third/draft preview seviyesinde yok | post-MVP (CLAUDE.md preview-first roadmap) |
| Density toggle | Library, Batches index, Selections, Products'ta canlı; bazı ikincil grid'lerde eksik | iterative polish |

---

## 5. Bilinçli post-MVP deferred

Bu parçalar **MVP scope'u dışında** ve UI'da dürüstçe etiketli. Hiçbiri
release blocker değildir.

### 5.1 Settings Governance group (admin-gated, deferred)

Sidebar'da görünen ama placeholder pane render eden 4 sürüm:

- **Users** — admin user CRUD; `/admin/users` legacy yüzeyi şu an
  fonksiyonel, Settings → Users deferred
- **Audit** — audit log timeline + filter chips; legacy `/admin/audit-logs`
  fonksiyonel, Settings → Audit deferred
- **Feature Flags** — toggle row + rollout %; legacy
  `/admin/feature-flags` fonksiyonel, Settings → Flags deferred
- **Theme** — preview/colors-* swatches inside detail-list; canlı
  `/admin/theme` mevcut, Settings → Theme placeholder

Hepsi **role-gated** — non-admin user'a sidebar'da bile görünmüyor.
"Soon" rozeti ile işaretli.

### 5.2 Notification delivery backend

- **Desktop push** — UI toggle disabled, "R12" rozetli
- **Daily email digest** — UI toggle disabled, "R12" rozetli

In-app inbox aktif; bu iki kanal R12 delivery backend ile gelecek.

### 5.3 Provider integration genişlemesi

- OpenAI / Fal.ai / Replicate / Recraft — UI'da "KEY MISSING" + "ships
  in R12" hint, persistence wiring yok
- KIE re-authenticate, key Disconnect, key Copy — UI hint'leriyle "ships
  in R12" işaretli

### 5.4 Mimari deferred

- **Native macOS / Windows shell (Tauri)** — design Tauri-feasible, app
  shell pattern korundu; native app build post-MVP
- **Watch folder** — design ready, implementation deferred
- **Mobile production parity (bulk review on phone)** — browse-only
  acceptable
- **Theme editor** — read-only preview only

### 5.5 Önemli detay

CLAUDE.md'deki büyük product feature'lar:

- **Trend Cluster Detection** (semantic dedupe) — embedding-based
  similarity, post-MVP
- **Visual similarity search** — Library içinde embedding-based search,
  post-MVP
- **Local file watch folder** — Tauri `notify` integration, post-MVP

---

## 6. Release readiness

### 6.1 Code quality gate

| Kontrol | Durum |
|---|---|
| `npm run lint` | ✓ PASS (eslint plugin conflict warning — worktree config artifact, blocker değil) |
| `npm run typecheck` | ✓ PASS |
| `npm run check:tokens` | ✓ PASS — 0 token leak |
| `npm run build` | ✓ PASS — 60+ route, shared JS 87.3 kB |
| `npm run test` | ✓ 1779/1790 pass (%99.4); 11 fail integration/Redis-dep — env eksikliği, kod hatası değil |

### 6.2 Behavior gate

- ✓ Tüm production spine route'ları gerçek browser'da doğrulandı
- ✓ Permission/visibility gerçek auth ile çalışıyor; admin/user
  ayrımı role-gated
- ✓ State transitions explicit state machine guard'lı (Selection
  ready/archived read-only, batch state, listing draft state)
- ✓ Hidden behavior yok — UI'daki her R12 rozeti, "post-MVP" notu,
  watchdog retry CTA'sı operatöre dürüst sinyal veriyor

### 6.3 Product gate

- ✓ UX karmaşık değil — sidebar 8 item / 2 group, primary CTA tek
- ✓ User-facing complexity düşük; advanced ayarlar admin scope ya da
  drawer içinde
- ✓ Preview-assisted selection (style preset cards, mockup template
  grid) major decision noktalarında mevcut
- ✓ Wizard flow'lar guided/advanced ikilisini destekliyor

### 6.4 Stability gate

- ✓ Production build artifact temiz; `.next` clean rebuild PASS
- ✓ Worker process restart-safe (BullMQ job persistence)
- ✓ Failure surfaces explicit — error boundary'ler swallow yapmıyor;
  retry CTA'ları aktif (R11.5 watchdog ile providers + inbox)
- ✓ Workspace integrity — Library lineage + Selection set ordering
  ACID guard'lı

### 6.5 Document gate

- ✓ README.md güncel (bu commit ile R11.5'e kadar status)
- ✓ IMPLEMENTATION_HANDOFF.md rollout sırası R1→R11.5 dahil (bu
  commit)
- ✓ DESIGN_PARITY_CHECKPOINT.md surface↔wave mapping doğru
- ✓ design-system/kivasy/README.md implementation status tablosu
  R11.5 reality (bu commit)
- ✓ MVP_ACCEPTANCE.md (bu doküman) — operatör release kararı için tek
  yer
- ✓ CLAUDE.md status header güncel

---

## 7. Acceptance checklist (operatör için)

MVP release'i kabul etmeden önce aşağıdakiler doğrulanmalıdır:

### 7.1 Smoke testler (gerçek browser)

- [ ] `/overview` açılır; pending actions, active batches, recent
      activity blokları doludur (boş kullanıcıda placeholder doğru)
- [ ] `/library` açılır; virtualized grid, density toggle, bulk-select
      bar (2+ select) görünür
- [ ] `/batches` → "+ New Batch" → A6 Create Variations modal açılır;
      reference seçilir, similarity + count + prompt template seçilir,
      job enqueue olur
- [ ] `/batches/[id]/review` → keyboard handler (k/d/r) item kararı
      kaydeder; Apply Decisions çalışır
- [ ] `/selections` → set oluşturulur; `/selections/[id]` → Apply
      Mockups CTA açılır, mockup template seçilir, render queue olur
- [ ] `/products` → product paket kartı açılır; Listing tab title +
      description + 13 tags + digital-files checklist doldurulur
- [ ] Etsy OAuth bağlantısı `/settings?pane=etsy` üzerinden kurulur;
      product detail'den draft submit gönderilir
- [ ] `/templates?sub=recipes` → recipe run modal açılır; "Continue
      to Batch Run" CTA destination'a yönlendirir
- [ ] `/settings?pane=providers` → 4-stat row + provider card list
      görünür; KIE key persist edilir; spend limit save edilir
- [ ] `/settings?pane=notifications` → in-app inbox 0+ item
      gösterir; toggle değişiklik persist edilir

### 7.2 Negative tests

- [ ] Non-admin user `/admin/*` route'larına erişemez (redirect)
- [ ] Non-admin user `/settings` GOVERNANCE group'unu sidebar'da
      göremez
- [ ] Spend limit aşan variation enqueue'sü 429 döner ve operatör
      Active Tasks panel'inde error mesajı görür
- [ ] Etsy submit "active publish" değil "draft" gönderdiğinden
      güvenli; submission sonrası Etsy'de draft listing açılır

### 7.3 Data hygiene

- [ ] `npm run db:seed` boş veritabanından demo state üretir
- [ ] `npm run check:tokens` 0 leak raporlar
- [ ] Production build artifact'ı temiz checkout'tan (cold cache)
      başarıyla derlenir

---

## 8. Acceptance sonrası önerilen sonraki adım

**Tek sonraki adım: production deployment shakedown.** Adım adım
operasyonel kılavuz: [`docs/PRODUCTION_SHAKEDOWN.md`](PRODUCTION_SHAKEDOWN.md).

Özet:

1. **Release öncesi (T-1):** code/build sanity, env hazırlık,
   Postgres pre-migrate snapshot, ilk admin seed
2. **Release günü:** docker compose up → migrate deploy → build →
   start → worker (ayrı process — ZORUNLU)
3. **İlk smoke akışı (15-20 dk):** Login → Providers → Etsy →
   Reference → Batch → Library → Review → Selection → Mockup →
   Product → Etsy draft → Inbox doğrulama
4. **T+24h observation:** `/admin/jobs` queue health,
   `/settings?pane=providers` cost summary, worker log error rate

Detaylar:

- Env zorunlu/opsiyonel matrisi (PRODUCTION_SHAKEDOWN §1.3)
- Worker/queue topology — 15 worker, concurrency tablosu, daily
  cron'lar (PRODUCTION_SHAKEDOWN §3)
- Backup/restore — Postgres + Redis + Storage (PRODUCTION_SHAKEDOWN §4)
- Rollback senaryoları (PRODUCTION_SHAKEDOWN §6)

Bu shakedown'dan sonra "R12 production-grade enrichment" rollout'u
açılabilir (provider registry expansion, SSE delivery, recipe full
chain, mockup binding wizard).

---

## 9. Sign-off

**Bu MVP acceptance dokümanını imzaladığımda:**

- Kivasy MVP omurgası kabul edilmiştir
- Yeni feature rollout'una geçilebilir (ama önce shakedown)
- Bu dokümandaki "post-MVP deferred" listesi yeni rollout'lar için
  resmi backlog kabul edilir

| Rol | İmza | Tarih |
|---|---|---|
| Product owner | _____________ | _____________ |
| Tech lead | _____________ | _____________ |

---

_Bu dokümanın üretildiği commit: R11.5 stabilization pass (`c7c6564`).
Yeni bir feature rollout açılırsa, bu doküman güncellenir; deferred
listesi yeni rollout kapsamına girenlerle birlikte eksilir._
