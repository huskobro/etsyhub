/**
 * Integration test: Bookmark ↔ TrendCluster — snapshot ve ownership
 *
 * Test kapsamı:
 * 1. Happy path: User A kendi cluster'ı ile bookmark oluşturur →
 *    trendClusterId + label/windowDays snapshot alanları doğru yazılır.
 * 2. Cross-user: User B, User A'nın cluster id'si ile bookmark oluşturmaya
 *    çalışır → ForbiddenError.
 * 3. STALE sonrası korunur: Cluster label ve status sonradan değişse bile
 *    bookmark'taki snapshot write-time değerini korur.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import {
  TrendClusterStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { db } from "@/server/db";
import { createBookmark } from "@/features/bookmarks/services/bookmark-service";
import { ForbiddenError } from "@/lib/errors";
import { updateBookmarkInput } from "@/features/bookmarks/schemas";

// ---------------------------------------------------------------------------
// Yardımcı fonksiyonlar
// ---------------------------------------------------------------------------

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

async function cleanup(userIds: string[]) {
  // Önce bookmark'ları sil (cluster'a FK tutuyor olabilirler).
  await db.bookmark.deleteMany({ where: { userId: { in: userIds } } });
  await db.trendClusterMember.deleteMany({
    where: { userId: { in: userIds } },
  });
  await db.trendCluster.deleteMany({ where: { userId: { in: userIds } } });
}

async function createCluster(args: {
  userId: string;
  signature: string;
  label: string;
  windowDays: number;
  status?: TrendClusterStatus;
}) {
  return db.trendCluster.create({
    data: {
      userId: args.userId,
      signature: args.signature,
      label: args.label,
      windowDays: args.windowDays,
      memberCount: 0,
      storeCount: 1,
      status: args.status ?? TrendClusterStatus.ACTIVE,
      clusterScore: 10,
    },
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("bookmark ↔ trend cluster snapshot", () => {
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const ts = Date.now();
    const a = await ensureUser(`bookmark-trend-a-${ts}@etsyhub.local`);
    const b = await ensureUser(`bookmark-trend-b-${ts}@etsyhub.local`);
    userAId = a.id;
    userBId = b.id;
    await cleanup([userAId, userBId]);
  });

  afterAll(async () => {
    await cleanup([userAId, userBId]);
  });

  // -------------------------------------------------------------------------
  // Test 1: Happy path — snapshot alanları doğru yazılır
  // -------------------------------------------------------------------------

  it("kendi cluster'ı ile bookmark oluşturulduğunda snapshot alanları yazılır", async () => {
    const ts = Date.now();
    const cluster = await createCluster({
      userId: userAId,
      signature: `snap-happy-${ts}`,
      label: "Happy Path Cluster",
      windowDays: 7,
    });

    const bookmark = await createBookmark({
      userId: userAId,
      input: {
        title: "Trend kaynaklı bookmark",
        trendClusterId: cluster.id,
      },
    });

    expect(bookmark.trendClusterId).toBe(cluster.id);
    expect(bookmark.trendClusterLabelSnapshot).toBe("Happy Path Cluster");
    expect(bookmark.trendWindowDaysSnapshot).toBe(7);

    // DB'den tekrar oku, persist edildiğini doğrula.
    const fresh = await db.bookmark.findUnique({ where: { id: bookmark.id } });
    expect(fresh?.trendClusterId).toBe(cluster.id);
    expect(fresh?.trendClusterLabelSnapshot).toBe("Happy Path Cluster");
    expect(fresh?.trendWindowDaysSnapshot).toBe(7);
  });

  // -------------------------------------------------------------------------
  // Test 2: Cross-user ForbiddenError
  // -------------------------------------------------------------------------

  it("başka kullanıcının cluster id'si kullanılırsa ForbiddenError", async () => {
    const ts = Date.now();
    const foreignCluster = await createCluster({
      userId: userAId,
      signature: `snap-foreign-${ts}`,
      label: "Foreign Cluster",
      windowDays: 30,
    });

    await expect(
      createBookmark({
        userId: userBId,
        input: {
          title: "Hack denemesi",
          trendClusterId: foreignCluster.id,
        },
      }),
    ).rejects.toThrow(ForbiddenError);

    // Bookmark oluşmadığından emin olalım.
    const leaked = await db.bookmark.findFirst({
      where: { userId: userBId, trendClusterId: foreignCluster.id },
    });
    expect(leaked).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 3: Snapshot STALE + label değişikliği sonrası korunur
  // -------------------------------------------------------------------------

  it("cluster STALE + label değiştiğinde snapshot write-time değerini korur", async () => {
    const ts = Date.now();
    const cluster = await createCluster({
      userId: userAId,
      signature: `snap-stale-${ts}`,
      label: "Original Label",
      windowDays: 14,
    });

    const bookmark = await createBookmark({
      userId: userAId,
      input: {
        title: "Snapshot korunacak bookmark",
        trendClusterId: cluster.id,
      },
    });

    expect(bookmark.trendClusterLabelSnapshot).toBe("Original Label");
    expect(bookmark.trendWindowDaysSnapshot).toBe(14);

    // Cluster'ı STALE yap ve label'ı değiştir.
    await db.trendCluster.update({
      where: { id: cluster.id },
      data: {
        status: TrendClusterStatus.STALE,
        label: "Updated Label",
        windowDays: 90,
      },
    });

    const fresh = await db.bookmark.findUnique({ where: { id: bookmark.id } });
    expect(fresh?.trendClusterId).toBe(cluster.id);
    expect(fresh?.trendClusterLabelSnapshot).toBe("Original Label");
    expect(fresh?.trendWindowDaysSnapshot).toBe(14);
  });

  // -------------------------------------------------------------------------
  // Test 4: updateBookmarkInput schema, trendClusterId'yi kabul etmez
  // (snapshot write-once contract — cluster bağlantısı create-only)
  // -------------------------------------------------------------------------

  it("updateBookmarkInput schema trendClusterId alanını stripleyerek write-once garanti eder", () => {
    const parsed = updateBookmarkInput.parse({
      title: "Yeni başlık",
      trendClusterId: "should-be-stripped",
    });
    expect(parsed).not.toHaveProperty("trendClusterId");
    expect(parsed.title).toBe("Yeni başlık");
  });
});
