// Phase 7 Task 22 — POST /api/selection/sets/[setId]/items/[itemId]/edit/heavy
//
// Heavy edit op endpoint'i. Selection Studio'da kullanıcı bg-remove gibi
// pahalı işlemleri BullMQ üzerinden async tetikler; route enqueue + lock
// acquire sonrası `jobId` döner, UI worker progress'ini polling/SSE ile izler.
//
// Sözleşme (design Section 5.1, 7.2; plan Task 22):
//   - Auth: requireUser
//   - body: { op: "background-remove" } (tek literal — zod heavy schema)
//   - Success: 200 + { jobId } (BullMQ enqueue + DB-side lock)
//   - Wrong op (instant) → 400 (zod reject)
//   - Ready set → 409 (SetReadOnlyError; service layer)
//   - Paralel heavy lock → 409 (ConcurrentEditError; Task 10 lock)
//   - Cross-user → 404
//
// Schema dar tutulur: `EditOpInputSchema` üzerinden `background-remove` kabul
// edip diğerlerini reject etmek yerine, bu endpoint'e özel `HeavyEditSchema`
// (literal "background-remove") kullanılıyor. İstemci yanlış endpoint
// kullanırsa fail-fast 400 alır; instant op'lar `/edit` endpoint'ine gider.
//
// Pass 29 — Magic Eraser ek heavy op olarak eklendi:
// op: "magic-eraser" + maskBase64. Mask binarize PNG (white=remove,
// black=keep). Worker base64 decode edip Python LaMa runner'a gönderir.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { applyEditAsync } from "@/server/services/selection/edit.service";

const HeavyEditSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("background-remove") }),
  z.object({
    op: z.literal("magic-eraser"),
    // Pass 29 — mask payload size limit: ≤500KB base64 ≈ ~370KB binary.
    // BullMQ Redis ~512KB limit içinde kalır. 4096×4096 binarize PNG
    // ~50KB; 8192×8192 ~150KB. >500KB reject (kullanıcı çok büyük
    // resolution + çok karmaşık mask çiziminde nadir).
    maskBase64: z
      .string()
      .min(1)
      .max(500 * 1024, "Mask boyutu 500KB'yi aşamaz"),
  }),
]);

export const POST = withErrorHandling(
  async (
    req: Request,
    ctx: { params: { setId: string; itemId: string } },
  ) => {
    const user = await requireUser();

    const json = await req.json().catch(() => null);
    const parsed = HeavyEditSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError("Geçersiz istek", parsed.error.flatten());
    }

    const result =
      parsed.data.op === "magic-eraser"
        ? await applyEditAsync({
            userId: user.id,
            setId: ctx.params.setId,
            itemId: ctx.params.itemId,
            op: {
              op: "magic-eraser",
              params: { maskBase64: parsed.data.maskBase64 },
            },
          })
        : await applyEditAsync({
            userId: user.id,
            setId: ctx.params.setId,
            itemId: ctx.params.itemId,
            op: { op: "background-remove" },
          });

    return NextResponse.json(result);
  },
);
