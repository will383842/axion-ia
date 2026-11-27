/**
 * Porte qualité : types (squelette pur, Q2).
 * Conception : docs/pilotage-seo-geo/CONCEPTION-PORTE-QUALITE.md (§ 3, § 4, § 5).
 * Aucune E/S ici : les accès externes arrivent déjà résolus, dans le contexte,
 * sous la forme `Source<T>`.
 */

import type { ReglagesPorte } from "./reglages";

/** Une source externe déjà interrogée par l'appelant. `null` n'est pas 0 : voir § 3, règle 2. */
export type Source<T> =
  | { readonly etat: "ok"; readonly valeur: T }
  | { readonly etat: "indisponible"; readonly raison: string };

export type EtatLien = "sain" | "mort" | "non_indexable";

export type FamilleCritere =
  "doctrine" | "faits" | "structure" | "completude" | "maillage" | "metadonnees";

/** Classement unique des bloquants (§ 5). */
export type ClasseBloquant = "dur" | "corrigeable" | "derogeable";

export type StatutCritere = "ok" | "echec" | "non_evalue";

export interface AuteurPorte {
  readonly nom: string;
  readonly type: "Organization" | "Person";
  /** `true` seulement si c'est une personne réelle (ou l'organisation elle-même). */
  readonly reel: boolean;
}

export interface ContenuPorte {
  /** ContentGenJob.contentType (ex. "blog_article", "blog_from_rss"). */
  readonly contentType: string;
  readonly titre: string;
  readonly metaDescription: string | null;
  /** HTML complet de la page, H1 compris. */
  readonly corpsHtml: string;
  readonly directAnswer: string | null;
  readonly keyTakeaway: string | null;
  /** Autres champs à passer à la doctrine (alt, JSON-LD, FAQ…), nom du champ → texte. */
  readonly champsSupplementaires: Readonly<Record<string, string | undefined>>;
  readonly auteur: AuteurPorte | null;
  /** Date ISO (AAAA-MM-JJ ou datetime). */
  readonly datePublished: string | null;
  readonly dateModified: string | null;
}

export interface PenalitesNote {
  readonly avertissements?: number;
  readonly preuves?: number;
  readonly proximite?: number;
  readonly intention?: number;
}

export interface ContextePorte {
  readonly reglages: ReglagesPorte;
  /** Horloge injectée (la porte ne lit jamais l'heure elle-même). */
  readonly maintenant: Date;
  /** `OF_PUBLIC_DISCLOSURE_ENABLED === "true"`. */
  readonly financementPublicAutorise: boolean;
  /** Hôtes qui comptent comme « interne » dans une URL absolue. */
  readonly hotesInternes: ReadonlyArray<string>;
  /** Santé des liens internes (chemin normalisé → état). */
  readonly etatLiens: Source<Readonly<Record<string, EtatLien>>>;
  /** Chemin de la page « propriétaire » du thème, si connue. */
  readonly pageProprietaire: string | null;
  /** Corps actuellement publié (`null` = jamais publié). */
  readonly corpsDejaPublie: Source<string | null>;
  /** Pénalités de la note issues de critères pas encore branchés (Q3 et suivants). */
  readonly penalites: PenalitesNote;
}

export interface ResultatBrut {
  readonly statut: StatutCritere;
  /** Phrase en français simple, `null` quand tout va bien. */
  readonly raison: string | null;
  /** Extraits ou valeurs mesurées. */
  readonly preuves: ReadonlyArray<string>;
}

export interface ResultatCritere extends ResultatBrut {
  readonly id: string;
  readonly classe: ClasseBloquant;
}

export interface Critere {
  /** Identifiant stable (B01…, B11a : sous-règle de structure de B11). */
  readonly id: string;
  readonly libelle: string;
  readonly famille: FamilleCritere;
  readonly gravite: "bloquant";
  readonly classe: ClasseBloquant;
  /** Dérogation humaine permise (vrai seulement pour la classe « dérogeable »). */
  readonly derogation: boolean;
  /** Seuil de départ, en français, pour l'écran de console. */
  readonly seuil: (reglages: ReglagesPorte) => string;
  readonly evaluer: (
    contenu: ContenuPorte,
    contexte: ContextePorte,
    reglages: ReglagesPorte,
  ) => ResultatBrut;
}

export type VerdictFinal = "publiable" | "a_corriger" | "bloque";

export interface MotifRefus {
  readonly id: string;
  readonly classe: ClasseBloquant;
  readonly statut: "echec" | "non_evalue";
  readonly raison: string;
}

export interface VerdictPorte {
  readonly versionPorte: string;
  readonly verdict: VerdictFinal;
  readonly note: number;
  readonly criteres: ReadonlyArray<ResultatCritere>;
  readonly motifs: ReadonlyArray<MotifRefus>;
  /** Critères bloquants prévus au § 4.1 mais pas encore dans le registre (squelette Q2). */
  readonly criteresAbsents: ReadonlyArray<string>;
  readonly seuilsFiges: ReglagesPorte;
}
