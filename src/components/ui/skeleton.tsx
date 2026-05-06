import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("bg-border/60 animate-pulse rounded-xs", className)}
      {...rest}
    />
  );
}
