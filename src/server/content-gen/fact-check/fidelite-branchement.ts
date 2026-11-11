/**
 * Branchement du contrôle de fidélité (vague 3, chantier 2, 11/11/2026).
 * Interrupteur `CONTENT_FIDELITY_CHECK`, ÉTEINT par défaut : « true » → actif (relecture),
 * « dry-run » → essai à blanc (journal seulement), toute autre valeur → éteint.
 * Voir `docs/knowledge/CONTROLE-FIDELITE.md`. Fonctions pures.
 */

import type { BarriereRelecture } from "../quality/barrieres-publication";
import type { ConstatFidelite } from "./controle-fidelite";

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
