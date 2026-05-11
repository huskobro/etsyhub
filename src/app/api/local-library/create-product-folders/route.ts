// IA-29 — POST /api/local-library/create-product-folders
//
// Convention helper: rootFolderPath altında her productType için
// klasör (mkdir -p) yaratır. Var olanlar atlanır (idempotent).
// Operatör Settings'te "Create folders" butonuna basınca tetiklenir.

import { NextResponse } from "next/server";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { getUserLocalLibrarySettings } from "@/features/settings/local-library/service";
import { KNOWN_PRODUCT_TYPES } from "@/features/settings/local-library/folder-mapping";

export const POST = withErrorHandling(async () => {
  const user = await requireUser();
  const settings = await getUserLocalLibrarySettings(user.id);
  const rootFolderPath = settings.rootFolderPath;
  if (!rootFolderPath) {
    throw new ValidationError("Save a root folder before creating product folders.");
  }
  // Root mevcut + erişilebilir mi?
  try {
    const st = await stat(rootFolderPath);
    if (!st.isDirectory()) {
      throw new ValidationError(`Root path is not a directory: ${rootFolderPath}`);
    }
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError(
      `Root path not accessible: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const created: string[] = [];
  const existed: string[] = [];
  const failed: Array<{ folder: string; error: string }> = [];

  for (const pt of KNOWN_PRODUCT_TYPES) {
    const target = path.join(rootFolderPath, pt);
    try {
      const st = await stat(target).catch(() => null);
      if (st && st.isDirectory()) {
        existed.push(pt);
        continue;
      }
      await mkdir(target, { recursive: true });
      created.push(pt);
    } catch (err) {
      failed.push({
        folder: pt,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ rootFolderPath, created, existed, failed });
});
