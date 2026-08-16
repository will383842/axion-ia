// Hub notifications — channel Telegram (Sprint Notif Infra 2026-05-26).
//
// Bas niveau : POST sendMessage avec parse_mode=MarkdownV2. Timeout 3s
// (vs 5s de l'ancien `sendTelegram` legacy — on est plus strict ici car
// l'API publique `notify()` est appelée depuis des Server Actions où la
// latence utilisateur compte).
//
// Fail-soft : ne throw jamais. Retourne false si KO.

const TG_API = "https://api.telegram.org";

/**
 * Plafond dur de l'API Telegram sur `sendMessage.text` : 4096 caracteres.
 * Au-dela, l'API repond 400 et le message n'arrive JAMAIS.
 */
const LIMITE_TELEGRAM = 4096;

/**
 * Taille visee par morceau. En dessous du plafond pour absorber les quelques
 * caracteres qu'un echappement MarkdownV2 peut encore ajouter en aval.
 */
const TAILLE_MORCEAU = 3900;

/**
 * Decoupe un message trop long en morceaux envoyables.
 *
 * 🔴 GEO-137 (audit GEO/AEO 2026-08-14) — POURQUOI CETTE FONCTION EXISTE.
 * `sendTelegramRaw` postait `text` tel quel. Un message depassant 4096
 * caracteres recevait un 400, la fonction rendait `false`, et le contrat
 * fail-soft (« ne throw jamais ») transformait ca en silence : l'alerte
 * n'arrivait pas, et rien ne le signalait. Le defaut a ete trouve sur les
 * alertes Qualiopi, mais il portait sur TOUTES les categories de notification —
 * c'est ce point d'entree qui est commun.
 *
 * ⚠️ On decoupe sur les SAUTS DE LIGNE, jamais au milieu d'une ligne tant qu'on
 * peut l'eviter : une coupe arbitraire tombe un jour au milieu d'une entite
 * MarkdownV2 (`*gras*`, `[lien](url)`), et Telegram refuse alors le morceau —
 * on aurait remplace une perte silencieuse par une autre.
 *
 * LIMITE ASSUMEE : si une SEULE ligne depasse la taille d'un morceau, il n'y a
 * pas de frontiere sure. Elle est alors coupee net. Ce cas ne se produit pas
 * sur les gabarits actuels (une ligne y est un item de liste) ; s'il apparait,
 * c'est le gabarit qu'il faut corriger, pas cette fonction.
 */
export function decouperPourTelegram(texte: string, taille = TAILLE_MORCEAU): string[] {
  if (texte.length <= taille) return [texte];
  const morceaux: string[] = [];
  let courant = "";
  for (const ligne of texte.split("\n")) {
    // Ligne seule plus longue qu'un morceau : aucune frontiere sure.
    if (ligne.length > taille) {
      if (courant) {
        morceaux.push(courant);
        courant = "";
      }
      for (let i = 0; i < ligne.length; i += taille) morceaux.push(ligne.slice(i, i + taille));
      continue;
    }
    const candidat = courant ? `${courant}\n${ligne}` : ligne;
    if (candidat.length > taille) {
      morceaux.push(courant);
      courant = ligne;
    } else {
      courant = candidat;
    }
  }
  if (courant) morceaux.push(courant);
  return morceaux;
}

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

/**
 * Envoie un message, en le decoupant si necessaire (GEO-137).
 *
 * Rend `true` seulement si TOUS les morceaux sont partis : un message dont la
 * seconde moitie manque n'est pas un message envoye.
 */
export async function sendTelegramRaw(opts: TelegramChannelOptions): Promise<boolean> {
  const morceaux = decouperPourTelegram(opts.text);
  if (morceaux.length === 1) return envoyerUnMorceau(opts, opts.text);
  let toutOk = true;
  for (const morceau of morceaux) {
    // Sequentiel et non parallele : Telegram limite le debit par salon, et un
    // envoi concurrent melangerait l'ordre des morceaux a l'affichage.
    const ok = await envoyerUnMorceau(opts, morceau);
    if (!ok) toutOk = false;
  }
  return toutOk;
}

async function envoyerUnMorceau(opts: TelegramChannelOptions, texte: string): Promise<boolean> {
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
        text: texte,
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
