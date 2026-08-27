// SSOT branding — Sprint cert 14.x (2026-05-08).
// Toute mention publique de la marque doit dériver d'ici, jamais hardcoder.
// Naming canonique acté Will 2026-05-08 : « Axion-IA » (avec tiret, IA majuscule)
// — aligné sur le repo + domaine `axion-ia.com` + ADR 0009 hosting.
//
// Si un jour la marque change (ex. ajout suffixe juridique, traduction tagline),
// patcher uniquement ce fichier. La doctrine SSOT « code = vérité » garantit
// que toutes les pages, JSON-LD, OG images, manifest dérivent de ces constantes.

import { env } from "@/env";

export const BRAND = {
  /** Nom canonique customer-facing (logo, header, JSON-LD `name`, OG, titles). */
  name: "Axion-IA",
  /**
   * Raison sociale juridique EXACTE, telle qu'immatriculée au RCS Grenoble le
   * 30/07/2026 : dénomination « AXION IA », **sans trait d'union**, forme SAS.
   * Kbis + avis de situation SIRENE concordent — décision Will 30/07/2026 :
   * « AXION IA SAS » sur les pièces légales, la marque commerciale (`name`)
   * garde son tiret.
   *
   * 🔴 NE PAS réaligner sur `name` : ce champ alimente le `legalName` JSON-LD,
   * qui est le champ que Google rapproche des registres (SIRENE / INPI) pour
   * fusionner l'entité. Un tiret ici ne matche AUCUN registre.
   */
  legalName: "AXION IA SAS",
  /** Noms alternatifs Knowledge Graph / Wikidata — disambiguation vs axionai.fr. */
  alternateName: ["AxionIA", "Axion IA", "axion-ia.com"] as const,
  /** Tagline courte FR — sous-titre, JSON-LD `description`, OG. */
  taglineFr: "cabinet IA opérationnel",
  /** Tagline courte EN. */
  taglineEn: "operational AI consultancy",
  /** Slogan long FR — hero principal, meta descriptions, pitch commercial. */
  sloganFr: "De l'idée à l'impact. Un seul partenaire IA.",
  /** Slogan long EN. */
  sloganEn: "From idea to impact. One AI partner.",
  /** URL canonique du site (déduite de env, jamais hardcodée). */
  url: env.NEXT_PUBLIC_SITE_URL,
  /**
   * Slug technique du package npm (sans tiret, sans IA majuscule).
   * Utilisé uniquement pour les imports techniques / lockfile / package.json.
   * NE PAS afficher côté UI.
   */
  packageSlug: "axionia",
} as const;

export type Brand = typeof BRAND;

/**
 * SSOT identité du fondateur (audit E-E-A-T 2026-06-22, P1).
 *
 * Avant : nom / jobTitle / LinkedIn / knowsAbout étaient dupliqués ET divergents
 * entre `lib/seo.ts` (`buildOrganizationJsonLd.founder` + `buildPersonJsonLd`),
 * `lib/seo/williams-person.ts` (entité Person + page `/equipe/williams`),
 * `FounderTrustSection` et `ImplementationFounderBand` :
 *   - nom : « Williams » vs « Williams Jullin »
 *   - fonction : « Fondateur · lead consultant IA » vs « Fondateur & CEO »
 *   - url : `/a-propos#will` vs `/equipe/williams`
 * Désormais une seule source ici. Tous les consommateurs en dérivent.
 *
 * RÈGLE D'AFFICHAGE (cf. doctrine nommage fondateur) :
 *   - `displayName` (« Williams ») = UI visible, partout.
 *   - `fullName` (« Williams Jullin ») = entité structurée (JSON-LD `Person.name`,
 *     `sameAs` LinkedIn) + page d'autorité d'entité `/equipe/williams`.
 *
 * La bio longue + le nœud Person JSON-LD restent dans `williams-person.ts`
 * (qui dérive son identité d'ici). Les copies visibles i18n
 * (`messages/*.json` → `home.founder*`) restent gérées en traduction.
 */
export const FOUNDER = {
  /** Nom complet canonique — entité Person (JSON-LD, /equipe/williams, sameAs). */
  fullName: "Williams Jullin",
  /** Prénom seul — TOUT affichage UI (cartes fondateur, captions). */
  displayName: "Williams",
  /** Slug de la page d'autorité d'entité (`/equipe/williams`). */
  slug: "williams",
  /** Fonction FR — jobTitle JSON-LD. */
  jobTitleFr: "Fondateur & CEO d'Axion-IA",
  /** Fonction EN. */
  jobTitleEn: "Founder & CEO of Axion-IA",
  /** Variante courte « · » pour les sous-titres de carte. */
  roleLineFr: "Fondateur & CEO · Axion-IA",
  roleLineEn: "Founder & CEO · Axion-IA",
  /** Profil LinkedIn réel — `sameAs` (vérification d'entité, pas de link juice). */
  linkedin: "https://www.linkedin.com/in/williamsjullin/",
  /** Domaines d'expertise — `knowsAbout` JSON-LD (page d'entité). */
  knowsAbout: [
    "Stratégie IA en entreprise",
    "Direction et création d'entreprise",
    "Audit et implémentation IA",
    "Transformation digitale PME, ETI et grands groupes",
    "Conduite du changement",
  ] as const,
  /**
   * Chemin de la page d'autorité, SANS préfixe de locale, et locale unique où elle est
   * servie. La route `[locale]/equipe/[slug]` 404 hors FR : le préfixe fait donc partie de
   * l'identité de la page, il n'est pas cosmétique.
   */
  pagePath: "/equipe/williams",
  pageLocale: "fr",
} as const;

export type Founder = typeof FOUNDER;

/**
 * URL absolue canonique de la fiche fondateur.
 *
 * Elle était recopiée en dur à une dizaine d'endroits (`lib/seo.ts`, `williams-person.ts`,
 * `sitemap.ts`, `Footer.tsx`, les trois vues blog, `actualites`…). Recopiée, donc libre de
 * diverger — et elle divergeait déjà : `buildPersonJsonLd` et `buildArticleJsonLd` posaient
 * `/a-propos#will`, une ancre morte, pendant que la vraie fiche vivait sous
 * `/fr/equipe/williams`.
 */
export function founderUrl(): string {
  return `${BRAND.url}/${FOUNDER.pageLocale}${FOUNDER.pagePath}`;
}

/**
 * Le `@id` canonique du nœud `Person` du fondateur — L'UNIQUE forme autorisée.
 *
 * Un `@id` n'est pas une URL de navigation : c'est le NOM que les moteurs et les modèles
 * donnent à l'entité. Deux `@id` pour une personne ne font pas une entité mieux décrite,
 * ils font deux personnes à moitié décrites. Tout ce qui parle de Williams — le nœud de la
 * fiche, `Organization.founder`, l'auteur des articles, le `reviewedBy` des listings, et
 * jusqu'au JSON-LD des livres fabriqués par BookForge — doit citer CETTE chaîne.
 */
export const FOUNDER_PERSON_ID = `${founderUrl()}#person` as const;
