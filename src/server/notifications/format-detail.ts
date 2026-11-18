// Le message COMPLET des salons dédiés autres que « Clients » (décision du fondateur, 14/11/2026).
//
// Même principe que le salon « Clients » (`format-clients.ts`) : dans un salon DÉDIÉ, et
// seulement là, l'alerte porte tout le détail (nom complet, e-mail, téléphone, message
// intégral, provenance, lien console) pour répondre sans ouvrir la console. Catégories :
// rendez-vous Calendly non-client, presse, investisseurs, avis, podcast, conférences.
//
// ⚠️ Texte brut. Quand le salon dédié n'existe pas, `index.ts` retombe sur le gabarit ALLÉGÉ
// (`format.ts`) : jamais de coordonnées dans un salon de repli.

import { formatParisDateTime } from "./format";
import { typeRdv, lignesDetailClient, type EvenementCalendlyNonClient } from "./format-clients";
import { lienConsole } from "./personne";
import { bloc, compacter, ligne } from "./texte-brut";
import type { NotificationEvent } from "./types";

type CategorieDetailEvt =
  | "PRESS_REQUEST_SUBMITTED"
  | "INVESTOR_INQUIRY_RECEIVED"
  | "REVIEW_SUBMITTED"
  | "PODCAST_REQUEST_SUBMITTED"
  | "SPEAKER_INVITATION_RECEIVED";

/** Un événement dont le message complet part au salon dédié. */
export type EvenementDetail =
  EvenementCalendlyNonClient | Extract<NotificationEvent, { category: CategorieDetailEvt }>;

function entete(event: EvenementDetail): string {
  switch (event.category) {
    case "CALENDLY_INVITEE_CREATED":
      return `📅 RDV APPORTEUR / FORMATEUR — ${typeRdv(event.payload) ?? "Rendez-vous"}`;
    case "CALENDLY_INVITEE_CANCELED":
      return `📅 RDV APPORTEUR / FORMATEUR ANNULÉ — ${typeRdv(event.payload) ?? "Rendez-vous"}`;
    case "CALENDLY_INVITEE_RESCHEDULED":
      return `📅 RDV APPORTEUR / FORMATEUR REPORTÉ — ${typeRdv(event.payload) ?? "Rendez-vous"}`;
    case "PRESS_REQUEST_SUBMITTED":
      return `📰 PRESSE — ${event.payload.outlet?.trim() || "Demande presse / média"}`;
    case "INVESTOR_INQUIRY_RECEIVED":
      return `💰 INVESTISSEUR — ${event.payload.firm?.trim() || "Demande investisseur / M&A"}`;
    case "REVIEW_SUBMITTED":
      return `⭐ AVIS — ${event.payload.rating}/5 ★`;
    case "PODCAST_REQUEST_SUBMITTED":
      return `🎙️ PODCAST — ${event.payload.companyName.trim()}`;
    case "SPEAKER_INVITATION_RECEIVED":
      return `🎤 CONFÉRENCE — ${event.payload.eventName?.trim() || "Invitation"}`;
  }
}

function corps(event: EvenementDetail): string[] {
  switch (event.category) {
    case "CALENDLY_INVITEE_CREATED":
    case "CALENDLY_INVITEE_CANCELED":
    case "CALENDLY_INVITEE_RESCHEDULED":
      return lignesDetailClient(event);
    case "PRESS_REQUEST_SUBMITTED": {
      const p = event.payload;
      return [
        ligne("Nom", p.contactName),
        ligne("Média", p.outlet),
        ligne("E-mail", p.contactEmail),
        ligne("Téléphone", p.contactPhone),
        ligne("Échéance", p.deadline),
        ligne("Source", p.source),
        ...bloc("Message", p.message),
        "",
        ligne("Fiche", lienConsole(`contacts/messages/${p.submissionId}`)),
      ].filter((l): l is string => l !== null);
    }
    case "INVESTOR_INQUIRY_RECEIVED": {
      const p = event.payload;
      return [
        ligne("Nom", p.contactName),
        ligne("Société", p.firm),
        ligne("E-mail", p.contactEmail),
        ligne("Téléphone", p.contactPhone),
        ligne("Source", p.source),
        ...bloc("Message", p.message),
        "",
        ligne("Fiche", lienConsole(`contacts/messages/${p.submissionId}`)),
      ].filter((l): l is string => l !== null);
    }
    case "REVIEW_SUBMITTED": {
      const p = event.payload;
      return [
        ligne("Auteur", p.authorName),
        ligne("Note", `${p.rating}/5 ★`),
        ligne("Société", p.companyName),
        ligne("Secteur", p.clientSector),
        ligne("Ville", p.city),
        ligne("Service", p.serviceLine),
        ligne("Photo", p.hasPhoto ? "jointe" : "aucune"),
        ...bloc("Début du commentaire", p.excerpt),
        "",
        ligne("Modérer", lienConsole(`avis/${p.reviewId}`)),
      ].filter((l): l is string => l !== null);
    }
    case "PODCAST_REQUEST_SUBMITTED": {
      const p = event.payload;
      return [
        ligne("Dirigeant", p.leaderName),
        ligne("Entreprise", p.companyName),
        ligne("E-mail", p.contactEmail),
        ligne("Téléphone", p.contactPhone),
        ligne("Ville", `${p.city} ${p.postalCode}`),
        ligne("Source", p.source),
        ...bloc("Activité", p.activityExcerpt),
        ...bloc("Message", p.message),
        "",
        ligne("Fiche", lienConsole(`podcast/${p.requestId}`)),
      ].filter((l): l is string => l !== null);
    }
    case "SPEAKER_INVITATION_RECEIVED": {
      const p = event.payload;
      return [
        ligne("Nom", p.contactName),
        ligne("E-mail", p.contactEmail),
        ligne("Téléphone", p.contactPhone),
        ligne("Événement", p.eventName),
        ligne("Date", p.eventDate),
        ligne("Source", p.source),
        ...bloc("Message", p.message),
        "",
        ligne("Fiche", lienConsole(`contacts/messages/${p.submissionId}`)),
      ].filter((l): l is string => l !== null);
    }
  }
}

/** Le message COMPLET d'un salon dédié, en texte brut (première ligne : l'en-tête). */
export function formatNotificationDetail(event: EvenementDetail, maintenant = new Date()): string {
  return compacter([
    entete(event),
    `Reçu le ${formatParisDateTime(maintenant)} (heure de Paris)`,
    "",
    ...corps(event),
  ]).join("\n");
}
