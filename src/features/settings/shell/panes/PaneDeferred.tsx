/* eslint-disable no-restricted-syntax */
// PaneDeferred — Kivasy v6 PaneDeferred placeholder; v6 sabit boyutlar:
//  · max-w-[680px] container + text-[26px] k-display title +
//    text-[10.5px] / text-[13px] / text-[12px] yarı-piksel typography.
// Whitelisted in scripts/check-tokens.ts.
"use client";

import type { PaneId } from "@/features/settings/shell/SettingsShell";

const PANE_LABELS: Record<PaneId, string> = {
  general: "General",
  workspace: "Workspace",
  editor: "Editor",
  notifications: "Notifications",
  etsy: "Etsy",
  providers: "AI Providers",
  storage: "Storage",
  scrapers: "Scrapers",
  users: "Users",
  audit: "Audit",
  flags: "Feature Flags",
  theme: "Theme",
};

const PANE_HINTS: Partial<Record<PaneId, string>> = {
  workspace: "Per-user keys override + custom workspace defaults.",
  editor: "Edit-op defaults: brush size, mask compositing, magic-eraser strength.",
  notifications: "Job done / submit failed / batch waiting alerts.",
  storage: "S3 / R2 / MinIO bucket configuration + signed URL TTL tuning.",
  scrapers: "Apify / Firecrawl per-scraper credentials + rate limits.",
  users: "Operator list, role assignment, invitation flow.",
  audit: "Mutation audit log + filter + export.",
  flags: "Feature flag rollout: scope (global/user/workspace), gradual %.",
  theme: "Token editor — palette / radius / shadow / typography overrides.",
};

/**
 * PaneDeferred — placeholder for system surfaces shipping in R7+.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v6/screens-c2.jsx →
 * PaneDeferred (Wave D meta caption pattern).
 *
 * R6'da 9 pane deferred: Workspace / Editor / Notifications / Storage /
 * Scrapers / Users / Audit / Feature Flags / Theme. Hepsi shell içinde
 * görünür ama içerik aynı placeholder bant'ını gösterir.
 */
export function PaneDeferred({ paneId }: { paneId: PaneId }) {
  const name = PANE_LABELS[paneId];
  const hint = PANE_HINTS[paneId];

  return (
    <div className="max-w-[680px] px-10 py-9">
      <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
        {name}
      </h2>
      <p className="mt-1 mb-4 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
        Coming soon · post-MVP
      </p>
      {hint ? (
        <div className="rounded-md border border-dashed border-line bg-k-bg-2/40 px-5 py-4">
          <p className="text-[13px] leading-relaxed text-ink-2">{hint}</p>
        </div>
      ) : null}
    </div>
  );
}
