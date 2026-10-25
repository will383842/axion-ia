/**
 * Le suivi du questionnaire avant audit CÔTÉ CONSOLE et page publique (2026-10-26).
 *
 * Ce module n'envoie RIEN : il écrit ce que Will a décidé (relances demandées, date et lieu de
 * l'audit, arrêt, demande d'essai) et le lit pour l'afficher. Seul le worker
 * (`suivi.ts`, balayage) envoie, en lisant ces lignes.
 *
 * Écrivains (cliquet `aucun-envoi-automatique.spec.ts`) : `noterEnvoi` (après le clic
 * « Envoyer »), `demanderEssai` (« M'envoyer un essai »), `arreterRelances` (bouton de la
 * console, ou lien « Ne plus recevoir de rappel » du destinataire, par POST seulement).
 * Rien n'est jamais supprimé.
 */

import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "../../../prisma/generated/client";

import { NATURES_RELANCE } from "./suivi";

type Base = Pick<PrismaClient, "questionnaireAvantAuditSuivi" | "questionnaireAvantAuditCourrier">;

export const LIEU_MAX = 80;

/** Les essais que Will peut demander depuis la console (le worker les envoie à l'adresse d'essai). */
export const ESSAIS_POSSIBLES = [
  "invitation",
  "relance_1",
  "relance_2",
  "relance_3",
  "confirmation_dirigeant",
  "confirmation_collaborateur",
  "telegram_reponse",
] as const;
export type EssaiPossible = (typeof ESSAIS_POSSIBLES)[number];

export interface ChoixSuivi {
  readonly relances: boolean;
  readonly dateAudit: Date | null;
  readonly lieuAudit: string | null;
}

/**
 * Après une mise en file RÉUSSIE de l'invitation (partie ou retenue en corbeille) : le suivi est
 * créé ou mis à jour, et le journal note l'envoi. Un renvoi met à jour la date et le lieu, mais ne
 * rallume JAMAIS des relances déjà arrêtées (par Will, par le destinataire, par une réponse).
 */
export async function noterEnvoi(
  questionnaireId: string,
  choix: ChoixSuivi,
  issue: "envoye" | "retenu_corbeille",
  maintenant: Date = new Date(),
  base: Base = prisma,
): Promise<void> {
  const lieu = choix.lieuAudit?.trim().slice(0, LIEU_MAX) || null;
  const existant = await base.questionnaireAvantAuditSuivi.findUnique({
    where: { questionnaireId },
    select: { id: true, relancesArreteesLe: true },
  });
  if (existant === null) {
    await base.questionnaireAvantAuditSuivi.create({
      data: {
        questionnaireId,
        relancesDemandees: choix.relances,
        dateAudit: choix.dateAudit,
        lieuAudit: lieu,
      },
    });
  } else {
    await base.questionnaireAvantAuditSuivi.update({
      where: { id: existant.id },
      data: {
        dateAudit: choix.dateAudit,
        lieuAudit: lieu,
        ...(existant.relancesArreteesLe === null ? { relancesDemandees: choix.relances } : {}),
      },
    });
  }
  await base.questionnaireAvantAuditCourrier.createMany({
    data: [
      {
        cle: `invitation:${questionnaireId}:${maintenant.getTime()}`,
        questionnaireId,
        nature: "invitation",
        canal: "journal",
        statut: "journal",
        prevuLe: maintenant,
        faitLe: maintenant,
        motif: issue === "envoye" ? "envoyé par Will" : "retenu en corbeille",
      },
    ],
    skipDuplicates: true,
  });
}

/** « M'envoyer un essai » : UNE ligne `prevu` ; le worker l'envoie à l'adresse d'essai seulement. */
export async function demanderEssai(
  questionnaireId: string,
  essaiDe: EssaiPossible,
  maintenant: Date = new Date(),
  base: Base = prisma,
): Promise<void> {
  await base.questionnaireAvantAuditCourrier.createMany({
    data: [
      {
        cle: `essai:${questionnaireId}:${essaiDe}:${maintenant.getTime()}`,
        questionnaireId,
        nature: "essai",
        essaiDe,
        canal: essaiDe.startsWith("telegram_") ? "telegram" : "email",
        statut: "prevu",
        prevuLe: maintenant,
      },
    ],
    skipDuplicates: true,
  });
}

/**
 * Arrêt des relances : par Will (`will`) ou par le destinataire (`desinscription`, POST de la page
 * « Ne plus recevoir de rappel »). Idempotent : un second arrêt ne change rien et rend `false`.
 */
export async function arreterRelances(
  questionnaireId: string,
  motif: "will" | "desinscription",
  maintenant: Date = new Date(),
  base: Base = prisma,
): Promise<boolean> {
  const s = await base.questionnaireAvantAuditSuivi.updateMany({
    where: { questionnaireId, relancesArreteesLe: null },
    data: { relancesArreteesLe: maintenant, relancesArretMotif: motif },
  });
  const r = await base.questionnaireAvantAuditCourrier.updateMany({
    where: { questionnaireId, nature: { in: [...NATURES_RELANCE] }, statut: "prevu" },
    data: { statut: "annule", motif, faitLe: maintenant },
  });
  if (s.count > 0 && r.count > 0) {
    await base.questionnaireAvantAuditCourrier.createMany({
      data: [
        {
          cle: `tg_arret:${questionnaireId}`,
          questionnaireId,
          nature: "telegram_arret",
          canal: "telegram",
          statut: "prevu",
          prevuLe: maintenant,
          motif,
        },
      ],
      skipDuplicates: true,
    });
  }
  return s.count > 0;
}

export interface LigneJournal {
  readonly id: string;
  readonly nature: string;
  readonly essaiDe: string | null;
  readonly statut: string;
  readonly prevuLe: Date;
  readonly faitLe: Date | null;
  readonly motif: string | null;
}

export interface SuiviLisible {
  readonly relancesDemandees: boolean;
  readonly dateAudit: Date | null;
  readonly lieuAudit: string | null;
  readonly premierEnvoiLe: Date | null;
  readonly relancesArreteesLe: Date | null;
  readonly relancesArretMotif: string | null;
  readonly prochaine: Date | null;
  readonly journal: ReadonlyArray<LigneJournal>;
}

/**
 * Le suivi d'un questionnaire pour la console, ou `null` (pas encore envoyé). Tolère la
 * migration absente (`P2021`/`P2022`) : `null`, la fiche s'affiche sans le bloc.
 */
export async function lireSuivi(
  questionnaireId: string,
  base: Base = prisma,
): Promise<SuiviLisible | null> {
  try {
    const s = await base.questionnaireAvantAuditSuivi.findUnique({
      where: { questionnaireId },
      select: {
        relancesDemandees: true,
        dateAudit: true,
        lieuAudit: true,
        premierEnvoiLe: true,
        relancesArreteesLe: true,
        relancesArretMotif: true,
      },
    });
    if (s === null) return null;
    const journal = await base.questionnaireAvantAuditCourrier.findMany({
      where: { questionnaireId },
      orderBy: { prevuLe: "asc" },
      take: 200,
      select: {
        id: true,
        nature: true,
        essaiDe: true,
        statut: true,
        prevuLe: true,
        faitLe: true,
        motif: true,
      },
    });
    const prochaine =
      journal.find(
        (c) => (NATURES_RELANCE as readonly string[]).includes(c.nature) && c.statut === "prevu",
      )?.prevuLe ?? null;
    return { ...s, prochaine, journal };
  } catch (e) {
    const code = (e as { code?: unknown } | null)?.code;
    if (code === "P2021" || code === "P2022") return null;
    throw e;
  }
}
