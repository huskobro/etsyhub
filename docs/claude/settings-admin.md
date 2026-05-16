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
- **Prompt yönetimi (CLAUDE.md):** `PromptTemplate` versiyonlu
  (status draft/active/archived); her üretim hangi versiyonla
  üretildiğini saklar; Prompt Playground (admin test).
- **Negative library:** yasak kelime/stil/marka → negative
  prompt + AI review risk flag + listing kontrol.
- **Cost usage:** `CostUsage` job-attributed; admin dashboard;
  kullanıcı/provider/job-level limit + limit aşımı job engeli.
- **EN parity (Phase 57):** Settings/Templates/Admin operatör-
  facing TR error sızıntısı sıfırlandı; honest "Soon" disclosure.

## 3. Invariants (değişmez)

- **No Hidden Behavior — Admin Visibility (CLAUDE.md):**
  davranışı anlamlı etkileyen her şey (scoring formül/threshold/
  weight/applicability, severity, prompt, policy/default, AI
  suggestion outcome) admin'de **görünür + düzenlenebilir**.
  Gizli hardcoded karar YASAK; sessiz default YASAK (operatör
  override → explicit config; builtin = fallback referans).
- **Settings Registry pattern (CLAUDE.md Madde R):** operatör-
  facing davranış (prompt/threshold/default/scoring rule)
  service/pipeline kodunda hardcoded kalmaz; değer kod'tan
  okunmaz, resolved config helper'ından geçer. Job başında
  policy snapshot (runtime config drift'i çalışan job'u
  etkilemez).
- **Prompt-block / criteria architecture (Madde O):** master
  prompt = core + active applicable blocks (compose her job'da);
  block = config payload (key/label/weight/severity/applicability/
  active/version); final skor matematiği admin'e açıklanır
  (kapalı kutu YASAK); compose signature job'da snapshot. Tek
  parça hardcoded prompt string YASAK; prompt type setting
  `{module}.prompt.{purpose}` naming.
- **Mockup template ownership cross-user isolation
  hard-enforced** (4 katman; CLAUDE.md Multi-User). User-scope
  write yalnız LOCAL_SHARP (paid external scope dışı). Render
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

→ `docs/claude/known-issues-and-deferred.md`:
- Settings Registry'ye review threshold/prompt tam taşıma
  (Madde R uzun-vade; freeze altında)
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
