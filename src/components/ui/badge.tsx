import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// 12.8 px uppercase tracking-tight badge (Design.md §3 type scale).
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[0.8rem] font-semibold uppercase",
  {
    variants: {
      variant: {
        neutral: "bg-border/60 text-fg",
        accent: "bg-primary/10 text-primary",
        success: "bg-accent-green/15 text-fg",
        warning: "bg-accent-yellow/20 text-fg",
        danger: "bg-accent-red/10 text-accent-red",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...rest }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...rest} />;
}

export { badgeVariants };
