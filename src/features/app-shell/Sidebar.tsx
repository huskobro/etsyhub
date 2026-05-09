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

/**
 * Kivasy app-shell Sidebar — 8 items / 2 groups (Produce / System).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/base.jsx → Sidebar.
 * Admin scope is rendered as a footer badge on the user pill, NOT as a
 * separate sidebar — see docs/IMPLEMENTATION_HANDOFF.md §4.
 *
 * Active match: pathname === item.href OR pathname startsWith item.href + "/".
 * For nested sub-views (References → Pool / Stories / …) the parent stays
 * active throughout, since sub-views don't appear as top-level entries.
 */
export function Sidebar({
  role,
  email,
}: {
  role: UserRole;
  email: string;
}) {
  const pathname = usePathname();
  const items = navForRole(role);
  const groups = navByGroup(items);

  const isActive = (href: string): boolean =>
    pathname === href ||
    pathname?.startsWith(`${href}/`) ||
    false;

  return (
    <SidebarPrimitive
      brand={
        <div className="flex items-center gap-3">
          <KivasyMark size={28} idSuffix="sidebar" />
          <KivasyWord size={18} />
        </div>
      }
      footer={
        <div className="flex w-full items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-muted font-mono text-xs font-semibold text-text-muted">
            {email.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-text">{email}</div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-text-subtle">
                Operator
              </span>
              {role === "ADMIN" ? (
                // eslint-disable-next-line no-restricted-syntax
                <span className="rounded-sm bg-warning-soft px-1 py-0.5 font-mono text-[10px] font-semibold tracking-meta text-warning">
                  admin
                </span>
              ) : null}
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
      {(["produce", "system"] as const).map((groupId) => (
        <SidebarGroup key={groupId} title={GROUP_LABELS[groupId]}>
          {groups[groupId].map((item) => {
            const Icon = item.icon;
            return (
              <NavItem
                key={item.id}
                href={item.href}
                icon={<Icon className="h-4 w-4" aria-hidden />}
                label={item.label}
                active={isActive(item.href)}
                meta={
                  item.ready ? undefined : (
                    <span
                      title="Coming soon · post-MVP enrichment"
                      // eslint-disable-next-line no-restricted-syntax
                      className="font-mono text-[10px] uppercase tracking-meta text-text-subtle"
                    >
                      Soon
                    </span>
                  )
                }
              />
            );
          })}
        </SidebarGroup>
      ))}
    </SidebarPrimitive>
  );
}
