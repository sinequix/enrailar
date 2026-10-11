"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../../src/cn.ts";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-solid font-[family-name:var(--font-display)] text-[length:var(--t-sm)] font-semibold tracking-[0.01em] no-underline px-5 py-[0.8rem] cursor-pointer transition-colors disabled:cursor-progress disabled:opacity-60",
  {
    variants: {
      variant: {
        default:
          "border-[var(--accent)] bg-[var(--accent)] text-[var(--blanco)] hover:border-[var(--azul-riel)] hover:bg-[var(--azul-riel)]",
        ghost:
          "border-[var(--accent)] bg-transparent text-[var(--accent)] hover:bg-[var(--celeste-100)]",
        sol:
          "border-[var(--sol-soft)] bg-[var(--sol-soft)] text-[var(--azul-riel)] hover:border-[var(--sol)] hover:bg-[var(--sol)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function Button({
  className,
  variant = "default",
  asChild = false,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  const legacy = variant === "ghost" ? "btn btn--ghost" : variant === "sol" ? "btn btn--sol" : "btn";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant }), legacy, className)} {...props} />;
}
