/**
 * V2, N2 — la version d'extension qui peut enregistrer une VISIO. Module PUR,
 * sans dépendance : les routes de session (`sessions.ts`) et des morceaux
 * (`morceaux.ts`) le lisent sans s'importer l'une l'autre.
 */

import { VERSION_EXTENSION_MINIMALE_VISIO } from "@/lib/schemas/enregistreur";
import { echec, type Resultat } from "./resultat";

export const CODE_EXTENSION_TROP_ANCIENNE = "extension_trop_ancienne" as const;
export const MESSAGE_EXTENSION_TROP_ANCIENNE = `Cette copie de l'extension est trop ancienne pour enregistrer une visio : mettez à jour l'extension (version ${VERSION_EXTENSION_MINIMALE_VISIO} au moins), puis recommencez.`;

/** « 1.10.0 » → [1, 10, 0] ; `null` si ce n'est pas une version numérique. */
function partiesDeVersion(v: string): number[] | null {
  if (!/^\d+(\.\d+)*$/.test(v)) return null;
  return v.split(".").map((x) => Number(x));
}

/**
 * Vrai si cette version d'extension peut enregistrer une VISIO
 * (`VERSION_EXTENSION_MINIMALE_VISIO` ou plus récente). Comparaison NUMÉRIQUE,
 * partie par partie ; une version illisible est refusée.
 */
export function versionAccepteePourVisio(version: string): boolean {
  const lue = partiesDeVersion(version.trim());
  const min = partiesDeVersion(VERSION_EXTENSION_MINIMALE_VISIO);
  if (!lue || !min) return false;
  for (let i = 0; i < Math.max(lue.length, min.length); i += 1) {
    const a = lue[i] ?? 0;
    const b = min[i] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

/**
 * Relecture E1 — une session VISIO ouverte par une extension trop ancienne
 * (version gardée par la session) : morceau, fin de tranche, accord et fin
 * sont refusés (409). Version inconnue : rien n'est refusé. Le REFUS, lui,
 * n'appelle jamais cette garde.
 */
export function refusVersionDeSession(enr: {
  readonly nature: string;
  readonly versionExtension: string | null;
}): Resultat | null {
  if (enr.nature !== "visio" || enr.versionExtension === null) return null;
  if (versionAccepteePourVisio(enr.versionExtension)) return null;
  return echec(409, CODE_EXTENSION_TROP_ANCIENNE, MESSAGE_EXTENSION_TROP_ANCIENNE);
}
