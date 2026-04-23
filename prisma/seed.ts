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

  const productTypes = [
    { key: "canvas", displayName: "Canvas", aspectRatio: "3:4" },
    { key: "wall_art", displayName: "Wall Art", aspectRatio: "2:3" },
    { key: "printable", displayName: "Printable", aspectRatio: "2:3" },
    { key: "clipart", displayName: "Clipart", aspectRatio: "1:1" },
    { key: "sticker", displayName: "Sticker", aspectRatio: "1:1" },
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
    { key: "trend_stories.enabled", enabled: false },
    { key: "competitors.enabled", enabled: false },
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
