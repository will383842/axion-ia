/**
 * Chantier QNC, L03 — la VUE du recueil sur la fiche de la session.
 *
 * `lireVueRecueil` lit ; `resumer` (PURE) décide de ce que l'écran montre,
 * notamment la bannière ROUGE de dérogation : elle s'affiche tant que la
 * dérogation est ce qui ouvre l'envoi de la convention.
 */

import { prisma } from "@/lib/prisma";
import { estActifPour, lireInterrupteurQualiopi } from "@/server/qualiopi/socle/interrupteurs";

import { ACTION_ANALYSE_VALIDEE, LOT_RECUEIL, MODELE_RECUEIL_BESOIN } from "./constantes";
import { decider, lireEtatRecueil, type Decision } from "./garde-convention";

export interface VueRecueil {
  readonly sessionId: string;
  readonly projet: { readonly id: string; readonly titre: string } | null;
  readonly projetsCandidats: ReadonlyArray<{ readonly id: string; readonly titre: string }>;
  readonly questionnaire: {
    readonly id: string;
    readonly version: number;
    readonly statut: string;
    readonly reponseRecueLe: Date | null;
    readonly valideLe: Date | null;
  } | null;
  readonly decision: Decision;
}

export interface ResumeRecueil {
  readonly derogationRouge: { readonly motif: string; readonly accordeeLe: Date } | null;
  readonly peutEnvoyer: boolean;
  readonly peutValider: boolean;
  readonly peutRattacher: boolean;
  readonly peutDeroger: boolean;
  readonly bloque: boolean;
}

/** Pure. */
export function resumer(v: VueRecueil): ResumeRecueil {
  const q = v.questionnaire;
  return {
    derogationRouge:
      v.decision.autorise && v.decision.voie === "derogation"
        ? { motif: v.decision.motif, accordeeLe: v.decision.accordeeLe }
        : null,
    peutEnvoyer: q === null && v.projet !== null,
    peutValider: q !== null && q.statut === "reponse_recue" && q.valideLe === null,
    peutRattacher: v.projet === null && v.projetsCandidats.length > 0,
    peutDeroger: !v.decision.autorise,
    bloque: !v.decision.autorise,
  };
}

/** `null` : le recueil est éteint pour cette session (l'écran ne montre rien). */
export async function lireVueRecueil(sessionId: string): Promise<VueRecueil | null> {
  const interrupteur = await lireInterrupteurQualiopi(LOT_RECUEIL);
  if (interrupteur === "eteint") return null;
  const etat = await lireEtatRecueil(sessionId);
  if (etat === null || !estActifPour(interrupteur, { estTestInterne: etat.sessionEstTest })) {
    return null;
  }
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { clientId: true, projet: { select: { id: true, titre: true } } },
  });
  if (session === null) return null;
  const projetsCandidats =
    session.projet === null && session.clientId !== null
      ? await prisma.projet.findMany({
          where: { clientId: session.clientId, statut: "ouvert", fusionneDansId: null },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, titre: true },
        })
      : [];
  let questionnaire: VueRecueil["questionnaire"] = null;
  if (etat.projetId !== null) {
    const q = await prisma.questionnaireCadrage.findFirst({
      where: { projetId: etat.projetId, modele: MODELE_RECUEIL_BESOIN },
      orderBy: { version: "desc" },
      select: { id: true, version: true, statut: true, reponseRecueLe: true },
    });
    if (q !== null) {
      const validation = await prisma.activityLog.findFirst({
        where: {
          action: ACTION_ANALYSE_VALIDEE,
          targetType: "QuestionnaireCadrage",
          targetId: q.id,
        },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      questionnaire = { ...q, valideLe: validation?.createdAt ?? null };
    }
  }
  return {
    sessionId,
    projet: session.projet,
    projetsCandidats,
    questionnaire,
    decision: decider(etat),
  };
}
