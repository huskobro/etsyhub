import Link from "next/link";
import { JobStatus } from "@prisma/client";
import { db } from "@/server/db";

export default async function AdminOverviewPage() {
  const [users, activeUsers, flags, themes, jobsRunning, jobsFailed, audits] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }),
    db.user.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    db.featureFlag.count(),
    db.theme.count(),
    db.job.count({ where: { status: JobStatus.RUNNING } }),
    db.job.count({ where: { status: JobStatus.FAILED } }),
    db.auditLog.count(),
  ]);

  const cards = [
    { label: "Kullanıcılar", value: users, sub: `${activeUsers} aktif`, href: "/admin/users" },
    { label: "Feature Flag", value: flags, sub: "", href: "/admin/feature-flags" },
    { label: "Tema", value: themes, sub: "", href: "/admin/theme" },
    { label: "Çalışan İş", value: jobsRunning, sub: `${jobsFailed} hatalı`, href: "/admin/jobs" },
    { label: "Audit Kaydı", value: audits, sub: "", href: "/admin/audit-logs" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin Paneli</h1>
        <p className="text-sm text-text-muted">Sistem durumu ve yönetim ekranları.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-md border border-border bg-surface p-5 shadow-card hover:bg-surface-muted"
          >
            <div className="text-sm text-text-muted">{c.label}</div>
            <div className="mt-2 text-3xl font-semibold text-text">{c.value}</div>
            {c.sub ? <div className="mt-1 text-xs text-text-muted">{c.sub}</div> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
