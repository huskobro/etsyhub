// R7 — GET / POST /api/templates/style-presets

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  createStylePreset,
  listStylePresets,
} from "@/server/services/templates/style-presets.service";

export const GET = withErrorHandling(async () => {
  await requireUser();
  const presets = await listStylePresets();
  return NextResponse.json({ presets });
});

const InputSchema = z.object({
  name: z.string().min(1).max(160),
  aspect: z.enum(["square", "portrait", "landscape", "multi"]),
  similarity: z.enum(["subtle", "medium", "heavy"]),
  palette: z.string().min(1).max(200),
  weight: z.string().min(1).max(100),
  notes: z.string().max(500).optional(),
});

export const POST = withErrorHandling(async (req: Request) => {
  await requireAdmin();
  const json = await req.json().catch(() => null);
  const parsed = InputSchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz preset girişi",
      parsed.error.flatten(),
    );
  }
  const preset = await createStylePreset(parsed.data);
  return NextResponse.json({ preset }, { status: 201 });
});
