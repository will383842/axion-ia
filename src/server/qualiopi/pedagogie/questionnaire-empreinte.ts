/**
 * Lot L08 — l'empreinte SHA-256 d'un contenu de questionnaire (colonne
 * `questionnaire_versions.empreinte`, CHECK `^[0-9a-f]{64}$`). Serveur seulement.
 */

import { createHash } from "node:crypto";

import type { ContenuQuestionnaire } from "./questionnaire-contenu";

/** JSON canonique : clés triées, pour une empreinte indépendante de l'ordre d'écriture. */
function canonique(valeur: unknown): string {
  if (Array.isArray(valeur)) return `[${valeur.map(canonique).join(",")}]`;
  if (valeur !== null && typeof valeur === "object") {
    const o = valeur as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonique(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(valeur);
}

/** SHA-256 hexadécimal (64 caractères) du contenu — la contrainte `questionnaire_versions_empreinte_sha256`. */
export function empreinteContenu(contenu: ContenuQuestionnaire): string {
  return createHash("sha256").update(canonique(contenu)).digest("hex");
}
