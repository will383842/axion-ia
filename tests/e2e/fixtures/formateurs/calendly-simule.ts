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
}

const API = "https://api.calendly.com";

/** Un rendez-vous fictif, daté dans `joursPlusTard` jours à 10 h UTC. */
export function rendezVousFictif(entree: {
  readonly nomType: string;
  readonly typeConnu: TypeConnuSimule | null;
  readonly prenom: string;
  readonly joursPlusTard?: number;
  readonly dureeMinutes?: number;
}): RendezVousSimule {
  const cle = randomUUID().slice(0, 8);
  const debut = new Date();
  debut.setUTCDate(debut.getUTCDate() + (entree.joursPlusTard ?? 3));
  debut.setUTCHours(10, 0, 0, 0);
  return {
    cle,
    nomType: entree.nomType,
    typeConnu: entree.typeConnu,
    debut: debut.toISOString(),
    dureeMinutes: entree.dureeMinutes ?? 30,
    invite: {
      nom: `${entree.prenom} Banc-Essai`,
      email: `${entree.prenom.toLowerCase()}.${cle}@example.test`,
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
  return JSON.stringify({
    event: "invitee.created",
    created_at: new Date().toISOString(),
    created_by: UTILISATEUR_SIMULE,
    payload: {
      uri: inviteeUriDe(rdv),
      event: eventUriDe(rdv),
      name: rdv.invite.nom,
      email: rdv.invite.email,
      status: "active",
      scheduled_event: {
        uri: eventUriDe(rdv),
        name: rdv.nomType,
        event_type: eventTypeUriDe(rdv),
        start_time: rdv.debut,
      },
    },
  });
}
