/**
 * Requêtes à exclure de toute PROPOSITION : la ville interdite et les interdits de publication.
 * La mesure, elle, est stockée telle quelle : ce filtre ne supprime rien, il classe.
 * Module PUR ; réutilise `detecterInterdits` (aucun motif dupliqué).
 */
import {
  detecterInterdits,
  normaliserPourControle,
  type OptionsInterdits,
} from "@/lib/contenu/interdits-publication";

const OPTIONS_PAR_DEFAUT: OptionsInterdits = { actualite: false, financementPublicAutorise: false };
const RE_VILLE = /(?<![a-z0-9])gren[o]ble(?![a-z0-9])/;

export interface VerdictRequete {
  readonly exclue: boolean;
  readonly raisons: string[];
}

export function verdictRequete(
  requete: string,
  opts: OptionsInterdits = OPTIONS_PAR_DEFAUT,
): VerdictRequete {
  const raisons = new Set<string>();
  if (RE_VILLE.test(normaliserPourControle(requete))) raisons.add("grenoble");
  for (const d of detecterInterdits(requete, opts)) raisons.add(d.code);
  return { exclue: raisons.size > 0, raisons: [...raisons] };
}

export function filtrerInterdits<T extends { readonly requete: string }>(
  lignes: ReadonlyArray<T>,
  opts: OptionsInterdits = OPTIONS_PAR_DEFAUT,
): { retenues: T[]; exclues: Array<{ ligne: T; raisons: string[] }> } {
  const retenues: T[] = [];
  const exclues: Array<{ ligne: T; raisons: string[] }> = [];
  for (const ligne of lignes) {
    const v = verdictRequete(ligne.requete, opts);
    if (v.exclue) exclues.push({ ligne, raisons: v.raisons });
    else retenues.push(ligne);
  }
  return { retenues, exclues };
}
