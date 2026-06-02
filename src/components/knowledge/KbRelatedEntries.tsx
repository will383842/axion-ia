/**
 * KbRelatedEntries — cluster topique « Sur le même sujet » des pages
 * `/connaissances/[slug]`. Rend les entrées KB liées (reader
 * `findRelatedKbEntries`, tiers relations → tags → domaine).
 *
 * Server Component pur — liens internes, 0 JS client, CLS=0, tokens uniquement.
 * Masqué si < 2 cartes (un cluster d'un seul élément n'apporte rien et donnerait
 * une section creuse — anti-doorway).
 */

import { Section } from "@/components/layout/Section";
import { Link } from "@/i18n/navigation";
import { JsonLd } from "@/components/marketing/JsonLd";
import { SITE_URL } from "@/lib/seo";
import type { RelatedKbCard } from "@/lib/knowledge/related-entries";

const TYPE_LABEL: Readonly<Record<string, string>> = {
  fact: "Donnée clé",
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
};

interface KbRelatedEntriesProps {
  readonly items: ReadonlyArray<RelatedKbCard>;
}

export function KbRelatedEntries({ items }: KbRelatedEntriesProps) {
  // Un cluster a besoin d'au moins 2 voisins pour avoir du sens.
  if (items.length < 2) return null;

  // ItemList AEO/GEO — rend le cluster lisible par les moteurs/LLM (même shape
  // que SuggestedContent.buildItemListJsonLd, pour cohérence sitewide).
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Sur le même sujet",
    numberOfItems: items.length,
    itemListElement: items.map((card, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `${SITE_URL}/fr/connaissances/${card.slug}`,
      name: card.title,
    })),
  };

  return (
    <Section tone="sand" eyebrow="Cluster" title="Sur le même" titleEm="sujet">
      <JsonLd data={itemListJsonLd} />
      <ul className="-mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((card) => {
          const typeLabel = TYPE_LABEL[card.type] ?? "Ressource";
          const excerpt = card.excerpt?.trim();
          const showExcerpt =
            excerpt &&
            !excerpt.toLowerCase().startsWith(card.title.trim().slice(0, 24).toLowerCase());
          return (
            <li
              key={card.slug}
              className="border-border bg-paper hover:border-terracotta hover:shadow-card flex flex-col rounded-2xl border p-6 transition"
            >
              <Link
                href={{ pathname: "/connaissances/[slug]", params: { slug: card.slug } }}
                className="focus-visible:ring-terracotta block rounded-md focus-visible:ring-2 focus-visible:outline-none"
              >
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
                  <p className="text-fg-soft mt-2 line-clamp-2 text-sm leading-relaxed">
                    {excerpt}
                  </p>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
