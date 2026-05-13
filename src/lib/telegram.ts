// Telegram notifications (Sprint 15 / M8).
//
// Tags canoniques (CLAUDE.md v6 §11) :
//   [INTERVENTION] [OPTION] [OPTION CONFIRMÉE] [OPTION EXPIRÉE] [ANNULATION]
//   [AUDIT] [AUTO] [CONTACT] [NEWSLETTER]
//
// Fail-soft : si TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID absent, on log
// et on retourne false (pas de throw) — la submission utilisateur ne doit
// pas echouer si Telegram est down.

const TG_API = "https://api.telegram.org";

export type TelegramTag =
  | "INTERVENTION"
  | "OPTION"
  | "OPTION CONFIRMÉE"
  | "OPTION REFUSÉE" // Sprint 15 fix Fork 4 W1-4 : ajout pour decision admin
  | "OPTION EXPIRÉE"
  | "ANNULATION"
  | "AUDIT"
  | "AUTO"
  | "CONTACT"
  | "NEWSLETTER"
  // ops tags Sprint 23
  | "DEPLOY"
  | "INCIDENT"
  | "BACKUP"
  | "MONITORING"
  | "SECURITY"
  // booking V1 tags Sprint X.2 — Stripe webhook ingestion
  | "STRIPE_EVENT"
  | "STRIPE_WEBHOOK_SIGNATURE_FAIL"
  // booking V1 tags Sprint X.5bis — parcours B devis qualifié
  | "QUOTE_REQUEST_RECEIVED";

export interface TelegramMessage {
  tag: TelegramTag;
  /** Lignes formatees Markdown (rendered en MarkdownV2). */
  body: string;
  /** Niveau d'urgence : alerte → notification; info → silencieux. */
  silent?: boolean;
}

/**
 * Envoie un message Telegram. Retourne true si succes.
 * Timeout 5s pour ne pas bloquer un Server Action.
 */
export async function sendTelegram(msg: TelegramMessage): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[telegram] missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID — skipping");
    }
    return false;
  }

  const text = `*[${msg.tag}]*\n${msg.body}`;
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${TG_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_notification: msg.silent ?? false,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Ops alert helpers (Sprint 23 / M11) ─────────────────────────────────────

/** Alert ops critique : déploiement, incident, échec backup. */
export async function alertOps(
  tag: "DEPLOY" | "INCIDENT" | "BACKUP" | "MONITORING" | "SECURITY",
  body: string,
  options?: { silent?: boolean },
): Promise<boolean> {
  return sendTelegram({ tag, body, silent: options?.silent ?? false });
}

/** Alert incident production avec stack trace + URL. */
export async function alertIncident(
  title: string,
  details: { url?: string; statusCode?: number; error?: string; userId?: string },
): Promise<boolean> {
  const lines = [`*${title}*`];
  if (details.url) lines.push(`URL : \`${details.url}\``);
  if (details.statusCode) lines.push(`Status : ${details.statusCode}`);
  if (details.userId) lines.push(`User : ${details.userId}`);
  if (details.error) lines.push(`\nErreur :\n\`\`\`\n${details.error.slice(0, 500)}\n\`\`\``);
  return sendTelegram({ tag: "INCIDENT", body: lines.join("\n"), silent: false });
}
