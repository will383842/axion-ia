/**
 * EXCLUSIONS PERSISTANTES DU FLUX LETTRE ET GUIDE (lot L4-S, décision D4).
 *
 * Certaines adresses (celles de la maison) ne doivent JAMAIS entrer au CRM par
 * la lettre ou le guide — ni par le rattrapage, ni par un clic de demain.
 * Passées en argument au rattrapage seulement, elles ne valaient que pour une
 * exécution : le clic suivant d'une de ces adresses partait au CRM.
 *
 * Elles vivent donc dans l'ENVIRONNEMENT, jamais dans ce dépôt (public), et
 * jamais en clair : `CRM_SYNC_EXCLUSIONS_SHA256` est une liste, séparée par
 * des virgules, d'empreintes SHA-256 de l'adresse normalisée (espaces retirés,
 * minuscules) — le calcul de `empreinteSha256`, le même que la liste de
 * suppression et que le CRM. Pour calculer une empreinte :
 *
 *   node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1].trim().toLowerCase()).digest('hex'))" <adresse>
 *
 * Lue à CHAQUE appel (comme les drapeaux de `config.ts`). Une valeur qui n'est
 * pas une empreinte (64 hexadécimaux) est IGNORÉE : une adresse collée là par
 * erreur n'exclurait rien et ne doit pas faire croire le contraire — elle est
 * comptée par `exclusionsInvalides()`, que le rattrapage affiche.
 *
 * Lue par le clic sur le lien du guide, l'inscription à la lettre, le rebond
 * dur ET le rattrapage.
 */

import { empreinteSha256 } from "@/server/newsletter/exports";

const FORME_EMPREINTE = /^[0-9a-f]{64}$/;

function valeurs(): string[] {
  return (process.env.CRM_SYNC_EXCLUSIONS_SHA256 ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.length > 0);
}

/** Les empreintes valides de `CRM_SYNC_EXCLUSIONS_SHA256`. */
export function empreintesExclues(): ReadonlySet<string> {
  return new Set(valeurs().filter((v) => FORME_EMPREINTE.test(v)));
}

/** Nombre de valeurs qui ne sont pas des empreintes (ignorées). */
export function exclusionsInvalides(): number {
  return valeurs().filter((v) => !FORME_EMPREINTE.test(v)).length;
}

/** Vrai si l'adresse est exclue du CRM par l'environnement. */
export function estExclueDuCrm(email: string): boolean {
  const exclues = empreintesExclues();
  return exclues.size > 0 && exclues.has(empreinteSha256(email));
}
