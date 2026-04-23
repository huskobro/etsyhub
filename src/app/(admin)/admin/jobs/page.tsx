import { db } from "@/server/db";

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
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Tarih</th>
              <th className="px-4 py-2 text-left font-medium">Kullanıcı</th>
              <th className="px-4 py-2 text-left font-medium">Tür</th>
              <th className="px-4 py-2 text-left font-medium">Durum</th>
              <th className="px-4 py-2 text-left font-medium">İlerleme</th>
              <th className="px-4 py-2 text-left font-medium">Hata</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-muted">
                  Henüz job yok.
                </td>
              </tr>
            ) : (
              jobs.map((j) => (
                <tr key={j.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-4 py-2 text-text-muted">
                    {j.createdAt.toLocaleString("tr-TR")}
                  </td>
                  <td className="px-4 py-2 text-text">{j.user?.email ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs text-text">{j.type}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs text-text-muted">
                      {j.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-text-muted">{j.progress}%</td>
                  <td className="max-w-md px-4 py-2 text-xs text-danger">{j.error ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
