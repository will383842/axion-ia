// Données structurées des pages d'offre de la suite : Service (sans prix), WebPage, FAQPage
// (questions VISIBLES, mot pour mot). Pas de Review ni d'AggregateRating. Le BreadcrumbList est
// émis par `Breadcrumbs`.

import { FOUNDER_PERSON_ID } from "@/lib/brand";
import { DATE_MISE_A_JOUR_OFFRES_SUITE } from "@/content/offres-suite";
import {
  SITE_EDITORIAL_DATE,
  SITE_URL,
  buildFaqJsonLd,
  buildServiceJsonLd,
  buildWebPageJsonLd,
} from "@/lib/seo";

import type { PageOffreSuite } from "./contenu";

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

export function jsonLdOffreSuite(p: PageOffreSuite) {
  const serviceId = `${SITE_URL}/fr${p.path}#service`;
  const webPageId = `${SITE_URL}/fr${p.path}#webpage`;

  const service = buildServiceJsonLd({
    locale: "fr",
    path: p.path,
    id: serviceId,
    name: p.nom,
    description: p.definition,
    serviceType: p.nom,
    category: "Formation et conseil en intelligence artificielle",
    dateModified: DATE_MISE_A_JOUR_OFFRES_SUITE,
    areasServed: [{ type: "Country", name: "France" }],
    availableChannels: [{ name: "Dans les locaux du client, partout en France" }],
    providerId: ORGANIZATION_ID,
    audience: { audienceType: "PME et TPE", minEmployees: 5, maxEmployees: 249 },
    mainEntityOfPageId: webPageId,
  });

  const webPage = buildWebPageJsonLd({
    locale: "fr",
    path: p.path,
    name: p.titre,
    description: p.descriptionMeta,
    id: webPageId,
    datePublished: SITE_EDITORIAL_DATE,
    dateModified: DATE_MISE_A_JOUR_OFFRES_SUITE,
    about: { "@id": serviceId },
    breadcrumb: { "@id": `${SITE_URL}/fr${p.path}#breadcrumb` },
    speakable: { selectors: ["#hero-heading", "[data-definition]"] },
  });

  const faqBase = buildFaqJsonLd({
    items: p.faq.map((f) => ({ question: f.question, answer: f.reponse })),
    authorId: FOUNDER_PERSON_ID,
    speakable: false,
    dateModified: DATE_MISE_A_JOUR_OFFRES_SUITE,
  });
  const faq = {
    ...faqBase,
    "@id": `${SITE_URL}/fr${p.path}#faq`,
    isPartOf: { "@id": webPageId },
  };

  return [service, webPage, faq] as const;
}
