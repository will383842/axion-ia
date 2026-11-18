/**
 * Relier un e-mail du journal à une fiche client (lot 1 « fiche client complète », 25/10/2026).
 *
 * Le journal `email_logs` ne porte pas de `client_id` (ADR 0053 : pas de colonne neuve en lot 1).
 * Le lien se reconstitue par l'entité visée à l'envoi (`entityType` / `entityId`) :
 *   · `Rencontre`                        -> la rencontre, donc `rencontres.client_id` ;
 *   · `QuestionnaireAvantAudit` (+ essai) -> le questionnaire, sa rencontre, son client ;
 *   · `QuestionnaireAvantAuditEnvoi`     -> la réponse reçue, son questionnaire, sa rencontre.
 * Les autres familles (convocations de session, devis...) ne sont pas rattachées ici : la ligne
 * n'affiche alors aucun lien, jamais un faux.
 *
 * Lectures seules. Tolère une base indisponible (build, stub) : rend du vide.
 */

import { prisma } from "@/lib/prisma";
import { fichesCouvertes } from "@/features/questionnaire-preaudit/de-la-fiche";

export type ClientDuJournal = { id: string; numero: string; nom: string };

export const ENTITES_QUESTIONNAIRE = [
  "QuestionnaireAvantAudit",
  "QuestionnaireAvantAuditEssai",
] as const;
const ENTITE_ENVOI = "QuestionnaireAvantAuditEnvoi";
const ENTITE_RENCONTRE = "Rencontre";

type LigneRattachable = { id: string; entityType: string | null; entityId: string | null };

const estUuid = (v: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Le client de chaque ligne rattachable (clé = id de la ligne du journal). */
export async function clientsDesLignes(
  lignes: ReadonlyArray<LigneRattachable>,
): Promise<Map<string, ClientDuJournal>> {
  const resultat = new Map<string, ClientDuJournal>();
  const ids = (types: ReadonlyArray<string>): string[] => [
    ...new Set(
      lignes
        .filter((l) => l.entityType !== null && types.includes(l.entityType))
        .map((l) => l.entityId)
        .filter((v): v is string => v !== null && estUuid(v)),
    ),
  ];
  const rencontreIds = ids([ENTITE_RENCONTRE]);
  const questionnaireIds = ids(ENTITES_QUESTIONNAIRE);
  const envoiIds = ids([ENTITE_ENVOI]);
  if (rencontreIds.length + questionnaireIds.length + envoiIds.length === 0) return resultat;

  try {
    const clientSelect = { select: { id: true, numero: true, raisonSociale: true } } as const;
    const [rencontres, questionnaires, envois] = await Promise.all([
      rencontreIds.length === 0
        ? []
        : prisma.rencontre.findMany({
            where: { id: { in: rencontreIds }, clientId: { not: null } },
            select: { id: true, client: clientSelect },
          }),
      questionnaireIds.length === 0
        ? []
        : prisma.questionnaireAvantAudit.findMany({
            where: { id: { in: questionnaireIds } },
            select: {
              id: true,
              client: clientSelect,
              rencontre: { select: { client: clientSelect } },
            },
          }),
      envoiIds.length === 0
        ? []
        : prisma.questionnaireAvantAuditEnvoi.findMany({
            where: { id: { in: envoiIds } },
            select: {
              id: true,
              questionnaire: {
                select: { client: clientSelect, rencontre: { select: { client: clientSelect } } },
              },
            },
          }),
    ]);
    type C = { id: string; numero: string; raisonSociale: string } | null | undefined;
    const parEntite = new Map<string, ClientDuJournal>();
    const poser = (entiteId: string, c: C): void => {
      if (c) parEntite.set(entiteId, { id: c.id, numero: c.numero, nom: c.raisonSociale });
    };
    for (const r of rencontres) poser(r.id, r.client);
    for (const q of questionnaires) poser(q.id, q.rencontre?.client ?? q.client);
    for (const e of envois)
      poser(e.id, e.questionnaire.rencontre?.client ?? e.questionnaire.client);
    for (const l of lignes) {
      const c = l.entityId === null ? undefined : parEntite.get(l.entityId);
      if (c) resultat.set(l.id, c);
    }
  } catch {
    // Base absente (build) : pas de lien, la liste s'affiche quand même.
  }
  return resultat;
}

/**
 * Les identifiants d'entités qu'une fiche client « couvre » dans le journal : ses rencontres, leurs
 * questionnaires et les réponses reçues. Rend `[]` si la fiche n'existe pas ou n'a rien : le
 * filtre est alors une liste VIDE (zéro ligne), jamais le journal entier.
 */
export async function idsLiesAuClient(clientId: string): Promise<string[]> {
  if (!estUuid(clientId)) return [];
  const rencontres = await prisma.rencontre.findMany({
    where: { clientId },
    select: {
      id: true,
      questionnaireAvantAudit: { select: { id: true, envois: { select: { id: true } } } },
    },
  });
  const ids: string[] = [];
  // Les questionnaires envoyés SANS rendez-vous (rattachés à la fiche directement), et leurs réponses.
  const directs = await prisma.questionnaireAvantAudit.findMany({
    where: { rencontreId: null, clientId: { in: await fichesCouvertes(clientId) } },
    select: { id: true, envois: { select: { id: true } } },
  });
  for (const q of directs) {
    ids.push(q.id);
    for (const e of q.envois) ids.push(e.id);
  }
  for (const r of rencontres) {
    ids.push(r.id);
    const q = r.questionnaireAvantAudit;
    if (q) {
      ids.push(q.id);
      for (const e of q.envois) ids.push(e.id);
    }
  }
  return ids;
}

/** Le client filtré, tel qu'on le NOMME à l'écran (jamais un UUID nu). */
export async function clientFiltre(clientId: string): Promise<ClientDuJournal | null> {
  if (!estUuid(clientId)) return null;
  const c = await prisma.client
    .findUnique({
      where: { id: clientId },
      select: { id: true, numero: true, raisonSociale: true },
    })
    .catch(() => null);
  return c === null ? null : { id: c.id, numero: c.numero, nom: c.raisonSociale };
}
