/**
 * Adresse PROFESSIONNELLE ou PERSONNELLE ? (lot L2, amendement de Will du 24/09)
 *
 * La lettre d'Axion-IA ne repose pas sur la même base selon la nature de
 * l'adresse qui demande le guide :
 *   · adresse PROFESSIONNELLE (domaine d'une organisation) : inscription
 *     automatique, au titre de l'intérêt légitime B2B, avec information à la
 *     collecte et désinscription en un clic ;
 *   · adresse PERSONNELLE (webmail grand public) : aucune prospection sans
 *     consentement (art. L.34-5 du CPCE) — une case facultative, décochée.
 *
 * 🔑 La décision se prend CÔTÉ SERVEUR, avec cette liste. Le formulaire
 * l'importe aussi, mais seulement pour AFFICHER la case : ce qu'il envoie ne
 * décide de rien.
 *
 * ⚖️ Le sens de l'erreur tolérable : une adresse perso prise pour une adresse
 * pro serait inscrite sans son accord — c'est l'erreur à ne pas faire. Une
 * adresse pro prise pour une perso se voit seulement proposer une case. D'où
 * une liste LARGE, et un doute qui penche toujours vers « perso ».
 *
 * ⚠️ Module PUR, sans dépendance : importé par un composant client.
 */

export type NatureAdresse = "pro" | "perso";

/** Domaines de webmail grand public, à l'identique. Liste FERMÉE, testée. */
export const DOMAINES_WEBMAIL: ReadonlySet<string> = new Set([
  // Google, Apple, Microsoft (domaines hors familles ci-dessous)
  "gmail.com",
  "googlemail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "msn.com",
  // Fournisseurs d'accès français
  "orange.fr",
  "wanadoo.fr",
  "free.fr",
  "sfr.fr",
  "neuf.fr",
  "cegetel.net",
  "club-internet.fr",
  "bbox.fr",
  "numericable.fr",
  "aliceadsl.fr",
  "laposte.net",
  // Messageries grand public
  "proton.me",
  "protonmail.com",
  "protonmail.ch",
  "pm.me",
  "aol.com",
  "aol.fr",
  "ymail.com",
  "rocketmail.com",
  "tutanota.com",
  "tuta.io",
  "mail.com",
  "yandex.com",
  "yandex.ru",
  "mail.ru",
  "web.de",
]);

/**
 * Familles déclinées sur plusieurs extensions (`hotmail.fr`, `outlook.com`,
 * `yahoo.co.uk`, `gmx.de`…) : le premier label, suivi d'une extension courte.
 */
export const FAMILLES_WEBMAIL: ReadonlySet<string> = new Set([
  "hotmail",
  "outlook",
  "live",
  "yahoo",
  "gmx",
]);

/** Une extension : un ou deux labels courts, en lettres (`fr`, `com`, `co.uk`, `com.br`). */
const EXTENSION = /^[a-z]{2,3}(\.[a-z]{2,3})?$/;

function domaineDe(email: string): string {
  const brut = email.trim().toLowerCase();
  const arobase = brut.lastIndexOf("@");
  return arobase === -1 ? "" : brut.slice(arobase + 1).replace(/\.+$/, "");
}

/**
 * Nature d'une adresse. Une adresse illisible répond « perso » : dans le doute,
 * on demande l'accord plutôt que de le présumer.
 */
export function natureAdresse(email: string): NatureAdresse {
  return natureDuDomaine(domaineDe(email));
}

/** Même décision, sur le seul domaine (en minuscules). */
export function natureDuDomaine(domaine: string): NatureAdresse {
  if (domaine === "" || !domaine.includes(".")) return "perso";
  if (DOMAINES_WEBMAIL.has(domaine)) return "perso";
  const point = domaine.indexOf(".");
  const famille = domaine.slice(0, point);
  const extension = domaine.slice(point + 1);
  if (FAMILLES_WEBMAIL.has(famille) && EXTENSION.test(extension)) return "perso";
  return "pro";
}
