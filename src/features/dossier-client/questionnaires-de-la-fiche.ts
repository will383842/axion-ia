/**
 * Ce que la fiche client dit du questionnaire avant audit (lot 1 fiche client, 25/10/2026).
 *
 * Avant : le statut et les réponses n'étaient lisibles que sur la page de CHAQUE rendez-vous
 * (verif/I-trace-fiche.md). Ici : un résumé par questionnaire de la fiche, en lecture seule.
 * Aucune réponse n'est lue ni déchiffrée : seulement des comptes (colonnes en clair `mode`,
 * `recuLe`, `ecarteLe`). Une panne de lecture (migration absente, base de build) rend [] : la
 * fiche s'affiche sans le bloc.
 */

import { prisma } from "@/lib/prisma";
import {
  fichesCouvertes,
  questionnairesDesFiches,
} from "@/features/questionnaire-preaudit/de-la-fiche";
import { suiviActif, type SuiviOuvertures } from "@/features/questionnaire-preaudit/ouvertures";
import { lireSuiviDesQuestionnaires } from "@/features/questionnaire-preaudit/suivi-ouvertures";

export interface QuestionnaireDeLaFiche {
  readonly id: string;
  /** NULL : envoyé SANS rendez-vous (rattaché à la fiche directement). */
  readonly rencontreId: string | null;
  readonly rencontreTitre: string | null;
  readonly rencontreDebut: Date | null;
  readonly creeLe: Date;
  /** NULL = brouillon : rien n'est parti. */
  readonly envoyeLe: Date | null;
  readonly expireLe: Date | null;
  readonly closLe: Date | null;
  readonly reponses: {
    readonly dirigeant: number;
    readonly referentInformatique: number;
    readonly collaborateurs: number;
    /** Réponses reçues après la dernière lecture de Will (ou jamais lues). */
    readonly aTraiter: number;
  };
  /** La copie de l'invitation dans « E-mails envoyés » (la plus récente), si elle existe. */
  readonly invitationEmailLogId: string | null;
  readonly invitationStatut: string | null;
  /**
   * Ouvertures du lien et brouillons en cours (2026-10-27). `null` : les deux interrupteurs du
   * suivi sont éteints, ou la lecture a échoué (`suiviEnPanne`) — jamais lu comme « jamais ouvert ».
   */
  readonly suivi?: SuiviOuvertures | null;
  readonly suiviEnPanne?: boolean;
}

export async function lireQuestionnairesDeLaFiche(
  clientId: string,
): Promise<ReadonlyArray<QuestionnaireDeLaFiche>> {
  try {
    const qs = await prisma.questionnaireAvantAudit.findMany({
      where: questionnairesDesFiches(await fichesCouvertes(clientId)),
      orderBy: { creeLe: "desc" },
      take: 20,
      select: {
        id: true,
        creeLe: true,
        envoyeLe: true,
        luLe: true,
        expireLe: true,
        closLe: true,
        rencontre: { select: { id: true, titre: true, debutPrevu: true } },
        envois: { where: { ecarteLe: null }, select: { mode: true, recuLe: true } },
      },
    });
    if (qs.length === 0) return [];
    const logs = await prisma.emailLog.findMany({
      where: {
        template: "questionnaire-avant-audit",
        entityType: "QuestionnaireAvantAudit",
        entityId: { in: qs.map((q) => q.id) },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, entityId: true, status: true },
    });
    // Le suivi des ouvertures a sa PROPRE garde : sa panne (table pas encore migrée) n'efface
    // pas le bloc, elle se dit.
    let suivis: ReadonlyMap<string, SuiviOuvertures> | null = null;
    let suiviEnPanne = false;
    if (suiviActif()) {
      try {
        suivis = await lireSuiviDesQuestionnaires(
          qs.filter((q) => q.envoyeLe !== null).map((q) => q.id),
        );
      } catch {
        suiviEnPanne = true;
      }
    }
    const dernierLog = new Map<string, { id: string; status: string }>();
    for (const l of logs) {
      if (l.entityId !== null && !dernierLog.has(l.entityId)) {
        dernierLog.set(l.entityId, { id: l.id, status: l.status });
      }
    }
    return qs.map((q): QuestionnaireDeLaFiche => {
      const log = dernierLog.get(q.id) ?? null;
      return {
        id: q.id,
        rencontreId: q.rencontre?.id ?? null,
        rencontreTitre: q.rencontre?.titre ?? null,
        rencontreDebut: q.rencontre?.debutPrevu ?? null,
        creeLe: q.creeLe,
        envoyeLe: q.envoyeLe,
        expireLe: q.expireLe,
        closLe: q.closLe,
        reponses: {
          dirigeant: q.envois.filter((e) => e.mode === "main").length,
          referentInformatique: q.envois.filter((e) => e.mode === "it").length,
          collaborateurs: q.envois.filter((e) => e.mode === "emp").length,
          aTraiter: q.envois.filter((e) => q.luLe === null || e.recuLe > q.luLe).length,
        },
        invitationEmailLogId: log?.id ?? null,
        invitationStatut: log?.status ?? null,
        suivi: suivis?.get(q.id) ?? null,
        suiviEnPanne,
      };
    });
  } catch {
    // Une panne de lecture ne doit jamais empêcher la fiche de s'afficher.
    return [];
  }
}
