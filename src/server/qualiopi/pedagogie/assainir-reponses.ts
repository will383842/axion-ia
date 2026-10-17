/**
 * Lot L08 — assainit les réponses d'un questionnaire v2 reçues du portail.
 * Module PUR.
 *
 * L'action du portail acceptait un objet libre (`z.record(z.unknown())`). Pour un
 * questionnaire dont le contenu est versionné, on ne garde que ce que ce contenu
 * déclare, dans les bornes de chaque type de question : ce qui est stocké est ce
 * qui peut être relu question par question. `noteGlobale` n'est pas ici : c'est
 * une colonne, validée à part.
 */

import { contenuDeLaVersion, type TypeQuestionnaire } from "./questionnaire-contenu";

const TEXTE_MAX = 2000;
const OBJECTIFS_MAX = 50;
const LIBELLE_OBJECTIF_MAX = 300;

/** `null` : version inconnue — l'appelant garde le comportement historique. */
export function assainirReponses(
  type: TypeQuestionnaire,
  version: number,
  brut: unknown,
): Record<string, unknown> | null {
  const contenu = contenuDeLaVersion(type, version);
  if (contenu === null) return null;
  const r =
    brut !== null && typeof brut === "object" && !Array.isArray(brut)
      ? (brut as Record<string, unknown>)
      : {};
  const sortie: Record<string, unknown> = {};

  for (const q of contenu.questions) {
    const v = r[q.id];
    switch (q.type) {
      case "note_globale":
        break;
      case "note5":
        if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5) sortie[q.id] = v;
        break;
      case "texte":
        if (typeof v === "string" && v.trim() !== "") sortie[q.id] = v.trim().slice(0, TEXTE_MAX);
        break;
      case "oui_non":
        if (typeof v === "boolean") sortie[q.id] = v;
        break;
      case "choix":
        if (typeof v === "string" && q.choix.includes(v)) sortie[q.id] = v;
        break;
      case "acquis_objectifs": {
        if (v === null || typeof v !== "object" || Array.isArray(v)) break;
        const acquis: Record<string, number> = {};
        for (const [objectif, niveau] of Object.entries(v as Record<string, unknown>)) {
          if (Object.keys(acquis).length >= OBJECTIFS_MAX) break;
          if (
            objectif.length > 0 &&
            objectif.length <= LIBELLE_OBJECTIF_MAX &&
            typeof niveau === "number" &&
            Number.isInteger(niveau) &&
            niveau >= 1 &&
            niveau <= 3
          ) {
            acquis[objectif] = niveau;
          }
        }
        if (Object.keys(acquis).length > 0) sortie[q.id] = acquis;
        break;
      }
    }
  }
  return sortie;
}
