import Link from "next/link";
import { JobStatus } from "@prisma/client";
import { db } from "@/server/db";

export default async function AdminOverviewPage() {
  const [users, activeUsers, flags, themes, jobsRunning, jobsFailed, audits, scraperFlags] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }),
    db.user.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    db.featureFlag.count(),
    db.theme.count(),
    db.job.count({ where: { status: JobStatus.RUNNING } }),
    db.job.count({ where: { status: JobStatus.FAILED } }),
    db.auditLog.count(),
    db.featureFlag.count({ where: { key: { startsWith: "scraper." } } }),
  ]);

  const cards = [
    { label: "Users", value: users, sub: `${activeUsers} active`, href: "/admin/users" },
    { label: "Feature Flags", value: flags, sub: "", href: "/admin/feature-flags" },
    { label: "Themes", value: themes, sub: "", href: "/admin/theme" },
    { label: "Running Jobs", value: jobsRunning, sub: `${jobsFailed} failed`, href: "/admin/jobs" },
    { label: "Audit Records", value: audits, sub: "", href: "/admin/audit-logs" },
    { label: "Scraper Providers", value: scraperFlags, sub: "active + API keys", href: "/admin/scraper-providers" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-text-muted">System status and management screens.</p>
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
