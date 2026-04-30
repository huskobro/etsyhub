// Phase 7 Task 20 — GET /api/selection/sets/[setId]
//
// Selection Studio set detay endpoint'i. Tek set + items[] (review map ile)
// + activeExport (queue durumu) döner. Phase 7 Task 3 (`getSet`), Task 14
// (`activeExport` populate) ve Task 16 (review mapper) bu payload shape'ini
// kurmuştu — route yalnız ownership doğrulamasını ve forward'ı yapar.
//
// Sözleşme (design Section 7.2; plan Task 20):
//   - Auth: requireUser (Phase 5)
//   - Cross-user / olmayan setId → 404 (NotFoundError; varlık sızıntısı yok,
//     Phase 6 disiplini). `getSet` içindeki `requireSetOwnership` (Task 17)
//     bu 404'ü zaten atıyor — route ekstra kontrol yapmaz.
//   - Response: SelectionSet & {
//       items: (SelectionItem & { review: ReviewView | null })[],
//       activeExport: ActiveExport | null,
//     }
//     Service tam payload'ı kurduğu için route `NextResponse.json(result)`
//     ile aynen forward eder (yeniden shape'leme yok).
//
// Phase 6 paterni: `withErrorHandling(async (req, ctx) => {...})` —
// emsal `src/app/api/jobs/[id]/route.ts` ile aynı yapı; AppError alt-sınıfları
// `errorResponse` helper üzerinden HTTP'ye otomatik map olur.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { getSet } from "@/server/services/selection/sets.service";

export const GET = withErrorHandling(
  async (_req: Request, ctx: { params: { setId: string } }) => {
    const user = await requireUser();
    const result = await getSet({
      userId: user.id,
      setId: ctx.params.setId,
    });
    return NextResponse.json(result);
  },
);
