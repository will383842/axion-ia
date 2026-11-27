/**
 * `evaluerPorte` : calcule le verdict (§ 5). Module PUR : aucune E/S, aucune
 * horloge, aucune variable d'environnement. Squelette Q2, branché nulle part.
 */

import { calculerNote } from "./note";
import { CRITERES, IDS_BLOQUANTS_PREVUS } from "./registre";
import { VERSION_PORTE } from "./reglages";
import type {
  ContenuPorte,
  ContextePorte,
  Critere,
  MotifRefus,
  ResultatBrut,
  ResultatCritere,
  VerdictFinal,
  VerdictPorte,
} from "./types";

/** Échec fermé : une erreur dans un critère ne le fait jamais passer. */
function lancer(c: Critere, contenu: ContenuPorte, x: ContextePorte): ResultatBrut {
  try {
    return c.evaluer(contenu, x, x.reglages);
  } catch (e) {
    return {
      statut: "non_evalue",
      raison: `Le contrôle a échoué (${e instanceof Error ? e.message : "erreur inconnue"}).`,
      preuves: [],
    };
  }
}

export function evaluerPorte(
  contenu: ContenuPorte,
  contexte: ContextePorte,
  registre: ReadonlyArray<Critere> = CRITERES,
): VerdictPorte {
  const criteres: ResultatCritere[] = registre.map((c) => ({
    id: c.id,
    classe: c.classe,
    ...lancer(c, contenu, contexte),
  }));

  const motifs: MotifRefus[] = criteres
    .filter((r): r is ResultatCritere & { statut: "echec" | "non_evalue" } => r.statut !== "ok")
    .map((r) => ({
      id: r.id,
      classe: r.classe,
      statut: r.statut,
      raison: r.raison ?? "Critère non satisfait.",
    }));

  const note = calculerNote(contexte.penalites);
  const { seuilPublication, seuilBloque } = contexte.reglages;

  let verdict: VerdictFinal;
  if (motifs.some((m) => m.classe === "dur" || m.statut === "non_evalue") || note < seuilBloque) {
    verdict = "bloque";
  } else if (motifs.length > 0 || note < seuilPublication) {
    verdict = "a_corriger";
  } else {
    verdict = "publiable";
  }

  const presents = new Set(registre.map((c) => c.id));
  return {
    versionPorte: VERSION_PORTE,
    verdict,
    note,
    criteres,
    motifs,
    criteresAbsents: IDS_BLOQUANTS_PREVUS.filter((id) => !presents.has(id)),
    seuilsFiges: contexte.reglages,
  };
}
