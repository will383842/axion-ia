// Le SEUL module qui appelle le réseau. Toutes les requêtes visent
// `BASE_API` (https://axion-ia.com/api/enregistreur/) avec le jeton de
// l'appareil et la version du contrat. Aucune autre adresse, aucune clé d'IA.

import { BASE_API, ENTETE_CONTRAT, VERSION_CONTRAT } from "./constantes.js";

const ROUTE = /^[a-z0-9\-/]+$/;

/** L'adresse complète d'une route de l'enregistreur. */
export function urlDe(route) {
  if (!ROUTE.test(route) || route.includes("..")) throw new Error("route invalide");
  return BASE_API + route;
}

/**
 * Appelle une route. Rend `{ statut, corps }` ; une panne réseau rend
 * `{ statut: 0 }` (la file réessaiera).
 * @param {{ route: string, jeton: string, methode?: string, json?: unknown, octets?: ArrayBuffer, entetes?: Record<string, string> }} a
 */
export async function appeler(a) {
  const entetes = {
    [ENTETE_CONTRAT]: String(VERSION_CONTRAT),
    authorization: `Bearer ${a.jeton}`,
    ...(a.entetes ?? {}),
  };
  let body;
  if (a.octets) {
    entetes["content-type"] = "application/octet-stream";
    body = a.octets;
  } else if (a.json !== undefined) {
    entetes["content-type"] = "application/json";
    body = JSON.stringify(a.json);
  }
  try {
    const res = await fetch(urlDe(a.route), {
      method: a.methode ?? (body ? "POST" : "GET"),
      headers: entetes,
      body,
      credentials: "omit",
      cache: "no-store",
    });
    let corps = null;
    try {
      corps = await res.json();
    } catch {
      corps = null;
    }
    return { statut: res.status, corps };
  } catch {
    return { statut: 0, corps: null };
  }
}
