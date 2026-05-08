// Pass 81 — MJ Templates list page.
//
// Persisted MJ template'leri listeler. Her satır:
//   - name + description
//   - active version + variable count
//   - "Düzenle" link → /admin/midjourney/templates/[id]
// Üstte "Yeni Template" butonu + "Batch Run" link.

import Link from "next/link";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { listMjTemplates } from "@/server/services/midjourney/templates";

export const dynamic = "force-dynamic";

export default async function MjTemplatesPage() {
  const templates = await listMjTemplates();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Midjourney Templates</h1>
          <p className="mt-1 text-sm text-text-muted">
            Persisted prompt template&apos;leri.{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">
              {"{{variable}}"}
            </code>{" "}
            syntax&apos;ı kullanılır. Pass 81 V1: template list + create + edit;
            Pass 80 backend (taskType=midjourney_generate).
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/midjourney">
            <Button variant="ghost" size="sm">
              ← MJ Ana Sayfa
            </Button>
          </Link>
          <Link href="/admin/midjourney/batch-run">
            <Button variant="ghost" size="sm">
              Batch Run →
            </Button>
          </Link>
          <Link href="/admin/midjourney/templates/new">
            <Button variant="primary" size="sm">
              + Yeni Template
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
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <Table>
            <THead>
              <TR>
                <TH>Ad</TH>
                <TH>Aktif Version</TH>
                <TH>Variables</TH>
                <TH>Product Type</TH>
                <TH>Güncelleme</TH>
                <TH className="text-right">Aksiyon</TH>
              </TR>
            </THead>
            <TBody>
              {templates.map((tpl) => (
                <TR key={tpl.id}>
                  <TD>
                    <div className="flex flex-col">
                      <Link
                        href={`/admin/midjourney/templates/${tpl.id}`}
                        className="font-medium text-text hover:text-accent"
                      >
                        {tpl.name}
                      </Link>
                      {tpl.description ? (
                        <span className="text-xs text-text-muted">
                          {tpl.description}
                        </span>
                      ) : null}
                    </div>
                  </TD>
                  <TD>
                    {tpl.activeVersion !== null ? (
                      <Badge tone="accent">v{tpl.activeVersion}</Badge>
                    ) : (
                      <Badge tone="warning">no active</Badge>
                    )}
                  </TD>
                  <TD>
                    {tpl.templateVariables.length === 0 ? (
                      <span className="text-xs text-text-muted">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {tpl.templateVariables.slice(0, 6).map((v) => (
                          <code
                            key={v}
                            className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs"
                          >
                            {v}
                          </code>
                        ))}
                        {tpl.templateVariables.length > 6 ? (
                          <span className="text-xs text-text-muted">
                            +{tpl.templateVariables.length - 6}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </TD>
                  <TD>
                    {tpl.productTypeKey ? (
                      <Badge tone="neutral">{tpl.productTypeKey}</Badge>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </TD>
                  <TD>
                    <span className="text-xs text-text-muted">
                      {tpl.updatedAt.toISOString().slice(0, 10)}
                    </span>
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/midjourney/templates/${tpl.id}`}
                      >
                        <Button variant="ghost" size="sm">
                          Düzenle
                        </Button>
                      </Link>
                      <Link
                        href={`/admin/midjourney/batch-run?templateId=${tpl.id}`}
                      >
                        <Button variant="ghost" size="sm">
                          Batch Run
                        </Button>
                      </Link>
                    </div>
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
