import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/server/auth";

/**
 * (studio) layout — Mockup Studio'nın full-screen dark shell entry'si.
 *
 * App route group'undan bilinçli olarak ayrı: studio sayfası kendi
 * 100vh dark canvas'ı, kendi toolbar'ı + sidebar + stage + rail
 * zincirini kurar. (app) layout sidebar'ı, ActiveTasks panel'i ve
 * content max-width'i bu yüzeyde anlamsız — studio shell zaten kendi
 * sol sidebar'ı + sağ rail'i taşıyor.
 *
 * Auth + role gate (app) layout pattern paritesi: session yoksa
 * login'e redirect.
 */
export default async function StudioLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <>{children}</>;
}
