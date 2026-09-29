/**
 * `GET /api/enregistreur/ouvrir[?rencontre=<uuid>]` — le seul lien de
 * l'extension vers la console.
 *
 * L'extension ne connaît PAS le préfixe secret de la console (dépôt public,
 * paquet non empaqueté lisible sur le disque). Elle ouvre cette adresse dans
 * un onglet ; la route redirige (302) vers la page de la rencontre, ou vers
 * l'onglet « Rendez-vous » pour créer un rendez-vous, SEULEMENT si le
 * navigateur porte une session admin habilitée (A2). Sinon : 404, sans
 * `Location` — un `curl -I` ne doit jamais apprendre le préfixe.
 *
 * Seule route de l'enregistreur qui lit la session : elle est ouverte par Will
 * dans un onglet, pas appelée par l'extension. Aucun jeton, aucun en-tête CORS.
 */

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import {
  estBuildHorsLigne,
  identifiantValide,
  indisponibleAuBuild,
  methodeRefusee,
} from "@/server/visio/garde-route";
import { lireDrapeauEnregistrement } from "@/server/visio/drapeau";
import { roleAutoriseEnregistreur } from "@/server/visio/roles-enregistreur";

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
  if (lireDrapeauEnregistrement().effectif === "ferme") return introuvable();

  const session = await auth();
  const role = (session?.user as { role?: string | null } | undefined)?.role ?? null;
  if (!session?.user || !roleAutoriseEnregistreur(role)) return introuvable();

  const rencontre = new URL(req.url).searchParams.get("rencontre");
  // La page de la rencontre est livrée par la PR 4 (`rendez-vous/rencontres/[id]`).
  const cible =
    rencontre && identifiantValide(rencontre)
      ? adminPath("fr", `rendez-vous/rencontres/${rencontre}`)
      : adminPath("fr", "rendez-vous");
  return new Response(null, {
    status: 302,
    headers: { location: cible, "cache-control": "no-store" },
  });
}

export function OPTIONS(): Response {
  return methodeRefusee();
}
