import { ArrowUpRight } from "lucide-react";
import { buildFaqJsonLd } from "@/lib/seo";
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

// FAQ accordion 100% CSS-only (`<details>/<summary>`) — aucun JS client, aucun
// hook (perfection FAQ 2026-05-31, axe F1) : retire `@radix-ui/react-accordion`
// du First Load JS de toute route portant des FAQ (hub, services). Même pattern
// a11y que `VilleFaqGeolocalisee` : `<ul role="list">` (évite les échecs axe
// `definition-list`), `data-faq-q`/`data-faq-a` conservés pour la Speakable
// Specification (sélecteurs CSS, indépendants du tag). Émet le `FAQPage` JSON-LD
// via la factory centralisée `buildFaqJsonLd` (Speakable auto-injecté).
export function FaqAccordion({
  items,
  emitJsonLd = true,
  className,
  permalinkBase,
  permalinkLabel = "Page dédiée",
}: FaqAccordionProps) {
  const jsonLd = emitJsonLd ? buildFaqJsonLd({ items }) : null;

  return (
    <>
      <ul role="list" className={className}>
        {items.map((item) => (
          <li key={item.id}>
            <details className="group border-border border-b">
              <summary className="text-fg flex cursor-pointer list-none items-start justify-between gap-4 py-4 text-left text-base font-medium">
                <span data-faq-q className="flex-1">
                  {item.question}
                </span>
                <span
                  aria-hidden="true"
                  className="text-fg-muted mt-1 shrink-0 text-xl leading-none transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="pb-5">
                <p data-faq-a className="text-fg-soft text-[15px] leading-relaxed">
                  {item.answer}
                </p>
                {permalinkBase ? (
                  <a
                    href={`${permalinkBase}/${item.id}`}
                    className="text-primary hover:text-primary/80 mt-4 inline-flex items-center gap-1 text-sm font-medium"
                  >
                    {permalinkLabel}
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </details>
          </li>
        ))}
      </ul>
      {jsonLd ? <JsonLd data={jsonLd} /> : null}
    </>
  );
}
