import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { auth } from "@/server/auth";
import { Sidebar } from "@/features/app-shell/Sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== UserRole.ADMIN) redirect("/dashboard");
  return (
    <div className="flex h-screen w-full bg-bg text-text">
      <Sidebar role={session.user.role} email={session.user.email} />
      <main className="mx-auto flex w-full max-w-content flex-1 flex-col overflow-auto p-6">
        {children}
      </main>
    </div>
  );
}
