// R11.14.6 — App-wide Topbar (v4 base.jsx Topbar parity).
// Source: docs/design-system/kivasy/ui_kits/kivasy/v4/base.jsx → Topbar
//
// Tüm uygulama yüzeylerinin (References / Library / Batches / Selections /
// Products / Templates / Settings / Overview / Admin) tek doğruluk
// kaynağı. Önceki rollout'larda her sayfa kendi `<header>` markup'ını
// inline yazıyordu (text-lg = 17px). v5/v4 hedef = 24px k-display +
// inline mono subtitle + h-16 + pl-6 pr-5.
//
// References ailesinde önce ReferencesTopbar variant'ı vardı; bu generic
// AppTopbar onun yerine geçer (References shell page'leri ReferencesTopbar
// üzerinden yine tüketebilir; ReferencesTopbar şimdi AppTopbar'ın
// sub-class'ı olarak kalır).
//
// Slot'lar:
//   - title: required (h1 metni)
//   - subtitle: optional (mono inline)
//   - actions: optional (sağ trailing buton(lar))
//   - back: optional (sol back-arrow link)
//   - status: optional (h1 yanında dot badge)

import type { ReactNode } from "react";

interface AppTopbarProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  back?: { href: string; label?: string };
  status?: { tone: "success" | "warning" | "danger" | "info"; label: string };
}

export function AppTopbar({
  title,
  subtitle,
  actions,
  back,
  status,
}: AppTopbarProps) {
  return (
    <header className="flex h-16 flex-shrink-0 items-center gap-4 border-b border-line bg-bg pl-6 pr-5">
      {back ? (
        <a
          href={back.href}
          className="k-iconbtn"
          data-size="sm"
          aria-label={back.label ?? "Back"}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <h1 className="k-display truncate text-[24px] font-semibold leading-none tracking-tight text-ink">
            {title}
          </h1>
          {subtitle ? (
            <span className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
              {subtitle}
            </span>
          ) : null}
          {status ? (
            <span className="k-badge" data-tone={status.tone}>
              <span className="dot" />
              {status.label}
            </span>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
