/**
 * `POST /api/enregistreur/appareil/battement` — versions et file locale ; aucun nom, aucun texte.
 *
 * Garde commune et traitement : `src/server/visio/routes-enregistreur.ts`.
 * Aucun cookie lu, aucun en-tête CORS (l'appelant est l'extension).
 */

import { estBuildHorsLigne, indisponibleAuBuild, methodeRefusee } from "@/server/visio/garde-route";
import { traiterBattementAppareil } from "@/server/visio/routes-enregistreur";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  if (estBuildHorsLigne()) return indisponibleAuBuild();
  return traiterBattementAppareil(req);
}

export function OPTIONS(): Response {
  return methodeRefusee();
}
