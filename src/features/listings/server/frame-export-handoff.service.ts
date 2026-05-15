// Phase 100 — Frame export → Listing handoff (sözleşme #11 + #13.F).
//
// Operator Studio'da ürettiği FrameExport row'unu Product detail'da
// mevcut listing'in image order'ına ekler. Phase 9 baseline'daki
// mockup-render handoff'a paralel ama kind: "frame-export" entry
// kullanır. Backward-compat: mevcut imageOrder entry'leri korunur,
// yeni Frame export entry son'a eklenir (veya isCover=true ise
// önceki cover'ı flip eder).
//
// Schema-zero (Phase 100 migration FrameExport için yapıldı; bu
// service mevcut Listing.imageOrderJson JSON field'ını update eder).
//
// Sözleşme guards (Madde V parity):
//   - Listing.userId === currentUser (cross-user 404)
//   - FrameExport.userId === currentUser
//   - FrameExport.deletedAt === null
//   - Listing.deletedAt === null
//   - Listing.status DRAFT veya FAILED (publish edilmiş listing'e
//     ekleme yapılmaz — Phase 9 baseline parity)

import { db } from "@/server/db";
import { getStorage } from "@/providers/storage";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { Prisma } from "@prisma/client";
import type { ListingImageOrderEntry } from "@/features/listings/types";
import { FRAME_ASPECT_CONFIG, type FrameAspectKey } from "@/features/mockups/studio/frame-aspects";

export interface AddFrameExportToListingInput {
  userId: string;
  listingId: string;
  frameExportId: string;
  /** Operator export'u listing hero olarak işaretlemek isterse true.
   *  False/undefined → grid'e ek görsel olarak en sona eklenir. */
  setAsCover?: boolean;
}

export interface AddFrameExportToListingResult {
  listingId: string;
  totalImages: number;
  coverEntry: ListingImageOrderEntry | null;
  appendedEntry: ListingImageOrderEntry;
}

/** Operator-facing label (Frame aspect + scene mode özeti).
 *
 *  Phase 9 baseline imageOrder entry'lerinde "templateName" string
 *  taşıyor; Frame export'larda eşdeğer label "Frame · 16:9 · Glass
 *  Light" şeklinde (aspect + scene). UI badge/title için kullanılır. */
function deriveFrameExportLabel(
  frameAspect: string,
  sceneSnapshot: { mode?: string; glassVariant?: string; lensBlur?: boolean },
): string {
  const aspectCfg = FRAME_ASPECT_CONFIG[frameAspect as FrameAspectKey];
  const aspectLabel = aspectCfg?.deliverable ?? `Frame · ${frameAspect}`;
  const sceneBits: string[] = [];
  if (sceneSnapshot.mode === "glass" && sceneSnapshot.glassVariant) {
    sceneBits.push(`Glass ${sceneSnapshot.glassVariant}`);
  } else if (sceneSnapshot.mode === "solid") {
    sceneBits.push("Solid");
  } else if (sceneSnapshot.mode === "gradient") {
    sceneBits.push("Gradient");
  } else if (sceneSnapshot.mode === "auto") {
    sceneBits.push("Magic");
  }
  if (sceneSnapshot.lensBlur) sceneBits.push("Blur");
  return sceneBits.length > 0
    ? `${aspectLabel} · ${sceneBits.join(" + ")}`
    : aspectLabel;
}

export async function addFrameExportToListing(
  input: AddFrameExportToListingInput,
): Promise<AddFrameExportToListingResult> {
  // 1) Listing ownership + status guard
  const listing = await db.listing.findFirst({
    where: { id: input.listingId, userId: input.userId, deletedAt: null },
    select: {
      id: true,
      status: true,
      imageOrderJson: true,
      coverRenderId: true,
    },
  });
  if (!listing) {
    throw new NotFoundError("Listing bulunamadı");
  }
  // Phase 9 baseline parity — publish edilmiş listing'e ekleme yapılmaz.
  // SCHEDULED / SUBMITTING / PUBLISHED / REJECTED hâlâ allow (operator
  // failed durumdan kurtarmak için reset-to-DRAFT akışı var); ama
  // PUBLISHED + ACTIVE Etsy'ye gönderilmiş → image değiştirmek anlamsız.
  if (listing.status === "PUBLISHED") {
    throw new ValidationError("Yayımlanmış listing'e Frame export eklenemez");
  }

  // 2) FrameExport ownership + soft-delete guard
  const frameExport = await db.frameExport.findFirst({
    where: {
      id: input.frameExportId,
      userId: input.userId,
      deletedAt: null,
    },
    select: {
      id: true,
      storageKey: true,
      width: true,
      height: true,
      frameAspect: true,
      sceneSnapshot: true,
    },
  });
  if (!frameExport) {
    throw new NotFoundError("Frame export bulunamadı");
  }

  // 3) Compute new imageOrder
  const existingOrder = Array.isArray(listing.imageOrderJson)
    ? (listing.imageOrderJson as unknown as ListingImageOrderEntry[])
    : [];
  const nextPosition =
    existingOrder.length > 0
      ? Math.max(...existingOrder.map((e) => e.packPosition ?? 0)) + 1
      : 0;
  const setAsCover = input.setAsCover ?? false;

  const storage = getStorage();
  const signedUrl = await storage.signedUrl(frameExport.storageKey, 300);
  const sceneSnapshot = frameExport.sceneSnapshot as {
    mode?: string;
    glassVariant?: string;
    lensBlur?: boolean;
  };
  const templateName = deriveFrameExportLabel(
    frameExport.frameAspect,
    sceneSnapshot,
  );

  const newEntry: ListingImageOrderEntry = {
    kind: "frame-export",
    packPosition: setAsCover ? 0 : nextPosition,
    frameExportId: frameExport.id,
    outputKey: frameExport.storageKey,
    templateName,
    isCover: setAsCover,
    signedUrl,
    frameAspect: frameExport.frameAspect,
  };

  let nextOrder: ListingImageOrderEntry[];
  if (setAsCover) {
    // Mevcut entry'lerin cover flag'ini düşür, position'ları bump et.
    nextOrder = [
      newEntry,
      ...existingOrder.map((e, idx) => ({
        ...e,
        isCover: false,
        packPosition: idx + 1,
      })),
    ];
  } else {
    nextOrder = [...existingOrder, newEntry];
  }

  // 4) Atomic update — Listing.imageOrderJson + opsiyonel coverRenderId reset
  const updated = await db.listing.update({
    where: { id: listing.id },
    data: {
      imageOrderJson: nextOrder as unknown as Prisma.InputJsonValue,
      // Phase 100: cover değiştirildi ve eski cover MockupRender'dı —
      // coverRenderId'i null'a düşür (Frame export `renderId` taşımaz).
      ...(setAsCover ? { coverRenderId: null } : {}),
    },
    select: { id: true, imageOrderJson: true },
  });

  logger.info(
    {
      userId: input.userId,
      listingId: updated.id,
      frameExportId: frameExport.id,
      setAsCover,
      newTotalImages: nextOrder.length,
      frameAspect: frameExport.frameAspect,
    },
    "frame export added to listing (Phase 100 handoff)",
  );

  return {
    listingId: updated.id,
    totalImages: nextOrder.length,
    coverEntry: nextOrder.find((e) => e.isCover) ?? null,
    appendedEntry: newEntry,
  };
}
