import * as React from "react";
import { Container } from "@/components/layout/Container";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { cn } from "@/lib/utils";

interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

type FaqTone = "canvas" | "paper" | "sand";

interface FaqBlockProps {
  eyebrow?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  items: ReadonlyArray<FaqEntry>;
  /** Disable JSON-LD if the page already emits its own FAQPage schema. */
  emitJsonLd?: boolean;
  tone?: FaqTone;
  /** Pass-through to FaqAccordion — adds a permalink CTA per question. */
  permalinkBase?: string;
  /** Pass-through to FaqAccordion — locale-aware label for the permalink. */
  permalinkLabel?: string;
}

const toneClasses: Record<FaqTone, string> = {
  canvas: "bg-bg",
  paper: "bg-paper",
  sand: "bg-sand",
};

// Editorial v3 — sober FAQ section. Default tone = canvas (ivoire).
export function FaqBlock({
  eyebrow = "FAQ",
  title,
  description,
  items,
  emitJsonLd = true,
  tone = "canvas",
  permalinkBase,
  permalinkLabel,
}: FaqBlockProps) {
  return (
    <section className={cn("py-24 sm:py-28 lg:py-36", toneClasses[tone])}>
      <Container className="max-w-3xl">
        {eyebrow ? (
          <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
            {eyebrow}
          </p>
        ) : null}
        {title ? (
          <h2 className="text-fg text-[clamp(2rem,4vw,3rem)] leading-[1.1] font-semibold tracking-tight">
            {title}
          </h2>
        ) : null}
        {description ? (
          <p className="text-fg-soft mt-4 text-base leading-relaxed">{description}</p>
        ) : null}
        <div className="mt-12">
          <FaqAccordion
            items={items}
            emitJsonLd={emitJsonLd}
            {...(permalinkBase !== undefined ? { permalinkBase } : {})}
            {...(permalinkLabel !== undefined ? { permalinkLabel } : {})}
          />
        </div>
      </Container>
    </section>
  );
}
