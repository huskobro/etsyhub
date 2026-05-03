// Phase 9 V1 — Etsy OAuth callback route.
//
// Etsy'den dönüş: ?code=...&state=... (success) veya ?error=...&error_description=... (fail).
//
// Pipeline:
//   1. Cookie'den state + verifier oku (yoksa /settings?etsy=missing-state)
//   2. Cookie state ↔ query state match (mismatch → /settings?etsy=state-mismatch)
//   3. Etsy error query → settings'e error redirect
//   4. Token exchange (oauth.exchangeAuthorizationCode)
//   5. Persist (connection.service.persistEtsyConnection — store auto-create + EtsyConnection upsert)
//   6. Cookie'yi sil (read-once)
//   7. Settings'e success redirect
//
// Honest fail: hiçbir aşamada uydurma success yok. Tüm hata path'leri
// query param ile settings'e geri redirect; settings UI ?etsy=... query'sini
// göstererek kullanıcıyı bilgilendirir.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { errorResponse } from "@/lib/http";
import { exchangeAuthorizationCode } from "@/providers/etsy/oauth";
import { persistEtsyConnection } from "@/providers/etsy/connection.service";
import {
  readOAuthStateCookie,
  clearOAuthStateCookie,
} from "@/providers/etsy/oauth-state-cookie";

const SETTINGS_PATH = "/settings";

function redirectWithStatus(reason: string): NextResponse {
  // Query param ile settings'e dön; UI panel bunu okuyup uygun mesaj gösterir.
  // Relative path; browser current origin'i resolve eder.
  const target = `${SETTINGS_PATH}?etsy=${encodeURIComponent(reason)}`;
  // NextResponse.redirect absolute URL bekler; relative için new URL ile
  // base eklemek zorundayız. Request URL'inden alabiliriz; ama burada
  // basit absolute fallback (production'da APP_URL gelir).
  // Daha temiz: NextResponse.redirect ile request.url base'i kullanma.
  return NextResponse.redirect(
    new URL(target, process.env.APP_URL ?? "http://localhost:3000"),
    { status: 302 },
  );
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const errorParam = searchParams.get("error");

    // Etsy reddetti
    if (errorParam) {
      clearOAuthStateCookie();
      return redirectWithStatus(`error-${errorParam}`);
    }

    if (!code || !stateParam) {
      clearOAuthStateCookie();
      return redirectWithStatus("missing-code");
    }

    // Cookie state + verifier oku
    const cookieState = readOAuthStateCookie();
    if (!cookieState) {
      return redirectWithStatus("missing-state");
    }

    // CSRF check
    if (cookieState.state !== stateParam) {
      clearOAuthStateCookie();
      return redirectWithStatus("state-mismatch");
    }

    // Token exchange
    const tokens = await exchangeAuthorizationCode({
      code,
      codeVerifier: cookieState.verifier,
    });

    // Persist (store auto-create + EtsyConnection upsert + Etsy /users/me shop lookup)
    await persistEtsyConnection({
      userId: user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresInSeconds: tokens.expiresInSeconds,
    });

    clearOAuthStateCookie();
    return redirectWithStatus("connected");
  } catch (err) {
    // Token exchange / shop lookup hataları typed AppError olarak gelir.
    // UI'da query string ile gösterilmesi daha iyi.
    clearOAuthStateCookie();
    if (err instanceof Error) {
      // AppError varsa code field'ını query'e koy (kısa, güvenli)
      const code = (err as { code?: string }).code ?? "exchange-failed";
      return redirectWithStatus(`error-${code}`);
    }
    return errorResponse(err);
  }
}
