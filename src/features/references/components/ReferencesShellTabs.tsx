/* eslint-disable no-restricted-syntax */
// ReferencesShellTabs — Kivasy v5 B1 sibling-tab top bar.
// Source: docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b1.jsx
//
// "References is one place" mental model: 5 sub-view'i tek surface
// altında segment (k-stabs) ile expose et. Mevcut sub-view'lar
// (/bookmarks, /competitors, /trend-stories, /collections) kendi
// route'larında çalışmaya devam eder; bu shell sadece üst seviye
// navigation + count badge sağlar.
//
// v5 sabit boyutlar (text-[12.5px] / k-mono 10.5px) — design-system
// canon. Whitelisted in scripts/check-tokens.ts.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

interface SubView {
  id: string;
  label: string;
  href: string;
  /** Optional count chip (operatöre at-a-glance). */
  count?: number;
}

interface Props {
  counts?: {
    pool?: number;
    stories?: number;
    inbox?: number;
    shops?: number;
    collections?: number;
  };
  /** Active sub-view; auto-detected from pathname if absent. */
  active?: string;
}

/**
 * B1 References shell — sibling-tab segment row.
 * Render edildiği sayfa altta sub-view içeriğini gösterir; tab'a tıklayınca
 * ilgili route'a navigate eder (mevcut sub-view sayfaları korunur).
 */
export function ReferencesShellTabs({ counts = {}, active }: Props) {
  const pathname = usePathname();

  const subs: SubView[] = [
    { id: "pool", label: "Pool", href: "/references", count: counts.pool },
    {
      id: "stories",
      label: "Stories",
      href: "/trend-stories",
      count: counts.stories,
    },
    { id: "inbox", label: "Inbox", href: "/bookmarks", count: counts.inbox },
    { id: "shops", label: "Shops", href: "/competitors", count: counts.shops },
    {
      id: "collections",
      label: "Collections",
      href: "/collections",
      count: counts.collections,
    },
  ];

  const activeId =
    active ??
    subs.find((s) =>
      s.href === "/references"
        ? pathname === "/references" ||
          pathname?.startsWith("/references/") === true
        : pathname?.startsWith(s.href),
    )?.id ??
    "pool";

  return (
    <div
      className="flex flex-shrink-0 items-center gap-3 border-b border-line bg-bg px-6 py-3"
      data-testid="references-shell-tabs"
    >
      <div className="flex items-center gap-1">
        {subs.map((s) => {
          const isActive = s.id === activeId;
          return (
            <Link
              key={s.id}
              href={s.href}
              data-active={isActive ? "true" : "false"}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium transition-colors",
                isActive
                  ? "bg-paper text-ink shadow-card"
                  : "text-ink-2 hover:bg-ink/5",
              )}
            >
              {s.label}
              {typeof s.count === "number" ? (
                <span
                  className={cn(
                    "font-mono text-[10.5px] tabular-nums tracking-wider",
                    isActive ? "text-ink-3" : "text-ink-4",
                  )}
                >
                  {s.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
