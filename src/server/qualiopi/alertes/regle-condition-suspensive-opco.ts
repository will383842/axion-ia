/**
 * Alerte `condition_suspensive_opco` (INT-T65-A).
 *
 * Une convention générée sous la condition suspensive de l'accord de l'OPCO
 * (clause de la juriste, axion-apporteurs#656 commentaire 5978462914) ne doit
 * pas être oubliée entre sa signature et sa date limite. Branchée sur le
 * mécanisme EXISTANT des alertes Qualiopi (aucune nouvelle file BullMQ) :
 * l'évaluateur la rejoue à chaque passage et elle se referme quand sa cause
 * disparaît.
 *
 * Trois situations, une seule alerte par session (la plus grave) :
 *
 *   1. **garde-fou — aucune exécution avant l'accord** (point 5 de la clause :
 *      « Aucune action n'est exécutée avant l'accomplissement de la condition
 *      ou la renonciation du Client ») : la session commence dans moins de
 *      sept jours, ou a commencé, alors que la condition est toujours en
 *      attente → CRITIQUE ;
 *   2. **à constater** : un accord écrit, un refus ou la date limite a décidé,
 *      mais l'état n'a pas été constaté à la console → IMPORTANT ;
 *   3. **rappel J-7** : la date limite (jour civil de Paris) est dans sept
 *      jours ou moins et rien n'a décidé → IMPORTANT.
 *
 * Aucune donnée personnelle dans le texte : numéros de session et de pièce,
 * date limite.
 */

import { prisma } from "@/lib/prisma";
import { evenementsDepuisDossiers } from "@/server/qualiopi/financements/condition-suspensive-service";
import {
  RAPPEL_CONDITION_SUSPENSIVE_JOURS,
  decalerJour,
  evaluerConditionSuspensive,
  jourDeParis,
  libelleJourLimite,
  rappelDu,
  seuilDepuisColonnes,
  type ConditionSuspensive,
} from "@/server/qualiopi/financements/condition-suspensive";
import type { AlerteCandidate } from "./evaluateur";

const PLAFOND_CONVENTIONS = 500;

export interface ConventionSousCondition {
  id: string;
  numero: string;
  clientId: string | null;
  seuilConditionBps: number | null;
  seuilConditionCents: number | null;
  dateLimiteCondition: Date | null;
  metadata: unknown;
  session: {
    id: string;
    numero: string;
    dateDebut: Date;
    dossiersFinancement: {
      clientId: string | null;
      accordEcritLe: Date | null;
      montantAccordeCents: number | null;
      refuseAt: Date | null;
    }[];
  } | null;
}

const RANG = { critique: 3, important: 2, info: 1 } as const;

/** Décision PURE. */
export function candidatsConditionSuspensiveOpco(
  conventions: readonly ConventionSousCondition[],
  now: Date,
): AlerteCandidate[] {
  const parSession = new Map<string, AlerteCandidate>();
  const aujourdhui = jourDeParis(now);

  for (const c of conventions) {
    if (c.session === null || c.dateLimiteCondition === null) continue;
    const seuil = seuilDepuisColonnes(c);
    const prix = (c.metadata as { conditionSuspensiveOpco?: { prixTtcCents?: unknown } } | null)
      ?.conditionSuspensiveOpco?.prixTtcCents;
    if (seuil === null || typeof prix !== "number") continue;

    const condition: ConditionSuspensive = {
      seuil,
      prixTtcCents: prix,
      dateLimite: c.dateLimiteCondition,
      signeeLe: null,
    };
    const evenements = evenementsDepuisDossiers(
      c.session.dossiersFinancement.filter((d) => c.clientId === null || d.clientId === c.clientId),
    );
    const evaluation = evaluerConditionSuspensive(condition, evenements, now);
    const limite = libelleJourLimite(c.dateLimiteCondition);
    const debutProche =
      jourDeParis(c.session.dateDebut) <=
      decalerJour(aujourdhui, RAPPEL_CONDITION_SUSPENSIVE_JOURS);

    let alerte: AlerteCandidate | null = null;
    if (evaluation.etat === "en_attente" && debutProche) {
      alerte = {
        code: "condition_suspensive_opco",
        niveau: "critique",
        titre: "Session sous condition suspensive OPCO non levée",
        message: `La session ${c.session.numero} commence le ${c.session.dateDebut.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })} alors que la convention ${c.numero} attend toujours l'accord de l'OPCO (date limite : ${limite}). Aucune action ne doit être exécutée avant l'accord ou la renonciation écrite du client : reportez la session, ou enregistrez l'accord ou la renonciation.`,
        cibleType: "TrainingSession",
        cibleId: c.session.id,
      };
    } else if (evaluation.etat !== "en_attente") {
      alerte = {
        code: "condition_suspensive_opco",
        niveau: "important",
        titre: "Condition suspensive OPCO à constater",
        message:
          evaluation.etat === "active"
            ? `L'accord écrit de l'OPCO atteint le seuil de la convention ${c.numero} (session ${c.session.numero}) : constatez l'état de la condition dans la section Documents de la session.`
            : `La condition suspensive de la convention ${c.numero} (session ${c.session.numero}) a défailli (date limite : ${limite}) : constatez-la dans la section Documents. La convention est caduque ; un accord ultérieur appelle une nouvelle convention.`,
        cibleType: "TrainingSession",
        cibleId: c.session.id,
      };
    } else if (rappelDu(condition, evenements, now)) {
      alerte = {
        code: "condition_suspensive_opco",
        niveau: "important",
        titre: "Date limite de la condition suspensive OPCO dans 7 jours",
        message: `La convention ${c.numero} (session ${c.session.numero}) est conclue sous la condition de l'accord écrit de l'OPCO au plus tard le ${limite}. Vérifiez avec l'entreprise où en est sa demande, puis saisissez l'accord ou le refus sur le dossier de financement.`,
        cibleType: "TrainingSession",
        cibleId: c.session.id,
      };
    }
    if (alerte === null) continue;
    const deja = parSession.get(c.session.id);
    if (
      !deja ||
      RANG[alerte.niveau as keyof typeof RANG] > RANG[deja.niveau as keyof typeof RANG]
    ) {
      parSession.set(c.session.id, alerte);
    }
  }
  return [...parSession.values()];
}

export async function regleConditionSuspensiveOpco(now: Date): Promise<AlerteCandidate[]> {
  const conventions = await prisma.documentGenere.findMany({
    where: {
      type: { in: ["convention", "convention_tripartite"] },
      conditionSuspensiveOpco: true,
      etatConditionSuspensive: "en_attente",
      annuleeAt: null,
    },
    orderBy: { dateLimiteCondition: "asc" },
    take: PLAFOND_CONVENTIONS,
    select: {
      id: true,
      numero: true,
      clientId: true,
      seuilConditionBps: true,
      seuilConditionCents: true,
      dateLimiteCondition: true,
      metadata: true,
      session: {
        select: {
          id: true,
          numero: true,
          dateDebut: true,
          dossiersFinancement: {
            where: { type: { in: ["opco", "mixte"] } },
            select: {
              clientId: true,
              accordEcritLe: true,
              montantAccordeCents: true,
              refuseAt: true,
            },
          },
        },
      },
    },
  });
  return candidatsConditionSuspensiveOpco(conventions, now);
}
