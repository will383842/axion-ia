/**
 * Chantier QNC, lot L04 — après la formation : « les aménagements vous ont-ils
 * été utiles ? ». Posée dans le questionnaire à chaud, aux seuls stagiaires dont
 * l'inscription porte des aménagements consignés ; un « non » ouvre un examen
 * (`adaptation_utilite_a_examiner`).
 *
 * La réponse (oui / non) est rangée dans la réponse du questionnaire, datée par
 * `reponduAt`. Elle ne dit rien de la nature du besoin.
 *
 * ⚠️ Atteint par la Server Action du portail et par le chargement de l'espace :
 * aucun import Next ni `server-only`.
 */

import { prisma } from "@/lib/prisma";
import { creerOuDedup } from "@/server/qualiopi/alertes/alertes-service";
import type { EtatInterrupteur } from "@/server/qualiopi/socle/interrupteurs";
import { CODE_ALERTE_UTILITE, construireAlerteUtilite } from "./alertes-adaptation";
import { adaptationAutomatiquePourInscription } from "./portee";
import { questionUtiliteApplicable } from "./utilite-question";

export {
  CLE_AMENAGEMENTS_UTILES,
  MESSAGE_UTILITE_SANS_REPONSE,
  questionUtiliteApplicable,
} from "./utilite-question";

export async function questionUtiliteDuePourInscription(
  enrollmentId: string,
  etat?: EtatInterrupteur,
): Promise<boolean> {
  if (!(await adaptationAutomatiquePourInscription(enrollmentId, etat))) return false;
  const ins = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { adaptationsRealisees: true },
  });
  return ins !== null && questionUtiliteApplicable(ins.adaptationsRealisees);
}

/** Un « non » : l'examen s'ouvre au guichet qualité. */
export async function signalerAmenagementsNonUtiles(
  enrollmentId: string,
  reponduLe: Date,
): Promise<void> {
  const ins = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      trainee: { select: { prenom: true, nom: true } },
      session: { select: { numero: true, dateDebut: true } },
    },
  });
  if (ins === null) return;
  const a = construireAlerteUtilite({
    prenom: ins.trainee.prenom,
    nom: ins.trainee.nom,
    sessionNumero: ins.session.numero,
    dateDebut: ins.session.dateDebut,
    reponduLe,
  });
  await creerOuDedup({
    code: CODE_ALERTE_UTILITE,
    niveau: "important",
    titre: a.titre,
    message: a.message,
    cibleType: "Enrollment",
    cibleId: enrollmentId,
  });
}
