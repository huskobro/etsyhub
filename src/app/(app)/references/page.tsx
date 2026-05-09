import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { ReferencesPage } from "@/features/references/components/references-page";
import { ReferencesShellTabs } from "@/features/references/components/ReferencesShellTabs";
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
      <header className="flex flex-shrink-0 items-center gap-4 border-b border-line bg-bg px-6 py-4">
        <div className="flex-1">
          <h1 className="k-display text-lg font-semibold tracking-tight text-ink">
            References
          </h1>
          {/* R11.14.2 — v5 B1 subtitle parity: aktif sub-view'a göre
           * "{count} {LABEL} · {weekly} ADDED THIS WEEK" formatı.
           * Bu page server component'i sub-view "pool" için bağlandı;
           * diğer sub-view'lar kendi route'larında kendi alt-counts'larını
           * üretir. */}
          <p className="mt-0.5 font-mono text-xs uppercase tracking-meta text-ink-3">
            {counts.pool} REFERENCES · {counts.poolThisWeek} ADDED THIS WEEK
          </p>
        </div>
      </header>
      <ReferencesShellTabs counts={counts} active="pool" />
      <div className="flex-1 overflow-y-auto p-6">
        <ReferencesPage productTypes={productTypes} />
      </div>
    </div>
  );
}
