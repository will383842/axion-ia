/**
 * Branchement du contrôle de fidélité (vague 3, chantier 2, 11/11/2026).
 * Interrupteur `CONTENT_FIDELITY_CHECK`, ÉTEINT par défaut : « true » → actif (relecture),
 * « dry-run » → essai à blanc (journal seulement), toute autre valeur → éteint.
 * Voir `docs/knowledge/CONTROLE-FIDELITE.md`. Fonctions pures.
 */

import type { BarriereRelecture } from "../quality/barrieres-publication";
import {
  controleFidelite,
  type ConstatFidelite,
  type FicheConnaissance,
} from "./controle-fidelite";

export type ModeControleFidelite = "eteint" | "essai-a-blanc" | "actif";

export const MAX_CONSTATS_JOURNAL = 20;

export function modeControleFidelite(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ModeControleFidelite {
  const v = env["CONTENT_FIDELITY_CHECK"]?.trim().toLowerCase();
  if (v === "true") return "actif";
  if (v === "dry-run") return "essai-a-blanc";
  return "eteint";
}

export function constatPourJournal(c: ConstatFidelite): Record<string, string | null> {
  return {
    nature: c.nature,
    famille: c.famille,
    affirmation: c.affirmation,
    phrase: c.phrase,
    fiche_id: c.ficheId,
    fiche_titre: c.ficheTitre,
    valeur_fiche: c.valeurFiche,
  };
}

/** Aucun constat → null ; sinon une barrière de relecture qui liste affirmations et fiches. */
export function barriereDepuisConstats(
  constats: ReadonlyArray<ConstatFidelite>,
): BarriereRelecture | null {
  if (constats.length === 0) return null;
  const contradictoires = constats.filter((c) => c.nature === "contradictoire").length;
  const nonEtayes = constats.length - contradictoires;
  return {
    code: "fidelite-kb",
    libelle: `Affirmations chiffrées ou juridiques à vérifier contre la base de connaissances (${contradictoires} contredite(s), ${nonEtayes} non étayée(s))`,
    detail: {
      contradictoires,
      non_etayes: nonEtayes,
      constats: constats.slice(0, MAX_CONSTATS_JOURNAL).map(constatPourJournal),
    },
  };
}

export interface DecisionFidelite {
  /** Les fiches ont-elles été lues ? Faux si éteint ou si aucune fiche n'a nourri le texte. */
  readonly executee: boolean;
  readonly fiches: number;
  /** Barrière calculée (journalisée dans tous les modes exécutés). */
  readonly barriere: BarriereRelecture | null;
  /** Barrière à AJOUTER aux barrières de relecture : seulement en mode actif. */
  readonly aAjouter: BarriereRelecture | null;
}

/**
 * Décision pure du worker : éteint → aucune lecture (`lireFiches` n'est pas appelée) ;
 * essai à blanc → constats calculés, aucune barrière à ajouter ; actif → barrière à ajouter.
 */
export async function decisionFidelite(args: {
  readonly mode: ModeControleFidelite;
  readonly kbEntryIds: ReadonlyArray<string> | null | undefined;
  readonly bodyHtml: string | null | undefined;
  readonly lireFiches: (ids: ReadonlyArray<string>) => Promise<ReadonlyArray<FicheConnaissance>>;
}): Promise<DecisionFidelite> {
  const { mode, kbEntryIds } = args;
  if (mode === "eteint" || !Array.isArray(kbEntryIds) || kbEntryIds.length === 0) {
    return { executee: false, fiches: 0, barriere: null, aAjouter: null };
  }
  const fiches = await args.lireFiches([...kbEntryIds]);
  const barriere = barriereDepuisConstats(controleFidelite(args.bodyHtml ?? "", fiches));
  return {
    executee: true,
    fiches: fiches.length,
    barriere,
    aAjouter: mode === "actif" ? barriere : null,
  };
}
