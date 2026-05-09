// R7 — GET / PUT /api/settings/general
import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  GeneralSettingsSchema,
  getGeneralSettings,
  updateGeneralSettings,
} from "@/server/services/settings/general.service";

export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const settings = await getGeneralSettings(user.id);
  return NextResponse.json({ settings });
});

export const PUT = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const json = await req.json().catch(() => null);
  const parsed = GeneralSettingsSchema.partial().safeParse(json);
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz ayar girişi",
      parsed.error.flatten(),
    );
  }
  const settings = await updateGeneralSettings(user.id, parsed.data);
  return NextResponse.json({ settings });
});
