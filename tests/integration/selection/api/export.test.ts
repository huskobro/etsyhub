// Phase 7 Task 22 — POST /api/selection/sets/[setId]/export
//
// Export endpoint sözleşmesi (design Section 6.6, 7.2; plan Task 22):
//   - Auth: requireUser (Phase 5)
//   - Body: yok
//   - Success: 202 + { jobId } (BullMQ EXPORT_SELECTION_SET enqueue)
//   - Cross-user → 404 (requireSetOwnership; enqueue ÖNCE)
//   - Unauthenticated → 401
//   - Boş set guard YOK (worker fail eder, route enqueue eder — plan Task 22 notu)
//
// Test stratejisi:
//   - BullMQ queue gerçek (worker yok). enqueue sonrası queue'da waiting
//     job'unu doğrularız (Phase 7 active-export.test.ts patterni).
//   - Test izolasyonu: `queue.obliterate({ force: true })` her test öncesi.

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { JobType, UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { queues } from "@/server/queue";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

import { POST } from "@/app/api/selection/sets/[setId]/export/route";
import { requireUser } from "@/server/session";

const queue = queues[JobType.EXPORT_SELECTION_SET];

let userAId: string;
let userBId: string;

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

function makeRequest(setId: string): Request {
  return new Request(`http://localhost/api/selection/sets/${setId}/export`, {
    method: "POST",
  });
}

async function cleanup() {
  const userIds = [userAId, userBId];
  await db.selectionItem.deleteMany({
    where: { selectionSet: { userId: { in: userIds } } },
  });
  await db.selectionSet.deleteMany({ where: { userId: { in: userIds } } });
  await queue.obliterate({ force: true });
}

beforeAll(async () => {
  const a = await ensureUser("phase7-api-export-a@etsyhub.local");
  const b = await ensureUser("phase7-api-export-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;
});

beforeEach(async () => {
  (requireUser as ReturnType<typeof vi.fn>).mockReset();
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

describe("POST /api/selection/sets/[setId]/export", () => {
  it("draft set → 202 + { jobId }; queue'da EXPORT_SELECTION_SET job var", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Exp1", status: "draft" },
    });

    const res = await POST(makeRequest(set.id), { params: { setId: set.id } });
    expect(res.status).toBe(202);
    const data = await res.json();
    expect(typeof data.jobId).toBe("string");
    expect(data.jobId.length).toBeGreaterThan(0);

    // Queue'da gerçekten waiting job var
    const jobs = await queue.getJobs(["waiting", "delayed"], 0, 10);
    expect(jobs.length).toBeGreaterThanOrEqual(1);
    const match = jobs.find((j) => j.id === data.jobId);
    expect(match).toBeDefined();
    expect(match!.data).toMatchObject({
      userId: userAId,
      setId: set.id,
    });
  });

  it("ready set → 202 (export ready set'te de geçerli — read-only kuralı item mutation'a)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const set = await db.selectionSet.create({
      data: {
        userId: userAId,
        name: "ExpReady",
        status: "ready",
        finalizedAt: new Date(),
      },
    });

    const res = await POST(makeRequest(set.id), { params: { setId: set.id } });
    expect(res.status).toBe(202);
  });

  it("cross-user setId → 404; queue'a job EKLENMEZ", async () => {
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "ExpX", status: "draft" },
    });

    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userBId });
    const res = await POST(makeRequest(set.id), { params: { setId: set.id } });
    expect(res.status).toBe(404);

    // Queue boş
    const jobs = await queue.getJobs(["waiting", "delayed"], 0, 10);
    expect(jobs.length).toBe(0);
  });

  it("unauthenticated → 401; queue'a job EKLENMEZ", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError(),
    );

    const res = await POST(makeRequest("any-set"), {
      params: { setId: "any-set" },
    });
    expect(res.status).toBe(401);

    const jobs = await queue.getJobs(["waiting", "delayed"], 0, 10);
    expect(jobs.length).toBe(0);
  });
});
