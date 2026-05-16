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

Yukarıdaki tier bloğu **tek otoriter referans** (kanıt:satır
orada). Ek bağlam (tekrar değil):

- **No Hidden Behavior / Settings Registry / Prompt-block (Madde
  O+R)** = ürün hedefi; gerçek durum tier bloğunda (review
  scoring/ai-mode/template ownership KOD-ENFORCED; negative-
  library/prompt-block CRUD/cost-limit açık borç → §5/§5.5).
  Yeni feature CLAUDE.md "settings surface checklist"e uymak
  zorunda (1 key 2 admin-görünür 3 prompt-editor 4 wizard-gov
  5 module-toggle); mevcut 3 alan istisna-borç, doc'larda
  "yapıldı" gibi gösterilmez.
- **Review modülü FROZEN (Madde Z):** Settings→Review pane
  görünür ama scoring/automation kilitli (3-koşul; →
  `docs/claude/review.md` §3 — %100 kod-enforced).
- **Core invariant'lar admin'den disable EDİLEMEZ** (state
  machine, security guard, pipeline step order, validation) —
  kodda kalır (KOD-DOĞRU; tasarım kuralı).

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

## 5.5 Enforcement plan (policy/incomplete → enforced adayları)

> **Statü (2026-05-17):** P1 (negative library → Settings
> Registry) + P2'ler **DEFERRED** — kullanıcı kararıyla şimdilik
> ertelendi, yeni enforcement işi AÇILMADI. Takip:
> `docs/claude/known-issues-and-deferred.md` §I (+ §H). Bu
> turda uygulanmaz; ileride enforcement turunda buradan alınır.

Bu modülde 3 gerçek **kod-borcu** (CLAUDE.md "No Hidden
Behavior" / Madde O+R hedefiyle çelişen, henüz implement
edilmemiş). Önceliklendirme + somut plan:

| Borç | Şu an | Enforce/tamamla adayı? | Öncelik | Önerilen mekanizma |
|---|---|---|---|---|
| **Negative library Settings'te değil** | hardcoded `negative-library.ts` (Phase 6+ defer) | **Evet** | **P1** | En düşük scope + yüksek ürün değeri: `UserSetting`/admin key `negative.terms[]` + resolved helper (ai-mode pattern parity); `negative-library.ts` builtin → fallback, override settings'ten. Risk-flag + negative-prompt + listing kontrol o helper'ı okur. Tek setting + 1 resolved fn + UI list (mevcut Settings pane pattern). "No Hidden Behavior" en görünür ihlali bu. |
| **Prompt-block admin CRUD/override yok** | builtin `criteria.ts` hardcoded; `ReviewCriterion` DB modeli yok | Kısmi | **P2** | **TAM CRUD pahalı + Review FROZEN** (Madde Z — scoring sözleşmesi kilitli; criteria değişimi review davranışını etkiler → 3-koşul gerekir). Öneri: önce **read-only admin görünürlük** (builtin block listesi + weight/severity/applicability admin'de GÖRÜNÜR ama düzenlenemez — "No Hidden Behavior"in görünürlük yarısı ucuz, davranış değişmez, freeze güvenli). Edit/override (DB `ReviewCriterion` + builtin override katmanı) ayrı büyük tur + Madde Z onayı. |
| **Cost limit job engeli yok** | `CostUsage` kaydı + dashboard; enqueue-öncesi check yok | Evet | **P2** | `enqueueReviewDesign` / variation enqueue başına **pre-check**: user/provider günlük-aylık `CostUsage` toplamı resolved limit'i aşıyorsa enqueue reddi + operatöre net mesaj (CLAUDE.md Cost Guardrails). Limit değeri Settings Registry'den (yeni `cost.limit.*` key). Scope: tek pre-check helper + settings key + 2 enqueue call-site. |
| Settings Registry kısmî (negative/prompt-default builtin fallback) | KISMÎ | — | — | P1 (negative) + P2 (prompt-block read-only) tamamlanınca büyük ölçüde kapanır; ayrı aksiyon değil. |

**KOD-ENFORCED kalan** (korunmalı, regresyon testi): ownership
4-katman, user-write LOCAL_SHARP-only, API key encrypt,
`defaultImageProvider` resolve, `PromptTemplate`+`PromptVersion`,
3-step template API, Review FROZEN gate.

**Net öneri (sıralı):**
1. **P1 — negative library → Settings Registry** (en görünür
   "No Hidden Behavior" ihlali; en küçük scope; tek setting +
   resolved helper + UI list).
2. **P2 — cost limit pre-check** (Cost Guardrails ürün kuralı
   şu an hiç enforce değil; tek pre-check helper + settings key).
3. **P2 — prompt-block READ-ONLY admin görünürlük** (full
   CRUD DEĞİL — Review FROZEN; yalnız görünürlük yarısı,
   davranış değişmez, freeze güvenli; edit ayrı tur + Madde Z).
Üçü de küçük/orta scope, ürün anayasası borcunu kapatır.
Premature full prompt-block CRUD YAPMA (freeze + scope).

## 6. Archive / Historical pointer

Tarihsel detay (Phase 10 Admin Hardening, Phase 57 Settings EN
parity, Phase 64-73 templated.io clone mockup template authoring)
→ `docs/claude/archive/phase-log-12-96.md` (NOT authoritative).
Canonical Settings Registry + No Hidden Behavior + prompt-block
→ `CLAUDE.md` "Settings Registry" / "No Hidden Behavior" / Madde
O/R.
