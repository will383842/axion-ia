import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Container } from "./Container";
import { Eyebrow } from "../typography/Eyebrow";

interface SectionProps extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
  contentClassName?: string;
  children?: ReactNode;
}

// Webflow vertical rhythm: py-16 sm py-20 lg py-28.
// id supports anchor-based navigation; contentClassName overrides inner container.
export function Section({
  id,
  eyebrow,
  title,
  description,
  className,
  contentClassName,
  children,
  ...rest
}: SectionProps) {
  return (
    <section id={id} className={cn("py-16 sm:py-20 lg:py-28", className)} {...rest}>
      <Container className={contentClassName}>
        {(eyebrow ?? title ?? description) ? (
          <header className="mb-10 max-w-3xl space-y-4 sm:mb-14">
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            {title ? (
              <h2 className="text-fg text-[clamp(2rem,4vw,3.5rem)] leading-[1.04] font-semibold tracking-tight">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="max-w-2xl text-lg leading-relaxed text-gray-700">{description}</p>
            ) : null}
          </header>
        ) : null}
        {children}
      </Container>
    </section>
  );
}
