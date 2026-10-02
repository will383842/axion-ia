// « Relier à ma console » (1.4.0, 2026-10-02) — la liaison automatique
// extension ↔ console, sans copier-coller du jeton.
//
//   1. l'extension (options ou panneau) tire un NONCE (16 octets aléatoires,
//      usage unique, 10 min), le garde en stockage de session, et ouvre
//      `/api/enregistreur/relier?nonce=…` : le site redirige vers la console
//      (préfixe jamais connu de l'extension) si la session est habilitée ;
//   2. dans la console, « Relier » crée le jeton et le pose dans un élément
//      masqué (`data-relier-nonce`, `data-relier-jeton`) ;
//   3. le relais (`relais-console.js`) l'envoie au service worker
//      (`jeton_relie`), qui ne l'accepte qu'avec le nonce en attente, non
//      expiré, puis l'efface.
//
// Le jeton ne passe JAMAIS dans une URL : seule la nonce y figure.

import { urlDe } from "./api.js";

export const FORMAT_NONCE = /^[0-9a-f]{32}$/;
export const FORMAT_JETON = /^[0-9a-f]{64}$/;

/** Durée de vie d'un nonce de liaison. */
export const DUREE_NONCE_MS = 10 * 60 * 1000;

/** Clé du nonce en attente, en stockage de SESSION (effacé à la fermeture de Chrome). */
export const CLE_LIAISON = "liaisonEnAttente";

/** Drapeau posé après une liaison : les options affichent l'étape « micro ». */
export const CLE_LIE_RECEMMENT = "lieRecemment";

/** Une liaison neuve à partir de 16 octets aléatoires. */
export function nouvelleLiaison(octets, maintenant) {
  const nonce = Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("");
  if (!FORMAT_NONCE.test(nonce)) throw new Error("nonce invalide");
  return { nonce, expireLe: maintenant + DUREE_NONCE_MS };
}

/** L'adresse ouverte dans un onglet : la route du site, avec le nonce seul. */
export function urlLiaison(nonce) {
  if (!FORMAT_NONCE.test(String(nonce))) throw new Error("nonce invalide");
  return `${urlDe("relier")}?nonce=${nonce}`;
}

/** Vrai si le message porte le nonce en attente, non expiré, et un jeton bien formé. */
export function liaisonValide(attente, msg, maintenant) {
  if (!attente || typeof attente.nonce !== "string" || typeof attente.expireLe !== "number") {
    return false;
  }
  if (maintenant >= attente.expireLe) return false;
  if (!FORMAT_JETON.test(String(msg?.jeton ?? ""))) return false;
  return msg?.nonce === attente.nonce;
}

/** Geste « Relier à ma console » (options, panneau) : mémorise le nonce, ouvre l'onglet. */
export async function lancerLiaison() {
  const liaison = nouvelleLiaison(crypto.getRandomValues(new Uint8Array(16)), Date.now());
  await chrome.storage.session.set({ [CLE_LIAISON]: liaison });
  await chrome.tabs.create({ url: urlLiaison(liaison.nonce) });
}
