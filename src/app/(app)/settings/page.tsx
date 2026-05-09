import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { SettingsClient } from "@/features/settings/shell/SettingsClient";

/**
 * /settings — Kivasy C2 Settings detail-list shell (rollout-6).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v6/screens-c2.jsx →
 * C2Settings + docs/design-system/kivasy/ui_kits/kivasy/v7/screens-d.jsx
 * → D1Providers (AI Providers pane).
 *
 * Live panes (R6):
 *   - General · density / theme / language / date format
 *   - Etsy · OAuth-connected shop, permissions, re-auth
 *   - AI Providers · workspace defaults, key states, task-type model map
 *
 * Deferred panes (R7+, placeholder rendering):
 *   - Workspace / Editor / Notifications / Storage / Scrapers
 *   - Users / Audit / Feature Flags / Theme (admin governance)
 *
 * Boundary discipline (CLAUDE.md):
 *   Settings = system surface. GOVERNANCE group is admin-only; non-admin
 *   users don't see it in the rail. AI Providers is admin-scope (workspace
 *   defaults badge), per-user override caption visible.
 */

export const metadata = { title: "Settings · Kivasy" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";

  return <SettingsClient isAdmin={isAdmin} />;
}
