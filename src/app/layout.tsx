import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "EtsyHub",
  description: "Etsy productivity & POD workspace",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
