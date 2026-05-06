// Pass 40 — Admin /admin/jobs polish:
//   - TR label (Pass 38 dashboard pattern'i admin'e taşındı): JobType +
//     JobStatus tek shared kaynaktan (`@/features/jobs/labels`).
//   - Status filter: searchParams.status ile FAILED/RUNNING/SUCCESS/QUEUED/
//     CANCELLED arasında filtreleme. Filtre chips link tabanlı (Server
//     Component, form yok).
//   - Description metni güncellendi (Phase 1+2 → Phase 9 V1).
//   - title attr raw enum + job id (debug için fare hover).
//   - Bilinmeyen job type → font-mono fallback (forward-compat).
//
// Server component; Pass 39'da Table primitive "use client" olduğu için
// SSR pattern'i artık çalışıyor.

import Link from "next/link";
import { db } from "@/server/db";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import {
  jobTypeLabel,
  JOB_TYPE_LABELS,
  JOB_STATUS_LABELS,
  type JobStatusKey,
} from "@/features/jobs/labels";

function statusToTone(status: string): BadgeTone {
  const s = status.toUpperCase();
  if (s === "SUCCESS" || s === "DONE" || s === "COMPLETED") return "success";
  if (s === "FAILED" || s === "ERROR") return "danger";
  if (s === "RUNNING" || s === "IN_PROGRESS") return "accent";
  // QUEUED, PENDING, CANCELLED ve diğerleri → neutral
  return "neutral";
}

const STATUS_FILTER_KEYS: JobStatusKey[] = [
  "QUEUED",
  "RUNNING",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
];

type SearchParams = { status?: string };

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Status filter — geçersiz değer veya yok → tümü.
  const activeStatus =
    searchParams.status &&
    (STATUS_FILTER_KEYS as string[]).includes(searchParams.status)
      ? (searchParams.status as JobStatusKey)
      : null;

  const jobs = await db.job.findMany({
    where: activeStatus ? { status: activeStatus } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">İşler</h1>
        <p className="text-sm text-text-muted">
          Son 100 job. Türler ve durumlar Türkçeleştirildi; bilinmeyen
          enum&apos;lar mono font ile fallback.
        </p>
      </div>

      {/* Pass 40 — Status filter chips. Server Component pattern; Link tabanlı. */}
      <nav
        aria-label="Status filtresi"
        className="flex flex-wrap items-center gap-2"
      >
        <Link
          href="/admin/jobs"
          aria-pressed={activeStatus === null}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeStatus === null
              ? "bg-text text-bg"
              : "bg-surface-2 text-text-muted hover:bg-surface-muted"
          }`}
        >
          Tümü
        </Link>
        {STATUS_FILTER_KEYS.map((key) => (
          <Link
            key={key}
            href={`/admin/jobs?status=${key}`}
            aria-pressed={activeStatus === key}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeStatus === key
                ? "bg-text text-bg"
                : "bg-surface-2 text-text-muted hover:bg-surface-muted"
            }`}
          >
            {JOB_STATUS_LABELS[key]}
          </Link>
        ))}
      </nav>

      <Table density="admin">
        <THead>
          <TR>
            <TH>Tarih</TH>
            <TH>Kullanıcı</TH>
            <TH>Tür</TH>
            <TH>Durum</TH>
            <TH>İlerleme</TH>
            <TH>Hata</TH>
          </TR>
        </THead>
        <TBody>
          {jobs.length === 0 ? (
            <TR>
              <TD colSpan={6} align="center" muted>
                {activeStatus
                  ? `${JOB_STATUS_LABELS[activeStatus]} durumda job yok.`
                  : "Henüz job yok."}
              </TD>
            </TR>
          ) : (
            jobs.map((j) => {
              const typeLabel = jobTypeLabel(j.type);
              const isUnmappedType = !(j.type in JOB_TYPE_LABELS);
              const statusText =
                (JOB_STATUS_LABELS as Record<string, string>)[j.status] ??
                j.status;
              return (
                <TR key={j.id} title={`${j.type} · ${j.status} · ${j.id}`}>
                  <TD muted className="whitespace-nowrap">
                    {j.createdAt.toLocaleString("tr-TR")}
                  </TD>
                  <TD>{j.user?.email ?? "—"}</TD>
                  <TD className={isUnmappedType ? "font-mono text-xs" : ""}>
                    {typeLabel}
                  </TD>
                  <TD>
                    <Badge tone={statusToTone(j.status)}>{statusText}</Badge>
                  </TD>
                  <TD muted>{j.progress}%</TD>
                  <TD className="max-w-md text-xs text-danger">
                    {j.error ?? "—"}
                  </TD>
                </TR>
              );
            })
          )}
        </TBody>
      </Table>
    </div>
  );
}
