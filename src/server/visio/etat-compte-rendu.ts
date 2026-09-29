/**
 * L'ÉTAT DE TRAVAIL d'un compte rendu, entre deux étapes du circuit.
 *
 * Il vit dans `CompteRendu.verification`, CHIFFRÉ en un bloc (`chiffrerParole`).
 * Ce qu'il porte, et ce qu'il ne porte jamais :
 *
 *   · la sortie BRUTE de P1 (`extraction`) n'y reste que le temps d'aller de
 *     `extraire` à `verifier_faits` : dès la vérification, elle disparaît —
 *     avec elle, le texte des citations rejetées (jamais conservé) ;
 *   · le brouillon de P5 (`redaction`) n'y reste que jusqu'à la vérification
 *     du compte rendu : le texte retenu part dans `contenu` ;
 *   · le reste (couverture, propositions de rattachement, relations,
 *     ébauches, compteurs, signaux) sert à réécrire ou compléter sans
 *     rappeler P1 — et ne contient AUCUNE citation.
 *
 * Module PUR (le chiffrement est fait par l'appelant).
 */

import type { CompteRenduV1, ConsolidationV1, EbaucheV1, RattachementV1 } from "./schemas/autres";
import type { ExtractionV1 } from "./schemas/extraction";
import type { Couverture } from "./verification/g06-couverture";
import type { EbaucheChiffree } from "./catalogue-ia";
import type { ProjetEvoque } from "./consolider";

export interface EtatCompteRendu {
  readonly v: 1;
  /** Date de l'échange (ISO) : les dates relatives se recalculent depuis elle. */
  readonly dateEchange: string;
  readonly empreinteCatalogue: string;
  /** Brute, jusqu'à `verifier_faits` seulement. */
  readonly extraction: ExtractionV1 | null;
  readonly correspondances: {
    readonly faits: ReadonlyArray<readonly [string, string]>;
    readonly contacts: ReadonlyArray<readonly [string, string]>;
    readonly projets: ReadonlyArray<readonly [string, string]>;
  };
  /** `F07` → identifiant du fait écrit. */
  readonly faits: ReadonlyArray<readonly [string, string]>;
  /** `F07` → portée et projet évoqué (`J…`) DÉCLARÉS par P1 (proposition, jamais appliquée). */
  readonly declarations: ReadonlyArray<readonly [string, "entreprise" | "projet", string | null]>;
  readonly couverture: Couverture | null;
  readonly projetsEvoques: readonly ProjetEvoque[];
  readonly suivis: ReadonlyArray<{ readonly connuRef: string; readonly statut: string }>;
  readonly natureEchange: string | null;
  /** `null` : pas encore appelée ; `"en_attente_client"` : la rencontre n'est pas rattachée. */
  readonly rattachement: RattachementV1 | "en_attente_client" | null;
  readonly consolidation: ReadonlyArray<{
    readonly perimetre: string;
    readonly projetId: string | null;
    readonly resultat: ConsolidationV1;
  }>;
  readonly ebauches: ReadonlyArray<{
    readonly projetRef: string;
    readonly ebauche: EbaucheV1;
    readonly chiffrage: EbaucheChiffree;
  }>;
  /** Brouillon de P5, jusqu'à `verifier_compte_rendu`. */
  readonly redaction: CompteRenduV1 | null;
  readonly essaisRedaction: number;
  readonly compteurs: Readonly<Record<string, number>>;
  readonly signaux: readonly string[];
}

export function etatInitial(dateEchange: Date, empreinteCatalogue: string): EtatCompteRendu {
  return {
    v: 1,
    dateEchange: dateEchange.toISOString(),
    empreinteCatalogue,
    extraction: null,
    correspondances: { faits: [], contacts: [], projets: [] },
    faits: [],
    declarations: [],
    couverture: null,
    projetsEvoques: [],
    suivis: [],
    natureEchange: null,
    rattachement: null,
    consolidation: [],
    ebauches: [],
    redaction: null,
    essaisRedaction: 0,
    compteurs: {},
    signaux: [],
  };
}

export function lireEtat(json: string): EtatCompteRendu {
  const e = JSON.parse(json) as EtatCompteRendu;
  if (e.v !== 1) throw new Error("[visio] état de compte rendu : version inconnue");
  return e;
}

/** L'état tel qu'il peut être gardé après la vérification : sans brut, sans brouillon. */
export function etatSansTexteBrut(e: EtatCompteRendu): EtatCompteRendu {
  return { ...e, extraction: null, redaction: null };
}
