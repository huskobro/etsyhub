// Phase 7 Task 23 — /selection index server entry.
//
// Server component sadece client component'i sarmalar (referansı:
// `src/app/(app)/references/page.tsx`). Veri fetch'i tarayıcı tarafında
// TanStack Query üzerinden yapılır (Phase 6 review paterni).

import { SelectionIndexPage } from "@/features/selection/components/SelectionIndexPage";

export const metadata = { title: "Selection Studio · Kivasy" };

export default function Page() {
  return <SelectionIndexPage />;
}
