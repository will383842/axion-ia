/**
 * INT-T65-A — lecture et transitions de la condition suspensive OPCO d'une
 * convention, contre la base.
 *
 * La DÉCISION est dans `condition-suspensive.ts` (pur) ; ce module lit ce que
 * la décision consomme et écrit ce qu'elle produit :
 *
 *   - les ÉVÉNEMENTS viennent des dossiers de financement OPCO de la session et
 *     du client de la convention : l'accord ÉCRIT (`accordEcritLe`, avec
 *     `montantAccordeCents`) et le refus (`refuseAt`). La renonciation, elle,
 *     n'a pas de source en base : elle est déclarée par l'admin, à l'écran ;
 *   - la TRANSITION n'a lieu que depuis `en_attente` (états fermés) : l'écriture
 *     porte la garde `etatConditionSuspensive = en_attente` dans son `where`, et
 *     la ligne du journal (`activity_logs`) est écrite dans la MÊME transaction
 *     — une transition sans trace n'existe pas.
 */

import { prisma } from "@/lib/prisma";

import {
  debutDuJourDeParis,
  evaluerConditionSuspensive,
  seuilDepuisColonnes,
  transitionAutorisee,
  type ConditionSuspensive,
  type EtatConditionSuspensive,
  type EvaluationConditionSuspensive,
  type EvenementConditionSuspensive,
} from "./condition-suspensive";

/** Dossier de financement tel que la condition le lit. */
export interface DossierPourCondition {
  readonly accordEcritLe: Date | null;
  readonly montantAccordeCents: number | null;
  readonly refuseAt: Date | null;
}

/**
 * Événements de la condition à partir des dossiers de financement.
 *
 * `accordEcritLe` est une DATE (`@db.Date`, minuit UTC du jour saisi) : on la
 * lit comme le jour civil de Paris qu'elle désigne, à 00:00 heure de Paris —
 * un accord daté du jour limite est donc dans le délai, comme le veut la
 * clause. Un accord sans montant n'est pas un accord « au moins égal au
 * seuil » : il n'est pas compté (il ne fait ni accomplir ni défaillir).
 */
export function evenementsDepuisDossiers(
  dossiers: readonly DossierPourCondition[],
): EvenementConditionSuspensive[] {
  const evenements: EvenementConditionSuspensive[] = [];
  for (const d of dossiers) {
    if (d.accordEcritLe !== null && d.montantAccordeCents !== null) {
      evenements.push({
        type: "accord_ecrit",
        le: debutDuJourDeParis(d.accordEcritLe.toISOString().slice(0, 10)),
        montantAccordeCents: d.montantAccordeCents,
      });
    }
    if (d.refuseAt !== null) evenements.push({ type: "refus", le: d.refuseAt });
  }
  return evenements;
}

export interface LectureConditionSuspensive {
  readonly document: {
    readonly id: string;
    readonly numero: string;
    readonly sessionId: string | null;
    readonly clientId: string | null;
    readonly etat: EtatConditionSuspensive;
    readonly annulee: boolean;
  };
  readonly condition: ConditionSuspensive;
  readonly evenements: EvenementConditionSuspensive[];
}

/** Date de signature : la dernière signature non révoquée d'une pièce intégralement signée. */
function dateDeSignature(
  statutSignature: string,
  signatures: readonly { signeAt: Date }[],
): Date | null {
  if (statutSignature !== "signee" || signatures.length === 0) return null;
  return new Date(Math.max(...signatures.map((s) => s.signeAt.getTime())));
}

/**
 * Lit la condition d'une convention. `null` si la pièce n'existe pas, n'est
 * pas une convention, ou ne porte pas de condition.
 */
export async function lireConditionSuspensive(
  documentId: string,
): Promise<LectureConditionSuspensive | null> {
  const doc = await prisma.documentGenere.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      numero: true,
      type: true,
      sessionId: true,
      clientId: true,
      annuleeAt: true,
      metadata: true,
      statutSignature: true,
      conditionSuspensiveOpco: true,
      seuilConditionBps: true,
      seuilConditionCents: true,
      dateLimiteCondition: true,
      etatConditionSuspensive: true,
      signatures: { where: { revokedAt: null }, select: { signeAt: true } },
    },
  });
  if (!doc || (doc.type !== "convention" && doc.type !== "convention_tripartite")) return null;
  if (!doc.conditionSuspensiveOpco) return null;
  const seuil = seuilDepuisColonnes(doc);
  if (seuil === null || doc.dateLimiteCondition === null || doc.etatConditionSuspensive === null) {
    // Impossible sous les CHECK : le dire plutôt que de deviner.
    throw new Error(`[condition-suspensive] colonnes incohérentes sur ${doc.numero}`);
  }
  const meta = doc.metadata as { conditionSuspensiveOpco?: { prixHtCents?: unknown } } | null;
  const prixHtCents = meta?.conditionSuspensiveOpco?.prixHtCents;
  if (typeof prixHtCents !== "number" || !Number.isSafeInteger(prixHtCents)) {
    throw new Error(`[condition-suspensive] prix HT figé absent sur ${doc.numero}`);
  }

  const dossiers =
    doc.sessionId === null
      ? []
      : await prisma.dossierFinancement.findMany({
          where: {
            trainingSessionId: doc.sessionId,
            type: { in: ["opco", "mixte"] },
            ...(doc.clientId !== null ? { clientId: doc.clientId } : {}),
          },
          select: { accordEcritLe: true, montantAccordeCents: true, refuseAt: true },
        });

  return {
    document: {
      id: doc.id,
      numero: doc.numero,
      sessionId: doc.sessionId,
      clientId: doc.clientId,
      etat: doc.etatConditionSuspensive,
      annulee: doc.annuleeAt !== null,
    },
    condition: {
      seuil,
      prixHtCents,
      dateLimite: doc.dateLimiteCondition,
      signeeLe: dateDeSignature(doc.statutSignature, doc.signatures),
    },
    evenements: evenementsDepuisDossiers(dossiers),
  };
}

/** Ligne de journal préparée par l'appelant (`donneesJournalQualiopi`). */
export type LigneJournal = Parameters<typeof prisma.activityLog.create>[0]["data"];

/**
 * Applique la transition `en_attente → vers` et la journalise, ATOMIQUEMENT.
 *
 * Rend `false` si la convention n'était plus en attente au moment d'écrire
 * (course entre deux admins) : rien n'est écrit, pas même le journal.
 */
export async function appliquerTransition(params: {
  documentId: string;
  vers: EtatConditionSuspensive;
  journal: LigneJournal;
}): Promise<boolean> {
  if (!transitionAutorisee("en_attente", params.vers)) {
    throw new Error(`[condition-suspensive] transition interdite en_attente → ${params.vers}`);
  }
  return prisma.$transaction(async (tx) => {
    const r = await tx.documentGenere.updateMany({
      where: {
        id: params.documentId,
        conditionSuspensiveOpco: true,
        etatConditionSuspensive: "en_attente",
      },
      data: { etatConditionSuspensive: params.vers },
    });
    if (r.count !== 1) return false;
    await tx.activityLog.create({ data: params.journal });
    return true;
  });
}

/** Changements journalisés d'une transition (sérialisables). */
export function changementsTransition(
  lecture: LectureConditionSuspensive,
  evaluation: EvaluationConditionSuspensive,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    numero: lecture.document.numero,
    de: lecture.document.etat,
    vers: evaluation.etat,
    cause: evaluation.cause,
    le: evaluation.le?.toISOString() ?? null,
    effetLe: evaluation.effetLe?.toISOString() ?? null,
    ...extra,
  };
}

/** Évalue la condition lue, à l'instant donné. */
export function evaluerLecture(
  lecture: LectureConditionSuspensive,
  maintenant: Date,
  evenementsEnPlus: readonly EvenementConditionSuspensive[] = [],
): EvaluationConditionSuspensive {
  return evaluerConditionSuspensive(
    lecture.condition,
    [...lecture.evenements, ...evenementsEnPlus],
    maintenant,
  );
}
