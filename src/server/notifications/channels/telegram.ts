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

/**
 * Découpe un texte en messages qui tiennent chacun sous le plafond de l'API.
 *
 * Réservé au salon « Clients » (décision Will 15/10) : là, et là seulement, on
 * veut TOUT le détail, donc on découpe au lieu de tronquer. Coupe sur une
 * frontière de ligne ; une ligne seule plus longue que la place (un message
 * collé d'un bloc) est coupée net — le texte est envoyé brut, aucune entité ne
 * peut être tranchée. À partir du deuxième, chaque morceau porte « (suite n/N) ».
 */
export function decouperPourTelegram(texte: string, plafond = LIMITE_TELEGRAM): string[] {
  // Place réservée à la mention « (suite 99/99) » et à son saut de ligne.
  const place = plafond - 20;
  const morceaux: string[] = [];
  let courant = "";
  const pousser = () => {
    if (courant !== "") morceaux.push(courant);
    courant = "";
  };
  for (const brute of texte.split("\n")) {
    let ligne = brute;
    while (ligne.length > place) {
      pousser();
      morceaux.push(ligne.slice(0, place));
      ligne = ligne.slice(place);
    }
    const ajout = courant === "" ? ligne : `${courant}\n${ligne}`;
    if (ajout.length > place) {
      pousser();
      courant = ligne;
    } else {
      courant = ajout;
    }
  }
  pousser();
  if (morceaux.length <= 1) return morceaux.length === 1 ? morceaux : [""];
  return morceaux.map((m, i) => (i === 0 ? m : `(suite ${i + 1}/${morceaux.length})\n${m}`));
}

export interface TelegramChannelOptions {
  /** Message MarkdownV2 déjà formaté + échappé — ou texte brut si `brut`. */
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
  /**
   * Texte BRUT : envoyé sans `parse_mode` et sans la troncature de lecture
   * (800 caractères / 10 lignes). Réservé au salon « Clients » (décision Will
   * 15/10), dont le texte libre ne doit jamais pouvoir casser l'envoi.
   * L'appelant découpe d'abord (`decouperPourTelegram`).
   */
  brut?: boolean;
}

/** Délai maximal accepté sur un 429 avant l'unique nouvel essai. */
const ATTENTE_MAX_429_MS = 5_000;

interface ReponseTelegram {
  ok: boolean;
  status: number;
  /** `parameters` de la réponse d'erreur Telegram, s'il y en a. */
  parametres?: { retry_after?: unknown; migrate_to_chat_id?: unknown };
  description?: string;
}

async function poster(
  token: string,
  corps: Record<string, unknown>,
  timeoutMs: number,
): Promise<ReponseTelegram> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${TG_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corps),
      signal: ctrl.signal,
    });
    if (res.ok) return { ok: true, status: res.status };
    // Telegram explique ses refus dans un corps JSON : `parameters` porte le
    // délai d'un 429 et le nouvel identifiant d'un salon devenu supergroupe.
    let json: { description?: unknown; parameters?: ReponseTelegram["parametres"] } = {};
    try {
      json = (await res.json()) as typeof json;
    } catch {
      // corps illisible : on garde le statut seul
    }
    return {
      ok: false,
      status: res.status,
      ...(json.parameters ? { parametres: json.parameters } : {}),
      ...(typeof json.description === "string" ? { description: json.description } : {}),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Signale qu'un salon a changé d'identifiant (devenu supergroupe). Le message
 * est arrivé — renvoyé au nouvel id — mais la variable d'environnement est à
 * corriger, sinon chaque alerte paiera un aller-retour de plus.
 */
async function signalerMigration(ancien: string, nouveau: string): Promise<void> {
  const texte =
    `[notif:telegram] le salon ${ancien} est devenu un supergroupe : nouvel identifiant ${nouveau}. ` +
    "Mettre à jour la variable TELEGRAM_CHAT_ID_* correspondante (app web ET worker).";
  console.error(texte);
  try {
    const sentry = (await import("@sentry/nextjs")) as unknown as {
      captureMessage: (m: string, o: { level: "error" }) => void;
    };
    sentry.captureMessage(texte, { level: "error" });
  } catch {
    // Sentry absent : le journal ci-dessus suffit
  }
}

/**
 * Envoie un message. Tronque au besoin (GEO-137), sauf en mode `brut`.
 *
 * Fiabilité (décision Will 15/10) :
 *  - 429 « trop de requêtes » : attend `retry_after` (au plus 5 s) puis
 *    réessaie UNE fois ;
 *  - 400 avec `migrate_to_chat_id` (salon devenu supergroupe) : renvoie au
 *    nouvel identifiant, et le signale (Sentry + journal) pour qu'on corrige
 *    la variable.
 */
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
  const corps = (cible: string): Record<string, unknown> => ({
    chat_id: cible,
    ...(opts.brut
      ? { text: opts.text }
      : { text: preparerPourTelegram(opts.text), parse_mode: "MarkdownV2" }),
    disable_notification: opts.silent ?? false,
  });
  try {
    let cible = chatId;
    let res = await poster(token, corps(cible), timeoutMs);

    if (!res.ok && res.status === 429) {
      const delaiS = Number(res.parametres?.retry_after);
      const attente = Number.isFinite(delaiS) && delaiS > 0 ? delaiS * 1000 : 1000;
      await new Promise((r) => setTimeout(r, Math.min(attente, ATTENTE_MAX_429_MS)));
      res = await poster(token, corps(cible), timeoutMs);
    }

    const migre = res.parametres?.migrate_to_chat_id;
    if (!res.ok && res.status === 400 && (typeof migre === "number" || typeof migre === "string")) {
      cible = String(migre);
      await signalerMigration(chatId, cible);
      res = await poster(token, corps(cible), timeoutMs);
    }

    if (!res.ok && process.env.NODE_ENV !== "test") {
      console.warn(`[notif:telegram] ${res.status}: ${(res.description ?? "").slice(0, 300)}`);
    }
    return res.ok;
  } catch {
    return false;
  }
}

/** Plafond dur de l'API, exporté pour les gardes. */
export const PLAFOND_TELEGRAM = LIMITE_TELEGRAM;
