import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/server/auth";
import { Sidebar } from "@/features/app-shell/Sidebar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { email, role } = session.user;

  return (
    <div className="flex h-screen w-full bg-bg text-text">
      <Sidebar role={role} email={email} />
      <main className="mx-auto flex w-full max-w-content flex-1 flex-col overflow-auto p-6">
        {children}
      </main>
    </div>
  );
}
