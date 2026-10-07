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
import type { Prisma } from "../../../../prisma/generated/client";

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

// ─────────────────────────────────────────────────────────────────────────────
// INT-T81-A — le BLOCAGE de la convocation et de l'émargement
// ─────────────────────────────────────────────────────────────────────────────
//
// Tant que la condition d'une convention de la session est `en_attente`, ni la
// convocation ni l'émargement n'ont lieu. Le jugement est ICI, côté serveur,
// relu en base à chaque acte : l'écran n'est qu'un reflet.
//
// ÉCHEC FERMÉ : un état illisible, inconnu ou NULL, ou une lecture qui lève,
// bloquent. Rien ne passe « faute de savoir ».
//
// LA LEVÉE n'est pas une transition de la clause : la condition reste
// `en_attente`. C'est une ligne de journal (`activity_logs`), UNIQUE par
// convention, écrite sous verrou de la ligne `documents_generes` : une seconde
// levée est refusée, rien ne se réécrit. Pas de colonne, donc pas de migration.

/** Action du journal qui EST la levée (la lecture du blocage la cherche par là). */
export const ACTION_LEVEE_BLOCAGE = "qualiopi.convention.condition_suspensive.levee_blocage";

/** Motifs de levée — FERMÉS : jamais un texte libre. */
export const MOTIFS_LEVEE_BLOCAGE = ["renonciation_ecrite_client"] as const;
export type MotifLeveeBlocage = (typeof MOTIFS_LEVEE_BLOCAGE)[number];

/** Client Prisma ou transaction : la garde se relit dans la transaction de l'acte. */
export type ClientLecture = Pick<Prisma.TransactionClient, "documentGenere" | "activityLog">;

export type MotifBlocage = "condition_en_attente" | "condition_illisible" | "convention_caduque";

export type BlocageSession =
  | { readonly bloque: false }
  | {
      readonly bloque: true;
      readonly motif: MotifBlocage;
      /** Numéros des conventions qui bloquent (aucune donnée de stagiaire). */
      readonly numeros: readonly string[];
    };

/**
 * La session est-elle bloquée ? Ne lève JAMAIS : une lecture qui échoue rend
 * `condition_illisible` (échec fermé).
 *
 * Deux règles de la juriste (axion-apporteurs #782, 6034164704, art. 1304-4) :
 *   - une convention `en_attente` bloque, sauf levée journalisée ;
 *   - une convention `caduque` ne fonde AUCUNE convocation ni émargement : elle
 *     est IGNORÉE si une AUTRE convention non annulée et non caduque couvre la
 *     session (sans condition, `active`, ou `en_attente` dont le blocage est
 *     levé) ; sinon la session est BLOQUÉE (`convention_caduque`).
 * Une levée ne vaut que pour une convention `en_attente` : sur une convention
 * devenue caduque, elle ne couvre plus rien.
 */
export async function blocageConditionSuspensive(
  sessionId: string,
  client: ClientLecture = prisma,
): Promise<BlocageSession> {
  try {
    const conventions = await client.documentGenere.findMany({
      where: {
        sessionId,
        type: { in: ["convention", "convention_tripartite"] },
        annuleeAt: null,
      },
      select: {
        id: true,
        numero: true,
        conditionSuspensiveOpco: true,
        etatConditionSuspensive: true,
      },
    });
    const sousCondition = conventions.filter((c) => c.conditionSuspensiveOpco);
    if (sousCondition.length === 0) return { bloque: false };

    // Ni accomplie ni défaillie : en attente, NULL ou inconnu (échec fermé).
    const ouvertes = sousCondition.filter(
      (c) => c.etatConditionSuspensive !== "active" && c.etatConditionSuspensive !== "caduque",
    );
    let leveesIds = new Set<string | null>();
    if (ouvertes.length > 0) {
      const levees = await client.activityLog.findMany({
        where: {
          action: ACTION_LEVEE_BLOCAGE,
          targetType: "DocumentGenere",
          targetId: { in: ouvertes.map((c) => c.id) },
        },
        select: { targetId: true },
      });
      leveesIds = new Set(levees.map((l) => l.targetId));
    }
    const bloquantes = ouvertes.filter((c) => !leveesIds.has(c.id));
    if (bloquantes.length > 0) {
      const illisible = bloquantes.some((c) => c.etatConditionSuspensive !== "en_attente");
      return {
        bloque: true,
        motif: illisible ? "condition_illisible" : "condition_en_attente",
        numeros: bloquantes.map((c) => c.numero),
      };
    }

    const caduques = sousCondition.filter((c) => c.etatConditionSuspensive === "caduque");
    if (caduques.length === 0) return { bloque: false };

    // Ici, toute convention sous condition est `active`, `caduque` ou levée.
    const couvrante = conventions.some(
      (c) =>
        !c.conditionSuspensiveOpco || c.etatConditionSuspensive === "active" || leveesIds.has(c.id),
    );
    if (couvrante) return { bloque: false };
    return { bloque: true, motif: "convention_caduque", numeros: caduques.map((c) => c.numero) };
  } catch {
    return { bloque: true, motif: "condition_illisible", numeros: [] };
  }
}

/** Refus NOMMÉS : ce que l'appelant reconnaît, jamais une erreur anonyme. */
export const REFUS_CONDITION_SUSPENSIVE = "condition_suspensive_en_attente" as const;
export const REFUS_CONVENTION_CADUQUE = "convention_caduque" as const;
export type RefusBlocage = typeof REFUS_CONDITION_SUSPENSIVE | typeof REFUS_CONVENTION_CADUQUE;

/** Le refus nommé d'un blocage : la caducité a le sien, tout le reste (attente, illisible) l'autre. */
export function refusDuBlocage(blocage: Extract<BlocageSession, { bloque: true }>): RefusBlocage {
  return blocage.motif === "convention_caduque"
    ? REFUS_CONVENTION_CADUQUE
    : REFUS_CONDITION_SUSPENSIVE;
}

/**
 * Message vu du STAGIAIRE ou du formateur (page publique, poste du formateur) :
 * neutre, il ne dit rien de l'OPCO ni de la clause.
 */
export const MESSAGE_REFUS_CONDITION_SUSPENSIVE =
  "L'émargement de cette session n'est pas encore ouvert. L'organisme reviendra vers vous.";

/** Message vu de l'ADMINISTRATION (console) : il dit la cause et le remède. */
export const MESSAGE_REFUS_CONDITION_SUSPENSIVE_ADMIN =
  "La convention de cette session est sous condition suspensive : l'accord de l'OPCO n'est pas encore constaté. La convocation et l'émargement sont suspendus jusqu'à cet accord, ou jusqu'à une levée explicite par un administrateur.";

export const MESSAGE_REFUS_CONVENTION_CADUQUE_ADMIN =
  "La convention de cette session est caduque : sa condition suspensive a défailli. Elle ne fonde ni convocation ni émargement ; une nouvelle convention est nécessaire.";

/** Le message de console d'un blocage. */
export function messageAdminDuBlocage(blocage: Extract<BlocageSession, { bloque: true }>): string {
  return blocage.motif === "convention_caduque"
    ? MESSAGE_REFUS_CONVENTION_CADUQUE_ADMIN
    : MESSAGE_REFUS_CONDITION_SUSPENSIVE_ADMIN;
}

export class ConditionSuspensiveEnAttenteError extends Error {
  readonly code: RefusBlocage;
  constructor(readonly blocage: Extract<BlocageSession, { bloque: true }>) {
    super(messageAdminDuBlocage(blocage));
    this.name = "ConditionSuspensiveEnAttenteError";
    this.code = refusDuBlocage(blocage);
  }
}

/** Lève `ConditionSuspensiveEnAttenteError` si la session est bloquée. */
export async function exigerConditionLevee(
  sessionId: string,
  client: ClientLecture = prisma,
): Promise<void> {
  const blocage = await blocageConditionSuspensive(sessionId, client);
  if (blocage.bloque) throw new ConditionSuspensiveEnAttenteError(blocage);
}

export type ResultatLevee =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly raison: "introuvable" | "pas_en_attente" | "deja_levee" | "journal_incoherent";
    };

/**
 * Lève le blocage d'UNE convention, une seule fois, et le journalise dans la
 * même transaction. Le rôle est jugé par l'ACTION, pas ici ; ce service refuse
 * seulement ce que la base ne permet pas.
 */
export async function leverBlocage(params: {
  documentId: string;
  journal: LigneJournal;
}): Promise<ResultatLevee> {
  const j = params.journal as { action?: unknown; targetId?: unknown };
  if (j.action !== ACTION_LEVEE_BLOCAGE || j.targetId !== params.documentId) {
    return { ok: false, raison: "journal_incoherent" };
  }
  return prisma.$transaction(async (tx) => {
    // Verrou de la ligne : deux levées simultanées se sérialisent, la seconde
    // voit la première.
    await tx.$queryRaw`SELECT id FROM documents_generes WHERE id = ${params.documentId}::uuid FOR UPDATE`;
    const doc = await tx.documentGenere.findUnique({
      where: { id: params.documentId },
      select: {
        type: true,
        annuleeAt: true,
        conditionSuspensiveOpco: true,
        etatConditionSuspensive: true,
      },
    });
    if (
      !doc ||
      (doc.type !== "convention" && doc.type !== "convention_tripartite") ||
      !doc.conditionSuspensiveOpco
    ) {
      return { ok: false, raison: "introuvable" } as const;
    }
    if (doc.annuleeAt !== null || doc.etatConditionSuspensive !== "en_attente") {
      return { ok: false, raison: "pas_en_attente" } as const;
    }
    const deja = await tx.activityLog.count({
      where: {
        action: ACTION_LEVEE_BLOCAGE,
        targetType: "DocumentGenere",
        targetId: params.documentId,
      },
    });
    if (deja > 0) return { ok: false, raison: "deja_levee" } as const;
    await tx.activityLog.create({ data: params.journal });
    return { ok: true } as const;
  });
}
