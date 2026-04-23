import { execSync } from "node:child_process";

if (process.env.NODE_ENV === "production") {
  throw new Error("reset-db production'da kullanılamaz");
}

execSync("npx prisma migrate reset --force --skip-seed", { stdio: "inherit" });
execSync("npx prisma db seed", { stdio: "inherit" });
