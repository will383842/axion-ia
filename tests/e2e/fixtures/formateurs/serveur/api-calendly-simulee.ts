// Banc @formateurs — l'API Calendly SIMULÉE, servie au processus `tsx`.
//
// Elle répond exactement aux cinq lectures que la chaîne réelle émet pour une
// réservation (webhook → `discoverNewCalendlyEvents` → `enrichCalendlyEvent`
// → `classerRendezVous`) : `/users/me`, la liste `/scheduled_events`, les
// invités d'un événement, l'invité lui-même, l'événement lui-même — plus
// `/event_types`, d'où le classement par URI tire ses types connus.
//
// 🔑 Les URL de réservation des types connus ne sont PAS recopiées : elles
// viennent de `urlsDeReservationConfigurees()`, la fonction même que le
// classement lit. Changer une URL configurée ne peut donc pas désaccorder le banc.

import { urlsDeReservationConfigurees } from "@/server/calendly/type-rendez-vous";

import {
  eventTypeUriConnu,
  eventTypeUriDe,
  eventUriDe,
  inviteeUriDe,
  UTILISATEUR_SIMULE,
  type RendezVousSimule,
  type TypeConnuSimule,
} from "../calendly-simule";
import { json, type RouteSimulee } from "../reseau-simule";

function evenement(rdv: RendezVousSimule): Record<string, unknown> {
  const fin = new Date(new Date(rdv.debut).getTime() + rdv.dureeMinutes * 60_000);
  return {
    uri: eventUriDe(rdv),
    name: rdv.nomType,
    status: "active",
    event_type: eventTypeUriDe(rdv),
    start_time: rdv.debut,
    end_time: fin.toISOString(),
    location: { type: "google_conference", join_url: `https://visio.example.test/${rdv.cle}` },
  };
}

function invite(rdv: RendezVousSimule): Record<string, unknown> {
  return {
    uri: inviteeUriDe(rdv),
    event: eventUriDe(rdv),
    name: rdv.invite.nom,
    email: rdv.invite.email,
    status: "active",
    timezone: "Europe/Paris",
    no_show: null,
    questions_and_answers: [],
    tracking: {},
    cancel_url: `https://calendly.example.test/cancellations/BANC-${rdv.cle}`,
    reschedule_url: `https://calendly.example.test/reschedulings/BANC-${rdv.cle}`,
  };
}

/** Les types connus du compte simulé : chacun pointe l'URL configurée de son type. */
function typesConnus(): Record<string, unknown>[] {
  const types: TypeConnuSimule[] = ["diagnostic", "apporteur"];
  return types.flatMap((type) => {
    const configuree = urlsDeReservationConfigurees().find((u) => u.type === type);
    return configuree
      ? [{ uri: eventTypeUriConnu(type), scheduling_url: configuree.url, active: true }]
      : [];
  });
}

/** La route qui sert `api.calendly.com` pour les rendez-vous donnés. */
export function apiCalendlySimulee(rendezVous: readonly RendezVousSimule[]): RouteSimulee {
  return (url) => {
    if (url.host !== "api.calendly.com") return null;
    const chemin = url.pathname;

    if (chemin === "/users/me") return json({ resource: { uri: UTILISATEUR_SIMULE } });
    if (chemin === "/event_types") {
      return json({ collection: typesConnus(), pagination: { next_page: null } });
    }
    if (chemin === "/scheduled_events") {
      return json({ collection: rendezVous.map(evenement), pagination: { next_page: null } });
    }
    for (const rdv of rendezVous) {
      const ev = new URL(eventUriDe(rdv)).pathname;
      const inv = new URL(inviteeUriDe(rdv)).pathname;
      if (chemin === ev) return json({ resource: evenement(rdv) });
      if (chemin === `${ev}/invitees`) {
        return json({ collection: [invite(rdv)], pagination: { next_page: null } });
      }
      if (chemin === inv) return json({ resource: invite(rdv) });
    }
    return json({ title: "Resource Not Found", message: "banc @formateurs" }, 404);
  };
}
