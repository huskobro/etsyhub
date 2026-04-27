// Local Library — URL public check endpoint (Phase 5 §4.1 Q5, Task 11)
// Sözleşme: pure HEAD delegation; pattern match YASAK (Q5 — service'in içinde
// de yok). Endpoint sadece auth + zod parse + service çağrısı.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { checkUrlPublic } from "@/features/variation-generation/url-public-check";

const Body = z.object({ url: z.string().url() });

export const POST = withErrorHandling(async (req: Request) => {
  await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }
  const result = await checkUrlPublic(parsed.data.url);
  return NextResponse.json(result);
});
