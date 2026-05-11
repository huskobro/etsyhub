/* eslint-disable no-restricted-syntax */
// PaneEtsy — Kivasy v6 C2 PaneEtsy yüzeyini canlı Etsy bağlantı paneli
// üzerine giydirir. v6 sabit boyutlar:
//  · max-w-[680px] pane container + text-[26px] pane title
//  · k-card--hero connected-shop card + permissions list + footer row
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { EtsyConnectionSettingsPanel } from "@/features/settings/etsy-connection/components/etsy-connection-settings-panel";
import { EtsyReadinessSummary } from "@/features/settings/etsy-connection/components/etsy-readiness-summary";

/**
 * PaneEtsy — Etsy connection within Settings shell.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v6/screens-c2.jsx →
 * PaneEtsy.
 *
 * Phase 9 V1 mevcut Etsy panel'leri (EtsyReadinessSummary +
 * EtsyConnectionSettingsPanel) C2 max-w-[680px] container'ında wrap
 * edilir. Yeni service yok; OAuth flow mevcut hook'larla çalışır.
 */
export function PaneEtsy() {
  return (
    <div className="max-w-[680px] px-10 py-9">
      <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
        Etsy
      </h2>
      <p className="mt-1 mb-7 text-[13px] text-ink-2">
        OAuth-connected shop where Kivasy pushes drafts. Re-authentication and
        permissions are managed below.
      </p>

      <div className="space-y-6">
        <EtsyReadinessSummary />
        <EtsyConnectionSettingsPanel />
      </div>
    </div>
  );
}
