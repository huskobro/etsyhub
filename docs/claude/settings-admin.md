# Settings / Admin (Settings Panes / Prompt-Provider-Template Admin / Negative Library / Cost)

> **AUTHORITATIVE — CURRENT.** Stage #8. Settings panes, admin
> paneli (prompt versioning, provider settings, template/recipe
> admin, negative library, cost usage, audit), mockup template
> authoring **güncel davranış + invariant**. Phase narrative DEĞİL.
>
> **Son güncelleme:** Phase 135 (2026-05-16)
> **Router:** `docs/claude/00-router.md`

---

## 1. Kapsam / Rol / Boundary

Settings (user) = Preferences/Providers/Mockup Templates/Theme/
Users/Audit/Feature Flags + Etsy connection + Local library.
Admin = role-gated section'lar (Settings/Templates içinde, ayrı
sidebar değil): prompt versioning, provider settings, negative
library, cost usage, audit logs, recipes, mockup template
manager. **Boundary:** Settings yalnız konfigürasyon görünürlüğü
+ yönetimi; operatör-facing davranışı **etkileyen her şey** burada
görünür/düzenlenebilir (No Hidden Behavior — CLAUDE.md). İş
mantığı stage modüllerinde; Settings onları konfigüre eder.

## 2. Current behavior

- **Settings → Review pane:** scoring threshold (low/high),
  prompt template, automation toggles (`aiAutoEnqueue`/
  `localAutoEnqueue`/`localScanIntervalMinutes`), local library
  folder→productType mapping, ops sayaçları (queued/running/
  failed + discoveryMode + workerRunning banner). Review modülü
  FROZEN (Madde Z) — pane görünür ama scoring sözleşmesi kilitli.
- **Settings → AI Mode:** `defaultImageProvider` (midjourney/
  kie-gpt-image-1.5/kie-z-image; Phase 7-8; backward-compat
  default). Batch compose bunu tüketir (Phase 8 wiring).
- **Mockup template authoring (templated.io clone; Phase 64-73):**
  user-scope `MockupTemplate` ownership (`userId` nullable —
  NULL=global admin catalog, set=user library). Cross-user
  isolation 4-katmanlı (read-API scope + binding endpoint
  ownership + upload prefix + asset-url guard). Create flow
  (`/templates/mockups/new`): asset upload + visual SafeAreaEditor
  (rect/perspective mode + validity guard + sample preview +
  reset) + RecipeEditor (blendMode/shadow) + multi-slot
  (SlotsEditor + ghost + 3×3 preset) → 3-step API (create →
  bind LOCAL_SHARP → publish ACTIVE). Edit page
  (`/templates/mockups/[id]/edit`): rename + safe-area + recipe;
  base asset locked. Apply drawer "My templates" tab + edit link.
- **Prompt yönetimi (KOD-DOĞRU kısmi):** `PromptTemplate` +
  `PromptVersion` modeli versiyonlu (status draft/active/archived;
  prisma); review compose snapshot review context'te alınıyor.
  Block CRUD admin UI **YOK** (builtin `criteria.ts` hardcoded;
  bkz. §3 prompt-block).
- **Negative library (STALE — doc'ta tamamlanmış gibiydi):** kod
  `variation-generation/negative-library.ts` **HARDCODED**
  (dosya header: "deliberate olarak hardcoded; Phase 6+ Settings
  Registry'ye taşınacak"). Henüz Settings'te DEĞİL — yasak
  kelime/marka kavramı var ama admin-managed değil. (→ §5 Open
  issues.)
- **Cost usage (KOD-DOĞRU kısmi):** `CostUsage` job-attributed
  (`jobId` field + `recordCostUsage()` + cost-summary endpoint).
  **Limit job engeli EKSIK** — enqueue-öncesi cost-check kodu
  YOK; yalnız dashboard monitoring (limit aşımı job engeli =
  henüz implement değil; → §5).
- **EN parity (Phase 57):** Settings/Templates/Admin operatör-
  facing TR error sızıntısı sıfırlandı; honest "Soon" disclosure.

## 3. Invariants (değişmez)

> **Enforcement-tier ayrımı (kod-grounding 2026-05-17):**
>
> **KOD-ENFORCED** (runtime mekanizma, dosya:satır):
> - Mockup template `userId` nullable ownership + cross-user
>   isolation 4-katman: Katman 1 read-API scope
>   (`mockup-templates/route.ts:86-93` `OR[userId NULL, userId==
>   current]`), Katman 2 binding ownership (`[id]/bindings/
>   route.ts:71-78` global'e user binding YASAK + cross-user
>   404), Katman 3 upload prefix (`upload-asset/route.ts:123`
>   `u/{userId}/templates/`), Katman 4 asset-url guard
>   (`asset-url/route.ts:56-61` prefix match).
> - User-scope write yalnız LOCAL_SHARP (`[id]/bindings/
>   route.ts:45-46` `z.literal("LOCAL_SHARP")`; DYNAMIC_MOCKUPS
>   reject).
> - API key encrypt (`ai-mode/service.ts:19,39,83-84`
>   `encryptSecret`/`decryptSecret`; kie+gemini cipher persist).
> - `defaultImageProvider` settings'ten (`ai-mode/service.ts:
>   55-60,83-88` UserSetting→DB→Zod; batch compose tüketir).
> - `PromptTemplate`+`PromptVersion` versiyonlu (prisma).
> - 3-step template API (create DRAFT → bind LOCAL_SHARP ACTIVE
>   → PATCH publish guard `route.ts:119-128`).
> - Review pane FROZEN — değişiklik 3-koşul (`docs/review.md`
>   Madde Z; bkz. `docs/claude/review.md` §3 — orası %100
>   kod-enforced).
>
> **POLICY-ONLY / INCOMPLETE** (kod enforce ETMEZ veya kısmî):
> - "No Hidden Behavior / kapalı kutu YASAK" — KISMÎ: final
>   skor matematiği open (review `decision.ts` weight/severity)
>   ama **block selection logic (applicability AND filter)
>   builtin `criteria.ts` hardcoded, admin override UI YOK**;
>   `ReviewCriterion` DB modeli yok. Architecture tasarlandı,
>   admin-managed implementation incomplete.
> - "Settings Registry pattern (Madde R)" — KISMÎ: ai-mode +
>   review threshold resolved helper var (kod-enforced) ama
>   `negative-library.ts` hardcoded + bazı prompt-default'lar
>   builtin fallback (registry'de değil). "değer kod'tan
>   okunmaz" iddiası bu alanlar için henüz YANLIŞ.
> - "Negative library admin-managed" — STALE/YANLIŞ: hardcoded
>   (Phase 6+ defer; → §5).
> - "Cost limit job engeli" — INCOMPLETE: enqueue-öncesi
>   cost-check kodu yok (monitoring only; → §5).
> - "Prompt-block compose-time" — KISMÎ: compose mantığı var
>   (`criteria.ts` + `composeReviewSystemPrompt`) ama block
>   CRUD/DB/admin-UI yok (builtin hardcoded).

- **No Hidden Behavior — Admin Visibility (CLAUDE.md — ÜRÜN
  KURALI; kısmî kod-enforced):** davranışı anlamlı etkileyen
  her şey admin'de görünür+düzenlenebilir **olmalı**. Gerçek
  durum: review scoring formül/threshold + ai-mode provider +
  template ownership kod-enforced görünür; **negative library +
  prompt-block selection + cost-limit henüz hidden/hardcoded**
  (yukarıdaki tier + §5). Yeni feature bu kurala uymak zorunda
  (her feature settings surface'iyle gelir — CLAUDE.md
  checklist), ama mevcut 3 alan açık borç.
- **Settings Registry pattern (Madde R — kısmî kod-enforced):**
  hedef: değer kod'tan okunmaz, resolved config helper'ından
  geçer + job başında policy snapshot. Kod-enforced: ai-mode
  (encrypt+resolve), review threshold (resolved helper).
  Henüz değil: negative-library, bazı prompt-default'lar.
- **Prompt-block / criteria architecture (Madde O — kısmî):**
  master prompt = core + active applicable blocks compose her
  job'da (`criteria.ts` + `composeReviewSystemPrompt` —
  KOD-DOĞRU); final skor matematiği open (kapalı kutu değil).
  **Ama block = DB config payload + admin CRUD/override UI
  henüz YOK** (builtin hardcoded; `ReviewCriterion` modeli yok).
  Tek parça hardcoded prompt string YASAK kuralı = ürün hedefi;
  block-level admin yönetimi incomplete (→ §5).
- **Mockup template ownership cross-user isolation
  hard-enforced** (4 katman — yukarıdaki tier bloğunda dosya:
  satır; KOD-DOĞRU). User-scope write yalnız LOCAL_SHARP. Render
  history `templateSnapshot` self-contained (silinen template
  geçmiş render'ı bozmaz).
- **Review modülü FROZEN (Madde Z):** Settings → Review pane
  görünür ama scoring/automation sözleşmesi kilitli (değişiklik
  3-koşul; bkz. `docs/claude/review.md`).
- **API key plain text YASAK** — provider credential admin
  scope'ta korunur; user key encrypt; tüm mutation
  authorization + audit log.
- **Every feature ships with its settings surface (CLAUDE.md):**
  (1) KNOWN_SETTINGS'te key, (2) admin Settings'te görünür,
  (3) prompt ise Master Prompt Editor'da, (4) wizard param ise
  wizard governance, (5) module toggle ise `module.{id}.enabled`.
- Core invariant'lar (state machine, security guard, pipeline
  step order, validation enforcement) kodda kalır, admin'den
  disable EDİLEMEZ.

## 4. Relevant files / Ownership

- `src/features/settings/` — PaneGeneral/AIProviders/Scrapers/
  Storage/Workspace/Notifications/Editor, etsy-connection,
  local-library-settings, ai-mode-settings
- `src/features/admin/` — prompt versioning, provider settings,
  negative library, cost usage, audit, mockup-templates-manager
- `src/features/templates/` — TemplatesIndexClient,
  MockupTemplateCreateForm, MockupTemplateEditForm,
  SafeAreaEditor, RecipeEditor, SlotsEditor
- `src/app/api/mockup-templates/` — create/[id]/bindings/
  [id]/upload-asset/asset-url
- `src/app/(app)/settings/`, `/templates/`,
  `/templates/mockups/new`, `/templates/mockups/[id]/edit`

## 5. Open issues / Deferred

**Kod-grounding açık borçları (2026-05-17 — "No Hidden Behavior"
hedefiyle çelişen, henüz implement EDİLMEMİŞ):**
- **Negative library Settings Registry'ye taşınmadı** —
  `variation-generation/negative-library.ts` hardcoded (Phase 6+
  defer marker). Settings-managed değil; admin görünür/düzenlenebilir
  değil.
- **Prompt-block admin CRUD/override UI yok** — `criteria.ts`
  builtin hardcoded; `ReviewCriterion` DB modeli yok; block
  weight/severity/applicability admin'den düzenlenemez (Madde O
  architecture tasarlandı, admin-managed implementation incomplete).
- **Cost limit job engeli yok** — `CostUsage` kaydı + dashboard
  var ama enqueue-öncesi cost-check (limit aşımı job engeli)
  implement değil; monitoring-only.
- **Settings Registry kısmî** — ai-mode + review threshold
  resolved; negative-library + bazı prompt-default builtin
  fallback (Madde R tam değil).

**Diğer (→ `docs/claude/known-issues-and-deferred.md`):**
- Mockup template: visual perspective quad editor advanced,
  asset reuse picker, template detail/edit nav genişletme,
  PSD ETL (`ag-psd`), quota/limits, sharing
- Admin "Soon" tab'ları (Users/Audit/Feature Flags/Theme/Dark
  mode — honest disclosure ile gizli; altyapı hazır)

## 6. Archive / Historical pointer

Tarihsel detay (Phase 10 Admin Hardening, Phase 57 Settings EN
parity, Phase 64-73 templated.io clone mockup template authoring)
→ `docs/claude/archive/phase-log-12-96.md` (NOT authoritative).
Canonical Settings Registry + No Hidden Behavior + prompt-block
→ `CLAUDE.md` "Settings Registry" / "No Hidden Behavior" / Madde
O/R.
