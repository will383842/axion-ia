/**
 * Les DATES du circuit d'adaptation (ind. 10), lues au journal et au positionnement.
 *
 * `Enrollment.adaptationsRealisees` ne porte pas d'horodatage, et une colonne
 * ne se crée pas pour cela : l'unique écrivain de la colonne
 * (`setEnrollmentAdaptationsAction`) journalise chaque geste, sans le texte. Ce
 * lecteur en tire, par inscription, depuis quand la réponse actuelle est
 * consignée, et quand elle a été écrite pour la dernière fois.
 *
 * 🔴 2026-09-15 (relecture #1095) — il lit aussi la DERNIÈRE DÉCLARATION du besoin
 * (`derniereDeclarationPourInscription`) : une réponse antérieure à une nouvelle
 * déclaration ne la couvre pas. C'est ce qui rouvre l'indicateur 10, la colonne
 * de la fiche session, la règle balayée et le dossier d'audit — tous lisent CE
 * lecteur et `etatReponseAdaptation`, jamais une recopie.
 *
 * Deux allers-retours pour toutes les inscriptions demandées, quel qu'en soit le
 * nombre. Aucun contenu lu : des instants et un booléen.
 *
 * ⚠️ Atteint par le WORKER (règle balayée) : aucun import `server-only`, Next ni
 * Server Action ici.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../prisma/generated/client";
import {
  ACTION_JOURNAL_ADAPTATIONS,
  ACTION_JOURNAL_DECLARATION_BESOIN,
  HORODATAGE_CIRCUIT_VIDE,
  besoinAdaptationDeclare,
  debutConsignationCourante,
  derniereConsignation,
  derniereDeclarationPourInscription,
  etatReponseAdaptation,
  whereBesoinAdaptationDeclare,
  type EntreeJournalAdaptation,
  type HorodatageCircuitAdaptation,
} from "./reponse-organisme";

export interface InscriptionPourCircuit {
  readonly id: string;
  readonly traineeId: string;
  /** Fin de la session : une déclaration postérieure ne la concerne pas. */
  readonly finSession: Date | null;
  /** Positionnements RÉPONDUS de l'inscription (réponses brutes + date). */
  readonly positionnements: readonly { reponses: unknown; reponduAt: Date | null }[];
}

export async function lireCircuitAdaptation(
  inscriptions: readonly InscriptionPourCircuit[],
): Promise<ReadonlyMap<string, HorodatageCircuitAdaptation>> {
  const resultat = new Map<string, HorodatageCircuitAdaptation>();
  if (inscriptions.length === 0) return resultat;

  let consignations: { targetId: string | null; createdAt: Date; changes: unknown }[] = [];
  let declarations: { targetId: string | null; createdAt: Date }[] = [];
  if (!process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    [consignations, declarations] = await Promise.all([
      prisma.activityLog.findMany({
        where: {
          action: ACTION_JOURNAL_ADAPTATIONS,
          targetType: "Enrollment",
          targetId: { in: [...new Set(inscriptions.map((i) => i.id))] },
        },
        select: { targetId: true, createdAt: true, changes: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.activityLog.findMany({
        where: {
          action: ACTION_JOURNAL_DECLARATION_BESOIN,
          targetType: "Trainee",
          targetId: { in: [...new Set(inscriptions.map((i) => i.traineeId))] },
        },
        select: { targetId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);
  }

  const parInscription = new Map<string, EntreeJournalAdaptation[]>();
  for (const l of consignations) {
    if (l.targetId === null) continue;
    const changes = l.changes as { adaptationsRenseignees?: unknown } | null;
    const liste = parInscription.get(l.targetId) ?? [];
    liste.push({ createdAt: l.createdAt, renseignee: changes?.adaptationsRenseignees === true });
    parInscription.set(l.targetId, liste);
  }
  const parStagiaire = new Map<string, Date[]>();
  for (const l of declarations) {
    if (l.targetId === null) continue;
    const liste = parStagiaire.get(l.targetId) ?? [];
    liste.push(l.createdAt);
    parStagiaire.set(l.targetId, liste);
  }

  for (const i of inscriptions) {
    const entrees = parInscription.get(i.id) ?? [];
    const horodatage: HorodatageCircuitAdaptation = {
      ...HORODATAGE_CIRCUIT_VIDE,
      consigneeDepuis: debutConsignationCourante(entrees),
      derniereConsignationLe: derniereConsignation(entrees),
      derniereDeclarationLe: derniereDeclarationPourInscription({
        positionnements: i.positionnements,
        declarationsStagiaire: parStagiaire.get(i.traineeId) ?? [],
        finSession: i.finSession,
      }),
    };
    resultat.set(i.id, horodatage);
  }
  return resultat;
}

/**
 * Combien d'inscriptions, parmi celles que `where` désigne, portent une réponse
 * consignée qui ne couvre PAS la dernière déclaration du besoin ?
 *
 * Pour le moteur de conformité : son compte « besoin déclaré ET réponse
 * consignée » est une requête SQL, qui ne sait pas comparer deux dates rangées
 * dans deux tables. Il en retranche ce nombre.
 *
 * ⚠️ Aucun `take` : une troncature ferait BAISSER ce nombre, donc MONTER le
 * numérateur de l'indicateur — un faux « couvert ». La population (besoin
 * déclaré ET réponse consignée) est petite par nature.
 */
export async function compterReponsesRouvertes(
  where: Prisma.EnrollmentWhereInput,
): Promise<number> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return 0;
  const lignes = await prisma.enrollment.findMany({
    where: {
      AND: [where, whereBesoinAdaptationDeclare()],
      adaptationsRealisees: { not: null },
    },
    select: {
      id: true,
      traineeId: true,
      adaptationsRealisees: true,
      session: { select: { dateFin: true } },
      trainee: { select: { situationHandicap: true } },
      questionnaires: {
        where: { type: "positionnement", reponduAt: { not: null } },
        select: { reponses: true, reponduAt: true },
      },
    },
  });
  const aBesoin = lignes.filter((e) =>
    besoinAdaptationDeclare({
      situationHandicap: e.trainee.situationHandicap,
      reponsesPositionnements: e.questionnaires.map((q) => q.reponses),
    }),
  );
  if (aBesoin.length === 0) return 0;
  const circuit = await lireCircuitAdaptation(
    aBesoin.map((e) => ({
      id: e.id,
      traineeId: e.traineeId,
      finSession: e.session.dateFin,
      positionnements: e.questionnaires,
    })),
  );
  return aBesoin.filter(
    (e) =>
      etatReponseAdaptation(
        true,
        e.adaptationsRealisees,
        circuit.get(e.id) ?? HORODATAGE_CIRCUIT_VIDE,
      ) === "a_consigner",
  ).length;
}
