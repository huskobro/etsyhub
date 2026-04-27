// Phase 5 Task 15 — /api/settings/local-library + /api/settings/ai-mode
// integration tests. Round-trip + validation + masked GET + preserve-on-empty
// + cross-user isolation (UserSetting composite PK üzerinden).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

import { requireUser } from "@/server/session";
import { GET as localGet, PUT as localPut } from "@/app/api/settings/local-library/route";
import { GET as aiGet, PUT as aiPut } from "@/app/api/settings/ai-mode/route";

const USER_A = "settings-api-user-a";
const USER_B = "settings-api-user-b";

beforeEach(async () => {
  await db.userSetting.deleteMany({
    where: { userId: { in: [USER_A, USER_B] } },
  });
  await db.user.upsert({
    where: { id: USER_A },
    update: {},
    create: { id: USER_A, email: "settings-a@test.local", passwordHash: "x" },
  });
  await db.user.upsert({
    where: { id: USER_B },
    update: {},
    create: { id: USER_B, email: "settings-b@test.local", passwordHash: "x" },
  });
  (requireUser as any).mockReset();
});

function jsonReq(url: string, body: unknown, method = "PUT"): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/settings/local-library", () => {
  it("GET returns defaults when not set", async () => {
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const res = await localGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings.rootFolderPath).toBeNull();
    expect(body.settings.targetResolution).toEqual({ width: 4000, height: 4000 });
    expect(body.settings.targetDpi).toBe(300);
    expect(body.settings.qualityThresholds).toEqual({ ok: 75, warn: 40 });
  });

  it("PUT happy path → GET round-trip", async () => {
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const putRes = await localPut(
      jsonReq("http://localhost/api/settings/local-library", {
        rootFolderPath: "/Users/x/library",
        targetResolution: { width: 4000, height: 4000 },
        targetDpi: 300,
        qualityThresholds: { ok: 75, warn: 40 },
      }),
    );
    expect(putRes.status).toBe(200);

    const getRes = await localGet();
    const body = await getRes.json();
    expect(body.settings.rootFolderPath).toBe("/Users/x/library");
    expect(body.settings.qualityThresholds).toEqual({ ok: 75, warn: 40 });
  });

  it("PUT relative path → 400", async () => {
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const res = await localPut(
      jsonReq("http://localhost/api/settings/local-library", {
        rootFolderPath: "relative/path",
        targetResolution: { width: 4000, height: 4000 },
        targetDpi: 300,
        qualityThresholds: { ok: 75, warn: 40 },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("PUT negative width → 400", async () => {
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const res = await localPut(
      jsonReq("http://localhost/api/settings/local-library", {
        rootFolderPath: null,
        targetResolution: { width: -1, height: 4000 },
        targetDpi: 300,
        qualityThresholds: { ok: 75, warn: 40 },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("PUT qualityThresholds ok=50 warn=80 → 400 (refine: warn < ok)", async () => {
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const res = await localPut(
      jsonReq("http://localhost/api/settings/local-library", {
        rootFolderPath: null,
        targetResolution: { width: 4000, height: 4000 },
        targetDpi: 300,
        qualityThresholds: { ok: 50, warn: 80 },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("PUT qualityThresholds ok=101 → 400 (max bound)", async () => {
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const res = await localPut(
      jsonReq("http://localhost/api/settings/local-library", {
        rootFolderPath: null,
        targetResolution: { width: 4000, height: 4000 },
        targetDpi: 300,
        qualityThresholds: { ok: 101, warn: 40 },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("PUT qualityThresholds ok=80 warn=30 → 200 + GET preserved", async () => {
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const putRes = await localPut(
      jsonReq("http://localhost/api/settings/local-library", {
        rootFolderPath: null,
        targetResolution: { width: 4000, height: 4000 },
        targetDpi: 300,
        qualityThresholds: { ok: 80, warn: 30 },
      }),
    );
    expect(putRes.status).toBe(200);
    const getRes = await localGet();
    const body = await getRes.json();
    expect(body.settings.qualityThresholds).toEqual({ ok: 80, warn: 30 });
  });

  it("cross-user isolation: User A PUT, User B GET → defaults (own row)", async () => {
    (requireUser as any).mockResolvedValue({ id: USER_A });
    await localPut(
      jsonReq("http://localhost/api/settings/local-library", {
        rootFolderPath: "/A/library",
        targetResolution: { width: 4000, height: 4000 },
        targetDpi: 300,
        qualityThresholds: { ok: 90, warn: 50 },
      }),
    );
    (requireUser as any).mockResolvedValue({ id: USER_B });
    const res = await localGet();
    const body = await res.json();
    expect(body.settings.rootFolderPath).toBeNull();
    expect(body.settings.qualityThresholds).toEqual({ ok: 75, warn: 40 });
  });
});

describe("/api/settings/ai-mode", () => {
  it("GET returns null masks when not set", async () => {
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const res = await aiGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings.kieApiKey).toBeNull();
    expect(body.settings.geminiApiKey).toBeNull();
  });

  it("PUT kieApiKey 'test-key' (gemini boş) → GET masked '•••••'", async () => {
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const putRes = await aiPut(
      jsonReq("http://localhost/api/settings/ai-mode", {
        kieApiKey: "test-key",
        geminiApiKey: "",
      }),
    );
    expect(putRes.status).toBe(200);
    const getRes = await aiGet();
    const body = await getRes.json();
    expect(body.settings.kieApiKey).toBe("•••••");
    expect(body.settings.geminiApiKey).toBeNull();
  });

  it("PUT empty string → preserve existing (boş string yazmaz)", async () => {
    (requireUser as any).mockResolvedValue({ id: USER_A });
    await aiPut(
      jsonReq("http://localhost/api/settings/ai-mode", {
        kieApiKey: "first-secret",
        geminiApiKey: "",
      }),
    );
    const putRes = await aiPut(
      jsonReq("http://localhost/api/settings/ai-mode", {
        kieApiKey: "",
        geminiApiKey: "",
      }),
    );
    expect(putRes.status).toBe(200);
    const getRes = await aiGet();
    const body = await getRes.json();
    expect(body.settings.kieApiKey).toBe("•••••");
    expect(body.settings.geminiApiKey).toBeNull();
  });

  it("PUT geminiApiKey null → 400 (anlamsız: explicit silme bu surface'te yok)", async () => {
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const res = await aiPut(
      jsonReq("http://localhost/api/settings/ai-mode", {
        kieApiKey: "",
        geminiApiKey: null,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("PUT malformed body → 400", async () => {
    (requireUser as any).mockResolvedValue({ id: USER_A });
    const res = await aiPut(
      jsonReq("http://localhost/api/settings/ai-mode", {
        kieApiKey: 123,
        geminiApiKey: "x",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("cross-user isolation: User A PUT, User B GET → null", async () => {
    (requireUser as any).mockResolvedValue({ id: USER_A });
    await aiPut(
      jsonReq("http://localhost/api/settings/ai-mode", {
        kieApiKey: "a-secret",
        geminiApiKey: "g-secret",
      }),
    );
    (requireUser as any).mockResolvedValue({ id: USER_B });
    const res = await aiGet();
    const body = await res.json();
    expect(body.settings.kieApiKey).toBeNull();
    expect(body.settings.geminiApiKey).toBeNull();
  });
});
