/**
 * Alerte `avis_financeur_manquant` — lot 8B, décision du dirigeant (b).
 *
 * L'indicateur 30 attend l'appréciation des différentes parties. Celle de l'entreprise
 * est recueillie seule (enquête à J+30) ; celle du FINANCEUR reste saisie à la main en
 * console (« Appréciations »), et rien ne disait qu'elle manquait (étude #1519). Cette
 * alerte le dit, une fois par session.
 *
 *   - seulement pour une session qu'un TIERS finance (OPCO, CPF, France Travail,
 *     mixte), lu par inscription comme le payeur effectif (`financementTypeEffectif`) :
 *     un seul participant financé par un tiers suffit ;
 *   - à J+30 après la fin, comme l'enquête « entreprise » ; sessions finies depuis
 *     120 jours au plus (même borne que `suivi_froid_manquant`) ;
 *   - couverte par un avis « financeur » saisi sur une inscription de la session, ou
 *     pour son client depuis le début de la session ;
 *   - se referme seule dès que l'avis est saisi.
 */

import { prisma } from "@/lib/prisma";
import { financementTypeEffectif } from "@/server/qualiopi/financements/inter-entreprises";
import type { AlerteNiveau } from "../../../../prisma/generated/client";
import type { AlerteCandidate } from "./evaluateur";

export const DELAI_AVIS_FINANCEUR_JOURS = 30;
export const BORNE_BASSE_AVIS_FINANCEUR_JOURS = 120;
const JOUR_MS = 24 * 60 * 60 * 1000;
const FINANCEMENTS_TIERS: ReadonlySet<string> = new Set(["opco", "cpf", "france_travail", "mixte"]);

export async function regleAvisFinanceurManquant(now: Date): Promise<AlerteCandidate[]> {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: "realisee",
      dateFin: {
        gte: new Date(now.getTime() - BORNE_BASSE_AVIS_FINANCEUR_JOURS * JOUR_MS),
        lte: new Date(now.getTime() - DELAI_AVIS_FINANCEUR_JOURS * JOUR_MS),
      },
    },
    select: {
      id: true,
      numero: true,
      clientId: true,
      dateDebut: true,
      financementType: true,
      enrollments: { select: { id: true, financementType: true } },
    },
  });
  const financees = sessions.filter((s) =>
    s.enrollments.some((e) =>
      FINANCEMENTS_TIERS.has(financementTypeEffectif(e.financementType, s.financementType) ?? ""),
    ),
  );
  if (financees.length === 0) return [];
  const clients = [...new Set(financees.map((s) => s.clientId).filter((c) => c !== null))];
  const avis = await prisma.appreciation.findMany({
    where: {
      source: "financeur",
      OR: [
        { enrollmentId: { in: financees.flatMap((s) => s.enrollments.map((e) => e.id)) } },
        ...(clients.length > 0 ? [{ clientId: { in: clients } }] : []),
      ],
    },
    select: { enrollmentId: true, clientId: true, dateAppreciation: true },
  });
  return financees
    .filter(
      (s) =>
        !avis.some(
          (a) =>
            (a.enrollmentId !== null && s.enrollments.some((e) => e.id === a.enrollmentId)) ||
            (s.clientId !== null &&
              a.clientId === s.clientId &&
              a.dateAppreciation.getTime() >= s.dateDebut.getTime()),
        ),
    )
    .map((s) => ({
      code: "avis_financeur_manquant",
      niveau: "important" as AlerteNiveau,
      titre: "Avis du financeur non recueilli",
      message:
        `Aucun avis du financeur n'est enregistré pour la session ${s.numero}, ` +
        `${DELAI_AVIS_FINANCEUR_JOURS} jours après sa fin (indicateur 30). Recueillez-le auprès ` +
        "du financeur, puis saisissez-le dans « Appréciations » (qualité « Financeur »), " +
        "avec le client de la session (c'est lui qui rattache l'avis à l'indicateur 30) et " +
        "une inscription de la session. Cette alerte se referme dès que l'avis est saisi, et " +
        `au plus tard ${BORNE_BASSE_AVIS_FINANCEUR_JOURS} jours après la fin de la session.`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    }));
}
