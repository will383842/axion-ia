// Cartographie de l'entreprise : données structurées en une fonction pure (testable).
// Trois nœuds : Service (sans prix : le montant public reste celui de la Journée IA), WebPage, FAQPage
// (les questions VISIBLES, mot pour mot). Le BreadcrumbList est émis par `Breadcrumbs`.
// `Organization` et `WebSite` restent au layout.

import { remplacerJetons } from "@/content/journee-ia-commun";
import { FOUNDER_PERSON_ID } from "@/lib/brand";
import {
  SITE_EDITORIAL_DATE,
  SITE_URL,
  buildFaqJsonLd,
  buildServiceJsonLd,
  buildWebPageJsonLd,
} from "@/lib/seo";

import {
  DATE_MISE_A_JOUR_CARTOGRAPHIE,
  DEFINITION,
  DESCRIPTION_META,
  FAQ,
  PATH,
  TITRE,
} from "./contenu";

export const CARTOGRAPHIE_SERVICE_ID = `${SITE_URL}/fr${PATH}#service`;
export const CARTOGRAPHIE_WEBPAGE_ID = `${SITE_URL}/fr${PATH}#webpage`;
const ORGANIZATION_ID = `${SITE_URL}/#organization`;

export function jsonLdCartographie() {
  const service = buildServiceJsonLd({
    locale: "fr",
    path: PATH,
    id: CARTOGRAPHIE_SERVICE_ID,
    name: "Cartographie de l’entreprise",
    description: DEFINITION,
    serviceType: "Cartographie de l’entreprise pour l’IA",
    category: "Formation et conseil en intelligence artificielle",
    dateModified: DATE_MISE_A_JOUR_CARTOGRAPHIE,
    areasServed: [{ type: "Country", name: "France" }],
    availableChannels: [{ name: "Dans les locaux du client, partout en France" }],
    providerId: ORGANIZATION_ID,
    audience: { audienceType: "PME et TPE", minEmployees: 2, maxEmployees: 250 },
    mainEntityOfPageId: CARTOGRAPHIE_WEBPAGE_ID,
  });

  const webPage = buildWebPageJsonLd({
    locale: "fr",
    path: PATH,
    name: TITRE,
    description: DESCRIPTION_META,
    id: CARTOGRAPHIE_WEBPAGE_ID,
    datePublished: SITE_EDITORIAL_DATE,
    dateModified: DATE_MISE_A_JOUR_CARTOGRAPHIE,
    about: { "@id": CARTOGRAPHIE_SERVICE_ID },
    breadcrumb: { "@id": `${SITE_URL}/fr${PATH}#breadcrumb` },
    speakable: { selectors: ["#hero-heading", "[data-definition]"] },
  });

  const faqBase = buildFaqJsonLd({
    items: FAQ.map((f) => ({ question: f.question, answer: remplacerJetons(f.reponse) })),
    authorId: FOUNDER_PERSON_ID,
    speakable: false,
    dateModified: DATE_MISE_A_JOUR_CARTOGRAPHIE,
  });
  const faq = {
    ...faqBase,
    "@id": `${SITE_URL}/fr${PATH}#faq`,
    isPartOf: { "@id": CARTOGRAPHIE_WEBPAGE_ID },
  };

  return [service, webPage, faq] as const;
}
