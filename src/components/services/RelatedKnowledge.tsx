/**
 * KB V4.1 Service Binding — bloc « connaissances liées » d'une page service.
 *
 * Server Component pur (aucun JS client, CLS=0). Lit la KB via
 * `listEntriesByService` (triple filtre public strict) et rend une grille de
 * cartes vers les ressources KB rattachées au service.
 *
 * Règle « masquer si vide » : si la KB ne renvoie aucune entrée (build stub
 * `stub.invalid`, DB down, ou service sans contenu publié), le composant rend
 * `null` → aucune section vide indexable. Le bloc apparaît dès que l'ISR de la
 * page service repeuple sous son `revalidate`.
 */

import { Section } from "@/components/layout/Section";
import { Link } from "@/i18n/navigation";
import { listEntriesByService } from "@/lib/knowledge/readers";
import type { ServiceSlug } from "@/content/knowledge/services";

interface RelatedKnowledgeProps {
  readonly service: ServiceSlug;
  /** Titre de section (défaut FR générique). */
  readonly title?: string;
  /** Nombre max de cartes (défaut 6). */
  readonly limit?: number;
}

export async function RelatedKnowledge({
  service,
  title = "Connaissances liées",
  limit = 6,
}: RelatedKnowledgeProps) {
  const cards = await listEntriesByService(service, { locale: "fr", limit });

  // Masquer si vide (zéro section vide indexée).
  if (cards.length === 0) return null;

  return (
    <Section tone="sand" aria-labelledby="connaissances-liees">
      <h2 id="connaissances-liees" className="display-editorial text-fg mb-8">
        {title}
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const inner = (
            <>
              <p className="text-fg-muted mb-2 text-xs tracking-[0.16em] uppercase">
                {String(card.type).replaceAll("_", " ")}
              </p>
              <h3 className="text-fg text-lg font-semibold">{card.title}</h3>
              {card.excerpt ? (
                <p className="text-fg-soft mt-2 line-clamp-3 text-sm leading-relaxed">
                  {card.excerpt}
                </p>
              ) : null}
            </>
          );
          return (
            <li key={card.entryId} className="border-border bg-bg rounded-sm border p-5">
              {card.href ? (
                <Link href={card.href as never} className="block focus-visible:outline-none">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
