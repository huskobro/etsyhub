// Pass 84 — Batches list page.
//
// Operatörün son N batch run'ını gösterir. Her satır:
//   - batchId (kısaltılmış, link)
//   - createdAt
//   - templateId / inline (template snapshot preview)
//   - state breakdown (queued/running/completed/failed sayaçları)
//   - "Detail →" link
// Üstte "← MJ Ana Sayfa" + "Batch Run" link.

import Link from "next/link";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { listRecentBatches } from "@/server/services/midjourney/batches";

export const dynamic = "force-dynamic";

export default async function MjBatchesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const batches = await listRecentBatches(session.user.id, 50);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Batch Çalıştırmalar</h1>
          <p className="mt-1 text-sm text-text-muted">
            Pass 80 batch generation çalıştırmalarının kalıcı listesi.
            Pass 84 sonrası her batch&apos;e <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">batchId</code>{" "}
            atanır; jobs <code className="font-mono">Job.metadata.batchId</code>{" "}
            üzerinden gruplanır (schema migration yok).
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/midjourney">
            <Button variant="ghost" size="sm">
              ← MJ Ana Sayfa
            </Button>
          </Link>
          <Link href="/admin/midjourney/templates">
            <Button variant="ghost" size="sm">
              Templates
            </Button>
          </Link>
          <Link href="/admin/midjourney/batch-run">
            <Button variant="primary" size="sm">
              + Yeni Batch Run
            </Button>
          </Link>
        </div>
      </header>

      {batches.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">
            Henüz batch run yok.{" "}
            <Link
              href="/admin/midjourney/batch-run"
              className="text-accent underline"
            >
              İlk batch&apos;i başlat
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <Table>
            <THead>
              <TR>
                <TH>Batch ID</TH>
                <TH>Oluşturulma</TH>
                <TH>Template / Snapshot</TH>
                <TH>Toplam</TH>
                <TH>Completed</TH>
                <TH>Running</TH>
                <TH>Failed</TH>
                <TH className="text-right">Aksiyon</TH>
              </TR>
            </THead>
            <TBody>
              {batches.map((b) => (
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
                      {b.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                    </span>
                  </TD>
                  <TD>
                    {b.templateId ? (
                      <Link
                        href={`/admin/midjourney/templates/${b.templateId}`}
                        className="text-xs text-accent underline"
                      >
                        Template {b.templateId.slice(0, 8)}…
                      </Link>
                    ) : b.promptTemplatePreview ? (
                      <code
                        className="block max-w-md overflow-hidden text-ellipsis whitespace-nowrap rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs"
                        title={b.promptTemplatePreview}
                      >
                        {b.promptTemplatePreview}
                      </code>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </TD>
                  <TD>
                    <code className="font-mono text-xs">
                      {b.counts.total}
                    </code>
                    {b.batchTotal > b.counts.total ? (
                      <span
                        className="ml-1 text-xs text-warning"
                        title={`Beklenen: ${b.batchTotal}, bulunan: ${b.counts.total}`}
                      >
                        (eksik)
                      </span>
                    ) : null}
                  </TD>
                  <TD>
                    {b.counts.completed > 0 ? (
                      <Badge tone="success">{b.counts.completed}</Badge>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </TD>
                  <TD>
                    {b.counts.running + b.counts.queued > 0 ? (
                      <Badge tone="accent">
                        {b.counts.running + b.counts.queued}
                      </Badge>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </TD>
                  <TD>
                    {b.counts.failed > 0 ? (
                      <Badge tone="danger">{b.counts.failed}</Badge>
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
    </div>
  );
}
