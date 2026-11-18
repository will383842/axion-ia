/**
 * Fiche locale d'une ville : chiffres publics sourcés, institutions publiques, prose et FAQ.
 *
 * Règles (PLAN-VILLES §3.1) : chaque chiffre a une URL consultable et une date de consultation ;
 * la prose ne reprend que ces champs ; aucune entreprise privée (catégories fermées) ;
 * aucun témoignage, aucun chiffre client.
 */

export type CategorieInstitution =
  | "pole"
  | "technopole"
  | "zone"
  | "universite"
  | "ecole"
  | "french-tech"
  | "gare"
  | "aeroport"
  | "cci";

export interface InstitutionLocale {
  readonly nom: string;
  readonly categorie: CategorieInstitution;
  readonly url: string;
  readonly role: string;
  /** AAAA-MM-JJ. */
  readonly consulteLe: string;
}

export interface SecteurChiffre {
  readonly code: string;
  readonly libelle: string;
  readonly etablissements: number;
  readonly salaries: number;
}

export interface FicheLocale {
  readonly slug: string;
  readonly nomVille: string;
  /** AAAA-MM-JJ : date de mise à jour de la fiche. */
  readonly dateFiche: string;
  readonly population: {
    readonly valeur: number;
    readonly source: string;
    readonly url: string;
    readonly consulteLe: string;
  };
  readonly epci: {
    readonly nom: string;
    readonly code: string;
    readonly population: number;
    readonly nombreCommunes: number;
    readonly source: string;
    readonly url: string;
    /** URL qui renvoie la population de l'intercommunalité. */
    readonly urlPopulation: string;
    readonly communes: ReadonlyArray<string>;
    readonly consulteLe: string;
  };
  readonly entreprises: {
    readonly millesime: number;
    readonly perimetre: string;
    readonly etablissements: number;
    readonly salaries: number;
    readonly urlTotal: string;
    readonly urlSecteurs: string;
    readonly source: string;
    readonly consulteLe: string;
    readonly secteurs: ReadonlyArray<SecteurChiffre>;
    readonly infoCom: { readonly etablissements: number; readonly salaries: number };
    readonly extras: {
      readonly transports: { readonly etablissements: number; readonly salaries: number };
      readonly agroalimentaire: { readonly etablissements: number; readonly salaries: number };
    };
  };
  readonly institutions: ReadonlyArray<InstitutionLocale>;
  readonly prose: {
    readonly tissu: string;
    readonly ecosysteme: string;
    readonly zone: string;
  };
  /** 3 questions locales, réponses de 40 à 80 mots, identiques au texte visible. */
  readonly faqLocale: ReadonlyArray<{ readonly q: string; readonly a: string }>;
}
