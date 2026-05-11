import type { ReactNode } from "react";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/features/theme/ThemeProvider";
import { QueryProvider } from "@/features/app-shell/QueryProvider";
import { resolveActiveTokens } from "@/features/theme/theme-service";

// Legacy fonts — kept while ThemeProvider runtime token override pipeline
// (admin Theme editor) still references --font-inter / --font-plex-mono.
// New surfaces use Kivasy stack (Clash Display + General Sans + Geist Mono),
// loaded via fontshare/google CDN <link> tags below for v4/v5/v6/v7 parity.
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
  title: "Kivasy",
  description:
    "Operator tool for Etsy sellers producing digital downloadable products",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const tokens = await resolveActiveTokens();
  return (
    <html lang="tr" className={`${inter.variable} ${plexMono.variable}`}>
      {/* Kivasy canonical type stack — Clash Display + General Sans are
          served from Fontshare (not Google Fonts), so next/font cannot host
          them. Geist Mono is Google but kept in the same CDN bundle for
          parity with v4-v7 UI kits. CDN-loaded fonts are intentional here
          per docs/IMPLEMENTATION_HANDOFF.md §2; offline rendering ships its
          own woff2 bundle in a later rollout. */}
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=general-sans@300,400,500,600,700&f[]=clash-display@500,600,700&display=swap"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <ThemeProvider tokens={tokens}>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
