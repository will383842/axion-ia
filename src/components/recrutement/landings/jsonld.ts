// Données structurées communes aux landings apporteurs : tout passe par les builders de
// `src/lib/seo.ts` (WebPage, FAQPage), jamais de JSON-LD écrit à la main dans une page.
//
// ⛔ Jamais de JobPosting, de rémunération balisée, d'AggregateRating ni de Review (décision B5 du
// 2026-09-19 ; gardes `jur-copy-indicative` et `plus-d-offre-d-emploi-google-pour-les-apporteurs`).
import { COMMERCIAL_OFFER_DATE_POSTED } from "@/content/recrutement/dates";
import { FOUNDER_PERSON_ID } from "@/lib/brand";
import type { Locale } from "@/i18n/routing";
import { buildFaqJsonLd, buildWebPageJsonLd } from "@/lib/seo";
import { SITE_URL } from "@/lib/site-url";
import type { QuestionReponse } from "./chiffres";

/** Date de la dernière mise à jour du contenu des landings (jamais `BUILD_DATE`). */
export const DATE_MISE_A_JOUR_APPORTEURS = COMMERCIAL_OFFER_DATE_POSTED.slice(0, 10);

/**
 * Le nœud Service de la Journée IA, partagé avec `/fr/journee-ia`.
 * À remplacer par `JOURNEE_IA_SERVICE_ID` (`lib/seo/journee-ia-service.ts`) une fois la PR des
 * fondations SEO fusionnée : la valeur est la même.
 */
const JOURNEE_IA_SERVICE_ID = `${SITE_URL}/fr/journee-ia#service`;

export function webPageApporteurs(input: {
  locale: Locale;
  path: string;
  name: string;
  description: string;
  /** Sélecteurs lus à voix haute. */
  speakable: readonly string[];
  /** Vrai si la page porte un fil d'Ariane (le composant `Breadcrumbs` émet le BreadcrumbList). */
  ariane?: boolean;
}) {
  return buildWebPageJsonLd({
    locale: input.locale,
    path: input.path,
    name: input.name,
    description: input.description,
    datePublished: "2026-06-08",
    dateModified: DATE_MISE_A_JOUR_APPORTEURS,
    about: { "@id": JOURNEE_IA_SERVICE_ID },
    mentions: { "@id": `${SITE_URL}/#organization` },
    ...(input.ariane
      ? { breadcrumb: { "@id": `${SITE_URL}/${input.locale}${input.path}#breadcrumb` } }
      : {}),
    speakable: { selectors: [...input.speakable] },
  });
}

/** FAQPage signée par Williams (jamais par la persona IA) ; le même texte que la liste visible. */
export function faqApporteurs(items: readonly QuestionReponse[]) {
  return buildFaqJsonLd({
    items: items.map((f) => ({ question: f.question, answer: f.reponse })),
    authorId: FOUNDER_PERSON_ID,
    dateModified: DATE_MISE_A_JOUR_APPORTEURS,
    speakable: false,
  });
}
