/**
 * `POST /api/enregistreur/sessions` — démarre (ou reprend) un enregistrement, en attente d'accord.
 *
 * Garde commune et traitement : `src/server/visio/routes-enregistreur.ts`.
 * Aucun cookie lu, aucun en-tête CORS (l'appelant est l'extension).
 */

import { estBuildHorsLigne, indisponibleAuBuild, methodeRefusee } from "@/server/visio/garde-route";
import { traiterCreerSession } from "@/server/visio/routes-enregistreur";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  if (estBuildHorsLigne()) return indisponibleAuBuild();
  return traiterCreerSession(req);
}

export function OPTIONS(): Response {
  return methodeRefusee();
}
