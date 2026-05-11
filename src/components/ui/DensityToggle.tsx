"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, Rows3 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Kivasy DensityToggle — Comfortable / Dense segment.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/base.jsx → Density
 * (`.k-segment`). First-class control on every list/grid/table screen per
 * docs/IMPLEMENTATION_HANDOFF.md §1 design principle 8.
 *
 * Persists per-surface in localStorage. The `surfaceKey` namespaces the
 * preference so e.g. /library and /batches keep separate density choices.
 */

export type Density = "comfortable" | "dense";

interface DensityToggleProps {
  /** localStorage key namespace, e.g. "library" or "batches". */
  surfaceKey: string;
  /** Default state if no stored preference. */
  defaultValue?: Density;
  /** Optional change observer (re-render outer state). */
  onChange?: (next: Density) => void;
  className?: string;
}

const STORAGE_PREFIX = "kivasy.density.";

export function DensityToggle({
  surfaceKey,
  defaultValue = "comfortable",
  onChange,
  className,
}: DensityToggleProps) {
  const [value, setValue] = useState<Density>(defaultValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_PREFIX + surfaceKey);
      if (stored === "comfortable" || stored === "dense") {
        setValue(stored);
      }
    } catch {
      // localStorage unavailable (private mode, blocked) — fall back to
      // defaultValue silently. Density is a UX preference, not load-bearing.
    }
    setHydrated(true);
  }, [surfaceKey]);

  function handleChange(next: Density) {
    setValue(next);
    try {
      window.localStorage.setItem(STORAGE_PREFIX + surfaceKey, next);
    } catch {
      // ignore
    }
    onChange?.(next);
  }

  return (
    <div
      role="group"
      aria-label="Density"
      data-density-hydrated={hydrated || undefined}
      className={cn(
        "inline-flex items-center rounded-md border border-line bg-k-bg-2 p-0.5",
        className,
      )}
    >
      <DensityButton
        active={value === "comfortable"}
        label="Comfortable"
        icon={<LayoutGrid className="h-3 w-3" aria-hidden />}
        onClick={() => handleChange("comfortable")}
      />
      <DensityButton
        active={value === "dense"}
        label="Dense"
        icon={<Rows3 className="h-3 w-3" aria-hidden />}
        onClick={() => handleChange("dense")}
      />
    </div>
  );
}

function DensityButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-paper text-ink shadow-card"
          : "text-ink-3 hover:text-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/** Read the persisted density on the client (used by URL-state-free
 *  surfaces that need to know the saved preference at hydration). */
export function readStoredDensity(
  surfaceKey: string,
  fallback: Density = "comfortable",
): Density {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(STORAGE_PREFIX + surfaceKey);
    if (v === "comfortable" || v === "dense") return v;
  } catch {
    // ignore
  }
  return fallback;
}
