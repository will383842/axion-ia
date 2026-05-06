import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type, ...rest }, ref) {
    return (
      <input
        ref={ref}
        type={type ?? "text"}
        className={cn(
          "border-border bg-bg text-fg placeholder:text-gray-300 hover:border-border-hover focus-visible:border-primary focus-visible:ring-primary/20 flex h-11 w-full rounded-sm border px-3 py-2 text-base transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...rest}
      />
    );
  },
);
