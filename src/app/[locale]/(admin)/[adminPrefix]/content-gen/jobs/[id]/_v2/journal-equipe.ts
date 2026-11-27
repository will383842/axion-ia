/**
 * Lecture défensive de `outputJsonRaw.equipe` (journal de l'équipe éditoriale, PR 12).
 * Champ facultatif : absent pour tout job du chemin d'avant. Lecture seule, aucune action.
 */

export interface EntreeJournalLue {
  readonly role: string;
  readonly decision: string;
  readonly dureeMs: number;
  readonly coutUsd: number;
  readonly passe: number;
  readonly detail?: string;
}

export interface JournalEquipeLu {
  readonly issue: string;
  readonly raison?: string;
  readonly renvois: number;
  readonly coutTotalUsd: number;
  readonly plafondUsd: number;
  readonly entrees: ReadonlyArray<EntreeJournalLue>;
}

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const nombre = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const texte = (v: unknown): string => (typeof v === "string" ? v : "");

export function lireJournalEquipe(outputJsonRaw: unknown): JournalEquipeLu | null {
  if (!estObjet(outputJsonRaw)) return null;
  const e = outputJsonRaw["equipe"];
  if (!estObjet(e) || !Array.isArray(e["entrees"])) return null;
  const entrees: EntreeJournalLue[] = [];
  for (const x of e["entrees"]) {
    if (!estObjet(x)) continue;
    const detail = texte(x["detail"]);
    entrees.push({
      role: texte(x["role"]),
      decision: texte(x["decision"]),
      dureeMs: nombre(x["dureeMs"]),
      coutUsd: nombre(x["coutUsd"]),
      passe: nombre(x["passe"]),
      ...(detail ? { detail } : {}),
    });
  }
  const raison = texte(e["raison"]);
  return {
    issue: texte(e["issue"]),
    ...(raison ? { raison } : {}),
    renvois: nombre(e["renvois"]),
    coutTotalUsd: nombre(e["coutTotalUsd"]),
    plafondUsd: nombre(e["plafondUsd"]),
    entrees,
  };
}

export const LIBELLES_ROLES: Readonly<Record<string, string>> = {
  strateg: "Stratège (brief)",
  gardien: "Gardien",
  "verificateur-a": "Vérificateur (phase A)",
  "plan-redaction": "Plan et rédaction",
  "verificateur-b": "Vérificateur (phase B)",
  mailleur: "Mailleur",
  "editeur-seo": "Éditeur SEO",
  conformite: "Conformité",
  "redacteur-en-chef": "Rédacteur en chef",
};
