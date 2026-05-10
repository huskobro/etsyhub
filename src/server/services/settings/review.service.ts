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

const CriterionOverrideSchema = z
  .object({
    label: z.string().min(1).max(120),
    description: z.string().min(1).max(400),
    blockText: z.string().min(1).max(400),
    active: z.boolean(),
    weight: z.number().int().min(0).max(100),
    severity: SeveritySchema,
    applicability: ApplicabilitySchema,
  })
  .partial();

export type CriterionOverride = z.infer<typeof CriterionOverrideSchema>;

const ReviewSettingsSchema = z.object({
  coreMasterPrompt: z.string().max(8000).nullable().default(null),
  criterionOverrides: z
    .record(
      z.enum(ALL_CRITERION_IDS),
      CriterionOverrideSchema,
    )
    .default({}),
});

export type ReviewSettings = z.infer<typeof ReviewSettingsSchema>;

const DEFAULTS: ReviewSettings = {
  coreMasterPrompt: null,
  criterionOverrides: {},
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
}> {
  const settings = await getReviewSettings(userId);
  const criteria = resolveCriteria(settings);
  const coreMasterPrompt = settings.coreMasterPrompt ?? BUILTIN_CORE_MASTER_PROMPT;
  return {
    settings,
    criteria,
    coreMasterPrompt,
    builtinCore: BUILTIN_CORE_MASTER_PROMPT,
  };
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
