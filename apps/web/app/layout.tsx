import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Enrailar",
  description: "Recuperar los trenes de Argentina. Fase 1: monitoreo.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
