// Les nœuds JSON-LD de l'accueil `/fr`, construits à UN seul endroit (fonction pure,
// donc testable sans rendre la page).
//
// L'accueil émet quatre nœuds : la page (WebPage), La Journée IA (Service, le MÊME
// objet que sur la landing), les six questions de la FAQ (FAQPage) et le graphe des
// images rendues. `Organization`, `WebSite` et `Person` restent émis par le layout
// (`src/app/[locale]/layout.tsx`) : les nœuds ci-dessous les référencent par `@id`.
//
// Retirés avec la refonte : l'agrégat d'avis (avis sur soi-même), le
// `ProfessionalService` sans adresse, les cinq `Service` sans prix, la FAQ
// « speakable » de douze questions et les `VideoObject`.

import { DATE_MISE_A_JOUR_JOURNEE_IA, remplacerJetons } from "@/content/journee-ia-commun";
import { FOUNDER_PERSON_ID } from "@/lib/brand";
import { OG_IMAGE_HAUTEUR, OG_IMAGE_LARGEUR } from "@/lib/og-format";
import {
  SITE_EDITORIAL_DATE,
  SITE_URL,
  buildFaqJsonLd,
  buildPageImageGraphJsonLd,
  buildWebPageJsonLd,
  urlOgParDefaut,
} from "@/lib/seo";
import { JOURNEE_IA_SERVICE_ID, buildJourneeIaServiceJsonLd } from "@/lib/seo/journee-ia-service";

import { CONTENU, DESCRIPTION_META, OG_EYEBROW, TITRE } from "./contenu";

/** Les six questions affichées, jetons résolus : c'est aussi ce que lit le FAQPage. */
export function questionsAccueil() {
  return CONTENU.faq.questions.map((q) => ({
    id: q.id,
    question: q.question,
    answer: remplacerJetons(q.reponse),
  }));
}

export function jsonLdAccueil() {
  const webPage = buildWebPageJsonLd({
    locale: "fr",
    path: "/",
    name: TITRE,
    description: remplacerJetons(DESCRIPTION_META),
    datePublished: SITE_EDITORIAL_DATE,
    dateModified: DATE_MISE_A_JOUR_JOURNEE_IA,
    about: { "@id": `${SITE_URL}/#organization` },
    mentions: [{ "@id": JOURNEE_IA_SERVICE_ID }],
    speakable: { selectors: ["#hero-heading", "[data-en-bref]"] },
    extra: {
      primaryImageOfPage: {
        "@type": "ImageObject",
        "@id": `${SITE_URL}/fr#primaryimage`,
        url: urlOgParDefaut({ title: TITRE, eyebrow: OG_EYEBROW }),
        width: OG_IMAGE_LARGEUR,
        height: OG_IMAGE_HAUTEUR,
      },
    },
  });

  const service = buildJourneeIaServiceJsonLd();

  const faq = buildFaqJsonLd({
    items: questionsAccueil().map(({ question, answer }) => ({ question, answer })),
    authorId: FOUNDER_PERSON_ID,
    speakable: false,
    dateModified: DATE_MISE_A_JOUR_JOURNEE_IA,
  });

  const images = buildPageImageGraphJsonLd({ locale: "fr", path: "/" });

  return images ? [webPage, service, faq, images] : [webPage, service, faq];
}
