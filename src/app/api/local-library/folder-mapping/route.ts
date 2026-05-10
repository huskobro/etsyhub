// IA-29 (CLAUDE.md Madde V) — Convention-based folder → productType.
//
// GET → tüm klasörleri grupla:
//   • known: convention ile productType'a eşleşmiş klasörler
//     (örn. `clipart/`, `wall_art/`)
//   • alias: operatörün manuel mapping yazdığı klasörler
//     (örn. `wallart` → `wall_art`)
//   • ignored: __ignore__ sentinel
//   • pending: bilinmeyen klasör — operatör seçim yapacak
//
// PUT → tek klasör için karar yaz:
//   { folderKey, productTypeKey: PT|"__ignore__"|null }
//   null → mapping sil (alias kaldırılır; convention varsa o devreye girer)
//
// POST → "move folder" — operatör "ekmek" klasörünü "wall_art"e taşımak
// isteyebilir; bu filesystem move + DB update gerektirir. Şimdilik
// alias yazımı ile çözüyoruz (operator FS'i kendi düzenler veya alias
// yeterli). Move action follow-up.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { db } from "@/server/db";
import {
  getUserLocalLibrarySettings,
  updateUserLocalLibrarySettings,
} from "@/features/settings/local-library/service";
import {
  resolveLocalFolder,
  IGNORE_FOLDER_SENTINEL,
  KNOWN_PRODUCT_TYPES,
} from "@/features/settings/local-library/folder-mapping";

export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const settings = await getUserLocalLibrarySettings(user.id);
  const folderMap = settings.folderProductTypeMap ?? {};

  const grouped = await db.localLibraryAsset.groupBy({
    by: ["folderName", "folderPath"],
    where: { userId: user.id, deletedAt: null, isUserDeleted: false },
    _count: { id: true },
  });

  const folders = grouped.map((g) => {
    const r = resolveLocalFolder({ folderName: g.folderName, folderMap });
    if (r.kind === "mapped") {
      return {
        folderName: g.folderName,
        folderPath: g.folderPath,
        assetCount: g._count.id,
        status: r.reason === "convention" ? "convention" : "alias",
        productTypeKey: r.productTypeKey,
      } as const;
    }
    if (r.kind === "ignored") {
      return {
        folderName: g.folderName,
        folderPath: g.folderPath,
        assetCount: g._count.id,
        status: "ignored",
        productTypeKey: null,
      } as const;
    }
    return {
      folderName: g.folderName,
      folderPath: g.folderPath,
      assetCount: g._count.id,
      status: "pending",
      productTypeKey: null,
    } as const;
  });

  // Order: pending first (operator action), then convention/alias, then ignored
  const order = { pending: 0, convention: 1, alias: 2, ignored: 3 } as const;
  folders.sort((a, b) => {
    const ao = order[a.status];
    const bo = order[b.status];
    if (ao !== bo) return ao - bo;
    return a.folderName.localeCompare(b.folderName);
  });

  return NextResponse.json({
    folders,
    summary: {
      total: folders.length,
      pending: folders.filter((f) => f.status === "pending").length,
      convention: folders.filter((f) => f.status === "convention").length,
      alias: folders.filter((f) => f.status === "alias").length,
      ignored: folders.filter((f) => f.status === "ignored").length,
    },
    knownProductTypes: KNOWN_PRODUCT_TYPES,
  });
});

const PutSchema = z.object({
  folderKey: z.string().min(1).max(1024),
  productTypeKey: z
    .enum([...KNOWN_PRODUCT_TYPES, IGNORE_FOLDER_SENTINEL])
    .nullable(),
});

export const PUT = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const json = await req.json().catch(() => null);
  const parsed = PutSchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError("Invalid mapping payload", parsed.error.flatten());
  }
  const settings = await getUserLocalLibrarySettings(user.id);
  const next = { ...(settings.folderProductTypeMap ?? {}) };
  if (parsed.data.productTypeKey === null) {
    delete next[parsed.data.folderKey];
  } else {
    next[parsed.data.folderKey] = parsed.data.productTypeKey;
  }
  const updated = await updateUserLocalLibrarySettings(user.id, {
    ...settings,
    folderProductTypeMap: next,
  });
  return NextResponse.json({ settings: updated });
});
