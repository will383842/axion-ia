import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "border-border-strong bg-paper text-fg placeholder:text-fg-muted/45 hover:border-fg/60 focus-visible:border-terracotta focus-visible:ring-terracotta/20 flex min-h-[88px] w-full rounded-lg border px-4 py-3 text-base transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    />
  );
});
