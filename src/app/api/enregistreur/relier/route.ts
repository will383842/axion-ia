/**
 * `GET /api/enregistreur/relier?nonce=<32 hex>` — « Relier à ma console »
 * (extension 1.4.0, demande de Williams du 02/10 : plus de copier-coller).
 *
 * Même principe que `ouvrir/route.ts` : l'extension ne connaît PAS le préfixe
 * secret de la console. Elle ouvre cette adresse dans un onglet ; la route
 * redirige (302) vers `rendez-vous/enregistreur?relier=<nonce>` SEULEMENT si le
 * navigateur porte une session admin habilitée (A2). Sinon : 404 sans
 * `Location`.
 *
 * Différence avec `ouvrir` : la liaison marche MÊME drapeau d'enregistrement
 * fermé — c'est la mise en service du poste, avant toute ouverture. Le nonce
 * n'est qu'un identifiant de liaison (le jeton, lui, ne passe jamais dans une
 * URL). Aucun jeton lu, aucun en-tête CORS.
 */

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { estBuildHorsLigne, indisponibleAuBuild, methodeRefusee } from "@/server/visio/garde-route";
import { peutVoirLesEchanges } from "@/features/dossier-client/roles-echanges";
import { FORMAT_NONCE_LIAISON } from "@/features/admin-enregistreur/etat-jeton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function introuvable(): Response {
  return new Response("Introuvable.", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(req: Request): Promise<Response> {
  if (estBuildHorsLigne()) return indisponibleAuBuild();

  const session = await auth();
  const role = (session?.user as { role?: string | null } | undefined)?.role ?? null;
  if (!session?.user || !peutVoirLesEchanges(role)) return introuvable();

  const nonce = new URL(req.url).searchParams.get("nonce") ?? "";
  if (!FORMAT_NONCE_LIAISON.test(nonce)) return introuvable();
  return new Response(null, {
    status: 302,
    headers: {
      location: `${adminPath("fr", "rendez-vous/enregistreur")}?relier=${nonce}`,
      "cache-control": "no-store",
    },
  });
}

export function OPTIONS(): Response {
  return methodeRefusee();
}
