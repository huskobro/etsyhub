"use client";

/**
 * DashboardQuickActions — DEAD CODE (Phase 26 audit).
 *
 * Bu component hiçbir page'den render edilmiyor (Overview sayfasında
 * yok, dashboard-quick-actions sadece test fixture'ında kullanılıyor).
 * TR sızıntı + DS-tonsuz primitives içerir; Phase 18 i18n parity turu
 * atlamış. Operatöre görünmediği için doğrudan zarar vermiyor.
 *
 * Phase 26 ile intake akışı `AddReferenceDialog`'a (DS B5 canonical)
 * birleşti. Bu component'in muhtemel evrim yolları:
 *
 *   1. Silinir (operatör overview'da bunu görmüyor — etki yok)
 *   2. AddReferenceDialog'u açan bir CTA olarak yeniden bağlanır
 *      (örn. Overview "Quick Add Reference" tile)
 *   3. Olduğu gibi kalır (tests/unit/dashboard-page.test.tsx fixture)
 *
 * Karar ayrı bir küçük temizlik turunda alınır.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImportUrlDialog } from "@/features/bookmarks/components/import-url-dialog";
import { UploadImageDialog } from "@/features/bookmarks/components/upload-image-dialog";
import { CollectionCreateDialog } from "@/features/collections/components/collection-create-dialog";

export function DashboardQuickActions() {
  const router = useRouter();
  const qc = useQueryClient();
  const [urlOpen, setUrlOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  const createCollection = useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      kind: "BOOKMARK" | "REFERENCE" | "MIXED";
    }) => {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        throw new Error(
          (await res.json()).error ?? "Koleksiyon oluşturulamadı",
        );
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      setCollectionOpen(false);
      setCollectionError(null);
      router.refresh();
    },
    onError: (err) => setCollectionError((err as Error).message),
  });

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-5 shadow-card">
      <div>
        <h2 className="text-sm font-semibold text-text">Hızlı Aksiyonlar</h2>
        <p className="text-xs text-text-muted">
          Fikir topla, üretime geç ve karar ver.
        </p>
      </div>
      {/* Pass 34 — İki sıra: üst (fikir toplama, mevcut), alt (üretim &
          karar, yeni). Üretim akışı Phase 7+ canlı; dashboard'dan link
          olmaması discovery sürtünmesiydi. */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setUrlOpen(true)}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
        >
          URL&apos;den Bookmark
        </button>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="rounded-md border border-border bg-bg px-3 py-2 text-sm font-medium text-text hover:bg-surface-muted"
        >
          Görsel Yükle
        </button>
        <button
          type="button"
          onClick={() => {
            setCollectionError(null);
            setCollectionOpen(true);
          }}
          className="rounded-md border border-border bg-bg px-3 py-2 text-sm font-medium text-text hover:bg-surface-muted"
        >
          Yeni Koleksiyon
        </button>
      </div>
      {/* Pass 34 — Production link'leri. Üretim → Karar → Seçim akışına
          tek tıkla giriş. Aktif sayfaya hover-state ayrı tutuldu. */}
      <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-3">
        <Link
          href="/references"
          className="rounded-md border border-border bg-bg px-3 py-2 text-sm font-medium text-text hover:border-border-strong hover:bg-surface-muted"
          data-testid="quick-action-references"
        >
          Üret · Referanslar
        </Link>
        <Link
          href="/review"
          className="rounded-md border border-border bg-bg px-3 py-2 text-sm font-medium text-text hover:border-border-strong hover:bg-surface-muted"
          data-testid="quick-action-review"
        >
          Karar · Review
        </Link>
        <Link
          href="/selections"
          className="rounded-md border border-border bg-bg px-3 py-2 text-sm font-medium text-text hover:border-border-strong hover:bg-surface-muted"
          data-testid="quick-action-selection"
        >
          Seç · Selection Studio
        </Link>
      </div>

      {urlOpen ? (
        <ImportUrlDialog
          onClose={() => setUrlOpen(false)}
          onCreated={() => router.refresh()}
        />
      ) : null}

      {uploadOpen ? (
        <UploadImageDialog
          onClose={() => setUploadOpen(false)}
          onCreated={() => router.refresh()}
        />
      ) : null}

      {collectionOpen ? (
        <CollectionCreateDialog
          onClose={() => setCollectionOpen(false)}
          onSubmit={(input) => createCollection.mutate(input)}
          busy={createCollection.isPending}
          error={collectionError}
        />
      ) : null}
    </div>
  );
}
