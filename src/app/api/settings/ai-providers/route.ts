// R8 — GET / PUT /api/settings/ai-providers (admin scope)
//
// Spend limits + task-type → model assignment persistence.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  AiProvidersSettingsSchema,
  getAiProvidersSettings,
  updateAiProvidersSettings,
} from "@/server/services/settings/ai-providers.service";

export const GET = withErrorHandling(async () => {
  const admin = await requireAdmin();
  const settings = await getAiProvidersSettings(admin.id);
  return NextResponse.json({ settings });
});

export const PUT = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();
  const json = await req.json().catch(() => null);
  const parsed = AiProvidersSettingsSchema.partial().safeParse(json);
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz AI providers ayarı",
      parsed.error.flatten(),
    );
  }
  const settings = await updateAiProvidersSettings(admin.id, parsed.data);
  return NextResponse.json({ settings });
});
