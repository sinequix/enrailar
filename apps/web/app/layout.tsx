import type { ReactNode } from "react";
import { SITE_URL } from "../src/copy.ts";
import { sumateBootScript } from "../src/sumate-memory.ts";
import "./globals.css";

/** Ahrefs Web Analytics (proyecto Enrailar). La data-key es pública: vive en el HTML. */
const AHREFS_ANALYTICS_SRC = "https://analytics.ahrefs.com/analytics.js";
const AHREFS_ANALYTICS_KEY = "zh3y3cn8V+6DKAB/bteo9w";

/** GA4 (propiedad enrailar.com). El measurement ID es público: vive en el HTML. */
const GA_MEASUREMENT_ID = "G-Y0M7G9KGEW";
const GA_SCRIPT_SRC = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
const GA_INLINE_SCRIPT = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`;

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Enrailar",
  description: "Recuperar los trenes de Argentina. Fase 1: monitoreo.",
  icons: {
    icon: [
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon.ico", sizes: "16x16 32x32 48x48" },
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
        <script src={AHREFS_ANALYTICS_SRC} data-key={AHREFS_ANALYTICS_KEY} async />
        <script src={GA_SCRIPT_SRC} async />
        <script dangerouslySetInnerHTML={{ __html: GA_INLINE_SCRIPT }} />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: sumateBootScript() }} />
        {children}
      </body>
    </html>
  );
}
