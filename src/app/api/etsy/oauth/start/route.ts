// Phase 9 V1 — Etsy OAuth start route.
//
// Settings panel "Etsy'ye bağlan" CTA bu endpoint'e GET atar.
// Server: state + PKCE verifier üret, cookie'ye yaz, authorization URL'e
// redirect.
//
// Honest fail:
//   - ETSY_CLIENT_ID/SECRET/REDIRECT_URI yoksa → 503 EtsyNotConfigured
//   - Auth gerekli (requireUser)

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { errorResponse } from "@/lib/http";
import { buildAuthorizationUrl } from "@/providers/etsy/oauth";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from "@/providers/etsy/pkce";
import { setOAuthStateCookie } from "@/providers/etsy/oauth-state-cookie";

export async function GET() {
  try {
    // Auth gate; userId cookie'ye gerek yok (callback'te tekrar requireUser).
    await requireUser();

    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    const state = generateState();

    // Cookie'ye state + verifier
    setOAuthStateCookie({ state, verifier });

    // Auth URL üret (getEtsyOAuthConfig env yoksa EtsyNotConfiguredError throw)
    const url = buildAuthorizationUrl({ state, codeChallenge: challenge });

    // Etsy'ye redirect
    return NextResponse.redirect(url, { status: 302 });
  } catch (err) {
    return errorResponse(err);
  }
}
