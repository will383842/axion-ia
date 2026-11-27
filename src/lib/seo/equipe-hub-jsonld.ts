/**
 * JSON-LD du hub `/fr/equipe` : CollectionPage + ItemList + BreadcrumbList + FAQPage,
 * à passer ensemble à `<JsonLdGraph>`.
 *
 * Les personnes sont RÉFÉRENCÉES par `@id`, jamais redéfinies : le nœud `Person` de
 * Williams vit dans `williams-person.ts` (sur sa propre page), et le redécrire ici
 * ferait deux descriptions concurrentes de la même entité.
 */

import { SITE_URL, buildBreadcrumbJsonLd, buildFaqJsonLd } from "@/lib/seo";
import { FOUNDER_PERSON_ID } from "@/lib/brand";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";
import {
  HUB_DATE_MAJ,
  HUB_FAQ,
  HUB_META_DESCRIPTION,
  HUB_REPONSE,
  HUB_TITRE,
} from "@/content/equipe/hub";

export const HUB_URL = `${SITE_URL}/fr/equipe`;

/** `@id` du nœud Person d'une fiche indexable (Williams : l'identifiant canonique inchangé). */
export function idPersonneHub(slug: string, estDirigeantPrincipal: boolean): string {
  return estDirigeantPrincipal ? FOUNDER_PERSON_ID : `${SITE_URL}/fr/equipe/${slug}#person`;
}

export function buildEquipeHubJsonLd(
  indexables: ReadonlyArray<{ slug: string; estDirigeantPrincipal: boolean }>,
): Array<Record<string, unknown>> {
  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${HUB_URL}#collection`,
    url: HUB_URL,
    name: HUB_TITRE,
    description: HUB_META_DESCRIPTION,
    abstract: HUB_REPONSE,
    inLanguage: "fr",
    dateModified: `${HUB_DATE_MAJ}T00:00:00.000Z`,
    isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
    about: { "@id": `${SITE_URL}/#organization` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    breadcrumb: { "@id": `${HUB_URL}#breadcrumb` },
    mainEntity: { "@id": `${HUB_URL}#liste` },
    speakable: buildSpeakableSpecification({ selectors: ["[data-hub-reponse]"] }),
  };

  const liste = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${HUB_URL}#liste`,
    name: HUB_TITRE,
    numberOfItems: indexables.length,
    itemListElement: indexables.map((f, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: { "@id": idPersonneHub(f.slug, f.estDirigeantPrincipal) },
    })),
  };

  const fil = buildBreadcrumbJsonLd({
    locale: "fr",
    items: [
      { name: "Accueil", href: "/" },
      { name: "Équipe", href: "/equipe" },
    ],
  }) as unknown as Record<string, unknown>;

  const faq = buildFaqJsonLd({
    items: HUB_FAQ.map(({ question, answer }) => ({ question, answer })),
    authorId: FOUNDER_PERSON_ID,
    dateModified: `${HUB_DATE_MAJ}T00:00:00.000Z`,
  }) as unknown as Record<string, unknown>;

  return [collection, liste, fil, faq];
}
