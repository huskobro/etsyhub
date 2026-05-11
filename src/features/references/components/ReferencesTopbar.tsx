// R11.14.5/.6 — References family topbar.
// References family-specific wrapper around the generic AppTopbar; title
// always "References" (sub-view captures rendered as subtitle).

import type { ReactNode } from "react";
import { AppTopbar } from "@/components/ui/AppTopbar";

export function ReferencesTopbar({
  title = "References",
  subtitle,
  actions,
}: {
  title?: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return <AppTopbar title={title} subtitle={subtitle} actions={actions} />;
}
