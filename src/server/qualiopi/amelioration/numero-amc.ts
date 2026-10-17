/**
 * 🔴 CHANTIER QNC, LOT L10 — le numéro AXI-AMC d'une action d'amélioration.
 *
 * ⚠️ POURQUOI PAS `nextNumero` (ADR 0059), ET CE QUI LE REMPLACE.
 *
 * `nextNumero` exige, par la garde `tout-allocateur-alimente-le-registre-des-
 * numeros.spec.ts`, un déclencheur `numeros_emis` posé PAR MIGRATION sur la
 * table lue. Ce lot n'a pas le droit d'ajouter une migration (la garde du socle
 * L00 exige que la sienne reste la dernière) : c'est un « Besoin de schéma »,
 * déclaré dans la PR.
 *
 * Le défaut que `numeros_emis` ferme — un numéro réémis parce que sa ligne
 * avait été SUPPRIMÉE (2026-09-15) — ne peut pas se produire ici : la table
 * `actions_amelioration` refuse en base UPDATE, DELETE et TRUNCATE (trigger
 * `actions_amelioration_ajout_seul`, socle L00, sans interrupteur). Un numéro
 * émis y reste pour toujours ; la borne haute de la table EST le registre de la
 * série. Patron : la série projet `AXI-PRJ` (`features/dossier-client/creer-projet.ts`),
 * hors des pièces officielles elle aussi.
 *
 * Le jour où la migration est autorisée : poser le déclencheur `numeros_emis`
 * et son backfill, puis remplacer `prochainNumeroAmc` par `nextNumero`.
 */

import { parseSequence, SEQ_PAD_WIDTH } from "@/server/qualiopi/numbering/formats";

export const PREFIXE_AMC = "AXI-AMC" as const;

export const NUMERO_AMC_REGEX = /^AXI-AMC-\d{4}-\d{3,}$/;

export function prefixeSerieAmc(annee: number): string {
  if (!Number.isInteger(annee) || annee < 2000 || annee > 9999) {
    throw new Error(`prefixeSerieAmc: année invalide (${annee})`);
  }
  return `${PREFIXE_AMC}-${annee}-`;
}

export function formatNumeroAmc(annee: number, seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`formatNumeroAmc: séquence invalide (${seq})`);
  }
  return `${prefixeSerieAmc(annee)}${String(seq).padStart(SEQ_PAD_WIDTH, "0")}`;
}

type LecteurAmc = {
  actionAmelioration: {
    findMany(args: {
      where: { numero: { startsWith: string } };
      select: { numero: true };
    }): PromiseLike<ReadonlyArray<{ numero: string }>>;
  };
};

/**
 * Borne haute NUMÉRIQUE de la série de l'année + 1 (un MAX texte serait faux au
 * millième numéro). À appeler dans la transaction qui insère, sous le verrou
 * consultatif de la série.
 */
export async function prochainNumeroAmc(tx: LecteurAmc, annee: number): Promise<string> {
  const prefixe = prefixeSerieAmc(annee);
  const existants = await tx.actionAmelioration.findMany({
    where: { numero: { startsWith: prefixe } },
    select: { numero: true },
  });
  let borne = 0;
  for (const { numero } of existants) {
    const seq = parseSequence(numero, prefixe);
    if (seq !== null && seq > borne) borne = seq;
  }
  return formatNumeroAmc(annee, borne + 1);
}
