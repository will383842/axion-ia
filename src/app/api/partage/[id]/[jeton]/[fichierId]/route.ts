/**
 * TÉLÉCHARGER UN FICHIER d'un lien privé : `/api/partage/<id>/<jeton>/<fichierId>`
 * (Candidatures unifiées L5, ADR 0065 D6).
 *
 * Le fichier ne transite PAS par le serveur : la route écrit l'accès au journal
 * puis redirige (302) vers une adresse R2 signée courte, en téléchargement, au
 * nom d'origine (1 h ; 12 h au-delà de 1 Go). Un lien externe redirige vers son
 * adresse d'origine.
 *
 *   - refus (jeton faux, lien expiré ou retiré, fichier étranger au lien) → page neutre, 404 ;
 *   - rien à servir maintenant (plafond atteint, antivirus en cours) → retour à la page (303), qui le dit ;
 *   - stockage injoignable → page « Fichiers momentanément indisponibles », 503, rien d'écrit.
 *
 * `HEAD` n'écrit rien et ne redirige pas : un robot qui sonde le lien ne
 * consomme pas le plafond. `no-store` partout.
 */

import { depsParDefaut, telechargerFichierLien } from "@/server/partages/acces";
import {
  ENTETES_PAGE_PARTAGE,
  pageIndisponible,
  pageNeutre,
} from "@/server/partages/page-publique";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Contexte = { params: Promise<{ id: string; jeton: string; fichierId: string }> };

const REDIRECTION = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function GET(req: Request, { params }: Contexte): Promise<Response> {
  const { id, jeton, fichierId } = await params;
  const r = await telechargerFichierLien(
    { id, jeton, fichierId, entetes: req.headers },
    await depsParDefaut(),
  );
  switch (r.issue) {
    case "redirection":
      return new Response(null, { status: 302, headers: { ...REDIRECTION, Location: r.url } });
    case "retour":
      return new Response(null, { status: 303, headers: { ...REDIRECTION, Location: r.chemin } });
    case "indisponible":
      return new Response(pageIndisponible(), { status: 503, headers: ENTETES_PAGE_PARTAGE });
    case "neutre":
      return new Response(pageNeutre(), { status: 404, headers: ENTETES_PAGE_PARTAGE });
  }
}

export async function HEAD(): Promise<Response> {
  return new Response(null, { status: 204, headers: ENTETES_PAGE_PARTAGE });
}
