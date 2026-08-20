/**
 * Entité Person « Williams Jullin » — fondateur d'Axion-IA (refonte 2026-06-22,
 * enrichissement d'entité 2026-08-19).
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
 * Bio STRICTEMENT factuelle. Aucune donnée personnelle inventée : ni diplôme,
 * ni date de naissance, ni employeur antérieur, ni numéro de registre — un
 * `Person` enrichi de faits invérifiables est un `Person` que Google ne
 * rapproche d'aucune source et que les moteurs génératifs citent de travers.
 * Tout ce qui est déclaré ici est déjà public ailleurs sur le site (offre,
 * siège, zone d'intervention, LinkedIn) ou dérive du SSOT `FOUNDER`.
 */

import { SITE_URL } from "@/lib/seo";
import { BRAND, FOUNDER, FOUNDER_PERSON_ID, founderUrl } from "@/lib/brand";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";
import {
  WILLIAMS_LEAD,
  WILLIAMS_DOCTRINE,
  WILLIAMS_TAGLINE,
  WILLIAMS_REVISION_DATE,
} from "@/content/equipe/williams";

// Audit E-E-A-T 2026-06-22 (P1) — identité (nom, fonction, LinkedIn, knowsAbout)
// dérivée du SSOT `FOUNDER` (lib/brand.ts). Seules la bio longue + la photo
// restent propres à cette page d'autorité d'entité.
export const WILLIAMS_LINKEDIN = FOUNDER.linkedin;

/**
 * Portrait canonique. Dimensions MESURÉES (2048 × 2048, `sharp`, 2026-08-19) —
 * la doctrine OG du dépôt interdit de déclarer une taille qu'on n'a pas
 * mesurée, et un `ImageObject` sans dimensions vaut mieux qu'un `ImageObject`
 * qui en invente. Même fichier que la home et que `Organization.founder` :
 * une entité, une photo, un `contentUrl`.
 */
const WILLIAMS_PHOTO = "/illustrations/home-founder-william.avif";
const WILLIAMS_PHOTO_LARGEUR = 2048;
const WILLIAMS_PHOTO_HAUTEUR = 2048;

/**
 * Bio Markdown — conservée pour compatibilité avec la forme `AuthorProfile`
 * (le rendu de la fiche ne l'utilise plus : la page a son propre gabarit
 * éditorial). Elle reste la bio « courte » réutilisable ailleurs.
 */
const WILLIAMS_BIO_MD = `**${FOUNDER.fullName}** est le fondateur et CEO d'Axion-IA, agence d'intelligence artificielle opérationnelle dont le siège est à Grenoble et qui intervient dans toute la France.

Axion-IA accompagne les TPE, PME, ETI et grands comptes sur l'audit IA, la formation, le coaching individuel de dirigeants, l'implémentation de solutions IA sur mesure et l'automatisation des processus, avec une exigence constante de résultats concrets et mesurés.

Profil LinkedIn : ${WILLIAMS_LINKEDIN}`;

/**
 * `knowsAbout` étendu — le SSOT `FOUNDER.knowsAbout` porte les cinq domaines
 * « métier » (ceux qu'on affiche) ; le JSON-LD y ajoute les entités techniques
 * que les moteurs rapprochent d'un concept connu (RAG, LLM, agents…). Les
 * deux listes sont volontairement distinctes : la première est de la copie
 * visible, la seconde est du vocabulaire d'indexation.
 */
const WILLIAMS_KNOWS_ABOUT = [
  ...FOUNDER.knowsAbout,
  "Intelligence artificielle générative en entreprise",
  "Automatisation des processus métier",
  "Retrieval-Augmented Generation (RAG)",
  "Modèles de langage de grande taille (LLM)",
  "Agents IA et assistants métier",
  "Intégration de l'IA aux CRM et ERP",
  "Formation professionnelle à l'intelligence artificielle",
  "Souveraineté des données et hébergement en Union européenne",
] as const;

/** Compétences déclarées sur l'`Occupation` (schema.org `skills`). */
const WILLIAMS_SKILLS = [
  "Audit IA d'entreprise",
  "Cadrage et priorisation de cas d'usage IA",
  "Implémentation IA sur mesure en code propriétaire",
  "Automatisation et intégration de processus",
  "Formation et coaching de dirigeants",
].join(", ");

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
  photoAlt: `${FOUNDER.fullName}, ${FOUNDER.jobTitleFr} — portrait`,
  knowsAbout: [...FOUNDER.knowsAbout],
  isPersona: false,
  aiGenerated: false,
  personaDisclaimer: null as string | null,
  isActive: true,
} as const;

/** URL absolue du portrait — partagée par le `Person` et le `ProfilePage`. */
export const WILLIAMS_PHOTO_URL = `${SITE_URL}${WILLIAMS_PHOTO}`;

/** `@id` du nœud image, pour que Person et ProfilePage citent LA même image. */
const WILLIAMS_IMAGE_ID = `${founderUrl()}#portrait`;

function buildWilliamsImageObject(): Record<string, unknown> {
  return {
    "@type": "ImageObject",
    "@id": WILLIAMS_IMAGE_ID,
    url: WILLIAMS_PHOTO_URL,
    contentUrl: WILLIAMS_PHOTO_URL,
    width: WILLIAMS_PHOTO_LARGEUR,
    height: WILLIAMS_PHOTO_HAUTEUR,
    caption: `${FOUNDER.fullName}, ${FOUNDER.jobTitleFr}`,
  };
}

/**
 * Nœud Person JSON-LD de Williams (sameAs LinkedIn, worksFor Organization).
 *
 * ⚠️ Le paramètre `locale` NE change plus l'`@id` ni l'`url`, et c'est une correction, pas
 * une régression. La fiche `/equipe/[slug]` 404 hors FR (`page.tsx` → `notFound()`) : un
 * appel en `en` fabriquait donc un `@id` `…/en/equipe/williams#person` qui ne désignait
 * aucune page servie — une seconde entité pour la même personne, née d'un argument. L'`@id`
 * canonique vit dans `FOUNDER_PERSON_ID` et ne dépend de rien.
 *
 * Enrichissement 2026-08-19 : `description`, `disambiguatingDescription`,
 * `givenName`/`familyName`, `image` typée `ImageObject`, `hasOccupation` et
 * `workLocation`. Chacune de ces propriétés répond à une question qu'un moteur
 * génératif pose sur une personne (qui · quoi · où · quel métier) ; sans elles
 * le nœud ne portait qu'un nom et une fonction, ce qu'un modèle ne peut pas
 * distinguer d'un homonyme.
 */
export function buildPersonWilliamsJsonLd(_locale: string = "fr"): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": FOUNDER_PERSON_ID,
    name: FOUNDER.fullName,
    givenName: "Williams",
    familyName: "Jullin",
    jobTitle: FOUNDER.jobTitleFr,
    description: WILLIAMS_LEAD,
    // Sert exactement à ce que son nom dit : séparer cette personne d'un
    // homonyme dans un index d'entités.
    disambiguatingDescription: `${FOUNDER.jobTitleFr} — ${WILLIAMS_TAGLINE}`,
    url: founderUrl(),
    mainEntityOfPage: { "@id": `${founderUrl()}#profilepage` },
    image: buildWilliamsImageObject(),
    sameAs: [WILLIAMS_LINKEDIN],
    // La flèche inverse (`Organization.founder` → cet `@id`) est posée par
    // `buildOrganizationJsonLd`. Les deux citent la même chaîne, jamais une
    // redescription : `FOUNDER_PERSON_ID`.
    worksFor: { "@id": `${SITE_URL}/#organization` },
    knowsAbout: WILLIAMS_KNOWS_ABOUT,
    knowsLanguage: ["fr", "en"],
    hasOccupation: {
      "@type": "Occupation",
      name: "Consultant et formateur en intelligence artificielle d'entreprise",
      occupationLocation: { "@type": "Country", name: "France" },
      skills: WILLIAMS_SKILLS,
    },
    workLocation: {
      "@type": "Place",
      name: `${BRAND.name} — Grenoble`,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Grenoble",
        addressRegion: "Auvergne-Rhône-Alpes",
        addressCountry: "FR",
      },
    },
  };
}

/**
 * `ProfilePage` — le type que Google attend sur une page consacrée à UNE
 * personne. Il dit au moteur « cette URL n'est pas un article qui parle de X,
 * c'est la page de X », ce qu'aucun `WebPage` générique ne dit. `mainEntity`
 * pointe l'`@id` canonique du Person plutôt que de le redécrire : deux
 * descriptions de la même personne dans le même document se concurrencent.
 */
export function buildProfilePageWilliamsJsonLd(): Record<string, unknown> {
  const url = founderUrl();
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${url}#profilepage`,
    url,
    inLanguage: "fr",
    name: `${FOUNDER.fullName} — ${FOUNDER.jobTitleFr}`,
    description: WILLIAMS_LEAD,
    abstract: WILLIAMS_DOCTRINE,
    dateModified: WILLIAMS_REVISION_DATE,
    isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
    about: { "@id": FOUNDER_PERSON_ID },
    mainEntity: { "@id": FOUNDER_PERSON_ID },
    primaryImageOfPage: { "@id": WILLIAMS_IMAGE_ID },
    breadcrumb: { "@id": `${url}#breadcrumb` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    speakable: buildSpeakableSpecification(),
  };
}
