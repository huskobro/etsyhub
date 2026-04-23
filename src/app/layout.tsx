import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "@/features/theme/ThemeProvider";
import { QueryProvider } from "@/features/app-shell/QueryProvider";
import { resolveActiveTokens } from "@/features/theme/theme-service";

export const metadata = {
  title: "EtsyHub",
  description: "Etsy productivity & POD workspace",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const tokens = await resolveActiveTokens();
  return (
    <html lang="tr">
      <body>
        <ThemeProvider tokens={tokens}>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
