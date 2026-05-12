import { PrismaClient, UserRole, UserStatus, ThemeStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@etsyhub.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin12345";

  const existing = await db.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    await db.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 10),
        name: "Admin",
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
    console.log(`admin user oluşturuldu: ${adminEmail}`);
  } else {
    console.log(`admin user zaten var: ${adminEmail}`);
  }

  // Phase 28 — DS v5 B5 mock chip set (5 canonical digital download types)
  // tam karşılığı olarak `bookmark` eklendi; `clipart` displayName "Clipart
  // bundle" oldu (DS canonical wording); `wall_art` displayName "Wall art"
  // oldu (sentence case, DS B5 ile birebir). T-Shirt / Hoodie / DTF
  // physical POD scope dışı (CLAUDE.md "Out-of-scope"); seed'de korunuyor
  // (mevcut DB row uyumu için) ama intake server-level canonical-key
  // whitelist'i ile filtrelenir, modal'a gelmez. Canvas dijital wall art
  // varyantı; DS B5 mock'unda yok ama legacy product type rolü kalır.
  const productTypes = [
    { key: "clipart", displayName: "Clipart bundle", aspectRatio: "1:1" },
    { key: "wall_art", displayName: "Wall art", aspectRatio: "2:3" },
    { key: "bookmark", displayName: "Bookmark", aspectRatio: "2:5" },
    { key: "sticker", displayName: "Sticker", aspectRatio: "1:1" },
    { key: "printable", displayName: "Printable", aspectRatio: "2:3" },
    { key: "canvas", displayName: "Canvas", aspectRatio: "3:4" },
    { key: "tshirt", displayName: "T-Shirt", aspectRatio: "1:1" },
    { key: "hoodie", displayName: "Hoodie", aspectRatio: "1:1" },
    { key: "dtf", displayName: "DTF", aspectRatio: "1:1" },
  ];
  for (const pt of productTypes) {
    await db.productType.upsert({
      where: { key: pt.key },
      create: { ...pt, isSystem: true },
      update: { displayName: pt.displayName, aspectRatio: pt.aspectRatio },
    });
  }
  console.log(`product types upsert edildi: ${productTypes.length}`);

  await db.theme.upsert({
    where: { name: "matesy-light" },
    create: {
      name: "matesy-light",
      tokens: {},
      status: ThemeStatus.ACTIVE,
      isSystem: true,
    },
    update: {},
  });
  console.log("aktif theme: matesy-light");

  const flags = [
    {
      key: "registration.enabled",
      enabled: process.env.REGISTRATION_ENABLED === "true",
    },
    { key: "bookmarks.enabled", enabled: true },
    { key: "references.enabled", enabled: true },
    { key: "collections.enabled", enabled: true },
    { key: "trend_stories.enabled", enabled: true },
    { key: "competitors.enabled", enabled: true },
    { key: "variations.enabled", enabled: false },
    { key: "mockups.enabled", enabled: false },
    { key: "listings.enabled", enabled: false },
  ];
  for (const f of flags) {
    await db.featureFlag.upsert({
      where: { key: f.key },
      create: { key: f.key, enabled: f.enabled },
      update: { enabled: f.enabled },
    });
  }
  console.log(`feature flag'ler upsert edildi: ${flags.length}`);

  console.log("seed tamamlandı");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
