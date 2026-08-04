import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

type EyebrowVariant =
  "default" | "primary" | "purple" | "orange" | "green" | "pink" | "yellow" | "red";

interface EyebrowProps extends Omit<ComponentPropsWithoutRef<"p">, "title"> {
  variant?: EyebrowVariant;
}

// Uppercase label 12.8-15px, weight 500-600, tracking ~1.5px (Design.md §3).
// `variant` lets each module pick its accent (axionia-design module-color mapping).
const variantClasses: Record<EyebrowVariant, string> = {
  default: "text-fg-muted",
  primary: "text-primary",
  purple: "text-accent-purple",
  orange: "text-accent-orange",
  green: "text-accent-green",
  pink: "text-accent-pink",
  yellow: "text-accent-yellow",
  red: "text-accent-red",
};

export function Eyebrow({ variant = "default", className, children, ...rest }: EyebrowProps) {
  return (
    <p
      className={cn(
        "text-[0.8rem] leading-tight font-semibold tracking-[0.1em] uppercase",
        variantClasses[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </p>
  );
}
