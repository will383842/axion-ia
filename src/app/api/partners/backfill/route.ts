/**
 * `POST /api/partners/backfill` — rattrapage de l'historique, une page par appel (INT-T21-A,
 * REQ-INT-011, REQ-INT-012).
 *
 * Tout le chemin — verrou d'inertie, signature de la requête, bornes du corps, émission par les
 * producteurs existants, signature de la réponse — vit dans `src/server/partners-sync/backfill.ts`.
 * Cette route ne fait que lui passer la requête.
 *
 * `force-dynamic` n'est pas décoratif : une route évaluée au build lirait la base (REQ-INT-008).
 *
 * Canal fermé (`PARTNERS_SYNC_ENABLED` absent) ou secret absent : 404, rien n'est lu.
 */
import { repondreBackfill } from "@/server/partners-sync/backfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(requete: Request): Promise<Response> {
  return repondreBackfill(requete);
}
