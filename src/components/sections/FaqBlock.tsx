import * as React from "react";
import { Container } from "@/components/layout/Container";
import { Eyebrow } from "@/components/typography/Eyebrow";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";

interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

interface FaqBlockProps {
  eyebrow?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  items: ReadonlyArray<FaqEntry>;
  /** Disable JSON-LD if the page already emits its own FAQPage schema. */
  emitJsonLd?: boolean;
}

// Section wrapper around <FaqAccordion>. Use on product pages above the CTA.
export function FaqBlock({
  eyebrow = "FAQ",
  title,
  description,
  items,
  emitJsonLd = true,
}: FaqBlockProps) {
  return (
    <section className="py-16 sm:py-20 lg:py-28">
      <Container className="max-w-3xl">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        {title ? (
          <h2 className="mt-3 text-[clamp(2rem,4vw,3rem)] leading-[1.1] font-semibold tracking-tight">
            {title}
          </h2>
        ) : null}
        {description ? (
          <p className="mt-4 text-base leading-relaxed text-gray-700">{description}</p>
        ) : null}
        <div className="mt-8">
          <FaqAccordion items={items} emitJsonLd={emitJsonLd} />
        </div>
      </Container>
    </section>
  );
}
