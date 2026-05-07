import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type, ...rest }, ref) {
    return (
      <input
        ref={ref}
        type={type ?? "text"}
        className={cn(
          "border-border-strong bg-paper text-fg placeholder:text-fg-muted/45 hover:border-fg/60 focus-visible:border-terracotta focus-visible:ring-terracotta/20 flex h-12 w-full rounded-lg border px-4 py-2 text-base transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...rest}
      />
    );
  },
);
