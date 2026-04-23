import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { auth } from "@/server/auth";
import { Sidebar } from "@/features/app-shell/Sidebar";
import { Header } from "@/features/app-shell/Header";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== UserRole.ADMIN) redirect("/dashboard");
  return (
    <div className="flex min-h-screen bg-bg text-text">
      <Sidebar role={session.user.role} />
      <div className="flex-1 flex flex-col">
        <Header email={session.user.email} role={session.user.role} />
        <main className="flex-1 p-6 max-w-content w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
