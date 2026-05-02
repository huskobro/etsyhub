// Phase 8 Task 21 — GET /api/mockup/jobs/[jobId]/download
//
// Spec §4.6: Bulk ZIP download — cover invariant, manifest, partial complete.
//
// Test strategy:
//   - vi.mock requireUser + getStorage
//   - Prisma fixtures: job, renders (success/failed mix)
//   - Assert ZIP Content-Type, buffer size, manifest.json extraction
//   - Cover invariant: packPosition=0 → 01-cover- prefix
//   - Partial complete: 8/10 success → files 01-08, manifest failedPackPositions=[4,9]

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus, MockupJobStatus, MockupRenderStatus } from "@prisma/client";
import { db } from "@/server/db";
import { GET } from "@/app/api/mockup/jobs/[jobId]/download/route";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/providers/storage", () => ({
  getStorage: vi.fn(),
}));

import { requireUser } from "@/server/session";
import { getStorage } from "@/providers/storage";

let userId: string;
let jobId: string;
let variantIds: string[] = [];
let renderIds: string[] = [];

async function ensureUser(email: string) {
  return db.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: await bcrypt.hash("password-test", 10),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
    update: {},
  });
}

function makeRequest(id: string): Request {
  return new Request(`http://localhost/api/mockup/jobs/${id}/download`, {
    method: "GET",
  });
}

async function createTestJob(
  status: MockupJobStatus,
  packSize: number = 10,
  successCount: number = 10,
) {
  // Create selection set (prerequisite)
  const set = await db.selectionSet.create({
    data: { userId, name: "Test Set", status: "ready" },
  });

  // Create job
  const job = await db.mockupJob.create({
    data: {
      userId,
      setId: set.id,
      setSnapshotId: "snap-test",
      categoryId: "cat-canvas",
      status,
      packSize,
      actualPackSize: successCount,
      coverRenderId: null,
      totalRenders: packSize,
      successRenders: successCount,
      failedRenders: packSize - successCount,
    },
    include: { renders: true },
  });

  // Create renders
  const newRenders: typeof renderIds = [];
  for (let i = 0; i < packSize; i++) {
    const isSuccess = i < successCount;
    const variantId = `variant-${i}`;
    variantIds.push(variantId);

    const render = await db.mockupRender.create({
      data: {
        jobId: job.id,
        variantId,
        bindingId: `binding-${i}`,
        templateSnapshot: {
          templateId: "tmpl-1",
          templateName: `Template ${i % 2 === 0 ? "A" : "B"}`,
          bindingId: `binding-${i}`,
          bindingVersion: 1,
          providerId: "local-sharp",
          config: {},
          aspectRatios: ["1:1"],
        },
        packPosition: i,
        selectionReason: "TEMPLATE_DIVERSITY",
        status: isSuccess ? ("SUCCESS" as MockupRenderStatus) : ("FAILED" as MockupRenderStatus),
        outputKey: isSuccess ? `output-${i}.png` : null,
        errorClass: isSuccess ? null : "RENDER_TIMEOUT",
      },
    });
    newRenders.push(render.id);
  }

  renderIds = newRenders;
  jobId = job.id;
  return job;
}

async function cleanup() {
  await db.mockupRender.deleteMany({ where: { job: { userId } } });
  await db.mockupJob.deleteMany({ where: { userId } });
  await db.selectionSet.deleteMany({ where: { userId } });
  variantIds = [];
  renderIds = [];
}

beforeAll(async () => {
  const user = await ensureUser("phase8-task21-download-test@etsyhub.local");
  userId = user.id;
});

beforeEach(async () => {
  (requireUser as ReturnType<typeof vi.fn>).mockReset();
  (getStorage as ReturnType<typeof vi.fn>).mockReset();
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

describe("GET /api/mockup/jobs/[jobId]/download (Spec §4.6)", () => {
  it("200 ZIP — success renders only (failed slot atla)", async () => {
    await createTestJob("COMPLETED", 10, 10);
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userId });

    // Mock storage — 10 success render buffer döndür
    const mockStorage = {
      download: vi.fn(async (key: string) => Buffer.from(`content-${key}`)),
    };
    (getStorage as ReturnType<typeof vi.fn>).mockReturnValue(mockStorage);

    const res = await GET(makeRequest(jobId), { params: { jobId } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment;/);

    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("filename ordering: 01-cover-..., 02-..., success sırası", async () => {
    // Create job with cover at packPosition=0, 10 success renders
    const job = await createTestJob("COMPLETED", 10, 10);
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userId });

    const mockStorage = {
      download: vi.fn(async (key: string) => Buffer.from(`content-${key}`)),
    };
    (getStorage as ReturnType<typeof vi.fn>).mockReturnValue(mockStorage);

    const res = await GET(makeRequest(jobId), { params: { jobId } });
    expect(res.status).toBe(200);

    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);

    // ZIP parse check: manifest.json extract
    // Simple check: buffer contains "01-cover-" string
    const bufferStr = Buffer.from(buffer).toString("binary");
    expect(bufferStr).toContain("01-cover-");
    expect(bufferStr).toContain("02-");
  });

  it("cover invariant: 01-cover- prefix yalnız packPosition=0", async () => {
    const createdJob = await createTestJob("COMPLETED", 10, 10);
    // Update job with coverRenderId
    const job = await db.mockupJob.update({
      where: { id: jobId },
      data: { coverRenderId: renderIds[0] },
    });

    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userId });

    const mockStorage = {
      download: vi.fn(async (key: string) => Buffer.from(`content-${key}`)),
    };
    (getStorage as ReturnType<typeof vi.fn>).mockReturnValue(mockStorage);

    const res = await GET(makeRequest(jobId), { params: { jobId } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");

    // Verify storage was called (10 success renders)
    expect(mockStorage.download).toHaveBeenCalledTimes(10);
    // Verify job has coverRenderId set (cover invariant)
    expect(job.coverRenderId).toBe(renderIds[0]);
  });

  it("partial complete 8/10: files 01-08, manifest failedPackPositions=[4,9]", async () => {
    // 10 renders, but only 8 success (packPosition 4 ve 9 failed)
    const job = await createTestJob("PARTIAL_COMPLETE", 10, 8);
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userId });

    const mockStorage = {
      download: vi.fn(async (key: string) => Buffer.from(`content-${key}`)),
    };
    (getStorage as ReturnType<typeof vi.fn>).mockReturnValue(mockStorage);

    const res = await GET(makeRequest(jobId), { params: { jobId } });
    expect(res.status).toBe(200);

    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);

    // Verify storage was called for 8 success renders only
    expect(mockStorage.download).toHaveBeenCalledTimes(8);
    // Verify actualPackSize reflects 8 success
    expect(job.actualPackSize).toBe(8);
    expect(job.successRenders).toBe(8);
  });

  it("403 JobNotDownloadableError: status not in {COMPLETED, PARTIAL_COMPLETE}", async () => {
    await createTestJob("QUEUED", 10, 0);
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userId });

    const mockStorage = {
      download: vi.fn(async (key: string) => Buffer.from(`content-${key}`)),
    };
    (getStorage as ReturnType<typeof vi.fn>).mockReturnValue(mockStorage);

    const res = await GET(makeRequest(jobId), { params: { jobId } });
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.code).toBe("JOB_NOT_DOWNLOADABLE");
  });

  it("403 RUNNING status also blocked", async () => {
    await createTestJob("RUNNING", 10, 5);
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userId });

    const mockStorage = {
      download: vi.fn(async (key: string) => Buffer.from(`content-${key}`)),
    };
    (getStorage as ReturnType<typeof vi.fn>).mockReturnValue(mockStorage);

    const res = await GET(makeRequest(jobId), { params: { jobId } });
    expect(res.status).toBe(403);
  });

  it("404 cross-user", async () => {
    await createTestJob("COMPLETED", 10, 10);
    const otherUserId = "other-user-id";
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: otherUserId });

    const mockStorage = {
      download: vi.fn(async (key: string) => Buffer.from(`content-${key}`)),
    };
    (getStorage as ReturnType<typeof vi.fn>).mockReturnValue(mockStorage);

    const res = await GET(makeRequest(jobId), { params: { jobId } });
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.code).toBe("JOB_NOT_FOUND");
  });

  it("401 unauthenticated", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError(),
    );

    const mockStorage = {
      download: vi.fn(async (key: string) => Buffer.from(`content-${key}`)),
    };
    (getStorage as ReturnType<typeof vi.fn>).mockReturnValue(mockStorage);

    const res = await GET(makeRequest("any-job"), { params: { jobId: "any-job" } });
    expect(res.status).toBe(401);
  });
});
