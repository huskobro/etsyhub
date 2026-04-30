// Phase 7 Task 22 — POST /api/selection/sets/[setId]/export
//
// Set'i ZIP olarak export etmek üzere BullMQ kuyruğuna (`EXPORT_SELECTION_SET`)
// iş ekler. Worker (`selection-export.worker`, Task 12) işi alır, asset'leri
// stream-download eder, ZIP build eder, storage'a upload eder ve set
// metadata'sını günceller.
//
// Sözleşme (design Section 6.6, 7.2; plan Task 22):
//   - Auth: requireUser (Phase 5)
//   - Body yok / boş.
//   - Success: 202 Accepted + { jobId } (BullMQ job kimliği — UI polling/SSE
//     ile durumu izler).
//   - Cross-user → 404 (`requireSetOwnership` — enqueue ÖNCE; queue'a job
//     sızdırılmaz).
//
// Boş set guard (plan Task 22 risk uyarısı):
//   Worker `EXPORT_SELECTION_SET` payload'unu işlerken boş set tespitinde
//   FAIL eder. Route layer'da extra check eklenmedi — daha az kod, hata
//   user'a job tarafında yansır (UI active-export status="failed" görür).
//
// Status code 202 kararı:
//   Job henüz işlenmedi; sadece kuyruğa alındı. REST best practice: 202
//   Accepted + jobId. UI Set GET → activeExport ile durum izler.

import { NextResponse } from "next/server";
import { JobType } from "@prisma/client";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { enqueue } from "@/server/queue";
import { requireSetOwnership } from "@/server/services/selection/authz";

export const POST = withErrorHandling(
  async (_req: Request, ctx: { params: { setId: string } }) => {
    const user = await requireUser();

    // Cross-user 404 — enqueue ÖNCE; başka kullanıcının set id'siyle queue'a
    // job eklenmesi engellenir (worker zaten cross-user payload'u reddederdi
    // ama defense in depth + 404 disiplini).
    await requireSetOwnership({ userId: user.id, setId: ctx.params.setId });

    const job = await enqueue(JobType.EXPORT_SELECTION_SET, {
      userId: user.id,
      setId: ctx.params.setId,
    });

    if (!job.id) {
      // BullMQ kontratı: `add()` job.id otomatik üretir; null beklenmez.
      // Defense in depth — null gelirse 500 (generic Error → 500).
      throw new Error("BullMQ job.id null — enqueue başarısız");
    }

    return NextResponse.json({ jobId: job.id }, { status: 202 });
  },
);
