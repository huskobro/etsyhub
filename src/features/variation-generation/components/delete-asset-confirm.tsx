"use client";

import type { LocalLibraryAsset } from "@prisma/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDeleteLocalAsset } from "../mutations/use-delete-local-asset";

// Q4 — sert uyarı: silme hem DB hem disk'i etkiler. ConfirmDialog destructive
// tone (kırmızı CTA) + dosya/klasör/path metadata. Mutation hata fırlatırsa
// dialog açık kalır (errorMessage), kullanıcı bilinçli retry/cancel seçer.
export function DeleteAssetConfirm({
  asset,
  open,
  onOpenChange,
}: {
  asset: LocalLibraryAsset;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const del = useDeleteLocalAsset();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Görseli sil — geri alınamaz"
      description={
        <>
          <span className="block">Bu görsel:</span>
          <ul className="mt-2 list-disc pl-5 text-xs text-text">
            <li>Kivasy uygulamasından silinecek</li>
            <li>
              <strong>DİSKTEN de silinecek (kalıcı, geri alınamaz)</strong>
            </li>
          </ul>
          <dl className="mt-3 grid grid-cols-[6rem_1fr] gap-x-2 gap-y-1 text-xs text-text">
            <dt className="text-text-muted">Dosya</dt>
            <dd className="break-all">{asset.fileName}</dd>
            <dt className="text-text-muted">Klasör</dt>
            <dd className="break-all">{asset.folderName}</dd>
            <dt className="text-text-muted">Yol</dt>
            <dd className="break-all">{asset.filePath}</dd>
          </dl>
        </>
      }
      confirmLabel="Delete from disk"
      cancelLabel="Vazgeç"
      tone="destructive"
      busy={del.isPending}
      errorMessage={del.error?.message ?? null}
      onConfirm={async () => {
        await del.mutateAsync(asset.id);
        onOpenChange(false);
      }}
    />
  );
}
