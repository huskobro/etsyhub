// Phase 9 V1 — Etsy connection settings API integration tests.
// GET status + DELETE connection (real DB, FK-safe cleanup).

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { encryptSecret } from "@/lib/secrets";

// Mock requireUser
vi.mock("@/server/session", () => ({
  requireUser: vi.fn(),
}));

import { GET, DELETE } from "@/app/api/settings/etsy-connection/route";
import { requireUser } from "@/server/session";

const TEST_PREFIX = "phase9-etsy-conn-api";
let nonce = 0;
function uniqueEmail(label: string) {
  return `${TEST_PREFIX}-${label}-${Date.now()}-${++nonce}-${Math.random()
    .toString(36)
    .slice(2, 8)}@test.local`;
}

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

const userIds: string[] = [];
const ENV_KEYS = [
  "ETSY_CLIENT_ID",
  "ETSY_CLIENT_SECRET",
  "ETSY_REDIRECT_URI",
] as const;
const original: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const k of ENV_KEYS) original[k] = process.env[k];
});

afterAll(async () => {
  await db.listing.deleteMany({ where: { userId: { in: userIds } } });
  await db.etsyConnection.deleteMany({
    where: { store: { userId: { in: userIds } } },
  });
  await db.store.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });

  for (const k of ENV_KEYS) {
    if (original[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = original[k];
    }
  }
});

beforeEach(() => {
  process.env.ETSY_CLIENT_ID = "test-client";
  process.env.ETSY_CLIENT_SECRET = "test-secret";
  process.env.ETSY_REDIRECT_URI =
    "http://localhost:3000/api/etsy/oauth/callback";
});

afterEach(() => {
  vi.mocked(requireUser).mockReset();
});

describe("GET /api/settings/etsy-connection", () => {
  it("not_connected (env var, row yok) → 200 + status.state=not_connected", async () => {
    const user = await ensureUser(uniqueEmail("not-conn"));
    userIds.push(user.id);
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: user.id,
      email: user.email,
      role: UserRole.USER,
    } as Awaited<ReturnType<typeof requireUser>>);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status.state).toBe("not_connected");
  });

  it("not_configured (env yok) → 200 + status.state=not_configured", async () => {
    delete process.env.ETSY_CLIENT_ID;
    delete process.env.ETSY_CLIENT_SECRET;
    delete process.env.ETSY_REDIRECT_URI;

    const user = await ensureUser(uniqueEmail("not-cfg"));
    userIds.push(user.id);
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: user.id,
      email: user.email,
      role: UserRole.USER,
    } as Awaited<ReturnType<typeof requireUser>>);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status.state).toBe("not_configured");
  });

  it("connected (full row) → 200 + status.state=connected + shopId/shopName", async () => {
    const user = await ensureUser(uniqueEmail("ok"));
    userIds.push(user.id);
    const store = await db.store.create({
      data: { userId: user.id, name: "S" },
    });
    await db.etsyConnection.create({
      data: {
        storeId: store.id,
        shopId: "999",
        shopName: "ApiShop",
        accessToken: encryptSecret("at"),
        refreshToken: encryptSecret("rt"),
        tokenExpires: new Date(Date.now() + 3600_000),
        scopes: ["listings_w"],
      },
    });

    vi.mocked(requireUser).mockResolvedValueOnce({
      id: user.id,
      email: user.email,
      role: UserRole.USER,
    } as Awaited<ReturnType<typeof requireUser>>);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status.state).toBe("connected");
    expect(body.status.shopId).toBe("999");
    expect(body.status.shopName).toBe("ApiShop");
  });

  it("expired (tokenExpires geçmiş) → 200 + status.state=expired", async () => {
    const user = await ensureUser(uniqueEmail("exp"));
    userIds.push(user.id);
    const store = await db.store.create({
      data: { userId: user.id, name: "S" },
    });
    await db.etsyConnection.create({
      data: {
        storeId: store.id,
        shopId: "111",
        shopName: "ExpShop",
        accessToken: encryptSecret("at"),
        refreshToken: encryptSecret("rt"),
        tokenExpires: new Date(Date.now() - 1000),
        scopes: [],
      },
    });

    vi.mocked(requireUser).mockResolvedValueOnce({
      id: user.id,
      email: user.email,
      role: UserRole.USER,
    } as Awaited<ReturnType<typeof requireUser>>);

    const res = await GET();
    const body = await res.json();
    expect(body.status.state).toBe("expired");
    expect(body.status.shopName).toBe("ExpShop");
  });
});

describe("DELETE /api/settings/etsy-connection", () => {
  it("happy path: bağlantıyı siler + dönen status.state = not_connected (env varsa)", async () => {
    const user = await ensureUser(uniqueEmail("del-ok"));
    userIds.push(user.id);
    const store = await db.store.create({
      data: { userId: user.id, name: "S" },
    });
    await db.etsyConnection.create({
      data: {
        storeId: store.id,
        shopId: "1",
        accessToken: encryptSecret("at"),
        refreshToken: encryptSecret("rt"),
        tokenExpires: new Date(Date.now() + 3600_000),
        scopes: [],
      },
    });

    vi.mocked(requireUser).mockResolvedValueOnce({
      id: user.id,
      email: user.email,
      role: UserRole.USER,
    } as Awaited<ReturnType<typeof requireUser>>);

    const res = await DELETE();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status.state).toBe("not_connected");

    const after = await db.etsyConnection.findUnique({
      where: { storeId: store.id },
    });
    expect(after).toBeNull();
  });

  it("no-op: bağlantı yoksa hata yok, status.state=not_connected", async () => {
    const user = await ensureUser(uniqueEmail("del-noop"));
    userIds.push(user.id);

    vi.mocked(requireUser).mockResolvedValueOnce({
      id: user.id,
      email: user.email,
      role: UserRole.USER,
    } as Awaited<ReturnType<typeof requireUser>>);

    const res = await DELETE();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status.state).toBe("not_connected");
  });
});
