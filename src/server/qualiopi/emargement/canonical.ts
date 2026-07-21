/**
 * Qualiopi T13 — Sérialisation canonique pour le hachage des signatures.
 *
 * Un hash de preuve ne vaut que si l'octet-à-octet est REPRODUCTIBLE des années
 * plus tard. `JSON.stringify` ne l'est pas : l'ordre des clés suit l'ordre
 * d'insertion, qui dépend du code qui a construit l'objet. Deux versions du même
 * service produiraient alors deux hash différents pour la même signature, et la
 * chaîne deviendrait invérifiable — sans que personne ne s'en aperçoive.
 *
 * Sous-ensemble de RFC 8785 (JSON Canonicalization Scheme) suffisant pour notre
 * tuple : clés triées par point de code UTF-16, aucun espace, chaînes échappées
 * par `JSON.stringify`.
 *
 * ⚠️ CHOIX DÉLIBÉRÉ : tout ce qui n'est pas canonicalisable de façon certaine
 * LÈVE, au lieu d'être coercé silencieusement. Un `undefined` avalé, un flottant
 * arrondi ou une `Date` sérialisée selon le fuseau produiraient un hash
 * plausible mais faux — le pire des résultats pour une preuve. RFC 8785 impose
 * pour les nombres le format ECMAScript `Number::toString`, dont les cas limites
 * (notation exponentielle, -0, précision) sont une source d'erreur inutile ici :
 * on n'accepte donc que des entiers sûrs.
 *
 * Aucun import Prisma / accès DB.
 */

/** Valeur admise dans un tuple canonique. */
export type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | CanonicalValue[]
  | { [k: string]: CanonicalValue };

/** Levée quand une valeur ne peut pas être canonicalisée de façon déterministe. */
export class CanonicalisationError extends Error {
  constructor(chemin: string, raison: string) {
    super(`Valeur non canonicalisable en « ${chemin} » : ${raison}`);
    this.name = "CanonicalisationError";
  }
}

function serialiser(valeur: unknown, chemin: string): string {
  if (valeur === null) return "null";

  const type = typeof valeur;

  if (type === "string") return JSON.stringify(valeur);
  if (type === "boolean") return valeur === true ? "true" : "false";

  if (type === "number") {
    const n = valeur as number;
    // Voir l'en-tête : on refuse tout ce dont la représentation textuelle
    // pourrait varier. Nos tuples n'ont besoin que d'entiers (versions).
    if (!Number.isInteger(n) || !Number.isSafeInteger(n)) {
      throw new CanonicalisationError(
        chemin,
        "seuls les entiers sûrs sont admis (un flottant n'a pas de représentation textuelle stable)",
      );
    }
    // Normalise -0 en 0 : `Object.is(-0, 0)` est faux, mais les deux doivent
    // produire le même hash.
    return String(n === 0 ? 0 : n);
  }

  if (type === "undefined") {
    throw new CanonicalisationError(
      chemin,
      "`undefined` est ambigu — utiliser `null` explicitement",
    );
  }

  if (type === "bigint" || type === "function" || type === "symbol") {
    throw new CanonicalisationError(chemin, `type « ${type} » non sérialisable`);
  }

  if (Array.isArray(valeur)) {
    const items = valeur.map((v, i) => serialiser(v, `${chemin}[${i}]`));
    return `[${items.join(",")}]`;
  }

  if (valeur instanceof Date) {
    // Une `Date` se sérialiserait via `toJSON()`, donc en UTC — correct, mais
    // implicite. On exige la conversion explicite côté appelant pour que le
    // format horodaté du tuple soit visible dans le code qui le construit.
    throw new CanonicalisationError(
      chemin,
      "convertir explicitement en chaîne ISO-8601 UTC (`toISOString()`) avant hachage",
    );
  }

  // Objet simple.
  const obj = valeur as Record<string, unknown>;
  const cles = Object.keys(obj).sort();
  const paires = cles.map((k) => {
    const v = obj[k];
    return `${JSON.stringify(k)}:${serialiser(v, chemin === "" ? k : `${chemin}.${k}`)}`;
  });
  return `{${paires.join(",")}}`;
}

/**
 * Sérialise une valeur en JSON canonique : clés triées, aucun espace.
 *
 * @throws {CanonicalisationError} si une valeur n'est pas canonicalisable.
 */
export function canonicalJson(valeur: CanonicalValue): string {
  return serialiser(valeur, "");
}
