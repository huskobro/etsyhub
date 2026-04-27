// User Settings — local-library — Phase 5 §8 (Q3), Task 15
// GET → effective settings (default merge); PUT → validate + persist.
// UserSetting [userId, key] composite PK üzerinden cross-user izolasyon.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  getUserLocalLibrarySettings,
  updateUserLocalLibrarySettings,
} from "@/features/settings/local-library/service";
import { LocalLibrarySettingsSchema } from "@/features/settings/local-library/schemas";

export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const settings = await getUserLocalLibrarySettings(user.id);
  return NextResponse.json({ settings });
});

export const PUT = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const json = await req.json().catch(() => null);
  const parsed = LocalLibrarySettingsSchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }
  const settings = await updateUserLocalLibrarySettings(user.id, parsed.data);
  return NextResponse.json({ settings });
});
