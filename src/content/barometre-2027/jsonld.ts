import type { Locale } from "@/i18n/routing";
import { buildArticleJsonLd } from "@/lib/seo";
import { SITE_URL } from "@/lib/site-url";
import {
  BAROMETRE_DATE_MODIFICATION,
  BAROMETRE_DATE_PUBLICATION,
  BAROMETRE_DESCRIPTION,
  BAROMETRE_PATH,
  BAROMETRE_TITRE,
  SOURCES,
  VARIABLES_MESUREES,
} from "./donnees";

/** JSON-LD Article + Dataset du baromètre, entièrement dérivés de `donnees.ts`. */
export function buildBarometreJsonLd(locale: Locale) {
  const url = `${SITE_URL}/${locale}${BAROMETRE_PATH}`;
  const article = buildArticleJsonLd({
    locale: "fr",
    path: BAROMETRE_PATH,
    headline: BAROMETRE_TITRE,
    description: BAROMETRE_DESCRIPTION,
    datePublished: BAROMETRE_DATE_PUBLICATION,
    dateModified: BAROMETRE_DATE_MODIFICATION,
    articleSection: "Baromètre",
    keywords: ["baromètre IA", "TPE", "PME", "adoption de l'IA", "France Num", "Eurostat"],
    citations: SOURCES.map((s) => ({ name: s.nom, url: s.url })),
  });
  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${url}#dataset`,
    name: BAROMETRE_TITRE,
    description: BAROMETRE_DESCRIPTION,
    url,
    inLanguage: "fr-FR",
    datePublished: BAROMETRE_DATE_PUBLICATION,
    dateModified: BAROMETRE_DATE_MODIFICATION,
    spatialCoverage: "France",
    creator: { "@type": "Organization", name: "Axion-IA", url: SITE_URL },
    publisher: { "@type": "Organization", name: "Axion-IA", url: SITE_URL },
    isBasedOn: SOURCES.map((s) => ({ "@type": "Dataset", name: s.nom, url: s.url })),
    citation: SOURCES.map((s) => ({ "@type": "CreativeWork", name: s.nom, url: s.url })),
    variableMeasured: VARIABLES_MESUREES.map((v) => ({
      "@type": "PropertyValue",
      name: v.nom,
      value: v.valeur,
      description: `${v.perimetre}, ${v.periode}`,
    })),
  };
  return { article, dataset };
}
