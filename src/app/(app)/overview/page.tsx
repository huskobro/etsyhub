// R11.14 — Overview C3 server entry. Real-data 4-block view.
//
// Source: docs/design-system/kivasy/ui_kits/kivasy/v6/screens-c3.jsx
// → C3Overview.

import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import {
  getPipelinePulse,
  getPendingActions,
  getActiveBatches,
  getRecentActivity,
} from "@/server/services/overview";
import { OverviewClient } from "@/features/overview/components/OverviewClient";

export const metadata = { title: "Overview · Kivasy" };
export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [pipeline, pending, activeBatches, recentActivity] = await Promise.all([
    getPipelinePulse(session.user.id),
    getPendingActions(session.user.id),
    getActiveBatches(session.user.id),
    getRecentActivity(session.user.id, 8),
  ]);

  return (
    <OverviewClient
      pipeline={pipeline}
      pending={pending}
      activeBatches={activeBatches}
      recentActivity={recentActivity}
    />
  );
}
