"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
        <p className="text-xs text-text-muted">Fikir toplamanın en kısa yolu.</p>
      </div>
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
