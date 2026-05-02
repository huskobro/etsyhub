/**
 * Phase 9 V1 Task 4 — Etsy V3 API client (provider implementation).
 *
 * V1 foundation: createDraftListing + uploadListingImage.
 * Endpoints:
 *   - POST /v3/application/shops/{shop_id}/listings (draft create)
 *   - POST /v3/application/shops/{shop_id}/listings/{listing_id}/images
 *
 * Auth: Bearer access_token + x-api-key (client_id) header (Etsy V3 dual auth).
 *
 * V1 foundation: gerçek HTTP path tam yazılı; ama live smoke external dependency
 * gerektirir. Test'lerde provider mock'lanır.
 */

import type {
  EtsyProvider,
  EtsyDraftListingInput,
  EtsyDraftListingOutput,
  EtsyImageUploadInput,
  EtsyImageUploadOutput,
} from "./types";
import { classifyEtsyHttpError, classifyEtsyNetworkError } from "./error-classifier";
import { EtsyValidationError } from "./errors";
import { getEtsyOAuthConfig } from "./oauth";

const ETSY_API_BASE = "https://api.etsy.com/v3/application";

export const etsyV3Provider: EtsyProvider = {
  id: "etsy-api",
  apiVersion: "v3",

  createDraftListing: async (input, options): Promise<EtsyDraftListingOutput> => {
    if (input.taxonomyId === null) {
      // V1 foundation: caller resolve etmiyor; provider explicit throw.
      // Phase 9.1+: ProductType → taxonomyId mapping.
      throw new EtsyValidationError(
        "taxonomy_id required (V1 foundation: caller henüz resolve etmiyor)",
      );
    }

    const cfg = getEtsyOAuthConfig();
    const url = `${ETSY_API_BASE}/shops/${options.shopId}/listings`;

    const body = new URLSearchParams();
    body.append("quantity", String(input.quantity));
    body.append("title", input.title);
    body.append("description", input.description);
    body.append("price", input.priceUsd.toFixed(2));
    body.append("who_made", input.whoMade);
    body.append("when_made", input.whenMade);
    body.append("taxonomy_id", String(input.taxonomyId));
    body.append("is_supply", "false");
    body.append("type", input.isDigital ? "download" : "physical");
    body.append("state", "draft"); // V1 lock: ASLA "active" göndermiyoruz
    for (const tag of input.tags) body.append("tags", tag);
    for (const m of input.materials) body.append("materials", m);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${options.accessToken}`,
          "x-api-key": cfg.clientId,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: AbortSignal.timeout(45_000),
      });
    } catch (err) {
      classifyEtsyNetworkError(err);
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const retryAfter = res.headers.get("retry-after");
      classifyEtsyHttpError({
        status: res.status,
        body: errBody,
        retryAfterSeconds: retryAfter ? Number(retryAfter) : undefined,
      });
    }

    const json = (await res.json()) as {
      listing_id: number;
      state: string;
    };

    if (json.state !== "draft") {
      // V1 lock — state "draft" beklenmedi: provider misuse
      throw new EtsyValidationError(
        `Etsy listing draft state beklenmiyor: ${json.state}`,
      );
    }

    return {
      etsyListingId: String(json.listing_id),
      state: "draft",
    };
  },

  uploadListingImage: async (input, options): Promise<EtsyImageUploadOutput> => {
    const cfg = getEtsyOAuthConfig();
    const url = `${ETSY_API_BASE}/shops/${options.shopId}/listings/${input.etsyListingId}/images`;

    // multipart/form-data — Etsy V3 image upload endpoint sözleşmesi.
    const formData = new FormData();
    if (input.imageSource.kind === "url") {
      // V1 foundation: Etsy URL fetch desteklemiyor (multipart blob bekler).
      // Caller önce URL'den buffer'a indirip kind:"buffer" geçmeli.
      throw new EtsyValidationError(
        "Image upload: URL kind V1'de desteklenmiyor; caller buffer geçmeli (storage.fetchObject)",
      );
    }

    const blob = new Blob([new Uint8Array(input.imageSource.data)], {
      type: input.imageSource.mimeType,
    });
    formData.append("image", blob);
    formData.append("rank", String(input.rank));

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${options.accessToken}`,
          "x-api-key": cfg.clientId,
          // Content-Type: NOT set — fetch FormData'da otomatik multipart boundary üretir
        },
        body: formData,
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      classifyEtsyNetworkError(err);
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const retryAfter = res.headers.get("retry-after");
      classifyEtsyHttpError({
        status: res.status,
        body: errBody,
        retryAfterSeconds: retryAfter ? Number(retryAfter) : undefined,
      });
    }

    const json = (await res.json()) as {
      listing_image_id: number;
      rank: number;
    };

    return {
      etsyImageId: String(json.listing_image_id),
      rank: json.rank,
    };
  },
};
