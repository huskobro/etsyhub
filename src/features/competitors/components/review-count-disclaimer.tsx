"use client";

import { REVIEW_COUNT_DISCLAIMER } from "../constants";

/**
 * Ranking listelerinde tekrar eden uyarı banner'ı.
 * Metin `@/features/competitors/constants` içinden geldiği için tek noktadan
 * değiştirilebilir (ranking-service de buradan re-export eder).
 */
export function ReviewCountDisclaimer({
  className,
}: {
  className?: string;
}) {
  return (
    <p
      role="note"
      className={[
        "rounded-md border border-border bg-surface-muted px-3 py-2 text-xs text-text-muted",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {REVIEW_COUNT_DISCLAIMER}
    </p>
  );
}
