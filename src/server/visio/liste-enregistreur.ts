/**
 * Ce que l'extension Meet reçoit pour CHOISIR la rencontre à enregistrer
 * (`GET /api/enregistreur/rencontres-du-jour`, PR 5).
 *
 * ## Une seule liste, une seule création, une seule liste blanche (anti-doublon D1)
 *
 * QUELLES rencontres sont enregistrables, et la création à la demande de celle
 * d'un rendez-vous Calendly, sont décidées par UNE fonction :
 * `rencontresEnregistrablesDuJour` (`./rencontres-du-jour.ts`, PR 4), qui
 * s'appuie sur `assurerRencontrePourCalendly` (participants et rattachement
 * proposé compris) et sur la liste blanche du dossier (`./liste-blanche-types.ts` :
 * type « Discutons… » ET jamais un rendez-vous lié à une candidature). Ce
 * module ne liste rien, ne crée rien : il ENRICHIT ce que cette fonction rend
 * de ce que le panneau de l'extension affiche, et applique les filtres propres
 * à l'enregistreur (mode pilote, fiche fusionnée).
 *
 * ## La lecture de la réservation Calendly est celle de la console (anti-doublon A1)
 *
 * L'entreprise déclarée vient de `entrepriseDeclaree` (`admin-rendezvous/a-venir.ts`),
 * la réponse à la question d'enregistrement de `reponsesFormulaire` (même
 * module, via `./enregistreur-calendly.ts`). Aucune lecture parallèle.
 *
 * ⚠️ Rien du DOSSIER n'est lu : ni faits, ni comptes rendus, ni notes. Le
 * client n'est que PROPOSÉ (décision A4 : jamais rangé d'office).
 */

import type { Prisma, PrismaClient } from "../../../prisma/generated/client";
import type { TRencontreDuJour } from "@/lib/schemas/enregistreur";
import { chiffrerParole } from "@/lib/chiffrer-parole";
import { entrepriseDeclaree } from "@/features/admin-rendezvous/a-venir";
import type { BaseBalayage } from "./balayage";
import { estUnNon, reponseEnregistrementCalendly } from "./enregistreur-calendly";
import { estRendezVousDuDossier } from "./liste-blanche-types";
import { blocagePreavis } from "./preavis-clients-actifs";
import { rencontresEnregistrablesDuJour } from "./rencontres-du-jour";
import { PREAVIS_SOUS_TRAITANTS, type Preavis } from "./visio-annonce";
import type { ModeEnregistrement } from "./drapeau";
import { ETATS_ENREGISTREMENT_ACTIFS } from "./etats";

/** Version du texte de l'indice « réponse Calendly » dans les preuves d'accord. */
export const VERSION_INDICE_CALENDLY = "reponse-calendly-v1";

type Db = BaseBalayage &
  Pick<
    PrismaClient,
    | "calendlyEvent"
    | "rencontre"
    | "rencontreParticipant"
    | "client"
    | "clientContact"
    | "clientContactAdresse"
    | "enregistrementConsentement"
    | "enregistrement"
  >;

/** Liste les rencontres enregistrables de la fenêtre du jour, pour l'extension. */
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

  // 1. LA liste (PR 4) : fenêtre −3 h / +12 h, Calendly de la liste blanche
  //    assurés à la demande, rencontres saisies de type visio.
  const base = await rencontresEnregistrablesDuJour(db, entree.maintenant);
  const ids = base.map((r) => r.rencontreId);
  if (ids.length === 0) return [];

  // 2. Ce que le panneau affiche, pour ces rencontres-là seulement.
  const details = await db.rencontre.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      type: true,
      finPrevue: true,
      fusionneeDansId: true,
      calendlyEvent: {
        select: {
          eventTypeName: true,
          linkedJobApplicationId: true,
          inviteeName: true,
          inviteeEmail: true,
          rawPayload: true,
        },
      },
      participants: { where: { role: "client" }, select: { nomAffiche: true }, take: 1 },
      enregistrements: {
        where: { statut: { in: [...ETATS_ENREGISTREMENT_ACTIFS] } },
        select: { id: true },
        take: 1,
      },
    },
  });
  const detail = new Map(details.map((d) => [d.id, d]));

  // 3. Filtres propres à l'enregistreur. Le type Calendly est revérifié par la
  //    liste blanche UNIQUE : une rencontre créée hors d'elle n'est jamais proposée.
  const retenues = base.filter((r) => {
    const d = detail.get(r.rencontreId);
    if (!d || d.fusionneeDansId !== null) return false;
    if (r.source === "calendly" && (!d.calendlyEvent || !estRendezVousDuDossier(d.calendlyEvent))) {
      return false;
    }
    // Mode pilote : les rencontres de TEST seules — saisie sur le client
    // fictif, ou « Discutons » réservé par une adresse de test (ADR 0061, B-1
    // de la 2e vérification : sans elle, l'essai « nouveau prospect » était
    // impossible, la rencontre n'apparaissait jamais dans l'extension).
    if (entree.mode === "pilote") {
      return (
        r.estTestInterne &&
        (r.source === "saisie_manuelle" || r.source === "calendly") &&
        d.type === "visio"
      );
    }
    return true;
  });

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
    const d = detail.get(r.rencontreId);
    if (!d) continue;
    const ev = d.calendlyEvent;
    const reponse = ev ? reponseEnregistrementCalendly(ev.rawPayload) : null;
    if (reponse !== null) {
      await consignerIndiceCalendly(db, r.rencontreId, reponse, entree.maintenant);
    }
    const idClient = r.clientId ?? r.clientProposeId;
    // Client actif (validé, proposé ou reconnu par son adresse) sous préavis :
    // bandeau, et `POST sessions` refusera.
    const blocage = await blocagePreavis(db, r.rencontreId, entree.maintenant, preavis);
    const entreprise = ev ? entrepriseDeclaree(ev.rawPayload).nom : null;
    sortie.push({
      rencontreId: r.rencontreId,
      source: r.source === "calendly" ? "calendly" : "saisie_manuelle",
      titre: r.titre,
      debutPrevu: r.debutPrevu?.toISOString() ?? null,
      finPrevue: d.finPrevue?.toISOString() ?? null,
      personne: ev?.inviteeName ?? d.participants[0]?.nomAffiche ?? null,
      entrepriseDeclaree: entreprise === null ? null : entreprise.slice(0, 200),
      clientPropose:
        idClient && nomClient.has(idClient)
          ? { id: idClient, nom: nomClient.get(idClient) ?? "" }
          : null,
      motifProposition: r.clientId ? null : (r.motifProposition ?? null),
      reponseCalendly: reponse,
      nonSurCalendly: estUnNon(reponse),
      refusAnterieur: await aUnRefusAnterieur(db, {
        rencontreId: r.rencontreId,
        clientId: r.clientId,
        emailInvite: ev?.inviteeEmail ?? null,
      }),
      estTestInterne: r.estTestInterne,
      enregistrementActifId: d.enregistrements[0]?.id ?? null,
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
 * Un refus ou un retrait déjà exprimé : sur CETTE rencontre (alors `POST
 * sessions` répond aussi 409 `refus_anterieur_definitif`), sur une autre
 * rencontre du même client, ou par la même adresse Calendly. Bandeau rouge
 * dans le panneau (V5-C6).
 */
export async function aUnRefusAnterieur(
  db: Pick<PrismaClient, "rencontre" | "enregistrementConsentement" | "enregistrement">,
  cible: {
    readonly rencontreId: string;
    readonly clientId: string | null;
    readonly emailInvite: string | null;
  },
): Promise<boolean> {
  const ou: Prisma.RencontreWhereInput[] = [{ id: cible.rencontreId }];
  if (cible.clientId) ou.push({ clientId: cible.clientId });
  if (cible.emailInvite) ou.push({ calendlyEvent: { inviteeEmail: cible.emailInvite } });
  const liees = await db.rencontre.findMany({
    where: { OR: ou },
    select: { id: true },
    take: 50,
  });
  const ids = [...new Set([cible.rencontreId, ...liees.map((a) => a.id)])];
  const retraits = await db.enregistrementConsentement.count({
    where: { rencontreId: { in: ids }, type: "retrait" },
  });
  if (retraits > 0) return true;
  const refuses = await db.enregistrement.count({
    where: { rencontreId: { in: ids }, statut: "refuse" },
  });
  return refuses > 0;
}
