"use client";

import { Indicator, Root } from "@radix-ui/react-checkbox";
import type { ComponentProps } from "react";
import { cn } from "../../../src/cn.ts";

export function Checkbox({ className, ...props }: ComponentProps<typeof Root>) {
  return (
    <Root
      data-slot="checkbox"
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-solid border-[var(--line-strong)] bg-[var(--bg)] p-0 text-[var(--blanco)] outline-none focus-visible:border-[var(--accent)] data-[state=checked]:border-[var(--accent)] data-[state=checked]:bg-[var(--accent)]",
        className,
      )}
      {...props}
    >
      <Indicator className="flex items-center justify-center text-current">
        <svg viewBox="0 0 16 16" className="size-3" aria-hidden="true">
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </Indicator>
    </Root>
  );
}
