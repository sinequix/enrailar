"use client";

import { useEffect } from "react";

/** El layout raíz no conoce el locale; esto corrige `<html lang>` tras la hidratación. */
export function HtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
