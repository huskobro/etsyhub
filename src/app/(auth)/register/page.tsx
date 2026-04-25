import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { AuthShell } from "@/features/auth/auth-shell";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  // registration.enabled flag check server-side korunuyor.
  // Flag kapalıyken AuthShell "Kayıt şu an kapalı" mesajını render eder.
  const flag = await db.featureFlag.findUnique({
    where: { key: "registration.enabled" },
  });

  return (
    <AuthShell mode="register" registrationEnabled={Boolean(flag?.enabled)} />
  );
}
