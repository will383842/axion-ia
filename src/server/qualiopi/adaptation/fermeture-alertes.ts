/**
 * Fermeture des alertes d'adaptation dès que la RÉPONSE est consignée (ind. 10).
 *
 * Appelée par l'unique écrivain de `Enrollment.adaptationsRealisees`
 * (`setEnrollmentAdaptationsAction`), juste après l'écriture. Sans elle :
 *
 *   · `adaptation_reponse_non_consignee` resterait ouverte jusqu'au balayage de
 *     la nuit, sur un dossier déjà en règle ;
 *   · `besoin_adaptation_declare`, née d'un geste et jamais relue par le
 *     balayage, ne se fermerait qu'à la main — c'est-à-dire, en pratique, sans
 *     que rien ne dise ce qui avait été répondu.
 *
 * 🔑 L'alerte du GESTE vise la personne (`Trainee`), pas une inscription. Elle
 * ne se ferme que si AUCUNE autre inscription de la personne ne porte encore un
 * besoin sans réponse, sur le même périmètre que la règle balayée : fermer sur
 * la première consignation laisserait la seconde session sans aucun signal.
 *
 * Module séparé d'`alertes-service.ts`, qui importe l'évaluateur entier : une
 * Server Action n'a pas à tirer trente règles pour fermer deux lignes.
 */

import { prisma } from "@/lib/prisma";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { STATUTS_SESSION_SANS_PREUVE } from "@/server/qualiopi/conformite/piece-admissible";
import {
  CODE_ALERTE_BESOIN_DECLARE,
  CODE_ALERTE_REPONSE_NON_CONSIGNEE,
  FENETRE_REPONSE_ADAPTATION_APRES_FIN_JOURS,
  besoinAdaptationDeclare,
  whereBesoinAdaptationDeclare,
} from "./reponse-organisme";

export interface FermetureAlertesAdaptation {
  /** Alertes « réponse non consignée » fermées pour cette inscription. */
  readonly reponseNonConsignee: number;
  /** Alertes « besoin déclaré » (geste) fermées pour la personne. */
  readonly besoinDeclare: number;
}

export async function fermerAlertesAdaptationConsignee(input: {
  enrollmentId: string;
  traineeId: string;
  now?: Date;
}): Promise<FermetureAlertesAdaptation> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { reponseNonConsignee: 0, besoinDeclare: 0 };
  }
  const now = input.now ?? new Date();
  const resolution = { resolue: true, resolueAt: now };

  const { count: reponseNonConsignee } = await prisma.alerteSysteme.updateMany({
    where: {
      code: CODE_ALERTE_REPONSE_NON_CONSIGNEE,
      resolue: false,
      cibleId: input.enrollmentId,
    },
    data: resolution,
  });

  // Reste-t-il, pour la personne, une AUTRE inscription à besoin sans réponse ?
  const borne = new Date(
    now.getTime() - FENETRE_REPONSE_ADAPTATION_APRES_FIN_JOURS * 24 * 60 * 60 * 1000,
  );
  const autres = await prisma.enrollment.findMany({
    where: {
      traineeId: input.traineeId,
      id: { not: input.enrollmentId },
      adaptationsRealisees: null,
      ...inscriptionsActives(),
      session: { statut: { notIn: STATUTS_SESSION_SANS_PREUVE }, dateFin: { gte: borne } },
      ...whereBesoinAdaptationDeclare(),
    },
    select: {
      trainee: { select: { situationHandicap: true } },
      questionnaires: {
        where: { type: "positionnement", reponduAt: { not: null } },
        select: { reponses: true },
      },
    },
  });
  const resteEnAttente = autres.some((e) =>
    besoinAdaptationDeclare({
      situationHandicap: e.trainee.situationHandicap,
      reponsesPositionnements: e.questionnaires.map((q) => q.reponses),
    }),
  );
  if (resteEnAttente) return { reponseNonConsignee, besoinDeclare: 0 };

  const { count: besoinDeclare } = await prisma.alerteSysteme.updateMany({
    where: { code: CODE_ALERTE_BESOIN_DECLARE, resolue: false, cibleId: input.traineeId },
    data: resolution,
  });
  return { reponseNonConsignee, besoinDeclare };
}
