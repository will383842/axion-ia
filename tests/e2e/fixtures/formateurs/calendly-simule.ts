// Banc @formateurs — un rendez-vous Calendly FICTIF, décrit une fois.
//
// Module PUR (aucun import de `src/`) : il est lu des DEUX côtés du banc —
// par le test Playwright, qui en déduit les URI à chercher en base, et par
// l'exécuteur `tsx`, qui en tire les réponses de l'API Calendly simulée et le
// corps du webhook. Une seule description, donc aucune chance que les deux
// côtés parlent de deux rendez-vous différents.
//
// Données fictives seulement : noms inventés, domaine `example.test` (RFC 2606,
// jamais routable), URI préfixées `BANC-` pour être reconnaissables en base.

import { randomUUID } from "node:crypto";

/** Les types que l'API simulée déclare dans `/event_types` (URI → URL configurée). */
export type TypeConnuSimule = "diagnostic" | "apporteur";

export interface RendezVousSimule {
  /** Suffixe unique : isole le rendez-vous des autres tests, même en parallèle. */
  readonly cle: string;
  /** Nom du type tel que Calendly le porte (`scheduled_event.name`). */
  readonly nomType: string;
  /**
   * Le type est-il l'un des types CONNUS du compte (son URI figure dans
   * `/event_types` avec l'URL de réservation configurée) ? `null` = type
   * inconnu : le classement retombe sur le nom, comme en production.
   */
  readonly typeConnu: TypeConnuSimule | null;
  /** Début du rendez-vous (ISO 8601). */
  readonly debut: string;
  readonly dureeMinutes: number;
  readonly invite: { readonly nom: string; readonly email: string };
  /**
   * Le `tracking` de l'invité tel que Calendly le rend (`utm_content` porte le
   * marqueur `fa-<id>` d'un lien de réservation formateur). Absent = `{}`.
   */
  readonly tracking?: Readonly<Record<string, string>>;
  /** L'invité a annulé : l'API rend `status: "canceled"`, la liste ne le montre plus. */
  readonly annule?: boolean;
}

const API = "https://api.calendly.com";

/** Un rendez-vous fictif, daté dans `joursPlusTard` jours à 10 h UTC. */
export function rendezVousFictif(entree: {
  readonly nomType: string;
  readonly typeConnu: TypeConnuSimule | null;
  readonly prenom: string;
  readonly joursPlusTard?: number;
  readonly dureeMinutes?: number;
  /** Début exact (ISO 8601) — prime sur `joursPlusTard`. */
  readonly debut?: string;
  /** Adresse imposée (la même personne sur deux réservations). */
  readonly email?: string;
  readonly tracking?: Readonly<Record<string, string>>;
}): RendezVousSimule {
  const cle = randomUUID().slice(0, 8);
  const debut = new Date();
  debut.setUTCDate(debut.getUTCDate() + (entree.joursPlusTard ?? 3));
  debut.setUTCHours(10, 0, 0, 0);
  return {
    ...(entree.tracking ? { tracking: entree.tracking } : {}),
    cle,
    nomType: entree.nomType,
    typeConnu: entree.typeConnu,
    debut: entree.debut ?? debut.toISOString(),
    dureeMinutes: entree.dureeMinutes ?? 30,
    invite: {
      nom: `${entree.prenom} Banc-Essai`,
      email: entree.email ?? `${entree.prenom.toLowerCase()}.${cle}@example.test`,
    },
  };
}

/** URI de l'événement planifié — c'est elle que `calendly_events.event_uri` porte. */
export function eventUriDe(rdv: RendezVousSimule): string {
  return `${API}/scheduled_events/BANC-${rdv.cle}`;
}

/** URI de l'invité (`calendly_events.invitee_uri`). */
export function inviteeUriDe(rdv: RendezVousSimule): string {
  return `${eventUriDe(rdv)}/invitees/BANC-INV-${rdv.cle}`;
}

/** URI du type : stable pour un type connu, propre au rendez-vous sinon. */
export function eventTypeUriDe(rdv: RendezVousSimule): string {
  return `${API}/event_types/BANC-TYPE-${rdv.typeConnu ?? rdv.cle}`;
}

/** URI d'un type connu, telle que `/event_types` la déclare. */
export function eventTypeUriConnu(type: TypeConnuSimule): string {
  return `${API}/event_types/BANC-TYPE-${type}`;
}

/** URI de l'utilisateur Calendly simulé (`/users/me`). */
export const UTILISATEUR_SIMULE = `${API}/users/BANC-UTILISATEUR`;

/**
 * Corps d'une livraison `invitee.created`, au format de Calendly (v2). La route
 * ne lit que `event` ; le reste est là pour que le corps signé ressemble à une
 * vraie livraison, octet pour octet sérialisé une seule fois.
 */
export function corpsInviteeCreated(rdv: RendezVousSimule): string {
  return corpsLivraison(rdv, "invitee.created");
}

/** Corps d'une livraison `invitee.canceled` — signée comme toute autre. */
export function corpsInviteeCanceled(rdv: RendezVousSimule): string {
  return corpsLivraison({ ...rdv, annule: true }, "invitee.canceled");
}

function corpsLivraison(rdv: RendezVousSimule, evenement: string): string {
  return JSON.stringify({
    event: evenement,
    created_at: new Date().toISOString(),
    created_by: UTILISATEUR_SIMULE,
    payload: {
      uri: inviteeUriDe(rdv),
      event: eventUriDe(rdv),
      name: rdv.invite.nom,
      email: rdv.invite.email,
      status: rdv.annule ? "canceled" : "active",
      tracking: rdv.tracking ?? {},
      scheduled_event: {
        uri: eventUriDe(rdv),
        name: rdv.nomType,
        event_type: eventTypeUriDe(rdv),
        start_time: rdv.debut,
      },
    },
  });
}
