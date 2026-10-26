// Tour de France IA — données structurées de la landing (2026-10-25).
//
// Un seul `@graph` : WebPage, EventSeries, FAQPage, BreadcrumbList.
//
// 🔑 Aucun nœud `Organization` ni `Person` n'est RECRÉÉ ici : l'organisateur et
// l'intervenant sont cités par leur `@id` canonique (`SITE_URL/#organization`,
// `FOUNDER_PERSON_ID`), décrits une fois pour toutes sur le site. Pas de `Event`
// daté (aucune date n'est fixée), pas de `HowTo`, pas de `speakable`.

import { FOUNDER_PERSON_ID } from "@/lib/brand";
import { SITE_URL } from "@/lib/site-url";

import { DEFINITION, FAQ, META, NOM_DU_TOUR } from "./contenu";

export function jsonLdDuTour(): Record<string, unknown> {
  const url = `${SITE_URL}${META.chemin}`;
  const organisation = { "@id": `${SITE_URL}/#organization` };
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
        "@type": "EventSeries",
        "@id": `${url}#tour`,
        name: NOM_DU_TOUR,
        description: DEFINITION,
        url,
        inLanguage: "fr-FR",
        organizer: organisation,
        performer: { "@id": FOUNDER_PERSON_ID },
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        // Dit comme le texte visible : gratuit pour les entreprises de l’étape.
        isAccessibleForFree: true,
        location: { "@type": "Country", name: "France" },
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
