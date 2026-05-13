/**
 * Phase 62 — GET /api/admin/midjourney/bridge/health
 *
 * Compose modal Midjourney provider seçildiğinde proactive bridge state
 * probe. Mevcut `BridgeClient.health()` (`/health` endpoint) çağrısını
 * kısa-circuit + UI-friendly tone'a indirger.
 *
 * Response:
 *   {
 *     ok: true,
 *     state: "online" | "offline" | "session-required" | "degraded",
 *     summary: string,           // operator-facing copy
 *     detail?: string,           // additional context
 *     bridge: {                  // raw subset (debugging)
 *       version, driver, browserMode, browserKind,
 *       likelyLoggedIn, jobsQueued, jobsRunning, jobsBlocked,
 *     } | null,
 *   }
 *
 * State karar tablosu:
 *   - fetch fail / timeout → "offline" + "Bridge not running. Start your
 *     MJ session or switch to Kie."
 *   - bridge ok + browser.launched=false → "offline" + "Bridge running
 *     but no browser attached."
 *   - bridge ok + mjSession.likelyLoggedIn=false → "session-required" +
 *     "Bridge online; MJ session not detected. Sign in to Midjourney."
 *   - jobs.blocked > 0 → "degraded" + "Bridge online but {N} blocked
 *     jobs — investigate before launching new."
 *   - all healthy → "online" + "Bridge ready · session detected"
 *
 * Auth: requireAdmin (bridge bilgisi admin scope; operatör admin değilse
 * compose modal hâlâ launch eder ama health badge "unknown" gösterir).
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import {
  getBridgeClient,
  BridgeUnreachableError,
} from "@/server/services/midjourney/bridge-client";

export type BridgeHealthState =
  | "online"
  | "offline"
  | "session-required"
  | "degraded";

export type BridgeHealthResponse = {
  ok: true;
  state: BridgeHealthState;
  summary: string;
  detail?: string;
  bridge: {
    version: string;
    driver: string;
    browserMode?: string;
    browserKind?: string;
    likelyLoggedIn: boolean;
    jobsQueued: number;
    jobsRunning: number;
    jobsBlocked: number;
  } | null;
};

export const GET = withErrorHandling(async () => {
  await requireAdmin();
  try {
    const client = getBridgeClient();
    const health = await client.health();

    const browserLaunched = health.browser.launched;
    const likelyLoggedIn = health.mjSession.likelyLoggedIn;
    const jobsBlocked = health.jobs.blocked;

    let state: BridgeHealthState;
    let summary: string;
    let detail: string | undefined;

    if (!browserLaunched) {
      state = "offline";
      summary = "Bridge running but no browser attached";
      detail =
        "Bridge service is up but no Chrome/Brave browser is connected. Start your Midjourney session in your operator browser, or switch to Kie · GPT Image 1.5 to launch immediately.";
    } else if (!likelyLoggedIn) {
      state = "session-required";
      summary = "Bridge online · Midjourney session not detected";
      detail =
        "Open midjourney.com in your bridge-attached browser and sign in. Compose can still proceed — the worker will pause if the session stays inactive.";
    } else if (jobsBlocked > 0) {
      state = "degraded";
      summary = `Bridge online · ${jobsBlocked} blocked job${jobsBlocked === 1 ? "" : "s"}`;
      detail =
        "Bridge has blocked jobs from previous launches. Resolve them on the Batches page before queuing more, or launch may stack new jobs behind the blockers.";
    } else {
      state = "online";
      summary = "Bridge ready · Midjourney session detected";
    }

    const response: BridgeHealthResponse = {
      ok: true,
      state,
      summary,
      ...(detail ? { detail } : {}),
      bridge: {
        version: health.version,
        driver: health.driver,
        browserMode: health.browser.mode,
        browserKind: health.browser.browserKind,
        likelyLoggedIn,
        jobsQueued: health.jobs.queued,
        jobsRunning: health.jobs.running,
        jobsBlocked,
      },
    };
    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof BridgeUnreachableError) {
      const response: BridgeHealthResponse = {
        ok: true,
        state: "offline",
        summary: "Bridge not running",
        detail:
          "Midjourney bridge isn't reachable. Start the bridge service in your operator environment, or switch to Kie · GPT Image 1.5 to launch immediately.",
        bridge: null,
      };
      return NextResponse.json(response);
    }
    // Other errors → offline with raw message
    const message = err instanceof Error ? err.message : String(err);
    const response: BridgeHealthResponse = {
      ok: true,
      state: "offline",
      summary: "Bridge unreachable",
      detail: message.slice(0, 200),
      bridge: null,
    };
    return NextResponse.json(response);
  }
});
