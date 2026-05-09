// R8 — Editor pane settings (UserSetting key="editor").
//
// Edit-op defaults: brush size, mask compositing, magic-eraser strength,
// upscale model. Mevcut Selection edit pipeline'ı bu değerleri okuyacak
// (R8'de UI persists, R9'da edit modal'ları default'larla geçer).

import { z } from "zod";
import { db } from "@/server/db";

const SETTING_KEY = "editor";

export const EditorSettingsSchema = z.object({
  brushSize: z.number().int().min(4).max(120).default(24),
  maskComposite: z.enum(["multiply", "overlay", "soft-light"]).default("overlay"),
  magicEraserStrength: z.enum(["light", "medium", "aggressive"]).default("medium"),
  upscaleModel: z.enum(["realesrgan-v3", "swinir", "esrgan"]).default("realesrgan-v3"),
  /** Magic eraser auto-fill source: surrounding pixels vs solid color. */
  eraserFillMode: z.enum(["context", "transparent"]).default("context"),
  /** Crop snap-to-aspect helper. */
  cropSnapToAspect: z.boolean().default(true),
});

export type EditorSettings = z.infer<typeof EditorSettingsSchema>;

const DEFAULTS: EditorSettings = {
  brushSize: 24,
  maskComposite: "overlay",
  magicEraserStrength: "medium",
  upscaleModel: "realesrgan-v3",
  eraserFillMode: "context",
  cropSnapToAspect: true,
};

export async function getEditorSettings(userId: string): Promise<EditorSettings> {
  const row = await db.userSetting.findUnique({
    where: { userId_key: { userId, key: SETTING_KEY } },
  });
  if (!row) return DEFAULTS;
  const parsed = EditorSettingsSchema.safeParse(row.value);
  if (!parsed.success) return DEFAULTS;
  return parsed.data;
}

export async function updateEditorSettings(
  userId: string,
  input: Partial<EditorSettings>,
): Promise<EditorSettings> {
  const current = await getEditorSettings(userId);
  const merged = EditorSettingsSchema.parse({ ...current, ...input });
  await db.userSetting.upsert({
    where: { userId_key: { userId, key: SETTING_KEY } },
    update: { value: merged },
    create: { userId, key: SETTING_KEY, value: merged },
  });
  return merged;
}
