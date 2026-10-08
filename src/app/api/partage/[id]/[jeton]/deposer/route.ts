/**
 * DÉPOSER SA VERSION par un lien privé : `/api/partage/<id>/<jeton>/deposer`
 * (Candidatures unifiées L5b, plan [B2]).
 *
 *   - `GET`  → la page de dépôt (seule page du lien qui charge un script, servi
 *              à part par `/api/partage/script-depot`) ;
 *   - `POST` → une étape de l'envoi (JSON) : commencer, signer, reprendre, terminer.
 *
 * Route PUBLIQUE (aucune session) : le jeton est la seule clé, revérifié à
 * CHAQUE appel par `depot-public.ts`. Le fichier ne transite pas par le
 * serveur : le navigateur l'envoie par morceaux directement au stockage.
 *
 * Tout refus d'accès (jeton faux, lien expiré, retiré, sans dépôt autorisé,
 * fonction éteinte, base factice du build) → la MÊME page neutre (GET) ou la
 * même réponse (POST), 404. `no-store` partout.
 */

import {
  CORPS_DEPOT_MAX_OCTETS,
  depsDepotParDefaut,
  ouvrirPageDepot,
  traiterDepot,
} from "@/server/partages/depot-public";
import {
  ENTETES_PAGE_DEPOT,
  ENTETES_PAGE_PARTAGE,
  pageNeutre,
} from "@/server/partages/page-publique";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Contexte = { params: Promise<{ id: string; jeton: string }> };

const ENTETES_JSON: Readonly<Record<string, string>> = {
  ...ENTETES_PAGE_PARTAGE,
  "Content-Type": "application/json; charset=utf-8",
};

export async function GET(_req: Request, { params }: Contexte): Promise<Response> {
  const { id, jeton } = await params;
  const r = await ouvrirPageDepot({ id, jeton }, await depsDepotParDefaut());
  if (r.issue === "page") {
    return new Response(r.html, { status: 200, headers: ENTETES_PAGE_DEPOT });
  }
  return new Response(pageNeutre(), { status: 404, headers: ENTETES_PAGE_PARTAGE });
}

export async function HEAD(): Promise<Response> {
  return new Response(null, { status: 204, headers: ENTETES_PAGE_PARTAGE });
}

export async function POST(req: Request, { params }: Contexte): Promise<Response> {
  const { id, jeton } = await params;
  const texte = await req.text().catch(() => "");
  if (texte.length > CORPS_DEPOT_MAX_OCTETS) {
    return Response.json(
      { ok: false, erreur: "Demande invalide." },
      { status: 413, headers: ENTETES_JSON },
    );
  }
  let corps: unknown = null;
  try {
    corps = JSON.parse(texte);
  } catch {
    corps = null;
  }
  const r = await traiterDepot(
    { id, jeton, contentType: req.headers.get("content-type"), corps },
    await depsDepotParDefaut(),
  );
  return Response.json(r.json, { status: r.statut, headers: ENTETES_JSON });
}
