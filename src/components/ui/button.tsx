import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Editorial v3 button system. Marketing CTAs use `pill` shape (rounded-full).
// Forms keep `rounded-md` for compactness. cta-lift is the new hover signature
// (translate-y -2px + shadow growth) — replaces v1's translate-x-6px.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-semibold tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-fg hover:bg-primary-hover cta-lift",
        secondary: "bg-fg text-bg hover:bg-mocha cta-lift",
        ghost: "text-fg hover:bg-sand cta-lift",
        outline:
          "border border-border-strong text-fg bg-paper/60 hover:bg-paper hover:border-fg cta-lift backdrop-blur",
        terracotta:
          "bg-terracotta text-mocha-fg hover:bg-terracotta-deep cta-lift",
        link: "text-primary underline-offset-4 hover:underline",
        destructive:
          "bg-error text-primary-fg hover:opacity-90 cta-lift",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-7 text-base",
        icon: "h-11 w-11 p-0",
      },
      shape: {
        rounded: "rounded-md",
        pill: "rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md", shape: "rounded" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, shape, asChild = false, loading = false, disabled, children, ...rest },
  ref,
) {
  const classes = cn(buttonVariants({ variant, size, shape }), className);

  if (asChild) {
    return (
      <Slot ref={ref} className={classes} {...rest}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      ref={ref}
      data-loading={loading ? "" : undefined}
      className={classes}
      disabled={disabled ?? loading}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
});

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
      role="status"
      aria-hidden="true"
    />
  );
}

export { buttonVariants };
