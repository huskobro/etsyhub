import type { UserRole } from "@prisma/client";
import {
  LayoutDashboard,
  Inbox,
  Zap,
  Image as ImageIcon,
  Layers,
  Package,
  BookOpen,
  Settings as SettingsIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Kivasy Information Architecture — 8 items, 2 groups.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/base.jsx → Sidebar
 * + docs/IMPLEMENTATION_HANDOFF.md §4.
 *
 * **Closed list — no new top-level surfaces.** Sub-views live inside their
 * parent (e.g. References → Pool / Stories / Inbox / Shops / Collections).
 * Admin scope is a footer badge, not a separate sidebar.
 *
 * Production chain (one-directional, every arrow = single primary CTA):
 *   Reference → Batch → Library → Selection → Product → Etsy Draft
 */

export type NavGroupId = "produce" | "system";

export interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  group: NavGroupId;
  /** Implementation rollout that owns this surface. Items in a not-yet-
   *  rolled rollout still render in the sidebar but route to a placeholder
   *  page (with a "Coming in rollout-N" hint). */
  rollout: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** True once the surface is implemented end-to-end. `false` during
   *  rollouts that haven't reached this surface yet. */
  ready: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  // PRODUCE — pipeline surfaces
  { id: "overview",   href: "/overview",   label: "Overview",   icon: LayoutDashboard, group: "produce", rollout: 8, ready: false },
  { id: "references", href: "/references", label: "References", icon: Inbox,           group: "produce", rollout: 6, ready: false },
  { id: "batches",    href: "/batches",    label: "Batches",    icon: Zap,             group: "produce", rollout: 3, ready: true  },
  { id: "library",    href: "/library",    label: "Library",    icon: ImageIcon,       group: "produce", rollout: 2, ready: true  },
  { id: "selections", href: "/selections", label: "Selections", icon: Layers,          group: "produce", rollout: 4, ready: true  },
  { id: "products",   href: "/products",   label: "Products",   icon: Package,         group: "produce", rollout: 5, ready: true  },

  // SYSTEM — meta surfaces
  { id: "templates",  href: "/templates",  label: "Templates",  icon: BookOpen,        group: "system",  rollout: 7, ready: false },
  { id: "settings",   href: "/settings",   label: "Settings",   icon: SettingsIcon,    group: "system",  rollout: 7, ready: false },
];

export const GROUP_LABELS: Record<NavGroupId, string> = {
  produce: "Produce",
  system: "System",
};

/** Filter nav items by role. Currently all 8 items are visible to USER and
 *  ADMIN alike — admin-only sub-sections live INSIDE Settings (Governance
 *  group: Users / Audit / Feature Flags) and inside Templates. */
export function navForRole(_role: UserRole): NavItem[] {
  return NAV_ITEMS;
}

/** Group nav items for sidebar rendering (preserves declared order). */
export function navByGroup(items: NavItem[]): Record<NavGroupId, NavItem[]> {
  return {
    produce: items.filter((i) => i.group === "produce"),
    system: items.filter((i) => i.group === "system"),
  };
}
