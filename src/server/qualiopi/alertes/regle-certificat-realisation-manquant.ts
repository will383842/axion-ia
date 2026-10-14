/**
 * Alerte `certificat_realisation_manquant` — lot 8B, décision du dirigeant (a).
 *
 * Le certificat de réalisation (R.6313-3) est la pièce que le financeur exige pour
 * payer ; jusqu'ici, s'il manquait, rien ne le disait (étude « qui fait quoi à la fin
 * d'une session », #1519). Il est désormais créé seul chaque matin
 * (`documents/certificat-auto.ts`) ; cette alerte signale celui que la garde a refusé
 * (taux de présence non mesuré, aucune trace d'émargement) ou qui a été annulé sans
 * être remplacé.
 *
 * Mêmes bornes que l'émission : 🔴 éteinte avec l'interrupteur
 * `formateurs.certificat_realisation_auto` ; jamais rétroactive (sessions finies
 * depuis l'allumage) ; 90 jours au plus. J+3 après la fin : la session passe
 * « réalisée » à J+1 (clôture automatique) et l'émission tourne chaque matin — deux
 * passages avant d'alerter. Se referme seule dès qu'un certificat vivant existe.
 */

import { prisma } from "@/lib/prisma";
import {
  FENETRE_CERTIFICAT_AUTO_JOURS,
  lireDebutCertificatAuto,
} from "@/server/qualiopi/documents/certificat-auto-allumage";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import type { AlerteNiveau } from "../../../../prisma/generated/client";
import type { AlerteCandidate } from "./evaluateur";

export const DELAI_ALERTE_CERTIFICAT_JOURS = 3;
const JOUR_MS = 24 * 60 * 60 * 1000;

export async function regleCertificatRealisationManquant(now: Date): Promise<AlerteCandidate[]> {
  const debut = await lireDebutCertificatAuto(prisma);
  if (debut === null) return [];
  const borne = new Date(
    Math.max(debut.getTime(), now.getTime() - FENETRE_CERTIFICAT_AUTO_JOURS * JOUR_MS),
  );
  const inscrits = await prisma.enrollment.findMany({
    where: {
      ...inscriptionsActives(),
      session: {
        statut: "realisee",
        dateFin: {
          gte: borne,
          lte: new Date(now.getTime() - DELAI_ALERTE_CERTIFICAT_JOURS * JOUR_MS),
        },
      },
    },
    select: {
      id: true,
      traineeId: true,
      sessionId: true,
      trainee: { select: { prenom: true, nom: true } },
      session: { select: { numero: true } },
    },
  });
  if (inscrits.length === 0) return [];
  // Un certificat VIVANT (non annulé) : une rectification en remplace un autre.
  const vivants = await prisma.documentGenere.findMany({
    where: {
      type: "certificat_realisation",
      annuleeAt: null,
      sessionId: { in: [...new Set(inscrits.map((e) => e.sessionId))] },
      traineeId: { in: [...new Set(inscrits.map((e) => e.traineeId))] },
    },
    select: { sessionId: true, traineeId: true },
  });
  const presents = new Set(vivants.map((p) => `${p.sessionId}:${p.traineeId}`));
  return inscrits
    .filter((e) => !presents.has(`${e.sessionId}:${e.traineeId}`))
    .map((e) => ({
      code: "certificat_realisation_manquant",
      niveau: "important" as AlerteNiveau,
      titre: "Certificat de réalisation manquant",
      message:
        `Le certificat de réalisation de ${e.trainee.prenom} ${e.trainee.nom} (session ${e.session.numero}) ` +
        `n'existe pas ${DELAI_ALERTE_CERTIFICAT_JOURS} jours après la fin de la formation : le financeur ` +
        "l'exige pour payer. Générez-le depuis les documents de la session ; le bouton dit ce " +
        "qui manque (taux de présence non calculé, aucune signature d'émargement).",
      cibleType: "Enrollment",
      cibleId: e.id,
    }));
}
