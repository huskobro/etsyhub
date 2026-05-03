// Phase 9 V1 Finalization — Etsy readiness diagnostics endpoint.
//
// Settings panelinde QA/admin "submit live success için neye hazırım?"
// sorusunu tek bakışta cevaplar. 3 boyut:
//   1. OAuth credentials env (ETSY_CLIENT_ID/SECRET/REDIRECT_URI)
//   2. Taxonomy mapping env (ETSY_TAXONOMY_MAP_JSON)
//   3. Connection state (kullanıcının EtsyConnection row'u + token validity)
//
// Honest fail disipline: bu endpoint sadece okuma yapar; live Etsy çağrısı
// YOK. Token expiry sadece DB'deki `tokenExpires` ile karşılaştırılır;
// gerçek Etsy /users/me ya da refresh denemesi yapılmaz.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { isEtsyConfigured } from "@/providers/etsy/oauth";
import { getEtsyConnectionStatus } from "@/providers/etsy/connection.service";
import {
  EtsyTaxonomyConfigError,
  EtsyTaxonomyMissingError,
  resetTaxonomyCache,
  resolveEtsyTaxonomyId,
} from "@/providers/etsy/taxonomy";

export type EtsyReadinessSummary = {
  /** OAuth credentials env (ETSY_CLIENT_ID/SECRET/REDIRECT_URI) */
  oauthCredentials: {
    state: "ok" | "missing";
    detail: string;
  };
  /** Taxonomy mapping env (ETSY_TAXONOMY_MAP_JSON) */
  taxonomyMapping: {
    state: "ok" | "missing" | "invalid";
    /** Sample lookup: V1 default ProductType seed key. */
    sampleKey: string;
    sampleResolved: number | null;
    detail: string;
  };
  /** Kullanıcının Etsy bağlantısı (DB) */
  connection: {
    state: "not_configured" | "not_connected" | "expired" | "connected";
    shopName: string | null;
    tokenExpires: string | null;
  };
  /** Tüm 3 boyut OK mi? Submit pipeline live başarı için hepsi gerek. */
  liveReady: boolean;
};

export const GET = withErrorHandling(async () => {
  const user = await requireUser();

  // 1. OAuth credentials env
  const oauthOk = isEtsyConfigured();
  const oauthCredentials = oauthOk
    ? {
        state: "ok" as const,
        detail:
          "ETSY_CLIENT_ID, ETSY_CLIENT_SECRET ve ETSY_REDIRECT_URI .env dosyasında tanımlı.",
      }
    : {
        state: "missing" as const,
        detail:
          "ETSY_CLIENT_ID, ETSY_CLIENT_SECRET veya ETSY_REDIRECT_URI eksik. Sistem yöneticisinin .env dosyasını tamamlaması gerek.",
      };

  // 2. Taxonomy mapping env — sample key ile çözmeyi dene (V1 default: "wall_art").
  // resetTaxonomyCache: env hot-reload — admin .env'e yeni key eklediyse 30s
  // polling içinde diff yakalanır, full restart gerekmesin.
  resetTaxonomyCache();
  const sampleKey = "wall_art";
  let taxonomyState: "ok" | "missing" | "invalid";
  let sampleResolved: number | null = null;
  let taxonomyDetail: string;
  try {
    sampleResolved = resolveEtsyTaxonomyId(sampleKey);
    taxonomyState = "ok";
    taxonomyDetail = `ETSY_TAXONOMY_MAP_JSON tanımlı; sample "${sampleKey}" → ${sampleResolved}.`;
  } catch (err) {
    if (err instanceof EtsyTaxonomyConfigError) {
      taxonomyState = "invalid";
      taxonomyDetail =
        "ETSY_TAXONOMY_MAP_JSON formatı bozuk (geçersiz JSON, array, veya non-numeric değer). Düzeltilmesi gerek.";
    } else if (err instanceof EtsyTaxonomyMissingError) {
      taxonomyState = "missing";
      if (process.env.ETSY_TAXONOMY_MAP_JSON) {
        // Env var ama bu key yok → kısmi
        taxonomyDetail = `ETSY_TAXONOMY_MAP_JSON tanımlı ancak "${sampleKey}" key'i yok. Submit'te kullanılan ProductType key'leri için tam liste gerekli.`;
      } else {
        taxonomyDetail =
          "ETSY_TAXONOMY_MAP_JSON eksik. Submit canlı başarı için admin'in developer.etsy.com /seller-taxonomy/nodes endpoint'inden ID'leri çıkarıp .env'e koyması gerek.";
      }
    } else {
      // Beklenmeyen hata — invalid bucket'a düşür (honest)
      taxonomyState = "invalid";
      taxonomyDetail =
        "ETSY_TAXONOMY_MAP_JSON okunamadı (beklenmeyen hata). Düzeltilmesi gerek.";
    }
  }

  // 3. Connection state (mevcut servis — non-throw 4-state).
  const connStatus = await getEtsyConnectionStatus(user.id);
  const connection: EtsyReadinessSummary["connection"] =
    connStatus.state === "connected"
      ? {
          state: "connected",
          shopName: connStatus.shopName,
          tokenExpires: connStatus.tokenExpires?.toISOString() ?? null,
        }
      : connStatus.state === "expired"
        ? {
            state: "expired",
            shopName: connStatus.shopName,
            tokenExpires: connStatus.expiredAt.toISOString(),
          }
        : {
            state: connStatus.state,
            shopName: null,
            tokenExpires: null,
          };

  const liveReady =
    oauthCredentials.state === "ok" &&
    taxonomyState === "ok" &&
    connection.state === "connected";

  const summary: EtsyReadinessSummary = {
    oauthCredentials,
    taxonomyMapping: {
      state: taxonomyState,
      sampleKey,
      sampleResolved,
      detail: taxonomyDetail,
    },
    connection,
    liveReady,
  };

  return NextResponse.json({ summary });
});
