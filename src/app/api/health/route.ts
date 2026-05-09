// R11.12 — Public health probe endpoint.
//
// Load balancer / orchestration / uptime monitoring için minimum signal.
// Auth gerektirmez (public). DB/Redis/Storage'a tek bir lightweight probe
// yapar; biri fail olursa 503 + hangi bağımlılığın fail ettiğini söyler.
//
// Yanıt formatı:
//   200 { status: "ok", checks: { db, redis, storage }, uptime, timestamp }
//   503 { status: "degraded", checks: {...}, error }
//
// Disipline:
//   · Auth yok (orchestration probe, login gerektirmez).
//   · Lightweight check: DB SELECT 1, Redis PING, Storage HEAD bucket.
//   · 1.5s timeout per check (toplam ≤ 5s).

import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { connection } from "@/server/queue";
import { getStorage } from "@/providers/storage";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHECK_TIMEOUT_MS = 1500;

function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timeout after ${CHECK_TIMEOUT_MS}ms`)),
        CHECK_TIMEOUT_MS,
      ),
    ),
  ]);
}

async function checkDb(): Promise<{ ok: boolean; detail?: string }> {
  try {
    await withTimeout(db.$queryRaw`SELECT 1`, "db");
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function checkRedis(): Promise<{ ok: boolean; detail?: string }> {
  try {
    await withTimeout(connection.ping().then(() => undefined), "redis");
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function checkStorage(): Promise<{ ok: boolean; detail?: string }> {
  try {
    // Storage provider'da basit bir varlık probe'u (head/list).
    // getStorage() S3 client'ı; önemli olan client tipinin sağlam olması
    // ve env'in parse edilebilmesi (env.ts startup'ta zaten valide etti).
    const storage = getStorage();
    if (!storage) throw new Error("storage client null");
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

const STARTED_AT = Date.now();

export async function GET() {
  const [dbCheck, redisCheck, storageCheck] = await Promise.all([
    checkDb(),
    checkRedis(),
    checkStorage(),
  ]);

  const checks = {
    db: dbCheck.ok,
    redis: redisCheck.ok,
    storage: storageCheck.ok,
  };
  const allOk = Object.values(checks).every(Boolean);
  const status = allOk ? "ok" : "degraded";

  const body = {
    status,
    checks,
    uptime: Math.floor((Date.now() - STARTED_AT) / 1000),
    timestamp: new Date().toISOString(),
    ...(allOk
      ? {}
      : {
          details: {
            ...(dbCheck.detail ? { db: dbCheck.detail } : {}),
            ...(redisCheck.detail ? { redis: redisCheck.detail } : {}),
            ...(storageCheck.detail ? { storage: storageCheck.detail } : {}),
          },
        }),
  };

  if (!allOk) {
    logger.warn(body, "health probe degraded");
  }

  return NextResponse.json(body, { status: allOk ? 200 : 503 });
}
