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

  // R11.14.5 — v5 spec birebir: k-stabs container (inline-flex padding 3px,
  //   bg-bg-2, radius 9px, gap 3px) + k-stab buttons (radius 6px, font 13px).
  //   Active state: bg-paper + box-shadow card. Count = k-stab__count
  //   (mono 10.5px, inline within button).
  return (
    <div
      className="flex flex-shrink-0 items-center gap-3 border-b border-line bg-bg px-6 py-3"
      data-testid="references-shell-tabs"
    >
      <div className="k-stabs">
        {subs.map((s) => {
          const isActive = s.id === activeId;
          return (
            <Link
              key={s.id}
              href={s.href}
              data-active={isActive ? "true" : "false"}
              className={cn("k-stab", isActive && "k-stab--active")}
            >
              {s.label}
              {typeof s.count === "number" ? (
                <span className="k-stab__count">{s.count}</span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
