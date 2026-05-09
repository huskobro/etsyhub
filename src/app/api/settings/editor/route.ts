// R8 — GET / PUT /api/settings/editor
import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  EditorSettingsSchema,
  getEditorSettings,
  updateEditorSettings,
} from "@/server/services/settings/editor.service";

export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const settings = await getEditorSettings(user.id);
  return NextResponse.json({ settings });
});

export const PUT = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const json = await req.json().catch(() => null);
  const parsed = EditorSettingsSchema.partial().safeParse(json);
  if (!parsed.success) {
    throw new ValidationError("Geçersiz editor ayarı", parsed.error.flatten());
  }
  const settings = await updateEditorSettings(user.id, parsed.data);
  return NextResponse.json({ settings });
});
