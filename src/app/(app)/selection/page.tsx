import { redirect } from "next/navigation";

// `/selection` (singular) is the legacy Phase-7 Selection Studio index.
// Sidebar nav points to `/selections` (plural) and IA closed-list keeps
// only `/selections` as the canonical set surface; the singular index is
// shadowed but historically reachable via direct URL or stale CTAs. The
// nested `/selection/sets/[setId]/...` Studio routes (edit operations,
// mockup apply/jobs) remain live for now — only the bare `/selection`
// index is collapsed onto `/selections`. Studio relocation under
// `/selections/[id]/edits` is the Phase-4 migration.

export const metadata = { title: "Selections · Kivasy" };

export default function SelectionIndexRedirectPage(): never {
  redirect("/selections");
}
