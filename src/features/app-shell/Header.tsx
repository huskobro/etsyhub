"use client";

import { signOut } from "next-auth/react";
import type { UserRole } from "@prisma/client";

export function Header({ email, role }: { email: string; role: UserRole }) {
  return (
    <header className="flex h-header items-center justify-between border-b border-border bg-surface px-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-text-muted">Çalışma Alanı</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-text">{email}</span>
        <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs text-text-muted">
          {role}
        </span>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-muted"
        >
          Çıkış
        </button>
      </div>
    </header>
  );
}
