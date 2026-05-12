"use client";

/**
 * ReferencesAddReferenceMount — Phase 26 canonical intake mount.
 *
 * Pool/Inbox/Stories/Shops/Collections sub-view'larında aynı CTA pattern'ı:
 * stateless `<Link href="?add=ref">` topbar action slot'una konur. Bu mount
 * component her sayfada bir kere render edilir; URL'de `?add=ref` görünür
 * görünmez `AddReferenceDialog` açılır.
 *
 * Kapanışta `router.replace(pathname)` ile query temizlenir; modal
 * state'i URL truth (Phase 22 pattern'ı reuse).
 *
 * `?add=ref&tab=upload` / `?add=ref&tab=bookmark` ile direkt tab açılışı
 * destekli (ileride dashboard quick-action veya empty-state shortcut'ları
 * bunu kullanır).
 */

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AddReferenceDialog } from "./add-reference-dialog";

type ProductTypeOption = { id: string; displayName: string };
type CollectionOption = { id: string; name: string };

export function ReferencesAddReferenceMount({
  productTypes,
  collections,
}: {
  productTypes: ProductTypeOption[];
  collections: CollectionOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [localOpen, setLocalOpen] = useState(false);

  const isUrlOpen = searchParams?.get("add") === "ref";
  const open = localOpen || isUrlOpen;

  // Optional tab pre-selection via ?tab= query.
  const tabParam = searchParams?.get("tab");
  const defaultTab =
    tabParam === "upload" || tabParam === "bookmark" ? tabParam : "url";

  const close = () => {
    setLocalOpen(false);
    if (!searchParams) return;
    if (searchParams.get("add") === "ref" || searchParams.get("tab")) {
      const next = new URLSearchParams(searchParams);
      next.delete("add");
      next.delete("tab");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }
  };

  // No-op effect — modal lifecycle bound to URL. State sync left here in
  // case a future local trigger is added (e.g. empty-state CTA).
  useEffect(() => {
    // intentionally empty
  }, [isUrlOpen]);

  if (!open) return null;

  return (
    <AddReferenceDialog
      onClose={close}
      onCreated={() => {
        router.refresh();
      }}
      productTypes={productTypes}
      collections={collections}
      defaultTab={defaultTab}
    />
  );
}
