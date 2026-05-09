"use client";

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { UserRole } from "@prisma/client";
import {
  Sidebar as SidebarPrimitive,
  SidebarGroup,
} from "@/components/ui/Sidebar";
import { NavItem } from "@/components/ui/NavItem";
import { Button } from "@/components/ui/Button";
import { KivasyMark, KivasyWord } from "@/components/ui/KivasyMark";
import {
  navForRole,
  navByGroup,
  GROUP_LABELS,
} from "@/features/app-shell/nav-config";
import { formatNavCount, type NavCounts } from "@/features/app-shell/nav-counts";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Kivasy app-shell Sidebar — 8 items / 2 groups (Produce / System).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/base.jsx → Sidebar.
 * Admin scope is rendered as a footer badge on the user pill, NOT as a
 * separate sidebar — see docs/IMPLEMENTATION_HANDOFF.md §4.
 *
 * R11.14.5 — v4 Sidebar parity:
 *   - brand block: KivasyMark + KivasyWord
 *   - workspace switcher (HB Studio dropdown placeholder)
 *   - per-nav count chip (mono 10.5px right-aligned, references=86 etc.)
 *   - Batches pulse (running > 0 → amber dot animation)
 *   - user footer: avatar gradient + name + role mono + ⋯ menu
 *
 * Active match: pathname === item.href OR pathname startsWith item.href + "/".
 * For nested sub-views (References → Pool / Stories / …) the parent stays
 * active throughout, since sub-views don't appear as top-level entries.
 */
export function Sidebar({
  role,
  email,
  navCounts,
}: {
  role: UserRole;
  email: string;
  navCounts?: NavCounts;
}) {
  const pathname = usePathname();
  const items = navForRole(role);
  const groups = navByGroup(items);

  const isActive = (href: string): boolean =>
    pathname === href ||
    pathname?.startsWith(`${href}/`) ||
    false;

  // Per-item count + pulse map (id → display string + pulse flag).
  const counts: Record<
    string,
    { display: string; pulse?: boolean } | undefined
  > = {
    references:
      navCounts?.references != null
        ? { display: formatNavCount(navCounts.references) }
        : undefined,
    batches:
      navCounts?.batches != null
        ? {
            display: formatNavCount(navCounts.batches),
            pulse: navCounts.batchesPulse,
          }
        : undefined,
    library:
      navCounts?.library != null
        ? { display: formatNavCount(navCounts.library) }
        : undefined,
    selections:
      navCounts?.selections != null
        ? { display: formatNavCount(navCounts.selections) }
        : undefined,
    products:
      navCounts?.products != null
        ? { display: formatNavCount(navCounts.products) }
        : undefined,
  };

  // Avatar initials + gradient — derived from email.
  const initials = email.slice(0, 2).toUpperCase();
  const displayName = email.split("@")[0] ?? email;

  return (
    <SidebarPrimitive
      brand={
        <div className="flex items-center gap-3">
          <KivasyMark size={28} idSuffix="sidebar" />
          <KivasyWord size={18} />
        </div>
      }
      footer={
        <div className="flex w-full items-center gap-2.5 p-2 pr-1">
          <div
            // eslint-disable-next-line no-restricted-syntax
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-k-orange-bright to-k-orange-deep font-mono text-[10px] font-semibold text-white"
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-medium leading-tight text-ink">
              {displayName}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 leading-none">
              {/* eslint-disable-next-line no-restricted-syntax */}
              <span className="font-mono text-[10px] text-ink-3">
                {role === "ADMIN" ? "Admin" : "Operator"}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="font-mono text-xs"
          >
            Sign out
          </Button>
        </div>
      }
    >
      {/* R11.14.5 — Workspace switcher (HB Studio v4 base.jsx parity).
       *   MVP scope: tek-workspace per-user; dropdown placeholder olarak
       *   görünür ama tıklamada işlem yok. Multi-workspace geldiğinde bu
       *   component aktif edilecek. Brand-row (h-header) ile çakışmasın
       *   diye children section'ın başına yerleştirildi. */}
      <div className="-mx-3 mb-2 px-3">
        <button
          type="button"
          disabled
          title="Multi-workspace lands post-MVP"
          className="flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-paper/60 px-3 transition-colors hover:bg-paper disabled:cursor-default"
          data-testid="sidebar-workspace-switcher"
        >
          <span
            // eslint-disable-next-line no-restricted-syntax
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gradient-to-br from-k-orange-deep to-k-orange font-mono text-[9px] font-semibold text-white"
          >
            {initials}
          </span>
          <span className="flex-1 truncate text-left text-[13px] font-medium text-ink">
            {displayName}
          </span>
          <ChevronDown
            className="h-3 w-3 shrink-0 text-ink-3"
            aria-hidden
          />
        </button>
      </div>

      {(["produce", "system"] as const).map((groupId) => (
        <SidebarGroup key={groupId} title={GROUP_LABELS[groupId]}>
          {groups[groupId].map((item) => {
            const Icon = item.icon;
            const navCount = counts[item.id];
            return (
              <NavItem
                key={item.id}
                href={item.href}
                icon={<Icon className="h-4 w-4" aria-hidden />}
                label={item.label}
                active={isActive(item.href)}
                meta={
                  !item.ready ? (
                    <span
                      title="Coming soon · post-MVP enrichment"
                      // eslint-disable-next-line no-restricted-syntax
                      className="font-mono text-[10px] uppercase tracking-meta text-text-subtle"
                    >
                      Soon
                    </span>
                  ) : navCount ? (
                    <span className="flex items-center gap-1.5">
                      {navCount.pulse ? (
                        <span
                          className="relative h-1.5 w-1.5"
                          aria-label="Active"
                        >
                          <span
                            // eslint-disable-next-line no-restricted-syntax
                            className="absolute inset-0 rounded-full bg-k-amber"
                          />
                          <span
                            // eslint-disable-next-line no-restricted-syntax
                            className={cn(
                              "absolute inset-0 -m-0.5 rounded-full bg-k-amber opacity-40",
                              "animate-[k-ping_1.6s_infinite_ease-out]",
                            )}
                          />
                        </span>
                      ) : null}
                      <span
                        // eslint-disable-next-line no-restricted-syntax
                        className="font-mono text-[10.5px] tabular-nums tracking-wider text-ink-3"
                      >
                        {navCount.display}
                      </span>
                    </span>
                  ) : undefined
                }
              />
            );
          })}
        </SidebarGroup>
      ))}
    </SidebarPrimitive>
  );
}
