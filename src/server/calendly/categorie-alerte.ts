// La catégorie d'alerte d'un rendez-vous Calendly : client, ou pas (décision
// Will 15/10).
//
// Le salon Telegram « Clients » reçoit les réservations, annulations et reports
// des CLIENTS, avec tout le détail. Les échanges avec un candidat apporteur ou
// un formateur indépendant restent dans le salon 📅 Calendly, allégés. Le tri
// se fait ICI, au point d'appel, sur le type de l'événement — avec le prédicat
// commun « hors clients » (`estEchangeHorsClients`), le même que celui des
// e-mails, du CRM et du dossier client : un rendez-vous ne peut pas être client
// pour l'un et pas pour l'autre.
//
// Module feuille, sans `server-only` : le worker du sondage l'importe.

import { estEchangeHorsClients } from "@/server/calendly/appel-apporteur";

export type EvenementCalendly = "reservation" | "annulation" | "report";

const CATEGORIES = {
  reservation: { client: "CLIENT_CALL_BOOKED", autre: "CALENDLY_INVITEE_CREATED" },
  annulation: { client: "CLIENT_CALL_CANCELED", autre: "CALENDLY_INVITEE_CANCELED" },
  report: { client: "CLIENT_CALL_RESCHEDULED", autre: "CALENDLY_INVITEE_RESCHEDULED" },
} as const;

type Categories = typeof CATEGORIES;

/**
 * `CLIENT_CALL_*` pour un client (diagnostic, échange projet, salon, autre),
 * `CALENDLY_INVITEE_*` pour un échange apporteur ou formateur.
 */
export function categorieAlerteCalendly<E extends EvenementCalendly>(
  evenement: E,
  rdv: {
    readonly typeRendezVous?: string | null | undefined;
    readonly eventTypeName?: string | null | undefined;
  },
): Categories[E]["client"] | Categories[E]["autre"] {
  return estEchangeHorsClients(rdv) ? CATEGORIES[evenement].autre : CATEGORIES[evenement].client;
}
