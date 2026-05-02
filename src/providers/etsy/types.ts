/**
 * Phase 9 V1 Task 4 — Etsy provider abstraction.
 *
 * Capability contract — Etsy V3 API (https://developer.etsy.com/documentation/).
 * V1 kapsamı: draft listing create + image upload + connection lookup.
 * Active publish YOK (kullanıcı Etsy admin'de manuel "Publish" butonuna
 * basacak — V1 sözleşmesi).
 *
 * Provider stateless tutulur; caller (submit service) connection'ı resolve
 * edip access token'ı per-call geçer (Phase 6 review provider simetrisi).
 */

import type { EtsyConnection } from "@prisma/client";

/**
 * Etsy V3 listing draft create body — minimal V1 alanları.
 *
 * Etsy listings (POST /v3/application/shops/{shop_id}/listings) zorunlu:
 *   - quantity (V1: 1 sabit, digital download odaklı)
 *   - title (max 140)
 *   - description (en az 1)
 *   - price (USD float, taxable)
 *   - who_made (V1: "i_did" sabit)
 *   - when_made (V1: "made_to_order" sabit)
 *   - taxonomy_id (V1: caller resolve eder; foundation'da `string | null`)
 *
 * Opsiyonel:
 *   - tags[] (max 13, each ≤20 char)
 *   - materials[]
 *   - is_digital (V1: true varsayılan — Etsy printable/digital download odak)
 *
 * is_supply, shop_section_id vb. V1.1+ carry-forward.
 */
export type EtsyDraftListingInput = {
  title: string;
  description: string;
  priceUsd: number;          // dollars (cent / 100)
  tags: string[];
  materials: string[];
  taxonomyId: number | null; // V1: resolve etmiyoruz; null geçilirse provider explicit throw
  isDigital: boolean;        // V1 default true (caller geçer)
  quantity: number;          // V1 default 1
  whoMade: "i_did" | "someone_else" | "collective";  // V1: "i_did"
  whenMade: string;          // Etsy enum string, V1: "made_to_order"
};

export type EtsyDraftListingOutput = {
  /** Etsy listing_id (number, ama provider string'e çeviriyor — DB'de etsyListingId String). */
  etsyListingId: string;
  /** Etsy draft state ("draft" | "active" — V1 sadece "draft" kullanılır). */
  state: "draft";
};

/**
 * Image upload — listing'e image attach.
 *
 * V1 foundation: contract var, service'ten çağrılır; gerçek upload aksiyonu
 * external dependency'ye kadar bekler. Endpoint payload (multipart) burada
 * tanımlanır, provider impl'i gerçek HTTP'yi yapar.
 */
export type EtsyImageUploadInput = {
  etsyListingId: string;
  /** Storage'tan Buffer ya da URL. V1 foundation: URL ya da Buffer. */
  imageSource: { kind: "url"; url: string } | { kind: "buffer"; data: Buffer; mimeType: string };
  /** rank: 1-10 (Etsy listing image sıra). */
  rank: number;
};

export type EtsyImageUploadOutput = {
  /** Etsy listing_image_id. */
  etsyImageId: string;
  rank: number;
};

/**
 * Provider çağrı opsiyonları — caller per-call access token resolve eder.
 * Phase 6 review provider simetrisi.
 */
export type EtsyProviderRunOptions = {
  /** Decrypted access token (caller decryptSecret üzerinden çıkartır). */
  accessToken: string;
  /** Etsy shop_id (numeric, ama string olarak — connection.shopId). */
  shopId: string;
};

/**
 * V1 Etsy provider — draft create + image upload yapar.
 * V1.1+: update, deactivate, publish (admin gözetimi altında).
 */
export interface EtsyProvider {
  /** Provider id, snapshot için: "etsy-api". */
  id: string;
  /** Etsy V3 API version label, örn. "v3". */
  apiVersion: string;
  createDraftListing: (
    input: EtsyDraftListingInput,
    options: EtsyProviderRunOptions,
  ) => Promise<EtsyDraftListingOutput>;
  uploadListingImage: (
    input: EtsyImageUploadInput,
    options: EtsyProviderRunOptions,
  ) => Promise<EtsyImageUploadOutput>;
}

/**
 * Connection lookup output — submit service tüketir.
 * `accessToken` decrypted plain string (caller layer'da çözülür).
 */
export type EtsyConnectionResolved = {
  connection: EtsyConnection;
  accessToken: string;
  shopId: string;
};
