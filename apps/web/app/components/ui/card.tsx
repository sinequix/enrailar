import type { ComponentProps } from "react";
import { cn } from "../../../src/cn.ts";

export function Card({ className, ...props }: ComponentProps<"article">) {
  return (
    <article
      data-slot="card"
      className={cn(
        "card grid content-start gap-2 rounded-[var(--radius)] border border-solid border-[var(--line)] bg-[var(--bg)] p-[var(--s-5)] text-[var(--ink)]",
        className,
      )}
      {...props}
    />
  );
}
