/**
 * Phase 43 — /batches/[batchId]/compose
 *
 * Operatör-facing batch compose surface. Pool card "New Batch" CTA
 * yeni bir Batch yaratıp buraya yönlendirir. v7 d2a/d2b A6 modal'ının
 * page-form factor equivalent'i:
 *
 *   - Source reference rail (items grid)
 *   - Variation count / aspect ratio / prompt template / cost preview
 *   - Footer: Cancel + primary "Launch Batch" (Phase 44)
 *
 * Phase 43 vertical slice: scaffold + items rail görünür; launch CTA
 * placeholder (Phase 44'te real worker tetiklenecek). Server-side
 * fetch user-scoped batch detail; cross-user → notFound.
 *
 * Legacy /references/[id]/variations rotası Phase 43'te bridge olarak
 * korunur (CLAUDE.md decision); kullanıcı UI'da o yola düşmez, ama
 * eski derin link'ler kırılmaz.
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { getBatch } from "@/features/batches/server/batch-service";
import { NotFoundError } from "@/lib/errors";
import { BatchComposeClient } from "@/features/batches/components/BatchComposeClient";

export const metadata = { title: "Batch compose · Kivasy" };
export const dynamic = "force-dynamic";

export default async function BatchComposePage({
  params,
}: {
  params: Promise<{ batchId: string }> | { batchId: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { batchId } = await Promise.resolve(params);

  try {
    const batch = await getBatch({
      userId: session.user.id,
      batchId,
    });
    return <BatchComposeClient batch={batch} />;
  } catch (err) {
    if (err instanceof NotFoundError) return notFound();
    throw err;
  }
}
