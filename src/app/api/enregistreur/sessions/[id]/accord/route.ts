/**
 * `POST /api/enregistreur/sessions/[id]/accord` — « Accord obtenu » : preuve d'accord et information au registre (jamais `optin`).
 *
 * Garde commune et traitement : `src/server/visio/routes-enregistreur.ts`.
 * Aucun cookie lu, aucun en-tête CORS (l'appelant est l'extension).
 */

import { estBuildHorsLigne, indisponibleAuBuild, methodeRefusee } from "@/server/visio/garde-route";
import { traiterAccord } from "@/server/visio/routes-enregistreur";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (estBuildHorsLigne()) return indisponibleAuBuild();
  const { id } = await params;
  return traiterAccord(req, id);
}

export function OPTIONS(): Response {
  return methodeRefusee();
}
