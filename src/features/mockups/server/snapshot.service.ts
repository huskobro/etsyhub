// Phase 8 Task 5 — setSnapshotId + RenderSnapshot servisleri.
//
// Spec §1.4: Phase 7 schema'sında dedicated `isHero` alanı yok; hero fallback
//            rank 0 = position ASC ilk SelectionItem (status≠rejected).
// Spec §1.4: aspectRatio fallback chain — generatedDesign.aspectRatio →
//            productType.aspectRatio → null (set-level skip eğer hepsi null).
// Spec §3.3: RenderSnapshot byte-stable JSON; coverPriority snapshot dışı
//            (catalog metadata; render zaten cover seçildikten sonra çalışır).
// Spec §3.4: setSnapshotId = sha256(stableStringify(payload)).
//
// Asset URL not: Prisma `Asset` modelinde `url` alanı yok; storage referansı
// `storageKey` üzerinden gider. Snapshot fingerprint için stable storageKey
// yeterli (URL signing TTL'i fingerprint'i kirletmemeli — public URL hash'a
// girerse signed URL rotation hash'ı bozar). Bu nedenle export adı
// `resolveAssetKey`.

import { createHash } from "node:crypto";
import type {
  SelectionSet,
  SelectionItem,
  GeneratedDesign,
  ProductType,
  Asset,
  MockupTemplate,
  MockupTemplateBinding,
} from "@prisma/client";
import type {
  LocalSharpConfig,
  ProviderConfig,
  RenderSnapshot,
} from "@/providers/mockup";

// Item with all relations needed for snapshot/handoff.
export type SelectionItemWithRelations = SelectionItem & {
  generatedDesign: GeneratedDesign & { productType: ProductType | null };
  sourceAsset: Asset;
  editedAsset: Asset | null;
};

export type SelectionSetWithItems = SelectionSet & {
  items: SelectionItemWithRelations[];
};

/**
 * Aspect ratio fallback chain (§1.4):
 *   1. selectionItem.generatedDesign.aspectRatio — primary
 *   2. selectionItem.generatedDesign.productType.aspectRatio — fallback
 *   3. null → variant skip (set-level fail eğer tüm variant'lar null)
 */
export function resolveAspectRatio(
  item: SelectionItemWithRelations,
): string | null {
  return (
    item.generatedDesign.aspectRatio ??
    item.generatedDesign.productType?.aspectRatio ??
    null
  );
}

/**
 * Asset key: editedAsset varsa o, yoksa sourceAsset (Phase 7 emsali — son
 * düzenlenmiş asset job'a girer). Schema'da `url` alanı yok; `storageKey`
 * stable identifier olarak yeterli (signed URL TTL'lerinden bağımsız).
 */
export function resolveAssetKey(item: SelectionItemWithRelations): string {
  return item.editedAsset?.storageKey ?? item.sourceAsset.storageKey;
}

/**
 * stableStringify — sorted keys ile deterministik JSON.
 * Aynı objeden her zaman aynı string (key order'a bağımsız). Hash input'u
 * için kritik; objelerin spread/structured-clone yolculuğu sonrası bile
 * fingerprint'i değişmez tutar.
 *
 * Array'ler sıralanmaz (input order korunur — semantic anlam taşır;
 * pack slot'ları gibi).
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
      .join(",") +
    "}"
  );
}

/**
 * setSnapshotId hesabı — §3.4.
 *
 * Snapshot payload'ı:
 *   - setId
 *   - status
 *   - finalizedAt (ISO string veya null)
 *   - items (filtered, ordered): id + position + assetKey + aspectRatio
 *
 * Aynı set + aynı items → aynı hash. V1'de duplicate detect yok ama hash
 * deterministik olduğu için ileride re-run idempotency için kullanılabilir.
 */
export function computeSetSnapshotId(set: SelectionSetWithItems): string {
  const payload = {
    setId: set.id,
    status: set.status,
    finalizedAt: set.finalizedAt?.toISOString() ?? null,
    items: set.items
      .filter((item) => item.status !== "rejected")
      .slice() // copy before sort (mutation safety)
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        id: item.id,
        position: item.position,
        assetKey: resolveAssetKey(item),
        aspectRatio: resolveAspectRatio(item),
      })),
  };
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

/**
 * RenderSnapshot — binding seviyesinde byte-stable JSON.
 *
 * Spec §3.3: coverPriority snapshot dışı (catalog metadata; render cover
 * seçildikten sonra çalışır — fingerprint'e dahil edilmesi gereksiz
 * volatility yaratır).
 */
export function snapshotForRender(
  binding: MockupTemplateBinding,
  template: MockupTemplate,
): RenderSnapshot {
  const config = binding.config as unknown as ProviderConfig;
  let snapshotConfig: RenderSnapshot["config"];

  if (config.providerId === "local-sharp") {
    // coverPriority strip — diğer alanları aynen aktar.
    const { coverPriority: _coverPriority, ...rest } =
      config as LocalSharpConfig;
    snapshotConfig = rest;
  } else {
    // dynamic-mockups (V2 stub) — coverPriority alanı yok zaten.
    snapshotConfig = config;
  }

  return {
    templateId: template.id,
    bindingId: binding.id,
    bindingVersion: binding.version,
    providerId: binding.providerId,
    config: snapshotConfig,
    templateName: template.name,
    aspectRatios: template.aspectRatios,
  };
}
