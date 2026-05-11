// User Settings — local-library — Phase 5 §8 (Q3), Task 15
// GET → effective settings (default merge); PUT → validate + persist.
// UserSetting [userId, key] composite PK üzerinden cross-user izolasyon.
//
// IA-39+ (watcher sync): the chokidar file watcher lives only in the
// worker process (scripts/dev-worker.ts). API routes do NOT import the
// watcher module — chokidar is a native binary that cannot be bundled
// by Next.js webpack. When rootFolderPath changes here, the worker
// process picks up the new setting on its next watcher-sync check
// (syncWatchersForAllUsers is called at startup; settings changes are
// reflected on next worker restart or periodic settings re-check).

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
