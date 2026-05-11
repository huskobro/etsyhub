import { redirect } from "next/navigation";

// `/dashboard` is the legacy Phase-1 entry point; the canonical pipeline
// home is `/overview` (nav-config.ts → NAV_ITEMS[0]). Sidebar/topbar/CTA
// links all point to `/overview`; only direct URL hits or stale browser
// history reach `/dashboard`. Permanent redirect keeps any external
// bookmarks pointing at the right surface and removes the duplicate
// dashboard from the IA without deleting the underlying feature
// components (they are no longer reachable from a route, only from
// `/overview` if it later imports them).

export const metadata = { title: "Overview · Kivasy" };

export default function DashboardRedirectPage(): never {
  redirect("/overview");
}
