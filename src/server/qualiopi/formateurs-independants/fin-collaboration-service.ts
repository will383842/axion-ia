/**
 * Fin de collaboration d'un formateur indépendant — le SERVICE (lot L14, E25).
 *
 * Deux temps :
 *   - **la décision** (`deciderFinCollaboration`, console) : date, auteur, motif prévu,
 *     date d'effet et note sont écrits ; les sollicitations en attente sont retirées.
 *     Pendant le préavis, la fiche reste OPÉRATIONNELLE : ses missions acceptées sont
 *     menées à terme (e-mails, signatures, garde de mission inchangés) ;
 *   - **la clôture** (`cloreDansTransaction`), le jour d'effet : `finCollaborationAt`,
 *     motif, auteur, `accesVersion + 1`, contrat-cadre non signé annulé et ses liens non
 *     utilisés révoqués, lettres de mission non signées annulées de même (lot E), journal. Une fin sans préavis est close dans la transaction de la
 *     décision, puis la fiche est désactivée par l'écrivain unique de `actif`
 *     (`activation.ts`, côté application) ; une fin avec préavis est close par le passage
 *     quotidien du worker (`cloreFinsArrivees`), et la fiche close encore active est
 *     signalée sur sa page, avec le bouton qui la désactive (le worker n'importe pas
 *     `activation.ts`, qui passe par le journal de la console).
 *
 * 🔴 AUCUNE SUPPRESSION. Le mandat d'autofacturation n'est pas touché : il survit pour
 * les missions réalisées (décision F4 ; décès : règlement à la main, procédure L18).
 *
 * ⚠️ `deciderFinCollaboration` ne juge ni le rôle ni l'interrupteur : l'action serveur le
 * fait AVANT. Le passage quotidien lit l'interrupteur LUI-MÊME, avant toute requête sur
 * les colonnes du lot (fenêtre app/worker).
 */

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import { retirerSollicitationsDuFormateur } from "@/server/qualiopi/trainers/mission-formateur";

import {
  avecPreavis,
  jourParis,
  preavisJours,
  refusFin,
  type MotifFin,
  type RefusFin,
} from "./fin-collaboration";
import { interrupteurAllume } from "./interrupteur-allume";

export const GABARIT_AVERTISSEMENT = "formateur-avertissement";

export interface ContexteFin {
  readonly trainer: {
    readonly id: string;
    readonly prenom: string;
    readonly email: string;
    readonly statut: string;
    readonly organismeSousTraitantId: string | null;
    readonly finCollaborationAt: Date | null;
    readonly finCollaborationDecideeAt: Date | null;
    readonly finCollaborationMotifPrevu: MotifFin | null;
    readonly finCollaborationEffetAt: Date | null;
  };
  /** Première signature d'un contrat-cadre, sinon la date saisie, sinon la création. */
  readonly debutRelation: Date;
  /** Dernier avertissement F49 effectivement PARTI (statut `sent`), ou `null`. */
  readonly avertissementEnvoyeAt: Date | null;
}

/** Lit ce qu'il faut pour décider. `null` : fiche introuvable. */
export async function lireContexteFin(trainerId: string): Promise<ContexteFin | null> {
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      id: true,
      prenom: true,
      email: true,
      statut: true,
      organismeSousTraitantId: true,
      finCollaborationAt: true,
      finCollaborationDecideeAt: true,
      finCollaborationMotifPrevu: true,
      finCollaborationEffetAt: true,
      sousTraitantContratSigneAt: true,
      createdAt: true,
    },
  });
  if (trainer === null) return null;
  const [contrats, avertissement] = await Promise.all([
    prisma.documentGenere.findMany({
      where: { trainerId, type: "contrat_sous_traitance", statutSignature: "signee" },
      select: {
        signatures: {
          where: { revokedAt: null },
          orderBy: { signeAt: "asc" },
          take: 1,
          select: { signeAt: true },
        },
      },
    }),
    // Seul un envoi REMIS au relais compte : ni `pending` (file arrêtée), ni échec,
    // ni rebond, ni annulation.
    prisma.emailLog.findFirst({
      where: {
        template: GABARIT_AVERTISSEMENT,
        entityType: "Trainer",
        entityId: trainerId,
        status: "sent",
        sentAt: { not: null },
      },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    }),
  ]);
  const signatures = (contrats as Array<{ signatures?: Array<{ signeAt: Date }> }>)
    .flatMap((c) => c.signatures ?? [])
    .map((s) => s.signeAt.getTime());
  const candidats = [
    ...signatures,
    ...(trainer.sousTraitantContratSigneAt ? [trainer.sousTraitantContratSigneAt.getTime()] : []),
  ];
  const debutRelation = new Date(
    candidats.length > 0 ? Math.min(...candidats) : trainer.createdAt.getTime(),
  );
  return {
    trainer: {
      id: trainer.id,
      prenom: trainer.prenom,
      email: trainer.email,
      statut: trainer.statut,
      organismeSousTraitantId: trainer.organismeSousTraitantId,
      finCollaborationAt: trainer.finCollaborationAt,
      finCollaborationDecideeAt: trainer.finCollaborationDecideeAt,
      finCollaborationMotifPrevu: trainer.finCollaborationMotifPrevu as MotifFin | null,
      finCollaborationEffetAt: trainer.finCollaborationEffetAt,
    },
    debutRelation,
    avertissementEnvoyeAt: avertissement?.sentAt ?? null,
  };
}

/** Indépendant en nom propre seulement : ni salarié, ni dirigeant, ni intervenant d'organisme. */
export function estIndependant(t: ContexteFin["trainer"]): boolean {
  return t.statut === "sous_traitant" && t.organismeSousTraitantId === null;
}

/**
 * Missions acceptées, ou affectations, sur une session qui commence à `date` ou après,
 * hors session annulée.
 */
export async function missionsApres(
  trainerId: string,
  date: Date,
): Promise<Array<{ sessionId: string; debut: Date }>> {
  const session = { dateDebut: { gte: date }, statut: { not: "annulee" as const } };
  const [missions, affectations, principales] = await Promise.all([
    prisma.missionFormateur.findMany({
      where: { trainerId, statut: { in: ["acceptee", "accord_hors_outil"] }, session },
      select: { sessionId: true, session: { select: { dateDebut: true } } },
    }),
    prisma.sessionFormateur.findMany({
      where: { trainerId, session },
      select: { sessionId: true, session: { select: { dateDebut: true } } },
    }),
    prisma.trainingSession.findMany({
      where: { formateurPrincipalId: trainerId, ...session },
      select: { id: true, dateDebut: true },
    }),
  ]);
  const parSession = new Map<string, Date>();
  for (const m of [...(missions ?? []), ...(affectations ?? [])]) {
    parSession.set(m.sessionId, m.session.dateDebut);
  }
  for (const s of principales ?? []) parSession.set(s.id, s.dateDebut);
  return [...parSession].map(([sessionId, debut]) => ({ sessionId, debut }));
}

// ── La clôture (commune à la fin immédiate et au passage quotidien) ──────

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

class DejaClose extends Error {}

/**
 * Ferme la fiche dans `tx`. Lève `DejaClose` si une autre écriture l'a déjà fermée
 * (concurrence) : l'appelant annule la transaction.
 */
async function cloreDansTransaction(
  tx: Tx,
  c: {
    readonly trainerId: string;
    readonly motif: MotifFin;
    /** L'administrateur qui a DÉCIDÉ la fin (UUID). */
    readonly parId: string;
    /** L'auteur de la clôture au journal : l'administrateur, ou le système. */
    readonly session: { readonly userId: string } | null;
    readonly annuleePar: string;
    readonly maintenant: Date;
  },
): Promise<void> {
  const fermee = await tx.trainer.updateMany({
    where: { id: c.trainerId, finCollaborationAt: null },
    data: {
      finCollaborationAt: c.maintenant,
      finCollaborationMotif: c.motif,
      finCollaborationParId: c.parId,
      accesVersion: { increment: 1 },
    },
  });
  if (fermee.count === 0) throw new DejaClose();

  const contratsNonSignes = await tx.documentGenere.findMany({
    where: {
      trainerId: c.trainerId,
      type: "contrat_sous_traitance",
      statutSignature: { in: ["en_attente", "partielle"] },
      annuleeAt: null,
    },
    select: { id: true },
  });
  const ids = (contratsNonSignes ?? []).map((d) => d.id);
  if (ids.length > 0) {
    await tx.documentGenere.updateMany({
      where: { id: { in: ids }, annuleeAt: null },
      data: {
        annuleeAt: c.maintenant,
        annuleeMotif: "Fin de collaboration : contrat non signé annulé.",
        annuleePar: c.annuleePar,
      },
    });
    await tx.documentSignatureToken.updateMany({
      where: { documentGenereId: { in: ids }, revokedAt: null, usedAt: null },
      data: {
        revokedAt: c.maintenant,
        revokedMotif: "Fin de collaboration",
        ...(c.session ? { revokedById: c.session.userId } : {}),
      },
    });
  }

  // Lot E (M14) — les lettres de mission que le formateur n'a PAS signées cessent de
  // circuler : annulées (jamais supprimées), leurs liens non utilisés révoqués. Même
  // prédicat que le désistement et la fin de mission : une lettre qui porte sa
  // signature reste au registre (Will décide).
  const nonSignee = { none: { revokedAt: null, partie: "formateur" } } as const;
  const lettresNonSignees = await tx.documentGenere.findMany({
    where: {
      trainerId: c.trainerId,
      type: "lettre_mission",
      annuleeAt: null,
      signatures: nonSignee,
    },
    select: { id: true },
  });
  const lettres = (lettresNonSignees ?? []).map((d) => d.id);
  if (lettres.length > 0) {
    await tx.documentGenere.updateMany({
      where: { id: { in: lettres }, annuleeAt: null, signatures: nonSignee },
      data: {
        annuleeAt: c.maintenant,
        annuleeMotif: "Fin de collaboration : lettre de mission non signée annulée.",
        annuleePar: c.annuleePar,
      },
    });
    await tx.documentSignatureToken.updateMany({
      where: { documentGenereId: { in: lettres }, revokedAt: null, usedAt: null },
      data: {
        revokedAt: c.maintenant,
        revokedMotif: "Fin de collaboration",
        ...(c.session ? { revokedById: c.session.userId } : {}),
      },
    });
  }

  await journaliser(
    tx,
    {
      action: "qualiopi.trainer.fin_collaboration_close",
      targetType: "Trainer",
      targetId: c.trainerId,
      changes: { motif: c.motif, contratsAnnules: ids.length, lettresAnnulees: lettres.length },
      session: c.session,
    },
    { exiger: true },
  );
}

/**
 * Désactive par l'écrivain unique de `actif` (`activation.ts`, CÔTÉ APPLICATION : il
 * passe par le journal de la console). Import PARESSEUX : le passage quotidien du worker
 * n'importe jamais ce module. Rend `false` si la désactivation a échoué.
 */
export async function desactiverApresFin(
  trainerId: string,
  session: AdminSessionFin,
): Promise<boolean> {
  try {
    const { changerActivationFormateur } = await import("./activation");
    const r = await changerActivationFormateur({
      trainerId,
      actif: false,
      acteur: { type: "administrateur", session },
      motif: "Fin de collaboration",
    });
    return r.ok;
  } catch {
    return false;
  }
}

// ── La décision ──────────────────────────────────────────────────────────

export interface AdminSessionFin {
  readonly userId: string;
  readonly role: string;
}

export interface EntreeFin {
  readonly trainerId: string;
  readonly motif: MotifFin;
  readonly dateEffet: Date;
  readonly note: string;
  readonly irreparable: boolean;
  /** L'administrateur qui décide (UUID) et son rôle. */
  readonly userId: string;
  readonly role: string;
  /** Son nom, pour `annuleePar` d'une pièce annulée. */
  readonly annuleePar: string;
}

export type ResultatFin =
  | {
      readonly ok: true;
      readonly preavis: 30 | 60 | 90;
      readonly close: boolean;
      /** Fin immédiate : la désactivation a-t-elle abouti ? (`true` avec préavis.) */
      readonly desactivee: boolean;
      readonly contexte: ContexteFin;
    }
  | { readonly ok: false; readonly raison: "introuvable" | "pas-independant" | "deja-terminee" }
  | {
      readonly ok: false;
      readonly raison: "refus";
      readonly refus: RefusFin[];
      readonly missions: Array<{ sessionId: string; debut: Date }>;
    };

export async function deciderFinCollaboration(
  e: EntreeFin,
  maintenant: Date,
): Promise<ResultatFin> {
  const contexte = await lireContexteFin(e.trainerId);
  if (contexte === null) return { ok: false, raison: "introuvable" };
  if (!estIndependant(contexte.trainer)) return { ok: false, raison: "pas-independant" };
  if (
    contexte.trainer.finCollaborationAt !== null ||
    contexte.trainer.finCollaborationDecideeAt !== null
  ) {
    return { ok: false, raison: "deja-terminee" };
  }

  const missions = await missionsApres(e.trainerId, e.dateEffet);
  const refus = refusFin({
    motif: e.motif,
    dateEffet: e.dateEffet,
    decision: maintenant,
    debutRelation: contexte.debutRelation,
    avertissementEnvoyeAt: contexte.avertissementEnvoyeAt,
    irreparable: e.irreparable,
    note: e.note,
    missionsApresEffet: missions,
  });
  if (refus.length > 0) return { ok: false, raison: "refus", refus, missions };

  const preavis = preavisJours(contexte.debutRelation, maintenant);
  const immediate = !avecPreavis(e.motif);
  const note = e.note.trim();

  try {
    await prisma.$transaction(async (tx) => {
      const decidee = await tx.trainer.updateMany({
        where: { id: e.trainerId, finCollaborationAt: null, finCollaborationDecideeAt: null },
        data: {
          finCollaborationDecideeAt: maintenant,
          finCollaborationDecideeParId: e.userId,
          finCollaborationMotifPrevu: e.motif,
          finCollaborationEffetAt: e.dateEffet,
          finCollaborationNote: note === "" ? null : note,
        },
      });
      if (decidee.count === 0) throw new DejaClose();
      await journaliser(
        tx,
        {
          action: "qualiopi.trainer.fin_collaboration_decidee",
          targetType: "Trainer",
          targetId: e.trainerId,
          changes: {
            motif: e.motif,
            dateEffet: jourParis(e.dateEffet),
            preavisJours: immediate ? 0 : preavis,
            noteSaisie: note !== "",
          },
          session: { userId: e.userId },
        },
        { exiger: true },
      );
      if (immediate) {
        await cloreDansTransaction(tx, {
          trainerId: e.trainerId,
          motif: e.motif,
          parId: e.userId,
          session: { userId: e.userId },
          annuleePar: e.annuleePar,
          maintenant,
        });
      }
    });
  } catch (err) {
    if (err instanceof DejaClose) return { ok: false, raison: "deja-terminee" };
    throw err;
  }

  // Hors transaction, tolérant : la décision est acquise.
  let desactivee = true;
  if (immediate) {
    desactivee = await desactiverApresFin(e.trainerId, { userId: e.userId, role: e.role });
  } else {
    // Plus aucune proposition en attente : seules les missions déjà acceptées avant la
    // date d'effet sont menées à terme.
    await retirerSollicitationsDuFormateur(e.trainerId);
  }
  return { ok: true, preavis, close: immediate, desactivee, contexte };
}

// ── Le passage quotidien ─────────────────────────────────────────────────

export interface BilanCloture {
  readonly etat: "coupe" | "fait";
  readonly closes: number;
  /** Fiches closes qui portaient encore une mission à la date d'effet ou après. */
  readonly avecMissionsApres: number;
  readonly erreurs: number;
}

const PLAFOND_CLOTURES = 200;

/**
 * Clôt les fins avec préavis dont la date d'effet est arrivée (jour de Paris). Ne lève
 * jamais. Interrupteur coupé : AUCUNE requête sur les colonnes du lot. Une fiche close
 * n'est plus proposable (garde de mission, `finCollaborationAt`) et ne reçoit plus que
 * les e-mails d'argent ; sa désactivation (`actif`) est un geste de la console.
 */
export async function cloreFinsArrivees(maintenant: Date): Promise<BilanCloture> {
  const vide = { closes: 0, avecMissionsApres: 0, erreurs: 0 };
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return { etat: "coupe", ...vide };
  if (!(await interrupteurAllume("fin_collaboration"))) return { etat: "coupe", ...vide };

  const aujourdhui = new Date(`${jourParis(maintenant)}T00:00:00Z`);
  let fiches: Array<{
    id: string;
    finCollaborationMotifPrevu: MotifFin | null;
    finCollaborationDecideeParId: string | null;
    finCollaborationEffetAt: Date | null;
  }>;
  try {
    fiches = (await prisma.trainer.findMany({
      where: {
        finCollaborationAt: null,
        finCollaborationDecideeAt: { not: null },
        finCollaborationEffetAt: { lte: aujourdhui },
      },
      select: {
        id: true,
        finCollaborationMotifPrevu: true,
        finCollaborationDecideeParId: true,
        finCollaborationEffetAt: true,
      },
      orderBy: { finCollaborationEffetAt: "asc" },
      take: PLAFOND_CLOTURES,
    })) as typeof fiches;
  } catch {
    return { etat: "fait", ...vide, erreurs: 1 };
  }

  let closes = 0;
  let avecMissionsApres = 0;
  let erreurs = 0;
  for (const f of fiches) {
    if (f.finCollaborationMotifPrevu === null || f.finCollaborationDecideeParId === null) {
      erreurs++;
      continue;
    }
    try {
      if ((await missionsApres(f.id, f.finCollaborationEffetAt ?? aujourdhui)).length > 0) {
        avecMissionsApres++;
      }
      await prisma.$transaction((tx) =>
        cloreDansTransaction(tx, {
          trainerId: f.id,
          motif: f.finCollaborationMotifPrevu as MotifFin,
          parId: f.finCollaborationDecideeParId as string,
          session: null,
          annuleePar: "Système (fin de collaboration à la date d'effet)",
          maintenant,
        }),
      );
      closes++;
    } catch (err) {
      if (!(err instanceof DejaClose)) erreurs++;
    }
  }
  return { etat: "fait", closes, avecMissionsApres, erreurs };
}
