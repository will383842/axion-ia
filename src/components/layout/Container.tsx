import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

interface ContainerProps<T extends ElementType = "div"> {
  as?: T;
  className?: string | undefined;
  children: ReactNode;
}

// Webflow-inspired container: max-w 1280, responsive padding 16/24/32/48.
// Mobile-first as always (axionia-mobile-first).
export function Container<T extends ElementType = "div">({
  as,
  className,
  children,
  ...rest
}: ContainerProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof ContainerProps<T>>) {
  const Component = (as ?? "div") as ElementType;
  return (
    <Component
      className={cn("mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8 xl:px-12", className)}
      {...rest}
    >
      {children}
    </Component>
  );
}
