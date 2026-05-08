// Pass 84 — Batch detail page.
//
// Bir batch'e ait tüm jobs + state breakdown + per-job link.
// /admin/midjourney/batches/[batchId]

import Link from "next/link";
import { auth } from "@/server/auth";
import { notFound, redirect } from "next/navigation";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getBatchSummary } from "@/server/services/midjourney/batches";
import { RetryFailedButton } from "./RetryFailedButton";

export const dynamic = "force-dynamic";

function stateTone(state: string | null): BadgeTone {
  if (!state) return "neutral";
  if (state === "COMPLETED") return "success";
  if (state === "FAILED" || state === "CANCELLED") return "danger";
  if (state === "AWAITING_LOGIN" || state === "AWAITING_CHALLENGE") return "warning";
  if (state === "QUEUED") return "neutral";
  return "accent";
}

const STATE_LABELS: Record<string, string> = {
  QUEUED: "Sırada",
  OPENING_BROWSER: "Browser açılıyor",
  AWAITING_LOGIN: "Login bekleniyor",
  AWAITING_CHALLENGE: "Doğrulama bekleniyor",
  SUBMITTING_PROMPT: "Prompt gönderiliyor",
  WAITING_FOR_RENDER: "Render bekleniyor",
  COLLECTING_OUTPUTS: "Çıktılar toplanıyor",
  DOWNLOADING: "İndiriliyor",
  IMPORTING: "İçeri alınıyor",
  COMPLETED: "Tamamlandı",
  FAILED: "Başarısız",
  CANCELLED: "İptal",
};

export default async function MjBatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { batchId } = await params;
  const summary = await getBatchSummary(batchId, session.user.id);
  if (!summary) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">
            Batch{" "}
            <code className="font-mono text-base">
              {summary.batchId.slice(0, 12)}…
            </code>
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-muted">
            <span>
              {summary.createdAt.toISOString().slice(0, 19).replace("T", " ")}
            </span>
            {summary.templateId ? (
              <Link
                href={`/admin/midjourney/templates/${summary.templateId}`}
                className="text-accent underline"
              >
                Template {summary.templateId.slice(0, 8)}…
              </Link>
            ) : null}
            {/* Pass 86 — Retry lineage badge. Bu batch bir retry ise
                kaynak batch'a link. */}
            {summary.retryOfBatchId ? (
              <span className="inline-flex items-center gap-1 rounded border border-warning bg-warning-soft px-1.5 py-0.5 text-xs">
                <span className="font-semibold">↻ Retry of</span>
                <Link
                  href={`/admin/midjourney/batches/${summary.retryOfBatchId}`}
                  className="font-mono underline"
                  data-testid="mj-batch-retry-source-link"
                >
                  {summary.retryOfBatchId.slice(0, 12)}…
                </Link>
              </span>
            ) : null}
          </div>
          {summary.promptTemplate ? (
            <div className="mt-2 rounded-md border border-border bg-surface-2 p-2">
              <span className="text-xs font-semibold text-text-muted">
                Template metni
              </span>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-xs">
                {summary.promptTemplate}
              </pre>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <Link href="/admin/midjourney/batches">
              <Button variant="ghost" size="sm">
                ← Batches
              </Button>
            </Link>
            <Link href={`/admin/midjourney?batchId=${summary.batchId}`}>
              <Button variant="ghost" size="sm">
                Job listesinde aç →
              </Button>
            </Link>
            {/* Pass 88 — Library entry: bu batch'in tüm asset'leri */}
            <Link
              href={`/admin/midjourney/library?batchId=${summary.batchId}&days=all`}
            >
              <Button variant="ghost" size="sm">
                Library&apos;de aç →
              </Button>
            </Link>
            <Link href="/admin/midjourney">
              <Button variant="ghost" size="sm">
                MJ Ana Sayfa
              </Button>
            </Link>
          </div>
          {/* Pass 86 — Retry Failed Only V1. failedCount=0 ise disabled.
              Click → confirm → POST → yeni batch detail page. */}
          <RetryFailedButton
            batchId={summary.batchId}
            failedCount={summary.counts.failed}
          />
        </div>
      </header>

      {/* Counts panel */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <CountTile label="Toplam" value={summary.counts.total} />
        <CountTile label="Sırada" value={summary.counts.queued} tone="neutral" />
        <CountTile label="Çalışıyor" value={summary.counts.running} tone="accent" />
        <CountTile label="Tamamlandı" value={summary.counts.completed} tone="success" />
        <CountTile label="Başarısız" value={summary.counts.failed} tone="danger" />
        <CountTile label="İptal" value={summary.counts.cancelled} />
        <CountTile
          label="Bekleyen"
          value={summary.counts.awaiting}
          tone="warning"
        />
      </div>

      {/* Jobs table */}
      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <Table>
          <THead>
            <TR>
              <TH className="w-12">#</TH>
              <TH>Durum</TH>
              <TH>Expanded Prompt</TH>
              <TH>Variables</TH>
              <TH>Asset</TH>
              <TH>MJ Job</TH>
              <TH className="text-right">Aksiyon</TH>
            </TR>
          </THead>
          <TBody>
            {summary.jobs.map((j) => (
              <TR key={j.jobId}>
                <TD>
                  <code className="font-mono text-xs">{j.batchIndex}</code>
                </TD>
                <TD>
                  <Badge tone={stateTone(j.state)}>
                    {j.state ? STATE_LABELS[j.state] ?? j.state : "—"}
                  </Badge>
                  {j.blockReason ? (
                    <div
                      className="mt-1 text-xs text-danger"
                      title={j.failedReason ?? undefined}
                    >
                      {j.blockReason}
                    </div>
                  ) : null}
                </TD>
                <TD>
                  {j.expandedPrompt ? (
                    <code
                      className="block max-w-md overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs"
                      title={j.expandedPrompt}
                    >
                      {j.expandedPrompt}
                    </code>
                  ) : (
                    <span className="text-xs text-text-muted">—</span>
                  )}
                </TD>
                <TD>
                  {j.variables ? (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(j.variables)
                        .slice(0, 3)
                        .map(([k, v]) => (
                          <code
                            key={k}
                            className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs"
                            title={`${k}=${v}`}
                          >
                            {k}: {v.slice(0, 16)}
                            {v.length > 16 ? "…" : ""}
                          </code>
                        ))}
                      {Object.keys(j.variables).length > 3 ? (
                        <span className="text-xs text-text-muted">
                          +{Object.keys(j.variables).length - 3}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-text-muted">—</span>
                  )}
                </TD>
                <TD>
                  {j.assetCount > 0 ? (
                    <Badge tone="success">{j.assetCount}</Badge>
                  ) : (
                    <span className="text-xs text-text-muted">—</span>
                  )}
                </TD>
                <TD>
                  {j.mjJobId ? (
                    <code
                      className="font-mono text-xs"
                      title={j.mjJobId}
                    >
                      {j.mjJobId.slice(0, 10)}…
                    </code>
                  ) : (
                    <span className="text-xs text-text-muted">—</span>
                  )}
                </TD>
                <TD className="text-right">
                  {j.midjourneyJobId ? (
                    <Link
                      href={`/admin/midjourney/${j.midjourneyJobId}`}
                    >
                      <Button variant="ghost" size="sm">
                        Job →
                      </Button>
                    </Link>
                  ) : (
                    <span className="text-xs text-text-muted">—</span>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}

function CountTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: BadgeTone;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        {tone && value > 0 ? <Badge tone={tone}>{value}</Badge> : value}
      </div>
    </div>
  );
}
