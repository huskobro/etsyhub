"use client";

import { useState } from "react";
import { BulkActionBar } from "@/components/ui/BulkActionBar";
import { Button } from "@/components/ui/Button";

/**
 * Primitive demo — BulkActionBar görünürlük + dismiss davranışı.
 *
 * Bookmarks'a özel aksiyon dili primitive'e sızmıyor — burada "Referansa ekle"
 * vb. sadece örnek. Ekran migrasyonunda bu slot ekran tarafından doldurulacak.
 */
export function BulkBarDemo() {
  const [count, setCount] = useState(3);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCount((c) => c + 1)}
        >
          Seçim ekle
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCount((c) => Math.max(0, c - 1))}
        >
          Seçim azalt
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setCount(0)}>
          Sıfırla
        </Button>
        <span className="font-mono text-xs text-text-subtle">
          selectedCount={count}
        </span>
      </div>
      <BulkActionBar
        selectedCount={count}
        label={count > 0 ? `${count} bookmark seçildi` : undefined}
        actions={
          <>
            <Button variant="ghost" size="sm">
              Referansa ekle
            </Button>
            <Button variant="ghost" size="sm">
              Koleksiyona
            </Button>
            <Button variant="ghost" size="sm">
              Benzerini yap
            </Button>
            <Button variant="ghost" size="sm">
              Arşivle
            </Button>
          </>
        }
        onDismiss={() => setCount(0)}
      />
      {count === 0 ? (
        <div className="font-mono text-xs text-text-subtle">
          selectedCount=0 iken bar render olmuyor (null döner) — boş alan yok.
        </div>
      ) : null}
    </div>
  );
}
