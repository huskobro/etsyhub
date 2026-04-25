import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { AuthShell } from "@/features/auth/auth-shell";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  // registration.enabled flag check server-side korunuyor.
  const flag = await db.featureFlag.findUnique({
    where: { key: "registration.enabled" },
  });

  return <AuthShell mode="login" registrationEnabled={Boolean(flag?.enabled)} />;
}
