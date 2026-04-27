// Local Library — negative mark endpoint (Phase 5 §3, R11, Task 11)
// Sözleşme:
//   - body.isNegative = true → isNegative=true, negativeReason=reason ?? null
//   - body.isNegative = false → isNegative=false, negativeReason=null (toggle off)
//   - reason ≤200 char (R11)
//   - başka kullanıcı kaynağı için 404 (varlık sızıntısı yok)

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";

const Body = z.object({
  isNegative: z.boolean().default(true),
  reason: z.string().max(200).optional(),
});

export const POST = withErrorHandling(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await params;
    const asset = await db.localLibraryAsset.findFirst({
      where: { id, userId: user.id },
    });
    if (!asset) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError("Geçersiz istek", parsed.error.flatten());
    }
    const updated = await db.localLibraryAsset.update({
      where: { id: asset.id },
      data: {
        isNegative: parsed.data.isNegative,
        // Toggle off → reason temizlensin; toggle on → reason ya da null.
        negativeReason: parsed.data.isNegative
          ? (parsed.data.reason ?? null)
          : null,
      },
    });
    return NextResponse.json({ asset: updated });
  },
);
