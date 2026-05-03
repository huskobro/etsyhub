// Phase 9 V1 — Etsy connection settings API.
//
// GET: connection status (panel render için)
// DELETE: bağlantıyı kaldır
//
// POST/PUT YOK — bağlantı kurma OAuth flow ile (start route).

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import {
  getEtsyConnectionStatus,
  deleteEtsyConnection,
} from "@/providers/etsy/connection.service";

export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const status = await getEtsyConnectionStatus(user.id);
  return NextResponse.json({ status });
});

export const DELETE = withErrorHandling(async () => {
  const user = await requireUser();
  await deleteEtsyConnection(user.id);
  const status = await getEtsyConnectionStatus(user.id);
  return NextResponse.json({ status });
});
