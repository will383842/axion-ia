/**
 * Entité Person « Williams Jullin » — fondateur d'Axion-IA (refonte 2026-06-22).
 *
 * Williams est une VRAIE personne (fondateur), pas une persona IA comme Manon.
 * Sa fiche `/equipe/williams` est servie depuis cette définition STATIQUE (et
 * non depuis `AuthorProfile` en DB) pour ne dépendre d'aucun seed : la page +
 * l'entité Person fonctionnent dès le déploiement.
 *
 * Sert :
 *  - la page publique `/equipe/williams` (autorité d'entité E-E-A-T) ;
 *  - le nœud Person JSON-LD (résout l'@id de l'avis d'expert quand l'expert
 *    interne choisi est Williams, cf. `expert-bank.ts` + `ArticleExpertQuote`).
 *
 * Bio STRICTEMENT factuelle (rôle fondateur + description de la société + lien
 * LinkedIn réel) — aucune donnée personnelle inventée. Will pourra l'enrichir.
 */

import { SITE_URL } from "@/lib/seo";
import { FOUNDER, FOUNDER_PERSON_ID, founderUrl } from "@/lib/brand";

// Audit E-E-A-T 2026-06-22 (P1) — identité (nom, fonction, LinkedIn, knowsAbout)
// dérivée du SSOT `FOUNDER` (lib/brand.ts). Seules la bio longue + la photo
// restent propres à cette page d'autorité d'entité.
export const WILLIAMS_LINKEDIN = FOUNDER.linkedin;
const WILLIAMS_PHOTO = "/illustrations/home-founder-william.avif";

const WILLIAMS_BIO_MD = `**${FOUNDER.fullName}** est le fondateur et CEO d'Axion-IA, cabinet de conseil en intelligence artificielle pour les TPE, PME et ETI françaises.

Axion-IA accompagne les entreprises sur l'audit IA, la formation, l'implémentation de solutions IA opérationnelles et la conduite du changement, avec une approche centrée sur des résultats concrets et mesurables.

Profil LinkedIn : ${WILLIAMS_LINKEDIN}`;

const WILLIAMS_KNOWS_ABOUT = [...FOUNDER.knowsAbout];

/**
 * Profil statique exposé à la page `/equipe/[slug]` (mêmes champs que ceux lus
 * sur un `AuthorProfile`). isPersona/aiGenerated = false (personne réelle).
 */
export const WILLIAMS_PROFILE = {
  slug: FOUNDER.slug,
  displayName: FOUNDER.fullName,
  jobTitle: FOUNDER.jobTitleFr,
  bioMd: WILLIAMS_BIO_MD,
  photoUrl80: WILLIAMS_PHOTO,
  photoUrl256: WILLIAMS_PHOTO,
  photoUrl1024: WILLIAMS_PHOTO,
  photoAlt: `${FOUNDER.fullName} — ${FOUNDER.jobTitleFr}`,
  knowsAbout: WILLIAMS_KNOWS_ABOUT,
  isPersona: false,
  aiGenerated: false,
  personaDisclaimer: null as string | null,
  isActive: true,
} as const;

/**
 * Nœud Person JSON-LD de Williams (sameAs LinkedIn, worksFor Organization).
 *
 * ⚠️ Le paramètre `locale` NE change plus l'`@id` ni l'`url`, et c'est une correction, pas
 * une régression. La fiche `/equipe/[slug]` 404 hors FR (`page.tsx` → `notFound()`) : un
 * appel en `en` fabriquait donc un `@id` `…/en/equipe/williams#person` qui ne désignait
 * aucune page servie — une seconde entité pour la même personne, née d'un argument. L'`@id`
 * canonique vit dans `FOUNDER_PERSON_ID` et ne dépend de rien.
 */
export function buildPersonWilliamsJsonLd(_locale: string = "fr"): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": FOUNDER_PERSON_ID,
    name: FOUNDER.fullName,
    jobTitle: FOUNDER.jobTitleFr,
    url: founderUrl(),
    image: `${SITE_URL}${WILLIAMS_PHOTO}`,
    sameAs: [WILLIAMS_LINKEDIN],
    worksFor: { "@id": `${SITE_URL}/#organization` },
    knowsAbout: WILLIAMS_KNOWS_ABOUT,
  };
}
