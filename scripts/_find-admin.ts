import "./_bootstrap-env";
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const users = await p.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(JSON.stringify(users, null, 2));
  await p.$disconnect();
}

main();
