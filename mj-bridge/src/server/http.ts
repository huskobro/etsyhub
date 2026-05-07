// Bridge HTTP server — Fastify.
//
// Loopback only (127.0.0.1) — design doc §3.3.
// Auth: shared secret header `X-Bridge-Token`.
// Endpoints:
//   GET    /health              health snapshot (auth zorunlu)
//   POST   /jobs                enqueue (auth zorunlu)
//   GET    /jobs/:id            snapshot (auth zorunlu)
//   GET    /jobs                list, ?limit=N (auth zorunlu)
//   POST   /jobs/:id/cancel     cancel (auth zorunlu)
//   POST   /focus               browser bringToFront (auth zorunlu)
//   GET    /jobs/:id/outputs/:n binary stream — EtsyHub ingest fetch
//                                (auth zorunlu)

import Fastify, { type FastifyInstance } from "fastify";
import { createReadStream, statSync } from "node:fs";
import type { JobManager } from "./job-manager.js";
import type { BridgeDriver } from "../drivers/types.js";
import type {
  BridgeError,
  BridgeHealth,
  CreateJobRequest,
  JobSnapshot,
} from "../types.js";

export type ServerConfig = {
  port: number;
  /** Shared secret — `X-Bridge-Token` header zorunlu match. */
  token: string;
  /** Bridge package version — health response. */
  version: string;
  driver: BridgeDriver;
  jobManager: JobManager;
  startedAt: Date;
};

export function buildServer(cfg: ServerConfig): FastifyInstance {
  const app = Fastify({ logger: { level: "info" } });

  // Auth hook — `X-Bridge-Token` header zorunlu.
  app.addHook("onRequest", async (req, reply) => {
    const token = req.headers["x-bridge-token"];
    if (typeof token !== "string" || token !== cfg.token) {
      reply.code(401).send({
        ok: false,
        error: "Geçersiz veya eksik X-Bridge-Token",
        code: "AUTH",
      } satisfies BridgeError);
    }
  });

  app.get("/health", async (): Promise<BridgeHealth> => {
    const browserHealth = await cfg.driver.health();
    const counts = cfg.jobManager.counts();
    const recent = cfg.jobManager.list(10).map((j) => ({
      id: j.id,
      state: j.state,
      enqueuedAt: j.enqueuedAt,
    }));
    // Pass 43 — selector smoke yalnız PlaywrightDriver'da dolu.
    // Driver type guard: getSelectorSmoke method'u varsa çağır.
    let selectorSmoke: BridgeHealth["selectorSmoke"] = null;
    const driverWithSmoke = cfg.driver as unknown as {
      getSelectorSmoke?: () => BridgeHealth["selectorSmoke"];
    };
    if (typeof driverWithSmoke.getSelectorSmoke === "function") {
      selectorSmoke = driverWithSmoke.getSelectorSmoke();
    }
    return {
      ok: true,
      version: cfg.version,
      driver: cfg.driver.id,
      browser: {
        launched: browserHealth.launched,
        profileDir: browserHealth.profileDir,
        pageCount: browserHealth.pageCount,
        activeUrl: browserHealth.activeUrl,
        // Pass 45 — channel + profileState forward.
        channel: browserHealth.channel,
        profileState: browserHealth.profileState,
        // Pass 46 — driver gözlem alanları forward.
        lastDriverMessage: browserHealth.lastDriverMessage,
        lastDriverError: browserHealth.lastDriverError,
        // Pass 47 — mode + cdpUrl + browserKind forward.
        mode: browserHealth.mode,
        cdpUrl: browserHealth.cdpUrl,
        browserKind: browserHealth.browserKind,
      },
      selectorSmoke,
      mjSession: {
        likelyLoggedIn: browserHealth.mjLikelyLoggedIn,
        lastChecked: browserHealth.lastChecked,
      },
      jobs: counts,
      recentJobs: recent,
      startedAt: cfg.startedAt.toISOString(),
    };
  });

  app.post("/jobs", async (req, reply): Promise<JobSnapshot> => {
    const body = req.body as CreateJobRequest | undefined;
    if (!body || typeof body !== "object" || !("kind" in body)) {
      reply.code(400);
      throw new Error("Geçersiz job request — { kind, ... } zorunlu");
    }
    return cfg.jobManager.enqueue(body);
  });

  app.get("/jobs", async (req): Promise<{ jobs: JobSnapshot[] }> => {
    const limit = Number((req.query as Record<string, string>).limit ?? "50");
    return { jobs: cfg.jobManager.list(limit) };
  });

  app.get<{ Params: { id: string } }>("/jobs/:id", async (req, reply) => {
    const job = cfg.jobManager.get(req.params.id);
    if (!job) {
      reply.code(404);
      return {
        ok: false,
        error: "Job bulunamadı",
        code: "NOT_FOUND",
      } satisfies BridgeError;
    }
    return job;
  });

  app.post<{ Params: { id: string } }>(
    "/jobs/:id/cancel",
    async (req, reply) => {
      const job = await cfg.jobManager.cancel(req.params.id);
      if (!job) {
        reply.code(404);
        return {
          ok: false,
          error: "Job bulunamadı",
          code: "NOT_FOUND",
        } satisfies BridgeError;
      }
      return job;
    },
  );

  app.post("/focus", async () => {
    await cfg.driver.focusBrowser();
    return { ok: true };
  });

  // Output dosyası stream — EtsyHub ingest worker'ı bridge'den indirmek için.
  // Path: /jobs/:id/outputs/:n  (n = 0..3 grid index)
  app.get<{ Params: { id: string; n: string } }>(
    "/jobs/:id/outputs/:n",
    async (req, reply) => {
      const job = cfg.jobManager.get(req.params.id);
      const n = Number(req.params.n);
      if (!job || !job.outputs) {
        reply.code(404);
        return {
          ok: false,
          error: "Output bulunamadı",
          code: "NOT_FOUND",
        } satisfies BridgeError;
      }
      const out = job.outputs.find((o) => o.gridIndex === n);
      if (!out) {
        reply.code(404);
        return {
          ok: false,
          error: "Grid index out of range",
          code: "NOT_FOUND",
        } satisfies BridgeError;
      }
      try {
        const stat = statSync(out.localPath);
        reply.header("Content-Type", "image/png");
        reply.header("Content-Length", stat.size.toString());
        return reply.send(createReadStream(out.localPath));
      } catch (err) {
        reply.code(500);
        return {
          ok: false,
          error: `Output dosyası okunamadı: ${
            err instanceof Error ? err.message : "unknown"
          }`,
          code: "READ_ERROR",
        } satisfies BridgeError;
      }
    },
  );

  return app;
}
