import * as React from "react";
import { Container } from "@/components/layout/Container";
import { Price } from "@/components/marketing/Price";
import { cn } from "@/lib/utils";

interface ProductHeroProps {
  eyebrow: string;
  accent?: "primary" | "purple" | "orange" | "green";
  title: React.ReactNode;
  /** Portion du titre rendue en italique terracotta serif (signature v3). */
  titleEm?: React.ReactNode;
  /** Suite du titre après `titleEm` (texte standard). */
  titleTail?: React.ReactNode;
  /** AEO answer block — 40-80 words, citable by LLMs. */
  answer: React.ReactNode;
  priceEur?: number;
  priceSuffix?: "HT" | "from";
  cta: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}

// Editorial v3 — bg-halo-warm + 4px accent border-l with terracotta halo.
// Title uses Fraunces serif; answer block is body-sans for legibility.
const ACCENT_BORDER: Record<NonNullable<ProductHeroProps["accent"]>, string> = {
  primary: "border-l-primary",
  purple: "border-l-accent-purple",
  orange: "border-l-accent-orange",
  green: "border-l-accent-green",
};

const ACCENT_HALO: Record<NonNullable<ProductHeroProps["accent"]>, string> = {
  primary: "before:bg-primary/20",
  purple: "before:bg-accent-purple/20",
  orange: "before:bg-accent-orange/20",
  green: "before:bg-accent-green/20",
};

const ACCENT_DOT: Record<NonNullable<ProductHeroProps["accent"]>, string> = {
  primary: "bg-primary",
  purple: "bg-accent-purple",
  orange: "bg-accent-orange",
  green: "bg-accent-green",
};

export function ProductHero({
  eyebrow,
  accent = "primary",
  title,
  titleEm,
  titleTail,
  answer,
  priceEur,
  priceSuffix = "HT",
  cta,
  meta,
  className,
}: ProductHeroProps) {
  return (
    <section
      className={cn(
        "bg-halo-warm relative overflow-hidden py-20 sm:py-24 lg:py-32",
        // Faint accent halo derrière le bord gauche
        "before:absolute before:top-1/2 before:left-0 before:h-[60%] before:w-[20%] before:-translate-y-1/2 before:rounded-full before:blur-3xl",
        ACCENT_HALO[accent],
        className,
      )}
    >
      <Container className="relative">
        <div className={cn("relative max-w-4xl border-l-4 pl-6 sm:pl-10", ACCENT_BORDER[accent])}>
          <p className="text-fg-muted mb-8 text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              className={cn(
                "mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle",
                ACCENT_DOT[accent],
              )}
            />
            {eyebrow}
          </p>
          <h1
            className="text-fg text-[clamp(2.5rem,6vw,5rem)] leading-[1.04] font-medium tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {title}
            {titleEm ? (
              <span
                className="text-terracotta mx-2 italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {titleEm}
              </span>
            ) : null}
            {titleTail}
          </h1>
          <div className="text-fg-soft mt-7 max-w-2xl text-lg leading-relaxed sm:text-xl">
            {answer}
          </div>
          {typeof priceEur === "number" ? (
            <div className="mt-10">
              <Price amount={priceEur} suffix={priceSuffix} size="xl" />
            </div>
          ) : null}
          <div className="mt-10 flex flex-wrap gap-4">{cta}</div>
          {meta ? (
            <div className="text-fg-muted mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
              {meta}
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
