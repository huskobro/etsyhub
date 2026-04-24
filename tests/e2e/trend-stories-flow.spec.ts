import { expect, test } from "@playwright/test";
import {
  PrismaClient,
  CompetitorListingStatus,
  SourcePlatform,
  TrendClusterStatus,
} from "@prisma/client";
import { login, ADMIN_EMAIL } from "./helpers";

// -----------------------------------------------------------------------
// Modül düzeyinde paylaşılan Prisma istemcisi ve test çalışması kimliği.
// runId sayesinde oluşturulan tüm fixture'lar birbirinden izole kalır ve
// afterAll temizlemesi sadece bu çalışmaya ait kayıtları siler.
// -----------------------------------------------------------------------
const db = new PrismaClient();
const runId = Date.now().toString(36);

// Fixture verileri afterAll'da silinmek üzere modül kapsamında tutulur.
let adminId: string;
let competitorStoreId: string;
let clusterId: string;
let listingIds: string[] = [];

// -----------------------------------------------------------------------
// beforeAll: Admin kullanıcısını bul; fixture seed için gerekli.
// afterAll: Tüm fixture ve bookmark kayıtlarını temizle.
// -----------------------------------------------------------------------
test.beforeAll(async () => {
  const admin = await db.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) throw new Error(`Admin kullanıcı bulunamadı: ${ADMIN_EMAIL}`);
  adminId = admin.id;

  // Fixture seed: rakip mağaza + listingler + cluster + üyeler
  const store = await db.competitorStore.create({
    data: {
      userId: adminId,
      etsyShopName: `e2e-trend-${runId}`,
      shopUrl: `https://www.etsy.com/shop/e2e-trend-${runId}`,
      platform: SourcePlatform.ETSY,
    },
  });
  competitorStoreId = store.id;

  const baseTime = Date.now();
  const created = await Promise.all(
    [0, 1, 2].map((i) =>
      db.competitorListing.create({
        data: {
          userId: adminId,
          competitorStoreId: store.id,
          externalId: `e2e-trend-listing-${runId}-${i}`,
          platform: SourcePlatform.ETSY,
          sourceUrl: `https://www.etsy.com/listing/e2e-trend-${runId}-${i}`,
          title: `E2E Trend Listing ${i}`,
          reviewCount: 20,
          firstSeenAt: new Date(baseTime - i * 60_000),
          lastSeenAt: new Date(baseTime - i * 60_000),
          status: CompetitorListingStatus.ACTIVE,
        },
      }),
    ),
  );
  listingIds = created.map((l) => l.id);

  const cluster = await db.trendCluster.create({
    data: {
      userId: adminId,
      signature: `e2e-trend-${runId}`,
      label: `E2E Trend Kümesi ${runId}`,
      windowDays: 7,
      memberCount: created.length,
      storeCount: 1,
      status: TrendClusterStatus.ACTIVE,
      clusterScore: 100,
    },
  });
  clusterId = cluster.id;

  await db.trendClusterMember.createMany({
    data: created.map((l) => ({
      clusterId: cluster.id,
      listingId: l.id,
      userId: adminId,
    })),
  });
});

test.afterAll(async () => {
  try {
    // Bookmark temizliği (bookmark flow testi oluşturmuş olabilir)
    await db.bookmark.deleteMany({
      where: { userId: adminId, trendClusterId: clusterId },
    });
    // Kayıt olmayabilir; hata vermesin
  } catch {
    // yoksay
  }

  try {
    await db.trendClusterMember.deleteMany({ where: { clusterId } });
    await db.trendCluster.deleteMany({ where: { id: clusterId } });
    await db.competitorListing.deleteMany({ where: { id: { in: listingIds } } });
    await db.competitorStore.deleteMany({ where: { id: competitorStoreId } });
  } catch {
    // yoksay
  }

  await db.$disconnect();
});

// -----------------------------------------------------------------------
// Test 1: Başlık ve window tab'ları görünür; "7 Gün" varsayılan aktif
// -----------------------------------------------------------------------
test.describe("trend stories flow", () => {
  test("login → /trend-stories → başlık + window tabs görünür, 7G varsayılan aktif", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/trend-stories");

    // Sayfa başlığı render olmalı
    await expect(
      page.getByRole("heading", { level: 1, name: /Trend Akışı/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Tablist container görünür
    const tablist = page.getByRole("tablist", {
      name: /Trend zaman penceresi/i,
    });
    await expect(tablist).toBeVisible();

    // Üç pencere tab'ı render olmalı
    const tab1Gun = page.getByRole("tab", { name: /1 Gün/i });
    const tab7Gun = page.getByRole("tab", { name: /7 Gün/i });
    const tab30Gun = page.getByRole("tab", { name: /30 Gün/i });

    await expect(tab1Gun).toBeVisible();
    await expect(tab7Gun).toBeVisible();
    await expect(tab30Gun).toBeVisible();

    // Varsayılan olarak "7 Gün" seçili (aria-selected="true") olmalı
    await expect(tab7Gun).toHaveAttribute("aria-selected", "true");
    await expect(tab1Gun).toHaveAttribute("aria-selected", "false");
    await expect(tab30Gun).toHaveAttribute("aria-selected", "false");
  });

  // -----------------------------------------------------------------------
  // Test 2: Seed edilmiş cluster rail'de görünür; karta tıklayınca drawer açılır;
  //         üye listing içeride görünür; drawer kapatma çalışır.
  // -----------------------------------------------------------------------
  test("seed fixture ile cluster rail görünür + cluster kartına tıklama drawer açar", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/trend-stories");

    // Cluster kartı aria-label üzerinden bulunur: "Trend kümesi: <label>"
    const clusterCard = page.getByRole("button", {
      name: new RegExp(`Trend kümesi: E2E Trend Kümesi ${runId}`, "i"),
    });
    await expect(clusterCard).toBeVisible({ timeout: 15_000 });

    // Karta tıkla → drawer açılır
    await clusterCard.click();

    // Drawer: role="dialog" aria-label="Trend kümesi detayı"
    const drawer = page.getByRole("dialog", {
      name: /Trend kümesi detayı/i,
    });
    await expect(drawer).toBeVisible({ timeout: 15_000 });

    // Drawer içinde en az bir üye listing başlığı görünmeli
    await expect(
      drawer.getByText(/E2E Trend Listing 0/i),
    ).toBeVisible({ timeout: 15_000 });

    // Kapatma butonuna tıkla → drawer kaybolmalı
    await drawer.getByRole("button", { name: /^Kapat$/ }).click();
    await expect(drawer).toBeHidden({ timeout: 10_000 });
  });

  // -----------------------------------------------------------------------
  // Test 3: Feed listing kartından "Bookmark'a ekle" → toast → /bookmarks'ta görünür
  // -----------------------------------------------------------------------
  test("feed listing kartından Bookmark akışı", async ({ page }) => {
    await login(page);
    await page.goto("/trend-stories");

    // Feed'in yüklenmesini bekle; listing kartı başlığıyla bulunur.
    // Kart <article> içinde h3 başlığı "E2E Trend Listing 0"
    const listingTitle = `E2E Trend Listing 0`;
    const feedCard = page
      .getByRole("article")
      .filter({ hasText: listingTitle })
      .first();

    await expect(feedCard).toBeVisible({ timeout: 15_000 });

    // "Bookmark'a ekle" butonuna tıkla
    await feedCard.getByRole("button", { name: /Bookmark'a ekle/i }).click();

    // Başarı toast'ı görünmeli: role="status" içinde "eklendi" geçmeli
    const toast = page.getByRole("status").filter({ hasText: /eklendi/i });
    await expect(toast).toBeVisible({ timeout: 15_000 });

    // /bookmarks sayfasına git ve yeni oluşturulan bookmark'ı doğrula.
    // BookmarkCard başlık veya sourceUrl olarak listing başlığını ya da
    // listing sourceUrl'sini gösterir. INBOX filtresi varsayılan gelir.
    await page.goto("/bookmarks");
    await expect(
      page.getByRole("heading", { level: 1, name: /Bookmark Inbox/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Bookmarks sayfası varsayılan INBOX filtresiyle açılır.
    // Yeni eklenen bookmark listingTitle veya sourceUrl içermelidir.
    // BookmarkCard h3'de title ya da sourceUrl'yi gösterir.
    const bookmarkCard = page
      .getByRole("article")
      .filter({ hasText: new RegExp(`E2E Trend Listing 0|e2e-trend-${runId}-0`, "i") })
      .first();

    await expect(bookmarkCard).toBeVisible({ timeout: 15_000 });
  });

  // -----------------------------------------------------------------------
  // Test 4: Window tab değişimi aria-selected'i günceller
  //
  // NOT: Spec URL param senkronizasyonundan söz ediyor; ancak mevcut
  // TrendStoriesPage implementasyonu sadece useState(7) kullanıyor —
  // URL'ye herhangi bir param yazılmıyor. URL assertion şu an eklenmedi.
  // URL-param sync özelliği eklendiğinde bu test şunu da doğrulamalıdır:
  //   expect(page.url()).toContain("window=30")
  // -----------------------------------------------------------------------
  test("window tab değişimi aria-selected'i günceller", async ({ page }) => {
    await login(page);
    await page.goto("/trend-stories");

    const tab7Gun = page.getByRole("tab", { name: /7 Gün/i });
    const tab30Gun = page.getByRole("tab", { name: /30 Gün/i });
    const tab1Gun = page.getByRole("tab", { name: /1 Gün/i });

    // Başlangıç durumu: 7 Gün seçili
    await expect(tab7Gun).toHaveAttribute("aria-selected", "true");

    // "30 Gün" tab'ına tıkla
    await tab30Gun.click();

    // "30 Gün" artık seçili; "7 Gün" ve "1 Gün" seçili değil
    await expect(tab30Gun).toHaveAttribute("aria-selected", "true");
    await expect(tab7Gun).toHaveAttribute("aria-selected", "false");
    await expect(tab1Gun).toHaveAttribute("aria-selected", "false");
  });

  // -----------------------------------------------------------------------
  // Test 5: Feature flag kapalıyken /trend-stories → Next.js 404
  // -----------------------------------------------------------------------
  test("flag kapalıyken /trend-stories → 404", async ({ page }) => {
    // Feature flag'i kapat
    await db.featureFlag.update({
      where: { key: "trend_stories.enabled" },
      data: { enabled: false },
    });

    try {
      await login(page);
      await page.goto("/trend-stories");

      // Next.js 14 varsayılan 404 sayfası hem h1 "404" hem h2
      // "This page could not be found." içerir; iki element bulunur.
      // first() ile strict mod ihlali önlenir.
      // Türkçe custom 404 varsa "Bu sayfa bulunamadı" da eşleşir.
      await expect(
        page.getByText(/404|could not be found|Bu sayfa bulunamadı/i).first(),
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      // Flag'i her durumda geri aç; test başarısız olsa dahi diğer testler etkilenmesin
      await db.featureFlag.update({
        where: { key: "trend_stories.enabled" },
        data: { enabled: true },
      });
    }
  });
});
