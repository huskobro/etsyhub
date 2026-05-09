// R11.14.5 — References family topbar (v4 base.jsx Topbar parity).
// Source: docs/design-system/kivasy/ui_kits/kivasy/v4/base.jsx → Topbar
//
// Spec:
//   - h-16 (64px) flex-shrink-0 + pl-6 pr-5 + border-b
//   - h1: k-display text-[24px] font-semibold leading-none tracking-tight
//   - subtitle: k-mono text-[10.5px] uppercase tracking-meta INLINE
//     baseline-aligned to h1 (yan yana, gap-3)
//   - actions: optional trailing slot (CTA buttons)
//
// Tüm References sub-route'ları (Pool/Stories/Inbox/Shops/Collections)
// bunu tüketir; tek doğruluk kaynağı.

import type { ReactNode } from "react";

export function ReferencesTopbar({
  title = "References",
  subtitle,
  actions,
}: {
  title?: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex h-16 flex-shrink-0 items-center gap-4 border-b border-line bg-bg pl-6 pr-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <h1 className="k-display truncate text-[24px] font-semibold leading-none tracking-tight text-ink">
            {title}
          </h1>
          <span className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            {subtitle}
          </span>
        </div>
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
