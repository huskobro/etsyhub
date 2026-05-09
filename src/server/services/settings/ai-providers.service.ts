// R8 — AI Providers admin settings persistence (UserSetting key="aiProviders").
//
// Spend limits + task-type → model assignment. AI Providers pane'in
// statik UI hint'lerinin gerçek backing'i. ai-mode (key/encryption)
// dokunulmaz; bu pane provider başına spend limit + per-task model
// override'ı yönetir.

import { z } from "zod";
import { db } from "@/server/db";

const SETTING_KEY = "aiProviders";

export const TaskTypeEnum = z.enum([
  "variation",
  "review",
  "listingCopy",
  "bgRemoval",
  "mockup",
]);

export const ProviderSpendSchema = z.object({
  dailyLimitUsd: z.number().int().min(0).max(2000),
  monthlyLimitUsd: z.number().int().min(0).max(20000),
});

export const AiProvidersSettingsSchema = z.object({
  spendLimits: z
    .record(z.string(), ProviderSpendSchema)
    .default({
      kie: { dailyLimitUsd: 50, monthlyLimitUsd: 800 },
      gemini: { dailyLimitUsd: 30, monthlyLimitUsd: 400 },
    }),
  /** Task → "providerKey/model" mapping (örn. "kie/midjourney-v7"). */
  taskAssignments: z
    .record(TaskTypeEnum, z.string().min(1))
    .default({
      variation: "kie/midjourney-v7",
      review: "kie/qc-vision-2",
      listingCopy: "kie/copy-flash",
      bgRemoval: "kie/cutout-v2",
      mockup: "kie/compose-pro",
    }),
});

export type AiProvidersSettings = z.infer<typeof AiProvidersSettingsSchema>;

const DEFAULTS: AiProvidersSettings = AiProvidersSettingsSchema.parse({});

export async function getAiProvidersSettings(
  userId: string,
): Promise<AiProvidersSettings> {
  const row = await db.userSetting.findUnique({
    where: { userId_key: { userId, key: SETTING_KEY } },
  });
  if (!row) return DEFAULTS;
  const parsed = AiProvidersSettingsSchema.safeParse(row.value);
  if (!parsed.success) return DEFAULTS;
  return parsed.data;
}

export async function updateAiProvidersSettings(
  userId: string,
  input: Partial<AiProvidersSettings>,
): Promise<AiProvidersSettings> {
  const current = await getAiProvidersSettings(userId);
  const next: AiProvidersSettings = {
    spendLimits: { ...current.spendLimits, ...(input.spendLimits ?? {}) },
    taskAssignments: {
      ...current.taskAssignments,
      ...(input.taskAssignments ?? {}),
    },
  };
  const validated = AiProvidersSettingsSchema.parse(next);
  await db.userSetting.upsert({
    where: { userId_key: { userId, key: SETTING_KEY } },
    update: { value: validated },
    create: { userId, key: SETTING_KEY, value: validated },
  });
  return validated;
}
