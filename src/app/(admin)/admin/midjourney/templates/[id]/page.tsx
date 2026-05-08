// Pass 81 — MJ Template edit page.
// Pass 85 — Template run history panel eklendi.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import {
  getMjTemplate,
  listMjTemplates,
} from "@/server/services/midjourney/templates";
import { listBatchesByTemplate } from "@/server/services/midjourney/batches";
import { TemplateForm } from "../TemplateForm";

export const dynamic = "force-dynamic";

export default async function MjTemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;
  const tpl = await getMjTemplate(id);
  if (!tpl) notFound();

  // Template'in description / productTypeKey'i list'ten al (getMjTemplate
  // sadece active version'ı dönüyor; full row için listMjTemplates).
  const summaries = await listMjTemplates();
  const summary = summaries.find((s) => s.id === id);

  // Pass 85 — Template run history (bu template ile çalıştırılan batch'ler)
  const runHistory = await listBatchesByTemplate(session.user.id, id, 20);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{tpl.templateName}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-text-muted">
            <Badge tone="accent">v{tpl.version} ACTIVE</Badge>
            {summary?.productTypeKey ? (
              <Badge tone="neutral">{summary.productTypeKey}</Badge>
            ) : null}
            <span className="text-xs">
              {tpl.templateVariables.length} variable
            </span>
          </div>
          {summary?.description ? (
            <p className="mt-1 text-sm text-text-muted">{summary.description}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Link href="/admin/midjourney/templates">
            <Button variant="ghost" size="sm">
              ← Templates
            </Button>
          </Link>
          <Link href={`/admin/midjourney/batch-run?templateId=${id}`}>
            <Button variant="primary" size="sm">
              Batch Run →
            </Button>
          </Link>
        </div>
      </header>

      <TemplateForm
        mode="edit"
        initial={{
          id: tpl.templateId,
          name: tpl.templateName,
          description: summary?.description ?? null,
          productTypeKey: summary?.productTypeKey ?? null,
          promptTemplateText: tpl.promptTemplateText,
        }}
      />

      <div className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Versiyonlama</h2>
        <p className="mt-1 text-xs text-text-muted">
          Yeni version kaydettiğinde, eski ACTIVE version{" "}
          <Badge tone="neutral">ARCHIVED</Badge> olur ve yeni v
          {tpl.version + 1} <Badge tone="accent">ACTIVE</Badge> olur. Eski
          jobs eski version&apos;a bağlı kalır (lineage korundu).
        </p>
      </div>

      {/* Pass 85 — Template run history panel.
          Bu template'in geçmiş batch'leri (Job.metadata.batchTemplateId
          üzerinden filter). Yeni capability açmaz; mevcut batches
          listesini template-scoped gösterir. */}
      <section className="flex flex-col gap-3" data-testid="mj-template-history">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">
            Run history{" "}
            <span className="text-text-muted">({runHistory.length})</span>
          </h2>
          <Link
            href={`/admin/midjourney/batch-run?templateId=${tpl.templateId}`}
            className="text-xs text-accent underline hover:no-underline"
          >
            + Yeni batch run
          </Link>
        </div>
        {runHistory.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-surface p-6 text-center text-sm text-text-muted">
            Bu template ile henüz batch çalıştırılmadı.{" "}
            <Link
              href={`/admin/midjourney/batch-run?templateId=${tpl.templateId}`}
              className="text-accent underline"
            >
              İlk batch&apos;i başlat
            </Link>
            .
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <Table>
              <THead>
                <TR>
                  <TH>Batch ID</TH>
                  <TH>Oluşturulma</TH>
                  <TH>Toplam</TH>
                  <TH>Completed</TH>
                  <TH>Running</TH>
                  <TH>Failed</TH>
                  <TH className="text-right">Aksiyon</TH>
                </TR>
              </THead>
              <TBody>
                {runHistory.map((b) => (
                  <TR key={b.batchId}>
                    <TD>
                      <Link
                        href={`/admin/midjourney/batches/${b.batchId}`}
                        className="font-mono text-xs text-text hover:text-accent"
                      >
                        {b.batchId.slice(0, 12)}…
                      </Link>
                    </TD>
                    <TD>
                      <span className="text-xs text-text-muted">
                        {b.createdAt
                          .toISOString()
                          .slice(0, 19)
                          .replace("T", " ")}
                      </span>
                    </TD>
                    <TD>
                      <code className="font-mono text-xs">
                        {b.counts.total}
                      </code>
                    </TD>
                    <TD>
                      {b.counts.completed > 0 ? (
                        <Badge tone={"success" as BadgeTone}>
                          {b.counts.completed}
                        </Badge>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </TD>
                    <TD>
                      {b.counts.running + b.counts.queued > 0 ? (
                        <Badge tone={"accent" as BadgeTone}>
                          {b.counts.running + b.counts.queued}
                        </Badge>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </TD>
                    <TD>
                      {b.counts.failed > 0 ? (
                        <Badge tone={"danger" as BadgeTone}>
                          {b.counts.failed}
                        </Badge>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </TD>
                    <TD className="text-right">
                      <Link
                        href={`/admin/midjourney/batches/${b.batchId}`}
                      >
                        <Button variant="ghost" size="sm">
                          Detail →
                        </Button>
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
