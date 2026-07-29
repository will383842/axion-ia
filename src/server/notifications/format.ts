// Hub notifications — format Telegram MarkdownV2 (Sprint Notif Infra 2026-05-26).
//
// MarkdownV2 nécessite l'échappement de 18 caractères réservés. Sinon Telegram
// renvoie `Bad Request: can't parse entities`. Cf.
// https://core.telegram.org/bots/api#markdownv2-style

import type { NotificationCategory, NotificationEvent, NotificationSeverity } from "./types";
import { careerCategoryLabel } from "@/content/careers/categories";
import { adminPath } from "@/lib/admin-path";
import { SITE_URL } from "@/lib/seo";

const SEVERITY_EMOJI: Record<NotificationSeverity, string> = {
  info: "🟢",
  warn: "🟡",
  error: "🔴",
  critical: "🚨",
};

const TITLES: Record<NotificationCategory, string> = {
  CONTACT_FORM_SUBMITTED: "Nouveau message contact",
  AUDIT_REQUEST_SUBMITTED: "Nouvelle demande d'audit IA",
  INTERVENTION_REQUEST_SUBMITTED: "Nouvelle demande d'intervention",
  IMPLEMENTATION_REQUEST_SUBMITTED: "Nouvelle demande d'implémentation",
  QUOTE_REQUEST_RECEIVED: "Nouvelle demande de devis",
  PRESS_REQUEST_SUBMITTED: "📰 Demande presse / média",
  RECRUITMENT_RECEIVED: "👤 Candidature reçue",
  JOB_APPLICATION_RECEIVED: "📨 Candidature emploi reçue",
  REVIEW_SUBMITTED: "⭐ Nouvel avis client (à modérer)",
  PODCAST_REQUEST_SUBMITTED: "🎙️ Demande de tournage podcast",
  SPEAKER_INVITATION_RECEIVED: "🎤 Invitation conférence",
  INVESTOR_INQUIRY_RECEIVED: "💼 Demande investisseur / M&A",
  CUSTOMER_SUPPORT_REQUEST: "🛟 Support client",
  NEWSLETTER_PENDING: "Newsletter — opt-in en attente",
  NEWSLETTER_CONFIRMED: "Newsletter — opt-in confirmé",
  NEWSLETTER_UNSUBSCRIBED: "Newsletter — désinscription",
  BOOKING_CREATED: "Nouvelle réservation",
  BOOKING_CANCELLED: "Réservation annulée",
  OPTION_POSTED: "Option 48h posée",
  OPTION_CONFIRMED: "Option confirmée",
  OPTION_REFUSED: "Option refusée",
  OPTION_EXPIRED: "Option expirée",
  CALENDLY_INVITEE_CREATED: "Nouvelle réservation Calendly",
  CALENDLY_INVITEE_CANCELED: "Calendly — annulation",
  CALENDLY_INVITEE_RESCHEDULED: "Calendly — déplacement",
  ADMIN_REPLIED_TO_SUBMISSION: "Réponse admin envoyée",
  DEPLOY_SUCCESS: "Déploiement réussi",
  DEPLOY_FAILED: "Échec déploiement",
  BACKUP_SUCCESS: "Sauvegarde réussie",
  BACKUP_FAILED: "Échec sauvegarde",
  INCIDENT_DETECTED: "Incident détecté",
  SECURITY_ALERT: "Alerte sécurité",
  STRIPE_EVENT: "Stripe — événement",
  STRIPE_WEBHOOK_SIGNATURE_FAIL: "Stripe — signature webhook invalide",
  MONITORING_ALERT: "Alerte monitoring",
};

const MD_V2_RESERVED = /[_*[\]()~`>#+\-=|{}.!\\]/g;

/** Échappe les 18 caractères réservés MarkdownV2 de Telegram. */
export function escapeMarkdownV2(text: string): string {
  return text.replace(MD_V2_RESERVED, (c) => `\\${c}`);
}

// Inverse exacte de `escapeMarkdownV2` : retire le `\` que l'on a ajouté devant
// chaque caractère réservé. Comme TOUT le texte produit par `formatNotification`
// est passé par `escapeMarkdownV2`, chaque `\` présent EST un backslash d'échappement
// → l'inversion est exacte (aucune sur-suppression). Les marqueurs de structure
// `*label*` (gras) NE sont PAS précédés d'un `\` (ajoutés après échappement) donc
// ils survivent — et WhatsApp rend nativement `*gras*`.
const MD_V2_UNESCAPE = /\\([_*[\]()~`>#+\-=|{}.!\\])/g;

/** Convertit un message MarkdownV2 (Telegram) en texte plain lisible par WhatsApp. */
export function markdownV2ToPlain(text: string): string {
  return text.replace(MD_V2_UNESCAPE, "$1");
}

/** Formatte une date ISO/Date en Europe/Paris (style FR humain). */
export function formatParisDateTime(input: string | Date | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function formatKV(label: string, value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return `• *${escapeMarkdownV2(label)}* : ${escapeMarkdownV2(String(value))}`;
}

/**
 * Extrait le corps texte des call-sites legacy passés via `sendTelegram()`
 * (`@/lib/telegram`), dont le payload a la forme `{ kind, details: { legacyBody } }`.
 * Retourne null si ce shape est absent.
 *
 * Sans ça, la branche INCIDENT_DETECTED (qui ne lit que title/url/statusCode/error)
 * rendait un message **vide** pour tout appel legacy `sendTelegram({ tag: "INCIDENT" })`,
 * et MONITORING_ALERT affichait le JSON brut `{"legacyBody":"…"}` illisible.
 */
function legacyBodyOf(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "details" in payload) {
    const details = (payload as { details?: unknown }).details;
    if (details && typeof details === "object" && "legacyBody" in details) {
      const lb = (details as { legacyBody?: unknown }).legacyBody;
      if (typeof lb === "string" && lb.trim().length > 0) return lb;
    }
  }
  return null;
}

function formatBody(event: NotificationEvent): string {
  switch (event.category) {
    case "CONTACT_FORM_SUBMITTED":
    case "AUDIT_REQUEST_SUBMITTED":
    case "INTERVENTION_REQUEST_SUBMITTED":
    case "IMPLEMENTATION_REQUEST_SUBMITTED":
    case "QUOTE_REQUEST_RECEIVED":
    case "PRESS_REQUEST_SUBMITTED":
    case "RECRUITMENT_RECEIVED":
    case "SPEAKER_INVITATION_RECEIVED":
    case "INVESTOR_INQUIRY_RECEIVED":
    case "CUSTOMER_SUPPORT_REQUEST": {
      const p = event.payload;
      const lines = [
        formatKV("Nom", p.contactName),
        formatKV("Email", p.contactEmail),
        "contactPhone" in p ? formatKV("Téléphone", p.contactPhone) : null,
        "ville" in p ? formatKV("Ville", p.ville) : null,
        "companyName" in p ? formatKV("Société", p.companyName) : null,
        "companySize" in p ? formatKV("Taille", p.companySize) : null,
        "budgetIndicative" in p ? formatKV("Budget", p.budgetIndicative) : null,
        "timingWeeks" in p ? formatKV("Timing", p.timingWeeks) : null,
        "subType" in p ? formatKV("Sous-type", p.subType) : null,
        "scope" in p ? formatKV("Scope", p.scope) : null,
        "urgency" in p ? formatKV("Urgence", p.urgency) : null,
        "budget" in p ? formatKV("Budget", p.budget) : null,
        // Champs spécifiques aux 5 demandes périphériques (Form v2)
        "outlet" in p ? formatKV("Média", p.outlet) : null,
        "deadline" in p ? formatKV("Deadline", p.deadline) : null,
        "position" in p ? formatKV("Poste visé", p.position) : null,
        "eventName" in p ? formatKV("Événement", p.eventName) : null,
        "eventDate" in p ? formatKV("Date événement", p.eventDate) : null,
        "firm" in p ? formatKV("Société", p.firm) : null,
        "source" in p ? formatKV("Source", p.source) : null,
        formatKV("Locale", p.locale),
        formatKV("ID", p.submissionId),
      ].filter((v): v is string => v !== null);
      return lines.join("\n");
    }
    case "JOB_APPLICATION_RECEIVED": {
      const p = event.payload;
      return [
        formatKV("Candidat", p.contactName),
        formatKV("Email", p.contactEmail),
        p.contactPhone ? formatKV("Téléphone", p.contactPhone) : null,
        formatKV("Offre", p.offerTitle),
        p.offerCategory ? formatKV("Catégorie", careerCategoryLabel(p.offerCategory, true)) : null,
        p.city ? formatKV("Ville", p.city) : null,
        p.salaryExpectation ? formatKV("Prétention", p.salaryExpectation) : null,
        formatKV("CV", p.hasCv ? "joint ✅" : "non fourni"),
        p.hasPhoto ? formatKV("Photo", "jointe ✅") : null,
        formatKV(
          "Voir en console",
          `${SITE_URL}${adminPath("fr", "contacts/candidatures")}/${p.applicationId}`,
        ),
      ]
        .filter((v): v is string => v !== null)
        .join("\n");
    }
    case "REVIEW_SUBMITTED": {
      const p = event.payload;
      return [
        formatKV("Auteur", p.authorName),
        formatKV("Note", `${p.rating}/5 ★`),
        p.companyName ? formatKV("Société", p.companyName) : null,
        p.clientSector ? formatKV("Secteur", p.clientSector) : null,
        p.city ? formatKV("Ville", p.city) : null,
        p.serviceLine ? formatKV("Service", p.serviceLine) : null,
        formatKV("Photo", p.hasPhoto ? "jointe ✅" : "aucune"),
        p.excerpt ? formatKV("Extrait", p.excerpt.slice(0, 160)) : null,
        formatKV("Modérer en console", `${SITE_URL}${adminPath("fr", "avis")}/${p.reviewId}`),
      ]
        .filter((v): v is string => v !== null)
        .join("\n");
    }
    case "PODCAST_REQUEST_SUBMITTED": {
      const p = event.payload;
      return [
        formatKV("Entreprise", p.companyName),
        formatKV("Dirigeant", p.leaderName),
        formatKV("Email", p.contactEmail),
        formatKV("Téléphone", p.contactPhone),
        formatKV("Lieu du tournage", `${p.city} (${p.postalCode})`),
        p.activityExcerpt ? formatKV("Activité", p.activityExcerpt.slice(0, 200)) : null,
        p.source ? formatKV("Source", p.source) : null,
        formatKV("Voir en console", `${SITE_URL}${adminPath("fr", "podcast")}/${p.requestId}`),
      ]
        .filter((v): v is string => v !== null)
        .join("\n");
    }
    case "NEWSLETTER_PENDING":
    case "NEWSLETTER_CONFIRMED":
    case "NEWSLETTER_UNSUBSCRIBED": {
      const p = event.payload;
      return [formatKV("Email", p.email), formatKV("Locale", p.locale)]
        .filter((v): v is string => v !== null)
        .join("\n");
    }
    case "BOOKING_CREATED":
    case "BOOKING_CANCELLED":
    case "OPTION_POSTED":
    case "OPTION_CONFIRMED":
    case "OPTION_REFUSED":
    case "OPTION_EXPIRED": {
      const p = event.payload as Record<string, string | number | undefined>;
      const order = [
        "bookingId",
        "serviceType",
        "contactName",
        "contactEmail",
        "bookingDate",
        "expiresAt",
        "admin",
        "cancelledBy",
        "reason",
      ];
      return order
        .map((k) => formatKV(k, p[k]))
        .filter((v): v is string => v !== null)
        .join("\n");
    }
    case "CALENDLY_INVITEE_CREATED": {
      const p = event.payload;
      // `eventUri` porte l'id de la ligne `calendly_events` (pas l'URI Calendly) :
      // c'est ce que passe `POST /api/calendly/client-event`. On en fait donc un
      // lien direct vers la fiche — l'alerte ne se contentait jusqu'ici d'afficher
      // un identifiant brut, inexploitable depuis le téléphone.
      return [
        formatKV("Type RDV", p.eventName),
        formatKV("Invitee", p.inviteeName),
        formatKV("Email", p.inviteeEmail),
        formatKV("Début", p.eventStartTime),
        formatKV("Page", p.pageUrl),
        formatKV("UTM source", p.utmSource),
        formatKV("UTM campagne", p.utmCampaign),
        formatKV(
          "Voir en console",
          `${SITE_URL}${adminPath("fr", "contacts/appels")}/${p.eventUri}`,
        ),
      ]
        .filter((v): v is string => v !== null)
        .join("\n");
    }
    case "CALENDLY_INVITEE_CANCELED": {
      const p = event.payload;
      return [
        formatKV("Email", p.inviteeEmail),
        formatKV("Raison", p.reason),
        formatKV("ID", p.eventUri),
      ]
        .filter((v): v is string => v !== null)
        .join("\n");
    }
    case "CALENDLY_INVITEE_RESCHEDULED": {
      const p = event.payload;
      return [
        formatKV("Email", p.inviteeEmail),
        formatKV("Avant", p.oldStart),
        formatKV("Après", p.newStart),
        formatKV("ID", p.eventUri),
      ]
        .filter((v): v is string => v !== null)
        .join("\n");
    }
    case "ADMIN_REPLIED_TO_SUBMISSION": {
      const p = event.payload;
      return [
        formatKV("Par", p.repliedBy),
        formatKV("À", p.toEmail),
        formatKV("Sujet", p.subject),
        formatKV("Submission", p.submissionId),
      ]
        .filter((v): v is string => v !== null)
        .join("\n");
    }
    case "DEPLOY_SUCCESS":
    case "DEPLOY_FAILED": {
      const p = event.payload;
      return [
        formatKV("SHA", p.sha),
        formatKV("Durée (s)", p.duration),
        formatKV("Erreur", p.error?.slice(0, 500)),
      ]
        .filter((v): v is string => v !== null)
        .join("\n");
    }
    case "BACKUP_SUCCESS":
    case "BACKUP_FAILED": {
      const p = event.payload;
      return [
        formatKV("Type", p.type),
        formatKV("Taille (B)", p.size),
        formatKV("Erreur", p.error?.slice(0, 500)),
      ]
        .filter((v): v is string => v !== null)
        .join("\n");
    }
    case "INCIDENT_DETECTED": {
      const p = event.payload;
      const structured = [
        formatKV("Titre", p.title),
        formatKV("URL", p.url),
        formatKV("Statut HTTP", p.statusCode),
        formatKV("User", p.userId),
        formatKV("Erreur", p.error?.slice(0, 500)),
      ].filter((v): v is string => v !== null);
      if (structured.length > 0) return structured.join("\n");
      // Fallback legacy : `sendTelegram({ tag: "INCIDENT", body })` fournit
      // `{ details: { legacyBody } }` — sans ceci le message partait VIDE.
      const legacy = legacyBodyOf(p);
      return legacy ? escapeMarkdownV2(legacy) : "";
    }
    case "SECURITY_ALERT": {
      const p = event.payload;
      return [
        formatKV("Type", p.kind),
        formatKV("IP", p.ip),
        formatKV("Détails", JSON.stringify(p.details).slice(0, 800)),
      ]
        .filter((v): v is string => v !== null)
        .join("\n");
    }
    case "STRIPE_EVENT": {
      const p = event.payload;
      return [
        formatKV("Type événement", p.eventType),
        formatKV("Object", p.objectId),
        formatKV("Montant", p.amount),
      ]
        .filter((v): v is string => v !== null)
        .join("\n");
    }
    case "STRIPE_WEBHOOK_SIGNATURE_FAIL": {
      const p = event.payload;
      return [formatKV("IP", p.ip)].filter((v): v is string => v !== null).join("\n");
    }
    case "MONITORING_ALERT": {
      const p = event.payload;
      // Priorité au corps lisible legacy (sendTelegram) — évite d'afficher le
      // JSON brut `{"legacyBody":"…"}` que voyaient les alertes web-vitals/review.
      const legacy = legacyBodyOf(p);
      if (legacy) return escapeMarkdownV2(legacy);
      return [
        formatKV("Type", p.kind),
        formatKV("Détails", JSON.stringify(p.details).slice(0, 800)),
      ]
        .filter((v): v is string => v !== null)
        .join("\n");
    }
  }
}

export interface FormattedMessage {
  /** Texte MarkdownV2 prêt pour Telegram. */
  text: string;
}

/** Produit le message MarkdownV2 final pour Telegram. */
export function formatNotification(
  event: NotificationEvent,
  severity: NotificationSeverity,
): FormattedMessage {
  const emoji = SEVERITY_EMOJI[severity];
  const title = TITLES[event.category];
  const header = `${emoji} *${escapeMarkdownV2(title)}*`;
  const body = formatBody(event);
  const footer = [
    `🕐 ${escapeMarkdownV2(formatParisDateTime(new Date()))}`,
    `🏷️ ${escapeMarkdownV2(event.category)}`,
  ].join(" · ");
  return { text: [header, "", body, "", footer].join("\n") };
}

/**
 * Variante plain-text pour WhatsApp (CallMeBot). Dérivée de `formatNotification`
 * (même corps/mêmes champs) puis « déMarkdownisée » : on retire l'échappement
 * MarkdownV2, on garde les `*gras*` que WhatsApp rend nativement.
 */
export function formatNotificationPlain(
  event: NotificationEvent,
  severity: NotificationSeverity,
): FormattedMessage {
  return { text: markdownV2ToPlain(formatNotification(event, severity).text) };
}
