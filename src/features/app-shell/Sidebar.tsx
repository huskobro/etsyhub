"use client";

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { UserRole } from "@prisma/client";
import {
  Sidebar as SidebarPrimitive,
  SidebarBrand,
  SidebarGroup,
} from "@/components/ui/Sidebar";
import { NavItem } from "@/components/ui/NavItem";
import { navForRole, USER_NAV, ADMIN_NAV } from "@/features/app-shell/nav-config";

export function Sidebar({
  role,
  email,
}: {
  role: UserRole;
  email: string;
}) {
  const pathname = usePathname();
  const items = navForRole(role);
  const userItems = items.filter((i) => USER_NAV.some((u) => u.href === i.href));
  const adminItems = items.filter((i) => ADMIN_NAV.some((a) => a.href === i.href));

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`) || false;

  return (
    <SidebarPrimitive
      brand={<SidebarBrand name="EtsyHub" scope={role === "ADMIN" ? "admin" : "user"} />}
      footer={
        <div className="flex w-full items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-text">{email}</div>
            <div className="font-mono text-xs text-text-subtle">{role.toLowerCase()}</div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-sm border border-border-subtle px-2 py-1 font-mono text-xs text-text-muted transition-colors ease-out duration-fast hover:bg-surface hover:text-text"
          >
            Çıkış
          </button>
        </div>
      }
    >
      <SidebarGroup>
        {userItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavItem
              key={item.href}
              href={item.enabled ? item.href : undefined}
              icon={<Icon className="h-4 w-4" aria-hidden />}
              label={item.label}
              active={isActive(item.href)}
              disabled={!item.enabled}
              meta={item.enabled ? undefined : `P${item.phase}`}
            />
          );
        })}
      </SidebarGroup>
      {adminItems.length > 0 ? (
        <SidebarGroup title="Admin">
          {adminItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavItem
                key={item.href}
                href={item.enabled ? item.href : undefined}
                icon={<Icon className="h-4 w-4" aria-hidden />}
                label={item.label}
                active={isActive(item.href)}
                disabled={!item.enabled}
                meta={item.enabled ? undefined : `P${item.phase}`}
              />
            );
          })}
        </SidebarGroup>
      ) : null}
    </SidebarPrimitive>
  );
}
