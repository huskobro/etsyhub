// R8 — Recipes service.
//
// `Recipe` model'ini iki kullanım için tutar:
//   · `Recipe.config = { kind: "style-preset", ... }` — R7'de eklendi
//     (style-presets.service.ts namespace `style:<slug>`).
//   · `Recipe.config = { kind: "recipe-chain", links: {...}, settings: {...} }`
//     — R8 recipe-chain discriminator. Reusable üretim zinciri.
//
// Schema migration YOK; Recipe.config (Json) yeterli. Recipe.key namespace
// `recipe:<slug>` (style preset'lerden ayrılır).

import { db } from "@/server/db";

const RECIPE_KEY_PREFIX = "recipe:";

export type RecipeChainConfig = {
  kind: "recipe-chain";
  /** Bağlı bileşenler — opsiyonel; eksik linkler "operatör seçecek" anlamı taşır. */
  links: {
    promptTemplateId?: string | null;
    stylePresetKey?: string | null;
    mockupTemplateId?: string | null;
    productTypeKey?: string | null;
  };
  /** Run-time defaults — count, similarity, aspect ratio override vb. */
  settings: {
    variationCount?: number;
    aspectRatio?: "square" | "portrait" | "landscape";
    similarity?: "subtle" | "medium" | "heavy";
    notes?: string;
  };
};

function isRecipeChain(c: unknown): c is RecipeChainConfig {
  if (!c || typeof c !== "object") return false;
  return (c as Record<string, unknown>).kind === "recipe-chain";
}

export type RecipeChainRow = {
  id: string;
  key: string;
  name: string;
  productTypeKey: string | null;
  productTypeDisplay: string | null;
  isSystem: boolean;
  links: RecipeChainConfig["links"];
  settings: RecipeChainConfig["settings"];
  updatedAt: string;
};

export async function listRecipeChains(): Promise<RecipeChainRow[]> {
  const rows = await db.recipe.findMany({
    where: { key: { startsWith: RECIPE_KEY_PREFIX } },
    orderBy: { updatedAt: "desc" },
    include: { productType: true },
  });
  return rows
    .filter((r) => isRecipeChain(r.config))
    .map((r) => {
      const c = r.config as unknown as RecipeChainConfig;
      return {
        id: r.id,
        key: r.key,
        name: r.name,
        productTypeKey: r.productType?.key ?? null,
        productTypeDisplay: r.productType?.displayName ?? null,
        isSystem: r.isSystem,
        links: c.links ?? {},
        settings: c.settings ?? {},
        updatedAt: r.updatedAt.toISOString(),
      };
    });
}

export async function getRecipeChainById(
  recipeId: string,
): Promise<RecipeChainRow | null> {
  const r = await db.recipe.findUnique({
    where: { id: recipeId },
    include: { productType: true },
  });
  if (!r || !isRecipeChain(r.config)) return null;
  const c = r.config as unknown as RecipeChainConfig;
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    productTypeKey: r.productType?.key ?? null,
    productTypeDisplay: r.productType?.displayName ?? null,
    isSystem: r.isSystem,
    links: c.links ?? {},
    settings: c.settings ?? {},
    updatedAt: r.updatedAt.toISOString(),
  };
}

export type RunRecipeChainInput = {
  recipeId: string;
  /** Operatör override — bu run için eksik linkleri tamamlar. */
  overrides?: Partial<RecipeChainConfig["links"]> & {
    referenceId?: string;
    variationCount?: number;
  };
};

export type RunRecipeChainResult = {
  /** Run handoff hedefi: operatör hangi sayfaya yönlendirilecek. */
  destination:
    | { kind: "batch-run"; promptTemplateId: string; productTypeKey: string | null }
    | { kind: "selections-create"; productTypeKey: string | null }
    | { kind: "no-destination"; reason: string };
  /** Run kaydı için audit metadata. */
  audit: {
    recipeId: string;
    recipeKey: string;
    recipeName: string;
    chosenLinks: RecipeChainConfig["links"];
  };
};

/**
 * Recipe run'ın "doğru sıradaki adım"ını hesaplar.
 *
 * R8'de tam orchestration engine yazmıyoruz; recipe run = "operatörü doğru
 * production page'ine yönlendir + audit". Linklerden hangisinin
 * konfigüre edildiğine göre destination seçilir:
 *   · promptTemplateId varsa → /admin/midjourney/batch-run (mevcut batch
 *     starter sayfası); UI bu link'i recipe payload'ı ile expand eder.
 *   · sadece productTypeKey varsa → /selections/new (operatör selection
 *     başlatır)
 *   · hiçbir link yoksa → no-destination
 */
export async function planRecipeChainRun(
  input: RunRecipeChainInput,
): Promise<RunRecipeChainResult> {
  const recipe = await getRecipeChainById(input.recipeId);
  if (!recipe) {
    throw new Error("Recipe bulunamadı veya kind=recipe-chain değil");
  }

  const links: RecipeChainConfig["links"] = {
    ...recipe.links,
    ...(input.overrides ?? {}),
  };

  if (links.promptTemplateId) {
    return {
      destination: {
        kind: "batch-run",
        promptTemplateId: links.promptTemplateId,
        productTypeKey: links.productTypeKey ?? null,
      },
      audit: {
        recipeId: recipe.id,
        recipeKey: recipe.key,
        recipeName: recipe.name,
        chosenLinks: links,
      },
    };
  }

  if (links.productTypeKey) {
    return {
      destination: {
        kind: "selections-create",
        productTypeKey: links.productTypeKey,
      },
      audit: {
        recipeId: recipe.id,
        recipeKey: recipe.key,
        recipeName: recipe.name,
        chosenLinks: links,
      },
    };
  }

  return {
    destination: {
      kind: "no-destination",
      reason: "Recipe linki yok — prompt template veya product type bağla",
    },
    audit: {
      recipeId: recipe.id,
      recipeKey: recipe.key,
      recipeName: recipe.name,
      chosenLinks: links,
    },
  };
}

function safeKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export type CreateRecipeChainInput = {
  name: string;
  productTypeId?: string | null;
  links: RecipeChainConfig["links"];
  settings?: RecipeChainConfig["settings"];
};

export async function createRecipeChain(
  input: CreateRecipeChainInput,
): Promise<RecipeChainRow> {
  const slug = safeKey(input.name);
  if (!slug) throw new Error("Geçersiz recipe adı");
  const key = `${RECIPE_KEY_PREFIX}${slug}`;
  const config: RecipeChainConfig = {
    kind: "recipe-chain",
    links: input.links,
    settings: input.settings ?? {},
  };
  const existing = await db.recipe.findUnique({ where: { key } });
  const row = existing
    ? await db.recipe.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          productTypeId: input.productTypeId ?? null,
          config: config as unknown as object,
        },
        include: { productType: true },
      })
    : await db.recipe.create({
        data: {
          key,
          name: input.name.trim(),
          productTypeId: input.productTypeId ?? null,
          config: config as unknown as object,
          isSystem: false,
        },
        include: { productType: true },
      });
  const c = row.config as unknown as RecipeChainConfig;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    productTypeKey: row.productType?.key ?? null,
    productTypeDisplay: row.productType?.displayName ?? null,
    isSystem: row.isSystem,
    links: c.links ?? {},
    settings: c.settings ?? {},
    updatedAt: row.updatedAt.toISOString(),
  };
}
