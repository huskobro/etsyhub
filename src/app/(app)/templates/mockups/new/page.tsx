/**
 * Phase 66 — User-facing mockup template create page.
 *
 * Templated.io clone first end-to-end UI slice. Operator buradan kendi
 * MockupTemplate'ini oluşturabilir; create flow şu zinciri çalıştırır:
 *   1. POST /api/mockup-templates (Phase 65) → DRAFT template create
 *      (userId server-side hard set)
 *   2. POST /api/mockup-templates/[id]/bindings (Phase 66) → LOCAL_SHARP
 *      binding create (rect safe-area, full-canvas default)
 *   3. (opsiyonel) PATCH /api/mockup-templates/[id] (Phase 66) → DRAFT
 *      → ACTIVE publish
 *
 * Asset upload UI Phase 67+ candidate. V1 (Phase 66): operator placeholder
 * thumb key girer (örn. "user-templates/{currentUser}/sample.png" — MinIO
 * upload UI henüz yok). Render edilebilir minimum config: 1024×1024 base
 * dimensions + full-canvas rect safe-area + normal blend recipe.
 *
 * Auth: server-side guard via auth() + redirect /login.
 */

import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { MockupTemplateCreateForm } from "@/features/mockups/components/MockupTemplateCreateForm";

export const metadata = { title: "New mockup template · Kivasy" };
export const dynamic = "force-dynamic";

export default async function NewMockupTemplatePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <MockupTemplateCreateForm />;
}
