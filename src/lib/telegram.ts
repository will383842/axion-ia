// Telegram notifications — wrapper @deprecated (Sprint 15 / M8 + Sprint Notif
// Infra 2026-05-26 refactor).
//
// ⚠️ DEPRECATED depuis 2026-05-26 :
//   Ce module est conservé comme thin wrapper qui mappe les anciens tags vers
//   le hub `@/server/notifications` (`notify()` typé strict). Les ~9 call-sites
//   existants continuent à fonctionner sans modification.
//
//   NOUVEAUX call-sites : utilisez directement `notify()` depuis
//   `@/server/notifications` avec une `category` typée. Voir ADR 0027.
//
// Le mapping ci-dessous est intentionnellement best-effort : les body text
// produits par les call-sites legacy sont passés tels quels au hub via une
// catégorie "MONITORING_ALERT" (canal Telegram). Le hub réapplique son
// échappement MarkdownV2, donc les anciens body en Markdown simple sont
// désormais affichés comme texte brut côté Telegram (acceptable pour les
// alertes ops historiques — pas de régression bloquante).
//
// Tags canoniques legacy :
//   [INTERVENTION] [OPTION] [OPTION CONFIRMÉE] [OPTION REFUSÉE] [OPTION EXPIRÉE]
//   [ANNULATION] [AUDIT] [AUTO] [CONTACT] [NEWSLETTER]
//   [DEPLOY] [INCIDENT] [BACKUP] [MONITORING] [SECURITY]
//   [STRIPE_EVENT] [STRIPE_WEBHOOK_SIGNATURE_FAIL] [QUOTE_REQUEST_RECEIVED]
//
// Fail-soft : retourne false si Telegram n'a pas confirmé l'envoi.

import { notify } from "@/server/notifications";
import type { NotificationCategory, NotificationSeverity } from "@/server/notifications";

export type TelegramTag =
  | "INTERVENTION"
  | "OPTION"
  | "OPTION CONFIRMÉE"
  | "OPTION REFUSÉE"
  | "OPTION EXPIRÉE"
  | "ANNULATION"
  | "AUDIT"
  | "AUTO"
  | "CONTACT"
  | "NEWSLETTER"
  | "DEPLOY"
  | "INCIDENT"
  | "BACKUP"
  | "MONITORING"
  | "SECURITY"
  | "STRIPE_EVENT"
  | "STRIPE_WEBHOOK_SIGNATURE_FAIL"
  | "QUOTE_REQUEST_RECEIVED";

export interface TelegramMessage {
  tag: TelegramTag;
  /** Lignes formatees (legacy Markdown V1 — désormais affiché en plain). */
  body: string;
  /** Niveau d'urgence : alerte → notification; info → silencieux. */
  silent?: boolean;
}

/**
 * @deprecated — utilisez `notify()` depuis `@/server/notifications` pour les
 * nouveaux call-sites. Wrapper conservé pour les ~9 call-sites legacy.
 *
 * Envoie un message Telegram via le hub centralisé. Retourne true si succès.
 */
export async function sendTelegram(msg: TelegramMessage): Promise<boolean> {
  const { category, severity } = mapTagToCategory(msg.tag);
  const result = await notify({
    category,
    severity,
    payload: {
      // On expose le body legacy + tag pour traçabilité côté Sentry breadcrumb
      // / logs. Le formatNotification du hub ignore ce shape libre (ne casse
      // pas la sortie : la branche MONITORING_ALERT lit `kind` + `details`).
      kind: msg.tag,
      details: { legacyBody: msg.body },
    } as never,
    sync: true,
    force: false,
  } as Parameters<typeof notify>[0]);
  // Si silent=true et que Telegram refuse parce que la catégorie est rate-
  // limitée, c'est OK — pas de régression.
  return result.ok || result.rateLimited === true || result.deduped === true;
}

/**
 * @deprecated — utilisez `notify()` avec category "INCIDENT_DETECTED" ou
 * "DEPLOY_FAILED" / "BACKUP_FAILED" / "MONITORING_ALERT" / "SECURITY_ALERT".
 */
export async function alertOps(
  tag: "DEPLOY" | "INCIDENT" | "BACKUP" | "MONITORING" | "SECURITY",
  body: string,
  options?: { silent?: boolean },
): Promise<boolean> {
  return sendTelegram({ tag, body, silent: options?.silent ?? false });
}

/**
 * @deprecated — utilisez `notify({ category: "INCIDENT_DETECTED", ... })`
 * avec un payload structuré (title/url/statusCode/error/userId).
 */
export async function alertIncident(
  title: string,
  details: { url?: string; statusCode?: number; error?: string; userId?: string },
): Promise<boolean> {
  const result = await notify({
    category: "INCIDENT_DETECTED",
    payload: {
      title,
      ...(details.url ? { url: details.url } : {}),
      ...(details.statusCode ? { statusCode: details.statusCode } : {}),
      ...(details.error ? { error: details.error.slice(0, 500) } : {}),
      ...(details.userId ? { userId: details.userId } : {}),
    },
    sync: true,
  });
  return result.ok;
}

// ─── Mapping legacy tag → hub category ─────────────────────────────────────

function mapTagToCategory(tag: TelegramTag): {
  category: NotificationCategory;
  severity: NotificationSeverity;
} {
  switch (tag) {
    // Form publics — toujours info
    case "AUDIT":
    case "CONTACT":
    case "INTERVENTION":
    case "AUTO":
      // Pour les anciens call-sites qui ne fournissent qu'un body legacy, on
      // mappe vers MONITORING_ALERT (canal Telegram, sans payload typé). Les
      // nouveaux call-sites doivent appeler notify() avec la catégorie typée
      // CONTACT_FORM_SUBMITTED / AUDIT_REQUEST_SUBMITTED etc.
      return { category: "MONITORING_ALERT", severity: "info" };
    case "NEWSLETTER":
      return { category: "MONITORING_ALERT", severity: "info" };
    case "OPTION":
    case "OPTION CONFIRMÉE":
    case "OPTION REFUSÉE":
    case "OPTION EXPIRÉE":
      return { category: "MONITORING_ALERT", severity: "info" };
    case "ANNULATION":
      return { category: "MONITORING_ALERT", severity: "warn" };
    case "QUOTE_REQUEST_RECEIVED":
      return { category: "MONITORING_ALERT", severity: "info" };
    case "DEPLOY":
      return { category: "MONITORING_ALERT", severity: "info" };
    case "INCIDENT":
      return { category: "INCIDENT_DETECTED", severity: "error" };
    case "BACKUP":
      return { category: "MONITORING_ALERT", severity: "info" };
    case "MONITORING":
      return { category: "MONITORING_ALERT", severity: "warn" };
    case "SECURITY":
      return { category: "SECURITY_ALERT", severity: "critical" };
    case "STRIPE_EVENT":
      return { category: "STRIPE_EVENT", severity: "info" };
    case "STRIPE_WEBHOOK_SIGNATURE_FAIL":
      return { category: "STRIPE_WEBHOOK_SIGNATURE_FAIL", severity: "warn" };
  }
}
