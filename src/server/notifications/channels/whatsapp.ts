// Hub notifications — channel WhatsApp via CallMeBot (2026-07-19).
//
// CallMeBot expose une API HTTP GRATUITE pour envoyer un message WhatsApp vers
// SON PROPRE numéro (le numéro qui a activé la clé). Aucun compte payant, aucun
// SDK : un simple GET. Cf. https://www.callmebot.com/blog/free-api-whatsapp-messages/
//
//   GET https://api.callmebot.com/whatsapp.php?phone=<phone>&text=<urlenc>&apikey=<key>
//
// Design (aligné sur `channels/telegram.ts`) :
//   - Fail-soft : ne throw JAMAIS. Retourne un statut ("sent"|"skipped"|"failed").
//   - No-op silencieux ("skipped") tant que WHATSAPP_CALLMEBOT_APIKEY +
//     WHATSAPP_NOTIFY_PHONE ne sont pas définis → le canal peut être mergé/déployé
//     AVANT que Will ait sa clé, sans aucun effet ni appel réseau.
//   - Timeout 4s (CallMeBot est un peu plus lent que Telegram).
//   - Texte PLAIN (pas de MarkdownV2) : cf. `markdownV2ToPlain()` dans format.ts.
//     WhatsApp rend nativement `*gras*` — les marqueurs `*label*` sont conservés.

const CALLMEBOT_ENDPOINT = "https://api.callmebot.com/whatsapp.php";

/** Longueur max de texte envoyée à CallMeBot (garde-fou URL / anti-troncature). */
const MAX_TEXT_LEN = 1000;

export type WhatsAppSendStatus = "sent" | "skipped" | "failed";

export interface WhatsAppChannelOptions {
  /** Message texte brut (déjà « déMarkdownisé » pour WhatsApp). */
  text: string;
  /** Timeout réseau ms (défaut 4000). */
  timeoutMs?: number;
}

/**
 * Envoie un message WhatsApp via CallMeBot vers le numéro configuré.
 *
 * @returns
 *   - `"skipped"` si la clé ou le numéro ne sont pas configurés (aucun fetch émis).
 *   - `"sent"`    si CallMeBot répond 2xx.
 *   - `"failed"`  si réseau KO / timeout / réponse non-2xx.
 */
export async function sendWhatsAppRaw(opts: WhatsAppChannelOptions): Promise<WhatsAppSendStatus> {
  const apiKey = process.env.WHATSAPP_CALLMEBOT_APIKEY?.trim();
  // On retire espaces/tirets éventuels saisis dans Coolify (ex. "+33 7 43 …").
  const phone = process.env.WHATSAPP_NOTIFY_PHONE?.replace(/[\s-]/g, "");

  if (!apiKey || !phone) {
    // Canal non configuré → skip sans bruit (comportement par défaut avant setup).
    return "skipped";
  }

  const text =
    opts.text.length > MAX_TEXT_LEN ? `${opts.text.slice(0, MAX_TEXT_LEN - 1)}…` : opts.text;
  const url =
    `${CALLMEBOT_ENDPOINT}?phone=${encodeURIComponent(phone)}` +
    `&text=${encodeURIComponent(text)}` +
    `&apikey=${encodeURIComponent(apiKey)}`;

  const timeoutMs = opts.timeoutMs ?? 4000;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { method: "GET", signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok && process.env.NODE_ENV !== "test") {
      try {
        const body = await res.text();
        console.warn(`[notif:whatsapp] ${res.status}: ${body.slice(0, 200)}`);
      } catch {
        // ignore
      }
    }
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
