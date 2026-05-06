import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Webflow-inspired button system. CTA primary uses translate-x-[6px] hover
// (cta-translate utility from globals.css). Radius is fixed to rounded-sm
// (4 px) per Design.md §4.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-sm font-medium tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:bg-primary-hover cta-translate",
        secondary: "bg-fg text-bg hover:bg-gray-800 cta-translate",
        ghost: "text-fg hover:bg-border/40 cta-translate",
        outline:
          "border border-border text-fg hover:border-border-hover hover:bg-border/20 cta-translate",
        link: "text-primary underline-offset-4 hover:underline",
        destructive: "bg-accent-red text-primary-fg hover:opacity-90 cta-translate",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-5 text-base",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-7 text-lg",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, loading = false, disabled, children, ...rest },
  ref,
) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    // Slot accepts exactly one child — pass-through styles only.
    // (loading state is not supported in asChild mode by design; consumers
    // should pre-render their spinner inside the child if needed.)
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
