import * as React from "react";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";

interface CtaBlockProps {
  eyebrow?: string;
  title: React.ReactNode;
  /** Optional emphasized portion (rendered serif italic terracotta-soft). */
  titleEm?: React.ReactNode;
  /** Trailing portion after `titleEm`. */
  titleTail?: React.ReactNode;
  description?: React.ReactNode;
  cta: React.ReactNode;
  /**
   * `mocha` (default) = brun-aubergine riche. `paper` = blanc. `sand` = ivoire chaud.
   * `dark` is kept as an alias of `mocha` for backward compat with v1/v2 callers.
   */
  tone?: "mocha" | "paper" | "sand" | "dark" | "light";
  className?: string;
}

const toneClasses: Record<NonNullable<CtaBlockProps["tone"]>, string> = {
  mocha: "bg-mocha-rich text-mocha-fg",
  dark: "bg-mocha-rich text-mocha-fg",
  paper: "bg-paper text-fg",
  light: "bg-paper text-fg",
  sand: "bg-sand text-fg",
};

const eyebrowClasses: Record<NonNullable<CtaBlockProps["tone"]>, string> = {
  mocha: "text-mocha-fg/70",
  dark: "text-mocha-fg/70",
  paper: "text-fg-muted",
  light: "text-fg-muted",
  sand: "text-fg-muted",
};

const descriptionClasses: Record<NonNullable<CtaBlockProps["tone"]>, string> = {
  mocha: "text-mocha-fg/85",
  dark: "text-mocha-fg/85",
  paper: "text-fg-soft",
  light: "text-fg-soft",
  sand: "text-fg-soft",
};

const titleClasses: Record<NonNullable<CtaBlockProps["tone"]>, string> = {
  mocha: "text-mocha-fg",
  dark: "text-mocha-fg",
  paper: "text-fg",
  light: "text-fg",
  sand: "text-fg",
};

const emClasses: Record<NonNullable<CtaBlockProps["tone"]>, string> = {
  mocha: "text-terracotta-soft",
  dark: "text-terracotta-soft",
  paper: "text-terracotta",
  light: "text-terracotta",
  sand: "text-terracotta",
};

// Editorial v3 — full-width conversion block, default tone = mocha-rich
// (alternative au noir). Title supports italic-editorial accent via titleEm.
export function CtaBlock({
  eyebrow,
  title,
  titleEm,
  titleTail,
  description,
  cta,
  tone = "mocha",
  className,
}: CtaBlockProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden py-24 sm:py-28 lg:py-36",
        toneClasses[tone],
        className,
      )}
    >
      <Container className="relative">
        <div className="max-w-3xl">
          {eyebrow ? (
            <p
              className={cn(
                "mb-5 text-[13px] font-medium tracking-[0.16em] uppercase",
                eyebrowClasses[tone],
              )}
            >
              {eyebrow}
            </p>
          ) : null}
          <h2
            className={cn(
              "text-[clamp(2.25rem,5vw,4.5rem)] leading-[1.02] font-semibold tracking-tight",
              titleClasses[tone],
            )}
          >
            {title}
            {titleEm ? (
              <span
                className={cn("mx-2 italic", emClasses[tone])}
                style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
              >
                {titleEm}
              </span>
            ) : null}
            {titleTail}
          </h2>
          {description ? (
            <p
              className={cn(
                "mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl",
                descriptionClasses[tone],
              )}
            >
              {description}
            </p>
          ) : null}
          <div className="mt-12 flex flex-wrap gap-4">{cta}</div>
        </div>
      </Container>
    </section>
  );
}
