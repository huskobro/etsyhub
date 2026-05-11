import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { ReferencesPage } from "@/features/references/components/references-page";
import { ReferencesShellTabs } from "@/features/references/components/ReferencesShellTabs";
import { ReferencesTopbar } from "@/features/references/components/ReferencesTopbar";
import { getReferencesSubViewCounts } from "@/features/references/server/sub-view-counts";

export const metadata = { title: "References · Kivasy" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [productTypes, counts] = await Promise.all([
    db.productType.findMany({
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    }),
    getReferencesSubViewCounts(session.user.id),
  ]);

  return (
    <div className="-m-6 flex h-screen flex-col">
      <ReferencesTopbar
        subtitle={`${counts.pool} REFERENCES · ${counts.poolThisWeek} ADDED THIS WEEK`}
        actions={
          <Link
            href="/bookmarks"
            data-size="sm"
            className="k-btn k-btn--primary"
            data-testid="references-add-cta"
            title="Open Inbox to add new reference (paste URL or upload image)"
          >
            <Plus className="h-3 w-3" aria-hidden />
            Add Reference
          </Link>
        }
      />

      {/* R11.14.5 — Sibling tab segment row (k-stabs).
       *   v5 SubPool spec: count italic mono **inline** (k-stab__count
       *   inside button, not a separate badge). */}
      <ReferencesShellTabs counts={counts} active="pool" />

      <div className="flex flex-1 flex-col overflow-hidden">
        <ReferencesPage productTypes={productTypes} />
      </div>
    </div>
  );
}
