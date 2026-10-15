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
import { LIBELLE_CANAL, type CanalRendezVous } from "@/server/calendly/canal";
import { typeEffectif } from "@/server/calendly/type-effectif";
import { estTypeRendezVous, LIBELLES_TYPE_RENDEZ_VOUS } from "@/server/calendly/type-rendez-vous";
import { enteteClient, formatParisDateTime, humanDateOrText, titreReservation } from "./format";
import { lienConsole } from "./personne";
import type { CategorieClient } from "./routing";
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
function typeRdv(p: { eventName?: string; typeRendezVous?: string }): string | undefined {
  const nom = p.eventName?.trim();
  if (nom) return nom;
  return estTypeRendezVous(p.typeRendezVous)
    ? LIBELLES_TYPE_RENDEZ_VOUS[p.typeRendezVous]
    : undefined;
}

/**
 * Le TYPE de demande, en clair — « Audit IA », « Formation IA »,
 * « Diagnostic IA réservé ». Une nature de demande, JAMAIS une donnée de la
 * personne : c'est aussi ce que reçoit la sonnette WhatsApp.
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

/** « Libellé : valeur », ou rien quand la valeur manque. */
function ligne(libelle: string, valeur: string | number | null | undefined): string | null {
  if (valeur === null || valeur === undefined) return null;
  const texte = String(valeur).trim();
  // Les marqueurs « (non communiqué) » des émetteurs n'apprennent rien.
  if (texte === "" || texte === "—" || /^\(.*\)$/.test(texte)) return null;
  return `${libelle} : ${texte}`;
}

/** Un bloc de texte libre, en entier, sous son titre. */
function bloc(titre: string, texte: string | undefined): string[] {
  const t = texte?.trim();
  return t ? ["", `${titre} :`, t] : [];
}

function utm(p: {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
}): string | undefined {
  const parties = [
    p.utmSource ? `source ${p.utmSource}` : null,
    p.utmMedium ? `support ${p.utmMedium}` : null,
    p.utmCampaign ? `campagne ${p.utmCampaign}` : null,
    p.utmContent ? `contenu ${p.utmContent}` : null,
  ].filter((v): v is string => v !== null);
  return parties.length > 0 ? parties.join(" · ") : undefined;
}

function format(v: string | undefined): string | undefined {
  if (!v || v === "inconnu") return undefined;
  return v in LIBELLE_CANAL ? LIBELLE_CANAL[v as CanalRendezVous] : v;
}

function corps(event: EvenementClient): string[] {
  switch (event.category) {
    case "CLIENT_CALL_BOOKED": {
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
    case "CLIENT_CALL_CANCELED": {
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
    case "CLIENT_CALL_RESCHEDULED": {
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

/** Retire les lignes vides en double et en bout de message. */
function compacter(lignes: string[]): string[] {
  const sortie: string[] = [];
  for (const l of lignes) {
    if (l === "" && (sortie.length === 0 || sortie.at(-1) === "")) continue;
    sortie.push(l);
  }
  while (sortie.at(-1) === "") sortie.pop();
  return sortie;
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
    ...corps(event),
  ]).join("\n");
}
