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
        "border-border bg-bg text-fg placeholder:text-gray-300 hover:border-border-hover focus-visible:border-primary focus-visible:ring-primary/20 flex min-h-[88px] w-full rounded-sm border px-3 py-2 text-base transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    />
  );
});
