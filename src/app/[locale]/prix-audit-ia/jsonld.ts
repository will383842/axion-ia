// « Combien coûte un audit IA » : données structurées en une fonction pure (testable).
// Trois nœuds : Service (celui de la Journée IA, construit à un seul endroit : prix lu dans
// `JOURNEE_IA_TIER`, TVA en sus, `provider` = `#organization`), WebPage, FAQPage (les questions
// VISIBLES, mot pour mot). Le BreadcrumbList est émis par `Breadcrumbs`.
// `Organization` et `WebSite` restent au layout.

import { remplacerJetons } from "@/content/journee-ia-commun";
import { FOUNDER_PERSON_ID } from "@/lib/brand";
import { SITE_EDITORIAL_DATE, SITE_URL, buildFaqJsonLd, buildWebPageJsonLd } from "@/lib/seo";
import { JOURNEE_IA_SERVICE_ID, buildJourneeIaServiceJsonLd } from "@/lib/seo/journee-ia-service";

import { DATE_MISE_A_JOUR_PRIX_AUDIT_IA, DESCRIPTION_META, FAQ, PATH, TITRE } from "./contenu";

export const PRIX_AUDIT_IA_WEBPAGE_ID = `${SITE_URL}/fr${PATH}#webpage`;

export function jsonLdPrixAuditIa() {
  const service = buildJourneeIaServiceJsonLd();

  const webPage = buildWebPageJsonLd({
    locale: "fr",
    path: PATH,
    name: TITRE,
    description: remplacerJetons(DESCRIPTION_META),
    id: PRIX_AUDIT_IA_WEBPAGE_ID,
    datePublished: SITE_EDITORIAL_DATE,
    dateModified: DATE_MISE_A_JOUR_PRIX_AUDIT_IA,
    about: { "@id": JOURNEE_IA_SERVICE_ID },
    breadcrumb: { "@id": `${SITE_URL}/fr${PATH}#breadcrumb` },
    speakable: { selectors: ["#hero-heading", "[data-reponse-directe]"] },
  });

  const faqBase = buildFaqJsonLd({
    items: FAQ.map((f) => ({ question: f.question, answer: remplacerJetons(f.reponse) })),
    authorId: FOUNDER_PERSON_ID,
    speakable: false,
    dateModified: DATE_MISE_A_JOUR_PRIX_AUDIT_IA,
  });
  const faq = {
    ...faqBase,
    "@id": `${SITE_URL}/fr${PATH}#faq`,
    isPartOf: { "@id": PRIX_AUDIT_IA_WEBPAGE_ID },
  };

  return [service, webPage, faq] as const;
}
