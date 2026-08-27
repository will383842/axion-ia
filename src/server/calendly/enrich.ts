// Enrichissement d'un `CalendlyEvent` depuis l'API Calendly v2 (ADR 0036).
//
// Sépare volontairement l'accès réseau (`./api`) de l'écriture en base (ici),
// pour que la logique d'application soit testable sans stub HTTP.
//
// Deux appelants :
//   1. `POST /api/calendly/client-event` — juste après la capture postMessage.
//   2. `enrichCalendlyEventAction` — bouton admin (rattrapage d'une ligne
//      ancienne, ou re-synchro après annulation côté Calendly).
//
// Règle d'écriture, en deux moitiés :
//
//   • l'admin est propriétaire du QUI — nom, email, téléphone, lieu, notes. Un
//     enrichissement tardif ne doit jamais effacer ce qui a été recopié à la
//     main depuis Gmail : ces champs ne sont écrits que s'ils sont vides.
//   • Calendly est propriétaire du QUAND — horaire et statut. Garder une
//     ancienne heure après un déplacement d'invité produirait une fiche qui
//     ment, ce qui est pire que pas de fiche du tout pour un agenda.
//
// Seul le statut terminal posé après coup est protégé : il décrit ce qui s'est
// passé pendant l'appel, et l'humain qui l'a saisi a vu l'appel.
//
// ── L'ISSUE DU RDV VA AUSSI AU CRM (2026-08-18) ───────────────────────────────
//
// Ce module détectait déjà les annulations tout seul, mais il ne le disait qu'à
// Telegram : il n'importait pas `@/server/crm-sync`. L'automatisation existait
// donc pour l'AFFICHAGE et pas pour la SYNCHRO — le CRM n'apprenait une
// annulation que si quelqu'un repassait le statut à la main dans la console,
// alors que la PRISE de rendez-vous, elle, part toute seule depuis `discover.ts`.
// C'était une asymétrie, pas une décision.
//
// Deux statuts partent d'ici, et deux seulement :
//   · `canceled` — l'invité (ou l'hôte) a annulé côté Calendly ;
//   · `no_show`  — l'hôte a coché « Mark as no-show ». Contrairement à ce qu'on
//     a longtemps écrit ici, l'API le sait : l'invitee porte `no_show`.
//
// `completed` reste MANUEL, et ce n'est pas un oubli : rien dans l'API ne dit
// qu'un rendez-vous a été honoré. Une règle temporelle (« l'heure de fin est
// passée depuis N heures ⇒ honoré ») affirmerait au CRM un fait commercial que
// personne n'a constaté — et un rendez-vous passé n'a pas forcément eu lieu.

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { notify } from "@/server/notifications";
import { syncCalendlyEventToCrm } from "@/server/crm-sync";
import { fetchCalendlyInvitee, isCalendlyApiConfigured } from "./api";

export type EnrichOutcome =
  | {
      ok: true;
      updatedFields: string[];
      /**
       * Réponses libres du formulaire Calendly, NON persistées (la colonne
       * `notes` appartient à l'admin) — transmises à l'appelant pour la
       * notification de création uniquement.
       */
      answersText: string | null;
    }
  | { ok: false; reason: string };

/**
 * État Calendly → enum `CalendlyEventStatus`.
 *
 * `noShow` l'emporte sur l'annulation : quand les deux sont vrais, c'est que
 * l'hôte a annulé le créneau APRÈS avoir constaté l'absence. Garder « annulé »
 * dans ce cas effacerait l'information la plus utile des deux.
 */
function mapCalendlyStatus(
  raw: string | null,
  noShow: boolean,
): "scheduled" | "canceled" | "no_show" | null {
  if (noShow) return "no_show";
  if (raw === "canceled") return "canceled";
  if (raw === "active") return "scheduled";
  return null;
}

/**
 * Enrichit une ligne `calendly_events` à partir de ses URI stockées.
 *
 * Ne throw jamais : toute erreur remonte en `{ ok: false, reason }`. Le
 * contexte d'appel principal est un beacon navigateur — l'échec de
 * l'enrichissement ne doit jamais faire échouer la capture elle-même.
 */
export async function enrichCalendlyEvent(eventId: string): Promise<EnrichOutcome> {
  if (!isCalendlyApiConfigured()) return { ok: false, reason: "not_configured" };

  let row: {
    id: string;
    eventUri: string | null;
    inviteeUri: string | null;
    inviteeName: string | null;
    inviteeEmail: string | null;
    inviteePhone: string | null;
    startTime: Date | null;
    endTime: Date | null;
    location: string | null;
    status: string;
    eventTypeName: string;
    eventTypeSlug: string;
    cancelUrl: string | null;
    rescheduleUrl: string | null;
    rawPayload: unknown;
  } | null;
  try {
    row = await prisma.calendlyEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        eventUri: true,
        inviteeUri: true,
        inviteeName: true,
        inviteeEmail: true,
        inviteePhone: true,
        startTime: true,
        endTime: true,
        location: true,
        status: true,
        eventTypeName: true,
        eventTypeSlug: true,
        cancelUrl: true,
        rescheduleUrl: true,
        rawPayload: true,
      },
    });
  } catch (e) {
    Sentry.captureException(e);
    return { ok: false, reason: "db_read_failed" };
  }
  // Distinct de `not_found` (qui signifie « Calendly ne connaît plus l'event ») :
  // ici c'est notre propre ligne qui manque.
  if (!row) return { ok: false, reason: "not_found_local" };
  if (!row.inviteeUri) return { ok: false, reason: "no_invitee_uri" };

  const res = await fetchCalendlyInvitee(row.inviteeUri, row.eventUri);
  if (!res.ok) return { ok: false, reason: res.reason };

  const d = res.data;
  const data: Record<string, unknown> = {};
  const updatedFields: string[] = [];
  const setIfEmpty = <T>(field: string, current: T | null, incoming: T | null): void => {
    if (current == null && incoming != null) {
      data[field] = incoming;
      updatedFields.push(field);
    }
  };

  setIfEmpty("inviteeName", row.inviteeName, d.inviteeName);
  setIfEmpty("inviteeEmail", row.inviteeEmail, d.inviteeEmail);
  setIfEmpty("inviteePhone", row.inviteePhone, d.inviteePhone);
  setIfEmpty("location", row.location, d.location);
  setIfEmpty("cancelUrl", row.cancelUrl, d.cancelUrl);
  setIfEmpty("rescheduleUrl", row.rescheduleUrl, d.rescheduleUrl);
  if (d.timezone) {
    data["timezone"] = d.timezone;
    updatedFields.push("timezone");
  }

  // Le nom lisible de l'event-type remplace le slug technique tant que
  // personne ne l'a renommé à la main (à la capture on n'a que le slug).
  if (d.eventTypeName && row.eventTypeName === row.eventTypeSlug) {
    data["eventTypeName"] = d.eventTypeName;
    updatedFields.push("eventTypeName");
  }

  // ── Champs dont Calendly est propriétaire ────────────────────────────────
  //
  // L'HORAIRE et le STATUT échappent à la règle « ne jamais écraser une saisie
  // humaine », et c'est délibéré : Calendly est le système de référence du
  // *quand*. Si un invité déplace son créneau depuis le mail Calendly, garder
  // l'ancienne heure sous prétexte qu'un humain l'avait recopiée produirait une
  // fiche qui ment — le pire résultat possible pour un agenda. L'admin reste
  // propriétaire du *qui* (nom, email, téléphone), que l'API ne fait que
  // compléter quand c'est vide.
  //
  // Ces deux transitions sont aussi les seules occasions de savoir qu'un RDV a
  // bougé : sans webhook (Calendly Free), rien d'autre ne le signale.
  const rescheduled =
    d.startTime != null &&
    row.startTime != null &&
    d.startTime.getTime() !== row.startTime.getTime();
  if (d.startTime != null && d.startTime.getTime() !== (row.startTime?.getTime() ?? NaN)) {
    data["startTime"] = d.startTime;
    updatedFields.push("startTime");
  }
  if (d.endTime != null && d.endTime.getTime() !== (row.endTime?.getTime() ?? NaN)) {
    data["endTime"] = d.endTime;
    updatedFields.push("endTime");
  }

  // On ne rétrograde jamais un statut posé manuellement en fin de parcours
  // (`completed` / `no_show`) : il décrit ce qui s'est réellement passé pendant
  // l'appel, ce que l'API ne peut pas savoir.
  const mapped = mapCalendlyStatus(d.calendlyStatus, d.noShow);
  const terminal = row.status === "completed" || row.status === "no_show";
  const canceled = mapped === "canceled" && row.status !== "canceled" && !terminal;
  const noShow = mapped === "no_show" && !terminal;
  if (mapped && mapped !== row.status && !terminal) {
    data["status"] = mapped;
    updatedFields.push("status");
  }

  // ── La charge brute, remontee a chaque passage ───────────────────────────
  //
  // 🔴 ELLE N'ETAIT ECRITE QU'A LA CAPTURE. Le statut, les horaires et le
  // telephone se rafraichissaient ici pendant qu'elle vieillissait sur place :
  // le 2026-08-27, une fiche affichait « Annule » au-dessus d'un JSON qui disait
  // encore `"status": "active"`. Le statut avait raison — verifie sur trois
  // sources, dont l'agenda Google ou l'evenement avait bel et bien disparu —
  // mais l'ecran donnait a lire deux verites d'ages differents sans les dater.
  //
  // ⚠️ ON PRESERVE LES CLES PRIVEES, prefixees `_`. `rawPayload._ipHash` est
  // interroge par `api/calendly/client-event` (`path: ["_ipHash"]`) pour
  // reconnaitre un renvoi du meme visiteur. L'ecraser ne casserait RIEN de
  // visible : la requete ne trouverait simplement plus rien, et le garde-fou
  // anti-abus s'eteindrait en silence. C'est exactement le genre de panne qu'on
  // ne decouvre qu'apres.
  const ancienBrut =
    typeof row.rawPayload === "object" && row.rawPayload !== null
      ? (row.rawPayload as Record<string, unknown>)
      : {};
  const clesPrivees = Object.fromEntries(
    Object.entries(ancienBrut).filter(([cle]) => cle.startsWith("_")),
  );
  // ⚠️ ON N'ECRIT QUE SI ON A REELLEMENT QUELQUE CHOSE. Remplacer une charge
  // brute existante par un objet vide detruirait la seule trace exploitable d'un
  // cas litigieux — et cette fonction promet, en tete de fichier, de ne jamais
  // lever : lire `d.raw.invitee` sans garde suffirait a violer ce contrat le
  // jour ou un appelant rendrait la forme courte.
  const brutFrais = d.raw;
  if (
    brutFrais &&
    (Object.keys(brutFrais.invitee).length > 0 || Object.keys(brutFrais.event).length > 0)
  ) {
    data["rawPayload"] = {
      ...clesPrivees,
      invitee: brutFrais.invitee,
      event: brutFrais.event,
      _refreshedAt: new Date().toISOString(),
    } as never;
    // ⚠️ VOLONTAIREMENT ABSENT de `updatedFields`. Ce tableau annonce ce qui a
    // CHANGE pour la fiche — il alimente le journal et l'alerte. La charge brute
    // change a chaque passage, ne serait-ce que par son horodatage : l'y inscrire
    // ferait passer toute fiche pour modifiee a chaque sondage, et noierait les
    // vrais changements (un deplacement, une annulation) sous du bruit.
  }

  try {
    await prisma.calendlyEvent.update({
      where: { id: eventId },
      data: { ...data, enrichedAt: new Date() },
    });
  } catch (e) {
    Sentry.captureException(e);
    return { ok: false, reason: "db_write_failed" };
  }

  const inviteeEmail = (data["inviteeEmail"] as string | undefined) ?? row.inviteeEmail ?? "";
  // Le nom et le type de RDV viennent de la ligne, complétés par ce que
  // l'enrichissement vient d'écrire. Sans eux, l'alerte disait seulement
  // « annulation » + un identifiant technique : illisible depuis un téléphone,
  // et il fallait ouvrir la console pour savoir DE QUEL rendez-vous il s'agit.
  const inviteeName = (data["inviteeName"] as string | undefined) ?? row.inviteeName ?? undefined;
  const eventName = (data["eventTypeName"] as string | undefined) ?? row.eventTypeName ?? undefined;
  // L'horaire le plus récent : celui que l'enrichissement vient d'écrire s'il a
  // bougé, sinon celui de la ligne.
  const occurredAt = (data["startTime"] as Date | undefined) ?? row.startTime;

  // ── Synchro CRM (lot L2) ────────────────────────────────────────────────────
  //
  // Émise sur TRANSITION seulement (`canceled` / `noShow` sont déjà des gardes
  // de changement d'état) : chaque émission porte un `event_id` neuf, donc
  // re-sonder toutes les 10 minutes une ligne déjà annulée dupliquerait
  // l'interaction dans la timeline CRM.
  //
  // Sans adresse d'invité, pas de clé de personne — rien ne part, exactement
  // comme dans `discover.ts` et `admin-calendly/actions.ts`.
  //
  // `syncCalendlyEventToCrm` ne lève jamais et n'appelle aucun réseau (l'émission
  // part par l'outbox) ; le try/catch reste par principe : un échec de synchro ne
  // doit pas faire passer un enrichissement réussi pour un échec.
  if ((canceled || noShow) && inviteeEmail) {
    try {
      await syncCalendlyEventToCrm({
        kind: canceled ? "canceled" : "no_show",
        subjectRef: `site:calendly_event:${eventId}`,
        sourceSlug: "calendly",
        ...(occurredAt ? { occurredAt } : {}),
        person: {
          email: inviteeEmail,
          fullName: inviteeName ?? null,
          phone: (data["inviteePhone"] as string | undefined) ?? row.inviteePhone ?? null,
        },
        payload: { eventTypeName: eventName ?? row.eventTypeName, source: "api_poll" },
      });
    } catch (e) {
      Sentry.captureException(e);
    }
  }

  // Alerte Telegram sur les deux évènements qu'on avait rendus détectables. Les
  // catégories existaient depuis l'ADR 0030 mais n'avaient AUCUN émetteur : sans
  // webhook, rien ne pouvait constater une annulation. Best-effort strict —
  // `notify()` ne throw pas, et un échec d'alerte ne doit pas faire passer un
  // enrichissement réussi pour un échec.
  if (canceled || rescheduled) {
    try {
      if (canceled) {
        await notify({
          category: "CALENDLY_INVITEE_CANCELED",
          payload: {
            eventUri: eventId,
            inviteeEmail,
            reason: "Annulation constatée côté Calendly",
            ...(inviteeName ? { inviteeName } : {}),
            ...(eventName ? { eventName } : {}),
            ...(row.startTime ? { eventStartTime: row.startTime.toISOString() } : {}),
          },
          // Une annulation ne doit être annoncée qu'une fois, même si
          // l'enrichissement est relancé à la main derrière.
          dedupKey: `cal-cancel-${eventId}`,
          dedupTtlSec: 86_400,
        });
      } else if (rescheduled && row.startTime && d.startTime) {
        await notify({
          category: "CALENDLY_INVITEE_RESCHEDULED",
          payload: {
            eventUri: eventId,
            inviteeEmail,
            oldStart: row.startTime.toISOString(),
            newStart: d.startTime.toISOString(),
            ...(inviteeName ? { inviteeName } : {}),
            ...(eventName ? { eventName } : {}),
          },
          dedupKey: `cal-resched-${eventId}-${d.startTime.toISOString()}`,
          dedupTtlSec: 86_400,
        });
      }
    } catch (e) {
      Sentry.captureException(e);
    }
  }

  return { ok: true, updatedFields, answersText: d.answersText };
}
