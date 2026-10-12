/**
 * Lettre de mission v2 (lot S5) — lecture des faits et émission de la pièce.
 *
 * Appelée par `genererLettreMissionAction` seulement quand l'interrupteur
 * `formateurs.lettre_v2` est allumé ET que le formateur est indépendant.
 * Coupé, le générateur historique (v1) tourne exactement comme avant.
 *
 * 🔑 UNE LETTRE VIVANTE PAR MISSION. La nouvelle lettre est liée à la mission
 * (`MissionFormateur.lettreMissionId`). Une ancienne lettre NON signée par le
 * formateur est annulée par le système (motif `remplacee`) avant l'émission de
 * la nouvelle ; une lettre déjà signée n'est jamais annulée en silence : la
 * rectification exige un motif (`rectificationMotif`), et l'ancienne reste au
 * registre, marquée remplacée par le service de génération.
 */

import React from "react";

import { prisma } from "@/lib/prisma";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { formatLieu } from "@/server/qualiopi/lieu/format-lieu";
import { LIEU_DOCUMENT_SELECT } from "@/server/qualiopi/lieu/resolve-lieu-document";
import { LettreMissionV2Pdf } from "@/server/qualiopi/documents/templates/lettre-mission-v2";
import { lireContratCadreSigne } from "@/server/qualiopi/formateurs-independants/contrat-cadre-en-vigueur";
import {
  assemblerLettreV2,
  type FaitsLettreV2,
} from "@/server/qualiopi/formateurs-independants/lettre-mission-v2-donnees";

/** Motif système d'annulation d'une lettre remplacée avant toute signature. */
export const MOTIF_LETTRE_REMPLACEE = "Remplacée par une nouvelle lettre de mission";
/** Motif système : la lettre d'un formateur ÉCARTÉ de la session, jamais signée. */
export const MOTIF_CHANGEMENT_FORMATEUR = "Formateur remplacé sur cette session";

export type ResultatLettreV2 =
  | { ok: true; documentId: string; numero: string; lettreAnnuleeId: string | null }
  | { ok: false; erreur: string };

export async function genererLettreMissionV2(input: {
  sessionId: string;
  trainerId: string;
  /**
   * La mission à laquelle lier la lettre (moteur L11c). Absente : la plus
   * récemment sollicitée du couple, comme avant. Présente, elle DOIT être celle
   * de ce couple session/formateur, sinon rien n'est émis.
   */
  missionId?: string;
  rectificationMotif?: string;
  /**
   * Motif système posé sur l'ancienne lettre NON signée qu'elle remplace (L11e :
   * `dates_modifiees`). Absent : « remplacée », comme avant.
   */
  motifAnnulation?: string;
  maintenant?: Date;
}): Promise<ResultatLettreV2> {
  const maintenant = input.maintenant ?? new Date();
  const [
    session,
    trainer,
    mission,
    contratCadre,
    lettresVivantes,
    affectation,
    conditionEnAttente,
  ] = await Promise.all([
    prisma.trainingSession.findUnique({
      where: { id: input.sessionId },
      select: {
        numero: true,
        titreSession: true,
        nbParticipantsPrevus: true,
        ...LIEU_DOCUMENT_SELECT,
        client: { select: { raisonSociale: true } },
        jours: { select: { date: true, heureDebut: true, heureFin: true } },
      },
    }),
    prisma.trainer.findUnique({
      where: { id: input.trainerId },
      select: {
        prenom: true,
        nom: true,
        statut: true,
        siret: true,
        sousTraitantNda: true,
        regimeTvaHonoraires: true,
        mandatAutofacturationSigneAt: true,
        mandatAutofacturationRevoqueAt: true,
        organismeSousTraitantId: true,
      },
    }),
    prisma.missionFormateur.findFirst({
      where: {
        sessionId: input.sessionId,
        trainerId: input.trainerId,
        ...(input.missionId !== undefined ? { id: input.missionId } : {}),
      },
      orderBy: { solliciteAt: "desc" },
      select: {
        id: true,
        statut: true,
        reponduAt: true,
        accordHorsOutilAt: true,
        tarifHtCents: true,
        forfaitDeplacementParJourHtCents: true,
        regimeTvaFige: true,
      },
    }),
    lireContratCadreSigne(input.trainerId),
    // Toutes les lettres VIVANTES de ce formateur sur cette session, v1 comprise :
    // le lien `lettreMissionId` n'existe que depuis la v2.
    prisma.documentGenere.findMany({
      where: {
        type: "lettre_mission",
        sessionId: input.sessionId,
        trainerId: input.trainerId,
        annuleeAt: null,
      },
      select: {
        id: true,
        signatures: { where: { revokedAt: null, partie: "formateur" }, select: { id: true } },
      },
    }),
    // Tarif figé à l'AFFECTATION : repli quand la mission ne porte pas encore le sien.
    prisma.sessionFormateur.findUnique({
      where: { sessionId_trainerId: { sessionId: input.sessionId, trainerId: input.trainerId } },
      select: { tarifHtCents: true },
    }),
    prisma.documentGenere.count({
      where: {
        sessionId: input.sessionId,
        conditionSuspensiveOpco: true,
        etatConditionSuspensive: "en_attente",
        annuleeAt: null,
      },
    }),
  ]);
  if (session === null) return { ok: false, erreur: "Session introuvable" };
  if (trainer === null) return { ok: false, erreur: "Formateur introuvable" };
  // Une lettre n'est jamais liée à la mission d'un autre couple.
  if (input.missionId !== undefined && mission === null) {
    return { ok: false, erreur: "Mission introuvable pour cette session et ce formateur" };
  }

  const faits = (numero: string): FaitsLettreV2 => ({
    numero,
    trainer: {
      prenom: trainer.prenom,
      nom: trainer.nom,
      statut: trainer.statut,
      siret: trainer.siret,
      nda: trainer.sousTraitantNda,
      regimeTvaHonoraires: trainer.regimeTvaHonoraires,
      mandatAutofacturationSigneAt: trainer.mandatAutofacturationSigneAt,
      mandatAutofacturationRevoqueAt: trainer.mandatAutofacturationRevoqueAt,
      organismeSousTraitantId: trainer.organismeSousTraitantId,
    },
    contratCadre,
    mission:
      mission === null
        ? null
        : { ...mission, tarifHtCents: mission.tarifHtCents ?? affectation?.tarifHtCents ?? null },
    session: {
      titre: session.titreSession,
      numero: session.numero,
      client: session.client?.raisonSociale ?? "—",
      stagiaires: session.nbParticipantsPrevus,
      financeurEnAttente: conditionEnAttente > 0,
      lieu: formatLieu(session) ?? "lieu communiqué par Axion",
      distanciel: session.lieuType === "distanciel",
      jours: session.jours,
    },
    dateMission: maintenant,
  });

  // Les refus se disent AVANT d'allouer un numéro.
  const essai = assemblerLettreV2(faits("—"));
  if (!essai.ok) return { ok: false, erreur: essai.motif };

  // Une lettre vivante par mission : une lettre déjà signée par le formateur
  // n'est jamais remplacée en silence (motif exigé) ; les autres sont annulées
  // APRÈS l'émission de la nouvelle, jamais avant (un rendu en échec ne laisse
  // pas la mission sans lettre).
  if (
    lettresVivantes.some((l) => l.signatures.length > 0) &&
    input.rectificationMotif === undefined
  ) {
    return {
      ok: false,
      erreur:
        "La lettre en vigueur est déjà signée par le formateur : indiquez le motif de la rectification.",
    };
  }
  const aAnnuler = lettresVivantes.filter((l) => l.signatures.length === 0).map((l) => l.id);

  const identite = await getOrganismeIdentite();
  const doc = await generateDocument({
    type: "lettre_mission",
    ...(input.rectificationMotif !== undefined
      ? { rectificationMotif: input.rectificationMotif }
      : {}),
    buildElement: (numero) => {
      const a = assemblerLettreV2(faits(numero));
      // Mêmes faits qu'à l'essai : ne peut pas refuser ici.
      if (!a.ok) throw new Error(a.motif);
      return React.createElement(LettreMissionV2Pdf, { data: a.data, identite });
    },
    refs: { sessionId: input.sessionId, trainerId: input.trainerId },
    gabaritVersion: 2,
    // L'original de SA mission, jamais un duplicata : la seule autre lettre
    // vivante possible est déjà signée, et la rectification la désigne.
    ...(input.rectificationMotif === undefined ? { estCopie: false } : {}),
  });

  if (mission !== null) {
    await prisma.missionFormateur.update({
      where: { id: mission.id },
      data: { lettreMissionId: doc.id },
    });
  }
  let lettreAnnuleeId: string | null = null;
  if (aAnnuler.length > 0) {
    const r = await prisma.documentGenere.updateMany({
      where: { id: { in: aAnnuler }, annuleeAt: null },
      data: {
        annuleeAt: maintenant,
        annuleeMotif: input.motifAnnulation ?? MOTIF_LETTRE_REMPLACEE,
        annuleePar: "system",
      },
    });
    if (r.count > 0) lettreAnnuleeId = aAnnuler[0] ?? null;
  }
  // La lettre d'un formateur ÉCARTÉ de cette session, qu'il n'a pas signée,
  // cesse de circuler. Une lettre signée par l'écarté reste au registre : c'est
  // à Will de décider (révocation motivée).
  await prisma.documentGenere.updateMany({
    where: {
      type: "lettre_mission",
      sessionId: input.sessionId,
      trainerId: { not: input.trainerId },
      annuleeAt: null,
      signatures: { none: { revokedAt: null, partie: "formateur" } },
    },
    data: { annuleeAt: maintenant, annuleeMotif: MOTIF_CHANGEMENT_FORMATEUR, annuleePar: "system" },
  });
  return { ok: true, documentId: doc.id, numero: doc.numero, lettreAnnuleeId };
}
