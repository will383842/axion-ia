// Le message COMPLET du salon Telegram « Clients » (décision Will 15/10).
//
// Will a manqué des demandes de clients : l'alerte allégée du 11/10/2026
// (prénom + initiale + lien) l'obligeait à ouvrir la console pour savoir QUI
// rappeler et POURQUOI, et elle partait sans son. Décision du 15/10 : dans le
// salon « Clients », et SEULEMENT là, l'alerte porte TOUT — nom complet,
// coordonnées, entreprise, le message intégral, la provenance — pour qu'il
// réponde sans détour.
//
// 🔑 TEXTE BRUT, jamais MarkdownV2 : le message porte du texte libre (un
// message, un motif d'annulation, une réponse de formulaire), et un seul `_`
// ou `[` mal fermé suffirait à faire refuser l'envoi par Telegram. Envoyé sans
// `parse_mode`, aucun caractère ne peut le casser.
//
// 🔑 PAS DE PLAFOND de 800 caractères / 10 lignes ici : le texte est découpé
// en plusieurs messages sous la limite de l'API (`decouperPourTelegram`).
//
// ⚠️ Tous les AUTRES salons gardent le gabarit allégé (`format.ts`) : ce module
// n'est appelé que pour le salon dédié (`index.ts`, `envoyerAuSalonClients`).
// Quand le salon n'existe pas encore, l'alerte retombe dans sa route d'avant
// avec le gabarit allégé — jamais les coordonnées dans un autre salon.

import { UNIFIED_TYPE_LABELS } from "@/features/admin-submissions/type-labels";
import { typeEffectif } from "@/server/calendly/type-effectif";
import { estTypeRendezVous, LIBELLES_TYPE_RENDEZ_VOUS } from "@/server/calendly/type-rendez-vous";
import { enteteClient, formatParisDateTime, humanDateOrText, titreReservation } from "./format";
import { lienConsole } from "./personne";
import type { CategorieClient } from "./routing";
import { bloc, compacter, format, ligne, utm } from "./texte-brut";
import type { NotificationEvent } from "./types";

/**
 * Le payload d'une catégorie. Pas un `Extract` : `CLIENT_CALL_BOOKED` partage
 * son membre d'union avec `CALENDLY_INVITEE_CREATED` (`category: A | B`), qu'un
 * `Extract<…, { category: B }>` ne retiendrait pas.
 */
type PayloadDe<C extends CategorieClient> = NotificationEvent extends infer E
  ? E extends { category: infer K; payload: infer P }
    ? C extends K
      ? P
      : never
    : never
  : never;

/** Un événement dont la catégorie est celle d'un client. */
export type EvenementClient = {
  [C in CategorieClient]: { category: C; payload: PayloadDe<C> };
}[CategorieClient];

/**
 * Les trois rendez-vous Calendly qui ne sont PAS ceux d'un client (apporteur, formateur…).
 * Ils partagent le membre d'union de `CLIENT_CALL_*` : même payload, même corps de message.
 */
export type EvenementCalendlyNonClient =
  | { category: "CALENDLY_INVITEE_CREATED"; payload: PayloadDe<"CLIENT_CALL_BOOKED"> }
  | { category: "CALENDLY_INVITEE_CANCELED"; payload: PayloadDe<"CLIENT_CALL_CANCELED"> }
  | { category: "CALENDLY_INVITEE_RESCHEDULED"; payload: PayloadDe<"CLIENT_CALL_RESCHEDULED"> };

/** Libellés des types que le formulaire unifié ne connaît pas. */
const TYPES_HORS_FORMULAIRE: Readonly<Record<string, string>> = {
  simulateur_roi_rappel: "Simulateur de gains — rappel demandé",
};

/** Le type de demande par défaut de chaque catégorie de formulaire. */
const TYPE_PAR_CATEGORIE: Readonly<Record<string, string>> = {
  CONTACT_FORM_SUBMITTED: "Message de contact",
  AUDIT_REQUEST_SUBMITTED: "Audit IA",
  INTERVENTION_REQUEST_SUBMITTED: "Intervention",
  IMPLEMENTATION_REQUEST_SUBMITTED: "Intégration sur-mesure",
  QUOTE_REQUEST_RECEIVED: "Devis sur projet",
  CUSTOMER_SUPPORT_REQUEST: "Support client",
  CHATBOT_LEAD_CAPTURED: "Lead chatbot",
  CHATBOT_ESCALATION: "Question chatbot sans réponse",
};

const TAILLES: Readonly<Record<string, string>> = {
  tpe: "TPE",
  pme: "PME",
  eti: "ETI",
  grande_entreprise: "Grande entreprise",
};

const DELAIS: Readonly<Record<string, string>> = {
  "0-4": "0 à 4 semaines",
  "4-8": "4 à 8 semaines",
  "8-12": "8 à 12 semaines",
  "12+": "plus de 12 semaines",
};

function enClair(
  table: Readonly<Record<string, string>>,
  v: string | undefined,
): string | undefined {
  if (!v) return undefined;
  return table[v] ?? v;
}

/** Le type de RDV lisible : le nom Calendly, sinon le type classé. */
export function typeRdv(p: { eventName?: string; typeRendezVous?: string }): string | undefined {
  const nom = p.eventName?.trim();
  if (nom) return nom;
  return estTypeRendezVous(p.typeRendezVous)
    ? LIBELLES_TYPE_RENDEZ_VOUS[p.typeRendezVous]
    : undefined;
}

/**
 * Le TYPE de demande, en clair — « Audit IA », « Formation IA »,
 * « Diagnostic IA réservé ». Une nature de demande, JAMAIS une donnée de la
 * personne : c'est le libellé sans aucune donnée personnelle.
 */
export function libelleTypeDemande(event: EvenementClient): string {
  switch (event.category) {
    case "CLIENT_CALL_BOOKED": {
      const p = event.payload;
      const typeClasse = estTypeRendezVous(p.typeRendezVous) ? p.typeRendezVous : null;
      return titreReservation(
        typeEffectif({ typeRendezVous: typeClasse, eventTypeName: p.eventName }),
        p.eventName,
        p.besoin ?? null,
      );
    }
    case "CLIENT_CALL_CANCELED":
    case "CLIENT_CALL_RESCHEDULED":
      return typeRdv(event.payload) ?? "Rendez-vous";
    case "CHATBOT_LEAD_CAPTURED":
    case "CHATBOT_ESCALATION":
      return TYPE_PAR_CATEGORIE[event.category]!;
    default: {
      const formType = event.payload.formType;
      const libelle = formType
        ? (UNIFIED_TYPE_LABELS[formType] ?? TYPES_HORS_FORMULAIRE[formType])
        : undefined;
      return libelle ?? TYPE_PAR_CATEGORIE[event.category] ?? "Demande";
    }
  }
}

/**
 * Le TYPE de demande, sans aucune donnée de la personne (ex-sonnette WhatsApp, coupée le 14/11/2026).
 *
 * 🔴 Relecture PR 1553 : `libelleTypeDemande` recopiait le `besoin` d'un
 * échange projet dans le titre — un texte LIBRE écrit par le client, qui peut
 * porter son nom ou son numéro. Ici, AUCUN champ libre n'est lu : seulement
 * des libellés de catalogue (type classé, type de formulaire, catégorie). Le
 * nom d'un type Calendly ne sert qu'à CLASSER, jamais à être recopié.
 */
export function libelleTypeDemandeSansDonnee(event: EvenementClient): string {
  switch (event.category) {
    case "CLIENT_CALL_BOOKED": {
      const p = event.payload;
      const typeClasse = estTypeRendezVous(p.typeRendezVous) ? p.typeRendezVous : null;
      // `besoin` à `null` : le titre ne recopie aucun texte du client.
      return titreReservation(
        typeEffectif({ typeRendezVous: typeClasse, eventTypeName: p.eventName }),
        p.eventName,
        null,
      );
    }
    case "CLIENT_CALL_CANCELED":
    case "CLIENT_CALL_RESCHEDULED": {
      const p = event.payload;
      const type = typeEffectif({
        typeRendezVous: estTypeRendezVous(p.typeRendezVous) ? p.typeRendezVous : null,
        eventTypeName: p.eventName ?? "",
      });
      return type === "autre" ? "Rendez-vous" : LIBELLES_TYPE_RENDEZ_VOUS[type];
    }
    default:
      // Formulaires et chatbot : `libelleTypeDemande` ne lit déjà que des
      // catalogues (`formType` → libellé connu, sinon la catégorie).
      return libelleTypeDemande(event);
  }
}

/**
 * Les lignes de détail d'une demande (nom complet, coordonnées, message intégral…), en texte
 * brut. Réservé aux salons dédiés : jamais envoyé dans un salon de repli.
 */
export function lignesDetailClient(event: EvenementClient | EvenementCalendlyNonClient): string[] {
  switch (event.category) {
    case "CLIENT_CALL_BOOKED":
    case "CALENDLY_INVITEE_CREATED": {
      const p = event.payload;
      return [
        ligne("Type de RDV", typeRdv(p)),
        ligne("Début", humanDateOrText(p.eventStartTime)),
        ligne("Format", format(p.format)),
        ligne("Lieu", p.lieu),
        "",
        ligne("Nom", p.inviteeName),
        ligne("E-mail", p.inviteeEmail),
        ligne("Téléphone", p.inviteePhone),
        ligne("Besoin", p.besoin),
        ...bloc("Réponses aux questions", p.answersText),
        "",
        ligne("Page", p.pageUrl),
        ligne("UTM", utm(p)),
        ligne("Annuler / déplacer", p.cancelUrl),
        ligne("Fiche", lienConsole(`contacts/appels/${p.eventUri}`)),
      ].filter((l): l is string => l !== null);
    }
    case "CLIENT_CALL_CANCELED":
    case "CALENDLY_INVITEE_CANCELED": {
      const p = event.payload;
      const qui =
        p.cancelerType === "host"
          ? `l'hôte${p.canceledBy ? ` (${p.canceledBy})` : ""}`
          : p.canceledBy || (p.cancelerType === "invitee" ? "la personne invitée" : undefined);
      return [
        ligne("Type de RDV", typeRdv(p)),
        ligne("Était prévu le", humanDateOrText(p.eventStartTime)),
        "",
        ligne("Nom", p.inviteeName),
        ligne("E-mail", p.inviteeEmail),
        ligne("Téléphone", p.inviteePhone),
        ligne("Annulé par", qui),
        "",
        "Motif :",
        p.reason?.trim() || "(aucun motif écrit)",
        "",
        ligne("Fiche", lienConsole(`contacts/appels/${p.eventUri}`)),
      ].filter((l): l is string => l !== null);
    }
    case "CLIENT_CALL_RESCHEDULED":
    case "CALENDLY_INVITEE_RESCHEDULED": {
      const p = event.payload;
      return [
        ligne("Type de RDV", typeRdv(p)),
        ligne("Avant", humanDateOrText(p.oldStart)),
        ligne("Après", humanDateOrText(p.newStart)),
        ligne("Format", format(p.format)),
        ligne("Lieu", p.lieu),
        "",
        ligne("Nom", p.inviteeName),
        ligne("E-mail", p.inviteeEmail),
        ligne("Téléphone", p.inviteePhone),
        ligne("Annuler / déplacer", p.cancelUrl),
        ligne("Fiche", lienConsole(`contacts/appels/${p.eventUri}`)),
      ].filter((l): l is string => l !== null);
    }
    case "CHATBOT_LEAD_CAPTURED": {
      const p = event.payload;
      return [
        ligne("Nom", p.contactName),
        ligne("Entreprise", p.companyName),
        ligne("E-mail", p.contactEmail),
        ligne("Téléphone", p.contactPhone),
        ligne("Source", "chatbot du site"),
        ...bloc("Besoin", p.message),
        "",
        ligne("Fiche", lienConsole(`contacts/messages/${p.submissionId}`)),
      ].filter((l): l is string => l !== null);
    }
    case "CHATBOT_ESCALATION": {
      const p = event.payload;
      return [
        ligne("E-mail", p.contactEmail ?? "non fourni"),
        ligne("Escalade", p.escalationId),
        ...bloc("Question", p.question),
        ...bloc("Contexte de la conversation", p.contexte),
        "",
        ligne("Console", lienConsole("chatbot/escalades")),
      ].filter((l): l is string => l !== null);
    }
    default: {
      // Les six formulaires : contact, audit, intervention, implémentation,
      // devis, support. Chaque champ est lu s'il existe dans le payload.
      const p = event.payload as Extract<
        EvenementClient,
        { category: "CONTACT_FORM_SUBMITTED" }
      >["payload"] & {
        urgency?: string;
        scope?: string;
        budget?: string;
      };
      return [
        ligne("Sous-type", p.subType),
        "",
        ligne("Nom", p.contactName),
        ligne("Entreprise", p.companyName),
        ligne("E-mail", p.contactEmail),
        ligne("Téléphone", p.contactPhone),
        ligne("Ville", p.ville),
        ligne("Taille", enClair(TAILLES, p.companySize)),
        ligne("Secteur", p.companySector),
        ligne("Budget", p.budgetIndicative ?? p.budget),
        // Le simulateur ROI porte son gain estimé dans `budget` seul.
        p.budget && p.budgetIndicative && p.budget !== p.budgetIndicative
          ? ligne("Estimation", p.budget)
          : null,
        ligne("Délai", enClair(DELAIS, p.timingWeeks)),
        ligne("Urgence", p.urgency),
        ligne("Périmètre", p.scope),
        "",
        ligne("Source", p.source),
        ligne("Page", p.pageUrl),
        ligne("UTM", utm(p)),
        ligne("Ville d'origine", p.referrerCity),
        ...bloc("Message", p.message),
        "",
        ligne("Fiche", lienConsole(`contacts/messages/${p.submissionId}`)),
      ].filter((l): l is string => l !== null);
    }
  }
}

/**
 * Le message COMPLET du salon « Clients », en texte brut.
 *
 * Première ligne : « 🔥 NOUVEAU CLIENT — <type> » (ou « ❌ ANNULATION
 * CLIENT », « 🔁 REPORT CLIENT »), puis la date et l'heure de Paris.
 */
export function formatNotificationClient(event: EvenementClient, maintenant = new Date()): string {
  const quand =
    "submittedAt" in event.payload && event.payload.submittedAt
      ? event.payload.submittedAt
      : maintenant;
  return compacter([
    `${enteteClient(event.category)} — ${libelleTypeDemande(event)}`,
    `Reçu le ${formatParisDateTime(quand)} (heure de Paris)`,
    "",
    ...lignesDetailClient(event),
  ]).join("\n");
}
