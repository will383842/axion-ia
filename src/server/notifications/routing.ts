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

  // --- Newsletter ---
  NEWSLETTER_PENDING: { channels: ["telegram"], severity: "info" },
  NEWSLETTER_CONFIRMED: { channels: ["telegram"], severity: "info" },
  NEWSLETTER_UNSUBSCRIBED: { channels: ["telegram"], severity: "info" },

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

  // --- Reply admin (Chantier 5) — décision Will figée : pas de notif ---
  ADMIN_REPLIED_TO_SUBMISSION: { channels: [], severity: "info" },

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
  // 📅 Calendly — et RIEN d'autre. C'est le seul canal de RDV réellement vivant.
  CALENDLY_INVITEE_CREATED: "calendly",
  CALENDLY_INVITEE_CANCELED: "calendly",
  CALENDLY_INVITEE_RESCHEDULED: "calendly",

  // 💼 Candidatures — offres d'emploi publiées ET candidature spontanée/commerciale.
  JOB_APPLICATION_RECEIVED: "candidatures",
  RECRUITMENT_RECEIVED: "candidatures",
  // Le rappel « offres à republier » vit avec les offres qu'il concerne.
  JOB_OFFERS_STALE: "candidatures",

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

  // 📰 Presse
  PRESS_REQUEST_SUBMITTED: "presse",

  // 💰 Investisseurs
  INVESTOR_INQUIRY_RECEIVED: "investisseurs",

  // 🛠️ Interventions — toute demande de prestation payante.
  INTERVENTION_REQUEST_SUBMITTED: "interventions",
  AUDIT_REQUEST_SUBMITTED: "interventions",
  IMPLEMENTATION_REQUEST_SUBMITTED: "interventions",
  QUOTE_REQUEST_RECEIVED: "interventions",

  // ⭐ Avis clients — sortent du groupe Système, où ils n'avaient rien à faire.
  REVIEW_SUBMITTED: "avis",

  // 💬 Messages — le reste de ce qu'écrit un humain.
  CONTACT_FORM_SUBMITTED: "messages",
  CUSTOMER_SUPPORT_REQUEST: "messages",
  PODCAST_REQUEST_SUBMITTED: "messages",
  RGPD_REQUEST_SUBMITTED: "messages",
  SPEAKER_INVITATION_RECEIVED: "messages",

  // 🔗 Synchro CRM — salon dédié plutôt que Système, pour une raison précise :
  // ces alertes se lisent en RÉGIME (« la file monte depuis 3 h »), pas à
  // l'unité. Noyées entre deux sauvegardes réussies, la tendance disparaît.
  // Le salon est optionnel : sans `TELEGRAM_CHAT_ID_CRM_SYNC`, on retombe sur
  // 🔔 Système, exactement là où ces messages seraient allés sinon.
  CRM_SYNC_ALERT: "crm-sync",

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
  // 📅 Calendly — les TROIS événements.
  //
  // `_CANCELED` et `_RESCHEDULED` ajoutés le 2026-08-09 : jusqu'ici seule la
  // création partait sur WhatsApp. Un client qui annulait 1 h avant le rendez-vous
  // ne produisait aucune alerte sur le téléphone — le pire cas possible, puisque
  // c'est précisément celui où il faut réagir vite.
  "CALENDLY_INVITEE_CREATED",
  "CALENDLY_INVITEE_CANCELED",
  "CALENDLY_INVITEE_RESCHEDULED",

  // 🛠️ Demandes de prestation — quelqu'un veut acheter. Après un RDV, c'est le
  // flux le plus directement lié au chiffre d'affaires.
  "INTERVENTION_REQUEST_SUBMITTED",
  "AUDIT_REQUEST_SUBMITTED",
  "IMPLEMENTATION_REQUEST_SUBMITTED",
  "QUOTE_REQUEST_RECEIVED",

  // 📰💰🎤 Rare mais à fort enjeu. Ajoutés le 2026-08-09 : ils étaient
  // Telegram-only par omission, pas par décision. Un investisseur classé `warn`
  // (donc jugé stratégique par le routage lui-même) qui n'arrivait pas sur le
  // téléphone, c'était un trou.
  "PRESS_REQUEST_SUBMITTED",
  "INVESTOR_INQUIRY_RECEIVED",
  "SPEAKER_INVITATION_RECEIVED",

  // ⭐ Avis client à modérer.
  "REVIEW_SUBMITTED",

  // 🎬 Candidatures monteur vidéo — demande EXPLICITE de Will (2026-08-12) pour
  // CETTE offre seulement. Ce n'est PAS un retour en arrière sur l'exclusion des
  // candidatures (ci-dessous) : `JOB_APPLICATION_RECEIVED` reste hors WhatsApp.
  // CallMeBot = un seul fil → la séparation passe par l'en-tête 🎬 MONTEUR VIDÉO.
  "VIDEO_EDITOR_APPLICATION_RECEIVED",

  // 🧲 Candidatures commerciales (tunnel Mémorial de l'Isère) — même décision
  // que le monteur vidéo (Will 2026-08-12) : campagne active à fort enjeu, le
  // doublon WhatsApp est voulu. Séparation par l'en-tête 🧲 COMMERCIAL MÉMO.
  "COMMERCIAL_APPLICATION_RECEIVED",

  // ✉️ Formulaire de contact — REMIS le 2026-08-16, sur demande explicite de
  // Will après un envoi de contrôle où il n'a rien reçu sur son téléphone.
  //
  // Il en avait été retiré le 2026-08-09 au motif que « ce sont des gens qui
  // attendent une réponse, mais rarement dans l'heure ». La décision s'inverse
  // en connaissance de cause : le formulaire unifié est la porte d'entrée
  // commerciale principale du site, et laisser une demande dormir jusqu'à la
  // prochaine ouverture de Telegram coûte plus cher que la dilution du fil.
  //
  // ⚠️ C'est le premier flux à VOLUME de cette liste. Si le fil WhatsApp devient
  // bruyant, c'est ici qu'il faudra revenir — pas sur Calendly ni sur les
  // demandes de prestation.
  "CONTACT_FORM_SUBMITTED",

  // ── HORS WhatsApp, sur décision explicite de Will (2026-08-09) ─────────────
  // Ne pas les remettre sans le lui redemander — leur absence est un CHOIX, pas
  // un oubli, et `__tests__/whatsapp.test.ts` la verrouille explicitement.
  //
  //  · `JOB_APPLICATION_RECEIVED` / `RECRUITMENT_RECEIVED` — y étaient depuis le
  //    2026-07-19, retirées ici. Une candidature se traite depuis la console, et
  //    le pic du 05/08 (17 candidatures en une journée) montre que ce volume
  //    noie un fil qui doit rester réservé à l'urgent. Restent sur Telegram,
  //    dans leur groupe 💼 Candidatures.
  //  · `CUSTOMER_SUPPORT_REQUEST`, `PODCAST_REQUEST_SUBMITTED` — retirées le
  //    2026-08-09 : ce sont des gens qui attendent une réponse, mais rarement
  //    dans l'heure. (`CONTACT_FORM_SUBMITTED` figurait ici jusqu'au 2026-08-16,
  //    puis a été REMIS sur demande de Will — voir plus haut.)
  //  · `NEWSLETTER_*`, `DEPLOY_*`, `BACKUP_*`, `INCIDENT_DETECTED`,
  //    `SECURITY_ALERT`, `STRIPE_*`, `MONITORING_ALERT` — jamais ajoutées.
  //  · les 6 dormantes `BOOKING_*`/`OPTION_*` — tunnel éteint, aucun émetteur.
]);

/** Vrai si la catégorie doit AUSSI notifier WhatsApp (leads humains). */
export function shouldNotifyWhatsApp(category: NotificationCategory): boolean {
  return WHATSAPP_LEAD_CATEGORIES.has(category);
}

// ── Résolution (bot, salon) ─────────────────────────────────────────────────

/** Variable d'env portant le chat_id DÉDIÉ de chaque groupe. */
const CHAT_ID_ENV: Record<TelegramGroup, string> = {
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
