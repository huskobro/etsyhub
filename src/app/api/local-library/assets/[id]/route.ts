// Local Library — asset delete endpoint (Phase 5 §3, R12, Task 11)
// Sözleşme (R12 dual-flag soft-delete):
//   1) findFirst({ id, userId }) — başka kullanıcı kaynağı için 404 (varlık sızıntısı yok)
//   2) fs.unlink(filePath) — başarısızsa 500 ve DB güncellenmez (atomicity)
//   3) DB: isUserDeleted=true + deletedAt=now (R7 dual-flag)

import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { withErrorHandling } from "@/lib/http";

export const DELETE = withErrorHandling(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await params;
    const asset = await db.localLibraryAsset.findFirst({
      where: { id, userId: user.id },
    });
    if (!asset) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    try {
      await unlink(asset.filePath);
    } catch (err) {
      // Dosya silinemezse DB'yi de güncelleme — durum tutarlı kalsın.
      return NextResponse.json(
        { error: `Dosya silinemedi: ${(err as Error).message}` },
        { status: 500 },
      );
    }

    await db.localLibraryAsset.update({
      where: { id: asset.id },
      data: { isUserDeleted: true, deletedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  },
);
