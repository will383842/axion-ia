import * as React from "react";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";

type HeroVariant = "home" | "module" | "product" | "transverse";

interface HeroProps {
  variant?: HeroVariant;
  eyebrow?: string;
  /** Module color used by the eyebrow indicator dot. */
  accent?: "primary" | "purple" | "orange" | "green" | "pink" | "yellow" | "red" | "terracotta";
  title: React.ReactNode;
  /** Optional emphasized portion (rendered serif italic terracotta-soft). */
  titleEm?: React.ReactNode;
  /** Trailing portion after `titleEm`. */
  titleTail?: React.ReactNode;
  description?: React.ReactNode;
  cta?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}

const verticalRhythm: Record<HeroVariant, string> = {
  home: "py-24 sm:py-32 lg:py-40",
  module: "py-20 sm:py-24 lg:py-32",
  product: "py-20 sm:py-24 lg:py-32",
  transverse: "py-16 sm:py-20 lg:py-24",
};

const titleScale: Record<HeroVariant, string> = {
  home: "text-display-editorial",
  module: "text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.04] font-semibold tracking-tight",
  product: "text-[clamp(2.5rem,6vw,5rem)] leading-[1.04] font-semibold tracking-tight",
  transverse: "text-[clamp(2rem,5vw,3.5rem)] leading-[1.08] font-semibold tracking-tight",
};

const accentDot: Record<NonNullable<HeroProps["accent"]>, string> = {
  primary: "bg-primary",
  purple: "bg-accent-purple",
  orange: "bg-accent-orange",
  green: "bg-accent-green",
  pink: "bg-accent-pink",
  yellow: "bg-accent-yellow",
  red: "bg-accent-red",
  terracotta: "bg-terracotta",
};

// First-fold conversion block. Editorial v3 — bg-halo-warm by default,
// eyebrow indicator dot in module color, optional serif italic accent in title.
export function Hero({
  variant = "module",
  eyebrow,
  accent = "terracotta",
  title,
  titleEm,
  titleTail,
  description,
  cta,
  meta,
  className,
}: HeroProps) {
  return (
    <section
      className={cn("bg-halo-warm relative overflow-hidden", verticalRhythm[variant], className)}
    >
      <Container className="relative">
        <div className="max-w-5xl">
          {eyebrow ? (
            <p className="text-fg-muted mb-8 text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                className={cn(
                  "mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle",
                  accentDot[accent],
                )}
              />
              {eyebrow}
            </p>
          ) : null}
          <h1 className={cn("text-fg", titleScale[variant])}>
            {title}
            {titleEm ? (
              <span
                className="italic-editorial text-terracotta mx-2"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {titleEm}
              </span>
            ) : null}
            {titleTail}
          </h1>
          {description ? (
            <p className="text-fg-soft mt-10 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {description}
            </p>
          ) : null}
          {cta ? <div className="mt-12 flex flex-wrap gap-4">{cta}</div> : null}
          {meta ? (
            <div className="text-fg-muted mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
              {meta}
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
