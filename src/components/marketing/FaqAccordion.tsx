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
}

// Wraps the headless Accordion with auto Schema.org `FAQPage` JSON-LD
// (axionia-seo-aeo §AEO answer blocks).
export function FaqAccordion({ items, emitJsonLd = true, className }: FaqAccordionProps) {
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
            <AccordionContent>{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      {jsonLd ? <JsonLd data={jsonLd} /> : null}
    </>
  );
}
