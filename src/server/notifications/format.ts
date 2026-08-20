// Hub notifications — format Telegram MarkdownV2 (Sprint Notif Infra 2026-05-26).
//
// MarkdownV2 nécessite l'échappement de 18 caractères réservés. Sinon Telegram
// renvoie `Bad Request: can't parse entities`. Cf.
// https://core.telegram.org/bots/api#markdownv2-style

import type {
  CrmSyncAlertKind,
  NotificationCategory,
  NotificationEvent,
  NotificationSeverity,
} from "./types";
import { telegramGroupFor, type TelegramGroup } from "./routing";
import { careerCategoryLabel } from "@/content/careers/categories";
import { adminPath } from "@/lib/admin-path";
import { SITE_URL } from "@/lib/site-url";

const SEVERITY_EMOJI: Record<NotificationSeverity, string> = {
  info: "🟢",
  warn: "🟡",
  error: "🔴",
  critical: "🚨",
};

/**
 * En-tête de THÈME, posé en tête de message (refonte 2026-08-09).
 *
 * Sur Telegram il double le nom du groupe — utile, car le bandeau de
 * notification du téléphone ne montre pas toujours dans quel groupe on écrit.
 *
 * Sur WhatsApp il porte TOUTE la distinction : CallMeBot n'écrit que dans une
 * seule conversation (une clé = un destinataire, pas de groupes), donc il n'y a
 * pas de fil séparé possible. Ces ~20 caractères sont exactement ce que l'écran
 * verrouillé affiche — c'est là, et nulle part ailleurs, que se joue le fait de
 * distinguer un rendez-vous d'une candidature sans ouvrir le téléphone.
 *
 * ⚠️ NE PAS déplacer en fin de message ni faire précéder d'autre chose.
 */
const THEME: Record<TelegramGroup, { emoji: string; label: string }> = {
  calendly: { emoji: "📅", label: "CALENDLY" },
  candidatures: { emoji: "💼", label: "CANDIDATURE" },
  "monteur-video": { emoji: "🎬", label: "MONTEUR VIDÉO" },
  "commercial-memo": { emoji: "🧲", label: "COMMERCIAL MÉMO" },
  presse: { emoji: "📰", label: "PRESSE" },
  investisseurs: { emoji: "💰", label: "INVESTISSEUR" },
  interventions: { emoji: "🛠️", label: "INTERVENTION" },
  avis: { emoji: "⭐", label: "AVIS CLIENT" },
  messages: { emoji: "💬", label: "MESSAGE" },
  "crm-sync": { emoji: "🔗", label: "SYNCHRO CRM" },
  system: { emoji: "🔔", label: "SYSTÈME" },
};

// Les titres ne portent plus d'emoji : depuis le 2026-08-09 l'iconographie vient
// du THÈME ci-dessus, seule source. Un `📰` dans le titre en plus du `📰` du
// thème donnait « 📰 PRESSE · 🟢 📰 Demande presse » — illisible.
const TITLES: Record<NotificationCategory, string> = {
  CONTACT_FORM_SUBMITTED: "Nouveau message contact",
  AUDIT_REQUEST_SUBMITTED: "Nouvelle demande d'audit IA",
  INTERVENTION_REQUEST_SUBMITTED: "Nouvelle demande d'intervention",
  IMPLEMENTATION_REQUEST_SUBMITTED: "Nouvelle demande d'implémentation",
  QUOTE_REQUEST_RECEIVED: "Nouvelle demande de devis",
  PRESS_REQUEST_SUBMITTED: "Demande presse / média",
  RECRUITMENT_RECEIVED: "Candidature spontanée",
  JOB_APPLICATION_RECEIVED: "Candidature à une offre",
  VIDEO_EDITOR_APPLICATION_RECEIVED: "Candidature monteur vidéo",
  COMMERCIAL_APPLICATION_RECEIVED: "Candidature commercial",
  JOB_OFFERS_STALE: "Offres d'emploi à republier",
  REVIEW_SUBMITTED: "Nouvel avis à modérer",
  PODCAST_REQUEST_SUBMITTED: "Demande de tournage podcast",
  RGPD_REQUEST_SUBMITTED: "⚖️ Demande RGPD — délai 1 mois",
  SPEAKER_INVITATION_RECEIVED: "Invitation conférence",
  INVESTOR_INQUIRY_RECEIVED: "Demande investisseur / M&A",
  CUSTOMER_SUPPORT_REQUEST: "Support client",
  NEWSLETTER_PENDING: "Newsletter — opt-in en attente",
  NEWSLETTER_CONFIRMED: "Newsletter — opt-in confirmé",
  NEWSLETTER_UNSUBSCRIBED: "Newsletter — désinscription",
  BOOKING_CREATED: "Nouvelle réservation",
  BOOKING_CANCELLED: "Réservation annulée",
  OPTION_POSTED: "Option 48h posée",
  OPTION_CONFIRMED: "Option confirmée",
  OPTION_REFUSED: "Option refusée",
  OPTION_EXPIRED: "Option expirée",
  CALENDLY_INVITEE_CREATED: "Nouvelle réservation",
  CALENDLY_INVITEE_CANCELED: "Rendez-vous annulé",
  CALENDLY_INVITEE_RESCHEDULED: "Rendez-vous déplacé",
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
  CRM_SYNC_ALERT: "Synchro CRM — anomalie",
};

/**
 * Libellé humain de chaque anomalie de synchro.
 *
 * `Record<CrmSyncAlertKind, …>` : ajouter un `kind` sans son libellé ne compile
 * pas. Une alerte dont on ne saurait pas dire ce qu'elle signale ne vaudrait
 * pas mieux que pas d'alerte du tout.
 */
const CRM_SYNC_ALERT_LABELS: Record<CrmSyncAlertKind, string> = {
  gave_up: "Abandon définitif — le lead n'arrivera pas au CRM",
  backlog: "File d'attente au-dessus du seuil",
  reconcile_gap: "Enregistrements source sans ligne d'outbox",
  reconcile_failed: "Échec du batch de réconciliation",
  scan_capped: "Balayage d'abonnés plafonné — un optout CRM peut être raté",
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

/** Reconnaît un horodatage ISO 8601 — et RIEN d'autre. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * Rend lisible un champ qui porte tantôt un instant ISO, tantôt du texte libre.
 *
 * Les payloads Calendly mélangent les deux : `discover.ts` envoie un ISO quand
 * l'API a donné l'horaire, et la chaîne « (voir mail Calendly) » quand elle ne
 * l'a pas donné. Jusqu'ici les deux étaient affichés bruts — un
 * `2026-08-20T07:30:00.000Z` dans une notification de téléphone est illisible,
 * et c'est en plus de l'heure UTC, donc faux de deux heures pour un lecteur français.
 *
 * 🔴 Le test ISO est volontairement STRICT (pas un `new Date()` opportuniste) :
 * `new Date("2026")` est une date valide pour JavaScript, donc un texte libre
 * commençant par une année se ferait silencieusement réécrire en 1er janvier.
 */
function humanDateOrText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return ISO_INSTANT.test(value) ? formatParisDateTime(value) : value;
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
        // Le CONTENU du message, en tête (demande Will 2026-08-12) : c'est ce
        // qu'on veut lire depuis le téléphone, avant les métadonnées.
        "message" in p ? formatKV("Message", p.message) : null,
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
    case "JOB_APPLICATION_RECEIVED":
    case "VIDEO_EDITOR_APPLICATION_RECEIVED": {
      const p = event.payload;
      return [
        formatKV("Candidat", p.contactName),
        formatKV("Email", p.contactEmail),
        p.contactPhone ? formatKV("Téléphone", p.contactPhone) : null,
        formatKV("Offre", p.offerTitle),
        p.offerCategory ? formatKV("Catégorie", careerCategoryLabel(p.offerCategory, true)) : null,
        p.city ? formatKV("Ville", p.city) : null,
        p.salaryExpectation ? formatKV("Prétention", p.salaryExpectation) : null,
        p.motivationExcerpt ? formatKV("Motivation", p.motivationExcerpt) : null,
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
    case "COMMERCIAL_APPLICATION_RECEIVED": {
      // Message COURT par choix : les 6 champs qui permettent de juger la
      // candidature depuis l'écran verrouillé. Le récap complet (expériences,
      // pitch, message libre) vit dans l'email interne + la console.
      const p = event.payload;
      return [
        formatKV("Candidat", p.contactName),
        p.ville ? formatKV("Ville", p.ville) : null,
        p.zone ? formatKV("Zone souhaitée", p.zone) : null,
        p.b2bYears ? formatKV("Expérience B2B", p.b2bYears) : null,
        p.availability ? formatKV("Disponible", p.availability) : null,
        formatKV("Utilise l'IA", p.usesAi ? "oui" : "non"),
        formatKV(
          "Voir en console",
          `${SITE_URL}${adminPath("fr", "contacts/commercial")}/${p.submissionId}`,
        ),
      ]
        .filter((v): v is string => v !== null)
        .join("\n");
    }
    case "JOB_OFFERS_STALE": {
      const p = event.payload;
      const lines = p.offers.map((o) =>
        formatKV(o.kind === "statique" ? "Page statique" : "Offre", `${o.title} — ${o.daysOld} j`),
      );
      return [
        formatKV("Seuil", `${p.thresholdDays} jours sans republication`),
        ...lines,
        formatKV("Republier en console", `${SITE_URL}${adminPath("fr", "offres-emploi")}`),
        formatKV(
          "Règle",
          "republier UNIQUEMENT si l'offre est toujours ouverte (bouton Republier) — les pages statiques passent par une modif de code",
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
    case "RGPD_REQUEST_SUBMITTED": {
      const p = event.payload;
      return [
        formatKV("Nature", p.type === "suppression" ? "Effacement (art. 17)" : "Accès (art. 15)"),
        // 🔴 `D5-5-06` — identité MASQUÉE : ce message part hors UE. Le lien
        // console qui suit est ce qui rend le masquage sans coût : l'équipe
        // clique et voit le dossier complet, au lieu de lire un nom dans
        // Telegram. Sans lui, la rédaction se paierait en aller-retours.
        formatKV("Personne", p.traineeNomMasque),
        formatKV("Email", p.traineeEmailMasque),
        formatKV("À traiter avant le", p.echeance),
        formatKV("Référence", p.demandeId),
        formatKV("Voir en console", `${SITE_URL}${adminPath("fr", "qualiopi/rgpd")}`),
      ].join("\n");
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
        formatKV("Invité", p.inviteeName),
        formatKV("Email", p.inviteeEmail),
        formatKV("Téléphone", p.inviteePhone),
        formatKV("Début", humanDateOrText(p.eventStartTime)),
        formatKV("Réponses formulaire", p.answersText),
        formatKV("Page", p.pageUrl),
        formatKV("UTM source", p.utmSource),
        formatKV("UTM campagne", p.utmCampaign),
        formatKV(
          "Voir en console",
          `${SITE_URL}${adminPath("fr", "contacts/appels")}/${p.eventUri}`,
        ),
        formatKV("Annuler / déplacer", p.cancelUrl),
      ]
        .filter((v): v is string => v !== null)
        .join("\n");
    }
    case "CALENDLY_INVITEE_CANCELED": {
      const p = event.payload;
      return [
        formatKV("Type RDV", p.eventName),
        formatKV("Invité", p.inviteeName),
        formatKV("Email", p.inviteeEmail),
        formatKV("Était prévu le", humanDateOrText(p.eventStartTime)),
        formatKV("Raison", p.reason),
        formatKV(
          "Voir en console",
          `${SITE_URL}${adminPath("fr", "contacts/appels")}/${p.eventUri}`,
        ),
      ]
        .filter((v): v is string => v !== null)
        .join("\n");
    }
    case "CALENDLY_INVITEE_RESCHEDULED": {
      const p = event.payload;
      return [
        formatKV("Type RDV", p.eventName),
        formatKV("Invité", p.inviteeName),
        formatKV("Email", p.inviteeEmail),
        formatKV("Avant", humanDateOrText(p.oldStart)),
        formatKV("Après", humanDateOrText(p.newStart)),
        formatKV(
          "Voir en console",
          `${SITE_URL}${adminPath("fr", "contacts/appels")}/${p.eventUri}`,
        ),
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
        formatKV("Branche", p.branch),
        formatKV("SHA", p.sha),
        formatKV("Auteur", p.actor),
        formatKV("Commit", p.subject?.slice(0, 160)),
        formatKV("Durée (s)", p.duration),
        formatKV("Erreur", p.error?.slice(0, 500)),
        formatKV("Run", p.runUrl),
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
    case "CRM_SYNC_ALERT": {
      const p = event.payload;
      return [
        formatKV("Anomalie", CRM_SYNC_ALERT_LABELS[p.kind]),
        formatKV("Nombre", p.count),
        formatKV("Source", p.subjectRef),
        formatKV("Détail", p.detail?.slice(0, 400)),
        formatKV("Console", `${SITE_URL}${adminPath("fr", "synchro-crm")}`),
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
  const theme = THEME[telegramGroupFor(event.category)];
  const header =
    `${theme.emoji} *${escapeMarkdownV2(theme.label)}* · ` +
    `${emoji} *${escapeMarkdownV2(title)}*`;
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
