// R7 — Style Presets via Recipe.config discriminator.
//
// Yeni model AÇMAYIZ — `Recipe` zaten generic config (Json) taşıyor.
// Style preset'ler `Recipe.config = { kind: "style-preset", ... }`
// discriminator ile saklanır. Recipes (productTypeId set olanlar) ile
// karışmaz çünkü `Recipe.key` namespace'li (`style:<slug>`).
//
// Schema değişikliği YOK; A6 / Batches akışları ileride bu preset'leri
// `style:<slug>` anahtarıyla bulup config'i okuyacak.

import { db } from "@/server/db";

const STYLE_KEY_PREFIX = "style:";

export type StylePresetConfig = {
  kind: "style-preset";
  aspect: "square" | "portrait" | "landscape" | "multi";
  similarity: "subtle" | "medium" | "heavy";
  palette: string;
  weight: string;
  notes?: string;
};

export type StylePresetRow = {
  id: string;
  key: string;
  name: string;
  aspect: StylePresetConfig["aspect"];
  similarity: StylePresetConfig["similarity"];
  palette: string;
  weight: string;
  notes: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};

function isStylePreset(c: unknown): c is StylePresetConfig {
  if (!c || typeof c !== "object") return false;
  const obj = c as Record<string, unknown>;
  return obj.kind === "style-preset";
}

function safeKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function listStylePresets(): Promise<StylePresetRow[]> {
  const rows = await db.recipe.findMany({
    where: { key: { startsWith: STYLE_KEY_PREFIX } },
    orderBy: { updatedAt: "desc" },
  });
  return rows
    .filter((r) => isStylePreset(r.config))
    .map((r) => {
      const c = r.config as unknown as StylePresetConfig;
      return {
        id: r.id,
        key: r.key,
        name: r.name,
        aspect: c.aspect,
        similarity: c.similarity,
        palette: c.palette,
        weight: c.weight,
        notes: c.notes ?? null,
        isSystem: r.isSystem,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    });
}

export type CreateStylePresetInput = {
  name: string;
  aspect: StylePresetConfig["aspect"];
  similarity: StylePresetConfig["similarity"];
  palette: string;
  weight: string;
  notes?: string;
};

export async function createStylePreset(
  input: CreateStylePresetInput,
): Promise<StylePresetRow> {
  const slug = safeKey(input.name);
  if (!slug) throw new Error("Geçersiz preset adı");
  const key = `${STYLE_KEY_PREFIX}${slug}`;

  // Idempotent: aynı key varsa update; yoksa create.
  const existing = await db.recipe.findUnique({ where: { key } });
  const config: StylePresetConfig = {
    kind: "style-preset",
    aspect: input.aspect,
    similarity: input.similarity,
    palette: input.palette.trim(),
    weight: input.weight.trim(),
    notes: input.notes?.trim() || undefined,
  };
  const row = existing
    ? await db.recipe.update({
        where: { id: existing.id },
        data: { name: input.name, config: config as unknown as object },
      })
    : await db.recipe.create({
        data: {
          key,
          name: input.name.trim(),
          config: config as unknown as object,
          isSystem: false,
        },
      });

  const c = row.config as unknown as StylePresetConfig;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    aspect: c.aspect,
    similarity: c.similarity,
    palette: c.palette,
    weight: c.weight,
    notes: c.notes ?? null,
    isSystem: row.isSystem,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
