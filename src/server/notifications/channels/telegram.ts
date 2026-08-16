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
 * Longueur maximale conservee.
 *
 * 🔑 Ce n'est PAS une contrainte technique — le plafond de l'API est a 4096.
 * C'est une contrainte de LECTURE, decidee par Will apres essai en conditions
 * reelles : « je veux le message encore plus court ». Une alerte se lit sur un
 * telephone, souvent en marchant ; au-dela d'un ecran, elle n'est plus lue, et
 * une alerte non lue ne vaut pas mieux qu'une alerte perdue.
 *
 * 800 caracteres correspondent a ce qui tient sans faire defiler.
 */
const TAILLE_UTILE = 800;

/**
 * Nombre maximal de lignes conservees.
 *
 * Le compte de caracteres ne suffit pas : un humain SCANNE DES LIGNES, pas des
 * caracteres. Quinze lignes courtes tiennent sous 800 caracteres tout en
 * produisant un mur illisible. Les deux bornes s'appliquent, la premiere
 * atteinte l'emporte.
 */
const MAX_LIGNES = 10;

/**
 * Prepare un message pour l'envoi : le tronque proprement s'il depasse le
 * plafond de l'API.
 *
 * 🔴 GEO-137 (audit GEO/AEO 2026-08-14) — POURQUOI CETTE FONCTION EXISTE.
 * `sendTelegramRaw` postait `text` tel quel. Un message depassant 4096
 * caracteres recevait un 400 ; l'echec etait journalise
 * (`console.warn("[notif:telegram] 400: …")`) mais le contrat fail-soft du canal
 * faisait que l'appelant continuait comme si de rien n'etait, et le destinataire
 * ne recevait RIEN. Trouve sur les alertes Qualiopi, le defaut portait sur
 * toutes les categories : c'est ce point d'entree qui leur est commun.
 *
 * 🔑 POURQUOI ON TRONQUE, ET NON PLUS ON DECOUPE. La premiere version envoyait
 * le message en plusieurs morceaux. Elle a ete essayee en conditions reelles,
 * et Will a tranche : « inutile de recevoir un message si long dans Telegram,
 * je ne vais pas le lire ». Il a raison, et c'est la bonne facon de poser le
 * probleme. Une notification n'est pas un rapport : elle sert a dire QU'IL SE
 * PASSE QUELQUE CHOSE et OU REGARDER. Livrer 6 000 caracteres en trois messages
 * ne les rend pas lisibles — ca produit trois notifications ignorees au lieu
 * d'une perte, et ca fait desapprendre a lire les alertes.
 *
 * On garde donc le DEBUT du message — ou se trouvent le titre et les premieres
 * lignes utiles — et on annonce explicitement combien de lignes ont ete
 * ecartees. Le detail complet reste en base et dans les journaux ; Telegram
 * n'est pas l'endroit ou on le consulte.
 *
 * ⚠️ La coupe tombe sur une FRONTIERE DE LIGNE, jamais au milieu : une coupe
 * arbitraire tranche un jour une entite MarkdownV2 (`*gras*`, `[lien](url)`),
 * Telegram refuse alors le message, et on aurait remplace une perte par une
 * autre. Les gabarits produisent une ligne par item : la frontiere de ligne est
 * sure.
 */
export function preparerPourTelegram(
  texte: string,
  taille = TAILLE_UTILE,
  maxLignes = MAX_LIGNES,
): string {
  const lignes = texte.split("\n");
  if (texte.length <= taille && lignes.length <= maxLignes) return texte;

  const gardees: string[] = [];
  let longueur = 0;
  for (const ligne of lignes) {
    if (gardees.length >= maxLignes) break;
    const cout = gardees.length === 0 ? ligne.length : ligne.length + 1;
    if (longueur + cout > taille) break;
    gardees.push(ligne);
    longueur += cout;
  }

  // Cas limite : la toute premiere ligne depasse deja la taille utile. Aucune
  // frontiere sure n'existe alors — on coupe net. Ce cas ne se produit pas sur
  // les gabarits actuels ; s'il apparait, c'est le gabarit qu'il faut corriger.
  if (gardees.length === 0) {
    return `${texte.slice(0, taille)}\n${mentionTroncature(lignes.length)}`;
  }

  const ecartees = lignes.length - gardees.length;
  return `${gardees.join("\n")}\n${mentionTroncature(ecartees)}`;
}

/**
 * Mention ajoutee quand un message a ete tronque.
 *
 * ⚠️ AUCUN caractere special MarkdownV2 (`_ * [ ] ( ) ~ backtick > # + - = | { } . !`) :
 * un seul suffirait a faire refuser le message entier par Telegram, et on
 * perdrait celui qu'on essaie justement de sauver. Les chiffres et les lettres
 * sont surs ; les deux points aussi.
 */
function mentionTroncature(lignesEcartees: number): string {
  return `TRONQUE ${lignesEcartees} lignes non affichees voir la console`;
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

/** Envoie un message, tronque au besoin pour qu'il arrive (GEO-137). */
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
        text: preparerPourTelegram(opts.text),
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

/** Plafond dur de l'API, exporté pour les gardes. */
export const PLAFOND_TELEGRAM = LIMITE_TELEGRAM;
