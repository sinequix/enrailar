import type { ReactNode } from "react";
import { SITE_URL } from "../src/copy.ts";
import "./globals.css";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Enrailar",
  description: "Recuperar los trenes de Argentina. Fase 1: monitoreo.",
  icons: {
    icon: [
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon.ico", sizes: "48x48" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "Enrailar",
    images: [{ url: "/brand/og.png", width: 1200, height: 630, alt: "Enrailar" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/brand/og.png"],
  },
};

export const viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preload" href="/fonts/archivo-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/chivo-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
