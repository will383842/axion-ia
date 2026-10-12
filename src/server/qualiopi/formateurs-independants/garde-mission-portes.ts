/**
 * Garde de mission AUX PORTES (lot L3) — lecture des faits et verdict.
 *
 * Module NEUTRE (Prisma seulement, ni `server-only` ni Next) : appelé par les
 * actions de la console ET par `mission-formateur.ts`, que le worker charge.
 *
 * 🔑 Interrupteur `formateurs.garde_mission_portes` coupé (ou illisible) : rien
 * n'est lu, rien n'est refusé — exactement le comportement d'avant L3.
 * Allumé : la garde ÉCHOUE FERMÉE (une lecture impossible refuse).
 */

import { prisma } from "@/lib/prisma";
import type { DocumentConformite } from "@/server/qualiopi/trainers/conformite";
import { GABARIT_VERSIONS } from "@/server/qualiopi/documents/templates/gabarit-versions";

import { lireContratCadreSigne } from "./contrat-cadre-en-vigueur";
import {
  AUCUNE_ISSUE,
  MANQUES_MISSION,
  appliquerGarde,
  modeGardeMission,
  peutRecevoirMission,
  type IssueGarde,
  type ModeGardeMission,
} from "./garde-mission";
import { TYPES_PIECES_GARDEES } from "./gardes";
import {
  cleSetting,
  cleSettingSignature,
  lireValeur,
  lireValeurSignature,
  type NiveauGardeMission,
} from "./interrupteurs";
import { lireCumulHonorairesHtCents } from "./vigilance-seuil-lecture";

export interface ControleGardeMission extends IssueGarde {
  readonly mode: ModeGardeMission;
}

const COUPEE: ControleGardeMission = { mode: "coupee", ...AUCUNE_ISSUE };

/** Niveau de `formateurs.garde_mission` : absent ou illisible = « refuser ». */
async function lireNiveau(): Promise<NiveauGardeMission> {
  try {
    const ligne = await prisma.setting.findUnique({
      where: { key: cleSetting("garde_mission") },
      select: { value: true },
    });
    return lireValeur("garde_mission", ligne?.value).valeur;
  } catch {
    return "refuser";
  }
}

/**
 * La garde de mission pour CE formateur, aujourd'hui. Ne lève jamais : allumée,
 * une erreur de lecture rend un refus.
 */
export async function controlerGardeMission(
  trainerId: string,
  maintenant: Date = new Date(),
): Promise<ControleGardeMission> {
  // L'interrupteur est lu ICI, pas par `interrupteurAllume` : celui-ci rend
  // « coupé » sur toute erreur, et une panne de la base passagère ne doit pas
  // laisser passer une affectation alors que la garde est allumée. Ligne
  // ABSENTE = coupée (comportement d'avant L3) ; lecture en ÉCHEC = refus.
  try {
    const ligne = await prisma.setting.findUnique({
      where: { key: cleSettingSignature("garde_mission_portes") },
      select: { value: true },
    });
    if (!lireValeurSignature(ligne?.value).valeur) return COUPEE;
  } catch {
    // Un client sans table `setting` (doublure de test d'une autre suite) n'est
    // pas une panne : on garde le comportement d'avant L3.
    if (
      typeof (prisma as { setting?: { findUnique?: unknown } }).setting?.findUnique !== "function"
    ) {
      return COUPEE;
    }
    return { mode: "refuser", refus: [MANQUES_MISSION.erreur], avertissements: [] };
  }
  try {
    const [niveau, t, contrat, cumul] = await Promise.all([
      lireNiveau(),
      prisma.trainer.findUnique({
        where: { id: trainerId },
        select: {
          statut: true,
          actif: true,
          sousTraitantVerifieAt: true,
          sousTraitantNda: true,
          sousTraitantContratSigneAt: true,
          finCollaborationAt: true,
          activationValideeSource: true,
          documents: {
            where: { type: { in: [...TYPES_PIECES_GARDEES] }, statutValidation: "valide" },
            select: {
              type: true,
              statutValidation: true,
              fichierUrl: true,
              dateEmission: true,
              dateExpiration: true,
            },
          },
        },
      }),
      lireContratCadreSigne(trainerId),
      lireCumulHonorairesHtCents(trainerId),
    ]);
    if (t === null) return { mode: "refuser", refus: [MANQUES_MISSION.erreur], avertissements: [] };
    const mode = modeGardeMission(true, niveau, t.activationValideeSource);
    const verdict = peutRecevoirMission(
      {
        statut: t.statut,
        actif: t.actif,
        sousTraitantVerifieAt: t.sousTraitantVerifieAt,
        sousTraitantNda: t.sousTraitantNda,
        sousTraitantContratSigneAt: t.sousTraitantContratSigneAt,
        finCollaborationAt: t.finCollaborationAt,
        activationValideeSource: t.activationValideeSource,
        pieces: t.documents as DocumentConformite[],
        contratCadreVersion: contrat?.version ?? null,
        cumulHonorairesHtCents: cumul,
      },
      GABARIT_VERSIONS.contrat_sous_traitance,
      maintenant,
    );
    return { mode, ...appliquerGarde(mode, verdict) };
  } catch {
    return { mode: "refuser", refus: [MANQUES_MISSION.erreur], avertissements: [] };
  }
}
