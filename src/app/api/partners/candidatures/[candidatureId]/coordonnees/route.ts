/**
 * `GET /api/partners/candidatures/{candidatureId}/coordonnees` — les coordonnées d'un candidat
 * ÉMIS vers Axion Partners, tirées par Partners au moment du traitement (INT-T27-A, REQ-INT-032,
 * partners/ADR-0023).
 *
 * Tout le chemin — inertie, signature, liste d'adresses, plafond, portée, déchiffrement, journal —
 * vit dans `src/server/partners-sync/coordonnees.ts`. Cette route ne fait que lui passer la requête.
 *
 * `force-dynamic` n'est pas décoratif : une route évaluée au build lirait la base (REQ-INT-008).
 */
import { repondreCoordonnees } from "@/server/partners-sync/coordonnees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  requete: Request,
  { params }: { params: Promise<{ candidatureId: string }> },
): Promise<Response> {
  const { candidatureId } = await params;
  return repondreCoordonnees(requete, candidatureId);
}
