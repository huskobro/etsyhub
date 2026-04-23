import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { RegisterForm } from "@/features/auth/register-form";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const flag = await db.featureFlag.findUnique({ where: { key: "registration.enabled" } });

  if (!flag?.enabled) {
    return (
      <main className="grid min-h-screen place-items-center bg-bg px-6">
        <div className="flex max-w-sm flex-col gap-3 text-center">
          <h1 className="text-xl font-semibold">Kayıt şu an kapalı</h1>
          <p className="text-sm text-text-muted">
            Sistem yöneticisinin davet akışını beklemelisin.
          </p>
          <Link href="/login" className="text-sm text-accent underline">
            Giriş sayfasına dön
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <RegisterForm />
        <p className="text-center text-sm text-text-muted">
          Zaten hesabın var mı?{" "}
          <Link href="/login" className="text-accent underline">
            Giriş yap
          </Link>
        </p>
      </div>
    </main>
  );
}
