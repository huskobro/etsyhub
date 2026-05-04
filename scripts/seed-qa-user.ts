// QA test user — manual QA browser smoke için ayrı USER hesabı.
// Mevcut admin'e dokunulmaz. Reset için: --reset
import "./_bootstrap-env";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

const QA_USER_EMAIL = "qa-user@etsyhub.local";
const QA_USER_PASSWORD = "qauser12345";

async function main() {
  if (process.argv.includes("--reset")) {
    await db.user.deleteMany({ where: { email: QA_USER_EMAIL } });
    console.log("[seed-qa-user] reset done");
    return;
  }
  const existing = await db.user.findUnique({ where: { email: QA_USER_EMAIL } });
  if (existing) {
    console.log(`[seed-qa-user] exists: ${existing.email} (${existing.id})`);
    return;
  }
  const u = await db.user.create({
    data: {
      email: QA_USER_EMAIL,
      passwordHash: await bcrypt.hash(QA_USER_PASSWORD, 10),
      name: "QA User",
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`[seed-qa-user] created: ${u.email} / ${QA_USER_PASSWORD} (id=${u.id})`);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
