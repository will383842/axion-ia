/**
 * VilleFaqGeolocalisee — FAQ ville-spécifique LLM-générée (Server Component).
 *
 * Sprint A · Phase 4 (Will 2026-05-25) — composant ville-only utilisé dans les
 * templates `/fr/implantations/{region}/{ville}/{verticale}` et le hub
 * `/fr/implantations/{region}/{ville}`. Reçoit en prop ≤10 Q/A déjà générées
 * (pipeline LLM ville/verticale) ; n'invente jamais de contenu. Émet le JSON-LD
 * `FAQPage` + `SpeakableSpecification` (via `buildFaqJsonLd`) et un markup
 * `<details>/<summary>` 100% SSR — aucun JS client, aucun hook React.
 */

import { buildFaqJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";
import type { VilleContext } from "@/components/services/types";

interface VilleFaqGeolocaliseeProps {
  readonly villeContext: VilleContext;
  readonly faqs: ReadonlyArray<{ q: string; a: string }>;
  readonly isFr: boolean;
}

/** Slugify minimal pour ids stables `<summary>`/JSON-LD à partir d'une question LLM. */
function slugifyId(input: string, fallbackIndex: number): string {
  const slug = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug.length > 0 ? `ville-faq-${slug}` : `ville-faq-q-${fallbackIndex}`;
}

export function VilleFaqGeolocalisee({
  villeContext,
  faqs,
  isFr,
}: VilleFaqGeolocaliseeProps) {
  // Cap à 10 entrées pour éviter content bloat (LLM peut générer plus).
  const items = faqs.slice(0, 10);
  if (items.length === 0) {
    return null;
  }

  const normalized = items.map((entry, idx) => ({
    id: slugifyId(entry.q, idx),
    question: entry.q,
    answer: entry.a,
  }));

  const sectionId = `ville-faq-${villeContext.villeSlug}`;
  const headingId = `${sectionId}-title`;

  const heading = isFr
    ? `FAQ — ${villeContext.name}`
    : `FAQ — ${villeContext.name}`;

  const description = isFr
    ? `Questions des dirigeants de TPE/PME/ETI/GE de ${villeContext.name}. Notre équipe d'experts répond sous 24 h ouvrées si la vôtre n'y est pas.`
    : `Questions from TPE/PME/ETI/GE leaders in ${villeContext.name}. Our expert team replies within 24 business hours if yours isn't listed.`;

  // JSON-LD FAQPage + SpeakableSpecification (cible data-faq-q / data-faq-a).
  // Factory centralisée seo.ts — Speakable auto-injecté par défaut.
  const faqJsonLd = buildFaqJsonLd({
    items: normalized.map((item) => ({
      question: item.question,
      answer: item.answer,
    })),
  });

  return (
    <section
      aria-labelledby={headingId}
      id={sectionId}
      className="bg-paper py-16 sm:py-20"
    >
      <div className="mx-auto max-w-4xl px-6 lg:px-10">
        <p className="text-fg-muted mb-3 text-[12px] font-semibold tracking-[0.16em] uppercase">
          <span className="bg-terracotta mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle" />
          {isFr ? "Questions fréquentes" : "Frequently asked"}
        </p>
        <h2
          id={headingId}
          className="text-fg text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {heading}
        </h2>
        <p className="text-fg-soft mt-3 max-w-2xl text-base leading-relaxed">
          {description}
        </p>

        <dl className="mt-10 divide-y divide-border-strong/30 border-y border-border-strong/30">
          {normalized.map((item) => (
            <div key={item.id} className="py-2">
              <details className="group">
                <summary
                  id={item.id}
                  className="text-fg flex cursor-pointer list-none items-start justify-between gap-4 py-4 text-left text-base font-semibold leading-snug sm:text-lg"
                >
                  <dt data-faq-q className="flex-1">
                    {item.question}
                  </dt>
                  <span
                    aria-hidden="true"
                    className="text-fg-muted mt-1 shrink-0 text-xl leading-none transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <dd
                  data-faq-a
                  className="text-fg-soft pb-5 pr-8 text-[15px] leading-relaxed"
                >
                  {item.answer}
                </dd>
              </details>
            </div>
          ))}
        </dl>
      </div>

      <JsonLd
        data={faqJsonLd}
        strategy="afterInteractive"
        scriptId={`jsonld-${sectionId}`}
      />
    </section>
  );
}
