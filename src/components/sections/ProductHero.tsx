import * as React from "react";
import { Container } from "@/components/layout/Container";
import { Eyebrow } from "@/components/typography/Eyebrow";
import { Price } from "@/components/marketing/Price";
import { cn } from "@/lib/utils";

interface ProductHeroProps {
  eyebrow: string;
  accent?: "primary" | "purple" | "orange" | "green";
  title: React.ReactNode;
  /** AEO answer block — 40-80 words, citable by LLMs. */
  answer: React.ReactNode;
  priceEur?: number;
  priceSuffix?: "HT" | "from";
  cta: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}

// Hero used by every product page. Combines eyebrow + h1 + AEO answer +
// optional price + CTAs. Mobile-first; AEO bloc placed in the first fold
// for axionia-seo-aeo citability.
export function ProductHero({
  eyebrow,
  accent = "primary",
  title,
  answer,
  priceEur,
  priceSuffix = "HT",
  cta,
  meta,
  className,
}: ProductHeroProps) {
  return (
    <section className={cn("bg-bg text-fg py-16 sm:py-20 lg:py-28", className)}>
      <Container>
        <div className="max-w-4xl">
          <Eyebrow variant={accent}>{eyebrow}</Eyebrow>
          <h1 className="mt-4 text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.04] font-semibold tracking-tight">
            {title}
          </h1>
          <div className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-700 sm:text-xl">
            {answer}
          </div>
          {typeof priceEur === "number" ? (
            <div className="mt-8">
              <Price amount={priceEur} suffix={priceSuffix} size="xl" />
            </div>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">{cta}</div>
          {meta ? (
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-600">
              {meta}
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
