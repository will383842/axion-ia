// Hub notifications — routing par catégorie (Sprint Notif Infra 2026-05-26).
//
// Tableau simple `(category) → { channels, severity }`. Modifiable plus tard
// via env var ou table admin sans toucher au code des call-sites.

import type { NotificationCategory, NotificationChannel, NotificationSeverity } from "./types";

interface RoutingEntry {
  channels: NotificationChannel[];
  severity: NotificationSeverity;
  /** Limite de rate (max events / heure). 0 = pas de limite. */
  rateLimitPerHour?: number;
}

const ROUTING: Record<NotificationCategory, RoutingEntry> = {
  // --- Formulaires publics : Telegram + breadcrumb Sentry, sync ---
  CONTACT_FORM_SUBMITTED: { channels: ["telegram"], severity: "info" },
  AUDIT_REQUEST_SUBMITTED: { channels: ["telegram"], severity: "info" },
  INTERVENTION_REQUEST_SUBMITTED: { channels: ["telegram"], severity: "info" },
  IMPLEMENTATION_REQUEST_SUBMITTED: { channels: ["telegram"], severity: "info" },
  QUOTE_REQUEST_RECEIVED: { channels: ["telegram"], severity: "info" },

  // --- Form v2 (2026-05-28) : 5 demandes périphériques. Severity "warn" pour
  // investisseur (signal stratégique fort), "info" pour les 4 autres. ---
  PRESS_REQUEST_SUBMITTED: { channels: ["telegram"], severity: "info" },
  RECRUITMENT_RECEIVED: { channels: ["telegram"], severity: "info" },
  // Rappel hebdo « offres à republier » (cron offres-fraicheur) — maintenance
  // SEO, pas un lead : Telegram seul, jamais WhatsApp.
  JOB_OFFERS_STALE: { channels: ["telegram"], severity: "warn" },
  // Rappel quotidien « candidatures oubliées » — même nature que celui des
  // offres à republier : de la maintenance, pas un lead. Telegram seul.
  JOB_APPLICATIONS_STALE: { channels: ["telegram"], severity: "warn" },
  JOB_APPLICATION_RECEIVED: { channels: ["telegram"], severity: "info" },
  VIDEO_EDITOR_APPLICATION_RECEIVED: { channels: ["telegram"], severity: "info" },
  COMMERCIAL_APPLICATION_RECEIVED: { channels: ["telegram"], severity: "info" },
  REVIEW_SUBMITTED: { channels: ["telegram"], severity: "info" },
  // Demande de tournage podcast (2026-07-21) — lead entrant, Telegram groupe
  // « Messages ». `rateLimitPerHour` volontairement absent : le volume attendu
  // est faible et le rate-limit IP côté Server Action suffit.
  PODCAST_REQUEST_SUBMITTED: { channels: ["telegram"], severity: "info" },
  // `warn` et non `info` : un délai légal court dès le dépôt.
  RGPD_REQUEST_SUBMITTED: { channels: ["telegram"], severity: "warn" },
  SPEAKER_INVITATION_RECEIVED: { channels: ["telegram"], severity: "info" },
  INVESTOR_INQUIRY_RECEIVED: { channels: ["telegram"], severity: "warn" },
  CUSTOMER_SUPPORT_REQUEST: { channels: ["telegram"], severity: "warn" },
  // Chatbot (décision Will 15/10) — sortent de `MONITORING_ALERT`, qui était
  // silencieux et plafonné à 30/h toutes sources confondues.
  CHATBOT_LEAD_CAPTURED: { channels: ["telegram"], severity: "info" },
  CHATBOT_ESCALATION: { channels: ["telegram"], severity: "info" },

  // --- Newsletter ---
  NEWSLETTER_PENDING: { channels: ["telegram"], severity: "info" },
  NEWSLETTER_CONFIRMED: { channels: ["telegram"], severity: "info" },
  NEWSLETTER_UNSUBSCRIBED: { channels: ["telegram"], severity: "info" },

  // --- Guide IA (lot L2, 2026-09-24) ---
  // Bridé à 10 par heure : au-delà, une notification par demande devient du
  // bruit. Le récapitulatif quotidien de la sentinelle (`GUIDE_RECAP`) donne
  // alors les nombres exacts — rien n'est perdu, seul le détail unitaire l'est.
  GUIDE_REQUESTED: { channels: ["telegram"], severity: "info", rateLimitPerHour: 10 },
  GUIDE_RECAP: { channels: ["telegram"], severity: "info" },

  // --- Booking interne ---
  BOOKING_CREATED: { channels: ["telegram"], severity: "info" },
  BOOKING_CANCELLED: { channels: ["telegram"], severity: "warn" },
  OPTION_POSTED: { channels: ["telegram"], severity: "info" },
  OPTION_CONFIRMED: { channels: ["telegram"], severity: "info" },
  OPTION_REFUSED: { channels: ["telegram"], severity: "warn" },
  OPTION_EXPIRED: { channels: ["telegram"], severity: "warn" },

  // --- Calendly ---
  CALENDLY_INVITEE_CREATED: { channels: ["telegram"], severity: "info" },
  CALENDLY_INVITEE_CANCELED: { channels: ["telegram"], severity: "warn" },
  CALENDLY_INVITEE_RESCHEDULED: { channels: ["telegram"], severity: "info" },
  // Les mêmes, pour un CLIENT (décision Will 15/10) : salon « Clients ».
  CLIENT_CALL_BOOKED: { channels: ["telegram"], severity: "info" },
  CLIENT_CALL_CANCELED: { channels: ["telegram"], severity: "warn" },
  CLIENT_CALL_RESCHEDULED: { channels: ["telegram"], severity: "info" },

  // --- Reply admin (Chantier 5) — décision Will figée : pas de notif ---
  ADMIN_REPLIED_TO_SUBMISSION: { channels: [], severity: "info" },
  // --- Réponse entrante d'un candidat apporteur (2026-09-27) ---
  APPORTEUR_REPLIED: { channels: ["telegram"], severity: "info" },
  CANDIDAT_REPLIED: { channels: ["telegram"], severity: "info" },
  TRAINER_DOSSIER_RECU: { channels: ["telegram"], severity: "info" },
  // Questionnaire avant audit (2026-10-26) : une réponse SONNE (warn), le suivi est silencieux
  // (info). Jamais error/critical (file asynchrone) ; hors WhatsApp.
  QUESTIONNAIRE_PREAUDIT_REPONSE: {
    channels: ["telegram"],
    severity: "warn",
    rateLimitPerHour: 30,
  },
  QUESTIONNAIRE_PREAUDIT_SUIVI: { channels: ["telegram"], severity: "info", rateLimitPerHour: 30 },
  TRAINER_PIECE_DEPOSEE: { channels: ["telegram"], severity: "info" },
  // Protection contre la fraude au changement de compte : chaque demande se voit.
  TRAINER_CHANGEMENT_DEMANDE: { channels: ["telegram"], severity: "warn" },
  FORMATEUR_REPLIED: { channels: ["telegram"], severity: "info" },
  CANDIDAT_SELF_ERASED: { channels: ["telegram"], severity: "info" },

  // --- Ops ---
  DEPLOY_SUCCESS: { channels: ["telegram"], severity: "info" },
  DEPLOY_FAILED: { channels: ["telegram", "sentry"], severity: "error" },
  BACKUP_SUCCESS: { channels: ["telegram"], severity: "info" },
  BACKUP_FAILED: { channels: ["telegram", "sentry"], severity: "critical" },
  INCIDENT_DETECTED: { channels: ["telegram", "sentry"], severity: "error" },
  SECURITY_ALERT: {
    channels: ["telegram", "sentry"],
    severity: "critical",
    rateLimitPerHour: 12,
  },
  STRIPE_EVENT: { channels: ["telegram"], severity: "info" },
  STRIPE_WEBHOOK_SIGNATURE_FAIL: {
    channels: ["telegram", "sentry"],
    severity: "warn",
    rateLimitPerHour: 6,
  },
  MONITORING_ALERT: {
    channels: ["telegram"],
    severity: "warn",
    rateLimitPerHour: 30,
  },

  // --- Synchro CRM (lot L5) ---
  //
  // `error` et pas `warn` : un abandon définitif est un lead qui n'arrivera
  // JAMAIS au CRM sans intervention humaine. Le canal Sentry double Telegram
  // pour que l'anomalie survive à un salon non lu.
  //
  // `rateLimitPerHour` est une SECONDE ceinture, pas la première : l'anti-bruit
  // réel est la clé de dédup horaire par `kind` posée dans `crm-sync/alerts.ts`
  // (4 types × 1/h = 4 messages/h au pire). Ce plafond de 12 ne mord donc
  // jamais en fonctionnement nominal — il n'est là que si un futur appelant
  // oubliait la clé de dédup.
  CRM_SYNC_ALERT: {
    channels: ["telegram", "sentry"],
    severity: "error",
    rateLimitPerHour: 12,
  },

  // --- Incidents de données (conformité RGPD, 2026-10-11) ---
  //
  // `warn` et non `error` : l'envoi reste SYNCHRONE (`shouldDispatchAsync`),
  // donc l'appelant sait s'il est parti — c'est ce qui permet au passage horaire
  // de ne noter un rappel comme envoyé qu'une fois réellement envoyé. Jamais
  // silencieux (`info` seul l'est) : un délai légal de 72 h court.
  // Pas de `rateLimitPerHour` : un message par incident et par palier, au plus.
  DATA_INCIDENT_ALERT: { channels: ["telegram"], severity: "warn" },
};

export function getRouting(category: NotificationCategory): RoutingEntry {
  return ROUTING[category];
}

/** Décide si on dispatch sync ou async. */
export function shouldDispatchAsync(severity: NotificationSeverity): boolean {
  // Sync pour info/warn (latence acceptable < 200ms côté Server Action).
  // Async via queue pour error/critical (fire-and-forget, retry possible).
  return severity === "error" || severity === "critical";
}

// ── Routage Telegram par GROUPE THÉMATIQUE (refonte 2026-08-09) ─────────────
//
// Historique : 3 groupes (rdv / messages / system) depuis le 2026-07-09. Trop
// grossier — le groupe « Messages » recevait 12 catégories très différentes
// (une candidature, un investisseur et une demande de devis dans le même fil),
// et le groupe « RDV » mélangeait Calendly avec 6 catégories du tunnel de
// réservation payante éteint. On passe à 8 groupes thématiques (+ le salon 🎬
// monteur vidéo ajouté le 2026-08-12, dédié à une seule offre).
//
// DEUX BOTS : le groupe 📅 Calendly a son propre bot (`TELEGRAM_CALENDLY_BOT_TOKEN`),
// tous les autres gardent le bot historique. Cf. `resolveTelegramTarget()` plus bas,
// qui traite (bot, salon) comme un COUPLE — ne jamais les résoudre séparément.

export type TelegramGroup =
  | "clients"
  | "calendly"
  | "candidatures"
  | "monteur-video"
  | "commercial-memo"
  | "presse"
  | "investisseurs"
  | "interventions"
  | "avis"
  | "messages"
  | "crm-sync"
  | "incidents"
  // Questionnaire avant audit (2026-10-26) : réponses reçues et suivi des relances.
  | "questionnaire-audit"
  | "system";

/**
 * Groupe cible de CHAQUE catégorie.
 *
 * `Record<NotificationCategory, …>` et pas un `Partial` + défaut : le compilateur
 * refuse alors une catégorie oubliée. C'est la seule garde qui tienne dans la
 * durée — l'ancienne version utilisait des `Set` avec un `return "system"` en
 * repli, et c'est exactement comme ça que `REVIEW_SUBMITTED` s'est retrouvé
 * silencieusement dans le groupe des alertes techniques pendant un mois.
 *
 * Ajouter une catégorie dans `types.ts` sans l'ajouter ici ne compile pas.
 */
const CATEGORY_GROUP: Record<NotificationCategory, TelegramGroup> = {
  // 🔥 Clients — RÉSERVÉ aux demandes de clients (décision Will 15/10). Tant
  // que `TELEGRAM_CHAT_ID_CLIENTS` n'est pas posé, chacune repart vers SA route
  // d'avant (`REPLI_CLIENTS`), pour ne rien perdre.
  CONTACT_FORM_SUBMITTED: "clients",
  AUDIT_REQUEST_SUBMITTED: "clients",
  INTERVENTION_REQUEST_SUBMITTED: "clients",
  IMPLEMENTATION_REQUEST_SUBMITTED: "clients",
  QUOTE_REQUEST_RECEIVED: "clients",
  CUSTOMER_SUPPORT_REQUEST: "clients",
  CHATBOT_LEAD_CAPTURED: "clients",
  CHATBOT_ESCALATION: "clients",
  CLIENT_CALL_BOOKED: "clients",
  CLIENT_CALL_CANCELED: "clients",
  CLIENT_CALL_RESCHEDULED: "clients",

  // 📅 Calendly — les rendez-vous qui ne sont PAS des clients : candidats
  // apporteurs et formateurs (décision Will 15/10).
  CALENDLY_INVITEE_CREATED: "calendly",
  CALENDLY_INVITEE_CANCELED: "calendly",
  CALENDLY_INVITEE_RESCHEDULED: "calendly",

  // 💼 Candidatures — offres d'emploi publiées ET candidature spontanée/commerciale.
  JOB_APPLICATION_RECEIVED: "candidatures",
  RECRUITMENT_RECEIVED: "candidatures",
  // Le rappel « offres à republier » vit avec les offres qu'il concerne.
  JOB_OFFERS_STALE: "candidatures",
  // Le rappel des dossiers oubliés vit avec les candidatures qu'il concerne.
  JOB_APPLICATIONS_STALE: "candidatures",
  // La réponse d'un candidat emploi par e-mail (lot L3, 2026-10-07) : avec les
  // candidatures — jamais dans le salon des apporteurs (deux mondes distincts).
  CANDIDAT_REPLIED: "candidatures",
  TRAINER_DOSSIER_RECU: "candidatures",
  QUESTIONNAIRE_PREAUDIT_REPONSE: "questionnaire-audit",
  QUESTIONNAIRE_PREAUDIT_SUIVI: "questionnaire-audit",
  TRAINER_PIECE_DEPOSEE: "candidatures",
  TRAINER_CHANGEMENT_DEMANDE: "candidatures",
  FORMATEUR_REPLIED: "candidatures",
  // L'effacement d'un dossier par le candidat lui-même (2026-10-11).
  CANDIDAT_SELF_ERASED: "candidatures",

  // 🎬 Monteur vidéo — les candidatures à l'offre `monteur-video-freelance-distance`
  // SEULEMENT, dans leur propre salon (demande Will 2026-08-12 : « cette annonce
  // seule, pas mélangée avec les autres offres »). Le tri par offre se fait au
  // call-site (`videoEditorNotificationCategory`), pas ici.
  VIDEO_EDITOR_APPLICATION_RECEIVED: "monteur-video",

  // 🧲 Commercial Mémo — les candidatures commerciales du tunnel sans CV
  // `/devenir-commercial-ia/candidature` (annonce Mémorial de l'Isère) SEULEMENT,
  // dans leur propre salon (même logique que le monteur vidéo : une campagne de
  // recrutement = un fil, jamais mélangée aux autres candidatures).
  COMMERCIAL_APPLICATION_RECEIVED: "commercial-memo",
  // La réponse d'un candidat apporteur à son invitation (2026-09-27) : même
  // fil que sa candidature — c'est la suite de la même conversation.
  APPORTEUR_REPLIED: "commercial-memo",

  // 📰 Presse
  PRESS_REQUEST_SUBMITTED: "presse",

  // 💰 Investisseurs
  INVESTOR_INQUIRY_RECEIVED: "investisseurs",

  // ⭐ Avis clients — sortent du groupe Système, où ils n'avaient rien à faire.
  REVIEW_SUBMITTED: "avis",

  // 💬 Messages — le reste de ce qu'écrit un humain. (Le formulaire de contact
  // et le support client sont partis au salon « Clients » le 15/10.)
  PODCAST_REQUEST_SUBMITTED: "messages",
  RGPD_REQUEST_SUBMITTED: "messages",
  SPEAKER_INVITATION_RECEIVED: "messages",

  // 🔗 Synchro CRM — salon dédié plutôt que Système, pour une raison précise :
  // ces alertes se lisent en RÉGIME (« la file monte depuis 3 h »), pas à
  // l'unité. Noyées entre deux sauvegardes réussies, la tendance disparaît.
  // Le salon est optionnel : sans `TELEGRAM_CHAT_ID_CRM_SYNC`, on retombe sur
  // 🔔 Système, exactement là où ces messages seraient allés sinon.
  CRM_SYNC_ALERT: "crm-sync",

  // 🚨 Incidents de données — salon RÉSERVÉ (demande Will, 2026-10-11) : une
  // déclaration et ses rappels de délai CNIL ne doivent pas se perdre entre
  // deux sauvegardes réussies. Sans `TELEGRAM_CHAT_ID_INCIDENTS`, repli sur
  // 🔔 Système puis sur le salon général : jamais d'alerte perdue.
  DATA_INCIDENT_ALERT: "incidents",

  // 🔔 Système — newsletter, ops, et le tunnel de réservation payante ÉTEINT.
  //
  // Les 6 `BOOKING_*`/`OPTION_*` quittent l'ancien groupe RDV pour ici : elles
  // n'ont plus d'émetteur depuis l'audit 2026-07-09, et laisser une catégorie
  // dormante pointer vers le groupe Calendly le rendrait impur le jour où le
  // tunnel renaîtrait. Si c'est le cas, leur re-donner un groupe dédié.
  BOOKING_CREATED: "system",
  BOOKING_CANCELLED: "system",
  OPTION_POSTED: "system",
  OPTION_CONFIRMED: "system",
  OPTION_REFUSED: "system",
  OPTION_EXPIRED: "system",
  NEWSLETTER_PENDING: "system",
  NEWSLETTER_CONFIRMED: "system",
  NEWSLETTER_UNSUBSCRIBED: "system",
  GUIDE_REQUESTED: "system",
  GUIDE_RECAP: "system",
  ADMIN_REPLIED_TO_SUBMISSION: "system",
  DEPLOY_SUCCESS: "system",
  DEPLOY_FAILED: "system",
  BACKUP_SUCCESS: "system",
  BACKUP_FAILED: "system",
  INCIDENT_DETECTED: "system",
  SECURITY_ALERT: "system",
  STRIPE_EVENT: "system",
  STRIPE_WEBHOOK_SIGNATURE_FAIL: "system",
  MONITORING_ALERT: "system",
};

/** Groupe Telegram cible d'une catégorie. */
export function telegramGroupFor(category: NotificationCategory): TelegramGroup {
  return CATEGORY_GROUP[category];
}

/** Les catégories du salon « Clients » (décision Will 15/10). */
export type CategorieClient =
  | "CONTACT_FORM_SUBMITTED"
  | "AUDIT_REQUEST_SUBMITTED"
  | "INTERVENTION_REQUEST_SUBMITTED"
  | "IMPLEMENTATION_REQUEST_SUBMITTED"
  | "QUOTE_REQUEST_RECEIVED"
  | "CUSTOMER_SUPPORT_REQUEST"
  | "CHATBOT_LEAD_CAPTURED"
  | "CHATBOT_ESCALATION"
  | "CLIENT_CALL_BOOKED"
  | "CLIENT_CALL_CANCELED"
  | "CLIENT_CALL_RESCHEDULED";

/**
 * La route de chaque catégorie client AVANT le salon « Clients » — celle qu'elle
 * reprend tant que `TELEGRAM_CHAT_ID_CLIENTS` n'est pas posé, et celle du
 * dernier essai quand l'envoi au salon échoue (décision Will 15/10 : « ne rien
 * perdre »).
 *
 * `Record` exhaustif : une catégorie client ajoutée sans sa route de repli ne
 * compile pas. Le chatbot passait par `MONITORING_ALERT`, donc 🔔 Système.
 */
const REPLI_CLIENTS: Record<CategorieClient, Exclude<TelegramGroup, "clients">> = {
  CONTACT_FORM_SUBMITTED: "messages",
  CUSTOMER_SUPPORT_REQUEST: "messages",
  AUDIT_REQUEST_SUBMITTED: "interventions",
  INTERVENTION_REQUEST_SUBMITTED: "interventions",
  IMPLEMENTATION_REQUEST_SUBMITTED: "interventions",
  QUOTE_REQUEST_RECEIVED: "interventions",
  CHATBOT_LEAD_CAPTURED: "system",
  CHATBOT_ESCALATION: "system",
  CLIENT_CALL_BOOKED: "calendly",
  CLIENT_CALL_CANCELED: "calendly",
  CLIENT_CALL_RESCHEDULED: "calendly",
};

/** Vrai si la catégorie est une demande de CLIENT (salon « Clients »). */
export function estCategorieClient(category: NotificationCategory): category is CategorieClient {
  return category in REPLI_CLIENTS;
}

/** La route d'avant le salon « Clients » d'une catégorie client. */
export function groupeDeRepliClient(category: CategorieClient): Exclude<TelegramGroup, "clients"> {
  return REPLI_CLIENTS[category];
}

/**
 * Toutes les catégories, à l'exécution.
 *
 * DÉRIVÉE de `CATEGORY_GROUP`, jamais recopiée à la main : le typage rend cette
 * table exhaustive, donc cette liste l'est aussi et le restera. C'est ce qui
 * permet aux tests d'affirmer quelque chose sur *toutes* les catégories — par
 * exemple qu'aucune catégorie du groupe Système ne part sur WhatsApp — au lieu
 * d'énumérer un échantillon qui vieillit mal.
 */
export const ALL_NOTIFICATION_CATEGORIES = Object.keys(CATEGORY_GROUP) as NotificationCategory[];

// ── Canal WhatsApp (CallMeBot) — périmètre resserré le 2026-08-09 ───────────
//
// ⚠️ CallMeBot n'écrit que dans UNE conversation (une clé = un destinataire, pas
// de groupes). La séparation par thème ne peut donc PAS passer par le
// destinataire comme sur Telegram : elle passe par l'EN-TÊTE du message, posé en
// première ligne par `format.ts` (c'est ce que l'écran verrouillé affiche).
//
// Conséquence directe : ce fil unique ne se subdivise pas, donc tout ce qu'on y
// met dilue le reste. La liste ci-dessous est celle que Will a arrêtée le
// 2026-08-09 — « ce à quoi je dois réagir dans l'heure », et rien d'autre.
//
// ⚠️ Le canal reste no-op tant que WHATSAPP_CALLMEBOT_APIKEY + WHATSAPP_NOTIFY_PHONE
// ne sont pas définis (cf. `channels/whatsapp.ts`) — cette liste ne fait qu'AUTORISER
// le doublon, elle ne déclenche rien seule.
const WHATSAPP_LEAD_CATEGORIES: ReadonlySet<NotificationCategory> = new Set<NotificationCategory>([
  // 🔥 Décision Will 15/10 : WhatsApp devient la SONNETTE des CLIENTS, et rien
  // d'autre. Exactement les catégories du salon « Clients » — le texte ne porte
  // aucune donnée (`formatNotificationWhatsApp`, décision D6-5-C1 maintenue) et
  // renvoie au salon Telegram, où se lit tout le détail.
  "CONTACT_FORM_SUBMITTED",
  "AUDIT_REQUEST_SUBMITTED",
  "INTERVENTION_REQUEST_SUBMITTED",
  "IMPLEMENTATION_REQUEST_SUBMITTED",
  "QUOTE_REQUEST_RECEIVED",
  "CUSTOMER_SUPPORT_REQUEST",
  "CHATBOT_LEAD_CAPTURED",
  "CHATBOT_ESCALATION",
  "CLIENT_CALL_BOOKED",
  "CLIENT_CALL_CANCELED",
  "CLIENT_CALL_RESCHEDULED",

  // ── RETIRÉS de WhatsApp le 15/10 (décision Will) — ils restent sur Telegram ──
  // Ne pas les remettre sans le lui redemander : `__tests__/whatsapp.test.ts`
  // verrouille que ce fil ne sonne QUE pour un client.
  //
  //  · `CALENDLY_INVITEE_*` — désormais les rendez-vous des candidats apporteurs
  //    et des formateurs seulement (ceux des clients sont `CLIENT_CALL_*`) ;
  //  · `PRESS_REQUEST_SUBMITTED`, `INVESTOR_INQUIRY_RECEIVED`,
  //    `SPEAKER_INVITATION_RECEIVED`, `PODCAST_REQUEST_SUBMITTED` ;
  //  · `REVIEW_SUBMITTED` ;
  //  · `VIDEO_EDITOR_APPLICATION_RECEIVED`, `COMMERCIAL_APPLICATION_RECEIVED`,
  //    `JOB_APPLICATION_RECEIVED`, `RECRUITMENT_RECEIVED` ;
  //  · tout le groupe Système (ops, newsletter, Stripe…) — jamais ajouté.
]);

/** Vrai si la catégorie doit AUSSI notifier WhatsApp (leads humains). */
export function shouldNotifyWhatsApp(category: NotificationCategory): boolean {
  return WHATSAPP_LEAD_CATEGORIES.has(category);
}

// ── Résolution (bot, salon) ─────────────────────────────────────────────────

/** Variable d'env portant le chat_id DÉDIÉ de chaque groupe. */
const CHAT_ID_ENV: Record<TelegramGroup, string> = {
  clients: "TELEGRAM_CHAT_ID_CLIENTS",
  calendly: "TELEGRAM_CHAT_ID_CALENDLY",
  candidatures: "TELEGRAM_CHAT_ID_CANDIDATURES",
  "monteur-video": "TELEGRAM_CHAT_ID_MONTEUR_VIDEO",
  "commercial-memo": "TELEGRAM_CHAT_ID_COMMERCIAL_MEMO",
  presse: "TELEGRAM_CHAT_ID_PRESSE",
  investisseurs: "TELEGRAM_CHAT_ID_INVESTISSEURS",
  interventions: "TELEGRAM_CHAT_ID_INTERVENTIONS",
  avis: "TELEGRAM_CHAT_ID_AVIS",
  messages: "TELEGRAM_CHAT_ID_MESSAGES",
  "crm-sync": "TELEGRAM_CHAT_ID_CRM_SYNC",
  incidents: "TELEGRAM_CHAT_ID_INCIDENTS",
  "questionnaire-audit": "TELEGRAM_CHAT_ID_QUESTIONNAIRE_AUDIT",
  system: "TELEGRAM_CHAT_ID_SYSTEM",
};

/**
 * Salons de repli, par ordre de préférence, quand le groupe dédié n'est pas
 * encore créé. Tous sont des salons où le bot HISTORIQUE est déjà présent.
 *
 * Ces listes ne sont pas décoratives : elles reproduisent EXACTEMENT le routage
 * d'avant le 2026-08-09. Tant que Will n'a pas créé les nouveaux groupes, le
 * déploiement ne change donc rien à ce qu'il reçoit — pas de trou, pas de
 * message perdu, pas de « où sont passées mes notifs ».
 */
const CHAT_ID_FALLBACKS: Record<TelegramGroup, readonly string[]> = {
  // Aucun repli PAR SALON : le repli du salon « Clients » dépend de la
  // catégorie (`REPLI_CLIENTS`) — c'est `resolveTelegramTargetPourCategorie`
  // qui le choisit. Résoudre « clients » seul ne rend donc que le salon dédié.
  clients: [],
  calendly: ["TELEGRAM_CHAT_ID_RDV", "TELEGRAM_CHAT_ID_MESSAGES", "TELEGRAM_CHAT_ID"],
  candidatures: ["TELEGRAM_CHAT_ID_MESSAGES", "TELEGRAM_CHAT_ID"],
  // Tant que Will n'a pas créé le salon dédié, ces candidatures retombent dans
  // 💼 Candidatures — exactement là où elles arrivaient avant cette séparation.
  "monteur-video": [
    "TELEGRAM_CHAT_ID_CANDIDATURES",
    "TELEGRAM_CHAT_ID_MESSAGES",
    "TELEGRAM_CHAT_ID",
  ],
  // Même repli que le monteur vidéo : tant que le salon 🧲 n'existe pas, ces
  // candidatures retombent dans 💼 Candidatures — rien ne se perd.
  "commercial-memo": [
    "TELEGRAM_CHAT_ID_CANDIDATURES",
    "TELEGRAM_CHAT_ID_MESSAGES",
    "TELEGRAM_CHAT_ID",
  ],
  presse: ["TELEGRAM_CHAT_ID_MESSAGES", "TELEGRAM_CHAT_ID"],
  investisseurs: ["TELEGRAM_CHAT_ID_MESSAGES", "TELEGRAM_CHAT_ID"],
  interventions: ["TELEGRAM_CHAT_ID_MESSAGES", "TELEGRAM_CHAT_ID"],
  // L'avis tombait dans Système avant le 2026-08-09 — on y retombe.
  avis: ["TELEGRAM_CHAT_ID_SYSTEM", "TELEGRAM_CHAT_ID"],
  messages: ["TELEGRAM_CHAT_ID"],
  // Tant que le salon 🔗 dédié n'existe pas, ces alertes techniques retombent
  // dans 🔔 Système — là où elles seraient allées si on n'avait pas créé de
  // groupe. Le repli n'est donc jamais une perte, juste un mélange.
  "crm-sync": ["TELEGRAM_CHAT_ID_SYSTEM", "TELEGRAM_CHAT_ID"],
  // Même repli que la synchro CRM : Système, puis le salon général.
  incidents: ["TELEGRAM_CHAT_ID_SYSTEM", "TELEGRAM_CHAT_ID"],
  // Décision du 25/10/2026 : tant que le groupe « Questionnaire audit » n'existe pas, le salon
  // Clients, puis Système, puis le général (le nouveau groupe n'est PAS bloquant).
  "questionnaire-audit": [
    "TELEGRAM_CHAT_ID_CLIENTS",
    "TELEGRAM_CHAT_ID_SYSTEM",
    "TELEGRAM_CHAT_ID",
  ],
  system: ["TELEGRAM_CHAT_ID"],
};

/** Groupes déjà signalés comme non configurés — pour n'avertir qu'une fois. */
const warnedGroups = new Set<TelegramGroup>();

function envValue(name: string): string | undefined {
  const raw = process.env[name];
  return raw && raw.trim() ? raw.trim() : undefined;
}

export interface TelegramTarget {
  readonly botToken: string;
  readonly chatId: string;
  /** Faux quand le groupe dédié n'existe pas encore et qu'on a replié. */
  readonly dedicated: boolean;
}

/**
 * Résout le COUPLE (bot, salon) d'un groupe.
 *
 * 🔴 PIÈGE CENTRAL, et la raison pour laquelle cette fonction ne se scinde pas
 * en `resolveBotToken()` + `resolveChatId()` : un bot Telegram ne peut écrire
 * que dans les salons dont il est MEMBRE. Résoudre les deux séparément permet
 * de fabriquer un couple impossible — le bot historique visant le salon Calendly
 * où seul le bot Calendly a été ajouté. Telegram répond alors 400 « chat not
 * found », `sendTelegramRaw` renvoie `false`, et la notification disparaît sans
 * bruit. On ne retient donc un salon dédié QUE si son bot dédié existe aussi ;
 * sinon on retombe sur un couple dont on sait qu'il fonctionne.
 */
export function resolveTelegramTarget(group: TelegramGroup): TelegramTarget | undefined {
  const mainBot = envValue("TELEGRAM_BOT_TOKEN");
  // Seul le groupe Calendly a un bot dédié ; tous les autres partagent l'historique.
  const dedicatedBot = group === "calendly" ? envValue("TELEGRAM_CALENDLY_BOT_TOKEN") : mainBot;
  const dedicatedChat = envValue(CHAT_ID_ENV[group]);

  if (dedicatedBot && dedicatedChat) {
    return { botToken: dedicatedBot, chatId: dedicatedChat, dedicated: true };
  }

  if (!mainBot) return undefined;

  for (const name of CHAT_ID_FALLBACKS[group]) {
    const chatId = envValue(name);
    if (!chatId) continue;
    if (!warnedGroups.has(group) && process.env.NODE_ENV !== "test") {
      warnedGroups.add(group);
      console.warn(
        `[notif:telegram] groupe « ${group} » non configuré (${CHAT_ID_ENV[group]}` +
          `${group === "calendly" ? " + TELEGRAM_CALENDLY_BOT_TOKEN" : ""}) — repli sur ${name}`,
      );
    }
    return { botToken: mainBot, chatId, dedicated: false };
  }

  return undefined;
}

/** Réinitialise les avertissements « groupe non configuré » (tests). */
export function resetTelegramGroupWarnings(): void {
  warnedGroups.clear();
}

/**
 * Le salon « Clients » DÉDIÉ — bot historique + `TELEGRAM_CHAT_ID_CLIENTS` —
 * ou `undefined` tant que Will ne l'a pas créé (décision Will 15/10).
 */
export function resolveSalonClients(): TelegramTarget | undefined {
  const t = resolveTelegramTarget("clients");
  return t?.dedicated ? t : undefined;
}

/**
 * Le couple (bot, salon) d'une catégorie : son groupe, ou — pour une catégorie
 * client dont le salon n'existe pas encore — la route qu'elle avait avant.
 */
export function resolveTelegramTargetPourCategorie(
  category: NotificationCategory,
): TelegramTarget | undefined {
  if (estCategorieClient(category)) {
    return resolveSalonClients() ?? resolveTelegramTarget(groupeDeRepliClient(category));
  }
  return resolveTelegramTarget(telegramGroupFor(category));
}
