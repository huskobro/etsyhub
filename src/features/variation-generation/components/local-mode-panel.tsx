"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocalFolders } from "../queries/use-local-folders";
import { useLocalAssets } from "../queries/use-local-assets";
import { useScanFolders } from "../mutations/use-scan-folders";
import { useLocalLibrarySettings } from "../queries/use-local-library-settings";
import { LocalFolderCard } from "./local-folder-card";
import { LocalAssetCard } from "./local-asset-card";
import { LocalAssetQuickLook } from "./local-asset-quicklook";
import { Button } from "@/components/ui/Button";
import { StateMessage } from "@/components/ui/StateMessage";
import { Chip } from "@/components/ui/Chip";

// Phase 5 §5.2 — Browse-first (R16): önce folder grid, klasör seçilince
// asset grid. Tarama (scan) tetiklenebilir; rootFolderPath set değilse
// backend 400 döner ve mutation hata mesajı kullanıcıya gösterilir.
//
// Pass 22 — URL state. State `useState` yerine search params (folder,
// asset, neg). Refresh sonrası aynı state geri gelir, back/forward
// browser navigation düzgün çalışır, ekran durumu paylaşılabilir.
// Phase 8 emsali: useMockupPackState/useMockupOverlayState pattern'i.
export function LocalModePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL state'i oku
  const folder = searchParams.get("folder") || null;
  const negativesOnly = searchParams.get("neg") === "1";
  const quickLookId = searchParams.get("asset") || null;
  const quickLookOpen = quickLookId !== null;

  // URL state'i güncelle (shallow router.replace — server re-fetch yok)
  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(patch)) {
        if (val === null || val === "") {
          params.delete(key);
        } else {
          params.set(key, val);
        }
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const setFolder = (next: string | null) => {
    // Klasör değişince asset state'i de temizle (önceki klasörün asset id
    // yeni klasörde geçersiz olur)
    updateParams({ folder: next, asset: null });
  };
  const setNegativesOnly = (next: boolean) => {
    updateParams({ neg: next ? "1" : null });
  };
  const setQuickLookId = (next: string | null) => {
    updateParams({ asset: next });
  };

  const folders = useLocalFolders();
  const assets = useLocalAssets(folder, negativesOnly);
  const scan = useScanFolders();
  const settings = useLocalLibrarySettings();
  const rootPath = settings.data?.settings.rootFolderPath ?? null;

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
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <div className="text-sm text-text-muted">
              Lokal kütüphane — toplam {list.length} klasör
            </div>
            {rootPath ? (
              <div className="text-xs text-text-muted">
                Kök:{" "}
                <span className="break-all font-mono text-text">
                  {rootPath}
                </span>
              </div>
            ) : (
              <div className="text-xs text-warning">
                Kök klasör tanımlı değil — Ayarlar &rsaquo; Yerel kütüphane.
              </div>
            )}
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
            onToggle={() => setNegativesOnly(!negativesOnly)}
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
      {/* Pass 21 — Breadcrumb: kök yol + klasör adı + asset sayısı.
          Önceden sadece "Klasör: {name}" diyordu; root path ve asset
          count görünmüyordu. */}
      <div className="flex flex-wrap items-center gap-1 text-xs text-text-muted">
        <span className="font-medium text-text">Lokal kütüphane</span>
        <span>›</span>
        {rootPath ? (
          <span className="break-all font-mono">{rootPath}</span>
        ) : (
          <span className="italic">kök tanımsız</span>
        )}
        <span>›</span>
        <span className="font-medium text-text">{folder}</span>
        {assetList.length > 0 ? (
          <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 font-medium">
            {assetList.length} görsel
          </span>
        ) : null}
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
            <LocalAssetCard
              key={a.id}
              asset={a}
              onPreview={(id) => setQuickLookId(id)}
            />
          ))}
        </div>
      )}

      {/* Pass 21 — QuickLook lightbox.
          Tıklanan görsel için büyük preview + prev/next + inline actions. */}
      <LocalAssetQuickLook
        open={quickLookOpen}
        onOpenChange={(o) => {
          if (!o) setQuickLookId(null);
        }}
        assets={assetList}
        currentId={quickLookId}
        onCurrentIdChange={(id) => setQuickLookId(id)}
      />
    </div>
  );
}
