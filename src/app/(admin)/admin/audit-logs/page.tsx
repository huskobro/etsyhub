import { db } from "@/server/db";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";

export default async function AdminAuditLogsPage() {
  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <p className="text-sm text-text-muted">
          Son 200 kayıt. Filtreli API: /api/admin/audit-logs?action=...&actor=...
        </p>
      </div>
      <Table density="admin">
        <THead>
          <TR>
            <TH>Tarih</TH>
            <TH>Aktör</TH>
            <TH>Eylem</TH>
            <TH>Hedef</TH>
            <TH>Metadata</TH>
          </TR>
        </THead>
        <TBody>
          {logs.length === 0 ? (
            <TR>
              <TD colSpan={5} align="center" muted>
                Henüz kayıt yok.
              </TD>
            </TR>
          ) : (
            logs.map((l) => (
              <TR key={l.id} className="align-top">
                <TD muted className="whitespace-nowrap">
                  {l.createdAt.toLocaleString("tr-TR")}
                </TD>
                <TD>{l.actor}</TD>
                <TD className="font-mono text-xs">{l.action}</TD>
                <TD muted>
                  {l.targetType ? `${l.targetType}:${l.targetId ?? "-"}` : "—"}
                </TD>
                <TD muted className="max-w-md text-xs">
                  {l.metadata ? (
                    <pre className="overflow-x-auto">{JSON.stringify(l.metadata, null, 0)}</pre>
                  ) : (
                    "—"
                  )}
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
    </div>
  );
}
