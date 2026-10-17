/**
 * SSOT — Secteurs CLIENT (industrie du client : santé / BTP / juridique…).
 *
 * ⚠️ NE PAS confondre avec les 5 ACTIVITÉS Axion-IA (`ServiceSector` /
 * `Verticale` : audits / interventions_formations / implementations / un_a_un /
 * sites_web_augmentes — cf. `src/content/knowledge/services.ts`).
 *
 * Ce module est la source de vérité unique pour l'axe « secteur client » des
 * campagnes content-gen multi-axes. Les slugs sont alignés 1:1 sur l'enum
 * `Secteur` de la pain-matrix (`src/server/content-gen/kb/sector-pain-matrix.ts`)
 * car ce sont les SEULS secteurs qui produisent du contenu différencié : pour un
 * secteur sans entrée pain-matrix sur la verticale visée, l'augmentation de
 * prompt est un no-op (cf. `getSectorPainContext` → undefined).
 *
 * Fichier PUR (pas de "use server", pas d'I/O) → importable client ET serveur.
 * Un test (`sectors.spec.ts`) garantit l'absence de dérive avec la pain-matrix,
 * `BlogSector` et `KB_SECTOR_TAGS`.
 */

/** Slug canonique d'un secteur client (= enum `Secteur` pain-matrix). */
export type ClientSectorSlug =
  | "comptabilite_finance"
  | "btp_immobilier"
  | "restauration_hotellerie"
  | "sante_medecine"
  | "juridique"
  | "commerce_retail"
  | "industrie_logistique"
  | "artisanat_services"
  | "rh_recrutement"
  | "collectivites_public";

export interface ClientSector {
  /** Slug canonique (= pain-matrix `Secteur`). */
  readonly slug: ClientSectorSlug;
  /** Libellé court pour les cartes/sliders du wizard. */
  readonly labelFr: string;
  /** Libellé long (mentions du secteur dans la prose). */
  readonly fullFr: string;
  /** Emoji d'agrément pour l'UI admin. */
  readonly emoji: string;
  /** Correspondance vers `BlogSector` (`src/content/blog/types.ts`). */
  readonly blogSector: string;
  /** Tags KB correspondants (`src/content/knowledge/sector-tags.ts`). */
  readonly kbSectorTags: readonly string[];
}

/**
 * Les 10 secteurs canoniques, dans l'ordre d'affichage du wizard.
 * Ordre = du plus transversal/volumineux au plus spécialisé.
 */
export const CLIENT_SECTORS: readonly ClientSector[] = [
  {
    slug: "comptabilite_finance",
    labelFr: "Comptabilité & finance",
    fullFr: "cabinets comptables, experts-comptables et directions financières",
    emoji: "📊",
    blogSector: "comptabilite",
    kbSectorTags: ["conseil-affaires", "banque-finance"],
  },
  {
    slug: "btp_immobilier",
    labelFr: "BTP & immobilier",
    fullFr: "entreprises du bâtiment, travaux publics et acteurs de l'immobilier",
    emoji: "🏗️",
    blogSector: "immobilier",
    kbSectorTags: ["construction-btp", "immobilier-pro"],
  },
  {
    slug: "restauration_hotellerie",
    labelFr: "Restauration & hôtellerie",
    fullFr: "restaurants, hôtels et acteurs du tourisme",
    emoji: "🍽️",
    blogSector: "tourisme",
    kbSectorTags: ["tourisme-affaires"],
  },
  {
    slug: "sante_medecine",
    labelFr: "Santé & médecine",
    fullFr: "professionnels de santé, cliniques et acteurs du médical",
    emoji: "🩺",
    blogSector: "sante",
    kbSectorTags: ["sante-biotech", "dispositifs-medicaux"],
  },
  {
    slug: "juridique",
    labelFr: "Juridique",
    fullFr: "cabinets d'avocats, notaires et directions juridiques",
    emoji: "⚖️",
    blogSector: "juridique",
    kbSectorTags: ["juridique"],
  },
  {
    slug: "commerce_retail",
    labelFr: "Commerce & retail",
    fullFr: "commerces, enseignes de distribution et e-commerçants",
    emoji: "🛍️",
    blogSector: "retail",
    kbSectorTags: ["retail-e-commerce", "distribution-grande-conso"],
  },
  {
    slug: "industrie_logistique",
    labelFr: "Industrie & logistique",
    fullFr: "industriels, sites de production et acteurs de la supply chain",
    emoji: "🏭",
    blogSector: "industrie",
    kbSectorTags: ["industrie-manufacturiere", "logistique-supply-chain"],
  },
  {
    slug: "artisanat_services",
    labelFr: "Artisanat & services",
    fullFr: "artisans, TPE de services et professions indépendantes",
    emoji: "🔧",
    blogSector: "conseil",
    kbSectorTags: ["conseil-affaires"],
  },
  {
    slug: "rh_recrutement",
    labelFr: "RH & recrutement",
    fullFr: "cabinets de recrutement, directions RH et acteurs de l'emploi",
    emoji: "👥",
    blogSector: "conseil",
    kbSectorTags: ["conseil-affaires"],
  },
  {
    slug: "collectivites_public",
    labelFr: "Collectivités & secteur public",
    fullFr: "collectivités territoriales, administrations et acteurs publics",
    emoji: "🏛️",
    blogSector: "autre",
    kbSectorTags: ["administration-publique", "enseignement-recherche"],
  },
] as const;

/** Tous les slugs de secteur client (ordre wizard). */
export const CLIENT_SECTOR_SLUGS: readonly ClientSectorSlug[] = CLIENT_SECTORS.map((s) => s.slug);

const BY_SLUG: ReadonlyMap<string, ClientSector> = new Map(CLIENT_SECTORS.map((s) => [s.slug, s]));

/** Récupère un secteur client par slug (undefined si inconnu). */
export function getClientSector(slug: string): ClientSector | undefined {
  return BY_SLUG.get(slug);
}

/** True si `slug` est un secteur client canonique. */
export function isClientSectorSlug(slug: string): slug is ClientSectorSlug {
  return BY_SLUG.has(slug);
}

/** Libellé FR court d'un secteur (slug brut en repli). */
export function clientSectorLabel(slug: string): string {
  return BY_SLUG.get(slug)?.labelFr ?? slug;
}
