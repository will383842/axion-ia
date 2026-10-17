/**
 * 🔴 CHANTIER QNC, LOT L07 — TEST DU LIEN DE VISIO À J-1.
 *
 * La veille du début (jour de Paris), le worker vérifie que le lien Zoom d'une
 * session distancielle répond, et écrit le résultat au journal
 * (`qualiopi.moyens.test_lien_j1`). Un lien absent ou qui ne répond pas lève
 * une alerte dans les logs du worker.
 *
 * ⚠️ On n'appelle QUE des hôtes `zoom.us` (`estLienZoom`) et on ne suit AUCUNE
 * redirection : l'URL est saisie par un administrateur, elle ne doit jamais
 * servir à sonder le réseau interne.
 */

import { estLienZoom } from "@/server/qualiopi/moyens/moyens-regles";

export type ResultatTestLien =
  | { ok: true; statut: number }
  | { ok: false; raison: "manquant" | "pas_zoom" | "ne_repond_pas" | "statut"; statut?: number };

export type Requeteur = (
  url: string,
  init: { method: "GET"; redirect: "manual"; signal: AbortSignal },
) => Promise<{ status: number }>;

export const DELAI_TEST_LIEN_MS = 8000;

export async function testerLienVisio(
  url: string | null | undefined,
  requeteur: Requeteur = fetch as unknown as Requeteur,
): Promise<ResultatTestLien> {
  if (!url || url.trim() === "") return { ok: false, raison: "manquant" };
  if (!estLienZoom(url)) return { ok: false, raison: "pas_zoom" };
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), DELAI_TEST_LIEN_MS);
  try {
    const r = await requeteur(url.trim(), {
      method: "GET",
      redirect: "manual",
      signal: ctrl.signal,
    });
    // 2xx et 3xx : Zoom répond (la salle web redirige). 4xx/5xx : lien mort.
    if (r.status >= 200 && r.status < 400) return { ok: true, statut: r.status };
    return { ok: false, raison: "statut", statut: r.status };
  } catch {
    return { ok: false, raison: "ne_repond_pas" };
  } finally {
    clearTimeout(minuteur);
  }
}
