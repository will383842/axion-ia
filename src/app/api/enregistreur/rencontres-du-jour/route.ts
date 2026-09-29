/**
 * `GET /api/enregistreur/rencontres-du-jour` — les rendez-vous enregistrables de −3 h à +12 h.
 *
 * Garde commune et traitement : `src/server/visio/routes-enregistreur.ts`.
 * Aucun cookie lu, aucun en-tête CORS (l'appelant est l'extension).
 */

import { estBuildHorsLigne, indisponibleAuBuild, methodeRefusee } from "@/server/visio/garde-route";
import { traiterRencontresDuJour } from "@/server/visio/routes-enregistreur";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  if (estBuildHorsLigne()) return indisponibleAuBuild();
  return traiterRencontresDuJour(req);
}

export function OPTIONS(): Response {
  return methodeRefusee();
}
