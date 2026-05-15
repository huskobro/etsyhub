// Phase 99 — Frame mode export endpoint (POST /api/frame/export).
//
// Sözleşme #11 + #13.C: Frame mode "preview only" baseline'dan gerçek
// output'a geçiş. Client Shell sceneOverride + slot positions + selection
// item IDs ile request gönderir; service stateless Sharp pipeline
// üzerinden PNG üretir, MinIO'ya yükler, signed download URL döner.
//
// Auth: requireUser (cross-user isolation defense). Selection set + asset
// ownership service tarafında doğrulanır (Madde V).
//
// Schema-zero: yeni DB row/migration yok. Frame export history /
// retry / persistence Phase 100+ candidate.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { exportFrameComposition } from "@/server/services/frame/frame-export.service";

const FrameAspectKeySchema = z.enum(["1:1", "4:5", "9:16", "16:9", "3:4"]);
const SceneModeSchema = z.enum(["auto", "solid", "gradient", "glass"]);
const GlassVariantSchema = z.enum(["light", "dark", "frosted"]);

const SceneSchema = z.object({
  mode: SceneModeSchema,
  color: z.string().optional(),
  colorTo: z.string().optional(),
  glassVariant: GlassVariantSchema.optional(),
  lensBlur: z.boolean().optional(),
  palette: z
    .tuple([z.string(), z.string()])
    .optional()
    .nullable(),
});

const SlotSchema = z.object({
  slotIndex: z.number().int().min(0).max(8),
  assigned: z.boolean(),
  itemId: z.string().nullable().optional(),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  r: z.number(),
  z: z.number().int(),
});

// Phase 105 — productType-aware device shape (preview StageDeviceSVG
// parity). Backward-compat: opsiyonel; undefined → service "sticker"
// fallback (Phase 104 baseline).
const DeviceShapeSchema = z.enum(["frame", "sticker", "bezel"]);

const BodySchema = z.object({
  setId: z.string().min(1),
  frameAspect: FrameAspectKeySchema,
  scene: SceneSchema,
  slots: z.array(SlotSchema).min(0).max(9),
  stageInnerW: z.number().positive().optional(),
  stageInnerH: z.number().positive().optional(),
  deviceShape: DeviceShapeSchema.optional(),
});

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();

  const json = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }

  const result = await exportFrameComposition({
    userId: user.id,
    setId: parsed.data.setId,
    frameAspect: parsed.data.frameAspect,
    scene: {
      mode: parsed.data.scene.mode,
      color: parsed.data.scene.color,
      colorTo: parsed.data.scene.colorTo,
      glassVariant: parsed.data.scene.glassVariant,
      lensBlur: parsed.data.scene.lensBlur,
      palette: parsed.data.scene.palette ?? undefined,
    },
    slots: parsed.data.slots,
    ...(parsed.data.stageInnerW ? { stageInnerW: parsed.data.stageInnerW } : {}),
    ...(parsed.data.stageInnerH ? { stageInnerH: parsed.data.stageInnerH } : {}),
    ...(parsed.data.deviceShape ? { deviceShape: parsed.data.deviceShape } : {}),
  });

  return NextResponse.json(result, { status: 200 });
});
