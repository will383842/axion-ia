/**
 * `PUT /api/enregistreur/sessions/[id]/morceaux` — la SEULE route qui accepte du son, chiffré avant R2.
 *
 * Garde commune et traitement : `src/server/visio/routes-enregistreur.ts`.
 * Aucun cookie lu, aucun en-tête CORS (l'appelant est l'extension).
 */

import { estBuildHorsLigne, indisponibleAuBuild, methodeRefusee } from "@/server/visio/garde-route";
import { traiterMorceau } from "@/server/visio/routes-enregistreur";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (estBuildHorsLigne()) return indisponibleAuBuild();
  const { id } = await params;
  return traiterMorceau(req, id);
}

export function OPTIONS(): Response {
  return methodeRefusee();
}
