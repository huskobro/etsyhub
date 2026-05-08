import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/server/auth";
import { Sidebar } from "@/features/app-shell/Sidebar";
import {
  ActiveTasksPanel,
  type ActiveTask,
} from "@/features/app-shell/ActiveTasksPanel";
import { listRecentBatches } from "@/server/services/midjourney/batches";

/**
 * (app) layout — Kivasy shell. Sidebar (8 items / 2 groups) + main canvas
 * + persistent floating Active Tasks panel.
 *
 * Rollout-3: Active Tasks data is now wired to real running batches via
 * `listRecentBatches`. Each running / awaiting batch becomes a task entry
 * with running-job count out of total. SSE stream + per-job ETA still
 * deferred (rollout-3.5 — unified active-job stream); the current shape
 * is honest enough that the panel reflects production reality.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id: userId, email, role } = session.user;

  const tasks = await loadActiveTasks(userId);
  const totalActive = tasks.length;
  const totalEta = totalActive > 0 ? estimateEta(tasks) : undefined;

  return (
    <div className="flex h-screen w-full bg-bg text-text">
      <Sidebar role={role} email={email} />
      <main className="mx-auto flex w-full max-w-content flex-1 flex-col overflow-auto p-6">
        {children}
      </main>
      <ActiveTasksPanel
        tasks={tasks}
        totalActive={totalActive}
        totalEta={totalEta}
      />
    </div>
  );
}

async function loadActiveTasks(userId: string): Promise<ActiveTask[]> {
  try {
    const batches = await listRecentBatches(userId, 30);
    // Surface batches that are still in motion: running, awaiting, or queued
    // jobs > 0. Sort by createdAt descending (most recent first), max 5.
    const active = batches
      .filter(
        (b) =>
          b.counts.running + b.counts.awaiting + b.counts.queued > 0,
      )
      .slice(0, 5)
      .map((b): ActiveTask => {
        const inFlight =
          b.counts.running + b.counts.awaiting + b.counts.queued;
        const detail = describeBatch(b.counts);
        return {
          id: b.batchId,
          label: b.promptTemplatePreview
            ? truncate(b.promptTemplatePreview, 40)
            : `batch_${b.batchId.slice(0, 8)}`,
          detail,
          done: b.counts.completed,
          total: b.counts.total,
          eta: b.counts.running > 0 ? "running" : undefined,
          href: `/batches/${b.batchId}`,
        };
      });
    return active;
  } catch {
    // Fail closed: empty tasks list. Active Tasks is informational; a query
    // failure shouldn't crash the app shell.
    return [];
  }
}

function describeBatch(counts: {
  running: number;
  awaiting: number;
  queued: number;
  failed: number;
}): string {
  if (counts.running > 0) return `${counts.running} running`;
  if (counts.awaiting > 0) return `${counts.awaiting} awaiting`;
  if (counts.queued > 0) return `${counts.queued} queued`;
  if (counts.failed > 0) return `${counts.failed} failed`;
  return "in flight";
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function estimateEta(tasks: ActiveTask[]): string {
  // Rough heuristic: pending items × ~30s each. SSE-driven real ETA lands
  // when the unified active-job stream comes online (rollout-3.5).
  const pending = tasks.reduce(
    (acc, t) => acc + Math.max(0, t.total - t.done),
    0,
  );
  const seconds = pending * 30;
  if (seconds < 60) return `~${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `~${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `~${hours}h`;
}
