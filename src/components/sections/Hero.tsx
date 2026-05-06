import * as React from "react";
import { Container } from "@/components/layout/Container";
import { Eyebrow } from "@/components/typography/Eyebrow";
import { cn } from "@/lib/utils";

type HeroVariant = "home" | "module" | "product" | "transverse";

interface HeroProps {
  variant?: HeroVariant;
  eyebrow?: string;
  /** Module color used by the eyebrow + accent border. */
  accent?: "primary" | "purple" | "orange" | "green" | "pink" | "yellow" | "red";
  title: React.ReactNode;
  description?: React.ReactNode;
  cta?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}

const verticalRhythm: Record<HeroVariant, string> = {
  home: "py-20 sm:py-24 lg:py-32",
  module: "py-16 sm:py-20 lg:py-28",
  product: "py-16 sm:py-20 lg:py-28",
  transverse: "py-12 sm:py-16 lg:py-20",
};

const titleScale: Record<HeroVariant, string> = {
  home: "text-[clamp(3rem,7vw,5rem)] leading-[1.04] font-semibold tracking-tight",
  module: "text-[clamp(2.5rem,6vw,4rem)] leading-[1.04] font-semibold tracking-tight",
  product: "text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.04] font-semibold tracking-tight",
  transverse: "text-[clamp(2rem,5vw,3.5rem)] leading-[1.1] font-semibold tracking-tight",
};

const eyebrowVariant: Record<
  NonNullable<HeroProps["accent"]>,
  "primary" | "purple" | "orange" | "green" | "pink" | "yellow" | "red"
> = {
  primary: "primary",
  purple: "purple",
  orange: "orange",
  green: "green",
  pink: "pink",
  yellow: "yellow",
  red: "red",
};

// First-fold conversion block. Mobile-first; desktop expands type scale and
// rhythm. Keep `description` short (max ~2 lines on desktop, ~3 on mobile).
export function Hero({
  variant = "module",
  eyebrow,
  accent = "primary",
  title,
  description,
  cta,
  meta,
  className,
}: HeroProps) {
  return (
    <section className={cn("bg-bg text-fg", verticalRhythm[variant], className)}>
      <Container>
        <div className="max-w-4xl">
          {eyebrow ? <Eyebrow variant={eyebrowVariant[accent]}>{eyebrow}</Eyebrow> : null}
          <h1 className={cn("mt-4", titleScale[variant])}>{title}</h1>
          {description ? (
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-700 sm:text-xl">
              {description}
            </p>
          ) : null}
          {cta ? <div className="mt-10 flex flex-wrap gap-3">{cta}</div> : null}
          {meta ? (
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-600">
              {meta}
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
