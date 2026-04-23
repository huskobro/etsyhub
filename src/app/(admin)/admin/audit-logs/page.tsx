import { db } from "@/server/db";

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
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Tarih</th>
              <th className="px-4 py-2 text-left font-medium">Aktör</th>
              <th className="px-4 py-2 text-left font-medium">Eylem</th>
              <th className="px-4 py-2 text-left font-medium">Hedef</th>
              <th className="px-4 py-2 text-left font-medium">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-text-muted">
                  Henüz kayıt yok.
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-text-muted">
                    {l.createdAt.toLocaleString("tr-TR")}
                  </td>
                  <td className="px-4 py-2 text-text">{l.actor}</td>
                  <td className="px-4 py-2 font-mono text-xs text-text">{l.action}</td>
                  <td className="px-4 py-2 text-text-muted">
                    {l.targetType ? `${l.targetType}:${l.targetId ?? "-"}` : "—"}
                  </td>
                  <td className="max-w-md px-4 py-2 text-xs text-text-muted">
                    {l.metadata ? (
                      <pre className="overflow-x-auto">{JSON.stringify(l.metadata, null, 0)}</pre>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
