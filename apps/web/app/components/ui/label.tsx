"use client";

import { Root } from "@radix-ui/react-label";
import type { ComponentProps } from "react";
import { cn } from "../../../src/cn.ts";

export function Label({ className, ...props }: ComponentProps<typeof Root>) {
  return <Root data-slot="label" className={cn(className)} {...props} />;
}
