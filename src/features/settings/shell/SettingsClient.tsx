"use client";

import { SettingsShell, type PaneId } from "./SettingsShell";
import { PaneGeneral } from "./panes/PaneGeneral";
import { PaneEtsy } from "./panes/PaneEtsy";
import { PaneAIProviders } from "./panes/PaneAIProviders";
import { PaneDeferred } from "./panes/PaneDeferred";

/**
 * SettingsClient — `/settings` route client wrapper.
 *
 * Server page passes `isAdmin` (governance group visibility); client
 * resolves the active pane from URL state and dispatches to the right
 * panel implementation.
 */

interface SettingsClientProps {
  isAdmin: boolean;
}

export function SettingsClient({ isAdmin }: SettingsClientProps) {
  return (
    <SettingsShell
      isAdmin={isAdmin}
      defaultPane="general"
      renderPane={(pane) => renderPane(pane)}
    />
  );
}

function renderPane(pane: PaneId) {
  switch (pane) {
    case "general":
      return <PaneGeneral />;
    case "etsy":
      return <PaneEtsy />;
    case "providers":
      return <PaneAIProviders />;
    default:
      return <PaneDeferred paneId={pane} />;
  }
}
