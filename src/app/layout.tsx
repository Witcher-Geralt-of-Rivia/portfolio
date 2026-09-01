import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import SiteShell from "@/components/layout/SiteShell";

import "./globals.css";

export const metadata: Metadata = {
  title: "Intelligent Systems Lab",
  description:
    "A calm, precise visual foundation for an engineering and design portfolio.",
};

export const viewport: Viewport = {
  themeColor: "#f7f7fb",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    /* Both families are self-hosted variable WOFF2 bundled through the geist
       package and next/font/local. They expose --font-geist-sans and
       --font-geist-mono, which the font stack tokens resolve first. No font
       is fetched from a third-party origin at runtime. */
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
