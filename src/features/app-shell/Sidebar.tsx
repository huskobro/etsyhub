"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { navForRole } from "@/features/app-shell/nav-config";

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = navForRole(role);

  return (
    <aside className="flex h-screen w-sidebar flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-header items-center border-b border-border px-5">
        <span className="text-base font-semibold">EtsyHub</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const base = "flex items-center gap-3 rounded-md px-3 py-2 text-sm";
          const state = active
            ? "bg-sidebar-accent/15 text-sidebar-accent font-medium"
            : item.enabled
              ? "hover:bg-surface-muted"
              : "cursor-not-allowed opacity-40";
          return item.enabled ? (
            <Link key={item.href} href={item.href} className={`${base} ${state}`}>
              <Icon className="h-4 w-4" aria-hidden />
              <span>{item.label}</span>
            </Link>
          ) : (
            <span
              key={item.href}
              className={`${base} ${state}`}
              title={`Phase ${item.phase} kapsamında aktif olacak`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span>{item.label}</span>
              <span className="ml-auto text-xs text-text-muted">P{item.phase}</span>
            </span>
          );
        })}
      </nav>
    </aside>
  );
}
