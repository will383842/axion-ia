/**
 * Relevé mensuel : JSON canonique et empreintes SHA-256. Module PUR.
 *
 * `empreinteContenu` couvre tout le contenu figé. `empreinteControle` exclut le report indicatif
 * (D3), qui n'a pas de date de sortie et ne doit pas bloquer un envoi groupé (plan § 5.2, § 6.2).
 */

import { createHash } from "node:crypto";
import type { ContenuReleveV1 } from "./types";

/**
 * JSON canonique : clés triées à tous les niveaux, `undefined` omis, dates en ISO, nombres ENTIERS
 * uniquement (tout est en centimes ; un nombre à virgule est un défaut, jamais un cas).
 */
export function jsonCanonique(valeur: unknown): string {
  if (valeur === null) return "null";
  if (valeur instanceof Date) return JSON.stringify(valeur.toISOString());
  switch (typeof valeur) {
    case "number":
      if (!Number.isInteger(valeur)) {
        throw new Error(
          `nombre non entier dans un contenu figé : ${String(valeur)} (centimes entiers attendus)`,
        );
      }
      return String(valeur);
    case "string":
    case "boolean":
      return JSON.stringify(valeur);
    case "object": {
      if (Array.isArray(valeur)) {
        return `[${valeur.map((x) => (x === undefined ? "null" : jsonCanonique(x))).join(",")}]`;
      }
      const o = valeur as Record<string, unknown>;
      const morceaux = Object.keys(o)
        .filter((k) => o[k] !== undefined)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${jsonCanonique(o[k])}`);
      return `{${morceaux.join(",")}}`;
    }
    default:
      throw new Error(`type non sérialisable dans un contenu figé : ${typeof valeur}`);
  }
}

export function sha256Hex(donnees: string | Uint8Array): string {
  return createHash("sha256").update(donnees).digest("hex");
}

/** `sha256(JSON canonique(contenu))`. */
export function empreinteContenu(contenu: ContenuReleveV1): string {
  return sha256Hex(jsonCanonique(contenu));
}

/** Empreinte de contrôle avant envoi : le contenu SANS le report indicatif (D3). */
export function empreinteControle(contenu: ContenuReleveV1): string {
  const { report, ...reste } = contenu;
  const { indicatif: _indicatif, ...reportSansIndicatif } = report;
  return sha256Hex(jsonCanonique({ ...reste, report: reportSansIndicatif }));
}
