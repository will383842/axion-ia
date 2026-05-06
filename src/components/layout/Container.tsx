import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

interface ContainerProps<T extends ElementType = "div"> {
  as?: T;
  className?: string | undefined;
  children: ReactNode;
}

// Editorial v3 container: max-w 1520 (vs 1280 v1 webflow), responsive
// padding progressif 16/24/40/64. Plus aéré sur grands écrans tout en
// restant cadré (pas pleine largeur). Mobile-first.
export function Container<T extends ElementType = "div">({
  as,
  className,
  children,
  ...rest
}: ContainerProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof ContainerProps<T>>) {
  const Component = (as ?? "div") as ElementType;
  return (
    <Component
      className={cn("mx-auto w-full max-w-[1520px] px-4 sm:px-6 lg:px-10 xl:px-16", className)}
      {...rest}
    >
      {children}
    </Component>
  );
}
