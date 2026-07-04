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

import { ArrowUpRight } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Link } from "@/i18n/navigation";
import { listEntriesByService } from "@/lib/knowledge/readers";
import type { ServiceSlug } from "@/content/knowledge/services";

// Libellés FR propres pour le type de ressource (au lieu du slug brut
// "industry_use_case" → "industry use case"). Défaut sobre « Ressource ».
const TYPE_LABEL: Readonly<Record<string, string>> = {
  industry_use_case: "Cas d'usage",
  case_study: "Cas concret",
  guide: "Guide",
  comparison: "Comparatif",
  faq: "Question fréquente",
  glossary_term: "Définition",
  tool_review: "Outils",
  automation_recipe: "Automatisation",
  roi_calculator_template: "ROI",
  implementation_playbook: "Méthode",
  secteur_brief: "Secteur",
  dept_brief: "Fonction",
  metier_brief: "Métier",
  competence_boost: "Compétence",
  intervention_module: "Formation",
};

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
      <ul className="xs:grid-cols-2 grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const typeLabel = TYPE_LABEL[String(card.type)] ?? "Ressource";
          // Évite le doublon « titre tronqué + excerpt identique » : on n'affiche
          // l'excerpt que s'il n'est pas une reprise du début du titre.
          const excerpt = card.excerpt?.trim();
          const showExcerpt =
            excerpt &&
            !excerpt.toLowerCase().startsWith(card.title.trim().slice(0, 24).toLowerCase());
          const inner = (
            <>
              <p className="text-terracotta-deep mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
                />
                {typeLabel}
              </p>
              <h3 className="text-fg line-clamp-3 text-[15px] leading-snug font-semibold">
                {card.title}
              </h3>
              {showExcerpt ? (
                <p className="text-fg-soft mt-2 line-clamp-2 text-sm leading-relaxed">{excerpt}</p>
              ) : null}
              {card.href ? (
                <span className="text-terracotta-deep mt-4 inline-flex items-center gap-1 text-[13px] font-medium">
                  {"Lire"}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              ) : null}
            </>
          );
          return (
            <li
              key={card.entryId}
              className="border-border bg-paper hover:border-terracotta hover:shadow-card flex flex-col rounded-2xl border p-6 transition"
            >
              {card.href ? (
                <Link
                  href={card.href as never}
                  className="focus-visible:ring-terracotta block rounded-md focus-visible:ring-2 focus-visible:outline-none"
                >
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
