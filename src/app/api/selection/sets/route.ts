// Phase 7 Task 18 — GET + POST /api/selection/sets
//
// Selection Studio set index/create endpoint'i. Kullanıcı kendi setlerini
// (Phase 7 status filter ile) listeler ya da manuel yeni set yaratır.
//
// Sözleşme (design Section 7.2; plan Task 18):
//   - GET /api/selection/sets[?status=draft|ready|archived]
//       Auth: requireUser (Phase 5)
//       status query param zod enum'a karşı validate edilir; verilmezse
//       tüm statüler döner (service `listSets`).
//       Cross-user izolasyon: service `userId` filter zorunluluğu.
//       Invalid status → 400 (ValidationError).
//   - POST /api/selection/sets
//       Auth: requireUser
//       body: CreateSelectionSetInputSchema { name } (trim().min(1))
//       Success: 201 + { set } (Prisma row payload).
//
// Phase 6 paterni: `safeParse` + `throw new ValidationError`. Generic Zod
// fail mapping yok — el ile (sade ve net hata mesajı için).

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  createSet,
  listSets,
} from "@/server/services/selection/sets.service";
import { CreateSelectionSetInputSchema } from "@/server/services/selection/types";

const StatusFilterSchema = z
  .enum(["draft", "ready", "archived"])
  .optional();

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireUser();

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? undefined;
  const parsedStatus = StatusFilterSchema.safeParse(statusParam);
  if (!parsedStatus.success) {
    throw new ValidationError("Geçersiz status filtresi", parsedStatus.error.flatten());
  }

  const sets = await listSets({
    userId: user.id,
    status: parsedStatus.data,
  });
  return NextResponse.json({ sets });
});

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();

  const json = await req.json().catch(() => null);
  const parsed = CreateSelectionSetInputSchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }

  const set = await createSet({ userId: user.id, name: parsed.data.name });
  return NextResponse.json({ set }, { status: 201 });
});
