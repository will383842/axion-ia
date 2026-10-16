// Hub notifications — API publique `notify(event)` (Sprint Notif Infra 2026-05-26).
//
// Cf. `docs/adr/0027-notifications-hub.md` pour la justification architecturale.
//
// Garanties contractuelles :
//   - Soft-fail : `notify()` ne throw JAMAIS, retourne un `NotifyResult`.
//   - BUILD-safe : si `BULLMQ_DISABLED=true` ou `REDIS_URL` contient
//     `stub.invalid`, dédup/rate-limit/Redis sont no-op silencieux.
//   - Type-safe : la discriminated union `NotificationEvent` force le bon
//     shape de `payload` pour chaque `category`.
//
// Mode sync vs async :
//   - severity ∈ ["info","warn"] → sync (latence < 200ms typique).
//   - severity ∈ ["error","critical"] → fire-and-forget (Promise détachée).
//     Pas de queue BullMQ dédiée en V1 : le coût d'un fetch Telegram dans
//     un worker BullMQ vs détacher la Promise dans la requête est marginal
//     côté infra, et permet d'éviter une 6ème queue et le risque de drift
//     de routing. Si besoin d'une vraie queue persistante (retry +
//     audit-trail), Sprint+1 ajoutera `notificationsQueue`.
//
//   ⚠️ « sync » veut dire que l'APPELANT attend — jusqu'à ~24 s pour le salon
//   « Clients » (429, migration, morceaux, repli). Depuis une Server Action ou
//   une route, passer par `notifyApresReponse` (`./apres-reponse`, `after()`) :
//   le visiteur n'attend pas Telegram. Le worker garde `await notify(...)`.

import {
  estCategorieClient,
  getRouting,
  groupeDeRepliClient,
  resolveSalonClients,
  shouldDispatchAsync,
  shouldNotifyWhatsApp,
  resolveTelegramTarget,
  resolveTelegramTargetPourCategorie,
} from "./routing";
import { formatNotification, formatNotificationWhatsApp } from "./format";
import {
  formatNotificationClient,
  libelleTypeDemandeWhatsApp,
  type EvenementClient,
} from "./format-clients";
import { decouperPourTelegram, sendTelegramRaw } from "./channels/telegram";
import { sendSentryBreadcrumb } from "./channels/sentry";
import { sendEmailNotification } from "./channels/email";
import { sendWhatsAppRaw } from "./channels/whatsapp";
import { isDuplicate, libererDedup } from "./dedup";
import { checkCategoryRateLimit } from "./rate-limit";
import type { NotificationChannel, NotificationEvent, NotifyInput, NotifyResult } from "./types";

export type {
  NotificationEvent,
  NotificationCategory,
  NotificationSeverity,
  NotificationChannel,
  NotifyInput,
  NotifyResult,
} from "./types";

/**
 * Le salon « Clients » (décision Will 15/10) : TOUT le détail, en texte brut,
 * découpé sous 4096 caractères, toujours AVEC SON.
 *
 * Si un morceau n'arrive pas, dernier essai vers la route d'avant de la
 * catégorie, avec le gabarit ALLÉGÉ : jamais les coordonnées dans un autre
 * salon, mais jamais non plus une demande de client perdue.
 */
async function envoyerAuSalonClients(
  event: EvenementClient,
  texteAllege: string,
  suivi: { unMessageEstParti: boolean },
): Promise<EnvoiSalonClients> {
  const salon = resolveSalonClients();
  // Relecture PR 1553 : vrai dès qu'UN message est arrivé quelque part. La clé
  // anti-doublon est alors gardée même si la suite échoue — sinon un rejeu
  // renverrait le 1er morceau en double.
  // `suivi` est partagé avec l'appelant : si une exception survient APRÈS un
  // morceau parti, l'appelant sait quand même qu'un message est arrivé.
  if (salon) {
    let toutEstParti = true;
    for (const morceau of decouperPourTelegram(formatNotificationClient(event))) {
      const ok = await sendTelegramRaw({
        text: morceau,
        brut: true,
        silent: false,
        chatId: salon.chatId,
        botToken: salon.botToken,
      });
      if (!ok) {
        toutEstParti = false;
        break;
      }
      suivi.unMessageEstParti = true;
    }
    if (toutEstParti) return { statut: "sent", unMessageEstParti: suivi.unMessageEstParti };
  }
  // Salon pas encore créé, ou envoi échoué : la route d'avant.
  const repli = resolveTelegramTarget(groupeDeRepliClient(event.category));
  if (!repli)
    return { statut: salon ? "failed" : "skipped", unMessageEstParti: suivi.unMessageEstParti };
  const ok = await sendTelegramRaw({
    text: texteAllege,
    silent: false,
    chatId: repli.chatId,
    botToken: repli.botToken,
  });
  if (ok) suivi.unMessageEstParti = true;
  return { statut: ok ? "sent" : "failed", unMessageEstParti: suivi.unMessageEstParti };
}

interface EnvoiSalonClients {
  statut: "sent" | "skipped" | "failed";
  /** Au moins un message (morceau du salon ou repli) est arrivé. */
  unMessageEstParti: boolean;
}

type StatutsCanaux = Partial<Record<NotificationChannel, "sent" | "queued" | "skipped" | "failed">>;

interface ResultatDispatch {
  results: StatutsCanaux;
  /** Un morceau est parti au salon « Clients » ou au repli, même si la suite a échoué. */
  partiellementParti: boolean;
}

async function dispatchChannels(
  event: NotificationEvent,
  severity: import("./types").NotificationSeverity,
  channels: NotificationChannel[],
  formattedText: string,
): Promise<ResultatDispatch> {
  const category = event.category;
  const payload = event.payload as Record<string, unknown>;
  const results: StatutsCanaux = {};
  const tasks: Array<Promise<void>> = [];
  let partiellementParti = false;

  for (const ch of channels) {
    if (ch === "telegram" && estCategorieClient(category)) {
      const suivi = { unMessageEstParti: false };
      tasks.push(
        envoyerAuSalonClients(event as EvenementClient, formattedText, suivi)
          .then(({ statut, unMessageEstParti }) => {
            results.telegram = statut;
            partiellementParti = unMessageEstParti;
          })
          .catch(() => {
            results.telegram = "failed";
            // Une exception après un morceau parti ne libère pas la clé.
            partiellementParti = suivi.unMessageEstParti;
          }),
      );
    } else if (ch === "telegram") {
      // Routage 8 groupes thématiques (refonte 2026-08-09). `resolveTelegramTarget`
      // rend le COUPLE (bot, salon) — jamais l'un sans l'autre, sinon on peut
      // fabriquer un bot qui vise un salon dont il n'est pas membre.
      const target = resolveTelegramTargetPourCategorie(category);
      if (!target) {
        // Ni bot ni salon configurés : ce n'est pas un échec d'envoi, c'est une
        // absence de configuration. On le distingue pour ne pas faire croire à
        // une panne réseau dans les logs.
        results.telegram = "skipped";
      } else {
        tasks.push(
          sendTelegramRaw({
            text: formattedText,
            silent: severity === "info",
            chatId: target.chatId,
            botToken: target.botToken,
          })
            .then((ok) => {
              results.telegram = ok ? "sent" : "failed";
            })
            .catch(() => {
              results.telegram = "failed";
            }),
        );
      }
    } else if (ch === "sentry") {
      tasks.push(
        sendSentryBreadcrumb(category, severity, formattedText.slice(0, 200), payload)
          .then((ok) => {
            results.sentry = ok ? "sent" : "skipped";
          })
          .catch(() => {
            results.sentry = "failed";
          }),
      );
    } else if (ch === "email") {
      tasks.push(
        sendEmailNotification(category, severity, payload)
          .then((ok) => {
            results.email = ok ? "queued" : "skipped";
          })
          .catch(() => {
            results.email = "failed";
          }),
      );
    } else if (ch === "whatsapp") {
      // 🔴 `D6-5-C1` (2026-08-20) — WhatsApp ne reçoit PLUS le même contenu que
      // Telegram. Il portait nom, e-mail, téléphone et le message entier vers
      // CallMeBot : un prestataire qui ne publie AUCUNE entité légale (donc
      // indéclarable sur `/sous-processeurs`), sans contrat de sous-traitance,
      // et dont les conditions interdisent explicitement de s'en servir pour
      // « collect or track the personal information of others ».
      //
      // 🔑 Le canal reste — il prévient vite, et c'est son seul rôle. Le détail
      // qui permet de rappeler vit sur Telegram, qui est déclaré et couvert par
      // des clauses contractuelles types. Voir `formatNotificationWhatsApp`.
      // Pour un client, la sonnette dit le TYPE de demande (« Audit IA ») —
      // une nature, jamais une donnée de la personne (décision Will 15/10).
      const typeDemande = estCategorieClient(category)
        ? libelleTypeDemandeWhatsApp(event as EvenementClient)
        : undefined;
      tasks.push(
        sendWhatsAppRaw({ text: formatNotificationWhatsApp(category, severity, typeDemande).text })
          .then((status) => {
            results.whatsapp = status;
          })
          .catch(() => {
            results.whatsapp = "failed";
          }),
      );
    }
  }

  await Promise.all(tasks);
  return { results, partiellementParti };
}

/**
 * Émet une notification multi-canal typée.
 *
 * Ne throw jamais. Retourne un `NotifyResult` reportant l'état de chaque
 * canal. Dédup Redis et rate-limit fail-open silencieux si Redis down.
 */
/**
 * Dispatches fire-and-forget en cours (severity critical/error). Référencés ici
 * uniquement pour pouvoir les ATTENDRE (tests, arrêt gracieux) — le runtime reste
 * non-bloquant (`notify` ne les await jamais). Auto-nettoyés à la résolution.
 */
const inFlightDispatches = new Set<Promise<unknown>>();

/**
 * Attend la fin de tous les dispatches fire-and-forget en cours. À utiliser dans
 * les tests (évite qu'un fetch asynchrone fuite sur le test suivant) et pour un
 * arrêt gracieux. No-op s'il n'y a aucun dispatch détaché en cours.
 */
export async function flushPendingDispatches(): Promise<void> {
  await Promise.allSettled([...inFlightDispatches]);
}

export async function notify(input: NotifyInput): Promise<NotifyResult> {
  const routing = getRouting(input.category);
  const severity = input.severity ?? routing.severity;
  // Canaux du routing par défaut + doublon WhatsApp pour les leads humains.
  // Si l'appelant force `input.channels`, on respecte exactement sa liste (usage
  // avancé). Le canal WhatsApp reste no-op tant que la clé CallMeBot est absente.
  const baseChannels = input.channels ?? routing.channels;
  const channels: NotificationChannel[] =
    input.channels === undefined && shouldNotifyWhatsApp(input.category)
      ? [...baseChannels, "whatsapp"]
      : baseChannels;
  const payload = input.payload as Record<string, unknown>;

  // 0. Aucun canal configuré → skip immédiat (catégorie volontairement muette).
  if (channels.length === 0) {
    return { ok: true, channels: {} };
  }

  // 1. Dédup
  if (input.dedupKey) {
    const duplicate = await isDuplicate(input.category, input.dedupKey, input.dedupTtlSec ?? 300);
    if (duplicate) {
      return { ok: true, deduped: true, channels: {} };
    }
  }

  // 2. Rate-limit par catégorie (sauf si force=true)
  if (!input.force && routing.rateLimitPerHour && routing.rateLimitPerHour > 0) {
    const allowed = await checkCategoryRateLimit(input.category, routing.rateLimitPerHour);
    if (!allowed) {
      return { ok: true, rateLimited: true, channels: {} };
    }
  }

  // 3. Format MarkdownV2 (échappement strict)
  const event = { category: input.category, payload } as NotificationEvent;
  const formatted = formatNotification(event, severity);

  // Décision Will 15/10 : la clé de dédoublonnage ne survit qu'à un envoi
  // RÉUSSI. Laissée après un échec, elle faisait passer le rejeu pour un
  // doublon — l'alerte était perdue pour tout le TTL.
  const dedupKey = input.dedupKey;
  const libererSiEchec = async ({
    results: r,
    partiellementParti,
  }: ResultatDispatch): Promise<void> => {
    if (!dedupKey) return;
    // Telegram porte le détail : s'il n'est pas parti, l'alerte n'est pas faite.
    // Mais si UN morceau est parti, la clé reste : un rejeu le renverrait en
    // double (relecture PR 1553). Le reste manquant est journalisé.
    const aboutie =
      "telegram" in r
        ? r.telegram === "sent" || partiellementParti
        : Object.values(r).some((v) => v === "sent" || v === "queued");
    if (!aboutie) await libererDedup(input.category, dedupKey);
  };

  // 4. Dispatch sync ou fire-and-forget
  const forceSync = input.sync === true;
  const async = !forceSync && shouldDispatchAsync(severity);

  if (async) {
    // Fire-and-forget : on lance la promise détachée, on retourne tout de suite.
    // On garde une référence attendable (tests / arrêt gracieux) sans bloquer le
    // runtime ; la référence s'auto-supprime à la résolution.
    const dispatch = dispatchChannels(event, severity, channels, formatted.text).then(
      libererSiEchec,
    );
    inFlightDispatches.add(dispatch);
    void dispatch.finally(() => inFlightDispatches.delete(dispatch));
    const queued: StatutsCanaux = {};
    for (const c of channels) queued[c] = "queued";
    return { ok: true, channels: queued };
  }

  const dispatch = await dispatchChannels(event, severity, channels, formatted.text);
  await libererSiEchec(dispatch);
  const results = dispatch.results;
  const okOverall = Object.values(results).some((v) => v === "sent" || v === "queued");
  return { ok: okOverall, channels: results };
}
