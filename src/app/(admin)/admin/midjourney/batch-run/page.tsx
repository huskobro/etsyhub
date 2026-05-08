// Pass 81 — Batch Run page.
//
// Operatör akışı:
//   1. Template seç (dropdown — listMjTemplates)
//   2. Variable Sets gir (JSON textarea — array of objects)
//   3. Aspect ratio + diğer generate params
//   4. Preview (ilk variable set ile expand)
//   5. Batch Run → POST /api/admin/midjourney/test-render-batch
//   6. Sonuç: totalSubmitted / totalFailed + her job'a link

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { listMjTemplates } from "@/server/services/midjourney/templates";
import { BatchRunForm } from "./BatchRunForm";

export const dynamic = "force-dynamic";

export default async function BatchRunPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string }>;
}) {
  const sp = await searchParams;
  const templates = await listMjTemplates();
  const preselectedId = sp.templateId;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Batch Run</h1>
          <p className="mt-1 text-sm text-text-muted">
            Bir template + N variable set → N MidjourneyJob (sequential
            enqueue, max 50). Bridge tek tek 10sn aralıklarla işler.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/midjourney/templates">
            <Button variant="ghost" size="sm">
              ← Templates
            </Button>
          </Link>
          <Link href="/admin/midjourney">
            <Button variant="ghost" size="sm">
              MJ Ana Sayfa
            </Button>
          </Link>
        </div>
      </header>

      {templates.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">
            Henüz template yok.{" "}
            <Link
              href="/admin/midjourney/templates/new"
              className="text-accent underline"
            >
              İlk template&apos;i oluştur
            </Link>
            .
          </p>
        </div>
      ) : (
        <BatchRunForm
          templates={templates.map((t) => ({
            id: t.id,
            name: t.name,
            promptTemplateText: t.promptTemplateText ?? "",
            templateVariables: t.templateVariables,
            activeVersion: t.activeVersion,
          }))}
          preselectedTemplateId={preselectedId}
        />
      )}
    </div>
  );
}
