/**
 * Lecture tolérante du journal de l'équipe éditoriale (`outputJsonRaw.equipe`).
 * Hors fichier « use server » : une Server Action doit être async, pas ce lecteur pur.
 */

export interface EntreeJournalRole {
  readonly role: string;
  readonly decision: string;
  readonly coutUsd: number;
  readonly passe: number;
  readonly detail?: string;
}

export const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Extrait causes, coût et journal d'`outputJsonRaw.equipe` (lecture tolérante). */
export function lireJournalEquipe(output: unknown): {
  causes: string[];
  coutUsd: number | null;
  journal: EntreeJournalRole[];
} {
  const equipe = estObjet(output) ? output["equipe"] : undefined;
  if (!estObjet(equipe)) return { causes: [], coutUsd: null, journal: [] };
  const entrees = Array.isArray(equipe["entrees"]) ? equipe["entrees"] : [];
  const journal = entrees.filter(estObjet).map((e) => ({
    role: String(e["role"] ?? "?"),
    decision: String(e["decision"] ?? ""),
    coutUsd: typeof e["coutUsd"] === "number" ? e["coutUsd"] : 0,
    passe: typeof e["passe"] === "number" ? e["passe"] : 0,
    ...(typeof e["detail"] === "string" ? { detail: e["detail"] } : {}),
  }));
  const causesBrutes = estObjet(output) ? output["blockCauses"] : undefined;
  const causes = Array.isArray(causesBrutes)
    ? causesBrutes.filter((c): c is string => typeof c === "string")
    : typeof equipe["raison"] === "string"
      ? [equipe["raison"]]
      : [];
  return {
    causes,
    coutUsd: typeof equipe["coutTotalUsd"] === "number" ? equipe["coutTotalUsd"] : null,
    journal,
  };
}
