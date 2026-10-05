/**
 * La RENCONTRE du dossier client née d'un rendez-vous Calendly
 * (chantier visio, PR 4 ; plan V-05, V-07, V-07b).
 *
 * `assurerRencontrePourCalendly(calendlyEventId)` rend la rencontre de ce
 * rendez-vous — la crée au besoin — et resynchronise sa copie (titre, dates,
 * type). C'est la SEULE fonction qui crée une rencontre depuis Calendly :
 * le balayage du worker, « Après l'appel » de la console, le suivi du
 * rendez-vous et la reprise de l'historique l'appellent tous.
 *
 * ## Ce qu'elle refuse
 *
 * Un rendez-vous HORS de la liste blanche (`server/visio/liste-blanche-types`) :
 * échange apporteur, entretien de candidat, tout type non déclaré. Elle rend
 * alors `{ statut: "hors_liste_blanche" }` et n'écrit RIEN — l'onglet
 * « Rendez-vous » garde son suivi Calendly comme avant.
 *
 * ## Ce qu'elle écrit, dans UNE transaction
 *
 *   · la rencontre : source `calendly`, type (visio / téléphone, dérivé comme
 *     partout du lieu Calendly), copie du titre, des dates et des URI (elles
 *     survivent à la purge des 36 mois), code Meet s'il se lit dans le lieu ;
 *   · les participants : le titulaire, les invités qu'il a ajoutés
 *     (`event_guests`), et Williams — chacun avec l'empreinte de son adresse,
 *     jamais l'adresse elle-même ;
 *   · une PROPOSITION de fiche (`rattacher.ts`, A4 : jamais un rattachement) ;
 *   · `repriseHistorique = true` si le rendez-vous commence AVANT la limite de
 *     l'historique : il n'appelle alors ni rappel ni alerte (V-07b). Un
 *     rendez-vous À VENIR ne l'est JAMAIS ;
 *   · `estTestInterne = true` si le titulaire réserve avec une ADRESSE DE TEST
 *     (`server/visio/adresses-de-test`, correctif P-2, ADR 0061) : rencontre
 *     du pilote, sans fiche. Posé à la CRÉATION seulement — une rencontre
 *     existante n'est jamais marquée après coup (la purge du pilote
 *     supprimerait une rencontre peut-être déjà rangée chez un vrai client).
 *
 * ## La borne
 *
 * Tant que le balayage n'a jamais tourné, la borne est
 * `DEBUT_BALAYAGE_DOSSIER_PAR_DEFAUT` (jour cible de la mise en ligne). Dès son
 * premier passage, c'est la date de ce passage, lue dans
 * `battements_circuit` (`premierLe`, écrit une seule fois). Dans les deux
 * cas, la limite ne dépasse jamais « maintenant » (`limiteDeLHistorique`) :
 * la reprise est lancée AVANT d'allumer le balayage, et un rendez-vous déjà
 * réservé pour demain n'est pas de l'historique. Tout ce qui précède passe
 * par `scripts/visio/reprendre-historique-calendly.ts`.
 *
 * Module NEUTRE (sans `server-only`, sans Next) : le worker l'importe.
 */

import type { RencontreType } from "../../../prisma/generated/client";
import { entrepriseDeclaree } from "@/features/admin-rendezvous/a-venir";
import { compteOrganisateur, invitesSupplementaires } from "@/features/admin-rendezvous/visio";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { canalDuRendezVous } from "@/server/calendly/canal";
import { estAdresseDeTest } from "@/server/visio/adresses-de-test";
import { estRendezVousDuDossier } from "@/server/visio/liste-blanche-types";
import { lireBorneDuBalayage } from "@/server/visio/battement";
import type { BaseTransactionnelle, Tx } from "./base";
import {
  proposerRattachement,
  sirenDuNumeroSaisi,
  type DemandeLiee,
  type IndicesDeRattachement,
} from "./rattacher";

/**
 * Borne par défaut du balayage, tant qu'il n'a jamais tourné : le jour cible
 * de mise en ligne du plan (03/10/2026). Elle ne vaut JAMAIS seule : la
 * limite réelle est `limiteDeLHistorique`, qui ne dépasse pas « maintenant »
 * — si la PR atterrit avant le 03/10, un « Discutons » déjà réservé pour le
 * 02/10 n'est pas de l'historique.
 */
export const DEBUT_BALAYAGE_DOSSIER_PAR_DEFAUT = new Date("2026-10-03T00:00:00+02:00");

/**
 * Ce qui commence AVANT cette date est de l'historique : la borne du balayage
 * (son premier passage, ou la constante par défaut), mais jamais au-delà de
 * maintenant. PURE.
 */
export function limiteDeLHistorique(borneLue: Date | null, maintenant: Date): Date {
  const borne = borneLue ?? DEBUT_BALAYAGE_DOSSIER_PAR_DEFAUT;
  return borne.getTime() < maintenant.getTime() ? borne : maintenant;
}

/** Nom affiché de Williams dans les participants. */
export const NOM_WILLIAMS = "Williams Jullin";

/** Ce que la fonction lit d'un rendez-vous Calendly. */
export interface RendezVousCalendlyLu {
  readonly id: string;
  readonly eventTypeName: string;
  readonly linkedJobApplicationId: string | null;
  /** La demande du site que Will a reliée au rendez-vous (motif `demande_liee`). */
  readonly linkedSubmissionId: string | null;
  readonly startTime: Date | null;
  readonly endTime: Date | null;
  readonly inviteeName: string | null;
  readonly inviteeEmail: string | null;
  readonly location: string | null;
  readonly eventUri: string | null;
  readonly inviteeUri: string | null;
  readonly rawPayload: unknown;
}

export type ResultatAssurer =
  | { readonly statut: "hors_liste_blanche" }
  | { readonly statut: "introuvable" }
  | { readonly statut: "creee" | "existante"; readonly rencontreId: string };

export interface OptionsAssurer {
  readonly maintenant?: Date;
  /** Force la borne (tests, reprise d'historique). Défaut : lue en base. */
  readonly borne?: Date;
  /** Reprise de l'historique : la rencontre est marquée `repriseHistorique`. */
  readonly repriseHistorique?: boolean;
  /** Variables lues pour les adresses de test (tests). Défaut : `process.env`. */
  readonly env?: Readonly<Record<string, string | undefined>>;
}

// ── Lecture de la charge Calendly (pure) ─────────────────────────────────────
// Les invités, l'hôte, les réponses et l'entreprise déclarée se lisent par les
// fonctions de l'onglet « Rendez-vous » (`admin-rendezvous/visio.ts`,
// `admin-rendezvous/a-venir.ts`, sans import : le worker peut les charger) —
// jamais par une copie.

/** Le code Meet « abc-defg-hij » d'un lien Meet, ou `null`. */
export function codeMeet(location: string | null | undefined): string | null {
  if (!location) return null;
  const m = /meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})\b/i.exec(location);
  return m?.[1]?.toLowerCase() ?? null;
}

/** Le type de rencontre, dérivé du lieu Calendly comme partout ailleurs. */
export function typeDeRencontre(location: string | null, rawPayload: unknown): RencontreType {
  const canal = canalDuRendezVous(location, rawPayload);
  if (canal === "visio") return "visio";
  if (canal === "telephone") return "telephone";
  // Sur place (lieu Calendly `physical`) : la rencontre en personne existe
  // déjà dans le dossier client sous le nom `presentiel`.
  if (canal === "sur_place") return "presentiel";
  return "inconnu";
}

// ── Écriture ─────────────────────────────────────────────────────────────────

const CHAMPS_CALENDLY = {
  id: true,
  eventTypeName: true,
  linkedJobApplicationId: true,
  linkedSubmissionId: true,
  startTime: true,
  endTime: true,
  inviteeName: true,
  inviteeEmail: true,
  location: true,
  eventUri: true,
  inviteeUri: true,
  rawPayload: true,
} as const;

/** La fiche de la rencontre que celle-ci remplace (report fait sur le site). */
async function clientDuReport(tx: Tx, eventUri: string | null): Promise<string | null> {
  if (!eventUri) return null;
  const report = await tx.calendlyReport.findUnique({
    where: { nouvelEventUri: eventUri },
    select: { ancienEventUri: true },
  });
  if (report === null) return null;
  const ancienne = await tx.rencontre.findFirst({
    where: { calendlyEventUri: report.ancienEventUri },
    select: { clientId: true, clientProposeId: true },
  });
  return ancienne?.clientId ?? ancienne?.clientProposeId ?? null;
}

/** La demande du site reliée au rendez-vous, vue par la proposition. */
async function demandeLiee(tx: Tx, submissionId: string | null): Promise<DemandeLiee | null> {
  if (!submissionId) return null;
  const d = await tx.submission.findUnique({
    where: { id: submissionId },
    select: { companyName: true, registrationNumber: true, contactEmailHash: true },
  });
  if (d === null) return null;
  return {
    siren: sirenDuNumeroSaisi(d.registrationNumber),
    emailHash: d.contactEmailHash,
    raisonSociale: d.companyName,
  };
}

/**
 * Rend la rencontre du rendez-vous Calendly, la crée au besoin. Voir l'en-tête.
 * Ouvre sa propre transaction ; passer `dansLaTransaction(tx)` pour rester
 * dans celle de l'appelant.
 */
export async function assurerRencontrePourCalendly(
  db: BaseTransactionnelle,
  calendlyEventId: string,
  options: OptionsAssurer = {},
): Promise<ResultatAssurer> {
  const maintenant = options.maintenant ?? new Date();
  return db.$transaction(async (tx): Promise<ResultatAssurer> => {
    const ev = (await tx.calendlyEvent.findUnique({
      where: { id: calendlyEventId },
      select: CHAMPS_CALENDLY,
    })) as RendezVousCalendlyLu | null;
    if (ev === null) return { statut: "introuvable" };
    if (!estRendezVousDuDossier(ev)) return { statut: "hors_liste_blanche" };

    const type = typeDeRencontre(ev.location, ev.rawPayload);
    const copie = {
      titre: ev.eventTypeName.slice(0, 255),
      debutPrevu: ev.startTime,
      finPrevue: ev.endTime,
      datesSynchroniseesLe: maintenant,
      type,
      meetCode: codeMeet(ev.location),
      calendlyEventUri: ev.eventUri,
      calendlyInviteeUri: ev.inviteeUri,
    };

    const existante = await tx.rencontre.findUnique({
      where: { calendlyEventId },
      select: { id: true },
    });
    if (existante !== null) {
      // Un rendez-vous À VENIR n'est jamais de l'historique : un marquage
      // posé à tort (déplacé par Calendly vers le futur) se corrige ici.
      const futur = ev.startTime !== null && ev.startTime.getTime() > maintenant.getTime();
      await tx.rencontre.update({
        where: { id: existante.id },
        data: { ...copie, ...(futur ? { repriseHistorique: false } : {}) },
      });
      return { statut: "existante", rencontreId: existante.id };
    }

    const limite = limiteDeLHistorique(
      options.borne ?? (await lireBorneDuBalayage(tx)),
      maintenant,
    );
    const futur = ev.startTime !== null && ev.startTime.getTime() > maintenant.getTime();
    const reprise =
      !futur &&
      (options.repriseHistorique === true ||
        (ev.startTime !== null && ev.startTime.getTime() < limite.getTime()));

    const rencontre = await tx.rencontre.create({
      data: {
        source: "calendly",
        calendlyEventId,
        ...copie,
        rattachementStatut: "a_classer",
        repriseHistorique: reprise,
        estTestInterne: estAdresseDeTest(ev.inviteeEmail, options.env),
      },
      select: { id: true },
    });

    // Les participants : jamais une adresse, seulement son empreinte.
    const invites = invitesSupplementaires(ev.rawPayload);
    await tx.rencontreParticipant.create({
      data: {
        rencontreId: rencontre.id,
        nomAffiche: (ev.inviteeName ?? "Invité à compléter").slice(0, 200),
        emailHash: hashEmailForLookup(ev.inviteeEmail),
        role: "client",
      },
    });
    for (const email of invites) {
      await tx.rencontreParticipant.create({
        data: {
          rencontreId: rencontre.id,
          nomAffiche: email.split("@")[0]?.slice(0, 200) ?? "Invité",
          emailHash: hashEmailForLookup(email),
          role: "client",
        },
      });
    }
    await tx.rencontreParticipant.create({
      data: {
        rencontreId: rencontre.id,
        nomAffiche: NOM_WILLIAMS,
        emailHash: hashEmailForLookup(compteOrganisateur(ev.rawPayload)),
        role: "axion",
      },
    });

    const indices: IndicesDeRattachement = {
      emailTitulaire: ev.inviteeEmail,
      emailsInvites: invites,
      entrepriseDeclaree: entrepriseDeclaree(ev.rawPayload).nom,
      clientDuReport: await clientDuReport(tx, ev.eventUri),
      demandeLiee: await demandeLiee(tx, ev.linkedSubmissionId),
    };
    await proposerRattachement(tx, rencontre.id, indices);

    return { statut: "creee", rencontreId: rencontre.id };
  });
}
