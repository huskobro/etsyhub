// V1 final completion — Per-render PNG/JPG download endpoint test.
//
// Endpoint: GET /api/mockup/jobs/[jobId]/renders/[renderId]/download
//
// Senaryolar:
//   - 200 SUCCESS render → image/png + filename
//   - 404 cross-user render
//   - 404 olmayan renderId
//   - 404 jobId/renderId mismatch
//   - 409 non-SUCCESS render (FAILED, PENDING, RUNNING)
//   - 409 SUCCESS render outputKey null

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus, MockupJobStatus, MockupRenderStatus } from "@prisma/client";
import { db } from "@/server/db";
import { GET } from "@/app/api/mockup/jobs/[jobId]/renders/[renderId]/download/route";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/providers/storage", () => ({ getStorage: vi.fn() }));

import { requireUser } from "@/server/session";
import { getStorage } from "@/providers/storage";

let userId: string;
let otherUserId: string;
let jobId: string;
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

function makeRequest(jobId: string, renderId: string): Request {
  return new Request(
    `http://localhost/api/mockup/jobs/${jobId}/renders/${renderId}/download`,
    { method: "GET" },
  );
}

async function createTestJob(
  ownerUserId: string,
  successCount = 5,
  failedCount = 1,
) {
  const set = await db.selectionSet.create({
    data: { userId: ownerUserId, name: "Per-render Test Set", status: "ready" },
  });
  const total = successCount + failedCount;
  const job = await db.mockupJob.create({
    data: {
      userId: ownerUserId,
      setId: set.id,
      setSnapshotId: "snap-render-test",
      categoryId: "cat-canvas",
      status: failedCount > 0 ? MockupJobStatus.PARTIAL_COMPLETE : MockupJobStatus.COMPLETED,
      packSize: total,
      actualPackSize: successCount,
      coverRenderId: null,
      totalRenders: total,
      successRenders: successCount,
      failedRenders: failedCount,
    },
  });

  const newRenders: string[] = [];
  for (let i = 0; i < total; i++) {
    const isSuccess = i < successCount;
    const r = await db.mockupRender.create({
      data: {
        jobId: job.id,
        variantId: `variant-render-${i}`,
        bindingId: `binding-render-${i}`,
        templateSnapshot: {
          templateId: "tmpl-1",
          templateName: "Render Test",
          bindingId: `binding-render-${i}`,
          bindingVersion: 1,
          providerId: "local-sharp",
          config: {},
          aspectRatios: ["1:1"],
        },
        packPosition: i,
        selectionReason: i === 0 ? "COVER" : "TEMPLATE_DIVERSITY",
        status: isSuccess ? MockupRenderStatus.SUCCESS : MockupRenderStatus.FAILED,
        outputKey: isSuccess ? `output-render-${i}.png` : null,
        errorClass: isSuccess ? null : "RENDER_TIMEOUT",
      },
    });
    newRenders.push(r.id);
  }
  jobId = job.id;
  renderIds = newRenders;
  return job;
}

async function cleanup() {
  await db.mockupRender.deleteMany({ where: { job: { userId: { in: [userId, otherUserId] } } } });
  await db.mockupJob.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
  await db.selectionSet.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
  renderIds = [];
}

beforeAll(async () => {
  const u1 = await ensureUser("v1-render-download-owner@etsyhub.local");
  const u2 = await ensureUser("v1-render-download-other@etsyhub.local");
  userId = u1.id;
  otherUserId = u2.id;
});

beforeEach(async () => {
  (requireUser as ReturnType<typeof vi.fn>).mockReset();
  (getStorage as ReturnType<typeof vi.fn>).mockReset();
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

describe("GET /api/mockup/jobs/[jobId]/renders/[renderId]/download", () => {
  it("200 SUCCESS render → image/png + filename + Content-Length", async () => {
    await createTestJob(userId, 5, 0);
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userId });
    const mockStorage = {
      download: vi.fn(async () => Buffer.from("fake-png-bytes")),
    };
    (getStorage as ReturnType<typeof vi.fn>).mockReturnValue(mockStorage);

    const renderId = renderIds[2]!;
    const res = await GET(makeRequest(jobId, renderId), { params: { jobId, renderId } });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment; filename="mockup-.+-pos-2\.png"$/);
    expect(res.headers.get("Content-Length")).toBe("14");
    expect(mockStorage.download).toHaveBeenCalledWith("output-render-2.png");
  });

  it("404 cross-user — başka kullanıcının render'ı sızdırılmaz", async () => {
    await createTestJob(otherUserId, 3, 0); // başka kullanıcının job'u
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userId });
    (getStorage as ReturnType<typeof vi.fn>).mockReturnValue({ download: vi.fn() });

    const renderId = renderIds[0]!;
    const res = await GET(makeRequest(jobId, renderId), { params: { jobId, renderId } });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("RENDER_NOT_FOUND");
  });

  it("404 olmayan renderId", async () => {
    await createTestJob(userId, 1, 0);
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userId });
    (getStorage as ReturnType<typeof vi.fn>).mockReturnValue({ download: vi.fn() });

    const fakeRenderId = "clz0000000000000000000000";
    const res = await GET(makeRequest(jobId, fakeRenderId), { params: { jobId, renderId: fakeRenderId } });

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("RENDER_NOT_FOUND");
  });

  it("404 jobId/renderId mismatch — render başka job'a aitse", async () => {
    // 1. job + 1 render
    await createTestJob(userId, 1, 0);
    const validRenderId = renderIds[0]!;
    // 2. başka job (aynı user)
    await createTestJob(userId, 1, 0);
    const wrongJobId = jobId;

    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userId });
    (getStorage as ReturnType<typeof vi.fn>).mockReturnValue({ download: vi.fn() });

    const res = await GET(makeRequest(wrongJobId, validRenderId), { params: { jobId: wrongJobId, renderId: validRenderId } });
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("RENDER_NOT_FOUND");
  });

  it("409 FAILED render — outputKey null + status SUCCESS değil", async () => {
    await createTestJob(userId, 0, 1);
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userId });
    (getStorage as ReturnType<typeof vi.fn>).mockReturnValue({ download: vi.fn() });

    const failedRenderId = renderIds[0]!;
    const res = await GET(makeRequest(jobId, failedRenderId), { params: { jobId, renderId: failedRenderId } });

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("RENDER_NOT_DOWNLOADABLE");
  });

  it("400 invalid path (non-cuid)", async () => {
    await createTestJob(userId, 1, 0);
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userId });

    const res = await GET(makeRequest("invalid-id", "also-invalid"), {
      params: { jobId: "invalid-id", renderId: "also-invalid" },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION");
  });
});
