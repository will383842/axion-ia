import * as React from "react";
import { Container } from "@/components/layout/Container";
import { Eyebrow } from "@/components/typography/Eyebrow";
import { cn } from "@/lib/utils";

interface CtaBlockProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  cta: React.ReactNode;
  /** dark = inverted on near-black bg. Default light = canvas. */
  tone?: "light" | "dark";
  className?: string;
}

// Full-width conversion block, used near the bottom of product pages.
export function CtaBlock({
  eyebrow,
  title,
  description,
  cta,
  tone = "light",
  className,
}: CtaBlockProps) {
  const isDark = tone === "dark";
  return (
    <section
      className={cn(
        "py-16 sm:py-20 lg:py-28",
        isDark ? "bg-fg text-bg" : "bg-bg text-fg",
        className,
      )}
    >
      <Container>
        <div className="max-w-3xl">
          {eyebrow ? (
            <Eyebrow className={isDark ? "text-bg/70" : undefined} variant="primary">
              {eyebrow}
            </Eyebrow>
          ) : null}
          <h2 className="mt-3 text-[clamp(2rem,5vw,3.5rem)] leading-[1.04] font-semibold tracking-tight">
            {title}
          </h2>
          {description ? (
            <p
              className={cn(
                "mt-5 max-w-2xl text-lg leading-relaxed",
                isDark ? "text-bg/80" : "text-gray-700",
              )}
            >
              {description}
            </p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">{cta}</div>
        </div>
      </Container>
    </section>
  );
}
