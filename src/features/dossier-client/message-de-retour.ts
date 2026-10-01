/**
 * Le message qu'une action du dossier client laisse à la page de retour
 * (`?message=` ou `?erreur=`) — N1, 2e vérification du chantier visio.
 *
 * Une page qui affichait `?message=` en texte libre montrait aussi un message
 * FORGÉ : un lien `…?vue=apres-l-appel&message=…` reçu par Will faisait dire
 * n'importe quoi à la console. Désormais l'action SCELLE son message
 * (HMAC-SHA256, clé dérivée d'`AUTH_SECRET`) et la page n'affiche que les
 * messages scellés par le serveur : la liste connue est « ce que nos actions
 * ont écrit », rien d'autre. Le texte lui-même a déjà été filtré par
 * `messageAffichable` (jamais une erreur technique).
 *
 * Sans `AUTH_SECRET` (poste de développement, tests), une clé aléatoire du
 * processus : le sceau reste infalsifiable, il ne survit pas à un redémarrage.
 * Module serveur (node:crypto) ; aucun import d'exécution du projet.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type CleDeRetour = "message" | "erreur";

const LONGUEUR_MAX = 300;
const CLE_DU_PROCESSUS = randomBytes(32);

function sceller(cle: CleDeRetour, texte: string): string {
  const secret = process.env["AUTH_SECRET"];
  const cleHmac =
    secret && secret.length > 0
      ? createHmac("sha256", secret).update("dossier-client/message-de-retour").digest()
      : CLE_DU_PROCESSUS;
  return createHmac("sha256", cleHmac).update(`${cle}\n${texte}`).digest("base64url").slice(0, 32);
}

/** `url` suivie de `cle=<texte>&sceau=<sceau>`. */
export function avecMessageDeRetour(url: string, cle: CleDeRetour, texte: string): string {
  const court = texte.slice(0, LONGUEUR_MAX);
  const q = `${cle}=${encodeURIComponent(court)}&sceau=${sceller(cle, court)}`;
  return `${url}${url.includes("?") ? "&" : "?"}${q}`;
}

/** Le message scellé de la page, ou `null` (absent, ou forgé : rien ne s'affiche). */
export function lireMessageDeRetour(
  sp: Readonly<Record<string, unknown>>,
  cle: CleDeRetour,
): string | null {
  const texte = sp[cle];
  const sceau = sp["sceau"];
  if (typeof texte !== "string" || texte === "" || typeof sceau !== "string") return null;
  const attendu = Buffer.from(sceller(cle, texte));
  const recu = Buffer.from(sceau);
  if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) return null;
  return texte;
}
