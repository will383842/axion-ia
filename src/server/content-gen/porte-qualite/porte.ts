/**
 * `evaluerPorte` : calcule le verdict (§ 5). Module PUR : aucune E/S, aucune
 * horloge, aucune variable d'environnement. Squelette Q2, branché nulle part.
 */

import { calculerNote } from "./note";
import { CLASSES_PAR_ID, CRITERES, IDS_BLOQUANTS_PREVUS } from "./registre";
import { ReglagesPorteSchema, VERSION_PORTE } from "./reglages";
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

export interface OptionsPorte {
  readonly registre?: ReadonlyArray<Critere> | undefined;
  /**
   * Bloquants que le verdict exige. Par défaut B01 à B16 (§ 4.1) : tant que le
   * registre est incomplet (squelette Q2), le verdict est `bloque` : un critère prévu
   * mais absent n'a pas été évalué (§ 3, règle 2) et chacun devient un motif `non_evalue`.
   */
  readonly idsAttendus?: ReadonlyArray<string>;
}

/** Entrée publique : registre complet, bloquants B01 à B16 tous exigés. Rien d'autre n'est réglable. */
export function evaluerPorte(contenu: ContenuPorte, contexte: ContextePorte): VerdictPorte {
  return evaluerPorteAvec(contenu, contexte);
}

/**
 * TESTS UNIQUEMENT (volontairement absente de `index.ts`) : permet un registre ou une
 * liste d'attendus réduits. Ne jamais l'appeler depuis le code de production.
 */
export function evaluerPorteAvec(
  contenu: ContenuPorte,
  contexte: ContextePorte,
  options: OptionsPorte = {},
): VerdictPorte {
  const registre = options.registre ?? CRITERES;
  const idsAttendus = options.idsAttendus ?? IDS_BLOQUANTS_PREVUS;

  // Échec fermé : des réglages illisibles (NaN, clé manquante) ne laissent rien passer.
  const lus = ReglagesPorteSchema.safeParse(contexte.reglages);
  if (!lus.success) {
    return {
      versionPorte: VERSION_PORTE,
      verdict: "bloque",
      note: 0,
      criteres: [],
      motifs: [
        {
          id: "REGLAGES",
          classe: "dur",
          statut: "non_evalue",
          raison: "Réglages de la porte illisibles : aucun contenu ne peut être évalué.",
        },
      ],
      criteresAbsents: idsAttendus.filter((id) => !registre.some((c) => c.id === id)),
      // Réglages bruts tels que reçus : ce sont eux qui ont été refusés, pas des valeurs par défaut.
      seuilsFiges: contexte.reglages,
    };
  }
  const reglages = lus.data;
  const x: ContextePorte = { ...contexte, reglages };

  const criteres: ResultatCritere[] = registre.map((c) => ({
    id: c.id,
    classe: c.classe,
    ...lancer(c, contenu, x),
  }));

  const presents = new Set(registre.map((c) => c.id));
  const criteresAbsents = idsAttendus.filter((id) => !presents.has(id));

  const motifs: MotifRefus[] = criteres
    .filter((r): r is ResultatCritere & { statut: "echec" | "non_evalue" } => r.statut !== "ok")
    .map((r) => ({
      id: r.id,
      classe: r.classe,
      statut: r.statut,
      raison: r.raison ?? "Critère non satisfait.",
    }));
  // Un bloquant prévu mais absent n'a pas été évalué : non évalué = bloque (§ 3, règle 2),
  // et le refus est enregistré avec son critère (§ 5.1).
  for (const id of criteresAbsents) {
    motifs.push({
      id,
      classe: CLASSES_PAR_ID[id] ?? "dur",
      statut: "non_evalue",
      raison: "Critère pas encore branché : non évalué.",
    });
  }

  const note = calculerNote(x.penalites);
  const { seuilPublication, seuilBloque } = reglages;
  let verdict: VerdictFinal;
  if (motifs.some((m) => m.classe === "dur" || m.statut === "non_evalue") || note < seuilBloque) {
    verdict = "bloque";
  } else if (motifs.length > 0 || note < seuilPublication) {
    verdict = "a_corriger";
  } else {
    verdict = "publiable";
  }

  return {
    versionPorte: VERSION_PORTE,
    verdict,
    note,
    criteres,
    motifs,
    criteresAbsents,
    seuilsFiges: reglages,
  };
}
