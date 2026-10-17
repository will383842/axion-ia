/**
 * Garde de mission AUX PORTES (lot L3) — lecture des faits et verdict.
 *
 * Module NEUTRE (Prisma seulement, ni `server-only` ni Next) : appelé par les
 * actions de la console ET par `mission-formateur.ts`, que le worker charge.
 *
 * 🔑 Interrupteur `formateurs.garde_mission_portes` coupé (ou illisible) : rien
 * n'est lu, rien n'est refusé — exactement le comportement d'avant L3.
 * Allumé : la garde ÉCHOUE FERMÉE (une lecture impossible refuse).
 *
 * 🔴 Qualiopi ind. 27 — un sous-traitant SUSPENDU au registre (écart majeur d'un
 * contrôle, non levé) est refusé dès que `formateurs.registre_sous_traitants` est
 * allumé, portes de la garde allumées ou non, et jamais en simple avertissement : une
 * suspension est une décision, levée en console par une décision motivée.
 */

import { prisma } from "@/lib/prisma";
import type { DocumentConformite } from "@/server/qualiopi/trainers/conformite";
import { GABARIT_VERSIONS } from "@/server/qualiopi/documents/templates/gabarit-versions";

import { lireContratCadreSigne } from "./contrat-cadre-en-vigueur";
import { lireManqueHabilitationMission } from "./evaluation-competences/garde-mission-q21-lecture";
import { interrupteurAllume } from "./interrupteur-allume";
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
import { lireEngagementHtCents, type MissionEnJeu } from "./montant-mission-lecture";
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
 * Ind. 27 — le refus pour suspension au registre, ou `null`. Interrupteur du registre
 * coupé : rien n'est lu. Allumé, une lecture en échec refuse.
 */
async function refusSuspensionRegistre(trainerId: string): Promise<string | null> {
  if (!(await interrupteurAllume("registre_sous_traitants"))) return null;
  // Un client sans la table (doublure de test d'une autre suite) n'est pas une panne.
  if (
    typeof (prisma as { suspensionSousTraitant?: { findFirst?: unknown } }).suspensionSousTraitant
      ?.findFirst !== "function"
  ) {
    return null;
  }
  try {
    const s = await prisma.suspensionSousTraitant.findFirst({
      where: { leveeAt: null, registre: { trainerId } },
      select: { suspenduAt: true },
    });
    return s === null ? null : MANQUES_MISSION.suspenduRegistre;
  } catch {
    return MANQUES_MISSION.erreur;
  }
}

/**
 * La garde de mission pour CE formateur, aujourd'hui. Ne lève jamais : allumée,
 * une erreur de lecture rend un refus.
 *
 * Étape 3 (C4) — `enJeu` : la mission dont on décide. Son montant (calcul de la
 * lettre, sur-estimé dans le doute), net de ce qui en est déjà facturé, et celui des
 * autres missions ouvertes du formateur s'ajoutent au cumul pour le seuil de vigilance
 * (`lireEngagementHtCents`) : l'attestation est exigée AVANT une mission qui fait
 * atteindre 5 000 € HT. Absent : le cumul seul, comme avant.
 */
export async function controlerGardeMission(
  trainerId: string,
  maintenant: Date = new Date(),
  enJeu?: MissionEnJeu,
): Promise<ControleGardeMission> {
  // La garde d'avant L3 lit son interrupteur la première : son ordre ne change pas.
  const [garde, suspension] = await Promise.all([
    controlerPortes(trainerId, maintenant, enJeu),
    refusSuspensionRegistre(trainerId),
  ]);
  if (suspension === null) return garde;
  return {
    mode: "refuser",
    refus: [...new Set([suspension, ...garde.refus, ...garde.avertissements])],
    avertissements: [],
  };
}

async function controlerPortes(
  trainerId: string,
  maintenant: Date,
  enJeu: MissionEnJeu | undefined,
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
          siret: true,
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
      enJeu === undefined ? undefined : lireEngagementHtCents(trainerId, enJeu, maintenant),
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
        siret: t.siret,
        contratCadreSiret: contrat?.siret ?? null,
        cumulHonorairesHtCents: cumul,
        ...(enJeu === undefined ? {} : { montantMissionHtCents: montantMission ?? null }),
      },
      GABARIT_VERSIONS.contrat_sous_traitance,
      maintenant,
    );
    // Qualiopi ind. 21 — la décision d'habilitation de la formation en jeu (indépendants
    // seulement : rien n'est lu pour un salarié ou le dirigeant).
    const manqueHabilitation =
      t.statut === "salarie" || t.statut === "dirigeant"
        ? null
        : await lireManqueHabilitationMission(trainerId, t.statut, enJeu);
    const verdictComplet =
      manqueHabilitation === null
        ? verdict
        : {
            ok: false as const,
            manques: [...(verdict.ok ? [] : verdict.manques), manqueHabilitation],
          };
    return { mode, ...appliquerGarde(mode, verdictComplet) };
  } catch {
    return { mode: "refuser", refus: [MANQUES_MISSION.erreur], avertissements: [] };
  }
}
