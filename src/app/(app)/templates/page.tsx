import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import {
  listPromptTemplatesForView,
  listMockupTemplatesForView,
  listRecipesForView,
  getTemplatesCounts,
} from "@/server/services/templates/index-view";
import { TemplatesIndexClient } from "@/features/templates/components/TemplatesIndexClient";

/**
 * /templates — Kivasy C1 Templates surface (rollout-6).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v6/screens-c1.jsx →
 * C1Templates.
 *
 * 4 sub-types in one route (no detail pages — sub-types are filterable
 * categories per v6 §C1):
 *   - Prompt Templates (Prisma `PromptTemplate`)
 *   - Style Presets (R7 deferred — schema not yet defined)
 *   - Mockup Templates (Prisma `MockupTemplate`, 3 sınıf gruplu)
 *   - Product Recipes (Prisma `Recipe`)
 *
 * R6 ships read-only listing. CRUD (New Template / Upload PSD / Import
 * recipe / Run recipe / Edit) lands in R7+.
 *
 * Boundary discipline (CLAUDE.md):
 *   Templates = system surface — production flows (Batches / Variations /
 *   Apply Mockups / Listing Builder) consume from it but Templates does
 *   not own those flows.
 */

export const metadata = { title: "Templates · Kivasy" };
export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";

  const [counts, prompts, mockups, recipes] = await Promise.all([
    getTemplatesCounts(),
    listPromptTemplatesForView(),
    listMockupTemplatesForView(),
    listRecipesForView(),
  ]);

  return (
    <TemplatesIndexClient
      counts={counts}
      prompts={prompts}
      mockups={mockups}
      recipes={recipes}
      isAdmin={isAdmin}
    />
  );
}
