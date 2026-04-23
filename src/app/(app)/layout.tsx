import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/server/auth";
import { Sidebar } from "@/features/app-shell/Sidebar";
import { Header } from "@/features/app-shell/Header";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { email, role } = session.user;

  return (
    <div className="flex min-h-screen bg-bg text-text">
      <Sidebar role={role} />
      <div className="flex flex-1 flex-col">
        <Header email={email} role={role} />
        <main className="mx-auto w-full max-w-content flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
