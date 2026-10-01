/**
 * Le LIEN PUBLIC d'une page envoyée au client : `/document/<id>/<jeton>`
 * (ADR 0063, D12).
 *
 * Hors `[locale]` et EXCLU du `matcher` de `src/proxy.ts` (sinon la règle 0bis
 * le redirige vers `/fr/document/…`, 404). Sert, sous un bac à sable à origine
 * opaque, une page HTML que Will a déposée — et rien d'autre : un seul 404
 * neutre pour tous les refus (jeton faux, archivé, non partageable, verdict non
 * sain, base factice du build), rien ne dit lequel.
 *
 * Les en-têtes de sécurité sont posés ici ET par la règle `/document/:path*` de
 * `next.config.ts` (mêmes valeurs) : la règle générale `/:path*` posant déjà
 * `Referrer-Policy`, l'en-tête de la route serait sinon ignoré par Next.
 * `HEAD` répond sans corps et n'écrit rien.
 */

import { lirePagePublique } from "@/features/dossier-client/documents/page-publique";
import { ENTETES_PAGE_PARTAGEE } from "@/features/dossier-client/documents/partage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Le 404 neutre : HTML statique, sans script, identique pour tous les refus. */
const PAGE_INTROUVABLE =
  '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
  '<meta name="robots" content="noindex"><title>Page indisponible</title></head>' +
  "<body><p>Cette page n'est pas disponible. Si vous pensez qu'il s'agit d'une erreur, " +
  "écrivez à contact@axion-ia.com.</p></body></html>";

type Contexte = { params: Promise<{ id: string; jeton: string }> };

async function repondre(req: Request, { params }: Contexte, methode: "GET" | "HEAD") {
  const { id, jeton } = await params;
  const page = await lirePagePublique(prisma, { id, jeton, methode, entetes: req.headers });
  if (page === null) {
    return new Response(methode === "HEAD" ? null : PAGE_INTROUVABLE, {
      status: 404,
      headers: ENTETES_PAGE_PARTAGEE,
    });
  }
  return new Response(methode === "HEAD" ? null : (page as unknown as BodyInit), {
    status: 200,
    headers: { ...ENTETES_PAGE_PARTAGEE, "Content-Length": String(page.length) },
  });
}

export async function GET(req: Request, ctx: Contexte): Promise<Response> {
  return repondre(req, ctx, "GET");
}

export async function HEAD(req: Request, ctx: Contexte): Promise<Response> {
  return repondre(req, ctx, "HEAD");
}
