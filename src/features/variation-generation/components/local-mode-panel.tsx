"use client";

import { useState } from "react";
import { useLocalFolders } from "../queries/use-local-folders";
import { useLocalAssets } from "../queries/use-local-assets";
import { useScanFolders } from "../mutations/use-scan-folders";
import { LocalFolderCard } from "./local-folder-card";
import { LocalAssetCard } from "./local-asset-card";
import { Button } from "@/components/ui/Button";
import { StateMessage } from "@/components/ui/StateMessage";
import { Chip } from "@/components/ui/Chip";

// Phase 5 §5.2 — Browse-first (R16): önce folder grid, klasör seçilince
// asset grid. Tarama (scan) tetiklenebilir; rootFolderPath set değilse
// backend 400 döner ve mutation hata mesajı kullanıcıya gösterilir.
export function LocalModePanel() {
  const [folder, setFolder] = useState<string | null>(null);
  const [negativesOnly, setNegativesOnly] = useState(false);
  const folders = useLocalFolders();
  const assets = useLocalAssets(folder, negativesOnly);
  const scan = useScanFolders();

  if (folders.isLoading) {
    return <StateMessage tone="neutral" title="Klasörler yükleniyor…" />;
  }
  if (folders.isError) {
    return (
      <StateMessage
        tone="error"
        title="Klasörler yüklenemedi"
        body={(folders.error as Error).message}
      />
    );
  }

  if (folder == null) {
    const list = folders.data?.folders ?? [];
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-text-muted">
            Lokal kütüphane — toplam {list.length} klasör
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="secondary"
              onClick={() => scan.mutate()}
              loading={scan.isPending}
            >
              {scan.isPending ? "Taranıyor…" : "Yenile"}
            </Button>
            {scan.error ? (
              <span className="text-xs text-danger">
                {(scan.error as Error).message}
              </span>
            ) : null}
          </div>
        </div>
        {list.length === 0 ? (
          <StateMessage
            tone="neutral"
            title="Henüz indeks yok"
            body="Ayarlardan kök klasörü belirledikten sonra 'Yenile' ile lokal kütüphaneyi tara."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {list.map((f) => (
              <LocalFolderCard
                key={f.path}
                folder={f}
                onOpen={() => setFolder(f.name)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const assetList = assets.data?.assets ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => setFolder(null)}>
          ← Tüm klasörler
        </Button>
        <div className="flex items-center gap-2">
          <Chip
            active={negativesOnly}
            onToggle={() => setNegativesOnly((v) => !v)}
          >
            Yalnız negatifler
          </Chip>
          <Button
            variant="secondary"
            onClick={() => scan.mutate()}
            loading={scan.isPending}
          >
            Yenile
          </Button>
        </div>
      </div>
      <div className="text-sm text-text-muted">
        Klasör: <span className="font-medium text-text">{folder}</span>
      </div>
      {assets.isLoading ? (
        <StateMessage tone="neutral" title="Görseller yükleniyor…" />
      ) : assets.isError ? (
        <StateMessage
          tone="error"
          title="Görseller yüklenemedi"
          body={(assets.error as Error).message}
        />
      ) : assetList.length === 0 ? (
        <StateMessage
          tone="neutral"
          title={
            negativesOnly
              ? "Bu klasörde negatif işaretli görsel yok"
              : "Bu klasörde görsel yok"
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {assetList.map((a) => (
            <LocalAssetCard key={a.id} asset={a} />
          ))}
        </div>
      )}
    </div>
  );
}
