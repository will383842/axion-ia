// La Journée IA — données structurées de la landing, en une fonction pure (testable).
//
// Trois nœuds : le Service (le même octet pour octet que sur l'accueil, construit une seule fois
// dans `@/lib/seo/journee-ia-service`), la WebPage, et la FAQPage (les 13 questions VISIBLES,
// mot pour mot). Le BreadcrumbList est émis par `Breadcrumbs`.
//
// Aucun nœud `Organization`, `WebSite` ni `Person` n'est émis ici : ils restent au layout
// (`src/app/[locale]/layout.tsx`). `FOUNDER_PERSON_ID` est résolu par `Organization.founder`.

import { DATE_MISE_A_JOUR_JOURNEE_IA, remplacerJetons } from "@/content/journee-ia-commun";
import { FOUNDER_PERSON_ID } from "@/lib/brand";
import { OG_IMAGE_HAUTEUR, OG_IMAGE_LARGEUR } from "@/lib/og-format";
import {
  SITE_EDITORIAL_DATE,
  SITE_URL,
  buildFaqJsonLd,
  buildWebPageJsonLd,
  urlOgParDefaut,
} from "@/lib/seo";
import {
  JOURNEE_IA_SERVICE_ID,
  JOURNEE_IA_WEBPAGE_ID,
  buildJourneeIaServiceJsonLd,
} from "@/lib/seo/journee-ia-service";

import { CONTENU, DESCRIPTION_META, TITRE } from "./contenu";

const PATH = "/journee-ia";

/** Les trois nœuds, dans l'ordre : Service, WebPage, FAQPage. */
export function jsonLdJourneeIa() {
  const service = buildJourneeIaServiceJsonLd();

  const webPage = buildWebPageJsonLd({
    locale: "fr",
    path: PATH,
    name: TITRE,
    description: remplacerJetons(DESCRIPTION_META),
    datePublished: SITE_EDITORIAL_DATE,
    dateModified: DATE_MISE_A_JOUR_JOURNEE_IA,
    about: { "@id": JOURNEE_IA_SERVICE_ID },
    // Le BreadcrumbList est émis par `Breadcrumbs` (id : URL de la feuille + `#breadcrumb`).
    breadcrumb: { "@id": `${SITE_URL}/fr/journee-ia#breadcrumb` },
    speakable: { selectors: ["#hero-heading", "[data-en-bref]"] },
    extra: {
      primaryImageOfPage: {
        "@type": "ImageObject",
        "@id": `${SITE_URL}/fr/journee-ia#primaryimage`,
        url: urlOgParDefaut({ title: TITRE }),
        width: OG_IMAGE_LARGEUR,
        height: OG_IMAGE_HAUTEUR,
      },
    },
  });

  const faqBase = buildFaqJsonLd({
    items: CONTENU.faq.map((f) => ({
      question: f.question,
      answer: remplacerJetons(f.reponse),
    })),
    authorId: FOUNDER_PERSON_ID,
    speakable: false,
    dateModified: DATE_MISE_A_JOUR_JOURNEE_IA,
  });

  // La FAQ est une page-partie de la landing : elle porte son `@id` et se rattache à la WebPage.
  const faq = {
    ...faqBase,
    "@id": `${SITE_URL}/fr/journee-ia#faq`,
    isPartOf: { "@id": JOURNEE_IA_WEBPAGE_ID },
  };

  return [service, webPage, faq] as const;
}
