// Pass 81 — MJ Template edit page.

import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  getMjTemplate,
  listMjTemplates,
} from "@/server/services/midjourney/templates";
import { TemplateForm } from "../TemplateForm";

export const dynamic = "force-dynamic";

export default async function MjTemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tpl = await getMjTemplate(id);
  if (!tpl) notFound();

  // Template'in description / productTypeKey'i list'ten al (getMjTemplate
  // sadece active version'ı dönüyor; full row için listMjTemplates).
  const summaries = await listMjTemplates();
  const summary = summaries.find((s) => s.id === id);

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
    </div>
  );
}
