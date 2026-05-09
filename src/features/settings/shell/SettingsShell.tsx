/* eslint-disable no-restricted-syntax */
// SettingsShell — Kivasy v6 C2 detail-list shell. v6 sabitleri:
//  · grid-cols-[260px_1fr] left-rail + right-pane sözleşmesi (canon).
//  · text-[13px] left-rail row + text-[10px] / text-[9.5px] mono group
//    label / Wave D meta typography.
//  · k-display text-[26px] pane title (A5/B3 ile uyumlu hierarchy).
//  · Active row "k-card-like" boxShadow stack (v6 base.jsx canon).
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  BookOpen,
  Download,
  Image as ImageIcon,
  Layers,
  Link2,
  List,
  Package,
  Settings as SettingsIcon,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { AppTopbar } from "@/components/ui/AppTopbar";

/**
 * SettingsShell — Kivasy C2 detail-list shell.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v6/screens-c2.jsx →
 * C2Settings (+ v7/screens-d.jsx → SettingsLeftRail D1 variant).
 *
 * Left rail: 3 groups (PREFERENCES / CONNECTIONS / GOVERNANCE),
 * 12 panes total, 3 live + 9 deferred.
 *
 * URL state: ?pane=general|etsy|providers|...
 *
 * Boundary discipline (CLAUDE.md):
 *   Settings = system surface. Live panes ship behavior; deferred panes
 *   render placeholder. GOVERNANCE group is admin-badge gated; visibility
 *   per role handled inside renderPane (admin-only routes still live).
 */

export type PaneId =
  | "general"
  | "workspace"
  | "editor"
  | "notifications"
  | "etsy"
  | "providers"
  | "storage"
  | "scrapers"
  | "users"
  | "audit"
  | "flags"
  | "theme";

export type PaneState = "live" | "deferred";

interface PaneItem {
  id: PaneId;
  name: string;
  icon: LucideIcon;
  state: PaneState;
  meta?: string;
  metaTone?: "success" | "neutral";
}

interface PaneGroup {
  label: string;
  admin: boolean;
  items: PaneItem[];
}

interface SettingsShellProps {
  defaultPane?: PaneId;
  /** Per-pane content slot — şu an aktif pane'in render'ı */
  renderPane: (pane: PaneId) => ReactNode;
  /** Yan başlık subtitle (örn. "WED · MAR 27") */
  subtitle?: string;
  /** Operatör user role (admin badge'leri için) */
  isAdmin?: boolean;
}

const GROUPS: PaneGroup[] = [
  {
    label: "PREFERENCES",
    admin: false,
    items: [
      { id: "general", name: "General", icon: SettingsIcon, state: "live" },
      {
        id: "workspace",
        name: "Workspace",
        icon: Layers,
        state: "live",
        meta: "Override",
        metaTone: "neutral",
      },
      {
        id: "editor",
        name: "Editor",
        icon: ImageIcon,
        state: "live",
        meta: "Defaults",
        metaTone: "neutral",
      },
      {
        id: "notifications",
        name: "Notifications",
        icon: Bell,
        state: "live",
        meta: "Live",
        metaTone: "success",
      },
    ],
  },
  {
    label: "CONNECTIONS",
    admin: false,
    items: [
      {
        id: "etsy",
        name: "Etsy",
        icon: Link2,
        state: "live",
        meta: "Connected",
        metaTone: "success",
      },
      {
        id: "providers",
        name: "AI Providers",
        icon: Sparkles,
        state: "live",
        meta: "Workspace",
        metaTone: "neutral",
      },
      {
        id: "storage",
        name: "Storage",
        icon: Package,
        state: "live",
        meta: "Tunable",
        metaTone: "neutral",
      },
      {
        id: "scrapers",
        name: "Scrapers",
        icon: Download,
        state: "live",
        meta: "Admin",
        metaTone: "neutral",
      },
    ],
  },
  {
    label: "GOVERNANCE",
    admin: true,
    items: [
      { id: "users", name: "Users", icon: User, state: "deferred" },
      { id: "audit", name: "Audit", icon: List, state: "deferred" },
      { id: "flags", name: "Feature Flags", icon: Zap, state: "deferred" },
      { id: "theme", name: "Theme", icon: BookOpen, state: "deferred" },
    ],
  },
];

export function SettingsShell({
  defaultPane = "general",
  renderPane,
  subtitle,
  isAdmin = false,
}: SettingsShellProps) {
  const router = useRouter();
  const params = useSearchParams();
  const urlPane = params.get("pane") as PaneId | null;
  const [pane, setPaneLocal] = useState<PaneId>(urlPane ?? defaultPane);

  function setPane(next: PaneId) {
    setPaneLocal(next);
    const sp = new URLSearchParams(params.toString());
    if (next === defaultPane) sp.delete("pane");
    else sp.set("pane", next);
    const qs = sp.toString();
    router.push(qs ? `/settings?${qs}` : "/settings", { scroll: false });
  }

  const activePane = urlPane ?? pane;

  // Subtitle default — current date Turkish locale.
  const defaultSubtitle = new Date()
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();

  return (
    <div
      className="-m-6 flex h-screen flex-col"
      data-testid="settings-page"
    >
      {/* Topbar */}
      <AppTopbar title="Settings" subtitle={subtitle ?? defaultSubtitle} />

      {/* Two-column grid: left rail (260) + right pane */}
      <div className="grid flex-1 overflow-hidden grid-cols-1 lg:grid-cols-[260px_1fr]">
        {/* LEFT RAIL */}
        <aside
          className="overflow-y-auto border-r border-line bg-bg py-4"
          aria-label="Settings navigation"
        >
          {GROUPS.map((g) => {
            // Hide governance group entirely for non-admin users.
            if (g.admin && !isAdmin) return null;
            return (
              <div key={g.label} className="mb-3">
                <div className="mt-2 mb-1.5 flex items-center gap-2 px-5">
                  <span className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
                    {g.label}
                  </span>
                  {g.admin ? (
                    <Badge tone="warning">ADMIN</Badge>
                  ) : null}
                  <span className="ml-1 h-px flex-1 bg-line" aria-hidden />
                </div>
                <div className="space-y-0.5 px-2">
                  {g.items.map((it) => {
                    const Icon = it.icon;
                    const active = activePane === it.id;
                    const isDeferred = it.state === "deferred";
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => setPane(it.id)}
                        disabled={isDeferred}
                        aria-current={active ? "page" : undefined}
                        title={
                          isDeferred
                            ? "This pane is part of post-MVP backlog (deferred). UI placeholder only."
                            : undefined
                        }
                        data-testid={`settings-rail-${it.id}`}
                        className={cn(
                          "flex h-8 w-full items-center gap-2.5 rounded-md px-3 text-left transition-colors",
                          active
                            ? "bg-paper text-ink shadow-card"
                            : "text-ink-2 hover:bg-ink/5",
                          isDeferred && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-3.5 w-3.5 flex-shrink-0",
                            active ? "text-k-orange" : "text-ink-3",
                          )}
                          aria-hidden
                        />
                        <span
                          className={cn(
                            "flex-1 text-[13px]",
                            active ? "font-medium text-ink" : "text-ink-2",
                          )}
                        >
                          {it.name}
                        </span>
                        {it.meta ? (
                          <span
                            className={cn(
                              "font-mono text-[10px] tracking-wider",
                              it.metaTone === "success"
                                ? "text-k-green"
                                : "text-ink-3",
                            )}
                          >
                            {it.meta}
                          </span>
                        ) : null}
                        {it.state === "deferred" ? (
                          <span className="font-mono text-[9.5px] uppercase tracking-wider text-ink-4">
                            Soon
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </aside>

        {/* RIGHT PANE */}
        <section
          className="overflow-y-auto bg-paper"
          data-testid="settings-pane"
          data-active-pane={activePane}
        >
          {renderPane(activePane)}
        </section>
      </div>
    </div>
  );
}
