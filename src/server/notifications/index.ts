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

import {
  getRouting,
  shouldDispatchAsync,
  shouldNotifyWhatsApp,
  telegramGroupFor,
  resolveTelegramTarget,
} from "./routing";
import { formatNotification, formatNotificationWhatsApp } from "./format";
import { sendTelegramRaw } from "./channels/telegram";
import { sendSentryBreadcrumb } from "./channels/sentry";
import { sendEmailNotification } from "./channels/email";
import { sendWhatsAppRaw } from "./channels/whatsapp";
import { isDuplicate } from "./dedup";
import { checkCategoryRateLimit } from "./rate-limit";
import type { NotificationChannel, NotifyInput, NotifyResult, NotificationCategory } from "./types";

export type {
  NotificationEvent,
  NotificationCategory,
  NotificationSeverity,
  NotificationChannel,
  NotifyInput,
  NotifyResult,
} from "./types";

async function dispatchChannels(
  category: NotificationCategory,
  severity: import("./types").NotificationSeverity,
  channels: NotificationChannel[],
  formattedText: string,
  payload: Record<string, unknown>,
): Promise<Partial<Record<NotificationChannel, "sent" | "queued" | "skipped" | "failed">>> {
  const results: Partial<Record<NotificationChannel, "sent" | "queued" | "skipped" | "failed">> =
    {};
  const tasks: Array<Promise<void>> = [];

  for (const ch of channels) {
    if (ch === "telegram") {
      // Routage 8 groupes thématiques (refonte 2026-08-09). `resolveTelegramTarget`
      // rend le COUPLE (bot, salon) — jamais l'un sans l'autre, sinon on peut
      // fabriquer un bot qui vise un salon dont il n'est pas membre.
      const target = resolveTelegramTarget(telegramGroupFor(category));
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
      tasks.push(
        sendWhatsAppRaw({ text: formatNotificationWhatsApp(category, severity).text })
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
  return results;
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
  const formatted = formatNotification(
    { category: input.category, payload } as import("./types").NotificationEvent,
    severity,
  );

  // 4. Dispatch sync ou fire-and-forget
  const forceSync = input.sync === true;
  const async = !forceSync && shouldDispatchAsync(severity);

  if (async) {
    // Fire-and-forget : on lance la promise détachée, on retourne tout de suite.
    // On garde une référence attendable (tests / arrêt gracieux) sans bloquer le
    // runtime ; la référence s'auto-supprime à la résolution.
    const dispatch = dispatchChannels(input.category, severity, channels, formatted.text, payload);
    inFlightDispatches.add(dispatch);
    void dispatch.finally(() => inFlightDispatches.delete(dispatch));
    const queued: Partial<Record<NotificationChannel, "sent" | "queued" | "skipped" | "failed">> =
      {};
    for (const c of channels) queued[c] = "queued";
    return { ok: true, channels: queued };
  }

  const results = await dispatchChannels(
    input.category,
    severity,
    channels,
    formatted.text,
    payload,
  );
  const okOverall = Object.values(results).some((v) => v === "sent" || v === "queued");
  return { ok: okOverall, channels: results };
}
