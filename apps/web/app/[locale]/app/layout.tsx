import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { readAccess } from "../../access.ts";
import { isLocale } from "../../../src/copy.ts";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { access } = await readAccess();
  if (access.decision === "missing") redirect(`/${locale}/cuenta/ingresar`);
  return children;
}
