import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative flex gap-3 rounded-sm border px-4 py-3 text-sm",
  {
    variants: {
      variant: {
        info: "border-primary/20 bg-primary/5 text-fg",
        success: "border-accent-green/30 bg-accent-green/10 text-fg",
        warning: "border-accent-yellow/40 bg-accent-yellow/15 text-fg",
        danger: "border-accent-red/30 bg-accent-red/10 text-fg",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { className, variant, role = "alert", ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      role={role}
      className={cn(alertVariants({ variant }), className)}
      {...rest}
    />
  );
});

export const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  function AlertTitle({ className, ...rest }, ref) {
    return (
      <h3
        ref={ref}
        className={cn("text-sm font-semibold leading-tight tracking-tight", className)}
        {...rest}
      />
    );
  },
);

export const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function AlertDescription({ className, ...rest }, ref) {
  return <p ref={ref} className={cn("text-sm text-gray-700", className)} {...rest} />;
});
