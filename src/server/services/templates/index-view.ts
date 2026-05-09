// R6 — Templates (C1) index aggregator.
//
// `Templates` UI konsepti 4 sub-tip taşır:
//   · Prompt Templates  — Prisma `PromptTemplate` (system-scope, 1 user
//     base'i değil ama PromptTemplate.taskType/providerKind ile filtreli).
//   · Style Presets     — R6'da deferred (Wave D); `Recipe` veya yeni
//     `StylePreset` model'i ileride.
//   · Mockup Templates  — Prisma `MockupTemplate` (3 sınıf gruplu görünür).
//   · Product Recipes   — Prisma `Recipe` (system + user; basit list view).
//
// Bu rollout'ta read-only listing yapılır; yeni model / migration / CRUD
// yok. PromptTemplate.versions[].userPromptTemplate ile expand kullanım
// sayısı için lookup kapsam dışı (R7 sırasında).

import { db } from "@/server/db";
import { getStorage } from "@/providers/storage";
import { logger } from "@/lib/logger";

const MOCKUP_THUMB_TTL_SECONDS = 3600;

// ────────────────────────────────────────────────────────────
// Prompt Templates view
// ────────────────────────────────────────────────────────────

export type PromptTemplateRow = {
  id: string;
  name: string;
  taskType: string;
  providerKind: import("@prisma/client").ProviderKind;
  model: string | null;
  description: string | null;
  updatedAt: string;
  versionCount: number;
  activeVersion: number | null;
};

export async function listPromptTemplatesForView(): Promise<PromptTemplateRow[]> {
  const templates = await db.promptTemplate.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      versions: {
        select: { id: true, version: true, status: true },
      },
    },
  });
  return templates.map((t) => {
    const active = t.versions
      .filter((v) => v.status === "ACTIVE")
      .sort((a, b) => b.version - a.version)[0];
    return {
      id: t.id,
      name: t.name,
      taskType: t.taskType,
      providerKind: t.providerKind,
      model: t.model,
      description: t.description,
      updatedAt: t.updatedAt.toISOString(),
      versionCount: t.versions.length,
      activeVersion: active ? active.version : null,
    };
  });
}

// ────────────────────────────────────────────────────────────
// Mockup Templates view
// ────────────────────────────────────────────────────────────

export type MockupTemplateRow = {
  id: string;
  name: string;
  categoryId: string;
  status: import("@prisma/client").MockupTemplateStatus;
  thumbnailUrl: string | null;
  aspectRatios: string[];
  tags: string[];
  estimatedRenderMs: number;
  updatedAt: string;
};

export async function listMockupTemplatesForView(): Promise<
  MockupTemplateRow[]
> {
  const templates = await db.mockupTemplate.findMany({
    orderBy: { updatedAt: "desc" },
  });
  if (templates.length === 0) return [];

  const storage = getStorage();
  const urlByKey = new Map<string, string>();
  await Promise.all(
    templates.map(async (t) => {
      if (!t.thumbKey) return;
      try {
        const url = await storage.signedUrl(
          t.thumbKey,
          MOCKUP_THUMB_TTL_SECONDS,
        );
        urlByKey.set(t.thumbKey, url);
      } catch (err) {
        logger.warn(
          {
            templateId: t.id,
            err: err instanceof Error ? err.message : String(err),
          },
          "templates c1 mockup thumb signed URL failed",
        );
      }
    }),
  );

  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    categoryId: t.categoryId,
    status: t.status,
    thumbnailUrl: t.thumbKey ? urlByKey.get(t.thumbKey) ?? null : null,
    aspectRatios: t.aspectRatios,
    tags: t.tags,
    estimatedRenderMs: t.estimatedRenderMs,
    updatedAt: t.updatedAt.toISOString(),
  }));
}

// ────────────────────────────────────────────────────────────
// Recipes view
// ────────────────────────────────────────────────────────────

export type RecipeRow = {
  id: string;
  key: string;
  name: string;
  productTypeKey: string | null;
  productTypeDisplay: string | null;
  isSystem: boolean;
  updatedAt: string;
};

export async function listRecipesForView(): Promise<RecipeRow[]> {
  const recipes = await db.recipe.findMany({
    orderBy: { updatedAt: "desc" },
    include: { productType: true },
  });
  return recipes.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    productTypeKey: r.productType?.key ?? null,
    productTypeDisplay: r.productType?.displayName ?? null,
    isSystem: r.isSystem,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

// ────────────────────────────────────────────────────────────
// Aggregate counts (Topbar subtitle)
// ────────────────────────────────────────────────────────────

export type TemplatesCounts = {
  prompts: number;
  presets: number;
  mockups: number;
  recipes: number;
};

export async function getTemplatesCounts(): Promise<TemplatesCounts> {
  const [prompts, mockups, recipes] = await Promise.all([
    db.promptTemplate.count(),
    db.mockupTemplate.count(),
    db.recipe.count(),
  ]);
  return { prompts, presets: 0, mockups, recipes };
}
