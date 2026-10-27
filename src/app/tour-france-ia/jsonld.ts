// Tour France IA — données structurées de la landing (2026-10-25 ; nœud du
// Tour passé de `EventSeries` à `Service` : décision du 2026-10-26).
//
// Un seul `@graph` : WebPage, Service, FAQPage, BreadcrumbList.
//
// 🔑 Le Tour n'est PAS un événement : c'est une offre faite AUX ENTREPRISES — une
// journée offerte chez elles (audit + formation d'équipe de 4 h, en intra-entreprise
// et en présentiel, de la TPE à l'ETI), aux 5 entreprises retenues par ville, en
// échange d'un podcast (modèle du 2026-10-27). Il garde son nom et l'idée d'un tour qui va
// de ville en ville, mais il est décrit comme un `Service` : aucune propriété
// d'`Event` (ni `startDate`, ni `location`, ni `eventAttendanceMode`, ni `subEvent`,
// ni `performer`). La gratuité se dit par une `Offer` à 0 €, réservée aux entreprises
// en France, SANS `availability` ni date : aucune date n'est fixée avant qu'une ville
// s'ouvre. Sa description est la ligne de conditions VISIBLE (sélection, podcast,
// seuil de la ville). Le dîner du vendredi soir n'est jamais dans l'`Offer`. La
// `FAQPage` reprend les six questions de la page, mot pour mot.
//
// Aucun nœud `Organization` ni `Person` n'est RECRÉÉ ici : le prestataire est
// cité par son `@id` canonique (`SITE_URL/#organization`), décrit une fois pour
// toutes sur le site, avec en plus `name` et `url` (la page n'émet pas le nœud
// qu'il référence). Pas de `HowTo`, pas de `speakable`.

import { BRAND } from "@/lib/brand";
import { SITE_URL } from "@/lib/site-url";

import { CONDITIONS, DEFINITION, FAQ, META, NOM_DU_TOUR, PROMESSE } from "./contenu";

/**
 * La description du `Service` : le nom du Tour, puis la définition
 * VISIBLE de la page (`DEFINITION`), précédée de la seule phrase de nom du
 * tour — aucune promesse que la page ne fait pas.
 */
export const DESCRIPTION_DU_SERVICE = `Le Tour France IA d’Axion-IA, d’une ville à l’autre. ${DEFINITION}`;

/** L'offre : la promesse et les conditions VISIBLES (retenues, podcast, 5 demandes), mot pour mot. */
export const DESCRIPTION_DE_L_OFFRE = `${PROMESSE} En intra-entreprise et en présentiel. ${CONDITIONS}`;

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
        // Dit comme le texte visible : la journée offerte, sa sélection et sa contrepartie.
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
          eligibleRegion: { "@type": "Country", name: "France" },
          eligibleCustomerType: "http://purl.org/goodrelations/v1#Business",
          description: DESCRIPTION_DE_L_OFFRE,
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
