import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { LoginForm } from "@/features/auth/login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const flag = await db.featureFlag.findUnique({ where: { key: "registration.enabled" } });

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <LoginForm />
        {flag?.enabled && (
          <p className="text-center text-sm text-text-muted">
            Hesabın yok mu?{" "}
            <Link href="/register" className="text-accent underline">
              Kayıt ol
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
