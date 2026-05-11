// Phase 6 Task 11 — POST + PATCH /api/review/decisions
//
// USER karar API'si — Phase 6 review pipeline'ının "Approve anyway" UX
// kontratı. POST: USER override (APPROVED veya REJECTED). PATCH: SYSTEM
// reset + rerun (best-effort).
//
// Sticky kontratı (R12):
//   - POST → reviewStatusSource = USER yazılır.
//   - Worker `updateMany WHERE reviewStatusSource ≠ USER` ile SYSTEM yazısını
//     atomik olarak engeller (race-safe). Bu endpoint USER damgasını koyar.
//   - PATCH → USER damgası silinir (SYSTEM), score/summary/snapshot/riskFlags
//     null'lanır, status PENDING'e döner; sonra REVIEW_DESIGN job enqueue
//     edilir (best-effort) ki worker yeni SYSTEM kararı yazsın.
//
// Sözleşme:
//   - Auth: requireUser (Phase 5).
//   - POST body Zod:
//       { scope: "design"|"local", id: cuid,
//         decision: "APPROVED"|"REJECTED" }
//     decision PENDING ya da NEEDS_REVIEW gelirse 400 — USER bu state'leri
//     yazamaz (sessiz fallback YASAK).
//   - PATCH body Zod (discriminated union):
//       design → { scope: "design", id: cuid }
//       local  → { scope: "local",  id: cuid, productTypeKey: string min(1) }
//     productTypeKey local için ZORUNLU (Karar 3) — sessiz default YOK.
//   - Ownership: tek findFirst (id + userId + soft-delete filter); dönmediyse
//     404 (Karar 1). Başka user'ın kaydı için 403 değil 404 — varlık sızıntısı
//     yok, generic "not found" mesaj.
//
// Response shape (Karar 2 — PATCH reset + rerun ayrımı):
//   {
//     reset: true,                    // state commit oldu (her zaman true)
//     rerunEnqueued: boolean,         // enqueue try/catch sonucu
//     rerunError?: string,            // sadece rerunEnqueued=false ise
//   }
//
// Kararlar:
//   - POST design: SYSTEM alanları (reviewScore, reviewSummary,
//     reviewProviderSnapshot, reviewPromptSnapshot, reviewRiskFlags) KORUNUR.
//     UI USER kararını override etse de eski SYSTEM kanıt zinciri görünür kalır.
//   - POST design DesignReview audit upsert: USER override sonrası
//     `reviewer = userId, decision = USER decision`. Provider/model/snapshot
//     alanlarına dokunulmaz — eski SYSTEM audit korunur (zaman serisi audit
//     Phase 7+ follow-up).
//   - PATCH reset: state ATOMIK commit (db.update); rerun BEST-EFFORT
//     (try/catch). Reset PASS ama rerun FAIL durumunda 200 + warning shape;
//     500 dönmez. Kullanıcı UI'da reset'in olduğunu görür, rerun manuel
//     tetiklenebilir.
//   - PATCH design'da textDetected/gibberishDetected default değerlere
//     döndürülür (false, false) — schema default'larıyla aynı; LocalLibraryAsset
//     bu alanlara sahip değil.
//   - PATCH design'da DesignReview audit row SİLİNMEZ — eski SYSTEM kanıt
//     korunur. Worker rerun'da upsert update dalı override edecek.

import { NextResponse } from "next/server";
import { z } from "zod";
import { JobType, Prisma, ReviewStatus, ReviewStatusSource } from "@prisma/client";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { db } from "@/server/db";
import { enqueueReviewDesign } from "@/server/services/review/enqueue";
import { getUserLocalLibrarySettings } from "@/features/settings/local-library/service";
import { resolveLocalFolder } from "@/features/settings/local-library/folder-mapping";
import { logger } from "@/lib/logger";

// USER yalnızca APPROVED veya REJECTED yazabilir. PENDING/NEEDS_REVIEW SYSTEM
// state'leri — Zod 400 ile reddeder.
const PostSchema = z.object({
  scope: z.enum(["design", "local"]),
  id: z.string().cuid(),
  decision: z.enum([ReviewStatus.APPROVED, ReviewStatus.REJECTED]),
});

// Discriminated union — local scope productTypeKey ZORUNLU (Karar 3).
// IA Phase 25 — `rerun` opt-in flag (default false). When true,
// the snapshot is wiped and a fresh REVIEW_DESIGN job is enqueued.
// When false (default), only the operator-decision layer is
// rolled back: status → PENDING, source → SYSTEM. The existing
// AI evaluation (score / summary / risk flags / provider snapshot)
// stays as a reference so undecided'a alma tek başına re-score
// sebebi olmaz (CLAUDE.md Madde N — kept/rejected → undecided
// preserve).
const PatchSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("design"),
    id: z.string().cuid(),
    rerun: z.boolean().optional(),
  }),
  z.object({
    scope: z.literal("local"),
    id: z.string().cuid(),
    // IA-30 — productTypeKey artık optional. UI hardcoded "wall_art"
    // göndermek zorunda değil; server folder mapping veya asset'in
    // folderName'inden resolve eder. Yine de override için body'de
    // gelebilir (örn. admin script).
    productTypeKey: z.string().min(1).optional(),
    rerun: z.boolean().optional(),
  }),
]);

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();

  const json = await req.json().catch(() => null);
  const parsed = PostSchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }

  if (parsed.data.scope === "design") {
    // Ownership = 404 (Karar 1: varlık sızıntısı yok)
    const design = await db.generatedDesign.findFirst({
      where: { id: parsed.data.id, userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!design) {
      throw new NotFoundError();
    }

    // USER override write — score/summary/riskFlags/snapshot KORUNUR.
    // R12 sticky: USER damgası yazıldığı an worker race-safe `updateMany
    // WHERE not USER` guard'ı SYSTEM yazısını engeller.
    await db.generatedDesign.update({
      where: { id: parsed.data.id },
      data: {
        reviewStatus: parsed.data.decision,
        reviewStatusSource: ReviewStatusSource.USER,
        reviewedAt: new Date(),
      },
    });

    // Audit (DesignReview) — USER override.
    // upsert update dalı: provider/model/promptSnapshot/responseSnapshot/score
    // alanlarına dokunulmuyor; eski SYSTEM audit korunur. Sadece reviewer +
    // decision güncellenir. create dalı: SYSTEM alanları null kalır (USER
    // manuel karar — provider snapshot yok).
    await db.designReview.upsert({
      where: { generatedDesignId: parsed.data.id },
      create: {
        generatedDesignId: parsed.data.id,
        reviewer: user.id,
        decision: parsed.data.decision,
      },
      update: {
        reviewer: user.id,
        decision: parsed.data.decision,
      },
    });

    return NextResponse.json({
      ok: true,
      status: parsed.data.decision,
      source: "USER" as const,
    });
  }

  // scope === "local"
  const asset = await db.localLibraryAsset.findFirst({
    where: {
      id: parsed.data.id,
      userId: user.id,
      deletedAt: null,
      isUserDeleted: false,
    },
    select: { id: true },
  });
  if (!asset) {
    throw new NotFoundError();
  }

  await db.localLibraryAsset.update({
    where: { id: parsed.data.id },
    data: {
      reviewStatus: parsed.data.decision,
      reviewStatusSource: ReviewStatusSource.USER,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    status: parsed.data.decision,
    source: "USER" as const,
  });
});

export const PATCH = withErrorHandling(async (req: Request) => {
  const user = await requireUser();

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }

  if (parsed.data.scope === "design") {
    const design = await db.generatedDesign.findFirst({
      where: { id: parsed.data.id, userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!design) {
      throw new NotFoundError();
    }

    // IA Phase 25 — preserve-by-default reset (CLAUDE.md Madde N).
    // Default: only roll back the USER decision layer. snapshot stays.
    // Opt-in `rerun: true` ⇒ wipe snapshot + enqueue fresh job.
    const rerun = parsed.data.rerun === true;
    if (rerun) {
      // IA-29 — rerun: advisory + score sıfır, status PENDING (operator
      // damga zaten USER → null için NEEDS_REVIEW yok)
      await db.generatedDesign.update({
        where: { id: parsed.data.id },
        data: {
          reviewStatus: ReviewStatus.PENDING,
          reviewStatusSource: ReviewStatusSource.SYSTEM,
          reviewSuggestedStatus: null,
          reviewScore: null,
          reviewProviderRawScore: null,
          reviewSummary: null,
          reviewRiskFlags: Prisma.DbNull,
          textDetected: false,
          gibberishDetected: false,
          reviewedAt: null,
          reviewProviderSnapshot: null,
          reviewPromptSnapshot: null,
        },
      });
    } else {
      // IA-29 — preserve: sadece operatör damgasını geri al; advisory
      // + score + snapshot kalır (CLAUDE.md Madde N).
      await db.generatedDesign.update({
        where: { id: parsed.data.id },
        data: {
          reviewStatus: ReviewStatus.PENDING,
          reviewStatusSource: ReviewStatusSource.SYSTEM,
        },
      });
    }

    let rerunEnqueued = false;
    let rerunError: string | undefined;
    if (rerun) {
      try {
        await enqueueReviewDesign({
          userId: user.id,
          payload: { scope: "design", generatedDesignId: parsed.data.id },
        });
        rerunEnqueued = true;
      } catch (err) {
        rerunError = err instanceof Error ? err.message : String(err);
        logger.error(
          { designId: parsed.data.id, userId: user.id, err: rerunError },
          "review reset: rerun enqueue failed (state reset committed)",
        );
      }
    }

    return NextResponse.json({
      reset: true,
      rerun,
      rerunEnqueued,
      ...(rerunError !== undefined && { rerunError }),
    });
  }

  // scope === "local"
  // IA-30 — productTypeKey resolve sırası:
  //   1. body.productTypeKey (operator/admin override)
  //   2. folderProductTypeMap[asset.folderName] (operator alias)
  //   3. convention: folderName bilinen productType ise onu kullan
  //   4. yoksa rerun yapılamaz (400) — operatöre mapping atamasını söyle
  const asset = await db.localLibraryAsset.findFirst({
    where: {
      id: parsed.data.id,
      userId: user.id,
      deletedAt: null,
      isUserDeleted: false,
    },
    select: { id: true, folderName: true, folderPath: true },
  });
  if (!asset) {
    throw new NotFoundError();
  }
  let resolvedProductTypeKey = parsed.data.productTypeKey ?? null;
  if (!resolvedProductTypeKey) {
    const settings = await getUserLocalLibrarySettings(user.id);
    const folderMap = settings.folderProductTypeMap ?? {};
    // IA-35 — path-based mapping resolution. Aynı isimli farklı
    // path'teki klasörler birbirini etkilemez.
    const r = resolveLocalFolder({
      folderName: asset.folderName,
      folderPath: asset.folderPath,
      folderMap,
    });
    if (r.kind === "mapped") resolvedProductTypeKey = r.productTypeKey;
  }
  // Rerun istenmiyorsa productTypeKey gerekli değil (sadece reset).
  const wantsRerun = parsed.data.rerun === true;
  if (wantsRerun && !resolvedProductTypeKey) {
    throw new ValidationError(
      "Could not resolve productTypeKey for this local asset. Map the folder in Settings → Review → Local library first, or include productTypeKey in the request body.",
    );
  }

  // IA Phase 25 — preserve-by-default reset (local branch).
  const rerun = parsed.data.rerun === true;
  if (rerun) {
    await db.localLibraryAsset.update({
      where: { id: parsed.data.id },
      data: {
        reviewStatus: ReviewStatus.PENDING,
        reviewStatusSource: ReviewStatusSource.SYSTEM,
        reviewSuggestedStatus: null,
        reviewScore: null,
        reviewProviderRawScore: null,
        reviewSummary: null,
        reviewIssues: Prisma.DbNull,
        reviewRiskFlags: Prisma.DbNull,
        reviewedAt: null,
        reviewProviderSnapshot: null,
        reviewPromptSnapshot: null,
      },
    });
  } else {
    await db.localLibraryAsset.update({
      where: { id: parsed.data.id },
      data: {
        reviewStatus: ReviewStatus.PENDING,
        reviewStatusSource: ReviewStatusSource.SYSTEM,
      },
    });
  }

  let rerunEnqueued = false;
  let rerunError: string | undefined;
  if (rerun) {
    try {
      await enqueueReviewDesign({
        userId: user.id,
        payload: {
          scope: "local",
          localAssetId: parsed.data.id,
          // IA-30 — server-resolved (mapping > convention > body override)
          productTypeKey: resolvedProductTypeKey!,
        },
      });
      rerunEnqueued = true;
    } catch (err) {
      rerunError = err instanceof Error ? err.message : String(err);
      logger.error(
        { assetId: parsed.data.id, userId: user.id, err: rerunError },
        "review reset: rerun enqueue failed (state reset committed)",
      );
    }
  }

  return NextResponse.json({
    reset: true,
    rerun,
    rerunEnqueued,
    ...(rerunError !== undefined && { rerunError }),
  });
});
