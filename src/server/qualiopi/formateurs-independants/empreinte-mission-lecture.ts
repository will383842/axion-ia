/**
 * L'EMPREINTE ACTUELLE d'une mission, lue en base (lot L11c) — extraite de
 * `moteur-mission.ts` pour être partagée, sans la chaîne du moteur (envois,
 * génération), par la garde de signature des lettres périmées (C4).
 *
 * Module neutre (Prisma seulement).
 */

import type { Prisma } from "../../../../prisma/generated/client";

import { journeesDuFormateur } from "./argent/journees-du-formateur";
import { forfaitSelonLieu } from "./choix-formateur";
import { empreinteMission } from "./empreinte-mission";
import { TARIF_JOURNEE_HT_CENTS } from "./lettre-mission-v2-calcul";

/**
 * Version du gabarit passée à l'empreinte, qui ne la hache plus (v2 de l'empreinte). La
 * version RÉELLEMENT émise suit le contrat-cadre signé (`versionLettrePourContrat`).
 */
export const GABARIT_LETTRE = 3;

function dateCivile(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Ce que l'empreinte lit d'une mission (lecture unique, partagée avec le passage). */
export const EMPREINTE_SELECT = {
  role: true,
  trainerId: true,
  tarifHtCents: true,
  forfaitDeplacementParJourHtCents: true,
  regimeTvaFige: true,
  trainer: { select: { regimeTvaHonoraires: true } },
  session: {
    select: {
      titreSession: true,
      lieuType: true,
      modalite: true,
      lieuAdresse: true,
      lieuCodePostal: true,
      lieuVille: true,
      jours: { select: { date: true, heureDebut: true, heureFin: true, trainerId: true } },
      sessionFormateurs: { select: { trainerId: true } },
    },
  },
} as const;

export type MissionPourEmpreinte = Prisma.MissionFormateurGetPayload<{
  select: typeof EMPREINTE_SELECT;
}>;

/**
 * L'empreinte actuelle d'une mission — SEUL calcul, lu par le moteur et par le
 * passage horaire (qui ne réévalue que les missions où elle a changé).
 */
export function empreinteDeLaMission(m: MissionPourEmpreinte): {
  tarifEffectif: number;
  empreinte: string;
} {
  const s = m.session;
  // Jamais le tarif de l'affectation (08 §2.8 : la source des salariés) : le
  // moteur n'émet que sur des conditions figées au choix (cf. `emettreLettre`).
  const tarifEffectif = m.tarifHtCents ?? TARIF_JOURNEE_HT_CENTS;
  const distanciel = s.lieuType === "distanciel";
  return {
    tarifEffectif,
    empreinte: empreinteMission({
      intitule: s.titreSession,
      // Les journées de la LETTRE : celles du formateur (étape 4). Une journée
      // d'un co-formateur ne périme pas sa lettre ; une journée qui lui est
      // retirée, si.
      jours: journeesDuFormateur(s.jours, m.trainerId, s.sessionFormateurs).map((j) => ({
        date: dateCivile(j.date),
        heureDebut: j.heureDebut,
        heureFin: j.heureFin,
      })),
      distanciel,
      adresse: s.lieuAdresse,
      codePostal: s.lieuCodePostal,
      ville: s.lieuVille,
      tarifHtCents: tarifEffectif,
      // La règle de la lettre : à distance, aucun forfait (`forfaitSelonLieu`).
      forfaitDeplacementParJourHtCents: forfaitSelonLieu(m.forfaitDeplacementParJourHtCents, s),
      regimeTva: m.regimeTvaFige ?? m.trainer.regimeTvaHonoraires,
      role: m.role,
      // Hors de l'empreinte depuis v2 : passés pour la forme seulement.
      versionContratCadre: null,
      gabaritVersion: GABARIT_LETTRE,
    }),
  };
}
