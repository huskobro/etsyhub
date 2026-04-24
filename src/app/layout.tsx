import type { ReactNode } from "react";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/features/theme/ThemeProvider";
import { QueryProvider } from "@/features/app-shell/QueryProvider";
import { resolveActiveTokens } from "@/features/theme/theme-service";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const metadata = {
  title: "EtsyHub",
  description: "Etsy productivity & POD workspace",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const tokens = await resolveActiveTokens();
  return (
    <html lang="tr" className={`${inter.variable} ${plexMono.variable}`}>
      <body>
        <ThemeProvider tokens={tokens}>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
