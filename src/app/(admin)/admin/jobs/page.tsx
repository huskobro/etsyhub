import { db } from "@/server/db";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

function statusToTone(status: string): BadgeTone {
  const s = status.toUpperCase();
  if (s === "SUCCESS" || s === "DONE" || s === "COMPLETED") return "success";
  if (s === "FAILED" || s === "ERROR") return "danger";
  if (s === "RUNNING" || s === "IN_PROGRESS") return "accent";
  // QUEUED, PENDING, CANCELLED ve diğerleri → neutral
  return "neutral";
}

export default async function AdminJobsPage() {
  const jobs = await db.job.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">İşler</h1>
        <p className="text-sm text-text-muted">
          Son 100 job. Phase 1+2&apos;de aktif handler: ASSET_INGEST_FROM_URL, GENERATE_THUMBNAIL, BOOKMARK_PREVIEW_METADATA.
        </p>
      </div>
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
                Henüz job yok.
              </TD>
            </TR>
          ) : (
            jobs.map((j) => (
              <TR key={j.id}>
                <TD muted className="whitespace-nowrap">
                  {j.createdAt.toLocaleString("tr-TR")}
                </TD>
                <TD>{j.user?.email ?? "—"}</TD>
                <TD className="font-mono text-xs">{j.type}</TD>
                <TD>
                  <Badge tone={statusToTone(j.status)}>{j.status}</Badge>
                </TD>
                <TD muted>{j.progress}%</TD>
                <TD className="max-w-md text-xs text-danger">{j.error ?? "—"}</TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
    </div>
  );
}
