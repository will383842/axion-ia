/**
 * Types du module « équipe » (module PUR : aucun accès base, aucun React).
 *
 * `FicheCollaborateur` est la vue brute, côté serveur seulement : elle peut
 * porter un nom de famille. Ce qui part vers une page est `FichePublique`
 * (cf. `regles.ts`), qui ne le porte jamais.
 */

export const CATEGORIES_IDS = [
  "direction",
  "apporteur",
  "developpeur",
  "specialiste-ia",
  "partenaire",
] as const;

export type Categorie = (typeof CATEGORIES_IDS)[number];

/** Forme du point sur la carte : elle porte l'information, la couleur la redouble. */
export type FormePoint = "rond" | "carre" | "triangle" | "losange" | "hexagone";

/** Accords : « f » elle, « m » il, « n » tournures neutres. */
export type Accord = "f" | "m" | "n";

export interface PhotoCollaborateur {
  src: string;
  largeur: number;
  hauteur: number;
  alt: string;
  /** Date (ISO) du consentement. Sans elle, la photo n'existe pas : avatar. */
  consentementLe?: string | null;
}

export interface MetierCollaborateur {
  id: string;
  nom: string;
}

export interface ParcoursCollaborateur {
  /** Faits datés fournis par la personne (une année au moins). */
  avant?: ReadonlyArray<{ annee: number; libelle: string }>;
  chezAxionDepuis?: number;
  /** Attestations réelles seulement. */
  attestations?: ReadonlyArray<string>;
}

export interface FicheCollaborateur {
  slug: string;
  categorie: Categorie;
  /** Prénom SEUL. Jamais de nom de famille dans ce champ. */
  prenom: string;
  /** Nom complet : ignoré sauf pour le dirigeant principal. */
  nomComplet?: string;
  estDirigeantPrincipal: boolean;
  accord: Accord;
  fonction: string;
  reponseQui: string;
  ville?: string;
  /** Code département (« 38 », « 2A », « 974 »…). */
  departement?: string;
  afficherSurCarte: boolean;
  photo?: PhotoCollaborateur | null;
  metiers?: ReadonlyArray<MetierCollaborateur>;
  parcours?: ParcoursCollaborateur | null;
  citations?: ReadonlyArray<string>;
  /** Nombre de publications signées. */
  publications?: number;
}

/** Ce qu'une page a le droit de recevoir : aucun nom de famille, aucune clé « nomComplet ». */
export type FichePublique = Omit<FicheCollaborateur, "nomComplet" | "prenom"> & {
  /** Nom affiché (prénom seul, sauf dirigeant principal). */
  nom: string;
  initiales: string;
};

export interface Lieu {
  ville?: string | null;
  departement?: string | null;
}

export interface Coordonnees {
  lat: number;
  lon: number;
  /** Précision : la ville, ou à défaut le chef-lieu du département. */
  precision: "ville" | "departement";
}
