// Phase 9 V1 Task 9 — Listing meta generation service integration tests.
//
// Mock pattern: registry'yi vi.mock ile sahtelle; gerçek HTTP YAPILMIYOR.
// Cross-user / not-configured / happy path / provider error scenarios.

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

// Mock registry — gerçek KIE çağrısı yapmıyoruz; provider.generate sahte.
vi.mock("@/providers/listing-meta-ai/registry", () => ({
  getListingMetaAIProvider: vi.fn(),
  DEFAULT_LISTING_META_PROVIDER_ID: "kie-gemini-flash",
}));

import {
  generateListingMeta,
  ListingMetaListingNotFoundError,
  ListingMetaProviderNotConfiguredError,
  ListingMetaProviderError,
} from "@/features/listings/server/generate-meta.service";
import { getListingMetaAIProvider } from "@/providers/listing-meta-ai/registry";
import { updateUserAiModeSettings } from "@/features/settings/ai-mode/service";

// ────────────────────────────────────────────────────────────
// Fixture helpers (Phase 7 paterni — predictable IDs)
// ────────────────────────────────────────────────────────────

const TEST_PREFIX = "phase9-generate-meta";
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

const validTags = Array.from({ length: 13 }, (_, i) => `tag${i + 1}`);
const validOutput = {
  title: "Minimalist Boho Wall Art Print Set",
  description:
    "Beautiful wall art for any modern interior. Digital download in high resolution.",
  tags: validTags,
};

describe("generateListingMeta() — Phase 9 V1 Task 9", () => {
  beforeAll(() => {
    // Default mock — happy path döndüren bir provider
    vi.mocked(getListingMetaAIProvider).mockImplementation(() => ({
      id: "kie-gemini-flash",
      modelId: "gemini-2.5-flash",
      kind: "text",
      generate: vi.fn().mockResolvedValue(validOutput),
    }));
  });

  it("ListingMetaListingNotFoundError — listing yok ⇒ throw", async () => {
    const user = await ensureUser(uniqueEmail("notfound"));
    userIds.push(user.id);
    await updateUserAiModeSettings(user.id, {
      kieApiKey: "test-key",
      geminiApiKey: null,
      reviewProvider: "kie",
    });

    await expect(
      generateListingMeta("clz0000000000000000000000", user.id),
    ).rejects.toBeInstanceOf(ListingMetaListingNotFoundError);
  });

  it("cross-user 404 — başka user'ın listing'i ⇒ throw", async () => {
    const user1 = await ensureUser(uniqueEmail("cross1"));
    const user2 = await ensureUser(uniqueEmail("cross2"));
    userIds.push(user1.id, user2.id);

    await updateUserAiModeSettings(user2.id, {
      kieApiKey: "test-key",
      geminiApiKey: null,
      reviewProvider: "kie",
    });

    const listing = await db.listing.create({
      data: {
        userId: user1.id,
        title: "User1 Listing",
        status: "DRAFT",
      },
    });

    await expect(
      generateListingMeta(listing.id, user2.id),
    ).rejects.toBeInstanceOf(ListingMetaListingNotFoundError);
  });

  it("ListingMetaProviderNotConfiguredError — kieApiKey yok ⇒ throw", async () => {
    const user = await ensureUser(uniqueEmail("notcfg"));
    userIds.push(user.id);
    // kieApiKey null — provider configured DEĞİL.
    await updateUserAiModeSettings(user.id, {
      kieApiKey: null,
      geminiApiKey: null,
      reviewProvider: "kie",
    });

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "Test",
        status: "DRAFT",
      },
    });

    await expect(
      generateListingMeta(listing.id, user.id),
    ).rejects.toBeInstanceOf(ListingMetaProviderNotConfiguredError);
  });

  it("happy path — mock provider output + snapshot doğru döner", async () => {
    const user = await ensureUser(uniqueEmail("happy"));
    userIds.push(user.id);
    await updateUserAiModeSettings(user.id, {
      kieApiKey: "test-key",
      geminiApiKey: null,
      reviewProvider: "kie",
    });

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "Old Title",
        description: "Old desc",
        tags: ["x", "y"],
        category: "canvas",
        materials: ["png"],
        status: "DRAFT",
      },
    });

    const generateMock = vi.fn().mockResolvedValue(validOutput);
    vi.mocked(getListingMetaAIProvider).mockReturnValueOnce({
      id: "kie-gemini-flash",
      modelId: "gemini-2.5-flash",
      kind: "text",
      generate: generateMock,
    });

    const result = await generateListingMeta(listing.id, user.id, {
      productType: "wall_art",
      toneHint: "minimalist",
    });

    expect(result.output).toEqual(validOutput);
    // Snapshot: "{model}@{YYYY-MM-DD}"
    expect(result.providerSnapshot).toMatch(
      /^gemini-2\.5-flash@\d{4}-\d{2}-\d{2}$/,
    );
    expect(result.promptVersion).toBe("v1.0");

    // generate çağrısı doğru input ile yapıldı
    expect(generateMock).toHaveBeenCalledTimes(1);
    const callArg = generateMock.mock.calls[0]![0];
    expect(callArg.productType).toBe("wall_art");
    expect(callArg.currentTitle).toBe("Old Title");
    expect(callArg.currentDescription).toBe("Old desc");
    expect(callArg.currentTags).toEqual(["x", "y"]);
    expect(callArg.category).toBe("canvas");
    expect(callArg.materials).toEqual(["png"]);
    expect(callArg.toneHint).toBe("minimalist");
    // apiKey plain "test-key" provider'a iletildi
    const callOptions = generateMock.mock.calls[0]![1];
    expect(callOptions.apiKey).toBe("test-key");
  });

  it("provider hata fırlatınca ListingMetaProviderError 502 wrap", async () => {
    const user = await ensureUser(uniqueEmail("proverr"));
    userIds.push(user.id);
    await updateUserAiModeSettings(user.id, {
      kieApiKey: "test-key",
      geminiApiKey: null,
      reviewProvider: "kie",
    });

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "Test",
        status: "DRAFT",
      },
    });

    const generateMock = vi
      .fn()
      .mockRejectedValue(new Error("kie listing-meta failed: 503 maintenance"));
    // mockImplementation — bu test boyunca her çağrıda hata fırlat
    vi.mocked(getListingMetaAIProvider).mockImplementation(() => ({
      id: "kie-gemini-flash",
      modelId: "gemini-2.5-flash",
      kind: "text",
      generate: generateMock,
    }));

    await expect(
      generateListingMeta(listing.id, user.id),
    ).rejects.toBeInstanceOf(ListingMetaProviderError);

    // 502 status check
    try {
      await generateListingMeta(listing.id, user.id);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ListingMetaProviderError);
      expect((err as ListingMetaProviderError).status).toBe(502);
      expect((err as ListingMetaProviderError).message).toContain(
        "AI listing metadata üretimi başarısız",
      );
    }
  });
});

afterAll(async () => {
  // FK-safe cleanup chain — listing önce, UserSetting sonra, store, sonra user.
  await db.listing.deleteMany({ where: { userId: { in: userIds } } });
  await db.userSetting.deleteMany({ where: { userId: { in: userIds } } });
  await db.store.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});
