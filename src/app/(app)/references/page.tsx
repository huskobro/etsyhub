import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { ReferencesPage } from "@/features/references/components/references-page";
import { ReferencesShellTabs } from "@/features/references/components/ReferencesShellTabs";
import { ReferencesTopbar } from "@/features/references/components/ReferencesTopbar";
import { ReferencesAddReferenceMount } from "@/features/references/components/references-add-reference-mount";
import { getReferencesSubViewCounts } from "@/features/references/server/sub-view-counts";

export const metadata = { title: "References · Kivasy" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [productTypes, counts, collections] = await Promise.all([
    /* Phase 28 — Intake server-level canonical filter.
     *
     * Phase 27 client-level whitelist + "More types" toggle DS B5 mock'unda
     * yoktu (kendi icadı). DS canonical 5 chip: Clipart bundle / Wall art /
     * Bookmark / Sticker / Printable. Server burada yalnız bu 5'i döndürür;
     * modal'da koşulsuz 5 chip render edilir, "More types" toggle ortadan
     * kalkar. Admin custom types `isSystem: false` zaten elendi. Physical
     * POD (tshirt/hoodie/dtf) ve legacy canvas burada görünmez.
     */
    db.productType.findMany({
      where: {
        isSystem: true,
        key: { in: ["clipart", "wall_art", "bookmark", "sticker", "printable"] },
      },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, key: true },
    }),
    getReferencesSubViewCounts(session.user.id),
    db.collection.findMany({
      where: { userId: session.user.id, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="-m-6 flex h-screen flex-col">
      <ReferencesTopbar
        subtitle={`${counts.pool} REFERENCES · ${counts.poolThisWeek} ADDED THIS WEEK`}
        actions={
          /* Phase 26 — DS B5 canonical CTA + URL-derived modal trigger.
           * Pool/Inbox/Stories/Shops/Collections topbar'larında aynı
           * `Add Reference` CTA `?add=ref` query'siyle AddReferenceDialog
           * açar. Stateless Link; modal state ReferencesAddReferenceMount
           * client component'inde URL-derived. */
          <Link
            href="/references?add=ref"
            data-size="sm"
            className="k-btn k-btn--primary"
            data-testid="references-add-cta"
            title="Add a new reference (URL, upload, or from Inbox bookmark)"
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

      {/* Phase 26 — canonical intake modal (DS v5 B5). URL-derived
       * (`?add=ref`). Stateless mount; client component listens
       * searchParams + opens AddReferenceDialog. */}
      <ReferencesAddReferenceMount
        productTypes={productTypes}
        collections={collections}
      />
    </div>
  );
}
