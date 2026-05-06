import * as React from "react";
import { cn } from "@/lib/utils";

// Editorial v3 — radius-xl 20px, border sand-doux, hover terracotta + shadow
// douce. Padding plus généreux (p-7) pour respiration éditoriale.
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function Card({ className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "border-border bg-paper hover:border-border-strong rounded-xl border shadow-subtle transition duration-200 hover:shadow-card",
          className,
        )}
        {...rest}
      />
    );
  },
);

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...rest }, ref) {
    return <div ref={ref} className={cn("space-y-2 p-7", className)} {...rest} />;
  },
);

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...rest }, ref) {
    return (
      <h3
        ref={ref}
        className={cn(
          "text-fg text-xl leading-tight font-semibold tracking-tight",
          className,
        )}
        {...rest}
      />
    );
  },
);

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...rest }, ref) {
  return (
    <p
      ref={ref}
      className={cn("text-fg-soft text-sm leading-relaxed", className)}
      {...rest}
    />
  );
});

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...rest }, ref) {
    return <div ref={ref} className={cn("p-7 pt-0", className)} {...rest} />;
  },
);

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...rest }, ref) {
    return <div ref={ref} className={cn("flex items-center p-7 pt-0", className)} {...rest} />;
  },
);
