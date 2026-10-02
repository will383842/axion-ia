/**
 * `POST /api/partners/reconciliation` — rejeu, par Axion Partners, des événements que sa
 * réconciliation n'a pas reçus (INT-T08-A, REQ-INT-013).
 *
 * Tout le chemin — verrou d'inertie, signature de la requête, bornes du corps, réarmement des
 * lignes, signature de la réponse — vit dans `src/server/partners-sync/reconciliation.ts`. Cette
 * route ne fait que lui passer la requête.
 *
 * `force-dynamic` n'est pas décoratif : une route évaluée au build lirait la base (REQ-INT-008).
 *
 * Canal fermé (`PARTNERS_SYNC_ENABLED` absent) ou secret absent : 404, rien n'est écrit.
 */
import { repondreReconciliation } from "@/server/partners-sync/reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(requete: Request): Promise<Response> {
  return repondreReconciliation(requete);
}
