/**
 * Les rencontres que l'extension peut enregistrer « aujourd'hui »
 * (`GET /api/enregistreur/rencontres-du-jour`, PR 5).
 *
 * Fenêtre : de −3 h à +12 h autour de maintenant (instants absolus : le
 * changement d'heure du 25/10/2026 ne décale rien). Deux sources :
 *   · les rendez-vous Calendly de la liste blanche, dont la rencontre est
 *     créée À LA DEMANDE si elle n'existe pas encore ;
 *   · les rencontres saisies dans la console (`saisie_manuelle`) de type visio.
 *
 * En mode `pilote`, seules les rencontres de test (client fictif) sont
 * rendues : les autres seraient refusées au démarrage de toute façon.
 *
 * ⚠️ Rien du DOSSIER n'est lu : ni faits, ni comptes rendus, ni notes. La
 * personne et l'entreprise sont celles DÉCLARÉES dans Calendly ; le client
 * n'est que PROPOSÉ (décision A4 : jamais rangé d'office).
 */

import type { Prisma, PrismaClient } from "../../../prisma/generated/client";
import type { TRencontreDuJour } from "@/lib/schemas/enregistreur";
import { chiffrerParole } from "@/lib/chiffrer-parole";
import { entrepriseEtBesoin, reponsesFormulaire } from "@/features/admin-rendezvous/a-venir";
import {
  estTypeEnregistrable,
  estUnNon,
  reponseEnregistrementCalendly,
} from "./enregistreur-calendly";
import { blocagePreavis, PREAVIS_SOUS_TRAITANTS, type Preavis } from "./preavis-clients-actifs";
import type { ModeEnregistrement } from "./drapeau";
import { ETATS_ENREGISTREMENT_ACTIFS } from "./etats";

export const FENETRE_AVANT_MS = 3 * 3_600_000;
export const FENETRE_APRES_MS = 12 * 3_600_000;

/** Version du texte de l'indice « réponse Calendly » dans les preuves d'accord. */
export const VERSION_INDICE_CALENDLY = "reponse-calendly-v1";

type Db = Pick<
  PrismaClient,
  "calendlyEvent" | "rencontre" | "client" | "enregistrementConsentement" | "enregistrement"
>;

/** L'entreprise déclarée, par le lecteur UNIQUE de la console (anti-doublon A1). */
function entrepriseDeclaree(rawPayload: unknown): string | null {
  const e = entrepriseEtBesoin(reponsesFormulaire(rawPayload)).entreprise;
  return e === null ? null : e.slice(0, 200);
}

/** La fenêtre « du jour » autour d'un instant. */
export function fenetreDuJour(maintenant: Date): { readonly debut: Date; readonly fin: Date } {
  return {
    debut: new Date(maintenant.getTime() - FENETRE_AVANT_MS),
    fin: new Date(maintenant.getTime() + FENETRE_APRES_MS),
  };
}

function estConflitUnique(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

/**
 * Crée la rencontre d'un rendez-vous Calendly si elle n'existe pas encore.
 *
 * ⚠️ INTERFACE MINIMALE LOCALE À LA PR 5 : la fonction de référence est
 * `assurerRencontrePourCalendly` de la PR 4 (`dossier-client/rencontre-calendly.ts`),
 * qui crée aussi les participants. Au rebase sur une `main` qui la contient,
 * cet appel lui est confié. Ici : la rencontre seule, `a_classer`, sans client.
 */
export async function assurerRencontreMinimale(
  db: Pick<PrismaClient, "rencontre">,
  ev: {
    readonly id: string;
    readonly eventTypeName: string;
    readonly startTime: Date | null;
    readonly endTime: Date | null;
    readonly eventUri: string | null;
    readonly inviteeUri: string | null;
    readonly location: string | null;
  },
): Promise<string> {
  const existante = await db.rencontre.findUnique({
    where: { calendlyEventId: ev.id },
    select: { id: true },
  });
  if (existante) return existante.id;
  try {
    const creee = await db.rencontre.create({
      data: {
        source: "calendly",
        type: ev.location?.includes("meet.google.com") ? "visio" : "inconnu",
        calendlyEventId: ev.id,
        calendlyEventUri: ev.eventUri,
        calendlyInviteeUri: ev.inviteeUri,
        titre: ev.eventTypeName.slice(0, 255),
        debutPrevu: ev.startTime,
        finPrevue: ev.endTime,
      },
      select: { id: true },
    });
    return creee.id;
  } catch (err) {
    if (!estConflitUnique(err)) throw err;
    const relue = await db.rencontre.findUnique({
      where: { calendlyEventId: ev.id },
      select: { id: true },
    });
    if (!relue) throw err;
    return relue.id;
  }
}

/** Liste les rencontres enregistrables de la fenêtre du jour. */
export async function listerRencontresDuJour(
  db: Db,
  entree: {
    readonly maintenant: Date;
    readonly mode: Exclude<ModeEnregistrement, "ferme">;
    /** Injecté par les tests ; la déclaration unique sinon. */
    readonly preavis?: Preavis | null;
  },
): Promise<TRencontreDuJour[]> {
  const preavis = entree.preavis === undefined ? PREAVIS_SOUS_TRAITANTS : entree.preavis;
  const { debut, fin } = fenetreDuJour(entree.maintenant);

  // 1. Calendly de la liste blanche : upsert à la demande (hors mode pilote :
  //    une rencontre Calendly n'est jamais une rencontre de test).
  if (entree.mode === "ouvert") {
    const evenements = await db.calendlyEvent.findMany({
      where: { startTime: { gte: debut, lte: fin }, status: { not: "canceled" } },
      select: {
        id: true,
        eventTypeName: true,
        startTime: true,
        endTime: true,
        eventUri: true,
        inviteeUri: true,
        location: true,
      },
    });
    for (const ev of evenements) {
      if (estTypeEnregistrable(ev.eventTypeName)) await assurerRencontreMinimale(db, ev);
    }
  }

  // 2. Les rencontres de la fenêtre.
  const rencontres = await db.rencontre.findMany({
    where: {
      debutPrevu: { gte: debut, lte: fin },
      fusionneeDansId: null,
      ...(entree.mode === "pilote"
        ? { estTestInterne: true, source: "saisie_manuelle" as const, type: "visio" as const }
        : {
            OR: [
              { source: "calendly" as const },
              { source: "saisie_manuelle" as const, type: "visio" as const },
            ],
          }),
    },
    orderBy: { debutPrevu: "asc" },
    select: {
      id: true,
      source: true,
      titre: true,
      debutPrevu: true,
      finPrevue: true,
      estTestInterne: true,
      clientId: true,
      clientProposeId: true,
      motifProposition: true,
      calendlyEvent: {
        select: { eventTypeName: true, inviteeName: true, inviteeEmail: true, rawPayload: true },
      },
      participants: { where: { role: "client" }, select: { nomAffiche: true }, take: 1 },
      enregistrements: {
        where: { statut: { in: [...ETATS_ENREGISTREMENT_ACTIFS] } },
        select: { id: true },
        take: 1,
      },
    },
  });

  const retenues = rencontres.filter(
    (r) => r.source !== "calendly" || estTypeEnregistrable(r.calendlyEvent?.eventTypeName),
  );

  // Clients proposés : leur nom seulement.
  const idsClients = [
    ...new Set(
      retenues.map((r) => r.clientId ?? r.clientProposeId).filter((x): x is string => !!x),
    ),
  ];
  const clients = idsClients.length
    ? await db.client.findMany({
        where: { id: { in: idsClients } },
        select: { id: true, raisonSociale: true },
      })
    : [];
  const nomClient = new Map(clients.map((c) => [c.id, c.raisonSociale]));

  const sortie: TRencontreDuJour[] = [];
  for (const r of retenues) {
    const reponse = r.calendlyEvent
      ? reponseEnregistrementCalendly(r.calendlyEvent.rawPayload)
      : null;
    if (reponse !== null) await consignerIndiceCalendly(db, r.id, reponse, entree.maintenant);
    const idClient = r.clientId ?? r.clientProposeId;
    // Client VALIDÉ et actif sous préavis : bandeau, et `POST sessions` refusera.
    const blocage = await blocagePreavis(db, r.clientId, entree.maintenant, preavis);
    sortie.push({
      rencontreId: r.id,
      source: r.source === "calendly" ? "calendly" : "saisie_manuelle",
      titre: r.titre,
      debutPrevu: r.debutPrevu?.toISOString() ?? null,
      finPrevue: r.finPrevue?.toISOString() ?? null,
      personne: r.calendlyEvent?.inviteeName ?? r.participants[0]?.nomAffiche ?? null,
      entrepriseDeclaree: r.calendlyEvent ? entrepriseDeclaree(r.calendlyEvent.rawPayload) : null,
      clientPropose:
        idClient && nomClient.has(idClient)
          ? { id: idClient, nom: nomClient.get(idClient) ?? "" }
          : null,
      motifProposition: r.clientId ? null : (r.motifProposition ?? null),
      reponseCalendly: reponse,
      nonSurCalendly: estUnNon(reponse),
      refusAnterieur: await aUnRefusAnterieur(db, {
        rencontreId: r.id,
        clientId: r.clientId,
        emailInvite: r.calendlyEvent?.inviteeEmail ?? null,
      }),
      estTestInterne: r.estTestInterne,
      enregistrementActifId: r.enregistrements[0]?.id ?? null,
      preavis: blocage
        ? { finLe: blocage.finLe === null ? null : new Date(blocage.finLe).toISOString() }
        : null,
    });
  }
  return sortie;
}

/**
 * Écrit l'indice « réponse à la question Calendly » une fois par rencontre
 * (preuve d'information, jamais un accord : l'accord est le clic de Will).
 */
async function consignerIndiceCalendly(
  db: Pick<PrismaClient, "enregistrementConsentement">,
  rencontreId: string,
  reponse: string,
  maintenant: Date,
): Promise<void> {
  const deja = await db.enregistrementConsentement.count({
    where: { rencontreId, type: "reponse_calendly" },
  });
  if (deja > 0) return;
  await db.enregistrementConsentement.create({
    data: {
      rencontreId,
      type: "reponse_calendly",
      versionTexte: VERSION_INDICE_CALENDLY,
      texteReponse: chiffrerParole(reponse.slice(0, 500)),
      survenuLe: maintenant,
    },
  });
}

/**
 * Un refus ou un retrait déjà exprimé : sur une autre rencontre du même client,
 * ou par la même adresse Calendly. Bandeau rouge dans le panneau (V5-C6).
 */
export async function aUnRefusAnterieur(
  db: Pick<PrismaClient, "rencontre" | "enregistrementConsentement" | "enregistrement">,
  cible: {
    readonly rencontreId: string;
    readonly clientId: string | null;
    readonly emailInvite: string | null;
  },
): Promise<boolean> {
  const ou: Prisma.RencontreWhereInput[] = [];
  if (cible.clientId) ou.push({ clientId: cible.clientId });
  if (cible.emailInvite) ou.push({ calendlyEvent: { inviteeEmail: cible.emailInvite } });
  if (ou.length === 0) return false;
  const autres = await db.rencontre.findMany({
    where: { id: { not: cible.rencontreId }, OR: ou },
    select: { id: true },
    take: 50,
  });
  if (autres.length === 0) return false;
  const ids = autres.map((a) => a.id);
  const retraits = await db.enregistrementConsentement.count({
    where: { rencontreId: { in: ids }, type: "retrait" },
  });
  if (retraits > 0) return true;
  const refuses = await db.enregistrement.count({
    where: { rencontreId: { in: ids }, statut: "refuse" },
  });
  return refuses > 0;
}
