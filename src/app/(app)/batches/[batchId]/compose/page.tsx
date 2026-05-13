/**
 * Phase 44 — /batches/[batchId]/compose · gerçek launch screen.
 *
 * v4 A6 Create Variations referansını taşıyan batch compose/launch
 * surface'i. Pool card "New Batch" CTA yeni bir Batch yaratıp buraya
 * yönlendirir; operatör burada provider/aspect/count/style ayarlarını
 * yapıp Launch'a basar — gerçek `createVariationJobs` çalışır + batch
 * state DRAFT → QUEUED transition'a girer.
 *
 * v4 A6 yapısı:
 *   - Sol rail: source reference (thumb + title + product type +
 *     resolution + view original)
 *   - Sağ form: Aspect ratio · Similarity · Variation count ·
 *     Prompt template (placeholder) · Reference parameters (advanced)
 *   - Footer: Cancel (ghost) · cost preview (~$X · est. Nm) · primary
 *     "Launch N Variations"
 *
 * v7 d2a/d2b'den şimdilik alınmayanlar (template/prompt management
 * territory, Phase 45+ candidate):
 *   - PromptPreviewSection collapsible disclosure
 *   - "Edit as override" prompt edit
 *
 * Server-side getBatch + user settings (default provider).
 * Cross-user erişim → notFound.
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { getBatch } from "@/features/batches/server/batch-service";
import { getUserAiModeSettings } from "@/features/settings/ai-mode/service";
import { NotFoundError } from "@/lib/errors";
import { BatchComposeClient } from "@/features/batches/components/BatchComposeClient";

export const metadata = { title: "Batch compose · Kivasy" };
export const dynamic = "force-dynamic";

export default async function BatchComposePage({
  params,
}: {
  params: Promise<{ batchId: string }> | { batchId: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { batchId } = await Promise.resolve(params);

  try {
    const [batch, settings] = await Promise.all([
      getBatch({ userId: session.user.id, batchId }),
      getUserAiModeSettings(session.user.id),
    ]);
    return (
      <BatchComposeClient
        batch={batch}
        initialProviderId={settings.defaultImageProvider}
      />
    );
  } catch (err) {
    if (err instanceof NotFoundError) return notFound();
    throw err;
  }
}
