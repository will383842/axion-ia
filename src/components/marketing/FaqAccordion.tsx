import { ArrowUpRight } from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { JsonLd } from "./JsonLd";

interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

interface FaqAccordionProps {
  items: ReadonlyArray<FaqEntry>;
  /** Set to false on a page that already emits its own FAQPage JSON-LD. */
  emitJsonLd?: boolean;
  className?: string;
  /**
   * If provided, each open answer renders a "permalink" CTA pointing to
   * `${permalinkBase}/${item.id}`. Use on the public FAQ index where each
   * question has its own dedicated, indexable page (QAPage schema).
   */
  permalinkBase?: string;
  /** Locale-aware label for the permalink CTA. Default: "Page dédiée". */
  permalinkLabel?: string;
}

// Wraps the headless Accordion with auto Schema.org `FAQPage` JSON-LD
// (axionia-seo-aeo §AEO answer blocks).
export function FaqAccordion({
  items,
  emitJsonLd = true,
  className,
  permalinkBase,
  permalinkLabel = "Page dédiée",
}: FaqAccordionProps) {
  const jsonLd = emitJsonLd
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }
    : null;

  return (
    <>
      <Accordion type="single" collapsible className={className}>
        {items.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>
              <p>{item.answer}</p>
              {permalinkBase ? (
                <a
                  href={`${permalinkBase}/${item.id}`}
                  className="text-primary hover:text-primary/80 mt-4 inline-flex items-center gap-1 text-sm font-medium"
                >
                  {permalinkLabel}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      {jsonLd ? <JsonLd data={jsonLd} /> : null}
    </>
  );
}
