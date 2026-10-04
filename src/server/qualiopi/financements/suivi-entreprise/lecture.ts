/**
 * Lot OPCO A8 — lecture d'un dossier de financement pour son suivi entreprise.
 *
 * UNE forme lue, partagée par l'envoi, les relances, les alertes, la page
 * publique et la console : deux `select` distincts finiraient par diverger.
 *
 * L'OPCO du client se lit UNIQUEMENT par `opcoDuClient` (typé d'abord, ancien
 * texte libre ensuite), et l'on sélectionne donc `opco` ET `opcoIdentifie`.
 * L'entreprise est celle du dossier, à défaut celle de la session.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../../prisma/generated/client";
import {
  dateLimiteDepotPourSession,
  nomOpcoDuClient,
  opcoDuClient,
  type OpcoId,
} from "../opco-referentiel";
import type {
  DossierPourRelance,
  EtapeMessage,
  MessageLu,
  QuestionMessage,
  ReponseEntreprise,
  SuiviLu,
} from "./planning";

const SELECT_CLIENT = {
  id: true,
  raisonSociale: true,
  contactNom: true,
  contactEmail: true,
  contactTelephone: true,
  opco: true,
  opcoIdentifie: true,
} as const;

export const SELECT_DOSSIER_SUIVI = {
  id: true,
  type: true,
  statut: true,
  depotFaitLe: true,
  accordEcritLe: true,
  accordAt: true,
  envoyeAt: true,
  trainingSessionId: true,
  client: { select: SELECT_CLIENT },
  trainingSession: {
    select: {
      id: true,
      numero: true,
      titreSession: true,
      dateDebut: true,
      client: { select: SELECT_CLIENT },
    },
  },
  suiviEntreprise: {
    select: {
      id: true,
      envoyeLe: true,
      envoiAutomatique: true,
      zipKey: true,
      zipNom: true,
      relancesArreteesLe: true,
      refusDeclareLe: true,
      accordFichierKey: true,
      messages: {
        orderBy: { envoyeLe: "asc" },
        take: 50,
        select: {
          id: true,
          etape: true,
          rang: true,
          question: true,
          envoyeLe: true,
          jourParis: true,
          reponse: true,
          reponduLe: true,
        },
      },
    },
  },
} satisfies Prisma.DossierFinancementSelect;

export type DossierSuiviBrut = Prisma.DossierFinancementGetPayload<{
  select: typeof SELECT_DOSSIER_SUIVI;
}>;

export interface ContexteSuivi {
  brut: DossierSuiviBrut;
  sessionId: string;
  numeroSession: string;
  intituleFormation: string;
  dateDebutSession: Date;
  entreprise: {
    id: string;
    raisonSociale: string;
    contactNom: string | null;
    contactEmail: string | null;
    contactTelephone: string | null;
  } | null;
  opco: OpcoId | null;
  nomOpco: string;
  dateLimiteDepot: Date | null;
  dossier: DossierPourRelance;
  suivi: (SuiviLu & { id: string }) | null;
}

/** Met en forme ce qui a été lu. `null` si le dossier n'est rattaché à aucune session. */
export function contexteSuivi(brut: DossierSuiviBrut): ContexteSuivi | null {
  const s = brut.trainingSession;
  if (!s) return null;
  const client = brut.client ?? s.client;
  const opco = opcoDuClient(client);
  const dateLimiteDepot = opco ? dateLimiteDepotPourSession(opco, s.dateDebut) : null;
  const se = brut.suiviEntreprise;
  return {
    brut,
    sessionId: s.id,
    numeroSession: s.numero,
    intituleFormation: s.titreSession,
    dateDebutSession: s.dateDebut,
    entreprise: client
      ? {
          id: client.id,
          raisonSociale: client.raisonSociale,
          contactNom: client.contactNom,
          contactEmail: client.contactEmail,
          contactTelephone: client.contactTelephone,
        }
      : null,
    opco,
    nomOpco: nomOpcoDuClient(client),
    dateLimiteDepot,
    dossier: {
      statut: brut.statut,
      depotFaitLe: brut.depotFaitLe,
      accordEcritLe: brut.accordEcritLe,
      accordAt: brut.accordAt,
      envoyeAt: brut.envoyeAt,
      dateDebutSession: s.dateDebut,
      dateLimiteDepot,
    },
    suivi: se
      ? {
          id: se.id,
          envoyeLe: se.envoyeLe,
          relancesArreteesLe: se.relancesArreteesLe,
          refusDeclareLe: se.refusDeclareLe,
          messages: se.messages.map((m): MessageLu => ({
            etape: m.etape as EtapeMessage,
            rang: m.rang,
            question: m.question as QuestionMessage,
            jourParis: m.jourParis,
            envoyeLe: m.envoyeLe,
            reponse: (m.reponse as ReponseEntreprise | null) ?? null,
            reponduLe: m.reponduLe,
          })),
        }
      : null,
  };
}

export async function lireContexteSuivi(dossierId: string): Promise<ContexteSuivi | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;
  const brut = await prisma.dossierFinancement.findUnique({
    where: { id: dossierId },
    select: SELECT_DOSSIER_SUIVI,
  });
  return brut ? contexteSuivi(brut) : null;
}
