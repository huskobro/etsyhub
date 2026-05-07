// Pass 53 — Bridge browser pencere öne getirme.
//
// AWAITING_LOGIN / AWAITING_CHALLENGE durumunda operatör manuel
// müdahale yapmalı. Bu endpoint bridge'in kontrol ettiği MJ tab'ını
// kullanıcının ekranında öne getirir (Playwright `page.bringToFront`).
//
// Sözleşme:
//   POST /api/admin/midjourney/focus-browser
//   200 → { ok }
//   502 → Bridge unreachable

import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { audit } from "@/server/audit";
import {
  BridgeUnreachableError,
  getBridgeClient,
} from "@/server/services/midjourney/bridge-client";

export const POST = withErrorHandling(async () => {
  const admin = await requireAdmin();

  try {
    await getBridgeClient().focusBrowser();
    await audit({
      actor: admin.id,
      action: "MIDJOURNEY_FOCUS_BROWSER",
      targetType: "Bridge",
      targetId: "mj-bridge",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof BridgeUnreachableError) {
      return NextResponse.json(
        { ok: false, error: err.message, code: "BRIDGE_UNREACHABLE" },
        { status: 502 },
      );
    }
    throw err;
  }
});
