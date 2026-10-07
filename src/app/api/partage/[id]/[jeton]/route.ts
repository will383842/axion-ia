/**
 * LA PAGE DE TÉLÉCHARGEMENT d'un lien privé : `/api/partage/<id>/<jeton>`
 * (Candidatures unifiées L5, ADR 0065 D6).
 *
 * Route PUBLIQUE (aucune session) : le jeton est la seule clé. Sous `/api/`,
 * donc hors du `matcher` de `src/proxy.ts` (aucune redirection vers `/fr/…`,
 * aucune modification du proxy). HTML statique sans script, quelques ko.
 *
 * En-têtes posés ici ET par la règle `/api/partage/:path*` de `next.config.ts`
 * (`no-referrer`, `noindex`, CSP) ; `no-store` partout : Cloudflare ne garde
 * rien (`cf-cache-status: DYNAMIC`).
 *
 * Tout refus (jeton faux, lien expiré ou retiré, fonction éteinte, base
 * factice du build) → la MÊME page neutre, 404. `HEAD` n'écrit rien.
 */

import { depsParDefaut, ouvrirPageLien } from "@/server/partages/acces";
import { ENTETES_PAGE_PARTAGE, pageNeutre } from "@/server/partages/page-publique";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Contexte = { params: Promise<{ id: string; jeton: string }> };

async function repondre(req: Request, { params }: Contexte, methode: "GET" | "HEAD") {
  const { id, jeton } = await params;
  const r = await ouvrirPageLien(
    { id, jeton, methode, entetes: req.headers },
    await depsParDefaut(),
  );
  const corps = r.issue === "page" ? r.html : pageNeutre();
  return new Response(methode === "HEAD" ? null : corps, {
    status: r.issue === "page" ? 200 : 404,
    headers: ENTETES_PAGE_PARTAGE,
  });
}

export async function GET(req: Request, ctx: Contexte): Promise<Response> {
  return repondre(req, ctx, "GET");
}

export async function HEAD(req: Request, ctx: Contexte): Promise<Response> {
  return repondre(req, ctx, "HEAD");
}
