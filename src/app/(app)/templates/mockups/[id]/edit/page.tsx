/**
 * Phase 69 — User-facing mockup template edit page.
 *
 * Operatör mevcut bir template'ini açar, safe-area'yı ve ismi günceller,
 * isteğe bağlı archive eder. Bu yüzey "bir kere yarattım, sonra ne olacak?"
 * sorusunu cevaplar.
 *
 * Server-side guards:
 *   - auth() + redirect /login
 *   - Template fetch (cross-user → notFound; global admin template → readonly)
 *
 * Edit form:
 *   - Rename
 *   - Safe-area editor (rect / perspective, Phase 67/68 baseline)
 *   - Reset / sample preview / validity guard (Phase 69 baseline)
 *   - Save (PATCH name + bindingConfig)
 *   - Archive (PATCH status=ARCHIVED)
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { MockupTemplateEditForm } from "@/features/mockups/components/MockupTemplateEditForm";

export const metadata = { title: "Edit mockup template · Kivasy" };
export const dynamic = "force-dynamic";

export default async function EditMockupTemplatePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const template = await db.mockupTemplate.findUnique({
    where: { id: params.id },
    include: { bindings: true },
  });
  if (!template) notFound();
  /* Cross-user / global guard: user yalnız kendi template'ini düzenler.
   * Global (admin) template'ler bu page'den edit edilmez. */
  if (template.userId !== session.user.id) notFound();

  const localBinding = template.bindings.find(
    (b) => b.providerId === "LOCAL_SHARP",
  );
  if (!localBinding) notFound(); // Phase 66 onwards always has one

  return (
    <MockupTemplateEditForm
      templateId={template.id}
      initialName={template.name}
      initialStatus={template.status}
      bindingConfig={
        localBinding.config as unknown as Record<string, unknown>
      }
    />
  );
}
