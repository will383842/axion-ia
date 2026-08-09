// Hub notifications — channel Telegram (Sprint Notif Infra 2026-05-26).
//
// Bas niveau : POST sendMessage avec parse_mode=MarkdownV2. Timeout 3s
// (vs 5s de l'ancien `sendTelegram` legacy — on est plus strict ici car
// l'API publique `notify()` est appelée depuis des Server Actions où la
// latence utilisateur compte).
//
// Fail-soft : ne throw jamais. Retourne false si KO.

const TG_API = "https://api.telegram.org";

export interface TelegramChannelOptions {
  /** Message MarkdownV2 déjà formaté + échappé. */
  text: string;
  /** Si true, pas de bip côté client Telegram. */
  silent?: boolean;
  /** Timeout réseau ms (défaut 3000). */
  timeoutMs?: number;
  /**
   * chat_id cible (routage par groupe). Défaut : `TELEGRAM_CHAT_ID` (legacy
   * 1-groupe). Voir `resolveTelegramTarget()` dans routing.ts.
   */
  chatId?: string;
  /**
   * Jeton du bot émetteur. Défaut : `TELEGRAM_BOT_TOKEN` (bot historique).
   *
   * ⚠️ Ne se passe JAMAIS indépendamment de `chatId` : un bot ne peut écrire que
   * dans les salons dont il est membre. `resolveTelegramTarget()` produit le
   * couple cohérent — ne pas reconstruire l'un des deux à la main ici.
   */
  botToken?: string;
}

export async function sendTelegramRaw(opts: TelegramChannelOptions): Promise<boolean> {
  const token = opts.botToken ?? process.env.TELEGRAM_BOT_TOKEN;
  const chatId = opts.chatId ?? process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    if (process.env.NODE_ENV !== "test" && process.env.NODE_ENV !== "production") {
      console.warn("[notif:telegram] missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
    }
    return false;
  }
  const timeoutMs = opts.timeoutMs ?? 3000;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${TG_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: opts.text,
        parse_mode: "MarkdownV2",
        disable_notification: opts.silent ?? false,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok && process.env.NODE_ENV !== "test") {
      // Diagnostic utile en prod : Telegram renvoie souvent un body JSON
      // explicatif (description), mais on évite de bloquer si lecture échoue.
      try {
        const body = await res.text();
        console.warn(`[notif:telegram] ${res.status}: ${body.slice(0, 300)}`);
      } catch {
        // ignore
      }
    }
    return res.ok;
  } catch {
    return false;
  }
}
