import type { ComponentProps } from "react";
import { cn } from "../../../src/cn.ts";

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "box-border w-full rounded-[var(--radius-sm)] border-[1.5px] border-solid border-[var(--line-strong)] bg-[var(--bg)] px-3 py-[0.65rem] font-[family-name:var(--font-body)] text-[length:var(--t-base)] font-normal text-[var(--ink)] transition-colors placeholder:text-[var(--gris-300)] hover:border-[var(--accent-ui)] focus-visible:border-[var(--accent)] aria-invalid:border-[var(--error)]",
        className,
      )}
      {...props}
    />
  );
}
