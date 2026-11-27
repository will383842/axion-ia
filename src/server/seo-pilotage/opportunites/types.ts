/**
 * Types du moteur d'opportunités (module PUR : aucun accès base, aucun réseau).
 *
 * ⚠️ `TypePage` est une interface MINIMALE LOCALE. Le module de données (P3,
 * `seo-pilotage/donnees/types-page.ts`) en porte la version de référence ;
 * à l'intégration, remplacer cet alias par l'import de P3.
 */
export type TypePage =
  | "article"
  | "actualite"
  | "guide"
  | "faq"
  | "ville"
  | "offre"
  | "institutionnel"
  | "legal"
  | "conversion"
  | "autre";

/**
 * Le type `Action` n'a AUCUNE variante « changer d'URL » : verrouillé par
 * `analyser.spec.ts` (aucune sortie ne porte `nouvelleUrl` ni `changer_url`).
 */
export type Action =
  "titre_meta" | "faq" | "mise_a_jour" | "lien_interne" | "nouvelle_page" | "inspection";

export type CodeDetecteur = "a" | "b" | "c" | "d" | "e" | "f";

/** Une requête servie par une page, agrégée sur 28 jours. */
export interface LigneRequete {
  readonly requete: string;
  readonly url: string;
  readonly typePage: TypePage;
  /** Position moyenne pondérée par les impressions. */
  readonly position: number;
  readonly impressions: number;
  readonly clics: number;
  /** Nombre de semaines (sur 4) où la requête est apparue. */
  readonly semainesPresentes: number;
}

export interface Proposition {
  readonly detecteur: CodeDetecteur;
  readonly action: Action;
  readonly url: string;
  readonly requete?: string;
  /** Page vers laquelle pointer (lien interne). */
  readonly pageCible?: string;
  readonly gainClics: number;
  /** 0 à 1. */
  readonly confiance: number;
  readonly effort: number;
  readonly priorite: number;
  readonly motif: string;
}

/** Ce que le système ne fait JAMAIS seul : un humain tranche. */
export type KindSignalement = "fusion" | "noindex_ou_fusion" | "page_protegee";

export interface Signalement {
  readonly kind: KindSignalement;
  readonly detecteur: CodeDetecteur;
  readonly url: string;
  readonly requete?: string;
  readonly motif: string;
  /** Action qui aurait été proposée (page protégée). */
  readonly actionEvitee?: Action;
}

export interface Sortie {
  readonly propositions: readonly Proposition[];
  readonly signalements: readonly Signalement[];
}
