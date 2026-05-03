// Phase 9 V1 Finalization — Etsy readiness diagnostics endpoint integration tests.
//
// 3 boyut (OAuth env / Taxonomy env / Connection state) + liveReady boolean.
// Live Etsy çağrısı YOK; sadece env + DB okunur.

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

import { GET } from "@/app/api/settings/etsy-connection/readiness/route";
import { requireUser } from "@/server/session";

const TEST_PREFIX = "phase9-readiness";
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
  "ETSY_TAXONOMY_MAP_JSON",
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
  // Default: tüm env'leri temizle, her testte gerekenleri set et.
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  vi.mocked(requireUser).mockReset();
});

function mockUser(user: { id: string; email: string }) {
  vi.mocked(requireUser).mockResolvedValueOnce({
    id: user.id,
    email: user.email,
    role: UserRole.USER,
  } as Awaited<ReturnType<typeof requireUser>>);
}

describe("GET /api/settings/etsy-connection/readiness", () => {
  it("env hiç yok + connection yok → oauth.missing + taxonomy.missing + not_configured + liveReady=false", async () => {
    const user = await ensureUser(uniqueEmail("nothing"));
    userIds.push(user.id);
    mockUser(user);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.oauthCredentials.state).toBe("missing");
    expect(body.summary.taxonomyMapping.state).toBe("missing");
    expect(body.summary.connection.state).toBe("not_configured");
    expect(body.summary.liveReady).toBe(false);
  });

  it("OAuth env var, taxonomy yok → oauth.ok + taxonomy.missing + not_connected + liveReady=false", async () => {
    process.env.ETSY_CLIENT_ID = "cid";
    process.env.ETSY_CLIENT_SECRET = "sec";
    process.env.ETSY_REDIRECT_URI = "http://localhost:3000/cb";

    const user = await ensureUser(uniqueEmail("oauth-only"));
    userIds.push(user.id);
    mockUser(user);

    const res = await GET();
    const body = await res.json();
    expect(body.summary.oauthCredentials.state).toBe("ok");
    expect(body.summary.taxonomyMapping.state).toBe("missing");
    expect(body.summary.connection.state).toBe("not_connected");
    expect(body.summary.liveReady).toBe(false);
  });

  it("Taxonomy env tam JSON + 'wall_art' var → taxonomy.ok + sampleResolved=2078", async () => {
    process.env.ETSY_TAXONOMY_MAP_JSON =
      '{"wall_art":2078,"sticker":1208,"clipart":1207}';
    const user = await ensureUser(uniqueEmail("tax-ok"));
    userIds.push(user.id);
    mockUser(user);

    const res = await GET();
    const body = await res.json();
    expect(body.summary.taxonomyMapping.state).toBe("ok");
    expect(body.summary.taxonomyMapping.sampleKey).toBe("wall_art");
    expect(body.summary.taxonomyMapping.sampleResolved).toBe(2078);
    expect(body.summary.taxonomyMapping.detail).toContain("wall_art");
  });

  it("Taxonomy env var ama 'wall_art' yok → taxonomy.missing + 'key yok' detay", async () => {
    process.env.ETSY_TAXONOMY_MAP_JSON = '{"sticker":1208,"clipart":1207}';
    const user = await ensureUser(uniqueEmail("tax-partial"));
    userIds.push(user.id);
    mockUser(user);

    const res = await GET();
    const body = await res.json();
    expect(body.summary.taxonomyMapping.state).toBe("missing");
    expect(body.summary.taxonomyMapping.sampleResolved).toBeNull();
    expect(body.summary.taxonomyMapping.detail).toContain("yok");
  });

  it("Taxonomy env bozuk JSON → taxonomy.invalid", async () => {
    process.env.ETSY_TAXONOMY_MAP_JSON = "{ broken json";
    const user = await ensureUser(uniqueEmail("tax-bad"));
    userIds.push(user.id);
    mockUser(user);

    const res = await GET();
    const body = await res.json();
    expect(body.summary.taxonomyMapping.state).toBe("invalid");
    expect(body.summary.taxonomyMapping.sampleResolved).toBeNull();
  });

  it("Connection connected + tüm env tam → connected + liveReady=true", async () => {
    process.env.ETSY_CLIENT_ID = "cid";
    process.env.ETSY_CLIENT_SECRET = "sec";
    process.env.ETSY_REDIRECT_URI = "http://localhost:3000/cb";
    process.env.ETSY_TAXONOMY_MAP_JSON = '{"wall_art":2078}';

    const user = await ensureUser(uniqueEmail("conn-ok"));
    userIds.push(user.id);

    const store = await db.store.create({
      data: { userId: user.id, name: "S" },
    });
    const future = new Date(Date.now() + 3600_000);
    await db.etsyConnection.create({
      data: {
        storeId: store.id,
        shopId: "9876",
        shopName: "ReadyShop",
        accessToken: encryptSecret("at"),
        refreshToken: encryptSecret("rt"),
        tokenExpires: future,
        scopes: ["listings_w"],
      },
    });
    mockUser(user);

    const res = await GET();
    const body = await res.json();
    expect(body.summary.connection.state).toBe("connected");
    expect(body.summary.connection.shopName).toBe("ReadyShop");
    expect(body.summary.connection.tokenExpires).toBe(future.toISOString());
    expect(body.summary.liveReady).toBe(true);
  });

  it("Connection expired + OAuth ok → connection.expired + liveReady=false", async () => {
    process.env.ETSY_CLIENT_ID = "cid";
    process.env.ETSY_CLIENT_SECRET = "sec";
    process.env.ETSY_REDIRECT_URI = "http://localhost:3000/cb";

    const user = await ensureUser(uniqueEmail("conn-exp"));
    userIds.push(user.id);

    const store = await db.store.create({
      data: { userId: user.id, name: "S" },
    });
    const past = new Date(Date.now() - 10_000);
    await db.etsyConnection.create({
      data: {
        storeId: store.id,
        shopId: "1",
        shopName: "OldShop",
        accessToken: encryptSecret("at"),
        refreshToken: encryptSecret("rt"),
        tokenExpires: past,
        scopes: [],
      },
    });
    mockUser(user);

    const res = await GET();
    const body = await res.json();
    expect(body.summary.connection.state).toBe("expired");
    expect(body.summary.connection.shopName).toBe("OldShop");
    expect(body.summary.liveReady).toBe(false);
  });

  it("OAuth ok + taxonomy ok ama not_connected → liveReady=false", async () => {
    process.env.ETSY_CLIENT_ID = "cid";
    process.env.ETSY_CLIENT_SECRET = "sec";
    process.env.ETSY_REDIRECT_URI = "http://localhost:3000/cb";
    process.env.ETSY_TAXONOMY_MAP_JSON = '{"wall_art":2078}';

    const user = await ensureUser(uniqueEmail("no-conn-row"));
    userIds.push(user.id);
    mockUser(user);

    const res = await GET();
    const body = await res.json();
    expect(body.summary.oauthCredentials.state).toBe("ok");
    expect(body.summary.taxonomyMapping.state).toBe("ok");
    expect(body.summary.connection.state).toBe("not_connected");
    expect(body.summary.liveReady).toBe(false);
  });
});
