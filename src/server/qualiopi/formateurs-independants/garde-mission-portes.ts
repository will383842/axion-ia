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
  manqueVigilanceMission,
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
import { lireMontantMissionHtCents, type MissionEnJeu } from "./montant-mission-lecture";
import { lireCumulHonorairesHtCents } from "./vigilance-seuil-lecture";

export type { MissionEnJeu } from "./montant-mission-lecture";

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
 * L'interrupteur `formateurs.garde_mission_portes`, lu ICI et pas par
 * `interrupteurAllume` : celui-ci rend « coupé » sur toute erreur, et une panne de la
 * base passagère ne doit pas laisser passer une affectation alors que la garde est
 * allumée. Ligne ABSENTE = coupée (comportement d'avant L3) ; lecture en ÉCHEC = refus
 * (rendu tel quel).
 */
async function lireAllumage(): Promise<ControleGardeMission | "allumee"> {
  try {
    const ligne = await prisma.setting.findUnique({
      where: { key: cleSettingSignature("garde_mission_portes") },
      select: { value: true },
    });
    if (!lireValeurSignature(ligne?.value).valeur) return COUPEE;
    return "allumee";
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
}

/**
 * La garde de mission pour CE formateur, aujourd'hui. Ne lève jamais : allumée,
 * une erreur de lecture rend un refus.
 *
 * Étape 3 (C4) — `enJeu` : la mission dont on décide. Son montant (calcul de la
 * lettre, sur-estimé dans le doute) s'ajoute au cumul pour le seuil de vigilance :
 * l'attestation est exigée AVANT une mission qui fait atteindre 5 000 € HT. Absent :
 * le cumul seul, comme avant.
 */
export async function controlerGardeMission(
  trainerId: string,
  maintenant: Date = new Date(),
  enJeu?: MissionEnJeu,
): Promise<ControleGardeMission> {
  const allumage = await lireAllumage();
  if (allumage !== "allumee") return allumage;
  try {
    const [niveau, t, contrat, cumul, montantMission] = await Promise.all([
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
      enJeu === undefined ? undefined : lireMontantMissionHtCents(trainerId, enJeu),
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
        ...(enJeu === undefined ? {} : { montantMissionHtCents: montantMission ?? null }),
      },
      GABARIT_VERSIONS.contrat_sous_traitance,
      maintenant,
    );
    return { mode, ...appliquerGarde(mode, verdict) };
  } catch {
    return { mode: "refuser", refus: [MANQUES_MISSION.erreur], avertissements: [] };
  }
}

/**
 * Étape 3 (C4) — à l'ÉMISSION DE LA LETTRE : la seule question de l'attestation URSSAF,
 * avec le montant que la lettre annonce. Même interrupteur et même mode que la garde de
 * mission (coupée : rien n'est lu, rien n'est refusé). Ne lève jamais.
 *
 * Les autres conditions de la garde (registre, contrat, NDA…) restent celles des portes
 * d'affectation et du moteur : la lettre n'en ajoute pas.
 */
export async function controlerVigilanceLettre(
  trainerId: string,
  montantLettreHtCents: number,
  maintenant: Date = new Date(),
): Promise<ControleGardeMission> {
  const allumage = await lireAllumage();
  if (allumage !== "allumee") return allumage;
  try {
    const [niveau, t, cumul] = await Promise.all([
      lireNiveau(),
      prisma.trainer.findUnique({
        where: { id: trainerId },
        select: {
          statut: true,
          activationValideeSource: true,
          documents: {
            where: { type: "attestation_vigilance_urssaf", statutValidation: "valide" },
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
      lireCumulHonorairesHtCents(trainerId),
    ]);
    if (t === null) return { mode: "refuser", refus: [MANQUES_MISSION.erreur], avertissements: [] };
    if (t.statut === "salarie" || t.statut === "dirigeant") return COUPEE;
    const mode = modeGardeMission(true, niveau, t.activationValideeSource);
    const manque = manqueVigilanceMission(
      {
        pieces: t.documents as DocumentConformite[],
        cumulHonorairesHtCents: cumul,
        montantMissionHtCents: montantLettreHtCents,
      },
      maintenant,
    );
    return {
      mode,
      ...appliquerGarde(mode, manque === null ? { ok: true } : { ok: false, manques: [manque] }),
    };
  } catch {
    return { mode: "refuser", refus: [MANQUES_MISSION.erreur], avertissements: [] };
  }
}
