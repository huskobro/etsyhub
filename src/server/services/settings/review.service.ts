// IA Phase 17 — Review scoring settings (UserSetting key="review").
//
// CLAUDE.md Madde O — admin-editable surface for the review scoring
// system. The store keeps two payloads:
//   • coreMasterPrompt: optional override of the spine. Worker
//     compose validates the {{CRITERIA_BLOCK_LIST}} placeholder.
//   • criterionOverrides: keyed by criterion id (ReviewRiskFlagType).
//     Each override carries label / description / blockText / weight /
//     severity / active / applicability deltas. Builtin defaults
//     remain the source of truth; a missing override = builtin.
//
// Read path returns the **resolved** view (builtin merged with
// override). Worker reads the resolved list before composing.
//
// IMPORTANT: criterion `id` is immutable (taxonomy invariant — drift
// protection). UI cannot rename ids; only labels/text/weight/severity/
// applicability/active. CRUD beyond builtin is planned but out of
// this turn's scope (db-level new criterion ids would also need
// provider response schema enum entries).

import { z } from "zod";
import { db } from "@/server/db";
import {
  BUILTIN_CORE_MASTER_PROMPT,
  BUILTIN_CRITERIA,
  type ReviewCriterion,
} from "@/providers/review/criteria";
import {
  REVIEW_RISK_FLAG_TYPES,
  TECHNICAL_REVIEW_FLAG_TYPES,
} from "@/providers/review/types";
import {
  DEFAULT_REVIEW_THRESHOLDS,
  type ReviewThresholds,
} from "@/server/services/review/decision";

const ALL_CRITERION_IDS = [
  ...REVIEW_RISK_FLAG_TYPES,
  ...TECHNICAL_REVIEW_FLAG_TYPES,
] as const;

const SETTING_KEY = "review";

const ApplicabilitySchema = z.object({
  productTypes: z.array(z.string()).nullable(),
  formats: z.array(z.string()).nullable(),
  transparency: z.enum(["with_alpha", "no_alpha"]).nullable(),
  sourceKinds: z.array(z.enum(["design", "local-library"])).nullable(),
  requiresAnyTransform: z.array(z.string()).nullable(),
});

const SeveritySchema = z.enum(["info", "warning", "blocker"]);

// IA Phase 24 — technical criteria carry an empty `blockText`
// (server-side evaluator runs them; provider doesn't see the
// instruction). Schema must allow empty strings so the override
// payload doesn't fail Zod validation on save. Same goes for
// description on technical-only criterion mods (kept lenient).
const TechnicalRuleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("min_dpi"), minDpi: z.number().int().min(1).max(2400) }),
  z.object({
    kind: z.literal("min_resolution"),
    minMinSidePx: z.number().int().min(1).max(40000),
  }),
  z.object({
    kind: z.literal("format_whitelist"),
    allowed: z.array(z.string()).min(1),
  }),
  z.object({
    kind: z.literal("aspect_ratio"),
    target: z.number().min(0.01).max(100),
    tolerance: z.number().min(0).max(1),
  }),
  z.object({ kind: z.literal("transparency_required") }),
]);

const CriterionOverrideSchema = z
  .object({
    label: z.string().min(1).max(120),
    description: z.string().min(0).max(400),
    blockText: z.string().min(0).max(400),
    active: z.boolean(),
    weight: z.number().int().min(0).max(100),
    severity: SeveritySchema,
    applicability: ApplicabilitySchema,
    technicalRule: TechnicalRuleSchema,
  })
  .partial();

export type CriterionOverride = z.infer<typeof CriterionOverrideSchema>;

// IA Phase 27 (CLAUDE.md Madde R) — admin-editable scoring thresholds.
// `low < high` enforced via refine; both clamped to 0..100. Builtin
// defaults (DEFAULT_REVIEW_THRESHOLDS) feed when no override is set.
const ThresholdsSchema = z
  .object({
    low: z.number().int().min(0).max(100),
    high: z.number().int().min(0).max(100),
  })
  .refine((v) => v.low < v.high, {
    message: "low must be strictly below high",
    path: ["low"],
  });

// IA-39 — automation toggles. CLAUDE.md Madde U: automation must be
// visible and controllable from admin panel. Both default to true
// (existing behaviour preserved on upgrade — no silent config change).
const AutomationSchema = z.object({
  /** Auto-enqueue review when new AI variation job succeeds. */
  aiAutoEnqueue: z.boolean().default(true),
  /** Auto-enqueue review during local folder scan for new assets. */
  localAutoEnqueue: z.boolean().default(true),
  /** Periodic local scan interval in minutes (0 = disabled). */
  localScanIntervalMinutes: z.number().int().min(0).max(1440).default(0),
});

export type AutomationSettings = z.infer<typeof AutomationSchema>;

const ReviewSettingsSchema = z.object({
  coreMasterPrompt: z.string().max(8000).nullable().default(null),
  criterionOverrides: z
    .record(
      z.enum(ALL_CRITERION_IDS),
      CriterionOverrideSchema,
    )
    .default({}),
  thresholds: ThresholdsSchema.default(DEFAULT_REVIEW_THRESHOLDS),
  // IA-39 — automation policy
  automation: AutomationSchema.default({
    aiAutoEnqueue: true,
    localAutoEnqueue: true,
    localScanIntervalMinutes: 0,
  }),
});

export type ReviewSettings = z.infer<typeof ReviewSettingsSchema>;

const DEFAULTS: ReviewSettings = {
  coreMasterPrompt: null,
  criterionOverrides: {},
  thresholds: DEFAULT_REVIEW_THRESHOLDS,
  automation: {
    aiAutoEnqueue: true,
    localAutoEnqueue: true,
    localScanIntervalMinutes: 0,
  },
};

export async function getReviewSettings(userId: string): Promise<ReviewSettings> {
  const row = await db.userSetting.findUnique({
    where: { userId_key: { userId, key: SETTING_KEY } },
  });
  if (!row) return DEFAULTS;
  const parsed = ReviewSettingsSchema.safeParse(row.value);
  if (!parsed.success) return DEFAULTS;
  return parsed.data;
}

export async function updateReviewSettings(
  userId: string,
  input: Partial<ReviewSettings>,
): Promise<ReviewSettings> {
  const current = await getReviewSettings(userId);
  const merged = ReviewSettingsSchema.parse({ ...current, ...input });
  await db.userSetting.upsert({
    where: { userId_key: { userId, key: SETTING_KEY } },
    update: { value: merged },
    create: { userId, key: SETTING_KEY, value: merged },
  });
  return merged;
}

/**
 * Resolved view — builtin + per-id override merge. Worker + UI both
 * call this; resolution stays in one place so drift cannot creep in.
 */
export function resolveCriteria(
  settings: ReviewSettings,
): ReviewCriterion[] {
  return BUILTIN_CRITERIA.map((b) => {
    const o = settings.criterionOverrides[b.id];
    if (!o) return b;
    return {
      ...b,
      label: o.label ?? b.label,
      description: o.description ?? b.description,
      blockText: o.blockText ?? b.blockText,
      active: o.active ?? b.active,
      weight: o.weight ?? b.weight,
      severity: o.severity ?? b.severity,
      applicability: o.applicability ?? b.applicability,
      // IA Phase 24 — technical kriterler için technicalRule
      // merge'i: override varsa builtin yerine kullanır.
      // Override discriminated union (TechnicalRule) cast,
      // ReviewCriterion.technicalRule field tipiyle uyumlu.
      ...(o.technicalRule
        ? {
            technicalRule: o.technicalRule as ReviewCriterion["technicalRule"],
          }
        : {}),
      // version stays from builtin — overrides do not bump it; admin
      // changes reflect in the fingerprint via id@override-state below.
    };
  });
}

export async function getResolvedReviewConfig(userId: string): Promise<{
  settings: ReviewSettings;
  criteria: ReviewCriterion[];
  coreMasterPrompt: string;
  builtinCore: string;
  /** IA Phase 27 — resolved thresholds. Worker passes this directly
   *  to `decideReviewOutcomeFromBreakdown`; queue endpoint surfaces
   *  it to the client. Defaults fall back to builtin pair when no
   *  override is set. */
  thresholds: ReviewThresholds;
  /** IA-39 — resolved automation policy. Workers read this before
   *  auto-enqueue to respect admin toggles. */
  automation: AutomationSettings;
}> {
  const settings = await getReviewSettings(userId);
  const criteria = resolveCriteria(settings);
  const coreMasterPrompt = settings.coreMasterPrompt ?? BUILTIN_CORE_MASTER_PROMPT;
  return {
    settings,
    criteria,
    coreMasterPrompt,
    builtinCore: BUILTIN_CORE_MASTER_PROMPT,
    thresholds: settings.thresholds,
    automation: settings.automation,
  };
}

/**
 * IA Phase 27 — light helper for callers that only need thresholds
 * (queue endpoint). Avoids paying for criteria resolution when the
 * full payload is unnecessary.
 */
export async function getReviewThresholds(
  userId: string,
): Promise<ReviewThresholds> {
  const settings = await getReviewSettings(userId);
  return settings.thresholds;
}

/**
 * IA Phase 27 — admin "revert thresholds to defaults" affordance.
 * Removes the `thresholds` key from settings so the next read falls
 * back to DEFAULT_REVIEW_THRESHOLDS via Zod default.
 */
export async function resetReviewThresholds(
  userId: string,
): Promise<ReviewSettings> {
  const current = await getReviewSettings(userId);
  const next: ReviewSettings = {
    ...current,
    thresholds: DEFAULT_REVIEW_THRESHOLDS,
  };
  await db.userSetting.upsert({
    where: { userId_key: { userId, key: SETTING_KEY } },
    update: { value: next },
    create: { userId, key: SETTING_KEY, value: next },
  });
  return next;
}

/**
 * Reset a single criterion override (delete the override = revert to
 * builtin).
 */
export async function resetCriterionOverride(
  userId: string,
  criterionId: string,
): Promise<ReviewSettings> {
  const current = await getReviewSettings(userId);
  if (!(criterionId in current.criterionOverrides)) return current;
  const next: ReviewSettings = {
    ...current,
    criterionOverrides: { ...current.criterionOverrides },
  };
  delete next.criterionOverrides[criterionId as keyof typeof next.criterionOverrides];
  await db.userSetting.upsert({
    where: { userId_key: { userId, key: SETTING_KEY } },
    update: { value: next },
    create: { userId, key: SETTING_KEY, value: next },
  });
  return next;
}

export { CriterionOverrideSchema, ReviewSettingsSchema };
