import { redirect } from "next/navigation";
import { auth } from "@/server/auth";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Kivasy IA: /overview is the operator's morning landing.
  // Legacy /dashboard still middleware-redirects to /overview.
  redirect("/overview");
}
