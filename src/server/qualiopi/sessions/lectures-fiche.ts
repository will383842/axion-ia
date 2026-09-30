/**
 * Les lectures PARTAGÉES par le cadre de la fiche session (`layout.tsx`) et la
 * fiche elle-même (`page.tsx`) — mémoïsées le temps d'UN rendu.
 *
 * 🔴 Relecture L3 (30/09/2026) — le layout lisait l'état du verrou pour son
 * bandeau, la page le relisait pour choisir son onglet : deux requêtes pour
 * une même réponse, et deux réponses possibles si une écriture tombait entre
 * les deux. Même chose pour le parcours, lu par la checklist de la page ET par
 * « Encore possible » dans le bandeau. `cache` de React les partage pendant le
 * rendu d'une requête : une lecture, une vérité.
 *
 * ⚠️ Hors d'un rendu serveur (Server Action, worker, test), `cache` ne
 * mémoïse rien : ces fonctions relisent alors à chaque appel, comme avant. Les
 * écritures ne passent jamais par ici — elles relisent le verrou dans leur
 * transaction (`chargerEtatVerrou(id, tx)`).
 */

import { cache } from "react";

import { prochainesEcheances } from "@/server/qualiopi/parcours/echeances-service";
import { chargerEtatVerrou } from "./verrou-dossier";

/** L'état du verrou du dossier, `null` si la session n'existe pas. */
export const lireEtatVerrouFiche = cache((sessionId: string) => chargerEtatVerrou(sessionId));

/**
 * Le parcours de la session, par le MÊME service que « À traiter ».
 *
 * `null` quand la lecture échoue ou que la session est hors du balayage : la
 * checklist est un confort de lecture, son échec ne fait pas tomber la fiche.
 */
export const lireParcoursFiche = cache(async (sessionId: string) => {
  try {
    const { parSession } = await prochainesEcheances({ sessionIds: [sessionId] });
    return parSession.get(sessionId) ?? null;
  } catch {
    return null;
  }
});
