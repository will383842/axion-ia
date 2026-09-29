/**
 * `GET /api/partners/evenements?after_sequence=&limit=` — relecture de la file de sortie par Axion
 * Partners (INT-T02, REQ-INT-012).
 *
 * Tout le chemin — verrou d'inertie, signature de la requête, lecture, signature de la réponse —
 * vit dans `src/server/partners-sync/relecture.ts`. Cette route ne fait que lui passer la requête.
 *
 * `force-dynamic` n'est pas décoratif : une route qui serait évaluée au build lirait la base
 * (REQ-INT-008). `scripts/gates/inertie.ts` refuse cette route sans lui.
 *
 * Canal fermé (`PARTNERS_SYNC_ENABLED` absent) ou secret absent : 404, rien n'est lu.
 */
import { repondreRelecture } from "@/server/partners-sync/relecture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(requete: Request): Promise<Response> {
  return repondreRelecture(requete);
}
