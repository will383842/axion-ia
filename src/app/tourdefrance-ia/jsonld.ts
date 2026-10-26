// Tour de France IA — données structurées de la landing (2026-10-25 ; nœud du
// Tour passé de `EventSeries` à `Service` le 2026-10-26, décision de Will).
//
// Un seul `@graph` : WebPage, Service, FAQPage, BreadcrumbList.
//
// 🔑 Le Tour n'est PAS un événement : c'est une offre faite AUX ENTREPRISES
// (audit offert + formation de 4 h offerte, de la TPE à l'ETI). Il garde son nom
// et l'idée d'un tour qui va de ville en ville, mais il est décrit comme un
// `Service` : aucune propriété d'`Event` (ni `startDate`, ni `location`, ni
// `eventAttendanceMode`, ni `subEvent`, ni `performer`). La gratuité se dit par
// une `Offer` à 0 €, comme le texte visible (« offerts aux entreprises de l'étape »).
//
// Aucun nœud `Organization` ni `Person` n'est RECRÉÉ ici : le prestataire est
// cité par son `@id` canonique (`SITE_URL/#organization`), décrit une fois pour
// toutes sur le site, avec en plus `name` et `url` (la page n'émet pas le nœud
// qu'il référence). Pas de `HowTo`, pas de `speakable`.

import { BRAND } from "@/lib/brand";
import { SITE_URL } from "@/lib/site-url";

import { DEFINITION, FAQ, META, NOM_DU_TOUR } from "./contenu";

/**
 * La description du `Service` : le nom de tour de France, puis la définition
 * VISIBLE de la page (`DEFINITION`), précédée de la seule phrase de nom du
 * tour — aucune promesse que la page ne fait pas.
 */
export const DESCRIPTION_DU_SERVICE = `Le tour de France de l’IA d’Axion-IA, d’une ville à l’autre. ${DEFINITION}`;

export function jsonLdDuTour(): Record<string, unknown> {
  const url = `${SITE_URL}${META.chemin}`;
  const organisation = {
    "@id": `${SITE_URL}/#organization`,
    name: BRAND.name,
    url: SITE_URL,
  };
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: META.titre,
        description: META.description,
        inLanguage: "fr-FR",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        publisher: organisation,
        about: { "@id": `${url}#tour` },
        primaryImageOfPage: `${SITE_URL}${META.image}`,
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "Service",
        "@id": `${url}#tour`,
        name: NOM_DU_TOUR,
        serviceType: "Audit et formation en intelligence artificielle pour les entreprises",
        description: DESCRIPTION_DU_SERVICE,
        url,
        provider: organisation,
        areaServed: { "@type": "Country", name: "France" },
        audience: { "@type": "BusinessAudience", name: "Entreprises, de la TPE à l’ETI" },
        // Dit comme le texte visible : offerts aux entreprises de l’étape.
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
          description:
            "Audit et formation de 4 h offerts aux entreprises de l’étape, 5 places par ville",
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: FAQ.questions.map((q) => ({
          "@type": "Question",
          name: q.question,
          acceptedAnswer: { "@type": "Answer", text: q.reponse },
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Axion-IA", item: `${SITE_URL}/fr` },
          { "@type": "ListItem", position: 2, name: NOM_DU_TOUR, item: url },
        ],
      },
    ],
  };
}
